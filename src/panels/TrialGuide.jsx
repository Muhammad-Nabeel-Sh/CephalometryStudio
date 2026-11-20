// ═══════════════════════════════════════════════════════════════════════════════
// TrialGuide — guides tracing through a reliability study's steps, on the canvas
//
// Shown while the open session is one of a reliability workflow's tracings. It
// says who should trace which trial of which case, moves backward and forward,
// marks a tracing done and opens the next, asks for a handover when the next
// tracing is another rater's, and warns when a later trial comes too soon after
// the earlier one. Step logic: research/trialWorkflow.js.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Icon } from "../ui/icons.jsx";
import { askConfirm, notify } from "../ui/dialogs.js";
import { stepForSession, openStep, completeStep, nextOpenIndex, transition, workflowProgress } from "../research/trialWorkflow.js";
import { isBlindingActive } from "../research/blinding.js";

const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { dateStyle: "medium" });

// Ask before moving to `to` when it's another rater's tracing or comes too soon. → true to go on.
async function confirmMove(study, from, to) {
  const steps = study.config.workflow.steps;
  const next = steps[to];
  const { handover, tooSoon } = transition(study, from, to);
  if (!handover && !tooSoon) return true;
  const lines = [];
  if (handover) lines.push(`The next tracing is ${next.operatorName}'s: trial ${next.trialNum} of ${next.caseName}. Hand the device to ${next.operatorName} before opening it, so each tracing is recorded under the right rater.`);
  if (handover && isBlindingActive(study)) lines.push("With blinding on, the tracings already done stay hidden from the next rater.");
  if (tooSoon) lines.push(`${next.operatorName} traced this case ${tooSoon.days === 0 ? "today" : `${tooSoon.days} day${tooSoon.days === 1 ? "" : "s"} ago`} (${fmtDate(tooSoon.since)}). The study asks for at least ${tooSoon.minDays} days between trials, so the rater doesn't remember the earlier tracing.`);
  return askConfirm({
    title: handover ? `Hand over to ${next.operatorName}` : "Too soon for the next trial",
    message: lines.join("\n\n"),
    confirmLabel: handover ? `I'm ${next.operatorName}, open it` : "Open it anyway",
    danger: !!tooSoon && !handover,
  });
}

