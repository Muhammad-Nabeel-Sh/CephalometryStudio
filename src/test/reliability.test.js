import { describe, it, expect } from "vitest";
import { runReliabilityAll } from "../research/reliability.js";
import { lineMarkup, angleMarkup } from "./helpers/cephFixtures.js";

function makeSession(id, markups, opts = {}) {
  return { id, markups, calibration: { done: true, pxPerMm: 1 }, meta: { group: "", timepoint: "" }, ...opts };
}

function makePoint(label, x, y) {
  return { type: "point", label, points: [{ x, y }], visible: true, placed: true, id: `${label}_${Date.now()}_${Math.random()}` };
}

const cases = [
  { id: "C1", name: "Case 1", sessions: [{ sessionId: "s1", operatorId: "OP1", occasion: 1 }, { sessionId: "s2", operatorId: "OP2", occasion: 1 }] },
  { id: "C2", name: "Case 2", sessions: [{ sessionId: "s3", operatorId: "OP1", occasion: 1 }, { sessionId: "s4", operatorId: "OP2", occasion: 1 }] },
];

describe("runReliabilityAll", () => {
  it("returns empty details when no cases defined", () => {
    const result = runReliabilityAll([], { labelIds: [], cases: [], operators: [] });
    expect(result.details).toEqual([]);
    expect(result.measurements).toBe(0);
  });

  it("returns ICC for a single measurement across two operators", () => {
    const sessions = [
      makeSession("s1", [lineMarkup("S-N", 100)]),
      makeSession("s2", [lineMarkup("S-N", 102)]),
      makeSession("s3", [lineMarkup("S-N", 200)]),
      makeSession("s4", [lineMarkup("S-N", 203)]),
    ];
    const config = { labelIds: ["S-N"], cases, operators: ["OP1", "OP2"], protocol: { occasions: 1 }, design: "inter" };
    const result = runReliabilityAll(sessions, config, { done: true, pxPerMm: 1 });

    expect(result.measurements).toBeGreaterThan(0);
    expect(result.details.length).toBeGreaterThan(0);
    const s = result.details.find(d => d.label === "S-N");
    expect(s).toBeDefined();
    expect(s.icc).toBeGreaterThan(0);
    expect(s.dahlberg).toBeGreaterThan(0);
    expect(s.nSubjects).toBe(2);
  });

  it("returns landmark error map", () => {
    const sessions = [
      makeSession("s1", [makePoint("A", 100, 200)]),
      makeSession("s2", [makePoint("A", 101, 201)]),
      makeSession("s3", [makePoint("A", 99, 199)]),
      makeSession("s4", [makePoint("A", 100, 200)]),
    ];
    const config = { labelIds: ["A"], cases, operators: ["OP1", "OP2"], protocol: { occasions: 1 }, design: "inter" };
    const result = runReliabilityAll(sessions, config);

    expect(result.landmarkMap).toBeDefined();
    expect(result.landmarkMap.A).toBeDefined();
    expect(result.landmarkMap.A.n).toBe(4);
    expect(result.landmarkMap.A.meanError).toBeGreaterThan(0);
    expect(result.landmarkMap.A.centroid.x).toBeCloseTo(100, 0);
  });
});

describe("runReliabilityAll — analyzes the measurement, not coordinates", () => {
  // Regression: ICC/Dahlberg used to pool the first point's x/y pixel position
  // with the angle. Identical angles drawn at different image positions must be
  // perfectly reliable.
  it("identical angles at different positions → ICC 1, Dahlberg 0", () => {
    const sessions = [], cases = [];
    for (let c = 0; c < 8; c++) {
      const ids = [`r${c}_1`, `r${c}_2`];
      sessions.push(makeSession(ids[0], [angleMarkup("SNA", 78 + c, { cx: 300 })]));
      sessions.push(makeSession(ids[1], [angleMarkup("SNA", 78 + c, { cx: 300 + 40 * c, cy: 250 })]));
      cases.push({ id: `C${c}`, name: `C${c}`, sessions: ids.map((sessionId, i) => ({ sessionId, operatorId: "OP1", occasion: i + 1 })) });
    }
    const r = runReliabilityAll(sessions, { labelIds: ["SNA"], cases, design: "intra", iccModel: "icc2" });
    const d = r.details.find(x => x.label === "SNA");
    expect(d.nSubjects).toBe(8);
    expect(d.nPairs).toBe(8);
    expect(d.icc).toBeCloseTo(1, 6);
    expect(d.dahlberg).toBeCloseTo(0, 6);
    expect(d.meanDiff).toBeCloseTo(0, 6);
    expect(d.unit).toBe("°");
  });

  it("landmark-only studies still report the placement error map", () => {
    const sessions = [
      makeSession("s1", [makePoint("A", 100, 200)]),
      makeSession("s2", [makePoint("A", 103, 204)]),
    ];
    const cases = [{ id: "C1", name: "C1", sessions: [{ sessionId: "s1", operatorId: "OP1", occasion: 1 }, { sessionId: "s2", operatorId: "OP2", occasion: 1 }] }];
    const r = runReliabilityAll(sessions, { labelIds: ["A"], cases, design: "inter" });
    expect(r.details).toEqual([]);
    expect(r.landmarkMap.A.n).toBe(2);
    expect(r.landmarkMap.A.meanError).toBeCloseTo(2.5, 6);
  });
});
