// Guided tracing through a reliability study's steps (research/trialWorkflow.js,
// panels/TrialGuide.jsx).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const dialogs = vi.hoisted(() => ({ askConfirm: vi.fn(async () => true), notify: vi.fn() }));
vi.mock("../ui/dialogs.js", () => dialogs);

import { stepForSession, ensureStepSession, openStep, completeStep, reopenStep, nextOpenIndex, transition, workflowProgress } from "../research/trialWorkflow.js";
import { TrialGuide } from "../panels/TrialGuide.jsx";
import { THEMES } from "../data/constants.js";

const DAY = 86400000;
const base = (id, name) => ({ id, name, markups: [], images: [{ id: `img-${id}` }], calibration: { done: true, pxPerMm: 10 }, meta: {} });
const step = (op, opName, trial, caseId, caseName, baseId) => ({ operatorId: op, operatorName: opName, trialNum: trial, caseId, caseName, baseSessionId: baseId, cloneSessionId: null, done: false });
function project({ minDays = 0, blinding = false } = {}) {
  const steps = [
    step("o1", "Rater A", 1, "c1", "Case 1", "b1"), step("o1", "Rater A", 1, "c2", "Case 2", "b2"),
    step("o1", "Rater A", 2, "c1", "Case 1", "b1"), step("o1", "Rater A", 2, "c2", "Case 2", "b2"),
    step("o2", "Rater B", 1, "c1", "Case 1", "b1"),
  ];
  return {
    id: "p", sessions: [base("b1", "Patient 1"), base("b2", "Patient 2")], activeSessionId: "b1",
    researchStudies: [{
      id: "rel", name: "Rater study", type: "reliability",
      config: {
        minTimeSeparation: minDays, protocol: { occasions: 2, blindingEnforced: blinding },
        cases: [{ id: "c1", name: "Case 1", sessions: [{ sessionId: "b1", operatorId: "o1", occasion: 1 }, { sessionId: "b1", operatorId: "o1", occasion: 2 }, { sessionId: "b1", operatorId: "o2", occasion: 1 }] },
                { id: "c2", name: "Case 2", sessions: [{ sessionId: "b2", operatorId: "o1", occasion: 1 }, { sessionId: "b2", operatorId: "o1", occasion: 2 }] }],
        workflow: { active: true, steps, currentStep: 0, complete: false },
      },
    }],
  };
}
const wf = (p) => p.researchStudies[0].config.workflow;

describe("trial workflow steps", () => {
  it("opens a step in its own copy of the case's session, once", () => {
    let p = openStep(project(), "rel", 0, 1000);
    const s = wf(p).steps[0];
    expect(s.cloneSessionId).toBeTruthy();
    expect(p.activeSessionId).toBe(s.cloneSessionId);
    expect(s.startedAt).toBe(1000);
    const copy = p.sessions.find((x) => x.id === s.cloneSessionId);
    expect(copy.name).toBe("Case 1 · Rater A · trial 1");
    expect(copy.images[0].id).toBe("img-b1");
    // The case now points at the copy for this operator and trial only.
    const c1 = p.researchStudies[0].config.cases[0].sessions;
    expect(c1.find((x) => x.operatorId === "o1" && x.occasion === 1).sessionId).toBe(s.cloneSessionId);
    expect(c1.find((x) => x.operatorId === "o1" && x.occasion === 2).sessionId).toBe("b1");
    const again = openStep(p, "rel", 0);
    expect(again.sessions).toHaveLength(p.sessions.length);
    expect(stepForSession(again, s.cloneSessionId)).toMatchObject({ index: 0 });
  });

  it("creates the copy when marking done without opening, and keeps the active session", () => {
    const p = completeStep(project(), "rel", 1, 5000);
    expect(p.activeSessionId).toBe("b1");
    expect(wf(p).steps[1]).toMatchObject({ done: true, doneAt: 5000 });
    expect(wf(p).steps[1].cloneSessionId).toBeTruthy();
    expect(ensureStepSession(p, "rel", 1).sessionId).toBe(wf(p).steps[1].cloneSessionId);
  });

  it("finds the next open step, wrapping round, completes the workflow, and can undo done", () => {
    let p = project();
    for (const i of [0, 1, 2, 4]) p = completeStep(p, "rel", i);
    expect(nextOpenIndex(wf(p).steps, 4)).toBe(3);
    expect(wf(p).complete).toBe(false);
    p = completeStep(p, "rel", 3);
    expect(wf(p).complete).toBe(true);
    expect(nextOpenIndex(wf(p).steps, 3)).toBeNull();
    expect(workflowProgress(p.researchStudies[0])).toMatchObject({ done: 5, total: 5 });
    p = reopenStep(p, "rel", 3);
    expect(wf(p)).toMatchObject({ complete: false, currentStep: 3 });
  });

  it("asks for a handover between raters and warns when a later trial comes too soon", () => {
    let p = project({ minDays: 14 });
    p = completeStep(p, "rel", 0, 1000 * DAY);
    const st = p.researchStudies[0];
    expect(transition(st, 3, 4)).toMatchObject({ handover: true });
    expect(transition(st, 0, 1)).toMatchObject({ handover: false, tooSoon: null });
    expect(transition(st, 1, 2, 1003 * DAY).tooSoon).toMatchObject({ days: 3, minDays: 14 });
    expect(transition(st, 1, 2, 1015 * DAY).tooSoon).toBeNull();
  });
});

