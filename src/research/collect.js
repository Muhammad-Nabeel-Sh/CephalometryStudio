import { computeMeasurements } from "../lib/utils.js";
import { logError } from "../lib/logger.js";

let _collectCacheKey = "";
let _collectCacheResult = null;

// Unit for a single measurement key given the markup's calibrated unit.
// Angle-ish keys are always degrees; everything else is mm when calibrated, px otherwise.
export function unitForKey(key, valsUnit) {
  const k = String(key).toLowerCase();
  if (k.includes("angle") || k.includes("deg")) return "°";
  return valsUnit === "mm" ? "mm" : "px";
}

// Most common unit among collected rows. Coordinate keys (x/y) are ignored
// when any non-coordinate key exists so an angle markup reports "°" and a
// line reports mm/px instead of the coordinate unit.
export function dominantUnit(rows, keyField = "measureKey") {
  const nonCoord = (rows || []).filter(r => r[keyField] !== "x" && r[keyField] !== "y");
  const pool = nonCoord.length > 0 ? nonCoord : rows || [];
  const counts = {};
  for (const r of pool) {
    const u = r.unit || "";
    counts[u] = (counts[u] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "";
}

export function collectMeasurements(sessions, labelIds, calibration, angleMode) {
  const labelKey = [...(labelIds || [])].sort().join(",");
  const calKey = calibration ? `${calibration.done}:${calibration.pxPerMm}:${calibration.knownMm}` : "";
  const sesKey = (sessions||[]).map(s => `${s.id}:${s.modified||0}`).join("|");
  const cacheKey = `${sesKey}|${labelKey}|${calKey}|${angleMode || ""}`;
  if (_collectCacheKey === cacheKey && _collectCacheResult) return _collectCacheResult;

  const rows = [];
  for (const s of sessions) {
    if (!s) continue;
    const markups = s.markups || [];
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const mode = s.angleMode || angleMode || "signed-deg";
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette") continue;
      if (!m.visible || !m.placed) continue;
      try {
        const vals = computeMeasurements(m, cal, mode);
        for (const [key, raw] of Object.entries(vals)) {
          if (key.startsWith("_")) continue;
          if (typeof raw !== "number" || !isFinite(raw)) continue;
          rows.push({
            sessionId: s.id,
            sessionName: s.name || s.label || "Session",
            markupId: m.id,
            label: m.label,
            measureKey: key,
            value: raw,
            unit: unitForKey(key, vals._unit),
            type: m.type,
          });
        }
      } catch (e) { logError("collect/markup", e); }
    }
  }
  _collectCacheKey = cacheKey;
  _collectCacheResult = rows;
  return rows;
}

export function pivotMeasurements(rows) {
  const pivoted = {};
  const labels = [];
  const seen = {};
  const units = {};
  for (const r of rows) {
    const key = `${r.sessionId}::${r.label}`;
    if (!pivoted[key]) {
      pivoted[key] = { sessionId: r.sessionId, sessionName: r.sessionName, label: r.label, values: {} };
      labels.push(pivoted[key]);
    }
    const subKey = `${key}::${r.measureKey}`;
    if (seen[subKey] != null && seen[subKey] !== r.value) {
      pivoted[key]._duplicates = pivoted[key]._duplicates || [];
      pivoted[key]._duplicates.push({ measureKey: r.measureKey, existing: seen[subKey], incoming: r.value });
    }
    if (seen[subKey] == null) {
      pivoted[key].values[r.measureKey] = r.value;
      seen[subKey] = r.value;
    }
    units[r.label] = r.unit;
  }
  labels.units = units;
  return labels;
}
