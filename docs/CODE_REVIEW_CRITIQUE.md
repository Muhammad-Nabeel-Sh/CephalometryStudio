# CephaloStudio — Code Review Critique & Remediation Plan (Updated)

**Scope:** Full review of `src/` (clinical, statistical, security, UX, architecture, regulatory).
**Codebase state:** 300 Vitest tests (16 files), `npm run build` OK, `npm run lint` 1 pre-existing warning.

> **Status:** The majority of the original critique items have been resolved. This document now reflects only **remaining/deferred issues** and **newly discovered issues** from a second-pass review. A new **Feature Improvements** section has been added at the end.

---

## Completed Items Summary

All items marked ✅ below have been fixed and verified (300 tests pass, lint clean):

### Clinical Correctness (C1–C17) — ALL COMPLETED

- C1: `computeMeasurements` now returns `_unit: "mm"|"px"`; respects `cal.done`
- C2: Calibration reset on image load
- C3: CSV export uses `meas._unit` instead of hardcoded `"mm"`
- C4: MarkupsPanel uses `meas._unit` for display
- C5: Calibration input validation (finite, >0, ≤1000, ruler ≥10px)
- C6: PDF disclaimer + PHI gate + workspace banner
- C7: Single source of truth for norms (`src/norms.js`)
- C8: SD-banded interpretation via `sdInterpretationText`
- C9: "Angle of Convexity" rule added (Downs) separate from Ricketts "Convexity"
- C10: ANB signed-angle uses `m.measure` structural flag
- C11–C12: Airway norms warnings; stratification text
- C13: U1-L1 / Interincisal aligned
- C14: ANB uses SD-relative cutoffs
- C15: 2D magnification warning in CalibModal
- C16–C17: Landmark precision + soft-tissue notes

### Statistical Correctness (S1–S15) — ALL COMPLETED

- S1: Cohen's dz computed (was undefined)
- S2: BH adjustment direction fixed (cumulative MIN from top)
- S3: ICC fCritical/fPval use exact fCDF (was Paulson approx)
- S4: ICC unbalanced-data handling
- S5: Research collector units use `vals._unit`
- S6: Seeded Mulberry32 PRNG for CV reproducibility
- S7: Logistic regression bails out on singular info matrix
- S8: tCritical consolidated (bisection on tDistributeCDF)
- S9: Hosmer-Lemeshow small-n warning
- S10: LMM df changed to cluster count (n-2)
- S11: Bland-Altman VIF for 3+ occasion bias CI
- S12: MANOVA fractional df (removed Math.round)
- S13: Studentized range CDF quadrature improvement
- S14: Golden-value tests added (31 new tests)
- S15: calculateICC_CI documented as deprecated

### Privacy, Security & Data Integrity (P1–P17) — MOSTLY COMPLETED

- ✅ P1: Anonymization operatorId fallback removed (no clinician name)
- ✅ P2: retainProvenance defaults false; salt removed from export
- ✅ P3: ErrorBoundary STORAGE_KEY fixed
- ✅ P4: secureStorage emits encryption-unavailable warning
- ✅ P5: CSP `'unsafe-eval'` removed
- ✅ P6: 90-day retention purge on load
- ✅ P7: Key-loss detection warning
- ✅ P9: 100 MB image upload size limit
- ✅ P10: CSV parser rewritten for RFC 4180 (embedded newlines)
- ✅ P11: Export filename safe fallback
- ✅ P13: cephxFormat rejects unknown top-level keys
- ✅ P14: Logger uses `?debug=1` gate (no PHI in any build)
- ⬜ P8: Session/trial audit trail — deferred (requires session model changes)
- ⬜ P12: Password-encrypted .cephx export — deferred (needs UI workflow)
- ⬜ P15: Pending-writes queue for beforeunload — deferred
- ⬜ P16: Blocking QuotaExceededError dialog — deferred (banner exists)
- ⬜ P17: Template storage encryption — deferred (low risk)

