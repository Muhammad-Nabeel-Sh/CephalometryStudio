# Cephalometry Studio — Comprehensive Technical & Clinical Audit Report

> **Date:** 2026-07-29  
> **Scope:** Full application with deep-dive into the research module  
> **Files reviewed:** All 30 files in `src/research/`, `src/lib/utils.js` (1447 lines), `src/research/superimposition.js` (945 lines), `src/research/comparative.js` (943 lines), `src/research/airway.js` (752 lines), and all supporting modules.

---

## Executive Summary

Cephalometry Studio is a well-engineered, feature-rich cephalometric analysis platform. The statistics engine is substantially above average for a browser-based clinical tool — it implements exact non-parametric distributions, F-based ICC CIs, Welch-Satterthwaite df, Jacobi eigendecomposition for MANOVA, DeLong AUC CIs, and proper BH adjustment. The core math has been audited and corrected in multiple rounds. However, several **clinically important weaknesses** and **technical gaps** remain that could mislead clinicians or researchers if left unaddressed.

---

## 🟢 Strengths

### Statistical Engine

| Strength                               | Detail                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exact non-parametric distributions** | `mannWhitneyExactP` and `wilcoxonExactP` use DP exact null-distribution — falls back to normal approx only for n > 50 or with ties. R-compatible.                    |
| **F-based ICC CI (Shrout & Fleiss)**   | `iccShroutFleiss` implements the exact F-based CI for ICC(1,1), ICC(2,1), ICC(3,1) with average-measure variants. Handles unbalanced data via per-row/column counts. |
| **Proper betaCF / chi2CDF**            | Lentz continued-fraction is correctly initialised; the lower-incomplete-gamma for chi2CDF uses the convergent series branch correctly.                               |
| **Welch-Satterthwaite df**             | Independent t-test uses fractional Welch df without rounding — improves p-value precision for unequal-variance cases.                                                |
| **Jacobi MANOVA eigendecomposition**   | Correct E^{-1/2} H E^{-1/2} symmetric path via Jacobi iteration for p > 2 DVs. Box's M test implemented.                                                             |
| **Logistic regression hardening**      | Newton-Raphson with separation detection (gradient norm > 1e6), step-halving, and singular Hessian bail-out. Youden-optimal threshold.                               |
| **DeLong AUC CI**                      | Logit-transform CI more accurate near 0/1.                                                                                                                           |
| **Shapiro-Wilk + D'Agostino-Pearson**  | Two normality tests covering different sample sizes.                                                                                                                 |
| **Cluster-robust SE for LMM**          | Sandwich variance estimator applied post-hoc to reduce anti-conservatism; correctly labeled as not REML.                                                             |
| **Formula sandbox AST validation**     | AST-gate on mathjs parse tree (not regex) blocks `import`, property access, function definition.                                                                     |
| **Calibration-awareness**              | z-scores suppressed when uncalibrated, `_unit` propagated through measurement chain, warnings shown in UI.                                                           |
| **Time-separation enforcement**        | Min-days checks on reliability and longitudinal sessions; violations listed as structured warnings.                                                                  |
| **MDC distinction**                    | Correctly uses individual-level MDC (z√2·sdDiff) not the group-level SE — common clinical error avoided.                                                             |
| **Procrustes mm-normalization**        | Both sessions scaled to mm before alignment, preventing magnification mismatch when T1/T2 have different pxPerMm.                                                    |

---

## 🔴 Critical Errors

### 1. `zCritical()` lookup table clips at z=3.0 — wrong fallback

```js
// diagnostic.js:5-16
function zCritical(alpha) {
  const lookup = [];
  for (let i = 0; i <= 30; i++) lookup.push({ z: i / 10, c: normalCDF(i / 10) });
  // ...
  return 3.09; // fallback — used when alpha < 0.001
}
```

The table only goes to z=3.0. For `alpha=0.001` (99.9% CI) the lookup never matches and falls back to the crude `3.09` constant (correct value: z≈3.291). Under-estimates CI for DeLong AUC at non-default alphas. **Fix:** replace with a bisection inversion of `normalCdf`.

**Severity:** Low for default α=0.05; moderate when users request 99% CIs.

---

### 2. VIF computation — matrix transpose bug in `correlation.js`

```js
// correlation.js:308-312
for (let j = 0; j < XClean.length; j++) {
  const otherX = Xt.filter((_, k) => k !== j);  // WRONG — drops k-th ROW of Xt
  const thisY = Xt.map(row => row[j]);
```

