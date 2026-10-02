// ═══════════════════════════════════════════════════════════════════════════════
// Cephalometric landmark model — pure preprocessing + heatmap decoding
//
// No DOM/browser globals and no ML-runtime dependency, so the exact same code
// runs on the main thread, inside the detection Web Worker, and in unit tests.
// The runtime (onnxruntime-web) is injected separately — see landmarkDetector.
// ═══════════════════════════════════════════════════════════════════════════════

// Default network input (square). HRNet cephalometric models commonly use 512².
export const MODEL_INPUT_SIZE = 512;

// Grayscale standard deviation below which CLAHE is auto-enabled ("clahe: auto").
// A well-exposed lateral ceph sits well above this; washed-out or low-bit-depth
// scans fall below it. Tunable from the model manifest.
export const CLAHE_AUTO_STD = 0.12;

// ─── Plane helpers ──────────────────────────────────────────────────────────

// Standard deviation of a single-channel plane (used as a poor-man's
// local-contrast metric to decide whether contrast normalization is needed).
export function planeStd(plane) {
  const n = plane.length;
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += plane[i];
  const mu = s / n;
  let v = 0;
  for (let i = 0; i < n; i++) { const d = plane[i] - mu; v += d * d; }
  return Math.sqrt(v / n);
}

// Horizontal flip of a single-channel plane.
export function flipGrayHorizontal(plane, width, height) {
  const out = new Float32Array(plane.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) out[row + x] = plane[row + (width - 1 - x)];
  }
  return out;
}

// Polarity flip (a "negative" radiograph back to the trained-on convention).
export function invertGray(plane) {
  const out = new Float32Array(plane.length);
  for (let i = 0; i < plane.length; i++) out[i] = 1 - plane[i];
  return out;
}

// Percentile contrast stretch — rescales [lo, hi] quantiles to [0, 1].
export function contrastStretch(plane, lo = 0.01, hi = 0.99) {
  const BINS = 256;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < plane.length; i++) {
    let b = Math.round(plane[i] * (BINS - 1));
    if (b < 0) b = 0; else if (b > BINS - 1) b = BINS - 1;
    hist[b]++;
  }
  const total = plane.length || 1;
  let acc = 0, loBin = 0, hiBin = BINS - 1;
  for (let b = 0; b < BINS; b++) { acc += hist[b]; if (acc >= lo * total) { loBin = b; break; } }
  acc = 0;
  for (let b = 0; b < BINS; b++) { acc += hist[b]; if (acc >= hi * total) { hiBin = b; break; } }
  const span = Math.max(1, hiBin - loBin);
  const out = new Float32Array(plane.length);
  for (let i = 0; i < plane.length; i++) {
    let v = (plane[i] * (BINS - 1) - loBin) / span;
    if (v < 0) v = 0; else if (v > 1) v = 1;
    out[i] = v;
  }
  return out;
}

