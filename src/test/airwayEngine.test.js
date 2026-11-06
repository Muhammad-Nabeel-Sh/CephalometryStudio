import { describe, it, expect } from "vitest";
import { computeAirway, findLandmark, findWall, airwayNeeds, airwayResultsForDisplay, withAirwayMeasures, normalizeAge, normalizeSex, AIRWAY_NOTICE } from "../airway/compute.js";
import { AIRWAY_LANDMARKS, AIRWAY_MEASURES, AIRWAY_WALLS } from "../airway/definitions.js";
import { reference, REFERENCE_TABLES, SOURCES, skeletalClassFromAnb } from "../airway/norms.js";
import { closestBetween, closestOnPolyline, firstHit, lineHits, pointAtFraction, polygonArea, sectionBetween } from "../airway/geometry.js";
import { suggestWall } from "../airway/edges.js";
import { primaryMeasure } from "../lib/utils.js";
import { PREDEFINED } from "../data/constants.js";

const CAL = { done: true, pxPerMm: 10 };
const pt = (label, x, y) => ({ id: label, type: "point", label, placed: true, visible: true, points: [{ x, y }] });
const wall = (role, points) => ({ id: role, type: "curve", label: role, airwayRole: role, visible: true, points });

// A realistic adult case at 10 px/mm, facing right: straight walls with known distances.
const ADULT_POINTS = {
  S: [1070, 960], N: [1590, 800], A: [1680, 1350], B: [1585, 1670], ANS: [1660, 1310], PNS: [1280, 1310], Ba: [930, 1350],
  Go: [1050, 1620], Gn: [1580, 1860], Me: [1550, 1880], Uvula: [1080, 1570], MPA: [1200, 1430], Epi: [1060, 1850], Val: [1120, 1970], Hy: [1260, 2000],
};
const LABELS = { Uvula: "Uvula tip", Epi: "Epiglottis tip", Val: "Vallecula", Hy: "Hyoid" };
const adultMarkups = (extra = []) => [
  ...Object.entries(ADULT_POINTS).map(([k, [x, y]]) => pt(LABELS[k] || k, x, y)),
  wall("wall", [{ x: 960, y: 1200 }, { x: 960, y: 2100 }]),
  wall("softPalate", [{ x: 1280, y: 1310 }, { x: 1080, y: 1570 }]),
  wall("tongue", [{ x: 1120, y: 1500 }, { x: 1120, y: 2000 }]),
  ...extra,
];
const row = (res, id) => res.measurements.find(m => m.id === id);
const transform = (ms, f) => ms.map(m => ({ ...m, points: m.points.map(f) }));

describe("airway geometry", () => {
  it("finds closest points and distances on worked examples", () => {
    const line = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
    expect(closestOnPolyline({ x: 30, y: 40 }, line)).toMatchObject({ d: 30, at: 40 });
    expect(closestBetween([{ x: 10, y: 0 }, { x: 10, y: 50 }], line).d).toBe(10);
    expect(pointAtFraction(line, 0.25)).toEqual({ x: 0, y: 25 });
    expect(sectionBetween(line, 20, 40)).toEqual([{ x: 0, y: 20 }, { x: 0, y: 40 }]);
    expect(sectionBetween(line, 40, 20)).toEqual([{ x: 0, y: 40 }, { x: 0, y: 20 }]);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }])).toBe(200);
  });

  it("finds line crossings in order along the line", () => {
    const poly = [{ x: 5, y: -10 }, { x: 5, y: 10 }];
    expect(lineHits({ x: 0, y: 0 }, { x: 1, y: 0 }, poly)[0].point).toEqual({ x: 5, y: 0 });
    expect(firstHit({ x: 0, y: 0 }, { x: -1, y: 0 }, poly)).toBeNull();
  });
});

