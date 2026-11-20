// ═══════════════════════════════════════════════════════════════════════════════
// landmarkReliability.js — reliability of landmark PLACEMENT (not of measurements)
//
// Each placement of a landmark is compared only with other placements of the same
// landmark on the same case (never across patients):
//   • consensus: against the mean of the group's placements. Groups are the case
//     (inter-rater, method comparison without a reference) or case × operator
//     (intra-rater: a rater against themself).
//   • reference: in a method comparison with a reference operator (e.g. AI against
//     an expert), against the reference operator's placement on that case.
//
// Coordinates are in mm (px when a session isn't calibrated) in the patient frame
// (x anterior, y superior), then, by default, in a per-case S–N frame: origin at
// the case's mean S, x along mean S → mean N, y perpendicular (superior). Using the
// means of every placement on the case keeps one rater's S or N from defining it.
// The frame matters for the per-axis numbers and for ICC across cases; radial
// errors don't depend on it.
//
// Each landmark's x and y also become rows ("S (x)", "S (y)") for the usual ICC /
// Bland-Altman / Dahlberg analysis (reliability.js) and the R script.
// ═══════════════════════════════════════════════════════════════════════════════

import { resolveFacing } from "../lib/measureConventions.js";
import { sessionCalibration } from "./collect.js";

export const SDR_RADII = [1, 2, 2.5, 3, 4];
const CHI2_2DF_95 = 5.991;
const hasLandmarkSetting = (c) => Array.isArray(c?.landmarkLabels);

// Point labels to analyse. Studies saved before this setting existed, with no
// measurements, analyse every landmark (as their error map did).
export function landmarkLabelsFor(config, sessions, hasMeasurements) {
  if (hasLandmarkSetting(config)) return config.landmarkLabels;
  if (hasMeasurements) return [];
  return [...new Set((sessions || []).flatMap((s) => (s?.markups || []).filter(isPlacedPoint).map((m) => m.label)))];
}

const isPlacedPoint = (m) => m?.type === "point" && m.label && m.placed !== false && m.visible !== false && m.points?.[0];

// sessionId → { caseId, caseName, operatorId, occasion }
function sessionMapOf(config) {
  const map = new Map();
  for (const c of config?.cases || []) for (const cs of c.sessions || []) {
    if (cs.sessionId) map.set(cs.sessionId, { caseId: c.id, caseName: c.name || c.id, operatorId: cs.operatorId, occasion: cs.occasion });
  }
  return map;
}

