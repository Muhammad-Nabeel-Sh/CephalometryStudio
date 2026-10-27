// ═══════════════════════════════════════════════════════════════════════════════
// Normogram rows — one value per measurement (its primary measure, with that
// measure's unit) against its norm, grouped by category in analysis order.
// Shared by the Normogram dialog; pure functions, no React.
// ═══════════════════════════════════════════════════════════════════════════════

import { primaryMeasure } from "./utils.js";
import { normalCdf } from "./distributions.js";
import { RULES } from "./interpretation.js";
import { isApproximateSd } from "../data/norms.js";

// Values beyond ±SD_RANGE are drawn at the chart edge with an off-scale marker.
export const SD_RANGE = 2.5;

export const CATEGORY_ORDER = ["skeletal", "dental", "soft-tissue", "airway", "other"];
export const CATEGORY_LABELS = { skeletal: "Skeletal", dental: "Dental", "soft-tissue": "Soft tissue", airway: "Airway", other: "Other" };

// Neutral (statistical, not clinical) wording for distance from the mean.
export const BANDS = {
  within1: { label: "Within 1 SD", tone: "ok" },
  "1to2": { label: "1–2 SD", tone: "warn" },
  beyond2: { label: "Beyond 2 SD", tone: "err" },
};
export function bandOf(z) {
  const a = Math.abs(z);
  return a <= 1 ? "within1" : a <= 2 ? "1to2" : "beyond2";
}

// Percentile of a z-score in the norm population (0–100).
export const percentileOf = z => normalCdf(z) * 100;
export function formatPercentile(p) {
  if (!isFinite(p)) return "—";
  if (p < 1) return "<1%";
  if (p > 99) return ">99%";
  return `${Math.round(p)}%`;
}

const LINEAR_UNITS = new Set(["mm", "px", "mm²", "px²"]);

// Value with its unit; angles go through the user's angle display when given.
export function formatMeasure(value, unit, formatAngle) {
  if (value == null || !isFinite(value)) return "—";
  if (unit === "°") return formatAngle ? formatAngle(value) : `${value.toFixed(1)}°`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

export function categoryOf(label) {
  const c = RULES[label]?.category;
  return CATEGORY_ORDER.includes(c) ? c : "other";
}

// The primary value of one markup that can be compared with a norm.
// Distances and areas need a calibrated image (norms are in mm).
function valueFor(m, measureType, calibration, facing) {
  const pm = primaryMeasure(m, calibration, { facing });
  if (!pm || pm.key !== measureType) return { pm, ok: false, uncalibrated: false };
  if (LINEAR_UNITS.has(pm.unit) && !calibration?.done) return { pm, ok: false, uncalibrated: true };
  return { pm, ok: true, uncalibrated: false };
}

// → { rows, hiddenUncalibrated }. Rows are sorted by category, then by the
// order of the norms (the analysis template's order).
export function normogramRows(markups, norms, calibration, facing) {
  const rows = [];
  let hiddenUncalibrated = 0;
  const seen = new Set();
  for (const m of markups || []) {
    if (!m?.label || m.type === "point" || seen.has(m.label)) continue;
    const pm0 = primaryMeasure(m, calibration, { facing });
    if (!pm0) continue;
    // The norm for this markup's primary measure (e.g. the angle of an angle).
    const order = (norms || []).findIndex(n => n.markupLabel === m.label && n.measureType === pm0.key && n.sd > 0);
    if (order < 0) continue;
    const norm = norms[order];
    const { pm, ok, uncalibrated } = valueFor(m, norm.measureType, calibration, facing);
    if (uncalibrated) { hiddenUncalibrated++; continue; }
    if (!ok) continue;
    seen.add(m.label);
    const z = (pm.value - norm.mean) / norm.sd;
    rows.push({
      label: m.label, key: pm.key, value: pm.value, unit: pm.unit, norm, z,
      color: m.color, category: categoryOf(m.label), order,
      approxSd: norm.sdApproximate === true || isApproximateSd(norm.source, m.label, norm.sd),
    });
  }
  rows.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.order - b.order);
  return { rows, hiddenUncalibrated };
}

// The same measurements in another session, against the same norms:
// { [label]: { value, unit, z } } (missing or uncalibrated ones are left out).
export function comparisonValues(rows, markups, calibration, facing) {
  const out = {};
  for (const r of rows) {
    const m = (markups || []).find(x => x.label === r.label && x.type !== "point");
    if (!m) continue;
    const { pm, ok } = valueFor(m, r.norm.measureType, calibration, facing);
    if (!ok) continue;
    out[r.label] = { value: pm.value, unit: pm.unit, z: (pm.value - r.norm.mean) / r.norm.sd };
  }
  return out;
}

// Layout of chart rows with a header row per category: [{ kind, cat|row, y, h }].
export function chartLayout(rows, top, rowH, headerH) {
  const items = [];
  let y = top, cat = null;
  for (const row of rows) {
    if (row.category !== cat) {
      cat = row.category;
      items.push({ kind: "header", cat, y, h: headerH });
      y += headerH;
    }
    items.push({ kind: "row", row, y, h: rowH });
    y += rowH;
  }
  return { items, bottom: y };
}
