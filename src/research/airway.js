// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY — Cephalometric airway measurement computation engine
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts, dist } from "../lib/utils.js";
import { AIRWAY_NORMS } from "../data/norms.js";

// Phase 0 of docs/AIRWAY_MODULE_REWRITE_PLAN.md: measurements come from landmarks
// only, there is no risk score or clinical note, and a z-score is shown only for
// adults, on the two measures whose reference values remain (data/norms.js AIRWAY_NORMS).

export const AIRWAY_REVISION_NOTICE = "Airway analysis is being revised. Measurements are shown, but most reference comparisons are withheld until their sources are checked. These results don't diagnose airway disease or sleep apnea.";

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
    tier: "core",
    description: "Nasion to posterior pharyngeal wall distance — adenoid screening",
  },
  {
    id: "R-PAS",
    label: "R-PAS (Retropalatal Airway Space)",
    type: "length",
    points: ["SP", "Ad3"],
    tier: "core",
    description: "Retropalatal airway width",
  },
  {
    id: "MP-H",
    label: "MP-H (Hyoid to Mandibular Plane)",
    type: "length",
    points: ["H", "Go", "Me"],
    tier: "core",
    description: "Hyoid position relative to mandibular plane",
  },
  {
    id: "SP-Length",
    label: "Soft Palate Length (PNS to SP)",
    type: "length",
    points: ["PNS", "SP"],
    tier: "core",
    description: "Soft palate length",
  },
  {
    id: "Tongue-Length",
    label: "Tongue Length (TT to Eb)",
    type: "length",
    points: ["TT", "Eb"],
    tier: "core",
    description: "Tongue length",
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
    tier: "advanced",
    description: "Retroglossal airway width — tongue base level",
  },
  {
    id: "SP-AW",
    label: "SP-AW (Mid-Palate Airway Width)",
    type: "length",
    points: ["SP_mid", "Ad3"],
    tier: "advanced",
    description: "Airway space at mid-soft-palate level",
  },
  {
    id: "PNS-AD1",
    label: "PNS-AD1 (PNS to Adenoid Point 1)",
    type: "length",
    points: ["PNS", "Ad1"],
    tier: "advanced",
    description: "Adenoid thickness along PNS-Ba line — adenoid hypertrophy",
  },
  {
    id: "PNS-AD2",
    label: "PNS-AD2 (PNS to Adenoid Point 2)",
    type: "length",
    points: ["PNS", "Ad2"],
    tier: "advanced",
    description: "Adenoid depth perpendicular to PNS-Ba — adenoid size",
  },
  {
    id: "MAS",
    label: "MAS (Middle Airway Space)",
    type: "length",
    points: ["Vallecula", "Ad4"],
    tier: "advanced",
    description: "Middle airway width — oropharyngeal region",
  },
  {
    id: "IAS",
    label: "IAS (Inferior Airway Space)",
    type: "length",
    points: ["Epiglottis", "PAS_lowest"],
    tier: "advanced",
    description: "Inferior airway width — hypopharyngeal region",
  },
  {
    id: "Oropharyngeal-Depth",
    label: "Oropharyngeal Depth (PNS to Eb)",
    type: "length",
    points: ["PNS", "Eb"],
    tier: "advanced",
    description: "Total oropharyngeal depth — comprehensive airway assessment",
  },
  {
    id: "Hyoid-C3",
    label: "Hyoid-C3 Distance",
    type: "length",
    points: ["H", "C3"],
    tier: "advanced",
    description: "Hyoid position",
  },
  {
    id: "Mandibular-Body",
    label: "Mandibular Body Length (Go to Me)",
    type: "length",
    points: ["Go", "Me"],
    tier: "advanced",
    description: "Mandibular body length — context for airway interpretation",
  },
  {
    id: "Pharyngeal-Area",
    label: "Pharyngeal Airway Area (PNS to Epiglottis)",
    type: "area",
    points: ["PNS", "SP", "Vallecula", "Epiglottis", "Ad1", "Ad2", "Ad3", "Ad4", "PAS_lowest"],
    tier: "advanced",
    description: "Total pharyngeal airway sagittal cross-sectional area from PNS to epiglottis",
  },
];

// ─── Exported measurement list (core + advanced) ──────────────────────────────
export const AIRWAY_MEASUREMENTS = [...CORE_MEASUREMENTS, ...ADVANCED_MEASUREMENTS];

// Measurements where a higher value is the direction of concern.
const HIGHER_IS_WORSE = new Set(["MP-H", "SP-Length"]);

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

// Snap guide points to the strongest nearby edge in the radiograph. `imageData`
// must be in IMAGE coordinates (the image's own pixels, 8-bit). Points with no
// clear edge within 15 px stay where they are; the result is lightly smoothed
// so one strong bone edge cannot pull a single point out of line.
export function autoSnapBoundary(imageData, guidePts, windowWidth, windowCenter) {
  try {
    if (!imageData || !guidePts || guidePts.length === 0) return guidePts;
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const ww = windowWidth || 256;
    const wc = windowCenter || 128;
    const MIN_EDGE = 0.04; // normalised intensity step per pixel
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
      return bestScore >= MIN_EDGE ? bestP : { x: cx, y: cy };
    };

    const snapped = guidePts.map((p) => snap(p.x, p.y));
    return snapped.map((p, i) => {
      const win = snapped.slice(Math.max(0, i - 2), i + 3);
      return { x: win.reduce((a, q) => a + q.x, 0) / win.length, y: win.reduce((a, q) => a + q.y, 0) / win.length };
    });
  } catch { return guidePts; }
}

