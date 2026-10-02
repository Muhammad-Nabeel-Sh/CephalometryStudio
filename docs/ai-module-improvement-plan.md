# AI Module Improvement Plan — Robustness, Orientation & Confidence

> Status: **Phase 1 + Phase 1b complete and calibrated on the CEPHA29 held-out
> `valid` split. Phase 2 retraining not started.**
> Verification: `npm run lint` clean, `592/592` tests pass (32 files), `npm run build` OK.
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
> Phase 1b (complete) — see §14. The Phase 1 shape-plausibility thresholds were
> calibrated against a synthetic fixture that was not representative, so **clean,
> correct traces of typical-but-varied anatomy were flagged "Low-confidence
> trace"**. Fixed `shapeResidual` (all prior components), removed the
> non-discriminative Mahalanobis cutoff, split reasons/notes, stopped a single
> soft landmark downgrading the verdict, and **calibrated the cut points on the
> held-out `valid` split (150 images)**: 0% false-low, 6% soft-medium. Verified by
> `src/test/qualityCalibration.test.js`.
>
> Still outstanding: real-model browser verification of the new detector, manual
> transform toggles (`ImagePanel`), per-landmark canvas confidence colouring,
> local failure reporting, and all Phase 2 training augmentation.
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
| Preprocess | `src/lib/landmarkModel.js` `preprocessGrayscale()` | grayscale → bilinear resize → replicate×3 → `(x−mean)/std`; optional mirror / invert / CLAHE / stretch |
| Decode | `decodeDark()` (DARK: Gaussian blur → log → argmax → Taylor) | confidence = PSR on the blurred plane, noise-floor corrected (`psrScale: 6`) |
| Refine | `src/lib/shapeModel.js` `refineShape()` | PCA projection (K=6), pose-normalized, confidence-weighted, ±3σ |
| Quality gate | `src/lib/landmarkQuality.js` | PSR confidence + shape residual/Mahalanobis + edge guard → high/medium/low |
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

## 14. Quality-gate recalibration (Phase 1b)

### Why clean films were flagged

After the mirror fix landed, the next reported problem was that **many
non-mirrored cephalograms still show "Low-confidence trace"**. The banner listed:

- `1 of 29 landmarks have a weak heatmap response`
- `the traced configuration is anatomically atypical`
- `unusual shape fit`

The binding reason is the **shape-plausibility** check, not heatmap confidence.
Three defects in the Phase 1 gate:

1. **`residualRatio` measures anatomical *typicality*, not detection error.**
   The CEPHA29 prior's 10 components explain only **74.5%** of shape variance
   (`src/data/shapeModel.cepha29.json`, `n=700`), and `shapeResidual()` used only
   **K=6**, so ~25% of normal patient variation is orthogonal to the prior and
   lands in `residual`. The `0.12` cutoff came from a synthetic `sin/cos` jitter
   that happened to lie *inside* the subspace (ratio ≈0.03) and was never
   representative. Correct traces of atypical (but normal) anatomy were flagged.
2. **The Mahalanobis cutoff is statistically invalid.** `mahalanobis²` is a sum
   of K standardized squared coefficients, i.e. ≈ χ²_K in distribution. For K=6
   the median √χ²₆ ≈ **2.36** and p95 ≈ **3.55**; a cutoff of **2.5 flags ~half
   of all normal shapes**.
3. **A single soft landmark downgraded the whole trace.** `lowFraction > 0`
   forced at least "medium" and emitted the "1 of 29 weak" bullet, even though
   1/29 is far below the 25% limiter; verdict-driving and informational causes
   were mixed into one `reasons` list.

### Fixes (Phase 1b)

- `shapeResidual()` uses **all 10** prior components (refinement keeps K=6), so
  genuinely normal anatomy is not counted as residual.
- `src/lib/landmarkQuality.js`:
  - `reasons` (verdict-driving) split from `notes` (informational).
  - A small number of soft landmarks no longer forces a downgrade; gated by a
    new `mediumLowFraction`.
  - **Mahalanobis removed from the verdict entirely** — see the calibration
    result below; on real data it overlaps the failed cases.
  - `residualRatio` cut points set from the measured `valid` distribution.
