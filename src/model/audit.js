// ═══════════════════════════════════════════════════════════════════════════════
// Session audit trail and trial locking (R4)
//
//   session.auditLog = [entry…]   append-only, oldest first
//   entry = { at, until?, by, kind, … }
//     kind "markups":      { added[], removed[], moved[], renamed[], edited[] } (labels)
//     kind "calibration":  { from, to }  (px/mm, null when not calibrated)
//     kind "facing":       { from, to }
//     kind "image":        { name }
//     kind "lock" | "unlock": { studyId, studyName }
//     kind "unseal":       { studyId, studyName }
//   session.lock = { studyId, studyName, at, by }   while locked
//
// updateSessionInProject (model/project.js) records changes here and refuses
// changes to a locked session's measured data, so every edit path is covered.
// Edits close together (AUDIT_MERGE_MS) by the same person merge into one entry,
// so dragging a point doesn't write hundreds of lines. Nothing here deletes or
// rewrites earlier entries.
// ═══════════════════════════════════════════════════════════════════════════════

export const AUDIT_MERGE_MS = 5 * 60 * 1000;
// What a lock protects: the data measurements are computed from.
export const LOCKED_KEYS = ["markups", "calibration", "facing", "angleMode"];
const LABELS_KEPT = 30;

let _actor = "";
// Who is editing: the app sets the active profile's name (there are no accounts).
export function setAuditActor(name) { _actor = String(name || "").trim(); }
export const auditActor = () => _actor;

const labelOf = (m) => m?.label || m?.type || "markup";
const samePoints = (a, b) => JSON.stringify(a?.points || []) === JSON.stringify(b?.points || []);
// Fields that change as a side effect (refreshed measurements, review state) aren't edits of their own.
const DERIVED = new Set(["points", "label", "values", "aiReview", "aiMoved", "reviewed", "flash"]);
const otherFieldsDiffer = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!DERIVED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])) return true;
  return false;
};

function markupChanges(before = [], after = []) {
  const old = new Map(before.map((m) => [m.id, m]));
  const now = new Map(after.map((m) => [m.id, m]));
  const c = { added: [], removed: [], moved: [], renamed: [], edited: [] };
  for (const m of after) if (!old.has(m.id)) c.added.push(labelOf(m));
  for (const m of before) if (!now.has(m.id)) c.removed.push(labelOf(m));
  for (const m of after) {
    const o = old.get(m.id);
    if (!o) continue;
    if (o.label !== m.label) c.renamed.push(`${labelOf(o)} → ${labelOf(m)}`);
    // Only placed points count as moved; measurements follow their points.
    if (m.type === "point" && !samePoints(o, m)) c.moved.push(labelOf(m));
    else if (m.type !== "point" && !m.autoCreated && !samePoints(o, m)) c.edited.push(labelOf(m));
    else if (otherFieldsDiffer(o, m)) c.edited.push(labelOf(m));
  }
  return Object.values(c).some((v) => v.length) ? c : null;
}

const calValue = (c) => (c?.done ? Number(c.pxPerMm) : null);
const baseImage = (s) => s?.images?.[0] || null;

// Entries describing what `patch` changes in `session` (none for display-only changes).
export function auditChanges(session, patch, { now = Date.now(), by = _actor } = {}) {
  if (!session || !patch) return [];
  const out = [];
  const entry = (kind, extra) => out.push({ at: now, by, kind, ...extra });
  if (patch.markups !== undefined && patch.markups !== session.markups) {
    const c = markupChanges(session.markups || [], patch.markups || []);
    if (c) entry("markups", c);
  }
  if (patch.calibration !== undefined) {
    const from = calValue(session.calibration), to = calValue(patch.calibration);
    if (from !== to) entry("calibration", { from, to });
  }
  if (patch.facing !== undefined && (patch.facing || "auto") !== (session.facing || "auto")) entry("facing", { from: session.facing || "auto", to: patch.facing || "auto" });
  // A different image (not a frame change, nor a new window on the same pixels).
  if (patch.images !== undefined && patch.stack === undefined) {
    const a = baseImage(session), b = patch.images?.[0] || null;
    const sameSource = a && b && (a.id === b.id || (a.raw?.key && a.raw.key === b.raw?.key));
    if (b && !sameSource) entry("image", { name: b.name || "" });
  }
  return out;
}

const union = (a = [], b = []) => [...new Set([...a, ...b])].slice(0, LABELS_KEPT);

// The log with `entries` added; a markup edit merges into the last one when it's
// recent and by the same person.
export function appendAudit(log = [], entries = []) {
  let out = log;
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && e.kind === "markups" && last.kind === "markups" && last.by === e.by && e.at - (last.until || last.at) <= AUDIT_MERGE_MS) {
      const merged = { ...last, until: e.at };
      for (const k of ["added", "removed", "moved", "renamed", "edited"]) merged[k] = union(last[k], e[k]);
      out = [...out.slice(0, -1), merged];
    } else out = [...out, e];
  }
  return out;
}

// A patch with the locked fields left out (they're refused while locked).
export function withoutLockedFields(session, patch) {
  if (!session?.lock || !patch) return { patch, refused: [] };
  const refused = LOCKED_KEYS.filter((k) => patch[k] !== undefined && patch[k] !== session[k]);
  if (!refused.length) return { patch, refused };
  const next = { ...patch };
  for (const k of refused) delete next[k];
  return { patch: next, refused };
}

