# Cephalometry Studio — Critical Review & Roadmap to Commercial Parity

> **Date:** 2026-10-24 · **Reviewed at:** `bdb378a` (main, clean tree)
> **Scope:** whole repository — research/statistics engine, clinical measurement layer, norms, interpretation, UI/UX, AI landmark pipeline (app + training scripts), storage/security, tests, docs.
> **Method:** code reading; the test suite and lint were run (**601/601 tests pass, lint clean**); every finding marked ✅ **Verified** was reproduced by running the repository's own modules in Node (scripts in [Appendix A](#appendix-a--reproduction-scripts)). The app itself was not driven in a browser; UI comments come from the code and the `Screenshots/` folder.
> **Nothing in the codebase was changed by this review.**
>
> **Update (Phase 0 done, uncommitted):** C1–C6 are fixed — `primaryMeasure()`, a patient-facing frame with signed geometry (Wits, E-line, convexity, ANB, AB-plane), and corrected McNamara/Ricketts/Downs/Jarabak definitions. A mean-skull plausibility scan also found and fixed reversed reference order in Steiner Occlusal-SN and U1-NA°, Downs occlusal plane, Björk ML-NSL/U1-NSL, Tweed FMIA, and Bimler/Lautrou interincisal. Norms are withheld for Kim ODI/APDI/CF and Björk U1-ML until they are properly sourced. See `CHANGELOG.md` → *Unreleased*. Still open from §2: the C7 synthesis layer and the SD audit (most SDs are still round numbers).
>
> **Update (Phase 1, uncommitted):** S1–S5 done (ICC forms/CIs, Bland-Altman pairing, REML mixed model on age, Welch/Games-Howell policy with subject pairing, stable-structure registration). Also fixed two bugs not in this review: `statsCore.normalCdf` computed Φ(x√2) and the studentized-range CDF was wrong, both making p-values too small. Added sample-size calculator and data preview. AI: A4/A5 done (review state, confidence display, no production demo fallback). Deliberately deferred while the model work continues: A1–A3 (worker/WebGPU, COOP/COEP, removing the hypothesis search), R-script export, and the norm-population audit.
>
> **Update (C/S close-out, uncommitted):** remaining C1–C7 and S1–S6 gaps closed — see `CHANGELOG.md`. Also fixed: Shapiro-Wilk (now AS R94, R-exact) and the normal-quantile tail sign. Still requires sourced data: population norm sets, published SDs for Steiner/Tweed, Kim ODI/APDI, Björk U1-ML.

---

## 0. Executive summary

Cephalometry Studio is unusually ambitious for a free, single-author, browser-only tool. It has 23 markup types, 40+ analyses, a research engine with seven study types, an in-browser ONNX landmark detector with an honest benchmark culture, encryption at rest, and 600 tests. On breadth it already beats several paid products, and nothing else free comes close.

**But breadth has outrun correctness.** This review found defects that make **most of the research module's numbers wrong for real data**, and several sign-convention errors that make the **clinical interpretation say the opposite of the truth** for common measurements. None of these is caught by the 601 tests, because the tests encode the same wrong assumptions.

### The ten things that matter most

| # | Finding | Severity | Area |
|---|---|---|---|
| 1 | Descriptive, Comparative, Longitudinal and Correlation studies analyze the **x-pixel coordinate of the first point** instead of the angle or length. Reliability mixes x, y and the measurement into one sample. | 🔴 Critical | Statistics |
| 2 | **Wits appraisal sign is inverted.** A Class II case reads negative and is interpreted as "Skeletal Class III". | 🔴 Critical | Clinical |
| 3 | **All perpendicular distances are unsigned** (E-line lips, Ricketts convexity, U1-NA mm, L1-APog mm, and others). Lips 2 mm *behind* the E-line read +2 and are called "protrusive". | 🔴 Critical | Clinical |
| 4 | **4-point angles are unsigned and order-dependent.** Signed norms (Downs AB-plane −4.6°, Downs convexity 0°) can never be matched correctly. | 🔴 High | Clinical |
| 5 | **McNamara analysis is defined incorrectly.** "N-A" is computed as the Nasion→A *length* (about 55 mm) against a 1 ± 2 mm norm, when it should be A to the Nasion-perpendicular. Pog-N-perp is missing, and Co-Pog stands in for Co-Gn. | 🔴 High | Clinical |
| 6 | ICC confidence intervals use the ICC(3,1) formula for every model. Average-measure and ICC(1) CIs are wrong. | 🟠 High | Statistics |
| 7 | The "LMM" uses HC0 *heteroskedasticity*-robust SEs while labelled *cluster*-robust. Time is coded as the index 0..k−1, ignoring real ages, and a value of exactly 0 is dropped as missing, which misaligns X and y. | 🟠 High | Statistics |
| 8 | AI inference runs on the **main thread**, single-threaded WASM, up to **4 forward passes** of a 768² HRNet. There is no WebGPU and no worker, and the UI freezes. | 🟠 High | AI / UX |
| 9 | Per-landmark AI confidence is computed but **never shown** on the canvas, never exported, and never tied to a "reviewed" state. | 🟠 High | AI / Safety |
| 10 | No DICOM/TIFF import, no patient database, no superimposition on stable structures, no VTO. These are table stakes in Dolphin, OnyxCeph, AudaxCeph and WebCeph. | 🟡 Medium | Parity |

**Recommendation:** put feature work on hold for one short "correctness sprint" (Phase 0, §8). Until then, put a visible banner on the Research module saying results may be invalid. If anyone has used it for a thesis or paper, they need to be told.

---

## 1. What is genuinely good (keep it)

Credit where due, so these are not lost in a rewrite:

- **Privacy-first, zero-backend architecture.** All computation runs locally, the autosave is AES-GCM encrypted with a non-extractable key, the CSP has no `unsafe-eval`, logging is PHI-safe, and there is a 90-day retention purge. This is a real differentiator against cloud-only competitors such as WebCeph and CephX.
- **Engineering discipline in the AI work.** Benchmarks are honest about cross-domain failure (`E0_isbi_400`), there is a failure taxonomy, the SSM was disabled when it hurt external accuracy, the worklog is detailed, and the model is SHA-256 pinned. Most commercial vendors publish less than this.
- **Statistical breadth.** Exact Mann-Whitney/Wilcoxon, DeLong, Box's M, Mauchly with orthonormal contrasts, a seeded PRNG for CV, golden-value tests against R, and a worker-based engine with progress.
- **Teaching value.** Landmark definitions, examples, guides and the startup wizard. As an *educational* tool this is already strong.
- **ID-based landmark linking** (`templateId`) is the right data-model direction.

