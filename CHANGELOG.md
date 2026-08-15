# Changelog

## [1.5.0] - 2026-08-15

### Changed - Rebrand to Cephalometry Studio

- Product renamed from CephaloStudio to **Cephalometry Studio** across the app, docs, and metadata
- GitHub repository renamed to `Muhammad-Nabeel-Sh/CephalometryStudio`; all raw.githubusercontent.com references (community examples, community norms, contribute page, examples manifest) updated to the new name
- `coverage/` untracked and gitignored — fixes GitHub language statistics (committed coverage HTML reports were ~9.3 MB / 64% of the repo)

### Added - JOSS Publication Assets

- `paper.md` + `paper.bib` (JOSS format, 14 references, ~700 words)
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CITATION.cff`

### Added - PWA/OS Icon Pipeline

- `scripts/generate-icons.mjs` (sharp) — rasterizes the pure-vector `public/favicon.svg` into `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180), 7 iOS splash images, and `og-image.png` (1200x630)
- `site.webmanifest` now references real PNG icons (the previous 512 PNG reference 404'd); `index.html` adds apple-touch-startup-image links and a logo in the loading splash
- `npm run icons` script added; sharp added as devDependency

### Fixed - ID-Based Landmark Linking

- Template points carry an immutable `templateId` (`<analysis>::<landmark>`); auto-created measurements store `refTemplateIds` alongside `refLabels`
- Renaming a landmark no longer breaks drag propagation (`syncRefDeps`), reference refresh (`refreshAutoMeasurements`), or template reload (duplicate detection matches `templateLabel`)
- Airway landmark lookups also match `templateLabel`/`templateId`
- `getMeasValue` now returns the type's primary measure (angle/length/area/value) instead of the first numeric value (x-coordinate); infinite-line refs fall back to segment length; calibration threaded through `refreshAutoMeasurements` (computed sums/differences stay in mm)
- 15 new tests in `src/test/templateLinking.test.js`

### Fixed - Research Units End-to-End (R8/R9)

- `unitForKey`/`dominantUnit` helpers in `collect.js`; units attached to reliability `details`, descriptive group/combined labels, comparative labels, longitudinal labels/changeScores/pairwise
- Unit columns in Reliability/Descriptive tables, unit headers in Comparative/Longitudinal views, and `Unit` columns in all four CSV exports
- Reliability and superimposition charts derive units from results (no more hardcoded "mm"/"px" mismatches)
- 13 new tests in `src/test/unitPropagation.test.js`

### Changed - CI & Tooling

- CI matrix updated to Node 20/22 (Vite 8 requires `^20.19.0 || >=22.12.0`; Node 18 removed); `engines` field added to package.json
- `react-hooks/set-state-in-effect` violation fixed — IDB-unavailable banner now seeds via lazy state initializer instead of setState in an effect body

### Changed - Documentation

- README/AGENTS refreshed: 459 tests / 21 files (per-file table), eight research modules, Zustand session store, Node 20/22 CI
- Historical audits (`CODE_REVIEW.md`, `cephalostudio_audit_report.md`, `cephalostudio_comprehensive_audit.md`) annotated with current-status banners; `gap-analysis.md` and `competitive-analysis.md` updated (superimposition/airway now shipped)

## [1.4.0] - 2026-07-30

### Added — Zustand State Management

- **toolStore** (`src/state/toolStore.js`): New Zustand store for tool/canvas state — `activeTool`, `zoom`, `pan`, `selectedId`, `selectedIds`, `activeSessionId`, `currentDraw`, `snapEnabled`, `placingMode`, `placingQueue`, `placingIdx`, `loadingImages`, `spotlightMode`
- **uiStore** (`src/state/uiStore.js`): New Zustand store for UI chrome state — modals, panels, overlays, display options, refLandmarks, context menu, filmstrip, comparison state, copiedMarkup. Merged state previously in `useWorkspaceUIState.js` hook.
- **`useStoreDispatch()`**: Stable dispatch hook using `getState()` (never subscribes) — no re-renders from dispatching
- **`workspaceStore.js`**: Rewritten as compat layer re-exporting both Zustand stores

### Changed — TopBar & Toolbar

- Both panels now read state from `useToolStore`/`useUIStore` with individual selectors and local `useStoreDispatch()`
- Store-state props eliminated from App.jsx (45 individual selector subscriptions replace the single monolithic destructure)
- `useWorkspaceUIState.js` hook removed (state merged into uiStore)

### Changed — ContextMenu

- Migrated to read `contextMenu`, `copiedMarkup`, `selectedIds`, `refLandmark1/2`, `showGrid` from stores directly
- App.jsx ContextMenu props reduced from 20 to 6
- `copiedMarkup` moved from `useState` into `uiStore`
- Now uses `useStoreDispatch()` and `useUIStore.setState()` for setters

### Changed — Dependencies

- Added `zustand` npm package

### Changed — Project Structure

- `src/state/` expanded: `toolStore.js`, `uiStore.js`, `workspaceStore.js`
- `src/hooks/useWorkspaceUIState.js` deleted
- `src/state/workspaceStore.js` rewritten (compat layer)

### Testing

- All 377 tests pass (17 test files, 0 failures)
- 0 lint errors (6 pre-existing exhaustive-deps warnings)
- Production build succeeds

---

## [1.3.0] - 2026-07-20

### Added — Superimposition / Growth Research Module (F3)
- Core engine in `src/research/superimposition.js` (~920 lines):
  - Procrustes alignment (Kabsch 2D with centroid, scale, rotation)
  - Structural alignment (rotation-only 2-point plane registration)
  - Alignment-aware displacement computation with error propagation
  - Rotation tracking (mandibular/palatal/occlusal/Y-axis planes)
  - Plane intersection angle analysis
  - Age/sex-stratified delta norms with z-scores (SNA, SNB, ANB, SN-MP, interincisal, U1-NA, L1-NB)
  - Clinical pattern detection (8 types: growth pattern, skeletal class, maxillary rotation, mandibular autorotation, dentoalveolar compensation, interincisal change, soft tissue profile, centroid size change)
  - Multi-timepoint longitudinal analysis (pairwise, trajectory, velocity)
  - Group-level research (per-landmark mean/SD/SE/CI)
  - Centroid size computation
- `SuperimpositionPanel.jsx` — Config + Results UI with 7 tabs (Displacements, Patterns, Growth, Delta Norms, Angular, Linear, Error)
- Integrated into engine.js, studyModel.js, ResultsDialog.jsx

### Added — Superimposition Charts
- `DisplacementBarPlot` — Horizontal bar of displacements sorted by magnitude
- `DisplacementPolarPlot` — Direction-coded horizontal bar (compass color)
- `DisplacementVectorField` — Scatter plot with scaled displacement arrows
- `RotationTrackingChart` — Bar chart with ±2° clinical threshold lines
- `PlaneAngleChart` — Dot plot of plane intersection angle changes
- `DeltaNormChart` — Grouped bars comparing observed vs expected delta
- `PatternRadarChart` — Severity-coded horizontal bar (mild/moderate/severe)
- All charts use Plotly basic-dist-compatible traces (scatter, bar)

### Added — Canvas Overlay for Session Comparison
- Session overlay with 3 alignment modes: 2-Point (manual anchors), Procrustes (all landmarks), Structural (user-selected plane)
- Displacement vectors with zoom-stable mm labels and color coding
- Vector scale slider (0.5×–5×) for visual amplification
- Tracking lines (dashed purple connecting base→compare positions)
- Hover tooltip with landmark name, mm, A/P, S/I decomposition
- Blend slider for overlay opacity

### Added — Structural Reference Plane Selection
- Canvas overlay structural mode: user picks any two landmarks from markups instead of hardcoded REFERENCE_PLANES
- Research panel structural mode: same two-point-select UI
- `runLongitudinalSuperimposition` now passes `planePoint1/planePoint2` correctly

### Added — Study Guide Modals
- `PanelGuideModal.jsx` — 17+ panel-specific guides (incl. superimposition, reliability, workspace)
- `StudyGuideModal.jsx` — 7 study-type-specific guides with interactive diagrams
- Superimposition guide covering alignment methods, output tabs, data requirements, tips

### Added — LUT Color Maps
- Magma, Inferno, Cividis colormaps
- Grayscale legend fix for all non-gray LUTs

### Added — Normative Database Editor (F7)
- Full editor for predefined norms in `src/norms.js`
- Add/edit/delete norm entries with automatic JSON formatting

### Added — Community Norms Contribution
- `public/contribute.html` subpage with form instructions
- Norms fetched from GitHub raw repository URL
- Contribution workflow documented

### Fixed — Superimposition Statistical Correctness (Critical)
- Angular changes delta was `T1 − T2` instead of `T2 − T1` — inverted in computeAngularChanges
- Linear changes delta was `T1 − T2` instead of `T2 − T1` — inverted in computeLinearChanges
- Centroid size `pctChange` was `(T1/T2 − 1)` instead of `(T2/T1 − 1)` — growth gave negative percentage
- Growth pattern classification labels swapped: clockwise↔counterclockwise, hyperdivergent↔hypodivergent
- Mandibular autorotation "opening bite"↔"closing bite" swapped
- Centroid size pattern never fired — `_centroidSize` was never attached to displacements array
- `structuralAlign` included unwanted scaling factor (changed to rotation-only, scale=1)
- `runLongitudinalSuperimposition` passed obsolete `referencePlane` key instead of `planePoint1/planePoint2`
- Panel angular/linear T1/T2 column header labels were swapped

### Fixed — Plotly Chart Compatibility
- Displacement Direction (Polar) and Clinical Pattern Profile charts used `scatterpolar` trace type which is not available in `plotly.js-basic-dist-min`
- Converted both to horizontal bar charts (basic-dist compatible)

### Fixed — Displacement Vector Zoom Stability
- Displacement mm values were computed in screen space (changed with zoom) instead of image space
- Fixed in `drawDisplacementVectors` (points + lines) and canvas hover tooltip
- All mm labels now derived from image-space coordinates — zoom-invariant

### Fixed — Sessions Panel Redundancy
- Removed duplicate "Structural" alignment mode (identical UI to 2-Point mode now that both use two-point selection)
- Sessions panel now offers 2-Point (manual anchors) and Procrustes (all landmarks)

### Changed — Project Structure
- `src/research/superimposition.js` added (new research module)
- `src/research/SuperimpositionPanel.jsx` added
- `src/research/StudyGuideModal.jsx` — updated superimposition sections
- `src/panels/PanelGuideModal.jsx` — added superimposition guide
- `src/state/workspaceStore.js` — added overlay state (alignMode, vectorScale, trackingLines)
- `src/App.jsx` — canvas draw loop updated for overlay, displacement, tracking lines
- `src/panels/SessionsPanel.jsx` — overlay UI with alignment, vector scale, tracking lines

### Testing
- All 300 tests pass (16 test files)
- 0 lint errors (1 pre-existing exhaustive-deps warning)

---

## [1.2.0] - 2026-07-14

### Added — Context Menu System
- Right-click context menu on canvas with type-sensitive options
- Markup actions: Focus, Rename, Change Color, Duplicate, Copy/Paste, Hide/Show, Lock/Unlock
- Ref Landmark 1/2 setting, Copy Measurement to clipboard, Move to Front/Back, Group/Ungroup, Delete
- Empty canvas actions: Paste, Select All, Calibrate, Fit to View, Toggle Grid
- Global click-outside / Escape to close; `data-cmenu` attribute guards

### Added — Grid Overlay
- Toggleable 50px grid on canvas via context menu or `showGrid` state
- Semi-transparent lines that pan/zoom with the viewport
- Zero-overhead when disabled (no grid drawing)

### Added — Group System
- `groupId` property on markups via Group/Ungroup context menu actions
- Grouped markups drag together automatically via `multiDragIdsRef`
- All group siblings move simultaneously when any member is dragged

### Added — Flash Highlight
- Pulsating golden ring animation (1.5s) when clicking a markup in the Markups panel
- `requestAnimationFrame` loop with automatic timeout/cancellation
- Prevents overlapping animations on rapid clicks

### Added — Calderation-Aware Norm Comparisons
- `generateInterpretation` skips linear/area measurement comparison when calibration is not done
- Warning banner in InterpretationPanel when uncalibrated
- Units display `px`/`px²` instead of `mm`/`mm²` in MarkupProps and MeasurementsPanel
- NormBadges, MeasurementsPanel, MarkupProps all guard against uncalibrated linear comparisons

### Added — refLabels Propagation System
- `syncRefDeps(label, dx, dy)` helper propagates point drags to all dependent markups via `refLabels`
- Wired into single-drag and multi-drag paths (runs BEFORE the point update to prevent stale closure overwrite)
- Works for all markup types: splines, polygons, beziers, circles, ellipses, tangents, arrows, lines, angles
- Auto-link threshold increased from 0.5px to 3px for better initial linking

### Added — Bezier CP Preservation
- Ctrl+click (add point) preserves existing CPs for unaffected segments; only generates CPs for the 2 affected segments
- Shift+click (remove point) preserves unaffected segment CPs; drops CPs for the merged segments
- Handles edge cases: appending at end, removing first/last anchor

### Fixed — Point Drag Regression
- `syncRefDeps` was called after `updMarkup` for the dragged point, causing stale closure overwrite
- Reordered: `syncRefDeps` runs before `updMarkup` so the point's move is the last update in the batch

### Fixed — Bezier Control Point Interaction
- Hit-test priority reversed: CPs checked before anchors (anchors were "shadowing" nearby CPs)
- CP hit-test added to `hitTest()` function (clicking CP now selects the bezier)
- CP visual size increased (4px unselected, 6px selected with border stroke; was 2.5/4)
- Hover state changes now trigger canvas redraw for immediate visual feedback
- Hit-test threshold increased from 8 to 12 screen pixels

### Fixed — Cursor Management
- Override `canvas.style.cursor` now respects activeTool and isPanning state
- Sets grab/grabbing/crosshair/pointer based on context
- Avoids redundant DOM writes (compares before setting)

### Fixed — Snap Indicator Visibility
- `snapPosRef` changes now trigger `scheduleRedrawRef.current()`
- Golden snap crosshair now appears reliably on mouse move
- `drawSnapIndicator` draws subtle circles around ALL nearby snap-eligible points (not just the target)

### Fixed — Pan Tool Cursor
- Cursor line now checks activeTool and sets "grab"/"grabbing" for pan tool
- No longer overwrites tool-based cursor with empty string

### Fixed — Test Count
- 269 tests across 15 files, all passing

### Fixed — Statistical Correctness (Critical)
- `betaCF` broken: missing `d=1/d` inversion + wrong `del=d*h` → `del=d*c`. Restored t/F/χ² correctness app-wide.
- `chi2CDF` upper branch off by factor of x (`a*ln(y)` → `(a-1)*ln(y)`). Normality, Mauchly, Hosmer-Lemeshow now detect violations correctly.
- Kruskal-Wallis & Friedman: replaced `1-fCDF(H,df,1e5)` with `1-chi2CDF(H,df)`. Non-parametric multi-group tests now significant when appropriate.
- `correlation.js` / `diagnostic.js`: replaced local `ibeta` stub with fixed `betaIncomplete`. Pearson/Spearman/regression/ROC p-values now correct.

### Fixed — Data Integrity
- Autosave no longer permanently loses images; IDB writes awaited before localStorage; failed images kept in envelope
- Orphan image blob GC on every save; `deleteOrphanBlobs` warm-diff + cold-scan
- IDB quota/unavailable: custom event fires, user-visible banner
- `importCephx`: version check, field validation, v2.0→v2.1 migration, `normalizeSessionImages` shared by import + export
- `cephxFormat.js`: comprehensive import validation, enhanced `validateCepht`
- `loadImage` + `importCephx`: `reader.onerror` paths added

### Fixed — Privacy & Security
- Auto-save now writes IDB before localStorage to prevent image loss on quota
- `console.error` gated behind `DEV` in clinical paths (App.jsx, imageStore, BatchImportModal)
- Session filmstrip uses Object URLs for thumbnails, not inline base64

### Changed — Mobile Toolbar
- Horizontal scroll row (collapsed bar) + expandable bottom sheet (2-col grid) for mobile
- Double-tap to place point and double-tap to finalize polygon/curve on mobile
- Two-finger tap to cancel placing mode
- Green ✓ "Finish" button in mobile toolbar when drawing polygon/curve
- Filmstrip hidden on mobile (`!isMobile&&` guard)

### Changed — Accessibility (A2, A4, A5, A7, A8)
- `Modal.jsx`: autofocus close button on mount, Tab focus trap, restore previous focus on unmount
- `SessionFilmstrip.jsx`: `role="option"` + `aria-selected` instead of `role="button"`; delete button appears on keyboard focus
- Theme buttons: `aria-pressed={theme===th.id}` on both App.jsx and HomePage.jsx
- Loading overlays: `role="status"` + `aria-live="polite"` on spinner and splash
- Placing-mode card: converted from canvas-drawn to floating React panel with `role="status"`

### Changed — Canvas & Rendering
- `redraw()` + `captureMarkupImage`: null-check `canvas.getContext("2d")`
- `pan` variable removed from React state; reads `panRef.current` (local variable shadow in `redraw`)
- `scheduleRedrawRef` pattern for stable callback from event handlers
- Undo snapshot shape unified: `pushUndo` and `handleMouseUp` both use `{markups, norms, placingMode, placingIdx, placingQueue}`
- Undo/redo: `undoVersion` state counter for reactive button state; fixed redo bug (restores full snapshot)
- `logError()` added to catch blocks in clinical modules

### Changed — Dependencies
- Removed redundant `plotly.js-dist-min` from package.json (kept `plotly.js-basic-dist-min`)
- KaTeX bundled from npm (was CDN-loaded)

### Added — Testing
- `statGoldenValues.test.js`: 18 reference-value regression tests for `fCDF`, `tDistributeCDF`, `chi2CDF`, `betaIncomplete`
- Test count: 103 → 269 (15 test files)
- Coverage thresholds added to vitest config (regression floor: 16% statements, 10% branches, 11% functions, 18% lines)

### Added — Documentation
- CI pipeline: npm audit, CodeQL security analysis, dependency review already present
- Coverage thresholds enforced in `vite.config.js`

### Changed — Documentation
- README: updated project structure, component hierarchy, line counts, test table, CI section, limitations
- CHANGELOG: updated test count to 269, corrected silhouette count to 23
- AGENTS.md: fixed stale `FormulasModule.jsx` reference → `panels.jsx`, updated test count, corrected line counts
- Removed stale docs: `Critical_Review.md`, `cephx_review_report.md`, `HONEYDOLIST.md`, `File Structure.md`

---

## [1.0.0] - 2026-07-03

### Added
- SEO meta tags, Open Graph, Twitter Card, canonical URL, theme-color
- robots.txt, sitemap.xml
- Vercel deployment configuration (SPA rewrites)
- PWA manifest (`site.webmanifest`) with icons
- Apple touch icon link
- Browser support documentation in README
- `onEnter()` keyboard utility in utils.js
- `aria-label` fallback to child text in `Btn` component
- `aria-label` on range slider inputs in `Sld` component
- `role="dialog"`, `aria-modal`, `aria-label`, Escape key handler in `Modal`
- `aria-pressed` on `ToolBtn` component
- `role="button"`, `tabIndex`, keyboard handlers (Enter/Space) on clickable divs
  — MarkupsPanel section headers, markup item selectors, formula LaTeX blocks,
    template cards, portal cards, recent case cards, session thumbnails
- `aria-current="page"` on active session thumbnail
- `aria-label` on toolbar buttons (theme selectors, spotlight, undo/redo,
  zoom in/out, fit to window, right-panel tabs, collapse toggle, delete buttons)

### Changed
- Version bumped 0.0.0 → 1.0.0
- Font `<link>` moved from runtime JSX to `index.html` `<head>`
  with preconnect hints for Google Fonts origins
- ESLint config now ignores `coverage/` directory

### Fixed
- 3 React `exhaustive-deps` warnings in App.jsx (formulas memoized,
  updMarkups wrapped in useCallback, missing deps added to keyboard effect)
- 9 lint errors in `scripts/svg-to-silhouette.js` (unused vars, process global)
- Removed dead `src/App.css` file

---

## [0.5.0] - 2026-06-XX

### Added
- Correlation module (Pearson, Spearman, regression, logistic regression)
  — CorrelationPanel.jsx, correlation.js
- Diagnostic test module (sensitivity, specificity, ROC, AUC, LR+, LR−)
  — DiagnosticPanel.jsx, diagnostic.js
- Results export: CSV download from all research module results
- Plotly-based charts: ICC forest plot, Bland-Altman plot, error map,
  distribution + normal curve, box plots, group means bar, effect size forest,
  p-value dot chart, longitudinal trajectories, change score chart
- `ResultsDialog` with Tables/Charts tabs for all 4 research modules
- `PlotlyChart` wrapper for dynamic Plotly.js loading

### Changed
- Research engine collects measurements across sessions with calibration
- Charts module refactored into `moduleCharts.jsx` + `moduleChartsUtils.jsx`

---

## [0.4.0] - 2026-06-XX

### Added
- Comparative statistics module:
  — Automatic test selection (normality + Levene's → parametric/non-parametric)
  — Independent/dependent t-tests, Mann–Whitney U, Wilcoxon signed-rank
  — One-way ANOVA, Kruskal–Wallis with post-hoc (Tukey HSD, Bonferroni)
  — Effect sizes: Cohen's d, Hedge's g, Glass's delta, rank-biserial, eta-squared
  — MANOVA support
  — ComparativePanel.jsx with config + results UI
- Longitudinal statistics module:
  — RM-ANOVA with Mauchly's sphericity test, GG/HF/LB epsilons
  — Linear mixed model (two-level REML estimation)
  — Pairwise Bonferroni comparisons
  — LongitudinalPanel.jsx with config + results UI
- Descriptive/normative statistics module:
  — Descriptive stats (mean, SD, median, IQR, range, skewness, kurtosis)
  — Reference intervals (90%, 95%, 99%)
  — Z-scores, norm deviation colors
  — Predefined norms integration
  — DescriptivePanel.jsx with config + results UI
- Reliability module:
  — ICC(2,1) with 95% confidence interval
  — Bland-Altman analysis (bias, limits of agreement, heteroscedasticity)
  — Dahlberg error, SEM, MDC
  — Landmark error mapping via 2×2 eigendecomposition
  — ReliabilityPanel.jsx with guided config + results UI

---

## [0.3.0] - 2026-06-XX

### Added
- Sessions data model (`session.js`, `project.js`)
  — Multi-session per project with metadata (subject, group, timepoint)
  — Active session switching, add/duplicate/remove
  — Reliability session creation (operator + trial linked)
- Session Filmstrip: floating bottom-center horizontal thumbnail bar
  — Session thumbnails with image previews
  — Active session highlighting with `aria-current`
  — Add/delete sessions inline
- Batch Import modal
  — Multi-image upload with CSV sidecar file parsing
  — Automatic session creation per row
- Home Page with portal cards (Lateral, AP, Other projections)
  — New Case form (name, patient ID, gender, ethnicity, etc.)
  — Startup Wizard
  — Recent cases grid with summary stats
  — Project import via `.cephx` drag-and-drop / file picker
- Project export/import (`.cephx` format v2.1)
- Template system (`.cepht` format v1.0 / v2.0)
  — Template library from predefined analyses
  — Import/export `.cepht` files
  — Subset editing (select/deselect points)
  — Measurement preview before loading
  — localStorage template library
- Silhouettes system
  — 23 SVG anatomical silhouettes (soft tissue, sella turcica, etc.)
  — Categorized with search
  — Insert as markup objects (positionable, resizable, rotatable)
- Examples panel with built-in example cases

### Changed
- Replaced version-based storage with session-based project model
- App.jsx refactored: removed dead database mode code

---

## [0.2.0] - 2026-05-XX

### Added
- Full canvas rendering pipeline
  — Zoom, pan, mouse coordinate tracking
  — Scaled coordinate system with `toImage`/`toScreen` transforms
  — Image processing: brightness, contrast, window width/center, edge enhancement
  — LUT presets (Gray, Bone, Hot Iron, PET, etc.) with invert
  — Scale bar overlay, LUT legend, snap indicator
  — Displacement vectors between marker sets
  — Airway overlay rendering
  — Annotation sizing control
  — Silhouette handle rendering (resize, rotate)
- 15 markup tools:
  — Select/Move, Pan, Landmark, Midpoint, Line, Parallel, Perp Point,
    Perp Distance, Angle 3-pt, Angle 4-pt, Polygon, Curve (B-Spline),
    Arrow, Text, Ruler
  — Drawing state machine (placement queue, multi-point shapes)
  — Snap-to-grid alignment
  — Replace mode for re-placing landmarks
- Calibration system (known mm → px/mm ratio)
- Measurement system:
  — Distance, angle (3-point and 4-point), polygon area/perimeter,
    perpendicular distance, curve length
  — Angle mode: signed/absolute/reflex × degrees/radians
  — Auto-measurement creation from predefined analyses
  — Composite measurements: ratio, difference, sum, percentage
- Real-time measurement display with norm deviation coloring
- Formula system (`FormulasModule.jsx`):
  — math.js expression editor with variable scope
  — KaTeX LaTeX rendering
  — Pin/unpin to measurements panel
  — Validation and missing variable detection
  — Automatic re-evaluation on scope change
- Predefined analyses for Lateral, AP, and Other projections
  — Landmark definitions with descriptions and default colors
- Undo/redo stack (50 levels)
- Auto-save to localStorage with debounce
- IndexedDB image storage (bypasses 5MB localStorage limit)

---

## [0.1.0] - 2026-05-XX

### Added
- React 19 + Vite 8 project scaffold
- Theme system with 4 themes (Plasticity, GitHub Dark, Paper, GitHub Light)
  — Consistent color tokens (bg, surf, tx, acc, err, ok, warn, etc.)
- Inline-style component library:
  — `Btn` (button with hover/active/danger/ghost variants)
  — `Sld` (range slider with label)
  — `Inp` (text/number input)
  — `PropRow` (label + content row)
  — `Tag` (color-coded badge), `Divider`, `PanelHeader`, `InfoBox`
- Geometry utilities (`utils.js`):
  — Distance, angle, midpoint, perpendicular, polygon area
  — B-Spline sampling, curve length, point alignment
  — Hit-testing for all markup types
  — Snap, clamp, bounding box utilities
- Statistics utilities (`utils.js`):
  — Shapiro-Wilk normality test
  — Levene's test for variance homogeneity
  — One-way ANOVA, F-distribution CDF
  — Paired t-test, Welch t-test, Mann–Whitney U, Wilcoxon signed-rank
  — Spearman/Pearson correlation
  — Bland-Altman analysis, ICC(2,1) with CI
  — Dahlberg error, SEM, MDC
  — Outlier detection (IQR, Z-score, MAD)
  — Confidence intervals, linear regression
  — Norm deviation and Z-score computation
- Clinical interpretation generator (`interpretation.js`)
- PDF report generation via jsPDF + autoTable
- CSV parser for analysis data import
- ESLint flat config with React hooks + refresh plugins
- GitHub Actions CI (Node 18, 20, 22) — lint, test, build
- Vitest test suite with jsdom environment (269 tests)
  — Utility tests (97), stat golden-value tests (18), comparative (18), descriptive (12), anonymize (10), validation (9), distributions (27), imageStore (14), MarkupsPanel, reliability, longitudinal, diagnostic, engine, secureStorage, cephxFormat tests
