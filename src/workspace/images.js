import { uid } from "../lib/utils.js";
import { logError } from "../lib/logger.js";
import { notify, askConfirm } from "../ui/dialogs.js";
import { readImageFile, imageEntry, rawSummary, isImportableFile, ImageImportError } from "../imaging/readImage.js";
import { storeRawPixels, storeImageBlob, getImageDataUrl } from "../storage/imageStore.js";
import { MAX_STACK_FRAMES, LARGE_STACK_FRAMES, estimateStackBytes, formatBytes } from "../model/stack.js";

// Read any supported file (PNG/JPEG…, DICOM, TIFF) into a new image entry. The
// original pixels of a 12–16-bit image are stored now, so the window can be
// changed later. → { entry, read }; throws ImageImportError.
async function entryFor(read, notes) {
  const id = uid();
  const entry = imageEntry(id, read);
  if (read.raw) {
    const key = `raw:${id}`;
    const r = await storeRawPixels(key, read.raw.pixels, read.raw.meta);
    if (r.ok) entry.raw = rawSummary(key, read.raw.meta, read.raw.window, read.raw.presets);
    else if (!notes.some(n => n.startsWith("The original image depth"))) notes.push("The original image depth could not be kept in this browser, so its window can't be changed later.");
  }
  return entry;
}

const FRAME_NOTE = /^Frame \d+ of \d+ was opened\.$/;

// Above LARGE_STACK_FRAMES the caller's `confirmLarge({ count, bytes })` decides
// (→ true to go on); declining ends the import quietly (`cancelled`).
async function checkLarge(count, read, confirmLarge) {
  if (count <= LARGE_STACK_FRAMES || !confirmLarge) return;
  const bits = read.raw ? read.raw.meta.bitsStored : 8;
  const ok = await confirmLarge({ count, bytes: estimateStackBytes(count, read.width, read.height, bits) });
  if (!ok) throw new ImageImportError("Import cancelled.", { cancelled: true });
}

// The question asked before a large import (for confirmLarge).
export function largeImportMessage({ count, bytes }) {
  return `This adds ${count} images to the session, about ${formatBytes(bytes)} of this browser's storage. Importing takes a while, each image is read from storage as you scroll, and a backup or .cephx export of this case will be about as large.`;
}

// → { entry, read, stack? }. With `allFrames`, every frame of a multi-frame DICOM
// becomes one session stack (model/stack.js): `entry` is frame 1, marked as the
// stack's layer; the other frames go to the image store as they're read, so only
// the shown one stays in memory. `onProgress(done, total)` reports frames read.
export async function importImageFile(file, { allFrames = false, onProgress, confirmLarge } = {}) {
  const read = await readImageFile(file, { allFrames });
  if (read.readFrame) await checkLarge(read.frameCount, read, confirmLarge);
  const entry = await entryFor(read, read.notes);
  if (!read.readFrame) return { entry, read };
  const n = read.frameCount;
  const frames = [{ id: entry.id, dataUrl: entry.dataUrl, name: `${read.name} · frame 1`, frame: 0, ...(entry.raw ? { raw: entry.raw } : {}), ...(entry.source ? { source: entry.source } : {}) }];
  for (let i = 1; i < n; i++) {
    onProgress?.(i + 1, n);
    const r = await read.readFrame(i);
    const e = await entryFor(r, read.notes);
    const stored = await storeImageBlob(e.id, e.dataUrl);
    frames.push({ id: e.id, dataUrl: stored?.ok ? null : e.dataUrl, name: `${read.name} · frame ${i + 1}`, frame: i, ...(e.raw ? { raw: e.raw } : {}), ...(e.source ? { source: e.source } : {}) });
  }
  read.notes = [
    ...read.notes.filter(t => !FRAME_NOTE.test(t)),
    `All ${n} frames are in this session. Move between them with Shift + mouse wheel, Page Up / Page Down, or the frame slider.`,
  ];
  return { entry: { ...entry, name: frames[0].name, stackLayer: true }, read, stack: { frames, index: 0 } };
}

// ─── Several files → one stack (a DICOM series saved one image per file) ───
const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

// Series order: Instance Number, then slice position, then file name, then frame.
export function compareSeriesItems(a, b) {
  const num = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : v);
  for (const k of ["instance", "position"]) {
    const x = num(a.order?.[k]), y = num(b.order?.[k]);
    if (x !== null && y !== null && x !== y) return x - y;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
  }
  return naturalCompare(a.fileName, b.fileName) || a.frameInFile - b.frameInFile;
}