// CLAHE (contrast-limited adaptive histogram equalization) with bilinear
// interpolation between per-tile CDF lookup tables. Runs on the resized plane,
// so cost is O(inputSize²) regardless of the source resolution.
//
// `bins` is capped relative to the tile size: with 256 bins on a small tile the
// average bin count drops to ~1, every bin exceeds the clip threshold, the
// redistribution flattens the CDF and the transform silently degenerates to the
// identity. Keeping ≥8 pixels per bin preserves the intended behaviour for any
// tile size.
export function applyCLAHE(plane, width, height, opts = {}) {
  const { tiles = 8, clipLimit = 2, bins: binsOpt = 256 } = opts;
  const tx = Math.max(1, Math.min(tiles, Math.floor(width / 8)));
  const ty = Math.max(1, Math.min(tiles, Math.floor(height / 8)));
  const tileW = Math.ceil(width / tx), tileH = Math.ceil(height / ty);
  const bins = Math.max(16, Math.min(binsOpt, Math.floor((tileW * tileH) / 8)));
  const luts = new Float32Array(tx * ty * bins);
  const clip = Math.max(1, (clipLimit * tileW * tileH) / bins);
  const top = bins - 1;
  for (let j = 0; j < ty; j++) {
    for (let i = 0; i < tx; i++) {
      const hist = new Uint32Array(bins);
      const x0 = i * tileW, x1 = Math.min(width, x0 + tileW);
      const y0 = j * tileH, y1 = Math.min(height, y0 + tileH);
      let n = 0;
      for (let y = y0; y < y1; y++) {
        const row = y * width;
        for (let x = x0; x < x1; x++) {
          let b = Math.round(plane[row + x] * top);
          if (b < 0) b = 0; else if (b > top) b = top;
          hist[b]++;
          n++;
        }
      }
      let excess = 0;
      for (let b = 0; b < bins; b++) {
        if (hist[b] > clip) { excess += hist[b] - clip; hist[b] = clip; }
      }
      // Redistribute the clipped mass across every bin. The remainder must be
      // carried bin-by-bin — plain integer division silently drops the leftover
      // and destroys the CDF (mass no longer sums to the tile size).
      const inc = Math.floor(excess / bins);
      let rem = excess - inc * bins;
      for (let b = 0; b < bins; b++) {
        hist[b] += inc;
        if (rem > 0) { hist[b] += 1; rem -= 1; }
      }
      const base = (j * tx + i) * bins;
      let acc = 0;
      for (let b = 0; b < bins; b++) { acc += hist[b]; luts[base + b] = n > 0 ? acc / n : 0; }
    }
  }
  const out = new Float32Array(plane.length);
  for (let y = 0; y < height; y++) {
    const gy = (y + 0.5) / tileH - 0.5;
    const j0 = Math.max(0, Math.min(ty - 1, Math.floor(gy)));
    const j1 = Math.min(ty - 1, j0 + 1);
    const wy = Math.max(0, Math.min(1, gy - j0));
    for (let x = 0; x < width; x++) {
      const gx = (x + 0.5) / tileW - 0.5;
      const i0 = Math.max(0, Math.min(tx - 1, Math.floor(gx)));
      const i1 = Math.min(tx - 1, i0 + 1);
      const wx = Math.max(0, Math.min(1, gx - i0));
      let b = Math.round(plane[y * width + x] * top);
      if (b < 0) b = 0; else if (b > top) b = top;
      const v00 = luts[(j0 * tx + i0) * bins + b], v10 = luts[(j0 * tx + i1) * bins + b];
      const v01 = luts[(j1 * tx + i0) * bins + b], v11 = luts[(j1 * tx + i1) * bins + b];
      const t = v00 + (v10 - v00) * wx;
      const bt = v01 + (v11 - v01) * wx;
      out[y * width + x] = t + (bt - t) * wy;
    }
  }
  return out;
}

// ─── Preprocessing ──────────────────────────────────────────────────────────

// RGBA (Uint8ClampedArray/Uint8Array) → luminance Float32Array in [0, 1].
export function imageDataToGrayscale(pixels, width, height) {
  const n = width * height;
  const out = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = (0.299 * pixels[j] + 0.587 * pixels[j + 1] + 0.114 * pixels[j + 2]) / 255;
  }
  return out;
}

// Bilinear resize of a single-channel Float32 image.
export function resizeBilinearGray(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh);
  if (sw === dw && sh === dh) {
    out.set(src);
    return out;
  }
  const xr = sw / dw, yr = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * yr - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * xr - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), wx = fx - x0;
      const top = src[y0 * sw + x0] + (src[y0 * sw + x1] - src[y0 * sw + x0]) * wx;
      const bot = src[y1 * sw + x0] + (src[y1 * sw + x1] - src[y1 * sw + x0]) * wx;
      out[y * dw + x] = top + (bot - top) * wy;
    }
  }
  return out;
}

// RGBA → normalized (channels×size×size) tensor. Grayscale is replicated across
// channels when the network expects 3-channel input (common for HRNet backbones).
// Optional per-channel `mean`/`std` (ImageNet-style) are applied after resize.
//
// Robustness options (all default-off so existing behaviour is unchanged):
//   mirror  — horizontal flip before resize (mirrored radiographs)
//   invert  — polarity flip after contrast ops (negative/inverted films)
//   clahe   — true | false | "auto" (auto = only when local contrast is poor)
//   contrast— percentile contrast stretch before CLAHE
//
// `applied` reports which transforms actually ran, so callers can surface them.
export function preprocessGrayscale(pixels, width, height, size = MODEL_INPUT_SIZE, opts = {}) {
  const {
    channels = 1, mean = null, std = null,
    mirror = false, invert = false,
    clahe = false, contrast = false,
    autoContrastStd = CLAHE_AUTO_STD,
  } = opts;
  let gray = imageDataToGrayscale(pixels, width, height);
  if (mirror) gray = flipGrayHorizontal(gray, width, height);
  let plane = resizeBilinearGray(gray, width, height, size, size);
  const applied = { mirror: !!mirror, invert: false, clahe: false, contrast: false };
  if (contrast) {
    plane = contrastStretch(plane);
    applied.contrast = true;
  }
  if (clahe === true || (clahe === "auto" && planeStd(plane) < autoContrastStd)) {
    plane = applyCLAHE(plane, size, size);
    applied.clahe = true;
  }
  if (invert) {
    plane = invertGray(plane);
    applied.invert = true;
  }
  const tensor = new Float32Array(channels * plane.length);
  for (let c = 0; c < channels; c++) {
    const m = mean?.[c] ?? 0;
    const s = std?.[c] ?? 1;
    const off = c * plane.length;
    for (let i = 0; i < plane.length; i++) tensor[off + i] = (plane[i] - m) / s;
  }
  return { tensor, size, channels, srcWidth: width, srcHeight: height, applied };
}

