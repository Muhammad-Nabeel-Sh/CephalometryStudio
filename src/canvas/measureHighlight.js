// ═══════════════════════════════════════════════════════════════════════════════
// Measurement highlight — hovering (or tapping) a card in the Measurements panel
// dims the canvas and redraws that measurement, and everything it is built from,
// on top. Pure apart from the canvas calls, so the rules are unit-tested.
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts } from "../lib/utils.js";
import { buildLookups, resolveRef } from "../workspace/markupHelpers.js";

const isDrawable = m => m.visible !== false && m.placed !== false && vpts(m).length > 0;

// Ids of the markup and of what its references resolve to (landmarks of an angle,
// the angles behind ANB and their landmarks), drawable ones only.
export function highlightTargets(markups, id) {
  const lookups = buildLookups(markups);
  const start = markups.find(m => m.id === id);
  const found = [];
  const seen = new Set();
  const visit = m => {
    if (!m || seen.has(m.id)) return;
    seen.add(m.id);
    if (isDrawable(m)) found.push(m.id);
    (m.refLabels || []).forEach((label, i) => visit(resolveRef(label, m.refTemplateIds?.[i], lookups)));
  };
  visit(start);
  return found;
}

const VEIL = "rgba(0, 0, 0, 0.45)";
const RING = 10; // screen px around each landmark

// drawOne(markup) draws a markup the way the canvas normally does.
export function drawMeasurementHighlight(ctx, { markups, ids, zoom, pan, W, H, color, drawOne }) {
  if (!ids?.length) return;
  const targets = ids.map(id => markups.find(m => m.id === id)).filter(Boolean);
  if (!targets.length) return;
  const points = targets.filter(m => m.type === "point");
  ctx.save();
  ctx.fillStyle = VEIL;
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  // Shapes first, so the landmarks they join stay on top.
  for (const m of targets) if (m.type !== "point") drawOne(m);
  for (const m of points) drawOne(m);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const m of points) {
    const p = vpts(m)[0];
    ctx.beginPath();
    ctx.arc(p.x * zoom + pan.x, p.y * zoom + pan.y, RING, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
