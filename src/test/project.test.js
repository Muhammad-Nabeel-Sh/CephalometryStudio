import { describe, it, expect } from "vitest";
import {
  updateSessionInProject,
  addSession,
  removeSession,
  duplicateSessionInProject,
} from "../model/project.js";
import { mkSession } from "../model/session.js";

function project() {
  const session = mkSession({ name: "A", images: [{ id: "imgA", dataUrl: null }] });
  return {
    id: "p1",
    modified: 0,
    activeSessionId: session.id,
    sessions: [session],
  };
}

describe("updateSessionInProject", () => {
  it("merges the patch and preserves untouched fields (e.g. images)", () => {
    const proj = project();
    const sid = proj.sessions[0].id;
    const next = updateSessionInProject(proj, sid, {
      calibration: { done: false, pxPerMm: 1, knownMm: "" },
    });
    // The image must survive a calibration-only patch — this is the invariant
    // that broke when two sequential updSession calls rebuilt from a stale
    // project and the second dropped the just-added image.
    expect(next.sessions[0].images).toEqual([{ id: "imgA", dataUrl: null }]);
    expect(next.sessions[0].calibration.pxPerMm).toBe(1);
  });

  it("is immutable (does not mutate the input project)", () => {
    const proj = project();
    const sid = proj.sessions[0].id;
    updateSessionInProject(proj, sid, { name: "B" });
    expect(proj.sessions[0].name).toBe("A");
  });
});

describe("session project operations", () => {
  it("addSession appends and makes it active", () => {
    const proj = project();
    const s = mkSession({ name: "B" });
    const next = addSession(proj, s);
    expect(next.sessions).toHaveLength(2);
    expect(next.activeSessionId).toBe(s.id);
  });

  it("removeSession keeps at least one session and reassigns active", () => {
    const proj = project();
    const next = removeSession(proj, proj.activeSessionId);
    // Cannot remove the last session.
    expect(next.sessions).toHaveLength(1);
  });

  it("duplicateSessionInProject keeps image ids so blobs stay resolvable", () => {
    const proj = project();
    const next = duplicateSessionInProject(proj, proj.activeSessionId);
    const dup = next.sessions[1];
    expect(dup.id).not.toBe(proj.sessions[0].id);
    expect(dup.images[0].id).toBe("imgA");
  });
});
