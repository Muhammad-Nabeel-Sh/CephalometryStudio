// ─── DICOM import (Phase 2, item 15) ─────────────────────────────────────────
//
// Reads the first frame of a DICOM file into either
//   gray: { pixels, meta }   stored values + display metadata (imaging/voi.js)
//   rgba                     8-bit colour (photos, JPEG baseline)
// plus a calibration from the pixel-spacing attributes and non-identifying
// device information. Patient attributes are never read.
//
// Transfer syntaxes: implicit/explicit VR little endian, explicit big endian,
// RLE lossless, JPEG baseline (8-bit), JPEG lossless (process 14), JPEG-LS and
// JPEG 2000 (lossless and lossy). Decoders for the compressed ones load on
// demand (imaging/codecs.js).

import dicomParser from "dicom-parser";
import * as defaultCodecs from "./codecs.js";
import { valueRange } from "./voi.js";
import { ImageImportError, looksLikeDicom } from "./format.js";

export { ImageImportError, looksLikeDicom };

const TRANSFER = {
  "1.2.840.10008.1.2": ["native", "Implicit VR Little Endian"],
  "1.2.840.10008.1.2.1": ["native", "Explicit VR Little Endian"],
  "1.2.840.10008.1.2.2": ["native-be", "Explicit VR Big Endian"],
  "1.2.840.10008.1.2.1.99": ["deflate", "Deflated Explicit VR Little Endian"],
  "1.2.840.10008.1.2.5": ["rle", "RLE Lossless"],
  "1.2.840.10008.1.2.4.50": ["jpeg-baseline", "JPEG Baseline"],
  "1.2.840.10008.1.2.4.51": ["jpeg-extended", "JPEG Extended (12-bit)"],
  "1.2.840.10008.1.2.4.57": ["jpeg-lossless", "JPEG Lossless"],
  "1.2.840.10008.1.2.4.70": ["jpeg-lossless", "JPEG Lossless (SV1)"],
  "1.2.840.10008.1.2.4.80": ["jpeg-ls", "JPEG-LS Lossless"],
  "1.2.840.10008.1.2.4.81": ["jpeg-ls", "JPEG-LS Near-lossless"],
  "1.2.840.10008.1.2.4.90": ["j2k", "JPEG 2000 Lossless"],
  "1.2.840.10008.1.2.4.91": ["j2k", "JPEG 2000"],
};
const LOSSY = new Set(["jpeg-baseline", "jpeg-extended"]);

// ─── Pixel calibration ───────────────────────────────────────────────────
// Prefers spacing in the patient (corrected for radiographic magnification):
//   1. Pixel Spacing with a GEOMETRY/FIDUCIAL calibration type
//   2. Imager Pixel Spacing ÷ Estimated Radiographic Magnification Factor
//   3. Pixel Spacing that differs from Imager Pixel Spacing (device-corrected)
// then falls back to detector/film-plane spacing (magnification included):
//   4. Pixel Spacing equal to (or without) Imager Pixel Spacing
//   5. Imager Pixel Spacing, 6. Nominal Scanned Pixel Spacing.
export function dicomCalibration(get) {
  const pair = (tag) => {
    const r = get.float(tag, 0), c = get.float(tag, 1);
    return r > 0 ? [r, c > 0 ? c : r] : null;
  };
  const ps = pair("x00280030"), ips = pair("x00181164"), nsps = pair("x00182010");
  const ermf = get.float("x00181114", 0);
  const calType = (get.str("x00280a02") || "").toUpperCase();
  const same = (a, b) => Math.abs(a[0] - b[0]) / b[0] < 0.005 && Math.abs(a[1] - b[1]) / b[1] < 0.005;
  let spacing = null, source = "", corrected = false;
  if (ps && (calType === "GEOMETRY" || calType === "FIDUCIAL")) {
    spacing = ps; corrected = true;
    source = `Pixel Spacing (${calType === "GEOMETRY" ? "geometry" : "fiducial"} calibrated)`;
  } else if (ips && ermf > 1 && ermf < 2) {
    spacing = ips.map(v => v / ermf); corrected = true;
    source = `Imager Pixel Spacing ÷ magnification factor ${+ermf.toFixed(4)}`;
  } else if (ps && ips && !same(ps, ips)) {
    spacing = ps; corrected = true;
    source = "Pixel Spacing (in the patient)";
  } else if (ps) {
    spacing = ps; source = "Pixel Spacing";
  } else if (ips) {
    spacing = ips; source = "Imager Pixel Spacing (detector plane)";
  } else if (nsps) {
    spacing = nsps; source = "Nominal Scanned Pixel Spacing (film plane)";
  }
  if (!spacing) return { calibration: null, note: "The file has no pixel spacing, so it was not calibrated. Calibrate with a ruler." };
  const [row, col] = spacing;
  if (Math.abs(row - col) / Math.max(row, col) > 0.01) {
    return { calibration: null, note: `Pixels are not square (${row} × ${col} mm), so the image was not calibrated. Calibrate with a ruler.` };
  }
  const mmPerPx = (row + col) / 2;
  if (!(mmPerPx > 0.005 && mmPerPx < 5)) return { calibration: null, note: `The stored pixel spacing (${mmPerPx} mm) is implausible; calibrate with a ruler.` };
  return {
    calibration: { done: true, pxPerMm: 1 / mmPerPx, knownMm: "", method: "dicom", source, magnificationCorrected: corrected },
    note: corrected ? null : "The pixel spacing is at the detector, so radiographic magnification (about 8–15% on cephalograms) is included in distances. Calibrate with a ruler at the midsagittal plane for anatomical size.",
  };
}

