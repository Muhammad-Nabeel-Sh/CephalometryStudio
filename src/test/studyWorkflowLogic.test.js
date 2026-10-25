import { describe, it, expect, beforeEach } from "vitest";
import { runStudy } from "../research/engine.js";
import { mkStudy } from "../research/studyModel.js";
import { fingerprintStudy, studyStatus } from "../research/studyState.js";
import { collectStudyWarnings } from "../research/studyWarnings.js";
import { summarizeStudy, methodsText, resultsText, referencesFor, apaP, bounded, stripTags } from "../research/studyReport.js";
import { buildResultsTables, tablesToCSV, tablesToTSV } from "../research/resultsExport.js";
import { saveStudyDefaults, defaultsFor, copySettings, pickSettings } from "../research/studyDefaults.js";
import { sealedSessions, unsealSession, blindingProgress, isBlindingActive } from "../research/blinding.js";
import { assignmentReport, addSessionsToGroup, buildLongitudinalFromPatients } from "../research/assignment.js";
import { buildDataMatrix } from "../research/dataPreview.js";
import { studyReportContent, studyReportHTML } from "../research/studyReportExport.js";
import { makeSession, lineMarkup, pointMarkup } from "./helpers/cephFixtures.js";

let n = 0;
const uid = () => `id${++n}`;

// Two groups of 8 with a clear difference in "Co-A".
function comparativeFixture() {
  const a = [80, 82, 81, 83, 79, 82, 80, 81].map((v, i) => makeSession(`a${i}`, [lineMarkup("Co-A", v)], { meta: { patientId: `P${i}` } }));
  const b = [86, 88, 85, 89, 87, 86, 90, 88].map((v, i) => makeSession(`b${i}`, [lineMarkup("Co-A", v)], { meta: { patientId: `Q${i}` } }));
  const study = mkStudy("comparative", { config: { groups: [{ id: "g1", label: "Class I", caseIds: a.map(s => s.id) }, { id: "g2", label: "Class II", caseIds: b.map(s => s.id) }], labelIds: [], mcCorrection: "holm" } });
  return { sessions: [...a, ...b], study };
}

const run = (study, sessions) => {
  const out = runStudy(study, sessions, null);
  return { ...out, dataFingerprint: fingerprintStudy(study, sessions, null) };
};

describe("A3 — stale results", () => {
  it("results are current until a used session or the configuration changes", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    expect(studyStatus(done, sessions, null)).toBe("current");
    const edited = sessions.map((s, i) => (i === 0 ? { ...s, markups: [lineMarkup("Co-A", 95)] } : s));
    expect(studyStatus(done, edited, null)).toBe("stale");
    expect(studyStatus({ ...done, config: { ...done.config, alpha: 0.01 } }, sessions, null)).toBe("stale");
    // UI-only notes do not invalidate results.
    expect(studyStatus({ ...done, config: { ...done.config, notes: "x" } }, sessions, null)).toBe("current");
  });

  it("an unrelated session does not make results stale; older results are 'legacy'", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    expect(studyStatus(done, [...sessions, makeSession("other", [lineMarkup("Co-A", 1)])], null)).toBe("current");
    expect(studyStatus({ ...done, dataFingerprint: undefined }, sessions, null)).toBe("legacy");
    expect(studyStatus(study, sessions, null)).toBe("never-run");
  });

  it("all-session studies go stale when a session is added", () => {
    const sessions = [makeSession("s1", [lineMarkup("L", 10)]), makeSession("s2", [lineMarkup("L", 12)])];
    const study = mkStudy("descriptive", { sessionIds: ["s1", "s2"] });
    const done = run(study, sessions);
    expect(studyStatus(done, [...sessions, makeSession("s3", [lineMarkup("L", 14)])], null)).toBe("stale");
  });
});

describe("A4 — warnings", () => {
  it("collects module warnings, skipped labels and stale state, errors first", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    const ws = collectStudyWarnings({ ...done, results: { ...done.results, error: "boom" } }, { status: "stale" });
    expect(ws[0].level).toBe("error");
    expect(ws.some(w => /changed after this run/.test(w.text))).toBe(true);
    expect(ws.some(w => /Smallest group has 8 cases/.test(w.text))).toBe(true);
  });

  it("reliability warnings (which the old screen never showed) are listed", () => {
    const sessions = [makeSession("x1", [lineMarkup("L", 10)]), makeSession("x2", [lineMarkup("L", 10.2)])];
    const cases = [{ id: "C1", name: "C1", sessions: [{ sessionId: "x1", operatorId: "op", occasion: 1 }, { sessionId: "x2", operatorId: "op", occasion: 2 }] }];
    const done = run({ ...mkStudy("reliability"), config: { ...mkStudy("reliability").config, cases, labelIds: [] } }, sessions);
    const texts = collectStudyWarnings(done).map(w => w.text).join(" | ");
    expect(texts).toMatch(/Only 1 cases/);
    expect(texts).toMatch(/not analyzed/);
  });
});

