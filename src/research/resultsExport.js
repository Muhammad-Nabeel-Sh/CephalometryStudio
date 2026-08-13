// ─── CSV Export for All Study Types ───────────────────────────────────────────

function esc(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function download(filename, text) {
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function exportResultsCSV(study) {
  const type = study.type;
  const res = study.results;
  if (!res) return;

  const name = study.name.replace(/\s+/g, "_");

  switch (type) {
    case "reliability":
      return exportReliabilityCSV(name, res);
    case "descriptive":
      return exportDescriptiveCSV(name, res);
    case "comparative":
      return exportComparativeCSV(name, res);
    case "longitudinal":
      return exportLongitudinalCSV(name, res);
    case "correlation":
      return exportCorrelationCSV(name, res);
    case "diagnostic":
      return exportDiagnosticCSV(name, res);
    default:
      return;
  }
}

function exportReliabilityCSV(name, res) {
  const details = (res.details || []).filter(d => !d.skip);
  const rows = [["Label", "Unit", "ICC", "CI_Lower", "CI_Upper", "F", "df1", "df2", "p_Value", "Mean_Diff", "SD_Diff", "CV%", "Dahlberg", "SEM", "MDC", "n"]];
  for (const d of details) {
    rows.push([
      d.label, d.unit || "", d.icc, d.ci95?.[0], d.ci95?.[1],
      d.F, d.df1, d.df2, d.pValue,
      d.meanDiff, d.sdDiff, d.cv != null ? d.cv.toFixed(2) : "",
      d.dahlberg, d.sem, d.mdc, d.n,
    ].map(esc).join(","));
  }
  download(name + "_reliability.csv", rows.join("\n"));
}

function exportDescriptiveCSV(name, res) {
  const combined = res.combined || {};
  const labels = Object.keys(combined);
  const rows = [["Label", "Unit", "n", "Mean", "SD", "SEM", "Variance", "Min", "Max", "Q1", "Median", "Q3", "P5", "P95", "Skewness", "Kurtosis", "Is_Normal"]];
  for (const label of labels) {
    const s = combined[label]?.stats;
    if (!s) continue;
    rows.push([
      label, combined[label].unit || "", s.n, s.mean, s.sd, s.sem, s.variance,
      s.min, s.max, s.q1, s.median, s.q3, s.p5, s.p95,
      s.skewness, s.kurtosis,
      s.isNormal ? "Yes" : "No",
    ].map(esc).join(","));
  }
  download(name + "_descriptive.csv", rows.join("\n"));
}

// Extract the primary statistic from a comparative test result based on test name
function comparativeStatistic(testName, r) {
  if (!r) return "";
  if (testName === "Independent t-test" || testName === "Welch's t-test") return r.t;
  if (testName === "Paired t-test") return r.t;
  if (testName === "One-way ANOVA" || testName === "Repeated measures ANOVA") return r.F;
  if (testName === "Mann-Whitney U") return r.U;
  if (testName === "Wilcoxon signed-rank") return r.W;
  if (testName === "Kruskal-Wallis") return r.H;
  if (testName === "Friedman test") return r.Q;
  return "";
}

function exportComparativeCSV(name, res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [["Label", "Unit", "Test", "Statistic", "df", "p_Value", "p_Adjusted", "MC_Significant", "Effect_Size", "ES_Type", "ES_Interpretation", "Overall_Significant"]];
  for (const [label, lr] of labels) {
    const r = lr.result;
    const testName = lr.testName || "";
    const stat = comparativeStatistic(testName, r);
    const df = testName === "One-way ANOVA" ? `${r?.dfBetween},${r?.dfWithin}` :
      testName === "Repeated measures ANOVA" ? `${r?.dfCond},${r?.dfErr}` :
      r?.df ?? "";
    const es = lr.effectSize;
    const esVal = es ? (es.cohensD ?? es.cohensDz ?? es.cohensDz ?? es.rankBiserial ?? es.matchedPairsR ?? es.etaSq ?? es.partialEtaSq ?? es.epsilonSq ?? es.kendallW ?? "") : "";
    const p = r?.pValue;
    const mcCorr = lr.mcCorrected;
    rows.push([
      label, lr.unit || "", testName, stat, df, p,
      mcCorr?.adjusted ?? "",
      mcCorr ? (mcCorr.significant ? "Yes" : "No") : "",
      esVal, es?.measure ?? "", es?.interpretation ?? "",
      p != null && p < (res.alpha || 0.05) ? "Yes" : "No",
    ].map(esc).join(","));
  }
  download(name + "_comparative.csv", rows.join("\n"));
}

function exportLongitudinalCSV(name, res) {
  const labels = Object.entries(res.labels || {}).filter(([, lr]) => !lr.skip);
  const rows = [["Label", "Unit", "From", "To", "Mean_Delta", "SD_Delta", "SEM", "MDC", "Delta_Exceeds_MDC", "t", "p_Value", "p_Adjusted", "Significant"]];
  for (const [label, lr] of labels) {
    const unit = lr.unit || "";
    const ch = lr.changeScores || [];
    for (const c of ch) {
      rows.push([label, unit, c.from, c.to, c.meanChange, c.sd, c.sem, c.mdc, c.mdcExceeded ? "Yes" : "No", c.t, c.pValue, "", ""].map(esc).join(","));
    }
    const pw = lr.pairwise || [];
    for (const p of pw) {
      rows.push([label, unit, p.tpA, p.tpB, p.meanDiff, p.sd, "", "", "", p.t, p.pValue, p.pAdjusted, p.significant ? "Yes" : "No"].map(esc).join(","));
    }
  }
  download(name + "_longitudinal.csv", rows.join("\n"));
}

function exportCorrelationCSV(name, res) {
  const { vars, matrix } = res;
  if (!vars || !matrix) return;
  const rows = [["Var1", "Var2", "r", "p_Value", "Significant_Adj"]];
  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      rows.push([vars[i], vars[j], d.r, d.p, d.sigAdj ? "Yes" : "No"].map(esc).join(","));
    }
  }
  download(name + "_correlation.csv", rows.join("\n"));
}

function exportDiagnosticCSV(name, res) {
  const preds = Object.entries(res.predictors || {});
  const rows = [["Predictor", "AUC", "AUC_SE", "AUC_CI_Lower", "AUC_CI_Upper", "Optimal_Threshold", "Sensitivity", "Specificity", "Accuracy", "PPV", "NPV", "LR+", "LR-"]];

  for (const [predName, pred] of preds) {
    const auc = pred.auc;
    const ct = pred.optimalYouden;
    rows.push([
      predName,
      auc?.auc, auc?.seAUC, auc?.ci95?.[0], auc?.ci95?.[1],
      ct?.threshold, ct?.sensitivity, ct?.specificity,
      ct?.accuracy, ct?.ppv, ct?.npv, ct?.lrPos, ct?.lrNeg,
    ].map(esc).join(","));
  }
  download(name + "_diagnostic.csv", rows.join("\n"));
}
