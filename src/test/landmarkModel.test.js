import { describe, it, expect } from "vitest";
import {
  imageDataToGrayscale,
  resizeBilinearGray,
  preprocessGrayscale,
  decodeHeatmaps,
  decodeRegression,
  MODEL_INPUT_SIZE,
  planeStd,
  flipGrayHorizontal,
  invertGray,
  contrastStretch,
  applyCLAHE,
  psrFromPlane,
  psrNoiseFloor,
  PSR_SCALE,
} from "../lib/landmarkModel.js";

describe("imageDataToGrayscale", () => {
  it("converts white/black pixels to 1/0", () => {
    expect(imageDataToGrayscale(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1)[0]).toBeCloseTo(1);
    expect(imageDataToGrayscale(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1)[0]).toBeCloseTo(0);
  });
});

describe("resizeBilinearGray", () => {
  it("is an identity copy at the same size", () => {
    const out = resizeBilinearGray(new Float32Array([0, 1, 2, 3]), 2, 2, 2, 2);
    expect([...out]).toEqual([0, 1, 2, 3]);
  });

  it("averages a 2×2 block down to a single value", () => {
    const out = resizeBilinearGray(new Float32Array([0, 1, 2, 3]), 2, 2, 1, 1);
    expect(out[0]).toBeCloseTo(1.5, 5);
  });
});

describe("preprocessGrayscale", () => {
  it("produces a size×size normalized tensor and keeps source dims", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor, size, srcWidth, srcHeight } = preprocessGrayscale(rgba, 4, 4, MODEL_INPUT_SIZE);
    expect(size).toBe(MODEL_INPUT_SIZE);
    expect(srcWidth).toBe(4);
    expect(srcHeight).toBe(4);
    expect(tensor).toHaveLength(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
    expect(tensor[0]).toBeCloseTo(1);
  });

  it("replicates grayscale across RGB channels when requested", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor, channels } = preprocessGrayscale(rgba, 4, 4, 8, { channels: 3 });
    expect(channels).toBe(3);
    expect(tensor).toHaveLength(3 * 8 * 8);
    expect(tensor[0]).toBeCloseTo(1);
    expect(tensor[64]).toBeCloseTo(1);
    expect(tensor[128]).toBeCloseTo(1);
  });

  it("applies per-channel ImageNet normalization", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor } = preprocessGrayscale(rgba, 4, 4, 2, {
      channels: 3,
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    });
    expect(tensor[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(tensor[4]).toBeCloseTo((1 - 0.456) / 0.224, 5);
    expect(tensor[8]).toBeCloseTo((1 - 0.406) / 0.225, 5);
  });
});

describe("decodeHeatmaps", () => {
  it("maps a heatmap peak back to source pixels", () => {
    const flat = new Float32Array(4 * 4);
    flat[1 * 4 + 2] = 0.9;
    const [lm] = decodeHeatmaps(flat, { channels: 1, heatWidth: 4, heatHeight: 4, srcWidth: 8, srcHeight: 8 });
    expect(lm.x).toBeCloseTo(5, 5);
    expect(lm.y).toBeCloseTo(3, 5);
    expect(lm.confidence).toBeCloseTo(0.9, 5);
  });

  it("decodes multiple channels independently", () => {
    const flat = new Float32Array(2 * 4 * 4);
    flat[0] = 1;                 // channel 0, (0,0)
    flat[16 + 3 * 4 + 3] = 0.5;  // channel 1, (3,3)
    const out = decodeHeatmaps(flat, { channels: 2, heatWidth: 4, heatHeight: 4, srcWidth: 8, srcHeight: 8 });
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(1, 5);
    expect(out[0].y).toBeCloseTo(1, 5);
    expect(out[1].x).toBeCloseTo(7, 5);
    expect(out[1].y).toBeCloseTo(7, 5);
  });

  it("applies a sigmoid when requested", () => {
    const flat = new Float32Array(4 * 4);
    flat[0] = 0;
    const [lm] = decodeHeatmaps(flat, { channels: 1, heatWidth: 4, heatHeight: 4, srcWidth: 4, srcHeight: 4, applySigmoid: true });
    expect(lm.confidence).toBeCloseTo(0.5, 5);
  });
});

