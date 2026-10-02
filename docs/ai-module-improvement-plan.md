# AI Module Improvement Plan — Robustness, Orientation & Confidence

> Status: **Phase 1 implemented (client-side); Phase 2 retraining not started.**
> Verification: `npm run lint` clean, `581/581` tests pass (31 files), `npm run build` OK.
>
> Implemented in Phase 1:
> 1. Preprocessing transforms (`src/lib/landmarkModel.js`): horizontal mirror,
>    polarity inversion, CLAHE (`"auto"` when the plane SD is low), contrast stretch.
> 2. Real per-landmark confidence: PSR with a Gaussian extreme-value noise floor,
>    `psrScale: 6`. Raw `score` also surfaced for auditing.
> 3. `shapeResidual()` (`src/lib/shapeModel.js`) — orthogonal distance to the PCA
>    shape subspace, plus Mahalanobis distance.
> 4. `src/lib/landmarkQuality.js` — pure quality gate (high/medium/low) with reasons.
> 5. Hypothesis search over normal/mirrored × normal/inverted, short-circuiting on
>    the first high-quality normal hypothesis (`landmarkDetector.js`).
> 6. UI: quality banner + reasons + explicit "as-is / mirrored / inverted"
>    re-trace actions (`MarkupsPanel`), and a pre-analysis warning (`AnalysisModal`).
>
> Still outstanding: real-model browser verification of the new detector,
> threshold calibration against a labelled OOD set, manual transform toggles
> (`ImagePanel`), per-landmark canvas confidence colouring, local failure
> reporting, and all Phase 2 training augmentation.
> Goal: make in-browser AI auto-trace reliable across real-world cephalograms —
> mirrored films, inverted/negative scans, variable contrast, and out-of-distribution
> anatomy — and give the clinician an honest confidence signal before any
> measurement or norm is trusted.
>
> Scope: `src/canvas/landmarkDetector.js`, `src/lib/landmarkModel.js`,
> `src/lib/shapeModel.js`, `src/workspace/autoTrace.js`, the panels, the
> `scripts/*` model pipeline, and the CephaloHRNet training augmentation.

---

## 1. Current state (what ships today)

| Piece | Where | Notes |
| --- | --- | --- |
| Model | HF `MuhammadNabeelSh/cephalometry-landmarks`, static-QDQ **INT8** ONNX | HRNet-W32, 29 landmarks, 768², 3-ch, ImageNet norm |
| Runtime | `public/ort/ort.wasm.min.js` + `ort-wasm-simd-threaded.{mjs,wasm}` (committed) | WASM EP, single-thread, no proxy |
| Preprocess | `src/lib/landmarkModel.js` `preprocessGrayscale()` | grayscale → bilinear resize → replicate×3 → `(x−mean)/std` |
| Decode | `decodeDark()` (DARK: Gaussian blur → log → argmax → Taylor) | confidence = `clamp(log(smoothed peak))` |
| Refine | `src/lib/shapeModel.js` `refineShape()` | PCA projection, pose-normalized, confidence-weighted, ±3σ |
| Orchestration | `src/workspace/autoTrace.js` `runAutoTrace()` | detects all 29, then `AnalysisModal` picks the analysis (decoupled) |
| Accuracy (report) | CEPHA29 valid split (150 imgs) | **MRE ≈ 1.24 mm, SDR@2 mm 83%** (in-distribution) |

Accuracy numbers are **in-distribution** (Aariz holdout). They do not describe
behaviour on foreign images.

---

## 2. Observed failure modes

1. **Mirrored image → all points wrong.** A horizontally flipped ceph is fully
   out-of-distribution; the detector is not orientation-invariant, so every
   landmark scatters.
2. **Some lateral cephs erroneous, others accurate.** Classic distribution shift:
   different machine/exposure, digital vs scanned film, **inverted (negative)
   polarity**, heavy cropping, low contrast, or atypical anatomy.
3. **No safety net.** The app cannot tell a bad trace from a good one, so it
   happily computes measurements and norms from garbage points.

---

## 3. Root-cause analysis (grounded in code)

### 3.1 The model has never seen a mirror
CephaloHRNet's `data/transforms.py` augments **rotation ±15°, scale 0.85–1.15,
translate, brightness, contrast, noise, blur** — **no horizontal flip**. There is
also **no polarity inversion** and no CLAHE. So:
- mirrored input ⇒ OOD ⇒ scrambled predictions;
- inverted/scanned film ⇒ OOD ⇒ degraded predictions.

