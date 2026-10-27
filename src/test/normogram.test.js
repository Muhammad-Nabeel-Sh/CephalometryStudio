import { describe, it, expect } from "vitest";
import {
  bandOf, BANDS, percentileOf, formatPercentile, formatMeasure, normogramRows, comparisonValues, chartLayout,
} from "../lib/normogram.js";

// Angle at the vertex (second point) of 90°, and a 100 × 100 px square.
const angle = (label, deg) => {
  const r = (deg * Math.PI) / 180;
  return { id: label, label, type: "angle3", points: [{ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10 * Math.cos(r), y: 10 * Math.sin(r) }] };
};
const line = (label, len) => ({ id: label, label, type: "line", points: [{ x: 0, y: 0 }, { x: len, y: 0 }] });
const CAL = { done: true, pxPerMm: 10 };
const UNCAL = { done: false, pxPerMm: 1 };

describe("normogram — percentiles and bands", () => {
  it("percentiles are on a 0–100 scale (z = −0.30 ≈ 38%)", () => {
    expect(percentileOf(0)).toBeCloseTo(50, 4);
    expect(formatPercentile(percentileOf(-0.3))).toBe("38%");
    expect(formatPercentile(percentileOf(-3))).toBe("<1%");
    expect(formatPercentile(percentileOf(3))).toBe(">99%");
  });
  it("neutral bands", () => {
    expect(BANDS[bandOf(0.4)].label).toBe("Within 1 SD");
    expect(BANDS[bandOf(-1.5)].label).toBe("1–2 SD");
    expect(BANDS[bandOf(2.7)].label).toBe("Beyond 2 SD");
  });
  it("values keep their own unit", () => {
    expect(formatMeasure(82.04, "°")).toBe("82.0°");
    expect(formatMeasure(4.256, "mm")).toBe("4.26 mm");
    expect(formatMeasure(120, "mm²")).toBe("120.00 mm²");
    expect(formatMeasure(0.71, "")).toBe("0.71");
    expect(formatMeasure(64.2, "%")).toBe("64.2%");
  });
});

describe("normogram — rows", () => {
  const norms = [
    { markupLabel: "U1-SN", measureType: "angle", mean: 103, sd: 6, source: "Riolo" },
    { markupLabel: "SNA", measureType: "angle", mean: 82, sd: 2, source: "Steiner Analysis" },
    { markupLabel: "Wits", measureType: "length", mean: 0, sd: 1, source: "Jacobson" },
  ];
  const markups = [angle("U1-SN", 100), angle("SNA", 80), line("Wits", 20), { id: "p", label: "S", type: "point", points: [{ x: 0, y: 0 }] }];

  it("one row per measurement, skeletal before dental, with units and z-scores", () => {
    const { rows } = normogramRows(markups, norms, CAL, "right");
    expect(rows.map(r => r.label)).toEqual(["SNA", "Wits", "U1-SN"]);
    expect(rows.map(r => r.category)).toEqual(["skeletal", "skeletal", "dental"]);
    const sna = rows[0];
    expect(sna.unit).toBe("°");
    expect(sna.z).toBeCloseTo((80 - 82) / 2, 6);
    expect(sna.approxSd).toBe(true); // Steiner ±2° is approximate
    expect(rows[1]).toMatchObject({ unit: "mm" });
    expect(rows[1].value).toBeCloseTo(2, 6); // 20 px at 10 px/mm
  });

  it("uncalibrated distances are hidden, angles still shown", () => {
    const { rows, hiddenUncalibrated } = normogramRows(markups, norms, UNCAL, "right");
    expect(rows.map(r => r.label)).toEqual(["SNA", "U1-SN"]);
    expect(hiddenUncalibrated).toBe(1);
  });

  it("comparison values use the same norms", () => {
    const { rows } = normogramRows(markups, norms, CAL, "right");
    const other = [angle("SNA", 84), line("Wits", 10)];
    const cmp = comparisonValues(rows, other, CAL, "right");
    expect(cmp.SNA.z).toBeCloseTo(1, 6);
    expect(cmp.Wits.value).toBeCloseTo(1, 6);
    expect(cmp["U1-SN"]).toBeUndefined();
    expect(comparisonValues(rows, other, UNCAL, "right").Wits).toBeUndefined();
  });

  it("chart layout adds a header row per category", () => {
    const { rows } = normogramRows(markups, norms, CAL, "right");
    const { items, bottom } = chartLayout(rows, 50, 30, 20);
    expect(items.map(i => (i.kind === "header" ? `[${i.cat}]` : i.row.label))).toEqual(["[skeletal]", "SNA", "Wits", "[dental]", "U1-SN"]);
    expect(bottom).toBe(50 + 2 * 20 + 3 * 30);
  });
});