describe("decodeRegression", () => {
  it("scales normalized coordinates to source pixels", () => {
    const [lm] = decodeRegression(new Float32Array([0.25, 0.5]), { channels: 1, srcWidth: 100, srcHeight: 200, normalize: true });
    expect(lm.x).toBeCloseTo(25, 5);
    expect(lm.y).toBeCloseTo(100, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Robustness transforms (mirror / polarity / contrast)
// ═══════════════════════════════════════════════════════════════════════════════

describe("plane helpers", () => {
  it("flipGrayHorizontal mirrors columns", () => {
    const plane = new Float32Array([1, 2, 3, 4, 5, 6]); // 3×2
    expect([...flipGrayHorizontal(plane, 3, 2)]).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it("invertGray maps 0→1 and 1→0", () => {
    expect([...invertGray(new Float32Array([0, 0.25, 0.5, 1]))]).toEqual([1, 0.75, 0.5, 0]);
  });

  it("planeStd measures spread", () => {
    expect(planeStd(new Float32Array([5, 5, 5, 5]))).toBeCloseTo(0, 6);
    expect(planeStd(new Float32Array([0, 1]))).toBeCloseTo(0.5, 6);
  });

  it("contrastStretch expands a low-contrast plane toward the full range", () => {
    const w = 64, h = 64;
    // A realistic low-contrast scan: values compressed into [0.35, 0.55].
    const plane = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) plane[i] = 0.35 + 0.2 * ((i * 37) % 100) / 100;
    const out = contrastStretch(plane);
    expect(Math.min(...out)).toBeLessThan(0.05);
    expect(Math.max(...out)).toBeGreaterThan(0.95);
    expect(planeStd(out)).toBeGreaterThan(planeStd(plane));
  });

  it("applyCLAHE boosts local contrast in a locally flat image", () => {
    // Production-like behaviour: the image is locally near-uniform (a faint
    // structure on a flat background), which is exactly the radiograph case
    // CLAHE exists for. Histogram equalisation *compresses* dominant bins, so
    // the meaningful contract is per-tile std rising (and never falling).
    const W = 256, H = 256;
    const plane = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = ((x * 2654435761 + y * 40503) % 1000) / 1000;
        plane[y * W + x] = 0.45 + 0.02 * Math.sin(x / 40) + 0.03 * u;
      }
    const tileStd = (p) => {
      const tw = W / 8, th = H / 8, out = [];
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          let s = 0;
          for (let y = j * th; y < (j + 1) * th; y++) for (let x = i * tw; x < (i + 1) * tw; x++) s += p[y * W + x];
          const mu = s / (tw * th);
          let v = 0;
          for (let y = j * th; y < (j + 1) * th; y++)
            for (let x = i * tw; x < (i + 1) * tw; x++) { const d = p[y * W + x] - mu; v += d * d; }
          out.push(Math.sqrt(v / (tw * th)));
        }
      return out;
    };
    const before = tileStd(plane);
    const out = applyCLAHE(plane, W, H, { tiles: 8, clipLimit: 2 });
    const after = tileStd(out);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(after)).toBeGreaterThan(mean(before) * 1.5);
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeGreaterThan(before[i] - 1e-6);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it("applyCLAHE preserves a constant plane as constant (no invented detail)", () => {
    const w = 32, h = 32;
    const flat = new Float32Array(w * h).fill(0.5);
    const out = applyCLAHE(flat, w, h, { tiles: 4, clipLimit: 2 });
    expect(planeStd(out)).toBeLessThan(0.02);
  });
});

describe("preprocessGrayscale robustness options", () => {
  function rampRGBA(w, h) {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = Math.round((x / (w - 1)) * 255);
        const i = (y * w + x) * 4;
        rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
      }
    return rgba;
  }

  it("mirrors the image left-to-right when asked", () => {
    const w = 4, h = 4;
    const normal = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1 });
    const mirrored = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1, mirror: true });
    expect(mirrored.applied.mirror).toBe(true);
    expect(normal.applied.mirror).toBe(false);
    // The ramp runs dark→bright left-to-right; mirroring reverses it.
    expect(normal.tensor[0]).toBeLessThan(normal.tensor[w - 1]);
    expect(mirrored.tensor[0]).toBeGreaterThan(mirrored.tensor[w - 1]);
    // Mirror is an involution.
    const twice = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1, mirror: true, invert: false });
    expect([...twice.tensor]).toEqual([...mirrored.tensor]);
  });

  it("inverts polarity when asked", () => {
    const w = 4, h = 4;
    const normal = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1 });
    const inverted = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1, invert: true });
    expect(inverted.applied.invert).toBe(true);
    expect(inverted.tensor[0]).toBeCloseTo(1 - normal.tensor[0], 5);
  });

  it("auto-CLAHE only fires on a poorly contrasted plane", () => {
    const w = 32, h = 32;
    const flat = new Uint8ClampedArray(w * h * 4).fill(120);
    const expectAuto = preprocessGrayscale(flat, w, h, w, { channels: 1, clahe: "auto" });
    expect(expectAuto.applied.clahe).toBe(true);

    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = i % 2 === 0 ? 20 : 235; // huge contrast already
      rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
    }
    const rich = preprocessGrayscale(rgba, w, h, w, { channels: 1, clahe: "auto" });
    expect(rich.applied.clahe).toBe(false);
  });

  it("leaves defaults unchanged when no robustness options are set", () => {
    const w = 4, h = 4;
    const { applied } = preprocessGrayscale(rampRGBA(w, h), w, h, w, { channels: 1 });
    expect(applied).toEqual({ mirror: false, invert: false, clahe: false, contrast: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Peak-to-sidelobe confidence
// ═══════════════════════════════════════════════════════════════════════════════

describe("psrFromPlane", () => {
  it("scores a sharp peak well above a noise-only plane", () => {
    const n = 64 * 64;
    const sharp = new Float32Array(n);
    sharp[32 * 64 + 32] = 1;
    const noise = new Float32Array(n).map((_, i) => ((i * 2654435761) % 1000) / 1000 - 0.5);
    const a = psrFromPlane(sharp, 32 * 64 + 32);
    const b = psrFromPlane(noise, 0);
    expect(a.confidence).toBeGreaterThan(b.confidence);
    expect(b.confidence).toBeLessThan(0.3);
  });

  it("subtracts the extreme-value noise floor so a flat plane scores ~0", () => {
    // The maximum of N samples sits ~sqrt(2 ln N) sd above the mean even with no
    // signal, so without the floor correction a pure-noise plane looks confident.
    const n = 192 * 192;
    expect(psrNoiseFloor(n)).toBeGreaterThan(3);
    const rnd = new Float32Array(n);
    // Box–Muller Gaussian noise. The extreme-value floor in psrNoiseFloor is a
    // Gaussian estimate (the max of N iid samples sits ~sqrt(2 ln N) sd above the
    // mean), so this is the distribution the floor is calibrated against. Uniform
    // noise would peak at only ~1.7 sd and the test would prove nothing.
    let s = 123456789;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < n; i += 2) {
      const u1 = Math.max(next(), 1e-12), u2 = next();
      const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
      rnd[i] = r * Math.cos(th);
      if (i + 1 < n) rnd[i + 1] = r * Math.sin(th);
    }
    let bestIdx = 0;
    for (let i = 1; i < n; i++) if (rnd[i] > rnd[bestIdx]) bestIdx = i;
    const r = psrFromPlane(rnd, bestIdx);
    expect(r.psr).toBeGreaterThan(3);           // raw z is high…
    expect(r.excess).toBeLessThan(1.5);        // …but almost all of it is noise
    expect(r.confidence).toBeLessThan(0.25);
  });

  it("returns 0 confidence for a degenerate (constant) plane", () => {
    expect(psrFromPlane(new Float32Array(16).fill(0.5), 0).confidence).toBe(0);
  });

  it("psrNoiseFloor is 0 for degenerate plane sizes", () => {
    expect(psrNoiseFloor(1)).toBe(0);
    expect(psrNoiseFloor(0)).toBe(0);
  });
});

describe("decodeHeatmaps — PSR confidence mode", () => {
  // Realistic heatmap: a narrow Gaussian peak on a small, smooth background.
  function heatplane(w, h, cx, cy, sigma = 1.2, bg = 0.02) {
    const p = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        p[y * w + x] = bg + 0.98 * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma)));
    return p;
  }

  it("assigns a discriminative confidence and exposes the raw score", () => {
    const w = 48, h = 48;
    const out = decodeHeatmaps(heatplane(w, h, 10, 10), {
      channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h,
      dark: true, sigma: 2, confidenceMode: "psr",
    });
    expect(out[0].confidence).toBeGreaterThan(0.5);
    expect(out[0].score).toBeGreaterThan(0);
    expect(out[0].x).toBeCloseTo(10.5, 0);
    expect(out[0].y).toBeCloseTo(10.5, 0);
  });

  it("separates a sharp peak from a diffuse one", () => {
    const w = 48, h = 48;
    const opts = { channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h, dark: true, sigma: 2, confidenceMode: "psr" };
    const sharp = decodeHeatmaps(heatplane(w, h, 20, 20, 1.0), opts)[0];
    const diffuse = decodeHeatmaps(heatplane(w, h, 20, 20, 6.0), opts)[0];
    expect(sharp.confidence).toBeGreaterThan(diffuse.confidence);
    expect(sharp.confidence).toBeGreaterThan(0.5);
    expect(diffuse.confidence).toBeLessThan(0.3);
  });

  it("gives a flat / uninformative plane low confidence", () => {
    const w = 48, h = 48;
    // A smoothed-to-nothing pattern: no structure left to be confident about.
    const flat = new Float32Array(w * h).map((_, i) => 0.5 + 1e-3 * ((i % 7) - 3));
    const [lm] = decodeHeatmaps(flat, {
      channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h,
      dark: true, sigma: 2, confidenceMode: "psr",
    });
    expect(lm.confidence).toBeLessThan(0.35);
  });

  it("keeps the legacy value-based confidence when not requested", () => {
    const w = 8, h = 8;
    const flat = new Float32Array(w * h);
    flat[0] = 0.9;
    const [lm] = decodeHeatmaps(flat, { channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h });
    expect(lm.confidence).toBeCloseTo(0.9, 5);
    expect(PSR_SCALE).toBeGreaterThan(0);
  });
});

