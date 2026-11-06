import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCanvasGestures, GESTURE } from "../canvas/canvasGestures.js";

// A scripted canvas: records what the gestures ask the app to do.
function setup(state = {}) {
  const calls = [];
  const rec = name => (...args) => calls.push([name, ...args]);
  const env = { placing: false, tool: "select", canFinishShape: false, penOnly: false, menuOpen: false, hit: false, ...state };
  const g = createCanvasGestures({
    getState: () => ({ ...env, hitAt: () => env.hit }),
    actions: {
      press: rec("press"), move: rec("move"), release: rec("release"),
      panStart: rec("panStart"), pinchStart: rec("pinchStart"), pinchMove: rec("pinchMove"),
      doubleTapZoom: rec("doubleTapZoom"), finishShape: rec("finishShape"),
      longPress: rec("longPress"), undo: rec("undo"), erase: rec("erase"),
    },
  });
  const names = () => calls.map(c => c[0]);
  const count = n => names().filter(x => x === n).length;
  return { g, env, calls, names, count };
}

let clock = 1000;
const ev = (pointerType, pointerId, clientX, clientY, extra = {}) =>
  ({ pointerType, pointerId, clientX, clientY, button: 0, buttons: 1, timeStamp: clock, ...extra });
const finger = (id, x, y, extra) => ev("touch", id, x, y, extra);
const pen = (x, y, extra) => ev("pen", 9, x, y, extra);
const tap = (g, x, y, id = 1) => { g.pointerDown(finger(id, x, y)); clock += 30; g.pointerUp(finger(id, x, y)); };

beforeEach(() => { vi.useFakeTimers(); clock = 1000; });
afterEach(() => { vi.useRealTimers(); });

describe("finger: landmark placement", () => {
  it("places a landmark when the finger lifts, not when it lands", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(finger(1, 100, 100));
    expect(count("press")).toBe(0);
    g.pointerUp(finger(1, 100, 100));
    expect(count("press")).toBe(1);
  });

  it("does not place a landmark when a pinch starts on an existing point", () => {
    const { g, count } = setup({ placing: true, hit: true });
    g.pointerDown(finger(1, 100, 100));
    clock += 200;
    g.pointerDown(finger(2, 300, 100));
    clock += 400;
    g.pointerMove(finger(2, 340, 100));
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 340, 100));
    expect(count("press")).toBe(0);
    expect(count("pinchMove")).toBeGreaterThan(0);
  });

  it("places both landmarks on two fast taps far apart", () => {
    const { g, count } = setup({ placing: true });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 400, 500);
    expect(count("press")).toBe(2);
    expect(count("doubleTapZoom")).toBe(0);
  });

  it("places both landmarks on two fast taps close together", () => {
    const { g, count } = setup({ placing: true });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 105, 104);
    expect(count("press")).toBe(2);
    expect(count("doubleTapZoom")).toBe(0);
  });

  it("opens the menu on long-press without placing a landmark", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(finger(1, 100, 100));
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS + 1);
    clock += GESTURE.LONG_PRESS_MS + 1;
    g.pointerUp(finger(1, 100, 100));
    expect(count("longPress")).toBe(1);
    expect(count("press")).toBe(0);
  });

  it("pans instead of placing when the finger drags", () => {
    const { g, count, calls } = setup({ placing: true, hit: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerMove(finger(1, 130, 100));
    g.pointerUp(finger(1, 130, 100));
    expect(count("press")).toBe(0);
    expect(calls.find(c => c[0] === "panStart").slice(1)).toEqual([130, 100]);
    expect(count("release")).toBe(1);
  });

  it("ignores the tap that only dismisses an open menu", () => {
    const { g, count } = setup({ placing: true, menuOpen: true });
    tap(g, 100, 100);
    expect(count("press")).toBe(0);
  });
});

