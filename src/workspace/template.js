// ═══════════════════════════════════════════════════════════════════════════════
// Template loading + auto-measurement creation
// ═══════════════════════════════════════════════════════════════════════════════

import { uid, dist, primaryMeasure } from "../lib/utils.js";
import { resolveFacing } from "../lib/measureConventions.js";
import { PREDEFINED } from "../data/constants.js";

// Value a computed measurement (ratio/sum/difference/percentage) reads from a
// referenced markup: its primary measurement, never a raw coordinate.
export function getMeasValue(m, calibration, ctx) {
  const pm = primaryMeasure(m, calibration, ctx);
  if (pm) return pm.value;
  if ((m.type === "line" || m.type === "parallel" || m.type === "ruler" || m.type === "arrow") && m.points?.length >= 2) {
    const ppm = calibration?.done ? (calibration.pxPerMm || 1) : 1;
    return dist(m.points[0], m.points[1]) / ppm;
  }
  return 0;
}

function resolveLabel(rl, placedByLabel, placedByTemplateLabel) {
  return placedByTemplateLabel[rl] || placedByLabel[rl] || null;
}

function buildLookups(markups) {
  const byLabel = {}, byTemplateLabel = {};
  for (const m of markups) {
    if (m.label) byLabel[m.label] = m;
    if (m.templateLabel) byTemplateLabel[m.templateLabel] = m;
  }
  return { byLabel, byTemplateLabel };
}

