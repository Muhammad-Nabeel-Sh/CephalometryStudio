import { describe, it, expect } from "vitest";
import {
  uid,
  clamp,
  dist,
  angle3pt,
  angle4pt,
  perpDist,
  polyArea,
  polyLen,
  vpts,
  computeMeasurements,
  snapPoint,
  snapPointResult,
  perpPoint,
  projectedDistance,
  calculateICC,
  calculateICC_CI,
  dahlbergError,
  blandAltman,
  mean,
  stdev,
  variance,
  median,
  iqr,
  skewness,
  kurtosis,
  coefficientOfVariation,
  shapiroWilk,
  oneWayAnova,
  pearsonCorrelation,
  spearmanCorrelation,
  tTestPaired,
  linearRegression,
  confidenceInterval,
  normDeviation,
  detectOutliers,
  buildScope,
  evalFormula,
  getMissingVars,
  ellipseFromAxes,
  mirrorPoint,
  sampleCurvePoints,
} from "../lib/utils.js";

// ═════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════

describe("uid", () => {
  it("generates an 8-character string", () => {
    expect(uid()).toHaveLength(8);
  });

  it("generates unique values", () => {
    const a = uid(), b = uid();
    expect(a).not.toBe(b);
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("passes through mid value", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════
// Geometry
// ═════════════════════════════════════════════════════════════════

describe("dist", () => {
  it("returns 0 for same point", () => {
    expect(dist({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
  });

  it("computes Euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("angle3pt", () => {
  it("returns 90° for right angle", () => {
    const a = angle3pt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(a).toBeCloseTo(90, 8);
  });

  it("returns 45°", () => {
    const a = angle3pt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(a).toBeCloseTo(45, 8);
  });

  it("returns 0° when two points coincide", () => {
    const a = angle3pt({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 });
    expect(a).toBeCloseTo(0, 8);
  });
});

describe("angle4pt", () => {
  it("returns 0° for parallel lines", () => {
    const a = angle4pt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
    expect(a).toBeCloseTo(0, 8);
  });

  it("returns 90° for perpendicular lines", () => {
    const a = angle4pt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(a).toBeCloseTo(90, 8);
  });
});

describe("perpDist", () => {
  it("returns 0 for point on line", () => {
    expect(perpDist({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeCloseTo(0, 10);
  });

  it("computes perpendicular distance", () => {
    const d = perpDist({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(1, 10);
  });
});

describe("polyArea", () => {
  it("computes area of a triangle", () => {
    const area = polyArea([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]);
    expect(area).toBeCloseTo(6, 10);
  });

  it("computes area of a square", () => {
    const area = polyArea([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]);
    expect(area).toBeCloseTo(4, 10);
  });
});

describe("polyLen", () => {
  it("computes perimeter of a triangle", () => {
    const p = polyLen([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]);
    expect(p).toBeCloseTo(12, 10);
  });

  it("computes open polyline length", () => {
    const p = polyLen([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }], false);
    expect(p).toBeCloseTo(7, 10);
  });
});

describe("vpts", () => {
  it("filters out unplaced points", () => {
    const m = { points: [{ x: 10, y: 20 }, { x: -99999, y: -99999 }] };
    expect(vpts(m)).toHaveLength(1);
    expect(vpts(m)[0]).toEqual({ x: 10, y: 20 });
  });

  it("returns empty array for missing points", () => {
    expect(vpts({})).toEqual([]);
  });
});

describe("perpPoint", () => {
  it("projects point onto line", () => {
    const pp = perpPoint({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(pp.x).toBeCloseTo(1, 10);
    expect(pp.y).toBeCloseTo(0, 10);
  });
});

describe("projectedDistance", () => {
  it("computes projected distance along line (abs value)", () => {
    const d = projectedDistance({ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(Math.abs(d)).toBeCloseTo(2, 10);
  });
});

// ═════════════════════════════════════════════════════════════════
// Compute Measurements
// ═════════════════════════════════════════════════════════════════

describe("computeMeasurements", () => {
  const cal = { done: true, pxPerMm: 2 };

  it("returns x,y for a point in the calibrated unit", () => {
    const m = { type: "point", points: [{ x: 10, y: 20 }] };
    expect(computeMeasurements(m, cal)).toEqual({ x: 5, y: 10, _unit: "mm" });
  });

  it("returns length for a line", () => {
    const m = { type: "line", points: [{ x: 0, y: 0 }, { x: 6, y: 0 }] };
    expect(computeMeasurements(m, cal).length).toBeCloseTo(3, 10);
  });

  it("returns angle for angle3", () => {
    const m = { type: "angle3", label: "test", points: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }] };
    expect(computeMeasurements(m, cal).angle).toBeCloseTo(90, 8);
  });

  it("returns signed ANB angle", () => {
    const m = { type: "angle3", label: "ANB", points: [{ x: 10, y: 5 }, { x: 0, y: 0 }, { x: 5, y: 10 }] };
    const meas = computeMeasurements(m, cal);
    expect(meas.angle).toBeDefined();
    expect(typeof meas.angle).toBe("number");
  });
});

// ═════════════════════════════════════════════════════════════════
// Snap
// ═════════════════════════════════════════════════════════════════

describe("snapPoint", () => {
  const markups = [
    { type: "point", label: "N", points: [{ x: 100, y: 200 }], visible: true },
    { type: "point", label: "S", points: [{ x: 300, y: 400 }], visible: true },
  ];
  const snap = { points: true, lines: true };
  const snapPts = { points: true, lines: false };
  const snapLn = { points: false, lines: true };

  it("snaps to nearest point within radius", () => {
    const result = snapPoint({ x: 101, y: 201 }, markups, 5, snap);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it("returns input if no point is close", () => {
    const result = snapPoint({ x: 0, y: 0 }, markups, 5, snap);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("returns input if snap is disabled", () => {
    const result = snapPoint({ x: 101, y: 201 }, markups, 5, { points: false, lines: false });
    expect(result).toEqual({ x: 101, y: 201 });
  });

  it("ignores points when only line snap is enabled", () => {
    const result = snapPoint({ x: 101, y: 201 }, markups, 5, snapLn);
    expect(result).toEqual({ x: 101, y: 201 });
  });

  it("ignores lines when only point snap is enabled", () => {
    const lineMarkups = [{ type: "line", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], visible: true }];
    const result = snapPoint({ x: 5, y: 3 }, lineMarkups, 2, snapPts);
    expect(result).toEqual({ x: 5, y: 3 });
  });

  it("does not snap past a segment endpoint (segment mode)", () => {
    const markups = [{ type: "line", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], visible: true }];
    const result = snapPoint({ x: 20, y: 8 }, markups, 10, snap);
    expect(result).toEqual({ x: 20, y: 8 });
  });

  it("snaps to the infinite extension of an infinite line", () => {
    const markups = [{ type: "line", mode: "infinite", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], visible: true }];
    const result = snapPoint({ x: 20, y: 8 }, markups, 10, snap);
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it("reports the snap kind (point vs line)", () => {
    const markups = [
      { type: "point", label: "N", points: [{ x: 100, y: 200 }], visible: true },
      { type: "line", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], visible: true },
    ];
    expect(snapPointResult({ x: 101, y: 201 }, markups, 10, snap).kind).toBe("point");
    expect(snapPointResult({ x: 5, y: 3 }, markups, 10, snap).kind).toBe("line");
    expect(snapPointResult({ x: 101, y: 201 }, markups, 10, snapPts).kind).toBe("point");
    expect(snapPointResult({ x: 5, y: 3 }, markups, 10, snapLn).kind).toBe("line");
  });
});

describe("snapToLine", () => {
  const snap = { points: true, lines: true };

  it("snaps to nearest point on a line via snapPoint", () => {
    const markups = [
      { type: "line", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], visible: true },
    ];
    const result = snapPoint({ x: 5, y: 3 }, markups, 10, snap);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it("snaps perpendicular to a parallel markup", () => {
    const markups = [
      { type: "parallel", points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], visible: true },
    ];
    const result = snapPoint({ x: 5, y: 8 }, markups, 10, snap);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(5, 5);
  });

  it("prefers point snap over line snap when closer to point", () => {
    const markups = [
      { type: "line", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], visible: true },
      { type: "point", points: [{ x: 50, y: 1.5 }], visible: true },
    ];
    const result = snapPoint({ x: 50, y: 1 }, markups, 10, snap);
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(1.5, 5);
  });

  it("snaps to line when closer than any point", () => {
    const markups = [
      { type: "line", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], visible: true },
      { type: "point", points: [{ x: 50, y: 8 }], visible: true },
    ];
    const result = snapPoint({ x: 50, y: 1 }, markups, 10, snap);
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });
});

// ═════════════════════════════════════════════════════════════════
// ICC (Intraclass Correlation Coefficient)
// ═════════════════════════════════════════════════════════════════

describe("calculateICC", () => {
  it("returns null for <2 raters", () => {
    expect(calculateICC([[1, 2]])).toBeNull();
  });

  it("returns null for <2 subjects", () => {
    expect(calculateICC([[1], [2]])).toBeNull();
  });

  it("returns high ICC for near-perfect agreement", () => {
    const result = calculateICC([
      [10, 20, 30, 40, 50],
      [10.001, 20.001, 30.001, 40.001, 50.001],
    ]);
    expect(result).not.toBeNull();
    expect(result.ICC_Absolute).toBeGreaterThan(0.99);
    expect(result.interpretation).toBe("Excellent");
  });

  it("returns interpretation strings correctly", () => {
    const r = calculateICC([
      [1, 3, 5],
      [2, 3, 6],
    ]);
    expect(r).not.toBeNull();
    expect(["Poor", "Moderate", "Good", "Excellent"]).toContain(r.interpretation);
  });
});

describe("calculateICC_CI", () => {
  it("returns null for invalid inputs", () => {
    expect(calculateICC_CI(null, 2, 2)).toBeNull();
  });

  it("computes confidence interval", () => {
    const ci = calculateICC_CI(0.8, 10, 3, 0.95);
    expect(ci.lower).toBeLessThan(ci.upper);
    expect(ci.confidence).toBe(0.95);
  });

  it("handles 0.99 confidence", () => {
    const ci = calculateICC_CI(0.8, 10, 3, 0.99);
    expect(ci.lower).toBeLessThan(ci.upper);
    expect(ci.confidence).toBe(0.99);
  });
});

// ═════════════════════════════════════════════════════════════════
// Dahlberg Error & Bland-Altman
// ═════════════════════════════════════════════════════════════════

describe("dahlbergError", () => {
  it("returns null for mismatched lengths", () => {
    expect(dahlbergError([1, 2], [1])).toBeNull();
  });

  it("returns 0 for identical measurements", () => {
    const d = dahlbergError([10, 20, 30], [10, 20, 30]);
    expect(d.error).toBeCloseTo(0, 10);
    expect(d.n).toBe(3);
  });

  it("computes correctly for known values", () => {
    const d = dahlbergError([10, 20], [12, 18]);
    const expected = Math.sqrt(((10 - 12) ** 2 + (20 - 18) ** 2) / (2 * 2));
    expect(d.error).toBeCloseTo(expected, 10);
  });
});

describe("blandAltman", () => {
  it("returns null for <2 pairs", () => {
    expect(blandAltman([1], [2])).toBeNull();
  });

  it("computes bias and limits of agreement", () => {
    const ba = blandAltman([10, 20, 30], [12, 18, 32]);
    expect(ba.meanDiff).toBeCloseTo(-0.6667, 3);
    expect(ba.stdDiff).toBeGreaterThan(0);
    expect(ba.lowerLOA).toBeLessThan(ba.upperLOA);
  });
});

// ═════════════════════════════════════════════════════════════════
// Descriptive Statistics
// ═════════════════════════════════════════════════════════════════

describe("mean", () => {
  it("computes arithmetic mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it("handles single value", () => {
    expect(mean([42])).toBe(42);
  });
});

describe("variance", () => {
  it("computes sample variance", () => {
    const v = variance([1, 2, 3, 4, 5], 3);
    expect(v).toBeCloseTo(2.5, 10);
  });
});

describe("stdev", () => {
  it("computes sample standard deviation", () => {
    const s = stdev([1, 2, 3, 4, 5], 3);
    expect(s).toBeCloseTo(Math.sqrt(2.5), 10);
  });
});

describe("median", () => {
  it("returns middle for odd count", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("averages middle two for even count", () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });
});

describe("iqr", () => {
  it("computes interquartile range", () => {
    const result = iqr([1, 2, 3, 4, 5, 6, 7]);
    expect(result.iqr).toBeGreaterThan(0);
    expect(result.q1).toBeLessThan(result.q3);
  });
});

describe("skewness", () => {
  it("returns 0 for symmetric data", () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 8);
  });

  it("is positive for right-skewed data", () => {
    expect(skewness([1, 1, 1, 2, 10])).toBeGreaterThan(0);
  });
});

describe("kurtosis", () => {
  it("returns expected excess kurtosis for uniform-like data", () => {
    expect(kurtosis([1, 2, 3, 4, 5])).toBeCloseTo(-1.912, 2);
  });
});

describe("coefficientOfVariation", () => {
  it("returns percentage CV", () => {
    const cv = coefficientOfVariation([10, 12, 11]);
    expect(cv).toBeGreaterThan(0);
  });

  it("returns null for zero mean", () => {
    expect(coefficientOfVariation([0, 0, 0])).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// Shapiro-Wilk Normality Test
// ═════════════════════════════════════════════════════════════════

describe("shapiroWilk", () => {
  it("returns null for n < 3", () => {
    expect(shapiroWilk([1, 2])).toBeNull();
  });

  it("classifies normal data correctly", () => {
    const result = shapiroWilk([1.2, 0.8, 1.5, 2.0, -0.5, 1.1, -0.2, 1.8, 0.5, 0.9]);
    expect(result).not.toBeNull();
    expect(result.W).toBeGreaterThan(0);
    expect(result.normal).toBe(true);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it("returns W=1 for constant data", () => {
    const result = shapiroWilk([5, 5, 5, 5, 5]);
    expect(result.W).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════
// One-Way ANOVA
// ═════════════════════════════════════════════════════════════════

describe("oneWayAnova", () => {
  it("returns null for <2 groups", () => {
    expect(oneWayAnova([1, 2, 3])).toBeNull();
  });

  it("detects significant difference between groups", () => {
    const result = oneWayAnova([10, 11, 10, 9], [20, 21, 20, 19]);
    expect(result).not.toBeNull();
    expect(result.F).toBeGreaterThan(0);
    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("detects no difference between identical groups", () => {
    const result = oneWayAnova([10, 10, 10], [10, 10, 10]);
    expect(result).toBeNull(); // ssWithin = 0
  });
});

// ═════════════════════════════════════════════════════════════════
// t-Tests
// ═════════════════════════════════════════════════════════════════

describe("tTestPaired", () => {
  it("returns null for mismatched lengths", () => {
    expect(tTestPaired([1, 2], [1])).toBeNull();
  });

  it("returns null for n < 2", () => {
    expect(tTestPaired([1], [2])).toBeNull();
  });

  it("detects significant difference", () => {
    const result = tTestPaired([10, 11, 12, 13], [8, 9, 8, 10]);
    expect(result).not.toBeNull();
    expect(result.t).toBeGreaterThan(0);
    expect(result.significant).toBe(true);
  });

  it("returns null for identical pairs (zero variance)", () => {
    expect(tTestPaired([10, 20, 30], [10, 20, 30])).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// Correlation
// ═════════════════════════════════════════════════════════════════

describe("pearsonCorrelation", () => {
  it("returns null for <2 pairs", () => {
    expect(pearsonCorrelation([1], [2])).toBeNull();
  });

  it("returns 1 for perfect positive correlation", () => {
    expect(pearsonCorrelation([1, 2, 3], [4, 6, 8])).toBeCloseTo(1, 10);
  });

  it("returns -1 for perfect negative correlation", () => {
    expect(pearsonCorrelation([1, 2, 3], [9, 6, 3])).toBeCloseTo(-1, 10);
  });

  it("returns 0 for no correlation", () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBeNull(); // denominator 0
  });
});

describe("spearmanCorrelation", () => {
  it("returns 1 for monotonic increasing data", () => {
    const r = spearmanCorrelation([1, 2, 3, 4], [100, 200, 300, 400]);
    expect(r).toBeCloseTo(1, 5);
  });

  it("returns null for mismatched lengths", () => {
    expect(spearmanCorrelation([1], [1, 2])).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// Linear Regression
// ═════════════════════════════════════════════════════════════════

describe("linearRegression", () => {
  it("returns null for <3 points", () => {
    expect(linearRegression([1, 2], [3, 4])).toBeNull();
  });

  it("fits y = 2x + 1", () => {
    const r = linearRegression([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(r.slope).toBeCloseTo(2, 8);
    expect(r.intercept).toBeCloseTo(1, 8);
    expect(r.r2).toBeCloseTo(1, 8);
    expect(r.significant).toBe(true);
  });

  it("fits nearly horizontal line", () => {
    const r = linearRegression([1, 2, 3], [5, 5.1, 4.9]);
    expect(r).not.toBeNull();
    expect(r.slope).toBeCloseTo(0, 1);
  });
});

// ═════════════════════════════════════════════════════════════════
// Confidence Interval & Norm Deviation
// ═════════════════════════════════════════════════════════════════

describe("confidenceInterval", () => {
  it("returns null for n < 2", () => {
    expect(confidenceInterval([5])).toBeNull();
  });

  it("computes CI containing the mean", () => {
    const ci = confidenceInterval([10, 12, 11, 13, 10, 12]);
    expect(ci.mean).toBeCloseTo(11.333, 2);
    expect(ci.lower).toBeLessThan(ci.mean);
    expect(ci.upper).toBeGreaterThan(ci.mean);
  });

  it("handles zero variance", () => {
    const ci = confidenceInterval([5, 5, 5]);
    expect(ci.lower).toBe(5);
    expect(ci.upper).toBe(5);
  });
});

describe("normDeviation", () => {
  it("computes deviation from norm", () => {
    const result = normDeviation(85, { mean: 82, sd: 2 });
    expect(result.delta).toBe(3);
    expect(result.sdUnits).toBe(1.5);
    expect(result.within1SD).toBe(false);
    expect(result.within2SD).toBe(true);
  });

  it("reports exactly at mean", () => {
    const result = normDeviation(82, { mean: 82, sd: 2 });
    expect(result.delta).toBe(0);
    expect(result.sdUnits).toBe(0);
    expect(result.within1SD).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// Outlier Detection
// ═════════════════════════════════════════════════════════════════

describe("detectOutliers", () => {
  it("returns empty for n < 4", () => {
    expect(detectOutliers([1, 2, 3]).outliers).toHaveLength(0);
  });

  it("detects IQR outliers", () => {
    const result = detectOutliers([1, 2, 3, 4, 5, 100]);
    expect(result.outliers.length).toBeGreaterThan(0);
    expect(result.outliers[0].v).toBe(100);
  });
});

// ═════════════════════════════════════════════════════════════════
// Formula System
// ═════════════════════════════════════════════════════════════════

describe("buildScope", () => {
  it("builds scope from markups", () => {
    const markups = [
      { type: "line", label: "SN", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    ];
    const cal = { done: true, pxPerMm: 1 };
    const scope = buildScope(markups, cal);
    expect(scope.SN_length).toBeCloseTo(10, 5);
  });
});

describe("evalFormula", () => {
  it("evaluates simple arithmetic", () => {
    expect(evalFormula("2 + 3", {})).toBe(5);
  });

  it("uses scope variables", () => {
    expect(evalFormula("SNA_angle - SNB_angle", { SNA_angle: 82, SNB_angle: 80 })).toBe(2);
  });

  it("returns null for missing vars", () => {
    expect(evalFormula("unknown", {})).toBeNull();
  });

  it("handles mathjs functions", () => {
    expect(evalFormula("sin(pi/2)", {})).toBeCloseTo(1, 10);
  });
});

describe("getMissingVars", () => {
  it("reports missing variables", () => {
    const missing = getMissingVars("A + B", { A: 5 });
    expect(missing).toContain("B");
  });

  it("returns empty when all vars present", () => {
    expect(getMissingVars("A + B", { A: 1, B: 2 })).toEqual([]);
  });

  it("handles empty expression", () => {
    expect(getMissingVars("", {})).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════
// Formula sandbox hardening (P7). User-authored expressions must NOT be able
// to reach mathjs surfaces that touch non-math globals (import, evaluate,
// property access, assignment, function definition, blocks).
// ═════════════════════════════════════════════════════════════════
describe("evalFormula — sandbox hardening", () => {
  it("evaluates legitimate arithmetic and allowed functions", () => {
    expect(evalFormula("SNA + 2", { SNA: 82 })).toBe(84);
    expect(evalFormula("sqrt(ANB^2 + 1)", { ANB: 3 })).toBeCloseTo(Math.sqrt(10), 6);
    expect(evalFormula("sin(pi/2)", {})).toBeCloseTo(1, 6);
    expect(evalFormula("max(SNA, SNB)", { SNA: 82, SNB: 80 })).toBe(82);
  });

  it("supports conditional expressions", () => {
    expect(evalFormula("ANB > 2 ? 1 : 0", { ANB: 3 })).toBe(1);
    expect(evalFormula("ANB > 2 ? 1 : 0", { ANB: 1 })).toBe(0);
  });

  it("returns null for missing variables", () => {
    expect(evalFormula("SNA + SNB", { SNA: 82 })).toBeNull();
  });

  it("rejects mathjs import() (code import surface)", () => {
    expect(evalFormula('import({"x":1})', {})).toBeNull();
  });

  it("rejects mathjs evaluate() (nested eval surface)", () => {
    expect(evalFormula('evaluate("1+1")', {})).toBeNull();
  });

  it("rejects property access (prototype pollution surface)", () => {
    expect(evalFormula("(1).constructor", {})).toBeNull();
    expect(evalFormula("sin.constructor", {})).toBeNull();
  });

  it("rejects assignment / function definition / blocks", () => {
    expect(evalFormula("a=1", { a: 5 })).toBeNull();
    expect(evalFormula("f(x)=x+1", {})).toBeNull();
    expect(evalFormula("1;2", {})).toBeNull();
  });

  it("rejects disallowed functions (e.g. map, forEach, typed)", () => {
    expect(evalFormula("map([1,2], x)")).toBeNull();
  });

  it("does not leak scope symbols to mathjs globals", () => {
    // A scope var named like a mathjs global must resolve to the scope value,
    // not the mathjs function.
    expect(evalFormula("e + 1", { e: 5 })).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════
// ellipseFromAxes
// ═════════════════════════════════════════════════════════════════

describe("ellipseFromAxes", () => {
  it("returns null for fewer than 3 points", () => {
    expect(ellipseFromAxes(null)).toBeNull();
    expect(ellipseFromAxes([])).toBeNull();
    expect(ellipseFromAxes([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBeNull();
  });

  it("computes center, rx, ry, and rotation from axis endpoints", () => {
    const pts = [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 100, y: 70 },
    ];
    const ell = ellipseFromAxes(pts);
    expect(ell).not.toBeNull();
    expect(ell.cx).toBe(100);
    expect(ell.cy).toBe(100);
    expect(ell.rx).toBeCloseTo(50, 0);
    expect(ell.ry).toBeCloseTo(30, 0);
    expect(ell.rotation).toBeCloseTo(0, 5);
  });

  it("handles rotated axes", () => {
    const cx = 0, cy = 0, rx = 40, ry = 20;
    const angle = Math.PI / 4;
    const majorEnd = { x: cx + rx * Math.cos(angle), y: cy + rx * Math.sin(angle) };
    const minorEnd = { x: cx + ry * Math.cos(angle + Math.PI / 2), y: cy + ry * Math.sin(angle + Math.PI / 2) };
    const ell = ellipseFromAxes([{ x: cx, y: cy }, majorEnd, minorEnd]);
    expect(ell).not.toBeNull();
    expect(ell.cx).toBeCloseTo(cx, 5);
    expect(ell.cy).toBeCloseTo(cy, 5);
    expect(ell.rx).toBeCloseTo(rx, 0);
    expect(ell.ry).toBeCloseTo(ry, 0);
    expect(ell.rotation).toBeCloseTo(angle, 4);
  });

  it("returns null when an axis is too short", () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 30 }];
    expect(ellipseFromAxes(pts)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// mirrorPoint
// ═════════════════════════════════════════════════════════════════

describe("mirrorPoint", () => {
  it("reflects across a horizontal axis", () => {
    const result = mirrorPoint({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(-3, 5);
  });

  it("reflects across a vertical axis", () => {
    const result = mirrorPoint({ x: 3, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 });
    expect(result.x).toBeCloseTo(-3, 5);
    expect(result.y).toBeCloseTo(5, 5);
  });

  it("reflects across a 45-degree axis", () => {
    const result = mirrorPoint({ x: 4, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(4, 5);
  });

  it("reflects across a non-origin axis", () => {
    const result = mirrorPoint({ x: 6, y: 4 }, { x: 0, y: 5 }, { x: 10, y: 5 });
    expect(result.x).toBeCloseTo(6, 5);
    expect(result.y).toBeCloseTo(6, 5);
  });

  it("returns the point itself when axis has zero length", () => {
    const result = mirrorPoint({ x: 3, y: 4 }, { x: 1, y: 1 }, { x: 1, y: 1 });
    expect(result.x).toBeCloseTo(3, 5);
    expect(result.y).toBeCloseTo(4, 5);
  });

  it("point on the axis stays in place", () => {
    const result = mirrorPoint({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });
});

// ═════════════════════════════════════════════════════════════════
// sampleCurvePoints
// ═════════════════════════════════════════════════════════════════

describe("sampleCurvePoints", () => {
  it("returns empty for null/empty input", () => {
    expect(sampleCurvePoints(null, 5)).toEqual([]);
    expect(sampleCurvePoints([], 5)).toEqual([]);
  });

  it("returns single point for single-point input", () => {
    expect(sampleCurvePoints([{ x: 1, y: 1 }], 5)).toEqual([{ x: 1, y: 1 }]);
  });

  it("samples evenly along a straight line", () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const samples = sampleCurvePoints(pts, 4);
    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[2].x).toBeCloseTo(5, 5);
    expect(samples[4]).toEqual({ x: 10, y: 0 });
  });

  it("samples along an L-shaped path", () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const samples = sampleCurvePoints(pts, 4);
    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[4]).toEqual({ x: 10, y: 10 });
  });

  it("handles coincident points without crashing", () => {
    const pts = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    const samples = sampleCurvePoints(pts, 3);
    expect(samples).toHaveLength(1);
    expect(samples[0].x).toBeCloseTo(5, 5);
  });
});
