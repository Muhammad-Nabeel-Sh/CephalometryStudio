// ─── Reading an image file (every import path) ──────────────────────────────
//
// PNG/JPEG/WebP… go to the browser unchanged. DICOM and TIFF are decoded here
// and rendered to a PNG, so the rest of the app (canvas, AI, report, export,
// storage) works with an ordinary image. For 12–16-bit grayscale the stored
// values are returned too (`raw`) so the window can be changed later without
// losing depth; callers store them with imageStore.storeRawPixels. The DICOM
// and TIFF decoders load on first use.

import { ImageImportError, looksLikeDicom, looksLikeTiff } from "./format.js";
import { buildLut, renderGray, defaultChoice, windowPresets, modalityRange } from "./voi.js";
import { MAX_STACK_FRAMES } from "../model/stack.js";

const decodeDicom = async (buffer, opts) => (await import("./dicom.js")).decodeDicom(buffer, opts);
const decodeTiff = async (buffer) => (await import("./tiff.js")).decodeTiff(buffer);

export { ImageImportError };

// For <input accept>. DICOM files often have no extension; the file dialog's
// "All files" choice still lets those through, and the content decides.
export const IMAGE_ACCEPT = "image/*,.dcm,.dicom,.dic,.tif,.tiff,application/dicom";
// The "Import DICOM" buttons. Files without an extension still open through the
// dialog's "All files" choice; the content, not the name, decides.
export const DICOM_ACCEPT = ".dcm,.dicom,.dic,application/dicom";
export const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
// A DICOM file can hold a whole multi-frame study (an enhanced CT is often several hundred MB).
export const MAX_DICOM_BYTES = 1024 * 1024 * 1024;

const DICOM_NAME = /\.(dcm|dicom|dic)$/i;

// Files worth trying: images, DICOM/TIFF by name or type, and files with no
// type at all (typical for DICOM exported without extensions).
export function isImportableFile(file) {
  if (!file) return false;
  const type = file.type || "";
  return type.startsWith("image/") || type === "application/dicom" || DICOM_NAME.test(file.name || "") || /\.tiff?$/i.test(file.name || "") || !type;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

function imageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new ImageImportError("The file is not an image the browser can open."));
    img.src = dataUrl;
  });
}

