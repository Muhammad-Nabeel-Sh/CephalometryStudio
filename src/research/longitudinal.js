import { mean, stdev, tTestPaired, fCDF, chi2CDF, tDistributeCDF, clamp } from "../lib/utils.js";
import { checkLongitudinalTimeSeparation } from "./validation.js";
import { isResearchMarkup, sessionPrimaryMeasure } from "./collect.js";
import { fitGrowthModel } from "./mixedModel.js";

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

// ─── Linear mixed model (REML) ──────────────────────────────────────────────
// Uses every subject with ≥1 observation (no listwise deletion). The time axis is
// the patient's age when every observation has one, else the timepoints'
// target ages, else the visit index (flagged — unequal spacing is then ignored).
export function chooseTimeAxis(rows, timepoints, requested = "auto") {
  const k = timepoints.length;
  const cells = rows.flatMap(row => Array.from({ length: k }, (_, j) => j).filter(j => row[`tp_${j}`] != null).map(j => ({ row, j })));
  const ageOk = cells.length > 0 && cells.every(({ row, j }) => Number.isFinite(row[`age_${j}`]));
  const targetOk = timepoints.every(tp => tp.targetAge !== null && tp.targetAge !== "" && isFinite(Number(tp.targetAge)));
  let axis = requested;
  if (axis === "auto") axis = ageOk ? "age" : targetOk ? "targetAge" : "index";
  if (axis === "age" && !ageOk) axis = targetOk ? "targetAge" : "index";
  if (axis === "targetAge" && !targetOk) axis = "index";
  const timeOf = (row, j) => (axis === "age" ? Number(row[`age_${j}`]) : axis === "targetAge" ? Number(timepoints[j].targetAge) : j);
  return { axis, timeOf, unit: axis === "index" ? "visit" : "year" };
}

function linearMixedModel(rows, timepoints, requestedAxis) {
  const k = timepoints.length;
  if (rows.length < 3 || k < 2) return null;
  const { axis, timeOf, unit } = chooseTimeAxis(rows, timepoints, requestedAxis);
  const raw = [];
  rows.forEach((row, i) => {
    for (let j = 0; j < k; j++) {
      const y = row[`tp_${j}`];
      if (y == null || !isFinite(y)) continue;
      raw.push({ subject: i, t: timeOf(row, j), y });
    }
  });
  if (raw.length < 4) return null;
  // Intercept = expected value at the earliest time point.
  const t0 = Math.min(...raw.map(o => o.t));
  const obs = raw.map(o => ({ ...o, t: o.t - t0 }));
  const fit = fitGrowthModel(obs);
  if (!fit) return null;
  fit.fixedEffects[0].term = axis === "index" ? "Intercept (first visit)" : `Intercept (at ${axis === "age" ? "age" : "target age"} ${+t0.toFixed(2)})`;
  fit.fixedEffects[1].term = `Time (slope per ${unit})`;

  // Per-subject OLS slopes (descriptive; shown in trajectory charts).
  const slopes = rows.map((row, i) => {
    const pts = obs.filter(o => o.subject === i);
    if (pts.length < 2) return null;
    const xm = mean(pts.map(p => p.t)), ym = mean(pts.map(p => p.y));
    const den = sum(pts.map(p => (p.t - xm) ** 2));
    return den > 0 ? sum(pts.map(p => (p.t - xm) * (p.y - ym))) / den : null;
  }).filter(v => v != null);

  const warnings = [];
  if (axis === "index") warnings.push("No ages recorded: time is the visit number, so unequal intervals between visits are ignored. Enter each session's age (or the timepoints' target ages) for a growth-rate model.");
  if (!fit.converged) warnings.push("The REML optimiser did not fully converge — treat variance components with caution.");

  return {
    modelType: "reml_lmm",
    fixedEffects: fit.fixedEffects,
    randomEffects: fit.randomEffects,
    fit: fit.fit,
    randomSlope: fit.randomSlope,
    slopeTest: fit.slopeTest,
    alternatives: fit.alternatives,
    timeAxis: axis, timeUnit: unit, timeOrigin: t0,
    meanSlope: fit.beta[1],
    slopes,
    nObservations: obs.length,
    warnings,
    limitations: "REML linear mixed model (random intercept; random slope when supported by a likelihood-ratio test). Fixed-effect tests use a conservative df = subjects − 2 (no Kenward–Roger correction).",
  };
}

// ─── Extract measurement from a session ──────────────────────────────────
function getMeasurementForLabel(session, label, calibration) {
  if (!session) return null;
  const markups = (session.markups || []).filter(m => m.label === label && isResearchMarkup(m));
  for (const m of markups) {
    const pm = sessionPrimaryMeasure(session, m, calibration);
    if (pm) return { value: pm.value, unit: pm.unit };
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
        const age = session?.meta?.age;
        row[`age_${j}`] = age !== undefined && age !== null && age !== "" && isFinite(Number(age)) ? Number(age) : null;
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

  const wantLmm = modelType === "mixed_model" || modelType === "both";
  // Per-label analysis. RM-ANOVA needs complete cases; the mixed model uses every
  // subject with at least one observation.
  for (const [label, ld] of Object.entries(byLabel)) {
    const paired = ld.complete;
    const lmm = wantLmm ? linearMixedModel(ld.rows, timepoints, config.timeAxis || "auto") : null;
    if (paired.length < 3) {
      if (lmm) {
        results.labels[label] = { label, unit: ld.unit || "", rmAnova: null, pairwise: [], lmm, changeScores: [], rawData: ld.rawData, nSubjects: ld.nSubjects, nComplete: ld.nComplete,
          note: `Only ${paired.length} subjects have complete data — RM-ANOVA skipped; the mixed model uses all ${ld.nSubjects} subjects.` };
      } else {
        results.labels[label] = { skip: true, reason: `Insufficient complete data: ${paired.length}/3 subjects have measurements at all timepoints` };
      }
      continue;
    }

    const tpOnly = paired.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith("tp_"))));
    const rmAnova = repeatedMeasuresANOVA(tpOnly, sphericityCorrection);
    const pairwise = rmAnova ? pairedPostHoc(tpOnly, Object.keys(tpOnly[0]), tpLabels).map(p => ({ ...p, unit: ld.unit || "" })) : [];

    // Change scores. The MDC must be the INDIVIDUAL-level MDC (z·√2·SEM where
    // SEM = S_diff, the SD of individual difference scores), not the group-level
    // MDC (z·√2·S_diff/√n). The previous version used sdDiff/√n, which is the SE of
    // the mean difference — conflating group precision with measurement error and
    // flagging almost any mean change as "MDC exceeded".
    const tpKeys = Object.keys(tpOnly[0]);
    const changeScores = [];
    for (let i = 0; i < tpKeys.length; i++) {
      for (let j = i + 1; j < tpKeys.length; j++) {
        const valsA = paired.map(row => row[tpKeys[i]]);
        const valsB = paired.map(row => row[tpKeys[j]]);
        const diffs = valsB.map((v, idx) => v - valsA[idx]); // later − earlier
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
