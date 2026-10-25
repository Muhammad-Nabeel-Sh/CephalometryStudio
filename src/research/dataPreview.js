// ═══════════════════════════════════════════════════════════════════════════════
// dataPreview.js — the exact values a study will analyze, before running it
//
// One row per session the study uses, one column per measurement label, each
// cell the markup's primary measurement (via sessionPrimaryMeasure — the same
// path every research module reads). Lets the user check units, missing values
// and obviously wrong numbers before inference, and export a tidy CSV for R/SPSS.
// ═══════════════════════════════════════════════════════════════════════════════

import { isResearchMarkup, sessionPrimaryMeasure } from "./collect.js";

// [{ sessionId, role }] in the order the study uses them.
export function studySessions(study) {
  const c = study?.config || {};
  const out = [];
  const add = (sessionId, role) => { if (sessionId && !out.some(o => o.sessionId === sessionId && o.role === role)) out.push({ sessionId, role }); };
  switch (study?.type) {
    case "reliability":
      for (const cs of c.cases || []) for (const m of cs.sessions || []) add(m.sessionId, `${cs.name || cs.id} · ${m.operatorId || ""} · occ ${m.occasion ?? ""}`);
      break;
    case "comparative":
      for (const g of c.groups || []) (g.caseIds || []).forEach((id, i) => add(id, `${g.label} · case ${i + 1}`));
      break;
    case "longitudinal":
      for (const subj of c.subjects || []) for (const tp of c.timepoints || []) add(subj.records?.[tp.id], `${subj.label || subj.id} · ${tp.label || tp.id}`);
      break;
    case "superimposition":
      add(c.baseSessionId, "base (T1)"); add(c.compareSessionId, "compare (T2)");
      for (const id of c.sessionIds || []) add(id, "");
      break;
    case "airway":
      add(c.sessionId, "");
      break;
    default:
      for (const id of c.sessionIds || []) add(id, "");
  }
  return out;
}

export function buildDataMatrix(study, sessions, calibration) {
  const labelFilter = study?.config?.labelIds || [];
  const byId = new Map((sessions || []).filter(Boolean).map(s => [s.id, s]));
  const columns = new Map();
  const rows = [];
  let missingSessions = 0;
  for (const { sessionId, role } of studySessions(study)) {
    const s = byId.get(sessionId);
    if (!s) { missingSessions++; continue; }
    const values = {};
    for (const m of s.markups || []) {
      if (!isResearchMarkup(m)) continue;
      if (labelFilter.length && !labelFilter.includes(m.label)) continue;
      if (values[m.label] !== undefined) continue;
      const pm = sessionPrimaryMeasure(s, m, calibration);
      if (!pm) continue;
      values[m.label] = pm.value;
      if (!columns.has(m.label)) columns.set(m.label, { label: m.label, unit: pm.unit, n: 0 });
      columns.get(m.label).n++;
    }
    rows.push({
      sessionId, role, sessionName: s.name || s.label || sessionId,
      age: s.meta?.age ?? "", sex: s.meta?.sex ?? "", group: s.meta?.group ?? "",
      calibrated: s.calibration?.done === true || calibration?.done === true,
      values,
    });
  }
  const cols = [...columns.values()].sort((a, b) => a.label.localeCompare(b.label));
  const mixedUnits = cols.filter(c => rows.some(r => r.values[c.label] !== undefined && !r.calibrated) && rows.some(r => r.values[c.label] !== undefined && r.calibrated) && c.unit !== "°");
  return { columns: cols, rows, missingSessions, warnings: mixedUnits.length ? [`Calibrated and uncalibrated sessions are mixed for: ${mixedUnits.map(c => c.label).join(", ")} (mm vs px).`] : [] };
}

const csvCell = v => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Wide, tidy CSV: one row per session, one column per measurement (unit in header).
export function dataMatrixToCSV(matrix) {
  const head = ["session_id", "session", "role", "age", "sex", "group", ...matrix.columns.map(c => (c.unit ? `${c.label} [${c.unit}]` : c.label))];
  const lines = [head.map(csvCell).join(",")];
  for (const r of matrix.rows) {
    lines.push([r.sessionId, r.sessionName, r.role, r.age, r.sex, r.group, ...matrix.columns.map(c => (r.values[c.label] ?? ""))].map(csvCell).join(","));
  }
  return lines.join("\n");
}