describe("airway constructions", () => {
  const res = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });

  it("computes hand-worked adult values", () => {
    expect(row(res, "mas").value).toBeCloseTo(12, 6);          // uvula x 1080 → wall x 960
    expect(row(res, "ias").value).toBeCloseTo(10, 6);          // epiglottis x 1060
    expect(row(res, "lpw").value).toBeCloseTo(16, 6);          // vallecula x 1120
    expect(row(res, "nl").value).toBeCloseTo(Math.hypot(320, 320 * 40 / 350) / 10, 4);
    expect(row(res, "pd").value).toBeCloseTo(32, 6);           // PNS along ANS-PNS to the wall
    expect(row(res, "pl").value).toBeCloseTo(Math.hypot(200, 260) / 10, 6);
    expect(row(res, "pas-min").value).toBeCloseTo(16 * Math.hypot(535, 50) / 535, 4);
  });

  it("measures McNamara's upper pharynx on the anterior half of the soft palate only", () => {
    // The palate approaches the wall towards the uvula, so the anterior half's closest
    // point is its midpoint (x 1180), not the uvula tip (x 1080).
    expect(row(res, "mcnamara-upper").value).toBeCloseTo(22, 6);
    expect(row(res, "spas").value).toBeCloseTo(22, 6);
  });

  it("gives the same result however the soft palate was drawn", () => {
    const reversed = adultMarkups().map(m => (m.airwayRole === "softPalate" ? { ...m, points: [...m.points].reverse() } : m));
    expect(row(computeAirway(reversed, CAL, { age: 30, sex: "F" }), "mcnamara-upper").value).toBeCloseTo(22, 6);
  });

  it("explains a measure a wall doesn't reach", () => {
    const short = adultMarkups().map(m => (m.airwayRole === "wall" ? { ...m, points: [{ x: 960, y: 1800 }, { x: 960, y: 2100 }] } : m));
    expect(row(computeAirway(short, CAL, { age: 30 }), "nl").interpretation).toMatch(/must cross/);
  });

  it("computes the Fujioka ratio", () => {
    const ms = [pt("Adenoid convexity", 50, 100), pt("Basiocciput 1", 0, 0), pt("Basiocciput 2", 0, 200), pt("PNS", 100, 300), pt("Synchondrosis", 100, 200)];
    expect(row(computeAirway(ms, CAL, { age: 8 }), "an-ratio").value).toBeCloseTo(0.5, 6);
  });
});

describe("airway invariance", () => {
  const base = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });
  const values = r => r.measurements.map(m => [m.id, m.value]);
  const same = (r) => values(r).forEach(([id, v], i) => {
    const b = values(base)[i][1];
    if (b === null) expect(v, id).toBeNull();
    else expect(v, id).toBeCloseTo(b, 4);
  });

  it("doesn't change with translation or rotation", () => {
    same(computeAirway(transform(adultMarkups(), p => ({ x: p.x + 123, y: p.y - 77 })), CAL, { age: 30, sex: "F" }));
    const a = 0.3, c = Math.cos(a), s = Math.sin(a);
    same(computeAirway(transform(adultMarkups(), p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c })), CAL, { age: 30, sex: "F" }));
  });

  it("doesn't change when mirrored, given the facing", () => {
    const mirrored = computeAirway(transform(adultMarkups(), p => ({ x: 3000 - p.x, y: p.y })), CAL, { age: 30, sex: "F", facing: "left" });
    same(mirrored);
    expect(mirrored.skeletalClass).toBe(base.skeletalClass);
  });

  it("doesn't change in mm with image scale", () => {
    same(computeAirway(transform(adultMarkups(), p => ({ x: p.x * 2, y: p.y * 2 })), { done: true, pxPerMm: 20 }, { age: 30, sex: "F" }));
  });

  it("isn't affected by unrelated markups or lookalike names", () => {
    const extra = [
      { id: "l", type: "line", label: "PNS", visible: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: "c", type: "curve", label: "Posterior Airway Boundary", visible: true, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
      { id: "u", type: "point", label: "PNS", placed: false, visible: true, points: [{ x: -99999, y: -99999 }] },
    ];
    same(computeAirway([...extra, ...adultMarkups()], CAL, { age: 30, sex: "F" }));
  });
});