---

## 2. 🔴 Critical correctness defects (verified)

### C1 — Research modules analyze coordinates, not measurements ✅ Verified

`computeMeasurements()` ([lib/utils.js:96-100](../src/lib/utils.js:96)) always emits `x` and `y` (the first point, **in raw pixels** even when `_unit === "mm"`) *before* the real measure (`angle`, `length`, …). Each research module then picks a value differently:

| Module | Selection logic | What actually gets analyzed |
|---|---|---|
| Comparative ([comparative.js:780-806](../src/research/comparative.js:780)) | first numeric key | **x pixel coordinate** of point 1 |
| Longitudinal ([longitudinal.js:375-388](../src/research/longitudinal.js:375)) | first numeric key | **x pixel coordinate** |
| Correlation / regression ([correlation.js:118-123](../src/research/correlation.js:118)) | first value in pivot | **x pixel coordinate** |
| Descriptive ([descriptive.js:277-305](../src/research/descriptive.js:277)) | *all* keys pooled | mean of {x, y, angle} mixed together |
| Reliability ([reliability.js:318-420](../src/research/reliability.js:318)) | all keys pooled by label; ICC uses the first row found | ICC on x; Bland-Altman/Dahlberg on pairs drawn across x, y and angle |
| Diagnostic ([diagnostic.js:448-454](../src/research/diagnostic.js:448)) | first non-x/y key | ✔ correct (the one module that handles it) |

Reproduction (Appendix A) with an `angle3` "SNA" whose true value is ≈86°:

```
descriptive mean SNA (true ~86): 367.5   n=72   unit "°"
longitudinal T1→T2 (true 80°→83°): 517.5 → 537.5        (x pixels)
reliability, angle identical on both occasions: ICC = 0, Dahlberg = 259 "°"
```

**Why 601 tests did not catch it:** every research test fixture uses `type: "point"` markups ([test/reliability.test.js:9](../src/test/reliability.test.js:9), [test/comparative.test.js:9](../src/test/comparative.test.js:9), …). For a point, `x` *is* the first key, so the tests assert the bug as correct behaviour.

**Fix:**
1. Add one function, `primaryMeasure(markup, cal) → { key, value, unit } | null`, with an explicit per-type mapping: angle3/angle4 → `angle`, line → `length`, perp → `distance`, projDist → `projectedDistance`, polygon → `area`, ratio/sum/… → `value`. Points have **no** primary measure and are excluded from scalar studies.
2. Make every research collector, `getMeasValue`, the CSV export and the report use it. Delete the five ad-hoc selectors.
3. Convert `x`/`y` to mm when calibrated, or rename them `xPx`/`yPx`.
4. Rewrite the research fixtures to use realistic `angle3`/`line`/`perp` markups. Add **end-to-end golden tests**: a synthetic cohort of markups → study result, compared against R output.
5. Add a **"data matrix preview"** step to every study (subject × variable table with units) before running. A user would have spotted 517 "°" instantly.

### C2 — Wits appraisal sign inverted ✅ Verified

`projectedDistance()` ([lib/utils.js:224-231](../src/lib/utils.js:224)) returns `tA − tB` along the APOcc→PPOcc direction, which points *posteriorly*. With A 2 mm ahead of B (Class II, Wits ≈ +2 mm) it returns **−2.0**. The interpretation rule ([interpretation.js:58-67](../src/lib/interpretation.js:58)) then says *"Skeletal Class III"*. **Fix:** `tB − tA`, or define the direction posterior→anterior, plus a test with a known Class II geometry.

### C3 — Perpendicular distances are unsigned ✅ Verified

`perpDist()` ([lib/utils.js:36-40](../src/lib/utils.js:36)) takes `Math.abs`. Every signed linear measure loses its sign:

- Ricketts **E-line** (norm −2 mm): lips 2 mm *behind* read +2 → "Upper lip is protrusive". Most normal patients get flagged.
- Ricketts **convexity** (A to N-Pog): a concave (Class III) profile reads as convex.
- **U1-NA mm, L1-NB mm, L1-APog mm, Holdaway, Burstone, S-line**: all lose the anterior/posterior meaning.

**Fix:** a signed distance whose sign comes from the **patient-facing direction** (see C5), not from the image axes. Store a convention per measure ("positive = anterior to the reference line").

### C4 — 4-point angles unsigned and point-order dependent

`angle4pt()` ([lib/utils.js:30-34](../src/lib/utils.js:30)) returns `|atan2|` ∈ [0°, 180°] between *directed* vectors. So:
- Signed norms can never be matched: Downs AB-plane (−4.6°), Downs angle of convexity (0 ± 5°), SN-Occ in some conventions, cant angles.
- Whether you get θ or 180−θ depends on the order the refs were authored in the CSV. It happens to be right for FMA, IMPA and the interincisal angle as written today, but there is no test guarding it.

`angle3pt` is also absolute. ANB is special-cased to be signed ([utils.js:105-108](../src/lib/utils.js:105)), but **its sign depends on image orientation** (C5).

### C5 — No notion of patient-facing direction

Nothing in the measurement layer knows whether the profile faces left or right. Signed ANB, and any future signed distances, flip sign on a mirrored film. The AI detector already estimates `orientation: "normal" | "mirrored"` ([landmarkDetector.js:296](../src/canvas/landmarkDetector.js:296)). **Fix:** store `session.facing` (from the AI result, or derived from S→N and N→Pog geometry, or a manual toggle) and compute every signed measure in a patient-anatomical frame (x+ = anterior, y+ = superior).

### C6 — McNamara and Ricketts definitions are wrong

From [Data/AnalysisMeasurements.csv](../Data/AnalysisMeasurements.csv) and [data/norms.js](../src/data/norms.js):

| Measure | Current definition | Correct (per McNamara 1984 / Ricketts) |
|---|---|---|
| McNamara "N-A" | Distance N→A (≈55 mm) vs norm 1 ± 2 | Signed distance **A to Nasion-perpendicular** (⊥ FH through N): 0 mm (child) / +1 mm (adult) |
| McNamara "N-B" | Distance N→B vs 4 ± 3 | Not a McNamara measure. Use **Pog to N-perp**: −8 to −6 mm (child), −2 to +4 mm (adult) |
| McNamara "Co-Pog" | Co→Pog 130 ± 5 | **Co-Gn**, interpreted through the Co-A ↔ Co-Gn **size-matched table**, not a single mean |
| McNamara "Maxillary depth", "ANB", "A-N" | in `DEFAULT_NORMS.McNamara` | Ricketts/Steiner measures; "A-N" duplicates "N-A" |
| McNamara U1 | U1 to **NA line** | U1 to **A-vertical** (parallel to N-perp), 4–6 mm |
| Ricketts "Mandibular arc" | angle3 refs `Xi,PM,DC` → vertex **PM** | Angle between DC-Xi and Xi-PM, vertex **Xi**, reported as 26 ± 4° (supplement of the inner angle) |
| Björk-Jarabak | — | Missing the **Jarabak ratio** S-Go/N-Me (62–65 %), the analysis's headline value |

