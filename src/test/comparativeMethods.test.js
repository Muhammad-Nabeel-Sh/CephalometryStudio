import { describe, it, expect } from "vitest";
import { normalCdf, ptukey, qtukey } from "../research/statsCore.js";
import { runComparativeAll, welchAnova, gamesHowell, holmAdjust, dunnTest } from "../research/comparative.js";
import { makeSession, lineMarkup } from "./helpers/cephFixtures.js";

describe("normal CDF (statsCore)", () => {
  it("Φ(1.96) = 0.975 and accurate tails", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 5);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
    expect((1 - normalCdf(6)) / 9.8659e-10).toBeCloseTo(1, 3);
  });
});

describe("studentized range distribution vs Tukey tables", () => {
  const table = [[0.95, 2, 10, 3.151], [0.95, 3, 10, 3.877], [0.95, 4, 10, 4.327], [0.95, 5, 10, 4.654],
    [0.99, 3, 10, 5.270], [0.95, 3, 2, 8.331], [0.95, 10, 30, 4.824], [0.95, 3, 120, 3.356], [0.95, 3, Infinity, 3.314]];
  for (const [p, k, df, q] of table) {
    it(`q(${p}; k=${k}, ν=${df}) = ${q}`, () => {
      expect(qtukey(p, k, df)).toBeCloseTo(q, 2);
      expect(ptukey(q, k, df)).toBeCloseTo(p, 3);
    });
  }
});

describe("Welch ANOVA", () => {
  it("with two groups equals the Welch t-test (F = t², same df)", () => {
    const a = [10, 12, 11, 13, 9, 12], b = [14, 18, 11, 20, 16, 13, 19];
    const r = welchAnova([a, b]);
    const m = x => x.reduce((s, v) => s + v, 0) / x.length;
    const v = x => x.reduce((s, y) => s + (y - m(x)) ** 2, 0) / (x.length - 1);
    const va = v(a) / a.length, vb = v(b) / b.length;
    const t = (m(a) - m(b)) / Math.sqrt(va + vb);
    const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
    expect(r.F).toBeCloseTo(t * t, 10);
    expect(r.df2).toBeCloseTo(df, 10);
  });
});

describe("Games-Howell", () => {
  it("flags a clearly different group and not two similar ones", () => {
    const g = [[10, 11, 9, 10.5, 9.5], [10.2, 10.8, 9.6, 10.1, 9.9], [15, 17, 14, 18, 16]];
    const r = gamesHowell(g, ["A", "B", "C"]);
    const ab = r.find(x => x.groupA === "A" && x.groupB === "B");
    const ac = r.find(x => x.groupA === "A" && x.groupB === "C");
    expect(ab.significant).toBe(false);
    expect(ac.significant).toBe(true);
    expect(ac.ci95[1]).toBeLessThan(0);
  });
});

describe("Holm adjustment", () => {
  it("matches p.adjust(method = 'holm')", () => {
    const r = holmAdjust([0.01, 0.04, 0.03, 0.005]);
    // R: p.adjust(c(0.01,0.04,0.03,0.005),"holm") = 0.03 0.06 0.06 0.02
    expect(r.map(x => +x.adjusted.toFixed(4))).toEqual([0.03, 0.06, 0.06, 0.02]);
    expect(r.map(x => x.significant)).toEqual([true, false, false, true]);
  });
});

describe("runComparativeAll — test policy and pairing", () => {
  const groupsOf = (a, b) => [{ label: "A", caseIds: a.map(s => s.id) }, { label: "B", caseIds: b.map(s => s.id) }];

  it("defaults to Welch with a non-parametric sensitivity check", () => {
    const a = [60, 62, 61, 63, 59, 62, 60].map((v, i) => makeSession(`a${i}`, [lineMarkup("L", v)]));
    const b = [66, 69, 64, 70, 67, 65, 71].map((v, i) => makeSession(`b${i}`, [lineMarkup("L", v)]));
    const r = runComparativeAll([...a, ...b], { design: "independent", groups: groupsOf(a, b), labelIds: ["L"], mcCorrection: "none" });
    expect(r.testPolicy).toBe("welch");
    expect(r.labels.L.testName).toBe("Welch's t-test");
    expect(r.labels.L.sensitivity.testName).toBe("Mann-Whitney U");
    expect(r.labels.L.sensitivity.agrees).toBe(true);
  });

  it("three groups → Welch's ANOVA + Games-Howell post hoc", () => {
    const mk = (p, vals) => vals.map((v, i) => makeSession(`${p}${i}`, [lineMarkup("L", v)]));
    const a = mk("a", [10, 11, 9, 10.5, 9.5]), b = mk("b", [10.2, 10.8, 9.6, 10.1, 9.9]), c = mk("c", [15, 17, 14, 18, 16]);
    const r = runComparativeAll([...a, ...b, ...c], {
      design: "independent", labelIds: ["L"], mcCorrection: "none",
      groups: [{ label: "A", caseIds: a.map(s => s.id) }, { label: "B", caseIds: b.map(s => s.id) }, { label: "C", caseIds: c.map(s => s.id) }],
    });
    expect(r.labels.L.testName).toBe("Welch's ANOVA");
    expect(r.postHocMethod).toBe("Games-Howell");
    expect(r.postHoc.L).toHaveLength(3);
  });

  it("paired design pairs by subject position and drops incomplete pairs", () => {
    // Subject 2 has no measurement at T1. Before the fix every later pair shifted.
    const t0 = [50, 52, 54, 56, 58, 60].map((v, i) => makeSession(`p${i}`, [lineMarkup("L", v)]));
    const t1 = [51, 53.5, null, 57.2, 58.8, 61.4].map((v, i) => makeSession(`q${i}`, v == null ? [] : [lineMarkup("L", v)]));
    const r = runComparativeAll([...t0, ...t1], { design: "paired", groups: groupsOf(t0, t1), labelIds: ["L"], mcCorrection: "none", testPolicy: "welch" });
    const L = r.labels.L;
    expect(L.droppedPairs).toBe(1);
    expect(L.rawData.A.n).toBe(5);
    // Correctly aligned differences: 1, 1.5, 1.2, 0.8, 1.4 → mean 1.18.
    expect(L.testName).toBe("Paired t-test");
    expect(L.rawData.B.mean - L.rawData.A.mean).toBeCloseTo(1.18, 10);
  });

  it("Holm correction is applied when selected", () => {
    const a = [60, 62, 61, 63, 59].map((v, i) => makeSession(`a${i}`, [lineMarkup("L", v), lineMarkup("M", v * 2)]));
    const b = [66, 69, 64, 70, 67].map((v, i) => makeSession(`b${i}`, [lineMarkup("L", v), lineMarkup("M", v * 2 + 1)]));
    const r = runComparativeAll([...a, ...b], { design: "independent", groups: groupsOf(a, b), labelIds: [], mcCorrection: "holm" });
    expect(r.labels.L.mcCorrected.adjusted).toBeGreaterThanOrEqual(r.labels.L.result.pValue);
  });
});