// ─── Pixel data helpers ──────────────────────────────────────────────────
function unpackBits(src, n) {
  const out = new Uint8Array(n);
  let i = 0, o = 0;
  while (i < src.length && o < n) {
    const h = (src[i++] << 24) >> 24;
    if (h >= 0) {
      const len = Math.min(h + 1, n - o, src.length - i);
      out.set(src.subarray(i, i + len), o);
      i += h + 1; o += len;
    } else if (h > -128) {
      const len = Math.min(1 - h, n - o);
      out.fill(src[i++], o, o + len);
      o += len;
    }
  }
  return out;
}

// RLE Lossless (PS3.5 Annex G): one PackBits segment per byte plane, most
// significant byte first, per sample.
export function decodeRle(frame, rows, cols, spp, bitsAllocated) {
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const nSeg = dv.getUint32(0, true);
  const bps = bitsAllocated / 8, n = rows * cols;
  if (nSeg !== spp * bps) throw new ImageImportError("The RLE-compressed image is malformed.");
  const offsets = Array.from({ length: nSeg }, (_, i) => dv.getUint32(4 + 4 * i, true));
  const out = new Uint8Array(n * spp * bps);
  for (let s = 0; s < spp; s++) {
    for (let b = 0; b < bps; b++) {
      const seg = s * bps + b;
      const plane = unpackBits(frame.subarray(offsets[seg], seg + 1 < nSeg ? offsets[seg + 1] : frame.length), n);
      const at = bps - 1 - b; // little-endian position of this byte
      for (let i = 0; i < n; i++) out[(i * spp + s) * bps + at] = plane[i];
    }
  }
  return bps === 2 ? new Uint16Array(out.buffer) : out;
}

// Keep the stored bits (and sign-extend signed values).
function storedValues(samples, bitsStored, highBit, signed) {
  const bits = samples.BYTES_PER_ELEMENT * 8;
  const shift = Math.max(0, (highBit ?? bitsStored - 1) + 1 - bitsStored);
  if (!signed && bitsStored >= bits && !shift) return samples;
  const mask = bitsStored >= 32 ? 0xffffffff : (1 << bitsStored) - 1;
  const sign = 1 << (bitsStored - 1), full = 2 ** bitsStored;
  const out = signed ? new Int16Array(samples.length) : new samples.constructor(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] >>> shift) & mask;
    out[i] = signed && v & sign ? v - full : v;
  }
  return out;
}

function toRgba(samples, rows, cols, spp, photometric, planar, bits) {
  const n = rows * cols, rgba = new Uint8ClampedArray(n * 4);
  const down = bits > 8 ? bits - 8 : 0;
  const at = (i, c) => (planar ? samples[c * n + i] : samples[i * spp + c]) >> down;
  const ybr = photometric === "YBR_FULL";
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = at(i, 0), g = at(i, 1), b = at(i, 2);
    if (ybr) {
      const y = r, cb = g - 128, cr = b - 128;
      r = y + 1.402 * cr; g = y - 0.344136 * cb - 0.714136 * cr; b = y + 1.772 * cb;
    }
    rgba[j] = r; rgba[j + 1] = g; rgba[j + 2] = b; rgba[j + 3] = 255;
  }
  return rgba;
}