`Xt = transposeMatrix(XClean)` has shape `[n × p]`. `Xt.filter((_, k) => k !== j)` drops the j-th **observation row**, not the j-th **predictor column**. The auxiliary regression is therefore run on `n-1` samples with `p` regressors, giving garbage R² and wrong VIF for every multi-predictor model.

**Correct approach:** regress `XClean[j]` (length-n) on all `XClean[k]` (k ≠ j) — don't go via `Xt`.

**Severity:** Medium — VIF values are wrong whenever n > p; can lead to incorrect multicollinearity conclusions.

---

### 3. `buildCompositeIndex` — no separation guard (diagnostic.js)

```js
// diagnostic.js:258-260
const delta = matVecMul(matInverse(Hess), score);
beta = beta.map((b, i) => b - delta[i]);
if (delta.every(d => Math.abs(d) < 1e-8)) break;
```

Unlike `logisticRegressionNewton` in `correlation.js` (which has gradient-norm detection, step-halving, and singular Hessian bail-out), `buildCompositeIndex` has **no convergence guards**. For small or perfectly-separated clinical samples (common in diagnostic ROC studies), this diverges silently, producing `beta = [Infinity, ...]` that flows into calibration analysis and LOOCV.

**Severity:** High — composite ROC score in diagnostic studies can silently return nonsense.

---

### 4. Airway — `SP-Thickness` measures airway width, not palate thickness

```js
// airway.js:103-112
{ id: "SP-Thickness", label: "Soft Palate Thickness",
  points: ["SP_mid", "Ad3"], normMean: 8.5, ... }
```

`SP_mid` is on the soft palate; `Ad3` is on the **posterior pharyngeal wall**. The straight-line distance between them is the airway width at that level, not palate thickness. True soft palate thickness requires two points on the palate itself (anterior and posterior surfaces at the same cross-section level). This is a clinical measurement definition error that systematically over-estimates "thickness" by including the airway lumen.

**Severity:** High — mislabeled clinical measurement; results labeled "thickness" actually show airway width.

---

### 5. Airway — R-PAS uses point-to-point distance, not the narrowest dimension

```js
// airway.js:37-47
{ id: "R-PAS", label: "R-PAS (Retropalatal Airway Space)",
  points: ["SP", "Ad3"] }  // SP = soft palate tip
```

McNamara's R-PAS is the **narrowest** AP dimension of the retropalatal airway, measured at the PNS level — not from the uvula tip to a fixed pharyngeal wall point. The `findNarrowestPoint` utility already exists in `airway.js` but is **never invoked** for this measurement. The SP→Ad3 straight line overestimates the narrowest dimension when the actual constriction is above the uvular tip.

**Severity:** Medium-High — systematically over-estimates retropalatal space; reduces clinical utility for OSA screening.

---

### 6. Superimposition — displacement sign opposite to linear-change sign convention

In `runSuperimposition`, `matchLandmarks(compF, baseF)` sets `src = compare point` (T2), `dst = base point` (T1). Displacement = `dst - alignedSrc` = T1_position - T2_aligned. So **displacement is T1 − T2** (positive = moved backward from T2 to T1 perspective).

Meanwhile `computeLinearChanges` uses `m1 = src = compare` (T2), `m2 = dst = base` (T1), and:

```js
delta: v1[k] - v2[k]  // v1 = T2 measurement, v2 = T1 measurement → T2 - T1
```

So linear changes are **T2 − T1** but displacements are **T1 − T2**. Both tables displayed together will show opposite signs for the same physical change, confusing clinicians comparing the two.

**Severity:** Medium — inconsistent sign convention between two result tables.

---

### 7. Bland-Altman LoA CI — large-sample approximation used for small n

```js
// reliability.js:183-187
loaUpper: meanDiff + 1.96 * sdDiff,           // z=1.96 — OK for large n
loaUpperCi: [meanDiff + 1.96 * sdDiff - tCrit * seLoA, ...]
```

The `seLoA = sqrt(3·sd²/n)` formula (Bland 1999) is a large-sample approximation. For n < 20, the exact LoA CI requires a noncentral t-distribution correction on the 1.96 coefficient itself (Carkeet 2015). The current formula systematically underestimates the LoA CI width at small n — exactly when reliability studies have the most uncertainty.

**Severity:** Moderate for n < 20 reliability studies.

---

### 8. Shapiro-Wilk coefficients are not the true Shapiro-Wilk weights

```js
// utils.js:619-625
function shapiroCoefficients(n) {
  const m = Array.from({ length: n }, (_, i) => normalQuantile((i + 1 - 0.375) / (n + 0.25)));
  const ss = m.reduce((s, x) => s + x * x, 0);
  const a = m.map(x => x / Math.sqrt(ss));
  return a.slice(0, Math.floor(n / 2));
}
```

