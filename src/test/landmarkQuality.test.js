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
      residual: { residual: 400, residualRatio: 0.4, mahalanobis: 20 },
    });
    expect(q.level).toBe("low");
    expect(q.reasons.join(" ")).toMatch(/anatomically atypical/);
    expect(q.reasons.join(" ")).toMatch(/shape outlier/);
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

  it("rates a middling trace as medium rather than low", () => {
    const q = assessTraceQuality({
      landmarks: goodLandmarks(29, 0.38),
      width: 1000, height: 800,
      residual: GOOD_RESIDUAL,
    });
    expect(q.level).toBe("medium");
    expect(q.reasons.length).toBeGreaterThan(0);
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
    expect(t.mahalanobisMedium).toBeLessThan(t.mahalanobisHigh);
    expect(t.mediumEdgeFraction).toBeLessThan(t.maxEdgeFraction);
    expect(t.maxLowFraction).toBeLessThan(1);
  });
});