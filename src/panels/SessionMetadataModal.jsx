import { useState, useRef } from "react";
import { Btn, Tag } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { notify } from "../ui/dialogs.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";

export default function SessionMetadataModal({ project, t, onUpdateProject, onClose }) {
  const sessionList = project?.sessions || [];
  const subjects = project?.subjects || [];
  const groups = project?.groups || [];
  const timepoints = project?.timepoints || [];
  const operators = project?.operators || [];

  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [showManageTimepoints, setShowManageTimepoints] = useState(false);
  const [showManageOperators, setShowManageOperators] = useState(false);
  const [newGroupVal, setNewGroupVal] = useState("");
  const [newTpVal, setNewTpVal] = useState("");
  const [newOpVal, setNewOpVal] = useState("");
  const [showParseModal, setShowParseModal] = useState(false);
  const dialogRef = useDialogA11y(onClose);
  const parseDialogRef = useDialogA11y(() => setShowParseModal(false), { active: showParseModal });
  const [parsePattern, setParsePattern] = useState("{patient}_{group}_{timepoint}");
  const [guideKey, setGuideKey] = useState(null);
  const parseRef = useRef(null);
  const lastClickedRef = useRef(null);

  const patchProject = (patch) => onUpdateProject({ ...project, ...patch });

  const patchSession = (id, patch) => {
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s => s.id === id ? { ...s, ...patch, meta: { ...s.meta, ...(patch.meta || {}) } } : s),
    });
  };

  const batchPatchSessions = (ids, patch) => {
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s => ids.includes(s.id) ? { ...s, ...patch, meta: { ...s.meta, ...(patch.meta || {}) } } : s),
    });
    setSelectedSessions(new Set());
  };

  const toggleSelect = (id, shiftKey) => {
    if (shiftKey && lastClickedRef.current !== null) {
      const idx = sessionList.findIndex(s => s.id === id);
      const lastIdx = sessionList.findIndex(s => s.id === lastClickedRef.current);
      if (idx !== -1 && lastIdx !== -1) {
        const [start, end] = idx > lastIdx ? [lastIdx, idx] : [idx, lastIdx];
        setSelectedSessions(prev => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(sessionList[i].id);
          return next;
        });
        return;
      }
    }
    lastClickedRef.current = id;
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSessions.size === sessionList.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessionList.map(s => s.id)));
    }
  };

  /* ─── Filename parser ──────────────────────────────────────────────────── */
  const parseFilenames = () => {
    const varOrder = [];
    const regexParts = [];
    let inVar = false;
    let buf = "";
    for (let i = 0; i < parsePattern.length; i++) {
      const ch = parsePattern[i];
      if (ch === "{") { inVar = true; buf = ""; continue; }
      if (ch === "}") { inVar = false; varOrder.push(buf); regexParts.push("(.+)"); continue; }
      if (inVar) { buf += ch; } else { regexParts.push(ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
    }
    const re = new RegExp("^" + regexParts.join("") + "$");
    const metaFields = ["group", "timepoint", "patient", "patientId", "operatorId", "sex", "age"];
    const fieldMap = { patient: "patientId" };
    const updates = [];
    for (const s of sessionList) {
      const imgName = s.images?.[0]?.name;
      if (!imgName) continue;
      const base = imgName.replace(/\.[^.]+$/, "");
      const m = base.match(re);
      if (!m) continue;
      const patchMeta = {};
      varOrder.forEach((key, idx) => {
        const val = m[idx + 1] || "";
        if (!val) return;
        const f = fieldMap[key] || key;
        if (metaFields.includes(f)) patchMeta[f] = val;
      });
      if (Object.keys(patchMeta).length > 0) updates.push({ id: s.id, meta: patchMeta });
    }
    if (updates.length === 0) { notify("No filenames matched the pattern.", { tone: "warn" }); return; }
    onUpdateProject({
      ...project,
      sessions: sessionList.map(s => {
        const upd = updates.find(u => u.id === s.id);
        return upd ? { ...s, meta: { ...s.meta, ...upd.meta } } : s;
      }),
    });
    setShowParseModal(false);
  };

  const detectPattern = () => {
    const names = sessionList.map(s => s.images?.[0]?.name?.replace(/\.[^.]+$/, "")).filter(Boolean);
    if (names.length < 2) return;
    for (const delim of ["_", "-", ".", " "]) {
      const partsList = names.map(n => n.split(delim));
      const len = partsList[0].length;
      if (len < 2 || len > 4) continue;
      if (partsList.every(p => p.length === len)) {
        const labels = ["patient", "group", "timepoint", "session"];
        setParsePattern(partsList[0].map((_, i) => `{${labels[i] || "field" + (i + 1)}}`).join(delim === " " ? "_" : delim));
        return;
      }
    }
  };

  /* ─── Managed value helpers ────────────────────────────────────────────── */
  const addManagedValue = (field, val, setter) => {
    if (!val.trim()) return;
    patchProject({ [field]: [...(project[field] || []), val.trim()] });
    setter("");
  };
  const removeManagedValue = (field, val) => {
    patchProject({ [field]: (project[field] || []).filter(v => v !== val) });
  };

  const dropdownStyle = {
    width: "100%", fontSize: 10, padding: "2px 4px", borderRadius: 3,
    border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit", boxSizing: "border-box",
  };

  const countMeta = (field) => sessionList.filter(s => s.meta?.[field]).length;
  const totalSessions = sessionList.length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Session metadata" style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()}
        style={{ background: t.surf, borderRadius: 12, padding: 20, maxWidth: 900, width: "92%", maxHeight: "85vh", display: "flex", flexDirection: "column", border: `1px solid ${t.bdr}`, boxShadow: `0 8px 32px ${t.shadow}` }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.tx }}>Session Metadata</span>
          <button onClick={() => setGuideKey("sessionMetadata")}
            style={{ background: "none", border: "1px solid " + t.tx3 + "55", color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, flexShrink: 0 }} title="Guide">?</button>
          <Tag color={t.acc}>{totalSessions} sessions</Tag>
          <Tag color={t.tx3}>{countMeta("group")}/{totalSessions} grouped</Tag>
          <Tag color={t.tx3}>{countMeta("timepoint")}/{totalSessions} with timepoint</Tag>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 18, padding: "2px 6px", borderRadius: 4 }}
            title="Close">✕</button>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <Btn t={t} small ghost onClick={() => setShowManageGroups(true)}>Groups ({groups.length})</Btn>
          <Btn t={t} small ghost onClick={() => setShowManageTimepoints(true)}>Timepoints ({timepoints.length})</Btn>
          <Btn t={t} small ghost onClick={() => setShowManageOperators(true)}>Operators ({operators.length})</Btn>
          <div style={{ width: 1, height: 16, background: t.bdr, margin: "0 4px" }} />
          <Btn t={t} small ghost onClick={() => { detectPattern(); setShowParseModal(true); }} title="Parse metadata from image filenames">🔤 Parse Filenames</Btn>
          <div style={{ flex: 1 }} />
          <Tag color={t.tx3} style={{ fontSize: 9 }}>Click cells to edit</Tag>
        </div>

        {/* Batch action bar */}
        <BatchActionBar
          t={t} selectedSessions={selectedSessions}
          subjects={subjects} groups={groups} timepoints={timepoints} operators={operators}
          onAssignMeta={(field, val) => {
            const ids = [...selectedSessions];
            batchPatchSessions(ids, { meta: { [field]: val } });
          }}
          onAssignSubject={(subjectId) => {
            const ids = [...selectedSessions];
            batchPatchSessions(ids, { subjectId });
          }}
          onClearSelection={() => setSelectedSessions(new Set())}
        />

        {/* Table */}
        <div style={{ overflow: "auto", flex: 1, border: `1px solid ${t.bdr}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
            <thead>
              <tr style={{ background: t.surf3, color: t.tx2, position: "sticky", top: 0, zIndex: 1 }}>
                <th style={{ width: 32, padding: "6px 4px", borderBottom: `1px solid ${t.bdr}44` }}>
                  <input type="checkbox" checked={selectedSessions.size === totalSessions && totalSessions > 0}
                    onChange={toggleSelectAll} style={{ cursor: "pointer", accentColor: t.acc }} />
                </th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44` }}>Session</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 100 }}>Subject</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 90 }}>Group</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 90 }}>Timepoint</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 80 }}>Patient ID</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 80 }}>Operator</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}44`, minWidth: 60 }}>Image</th>
              </tr>
            </thead>
            <tbody>
              {sessionList.map((s, i) => {
                const checked = selectedSessions.has(s.id);
                return (
                  <tr key={s.id} style={{
                    background: checked ? t.acc + "0c" : (i % 2 ? t.surf3 : "transparent"),
                    borderBottom: `1px solid ${t.bdr}22`,
                  }}>
                    <td style={{ padding: "4px 4px", textAlign: "center" }}>
                      <input type="checkbox" checked={checked} onClick={e => toggleSelect(s.id, e.shiftKey)}
                        style={{ cursor: "pointer", accentColor: t.acc }} />
                    </td>
                    <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 500, color: t.tx }}>{s.name || s.id.slice(0, 6)}</span>
                      <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>{s.label || ""}</span>
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <select value={s.subjectId || ""} onChange={e => patchSession(s.id, { subjectId: e.target.value })}
                        style={dropdownStyle}>
                        <option value="">—</option>
                        {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <MetadataSelectInCell
                        value={s.meta?.group || ""} options={groups} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, group: val } })} t={t}
                      />
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <MetadataSelectInCell
                        value={s.meta?.timepoint || ""} options={timepoints} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, timepoint: val } })} t={t}
                      />
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <input value={s.meta?.patientId || ""}
                        onChange={e => patchSession(s.id, { meta: { ...s.meta, patientId: e.target.value } })}
                        placeholder="—"
                        style={{ width: "100%", fontSize: 10, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <MetadataSelectInCell
                        value={s.meta?.operatorId || ""} options={operators} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, operatorId: val } })} t={t}
                      />
                    </td>
                    <td style={{ padding: "4px 8px", fontSize: 9, color: t.tx3, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.images?.[0]?.name || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, borderTop: `1px solid ${t.bdr}44`, paddingTop: 12 }}>
          <Btn t={t} onClick={onClose}>Done</Btn>
        </div>

        {/* Manage Values Modals */}
        {showManageGroups && (
          <ManageValuesModal t={t} title="Manage Groups" values={groups}
            newVal={newGroupVal} setNewVal={setNewGroupVal}
            presets={["Treatment", "Control", "Group A", "Group B", "Test", "Reference"]}
            addNewVal={v => addManagedValue("groups", v, setNewGroupVal)}
            removeVal={v => removeManagedValue("groups", v)}
            onClose={() => setShowManageGroups(false)} />
        )}
        {showManageTimepoints && (
          <ManageValuesModal t={t} title="Manage Timepoints" values={timepoints}
            newVal={newTpVal} setNewVal={setNewTpVal}
            presets={["T0", "T1", "T2", "T3", "T4", "T5", "Baseline", "6mo", "12mo", "24mo", "Pre-op", "Post-op"]}
            addNewVal={v => addManagedValue("timepoints", v, setNewTpVal)}
            removeVal={v => removeManagedValue("timepoints", v)}
            onClose={() => setShowManageTimepoints(false)} />
        )}
        {showManageOperators && (
          <ManageValuesModal t={t} title="Manage Operators" values={operators}
            newVal={newOpVal} setNewVal={setNewOpVal}
            presets={["Rater 1", "Rater 2", "Reader A", "Reader B", "Dr Muhammad", "Dr Ahmed", "Orthodontist", "Otolaryngologist", "Radiologist", "Technician", "Researcher", "Student", "Professor", "Clinician", "Surgeon"]}
            addNewVal={v => addManagedValue("operators", v, setNewOpVal)}
            removeVal={v => removeManagedValue("operators", v)}
            onClose={() => setShowManageOperators(false)} />
        )}

        {/* Parse Filenames Modal */}
        {showParseModal && (
          <div role="dialog" aria-modal="true" aria-label="Parse from filenames" style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
            onClick={() => setShowParseModal(false)}>
            <div ref={parseDialogRef} onClick={e => e.stopPropagation()}
              style={{ background: t.surf, borderRadius: 12, padding: 20, maxWidth: 400, width: "90%", border: `1px solid ${t.bdr}`, boxShadow: `0 8px 32px ${t.shadow}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, marginBottom: 12 }}>Parse from Filenames</div>
              <div style={{ fontSize: 10, color: t.tx2, marginBottom: 8 }}>
                Pattern using <code style={{ background: t.surf3, padding: "1px 4px", borderRadius: 3 }}>{`{field}`}</code> placeholders.
                Fields: <code>patient</code>, <code>group</code>, <code>timepoint</code>, <code>operatorId</code>, <code>sex</code>, <code>age</code>.
              </div>
              <input ref={parseRef} value={parsePattern} onChange={e => setParsePattern(e.target.value)}
                placeholder="{patient}_{group}_{timepoint}"
                style={{ width: "100%", padding: "6px 8px", fontSize: 12, fontFamily: "'DM Mono',monospace", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, marginBottom: 8, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                {["{patient}_{group}_{timepoint}", "{patient}_{timepoint}_{group}", "{group}_{patient}_{timepoint}"].map(p => (
                  <button key={p} onClick={() => setParsePattern(p)}
                    style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx2, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                    {p}
                  </button>
                ))}
                <button onClick={detectPattern}
                  style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
                  Auto-detect
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn t={t} ghost onClick={() => setShowParseModal(false)}>Cancel</Btn>
                <Btn t={t} onClick={parseFilenames}>Parse & Apply</Btn>
              </div>
            </div>
          </div>
        )}
        {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function MetadataSelectInCell({ value, options, placeholder, onChange, t }) {
  const [custom, setCustom] = useState(false);
  if (custom) {
    return (
      <input autoFocus value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setCustom(false)}
        onKeyDown={e => { if (e.key === "Enter") setCustom(false); }}
        style={{ width: "100%", fontSize: 10, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}`, background: t.surf2, color: t.tx, fontFamily: "inherit", boxSizing: "border-box" }} />
    );
  }
  if (options.length > 0) {
    return (
      <select value={value} onChange={e => { const v = e.target.value; if (v === "__custom__") setCustom(true); else onChange(v); }}
        style={{ width: "100%", fontSize: 10, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit", boxSizing: "border-box" }}>
        <option value="">{placeholder}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        <option value="__custom__" style={{ color: t.acc, fontStyle: "italic" }}>+ Custom...</option>
      </select>
    );
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", fontSize: 10, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit", boxSizing: "border-box" }} />
  );
}

function BatchActionBar({ t, selectedSessions, subjects, groups, timepoints, operators, onAssignMeta, onAssignSubject, onClearSelection }) {
  const count = selectedSessions.size;
  const [patientIdVal, setPatientIdVal] = useState("");
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", marginBottom: 8, borderRadius: 6, background: t.acc + "12", border: `1px solid ${t.acc}44`, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: t.acc, fontWeight: 600, whiteSpace: "nowrap" }}>{count} selected</span>
      <span style={{ color: t.tx3, fontSize: 9 }}>set:</span>
      {/* Subject */}
      {subjects && subjects.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignSubject(e.target.value); }}
          style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}44`, background: t.surf, color: t.tx, maxWidth: 90 }}>
          <option value="">Subject...</option>
          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
        </select>
      )}
      {/* Group */}
      {groups.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("group", e.target.value); }}
          style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}44`, background: t.surf, color: t.tx }}>
          <option value="">Group...</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      )}
      {/* Timepoint */}
      {timepoints.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("timepoint", e.target.value); }}
          style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}44`, background: t.surf, color: t.tx }}>
          <option value="">Timepoint...</option>
          {timepoints.map(tp => <option key={tp} value={tp}>{tp}</option>)}
        </select>
      )}
      {/* Operator */}
      {operators.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("operatorId", e.target.value); }}
          style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}44`, background: t.surf, color: t.tx }}>
          <option value="">Operator...</option>
          {operators.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {/* Patient ID */}
      <input value={patientIdVal} onChange={e => setPatientIdVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && patientIdVal.trim()) { onAssignMeta("patientId", patientIdVal.trim()); setPatientIdVal(""); } }}
        placeholder="Patient ID..."
        style={{ width: 80, fontSize: 9, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.acc}44`, background: t.surf, color: t.tx }} />
      <div style={{ flex: 1 }} />
      <button onClick={onClearSelection}
        style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer" }}>
        Clear
      </button>
    </div>
  );
}

