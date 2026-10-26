# AGENTS.md - Cephalometry Studio Development Guide

## Project Overview

Cephalometry Studio is a React + Vite application for cephalometric analysis (medical imaging analysis).

- **Framework**: React 19 with Vite 8
- **Styling**: Inline styles (no CSS framework)
- **Math**: mathjs for formulas, katex for LaTeX rendering
- **No TypeScript**, **757 tests (Vitest)**

---

## Build / Lint / Dev Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Lint entire project
npm run lint

# Run lint on specific files
npx eslint src/App.jsx
npx eslint src/panels.jsx

# Run lint with auto-fix
npm run lint -- --fix

# Regenerate PWA/OS icons (PNGs from public/favicon.svg via sharp)
npm run icons

# Copy the onnxruntime-web UMD runtime + wasm into public/ort/ (offline AI trace)
# (run after `npm install onnxruntime-web` — used only to source the files)
npm run setup:ort
```

**Vitest** is configured and used for all tests (matches Vite ecosystem).

---

## Code Style Guidelines

### Directory Structure

```
src/
├── App.jsx                     Root component (~6150 lines)
├── main.jsx                    Entry point
├── index.css                   Global styles
│
├── canvas/                     Canvas rendering + image processing
│   ├── redraw.js               Draw pipeline (createRedraw factory)
│   ├── drawMarkups.js          drawMarkup, drawMeasLabel, hitTest, drawAirwayOverlay
│   ├── imageUtils.jsx          LUT processing, getProcessed
│   ├── imageProcessor.worker.js Web worker for image processing
│   └── landmarkDetector.js     ONNX landmark detection (main-thread, ORT UMD via <script>)
│
├── data/                       Constants, norms, presets
│   ├── constants.js            THEMES, TOOLS, UNITS, PREDEFINED analyses
│   ├── landmarkMap.js          CEPHA29 landmark vocabulary + app-label mapping
│   ├── landmarkModelInfo.js    Landmark model manifest (ONNX url/checksum/runtime)
│   ├── norms.js                Normative data definitions
│   ├── normLibrary.js          Library norm browsing
│   ├── communityNorms.js       GitHub-fetched community norms
│   ├── silhouettes.js          Silhouette overlay data
│   ├── examplesData.js         Example project data
│   ├── toolModes.js            Toolbar modes (Trace/Measure/Draw), tool hints + shortcuts
│   └── landmarkReference.js    Mean CEPHA29 shape for the guided-tracing reference map
│
├── hooks/                      Custom React hooks
│   ├── useKatex.jsx            KaTeX rendering (useKatex, KatexSpan, LatexFloatingPanel; CSS bundled from npm)
│   ├── useMediaQuery.js        Responsive breakpoint hook
│   ├── useFormulaEngine.js     Loads mathjs on first use; re-renders when ready
│   └── useDialogA11y.js        Focus/Tab trap/Escape for dialogs (shared stack, used by Modal)
│
├── lib/                        Core utilities
│   ├── utils.js                Geometry, math, formatting, export (dist, angle3pt, buildPDF, etc.)
│   ├── interpretation.js       Clinical interpretation engine
│   ├── landmarkModel.js        Model preprocessing + heatmap/regression decode
│   ├── measureConventions.js   Patient-facing frame + signed cephalometric geometry
│   ├── distributions.js        Normal CDF / quantile (single source)
│   ├── procrustes.js           procrustesAlign + centroid helpers (canvas overlay + superimposition)
│   └── logger.js               Logging utility
│
├── model/                      Data models
│   ├── csv.js                  CSV parsing
│   ├── project.js              Project data model
│   ├── patients.js             Home page: cases grouped by patient, timelines, search
│   └── session.js              Session data model
│
├── panels/                     All UI panel components
│   ├── PanelContent.jsx        11-panel router
│   ├── panelIcons.jsx          PANEL_ICONS + PANEL_TABS (single source of truth)
│   ├── Toolbar.jsx             Desktop (mode tabs, labelled tools) + mobile toolbar
│   ├── UndoHistory.jsx         Undo history list (under Undo/Redo)
│   ├── PlacingGuide.jsx        Guided tracing banner, reference map, magnifier
│   ├── TopBar.jsx              Top bar (home, logo, save)
│   ├── RightPanelSidebar.jsx   Vertical tab sidebar
│   ├── SessionFilmstrip.jsx    Bottom-center thumbnail bar
│   ├── PanelGuideModal.jsx     Contextual help guides
│   ├── AirwayPanel.jsx         Airway analysis panel
│   ├── InterpretationPanel.jsx Clinical interpretation
│   ├── NormogramPanel.jsx      Normogram visualization
│   ├── HomePage.jsx            Home screen: new case, patients (search + timelines)
│   ├── SettingsModal.jsx       All settings in one dialog
│   ├── StartupWizard.jsx       First-run wizard
│   ├── Modal.jsx               Reusable modal
│   ├── AnonModal.jsx           Anonymization dialog
│   ├── BatchImportModal.jsx    Multi-image import
│   ├── SessionMetadataModal.jsx Session metadata editor
│   ├── SessionsPanel.jsx       Session management + comparison
│   ├── MarkupsPanel.jsx        Markup list + properties
│   ├── MeasurementsPanel.jsx   Measurement table + norms
│   ├── FormulasPanel.jsx       Formula editor
│   ├── ImagePanel.jsx          Image processing controls
│   ├── LayersPanel.jsx         Layer management
│   ├── TemplatesPanel.jsx      Template browser
│   ├── SilhouettesPanel.jsx    Silhouette overlays
│   ├── MarkupProps.jsx         Markup property editor
│   ├── ExamplesPanel.jsx       Example projects browser
│   └── NormsReferenceModal.jsx Norm database browser
│
├── report/                     Export/PDF generation
│   ├── reportGenerator.js      PDF/DOCX/PNG export
│   ├── csvParser.js            CSV sidecar parsing
│   └── anonymize.js            PHI anonymization
│
├── research/                   Statistical analysis modules
│   ├── engine.js               Study runner (Web Worker)
│   ├── engine.worker.js        Worker thread
│   ├── engineClient.js         Worker client
│   ├── studyModel.js           Study type definitions
│   ├── statsCore.js            Core statistical functions
│   ├── validation.js           Input validation
│   ├── collect.js              Data collection
│   ├── resultsExport.js        Results export
│   ├── airway.js               Airway measurements + norms
│   ├── descriptive.js          Descriptive statistics
│   ├── reliability.js          ICC (6 forms, psych-verified), Bland-Altman, Dahlberg
│   ├── mixedModel.js           REML linear mixed model (random intercept/slope)
│   ├── sampleSize.js           A-priori sample size
│   ├── dataPreview.js          Study data matrix + tidy CSV
│   ├── comparative.js          t-tests, ANOVA, MANOVA
│   ├── correlation.js          Correlation + regression
│   ├── longitudinal.js         RM-ANOVA, LMM
│   ├── diagnostic.js           ROC/AUC, calibration
│   ├── superimposition.js      Procrustes, displacement, growth
│   ├── DescriptivePanel.jsx    Descriptive config + results
│   ├── ReliabilityPanel.jsx    Reliability config + results
│   ├── ComparativePanel.jsx    Comparative config + results
│   ├── CorrelationPanel.jsx    Correlation config + results
│   ├── LongitudinalPanel.jsx   Longitudinal config + results
│   ├── DiagnosticPanel.jsx     Diagnostic config + results
│   ├── SuperimpositionPanel.jsx Superimposition config + results (7 tabs)
│   ├── AirwayStudyPanel.jsx    Airway study config + results
│   ├── ResearchWorkspace.jsx   Full-screen studies workspace (list, stepper, run, blinding lock)
│   ├── StudyResultsView.jsx    Summary, caveats, APA text, glossary, tables/charts, exports
│   ├── studyState.js           Data fingerprint + study status (stale / current / …)
│   ├── studyWarnings.js        One ranked list of caveats per study
│   ├── studyReport.js          Plain-language summary + APA 7 methods/results/references
│   ├── studyReportExport.js    PDF (jsPDF) and Word report export
│   ├── studyDefaults.js        Remembered per-type settings + copy settings
│   ├── blinding.js             Sealed sessions during blinded reliability collection
│   ├── assignment.js           Assignment check, bulk group add, subjects from patient IDs
│   ├── glossary.js             Statistical term glossary per study type
│   ├── StudyGuideModal.jsx     Study-type guides
│   ├── PlotlyChart.jsx         Plotly wrapper
│   ├── moduleCharts.jsx        All chart components
│   └── moduleChartsUtils.jsx   Chart utility functions
│
├── state/                      Global state management (Zustand)
│   ├── toolStore.js            Tool/canvas state (activeTool, zoom, pan, selectedIds, etc.)
│   ├── uiStore.js              UI chrome state (modals, panels, overlays, refLandmarks, etc.)
│   ├── sessionStore.js         Active session data (markups, calibration, norms) + undo/redo
│   └── workspaceStore.js       Compat layer (re-exports stores + useStoreDispatch + useWorkspaceStore)
│
├── storage/                    Data persistence
│   ├── cephxFormat.js          Import/export validation
│   ├── imageStore.js           IndexedDB image storage
│   ├── modelCache.js           ONNX model download + SHA-256 + Cache Storage
│   └── secureStorage.js        Encrypted local storage
│
├── ui/                         Shared UI components
│   ├── Modal.jsx               Reusable modal
│   ├── ToolBtn.jsx             Toolbar button
│   ├── ContextMenu.jsx         Right-click context menu
│   ├── dialogs.js              askConfirm / askText / showInfo / notify (no window.alert/confirm/prompt)
│   ├── DialogHost.jsx          Renders dialogs + toasts (mounted once at the app root)
│   └── ErrorBoundary.jsx       React error boundary
│
├── workspace/                  Workspace state logic
│   ├── markupHelpers.js        refreshAutoMeasurements, markupDefaults
│   ├── calibration.js          Ruler/manual calibration, CSV export
│   ├── template.js             autoCreateMeasurements, getMeasValue
│   ├── autoTrace.js            AI auto-trace orchestration + batch insert
│   ├── aiReview.js             AI review state, review queue, provenance
│   ├── undoHistory.js          Describes undo steps (toasts + history list)
│   └── images.js               Image loading + drop handling
│
└── test/                       Vitest test files (757 tests; realistic fixtures in test/helpers/)
```

### File Organization

- React components: `.jsx` extension
- Utility functions: `.js` extension
- Main app entry: `src/App.jsx`
- Entry point: `src/main.jsx`

### Imports

- Use double quotes for imports: `import { useState } from "react";`
- Third-party imports first, then local imports
- Named exports preferred: `export function Foo() {}`
- Default export only for root component: `export default function App()`

### Components

- Use function components (no class components)
- Props destructured in function signature
- Component files use section comments: `// ═══════════════════════════════════════════════════════════════════════════════`
- Helper/utility functions defined before components in same file

