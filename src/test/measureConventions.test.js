import { describe, it, expect } from "vitest";
import { computeMeasurements, primaryMeasure } from "../lib/utils.js";
import {
  inferFacing, resolveFacing, signedPerpDist, signedProjection, signedAngle3,
  convexityAngle, abPlaneAngle,
} from "../lib/measureConventions.js";
import { PREDEFINED } from "../data/constants.js";
import { autoCreateMeasurements } from "../workspace/template.js";
import { generateInterpretation } from "../lib/interpretation.js";
import { averageCeph, pointsToMarkups, mirrorMarkups, pointMarkup } from "./helpers/cephFixtures.js";

const CAL = { done: true, pxPerMm: 1 };
const R = { facing: "right" };

// Every lateral analysis' auto-created measurements on the mean Aariz skull.
function averageCephMeasurements() {
  const P = averageCeph();
  const ppm = Math.hypot(P.N.x - P.S.x, P.N.y - P.S.y) / 71; // S-N ≈ 71 mm
  const points = pointsToMarkups(P);
  const out = [];
  for (const a of PREDEFINED.lateral) {
    for (const m of autoCreateMeasurements(points, a.name, { done: true, pxPerMm: ppm })) out.push({ analysis: a.name, m });
  }
  return { points, ppm, out };
}

describe("facing inference", () => {
  it("infers right/left from posterior→anterior landmark pairs", () => {
    expect(inferFacing([pointMarkup("S", 100, 100), pointMarkup("N", 300, 90)])).toBe("right");
    expect(inferFacing([pointMarkup("S", 300, 100), pointMarkup("N", 100, 90)])).toBe("left");
    expect(inferFacing([pointMarkup("Po", 300, 100), pointMarkup("Or", 120, 110)])).toBe("left");
    expect(inferFacing([pointMarkup("X", 1, 1)])).toBeNull();
  });

  it("explicit session setting wins; unknown defaults to right", () => {
    const ms = [pointMarkup("S", 300, 100), pointMarkup("N", 100, 90)];
    expect(resolveFacing("auto", ms)).toBe("left");
    expect(resolveFacing("right", ms)).toBe("right");
    expect(resolveFacing(undefined, [])).toBe("right");
  });

  it("the mean Aariz skull faces right", () => {
    expect(inferFacing(pointsToMarkups(averageCeph()))).toBe("right");
  });
});

