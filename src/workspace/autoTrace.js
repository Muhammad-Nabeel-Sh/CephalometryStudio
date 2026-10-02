// ═══════════════════════════════════════════════════════════════════════════════
// AI auto-trace orchestration
//
// Detects cephalometric landmarks on the active image and merges them into the
// session as placed point markups (linked to the active analysis template), then
// auto-creates the template's measurements — all as a single undo step.
// ═══════════════════════════════════════════════════════════════════════════════

import { uid } from "../lib/utils.js";
import { logWarn } from "../lib/logger.js";
import { PREDEFINED } from "../data/constants.js";
import { appLabelForSymbol } from "../data/landmarkMap.js";
import { LANDMARK_MODEL, isModelConfigured } from "../data/landmarkModelInfo.js";
import { autoCreateMeasurements } from "./template.js";
import { detectLandmarks, initDetector } from "../canvas/landmarkDetector.js";
import { loadModelAsset } from "../storage/modelCache.js";

export function findAnalysis(templateName) {
  if (!templateName || templateName === "blank") return null;
  for (const key of Object.keys(PREDEFINED)) {
    const list = PREDEFINED[key];
    if (!Array.isArray(list)) continue;
    const found = list.find((a) => a.name === templateName);
    if (found) return found;
  }
  return null;
}

// Turn raw detections into placed point markups, honouring the active template's
// landmark set. Landmarks already placed in the session are skipped (no dupes).
export function buildDetectionMarkups(detections, templateName, existingMarkups = [], landmarkSet = LANDMARK_MODEL.landmarkSet) {
  const analysis = findAnalysis(templateName);
  const defByLabel = new Map();
  if (analysis) for (const p of analysis.pts) defByLabel.set(p.l.toLowerCase(), p);

  const placed = new Set(
    existingMarkups
      .filter((m) => m.type === "point" && m.placed && m.points?.[0]?.x > -9000)
      .map((m) => (m.templateLabel || m.label || "").toLowerCase()),
  );

  const points = [];
  let skipped = 0, unmapped = 0;
  for (const d of detections) {
    const app = appLabelForSymbol(d.symbol, landmarkSet);
    if (!app) { unmapped++; continue; }
    const key = app.toLowerCase();
    if (placed.has(key)) { skipped++; continue; }
    const def = defByLabel.get(key);
    if (analysis && !def) { unmapped++; continue; }
    points.push({
      id: uid(),
      type: "point",
      points: [{ x: d.x, y: d.y }],
      label: app,
      templateLabel: app,
      templateId: analysis ? `${analysis.name}::${app}` : null,
      definition: def?.def || "",
      color: def?.color || "#38bdf8",
      size: 6,
      visible: true,
      placed: true,
      // Marks the point as AI-produced so a re-trace can reliably clear the
      // previous trace even if the backend reported no numeric confidence.
      aiPlaced: true,
      aiConfidence: typeof d.confidence === "number" ? d.confidence : undefined,
      aiScore: typeof d.score === "number" ? d.score : undefined,
    });
    placed.add(key);
  }
  return { points, skipped, unmapped };
}

// Insert the detected points + their auto-measurements as one undoable mutation.
// `suppressUndo` lets a caller that has *already* pushed an undo snapshot (e.g.
// the re-trace retry, which clears the previous AI points first) keep the whole
// replace operation on a single history step.
export function applyDetections(store, detections, templateName, calibration, landmarkSet = LANDMARK_MODEL.landmarkSet, suppressUndo = false) {
  const state = store.getState ? store.getState() : store;
  const existing = state.markups || [];
  const { points, skipped, unmapped } = buildDetectionMarkups(detections, templateName, existing, landmarkSet);
  if (!points.length) return { added: 0, skipped, unmapped, measurements: 0 };

  if (!suppressUndo) store.pushUndo();
  let measurements = 0;
  store.updMarkups((ms) => {
    const withPoints = [...ms, ...points];
    const meas = autoCreateMeasurements(withPoints, templateName, calibration);
    measurements = meas.length;
    return [...withPoints, ...meas];
  });
  return { added: points.length, skipped, unmapped, measurements };
}

let _readyPromise = null;

// Prepare the detector: configure the landmark set, load the ONNX runtime +
// weights when configured, otherwise leave the worker on its demo backend.
// Cached after first call.
export function ensureDetectorReady(onProgress) {
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    const opts = {
      landmarkSet: LANDMARK_MODEL.landmarkSet,
      inputSize: LANDMARK_MODEL.inputSize,
      inputChannels: LANDMARK_MODEL.inputChannels,
      normalize: LANDMARK_MODEL.normalize,
      decode: LANDMARK_MODEL.decode,
      refine: LANDMARK_MODEL.refine,
      robustness: LANDMARK_MODEL.robustness,
      quality: LANDMARK_MODEL.quality,
      ortUrl: LANDMARK_MODEL.ortUrl,
      wasmPaths: LANDMARK_MODEL.wasmPaths,
    };
    if (isModelConfigured()) {
      opts.modelBuffer = await loadModelAsset({
        url: LANDMARK_MODEL.url,
        sha256: LANDMARK_MODEL.sha256,
        onProgress,
      });
    }
    return initDetector(opts);
  })().catch((err) => {
    logWarn("AI auto-trace: model unavailable — run scripts/convert-hrnet19-onnx.py, npm run setup:ort, and place the .onnx in public/models/. Using demo detector.", err);
    return "mock";
  });
  return _readyPromise;
}

// Detect + place. `forceHypothesis` ({ mirror?, invert? }) re-runs detection with
// one specific pre-processing hypothesis, which the UI offers when the automatic
// search could not find a good match (e.g. a mirrored film the user knows about).
// `suppressUndo` is set by the re-trace retry, which already pushed a snapshot
// covering the removal of the previous trace, so the replace stays one undo step.
export async function runAutoTrace({ imageInput, calibration, store, onProgress, forceHypothesis, suppressUndo = false }) {
  await ensureDetectorReady(onProgress);
  const { landmarks, backend, orientation, polarity, quality, hypotheses } = await detectLandmarks(imageInput, {
    landmarkSet: LANDMARK_MODEL.landmarkSet,
    forceHypothesis,
  });
  // Decoupled: place every detected landmark now (no template filter, no
  // measurements). The analysis + measurements are chosen afterwards from the
  // analysis-selection modal (workspace/template.applyAnalysis).
  const summary = applyDetections(store, landmarks, null, calibration, LANDMARK_MODEL.landmarkSet, suppressUndo);
  return { ...summary, backend, orientation, polarity, quality, hypotheses };
}
