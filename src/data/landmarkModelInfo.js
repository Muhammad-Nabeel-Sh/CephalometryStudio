// ═══════════════════════════════════════════════════════════════════════════════
// Landmark model manifest
//
// Defaults target the MIT-licensed 19-landmark HRNet-W32 (cwlachap / ISBI 2015).
// The ONNX Runtime UMD build is self-hosted and loaded via a <script> tag:
//
//   npm run setup:ort            # copies onnxruntime-web dist -> public/ort/
//
// Then convert the checkpoint and drop it in place (no source edit needed):
//
//   python scripts/convert-hrnet19-onnx.py --quantize
//   copy landmarks-hrnet19.onnx public\models\
//
// To host the weights elsewhere (GitHub Release / CDN) override `url` + `sha256`.
// To load the runtime/wasm from a CDN instead of self-hosting, set `ortUrl` and
// `wasmPaths` to the matching onnxruntime-web dist URLs, e.g.
//   ortUrl:    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js"
//   wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/"
//
// If `url` is blank the deterministic demo detector runs instead.
//
// For CEPHA29 (29 landmarks): run scripts/export-landmark-onnx.py and switch
// `landmarkSet` to "cepha29" with the matching input size/channels.
// ═══════════════════════════════════════════════════════════════════════════════

export const LANDMARK_MODEL = {
  // Master switch for the AI auto-trace feature in production. The deployed
  // site has no ONNX runtime/model assets yet (Phase 2), so this stays false
  // until the model is hosted and the CSP allows wasm. Dev always enables it.
  enabled: false,
  version: "isbi19-hrnet-w32-v1",
  landmarkSet: "isbi19",
  inputSize: 768,
  inputChannels: 3,
  normalize: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  decode: { dark: true, sigma: 2 },
  refine: { shape: true, alpha: 0.6, reg: 0.1, k: 6, wmin: 0.2 },
  url: "/models/landmarks-hrnet19.int8.onnx",
  sha256: "284f07214ee5c126a29dc3933488df59ef7bea57b22639180118223da897ccec",
  ortUrl: "/ort/ort.min.js",
  wasmPaths: "/ort/",
};

// Measured on 20 ISBI test images (scripts/eval-landmark-model.py):
//   argmax ~3.1 mm / 33% SDR@2  →  DARK ~2.6 mm / 41%  →  +SSM shape prior
//   ~2.27 mm / ~52% SDR@2. DARK decoding + SSM refinement (`refine`) are the
//   accuracy wins; FP32 gives the same MRE as INT8. TTA and CLAHE did not help.
// The INT8 model MUST be static QDQ-quantized — dynamic quantization emits
// ConvInteger, which onnxruntime-web does not implement (session create fails →
// demo fallback). `sha256` is pinned so a stale/incompatible cached model is
// rejected and re-fetched; update it whenever you regenerate the model.
// For maximum size tolerance use "/models/landmarks-hrnet19.onnx" (109 MB FP32,
// same ~2.6 mm); INT8 (28 MB) is the default.

export function isModelConfigured(model = LANDMARK_MODEL) {
  return Boolean(model?.url && model?.ortUrl);
}

