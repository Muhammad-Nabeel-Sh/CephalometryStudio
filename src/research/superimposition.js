// ═══════════════════════════════════════════════════════════════════════════════
// SUPERIMPOSITION — Procrustes & structural alignment, displacement computation
// growth decomposition, pattern detection, delta norms, error quantification,
// multi-timepoint longitudinal analysis, and group-level research.
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, primaryMeasure, tDistributeCDF } from "../lib/utils.js";
import { resolveFacing } from "../lib/measureConventions.js";

// ─── Structural reference planes ─────────────────────────────────────────────

export const REFERENCE_PLANES = [
  { id: "SN",       label: "S-N (Anterior Cranial Base)",    pt1: "Sella",    pt2: "Nasion" },
  { id: "BaN",      label: "Ba-N (Cranial Base)",            pt1: "Basion",   pt2: "Nasion" },
  { id: "palatal",  label: "Palatal Plane",                   pt1: "ANS",      pt2: "PNS" },
  { id: "mandible", label: "Mandibular Plane",                pt1: "Go",       pt2: "Me" },
  { id: "FH",       label: "Frankfort Horizontal",            pt1: "Porion",   pt2: "Orbitale" },
  { id: "OP",       label: "Occlusal Plane",                  pt1: "APOcc",    pt2: "PPOcc" },
];

// Landmark names used above → the labels the app's templates and AI trace use.
export const LANDMARK_ALIASES = {
  Sella: ["S", "Sella"], Nasion: ["N", "Nasion"], Basion: ["Ba", "Basion"],
  Porion: ["Po", "Porion"], Orbitale: ["Or", "Orbitale"], PT: ["PT", "Pt"],
};
const candidatesFor = name => LANDMARK_ALIASES[name] || [name];

export function findLandmark(markups, name) {
  for (const cand of candidatesFor(name)) {
    const m = (markups || []).find(mk => mk.type === "point" && (mk.label === cand || mk.templateLabel === cand) && mk.points?.[0] && mk.points[0].x > -9000);
    if (m) return m.points[0];
  }
  return null;
}

// ─── Stable-structure registrations (rotation + translation only) ────────────
// `origin` is the registration point; the plane origin→other sets orientation.
// Growth is then read relative to the registered structure (no scaling).
export const REGISTRATIONS = [
  { id: "SN_S", label: "Anterior cranial base: S-N registered at S", origin: "Sella", other: "Nasion" },
  { id: "BaN_CC", label: "Ricketts: Ba-N registered at CC (Ba-N ∩ Pt-Gn)", origin: "CC", other: "Nasion" },
  { id: "palatal_ANS", label: "Maxilla: palatal plane registered at ANS", origin: "ANS", other: "PNS" },
  { id: "mandible_Me", label: "Mandible: Go-Me registered at Me (approximation of structural superimposition)", origin: "Me", other: "Go" },
];

function lineIntersection(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const a = p1.x * p2.y - p1.y * p2.x, b = p3.x * p4.y - p3.y * p4.x;
  return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d };
}

// Registration point/axis for one session's markups, or null when landmarks are missing.
export function registrationPoints(markups, regId) {
  const reg = REGISTRATIONS.find(r => r.id === regId);
  if (!reg) return null;
  let origin;
  if (reg.origin === "CC") {
    const Ba = findLandmark(markups, "Basion"), N = findLandmark(markups, "Nasion");
    const Pt = findLandmark(markups, "PT"), Gn = findLandmark(markups, "Gn");
    origin = Ba && N && Pt && Gn ? lineIntersection(Ba, N, Pt, Gn) : null;
  } else {
    origin = findLandmark(markups, reg.origin);
  }
  const other = findLandmark(markups, reg.other);
  return origin && other ? [origin, other] : null;
}

// ─── Growth/Rotation reference planes (2-point pairs for rotation tracking) ──

export const ROTATION_TRACKING = [
  { id: "mandAngle",  label: "Mandibular Plane Angle",   pt1: "Go",     pt2: "Me",    ref1: "Sella",  ref2: "Nasion" },
  { id: "palatalAngle", label: "Palatal Plane Angle",    pt1: "ANS",    pt2: "PNS",   ref1: "Sella",  ref2: "Nasion" },
  { id: "occlusalAngle", label: "Occlusal Plane Angle",  pt1: "APOcc",  pt2: "PPOcc", ref1: "Sella",  ref2: "Nasion" },
  { id: "Yaxis",      label: "Y-Axis (SGn)",             pt1: "Sella",  pt2: "Gn",    ref1: null,     ref2: null },
];

// ─── Growth classification thresholds (angles in degrees) ────────────────────

const GROWTH_PATTERN_THRESHOLDS = {
  mandibularPlane: { hyperdivergent: 38, normHi: 34, normLo: 26, hypodivergent: 22 },
  facialAxis:      { hyperdivergent: 84, normLo: 88, hypodivergent: 96 },
  yAxis:           { hyperdivergent: 66, normLo: 60, hypodivergent: 56 },
  rotationThreshold: 2,
};

// ─── Soft tissue landmarks ───────────────────────────────────────────────────

export const SOFT_TISSUE_LANDMARKS = [
  "Sn", "UL", "LL", "Stm", "Pos", "Pog'", "Gn'", "Me'",
  "Subnasale", "Labiale superius", "Labiale inferius",
  "Soft tissue Pogonion", "Soft tissue Menton",
  "E-line (nose tip)", "E-line (philtrum)",
  "Nose tip", "Prn",
];

// ─── Typical measurement error (mm) for cephalometric landmarks ──────────────
// Based on published inter/intra-rater reliability studies

