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
// Inference: Var(β̂) = σ̂²(Σ XᵢᵀHᵢ⁻¹Xᵢ)⁻¹ with a conservative between-subject
// df = m − 2 (m subjects) for the t-tests. No Kenward–Roger / Satterthwaite
// correction — reported as such.
// ═══════════════════════════════════════════════════════════════════════════════

import { tDistributeCDF, chi2CDF } from "../lib/utils.js";

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

// Profiled REML deviance for a relative covariance factor L (q × q, lower).
function remlDeviance(groups, Lrel, q) {
  const p = 2;
  let N = 0, logDetH = 0;
  const XtHX = [[0, 0], [0, 0]], XtHy = [0, 0];
  const cache = [];
  for (const g of groups) {
    const ni = g.length;
    N += ni;
    const Z = g.map(o => (q === 1 ? [1] : [1, o.t]));
    const G = Lrel.map((r) => Lrel.map((_, j) => r.reduce((s, v, k) => s + v * Lrel[j][k], 0)));
    const H = Array.from({ length: ni }, (_, a) => Array.from({ length: ni }, (_, b) => {
      let s = a === b ? 1 : 0;
      for (let u = 0; u < q; u++) for (let v = 0; v < q; v++) s += Z[a][u] * G[u][v] * Z[b][v];
      return s;
    }));
    const Lh = cholesky(H);
    if (!Lh) return { dev: Infinity };
    logDetH += logDetChol(Lh);
    const X = g.map(o => [1, o.t]);
    const HiX = [cholSolve(Lh, X.map(r => r[0])), cholSolve(Lh, X.map(r => r[1]))];
    const Hiy = cholSolve(Lh, g.map(o => o.y));
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) XtHX[r][c] += X.reduce((s, row, a) => s + row[r] * HiX[c][a], 0);
      XtHy[r] += X.reduce((s, row, a) => s + row[r] * Hiy[a], 0);
    }
    cache.push({ g, Lh, X, Hiy, HiX });
  }
  const Lx = cholesky(XtHX);
  if (!Lx || N <= p) return { dev: Infinity };
  const beta = cholSolve(Lx, XtHy);
  let rss = 0;
  for (const { g, Hiy, HiX } of cache) {
    // rᵀH⁻¹r = yᵀH⁻¹y − 2βᵀXᵀH⁻¹y + βᵀXᵀH⁻¹Xβ, accumulated per subject.
    const y = g.map(o => o.y);
    const Hir = Hiy.map((v, a) => v - beta[0] * HiX[0][a] - beta[1] * HiX[1][a]);
    rss += y.reduce((s, v, a) => s + (v - beta[0] - beta[1] * g[a].t) * Hir[a], 0);
  }
  const sigma2 = rss / (N - p);
  const dev = (N - p) * Math.log(2 * Math.PI * sigma2) + logDetH + logDetChol(Lx) + (N - p);
  return { dev, beta, sigma2, XtHX, N };
}

function relFactor(theta, q) {
  if (q === 1) return [[Math.exp(theta[0])]];
  return [[Math.exp(theta[0]), 0], [theta[1], Math.exp(theta[2])]];
}

// obs: [{ subject, t, y }]. Returns null when the model cannot be estimated.
export function fitLMM(obs, { randomSlope = false, alpha = 0.05 } = {}) {
  const groups = groupObs(obs);
  const m = groups.length;
  const N = groups.reduce((s, g) => s + g.length, 0);
  const q = randomSlope ? 2 : 1;
  const distinctT = new Set(groups.flatMap(g => g.map(o => o.t))).size;
  if (m < 3 || N < 4 || distinctT < 2) return null;
  if (randomSlope && groups.filter(g => new Set(g.map(o => o.t)).size >= 2).length < 3) return null;

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
  const df = Math.max(1, m - 2);
  const tCrit = (() => { let lo = 0, hi = 50; for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (tDistributeCDF(mid, df) < 1 - alpha / 2) lo = mid; else hi = mid; } return (lo + hi) / 2; })();
  const fixedEffects = ["Intercept", "Time (slope)"].map((term, i) => {
    const se = Math.sqrt(Math.max(covBeta[i][i], 0));
    const t = se > 0 ? beta[i] / se : 0;
    return { term, estimate: beta[i], se, t, df, p: se > 0 ? 2 * (1 - tDistributeCDF(Math.abs(t), df)) : 1, ci95: [beta[i] - tCrit * se, beta[i] + tCrit * se] };
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
    fit: { logLik, aic: -2 * logLik + 2 * (2 + nVarPars), bic: -2 * logLik + (2 + nVarPars) * Math.log(N), n: N, subjects: m, likelihood: "REML" },
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