describe("airway references", () => {
  it("transcribes the checked tables", () => {
    expect(reference.lookup("mcnamara-upper", { age: 30, sex: "F" })).toMatchObject({ mean: 17.4, sd: 3.4 });
    expect(reference.lookup("mcnamara-lower", { age: 30, sex: "M" })).toMatchObject({ mean: 13.5, sd: 4.3 });
    expect(reference.lookup("mislik-p", { age: 9, sex: "M" })).toMatchObject({ median: 7.24, iqr: 4.20, kind: "medianIqr" });
    expect(reference.lookup("mislik-t", { age: 17, sex: "F" })).toMatchObject({ median: 11.78, iqr: 5.09 });
    expect(reference.lookup("an-ratio", { age: 15 })).toMatchObject({ mean: 0.38, sd: 0.1533 });
    expect(reference.lookup("pns-ad1", { age: 12 })).toMatchObject({ mean: 26.155, sd: 2.633 });
    expect(reference.lookup("spas", { age: 30, skeletalClass: "III" })).toMatchObject({ mean: 11.25, sd: 3.07 });
  });

  it("every reference names its paper, table and sample", () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.cite).toBeTruthy();
      expect(s.full).toBeTruthy();
      expect(s.where).toMatch(/(Table|p\.)/);
      expect(s.sample).toBeTruthy();
    }
  });

  it("never gives a child an adult reference, or an adult a child's", () => {
    expect(reference.lookup("mcnamara-upper", { age: 12, sex: "F" }).reason).toMatch(/adults/);
    expect(reference.lookup("spas", { age: 12, skeletalClass: "I" }).reason).toMatch(/18/);
    expect(reference.lookup("mislik-p", { age: 30, sex: "F" }).reason).toMatch(/6–17/);
    expect(reference.lookup("pns-ad1", { age: 30 }).reason).toMatch(/6–12/);
    expect(reference.lookup("an-ratio", { age: 17 }).reason).toMatch(/16/);
  });

  it("says what's missing rather than guessing", () => {
    expect(reference.lookup("mislik-p", { age: null, sex: "F" }).reason).toMatch(/age/);
    expect(reference.lookup("mislik-p", { age: 10, sex: null }).reason).toMatch(/sex/);
    expect(reference.lookup("spas", { age: 30, skeletalClass: null }).reason).toMatch(/skeletal class/);
    expect(reference.lookup("area-retropalatal", { age: 30 }).reason).toMatch(/No published/);
  });

  it("marks the printed misprint and small groups", () => {
    const row125 = reference.lookup("an-ratio", { age: 12 });
    expect(row125.sd).toBeNull();
    expect(row125.warning).toMatch(/misprinted/);
    expect(reference.lookup("mislik-t", { age: 6, sex: "F" }).warning).toMatch(/11 children/);
  });

  it("uses the skeletal class definition from the paper", () => {
    expect(skeletalClassFromAnb(4.1)).toBe("II");
    expect(skeletalClassFromAnb(4)).toBe("I");
    expect(skeletalClassFromAnb(0)).toBe("I");
    expect(skeletalClassFromAnb(-0.1)).toBe("III");
    expect(skeletalClassFromAnb(null)).toBeNull();
  });

  it("has complete tables", () => {
    expect(REFERENCE_TABLES.FUJIOKA).toHaveLength(19);
    for (const t of Object.values(REFERENCE_TABLES.MISLIK)) expect(Object.keys(t)).toHaveLength(12);
    for (const t of Object.values(REFERENCE_TABLES.SFONDRINI)) expect(Object.keys(t)).toEqual(["I", "II", "III"]);
  });
});

describe("airway plausibility", () => {
  it("a realistic adult case stays near its references", () => {
    const res = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });
    for (const m of res.measurements) {
      if (m.zScore !== null) expect(Math.abs(m.zScore), m.id).toBeLessThan(4);
    }
    expect(res.measurements.filter(m => m.zScore !== null).length).toBeGreaterThanOrEqual(5);
  });

  it("each reference's own mean reads z = 0", () => {
    for (const id of Object.keys(REFERENCE_TABLES.SFONDRINI)) {
      const r = reference.lookup(id, { age: 30, skeletalClass: "I" });
      expect(r.mean).toBeGreaterThan(0);
      expect(r.sd).toBeGreaterThan(0);
      expect(r.mean / r.sd).toBeGreaterThan(1.5); // a width can't have SD larger than its size
    }
  });
});

