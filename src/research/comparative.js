import { computeMeasurements, mean, stdev, variance, shapiroWilk, oneWayAnova, tTestPaired, tDistributeCDF, fCDF, chi2CDF } from "../lib/utils.js";
import { normalCdf, matMul, matInverse, benjaminiHochberg } from "./statsCore.js";
import { unitForKey } from "./collect.js";
import { logError } from "../lib/logger.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
function rankArray(arr) {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

// Levene's test for homogeneity of variance
function levenesTest(...groups) {
  if (groups.length < 2) return null;
  const all = [];
  const groupMeans = groups.map(g => {
    const m = mean(g);
    const devs = g.map(v => Math.abs(v - m));
    all.push(...devs);
    return { devs, m: mean(devs), n: g.length };
  });
  const grandMean = mean(all);
  const k = groups.length;
  const N = all.length;
  const num = sum(groupMeans.map(g => g.n * (g.m - grandMean) ** 2)) / (k - 1);
  const den = sum(groupMeans.map(g => sum(g.devs.map(d => (d - g.m) ** 2)))) / (N - k);
  if (den === 0) return { W: 0, pValue: 1, equalVariance: true };
  const W = num / den;
  const df1 = k - 1;
  const df2 = N - k;
  const pValue = 1 - fCDF(W, df1, df2);
  return { W, df1, df2, pValue, equalVariance: pValue > 0.05 };
}

// ─── Exact small-sample distributions for non-parametric tests ─────────────
// The normal approximation (above) is inaccurate for small n and is invalid for
// ties in the exact sense. R's wilcox.test uses the exact distribution by default
// when there are no ties and n is small. These DP recursions compute the exact
// null distribution counts; the two-sided p = 2·P(statistic ≤ observed) capped at 1
// (the symmetric conservative convention). Falls back to the normal approximation
// when ties are present or n exceeds the cap.
function binom(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
// Exact two-sided p for Mann-Whitney U (no ties). Recurrence:
//   A(u, m, n) = A(u, m, n-1) + A(u-n, m-1, n);  A(0,·,·)=1; A(u,0,·)=A(u,·,0)=δ_{u0}
// Rolling 2-layer DP over n; iterate m over the smaller group to bound memory.
export function mannWhitneyExactP(n1in, n2in, Uobs) {
  let n1 = n1in, n2 = n2in;
  if (n1 > n2) { const t = n1; n1 = n2; n2 = t; } // distribution symmetric in (n1,n2)
  const maxU = n1 * n2;
  if (Uobs < 0 || Uobs > maxU) return null;
  let prev = Array.from({ length: n1 + 1 }, () => { const a = new Float64Array(maxU + 1); a[0] = 1; return a; });
  for (let n = 1; n <= n2; n++) {
    const cur = Array.from({ length: n1 + 1 }, () => new Float64Array(maxU + 1));
    cur[0][0] = 1;
    for (let m = 1; m <= n1; m++) {
      const pm1 = cur[m - 1], pm = prev[m], cm = cur[m];
      for (let u = 0; u <= maxU; u++) {
        let v = pm[u];
        if (u - n >= 0) v += pm1[u - n];
        cm[u] = v;
      }
    }
    prev = cur;
  }
  const counts = prev[n1];
  const total = binom(n1 + n2, n1);
  let pLow = 0;
  for (let u = 0; u <= Uobs; u++) pLow += counts[u];
  const p = (2 * pLow) / total;
  return p > 1 ? 1 : p;
}
// Exact two-sided p for Wilcoxon signed-rank W (no ties in |diff|). Recurrence:
//   g(w, k) = g(w, k-1) + g(w-k, k-1);  g(0,0)=1.  Total sign assignments = 2^n.
export function wilcoxonExactP(n, Wobs) {
  const maxW = (n * (n + 1)) / 2;
  if (Wobs < 0 || Wobs > maxW) return null;
  let prev = new Float64Array(maxW + 1);
  prev[0] = 1;
  for (let k = 1; k <= n; k++) {
    const cur = new Float64Array(maxW + 1);
    for (let w = 0; w <= maxW; w++) {
      let v = prev[w];
      if (w - k >= 0) v += prev[w - k];
      cur[w] = v;
    }
    prev = cur;
  }
  const total = 2 ** n;
  let pLow = 0;
  for (let w = 0; w <= Wobs; w++) pLow += prev[w];
  const p = (2 * pLow) / total;
  return p > 1 ? 1 : p;
}

// Mann-Whitney U test with tie correction (variance inflation) and continuity
// correction. The previous variance formula `n1·n2·(n1+n2+1)/12` assumes no ties; with
// ties (common when cephalometric values are rounded) the variance is over-estimated,
// inflating p-values. The continuity correction (±0.5) improves the normal approx.
export function mannWhitneyU(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  if (n1 < 2 || n2 < 2) return null;
  const combined = [...arr1, ...arr2];
  const ranks = rankArray(combined);
  const rank1 = ranks.slice(0, n1);
  const R1 = sum(rank1);
  const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const mU = n1 * n2 / 2;
  // Tie-corrected variance: Var(U) = (n1 n2 /12) · [(n+1) - Σt(t²-1)/(n(n-1))], n=n1+n2
  const tieCounts = {};
  for (const v of combined) tieCounts[v] = (tieCounts[v] || 0) + 1;
  const N = n1 + n2;
  let tieTerm = 0;
  for (const t of Object.values(tieCounts)) if (t > 1) tieTerm += t ** 3 - t;
  const hasTies = tieTerm > 0;
  const sU = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieTerm / (N * (N - 1))));
  if (sU === 0) return null;
  // Continuity correction: |U - mU| - 0.5 (U is the smaller tail, so use mU - U)
  const z = (mU - U - 0.5) / sU;
  // Exact distribution for small, tie-free samples; else normal approximation.
  const useExact = !hasTies && n1 <= 50 && n2 <= 50;
  const exactP = useExact ? mannWhitneyExactP(n1, n2, U) : null;
  const pValue = exactP != null ? exactP : 2 * (1 - normalCdf(Math.abs(z)));
  return { U, U1, U2, z, pValue, method: exactP != null ? "exact" : "normal approximation", significant: pValue < 0.05 };
}

