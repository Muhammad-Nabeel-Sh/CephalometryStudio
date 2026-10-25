// ─── Results tables + CSV / clipboard export for all study types ──────────────
// buildResultsTables(study) → [{ title, header, rows }] is the single source for
// every export (CSV, copy-to-clipboard, PDF/Word report). Values are raw
// numbers; formatting is left to the consumer.

function esc(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function download(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Extract the primary statistic from a comparative test result based on test name
function comparativeStatistic(testName, r) {
  if (!r) return "";
  if (testName === "Independent t-test" || testName === "Welch's t-test") return r.t;
  if (testName === "Paired t-test") return r.t;
  if (testName === "One-way ANOVA" || testName === "Repeated measures ANOVA" || testName === "Welch's ANOVA") return r.F;
  if (testName === "Mann-Whitney U") return r.U;
  if (testName === "Wilcoxon signed-rank") return r.W;
  if (testName === "Kruskal-Wallis") return r.H;
  if (testName === "Friedman test") return r.Q;
  return "";
}

function reliabilityTables(res) {
  const details = (res.details || []).filter(d => !d.skip);
  const rows = details.map(d => [
    d.label, d.unit || "", d.icc, d.ci95?.[0], d.ci95?.[1],
    d.F, d.df1, d.df2, d.pValue,
    d.meanDiff, d.sdDiff, d.cv != null ? d.cv.toFixed(2) : "",
    d.dahlberg, d.sem, d.mdc, d.n,
  ]);
  return [{ title: "Reliability", header: ["Label", "Unit", "ICC", "CI_Lower", "CI_Upper", "F", "df1", "df2", "p_Value", "Mean_Diff", "SD_Diff", "CV%", "Dahlberg", "SEM", "MDC", "n"], rows }];
}

function descriptiveTables(res) {
  const combined = res.combined || {};
  const rows = [];
  for (const label of Object.keys(combined)) {
    const s = combined[label]?.stats;
    if (!s) continue;
    rows.push([
      label, combined[label].unit || "", s.n, s.mean, s.sd, s.sem, s.variance,
      s.min, s.max, s.q1, s.median, s.q3, s.p5, s.p95,
      s.skewness, s.kurtosis,
      s.isNormal ? "Yes" : "No",
    ]);
  }
  return [{ title: "Descriptive statistics", header: ["Label", "Unit", "n", "Mean", "SD", "SEM", "Variance", "Min", "Max", "Q1", "Median", "Q3", "P5", "P95", "Skewness", "Kurtosis", "Is_Normal"], rows }];
}

function comparativeTables(res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [];
  for (const [label, lr] of labels) {
    const r = lr.result;
    const testName = lr.testName || "";
    const stat = comparativeStatistic(testName, r);
    const df = testName === "One-way ANOVA" ? `${r?.dfBetween},${r?.dfWithin}` :
      testName === "Repeated measures ANOVA" ? `${r?.dfCond},${r?.dfErr}` :
      testName === "Welch's ANOVA" ? `${r?.df1},${r?.df2}` :
      r?.df ?? "";
    const es = lr.effectSize;
    const esVal = es ? (es.cohensD ?? es.cohensDz ?? es.rankBiserial ?? es.matchedPairsR ?? es.etaSq ?? es.partialEtaSq ?? es.epsilonSq ?? es.kendallW ?? "") : "";
    const p = r?.pValue;
    const mcCorr = lr.mcCorrected;
    rows.push([
      label, lr.unit || "", testName, stat, df, p,
      mcCorr?.adjusted ?? "",
      mcCorr ? (mcCorr.significant ? "Yes" : "No") : "",
      esVal, es?.measure ?? "", es?.interpretation ?? "",
      p != null && p < (res.alpha || 0.05) ? "Yes" : "No",
    ]);
  }
  return [{ title: "Group comparisons", header: ["Label", "Unit", "Test", "Statistic", "df", "p_Value", "p_Adjusted", "MC_Significant", "Effect_Size", "ES_Type", "ES_Interpretation", "Overall_Significant"], rows }];
}

function longitudinalTables(res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [];
  for (const [label, lr] of labels) {
    const unit = lr.unit || "";
    for (const c of lr.changeScores || []) {
      rows.push([label, unit, c.from, c.to, c.meanChange, c.sd, c.sem, c.mdc, c.mdcExceeded ? "Yes" : "No", c.t, c.pValue, "", ""]);
    }
    for (const p of lr.pairwise || []) {
      rows.push([label, unit, p.tpA, p.tpB, p.meanDiff, p.sd, "", "", "", p.t, p.pValue, p.pAdjusted, p.significant ? "Yes" : "No"]);
    }
  }
  const tables = [{ title: "Change between timepoints", header: ["Label", "Unit", "From", "To", "Mean_Delta", "SD_Delta", "SEM", "MDC", "Delta_Exceeds_MDC", "t", "p_Value", "p_Adjusted", "Significant"], rows }];
  const lmmRows = [];
  for (const [label, lr] of labels) {
    for (const fe of lr.lmm?.fixedEffects || []) lmmRows.push([label, lr.unit || "", fe.term, fe.estimate, fe.se, fe.df, fe.t, fe.p, fe.ci95?.[0], fe.ci95?.[1]]);
  }
  if (lmmRows.length) tables.push({ title: "Mixed model fixed effects", header: ["Label", "Unit", "Term", "Estimate", "SE", "df", "t", "p_Value", "CI_Lower", "CI_Upper"], rows: lmmRows });
  return tables;
}

function correlationTables(res) {
  const { vars, matrix } = res;
  if (!vars || !matrix) return [];
  const rows = [];
  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      rows.push([vars[i], vars[j], d.r, d.p, d.sigAdj ? "Yes" : "No"]);
    }
  }
  return [{ title: "Correlations", header: ["Var1", "Var2", "r", "p_Value", "Significant_Adj"], rows }];
}