function ManageValuesModal({ t, title, values, newVal, setNewVal, addNewVal, removeVal, presets, onClose }) {
  const ref = useDialogA11y(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
      onClick={onClose}>
      <div ref={ref} onClick={e => e.stopPropagation()}
        style={{ background: t.surf, borderRadius: 12, padding: 20, maxWidth: 360, width: "90%", border: `1px solid ${t.bdr}`, boxShadow: `0 8px 32px ${t.shadow}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, marginBottom: 8 }}>{title}</div>

        {/* Preset buttons */}
        {presets && presets.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: t.tx3, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.3, marginBottom: 4 }}>Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {presets.map(p => (
                <button key={p} onClick={() => { if (!values.includes(p)) addNewVal(p); }}
                  style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx2, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current values */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {values.length === 0 && <span style={{ fontSize: 10, color: t.tx3 }}>No entries defined.</span>}
          {values.map(v => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: t.surf3, border: `1px solid ${t.bdr}`, fontSize: 10, color: t.tx }}>
              {v}
              <button onClick={() => removeVal(v)}
                style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>

        {/* Add new */}
        <div style={{ display: "flex", gap: 4 }}>
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="New entry..."
            onKeyDown={e => { if (e.key === "Enter") addNewVal(newVal); }}
            style={{ flex: 1, padding: "4px 8px", fontSize: 10, borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, fontFamily: "inherit" }} />
          <Btn t={t} small onClick={() => addNewVal(newVal)}>+ Add</Btn>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <Btn t={t} ghost onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}