- Dev-only diagnostics (`import.meta.env.DEV`): a `console.debug` of the quality
  object, per-landmark PSR/score, `residual`/`mahalanobis`/`K`, and hypothesis
  scores, so a flagged image can be triaged.

### Calibration result — CEPHA29 held-out `valid` (150 images)

`scripts/eval-landmark-model.py --report-ood` run against the shipped INT8 model
on the valid split (Kaggle notebook `scripts/train-cepha29/kaggle-calibrate.ipynb`;
raw output committed at `src/test/fixtures/cepha29-valid-ood.csv`).

| metric | min | p50 | p95 | p99 | max | mirrored/garbage |
| --- | --- | --- | --- | --- | --- | --- |
| `meanConfidence` | 0.636 | 0.733 | 0.753 | 0.760 | 0.767 | — |
| `lowFraction` | 0 | 0 | 0.069 | 0.103 | 0.103 | — |
| `residualRatio` | 0.024 | 0.045 | 0.509 | 0.580 | **0.587** | **≈1.03** |
| `mahalanobis` | 1.52 | 3.11 | 7.69 | 8.17 | **8.55** | **≈7.83** |

Two decisive findings:

1. **Confidence is uniformly high (~0.73).** The earlier synthetic estimate that
   real heatmaps would score low was wrong; `PSR_SCALE`/floor need no change. The
   confidence cuts sit far below the real population and never false-fire.
2. **Mahalanobis does not separate good from failed.** Valid spans 1.5–8.6 and
   the mirrored value is ≈7.8 — complete overlap. It is retained as a diagnostic
   only and no longer gates.

`residualRatio` is bimodal (half the valid images ≈0.04, half 0.2–0.59) because
it is measured on the **raw** prediction before the SSM refinement fixes it — so
it is a poor *error* estimate but still a valid *failure* detector: every valid
image stays below 0.587 while a shape that no hypothesis can explain lands ≈1.03.

Final `DEFAULT_QUALITY_THRESHOLDS`:

```js
lowLandmarkConfidence: 0.2,
mediumMeanConfidence: 0.55,   // valid min 0.636
minMeanConfidence: 0.4,       // valid min 0.636
maxLowFraction: 0.25,         // valid max 0.103
mediumLowFraction: 0.15,      // valid max 0.103
edgeMargin: 0.02,
mediumEdgeFraction: 0.1,
maxEdgeFraction: 0.2,
residualRatioMedium: 0.5,     // ≈ valid p95 — soft "verify"
residualRatioHigh: 0.7,       // > every valid (0.587), < mirrored (≈1.03)
```

Measured effect on the valid split: **0/150 rated "low" (0%)**, 9/150 (6%)
"medium" (all from the residual soft band), none from confidence or weak
landmarks. Locked in by `src/test/qualityCalibration.test.js`, which fails if the
cut points are ever tightened past this distribution.

### Calibration harness

`scripts/eval-landmark-model.py --report-ood` is implemented:

- `psr_noise_floor` / `psr_confidence` / `psr_confs` port the JS PSR (Gaussian
  extreme-value floor) exactly, measuring on the linearly-blurred plane at the
  DARK argmax — the same plane the browser uses.
- `shape_residual()` ports the JS `fitShape()` exactly (no-reflection
  similarity transform, full-prior K=10 fit). Verified against the JS on the
  shipped prior: mean → `0.0000 / 0.00`, mirrored → `1.0304 / 7.83`, and the
  Gaussian-σ PSR sweep matches to the printed decimal.
- Per image it reports per-landmark PSR, low fraction, `residualRatio`,
  `mahalanobis`; `--ood-out` writes a CSV. `print_ood_report()` prints
  percentiles and a copy-paste `DEFAULT_QUALITY_THRESHOLDS` block for a target
  false-low rate (`--ood-target`, default 5%).

Run it against the CEPHA29 validation set:

```
python scripts/eval-landmark-model.py \
  --model public/models/landmarks-cepha29.int8.onnx \
  --set cepha29 --limit 150 --dark \
  --ann-dir "<Dataset>/valid/Annotations/Cephalometric Landmarks/Senior Orthodontists" \
  --images "<Dataset>/valid/Cephalograms" \
  --report-ood --ood-out ood.csv
```

The Kaggle notebook `scripts/train-cepha29/kaggle-calibrate.ipynb` runs this
end-to-end (dataset download → model download → harness) and was used to produce
the result above.

Dataset layout (from `scripts/train-cepha29/kaggle-notebook.ipynb`):

- images: `DATASET/<split>/Cephalograms/*` (`valid` preferred for calibration)
- annotations: `DATASET/<split>/Annotations/Cephalometric Landmarks/<annotator>/*.json`,
  each JSON with `landmarks: [{ symbol, value: { x, y } }]`
- the shipped prior was built from the **Senior** annotator folder

**Clinical note:** an "atypical shape" is often real anatomy, not a failed
trace. The gate reserves "low" for configurations that are implausible
*as a cephalogram*, and never presents a merely-soft heatmap as a failure.

---

## 15. Milestones & rough effort

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
| 8b | **Phase 1b** — `shapeResidual` K=10, reasons/notes split, Mahalanobis dropped from gate, dev diagnostics | 1b | ✅ |
| 8c | **Phase 1b** — `--report-ood` + Kaggle calibration on CEPHA29 valid; retuned thresholds (0% false-low) | 1b | ✅ |
| 9 | Augmentation + fine-tune + export + eval | 2 | 3–7 d (+ GPU) |
| 9b | External validation + human inter-rater comparison | 2 | 2–4 d |
| 9c | Orientation head + visibility head | 2/3 | 2–4 d |
| 9d | Expand landmark vocabulary (§16.2 order-sync) | 2 | 3–7 d (+ annotation) |
| 10 | Uncertainty heads / OOD classifier | 3 | ≥1 wk |

**Phase 1 is ≈1–1.5 weeks** and fixes the two reported problems for most images
without touching the model. Phase 2 is the durable fix. See **§16** for the
concrete next steps (model improvement + adding landmarks).

---

## 16. Next steps — improving the model & adding landmarks

> Phase 1/1b are complete: the app handles orientation/polarity at runtime and the
> quality gate is calibrated on real data. Everything below is **model-side** work
> and is the next front. Ordered by return on effort.

### 16.1 Improving the model

1. **Fine-tune with the Phase 2 augmentations — the single biggest win.**
   The runtime hypothesis search papers over mirror/invert, but a model that has
   *seen* those transforms is strictly better (one forward pass, no shape-prior
   guesswork, higher accuracy on shifted distributions).
   - Add to CephaloHRNet `data/transforms.py`: horizontal flip (p≈0.5, `x → W−1−x`),
     polarity invert (p≈0.2, photometric), CLAHE (p≈0.3), mild gamma/JPEG.
   - **Fine-tune the existing 29-channel checkpoint** on the augmented set
     (≈30–50 epochs) rather than training from scratch — cheaper and preserves
     the current accuracy on in-distribution films.
   - Re-export static-QDQ INT8, rebuild the SSM prior, update the manifest
     (`version`, `sha256`), and re-run `--report-ood` to recalibrate the gate.
   - Expected outcome: mirrored/inverted films become "high" quality on the first
     pass; the hypothesis search remains as a safety net.
   - Caveat: flip augmentation erases inherent left/right semantics, so pair it
     with an **orientation head** (item 5) if the app must report true orientation.

2. **External validation — the number that actually matters.**
   All current metrics are Aariz-only. Acquire a second-source set (different
   machine, population, scanned film), compute per-landmark MRE/SDR, and compare
   against **human inter-rater error** (the clinical floor). Do not publish
   accuracy claims without this. Extend `eval-landmark-model.py` with the
   `--mirror/--invert/--clahe` stress flags (§9.4).