function diagnosticTables(res) {
  const rows = [];
  for (const [predName, pred] of Object.entries(res.predictors || {})) {
    const auc = pred.auc;
    const ct = pred.optimalYouden;
    rows.push([
      predName,
      auc?.auc, auc?.seAUC, auc?.ci95?.[0], auc?.ci95?.[1],
      ct?.threshold, ct?.sensitivity, ct?.specificity,
      ct?.accuracy, ct?.ppv, ct?.npv, ct?.lrPos, ct?.lrNeg,
    ]);
  }
  return [{ title: "Diagnostic accuracy", header: ["Predictor", "AUC", "AUC_SE", "AUC_CI_Lower", "AUC_CI_Upper", "Optimal_Threshold", "Sensitivity", "Specificity", "Accuracy", "PPV", "NPV", "LR+", "LR-"], rows }];
}

function superimpositionTables(res) {
  if (res.error) return [];
  const tables = [{
    title: "Landmark displacements", header: ["Label", "dx", "dy", "Displacement", "Unit", "Typical_Error_mm", "Significant"],
    rows: (res.displacements || []).map(d => [d.label, d.dxMm, d.dyMm, d.lenMm, d.unit || "", d.typicalErrorMm ?? "", d.significant ? "Yes" : "No"]),
  }];
  if ((res.angularChanges || []).length) tables.push({ title: "Angular changes", header: ["Label", "T1", "T2", "Change"], rows: res.angularChanges.map(a => [a.label, a.angle2, a.angle1, a.delta]) });
  return tables;
}

function airwayTables(res) {
  const ms = (res.measurements || []).filter(m => m.id && !String(m.id).startsWith("_"));
  return [{ title: "Airway measurements", header: ["Measurement", "Value", "Unit", "Norm_Mean", "Norm_SD", "z", "Interpretation"], rows: ms.map(m => [m.label, m.value, m.unit || "", m.normMean, m.normSD, m.zScore, m.interpretation || ""]) }];
}

export function buildResultsTables(study) {
  const res = study?.results;
  if (!res || res.error) return [];
  switch (study.type) {
    case "reliability": return reliabilityTables(res);
    case "descriptive": return descriptiveTables(res);
    case "comparative": return comparativeTables(res);
    case "longitudinal": return longitudinalTables(res);
    case "correlation": return correlationTables(res);
    case "diagnostic": return diagnosticTables(res);
    case "superimposition": return superimpositionTables(res);
    case "airway": return airwayTables(res);
    default: return [];
  }
}

// One table → CSV text (header + rows). Several tables → titled sections.
export function tablesToCSV(tables) {
  const block = t => [t.header, ...t.rows].map(r => r.map(esc).join(",")).join("\n");
  if (tables.length === 1) return block(tables[0]);
  return tables.map(t => `${esc(t.title)}\n${block(t)}`).join("\n\n");
}

// Tab-separated text pastes straight into Excel, Word and Google Sheets.
export function tablesToTSV(tables) {
  const cell = v => (v == null ? "" : String(v).replace(/[\t\n]/g, " "));
  return tables.map(t => [t.title, t.header.map(cell).join("\t"), ...t.rows.map(r => r.map(cell).join("\t"))].join("\n")).join("\n\n");
}

const FILE_SUFFIX = { reliability: "reliability", descriptive: "descriptive", comparative: "comparative", longitudinal: "longitudinal", correlation: "correlation", diagnostic: "diagnostic", superimposition: "superimposition", airway: "airway" };

export function exportResultsCSV(study) {
  const tables = buildResultsTables(study);
  if (!tables.length) return;
  const name = study.name.replace(/\s+/g, "_");
  download(`${name}_${FILE_SUFFIX[study.type] || study.type}.csv`, tablesToCSV(tables));
}

export { download as downloadText };