describe("signed geometry on known configurations (right-facing)", () => {
  it("Wits: AO 2 mm ahead of BO is +2 (Class II), regardless of plane point order", () => {
    const A = { x: 620, y: 300 }, B = { x: 600, y: 420 }, APOcc = { x: 600, y: 350 }, PPOcc = { x: 400, y: 350 };
    expect(signedProjection(A, B, APOcc, PPOcc, "right")).toBeCloseTo(20, 9);
    expect(signedProjection(A, B, PPOcc, APOcc, "right")).toBeCloseTo(20, 9);
    const wits = { type: "projDist", label: "A-B distance", measure: "A-B distance", points: [A, B, APOcc, PPOcc] };
    expect(computeMeasurements(wits, { done: true, pxPerMm: 10 }, R).projectedDistance).toBeCloseTo(2, 9);
  });

  it("E-line: a lip behind the Prn-Pog' line is negative; in front is positive", () => {
    const Prn = { x: 760, y: 250 }, PogS = { x: 680, y: 520 };
    const behind = { type: "perp", label: "Upper lip to E-plane", measure: "Upper lip to E-plane", points: [Prn, PogS, { x: 700, y: 380 }] };
    const ahead = { ...behind, points: [Prn, PogS, { x: 760, y: 380 }] };
    expect(computeMeasurements(behind, CAL, R).distance).toBeLessThan(0);
    expect(computeMeasurements(ahead, CAL, R).distance).toBeGreaterThan(0);
    // Reference-point order does not change the sign.
    expect(computeMeasurements({ ...behind, points: [PogS, Prn, { x: 700, y: 380 }] }, CAL, R).distance)
      .toBeCloseTo(computeMeasurements(behind, CAL, R).distance, 9);
  });

  it("free-hand perpendicular distances stay unsigned", () => {
    const m = { type: "perp", label: "Perp 1", points: [{ x: 500, y: 0 }, { x: 500, y: 100 }, { x: 480, y: 50 }] };
    expect(computeMeasurements(m, CAL, R).distance).toBeCloseTo(20, 9);
  });

  it("near-horizontal reference lines: positive = superior", () => {
    expect(signedPerpDist({ x: 50, y: 40 }, { x: 0, y: 50 }, { x: 100, y: 50 }, "right")).toBeCloseTo(10, 9);
  });

  it("ANB: positive when A is anterior to B, negative for Class III", () => {
    const N = { x: 0, y: 0 };
    expect(signedAngle3({ x: 10, y: 100 }, N, { x: 0, y: 200 }, "right")).toBeGreaterThan(0);
    expect(signedAngle3({ x: -10, y: 100 }, N, { x: 0, y: 200 }, "right")).toBeLessThan(0);
  });

  it("Downs angle of convexity: convex positive, concave negative, outer-point order irrelevant", () => {
    const N = { x: 0, y: 0 }, Pog = { x: 0, y: 200 };
    const convex = convexityAngle(N, { x: 10, y: 100 }, Pog, "right");
    expect(convex).toBeGreaterThan(0);
    expect(convexityAngle(Pog, { x: 10, y: 100 }, N, "right")).toBeCloseTo(convex, 9);
    expect(convexityAngle(N, { x: -10, y: 100 }, Pog, "right")).toBeLessThan(0);
  });

  it("Downs AB-plane angle: negative when B is posterior to A", () => {
    const N = { x: 0, y: 0 }, Pog = { x: 0, y: 300 };
    const normal = abPlaneAngle({ x: 10, y: 120 }, { x: 0, y: 220 }, N, Pog, "right");
    const classII = abPlaneAngle({ x: 10, y: 120 }, { x: -15, y: 220 }, N, Pog, "right");
    const classIII = abPlaneAngle({ x: 10, y: 120 }, { x: 20, y: 220 }, N, Pog, "right");
    expect(normal).toBeLessThan(0);
    expect(classII).toBeLessThan(normal);
    expect(classIII).toBeGreaterThan(0);
  });

  it("Ricketts mandibular arc is 180° − ∠DC-Xi-PM, also for legacy Xi,PM,DC markups", () => {
    const DC = { x: 0, y: -100 }, Xi = { x: 0, y: 0 }, PM = { x: 100 * Math.sin(2.7), y: -100 * Math.cos(2.7) };
    const interior = 2.7 * 180 / Math.PI;
    const m = { type: "angle3", label: "Mandibular arc", measure: "Mandibular arc", refLabels: ["DC", "Xi", "PM"], points: [DC, Xi, PM] };
    expect(computeMeasurements(m, CAL, R).angle).toBeCloseTo(180 - interior, 6);
    const legacy = { ...m, refLabels: ["Xi", "PM", "DC"], points: [Xi, PM, DC] };
    expect(computeMeasurements(legacy, CAL, R).angle).toBeCloseTo(180 - interior, 6);
  });
});

