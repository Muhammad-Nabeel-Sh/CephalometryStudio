// ═══════════════════════════════════════════════════════════════════════════════
// Airway computation: registry + markups + patient → results with provenance.
// Results describe the film. Nothing here diagnoses or scores a risk.
// ═══════════════════════════════════════════════════════════════════════════════

import { sampleSpline, vpts } from "../lib/utils.js";
import { signedAngle3 } from "../lib/measureConventions.js";
import { AIRWAY_LANDMARKS, AIRWAY_MEASURES, AIRWAY_WALLS, isWallNeed, measureAppliesToAge } from "./definitions.js";
import { reference, skeletalClassFromAnb } from "./norms.js";

export const AIRWAY_NOTICE = "These results describe a 2D film. They don't diagnose airway disease or sleep apnea, and a result within range doesn't rule them out.";
export const AIRWAY_METHOD = 2;

// "M", "male", "Male" → "M"; "F", "female" → "F"; anything else → null.
export function normalizeSex(sex) {
  const c = String(sex ?? "").trim().charAt(0).toUpperCase();
  return c === "M" || c === "F" ? c : null;
}

// Age in years, or null for empty / non-numeric values ("" is not age 0).
export function normalizeAge(age) {
  if (age === null || age === undefined || String(age).trim() === "") return null;
  const a = Number(age);
  return Number.isFinite(a) && a >= 0 ? a : null;
}

// A placed, visible point with this landmark's label. Only points count, so a line
// that shares a landmark's name can't replace it.
export function findLandmark(markups, id) {
  const def = AIRWAY_LANDMARKS[id];
  const names = [def.label, ...(def.aliases || [])].map(n => n.toLowerCase());
  for (const m of markups || []) {
    if (m.type !== "point" || m.visible === false || m.placed === false) continue;
    const label = String(m.label || "").toLowerCase(), tpl = String(m.templateLabel || "").toLowerCase();
    if (!names.includes(label) && !names.includes(tpl)) continue;
    const p = vpts(m)[0];
    if (p) return { x: p.x, y: p.y };
  }
  return null;
}

// Traced walls are found by role, never by label text. Sampled the way they're drawn.
export function findWall(markups, role) {
  const m = (markups || []).find(k => k.airwayRole === role && k.visible !== false);
  if (!m) return null;
  const pts = vpts(m);
  if (role === "adenoid") return pts.length >= 3 ? (m.curveStyle === "bspline" ? sampleSpline(pts, true, 16) : pts) : null;
  if (pts.length < 2) return null;
  return m.curveStyle === "bspline" && pts.length >= 3 ? sampleSpline(pts, false, 16) : pts;
}

function needsLabel(need) {
  if (need === "adenoid") return "Adenoid area";
  return AIRWAY_WALLS[need]?.label || AIRWAY_LANDMARKS[need]?.label || need;
}

function gather(markups, needs) {
  const ctx = {}, missing = [];
  for (const need of needs) {
    const v = isWallNeed(need) ? findWall(markups, need) : findLandmark(markups, need);
    if (v) ctx[need] = v;
    else missing.push(need);
  }
  return { ctx, missing };
}

function compareWithReference(ref, value) {
  if (ref.kind === "medianIqr") {
    return { zScore: null, state: "typical", text: `Median ${ref.median.toFixed(1)} mm, middle half spans about ${ref.iqr.toFixed(1)} mm` };
  }
  const digits = ref.mean < 1 ? 2 : 1;
  const stated = ref.sd === null ? `Mean ${ref.mean.toFixed(digits)}` : `${ref.mean.toFixed(digits)} ± ${ref.sd.toFixed(digits)}`;
  if (ref.sd === null) return { zScore: null, state: "typical", text: stated };
  const zScore = (value - ref.mean) / ref.sd;
  return { zScore, state: Math.abs(zScore) <= 2 ? "within" : "outside", text: stated };
}

