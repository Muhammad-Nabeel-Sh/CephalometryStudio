// ═══════════════════════════════════════════════════════════════════════════════
// Precision tracing: where the loupe sits, what it shows, and nudge steps.
// Pure, so the rules are unit-tested. Drawing lives in panels/Loupe.jsx.
// ═══════════════════════════════════════════════════════════════════════════════

export const LOUPE_ZOOMS = [2, 3, 4, 6, 8];
export const LOUPE_MAX_SCALE = 32; // screen pixels per image pixel
const GAP = 24; // between the pointer and the loupe
const FINGER_GAP = 48; // a fingertip is wider than a pen tip

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Keeps the loupe on the canvas and off the aimed point, clear of the hand: up and
// to the left of a pen or mouse, straight above a finger. Flips when there's no room.
export function loupePosition(p, area, size, pointerType) {
  const isFinger = pointerType === "touch";
  const gap = isFinger ? FINGER_GAP : GAP;
  const maxLeft = Math.max(0, area.w - size);
  const maxTop = Math.max(0, area.h - size);

  const top = p.y - size - gap >= 0 ? p.y - size - gap : p.y + gap;
  const clear = top + size < p.y || top > p.y; // vertically clear of the point
  let left;
  if (isFinger && clear) {
    left = clamp(p.x - size / 2, 0, maxLeft);
  } else {
    left = p.x - size - GAP >= 0 ? p.x - size - GAP : p.x + GAP;
  }
  const fitsVertically = top + size <= area.h;
  return {
    left: clamp(left, 0, maxLeft),
    top: fitsVertically ? top : clamp(p.y - size - gap, 0, maxTop),
  };
}

// The zoom and pan that draw image point `ip` in the centre of a `size` square.
export function loupeView(ip, size, viewZoom, factor) {
  const zoom = clamp(viewZoom * factor, 1, LOUPE_MAX_SCALE);
  return { zoom, pan: { x: size / 2 - ip.x * zoom, y: size / 2 - ip.y * zoom } };
}

export function stepLoupeZoom(current, direction) {
  const index = LOUPE_ZOOMS.findIndex(z => z >= current);
  const at = index < 0 ? LOUPE_ZOOMS.length - 1 : index;
  return LOUPE_ZOOMS[clamp(at + direction, 0, LOUPE_ZOOMS.length - 1)];
}

const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

// Image pixels to move for an arrow key: 1, or 0.25 with Alt, or 5 with Shift.
export function nudgeDelta(key, { alt = false, shift = false } = {}) {
  const dir = ARROWS[key];
  if (!dir) return null;
  const step = alt ? 0.25 : shift ? 5 : 1;
  return { dx: dir[0] === 0 ? 0 : dir[0] * step, dy: dir[1] === 0 ? 0 : dir[1] * step };
}

// A landmark that exists on the image and isn't protected.
export function canNudge(markup) {
  return !!markup && markup.type === "point" && !markup.locked && markup.visible !== false &&
    markup.placed !== false && (markup.points || []).length > 0;
}