// ─── Decoding ───────────────────────────────────────────────────────────────

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Peak-to-sidelobe ratio: how far the winning response stands out from the rest
// of its own channel plane. Unlike a raw (or log) peak this is scale- and
// offset-invariant and is actually discriminative — a raw log-peak clamps to ~0
// for every diffuse heatmap, which is why the old confidence was inert.
//
// PSR has an intrinsic floor: the maximum of N noisy samples sits ~sqrt(2 ln N)
// standard deviations above the mean even when the plane carries no signal at
// all. We subtract that expectation so a pure-noise plane scores ≈0 and only
// genuine prominence is rewarded, then squash with excess/(excess+scale).
// `floorFactor` < 1 because heatmap planes are spatially smooth, so the number
// of effectively independent samples is well below n.
//
// `scale` sets the half-way point: a peak standing 6σ above its own noise floor
// scores 0.5. Recalibrate with `scripts/eval-landmark-model.py --report-ood`
// when the model changes.
export const PSR_SCALE = 6;
export const PSR_FLOOR_FACTOR = 0.85;

// Expected maximum of n iid *Gaussian* samples (asymptotic extreme-value
// estimate), scaled by floorFactor. Returns 0 for degenerate plane sizes.
//
// Assumption: this is a Gaussian estimate. Heavier-tailed noise (uniform peaks at
// only ~1.7 sd, exponential lower) has a lower z-score than predicted, so the
// subtraction simply over-corrects and such a plane scores ~0 — the safe
// direction for a gate that decides whether to trust a trace.
export function psrNoiseFloor(n, floorFactor = PSR_FLOOR_FACTOR) {
  if (!(n > 7)) return 0;
  const t = Math.sqrt(2 * Math.log(n));
  return floorFactor * (t - (Math.log(Math.log(n)) + Math.log(4 * Math.PI)) / (2 * t));
}