// → { entry, read, stack? } like importImageFile, for every frame of every file,
// in series order. Files that can't be read are skipped and named in the notes
// (all failing → the first error is thrown). Frames are stored as they're read.
// `onProgress(done, total)` counts files.
export async function importImageFiles(files, { onProgress, confirmLarge } = {}) {
  const items = [], failed = [], notes = [];
  let asked = false;
  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    onProgress?.(f + 1, files.length);
    let read;
    try { read = await readImageFile(file, { allFrames: true }); } catch (e) { failed.push({ file, e }); continue; }
    const n = read.frameCount || 1;
    if (!asked) {
      // Estimated from the first readable file: the rest are usually alike.
      asked = true;
      await checkLarge(n * (files.length - f), read, confirmLarge);
    }
    for (let i = 0; i < n; i++) {
      if (items.length >= MAX_STACK_FRAMES) {
        throw new ImageImportError(`These files hold more than ${MAX_STACK_FRAMES} images, more than this app opens. Choose fewer files.`);
      }
      const r = i === 0 ? read : await read.readFrame(i);
      for (const t of r.notes || []) if (!FRAME_NOTE.test(t) && !notes.includes(t)) notes.push(t);
      const entry = await entryFor(r, notes);
      const stored = await storeImageBlob(entry.id, entry.dataUrl);
      items.push({
        entry: { ...entry, dataUrl: stored?.ok ? null : entry.dataUrl },
        name: n > 1 ? `${file.name} · frame ${i + 1}` : file.name,
        fileName: file.name, frameInFile: i, order: r.order, calibration: r.calibration || null,
        suggestedCalibration: r.suggestedCalibration || null,
      });
    }
  }
  if (!items.length) throw failed[0]?.e || new ImageImportError("None of the files could be opened.");
  items.sort(compareSeriesItems);
  const first = items[0];
  const dataUrl = first.entry.dataUrl || await getImageDataUrl(first.entry.id);
  if (!dataUrl) throw new ImageImportError("The first image couldn't be read back from storage.");
  const sameCal = (a, b) => (!a && !b) || (a && b && Math.abs(a.pxPerMm - b.pxPerMm) / a.pxPerMm < 0.001);
  if (items.some(it => !sameCal(it.calibration, first.calibration))) {
    notes.push("The images don't all have the same pixel spacing; the calibration comes from the first one. Check it on the others.");
  }
  if (failed.length) notes.push(`${failed.length} file${failed.length === 1 ? "" : "s"} couldn't be opened and ${failed.length === 1 ? "was" : "were"} left out: ${failed.map(x => x.file.name).join(", ")}.`);
  const read = { calibration: first.calibration, suggestedCalibration: first.suggestedCalibration, source: first.entry.source || null, notes };
  const entry = { ...first.entry, dataUrl, name: first.name };
  if (items.length === 1) return { entry, read };
  const frames = items.map((it, k) => ({
    id: it.entry.id, dataUrl: k === 0 ? null : it.entry.dataUrl, name: it.name, frame: k,
    ...(it.entry.raw ? { raw: it.entry.raw } : {}), ...(it.entry.source ? { source: it.entry.source } : {}),
  }));
  read.notes.push(`${items.length} images from ${files.length - failed.length} file${files.length - failed.length === 1 ? "" : "s"} are in this session, in series order. Move between them with Shift + mouse wheel, Page Up / Page Down, or the frame slider.`);
  return { entry: { ...entry, stackLayer: true }, read, stack: { frames, index: 0 } };
}

// The DICOM/TIFF readers load on first use. When that load fails (offline before
// they were cached, the app updated since the page loaded, the dev server stopped),
// it's the app's fault, not the file's.
const CODE_LOAD_FAILED = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch|ChunkLoadError/i;

export function importErrorMessage(file, e) {
  if (e instanceof ImageImportError) return e.message;
  if (CODE_LOAD_FAILED.test(String(e?.message || e))) {
    return `The app couldn't load the part that reads "${file?.name || "this file"}". Reload the page and try again. This is a loading problem in the app, not a problem with the file.`;
  }
  return `Could not open "${file?.name || "the file"}". It may be corrupt or in an unsupported format.`;
}

