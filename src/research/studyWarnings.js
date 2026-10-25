// ═══════════════════════════════════════════════════════════════════════════════
// studyWarnings.js — every caveat a study's results carry, in one list
//
// Modules attach warnings in different places (results.warnings, per-label
// notes, excluded cases, model warnings, stratum warnings, skipped labels).
// The results view shows all of them in one strip so none is silently lost.
// Each item: { level: "error" | "warn" | "info", text, fix? } where `fix` names
// the wizard step that resolves it ("setup" | "data").
// ═══════════════════════════════════════════════════════════════════════════════

const uniq = items => {
  const seen = new Set();
  return items.filter(i => (seen.has(i.text) ? false : (seen.add(i.text), true)));
};

export function collectStudyWarnings(study, extra = {}) {
  const res = study?.results;
  const out = [];
  const add = (level, text, fix) => { if (text) out.push({ level, text, ...(fix ? { fix } : {}) }); };

  if (extra.status === "stale") add("warn", "The data or settings changed after this run — these results may not match the current sessions. Re-run the analysis.", "run");
  if (extra.status === "legacy") add("info", "These results were produced before change-tracking existed; re-run to be sure they reflect the current data.", "run");
  if (study?.config?.blindingLog?.length) add("warn", `Blinding was broken for ${study.config.blindingLog.length} session(s) during data collection (see the study log).`);
  if (!res) return uniq(out);
  if (res.error) add("error", `The analysis failed: ${res.error}`, "setup");
  if (res.note) add("info", res.note, "setup");

  for (const w of res.warnings || []) add("warn", typeof w === "string" ? w : w?.text);
  if (res.timeSeparation?.violations?.length && !(res.warnings || []).some(w => /Time-separation/.test(w))) {
    add("warn", `${res.timeSeparation.violations.length} pair(s) of occasions/timepoints are closer than the minimum separation.`);
  }

  switch (study.type) {
    case "reliability": {
      for (const d of res.details || []) {
        if (d.skip) add("warn", `${d.label}: not analyzed — ${d.reason}`, "setup");
        if (d.note) add("info", `${d.label}: ${d.note}`);
      }
      break;
    }
    case "comparative":
    case "longitudinal": {
      for (const [label, lr] of Object.entries(res.labels || {})) {
        if (lr.skip) add("warn", `${label}: not analyzed — ${lr.reason}`, "setup");
        if (lr.note) add("info", `${label}: ${lr.note}`);
        if (lr.droppedPairs) add("info", `${label}: ${lr.droppedPairs} incomplete pair(s) were dropped.`);
        if (lr.sensitivity && lr.sensitivity.agrees === false) add("warn", `${label}: the ${lr.sensitivity.testName} sensitivity check disagrees with the main test — report both.`);
        for (const w of lr.lmm?.warnings || []) add("warn", `${label}: ${w}`);
        if (lr.rmAnova?.sphericity && lr.rmAnova.sphericity.spherical === false) add("info", `${label}: sphericity is violated (Mauchly p = ${lr.rmAnova.sphericity.p.toFixed(3)}); the ${lr.rmAnova.correctionUsed || "Greenhouse-Geisser"} correction is applied.`);
      }
      break;
    }
    case "descriptive": {
      for (const zs of Object.values(res.zScores || {})) if (zs?._stratumWarning) add("warn", zs._stratumWarning);
      for (const [label, c] of Object.entries(res.combined || {})) {
        if (c?.referenceInterval?.nonParametricWarning && c.referenceInterval.method === "non-parametric") add("info", `${label}: ${c.referenceInterval.nonParametricWarning}`);
      }
      break;
    }
    case "correlation": {
      if (res.regression?.note) add("info", `Regression: ${res.regression.note}`);
      if (res.logistic?.note) add("info", `Logistic regression: ${res.logistic.note}`);
      if (res.regression?.diagnostics?.heteroscedasticity?.p < 0.05) add("warn", "Regression residuals are heteroscedastic (Breusch-Pagan p < 0.05) — standard errors may be unreliable.");
      if ((res.regression?.vif || []).some(v => v > 5)) add("warn", "Some predictors are strongly collinear (VIF > 5).");
      break;
    }
    case "superimposition": {
      if (res.error) add("error", res.error, "setup");
      break;
    }
    default:
  }
  const order = { error: 0, warn: 1, info: 2 };
  return uniq(out).sort((a, b) => order[a.level] - order[b.level]);
}
