import { describe, it, expect } from "vitest";
import { synthesizeDiagnosis, generateInterpretation } from "../lib/interpretation.js";

const dev = (label, zScore, measureType = "angle") => ({ label, zScore, measureType });

describe("diagnostic synthesis", () => {
  it("Class II from a retrusive mandible, high angle, with lower-incisor compensation", () => {
    const d = synthesizeDiagnosis([
      dev("ANB", 2.1), dev("A-B distance", 1.8, "projectedDistance"), dev("SNA", 0.3), dev("SNB", -1.6),
      dev("FMA", 1.5), dev("SN-GoMe", 1.2), dev("IMPA", 1.6), dev("U1-NA (°)", 0.2),
    ]);
    expect(d.skeletalClass).toBe("II");
    expect(d.statements[0]).toBe("Skeletal Class II due to mandibular retrusion.");
    expect(d.statements[1]).toMatch(/Hyperdivergent/);
    expect(d.statements[2]).toMatch(/lower incisors proclined/);
    expect(d.disagreements).toEqual([]);
  });

  it("Class III from maxillary retrusion; a more negative AB-plane angle is not Class III", () => {
    const d = synthesizeDiagnosis([dev("ANB", -2.4), dev("AB plane angle", 1.9), dev("SNA", -1.8), dev("SNB", 0.4)]);
    expect(d.skeletalClass).toBe("III");
    expect(d.statements[0]).toBe("Skeletal Class III due to maxillary retrusion.");
  });

  it("flags ANB and Wits disagreeing, with the SN-FH context", () => {
    const d = synthesizeDiagnosis([dev("ANB", 0.2), dev("Wits", 2.5, "projectedDistance"), dev("SN-FH", 1.8)]);
    expect(d.disagreements.join(" ")).toMatch(/ANB .* and Wits .* disagree.*SN-FH is \+1\.8 SD/);
  });

  it("appears first among the interpretation patterns", () => {
    const allMeas = [
      { m: { label: "ANB" }, meas: { angle: 6, _unit: "mm" } },
      { m: { label: "SNB" }, meas: { angle: 75, _unit: "mm" } },
    ];
    const norms = [
      { markupLabel: "ANB", measureType: "angle", mean: 2, sd: 2 },
      { markupLabel: "SNB", measureType: "angle", mean: 80, sd: 2 },
    ];
    const { patterns } = generateInterpretation(allMeas, norms, { done: true, pxPerMm: 1 });
    expect(patterns[0].id).toBe("diagnostic-summary");
    expect(patterns[0].summary).toMatch(/Class II due to mandibular retrusion/);
  });
});
