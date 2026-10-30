// ═════════════════════════════════════════════════════════════════
// Minimal DICOM / TIFF writers for import tests.
//   writeDicom({ ts, elements, pixels, fragments })
//     elements: [[tag, vr, value]], tag as "gggg,eeee"
//     pixels:   Uint8Array/Uint16Array → native Pixel Data
//     fragments: [Uint8Array] → encapsulated Pixel Data (compressed)
// Explicit VR little endian by default; implicit VR and explicit big
// endian are supported for the dataset (the file meta is always
// explicit little endian, as the standard requires).
// ═════════════════════════════════════════════════════════════════

export const TS = {
  implicit: "1.2.840.10008.1.2",
  explicit: "1.2.840.10008.1.2.1",
  bigEndian: "1.2.840.10008.1.2.2",
  rle: "1.2.840.10008.1.2.5",
  jpegLossless: "1.2.840.10008.1.2.4.70",
  jpegLS: "1.2.840.10008.1.2.4.80",
  j2k: "1.2.840.10008.1.2.4.90",
  deflate: "1.2.840.10008.1.2.1.99",
};

const LONG_VRS = new Set(["OB", "OW", "OF", "SQ", "UT", "UN"]);

function strBytes(s, vr) {
  let str = String(s);
  if (str.length % 2) str += vr === "UI" ? "\0" : " ";
  return new TextEncoder().encode(str);
}

function valueBytes(vr, value, le) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof Uint16Array) {
    const out = new Uint8Array(value.length * 2), dv = new DataView(out.buffer);
    value.forEach((v, i) => dv.setUint16(i * 2, v, le));
    return out;
  }
  const arr = Array.isArray(value) ? value : [value];
  if (vr === "US" || vr === "SS") {
    const out = new Uint8Array(arr.length * 2), dv = new DataView(out.buffer);
    arr.forEach((v, i) => (vr === "US" ? dv.setUint16(i * 2, v, le) : dv.setInt16(i * 2, v, le)));
    return out;
  }
  if (vr === "UL") {
    const out = new Uint8Array(arr.length * 4), dv = new DataView(out.buffer);
    arr.forEach((v, i) => dv.setUint32(i * 4, v, le));
    return out;
  }
  return strBytes(arr.join("\\"), vr);
}

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function header(group, elem, vr, length, { explicit, le }) {
  const long = LONG_VRS.has(vr);
  const out = new Uint8Array(explicit ? (long ? 12 : 8) : 8), dv = new DataView(out.buffer);
  dv.setUint16(0, group, le);
  dv.setUint16(2, elem, le);
  if (!explicit) { dv.setUint32(4, length, le); return out; }
  out[4] = vr.charCodeAt(0); out[5] = vr.charCodeAt(1);
  if (long) dv.setUint32(8, length, le);
  else dv.setUint16(6, length, le);
  return out;
}

function element(tag, vr, value, mode) {
  const [g, e] = tag.split(",").map(h => parseInt(h, 16));
  if (vr === "SQ") {
    // value: array of item element lists; defined lengths throughout
    const items = value.map(list => {
      const body = concat(list.map(([t, v, x]) => element(t, v, x, mode)));
      const it = new Uint8Array(8), dv = new DataView(it.buffer);
      dv.setUint16(0, 0xfffe, mode.le); dv.setUint16(2, 0xe000, mode.le); dv.setUint32(4, body.length, mode.le);
      return concat([it, body]);
    });
    const body = concat(items);
    return concat([header(g, e, vr, body.length, mode), body]);
  }
  const bytes = valueBytes(vr, value, mode.le);
  return concat([header(g, e, vr, bytes.length, mode), bytes]);
}

function item(bytes, le) {
  const h = new Uint8Array(8), dv = new DataView(h.buffer);
  dv.setUint16(0, 0xfffe, le); dv.setUint16(2, 0xe000, le); dv.setUint32(4, bytes.length, le);
  return concat([h, bytes]);
}

