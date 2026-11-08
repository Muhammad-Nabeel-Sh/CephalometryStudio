// DICOM/TIFF leftovers (Phase 2, item 15): any frame of a multi-frame file, every
// frame imported as one session stack, enhanced multi-frame pixel spacing, palette
// colour, 12-bit JPEG Extended (a real NEMA file, checked against libjpeg) and TIFF
// resolution offers.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { decodeDicom } from "../imaging/dicom.js";
import { decodeTiff, tiffResolution } from "../imaging/tiff.js";
import { readImageFile } from "../imaging/readImage.js";
import { MAX_STACK_FRAMES, LARGE_STACK_FRAMES, stackSwitch, sessionImageEntries, validStack, estimateStackBytes, formatBytes } from "../model/stack.js";
import { collectReferencedImageIds } from "../storage/projectStore.js";
import { imageKeys, caseJson } from "../storage/driveSync.js";
import { importCephxPayload, CEPHX_FORMAT, CEPHX_VERSION } from "../storage/cephxFormat.js";
import { ImageImportError } from "../imaging/format.js";
import { tiffCalibrationOffer, importErrorMessage, importImageFile, importImageFiles, compareSeriesItems, largeImportMessage } from "../workspace/images.js";
import { calibrationStatement } from "../report/reportGenerator.js";
import { writeDicom, grayElements, TS, rleFrame16, writeTiff } from "./helpers/dicomWriter.js";

const W = 4, H = 3, N = W * H;
const frameOf = (k) => Uint16Array.from({ length: N }, (_, i) => 100 * (k + 1) + i);
const concat16 = (frames) => { const out = new Uint16Array(frames.length * N); frames.forEach((f, k) => out.set(f, k * N)); return out; };
const multi = (count, extra = []) => grayElements({ rows: H, cols: W, extra: [["0028,0008", "IS", String(count)], ...extra] });

