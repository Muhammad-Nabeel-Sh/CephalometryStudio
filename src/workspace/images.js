import { uid } from "../lib/utils.js";
import { logError } from "../lib/logger.js";
import { notify } from "../ui/dialogs.js";
import { readImageFile, imageEntry, rawSummary, isImportableFile, ImageImportError } from "../imaging/readImage.js";
import { storeRawPixels } from "../storage/imageStore.js";

// Read any supported file (PNG/JPEG…, DICOM, TIFF) into a new image entry. The
// original pixels of a 12–16-bit image are stored now, so the window can be
// changed later. → { entry, read }; throws ImageImportError.
export async function importImageFile(file) {
  const read = await readImageFile(file);
  const id = uid();
  const entry = imageEntry(id, read);
  if (read.raw) {
    const key = `raw:${id}`;
    const r = await storeRawPixels(key, read.raw.pixels, read.raw.meta);
    if (r.ok) entry.raw = rawSummary(key, read.raw.meta, read.raw.window, read.raw.presets);
    else read.notes.push("The original image depth could not be kept in this browser, so its window can't be changed later.");
  }
  return { entry, read };
}

export function importErrorMessage(file, e) {
  if (e instanceof ImageImportError) return e.message;
  return `Could not open "${file?.name || "the file"}". It may be corrupt or in an unsupported format.`;
}

// One line on how a DICOM image was calibrated, for toasts.
export function calibrationNotice(cal) {
  if (!cal?.done || cal.method !== "dicom") return null;
  return `Calibrated from the DICOM file: ${cal.pxPerMm.toFixed(3)} px/mm (${cal.source}).`;
}

// `getImages` returns the session's current images (read when the file is
// ready, so several files dropped at once stack instead of replacing each other).
export function loadImageFile(file, addToStack, { getImages, dispatch, updSession, imgRefs, canvasSize, panRef, zoomRef }) {
  if (!file || !isImportableFile(file)) return Promise.resolve();
  dispatch({ type: "SET", payload: { loadingImages: true } });
  return importImageFile(file)
    .then(({ entry, read }) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imgRefs.current[entry.id] = img;
        if (addToStack) {
          updSession({ images: [...(getImages() || []), entry] });
        } else {
          updSession({ images: [entry] });
          const cw = canvasSize.current.w - 80, ch = canvasSize.current.h - 80;
          const sc = Math.min(cw / (img.naturalWidth || 600), ch / (img.naturalHeight || 500), 1);
          if (zoomRef) zoomRef.current = sc;
          dispatch({ type: "SET", payload: { zoom: sc } });
          panRef.current = { x: 40, y: 40 };
          dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } });
          // A new base image: its own DICOM calibration, or none.
          updSession({ calibration: read.calibration || { done: false, pxPerMm: 1, knownMm: "" } });
        }
        const lines = [!addToStack && calibrationNotice(read.calibration), ...read.notes].filter(Boolean);
        if (lines.length) notify(lines.join(" "), { tone: read.calibration?.magnificationCorrected === false || !read.calibration && read.source ? "warn" : "info", duration: 12000 });
        resolve();
      };
      img.onerror = () => reject(new ImageImportError(`Could not decode "${file.name}". The file may be corrupt or in an unsupported format.`));
      img.src = entry.dataUrl;
    }))
    .catch(e => {
      if (!(e instanceof ImageImportError)) logError("Image import failed:", e);
      notify(importErrorMessage(file, e), { tone: "err" });
    })
    .finally(() => dispatch({ type: "SET", payload: { loadingImages: false } }));
}

export async function handleImageDrop(e, loadImageFn) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(isImportableFile);
  // One at a time, in order: the first replaces the image, the rest stack.
  for (let i = 0; i < files.length; i++) await loadImageFn(files[i], i > 0);
}