export function writeDicom({ ts = TS.explicit, elements = [], pixels = null, fragments = null, preamble = true }) {
  const meta = { explicit: true, le: true };
  const mode = { explicit: ts !== TS.implicit, le: ts !== TS.bigEndian };
  const metaBody = concat([
    element("0002,0001", "OB", new Uint8Array([0, 1]), meta),
    element("0002,0002", "UI", "1.2.840.10008.5.1.4.1.1.1.1", meta),
    element("0002,0003", "UI", "1.2.3.4.5.6.7", meta),
    element("0002,0010", "UI", ts, meta),
    element("0002,0012", "UI", "1.2.3.4", meta),
  ]);
  const groupLength = element("0002,0000", "UL", metaBody.length, meta);
  const sorted = [...elements].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const body = sorted.map(([t, vr, v]) => element(t, vr, v, mode));
  let pixel = new Uint8Array(0);
  if (pixels) {
    const bytes = valueBytes("OW", pixels, mode.le);
    pixel = concat([header(0x7fe0, 0x0010, pixels instanceof Uint16Array ? "OW" : "OB", bytes.length, mode), bytes]);
  } else if (fragments) {
    const h = header(0x7fe0, 0x0010, "OB", 0xffffffff, mode);
    const end = new Uint8Array(8), dv = new DataView(end.buffer);
    dv.setUint16(0, 0xfffe, mode.le); dv.setUint16(2, 0xe0dd, mode.le);
    pixel = concat([h, item(new Uint8Array(0), mode.le), ...fragments.map(f => item(f.length % 2 ? concat([f, new Uint8Array(1)]) : f, mode.le)), end]);
  }
  const pre = preamble ? concat([new Uint8Array(128), new TextEncoder().encode("DICM")]) : new Uint8Array(0);
  const out = concat([pre, ...(preamble ? [groupLength, metaBody] : []), ...body, pixel]);
  return out.buffer;
}

// Image attributes for a grayscale image of the given size and depth.
export function grayElements({ rows, cols, bitsAllocated = 16, bitsStored = 12, signed = false, photometric = "MONOCHROME2", extra = [] }) {
  return [
    ["0028,0002", "US", 1],
    ["0028,0004", "CS", photometric],
    ["0028,0010", "US", rows],
    ["0028,0011", "US", cols],
    ["0028,0100", "US", bitsAllocated],
    ["0028,0101", "US", bitsStored],
    ["0028,0102", "US", bitsStored - 1],
    ["0028,0103", "US", signed ? 1 : 0],
    ["0008,0060", "CS", "DX"],
    ["0008,0070", "LO", "Test Vendor"],
    ...extra,
  ];
}

// PackBits encoder (literal runs only — valid, if not compact).
export function packBits(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 128) {
    const run = bytes.subarray(i, Math.min(i + 128, bytes.length));
    out.push(run.length - 1, ...run);
  }
  return Uint8Array.from(out);
}

// RLE Lossless frame for 16-bit grayscale (two byte planes, MSB first).
export function rleFrame16(pixels) {
  const hi = new Uint8Array(pixels.length), lo = new Uint8Array(pixels.length);
  pixels.forEach((v, i) => { hi[i] = v >> 8; lo[i] = v & 255; });
  const s1 = packBits(hi), s2 = packBits(lo);
  const head = new Uint8Array(64), dv = new DataView(head.buffer);
  dv.setUint32(0, 2, true);
  dv.setUint32(4, 64, true);
  dv.setUint32(8, 64 + s1.length, true);
  return concat([head, s1, s2]);
}

// Baseline uncompressed TIFF (one strip). samples: Uint16Array (gray 16) or Uint8Array (RGB 8).
export function writeTiff({ width, height, samples, bits = 16, spp = 1, photometric = 1 }) {
  const dataLen = samples.byteLength;
  const entries = [
    [256, 3, 1, width], [257, 3, 1, height], [258, 3, spp, bits], [259, 3, 1, 1],
    [262, 3, 1, photometric], [273, 4, 1, 0 /* patched */], [277, 3, 1, spp],
    [278, 3, 1, height], [279, 4, 1, dataLen],
  ];
  const ifdOff = 8, ifdLen = 2 + entries.length * 12 + 4;
  const bpsOff = ifdOff + ifdLen;                 // BitsPerSample array when spp > 1
  const dataOff = bpsOff + (spp > 1 ? spp * 2 : 0);
  const buf = new ArrayBuffer(dataOff + dataLen), dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8.set([0x49, 0x49, 42, 0]);
  dv.setUint32(4, ifdOff, true);
  dv.setUint16(ifdOff, entries.length, true);
  entries.forEach(([tag, type, count, value], i) => {
    const o = ifdOff + 2 + i * 12;
    dv.setUint16(o, tag, true); dv.setUint16(o + 2, type, true); dv.setUint32(o + 4, count, true);
    if (tag === 273) dv.setUint32(o + 8, dataOff, true);
    else if (tag === 258 && spp > 1) dv.setUint32(o + 8, bpsOff, true);
    else if (type === 3) dv.setUint16(o + 8, value, true);
    else dv.setUint32(o + 8, value, true);
  });
  if (spp > 1) for (let i = 0; i < spp; i++) dv.setUint16(bpsOff + i * 2, bits, true);
  const src = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  if (bits === 16) {
    for (let i = 0; i < samples.length; i++) dv.setUint16(dataOff + i * 2, samples[i], true);
  } else u8.set(src, dataOff);
  return buf;
}
