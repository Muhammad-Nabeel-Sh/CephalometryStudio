import { uid } from "../lib/utils.js";
import { mkSession, duplicateSession } from "./session.js";
import { auditChanges, appendAudit, withoutLockedFields } from "./audit.js";

export function mkSubject(opts = {}) {
  return { id: uid(), label: opts.label || "Subject", age: opts.age || "", sex: opts.sex || "" };
}

export function mkProject(projection) {
  const session = mkSession({ label: "T0", name: "Initial" });
  return {
    id: uid(),
    name: "New Case",
    projection,
    created: Date.now(),
    modified: Date.now(),
    meta: {
      patientId: "", name: "", dob: "", age: "", gender: "",
      ethnicity: "", clinician: "", facility: "", referral: "",
      notes: "", anonymized: false,
    },
    sessions: [session],
    activeSessionId: session.id,
    reproStudies: [],
    researchStudies: [],
    subjects: [],
    groups: [],
    timepoints: [],
    operators: [],
  };
}

export function getSession(project, sessionId) {
  return project.sessions.find(s => s.id === sessionId);
}

// Every session edit passes here: changes to measured data are added to the
// session's audit log, and a locked session's measured data is left as it is
// (model/audit.js). `opts.audit: false` skips the log (migrations, imports).
export function updateSessionInProject(project, sessionId, patch, opts = {}) {
  const now = opts.now ?? Date.now();
  return {
    ...project,
    modified: now,
    sessions: project.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const { patch: allowed } = withoutLockedFields(s, patch);
      const entries = opts.audit === false ? [] : auditChanges(s, allowed, { now });
      return entries.length ? { ...s, ...allowed, auditLog: appendAudit(s.auditLog, entries) } : { ...s, ...allowed };
    }),
  };
}

export function addSession(project, session) {
  return {
    ...project,
    modified: Date.now(),
    sessions: [...project.sessions, session],
    activeSessionId: session.id,
  };
}

// A session locked by a study can't be removed until it's unlocked.
export function removeSession(project, sessionId) {
  if (project.sessions.length <= 1) return project;
  if (project.sessions.find(s => s.id === sessionId)?.lock) return project;
  const filtered = project.sessions.filter(s => s.id !== sessionId);
  return {
    ...project,
    modified: Date.now(),
    sessions: filtered,
    activeSessionId:
      project.activeSessionId === sessionId
        ? filtered[0]?.id
        : project.activeSessionId,
  };
}

export function duplicateSessionInProject(project, sessionId) {
  const src = project.sessions.find(s => s.id === sessionId);
  if (!src) return project;
  const dup = duplicateSession(src);
  return {
    ...project,
    modified: Date.now(),
    sessions: [...project.sessions, dup],
  };
}

// ─── Subject CRUD ────────────────────────────────────────────────────────
export function addSubject(project, subject) {
  return { ...project, modified: Date.now(), subjects: [...project.subjects, subject] };
}

export function removeSubject(project, subjectId) {
  return { ...project, modified: Date.now(), subjects: project.subjects.filter(s => s.id !== subjectId) };
}

export function updateSubject(project, subjectId, patch) {
  return {
    ...project, modified: Date.now(),
    subjects: project.subjects.map(s => s.id === subjectId ? { ...s, ...patch } : s),
  };
}

export function getSessionsBySubject(project, subjectId) {
  return project.sessions.filter(s => s.subjectId === subjectId);
}

export function getSubjectOptions(project) {
  return project.subjects.map(s => ({ value: s.id, label: s.label }));
}
