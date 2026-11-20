// Landmark placement reliability (research/landmarkReliability.js + reliability.js).
import { describe, it, expect } from "vitest";
import { analyzeLandmarks, toStudyFrame, landmarkErrors, collectPlacements } from "../research/landmarkReliability.js";
import { runReliabilityAll } from "../research/reliability.js";
import { buildRData, buildRScript } from "../research/rScript.js";
import { buildDataMatrix } from "../research/dataPreview.js";
import { collectStudyWarnings } from "../research/studyWarnings.js";
import { resultsText, methodsText } from "../research/studyReport.js";

const pt = (label, x, y) => ({ id: `${label}-${x}-${y}`, type: "point", label, placed: true, visible: true, points: [{ x, y }] });
const sess = (id, pts, extra = {}) => ({ id, name: id, markups: pts.map(([l, x, y]) => pt(l, x, y)), calibration: { done: true, pxPerMm: 1 }, ...extra });
// S at (100,100), N at (170,100): S–N along +x, 70 mm. Gonion below and behind.
const skull = (dx = 0, dy = 0, go = [80, 180]) => [["S", 100, 100], ["N", 170, 100], ["Go", go[0] + dx, go[1] + dy]];

describe("coordinate frame", () => {
  it("puts S at the origin with x along S→N and y superior, from each case's mean S and N", () => {
    const sessions = [sess("a", skull()), sess("b", skull())];
    const config = { cases: [{ id: "c", name: "C", sessions: [{ sessionId: "a", operatorId: "o1", occasion: 1 }, { sessionId: "b", operatorId: "o1", occasion: 2 }] }], landmarkLabels: ["Go"] };
    const { placements, frames } = toStudyFrame(collectPlacements(sessions, config, null, ["S", "N", "Go"]), "SN");
    expect(frames.c).toBe("SN");
    const go = placements.find(p => p.label === "Go");
    expect(go.fx).toBeCloseTo(-20, 6);   // 20 mm behind S along S→N
    expect(go.fy).toBeCloseTo(-80, 6);   // 80 mm below (image y points down)
  });

  it("gives the same coordinates for a mirrored (left-facing) film", () => {
    const right = [sess("a", skull())];
    const left = [sess("a", [["S", 900, 100], ["N", 830, 100], ["Go", 920, 180]])];
    const config = { cases: [{ id: "c", name: "C", sessions: [{ sessionId: "a", operatorId: "o1", occasion: 1 }] }] };
    const f = (s) => toStudyFrame(collectPlacements(s, config, null, ["S", "N", "Go"]), "SN").placements.find(p => p.label === "Go");
    expect(f(left).fx).toBeCloseTo(f(right).fx, 6);
    expect(f(left).fy).toBeCloseTo(f(right).fy, 6);
  });
});

