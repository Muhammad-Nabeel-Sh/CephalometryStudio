// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH WORKSPACE — full-screen studies module (A1, A2, A3, A5, A6, A7, A14, A16)
//
// Left: study list (status, duplicate, rename, archive, delete with undo).
// Right: the active study as a four-step wizard — Setup → Check data → Run →
// Results. The per-type setup screens are the existing *Config components.
// All project writes are functional updates so concurrent edits (e.g. a run
// finishing while the user edits notes) are never lost.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STUDY_TYPES, mkStudy } from "./studyModel.js";
import { runStudyAsync } from "./engineClient.js";
import { ReliabilityConfig } from "./ReliabilityPanel.jsx";
import { DescriptiveConfig } from "./DescriptivePanel.jsx";
import { ComparativeConfig } from "./ComparativePanel.jsx";
import { LongitudinalConfig } from "./LongitudinalPanel.jsx";
import { CorrelationConfig } from "./CorrelationPanel.jsx";
import { DiagnosticConfig } from "./DiagnosticPanel.jsx";
import { SuperimpositionConfig } from "./SuperimpositionPanel.jsx";
import { AirwayStudyConfig } from "./AirwayStudyPanel.jsx";
import StudyGuideModal from "./StudyGuideModal.jsx";
import StudyResultsView from "./StudyResultsView.jsx";
import { DataPreview, SampleSizeCalculator } from "./StudyTools.jsx";
import { fingerprintStudy, studyStatus } from "./studyState.js";
import { blindingProgress } from "./blinding.js";
import { assignmentReport, addSessionsToGroup, buildLongitudinalFromPatients } from "./assignment.js";
import { ALL_SESSION_TYPES } from "./dataPreview.js";
import { saveStudyDefaults, copySettings } from "./studyDefaults.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

const uid = () => Math.random().toString(36).slice(2, 10);

const CONFIGS = {
  reliability: ReliabilityConfig, descriptive: DescriptiveConfig, comparative: ComparativeConfig,
  longitudinal: LongitudinalConfig, correlation: CorrelationConfig, diagnostic: DiagnosticConfig,
  superimposition: SuperimpositionConfig, airway: AirwayStudyConfig,
};

const STEPS = [
  { id: "setup", label: "Setup" },
  { id: "data", label: "Check data" },
  { id: "run", label: "Run" },
  { id: "results", label: "Results" },
];

const STATUS_CHIP = {
  "never-run": ["Not run", "tx3"], running: ["Running…", "acc"], error: ["Error", "err"],
  stale: ["Out of date", "warn"], current: ["Up to date", "ok"], legacy: ["Re-run advised", "warn"],
};

const sessionName = s => s?.name || s?.label || s?.id?.slice(0, 8) || "Session";

function Chip({ t, label, color }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: t[color] + "22", color: t[color], whiteSpace: "nowrap" }}>{label}</span>;
}

function Button({ t, children, onClick, primary, danger, disabled, title, small }) {
  const col = danger ? t.err : t.acc;
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ padding: small ? "4px 10px" : "7px 14px", fontSize: small ? 11.5 : 12.5, fontWeight: 600, borderRadius: 6, fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        border: `1px solid ${primary ? col : danger ? t.err + "88" : t.bdr}`,
        background: primary ? col : "transparent", color: primary ? t.bg : danger ? t.err : t.tx }}>
      {children}
    </button>
  );
}

// ─── Setup helpers (A6 + session scope) ────────────────────────────────────