describe("airway results", () => {
  it("shows the right measures for the patient's age", () => {
    const ids = age => computeAirway([], CAL, { age }).measurements.map(m => m.id);
    expect(ids(5)).toEqual(expect.arrayContaining(["an-ratio", "adenoid-area"]));
    expect(ids(5)).not.toContain("mislik-p");
    expect(ids(10)).toEqual(expect.arrayContaining(["an-ratio", "mislik-p", "mislik-t", "pns-ad1"]));
    expect(ids(15)).toEqual(expect.arrayContaining(["an-ratio", "mislik-p"]));
    expect(ids(15)).not.toContain("pns-ad1");
    expect(ids(30)).toEqual(expect.arrayContaining(["mcnamara-upper", "spas", "mph"]));
    expect(ids(30)).not.toContain("mislik-p");
    expect(ids(30)).not.toContain("an-ratio");
    expect(ids(null).length).toBe(AIRWAY_MEASURES.length);
  });

  it("reports children's widths as a typical range, with no z-score or flag", () => {
    const ms = [wall("softPalate", [{ x: 100, y: 0 }, { x: 100, y: 100 }]), wall("wall", [{ x: 0, y: 0 }, { x: 0, y: 100 }])];
    const r = row(computeAirway(ms, CAL, { age: 10, sex: "F" }), "mislik-p");
    expect(r.value).toBe(10);
    expect(r.zScore).toBeNull();
    expect(r.state).toBe("typical");
    expect(r.referenceText).toMatch(/Median 9.1/);
  });

  it("gives no comparison without calibration, or for a supine film", () => {
    expect(row(computeAirway(adultMarkups(), { done: false }, { age: 30, sex: "F" }), "mas")).toMatchObject({ unit: "px", zScore: null, interpretation: "Calibrate to compare" });
    expect(row(computeAirway(adultMarkups(), CAL, { age: 30, sex: "F", film: { posture: "supine" } }), "mas").interpretation).toMatch(/upright/);
  });

  it("uses ±2 SD for the states", () => {
    const res = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });
    for (const m of res.measurements) {
      if (m.zScore !== null) expect(m.state).toBe(Math.abs(m.zScore) <= 2 ? "within" : "outside");
    }
  });

  it("lists what a measure still needs", () => {
    const r = row(computeAirway([pt("PNS", 0, 0)], CAL, { age: 30 }), "nl");
    expect(r.value).toBeNull();
    expect(r.interpretation).toMatch(/Ba, Posterior pharyngeal wall/);
  });

  it("carries no OSA wording, risk score or diagnosis", () => {
    const res = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });
    expect(JSON.stringify(res)).not.toMatch(/\bOSA\b|apnea|\brisk\b/i);
    expect(AIRWAY_NOTICE).toMatch(/don't diagnose/);
  });

  it("states published cues as citations only when they apply", () => {
    const anMs = [pt("Adenoid convexity", 90, 100), pt("Basiocciput 1", 0, 0), pt("Basiocciput 2", 0, 200), pt("PNS", 100, 300), pt("Synchondrosis", 100, 200)];
    expect(computeAirway(anMs, CAL, { age: 8 }).cues[0].text).toMatch(/Fujioka 1979/);
    const narrow = [wall("softPalate", [{ x: 40, y: 0 }, { x: 40, y: 100 }]), wall("wall", [{ x: 0, y: 0 }, { x: 0, y: 100 }])];
    expect(computeAirway(narrow, CAL, { age: 10, sex: "F" }).cues[0].text).toMatch(/McNamara 1984/);
    // This case's lower pharynx is 16 mm, over McNamara's 15, and nothing else applies.
    expect(computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" }).cues.map(c => c.id)).toEqual(["lower"]);
  });

  it("suggests ENT evaluation only for two or more measures in the direction of concern", () => {
    const nasal = [
      pt("PNS", 1000, 1000), pt("Ba", 500, 1000), wall("wall", [{ x: 980, y: 900 }, { x: 980, y: 1100 }]),
      pt("Adenoid convexity", 900, 1000), pt("Basiocciput 1", 500, 800), pt("Basiocciput 2", 500, 1100), pt("Synchondrosis", 1000, 500),
    ];
    const res = computeAirway(nasal, CAL, { age: 8 });
    expect(res.pattern.text).toMatch(/Consider ENT evaluation if there are clinical signs/);
    expect(computeAirway(nasal, CAL, { age: 30 }).pattern).toBeNull();
    expect(computeAirway([pt("PNS", 0, 0)], CAL, { age: 8 }).pattern).toBeNull();
  });
});

