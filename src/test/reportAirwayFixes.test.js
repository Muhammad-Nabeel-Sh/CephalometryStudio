import { describe, it, expect } from "vitest";
import { measurementRows, needsUnicodeFont, generateReport } from "../report/reportGenerator.js";
import { reportScale, printLabelScale, REPORT_IMAGE_MAX } from "../canvas/imageLayers.js";
import { computeAirway } from "../airway/compute.js";

const CAL = { done: true, pxPerMm: 10 };

describe("PDF report helpers", () => {
  it("one row per markup with that measure's own unit", () => {
    const allMeas = [
      { m: { label: "S", type: "point", points: [{ x: 0, y: 0 }] } },
      { m: { label: "SNA", type: "angle3", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] } },
      { m: { label: "Area", type: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] } },
    ];
    const rows = measurementRows(allMeas, [{ markupLabel: "SNA", measureType: "angle", mean: 82, sd: 3.5 }], CAL, "right");
    expect(rows.map(r => r.label)).toEqual(["SNA", "Area"]);
    expect(rows[0]).toMatchObject({ unit: "°" });
    expect(rows[0].norm.mean).toBe(82);
    expect(rows[1].unit).toBe("mm²");
    expect(rows[1].value).toBeCloseTo(1, 6); // 100 px² at 10 px/mm
  });

  it("detects text Helvetica cannot show", () => {
    expect(needsUnicodeFont("Müller", "José", "±2°")).toBe(false);
    expect(needsUnicodeFont("Case 1", "أحمد علي")).toBe(true);
  });

  it("report images are capped and labels print at a readable size", () => {
    expect(reportScale(3600, 2400)).toBeCloseTo(REPORT_IMAGE_MAX / 3600, 9);
    expect(reportScale(800, 600)).toBe(1);
    // 1800 px across 166 mm → about 10.8 px/mm → 2.3 mm label ≈ 25 px → size ≈ 2.5
    expect(printLabelScale(1800, 166)).toBeCloseTo(2.49, 1);
  });
});

describe("PDF report — page structure", () => {
  const SECTIONS = { cover: true, images: false, measurements: true, normograms: false, airway: true, research: false, formulas: true, interpretation: false };
  const base = { project: { name: "Case", meta: {}, researchStudies: [] }, session: { name: "T0" }, norms: [], save: false };
  const angle = [{ m: { label: "SNA", type: "angle3", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] } }];
  const formulas = [{ id: "f", name: "F", expression: "a + b" }];

  it("several sections build without recursion; no airway page without airway data", async () => {
    const doc = await generateReport({ ...base, allMeas: angle, formulas, formulaValues: { f: 3 }, sections: SECTIONS });
    expect(doc.internal.getNumberOfPages()).toBe(3); // cover + measurements + formulas (each section is bookmarked on its own page)
  });

  it("without a cover the first page is used, and formulas get their own page", async () => {
    const doc = await generateReport({ ...base, allMeas: [], formulas, formulaValues: { f: 3 }, sections: { ...SECTIONS, cover: false } });
    expect(doc.internal.getNumberOfPages()).toBe(1);
  });

  it("prints current airway results with their references", async () => {
    const pts = { PNS: [1000, 1000], Ba: [500, 1000], Uvula: [800, 1300] };
    const markups = [
      ...Object.entries(pts).map(([k, [x, y]]) => ({ id: k, type: "point", label: k === "Uvula" ? "Uvula tip" : k, placed: true, visible: true, points: [{ x, y }] })),
      { id: "w", type: "curve", airwayRole: "wall", label: "Posterior pharyngeal wall", visible: true, points: [{ x: 700, y: 800 }, { x: 700, y: 1500 }] },
    ];
    const airway = computeAirway(markups, { done: true, pxPerMm: 10 }, { age: 30, sex: "F" });
    const without = await generateReport({ ...base, allMeas: angle, formulas: [], sections: SECTIONS });
    const doc = await generateReport({ ...base, allMeas: angle, formulas: [], airway, sections: SECTIONS });
    expect(doc.getNumberOfPages()).toBe(without.getNumberOfPages() + 1);
  });

  it("Go-Me alone from a non-airway case adds no airway page", async () => {
    const airway = { measurements: [{ id: "Mandibular-Body", label: "Mandibular Body Length", value: 78, unit: "mm" }] };
    const without = await generateReport({ ...base, allMeas: angle, formulas: [], sections: SECTIONS });
    const withBody = await generateReport({ ...base, allMeas: angle, formulas: [], airway, sections: SECTIONS });
    expect(withBody.getNumberOfPages()).toBe(without.getNumberOfPages());
  });

  it("live airway results add the airway page", async () => {
    const airway = { measurements: [{ id: "R-PAS", label: "R-PAS", value: 9, unit: "mm", normMean: 11, normSD: 2, zScore: -1, interpretation: "Borderline narrow", clinicalNote: null }] };
    const doc = await generateReport({ ...base, allMeas: angle, formulas: [], airway, sections: SECTIONS });
    expect(doc.internal.getNumberOfPages()).toBe(3);
  });
});

