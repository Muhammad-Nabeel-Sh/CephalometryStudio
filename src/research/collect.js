import { primaryMeasure } from "../lib/utils.js";
import { sessionFacing } from "../lib/measureConventions.js";
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

// Calibration a session's measurements are expressed in: its own when done,
// otherwise the study-level fallback.
export function sessionCalibration(session, calibration) {
  return session?.calibration?.done ? session.calibration : calibration || { done: false, pxPerMm: 1 };
}

// Whether a markup takes part in scalar research analyses.
export function isResearchMarkup(m) {
  return Boolean(m?.label) && m.type !== "ruler" && m.type !== "silhouette" && m.visible !== false && m.placed !== false;
}

// { key, value, unit } of a markup's primary measurement within `session`
// (session calibration + patient-facing frame), or null. The single source of
// research values — never read `x`/`y` or "the first numeric key".
export function sessionPrimaryMeasure(session, m, calibration) {
  try {
    return primaryMeasure(m, sessionCalibration(session, calibration), { facing: sessionFacing(session) });
  } catch (e) {
    logError("collect/primary", e);
    return null;
  }
}

export function collectMeasurements(sessions, labelIds, calibration) {
  const labelKey = [...(labelIds || [])].sort().join(",");
  const calKey = calibration ? `${calibration.done}:${calibration.pxPerMm}:${calibration.knownMm}` : "";
  const sesKey = (sessions||[]).map(s => `${s.id}:${s.modified||0}:${s.facing||""}`).join("|");
  const cacheKey = `${sesKey}|${labelKey}|${calKey}`;
  if (_collectCacheKey === cacheKey && _collectCacheResult) return _collectCacheResult;

  const rows = [];
  for (const s of sessions) {
    if (!s) continue;
    for (const m of s.markups || []) {
      if (!isResearchMarkup(m)) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      const pm = sessionPrimaryMeasure(s, m, calibration);
      if (!pm) continue;
      rows.push({
        sessionId: s.id,
        sessionName: s.name || s.label || "Session",
        markupId: m.id,
        label: m.label,
        measureKey: pm.key,
        value: pm.value,
        unit: pm.unit,
        type: m.type,
      });
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
