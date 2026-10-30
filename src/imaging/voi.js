// ─── Grayscale display for 12–16-bit images (DICOM PS3.3 C.11) ───────────────
//
// A high-bit-depth radiograph is kept as its stored values plus a small `meta`
// object; what the app shows (and the AI, report and export use) is an 8-bit
// rendering made through these steps:
//   stored value → modality LUT (rescale slope/intercept)
//                → VOI (a window centre/width, or the file's explicit VOI LUT)
//                → presentation (MONOCHROME1 / INVERSE shown inverted)
// Everything here is pure and works on typed arrays, so it runs the same in
// the browser and in tests.
//
// meta = {
//   width, height, dtype: "uint8"|"uint16"|"int16", bitsStored,
//   smin, smax,                 stored-value range present in the image
//   slope, intercept,           modality LUT
//   invert,                     show inverted
//   voiFunction,                "LINEAR" | "LINEAR_EXACT" | "SIGMOID"
//   windows: [{ name, center, width }],   presets from the file (modality units)
//   voiLut: { first, data } | null,       explicit VOI LUT from the file
// }

export const toModality = (meta, s) => s * (meta.slope ?? 1) + (meta.intercept ?? 0);

// Range of modality values present → { min, max }.
export function modalityRange(meta) {
  const a = toModality(meta, meta.smin), b = toModality(meta, meta.smax);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// Min and max of a typed array.
export function valueRange(pixels) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return pixels.length ? { lo, hi } : { lo: 0, hi: 0 };
}

// DICOM VOI functions, output 0..1 for modality value x.
function voiValue(fn, x, c, w) {
  if (fn === "SIGMOID") return 1 / (1 + Math.exp((-4 * (x - c)) / Math.max(w, 1e-6)));
  if (fn === "LINEAR_EXACT") {
    if (x <= c - w / 2) return 0;
    if (x > c + w / 2) return 1;
    return (x - c) / w + 0.5;
  }
  const ww = Math.max(w, 1);
  if (x <= c - 0.5 - (ww - 1) / 2) return 0;
  if (x > c - 0.5 + (ww - 1) / 2) return 1;
  return (x - (c - 0.5)) / Math.max(ww - 1, 1e-6) + 0.5;
}

// Stored value → 8-bit display value, as a table indexed by (stored − smin).
// `choice` is { center, width } for a window, or { lut: true } for the file's
// explicit VOI LUT.
export function buildLut(meta, choice) {
  const n = meta.smax - meta.smin + 1;
  const lut = new Uint8Array(Math.max(n, 1));
  const inv = !!meta.invert;
  const fromLut = choice?.lut && meta.voiLut?.data?.length;
  let lutMax = 1;
  if (fromLut) for (const v of meta.voiLut.data) if (v > lutMax) lutMax = v;
  for (let i = 0; i < n; i++) {
    const m = toModality(meta, meta.smin + i);
    let y;
    if (fromLut) {
      const d = meta.voiLut.data;
      const k = Math.min(d.length - 1, Math.max(0, Math.round(m) - meta.voiLut.first));
      y = d[k] / lutMax;
    } else {
      y = voiValue(meta.voiFunction, m, choice.center, choice.width);
    }
    const v = Math.round(Math.min(1, Math.max(0, y)) * 255);
    lut[i] = inv ? 255 - v : v;
  }
  return lut;
}

// 8-bit RGBA rendering of the stored values through `lut`.
export function renderGray(pixels, meta, lut, out) {
  const n = meta.width * meta.height;
  const rgba = out && out.length === n * 4 ? out : new Uint8ClampedArray(n * 4);
  const off = meta.smin, last = lut.length - 1;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let k = pixels[i] - off;
    if (k < 0) k = 0; else if (k > last) k = last;
    const v = lut[k];
    rgba[j] = v; rgba[j + 1] = v; rgba[j + 2] = v; rgba[j + 3] = 255;
  }
  return rgba;
}

// A window that spans the bulk of the image: the 0.5th–99.5th percentile of
// the stored values (outliers such as collimator edges and burned-in text don't
// stretch it). In modality units.
export function autoWindow(pixels, meta, lowQ = 0.005, highQ = 0.995) {
  const n = meta.smax - meta.smin + 1;
  const hist = new Uint32Array(Math.max(n, 1));
  for (let i = 0; i < pixels.length; i++) {
    const k = pixels[i] - meta.smin;
    if (k >= 0 && k < n) hist[k]++;
  }
  const total = pixels.length || 1;
  let acc = 0, lo = 0, hi = n - 1;
  for (let i = 0; i < n; i++) { acc += hist[i]; if (acc >= total * lowQ) { lo = i; break; } }
  acc = 0;
  for (let i = n - 1; i >= 0; i--) { acc += hist[i]; if (acc >= total * (1 - highQ)) { hi = i; break; } }
  if (hi <= lo) { lo = 0; hi = n - 1; }
  const a = toModality(meta, meta.smin + lo), b = toModality(meta, meta.smin + hi);
  const min = Math.min(a, b), max = Math.max(a, b);
  return { name: "Auto", center: (min + max) / 2, width: Math.max(max - min, 1) };
}

export function fullRangeWindow(meta) {
  const { min, max } = modalityRange(meta);
  return { name: "Full range", center: (min + max) / 2, width: Math.max(max - min, 1) };
}

// The rendering the file asks for: its explicit VOI LUT, else its first
// window, else the automatic window.
export function defaultChoice(pixels, meta) {
  if (meta.voiLut?.data?.length) return { name: "File LUT", lut: true };
  if (meta.windows?.length) return { ...meta.windows[0] };
  return autoWindow(pixels, meta);
}

// Every window offered in the UI: the file's own, then Auto and Full range.
export function windowPresets(pixels, meta) {
  const out = [];
  if (meta.voiLut?.data?.length) out.push({ name: "File LUT", lut: true });
  (meta.windows || []).forEach((w) => out.push({ ...w }));
  out.push(autoWindow(pixels, meta), fullRangeWindow(meta));
  return out;
}
