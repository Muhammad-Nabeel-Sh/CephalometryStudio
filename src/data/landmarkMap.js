// ═══════════════════════════════════════════════════════════════════════════════
// Landmark vocabularies + mapping onto in-app template labels
//
// Each set's ORDER must match the model's output channel order. `app` is the
// label used by the app's PREDEFINED analyses; `null` means no in-app equivalent
// (dropped during mapping). `mock` is a normalized (x, y) prior used only by the
// demo detector.
//
//  - "isbi19": ISBI 2015 / cwlachap HRNet-W32 (19 landmarks)
//  - "cepha29": CEPHA29 / CephaloHRNet (29 landmarks)
// ═══════════════════════════════════════════════════════════════════════════════

export const ISBI19 = [
  { symbol: "S",    name: "Sella turcica",          app: "S",    mock: [0.420, 0.300] },
  { symbol: "N",    name: "Nasion",                 app: "N",    mock: [0.300, 0.280] },
  { symbol: "Or",   name: "Orbitale",               app: "Or",   mock: [0.260, 0.360] },
  { symbol: "Po",   name: "Porion",                 app: "Po",   mock: [0.500, 0.340] },
  { symbol: "A",    name: "Point A (subspinale)",   app: "A",    mock: [0.270, 0.480] },
  { symbol: "B",    name: "Point B (supramentale)", app: "B",    mock: [0.280, 0.600] },
  { symbol: "Pog",  name: "Pogonion",               app: "Pog",  mock: [0.250, 0.670] },
  { symbol: "Me",   name: "Menton",                 app: "Me",   mock: [0.300, 0.780] },
  { symbol: "Gn",   name: "Gnathion",               app: "Gn",   mock: [0.290, 0.760] },
  { symbol: "Go",   name: "Gonion",                 app: "Go",   mock: [0.460, 0.660] },
  { symbol: "L1",   name: "Lower Incisor Tip",      app: "Ii",   mock: [0.290, 0.660] },
  { symbol: "U1",   name: "Upper Incisor Tip",      app: "Is",   mock: [0.280, 0.580] },
  { symbol: "UL",   name: "Upper Lip",              app: "UL",   mock: [0.200, 0.520] },
  { symbol: "LL",   name: "Lower Lip",              app: "LL",   mock: [0.210, 0.570] },
  { symbol: "Sn",   name: "Subnasale",              app: "Sn",   mock: [0.210, 0.470] },
  { symbol: "Pog'", name: "Soft Tissue Pogonion",   app: "Pog'", mock: [0.220, 0.670] },
  { symbol: "PNS",  name: "Posterior Nasal Spine",  app: "PNS",  mock: [0.440, 0.440] },
  { symbol: "ANS",  name: "Anterior Nasal Spine",   app: "ANS",  mock: [0.280, 0.440] },
  { symbol: "Ar",   name: "Articulare",             app: "Ar",   mock: [0.470, 0.380] },
];

