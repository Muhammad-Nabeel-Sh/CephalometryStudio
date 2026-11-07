// ═══════════════════════════════════════════════════════════════════════════════
// Canvas gestures — turns raw pointer events into what the workspace should do.
// Pure (no DOM, no React), so the rules below are unit-tested:
//   mouse  acts directly, like it always has.
//   pen    acts on contact; its eraser end erases; a touch near it is a palm.
//   finger acts when lifted, because a landing finger may still become a pan,
//          a pinch or a long press. Nothing is placed until the gesture is known.
// Guided placement: every pointer aims while it is down and places where it lifts,
// so a landmark can be adjusted before it is committed. One finger aims; two pan.
// Pen-only mode: fingers only navigate (pan, pinch, double-tap zoom, two-finger undo).
// ═══════════════════════════════════════════════════════════════════════════════

export const GESTURE = {
  TAP_SLOP: 10, // px a finger may jitter and still count as a tap
  DOUBLE_TAP_MS: 300,
  DOUBLE_TAP_DIST: 30, // px between the two taps of a double-tap
  LONG_PRESS_MS: 500,
  TWO_FINGER_STAGGER_MS: 150, // both fingers must land within this
  TWO_FINGER_TAP_MS: 300, // and lift within this of the second landing
  PALM_GUARD_MS: 300, // a touch this soon after pen activity is a palm
};

