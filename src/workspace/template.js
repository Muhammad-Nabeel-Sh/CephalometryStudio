// ═══════════════════════════════════════════════════════════════════════════════
// Template loading + auto-measurement creation
// ═══════════════════════════════════════════════════════════════════════════════

import { uid, dist, computeMeasurements } from "../lib/utils.js";
import { PREDEFINED } from "../data/constants.js";

// The clinically meaningful value per markup type — computed measurements
// (ratio/sum/difference/percentage) reference these, never raw coordinates.
const PRIMARY_VALUE_KEY = {
  line: "length", parallel: "length", ruler: "length", arrow: "length", tangent: "length",
  angle3: "angle", angle4: "angle",
  polygon: "area", ellipse: "area", circle: "area",
  arc: "arcLength", concentric: "arcLength",
  curve: "length", polyline: "length", bezier: "length",
  perp: "distance", projDist: "projectedDistance",
  ratio: "value", sum: "value", difference: "value", percentage: "value",
};

export function getMeasValue(m, calibration) {
  const ms = computeMeasurements(m, calibration);
  const key = PRIMARY_VALUE_KEY[m.type];
  if (key && typeof ms[key] === "number" && isFinite(ms[key])) return ms[key];
  if ((m.type === "line" || m.type === "parallel" || m.type === "ruler" || m.type === "arrow") && m.points?.length >= 2) {
    const ppm = calibration?.done ? (calibration.pxPerMm || 1) : 1;
    return dist(m.points[0], m.points[1]) / ppm;
  }
  const vals = Object.values(ms).filter(v => typeof v === "number" && isFinite(v));
  return vals.length > 0 ? vals[0] : 0;
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

export function autoCreateMeasurements(markups, templateName, calibration) {
  const analysis = PREDEFINED.lateral.find(a => a.name === templateName)
    || PREDEFINED.ap.find(a => a.name === templateName)
    || PREDEFINED.smv.find(a => a.name === templateName)
    || PREDEFINED.opg.find(a => a.name === templateName)
    || PREDEFINED.handwrist.find(a => a.name === templateName)
    || PREDEFINED.photolateral.find(a => a.name === templateName)
    || PREDEFINED.photofrontal.find(a => a.name === templateName);
  if (!analysis || !analysis.measurements || analysis.measurements.length === 0) return [];

  const { byLabel: placed, byTemplateLabel: placedByTL } = buildLookups(markups);
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
      const v0 = getMeasValue(matched[0], calibration);
      const v1 = getMeasValue(matched[1], calibration);
      computedValue = v1 !== 0 ? v0 / v1 : 0;
    } else if (meas.type === "difference") {
      computedValue = getMeasValue(matched[0], calibration) - getMeasValue(matched[1], calibration);
    } else if (meas.type === "percentage") {
      const v0 = getMeasValue(matched[0], calibration);
      const v1 = getMeasValue(matched[1], calibration);
      computedValue = v1 !== 0 ? (v0 / v1) * 100 : 0;
    } else {
      computedValue = matched.reduce((s, m) => s + getMeasValue(m, calibration), 0);
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
