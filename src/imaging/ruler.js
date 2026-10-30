// ─── Semi-automatic ruler calibration (Phase 2, item 15) ─────────────────────
//
// The user draws a line along a radiographic ruler's tick marks. The image is
// sampled along that line (averaged across a narrow band), slow brightness
// changes are removed, and the tick period is the strongest repeat in the
// autocorrelation — refined over many ticks (harmonics) to sub-pixel accuracy.
// px/mm = period ÷ tick spacing (usually 1 mm). No learned model: public
// labelled ruler data barely exists.

// Luminance of RGBA ImageData at (x, y), bilinear; NaN outside.
function lum(img, x, y) {
  const { width: w, height: h, data } = img;
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return NaN;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0, fy = y - y0;
  const at = (xx, yy) => { const i = (yy * w + xx) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
}

// Intensity along p0→p1 at 1 px steps, averaged over ±halfWidth px across.
export function sampleProfile(img, p0, p1, halfWidth = 3) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy);
  const n = Math.floor(len);
  if (n < 2) return new Float64Array(0);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -halfWidth; k <= halfWidth; k++) {
      const v = lum(img, p0.x + ux * i + nx * k, p0.y + uy * i + ny * k);
      if (!Number.isNaN(v)) { s += v; c++; }
    }
    out[i] = c ? s / c : 0;
  }
  return out;
}

// Signal minus its moving average (window `win`), so only the ticks remain.
function detrend(x, win) {
  const n = x.length, half = Math.max(1, Math.floor(win / 2));
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + x[i];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half), b = Math.min(n, i + half + 1);
    out[i] = x[i] - (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

function autocorrelation(x, maxLag) {
  const n = x.length, ac = new Float64Array(maxLag + 1);
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += x[i] * x[i];
  if (!e0) return ac;
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    ac[lag] = (s / (n - lag)) / (e0 / n);
  }
  return ac;
}

// Sub-sample peak position around integer index i.
function refine(ac, i) {
  if (i <= 0 || i >= ac.length - 1) return i;
  const a = ac[i - 1], b = ac[i], c = ac[i + 1], d = a - 2 * b + c;
  return d < 0 ? i + 0.5 * (a - c) / d : i;
}

// → { period, ticks, confidence } or { error }.
// `minPeriod`/`maxPeriod` in pixels bound the tick spacing searched for.
export function tickPeriod(profile, { minPeriod = 2.5, maxPeriod = 80 } = {}) {
  const n = profile.length;
  if (n < minPeriod * 8) return { error: "The line is too short: draw it along at least 8 tick marks." };
  const x = detrend(profile, Math.min(n, Math.max(16, maxPeriod * 1.5)));
  const maxLag = Math.min(n - 2, Math.floor(n * 0.6));
  const ac = autocorrelation(x, maxLag);
  const lo = Math.max(2, Math.ceil(minPeriod)), hi = Math.min(maxLag - 1, Math.floor(maxPeriod));
  const peaks = [];
  for (let i = lo; i <= hi; i++) if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1] && ac[i] > 0) peaks.push(i);
  if (!peaks.length) return { error: "No regular tick pattern was found along the line." };
  const best = Math.max(...peaks.map(i => ac[i]));
  // The shortest strong repeat: longer ones (every 5 or 10 mm) are multiples.
  const first = peaks.find(i => ac[i] >= 0.8 * best);
  const p0 = refine(ac, first);
  // Refine with the k-th repeats: period = Σ k·Lk / Σ k².
  let num = p0, den = 1;
  for (let k = 2; k * p0 + p0 / 3 < maxLag; k++) {
    const a = Math.max(1, Math.round(k * p0 - p0 / 3)), b = Math.min(maxLag - 1, Math.round(k * p0 + p0 / 3));
    let m = a;
    for (let i = a; i <= b; i++) if (ac[i] > ac[m]) m = i;
    if (ac[m] < 0.25 * ac[first]) break; // pattern lost (end of the ruler)
    num += k * refine(ac, m);
    den += k * k;
  }
  const period = num / den;
  const ticks = Math.floor(n / period);
  const confidence = Math.max(0, Math.min(1, ac[first]));
  if (ticks < 8) return { error: "Too few ticks along the line: draw it along at least 8 tick marks." };
  if (confidence < 0.2) return { error: "The tick pattern is too faint or irregular to measure reliably." };
  return { period, ticks, confidence };
}

// Calibration from a line drawn along a ruler with ticks `tickMm` apart.
export function detectRulerScale(img, p0, p1, tickMm = 1) {
  if (!img) return { error: "The image pixels aren't available (rotated or scaled image layers can't be measured)." };
  const r = tickPeriod(sampleProfile(img, p0, p1));
  if (r.error) return r;
  return { ...r, pxPerMm: r.period / tickMm, tickMm };
}