// Wilcoxon signed-rank test with tie correction for the variance. Ties in |diff| get
// average ranks; zero differences are excluded. Effect size uses the number of non-zero
// differences (not the original group size).
export function wilcoxonSignedRank(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const nonZero = diffs.filter(d => d !== 0);
  if (nonZero.length < 2) return null;
  const absDiffs = nonZero.map(d => ({ abs: Math.abs(d), sign: d > 0 ? 1 : -1 }));
  absDiffs.sort((a, b) => a.abs - b.abs);
  const ranks = rankArray(absDiffs.map(d => d.abs));
  const Wplus = sum(absDiffs.map((d, i) => d.sign > 0 ? ranks[i] : 0));
  const Wminus = sum(absDiffs.map((d, i) => d.sign < 0 ? ranks[i] : 0));
  const W = Math.min(Wplus, Wminus);
  const nR = absDiffs.length;
  const mW = nR * (nR + 1) / 4;
  // Tie-corrected variance: nR(nR+1)(2nR+1)/24 - Σt(t-1)(t-2) ... standard form:
  // Var(W) = nR(nR+1)(2nR+1)/24 - Σ t(t²-1)/48 for each tie group in |diff|
  const tieCounts = {};
  for (const d of absDiffs) tieCounts[d.abs] = (tieCounts[d.abs] || 0) + 1;
  let tieAdj = 0;
  for (const t of Object.values(tieCounts)) if (t > 1) tieAdj += t * (t * t - 1);
  const hasTies = tieAdj > 0;
  const sW = Math.sqrt((nR * (nR + 1) * (2 * nR + 1)) / 24 - tieAdj / 48);
  if (sW === 0) return null;
  const z = (mW - W - 0.5) / sW; // continuity-corrected
  // Exact distribution for small, tie-free samples; else normal approximation.
  const useExact = !hasTies && nR <= 25;
  const exactP = useExact ? wilcoxonExactP(nR, W) : null;
  const pValue = exactP != null ? exactP : 2 * (1 - normalCdf(Math.abs(z)));
  return { W, Wplus, Wminus, z, n: nR, pValue, method: exactP != null ? "exact" : "normal approximation", significant: pValue < 0.05 };
}

// Kruskal-Wallis H test. The previous version used `1 - fCDF(H, df, 1e5)` as a χ²
// proxy, which is conceptually wrong (F(·, df, ∞) = χ²(df)/df, not χ²(df)) AND relied on
// the broken fCDF. Use the χ² distribution directly. Includes the standard tie
// correction for H.
function kruskalWallis(groups, labels) {
  if (groups.length < 2) return null;
  const groupData = groups.map((g, i) => ({ vals: g, label: labels?.[i] || `Group ${i + 1}`, n: g.length }));
  const flat = groups.flat();
  const ranks = rankArray(flat);
  let idx = 0;
  const groupRanks = groupData.map(g => {
    const r = ranks.slice(idx, idx + g.n);
    idx += g.n;
    return { ...g, rankSum: sum(r), meanRank: mean(r) };
  });
  const N = flat.length;
  // Tie correction: 1 - Σt(t²-1)/(N³-N)
  const tieCounts = {};
  for (const v of flat) tieCounts[v] = (tieCounts[v] || 0) + 1;
  let tieTerm = 0;
  for (const t of Object.values(tieCounts)) if (t > 1) tieTerm += t ** 3 - t;
  const C = 1 - tieTerm / (N ** 3 - N);
  const H12 = 12 / (N * (N + 1));
  const Hsum = sum(groupRanks.map(g => g.rankSum ** 2 / g.n));
  const H = (H12 * Hsum - 3 * (N + 1)) / (C || 1);
  const df = groups.length - 1;
  const pValue = 1 - chi2CDF(H, df);
  return { H, df, pValue, significant: pValue < 0.05, groupRanks, tieCorrection: C };
}