function magnificationNote(ref, calibration) {
  const factor = ref?.source?.magnification;
  if (!factor) return null;
  const pct = Math.round(factor * 1000) / 10;
  return calibration?.magnificationCorrected
    ? `The reference includes ${pct}% enlargement, and this film's calibration removes it, so values read about ${pct}% lower by comparison.`
    : null;
}

function measureRow(measure, markups, calibration, patient) {
  const calDone = calibration?.done === true;
  const ppm = calDone ? (calibration.pxPerMm || 1) : 1;
  const base = {
    id: measure.id, label: measure.label, short: measure.short || measure.label, region: measure.region,
    method: measure.method, dim: measure.dim, value: null, unit: measure.dim === "ratio" ? "" : measure.dim === "area" ? (calDone ? "mm²" : "px²") : (calDone ? "mm" : "px"),
    zScore: null, state: "none", normMean: null, normSD: null, normSource: null, referenceText: null,
    line: null, methodVersion: AIRWAY_METHOD,
  };
  const { ctx, missing } = gather(markups, measure.needs);
  if (missing.length) return { ...base, missing, interpretation: `Needs ${missing.map(needsLabel).join(", ")}` };

  let out;
  try { out = measure.compute(ctx); } catch { out = { why: "Couldn't be measured" }; }
  if (out.why) return { ...base, interpretation: out.why };

  const value = measure.dim === "ratio" ? out.value : measure.dim === "area" ? out.px / (ppm * ppm) : out.px / ppm;
  const row = { ...base, value, line: out.line || null, rawPx: out.px ?? null };
  if (measure.dim !== "ratio" && !calDone) return { ...row, interpretation: "Calibrate to compare" };

  if (patient.film?.posture === "supine") return { ...row, interpretation: "No reference: the references are upright films" };
  const ref = reference.lookup(measure.id, patient);
  if (ref.reason) return { ...row, interpretation: ref.reason };

  const cmp = compareWithReference(ref, value);
  return {
    ...row,
    zScore: cmp.zScore,
    state: cmp.state,
    normMean: ref.mean ?? ref.median ?? null,
    normSD: ref.sd ?? null,
    normSource: ref.source.cite,
    referenceText: cmp.text,
    referenceGroup: ref.group,
    referenceSample: ref.source.sample,
    referenceWhere: ref.source.where,
    referenceWarning: ref.warning || null,
    magnificationNote: magnificationNote(ref, calibration),
    interpretation: cmp.state === "within" ? "Within reference range" : cmp.state === "outside" ? "Outside reference range" : "Typical range shown; individual variation is high",
  };
}

// Statements published by the paper's authors, quoted with their source. Never verdicts.
function citedCues(rows) {
  const get = id => rows.find(r => r.id === id)?.value ?? null;
  const cues = [];
  const an = get("an-ratio");
  if (an !== null && an > 0.8) cues.push({ id: "an", text: "Fujioka 1979 considers an A/N ratio above 0.80 indicative of enlarged adenoids." });
  const upper = [get("mcnamara-upper"), get("mislik-p")].filter(v => v !== null);
  if (rows.some(r => (r.id === "mcnamara-upper" || r.id === "mislik-p") && r.unit === "mm") && upper.some(v => v <= 5)) {
    cues.push({ id: "upper", text: "McNamara 1984 uses an upper pharyngeal opening of 5 mm or less only as an indicator of possible airway impairment; diagnosis needs an otorhinolaryngologist." });
  }
  const lower = get("mcnamara-lower");
  if (lower !== null && rows.find(r => r.id === "mcnamara-lower")?.unit === "mm" && lower > 15) {
    cues.push({ id: "lower", text: "McNamara 1984: a lower pharyngeal width above 15 mm suggests anterior tongue position, from habit or enlarged tonsils." });
  }
  return cues;
}