describe("placement errors", () => {
  // Two cases × two occasions (intra-rater). Go is placed 2 mm apart along x and 0 along y.
  const cases = [
    { id: "c1", name: "Case 1", sessions: [{ sessionId: "a1", operatorId: "o1", occasion: 1 }, { sessionId: "a2", operatorId: "o1", occasion: 2 }] },
    { id: "c2", name: "Case 2", sessions: [{ sessionId: "b1", operatorId: "o1", occasion: 1 }, { sessionId: "b2", operatorId: "o1", occasion: 2 }] },
  ];
  const sessions = [sess("a1", skull(-1, 0)), sess("a2", skull(1, 0)), sess("b1", skull(-1, 0, [60, 190])), sess("b2", skull(1, 0, [60, 190]))];
  const config = { design: "intra", cases, operators: [{ id: "o1", name: "Rater" }], landmarkLabels: ["Go"], landmarkFrame: "SN" };

  it("measures repeats within each case, per axis, with success rates and an ellipse along the error", () => {
    const { errors } = analyzeLandmarks(sessions, config, null, ["Go"]);
    const go = errors[0];
    expect(go).toMatchObject({ landmark: "Go", mode: "consensus", cases: 2, placements: 4, unit: "mm" });
    expect(go.meanPairDistance).toBeCloseTo(2, 6);
    expect(go.meanRadial).toBeCloseTo(1, 6);
    expect(go.sdX).toBeCloseTo(Math.SQRT2, 6);        // pooled: Σd² = 4, df = 2
    expect(go.sdY).toBeCloseTo(0, 6);
    expect(go.sdr[1]).toBe(1);
    expect(go.ellipse.minor).toBeCloseTo(0, 6);
    expect(Math.abs(go.ellipse.angle) % 180).toBeCloseTo(0, 6); // along x
  });

  it("feeds each landmark's x and y to the ICC analysis, tagged as coordinates", () => {
    const res = runReliabilityAll(sessions, config, null);
    expect(res.landmarks.rows[0].landmark).toBe("Go");
    const gx = res.details.find(d => d.label === "Go (x)");
    expect(gx).toMatchObject({ coordinate: true, landmark: "Go", axis: "x" });
    expect(gx.dahlberg).toBeCloseTo(Math.SQRT2, 6);   // matches SD x for duplicates
    expect(res.measurements).toBe(0);
    expect(res.landmarkPlacements).toBe(8);
  });

  it("measures against the reference rater in a method comparison, with the mean offset", () => {
    const mc = {
      design: "method_comparison", landmarkLabels: ["Go"],
      operators: [{ id: "ref", name: "Expert", role: "reference" }, { id: "ai", name: "AI" }],
      cases: [{ id: "c1", name: "Case 1", sessions: [{ sessionId: "r", operatorId: "ref", occasion: 1 }, { sessionId: "m", operatorId: "ai", occasion: 1 }] }],
    };
    const { errors } = analyzeLandmarks([sess("r", skull()), sess("m", skull(3, 4))], mc, null, ["Go"]);
    expect(errors[0]).toMatchObject({ mode: "reference", placements: 1 });
    expect(errors[0].meanRadial).toBeCloseTo(5, 6);
    expect(errors[0].biasX).toBeCloseTo(3, 6);
    expect(errors[0].biasY).toBeCloseTo(-4, 6);        // 4 mm lower: y is superior
    expect(errors[0].sdr[4]).toBe(0);
    expect(errors[0].sdr[2.5]).toBe(0);
  });

  it("explains a landmark it can't analyse, and uncalibrated or unframed cases", () => {
    const only = landmarkErrors([{ label: "Go", caseId: "c", operatorId: "o", fx: 0, fy: 0, unit: "mm" }], ["Go"], { design: "inter" });
    expect(only[0]).toMatchObject({ skip: true });
    const px = sessions.map(s => ({ ...s, calibration: { done: false, pxPerMm: 1 } }));
    const noS = sessions.map(s => ({ ...s, markups: s.markups.filter(m => m.label !== "S") }));
    const pxNotes = analyzeLandmarks(px, config, null, ["Go"]).summary.notes.join(" ");
    expect(pxNotes).toMatch(/in pixels/);
    expect(analyzeLandmarks(px, config, null, ["Go"]).errors[0].sdr).toBeNull();
    expect(analyzeLandmarks(noS, config, null, ["Go"]).summary.notes.join(" ")).toMatch(/no S or N/);
    const res = runReliabilityAll(px, config, null);
    expect(collectStudyWarnings({ type: "reliability", results: res }).map(w => w.text).join(" ")).toMatch(/in pixels/);
  });

  it("reaches the data preview, the R script, the write-up and stays out when no landmark is chosen", () => {
    const study = { type: "reliability", name: "Placement", config: { ...config, labelIds: [] }, results: runReliabilityAll(sessions, config, null) };
    expect(buildDataMatrix(study, sessions, null).columns.map(c => c.label)).toEqual(["Go (x)", "Go (y)"]);
    const data = buildRData(study, sessions, null);
    expect(data.rows.filter(r => r.measure === "Go (x)").map(r => r.case)).toEqual(["Case 1", "Case 1", "Case 2", "Case 2"]);
    expect(buildRScript(study, sessions, null)).toContain("mean_repeat_distance");
    expect(resultsText(study)).toMatch(/Go \(placement, 2 cases\): mean distance between repeated placements = 2\.00 mm/);
    expect(methodsText(study).html).toMatch(/Baumrind &amp; Frantz, 1971|Baumrind & Frantz, 1971/);
    expect(methodsText(study).refs).toContain("baumrind");
    const none = runReliabilityAll(sessions, { ...config, landmarkLabels: [] }, null);
    expect(none.landmarks).toBeNull();
  });
});