describe("finger: other tools", () => {
  it("drags a hit markup with the select tool, pressing at the landing point", () => {
    const { g, calls, count } = setup({ tool: "select", hit: true });
    g.pointerDown(finger(1, 100, 100));
    expect(count("press")).toBe(0);
    g.pointerMove(finger(1, 130, 100));
    const press = calls.find(c => c[0] === "press");
    expect(press[1]).toMatchObject({ clientX: 100, clientY: 100, button: 0, fromFinger: true });
    expect(count("move")).toBe(1);
    g.pointerUp(finger(1, 130, 100));
    expect(count("release")).toBe(1);
  });

  it("pans on a select-tool drag over empty image", () => {
    const { g, count } = setup({ tool: "select", hit: false });
    g.pointerDown(finger(1, 100, 100));
    g.pointerMove(finger(1, 130, 100));
    expect(count("panStart")).toBe(1);
    expect(count("press")).toBe(0);
  });

  it("ignores movement within the tap slop", () => {
    const { g, count } = setup({ tool: "select", hit: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerMove(finger(1, 104, 103));
    expect(count("press")).toBe(0);
    expect(count("panStart")).toBe(0);
  });

  it("adds no point when a pinch starts with a drawing tool", () => {
    const { g, count } = setup({ tool: "point" });
    g.pointerDown(finger(1, 100, 100));
    clock += 20;
    g.pointerDown(finger(2, 300, 100));
    clock += 400;
    g.pointerMove(finger(2, 340, 100));
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 340, 100));
    expect(count("press")).toBe(0);
  });

  it("adds no vertex when pinching in the middle of tracing a curve", () => {
    const { g, count } = setup({ tool: "curve", canFinishShape: true });
    g.pointerDown(finger(1, 100, 100));
    clock += 20;
    g.pointerDown(finger(2, 300, 100));
    clock += 400;
    g.pointerMove(finger(2, 340, 100));
    expect(count("press")).toBe(0);
  });

  it("commits a drag in progress when a second finger lands", () => {
    const { g, names } = setup({ tool: "select", hit: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerMove(finger(1, 130, 100));
    g.pointerDown(finger(2, 300, 100));
    expect(names().indexOf("release")).toBeGreaterThan(-1);
    expect(names().indexOf("release")).toBeLessThan(names().indexOf("pinchStart"));
  });

  it("double-tap zooms with the select tool when the taps are close", () => {
    const { g, count } = setup({ tool: "select" });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 105, 104);
    expect(count("doubleTapZoom")).toBe(1);
  });

  it("does not double-tap zoom when the taps are far apart", () => {
    const { g, count } = setup({ tool: "select" });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 400, 500);
    expect(count("doubleTapZoom")).toBe(0);
  });

  it("double-tap finishes a shape instead of adding a vertex", () => {
    const { g, count } = setup({ tool: "polygon", canFinishShape: true });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 102, 101);
    expect(count("finishShape")).toBe(1);
    expect(count("press")).toBe(1);
  });

  it("a cancelled touch never commits", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerCancel(finger(1, 100, 100));
    expect(count("press")).toBe(0);
  });
});

describe("two-finger tap", () => {
  it("undoes once", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 100, 100));
    clock += 40;
    g.pointerDown(finger(2, 200, 100));
    clock += 80;
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 200, 100));
    expect(count("undo")).toBe(1);
  });

  it("does not undo after a pinch", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 100, 100));
    clock += 40;
    g.pointerDown(finger(2, 200, 100));
    clock += 40;
    g.pointerMove(finger(2, 260, 100));
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 260, 100));
    expect(count("undo")).toBe(0);
    expect(count("pinchMove")).toBeGreaterThan(0);
  });

  it("does not undo when the fingers stay down", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 100, 100));
    clock += 40;
    g.pointerDown(finger(2, 200, 100));
    clock += GESTURE.TWO_FINGER_TAP_MS + 200;
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 200, 100));
    expect(count("undo")).toBe(0);
  });

  it("does not undo when the second finger lands late", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 100, 100));
    clock += GESTURE.TWO_FINGER_STAGGER_MS + 100;
    g.pointerDown(finger(2, 200, 100));
    clock += 40;
    g.pointerUp(finger(1, 100, 100));
    g.pointerUp(finger(2, 200, 100));
    expect(count("undo")).toBe(0);
  });
});

describe("pen", () => {
  it("presses on contact and releases on lift", () => {
    const { g, names } = setup({ tool: "point" });
    const e = pen(100, 100);
    g.pointerDown(e);
    g.pointerUp(pen(100, 100));
    expect(names()).toEqual(["press", "release"]);
  });

  it("passes the real event through, so modifiers and buttons survive", () => {
    const { g, calls } = setup({ tool: "point" });
    const e = pen(100, 100, { button: 2, buttons: 2 });
    g.pointerDown(e);
    expect(calls[0][1]).toBe(e);
  });

  it("forwards hover as a move", () => {
    const { g, count } = setup();
    g.pointerMove(pen(100, 100, { buttons: 0 }));
    expect(count("move")).toBe(1);
  });

  it("double-tap finishes a shape without adding a vertex", () => {
    const { g, count } = setup({ tool: "polygon", canFinishShape: true });
    g.pointerDown(pen(100, 100)); g.pointerUp(pen(100, 100));
    clock += 100;
    g.pointerDown(pen(102, 101)); g.pointerUp(pen(102, 101));
    expect(count("press")).toBe(1);
    expect(count("finishShape")).toBe(1);
  });

  it("places every landmark on fast taps", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(pen(100, 100)); g.pointerUp(pen(100, 100));
    clock += 100;
    g.pointerDown(pen(102, 101)); g.pointerUp(pen(102, 101));
    expect(count("press")).toBe(2);
  });

  it("eraser end erases instead of pressing", () => {
    const { g, calls, count } = setup({ tool: "select" });
    g.pointerDown(pen(100, 120, { button: 5, buttons: 32 }));
    g.pointerMove(pen(150, 120, { buttons: 32 }));
    g.pointerUp(pen(150, 120, { buttons: 0, button: 5 }));
    expect(calls.find(c => c[0] === "erase").slice(1)).toEqual([100, 120]);
    expect(count("press")).toBe(0);
    expect(count("release")).toBe(0);
  });
});

