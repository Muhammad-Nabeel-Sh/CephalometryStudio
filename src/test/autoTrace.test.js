import { describe, it, expect, vi } from "vitest";
import {
  findAnalysis,
  buildDetectionMarkups,
  applyDetections,
} from "../workspace/autoTrace.js";
import { PREDEFINED } from "../data/constants.js";
import { CEPHA29 } from "../data/landmarkMap.js";
import { analysisCoverage, applyAnalysis } from "../workspace/template.js";

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
    expect(unmapped).toBe(2); // R and UL are not defined by General Ceph
  });

  it("drops landmarks not defined by a restrictive template", () => {
    const detections = [det("S", 1, 1), det("N", 2, 2), det("A", 3, 3), det("B", 4, 4), det("UIT", 5, 5)];
    const { points, unmapped } = buildDetectionMarkups(detections, "Wits Analysis", [], "cepha29");
    expect(points.map(p => p.label).sort()).toEqual(["A", "B", "N"]); // Wits: A,B,Po,Or,Ba,N,APOcc,PPOcc
    expect(unmapped).toBe(2); // S and Is are not in Wits
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

  it("maps the ISBI-19 symbols (U1/L1/UL/LL/Pog') when the set is isbi19", () => {
    const detections = [det("U1", 1, 1), det("L1", 1, 2), det("UL", 1, 3), det("LL", 1, 4), det("Pog'", 1, 5), det("S", 1, 6)];
    const { points, unmapped } = buildDetectionMarkups(detections, "Steiner Analysis", [], "isbi19");
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

  // The re-trace retry clears the previous AI points before re-detecting, and
  // pushes its own snapshot first. Without suppressUndo the insert would land on
  // a *second* history step, so undoing once would show a session with no
  // landmarks instead of the trace the user was replacing.
  it("honours suppressUndo so a re-trace stays on one history step", () => {
    const store = makeStore([]);
    const summary = applyDetections(store, [det("S", 10, 10)], null, CAL, "cepha29", true);
    expect(summary.added).toBe(1);
    expect(store.pushUndo).not.toHaveBeenCalled();
    expect(store.markups).toHaveLength(1);
  });
});

describe("decoupled auto-trace (no template)", () => {
  it("places all 29 CEPHA29 landmarks when no template is given", () => {
    const detections = CEPHA29.map((l, i) => det(l.symbol, i, i));
    const { points, unmapped } = buildDetectionMarkups(detections, null, [], "cepha29");
    expect(points).toHaveLength(29);
    expect(unmapped).toBe(0);
    expect(points.every(p => p.placed)).toBe(true);
  });

  it("applyDetections with no template places points but creates no measurements", () => {
    const store = makeStore([]);
    const detections = CEPHA29.map((l, i) => det(l.symbol, i, i));
    const summary = applyDetections(store, detections, null, CAL, "cepha29");
    expect(summary.added).toBe(29);
    expect(summary.measurements).toBe(0);
  });

  // Provenance: the raw heatmap score and the PSR-derived confidence must both
  // survive into the markup so a later quality audit can tell "the model saw a
  // strong peak" apart from "the peak beat its own noise floor".
  it("records aiConfidence and aiScore provenance on every placed point", () => {
    const store = makeStore([]);
    const detections = CEPHA29.map((l, i) => ({ ...det(l.symbol, i, i, 0.42 + i / 100), score: 12.5 + i }));
    applyDetections(store, detections, null, CAL, "cepha29");
    expect(store.markups).toHaveLength(29);
    for (const m of store.markups) {
      expect(m.aiPlaced).toBe(true);
      expect(typeof m.aiConfidence).toBe("number");
      expect(typeof m.aiScore).toBe("number");
    }
  });

  it("tags every AI point with aiPlaced even without a confidence value", () => {
    // The re-trace retry clears points by this tag, so it must be present even
    // when the backend reports no confidence.
    const store = makeStore([]);
    applyDetections(store, [{ index: 0, symbol: "S", x: 1, y: 1 }], null, CAL, "cepha29");
    expect(store.markups[0].aiPlaced).toBe(true);
    expect(store.markups[0].aiConfidence).toBeUndefined();
  });

  it("omits provenance fields when the backend reports no confidence", () => {
    const store = makeStore([]);
    applyDetections(store, [{ index: 0, symbol: "S", x: 1, y: 1 }], null, CAL, "cepha29");
    expect(store.markups[0].aiConfidence).toBeUndefined();
    expect(store.markups[0].aiScore).toBeUndefined();
  });
});

describe("analysisCoverage / applyAnalysis", () => {
  const aiPoints = CEPHA29.map((l, i) => ({
    id: l.symbol, type: "point", label: l.app, templateLabel: l.app,
    placed: true, points: [{ x: i + 1, y: i + 1 }],
  }));
  const steiner = PREDEFINED.lateral.find((a) => a.name === "Steiner Analysis");

  it("reports which analysis landmarks still need manual placement", () => {
    const cov = analysisCoverage(steiner, aiPoints);
    expect(cov.total).toBe(steiner.pts.length);
    expect(cov.have).toBe(cov.total - cov.missing.length);
    // APOcc/PPOcc are not part of the model's 29 outputs
    expect(cov.missing).toEqual(expect.arrayContaining(["APOcc", "PPOcc"]));
  });

  it("queues missing landmarks and creates only measurements with all refs placed", () => {
    const res = applyAnalysis(aiPoints, steiner, CAL);
    expect(res.missing.map((m) => m.label).sort()).toEqual(["APOcc", "PPOcc"]);
    expect(res.measurements.length).toBeGreaterThan(0);
    const placedLabels = new Set(aiPoints.map((p) => p.label));
    for (const m of res.measurements) {
      for (const rl of m.refLabels || []) expect(placedLabels.has(rl)).toBe(true);
    }
    expect(res.norms.length).toBeGreaterThan(0);
  });
});
