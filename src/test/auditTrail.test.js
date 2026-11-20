// R4: session audit trail and locking of a reliability study's trial sessions.
import { describe, it, expect, beforeEach } from "vitest";
import { auditChanges, appendAudit, describeAuditEntry, auditLines, lockStudy, unlockStudy, studyLockState, trialSessionIds, withoutLockedFields, setAuditActor, AUDIT_MERGE_MS } from "../model/audit.js";
import { updateSessionInProject, removeSession } from "../model/project.js";
import { duplicateSession, mkReliabilitySession } from "../model/session.js";
import { unsealSession } from "../research/blinding.js";
import { useSessionStore, setLockedEditHandler } from "../state/sessionStore.js";
import { collectStudyWarnings } from "../research/studyWarnings.js";
import { fingerprintStudy } from "../research/studyState.js";

const pt = (id, label, x, y) => ({ id, type: "point", label, placed: true, visible: true, points: [{ x, y }] });
const session = (id, extra = {}) => ({ id, name: id, markups: [pt(`${id}-s`, "S", 10, 10), pt(`${id}-n`, "N", 50, 10)], calibration: { done: true, pxPerMm: 10 }, images: [{ id: `img-${id}` }], ...extra });
const study = { id: "rel", name: "Rater study", type: "reliability", config: { cases: [{ id: "c1", name: "Case 1", sessions: [{ sessionId: "a", operatorId: "o1", occasion: 1 }, { sessionId: "b", operatorId: "o1", occasion: 2 }] }] } };
const project = () => ({ id: "p", sessions: [session("a"), session("b"), session("other")], activeSessionId: "a", researchStudies: [structuredClone(study)] });

beforeEach(() => setAuditActor("Dr Test"));

describe("audit entries", () => {
  it("records added, moved, renamed and removed markups, calibration, facing and a new image", () => {
    const s = session("a");
    const markups = [{ ...s.markups[0], points: [{ x: 12, y: 10 }] }, { ...s.markups[1], label: "Nasion" }, pt("x", "A", 1, 1)];
    const [m, cal, fac, img] = auditChanges(s, { markups, calibration: { done: true, pxPerMm: 12 }, facing: "left", images: [{ id: "new", name: "ceph2.dcm" }] }, { now: 1000 });
    expect(m).toMatchObject({ kind: "markups", by: "Dr Test", at: 1000, added: ["A"], moved: ["S"], renamed: ["N → Nasion"], removed: [] });
    expect(cal).toMatchObject({ kind: "calibration", from: 10, to: 12 });
    expect(fac).toMatchObject({ kind: "facing", from: "auto", to: "left" });
    expect(img).toMatchObject({ kind: "image", name: "ceph2.dcm" });
    expect(describeAuditEntry(m)).toBe("Added A; moved S; renamed N → Nasion");
  });

  it("ignores display-only changes: processing, frame switches and a new window on the same pixels", () => {
    const s = session("a", { images: [{ id: "f1", raw: { key: "raw:f1" } }] });
    expect(auditChanges(s, { processing: { brightness: 20 } })).toEqual([]);
    expect(auditChanges(s, { images: [{ id: "f2" }], stack: { frames: [], index: 1 } })).toEqual([]);
    expect(auditChanges(s, { images: [{ id: "f1b", raw: { key: "raw:f1" } }] })).toEqual([]);
    expect(auditChanges(s, { markups: s.markups })).toEqual([]);
  });

  it("merges a run of edits by the same person, and starts afresh after a pause or another person", () => {
    const e = (at, by, moved) => ({ at, by, kind: "markups", added: [], removed: [], moved, renamed: [], edited: [] });
    let log = appendAudit([], [e(0, "A", ["S"])]);
    log = appendAudit(log, [e(60_000, "A", ["N", "S"])]);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ at: 0, until: 60_000, moved: ["S", "N"] });
    log = appendAudit(log, [e(60_000 + AUDIT_MERGE_MS + 1, "A", ["Po"])]);
    log = appendAudit(log, [e(60_000 + AUDIT_MERGE_MS + 2, "B", ["Or"])]);
    expect(log.map(x => x.moved)).toEqual([["S", "N"], ["Po"], ["Or"]]);
    expect(auditLines(log)[0]).toMatch(/· B — Moved Or$/);
  });

  it("is written by every session edit, and can be skipped for migrations", () => {
    let p = project();
    p = updateSessionInProject(p, "a", { calibration: { done: true, pxPerMm: 11 } }, { now: 5 });
    expect(p.sessions[0].auditLog).toHaveLength(1);
    p = updateSessionInProject(p, "a", { calibration: { done: true, pxPerMm: 12 } }, { audit: false });
    expect(p.sessions[0].auditLog).toHaveLength(1);
    expect(p.sessions[0].calibration.pxPerMm).toBe(12);
  });
});

