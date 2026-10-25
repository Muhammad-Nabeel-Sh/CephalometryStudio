import { tDistributeCDF, fCDF } from "../lib/utils.js";
import { checkReliabilityTimeSeparation } from "./validation.js";
import { dominantUnit, isResearchMarkup, sessionPrimaryMeasure } from "./collect.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
// Quantile of the F distribution (bisection with an expanding bracket, so large
// quantiles at small df and fractional Satterthwaite df are both handled).
export function fQuantile(p, df1, df2) {
  if (!(df1 > 0) || !(df2 > 0)) return NaN;
  let lo = 0, hi = 1;
  while (fCDF(hi, df1, df2) < p && hi < 1e9) { lo = hi; hi *= 2; }
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (fCDF(mid, df1, df2) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

export function tQuantile(p, df) {
  if (!(df > 0)) return NaN;
  let lo = 0, hi = 1;
  while (tDistributeCDF(hi, df) < p && hi < 1e9) { lo = hi; hi *= 2; }
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (tDistributeCDF(mid, df) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-12 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

function fPval(F, df1, df2) {
  if (!(F > 0) || df1 <= 0 || df2 <= 0) return 1;
  const p = 1 - fCDF(F, df1, df2);
  return p >= 1 ? 1 : p < 0 ? 0 : p;
}

function simpleRegression(x, y) {
  const n = x.length;
  if (n < 3) return { slope: 0, intercept: 0, r: 0, pValue: 1 };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx !== 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r = Math.sqrt(sxx * syy) !== 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const sse = syy - slope * sxy;
  const seSlope = sxx > 0 ? Math.sqrt(Math.max(sse, 0) / (n - 2) / sxx) : 0;
  const t = seSlope > 0 ? slope / seSlope : 0;
  const pValue = n > 2 && seSlope > 0 ? 2 * (1 - tDistributeCDF(Math.abs(t), n - 2)) : 1;
  return { slope, intercept, r, pValue, t, seSlope };
}

// ─── ICC (Shrout & Fleiss 1979 / McGraw & Wong 1996) ──────────────────────
// Naming follows Koo & Li (2016): model, type and definition are reported with
// every estimate. Confidence intervals are the exact F-based intervals for the
// one-way and consistency forms and the Satterthwaite interval for the
// two-way random, absolute-agreement form (as in R psych::ICC).
export const ICC_MODELS = {
  icc1:  { label: "ICC(1,1)", description: "One-way random effects, absolute agreement, single measurement" },
  icc1k: { label: "ICC(1,k)", description: "One-way random effects, absolute agreement, mean of k measurements" },
  icc2:  { label: "ICC(2,1)", description: "Two-way random effects, absolute agreement, single measurement" },
  icc2k: { label: "ICC(2,k)", description: "Two-way random effects, absolute agreement, mean of k measurements" },
  icc3:  { label: "ICC(3,1)", description: "Two-way mixed effects, consistency, single measurement" },
  icc3k: { label: "ICC(3,k)", description: "Two-way mixed effects, consistency, mean of k measurements" },
};

// `matrix`: n subjects × k raters/occasions, complete cases only.
export function iccFromMatrix(matrix, type = "icc2", alpha = 0.05) {
  const n = matrix.length;
  const k = n > 0 ? matrix[0].length : 0;
  if (n < 2 || k < 2) return null;
  const all = matrix.flat();
  const grand = all.reduce((a, b) => a + b, 0) / all.length;
  const rowMeans = matrix.map(r => r.reduce((a, b) => a + b, 0) / k);
  const colMeans = Array.from({ length: k }, (_, j) => matrix.reduce((a, r) => a + r[j], 0) / n);
  const SST = all.reduce((a, v) => a + (v - grand) ** 2, 0);
  const SSR = k * rowMeans.reduce((a, m) => a + (m - grand) ** 2, 0);
  const SSC = n * colMeans.reduce((a, m) => a + (m - grand) ** 2, 0);
  const SSE = Math.max(SST - SSR - SSC, 0);
  const MSR = SSR / (n - 1);
  const MSC = SSC / (k - 1);
  const MSE = SSE / ((n - 1) * (k - 1));
  const MSW = (SST - SSR) / (n * (k - 1));
  const q = 1 - alpha / 2;

  let icc, lo, hi, F, df1 = n - 1, df2;
  if (type === "icc1" || type === "icc1k") {
    df2 = n * (k - 1);
    F = MSW > 0 ? MSR / MSW : Infinity;
    const FL = F / fQuantile(q, df1, df2), FU = F * fQuantile(q, df2, df1);
    if (type === "icc1") {
      icc = (MSR - MSW) / (MSR + (k - 1) * MSW);
      lo = (FL - 1) / (FL + k - 1); hi = (FU - 1) / (FU + k - 1);
    } else {
      icc = (MSR - MSW) / MSR;
      lo = 1 - 1 / FL; hi = 1 - 1 / FU;
    }
  } else if (type === "icc3" || type === "icc3k") {
    df2 = (n - 1) * (k - 1);
    F = MSE > 0 ? MSR / MSE : Infinity;
    const FL = F / fQuantile(q, df1, df2), FU = F * fQuantile(q, df2, df1);
    if (type === "icc3") {
      icc = (MSR - MSE) / (MSR + (k - 1) * MSE);
      lo = (FL - 1) / (FL + k - 1); hi = (FU - 1) / (FU + k - 1);
    } else {
      icc = (MSR - MSE) / MSR;
      lo = 1 - 1 / FL; hi = 1 - 1 / FU;
    }
  } else {
    type = type === "icc2k" ? "icc2k" : "icc2";
    df2 = (n - 1) * (k - 1);
    F = MSE > 0 ? MSR / MSE : Infinity;
    const r2 = (MSR - MSE) / (MSR + (k - 1) * MSE + (k * (MSC - MSE)) / n);
    // Satterthwaite df for the absolute-agreement interval (McGraw & Wong 1996, case 2A).
    const Fj = MSE > 0 ? MSC / MSE : 0;
    const a = k * r2 * Fj + n * (1 + (k - 1) * r2) - k * r2;
    const v = ((k - 1) * (n - 1) * a * a) / ((n - 1) * (k * r2 * Fj) ** 2 + (n * (1 + (k - 1) * r2) - k * r2) ** 2);
    const FU = fQuantile(q, n - 1, v), FL = fQuantile(q, v, n - 1);
    const L = (n * (MSR - FU * MSE)) / (FU * (k * MSC + (k * n - k - n) * MSE) + n * MSR);
    const U = (n * (FL * MSR - MSE)) / (k * MSC + (k * n - k - n) * MSE + n * FL * MSR);
    if (type === "icc2") { icc = r2; lo = L; hi = U; }
    else {
      icc = (MSR - MSE) / (MSR + (MSC - MSE) / n);
      lo = (L * k) / (1 + L * (k - 1)); hi = (U * k) / (1 + U * (k - 1));
    }
  }
  const clampIcc = v => (isFinite(v) ? Math.max(-1, Math.min(1, v)) : null);
  return {
    icc: clampIcc(icc), ci95: [clampIcc(lo), clampIcc(hi)],
    F: isFinite(F) ? F : null, df1, df2, pValue: isFinite(F) ? fPval(F, df1, df2) : 0,
    n, k, model: type, modelLabel: ICC_MODELS[type].label, modelDescription: ICC_MODELS[type].description,
    ms: { MSR, MSC, MSE, MSW },
  };
}

// ─── Bland-Altman (Bland & Altman 1986/1999) ──────────────────────────────
// d = b − a (second minus first: occasion 2 − occasion 1, rater 2 − rater 1,
// test − reference). Limits of agreement are the classic d̄ ± 1.96·SD with exact
// t-based CIs; the small-sample prediction interval is reported alongside.
export function blandAltman(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const diffs = [], means = [];
  for (let i = 0; i < n; i++) { diffs.push(b[i] - a[i]); means.push((a[i] + b[i]) / 2); }
  const meanDiff = diffs.reduce((x, y) => x + y, 0) / n;
  const sdDiff = Math.sqrt(diffs.reduce((s, d) => s + (d - meanDiff) ** 2, 0) / (n - 1));
  const tCrit = tQuantile(0.975, n - 1);
  const loaUpper = meanDiff + 1.96 * sdDiff;
  const loaLower = meanDiff - 1.96 * sdDiff;
  const seLoA = sdDiff * Math.sqrt(1 / n + (1.96 ** 2) / (2 * (n - 1)));
  const biasSE = sdDiff / Math.sqrt(n);
  const pi = tCrit * sdDiff * Math.sqrt(1 + 1 / n);
  const reg = simpleRegression(means, diffs);
  return {
    meanDiff, sdDiff, n,
    loaUpper, loaLower,
    loaUpperCi: [loaUpper - tCrit * seLoA, loaUpper + tCrit * seLoA],
    loaLowerCi: [loaLower - tCrit * seLoA, loaLower + tCrit * seLoA],
    meanDiffCi: [meanDiff - tCrit * biasSE, meanDiff + tCrit * biasSE],
    predictionInterval: [meanDiff - pi, meanDiff + pi],
    proportionalBias: { detected: reg.pValue < 0.05, slope: reg.slope, r: reg.r, pValue: reg.pValue, t: reg.t },
    points: means.map((m, i) => ({ mean: m, diff: diffs[i], outlier: Math.abs(diffs[i] - meanDiff) > 1.96 * sdDiff })),
    nPairs: n,
  };
}

// Dahlberg's error generalised to k ≥ 2 measurements: √MSW (within-subject SD),
// which equals √(Σd²/2n) for two measurements.
function methodError(matrix, icc) {
  const n = matrix.length, k = matrix[0].length;
  const all = matrix.flat();
  const grandMean = all.reduce((a, b) => a + b, 0) / all.length;
  const totalSD = Math.sqrt(all.reduce((a, v) => a + (v - grandMean) ** 2, 0) / (all.length - 1));
  let ssw = 0;
  for (const row of matrix) {
    const m = row.reduce((a, b) => a + b, 0) / k;
    for (const v of row) ssw += (v - m) ** 2;
  }
  const dahlberg = Math.sqrt(ssw / (n * (k - 1)));
  const sem = icc != null ? totalSD * Math.sqrt(Math.max(0, 1 - icc)) : dahlberg;
  // CV% is meaningless for measures centred near zero (ANB, Wits, E-line).
  const cv = Math.abs(grandMean) > 2 * totalSD ? (sem / Math.abs(grandMean)) * 100 : null;
  return { dahlberg, sem, mdc: 1.96 * Math.sqrt(2) * sem, cv, totalSD, grandMean, nCases: n };
}

// ─── Landmark coordinate error mapping ────────────────────────────────────
// Coordinates are collected in PIXELS. The error map must convert to mm using the
// session's calibration (pxPerMm) so that errors are comparable across sessions
// captured at different resolutions. The previous version reported errors in raw
// pixels without labeling them as such, leading clinicians to misread the numbers
// as millimeters.
function collectLandmarkCoords(sessions, labelIds, calibration) {
  const rows = [];
  for (const s of sessions) {
    if (!s) continue;
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const calDone = cal?.done === true;
    const ppm = calDone ? (cal.pxPerMm || 1) : 1;
    const unit = calDone ? "mm" : "px";
    const markups = s.markups || [];
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette" || m.type === "line" || m.type === "angle3") continue;
      if (!m.visible || !m.placed) continue;
      for (const p of (m.points || [])) {
        rows.push({ sessionId: s.id, label: m.label, x: p.x / ppm, y: p.y / ppm, unit });
      }
    }
  }
  return rows;
}

function runLandmarkErrorMap(coords) {
  const byLabel = {};
  for (const c of coords) {
    if (!byLabel[c.label]) byLabel[c.label] = [];
    byLabel[c.label].push(c);
  }

  const result = {};
  for (const [label, pts] of Object.entries(byLabel)) {
    if (pts.length < 2) continue;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const radialErrors = pts.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
    const meanError = radialErrors.reduce((a, b) => a + b, 0) / radialErrors.length;
    const maxError = Math.max(...radialErrors);
    const sdError = Math.sqrt(radialErrors.reduce((s, r) => s + (r - meanError) ** 2, 0) / (radialErrors.length - 1));

    // 2x2 covariance matrix
    const m = pts.length;
    const cxx = pts.reduce((s, p) => s + (p.x - cx) ** 2, 0) / (m - 1);
    const cyy = pts.reduce((s, p) => s + (p.y - cy) ** 2, 0) / (m - 1);
    const cxy = pts.reduce((s, p) => s + (p.x - cx) * (p.y - cy), 0) / (m - 1);

    const trace = cxx + cyy;
    const det = cxx * cyy - cxy * cxy;
    const disc = Math.max(0, trace * trace - 4 * det);
    const eig1 = (trace + Math.sqrt(disc)) / 2;
    const eig2 = (trace - Math.sqrt(disc)) / 2;
    const angle = cxx !== cyy ? 0.5 * Math.atan2(2 * cxy, cxx - cyy) : Math.PI / 4;

    const coordsUnit = pts[0]?.unit || "mm";
    result[label] = {
      centroid: { x: cx, y: cy },
      n: m,
      meanError,
      maxError,
      sdError,
      unit: coordsUnit,
      ellipse: {
        major: Math.sqrt(5.991) * Math.sqrt(Math.max(eig1, 0)),
        minor: Math.sqrt(5.991) * Math.sqrt(Math.max(eig2, 0)),
        angle,
        unit: coordsUnit,
      },
    };
  }

  return result;
}

// ─── Main entry point ─────────────────────────────────────────────────────
export function runReliabilityAll(sessions, config, calibration) {
  const { labelIds, cases, operators, protocol } = config;
  if (!cases || cases.length === 0) {
    return { measurements: 0, sessions: 0, labels: 0, details: [], note: "No cases defined. Add cases and map sessions first." };
  }

  // Build session → { caseId, caseName, operatorId, occasion } lookup
  // Each sessionId maps to ONE entry (last write wins if duplicates exist)
  const sessionMap = {};
  for (const c of cases) {
    for (const cs of (c.sessions || [])) {
      sessionMap[cs.sessionId] = { caseId: c.id, caseName: c.name, operatorId: cs.operatorId, occasion: cs.occasion };
    }
  }

  // Collect measurements with case/operator/occasion metadata
  const mRows = [];
  for (const s of sessions) {
    if (!s) continue;
    const mapping = sessionMap[s.id];
    if (!mapping) continue;
    // One value per markup: its primary measurement. Points (coordinates) are
    // assessed by the landmark error map below, not by ICC/Bland-Altman.
    for (const m of s.markups || []) {
      if (!isResearchMarkup(m)) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      const pm = sessionPrimaryMeasure(s, m, calibration);
      if (!pm) continue;
      mRows.push({
        caseId: mapping.caseId,
        caseName: mapping.caseName,
        operatorId: mapping.operatorId,
        occasion: mapping.occasion,
        sessionId: s.id,
        label: m.label,
        measureKey: pm.key,
        value: pm.value,
        unit: pm.unit,
      });
    }
  }

  if (mRows.length === 0) {
    // Landmark-only studies (point placement reliability) have no scalar
    // measurements but still get the coordinate error map.
    const mappedIds = new Set(Object.keys(sessionMap));
    const landmarkMap = runLandmarkErrorMap(collectLandmarkCoords(sessions.filter(s => s && mappedIds.has(s.id)), labelIds, calibration));
    const hasMap = Object.keys(landmarkMap).length > 0;
    return {
      measurements: 0, sessions: sessions.length, labels: 0, details: [], landmarkMap, warnings: [],
      note: hasMap
        ? "No angle/length measurements in the mapped sessions — only landmark placement error is reported."
        : "No measurements collected from mapped sessions.",
    };
  }

  // Group by label
  const byLabel = {};
  for (const r of mRows) {
    if (!byLabel[r.label]) byLabel[r.label] = [];
    byLabel[r.label].push(r);
  }

  const details = [];
  const labelList = Object.keys(byLabel).sort();

  const iccType = ICC_MODELS[config.iccModel] ? config.iccModel : "icc2";
  const isIntra = config.design === "intra";
  const isMethod = config.design === "method_comparison";
  const opOrder = (operators || []).map(o => (typeof o === "string" ? o : o.id));
  const refOps = new Set((operators || []).filter(o => o?.role === "reference").map(o => o.id));
  const multiOperatorIntra = isIntra && new Set(mRows.map(r => r.operatorId)).size > 1;

  for (const label of labelList) {
    const samples = byLabel[label];

    // Unit of analysis × rater/occasion matrix. Intra-rater: the occasions are the
    // "raters" and each case × operator is a unit; inter-rater / method
    // comparison: operators (methods) are the raters.
    const cell = {};
    for (const r of samples) {
      const unitKey = isIntra ? `${r.caseId}|${r.operatorId}` : r.caseId;
      const raterKey = isIntra ? `occ${r.occasion}` : r.operatorId;
      ((cell[unitKey] ||= {})[raterKey] ||= []).push(r.value);
    }
    let raters = [...new Set(samples.map(r => (isIntra ? `occ${r.occasion}` : r.operatorId)))];
    raters.sort((a, b) => {
      if (isIntra) return Number(a.slice(3)) - Number(b.slice(3));
      if (isMethod && refOps.has(a) !== refOps.has(b)) return refOps.has(a) ? -1 : 1;
      const ia = opOrder.indexOf(a), ib = opOrder.indexOf(b);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    });
    const units = Object.keys(cell);
    const complete = units.filter(u => raters.every(rk => cell[u][rk]?.length));
    const k = raters.length;

    if (complete.length < 2 || k < 2) {
      details.push({ label, n: samples.length, skip: true, reason: `Need ≥2 cases measured by every rater/occasion and ≥2 raters/occasions (have ${complete.length} complete cases, ${k} raters)` });
      continue;
    }

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const matrix = complete.map(u => raters.map(rk => avg(cell[u][rk])));
    const iccResult = iccFromMatrix(matrix, iccType);

    // Bland-Altman for every ordered pair; the first pair is the headline result.
    const pairs = [];
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        const ba = blandAltman(matrix.map(r => r[a]), matrix.map(r => r[b]));
        if (ba) pairs.push({ comparison: `${raters[b]} − ${raters[a]}`, ...ba });
      }
    }
    const me = methodError(matrix, iccResult?.icc ?? null);
    const nExcluded = units.length - complete.length;

    details.push({
      label,
      unit: dominantUnit(samples),
      icc: iccResult?.icc ?? null,
      ci95: iccResult?.ci95 || [null, null],
      F: iccResult?.F ?? null,
      df1: iccResult?.df1 ?? null,
      df2: iccResult?.df2 ?? null,
      pValue: iccResult?.pValue ?? null,
      iccModel: iccResult?.model, iccModelLabel: iccResult?.modelLabel, iccModelDescription: iccResult?.modelDescription,
      nSubjects: complete.length,
      nExcluded,
      nRaters: k,
      raters,
      ...(pairs[0] || {}),
      baPairs: pairs,
      nCases: complete.length,
      ...me,
      n: samples.length,
    });
  }

  if (multiOperatorIntra) {
    details.forEach(d => { if (!d.skip) d.note = "Intra-rater units are case × operator; run one study per operator to report each rater separately."; });
  }

  // Landmark error map (now calibrated to mm)
  const coords = collectLandmarkCoords(sessions, labelIds, calibration);
  const landmarkMap = runLandmarkErrorMap(coords);

  // Minimum-sample-size warnings
  const warnings = [];
  const nCases = cases?.length || 0;
  const nRaters = [...new Set(mRows.map(r => isIntra ? `occ${r.occasion}` : r.operatorId))].length;
  const excluded = details.filter(d => d.nExcluded > 0);
  if (excluded.length) warnings.push(`Incomplete cases were excluded (listwise) from ${excluded.length} measurement(s): every case must be measured by every rater/occasion for ICC and Bland-Altman.`);
  if (nCases < 10) warnings.push(`Only ${nCases} cases — ICC estimates with < 10 subjects have wide confidence intervals and should be interpreted as preliminary.`);
  if (nRaters < 2) warnings.push("Need ≥ 2 raters/occasions for reliability analysis.");
  if (nCases >= 2 && nCases < 30) warnings.push(`ICC CI with ${nCases} subjects is wide — consider ≥ 30 subjects for a precise ICC estimate (Walter et al. 1998).`);

  // Enforce minimum time separation between occasions (was configured but never checked).
  const timeSep = checkReliabilityTimeSeparation(sessions, cases, config.minTimeSeparation);
  if (timeSep.checked) {
    for (const v of timeSep.violations) {
      warnings.push(`Time-separation violation: case "${v.caseName}" occasions ${v.from}→${v.to} are ${v.gapDays} days apart (minimum required: ${v.minDays}). Reliability estimates may be inflated by memory effect — increase the interval or exclude this case.`);
    }
  }

  return {
    measurements: mRows.length,
    sessions: sessions.length,
    labels: labelList.length,
    details,
    summary: {
      design: config.design || "intra",
      operators: operators?.length || 0,
      cases: cases?.length || 0,
      occasions: protocol?.occasions || 2,
    },
    landmarkMap,
    warnings,
    timeSeparation: timeSep,
  };
}
