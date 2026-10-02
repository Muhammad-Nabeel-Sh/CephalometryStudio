import { describe, it, expect } from "vitest";
import { hypothesisSet, detectLandmarks } from "../canvas/landmarkDetector.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Orientation / polarity hypothesis search
//
// The production model is orientation-specific: it was never trained on
// horizontally flipped or polarity-inverted radiographs, so a mirrored film can
// produce a confidently-wrong result. These tests pin the search order and the
// explicit-override contract that the re-trace UI depends on.
// ═══════════════════════════════════════════════════════════════════════════════

const ALL = { autoOrientation: true, autoPolarity: true };

describe("hypothesisSet", () => {
  it("tries the untransformed image first, so a normal film costs one pass", () => {
    const list = hypothesisSet(ALL, {});
    expect(list[0]).toEqual({ mirror: false, invert: false });
    expect(list).toHaveLength(4);
  });

  it("covers mirrored and inverted variants by default", () => {
    const list = hypothesisSet(ALL, {});
    const key = (h) => `${h.mirror ? "M" : "n"}${h.invert ? "I" : "n"}`;
    expect(list.map(key).sort()).toEqual(["MI", "Mn", "nI", "nn"].sort());
  });

  it("omits mirrored variants when orientation search is disabled", () => {
    const list = hypothesisSet({ ...ALL, autoOrientation: false }, {});
    expect(list).toHaveLength(2);
    expect(list.every((h) => h.mirror === false)).toBe(true);
  });

  it("omits inverted variants when polarity search is disabled", () => {
    const list = hypothesisSet({ ...ALL, autoPolarity: false }, {});
    expect(list).toHaveLength(2);
    expect(list.every((h) => h.invert === false)).toBe(true);
  });

  it("searches nothing beyond the normal hypothesis when both are disabled", () => {
    const list = hypothesisSet({ autoOrientation: false, autoPolarity: false }, {});
    expect(list).toEqual([{ mirror: false, invert: false }]);
  });

  // The re-trace buttons in MarkupsPanel pass exactly these shapes.
  it("honours an explicit forced hypothesis over the configured search", () => {
    const list = hypothesisSet(ALL, { forceHypothesis: { mirror: true, invert: false } });
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ mirror: true, invert: false, forced: true });
  });

  it("supports forcing a mirror+polarity flip simultaneously", () => {
    const list = hypothesisSet(ALL, { forceHypothesis: { mirror: true, invert: true } });
    expect(list).toEqual([{ mirror: true, invert: true, forced: true }]);
  });

  it("treats a partially specified forced hypothesis as false-y, not undefined", () => {
    const list = hypothesisSet(ALL, { forceHypothesis: { mirror: true } });
    expect(list[0].mirror).toBe(true);
    expect(list[0].invert).toBe(false);
  });

  it("accepts the legacy `force` alias", () => {
    const list = hypothesisSet(ALL, { force: { mirror: false, invert: true } });
    expect(list[0].invert).toBe(true);
  });

  it("tolerates being called with no arguments", () => {
    // No config at all must still evaluate the untransformed image rather than
    // silently doing nothing.
    const list = hypothesisSet();
    expect(list[0]).toEqual({ mirror: false, invert: false });
  });
});

describe("detectLandmarks — demo backend contract", () => {
  it("returns detections for an image and rejects an empty input", async () => {
    const w = 64, h = 64;
    const pixels = new Uint8ClampedArray(w * h * 4).fill(180);
    const res = await detectLandmarks({ pixels, width: w, height: h }, { landmarkSet: "cepha29" });
    expect(Array.isArray(res.landmarks)).toBe(true);
    expect(res.backend).toBe("mock");

    await expect(detectLandmarks(null, { landmarkSet: "cepha29" })).rejects.toThrow(/No image to trace/);
  });
});