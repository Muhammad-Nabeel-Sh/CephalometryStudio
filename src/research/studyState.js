// ═══════════════════════════════════════════════════════════════════════════════
// studyState.js — what a study's results depend on, and whether they are current
//
// A study run stores `dataFingerprint`: a hash of its configuration plus the
// content of every session it uses (markups, calibration, metadata, facing).
// If any of those change afterwards the results are "stale" and the UI asks for
// a re-run instead of silently showing numbers computed from older data.
// ═══════════════════════════════════════════════════════════════════════════════

import { studySessions } from "./dataPreview.js";

// FNV-1a 32-bit over a string → 8 hex chars.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const r3 = v => (typeof v === "number" && isFinite(v) ? Math.round(v * 1000) / 1000 : v ?? null);

function sessionSignature(s) {
  if (!s) return "missing";
  const marks = (s.markups || []).map(m => [
    m.id, m.type, m.label, m.measure || "", m.visible === false ? 0 : 1, m.placed === false ? 0 : 1,
    m.signed ?? "", r3(m.computedValue), (m.points || []).map(p => `${r3(p.x)},${r3(p.y)}`).join(";"),
  ].join("|"));
  const cal = s.calibration || {};
  const meta = s.meta || {};
  return JSON.stringify([
    marks, cal.done ? r3(cal.pxPerMm) : 0, s.facing || "auto", s.subjectId || "",
    meta.age ?? "", meta.sex ?? "", meta.group ?? "", meta.patientId ?? "", meta.operatorId ?? "", meta.timepoint ?? "",
  ]);
}

// Configuration keys that do not affect the numbers (UI-only state).
const UI_ONLY_KEYS = new Set(["notes", "blindingLog"]);

export function fingerprintStudy(study, sessions, calibration) {
  const byId = new Map((sessions || []).filter(Boolean).map(s => [s.id, s]));
  const cfg = Object.fromEntries(Object.entries(study?.config || {}).filter(([k]) => !UI_ONLY_KEYS.has(k)));
  const ids = [...new Set(studySessions(study, sessions).map(x => x.sessionId))].sort();
  const parts = [
    study?.type, JSON.stringify(cfg),
    calibration?.done ? r3(calibration.pxPerMm) : 0,
    ...ids.map(id => `${id}:${sessionSignature(byId.get(id))}`),
  ];
  return fnv1a(parts.join("\n"));
}

// "never-run" | "running" | "error" | "stale" | "current" | "legacy" (run before fingerprints existed)
export function studyStatus(study, sessions, calibration) {
  if (!study) return "never-run";
  if (study.status === "running") return "running";
  if (study.status === "error") return "error";
  if (study.status !== "completed" || !study.results) return "never-run";
  if (!study.dataFingerprint) return "legacy";
  return fingerprintStudy(study, sessions, calibration) === study.dataFingerprint ? "current" : "stale";
}
