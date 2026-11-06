import { describe, it, expect } from "vitest";
import {
  computeAirwayMeasurements,
  lookupAirwayNorm,
  generateAirwayBoundaries,
  sampleBoundaryAtY,
  findNarrowestPoint,
  sampleCatmullRom,
  coreLandmarksComplete,
  findPt,
  AIRWAY_MEASUREMENTS,
  AIRWAY_LANDMARKS_CORE,
  AIRWAY_LANDMARKS_ADVANCED,
  airwayResultsForDisplay,
  AIRWAY_REVISION_NOTICE,
} from "../research/airway.js";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function makeMarkup(label, x, y) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "point",
    label,
    points: [{ x, y }],
    visible: true,
    placed: true,
  };
}

function makeCalibration(pxPerMm) {
  return { done: true, pxPerMm };
}

const CAL = makeCalibration(10);
const NO_CAL = { done: false };

// ═══════════════════════════════════════════════════════════════════════════════
// TIER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

describe("Airway landmark tiers", () => {
  it("core landmarks count is 10", () => {
    expect(AIRWAY_LANDMARKS_CORE).toHaveLength(10);
  });

  it("advanced landmarks count is 9", () => {
    expect(AIRWAY_LANDMARKS_ADVANCED).toHaveLength(9);
  });

  it("advanced landmarks include SP_mid, Ad2, Ad4", () => {
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("SP_mid");
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("Ad2");
    expect(AIRWAY_LANDMARKS_ADVANCED).toContain("Ad4");
  });

  it("core landmarks and advanced landmarks are disjoint", () => {
    const overlap = AIRWAY_LANDMARKS_CORE.filter(l => AIRWAY_LANDMARKS_ADVANCED.includes(l));
    expect(overlap).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Airway measurement definitions", () => {
  it("has 5 core measurements", () => {
    const core = AIRWAY_MEASUREMENTS.filter(m => m.tier === "core");
    expect(core).toHaveLength(5);
  });

  it("has 10 advanced measurements", () => {
    const adv = AIRWAY_MEASUREMENTS.filter(m => m.tier === "advanced");
    expect(adv).toHaveLength(10);
  });

  it("has no SPAS or Soft-Palate-Angle measurements", () => {
    expect(AIRWAY_MEASUREMENTS.find(m => m.id === "SPAS")).toBeUndefined();
    expect(AIRWAY_MEASUREMENTS.find(m => m.id === "Soft-Palate-Angle")).toBeUndefined();
  });

  it("R-PAS is a core measurement", () => {
    const rpas = AIRWAY_MEASUREMENTS.find(m => m.id === "R-PAS");
    expect(rpas).toBeDefined();
    expect(rpas.tier).toBe("core");
  });

  it("R-RG is an advanced measurement", () => {
    const rrg = AIRWAY_MEASUREMENTS.find(m => m.id === "R-RG");
    expect(rrg).toBeDefined();
    expect(rrg.tier).toBe("advanced");
  });

  it("SP-AW is an advanced measurement", () => {
    const sp = AIRWAY_MEASUREMENTS.find(m => m.id === "SP-AW");
    expect(sp).toBeDefined();
    expect(sp.tier).toBe("advanced");
  });

  it("every measurement has required fields", () => {
    for (const m of AIRWAY_MEASUREMENTS) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(["length", "area"]).toContain(m.type);
      expect(Array.isArray(m.points)).toBe(true);
      expect(m.points.length).toBeGreaterThanOrEqual(2);
      expect(m.tier === "core" || m.tier === "advanced").toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// coreLandmarksComplete
// ═══════════════════════════════════════════════════════════════════════════════

describe("coreLandmarksComplete", () => {
  it("returns false with empty markups", () => {
    expect(coreLandmarksComplete([])).toBe(false);
  });

  it("returns false with partial core landmarks", () => {
    const markups = AIRWAY_LANDMARKS_CORE.slice(0, 5).map(l => makeMarkup(l, 100, 200));
    expect(coreLandmarksComplete(markups)).toBe(false);
  });

  it("returns true when all core landmarks are placed", () => {
    const markups = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 10, 200 + i * 10));
    expect(coreLandmarksComplete(markups)).toBe(true);
  });

  it("returns false if a core landmark is invisible", () => {
    const markups = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 10, 200 + i * 10));
    markups[0].visible = false;
    expect(coreLandmarksComplete(markups)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findPt
// ═══════════════════════════════════════════════════════════════════════════════

describe("findPt", () => {
  it("finds a point by label", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const pt = findPt(markups, "PNS");
    expect(pt).toEqual({ x: 100, y: 200 });
  });

  it("is case-insensitive", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const pt = findPt(markups, "pns");
    expect(pt).toEqual({ x: 100, y: 200 });
  });

  it("returns null for missing label", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    expect(findPt(markups, "N")).toBeNull();
  });

  it("skips invisible markups", () => {
    const m = makeMarkup("PNS", 100, 200);
    m.visible = false;
    expect(findPt([m], "PNS")).toBeNull();
  });

  it("uses ptMap when provided", () => {
    const markups = [makeMarkup("PNS", 100, 200)];
    const ptMap = new Map([["pns", markups[0]]]);
    const pt = findPt(markups, "PNS", ptMap);
    expect(pt).toEqual({ x: 100, y: 200 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// lookupAirwayNorm
// ═══════════════════════════════════════════════════════════════════════════════

describe("lookupAirwayNorm", () => {
  it("uses the adult norm for adults", () => {
    expect(lookupAirwayNorm("MP-H", 30).mean).toBe(12.3);
    expect(lookupAirwayNorm("MP-H", 30).source).toMatch(/not yet verified/);
  });

  it("never gives a child the adult norm", () => {
    expect(lookupAirwayNorm("MP-H", 5)).toBeNull();
    expect(lookupAirwayNorm("MP-H", 17)).toBeNull();
    expect(lookupAirwayNorm("SP-Length", 12)).toBeNull();
  });

  it("has no norm when the age is unknown", () => {
    expect(lookupAirwayNorm("MP-H")).toBeNull();
    expect(lookupAirwayNorm("MP-H", "")).toBeNull();
  });

  it("has no norm for measures under review or unknown ones", () => {
    for (const id of ["N-PH", "R-PAS", "R-RG", "SP-AW", "PNS-AD1", "PNS-AD2", "MAS", "IAS", "Tongue-Length", "Oropharyngeal-Depth", "Pharyngeal-Area", "NONEXISTENT"]) {
      expect(lookupAirwayNorm(id, 30)).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeAirwayMeasurements
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeAirwayMeasurements", () => {
  const allCore = AIRWAY_LANDMARKS_CORE.map((l, i) => makeMarkup(l, 100 + i * 20, 200 + i * 30));

  it("returns empty for null/invalid input", () => {
    expect(computeAirwayMeasurements(null, CAL)).toEqual([]);
    expect(computeAirwayMeasurements("bad", CAL)).toEqual([]);
  });

  it("returns core measurements with values when only core landmarks placed", () => {
    const results = computeAirwayMeasurements(allCore, CAL, 30);
    const withValues = results.filter(r => r.value !== null && r.id !== "_global" && r.id !== "_magnification");
    expect(withValues.length).toBeGreaterThanOrEqual(5);
    const ids = withValues.map(r => r.id);
    expect(ids).toContain("N-PH");
    expect(ids).toContain("MP-H");
    expect(ids).toContain("SP-Length");
    expect(ids).toContain("Tongue-Length");
    expect(ids).not.toContain("R-RG");
    expect(ids).not.toContain("SP-AW");
    expect(ids).not.toContain("PNS-AD1");
    expect(ids).not.toContain("PNS-AD2");
    expect(ids).not.toContain("MAS");
    expect(ids).not.toContain("IAS");
  });

  it("all core measurements show Missing landmarks when landmarks absent", () => {
    const results = computeAirwayMeasurements([], CAL);
    const meas = results.filter(r => r.id !== "_global" && r.id !== "_magnification");
    for (const r of meas) {
      expect(r.interpretation).toBe("Missing landmarks");
      expect(r.value).toBeNull();
    }
  });

  it("computes N-PH distance correctly", () => {
    const markups = [
      makeMarkup("N", 100, 100),
      makeMarkup("PH", 100, 343),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const nph = results.find(r => r.id === "N-PH");
    expect(nph).toBeDefined();
    expect(nph.value).toBeCloseTo(24.3, 0);
    expect(nph.unit).toBe("mm");
    expect(nph.zScore).toBeNull();
    expect(nph.interpretation).toBe("Reference under review");
  });

  it("skips z-score when not calibrated", () => {
    const markups = [
      makeMarkup("N", 100, 100),
      makeMarkup("PH", 100, 343),
    ];
    const results = computeAirwayMeasurements(markups, NO_CAL);
    const nph = results.find(r => r.id === "N-PH");
    expect(nph.zScore).toBeNull();
    expect(nph.unit).toBe("px");
    expect(nph.interpretation).toContain("Calibration required");
  });

  it("includes magnification disclaimer when calibrated", () => {
    const results = computeAirwayMeasurements(allCore, CAL);
    const mag = results.find(r => r.id === "_magnification");
    expect(mag).toBeDefined();
    expect(mag.label).toContain("magnification");
  });

  it("no magnification disclaimer when not calibrated", () => {
    const results = computeAirwayMeasurements(allCore, NO_CAL);
    const mag = results.find(r => r.id === "_magnification");
    expect(mag).toBeUndefined();
  });

  it("MP-H computes perpendicular distance", () => {
    const markups = [
      makeMarkup("H", 200, 300),
      makeMarkup("Go", 100, 500),
      makeMarkup("Me", 400, 500),
    ];
    const results = computeAirwayMeasurements(markups, CAL);
    const mph = results.find(r => r.id === "MP-H");
    expect(mph).toBeDefined();
    expect(mph.value).toBeGreaterThan(0);
    expect(mph.unit).toBe("mm");
  });

  it("returns all results with tier property", () => {
    const results = computeAirwayMeasurements(allCore, CAL);
    for (const r of results) {
      expect(["core", "advanced", undefined]).toContain(r.tier);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeAirwayRiskScore — directional z-scores
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("sampleBoundaryAtY", () => {
  it("returns null for insufficient points", () => {
    expect(sampleBoundaryAtY([], 100)).toBeNull();
    expect(sampleBoundaryAtY([{ x: 0, y: 0 }], 100)).toBeNull();
  });

  it("interpolates correctly on a vertical line", () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    const result = sampleBoundaryAtY(pts, 50);
    expect(result).not.toBeNull();
    expect(result.x).toBe(0);
    expect(result.y).toBe(50);
  });

  it("returns null for y outside range", () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    expect(sampleBoundaryAtY(pts, -10)).toBeNull();
    expect(sampleBoundaryAtY(pts, 110)).toBeNull();
  });
});

describe("findNarrowestPoint", () => {
  it("finds narrowest width between two vertical walls", () => {
    const ant = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    const post = [{ x: 20, y: 0 }, { x: 10, y: 100 }];
    const result = findNarrowestPoint(ant, post, 0, 100, 10);
    expect(result).not.toBeNull();
    expect(result.y).toBe(100);
    expect(result.width).toBeCloseTo(10, 0);
  });

  it("returns null for insufficient points", () => {
    expect(findNarrowestPoint([], [{ x: 0, y: 0 }], 0, 100, 10)).toBeNull();
  });
});

describe("sampleCatmullRom", () => {
  it("returns empty for null/empty input", () => {
    expect(sampleCatmullRom(null)).toEqual([]);
    expect(sampleCatmullRom([])).toEqual([]);
  });

  it("returns 2 points as linear interpolation", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const result = sampleCatmullRom(pts, 5);
    expect(result.length).toBe(5);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[4]).toEqual({ x: 100, y: 100 });
  });

  it("smooths multi-point curves", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const result = sampleCatmullRom(pts, 20);
    expect(result.length).toBeGreaterThan(3);
    expect(result[0]).toEqual({ x: 0, y: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateAirwayBoundaries
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateAirwayBoundaries", () => {
  it("returns null for empty markups", () => {
    expect(generateAirwayBoundaries([], null)).toBeNull();
  });

  it("generates boundaries when anterior landmarks available", () => {
    const markups = [
      makeMarkup("PNS", 100, 100),
      makeMarkup("SP", 120, 200),
      makeMarkup("TT", 110, 400),
    ];
    const result = generateAirwayBoundaries(markups, null);
    expect(result).not.toBeNull();
    expect(result.anterior.length).toBeGreaterThan(0);
  });

  it("generates boundaries when posterior landmarks available", () => {
    const markups = [
      makeMarkup("Ad1", 300, 100),
      makeMarkup("Ad2", 310, 200),
      makeMarkup("Ad3", 320, 300),
    ];
    const result = generateAirwayBoundaries(markups, null);
    expect(result).not.toBeNull();
    expect(result.posterior.length).toBeGreaterThan(0);
  });

  it("returns null when fewer than 2 points per boundary type", () => {
    const markups = [makeMarkup("PNS", 100, 100)];
    expect(generateAirwayBoundaries(markups, null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICAL NOTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Phase 0 safety", () => {
  const pts = [
    makeMarkup("N", 1590, 800), makeMarkup("PH", 900, 1050), makeMarkup("PNS", 1280, 1310), makeMarkup("SP", 1080, 1570),
    makeMarkup("Ad1", 1060, 1330), makeMarkup("Ad2", 1050, 1180), makeMarkup("Ad3", 920, 1500), makeMarkup("Eb", 1100, 1950),
    makeMarkup("PAS_lowest", 920, 1850), makeMarkup("Epiglottis", 1060, 1850), makeMarkup("Vallecula", 1120, 1970), makeMarkup("Ad4", 920, 1970),
    makeMarkup("TT", 1600, 1800), makeMarkup("H", 1260, 2120), makeMarkup("Go", 1050, 1620), makeMarkup("Me", 1550, 1880),
  ];
  const real = rs => rs.filter(r => !r.id.startsWith("_"));

  it("no result carries a clinical note, summary row or OSA wording", () => {
    const rs = computeAirwayMeasurements(pts, CAL, 30);
    expect(rs.find(r => r.id === "_global")).toBeUndefined();
    expect(rs.find(r => r.id === "Min-CSA")).toBeUndefined();
    expect(rs.filter(r => r.clinicalNote)).toHaveLength(0);
    expect(JSON.stringify(rs)).not.toMatch(/\bOSA\b|apnea/i);
  });

  it("the implausible N-PH comparison is gone, and its value remains", () => {
    const nph = computeAirwayMeasurements(pts, CAL, 30).find(r => r.id === "N-PH");
    expect(nph.value).toBeGreaterThan(50);
    expect(nph.zScore).toBeNull();
    expect(nph.normMean).toBeNull();
    expect(nph.interpretation).toBe("Reference under review");
  });

  it("only measures with a remaining reference have a z-score", () => {
    const withZ = real(computeAirwayMeasurements(pts, CAL, 30)).filter(r => r.zScore !== null).map(r => r.id).sort();
    expect(withZ).toEqual(["MP-H", "SP-Length"]);
  });

  it("says why there is no comparison", () => {
    const noAge = computeAirwayMeasurements(pts, CAL, null).find(r => r.id === "MP-H");
    expect(noAge.zScore).toBeNull();
    expect(noAge.interpretation).toMatch(/age/);
    const young = computeAirwayMeasurements(pts, CAL, 5).find(r => r.id === "MP-H");
    expect(young.zScore).toBeNull();
    expect(young.interpretation).toMatch(/No reference for this age/);
  });

  it("generated or traced curves don't change any measurement", () => {
    const before = real(computeAirwayMeasurements(pts, CAL, 30));
    const b = generateAirwayBoundaries(pts, null);
    const curves = [
      { id: "a", type: "curve", label: "Anterior Airway Boundary", points: b.anterior, visible: true },
      { id: "p", type: "curve", label: "Posterior Airway Boundary", points: b.posterior, visible: true },
    ];
    const after = real(computeAirwayMeasurements([...pts, ...curves], CAL, 30));
    expect(after.map(r => [r.id, r.value])).toEqual(before.map(r => [r.id, r.value]));
  });

  it("the generated anterior wall stays out of the mouth", () => {
    const b = generateAirwayBoundaries(pts, null);
    expect(Math.max(...b.anterior.map(p => p.x))).toBeLessThan(1400); // TT is at x = 1600
  });

  it("saved results follow the current rules", () => {
    const old = [
      { id: "N-PH", label: "N-PH", value: 73, normMean: 24.3, normSD: 3.6, normSource: "Solow 1985", zScore: 13.6, interpretation: "Wider than average" },
      { id: "R-PAS", label: "R-PAS", value: 4, normMean: 11.2, normSD: 2.4, zScore: -3, interpretation: "Narrow", clinicalNote: "strong OSA screening indicator" },
      { id: "Min-CSA", label: "Min", value: 12, zScore: -2 },
      { id: "MP-H", label: "MP-H", value: 20, normMean: 12.3, normSD: 3.5, zScore: 2.2, interpretation: "Increased", clinicalNote: "associated with OSA" },
      { id: "_global", label: "Summary", value: null, interpretation: "comprehensive evaluation" },
    ];
    const shown = airwayResultsForDisplay(old);
    expect(shown.map(m => m.id)).toEqual(["N-PH", "R-PAS", "MP-H"]);
    expect(shown[0]).toMatchObject({ value: 73, zScore: null, normMean: null, interpretation: "Reference under review" });
    expect(shown[2].zScore).toBe(2.2);
    expect(JSON.stringify(shown)).not.toMatch(/OSA/);
  });

  it("the notice doesn't claim a diagnosis", () => {
    expect(AIRWAY_REVISION_NOTICE).toMatch(/don't diagnose/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NORM DIRECTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Airway norms that remain", () => {
  it("are marked as not yet verified, and belong to a measurement", () => {
    const remaining = ["MP-H", "SP-Length"];
    for (const id of remaining) {
      expect(AIRWAY_MEASUREMENTS.some(m => m.id === id)).toBe(true);
      expect(lookupAirwayNorm(id, 30).source).toMatch(/not yet verified/);
    }
  });
});