describe("multi-frame DICOM", () => {
  const frames = [0, 1, 2].map(frameOf);

  it("opens any frame of native data (little and big endian)", async () => {
    for (const ts of [TS.explicit, TS.bigEndian, TS.implicit]) {
      const file = writeDicom({ ts, elements: multi(3), pixels: concat16(frames) });
      const first = await decodeDicom(file);
      expect(first.frames).toBe(3);
      expect(first.frame).toBe(0);
      expect(Array.from(first.gray.pixels)).toEqual(Array.from(frames[0]));
      const third = await decodeDicom(file, { frame: 2 });
      expect(Array.from(third.gray.pixels)).toEqual(Array.from(frames[2]));
      expect(third.notes.join(" ")).toContain("Frame 3 of 3");
    }
  });

  it("opens any frame of compressed data stored one fragment per frame", async () => {
    const file = writeDicom({ ts: TS.rle, elements: multi(3), fragments: frames.map(rleFrame16) });
    const second = await decodeDicom(file, { frame: 1 });
    expect(Array.from(second.gray.pixels)).toEqual(Array.from(frames[1]));
  });

  it("refuses frames that don't exist, and truncated data", async () => {
    const file = writeDicom({ elements: multi(3), pixels: concat16(frames) });
    await expect(decodeDicom(file, { frame: 3 })).rejects.toThrow(/frame 4 doesn't exist/);
    await expect(decodeDicom(file, { frame: -1 })).rejects.toBeInstanceOf(ImageImportError);
    const short = writeDicom({ elements: multi(3), pixels: concat16(frames.slice(0, 2)) });
    await expect(decodeDicom(short, { frame: 2 })).rejects.toThrow(/incomplete/);
  });

  it("reads pixel spacing from enhanced multi-frame functional groups", async () => {
    const measures = (ps) => [["0028,9110", "SQ", [[["0028,0030", "DS", ps]]]]];
    const extra = [
      ["5200,9229", "SQ", [measures("0.2\\0.2")]],                              // shared
      ["5200,9230", "SQ", [[], measures("0.1\\0.1"), []]],                       // frame 2 has its own
    ];
    const file = writeDicom({ elements: multi(3, extra), pixels: concat16(frames) });
    expect((await decodeDicom(file, { frame: 0 })).calibration.pxPerMm).toBeCloseTo(5, 6);
    expect((await decodeDicom(file, { frame: 1 })).calibration.pxPerMm).toBeCloseTo(10, 6);
    // Top-level Pixel Spacing still wins.
    const top = writeDicom({ elements: multi(3, [...extra, ["0028,0030", "DS", "0.25\\0.25"]]), pixels: concat16(frames) });
    expect((await decodeDicom(top, { frame: 1 })).calibration.pxPerMm).toBeCloseTo(4, 6);
  });
});

describe("palette colour", () => {
  const palette = (extra, bits = 8, pixels = Uint8Array.from([0, 1, 2, 3, 5, 9])) => writeDicom({
    elements: [
      ["0028,0002", "US", 1], ["0028,0004", "CS", "PALETTE COLOR"], ["0028,0010", "US", 2], ["0028,0011", "US", 3],
      ["0028,0100", "US", bits], ["0028,0101", "US", bits], ["0028,0102", "US", bits - 1], ["0028,0103", "US", 0],
      ...extra,
    ],
    pixels,
  });
  // 16-bit entries (the usual case): first mapped value 1, so index 0 clamps to entry 0.
  const lut16 = (vals) => Uint16Array.from(vals);
  const tables16 = [
    ["0028,1101", "US", [4, 1, 16]], ["0028,1102", "US", [4, 1, 16]], ["0028,1103", "US", [4, 1, 16]],
    ["0028,1201", "OW", lut16([0x0000, 0xff00, 0x0000, 0x8000])],
    ["0028,1202", "OW", lut16([0x0000, 0x0000, 0xff00, 0x8000])],
    ["0028,1203", "OW", lut16([0x0000, 0x0000, 0x0000, 0xff00])],
  ];

  it("maps stored values through the red, green and blue tables", async () => {
    const d = await decodeDicom(palette(tables16));
    expect(d.gray).toBeNull();
    const px = i => Array.from(d.rgba.slice(i * 4, i * 4 + 4));
    expect(px(0)).toEqual([0, 0, 0, 255]);         // below first mapped → entry 0
    expect(px(1)).toEqual([0, 0, 0, 255]);         // value 1 → entry 0
    expect(px(2)).toEqual([255, 0, 0, 255]);       // value 2 → entry 1
    expect(px(3)).toEqual([0, 255, 0, 255]);
    expect(px(4)).toEqual([128, 128, 255, 255]);   // value 5 → last entry (clamped)
  });

  it("reads 8-bit entries packed one per byte", async () => {
    const packed = [
      ["0028,1101", "US", [4, 0, 8]], ["0028,1102", "US", [4, 0, 8]], ["0028,1103", "US", [4, 0, 8]],
      ["0028,1201", "OB", Uint8Array.from([10, 20, 30, 40])],
      ["0028,1202", "OB", Uint8Array.from([1, 2, 3, 4])],
      ["0028,1203", "OB", Uint8Array.from([5, 6, 7, 8])],
    ];
    const d = await decodeDicom(palette(packed));
    expect(Array.from(d.rgba.slice(8, 12))).toEqual([30, 3, 7, 255]); // value 2
  });

  it("explains segmented or missing tables", async () => {
    await expect(decodeDicom(palette([...tables16, ["0028,1221", "OW", lut16([0, 1])]]))).rejects.toThrow(/Segmented/);
    await expect(decodeDicom(palette([]))).rejects.toThrow(/no colour table/);
  });
});

describe("JPEG Extended (12-bit), real file", () => {
  const b = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/dicom/JPGExtended.dcm"));
  const file = b.buffer.slice(b.byteOffset, b.byteOffset + b.length);

  it("decodes within ±1 of libjpeg (pydicom 3.0.2 + pylibjpeg)", async () => {
    const d = await decodeDicom(file);
    expect([d.width, d.height]).toEqual([256, 1024]);
    expect(d.source.lossy).toBe(true);
    const p = d.gray.pixels;
    // [row, col, libjpeg value]
    for (const [r, c, v] of [[100, 100, 1], [500, 128, 10], [300, 60, 13], [700, 200, 1], [512, 128, 14], [900, 30, 1], [256, 200, 19]]) {
      expect(Math.abs(p[r * 256 + c] - v), `${r},${c}`).toBeLessThanOrEqual(1);
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of p) { if (v < lo) lo = v; if (v > hi) hi = v; }
    expect(lo).toBe(0);
    expect(Math.abs(hi - 264)).toBeLessThanOrEqual(1);
  });
});

describe("TIFF resolution", () => {
  const ifd = (x, unit, y = x) => ({ t282: [x], t283: [y], ...(unit ? { t296: [unit] } : {}) });

  it("accepts believable resolutions and explains the rest", () => {
    expect(tiffResolution(ifd(254, 2)).pxPerMm).toBeCloseTo(10, 6);       // 254 dpi = 10 px/mm
    expect(tiffResolution(ifd(100, 3)).pxPerMm).toBeCloseTo(10, 6);       // 100 px/cm
    expect(tiffResolution(ifd(300)).pxPerMm).toBeCloseTo(300 / 25.4, 6);  // unit defaults to inch
    expect(tiffResolution(ifd(72, 2)).reason).toMatch(/placeholder/);
    expect(tiffResolution(ifd(96, 2)).reason).toMatch(/placeholder/);
    expect(tiffResolution(ifd(300, 1)).reason).toMatch(/no resolution unit/);
    expect(tiffResolution(ifd(300, 2, 150)).reason).toMatch(/different/);
    expect(tiffResolution(ifd(20, 2)).reason).toMatch(/outside/);
    expect(tiffResolution({}).reason).toMatch(/no resolution/);
  });

  it("is offered with the decoded image, never applied", () => {
    const samples = new Uint16Array(4).fill(1000);
    const d = decodeTiff(writeTiff({ width: 2, height: 2, samples, resolution: { x: 254, unit: 2 } }));
    expect(d.calibration).toBeNull();
    expect(d.suggestedCalibration).toMatchObject({ done: true, method: "tiff", magnificationCorrected: false });
    expect(d.suggestedCalibration.pxPerMm).toBeCloseTo(10, 3);
    expect(tiffCalibrationOffer(d.suggestedCalibration)).toMatch(/254 dpi.*10\.000 px\/mm.*Check it with a ruler/);
    expect(calibrationStatement(d.suggestedCalibration, "lateral")).toMatch(/TIFF file's resolution.*magnification.*included/);
    expect(decodeTiff(writeTiff({ width: 2, height: 2, samples, resolution: { x: 72, unit: 2 } })).suggestedCalibration).toBeNull();
    expect(decodeTiff(writeTiff({ width: 2, height: 2, samples })).suggestedCalibration).toBeNull();
  });
});

describe("all frames into one session", () => {
  // jsdom has no canvas: stand in for the drawing calls readImageFile makes.
  const saved = {};
  beforeAll(() => {
    const proto = HTMLCanvasElement.prototype;
    Object.assign(saved, { getContext: proto.getContext, toBlob: proto.toBlob, ImageData: globalThis.ImageData });
    proto.getContext = () => ({ putImageData() {}, drawImage() {} });
    proto.toBlob = function (cb) { cb(new Blob(["png"], { type: "image/png" })); };
    globalThis.ImageData ??= class { constructor(data, w, h) { Object.assign(this, { data, width: w, height: h }); } };
  });
  afterAll(() => {
    Object.assign(HTMLCanvasElement.prototype, { getContext: saved.getContext, toBlob: saved.toBlob });
    globalThis.ImageData = saved.ImageData;
  });

  const fileOf = (buf, name = "multi.dcm") => new File([buf], name, { type: "application/dicom" });
  const frames = [0, 1, 2].map(frameOf);

  it("reads frames one at a time when asked for all of them", async () => {
    const read = await readImageFile(fileOf(writeDicom({ elements: multi(3), pixels: concat16(frames) })), { allFrames: true });
    expect(read.frameCount).toBe(3);
    expect(Array.from(read.raw.pixels)).toEqual(Array.from(frames[0]));
    expect(Array.from((await read.readFrame(2)).raw.pixels)).toEqual(Array.from(frames[2]));
    // Without allFrames: the first frame, with a note, as before.
    const one = await readImageFile(fileOf(writeDicom({ elements: multi(3), pixels: concat16(frames) })));
    expect(one.readFrame).toBeUndefined();
    expect(one.notes.join(" ")).toContain("Frame 1 of 3");
  });

  it("imports every frame as one stack, frame 1 shown", async () => {
    const progress = vi.fn();
    const { entry, read, stack } = await importImageFile(fileOf(writeDicom({ elements: multi(3), pixels: concat16(frames) })), { allFrames: true, onProgress: progress });
    expect(stack.index).toBe(0);
    expect(stack.frames).toHaveLength(3);
    expect(new Set(stack.frames.map(f => f.id)).size).toBe(3);
    expect(stack.frames.map(f => f.frame)).toEqual([0, 1, 2]);
    expect(stack.frames[0].id).toBe(entry.id);
    expect(entry.stackLayer).toBe(true);
    expect(entry.name).toBe("multi.dcm · frame 1");
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    expect(read.notes.join(" ")).toMatch(/All 3 frames are in this session/);
    expect(read.notes.join(" ")).not.toMatch(/Frame 1 of 3 was opened/);
    expect(validStack(stack)).toBe(true);
    // A single-frame file has no stack.
    const single = await importImageFile(fileOf(writeDicom({ elements: grayElements({ rows: H, cols: W }), pixels: frames[0] })), { allFrames: true });
    expect(single.stack).toBeUndefined();
    expect(single.entry.stackLayer).toBeUndefined();
  });

  it("puts several files into one stack in series order", async () => {
    const one = (k, extra = []) => writeDicom({ elements: grayElements({ rows: H, cols: W, extra }), pixels: frameOf(k) });
    const files = [
      fileOf(one(2, [["0020,0013", "IS", "3"], ["0028,0030", "DS", String.raw`0.1\0.1`]]), "c.dcm"),
      fileOf(one(0, [["0020,0013", "IS", "1"], ["0028,0030", "DS", String.raw`0.1\0.1`]]), "a.dcm"),
      fileOf(new Uint8Array([1, 2, 3]).buffer, "broken.dcm"),
      fileOf(writeDicom({ elements: multi(2, [["0020,0013", "IS", "2"], ["0028,0030", "DS", String.raw`0.2\0.2`]]), pixels: concat16([frameOf(5), frameOf(6)]) }), "b.dcm"),
    ];
    const { entry, read, stack } = await importImageFiles(files);
    expect(stack.frames.map(f => f.name)).toEqual(["a.dcm", "b.dcm · frame 1", "b.dcm · frame 2", "c.dcm"]);
    expect(stack.frames.map(f => f.frame)).toEqual([0, 1, 2, 3]);
    expect(entry.stackLayer).toBe(true);
    expect(entry.name).toBe("a.dcm");
    expect(entry.dataUrl).toBeTruthy();
    expect(read.calibration.pxPerMm).toBeCloseTo(10, 6);       // from the first image in order
    const notes = read.notes.join(" ");
    expect(notes).toMatch(/4 images from 3 files/);
    expect(notes).toMatch(/1 file couldn't be opened.*broken\.dcm/);
    expect(notes).toMatch(/don't all have the same pixel spacing/);
    await expect(importImageFiles([files[2]])).rejects.toBeInstanceOf(ImageImportError);
  });

  it("orders by instance, then slice position, then file name", () => {
    const it_ = (fileName, order, frameInFile = 0) => ({ fileName, order, frameInFile });
    const sorted = [
      it_("x10.dcm", null), it_("x2.dcm", null), it_("p.dcm", { instance: null, position: -4 }),
      it_("q.dcm", { instance: null, position: 7 }), it_("i5.dcm", { instance: 5 }), it_("i1.dcm", { instance: 1 }),
    ].sort(compareSeriesItems).map(x => x.fileName);
    expect(sorted).toEqual(["i1.dcm", "i5.dcm", "p.dcm", "q.dcm", "x2.dcm", "x10.dcm"]);
  });

  it("reads slice position along the image normal", async () => {
    const d = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, extra: [
      ["0020,0013", "IS", "7"], ["0020,0032", "DS", String.raw`1\2\30`], ["0020,0037", "DS", String.raw`1\0\0\0\1\0`],
    ] }), pixels: frameOf(0) }));
    expect(d.order).toEqual({ instance: 7, position: 30 });
    // A short Image Position is ignored rather than failing the import.
    const short = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, extra: [["0020,0032", "DS", "5"]] }), pixels: frameOf(0) }));
    expect(short.order).toEqual({ instance: null, position: null });
  });

  it("asks before importing a large stack, and stops quietly when declined", async () => {
    const n = LARGE_STACK_FRAMES + 1;
    const big = () => fileOf(writeDicom({ elements: grayElements({ rows: 2, cols: 2, extra: [["0028,0008", "IS", String(n)]] }), pixels: new Uint16Array(4 * n) }));
    const no = vi.fn(async () => false);
    const err = await importImageFile(big(), { allFrames: true, confirmLarge: no }).catch(e => e);
    expect(no).toHaveBeenCalledWith({ count: n, bytes: estimateStackBytes(n, 2, 2, 12) });
    expect(err.cancelled).toBe(true);
    const yes = vi.fn(async () => true);
    const { stack } = await importImageFile(big(), { allFrames: true, confirmLarge: yes });
    expect(stack.frames).toHaveLength(n);
    expect(validStack(stack)).toBe(true);
    // Small stacks don't ask.
    const ask = vi.fn(async () => true);
    await importImageFile(fileOf(writeDicom({ elements: multi(3), pixels: concat16(frames) })), { allFrames: true, confirmLarge: ask });
    expect(ask).not.toHaveBeenCalled();
    // A series is estimated from its first readable file.
    const seriesAsk = vi.fn(async () => false);
    const many = Array.from({ length: n }, (_, k) => fileOf(writeDicom({ elements: grayElements({ rows: 2, cols: 2 }), pixels: new Uint16Array(4) }), `s${k}.dcm`));
    expect((await importImageFiles(many, { confirmLarge: seriesAsk }).catch(e => e)).cancelled).toBe(true);
    expect(seriesAsk.mock.calls[0][0].count).toBe(n);
  });

  it("estimates storage in words", () => {
    expect(estimateStackBytes(600, 512, 512, 16)).toBe(Math.round(600 * 512 * 512 * 2.8));
    expect(formatBytes(estimateStackBytes(600, 512, 512, 16))).toBe("420 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
    expect(largeImportMessage({ count: 600, bytes: 440401920 })).toMatch(/600 images.*420 MB.*backup or \.cephx export/);
    expect(MAX_STACK_FRAMES).toBeGreaterThanOrEqual(1000);
  });
});

