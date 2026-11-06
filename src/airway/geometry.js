// ═══════════════════════════════════════════════════════════════════════════════
// Airway geometry — pure functions on points and polylines (image pixels).
// No labels, no React. Everything here is unchanged by rotation, translation or
// mirroring of the input, so the measures built on it are too.
// ═══════════════════════════════════════════════════════════════════════════════

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Closest point on segment ab to p; t is its position along the segment (0–1).
export function closestOnSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const point = lerp(a, b, t);
  return { point, t, d: dist(p, point) };
}

export function polylineLength(poly) {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += dist(poly[i - 1], poly[i]);
  return len;
}

// Closest point on a polyline; `at` is its arc length from the first point.
export function closestOnPolyline(p, poly) {
  if (!poly?.length) return null;
  if (poly.length === 1) return { point: poly[0], d: dist(p, poly[0]), at: 0 };
  let best = null, along = 0;
  for (let i = 1; i < poly.length; i++) {
    const c = closestOnSegment(p, poly[i - 1], poly[i]);
    const seg = dist(poly[i - 1], poly[i]);
    if (!best || c.d < best.d) best = { point: c.point, d: c.d, at: along + c.t * seg };
    along += seg;
  }
  return best;
}

// Shortest distance between two polylines, with the two points that achieve it.
export function closestBetween(polyA, polyB) {
  if (!polyA?.length || !polyB?.length) return null;
  let best = null;
  const take = (a, b, d) => { if (!best || d < best.d) best = { a, b, d }; };
  for (const p of polyA) { const c = closestOnPolyline(p, polyB); take(p, c.point, c.d); }
  for (const p of polyB) { const c = closestOnPolyline(p, polyA); take(c.point, p, c.d); }
  return best;
}

// Point at a fraction (0–1) of a polyline's arc length.
export function pointAtFraction(poly, fraction) {
  const target = polylineLength(poly) * fraction;
  let along = 0;
  for (let i = 1; i < poly.length; i++) {
    const seg = dist(poly[i - 1], poly[i]);
    if (along + seg >= target) return lerp(poly[i - 1], poly[i], seg === 0 ? 0 : (target - along) / seg);
    along += seg;
  }
  return poly[poly.length - 1];
}

// The part of a polyline between two arc lengths, in the direction from → to.
export function sectionBetween(poly, from, to) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const out = [];
  let along = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i], seg = dist(a, b);
    if (along + seg >= lo && along <= hi && seg > 0) {
      const t0 = Math.max(0, (lo - along) / seg), t1 = Math.min(1, (hi - along) / seg);
      if (!out.length) out.push(lerp(a, b, t0));
      out.push(lerp(a, b, t1));
    }
    along += seg;
  }
  return from <= to ? out : out.reverse();
}

// Foot of the perpendicular from p onto the infinite line through a and b.
export function footOnLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// Crossings of the infinite line origin→through with a polyline, sorted along the
// line. `t` is the position in units of |through − origin| (negative = behind origin).
export function lineHits(origin, through, poly) {
  const dx = through.x - origin.x, dy = through.y - origin.y;
  if ((dx === 0 && dy === 0) || !poly?.length) return [];
  const hits = [];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = dx * ey - dy * ex;
    if (den === 0) continue;
    const t = ((a.x - origin.x) * ey - (a.y - origin.y) * ex) / den;
    const u = ((a.x - origin.x) * dy - (a.y - origin.y) * dx) / den;
    if (u >= 0 && u <= 1) hits.push({ t, point: { x: origin.x + t * dx, y: origin.y + t * dy } });
  }
  return hits.sort((p, q) => p.t - q.t);
}

// First crossing ahead of `origin`, beyond tMin.
export function firstHit(origin, through, poly, tMin = 1e-9) {
  return lineHits(origin, through, poly).find(h => h.t > tMin) || null;
}

export function polygonArea(poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}
