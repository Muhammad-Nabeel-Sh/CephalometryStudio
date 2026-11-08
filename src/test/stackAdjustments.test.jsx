// Image adjustments across a frame stack: brightness/contrast/edge/LUT are
// processed for every image (the worker queue used to keep one job in total, so
// frames scrolled past stayed unprocessed), and a stack shares one window/level.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../storage/imageStore.js", () => ({
  getRawPixels: async () => ({ pixels: new Uint16Array([0, 1000, 2000, 3000]), meta: { width: 2, height: 2, dtype: "uint16", bitsStored: 12, smin: 0, smax: 3000, slope: 1, intercept: 0, invert: false, voiFunction: "LINEAR", windows: [], voiLut: null } }),
}));

import { processImageToCanvas, _procQueueState } from "../canvas/imageUtils.jsx";
import { useSourceWindow, sameWindow } from "../hooks/useSourceWindow.js";

const workers = [];
const saved = {};
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype;
  Object.assign(saved, { getContext: proto.getContext, Worker: globalThis.Worker });
  proto.getContext = () => ({
    drawImage() {}, putImageData() {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  });
  globalThis.Worker = class {
    constructor() { this.sent = []; workers.push(this); }
    postMessage(m) { this.sent.push(m); }
    reply() { const m = this.sent.shift(); this.onmessage({ data: { id: m.id, data: m.pixels } }); return m; }
  };
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = saved.getContext;
  globalThis.Worker = saved.Worker;
});

const img = (name) => ({ name, naturalWidth: 2, naturalHeight: 2 });
const PROC = { brightness: 20, contrast: 0, windowWidth: 0, windowCenter: 128, edgeEnhance: 0 };

describe("processing queue", () => {
  it("processes every image, newest request first, latest settings only", () => {
    const [a, b, c] = [img("a"), img("b"), img("c")];
    processImageToCanvas(a, PROC, "gray", false);               // starts at once
    processImageToCanvas(b, PROC, "gray", false);
    processImageToCanvas(b, { ...PROC, brightness: 30 }, "gray", false); // replaces b's job
    processImageToCanvas(c, PROC, "gray", false);
    const w = workers[0];
    expect(_procQueueState().queued.map(x => x.name)).toEqual(["b", "c"]);
    w.reply();                                                  // a done
    expect(w.sent[0].proc.brightness).toBe(20);                 // c next (most recent)
    w.reply();                                                  // c done
    expect(w.sent[0].proc.brightness).toBe(30);                 // then b, with its latest settings
    w.reply();
    expect(_procQueueState()).toEqual({ busy: false, queued: [] });
  });

  it("marks dropped jobs stale so they're redone when drawn", () => {
    const first = processImageToCanvas(img("busy"), PROC, "gray", false);
    const canvases = Array.from({ length: 30 }, (_, k) => processImageToCanvas(img(`f${k}`), PROC, "gray", false));
    expect(_procQueueState().queued).toHaveLength(24);
    expect(canvases.slice(0, 6).every(c => c._stale)).toBe(true);
    expect(canvases.slice(6).some(c => c._stale)).toBe(false);
    expect(first._stale).toBeUndefined();
    const w = workers[0];
    while (w.sent.length) w.reply();
    expect(_procQueueState().queued).toHaveLength(0);
  });
});

describe("shared window across a stack", () => {
  it("compares windows by their values", () => {
    expect(sameWindow({ name: "A", center: 100, width: 50 }, { name: "B", center: 100, width: 50 })).toBe(true);
    expect(sameWindow({ center: 100, width: 50 }, { center: 101, width: 50 })).toBe(false);
    expect(sameWindow({ lut: true }, { lut: true })).toBe(true);
  });

  it("re-renders a frame shown with another window, and reports the user's choices", async () => {
    const frame = { id: "f2", stackLayer: true, raw: { key: "raw:f2", bits: 12, min: 0, max: 3000, presets: [], window: { name: "File", center: 100, width: 50 } } };
    const shared = { name: "Bone", center: 1500, width: 3000 };
    const chosen = vi.fn();
    const props = { sessionImage: [frame], setLoadedImage: () => {}, updSession: () => {}, getImages: () => [frame], onSourceChange: () => {}, sharedWindow: shared, onWindowChosen: chosen };
    const { result } = renderHook((p) => useSourceWindow(p), { initialProps: props });
    await waitFor(() => expect(result.current.window).toEqual(shared));
    expect(result.current.saving).toBe(true);
    expect(result.current.shared).toBe(true);
    expect(chosen).not.toHaveBeenCalled();              // applied, not chosen by the user
    act(() => result.current.setWindow({ name: "Custom", center: 800, width: 400 }));
    expect(chosen).toHaveBeenCalledWith({ name: "Custom", center: 800, width: 400 });
  });

  it("applies the window again when coming back to a frame left before it was saved", async () => {
    const mk = (id) => ({ id, stackLayer: true, raw: { key: `raw:${id}`, bits: 12, min: 0, max: 3000, presets: [], window: { name: "Auto", center: 2300, width: 3400 } } });
    const [f32, f33] = [mk("f32"), mk("f33")];
    const shared = { name: "Custom", center: 1500, width: 400 };
    const base = { setLoadedImage: () => {}, updSession: () => {}, onSourceChange: () => {}, sharedWindow: shared };
    const { result, rerender } = renderHook((p) => useSourceWindow(p), { initialProps: { ...base, sessionImage: [f32], getImages: () => [f32] } });
    await waitFor(() => expect(result.current.previewFor("f32")).toBeTruthy());
    rerender({ ...base, sessionImage: [f33], getImages: () => [f33] });   // moved on before the save
    await waitFor(() => expect(result.current.previewFor("f33")).toBeTruthy());
    rerender({ ...base, sessionImage: [f32], getImages: () => [f32] });   // and back
    await waitFor(() => expect(result.current.previewFor("f32")).toBeTruthy());
    expect(result.current.window).toEqual(shared);
  });

  it("leaves a frame alone when it already has the stack's window", async () => {
    const frame = { id: "f3", stackLayer: true, raw: { key: "raw:f3", bits: 12, min: 0, max: 3000, presets: [], window: { name: "Saved", center: 1500, width: 3000 } } };
    const props = { sessionImage: [frame], setLoadedImage: () => {}, updSession: () => {}, getImages: () => [frame], onSourceChange: () => {}, sharedWindow: { name: "Bone", center: 1500, width: 3000 } };
    const { result } = renderHook((p) => useSourceWindow(p), { initialProps: props });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.saving).toBe(false);
  });
});
