// ─── TIFF import ────────────────────────────────────────────────────────────
// 16-bit grayscale TIFFs keep their stored values (like DICOM) so the window
// can be changed later; everything else is converted to 8-bit RGBA. TIFF
// resolution tags are not used for calibration: scanners and editors often
// write placeholder values (72 or 96 dpi).

import UTIF from "utif";
import { valueRange } from "./voi.js";
import { ImageImportError, looksLikeTiff } from "./format.js";

export { looksLikeTiff };

export function decodeTiff(buffer) {
  let ifds;
  try { ifds = UTIF.decode(buffer); } catch { throw new ImageImportError("This TIFF file could not be read."); }
  const pages = ifds.filter(d => d.t256 && d.t257);
  if (!pages.length) throw new ImageImportError("This TIFF file has no image.");
  // The largest page: skips thumbnails and reduced-resolution copies.
  const ifd = pages.reduce((a, b) => (b.t256[0] * b.t257[0] > a.t256[0] * a.t257[0] ? b : a));
  try { UTIF.decodeImage(buffer, ifd, ifds); } catch { throw new ImageImportError("This TIFF compression is not supported."); }
  const w = ifd.width, h = ifd.height;
  if (!w || !h || !ifd.data) throw new ImageImportError("This TIFF compression is not supported.");
  const bps = ifd.t258?.[0] ?? 1, spp = ifd.t277?.[0] ?? 1, photo = ifd.t262?.[0] ?? 1, fmt = ifd.t339?.[0] ?? 1;
  const notes = pages.length > 1 ? ["The TIFF has several pages; the largest was opened."] : [];
  const source = { format: "TIFF", bitsStored: bps };

  if (spp === 1 && bps === 16 && (photo === 0 || photo === 1) && fmt !== 3) {
    // decodeImage leaves 16-bit samples little-endian.
    const dv = new DataView(ifd.data.buffer, ifd.data.byteOffset, ifd.data.byteLength);
    const signed = fmt === 2;
    const pixels = signed ? new Int16Array(w * h) : new Uint16Array(w * h);
    for (let i = 0; i < pixels.length; i++) pixels[i] = signed ? dv.getInt16(i * 2, true) : dv.getUint16(i * 2, true);
    const { lo, hi } = valueRange(pixels);
    const meta = {
      width: w, height: h, dtype: signed ? "int16" : "uint16", bitsStored: 16, smin: lo, smax: hi,
      slope: 1, intercept: 0, invert: photo === 0, voiFunction: "LINEAR", windows: [], voiLut: null,
    };
    return { format: "TIFF", width: w, height: h, gray: { pixels, meta }, rgba: null, calibration: null, notes, source };
  }
  const rgba = UTIF.toRGBA8(ifd);
  return { format: "TIFF", width: w, height: h, gray: null, rgba: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), calibration: null, notes, source };
}