export function autoCreateMeasurements(markups, templateName, calibration, facingSetting) {
  const analysis = PREDEFINED.lateral.find(a => a.name === templateName)
    || PREDEFINED.ap.find(a => a.name === templateName)
    || PREDEFINED.smv.find(a => a.name === templateName)
    || PREDEFINED.opg.find(a => a.name === templateName)
    || PREDEFINED.handwrist.find(a => a.name === templateName)
    || PREDEFINED.photolateral.find(a => a.name === templateName)
    || PREDEFINED.photofrontal.find(a => a.name === templateName);
  if (!analysis || !analysis.measurements || analysis.measurements.length === 0) return [];

  const { byLabel: placed, byTemplateLabel: placedByTL } = buildLookups(markups);
  const ctx = { facing: resolveFacing(facingSetting, markups) };
  const existingLabels = new Set(markups.map(m => m.label));
  const result = [];

  for (const meas of analysis.measurements) {
    if (meas.type === "ratio" || meas.type === "sum" || meas.type === "difference" || meas.type === "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (existingLabels.has(meas.l)) continue;
    const matched = meas.pts.map(rl => resolveLabel(rl, placed, placedByTL));
    if (matched.some(m => !m)) continue;
    const points = matched.map(m => m.points[0]);
    const resolvedRefLabels = matched.map(m => m.templateLabel || m.label);
    const resolvedRefTemplateIds = matched.map(m => m.templateId || null);
    const extraProps = {};
    if (meas.type === "line" && !meas.norm) { extraProps.mode = "infinite"; extraProps.style = "dashed"; }
    if (meas.type === "polygon") { extraProps.fillColor = "rgba(56,189,248,0.08)"; extraProps.curveStyle = "linear"; }
    result.push({
      id: uid(), type: meas.type, points,
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true, placed: true,
      refLabels: resolvedRefLabels, refTemplateIds: resolvedRefTemplateIds, norm: meas.norm, measure: meas.l, ...extraProps,
      templateId: `${templateName}::${meas.l}`,
    });
  }

  const updatedLabels = new Set([...existingLabels, ...result.map(m => m.label)]);
  const combined = [...markups, ...result];
  const { byLabel: markupMap, byTemplateLabel: markupMapTL } = buildLookups(combined);
  for (const meas of analysis.measurements) {
    if (meas.type !== "ratio" && meas.type !== "sum" && meas.type !== "difference" && meas.type !== "percentage") continue;
    if (!meas.pts || meas.pts.length < 2) continue;
    if (updatedLabels.has(meas.l)) continue;
    const matched = meas.pts.map(rl => resolveLabel(rl, markupMap, markupMapTL));
    if (matched.some(m => !m)) continue;
    const resolvedRefLabels = matched.map(m => m.templateLabel || m.label);
    const resolvedRefTemplateIds = matched.map(m => m.templateId || null);
    let computedValue = 0;
    if (meas.type === "ratio") {
      const v0 = getMeasValue(matched[0], calibration, ctx);
      const v1 = getMeasValue(matched[1], calibration, ctx);
      computedValue = v1 !== 0 ? v0 / v1 : 0;
    } else if (meas.type === "difference") {
      computedValue = getMeasValue(matched[0], calibration, ctx) - getMeasValue(matched[1], calibration, ctx);
    } else if (meas.type === "percentage") {
      const v0 = getMeasValue(matched[0], calibration, ctx);
      const v1 = getMeasValue(matched[1], calibration, ctx);
      computedValue = v1 !== 0 ? (v0 / v1) * 100 : 0;
    } else {
      computedValue = matched.reduce((s, m) => s + getMeasValue(m, calibration, ctx), 0);
    }
    result.push({
      id: uid(), type: meas.type, points: [],
      label: meas.l, definition: meas.def || "",
      color: meas.color || "#888",
      visible: true, locked: true, autoCreated: true,
      refLabels: resolvedRefLabels, refTemplateIds: resolvedRefTemplateIds, computedValue, norm: meas.norm,
      templateId: `${templateName}::${meas.l}`,
    });
  }
  return result;
}

// ─── Decoupled analysis application ──────────────────────────────────────────
// AI auto-trace places every detected landmark first (no template); the user then
// picks an analysis, which (a) enriches matched points with the analysis' defs /
// colours / templateIds, (b) queues that analysis' undetected landmarks for
// manual placement, and (c) instantiates the measurements whose landmarks are all
// present. Detection and analysis are thereby decoupled.

const NORM_MEASURE_TYPE = {
  angle3: "angle", angle4: "angle", line: "length", polygon: "area",
  ratio: "value", sum: "value", difference: "value", percentage: "value",
  projDist: "projectedDistance",
};

export function placedLabelsOf(markups) {
  return new Set(
    (markups || [])
      .filter(m => m.type === "point" && m.placed && m.points?.[0]?.x > -9000)
      .map(m => m.templateLabel || m.label),
  );
}

// Per-analysis summary used by the analysis-selection modal.
export function analysisCoverage(analysis, markups) {
  const placed = placedLabelsOf(markups);
  const labels = (analysis?.pts || []).map(p => p.l);
  const missing = labels.filter(l => !placed.has(l));
  const meas = analysis?.measurements || [];
  const measReady = meas.filter(mm => (mm.pts || []).length >= 2 && mm.pts.every(rl => placed.has(rl)));
  return {
    total: labels.length,
    have: labels.length - missing.length,
    missing,
    measTotal: meas.length,
    measReady: measReady.length,
  };
}

// Build the markup/norm set for applying `analysis` on top of the AI-placed points.
export function applyAnalysis(markups, analysis, calibration, facingSetting) {
  const placed = placedLabelsOf(markups);
  const defByLabel = new Map((analysis?.pts || []).map(p => [p.l, p]));

  const enriched = (markups || []).map(m => {
    if (m.type !== "point") return m;
    const lbl = m.templateLabel || m.label;
    const def = defByLabel.get(lbl);
    if (!def) return m;
    return {
      ...m,
      templateLabel: lbl,
      templateId: m.templateId || `${analysis.name}::${lbl}`,
      definition: m.definition || def.def,
      color: def.color || m.color,
    };
  });

  const missing = [];
  for (const p of analysis?.pts || []) {
    if (placed.has(p.l)) continue;
    missing.push({
      id: uid(), type: "point", points: [{ x: -99999, y: -99999 }],
      label: p.l, templateLabel: p.l, templateId: `${analysis.name}::${p.l}`,
      definition: p.def, color: p.color, size: 6, visible: true, placed: false,
    });
  }

  const withPoints = [...enriched, ...missing];
  const readyLabels = placedLabelsOf(withPoints);
  const measurements = autoCreateMeasurements(withPoints, analysis.name, calibration, facingSetting)
    .filter(m => (m.refLabels || []).every(rl => readyLabels.has(rl)));

  return {
    markups: [...withPoints, ...measurements],
    missing,
    measurements,
    norms: deriveNorms(measurements, analysis.name),
  };
}

// Norm entries derived from a measurement's embedded `norm` (mean ± SD), typed so
// the Measurements/Normogram panels can match them. Mirrors the inline logic used
// when placing points manually.
export function deriveNorms(measurements, templateName) {
  const out = [];
  for (const m of measurements || []) {
    if (!m.norm) continue;
    const measureType = NORM_MEASURE_TYPE[m.type] || "distance";
    if (out.some(n => n.markupLabel === m.label && n.measureType === measureType)) continue;
    out.push({ id: uid(), markupLabel: m.label, measureType, mean: m.norm.mean, sd: m.norm.sd, source: templateName });
  }
  return out;
}