### Clinical Workflow, UX & Accessibility (W1–W18) — MOSTLY COMPLETED

- ✅ W1: Undo snapshot includes calibration, formulas, processing; finalizeCalib calls pushUndo
- ✅ W3: Image-processed event listener triggers redraw
- ✅ W4: Autosave debounced (800ms trailing)
- ✅ W10: Undo cap raised to 200
- ✅ W12: Object URLs revoked after all exports
- ✅ W13: Light theme contrast fixed (WCAG AA)
- ✅ W18: Clear All Markups calls pushUndo
- ✅ R11: Airway overlay uses `norms.js` with age/sex stratification via dedicated AirwayPanel
- ⬜ W2: Delete confirmation for referenced markups — deferred
- ⬜ W5: Offscreen static canvas cache — deferred (major perf refactor)
- ⬜ W6: Spatial index for hit-testing — deferred
- ⬜ W7: SessionMetadataModal via accessible Modal.jsx — deferred
- ⬜ W8: Keyboard/touch context menu — deferred
- ⬜ W9: Per-project undo/viewport persistence — deferred
- ⬜ W14: Shape encoding for deviation indicators — deferred
- ⬜ W15: Touch long-press context menu — deferred
- ⬜ W16: i18n groundwork — deferred
- ⬜ W17: Rename "Save project" → "Export" — deferred

### Architecture & Maintainability (A1–A7) — PARTIALLY COMPLETED

- ✅ A2: Migration useEffect fixed (proper deps + run-once guard)
- ✅ A3: Redraw effect has `[redraw]` dependency array
- ✅ A4: collect.js cache uses content-based key (not WeakMap)
- ✅ A5: Norms merged into `src/norms.js`
- ✅ A6: `src/research/statsCore.js` created; correlation.js imports from it
- ✅ A7: `getEffectSizeValue` centralized in statsCore.js
- ⬜ A1: State-mirroring refs pattern — deferred (major refactor)
- ⬜ A6 (partial): comparative.js, diagnostic.js, longitudinal.js, descriptive.js still have local copies of normalCdf/matInverse/etc. — centralization ~20% adopted

---

## Remaining Issues

### R1. `statsCore.js` centralization incomplete (A6 partial)

**Severity: Low (maintainability)**
`statsCore.js` was created with shared helpers, but only `correlation.js` imports from it. `comparative.js`, `diagnostic.js`, `longitudinal.js`, and `descriptive.js` still define their own local copies of `normalCdf`, `matMul`, `matInverse`, `benjaminiHochberg`, etc. Two different `normalCdf` approximations coexist (PDF-form in comparative/descriptive; erf-form in statsCore/diagnostic). Numerically equivalent to ~1e-7 but inconsistent.

**Remediation:** Replace local definitions in each file with imports from `statsCore.js`. Delete the local copies.

### R2. `PREDEFINED_NORMS` naming collision (constants.js vs descriptive.js) — FIXED

**Severity: Was Low (maintainability) — now resolved**
`descriptive.js` had already been renamed to export `RESEARCH_NORMS` (array form). The remaining `PREDEFINED_NORMS` alias in `constants.js` (object map, an alias of `DEFAULT_NORMS`) was removed entirely; consumers (`MeasurementsPanel.jsx`, `NormsReferenceModal.jsx`) now import `DEFAULT_NORMS` directly from `norms.js` (single source of truth). No `PREDEFINED_NORMS` export remains anywhere.

### R2b. Label-based landmark/measurement binding — FIXED

**Severity: Was High (clinical correctness) — now resolved**
Templates and auto-measurements bound referenced landmarks by mutable label strings (`refLabels`), so renaming a point (e.g. "Sella" → "S") silently broke drag propagation (`syncRefDeps`) and reference refresh (`refreshAutoMeasurements`). Now:

