import { uid } from "../lib/utils.js";
import { getMeasValue } from "./template.js";

function buildLookups(markups) {
  const byLabel = {}, byTemplateLabel = {}, byTemplateId = {};
  for (const m of markups) {
    if (m.label) byLabel[m.label] = m;
    if (m.templateLabel) byTemplateLabel[m.templateLabel] = m;
    if (m.templateId) byTemplateId[m.templateId] = m;
  }
  return { byLabel, byTemplateLabel, byTemplateId };
}

// Resolve a reference entry (label + optional immutable templateId) to a markup.
// Prefers the immutable templateId so renames never break bindings; falls back
// to templateLabel, then the current label, for legacy/untemplated markups.
function resolveRef(rl, refTemplateId, lookups) {
  if (refTemplateId && lookups.byTemplateId[refTemplateId]) return lookups.byTemplateId[refTemplateId];
  return lookups.byTemplateLabel[rl] || lookups.byLabel[rl] || null;
}

export function refreshAutoMeasurements(markups, calibration) {
  const { byLabel: placed, byTemplateLabel: placedTL, byTemplateId: placedTID } = buildLookups(markups.filter(m => m.placed));
  const { byLabel: markupMap, byTemplateLabel: markupMapTL, byTemplateId: markupMapTID } = buildLookups(markups);
  return markups.map(m => {
    if (!m.refLabels || m.refLabels.length === 0) return m;
    if (m.type === "ratio" || m.type === "sum" || m.type === "difference" || m.type === "percentage") {
      const matched = m.refLabels.map((rl, i) => resolveRef(rl, m.refTemplateIds?.[i], { byLabel: markupMap, byTemplateLabel: markupMapTL, byTemplateId: markupMapTID }));
      if (matched.some(x => !x)) return m;
      let nv = 0;
      if (m.type === "ratio") {
        const v0 = getMeasValue(matched[0], calibration);
        const v1 = getMeasValue(matched[1], calibration);
        nv = v1 !== 0 ? v0 / v1 : 0;
      } else if (m.type === "difference") {
        nv = getMeasValue(matched[0], calibration) - getMeasValue(matched[1], calibration);
      } else if (m.type === "percentage") {
        const v0 = getMeasValue(matched[0], calibration);
        const v1 = getMeasValue(matched[1], calibration);
        nv = v1 !== 0 ? (v0 / v1) * 100 : 0;
      } else {
        nv = matched.reduce((s, x) => s + getMeasValue(x, calibration), 0);
      }
      if (m.computedValue !== nv) return { ...m, computedValue: nv };
      return m;
    }
    const matched = m.refLabels.map((rl, i) => resolveRef(rl, m.refTemplateIds?.[i], { byLabel: placed, byTemplateLabel: placedTL, byTemplateId: placedTID }));
    if (matched.some(x => !x)) return m;
    const np = matched.map(x => x.points[0]);
    if (np.some((p, i) => p.x !== m.points[i]?.x || p.y !== m.points[i]?.y)) return { ...m, points: np };
    return m;
  });
}

export function markupDefaults(partial, markups, t) {
  const typeCount = (type) => markups.filter(m => m.type === type).length;
  const m = { id: uid(), color: t.acc, width: 1.5, style: "solid", size: 6, label: "", definition: "", showLength: true, strokeColor: t.acc, fillColor: t.acc + "22", strokeWidth: 1.5, visible: true, placed: true, ...partial };
  if (partial.type === "point") m.label = `P${typeCount("point") + 1}`;
  if (partial.type === "line" || partial.type === "parallel") m.label = partial.label || `Line ${typeCount("line") + typeCount("parallel") + 1}`;
  if (partial.type === "curve") m.label = partial.label || `Trace ${typeCount("curve") + 1}`;
  if (partial.type === "polyline") m.label = partial.label || `Polyline ${typeCount("polyline") + 1}`;
  if (partial.type === "angle3") m.label = partial.label || `Angle ${typeCount("angle3") + 1}`;
  if (partial.type === "angle4") m.label = partial.label || `Inc_Angle ${typeCount("angle4") + 1}`;
  if (partial.type === "ellipse") m.label = partial.label || `Ellipse ${typeCount("ellipse") + 1}`;
  if (partial.type === "arc") m.label = partial.label || `Arc ${typeCount("arc") + 1}`;
  if (partial.type === "circle") m.label = partial.label || `Circle ${typeCount("circle") + 1}`;
  if (partial.type === "bezier") m.label = partial.label || `Bezier ${typeCount("bezier") + 1}`;
  if (partial.type === "tangent") m.label = partial.label || `Tangent ${typeCount("tangent") + 1}`;
  if (partial.type === "concentric") m.label = partial.label || `Concentric ${typeCount("concentric") + 1}`;
  if (!m.refLabels && m.type !== "point" && m.points && m.points.length >= 1 && m.points.every(p => p.x > -9000)) {
    const sources = m.points.map(p => {
      for (const src of markups)
        if (src.type === "point" && src.label && src.points?.length && src.visible !== false && Math.abs(src.points[0].x - p.x) < 3 && Math.abs(src.points[0].y - p.y) < 3)
          return src;
      return null;
    });
    if (sources.every(l => l)) {
      m.refLabels = sources.map(s => s.templateLabel || s.label);
      m.refTemplateIds = sources.map(s => s.templateId || null);
    }
  }
  return m;
}
