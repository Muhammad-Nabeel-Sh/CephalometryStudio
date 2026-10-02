import { describe, it, expect } from "vitest";
import {
  assessTraceQuality,
  qualityRankScore,
  describeQuality,
  DEFAULT_QUALITY_THRESHOLDS,
} from "../lib/landmarkQuality.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Trace quality gate
//
// The gate is what stops a failed detection (mirrored, inverted, cropped,
// unrecognisable) from silently becoming measurements and normative
// interpretation. Confidence alone is weak — a wrong-but-confident prediction is
// possible — so the verdict combines heatmap confidence with shape-prior
// plausibility and a border/extrapolation check.
// ═══════════════════════════════════════════════════════════════════════════════

// A confident, plausible trace: 29 landmarks well inside the frame.
function goodLandmarks(n = 29, conf = 0.62) {
  return Array.from({ length: n }, (_, i) => ({
    x: 100 + (i % 10) * 80,
    y: 100 + Math.floor(i / 10) * 90,
    confidence: conf,
  }));
}

const GOOD_RESIDUAL = { residual: 40, residualRatio: 0.02, mahalanobis: 2 };

describe("assessTraceQuality", () => {
  it("rates a confident, plausible trace as high", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(),
      width: 1000, height: 800,
      residual: GOOD_RESIDUAL,
    });
    expect(q.level).toBe("high");
    expect(q.reasons).toEqual([]);
    expect(q.meanConfidence).toBeCloseTo(0.62, 5);
    expect(q.edgeCount).toBe(0);
  });

  it("rates a low-confidence trace as low and explains why", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.08),
      width: 1000, height: 800,
      residual: GOOD_RESIDUAL,
    });
    expect(q.level).toBe("low");
    expect(q.reasons.join(" ")).toMatch(/weak heatmap response/);
    expect(q.reasons.join(" ")).toMatch(/confidence is low/);
  });

  it("flags an anatomically implausible configuration even when confidence is high", () => {
    // This is the dangerous case: the heatmaps look confident but the points do
    // not form a cephalogram (a mirrored film looks like this to the model).
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6),
      width: 1000, height: 800,
      residual: { residual: 900, residualRatio: 0.9, mahalanobis: 20 },
    });
    expect(q.level).toBe("low");
    expect(q.reasons.join(" ")).toMatch(/anatomically atypical/);
  });

  it("flags landmarks sitting on the image border", () => {
    const lms = goodLandmarks(29, 0.6);
    // Push 6 of them onto the frame edge.
    for (let i = 0; i < 6; i++) { lms[i] = { ...lms[i], x: 1, y: 1 }; }
    const q = assessTraceQuality({ landmarks: lms, width: 1000, height: 800, residual: GOOD_RESIDUAL });
    expect(q.edgeCount).toBe(6);
    expect(q.level).toBe("low");
    expect(q.reasons.join(" ")).toMatch(/image border/);
  });

  it("treats a missing confidence signal as untrustworthy", () => {
    const q = assessTraceQuality({
      landmarks: [{ x: 500, y: 400 }, { x: 600, y: 500 }],
      width: 1000, height: 800,
    });
    expect(q.level).toBe("low");
    expect(q.reasons.join(" ")).toMatch(/no per-landmark confidence/);
  });

  it("rates a middling trace as medium, explaining it as a note", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.48),
      width: 1000, height: 800,
      residual: GOOD_RESIDUAL,
    });
    expect(q.level).toBe("medium");
    expect(q.notes.length).toBeGreaterThan(0);
    expect(q.reasons).toEqual([]);
  });

  // ─── Regression: ordinary films were being flagged ─────────────────────────
  // The reported failure was a clean, correct trace of normal-but-varied anatomy
  // rated "Low-confidence trace" because a single soft landmark and a
  // synthetic-calibrated shape threshold tripped. These pin the fixed behaviour.

  it("does not downgrade the verdict for a single soft landmark", () => {
    const lms = goodLandmarks(29, 0.6);
    lms[0] = { ...lms[0], confidence: 0.05 };
    const q = assessTraceQuality({ landmarks: lms, width: 1000, height: 800, residual: GOOD_RESIDUAL });
    expect(q.lowCount).toBe(1);
    expect(q.level).toBe("high");
    expect(q.reasons).toEqual([]);
    expect(q.notes.join(" ")).toMatch(/1 of 29 landmarks have a weak heatmap response/);
  });

  it("does not flag a realistic trace whose shape is only mildly atypical", () => {
    // residualRatio 0.15 is well within the valid population (p50 0.045,
    // p95 0.51) and must not read as a failure.
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6),
      width: 1000, height: 800,
      residual: { residual: 45, residualRatio: 0.15, mahalanobis: 2.0 },
    });
    expect(q.level).toBe("high");
    expect(q.reasons).toEqual([]);
  });

  it("reports a mildly atypical shape as a note, not a low verdict", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6),
      width: 1000, height: 800,
      residual: { residual: 160, residualRatio: 0.55, mahalanobis: 7.0 },
    });
    expect(q.level).toBe("medium");
    expect(q.reasons).toEqual([]);
    expect(q.notes.join(" ")).toMatch(/slightly atypical/);
  });

  it("does not gate on Mahalanobis (it overlaps the mirrored value)", () => {
    // On valid, Mahalanobis spans 1.5–8.6 and the mirrored value is ≈7.8, so it
    // cannot separate good from failed and must not affect the verdict.
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6),
      width: 1000, height: 800,
      residual: { residual: 20, residualRatio: 0.03, mahalanobis: 9.5 },
    });
    expect(q.level).toBe("high");
    expect(q.reasons).toEqual([]);
    expect(q.mahalanobis).toBe(9.5);
  });

  it("skips the shape checks when no residual is supplied", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.62),
      width: 1000, height: 800,
      residual: null,
    });
    expect(q.level).toBe("high");
    expect(q.residualRatio).toBeNull();
  });

  it("honours threshold overrides", () => {
    const lms = goodLandmarks(29, 0.6);
    const strict = assessTraceQuality({
      landmarks: lms, width: 1000, height: 800, residual: GOOD_RESIDUAL,
      thresholds: { minMeanConfidence: 0.9 },
    });
    expect(strict.level).toBe("low");
  });

  it("ignores non-finite landmark coordinates in the edge check", () => {
    const lms = goodLandmarks(29, 0.62);
    lms[0] = { x: NaN, y: NaN, confidence: 0.62 };
    const q = assessTraceQuality({ landmarks: lms, width: 1000, height: 800, residual: GOOD_RESIDUAL });
    expect(q.edgeCount).toBe(0);
    expect(q.level).toBe("high");
  });

  it("returns a usable object for an empty landmark set", () => {
    const q = assessTraceQuality({ landmarks: [], width: 1000, height: 800 });
    expect(q.level).toBe("low");
    expect(q.count).toBe(0);
  });
});

