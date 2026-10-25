import { useState, useRef } from "react";
import { STUDY_TYPES, mkStudy } from "./studyModel.js";
import { runStudyAsync } from "./engineClient.js";
import { ReliabilityConfig, ReliabilityResults } from "./ReliabilityPanel.jsx";
import { DescriptiveConfig, DescriptiveResults } from "./DescriptivePanel.jsx";
import { ComparativeConfig, ComparativeResults } from "./ComparativePanel.jsx";
import { LongitudinalConfig, LongitudinalResults } from "./LongitudinalPanel.jsx";
import { CorrelationConfig, CorrelationResults } from "./CorrelationPanel.jsx";
import { DiagnosticConfig, DiagnosticResults } from "./DiagnosticPanel.jsx";
import { SuperimpositionConfig, SuperimpositionResults } from "./SuperimpositionPanel.jsx";
import { AirwayStudyConfig } from "./AirwayStudyPanel.jsx";
import ResultsDialog from "./ResultsDialog.jsx";
import StudyGuideModal from "./StudyGuideModal.jsx";
import { DataPreview, SampleSizeCalculator } from "./StudyTools.jsx";

export default function ResearchPanel({ t, project, onUpdateProject, calibration }) {
  const studies = project?.researchStudies || [];
  const sessions = project?.sessions || [];
  const [tab, setTab] = useState("list");
  const [selectedType, setSelectedType] = useState("reliability");
  const [selectedId, setSelectedId] = useState(null);
  const [dialogStudy, setDialogStudy] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [progress, setProgress] = useState({ p: 0, label: "" });
  const [guideType, setGuideType] = useState(null);
  const abortRef = useRef(null);

  const handleCreate = () => {
    const study = mkStudy(selectedType, {
      name: `${STUDY_TYPES.find(st => st.id === selectedType)?.name || selectedType} ${studies.length + 1}`,
      sessionIds: sessions.map(s => s.id),
    });
    onUpdateProject({
      ...project,
      researchStudies: [...studies, study],
    });
    setSelectedId(study.id);
    setTab("list");
  };

  const handleRun = (studyId) => {
    const study = studies.find(s => s.id === studyId);
    if (!study || runningId) return;
    // Mark running immediately so the UI reflects the state change.
    onUpdateProject({
      ...project,
      researchStudies: studies.map(s => s.id === studyId ? { ...s, status: "running" } : s),
    });
    setRunningId(studyId);
    setProgress({ p: 0, label: "starting" });
    const controller = new AbortController();
    abortRef.current = controller;
    runStudyAsync(study, sessions, calibration, {
      onProgress: (p, label) => setProgress({ p, label: label || "" }),
      signal: controller.signal,
    }).then(updated => {
      onUpdateProject({
        ...project,
        researchStudies: (project?.researchStudies || []).map(s => s.id === studyId ? updated : s),
      });
      setDialogStudy(updated);
    }).catch(err => {
      // AbortError → revert to previous status; other errors → record on the study.
      const isAbort = err?.name === "AbortError";
      onUpdateProject({
        ...project,
        researchStudies: (project?.researchStudies || []).map(s => {
          if (s.id !== studyId) return s;
          if (isAbort) return { ...s, status: s.results ? "completed" : "configured" };
          return { ...s, status: "error", results: { error: err?.message || String(err), timestamp: Date.now() } };
        }),
      });
    }).finally(() => {
      setRunningId(null);
      setProgress({ p: 0, label: "" });
      abortRef.current = null;
    });
  };

  const handleCancelRun = () => {
    try { abortRef.current?.abort(); } catch { /* abort is best-effort */ }
  };

  const handleRemove = (studyId) => {
    if (!window.confirm("Remove this study?")) return;
    onUpdateProject({
      ...project,
      researchStudies: studies.filter(s => s.id !== studyId),
    });
    if (selectedId === studyId) setSelectedId(null);
  };

  const handleUpdateStudy = (updated) => {
    onUpdateProject({
      ...project,
      researchStudies: studies.map(s => s.id === updated.id ? updated : s),
    });
  };

  const handleToggleLabel = (studyId, labelId) => {
    const study = studies.find(s => s.id === studyId);
    if (!study) return;
    const ids = study.config.labelIds || [];
    const next = ids.includes(labelId) ? ids.filter(id => id !== labelId) : [...ids, labelId];
    onUpdateProject({
      ...project,
      researchStudies: studies.map(s => s.id === studyId ? { ...s, config: { ...s.config, labelIds: next } } : s),
    });
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setTab("new")}
          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          + New Study
        </button>
        <button onClick={() => setTab("list")}
          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: tab === "list" ? t.surf2 : "transparent", color: t.tx, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Studies ({studies.length})
        </button>
        <button onClick={() => setTab("power")}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: tab === "power" ? t.surf2 : "transparent", color: t.tx, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Sample size
        </button>
      </div>

      {tab === "power" && <SampleSizeCalculator t={t} />}

      {tab === "new" && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>Choose Study Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STUDY_TYPES.map(st => (
              <div key={st.id} onClick={() => setSelectedType(st.id)}
                style={{
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${selectedType === st.id ? st.color : t.bdr}`,
                  background: selectedType === st.id ? st.color + "18" : t.surf2,
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: st.icon }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{st.name}</span>
                      <button onClick={e => { e.stopPropagation(); setGuideType(st.id); }}
                        style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Guide">?</button>
                    </div>
                    <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>{st.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleCreate} disabled={!selectedType}
            style={{ width: "100%", marginTop: 12, padding: "8px 12px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: selectedType ? 1 : 0.4 }}>
            Create Study
          </button>
        </div>
      )}

      {tab === "list" && studies.length === 0 && (
        <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", padding: 20 }}>
          No research studies yet. Create one to begin analysis.
        </div>
      )}

      {tab === "list" && studies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {studies.map(s => {
            const meta = STUDY_TYPES.find(st => st.id === s.type);
            return (
              <div key={s.id}
                style={{
                  padding: "8px 10px", borderRadius: 6,
                  background: s.id === selectedId ? t.acc + "18" : t.surf2,
                  border: s.id === selectedId ? `1px solid ${t.acc}` : `1px solid ${t.bdr}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <div onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: meta?.icon || "📋" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: (meta?.color || t.acc) + "22", color: meta?.color || t.acc, fontWeight: 600 }}>{meta?.name || s.type}</span>
                      <span style={{ fontSize: 9, color: s.status === "completed" ? t.ok : s.status === "error" ? t.err : s.status === "running" ? t.acc : t.tx3 }}>
                        {s.status}
                      </span>
                      <button onClick={e => { e.stopPropagation(); setGuideType(s.type); }}
                        style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Study Guide">?</button>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleRemove(s.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: t.tx3, padding: 2, fontSize: 12 }}>
                    ✕
                  </button>
                </div>

                {/* Expanded details */}
                {s.id === selectedId && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.bdr}44` }}>
                    {/* Config — always editable */}
                    {s.type === "reliability" && (
                      <ReliabilityConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} onUpdateProject={onUpdateProject} t={t} project={project} />
                    )}

                    {s.type === "descriptive" && (
                      <DescriptiveConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} />
                    )}

                    {s.type === "comparative" && (
                      <ComparativeConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} project={project} />
                    )}

                    {s.type === "longitudinal" && (
                      <LongitudinalConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} project={project} />
                    )}

                    {s.type === "correlation" && (
                      <CorrelationConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} />
                    )}

                    {s.type === "diagnostic" && (
                      <DiagnosticConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} />
                    )}

                    {s.type === "superimposition" && (
                      <SuperimpositionConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} />
                    )}

                    {s.type === "airway" && (
                      <AirwayStudyConfig study={s} sessions={sessions} onUpdateStudy={handleUpdateStudy} t={t} />
                    )}

                    {s.type !== "reliability" && s.type !== "descriptive" && s.type !== "comparative" && s.type !== "longitudinal" && s.type !== "correlation" && s.type !== "diagnostic" && s.type !== "superimposition" && s.type !== "airway" && sessions.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Measurements</div>
                        <LabelSelector sessions={sessions} selected={s.config.labelIds || []} onToggle={l => handleToggleLabel(s.id, l)} t={t} />
                      </div>
                    )}

                    {/* Results — when completed */}
                    {s.status === "completed" && s.results && (
                      <div style={{ marginBottom: s.status === "completed" ? 8 : 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: t.ok, marginBottom: 4 }}>
                          ✓ Analysis complete
                        </div>
                        <button onClick={() => setDialogStudy(s)}
                          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${t.acc}`, background: t.acc + "12", color: t.acc, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          View Results
                        </button>
                      </div>
                    )}

                    {/* Error message */}
                    {s.status === "error" && (
                      <div style={{ fontSize: 11, color: t.err, padding: 8, background: t.err + "12", borderRadius: 4, marginBottom: 8 }}>
                        {s.results?.error || "Unknown error"}
                      </div>
                    )}

                    {s.type !== "airway" && <DataPreview study={s} sessions={sessions} calibration={calibration} t={t} />}

                    {/* Run button + progress/cancel */}
                    {s.id !== runningId && s.status !== "running" && (
                      <button onClick={() => handleRun(s.id)}
                        style={{ width: "100%", marginTop: s.status === "configured" && (s.type === "reliability" || s.type === "descriptive") ? 8 : s.status === "completed" ? 12 : 0, padding: "8px 12px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {s.status === "completed" ? "Re-run Analysis" : "Run Analysis"}
                      </button>
                    )}
                    {s.id === runningId && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 10, color: t.tx2, fontFamily: "'DM Mono',monospace" }}>
                          Running… {progress.label ? `${progress.label} ` : ""}{Math.round(progress.p * 100)}%
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: t.surf3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.round(progress.p * 100)}%`, background: t.acc, transition: "width 0.15s" }} />
                        </div>
                        <button onClick={handleCancelRun}
                          style={{ width: "100%", padding: "6px 12px", borderRadius: 6, border: `1px solid ${t.err}66`, background: t.err + "12", color: t.err, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dialogStudy?.status === "completed" && (
        <ResultsDialog study={dialogStudy} t={t} onClose={() => setDialogStudy(null)} />
      )}
      {guideType && <StudyGuideModal t={t} studyType={guideType} onClose={() => setGuideType(null)} />}
    </div>
  );
}

function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [...new Set((sessions || []).flatMap(s => (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 10, color: t.tx3 }}>No labeled markups found.</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {selected.length === 0 && <span style={{ fontSize: 10, color: t.tx3, padding: "2px 0" }}>All ({labels.length})</span>}
      {selected.length > 0 && <button onClick={() => selected.forEach(l => { if (selected.includes(l)) onToggle(l); })}
        style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer" }}>Clear</button>}
      {labels.map(l => (
        <button key={l} onClick={() => onToggle(l)}
          style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
            border: `1px solid ${selected.includes(l) ? t.acc : t.bdr}`,
            background: selected.includes(l) ? t.acc + "22" : "transparent",
            color: selected.includes(l) ? t.acc : t.tx2,
            fontWeight: selected.includes(l) ? 700 : 400,
            fontFamily: "'DM Mono',monospace",
          }}>
          {l}
        </button>
      ))}
    </div>
  );
}

function StudyResults({ study, t }) {
  const res = study.results;
  if (!res) return null;
  if (res.note) {
    return (
      <div style={{ fontSize: 11, color: t.tx2, padding: 8, background: t.surf3, borderRadius: 4, textAlign: "center" }}>
        {res.note}
      </div>
    );
  }
  return null;
}