**Norm hygiene in general:**
- Many SDs are **invented round numbers.** Steiner never published SDs; using SD = 2° for U1-NA makes nearly every patient "abnormal".
- Several norms are labelled `source: "Estimated"` (Hyoid-C3, Mandibular-Body, Min-CSA), and they still drive z-scores and colour coding.
- "Min-CSA from a circular model" turns a 2D AP width into a 3D area. That is not valid; the lateral dimension is unknown.
- **Only Caucasian norms ship.** For a tool used in Egypt and the wider region, add published Egyptian/Arab, Chinese, Japanese, Korean, Indian, Nigerian and African-American norms with full citations.
- **Fix:** make every norm row carry `{source (DOI), population, n, age range, sex, mean, sd, sdIsEstimated}`. Refuse z-scores when `sdIsEstimated`, or flag them clearly. Have a second orthodontist audit the table.

### C7 — Interpretation engine weaknesses

- The ANB rule hard-codes `sd = 2` ([interpretation.js:31](../src/lib/interpretation.js:31)) and ignores the selected norm's SD.
- Rules are per-measure; there is no **synthesis.** Commercial reports say "Class II due to mandibular retrognathism, with dentoalveolar compensation (proclined L1)". This one lists 30 independent sentences. Add a small rule layer that combines SNA/SNB/ANB/Wits/APDI for sagittal, FMA/SN-MP/Jarabak/LAFH for vertical, and incisor compensation.
- When two analyses disagree (ANB Class I, Wits Class II), the user is not told. Detect and explain the disagreement, for example a rotated SN plane.

---

## 3. 🟠 Statistical methodology issues

(These matter once C1 is fixed.)

### S1 — ICC ([reliability.js:49-130](../src/research/reliability.js:49))
- **CI formula.** `(F_L − 1)/(F_L + k − 1)` is the exact CI for ICC(3,1)/ICC(1,1) only. For **ICC(2,1)** (the default) the McGraw & Wong CI needs the Satterthwaite-approximated F involving MSC. The current interval is too narrow whenever there is systematic rater bias, which is exactly when it matters.
- **ICC(1):** the F statistic should be MSR/MSW, not MSR/MSE.
- **Average-measure ICC(·,k):** the CI should be `1 − 1/F_L`, but the code applies the single-measure form with `kActual`.
- **Missing data:** residuals `v − rowMean − colMean + grand` with unadjusted `dfE` are not a valid two-way ANOVA for unbalanced data. Use complete cases (and say so) or fit a variance-components model.
- **Reporting:** follow Koo & Li (2016). Name the model/type/definition ("two-way random, absolute agreement, single rater"), and let the user pick consistency vs absolute agreement.

### S2 — Bland-Altman / Dahlberg
- With 3+ occasions, *all pairs* are pooled. That is not the Bland-Altman (2007) repeated-measures method, and the √(pairs per case) "VIF" is ad hoc. Use the proper within-subject variance approach.
- LoA are computed as a **prediction interval** (`t·√(1+1/n)`). That is defensible, but it differs from what literature reports. Label it, and offer the classic ±1.96 SD.
- **Inter-rater ≠ intra-rater:** the BA sample doesn't separate operator from occasion. In a mixed design the pairs mix both sources of error.
- CV% = SEM/mean is meaningless for measures near 0 (ANB, Wits, E-line). Suppress it for those.

### S3 — "Linear mixed model" ([longitudinal.js:260-370](../src/research/longitudinal.js:260))
- The "cluster-robust" meat sums `x_i x_iᵀ e_i²` **per observation**. That is White's HC0, which does **not** account for within-subject correlation. Real CR0 sums `(Σ_{j∈i} x_j e_j)(…)ᵀ` per subject.
- `row[tp] || null` treats a value of **0 as missing** for `y` while `X` uses `!= null`. The arrays misalign and the regression is silently wrong.
- **Time is the index 0..k−1.** Growth studies have unequal intervals (9 y, 11 y, 16 y), and age, not visit number, is the covariate. Use `session.meta.age` or the visit date.
- τ² = var(subject means) − σ²/k, where σ² is the pooled OLS residual (which already contains τ²). The ICC is biased.
- **Recommendation:** either implement a real random-intercept/slope REML (EM or Newton on the profiled likelihood is a few hundred lines for this 2-parameter fixed-effect case), or run real `lme4` in-browser through **webR** for the longitudinal module. webR also makes "reproduce in R" one click.

### S4 — Comparative test selection ([comparative.js:691-777](../src/research/comparative.js:691))
- **Two-stage testing** (Shapiro-Wilk → choose a t-test or Mann-Whitney) inflates the type-I error and is discouraged (Rochon et al. 2012; Zimmerman 2004). Default to **Welch's t / Welch ANOVA + Games-Howell**, let the user *pre-specify* the test, and offer the rank-based test as a sensitivity analysis.
- **Paired designs pair by array index.** If one session lacks a markup, every later pair is misaligned, and the equal-length check passes whenever two sessions miss one each. Pair by subject ID.
- When variances are unequal, Kruskal-Wallis is used as the fallback. KW doesn't test means under heteroscedasticity; use Welch ANOVA.

### S5 — Superimposition ([superimposition.js](../src/research/superimposition.js))
- The default **Procrustes alignment includes scaling across all landmarks.** For growth that **removes the growth you want to measure** and smears change across stable and growing regions (the "Pinocchio effect"). Clinical superimposition registers on **stable structures**: anterior cranial base (Björk/SN at S, or Ricketts Ba-N at CC), maxillary (ANS-PNS at ANS / best fit on palatal structures) and mandibular (symphysis/canal, Björk structures). Make these named presets, rotation+translation only, and drop scaling.
- `computeAngularChanges` uses unsigned `angle3pt` (ANB sign lost). `computeLinearChanges` includes the x/y coordinate keys and labels angle keys with mm/px units.

