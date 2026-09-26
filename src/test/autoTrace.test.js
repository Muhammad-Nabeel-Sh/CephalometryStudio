import { describe, it, expect, vi } from "vitest";
import {
  findAnalysis,
  buildDetectionMarkups,
  applyDetections,
} from "../workspace/autoTrace.js";

const CAL = { done: false, pxPerMm: 1 };

function det(symbol, x, y, confidence = 0.8) {
  return { index: 0, symbol, x, y, confidence };
}

function makeStore(initial = []) {
  const store = {
    markups: initial,
    pushUndo: vi.fn(),
    updMarkups: (fn) => { store.markups = fn(store.markups); },
  };
  return store;
}

describe("findAnalysis", () => {
  it("finds an analysis by name across projections", () => {
    expect(findAnalysis("General Ceph Analysis")?.name).toBe("General Ceph Analysis");
    expect(findAnalysis("Steiner Analysis")?.name).toBe("Steiner Analysis");
  });

  it("returns null for blank/unknown templates", () => {
    expect(findAnalysis("blank")).toBeNull();
    expect(findAnalysis("")).toBeNull();
    expect(findAnalysis("Does Not Exist")).toBeNull();
  });
});

describe("buildDetectionMarkups — template-aware mapping", () => {
  it("keeps landmarks present in the General Ceph template and drops the rest", () => {
    const detections = [
      det("S", 10, 10), det("N", 20, 10), det("A", 15, 20), det("B", 15, 30),
      det("R", 40, 40), det("UIT", 12, 28), det("Ls", 5, 25),
    ];
    const { points, unmapped } = buildDetectionMarkups(detections, "General Ceph Analysis", [], "cepha29");
    expect(points.map(p => p.label).sort()).toEqual(["A", "B", "Is", "N", "S"]);
    expect(unmapped).toBe(2); // R has no app label, Ls→UL is not in this template
  });

  it("links points with the immutable templateId", () => {
    const { points } = buildDetectionMarkups([det("UIT", 1, 1)], "General Ceph Analysis", [], "cepha29");
    expect(points[0].templateId).toBe("General Ceph Analysis::Is");
    expect(points[0].templateLabel).toBe("Is");
  });

  it("resolves aliased soft-tissue/dental landmarks in a richer template", () => {
    const detections = [det("Ls", 1, 1), det("Li", 1, 2), det("UIA", 1, 3), det("LIA", 1, 4), det("Pog`", 1, 5), det("Pn", 1, 6)];
    const { points, unmapped } = buildDetectionMarkups(detections, "Steiner Analysis", [], "cepha29");
    expect(points.map(p => p.label).sort()).toEqual(["Ia", "Iia", "LL", "Pog'", "Prn", "UL"]);
    expect(unmapped).toBe(0);
  });

  it("maps the ISBI-19 symbols (U1/L1/UL/LL/Pog') by default", () => {
    const detections = [det("U1", 1, 1), det("L1", 1, 2), det("UL", 1, 3), det("LL", 1, 4), det("Pog'", 1, 5), det("S", 1, 6)];
    const { points, unmapped } = buildDetectionMarkups(detections, "Steiner Analysis");
    expect(points.map(p => p.label).sort()).toEqual(["Ii", "Is", "LL", "Pog'", "S", "UL"]);
    expect(unmapped).toBe(0);
  });

  it("skips landmarks already placed in the session", () => {
    const existing = [{ id: "x", type: "point", label: "N", placed: true, points: [{ x: 1, y: 1 }] }];
    const { points, skipped } = buildDetectionMarkups([det("S", 1, 1), det("N", 2, 2)], "General Ceph Analysis", existing);
    expect(points.map(p => p.label)).toEqual(["S"]);
    expect(skipped).toBe(1);
  });
});

describe("applyDetections — single undoable mutation", () => {
  it("inserts points, auto-creates measurements, and pushes one undo", () => {
    const store = makeStore([]);
    const summary = applyDetections(
      store,
      [det("S", 10, 10), det("N", 20, 10), det("A", 15, 20), det("B", 15, 30)],
      "General Ceph Analysis",
      CAL,
    );
    expect(summary.added).toBe(4);
    expect(summary.measurements).toBeGreaterThan(0);
    expect(store.pushUndo).toHaveBeenCalledTimes(1);
    const labels = store.markups.map(m => m.label);
    expect(labels).toEqual(expect.arrayContaining(["S", "N", "A", "B", "SNA", "SNB", "ANB"]));
  });

  it("does not push undo when nothing new is added", () => {
    const store = makeStore([
      { id: "s", type: "point", label: "S", placed: true, points: [{ x: 1, y: 1 }], templateLabel: "S" },
    ]);
    const summary = applyDetections(store, [det("S", 5, 5)], "General Ceph Analysis", CAL);
    expect(summary.added).toBe(0);
    expect(store.pushUndo).not.toHaveBeenCalled();
  });
});
