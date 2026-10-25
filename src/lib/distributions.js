// ═══════════════════════════════════════════════════════════════════════════════
// distributions.js — normal distribution primitives (single source of truth)
//
// Pure, dependency-free so both lib/utils.js and research/statsCore.js can use it.
// erfc: Chebyshev fit from Numerical Recipes, fractional error < 1.2e-7 for all
// x, so tail probabilities (small p-values) keep their relative accuracy.
// ═══════════════════════════════════════════════════════════════════════════════

export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// Φ(x) = ½·erfc(−x/√2)
export function normalCdf(x) {
  return 0.5 * erfc(-x / Math.SQRT2);
}

// Φ⁻¹(p) by bisection (robust; ~1e-12).
export function zQuantile(p) {
  if (!(p > 0 && p < 1)) return NaN;
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
