// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY — Cephalometric airway measurement computation engine
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, dist } from "../lib/utils.js";
import { AIRWAY_NORMS } from "../data/norms.js";

// ─── Airway measurement definitions ──────────────────────────────────────────

// ─── Core landmarks (always shown) ──────────────────────────────────────────
export const AIRWAY_LANDMARKS_CORE = [
  "PNS", "N", "PH", "C3", "H", "Me", "Go", "SP", "Eb", "TT",
];

// ─── Advanced landmarks (shown when core is complete) ────────────────────────
// SP_mid, Ad2, Ad4 are needed for advanced measurements
export const AIRWAY_LANDMARKS_ADVANCED = [
  "SP_mid", "Ba", "Ad1", "Ad2", "Ad3", "Ad4", "Vallecula", "Epiglottis", "PAS_lowest",
];

// ─── Core measurements (always computed — only need core landmarks) ────────────
const CORE_MEASUREMENTS = [
  {
    id: "N-PH",
    label: "N-PH (Nasion to Pharyngeal Wall)",
    type: "length",
    points: ["N", "PH"],
    normMean: 24.3,
    normSD: 3.6,
    normSource: "Solow 1985",
    clinicalNote: "Distance from nasion to posterior pharyngeal wall; reduced in adenoid hypertrophy",
    tier: "core",
    description: "Nasion to posterior pharyngeal wall distance — adenoid screening",
  },
  {
    id: "R-PAS",
    label: "R-PAS (Retropalatal Airway Space)",
    type: "length",
    points: ["SP", "Ad3"],
    normMean: 11.2,
    normSD: 2.4,
    normSource: "McNamara 1984",
    clinicalNote: "Narrowest sagittal dimension at retropalatal level; <5mm suggests severe narrowing",
    tier: "core",
    description: "Retropalatal airway width — most critical for OSA screening",
  },
  {
    id: "MP-H",
    label: "MP-H (Hyoid to Mandibular Plane)",
    type: "length",
    points: ["H", "Go", "Me"],
    normMean: 12.3,
    normSD: 3.5,
    normSource: "Bibby 1984",
    clinicalNote: "Perpendicular distance from hyoid to mandibular plane (Go-Me); increased in OSA",
    tier: "core",
    description: "Hyoid position relative to mandibular plane — OSA indicator",
  },
  {
    id: "SP-Length",
    label: "Soft Palate Length (PNS to SP)",
    type: "length",
    points: ["PNS", "SP"],
    normMean: 32.4,
    normSD: 3.2,
    normSource: "Lowe 1985",
    clinicalNote: "Distance from posterior nasal spine to tip of soft palate; elongated in OSA",
    tier: "core",
    description: "Soft palate length — elongation associated with OSA",
  },
  {
    id: "Tongue-Length",
    label: "Tongue Length (TT to Eb)",
    type: "length",
    points: ["TT", "Eb"],
    normMean: 76.9,
    normSD: 5.6,
    normSource: "Lowe 1985",
    clinicalNote: "Distance from tongue tip to vallecula/epiglottis base",
    tier: "core",
    description: "Tongue length — relevant for tongue-related airway obstruction",
  },
];