### S6 — Smaller items
- `normalCdf` uses Abramowitz-Stegun 7.1.26 (absolute error ≈ 1.5e-7), so p < 1e-6 is unreliable. Use a high-precision erfc.
- Duplicated helpers (`tCritical`, `normalCdf`, `bonferroniAdjust`, `mean`, `variance`) still exist in 4–5 files. Finish the `statsCore` consolidation.
- There is **no power / sample-size calculator.** For a student-facing research tool this is high value and cheap: ICC (Walter 1998), paired/independent t, Bland-Altman (Lu 2016).
- The parametric reference interval uses `1/n + z²/(2n)`; the standard SE uses `2(n−1)`.

---

## 4. 🤖 AI integration

### 4.1 Where it stands
- CEPHA29 HRNet-W32 trained on Aariz only. In-domain SDR@2 ≈ 83 %, MRE ≈ 1.24 mm.
- External ISBI-2015 benchmark: **raw SDR@2 ≈ 50.6 %, median ≈ 1.97 mm**, with catastrophic tails (UL mean 12–27 mm, worst images 25–37 mm mean error).
- For orientation: published ISBI-2015 results are roughly 1.0–1.3 mm MRE and ~85–90 % SDR@2 mm, and expert inter-observer variability is roughly 1–2 mm depending on the landmark. Commercial tools advertise in-domain numbers. **Cross-domain robustness is what users actually experience**, and that is the gap.

### 4.2 Runtime and integration problems