export function TrialGuide({ t, project, sessionId, sealed, onUpdateProject, onOpenStudy, style }) {
  const [open, setOpen] = useState(true);
  const [showList, setShowList] = useState(false);
  const here = stepForSession(project, sessionId);
  if (!here) return null;
  const { study, index, step } = here;
  const steps = study.config.workflow.steps;
  const occasions = study.config.protocol?.occasions || Math.max(...steps.map((s) => s.trialNum));
  const prog = workflowProgress(study);
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  const isSealed = (s) => !!s.cloneSessionId && sealed?.has(s.cloneSessionId);

  const go = async (to) => {
    if (to == null || to < 0 || to >= steps.length || to === index) return;
    if (!(await confirmMove(study, index, to))) return;
    onUpdateProject((prev) => openStep(prev, study.id, to));
  };
  const doneNext = async () => {
    onUpdateProject((prev) => completeStep(prev, study.id, index));
    // completeStep is pure, so the next step can be worked out from the same input.
    const after = completeStep(project, study.id, index).researchStudies.find((s) => s.id === study.id);
    const next = nextOpenIndex(after.config.workflow.steps, index);
    if (next == null) {
      notify(`All ${steps.length} tracings are done. Run the analysis in the study “${study.name}”.`, { tone: "ok", duration: 10000, action: onOpenStudy ? { label: "Open the study", onClick: onOpenStudy } : null });
      return;
    }
    if (!(await confirmMove(after, index, next))) return;
    onUpdateProject((prev) => openStep(prev, study.id, next));
  };

  const box = {
    position: "absolute", zIndex: 6, maxWidth: "min(380px, calc(100% - 24px))",
    background: t.surf + "f2", border: `1px solid ${t.acc}66`, borderRadius: 10,
    boxShadow: `0 6px 20px ${t.shadow}`, color: t.tx, fontSize: 13, ...style,
  };
  const btn = (primary) => ({
    padding: "6px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: primary ? 700 : 500,
    border: primary ? "none" : `1px solid ${t.bdr}`, background: primary ? t.acc : "transparent",
    color: primary ? (t.id === "light" || t.id === "paper" ? "#fff" : t.bg) : t.tx2, display: "inline-flex", alignItems: "center", gap: 4,
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Show the trial guide" style={{ ...box, padding: "6px 10px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
        <Icon name="users" size={15} />
        <span><b>{step.operatorName}</b> · trial {step.trialNum} · {step.caseName}</span>
        <span style={{ color: t.tx3 }}>{index + 1}/{steps.length}</span>
      </button>
    );
  }

  return (
    <section role="region" aria-label="Trial guide" style={{ ...box, padding: 12, width: 380 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: t.tx3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Reliability study · {study.name}
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide the trial guide" style={{ ...btn(false), padding: "2px 8px" }}>Hide</button>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: t.acc }}>{step.operatorName}</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Trial {step.trialNum} of {occasions}</span>
        <span style={{ fontSize: 15, color: t.tx2 }}>· {step.caseName}</span>
        {step.done && <span style={{ fontSize: 12, color: t.ok, border: `1px solid ${t.ok}`, borderRadius: 4, padding: "0 5px" }}>Done</span>}
      </div>
      <div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>
        {step.done ? "This tracing is marked done. Changes are still saved." : `${step.operatorName}: trace this case, then press Done.`}
      </div>

      <div style={{ margin: "10px 0 8px" }} aria-label={`Step ${index + 1} of ${steps.length}, ${prog.done} done`}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, marginBottom: 3 }}>
          <span>Step {index + 1} of {steps.length}</span><span>{prog.done} done · {pct}%</span>
        </div>
        <div style={{ height: 6, background: t.surf3, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: t.ok }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} style={{ ...btn(false), opacity: index === 0 ? 0.5 : 1 }} aria-label="Previous tracing">
          <Icon name="chevronLeft" size={15} /> Previous
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={index >= steps.length - 1} style={{ ...btn(false), opacity: index >= steps.length - 1 ? 0.5 : 1 }} aria-label="Next tracing">
          Next <Icon name="chevronRight" size={15} />
        </button>
        <button type="button" onClick={doneNext} style={{ ...btn(true), marginLeft: "auto" }}>
          <Icon name="check" size={15} /> {prog.done + (step.done ? 0 : 1) >= steps.length ? "Done, finish" : "Done, next"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12 }}>
        <button type="button" onClick={() => setShowList((v) => !v)} aria-expanded={showList} style={{ background: "none", border: "none", color: t.acc, cursor: "pointer", padding: 0, fontSize: 12 }}>
          {showList ? "Hide all tracings" : "All tracings"}
        </button>
        {onOpenStudy && <button type="button" onClick={onOpenStudy} style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", padding: 0, fontSize: 12 }}>Open the study</button>}
      </div>

      {showList && (
        <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", borderTop: `1px solid ${t.bdr}`, paddingTop: 6 }}>
          {prog.operators.map((op) => (
            <div key={op.operatorId} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 2 }}>{op.name} · {op.done}/{op.total}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {steps.map((s, i) => (s.operatorId !== op.operatorId ? null : (
                  <button key={i} type="button" onClick={() => go(i)} aria-current={i === index ? "step" : undefined}
                    title={`${s.caseName}, trial ${s.trialNum}${s.done ? ", done" : ""}${isSealed(s) ? ", sealed (blinded)" : ""}`}
                    style={{
                      fontSize: 12, padding: "2px 6px", borderRadius: 4, cursor: i === index ? "default" : "pointer",
                      border: `1px solid ${i === index ? t.acc : t.bdr}`, background: i === index ? t.acc + "22" : s.done ? t.ok + "18" : "transparent",
                      color: s.done ? t.ok : t.tx2, display: "inline-flex", alignItems: "center", gap: 3,
                    }}>
                    {isSealed(s) && <Icon name="lock" size={11} />}T{s.trialNum} · {s.caseName}{s.done ? " ✓" : ""}
                  </button>
                )))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
