// ═══════════════════════════════════════════════════════════════════════════════
// Cephalometric landmark model — pure preprocessing + heatmap decoding
//
// No DOM/browser globals and no ML-runtime dependency, so the exact same code
// runs on the main thread, inside the detection Web Worker, and in unit tests.
// The runtime (onnxruntime-web) is injected separately — see landmarkDetector.
// ═══════════════════════════════════════════════════════════════════════════════

// Default network input (square). HRNet cephalometric models commonly use 512².
export const MODEL_INPUT_SIZE = 512;

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
// Returns the source dimensions so heatmap peaks map back to raw pixels.
export function preprocessGrayscale(pixels, width, height, size = MODEL_INPUT_SIZE, opts = {}) {
  const { channels = 1, mean = null, std = null } = opts;
  const gray = imageDataToGrayscale(pixels, width, height);
  const plane = resizeBilinearGray(gray, width, height, size, size);
  const tensor = new Float32Array(channels * plane.length);
  for (let c = 0; c < channels; c++) {
    const m = mean?.[c] ?? 0;
    const s = std?.[c] ?? 1;
    const off = c * plane.length;
    for (let i = 0; i < plane.length; i++) tensor[off + i] = (plane[i] - m) / s;
  }
  return { tensor, size, channels, srcWidth: width, srcHeight: height };
}

// ─── Decoding ───────────────────────────────────────────────────────────────

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Decode a channel-major heatmap tensor ([channels × heatHeight × heatWidth])
// into one {index, x, y, confidence} per channel, in ORIGINAL image pixels.
// `dark: true` applies DARK (Gaussian smoothing + Taylor refinement on the
// log-heatmap); otherwise argmax + quadratic sub-pixel refinement.
export function decodeHeatmaps(flat, opts) {
  if (opts.dark) return decodeDark(flat, opts);
  const {
    channels, heatWidth, heatHeight, srcWidth, srcHeight,
    applySigmoid = false,
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
    out.push({
      index: c,
      x: (sx + 0.5) * srcWidth / heatWidth,
      y: (sy + 0.5) * srcHeight / heatHeight,
      confidence: applySigmoid ? sigmoid(best) : Math.max(0, Math.min(1, best)),
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
    sigma = 2, applySigmoid = false,
  } = opts;
  const plane = heatWidth * heatHeight;
  const kernel = gaussianKernel1d(sigma);
  const out = [];
  for (let c = 0; c < channels; c++) {
    const sm = blurChannel(flat, c * plane, heatWidth, heatHeight, kernel);
    for (let i = 0; i < plane; i++) sm[i] = Math.log(Math.max(sm[i], 1e-6));
    let best = -Infinity, bestIdx = 0;
    for (let i = 0; i < plane; i++) {
      if (sm[i] > best) { best = sm[i]; bestIdx = i; }
    }
    const hx = bestIdx % heatWidth, hy = Math.floor(bestIdx / heatWidth);
    let sx = hx, sy = hy;
    if (hx > 0 && hx < heatWidth - 1 && hy > 0 && hy < heatHeight - 1) {
      const at = (x, y) => sm[y * heatWidth + x];
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
    out.push({
      index: c,
      x: (sx + 0.5) * srcWidth / heatWidth,
      y: (sy + 0.5) * srcHeight / heatHeight,
      confidence: applySigmoid ? sigmoid(best) : Math.max(0, Math.min(1, best)),
    });
  }
  return out;
}

// Decode a direct-regression output ([channels × 2]) into {index, x, y}.
export function decodeRegression(flat, opts) {
  const { channels, srcWidth, srcHeight, normalize = false } = opts;
  const out = [];
  for (let c = 0; c < channels; c++) {
    let x = flat[c * 2], y = flat[c * 2 + 1];
    if (normalize) { x *= srcWidth; y *= srcHeight; }
    out.push({ index: c, x, y, confidence: 1 });
  }
  return out;
}