These are **normalised expected order statistics** — not the Shapiro-Wilk `aᵢ` coefficients, which are derived from the covariance matrix of normal order statistics. The current implementation gives a simplified linear combination (closer to a "weighted W" heuristic) producing different W values from R's `shapiro.test`. The `shapiroPValue` log-linear approximation also diverges from the Royston (1995) polynomial used in R. Test selection in the comparative module depends on this test — false normality claims route data to parametric tests inappropriately.

**Severity:** Medium — W statistic and p-value may differ materially from R for 5 < n < 20.

---

### 9. Occlusal Plane definition uses wrong landmarks

```js
// superimposition.js:16
{ id: "OP", label: "Occlusal Plane", pt1: "U1 tip", pt2: "Me" }
```

The standard cephalometric occlusal plane is defined by the occlusal contacts of the posterior teeth (molar cusp tips) or by the bisecting angle of the upper and lower incisal edges. `U1 tip → Me` (upper incisal edge to chin point) defines a **facial height line**, not an occlusal plane. Structural alignment on this "plane" will produce systematically wrong displacement vectors for every landmark in the dataset.

**Severity:** High — all superimposition results wrong when user selects Occlusal Plane.

---

## 🟡 Weaknesses & Design Concerns

### 10. LMM not clearly flagged as pseudo-OLS in the UI

The `linearMixedModel` function is correctly labeled internally as `ols_pseudo_lmm`, but the LongitudinalPanel likely presents this as "Linear Mixed Model" without prominent disclaimer. Random intercept variance can go negative (clamped to 0) — this is a method-of-moments artefact. The display limitation text needs to be immediately visible to the user, not buried in a tooltip.

---

### 11. Tongue-Length norm is not stratified (population-specific)

`normMean: 76.9 mm` (Lowe 1985) is from a Caucasian Canadian sample and will be 5–15 mm off for East Asian, Middle Eastern, or African patients. All other key airway measurements have age/sex strata; tongue length is the only one with a single population-agnostic mean.

---

### 12. Delta norm scaling assumes linear time-invariant growth

```js
const scaledDelta = group.meanDelta * yearSpan;     // linear scaling
const scaledSD = group.sd * Math.sqrt(yearSpan);   // Brownian motion SD
```

Growth is not a random walk. Linearly scaling a 1-year SNB norm of +1.2°/year to 4 years gives +4.8° — clinically unrealistic for a 12–16 year old near pubertal peak. Age-span-specific expected deltas (not linear extrapolations) are needed.

---

### 13. Pattern detection labels are brittle (case-sensitive exact match)

```js
const anbChange = findAng("ANB") || findLin("ANB");
```

Silently fails for labels like "A-N-B", "anb", "ANB angle". With no match, the ANB-dependent skeletal class pattern is simply not reported — no warning is given. Case-insensitive matching with synonyms, or a standardized tag system, is needed.

---

### 14. Tukey HSD integration bound may be too narrow for large k

```js
const maxX = df < 5 ? 12 + q / 2 : 6 + q / 2;
```

For large q (3+ groups with small df), the upper chi-distribution tail above `6 + q/2` may be non-negligible, causing `studentizedRangeCDF` to return slightly too-low values and `qCritical` to converge too small — making Tukey HSD anti-conservative. A bound of `max(6 + q/2, q + 10)` is safer.

---

### 15. Hosmer-Lemeshow — no warning when n < nGroups

When n < nGroups (e.g., n=8, nGroups=10), 8 groups of size 1 are created, and the HL statistic becomes trivially 0 or undefined. The warning triggers only on `expected < 5` per cell, not on `groupSize < 5` — so small-n cases can silently produce a misleading "well-calibrated" result.

---

### 16. No power analysis / sample size calculator

None of the 7 research modules offers prospective power analysis. Clinical researchers designing a study cannot determine required n. Even a basic two-group t-test power calculator would fill the most common need.

---

### 17. Longitudinal module uses listwise deletion for missing data

Subjects with any missing timepoint are excluded (`complete` array). This complete-case analysis introduces bias when data is MAR (the rule in clinical follow-up). No sensitivity analysis or multiple imputation alternative is offered.

---

### 18. No clinical significance (MCID) threshold for displacement

`isSignificant = sigRatio > 2` is based on measurement uncertainty only. There's no user-configurable MCID — a 0.3 mm statistically-clear displacement is clinically trivial. Users cannot distinguish measurement-noise-exceeding from clinically-relevant change.

---

### 19. `Dahlberg SEM == dahlberg` is incorrect for 3+ occasions

```js
const sem = dahlberg;  // reliability.js:221
```

