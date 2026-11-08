// Norm provenance (docs/NORM_AUDIT.md): every shipped analysis with norms names its
// source and whether that source published SDs; anything else is flagged.
import { describe, it, expect } from "vitest";
import csv from "../../Data/AnalysisMeasurements.csv?raw";
import { NORM_SOURCES, normSource, sdStatus } from "../data/normSources.js";
import { DEFAULT_NORMS, isApproximateSd } from "../data/norms.js";
import { generateInterpretation } from "../lib/interpretation.js";

const analysesWithNorms = () => {
  const out = new Set();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, "")) || [];
    if (cells.length >= 7 && cells[5].trim() !== "") out.add(cells[0]);
  }
  return out;
};

describe("norm sources", () => {
  it("cover every analysis that ships a norm, and every preset", () => {
    for (const a of analysesWithNorms()) expect(NORM_SOURCES[a], a).toBeTruthy();
    for (const k of Object.keys(DEFAULT_NORMS)) expect(normSource(k), k).toBeTruthy();
    for (const p of Object.values(DEFAULT_NORMS)) expect(normSource(p.source), p.source).toBeTruthy();
  });

  it("use only the three SD states, with a DOI only next to a PMID", () => {
    for (const [name, s] of Object.entries(NORM_SOURCES)) {
      expect(["published", "approximate", "unsourced"], name).toContain(s.sd);
      if (s.doi) expect(s.pmid, name).toBeTruthy();
    }
  });

  it("flag approximate and unsourced SDs but not published ones or the user's own norms", () => {
    expect(isApproximateSd("Steiner Analysis", "U1-NA", 2)).toBe(true);
    expect(isApproximateSd("Bimler Analysis", "Anything", 3)).toBe(true);
    expect(isApproximateSd("Downs Analysis", "Facial angle", 3.6)).toBe(false);
    expect(isApproximateSd("McNamara, 1984 / Am J Orthod", "Co-A", 4.3)).toBe(false);
    expect(isApproximateSd("My clinic norms", "SNA", 3)).toBe(false);
    // Steiner's ±2° copied into another table is still approximate.
    expect(sdStatus("Downs Analysis", "SNA", 2)).toBe("approximate");
  });

  it("carry the status into interpretation", () => {
    const meas = [{ m: { label: "SNA", type: "angle3" }, meas: { angle: 86 } }];
    const norms = [{ markupLabel: "SNA", measureType: "angle", mean: 82, sd: 3.5, source: "Lautrou Analysis" }];
    const d = generateInterpretation(meas, norms, { done: true, pxPerMm: 10 }).deviations[0];
    expect(d.sdApproximate).toBe(true);
    expect(d.sdStatus).toBe("unsourced");
  });
});
