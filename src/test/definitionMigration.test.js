import { describe, it, expect } from "vitest";
import { migrateMeasurementDefinitions, migrateNorms } from "../workspace/template.js";
import { useSessionStore } from "../state/sessionStore.js";
import { primaryMeasure } from "../lib/utils.js";
import { averageCeph, pointsToMarkups } from "./helpers/cephFixtures.js";

// A project saved before the definitions were corrected.
function legacyProject() {
  const P = averageCeph();
  const points = pointsToMarkups(P);
  const legacy = [
    { id: "ab", type: "angle4", label: "AB plane angle", measure: "AB plane angle", autoCreated: true, placed: true, visible: true,
      templateId: "Downs Analysis::AB plane angle", refLabels: ["A", "B", "Po", "Or"], points: [P.A, P.B, P.Po, P.Or], norm: { mean: -5, sd: 4 } },
    { id: "u1", type: "angle4", label: "U1-NA (°)", measure: "U1-NA (°)", autoCreated: true, placed: true, visible: true,
      templateId: "Steiner Analysis::U1-NA (°)", refLabels: ["Is", "Ia", "N", "A"], points: [P.Is, P.Ia, P.N, P.A], norm: { mean: 22, sd: 2 } },
    { id: "gone", type: "line", label: "N-B", autoCreated: true, placed: true, visible: true,
      templateId: "McNamara Analysis::N-B", refLabels: ["N", "B"], points: [P.N, P.B], norm: { mean: 4, sd: 3 } },
  ];
  return { markups: [...points, ...legacy], norms: [{ markupLabel: "AB plane angle", measureType: "angle", mean: -5, sd: 4 }] };
}

describe("definition migration for saved projects", () => {
  it("re-syncs auto-created measurements to corrected definitions", () => {
    const { markups } = legacyProject();
    const out = migrateMeasurementDefinitions(markups);
    const ab = out.find(m => m.id === "ab"), u1 = out.find(m => m.id === "u1");
    expect(ab.refLabels).toEqual(["A", "B", "N", "Pog"]);
    expect(ab.norm).toEqual({ mean: -4.6, sd: 3.7 });
    expect(u1.refLabels).toEqual(["Ia", "Is", "N", "A"]);
    const cal = { done: true, pxPerMm: 7 };
    expect(primaryMeasure(u1, cal, { facing: "right" }).value).toBeLessThan(45); // was ≈154°
    expect(primaryMeasure(ab, cal, { facing: "right" }).value).toBeLessThan(5);   // signed AB vs facial plane
  });

  it("leaves measurements whose definition was removed untouched", () => {
    const { markups } = legacyProject();
    const out = migrateMeasurementDefinitions(markups);
    expect(out.find(m => m.id === "gone")).toBe(markups.find(m => m.id === "gone"));
  });

  it("keeps a measurement whose new landmarks are not placed", () => {
    const { markups } = legacyProject();
    const withoutPog = markups.filter(m => m.label !== "Pog");
    const ab = migrateMeasurementDefinitions(withoutPog).find(m => m.id === "ab");
    expect(ab.refLabels).toEqual(["A", "B", "Po", "Or"]);
  });

  it("is applied when a session is opened, including its norm list", () => {
    useSessionStore.getState().loadFromSession(legacyProject());
    const st = useSessionStore.getState();
    expect(st.markups.find(m => m.id === "ab").refLabels).toEqual(["A", "B", "N", "Pog"]);
    expect(st.norms[0]).toMatchObject({ mean: -4.6, sd: 3.7 });
    expect(migrateNorms(st.norms, st.markups)).toBe(st.norms);
  });
});