describe("qualityRankScore", () => {
  it("prefers a confident, plausible candidate over an implausible one", () => {
    const good = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6), width: 1000, height: 800, residual: GOOD_RESIDUAL,
    });
    const bad = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6), width: 1000, height: 800,
      residual: { residual: 400, residualRatio: 0.4, mahalanobis: 20 },
    });
    expect(qualityRankScore(good)).toBeGreaterThan(qualityRankScore(bad));
  });

  it("penalises border-heavy candidates", () => {
    const lms = goodLandmarks(29, 0.6);
    const clean = assessTraceQuality({ landmarks: goodLandmarks(29, 0.6), width: 1000, height: 800, residual: GOOD_RESIDUAL });
    for (let i = 0; i < 10; i++) lms[i] = { ...lms[i], x: 1 };
    const edgey = assessTraceQuality({ landmarks: lms, width: 1000, height: 800, residual: GOOD_RESIDUAL });
    expect(qualityRankScore(clean)).toBeGreaterThan(qualityRankScore(edgey));
  });

  it("returns -Infinity for a missing quality object", () => {
    expect(qualityRankScore(null)).toBe(-Infinity);
  });
});

describe("describeQuality", () => {
  it("summarises confidence, shape fit and border count", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.6), width: 1000, height: 800, residual: GOOD_RESIDUAL,
    });
    const s = describeQuality(q);
    expect(s).toMatch(/confidence 60%/);
    expect(s).toMatch(/shape fit 2\.0%/);
  });

  it("returns an empty string without a quality object", () => {
    expect(describeQuality(null)).toBe("");
  });
});

describe("DEFAULT_QUALITY_THRESHOLDS", () => {
  it("keeps the cut points ordered (medium must sit inside low)", () => {
    const t = DEFAULT_QUALITY_THRESHOLDS;
    expect(t.lowLandmarkConfidence).toBeLessThan(t.mediumMeanConfidence);
    expect(t.minMeanConfidence).toBeLessThan(t.mediumMeanConfidence);
    expect(t.residualRatioMedium).toBeLessThan(t.residualRatioHigh);
    expect(t.mediumEdgeFraction).toBeLessThan(t.maxEdgeFraction);
    expect(t.mediumLowFraction).toBeLessThan(t.maxLowFraction);
    expect(t.maxLowFraction).toBeLessThan(1);
    // Mahalanobis is intentionally not a verdict input (see landmarkQuality.js).
    expect(t.mahalanobisHigh).toBeUndefined();
  });

  it("sits the residual cut points above every valid image and below a mirrored one", () => {
    // Calibrated on the CEPHA29 valid split (150 images): residualRatio max
    // 0.587; a mirrored/garbage shape scores ≈1.03. The "high" cut must clear the
    // former and stay under the latter.
    const t = DEFAULT_QUALITY_THRESHOLDS;
    expect(t.residualRatioHigh).toBeGreaterThan(0.587);
    expect(t.residualRatioHigh).toBeLessThan(1.03);
    expect(t.residualRatioMedium).toBeLessThanOrEqual(t.residualRatioHigh);
  });
});