### State Management

- `useState` for local state
- `useRef` for DOM refs and mutable values (canvas, file inputs)
- `useCallback` for event handlers passed as props
- `useMemo` for expensive computations
- `useEffect` for side effects (canvas resize, image loading)
- **Zustand** stores for global state:
  - `toolStore.js` — tool/canvas state (activeTool, zoom, pan, selection, placing, etc.)
  - `uiStore.js` — UI chrome state (panels, modals, overlays, display options, etc.)
  - `sessionStore.js` — active session data (markups, calibration, norms, formulas, processing, sessionImage) + undo/redo
- `useStoreDispatch()` is a stable dispatch (uses `getState()`, never subscribes) — pass `{ type: "SET", payload: { ... } }`
- Components subscribe to individual store slices with selectors: `useToolStore(s => s.activeTool)`, `useSessionStore(s => s.markups)`
- Session data syncs bidirectionally: when active session changes → `loadFromSession()` populates the store; when store mutates → `_onChange` callback syncs back to the project

### Naming Conventions

- Components: PascalCase (`HomePage`, `Workspace`, `MarkupsPanel`)
- Functions/hooks: camelCase (`useKatex`, `computeMeasurements`)
- Constants: camelCase or SCREAMING_SNAKE_CASE per context
- CSS classes: kebab-case (when used)
- Theme object keys: camelCase (`accent`, `surf2`, `bdr`)

