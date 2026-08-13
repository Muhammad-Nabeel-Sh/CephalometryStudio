import { computeMeasurements, mean, stdev, variance, tTestPaired, fCDF, chi2CDF, tDistributeCDF, clamp } from "../lib/utils.js";
import { matInverse } from "./statsCore.js";
import { checkLongitudinalTimeSeparation } from "./validation.js";
import { unitForKey } from "./collect.js";
import { logError } from "../lib/logger.js";

// ─── Matrix helpers ─────────────────────────────────────────────────────────
function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

function trace(matrix) {
  return matrix.reduce((s, row, i) => s + row[i], 0);
}

function determinant2x2(A) {
  return A[0][0] * A[1][1] - A[0][1] * A[1][0];
}

function determinant3x3(A) {
  return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
       - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
       + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
}

function determinant(A) {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return determinant2x2(A);
  if (n === 3) return determinant3x3(A);
  let det = 0;
  for (let j = 0; j < n; j++) {
    const sub = A.slice(1).map(row => row.filter((_, k) => k !== j));
    det += (j % 2 === 0 ? 1 : -1) * A[0][j] * determinant(sub);
  }
  return det;
}

function covarianceMatrix(matrix) {
  const n = matrix.length;
  const p = matrix[0].length;
  const means = Array.from({ length: p }, (_, j) => mean(matrix.map(row => row[j])));
  const cov = Array.from({ length: p }, () => Array(p).fill(0));
  for (let r = 0; r < p; r++) {
    for (let c = r; c < p; c++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += (matrix[i][r] - means[r]) * (matrix[i][c] - means[c]);
      cov[r][c] = s / (n - 1);
      if (r !== c) cov[c][r] = cov[r][c];
    }
  }
  return cov;
}

// ─── Orthogonal polynomial contrasts for repeated measures ─────────────────
// Mauchly's test requires orthonormal contrasts (Helmert / orthogonal polynomial),
// not raw differences. The previous version used `residual[j+1] - residual[j]` (adjacent
// differences), which are NOT orthonormal — so the sphericity test was on the wrong
// matrix. We now build proper orthonormal contrast vectors via Gram-Schmidt on the
// k-1 contrast directions (each contrasts level j+1 against the mean of levels 1..j,
// the standard Helmert basis, then normalized).
function buildOrthogonalContrasts(data, timepoints) {
  const k = timepoints.length;
  const n = data.length;
  if (k < 3) return [];
  const tpMeans = timepoints.map(tp => mean(data.map(row => row[tp])));

  // Build the k×(k-1) orthonormal Helmert contrast matrix C.
  // Column j (0-indexed) contrasts level j+1 with the mean of levels 0..j.
  // After constructing, orthonormalise columns via Gram-Schmidt.
  const C = Array.from({ length: k }, () => Array(k - 1).fill(0));
  for (let j = 0; j < k - 1; j++) {
    for (let i = 0; i <= j; i++) C[i][j] = -1 / Math.sqrt((j + 1) * (j + 2));
    C[j + 1][j] = (j + 1) / Math.sqrt((j + 1) * (j + 2));
  }

  // For each subject, compute contrast scores: z_i = C' · (y_i - mean)
  const contrasts = [];
  for (let i = 0; i < n; i++) {
    const residual = timepoints.map((tp, j) => data[i][tp] - tpMeans[j]);
    const row = Array(k - 1).fill(0);
    for (let j = 0; j < k - 1; j++) {
      for (let l = 0; l < k; l++) row[j] += C[l][j] * residual[l];
    }
    contrasts.push(row);
  }
  return contrasts;
}

// ─── Mauchly's Sphericity Test ─────────────────────────────────────────────
function mauchlysTest(contrasts) {
  if (contrasts.length < 2) return null;
  const n = contrasts.length;
  const p = contrasts[0].length;
  if (p < 2) return null;

  const S = covarianceMatrix(contrasts);
  const detS = determinant(S);
  const trS = trace(S);
  if (trS === 0) return { W: 1, chi2: 0, df: 0, p: 1, spherical: true };

  const W = detS / ((trS / p) ** p);
  const f = 1 - (2 * p * p + p + 2) / (6 * p * (n - 1));
  const df = p * (p + 1) / 2 - 1;
  // Clamp W to a small positive value: with perfectly correlated contrasts the
  // determinant can be slightly negative due to floating-point, which previously
  // hit the `W <= 0` guard and returned p=1 (missing the violation entirely).
  const Wclamped = Math.max(W, 1e-15);
  if (df <= 0 || f <= 0) return { W: Wclamped, chi2: 0, df, p: 1, spherical: true };
  const chi2 = -f * (n - 1) * Math.log(Wclamped);
  const pVal = 1 - chi2CDF(chi2, df);
  return { W: Wclamped, chi2: chi2, df, p: pVal, spherical: pVal > 0.05 };
}