// Major 2006: look for several deviant adenoid and nasopharyngeal measures rather than
// one. Two or more in the direction of concern brings up the suggestion.
function nasopharyngealPattern(rows, patient) {
  if (patient.age === null || patient.age >= 18) return null;
  const relevant = AIRWAY_MEASURES.filter(m => m.concern).map(m => ({ m, row: rows.find(r => r.id === m.id) })).filter(x => x.row && x.row.zScore !== null);
  const flagged = relevant.filter(({ m, row }) => (m.concern === "high" ? row.zScore > 2 : row.zScore < -2));
  if (relevant.length < 2 || flagged.length < 2) return null;
  return {
    flagged: flagged.map(x => x.row.label),
    total: relevant.length,
    text: `${flagged.length} of ${relevant.length} adenoid and nasopharyngeal measures are outside the reference range in the direction of a smaller airway. Consider ENT evaluation if there are clinical signs (Major 2006).`,
  };
}

// → { method, age, sex, skeletalClass, anb, film, measurements, cues, pattern }.
// `facing` is the resolved direction ("left" or "right"); `film` the film check.
export function computeAirway(markups, calibration, { age: ageIn = null, sex: sexIn = null, facing = "right", film = null } = {}) {
  const age = normalizeAge(ageIn), sex = normalizeSex(sexIn);
  const pts = { S: findLandmark(markups, "S"), N: findLandmark(markups, "N"), A: findLandmark(markups, "A"), B: findLandmark(markups, "B") };
  const anb = pts.N && pts.A && pts.B ? signedAngle3(pts.A, pts.N, pts.B, facing === "left" ? "left" : "right") : null;
  const patient = { age, sex, skeletalClass: skeletalClassFromAnb(anb), film };
  const measurements = AIRWAY_MEASURES
    .filter(m => measureAppliesToAge(m, age))
    .map(m => measureRow(m, markups, calibration, patient));
  return {
    method: AIRWAY_METHOD,
    age, sex, anb, film,
    skeletalClass: patient.skeletalClass,
    measurements,
    cues: citedCues(measurements),
    pattern: nasopharyngealPattern(measurements, patient),
    swallowNote: film?.swallowing === "yes" ? "McNamara 1984: an inverted-V soft palate suggests swallowing during exposure, which limits the upper pharyngeal measurement." : null,
  };
}

// What's still needed for the measures this patient's age uses.
export function airwayNeeds(age) {
  const a = normalizeAge(age);
  const needs = new Set();
  for (const m of AIRWAY_MEASURES) if (measureAppliesToAge(m, a)) m.needs.forEach(n => needs.add(n));
  return {
    landmarks: Object.keys(AIRWAY_LANDMARKS).filter(id => needs.has(id)),
    walls: Object.keys(AIRWAY_WALLS).filter(id => needs.has(id)),
    adenoid: needs.has("adenoid"),
  };
}

export const hasAirwayResult = (res) => (res?.measurements || []).some(m => m.value != null);

// Saved results from before this method: values stay, comparisons don't. Older rows
// had unverified references and notes, so they display without them.
export function airwayResultsForDisplay(measurements) {
  return (measurements || [])
    .filter(m => m.id !== "_global" && m.id !== "Min-CSA" && m.id !== "Mandibular-Body")
    .map(m => {
      if (m.methodVersion || String(m.id).startsWith("_")) return m;
      const { clinicalNote: _note, ...rest } = m;
      return { ...rest, normMean: null, normSD: null, normSource: null, zScore: null, interpretation: m.value != null ? "Calculated with the older method; no comparison" : m.interpretation };
    });
}

// In-memory copy of a session with each airway value as a labelled measurement, so the
// research modules can select them like any other. Never saved.
export function withAirwayMeasures(session, calibration) {
  if (!session) return session;
  const cal = session.calibration?.done ? session.calibration : calibration;
  const res = computeAirway(session.markups || [], cal, { age: null, facing: session.facing === "left" ? "left" : "right" });
  const rows = res.measurements.filter(r => r.value != null);
  if (!rows.length) return session;
  const derived = rows.map(r => ({
    id: `airway:${r.id}`, type: "airwayValue", label: `Airway ${r.label}`, visible: true, points: [],
    airwayDim: r.dim, computedValue: r.value, computedUnit: r.unit,
  }));
  return { ...session, markups: [...(session.markups || []), ...derived] };
}