describe("primaryMeasure", () => {
  it("never returns coordinates; points have no measurement", () => {
    expect(primaryMeasure(pointMarkup("S", 10, 20), CAL)).toBeNull();
    const line = { type: "line", label: "L", points: [{ x: 0, y: 0 }, { x: 30, y: 40 }] };
    expect(primaryMeasure(line, { done: true, pxPerMm: 5 })).toEqual({ key: "length", value: 10, unit: "mm" });
    expect(primaryMeasure(line, { done: false })).toEqual({ key: "length", value: 50, unit: "px" });
    const ang = { type: "angle3", label: "SNA", points: [{ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }] };
    expect(primaryMeasure(ang, CAL)).toEqual({ key: "angle", value: 90, unit: "°" });
    expect(primaryMeasure({ type: "line", mode: "infinite", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, CAL)).toBeNull();
  });
});

describe("every predefined lateral measurement", () => {
  const { points, ppm, out } = averageCephMeasurements();
  const cal = { done: true, pxPerMm: ppm };

  it("covers the core analyses", () => {
    const names = new Set(out.map(o => o.analysis));
    for (const a of ["Steiner Analysis", "Ricketts Analysis", "McNamara Analysis", "Downs Analysis", "Tweed Analysis", "Jarv-Bjork", "Wits Analysis"]) {
      expect(names.has(a)).toBe(true);
    }
  });

  it("is mirror-invariant: a left-facing film of the same patient gives the same values", () => {
    const mirrored = mirrorMarkups(points);
    const facingL = { facing: resolveFacing("auto", mirrored) };
    expect(facingL.facing).toBe("left");
    for (const { analysis, m } of out) {
      const mm = autoCreateMeasurements(mirrored, analysis, cal).find(x => x.label === m.label);
      const a = primaryMeasure(m, cal, R);
      const b = mm && primaryMeasure(mm, cal, facingL);
      if (!a) continue;
      expect(b, `${analysis} › ${m.label}`).toBeTruthy();
      expect(b.value, `${analysis} › ${m.label}`).toBeCloseTo(a.value, 6);
    }
  });

  it("is invariant to rotating and translating the film", () => {
    const th = (8 * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const moved = points.map(p => ({ ...p, points: p.points.map(q => ({ x: c * q.x - s * q.y + 250, y: s * q.x + c * q.y - 120 })) }));
    for (const { analysis, m } of out) {
      const mm = autoCreateMeasurements(moved, analysis, cal).find(x => x.label === m.label);
      const a = primaryMeasure(m, cal, R);
      if (!a) continue;
      // Signed distances to near-horizontal vs near-vertical lines only flip
      // orientation when a line crosses 45°; none of the predefined ones do at 8°.
      expect(primaryMeasure(mm, cal, R).value, `${analysis} › ${m.label}`).toBeCloseTo(a.value, 6);
    }
  });

  it("is plausible: the mean skull falls within 4 SD of every norm", () => {
    const outliers = [];
    for (const { analysis, m } of out) {
      if (!m.norm) continue;
      const pm = primaryMeasure(m, cal, R);
      if (!pm) continue;
      const z = (pm.value - m.norm.mean) / m.norm.sd;
      if (Math.abs(z) > 4) outliers.push(`${analysis} › ${m.label}: ${pm.value.toFixed(1)} vs ${m.norm.mean}±${m.norm.sd}`);
    }
    // Catches reversed reference order (θ vs 180−θ) and wrong definitions.
    expect(outliers).toEqual([]);
  });
});

describe("interpretation uses the signed conventions", () => {
  const interp = (label, measureType, value, mean, sd) =>
    generateInterpretation([{ m: { label }, meas: { [measureType]: value, _unit: "mm" } }], [{ markupLabel: label, measureType, mean, sd }], CAL)
      .deviations[0].interpretation;

  it("lips 2 mm behind the E-line are normal; 2 mm ahead are protrusive", () => {
    expect(interp("Upper lip to E-plane", "distance", -2, -2, 2)).toMatch(/within normal range/);
    expect(interp("Upper lip to E-plane", "distance", 2.5, -2, 2)).toMatch(/protrusive/);
  });

  it("Wits (A-B distance) +4 mm is Class II, −4 mm Class III", () => {
    expect(interp("A-B distance", "projectedDistance", 4, 0, 2)).toMatch(/Class II/);
    expect(interp("A-B distance", "projectedDistance", -4, 0, 2)).toMatch(/Class III/);
  });

  it("a more negative AB-plane angle is Class II", () => {
    expect(interp("AB plane angle", "angle", -12, -4.6, 3.7)).toMatch(/Class II/);
    expect(interp("AB plane angle", "angle", 3, -4.6, 3.7)).toMatch(/Class III/);
  });
});

describe("every normed lateral definition in the CSV (alternative landmark names mapped)", () => {
  // Analyses spell landmarks differently (s, Isi, Pogonion, "Point B", GN…).
  const ALIAS = { s: "S", Isi: "Is", Isa: "Ia", Iii: "Ii", Pogonion: "Pog", "Point B": "B", PG: "Pog", GN: "Gn", M: "Me", Orbitale: "Or", "Pg'": "Pog'", Li: "LL", Ls: "UL" };
  it("evaluates within 4 SD of its norm on the mean skull", () => {
    const P = averageCeph();
    const cal = { done: true, pxPerMm: Math.hypot(P.N.x - P.S.x, P.N.y - P.S.y) / 71 };
    const outliers = [];
    let checked = 0;
    for (const a of PREDEFINED.lateral) {
      for (const d of a.measurements || []) {
        if (!d.norm || !["angle3", "angle4", "perp", "projDist", "line"].includes(d.type)) continue;
        const refs = d.pts.map(r => ALIAS[r] ?? r);
        const pts = refs.map(r => P[r]);
        if (pts.some(p => !p)) continue;
        const pm = primaryMeasure({ type: d.type, label: d.l, measure: d.l, points: pts, refLabels: refs }, cal, R);
        if (!pm) continue;
        checked++;
        const z = (pm.value - d.norm.mean) / d.norm.sd;
        if (Math.abs(z) > 4) outliers.push(`${a.name} › ${d.l}: ${pm.value.toFixed(1)} vs ${d.norm.mean}±${d.norm.sd}`);
      }
    }
    expect(checked).toBeGreaterThan(80);
    expect(outliers).toEqual([]);
  });
});
