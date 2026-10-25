// ═══════════════════════════════════════════════════════════════════════════════
// Measurement conventions — patient-facing frame + signed cephalometric geometry
//
// Image coordinates know nothing about anatomy: a film can show the profile
// facing right or left. Every signed cephalometric value (ANB, Wits, E-line,
// convexity, U1-NA mm, …) is therefore computed in a PATIENT FRAME where
// +x = anterior and +y = inferior (image y stays downward). The frame is the
// image itself for a right-facing profile and its mirror for a left-facing one,
// so every value is mirror-invariant.
//
// Sign conventions (documented once, used everywhere):
//   • Signed distance to a line — positive = ANTERIOR of the line when the line
//     is closer to vertical than horizontal, positive = SUPERIOR otherwise.
//   • Projected distance (Wits) — (first − second) projected on the line,
//     positive when the first point is ANTERIOR (or SUPERIOR for a vertical line).
//   • Signed 3-point angle (ANB, A-N-Pog) — positive when the first ray points
//     anterior of the second.
//   • Convexity angle (Downs N-A-Pog) — 180° − ∠ at the middle point, positive
//     when the middle point lies anterior of the line joining the outer points.
//   • AB-plane angle (Downs) — angle of AB to the facial plane N-Pog, negative
//     when B lies posterior to A.
//
// Pure module (no imports) so lib/utils.js can depend on it without cycles.
// ═══════════════════════════════════════════════════════════════════════════════

const DEG = 180 / Math.PI;

// (posterior, anterior) landmark pairs used to infer which way the profile faces,
// most reliable first.
const FACING_PAIRS = [
  ["S", "N"], ["Po", "Or"], ["Ba", "N"], ["PNS", "ANS"], ["Ar", "Pog"],
  ["Go", "Pog"], ["Go", "Me"], ["Sn", "Prn"], ["Ar", "N"],
];

function validPoint(m) {
  const p = m?.points?.[0];
  return m?.type === "point" && m.placed !== false && p && p.x > -9000 && isFinite(p.x) && isFinite(p.y) ? p : null;
}

// "right" | "left" | null — inferred from labelled landmarks.
export function inferFacing(markups) {
  if (!Array.isArray(markups) || markups.length === 0) return null;
  const byLabel = {};
  for (const m of markups) {
    const p = validPoint(m);
    if (!p) continue;
    for (const k of [m.templateLabel, m.label]) if (k && !byLabel[k]) byLabel[k] = p;
  }
  for (const [post, ant] of FACING_PAIRS) {
    const a = byLabel[post], b = byLabel[ant];
    if (a && b && Math.abs(b.x - a.x) > 1e-6) return b.x > a.x ? "right" : "left";
  }
  return null;
}

// Session setting ("auto" | "right" | "left") → concrete facing. Defaults to
// "right", the conventional orientation of a lateral cephalogram.
export function resolveFacing(setting, markups) {
  if (setting === "left" || setting === "right") return setting;
  return inferFacing(markups) || "right";
}

export function sessionFacing(session) {
  return resolveFacing(session?.facing, session?.markups);
}

const fx = (facing) => (facing === "left" ? -1 : 1);
const toFrame = (p, facing) => ({ x: p.x * fx(facing), y: p.y });

// Unit vector oriented anterior (lines closer to horizontal) or superior.
function orientAlong(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { x: dx, y: dy } : { x: -dx, y: -dy };
  return dy <= 0 ? { x: dx, y: dy } : { x: -dx, y: -dy };
}

// Signed perpendicular distance of `pt` from line a–b (in image px).
export function signedPerpDist(pt, a, b, facing = "right") {
  const P = toFrame(pt, facing), A = toFrame(a, facing), B = toFrame(b, facing);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return 0;
  // Normal to the line; oriented anterior for near-vertical lines, superior otherwise.
  const n = orientAlong(-dy, dx);
  return ((P.x - A.x) * n.x + (P.y - A.y) * n.y) / len;
}

// Signed distance between the projections of ptA and ptB on line l1–l2.
export function signedProjection(ptA, ptB, l1, l2, facing = "right") {
  const A = toFrame(ptA, facing), B = toFrame(ptB, facing);
  const L1 = toFrame(l1, facing), L2 = toFrame(l2, facing);
  const len = Math.hypot(L2.x - L1.x, L2.y - L1.y);
  if (len < 1e-9) return 0;
  const u = orientAlong(L2.x - L1.x, L2.y - L1.y);
  return ((A.x - B.x) * u.x + (A.y - B.y) * u.y) / len;
}