export function psrFromPlane(plane, peakIdx, opts = {}) {
  const { scale = PSR_SCALE, floorFactor = PSR_FLOOR_FACTOR } = opts;
  const n = plane.length;
  const peak = plane[peakIdx];
  if (!n || !Number.isFinite(peak)) return { psr: 0, excess: 0, confidence: 0 };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = plane[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  // A plane with no dynamic range cannot support any confidence.
  if (!(max - min > 1e-9)) return { psr: 0, excess: 0, confidence: 0 };
  let s = 0;
  for (let i = 0; i < n; i++) s += plane[i];
  const mu = s / n;
  let v = 0;
  for (let i = 0; i < n; i++) { const d = plane[i] - mu; v += d * d; }
  const sd = Math.sqrt(v / n) || 1e-6;
  const psr = (peak - mu) / sd;
  const excess = Math.max(0, psr - psrNoiseFloor(n, floorFactor));
  return { psr, excess, confidence: excess / (excess + scale) };
}

// Per-landmark confidence + raw discriminative score from a decoded plane.
function planeConfidence(plane, peakIdx, best, opts) {
  const { confidenceMode = "value", psrScale = PSR_SCALE, applySigmoid = false } = opts;
  if (confidenceMode === "psr") {
    const { psr, confidence } = psrFromPlane(plane, peakIdx, { scale: psrScale });
    return { confidence, score: psr };
  }
  return {
    confidence: applySigmoid ? sigmoid(best) : Math.max(0, Math.min(1, best)),
    score: best,
  };
}

// Decode a channel-major heatmap tensor ([channels × heatHeight × heatWidth])
// into one {index, x, y, confidence} per channel, in ORIGINAL image pixels.
// `dark: true` applies DARK (Gaussian smoothing + Taylor refinement on the
// log-heatmap); otherwise argmax + quadratic sub-pixel refinement.
export function decodeHeatmaps(flat, opts) {
  if (opts.dark) return decodeDark(flat, opts);
  const {
    channels, heatWidth, heatHeight, srcWidth, srcHeight,
  } = opts;
  const out = [];
  const plane = heatWidth * heatHeight;
  for (let c = 0; c < channels; c++) {
    const base = c * plane;
    let best = -Infinity, bestIdx = 0;
    for (let i = 0; i < plane; i++) {
      const v = flat[base + i];
      if (v > best) { best = v; bestIdx = i; }
    }
    const hx = bestIdx % heatWidth, hy = Math.floor(bestIdx / heatWidth);
    let sx = hx, sy = hy;
    if (hx > 0 && hx < heatWidth - 1) {
      const l = flat[base + hy * heatWidth + hx - 1];
      const r = flat[base + hy * heatWidth + hx + 1];
      const den = l - 2 * best + r;
      if (den !== 0) sx = hx + 0.5 * (l - r) / den;
    }
    if (hy > 0 && hy < heatHeight - 1) {
      const u = flat[base + (hy - 1) * heatWidth + hx];
      const d = flat[base + (hy + 1) * heatWidth + hx];
      const den = u - 2 * best + d;
      if (den !== 0) sy = hy + 0.5 * (u - d) / den;
    }
    sx = Math.max(0, Math.min(heatWidth - 1, sx));
    sy = Math.max(0, Math.min(heatHeight - 1, sy));
    const { confidence, score } = planeConfidence(flat.subarray(base, base + plane), bestIdx, best, opts);
    out.push({
      index: c,
      x: (sx + 0.5) * srcWidth / heatWidth,
      y: (sy + 0.5) * srcHeight / heatHeight,
      confidence,
      score,
    });
  }
  return out;
}

// ─── DARK decoding (Zhang et al., CVPR 2020) ──────────────────────────────────

function gaussianKernel1d(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return { k, radius };
}

function blurChannel(src, off, w, h, kernel) {
  const { k, radius } = kernel;
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++) {
        let xx = x + i;
        if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1;
        s += src[off + row + xx] * k[i + radius];
      }
      tmp[row + x] = s;
    }
  }
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++) {
        let yy = y + i;
        if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        s += tmp[yy * w + x] * k[i + radius];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

function decodeDark(flat, opts) {
  const {
    channels, heatWidth, heatHeight, srcWidth, srcHeight,
    sigma = 2,
  } = opts;
  const plane = heatWidth * heatHeight;
  const kernel = gaussianKernel1d(sigma);
  const out = [];
  for (let c = 0; c < channels; c++) {
    const sm = blurChannel(flat, c * plane, heatWidth, heatHeight, kernel);
    // DARK peaks on the log-response plane…
    const lg = new Float32Array(plane);
    for (let i = 0; i < plane; i++) lg[i] = Math.log(Math.max(sm[i], 1e-6));
    let best = -Infinity, bestIdx = 0;
    for (let i = 0; i < plane; i++) {
      if (lg[i] > best) { best = lg[i]; bestIdx = i; }
    }
    const hx = bestIdx % heatWidth, hy = Math.floor(bestIdx / heatWidth);
    let sx = hx, sy = hy;
    if (hx > 0 && hx < heatWidth - 1 && hy > 0 && hy < heatHeight - 1) {
      const at = (x, y) => lg[y * heatWidth + x];
      const dx = 0.5 * (at(hx + 1, hy) - at(hx - 1, hy));
      const dy = 0.5 * (at(hx, hy + 1) - at(hx, hy - 1));
      const dxx = at(hx + 1, hy) - 2 * best + at(hx - 1, hy);
      const dyy = at(hx, hy + 1) - 2 * best + at(hx, hy - 1);
      const dxy = 0.25 * (at(hx + 1, hy + 1) - at(hx + 1, hy - 1) - at(hx - 1, hy + 1) + at(hx - 1, hy - 1));
      const det = dxx * dyy - dxy * dxy;
      if (Math.abs(det) > 1e-9) {
        const ox = -(dyy * dx - dxy * dy) / det;
        const oy = -(-dxy * dx + dxx * dy) / det;
        if (Math.abs(ox) < 1 && Math.abs(oy) < 1) { sx = hx + ox; sy = hy + oy; }
      }
    }
    sx = Math.max(0, Math.min(heatWidth - 1, sx));
    sy = Math.max(0, Math.min(heatHeight - 1, sy));
    // …but the PSR confidence is measured on the LINEAR smoothed response,
    // which is the standard definition and avoids the 1e-6 log floor
    // dominating the mean/sd of a near-empty plane.
    const { confidence, score } = planeConfidence(sm, bestIdx, best, opts);
    out.push({
      index: c,
      x: (sx + 0.5) * srcWidth / heatWidth,
      y: (sy + 0.5) * srcHeight / heatHeight,
      confidence,
      score,
    });
  }
  return out;
}

// Decode a direct-regression output ([channels × 2]) into {index, x, y}.
export function decodeRegression(flat, opts) {
  const { channels, srcWidth, srcHeight, normalize = false, confidence = 1 } = opts;
  const out = [];
  for (let c = 0; c < channels; c++) {
    let x = flat[c * 2], y = flat[c * 2 + 1];
    if (normalize) { x *= srcWidth; y *= srcHeight; }
    out.push({ index: c, x, y, confidence, score: 1 });
  }
  return out;
}
