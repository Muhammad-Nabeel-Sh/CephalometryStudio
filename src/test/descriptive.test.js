import { describe, it, expect } from "vitest";
import { runDescriptiveAll, selectNormStratum, RESEARCH_NORMS } from "../research/descriptive.js";
import { lineMarkup, angleMarkup } from "./helpers/cephFixtures.js";

function makeSession(id, markups, opts = {}) {
  return {
    id,
    markups,
    calibration: { done: true, pxPerMm: 1 },
    meta: { group: opts.group || "", timepoint: opts.timepoint || "" },
    ...opts,
  };
}

function makePoint(label, x, y) {
  return { type: "point", label, points: [{ x, y }], visible: true, placed: true, id: label };
}

describe("runDescriptiveAll", () => {
  it("returns stats for a single landmark across sessions", () => {
    const sessions = [
      makeSession("s1", [lineMarkup("S-N", 100)]),
      makeSession("s2", [lineMarkup("S-N", 102)]),
      makeSession("s3", [lineMarkup("S-N", 98)]),
    ];
    const config = { sessionIds: ["s1", "s2", "s3"], labelIds: ["S-N"] };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result).not.toBeNull();
    expect(result.combined).toBeDefined();
    expect(result.combined["S-N"]).toBeDefined();
    // One value per session: the line's length (never its coordinates).
    expect(result.combined["S-N"].stats.mean).toBeCloseTo(100, 6);
    expect(result.combined["S-N"].stats.n).toBe(3);
    expect(result.combined["S-N"].stats.min).toBeCloseTo(98, 6);
    expect(result.combined["S-N"].stats.max).toBeCloseTo(102, 6);
  });

  it("handles empty sessions gracefully", () => {
    const result = runDescriptiveAll([], { sessionIds: [], labelIds: ["S"] }, { done: true, pxPerMm: 1 });
    expect(result.combined).toBeDefined();
    expect(Object.keys(result.combined)).toHaveLength(0);
  });

  it("handles missing landmarks gracefully", () => {
    const sessions = [
      makeSession("s1", [makePoint("A", 100, 200)]),
    ];
    const config = { sessionIds: ["s1"], labelIds: ["NONEXISTENT"] };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });
    expect(result).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// Age/sex-aware norm stratum selection (S11).
// Guards against silently applying adult norms to children.
// ═════════════════════════════════════════════════════════════════
describe("selectNormStratum", () => {
  const mcnamara = RESEARCH_NORMS.find(n => n.id === "mcnamara");
  const steiner = RESEARCH_NORMS.find(n => n.id === "steiner");

  it("picks the age/sex-matched stratum for McNamara linear measures", () => {
    const sel = selectNormStratum(mcnamara, 12, "male");
    expect(sel.stratum).toBeTruthy();
    expect(sel.stratum.group).toMatch(/12y.*male/i);
    const coGn = sel.values["Co-Gn"];
    expect(coGn.mean).toBe(125); // adolescent 12y male
  });

  it("falls back to the adult stratum when age is missing", () => {
    const sel = selectNormStratum(mcnamara, null, null);
    expect(sel.stratum).toBeTruthy();
    expect(sel.stratum.group).toMatch(/adult/i);
    expect(sel.warning).toMatch(/no patient age/i);
  });

  it("keeps age-stable angular values available across all strata", () => {
    const child = selectNormStratum(mcnamara, 9, "female");
    const adult = selectNormStratum(mcnamara, 30, "male");
    expect(child.values["Facial axis"].mean).toBe(90);
    expect(adult.values["Facial axis"].mean).toBe(90);
  });

  it("stratum linear value overrides differ by age/sex", () => {
    const boy9 = selectNormStratum(mcnamara, 9, "male").values["Co-Gn"].mean;
    const girl9 = selectNormStratum(mcnamara, 9, "female").values["Co-Gn"].mean;
    const man30 = selectNormStratum(mcnamara, 30, "male").values["Co-Gn"].mean;
    expect(boy9).toBeLessThan(man30);
    expect(girl9).toBeLessThan(boy9);
  });

  it("warns when an adult-only norm (Steiner) is applied to a child", () => {
    const sel = selectNormStratum(steiner, 9, null);
    expect(sel.stratum).toBeNull();
    expect(sel.warning).toMatch(/below the adult range/i);
  });

  it("does not warn when an adult norm is applied to an adult", () => {
    const sel = selectNormStratum(steiner, 30, null);
    expect(sel.warning).toBeNull();
  });
});

describe("runDescriptiveAll — z-score stratum + warning propagation", () => {
  function makeSession(id, markups, opts = {}) {
    return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "", ...opts.meta }, ...opts };
  }

  it("records the matched stratum and an age-mismatch warning on z-scores", () => {
    const sessions = [makeSession("s1", [angleMarkup("Facial axis", 88)], { meta: { age: "9", sex: "female" } })];
    const mcnamara = RESEARCH_NORMS.find(n => n.id === "mcnamara");
    const config = { labelIds: ["Facial axis"], referenceNorms: [{ ...mcnamara, id: "test-mc" }], patientAge: "9", patientSex: "female" };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });
    expect(result.zScores).toBeDefined();
    const entry = result.zScores["test-mc"]?.["Facial axis"];
    expect(entry).toBeDefined();
    expect(entry.stratum).toMatch(/9y.*female/i);
    expect(result.patientContext.age).toBe(9);
    expect(result.patientContext.sex).toBe("female");
  });

  it("emits an adult-norm-on-child warning for Steiner", () => {
    const sessions = [makeSession("s1", [angleMarkup("SNA", 82)], { meta: { age: "9" } })];
    const steiner = RESEARCH_NORMS.find(n => n.id === "steiner");
    const config = { labelIds: ["SNA"], referenceNorms: [{ ...steiner, id: "test-st" }], patientAge: "9" };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });
    expect(result.zScores["test-st"]._stratumWarning).toMatch(/below the adult range/i);
  });

  it("auto-derives patient age/sex from session meta when not in config", () => {
    const sessions = [makeSession("s1", [angleMarkup("Facial axis", 88)], { meta: { age: "30", sex: "male" } })];
    const mcnamara = RESEARCH_NORMS.find(n => n.id === "mcnamara");
    const config = { labelIds: ["Facial axis"], referenceNorms: [{ ...mcnamara, id: "test-mc2" }] };
    const result = runDescriptiveAll(sessions, config, { done: true, pxPerMm: 1 });
    expect(result.patientContext.age).toBe(30);
    expect(result.patientContext.sex).toBe("male");
    expect(result.zScores["test-mc2"]["Facial axis"].stratum).toMatch(/adult.*male/i);
  });
});

