import { describe, it, expect } from "vitest";
import {
  generateReport, reportFileName, calibrationStatement, comparisonRows, reportableStudies, needsUnicodeFont,
} from "../report/reportGenerator.js";
import { angleMarkup, lineMarkup, pointMarkup } from "./helpers/cephFixtures.js";

const pageText = doc => doc.internal.pages.slice(1).map(p => (Array.isArray(p) ? p.join("\n") : "")).join("\n");
const NONE = { cover: false, images: false, measurements: false, normograms: false, airway: false, research: false, formulas: false, interpretation: false };
const CAL = { done: true, pxPerMm: 1, knownMm: "50" };
const base = { project: { name: "Case 7", meta: {}, sessions: [], researchStudies: [] }, session: { label: "T0", name: "Pre-treatment" }, norms: [], formulas: [], save: false };

describe("PDF report — identity on every page", () => {
  it("dated file name, document properties and the case on inner pages", async () => {
    expect(reportFileName("Case 7: A/B", new Date(2026, 0, 5))).toBe("Case_7_AB_2026-01-05_report.pdf");
    const sna = angleMarkup("SNA", 82);
    const doc = await generateReport({ ...base, allMeas: [{ m: sna }], markups: [sna], calibration: CAL, sections: { ...NONE, cover: true, measurements: true } });
    expect(doc._fileName).toMatch(/^Case_7_\d{4}-\d{2}-\d{2}_report\.pdf$/);
    expect(doc.output()).toContain("/Title (Cephalometric report: Case 7)");
    const inner = doc.internal.pages[2].join("\n");
    expect(inner).toContain("(Case 7)");
    expect(inner).toContain("(T0 · Pre-treatment)");
  });

  it("bookmarks list each section", async () => {
    const sna = angleMarkup("SNA", 82);
    const doc = await generateReport({ ...base, allMeas: [{ m: sna }], markups: [sna], calibration: CAL, formulas: [{ id: "f", name: "F", expression: "1" }], formulaValues: { f: 1 }, sections: { ...NONE, cover: true, measurements: true, formulas: true } });
    const titles = doc.outline.root.children.map(n => n.title);
    expect(titles).toEqual(["Cover", "Measurements", "Custom formulas"]);
  });

  it("clinic name on the cover and in the header", async () => {
    const doc = await generateReport({ ...base, allMeas: [], formulas: [{ id: "f", name: "F", expression: "1" }], formulaValues: { f: 1 }, clinic: { name: "North Clinic" }, sections: { ...NONE, cover: true, formulas: true } });
    expect(doc.internal.pages[1].join("\n")).toContain("(North Clinic)");
    expect(doc.internal.pages[2].join("\n")).toContain("(North Clinic)");
  });
});

describe("PDF report — measurements", () => {
  it("states the calibration and its caveats", () => {
    expect(calibrationStatement({ done: false })).toMatch(/pixels/);
    const s = calibrationStatement({ done: true, pxPerMm: 10, knownMm: "20" }, "lateral");
    expect(s).toMatch(/ruler of 20 mm/);
    expect(s).toMatch(/10\.00 px\/mm/);
    expect(s).toMatch(/magnification/);
  });

  it("lists AI provenance and flags unreviewed landmarks", async () => {
    const pts = [
      pointMarkup("S", 10, 10),
      pointMarkup("N", 50, 10, { aiPlaced: true, aiReviewed: false, aiConfidence: 0.3 }),
      pointMarkup("A", 60, 40, { aiPlaced: true, aiReviewed: true, aiAdjusted: true }),
    ];
    const sna = angleMarkup("SNA", 82);
    const doc = await generateReport({ ...base, allMeas: [{ m: sna }], markups: [...pts, sna], calibration: CAL, sections: { ...NONE, measurements: true } });
    const text = pageText(doc);
    // jsPDF escapes parentheses inside text strings.
    expect(text).toContain("1 manually, 2 by AI \\(0 reviewed as placed, 1 adjusted, 1 not reviewed\\)");
    expect(text).toContain("(Landmark provenance)");
    expect(text).toContain("(AI, NOT reviewed \\(confidence 30%\\))");
  });

  it("groups the table by category and gives norms their unit", async () => {
    const sna = angleMarkup("SNA", 82), len = lineMarkup("Co-A", 85);
    const norms = [{ markupLabel: "SNA", measureType: "angle", mean: 82, sd: 3.5 }, { markupLabel: "Co-A", measureType: "length", mean: 90, sd: 4 }];
    const doc = await generateReport({ ...base, norms, allMeas: [{ m: sna }, { m: len }], markups: [sna, len], calibration: CAL, sections: { ...NONE, measurements: true } });
    const text = pageText(doc);
    expect(text).toContain("(SKELETAL)");
    expect(text).toMatch(/\(90\.00 mm ± 4\.0\)/);
    expect(text).toMatch(/\(82\.0° ± 3\.5\)/);
  });
});