- Template points get an immutable `templateId` (`<analysis>::<landmark>`) at `loadTemplate`; re-loading a template detects existing points via `label` OR `templateLabel` (no duplicates after rename).
- Auto-created measurements store `refTemplateIds` (stable IDs) alongside `refLabels` (display labels); `refLabels` now store `templateLabel || label`.
- `refreshAutoMeasurements` resolves refs by `templateId` → `templateLabel` → `label` (legacy fallback intact).
- `syncRefDeps` matches by `templateId` first, falling back to label/templateLabel.
- `markupDefaults` 3px auto-link stores `refTemplateIds` from the matched point.
- Airway landmark lookups (`findPt`, `buildPtMap`, boundary generation) also match `templateLabel`/`templateId`.
- `getMeasValue` now returns the type's primary measure (angle/length/area/value) instead of the first numeric value (x-coordinate), and infinite-mode line refs fall back to segment length; `refreshAutoMeasurements` threads calibration through so computed sums/differences stay in mm after calibration.
- New tests: `src/test/templateLinking.test.js` (15 tests).

### R3. `statsCore.js` has dead exports

**Severity: Low**
`tCritical` (line 21) and `getEffectSizeValue` (line 109) are exported but never imported by any file. `descriptive.js` defines its own local `tCritical` instead of importing from statsCore.

**Remediation:** Import these in the files that need them, or remove the exports.

### R4. Session/trial audit trail (P8)

**Severity: High (research integrity / regulatory)**
Sessions (including reliability trials) are freely editable via `updateSession`/`updateSessionInProject` with only a `modified` timestamp. No immutable history, no "who edited what," no lock-after-completion. A rater's landmark placements for an ICC study can be silently altered.

**Remediation:** Append an `auditLog[]` to each session. Add a "Lock trial" action that freezes reliability sessions.

### R5. Password-encrypted .cephx export (P12)

**Severity: Medium**
"Full Project" export is unencrypted plaintext PHI. Once on disk, the file is unprotected.

**Remediation:** Add password-based encryption (WebCrypto deriveKey from passphrase → AES-GCM) as an export option.

### R6. Offscreen static canvas cache (W5)

**Severity: Medium (performance)**
Every frame redraws image + all markups from scratch. The `staticDirtyRef` is vestigial. With 100+ markups this janks.

**Remediation:** Render image + static markups to an offscreen canvas when dirty; blit + draw dynamic overlay on mousemove.

### R7. Spatial index for hit-testing (W6)

**Severity: Medium (performance)**
`handleMouseMove` hit-tests all markups (O(N)) on every move in select mode.

**Remediation:** Build a uniform-grid spatial index over markup points/bboxes.

### R8. Research result panels display values with no unit indicator — FIXED

**Severity: Was Medium (clinical correctness) — now resolved**
Every research results table rendered raw numbers (meanDiff, sdDiff, LoA, Dahlberg, SEM, MDC, means, SDs, meanΔ) with no unit suffix. Units now propagate end-to-end:

- `collect.js` exports `unitForKey()` (angle keys → "°", else mm/px from `_unit`) and `dominantUnit()` (ignores x/y coordinate keys when real measurement keys exist).
- `reliability.js` attaches `unit` to every `details` entry; `ReliabilityPanel.jsx` renders a Unit column in the Bland-Altman and Method-Error tables, and the landmark error-map table now shows the actual `lm.unit` (mm when calibrated) instead of hardcoded "px".
- `descriptive.js` attaches `unit` to group + combined label results; `DescriptivePanel.jsx` renders Unit columns in the descriptive and reference-interval tables.
- `comparative.js` attaches `unit` to label results; post-hoc section headers show it.
- `longitudinal.js` attaches `unit` to label results, change scores, and pairwise rows; ANOVA/Change/Pairwise views show it in section headers.
- `resultsExport.js` emits a `Unit` column in reliability/descriptive/comparative/longitudinal CSVs.
- New tests: `src/test/unitPropagation.test.js` (13 tests).

### R9. Chart vs table unit inconsistency for landmark error map — FIXED

