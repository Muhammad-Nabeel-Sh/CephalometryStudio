// ═══════════════════════════════════════════════════════════════════════════════
// AI trace quality assessment
//
// Turns a decoded landmark set into an honest confidence verdict. The detector
// cannot fail silently any more: a mirrored, inverted, cropped or simply
// unrecognisable radiograph produces either weak heatmap responses (low PSR
// confidence) or a prediction far outside the anatomical shape subspace (large
// SSM residual), and both are surfaced to the user before any measurement or
// normative interpretation is trusted.
//
// Pure module — no DOM, no ML runtime — so it is unit-testable and can also be
// used offline (scripts/eval-landmark-model.py --report-ood) to calibrate the
// thresholds below against a labelled good/OOD split.
// ═══════════════════════════════════════════════════════════════════════════════

// Thresholds are intentionally conservative: "high" means the trace is clean
// enough to build measurements from without nagging, "low" means the user must
// verify (or re-trace) before the numbers mean anything.
//
// Confidence is the PSR-squashed peak-to-sidelobe ratio (landmarkModel PSR_SCALE
// = 6, noise-floor corrected). Measured on synthetic heatmaps: a sharp
// unambiguous response ≈0.55–0.65, a diffuse one ≈0.35–0.45, a flat or pure-noise
// plane <0.2. The cut points below sit between those bands — recalibrate them
// against a labelled good/OOD split via
// `python scripts/eval-landmark-model.py --report-ood` whenever the model changes.
export const DEFAULT_QUALITY_THRESHOLDS = {
  // per-landmark heatmap confidence (PSR-squashed, 0..1)
  lowLandmarkConfidence: 0.2,
  mediumMeanConfidence: 0.45,
  minMeanConfidence: 0.3,
  maxLowFraction: 0.25,
  // A handful of soft landmarks is normal; only a meaningful share should move
  // the verdict. (Previously any single soft landmark forced at least "medium".)
  mediumLowFraction: 0.1,
  // landmarks sitting on/near the frame border are extrapolations
  edgeMargin: 0.02, // fraction of min(width, height)
  mediumEdgeFraction: 0.1,
  maxEdgeFraction: 0.2,
  // Shape-prior plausibility. **Provisional — pending calibration on the
  // CEPHA29 validation set** (docs/ai-module-improvement-plan.md §14).
  //
  // shapeResidual() now fits all 10 prior components, so an ordinary trace with
  // realistic noise scores ≈0.03–0.15 and a mirrored / shuffled / random
  // configuration scores ≈1.0. The old 0.12 "high" cut came from a synthetic
  // jitter that sat inside the subspace and flagged normal anatomy; these cut
  // points sit in the wide gap instead.
  residualRatioMedium: 0.25,
  residualRatioHigh: 0.5,
  // mahalanobis² is a sum of K standardized squared coefficients ≈ χ²_K, so
  // these are √χ²_{K,p}: for K=10, p95 ≈ 4.28 and p99 ≈ 4.82. The old 2.5 sat
  // at the χ² median and flagged roughly half of all normal shapes.
  mahalanobisMedium: 4.3,
  mahalanobisHigh: 5.5,
};

// Weights for ranking competing hypotheses (orientation / polarity candidates).
export const DEFAULT_RANK_WEIGHTS = { residual: 0.35, edge: 0.25 };

function ratio(n, d) {
  return d > 0 ? n / d : 0;
}