// ─── Friedman test (non-parametric repeated measures, 3+ groups) ────────
// Use χ² approximation for Q (was using the broken fCDF-as-χ² proxy).
function friedmanTest(groups, labels) {
  const n = groups[0].length;
  if (groups.some(g => g.length !== n) || n < 2) return null;
  const k = groups.length;
  // Rank within each block (subject across occasions)
  const rankMatrix = Array.from({ length: n }, (_, i) => {
    const block = groups.map(g => g[i]);
    const ranks = rankArray(block);
    return ranks;
  });
  const rankSums = Array(k).fill(0);
  for (let j = 0; j < k; j++)
    for (let i = 0; i < n; i++)
      rankSums[j] += rankMatrix[i][j];
  const meanRank = (k + 1) / 2;
  const ss = rankSums.reduce((s, rj) => s + (rj - n * meanRank) ** 2, 0);
  const Q = 12 / (n * k * (k + 1)) * ss;
  const df = k - 1;
  // Friedman's Q is asymptotically χ²(df). The previous code used `1 - fCDF(Q, df, 1e5)`
  // which is wrong. Use the χ² CDF directly; keep the small-n F-approximation as a
  // refinement (this one IS a real F statistic, so fCDF is appropriate here).
  let pValue = 1 - chi2CDF(Q, df);
  if (n < 10 && k > 2) {
    const F_approx = ((n - 1) * Q) / (n * (k - 1) - Q);
    const df1 = k - 1;
    const df2 = (n - 1) * (k - 1);
    if (F_approx > 0 && df2 > 0) pValue = 1 - fCDF(F_approx, df1, df2);
  }
  // Kendall's W (effect size for Friedman)
  const totalSS = (n * k * (k + 1) * (k - 1)) / 12;
  const kendallW = totalSS > 0 ? ss / totalSS : 0;
  return { Q, df, pValue, significant: pValue < 0.05, kendallW, rankSums, groupRanks: labels.map((l, j) => ({ label: l, meanRank: rankSums[j] / n })) };
}

// ─── Repeated measures ANOVA ─────────────────────────────────────────────
function repeatedMeasuresANOVA(groups) {
  const n = groups[0].length;
  const k = groups.length;
  if (groups.some(g => g.length !== n) || n < 3 || k < 2) return null;
  const subjectMeans = Array.from({ length: n }, (_, i) => mean(groups.map(g => g[i])));
  const grandMean = mean(subjectMeans);
  const conditionMeans = groups.map(g => mean(g));
  // SS between conditions
  const ssCond = n * conditionMeans.reduce((s, cm) => s + (cm - grandMean) ** 2, 0);
  // SS between subjects
  const ssSubj = k * subjectMeans.reduce((s, sm) => s + (sm - grandMean) ** 2, 0);
  // Total SS
  let ssTot = 0;
  for (let j = 0; j < k; j++)
    for (let i = 0; i < n; i++)
      ssTot += (groups[j][i] - grandMean) ** 2;
  const ssErr = ssTot - ssCond - ssSubj;
  const dfCond = k - 1;
  const dfErr = (k - 1) * (n - 1);
  if (dfErr <= 0) return null;
  const msCond = ssCond / dfCond;
  const msErr = ssErr / dfErr;
  const F = msErr > 0 ? msCond / msErr : 0;
  const pValue = 1 - fCDF(F, dfCond, dfErr);
  const partialEtaSq = (ssCond + ssErr) > 0 ? ssCond / (ssCond + ssErr) : 0;
  return { F, dfCond, dfErr, pValue, significant: pValue < 0.05, ssCond, ssErr, ssSubj, partialEtaSq, conditionMeans, grandMean };
}

// Post-hoc for repeated measures (Bonferroni-corrected paired t-tests)
function pairedPostHoc(groups, labels) {
  const results = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const diff = mean(groups[i]) - mean(groups[j]);
      const tRes = tTestPaired(groups[i], groups[j]);
      if (!tRes) continue;
      results.push({
        groupA: labels[i], groupB: labels[j],
        meanDiff: diff,
        t: tRes.t,
        df: tRes.df,
        pValue: tRes.pValue,
        significant: tRes.significant,
      });
    }
  }
  return results;
}

// ─── Effect sizes ─────────────────────────────────────────────────────────
function cohensD_(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  const m1 = mean(arr1), m2 = mean(arr2);
  const sd1 = stdev(arr1, m1), sd2 = stdev(arr2, m2);
  const sdPooled = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
  if (!sdPooled) return null;
  const d = (m1 - m2) / sdPooled;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + d * d / (2 * (n1 + n2)));
  const z = 1.96;
  const absD = Math.abs(d);
  const interpretation = absD < 0.2 ? "Negligible" : absD < 0.5 ? "Small" : absD < 0.8 ? "Medium" : absD < 1.2 ? "Large" : "Very large";
  return { cohensD: d, ci95: [d - z * se, d + z * se], interpretation, measure: "Cohen's d" };
}

