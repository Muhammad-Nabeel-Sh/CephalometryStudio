// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH WORKSPACE — full-screen studies module (A1, A2, A3, A5, A6, A7, A14, A16)
//
// Left: study list (name, type, progress bars). Right: the open study, with one
// run button in its header and tabs for Setup, Data, Results and Protocol notes.
// Results are a manuscript page (StudyResultsView). The per-type setup screens
// are the existing *Config components.
// All project writes are functional updates so concurrent edits (e.g. a run
// finishing while the user edits notes) are never lost.
// ═══════════════════════════════════════════════════════════════════════════════

import { withAirwayMeasures } from "../airway/compute.js";
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
import { Icon } from "../ui/icons.jsx";
import { fmtNum } from "../lib/utils.js";
import { Btn, Chip, GuideBtn, TabBar } from "../ui/ui.jsx";
import { Menu, Pipeline } from "./workspaceUi.jsx";
import { studyExportItems } from "./studyExports.js";
import { setupReadiness } from "./setupReadiness.js";

const uid = () => Math.random().toString(36).slice(2, 10);
// Run timing, read only from event handlers.
const clock = () => performance.now();

const CONFIGS = {
  reliability: ReliabilityConfig, descriptive: DescriptiveConfig, comparative: ComparativeConfig,
  longitudinal: LongitudinalConfig, correlation: CorrelationConfig, diagnostic: DiagnosticConfig,
  superimposition: SuperimpositionConfig, airway: AirwayStudyConfig,
};

const STATUS_CHIP = {
  "never-run": ["Not run", "tx3"], running: ["Running…", "acc"], error: ["Error", "err"],
  stale: ["Out of date", "warn"], current: ["Up to date", "ok"], legacy: ["Re-run advised", "warn"],
};

const sessionName = s => s?.name || s?.label || s?.id?.slice(0, 8) || "Session";

// The shared button, always compact here; primary = the filled accent style.
function Button({ t, children, onClick, primary, danger, disabled, title }) {
  return <Btn t={t} small active={primary} danger={danger} disabled={disabled} title={title} onClick={onClick}>{children}</Btn>;
}

// A titled block of the setup form.
function Section({ t, title, hint, children }) {
  return (
    <section style={{ padding: "18px 20px", borderRadius: 10, border: `1px solid ${t.bdr}`, background: t.surf, marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: t.tx }}>{title}</h3>
      {hint && <p style={{ fontSize: 13, color: t.tx2, margin: "4px 0 0", lineHeight: 1.5 }}>{hint}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

const READY_MARK = { ok: ["✓", "ok"], block: ["", "tx3"], warn: ["!", "warn"] };

// What the study still needs before it runs (setupReadiness.js).
function Readiness({ t, study, sessions }) {
  const r = useMemo(() => setupReadiness(study, sessions), [study, sessions]);
  return (
    <section role="region" aria-label="Before you run" style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${r.ready ? t.ok + "66" : t.bdr}`, background: t.surf }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: t.tx }}>Before you run</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {r.items.map(i => {
          const [mark, col] = READY_MARK[i.level];
          return (
            <li key={i.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, color: i.level === "ok" ? t.tx2 : t.tx }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${t[col]}`, background: i.level === "ok" ? t[col] : "transparent", color: i.level === "ok" ? t.bg : t[col] }}>{mark}</span>
              <span><span className="sr-only">{i.level === "ok" ? "Done: " : i.level === "warn" ? "Check: " : "To do: "}</span>{i.text}</span>
            </li>
          );
        })}
      </ul>
      <p style={{ fontSize: 12.5, color: t.tx3, margin: "14px 0 0", lineHeight: 1.5 }}>
        {r.ready ? "Ready. Check the data next, then run." : "Finish the open items, or run anyway to see what the analysis reports."}
      </p>
    </section>
  );
}

// ─── Setup helpers (A6 + session scope) ────────────────────────────────────