describe("airway markup lookup", () => {
  it("finds landmarks from other analyses and the older template", () => {
    expect(findLandmark([pt("SP", 1, 2)], "Uvula")).toEqual({ x: 1, y: 2 });
    expect(findLandmark([pt("H", 1, 2)], "Hy")).toEqual({ x: 1, y: 2 });
    expect(findLandmark([{ ...pt("Renamed", 1, 2), templateLabel: "Ba" }], "Ba")).toEqual({ x: 1, y: 2 });
  });

  it("ignores unplaced, hidden and non-point markups", () => {
    expect(findLandmark([{ ...pt("Ba", 1, 2), placed: false }], "Ba")).toBeNull();
    expect(findLandmark([{ ...pt("Ba", 1, 2), visible: false }], "Ba")).toBeNull();
    expect(findLandmark([{ id: "l", type: "line", label: "Ba", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }], "Ba")).toBeNull();
  });

  it("finds walls by role, never by label", () => {
    const named = { id: "c", type: "curve", label: "Posterior pharyngeal wall", visible: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(findWall([named], "wall")).toBeNull();
    expect(findWall([wall("wall", named.points)], "wall")).toEqual(named.points);
  });

  it("lists needs by age", () => {
    const child = airwayNeeds(8), adult = airwayNeeds(30);
    expect(child.landmarks).toEqual(expect.arrayContaining(["Ac", "Bo1", "Sbs", "Ptm", "Ho"]));
    expect(child.adenoid).toBe(true);
    expect(adult.landmarks).toEqual(expect.arrayContaining(["Uvula", "Epi", "Val", "Hy", "MPA", "Gn"]));
    expect(adult.landmarks).not.toContain("Ac");
    expect(adult.walls).toEqual(Object.keys(AIRWAY_WALLS));
  });

  it("normalizes age and sex input", () => {
    expect(normalizeSex("Male")).toBe("M");
    expect(normalizeSex(" female")).toBe("F");
    expect(normalizeSex("x")).toBeNull();
    expect(normalizeAge("")).toBeNull();
    expect(normalizeAge("12")).toBe(12);
  });
});

describe("airway registry", () => {
  it("every measure's needs exist, and ids are unique", () => {
    const ids = AIRWAY_MEASURES.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of AIRWAY_MEASURES) {
      expect(m.method, m.id).toBeTruthy();
      for (const need of m.needs) expect(Boolean(AIRWAY_LANDMARKS[need] || AIRWAY_WALLS[need] || need === "adenoid"), need).toBe(true);
    }
  });

  it("the Airway template in the analysis list matches the registry", () => {
    const tpl = PREDEFINED.lateral.find(a => a.name === "Airway Analysis");
    expect(tpl.pts.map(p => p.l).sort()).toEqual(Object.values(AIRWAY_LANDMARKS).map(l => l.label).sort());
  });
});