// The offer made for a TIFF's resolution tags (never applied without a click).
export function tiffCalibrationOffer(cal) {
  return `The TIFF says ${cal.source.replace(/^TIFF resolution \(|\)$/g, "")} (${cal.pxPerMm.toFixed(3)} px/mm). Use it as the calibration? Check it with a ruler: the value can be wrong if the image was resized, and magnification is included.`;
}

// One line on how a DICOM image was calibrated, for toasts.
export function calibrationNotice(cal) {
  if (!cal?.done || cal.method !== "dicom") return null;
  return `Calibrated from the DICOM file: ${cal.pxPerMm.toFixed(3)} px/mm (${cal.source}).`;
}

// Put an import into the session: a new base image (with its frame stack, or
// none, and its own calibration), or one more layer when `addToStack`.
function applyImport({ entry, read, stack }, addToStack, { getImages, dispatch, updSession, imgRefs, canvasSize, panRef, zoomRef }, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imgRefs.current[entry.id] = img;
      if (addToStack) {
        updSession({ images: [...(getImages() || []), entry] });
      } else {
        updSession({ images: [entry], stack: stack || null });
        const cw = canvasSize.current.w - 80, ch = canvasSize.current.h - 80;
        const sc = Math.min(cw / (img.naturalWidth || 600), ch / (img.naturalHeight || 500), 1);
        if (zoomRef) zoomRef.current = sc;
        dispatch({ type: "SET", payload: { zoom: sc } });
        panRef.current = { x: 40, y: 40 };
        dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } });
        updSession({ calibration: read.calibration || { done: false, pxPerMm: 1, knownMm: "" } });
      }
      const lines = [!addToStack && calibrationNotice(read.calibration), ...read.notes].filter(Boolean);
      if (lines.length) notify(lines.join(" "), { tone: read.calibration?.magnificationCorrected === false || !read.calibration && read.source ? "warn" : "info", duration: 12000 });
      const suggested = !addToStack && !read.calibration && read.suggestedCalibration;
      if (suggested) {
        notify(tiffCalibrationOffer(suggested), {
          tone: "info", duration: 20000, key: "tiff-calibration",
          action: { label: "Use it", onClick: () => updSession({ calibration: suggested }) },
        });
      }
      resolve();
    };
    img.onerror = () => reject(new ImageImportError(`Could not decode "${label}". The file may be corrupt or in an unsupported format.`));
    img.src = entry.dataUrl;
  });
}

export const askLargeImport = (info) => askConfirm({ title: `Import ${info.count} images?`, message: largeImportMessage(info), confirmLabel: "Import" });

function importFailed(file, e) {
  if (e?.cancelled) return;
  if (!(e instanceof ImageImportError)) logError("Image import failed:", e);
  notify(importErrorMessage(file, e), { tone: "err" });
}

// `getImages` returns the session's current images (read when the file is
// ready, so several files dropped at once stack instead of replacing each other).
export function loadImageFile(file, addToStack, ctx) {
  if (!file || !isImportableFile(file)) return Promise.resolve();
  ctx.dispatch({ type: "SET", payload: { loadingImages: true } });
  const progress = (done, total) => notify(`Importing frame ${done} of ${total}…`, { key: "frame-import", duration: 4000 });
  return importImageFile(file, { allFrames: !addToStack, onProgress: progress, confirmLarge: askLargeImport })
    .then((result) => applyImport(result, addToStack, ctx, file.name))
    .catch(e => importFailed(file, e))
    .finally(() => ctx.dispatch({ type: "SET", payload: { loadingImages: false } }));
}

// Several files chosen together (Import DICOM): one session, one stack, in
// series order. One file goes through loadImageFile.
export function loadImageFiles(files, ctx) {
  const list = Array.from(files || []).filter(isImportableFile);
  if (list.length <= 1) return loadImageFile(list[0], false, ctx);
  ctx.dispatch({ type: "SET", payload: { loadingImages: true } });
  const progress = (done, total) => notify(`Reading file ${done} of ${total}…`, { key: "frame-import", duration: 4000 });
  return importImageFiles(list, { onProgress: progress, confirmLarge: askLargeImport })
    .then((result) => applyImport(result, false, ctx, list[0].name))
    .catch(e => importFailed(list[0], e))
    .finally(() => ctx.dispatch({ type: "SET", payload: { loadingImages: false } }));
}

export async function handleImageDrop(e, loadImageFn) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(isImportableFile);
  // One at a time, in order: the first replaces the image, the rest stack.
  for (let i = 0; i < files.length; i++) await loadImageFn(files[i], i > 0);
}