function SessionScope({ t, study, sessions, onUpdateStudy }) {
  if (!ALL_SESSION_TYPES.has(study.type)) return null;
  const scope = study.config.sessionScope === "selected" ? "selected" : "all";
  const ids = new Set(study.config.sessionIds || []);
  const set = patch => onUpdateStudy({ ...study, config: { ...study.config, ...patch } });
  return (
    <Section t={t} title="Sessions" hint="Which sessions this study analyses.">
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
    </Section>
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
    <Section t={t} title="Assignment" hint="Which traced sessions this study uses, and any that are used twice or missing.">
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
          <span style={{ fontSize: 12, color: t.tx3 }}>One subject per patient ID; each patient’s sessions become T1, T2, … by age (then date).</span>
        </div>
      )}
    </Section>
  );
}

// ─── Run state (results tab before there are results, while running, or while blinded) ───

function RunPanel({ t, study, status, running, now, onRun, onCancel, blinding }) {
  const p = running?.p || 0;
  const elapsed = running ? Math.max(0, (now - running.startedAt) / 1000) : 0;
  const eta = running && p > 0.1 ? Math.max(0, (elapsed * (1 - p)) / p) : null;
  return (
    <section style={{ padding: "28px 24px", borderRadius: 8, border: `1px dashed ${t.bdr}`, maxWidth: 640, margin: "8px 0" }}>
      {blinding.blocked ? (
        <div style={{ fontSize: 13.5, color: t.tx2, lineHeight: 1.6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}><Icon name="lock" size={15} /> Blinded data collection in progress</div>
          {blinding.done} of {blinding.total} tracings done. Results stay locked until every workflow step is complete, so no rater sees agreement figures while still measuring.
          {study?.config?.blindingLog?.length > 0 && (
            <div style={{ marginTop: 8, color: t.warn }}>
              The seal was broken for {study.config.blindingLog.length} session(s). This will be reported with the results.
            </div>
          )}
        </div>
      ) : running ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13.5, color: t.tx }} role="status">Running{running.label ? `: ${running.label}` : ""}. {Math.round(p * 100)}%, {fmtNum(elapsed, 1)} s{eta != null ? `, about ${Math.ceil(eta)} s left` : ""}</div>
          <div style={{ height: 6, borderRadius: 3, background: t.surf3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(p * 100)}%`, background: t.acc, transition: "width 0.15s" }} />
          </div>
          <div><Button t={t} danger onClick={onCancel}>Cancel</Button></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.tx }}>{status === "error" ? "The last run failed" : "No results yet"}</div>
          <div style={{ fontSize: 13.5, color: t.tx2, lineHeight: 1.6 }}>
            {status === "error" ? "Check the setup and the data, then run again." : "Check the data tab first, then run the analysis. Results appear here as a manuscript page."}
          </div>
          <Button t={t} primary onClick={onRun}>Run analysis</Button>
        </div>
      )}
    </section>
  );
}

// ─── New study: chosen by the question being asked ─────────────────────────

const QUESTIONS = [
  { q: "Are my tracings repeatable?", types: ["reliability"] },
  { q: "How do groups differ?", types: ["comparative"] },
  { q: "What changed over time?", types: ["longitudinal", "superimposition"] },
  { q: "What's typical, and what goes together?", types: ["descriptive", "correlation"] },
  { q: "Does a measure predict a diagnosis?", types: ["diagnostic"] },
];

function questionGroups() {
  const live = STUDY_TYPES.filter(st => !st.legacy);
  const placed = new Set(QUESTIONS.flatMap(g => g.types));
  const groups = QUESTIONS.map(g => ({ q: g.q, types: g.types.map(id => live.find(st => st.id === id)).filter(Boolean) })).filter(g => g.types.length);
  const rest = live.filter(st => !placed.has(st.id));
  return rest.length ? [...groups, { q: "Other analyses", types: rest }] : groups;
}

function NewStudy({ t, newType, setNewType, onCreate, onGuide }) {
  return (
    <div style={{ maxWidth: 920 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: t.tx, margin: "0 0 4px" }}>New study</h2>
      <p style={{ fontSize: 13.5, color: t.tx2, margin: "0 0 20px" }}>Start from the question you want to answer.</p>
      <div role="radiogroup" aria-label="Study type" style={{ display: "grid", gap: 18 }}>
        {questionGroups().map(g => (
          <section key={g.q}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: t.tx, margin: "0 0 8px" }}>{g.q}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {g.types.map(st => {
                const on = newType === st.id;
                return (
                  <div key={st.id} role="radio" aria-checked={on} aria-label={`${g.q} ${st.name}`} tabIndex={0}
                    onClick={() => setNewType(st.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNewType(st.id); } }}
                    style={{ padding: "12px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${on ? t.acc : t.bdr}`, background: on ? t.accMuted : t.surf }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span aria-hidden="true" style={{ width: 22, height: 22, color: on ? t.acc : t.tx2, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: st.icon }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.tx, flex: 1 }}>{st.name}</span>
                      <GuideBtn t={t} label={`Guide: ${st.name}`} onClick={e => { e.stopPropagation(); onGuide(st.id); }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: t.tx2, marginTop: 6, lineHeight: 1.5 }}>{st.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div style={{ marginTop: 20 }}><Button t={t} primary onClick={onCreate}>Create study</Button></div>
    </div>
  );
}

