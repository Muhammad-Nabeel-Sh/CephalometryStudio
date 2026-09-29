// ═══════════════════════════════════════════════════════════════════════════════
// Landmark model manifest
//
// Defaults target the CEPHA29 29-landmark HRNet-W32 (trained with CephaloHRNet on
// the Aariz Cephalometric Dataset, CC BY 4.0). Weights are hosted on Hugging Face
// and fetched (SHA-256 verified, Cache Storage) on first use; the ONNX Runtime
// UMD build is self-hosted and loaded via a <script> tag:
//
//   npm run setup:ort            # copies onnxruntime-web dist -> public/ort/
//
// The ISBI 19-landmark model (MIT, cwlachap) remains available by switching
// `landmarkSet` to "isbi19" and pointing `url`/`sha256`/`version` at it.
//
// If `url` is blank the deterministic demo detector runs instead.
// ═══════════════════════════════════════════════════════════════════════════════

export const LANDMARK_MODEL = {
  // Master switch for the AI auto-trace feature in production. The weights are
  // hosted on Hugging Face and the ORT runtime ships in public/ort/, so this is
  // enabled everywhere; dev also enables it regardless.
  enabled: true,
  version: "cepha29-hrnet-w32-v1",
  landmarkSet: "cepha29",
  inputSize: 768,
  inputChannels: 3,
  normalize: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  decode: { dark: true, sigma: 2 },
  refine: { shape: true, alpha: 0.6, reg: 0.1, k: 6, wmin: 0.2 },
  url: "https://huggingface.co/MuhammadNabeelSh/cephalometry-landmarks/resolve/main/landmarks-cepha29.int8.onnx",
  sha256: "f7f1db9cc2de37c0fa94dab431d7d3446d1d8ffc62fa92e6610c2380af83080d",
  ortUrl: "/ort/ort.wasm.min.js",
  wasmPaths: "/ort/",
};

// CEPHA29 valid set (150 images), training-time metrics: MRE ~1.24 mm, SDR@2 mm
// ~83%, SDR@3 mm ~94%. DARK decoding + SSM refinement (`refine`, prior in
// shapeModel.cepha29.json) improve on this. The INT8 model MUST be static
// QDQ-quantized — dynamic quantization emits ConvInteger, which onnxruntime-web
// does not implement (session create fails → demo fallback). `sha256` is pinned
// so a stale/incompatible cached model is rejected and re-fetched; update it
// whenever you regenerate the model.

export function isModelConfigured(model = LANDMARK_MODEL) {
  return Boolean(model?.url && model?.ortUrl);
}