function effectSizeForTest(testName, result, groups) {
  if (!result) return null;
  if (testName === "Independent t-test" || testName === "Welch's t-test") {
    return cohensD_(groups[0], groups[1]);
  }
  if (testName === "Paired t-test") {
    const n = groups[0].length;
    const dz = result.t / Math.sqrt(n);
    const absDz = Math.abs(dz);
    const interpretation = absDz < 0.2 ? "Negligible" : absDz < 0.5 ? "Small" : absDz < 0.8 ? "Medium" : absDz < 1.2 ? "Large" : "Very large";
    return { cohensDz: dz, interpretation, measure: "Cohen's dz" };
  }
  if (testName === "Mann-Whitney U") {
    const n1 = groups[0].length, n2 = groups[1].length;
    const rankBiserial = 1 - 2 * result.U / (n1 * n2);
    const absR = Math.abs(rankBiserial);
    const interpretation = absR < 0.1 ? "Negligible" : absR < 0.3 ? "Small" : absR < 0.5 ? "Medium" : absR < 0.7 ? "Large" : "Very large";
    return { rankBiserial, interpretation, measure: "Rank-biserial r" };
  }
  if (testName === "Wilcoxon signed-rank") {
    const n = groups[0].length;
    const r = result.z / Math.sqrt(n);
    const absR = Math.abs(r);
    const interpretation = absR < 0.1 ? "Negligible" : absR < 0.3 ? "Small" : absR < 0.5 ? "Medium" : absR < 0.7 ? "Large" : "Very large";
    return { matchedPairsR: r, interpretation, measure: "Matched-pairs rank-biserial" };
  }
  if (testName === "One-way ANOVA") {
    const etaSq = result.ssBetween / (result.ssBetween + result.ssWithin);
    const omegaSq = (result.ssBetween - result.dfBetween * result.msWithin) / (result.ssBetween + result.ssWithin + result.msWithin);
    const absEta = Math.abs(etaSq);
    const interpretation = absEta < 0.01 ? "Negligible" : absEta < 0.06 ? "Small" : absEta < 0.14 ? "Medium" : "Large";
    return { etaSq, omegaSq, interpretation, measure: "η² / ω²" };
  }
  if (testName === "Repeated measures ANOVA") {
    const interpretation = result.partialEtaSq < 0.01 ? "Negligible" : result.partialEtaSq < 0.06 ? "Small" : result.partialEtaSq < 0.14 ? "Medium" : "Large";
    return { partialEtaSq: result.partialEtaSq, interpretation, measure: "Partial η²" };
  }
  if (testName === "Kruskal-Wallis") {
    const N = groups.flat().length;
    const epsilonSq = N > 1 ? result.H / ((N ** 2 - 1) / (N + 1)) : 0;
    const absEps = Math.abs(epsilonSq);
    const interpretation = absEps < 0.01 ? "Negligible" : absEps < 0.06 ? "Small" : absEps < 0.14 ? "Medium" : "Large";
    return { epsilonSq, interpretation, measure: "Epsilon-squared" };
  }
  if (testName === "Friedman test") {
    const interpretation = result.kendallW < 0.1 ? "Negligible" : result.kendallW < 0.3 ? "Small" : result.kendallW < 0.5 ? "Medium" : "Large";
    return { kendallW: result.kendallW, interpretation, measure: "Kendall's W" };
  }
  return null;
}

function independentTTest(arr1, arr2, welch = false) {
  const n1 = arr1.length, n2 = arr2.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(arr1), m2 = mean(arr2);
  const v1 = variance(arr1, m1), v2 = variance(arr2, m2);
  if (welch) {
    const se = Math.sqrt(v1 / n1 + v2 / n2);
    if (se === 0) return null;
    const t = (m1 - m2) / se;
    const dfNum = (v1 / n1 + v2 / n2) ** 2;
    const dfDen = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
    const df = dfDen === 0 ? Math.min(n1 - 1, n2 - 1) : dfNum / dfDen;
    // Welch-Satterthwaite df is fractional by construction; rounding it loses precision
    // and is unnecessary since the t CDF accepts non-integer df.
    const pValue = 2 * (1 - tDistributeCDF(Math.abs(t), df));
    return { t, df, pValue, significant: pValue < 0.05, method: "Welch's t-test" };
  }
  const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  const se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const t = (m1 - m2) / se;
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tDistributeCDF(Math.abs(t), df));
  return { t, df, pValue, significant: pValue < 0.05, method: "Independent t-test" };
}

// Studentized range distribution CDF: P(q ≤ Q) where Q = range/k · ... is the
// distribution of (max mean − min mean)/s with k means and df error df.
// Integrand: ∫₀^∞ [Φ(q·x/√2)]^(k−1) · 2·f_df(x) dx, where the previous version raised
// Φ to only (k−1) and used a single Φ factor — that misses the k-th order statistic
// structure. The correct density integrates the probability that k−1 N(0,1) draws are
// all below q·x/√2 AND the remaining one is the maximum, giving the standard form
// P(q) = √(df/π) · Γ(df/2) / Γ((df+1)/2) · ∫₀^∞ [Φ(qx) − Φ(−qx)]^(k−1) · x·... .
// We use the standard Glidden form (Φ(qx)−Φ(−qx))^(k-1) integrated over the chi
// distribution.
function studentizedRangeCDF(q, k, df) {
  if (q <= 0 || k < 2 || df < 1) return 0;
  // Use more Simpson steps and wider integration bound for accuracy with small df
  const steps = Math.max(200, Math.round(40 * Math.min(1, df / 10)));
  const dHalf = df / 2;
  let p = 0;
  const maxX = Math.max(6 + q / 2, q + 10);
  for (let i = 0; i <= steps; i++) {
    const x = (maxX * i) / steps;
    const z = q * x / Math.SQRT2;
    const inner = Math.pow(normalCdf(z) - normalCdf(-z), k - 1);
    const w = (i === 0 || i === steps) ? 1 : (i % 2 === 1 ? 4 : 2);
    const logF = (df - 1) * Math.log(Math.max(x, 1e-9)) - dHalf * x * x;
    p += w * inner * Math.exp(logF);
  }
  p = p * (maxX / (3 * steps));
  let norm = 0;
  for (let i = 0; i <= steps; i++) {
    const x = (maxX * i) / steps;
    const w = (i === 0 || i === steps) ? 1 : (i % 2 === 1 ? 4 : 2);
    const logF = (df - 1) * Math.log(Math.max(x, 1e-9)) - dHalf * x * x;
    norm += w * Math.exp(logF);
  }
  norm = norm * (maxX / (3 * steps));
  if (norm <= 0) return 0;
  return Math.min(1, Math.max(0, p / norm));
}