export const TYPICAL_ERROR_MM = {
  _default: 0.5,
  Sella: 0.6,
  Nasion: 0.5,
  Porion: 0.7,
  Orbitale: 0.6,
  Basion: 0.8,
  ANS: 0.5,
  PNS: 0.5,
  A: 0.5,
  B: 0.5,
  Pogonion: 0.5,
  Menton: 0.5,
  Gnathion: 0.6,
  Go: 0.7,
  U1tip: 0.4,
  L1tip: 0.4,
  U6: 0.5,
  L6: 0.5,
  Ar: 0.8,
  Xi: 0.7,
  Pm: 0.6,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELTA NORMS — Expected changes over time (age/sex stratified)
// ═══════════════════════════════════════════════════════════════════════════════

export const DELTA_NORMS = [
  {
    label: "SNA", source: "Björk-Solow 1960s / Nanda 1990",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: -0.3, sd: 0.8, note: "Slight maxillary retraction during mixed dentition" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: -0.5, sd: 1.0, note: "Pubertal growth: minimal SNA change" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: -0.2, sd: 0.6, note: "Post-pubertal: stable" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: -0.2, sd: 0.7, note: "Slight maxillary retraction" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: -0.4, sd: 0.9, note: "Pubertal: small change" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: -0.1, sd: 0.5, note: "Post-pubertal: stable" },
    ],
  },
  {
    label: "SNB", source: "Björk-Solow 1960s / Nanda 1990",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: 0.5, sd: 1.0, note: "Mandibular growth forward" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: 1.2, sd: 1.2, note: "Pubertal mandibular surge" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: 0.4, sd: 0.8, note: "Post-pubertal: minor forward growth" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: 0.4, sd: 0.8, note: "Mandibular growth" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: 0.8, sd: 1.0, note: "Pubertal growth" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: 0.2, sd: 0.6, note: "Post-pubertal: near stable" },
    ],
  },
  {
    label: "ANB", source: "Derived from SNA/SNB deltas",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: -0.8, sd: 1.0, note: "Class II correction through growth" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: -1.7, sd: 1.3, note: "Pubertal: significant ANB reduction" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: -0.6, sd: 0.8, note: "Post-pubertal: residual correction" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: -0.6, sd: 0.9, note: "ANB reduction" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: -1.2, sd: 1.1, note: "Pubertal growth" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: -0.3, sd: 0.6, note: "Near stable" },
    ],
  },
  {
    label: "SN-MP", source: "Björk 1969 / Nanda 1990",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: -0.5, sd: 1.5, note: "Slight decrease (closure)" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: -1.0, sd: 1.8, note: "Pubertal: vertical growth closure" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: -0.3, sd: 1.0, note: "Post-pubertal: stable" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: -0.3, sd: 1.2, note: "Slight closure" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: -0.6, sd: 1.5, note: "Pubertal closure" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: -0.1, sd: 0.8, note: "Stable" },
    ],
  },
  {
    label: "Interincisal", source: "Mixed cephalometric sources",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: -2.0, sd: 3.0, note: "Incisor uprighting during growth" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: -1.5, sd: 3.5, note: "Variable during puberty" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: -0.5, sd: 2.0, note: "Stabilizing" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: -1.5, sd: 2.5, note: "Incisor uprighting" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: -1.0, sd: 3.0, note: "Variable" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: -0.3, sd: 1.5, note: "Stable" },
    ],
  },
  {
    label: "U1-NA", source: "Steiner/Nanda",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: -1.5, sd: 2.5, note: "Upper incisor retraction with growth" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: -2.0, sd: 3.0, note: "Pubertal: significant retraction" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: -0.5, sd: 1.5, note: "Post-pubertal: minor change" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: -1.0, sd: 2.0, note: "Retraction" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: -1.5, sd: 2.5, note: "Pubertal change" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: -0.3, sd: 1.0, note: "Stable" },
    ],
  },
  {
    label: "L1-NB", source: "Steiner/Nanda",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, meanDelta: 1.0, sd: 2.5, note: "Lower incisor proclination" },
      { sex: "M", ageMin: 12, ageMax: 16, meanDelta: 1.5, sd: 3.0, note: "Pubertal proclination" },
      { sex: "M", ageMin: 16, ageMax: 20, meanDelta: 0.5, sd: 1.5, note: "Stabilizing" },
      { sex: "F", ageMin: 8, ageMax: 12, meanDelta: 0.8, sd: 2.0, note: "Mild proclination" },
      { sex: "F", ageMin: 12, ageMax: 16, meanDelta: 1.0, sd: 2.5, note: "Pubertal change" },
      { sex: "F", ageMin: 16, ageMax: 20, meanDelta: 0.3, sd: 1.0, note: "Stable" },
    ],
  },
];

// ─── Geometry helpers ────────────────────────────────────────────────────────

function centroid(pts) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / n, y: sy / n };
}

function centroidSize(pts) {
  const c = centroid(pts);
  let s = 0;
  for (const p of pts) { const dx = p.x - c.x, dy = p.y - c.y; s += dx * dx + dy * dy; }
  return Math.sqrt(s);
}

function lineAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function sd(values) {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

// ─── Procrustes alignment ────────────────────────────────────────────────────

// Rotation + translation by default. Scaling to equal centroid size removes the
// size change a growth comparison is meant to measure, so it is opt-in
// (`allowScale`) for size-standardised shape comparison only.
export function procrustesAlign(sourcePts, destPts, { allowScale = false } = {}) {
  if (sourcePts.length < 2 || destPts.length < 2 || sourcePts.length !== destPts.length) {
    return { tx: 0, ty: 0, rot: 0, scale: 1, error: "Need ≥2 matched landmarks" };
  }

  const srcCentroid = centroid(sourcePts);
  const dstCentroid = centroid(destPts);
  const srcC = sourcePts.map(p => ({ x: p.x - srcCentroid.x, y: p.y - srcCentroid.y }));
  const dstC = destPts.map(p => ({ x: p.x - dstCentroid.x, y: p.y - dstCentroid.y }));

  const srcCS = centroidSize(srcC);
  const dstCS = centroidSize(dstC);
  const scale = allowScale && srcCS > 1e-12 ? dstCS / srcCS : 1;
  const srcS = srcC.map(p => ({ x: p.x * scale, y: p.y * scale }));

  let Hxx = 0, Hxy = 0, Hyx = 0, Hyy = 0;
  for (let i = 0; i < srcS.length; i++) {
    Hxx += srcS[i].x * dstC[i].x;
    Hxy += srcS[i].x * dstC[i].y;
    Hyx += srcS[i].y * dstC[i].x;
    Hyy += srcS[i].y * dstC[i].y;
  }

  const angle = Math.atan2(Hxy - Hyx, Hxx + Hyy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = dstCentroid.x - (cos * srcCentroid.x * scale - sin * srcCentroid.y * scale);
  const ty = dstCentroid.y - (sin * srcCentroid.x * scale + cos * srcCentroid.y * scale);

  return { tx, ty, rot: angle, scale };
}

// ─── Structural alignment (2-point plane registration) ───────────────────────

export function structuralAlign(sourcePts, destPts) {
  if (sourcePts.length < 2 || destPts.length < 2) {
    return { tx: 0, ty: 0, rot: 0, scale: 1, error: "Need 2 reference points" };
  }
  const [s1, s2] = sourcePts;
  const [d1, d2] = destPts;
  const srcAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
  const dstAngle = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  const rot = dstAngle - srcAngle;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const tx = d1.x - (cosR * s1.x - sinR * s1.y);
  const ty = d1.y - (sinR * s1.x + cosR * s1.y);
  return { tx, ty, rot, scale: 1 };
}

// ─── Apply transform ─────────────────────────────────────────────────────────

export function applyTransform(pt, tf) {
  const cos = Math.cos(tf.rot) * tf.scale;
  const sin = Math.sin(tf.rot) * tf.scale;
  return {
    x: cos * pt.x - sin * pt.y + tf.tx,
    y: sin * pt.x + cos * pt.y + tf.ty,
  };
}

// ─── Landmark matching ───────────────────────────────────────────────────────

function extractPoints(markups) {
  const points = [];
  const labels = new Set();
  for (const m of markups) {
    if (m.type === "point" && m.label && !labels.has(m.label)) {
      const vp = vpts(m);
      if (vp.length > 0) {
        points.push({ label: m.label, x: vp[0].x, y: vp[0].y, markup: m });
        labels.add(m.label);
      }
    }
  }
  return points;
}

function matchLandmarks(srcMarkups, dstMarkups) {
  const srcPts = extractPoints(srcMarkups);
  const dstPts = extractPoints(dstMarkups);
  const matched = [];
  const dstMap = new Map(dstPts.map(p => [p.label, p]));
  for (const sp of srcPts) {
    const dp = dstMap.get(sp.label);
    if (dp) matched.push({ label: sp.label, src: sp, dst: dp });
  }
  return { srcPts, dstPts, matched };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ALIGNMENT-AWARE DISPLACEMENT
//    Apply transform to compare-session points BEFORE measuring displacement.
//    src = compare session (to be transformed), dst = base session (reference).
// ═══════════════════════════════════════════════════════════════════════════════

export function computeDisplacements(matched, transform, pxPerMm) {
  const mm = pxPerMm > 0;
  return matched.map(({ label, src, dst }) => {
    // Align compare-session point (src = T2) into base (dst = T1) space
    const aligned = applyTransform({ x: src.x, y: src.y }, transform);
    // Displacement = T2 − T1 (positive = movement in +x/+y direction over time)
    // Consistent with linear-change sign convention (computeLinearChanges uses T2 − T1)
    const dx = aligned.x - dst.x;
    const dy = aligned.y - dst.y;
    const lenPx = Math.sqrt(dx * dx + dy * dy);
    const lenMm = mm ? lenPx / pxPerMm : lenPx;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    // Directional decomposition (mm)
    const dxMm = mm ? dx / pxPerMm : dx;
    const dyMm = mm ? (-dy) / pxPerMm : -dy; // y-inverted: positive = superior
    return { label, dx, dy, lenPx, lenMm, angle, dxMm, dyMm, baseX: dst.x, baseY: dst.y, unit: mm ? "mm" : "px" };
  });
}

// ─── Error-aware displacement ────────────────────────────────────────────────

export function computeDisplacementsWithError(matched, transform, pxPerMm) {
  const displacements = computeDisplacements(matched, transform, pxPerMm);
  const mm = pxPerMm > 0;
  return displacements.map(d => {
    const errMm = TYPICAL_ERROR_MM[d.label] || TYPICAL_ERROR_MM._default;
    const errPx = mm ? errMm * pxPerMm : errMm;
    const propagatedErr = Math.sqrt(errPx ** 2 + errPx ** 2) * (mm ? 1 / pxPerMm : 1);
    const sigRatio = propagatedErr > 0 ? d.lenMm / propagatedErr : Infinity;
    return {
      ...d,
      typicalErrorMm: errMm,
      propagatedErrorMm: propagatedErr,
      significanceRatio: sigRatio,
      isSignificant: sigRatio > 2,
      confidenceLevel: sigRatio > 3 ? "high" : sigRatio > 2 ? "moderate" : "low",
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GROWTH / TREATMENT DECOMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════

export function computeRotationTracking(baseMarkups, compareMarkups, transform) {
  const results = [];
  // Image y points down; for a left-facing profile a clockwise (opening)
  // rotation appears counter-clockwise, so flip the sign.
  const facingSign = resolveFacing("auto", baseMarkups) === "left" ? -1 : 1;
  const findPt = findLandmark;

  for (const track of ROTATION_TRACKING) {
    const bPt1 = findPt(baseMarkups, track.pt1);
    const bPt2 = findPt(baseMarkups, track.pt2);
    const cPt1 = findPt(compareMarkups, track.pt1);
    const cPt2 = findPt(compareMarkups, track.pt2);

    if (!bPt1 || !bPt2 || !cPt1 || !cPt2) continue;

    // Base session angle
    const bAngle = lineAngle(bPt1, bPt2);
    // Compare session angle (transform to aligned space)
    const acPt1 = applyTransform(cPt1, transform);
    const acPt2 = applyTransform(cPt2, transform);
    const cAngle = lineAngle(acPt1, acPt2);

    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const deltaDeg = facingSign * wrap(cAngle - bAngle) * (180 / Math.PI);

    // If reference points exist, compute angle relative to them
    let relDelta = null;
    if (track.ref1 && track.ref2) {
      const bR1 = findPt(baseMarkups, track.ref1);
      const bR2 = findPt(baseMarkups, track.ref2);
      if (bR1 && bR2) {
        const refAngle = lineAngle(bR1, bR2);
        const bAbs = bAngle - refAngle;
        const cAbs = cAngle - refAngle;
        relDelta = facingSign * (cAbs - bAbs) * (180 / Math.PI);
      }
    }

    results.push({
      id: track.id,
      label: track.label,
      baseAngleDeg: bAngle * (180 / Math.PI),
      compareAngleDeg: cAngle * (180 / Math.PI),
      deltaDeg,
      relativeDeltaDeg: relDelta,
      direction: deltaDeg > 0 ? "opening" : deltaDeg < 0 ? "closing" : "unchanged",
    });
  }

  return results;
}

export function computePlaneIntersections(baseMarkups, compareMarkups, transform) {
  const findPt = findLandmark;

  const planes = [
    { name: "SN", pt1: "Sella", pt2: "Nasion" },
    { name: "Mandibular", pt1: "Go", pt2: "Me" },
    { name: "Palatal", pt1: "ANS", pt2: "PNS" },
  ];

  const results = [];
  for (const plane of planes) {
    const bP1 = findPt(baseMarkups, plane.pt1);
    const bP2 = findPt(baseMarkups, plane.pt2);
    if (!bP1 || !bP2) continue;
    const bAngle = lineAngle(bP1, bP2) * (180 / Math.PI);
    const cP1 = findPt(compareMarkups, plane.pt1);
    const cP2 = findPt(compareMarkups, plane.pt2);
    if (!cP1 || !cP2) continue;
    const acP1 = applyTransform(cP1, transform);
    const acP2 = applyTransform(cP2, transform);
    const cAngle = lineAngle(acP1, acP2) * (180 / Math.PI);
    results.push({ name: plane.name, baseAngle: bAngle, compareAngle: cAngle, delta: cAngle - bAngle });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DELTA NORMS — Compare measured change against expected change
// ═══════════════════════════════════════════════════════════════════════════════

export function lookupDeltaNorm(label, sex, ageStart, ageEnd) {
  const entry = DELTA_NORMS.find(n => n.label === label);
  if (!entry) return null;
  const aStart = ageStart ?? 12;
  const aEnd = ageEnd ?? aStart + 2;
  if (aEnd <= aStart) return null;
  const sexKey = sex === "Male" || sex === "M" || sex === "male" ? "M" : "F";
  const groups = entry.groups.filter(g => g.sex === sexKey);
  let totalDelta = 0;
  let totalVar = 0;
  let lastNote = "";
  for (const g of groups) {
    const overlapStart = Math.max(aStart, g.ageMin);
    const overlapEnd = Math.min(aEnd, g.ageMax);
    if (overlapEnd <= overlapStart) continue;
    const spanYears = Math.max(0.5, g.ageMax - g.ageMin);
    const frac = (overlapEnd - overlapStart) / spanYears;
    totalDelta += g.meanDelta * frac;
    totalVar += g.sd * g.sd * frac;
    lastNote = g.note;
  }
  if (totalVar <= 0) return null;
  return {
    label: entry.label,
    source: entry.source,
    expectedDelta: totalDelta,
    expectedSD: Math.sqrt(totalVar),
    yearSpan: aEnd - aStart,
    note: lastNote,
  };
}

export function evaluateDeltaNorms(linearChanges, angularChanges, sex, ageStart, ageEnd) {
  const results = [];
  const allChanges = [
    ...(linearChanges || []).map(c => ({ label: c.label, delta: c.delta, measureKey: c.measureKey, unit: c.unit })),
    ...(angularChanges || []).map(c => ({ label: c.label, delta: c.delta, measureKey: "angle", unit: "deg" })),
  ];

  for (const change of allChanges) {
    const norm = lookupDeltaNorm(change.label, sex, ageStart, ageEnd);
    if (!norm) continue;
    const zScore = norm.expectedSD > 0 ? (change.delta - norm.expectedDelta) / norm.expectedSD : 0;
    const within1SD = Math.abs(zScore) <= 1;
    const within2SD = Math.abs(zScore) <= 2;
    results.push({
      ...change,
      norm,
      zScore,
      within1SD,
      within2SD,
      interpretation: within1SD ? "Within expected range"
        : within2SD ? `Borderline change (${zScore > 0 ? "excessive" : "insufficient"})`
        : `Significant deviation from expected change (${zScore > 0 ? "more than expected" : "less than expected"})`,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CLINICAL PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

// Label synonyms for case-insensitive+fuzzy matching.
// Each entry maps a canonical label to its known variants.
// Used by detectPatterns to find measurements regardless of label naming
// convention in the user's project.
const _LABEL_SYNONYMS = {
  "ANB": ["A-N-B", "ANB angle", "ANB°", "ANB (degrees)"],
  "SNA": ["S-N-A", "SNA angle", "SNA°", "SNA (degrees)"],
  "SNB": ["S-N-B", "SNB angle", "SNB°", "SNB (degrees)"],
  "U1-NA": ["U1NA", "U1/NA", "U1-NA (angle)", "U1-NA angle"],
  "U1-NA-mm": ["U1-NA mm", "U1NA mm", "U1-NA distance", "U1-NA (mm)"],
  "L1-NB": ["L1NB", "L1/NB", "L1-NB (angle)", "L1-NB angle"],
  "L1-NB-mm": ["L1-NB mm", "L1NB mm", "L1-NB distance", "L1-NB (mm)"],
  "Interincisal": ["interincisal", "interincisal angle", "U1-L1", "U1/L1", "IIA"],
  "U1-L1": ["U1/L1", "U1-L1 angle", "Interincisal", "interincisal", "interincisal angle"],
  "E-line (nose tip)": ["E line (nose tip)", "ELine (nose tip)"],
  "E-line": ["E line", "ELine", "E-plane", "esthetic line"],
};
const _SYNONYM_TABLE = (() => {
  const t = {};
  for (const [canonical, aliases] of Object.entries(_LABEL_SYNONYMS)) {
    for (const v of [canonical, ...aliases]) {
      t[v.toLowerCase()] = canonical;
    }
  }
  return t;
})();
function _matchLabel(candidate, query) {
  const cLower = candidate.toLowerCase();
  const qLower = query.toLowerCase();
  if (cLower === qLower) return true;
  const cCanon = _SYNONYM_TABLE[cLower] || cLower;
  const qCanon = _SYNONYM_TABLE[qLower] || qLower;
  return cCanon === qCanon;
}

export function detectPatterns(displacements, angularChanges, rotationTracking, planeIntersections, linearChanges, centroidSize) {
  const patterns = [];

  const findAng = (label) => angularChanges.find(c => _matchLabel(c.label, label));
  const findRot = (id) => rotationTracking.find(r => r.id === id);
  const findLin = (label) => (linearChanges || []).find(c => _matchLabel(c.label, label));

  // 1. Growth pattern classification
  const mandPlaneRot = findRot("mandAngle");

  if (mandPlaneRot) {
    const delta = mandPlaneRot.deltaDeg;
    const classification = delta < -GROWTH_PATTERN_THRESHOLDS.rotationThreshold ? "Counter-clockwise rotation (hypodivergent tendency)"
      : delta > GROWTH_PATTERN_THRESHOLDS.rotationThreshold ? "Clockwise rotation (hyperdivergent tendency)"
      : "Minimal vertical rotation";
    patterns.push({
      id: "growthPattern",
      category: "Growth Pattern",
      label: "Vertical Growth Pattern",
      summary: classification,
      detail: `Mandibular plane change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}°. ${Math.abs(delta) > 3 ? "Clinically significant rotation." : "Within normal variation."}`,
      severity: Math.abs(delta) > 5 ? "severe" : Math.abs(delta) > 3 ? "moderate" : "mild",
    });
  }

  // 2. Skeletal class change
  const anbChange = findAng("ANB") || findLin("ANB");
  const snaChange = findAng("SNA") || findLin("SNA");
  const snbChange = findAng("SNB") || findLin("SNB");

  if (anbChange) {
    const delta = anbChange.delta ?? (anbChange.value2 - anbChange.value1);
    const classChange = delta < -2 ? "Class II improvement (ANB decreasing)"
      : delta > 2 ? "Class III worsening (ANB increasing)"
      : delta < -1 ? "Mild Class II correction"
      : delta > 1 ? "Mild Class III tendency"
      : "Skeletal class stable";
    if (Math.abs(delta) > 0.5) {
      patterns.push({
        id: "skeletalClass",
        category: "Skeletal",
        label: "Skeletal Class Change",
        summary: classChange,
        detail: `ANB change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}°. SNA: ${snaChange?.delta != null ? (snaChange.delta > 0 ? "+" : "") + snaChange.delta.toFixed(1) : "—"}°. SNB: ${snbChange?.delta != null ? (snbChange.delta > 0 ? "+" : "") + snbChange.delta.toFixed(1) : "—"}°.`,
        severity: Math.abs(delta) > 4 ? "severe" : Math.abs(delta) > 2 ? "moderate" : "mild",
      });
    }
  }

  // 3. Missing-data warning for skeletal class
  if (!anbChange) {
    patterns.push({
      id: "missingSkeletalClass",
      category: "Skeletal",
      label: "Skeletal Class Data Missing",
      summary: "No ANB change found in linear or angular changes — skeletal class pattern not reported",
      detail: "Pattern detection looks for labels matching 'ANB' (including 'A-N-B', 'ANB angle', etc.). If your project uses a different label, consider renaming.",
      severity: "mild",
    });
  }

  // 4. Maxillary rotation
  const palatalRot = findRot("palatalAngle");
  if (palatalRot) {
    const delta = palatalRot.deltaDeg;
    if (Math.abs(delta) > 1) {
      patterns.push({
        id: "maxillaryRotation",
        category: "Maxillary",
        label: "Maxillary Rotation",
        summary: delta > 0 ? "Counterclockwise (forward) maxillary rotation" : "Clockwise (backward) maxillary rotation",
        detail: `Palatal plane change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}°. ${delta > 2 ? "Forward growth of the maxilla." : delta < -2 ? "Backward/upward maxillary rotation." : "Minor change."}`,
        severity: Math.abs(delta) > 3 ? "severe" : Math.abs(delta) > 2 ? "moderate" : "mild",
      });
    }
  }

  // 5. Mandibular autorotation
  if (mandPlaneRot) {
    const delta = mandPlaneRot.deltaDeg;
    if (Math.abs(delta) > 2) {
      patterns.push({
        id: "mandibularAutorotation",
        category: "Mandibular",
        label: "Mandibular Autorotation",
        summary: delta < 0 ? "Counter-clockwise autorotation (closing bite)" : "Clockwise mandibular autorotation (opening bite)",
        detail: `Mandibular plane rotated ${Math.abs(delta).toFixed(1)}° ${delta < 0 ? "counter-clockwise" : "clockwise"}. ${delta < -3 ? "Hypodivergent growth pattern." : delta > 3 ? "Hyperdivergent growth pattern." : "Within normal range."}`,
        severity: Math.abs(delta) > 5 ? "severe" : Math.abs(delta) > 3 ? "moderate" : "mild",
      });
    }
  }

  // 6. Incisor compensation
  const u1Change = findAng("U1-NA") || findLin("U1-NA-mm");
  const l1Change = findAng("L1-NB") || findLin("L1-NB-mm");
  const interincisal = findAng("Interincisal") || findAng("U1-L1");

  if (u1Change && l1Change) {
    const u1d = u1Change.delta ?? (u1Change.value2 - u1Change.value1);
    const l1d = l1Change.delta ?? (l1Change.value2 - l1Change.value1);
    // Dentoalveolar compensation: lower incisor proclines when mandible retrudes
    if (l1d > 3 && u1d < -2) {
      patterns.push({
        id: "compensation",
        category: "Dental",
        label: "Dentoalveolar Compensation",
        summary: "Lower incisor proclination with upper incisor retraction — typical Class II camouflage pattern",
        detail: `L1-NB: ${l1d > 0 ? "+" : ""}${l1d.toFixed(1)}°. U1-NA: ${u1d > 0 ? "+" : ""}${u1d.toFixed(1)}°.`,
        severity: "moderate",
      });
    }
  }

  // 7. Dental symmetry check
  if (interincisal) {
    const delta = interincisal.delta ?? (interincisal.value2 - interincisal.value1);
    if (Math.abs(delta) > 5) {
      patterns.push({
        id: "interincisalChange",
        category: "Dental",
        label: "Interincisal Angle Change",
        summary: delta < 0 ? "Interincisal angle decreased — incisor proclination" : "Interincisal angle increased — incisor uprighting",
        detail: `Change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}°.`,
        severity: Math.abs(delta) > 10 ? "severe" : Math.abs(delta) > 5 ? "moderate" : "mild",
      });
    }
  }

  // 8. Soft tissue assessment
  const eLine = findLin("E-line (nose tip)") || findLin("E-line");
  if (eLine) {
    const delta = eLine.delta;
    if (Math.abs(delta) > 1) {
      patterns.push({
        id: "softTissueProfile",
        category: "Soft Tissue",
        label: "Soft Tissue Profile Change",
        summary: delta < 0 ? "Lip retrusion relative to E-line" : "Lip protrusion relative to E-line",
        detail: `E-line distance change: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} mm.`,
        severity: Math.abs(delta) > 4 ? "severe" : Math.abs(delta) > 2 ? "moderate" : "mild",
      });
    }
  }

  // 9. Overall size change
  if (centroidSize && Math.abs(centroidSize.pctChange) > 5) {
    patterns.push({
      id: "sizeChange",
      category: "Overall",
      label: "Centroid Size Change",
      summary: centroidSize.pctChange > 0 ? `Overall facial size increased by ${centroidSize.pctChange.toFixed(1)}%` : `Overall facial size decreased by ${Math.abs(centroidSize.pctChange).toFixed(1)}%`,
      detail: `Centroid size: ${centroidSize.base?.toFixed(1)} → ${centroidSize.compare?.toFixed(1)} px.`,
      severity: Math.abs(centroidSize.pctChange) > 15 ? "severe" : Math.abs(centroidSize.pctChange) > 8 ? "moderate" : "mild",
    });
  }

  return patterns;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANGULAR + LINEAR CHANGES (unchanged logic)
// ═══════════════════════════════════════════════════════════════════════════════

export function computeAngularChanges(srcMarkups, dstMarkups) {
  // Same values the measurement tables show: signed conventions (ANB, convexity,
  // AB plane) evaluated in each session's patient frame.
  const srcCtx = { facing: resolveFacing("auto", srcMarkups) };
  const dstCtx = { facing: resolveFacing("auto", dstMarkups) };
  const changes = [];
  const angleTypes = ["angle3", "angle4"];
  for (const m1 of srcMarkups) {
    if (!angleTypes.includes(m1.type)) continue;
    const m2 = dstMarkups.find(m => m.type === m1.type && m.label === m1.label);
    if (!m2) continue;
    const a1 = primaryMeasure(m1, null, srcCtx)?.value;
    const a2 = primaryMeasure(m2, null, dstCtx)?.value;
    if (a1 == null || a2 == null) continue;
    changes.push({ label: m1.label, type: m1.type, angle1: a1, angle2: a2, delta: a1 - a2 });
  }
  return changes;
}

export function computeLinearChanges(srcMarkups, dstMarkups, calibration) {
  // Primary non-angular measurement per markup (angles are in computeAngularChanges;
  // raw x/y coordinates are never a "change").
  const srcCtx = { facing: resolveFacing("auto", srcMarkups) };
  const dstCtx = { facing: resolveFacing("auto", dstMarkups) };
  const changes = [];
  const seen = new Set();
  for (const m1 of srcMarkups) {
    if (!m1.label || m1.type === "ruler" || m1.type === "silhouette") continue;
    const m2 = dstMarkups.find(m => m.type === m1.type && m.label === m1.label);
    if (!m2) continue;
    try {
      const v1 = primaryMeasure(m1, calibration, srcCtx);
      const v2 = primaryMeasure(m2, calibration, dstCtx);
      if (!v1 || !v2 || v1.key === "angle") continue;
      const key = `${m1.label}::${v1.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      changes.push({ label: m1.label, measureKey: v1.key, value1: v1.value, value2: v2.value, delta: v1.value - v2.value, unit: v1.unit });
    } catch { /* skip */ }
  }
  return changes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL SUPERIMPOSITION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export function runSuperimposition(baseMarkups, compareMarkups, config) {
  const { method, planePoint1, planePoint2, labelFilter, basePxPerMm, compPxPerMm, registration, allowScale } = config || {};

  // Normalize both sessions to physical mm using their own calibrations
  // This prevents magnification mismatch when T1 and T2 have different pxPerMm
  function scalePts(markups, pxPerMm) {
    if (pxPerMm <= 0) return markups;
    return markups.map(m => {
      if (!m.points) return m;
      const inv = 1 / pxPerMm;
      return { ...m, points: m.points.map(p => ({ x: p.x * inv, y: p.y * inv })) };
    });
  }
  const baseNorm = basePxPerMm > 0 ? scalePts(baseMarkups, basePxPerMm) : baseMarkups;
  const compNorm = compPxPerMm > 0 ? scalePts(compareMarkups, compPxPerMm) : compareMarkups;
  // After normalization, coordinates are in mm — pxPerMm becomes 1
  const normCal = { done: true, pxPerMm: 1 };
  const pxPerMm = 1;

  const filterSet = labelFilter?.length > 0 ? new Set(labelFilter) : null;
  const baseF = filterSet ? baseNorm.filter(m => filterSet.has(m.label)) : baseNorm;
  const compF = filterSet ? compNorm.filter(m => filterSet.has(m.label)) : compNorm;

  const { srcPts, dstPts, matched } = matchLandmarks(compF, baseF);

  if (matched.length < 2) {
    return { error: "Need ≥2 matching landmarks between sessions", displacements: [], transform: null, matchedCount: 0 };
  }

  let transform;
  let alignmentLabel;

  if (method === "registration") {
    const reg = REGISTRATIONS.find(r => r.id === registration) || REGISTRATIONS[0];
    const srcPlane = registrationPoints(compNorm, reg.id);
    const dstPlane = registrationPoints(baseNorm, reg.id);
    if (!srcPlane || !dstPlane) {
      return { error: `"${reg.label}" needs ${reg.origin === "CC" ? "Ba, N, PT and Gn" : `${candidatesFor(reg.origin)[0]} and ${candidatesFor(reg.other)[0]}`} in both sessions` };
    }
    transform = structuralAlign(srcPlane, dstPlane);
    alignmentLabel = reg.label;
  } else if (method === "structural" && planePoint1 && planePoint2) {
    const pick = (name, side) => {
      for (const cand of candidatesFor(name)) { const m = matched.find(x => x.label === cand); if (m) return m[side]; }
      return null;
    };
    const srcPlane = [pick(planePoint1, "src"), pick(planePoint2, "src")].filter(Boolean);
    const dstPlane = [pick(planePoint1, "dst"), pick(planePoint2, "dst")].filter(Boolean);
    if (srcPlane.length < 2 || dstPlane.length < 2) {
      return { error: `Structural alignment requires landmarks "${planePoint1}" and "${planePoint2}" to be present in both sessions` };
    }
    transform = structuralAlign(srcPlane, dstPlane);
    alignmentLabel = `${planePoint1}–${planePoint2} plane`;
  } else {
    transform = procrustesAlign(
      matched.map(m => ({ x: m.src.x, y: m.src.y })),
      matched.map(m => ({ x: m.dst.x, y: m.dst.y })),
      { allowScale: !!allowScale },
    );
    alignmentLabel = `Procrustes (${matched.length} landmarks${allowScale ? ", scaled" : ", no scaling"})`;
  }

  if (transform.error) return { error: transform.error };

  // Error-aware displacements (item 9)
  const displacements = computeDisplacementsWithError(matched, transform, pxPerMm);

  // Angular changes
  const angularChanges = computeAngularChanges(compF, baseF);

  // Linear changes
  const linearChanges = computeLinearChanges(compF, baseF, normCal);

  // Rotation tracking (item 5)
  const rotationTracking = computeRotationTracking(baseF, compF, transform);

  // Plane intersections
  const planeIntersections = computePlaneIntersections(baseF, compF, transform);

  // Centroid sizes
  const srcCS = centroidSize(srcPts.map(p => ({ x: p.x, y: p.y })));
  const dstCS = centroidSize(dstPts.map(p => ({ x: p.x, y: p.y })));
  const csDiffPx = srcCS - dstCS;
  const csDiffMm = pxPerMm > 0 ? csDiffPx / pxPerMm : csDiffPx;
  const csPct = dstCS > 1e-9 ? ((srcCS / dstCS) - 1) * 100 : 0;
  const centroidSizeObj = { base: dstCS, compare: srcCS, diffPx: csDiffPx, diffMm: csDiffMm, pctChange: csPct };

  // Stats
  const mmVals = displacements.filter(d => d.unit === "mm").map(d => d.lenMm);
  const stats = mmVals.length > 0 ? {
    mean: mmVals.reduce((a, b) => a + b, 0) / mmVals.length,
    max: Math.max(...mmVals),
    min: Math.min(...mmVals),
    sd: sd(mmVals),
    count: mmVals.length,
    median: mmVals.sort((a, b) => a - b)[Math.floor(mmVals.length / 2)],
  } : null;

  // Delta norms (item 2)
  const deltaNorms = evaluateDeltaNorms(linearChanges, angularChanges, config?.sex, config?.ageStart, config?.ageEnd);

  // Pattern detection (item 3)
  const patterns = detectPatterns(displacements, angularChanges, rotationTracking, planeIntersections, linearChanges, centroidSizeObj);

  // Error summary
  const sigDisps = displacements.filter(d => d.isSignificant);
  const errSummary = {
    totalLandmarks: displacements.length,
    significantDisplacements: sigDisps.length,
    nonSignificant: displacements.length - sigDisps.length,
    highConfidence: displacements.filter(d => d.confidenceLevel === "high").length,
  };

  return {
    transform,
    alignmentLabel,
    matchedCount: matched.length,
    totalSrc: srcPts.length,
    totalDst: dstPts.length,
    displacements,
    angularChanges,
    linearChanges,
    rotationTracking,
    planeIntersections,
    centroidSize: centroidSizeObj,
    stats,
    deltaNorms,
    patterns,
    errSummary,
    matchedLabels: matched.map(m => m.label),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MULTI-TIMEPOINT LONGITUDINAL ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export function runLongitudinalSuperimposition(sessions, config, calibration) {
  const { sessionIds, method, planePoint1, planePoint2, baseSessionIndex, registration, allowScale } = config || {};
  const orderedSessions = (sessionIds || [])
    .map(id => sessions.find(s => s.id === id))
    .filter(Boolean);

  if (orderedSessions.length < 2) {
    return { error: "Need at least 2 sessions for longitudinal analysis" };
  }

  const baseIdx = baseSessionIndex || 0;
  const baseSession = orderedSessions[baseIdx];
  const baseMarkups = (baseSession.markups || []).filter(m => m.visible !== false && m.placed !== false);

  // Run pairwise comparisons against base
  const pairwiseResults = [];
  const trajectories = {};

  for (let i = 0; i < orderedSessions.length; i++) {
    if (i === baseIdx) continue;
    const compSession = orderedSessions[i];
    const compMarkups = (compSession.markups || []).filter(m => m.visible !== false && m.placed !== false);

    const result = runSuperimposition(baseMarkups, compMarkups, {
      method, planePoint1, planePoint2, registration, allowScale,
      basePxPerMm: baseSession.calibration?.done ? baseSession.calibration.pxPerMm : (calibration?.pxPerMm || 0),
      compPxPerMm: compSession.calibration?.done ? compSession.calibration.pxPerMm : (calibration?.pxPerMm || 0),
    }, baseSession.calibration?.done ? baseSession.calibration : calibration);

    pairwiseResults.push({
      sessionIndex: i,
      sessionName: compSession.name || compSession.meta?.timepoint || `T${i}`,
      sessionId: compSession.id,
      ...result,
    });

    // Build trajectory data
    if (result.displacements && !result.error) {
      for (const d of result.displacements) {
        if (!trajectories[d.label]) trajectories[d.label] = [{ sessionIndex: baseIdx, dx: 0, dy: 0, lenMm: 0 }];
        trajectories[d.label].push({ sessionIndex: i, dx: d.dxMm, dy: d.dyMm, lenMm: d.lenMm });
      }
    }
  }

  // Compute velocity (rate of change per interval)
  const velocities = {};
  for (const [label, pts] of Object.entries(trajectories)) {
    velocities[label] = [];
    for (let i = 1; i < pts.length; i++) {
      const dt = pts[i].sessionIndex - pts[i - 1].sessionIndex;
      velocities[label].push({
        from: pts[i - 1].sessionIndex,
        to: pts[i].sessionIndex,
        rate: dt > 0 ? pts[i].lenMm / dt : 0,
      });
    }
  }

  // Session timeline
  const timeline = orderedSessions.map((s, i) => ({
    index: i,
    name: s.name || s.meta?.timepoint || `T${i}`,
    id: s.id,
    isBase: i === baseIdx,
  }));

  return {
    pairwiseResults,
    trajectories,
    velocities,
    timeline,
    sessionCount: orderedSessions.length,
    baseSession: { index: baseIdx, name: baseSession.name, id: baseSession.id },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. GROUP-LEVEL RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export function computeGroupSuperimposition(caseResults) {
  if (!caseResults || caseResults.length === 0) return { error: "No cases to analyze" };

  // Collect all displacement labels
  const allLabels = new Set();
  for (const cr of caseResults) {
    if (cr.displacements) cr.displacements.forEach(d => allLabels.add(d.label));
  }

  const labelList = [...allLabels].sort();
  const groupStats = {};

  for (const label of labelList) {
    const values = caseResults
      .map(cr => cr.displacements?.find(d => d.label === label))
      .filter(Boolean);
    if (values.length === 0) continue;

    const magnitudes = values.map(v => v.lenMm);
    const dxValues = values.map(v => v.dxMm);
    const dyValues = values.map(v => v.dyMm);

    groupStats[label] = {
      n: values.length,
      meanMagnitude: magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length,
      sdMagnitude: sd(magnitudes),
      meanDx: dxValues.reduce((a, b) => a + b, 0) / dxValues.length,
      meanDy: dyValues.reduce((a, b) => a + b, 0) / dyValues.length,
      seMagnitude: sd(magnitudes) / Math.sqrt(magnitudes.length),
      ci95: (n => {
        const tc = tCritical(0.975, n - 1);
        const mean = magnitudes.reduce((a, b) => a + b, 0) / n;
        const se = sd(magnitudes) / Math.sqrt(n);
        return [mean - tc * se, mean + tc * se];
      })(values.length),
    };
  }

  // Heatmap data: mean displacement vectors
  const heatmapData = labelList.map(label => {
    const s = groupStats[label];
    return { label, meanDx: s?.meanDx || 0, meanDy: s?.meanDy || 0, magnitude: s?.meanMagnitude || 0, n: s?.n || 0 };
  });

  return { groupStats, heatmapData, labelList, nCases: caseResults.length };
}

// ─── t-critical helper (invert tDistributeCDF) ───────────────────────────────
function tCritical(p, df) {
  if (df <= 0) return 1.96;
  if (df > 1000) return p >= 0.995 ? 2.576 : p >= 0.975 ? 1.96 : p >= 0.95 ? 1.645 : 0;
  const target = p;
  let lo = 0.0, hi = 8.0, mid;
  for (let it = 0; it < 60; it++) {
    mid = (lo + hi) / 2;
    const cdf = tDistributeCDF(mid, df);
    if (cdf < target) lo = mid; else hi = mid;
    if (Math.abs(cdf - target) < 1e-10) break;
  }
  return (lo + hi) / 2;
}

// ─── Study-level runner (called by engine.js) ────────────────────────────────

export function runSuperimpositionAll(sessions, config, calibration) {
  const { baseSessionId, compareSessionId, method, planePoint1, planePoint2, labelIds } = config;

  const baseSession = sessions.find(s => s.id === baseSessionId);
  const compareSession = sessions.find(s => s.id === compareSessionId);

  if (!baseSession || !compareSession) {
    return { error: "Both base and compare sessions must be selected" };
  }

  const baseMarkups = (baseSession.markups || []).filter(m => m.visible !== false && m.placed !== false);
  const compareMarkups = (compareSession.markups || []).filter(m => m.visible !== false && m.placed !== false);

  const baseCal = baseSession.calibration?.done ? baseSession.calibration : calibration;
  const compCal = compareSession.calibration?.done ? compareSession.calibration : calibration;

  const result = runSuperimposition(baseMarkups, compareMarkups, {
    method: method || "procrustes",
    planePoint1,
    planePoint2,
    registration: config.registration,
    allowScale: config.allowScale,
    labelFilter: labelIds,
    sex: config.sex,
    ageStart: config.ageStart,
    ageEnd: config.ageEnd,
    basePxPerMm: baseCal?.pxPerMm || 0,
    compPxPerMm: compCal?.pxPerMm || 0,
  }, baseCal);

  return {
    ...result,
    baseSession: { id: baseSession.id, name: baseSession.name || baseSession.label, timepoint: baseSession.meta?.timepoint },
    compareSession: { id: compareSession.id, name: compareSession.name || compareSession.label, timepoint: compareSession.meta?.timepoint },
    method: method || "procrustes",
    calibrationUsed: baseSession.calibration?.done || false,
  };
}