// Which way is pathological, for wording (airway widths/areas: smaller is
// worse; hyoid distance and soft-palate length: larger is worse; the rest are
// sizes with no "good" direction).
const SMALLER_IS_NARROWER = new Set(["R-PAS", "R-RG", "SP-AW", "MAS", "IAS", "Pharyngeal-Area", "N-PH", "PNS-AD1", "PNS-AD2"]);

export function getInterpretation(z, id) {
  if (z === null || z === undefined || !isFinite(z)) return "Unknown";
  if (SMALLER_IS_NARROWER.has(id)) {
    if (z < -2) return "Narrow";
    if (z < -1) return "Borderline narrow";
    if (z <= 1) return "Normal";
    return "Wider than average";
  }
  if (HIGHER_IS_WORSE.has(id)) {
    if (z > 2) return "Increased";
    if (z > 1) return "Borderline increased";
    if (z >= -1) return "Normal";
    return "Below average";
  }
  if (z > 2) return "Well above average";
  if (z > 1) return "Above average";
  if (z >= -1) return "Normal";
  if (z >= -2) return "Below average";
  return "Well below average";
}

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

// The reference for a patient, or null. The remaining references are adult values,
// so children get none, and without an age the patient could be a child.
export function lookupAirwayNorm(id, ageIn) {
  try {
    const norm = AIRWAY_NORMS[id];
    const age = normalizeAge(ageIn);
    return norm && age !== null && age >= 18 ? { mean: norm.mean, sd: norm.sd, source: norm.source } : null;
  } catch { return null; }
}

// Why a calibrated measurement has no z-score.
function noReferenceReason(id, ageIn) {
  if (!AIRWAY_NORMS[id]) return "Reference under review";
  return normalizeAge(ageIn) === null ? "Add the patient's age to compare" : "No reference for this age";
}

// Saved studies hold results from before Phase 0: show them by the current rules.
export function airwayResultsForDisplay(measurements) {
  return (measurements || [])
    .filter(m => m.id !== "_global" && m.id !== "Min-CSA")
    .map(m => {
      const { clinicalNote: _note, ...rest } = m;
      if (String(m.id).startsWith("_") || AIRWAY_NORMS[m.id]) return rest;
      return { ...rest, normMean: null, normSD: null, normSource: null, zScore: null, interpretation: m.value != null ? "Reference under review" : m.interpretation };
    });
}

// ─── Airway measurement computation ──────────────────────────────────────────

export function computeAirwayMeasurements(markups, calibration, age) {
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
          const norm = lookupAirwayNorm(def.id, age);
          results.push({
            id: def.id,
            label: def.label,
            tier: def.tier,
            value: null,
            unit: calDone ? "mm" : "px",
            normMean: norm ? norm.mean : null,
            normSD: norm ? norm.sd : null,
            normSource: norm ? norm.source : null,
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
        } else if (def.type === "length" && validPts.length >= 2) {
          value = dist(validPts[0], validPts[1]);
          if (calDone) value /= ppm;
        }

        const norm = lookupAirwayNorm(def.id, age);
        const zScore = (value !== null && calDone && norm && norm.sd > 0)
          ? (value - norm.mean) / norm.sd
          : null;
        const interpretation =
          value === null ? "Missing landmarks"
            : !calDone ? "Calibration required for z-score"
            : zScore !== null ? getInterpretation(zScore, def.id)
            : noReferenceReason(def.id, age);

        results.push({
          id: def.id,
          label: def.label,
          tier: def.tier,
          value,
          unit,
          normMean: norm ? norm.mean : null,
          normSD: norm ? norm.sd : null,
          normSource: norm ? norm.source : null,
          zScore,
          interpretation,
          points: validPts,
        });
      } catch {
        results.push({
          id: def.id,
          label: def.label,
          tier: def.tier,
          value: null,
          unit: calDone ? "mm" : "px",
          normMean: null,
          normSD: null,
          normSource: null,
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

    // Anterior boundary, top to bottom: PNS → SP → Epiglottis tip → Vallecula.
    // Use only landmarks that are available (some are advanced tier)
    const anteriorLabels = ["PNS", "SP", "Epiglottis", "Vallecula"];
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
      // 8-bit pixels: full range, no windowing.
      if (anteriorSmooth.length > 0) anteriorSmooth = autoSnapBoundary(imageData, anteriorSmooth, 256, 128);
      if (posteriorSmooth.length > 0) posteriorSmooth = autoSnapBoundary(imageData, posteriorSmooth, 256, 128);
    }

    return {
      anterior: anteriorSmooth,
      posterior: posteriorSmooth,
    };
  } catch { return null; }
}