// One placement per (session, landmark), patient frame.
export function collectPlacements(sessions, config, calibration, labels) {
  const want = new Set(labels || []);
  const map = sessionMapOf(config);
  const out = [];
  for (const s of sessions || []) {
    const where = s && map.get(s.id);
    if (!where) continue;
    const cal = sessionCalibration(s, calibration);
    const ppm = cal?.done ? cal.pxPerMm || 1 : 1;
    const unit = cal?.done ? "mm" : "px";
    const fx = resolveFacing(s.facing, s.markups || []) === "left" ? -1 : 1;
    const seen = new Set();
    for (const m of s.markups || []) {
      if (!isPlacedPoint(m) || !want.has(m.label) || seen.has(m.label)) continue;
      seen.add(m.label);
      const p = m.points[0];
      out.push({ ...where, sessionId: s.id, label: m.label, x: (fx * p.x) / ppm, y: -p.y / ppm, unit });
    }
  }
  return out;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const meanPoint = (ps) => ({ x: mean(ps.map((p) => p.x)), y: mean(ps.map((p) => p.y)) });

// Placements in the study frame (`fx`, `fy`), plus how each case was framed.
// `S` and `N` must be among the collected landmarks for the S–N frame; they're
// gathered for framing even if not analysed (see analyzeLandmarks).
export function toStudyFrame(placements, frame = "SN") {
  const byCase = new Map();
  for (const p of placements) (byCase.get(p.caseId) || byCase.set(p.caseId, []).get(p.caseId)).push(p);
  const out = [], frames = {};
  for (const [caseId, ps] of byCase) {
    const S = ps.filter((p) => p.label === "S"), N = ps.filter((p) => p.label === "N");
    const s = S.length ? meanPoint(S) : null, n = N.length ? meanPoint(N) : null;
    let ux = { x: 1, y: 0 }, origin = s || { x: 0, y: 0 }, used = s ? "image (origin at S)" : "image";
    if (frame === "SN" && s && n && Math.hypot(n.x - s.x, n.y - s.y) > 1e-9) {
      const len = Math.hypot(n.x - s.x, n.y - s.y);
      ux = { x: (n.x - s.x) / len, y: (n.y - s.y) / len };
      used = "SN";
    }
    const uy = { x: -ux.y, y: ux.x }; // +90°: superior when x points anterior
    frames[caseId] = used;
    for (const p of ps) {
      const dx = p.x - origin.x, dy = p.y - origin.y;
      out.push({ ...p, fx: dx * ux.x + dy * ux.y, fy: dx * uy.x + dy * uy.y });
    }
  }
  return { placements: out, frames };
}

// Rows for the ICC / Bland-Altman pipeline: "<landmark> (x)" and "<landmark> (y)".
export function coordinateRows(framed, labels) {
  const want = new Set(labels);
  const rows = [];
  for (const p of framed) {
    if (!want.has(p.label)) continue;
    for (const axis of ["x", "y"]) {
      rows.push({
        caseId: p.caseId, caseName: p.caseName, operatorId: p.operatorId, occasion: p.occasion, sessionId: p.sessionId,
        label: `${p.label} (${axis})`, measureKey: "coordinate", value: axis === "x" ? p.fx : p.fy, unit: p.unit,
        landmark: p.label, axis,
      });
    }
  }
  return rows;
}

function ellipse95(sxx, syy, sxy) {
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, tr * tr - 4 * det));
  const e1 = Math.max(0, (tr + disc) / 2), e2 = Math.max(0, (tr - disc) / 2);
  const angle = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI; // of the major axis, from x
  return { major: Math.sqrt(CHI2_2DF_95 * e1), minor: Math.sqrt(CHI2_2DF_95 * e2), angle };
}

