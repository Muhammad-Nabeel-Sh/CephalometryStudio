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

const decodeDicom = async (buffer) => (await import("./dicom.js")).decodeDicom(buffer);
const decodeTiff = async (buffer) => (await import("./tiff.js")).decodeTiff(buffer);

export { ImageImportError };

// For <input accept>. DICOM files often have no extension; the file dialog's
// "All files" choice still lets those through, and the content decides.
export const IMAGE_ACCEPT = "image/*,.dcm,.dicom,.dic,.tif,.tiff,application/dicom";
export const MAX_IMAGE_BYTES = 100 * 1024 * 1024;

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

export async function rgbaToPngDataUrl(rgba, width, height) {
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
    raw, calibration: decoded.calibration || null, notes: decoded.notes || [], source: decoded.source || null,
  };
}

// → { name, dataUrl, width, height, raw|null, calibration|null, notes[], source|null }
// Throws ImageImportError with a message for the user.
export async function readImageFile(file) {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageImportError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum image size is 100 MB.`);
  }
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 132));
  if (looksLikeDicom(head) || DICOM_NAME.test(file.name || "") || file.type === "application/dicom") {
    return render(await decodeDicom(buffer), file.name);
  }
  if (looksLikeTiff(head)) return render(await decodeTiff(buffer), file.name);
  const dataUrl = await blobToDataUrl(file);
  try {
    const { width, height } = await imageSize(dataUrl);
    return { name: file.name, dataUrl, width, height, raw: null, calibration: null, notes: [], source: null };
  } catch (e) {
    // No type and not an image: perhaps DICOM without its preamble.
    if (!file.type) {
      try { return render(await decodeDicom(buffer), file.name); } catch { /* not DICOM either */ }
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