// ─── Advanced measurements (computed when advanced landmarks are placed) ──────
// R-RG moved here: requires PAS_lowest (advanced landmark)
// SP-AW moved here: requires SP_mid (advanced landmark)
const ADVANCED_MEASUREMENTS = [
  {
    id: "R-RG",
    label: "R-RG (Retroglossal Airway Space)",
    type: "length",
    points: ["Eb", "PAS_lowest"],
    normMean: 12.5,
    normSD: 2.8,
    normSource: "McNamara 1984",
    clinicalNote: "Narrowest sagittal dimension at retroglossal level; <5mm associated with OSA",
    tier: "advanced",
    description: "Retroglossal airway width — tongue base level",
  },
  {
    id: "SP-AW",
    label: "SP-AW (Mid-Palate Airway Width)",
    type: "length",
    points: ["SP_mid", "Ad3"],
    normMean: 8.5,
    normSD: 1.8,
    normSource: "Lowe 1985",
    clinicalNote: "Airway width at mid-soft-palate level from SP_mid to posterior pharyngeal wall (Ad3); <5mm associated with OSA",
    tier: "advanced",
    description: "Airway space at mid-soft-palate level — narrowing associated with OSA",
  },
  {
    id: "PNS-AD1",
    label: "PNS-AD1 (PNS to Adenoid Point 1)",
    type: "length",
    points: ["PNS", "Ad1"],
    normMean: 15,
    normSD: 3,
    normSource: "Schulhof 1977",
    clinicalNote: "Distance from PNS to adenoid on PNS-Ba line; decreased in adenoid hypertrophy",
    tier: "advanced",
    description: "Adenoid thickness along PNS-Ba line — adenoid hypertrophy",
  },
  {
    id: "PNS-AD2",
    label: "PNS-AD2 (PNS to Adenoid Point 2)",
    type: "length",
    points: ["PNS", "Ad2"],
    normMean: 18,
    normSD: 4,
    normSource: "Schulhof 1977",
    clinicalNote: "Distance from PNS to adenoid perpendicular to PNS-Ba line",
    tier: "advanced",
    description: "Adenoid depth perpendicular to PNS-Ba — adenoid size",
  },
  {
    id: "MAS",
    label: "MAS (Middle Airway Space)",
    type: "length",
    points: ["Vallecula", "Ad4"],
    normMean: 9.8,
    normSD: 2.5,
    normSource: "Pracharktam 1994",
    clinicalNote: "Middle pharyngeal width at PNS-Pog' midpoint level",
    tier: "advanced",
    description: "Middle airway width — oropharyngeal region",
  },
  {
    id: "IAS",
    label: "IAS (Inferior Airway Space)",
    type: "length",
    points: ["Epiglottis", "PAS_lowest"],
    normMean: 11.6,
    normSD: 3.0,
    normSource: "Pracharktam 1994",
    clinicalNote: "Inferior pharyngeal width at C3-RGN level",
    tier: "advanced",
    description: "Inferior airway width — hypopharyngeal region",
  },
  {
    id: "Oropharyngeal-Depth",
    label: "Oropharyngeal Depth (PNS to Eb)",
    type: "length",
    points: ["PNS", "Eb"],
    normMean: 65.0,
    normSD: 10.0,
    normSource: "McNamara 1984",
    clinicalNote: "Total oropharyngeal depth from PNS to epiglottis base; useful for treatment planning",
    tier: "advanced",
    description: "Total oropharyngeal depth — comprehensive airway assessment",
  },
  {
    id: "Hyoid-C3",
    label: "Hyoid-C3 Distance",
    type: "length",
    points: ["H", "C3"],
    normMean: 20.0,
    normSD: 4.0,
    normSource: "Estimated",
    clinicalNote: "Vertical distance from hyoid to C3; alternative to MP-H for hyoid position assessment",
    tier: "advanced",
    description: "Hyoid vertical position — alternative OSA indicator",
  },
  {
    id: "Mandibular-Body",
    label: "Mandibular Body Length (Go to Me)",
    type: "length",
    points: ["Go", "Me"],
    normMean: 70.0,
    normSD: 5.0,
    normSource: "Estimated",
    clinicalNote: "Length of mandibular body; provides context for interpreting MP-H (short mandible may elevate hyoid)",
    tier: "advanced",
    description: "Mandibular body length — context for airway interpretation",
  },
  {
    id: "Pharyngeal-Area",
    label: "Pharyngeal Airway Area (PNS to Epiglottis)",
    type: "area",
    points: ["PNS", "SP", "Vallecula", "Epiglottis", "Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"],
    normMean: 380,
    normSD: 130,
    normSource: "Riley 1983",
    clinicalNote: "Total sagittal pharyngeal airway area (PNS→Epiglottis); reduced area associated with OSA",
    tier: "advanced",
    description: "Total pharyngeal airway sagittal cross-sectional area from PNS to epiglottis",
  },
  {
    id: "Min-CSA",
    label: "Minimum Estimated Cross-Sectional Area",
    type: "area",
    points: ["PNS", "SP", "Vallecula", "Epiglottis", "Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"],
    normMean: 95,
    normSD: 35,
    normSource: "Estimated from circular model",
    clinicalNote: "Minimum pharyngeal CSA (circular model from narrowest AP width); <50 mm² suggests severe narrowing",
    tier: "advanced",
    description: "Minimum estimated cross-sectional area of the pharynx (circular approximation)",
  },
];

