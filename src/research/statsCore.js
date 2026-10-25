// ═══════════════════════════════════════════════════════════════════════════════
// statsCore.js — shared statistical helpers used across research modules
// Centralizes functions that were previously copy-pasted across files.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Normal CDF (standard normal distribution function) ────────────────────
// Φ(x) = ½·erfc(−x/√2). The previous version evaluated erf(x) instead of
// erf(x/√2), i.e. Φ(x·√2): Φ(1.96) came out 0.997 instead of 0.975, which made
// large-sample Mann-Whitney/Wilcoxon and logistic p-values too small and DeLong
// AUC intervals too narrow (z₀.₀₂₅ ≈ 1.39). erfc uses the Chebyshev fit of
// Numerical Recipes (fractional error < 1.2e-7 everywhere, including the tails).
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(x) {
  return 0.5 * erfc(-x / Math.SQRT2);
}

// ─── Studentized range distribution (Tukey HSD, Games-Howell) ───────────────
// P(Q ≤ q | k, ν) = ∫₀^∞ f_ν(s) · W(q·s) ds,  W(w) = k ∫ φ(z)[Φ(z) − Φ(z − w)]^(k−1) dz,
// with s = S/σ distributed as √(χ²_ν/ν). Both integrals use composite Simpson
// rules; the s-integral runs in log-space around s = 1 with a width that shrinks
// as ν grows. Accurate to ~1e-4 against published tables.
function simpson(f, a, b, n) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

const SQRT2PI = Math.sqrt(2 * Math.PI);

function rangeCdfInfinite(w, k) {
  if (w <= 0) return 0;
  const f = z => Math.exp(-z * z / 2) / SQRT2PI * Math.pow(Math.max(normalCdf(z) - normalCdf(z - w), 0), k - 1);
  return Math.min(1, k * simpson(f, -8.5, 8.5, 170));
}

export function ptukey(q, k, df) {
  if (!(q > 0) || k < 2) return 0;
  if (!(df > 0) || df > 5000) return rangeCdfInfinite(q, k);
  // log-density of s = √(χ²_ν/ν), up to a constant; integrate over u = log s.
  const logDens = u => { const s = Math.exp(u); return df * u - (df * s * s) / 2; };
  const half = Math.min(8, 10 / Math.sqrt(df) + 1);
  const peak = logDens(0);
  const num = simpson(u => Math.exp(logDens(u) - peak) * rangeCdfInfinite(q * Math.exp(u), k), -half, half, 120);
  const den = simpson(u => Math.exp(logDens(u) - peak), -half, half, 120);
  return den > 0 ? Math.min(1, Math.max(0, num / den)) : 0;
}

export function qtukey(p, k, df) {
  let lo = 0, hi = 2;
  while (ptukey(hi, k, df) < p && hi < 1e3) { lo = hi; hi *= 2; }
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (ptukey(mid, k, df) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-6) break;
  }
  return (lo + hi) / 2;
}

export function matMul(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++)
      for (let k = 0; k < n; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

export function matVecMul(M, v) {
  return M.map(row => row.reduce((s, val, i) => s + val * v[i], 0));
}

export function transposeMatrix(m) {
  if (m.length === 0) return [];
  return m[0].map((_, i) => m.map(r => r[i]));
}

export function matInverse(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    const piv = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= piv;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function addIntercept(X) {
  return X.map(row => [1, ...row]);
}

// ─── Benjamini-Hochberg adjustment ────────────────────────────────────────
// Enforces monotonicity as cumulative min from the largest p downward
// (the correct BH procedure — see S2).
export function benjaminiHochberg(pValues, alpha = 0.05) {
  const m = pValues.length;
  if (m === 0) return [];
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  for (let rank = 0; rank < m; rank++) {
    indexed[rank].rawAdj = Math.min(indexed[rank].p * m / (rank + 1), 1);
  }
  let prev = 1;
  for (let rank = m - 1; rank >= 0; rank--) {
    prev = Math.min(prev, indexed[rank].rawAdj);
    indexed[rank].adjusted = prev;
  }
  let lastSig = -1;
  for (let rank = 0; rank < m; rank++) {
    if (indexed[rank].p <= ((rank + 1) / m) * alpha) lastSig = rank;
  }
  return indexed.map((item, rank) => ({
    original: item.p, adjusted: item.adjusted, significant: rank <= lastSig, i: item.i,
  })).sort((a, b) => a.i - b.i);
}
