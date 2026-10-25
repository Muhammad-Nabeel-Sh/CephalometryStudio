// End-to-end golden tests: markups → research module → numbers, compared with
// R's results on R's built-in datasets (sleep, PlantGrowth, cars). Each value
// passes through primaryMeasure, the session collectors and the test routing,
// so these guard the whole pipeline, not just the formulas.
import { describe, it, expect } from "vitest";
import { runComparativeAll } from "../research/comparative.js";
import { runCorrelationAll } from "../research/correlation.js";
import { oneWayAnova } from "../lib/utils.js";
import { makeSession, lineMarkup, signedDistanceMarkup } from "./helpers/cephFixtures.js";

// datasets::sleep — extra hours of sleep, drug 1 vs drug 2 (same 10 patients).
const SLEEP1 = [0.7, -1.6, -0.2, -1.2, -0.1, 3.4, 3.7, 0.8, 0.0, 2.0];
const SLEEP2 = [1.9, 0.8, 1.1, 0.1, -0.1, 4.4, 5.5, 1.6, 4.6, 3.4];
// datasets::PlantGrowth
const PG = {
  ctrl: [4.17, 5.58, 5.18, 6.11, 4.50, 4.61, 5.17, 4.53, 5.33, 5.14],
  trt1: [4.81, 4.17, 4.41, 3.59, 5.87, 3.83, 6.03, 4.89, 4.32, 4.69],
  trt2: [6.31, 5.12, 5.54, 5.50, 5.37, 5.29, 4.92, 6.15, 5.80, 5.26],
};
// datasets::cars
const SPEED = [4, 4, 7, 7, 8, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 20, 20, 20, 20, 22, 23, 24, 24, 24, 24, 25];
const DIST = [2, 10, 4, 22, 16, 10, 18, 26, 34, 17, 28, 14, 20, 24, 28, 26, 34, 34, 46, 26, 36, 60, 80, 20, 26, 54, 32, 40, 32, 40, 50, 42, 56, 76, 84, 36, 46, 68, 32, 48, 52, 56, 64, 66, 54, 70, 92, 93, 120, 85];

// Signed distances carry negative values (sleep change can be < 0).
const sessionsOf = (prefix, values, label = "extra") =>
  values.map((v, i) => makeSession(`${prefix}${i}`, [signedDistanceMarkup(label, v)]));

describe("Comparative vs R — sleep", () => {
  const g1 = sessionsOf("a", SLEEP1), g2 = sessionsOf("b", SLEEP2);
  const groups = [{ label: "drug1", caseIds: g1.map(s => s.id) }, { label: "drug2", caseIds: g2.map(s => s.id) }];

  it("t.test(extra ~ group): Welch t = −1.8608, df = 17.776, p = 0.07939", () => {
    const r = runComparativeAll([...g1, ...g2], { design: "independent", groups, labelIds: ["extra"], mcCorrection: "none" }).labels.extra;
    expect(r.testName).toBe("Welch's t-test");
    expect(r.result.t).toBeCloseTo(-1.8608, 3);
    expect(r.result.df).toBeCloseTo(17.776, 2);
    expect(r.result.pValue).toBeCloseTo(0.07939, 4);
  });

  it("t.test(..., paired = TRUE): t = −4.0621, df = 9, p = 0.002833", () => {
    const r = runComparativeAll([...g1, ...g2], { design: "paired", groups, labelIds: ["extra"], mcCorrection: "none" }).labels.extra;
    expect(r.testName).toBe("Paired t-test");
    expect(r.result.t).toBeCloseTo(-4.0621, 3);
    expect(r.result.df).toBe(9);
    expect(r.result.pValue).toBeCloseTo(0.002833, 5);
  });
});

describe("Comparative vs R — PlantGrowth", () => {
  const sess = Object.entries(PG).flatMap(([g, vals]) => vals.map((v, i) => makeSession(`${g}${i}`, [lineMarkup("weight", v)])));
  const groups = Object.keys(PG).map(g => ({ label: g, caseIds: PG[g].map((_, i) => `${g}${i}`) }));
  const run = testPolicy => runComparativeAll(sess, { design: "independent", groups, labelIds: ["weight"], mcCorrection: "none", testPolicy }).labels.weight;

  it("oneway.test (Welch): F = 5.181, df = 2, 17.128, p = 0.01739", () => {
    const r = run("welch");
    expect(r.testName).toBe("Welch's ANOVA");
    expect(r.result.F).toBeCloseTo(5.181, 3);
    expect(r.result.df2).toBeCloseTo(17.128, 2);
    expect(r.result.pValue).toBeCloseTo(0.01739, 4);
  });

  it("kruskal.test: χ² = 7.9882, df = 2, p = 0.01842", () => {
    const r = run("nonparametric");
    expect(r.testName).toBe("Kruskal-Wallis");
    expect(r.result.H).toBeCloseTo(7.9882, 3);
    expect(r.result.pValue).toBeCloseTo(0.01842, 4);
  });

  it("aov: F = 4.846, df = 2, 27, p = 0.01591", () => {
    const r = oneWayAnova(PG.ctrl, PG.trt1, PG.trt2);
    expect(r.F).toBeCloseTo(4.846, 3);
    expect(r.pValue).toBeCloseTo(0.01591, 4);
  });
});

describe("Correlation vs R — cars", () => {
  it("cor.test(speed, dist): r = 0.8068949, t = 9.464, df = 48", () => {
    const sess = SPEED.map((s, i) => makeSession(`c${i}`, [lineMarkup("speed", s), lineMarkup("dist", DIST[i], { y: 300 })]));
    const r = runCorrelationAll(sess, { labelIds: [], method: "pearson" });
    const cell = r.matrix.dist.speed;
    expect(cell.r).toBeCloseTo(0.8068949, 6);
    expect(cell.t).toBeCloseTo(9.464, 2);
    expect(cell.df).toBe(48);
    expect(cell.p).toBeLessThan(1e-11);
  });
});

describe("Shapiro-Wilk vs R shapiro.test (Royston AS R94)", () => {
  it("matches R for small and large n", async () => {
    const { shapiroWilk } = await import("../lib/utils.js");
    const cases = [
      [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.97016, 0.8924],
      [SLEEP1, 0.92581, 0.4079],
      [PG.ctrl, 0.95668, 0.7475],
      [SPEED, 0.97765, 0.4576],
      [DIST, 0.95144, 0.0391],
    ];
    for (const [x, W, p] of cases) {
      const r = shapiroWilk(x);
      expect(r.W).toBeCloseTo(W, 4);
      expect(r.pValue).toBeCloseTo(p, 3);
    }
    // Shapiro & Wilk (1965) skewed weights example: clearly non-normal.
    expect(shapiroWilk([148, 154, 158, 160, 161, 162, 166, 170, 182, 195, 236]).pValue).toBeLessThan(0.01);
  });
});
