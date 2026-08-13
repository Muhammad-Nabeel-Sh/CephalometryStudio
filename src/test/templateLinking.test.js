import { describe, it, expect } from "vitest";
import { autoCreateMeasurements, getMeasValue } from "../workspace/template.js";
import { refreshAutoMeasurements, markupDefaults } from "../workspace/markupHelpers.js";

const CAL = { done: false, pxPerMm: 1 };

function pt(id, label, x, y, extra = {}) {
  return { id, type: "point", label, points: [{ x, y }], placed: true, visible: true, ...extra };
}

function witsPoints() {
  return [
    pt("pa", "A", 10, 10, { templateLabel: "A", templateId: "Wits Analysis::A" }),
    pt("pb", "B", 20, 10, { templateLabel: "B", templateId: "Wits Analysis::B" }),
    pt("pc", "APOcc", 10, 50, { templateLabel: "APOcc", templateId: "Wits Analysis::APOcc" }),
    pt("pd", "PPOcc", 40, 50, { templateLabel: "PPOcc", templateId: "Wits Analysis::PPOcc" }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
describe("autoCreateMeasurements — immutable templateId linking", () => {
  it("creates the Wits measurement and attaches refTemplateIds + its own templateId", () => {
    const created = autoCreateMeasurements(witsPoints(), "Wits Analysis", CAL);
    expect(created.length).toBe(1);
    const m = created[0];
    expect(m.type).toBe("projDist");
    expect(m.refLabels).toEqual(["A", "B", "APOcc", "PPOcc"]);
    expect(m.refTemplateIds).toEqual([
      "Wits Analysis::A",
      "Wits Analysis::B",
      "Wits Analysis::APOcc",
      "Wits Analysis::PPOcc",
    ]);
    expect(m.templateId).toBe("Wits Analysis::A-B distance");
  });

  it("still links a renamed landmark via its templateLabel", () => {
    const markups = witsPoints().map(m => m.label === "B" ? { ...m, label: "Supramentale" } : m);
    const created = autoCreateMeasurements(markups, "Wits Analysis", CAL);
    expect(created.length).toBe(1);
    expect(created[0].refLabels[1]).toBe("B");
    expect(created[0].refTemplateIds[1]).toBe("Wits Analysis::B");
  });

  it("skips a measurement only when the landmark is truly unidentifiable", () => {
    const markups = witsPoints().map(m => m.label === "B" ? { ...m, label: "Supramentale", templateLabel: undefined } : m);
    const created = autoCreateMeasurements(markups, "Wits Analysis", CAL);
    expect(created.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("refreshAutoMeasurements — rename-resilient resolution", () => {
  it("re-syncs geometry via refTemplateIds after point labels are renamed", () => {
    const angle = {
      id: "angle1", type: "angle3", label: "SNA",
      points: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      refLabels: ["A", "B", "C"],
      refTemplateIds: ["Gen::A", "Gen::B", "Gen::C"],
      visible: true,
    };
    const pts = [
      pt("pa", "A-renamed", 10, 10, { templateId: "Gen::A" }),
      pt("pb", "B", 20, 10, { templateId: "Gen::B" }),
      pt("pc", "C", 30, 10, { templateId: "Gen::C" }),
    ];
    const out = refreshAutoMeasurements([...pts, angle]);
    const a = out.find(m => m.id === "angle1");
    expect(a.points[0]).toEqual({ x: 10, y: 10 });
    expect(a.points[1]).toEqual({ x: 20, y: 10 });
    expect(a.points[2]).toEqual({ x: 30, y: 10 });
  });

  it("recomputes a sum whose referenced measurement label was renamed", () => {
    const sum = { id: "s1", type: "sum", label: "sum", computedValue: 5, refLabels: ["R1"], refTemplateIds: ["Wits Analysis::R1"], points: [], visible: true };
    const r1 = { id: "r1", type: "ratio", label: "R1 renamed", templateId: "Wits Analysis::R1", computedValue: 45, points: [], visible: true, placed: true };
    const out = refreshAutoMeasurements([r1, sum]);
    expect(out.find(m => m.id === "s1").computedValue).toBeCloseTo(45, 6);
  });

  it("still resolves legacy refLabels (no refTemplateIds) via templateLabel", () => {
    const angle = {
      id: "angle1", type: "angle3", label: "SNA",
      points: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
      refLabels: ["A", "B", "C"],
      visible: true,
    };
    const pts = [
      pt("pa", "A-renamed", 10, 10, { templateLabel: "A" }),
      pt("pb", "B", 20, 10, { templateLabel: "B" }),
      pt("pc", "C", 30, 10, { templateLabel: "C" }),
    ];
    const out = refreshAutoMeasurements([...pts, angle]);
    expect(out.find(m => m.id === "angle1").points[0]).toEqual({ x: 10, y: 10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("getMeasValue — returns the type's primary measure (not x-coordinate)", () => {
  it("returns the angle for angle3 markups", () => {
    const m = { type: "angle3", points: [{ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }] };
    expect(getMeasValue(m, CAL)).toBeCloseTo(90, 6);
  });

  it("returns the segment length for infinite lines (calibrated)", () => {
    const m = { type: "line", mode: "infinite", points: [{ x: 0, y: 0 }, { x: 300, y: 400 }] };
    expect(getMeasValue(m, { done: true, pxPerMm: 10 })).toBeCloseTo(50, 6);
  });

  it("returns the area for polygons", () => {
    const m = { type: "polygon", curveStyle: "linear", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
    expect(getMeasValue(m, CAL)).toBeCloseTo(50, 6);
  });

  it("returns the stored value for computed types", () => {
    expect(getMeasValue({ type: "ratio", computedValue: 0.5 }, CAL)).toBeCloseTo(0.5, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("refreshAutoMeasurements — computed values honor calibration", () => {
  const CALIBRATED = { done: true, pxPerMm: 10 };

  it("recomputes a difference in mm when calibrated", () => {
    const diff = { id: "d1", type: "difference", label: "MMD", computedValue: 0, refLabels: ["Co-Pog", "Co-A"], refTemplateIds: ["Mc::Co-Pog", "Mc::Co-A"], points: [], visible: true };
    const l1 = { id: "l1", type: "line", label: "Co-Pog", templateId: "Mc::Co-Pog", points: [{ x: 0, y: 0 }, { x: 300, y: 400 }], visible: true, placed: true };
    const l2 = { id: "l2", type: "line", label: "Co-A", templateId: "Mc::Co-A", points: [{ x: 0, y: 0 }, { x: 0, y: 100 }], visible: true, placed: true };
    const out = refreshAutoMeasurements([l1, l2, diff], CALIBRATED);
    expect(out.find(m => m.id === "d1").computedValue).toBeCloseTo(40, 6);
  });

  it("ratio is unit-independent", () => {
    const ratio = { id: "r1", type: "ratio", label: "ratio", computedValue: 0, refLabels: ["A", "B"], refTemplateIds: ["Mc::A", "Mc::B"], points: [], visible: true };
    const a = { id: "a", type: "line", label: "A", templateId: "Mc::A", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], visible: true, placed: true };
    const b = { id: "b", type: "line", label: "B", templateId: "Mc::B", points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], visible: true, placed: true };
    expect(refreshAutoMeasurements([a, b, ratio], CALIBRATED).find(m => m.id === "r1").computedValue).toBeCloseTo(2, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("markupDefaults — auto-link stores immutable refs", () => {
  const t = { acc: "#38bdf8" };

  it("stores refLabels + refTemplateIds from template points", () => {
    const markups = [
      pt("pn", "N", 100, 100, { templateLabel: "N", templateId: "Gen::N" }),
      pt("pa", "A", 100, 110, { templateLabel: "A", templateId: "Gen::A" }),
    ];
    const m = markupDefaults({ type: "line", points: [{ x: 100, y: 100 }, { x: 100, y: 110 }] }, markups, t);
    expect(m.refLabels).toEqual(["N", "A"]);
    expect(m.refTemplateIds).toEqual(["Gen::N", "Gen::A"]);
  });

  it("uses templateLabel (not the current label) so later renames don't break stored refs", () => {
    const markups = [
      pt("pn", "Nasion", 100, 100, { templateLabel: "N", templateId: "Gen::N" }),
      pt("pa", "PointA", 100, 110, { templateLabel: "A", templateId: "Gen::A" }),
    ];
    const m = markupDefaults({ type: "line", points: [{ x: 100, y: 100 }, { x: 100, y: 110 }] }, markups, t);
    expect(m.refLabels).toEqual(["N", "A"]);
    expect(m.refTemplateIds).toEqual(["Gen::N", "Gen::A"]);
  });

  it("falls back to the current label when the point is not templated", () => {
    const markups = [
      pt("pn", "Nasion", 100, 100),
      pt("pa", "PointA", 100, 110),
    ];
    const m = markupDefaults({ type: "line", points: [{ x: 100, y: 100 }, { x: 100, y: 110 }] }, markups, t);
    expect(m.refLabels).toEqual(["Nasion", "PointA"]);
    expect(m.refTemplateIds).toEqual([null, null]);
  });
});