| # | Issue | Fix |
|---|---|---|
| A1 | Inference on the **main thread** ([landmarkDetector.js](../src/canvas/landmarkDetector.js)), `numThreads = 1`, `proxy = false`. Up to 4 hypotheses means 4 forward passes. | Move to a **dedicated Web Worker**. Try the **WebGPU EP** first and fall back to WASM. |
| A2 | No `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers in [vercel.json](../vercel.json), so `crossOriginIsolated` is false and **multi-threaded WASM is impossible**. | Add `COOP: same-origin` and `COEP: require-corp` (or `credentialless`). Check that HF fetches still pass CORS. |
| A3 | The 4-way orientation/polarity hypothesis search compensates for a model that never saw flips or inversions. It costs up to 4× latency. | **Train with those augmentations** and keep one cheap orientation classifier (or the SSM residual) as a guard. |
| A4 | `aiConfidence` is stored on the point but **never rendered, exported or reported** (only read at [App.jsx:4403](../src/App.jsx:4403)). | Colour or size each AI point by confidence and draw an uncertainty ellipse. Add a per-point **"reviewed" state** (cleared when the AI places a point, set when the user confirms or drags it). Block "final report" until low-confidence points are reviewed. Write `aiPlaced/aiConfidence/reviewed` to CSV and PDF provenance. |
| A5 | The mock/demo detector ships in production. `_readyPromise` caches a failure **forever**, so one failed HF download means demo placements for the rest of the session ([autoTrace.js](../src/workspace/autoTrace.js)). | Make the demo detector dev-only. Retry with backoff, show a clear "model unavailable" error, and never place synthetic points in production. |
| A6 | No **service worker**, so the PWA is not offline-capable. The model sits in Cache Storage, but the app shell is not. | Add a Workbox/Vite PWA service worker. Precache the shell and the ORT wasm; cache the model at runtime. |
| A7 | The model is 30 MB INT8 downloaded on first use, with no progress-aware UX on slow connections. | Show size and ETA. Consider a smaller distilled model (HRNet-W18 or a lite variant) as the "fast" default, with W32 as "accurate". |

### 4.3 Model and training: what will close the gap

1. **Don't collapse to 19 landmarks.** The current multi-domain plan (`kaggle-multidomain.ipynb`) re-heads the network to the 19 ISBI∩Aariz landmarks, which drops 10 landmarks the app's analyses need (R, LPM, UPM, soft tissue, …). Instead, train on the **union** with **partial-label (masked) loss**: each dataset supervises only the landmarks it annotates, through one shared head over the union vocabulary.
2. **Add datasets.** **ISBI 2023 CL-Detection** (≈600 images, 38 landmarks, 3 centres and devices) is the most valuable multi-vendor set. Also the ISBI 2015 train split, the PKU cephalogram set, and Aariz. Keep one **whole centre held out** as the external test. Never tune on it.
3. **Augmentation for domain robustness:** horizontal flip, intensity inversion, gamma, CLAHE on/off, blur/sharpen, Poisson/Gaussian noise, JPEG artefacts, random collimation/cut-out, scale ±15 %, rotation ±10°, and simulated film burn-out. These target the failures in `failure_taxonomy.md`.
4. **Coarse-to-fine.** The 768² input with a stride-4 heatmap gives roughly 1–1.2 mm per heatmap cell on a typical 2400 px film. A **second-stage ROI refiner** (e.g. 128–192 px native-resolution crops around each coarse prediction, run as one batched call) is the standard route to sub-millimetre accuracy, and it is what top CL-Detection entries do.
5. **Calibrated uncertainty.** Use a small ensemble (or test-time dropout) plus heatmap spread, then **conformal prediction** on a held-out set: "with 90 % coverage the true landmark is within r mm". That turns confidence into a radius a clinician understands, and it drives A4.
6. **Evaluate what clinicians use.** Besides MRE/SDR, report **measurement-level error** (SNA, ANB, Wits, FMA, IMPA, E-line) as Bland-Altman/ICC versus the expert, plus **classification agreement** (Cohen's κ for skeletal class and vertical pattern). The app's own reliability module, once C1/S1 are fixed, can produce this table, which makes for a good paper.
7. **Auxiliary models that commercial tools have:**
   - **Ruler/scale detection** for automatic px/mm (removes the most common error source).
   - **Contour segmentation** (mandible, maxilla, incisors, soft-tissue profile, airway) to auto-place the silhouettes. Today they are manual.
   - **CVM stage classifier** from C2–C4 (Baccetti CS1–CS6).
   - **Image QA:** facing direction, double mandibular borders (head rotation), exposure problems. These gate trust.
8. **Human-in-the-loop data flywheel.** Opt-in, anonymized export of *corrections* (AI point vs user point) in Aariz/CL-Detection JSON format. Over time this becomes the most domain-diverse dataset available.
9. **Governance.** Publish a **model card** (data, licence, intended use, subgroup performance by device/centre/age), and freeze splits and seeds with the eval JSON next to the weights. **Check dataset licences before distributing weights:** some cephalometric datasets are research-only or non-commercial, and that propagates to the weights.

---

## 5. 🎨 UI/UX

### 5.1 Workspace
- **Icon-only interfaces everywhere:** 24 tool icons, 12 sidebar tabs and ~15 top-bar icons with no visible labels (`Screenshots/2-canvas.png`). Commercial tools use a few *task modes* (**Trace → Analyze → Compare → Report**) and show only the tools for the current mode. Add text labels or rich tooltips with shortcuts, and collapse rarely used tools (concentric, tangent, ratio, percentage…) into an "Advanced" drawer.
- **Guided tracing should be the default path.** For each landmark show: a reference thumbnail with the landmark highlighted, the definition, a **magnifier loupe** at the cursor, local contrast boost, auto-advance, and a "skip / unsure" option. The data (definitions, examples) already exists; it needs to be the main flow.
- **Label clutter** (`Screenshots/4-interpretation.png`): measurement labels overlap in the incisor region. Add collision avoidance, leader lines, and "show labels for the selected analysis only".
- **35 native `alert()/confirm()/prompt()` calls.** Replace them with in-app toasts and modals. Prefer *undo* to *confirm* for destructive actions.
- **Typography and accessibility:** 664 inline `fontSize` values of 9–10 px. Set a 12 px floor for body text, check contrast on `tx3` greys, give the context menu keyboard support (R13), and route all dialogs through the accessible `Modal.jsx` (R14).
- **Mobile:** canvas tracing on a phone is a niche case. Prioritize tablet + stylus (iPad and Android tablets are common in clinics) with pressure-free precise placement and a loupe.

### 5.2 Information architecture
- **Patient-centric home.** Today it shows projection cards plus "Recent Cases". Commercial apps open on a **patient list** (search, filters, tags) → patient → timeline of studies (T0/T1/T2, photos, cephs, CBCT later). The data model (projects → sessions) supports this already; it needs the UI.
- **One-click sample case** on the home page for first-time users and teaching.
- **Research workflow:** a study wizard (design → variables → data preview → assumptions → results → export). Include an **"Export tidy CSV + R script"** button so results can be reproduced in R/SPSS. That is a strong credibility signal for reviewers and supervisors.
- **Report designer:** clinic logo/header, choice of analyses, tracing overlay, normogram/wiggle chart, AI provenance, and a signature line. Export PDF and DOCX.
- **i18n with RTL.** Arabic is the obvious first target given the author's context, then Spanish, Portuguese, Turkish, Chinese. Wrap strings now; retrofitting a 6,000-line component later is harder.

### 5.3 Performance
- Every frame redraws everything (R6) and hit-testing is O(N) (R7). Cache the static layer on an offscreen canvas.
- The main JS chunk is **2.95 MB** (plus Plotly 1.08 MB and the worker 0.8 MB). Lazy-load the research module, report generator, mathjs and KaTeX.

---

## 6. 🏗️ Platform, data and engineering

| Area | Finding | Recommendation |
|---|---|---|
| Architecture | `App.jsx` is 6,324 lines; the `Workspace` component alone spans lines 1250–5720 with ~185 hook calls. | Extract `useCanvasInteraction`, `useAutoTrace`, `useProjectPersistence` and the modal hosts. Target < 800 lines per file. |
| Data model | Measurements are identified by **label strings**. Sign conventions, units and reference frames are implicit. | A **measurement registry**: `{id, label, type, refs (templateIds), formula, sign convention, unit, frame, normIds}`. C1–C6 all come from not having one. |
| Types | No TypeScript. The markup model is a loose object. | JSDoc `@typedef` + `checkJs`, or migrate `lib/`, `research/` and `workspace/` to TS first. Typed `primaryMeasure` would have prevented C1. |
| Storage | The whole project list is **JSON in one localStorage key** (≈5 MB cap). Images in IndexedDB are **not encrypted** (only the localStorage blob is). | Move everything to IndexedDB (or OPFS) and encrypt image blobs with the same key. Add file-system export/backup and a quota UI. |
| Imaging | `accept="image/*"` only: **no DICOM, no TIFF, no 16-bit.** | Add DICOM via a small parser (dcmjs / dicom-parser + a JPEG-LS/JPEG2000 wasm decoder). Read `PixelSpacing` / `ImagerPixelSpacing` for automatic calibration (F2), and window 12/16-bit data properly. Add TIFF via UTIF.js. |
| Calibration | Single ruler px/mm; magnification is only a warning. | Add a **magnification factor** field (source–midsagittal / source–detector), DICOM spacing, and ruler auto-detect. Store calibration provenance in the report. |
| Privacy | Google Fonts are loaded from Google's CDN (an IP leak, and a GDPR issue in some jurisdictions). | Self-host the fonts. |
| Offline | Manifest present, no service worker (A6). | Add one. |
| Repo hygiene | The tracked Office lock file `Data/~$LateralCeph.xlsx`; 7 overlapping review/audit docs in `docs/` with partly contradictory status; `AGENTS.md` is stale (says 510 tests, the real count is 601; says KaTeX loads from a CDN, but it is bundled; line counts are outdated). | Delete the lock file. Keep **one** living `docs/STATUS.md`, move the historical audits to `docs/archive/`, and regenerate the AGENTS.md numbers in CI. |
| Testing | Fixtures are unrealistic (points only); there are no end-to-end pipeline tests and no UI interaction tests. | Golden pipeline tests (markups → study → numbers vs R); property tests for sign conventions under mirror, rotation and translation; and Playwright smoke tests for trace → analyze → report. |

---

## 7. Feature parity matrix (vs commercial)

| Capability | Dolphin / OnyxCeph / AudaxCeph / WebCeph (typical) | Cephalometry Studio today | Gap |
|---|---|---|---|
| DICOM / TIFF / 16-bit import, auto-calibration | ✔ | ✘ | **High** |
| Patient database, timeline | ✔ | Partial (projects/sessions) | High |
| AI auto-trace with editable points | ✔ (WebCeph/CephX in cloud) | ✔ local | Accuracy/robustness + UX |
| AI contour tracing (bone + soft tissue outlines) | ✔ | Manual silhouettes | High |
| Superimposition on stable structures (SN@S, palatal, mandibular) | ✔ | Procrustes / 2-point | High (S5) |
| VTO / STO, treatment simulation, photo-ceph morphing | ✔ (Dolphin, Nemo) | ✘ | Medium–High |
| CVM / skeletal maturity | ✔ | Manual template | Medium (AI classifier) |
| Reports (branded, configurable) | ✔ | PDF/DOCX basic | Medium |
| Multilingual | ✔ | English only | Medium |
| CBCT / 3D | ✔ (most) | ✘ | Long-term |
| **Research statistics** | ✘ (export only) | ✔ broad | **Your differentiator — make it correct** |
| **Free, open-source, local/private** | ✘ | ✔ | Differentiator |

**Positioning advice:** don't try to out-Dolphin Dolphin on VTO and CBCT in the near term. Win where they cannot: the **free, private, auditable, research-grade** cephalometry platform with validated statistics and a transparent AI model card. That requires the correctness work first.

---

## 8. Roadmap

### Phase 0 — Correctness sprint (1–2 weeks) 🔴
1. Add `primaryMeasure()` and route all research collectors, the CSV export and the report through it (C1).
2. Signed geometry: a patient-frame transform from `session.facing`, signed `perpDist`, signed and order-independent `angle4pt`, fix the Wits sign (C2–C5).
3. Fix the McNamara, Ricketts mandibular arc and Jarabak definitions. Flag estimated SDs (C6).
4. Rewrite the research fixtures with realistic markups. Add mirror-invariance property tests and 3–5 golden end-to-end studies checked against R.
5. Add a banner and changelog entry: "Research results generated before vX.Y are invalid — re-run."

### Phase 1 — Statistics and safety (4–6 weeks) 🟠
6. ICC CIs per model (McGraw & Wong), Koo & Li reporting, proper missing-data handling (S1). Repeated-measures Bland-Altman (S2).
7. Real mixed model (REML) or webR for longitudinal; time = age (S3).
8. Pre-specified tests, Welch default, subject-ID pairing (S4). Stable-structure superimposition presets (S5).
9. Power/sample-size calculator; data-matrix preview; "export R script".
10. AI: worker + WebGPU, COOP/COEP, per-point confidence and reviewed state, no mock in production (A1, A2, A4, A5).
11. Norm table audit with DOIs and populations; add non-Caucasian norm sets.

### Phase 2 — AI robustness and clinical UX (2–4 months) 🟡
12. Union-vocabulary partial-label training on Aariz + ISBI 2015 + CL-Detection 2023 with heavy augmentation; drop the 4-way hypothesis search (A3, §4.3).
13. Coarse-to-fine refinement stage; conformal uncertainty radius.
14. Measurement-level validation paper (AI vs 2 experts on held-out centres), model card.
15. DICOM/TIFF import + automatic calibration; ruler detection model.
16. Guided tracing with loupe and reference thumbnails; task modes; label decluttering; replace native dialogs.
17. IndexedDB-only encrypted storage; service worker; self-hosted fonts.

### Phase 3 — Differentiators and parity (4–8 months) 🔵
18. AI contour tracing (mandible, maxilla, incisors, soft tissue, airway) → automatic silhouettes.
19. CVM classifier; airway segmentation.
20. Patient-centric home and timeline; branded report designer.
21. i18n (Arabic RTL first).
22. VTO/STO basics (incisor/jaw repositioning with soft-tissue ratios); photo overlay.
23. Plugin format for community analyses and norms (`.cepht` + measurement registry + rules).

### Definition of "on par" (measurable)
- External-centre SDR@2 mm ≥ 80 % and MRE ≤ 1.5 mm on a held-out vendor; measurement-level ICC ≥ 0.90 vs experts for SNA/SNB/ANB/FMA/IMPA; skeletal-class κ ≥ 0.8.
- Trace-to-report time for a reviewed AI trace < 3 min.
- Every research result reproducible in R from the exported CSV + script, to 1e-6.
- Zero sign or definition errors under a mirror/rotation property-test suite covering every predefined measurement.

---

## 9. Phase 2/3 implementation plan (2026-10-27)

Phases 0 and 1 are done. This section says how each Phase 2/3 item would be built in this codebase and what it costs: effort, compute, data and risk. Effort assumes one developer working with an AI assistant.

### 9.1 Status before starting
- **Done:**
  - **Item 16:** guided tracing, task modes, label decluttering and in-app dialogs (B1–B6).
  - **Item 20 (most of it):** the patient-centred home (C1). Most of the report designer also landed with the PDF report work: clinic logo and name, section choice, session comparison, preview, light/dark themes, bookmarks.
- **Still open from Phase 1, item 10** (deferred on purpose while the model is being trained):
  - Inference runs on the main thread (`numThreads = 1`, WASM only, no worker or WebGPU).
  - `vercel.json` has no COOP/COEP headers.
  - The demo detector still ships in production.
  - Items 12 and 13 depend on the worker, because a second refinement model would double the main-thread freeze.

### 9.2 Phase 2

#### 12. Union-vocabulary partial-label training; drop the 4-way hypothesis search
**How:**
1. **Union vocabulary:** extend `scripts/ai/canonical.py` to cover Aariz (29), ISBI 2015 (19), CL-Detection 2023 (38) and PKU. Every landmark the app's analyses use stays in it, unlike the 19-landmark plan in `kaggle-multidomain.ipynb`.
2. **Partial-label loss:** each sample carries a per-landmark mask, and the heatmap loss is multiplied by it and normalised by the mask sum. Each dataset supervises only the landmarks it annotates.
3. **Augmentation:** flip, intensity inversion, gamma, CLAHE, noise, JPEG artefacts, cut-out, ±15 % scale, ±10° rotation, burn-out. Flip and inversion are what make the 4-way search unnecessary.
4. **External test:** hold out one whole centre (e.g. one CL-Detection vendor) and never tune on it.
5. **App side:**
   - a new `union` set in `data/landmarkMap.js`;
   - shape-model prior via `build-shape-model.py --set union`;
   - a new manifest entry in `data/landmarkModelInfo.js`.
   - Remove the 4-way search only after the held-out test shows flips and inversions are handled.

**Burden: high, mostly compute and data.**
- **Compute:** about 15–25 GPU-hours on Kaggle (≈30 h/week quota, 9 h sessions, checkpoint resume), so 2–4 weeks of sessions.
- **Licences:** CL-Detection and some ISBI/PKU terms are non-commercial research. That carries over to the weights and must appear in the model card.
- **Code:** about 1 week for the training script and 3–4 days for app integration.

#### 13. Coarse-to-fine refinement; conformal uncertainty radius
**How:**
- **Refiner:**
  - A small second network on 160 px full-resolution crops around each first-pass point, all 29 as one batch (`[29,1,160,160]`), predicting a correction.
  - Train on crops with random offsets of ±3 mm.
  - In the app, crop from the original image (the `getImagePixels` path) and map the corrections back.
- **Conformal radius:**
  - On a held-out calibration set, take the 90th percentile per landmark of error ÷ heatmap spread.
  - Ship that table in the model manifest and draw a radius of *q × spread* (mm) on each AI point, using the Phase 1 review-state UI.
  - `scripts/train-cepha29/kaggle-calibrate.ipynb` is the starting point.

**Burden: medium–high, about 3–4 weeks.**
- **Model size:** the INT8 refiner adds about 10–15 MB, so the download needs progress feedback.
- **Ordering:** worth doing only after item 12 has fixed cross-domain robustness.

#### 14. Measurement-level validation; model card
**How:**
1. **Expert tracings:** two experts trace about 100–150 held-out-centre images; one of them traces the set twice for intra-rater agreement. They work in the app's blinded reliability workflow.
2. **AI vs expert:** the Reliability module gives ICC, Bland-Altman and Dahlberg on SNA, SNB, ANB, FMA, IMPA, Wits and E-line.
3. **Class agreement:** add Cohen's κ for skeletal class and vertical pattern.
4. **Model card:** a script writes data, licences, splits, seeds and per-centre and per-landmark errors next to the weights.

**Burden: mostly human time.**
- **Expert hours:** about 10–15 min per image × 150 images × 3 tracings ≈ 80–110 expert hours.
- **Ethics:** approval is needed if any images are new.
- **Code:** about 1 week.

#### 15. DICOM/TIFF import, automatic calibration, ruler detection
**Done 2026-10-30** (see CHANGELOG): DICOM (incl. JPEG-LS/2000, RLE, JPEG Lossless), TIFF, calibration from pixel spacing with magnification provenance, window/level on the original 12–16-bit data, semi-automatic tick detection. Still to test with real vendor files (Carestream, Planmeca, Sirona); 12-bit JPEG Extended and multi-frame are not supported.

**How:**
- **DICOM:**
  - Parse with `dicom-parser`. Compressed files need lazy-loaded WASM decoders: CharLS for JPEG-LS and OpenJPEG for JPEG 2000 (~1 MB, loaded only when needed).
  - Read `PixelSpacing`, `ImagerPixelSpacing` and `EstimatedRadiographicMagnificationFactor` into a calibration with provenance (method "DICOM"). The report's `calibrationStatement` reports it.
- **TIFF:** UTIF.js.
- **12/16-bit:** the image path (`canvas/imageUtils.jsx`, the processing worker, redraw, report capture) assumes 8-bit.
  - Keep the raw 16-bit pixels, add window/level controls to the Image panel, and generate 8-bit for display.
  - AI preprocessing reads the windowed image.
- **Ruler:** there is almost no public labelled data for a learned model. Make it semi-automatic instead: the user drags roughly along the ruler and the tick period is found with a Fourier transform along that line.

**Burden:**
- **DICOM + 8-bit TIFF:** about 2 weeks.
- **16-bit pipeline:** another 2–3 weeks. Many touch points, and larger originals in IndexedDB.
- **Ruler:** a few days for the semi-automatic version.
- **Testing:** needs real files from 2–3 vendors (Carestream, Planmeca, Sirona).

#### 16. Guided tracing, task modes, decluttering, dialogs
Done (B1–B6).

#### 17. Encrypted IndexedDB storage; service worker; self-hosted fonts
- **Fonts:**
  - Copy the DM Sans, DM Mono and Syne woff2 files into `public/fonts`, remove the Google links from `index.html`, and tighten the CSP.
  - Required before COOP/COEP, which would block Google Fonts.
  - **Half a day.**
- **Service worker** (`vite-plugin-pwa`):
  - Precache the app shell and the ONNX runtime WASM (~11 MB); leave the model in `storage/modelCache.js`'s cache rather than storing it twice.
  - Show a "new version available, reload" toast.
  - **Risk:** a stale build if updates are mishandled.
  - **2–4 days.**
- **Storage** (done 2026-10-30 — `storage/projectStore.js`, see CHANGELOG):
  - Move the project JSON from localStorage (≈5 MB cap) to IndexedDB.
  - Encrypt image blobs with the existing non-extractable AES-GCM key.
  - One-time migration that keeps the old copy until the new one reads back, plus export/backup.
  - **1–2 weeks. The highest-risk Phase 2 item (patient-data loss)**, so it needs migration tests.

### 9.3 Phase 3

#### 18. AI contour tracing → automatic silhouettes
- **Cheap first step** (about 1–2 weeks): warp the existing `data/silhouettes.js` templates onto the detected landmarks with a thin-plate spline. This gives approximate mandible, maxilla, incisor and profile outlines straight away.
- **True segmentation** (U-Net-style, per structure): needs about 300–500 hand-traced images because no suitable public contour dataset exists. Defer it until the correction flywheel (§4.3 item 8) supplies data.

#### 19. CVM classifier; airway segmentation
- **CVM:**
  - Aariz includes CVM stage labels. Crop C2–C4 using the detected landmarks and train a small CS1–CS6 classifier on Kaggle.
  - Literature accuracy is about 70–80 % for the exact stage, much higher within one stage, so present it as a suggestion with confidence.
  - **About 2–3 weeks.**
- **Airway:** extend the traced walls (`tracedBoundaries`) with intensity-based edge snapping (an active contour started from the airway landmarks) rather than a learned model. **About 1–2 weeks, low risk.**

#### 20. Patient home and report designer
Patient home done (C1). Report designer remainder:
- section reordering;
- a signature/date line;
- saved report presets;
- bringing the Word export in line with the PDF.

**About 1 week.**

#### 21. i18n (Arabic RTL first)
**How:**
- A small translation function with JSON dictionaries (or i18next); extract every user-facing string.
- Convert the many inline `marginLeft` / `left` / `paddingRight` styles to logical properties (`marginInlineStart`, `insetInlineStart`).
- Keep the canvas, numbers, formulas and measurement labels left-to-right. The PDF already renders Arabic (Amiri).

**Burden: very high and permanent.**
- **Volume:** thousands of strings; `App.jsx` alone is ~6,000 lines, and the guides are mostly prose.
- **Translation:** clinical terms need a clinician translator.
- **Ongoing cost:** every new feature must ship both languages.
- **Phasing:** interface chrome and the PDF report first (about 3–4 weeks), guides later.

#### 22. VTO/STO basics; photo overlay
**How:**
- Movable segments (maxilla, mandible, upper and lower incisors) as landmark groups with drag and rotate handles.
- Soft tissue follows published response ratios (lip/incisor, chin/pogonion), warped with a thin-plate spline.
- Photo overlay: align a lateral photo by 2–3 soft-tissue points, blend it with adjustable opacity, and warp it with the same spline.

**Burden: high, about 6–8 weeks.**
- **Validity:** the published ratios vary widely between studies.
- **Liability:** predicted outcomes may be shown to patients.
- **Fit:** the weakest fit with the research-tool positioning (§7). Last, or not at all.

#### 23. Plugin format for community analyses and norms
**How:** first build the **measurement registry** from §6. Today measurements are still identified by label plus `templateId` links.
- **Schema:** analyses (landmarks + definitions); measurements (type, refs by `templateId`, sign convention, unit, frame); norms with DOIs and populations; interpretation rules.
- **Validator:** no code execution; formulas go through the restricted mathjs.
- **Distribution:** the same GitHub route as `data/communityNorms.js`.

**Burden:**
- **Registry refactor:** about 2–3 weeks. It touches how every measurement is computed, which is also its correctness value.
- **Format, validator and gallery:** about 1–2 weeks more.

### 9.4 Summary and recommended order

| Item | Effort | Main burden | Risk |
|---|---|---|---|
| 17 fonts + service worker | ~1 week | — | Low (stale-cache handling) |
| 10 (left over) AI runtime: worker, WebGPU, COOP/COEP, no demo in production | 1–2 weeks | Touches the AI runtime files | Medium |
| 17 encrypted IndexedDB storage | 1–2 weeks | Migration | **High (data loss)** |
| 15 DICOM / 16-bit / ruler | 4–5 weeks | Image pipeline, real vendor files | Medium |
| 12 union-vocabulary training | 3–5 weeks | Kaggle compute, dataset licences | Medium |
| 13 refiner + conformal radius | 3–4 weeks | Second model, calibration set | Medium |
| 14 validation + model card | ~1 week of code | ~100 expert hours, ethics | Low technically |
| 18 contours (template warp) | 1–2 weeks | — | Low |
| 19 CVM + airway | 3–5 weeks | Labels (Aariz has CVM) | Medium |
| 20 report leftovers | ~1 week | — | Low |
| 23 registry + plugins | 3–5 weeks | Refactor of the measurement core | Medium |
| 21 Arabic RTL | 3–4 weeks (chrome) + ongoing | Strings, RTL layout, translation | Ongoing cost |
| 22 VTO/STO | 6–8 weeks | Validity, liability | High |

**Order:**
1. **Quick wins:** fonts and service worker.
2. **Storage:** encrypted IndexedDB.
3. **DICOM.**
4. **AI runtime (Phase 1 left over).**
5. **Model work:** 12 → 13 → 14, in parallel with steps 1–4, since it is mostly Kaggle and expert time.
6. **Phase 3:** contour warp → CVM and airway → registry and plugins → Arabic → VTO/STO (optional).

---

## Appendix A — Reproduction scripts

Run with Node ≥ 20 from the repo root. They import the repository's own modules; nothing is modified.

**A.1 — research modules analyze coordinates (C1)**

```js
// node repro-c1.mjs
const B = new URL("./src/research/", import.meta.url).href;
const { runDescriptiveAll } = await import(B + "descriptive.js");
const { runLongitudinalAll } = await import(B + "longitudinal.js");
const { runReliabilityAll } = await import(B + "reliability.js");
function ses(id, ang, ox) {
  const V = { x: 400 + ox, y: 500 }, r = 100;
  return { id, timestamp: 0, calibration: { done: true, pxPerMm: 10 }, meta: {},
    markups: [{ id: "m", type: "angle3", label: "SNA", visible: true, placed: true,
      points: [{ x: V.x + r, y: V.y }, V, { x: V.x + r * Math.cos(ang * Math.PI / 180), y: V.y + r * Math.sin(ang * Math.PI / 180) }] }] };
}
const S = Array.from({ length: 24 }, (_, i) => ses("s" + i, 80 + (i % 7), i * 3));
console.log("descriptive mean (true ≈83°):", runDescriptiveAll(S, { labelIds: [] }, null).combined.SNA.stats.mean);
const subjects = [], S2 = [];
for (let i = 0; i < 8; i++) { const a = ses("a" + i, 80, i * 5), b = ses("b" + i, 83, i * 5 + 20); S2.push(a, b); subjects.push({ id: "p" + i, records: { T1: a.id, T2: b.id } }); }
console.log("longitudinal (true 80→83):", runLongitudinalAll(S2, { subjects, timepoints: [{ id: "T1" }, { id: "T2" }], labelIds: [] }, null).labels?.SNA?.rawData);
const cases = Array.from({ length: 10 }, (_, c) => ({ id: "c" + c, name: "c" + c, sessions: [1, 2].map(o => ({ sessionId: `r${c}_${o}`, operatorId: "op", occasion: o })) }));
const S3 = cases.flatMap((c, i) => [1, 2].map(o => ses(`r${i}_${o}`, 80 + i, o === 1 ? 0 : 37 * ((i * 7) % 5))));
const d = runReliabilityAll(S3, { labelIds: [], cases, design: "intra", iccModel: "icc2" }, null).details[0];
console.log("reliability, identical angles:", { icc: d.icc, dahlberg: d.dahlberg, unit: d.unit });
```

**A.2 — Wits and E-line signs (C2, C3)**

```js
const u = await import(new URL("./src/lib/utils.js", import.meta.url).href);
const cal = { done: true, pxPerMm: 10 };
// Patient faces right. A is 2 mm anterior to B → Class II → Wits should be +2
console.log(u.computeMeasurements({ type: "projDist", points: [{x:620,y:300},{x:600,y:420},{x:600,y:350},{x:400,y:350}] }, cal).projectedDistance); // -2
// Lip 2 mm BEHIND the E-line → should be negative
console.log(u.computeMeasurements({ type: "perp", points: [{x:760,y:250},{x:680,y:520},{x:700,y:380}] }, cal).distance); // +2.06
```

Observed output at `bdb378a` (these exact scripts):

```
descriptive mean (true ≈83°): 372.4
longitudinal T1 mean 517.5 → T2 mean 537.5   (x-pixel coordinates)
reliability, identical angles: icc 0, dahlberg 226.9 "°"
Wits (Class II): -2
Lip behind E-line: +2.06
```

## Appendix B — Status of items from earlier audits (still open)

From `docs/CODE_REVIEW_CRITIQUE.md`, these are confirmed still open: R1/R3 (statsCore consolidation), R4 (audit trail / lock completed reliability trials — **important for research integrity**), R5 (password-encrypted export), R6/R7 (render cache, spatial index), R10 (reliability clones share image IDs), R12–R14 (mirror refs, context-menu a11y, modal a11y), W2, W9, W16 (i18n), W17.
