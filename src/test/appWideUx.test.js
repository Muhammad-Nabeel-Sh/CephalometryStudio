import { describe, it, expect } from "vitest";
import { groupByPatient, searchPatients, patientOfCase, patientTimeline, isStudyCollection } from "../model/patients.js";
import { hitTest, FINGER_SLOP } from "../canvas/drawMarkups.js";
import { procrustesAlign } from "../lib/procrustes.js";
import { procrustesAlign as reExported } from "../research/superimposition.js";
import { PREF_KEYS } from "../state/uiStore.js";

const session = (id, label, extra = {}) => ({ id, label, name: label, timestamp: extra.timestamp || 0, markups: extra.markups || [], meta: { age: "", patientId: "", ...(extra.meta || {}) } });
const project = (id, meta, sessions, modified = 0, extra = {}) => ({ id, name: `Case ${id}`, projection: "lateral", modified, meta: { patientId: "", name: "", ...meta }, sessions, ...extra });

describe("C1 — patients on the home page", () => {
  const a1 = project("a1", { patientId: "P-7", name: "Sara" }, [session("s1", "T0", { meta: { age: "12" } })], 10);
  const a2 = project("a2", { patientId: "p-7" }, [session("s2", "T2", { meta: { age: "15" } }), session("s3", "T1", { meta: { age: "13" } })], 30, { projection: "ap" });
  const b = project("b", { name: "Omar" }, [session("s4", "T0")], 20);
  const anon = project("c", {}, [session("s5", "T0")], 5);
  const study = project("st", {}, [session("x1", "", { meta: { patientId: "A" } }), session("x2", "", { meta: { patientId: "B" } })], 1);

  it("groups cases by patient ID (case-insensitive), then by name", () => {
    const g = groupByPatient([a1, a2, b, anon, study]);
    expect(g.map(x => [x.kind, x.title, x.cases.length])).toEqual([
      ["patient", "Sara", 2], ["patient", "Omar", 1], ["case", "Case c", 1], ["study", "Case st", 1],
    ]);
    expect(patientOfCase(b)).toMatchObject({ key: "name:omar", name: "Omar" });
    expect(isStudyCollection(study)).toBe(true);
    expect(g.find(x => x.kind === "study").patientCount).toBe(2);
  });

  it("a patient's timeline runs oldest first across cases", () => {
    const tl = patientTimeline([a2, a1]);
    expect(tl.map(r => `${r.label}@${r.age}`)).toEqual(["T0@12", "T1@13", "T2@15"]);
    expect(tl[0]).toMatchObject({ projectId: "a1", sessionId: "s1" });
  });

  it("search matches every word across name, ID, cases and sessions", () => {
    const g = groupByPatient([a1, a2, b]);
    expect(searchPatients(g, "sara").map(x => x.title)).toEqual(["Sara"]);
    expect(searchPatients(g, "p-7 t2").map(x => x.title)).toEqual(["Sara"]);
    expect(searchPatients(g, "omar t2")).toHaveLength(0);
    expect(searchPatients(g, "  ")).toHaveLength(2);
  });
});

describe("C5 — touch hit radius", () => {
  const pt = { id: "p", type: "point", label: "S", points: [{ x: 100, y: 100 }] };
  it("a fingertip may land further from a point than a mouse", () => {
    expect(hitTest([pt], { x: 118, y: 100 }, 1)).toBeFalsy(); // mouse: 8 px + point size 6
    expect(hitTest([pt], { x: 118, y: 100 }, 1, undefined, FINGER_SLOP)).toBe("p");
  });
});

describe("C6 — procrustes lives in lib, same function for research", () => {
  it("is re-exported unchanged and still aligns a rotated shape", () => {
    expect(reExported).toBe(procrustesAlign);
    const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }];
    const dst = src.map(p => ({ x: -p.y + 3, y: p.x + 4 })); // rotate 90°, shift
    const tf = procrustesAlign(src, dst);
    expect(tf.rot).toBeCloseTo(Math.PI / 2, 6);
    expect(tf.tx).toBeCloseTo(3, 6);
    expect(tf.ty).toBeCloseTo(4, 6);
  });
});

describe("C3 — remembered preferences", () => {
  it("persists the display settings, including readable text", () => {
    for (const k of ["annotationSize", "labelLayout", "snapTolerance", "readableText", "showDefTooltips"]) expect(PREF_KEYS).toContain(k);
  });
});
