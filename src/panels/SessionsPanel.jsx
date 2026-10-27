import { useState } from "react";
import { mkSession } from "../model/session.js";
import { mkSubject, addSession, removeSession, duplicateSessionInProject, addSubject, removeSubject, updateSubject } from "../model/project.js";
import { Btn, Tag, InfoBox, GuideBtn } from "../ui/ui.jsx";
import BatchImportModal from "./BatchImportModal.jsx";
import SessionMetadataModal from "./SessionMetadataModal.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { sealedSessions } from "../research/blinding.js";
import { askConfirm } from "../ui/dialogs.js";
import { Icon } from "../ui/icons.jsx";


export default function SessionsPanel({
  project, t, onUpdateProject,
  compareSession, setCompareSession,
  showDisplacement, setShowDisplacement,
  displacementOverlay, setDisplacementOverlay,
  refLandmark1, setRefLandmark1,
  refLandmark2, setRefLandmark2,
  overlayBlend, setOverlayBlend,
  overlayAlignMode, setOverlayAlignMode,
  overlayVectorScale, setOverlayVectorScale,
  showTrackingLines, setShowTrackingLines,
  showAirwayOverlay, setShowAirwayOverlay,
}) {
  const [newName, setNewName] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [tab, setTab] = useState("sessions");
  const [newSubjectLabel, setNewSubjectLabel] = useState("");

  const [showCompare, setShowCompare] = useState(true);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [guideKey, setGuideKey] = useState(null);

  const sessionList = project?.sessions || [];
  const subjects = project?.subjects || [];
  const activeId = project?.activeSessionId;
  const activeSession = sessionList.find(s => s.id === activeId);
  // Blinded reliability studies: sealed tracings are not offered for comparison.
  const sealed = sealedSessions(project);
  const otherSessions = sessionList.filter(s => s.id !== activeId && !sealed.has(s.id));
  const pointLabels = (activeSession?.markups || []).filter(m => m.type === "point" && m.label).map(m => m.label);
  const uniquePointLabels = [...new Set(pointLabels)];
  const groups = project?.groups || [];
  const timepoints = project?.timepoints || [];

  const handleAdd = () => {
    const session = mkSession({ name: newName || `Session ${sessionList.length + 1}` });
    onUpdateProject(addSession(project, session));
    setNewName("");
  };

  const handleDuplicate = (id) => {
    onUpdateProject(duplicateSessionInProject(project, id));
  };

  const handleRemove = async (id) => {
    if (sessionList.length <= 1) return;
    const name = sessionList.find(s => s.id === id)?.name;
    if (!(await askConfirm({ title: `Remove session${name ? ` “${name}”` : ""}?`, message: "Its image, tracing and measurements are removed from this case.", confirmLabel: "Remove session", danger: true }))) return;
    onUpdateProject(removeSession(project, id));
  };

  const handleSetActive = (id) => {
    onUpdateProject({ ...project, activeSessionId: id });
  };

  const patchSession = (id, patch) => {
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s => s.id === id ? { ...s, ...patch, meta: { ...s.meta, ...(patch.meta || {}) } } : s),
    });
  };

  const handleAddSubject = () => {
    if (!newSubjectLabel.trim()) return;
    onUpdateProject(addSubject(project, mkSubject({ label: newSubjectLabel.trim() })));
    setNewSubjectLabel("");
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: `1px solid ${t.bdr}44`, alignItems: "center" }}>
        {["sessions", "subjects", "comparisons"].map(tabId => (
          <button key={tabId} onClick={() => setTab(tabId)}
            style={{
              padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: tab === tabId ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: tab === tabId ? t.acc : t.tx3, textTransform: "uppercase",
            }}>
            {tabId === "sessions" ? `Sessions (${sessionList.length})` : tabId === "subjects" ? `Subjects (${subjects.length})` : `Comparisons`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <GuideBtn t={t} onClick={() => setGuideKey(tab)} />
      </div>

      {tab === "sessions" && (
        <>
          <InfoBox t={t}>
            Each <b>session</b> is one patient visit / imaging event. Assign <b>metadata</b>
            (group, timepoint, patient, operator) to organise sessions for research analysis.
          </InfoBox>

          {/* ─── Add / Import / Metadata ─── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New session name..."
              style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} />
            <Btn t={t} small onClick={handleAdd}>+ Add</Btn>
            <Btn t={t} small ghost onClick={() => setShowBatchImport(true)} title="Batch import images with CSV metadata"><Icon name="box" size={15} /></Btn>
            <button onClick={() => setShowMetaModal(true)} title="Edit session metadata"
              style={{
                width: 30, height: 30, borderRadius: 6, border: `1px solid ${t.acc}44`,
                background: t.acc + "12", color: t.acc, cursor: "pointer", fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill={t.acc}>
                <path d="M120-240v-80h480v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
              </svg>
            </button>
          </div>
          {showBatchImport && (
            <BatchImportModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={() => setShowBatchImport(false)} />
          )}
          {showMetaModal && (
            <SessionMetadataModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={() => setShowMetaModal(false)} />
          )}

          {/* ─── Session cards ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {sessionList.map((s, i) => (
              <div key={s.id} onClick={() => handleSetActive(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6,
                  background: s.id === activeId ? t.acc + "18" : t.surf2,
                  border: s.id === activeId ? `1px solid ${t.acc}` : `1px solid ${t.bdr}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <SessionNameEditor name={s.name || `Session ${i + 1}`} onRename={n => patchSession(s.id, { name: n })} t={t} />
                    {s.meta?.group && <Tag color={t.acc} style={{ fontSize: 12 }}>{s.meta.group}</Tag>}
                    {s.meta?.timepoint && <Tag color={t.warn} style={{ fontSize: 12 }}>{s.meta.timepoint}</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: t.tx3, marginTop: 2 }}>
                    {(s.images && s.images.length > 0) ? (s.images[0].name || "Image loaded") : "No image"}{(s.images && s.images.length > 1) ? ` +${s.images.length - 1} layers` : ""}
                    {s.calibration?.done ? ` · ${s.calibration.pxPerMm.toFixed(1)}px/mm` : ""}
                    {s.markups?.length ? ` · ${s.markups.length} marks` : ""}
                  </div>
                </div>
                {s.id === activeId && <Tag color={t.ok} style={{ fontSize: 12 }}>Active</Tag>}
                <button onClick={e => { e.stopPropagation(); handleDuplicate(s.id); }} title="Duplicate session"
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.tx2, padding: 2, fontSize: 14 }}>⧉</button>
                <button onClick={e => { e.stopPropagation(); handleRemove(s.id); }} disabled={sessionList.length <= 1} title="Remove session"
                  style={{ background: "none", border: "none", cursor: sessionList.length <= 1 ? "not-allowed" : "pointer", color: sessionList.length <= 1 ? t.tx3 : t.err, padding: 2, fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>

          {/* ─── Quick status ─── */}
          {groups.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {groups.map(g => {
                const count = sessionList.filter(s => s.meta?.group === g).length;
                return count > 0 ? <Tag key={g} color={t.acc} style={{ fontSize: 12 }}>{g}: {count}</Tag> : null;
              })}
            </div>
          )}
          {timepoints.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
              {timepoints.map(tp => {
                const count = sessionList.filter(s => s.meta?.timepoint === tp).length;
                return count > 0 ? <Tag key={tp} color={t.warn} style={{ fontSize: 12 }}>{tp}: {count}</Tag> : null;
              })}
            </div>
          )}

        </>
      )}

      {tab === "comparisons" && (
        <div>
          <InfoBox t={t}>
            Compare two sessions: pick a <b>comparison session</b>, align it with <b>2-Point</b>
            or <b>Procrustes</b>, and visualise movement with displacement vectors, tracking
            lines, and the airway overlay.
          </InfoBox>
          <div onClick={() => setShowCompare(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: showCompare ? 10 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>Comparison</span>
            <span style={{ fontSize: 12, color: t.tx3 }}>{compareSession ? `active` : `off`}</span>
            <span style={{ marginLeft: "auto", color: t.tx3, fontSize: 12 }}>{showCompare ? "▾" : "▸"}</span>
          </div>
          {showCompare && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3 }}>Compare to</div>
                <select value={compareSession?.id || ""} onChange={e => { const sel = e.target.value; setCompareSession(sel ? sessionList.find(s => s.id === sel) : null); }}
                  style={{ width: "100%", fontSize: 12, padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, fontFamily: "inherit" }}>
                  <option value="">None</option>
                  {otherSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 6)}{s.meta?.timepoint ? ` (${s.meta.timepoint})` : ""}{s.meta?.group ? ` [${s.meta.group}]` : ""}</option>
                  ))}
                </select>
              </div>
              {compareSession && (
                <>
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    <Btn t={t} small active={showDisplacement} onClick={() => setShowDisplacement(v => !v)}>⇝ Vec</Btn>
                    <Btn t={t} small active={displacementOverlay} onClick={() => setDisplacementOverlay(v => !v)}>Overlay</Btn>
                  </div>
                  {displacementOverlay && (
                    <div style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
                      <div style={{ fontSize: 12, color: t.tx2, marginBottom: 6 }}>Alignment</div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                        {[{id:"2pt",label:"2-Point"},{id:"procrustes",label:"Procrustes"}].map(m => (
                          <Btn key={m.id} t={t} small active={overlayAlignMode === m.id} onClick={() => setOverlayAlignMode(m.id)}>{m.label}</Btn>
                        ))}
                      </div>
                      {overlayAlignMode === "2pt" && (
                        <>
                          <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.5, marginBottom: 6 }}>
                            Select two landmarks as alignment anchors. The compared session is translated, rotated, and scaled to match.
                          </div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Anchor pt 1</div>
                            <select value={refLandmark1 || ""} onChange={e => setRefLandmark1(e.target.value || null)}
                              style={{ width: "100%", fontSize: 12, padding: "3px 5px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit" }}>
                              <option value="">Select...</option>
                              {uniquePointLabels.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Anchor pt 2</div>
                            <select value={refLandmark2 || ""} onChange={e => setRefLandmark2(e.target.value || null)}
                              style={{ width: "100%", fontSize: 12, padding: "3px 5px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit" }}>
                              <option value="">Select...</option>
                              {uniquePointLabels.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      {overlayAlignMode === "procrustes" && (
                        <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.5, marginBottom: 6 }}>
                          Uses all matching landmarks to compute optimal rotation, translation, and scale via generalized Procrustes analysis.
                        </div>
                      )}
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Blend</div>
                        <input type="range" min="0.1" max="1" step="0.05" value={overlayBlend} onChange={e => setOverlayBlend(+e.target.value)}
                          style={{ width: "100%", accentColor: t.acc }} />
                        <div style={{ fontSize: 12, color: t.tx2, textAlign: "right" }}>{Math.round(overlayBlend * 100)}%</div>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Vector Scale</div>
                        <input type="range" min="0.5" max="5" step="0.25" value={overlayVectorScale} onChange={e => setOverlayVectorScale(+e.target.value)}
                          style={{ width: "100%", accentColor: t.acc }} />
                        <div style={{ fontSize: 12, color: t.tx2, textAlign: "right" }}>{overlayVectorScale.toFixed(1)}\u00d7</div>
                      </div>
                      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" id="trackingLines" checked={showTrackingLines} onChange={e => setShowTrackingLines(e.target.checked)}
                          style={{ accentColor: t.acc }} />
                        <label htmlFor="trackingLines" style={{ fontSize: 12, color: t.tx2, cursor: "pointer" }}>Show tracking lines</label>
                      </div>
                      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" id="airwayOverlay" checked={showAirwayOverlay} onChange={e => setShowAirwayOverlay(e.target.checked)}
                          style={{ accentColor: t.acc }} />
                        <label htmlFor="airwayOverlay" style={{ fontSize: 12, color: t.tx2, cursor: "pointer" }}>Show airway overlay</label>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.5 }}>
                    <b style={{ color: t.tx2 }}>⇝ Vec</b> draws displacement lines between matching landmarks.
                    <br /><b style={{ color: t.tx2 }}>Overlay</b> renders the compared session with alignment: <b>2-Point</b> (manual anchors) or <b>Procrustes</b> (all landmarks).
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "subjects" && (
        <div>
          <InfoBox t={t}>
            <b>Subjects</b> are the patients or specimens being studied. Create them here, then
            assign sessions to each subject in the <b>Metadata</b> table. Research modules
            use subjects to auto-populate cases, groups and timepoints.
          </InfoBox>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={newSubjectLabel} onChange={e => setNewSubjectLabel(e.target.value)} placeholder="Subject name..."
              style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
              onKeyDown={e => { if (e.key === "Enter") handleAddSubject(); }} />
            <Btn t={t} small onClick={handleAddSubject}>+ Add</Btn>
          </div>
          {/* Subject presets */}
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 10 }}>
            {[
              { label: "Subject 1-5", range: [1, 5], gen: i => `Subject ${i}` },
              { label: "Subject 6-10", range: [6, 10], gen: i => `Subject ${i}` },
              { label: "Patient 001-005", range: [1, 5], gen: i => `Patient ${String(i).padStart(3, "0")}` },
              { label: "Group A (×3)", range: [1, 3], gen: i => `Group A - Subject ${i}` },
              { label: "Group B (×3)", range: [1, 3], gen: i => `Group B - Subject ${i}` },
            ].map(p => (
              <button key={p.label} onClick={() => {
                const [start, end] = p.range;
                const next = [...Array(end - start + 1)].map((_, i) => i + start);
                let proj = project;
                for (const i of next) {
                  const sub = mkSubject({ label: p.gen(i) });
                  proj = addSubject(proj, sub);
                }
                onUpdateProject(proj);
              }}
                style={{ fontSize: 12, padding: "2px 7px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx2, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
          {subjects.length === 0 && (
            <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", padding: 20 }}>No subjects defined.</div>
          )}
          {subjects.map(sub => {
            const subSessions = sessionList.filter(s => s.subjectId === sub.id);
            return (
              <div key={sub.id} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <input value={sub.label} onChange={e => onUpdateProject(updateSubject(project, sub.id, { label: e.target.value }))}
                    style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 12, fontWeight: 600 }} />
                  <button onClick={async () => { if (await askConfirm({ title: "Remove subject?", message: "The subject is removed and its sessions are unlinked (the sessions themselves are kept).", confirmLabel: "Remove subject", danger: true })) onUpdateProject(removeSubject(project, sub.id)); }}
                    style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 12, padding: 2 }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 4, fontSize: 12, color: t.tx3 }}>
                  <span>{subSessions.length} session(s)</span>
                  {sub.age && <span>· Age: {sub.age}</span>}
                  {sub.sex && <span>· Sex: {sub.sex}</span>}
                </div>
                {subSessions.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {subSessions.map(ss => (
                      <span key={ss.id} style={{ fontSize: 12, padding: "1px 6px", borderRadius: 3, background: t.surf2, color: t.tx2, border: `1px solid ${t.bdr}` }}>
                        {ss.name || ss.id.slice(0, 6)}{ss.meta?.timepoint ? ` (${ss.meta.timepoint})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function SessionNameEditor({ name, onRename, t }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (editing) {
    return (
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { onRename(val || name); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onRename(val || name); setEditing(false); } }}
        style={{ background: t.surf3, border: `1px solid ${t.acc}`, borderRadius: 4, padding: "2px 4px", color: t.tx, fontSize: 13, width: "100%", fontFamily: "inherit", boxSizing: "border-box" }} />
    );
  }
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, cursor: "pointer" }} onClick={() => { setVal(name); setEditing(true); }} title="Click to rename">
      {name}
    </span>
  );
}
