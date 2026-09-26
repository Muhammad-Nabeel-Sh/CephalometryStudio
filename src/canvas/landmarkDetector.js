// ═══════════════════════════════════════════════════════════════════════════════
// Landmark detector — loads the self-hosted ONNX Runtime UMD build via a <script>
// tag and runs inference on the main thread.
//
// Public/ files can only be referenced via HTML tags (not module imports), so
// the runtime is injected as a classic script and exposed on `window.ort`. The
// model itself is fetched (and cached) by storage/modelCache. When the runtime
// or model is unavailable the deterministic demo detector is used instead.
// ═══════════════════════════════════════════════════════════════════════════════

import { preprocessGrayscale, decodeHeatmaps, decodeRegression, MODEL_INPUT_SIZE } from "../lib/landmarkModel.js";
import { mockDetections, symbolAt, getLandmarkSet, DEFAULT_LANDMARK_SET } from "../data/landmarkMap.js";
import { refineShape } from "../lib/shapeModel.js";

let _ort = null;
let _session = null;
let _backend = "mock";
let _debug = null;
let _landmarkSet = DEFAULT_LANDMARK_SET;
let _inputSize = MODEL_INPUT_SIZE;
let _channels = 1;
let _mean = null;
let _std = null;
let _decode = { dark: false, sigma: 2 };
let _refine = null;
let _ortPromise = null;

export function getDetectorBackend() {
  return _backend;
}

export function getDetectorDebug() {
  return _debug;
}

// Inject the ORT UMD build as a classic script (sets window.ort). Cached.
function loadOrt(url) {
  if (typeof document === "undefined") return Promise.resolve(null);
  if (typeof window !== "undefined" && window.ort?.InferenceSession) return Promise.resolve(window.ort);
  if (!url) return Promise.resolve(null);
  if (_ortPromise) return _ortPromise;
  _ortPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve(window.ort?.InferenceSession ? window.ort : null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return _ortPromise;
}

export async function initDetector(opts = {}) {
  if (opts.landmarkSet) _landmarkSet = opts.landmarkSet;
  _inputSize = opts.inputSize || MODEL_INPUT_SIZE;
  _channels = opts.inputChannels || 1;
  _mean = opts.normalize?.mean || null;
  _std = opts.normalize?.std || null;
  if (opts.decode) _decode = opts.decode;
  if (opts.refine) _refine = opts.refine;

  const ort = await loadOrt(opts.ortUrl);
  if (!ort || (!opts.modelBuffer && !opts.modelUrl)) {
    _backend = "mock";
    _debug = ort ? null : "onnxruntime-web not loaded";
    return "mock";
  }
  try {
    if (opts.wasmPaths && ort.env?.wasm) ort.env.wasm.wasmPaths = opts.wasmPaths;
    if (ort.env?.wasm) {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
    }
    _session = await ort.InferenceSession.create(opts.modelBuffer || opts.modelUrl, {
      executionProviders: ["wasm"],
    });
    _ort = ort;
    _backend = "onnx";
    _debug = null;
    return "onnx";
  } catch (e) {
    _session = null;
    _backend = "mock";
    _debug = "session: " + String(e && e.message ? e.message : e);
    return "mock";
  }
}

function readPixels(input) {
  if (!input) return null;
  if (input.pixels && input.width && input.height) {
    return { pixels: input.pixels, width: input.width, height: input.height };
  }
  const width = input.naturalWidth || input.width;
  const height = input.naturalHeight || input.height;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(input, 0, 0);
  return { pixels: ctx.getImageData(0, 0, width, height).data, width, height };
}

// `input` is an HTMLImageElement/canvas or a { pixels, width, height } object.
export async function detectLandmarks(input, opts = {}) {
  const frame = readPixels(input);
  if (!frame) throw new Error("No image to trace");
  const { pixels, width, height } = frame;
  const setKey = opts.landmarkSet || _landmarkSet;

  if (_backend !== "onnx" || !_ort || !_session) {
    return { landmarks: mockDetections(pixels, width, height, setKey), backend: "mock" };
  }

  const { tensor, size, channels } = preprocessGrayscale(pixels, width, height, _inputSize, {
    channels: _channels, mean: _mean, std: _std,
  });
  const t = new _ort.Tensor("float32", tensor, [1, channels, size, size]);
  const results = await _session.run({ [_session.inputNames[0]]: t });
  const out = results[_session.outputNames[0]];
  const dims = out.dims;
  const expected = getLandmarkSet(setKey).length;
  let decoded;
  if (dims.length === 4) {
    if (dims[1] !== expected) throw new Error(`Model has ${dims[1]} outputs, expected ${expected}`);
    decoded = decodeHeatmaps(out.data, {
      channels: dims[1], heatHeight: dims[2], heatWidth: dims[3], srcWidth: width, srcHeight: height,
      dark: _decode.dark, sigma: _decode.sigma,
    });
  } else if (dims.length === 3 && dims[2] === 2) {
    if (dims[1] !== expected) throw new Error(`Model has ${dims[1]} outputs, expected ${expected}`);
    decoded = decodeRegression(out.data, { channels: dims[1], srcWidth: width, srcHeight: height });
  } else {
    throw new Error("Unsupported model output shape");
  }
  const landmarks = decoded.map(d => ({
    index: d.index, symbol: symbolAt(setKey, d.index) ?? `L${d.index}`, x: d.x, y: d.y, confidence: d.confidence,
  }));

  // Statistical shape-model refinement (ISBI-19 only, all landmarks present).
  if (_refine?.shape && setKey === "isbi19" && landmarks.length === 19) {
    const refined = refineShape(
      landmarks.map((l) => ({ x: l.x, y: l.y })),
      landmarks.map((l) => l.confidence),
      _refine,
    );
    for (let i = 0; i < landmarks.length; i++) {
      landmarks[i] = { ...landmarks[i], x: refined[i].x, y: refined[i].y };
    }
  }

  return { landmarks, backend: "onnx" };
}

export function terminateDetector() {
  _session = null;
  _ort = null;
  _backend = "mock";
}