describe("A8/A9 — summary and APA text", () => {
  it("APA number formatting", () => {
    expect(stripTags(apaP(0.0004))).toBe("p < .001");
    expect(stripTags(apaP(0.0342))).toBe("p = .034");
    expect(bounded(0.913)).toBe(".91");
    expect(bounded(-0.25)).toBe("-.25");
  });

  it("comparative: headline, findings and an APA results sentence", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    const s = summarizeStudy(done);
    expect(s.headline).toMatch(/1 of 1 measurement differ significantly between Class I and Class II/);
    expect(s.findings[0].flag).toBe("sig");
    const txt = stripTags(resultsText(done));
    expect(txt).toMatch(/^Co-A \(mm\) — Class I: M = 81\.00, SD = 1\.31; Class II: M = 87\.38, SD = 1\.69; t\(\d+\.\d+\) = -8\.\d+, p < \.001/);
    expect(txt).toMatch(/d = -4\.\d+ 95% CI/);
  });

  it("methods paragraph names the tests and cites them; references are APA", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    const m = stripTags(methodsText(done).html);
    expect(m).toMatch(/Welch’s t-tests/);
    expect(m).toMatch(/Holm’s step-down correction \(Holm, 1979\)/);
    expect(m).toMatch(/α = \.05/);
    const refs = referencesFor(done).map(stripTags);
    expect(refs.some(r => r.startsWith("Welch, B. L. (1947)"))).toBe(true);
    expect(refs.some(r => r.startsWith("Holm, S. (1979)"))).toBe(true);
    expect(refs).toEqual([...refs].sort((a, b) => a.localeCompare(b)));
  });

  it("reliability methods describe the ICC model and blinding", () => {
    const study = mkStudy("reliability", { config: { iccModel: "icc3", design: "intra", protocol: { occasions: 2, blindingEnforced: true } } });
    const m = stripTags(methodsText({ ...study, results: { summary: { cases: 20 }, details: [] } }).html);
    expect(m).toMatch(/20 cases traced on 2 occasions at least 14 days apart, with earlier tracings hidden/);
    expect(m).toMatch(/ICC\(3,1\) \(two-way mixed effects, consistency, single measurement\)/);
  });
});