const isEraser = e => e.button === 5 || (e.buttons & 32) !== 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// getState() → { placing, tool, canFinishShape, penOnly, menuOpen, hitAt(x, y) }
// actions    → press(e), move(e), release(), panStart(x, y), pinchStart(a, b),
//              pinchMove(a, b), doubleTapZoom(x, y), finishShape(), longPress(x, y),
//              undo(), erase(x, y), aimCommit(x, y)
export function createCanvasGestures({ getState, actions }) {
  const touches = new Map(); // pointerId → { x, y, startX, startY, startedAt, hit }
  let mode = "idle"; // idle | pending | panning | drawing | aiming | pinch | consumed
  let pointerAiming = false; // a pen or mouse is down during guided placement
  let longPressTimer = null;
  let lastTap = null; // { x, y, at } of the last finger tap
  let twoFingerTap = null; // { at } while a two-finger tap is still possible

  let penDown = false;
  let erasing = false;
  let lastPenAt = -Infinity;
  let lastPenTap = null;

  const clearLongPress = () => {
    if (longPressTimer !== null) clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  const fingerEvent = (x, y) => ({ button: 0, clientX: x, clientY: y, fromFinger: true });
  const pinchPair = () => {
    const [a, b] = touches.values();
    return [a, b];
  };

  // Ends whatever the fingers were doing, without committing a pending tap.
  const abandonTouches = () => {
    clearLongPress();
    if (mode === "panning" || mode === "drawing" || mode === "pinch") actions.release();
    touches.clear();
    twoFingerTap = null;
    mode = "idle";
  };

  // ── Finger ─────────────────────────────────────────────────────────────────
  const touchDown = e => {
    const palm = penDown || e.timeStamp - lastPenAt < GESTURE.PALM_GUARD_MS;
    if (palm) return;
    const state = getState();
    const first = touches.size === 0;
    const point = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startedAt: e.timeStamp, hit: false };
    touches.set(e.pointerId, point);

    if (first) {
      if (state.menuOpen) { mode = "consumed"; return; }
      mode = "pending";
      point.hit = state.hitAt(e.clientX, e.clientY);
      if (!state.penOnly && !state.placing) { // while placing, a pause is just careful aiming
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          if (mode !== "pending") return;
          mode = "consumed";
          actions.longPress(point.startX, point.startY);
        }, GESTURE.LONG_PRESS_MS);
      }
      return;
    }

    clearLongPress();
    const couldBeTap = touches.size === 2 && mode === "pending" &&
      e.timeStamp - pinchPair()[0].startedAt <= GESTURE.TWO_FINGER_STAGGER_MS;
    twoFingerTap = couldBeTap ? { at: e.timeStamp } : null;
    if (mode === "panning" || mode === "drawing") actions.release();
    mode = "pinch";
    actions.pinchStart(...pinchPair());
  };

  const touchMove = e => {
    const point = touches.get(e.pointerId);
    if (!point) return;
    point.x = e.clientX;
    point.y = e.clientY;
    const moved = Math.hypot(point.x - point.startX, point.y - point.startY) > GESTURE.TAP_SLOP;

    if (mode === "pinch") {
      if (touches.size < 2) return;
      if (twoFingerTap && (moved || e.timeStamp - twoFingerTap.at > GESTURE.TWO_FINGER_TAP_MS)) twoFingerTap = null;
      if (!twoFingerTap) actions.pinchMove(...pinchPair());
      return;
    }
    if (mode === "pending") {
      if (!moved) return;
      clearLongPress();
      const { placing, tool, penOnly } = getState();
      const navigate = penOnly || tool === "pan" || (tool === "select" && !point.hit);
      if (placing && !penOnly) {
        mode = "aiming";
      } else if (navigate) {
        mode = "panning";
        actions.panStart(point.x, point.y);
      } else {
        mode = "drawing";
        actions.press(fingerEvent(point.startX, point.startY));
      }
    }
    if (mode === "panning" || mode === "drawing" || mode === "aiming") actions.move({ clientX: point.x, clientY: point.y });
  };

  const fingerTap = (x, y, at) => {
    const { placing, tool, canFinishShape, penOnly } = getState();
    const here = { x, y, at };
    const isDouble = lastTap && at - lastTap.at < GESTURE.DOUBLE_TAP_MS && distance(lastTap, here) <= GESTURE.DOUBLE_TAP_DIST;
    if (isDouble) {
      if (canFinishShape && !placing && !penOnly) {
        lastTap = null;
        actions.finishShape();
        return;
      }
      if (penOnly || (!placing && (tool === "select" || tool === "pan"))) {
        lastTap = null;
        actions.doubleTapZoom(x, y);
        return;
      }
    }
    lastTap = here;
    if (penOnly) return;
    if (placing) { actions.aimCommit(x, y); return; }
    actions.press(fingerEvent(x, y));
    actions.release();
  };

  const touchUp = e => {
    const point = touches.get(e.pointerId);
    if (!point) return;
    const remaining = touches.size - 1;
    if (mode === "pinch" && remaining >= 2) {
      touches.delete(e.pointerId);
      twoFingerTap = null;
      actions.pinchStart(...pinchPair());
      return;
    }
    touches.delete(e.pointerId);
    if (remaining > 0) return;

    clearLongPress();
    const ended = mode;
    mode = "idle";
    if (ended === "pending") {
      fingerTap(e.clientX, e.clientY, e.timeStamp);
    } else if (ended === "aiming") {
      actions.aimCommit(e.clientX, e.clientY);
    } else if (ended === "pinch") {
      actions.release();
      if (twoFingerTap && e.timeStamp - twoFingerTap.at <= GESTURE.TWO_FINGER_TAP_MS) actions.undo();
    } else if (ended === "panning" || ended === "drawing") {
      actions.release();
    }
    twoFingerTap = null;
  };

  const touchCancel = e => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    twoFingerTap = null;
    if (touches.size > 0) return;
    clearLongPress();
    if (mode === "panning" || mode === "drawing" || mode === "pinch") actions.release();
    mode = "idle";
  };

  // ── Pen ────────────────────────────────────────────────────────────────────
  const penPress = e => {
    lastPenAt = e.timeStamp;
    abandonTouches();
    penDown = true;
    if (isEraser(e)) {
      erasing = true;
      actions.erase(e.clientX, e.clientY);
      return;
    }
    if (e.button === 0) {
      const here = { x: e.clientX, y: e.clientY, at: e.timeStamp };
      const { placing, canFinishShape } = getState();
      if (placing) { pointerAiming = true; return; }
      const isDouble = lastPenTap && here.at - lastPenTap.at < GESTURE.DOUBLE_TAP_MS &&
        distance(lastPenTap, here) <= GESTURE.DOUBLE_TAP_DIST;
      if (isDouble && canFinishShape) {
        lastPenTap = null;
        actions.finishShape();
        return;
      }
      lastPenTap = here;
    }
    actions.press(e);
  };

  return {
    pointerDown(e) {
      if (e.pointerType === "touch") touchDown(e);
      else if (e.pointerType === "pen") penPress(e);
      else if (e.button === 0 && getState().placing) pointerAiming = true;
      else actions.press(e);
    },
    pointerMove(e) {
      if (e.pointerType === "touch") { touchMove(e); return; }
      if (e.pointerType === "pen") {
        lastPenAt = e.timeStamp;
        if (touches.size > 0) abandonTouches(); // the hand holding the pen is resting on the screen
        if (erasing) return;
      }
      actions.move(e);
    },
    pointerUp(e) {
      if (e.pointerType === "touch") { touchUp(e); return; }
      if (e.pointerType === "pen") {
        lastPenAt = e.timeStamp;
        penDown = false;
        if (erasing) { erasing = false; return; }
      }
      if (pointerAiming) {
        pointerAiming = false;
        actions.aimCommit(e.clientX, e.clientY);
        return;
      }
      actions.release();
    },
    pointerCancel(e) {
      if (e.pointerType === "touch") { touchCancel(e); return; }
      pointerAiming = false;
      if (e.pointerType === "pen") {
        penDown = false;
        if (erasing) { erasing = false; return; }
      }
      actions.release();
    },
    pointerLeave(e) {
      if (e.pointerType === "touch" || e.buttons !== 0) return;
      actions.release();
    },
    dispose() {
      clearLongPress();
    },
  };
}