// ─── Locking a reliability study's trial sessions ───────────────────────

// Session ids a reliability study measures: its cases' sessions and workflow copies.
export function trialSessionIds(study) {
  const ids = new Set();
  const c = study?.config || {};
  for (const cs of c.cases || []) for (const m of cs.sessions || []) if (m.sessionId) ids.add(m.sessionId);
  for (const st of c.workflow?.steps || []) if (st.cloneSessionId) ids.add(st.cloneSessionId);
  return [...ids];
}

const lockEvent = (kind, study, now, by) => ({ at: now, by, kind, studyId: study.id, studyName: study.name || "" });

// Lock every trial session of `studyId`. Sessions already locked by another study stay as they are.
export function lockStudy(project, studyId, { now = Date.now(), by = _actor } = {}) {
  const study = (project?.researchStudies || []).find((s) => s.id === studyId);
  if (!study) return project;
  const ids = new Set(trialSessionIds(study));
  const ev = lockEvent("lock", study, now, by);
  return {
    ...project,
    modified: now,
    sessions: (project.sessions || []).map((s) => (!ids.has(s.id) || s.lock ? s : {
      ...s, lock: { studyId, studyName: study.name || "", at: now, by }, auditLog: appendAudit(s.auditLog, [ev]),
    })),
    researchStudies: project.researchStudies.map((s) => (s.id !== studyId ? s : {
      ...s, config: { ...s.config, lock: { at: now, by }, lockLog: [...(s.config.lockLog || []), { kind: "lock", at: now, by }] },
    })),
  };
}

// Unlock one session (`sessionId`) or every session the study locked. Logged on both.
export function unlockStudy(project, studyId, { sessionId = null, now = Date.now(), by = _actor } = {}) {
  const study = (project?.researchStudies || []).find((s) => s.id === studyId);
  const ev = study ? lockEvent("unlock", study, now, by) : { at: now, by, kind: "unlock", studyId };
  let count = 0;
  const sessions = (project.sessions || []).map((s) => {
    if (s.lock?.studyId !== studyId || (sessionId && s.id !== sessionId)) return s;
    count++;
    const { lock: _lock, ...rest } = s;
    return { ...rest, auditLog: appendAudit(s.auditLog, [ev]) };
  });
  if (!count) return project;
  const stillLocked = sessions.some((s) => s.lock?.studyId === studyId);
  return {
    ...project,
    modified: now,
    sessions,
    researchStudies: (project.researchStudies || []).map((s) => (s.id !== studyId ? s : {
      ...s,
      config: {
        ...s.config,
        lock: stillLocked ? s.config.lock : undefined,
        lockLog: [...(s.config.lockLog || []), { kind: "unlock", at: now, by, ...(sessionId ? { sessionId } : {}) }],
      },
    })),
  };
}

// { locked, partly, sessions, lockedCount, unlocks } for a study's lock state.
export function studyLockState(project, study) {
  const ids = trialSessionIds(study);
  const byId = new Map((project?.sessions || []).map((s) => [s.id, s]));
  const lockedCount = ids.filter((id) => byId.get(id)?.lock?.studyId === study.id).length;
  const unlocks = (study?.config?.lockLog || []).filter((e) => e.kind === "unlock").length;
  return { sessions: ids.length, lockedCount, locked: ids.length > 0 && lockedCount === ids.length, partly: lockedCount > 0 && lockedCount < ids.length, unlocks, since: study?.config?.lock?.at || null };
}

// ─── Reading the log ────────────────────────────────────────────────────

const list = (xs) => (xs.length > 4 ? `${xs.slice(0, 4).join(", ")} and ${xs.length - 4} more` : xs.join(", "));
const fmtCal = (v) => (v == null ? "not calibrated" : `${(+v).toFixed(3)} px/mm`);

export function describeAuditEntry(e) {
  switch (e?.kind) {
    case "markups": {
      const parts = [];
      if (e.added?.length) parts.push(`added ${list(e.added)}`);
      if (e.moved?.length) parts.push(`moved ${list(e.moved)}`);
      if (e.renamed?.length) parts.push(`renamed ${list(e.renamed)}`);
      if (e.edited?.length) parts.push(`changed ${list(e.edited)}`);
      if (e.removed?.length) parts.push(`removed ${list(e.removed)}`);
      const s = parts.join("; ");
      return s ? s[0].toUpperCase() + s.slice(1) : "Edited markups";
    }
    case "calibration": return `Calibration: ${fmtCal(e.from)} → ${fmtCal(e.to)}`;
    case "facing": return `Profile direction: ${e.from} → ${e.to}`;
    case "image": return `Image replaced${e.name ? ` with ${e.name}` : ""}`;
    case "lock": return `Locked by the study “${e.studyName}”`;
    case "unlock": return `Unlocked from the study “${e.studyName}”`;
    case "unseal": return `Blinding seal broken for the study “${e.studyName}”`;
    default: return "Change";
  }
}

// One line per entry, newest first, for the History dialog.
export function auditLines(log = [], { locale } = {}) {
  const when = (t) => new Date(t).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  return [...log].reverse().map((e) => `${when(e.until || e.at)}${e.by ? ` · ${e.by}` : ""} — ${describeAuditEntry(e)}`);
}