### Theme System

The codebase uses a `THEMES` object with consistent color properties:

```javascript
const THEMES = {
  dark: { name, id, bg, surf, surf2, surf3, bdr, tx, tx2, tx3, acc, acc2, accMuted, err, ok, warn, shadow },
  light: { /* ... */ },
  bluish: { /* ... */ },
};
```

- Always pass theme object as `t` prop
- Use theme colors: `t.acc` (accent), `t.err` (error), `t.ok` (success), `t.warn` (warning)

### Inline Styles

This codebase uses inline styles exclusively:

```jsx
<div style={{ display: "flex", gap: 12, color: t.tx, background: t.surf }}>
  <span style={{ fontSize: 13, color: t.tx2 }}>Text</span>
</div>
```

- Always quote style property values: `"flex"`, not `flex`
- Use theme variables for colors
- Numeric values without units default to pixels
- Use `borderRadius` with numeric values (4, 6, 8, etc.)
- Use `clamp()` for responsive font sizes in style strings

### Error Handling

- Try-catch with empty catch blocks for non-critical operations: `try { ... } catch {}`
- Return `null` from functions that can fail: `catch { return null; }`
- Use optional chaining for nested property access: `calibration?.done`
- Nullish coalescing when needed: `markups || []`

### Canvas/Drawing Code

- Use `ctx.save()` / `ctx.restore()` for drawing state isolation
- Calculate scaled coordinates: `p.x * zoom + pan.x`
- Use `useRef` for canvas element and mutable drawing state
- Debounce expensive redraws with `useCallback`

### MathJS Usage

```javascript
import * as math from "mathjs";
// Compile expressions for safe evaluation
const compiled = math.compile(expression);
const result = compiled.evaluate(scope);
```

- Validate results: check `typeof result === "number"` and `isFinite(result)`
- Build scope from markup measurements using `buildScope()`

### KaTeX Usage

- Load KaTeX CSS via CDN dynamically (see `useKatex` hook)
- Render with `throwOnError: false` to prevent crashes
- Use `output: "html"` for inline rendering

### ID Generation

- Use `uid()` function for generating unique IDs: `Math.random().toString(36).slice(2, 10)`

---

## Project-Specific Patterns

### Markup Data Model

```javascript
{
  id: string,          // unique ID
  type: string,       // "point", "line", "polygon", "angle3", "bezier", etc.
  points: [{x, y}],   // coordinate array
  label: string,      // user-visible label
  color: string,      // hex color
  visible: boolean,
  locked: boolean,
  refLabels: string[], // auto-linked point labels (3px tolerance)
  groupId: string,    // optional group ID for bulk drag
  // type-specific properties (cp for bezier, tangentAngle for tangent, etc.)
}
```

### Calibration

```javascript
{
  done: boolean,
  pxPerMm: number,    // pixels per millimeter
  knownMm: string,
}
```

