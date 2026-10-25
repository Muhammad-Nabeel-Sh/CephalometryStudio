// ═══════════════════════════════════════════════════════════════════════════════
// mixedModel.js — REML linear mixed model for growth / longitudinal data
//
//   y_ij = β0 + β1·t_ij + b0_i (+ b1_i·t_ij) + ε_ij
//   b_i ~ N(0, G), ε_ij ~ N(0, σ²)
//
// G is parameterised relative to σ² through a Cholesky factor (G = σ²·LLᵀ),
// σ² and β are profiled out, and the restricted log-likelihood is maximised over
// L with Nelder–Mead (1–3 parameters). Each subject contributes a small
// n_i × n_i system, so unbalanced data and missing visits are handled exactly —
// unlike RM-ANOVA, subjects with incomplete follow-up are kept.
//
// Inference: Var(β̂) = σ̂²(Σ XᵢᵀHᵢ⁻¹Xᵢ)⁻¹ with Satterthwaite degrees of freedom
// (numerical derivatives of the REML deviance, as in lmerTest).
// ═══════════════════════════════════════════════════════════════════════════════

import { tDistributeCDF, chi2CDF } from "../lib/utils.js";
import { tQuantile } from "./statsCore.js";

// Solve A x = b for symmetric positive-definite A via Cholesky; also returns log|A|.
function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0)) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

function cholSolve(L, b) {
  const n = L.length, y = Array(n).fill(0), x = Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}

const logDetChol = L => 2 * L.reduce((s, row, i) => s + Math.log(row[i]), 0);

function invertSPD(A) {
  const L = cholesky(A);
  if (!L) return null;
  const n = A.length;
  const cols = Array.from({ length: n }, (_, j) => cholSolve(L, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))));
  return cols[0].map((_, i) => cols.map(c => c[i]));
}

// Minimal Nelder–Mead minimiser.
export function nelderMead(f, x0, { step = 0.5, maxIter = 2000, tol = 1e-10 } = {}) {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step; simplex.push(x); }
  let vals = simplex.map(f);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map(i => simplex[i]); vals = order.map(i => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol * (Math.abs(vals[0]) + tol)) break;
    const c = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const at = t => c.map((cj, j) => cj + t * (simplex[n][j] - cj));
    const xr = at(-1), fr = f(xr);
    if (fr < vals[0]) {
      const xe = at(-2), fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      simplex[n] = xr; vals[n] = fr;
    } else {
      const xc = fr < vals[n] ? at(-0.5) : at(0.5), fc = f(xc);
      if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); }
      }
    }
  }
  return { x: simplex[0], fx: vals[0], iterations: iter, converged: iter < maxIter };
}

function groupObs(obs) {
  const by = new Map();
  for (const o of obs) {
    if (!isFinite(o.y) || !isFinite(o.t)) continue;
    if (!by.has(o.subject)) by.set(o.subject, []);
    by.get(o.subject).push(o);
  }
  return [...by.values()];
}

// Fixed-effects design row of an observation: `o.x` when supplied (covariates,
// quadratic term), else [1, t].
const xRow = o => o.x || [1, o.t];

// REML pieces for a relative covariance factor L (q × q, lower): profiled
// deviance plus the terms needed to evaluate it at any σ² (Satterthwaite df).
function remlCore(groups, Lrel, q) {
  const p = xRow(groups[0][0]).length;
  let N = 0, logDetH = 0;
  const XtHX = Array.from({ length: p }, () => Array(p).fill(0)), XtHy = Array(p).fill(0);
  const G = Lrel.map(r => Lrel.map((_, j) => r.reduce((s, v, k) => s + v * Lrel[j][k], 0)));
  const cache = [];
  for (const g of groups) {
    const ni = g.length;
    N += ni;
    const Z = g.map(o => (q === 1 ? [1] : [1, o.t]));
    const H = Array.from({ length: ni }, (_, a) => Array.from({ length: ni }, (_, b) => {
      let s = a === b ? 1 : 0;
      for (let u = 0; u < q; u++) for (let v = 0; v < q; v++) s += Z[a][u] * G[u][v] * Z[b][v];
      return s;
    }));
    const Lh = cholesky(H);
    if (!Lh) return null;
    logDetH += logDetChol(Lh);
    const X = g.map(xRow);
    const HiX = Array.from({ length: p }, (_, c) => cholSolve(Lh, X.map(r => r[c])));
    const Hiy = cholSolve(Lh, g.map(o => o.y));
    for (let r = 0; r < p; r++) {
      for (let c = 0; c < p; c++) XtHX[r][c] += X.reduce((s, row, a) => s + row[r] * HiX[c][a], 0);
      XtHy[r] += X.reduce((s, row, a) => s + row[r] * Hiy[a], 0);
    }
    cache.push({ g, X, Hiy, HiX });
  }
  const Lx = cholesky(XtHX);
  if (!Lx || N <= p) return null;
  const beta = cholSolve(Lx, XtHy);
  let rss = 0;
  for (const { g, X, Hiy, HiX } of cache) {
    // rᵀH⁻¹r with r = y − Xβ, accumulated per subject.
    const Hir = Hiy.map((v, a) => v - beta.reduce((s, b, c) => s + b * HiX[c][a], 0));
    rss += g.reduce((s, o, a) => s + (o.y - X[a].reduce((t, xv, c) => t + xv * beta[c], 0)) * Hir[a], 0);
  }
  return { beta, rss, N, p, logDetH, logDetXtHX: logDetChol(Lx), XtHX };
}

