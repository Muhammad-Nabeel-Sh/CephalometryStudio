// ═══════════════════════════════════════════════════════════════════════════════
// Frame stacks: every frame of a multi-frame DICOM in one session
//
//   session.stack = { frames: [frame…], index }
//   frame         = an image entry ({ id, dataUrl, raw, name, frame }) as for
//                   any imported image; its pixels live in the image store
//
// The session's base image layer (images[0]) always IS the frame being shown,
// so tracing, AI, window/level, the loupe and the report need no change. Showing
// another frame swaps that layer (keeping its position, opacity, transform) and
// writes the shown frame back first, so a window saved on it (a new image id)
// isn't lost. Markups belong to the session, not to a frame.
// ═══════════════════════════════════════════════════════════════════════════════

// A sanity limit (a fine CBCT has about 1000 slices). Above LARGE_STACK_FRAMES the
// user confirms first, seeing the storage it will take.
export const MAX_STACK_FRAMES = 4000;
export const LARGE_STACK_FRAMES = 300;

// Rough browser storage for `count` frames: the 8-bit rendering (PNG, about
// 0.8 byte/pixel for radiographs) plus the original values for 12–16-bit images.
export function estimateStackBytes(count, width, height, bits = 8) {
  const px = (width || 0) * (height || 0);
  return Math.round(count * px * (0.8 + (bits > 8 ? 2 : 0)));
}

export function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export const hasStack = (s) => Array.isArray(s?.stack?.frames) && s.stack.frames.length > 1;

// The frame fields that move between the stack and the base layer.
const frameFields = (e) => ({ id: e.id, dataUrl: e.dataUrl ?? null, ...(e.raw ? { raw: e.raw } : {}), ...(e.name ? { name: e.name } : {}), ...(e.source ? { source: e.source } : {}) });

// Every image entry a session owns: its layers plus the frames not on show.
// Storage, garbage collection, sync and export walk these.
export function sessionImageEntries(s) {
  const out = [...(s?.images || [])].filter(Boolean);
  if (hasStack(s)) {
    const ids = new Set(out.map(e => e.id));
    for (const f of s.stack.frames) if (f?.id && !ids.has(f.id)) { out.push(f); ids.add(f.id); }
  }
  return out;
}

// Apply `fn` to every stack frame (e.g. drop dataUrls before saving).
export function mapStackFrames(s, fn) {
  if (!hasStack(s)) return s;
  return { ...s, stack: { ...s.stack, frames: s.stack.frames.map(fn) } };
}

// The stack with the shown frame brought up to date from the base layer.
function synced(s) {
  const base = s.images?.[0];
  const i = s.stack.index ?? 0;
  if (!base) return s.stack.frames;
  return s.stack.frames.map((f, k) => (k === i ? { ...f, ...frameFields(base) } : f));
}

// → { images, stack } showing frame `index`, or null when there's nothing to do.
export function stackSwitch(s, index) {
  if (!hasStack(s)) return null;
  const n = s.stack.frames.length;
  const to = Math.max(0, Math.min(n - 1, Math.round(index)));
  if (to === (s.stack.index ?? 0)) return null;
  const frames = synced(s);
  const base = s.images?.[0] || {};
  const next = frames[to];
  const layer = { ...base, ...frameFields(next) };
  if (!next.raw) delete layer.raw;
  return { images: [layer, ...(s.images || []).slice(1)], stack: { ...s.stack, frames, index: to } };
}

// Whether an imported/loaded stack is usable; anything else is dropped.
export function validStack(stack) {
  return !!stack && Array.isArray(stack.frames) && stack.frames.length > 1 && stack.frames.length <= MAX_STACK_FRAMES
    && stack.frames.every(f => f && typeof f.id === "string" && f.id)
    && Number.isInteger(stack.index ?? 0) && (stack.index ?? 0) >= 0 && (stack.index ?? 0) < stack.frames.length;
}