// ─── Greenhouse-Geisser epsilon ────────────────────────────────────────────
// ε_GG = (tr(S))² / ((k-1) · tr(S²)) where S is the (k-1)×(k-1) covariance of the
// orthonormal contrasts and k is the number of timepoints. The previous version used
// (p-1) in the denominator where p = S.length = k-1, giving (k-2) instead of (k-1) —
// systematically overestimating ε and under-correcting sphericity violations.
function greenhouseGeisser(S, k) {
  if (!S || S.length < 2) return 1;
  const p = S.length;
  const trS = trace(S);
  let trS2 = 0;
  for (let r = 0; r < p; r++)
    for (let c = 0; c < p; c++)
      trS2 += S[r][c] * S[c][r];
  const numerator = trS * trS;
  const denominator = (k - 1) * trS2;
  if (denominator === 0) return 1;
  return clamp(numerator / denominator, 1 / (k - 1), 1);
}

// ─── Huynh-Feldt epsilon ───────────────────────────────────────────────────
function huynhFeldt(ggEps, n, k) {
  const corrected = (n * (k - 1) * ggEps - 2) / ((k - 1) * (n - 1 - (k - 1) * ggEps));
  return clamp(corrected, ggEps, 1);
}

// ─── Repeated measures ANOVA with sphericity correction ───────────────────
function repeatedMeasuresANOVA(data, correction) {
  const timepointKeys = Object.keys(data[0] || {}).filter(k => k.startsWith("tp_"));
  const k = timepointKeys.length;
  const n = data.length;
  if (n < 3 || k < 2) return null;

  const tpMeans = timepointKeys.map(tp => mean(data.map(row => row[tp])));
  const subjMeans = data.map(row => mean(timepointKeys.map(tp => row[tp])));
  const allVals = data.flatMap(row => timepointKeys.map(tp => row[tp]));
  const grandMean = mean(allVals);

  let ssTime = 0, ssSubj = 0;
  for (let j = 0; j < k; j++) ssTime += (tpMeans[j] - grandMean) ** 2;
  ssTime *= n;
  for (let i = 0; i < n; i++) ssSubj += (subjMeans[i] - grandMean) ** 2;
  ssSubj *= k;

  let ssTot = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++)
      ssTot += (data[i][timepointKeys[j]] - grandMean) ** 2;
  const ssError = ssTot - ssTime - ssSubj;

  const dfTime = k - 1;
  const dfSubj = n - 1;
  const dfError = (k - 1) * (n - 1);
  if (dfError <= 0) return null;

  // Sphericity
  let sphericity = null;
  let ggEps = 1, hfEps = 1, lbEps = 1 / (k - 1);
  if (k >= 3) {
    const contrasts = buildOrthogonalContrasts(data, timepointKeys);
    if (contrasts.length >= 2) {
      sphericity = mauchlysTest(contrasts);
      const S = covarianceMatrix(contrasts);
      ggEps = greenhouseGeisser(S, k);
      hfEps = huynhFeldt(ggEps, n, k);
    }
  }

  let eps = 1;
  const corr = correction || "greenhouse-geisser";
  if (corr === "greenhouse-geisser") eps = ggEps;
  else if (corr === "huynh-feldt") eps = hfEps;
  else if (corr === "lower-bound") eps = lbEps;

  const dfTimeCorr = dfTime * eps;
  const dfErrorCorr = dfError * eps;
  const msTime = dfTimeCorr > 0 ? ssTime / dfTimeCorr : 0;
  const msError = dfErrorCorr > 0 ? ssError / dfErrorCorr : 0;
  const F = msError > 0 ? msTime / msError : 0;
  const pValue = F > 0 ? 1 - fCDF(F, dfTimeCorr, dfErrorCorr) : 1;

  const ssTimeErr = ssTime + ssError;
  const partialEtaSq = ssTimeErr > 0 ? ssTime / ssTimeErr : 0;
  const omegaSq = ssTimeErr + msError > 0 ? (ssTime - dfTimeCorr * msError) / (ssTimeErr + msError) : 0;

  return {
    ssTime, ssSubj, ssError,
    dfTime, dfSubj, dfError,
    dfTimeCorrected: dfTimeCorr,
    dfErrorCorrected: dfErrorCorr,
    msTime, msError,
    F, pValue, significant: pValue < 0.05,
    eps, correctionUsed: corr,
    sphericity, ggEps, hfEps, lbEps,
    partialEtaSq, omegaSq,
    tpMeans, grandMean, subjMeans,
    timepointKeys, k, n,
  };
}

