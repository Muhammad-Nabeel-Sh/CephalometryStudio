// ═══════════════════════════════════════════════════════════════════════════════
// Realistic cephalometric test fixtures
//
// Research tests must exercise the markups real studies contain (angles, lines,
// signed distances) — not bare points, whose coordinates are not measurements.
// `averageCeph()` is the mean CEPHA29 (Aariz, n = 700) shape from the shipped
// shape prior, i.e. an anatomically plausible right-facing cephalogram.
// ═══════════════════════════════════════════════════════════════════════════════

import shape from "../../data/shapeModel.cepha29.json";
import { CEPHA29 } from "../../data/landmarkMap.js";

let _seq = 0;
const nextId = (p) => `${p}_${++_seq}`;

export function makeSession(id, markups, opts = {}) {
  return {
    id, markups,
    calibration: { done: true, pxPerMm: 1 },
    meta: { group: "", timepoint: "", ...(opts.meta || {}) },
    ...opts,
  };
}

// 3-point angle with real geometry: vertex at (cx, cy), second ray straight
// down, first ray rotated `deg` ANTERIOR (+x). Unsigned for most labels; for
// signed measures (ANB, Convexity) the value keeps its sign.
export function angleMarkup(label, deg, { cx = 500, cy = 300, r = 200, extra = {} } = {}) {
  const t = (deg * Math.PI) / 180;
  const V = { x: cx, y: cy };
  return {
    id: nextId(label), type: "angle3", label, visible: true, placed: true,
    points: [{ x: cx + r * Math.sin(t), y: cy + r * Math.cos(t) }, V, { x: cx, y: cy + r }],
    ...extra,
  };
}

// Straight line whose length is `len` px (mm when the session has pxPerMm = 1).
export function lineMarkup(label, len, { x = 100, y = 100, extra = {} } = {}) {
  return { id: nextId(label), type: "line", label, visible: true, placed: true, points: [{ x, y }, { x: x + len, y }], ...extra };
}

// Template-style signed distance: point `value` px anterior (+) / posterior (−)
// of a vertical reference line, for a right-facing profile.
export function signedDistanceMarkup(label, value, { x = 500, extra = {} } = {}) {
  return {
    id: nextId(label), type: "perp", label, measure: label, visible: true, placed: true,
    points: [{ x, y: 100 }, { x, y: 600 }, { x: x + value, y: 350 }],
    ...extra,
  };
}

export function pointMarkup(label, x, y, extra = {}) {
  return { id: nextId(label), type: "point", label, templateLabel: label, visible: true, placed: true, points: [{ x, y }], ...extra };
}

// Mean Aariz landmark positions keyed by in-app label (+ derived occlusal points).
export function averageCeph() {
  const pts = {};
  shape.landmarks.forEach((sym, i) => {
    const app = CEPHA29.find(l => l.symbol === sym)?.app;
    if (app) pts[app] = { x: shape.mean[2 * i], y: shape.mean[2 * i + 1] };
  });
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  pts.APOcc = mid(pts.Is, pts.Ii);
  pts.PPOcc = mid(pts.UMT, pts.LMT);
  return pts;
}

export function pointsToMarkups(pts) {
  return Object.entries(pts).map(([l, p]) => pointMarkup(l, p.x, p.y));
}

// Mirror every coordinate about x = w (a left-facing film of the same patient).
export function mirrorMarkups(markups, w = 3000) {
  return markups.map(m => ({ ...m, points: (m.points || []).map(p => ({ x: w - p.x, y: p.y })) }));
}