describe("saved results from the older method", () => {
  it("keep values but lose comparisons, notes and removed measures", () => {
    const old = [
      { id: "N-PH", label: "N-PH", value: 73, normMean: 24.3, normSD: 3.6, normSource: "Solow 1985", zScore: 13.6, interpretation: "Wider than average" },
      { id: "MP-H", label: "MP-H", value: 20, normMean: 12.3, normSD: 3.5, zScore: 2.2, clinicalNote: "note" },
      { id: "Min-CSA", label: "Min", value: 12 }, { id: "Mandibular-Body", label: "Go-Me", value: 70 }, { id: "_global", label: "Summary", value: null },
    ];
    const shown = airwayResultsForDisplay(old);
    expect(shown.map(m => m.id)).toEqual(["N-PH", "MP-H"]);
    expect(shown[0]).toMatchObject({ value: 73, zScore: null, normMean: null });
    expect(shown[0].interpretation).toMatch(/older method/);
    expect(shown[1].clinicalNote).toBeUndefined();
  });

  it("leave current results unchanged", () => {
    const res = computeAirway(adultMarkups(), CAL, { age: 30, sex: "F" });
    expect(airwayResultsForDisplay(res.measurements)).toEqual(res.measurements);
  });
});

describe("airway values in research", () => {
  it("adds labelled values without changing the saved session", () => {
    const session = { id: "s", markups: adultMarkups(), calibration: CAL };
    const copy = withAirwayMeasures(session);
    expect(session.markups.some(m => m.type === "airwayValue")).toBe(false);
    const mas = copy.markups.find(m => m.id === "airway:mas");
    expect(mas.label).toBe("Airway MAS");
    expect(primaryMeasure(mas, CAL)).toEqual({ key: "value", value: expect.closeTo(12, 6), unit: "mm" });
  });

  it("leaves sessions with no airway values alone", () => {
    const s = { id: "s", markups: [pt("N", 0, 0)] };
    expect(withAirwayMeasures(s)).toBe(s);
  });
});

describe("edge-assisted suggestions", () => {
  // Air (dark, 30) from x = 100 to 200, tissue (bright, 200) elsewhere.
  const image = () => {
    const width = 300, height = 300, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = x >= 100 && x < 200 ? 30 : 200, i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    return { data, width, height };
  };
  const trace = (x) => [{ x, y: 40 }, { x, y: 150 }, { x, y: 260 }];

  it("moves the back wall onto the air edge behind it (facing right)", () => {
    const s = suggestWall(image(), trace(106), "wall");
    expect(s.foundFraction).toBeGreaterThan(0.9);
    s.points.forEach(p => expect(p.x).toBeCloseTo(100, -0.5));
  });

  it("moves the palate or tongue onto the edge in front of the air", () => {
    suggestWall(image(), trace(194), "tongue").points.forEach(p => expect(p.x).toBeCloseTo(200, -0.5));
  });

  it("looks for the opposite edge when the patient faces left", () => {
    suggestWall(image(), trace(194), "wall", { facing: "left" }).points.forEach(p => expect(p.x).toBeCloseTo(200, -0.5));
  });

  it("suggests nothing when there's no clear edge", () => {
    expect(suggestWall(image(), trace(150), "wall")).toBeNull();
    expect(suggestWall(null, trace(106), "wall")).toBeNull();
  });

  it("finds soft edges like a real film's, about 1 grey level per pixel", () => {
    const width = 300, height = 300, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Tissue 170, sloping down to air 60 between x = 80 and 180 (centre x = 130).
      const v = x < 80 ? 170 : x > 180 ? 60 : 170 - (x - 80) * 1.1, i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    const s = suggestWall({ data, width, height }, trace(125), "wall");
    expect(s).not.toBeNull();
    expect(s.foundFraction).toBeGreaterThan(0.9);
  });

  it("uses the film's scale", () => {
    // 2 px/mm reaches about 3 px, so an edge 6 px away is out of range.
    expect(suggestWall(image(), trace(106), "wall", { pxPerMm: 2 })).toBeNull();
    expect(suggestWall(image(), trace(102), "wall", { pxPerMm: 2 })).not.toBeNull();
  });

  it("isn't pulled out of line by a local bright spot", () => {
    const img = image();
    for (let y = 148; y < 153; y++) for (let x = 112; x < 118; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    }
    suggestWall(img, trace(106), "wall").points.forEach(p => expect(Math.abs(p.x - 100)).toBeLessThan(3));
  });
});