describe("PDF report — session comparison", () => {
  it("pairs measurements by label and skips uncalibrated distances", () => {
    const cur = [angleMarkup("SNA", 84), lineMarkup("Co-A", 90)];
    const prev = { markups: [angleMarkup("SNA", 80), lineMarkup("Co-A", 85)], calibration: { done: false } };
    const rows = comparisonRows(cur, CAL, "right", prev);
    expect(rows.map(r => r.label)).toEqual(["SNA"]);
    expect(rows[0].change).toBeCloseTo(4, 5);
  });

  it("adds a comparison section and comparison markers", async () => {
    const sna = angleMarkup("SNA", 84);
    const compare = { label: "T1", name: "Post", markups: [angleMarkup("SNA", 80)], calibration: CAL };
    const doc = await generateReport({ ...base, allMeas: [{ m: sna }], markups: [sna], calibration: CAL, compare, sections: { ...NONE, measurements: true } });
    const text = pageText(doc);
    expect(text).toContain("(Session comparison)");
    expect(text).toMatch(/\(\+4\.0°\)/);
  });
});

describe("PDF report — research selection and charts", () => {
  const studies = [
    { id: "a", name: "Alpha", type: "descriptive", results: { ok: true } },
    { id: "b", name: "Beta", type: "descriptive", results: { ok: true } },
    { id: "c", name: "Gamma", type: "descriptive", results: { ok: true }, archived: true },
    { id: "d", name: "Delta", type: "descriptive", results: { error: "x" } },
  ];
  it("includes only chosen studies with results", () => {
    expect(reportableStudies({ researchStudies: studies }).map(s => s.id)).toEqual(["a", "b"]);
    expect(reportableStudies({ researchStudies: studies }, ["b", "c"]).map(s => s.id)).toEqual(["b"]);
  });
});

describe("PDF report — text", () => {
  it("Greek in statistics needs the Unicode font; Latin-1 does not", () => {
    expect(needsUnicodeFont("partial η² = 0.12")).toBe(true);
    expect(needsUnicodeFont("SNA 82.0° ± 3.5")).toBe(false);
  });
});

describe("PDF report — formulas", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const formulas = [
    { id: "a", name: "Ratio", latex: String.raw`\frac{S\text{-}Go}{N\text{-}Me}`, expression: "SGo / NMe * 100", unit: "%" },
    { id: "b", name: "Sum", expression: "SNA + SNB" },
  ];

  it("draws each formula as a typeset equation with its value, not a table", async () => {
    const calls = [];
    const renderLatex = async (tex) => { calls.push(tex); return { dataUrl: PNG, w: 400, h: 80 }; };
    const formulaTex = expr => String.raw`\mathrm{${expr}}`;
    const doc = await generateReport({ ...base, allMeas: [], formulas, formulaValues: { a: 64.2, b: 160 }, renderLatex, formulaTex, sections: { ...NONE, formulas: true } });
    expect(calls).toEqual([formulas[0].latex, String.raw`\mathrm{SNA + SNB}`]);
    const text = pageText(doc);
    expect(text).toContain("(= 64.20 %)");
    expect(text).toContain("(= 160.00)");
    expect(text).toContain("(Computed as: SGo / NMe * 100)");
    expect(text).not.toContain("(Expression)");
    expect(doc.output()).toContain("/Subtype /Image");
  });

  it("falls back to the expression as large text when it cannot be typeset", async () => {
    const doc = await generateReport({ ...base, allMeas: [], formulas: [formulas[1]], formulaValues: {}, sections: { ...NONE, formulas: true } });
    const text = pageText(doc);
    expect(text).toContain("(SNA + SNB)");
    expect(text).toContain("(= N/A)");
  });

  it("typesets an expression once the formula engine has loaded", async () => {
    const { loadFormulaEngine, formulaTex } = await import("../lib/utils.js");
    await loadFormulaEngine();
    expect(formulaTex("SNA - SNB + U1_SN * pi")).toBe(String.raw`\mathrm{SNA}-\mathrm{SNB}+\mathrm{U1\_SN}\cdot\pi`);
    expect(formulaTex("(")).toBeNull();
  }, 60000); // first import of mathjs can be slow under a full parallel run
});
