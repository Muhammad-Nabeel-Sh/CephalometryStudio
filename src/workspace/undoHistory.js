// ═══════════════════════════════════════════════════════════════════════════════
// Undo you can see (B6) — describe what an undo step changed
//
// The undo stack stores whole-session snapshots (JSON strings), so a step's
// label is derived by comparing a snapshot with the state that followed it.
// Pure functions; no React.
// ═══════════════════════════════════════════════════════════════════════════════

const parse = s => {
  if (!s) return null;
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return null; }
};

const nameOf = m => m?.label || m?.text || m?.type || "markup";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function markupChange(a, b) {
  if (!same(a.points, b.points) || !same(a.cp, b.cp) || !same(a.position, b.position)) {
    if (a.placed === false && b.placed !== false) return { kind: "place", text: `Placed ${nameOf(b)}` };
    return { kind: "move", text: `Moved ${nameOf(b)}` };
  }
  if (a.label !== b.label) return { kind: "edit", text: `Renamed ${nameOf(a)} → ${nameOf(b)}` };
  if (a.aiReviewed === false && b.aiReviewed === true) return { kind: "edit", text: `Confirmed ${nameOf(b)}` };
  if (a.visible !== b.visible) return { kind: "edit", text: `${b.visible === false ? "Hid" : "Showed"} ${nameOf(b)}` };
  if (a.locked !== b.locked) return { kind: "edit", text: `${b.locked ? "Locked" : "Unlocked"} ${nameOf(b)}` };
  if (a.color !== b.color) return { kind: "edit", text: `Recoloured ${nameOf(b)}` };
  return { kind: "edit", text: `Edited ${nameOf(b)}` };
}

const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// What changed from `before` to `after` (snapshots or snapshot strings)?
// → { kind: "add"|"delete"|"move"|"place"|"edit"|"calibrate"|"other", text, count }
export function describeChange(beforeIn, afterIn) {
  const before = parse(beforeIn), after = parse(afterIn);
  if (!before || !after) return { kind: "other", text: "Change", count: 0 };

  const bm = new Map((before.markups || []).map(m => [m.id, m]));
  const am = new Map((after.markups || []).map(m => [m.id, m]));
  // Auto-created measurements follow their landmarks; describe the user's own edit.
  const own = m => !m.autoCreated;
  const added = [...am.values()].filter(m => !bm.has(m.id));
  const removed = [...bm.values()].filter(m => !am.has(m.id));
  const changed = [...am.values()].filter(m => bm.has(m.id) && !same(bm.get(m.id), m));
  const addedOwn = added.filter(own), removedOwn = removed.filter(own), changedOwn = changed.filter(own);

  if (removedOwn.length || (removed.length && !added.length && !changedOwn.length)) {
    const r = removedOwn.length ? removedOwn : removed;
    if (!am.size && r.length > 1) return { kind: "delete", text: `Cleared ${plural(r.length, "markup")}`, count: r.length };
    return { kind: "delete", text: r.length === 1 ? `Deleted ${nameOf(r[0])}` : `Deleted ${plural(r.length, "markup")}`, count: r.length };
  }
  if (addedOwn.length) {
    return { kind: "add", text: addedOwn.length === 1 ? `Added ${nameOf(addedOwn[0])}` : `Added ${plural(addedOwn.length, "markup")}`, count: addedOwn.length };
  }
  if (changedOwn.length) {
    const parts = changedOwn.map(m => markupChange(bm.get(m.id), m));
    if (parts.length === 1) return { ...parts[0], count: 1 };
    const kinds = new Set(parts.map(p => p.kind));
    if (kinds.size === 1 && kinds.has("move")) return { kind: "move", text: `Moved ${plural(parts.length, "markup")}`, count: parts.length };
    if (kinds.size === 1 && kinds.has("place")) return { kind: "place", text: `Placed ${plural(parts.length, "landmark")}`, count: parts.length };
    return { kind: "edit", text: `Edited ${plural(parts.length, "markup")}`, count: parts.length };
  }
  if (!same(before.calibration, after.calibration)) {
    const c = after.calibration || {};
    return { kind: "calibrate", text: c.done ? `Calibrated (${Number(c.pxPerMm).toFixed(2)} px/mm)` : "Calibration reset", count: 1 };
  }
  if (added.length) return { kind: "add", text: `Added ${plural(added.length, "measurement")}`, count: added.length };
  if (changed.length) return { kind: "edit", text: `Updated ${plural(changed.length, "measurement")}`, count: changed.length };
  if (!same(before.norms, after.norms)) return { kind: "other", text: "Changed norms", count: 1 };
  if (!same(before.formulas, after.formulas)) return { kind: "other", text: "Edited formulas", count: 1 };
  if (!same(before.processing, after.processing)) return { kind: "other", text: "Adjusted the image", count: 1 };
  return { kind: "other", text: "Change", count: 0 };
}

// Steps worth an "· Undo" toast: easy to do by accident or hard to redo by hand.
export const isNotableChange = c => c.kind === "delete" || c.kind === "move" || (c.kind === "edit" && c.count > 1) || c.kind === "calibrate";

// The most recent undo steps, newest first: [{ steps, text, kind }], where
// `steps` is how many undos return to the state before that action.
export function historyEntries(undoStack, currentSnapshot, limit = 15) {
  const out = [];
  const n = undoStack?.length || 0;
  for (let i = n - 1; i >= 0 && out.length < limit; i--) {
    const after = i === n - 1 ? currentSnapshot : undoStack[i + 1];
    out.push({ steps: n - i, ...describeChange(undoStack[i], after) });
  }
  return out;
}