**Severity: Was Medium — now resolved**
`moduleCharts.jsx` ErrorMapPlot hardcoded "mm" in axis titles and hover templates while the panel showed "px" (or vice versa after calibration). All reliability charts (Collective Bland-Altman, ErrorMapPlot, MethodErrorBarPlot) and the superimposition displacement charts (bar/polar) now derive the unit from the result objects (`d.unit` / `v.unit` / `results.landmarkMap`) in axis titles, hover templates (via `customdata` where units may be mixed), and descriptive distribution annotations.

### R10. `mkReliabilitySession` shares image-entry references

**Severity: Medium (data integrity)**
`session.js:38-55` — reliability clones share the same image entry objects and IDs as the base session. IDB key collision / orphan risk if base or clone is deleted.

**Remediation:** Deep-copy images with new IDs in `mkReliabilitySession`, matching `duplicateSession`.

### R11. Airway overlay hardcodes non-adjustable adult norms — FIXED

**Severity: Was Medium — now fixed**
`markups.jsx:1327` — fixed adult thresholds drove color-coding. Now the airway overlay receives measurements from `computeAirwayMeasurements()` with age/sex-stratified norms from `norms.js`, and the dedicated AirwayPanel provides full normative comparison with traffic-light z-score display.

### R12. State-mirroring refs pattern (A1)

**Severity: Low (maintainability)**
App.jsx Workspace (~1600 lines) uses many state-mirroring refs (`updMarkupRef`, `delMarkupRef`, etc.) reassigned every render.

**Remediation:** Move logic into `useCallback`/`useMemo` with explicit deps or a `useReducer`; eliminate mirror refs.

### R13. Context menu keyboard/touch inaccessibility (W8)

**Severity: Medium (a11y)**
Right-click context menu is mouse-only with non-focusable `<div>` items. No Shift+F10, no long-press.

**Remediation:** Add `role="menu"`/`role="menuitem"`, `tabIndex={0}`, arrow-key navigation, long-press handler.

### R14. SessionMetadataModal bypasses accessible Modal.jsx (W7)

**Severity: Medium (a11y)**
Hand-rolled modals with no `role="dialog"`, no `aria-modal`, no focus trap, no Escape handler.

**Remediation:** Route all overlays through `Modal.jsx`.

---

## Newly Discovered Issues (Second-Pass Review)

### N1. NormogramPanel CSV export was completely broken — FIXED

**Severity: Was HIGH — now fixed**
The CSV exporter referenced `r.deviation` and `r.interpretation` which don't exist on the row objects. Every row was labeled "Severe" and percentile showed "NaN%". Fixed: now uses `r.dev.sdUnits` and calls `interpretationText()`.

### N2. PDF report hardcoded "mm" for uncalibrated values — FIXED

**Severity: Was HIGH — now fixed**
`fmtMm(v)` always appended `" mm"`. When uncalibrated, linear measurements were in pixels but printed as "mm" in a clinical PDF. Fixed: `fmtMm(v, unit)` now accepts a unit parameter; measurement and normogram sections pass `meas._unit`.

### N3. diagnostic.js correctedAUC was a tautology — FIXED

**Severity: Was HIGH — now fixed**
`correctedAUC = apparent - optimism` where `optimism = apparent - cv` simplified to `cv` — a tautology the comment claimed to fix. Fixed: now computes per-fold training AUCs and uses `meanOptimism = mean(trainAUC - testAUC)` for a proper Harrell-style correction.

### N4. finalizeCalib pushUndo before validation — FIXED

**Severity: Was LOW — now fixed**
`pushUndo()` was called before validation guards, leaving spurious no-op undo entries on failed validation. Fixed: `pushUndo()` now called after validation passes.

### N5. loadTemplate missing pushUndo — FIXED

**Severity: Was MEDIUM — now fixed**
Loading a template (which can add 20+ landmarks) was not undoable. Fixed: `pushUndo()` added before `updSession`.

### N6. BatchImportModal missing file type/size validation — FIXED