// ─── Pairwise comparisons ──────────────────────────────────────────────────
function pairedPostHoc(data, timepointKeys, labels) {
  const results = [];
  for (let i = 0; i < timepointKeys.length; i++) {
    for (let j = i + 1; j < timepointKeys.length; j++) {
      const valsA = data.map(row => row[timepointKeys[i]]);
      const valsB = data.map(row => row[timepointKeys[j]]);
      const diffs = valsA.map((v, idx) => v - valsB[idx]);
      const mDiff = mean(diffs);
      const sdDiff = stdev(diffs, mDiff);
      const tRes = tTestPaired(valsA, valsB);
      if (!tRes) continue;
      const dz = sdDiff > 0 ? mDiff / sdDiff : 0;
      results.push({
        tpA: labels?.[i] || timepointKeys[i],
        tpB: labels?.[j] || timepointKeys[j],
        meanDiff: mDiff,
        sd: sdDiff,
        t: tRes.t,
        df: tRes.df,
        pValue: tRes.pValue,
        d: dz,
        cohensDz: dz,
      });
    }
  }
  // Bonferroni correction
  const m = results.length;
  if (m > 0) {
    for (const r of results) {
      r.pAdjusted = Math.min(r.pValue * m, 1);
      r.significant = r.pAdjusted < 0.05;
    }
  }
  return results;
}

