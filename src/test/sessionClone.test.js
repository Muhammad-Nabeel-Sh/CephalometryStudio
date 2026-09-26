import { describe, it, expect } from "vitest";
import { mkSession, duplicateSession, mkReliabilitySession } from "../model/session.js";

function sessionWithImage() {
  return mkSession({
    name: "S",
    images: [{ id: "img1", name: "x.png", dataUrl: null, transform: { tx: 0, ty: 0, rot: 0, scale: 1 } }],
    markups: [{ id: "m1", type: "point", label: "A", points: [{ x: 1, y: 1 }] }],
    formulas: [{ id: "f1", expr: "1+1" }],
    norms: [{ id: "n1", label: "SNA" }],
  });
}

describe("session cloning", () => {
  it("duplicateSession keeps image ids (shared blob) but regenerates object ids", () => {
    const s = sessionWithImage();
    const d = duplicateSession(s);
    // Image ids must be preserved: after a save the dataUrl is null and the
    // bytes live in IndexedDB keyed by id — a new id would never resolve.
    expect(d.images[0].id).toBe("img1");
    expect(d.markups[0].id).not.toBe("m1");
    expect(d.formulas[0].id).not.toBe("f1");
    expect(d.norms[0].id).not.toBe("n1");
    expect(d.name).toMatch(/Copy of/);
  });

  it("mkReliabilitySession keeps image ids and clears markups", () => {
    const r = mkReliabilitySession(sessionWithImage(), "op", 1);
    expect(r.images[0].id).toBe("img1");
    expect(r.markups).toEqual([]);
  });
});