In multi-occasion designs, the Dahlberg formula gives the RMS pairwise error / √2 — not the SEM of a single measurement. Correct SEM = σ_total × √(1-ICC) from a variance-components model. The simplification can be 20–40% off.

---

### 20. Group superimposition CI uses z=1.96 regardless of n

```js
ci95: [mean - 1.96 * sd / Math.sqrt(n), mean + 1.96 * sd / Math.sqrt(n)]
```

Should use t(n-1) critical value for n < 30.

---

### 21. MANOVA has no pairwise post-hoc

After a significant MANOVA, researchers need to identify which group pairs differ. No discriminant function analysis or pairwise MANOVA follow-up is implemented — significant MANOVA results are unactionable without it.

---

### 22. Airway: no area-based measurement

All airway measurements are 1D linear distances. Modern OSA research uses minimum cross-sectional area and total pharyngeal area as primary predictors. The `traceAirwayBoundary` and `findNarrowestPoint` utilities exist but area is never computed in `computeAirwayMeasurements`.

---

## 🔵 Feature Improvement Roadmap

### A. Research Module

| Feature                                      | Priority | Notes                                                               |
| -------------------------------------------- | -------- | ------------------------------------------------------------------- |
| **Power/sample size calculator**             | 🔥 High   | t-test, ANOVA, correlation, ICC — essential pre-study tool          |
| **Missing data / multiple imputation**       | 🔥 High   | MICE or available-data sensitivity analysis for longitudinal module |
| **Growth velocity curves**                   | 🔥 High   | Overlay individual trajectories on Björk/Nanda velocity norms       |
| **ANCOVA / covariate adjustment**            | Medium   | Age, sex, baseline value as covariates in comparative analysis      |
| **Effect size CI (ω², η² via noncentral F)** | Medium   | Required for CONSORT/STROBE compliant reporting                     |
| **Equivalence / TOST tests**                 | Medium   | Test "no meaningful change" hypotheses in reliability/longitudinal  |
| **MANOVA pairwise post-hoc**                 | Medium   | Discriminant function or pairwise MANOVA follow-up                  |
| **ROC partial AUC**                          | Low      | pAUC at clinically relevant specificity range                       |
| **REML mixed model**                         | Low      | Replace pseudo-OLS with proper EM-based REML                        |

### B. Superimposition & Growth

| Feature                                         | Priority | Notes                                                                                  |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| **Canvas overlay rendering**                    | 🔥 High   | Visual T1/T2 tracing overlay with displacement arrows — far more intuitive than tables |
| **VTO (Visual Treatment Objective)**            | 🔥 High   | Forward-plan using delta norms + displacement vectors — framework already built        |
| **MCID user-configurable threshold**            | Medium   | Distinguish statistical from clinical significance                                     |
| **Growth prediction confidence bands**          | Medium   | ±1SD expected growth envelope around predicted position                                |
| **Landmark quality scoring in superimposition** | Medium   | Flag high-variability landmarks from reliability module for exclusion                  |
| **Pharyngeal airway area**                      | Medium   | Compute area from `traceAirwayBoundary` — already has the infrastructure               |

### C. Core Application

| Feature                       | Priority | Notes                                                      |
| ----------------------------- | -------- | ---------------------------------------------------------- |
| **Batch analysis runner**     | Medium   | Run same research analysis across multiple `.cephx` files  |
| **DICOM import**              | Medium   | Native import with embedded patient metadata from PACS     |
| **Undo for session metadata** | Medium   | Calibration/patient data edits not currently undoable      |
| **Autosave**                  | Low      | Prevent research session loss on browser close             |
| **Audit trail**               | Low      | Blinding enforcement for reliability studies               |
| **REST API mode**             | Low      | Expose measurement engine to R/Python for batch processing |

---

## Priority Summary

| Category                                            | Count  | Severity |
| --------------------------------------------------- | ------ | -------- |
| Critical errors (wrong math or clinical definition) | **9**  | 🔴        |
| Weaknesses (suboptimal, may mislead users)          | **13** | 🟡        |
| Feature gaps                                        | **15** | 🔵        |

### **Top 3 fixes to ship immediately:**

1. 🔴 **`buildCompositeIndex` separation guard** (`diagnostic.js`) — prevents silent divergence in composite ROC index
2. 🔴 **VIF matrix transpose fix** (`correlation.js`) — VIF values are wrong for every multi-predictor model
3. 🔴 **Occlusal Plane landmark redefinition** (`superimposition.js`) — U1 tip → Me is a facial height line, not an occlusal plane

---

*Audit performed by static code review of all 30 `src/research/` files plus `src/lib/utils.js`. Has not been validated against live radiographic data.*
