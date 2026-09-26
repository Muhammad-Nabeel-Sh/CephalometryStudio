import { describe, it, expect } from "vitest";
import { refineShape, SHAPE_MODEL, getShapeModel, registerShapeModel } from "../lib/shapeModel.js";

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
