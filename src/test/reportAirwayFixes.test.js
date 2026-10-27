import { describe, it, expect } from "vitest";
import {
  computeAirwayMeasurements, getInterpretation, normalizeSex, normalizeAge, lookupAirwayNorm,
  tracedBoundaries, areaBetweenBoundaries, autoSnapBoundary,
} from "../research/airway.js";
import { measurementRows, needsUnicodeFont, generateReport } from "../report/reportGenerator.js";
import { reportScale, printLabelScale, REPORT_IMAGE_MAX } from "../canvas/imageLayers.js";

const pt = (label, x, y) => ({ id: label, type: "point", label, points: [{ x, y }], visible: true, placed: true });
const curve = (label, pts) => ({ id: label, type: "curve", label, points: pts, visible: true });
const CAL = { done: true, pxPerMm: 10 };

describe("airway — clinical notes need calibration", () => {
  it("pixel values never trigger mm thresholds", () => {
    // MP-H ≈ 200 px and a soft palate ≈ 400 px: far above 15 mm / 35 mm if read as mm.
    const ms = [pt("H", 300, 500), pt("Go", 100, 300), pt("Me", 500, 300), pt("PNS", 0, 0), pt("SP", 0, 400)];
    const res = computeAirwayMeasurements(ms, { done: false });
    expect(res.filter(r => r.clinicalNote)).toHaveLength(0);
    const cal = computeAirwayMeasurements(ms, CAL);
    expect(cal.find(r => r.id === "MP-H").clinicalNote).toMatch(/hyoid/i); // 20 mm
  });
});

describe("airway — wording follows the pathological direction", () => {
  it("widths, hyoid/soft palate and neutral sizes", () => {
    expect(getInterpretation(-2.5, "R-PAS")).toBe("Narrow");
    expect(getInterpretation(2.5, "R-PAS")).toBe("Wider than average");
    expect(getInterpretation(2.5, "MP-H")).toBe("Increased");
    expect(getInterpretation(1.5, "SP-Length")).toBe("Borderline increased");
    expect(getInterpretation(-2.5, "MP-H")).toBe("Below average");
    expect(getInterpretation(-1.5, "Tongue-Length")).toBe("Below average");
    expect(getInterpretation(0.4, "Tongue-Length")).toBe("Normal");
  });
});

describe("airway — sex and age for stratified norms", () => {
  it("accepts M/F/Male/Female and treats an empty age as unknown", () => {
    expect(normalizeSex("Male")).toBe("M");
    expect(normalizeSex(" female")).toBe("F");
    expect(normalizeSex("x")).toBe(null);
    expect(normalizeAge("")).toBe(null);
    expect(normalizeAge("12")).toBe(12);
    expect(lookupAirwayNorm("R-PAS", "Male", "10").mean).toBe(10.5);
    expect(lookupAirwayNorm("R-PAS", "female", 13).mean).toBe(10.2);
    expect(lookupAirwayNorm("R-PAS", "Male", "")).toMatchObject({ mean: lookupAirwayNorm("R-PAS").mean });
  });
});

describe("airway — traced walls feed the measurements", () => {
  // Anterior wall at x = 100; posterior wall at x = 140 except a waist at y = 150 (x = 120).
  const anterior = curve("Anterior Airway Boundary", [{ x: 100, y: 0 }, { x: 100, y: 150 }, { x: 100, y: 300 }]);
  const posterior = curve("Posterior Airway Boundary", [{ x: 140, y: 0 }, { x: 120, y: 150 }, { x: 140, y: 300 }]);
  const lm = [pt("PNS", 90, 40), pt("SP", 95, 220), pt("Ad3", 140, 220), pt("Eb", 95, 290), pt("PAS_lowest", 140, 290)];

  it("R-PAS is the narrowest width between the walls at the retropalatal level", () => {
    const res = computeAirwayMeasurements([...lm, anterior, posterior], CAL);
    const rpas = res.find(r => r.id === "R-PAS");
    expect(rpas.basis).toBe("traced boundary");
    expect(rpas.value).toBeCloseTo(2.0, 1); // 20 px at the waist = 2.0 mm
  });

  it("without walls the landmark method is used", () => {
    const rpas = computeAirwayMeasurements(lm, CAL).find(r => r.id === "R-PAS");
    expect(rpas.basis).toBe("landmarks");
  });

  it("area between walls integrates their horizontal distance", () => {
    const tb = tracedBoundaries([anterior, posterior]);
    expect(tb).not.toBe(null);
    const rect = areaBetweenBoundaries([{ x: 0, y: 0 }, { x: 0, y: 100 }], [{ x: 30, y: 0 }, { x: 30, y: 100 }], 0, 100);
    expect(rect).toBeCloseTo(3000, 6);
  });

  it("straight template lines are not mistaken for walls", () => {
    const line = { id: "l", type: "line", label: "Tongue posture", points: [{ x: 0, y: 0 }, { x: 0, y: 10 }] };
    expect(tracedBoundaries([line, posterior])).toBe(null);
  });
});

describe("airway — edge snapping", () => {
  const img = (w, h, f) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y), i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
    return { data, width: w, height: h };
  };
  it("moves to a nearby edge, stays put on a flat image", () => {
    const edge = img(100, 100, x => (x < 50 ? 30 : 220));
    const snapped = autoSnapBoundary(edge, [{ x: 44, y: 50 }]);
    expect(Math.abs(snapped[0].x - 50)).toBeLessThanOrEqual(1);
    const flat = img(100, 100, () => 120);
    expect(autoSnapBoundary(flat, [{ x: 44, y: 50 }])[0]).toEqual({ x: 44, y: 50 });
  });
});

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