// Per-landmark error statistics. → [{ landmark, … }] sorted by label.
export function landmarkErrors(framed, labels, { design = "intra", operators = [] } = {}) {
  const refOps = new Set((operators || []).filter((o) => o?.role === "reference").map((o) => o.id));
  const referenceMode = design === "method_comparison" && refOps.size > 0;
  const groupOf = (p) => (design === "intra" ? `${p.caseId}|${p.operatorId}` : p.caseId);
  const out = [];
  for (const label of [...new Set(labels)].sort()) {
    const ps = framed.filter((p) => p.label === label);
    const groups = new Map();
    for (const p of ps) (groups.get(groupOf(p)) || groups.set(groupOf(p), []).get(groupOf(p))).push(p);
    const devs = [], pairs = [];
    let df = 0, groupsUsed = 0;
    for (const g of groups.values()) {
      if (referenceMode) {
        const ref = g.filter((p) => refOps.has(p.operatorId)), rest = g.filter((p) => !refOps.has(p.operatorId));
        if (!ref.length || !rest.length) continue;
        const r = { x: mean(ref.map((p) => p.fx)), y: mean(ref.map((p) => p.fy)) };
        for (const p of rest) devs.push({ dx: p.fx - r.x, dy: p.fy - r.y });
        groupsUsed++;
      } else {
        if (g.length < 2) continue;
        const c = { x: mean(g.map((p) => p.fx)), y: mean(g.map((p) => p.fy)) };
        for (const p of g) devs.push({ dx: p.fx - c.x, dy: p.fy - c.y });
        for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pairs.push(Math.hypot(g[i].fx - g[j].fx, g[i].fy - g[j].fy));
        df += g.length - 1;
        groupsUsed++;
      }
    }
    const unit = ps[0]?.unit || "mm";
    if (!devs.length) {
      out.push({ landmark: label, unit, skip: true, reason: referenceMode ? "No case has this landmark from both the reference and another rater." : "No case has this landmark placed at least twice." });
      continue;
    }
    const radial = devs.map((d) => Math.hypot(d.dx, d.dy));
    const sorted = [...radial].sort((a, b) => a - b);
    // Spread per axis: about the group means (pooled, unbiased) for consensus; about
    // the reference as given (RMS) for a reference, with the mean offset as bias.
    const div = referenceMode ? devs.length : Math.max(1, df);
    const biasX = referenceMode ? mean(devs.map((d) => d.dx)) : 0, biasY = referenceMode ? mean(devs.map((d) => d.dy)) : 0;
    const sxx = devs.reduce((a, d) => a + (d.dx - biasX) ** 2, 0) / (referenceMode ? Math.max(1, devs.length - 1) : div);
    const syy = devs.reduce((a, d) => a + (d.dy - biasY) ** 2, 0) / (referenceMode ? Math.max(1, devs.length - 1) : div);
    const sxy = devs.reduce((a, d) => a + (d.dx - biasX) * (d.dy - biasY), 0) / (referenceMode ? Math.max(1, devs.length - 1) : div);
    const mre = mean(radial);
    out.push({
      landmark: label, unit, mode: referenceMode ? "reference" : "consensus",
      cases: groupsUsed, placements: referenceMode ? devs.length : devs.length,
      meanRadial: mre,
      sdRadial: radial.length > 1 ? Math.sqrt(radial.reduce((a, r) => a + (r - mre) ** 2, 0) / (radial.length - 1)) : null,
      medianRadial: sorted[Math.floor((sorted.length - 1) / 2)] / 2 + sorted[Math.ceil((sorted.length - 1) / 2)] / 2,
      maxRadial: sorted[sorted.length - 1],
      sdX: Math.sqrt(sxx), sdY: Math.sqrt(syy),
      meanPairDistance: pairs.length ? mean(pairs) : null,
      ...(referenceMode ? { biasX, biasY } : {}),
      sdr: unit === "mm" ? Object.fromEntries(SDR_RADII.map((r) => [r, radial.filter((v) => v <= r).length / radial.length])) : null,
      ellipse: { ...ellipse95(sxx, syy, sxy), unit },
    });
  }
  return out;
}

// Everything reliability.js needs. `labels` are the landmarks analysed; S and N
// are collected anyway for the frame.
export function analyzeLandmarks(sessions, config, calibration, labels) {
  if (!labels?.length) return { rows: [], errors: [], summary: null };
  const frame = config?.landmarkFrame === "image" ? "image" : "SN";
  const collect = frame === "SN" ? [...new Set([...labels, "S", "N"])] : labels;
  const placements = collectPlacements(sessions, config, calibration, collect);
  const { placements: framed, frames } = toStudyFrame(placements, frame);
  const errors = landmarkErrors(framed, labels, config);
  const units = new Set(framed.filter((p) => labels.includes(p.label)).map((p) => p.unit));
  const notes = [];
  if (frame === "SN" && Object.values(frames).some((f) => f !== "SN")) {
    notes.push("Some cases have no S or N placed, so their coordinates use the image axes instead of the S–N frame; their per-axis numbers and coordinate ICCs aren't comparable with the rest.");
  }
  if (units.size > 1) notes.push("Calibrated and uncalibrated sessions are mixed: some errors are in mm and some in px. Calibrate every session.");
  if (units.has("px") && units.size === 1) notes.push("No session is calibrated, so landmark errors are in pixels and success rates (within 2 mm…) can't be given.");
  // Mean position per landmark across cases (S–N frame) for the error-envelope map.
  const positions = {};
  for (const l of labels) {
    const ps = framed.filter((p) => p.label === l);
    if (ps.length) positions[l] = { x: mean(ps.map((p) => p.fx)), y: mean(ps.map((p) => p.fy)) };
  }
  return {
    rows: coordinateRows(framed, labels),
    errors,
    summary: { frame, frames, unit: units.size === 1 ? [...units][0] : "mixed", positions, notes, reference: errors.find((e) => e.mode)?.mode || null },
  };
}