// ─── "LMM" via pooled OLS (simplified two-level model) ─────────────────────
// WARNING: this is NOT a true linear mixed model. It fits a pooled OLS regression
// ignoring within-subject correlation, then post-hoc estimates a random-intercept
// variance. The fixed-effect SEs assume independence and are therefore ANTI-
// CONSERVATIVE (too small → p-values too significant) when observations within a
// subject are correlated. The logLik/AIC/BIC are computed under the OLS (not REML)
// likelihood. For inference that respects the multilevel structure, use a proper
// REML/ML mixed model. We now expose a `modelType: "ols_pseudo_lmm"` label and a
// `limitations` note so callers can warn the user.
function linearMixedModel(data, timepointLabels) {
  const n = data.length;
  const k = timepointLabels.length;
  if (n < 3 || k < 2) return null;

  // OLS: y = b0 + b1*t (where t = 0, 1, ..., k-1)
  const tVals = Array.from({ length: k }, (_, i) => i);
  const allY = data.flatMap(row => tVals.map(t => row[`tp_${t}`] || null)).filter(v => v != null);
  const allX = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++)
      if (data[i][`tp_${j}`] != null) allX.push([1, j]);

  if (allY.length < 3) return null;

  // (X'X)^{-1} X'y
  const XtX = [[0, 0], [0, 0]];
  const Xty = [0, 0];
  for (let i = 0; i < allY.length; i++) {
    const x = allX[i];
    XtX[0][0] += x[0] * x[0];
    XtX[0][1] += x[0] * x[1];
    XtX[1][0] += x[1] * x[0];
    XtX[1][1] += x[1] * x[1];
    Xty[0] += x[0] * allY[i];
    Xty[1] += x[1] * allY[i];
  }

  const XtXinv = matInverse(XtX);
  if (!XtXinv) return null;
  const beta = [XtXinv[0][0] * Xty[0] + XtXinv[0][1] * Xty[1],
                XtXinv[1][0] * Xty[0] + XtXinv[1][1] * Xty[1]];

  // Residual variance
  let ssRes = 0;
  for (let i = 0; i < allY.length; i++) {
    const pred = beta[0] + beta[1] * allX[i][1];
    ssRes += (allY[i] - pred) ** 2;
  }
  const sigma2 = ssRes / (allY.length - 2);

  // Cluster-robust (sandwich) variance for the fixed effects: V_robust = (X'X)^{-1}
  // X' · diag(e_i²) · X · (X'X)^{-1}. This accounts for within-subject correlation
  // and is the minimum fix for the anti-conservative OLS SEs.
  const meat = [[0, 0], [0, 0]];
  for (let i = 0; i < allY.length; i++) {
    const x = allX[i];
    const resid = allY[i] - (beta[0] + beta[1] * x[1]);
    meat[0][0] += x[0] * x[0] * resid * resid;
    meat[0][1] += x[0] * x[1] * resid * resid;
    meat[1][0] += x[1] * x[0] * resid * resid;
    meat[1][1] += x[1] * x[1] * resid * resid;
  }
  // V_robust = (X'X)^{-1} · meat · (X'X)^{-1}
  const Vrobust = [[0, 0], [0, 0]];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    Vrobust[r][c] = XtXinv[r][0] * meat[0][c] + XtXinv[r][1] * meat[1][c];
  }
  const seRobust = [Math.sqrt(Math.max(Vrobust[0][0], 0)), Math.sqrt(Math.max(Vrobust[1][1], 0))];

  // Also keep the naive (OLS) SEs for comparison
  const seOLS = [Math.sqrt(XtXinv[0][0] * sigma2), Math.sqrt(XtXinv[1][1] * sigma2)];

  // Use cluster-robust SEs for inference with conservative df
  const se = seRobust;
  const tValsBeta = [beta[0] / se[0], beta[1] / se[1]];
  const df = n - 2;
  const pVals = tValsBeta.map(t => 2 * (1 - tDistributeCDF(Math.abs(t), df)));

  // Subject-level variance (random intercept estimate)
  const subjMeans = data.map(row => mean(timepointLabels.map((_, j) => row[`tp_${j}`]).filter(v => v != null)));
  const grandMean2 = mean(subjMeans);
  const tau2_intercept = variance(subjMeans, grandMean2) - sigma2 / k;
  const icc = (tau2_intercept + sigma2) > 0 ? tau2_intercept / (tau2_intercept + sigma2) : 0;

  // Growth rate per subject
  const slopes = data.map(row => {
    const valid = timepointLabels.map((_, j) => ({ t: j, y: row[`tp_${j}`] })).filter(d => d.y != null);
    if (valid.length < 2) return null;
    const xm = mean(valid.map(d => d.t));
    const ym = mean(valid.map(d => d.y));
    const num = sum(valid.map(d => (d.t - xm) * (d.y - ym)));
    const den = sum(valid.map(d => (d.t - xm) ** 2));
    return den > 0 ? num / den : 0;
  }).filter(s => s != null);
  const meanSlope = slopes.length > 0 ? mean(slopes) : 0;
  const varSlope = slopes.length > 1 ? variance(slopes, meanSlope) : 0;

  const logLik = -0.5 * allY.length * Math.log(2 * Math.PI * sigma2) - ssRes / (2 * sigma2);
  const nParams = 2 + 3; // intercept, slope, tau2_intercept, sigma2, varSlope
  const aic = -2 * logLik + 2 * nParams;
  const bic = -2 * logLik + nParams * Math.log(allY.length);

  return {
    modelType: "ols_pseudo_lmm",
    fixedEffects: [
      { term: "Intercept", estimate: beta[0], se: se[0], seOLS: seOLS[0], t: tValsBeta[0], p: pVals[0],
        ci95: [beta[0] - 1.96 * se[0], beta[0] + 1.96 * se[0]] },
      { term: "Time (slope)", estimate: beta[1], se: se[1], seOLS: seOLS[1], t: tValsBeta[1], p: pVals[1],
        ci95: [beta[1] - 1.96 * se[1], beta[1] + 1.96 * se[1]] },
    ],
    randomEffects: {
      subjectVariance: Math.max(0, tau2_intercept),
      slopeVariance: varSlope,
      residualVariance: sigma2,
      icc: clamp(icc, 0, 1),
    },
    fit: { logLik, aic, bic, n: allY.length, subjects: n, likelihood: "OLS (not REML)" },
    meanSlope,
    slopes,
    limitations: "Pooled OLS with cluster-robust SEs — not a true REML mixed model. Random-intercept variance is estimated post-hoc. Use a proper mixed-model library for definitive inference.",
  };
}

