import { describe, it, expect } from "vitest";
import { refineShape, shapeResidual, SHAPE_MODEL, getShapeModel, registerShapeModel } from "../lib/shapeModel.js";
import { CEPHA29_ORDER } from "../data/landmarkMap.js";

const N = 19;
const meanPts = [];
for (let i = 0; i < N; i++) meanPts.push({ x: SHAPE_MODEL.mean[2 * i], y: SHAPE_MODEL.mean[2 * i + 1] });
const ones = new Array(N).fill(1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function transform(pts, s, theta, t) {
  const c = Math.cos(theta), sn = Math.sin(theta);
  return pts.map((p) => ({ x: s * (c * p.x - sn * p.y) + t.x, y: s * (sn * p.x + c * p.y) + t.y }));
}

describe("refineShape", () => {
  it("leaves non-matching inputs untouched", () => {
    const short = meanPts.slice(0, 5);
    expect(refineShape(short, ones)).toBe(short);
  });

  it("is (near) identity for a configuration already on the mean shape", () => {
    const out = refineShape(meanPts, ones, { alpha: 1, reg: 0.01, k: 6 });
    let max = 0;
    for (let i = 0; i < N; i++) max = Math.max(max, dist(out[i], meanPts[i]));
    expect(max).toBeLessThan(1e-6);
  });

  it("preserves pose under translation/scale/rotation", () => {
    const moved = transform(meanPts, 640, 0.4, { x: 300, y: -120 });
    const out = refineShape(moved, ones, { alpha: 1, reg: 0.01, k: 6 });
    let max = 0;
    for (let i = 0; i < N; i++) max = Math.max(max, dist(out[i], moved[i]));
    expect(max).toBeLessThan(1e-4);
  });

  it("pulls a gross outlier toward a plausible shape", () => {
    const goIdx = SHAPE_MODEL.landmarks.indexOf("Go");
    const bad = meanPts.map((p) => ({ ...p }));
    bad[goIdx] = { x: bad[goIdx].x + 0.9, y: bad[goIdx].y + 0.4 };
    const before = dist(bad[goIdx], meanPts[goIdx]);
    const out = refineShape(bad, ones, { alpha: 1, reg: 0.05, k: 6 });
    const after = dist(out[goIdx], meanPts[goIdx]);
    expect(after).toBeLessThan(before);
  });

  it("reduces the overall deviation from the mean shape", () => {
    const bad = meanPts.map((p, i) => ({ x: p.x + 0.05 * Math.sin(i), y: p.y + 0.05 * Math.cos(i) }));
    bad[5] = { x: bad[5].x + 0.7, y: bad[5].y - 0.3 };
    const maxdev = (pts) => Math.max(...pts.map((p, i) => dist(p, meanPts[i])));
    const out = refineShape(bad, ones, { alpha: 1, reg: 0.05, k: 6 });
    expect(maxdev(out)).toBeLessThan(maxdev(bad));
  });
});

describe("shape-model registry", () => {
  it("registers ISBI-19 and reports unknown sets as null", () => {
    expect(getShapeModel("isbi19")).toBe(SHAPE_MODEL);
    expect(getShapeModel("does-not-exist")).toBeNull();
  });

  it("refines against a registered set's prior", () => {
    registerShapeModel("unit", SHAPE_MODEL);
    const bad = meanPts.map((p) => ({ ...p }));
    bad[2] = { x: bad[2].x + 0.5, y: bad[2].y };
    const out = refineShape(bad, ones, { set: "unit", alpha: 1, reg: 0.05, k: 6 });
    expect(dist(out[2], meanPts[2])).toBeLessThan(dist(bad[2], meanPts[2]));
  });
});

describe("CEPHA29 prior", () => {
  const prior = getShapeModel("cepha29");
  const pts29 = () => {
    const pts = [];
    for (let i = 0; i < 29; i++) pts.push({ x: prior.mean[2 * i], y: prior.mean[2 * i + 1] });
    return pts;
  };

  it("ships a 29-landmark prior in channel order", () => {
    expect(prior).toBeTruthy();
    expect(prior.landmarks).toEqual(CEPHA29_ORDER);
    expect(prior.mean).toHaveLength(58);
    expect(prior.components.length).toBeGreaterThan(0);
  });

  it("reduces deviation on a perturbed CEPHA29 shape", () => {
    const pts = pts29();
    const ones29 = new Array(29).fill(1);
    const bad = pts.map((p) => ({ ...p }));
    bad[10] = { x: bad[10].x + 0.6, y: bad[10].y - 0.3 };
    const maxdev = (a) => Math.max(...a.map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)));
    const out = refineShape(bad, ones29, { set: "cepha29", alpha: 1, reg: 0.05, k: 6 });
    expect(maxdev(out)).toBeLessThan(maxdev(bad));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// shapeResidual — the out-of-distribution signal
//
// A prediction is "in distribution" when it lands in the PCA shape subspace.
// The orthogonal residual separates a genuine detection (a few pixels off) from
// a failed one by an order of magnitude: a mirrored radiograph, an upside-down
// film, a shuffled point order and random noise all score ≈1.0, while a
// realistic detection (≈11 px RMS, the model's reported 1.24 mm MRE) scores
// ≈0.03. That separation is what makes the quality gate able to catch a
// confidently-wrong trace.
// ═══════════════════════════════════════════════════════════════════════════════

describe("shapeResidual (CEPHA29)", () => {
  const prior = getShapeModel("cepha29");
  const meanPts29 = () => {
    const pts = [];
    for (let i = 0; i < 29; i++) pts.push({ x: prior.mean[2 * i], y: prior.mean[2 * i + 1] });
    return pts;
  };
  const centroid = (pts) => {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    return { x: cx / pts.length, y: cy / pts.length };
  };
  const jitter = (pts, amt) => pts.map((p, i) => ({ x: p.x + Math.sin(i * 3.7) * amt, y: p.y + Math.cos(i * 2.1) * amt }));
  const res = (pts) => shapeResidual(pts, { set: "cepha29" });

  it("returns null when the point count does not match the prior", () => {
    expect(res(meanPts29().slice(0, 10))).toBeNull();
  });

  it("is exactly zero for the mean shape", () => {
    const r = res(meanPts29());
    expect(r.residual).toBeCloseTo(0, 6);
    expect(r.residualRatio).toBeCloseTo(0, 6);
    expect(r.mahalanobis).toBeCloseTo(0, 6);
  });

  it("is pose-invariant (translation / scale / rotation)", () => {
    const pts = meanPts29();
    const moved = transform(pts, 640, 0.4, { x: 300, y: -120 });
    expect(res(moved).residualRatio).toBeCloseTo(res(pts).residualRatio, 6);
  });

  it("stays small for a realistic detection error", () => {
    const r = res(jitter(meanPts29(), 11)); // ≈ the model's 1.24 mm MRE
    expect(r.residualRatio).toBeLessThan(0.05);
    expect(r.residualRatio).toBeGreaterThan(0);
  });

  it("grows with the size of the error", () => {
    const pts = meanPts29();
    expect(res(jitter(pts, 30)).residualRatio).toBeGreaterThan(res(jitter(pts, 10)).residualRatio);
    expect(res(jitter(pts, 60)).residualRatio).toBeGreaterThan(res(jitter(pts, 30)).residualRatio);
  });

  it("is an order of magnitude larger for a mirrored radiograph", () => {
    const pts = meanPts29();
    const c = centroid(pts);
    const mirrored = pts.map((p) => ({ x: 2 * c.x - p.x, y: p.y }));
    const good = res(jitter(pts, 11)).residualRatio;
    const bad = res(mirrored).residualRatio;
    expect(bad).toBeGreaterThan(0.5);
    expect(bad).toBeGreaterThan(good * 10);
  });

  it("flags an upside-down film, a shuffled order and random noise", () => {
    const pts = meanPts29();
    const c = centroid(pts);
    const upsideDown = res(pts.map((p) => ({ x: p.x, y: 2 * c.y - p.y }))).residualRatio;
    const shuffled = pts.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const shuffledR = res(shuffled).residualRatio;
    const collapsed = res(pts.map(() => ({ x: pts[0].x, y: pts[0].y }))).residualRatio;
    for (const v of [upsideDown, shuffledR, collapsed]) expect(v).toBeGreaterThan(0.5);
  });

  it("reports a positive mean-shape size so residualRatio is dimensionless", () => {
    const r = res(meanPts29());
    expect(r.size).toBeGreaterThan(0);
  });
});
