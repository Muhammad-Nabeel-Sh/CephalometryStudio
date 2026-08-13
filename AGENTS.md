# AGENTS.md - CephaloStudio Development Guide

## Project Overview

CephaloStudio is a React + Vite application for cephalometric analysis (medical imaging analysis).

- **Framework**: React 19 with Vite 8
- **Styling**: Inline styles (no CSS framework)
- **Math**: mathjs for formulas, katex for LaTeX rendering
- **No TypeScript**, **300 tests (Vitest)**

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
```

**Vitest** is configured and used for all tests (matches Vite ecosystem).

---

## Code Style Guidelines

### Directory Structure

```
src/
├── App.jsx                     Root component (~1850 lines)
├── main.jsx                    Entry point
├── index.css                   Global styles
│
├── canvas/                     Canvas rendering + image processing
│   ├── redraw.js               Draw pipeline (createRedraw factory)
│   ├── drawMarkups.js          drawMarkup, drawMeasLabel, hitTest, drawAirwayOverlay
│   ├── imageUtils.jsx          LUT processing, getProcessed
│   └── imageProcessor.worker.js Web worker for image processing
│
├── data/                       Constants, norms, presets
│   ├── constants.js            THEMES, TOOLS, UNITS, PREDEFINED analyses
│   ├── norms.js                Normative data definitions
│   ├── normLibrary.js          Library norm browsing
│   ├── communityNorms.js       GitHub-fetched community norms
│   ├── silhouettes.js          Silhouette overlay data
│   └── examplesData.js         Example project data
│
├── hooks/                      Custom React hooks
│   ├── useKatex.js             KaTeX rendering (useKatex, KatexSpan, LatexFloatingPanel)
│   └── useMediaQuery.js        Responsive breakpoint hook
│
├── lib/                        Core utilities
│   ├── utils.js                Geometry, math, formatting, export (dist, angle3pt, buildPDF, etc.)
│   ├── interpretation.js       Clinical interpretation engine
│   └── logger.js               Logging utility
│
├── model/                      Data models
│   ├── csv.js                  CSV parsing
│   ├── project.js              Project data model
│   └── session.js              Session data model
│
├── panels/                     All UI panel components
│   ├── PanelContent.jsx        11-panel router
│   ├── panelIcons.jsx          PANEL_ICONS + PANEL_TABS (single source of truth)
│   ├── Toolbar.jsx             Desktop + mobile toolbar
│   ├── TopBar.jsx              Top bar (home, logo, save)
│   ├── RightPanelSidebar.jsx   Vertical tab sidebar
│   ├── SessionFilmstrip.jsx    Bottom-center thumbnail bar
│   ├── PanelGuideModal.jsx     Contextual help guides
│   ├── AirwayPanel.jsx         Airway analysis panel
│   ├── InterpretationPanel.jsx Clinical interpretation
│   ├── NormogramPanel.jsx      Normogram visualization
│   ├── HomePage.jsx            Home/start screen
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
│   ├── reliability.js          ICC, Bland-Altman, Dahlberg
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
│   ├── ResearchPanel.jsx       Research module router
│   ├── ResultsDialog.jsx       Floating results modal
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
│   └── secureStorage.js        Encrypted local storage
│
├── ui/                         Shared UI components
│   ├── Modal.jsx               Reusable modal
│   ├── ToolBtn.jsx             Toolbar button
│   ├── ContextMenu.jsx         Right-click context menu
│   └── ErrorBoundary.jsx       React error boundary
│
├── workspace/                  Workspace state logic
│   ├── markupHelpers.js        refreshAutoMeasurements, markupDefaults
│   ├── calibration.js          Ruler/manual calibration, CSV export
│   ├── template.js             autoCreateMeasurements, getMeasValue
│   └── images.js               Image loading + drop handling
│
└── test/                       Vitest test files (300 tests)
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
- **ResultsDialog**: Floating modal (normogram pattern) with Tables/Charts tabs for all 7 modules (incl. superimposition)
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

- **PWA/OS icon pipeline fixed**: Manifest referenced a missing PNG (`cephalostudio_logo_concepts.png` → 404) and relied on SVG icons (ignored by Android for install/splash). `scripts/generate-icons.mjs` (sharp) rasterizes the pure-vector `public/favicon.svg` to `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180), 7 iOS splash images, and `og-image.png`; manifest + index.html now reference them (apple-touch-startup-image links included). Note: `favicon_new.svg` embeds a 90×90 PNG, so it must NOT be used as a rasterization source.

### Ongoing

- **Remaining workspace-reducer migration** — `markups`, `calibration`, projects, sessions, undo/redo are still in App.jsx `useReducer`; should be migrated to Zustand stores for consistency

### Build Status

- `npm run build` — OK (chunk size warning is pre-existing, mathjs is large; plotly loaded as dynamic import)
- `npm run lint` — 0 errors, 6 pre-existing warnings in App.jsx only (`react-hooks/exhaustive-deps`)
- `npm test` — 446 tests pass (20 test files, 0 failures)
