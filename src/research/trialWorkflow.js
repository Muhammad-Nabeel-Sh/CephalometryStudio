// ═══════════════════════════════════════════════════════════════════════════════
// trialWorkflow.js — moving through a reliability study's tracing steps
//
// A reliability study's workflow (config.workflow) lists one step per operator ×
// trial × case. Each step traces its own copy of the case's session (created on
// first visit with mkReliabilitySession). These pure functions are shared by the
// study's workflow panel (ReliabilityPanel) and the trial guide on the canvas
// (panels/TrialGuide.jsx), so the two always agree.
// ═══════════════════════════════════════════════════════════════════════════════

import { mkReliabilitySession } from "../model/session.js";
import { addSession } from "../model/project.js";

const DAY = 86400000;

const studyOf = (project, studyId) => (project?.researchStudies || []).find((s) => s.id === studyId) || null;
const withStudy = (project, study) => ({
  ...project,
  researchStudies: (project.researchStudies || []).map((s) => (s.id === study.id ? study : s)),
});

// The workflow step (if any) whose session is `sessionId`, among studies with a
// workflow. → { study, index, step } or null.
export function stepForSession(project, sessionId) {
  if (!sessionId) return null;
  for (const study of project?.researchStudies || []) {
    const steps = study?.config?.workflow?.steps || [];
    const index = steps.findIndex((s) => s.cloneSessionId === sessionId);
    if (index >= 0) return { study, index, step: steps[index] };
  }
  return null;
}

// Give step `index` its own session (copy of the case's session) if it has none.
// → { project, sessionId } (project unchanged and sessionId null if the case's session is gone).
export function ensureStepSession(project, studyId, index) {
  const study = studyOf(project, studyId);
  const steps = study?.config?.workflow?.steps || [];
  const step = steps[index];
  if (!step) return { project, sessionId: null };
  if (step.cloneSessionId && (project.sessions || []).some((s) => s.id === step.cloneSessionId)) return { project, sessionId: step.cloneSessionId };
  const base = (project.sessions || []).find((s) => s.id === step.baseSessionId);
  if (!base) return { project, sessionId: null };
  const session = mkReliabilitySession(base, step.operatorId, step.trialNum);
  session.name = `${step.caseName} · ${step.operatorName} · trial ${step.trialNum}`;
  const config = study.config;
  const cases = (config.cases || []).map((c) => (c.id !== step.caseId ? c : {
    ...c,
    sessions: (c.sessions || []).map((cs) => (cs.operatorId === step.operatorId && cs.occasion === step.trialNum ? { ...cs, sessionId: session.id } : cs)),
  }));
  const nextSteps = steps.map((s, i) => (i === index ? { ...s, cloneSessionId: session.id } : s));
  // addSession also makes the copy active; only openStep should do that.
  const withSession = { ...addSession(project, session), activeSessionId: project.activeSessionId };
  return {
    project: withStudy(withSession, { ...study, config: { ...config, cases, workflow: { ...config.workflow, steps: nextSteps } } }),
    sessionId: session.id,
  };
}

// Open step `index`: create its session if needed, make it the active session and
// the workflow's current step.
export function openStep(project, studyId, index, now = Date.now()) {
  const { project: p, sessionId } = ensureStepSession(project, studyId, index);
  if (!sessionId) return project;
  const study = studyOf(p, studyId);
  const wf = study.config.workflow;
  const steps = wf.steps.map((s, i) => (i === index && !s.startedAt ? { ...s, startedAt: now } : s));
  return { ...withStudy(p, { ...study, config: { ...study.config, workflow: { ...wf, steps, currentStep: index } } }), activeSessionId: sessionId };
}

// Mark step `index` done (its session is created if it never was, so the analysis
// sees one session per operator × trial). The workflow completes with the last step.
export function completeStep(project, studyId, index, now = Date.now()) {
  const { project: p } = ensureStepSession(project, studyId, index);
  const study = studyOf(p, studyId);
  const wf = study?.config?.workflow;
  if (!wf?.steps?.[index]) return project;
  const steps = wf.steps.map((s, i) => (i === index ? { ...s, done: true, doneAt: s.doneAt || now } : s));
  const complete = steps.every((s) => s.done);
  const next = nextOpenIndex(steps, index);
  return withStudy(p, { ...study, config: { ...study.config, workflow: { ...wf, steps, complete, currentStep: complete ? steps.length : next ?? index } } });
}

// Undo "done" on a step (e.g. it was marked by mistake). Blinding seals follow it.
export function reopenStep(project, studyId, index) {
  const study = studyOf(project, studyId);
  const wf = study?.config?.workflow;
  if (!wf?.steps?.[index]) return project;
  const steps = wf.steps.map((s, i) => (i === index ? { ...s, done: false, doneAt: undefined } : s));
  return withStudy(project, { ...study, config: { ...study.config, workflow: { ...wf, steps, complete: false, currentStep: index } } });
}

// The first step after `from` that isn't done, wrapping round; null if all are.
export function nextOpenIndex(steps, from = -1) {
  const n = steps?.length || 0;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!steps[i].done) return i;
  }
  return null;
}

// What the guide says about moving from step `from` to step `to`.
//   handover: the next step is another operator's
//   tooSoon:  this operator traced this case less than minTimeSeparation days ago
export function transition(study, from, to, now = Date.now()) {
  const steps = study?.config?.workflow?.steps || [];
  const a = steps[from], b = steps[to];
  if (!b) return { handover: false, tooSoon: null };
  const handover = !!a && a.operatorId !== b.operatorId;
  const minDays = Number(study?.config?.minTimeSeparation) || 0;
  let tooSoon = null;
  if (minDays > 0 && b.trialNum > 1) {
    const earlier = steps.filter((s) => s.operatorId === b.operatorId && s.caseId === b.caseId && s.trialNum < b.trialNum && s.doneAt);
    const last = Math.max(0, ...earlier.map((s) => s.doneAt));
    if (last && now - last < minDays * DAY) {
      tooSoon = { days: Math.max(0, Math.floor((now - last) / DAY)), minDays, since: last };
    }
  }
  return { handover, tooSoon };
}

// Progress of the whole workflow and of each operator.
export function workflowProgress(study) {
  const steps = study?.config?.workflow?.steps || [];
  const byOp = new Map();
  for (const s of steps) {
    const o = byOp.get(s.operatorId) || { operatorId: s.operatorId, name: s.operatorName, done: 0, total: 0 };
    o.total++; if (s.done) o.done++;
    byOp.set(s.operatorId, o);
  }
  return { done: steps.filter((s) => s.done).length, total: steps.length, operators: [...byOp.values()] };
}
