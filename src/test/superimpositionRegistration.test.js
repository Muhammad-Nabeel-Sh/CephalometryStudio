import { describe, it, expect } from "vitest";
import { runSuperimposition, procrustesAlign, findLandmark, registrationPoints, computeRotationTracking } from "../research/superimposition.js";
import { averageCeph, pointsToMarkups, mirrorMarkups } from "./helpers/cephFixtures.js";

// T2 = T1 grown by 8 % about Sella (pure size growth along every direction) plus
// a mandibular plane that has rotated open by 3° about Gonion.
function grownPair() {
  const P = averageCeph();
  const S = P.S;
  const T2 = {};
  for (const [k, p] of Object.entries(P)) T2[k] = { x: S.x + (p.x - S.x) * 1.08, y: S.y + (p.y - S.y) * 1.08 };
  const th = (3 * Math.PI) / 180, Go = T2.Go;
  for (const k of ["Me", "Gn", "Pog", "B", "Ii", "Iia"]) {
    const p = T2[k], dx = p.x - Go.x, dy = p.y - Go.y;
    T2[k] = { x: Go.x + dx * Math.cos(th) - dy * Math.sin(th), y: Go.y + dx * Math.sin(th) + dy * Math.cos(th) };
  }
  return { base: pointsToMarkups(P), compare: pointsToMarkups(T2) };
}

describe("landmark aliases", () => {
  it("finds Sella/Nasion under the app's S/N labels", () => {
    const { base } = grownPair();
    expect(findLandmark(base, "Sella")).toEqual(base.find(m => m.label === "S").points[0]);
    expect(registrationPoints(base, "SN_S")).not.toBeNull();
  });
});

describe("Procrustes does not scale away growth by default", () => {
  it("keeps size unless allowScale is set", () => {
    const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const dst = src.map(p => ({ x: p.x * 2, y: p.y * 2 }));
    expect(procrustesAlign(src, dst).scale).toBe(1);
    expect(procrustesAlign(src, dst, { allowScale: true }).scale).toBeCloseTo(2, 10);
  });
});

describe("S-N registration at S", () => {
  const { base, compare } = grownPair();
  const r = runSuperimposition(base, compare, { method: "registration", registration: "SN_S" });

  it("registers S exactly and reports real growth at N", () => {
    expect(r.error).toBeUndefined();
    const S = r.displacements.find(d => d.label === "S");
    const N = r.displacements.find(d => d.label === "N");
    expect(Math.hypot(S.dx, S.dy)).toBeLessThan(1e-6);
    // N moved outward by 8 % of S-N along the registered line.
    const P = averageCeph();
    const sn = Math.hypot(P.N.x - P.S.x, P.N.y - P.S.y);
    expect(Math.hypot(N.dx, N.dy)).toBeCloseTo(0.08 * sn, 3);
  });

  it("detects the mandibular plane opening, with the same sign on a mirrored film", () => {
    const rot = computeRotationTracking(base, compare, r.transform).find(x => x.id === "mandAngle");
    expect(rot).toBeDefined();
    expect(rot.deltaDeg).toBeGreaterThan(2);
    const mb = mirrorMarkups(base), mc = mirrorMarkups(compare);
    const rm = runSuperimposition(mb, mc, { method: "registration", registration: "SN_S" });
    const rotM = computeRotationTracking(mb, mc, rm.transform).find(x => x.id === "mandAngle");
    expect(rotM.deltaDeg).toBeCloseTo(rot.deltaDeg, 6);
  });

  it("reports which landmarks a preset needs when they are missing", () => {
    const noBa = base.filter(m => m.label !== "PT");
    const res = runSuperimposition(noBa, compare.filter(m => m.label !== "PT"), { method: "registration", registration: "BaN_CC" });
    expect(res.error).toMatch(/Ba, N, PT and Gn/);
  });
});
