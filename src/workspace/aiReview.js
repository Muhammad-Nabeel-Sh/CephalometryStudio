// ═══════════════════════════════════════════════════════════════════════════════
// AI landmark review state
//
// Every AI-placed point starts unreviewed (`aiReviewed: false`). It becomes
// reviewed when the user moves it (`aiAdjusted: true`) or confirms it as-is.
// The flags travel with the markup into saved projects and exports, so a
// measurement's provenance (AI as placed / AI adjusted / manual) is auditable.
// ═══════════════════════════════════════════════════════════════════════════════

// Confidence tiers for the per-point PSR confidence the detector reports (0–1).
export function confidenceTier(c) {
  if (typeof c !== "number" || !isFinite(c)) return "unknown";
  return c >= 0.7 ? "high" : c >= 0.4 ? "medium" : "low";
}

export const isPendingAiPoint = m => m?.type === "point" && m.aiPlaced === true && m.aiReviewed === false;

// Mark AI points the user has moved as reviewed + adjusted. Cheap no-op when
// nothing is pending.
export function markMovedAiPoints(prev, next) {
  if (!Array.isArray(next) || !next.some(isPendingAiPoint)) return next;
  const before = new Map((prev || []).map(m => [m.id, m]));
  let changed = false;
  const out = next.map(m => {
    if (!isPendingAiPoint(m)) return m;
    const old = before.get(m.id);
    const a = old?.points?.[0], b = m.points?.[0];
    if (!a || !b || (a.x === b.x && a.y === b.y)) return m;
    changed = true;
    return { ...m, aiReviewed: true, aiAdjusted: true };
  });
  return changed ? out : next;
}

export function markReviewed(markups, ids) {
  const set = ids ? new Set(ids) : null;
  return (markups || []).map(m => (isPendingAiPoint(m) && (!set || set.has(m.id)) ? { ...m, aiReviewed: true } : m));
}

export function aiReviewSummary(markups) {
  const ai = (markups || []).filter(m => m?.type === "point" && m.aiPlaced === true);
  const pending = ai.filter(m => m.aiReviewed === false);
  return {
    total: ai.length,
    pending: pending.length,
    pendingLow: pending.filter(m => confidenceTier(m.aiConfidence) === "low").length,
    adjusted: ai.filter(m => m.aiAdjusted).length,
  };
}

// Human-readable provenance for exports.
export function provenanceOf(m) {
  if (m?.aiPlaced !== true) return "manual";
  const conf = typeof m.aiConfidence === "number" ? ` (confidence ${Math.round(m.aiConfidence * 100)}%)` : "";
  if (m.aiAdjusted) return `AI, adjusted${conf}`;
  if (m.aiReviewed === false) return `AI, NOT reviewed${conf}`;
  return `AI, reviewed${conf}`;
}