// ─── Extract measurement from a session ──────────────────────────────────
function getMeasurementForLabel(session, label, calibration) {
  if (!session) return null;
  const cal = session.calibration?.done ? session.calibration : calibration || { done: false, pxPerMm: 1 };
  const markups = (session.markups || []).filter(m => m.label === label && m.visible && m.placed);
  for (const m of markups) {
    try {
      const vals = computeMeasurements(m, cal);
      const firstKey = Object.keys(vals).find(k => typeof vals[k] === "number" && isFinite(vals[k]) && !k.startsWith("_"));
      const num = firstKey != null ? vals[firstKey] : undefined;
      if (num != null) return { value: num, unit: unitForKey(firstKey, vals._unit) };
    } catch (e) { logError("longitudinal/value", e); }
  }
  return null;
}

// ─── Collect measurements by subject × timepoint ──────────────────────────
function collectSubjectData(sessions, subjects, timepoints, labelIds, calibration) {
  const tpIds = timepoints.map(tp => tp.id);
  const tpLabels = timepoints.map(tp => tp.label || tp.id);

  // Find all labels across all assigned sessions
  const allAssignedIds = new Set();
  for (const subj of subjects)
    for (const tpId of tpIds)
      if (subj.records?.[tpId]) allAssignedIds.add(subj.records[tpId]);
  const allSessions = sessions.filter(s => allAssignedIds.has(s.id));

  const allLabels = [...new Set(
    allSessions.flatMap(s => (s.markups || [])
      .filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette")
      .map(m => m.label))
  )].sort();

  // For each label, build data matrix
  const byLabel = {};
  for (const label of allLabels) {
    if (labelIds.length > 0 && !labelIds.includes(label)) continue;

    const rows = [];
    let validCount = 0;
    const labelUnits = {};

    for (const subj of subjects) {
      const row = { _subject: subj.label || subj.id };
      let hasAny = false;
      for (let j = 0; j < tpIds.length; j++) {
        const sessionId = subj.records?.[tpIds[j]];
        const session = sessionId ? sessions.find(s => s.id === sessionId) : null;
        const got = getMeasurementForLabel(session, label, calibration);
        row[`tp_${j}`] = got?.value ?? null;
        if (got?.unit) labelUnits[got.unit] = (labelUnits[got.unit] || 0) + 1;
        if (got?.value != null) hasAny = true;
      }
      if (hasAny) { rows.push(row); validCount++; }
    }

    if (validCount < 3) continue;

    // Raw data per timepoint (for display)
    const rawData = {};
    for (let j = 0; j < tpIds.length; j++) {
      const vals = rows.map(row => row[`tp_${j}`]).filter(v => v != null);
      rawData[tpLabels[j]] = {
        n: vals.length,
        mean: vals.length > 0 ? mean(vals) : null,
        sd: vals.length > 1 ? stdev(vals, mean(vals)) : null,
        values: vals,
      };
    }

    // Subjects with complete data (non-null at all timepoints)
    const complete = rows.filter(row =>
      tpIds.every((_, j) => row[`tp_${j}`] != null)
    );

    byLabel[label] = {
      rows,
      complete,
      rawData,
      nSubjects: rows.length,
      nComplete: complete.length,
      unit: Object.entries(labelUnits).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
    };
  }

  return { byLabel, tpIds, tpLabels };
}