### 3.2 The app's preprocessing is fixed and unguarded
`preprocessGrayscale()` (`src/lib/landmarkModel.js`) always
grayscale → resize → replicate → ImageNet norm. It has:
- **no orientation handling**,
- **no polarity (negative) detection**,
- **no contrast normalization**,
- **no framing/crop normalization**.

### 3.3 "Confidence" is inert
In `decodeDark()`, `best` is the **log** of the smoothed heatmap peak, then
`confidence = clamp(best, 0, 1)`. For diffuse heatmaps that is negative → clamped
to **0**. Consequences:
- `aiConfidence` on markups is ≈ 0 everywhere;
- SSM weights (`wmin = 0.2`) become uniform — the shape model can **silently pull
  a wrong detection to a plausible-but-wrong pose**;
- nothing can gate on confidence.

### 3.4 No OOD / quality signal
`refineShape()` projects onto the shape subspace but never returns the **residual**
(how far the prediction is from plausible anatomy). That residual is exactly the
signal we need to flag "this trace doesn't look like a cephalogram."

### 3.5 Single-source training
Trained only on Aariz. No multi-machine / multi-source diversity, no inverted
films, no mirror augmentation. OOD is expected, not exceptional.

---

## 4. Goals & success criteria

| Goal | Metric | Target |
| --- | --- | --- |
| Mirror robustness | MRE on mirrored valid set | ≤ non-mirrored MRE + 10% (or exact after auto-fix) |
| Polarity robustness | MRE on inverted valid set | within +15% of non-inverted |
| Failure detection | AUC of quality gate separating good vs bad traces | ≥ 0.9 |
| Honest confidence | low-confidence traces never auto-apply analysis | 100% |
| No silent regressions | golden CI test | pass |
| Graceful UX | user is warned + offered a fix on all OOD cases | 100% |

---

## 5. Proposed robustness layer (architecture)

```
image ──► [ framing normalize ] ──► [ polarity candidate(s) ] ──► [ orientation candidate(s) ]
                                                                          │
                                              ┌───────────────────────────┴───────────────────────────┐
                                              │  hypothesis set: {identity, mirror} × {normal, invert} │
                                              │  (+ optional contrast variants)                        │
                                              └───────────────────────────┬───────────────────────────┘
                                                                          ▼
                                     per-hypothesis: preprocess → ONNX session → DARK decode
                                                                          │
                                             score = w1·meanConf − w2·ssmResidual (+ edge penalty)
                                                                          │
                              pick best hypothesis ──► un-transform points ──► SSM refine
                                                                          │
                              quality = { meanConf, minConf, ssmResidual, edgeCount, ttaSpread }
                                                                          │
                                   if quality low ──► WARN + require review (no auto analysis)
```

Key idea: **detection stays model-agnostic**, and robustness is achieved by
(a) searching a small hypothesis space and (b) scoring with the shape prior —
both implementable today without retraining.

---

## 6. Roadmap

| Phase | Theme | Ships without retraining? |
| --- | --- | --- |
| **0** | Instrumentation, eval harness, failure capture | ✅ |
| **1** | Client-side robustness (orientation, polarity, confidence, gate) | ✅ |
| **2** | Training augmentation + fine-tune on diverse data | ❌ (needs GPU) |
| **3** | Learned uncertainty, OOD classifier, continuous loop | ❌ |

---

## 7. Phase 0 — Instrumentation & evaluation

**Why first:** we need to know which mitigation matters. Cheap, and it builds the
retraining set.

### 7.1 Failure capture ("Report bad trace")
- New local-only feature: store `{ image (IndexedDB), predicted points, confidence,
  quality, modelVersion, timestamp }` for traces the user flags.
- Exportable as a small dataset (image + the analytic structure) for offline eval.
- Reuse `src/storage/imageStore.js` (already IndexedDB) + a new
  `src/storage/aiFeedback.js`.
- **Privacy:** never upload; export is manual and anonymized (`report/anonymize.js`
  already exists).

### 7.2 Extend the offline harness
`scripts/eval-landmark-model.py` gains stress flags:
```
--mirror      # horizontally flip test images (and ground truth)
--invert      # negate intensity
--clahe       # apply CLAHE
--blur σ      # gaussian blur
--report-ood  # also emit per-image confidence/SSM-residual (for gate tuning)
```
Output per-landmark MRE + SDR for each condition → a robustness matrix.