### Measurement Values & Sign Conventions

- **Read values through `primaryMeasure(m, cal, ctx)`** (`lib/utils.js`) — never "the first numeric key" of
  `computeMeasurements()`: it always emits `x`/`y` (first point, raw px) before the real measure. Research
  collectors use `sessionPrimaryMeasure(session, m, cal)` from `research/collect.js`.
- Signed measures are computed in the **patient frame** (`lib/measureConventions.js`): +x = anterior. Pass
  `{ facing: resolveFacing(session.facing, markups) }` as the third argument of `computeMeasurements`/`primaryMeasure`.
- Conventions: template perp distances positive = anterior (superior for near-horizontal lines); projected
  distance (Wits) positive when the first point is anterior; ANB/A-N-Pog positive when the first ray is anterior;
  Downs convexity = 180° − N-A-Pog (convex +); Downs AB-plane negative when B is posterior to A.
- 4-point angles use **directed** vectors: the CSV reference order decides θ vs 180° − θ. Add new angle4 rows so
  the mean-skull plausibility test (`measureConventions.test.js`) stays green.

### Measurement Types

- `length`: distance in mm if calibrated, px otherwise (calibration-dependent)
- `angle`: degrees (3-point or 4-point, calibration-independent)
- `area`: polygon area in mm² if calibrated, px² otherwise
- `perimeter`: polygon perimeter in mm if calibrated, px otherwise
- `distance`: perpendicular distance in mm if calibrated, px otherwise
- `computeMeasurements()` returns `_unit: "mm"` or `"px"` on every result object
- ANB signed-angle uses `m.measure === "ANB"` structural flag (falls back to `m.label`)

### Predefined Analyses

Stored in `PREDEFINED` object with keys: `lateral`, `ap`, `other`
Each analysis has `{ name, pts: [{ l, def, color }] }`

---

## File Format

- Projects exported as `.cephx` JSON files with `format: "cephx", version: "2.1"`
- Templates exported as `.cepht` JSON files with `format: "cepht"` — two versions:
  - `version: "1.0"` — definitions only (labels, types, colours, no point coordinates)
  - `version: "2.0"` — definitions + placed point coordinates (full template)

---

## ESLint Configuration

Located in `eslint.config.js`:

- Flat config format (ESLint 9+)
- Extends: recommended JS, react-hooks, react-refresh
- Custom rule: `no-unused-vars` ignores vars starting with `_` or uppercase
- Ignores: `dist/` directory

---

## Common Development Tasks

### Adding a new markup type

1. Add to `TOOLS` array in `data/constants.js` with id, icon, label, key
2. Add rendering logic in `canvas/drawMarkups.js` (`drawMarkup()` function)
3. Add measurement logic in `lib/utils.js` (`computeMeasurements()`) if applicable
4. Add hit-testing in `canvas/drawMarkups.js` (`hitTest()` function)
5. Add drawing-in-progress in `canvas/drawMarkups.js` (`drawInProgress()`) if multi-point

### Adding a new theme

1. Add entry to `THEMES` object in `data/constants.js` with all color properties
2. Add theme button in `panels/Toolbar.jsx`

### Modifying formula system

1. Formula evaluation in `App.jsx` (mathjs compile/evaluate)
2. Formula display in `panels/FormulasPanel.jsx`
3. Scope building in `lib/utils.js` (`buildScope()` function)

### Adding a context menu action

1. Add handler function inside the context menu component in `src/ui/ContextMenu.jsx`
2. Add `item(label, onClick, danger?)` call in the appropriate section
3. Wire through any required state/refs

---

## IDE Configuration (VS Code / Cursor)

Recommended settings for `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.associations": {
    "*.jsx": "javascriptreact"
  }
}
```

---

## Progress Summary

### Done