// Profiled REML deviance (σ² at its optimum).
function remlDeviance(groups, Lrel, q) {
  const c = remlCore(groups, Lrel, q);
  if (!c) return { dev: Infinity };
  const sigma2 = c.rss / (c.N - c.p);
  const dev = (c.N - c.p) * Math.log(2 * Math.PI * sigma2) + c.logDetH + c.logDetXtHX + (c.N - c.p);
  return { dev, beta: c.beta, sigma2, XtHX: c.XtHX, N: c.N, p: c.p };
}

function relFactor(theta, q) {
  if (q === 1) return [[Math.exp(theta[0])]];
  return [[Math.exp(theta[0]), 0], [theta[1], Math.exp(theta[2])]];
}

// Satterthwaite df for each fixed effect (as lmerTest): φ(ψ) = Var(β̂ⱼ) as a
// function of the variance parameters ψ = (log σ², θ); df = 2φ² / (∇φᵀ·Cov(ψ)·∇φ),
// with Cov(ψ) = 2·H⁻¹ from the Hessian of the (unprofiled) REML deviance.
function satterthwaiteDf(groups, q, theta, sigma2) {
  const psi0 = [Math.log(sigma2), ...theta];
  const fullDev = psi => {
    const c = remlCore(groups, relFactor(psi.slice(1), q), q);
    if (!c) return NaN;
    const s2 = Math.exp(psi[0]);
    return (c.N - c.p) * Math.log(2 * Math.PI * s2) + c.logDetH + c.logDetXtHX + c.rss / s2;
  };
  const varBeta = psi => {
    const c = remlCore(groups, relFactor(psi.slice(1), q), q);
    const inv = c && invertSPD(c.XtHX);
    return inv ? inv.map((r, i) => r[i] * Math.exp(psi[0])) : null;
  };
  const d = psi0.length, h = 1e-3;
  const shift = (psi, i, di) => psi.map((v, k) => (k === i ? v + di : v));
  const Hm = Array.from({ length: d }, () => Array(d).fill(0));
  const f0 = fullDev(psi0);
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      const v = a === b
        ? (fullDev(shift(psi0, a, h)) - 2 * f0 + fullDev(shift(psi0, a, -h))) / (h * h)
        : (fullDev(shift(shift(psi0, a, h), b, h)) - fullDev(shift(shift(psi0, a, h), b, -h))
          - fullDev(shift(shift(psi0, a, -h), b, h)) + fullDev(shift(shift(psi0, a, -h), b, -h))) / (4 * h * h);
      Hm[a][b] = Hm[b][a] = v;
    }
  }
  const Hinv = invertSPD(Hm);
  const v0 = varBeta(psi0);
  if (!Hinv || !v0) return null;
  const cov = Hinv.map(r => r.map(x => 2 * x));
  const grads = Array.from({ length: d }, (_, a) => {
    const up = varBeta(shift(psi0, a, h)), dn = varBeta(shift(psi0, a, -h));
    return up && dn ? up.map((u, j) => (u - dn[j]) / (2 * h)) : null;
  });
  if (grads.some(g => !g)) return null;
  return v0.map((phi, j) => {
    let q2 = 0;
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) q2 += grads[a][j] * cov[a][b] * grads[b][j];
    return q2 > 0 ? (2 * phi * phi) / q2 : NaN;
  });
}

