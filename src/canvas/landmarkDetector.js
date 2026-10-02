// ═══════════════════════════════════════════════════════════════════════════════
// Landmark detector — loads the self-hosted ONNX Runtime UMD build via a <script>
// tag and runs inference on the main thread.
//
// Public/ files can only be referenced via HTML tags (not module imports), so
// the runtime is injected as a classic script and exposed on `window.ort`. The
// model itself is fetched (and cached) by storage/modelCache. When the runtime
// or model is unavailable the deterministic demo detector is used instead.
//
// Robustness layer: the trained model is orientation-specific and has never seen
// an inverted film, so detection runs a small hypothesis search —
// {identity, mirrored} × {normal, inverted} — and keeps whichever candidate looks
// most like a cephalogram (mean heatmap confidence − shape-prior residual − edge
// penalty). The normal hypothesis runs first and short-circuits when it is
// already good, so the common case stays a single forward pass. The winner's
// points are mapped back into original image space and a quality verdict is
// returned so the UI can refuse to present a failed trace as measurements.
// ═══════════════════════════════════════════════════════════════════════════════

import { preprocessGrayscale, decodeHeatmaps, decodeRegression, MODEL_INPUT_SIZE } from "../lib/landmarkModel.js";
import { mockDetections, symbolAt, getLandmarkSet, DEFAULT_LANDMARK_SET } from "../data/landmarkMap.js";
import { refineShape, shapeResidual, getShapeModel } from "../lib/shapeModel.js";
import { assessTraceQuality, qualityRankScore } from "../lib/landmarkQuality.js";

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
let _robustness = {};
let _qualityThresholds = null;
let _ortPromise = null;

// Candidate pre-processing hypotheses, cheapest/most-likely first.
export const DEFAULT_HYPOTHESES = [
  { mirror: false, invert: false },
  { mirror: true, invert: false },
  { mirror: false, invert: true },
  { mirror: true, invert: true },
];

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
  if (opts.robustness) _robustness = opts.robustness;
  if (opts.quality) _qualityThresholds = opts.quality;

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

// Which pre-processing hypotheses are worth evaluating for this call.
// Exported for testing: the ordering (normal first, so the common case costs one
// forward pass) and the forced-hypothesis shortcut are both safety-relevant.
export function hypothesisSet(rb = {}, opts = {}) {
  const forced = opts.forceHypothesis || opts.force;
  if (forced) return [{ mirror: !!forced.mirror, invert: !!forced.invert, forced: true }];
  const list = [{ mirror: false, invert: false }];
  if (rb.autoOrientation !== false) list.push({ mirror: true, invert: false });
  if (rb.autoPolarity !== false) {
    list.push({ mirror: false, invert: true });
    if (rb.autoOrientation !== false) list.push({ mirror: true, invert: true });
  }
  return list;
}

