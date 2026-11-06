// ═══════════════════════════════════════════════════════════════════════════════
// Edge-assisted tracing: suggests a wall from the user's rough trace by searching
// along the curve's normal for the expected air-tissue edge. The caller shows the
// suggestion as a preview; nothing changes until the user accepts it.
// ═══════════════════════════════════════════════════════════════════════════════

import { sampleSpline } from "../lib/utils.js";

// Film edges are soft (about 1 grey level per pixel at 10 px/mm), so sizes follow the
// film's scale. These were tuned on a real cephalogram, not only on sharp test images.
const SEARCH_MM = 1.5;   // how far either side of the trace to look
const SPAN_MM = 0.4;     // the brightness step is measured over this distance each way
const MIN_STEP = 6;      // grey levels across that span; below this there's no clear edge
const KEEP_EVERY = 6;    // suggested curve keeps one in this many samples

function grey(img, x, y) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return null;
  const i = (iy * img.width + ix) * 4;
  return (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// `role` decides which way the edge runs. The airway is dark on a normal film: the
// wall has air on its anterior side, the soft palate and tongue on their posterior side.
// → { points, foundFraction, meanShift } or null when nothing useful was found.
// `pxPerMm` is the film's scale when calibrated; 10 px/mm is typical otherwise.
export function suggestWall(img, tracePoints, role, { facing = "right", pxPerMm = 10 } = {}) {
  if (!img || !tracePoints || tracePoints.length < 2) return null;
  const searchPx = Math.max(4, Math.round(SEARCH_MM * pxPerMm));
  const span = Math.max(1, Math.round(SPAN_MM * pxPerMm));
  const pts = tracePoints.length >= 3 ? sampleSpline(tracePoints, false, 8) : tracePoints;
  const anterior = facing === "left" ? -1 : 1;
  const airIsAnterior = role === "wall";
  const offsets = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
    const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
    let nx = -ty / len, ny = tx / len;
    if (nx * anterior < 0) { nx = -nx; ny = -ny; }
    const ux = tx / len, uy = ty / len;
    // Grey level averaged across the curve's direction, so one noisy pixel can't win.
    const sample = (d) => {
      let sum = 0, n = 0;
      for (const s of [-span, 0, span]) {
        const v = grey(img, p.x + nx * d + ux * s, p.y + ny * d + uy * s);
        if (v !== null) { sum += v; n++; }
      }
      return n ? sum / n : null;
    };
    const steps = [];
    for (let d = -searchPx; d <= searchPx; d++) {
      const before = sample(d - span), after = sample(d + span);
      if (before === null || after === null) continue;
      // Moving towards anterior: bright → dark at the wall, dark → bright at the palate and tongue.
      steps.push({ d, step: airIsAnterior ? before - after : after - before });
    }
    const top = Math.max(-Infinity, ...steps.map(s => s.step));
    if (top < MIN_STEP) return { nx, ny, d: null };
    // A sharp edge gives a flat run of equal steps as wide as the span; its middle is the edge.
    const peak = steps.findIndex(s => s.step === top);
    let lo = peak, hi = peak;
    while (lo > 0 && steps[lo - 1].step >= top * 0.95) lo--;
    while (hi < steps.length - 1 && steps[hi + 1].step >= top * 0.95) hi++;
    return { nx, ny, d: (steps[lo].d + steps[hi].d) / 2 };
  });

  const found = offsets.filter(o => o.d !== null).length;
  if (found < pts.length * 0.5) return null;

  // Median smoothing, so a stray bone edge can't pull one point out of line. Places
  // with no clear edge follow their neighbours, or stay on the trace.
  const shifted = pts.map((p, i) => {
    const near = offsets.slice(Math.max(0, i - 4), i + 5).map(o => o.d).filter(d => d !== null);
    const d = near.length ? median(near) : 0;
    return { x: p.x + offsets[i].nx * d, y: p.y + offsets[i].ny * d, d };
  });
  const points = shifted.filter((_, i) => i % KEEP_EVERY === 0 || i === shifted.length - 1).map(({ x, y }) => ({ x, y }));
  return {
    points,
    foundFraction: found / pts.length,
    meanShift: shifted.reduce((s, p) => s + Math.abs(p.d), 0) / shifted.length,
  };
}