// Tukey's HSD with the q-critical value obtained by inverting the studentized range CDF
// (binary search) instead of the crude linear guess `3.6 + (k-2)*0.5` that ignored dfError
// and was far too conservative for small k.
function tukeysHSD(groups, labels, mse, dfError) {
  const results = [];
  const k = groups.length;
  // Solve studentizedRangeCDF(qCrit, k, dfError) = 1 - alpha (alpha=0.05 → 0.95)
  const target = 0.95;
  let lo = 1.0, hi = 12.0, qCrit = hi;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    const cdf = studentizedRangeCDF(mid, k, dfError);
    if (cdf < target) lo = mid; else hi = mid;
    if (Math.abs(cdf - target) < 1e-4) { qCrit = mid; break; }
  }
  if (qCrit > 11.9) qCrit = 3.6 + (k - 2) * 0.5; // fallback if inversion fails
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const ni = groups[i].length, nj = groups[j].length;
      const mi = mean(groups[i]), mj = mean(groups[j]);
      const diff = mi - mj;
      const se = Math.sqrt(mse * (1 / ni + 1 / nj) / 2);
      if (se === 0) continue;
      const q = Math.abs(diff) / se;
      const p = 1 - studentizedRangeCDF(q, k, dfError);
      results.push({
        groupA: labels[i], groupB: labels[j],
        meanDiff: diff, se, q, pValue: Math.min(1, Math.max(0, p)),
        significant: q > qCrit,
        qCritical: qCrit,
        ci95: [diff - qCrit * se, diff + qCrit * se],
      });
    }
  }
  return results;
}

function bonferroniAdjust(pValues, alpha = 0.05) {
  const m = pValues.length;
  return pValues.map((p, i) => ({
    index: i, original: p,
    adjusted: Math.min(p * m, 1),
    significant: p * m < alpha,
  }));
}

// Approximate F from Wilks' lambda. Guard against NaN when the sphericity-ish
// discriminant `p²(k-1)² − 4` is non-positive (e.g., p=2,k=2); fall back to the
// exact 2-DV / 2-group Rao F form in those cases.
function fFromWilks(lambda, p, k, N) {
  const df1 = p * (k - 1);
  const disc = p * p * (k - 1) ** 2 - 4;
  let df2, F;
  if (disc <= 0) {
    // Exact small-case form: F = ((1-Λ)/Λ) · (df2/df1), df2 = N - p - k + 1
    df2 = N - p - k + 1;
    F = df2 > 0 && lambda > 0 ? ((1 - lambda) / lambda) * (df2 / df1) : 0;
  } else {
    const t = Math.sqrt(disc / (p * p + (k - 1) ** 2 - 5));
    df2 = t * (N - (p + k) / 2 + 0.5) - (p * (k - 1) - 2) / 2;
    F = ((1 - lambda ** (1 / t)) / (lambda ** (1 / t))) * (df2 / df1);
  }
  if (!isFinite(F) || !isFinite(df2) || df2 <= 0 || df1 <= 0) return null;
  const pValue = 1 - fCDF(F, df1, df2);
  return { F, df1, df2, pValue };
}

function eigenvalues2x2(A) {
  const tr = A[0][0] + A[1][1];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const d = tr * tr - 4 * det;
  if (d < 0) return [tr / 2, tr / 2];
  const sqrtD = Math.sqrt(d);
  return [(tr + sqrtD) / 2, (tr - sqrtD) / 2];
}

// Jacobi eigenvalue iteration for a SYMMETRIC matrix (returns eigenvalues, all real).
// Used for MANOVA: the canonical roots are the eigenvalues of E^{-1/2} H E^{-1/2},
// which is symmetric (H and E are symmetric, E positive-definite). The previous code
// returned the placeholder [1] for >2 DVs, making Wilks/Pillai/Hotelling/Roy and the
// Rao-F meaningless for 3+ measurement variables.
function jacobiEigenSym(A, maxIter = 100, tol = 1e-12) {
  const n = A.length;
  const M = A.map(row => row.slice());
  for (let sweep = 0; sweep < maxIter; sweep++) {
    let off = 0;
    for (let r = 0; r < n; r++) for (let c = r + 1; c < n; c++) off += M[r][c] * M[r][c];
    if (off < tol) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-18) continue;
        const app = M[p][p], aqq = M[q][q], apq = M[p][q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let i = 0; i < n; i++) {
          const mip = M[i][p], miq = M[i][q];
          M[i][p] = c * mip - s * miq; M[i][q] = s * mip + c * miq;
        }
        for (let i = 0; i < n; i++) {
          const mpi = M[p][i], mqi = M[q][i];
          M[p][i] = c * mpi - s * mqi; M[q][i] = s * mpi + c * mqi;
        }
      }
    }
  }
  return M.map((row, i) => row[i]);
}

// E^{-1/2} for a symmetric positive-definite E, via Jacobi eigendecomposition.
// E = V · diag(λ) · V^T  →  E^{-1/2} = V · diag(1/√λ) · V^T.
function jacobiInverseSqrt(E) {
  const n = E.length;
  let V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  const M = E.map(row => row.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let r = 0; r < n; r++) for (let c = r + 1; c < n; c++) off += M[r][c] * M[r][c];
    if (off < 1e-14) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-18) continue;
        const app = M[p][p], aqq = M[q][q], apq = M[p][q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq; V[i][q] = s * vip + c * viq;
        }
        for (let i = 0; i < n; i++) {
          const mip = M[i][p], miq = M[i][q];
          M[i][p] = c * mip - s * miq; M[i][q] = s * mip + c * miq;
        }
        for (let i = 0; i < n; i++) {
          const mpi = M[p][i], mqi = M[q][i];
          M[p][i] = c * mpi - s * mqi; M[q][i] = s * mpi + c * mqi;
        }
      }
    }
  }
  const eigVals = M.map((row, i) => row[i]);
  const dInv = eigVals.map(l => 1 / Math.sqrt(Math.max(l, 1e-12)));
  // E^{-1/2} = V · diag(dInv) · V^T
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += V[i][k] * dInv[k] * V[j][k];
    out[i][j] = s;
  }
  return out;
}