// Assess a decoded landmark set.
//
//   landmarks: [{ x, y, confidence?, score? }]
//   width/height: source image dimensions (for the edge guard)
//   residual:   optional { residual, residualRatio, mahalanobis } from
//               lib/shapeModel shapeResidual()
//   thresholds: optional override of DEFAULT_QUALITY_THRESHOLDS
export function assessTraceQuality({ landmarks = [], width, height, residual = null, thresholds } = {}) {
  const th = { ...DEFAULT_QUALITY_THRESHOLDS, ...(thresholds || {}) };

  const confs = landmarks.map((l) => (typeof l.confidence === "number" && Number.isFinite(l.confidence) ? l.confidence : null)).filter((c) => c !== null);
  const n = landmarks.length;
  const meanConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
  const minConfidence = confs.length ? Math.min(...confs) : 0;
  const lowCount = confs.filter((c) => c < th.lowLandmarkConfidence).length;
  const lowFraction = ratio(lowCount, confs.length);

  // Edge guard — predictions on the frame border are extrapolations, usually a
  // sign of a tightly cropped film.
  let edgeCount = 0;
  if (width > 0 && height > 0) {
    const m = th.edgeMargin * Math.min(width, height);
    for (const l of landmarks) {
      if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) continue;
      if (l.x <= m || l.y <= m || l.x >= width - m || l.y >= height - m) edgeCount++;
    }
  }
  const edgeFraction = ratio(edgeCount, n);

  const residualRatio = residual && Number.isFinite(residual.residualRatio) ? residual.residualRatio : null;
  const mahalanobis = residual && Number.isFinite(residual.mahalanobis) ? residual.mahalanobis : null;

  // Reasons are split into those that actually drive the verdict (`reasons`)
  // and informational observations (`notes`). A single soft landmark is a note,
  // not a failure — presenting it as a warning made ordinary films look broken.
  const reasons = [];
  const notes = [];
  if (!confs.length) {
    reasons.push("no per-landmark confidence signal");
  } else {
    if (lowFraction > th.maxLowFraction) {
      reasons.push(`${lowCount} of ${confs.length} landmarks have a weak heatmap response`);
    } else if (lowCount > 0) {
      notes.push(`${lowCount} of ${confs.length} landmarks have a weak heatmap response`);
    }
    if (meanConfidence < th.minMeanConfidence) reasons.push("overall landmark confidence is low");
    else if (meanConfidence < th.mediumMeanConfidence) notes.push("overall landmark confidence is only moderate");
  }
  if (edgeFraction > th.maxEdgeFraction) {
    reasons.push(`${edgeCount} landmarks sit on the image border (cropped film?)`);
  } else if (edgeFraction > th.mediumEdgeFraction) {
    notes.push(`${edgeCount} landmarks are close to the image border`);
  }
  if (residualRatio !== null && residualRatio > th.residualRatioHigh) {
    reasons.push("the traced configuration is anatomically atypical");
  } else if (residualRatio !== null && residualRatio > th.residualRatioMedium) {
    notes.push("the traced configuration is slightly atypical");
  }
  if (mahalanobis !== null && mahalanobis > th.mahalanobisHigh) {
    reasons.push("extreme shape outlier — likely a failed detection");
  } else if (mahalanobis !== null && mahalanobis > th.mahalanobisMedium) {
    notes.push("unusual shape fit");
  }

  const isLow = (
    (!confs.length) ||
    (confs.length && meanConfidence < th.minMeanConfidence) ||
    lowFraction > th.maxLowFraction ||
    edgeFraction > th.maxEdgeFraction ||
    (residualRatio !== null && residualRatio > th.residualRatioHigh) ||
    (mahalanobis !== null && mahalanobis > th.mahalanobisHigh)
  );
  const isMedium = !isLow && (
    (confs.length && meanConfidence < th.mediumMeanConfidence) ||
    lowFraction > th.mediumLowFraction ||
    edgeFraction > th.mediumEdgeFraction ||
    (residualRatio !== null && residualRatio > th.residualRatioMedium) ||
    (mahalanobis !== null && mahalanobis > th.mahalanobisMedium)
  );

  return {
    level: isLow ? "low" : isMedium ? "medium" : "high",
    count: n,
    meanConfidence,
    minConfidence,
    lowCount,
    lowFraction,
    edgeCount,
    edgeFraction,
    residual: residual ? residual.residual : null,
    residualRatio,
    mahalanobis,
    k: residual && Number.isFinite(residual.k) ? residual.k : null,
    reasons,
    notes,
    thresholds: th,
  };
}

// Single scalar used to pick the best of several hypotheses (e.g. mirrored vs
// normal, inverted vs normal). Higher is better. Residual and edge penalties are
// normalised against their "low" thresholds so each contributes ≈0..1.
export function qualityRankScore(quality, weights) {
  const w = { ...DEFAULT_RANK_WEIGHTS, ...(weights || {}) };
  const th = { ...DEFAULT_QUALITY_THRESHOLDS, ...(quality?.thresholds || {}) };
  if (!quality) return -Infinity;
  const residNorm = quality.residualRatio === null || quality.residualRatio === undefined
    ? 0
    : Math.min(2, quality.residualRatio / th.residualRatioHigh);
  return quality.meanConfidence - w.residual * residNorm - w.edge * Math.min(1, quality.edgeFraction);
}

// Human-readable one-liner for banners.
export function describeQuality(quality) {
  if (!quality) return "";
  const pct = (v) => `${Math.round(v * 100)}%`;
  const parts = [`confidence ${pct(quality.meanConfidence)}`];
  if (quality.residualRatio !== null && quality.residualRatio !== undefined) {
    parts.push(`shape fit ${(quality.residualRatio * 100).toFixed(1)}%`);
  }
  if (quality.edgeCount) parts.push(`${quality.edgeCount} on border`);
  return parts.join(" · ");
}