3. **Data quality and diversity.**
   - Average Junior + Senior annotations (already supported via `--annotators`);
     quantify the annotator disagreement as the target error floor.
   - Add scanned/inverted films and a second acquisition source.
   - Rebalance the hard landmarks (soft-tissue profile, occlusal points) — report
     per-landmark error and, if a few dominate, consider oversampling/weighted loss.

4. **Decoder / architecture.**
   - Keep DARK decoding (validated); re-test TTA only if the model changes.
   - Consider a higher-resolution or multi-scale head for the smallest landmarks.
   - A **visibility/confidence head** (Phase 3) would stop the model guessing
     cropped points; feed it into the quality gate as an extra signal.

5. **Orientation/polarity classifier head (recommended companion to flip aug).**
   A tiny binary head (normal vs mirrored) lets the app report the true
   orientation and removes the reliance on shape-residual ranking for that call.

6. **Loss.**
   AWing is in use. Evaluate AWing + heatmap MSE (or adaptive weighting) against
   per-landmark MRE/SDR; keep only if it improves the hard landmarks.

### 16.2 Adding new landmarks

Channel order is **load-bearing** — a mismatch was a past latent bug. Adding a
landmark means touching every place the vocabulary is defined, in lockstep:

1. **Decide the vocabulary first**: symbol (ASCII-safe, unique), app label,
   anatomical definition, and expected visibility. Get clinical sign-off.
2. **Annotate**: extend the dataset (Aariz is fixed at 29, so new points need a
   supplementary annotation pass or an additional dataset). Measure inter-rater
   error for the new points before trusting them.
3. **Expand the model head**: raise `--num-landmarks`; when fine-tuning, the new
   channels start from scratch (or initialize from a nearby point). Update
   `LANDMARK_SYMBOLS` in CephaloHRNet `data/dataset.py` — its order **is** the
   output-channel order.
4. **Synchronize the canonical order everywhere** (the checklist that prevents the
   old bug):
   - CephaloHRNet `data/dataset.py` `LANDMARK_SYMBOLS`
   - `src/data/landmarkMap.js` (order + symbol → app-label map)
   - `scripts/export-landmark-onnx.py`
   - `scripts/eval-landmark-model.py` (`CEPHA29` list)
   - `scripts/build-shape-model.py` (`CEPHA29` list)
   - the Kaggle notebook/README, and the landmark-order test in `src/test/`
5. **Rebuild the SSM prior** (`build-shape-model.py --set cepha29`) and check
   `explainedVariance` stays healthy with the larger shape vector.
6. **Map into analyses**: add the app labels to the relevant `PREDEFINED`
   analyses (`src/data/constants.js`) and the measurement definitions
   (`Data/AnalysisMeasurements.csv`). Auto-measurements only instantiate when all
   referenced landmarks are placed, so partial support is safe.
7. **Quality gate**: new landmarks get PSR confidence and shape-residual coverage
   automatically; **re-run `--report-ood`** on the new valid split to recalibrate
   the thresholds (the residual distribution changes with the shape vector).
8. **Verify**: run `export-landmark-onnx.py --verify` and confirm each labelled dot
   lands on the right anatomy; add a golden channel-order test.
9. **Version + rollout**: bump `version`/`sha256` in
   `src/data/landmarkModelInfo.js`; keep the previous model available so existing
   projects remain reproducible.

### 16.3 Landmark vs. computed point

Only add a model channel if the point is **anatomically distinct and must be
placed**. If it is derivable (midpoint, intersection, projection, perpendicular
foot), prefer an existing computed markup type — it is more accurate, costs no
annotation or training, and cannot drift with the model. The 23 markup types
already cover midpoints, projections, intersections, tangents, etc.

### 16.4 Suggested sequence

1. Fine-tune with augmentations + external validation (biggest robustness/accuracy).
2. Add the orientation head and visibility head.
3. Then expand the landmark vocabulary (with the full order-sync checklist), since
   it re-touches training, export, prior, analyses, and calibration.

---

## 17. Appendix — file map

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