describe("locking a reliability study", () => {
  it("finds the trial sessions and locks only those, logging it on the study and each session", () => {
    expect(trialSessionIds({ config: { ...study.config, workflow: { steps: [{ cloneSessionId: "w1" }] } } })).toEqual(["a", "b", "w1"]);
    const p = lockStudy(project(), "rel", { now: 100 });
    const [a, b, other] = p.sessions;
    expect(a.lock).toMatchObject({ studyId: "rel", studyName: "Rater study", at: 100, by: "Dr Test" });
    expect(b.lock).toBeTruthy();
    expect(other.lock).toBeUndefined();
    expect(a.auditLog.at(-1)).toMatchObject({ kind: "lock", studyName: "Rater study" });
    expect(p.researchStudies[0].config.lock).toEqual({ at: 100, by: "Dr Test" });
    expect(studyLockState(p, p.researchStudies[0])).toMatchObject({ locked: true, lockedCount: 2, sessions: 2, unlocks: 0 });
  });

  it("refuses changes to measured data while locked, but not display settings", () => {
    let p = lockStudy(project(), "rel");
    const before = p.sessions[0];
    p = updateSessionInProject(p, "a", { markups: [], calibration: { done: false }, facing: "left", processing: { brightness: 30 }, lutMode: "magma" });
    const a = p.sessions[0];
    expect(a.markups).toBe(before.markups);
    expect(a.calibration).toBe(before.calibration);
    expect(a.facing).toBeUndefined();
    expect(a.processing).toEqual({ brightness: 30 });
    expect(a.lutMode).toBe("magma");
    expect(a.auditLog).toEqual(before.auditLog);
    expect(withoutLockedFields(before, { markups: [] }).refused).toEqual(["markups"]);
    expect(removeSession(p, "a")).toBe(p);
  });

  it("unlocks one session or the whole study, and reports unlocks with the results", () => {
    let p = lockStudy(project(), "rel", { now: 100 });
    p = unlockStudy(p, "rel", { sessionId: "a", now: 200 });
    expect(p.sessions[0].lock).toBeUndefined();
    expect(p.sessions[0].auditLog.at(-1)).toMatchObject({ kind: "unlock", at: 200 });
    expect(p.sessions[1].lock).toBeTruthy();
    expect(studyLockState(p, p.researchStudies[0])).toMatchObject({ locked: false, partly: true, unlocks: 1 });
    expect(p.researchStudies[0].config.lock).toBeTruthy();       // still partly locked
    p = unlockStudy(p, "rel", { now: 300 });
    expect(p.sessions.every(s => !s.lock)).toBe(true);
    expect(p.researchStudies[0].config.lock).toBeUndefined();
    const w = collectStudyWarnings(p.researchStudies[0]).map(x => x.text).join(" ");
    expect(w).toMatch(/unlocked 2 times/);
    const locked = collectStudyWarnings(lockStudy(project(), "rel").researchStudies[0]).map(x => x.text).join(" ");
    expect(locked).toMatch(/were locked on/);
  });

  it("doesn't make results look out of date", () => {
    const p = project();
    const sessions = p.sessions;
    expect(fingerprintStudy(lockStudy(p, "rel").researchStudies[0], sessions)).toBe(fingerprintStudy(p.researchStudies[0], sessions));
  });

  it("isn't copied with a session, while a frame stack is", () => {
    const s = { ...session("a"), lock: { studyId: "rel" }, auditLog: [{ kind: "lock" }], stack: { frames: [{ id: "f1" }, { id: "f2" }], index: 1 } };
    for (const copy of [duplicateSession(s), mkReliabilitySession(s, "o2", 2)]) {
      expect(copy.lock).toBeUndefined();
      expect(copy.auditLog).toBeUndefined();
      expect(copy.stack.frames.map(f => f.id)).toEqual(["f1", "f2"]);
    }
  });

  it("logs a broken blinding seal in the session's history", () => {
    const p = unsealSession(project(), "rel", "a", 50);
    expect(p.sessions[0].auditLog.at(-1)).toMatchObject({ kind: "unseal", studyName: "Rater study", at: 50 });
  });
});

describe("the canvas store while locked", () => {
  it("refuses edits and says why", () => {
    const told = [];
    setLockedEditHandler(lock => told.push(lock.studyName));
    const st = useSessionStore.getState();
    st.loadFromSession(session("a"));
    useSessionStore.setState({ lock: { studyId: "rel", studyName: "Rater study" } });
    const before = useSessionStore.getState().markups;
    st.updMarkups(ms => ms.slice(1));
    st.addMarkup(pt("z", "Z", 1, 1));
    st.delMarkup("a-s");
    st.merge({ markups: [], calibration: { done: false }, processing: { brightness: 5 } });
    expect(useSessionStore.getState().markups).toBe(before);
    expect(useSessionStore.getState().calibration.done).toBe(true);
    expect(useSessionStore.getState().processing).toEqual({ brightness: 5 });
    expect(told).toEqual(["Rater study", "Rater study", "Rater study"]);
    useSessionStore.setState({ lock: null });
    st.updMarkups(ms => ms.slice(1));
    expect(useSessionStore.getState().markups).toHaveLength(1);
    setLockedEditHandler(null);
  });
});