- **Folder reorganization**: Root-level 22 files → 3 files (App.jsx, main.jsx, index.css). All modules organized into `canvas/`, `data/`, `hooks/`, `lib/`, `model/`, `panels/`, `report/`, `research/`, `state/`, `storage/`, `ui/`, `workspace/`
- **Code refactoring**: App.jsx 2400 → 1700 lines. Extracted: `canvas/redraw.js` (draw pipeline), `panels/PanelContent.jsx` (11-panel router), `panels/panelIcons.jsx` (single source of truth), `panels/Toolbar.jsx` + `TopBar.jsx` + `RightPanelSidebar.jsx` (layout), `hooks/useWorkspaceUIState.js` (bundled state), `workspace/undo.js` + `markupHelpers.js` + `calibration.js` + `template.js` + `images.js` (workspace logic)
- **Panel extraction**: `panels.jsx` split into 10 individual files in `panels/` (MarkupsPanel, MeasurementsPanel, ImagePanel, LayersPanel, FormulasPanel, TemplatesPanel, SilhouettesPanel, MarkupProps, ExamplesPanel, NormsReferenceModal)
- **Hooks extraction**: `hooks.jsx` split into `hooks/useKatex.js` (useKatex, KatexSpan, LatexFloatingPanel)
- **Phase 4 — Research Module Framework**: Created `src/research/` with `studyModel.js`, `engine.js`
- **Reliability module**: ICC(2,1) with 95% CI (F-based, exact fCDF inversion), Bland-Altman (with VIF for 3+ occasion bias CI), Dahlberg/SEM/MDC, landmark error mapping via 2×2 eigendecomposition — config + results UI (`ReliabilityPanel.jsx`)
- **Descriptive/Normative module**: descriptive stats, reference intervals, z-scores, predefined norms (single source in `src/norms.js`) — config + results UI (`DescriptivePanel.jsx`)
- **Comparative module**: test selection (normality+Levene's → route), parametric/non-parametric tests, post-hoc (Tukey HSD via studentized range CDF / Bonferroni), effect sizes auto-selected, MANOVA (Box's M, Wilks/Pillai/Hotelling/Roy via Jacobi eigendecomposition) — config + results UI (`ComparativePanel.jsx`)
- **Longitudinal module**: RM-ANOVA with Mauchly's sphericity test (orthonormal Helmert contrasts), GG/HF/LB epsilons, LMM (two-level pseudo-REML with cluster-robust SEs), pairwise Bonferroni — config + results UI (`LongitudinalPanel.jsx`)
- **Correlation module**: Pearson/Spearman, partial correlation, linear/logistic regression (Newton-Raphson with step-halving, separation detection), VIF, diagnostic plots — config + results UI (`CorrelationPanel.jsx`)
- **Diagnostic module**: ROC/AUC with DeLong CI, optimal thresholds (Youden/F1/distance/accuracy), Hosmer-Lemeshow calibration, logistic composite index, cross-validated AUC (LOOCV/k-fold, seeded PRNG for reproducibility) — config + results UI (`DiagnosticPanel.jsx`)
- **Superimposition/Growth module** (F3): Procrustes + structural alignment (rotation-only 2-point), alignment-aware displacements with error propagation, rotation tracking (mandibular/palatal/occlusal/Y-axis), plane intersections, delta norms (age/sex-stratified), clinical pattern detection (8 pattern types), multi-timepoint longitudinal analysis, group-level research, centroid size — config + results UI (`SuperimpositionPanel.jsx`) with 7 tabs, engine in `superimposition.js` (~920 lines)
- **Charts module** (`moduleCharts.jsx`): ICC forest plot, Bland-Altman plot, Error map, Distribution+normal curve, Box plots, Group means bar, Effect size forest, P-value dot chart, Longitudinal trajectories, Change score chart, Displacement bar/polar/vector field, Rotation tracking bar, Plane angle dot, Delta norm bar, Pattern severity bar (all Plotly basic-dist-compatible)
- **Research workspace (A1–A16)**: the studies module opens full screen (`ResearchWorkspace.jsx`; replaces `ResearchPanel` + `ResultsDialog`) with a Setup → Check data → Run → Results stepper, stale-result detection by data fingerprint, ranked caveats, plain-language summary, APA 7 methods/results text with references, glossary, tables/charts side by side, copy/CSV/PDF/Word export, run progress with cancel, rename/notes/duplicate/archive/delete-with-undo, saved per-type defaults, assignment checks, subjects built from patient IDs, session scope, and blinded reliability collection (sealed sessions are covered on the canvas, unsealing is logged and reported). 20 tests in `src/test/studyWorkflowLogic.test.js`
- **Study guides**: `PanelGuideModal.jsx` — 17+ guides (incl. superimposition); `StudyGuideModal.jsx` — 7 study-type-specific guides with diagrams
- **Guide Dialog Boxes**: PanelGuideModal.jsx with superimposition guide; StudyGuideModal.jsx covers all 7 research modules
- **New LUTs**: magma, inferno, cividis color maps; grayscale legend fix
- **Normative Database Editor** (F7): Full editor for predefined norms in `src/norms.js`
- **Community Norms Contribution**: `public/contribute.html` subpage, norms fetched from GitHub raw
- **`addMarkup()` auto-links refLabels** by detecting matching point labels within 3px tolerance; `refreshAutoMeas()` applies to any `refLabels` bearer regardless of `autoCreated`
- **`syncRefDeps(label, dx, dy)`**: propagates point drags to all dependent markups via `refLabels` — keeps splines, polygons, beziers, circles, ellipses, tangents, arrows attached to their reference points
- **Sessions model** (`session.js`, `project.js`) replacing versions and repro trials
- **Templates**: `.cepht` v2.0 export with point coords, validation, measurement preview, subset editing, localStorage library
- **Session Filmstrip**: floating bottom-center horizontal thumbnail bar (max 5 visible, scrollbar)
- **Batch Import**: multi-image + CSV sidecar parsing
- **Data Integrity & Storage (D1-D8)**:
  - `saveProjects` rewritten: IDB writes awaited before localStorage; failed images kept in envelope (D1); orphan GC on every save (D2); IDB-unavailable / quota banner via custom event (D3)
  - `cephxFormat.js` (new): import validation, v2.0→v2.1 migration, `normalizeSessionImages` shared by import + export (D4); version constants + enhanced `validateCepht` (D5)
  - `loadImage` + `importCephx` reader.onerror paths (D8)
  - Session filmstrip uses Object URLs for thumbnails, not inline base64 (D7)
  - `imageStore.js`: `idbAvailable()` gate, `{ok, error}` return from `storeImageBlob`, `deleteOrphanBlobs` (warm diff + cold scan), `getAllImageKeys`, schema-migration scaffolding in `onupgradeneeded` (D2/D3/D6)