describe("palm rejection", () => {
  it("ignores a touch while the pen is down", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(pen(100, 100));
    tap(g, 300, 300);
    g.pointerUp(pen(100, 100));
    expect(count("press")).toBe(1);
    expect(count("pinchStart")).toBe(0);
  });

  it("ignores a touch just after the pen hovered", () => {
    const { g, count } = setup({ placing: true });
    g.pointerMove(pen(100, 100, { buttons: 0 }));
    clock += GESTURE.PALM_GUARD_MS - 50;
    tap(g, 300, 300);
    expect(count("press")).toBe(0);
  });

  it("accepts a touch once the pen has been away", () => {
    const { g, count } = setup({ placing: true });
    g.pointerMove(pen(100, 100, { buttons: 0 }));
    clock += GESTURE.PALM_GUARD_MS + 50;
    tap(g, 300, 300);
    expect(count("press")).toBe(1);
  });

  it("drops a resting palm when the pen lands", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(finger(1, 300, 300));
    clock += 400;
    g.pointerDown(pen(100, 100));
    g.pointerUp(finger(1, 300, 300));
    g.pointerUp(pen(100, 100));
    expect(count("press")).toBe(1);
  });

  it("drops a palm that lifts while the pen is hovering", () => {
    const { g, count } = setup({ placing: true });
    g.pointerDown(finger(1, 300, 300));
    clock += 100;
    g.pointerMove(pen(100, 100, { buttons: 0 }));
    clock += 100;
    g.pointerUp(finger(1, 300, 300));
    expect(count("press")).toBe(0);
  });

  it("a resting palm with a pen never becomes a pinch", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 300, 300));
    clock += 400;
    g.pointerDown(pen(100, 100));
    clock += 400;
    g.pointerDown(finger(2, 500, 300));
    expect(count("pinchStart")).toBe(0);
  });
});

describe("pen-only mode", () => {
  it("a finger tap never edits", () => {
    const { g, count } = setup({ penOnly: true, placing: true });
    tap(g, 100, 100);
    expect(count("press")).toBe(0);
  });

  it("a finger drag pans even on a markup or with a drawing tool", () => {
    const { g, count } = setup({ penOnly: true, tool: "line", hit: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerMove(finger(1, 130, 100));
    expect(count("panStart")).toBe(1);
    expect(count("press")).toBe(0);
  });

  it("a long press opens no menu", () => {
    const { g, count } = setup({ penOnly: true });
    g.pointerDown(finger(1, 100, 100));
    vi.advanceTimersByTime(GESTURE.LONG_PRESS_MS + 1);
    expect(count("longPress")).toBe(0);
  });

  it("pinch still zooms", () => {
    const { g, count } = setup({ penOnly: true });
    g.pointerDown(finger(1, 100, 100));
    g.pointerDown(finger(2, 300, 100));
    clock += 400;
    g.pointerMove(finger(2, 340, 100));
    expect(count("pinchMove")).toBeGreaterThan(0);
  });

  it("double-tap zooms, even with a drawing tool", () => {
    const { g, count } = setup({ penOnly: true, tool: "polygon", canFinishShape: true });
    tap(g, 100, 100);
    clock += 100;
    tap(g, 102, 101);
    expect(count("doubleTapZoom")).toBe(1);
    expect(count("finishShape")).toBe(0);
  });

  it("the pen still draws", () => {
    const { g, count } = setup({ penOnly: true, tool: "point" });
    g.pointerDown(pen(100, 100));
    expect(count("press")).toBe(1);
  });
});

describe("mouse", () => {
  const mouse = (x, y, extra) => ev("mouse", 1, x, y, extra);

  it("presses, moves and releases straight through", () => {
    const { g, names } = setup({ tool: "point" });
    g.pointerDown(mouse(10, 10));
    g.pointerMove(mouse(20, 10));
    g.pointerUp(mouse(20, 10));
    expect(names()).toEqual(["press", "move", "release"]);
  });

  it("is not affected by pen-only mode", () => {
    const { g, count } = setup({ penOnly: true, tool: "point" });
    g.pointerDown(mouse(10, 10));
    expect(count("press")).toBe(1);
  });

  it("leaving the canvas without a button ends hover state", () => {
    const { g, count } = setup();
    g.pointerLeave(mouse(10, 10, { buttons: 0 }));
    expect(count("release")).toBe(1);
  });

  it("leaving while a touch is active is ignored", () => {
    const { g, count } = setup();
    g.pointerDown(finger(1, 10, 10));
    g.pointerLeave(finger(1, 10, 10));
    expect(count("release")).toBe(0);
  });
});