// ─── Exported measurement list (core + advanced) ──────────────────────────────
export const AIRWAY_MEASUREMENTS = [...CORE_MEASUREMENTS, ...ADVANCED_MEASUREMENTS];

// ─── Measurements where HIGHER z-score = more pathological (OSA risk) ────────
// MP-H: elevated hyoid = OSA risk; SP-Length: elongated soft palate = OSA risk
const HIGHER_IS_WORSE = new Set(["MP-H", "SP-Length"]);

// ─── Measurements where LOWER z-score = more pathological (OSA risk) ──────────
const LOWER_IS_WORSE = new Set(["R-PAS", "R-RG", "SP-AW", "Pharyngeal-Area", "Min-CSA"]);

// ─── Core landmark requirement check ──────────────────────────────────────────
export function coreLandmarksComplete(markups) {
  return AIRWAY_LANDMARKS_CORE.every(l => {
    const lo = l.toLowerCase();
    return markups.some(m => m.visible !== false && m.placed !== false && m.label?.toLowerCase() === lo && m.points?.length > 0 && m.points[0].x > -9000);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function findPt(markups, label, ptMap) {
  try {
    if (ptMap) {
      const m = ptMap.get(String(label).toLowerCase());
      if (m && m.visible !== false) {
        const pts = vpts(m);
        if (pts.length > 0) return { x: pts[0].x, y: pts[0].y };
      }
      return null;
    }
    for (const m of markups) {
      if (m.visible === false) continue;
      const lc = String(label).toLowerCase();
      if (m.label === label || m.label?.toLowerCase() === lc || m.templateLabel?.toLowerCase() === lc || m.templateId === label) {
        const pts = vpts(m);
        if (pts.length > 0) return { x: pts[0].x, y: pts[0].y };
      }
    }
    return null;
  } catch { return null; }
}

function buildPtMap(markups) {
  const map = new Map();
  for (const m of markups) {
    if (m.label) map.set(m.label.toLowerCase(), m);
    if (m.templateLabel && m.templateLabel.toLowerCase() !== m.label?.toLowerCase()) map.set(m.templateLabel.toLowerCase(), m);
    if (m.templateId) map.set(m.templateId, m);
  }
  return map;
}

export function sampleBoundaryAtY(pts, y) {
  try {
    if (!pts || pts.length < 2) return null;
    const sorted = [...pts].sort((a, b) => a.y - b.y);
    if (y < sorted[0].y || y > sorted[sorted.length - 1].y) return null;
    for (let i = 1; i < sorted.length; i++) {
      const p0 = sorted[i - 1];
      const p1 = sorted[i];
      if (y >= p0.y && y <= p1.y) {
        const dy = p1.y - p0.y;
        const t = dy === 0 ? 0 : (y - p0.y) / dy;
        return { x: p0.x + t * (p1.x - p0.x), y };
      }
    }
    return null;
  } catch { return null; }
}

export function findNarrowestPoint(anteriorPts, posteriorPts, yMin, yMax, steps) {
  try {
    if (!anteriorPts || !posteriorPts || steps < 1) return null;
    const antSamples = [], postSamples = [];
    for (let i = 0; i <= steps; i++) {
      const y = yMin + (yMax - yMin) * (i / steps);
      const ant = sampleBoundaryAtY(anteriorPts, y);
      const post = sampleBoundaryAtY(posteriorPts, y);
      if (ant) antSamples.push(ant);
      if (post) postSamples.push(post);
    }
    if (!antSamples.length || !postSamples.length) return null;
    let minWidth = Infinity, bestAnt = null, bestPost = null;
    for (const a of antSamples) {
      for (const p of postSamples) {
        const dx = p.x - a.x, dy = p.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minWidth) { minWidth = d; bestAnt = a; bestPost = p; }
      }
    }
    if (!bestAnt || !bestPost || minWidth === Infinity) return null;
    return { width: minWidth, y: (bestAnt.y + bestPost.y) / 2, antPt: bestAnt, postPt: bestPost };
  } catch { return null; }
}

export function traceAirwayBoundary(markups) {
  try {
    const anterior = [];
    const posterior = [];
    for (const m of markups) {
      if (m.visible === false) continue;
      const pts = vpts(m);
      if (pts.length < 2) continue;
      const label = (m.label || "").toLowerCase();
      const isAnterior =
        label.includes("anterior airway") ||
        label.includes("airway anterior") ||
        (label.includes("soft palate") && (label.includes("anterior") || label.includes("silhouette") || m.type === "silhouette")) ||
        label.includes("tongue") ||
        label.includes("epiglottis") ||
        label === "anterior boundary";
      const isPosterior =
        label.includes("posterior airway") ||
        label.includes("airway posterior") ||
        label.includes("pharyngeal") ||
        label.includes("posterior pharyngeal") ||
        label.includes("pharynx") ||
        label === "posterior boundary";
      if (isAnterior) anterior.push(...pts.map(p => ({ x: p.x, y: p.y })));
      if (isPosterior) posterior.push(...pts.map(p => ({ x: p.x, y: p.y })));
    }
    const sortY = (arr) => arr.sort((a, b) => a.y - b.y);
    return {
      anterior: sortY(anterior),
      posterior: sortY(posterior),
    };
  } catch { return { anterior: [], posterior: [] }; }
}

export function sampleCatmullRom(pts, numSamples = 50) {
  try {
    if (!pts || pts.length < 2) return [];
    if (pts.length === 2) {
      const out = [];
      for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        out.push({ x: pts[0].x + t * (pts[1].x - pts[0].x), y: pts[0].y + t * (pts[1].y - pts[0].y) });
      }
      return out;
    }
    const ext = [pts[0], ...pts, pts[pts.length - 1]];
    const out = [];
    const segs = pts.length - 1;
    const samplesPer = Math.max(1, Math.ceil(numSamples / segs));
    for (let i = 0; i < segs; i++) {
      const p0 = ext[i], p1 = ext[i + 1], p2 = ext[i + 2], p3 = ext[i + 3] || ext[ext.length - 1];
      for (let j = 0; j < samplesPer; j++) {
        const t = j / samplesPer, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  } catch { return pts; }
}

export function autoSnapBoundary(imageData, guidePts, windowWidth, windowCenter) {
  try {
    if (!imageData || !guidePts || guidePts.length === 0) return guidePts;
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const ww = windowWidth || 2000;
    const wc = windowCenter || 500;
    const halfWw = ww / 2;
    const lo = wc - halfWw;
    const hi = wc + halfWw;
    const range = hi - lo || 1;

    const snap = (cx, cy) => {
      const ix = Math.round(cx);
      const iy = Math.round(cy);
      if (ix < 1 || ix >= w - 1 || iy < 1 || iy >= h - 1) return { x: cx, y: cy };

      const idx = (iy * w + ix) * 4;
      const val = ((data[idx] + data[idx + 1] + data[idx + 2]) / 3 - lo) / range;

      let bestScore = -Infinity;
      let bestP = { x: cx, y: cy };
      for (let angle = 0; angle < 180; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        for (const sign of [-1, 1]) {
          let prevV = val;
          for (let d = 1; d <= 15; d++) {
            const sx = Math.round(cx + sign * dx * d);
            const sy = Math.round(cy + sign * dy * d);
            if (sx < 0 || sx >= w || sy < 0 || sy >= h) break;
            const si = (sy * w + sx) * 4;
            const sv = ((data[si] + data[si + 1] + data[si + 2]) / 3 - lo) / range;
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const grad = Math.abs(sv - prevV);
              if (grad > bestScore) {
                bestScore = grad;
                bestP = { x: sx, y: sy };
              }
            }
            prevV = sv;
          }
        }
      }
      return bestP;
    };

    return guidePts.map((p) => snap(p.x, p.y));
  } catch { return guidePts; }
}

function getInterpretation(z) {
  if (z === null || z === undefined) return "Unknown";
  if (z < -2) return "Narrow";
  if (z < -1) return "Borderline narrow";
  if (z <= 1) return "Normal";
  return "Wide/Patent";
}

// ─── Stratified airway norms ─────────────────────────────────────────────────

export const AIRWAY_NORMS_STRATIFIED = {
  "R-PAS": {
    source: "McNamara 1984",
    groups: [
      { sex: "M", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.2 },
      { sex: "M", ageMin: 12, ageMax: 16, mean: 11.0, sd: 2.3 },
      { sex: "M", ageMin: 16, ageMax: 20, mean: 11.2, sd: 2.4 },
      { sex: "F", ageMin: 8, ageMax: 12, mean: 9.8, sd: 2.0 },
      { sex: "F", ageMin: 12, ageMax: 16, mean: 10.2, sd: 2.2 },
      { sex: "F", ageMin: 16, ageMax: 20, mean: 10.5, sd: 2.3 },
    ],
  },
  "R-RG": { source: "McNamara 1984", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 10.8, sd: 2.3 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 11.5, sd: 2.5 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 12.0, sd: 2.6 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.0, sd: 2.1 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 10.8, sd: 2.3 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 11.5, sd: 2.5 },
  ]},
  "N-PH": { source: "Solow 1985", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 22.0, sd: 3.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 23.5, sd: 3.2 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 24.5, sd: 3.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 21.0, sd: 2.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 22.5, sd: 3.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 23.5, sd: 3.3 },
  ]},
  "PNS-AD1": { source: "Linder-Aronson 1970", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 14.0, sd: 2.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 15.0, sd: 2.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 15.5, sd: 3.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 13.5, sd: 2.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 14.5, sd: 2.6 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 15.0, sd: 2.8 },
  ]},
  "PNS-AD2": { source: "Linder-Aronson 1970", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 17.0, sd: 3.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 18.0, sd: 3.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 18.5, sd: 4.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 16.5, sd: 3.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 17.5, sd: 3.6 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 18.0, sd: 3.8 },
  ]},
  "MAS": { source: "Battagel 1996", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 9.0, sd: 2.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 9.5, sd: 2.2 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 10.0, sd: 2.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 8.5, sd: 1.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 9.0, sd: 2.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 9.5, sd: 2.3 },
  ]},
  "IAS": { source: "Battagel 1996", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.5 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 11.0, sd: 2.8 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 11.5, sd: 3.0 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.0, sd: 2.3 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 10.5, sd: 2.5 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 11.0, sd: 2.8 },
  ]},
  "MP-H": { source: "Bibby 1984", groups: [
    { sex: "M", ageMin: 8, ageMax: 12, mean: 11.0, sd: 3.0 },
    { sex: "M", ageMin: 12, ageMax: 16, mean: 12.0, sd: 3.3 },
    { sex: "M", ageMin: 16, ageMax: 20, mean: 12.5, sd: 3.5 },
    { sex: "F", ageMin: 8, ageMax: 12, mean: 10.5, sd: 2.8 },
    { sex: "F", ageMin: 12, ageMax: 16, mean: 11.5, sd: 3.0 },
    { sex: "F", ageMin: 16, ageMax: 20, mean: 12.0, sd: 3.3 },
  ]},
  "Tongue-Length": {
    source: "Samman et al. 2003 (Hong Kong Chinese) — East Asian strata",
    note: "Caucasian adult default 76.9±5.6 (Lowe 1985) may overestimate by 5–15 mm for East Asian patients",
    groups: [
      { sex: "M", ageMin: 18, ageMax: 40, mean: 72.0, sd: 4.1 },
      { sex: "F", ageMin: 18, ageMax: 40, mean: 64.8, sd: 4.0 },
    ],
  },
};

