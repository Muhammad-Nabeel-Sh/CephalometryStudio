import { describe, it, expect } from "vitest";
import { iccFromMatrix, blandAltman, fQuantile, tQuantile, runReliabilityAll } from "../research/reliability.js";
import { makeSession, lineMarkup } from "./helpers/cephFixtures.js";

// Shrout & Fleiss (1979) Table 2: 6 targets × 4 judges. Reference values from
// R psych::ICC(sf) — estimate, F, df1, df2, lower, upper.
const SF = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];
const PSYCH = {
  icc1:  [0.17, 1.8, 5, 18, -0.13, 0.72],
  icc2:  [0.29, 11, 5, 15, 0.019, 0.76],
  icc3:  [0.71, 11, 5, 15, 0.342, 0.95],
  icc1k: [0.44, 1.8, 5, 18, -0.88, 0.91],
  icc2k: [0.62, 11, 5, 15, 0.071, 0.93],
  icc3k: [0.91, 11, 5, 15, 0.676, 0.99],
};

describe("ICC — all six Shrout & Fleiss / McGraw & Wong forms vs psych::ICC", () => {
  for (const [type, [est, F, df1, df2, lo, hi]] of Object.entries(PSYCH)) {
    it(type, () => {
      const r = iccFromMatrix(SF, type);
      expect(r.icc).toBeCloseTo(est, 2);
      expect(r.F).toBeCloseTo(F, 0);
      expect(r.df1).toBe(df1);
      expect(r.df2).toBe(df2);
      expect(r.ci95[0]).toBeCloseTo(lo, 2);
      expect(r.ci95[1]).toBeCloseTo(hi, 2);
      expect(r.modelLabel).toMatch(/^ICC\(/);
    });
  }

  it("p-value for the two-way forms matches psych (1.3e-4)", () => {
    expect(iccFromMatrix(SF, "icc2").pValue).toBeCloseTo(0.00013, 4);
  });
});

describe("distribution quantiles", () => {
  it("F and t quantiles match tables", () => {
    expect(fQuantile(0.975, 5, 15)).toBeCloseTo(3.576, 2);
    expect(fQuantile(0.95, 1, 1)).toBeCloseTo(161.45, 0); // needs the expanding bracket
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.228, 3);
  });
});

describe("Bland-Altman", () => {
  const a = [10, 12, 14, 16, 18, 20, 22, 24];
  const b = [10.5, 12.2, 14.9, 16.1, 18.8, 20.3, 22.6, 24.4];

  it("d = b − a with classic limits d̄ ± 1.96·SD", () => {
    const r = blandAltman(a, b);
    const d = b.map((v, i) => v - a[i]);
    const m = d.reduce((x, y) => x + y, 0) / d.length;
    const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / (d.length - 1));
    expect(r.meanDiff).toBeCloseTo(m, 10);
    expect(r.meanDiff).toBeGreaterThan(0);
    expect(r.loaUpper).toBeCloseTo(m + 1.96 * sd, 10);
    expect(r.loaLower).toBeCloseTo(m - 1.96 * sd, 10);
    // CI of the bias uses t(n−1).
    expect(r.meanDiffCi[1] - m).toBeCloseTo(tQuantile(0.975, 7) * sd / Math.sqrt(8), 10);
    // The prediction interval is wider than the classic limits for small n.
    expect(r.predictionInterval[1]).toBeGreaterThan(r.loaUpper);
  });
});

describe("runReliabilityAll — design handling", () => {
  // 6 cases, occasion 2 reads 0.5 longer than occasion 1.
  function intraStudy() {
    const sessions = [], cases = [];
    for (let c = 0; c < 6; c++) {
      const base = 60 + c * 3;
      const ids = [`c${c}_o1`, `c${c}_o2`];
      sessions.push(makeSession(ids[0], [lineMarkup("S-N", base)]));
      sessions.push(makeSession(ids[1], [lineMarkup("S-N", base + 0.5 + (c % 2) * 0.2)]));
      cases.push({ id: `C${c}`, name: `C${c}`, sessions: [{ sessionId: ids[1], operatorId: "op", occasion: 2 }, { sessionId: ids[0], operatorId: "op", occasion: 1 }] });
    }
    return { sessions, cases };
  }

  it("orders occasions so the bias is occasion 2 − occasion 1", () => {
    const { sessions, cases } = intraStudy();
    const d = runReliabilityAll(sessions, { labelIds: [], cases, design: "intra", iccModel: "icc3" }).details[0];
    expect(d.comparison).toBe("occ2 − occ1");
    expect(d.meanDiff).toBeCloseTo(0.6, 10);
    expect(d.iccModelLabel).toBe("ICC(3,1)");
    expect(d.nSubjects).toBe(6);
  });

  it("Dahlberg for two occasions equals √(Σd²/2n)", () => {
    const { sessions, cases } = intraStudy();
    const d = runReliabilityAll(sessions, { labelIds: [], cases, design: "intra" }).details[0];
    const diffs = [0.5, 0.7, 0.5, 0.7, 0.5, 0.7];
    expect(d.dahlberg).toBeCloseTo(Math.sqrt(diffs.reduce((s, x) => s + x * x, 0) / 12), 10);
  });

  it("method comparison reports test − reference", () => {
    const sessions = [], cases = [];
    for (let c = 0; c < 5; c++) {
      sessions.push(makeSession(`r${c}`, [lineMarkup("Co-A", 80 + c)]));
      sessions.push(makeSession(`t${c}`, [lineMarkup("Co-A", 79 + c)]));
      cases.push({ id: `C${c}`, name: `C${c}`, sessions: [{ sessionId: `t${c}`, operatorId: "AI", occasion: 1 }, { sessionId: `r${c}`, operatorId: "Expert", occasion: 1 }] });
    }
    const operators = [{ id: "AI", role: "test" }, { id: "Expert", role: "reference" }];
    const d = runReliabilityAll(sessions, { labelIds: [], cases, operators, design: "method_comparison" }).details[0];
    expect(d.comparison).toBe("AI − Expert");
    expect(d.meanDiff).toBeCloseTo(-1, 10);
  });

  it("excludes incomplete cases listwise and warns", () => {
    const { sessions, cases } = intraStudy();
    cases.push({ id: "CX", name: "CX", sessions: [{ sessionId: "lonely", operatorId: "op", occasion: 1 }] });
    sessions.push(makeSession("lonely", [lineMarkup("S-N", 70)]));
    const r = runReliabilityAll(sessions, { labelIds: [], cases, design: "intra" });
    expect(r.details[0].nExcluded).toBe(1);
    expect(r.warnings.some(w => /excluded/.test(w))).toBe(true);
  });

  it("suppresses CV% for measures centred near zero", () => {
    const sessions = [], cases = [];
    for (let c = 0; c < 6; c++) {
      sessions.push(makeSession(`a${c}`, [lineMarkup("small", 0.5 + c)]), makeSession(`b${c}`, [lineMarkup("small", 0.7 + c)]));
      cases.push({ id: `C${c}`, name: `C${c}`, sessions: [{ sessionId: `a${c}`, operatorId: "op", occasion: 1 }, { sessionId: `b${c}`, operatorId: "op", occasion: 2 }] });
    }
    const d = runReliabilityAll(sessions, { labelIds: [], cases, design: "intra" }).details[0];
    expect(d.cv).toBeNull();
  });
});