// Frame 0 of encapsulated (compressed) pixel data.
function encapsulatedFrame(ds, el, frames, jpegFamily) {
  if (frames <= 1) return dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, el.fragments.length);
  if (el.basicOffsetTable?.length) return dicomParser.readEncapsulatedImageFrame(ds, el, 0);
  if (jpegFamily) return dicomParser.readEncapsulatedImageFrame(ds, el, 0, dicomParser.createJPEGBasicOffsetTable(ds, el));
  return dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, 1);
}

function readVoiLut(ds, signed) {
  const item = ds.elements.x00283010?.items?.[0]?.dataSet;
  const data = item?.elements?.x00283006;
  if (!item || !data) return null;
  let n = item.uint16("x00283002", 0) || 65536;
  const first = signed ? item.int16("x00283002", 1) : item.uint16("x00283002", 1);
  const bytes = item.byteArray.subarray(data.dataOffset, data.dataOffset + data.length);
  const wide = data.length >= n * 2;
  n = Math.min(n, wide ? data.length >> 1 : data.length);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = Array.from({ length: n }, (_, i) => (wide ? dv.getUint16(i * 2, true) : bytes[i]));
  return values.length ? { first: first || 0, data: values } : null;
}

// ─── Decode ──────────────────────────────────────────────────────────────
// `codecs` can be replaced (tests); the defaults load on demand.
export async function decodeDicom(buffer, { codecs = defaultCodecs } = {}) {
  const bytes = new Uint8Array(buffer);
  let ds;
  try {
    ds = dicomParser.parseDicom(bytes, looksLikeDicom(bytes) ? undefined : { TransferSyntaxUID: "1.2.840.10008.1.2" });
  } catch (e) {
    const why = e?.exception || e?.message || String(e);
    throw new ImageImportError(`This DICOM file could not be read (${why}).`);
  }
  const get = {
    str: (tag, i) => ds.string(tag, i),
    float: (tag, i) => { const v = ds.floatString(tag, i); return Number.isFinite(v) ? v : undefined; },
  };
  const uid = (ds.string("x00020010") || "1.2.840.10008.1.2").trim();
  const [kind, tsName] = TRANSFER[uid] || ["unknown", uid];
  const rows = ds.uint16("x00280010"), cols = ds.uint16("x00280011");
  const el = ds.elements.x7fe00010;
  if (!el || !rows || !cols) throw new ImageImportError("This DICOM file has no image (it may be a report, structured data or a DICOMDIR).");
  const spp = ds.uint16("x00280002") || 1;
  const bitsAllocated = ds.uint16("x00280100") || 8;
  const bitsStored = ds.uint16("x00280101") || bitsAllocated;
  const highBit = ds.uint16("x00280102");
  const signed = ds.uint16("x00280103") === 1;
  const photometric = (ds.string("x00280004") || (spp === 1 ? "MONOCHROME2" : "RGB")).trim().toUpperCase();
  const planar = ds.uint16("x00280006") === 1;
  const frames = parseInt(ds.string("x00280008") || "1", 10) || 1;
  const notes = [];
  if (frames > 1) notes.push(`The file has ${frames} frames; the first one was opened.`);

  let samples = null, rgba = null, decodedBits = bitsAllocated;
  if (kind === "native" || kind === "native-be") {
    if (bitsAllocated !== 8 && bitsAllocated !== 16) throw new ImageImportError(`${bitsAllocated}-bit pixel data is not supported.`);
    const len = rows * cols * spp * (bitsAllocated / 8);
    if (el.length < len) throw new ImageImportError("The image data in this DICOM file is incomplete.");
    const frame = bytes.slice(el.dataOffset, el.dataOffset + len);
    if (bitsAllocated === 16 && kind === "native-be") {
      for (let i = 0; i < frame.length; i += 2) { const t = frame[i]; frame[i] = frame[i + 1]; frame[i + 1] = t; }
    }
    samples = bitsAllocated === 16 ? new Uint16Array(frame.buffer) : frame;
  } else if (["rle", "jpeg-baseline", "jpeg-extended", "jpeg-lossless", "jpeg-ls", "j2k"].includes(kind)) {
    const frame = encapsulatedFrame(ds, el, frames, kind.startsWith("jpeg-") && kind !== "jpeg-ls");
    if (kind === "rle") {
      samples = decodeRle(frame, rows, cols, spp, bitsAllocated);
    } else if (kind === "jpeg-baseline" || (kind === "jpeg-extended" && bitsStored <= 8)) {
      rgba = (await codecs.decodeJpegBaseline(frame)).rgba;
      if (photometric === "MONOCHROME1") {
        for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 255 - rgba[i]; rgba[i + 1] = 255 - rgba[i + 1]; rgba[i + 2] = 255 - rgba[i + 2]; }
      }
    } else if (kind === "jpeg-extended") {
      throw new ImageImportError("12-bit JPEG Extended compression is not supported. Export the image uncompressed or as JPEG-LS/JPEG 2000.");
    } else {
      const d = kind === "jpeg-lossless" ? await codecs.decodeJpegLossless(frame, bitsAllocated)
        : kind === "jpeg-ls" ? await codecs.decodeJpegLS(frame) : await codecs.decodeJpeg2000(frame);
      if (d.width !== cols || d.height !== rows) throw new ImageImportError("The compressed image size doesn't match the file's header.");
      samples = d.samples;
      decodedBits = d.bits <= 8 ? 8 : 16;
    }
  } else {
    throw new ImageImportError(`This DICOM compression (${tsName}) is not supported. Export the image uncompressed, JPEG-LS or JPEG 2000.`);
  }

  // Lossy Image Compression (0028,2110) when present; otherwise by syntax.
  const lossyAttr = (ds.string("x00282110") || "").trim();
  const source = {
    format: "DICOM",
    transferSyntax: tsName,
    modality: (ds.string("x00080060") || "").trim() || undefined,
    manufacturer: (ds.string("x00080070") || "").trim() || undefined,
    model: (ds.string("x00081090") || "").trim() || undefined,
    bitsStored,
    lossy: lossyAttr ? lossyAttr === "01" : LOSSY.has(kind) || uid.endsWith(".4.81") || uid.endsWith(".4.91"),
  };
  const { calibration, note } = dicomCalibration(get);
  if (note) notes.push(note);

  const gray = spp === 1 && photometric.startsWith("MONOCHROME");
  if (!gray && !rgba && photometric === "PALETTE COLOR") throw new ImageImportError("Palette-colour DICOM images are not supported.");
  if (!gray && !rgba) {
    if (spp !== 3 || !["RGB", "YBR_FULL", "YBR_RCT", "YBR_ICT"].includes(photometric)) {
      throw new ImageImportError(`This DICOM colour format (${photometric}) is not supported.`);
    }
    // JPEG-LS/2000 decoders return RGB; only native YBR_FULL needs converting.
    const ph = kind === "native" || kind === "native-be" || kind === "rle" ? photometric : "RGB";
    rgba = toRgba(samples, rows, cols, spp, ph, planar && (kind === "native" || kind === "native-be"), decodedBits);
  }
  if (rgba) return { format: "DICOM", width: cols, height: rows, gray: null, rgba, calibration, notes, source };

  const pixels = storedValues(samples, Math.min(bitsStored, decodedBits), decodedBits === bitsAllocated ? highBit : undefined, signed && decodedBits > 8);
  const { lo, hi } = valueRange(pixels);
  const windows = [];
  const nWin = ds.numStringValues("x00281050") || 0;
  for (let i = 0; i < nWin; i++) {
    const center = get.float("x00281050", i), width = get.float("x00281051", i);
    const name = (ds.string("x00281055", i) || "").trim() || (nWin > 1 ? `File ${i + 1}` : "File");
    if (Number.isFinite(center) && width > 0) windows.push({ name, center, width });
  }
  const pls = (ds.string("x20500020") || "").trim().toUpperCase();
  const voiFunction = (ds.string("x00281056") || "LINEAR").trim().toUpperCase();
  const meta = {
    width: cols, height: rows,
    dtype: pixels instanceof Int16Array ? "int16" : pixels instanceof Uint16Array ? "uint16" : "uint8",
    bitsStored, smin: lo, smax: hi,
    slope: get.float("x00281053", 0) ?? 1,
    intercept: get.float("x00281052", 0) ?? 0,
    invert: pls ? pls === "INVERSE" : photometric === "MONOCHROME1",
    voiFunction: ["LINEAR", "LINEAR_EXACT", "SIGMOID"].includes(voiFunction) ? voiFunction : "LINEAR",
    windows,
    voiLut: readVoiLut(ds, signed),
  };
  if (!meta.slope) meta.slope = 1;
  return { format: "DICOM", width: cols, height: rows, gray: { pixels, meta }, rgba: null, calibration, notes, source };
}