describe("the trial guide on the canvas", () => {
  const t = THEMES.dark;
  beforeEach(() => { dialogs.askConfirm.mockClear(); dialogs.askConfirm.mockResolvedValue(true); dialogs.notify.mockClear(); });
  afterEach(cleanup);
  // A stand-in for App's onUpdateProject (functional updates).
  const harness = (p) => {
    const state = { p };
    const onUpdate = vi.fn((fn) => { state.p = typeof fn === "function" ? fn(state.p) : fn; });
    return { state, onUpdate };
  };

  it("shows nothing outside a workflow's tracings", () => {
    const { container } = render(<TrialGuide t={t} project={project()} sessionId="b1" onUpdateProject={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("tells who traces what, and Done opens the next tracing", async () => {
    const p = openStep(project(), "rel", 0);
    const h = harness(p);
    render(<TrialGuide t={t} project={p} sessionId={p.activeSessionId} onUpdateProject={h.onUpdate} />);
    expect(screen.getByText("Rater A")).toBeTruthy();
    expect(screen.getByText("Trial 1 of 2")).toBeTruthy();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    fireEvent.click(screen.getByText("Done, next"));
    await waitFor(() => expect(h.state.p.activeSessionId).toBe(wf(h.state.p).steps[1].cloneSessionId));
    expect(wf(h.state.p).steps[0].done).toBe(true);
    expect(dialogs.askConfirm).not.toHaveBeenCalled();     // same rater: no handover
  });

  it("asks for a handover before another rater's tracing, and stays put if declined", async () => {
    let p = project();
    for (const i of [0, 1, 2]) p = completeStep(p, "rel", i);
    p = openStep(p, "rel", 3);
    dialogs.askConfirm.mockResolvedValue(false);
    const h = harness(p);
    render(<TrialGuide t={t} project={p} sessionId={p.activeSessionId} onUpdateProject={h.onUpdate} />);
    fireEvent.click(screen.getByText("Done, next"));
    await waitFor(() => expect(dialogs.askConfirm).toHaveBeenCalled());
    expect(dialogs.askConfirm.mock.calls[0][0]).toMatchObject({ title: "Hand over to Rater B", confirmLabel: "I'm Rater B, open it" });
    expect(wf(h.state.p).steps[3].done).toBe(true);           // the tracing is still marked done
    expect(h.state.p.activeSessionId).toBe(p.activeSessionId); // but the next isn't opened
  });

  it("moves backward and forward, lists every tracing, and announces the end", async () => {
    let p = project();
    for (const i of [0, 1, 2, 3]) p = completeStep(p, "rel", i);
    p = openStep(p, "rel", 4);
    const h = harness(p);
    render(<TrialGuide t={t} project={p} sessionId={p.activeSessionId} onUpdateProject={h.onUpdate} onOpenStudy={() => {}} />);
    fireEvent.click(screen.getByText("All tracings"));
    expect(screen.getAllByRole("button", { name: /T\d · Case/ })).toHaveLength(5);
    fireEvent.click(screen.getByLabelText("Previous tracing"));
    await waitFor(() => expect(h.state.p.activeSessionId).toBe(wf(h.state.p).steps[3].cloneSessionId));
    expect(dialogs.askConfirm.mock.calls[0][0].title).toBe("Hand over to Rater A");
    cleanup();
    const h2 = harness(p);
    render(<TrialGuide t={t} project={p} sessionId={p.activeSessionId} onUpdateProject={h2.onUpdate} onOpenStudy={() => {}} />);
    fireEvent.click(screen.getByText("Done, finish"));
    await waitFor(() => expect(dialogs.notify).toHaveBeenCalled());
    expect(dialogs.notify.mock.calls[0][0]).toMatch(/All 5 tracings are done/);
    expect(wf(h2.state.p).complete).toBe(true);
  });

  it("collapses to a one-line reminder", () => {
    const p = openStep(project(), "rel", 0);
    render(<TrialGuide t={t} project={p} sessionId={p.activeSessionId} onUpdateProject={() => {}} />);
    fireEvent.click(screen.getByLabelText("Hide the trial guide"));
    expect(screen.getByLabelText("Show the trial guide").textContent).toMatch(/Rater A · trial 1 · Case 1/);
  });
});
