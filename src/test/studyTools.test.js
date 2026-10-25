import { describe, it, expect } from "vitest";
import { nTwoMeans, nPaired, nCorrelation, nICC, nBlandAltman, zQuantile } from "../research/sampleSize.js";
import { buildDataMatrix, dataMatrixToCSV } from "../research/dataPreview.js";
import { makeSession, lineMarkup, angleMarkup, pointMarkup } from "./helpers/cephFixtures.js";

describe("sample size", () => {
  it("matches G*Power for t-tests and correlation", () => {
    expect(zQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(nTwoMeans(0.5)).toBe(64);
    expect(nTwoMeans(0.8)).toBe(26);
    expect(nPaired(0.5)).toBe(34);
    expect(nCorrelation(0.5)).toBe(30);
  });
  it("ICC (Walter, Eliasziw & Donner 1998) and Bland-Altman precision", () => {
    expect(nICC(0.8, 0.6, 2)).toBe(39);
    expect(nICC(0.6, 0.8, 2)).toBeNull(); // expected ICC must exceed H0
    expect(nBlandAltman(0.5)).toBe(47);
  });
});

describe("data preview", () => {
  const sessions = [
    makeSession("a", [pointMarkup("S", 1, 2), angleMarkup("SNA", 82), lineMarkup("S-N", 70)], { meta: { age: "12" } }),
    makeSession("b", [angleMarkup("SNA", 79)]),
  ];
  const study = { type: "comparative", name: "x", config: { labelIds: [], groups: [{ label: "G1", caseIds: ["a"] }, { label: "G2", caseIds: ["b", "gone"] }] } };

  it("shows each session's primary measurements, never coordinates", () => {
    const m = buildDataMatrix(study, sessions);
    expect(m.columns.map(c => c.label)).toEqual(["S-N", "SNA"]);
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0].values.SNA).toBeCloseTo(82, 9);
    expect(m.rows[1].values["S-N"]).toBeUndefined();
    expect(m.missingSessions).toBe(1);
    expect(m.rows[0].role).toBe("G1 · case 1");
  });

  it("exports a tidy CSV with units in the header", () => {
    const csv = dataMatrixToCSV(buildDataMatrix(study, sessions)).split("\n");
    expect(csv[0]).toBe("session_id,session,role,age,sex,group,S-N [mm],SNA [°]");
    expect(csv[1].startsWith("a,")).toBe(true);
    expect(csv[1]).toContain(",12,");
  });
});