export function lookupAirwayNorm(id, sex, age) {
  try {
    if (sex && age !== undefined && age !== null) {
      const stratified = AIRWAY_NORMS_STRATIFIED[id];
      if (stratified) {
        const sexUpper = sex.toUpperCase();
        for (const g of stratified.groups) {
          if (g.sex === sexUpper && age >= g.ageMin && age < g.ageMax) {
            return { mean: g.mean, sd: g.sd, source: stratified.source };
          }
        }
      }
    }
    const fallback = AIRWAY_NORMS[id];
    if (fallback) return { mean: fallback.mean, sd: fallback.sd, source: fallback.source };
    return null;
  } catch { return null; }
}

function getClinicalNote(id, value) {
  if (id === "R-PAS" && value !== null && value < 5) return "Retropalatal narrowing <5mm — strong OSA screening indicator";
  if (id === "R-PAS" && value !== null && value < 8) return "Retropalatal narrowing — consider sleep apnea screening";
  if (id === "R-RG" && value !== null && value < 5) return "Retroglossal narrowing <5mm — associated with OSA";
  if (id === "MP-H" && value !== null && value > 15) return "Inferiorly positioned hyoid — associated with OSA";
  if (id === "SP-Length" && value !== null && value > 35) return "Elongated soft palate — may contribute to pharyngeal collapse";
  if (id === "Pharyngeal-Area" && value !== null && value < 200) return "Reduced pharyngeal airway area — possible constriction";
  if (id === "Min-CSA" && value !== null && value < 50) return "Minimum cross-sectional area <50 mm² — strong OSA indicator";
  return null;
}