- **23 markup types**: point, line, angle3, angle4, perp, parallel, polygon, curve, ellipse, arc, circle, bezier, tangent, concentric, ruler, ratio, sum, difference, percentage, projDist, text, arrow, midpoint, perp pt, silhouette
- **Bezier CP preservation**: Ctrl+click (add) and Shift+click (remove) preserve existing CPs for unaffected segments; only auto-generate CPs for the 1–2 affected segments
- **Right-click context menu**: Focus, Rename, Change Color, Duplicate, Copy/Paste, Hide/Show, Lock/Unlock, Ref Landmark 1/2, Copy Measurement, Move to Front/Back, Group/Ungroup, Delete, Calibrate, Fit to View, Select All, Toggle Grid
- **Grid overlay**: Toggleable 50px grid on canvas via context menu
- **Group system**: `groupId` property on markups; grouped markups drag together
- **Flash highlight**: Pulsing golden ring (1.5s) when clicking markup from the Markups panel
- **Calibration-aware norms**: `generateInterpretation` skips linear measurement comparison when calibration is not done; units show `px` instead of `mm`; `computeMeasurements()` returns `_unit` on every result; warning banners in InterpretationPanel and MeasurementsPanel
- **Cursor management**: Context-aware cursor (pointer on hoverables, grab for pan, crosshair for drawing tools)
- **Code review (C1–C17 clinical correctness)**: Fixed `computeMeasurements` unit propagation; calibration reset on image load; validation in `finalizeCalib`; CSV/panel unit display; PDF disclaimer + PHI gate; merged norms into single `src/norms.js`; SD-banded interpretation (not mean-banded); ANB structural flag; U1-L1/Interincisal alignment; Convexity disambiguation; 2D magnification warning in CalibModal
- **Code review (S1–S15 statistical correctness)**: Fixed Cohen's dz (was undefined); BH adjustment direction (was reversed); ICC uses exact fCDF (was Paulson approx); ICC unbalanced-data handling; seeded PRNG for cross-validation; logistic regression singular-matrix bail-out; consolidated tCritical; HL small-n warning; LMM conservative df; Bland-Altman VIF; MANOVA fractional df; studentized range CDF quadrature improvement
- **Golden-value tests**: 31 new tests in `src/test/researchGolden.test.js` covering basic stats, t-test, ANOVA, Mann-Whitney, Wilcoxon, Spearman, BH adjustment, Shapiro-Wilk, Cohen's d, ICC, Dahlberg, linear regression against R/published references
- **Superimposition statistical/clinical audit**: Fixed angular/linear deltas (were T1−T2 instead of T2−T1); centroid size pctChange inverted; growth pattern classification labels swapped (clockwise↔counterclockwise, hyper↔hypo); mandibular autorotation "opening"↔"closing" inverted; centroid size pattern never fired (was looking up `displacements._centroidSize` which was never set); `runLongitudinalSuperimposition` passed obsolete `referencePlane` key instead of `planePoint1/planePoint2`; `structuralAlign` included unwanted scale (changed to rotation-only); panel T1/T2 column header labels swapped for angular and linear tables
- **Zustand stores (toolStore/uiStore)**: Replaced monolithic `useWorkspaceStore` with two Zustand stores — `toolStore` (tool/canvas state: activeTool, zoom, pan, selection, placing mode, loading, spotlight) and `uiStore` (UI chrome: modals, panels, overlays, display options, refLandmarks, context menu, filmstrip, comparison state). `useStoreDispatch()` is stable (uses `getState()`, never subscribes) — no re-renders from dispatching. `workspaceStore.js` is now a compat layer re-exporting both stores.
- **TopBar + Toolbar migration**: Both panels read state from `useToolStore`/`useUIStore` with individual selectors, and use local `useStoreDispatch()`. Store-state props eliminated from App.jsx (45 individual selector subscriptions replace the single monolithic destructure). `useWorkspaceUIState.js` hook removed (state merged into `uiStore`).
- **ContextMenu migration**: Reads `contextMenu`, `copiedMarkup`, `selectedIds`, `refLandmark1/2`, `showGrid` from stores directly. App.jsx props reduced from 20 → 6. `copiedMarkup` moved from `useState` into `uiStore`.
- **Dependency added**: `zustand` npm package.