// One forward pass under a single pre-processing hypothesis, plus the quality
// verdict. Points are returned in *original* image space (un-mirrored).
async function runHypothesis(frame, setKey, hyp, rb, thresholds) {
  const { pixels, width, height } = frame;
  const { tensor, size, channels } = preprocessGrayscale(pixels, width, height, _inputSize, {
    channels: _channels, mean: _mean, std: _std,
    mirror: hyp.mirror,
    invert: hyp.invert,
    clahe: rb.clahe ?? false,
    contrast: !!rb.contrast,
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
      confidenceMode: _decode.confidenceMode || "value", psrScale: _decode.psrScale,
    });
  } else if (dims.length === 3 && dims[2] === 2) {
    if (dims[1] !== expected) throw new Error(`Model has ${dims[1]} outputs, expected ${expected}`);
    decoded = decodeRegression(out.data, { channels: dims[1], srcWidth: width, srcHeight: height });
  } else {
    throw new Error("Unsupported model output shape");
  }

  // Everything below is assessed in *model space* — the frame the network
  // actually saw — because the shape prior is expressed in that canonical
  // orientation too.
  //
  // This ordering is load-bearing. If the un-mirror happened first, a
  // deliberately mirrored input would decode a perfectly canonical (correct)
  // shape, then get reflected into the original frame where it looks like a
  // *reflected* cephalogram to the prior: `shapeResidual` would treat it as
  // anatomically atypical and the ranker would reject the mirror hypothesis it
  // was supposed to prefer. The SSM would also drag the correct points back
  // toward the normal-orientation prior. So: assess and refine in model space,
  // then un-mirror purely as an output transform.
  const landmarks = decoded.map(d => ({
    index: d.index,
    symbol: symbolAt(setKey, d.index) ?? `L${d.index}`,
    x: d.x,
    y: d.y,
    confidence: d.confidence,
    score: d.score,
  }));

  // Plausibility of the RAW prediction (before refinement pulls it toward the
  // mean shape) — this is the OOD signal, so it must be measured first.
  const prior = getShapeModel(setKey);
  const hasPrior = Boolean(prior) && landmarks.length === prior.mean.length / 2;
  const residual = hasPrior
    ? shapeResidual(landmarks.map((l) => ({ x: l.x, y: l.y })), { set: setKey })
    : null;

  const quality = assessTraceQuality({
    landmarks, width, height, residual, thresholds,
  });
  const rank = qualityRankScore(quality, rb.rankWeights);

  // Statistical shape-model refinement — only when a prior exists for this
  // landmark set and every landmark is present. Now that confidence is a real
  // PSR-derived value, the confidence weights actually bite.
  if (_refine?.shape && hasPrior) {
    const refined = refineShape(
      landmarks.map((l) => ({ x: l.x, y: l.y })),
      landmarks.map((l) => l.confidence),
      { ..._refine, set: setKey },
    );
    for (let i = 0; i < landmarks.length; i++) {
      landmarks[i] = { ...landmarks[i], x: refined[i].x, y: refined[i].y };
    }
  }

  // A mirrored input was decoded in mirrored space — map it back so every
  // landmark is expressed in the coordinates the canvas uses.
  if (hyp.mirror) {
    for (const l of landmarks) l.x = width - l.x;
  }

  return { landmarks, quality, rank, hypothesis: hyp };
}

// `input` is an HTMLImageElement/canvas or a { pixels, width, height } object.
//
// Returns { landmarks, backend, orientation, polarity, quality, hypotheses }.
// `orientation` is "normal" | "mirrored" and describes the image as it was fed
// to the model (the points always match the original image either way).
export async function detectLandmarks(input, opts = {}) {
  const frame = readPixels(input);
  if (!frame) throw new Error("No image to trace");
  const { width, height } = frame;
  const setKey = opts.landmarkSet || _landmarkSet;
  // Per-call overrides must control *all* robustness behaviour for this call —
  // hypothesis search, pre-processing and ranking — not just which hypotheses
  // are enumerated.
  const rb = { ..._robustness, ...(opts.robustness || {}) };
  const thresholds = { ..._qualityThresholds, ...(opts.quality || {}) };

  if (_backend !== "onnx" || !_ort || !_session) {
    return { landmarks: mockDetections(frame.pixels, width, height, setKey), backend: "mock" };
  }

  const candidates = hypothesisSet(rb, opts);
  let best = null;
  const tried = [];
  for (let i = 0; i < candidates.length; i++) {
    const hyp = candidates[i];
    const result = await runHypothesis(frame, setKey, hyp, rb, thresholds);
    tried.push({
      mirror: hyp.mirror,
      invert: hyp.invert,
      level: result.quality.level,
      rank: result.rank,
      meanConfidence: result.quality.meanConfidence,
      residualRatio: result.quality.residualRatio,
    });
    if (!best || result.rank > best.rank) best = result;
    // Short-circuit: an unambiguous winner on the first (normal) hypothesis is
    // the overwhelmingly common case, so most traces cost a single pass.
    if (i === 0 && !hyp.forced && best.quality.level === "high") break;
  }

  return {
    landmarks: best.landmarks,
    backend: "onnx",
    orientation: best.hypothesis.mirror ? "mirrored" : "normal",
    polarity: best.hypothesis.invert ? "inverted" : "normal",
    quality: best.quality,
    hypotheses: tried,
  };
}

export function terminateDetector() {
  _session = null;
  _ort = null;
  _backend = "mock";
}