function SessionScope({ t, study, sessions, onUpdateStudy }) {
  if (!ALL_SESSION_TYPES.has(study.type)) return null;
  const scope = study.config.sessionScope === "selected" ? "selected" : "all";
  const ids = new Set(study.config.sessionIds || []);
  const set = patch => onUpdateStudy({ ...study, config: { ...study.config, ...patch } });
  return (
    <section style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.bdr}`, marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Sessions in this study</div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: t.tx2, marginBottom: 4 }}>
        <input type="radio" checked={scope === "all"} onChange={() => set({ sessionScope: "all" })} /> All sessions in the project ({sessions.length}), including ones added later
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: t.tx2 }}>
        <input type="radio" checked={scope === "selected"} onChange={() => set({ sessionScope: "selected", sessionIds: study.config.sessionIds?.length ? study.config.sessionIds : sessions.map(s => s.id) })} /> Only selected sessions ({scope === "selected" ? sessions.filter(s => ids.has(s.id)).length : "—"})
      </label>
      {scope === "selected" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <Button t={t} small onClick={() => set({ sessionIds: sessions.map(s => s.id) })}>Select all</Button>
            <Button t={t} small onClick={() => set({ sessionIds: [] })}>Select none</Button>
          </div>
          <div style={{ maxHeight: 180, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4 }}>
            {sessions.map(s => (
              <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: t.tx2 }}>
                <input type="checkbox" checked={ids.has(s.id)} onChange={e => set({ sessionIds: e.target.checked ? [...ids, s.id] : [...ids].filter(x => x !== s.id) })} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionName(s)}{s.meta?.group ? ` · ${s.meta.group}` : ""}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AssignmentTools({ t, study, sessions, onUpdateStudy, notify }) {
  const report = useMemo(() => assignmentReport(study, sessions), [study, sessions]);
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [showPick, setShowPick] = useState(false);
  if (ALL_SESSION_TYPES.has(study.type) || study.type === "airway") return null;
  const byId = new Map(sessions.map(s => [s.id, s]));
  const groups = study.config.groups || [];

  const addToGroup = () => {
    const gid = target || groups[0]?.id;
    if (!gid || !picked.size) return;
    onUpdateStudy({ ...study, config: addSessionsToGroup(study.config, gid, [...picked]) });
    notify(`${picked.size} session(s) added to ${groups.find(g => g.id === gid)?.label || "the group"}.`);
    setPicked(new Set());
  };
  const buildLongitudinal = () => {
    if ((study.config.subjects || []).some(s => Object.keys(s.records || {}).length) && !confirmReplace) { setConfirmReplace(true); return; }
    const res = buildLongitudinalFromPatients(study.config, sessions, uid);
    setConfirmReplace(false);
    if (!res.added) { notify("No patient has two or more sessions with the same patient ID — set patient IDs in the session metadata first."); return; }
    onUpdateStudy({ ...study, config: res.config });
    notify(`${res.added} subject(s) built from patient IDs${res.skippedPatients ? `; ${res.skippedPatients} patient(s) with a single session were skipped` : ""}.`);
  };

  return (
    <section style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.bdr}`, marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Assignment check</div>
      <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.6 }}>
        {report.used} session{report.used === 1 ? "" : "s"} used by this study.
        {report.unassigned.length > 0 && <> <b style={{ color: t.warn }}>{report.unassigned.length}</b> traced session{report.unassigned.length > 1 ? "s are" : " is"} not assigned.</>}
        {report.duplicates.length > 0 && <> <b style={{ color: t.err }}>{report.duplicates.length}</b> session{report.duplicates.length > 1 ? "s are" : " is"} assigned more than once: {report.duplicates.slice(0, 4).map(d => `${sessionName(byId.get(d.sessionId))} (${d.roles.join(" & ")})`).join("; ")}.</>}
        {report.missing.length > 0 && <> <b style={{ color: t.err }}>{report.missing.length}</b> assigned session{report.missing.length > 1 ? "s no longer exist" : " no longer exists"}.</>}
        {!report.unassigned.length && !report.duplicates.length && !report.missing.length && " No problems found."}
      </div>
      {study.type === "comparative" && report.unassigned.length > 0 && groups.length > 0 && !showPick && (
        <div style={{ marginTop: 8 }}><Button t={t} small onClick={() => setShowPick(true)}>Add unassigned sessions to a group…</Button></div>
      )}
      {study.type === "comparative" && report.unassigned.length > 0 && groups.length > 0 && showPick && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: t.tx2, marginBottom: 4 }}>Add unassigned sessions to a group:</div>
          <div style={{ maxHeight: 150, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4, marginBottom: 6 }}>
            {report.unassigned.map(id => (
              <label key={id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: t.tx2 }}>
                <input type="checkbox" checked={picked.has(id)} onChange={e => { const n = new Set(picked); if (e.target.checked) n.add(id); else n.delete(id); setPicked(n); }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionName(byId.get(id))}{byId.get(id)?.meta?.group ? ` · ${byId.get(id).meta.group}` : ""}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Button t={t} small onClick={() => setPicked(new Set(report.unassigned))}>Select all</Button>
            <select value={target || groups[0]?.id} onChange={e => setTarget(e.target.value)} aria-label="Target group"
              style={{ padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12 }}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <Button t={t} small primary disabled={!picked.size} onClick={addToGroup}>Add {picked.size || ""} to group</Button>
            <Button t={t} small onClick={() => { setShowPick(false); setPicked(new Set()); }}>Close</Button>
          </div>
        </div>
      )}
      {study.type === "longitudinal" && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button t={t} small onClick={buildLongitudinal}>{confirmReplace ? "Replace existing subjects?" : "Build subjects from patient IDs (ordered by age)"}</Button>
          {confirmReplace && <Button t={t} small onClick={() => setConfirmReplace(false)}>Cancel</Button>}
          <span style={{ fontSize: 11.5, color: t.tx3 }}>One subject per patient ID; each patient’s sessions become T1, T2, … by age (then date).</span>
        </div>
      )}
    </section>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────