- **ID-based landmark linking**: Template points get an immutable `templateId` (`<analysis>::<landmark>`); auto-created measurements store `refTemplateIds` alongside `refLabels`; `refreshAutoMeasurements` + `syncRefDeps` resolve by templateId → templateLabel → label (legacy fallback). Renaming a landmark no longer breaks dependent measurements or drag propagation. Template reload is duplicate-proof after renames (label OR templateLabel match). Airway landmark lookups also match templateLabel/templateId. 15 new tests in `src/test/templateLinking.test.js`
- **`getMeasValue` correctness**: Now returns the type's primary measure (angle/length/area/value) instead of the first numeric value (x-coordinate); infinite-mode line refs fall back to segment length; `refreshAutoMeasurements` threads calibration through (computed sums/differences stay in mm)
- **`PREDEFINED_NORMS` collision resolved**: Alias removed from `constants.js`; consumers (`MeasurementsPanel`, `NormsReferenceModal`) import `DEFAULT_NORMS` directly from `norms.js` (single source of truth; `descriptive.js` already used `RESEARCH_NORMS`)

- **PWA/OS icon pipeline fixed**: Manifest referenced a missing PNG (`Cephalometry Studio_logo_concepts.png` → 404) and relied on SVG icons (ignored by Android for install/splash). `scripts/generate-icons.mjs` (sharp) rasterizes the pure-vector `public/favicon.svg` to `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180), 7 iOS splash images, and `og-image.png`; manifest + index.html now reference them (apple-touch-startup-image links included). Note: `favicon_new.svg` embeds a 90×90 PNG, so it must NOT be used as a rasterization source.

- **Research units end-to-end (R8/R9)**: `unitForKey`/`dominantUnit` helpers in `collect.js`; units attached to reliability `details`, descriptive group/combined labels, comparative labels, longitudinal labels/changeScores/pairwise; Unit columns in Reliability/Descriptive/Comparative/Longitudinal panels + CSV exports; reliability + superimposition charts derive units from results instead of hardcoded "mm"; 13 new tests in `src/test/unitPropagation.test.js`

- **AI auto-trace (in-browser, landmark model)**: ONNX inference runs on the main thread in `canvas/landmarkDetector.js`; the ORT UMD runtime is self-hosted under `public/ort/` and loaded via a `<script>` tag (public files can't be module-imported through Vite), exposing `window.ort`. Pure preprocessing (grayscale→resize→optional ImageNet normalization) + heatmap/regression decode live in `lib/landmarkModel.js`; model manifest in `data/landmarkModelInfo.js`; weights fetched (SHA-256 verified, Cache Storage) via `storage/modelCache.js`. `data/landmarkMap.js` defines two vocabularies — `isbi19` (default, cwlachap HRNet-W32, MIT) and `cepha29` (CephaloHRNet) — mapping symbols onto in-app template labels and providing a deterministic demo detector used when no runtime/weights are configured. `workspace/autoTrace.js` inserts detected points (`placed:true`, linked by `templateId`) + auto-measurements as one undo step; "AI Trace" button + verify banner in `MarkupsPanel` (demo runs are labelled as non-anatomical placeholders). Conversion/training pipeline in `scripts/convert-hrnet19-onnx.py` + `scripts/export-landmark-onnx.py` + `scripts/setup-ort.mjs` (npm `setup:ort`) + `scripts/train-cepha29/README.md`. The 19-landmark model was converted and verified locally: FP32 `public/models/landmarks-hrnet19.onnx` (109 MB) + INT8 `.int8.onnx` (28 MB); ORT runtime in `public/ort/` (both gitignored). Defaults point at `/models/landmarks-hrnet19.int8.onnx` + `/ort/ort.min.js`. Browser-verified end-to-end (headless Chrome): ORT script load → session → inference `[1,19,192,192]`. Decoding uses **DARK** (Gaussian-smoothed log-heatmap + Taylor refinement) in `lib/landmarkModel.js` — the main accuracy win; measured on 20 ISBI test images (offline harness `scripts/eval-landmark-model.py`): **INT8+DARK ≈ 2.6 mm MRE / ~41% SDR@2 mm**, vs ~3.1 mm / 33% for argmax decoding. FP32 gives the same MRE; TTA (flip/scale) did **not** help and CLAHE was neutral, so both were dropped. The JS DARK decoder was cross-checked against the Python reference (max Δ ≈ 0.05 mm). 42 new tests (`landmarkMap`, `landmarkModel`, `shapeModel`, `autoTrace`, `modelCache`). A **statistical shape model (SSM)** refinement (`lib/shapeModel.js`; PCA prior `data/shapeModel.isbi19.json` built by `scripts/build-shape-model.py` from 350 ISBI shapes) projects predictions onto the shape subspace (pose-invariant, confidence-weighted, ±3σ clipped): measured **MRE 2.27 mm / ~52% SDR@2 mm** (further ~14% MRE cut, +10 pp SDR@2), verified against the Python reference (max Δ ≈ 0.008 mm). Note: `onnxruntime-web`/PyPI are blocked in the sandbox; wheels were fetched directly from PyPI and the ORT dist from jsDelivr to build this.

- **CEPHA29 (A3) training tooling**: `scripts/train-cepha29/kaggle-notebook.ipynb` trains a 29-landmark HRNet-W32 on CEPHA29 via CephaloHRNet on a free Kaggle T4 (768², pretrained backbone, AMP) then exports ONNX; `scripts/export-landmark-onnx.py` now emits **web-compatible static QDQ INT8** (dynamic → ConvInteger → unusable in onnxruntime-web) with `--calib-dir` + `--verify`; `scripts/build-shape-model.py --set cepha29` builds the 29-landmark SSM prior; `scripts/eval-landmark-model.py` gained a `--set cepha29` path. `lib/shapeModel.js` now holds a per-set prior registry (`registerShapeModel`/`getShapeModel`) and `landmarkDetector` refines only when a prior exists for the active set. Activate by training → exporting → hosting the weights, then setting `landmarkSet: "cepha29"`, `enabled: true` in `landmarkModelInfo.js` (plus the Phase-2 CSP/asset work). 2 new tests. **Fixed a latent channel-order bug**: the app previously listed `CEPHA29` in a semantic order that did not match the trained model's output channels; it is now aligned to CephaloHRNet `data/dataset.py` `LANDMARK_SYMBOLS` (alphabetical) across `data/landmarkMap.js`, `export-landmark-onnx.py`, `eval-landmark-model.py`, `build-shape-model.py`, the notebook/README, and the `landmarkMap` order test.
- **CEPHA29 model live (Part C)**: the trained model is activated end-to-end. `LANDMARK_MODEL` now uses `landmarkSet: "cepha29"`, `inputSize: 768`, `inputChannels: 3`, `enabled: true`, with weights hosted on Hugging Face (`MuhammadNabeelSh/cephalometry-landmarks`, static-QDQ INT8, SHA-256 pinned `f7f1db9c…`). The SSM prior `data/shapeModel.cepha29.json` (700 shapes, K=10, 74.5% var) is registered in `lib/shapeModel.js`. The ORT runtime is committed under `public/ort/` (`ort.wasm.min.js` + `ort-wasm-simd-threaded.{mjs,wasm}`, ~11 MB; wasm EP, loaded via `<script>`). `vercel.json` CSP adds `'wasm-unsafe-eval'` and HF hosts to `connect-src`. Browser-verified end-to-end: HF fetch (CORS, 29.7 MB) → session → inference `[1,29,192,192]`.
- **Decoupled AI Trace (analysis modal)**: AI auto-trace places **all 29** detected landmarks with **no template** (the 6 previously-unmapped CEPHA29 symbols now map: `R, LPM, LMT, UPM, UMT, N\`` → `R, LPM, LMT, UPM, UMT, N'`), then `panels/AnalysisModal.jsx` asks which analysis to apply — showing, per analysis, how many landmarks the AI supplied, which still need manual placement, and ready/total measurements. On pick, `workspace/template.applyAnalysis` enriches matched points (defs/colours/templateIds), queues the undetected landmarks for manual placement, and instantiates only the measurements whose landmarks are all placed; it sets `session.analysisTemplate` so Measurements/Norm/Interpretation align. Detection is decoupled from analysis (no template mutation). `runAutoTrace` no longer takes `templateName`; the manual-placement handler also filters to ready measurements to avoid placeholder-coordinate values. 6 new tests.

