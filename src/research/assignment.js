// ═══════════════════════════════════════════════════════════════════════════════
// assignment.js — checking and bulk-building session assignments (A6)
// ═══════════════════════════════════════════════════════════════════════════════

import { studySessions } from "./dataPreview.js";

const patientKey = s => s?.subjectId || s?.meta?.patientId || "";

// Sessions with tracings that the study does not use, and sessions used twice
// (a session in two comparison groups, or at two timepoints of one subject).
export function assignmentReport(study, sessions) {
  const all = (sessions || []).filter(Boolean);
  const used = studySessions(study, all);
  const roles = new Map();
  for (const { sessionId, role } of used) {
    if (!roles.has(sessionId)) roles.set(sessionId, []);
    roles.get(sessionId).push(role);
  }
  const traced = all.filter(s => (s.markups || []).some(m => m.placed !== false && m.type !== "ruler"));
  const multiAllowed = study?.type === "reliability"; // one base session serves every rater × occasion
  return {
    used: roles.size,
    unassigned: traced.filter(s => !roles.has(s.id)).map(s => s.id),
    duplicates: multiAllowed ? [] : [...roles.entries()].filter(([, r]) => r.length > 1).map(([sessionId, r]) => ({ sessionId, roles: r })),
    missing: [...roles.keys()].filter(id => !all.some(s => s.id === id)),
  };
}

// Comparative: add sessions to one group (removing them from any other group).
export function addSessionsToGroup(config, groupId, sessionIds) {
  const ids = new Set(sessionIds);
  return {
    ...config,
    groups: (config.groups || []).map(g => g.id === groupId
      ? { ...g, caseIds: [...(g.caseIds || []), ...sessionIds.filter(id => !(g.caseIds || []).includes(id))] }
      : { ...g, caseIds: (g.caseIds || []).filter(id => !ids.has(id)) }),
  };
}

const ageOf = s => {
  const a = Number(s?.meta?.age);
  return s?.meta?.age !== "" && s?.meta?.age != null && Number.isFinite(a) ? a : null;
};

// Longitudinal: one subject per patient (subjectId / patient ID), its sessions
// ordered by age (then creation time) as T1, T2, …. Existing timepoint ids and
// labels are reused where possible. Patients with a single session are skipped.
export function buildLongitudinalFromPatients(config, sessions, uid) {
  const byPatient = new Map();
  for (const s of (sessions || []).filter(Boolean)) {
    const key = patientKey(s);
    if (!key) continue;
    if (!byPatient.has(key)) byPatient.set(key, []);
    byPatient.get(key).push(s);
  }
  const series = [...byPatient.entries()]
    .map(([key, list]) => [key, list.sort((a, b) => (ageOf(a) ?? Infinity) - (ageOf(b) ?? Infinity) || (a.timestamp || 0) - (b.timestamp || 0))])
    .filter(([, list]) => list.length >= 2);
  const k = Math.max(0, ...series.map(([, l]) => l.length));
  if (k < 2) return { config, added: 0, skippedPatients: byPatient.size };
  // Keep the user's timepoints when their number matches; otherwise T1…Tk.
  const old = config.timepoints || [];
  const timepoints = old.length === k ? old : Array.from({ length: k }, (_, i) => ({ id: uid(), label: `T${i + 1}`, targetAge: null, window: 90 }));
  const subjects = series.map(([key, list]) => ({
    id: uid(), label: key,
    records: Object.fromEntries(list.map((s, i) => [timepoints[i].id, s.id])),
  }));
  return { config: { ...config, timepoints, subjects }, added: subjects.length, skippedPatients: byPatient.size - series.length };
}