**Severity: Was MEDIUM — now fixed**
Batch import read any file as data URL with no type check (bypassable `accept="image/*"`). Fixed: validates `file.type.startsWith("image/")` and `file.size <= 100MB` with alert on rejection.

### N7. Context menu area unit missing ² — FIXED

**Severity: Was LOW — now fixed**
"Copy Measurement" clipboard text used `"mm"` for area instead of `"mm²"`. Fixed: now branches on `k === "area"`.

### N8. panels.jsx formula measurements missing _unit filter — FIXED

**Severity: Was LOW — now fixed**
`Object.entries(meas).map(...)` at line 229 had no `!k.startsWith("_")` guard. Fixed.

### N9. reportGenerator missing _unit skip guard — FIXED

**Severity: Was LOW — now fixed**
Measurement loop relied on `typeof val !== "number"` to skip `_unit` string. Fixed: explicit `mt.startsWith("_")` guard added for consistency.

### N10. descriptive.js duplicate ANB operand — FIXED

**Severity: Was LOW — now fixed**
`if (norm.label === "ANB" || norm.label === "ANB")` — both sides identical (typo). Fixed to single check.

---

## Feature Improvements

The following are enhancement opportunities (not bug fixes), ranked by impact and feasibility given the existing codebase.

### High Impact

| #   | Feature                               | Description                                                                                                                        | Existing Foundation                                                                                    |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F1  | **AI-assisted landmark detection**    | TensorFlow.js / ONNX model pre-places ~20 landmarks; user fine-adjusts. Turns 5-10 min tracing into 30s review.                    | `placingQueue`/`placingMode` workflow; `addMarkup`/`updMarkup` infra; `refLabels` auto-linking         |
| F2  | **DICOM metadata auto-calibration**   | Parse `PixelSpacing` (0018,1164) from DICOM files on import to auto-populate `pxPerMm`. Eliminates #1 source of measurement error. | `finalizeCalib`/`calibration` model; `loadImage` import path                                           |
| F3  | **Superimposition / growth analysis** | T1-on-T2 overlay with proper Procrustes N-landmark alignment, growth-attribution charts, side-by-side synchronized view.           | `compareSession`, `displacementOverlay`, `alignTwoPoints`, `drawDisplacementVectors` — partially built |
| F4  | **VTO (visual treatment objective)**  | Drag soft-tissue/dental landmarks to simulate post-treatment positions; live recompute interpretation/normogram.                   | All markup primitives; interpretation engine; `drawMarkup`                                             |
| F5  | **Batch analysis pipeline**           | One-click "apply template X to every session, export combined CSV (subject × measurement matrix)."                                 | `autoCreateMeasurements`; Batch Import; CSV export                                                     |

### Medium Impact