**Deliverable:** a CSV/MD report per condition; a small OOD image set in
`Examples/` (local).

---

## 8. Phase 1 — Client-side robustness (no retraining)

### 8.1 Preprocessing upgrades — `src/lib/landmarkModel.js`
Extend `preprocessGrayscale()` with options (all default-off, so existing behaviour
is unchanged):
```js
preprocessGrayscale(pixels, w, h, size, {
  channels, mean, std,
  mirror = false,     // horizontal flip (and un-flip coordinates on decode)
  invert = false,     // polarity flip  (v → 1 − v)
  clahe  = false,     // contrast-limited adaptive histogram equalization
})
```
- `mirror`: flip the RGBA row order before grayscale (cheapest correct place).
- `invert`: `gray[i] = 1 - gray[i]` after luminance.
- `clahe`: implement a small tile-based CLAHE on the resized gray plane
  (8×8 tiles, clip limit) — pure JS, unit-testable. Add a `contrastStretch`
  fast path (1st–99th percentile) as a cheaper default.

**Tests:** `src/test/landmarkModel.test.js` — assert `invert` maps 0→1, 1→0;
`mirror` reverses columns; preprocess is deterministic.

### 8.2 Multi-hypothesis orientation/polarity — `src/canvas/landmarkDetector.js`
Add a robustness pass around `detectLandmarks()`:
```js
const HYPOTHESES = [
  { mirror: false, invert: false },
  { mirror: true,  invert: false },   // mirrored films
  { mirror: false, invert: true  },   // negatives
  { mirror: true,  invert: true  },
];
```
1. Run the normal hypothesis first.
2. If its quality is high ⇒ accept, stop (no cost in the common case).
3. Otherwise run the remaining hypotheses, score each, and pick the best:
   `score = meanConf − λ·ssmResidual − edgePenalty`.
4. Un-transform the winning points back to the *original* image space
   (un-mirror: `x → W − x`; un-invert is a no-op for coordinates).
5. Return `{ landmarks, backend, orientation: "mirrored"|"normal", polarity, quality }`.

#### Implemented ordering (a bug that made re-trace a no-op)

**Assessment and refinement must happen in the frame the network saw; the
un-mirror is an output transform and must come last.** The first implementation
un-mirrored the decoded points *before* computing the SSM residual and running
`refineShape()`, which broke the mirror fix in two compounding ways:

1. The shape prior is canonical (one orientation). A correctly mirrored
   detection, once mapped back to the display frame, is a *reflected*
   cephalogram — so `shapeResidual` scored it ≈1.03 ("anatomically atypical")
   and `qualityRankScore` penalised it, while a hallucinated canonical shape from
   the normal hypothesis scored ≈0. The search therefore preferred "normal" on a
   mirrored film.
2. `refineShape()` then projected the correctly mirrored image-space points onto
   the canonical prior (`alpha 0.6`), actively pushing them back toward the
   normal orientation — cancelling the mirror.

The net effect was that "Re-trace mirrored" either changed nothing or made the
points worse, which is exactly the reported symptom. The fix:
`decode → assess + refine in model space → un-mirror for output`. Pinned by
`src/test/landmarkDetectorHypotheses.test.js`, which drives a fake
orientation-sensitive ORT session and fails (picks `normal`) if the ordering is
reverted.

Config in `src/data/landmarkModelInfo.js`:
```js
robustness: {
  autoOrientation: true,     // search {normal, mirror}
  autoPolarity: true,        // search {normal, invert}
  clahe: "auto",             // "off" | "on" | "auto" (when local contrast low)
  ttaConsensus: false,       // rotation/scale TTA for uncertainty (Phase 3)
}
```

**Cost:** worst case 4× a single forward pass (still one-shot, WASM, ~seconds).
Gate the search so the common case stays 1×.

**Tests:** synthetic reverse-image test — feed a horizontally mirrored copy of a
fixture and assert the detector's auto-orientation recovers the same landmarks
(after un-mirroring) within tolerance.

### 8.3 Real confidence — `src/lib/landmarkModel.js`
Replace the log-peak with a calibrated proxy computed on the **raw** heatmap plane:
- **softmax peak probability**: `exp(p_max − logsumexp(plane))`; or
- **peak-to-sidelobe ratio (PSR)**: `(p_max − μ(plane)) / σ(plane)`, squashed to [0,1].

