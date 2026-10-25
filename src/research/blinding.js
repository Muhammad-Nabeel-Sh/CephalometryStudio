// ═══════════════════════════════════════════════════════════════════════════════
// blinding.js — blinded data collection for reliability studies (A5)
//
// When a reliability study has "Blinding" on and its tracing workflow is under
// way, every tracing the rater could learn from is SEALED until all workflow
// steps are done:
//   • workflow copies already marked done (earlier occasions / other raters),
//   • the original case sessions, if they carry tracings.
// A sealed session can be opened only by explicitly breaking the seal, which is
// recorded in study.config.blindingLog and reported with the results.
// Results stay locked until the workflow is complete.
// ═══════════════════════════════════════════════════════════════════════════════

const hasTracing = s => (s?.markups || []).some(m => m.type === "point" && m.placed !== false);

export function isBlindingActive(study) {
  const c = study?.config;
  return study?.type === "reliability" && c?.protocol?.blindingEnforced === true
    && (c.workflow?.steps || []).length > 0 && !c.workflow.complete;
}

// Map sessionId → { studyId, studyName, reason } for every sealed session in the project.
export function sealedSessions(project) {
  const out = new Map();
  const byId = new Map((project?.sessions || []).map(s => [s.id, s]));
  for (const study of project?.researchStudies || []) {
    if (!isBlindingActive(study)) continue;
    const unsealed = new Set((study.config.blindingLog || []).map(e => e.sessionId));
    const seal = (id, reason) => {
      if (id && !unsealed.has(id) && !out.has(id)) out.set(id, { studyId: study.id, studyName: study.name, reason });
    };
    for (const step of study.config.workflow.steps) {
      if (step.done && step.cloneSessionId) seal(step.cloneSessionId, `${step.operatorName || "A rater"}’s tracing of ${step.caseName || "this case"} (occasion ${step.trialNum}) is sealed until data collection is complete.`);
      if (hasTracing(byId.get(step.baseSessionId))) seal(step.baseSessionId, `The original tracing of ${step.caseName || "this case"} is sealed until data collection is complete.`);
    }
  }
  return out;
}

export function sessionSeal(project, sessionId) {
  return sealedSessions(project).get(sessionId) || null;
}

// Break the seal on one session; the event is logged on the study.
export function unsealSession(project, studyId, sessionId, now = Date.now()) {
  return {
    ...project,
    researchStudies: (project.researchStudies || []).map(s => s.id !== studyId ? s : {
      ...s,
      config: { ...s.config, blindingLog: [...(s.config.blindingLog || []), { sessionId, at: now }] },
    }),
  };
}

// { blocked, done, total } — results are locked while blinded collection is incomplete.
export function blindingProgress(study) {
  if (!isBlindingActive(study)) return { blocked: false, done: 0, total: 0 };
  const steps = study.config.workflow.steps;
  return { blocked: true, done: steps.filter(s => s.done).length, total: steps.length };
}