describe("A10 — report export escapes user text", () => {
  it("study, group and measurement names cannot inject HTML", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const { sessions, study } = comparativeFixture();
    const s2 = { ...study, name: evil, config: { ...study.config, notes: evil, groups: study.config.groups.map((g, i) => (i ? g : { ...g, label: evil })) } };
    const done = { ...run(s2, sessions), name: evil };
    const html = studyReportHTML(studyReportContent(done, "current"));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("A12 — results tables", () => {
  it("one table → plain CSV identical to the previous exporter; TSV for the clipboard", () => {
    const { sessions, study } = comparativeFixture();
    const done = run(study, sessions);
    const tables = buildResultsTables(done);
    expect(tables).toHaveLength(1);
    const csv = tablesToCSV(tables).split("\n");
    expect(csv[0]).toBe("Label,Unit,Test,Statistic,df,p_Value,p_Adjusted,MC_Significant,Effect_Size,ES_Type,ES_Interpretation,Overall_Significant");
    expect(csv[1].startsWith("Co-A,mm,Welch's t-test,")).toBe(true);
    expect(tablesToTSV(tables).split("\n")[1].split("\t")[0]).toBe("Label");
  });
});

describe("A16 — remembered settings", () => {
  beforeEach(() => localStorage.clear());
  it("saves only methodological settings and copies them between studies", () => {
    saveStudyDefaults("comparative", { alpha: 0.01, testPolicy: "nonparametric", groups: [{ id: "x" }] });
    expect(defaultsFor("comparative")).toEqual({ alpha: 0.01, testPolicy: "nonparametric" });
    const a = mkStudy("comparative", { config: { alpha: 0.01, mcCorrection: "bh" } });
    const b = mkStudy("comparative");
    const c = copySettings(b, a);
    expect(c.config.alpha).toBe(0.01);
    expect(c.config.mcCorrection).toBe("bh");
    expect(c.config.groups).toBe(b.config.groups);
    expect(pickSettings("reliability", { iccModel: "icc3", cases: [1] })).toEqual({ iccModel: "icc3" });
  });

  it("new studies start from the saved defaults", () => {
    saveStudyDefaults("comparative", { alpha: 0.01, testPolicy: "nonparametric" });
    const s = mkStudy("comparative");
    expect(s.config.alpha).toBe(0.01);
    expect(s.config.testPolicy).toBe("nonparametric");
  });
});

describe("A5 — blinding", () => {
  function project({ blind = true, done = [true, false] } = {}) {
    const base = makeSession("base", [pointMarkup("S", 1, 2)]);
    const c1 = makeSession("c1", [pointMarkup("S", 1, 2)]), c2 = makeSession("c2", []);
    const steps = [
      { operatorId: "op", operatorName: "Rater A", trialNum: 1, caseId: "C1", caseName: "Case 1", baseSessionId: "base", cloneSessionId: "c1", done: done[0] },
      { operatorId: "op", operatorName: "Rater A", trialNum: 2, caseId: "C1", caseName: "Case 1", baseSessionId: "base", cloneSessionId: "c2", done: done[1] },
    ];
    const study = { ...mkStudy("reliability"), id: "st", name: "ICC study" };
    study.config = { ...study.config, protocol: { ...study.config.protocol, blindingEnforced: blind }, workflow: { active: true, steps, currentStep: 1, complete: done.every(Boolean) } };
    return { sessions: [base, c1, c2], researchStudies: [study] };
  }

  it("seals finished tracings and the traced original while collection is incomplete", () => {
    const sealed = sealedSessions(project());
    expect([...sealed.keys()].sort()).toEqual(["base", "c1"]);
    expect(sealed.get("c1").reason).toMatch(/occasion 1/);
    expect(blindingProgress(project().researchStudies[0])).toEqual({ blocked: true, done: 1, total: 2 });
  });

  it("nothing is sealed without blinding or once collection is complete", () => {
    expect(sealedSessions(project({ blind: false })).size).toBe(0);
    const complete = project({ done: [true, true] });
    expect(isBlindingActive(complete.researchStudies[0])).toBe(false);
    expect(sealedSessions(complete).size).toBe(0);
  });

  it("breaking a seal is logged and reported", () => {
    const p = unsealSession(project(), "st", "c1", 123);
    expect(sealedSessions(p).has("c1")).toBe(false);
    expect(p.researchStudies[0].config.blindingLog).toEqual([{ sessionId: "c1", at: 123 }]);
    expect(collectStudyWarnings(p.researchStudies[0]).some(w => /Blinding was broken for 1 session/.test(w.text))).toBe(true);
  });
});

describe("A6 — assignment", () => {
  it("reports unassigned and duplicated sessions", () => {
    const { sessions, study } = comparativeFixture();
    const extra = makeSession("loose", [lineMarkup("Co-A", 70)]);
    const dup = { ...study, config: { ...study.config, groups: [study.config.groups[0], { ...study.config.groups[1], caseIds: [...study.config.groups[1].caseIds, "a0"] }] } };
    const rep = assignmentReport(dup, [...sessions, extra]);
    expect(rep.unassigned).toEqual(["loose"]);
    expect(rep.duplicates).toEqual([{ sessionId: "a0", roles: ["Class I · case 1", "Class II · case 9"] }]);
  });

  it("moves sessions into one group", () => {
    const cfg = addSessionsToGroup({ groups: [{ id: "g1", caseIds: ["a", "b"] }, { id: "g2", caseIds: [] }] }, "g2", ["b", "c"]);
    expect(cfg.groups).toEqual([{ id: "g1", caseIds: ["a"] }, { id: "g2", caseIds: ["b", "c"] }]);
  });

  it("builds longitudinal subjects from patient IDs ordered by age", () => {
    const sessions = [
      makeSession("p1b", [], { meta: { patientId: "P1", age: "12" } }), makeSession("p1a", [], { meta: { patientId: "P1", age: "9" } }),
      makeSession("p2a", [], { meta: { patientId: "P2", age: "10" } }), makeSession("p2b", [], { meta: { patientId: "P2", age: "13" } }),
      makeSession("p3", [], { meta: { patientId: "P3", age: "11" } }),
    ];
    const { config, added, skippedPatients } = buildLongitudinalFromPatients({ timepoints: [] }, sessions, uid);
    expect(added).toBe(2);
    expect(skippedPatients).toBe(1);
    const p1 = config.subjects.find(s => s.label === "P1");
    expect(Object.values(p1.records)).toEqual(["p1a", "p1b"]);
  });
});

describe("session scope", () => {
  it("descriptive studies can be limited to selected sessions (preview and engine agree)", () => {
    const sessions = [makeSession("s1", [lineMarkup("L", 10)]), makeSession("s2", [lineMarkup("L", 20)])];
    const study = mkStudy("descriptive", { sessionIds: ["s1"], config: { sessionScope: "selected" } });
    expect(buildDataMatrix(study, sessions).rows.map(r => r.sessionId)).toEqual(["s1"]);
    expect(runStudy(study, sessions, null).results.combined.L.stats.mean).toBe(10);
    const all = mkStudy("descriptive", { sessionIds: ["s1"] });
    expect(runStudy(all, sessions, null).results.combined.L.stats.n).toBe(2);
  });
});