Return per-landmark `confidence ∈ [0,1]`. Prefer PSR (robust, cheap, no overflow).
- Surface it: color-code low-confidence points in the canvas/verify banner and the
  `AnalysisModal`.
- Feed real confidences into `refineShape()` weights.

**Tests:** a sharp synthetic Gaussian → high PSR; flat plane → low PSR.

### 8.4 SSM residual / quality score — `src/lib/shapeModel.js`
Add:
```js
export function shapeResidual(points, set) {
  // align to mean, project onto K components, return
  //   { residual (orthogonal distance), mahalanobis (coeffs / sigma) }
}
```
`residual` is the component orthogonal to the shape subspace (large ⇒ atypical
anatomy/bad detection); `mahalanobis` measures how extreme the subspace fit is.

### 8.5 Quality gate + UX
Aggregate in the detector and expose to `autoTrace`/App:
```js
quality = {
  meanConf, minConf,
  ssmResidual, ssmMahalanobis,
  edgeCount,          // landmarks within N px of the border
  orientation, polarity,
  level: "high" | "medium" | "low",
}
```
Thresholds tuned from Phase 0 (`--report-ood`) on val + OOD sets.

#### Provisional thresholds, and why

These are **not** yet calibrated on real images — they are set from measurements
against the shipped CEPHA29 prior (`data/shapeModel.cepha29.json`) so that the
cut points sit in the large gap the metric actually exhibits:

| configuration | `residualRatio` | `mahalanobis` |
| --- | --- | --- |
| exact mean shape | 0.000 | 0.00 |
| 11 px RMS (the model's reported 1.24 mm MRE) | 0.031 | 0.47 |
| 40 px RMS | 0.122 | 1.88 |
| 100 px RMS | 0.300 | 4.37 |
| **mirrored radiograph** | **1.032** | 6.69 |
| upside-down film | 1.032 | 6.69 |
| shuffled landmark order | 1.106 | 1.91 |
| random points | 1.060 | 4.66 |
| all points collapsed | 1.106 | 1.91 |

A realistic detection and a mirrored film differ by **>30×**, so the cut points
(`residualRatio` medium 0.06 / high 0.12; `mahalanobis` medium 2.5 / high 5) are
not near a cliff edge — they are roughly 2× the realistic-detection value and
~9× *below* the failure value.

Note that `mahalanobis` alone is **not** sufficient: a shuffled or fully collapsed
configuration projects onto the subspace with a low Mahalanobis (1.91) while its
orthogonal residual is maximal (1.11). The orthogonal residual is therefore the
primary signal and Mahalanobis is a secondary check. The metric is also
pose-invariant, so it reflects shape plausibility only — never size or position.

Same argument for the PSR noise floor: it is a Gaussian extreme-value estimate,
so heavier-tailed noise (uniform peaks at only ~1.7 sd) is *over*-corrected to
~0. Over-correcting is the safe direction for a gate deciding whether to trust a
trace.

UI behaviour:
- **high** → normal flow (as today).
- **medium** → banner "verify points"; AnalysisModal still allowed but flagged.
- **low** → prominent warning; **do not auto-apply analysis/norms**; offer
  "try mirror/invert", "re-run", "trace manually". Never show computed norms as
  authoritative.

Touched: `src/panels/MarkupsPanel.jsx` (banner), `src/panels/AnalysisModal.jsx`
(quality-aware), `src/App.jsx` `handleAutoTrace`/`handlePickAnalysis`.

### 8.6 Edge / crop guard
- Flag landmarks predicted at/near the image border (possible extrapolation).
- Warn when the ceph bounding box touches the frame (cropped anatomy).

### 8.7 Orientation / polarity UI toggles — `src/panels/ImagePanel.jsx`
- "Image is mirrored" toggle, "Invert", "Auto-enhance contrast" — so the user can
  correct the *image* (not just the points) and re-trace.

### 8.8 (Experimental) Framing normalization
- Detect the ceph's non-background bounding box and pad/crop to a target aspect so
  the head occupies a training-like fraction of the frame.
- **Guard:** only enable if Phase 0 shows it helps; it can hurt if done wrong.

---

## 9. Phase 2 — Training augmentation & fine-tune (the durable fix)

### 9.1 Augmentation — CephaloHRNet `data/transforms.py`
Add (with correct landmark transforms):
| Augmentation | Probability | Landmark transform |
| --- | --- | --- |
| **Horizontal flip** | 0.5 | `x → imgsz−1−x` (and swap left/right symbols if any) |
| **Polarity invert** | 0.2 | none (photometric) |
| **CLAHE** | 0.3 | none |
| **Gamma / vignette / JPEG** | 0.2–0.3 | none |
| Stronger contrast, coarse rotation | existing + widen | as existing |

> **Decision required — mirror policy (see §13.1).** Flip augmentation makes the
> model mirror-*robust* but erases inherent left/right semantics. Recommended:
> keep flip augmentation **but** also add an explicit **orientation classifier**
> (binary: normal vs mirrored) so the app can still report the true orientation.

### 9.2 Data diversity
- Add sources: scanned film (inverted), second machine, second population.
- **Fine-tune** the existing 29-channel checkpoint on the combined set (faster,
  less data) rather than training from scratch.
- Optionally expand the vocabulary (e.g., `APOcc/PPOcc`, `Ba`, molars) — requires
  editing `LANDMARK_SYMBOLS` in `data/dataset.py`, `src/data/landmarkMap.js`
  (order = channel order!), `scripts/build-shape-model.py`, and the analysis data.

### 9.3 Export & rollout
1. Re-run `scripts/train-cepha29/kaggle-notebook.ipynb` (train + export).
2. `scripts/export-landmark-onnx.py --quantize` → new INT8 QDQ; note the `sha256`.
3. `scripts/build-shape-model.py --set cepha29` → SSM prior.
4. Update `src/data/landmarkModelInfo.js` (`sha256`, `version`, `enabled`).
5. Re-run Phase 0 harness (now including `--mirror/--invert/--clahe`) and publish
   the robustness matrix.
6. Update the Hugging Face model card + changelog.

### 9.4 Evaluation protocol (add to `eval-landmark-model.py`)
- **External** split (not Aariz) — the number that matters.
- Per-landmark MRE + SDR, and **comparison to human inter-rater error**.
- Stress conditions: mirrored, inverted, blurred, low-contrast, cropped.
- Report the quality-gate AUC on good vs OOD.

---

## 10. Phase 3 — Learned uncertainty & continuous improvement

- **MC-dropout / deep ensembles** for predictive uncertainty (heavier; optional).
- **Visibility head** per landmark (predict "in frame / not visible") to avoid
  guessing cropped points.
- **OOD classifier** trained on (in-distribution vs captured failures).
- **Continuous loop:** anonymized "report bad trace" → periodic retraining →
  versioned rollout with the same integrity checks (SHA, prior, eval).

---

## 11. Governance, safety & provenance

- **Never auto-apply** measurements/norms below the confidence gate.
- **Provenance on markups:** store `aiModelVersion`, `aiConfidence`,
  `aiQuality`, `orientation`, `polarity`, `edited` so a case is auditable.
- **Disclaimer** stays ("research/education; not a medical device") — and the AI
  UI must not imply more certainty than the confidence supports.
- **Model card** documents limitations (in-distribution metrics, OOD behaviour).
- **Licensing:** the CEPHA29/Aariz dataset is CC BY 4.0 → attribution required on
  any retrained weights; check licenses of any added datasets.

---

## 12. Testing & CI

- Unit: preprocessing transforms (mirror/invert/CLAHE), confidence (PSR),
  `shapeResidual`, quality thresholds, orientation scoring.
- Integration: synthetic **mirrored fixture** → auto-orientation recovers points;
  synthetic **inverted fixture** → auto-polarity recovers points.
- **Golden CI guard:** a tiny fixed image + expected channel/label mapping so a
  channel-order or preprocessing regression fails the build (no GPU needed).
- Keep `npm run lint`, `npm test`, `npm run build` green; add the harness to CI
  where feasible.

### Added in Phase 1 (63 new tests, 518 → 581)

| file | covers |
| --- | --- |
| `src/test/landmarkModel.test.js` | plane stats, mirror/invert, auto-CLAHE trigger + local-contrast gain, PSR noise-floor correction, sharp vs diffuse heatmaps, legacy confidence compatibility |
| `src/test/landmarkQuality.test.js` | every quality gate (confidence, weak-landmark fraction, border proximity, shape plausibility), reason emission, threshold overrides, rank scoring, non-finite coordinates, empty input |
| `src/test/shapeModel.test.js` | `shapeResidual`: pose invariance, zero on mean, growth with error, and >10× separation for mirrored / upside-down / shuffled / collapsed configurations |
| `src/test/landmarkDetector.test.js` | hypothesis search order, opt-outs, forced-hypothesis contract, demo-backend fallback |
| `src/test/landmarkDetectorHypotheses.test.js` | fake orientation-sensitive ORT session: the mirrored hypothesis wins on a mirrored film, its model-space residual stays low, a normal film short-circuits, forced hypotheses take effect |
| `src/test/autoTrace.test.js` | `suppressUndo` single-history-step guarantee, `aiPlaced`/`aiConfidence`/`aiScore` provenance, absent-provenance handling |

The mirrored-orientation logic is covered end-to-end against a *fake*
orientation-sensitive ORT session; what remains unverified is the same path with
the real INT8 weights in a headless browser (timing, WASM, the actual confidence
distribution on a real mirrored film).

---

## 13. Open decisions

1. **Mirror policy.** (a) model stays orientation-specific + app detects/warns/
   fixes (fast, safe, ships now); (b) add flip augmentation (model robust, needs
   retraining, loses left/right semantics unless paired with an orientation
   classifier). **Recommendation: do (a) now, then (b) with an orientation head.**
   → *Phase 1 implements (a): 4-hypothesis search + explicit re-trace buttons.*
2. **Auto-correct vs warn.** Silent auto-flip of points is convenient but risky.
   **Recommendation: warn + explicit one-click fix**, plus a manual toggle.
   → *Implemented as warn + explicit one-click fix. The manual `ImagePanel` toggle
   is still outstanding.*
3. **Low-confidence behaviour.** **Recommendation: block analysis auto-apply and
   normative interpretation; allow points for review.**
   → *Partially implemented. Auto-trace never applies measurements on its own (the
   `AnalysisModal` already gates that), and a low-quality trace is warned about
   before the user picks an analysis. The analysis is still selectable afterwards,
   so a hard block on norms has not been added.*
4. **Failure-case collection.** Consent + local-only storage; export is manual and
   anonymized. → *Not started.*
5. **Framing normalization** — only if Phase 0 shows a benefit. → *Not started;
   deferred pending real OOD data.*

---

## 14. Milestones & rough effort

| # | Item | Phase | Effort |
| --- | --- | --- | --- |
| 1 | Eval flags + OOD report (`eval-landmark-model.py`) | 0 | 0.5–1 d |
| 2 | Failure capture (local + export) | 0 | 1–2 d |
| 3 | Preprocess: mirror/invert/CLAHE + tests | 1 | 1–2 d |
| 4 | Confidence (PSR) + tests | 1 | 0.5 d |
| 5 | `shapeResidual` + quality score | 1 | 1 d |
| 6 | Multi-hypothesis search + config | 1 | 1–2 d |
| 7 | Quality gate + UI (banner, modal, toggles) | 1 | 2–3 d |
| 8 | Edge/crop guard | 1 | 0.5 d |
| 9 | Augmentation + fine-tune + export + eval | 2 | 3–7 d (+ GPU) |
| 10 | Uncertainty heads / OOD classifier | 3 | ≥1 wk |

**Phase 1 is ≈1–1.5 weeks** and fixes the two reported problems for most images
without touching the model. Phase 2 is the durable fix.

---

## 15. Appendix — file map

| Concern | File(s) |
| --- | --- |
| Preprocessing / decode / confidence | `src/lib/landmarkModel.js` |
| Inference + hypothesis search | `src/canvas/landmarkDetector.js` |
| Shape prior + residual | `src/lib/shapeModel.js`, `src/data/shapeModel.*.json` |
| Manifest / config | `src/data/landmarkModelInfo.js` |
| Orchestration | `src/workspace/autoTrace.js`, `src/workspace/template.js` |
| UI | `src/panels/MarkupsPanel.jsx`, `AnalysisModal.jsx`, `ImagePanel.jsx`, `src/App.jsx` |
| Feedback storage | `src/storage/imageStore.js`, new `src/storage/aiFeedback.js` |
| Training augmentation | CephaloHRNet `data/transforms.py` (via the Kaggle notebook) |
| Model pipeline | `scripts/train-cepha29/kaggle-notebook.ipynb`, `scripts/export-landmark-onnx.py`, `scripts/build-shape-model.py`, `scripts/eval-landmark-model.py` |
| Dataset / attribution | Aariz Cephalometric Dataset (CEPHA29), CC BY 4.0 |