// obs: [{ subject, t, y, x? }] — `x` is the fixed-effects row (default [1, t]);
// `termNames` labels its columns. Returns null when the model cannot be estimated.
export function fitLMM(obs, { randomSlope = false, alpha = 0.05, termNames } = {}) {
  const groups = groupObs(obs);
  const m = groups.length;
  const N = groups.reduce((s, g) => s + g.length, 0);
  const q = randomSlope ? 2 : 1;
  const distinctT = new Set(groups.flatMap(g => g.map(o => o.t))).size;
  if (m < 3 || N < 4 || distinctT < 2) return null;
  if (randomSlope && groups.filter(g => new Set(g.map(o => o.t)).size >= 2).length < 3) return null;
  const p = xRow(groups[0][0]).length;
  if (N <= p + 1) return null;

  // Start: random-intercept SD ≈ residual SD, small slope SD; log scale keeps L PD.
  const start = q === 1 ? [0] : [0, 0, Math.log(0.1)];
  const objective = th => {
    const r = remlDeviance(groups, relFactor(th, q), q);
    return isFinite(r.dev) ? r.dev : 1e300;
  };
  let opt = nelderMead(objective, start, { step: 1 });
  opt = nelderMead(objective, opt.x, { step: 0.1 }); // restart to polish
  const L = relFactor(opt.x, q);
  const fit = remlDeviance(groups, L, q);
  if (!isFinite(fit.dev)) return null;

  const { beta, sigma2 } = fit;
  const covBeta = invertSPD(fit.XtHX)?.map(r => r.map(v => v * sigma2));
  if (!covBeta) return null;
  const G = L.map((r) => L.map((_, j) => sigma2 * r.reduce((s, v, k) => s + v * L[j][k], 0)));
  // Satterthwaite df; falls back to the conservative between-subject df.
  const satt = satterthwaiteDf(groups, q, opt.x, sigma2);
  const names = termNames || ["Intercept", "Time (slope)"];
  const fixedEffects = beta.map((b, i) => {
    const se = Math.sqrt(Math.max(covBeta[i][i], 0));
    const dfi = satt && isFinite(satt[i]) ? Math.min(Math.max(satt[i], 1), N - p) : Math.max(1, m - 2);
    const tCrit = tQuantile(1 - alpha / 2, dfi);
    const t = se > 0 ? b / se : 0;
    return { term: names[i] || `β${i}`, estimate: b, se, t, df: dfi, p: se > 0 ? 2 * (1 - tDistributeCDF(Math.abs(t), dfi)) : 1, ci95: [b - tCrit * se, b + tCrit * se] };
  });
  const nVarPars = q === 1 ? 2 : 4; // G entries + σ²
  const logLik = -fit.dev / 2;
  return {
    beta, covBeta, fixedEffects,
    randomEffects: {
      subjectVariance: G[0][0],
      slopeVariance: q === 2 ? G[1][1] : 0,
      interceptSlopeCov: q === 2 ? G[0][1] : 0,
      residualVariance: sigma2,
      icc: G[0][0] / (G[0][0] + sigma2),
    },
    fit: { logLik, aic: -2 * logLik + 2 * (p + nVarPars), bic: -2 * logLik + (p + nVarPars) * Math.log(N), n: N, subjects: m, likelihood: "REML" },
    dfMethod: satt ? "Satterthwaite" : "between-subject (m − 2)",
    randomSlope: q === 2,
    converged: opt.converged,
  };
}

// Fit random-intercept and (when estimable) random-slope models; keep the slope
// model when the REML likelihood-ratio test supports it (χ² 50:50 mixture of
// df 1 and 2, Self & Liang 1987).
export function fitGrowthModel(obs, opts = {}) {
  const ri = fitLMM(obs, { ...opts, randomSlope: false });
  if (!ri) return null;
  const rs = fitLMM(obs, { ...opts, randomSlope: true });
  let comparison = null, chosen = ri;
  if (rs) {
    const lr = Math.max(0, 2 * (rs.fit.logLik - ri.fit.logLik));
    const p = 0.5 * (1 - chi2CDF(lr, 1)) + 0.5 * (1 - chi2CDF(lr, 2));
    comparison = { lrStatistic: lr, pValue: p, test: "REML LRT, χ² mixture (df 1:2)" };
    if (p < 0.05 && rs.converged) chosen = rs;
  }
  return { ...chosen, alternatives: { randomIntercept: ri.fit, randomSlope: rs?.fit || null }, slopeTest: comparison };
}
