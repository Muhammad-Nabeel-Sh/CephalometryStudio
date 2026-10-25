import { describe, it, expect } from "vitest";
import { fitLMM, fitGrowthModel, nelderMead } from "../research/mixedModel.js";
import { runLongitudinalAll } from "../research/longitudinal.js";
import { makeSession, lineMarkup } from "./helpers/cephFixtures.js";

// Seeded RNG so the simulations are reproducible.
function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
  return { u, g: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) };
}

describe("nelderMead", () => {
  it("minimises the Rosenbrock function", () => {
    const r = nelderMead(([x, y]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, [-1.2, 1], { maxIter: 5000, tol: 1e-14 });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
  });
});

describe("REML random-intercept model — balanced data equals the ANOVA closed form", () => {
  const { g } = rng(11);
  const T = [0, 1, 2, 4], n = 12, obs = [];
  for (let i = 0; i < n; i++) { const b = g() * 2; for (const t of T) obs.push({ subject: i, t, y: 50 + 1.5 * t + b + g() * 0.8 }); }
  const k = T.length, tb = T.reduce((a, b) => a + b) / k, Stt = T.reduce((a, t) => a + (t - tb) ** 2, 0);
  const subj = [...Array(n).keys()].map(i => obs.filter(o => o.subject === i));
  const ybar = subj.map(s => s.reduce((a, o) => a + o.y, 0) / k), gy = ybar.reduce((a, b) => a + b) / n;
  let num = 0; subj.forEach((s, i) => s.forEach(o => { num += (o.t - tb) * (o.y - ybar[i]); }));
  const b1 = num / (n * Stt);
  let ssw = 0; subj.forEach((s, i) => s.forEach(o => { ssw += (o.y - ybar[i] - b1 * (o.t - tb)) ** 2; }));
  const s2 = ssw / (n * (k - 1) - 1);
  const tau = (k * ybar.reduce((a, y) => a + (y - gy) ** 2, 0) / (n - 1) - s2) / k;

  const r = fitLMM(obs);
  it("slope, residual and subject variance", () => {
    expect(r.beta[1]).toBeCloseTo(b1, 6);
    expect(r.randomEffects.residualVariance).toBeCloseTo(s2, 4);
    expect(r.randomEffects.subjectVariance).toBeCloseTo(tau, 3);
    expect(r.fit.likelihood).toBe("REML");
  });
  it("slope SE = √(σ²/(n·Σ(t−t̄)²)); Satterthwaite df = within-subject df n(k−1)−1", () => {
    expect(r.fixedEffects[1].se).toBeCloseTo(Math.sqrt(s2 / (n * Stt)), 5);
    expect(r.dfMethod).toBe("Satterthwaite");
    expect(r.fixedEffects[1].df).toBeCloseTo(n * (k - 1) - 1, 2);
  });
});

describe("REML random-slope model — recovers simulated growth parameters", () => {
  const { u, g } = rng(3);
  const obs = [];
  for (let i = 0; i < 300; i++) {
    const b0 = g() * 3, b1 = g() * 0.5;
    for (const t of [0, 1, 2, 3, 4]) if (u() > 0.1) obs.push({ subject: i, t, y: 80 + b0 + (1 + b1) * t + g() });
  }
  const r = fitGrowthModel(obs);
  it("selects the random slope and estimates the components", () => {
    expect(r.randomSlope).toBe(true);
    expect(r.slopeTest.pValue).toBeLessThan(0.001);
    expect(r.beta[0]).toBeCloseTo(80, 0);
    expect(Math.abs(r.beta[1] - 1)).toBeLessThan(0.15);
    expect(r.randomEffects.subjectVariance).toBeGreaterThan(6);
    expect(r.randomEffects.subjectVariance).toBeLessThan(12);
    expect(r.randomEffects.slopeVariance).toBeGreaterThan(0.15);
    expect(r.randomEffects.slopeVariance).toBeLessThan(0.4);
    expect(r.randomEffects.residualVariance).toBeGreaterThan(0.8);
    expect(r.randomEffects.residualVariance).toBeLessThan(1.25);
  });
});

describe("runLongitudinalAll — mixed model integration", () => {
  // 5 subjects measured at ages 9, 11, 14 (unequal spacing); growth 2 mm/year.
  function study({ dropLast = false } = {}) {
    const sessions = [], subjects = [];
    const ages = [9, 11, 14];
    for (let i = 0; i < 5; i++) {
      const rec = {};
      ages.forEach((age, j) => {
        if (dropLast && i === 0 && j === 2) return;
        const id = `s${i}_${j}`;
        const noise = [0.3, -0.2, 0.1, -0.1, 0.2][(i + j) % 5];
        sessions.push(makeSession(id, [lineMarkup("Co-Gn", 100 + i * 2 + 2 * (age - 9) + noise)], { meta: { age: String(age) } }));
        rec[`T${j}`] = id;
      });
      subjects.push({ id: `P${i}`, label: `P${i}`, records: rec });
    }
    const config = { subjects, timepoints: ages.map((a, j) => ({ id: `T${j}`, label: `${a}y` })), labelIds: ["Co-Gn"], modelType: "both" };
    return runLongitudinalAll(sessions, config);
  }

  it("uses age as the time axis: slope ≈ 2 per year despite unequal spacing", () => {
    const lmm = study().labels["Co-Gn"].lmm;
    expect(lmm.modelType).toBe("reml_lmm");
    expect(lmm.timeAxis).toBe("age");
    expect(lmm.meanSlope).toBeCloseTo(2, 1);
    expect(lmm.fixedEffects[0].term).toMatch(/age 9/);
  });

  it("keeps subjects with a missing visit", () => {
    const res = study({ dropLast: true }).labels["Co-Gn"];
    expect(res.nComplete).toBe(4);
    expect(res.lmm.fit.subjects).toBe(5);
    expect(res.lmm.nObservations).toBe(14);
  });

  it("change scores are later − earlier", () => {
    const cs = study().labels["Co-Gn"].changeScores.find(c => c.from === "9y" && c.to === "14y");
    expect(cs.meanChange).toBeGreaterThan(9);
  });

  it("falls back to visit number when ages are missing, with a warning", () => {
    const sessions = [], subjects = [];
    for (let i = 0; i < 4; i++) {
      const a = makeSession(`a${i}`, [lineMarkup("L", 10 + i)]), b = makeSession(`b${i}`, [lineMarkup("L", 12 + i + [0.3, -0.4, 0.1, 0.25][i])]);
      sessions.push(a, b);
      subjects.push({ id: `P${i}`, records: { T0: a.id, T1: b.id } });
    }
    const r = runLongitudinalAll(sessions, { subjects, timepoints: [{ id: "T0" }, { id: "T1" }], labelIds: ["L"], modelType: "mixed_model" });
    expect(r.labels.L.lmm.timeAxis).toBe("index");
    expect(r.labels.L.lmm.warnings.join(" ")).toMatch(/No ages recorded/);
  });
});

describe("mixed model — quadratic growth and covariates", () => {
  // 8 boys + 8 girls, ages 8–16; girls grow 1.0/yr, boys 2.0/yr, both decelerating.
  function study(cfg) {
    const { g } = rng(21);
    const sessions = [], subjects = [];
    const ages = [8, 10, 12, 14, 16];
    for (let i = 0; i < 16; i++) {
      const sex = i < 8 ? "female" : "male";
      const rate = sex === "male" ? 2 : 1, b0 = g() * 2, rec = {};
      ages.forEach((age, j) => {
        const a = age - 8;
        const v = 100 + b0 + rate * a - 0.05 * a * a + g() * 0.3;
        const id = `s${i}_${j}`;
        sessions.push(makeSession(id, [lineMarkup("Co-Gn", v)], { meta: { age: String(age), sex } }));
        rec[`T${j}`] = id;
      });
      subjects.push({ id: `P${i}`, label: `P${i}`, records: rec });
    }
    return runLongitudinalAll(sessions, { subjects, timepoints: ages.map((a, j) => ({ id: `T${j}`, label: `${a}y` })), labelIds: ["Co-Gn"], modelType: "mixed_model", ...cfg }).labels["Co-Gn"].lmm;
  }

  it("estimates the curvature term", () => {
    const m = study({ growthCurve: "quadratic" });
    const quad = m.fixedEffects.find(f => /Time²/.test(f.term));
    expect(quad.estimate).toBeCloseTo(-0.05, 1);
    expect(m.growthCurve).toBe("quadratic");
  });

  it("detects the sex difference in growth rate (Time × sex)", () => {
    const m = study({ covariate: "sex" });
    expect(m.covariate.levels).toEqual(["female", "male"]);
    const inter = m.fixedEffects.find(f => /Time × sex male/.test(f.term));
    expect(inter.estimate).toBeGreaterThan(0.7);
    expect(inter.p).toBeLessThan(0.001);
  });
});