describe("runDescriptiveAll — analyzes the measurement, not coordinates", () => {
  it("averages angles (one value per markup), not pixel positions", () => {
    const sessions = [80, 82, 84, 86].map((deg, i) => makeSession(`s${i}`, [angleMarkup("SNA", deg, { cx: 400 + i * 150 })]));
    const r = runDescriptiveAll(sessions, { labelIds: ["SNA"] }, { done: true, pxPerMm: 1 });
    expect(r.combined.SNA.stats.n).toBe(4);
    expect(r.combined.SNA.stats.mean).toBeCloseTo(83, 6);
    expect(r.combined.SNA.unit).toBe("°");
  });

  it("keeps the sign of signed measures (ANB < 0 for Class III)", () => {
    const sessions = [-3, -2, -4].map((deg, i) => makeSession(`s${i}`, [angleMarkup("ANB", deg)]));
    const r = runDescriptiveAll(sessions, { labelIds: ["ANB"] }, { done: true, pxPerMm: 1 });
    expect(r.combined.ANB.stats.mean).toBeCloseTo(-3, 6);
  });

  it("point landmarks are not scalar measurements", () => {
    const r = runDescriptiveAll([makeSession("s1", [makePoint("S", 100, 100)])], { labelIds: ["S"] }, { done: true, pxPerMm: 1 });
    expect(r.combined.S).toBeUndefined();
  });
});