function buildGlobalClinicalNote(results) {
  const narrowing = results.filter((r) => r.zScore !== null && r.id !== "_global" && r.id !== "_magnification" &&
    ((LOWER_IS_WORSE.has(r.id) && r.zScore < -2) || (HIGHER_IS_WORSE.has(r.id) && r.zScore > 2)));
  if (narrowing.length >= 2) return "Multiple airway measurements outside normal range — comprehensive airway evaluation recommended";
  const allNormal = results.filter(r => r.id !== "_global" && r.id !== "_magnification").every((r) => r.zScore === null || Math.abs(r.zScore) <= 1);
  if (allNormal && results.some((r) => r.zScore !== null)) return "Airway measurements within expected range";
  return null;
}

// ─── Airway measurement computation ──────────────────────────────────────────

export function computeAirwayMeasurements(markups, calibration, sex, age) {
  try {
    if (!markups || !Array.isArray(markups)) return [];
    const calDone = calibration?.done === true;
    const ppm = calDone ? (calibration.pxPerMm || 1) : 1;

    const ptMap = buildPtMap(markups);
    const find = (label) => findPt(markups, label, ptMap);

    const results = [];

    for (const def of AIRWAY_MEASUREMENTS) {
      try {
        const pts = def.points.map((label) => find(label));
        let validPts = pts.filter((p) => p !== null);
        const reqLen = def.type === "length" || def.type === "area" ? 2 : def.points.length;

        if (validPts.length < reqLen) {
          const norm = lookupAirwayNorm(def.id, sex, age);
          results.push({
            id: def.id,
            label: def.label,
            tier: def.tier,
            value: null,
            unit: calDone ? "mm" : "px",
            normMean: norm ? norm.mean : def.normMean,
            normSD: norm ? norm.sd : def.normSD,
            normSource: norm ? norm.source : def.normSource,
            zScore: null,
            interpretation: "Missing landmarks",
            points: validPts,
          });
          continue;
        }

        let value = null;
        let unit = calDone ? "mm" : "px";

        if (def.id === "MP-H") {
          const h = pts[0];
          const go = pts[1];
          const me = pts[2];
          if (h && go && me) {
            const num = Math.abs(
              (me.y - go.y) * h.x -
                (me.x - go.x) * h.y +
                me.x * go.y -
                me.y * go.x
            );
            const den = dist(go, me);
            value = den < 1e-9 ? 0 : num / den;
            if (calDone) value /= ppm;
          }
        } else if (def.id === "R-PAS") {
          // McNamara R-PAS: narrowest AP dimension at retropalatal level,
          // not simply SP→Ad3 distance. Scan from PNS to SP level.
          const antPts = ["PNS", "SP"].map(find).filter(Boolean).sort((a, b) => a.y - b.y);
          const postPts = ["Ad1", "Ad2", "Ad3"].map(find).filter(Boolean).sort((a, b) => a.y - b.y);
          if (antPts.length >= 2 && postPts.length >= 2) {
            const yMin = antPts[0].y;
            const yMax = antPts[antPts.length - 1].y;
            const narrowest = findNarrowestPoint(antPts, postPts, yMin, yMax, 50);
            if (narrowest) {
              value = narrowest.width;
              if (calDone) value /= ppm;
              validPts = [narrowest.antPt, narrowest.postPt];
            } else {
              value = dist(validPts[0], validPts[1]);
              if (calDone) value /= ppm;
            }
          } else {
            value = dist(validPts[0], validPts[1]);
            if (calDone) value /= ppm;
          }
        } else if (def.id === "Pharyngeal-Area") {
          // Total sagittal pharyngeal area: closed polygon of anterior + posterior boundaries
          const antLabels = ["PNS", "SP", "Vallecula", "Epiglottis"];
          const postLabels = ["Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"];
          const antRaw = antLabels.map(l => find(l)).filter(Boolean).sort((a, b) => a.y - b.y);
          const postRaw = postLabels.map(l => find(l)).filter(Boolean).sort((a, b) => a.y - b.y);
          if (antRaw.length >= 2 && postRaw.length >= 2) {
            const antSmooth = sampleCatmullRom(antRaw, 30);
            const postSmooth = sampleCatmullRom(postRaw, 30);
            // Closed polygon: anterior top→bottom + posterior bottom→top
            const poly = [...antSmooth, ...postSmooth.reverse()];
            let area = 0;
            for (let i = 0; i < poly.length; i++) {
              const j = (i + 1) % poly.length;
              area += poly[i].x * poly[j].y;
              area -= poly[j].x * poly[i].y;
            }
            value = Math.abs(area) / 2;
            if (calDone) value /= (ppm * ppm);
            unit = calDone ? "mm²" : "px²";
          }
        } else if (def.id === "Min-CSA") {
          // Minimum cross-sectional area: circular model from narrowest AP width
          const antLabels = ["PNS", "SP", "Vallecula", "Epiglottis"];
          const postLabels = ["Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"];
          const antRaw = antLabels.map(l => find(l)).filter(Boolean).sort((a, b) => a.y - b.y);
          const postRaw = postLabels.map(l => find(l)).filter(Boolean).sort((a, b) => a.y - b.y);
          if (antRaw.length >= 2 && postRaw.length >= 2) {
            const antSmooth = sampleCatmullRom(antRaw, 50);
            const postSmooth = sampleCatmullRom(postRaw, 50);
            const yMin = Math.max(antSmooth[0]?.y || 0, postSmooth[postSmooth.length - 1]?.y || 0);
            const yMax = Math.min(antSmooth[antSmooth.length - 1]?.y || 0, postSmooth[0]?.y || 0);
            if (yMin < yMax) {
              const narrowest = findNarrowestPoint(antSmooth, postSmooth, yMin, yMax, 100);
              if (narrowest) {
                let w = narrowest.width;
                if (calDone) w /= ppm;
                value = Math.PI * (w / 2) ** 2;
                unit = calDone ? "mm²" : "px²";
              }
            }
          }
        } else if (def.type === "length" && validPts.length >= 2) {
          value = dist(validPts[0], validPts[1]);
          if (calDone) value /= ppm;
        }

        const norm = lookupAirwayNorm(def.id, sex, age);
        const nMean = norm ? norm.mean : def.normMean;
        const nSD = norm ? norm.sd : def.normSD;
        const nSource = norm ? norm.source : def.normSource;

        // Skip z-score when not calibrated (pixel values vs mm norms are meaningless)
        const zScore = (value !== null && calDone && nSD > 0)
          ? (value - nMean) / nSD
          : null;
        const interpretation =
          value !== null && calDone
            ? getInterpretation(zScore)
            : value !== null
              ? "Calibration required for z-score"
              : "Missing landmarks";
        const clinicalNote = getClinicalNote(def.id, value);

        results.push({
          id: def.id,
          label: def.label,
          tier: def.tier,
          value,
          unit,
          normMean: nMean,
          normSD: nSD,
          normSource: nSource,
          zScore,
          interpretation,
          clinicalNote,
          points: validPts,
        });
      } catch {
        results.push({
          id: def.id,
          label: def.label,
          tier: def.tier,
          value: null,
          unit: calDone ? "mm" : "px",
          normMean: def.normMean,
          normSD: def.normSD,
          normSource: def.normSource,
          zScore: null,
          interpretation: "Computation error",
          points: [],
        });
      }
    }

    // 2D magnification disclaimer (S6)
    if (calDone) {
      results.push({
        id: "_magnification",
        label: "Note: Lateral ceph radiographs have ~8-10% 2D magnification. Measurements may overestimate true dimensions.",
        tier: "core",
        value: null,
        unit: "",
        normMean: null,
        normSD: null,
        normSource: null,
        zScore: null,
        interpretation: "2D magnification disclaimer",
        points: [],
      });
    }

    const globalNote = buildGlobalClinicalNote(results);
    if (globalNote) {
      results.push({
        id: "_global",
        label: "Summary",
        tier: "core",
        value: null,
        unit: "",
        normMean: null,
        normSD: null,
        zScore: null,
        interpretation: globalNote,
        clinicalNote: globalNote,
        points: [],
      });
    }

    return results;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REC 1: Generate smooth airway boundaries from placed landmarks
// ═══════════════════════════════════════════════════════════════════════════════

export function generateAirwayBoundaries(markups, imageData) {
  try {
    const find = (label) => {
      const lc = String(label).toLowerCase();
      const m = markups.find(mk => mk.type === "point" && (mk.label === label || mk.label?.toLowerCase() === lc || mk.templateLabel?.toLowerCase() === lc || mk.templateId === label) && mk.visible !== false && mk.placed !== false);
      if (!m) return null;
      const pts = vpts(m);
      return pts.length ? { x: pts[0].x, y: pts[0].y } : null;
    };

    // Anterior boundary: PNS → SP → Vallecula → Epiglottis → TT
    // Use only landmarks that are available (some are advanced tier)
    const anteriorLabels = ["PNS", "SP", "Vallecula", "Epiglottis", "TT"];
    const anteriorRaw = anteriorLabels.map(find).filter(Boolean);
    // Posterior boundary: Ad1 → Ad2 → Ad3 → Ad4 → PAS_lowest
    // Use only landmarks that are available
    const posteriorLabels = ["Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"];
    const posteriorRaw = posteriorLabels.map(find).filter(Boolean)
      .sort((a, b) => b.y - a.y);

    if (anteriorRaw.length < 2 && posteriorRaw.length < 2) return null;

    let anteriorSmooth = anteriorRaw.length >= 2 ? sampleCatmullRom(anteriorRaw, 50) : [];
    let posteriorSmooth = posteriorRaw.length >= 2 ? sampleCatmullRom(posteriorRaw, 50) : [];

    if (imageData) {
      const ww = 2000, wc = 500;
      if (anteriorSmooth.length > 0) anteriorSmooth = autoSnapBoundary(imageData, anteriorSmooth, ww, wc);
      if (posteriorSmooth.length > 0) posteriorSmooth = autoSnapBoundary(imageData, posteriorSmooth, ww, wc);
    }

    return {
      anterior: anteriorSmooth,
      posterior: posteriorSmooth,
    };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REC 2: OSA risk score — directional z-scores
// ═══════════════════════════════════════════════════════════════════════════════

export function computeAirwayRiskScore(measurements) {
  try {
    if (!measurements || measurements.length === 0) return null;

    const riskKeys = new Set(["R-PAS", "R-RG", "MP-H", "SP-Length", "SP-AW", "Pharyngeal-Area", "Min-CSA"]);
    const directionalScores = [];
    for (const m of measurements) {
      if (riskKeys.has(m.id) && m.zScore != null && isFinite(m.zScore)) {
        // Normalize: convert to "pathological direction" where positive = worse
        if (HIGHER_IS_WORSE.has(m.id)) {
          directionalScores.push(m.zScore);
        } else if (LOWER_IS_WORSE.has(m.id)) {
          directionalScores.push(-m.zScore);
        }
      }
    }
    if (directionalScores.length === 0) return null;

    const meanPathZ = directionalScores.reduce((a, b) => a + b, 0) / directionalScores.length;
    const maxPathZ = Math.max(...directionalScores);
    const flagged = directionalScores.filter(z => z > 1).length;
    const critical = directionalScores.filter(z => z > 2).length;

    let risk = "low";
    if (critical >= 2 || meanPathZ > 1.5 || maxPathZ > 2.5) risk = "high";
    else if (critical >= 1 || flagged >= 2 || meanPathZ > 0.8) risk = "moderate";

    let summary;
    if (risk === "high") summary = "Elevated airway risk — multiple measurements significantly outside normal. Comprehensive airway evaluation recommended, including sleep study referral if OSA suspected.";
    else if (risk === "moderate") summary = "Borderline airway measurements — some dimensions outside expected range. Consider clinical correlation with symptoms.";
    else summary = "Airway measurements within expected range — no significant narrowing detected.";

    return { score: meanPathZ, risk, summary, measuredCount: directionalScores.length, flaggedCount: flagged, criticalCount: critical };
  } catch { return null; }
}