// PNG encoding runs in a worker when the browser can (imaging/pngEncoder.worker.js):
// the canvas route is throttled in background tabs. Falls back to the canvas.
let pngWorker = null, pngSeq = 0;
const pngPending = new Map();
function encodeInWorker(rgba, width, height) {
  if (pngWorker === false || typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return null;
  if (!pngWorker) {
    try {
      pngWorker = new Worker(new URL("./pngEncoder.worker.js", import.meta.url), { type: "module" });
      pngWorker.onmessage = (e) => {
        const p = pngPending.get(e.data.id);
        if (!p) return;
        pngPending.delete(e.data.id);
        if (e.data.blob) p.resolve(e.data.blob); else p.reject(new Error(e.data.error || "PNG encoding failed"));
      };
      pngWorker.onerror = () => {
        // The worker can't run here: fail what's waiting (callers fall back) and stop using it.
        for (const p of pngPending.values()) p.reject(new Error("PNG worker unavailable"));
        pngPending.clear();
        pngWorker = false;
      };
    } catch {
      pngWorker = false;
      return null;
    }
  }
  const id = ++pngSeq;
  const copy = new Uint8ClampedArray(rgba); // the caller keeps its array
  return new Promise((resolve, reject) => {
    pngPending.set(id, { resolve, reject });
    pngWorker.postMessage({ id, width, height, rgba: copy.buffer }, [copy.buffer]);
  });
}

export async function rgbaToPngDataUrl(rgba, width, height) {
  const viaWorker = encodeInWorker(rgba, width, height);
  if (viaWorker) {
    try { return await blobToDataUrl(await viaWorker); } catch { /* fall back to the canvas */ }
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  c.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  const blob = await new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"));
  return blobToDataUrl(blob);
}

// PNG of the stored values through a window (or the file's VOI LUT).
export function renderWindowDataUrl(pixels, meta, choice) {
  return rgbaToPngDataUrl(renderGray(pixels, meta, buildLut(meta, choice)), meta.width, meta.height);
}

// What the image entry keeps about the original depth (no pixels).
export function rawSummary(key, meta, window, presets) {
  const { min, max } = modalityRange(meta);
  return {
    key, bits: meta.bitsStored, min, max,
    window: window.lut ? { name: window.name, lut: true } : { name: window.name, center: window.center, width: window.width },
    presets: presets.map(p => (p.lut ? { name: p.name, lut: true } : { name: p.name, center: p.center, width: p.width })),
  };
}

async function render(decoded, name) {
  let rgba = decoded.rgba, raw = null;
  if (decoded.gray) {
    const { pixels, meta } = decoded.gray;
    const choice = defaultChoice(pixels, meta);
    rgba = renderGray(pixels, meta, buildLut(meta, choice));
    if (meta.dtype !== "uint8") raw = { pixels, meta, window: choice, presets: windowPresets(pixels, meta) };
  }
  return {
    name, width: decoded.width, height: decoded.height,
    dataUrl: await rgbaToPngDataUrl(rgba, decoded.width, decoded.height),
    raw, calibration: decoded.calibration || null, suggestedCalibration: decoded.suggestedCalibration || null,
    order: decoded.order || null,
    notes: decoded.notes || [], source: decoded.source || null,
  };
}

// Multi-frame DICOM with `allFrames`: the result also carries `frameCount` and
// `readFrame(i)`, which decodes and renders one more frame. Frames are read one
// at a time so a long file never holds every frame's pixels at once.
async function readDicom(buffer, name, allFrames, first = null) {
  const decoded = first || await decodeDicom(buffer);
  const read = await render(decoded, name);
  if (!allFrames || !(decoded.frames > 1)) return read;
  if (decoded.frames > MAX_STACK_FRAMES) {
    throw new ImageImportError(`"${name}" has ${decoded.frames} frames, more than this app opens (${MAX_STACK_FRAMES}).`);
  }
  read.frameCount = decoded.frames;
  read.readFrame = async (i) => render(await decodeDicom(buffer, { frame: i }), name);
  return read;
}

// → { name, dataUrl, width, height, raw|null, calibration|null, suggestedCalibration|null, notes[], source|null }
// plus { frameCount, readFrame(i) } for a multi-frame DICOM when `allFrames` is set
// (otherwise its first frame, with a note). `suggestedCalibration` (TIFF resolution)
// is offered to the user, never applied by itself. Throws ImageImportError with a
// message for the user.
export async function readImageFile(file, { allFrames = false } = {}) {
  // Sniff first: DICOM may be much larger than other images.
  const head = new Uint8Array(await file.slice(0, 132).arrayBuffer());
  const dicom = looksLikeDicom(head) || DICOM_NAME.test(file.name || "") || file.type === "application/dicom" || !file.type;
  const limit = dicom ? MAX_DICOM_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    throw new ImageImportError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum is ${limit / 1024 / 1024} MB${dicom ? " for a DICOM file" : " for an image"}.`);
  }
  const buffer = await file.arrayBuffer();
  if (looksLikeDicom(head) || DICOM_NAME.test(file.name || "") || file.type === "application/dicom") {
    return readDicom(buffer, file.name, allFrames);
  }
  if (looksLikeTiff(head)) return render(await decodeTiff(buffer), file.name);
  const dataUrl = await blobToDataUrl(file);
  try {
    const { width, height } = await imageSize(dataUrl);
    return { name: file.name, dataUrl, width, height, raw: null, calibration: null, notes: [], source: null };
  } catch (e) {
    // No type and not an image: perhaps DICOM without its preamble.
    if (!file.type) {
      let decoded = null;
      try { decoded = await decodeDicom(buffer); } catch { /* not DICOM either */ }
      if (decoded) return readDicom(buffer, file.name, allFrames, decoded);
    }
    throw e;
  }
}

// A new image entry for a read image (raw summary added by the caller once the
// stored values are saved).
export function imageEntry(id, read) {
  return {
    id, name: read.name, dataUrl: read.dataUrl, dx: 0, dy: 0, opacity: 1, blendMode: "normal",
    visible: true, color: "none", transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
    ...(read.source ? { source: read.source } : {}),
  };
}