describe("S4 additions", () => {
  it("paired 3+ conditions report Mauchly's test and the Greenhouse-Geisser ε", () => {
    const mk = (p, vals) => vals.map((v, i) => makeSession(`${p}${i}`, [lineMarkup("L", v)]));
    const a = mk("x", [10, 12, 11, 14, 13, 12]), b = mk("y", [12, 15, 12, 18, 14, 15]), c = mk("z", [15, 16, 14, 21, 17, 19]);
    const r = runComparativeAll([...a, ...b, ...c], {
      design: "paired", labelIds: ["L"], mcCorrection: "none",
      groups: [{ label: "T1", caseIds: a.map(s => s.id) }, { label: "T2", caseIds: b.map(s => s.id) }, { label: "T3", caseIds: c.map(s => s.id) }],
    }).labels.L;
    expect(r.testName).toBe("Repeated measures ANOVA");
    expect(r.result.sphericity).toBeTruthy();
    expect(r.result.epsilon).toBeGreaterThan(0.5);
    expect(r.result.epsilon).toBeLessThanOrEqual(1);
    expect(r.result.dfCond).toBeCloseTo(2 * r.result.epsilon, 10);
  });

  it("Dunn's z equals (R̄i − R̄j)/√(N(N+1)/12·(1/ni + 1/nj)) without ties", () => {
    const g = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
    const r = dunnTest(g, ["A", "B", "C"]);
    const ac = r.find(x => x.groupA === "A" && x.groupB === "C");
    const expected = (2.5 - 10.5) / Math.sqrt((12 * 13 / 12) * (1 / 4 + 1 / 4));
    expect(ac.z).toBeCloseTo(expected, 10);
    expect(ac.pAdjusted).toBeGreaterThanOrEqual(ac.pValue);
  });

  it("Kruskal-Wallis is followed by Dunn's test", () => {
    const mk = (p, vals) => vals.map((v, i) => makeSession(`${p}${i}`, [lineMarkup("L", v)]));
    const a = mk("a", [1, 2, 3, 4, 5]), b = mk("b", [6, 7, 8, 9, 10]), c = mk("c", [11, 12, 13, 14, 15]);
    const r = runComparativeAll([...a, ...b, ...c], {
      design: "independent", labelIds: ["L"], mcCorrection: "none", testPolicy: "nonparametric",
      groups: [{ label: "A", caseIds: a.map(s => s.id) }, { label: "B", caseIds: b.map(s => s.id) }, { label: "C", caseIds: c.map(s => s.id) }],
    });
    expect(r.postHocMethods.L.name).toMatch(/Dunn/);
    expect(r.postHoc.L).toHaveLength(3);
  });

  it("pairs by patient ID when every case has one, regardless of list order", () => {
    const ids = ["P1", "P2", "P3", "P4", "P5"];
    const before = [50, 52, 54, 56, 58], after = [51, 53.5, 55.2, 56.8, 59.4];
    const t0 = ids.map((id, i) => makeSession(`b${i}`, [lineMarkup("L", before[i])], { meta: { patientId: id } }));
    // T1 list deliberately shuffled.
    const order = [3, 0, 4, 1, 2];
    const t1 = order.map(i => makeSession(`a${i}`, [lineMarkup("L", after[i])], { meta: { patientId: ids[i] } }));
    const r = runComparativeAll([...t0, ...t1], {
      design: "paired", labelIds: ["L"], mcCorrection: "none",
      groups: [{ label: "T0", caseIds: t0.map(s => s.id) }, { label: "T1", caseIds: t1.map(s => s.id) }],
    });
    expect(r.pairedBy).toBe("patient ID");
    const L = r.labels.L;
    const diffs = after.map((v, i) => v - before[i]);
    const md = diffs.reduce((a, b) => a + b, 0) / 5;
    expect(L.rawData.T1.mean - L.rawData.T0.mean).toBeCloseTo(md, 10);
    const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - md) ** 2, 0) / 4);
    expect(L.result.t).toBeCloseTo(-md / (sd / Math.sqrt(5)), 8); // exact only if paired by ID
  });
});
