// ═══════════════════════════════════════════════════════════════════════════════
// Reference skull map for guided tracing (B2): the mean CEPHA29 landmark shape
// (700 cephalograms, profile facing right) and a lookup from a markup to its
// reference landmark.
// ═══════════════════════════════════════════════════════════════════════════════

import { CEPHA29 } from "./landmarkMap.js";
import cepha29Shape from "./shapeModel.cepha29.json";

// { symbol: {x, y} } in image pixels.
export const MEAN_SHAPE = Object.fromEntries(cepha29Shape.landmarks.map((s, i) => [s, { x: cepha29Shape.mean[2 * i], y: cepha29Shape.mean[2 * i + 1] }]));
export const MAP_OUTLINES = [
  ["S", "N"], ["Po", "Or"],
  ["N`", "Pn", "Sn", "Ls", "Li", "Pog`"],
  ["PNS", "ANS", "A"],
  ["Co", "R", "Go", "Me", "Gn", "Pog", "B"],
  ["UIA", "UIT"], ["LIA", "LIT"], ["UMT", "UPM"], ["LMT", "LPM"],
];
const xs = Object.values(MEAN_SHAPE).map(p => p.x), ys = Object.values(MEAN_SHAPE).map(p => p.y);
const PAD = 70;
export const MAP_BOX = { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...xs) - Math.min(...xs) + 2 * PAD, h: Math.max(...ys) - Math.min(...ys) + 2 * PAD };

const norm = s => String(s || "").replace(/[`’]/g, "'").trim();
// Which reference landmark a markup is: by symbol or by the app's label for it.
export function mapSymbolFor(markup) {
  const names = [markup?.templateLabel, markup?.label].map(norm).filter(Boolean);
  for (const n of names) {
    const hit = CEPHA29.find(l => norm(l.symbol) === n || norm(l.app) === n);
    if (hit) return hit.symbol;
  }
  for (const n of names.map(x => x.toLowerCase())) {
    const hit = CEPHA29.find(l => norm(l.symbol).toLowerCase() === n || norm(l.app).toLowerCase() === n || l.name.toLowerCase() === n);
    if (hit) return hit.symbol;
  }
  return null;
}

