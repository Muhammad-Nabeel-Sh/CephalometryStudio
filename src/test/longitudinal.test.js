import { describe, it, expect } from "vitest";
import { runLongitudinalAll } from "../research/longitudinal.js";
import { lineMarkup, angleMarkup } from "./helpers/cephFixtures.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}


describe("runLongitudinalAll", () => {
  it("returns error when fewer than 2 timepoints", () => {
    const result = runLongitudinalAll([], { timepoints: [{ id: "T1", label: "T1" }], subjects: [] });
    expect(result.error).toContain("2 timepoints");
  });

  it("returns error when fewer than 3 subjects", () => {
    const result = runLongitudinalAll([], {
      timepoints: [{ id: "T0", label: "Baseline" }, { id: "T1", label: "Follow-up" }],
      subjects: [{ id: "S1", label: "S1", records: {} }],
    });
    expect(result.error).toContain("3 subjects");
  });

  it("runs RM-ANOVA for a single landmark across timepoints", () => {
    const sessions = [];
    const subjects = [];
    for (let s = 0; s < 4; s++) {
      const sid = `subj_${s}`;
      const tps = {};
      for (let t = 0; t < 3; t++) {
        const sesId = `${sid}_tp${t}`;
        const val = 10 + t * 5 + (s * 0.5) + (t * 0.2) + Math.random() * 0.1;
        sessions.push(makeSession(sesId, [lineMarkup("L", val)]));
        tps[`T${t}`] = sesId;
      }
      subjects.push({ id: `S${s}`, label: `Subject ${s}`, records: tps });
    }

    const config = {
      timepoints: [
        { id: "T0", label: "Baseline" },
        { id: "T1", label: "Follow-up 1" },
        { id: "T2", label: "Follow-up 2" },
      ],
      subjects,
      labelIds: ["L"],
      sphericityCorrection: "greenhouse-geisser",
      modelType: "rm_anova",
    };
    const result = runLongitudinalAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result.labels).toBeDefined();
    expect(result.labels.L).toBeDefined();
    expect(result.labels.L.skip).toBeFalsy();
    expect(result.labels.L.rmAnova).toBeDefined();
    expect(result.labels.L.rmAnova.F).toBeGreaterThan(0);
    expect(result.labels.L.pairwise).toBeDefined();
  });
});

describe("runLongitudinalAll — analyzes the measurement, not coordinates", () => {
  it("tracks the angle across timepoints even when the tracing moves on the film", () => {
    const sessions = [], subjects = [];
    for (let i = 0; i < 6; i++) {
      const a = makeSession(`t1_${i}`, [angleMarkup("SNA", 80 + i * 0.5, { cx: 300 + i * 25 })]);
      const b = makeSession(`t2_${i}`, [angleMarkup("SNA", 83 + i * 0.5, { cx: 700 - i * 30, cy: 420 })]);
      sessions.push(a, b);
      subjects.push({ id: `P${i}`, label: `P${i}`, records: { T1: a.id, T2: b.id } });
    }
    const r = runLongitudinalAll(sessions, { subjects, timepoints: [{ id: "T1", label: "T1" }, { id: "T2", label: "T2" }], labelIds: ["SNA"] });
    expect(r.labels.SNA.rawData.T1.mean).toBeCloseTo(81.25, 6);
    expect(r.labels.SNA.rawData.T2.mean).toBeCloseTo(84.25, 6);
    expect(r.labels.SNA.unit).toBe("°");
  });
});