function Stepper({ t, step, setStep, status, blocked }) {
  return (
    <nav aria-label="Study steps" style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
      {STEPS.map((s, i) => {
        const active = s.id === step;
        const doneMark = (s.id === "results" && (status === "current")) ? " ✓" : (s.id === "results" && status === "stale") ? " !" : "";
        const disabled = s.id === "results" && (status === "never-run" || status === "running");
        return (
          <button key={s.id} onClick={() => !disabled && setStep(s.id)} aria-current={active ? "step" : undefined} disabled={disabled}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 20, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
              cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
              border: `1px solid ${active ? t.acc : t.bdr}`, background: active ? t.acc + "22" : "transparent", color: active ? t.acc : t.tx2 }}>
            <span style={{ width: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: active ? t.acc : t.surf3, color: active ? t.bg : t.tx2 }}>{i + 1}</span>
            {s.label}{doneMark}{s.id === "run" && blocked ? " 🔒" : ""}
          </button>
        );
      })}
    </nav>
  );
}

function RunPanel({ t, study, status, running, now, onRun, onCancel, blinding }) {
  const p = running?.p || 0;
  const elapsed = running ? Math.max(0, (now - running.startedAt) / 1000) : 0;
  const eta = running && p > 0.1 ? Math.max(0, (elapsed * (1 - p)) / p) : null;
  return (
    <section style={{ padding: 16, borderRadius: 8, border: `1px solid ${t.bdr}`, maxWidth: 640 }}>
      {blinding.blocked ? (
        <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.6 }}>
          <b style={{ color: t.acc }}>Blinded data collection in progress</b> — {blinding.done} of {blinding.total} tracings done.
          Results are locked until every workflow step is complete, so no rater sees agreement figures while still measuring.
          {study?.config?.blindingLog?.length > 0 && (
            <div style={{ marginTop: 6, color: t.warn }}>
              The seal was broken for {study.config.blindingLog.length} session(s); this will be reported with the results.
            </div>
          )}
        </div>
      ) : running ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: t.tx }} role="status">Running… {running.label ? `${running.label} · ` : ""}{Math.round(p * 100)}% · {elapsed.toFixed(1)} s{eta != null ? ` · about ${Math.ceil(eta)} s left` : ""}</div>
          <div style={{ height: 8, borderRadius: 4, background: t.surf3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(p * 100)}%`, background: t.acc, transition: "width 0.15s" }} />
          </div>
          <div><Button t={t} danger onClick={onCancel}>Cancel</Button></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.6 }}>
            {status === "current" ? "These results are up to date." : status === "stale" ? "The data or settings changed since the last run." : status === "error" ? "The last run failed — check the setup and run again." : "Ready to run."}
            {study.lastRun ? ` Last run ${new Date(study.lastRun.at).toLocaleString()} (${(study.lastRun.ms / 1000).toFixed(1)} s).` : ""}
          </div>
          <div><Button t={t} primary onClick={onRun}>{study.results ? "Re-run analysis" : "Run analysis"}</Button></div>
        </div>
      )}
    </section>
  );
}

// ─── Workspace ─────────────────────────────────────────────────────────────

// The open study and its step survive closing the workspace (e.g. to trace a
// reliability step on the canvas), so reopening returns to the same place.
let lastStudyId = null;
let lastSteps = {};

export default function ResearchWorkspace({ t, project, onUpdateProject, calibration, onClose }) {
  const studies = useMemo(() => project?.researchStudies || [], [project]);
  const sessions = useMemo(() => project?.sessions || [], [project]);
  const narrow = useMediaQuery("(max-width: 900px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  const [selectedId, setSelectedId] = useState(() => {
    const list = project?.researchStudies || [];
    return (list.find(s => s.id === lastStudyId) || list.find(s => !s.archived))?.id || null;
  });
  const [mode, setMode] = useState(() => ((project?.researchStudies || []).length ? "study" : "new"));
  const [newType, setNewType] = useState("reliability");
  const [steps, setSteps] = useState(() => lastSteps);
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [running, setRunning] = useState(null);
  const [toast, setToast] = useState(null);
  const [guideType, setGuideType] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [now, setNow] = useState(0);
  const abortRef = useRef(null);
  const toastTimer = useRef(null);

  // Keep the elapsed/ETA readout moving while a run is in progress.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const notify = useCallback((text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 8000 : 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Escape returns to the canvas unless the user is typing or a dialog is open.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape" || guideType) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guideType]);

  const updateStudies = useCallback(fn => onUpdateProject(prev => ({ ...prev, researchStudies: fn(prev.researchStudies || []) })), [onUpdateProject]);
  const updateStudy = useCallback((id, fn) => updateStudies(list => list.map(s => (s.id === id ? fn(s) : s))), [updateStudies]);
  const onUpdateStudy = useCallback(updated => updateStudy(updated.id, () => updated), [updateStudy]);
  // Config components may open a session for tracing (reliability workflow):
  // pass project writes through and return to the canvas when that happens.
  const onConfigProjectUpdate = useCallback(next => {
    onUpdateProject(next);
    if (typeof next === "object" && next?.activeSessionId && next.activeSessionId !== project?.activeSessionId) onClose();
  }, [onUpdateProject, project?.activeSessionId, onClose]);

  useEffect(() => { lastStudyId = selectedId; lastSteps = steps; }, [selectedId, steps]);

  const study = studies.find(s => s.id === selectedId) || null;
  const status = study ? (running?.id === study.id ? "running" : studyStatus(study, sessions, calibration)) : null;
  const blinding = study ? blindingProgress(study) : { blocked: false };
  const step = study ? (steps[study.id] || (study.results ? "results" : "setup")) : "setup";
  const setStep = s => study && setSteps(m => ({ ...m, [study.id]: s }));
  const visible = studies.filter(s => showArchived || !s.archived);
  const archivedCount = studies.filter(s => s.archived).length;

  const create = () => {
    const meta = STUDY_TYPES.find(st => st.id === newType);
    const s = mkStudy(newType, { name: `${meta?.name || newType} ${studies.length + 1}`, sessionIds: sessions.map(x => x.id) });
    updateStudies(list => [...list, s]);
    setSelectedId(s.id);
    setSteps(m => ({ ...m, [s.id]: "setup" }));
    setMode("study");
  };
  const duplicate = s => {
    const copy = JSON.parse(JSON.stringify(s));
    const d = { ...copy, id: uid(), name: `Copy of ${s.name}`, results: null, status: "configured", dataFingerprint: undefined, lastRun: undefined, archived: false, createdAt: Date.now(), updatedAt: Date.now() };
    // A reliability workflow points at tracing sessions that belong to the original study.
    if (d.config.workflow) d.config.workflow = undefined;
    if (d.config.blindingLog) d.config.blindingLog = undefined;
    updateStudies(list => [...list, d]);
    setSelectedId(d.id);
    notify(`Duplicated “${s.name}” (settings and assignments, without results).`);
  };
  const remove = s => {
    const idx = studies.findIndex(x => x.id === s.id);
    updateStudies(list => list.filter(x => x.id !== s.id));
    if (selectedId === s.id) setSelectedId(studies.find(x => x.id !== s.id && !x.archived)?.id || null);
    notify(`Deleted “${s.name}”.`, () => {
      updateStudies(list => { const next = [...list]; next.splice(Math.min(idx, next.length), 0, s); return next; });
      setSelectedId(s.id);
      setToast(null);
    });
  };
  const toggleArchive = s => {
    updateStudy(s.id, x => ({ ...x, archived: !x.archived }));
    notify(s.archived ? `Restored “${s.name}”.` : `Archived “${s.name}” — show archived studies to find it again.`);
  };

  const run = () => {
    if (!study || running || blinding.blocked) return;
    const snapshot = study;
    const fp = fingerprintStudy(snapshot, sessions, calibration);
    const startedAt = performance.now();
    updateStudy(snapshot.id, s => ({ ...s, status: "running" }));
    setRunning({ id: snapshot.id, p: 0, label: "starting", startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    runStudyAsync(snapshot, sessions, calibration, {
      onProgress: (p, label) => setRunning(r => (r ? { ...r, p, label: label || "" } : r)),
      signal: controller.signal,
    }).then(done => {
      // Keep anything edited while the run was in progress (name, notes, config).
      updateStudy(snapshot.id, s => ({ ...s, status: done.status, results: done.results, updatedAt: Date.now(), dataFingerprint: fp, lastRun: { at: Date.now(), ms: performance.now() - startedAt } }));
      setStep("results");
    }).catch(err => {
      const isAbort = err?.name === "AbortError";
      updateStudy(snapshot.id, s => (isAbort ? { ...s, status: s.results ? "completed" : "configured" } : { ...s, status: "error", results: { error: err?.message || String(err), timestamp: Date.now() } }));
      if (isAbort) notify("Run cancelled.");
    }).finally(() => {
      setRunning(null);
      abortRef.current = null;
    });
  };
  const cancel = () => { try { abortRef.current?.abort(); } catch { /* best effort */ } };

  const Config = study ? CONFIGS[study.type] : null;
  const typeMeta = study ? STUDY_TYPES.find(st => st.id === study.type) : null;
  const sameTypeStudies = study ? studies.filter(s => s.id !== study.id && s.type === study.type) : [];

  // ── Study list ──
  const list = (
    <aside aria-label="Studies" style={{ width: narrow ? "auto" : 280, flexShrink: 0, borderRight: narrow ? "none" : `1px solid ${t.bdr}`, borderBottom: narrow ? `1px solid ${t.bdr}` : "none", display: "flex", flexDirection: "column", minHeight: 0, background: t.surf }}>
      <div style={{ display: "flex", gap: 6, padding: 12 }}>
        <Button t={t} primary onClick={() => setMode("new")}>+ New study</Button>
        <Button t={t} onClick={() => setMode("power")} title="A-priori sample size">Sample size</Button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px", display: narrow ? "flex" : "block", gap: 6, overflowX: narrow ? "auto" : "hidden" }}>
        {visible.length === 0 && <div style={{ fontSize: 12.5, color: t.tx3, padding: 12 }}>No studies yet.</div>}
        {visible.map(s => {
          const st = running?.id === s.id ? "running" : studyStatus(s, sessions, calibration);
          const [chip, col] = STATUS_CHIP[st];
          const bl = blindingProgress(s);
          const active = s.id === selectedId && mode === "study";
          return (
            <div key={s.id} role="button" tabIndex={0} aria-current={active ? "true" : undefined}
              onClick={() => { setSelectedId(s.id); setMode("study"); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(s.id); setMode("study"); } }}
              style={{ padding: "8px 10px", marginBottom: 4, borderRadius: 8, cursor: "pointer", minWidth: narrow ? 200 : undefined, opacity: s.archived ? 0.6 : 1,
                border: `1px solid ${active ? t.acc : "transparent"}`, background: active ? t.acc + "18" : "transparent" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: t.tx3 }}>{STUDY_TYPES.find(x => x.id === s.type)?.name || s.type}</span>
                <Chip t={t} label={bl.blocked ? `Blinded ${bl.done}/${bl.total}` : chip} color={bl.blocked ? "acc" : col} />
                {s.archived && <Chip t={t} label="Archived" color="tx3" />}
              </div>
            </div>
          );
        })}
      </div>
      {archivedCount > 0 && (
        <button onClick={() => setShowArchived(v => !v)} style={{ margin: 8, fontSize: 11.5, background: "none", border: "none", color: t.tx3, cursor: "pointer", textAlign: "left" }}>
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </button>
      )}
    </aside>
  );

  // ── Main area ──
  let main;
  if (mode === "power") {
    main = <div style={{ maxWidth: 520 }}><SampleSizeCalculator t={t} /></div>;
  } else if (mode === "new" || !study) {
    main = (
      <div style={{ maxWidth: 900 }}>
        <h2 style={{ fontSize: 18, color: t.tx, margin: "0 0 12px" }}>New study</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
          {STUDY_TYPES.map(st => (
            <div key={st.id} role="radio" aria-checked={newType === st.id} tabIndex={0}
              onClick={() => setNewType(st.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNewType(st.id); } }}
              style={{ padding: 12, borderRadius: 8, cursor: "pointer", border: `1px solid ${newType === st.id ? st.color : t.bdr}`, background: newType === st.id ? st.color + "18" : t.surf2 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 24, height: 24, color: st.color }} dangerouslySetInnerHTML={{ __html: st.icon }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.tx, flex: 1 }}>{st.name}</span>
                <button onClick={e => { e.stopPropagation(); setGuideType(st.id); }} aria-label={`Guide: ${st.name}`}
                  style={{ fontSize: 11, border: `1px solid ${t.bdr}`, borderRadius: 10, background: "none", color: t.tx3, cursor: "pointer", padding: "1px 7px" }}>Guide</button>
              </div>
              <div style={{ fontSize: 12, color: t.tx2, marginTop: 6, lineHeight: 1.4 }}>{st.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><Button t={t} primary onClick={create}>Create study</Button></div>
      </div>
    );
  } else {
    const fix = target => setStep(target === "run" ? "run" : target === "data" ? "data" : "setup");
    main = (
      <div>
        {/* Header: name, type, status, actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          {renaming === study.id ? (
            <input autoFocus defaultValue={study.name} aria-label="Study name"
              onBlur={e => { const v = e.target.value.trim(); if (v) updateStudy(study.id, s => ({ ...s, name: v })); setRenaming(null); }}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(null); }}
              style={{ fontSize: 18, fontWeight: 700, padding: "2px 6px", borderRadius: 6, border: `1px solid ${t.acc}`, background: t.surf2, color: t.tx, minWidth: 260 }} />
          ) : (
            <h2 onDoubleClick={() => setRenaming(study.id)} title="Double-click to rename" style={{ fontSize: 18, color: t.tx, margin: 0 }}>{study.name}</h2>
          )}
          <Chip t={t} label={typeMeta?.name || study.type} color="tx2" />
          <Chip t={t} label={blinding.blocked ? `Blinded ${blinding.done}/${blinding.total}` : STATUS_CHIP[status][0]} color={blinding.blocked ? "acc" : STATUS_CHIP[status][1]} />
          <span style={{ flex: 1 }} />
          <Button t={t} small onClick={() => setRenaming(study.id)}>Rename</Button>
          <Button t={t} small onClick={() => setShowNotes(v => !v)}>{showNotes ? "Hide notes" : "Notes"}</Button>
          <Button t={t} small onClick={() => duplicate(study)}>Duplicate</Button>
          <Button t={t} small onClick={() => toggleArchive(study)}>{study.archived ? "Unarchive" : "Archive"}</Button>
          <Button t={t} small danger onClick={() => remove(study)}>Delete</Button>
          <Button t={t} small onClick={() => setGuideType(study.type)}>Guide</Button>
        </div>
        {showNotes && (
          <textarea defaultValue={study.config.notes || ""} aria-label="Study notes" placeholder="Protocol notes, hypotheses, inclusion criteria… (included in the report)"
            onBlur={e => updateStudy(study.id, s => ({ ...s, config: { ...s.config, notes: e.target.value } }))}
            style={{ width: "100%", minHeight: 70, boxSizing: "border-box", padding: 8, borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12.5, fontFamily: "inherit", marginBottom: 10 }} />
        )}
        {status === "stale" && step !== "run" && (
          <div role="status" style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 8, background: t.warn + "18", border: `1px solid ${t.warn}55`, fontSize: 12.5, color: t.tx, marginBottom: 10 }}>
            <span style={{ flex: 1 }}>The data or settings changed after the last run — the results below may be out of date.</span>
            <Button t={t} small primary onClick={() => { setStep("run"); run(); }} disabled={!!running || blinding.blocked}>Re-run now</Button>
          </div>
        )}

        <Stepper t={t} step={step} setStep={setStep} status={status} blocked={blinding.blocked} />

        {step === "setup" && Config && (
          <div>
            <SessionScope t={t} study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} />
            <AssignmentTools t={t} study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} notify={notify} />
            <section style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.bdr}`, maxWidth: 760 }}>
              <Config study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} onUpdateProject={onConfigProjectUpdate} t={t} project={project} />
            </section>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button t={t} primary onClick={() => setStep("data")}>Next: check data →</Button>
              <span style={{ flex: 1 }} />
              <Button t={t} small onClick={() => notify(saveStudyDefaults(study.type, study.config) ? "Saved as your default settings for new studies of this type." : "Could not save defaults (browser storage is blocked).")} title="α, corrections, test policy, ICC model…">Save settings as my defaults</Button>
              {sameTypeStudies.length > 0 && (
                <select value="" onChange={e => { const src = studies.find(s => s.id === e.target.value); if (src) { onUpdateStudy(copySettings(study, src)); notify(`Settings copied from “${src.name}”.`); } }}
                  aria-label="Copy settings from another study" style={{ padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12 }}>
                  <option value="">Copy settings from…</option>
                  {sameTypeStudies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {step === "data" && (
          <div style={{ maxWidth: 1100 }}>
            <p style={{ fontSize: 12.5, color: t.tx2, margin: "0 0 8px", lineHeight: 1.5 }}>
              These are exactly the values the analysis will use: one row per session, one column per measurement. Red dashes are missing values. Check units and any implausible numbers before running.
            </p>
            <DataPreview study={study} sessions={sessions} calibration={calibration} t={t} defaultOpen />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button t={t} onClick={() => setStep("setup")}>← Back to setup</Button>
              <Button t={t} primary onClick={() => setStep("run")}>Next: run →</Button>
            </div>
          </div>
        )}

        {step === "run" && (
          <RunPanel t={t} study={study} status={status} running={running?.id === study.id ? running : null} now={now} onRun={run} onCancel={cancel} blinding={blinding} />
        )}

        {step === "results" && (
          <StudyResultsView t={t} study={study} status={status} onFix={fix} wide={wide} />
        )}
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Research workspace"
      style={{ position: "fixed", inset: 0, zIndex: 60, background: t.bg, color: t.tx, display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${t.bdr}`, background: t.surf, flexShrink: 0 }}>
        <Button t={t} onClick={onClose} title="Back to the canvas (Esc)">← Canvas</Button>
        <h1 style={{ fontSize: 16, margin: 0, color: t.tx }}>Research</h1>
        <span style={{ fontSize: 12, color: t.tx3 }}>{studies.length} stud{studies.length === 1 ? "y" : "ies"} · {sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: narrow ? "column" : "row", minHeight: 0 }}>
        {list}
        <main style={{ flex: 1, overflow: "auto", padding: narrow ? 12 : 20, minWidth: 0 }}>{main}</main>
      </div>
      {toast && (
        <div role="status" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 61, display: "flex", gap: 12, alignItems: "center",
          padding: "10px 16px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, boxShadow: `0 6px 24px ${t.shadow || "rgba(0,0,0,0.3)"}`, fontSize: 13, color: t.tx, maxWidth: "90vw" }}>
          <span>{toast.text}</span>
          {toast.undo && <Button t={t} small primary onClick={toast.undo}>Undo</Button>}
          <button onClick={() => setToast(null)} aria-label="Dismiss" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}
      {guideType && <StudyGuideModal t={t} studyType={guideType} onClose={() => setGuideType(null)} />}
    </div>
  );
}
