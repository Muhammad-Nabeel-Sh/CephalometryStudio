// ═══════════════════════════════════════════════════════════════════════════════
// sampleSize.js — a-priori sample size for the study designs the app supports
//
// Normal-approximation formulas with the usual small-sample corrections; they
// agree with G*Power's exact noncentral-t results to within one subject for
// typical inputs (two-sided α unless stated).
//   • Two independent means (Cohen's d):  n/group = 2(z₁₋α/₂+z₁₋β)²/d² + z²₁₋α/₂/4
//   • Paired / one-sample (Cohen's dz):   n = (z₁₋α/₂+z₁₋β)²/dz² + z²₁₋α/₂/2
//   • Pearson correlation (Fisher z):     n = ((z₁₋α/₂+z₁₋β)/atanh r)² + 3
//   • ICC, H0: ρ = ρ0 vs ρ1 (Walter, Eliasziw & Donner 1998, one-sided α):
//       n = 1 + 2k(z₁₋α+z₁₋β)² / ((k−1)·ln(C0)²),  C0 = (1+kρ0/(1−ρ0)) / (1+kρ1/(1−ρ1))
//   • Bland-Altman precision of the limits of agreement: n such that the 95% CI
//     half-width of each limit ≈ 1.96·√(3/n)·SD equals the requested fraction of SD.
// ═══════════════════════════════════════════════════════════════════════════════

import { zQuantile } from "../lib/distributions.js";
export { zQuantile };

const valid = (...xs) => xs.every(x => typeof x === "number" && isFinite(x));

export function nTwoMeans(d, alpha = 0.05, power = 0.8) {
  if (!valid(d, alpha, power) || d === 0) return null;
  const za = zQuantile(1 - alpha / 2), zb = zQuantile(power);
  return Math.ceil((2 * (za + zb) ** 2) / (d * d) + (za * za) / 4);
}

export function nPaired(dz, alpha = 0.05, power = 0.8) {
  if (!valid(dz, alpha, power) || dz === 0) return null;
  const za = zQuantile(1 - alpha / 2), zb = zQuantile(power);
  return Math.ceil((za + zb) ** 2 / (dz * dz) + (za * za) / 2);
}

export function nCorrelation(r, alpha = 0.05, power = 0.8) {
  if (!valid(r, alpha, power) || r === 0 || Math.abs(r) >= 1) return null;
  const za = zQuantile(1 - alpha / 2), zb = zQuantile(power);
  return Math.ceil(((za + zb) / Math.atanh(Math.abs(r))) ** 2 + 3);
}

export function nICC(rho1, rho0, k = 2, alpha = 0.05, power = 0.8) {
  if (!valid(rho1, rho0, k, alpha, power) || k < 2 || rho1 <= rho0 || rho1 >= 1 || rho0 < 0) return null;
  const za = zQuantile(1 - alpha), zb = zQuantile(power);
  const c0 = (1 + (k * rho0) / (1 - rho0)) / (1 + (k * rho1) / (1 - rho1));
  return Math.ceil(1 + (2 * k * (za + zb) ** 2) / ((k - 1) * Math.log(c0) ** 2));
}

// `halfWidthSD`: desired 95% CI half-width of each limit of agreement, in SDs of
// the differences (e.g. 0.5 → limits known to within ±0.5 SD).
export function nBlandAltman(halfWidthSD) {
  if (!valid(halfWidthSD) || halfWidthSD <= 0) return null;
  return Math.ceil(3 * (1.96 / halfWidthSD) ** 2);
}
