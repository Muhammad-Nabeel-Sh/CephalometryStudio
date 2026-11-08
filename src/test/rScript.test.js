// "Export R script": the embedded data must be exactly what the app analyzes, and
// each study type must produce the matching R analysis. The scripts were run in
// R 4.6.1 against the app's results (Welch/rank tests, paired t, ICC forms, REML
// LMM, regression, logistic, DeLong AUC); these tests guard the generator.
import { describe, it, expect } from "vitest";
import { buildRData, buildRScript, rStr, rScriptSupported } from "../research/rScript.js";
import { mkStudy } from "../research/studyModel.js";
import { makeSession, lineMarkup, angleMarkup, pointMarkup } from "./helpers/cephFixtures.js";

const CAL = { done: true, pxPerMm: 1 };

describe("R script data", () => {
  const ss = [
    makeSession("a", [lineMarkup("Co-Gn", 110), angleMarkup("SNA", 82), pointMarkup("S", 1, 2)], { meta: { group: "g1", age: 12, sex: "F", patientId: "P1" } }),
    makeSession("b", [lineMarkup("Co-Gn", 115), angleMarkup("SNA", 80)], { meta: { group: "g2", age: 13, sex: "M" } }),
  ];

  it("holds one row per session × measurement, through the primary measure (no point coordinates)", () => {
    const d = buildRData(mkStudy("descriptive", { config: { groupBy: "group" } }), ss, CAL);
    expect(d.rows).toHaveLength(4);
    const sna = d.rows.find(r => r.session_id === "a" && r.measure === "SNA");
    expect(sna.value).toBeCloseTo(82, 6);
    expect(sna.unit).toBe("°");
    expect(sna.by).toBe("g1");
    expect(sna.patient_id).toBe("P1");
    expect(d.rows.some(r => r.measure === "S")).toBe(false);
  });

  it("adds the design columns of each study type", () => {
    const rel = mkStudy("reliability", { config: { design: "intra", operators: [{ id: "o1", name: "Ana" }], cases: [{ id: "c", name: "Case 1", sessions: [{ sessionId: "a", operatorId: "o1", occasion: 1 }, { sessionId: "b", operatorId: "o1", occasion: 2 }] }] } });
    const r = buildRData(rel, ss, CAL);
    expect(r.columns).toEqual(expect.arrayContaining(["case", "operator", "occasion"]));
    expect(r.rows.find(x => x.session_id === "b")).toMatchObject({ case: "Case 1", operator: "Ana", occasion: 2 });

    const cmp = mkStudy("comparative", { config: { groups: [{ label: "A", caseIds: ["a"] }, { label: "B", caseIds: ["b"] }] } });
    expect(buildRData(cmp, ss, CAL).rows.find(x => x.session_id === "b")).toMatchObject({ condition: "B", position: 1 });

    const lon = mkStudy("longitudinal", { config: { timepoints: [{ id: "t1", label: "T1", targetAge: 9 }, { id: "t2", label: "T2", targetAge: 11 }], subjects: [{ id: "s", label: "Subj", records: { t1: "a", t2: "b" } }] } });
    expect(buildRData(lon, ss, CAL).rows.find(x => x.session_id === "b")).toMatchObject({ subject: "Subj", timepoint: "T2", tp_index: 1, target_age: 11 });
  });

  it("limits a diagnostic study to its reference standard and predictors", () => {
    const dg = mkStudy("diagnostic", { config: { goldStandardLabel: "SNA", goldStandardPositive: "81", predictorLabels: ["Co-Gn"] } });
    expect(new Set(buildRData(dg, ss, CAL).rows.map(r => r.measure))).toEqual(new Set(["SNA", "Co-Gn"]));
  });
});

describe("R script text", () => {
  it("escapes R strings", () => {
    expect(rStr('a "b"\\c\nd')).toBe(String.raw`"a \"b\"\\c\nd"`);
  });

  it("writes the analysis for each supported type and data only for the others", () => {
    const s = [makeSession("a", [lineMarkup("L", 1)]), makeSession("b", [lineMarkup("L", 2)])];
    const expects = {
      descriptive: "shapiro.test", reliability: "psych::ICC", comparative: "oneway.test",
      longitudinal: "Error(subject / timepoint)", correlation: "cor.test", diagnostic: "pROC",
    };
    for (const [type, needle] of Object.entries(expects)) {
      expect(rScriptSupported(type)).toBe(true);
      expect(buildRScript(mkStudy(type), s, CAL)).toContain(needle);
    }
    expect(rScriptSupported("superimposition")).toBe(false);
    const sup = buildRScript(mkStudy("superimposition"), s, CAL);
    expect(sup).toContain("no standard R equivalent");
  });

  it("uses the study's ICC form, test policy and correction", () => {
    const s = [makeSession("a", [lineMarkup("L", 1)])];
    expect(buildRScript(mkStudy("reliability", { config: { iccModel: "icc3k" } }), s, CAL)).toContain('icc_row <- "ICC3k"');
    const np = buildRScript(mkStudy("comparative", { config: { testPolicy: "nonparametric", mcCorrection: "bh" } }), s, CAL);
    expect(np).toContain('policy <- "nonparametric"');
    expect(np).toContain('p.adjust(cmp$p, method = "BH")');
  });

  it("stops with a message when there is nothing to analyze", () => {
    expect(buildRScript(mkStudy("descriptive"), [], CAL)).toContain("stop(");
  });
});
