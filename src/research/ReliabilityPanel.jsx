// ═══════════════════════════════════════════════════════════════════════════════
// RELIABILITY PANEL — Config & Results UI for Reproducibility Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { InfoBox } from "../ui/ui.jsx";
import { mkReliabilitySession } from "../model/session.js";
import { addSession } from "../model/project.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Label Selector (reused from ResearchPanel) ─────────────────────────
function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [...new Set((sessions || []).flatMap(s =>
    (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)
  ))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 10, color: t.tx3 }}>No labeled markups found.</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {selected.length === 0 && <span style={{ fontSize: 10, color: t.tx3, padding: "2px 0" }}>All ({labels.length})</span>}
      {selected.length > 0 && (
        <button onClick={() => labels.forEach(l => { if (selected.includes(l)) onToggle(l); })}
          style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer" }}>
          Clear
        </button>
      )}
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

// ─── Config Panel ────────────────────────────────────────────────────────
export function ReliabilityConfig({ study, sessions, onUpdateStudy, t, project, onUpdateProject }) {
  const config = study.config;
  const operators = config.operators || [];
  const cases = config.cases || [];
  const labelIds = config.labelIds || [];
  const protocol = config.protocol || {};
  const occasions = protocol.occasions || 2;
  const workflow = config.workflow || {};

  if (workflow.active) {
    return (
      <ReliabilityWorkflow
        study={study}
        sessions={sessions}
        onUpdateStudy={onUpdateStudy}
        onUpdateProject={onUpdateProject}
        project={project}
        t={t}
      />
    );
  }

  const syncCaseSessions = (c) => {
    if (!c.sessionId) return { ...c, sessions: [] };
    return {
      ...c,
      sessions: operators.flatMap(op =>
        Array.from({ length: occasions }, (_, i) => ({
          sessionId: c.sessionId,
          operatorId: op.id,
          occasion: i + 1,
        }))
      ),
    };
  };

  const startWorkflow = () => {
    const steps = [];
    for (let oi = 0; oi < operators.length; oi++) {
      const op = operators[oi];
      for (let ti = 1; ti <= occasions; ti++) {
        for (let ci = 0; ci < cases.length; ci++) {
          const c = cases[ci];
          if (!c.sessionId) continue;
          const baseSes = sessions.find(s => s.id === c.sessionId);
          steps.push({
            operatorIdx: oi,
            operatorId: op.id,
            operatorName: op.name,
            trialNum: ti,
            caseIdx: ci,
            caseName: c.name,
            caseId: c.id,
            baseSessionId: c.sessionId,
            baseSessionName: baseSes?.name || baseSes?.label || c.sessionId.slice(0, 8),
            cloneSessionId: null,
            done: false,
          });
        }
      }
    }
    if (steps.length === 0) return;
    update({
      workflow: { active: true, steps, currentStep: 0, complete: false },
    });
  };

  const update = (patch) => {
    const newConfig = { ...config, ...patch };
    // Auto-sync cases when operators or occasions change
    if (patch.operators || patch.protocol) {
      const opList = newConfig.operators || operators;
      const occ = (newConfig.protocol || protocol).occasions || 2;
      newConfig.cases = (newConfig.cases || cases).map(c =>
        !c.sessionId ? { ...c, sessions: [] } : {
          ...c,
          sessions: opList.flatMap(op =>
            Array.from({ length: occ }, (_, i) => ({
              sessionId: c.sessionId,
              operatorId: op.id,
              occasion: i + 1,
            }))
          ),
        }
      );
    }
    onUpdateStudy({ ...study, config: newConfig });
  };

  const isMethod = config.design === "method_comparison";
  const agentLabel = isMethod ? "Method" : "Operator";
  const agentLabelPl = isMethod ? "Methods" : "Operators";

  const addOperator = () => {
    const defaultRole = isMethod ? "test" : "primary";
    update({ operators: [...operators, { id: uid(), name: `${agentLabel} ${operators.length + 1}`, role: defaultRole }] });
  };

  const removeOperator = (id) => {
    update({ operators: operators.filter(o => o.id !== id) });
  };

  const renameOperator = (id, name) => {
    update({ operators: operators.map(o => o.id === id ? { ...o, name } : o) });
  };

  const addCase = () => {
    update({ cases: [...cases, { id: uid(), name: `Case ${cases.length + 1}`, sessionId: "", sessions: [] }] });
  };

  const removeCase = (id) => {
    update({ cases: cases.filter(c => c.id !== id) });
  };

  const setCaseSession = (caseId, sessionId) => {
    update({
      cases: cases.map(c => {
        if (c.id !== caseId) return c;
        return syncCaseSessions({ ...c, sessionId });
      }),
    });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId) ? labelIds.filter(id => id !== labelId) : [...labelIds, labelId];
    update({ labelIds: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11 }}>

      <InfoBox t={t}>
        Each <b>case</b> represents one subject at one timepoint. Pick a <b>session</b> (image) for the case;
        all <b>operator</b> × <b>trial</b> combinations are auto-generated from that session.
        Use <b>"From Subjects"</b> to auto-populate from your project subjects.
      </InfoBox>

      {/* Design selector */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Study Design</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["intra", "inter", "method_comparison"].map(d => (
            <button key={d} onClick={() => update({ design: d })}
              style={{
                flex: 1, padding: "5px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${config.design === d ? t.acc : t.bdr}`,
                background: config.design === d ? t.acc + "22" : "transparent",
                color: config.design === d ? t.acc : t.tx2,
              }}>
              {d === "intra" ? "Intra-operator" : d === "inter" ? "Inter-operator" : "Method Comparison"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>
          {config.design === "intra" ? "Same operator, repeated measurements on each case" :
           config.design === "inter" ? "Different operators measuring the same cases" :
           "Comparing two measurement methods on the same cases"}
        </div>
      </div>

      {/* Operators / Methods */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>{agentLabelPl}</span>
          <button onClick={addOperator}
            style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
            + Add
          </button>
        </div>
        {operators.length === 0 && <div style={{ fontSize: 10, color: t.tx3 }}>No {agentLabel.toLowerCase()}s defined.</div>}
        {operators.map(o => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
            <input value={o.name} onChange={e => renameOperator(o.id, e.target.value)}
              style={{
                flex: 1, padding: "4px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`,
                background: t.surf, color: t.tx, fontSize: 10,
              }} />
            <select value={o.role} onChange={e => update({ operators: operators.map(op => op.id === o.id ? { ...op, role: e.target.value } : op) })}
              style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
              {isMethod ? (
                <>
                  <option value="reference">Reference</option>
                  <option value="test">Test</option>
                </>
              ) : (
                <>
                  <option value="primary">Primary</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="trainee">Trainee</option>
                </>
              )}
            </select>
            <button onClick={() => removeOperator(o.id)}
              style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 11, padding: 2 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Protocol */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Protocol</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: t.tx2 }}>Occasions:</span>
          <select value={config.protocol?.occasions || 2}
            onChange={e => update({ protocol: { ...config.protocol, occasions: Number(e.target.value) } })}
            style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
            {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label style={{ fontSize: 10, color: t.tx2, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={config.protocol?.blindingEnforced || false}
              onChange={e => update({ protocol: { ...config.protocol, blindingEnforced: e.target.checked } })} />
            Blinding
          </label>
        </div>
        {config.design === "intra" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: t.tx2 }}>Min separation (days):</span>
            <input type="number" min={1} value={config.minTimeSeparation || 14}
              onChange={e => update({ minTimeSeparation: Math.max(1, Number(e.target.value)) })}
              style={{ width: 50, padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }} />
          </div>
        )}
      </div>

      {/* Cases / Session mapping */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>Cases</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => {
              const subjects = project?.subjects || [];
              if (subjects.length === 0) return;
              const managedOps = project?.operators || [];
              const opList = managedOps.length > 0
                ? managedOps.map((name, i) => ({ id: uid(), name, role: i === 0 ? (isMethod ? "test" : "primary") : "secondary" }))
                : operators.length > 0
                  ? operators
                  : [{ id: uid(), name: "Operator 1", role: isMethod ? "test" : "primary" }];
              const newCases = subjects.map(sub => {
                const subSessions = sessions.filter(s => s.subjectId === sub.id);
                const firstSessionId = subSessions[0]?.id || "";
                return {
                  id: uid(),
                  name: sub.label,
                  sessionId: firstSessionId,
                  sessions: firstSessionId
                    ? opList.flatMap(op =>
                        Array.from({ length: occasions }, (_, i) => ({
                          sessionId: firstSessionId,
                          operatorId: op.id,
                          occasion: i + 1,
                        }))
                      )
                    : [],
                };
              });
              update({ operators: opList, cases: newCases });
            }}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
              From Subjects
            </button>
            <button onClick={addCase}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>
              + Add Case
            </button>
          </div>
        </div>
        {cases.length === 0 && (
          <div style={{ fontSize: 10, color: t.tx3, padding: "6px 0" }}>No cases defined. Add a case and assign a session to it.</div>
        )}
        {cases.map(c => {
          const ses = c.sessionId ? sessions.find(s => s.id === c.sessionId) : null;
          return (
          <div key={c.id} style={{ marginBottom: 8, padding: 8, borderRadius: 4, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <input value={c.name} onChange={e => update({ cases: cases.map(c2 => c2.id === c.id ? { ...c2, name: e.target.value } : c2) })}
                style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10, fontWeight: 600 }} />
              <button onClick={() => removeCase(c.id)}
                style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 2 }}>✕</button>
            </div>

            {/* Single session picker */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 9, color: t.tx3, display: "block", marginBottom: 2 }}>Session (image):</label>
              <div style={{ display: "flex", gap: 3 }}>
                <select value={c.sessionId || ""} onChange={e => setCaseSession(c.id, e.target.value)}
                  style={{ flex: 1, padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
                  <option value="">Select session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Operator × Trial auto-generated grid */}
            {c.sessionId && (c.sessions || []).length > 0 && (
              <div>
                <div style={{ fontSize: 8, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
                  {operators.length} {agentLabel.toLowerCase()}{operators.length !== 1 ? "s" : ""} × {occasions} trial{occasions !== 1 ? "s" : ""} — {c.sessions.length} entries
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {(c.sessions || []).map(cs => {
                    const op = operators.find(o => o.id === cs.operatorId);
                    return (
                      <div key={`${cs.operatorId}-${cs.occasion}`}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 4px", background: t.surf2, borderRadius: 2, fontSize: 9 }}>
                        <span style={{ color: t.acc, fontWeight: 600, minWidth: 80, fontSize: 8 }}>{op?.name || cs.operatorId}</span>
                        <span style={{ color: t.tx3 }}>Trial {cs.occasion}:</span>
                        <span style={{ color: t.tx, fontFamily: "'DM Mono',monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ses?.name || ses?.label || cs.sessionId.slice(0, 8)}
                        </span>
                        <span style={{ color: t.ok, fontSize: 8 }}>✓ auto</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No session selected */}
            {!c.sessionId && sessions.length > 0 && (
              <div style={{ fontSize: 9, color: t.tx3, fontStyle: "italic" }}>Select a session above to auto-generate operator × trial entries.</div>
            )}
            {!c.sessionId && sessions.length === 0 && (
              <div style={{ fontSize: 9, color: t.tx3, fontStyle: "italic" }}>No sessions available. Import an image first.</div>
            )}
          </div>
          );
        })}
      </div>

      {/* Measurement labels */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Measurements</div>
        <LabelSelector sessions={sessions} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Ready indicator */}
      <div style={{ fontSize: 10, color: t.tx2, textAlign: "center", padding: 6, background: t.surf3, borderRadius: 4 }}>
        {cases.length === 0 ? "⚠ Add at least one case with a session assigned" :
         cases.every(c => !c.sessionId) ? "⚠ Assign a session to each case" :
         operators.length < (config.design === "intra" ? 1 : 2) ? `⚠ Define enough ${agentLabel.toLowerCase()}s for this design` :
         `✓ ${cases.length} case(s), ${operators.length} ${agentLabel.toLowerCase()}s × ${occasions} trial(s), ${labelIds.length || "all"} measurement(s)`}
      </div>

      {/* Run Study button */}
      <button onClick={startWorkflow}
        disabled={cases.length === 0 || cases.every(c => !c.sessionId) || operators.length === 0}
        style={{
          padding: "8px 12px", borderRadius: 6, border: "none", cursor: "pointer",
          background: t.ok, color: t.bg, fontSize: 12, fontWeight: 700,
          opacity: cases.length > 0 && cases.some(c => c.sessionId) && operators.length > 0 ? 1 : 0.4,
        }}>
        ▶ Run Study
      </button>
    </div>
  );
}

// ─── Workflow Panel (guided data collection) ─────────────────────────────
function ReliabilityWorkflow({ study, sessions, onUpdateStudy, onUpdateProject, project, t }) {
  const config = study.config;
  const workflow = config.workflow || {};
  const steps = workflow.steps || [];
  const occasions = config.protocol?.occasions || 2;
  const currentStep = workflow.currentStep || 0;
  const current = steps[currentStep];
  const total = steps.length;
  const doneCount = steps.filter(s => s.done).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const exitWorkflow = () => {
    update({ workflow: { ...workflow, active: false } });
  };

  const openSession = () => {
    if (!current) return;
    let cloneId = current.cloneSessionId;
    if (!cloneId) {
      const baseSession = sessions.find(s => s.id === current.baseSessionId);
      if (!baseSession) return;
      const newSession = mkReliabilitySession(baseSession, current.operatorId, current.trialNum);
      cloneId = newSession.id;

      // Update this step's cloneSessionId
      const newSteps = steps.map((s, i) =>
        i === currentStep ? { ...s, cloneSessionId: cloneId } : s
      );

      // Update the case's session entry to point to the clone (unique sessionId per operator×trial)
      const updatedCases = config.cases.map(c =>
        c.id !== current.caseId ? c : {
          ...c,
          sessions: (c.sessions || []).map(cs =>
            cs.operatorId === current.operatorId && cs.occasion === current.trialNum
              ? { ...cs, sessionId: cloneId }
              : cs
          ),
        }
      );

      // Single combined project update: add session + update study + navigate
      const updatedProject = addSession(project, newSession);
      const updatedStudy = {
        ...study,
        config: {
          ...config,
          cases: updatedCases,
          workflow: { ...workflow, steps: newSteps, currentStep },
        },
      };
      onUpdateProject({
        ...updatedProject,
        researchStudies: (updatedProject.researchStudies || []).map(s =>
          s.id === study.id ? updatedStudy : s
        ),
      });
    } else {
      onUpdateProject({ ...project, activeSessionId: cloneId });
    }
  };

  const ensureClone = (step) => {
    if (step.cloneSessionId) return step;
    const baseSession = sessions.find(s => s.id === step.baseSessionId);
    if (!baseSession) return step;
    const newSession = mkReliabilitySession(baseSession, step.operatorId, step.trialNum);
    const cloneId = newSession.id;
    // Update case session entry to point to clone
    const updatedCases = config.cases.map(c =>
      c.id !== step.caseId ? c : {
        ...c,
        sessions: (c.sessions || []).map(cs =>
          cs.operatorId === step.operatorId && cs.occasion === step.trialNum
            ? { ...cs, sessionId: cloneId }
            : cs
        ),
      }
    );
    const updatedProject = addSession(project, newSession);
    onUpdateProject({
      ...updatedProject,
      researchStudies: (updatedProject.researchStudies || []).map(s =>
        s.id === study.id ? {
          ...study,
          config: { ...config, cases: updatedCases },
        } : s
      ),
    });
    return { ...step, cloneSessionId: cloneId };
  };

  const completeAndNext = () => {
    if (!current) return;
    // Auto-create clone if not yet opened (so analysis sees unique sessionIds)
    const resolved = current.cloneSessionId ? current : ensureClone(current);
    const newSteps = steps.map((s, i) =>
      i === currentStep ? { ...resolved, done: true } : s
    );
    const nextIdx = currentStep + 1;
    const complete = nextIdx >= total;
    const updatedStudy = {
      ...study,
      config: {
        ...config,
        workflow: { ...workflow, steps: newSteps, currentStep: nextIdx, complete },
      },
    };
    onUpdateStudy(updatedStudy);
  };

  if (!current && !workflow.complete) {
    return (
      <div style={{ fontSize: 10, color: t.tx3, textAlign: "center", padding: 20 }}>No workflow steps available.</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>Study Workflow</span>
        <button onClick={exitWorkflow}
          style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 9, textDecoration: "underline" }}>
          Exit
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.tx2, marginBottom: 3 }}>
          <span>{doneCount}/{total} steps done</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 6, background: t.surf3, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: t.ok, borderRadius: 3, transition: "width 0.2s" }} />
        </div>
      </div>

      {/* Workflow complete */}
      {workflow.complete && (
        <div style={{ padding: 12, background: t.ok + "18", borderRadius: 6, border: `1px solid ${t.ok}44`, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ok, marginBottom: 4 }}>✓ All steps complete!</div>
          <div style={{ fontSize: 10, color: t.tx2 }}>All operators have completed their trials. Ready for analysis.</div>
        </div>
      )}

      {/* Current step */}
      {!workflow.complete && current && (
        <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 8, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>
            Step {currentStep + 1} of {total}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
              <span style={{ color: t.tx3, minWidth: 60 }}>Operator:</span>
              <span style={{ color: t.acc, fontWeight: 700 }}>{current.operatorName}</span>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
              <span style={{ color: t.tx3, minWidth: 60 }}>Trial:</span>
              <span style={{ color: t.tx, fontWeight: 600 }}>{current.trialNum} of {occasions}</span>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
              <span style={{ color: t.tx3, minWidth: 60 }}>Case:</span>
              <span style={{ color: t.tx, fontWeight: 600 }}>{current.caseName}</span>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
              <span style={{ color: t.tx3, minWidth: 60 }}>Session:</span>
              <span style={{ color: t.tx2, fontFamily: "'DM Mono',monospace" }}>{current.baseSessionName}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={openSession}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                background: t.acc, color: t.bg, fontSize: 10, fontWeight: 700,
              }}>
              {current.cloneSessionId ? "Open Session" : "▶ Open & Create"}
            </button>
            <button onClick={completeAndNext}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 4, border: `1px solid ${t.ok}`, cursor: "pointer",
                background: t.ok + "18", color: t.ok, fontSize: 10, fontWeight: 700,
              }}>
              {currentStep + 1 >= total ? "Finish ✓" : "Complete & Next →"}
            </button>
          </div>
        </div>
      )}

      {/* Operator progress summary */}
      <div>
        <div style={{ fontSize: 8, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Operator Progress</div>
        {(() => {
          const opSteps = {};
          for (const s of steps) {
            if (!opSteps[s.operatorName]) opSteps[s.operatorName] = { total: 0, done: 0 };
            opSteps[s.operatorName].total++;
            if (s.done) opSteps[s.operatorName].done++;
          }
          return Object.entries(opSteps).map(([name, stats]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", marginBottom: 2, background: t.surf2, borderRadius: 3, fontSize: 9 }}>
              <span style={{ color: t.acc, fontWeight: 600, minWidth: 80 }}>{name}</span>
              <div style={{ flex: 1, height: 4, background: t.surf3, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: (stats.done / stats.total * 100) + "%", background: stats.done === stats.total ? t.ok : t.acc2, borderRadius: 2 }} />
              </div>
              <span style={{ color: t.tx2 }}>{stats.done}/{stats.total}</span>
              {stats.done === stats.total && <span style={{ color: t.ok }}>✓</span>}
            </div>
          ));
        })()}
      </div>

      {workflow.complete && (
        <div style={{ fontSize: 9, color: t.tx3, textAlign: "center", padding: 4 }}>
          All data collected. Run analysis below.
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ──────────────────────────────────────────────────────
export function ReliabilityResults({ results, t }) {
  const [tab, setTab] = useState("icc");
  const details = results.details || [];

  const tabs = [
    { id: "icc", label: "ICC" },
    { id: "ba", label: "Bland-Altman" },
    { id: "error", label: "Method Error" },
    { id: "map", label: "Error Map" },
    { id: "summary", label: "Summary" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8, borderBottom: `1px solid ${t.bdr}44` }}>
        {tabs.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            style={{
              padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: tab === tabItem.id ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: tab === tabItem.id ? t.acc : t.tx3,
            }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {results.note && !results.details?.length && (
        <div style={{ fontSize: 11, color: t.tx2, padding: 12, textAlign: "center" }}>{results.note}</div>
      )}

      {tab === "icc" && <ICCView details={details} t={t} />}
      {tab === "ba" && <BlandAltmanView details={details} t={t} />}
      {tab === "error" && <MethodErrorView details={details} t={t} />}
      {tab === "map" && <ErrorMapView results={results} t={t} />}
      {tab === "summary" && <SummaryView results={results} t={t} />}
    </div>
  );
}

// ─── ICC Table ──────────────────────────────────────────────────────────
function ICCView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.icc != null).filter(d => d.icc !== undefined);
  if (valid.length === 0) return <EmptyDetail message="No ICC results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "ICC", "95% CI", "Interp.", "F", "df1", "df2", "p"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => {
            const intLabel = iccInterpretation(r.icc);
            const intColor = iccColor(r.icc);
            return (
              <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
                <td style={{ padding: "5px 6px", color: intColor, fontWeight: 700 }}>{r.icc != null ? r.icc.toFixed(4) : "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {r.ci95?.[0] != null ? `[${r.ci95[0].toFixed(3)}, ${r.ci95[1].toFixed(3)}]` : "—"}
                </td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: intColor + "22", border: `1px solid ${intColor}44`, color: intColor,
                  }}>{intLabel}</span>
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.F?.toFixed(2) || "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.df1 ?? "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.df2 ?? "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.pValue != null ? fmtP(r.pValue) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Bland-Altman View ──────────────────────────────────────────────────
function BlandAltmanView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.meanDiff != null);
  if (valid.length === 0) return <EmptyDetail message="No Bland-Altman results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Unit", "Mean Diff", "SD Diff", "LoA Lower", "LoA Upper", "Prop. Bias", "p"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => (
            <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
              <td style={{ padding: "5px 6px", color: t.tx3 }}>{r.unit || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.meanDiff?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.sdDiff?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.loaLower?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.loaUpper?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: r.proportionalBias?.detected ? t.err : t.ok }}>
                {r.proportionalBias?.detected ? "Yes" : "No"}
              </td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.proportionalBias?.pValue != null ? fmtP(r.proportionalBias.pValue) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Method Error View (Dahlberg / SEM / MDC) ───────────────────────────
function MethodErrorView({ details, t }) {
  const valid = details.filter(d => !d.skip && d.dahlberg != null);
  if (valid.length === 0) return <EmptyDetail message="No method error results available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Unit", "Dahlberg", "SEM", "MDC (95%)", "CV (%)", "N"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(r => (
            <tr key={r.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{r.label}</td>
              <td style={{ padding: "5px 6px", color: t.tx3 }}>{r.unit || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.dahlberg?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.sem?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.mdc?.toFixed(4) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.cv?.toFixed(2) || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{r.n || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Landmark Error Map ─────────────────────────────────────────────────
function ErrorMapView({ results, t }) {
  const map = results.landmarkMap;
  if (!map || Object.keys(map).length === 0) return <EmptyDetail message="No landmark error data available. Ensure point-type markups are placed." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Landmark", "Unit", "N", "Mean Error", "SD Error", "Max Error", "Ellipse Major", "Ellipse Minor"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(map).sort().map(([label, lm]) => (
            <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{label}</td>
              <td style={{ padding: "5px 6px", color: t.tx3 }}>{lm.unit || "—"}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.n}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.meanError.toFixed(2)} {lm.unit || ""}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.sdError.toFixed(2)} {lm.unit || ""}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.maxError.toFixed(2)} {lm.unit || ""}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.ellipse?.major?.toFixed(2) || "—"} {lm.ellipse?.unit || lm.unit || ""}</td>
              <td style={{ padding: "5px 6px", color: t.tx2 }}>{lm.ellipse?.minor?.toFixed(2) || "—"} {lm.ellipse?.unit || lm.unit || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Summary View ────────────────────────────────────────────────────────
function SummaryView({ results, t }) {
  const s = results.summary || {};
  const details = results.details || [];
  const valid = details.filter(d => !d.skip);
  const skipped = details.filter(d => d.skip);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Study Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
          <span>Design:</span><span style={{ color: t.tx, fontWeight: 600 }}>{s.design || "—"}</span>
          <span>Operators:</span><span style={{ color: t.tx }}>{s.operators || "—"}</span>
          <span>Cases:</span><span style={{ color: t.tx }}>{s.cases || "—"}</span>
          <span>Occasions:</span><span style={{ color: t.tx }}>{s.occasions || "—"}</span>
          <span>Measurements:</span><span style={{ color: t.tx }}>{results.measurements || 0}</span>
          <span>Labels analyzed:</span><span style={{ color: t.tx }}>{valid.length}</span>
        </div>
      </div>

      {valid.length > 0 && (
        <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>ICC Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
            <span>Excellent (≥0.90):</span><span style={{ color: t.ok, fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.9).length}</span>
            <span>Good (0.75–0.90):</span><span style={{ color: "#60a5fa", fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.75 && d.icc < 0.9).length}</span>
            <span>Moderate (0.50–0.75):</span><span style={{ color: t.warn, fontWeight: 600 }}>{valid.filter(d => d.icc >= 0.5 && d.icc < 0.75).length}</span>
            <span>Poor ({`<`}0.50):</span><span style={{ color: t.err, fontWeight: 600 }}>{valid.filter(d => d.icc < 0.5).length}</span>
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div style={{ padding: 10, background: t.err + "0a", borderRadius: 6, border: `1px solid ${t.err}33` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.err, marginBottom: 4 }}>Skipped ({skipped.length})</div>
          {skipped.map(d => (
            <div key={d.label} style={{ fontSize: 9, color: t.tx2, marginBottom: 2 }}>
              <span style={{ color: t.tx, fontWeight: 600 }}>{d.label}</span>: {d.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────
function EmptyDetail({ message, t }) {
  return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 16 }}>{message}</div>;
}

function iccInterpretation(val) {
  if (val >= 0.9) return "Excellent";
  if (val >= 0.75) return "Good";
  if (val >= 0.5) return "Moderate";
  return "Poor";
}

function iccColor(val) {
  if (val >= 0.9) return "#34d399";
  if (val >= 0.75) return "#60a5fa";
  if (val >= 0.5) return "#fb923c";
  return "#f87171";
}

function fmtP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
