// ═══════════════════════════════════════════════════════════════════════════════
// Landmark model manifests
//
// Two models ship:
//   CEPHA19_MODEL — multi-domain HRNet-W32 (Aariz + ISBI 2015), 19 shared landmarks.
//                   ACTIVE by default: measured better cross-domain and in-domain.
//   CEPHA29_MODEL — original Aariz-only 29-landmark HRNet-W32 (HF-hosted).
//
// Weights are SHA-256 verified and cached (storage/modelCache.js). The ONNX
// Runtime UMD build is self-hosted under public/ort/ and loaded via a <script>.
//
// INT8 must be static-QDQ quantized: dynamic quantization emits ConvInteger, which
// onnxruntime-web cannot run (session create fails → demo fallback).
//
// If `url` is blank the deterministic demo detector runs instead.
// ═══════════════════════════════════════════════════════════════════════════════

// Settings shared by both models.
const SHARED = {
  enabled: true,
  inputSize: 768,
  inputChannels: 3,
  normalize: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  decode: { dark: true, sigma: 2, confidenceMode: "psr", psrScale: 6 },
  // Shape-prior refinement is DISABLED by default.
  //
  // Measured on ISBI 2015 (400 images, shared 19 landmarks): applying the Aariz
  // prior cross-domain lowered SDR@2 from 50.6% (raw) to 35.4% (always refined),
  // and a residual-band gate only recovered part of it (44.0%). The prior is
  // still valuable as a *validator* — the shape residual is computed regardless
  // (see landmarkDetector shapeResidual + landmarkQuality) and drives the quality
  // gate and hypothesis ranking.
  //
  // To enable smoothing, set `shape: true` and tune the residual band (the prior
  // only helps inside ~0.1–0.5; it hurts when the raw shape is already close to
  // the mean or far outside it).
  refine: {
    shape: false,
    alpha: 0.6, reg: 0.1, k: 6, wmin: 0.2,
    minResidualRatio: 0.1,
    maxResidualRatio: 0.5,
  },
  // Orientation-specific model: try {identity, mirrored} × {normal, inverted} and
  // keep whichever candidate looks most like a cephalogram. A "high" first pass
  // short-circuits the search.
  robustness: {
    autoOrientation: true,
    autoPolarity: true,
    clahe: "auto", // "auto" only equalizes when local contrast is poor
    contrast: false,
    rankWeights: { residual: 0.35, edge: 0.25 },
  },
  // Quality gate thresholds — override of lib/landmarkQuality defaults. Tune with
  // `python scripts/eval-landmark-model.py --report-ood`.
  quality: null,
  ortUrl: "/ort/ort.wasm.min.js",
  wasmPaths: "/ort/",
};

// Original 29-landmark Aariz-only model (Hugging Face).
export const CEPHA29_MODEL = {
  ...SHARED,
  version: "cepha29-hrnet-w32-v1",
  landmarkSet: "cepha29",
  url: "https://huggingface.co/MuhammadNabeelSh/cephalometry-landmarks/resolve/main/landmarks-cepha29.int8.onnx",
  sha256: "f7f1db9cc2de37c0fa94dab431d7d3446d1d8ffc62fa92e6610c2380af83080d",
};

// Multi-domain 19-landmark model (Aariz + ISBI 2015), fine-tuned from CEPHA29.
//
// Measured (INT8, raw — the app default):
//   external ISBI 2015 test (50 held out): MRE 2.05 mm, median 1.34, SDR@2 64.7%
//     (the 29-landmark baseline was 50.6% on the same task)
//   in-domain Aariz valid (shared 19):      MRE 0.99 mm, median 0.61, SDR@2 91.0%
//
// It cannot output the 10 Aariz-only landmarks (Co, LIA, LMT, LPM, N`, Pn, R,
// UIA, UMT, UPM); analyses that need them queue those points for manual placement.
// Local file: public/models/landmarks-md19.int8.onnx (gitignored). For deployment,
// host it and update `url`.
export const CEPHA19_MODEL = {
  ...SHARED,
  version: "md19-hrnet-w32-v1",
  landmarkSet: "cepha19",
  url: "/models/landmarks-md19.int8.onnx",
  sha256: "aabfddcebdb0aad0f14bc99bba7498fd2a7f9a57135d86180820c91c57ed7315",
};

// The model the app uses. Switch to CEPHA29_MODEL to revert to 29 landmarks.
export const LANDMARK_MODEL = CEPHA19_MODEL;

export function isModelConfigured(model = LANDMARK_MODEL) {
  return Boolean(model?.url && model?.ortUrl);
}