| #   | Feature                                    | Description                                                                                                                                                                                                                                  | Existing Foundation                                                                  |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| F6  | **3D CBCT multi-planar reformatting**      | Display 3 orthogonal 2D slices from CBCT volume. Stage 1: MPR reusing canvas pipeline. Stage 2: WebGL volume rendering.                                                                                                                      | Canvas 2D pipeline; `drawMarkup`/hit-test                                            |
| F7  | **Normative database editor**              | Import/export custom norm datasets (JSON/CSV), age/sex stratification, source provenance.                                                                                                                                                    | `InlineNormEditor`; `PREDEFINED_NORMS`; `norms.js`                                   |
| F8  | **Growth prediction (CVMS / Fishman)**     | Cervical vertebral maturation staging from C2-C4; hand-wrist bone-age scoring.                                                                                                                                                               | `PREDEFINED.handwrist`; markup model                                                 |
| F9  | **Automated report templates**             | User-uploaded logo, editable header/footer, saved per-practice report presets.                                                                                                                                                               | `reportGenerator.js` section selection; logo support                                 |
| F10 | **Airway volume estimation**               | Compute 2D airway polygon area, estimate sagittal airway area, apply 2D→3D formulae.                                                                                                                                                         | `drawAirwayOverlay`; `polyArea` utility                                              |
| F11 | **Extended Airway Analysis** — IMPLEMENTED | 12-standard airway measurements (R-PAS, R-RG, SPAS, MAS, IAS, MP-H, PNS-AD1/2, tongue length, palate length/thickness, N-PH) with normative comparison, z-scores, traffic-light coloring, auto-tracing from landmarks, dedicated AirwayPanel | `drawAirwayOverlay`; existing silhouette/point markup types; `norms.js` airway norms |
| F12 | **Side-by-side comparison mode**           | Two synchronized canvases with linked pan/zoom for visual T1/T2 comparison.                                                                                                                                                                  | Session filmstrip; overlay infrastructure                                            |
| F11 | **Side-by-side comparison mode**           | Two synchronized canvases with linked pan/zoom for visual T1/T2 comparison.                                                                                                                                                                  | Session filmstrip; overlay infrastructure                                            |
| F12 | **Measurement confidence indicators**      | Estimate per-landmark confidence from local image quality (contrast/noise/edge strength); display as colored halo.                                                                                                                           | `imageProcessor.worker.js` pixel access                                              |
| F13 | **PACS integration**                       | DICOM C-FIND/C-MOVE query/retrieve via WebSocket proxy (orthanc/dcm4che).                                                                                                                                                                    | None (needs backend)                                                                 |
| F14 | **Export to Dolphin/OnyxCeph formats**     | Industry-format export for interoperability.                                                                                                                                                                                                 | `.cephx`/CSV/PDF export infrastructure                                               |

### Lower Impact / Niche

| #   | Feature                                     | Description                                                                                    | Existing Foundation                              |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| F15 | **Plugin/extension system**                 | Custom analyses as importable JSON packages (landmarks + measurements + interpretation rules). | `.cepht` template format                         |
| F16 | **Keyboard shortcut editor**                | Settings panel mapping action→key with localStorage persistence.                               | Hardcoded shortcuts in keydown handler           |
| F17 | **Custom color palettes per type**          | Default-per-type colors (configurable palette) for visual consistency.                         | `addMarkup` color defaults                       |
| F18 | **Collaborative real-time annotation**      | WebSocket/WebRTC sync layer for multi-user editing. Needs backend.                             | `workspaceStore` reducer is diffable             |
| F19 | **Soft-tissue 3D photo overlay**            | Overlay facial photo on cephalogram for aesthetic treatment planning.                          | Image layering system (`transform`, `blendMode`) |
| F20 | **Undo/redo for individual landmark moves** | Per-landmark move history (command pattern) instead of snapshot-based.                         | Current snapshot undo stack                      |

---

## What is Done Well (preserve these)

- **Real WebCrypto AES-GCM 256** at rest with non-extractable key in separate IDB store
- **AST-sandboxed formula evaluator** — allowlisted node types/functions, numeric scope inlined
- **Statistical audit trail in comments** — past bugs documented and fixed; golden-value tests guard core distributions
- **Orphan-blob GC** with warm + cold-scan fallback
- **Accessible base `Modal.jsx`** — focus save/restore, Tab trap, Escape, `aria-modal`
- **mm/px gating** via `_unit` on `computeMeasurements` return (now consistent across most display surfaces)
- **Non-destructive anonymization** with audit log (provenance off by default, salt removed)
- **Research-engine Web Worker** with progress streaming and cancellation
- **KaTeX bundled from npm** (no CDN/SRI risk)
- **Seeded PRNG** for reproducible cross-validation
- **90-day data retention purge** on load
- **Key-loss detection** with user warning
- **Debounced autosave** (800ms trailing)
- **CSP without `unsafe-eval`**
- **PHI-safe logging** in all builds (`?debug=1` for development)

---

*This critique was updated after a second-pass review. All completed items have been verified with 300 passing tests and clean lint. Remaining items are prioritized by clinical impact and feasibility.*