// Signed angle at vtx, positive when ray vtx→p1 lies anterior of ray vtx→p2.
export function signedAngle3(p1, vtx, p2, facing = "right") {
  const P1 = toFrame(p1, facing), V = toFrame(vtx, facing), P2 = toFrame(p2, facing);
  const u = { x: P1.x - V.x, y: P1.y - V.y }, w = { x: P2.x - V.x, y: P2.y - V.y };
  return Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y) * DEG;
}

// Downs-style angle of convexity: 180° − ∠(p0, mid, p2), signed by whether `mid`
// is anterior of the p0–p2 line. Independent of the order of the outer points.
export function convexityAngle(p0, mid, p2, facing = "right") {
  const u = { x: p0.x - mid.x, y: p0.y - mid.y }, w = { x: p2.x - mid.x, y: p2.y - mid.y };
  const interior = Math.abs(Math.atan2(u.x * w.y - u.y * w.x, u.x * w.x + u.y * w.y)) * DEG;
  const side = signedPerpDist(mid, p0, p2, facing);
  return (180 - interior) * (side < 0 ? -1 : 1);
}

// Downs AB-plane angle: angle between A→B and the facial plane N→Pog, negative
// when B is posterior to A. Both lines are oriented downward first, so the
// result does not depend on the order the points were given in.
export function abPlaneAngle(a, b, n, pog, facing = "right") {
  const A = toFrame(a, facing), B = toFrame(b, facing), N = toFrame(n, facing), P = toFrame(pog, facing);
  const down = (v) => (v.y < 0 ? { x: -v.x, y: -v.y } : v);
  const f = down({ x: P.x - N.x, y: P.y - N.y });
  const ab = down({ x: B.x - A.x, y: B.y - A.y });
  return -Math.atan2(f.x * ab.y - f.y * ab.x, f.x * ab.x + f.y * ab.y) * DEG;
}

// ─── Registry: which named measurements carry which convention ─────────────
// Keyed by the measurement's template name (`m.measure`, falling back to label).
const ANGLE3_CONVENTIONS = {
  "ANB": "signed", "A-N-B": "signed",
  "Convexity": "signed",               // A-N-Pog at N (Basis, Cagliari, Chieti, McGann)
  "Angle of convexity": "convexity",   // Downs N-A-Pog, Harvold
  "Mandibular arc": "supplement",      // Ricketts: 180° − ∠DC-Xi-PM
  "Facial convexity": "convexity",     // 180° − ∠G-Sn-Pog' (soft tissue) / N-A-Pog (COGS)
};
const ANGLE4_CONVENTIONS = {
  "AB plane angle": "abPlane", "AB plane": "abPlane",
};
// Landmark that must sit at the vertex for a convention; lets legacy markups
// saved with the old reference order still compute the right angle.
const CONVENTION_VERTEX = { "Angle of convexity": ["A", "ANS"], "Mandibular arc": ["Xi"], "Facial convexity": ["Sn", "sn", "A"] };

export function measureName(m) {
  return m?.measure || m?.templateLabel || m?.label || "";
}

export function angle3Convention(m) {
  return ANGLE3_CONVENTIONS[measureName(m)] || null;
}

export function angle4Convention(m) {
  const conv = ANGLE4_CONVENTIONS[measureName(m)] || null;
  // Only the Downs definition (AB vs facial plane) is signed; markups saved with
  // the old AB-vs-FH reference keep the unsigned line angle.
  if (conv === "abPlane" && Array.isArray(m.refLabels) && m.refLabels.length === 4) {
    const ref = m.refLabels.slice(2).map(String);
    if (!(ref.includes("N") && ref.some(r => r.startsWith("Pog")))) return null;
  }
  return conv;
}

// Template-defined perpendicular distances are signed (every predefined one is
// an anterior/posterior measure); free-hand perps stay unsigned unless opted in.
export function isSignedPerp(m) {
  if (m?.signed === true) return true;
  if (m?.signed === false) return false;
  return Boolean(m?.measure);
}

// Reorder 3 points so the convention's vertex landmark sits in the middle.
export function orderForVertex(m, pts) {
  const want = CONVENTION_VERTEX[measureName(m)];
  if (!want || !Array.isArray(m.refLabels) || m.refLabels.length !== 3) return pts;
  const idx = m.refLabels.findIndex(l => want.includes(l));
  if (idx < 0 || idx === 1) return pts;
  const others = [0, 1, 2].filter(i => i !== idx);
  return [pts[others[0]], pts[idx], pts[others[1]]];
}