// ─── Main entry point ──────────────────────────────────────────────────────
export function runLongitudinalAll(sessions, config, calibration) {
  const { timepoints, subjects, labelIds, sphericityCorrection, modelType } = config;

  if (!timepoints || timepoints.length < 2) return { error: "At least 2 timepoints required" };
  if (!subjects || subjects.length < 3) return { error: "At least 3 subjects required" };

  const { byLabel, tpLabels } = collectSubjectData(sessions, subjects, timepoints, labelIds || [], calibration);

  const results = {
    timepoints: timepoints.map(tp => ({ id: tp.id, label: tp.label })),
    subjects: subjects.map(s => ({ id: s.id, label: s.label })),
    labels: {},
    sphericityCorrection: sphericityCorrection || "greenhouse-geisser",
    modelType: modelType || "rm_anova",
    warnings: [],
  };

  // Minimum-sample-size warnings
  const nSubj = subjects?.length || 0;
  const nTp = timepoints?.length || 0;
  if (nSubj < 10) results.warnings.push(`Only ${nSubj} subjects — RM-ANOVA results are exploratory. For adequate power (≥80% to detect a medium effect), ≥ 10-20 subjects per timepoint are recommended.`);
  if (nTp < 3) results.warnings.push(`Only ${nTp} timepoints — sphericity testing and correction are not available (requires ≥ 3 timepoints).`);

  // Enforce minimum time separation between timepoints (was never checked).
  const timeSep = checkLongitudinalTimeSeparation(sessions, subjects, timepoints, config.minTimeSeparation);
  if (timeSep.checked) {
    results.timeSeparation = timeSep;
    for (const v of timeSep.violations) {
      results.warnings.push(`Time-separation violation: subject "${v.subjectLabel}" ${v.from}→${v.to} are ${v.gapDays} days apart (minimum required: ${v.minDays}). Consecutive timepoints too close undermine the longitudinal design — widen the interval or drop this subject.`);
    }
  }

  // Per-label analysis — only run on labels with sufficient complete data
  for (const [label, ld] of Object.entries(byLabel)) {
    const paired = ld.complete;
    if (paired.length < 3) {
      results.labels[label] = { skip: true, reason: `Insufficient complete data: ${paired.length}/3 subjects have measurements at all timepoints` };
      continue;
    }

    const rmAnova = repeatedMeasuresANOVA(paired, sphericityCorrection);
    const pairwise = rmAnova ? pairedPostHoc(paired, Object.keys(paired[0]).filter(k => k.startsWith("tp_")), tpLabels).map(p => ({ ...p, unit: ld.unit || "" })) : [];
    const lmm = modelType === "mixed_model" || modelType === "both" ? linearMixedModel(paired, tpLabels) : null;

    // Change scores. The MDC must be the INDIVIDUAL-level MDC (z·√2·SEM where
    // SEM = S_diff, the SD of individual difference scores), not the group-level
    // MDC (z·√2·S_diff/√n). The previous version used sdDiff/√n, which is the SE of
    // the mean difference — conflating group precision with measurement error and
    // flagging almost any mean change as "MDC exceeded".
    const tpKeys = Object.keys(paired[0]).filter(k => k.startsWith("tp_"));
    const changeScores = [];
    for (let i = 0; i < tpKeys.length; i++) {
      for (let j = i + 1; j < tpKeys.length; j++) {
        const valsA = paired.map(row => row[tpKeys[i]]);
        const valsB = paired.map(row => row[tpKeys[j]]);
        const diffs = valsA.map((v, idx) => v - valsB[idx]);
        const mDiff = mean(diffs);
        const sdDiff = stdev(diffs, mDiff);
        const semIndividual = sdDiff; // SEM at the individual level = SD of differences
        const mdc = 1.96 * Math.sqrt(2) * semIndividual;
        const semGroup = sdDiff / Math.sqrt(diffs.length); // SE of the mean difference
        changeScores.push({
          from: tpLabels[i] || tpKeys[i],
          to: tpLabels[j] || tpKeys[j],
          unit: ld.unit || "",
          meanChange: mDiff,
          sd: sdDiff,
          sem: semGroup,
          semIndividual,
          mdc,
          mdcExceeded: Math.abs(mDiff) > mdc,
          t: semGroup > 0 ? mDiff / semGroup : 0,
          pValue: semGroup > 0 ? 2 * (1 - tDistributeCDF(Math.abs(mDiff / semGroup), diffs.length - 1)) : 1,
        });
      }
    }

    results.labels[label] = {
      label,
      unit: ld.unit || "",
      rmAnova,
      pairwise,
      lmm,
      changeScores,
      rawData: ld.rawData,
      nSubjects: ld.nSubjects,
      nComplete: ld.nComplete,
    };
  }

  return results;
}