// ─── Workspace ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "setup", label: "Setup" },
  { id: "data", label: "Data" },
  { id: "results", label: "Results" },
  { id: "notes", label: "Protocol notes" },
];

const DISCLAIMER_BAR_PX = 24; // the bar measures 23 px; one spare so nothing hides under it

const STATUS_TEXT = {
  "never-run": "Not run yet", running: "Running", error: "The last run failed",
  stale: "Out of date: the data or settings changed after the last run", current: "Up to date",
  legacy: "Run with an older version of the app; re-run advised",
};

// The open study and its tab survive closing the workspace (e.g. to trace a
// reliability step on the canvas), so reopening returns to the same place.
let lastStudyId = null;
let lastSteps = {};

export default function ResearchWorkspace({ t, project, onUpdateProject, calibration, onClose }) {
  const studies = useMemo(() => project?.researchStudies || [], [project]);
  // Airway values join each session here, in memory, so every study can select them.
  const sessions = useMemo(() => (project?.sessions || []).map(s => withAirwayMeasures(s)), [project]);
  const narrow = useMediaQuery("(max-width: 900px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  // Above 1024 px the app shows its disclaimer bar along the bottom; stop above it.
  const barBelow = useMediaQuery("(min-width: 1025px)");
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
  const [now, setNow] = useState(0);
  const abortRef = useRef(null);
  const toastTimer = useRef(null);

  // Keep the elapsed/ETA readout moving while a run is in progress.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(clock()), 500);
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
  const savedStep = study ? steps[study.id] : null;
  const step = study ? (savedStep === "run" ? "results" : savedStep || (study.results ? "results" : "setup")) : "setup";
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
    notify(s.archived ? `Restored “${s.name}”.` : `Archived “${s.name}”. Show archived studies to find it again.`);
  };

  const run = () => {
    if (!study || running || blinding.blocked) return;
    const snapshot = study;
    const fp = fingerprintStudy(snapshot, sessions, calibration);
    const startedAt = clock();
    updateStudy(snapshot.id, s => ({ ...s, status: "running" }));
    setRunning({ id: snapshot.id, p: 0, label: "starting", startedAt });
    const controller = new AbortController();
    abortRef.current = controller;
    runStudyAsync(snapshot, sessions, calibration, {
      onProgress: (p, label) => setRunning(r => (r ? { ...r, p, label: label || "" } : r)),
      signal: controller.signal,
    }).then(done => {
      // Keep anything edited while the run was in progress (name, notes, config).
      updateStudy(snapshot.id, s => ({ ...s, status: done.status, results: done.results, updatedAt: Date.now(), dataFingerprint: fp, lastRun: { at: Date.now(), ms: clock() - startedAt } }));
    }).catch(err => {
      const isAbort = err?.name === "AbortError";
      updateStudy(snapshot.id, s => (isAbort ? { ...s, status: s.results ? "completed" : "configured" } : { ...s, status: "error", results: { error: err?.message || String(err), timestamp: Date.now() } }));
      if (isAbort) notify("Run cancelled.");
    }).finally(() => {
      setRunning(null);
      abortRef.current = null;
    });
  };
  const runAndShow = () => { setStep("results"); run(); };
  const cancel = () => { try { abortRef.current?.abort(); } catch { /* best effort */ } };

  const Config = study ? CONFIGS[study.type] : null;
  const typeMeta = study ? STUDY_TYPES.find(st => st.id === study.type) : null;
  const sameTypeStudies = study ? studies.filter(s => s.id !== study.id && s.type === study.type) : [];

  // ── Study list ──
  const list = (
    <aside aria-label="Studies" style={{ width: narrow ? "auto" : 264, flexShrink: 0, borderRight: narrow ? "none" : `1px solid ${t.bdr}`, borderBottom: narrow ? `1px solid ${t.bdr}` : "none", display: "flex", flexDirection: "column", minHeight: 0, background: t.surf }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 10px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: t.tx, margin: 0, flex: 1 }}>Studies</h2>
        <Button t={t} primary={mode === "new"} onClick={() => setMode("new")}>+ New study</Button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px", display: narrow ? "flex" : "block", gap: 6, overflowX: narrow ? "auto" : "hidden" }}>
        {visible.length === 0 && <div style={{ fontSize: 13, color: t.tx3, padding: "8px 6px" }}>No studies yet. Create one to get started.</div>}
        {visible.map(s => {
          const st = running?.id === s.id ? "running" : studyStatus(s, sessions, calibration);
          const bl = blindingProgress(s);
          const statusLabel = bl.blocked ? `Blinded, ${bl.done} of ${bl.total} done` : STATUS_CHIP[st][0];
          const typeName = STUDY_TYPES.find(x => x.id === s.type)?.name || s.type;
          const active = s.id === selectedId && mode === "study";
          return (
            <div key={s.id} role="button" tabIndex={0} aria-current={active ? "true" : undefined}
              aria-label={`${s.name}, ${typeName}, ${statusLabel}${s.archived ? ", archived" : ""}`}
              title={statusLabel}
              onClick={() => { setSelectedId(s.id); setMode("study"); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(s.id); setMode("study"); } }}
              style={{ padding: "9px 10px", marginBottom: 2, borderRadius: 6, cursor: "pointer", minWidth: narrow ? 200 : undefined, opacity: s.archived ? 0.6 : 1,
                background: active ? t.accMuted : "transparent" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ fontSize: 12, color: t.tx3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeName}{s.archived ? ", archived" : ""}</div>
              <div style={{ marginTop: 6 }}><Pipeline t={t} status={bl.blocked ? "running" : st} ran={!!s.results || st !== "never-run"} /></div>
            </div>
          );
        })}
      </div>
      {archivedCount > 0 && (
      <div style={{ borderTop: `1px solid ${t.bdr}`, padding: "8px 8px 10px" }}>
        {(
          <button onClick={() => setShowArchived(v => !v)} style={{ fontSize: 13, background: "none", border: "none", color: t.tx3, cursor: "pointer", padding: "4px 6px", fontFamily: "inherit" }}>
            {showArchived ? "Hide" : "Show"} archived ({archivedCount})
          </button>
        )}
      </div>
      )}
    </aside>
  );

  // ── Main area ──
  let main;
  if (mode === "power") {
    main = <div style={{ maxWidth: 520 }}><SampleSizeCalculator t={t} /></div>;
  } else if (mode === "new" || !study) {
    main = <NewStudy t={t} newType={newType} setNewType={setNewType} onCreate={create} onGuide={setGuideType} />;
  } else {
    const fix = target => setStep(target === "run" || target === "results" ? "results" : target === "data" ? "data" : "setup");
    const stale = status === "stale" || status === "legacy";
    const runLabel = study.results ? "Re-run" : "Run analysis";
    const lastRun = study.lastRun ? ` Last run ${new Date(study.lastRun.at).toLocaleString()}, ${(study.lastRun.ms / 1000).toFixed(1)} s.` : "";
    const statusLine = blinding.blocked ? `Blinded collection: ${blinding.done} of ${blinding.total} tracings done.` : `${STATUS_TEXT[status] || ""}.${lastRun}`;
    main = (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            {renaming === study.id ? (
              <input autoFocus defaultValue={study.name} aria-label="Study name"
                onBlur={e => { const v = e.target.value.trim(); if (v) updateStudy(study.id, s => ({ ...s, name: v })); setRenaming(null); }}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.stopPropagation(); setRenaming(null); } }}
                style={{ fontSize: 20, fontWeight: 600, padding: "2px 6px", borderRadius: 6, border: `1px solid ${t.acc}`, background: t.surf2, color: t.tx, minWidth: 260, fontFamily: "inherit" }} />
            ) : (
              <h2 onDoubleClick={() => setRenaming(study.id)} title="Double-click to rename" style={{ fontSize: 20, fontWeight: 600, color: t.tx, margin: 0 }}>{study.name}</h2>
            )}
            <div style={{ fontSize: 13, color: stale ? t.warn : status === "error" ? t.err : t.tx2, marginTop: 4 }}>
              <span style={{ color: t.tx2 }}>{typeMeta?.name || study.type}. </span>{statusLine}
            </div>
          </div>
          {running?.id === study.id ? (
            <Button t={t} danger onClick={cancel}>Cancel</Button>
          ) : blinding.blocked ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: t.tx2, padding: "6px 4px" }}><Icon name="lock" size={14} /> Results locked while blinded</span>
          ) : (
            <Btn t={t} small active onClick={runAndShow} style={stale ? { background: t.warn, borderColor: t.warn, color: t.bg } : undefined}>{runLabel}</Btn>
          )}
          {study.results && !study.results.error && (
            <Menu t={t} label="Export" items={() => studyExportItems({ study, status, sessions, calibration, say: notify })} />
          )}
          <Menu t={t} title="More actions" items={[
            { label: "Rename", onClick: () => setRenaming(study.id) },
            { label: "Duplicate", onClick: () => duplicate(study) },
            { label: study.archived ? "Unarchive" : "Archive", onClick: () => toggleArchive(study) },
            { label: "Delete", danger: true, onClick: () => remove(study) },
            { label: "Guide", onClick: () => setGuideType(study.type) },
          ]}>⋯</Menu>
        </div>
        {running?.id === study.id && (
          <div aria-hidden="true" style={{ height: 3, borderRadius: 2, background: t.surf3, overflow: "hidden", marginTop: 10 }}>
            <div style={{ height: "100%", width: `${Math.round((running.p || 0) * 100)}%`, background: t.acc, transition: "width 0.15s" }} />
          </div>
        )}

        <TabBar t={t} tabs={TABS} active={step} onChange={setStep} style={{ margin: "14px 0 18px" }} />

        {step === "setup" && Config && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 780px) 300px" : "minmax(0, 1fr)", gap: wide ? 24 : 16, alignItems: "start" }}>
              <div style={{ minWidth: 0, order: wide ? 0 : 1 }}>
                <SessionScope t={t} study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} />
                <AssignmentTools t={t} study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} notify={notify} />
                <Section t={t} title="Analysis" hint={`Design, measurements and settings for this ${(typeMeta?.name || study.type).toLowerCase()} study.`}>
                  <div className="rs-setup">
                    <Config study={study} sessions={sessions} onUpdateStudy={onUpdateStudy} onUpdateProject={onConfigProjectUpdate} t={t} project={project} />
                  </div>
                </Section>
              </div>
              <div style={{ position: wide ? "sticky" : "static", top: 0, order: wide ? 1 : 0 }}>
                <Readiness t={t} study={study} sessions={sessions} />
              </div>
            </div>
            <div style={{ position: "sticky", bottom: 0, zIndex: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 0", marginTop: 4, background: t.bg, borderTop: `1px solid ${t.bdr}` }}>
              <Button t={t} primary onClick={() => setStep("data")}>Next: check the data</Button>
              <span style={{ flex: 1 }} />
              <Button t={t} onClick={() => notify(saveStudyDefaults(study.type, study.config) ? "Saved as your default settings for new studies of this type." : "Couldn't save defaults: browser storage is blocked.")} title="α, corrections, test policy, ICC model…">Save settings as my defaults</Button>
              {sameTypeStudies.length > 0 && (
                <select value="" onChange={e => { const src = studies.find(s => s.id === e.target.value); if (src) { onUpdateStudy(copySettings(study, src)); notify(`Settings copied from “${src.name}”.`); } }}
                  aria-label="Copy settings from another study" style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13 }}>
                  <option value="">Copy settings from…</option>
                  {sameTypeStudies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {step === "data" && (
          <div style={{ maxWidth: 1100 }}>
            <p style={{ fontSize: 13, color: t.tx2, margin: "0 0 10px", lineHeight: 1.55 }}>
              These are exactly the values the analysis will use: one row per session, one column per measurement. Red dashes are missing values. Check units and any implausible numbers before running.
            </p>
            <DataPreview study={study} sessions={sessions} calibration={calibration} t={t} defaultOpen />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button t={t} onClick={() => setStep("setup")}>Back to setup</Button>
              {!blinding.blocked && !running && <Button t={t} primary onClick={runAndShow}>{runLabel}</Button>}
            </div>
          </div>
        )}

        {step === "results" && (running?.id === study.id || blinding.blocked || !study.results
          ? <RunPanel t={t} study={study} status={status} running={running?.id === study.id ? running : null} now={now} onRun={runAndShow} onCancel={cancel} blinding={blinding} />
          : <StudyResultsView t={t} study={study} status={status} onFix={fix} wide={wide} />)}

        {step === "notes" && (
          <div style={{ maxWidth: 760 }}>
            <p style={{ fontSize: 13, color: t.tx2, margin: "0 0 10px" }}>Protocol notes, hypotheses and inclusion criteria. They're included in the study report.</p>
            <textarea key={study.id} defaultValue={study.config.notes || ""} aria-label="Protocol notes" placeholder="Twenty Class II patients aged 9 to 12, traced by one examiner…"
              onBlur={e => updateStudy(study.id, s => ({ ...s, config: { ...s.config, notes: e.target.value } }))}
              style={{ width: "100%", minHeight: 220, boxSizing: "border-box", padding: 12, borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 14, lineHeight: 1.6, fontFamily: "'Source Serif 4', Georgia, serif" }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Research workspace"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: barBelow ? DISCLAIMER_BAR_PX : 0, zIndex: 60, background: t.bg, color: t.tx, display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${t.bdr}`, background: t.surf, flexShrink: 0 }}>
        <Button t={t} onClick={onClose} title="Back to the canvas (Esc)">← Canvas</Button>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: t.tx }}>Research</h1>
        <span style={{ fontSize: 13, color: t.tx3, flex: 1 }}>{studies.length} stud{studies.length === 1 ? "y" : "ies"}, {sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
        <Chip t={t} on={mode === "power"} onClick={() => setMode(m => (m === "power" ? (study ? "study" : "new") : "power"))}>Sample size calculator</Chip>
      </header>
      <div style={{ flex: 1, display: "flex", flexDirection: narrow ? "column" : "row", minHeight: 0 }}>
        {list}
        <main style={{ flex: 1, overflow: "auto", padding: narrow ? "14px 12px" : "22px 28px", minWidth: 0 }}>{main}</main>
      </div>
      {toast && (
        <div role="status" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 61, display: "flex", gap: 12, alignItems: "center",
          padding: "10px 16px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, boxShadow: `0 6px 24px ${t.shadow || "rgba(0,0,0,0.3)"}`, fontSize: 13, color: t.tx, maxWidth: "90vw" }}>
          <span>{toast.text}</span>
          {toast.undo && <Button t={t} primary onClick={toast.undo}>Undo</Button>}
          <button onClick={() => setToast(null)} aria-label="Dismiss" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}
      {guideType && <StudyGuideModal t={t} studyType={guideType} onClose={() => setGuideType(null)} />}
    </div>
  );
}
