import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDetector, detectLandmarks, terminateDetector } from "../canvas/landmarkDetector.js";
import { getShapeModel } from "../lib/shapeModel.js";
import { CEPHA29_ORDER } from "../data/landmarkMap.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Hypothesis search against a controlled, orientation-sensitive model
//
// jsdom gives us a `window`, so we can inject a fake onnxruntime-web whose
// "model" only recognises a radiograph that runs dark→bright left to right (a
// stand-in for the real model being orientation-specific). That lets us pin the
// one property that is easy to get wrong and impossible to see without a real
// model: whether the mirrored hypothesis is judged *in the frame the network
// saw* (so a correct mirrored detection is not punished for looking mirrored),
// or in the display frame (where a correct mirrored detection looks like a
// reflected cephalogram and the ranker rejects it).
//
// The polarity hypothesis is disabled here because a linear ramp is
// indistinguishable under mirror and inversion; mirror is the axis under test.
// ═══════════════════════════════════════════════════════════════════════════════

const HEAT = 192;
const N = 29;
const IMG = 128;

const prior = getShapeModel("cepha29");
const meanPts = Array.from({ length: N }, (_, i) => ({ x: prior.mean[2 * i], y: prior.mean[2 * i + 1] }));
const xs = meanPts.map((p) => p.x), ys = meanPts.map((p) => p.y);
const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
const hScale = (HEAT * 0.8) / span;
const heatPts = meanPts.map((p) => ({
  x: (p.x - Math.min(...xs)) * hScale + HEAT * 0.1,
  y: (p.y - Math.min(...ys)) * hScale + HEAT * 0.1,
}));

function gaussPlane(cx, cy, sigma) {
  const plane = new Float32Array(HEAT * HEAT);
  const s2 = 2 * sigma * sigma;
  for (let y = 0; y < HEAT; y++) {
    for (let x = 0; x < HEAT; x++) plane[y * HEAT + x] = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s2);
  }
  return plane;
}

// Canonical result: every landmark at its expected shape position.
function canonicalHeatmaps() {
  const data = new Float32Array(N * HEAT * HEAT);
  for (let c = 0; c < N; c++) data.set(gaussPlane(heatPts[c].x, heatPts[c].y, 2), c * HEAT * HEAT);
  return data;
}

// Failed result: every landmark collapses to the image centre — a shape the
// prior soundly rejects.
function collapsedHeatmaps() {
  const data = new Float32Array(N * HEAT * HEAT);
  const plane = gaussPlane(HEAT / 2, HEAT / 2, 2);
  for (let c = 0; c < N; c++) data.set(plane, c * HEAT * HEAT);
  return data;
}

class FakeTensor {
  constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; }
}

function installFakeOrt() {
  const session = {
    inputNames: ["input"],
    outputNames: ["output"],
    // The "model": canonical iff the image brightens left→right. Any other
    // orientation produces a collapsed (rejected) shape.
    run: async (feeds) => {
      const t = feeds.input;
      const plane = t.data; // channel 0; channels 1,2 are identical copies
      let left = 0, right = 0;
      const half = t.dims[2] >> 1;
      for (let y = 0; y < t.dims[2]; y++) {
        for (let x = 0; x < t.dims[3]; x++) {
          const v = plane[y * t.dims[3] + x];
          if (x < half) left += v; else right += v;
        }
      }
      const data = left > right ? canonicalHeatmaps() : collapsedHeatmaps();
      return { output: { data, dims: [1, N, HEAT, HEAT] } };
    },
  };
  window.ort = {
    Tensor: FakeTensor,
    InferenceSession: { create: async () => session },
    env: {},
  };
  return session;
}

// A ramp: dark on the left, bright on the right (the "mirrored" film), or the
// reverse (the "normal" film).
function rampImage(mirrored) {
  const pixels = new Uint8ClampedArray(IMG * IMG * 4);
  for (let y = 0; y < IMG; y++) {
    for (let x = 0; x < IMG; x++) {
      const f = x / (IMG - 1);
      const v = Math.round((mirrored ? f : 1 - f) * 255);
      const i = (y * IMG + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
  }
  return { pixels, width: IMG, height: IMG };
}

const INIT = {
  landmarkSet: "cepha29",
  inputSize: 64,
  inputChannels: 3,
  modelBuffer: new ArrayBuffer(8),
  decode: { dark: true, sigma: 2, confidenceMode: "psr", psrScale: 6 },
  robustness: { autoOrientation: true, autoPolarity: false },
  quality: null,
};

describe("mirrored-film hypothesis search", () => {
  beforeEach(() => { installFakeOrt(); });
  afterEach(() => { terminateDetector(); delete window.ort; });

  it("prefers the mirrored hypothesis when the film is mirrored", async () => {
    await initDetector(INIT);
    const res = await detectLandmarks(rampImage(true), { landmarkSet: "cepha29" });

    expect(res.backend).toBe("onnx");
    expect(res.orientation).toBe("mirrored");
    // The winning candidate must be judged on its canonical (model-space) shape,
    // so its residual is small — not the ≈1.0 it would be if the mirrored output
    // were compared against the prior in the display frame.
    expect(res.quality.residualRatio).toBeLessThan(0.06);
    expect(res.quality.level).toBe("high");
  });

  it("leaves a normal film on the normal hypothesis", async () => {
    await initDetector(INIT);
    const res = await detectLandmarks(rampImage(false), { landmarkSet: "cepha29" });
    expect(res.orientation).toBe("normal");
    expect(res.quality.level).toBe("high");
  });

  it("returns points that actually differ between the two hypotheses", async () => {
    await initDetector(INIT);
    const frame = rampImage(true);
    // On a mirrored film, forcing the normal hypothesis yields the collapsed
    // failed shape; forcing mirror yields the real, reflected anatomy. If the
    // forced run were a no-op these would be identical.
    const normal = await detectLandmarks(frame, { landmarkSet: "cepha29", forceHypothesis: { mirror: false, invert: false } });
    const mirrored = await detectLandmarks(frame, { landmarkSet: "cepha29", forceHypothesis: { mirror: true, invert: false } });
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const moved = mirrored.landmarks.reduce((m, l, i) => Math.max(m, dist(l, normal.landmarks[i])), 0);
    expect(moved).toBeGreaterThan(1);
  });

  it("honours an explicit forced hypothesis", async () => {
    await initDetector(INIT);
    const res = await detectLandmarks(rampImage(true), {
      landmarkSet: "cepha29",
      forceHypothesis: { mirror: true, invert: false },
    });
    expect(res.orientation).toBe("mirrored");
    expect(res.quality.residualRatio).toBeLessThan(0.06);
    expect(res.hypotheses).toHaveLength(1);
  });

  it("does not confuse a mirrored film with a normal one in its diagnostics", async () => {
    await initDetector(INIT);
    const res = await detectLandmarks(rampImage(true), { landmarkSet: "cepha29" });
    // normal suspect scored low, mirrored scored high
    const byOrientation = Object.fromEntries(res.hypotheses.map((h) => [h.mirror ? "mirror" : "normal", h]));
    expect(byOrientation.normal.residualRatio).toBeGreaterThan(0.5);
    expect(byOrientation.mirror.residualRatio).toBeLessThan(0.06);
  });

  it("exposes the CEPHA29 symbols in canonical channel order", async () => {
    await initDetector(INIT);
    const res = await detectLandmarks(rampImage(false), { landmarkSet: "cepha29" });
    expect(res.landmarks.map((l) => l.symbol)).toEqual(CEPHA29_ORDER);
  });
});