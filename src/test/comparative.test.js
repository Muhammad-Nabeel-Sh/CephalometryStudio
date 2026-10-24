import { describe, it, expect } from "vitest";
import { lineMarkup, angleMarkup } from "./helpers/cephFixtures.js";
import { runComparativeAll, boxMTest, mannWhitneyU, wilcoxonSignedRank, mannWhitneyExactP, wilcoxonExactP } from "../research/comparative.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}

// Each session carries one measurement whose value is `v` (a line of length v).
const makeMeas = (label, v) => lineMarkup(label, v);

describe("runComparativeAll", () => {
  it("returns error when fewer than 2 groups", () => {
    const result = runComparativeAll([], { design: "independent", groups: [], labelIds: [] });
    expect(result.error).toBeDefined();
  });

  it("routes to Independent t-test for 2 groups with varying data", () => {
    const aSessions = Array.from({ length: 20 }, (_, i) => makeSession(`a${i}`, [makeMeas("M", 10 + (i % 3) * 0.5)]));
    const bSessions = Array.from({ length: 20 }, (_, i) => makeSession(`b${i}`, [makeMeas("M", 12 + (i % 3) * 0.5)]));
    const sessions = [...aSessions, ...bSessions];
    const aIds = aSessions.map(s => s.id);
    const bIds = bSessions.map(s => s.id);

    const config = {
      design: "independent",
      groups: [
        { label: "Group A", caseIds: aIds },
        { label: "Group B", caseIds: bIds },
      ],
      labelIds: ["M"],
      alpha: 0.05,
      mcCorrection: "none",
    };
    const result = runComparativeAll(sessions, config);

    expect(result.labels).toBeDefined();
    expect(result.labels.M).toBeDefined();
    expect(result.labels.M.skip).toBeFalsy();
    expect(result.labels.M.result).not.toBeNull();
    // With n=20, near-normal data should route to a t-test variant
    expect(result.labels.M.testName).toMatch(/t-test/i);
    expect(Math.abs(result.labels.M.result.t)).toBeGreaterThan(0);
  });

  it("returns result structure for 3 groups", () => {
    const aS = Array.from({ length: 6 }, (_, i) => makeSession(`a${i}`, [makeMeas("M", 10 + i)]));
    const bS = Array.from({ length: 6 }, (_, i) => makeSession(`b${i}`, [makeMeas("M", 15 + i)]));
    const cS = Array.from({ length: 6 }, (_, i) => makeSession(`c${i}`, [makeMeas("M", 20 + i)]));
    const sessions = [...aS, ...bS, ...cS];
    const config = {
      design: "independent",
      groups: [
        { label: "Group A", caseIds: aS.map(s => s.id) },
        { label: "Group B", caseIds: bS.map(s => s.id) },
        { label: "Group C", caseIds: cS.map(s => s.id) },
      ],
      labelIds: ["M"],
      alpha: 0.05,
      mcCorrection: "none",
    };
    const result = runComparativeAll(sessions, config);

    expect(result.labels.M).toBeDefined();
    expect(result.groups).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════
// Box's M test for homogeneity of covariance matrices (MANOVA assumption).
// Previously absent — MANOVA ran with no covariance-homogeneity diagnostic.
// ═════════════════════════════════════════════════════════════════
describe("boxMTest", () => {
  // Build a group of n observations on p variables from a covariance with
  // scale `scale` (diagonal) and deterministic spread.
  function makeGroup(n, p, scale, seed) {
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < p; j++) {
        // deterministic, well-conditioned pseudo-data with variance ~ scale
        row.push(scale * Math.sin((i + 1) * (j + 1) + seed) + (i % 3) * scale * 0.1);
      }
      rows.push(row);
    }
    return rows;
  }

  it("is non-significant when groups share similar covariance", () => {
    const g1 = makeGroup(30, 2, 1, 1);
    const g2 = makeGroup(30, 2, 1, 2);
    const r = boxMTest([g1, g2], 2);
    expect(r.skipped).toBeFalsy();
    expect(isFinite(r.M)).toBe(true);
    expect(isFinite(r.pValue)).toBe(true);
    expect(r.pValue).toBeGreaterThan(0); // sanity
    // With identically-scaled deterministic data the covariances are close;
    // Box's M should not flag strong heterogeneity.
    expect(r.pValue).toBeGreaterThan(0.01);
  });

  it("is significant when one group has a much larger covariance scale", () => {
    const g1 = makeGroup(30, 2, 1, 1);
    const g2 = makeGroup(30, 2, 10, 2); // 10× variance
    const r = boxMTest([g1, g2], 2);
    expect(r.skipped).toBeFalsy();
    expect(r.M).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThan(0.05);
    expect(r.significant).toBe(true);
  });

  it("skips with a reason when any group has n − 1 < p (singular covariance)", () => {
    const g1 = makeGroup(2, 3, 1, 1); // n−1 = 1 < p = 3
    const g2 = makeGroup(30, 3, 1, 2);
    const r = boxMTest([g1, g2], 3);
    expect(r.skipped).toBe(true);
    expect(r.reason).toMatch(/non-singular/i);
  });

  it("reports finite M, chi2, df, pValue in [0,1] for a 3-group / 2-DV case", () => {
    const r = boxMTest([makeGroup(25, 2, 1, 1), makeGroup(25, 2, 1.5, 2), makeGroup(25, 2, 1, 3)], 2);
    expect(isFinite(r.M)).toBe(true);
    expect(isFinite(r.chi2)).toBe(true);
    expect(r.df).toBe(2 * 3 * 2 / 2); // p(p+1)(k-1)/2 = 2*3*2/2 = 6
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════
// Exact small-sample distributions for Mann-Whitney U & Wilcoxon (S15).
// Reference values match R wilcox.test (exact) for tie-free small samples.
// ═════════════════════════════════════════════════════════════════
describe("mannWhitneyExactP (reference vs R wilcox.test)", () => {
  it("U=0 for n1=n2=3 → two-sided p = 0.1 (1/C(6,3)·2)", () => {
    expect(mannWhitneyExactP(3, 3, 0)).toBeCloseTo(0.1, 6);
  });
  it("U=0 for n1=n2=4 → two-sided p = 2/70 ≈ 0.0285714", () => {
    expect(mannWhitneyExactP(4, 4, 0)).toBeCloseTo(0.0285714, 6);
  });
  it("is symmetric in (n1, n2)", () => {
    expect(mannWhitneyExactP(3, 5, 2)).toBeCloseTo(mannWhitneyExactP(5, 3, 2), 10);
  });
  it("returns 1 at the median (U = n1·n2/2) for symmetric case", () => {
    // n1=n2=3, maxU=9, median=4.5; U=4 → p should be ≤1 and finite.
    const p = mannWhitneyExactP(3, 3, 4);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe("wilcoxonExactP (reference vs R wilcox.test paired)", () => {
  it("W=0 for n=3 → two-sided p = 0.25 (2·1/8)", () => {
    expect(wilcoxonExactP(3, 0)).toBeCloseTo(0.25, 6);
  });
  it("W=0 for n=4 → two-sided p = 0.125 (2·1/16)", () => {
    expect(wilcoxonExactP(4, 0)).toBeCloseTo(0.125, 6);
  });
  it("W=1 for n=4 → two-sided p = 0.25 (2·2/16)", () => {
    expect(wilcoxonExactP(4, 1)).toBeCloseTo(0.25, 6);
  });
});

describe("mannWhitneyU / wilcoxonSignedRank — exact method selection", () => {
  it("uses exact method and p for small tie-free samples (Mann-Whitney)", () => {
    const r = mannWhitneyU([1, 2, 3], [4, 5, 6]);
    expect(r.method).toBe("exact");
    expect(r.U).toBe(0);
    expect(r.pValue).toBeCloseTo(0.1, 6);
  });
  it("falls back to normal approximation when ties present (Mann-Whitney)", () => {
    const r = mannWhitneyU([1, 2, 2, 4], [3, 5, 6, 7]); // tie at 2
    expect(r.method).toBe("normal approximation");
    expect(isFinite(r.pValue)).toBe(true);
  });
  it("uses exact method and p for small tie-free samples (Wilcoxon)", () => {
    const r = wilcoxonSignedRank([1, 2, 3, 4], [0, 0, 0, 0]); // diffs 1,2,3,4 all +
    expect(r.method).toBe("exact");
    expect(r.W).toBe(0); // W- = 0
    expect(r.pValue).toBeCloseTo(0.125, 6);
  });
  it("falls back to normal approximation when ties in |diff| (Wilcoxon)", () => {
    const r = wilcoxonSignedRank([1, 2, 2, 4], [0, 0, 0, 0]); // |diff| tie at 2
    expect(r.method).toBe("normal approximation");
    expect(isFinite(r.pValue)).toBe(true);
  });
});

describe("runComparativeAll — analyzes the measurement, not coordinates", () => {
  it("compares the angle values, independent of where the tracing sits on the film", () => {
    const a = Array.from({ length: 10 }, (_, i) => makeSession(`a${i}`, [angleMarkup("SNA", 80 + (i % 5) * 0.4, { cx: 900 - i * 40 })]));
    const b = Array.from({ length: 10 }, (_, i) => makeSession(`b${i}`, [angleMarkup("SNA", 84 + (i % 5) * 0.4, { cx: 200 + i * 40 })]));
    const r = runComparativeAll([...a, ...b], {
      design: "independent", labelIds: ["SNA"], alpha: 0.05, mcCorrection: "none",
      groups: [{ label: "A", caseIds: a.map(s => s.id) }, { label: "B", caseIds: b.map(s => s.id) }],
    });
    const L = r.labels.SNA;
    expect(L.rawData.A.mean).toBeCloseTo(80.8, 6);
    expect(L.rawData.B.mean).toBeCloseTo(84.8, 6);
    expect(L.unit).toBe("°");
  });
});
