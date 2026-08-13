import { describe, it, expect } from "vitest";
import { runReliabilityAll } from "../research/reliability.js";
import { runDescriptiveAll } from "../research/descriptive.js";
import { runComparativeAll } from "../research/comparative.js";
import { runLongitudinalAll } from "../research/longitudinal.js";
import { unitForKey, dominantUnit } from "../research/collect.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: {}, ...opts };
}

function makePoint(label, x, y) {
  return { type: "point", label, points: [{ x, y }], visible: true, placed: true, id: `${label}_${Math.random().toString(36).slice(2)}` };
}

function makeAngle(label) {
  return { type: "angle3", label, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], visible: true, placed: true, id: `${label}_${Math.random().toString(36).slice(2)}` };
}

const CAL_MM = { done: true, pxPerMm: 1 };
const CAL_PX = { done: false, pxPerMm: 1 };

// ═══════════════════════════════════════════════════════════════════════════════
describe("unit helpers", () => {
  it("unitForKey routes angle keys to degrees and others to mm/px", () => {
    expect(unitForKey("angle", "mm")).toBe("°");
    expect(unitForKey("arcAngle", "px")).toBe("°");
    expect(unitForKey("length", "mm")).toBe("mm");
    expect(unitForKey("length", "px")).toBe("px");
  });

  it("dominantUnit ignores coordinate keys when a real measurement key exists", () => {
    const rows = [
      { measureKey: "x", unit: "px" },
      { measureKey: "y", unit: "px" },
      { measureKey: "angle", unit: "°" },
    ];
    expect(dominantUnit(rows)).toBe("°");
  });

  it("dominantUnit falls back to coordinate rows for pure point labels", () => {
    const rows = [
      { measureKey: "x", unit: "mm" },
      { measureKey: "y", unit: "mm" },
    ];
    expect(dominantUnit(rows)).toBe("mm");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
const cases = [
  { id: "C1", name: "Case 1", sessions: [{ sessionId: "s1", operatorId: "OP1", occasion: 1 }, { sessionId: "s2", operatorId: "OP2", occasion: 1 }] },
  { id: "C2", name: "Case 2", sessions: [{ sessionId: "s3", operatorId: "OP1", occasion: 1 }, { sessionId: "s4", operatorId: "OP2", occasion: 1 }] },
];
const reliabilityConfig = { labelIds: ["S"], cases, operators: ["OP1", "OP2"], protocol: { occasions: 1 }, design: "inter" };

describe("runReliabilityAll — details carry unit", () => {
  it("labels point measurements as px when uncalibrated", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 999)], { calibration: CAL_PX }),
      makeSession("s2", [makePoint("S", 102, 999)], { calibration: CAL_PX }),
      makeSession("s3", [makePoint("S", 200, 999)], { calibration: CAL_PX }),
      makeSession("s4", [makePoint("S", 203, 999)], { calibration: CAL_PX }),
    ];
    const result = runReliabilityAll(sessions, reliabilityConfig, CAL_PX);
    expect(result.details.find(d => d.label === "S")?.unit).toBe("px");
  });

  it("labels point measurements as mm when calibrated", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 999)], { calibration: CAL_MM }),
      makeSession("s2", [makePoint("S", 102, 999)], { calibration: CAL_MM }),
      makeSession("s3", [makePoint("S", 200, 999)], { calibration: CAL_MM }),
      makeSession("s4", [makePoint("S", 203, 999)], { calibration: CAL_MM }),
    ];
    const result = runReliabilityAll(sessions, reliabilityConfig, CAL_MM);
    expect(result.details.find(d => d.label === "S")?.unit).toBe("mm");
  });

  it("labels angle measurements as degrees regardless of calibration", () => {
    const sessions = [
      makeSession("s1", [makeAngle("SNA")], { calibration: CAL_PX }),
      makeSession("s2", [makeAngle("SNA")], { calibration: CAL_PX }),
      makeSession("s3", [makeAngle("SNA")], { calibration: CAL_PX }),
      makeSession("s4", [makeAngle("SNA")], { calibration: CAL_PX }),
    ];
    const result = runReliabilityAll(sessions, { ...reliabilityConfig, labelIds: ["SNA"] }, CAL_PX);
    expect(result.details.find(d => d.label === "SNA")?.unit).toBe("°");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("runDescriptiveAll — combined stats carry unit", () => {
  it("px when uncalibrated", () => {
    const sessions = [
      makeSession("a", [makePoint("S", 100, 200)], { calibration: CAL_PX }),
      makeSession("b", [makePoint("S", 102, 201)], { calibration: CAL_PX }),
      makeSession("c", [makePoint("S", 99, 199)], { calibration: CAL_PX }),
    ];
    const result = runDescriptiveAll(sessions, { labelIds: ["S"], groupBy: "none", referenceNorms: [] }, CAL_PX);
    expect(result.combined["S"]?.unit).toBe("px");
  });

  it("mm when calibrated", () => {
    const sessions = [
      makeSession("a", [makePoint("S", 100, 200)], { calibration: CAL_MM }),
      makeSession("b", [makePoint("S", 102, 201)], { calibration: CAL_MM }),
      makeSession("c", [makePoint("S", 99, 199)], { calibration: CAL_MM }),
    ];
    const result = runDescriptiveAll(sessions, { labelIds: ["S"], groupBy: "none", referenceNorms: [] }, CAL_MM);
    expect(result.combined["S"]?.unit).toBe("mm");
  });

  it("degrees for angles", () => {
    const sessions = [
      makeSession("a", [makeAngle("SNA")], { calibration: CAL_PX }),
      makeSession("b", [makeAngle("SNA")], { calibration: CAL_PX }),
      makeSession("c", [makeAngle("SNA")], { calibration: CAL_PX }),
    ];
    const result = runDescriptiveAll(sessions, { labelIds: ["SNA"], groupBy: "none", referenceNorms: [] }, CAL_PX);
    expect(result.combined["SNA"]?.unit).toBe("°");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("runComparativeAll — label results carry unit", () => {
  const comparativeConfig = {
    design: "independent",
    labelIds: ["S"],
    alpha: 0.05,
    mcCorrection: "bonferroni",
    groups: [
      { id: "G1", label: "Group 1", caseIds: ["s1", "s2"] },
      { id: "G2", label: "Group 2", caseIds: ["s3", "s4"] },
    ],
  };

  it("mm when calibrated", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 200)], { calibration: CAL_MM }),
      makeSession("s2", [makePoint("S", 102, 201)], { calibration: CAL_MM }),
      makeSession("s3", [makePoint("S", 300, 200)], { calibration: CAL_MM }),
      makeSession("s4", [makePoint("S", 302, 201)], { calibration: CAL_MM }),
    ];
    const result = runComparativeAll(sessions, comparativeConfig, CAL_MM);
    expect(result.labels["S"]?.unit).toBe("mm");
  });

  it("px when uncalibrated", () => {
    const sessions = [
      makeSession("s1", [makePoint("S", 100, 200)], { calibration: CAL_PX }),
      makeSession("s2", [makePoint("S", 102, 201)], { calibration: CAL_PX }),
      makeSession("s3", [makePoint("S", 300, 200)], { calibration: CAL_PX }),
      makeSession("s4", [makePoint("S", 302, 201)], { calibration: CAL_PX }),
    ];
    const result = runComparativeAll(sessions, comparativeConfig, CAL_PX);
    expect(result.labels["S"]?.unit).toBe("px");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("runLongitudinalAll — label results carry unit", () => {
  const longitudinalConfig = {
    labelIds: ["S"],
    sphericityCorrection: "greenhouse-geisser",
    modelType: "rm_anova",
    timepoints: [
      { id: "tp1", label: "Pre", targetAge: null, window: 90 },
      { id: "tp2", label: "Post", targetAge: null, window: 90 },
    ],
    subjects: [
      { id: "sub1", label: "Subject 1", records: { tp1: "a1", tp2: "a2" } },
      { id: "sub2", label: "Subject 2", records: { tp1: "b1", tp2: "b2" } },
      { id: "sub3", label: "Subject 3", records: { tp1: "c1", tp2: "c2" } },
    ],
  };

  it("mm when calibrated", () => {
    const sessions = [
      makeSession("a1", [makePoint("S", 100, 200)], { calibration: CAL_MM }),
      makeSession("a2", [makePoint("S", 110, 200)], { calibration: CAL_MM }),
      makeSession("b1", [makePoint("S", 120, 210)], { calibration: CAL_MM }),
      makeSession("b2", [makePoint("S", 130, 210)], { calibration: CAL_MM }),
      makeSession("c1", [makePoint("S", 140, 220)], { calibration: CAL_MM }),
      makeSession("c2", [makePoint("S", 150, 220)], { calibration: CAL_MM }),
    ];
    const result = runLongitudinalAll(sessions, longitudinalConfig, CAL_MM);
    expect(result.labels["S"]?.unit).toBe("mm");
    expect(result.labels["S"]?.changeScores?.[0]?.unit).toBe("mm");
  });

  it("px when uncalibrated", () => {
    const sessions = [
      makeSession("a1", [makePoint("S", 100, 200)], { calibration: CAL_PX }),
      makeSession("a2", [makePoint("S", 110, 200)], { calibration: CAL_PX }),
      makeSession("b1", [makePoint("S", 120, 210)], { calibration: CAL_PX }),
      makeSession("b2", [makePoint("S", 130, 210)], { calibration: CAL_PX }),
      makeSession("c1", [makePoint("S", 140, 220)], { calibration: CAL_PX }),
      makeSession("c2", [makePoint("S", 150, 220)], { calibration: CAL_PX }),
    ];
    const result = runLongitudinalAll(sessions, longitudinalConfig, CAL_PX);
    expect(result.labels["S"]?.unit).toBe("px");
  });
});
