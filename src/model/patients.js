// ═══════════════════════════════════════════════════════════════════════════════
// Patients on the home page (C1)
//
// A case (project) belongs to one patient, identified by its patient ID or,
// failing that, the patient's name. Cases of the same patient are listed
// together with a timeline of their sessions. A project whose sessions belong
// to several patients (a research collection) is listed as a study instead.
// ═══════════════════════════════════════════════════════════════════════════════

const clean = s => String(s ?? "").trim();

// The patient a case belongs to: { key, patientId, name } (key is null when the
// case has no patient details at all).
export function patientOfCase(p) {
  const id = clean(p?.meta?.patientId);
  const name = clean(p?.meta?.name);
  if (id) return { key: `id:${id.toLowerCase()}`, patientId: id, name };
  if (name) return { key: `name:${name.toLowerCase()}`, patientId: "", name };
  return { key: null, patientId: "", name: "" };
}

// Distinct per-session patient IDs (research collections tag each session).
function sessionPatients(p) {
  const ids = new Set();
  for (const s of p?.sessions || []) {
    const id = clean(s?.meta?.patientId || s?.subjectId);
    if (id) ids.add(id.toLowerCase());
  }
  return ids;
}

export const isStudyCollection = p => sessionPatients(p).size > 1;

const ageOf = s => {
  const a = Number(s?.meta?.age);
  return clean(s?.meta?.age) !== "" && Number.isFinite(a) ? a : null;
};

// One patient's sessions across all their cases, oldest first (by age when
// recorded, else by when the session was created).
export function patientTimeline(cases) {
  const rows = [];
  for (const p of cases) {
    for (const s of p.sessions || []) {
      rows.push({
        projectId: p.id, sessionId: s.id, caseName: p.name, projection: p.projection,
        label: clean(s.label), name: clean(s.name), age: ageOf(s), date: s.timestamp || p.created || 0,
        traced: (s.markups || []).some(m => m.type === "point" && m.placed !== false),
      });
    }
  }
  return rows.sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity) || a.date - b.date);
}

// → [{ key, kind: "patient"|"case"|"study", title, patientId, name, anonymized,
//      cases, modified, timeline, sessionCount }], most recently modified first.
export function groupByPatient(projects) {
  const groups = new Map();
  for (const p of projects || []) {
    if (!p) continue;
    let key, kind, title, who = { patientId: "", name: "" };
    if (isStudyCollection(p)) {
      key = `study:${p.id}`; kind = "study"; title = p.name || "Untitled study";
    } else {
      who = patientOfCase(p);
      if (who.key) { key = who.key; kind = "patient"; title = who.name || who.patientId; }
      else { key = `case:${p.id}`; kind = "case"; title = p.name || "Untitled case"; }
    }
    if (!groups.has(key)) groups.set(key, { key, kind, title, patientId: who.patientId, name: who.name, cases: [] });
    const g = groups.get(key);
    g.cases.push(p);
    if (!g.name && who.name) { g.name = who.name; g.title = who.name; }
  }
  return [...groups.values()].map(g => {
    const cases = [...g.cases].sort((a, b) => (b.modified || 0) - (a.modified || 0));
    const timeline = patientTimeline(cases);
    return {
      ...g,
      cases,
      anonymized: cases.every(p => p.meta?.anonymized),
      modified: Math.max(0, ...cases.map(p => p.modified || p.created || 0)),
      timeline,
      sessionCount: timeline.length,
      patientCount: g.kind === "study" ? sessionPatients(cases[0]).size : 1,
    };
  }).sort((a, b) => b.modified - a.modified);
}

// Case-insensitive search over patient name/ID, case names, projections and
// session labels. Every word must match somewhere.
export function searchPatients(groups, query) {
  const words = clean(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.filter(g => {
    const hay = [
      g.title, g.patientId, g.name,
      ...g.cases.flatMap(p => [p.name, p.projection, p.meta?.clinician, p.meta?.facility]),
      ...g.timeline.flatMap(r => [r.label, r.name]),
    ].map(x => clean(x).toLowerCase()).join(" ");
    return words.every(w => hay.includes(w));
  });
}
