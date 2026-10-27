import { useState, useRef } from "react";
import { Btn, Chip, GuideBtn } from "../ui/ui.jsx";
import { SMALL_BTN } from "../ui/tokens.js";
import { DialogShell } from "./Modal.jsx";
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

  const countMeta = (field) => sessionList.filter(s => s.meta?.[field]).length;
  const totalSessions = sessionList.length;
  const th = { padding: "8px 10px", textAlign: "left", color: t.tx3, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${t.bdr}`, background: t.surf, whiteSpace: "nowrap" };

  return (
    <DialogShell t={t} dialogRef={dialogRef} label="Session metadata" onClose={onClose} width={920} zIndex={1000}
      title={<>Session metadata <GuideBtn t={t} onClick={() => setGuideKey("sessionMetadata")} label="Session metadata guide" /></>}
      extra={<span style={{ fontSize: 12, color: t.tx3 }}>{totalSessions} sessions · {countMeta("group")} grouped · {countMeta("timepoint")} with timepoint</span>}>
      <div style={{ padding: "4px 24px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Btn t={t} small onClick={() => setShowManageGroups(true)} style={SMALL_BTN}>Groups ({groups.length})</Btn>
          <Btn t={t} small onClick={() => setShowManageTimepoints(true)} style={SMALL_BTN}>Timepoints ({timepoints.length})</Btn>
          <Btn t={t} small onClick={() => setShowManageOperators(true)} style={SMALL_BTN}>Operators ({operators.length})</Btn>
          <Btn t={t} small onClick={() => { detectPattern(); setShowParseModal(true); }} title="Parse metadata from image filenames" style={SMALL_BTN}>Parse filenames</Btn>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: t.tx3 }}>Edit cells directly · Shift-click to select a range</span>
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
        <div style={{ overflow: "auto", flex: 1, minHeight: 120, border: `1px solid ${t.bdr}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <th style={{ ...th, width: 32, textAlign: "center" }}>
                  <input type="checkbox" checked={selectedSessions.size === totalSessions && totalSessions > 0}
                    onChange={toggleSelectAll} aria-label="Select all sessions" style={{ cursor: "pointer", accentColor: t.acc }} />
                </th>
                <th style={th}>Session</th>
                <th style={{ ...th, minWidth: 110 }}>Subject</th>
                <th style={{ ...th, minWidth: 100 }}>Group</th>
                <th style={{ ...th, minWidth: 100 }}>Timepoint</th>
                <th style={{ ...th, minWidth: 90 }}>Patient ID</th>
                <th style={{ ...th, minWidth: 100 }}>Operator</th>
                <th style={{ ...th, minWidth: 80 }}>Image</th>
              </tr>
            </thead>
            <tbody>
              {sessionList.map((s, i) => {
                const checked = selectedSessions.has(s.id);
                return (
                  <tr key={s.id} style={{ background: checked ? t.acc + "14" : "transparent", borderBottom: i < sessionList.length - 1 ? `1px solid ${t.bdr}66` : "none" }}>
                    <td style={{ padding: "5px 4px", textAlign: "center" }}>
                      <input type="checkbox" checked={checked} onChange={() => {}} onClick={e => toggleSelect(s.id, e.shiftKey)}
                        aria-label={`Select ${s.name || "session"}`} style={{ cursor: "pointer", accentColor: t.acc }} />
                    </td>
                    <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 600, color: t.tx }}>{s.name || s.id.slice(0, 6)}</span>
                      {s.label && <span style={{ fontSize: 12, color: t.tx3, marginLeft: 6 }}>{s.label}</span>}
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <select value={s.subjectId || ""} onChange={e => patchSession(s.id, { subjectId: e.target.value })} aria-label="Subject" style={cellStyle(t)}>
                        <option value="">—</option>
                        {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <MetadataSelectInCell label="Group"
                        value={s.meta?.group || ""} options={groups} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, group: val } })} t={t}
                      />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <MetadataSelectInCell label="Timepoint"
                        value={s.meta?.timepoint || ""} options={timepoints} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, timepoint: val } })} t={t}
                      />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <input value={s.meta?.patientId || ""} aria-label="Patient ID"
                        onChange={e => patchSession(s.id, { meta: { ...s.meta, patientId: e.target.value } })}
                        placeholder="—" style={cellStyle(t)} />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <MetadataSelectInCell label="Operator"
                        value={s.meta?.operatorId || ""} options={operators} placeholder="—"
                        onChange={val => patchSession(s.id, { meta: { ...s.meta, operatorId: val } })} t={t}
                      />
                    </td>
                    <td title={s.images?.[0]?.name || ""} style={{ padding: "5px 10px", fontSize: 12, color: t.tx3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.images?.[0]?.name || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn t={t} small active onClick={onClose}>Done</Btn>
        </div>
      </div>

      {/* Manage Values Modals */}
      {showManageGroups && (
        <ManageValuesModal t={t} title="Groups" values={groups}
          newVal={newGroupVal} setNewVal={setNewGroupVal}
          presets={["Treatment", "Control", "Group A", "Group B", "Test", "Reference"]}
          addNewVal={v => addManagedValue("groups", v, setNewGroupVal)}
          removeVal={v => removeManagedValue("groups", v)}
          onClose={() => setShowManageGroups(false)} />
      )}
      {showManageTimepoints && (
        <ManageValuesModal t={t} title="Timepoints" values={timepoints}
          newVal={newTpVal} setNewVal={setNewTpVal}
          presets={["T0", "T1", "T2", "T3", "T4", "T5", "Baseline", "6mo", "12mo", "24mo", "Pre-op", "Post-op"]}
          addNewVal={v => addManagedValue("timepoints", v, setNewTpVal)}
          removeVal={v => removeManagedValue("timepoints", v)}
          onClose={() => setShowManageTimepoints(false)} />
      )}
      {showManageOperators && (
        <ManageValuesModal t={t} title="Operators" values={operators}
          newVal={newOpVal} setNewVal={setNewOpVal}
          presets={["Rater 1", "Rater 2", "Reader A", "Reader B", "Dr Muhammad", "Dr Ahmed", "Orthodontist", "Otolaryngologist", "Radiologist", "Technician", "Researcher", "Student", "Professor", "Clinician", "Surgeon"]}
          addNewVal={v => addManagedValue("operators", v, setNewOpVal)}
          removeVal={v => removeManagedValue("operators", v)}
          onClose={() => setShowManageOperators(false)} />
      )}

      {/* Parse Filenames Modal */}
      {showParseModal && (
        <DialogShell t={t} dialogRef={parseDialogRef} label="Parse from filenames" title="Parse from filenames" onClose={() => setShowParseModal(false)} width={440} zIndex={1100}>
          <div style={{ padding: "4px 24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.5 }}>
              Write the pattern with <code style={codeStyle(t)}>{`{field}`}</code> placeholders.
              Fields: <code style={codeStyle(t)}>patient</code> <code style={codeStyle(t)}>group</code> <code style={codeStyle(t)}>timepoint</code> <code style={codeStyle(t)}>operatorId</code> <code style={codeStyle(t)}>sex</code> <code style={codeStyle(t)}>age</code>
            </div>
            <input ref={parseRef} value={parsePattern} onChange={e => setParsePattern(e.target.value)} aria-label="Filename pattern"
              placeholder="{patient}_{group}_{timepoint}"
              style={{ ...inputStyle(t), fontFamily: "'DM Mono',monospace" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["{patient}_{group}_{timepoint}", "{patient}_{timepoint}_{group}", "{group}_{patient}_{timepoint}"].map(p => (
                <Chip key={p} t={t} mono on={parsePattern === p} onClick={() => setParsePattern(p)}>{p}</Chip>
              ))}
              <Btn t={t} small onClick={detectPattern} style={{ ...SMALL_BTN, color: t.acc }}>Auto-detect</Btn>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <Btn t={t} small onClick={() => setShowParseModal(false)}>Cancel</Btn>
              <Btn t={t} small active onClick={parseFilenames}>Parse and apply</Btn>
            </div>
          </div>
        </DialogShell>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </DialogShell>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

const inputStyle = t => ({ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, fontFamily: "inherit" });
const cellStyle = t => ({ ...inputStyle(t), padding: "4px 6px" });
const codeStyle = t => ({ fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "0 4px", borderRadius: 4, border: `1px solid ${t.bdr}`, color: t.tx });

function MetadataSelectInCell({ value, options, placeholder, onChange, t, label }) {
  const [custom, setCustom] = useState(false);
  if (custom) {
    return (
      <input autoFocus value={value} placeholder={placeholder} aria-label={label}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setCustom(false)}
        onKeyDown={e => { if (e.key === "Enter") setCustom(false); }}
        style={{ ...cellStyle(t), border: `1px solid ${t.acc}` }} />
    );
  }
  if (options.length > 0) {
    return (
      <select value={value} aria-label={label} onChange={e => { const v = e.target.value; if (v === "__custom__") setCustom(true); else onChange(v); }}
        style={cellStyle(t)}>
        <option value="">{placeholder}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        <option value="__custom__">+ Custom…</option>
      </select>
    );
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} style={cellStyle(t)} />
  );
}

function BatchActionBar({ t, selectedSessions, subjects, groups, timepoints, operators, onAssignMeta, onAssignSubject, onClearSelection }) {
  const count = selectedSessions.size;
  const [patientIdVal, setPatientIdVal] = useState("");
  if (count === 0) return null;
  const sel = { ...cellStyle(t), width: "auto", maxWidth: 140 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.acc}66`, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: t.acc, fontWeight: 600, whiteSpace: "nowrap" }}>{count} selected</span>
      <span style={{ color: t.tx3, fontSize: 12 }}>Set:</span>
      {subjects && subjects.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignSubject(e.target.value); }} aria-label="Set subject" style={sel}>
          <option value="">Subject…</option>
          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.label}</option>)}
        </select>
      )}
      {groups.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("group", e.target.value); }} aria-label="Set group" style={sel}>
          <option value="">Group…</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      )}
      {timepoints.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("timepoint", e.target.value); }} aria-label="Set timepoint" style={sel}>
          <option value="">Timepoint…</option>
          {timepoints.map(tp => <option key={tp} value={tp}>{tp}</option>)}
        </select>
      )}
      {operators.length > 0 && (
        <select value="" onChange={e => { if (e.target.value) onAssignMeta("operatorId", e.target.value); }} aria-label="Set operator" style={sel}>
          <option value="">Operator…</option>
          {operators.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      <input value={patientIdVal} onChange={e => setPatientIdVal(e.target.value)} aria-label="Set patient ID"
        onKeyDown={e => { if (e.key === "Enter" && patientIdVal.trim()) { onAssignMeta("patientId", patientIdVal.trim()); setPatientIdVal(""); } }}
        placeholder="Patient ID, then Enter"
        style={{ ...cellStyle(t), width: 160 }} />
      <div style={{ flex: 1 }} />
      <Btn t={t} small ghost onClick={onClearSelection} style={SMALL_BTN}>Clear selection</Btn>
    </div>
  );
}

function ManageValuesModal({ t, title, values, newVal, setNewVal, addNewVal, removeVal, presets, onClose }) {
  const ref = useDialogA11y(onClose);
  return (
    <DialogShell t={t} dialogRef={ref} label={title} title={title} onClose={onClose} width={420} zIndex={1200}>
      <div style={{ padding: "4px 24px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {values.length === 0 && <span style={{ fontSize: 13, color: t.tx3 }}>None yet.</span>}
          {values.map(v => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 6px 3px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, fontSize: 13, color: t.tx }}>
              {v}
              <button onClick={() => removeVal(v)} title={`Remove ${v}`} aria-label={`Remove ${v}`}
                style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="New entry" aria-label="New entry"
            onKeyDown={e => { if (e.key === "Enter") addNewVal(newVal); }}
            style={{ ...inputStyle(t), flex: 1 }} />
          <Btn t={t} small onClick={() => addNewVal(newVal)}>Add</Btn>
        </div>

        {presets && presets.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: t.tx3, fontWeight: 600, marginBottom: 6 }}>Suggestions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {presets.map(p => (
                <Chip key={p} t={t} on={values.includes(p)} onClick={() => { if (!values.includes(p)) addNewVal(p); }}>{p}</Chip>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn t={t} small active onClick={onClose}>Done</Btn>
        </div>
      </div>
    </DialogShell>
  );
}