// Order matches CephaloHRNet `data/dataset.py` LANDMARK_SYMBOLS (the ONNX
// output-channel order). Do NOT reorder without retraining + re-exporting.
export const CEPHA29 = [
  { symbol: "A",    name: "A-point",                 app: "A",    mock: [0.270, 0.480] },
  { symbol: "ANS",  name: "Anterior Nasal Spine",    app: "ANS",  mock: [0.280, 0.440] },
  { symbol: "Ar",   name: "Articulare",              app: "Ar",   mock: [0.470, 0.380] },
  { symbol: "B",    name: "B-point",                 app: "B",    mock: [0.280, 0.600] },
  { symbol: "Co",   name: "Condylion",               app: "Co",   mock: [0.470, 0.320] },
  { symbol: "Gn",   name: "Gnathion",                app: "Gn",   mock: [0.290, 0.760] },
  { symbol: "Go",   name: "Gonion",                  app: "Go",   mock: [0.460, 0.660] },
  { symbol: "LIA",  name: "Lower Incisor Apex",      app: "Iia",  mock: [0.330, 0.620] },
  { symbol: "LIT",  name: "Lower Incisor Tip",       app: "Ii",   mock: [0.290, 0.660] },
  { symbol: "LMT",  name: "Lower Molar Cusp Tip",    app: null,   mock: [0.420, 0.630] },
  { symbol: "LPM",  name: "Lower 2nd PM Cusp Tip",   app: null,   mock: [0.380, 0.630] },
  { symbol: "Li",   name: "Labrale inferius",        app: "LL",   mock: [0.210, 0.570] },
  { symbol: "Ls",   name: "Labrale superius",        app: "UL",   mock: [0.200, 0.520] },
  { symbol: "Me",   name: "Menton",                  app: "Me",   mock: [0.300, 0.780] },
  { symbol: "N",    name: "Nasion",                  app: "N",    mock: [0.300, 0.280] },
  { symbol: "N`",   name: "Soft Tissue Nasion",      app: null,   mock: [0.270, 0.290] },
  { symbol: "Or",   name: "Orbitale",                app: "Or",   mock: [0.260, 0.360] },
  { symbol: "PNS",  name: "Posterior Nasal Spine",   app: "PNS",  mock: [0.440, 0.440] },
  { symbol: "Pn",   name: "Pronasale",               app: "Prn",  mock: [0.180, 0.430] },
  { symbol: "Po",   name: "Porion",                  app: "Po",   mock: [0.500, 0.340] },
  { symbol: "Pog",  name: "Pogonion",                app: "Pog",  mock: [0.250, 0.670] },
  { symbol: "Pog`", name: "Soft Tissue Pogonion",    app: "Pog'", mock: [0.220, 0.670] },
  { symbol: "R",    name: "Ramus",                   app: null,   mock: [0.480, 0.520] },
  { symbol: "S",    name: "Sella",                   app: "S",    mock: [0.420, 0.300] },
  { symbol: "Sn",   name: "Subnasale",               app: "Sn",   mock: [0.210, 0.470] },
  { symbol: "UIA",  name: "Upper Incisor Apex",      app: "Ia",   mock: [0.330, 0.520] },
  { symbol: "UIT",  name: "Upper Incisor Tip",       app: "Is",   mock: [0.280, 0.580] },
  { symbol: "UMT",  name: "Upper Molar Cusp Tip",    app: null,   mock: [0.420, 0.550] },
  { symbol: "UPM",  name: "Upper 2nd PM Cusp Tip",   app: null,   mock: [0.380, 0.550] },
];

export const LANDMARK_SETS = { isbi19: ISBI19, cepha29: CEPHA29 };
export const DEFAULT_LANDMARK_SET = "isbi19";

export function getLandmarkSet(key = DEFAULT_LANDMARK_SET) {
  return LANDMARK_SETS[key] || ISBI19;
}

export function landmarkSetSize(key = DEFAULT_LANDMARK_SET) {
  return getLandmarkSet(key).length;
}

export function symbolAt(setKey, index) {
  return getLandmarkSet(setKey)[index]?.symbol ?? null;
}

// App template label for a model symbol, or null when unmapped.
export function appLabelForSymbol(symbol, setKey = DEFAULT_LANDMARK_SET) {
  return getLandmarkSet(setKey).find((l) => l.symbol === symbol)?.app ?? null;
}

// ─── Backwards-compatible CEPHA29 helpers ─────────────────────────────────────
export const NUM_LANDMARKS = CEPHA29.length;
export const CEPHA29_ORDER = CEPHA29.map((l) => l.symbol);
export function cepha29SymbolAt(index) {
  return CEPHA29[index]?.symbol ?? null;
}

// ─── Demo/placeholder detector ────────────────────────────────────────────────
// Deterministic, image-derived fake detections. Used when no ONNX runtime/model
// is configured (development, tests, first-run UX) so the full pipeline works.

function hash32(x) {
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return x >>> 0;
}

export function mockDetections(pixels, width, height, setKey = DEFAULT_LANDMARK_SET) {
  let seed = ((width * 31 + height * 17) >>> 0) || 1;
  if (pixels && pixels.length) {
    const step = Math.max(4, Math.floor(pixels.length / 4096));
    for (let i = 0; i < pixels.length; i += step) seed = (seed + pixels[i]) >>> 0;
  }
  return getLandmarkSet(setKey).map((lm, i) => {
    const jx = ((hash32(seed + i * 2 + 1) % 1000) / 1000 - 0.5) * 0.035;
    const jy = ((hash32(seed + i * 2 + 2) % 1000) / 1000 - 0.5) * 0.035;
    return {
      index: i,
      symbol: lm.symbol,
      x: Math.max(0, Math.min(width - 1, (lm.mock[0] + jx) * width)),
      y: Math.max(0, Math.min(height - 1, (lm.mock[1] + jy) * height)),
      confidence: 0.55 + (hash32(seed + i * 7) % 400) / 1000,
    };
  });
}
