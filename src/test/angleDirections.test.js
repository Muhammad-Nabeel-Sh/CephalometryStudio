// Angles near 90° can be reversed (θ vs 180° − θ) and still pass the mean-skull
// plausibility test, so each is checked here by moving one landmark the way the
// literature describes and checking the value moves the way the published
// definition says. This caught the facial angle family, the facial axis and IMPA
// reporting their supplements (fixed 2026-11).
import { describe, it, expect } from "vitest";
import { averageCeph, pointsToMarkups, mirrorMarkups } from "./helpers/cephFixtures.js";
import { autoCreateMeasurements } from "../workspace/template.js";
import { primaryMeasure } from "../lib/utils.js";

const BASE = averageCeph();
const PPM = Math.hypot(BASE.N.x - BASE.S.x, BASE.N.y - BASE.S.y) / 71; // S-N ≈ 71 mm
// Ba and PT aren't in the shape model: placed where they sit on a typical film.
BASE.Ba = { x: BASE.S.x - 10 * PPM, y: BASE.S.y + 38 * PPM };
BASE.PT = { x: BASE.PNS.x - 2 * PPM, y: BASE.PNS.y - 15 * PPM };
const CAL = { done: true, pxPerMm: PPM };

// The value of `label` in `analysis` with landmark `moved` shifted by (dx, dy) mm
// (x anterior, y down, for this right-facing skull).
function value(analysis, label, moved = null, dx = 0, dy = 0, mirror = false) {
  const P = { ...BASE };
  if (moved) P[moved] = { x: P[moved].x + dx * PPM, y: P[moved].y + dy * PPM };
  let pts = pointsToMarkups(P);
  if (mirror) pts = mirrorMarkups(pts);
  const m = autoCreateMeasurements(pts, analysis, CAL).find((x) => x.label === label);
  expect(m, `${analysis} › ${label}`).toBeTruthy();
  return primaryMeasure(m, CAL, { facing: mirror ? "left" : "right" }).value;
}

// [analysis, label, landmark, dx, dy, expected direction, why]
const CASES = [
  ["Downs Analysis", "Facial depth", "Pog", 3, 0, +1, "a more prominent chin raises the facial angle"],
  ["Ricketts Analysis", "Facial depth", "Pog", 3, 0, +1, "a more prominent chin raises facial depth"],
  ["Lautrou Analysis", "Facial angle", "Pog", 3, 0, +1, "a more prominent chin raises the facial angle"],
  ["Gugino Analysis", "Maxillary depth", "A", 3, 0, +1, "a more anterior A raises maxillary depth"],
  ["COGS Analysis", "Mandibular depth", "B", 3, 0, +1, "a more anterior B raises mandibular depth"],
  ["Ricketts Analysis", "Facial axis", "Gn", 4, 0, +1, "a more forward chin (horizontal growth) raises the facial axis above 90°"],
  ["Tweed Analysis", "IMPA", "Ii", 3, 0, +1, "proclining the lower incisor raises IMPA"],
  ["Tweed Analysis", "FMIA", "Ii", 3, 0, -1, "proclining the lower incisor lowers FMIA"],
  ["Kim Analysis", "APDI", "B", 3, 0, +1, "a more anterior mandible (Class III) raises APDI"],
  ["Kim Analysis", "ODI", "ANS", 0, -2, -1, "a palatal plane tilted up anteriorly lowers ODI (open-bite tendency)"],
  ["Kim Analysis", "ODI", "Me", 0, -3, +1, "a flatter mandibular plane raises ODI (deep-bite tendency)"],
];

describe("angle directions follow the published definitions", () => {
  for (const [analysis, label, lm, dx, dy, dir, why] of CASES) {
    it(`${analysis} › ${label}: ${why}`, () => {
      const before = value(analysis, label);
      const after = value(analysis, label, lm, dx, dy);
      expect(Math.sign(after - before)).toBe(dir);
      expect(Math.abs(after - before)).toBeGreaterThan(0.2);
    });
  }

  it("gives the same values on a mirrored (left-facing) image", () => {
    for (const [analysis, label] of CASES) {
      expect(value(analysis, label, null, 0, 0, true), `${analysis} › ${label}`).toBeCloseTo(value(analysis, label), 6);
    }
  });

  it("keeps the Tweed triangle closed: FMA + IMPA + FMIA = 180°", () => {
    const sum = value("Tweed Analysis", "FMA") + value("Tweed Analysis", "IMPA") + value("Tweed Analysis", "FMIA");
    expect(sum).toBeCloseTo(180, 6);
  });

  it("gives APDI as facial angle + A-B plane angle ± palatal plane angle (Kim & Vietas 1978)", () => {
    const deg = 180 / Math.PI, up = (p, q) => Math.atan2(-(q.y - p.y), q.x - p.x) * deg;
    const tilt = up(BASE.PNS, BASE.ANS) - up(BASE.Po, BASE.Or); // + = palatal plane up anteriorly
    const apdi = value("Downs Analysis", "Facial depth") + value("Downs Analysis", "AB plane angle") - tilt;
    expect(value("Kim Analysis", "APDI")).toBeCloseTo(apdi, 6);
  });
});