describe("PDF report — research studies and themes", () => {
  const pageText = doc => doc.internal.pages.slice(1).map(p => (Array.isArray(p) ? p.join("\n") : "")).join("\n");

  it("comparative and descriptive studies print their summary, methods and tables", async () => {
    const { runStudy } = await import("../research/engine.js");
    const { mkStudy } = await import("../research/studyModel.js");
    const { makeSession, lineMarkup } = await import("./helpers/cephFixtures.js");
    const a = [80, 82, 81, 83, 79, 82, 80, 81].map((v, i) => makeSession(`a${i}`, [lineMarkup("Co-A", v)]));
    const b = [86, 88, 85, 89, 87, 86, 90, 88].map((v, i) => makeSession(`b${i}`, [lineMarkup("Co-A", v)]));
    const sessions = [...a, ...b];
    const comp = runStudy(mkStudy("comparative", { name: "Class comparison", config: { groups: [{ id: "g1", label: "Class I", caseIds: a.map(s => s.id) }, { id: "g2", label: "Class II", caseIds: b.map(s => s.id) }], labelIds: [] } }), sessions, null);
    const desc = runStudy(mkStudy("descriptive", { name: "Sample description", config: { labelIds: [] } }), sessions, null);
    const archived = { ...desc, id: "arch", name: "Old study", archived: true };
    const project = { name: "Study case", meta: {}, sessions, researchStudies: [comp, desc, archived] };
    const doc = await generateReport({ project, session: sessions[0], allMeas: [], norms: [], formulas: [], save: false,
      sections: { cover: false, images: false, measurements: false, normograms: false, airway: false, research: true, formulas: false, interpretation: false } });
    const text = pageText(doc);
    expect(text).toContain("(Class comparison)");
    expect(text).toContain("(Sample description)");
    expect(text).not.toContain("(Old study)");
    expect(text).toMatch(/\(Summary\)/);
    expect(text).toMatch(/\(Methods\)/);
    expect(text).toMatch(/Class I/);
    expect(text).toMatch(/\(References\)/);
  });

  it("dark theme paints every page in the Plasticity background; light uses white", async () => {
    const meas = [{ m: { label: "SNA", type: "angle3", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] } }];
    const sections = { cover: true, images: false, measurements: true, normograms: false, airway: false, research: false, formulas: false, interpretation: false };
    const base = { project: { name: "Case", meta: {}, researchStudies: [] }, session: { name: "T0" }, allMeas: meas, norms: [], formulas: [], save: false, sections };
    const dark = await generateReport({ ...base, theme: "dark" });
    const darkFill = /0\.06 0\.06 0\.07 rg/; // #0f0f12
    for (const p of dark.internal.pages.slice(1)) expect(p.join("\n")).toMatch(darkFill);
    const light = await generateReport({ ...base, theme: "light" });
    expect(pageText(light)).not.toMatch(darkFill);
  });
});