// ─── Box's M test for homogeneity of covariance matrices (MANOVA assumption) ─
// Box (1949). Compares each group's covariance matrix to the pooled within-group
// covariance. Chi-square approximation per Rencher (2002) §7.3.2:
//   M = (N−k)·ln|S_pl| − Σ_g (n_g−1)·ln|S_g|
//   c1 = [(2p²+3p−1)/(6(p+1)(k−1))]·[Σ 1/(n_g−1) − 1/(N−k)]
//   X² = M·(1 − c1) ~ χ²(df),  df = p(p+1)(k−1)/2
// Previously absent: MANOVA ran blind to its key covariance-homogeneity assumption.
function _logDetSym(S) {
  const ev = jacobiEigenSym(S);
  if (ev.some(v => v <= 0)) return -Infinity;
  return ev.reduce((s, v) => s + Math.log(v), 0);
}
function _sampleCov(mat, p) {
  const n = mat.length;
  const mu = Array(p).fill(0);
  for (const row of mat) for (let j = 0; j < p; j++) mu[j] += row[j];
  for (let j = 0; j < p; j++) mu[j] /= n;
  const C = Array.from({ length: p }, () => Array(p).fill(0));
  for (const row of mat) for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) C[r][c] += (row[r] - mu[r]) * (row[c] - mu[c]);
  for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) C[r][c] /= Math.max(n - 1, 1);
  return C;
}
export function boxMTest(matrices, p) {
  const k = matrices.length;
  const ns = matrices.map(m => m.length);
  const N = ns.reduce((a, b) => a + b, 0);
  const withinDf = N - k;
  if (withinDf <= 0 || ns.some(n => n - 1 < p)) {
    return { skipped: true, reason: "Box's M requires n_g > p in every group (covariance non-singular)." };
  }
  const groupCovs = matrices.map(mat => _sampleCov(mat, p));
  // Pooled within covariance = Σ_g (n_g−1)·S_g / (N−k)  (== E / (N−k) computed independently here)
  const pooled = Array.from({ length: p }, () => Array(p).fill(0));
  for (let g = 0; g < k; g++) {
    const w = ns[g] - 1;
    for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) pooled[r][c] += w * groupCovs[g][r][c];
  }
  for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) pooled[r][c] /= withinDf;
  const logDetPooled = _logDetSym(pooled);
  const logDetGroups = groupCovs.map(_logDetSym);
  if (!isFinite(logDetPooled) || logDetGroups.some(ld => !isFinite(ld))) {
    return { skipped: true, reason: "Box's M: a group covariance matrix is singular." };
  }
  const M = withinDf * logDetPooled - ns.reduce((acc, n, g) => acc + (n - 1) * logDetGroups[g], 0);
  const t = ns.reduce((acc, n) => acc + 1 / (n - 1), 0) - 1 / withinDf;
  const c1 = (2 * p * p + 3 * p - 1) / (6 * (p + 1) * (k - 1)) * t;
  const df = p * (p + 1) * (k - 1) / 2;
  const chi2 = M * (1 - c1);
  const pValue = 1 - chi2CDF(chi2, df);
  const warnings = [];
  if (c1 > 0.1) warnings.push("Box's M correction c1 is large; the χ² approximation may be liberal (small/unbalanced groups).");
  return { test: "Box's M (χ² approx.)", M, chi2, df, pValue, significant: pValue < 0.05, correction: c1, warnings };
}

function runMANOVA(groups, measurements) {
  const groupKeys = Object.keys(groups);
  const k = groupKeys.length;
  const p = measurements.length;
  if (k < 2 || p < 2) return null;
  const matrices = groupKeys.map(g => groups[g].map(c => measurements.map(m => c[m])));
  const ns = matrices.map(m => m.length);
  const N = ns.reduce((a, b) => a + b, 0);
  const grandMeans = measurements.map((_, j) => mean(matrices.flat().map(row => row[j])));
  const groupMeans = matrices.map(mat => measurements.map((_, j) => mean(mat.map(row => row[j]))));

  const zeros = () => Array.from({ length: p }, () => Array(p).fill(0));
  const H = zeros();
  for (let g = 0; g < k; g++) {
    const d = groupMeans[g].map((v, i) => v - grandMeans[i]);
    for (let r = 0; r < p; r++)
      for (let c = 0; c < p; c++)
        H[r][c] += ns[g] * d[r] * d[c];
  }
  const E = zeros();
  for (let g = 0; g < k; g++) {
    for (const obs of matrices[g]) {
      const d = obs.map((v, i) => v - groupMeans[g][i]);
      for (let r = 0; r < p; r++)
        for (let c = 0; c < p; c++)
          E[r][c] += d[r] * d[c];
    }
  }
  const Einv = matInverse(E);
  if (!Einv) return null;
  // Canonical roots = eigenvalues of E^{-1/2} H E^{-1/2} (symmetric → real roots via Jacobi).
  // For p === 2 keep the closed-form (exact, fast); for p > 2 use the general symmetric
  // path (previously stubbed to [1], which made all four MANOVA statistics meaningless).
  let eigenvals;
  if (p === 2) {
    eigenvals = eigenvalues2x2(matMul(Einv, H));
  } else {
    const EinvSqrt = jacobiInverseSqrt(E);
    const M = matMul(EinvSqrt, matMul(H, EinvSqrt));
    eigenvals = jacobiEigenSym(M).map(v => Math.max(0, v));
  }
  const wilksLambda = eigenvals.reduce((prod, ev) => prod / (1 + ev), 1);
  const pillaiTrace = eigenvals.reduce((sum, ev) => sum + ev / (1 + ev), 0);
  const fApprox = fFromWilks(wilksLambda, p, k, N);
  return {
    wilksLambda, pillaiTrace,
    hotellingsTrace: eigenvals.reduce((a, e) => a + e, 0),
    roysLargestRoot: Math.max(...eigenvals),
    F: fApprox ? fApprox.F : null, df1: fApprox ? fApprox.df1 : null, df2: fApprox ? fApprox.df2 : null,
    pValue: fApprox ? fApprox.pValue : null,
    significant: fApprox ? fApprox.pValue < 0.05 : false,
    eigenvalues: eigenvals,
    nGroups: k, nDVs: p, N,
    boxM: boxMTest(matrices, p),
  };
}

