// ═══════════════════════════════════════════════════════════════════════════════
// Statistical shape model (SSM) refinement
//
// Projects detector predictions onto a PCA shape subspace built from public
// landmark annotations (scripts/build-shape-model.py). This suppresses
// implausible landmark configurations (gross outliers) without changing the
// pose (the projection is done in a scale/rotation-normalized frame and
// inverted back).
//
// Priors are registered per landmark-set key ("isbi19", "cepha29", …). Both
// ship in the repo: shapeModel.isbi19.json and shapeModel.cepha29.json, the
// latter built with `python scripts/build-shape-model.py --set cepha29`.
//
// Pure module: no DOM, no ML runtime — runs on the main thread after decoding,
// and is unit-testable.
// ═══════════════════════════════════════════════════════════════════════════════

import isbi19 from "../data/shapeModel.isbi19.json";
import cepha29 from "../data/shapeModel.cepha29.json";

const PRIORS = { isbi19, cepha29 };

// Register an additional set's prior (used once a CEPHA29 model is generated).
export function registerShapeModel(setKey, model) {
  if (setKey && model) PRIORS[setKey] = model;
}

export function getShapeModel(setKey) {
  return PRIORS[setKey] || null;
}

// Backwards-compatible alias (the default ISBI-19 prior).
export const SHAPE_MODEL = isbi19;

// Similarity transform aligning `pts` onto `meanPts` (complex-multiplier form).
// Returns { a, b, tx, ty } such that aligned = [[a,-b],[b,a]] · p + t.
function simTransform(pts, meanPts) {
  const n = pts.length;
  if (n === 0 || meanPts.length !== n) return { a: 1, b: 0, tx: 0, ty: 0 };
  let mx = 0, my = 0, Mx = 0, My = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  for (const p of meanPts) { Mx += p.x; My += p.y; }
  mx /= n; my /= n; Mx /= n; My /= n;
  let a = 0, b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i].x - mx, y = pts[i].y - my;
    const wx = meanPts[i].x - Mx, wy = meanPts[i].y - My;
    a += x * wx + y * wy;
    b += x * wy - y * wx;
    den += x * x + y * y;
  }
  if (den < 1e-12) return { a: 1, b: 0, tx: Mx - mx, ty: My - my };
  a /= den; b /= den;
  return { a, b, tx: Mx - (a * mx - b * my), ty: My - (b * mx + a * my) };
}

function solveGauss(A, rhs) {
  const n = rhs.length;
  const M = A.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return new Array(n).fill(0);
    const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
  return x;
}

// points: [{x,y}] in any consistent space (pixel space). confidences: number[].
// Returns refined [{x,y}] (same space), or the input unchanged on mismatch.
export function refineShape(points, confidences, opts = {}) {
  const { alpha = 0.6, reg = 0.1, k = 6, wmin = 0.2, clip = 3 } = opts;
  const mdl = getShapeModel(opts.set) || isbi19;
  const meanFlat = mdl.mean;
  const N = meanFlat.length / 2;
  if (!points || points.length !== N) return points;
  const K = Math.min(k, mdl.components.length);

  const mean = new Array(N);
  for (let i = 0; i < N; i++) mean[i] = { x: meanFlat[2 * i], y: meanFlat[2 * i + 1] };

  const { a, b, tx, ty } = simTransform(points, mean);
  const xa = points.map((p) => ({ x: a * p.x - b * p.y + tx, y: b * p.x + a * p.y + ty }));

  const V = mdl.components;
  const sig = mdl.sigmas;
  const w = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = confidences && Number.isFinite(confidences[i]) ? confidences[i] : 1;
    w[i] = Math.min(1, Math.max(wmin, c));
  }

  const A = Array.from({ length: K }, () => new Array(K).fill(0));
  const rhs = new Array(K).fill(0);
  for (let p = 0; p < K; p++) {
    for (let q = 0; q < K; q++) {
      let s = 0;
      for (let i = 0; i < N; i++) s += w[i] * (V[p][2 * i] * V[q][2 * i] + V[p][2 * i + 1] * V[q][2 * i + 1]);
      A[p][q] = s + (p === q ? reg : 0);
    }
    let s = 0;
    for (let i = 0; i < N; i++) {
      s += w[i] * (V[p][2 * i] * (xa[i].x - mean[i].x) + V[p][2 * i + 1] * (xa[i].y - mean[i].y));
    }
    rhs[p] = s;
  }
  const bb = solveGauss(A, rhs);
  for (let p = 0; p < K; p++) bb[p] = Math.max(-clip * sig[p], Math.min(clip * sig[p], bb[p]));

  const det = a * a + b * b;
  const out = new Array(N);
  for (let i = 0; i < N; i++) {
    let rx = mean[i].x, ry = mean[i].y;
    for (let p = 0; p < K; p++) { rx += V[p][2 * i] * bb[p]; ry += V[p][2 * i + 1] * bb[p]; }
    const bx = (1 - alpha) * xa[i].x + alpha * rx;
    const by = (1 - alpha) * xa[i].y + alpha * ry;
    const ux = bx - tx, uy = by - ty;
    out[i] = { x: (a * ux + b * uy) / det, y: (-b * ux + a * uy) / det };
  }
  return out;
}