describe("frame stack model", () => {
  const frame = (id, extra = {}) => ({ id, dataUrl: null, name: id, raw: { key: `raw:${id}` }, ...extra });
  const session = () => ({
    images: [{ ...frame("a"), stackLayer: true, opacity: 0.7, transform: { tx: 5, ty: 0, rot: 0, scale: 1 } }, { id: "overlay", name: "photo" }],
    stack: { frames: [frame("a"), frame("b"), frame("c")], index: 0 },
  });

  it("shows another frame in the same layer, keeping its position and the other layers", () => {
    const p = stackSwitch(session(), 2);
    expect(p.stack.index).toBe(2);
    expect(p.images[0]).toMatchObject({ id: "c", raw: { key: "raw:c" }, stackLayer: true, opacity: 0.7, transform: { tx: 5 } });
    expect(p.images[1].id).toBe("overlay");
  });

  it("keeps a window saved on the shown frame when moving away", () => {
    const s = session();
    s.images[0] = { ...s.images[0], id: "a2", raw: { key: "raw:a", window: { name: "Bone" } } }; // window commit → new id
    const p = stackSwitch(s, 1);
    expect(p.stack.frames[0]).toMatchObject({ id: "a2", raw: { window: { name: "Bone" } } });
    const back = stackSwitch({ ...s, ...p }, 0);
    expect(back.images[0].id).toBe("a2");
  });

  it("clamps, ignores the shown frame, and needs a stack", () => {
    expect(stackSwitch(session(), 99).stack.index).toBe(2);
    expect(stackSwitch(session(), -5)).toBeNull();
    expect(stackSwitch(session(), 0)).toBeNull();
    expect(stackSwitch({ images: [frame("x")] }, 1)).toBeNull();
  });

  it("lists every image a session owns, once", () => {
    expect(sessionImageEntries(session()).map(e => e.id)).toEqual(["a", "overlay", "b", "c"]);
    expect(sessionImageEntries({ images: [frame("x")] }).map(e => e.id)).toEqual(["x"]);
  });

  it("reaches storage, sync and export", () => {
    const s = session();
    s.stack.frames[1] = { ...s.stack.frames[1], dataUrl: "data:image/png;base64,AA==" };
    const project = { id: "p", sessions: [s] };
    const ids = collectReferencedImageIds([project]);
    for (const k of ["a", "b", "c", "raw:b", "raw:c", "overlay"]) expect(ids.has(k), k).toBe(true);
    expect([...imageKeys(project)]).toEqual(expect.arrayContaining(["b", "c", "raw:c"]));
    const synced = JSON.parse(caseJson(project));
    expect(synced.sessions[0].stack.frames.every(f => f.dataUrl === null)).toBe(true);
    // .cephx import keeps a valid stack and drops a broken one.
    const payload = (stack) => ({ format: CEPHX_FORMAT, version: CEPHX_VERSION, project: { id: "p", name: "P", sessions: [{ id: "s", images: [], markups: [], stack }] } });
    expect(importCephxPayload(payload(s.stack)).project.sessions[0].stack.frames).toHaveLength(3);
    const broken = importCephxPayload(payload({ frames: [{ id: "a" }], index: 4 }));
    expect(broken.project.sessions[0].stack).toBeUndefined();
    expect(broken.warnings.join(" ")).toMatch(/frame stack was malformed/);
  });
});

describe("import error messages", () => {
  it("blames a failed code load on the app, not the file", () => {
    const f = { name: "ceph.dcm" };
    const msg = importErrorMessage(f, new TypeError("Failed to fetch dynamically imported module: http://localhost:5174/src/imaging/dicom.js"));
    expect(msg).toMatch(/Reload the page/);
    expect(msg).not.toMatch(/corrupt/);
    expect(importErrorMessage(f, new Error("boom"))).toMatch(/corrupt or in an unsupported format/);
    expect(importErrorMessage(f, new ImageImportError("Specific reason."))).toBe("Specific reason.");
  });
});