// ─── Test selection logic ──────────────────────────────────────────────────
function selectAndRunTest(labelData, design, alpha) {
  const groups = Object.values(labelData);
  const groupLabels = Object.keys(labelData);
  const nGroups = groups.length;
  const ns = groups.map(g => g.length);
  const minN = Math.min(...ns);

  if (groups.some(g => g.length < 2)) {
    return { skip: true, reason: "Insufficient data (<2 per group)" };
  }

  const a = alpha || 0.05;
  const normalityTests = groups.map(g => shapiroWilk(g));
  const allNormal = normalityTests.every(t => t && t.pValue > a);
  const paired = design === "paired";

  // For paired designs, all groups must have equal size
  if (paired && groups.some(g => g.length !== groups[0].length)) {
    return { skip: true, reason: "Paired design requires equal group sizes" };
  }

  let testName, result, assumptions = { normalityTests, allNormal };

  // Check equal variance only for independent designs
  if (!paired) {
    const levene = allNormal ? levenesTest(...groups) : null;
    const equalVar = levene ? levene.pValue > a : false;
    assumptions.levene = levene;
    assumptions.equalVar = equalVar;
  }

  try {
    if (paired) {
      if (nGroups === 2) {
        if (allNormal && minN >= 5) {
          testName = "Paired t-test";
          result = tTestPaired(groups[0], groups[1]);
        } else {
          testName = "Wilcoxon signed-rank";
          result = wilcoxonSignedRank(groups[0], groups[1]);
        }
      } else {
        if (allNormal && minN >= 5) {
          testName = "Repeated measures ANOVA";
          result = repeatedMeasuresANOVA(groups);
        } else {
          testName = "Friedman test";
          result = friedmanTest(groups, groupLabels);
        }
      }
    } else {
      // independent design
      if (nGroups === 2) {
        if (allNormal && minN >= 5) {
          testName = assumptions.equalVar ? "Independent t-test" : "Welch's t-test";
          result = independentTTest(groups[0], groups[1], !assumptions.equalVar);
        } else {
          testName = "Mann-Whitney U";
          result = mannWhitneyU(groups[0], groups[1]);
        }
      } else {
        if (allNormal && assumptions.equalVar && minN >= 5) {
          testName = "One-way ANOVA";
          result = oneWayAnova(...groups);
        } else {
          testName = "Kruskal-Wallis";
          result = kruskalWallis(groups, groupLabels);
        }
      }
    }
  } catch (e) {
    return { skip: true, reason: e.message };
  }

  if (!result) return { skip: true, reason: "Test returned null" };

  // ── Compute effect size appropriate for the test ──
  const effectSize = effectSizeForTest(testName, result, groups);

  // ── Build raw data summary ──
  const rawData = {};
  groupLabels.forEach((l, i) => {
    rawData[l] = { values: groups[i], n: ns[i], mean: mean(groups[i]), sd: stdev(groups[i], mean(groups[i])) };
  });

  return { testName, result, assumptions, rawData, effectSize };
}

// ─── Collect measurements per group ────────────────────────────────────────
function collectGroupedMeasurements(sessions, groups, labelIds, calibration) {
  const byGroup = {};
  for (const g of groups) {
    const gSessions = (g.caseIds || []).map(id => sessions.find(s => s.id === id)).filter(Boolean);
    const byLabel = {};
    const units = {};
    for (const s of gSessions) {
      const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
      const markups = s.markups || [];
      for (const m of markups) {
        if (!m.label) continue;
        if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
        if (m.type === "ruler" || m.type === "silhouette") continue;
        if (!m.visible || !m.placed) continue;
        try {
          const vals = computeMeasurements(m, cal);
          const firstKey = Object.keys(vals).find(k => typeof vals[k] === "number" && isFinite(vals[k]) && !k.startsWith("_"));
          const firstNum = firstKey != null ? vals[firstKey] : undefined;
          if (firstNum != null) {
            if (!byLabel[m.label]) byLabel[m.label] = [];
            byLabel[m.label].push(firstNum);
            if (!units[m.label]) units[m.label] = unitForKey(firstKey, vals._unit);
          }
        } catch (e) { logError("comparative/label", e); }
      }
    }
    byGroup[g.label] = { group: g, sessions: gSessions, byLabel, units };
  }
  return byGroup;
}