describe("decodeHeatmaps — DARK", () => {
  function gaussianPlane(w, h, cx, cy, sigma = 1.5) {
    const p = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        p[y * w + x] = Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma)));
    return p;
  }

  it("recovers a sub-pixel peak more accurately than raw argmax", () => {
    const w = 32, h = 32, cx = 10.3, cy = 20.6;
    const plane = gaussianPlane(w, h, cx, cy);
    const opts = { channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h };
    const [dark] = decodeHeatmaps(plane, { ...opts, dark: true, sigma: 2 });
    const [quad] = decodeHeatmaps(plane, { ...opts, dark: false });
    const truthX = cx + 0.5, truthY = cy + 0.5; // +0.5 pixel-centre convention
    expect(Math.abs(dark.x - truthX)).toBeLessThan(0.25);
    expect(Math.abs(dark.y - truthY)).toBeLessThan(0.25);
    expect(Math.abs(dark.x - truthX)).toBeLessThanOrEqual(Math.abs(quad.x - truthX) + 0.05);
  });

  it("decodes multiple channels and integer peaks", () => {
    const w = 16, h = 16;
    const plane = new Float32Array(2 * w * h);
    plane.set(gaussianPlane(w, h, 5, 9), 0);
    plane.set(gaussianPlane(w, h, 12, 3), w * h);
    const out = decodeHeatmaps(plane, { channels: 2, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h, dark: true, sigma: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(5.5, 0);
    expect(out[0].y).toBeCloseTo(9.5, 0);
    expect(out[1].x).toBeCloseTo(12.5, 0);
    expect(out[1].y).toBeCloseTo(3.5, 0);
  });
});