- **Tracing workspace (B1–B6)**: toolbar modes with labelled tools (`data/toolModes.js`); guided tracing with reference map, magnifier, Skip/Back/Unsure (`panels/PlacingGuide.jsx`, `data/landmarkReference.js`); label collision layout with leader lines (`beginLabelLayout`/`layoutLabels`/`flushLabelLayout` in `canvas/drawMarkups.js`, uiStore `labelLayout`/`labelsActiveOnly`); AI review queue (`reviewQueue`/`nextToReview`/`confirmPoint`); visible undo (`workspace/undoHistory.js`, `panels/UndoHistory.jsx`); in-app dialogs replace browser pop-ups — use `ui/dialogs.js`, never `window.alert/confirm/prompt` (except `ErrorBoundary`). 16 tests in `src/test/workspaceUx.test.js`

- **App-wide UX (C1–C3, C5, C6)**: patient-centred home page (`model/patients.js`), Settings dialog (`panels/SettingsModal.jsx`; uiStore `PREF_KEYS` persisted to `cephalo_prefs_v1`), WCAG-AA theme colours (`src/test/themeContrast.test.js`), 12 px text floor + focus ring + touch targets in `index.css` (opt out with `data-small`), `useDialogA11y` for every dialog, stylus/finger handling (`FINGER_SLOP`), lazy loading of research/report/mathjs/KaTeX. `evalFormula` returns null until `loadFormulaEngine()` has run — components use `useFormulaEngine()`. C4 (Arabic/RTL) deferred. 6 tests in `src/test/appWideUx.test.js`, 1 in `formulaEngine.test.js`, 4 in `themeContrast.test.js`

### Ongoing

- **Remaining workspace-reducer migration** — session data (`markups`, `calibration`, norms, formulas, undo/redo) now lives in the Zustand `sessionStore`; only `projects`/`sessions` root state remains as App.jsx `useState`. Consider migrating those last.

### Build Status

- `npm run build` — OK (chunk size warning is pre-existing, mathjs is large; plotly loaded as dynamic import)
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 757 tests pass (47 test files, 0 failures)