// ─── Main entry point ──────────────────────────────────────────────────────
export function runComparativeAll(sessions, config, calibration) {
  const { design, groups, labelIds, alpha, mcCorrection } = config;

  if (!groups || groups.length < 2) return { error: "At least 2 groups required" };
  const byGroup = collectGroupedMeasurements(sessions, groups, labelIds || [], calibration);
  const groupLabels = groups.map(g => g.label);

  // Collect all available labels across groups
  const allLabels = [...new Set(
    Object.values(byGroup).flatMap(g => Object.keys(g.byLabel))
  )].sort();

  const results = {
    design,
    groups: groups.map(g => ({ label: g.label, caseCount: (g.caseIds || []).length })),
    labels: {},
    manova: null,
    groupData: {},
    alpha: alpha || 0.05,
    mcCorrection: mcCorrection || "bonferroni",
    warnings: [],
  };

  // Minimum-sample-size warnings
  const groupSizes = groups.map(g => (g.caseIds || []).length);
  const minGroupN = Math.min(...groupSizes);
  if (minGroupN < 10) results.warnings.push(`Smallest group has ${minGroupN} cases — parametric tests (t-test, ANOVA) require ≥ 5-10 per group for adequate normality approximation. Results may be unreliable.`);
  const totalN = groupSizes.reduce((a, b) => a + b, 0);
  if (totalN < 30 && groups.length >= 3) results.warnings.push(`Total N = ${totalN} across ${groups.length} groups — post-hoc tests (Tukey HSD) have low power at this sample size.`);

  // Per-label test results
  for (const label of allLabels) {
    const labelData = {};
    for (const gLabel of groupLabels) {
      const vals = (byGroup[gLabel]?.byLabel[label] || []);
      labelData[gLabel] = vals;
    }
    results.labels[label] = selectAndRunTest(labelData, design, alpha || 0.05);
    results.labels[label].label = label;
    for (const gLabel of groupLabels) {
      const u = byGroup[gLabel]?.units?.[label];
      if (u) { results.labels[label].unit = u; break; }
    }
  }

  // Group descriptive data
  for (const gLabel of groupLabels) {
    const gd = byGroup[gLabel];
    if (!gd) continue;
    results.groupData[gLabel] = {
      nSessions: gd.sessions.length,
      labelCounts: Object.fromEntries(
        Object.entries(gd.byLabel).map(([l, vals]) => [l, vals.length])
      ),
    };
  }

  // Multi-group post-hoc (only for 3+ groups)
  if (groups.length >= 3) {
    results.postHoc = {};
    for (const [label, lr] of Object.entries(results.labels)) {
      if (lr.skip || !lr.result) continue;
      const isIndependentANOVA = lr.testName === "One-way ANOVA";
      const isRepeatedANOVA = lr.testName === "Repeated measures ANOVA";
      if (!isIndependentANOVA && !isRepeatedANOVA) continue;

      const gVals = groupLabels.map(gl => (byGroup[gl]?.byLabel[label] || []));

      if (isIndependentANOVA) {
        const mse = lr.result.msWithin;
        const dfE = lr.result.dfWithin;
        results.postHoc[label] = tukeysHSD(gVals, groupLabels, mse, dfE);
      } else if (isRepeatedANOVA) {
        // Bonferroni-corrected paired t-tests for repeated measures
        const raw = pairedPostHoc(gVals, groupLabels);
        const m = raw.length;
        if (m > 0) {
          results.postHoc[label] = raw.map(r => ({
            ...r,
            pAdjusted: Math.min(r.pValue * m, 1),
            significant: r.pValue * m < (alpha || 0.05),
          }));
        }
      }
    }
  }

  // Multiple comparison correction
  if (mcCorrection && mcCorrection !== "none") {
    const labels = Object.entries(results.labels).filter(([, lr]) => !lr.skip && lr.result && lr.result.pValue != null);
    const pValues = labels.map(([, lr]) => lr.result.pValue);
    if (pValues.length > 0) {
      let corrected;
      if (mcCorrection === "bonferroni") corrected = bonferroniAdjust(pValues, alpha || 0.05);
      else if (mcCorrection === "bh") corrected = benjaminiHochberg(pValues, alpha || 0.05);
      else corrected = pValues.map(p => ({ original: p, adjusted: p, significant: p < (alpha || 0.05) }));
      labels.forEach(([label], i) => {
        results.labels[label].mcCorrected = corrected[i];
      });
    }
  }

  // MANOVA (if multiple labels)
  const validLabels = allLabels.filter(l => {
    const lr = results.labels[l];
    return !lr.skip && lr.rawData;
  });
  if (validLabels.length >= 2) {
    const manovaGroups = {};
    for (const gLabel of groupLabels) {
      manovaGroups[gLabel] = [];
      const sessionsInGroup = byGroup[gLabel]?.sessions || [];
      for (const s of sessionsInGroup) {
        const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
        const entry = {};
        let valid = true;
        for (const label of validLabels) {
          const markups = (s.markups || []).filter(m => m.label === label && m.visible && m.placed);
          let val = null;
          for (const m of markups) {
            try {
              const v = Object.values(computeMeasurements(m, cal)).find(x => typeof x === "number" && isFinite(x));
              if (v != null) { val = v; break; }
        } catch (e) { logError("comparative/collect", e); }
          }
          if (val == null) { valid = false; break; }
          entry[label] = val;
        }
        if (valid) manovaGroups[gLabel].push(entry);
      }
    }
    const manovaCounts = Object.values(manovaGroups).map(s => s.length);
    if (manovaCounts.every(n => n >= 2)) {
      results.manova = runMANOVA(manovaGroups, validLabels);
    }
  }

  return results;
}
