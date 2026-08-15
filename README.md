# Cephalometry Studio

A web-based cephalometric analysis application for orthodontics and maxillofacial surgery. Built with React 19, Vite 8, and Canvas 2D. Supports image markup, calibration, formula computation, template library, batch import, session metadata management, and seven research analysis modules (reliability with guided workflow, descriptive/normative, comparative, longitudinal, correlation, diagnostic, superimposition/growth).

---

## Browser Support

Minimum browser versions required:

| Browser | Version |
| ------- | ------- |
| Chrome  | 80+     |
| Firefox | 90+     |
| Safari  | 14+     |
| Edge    | 80+     |

Requires ES2020 support, Canvas 2D, and IndexedDB. Not supported in Internet Explorer.

---

## 1. Technology Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Framework  | React 19 (function components, hooks)                   |
| Build Tool | Vite 8                                                  |
| Rendering  | HTML5 Canvas 2D (manual redraw pipeline)                |
| Styling    | Inline styles (no CSS framework), theme objects         |
| Math       | mathjs (formula evaluation), custom stats               |
| LaTeX      | KaTeX (CDN-loaded, lazy)                                |
| Testing    | Vitest 4 + @testing-library/react, code coverage via v8 |
| CI         | GitHub Actions (3 Node versions, lint → test → build)   |
| Linting    | ESLint 9 flat config, react-hooks, react-refresh        |
| Language   | JavaScript (JSX), no TypeScript                         |

---

## 2. Project Structure

```
├── index.html
├── vite.config.js              # Vite + React plugin + Vitest config
├── eslint.config.js
├── package.json
├── .github/workflows/test.yml  # CI pipeline
├── public/
├── Data/                       # CSV reference data
├── src/
│   ├── main.jsx
│   ├── App.jsx                 # Root component (~1844 lines)
│   ├── main.jsx                # Entry point
│   ├── index.css               # Global styles
│   ├── canvas/                 # Canvas rendering + image processing
│   │   ├── redraw.js           Draw pipeline (createRedraw factory)
│   │   ├── drawMarkups.js      drawMarkup, drawMeasLabel, hitTest, drawAirwayOverlay
│   │   ├── imageUtils.jsx      LUT processing, getProcessed
│   │   └── imageProcessor.worker.js Web worker for image processing
│   ├── data/                   # Constants, norms, presets
│   │   ├── constants.js        Themes, tools, predefined analyses
│   │   ├── norms.js            Normative data definitions
│   │   ├── normLibrary.js      Library norm browsing
│   │   ├── communityNorms.js   GitHub-fetched community norms
│   │   ├── silhouettes.js      23 SVG anatomical silhouettes
│   │   └── examplesData.js     Example project data
│   ├── hooks/                  # Custom React hooks
│   │   ├── useKatex.js         KaTeX rendering
│   │   └── useMediaQuery.js    Responsive breakpoint hook
│   ├── lib/                    # Core utilities
│   │   ├── utils.js            Math, geometry, formatting, export
│   │   ├── interpretation.js   Clinical interpretation engine
│   │   └── logger.js           PHI-safe logging
│   ├── model/                  # Data models
│   │   ├── session.js          Session data model
│   │   ├── project.js          Project model with session CRUD
│   │   └── csv.js              CSV model helpers
│   ├── state/                  # Global state (Zustand)
│   │   ├── toolStore.js        Tool/canvas state (activeTool, zoom, pan, selection)
│   │   ├── uiStore.js          UI chrome state (modals, panels, overlays)
│   │   └── workspaceStore.js   Compat layer re-exporting both stores
│   ├── storage/
│   │   ├── imageStore.js       IndexedDB wrapper for image blobs
│   │   ├── cephxFormat.js      Import/export validation, migration
│   │   └── secureStorage.js    Encrypted storage utilities
│   ├── panels/
│   │   ├── Modal.jsx           Accessible modal with focus trap
│   │   ├── HomePage.jsx        Project list, create/import portal
│   │   ├── StartupWizard.jsx   First-run guided setup
│   │   ├── Toolbar.jsx         Desktop + mobile toolbar
│   │   ├── TopBar.jsx          Top bar (home, logo, save)
│   │   ├── RightPanelSidebar.jsx  Vertical tab sidebar
│   │   ├── SessionFilmstrip.jsx
│   │   ├── SessionsPanel.jsx   Session cards, subjects tab
│   │   ├── SessionMetadataModal.jsx  Spreadsheet-style metadata editor
│   │   ├── BatchImportModal.jsx
│   │   ├── MarkupsPanel.jsx    Markup list + properties
│   │   ├── MeasurementsPanel.jsx Measurement table + norms
│   │   ├── FormulasPanel.jsx   Formula editor
│   │   ├── ImagePanel.jsx      Image processing controls
│   │   ├── LayersPanel.jsx     Layer management
│   │   ├── TemplatesPanel.jsx  Template browser
│   │   ├── SilhouettesPanel.jsx Silhouette overlays
│   │   ├── PanelContent.jsx    11-panel router
│   │   ├── panelIcons.jsx      Panel icon/tab definitions
│   │   ├── PanelGuideModal.jsx Contextual help guides
│   │   ├── NormogramPanel.jsx
│   │   ├── InterpretationPanel.jsx
│   │   ├── NormsReferenceModal.jsx Norm database browser
│   │   ├── ExamplesPanel.jsx   Example projects browser
│   │   ├── MarkupProps.jsx     Markup property editor
│   │   └── AirwayPanel.jsx     Airway analysis panel
│   ├── research/
│   │   ├── studyModel.js       # Study configuration model
│   │   ├── engine.js           # Research engine orchestrator
│   │   ├── engine.worker.js    # Web Worker for async research
│   │   ├── engineClient.js     # Worker client wrapper
│   │   ├── collect.js          # Measurement collection helpers
│   │   ├── validation.js       # Research input validation
│   │   ├── reliability.js      # ICC, Bland-Altman, Dahlberg, error mapping
│   │   ├── descriptive.js      # Descriptive stats, reference intervals, z-scores
│   │   ├── comparative.js      # t-tests, ANOVA, MANOVA, post-hoc, test routing
│   │   ├── longitudinal.js     # RM-ANOVA, LMM, sphericity, change scores
│   │   ├── statsCore.js        # Core statistical functions
│   │   ├── correlation.js      # Correlation & regression
│   │   ├── diagnostic.js       # Diagnostic performance metrics
│   │   ├── airway.js           # Airway measurements + norms
│   │   ├── superimposition.js  # Procrustes/structural alignment, displacement, patterns, delta norms
│   │   ├── ReliabilityPanel.jsx
│   │   ├── DescriptivePanel.jsx
│   │   ├── ComparativePanel.jsx
│   │   ├── LongitudinalPanel.jsx
│   │   ├── CorrelationPanel.jsx
│   │   ├── DiagnosticPanel.jsx
│   │   ├── SuperimpositionPanel.jsx
│   │   ├── AirwayStudyPanel.jsx
│   │   ├── ResearchPanel.jsx
│   │   ├── StudyGuideModal.jsx
│   │   ├── ResultsDialog.jsx   # Floating modal with Tables/Charts tabs
│   │   ├── PlotlyChart.jsx     # Dynamic Plotly.js loader
│   │   ├── moduleCharts.jsx    # SVG chart rendering
│   │   ├── moduleChartsUtils.jsx
│   │   └── resultsExport.js
│   └── test/
│       ├── setup.js
│       ├── utils.test.js           # 97 tests
│       ├── researchGolden.test.js  # 31 tests
│       ├── distributions.test.js   # 27 tests
│       ├── cephxFormat.test.js     # 40 tests
│       ├── comparative.test.js     # 18 tests
│       ├── statGoldenValues.test.js # 18 tests
│       ├── imageStore.test.js      # 14 tests
│       ├── descriptive.test.js     # 12 tests
│       ├── anonymize.test.js       # 10 tests
│       ├── validation.test.js      # 9 tests
│       ├── diagnostic.test.js      # 5 tests
│       ├── engine.test.js          # 5 tests
│       ├── secureStorage.test.js   # 5 tests
│       ├── reliability.test.js     # 3 tests
│       ├── longitudinal.test.js    # 3 tests
│       ├── MarkupsPanel.test.jsx   # 3 tests
│       └── NormsReferenceModal.test.jsx # 3 tests
```
**Total: 377 tests across 17 test files**

### Scripts

```bash
npm run dev            # Vite dev server (HMR)
npm run build          # Production build → dist/
npm run preview        # Preview production build
npm run lint           # ESLint check
npm test               # Run tests (Vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Test + coverage report
```

---

## 3. Architecture Overview

### Component Hierarchy

```
App
├── HomePage              # Project list, create/import portal
├── StartupWizard         # First-use guided setup
└── Workspace             # Main editor
    ├── TopBar            # Top bar (home, logo, save)
    ├── Toolbar           # Desktop + mobile toolbar palette
    ├── Canvas            # Image + markup rendering
    ├── ContextMenu       # Right-click context menu
    ├── SessionFilmstrip  # Session thumbnail bar (bottom, desktop only)
    ├── RightPanel        # Tabbed side panel
    │   ├── MarkupsPanel, MarkupProps
    │   ├── MeasurementsPanel
    │   ├── FormulasPanel
    │   ├── ImagePanel
    │   ├── LayersPanel
    │   ├── SessionsPanel
    │   ├── TemplatesPanel
    │   ├── SilhouettesPanel
    │   ├── ResearchPanel # 8 sub-tabs: Reliability / Descriptive / Comparative / Longitudinal / Correlation / Diagnostic / Superimposition / Airway
    │   ├── InterpretationPanel
    │   ├── NormogramPanel
    │   └── AirwayPanel
    ├── Modals: Calib, Text, Anon, BatchImport, SessionMetadata, NormsReference, Examples, PanelGuide, StudyGuide
    ├── ResultsDialog     # Floating modal with Tables/Charts tabs
    └── NormogramPanel    # SVG normogram visualization
```

### State Management

- **Global Zustand stores**: `toolStore` (tool/canvas state) and `uiStore` (UI chrome state) — components subscribe to individual slices via selectors, avoiding re-renders from unrelated state changes
- **Root state**: `projects` array + `activeId` (React useState)
- **Workspace (useReducer)**: markups, calibration, processing, LUT, image loading — remaining reducer in App.jsx pending migration to Zustand
- **Undo/Redo**: In-memory stacks of markup snapshots
- **Auto-save**: Debounced localStorage (500ms), key `"cephalo-autosave"`, cleared on `.cephx` export
- **Project updates**: `updateProject(id, patch)` cascades with `modified` timestamp

### Data Model

```
Project
├── id, name, projection, created, modified
├── meta { patientId, name, dob, age, gender, ... }
├── accessControl { requirePin, pinHash }
├── calibration { done, pxPerMm, knownMm }
├── markups[]              ← primary annotation data
├── processing { brightness, contrast, windowWidth, windowCenter, edgeEnhance }
├── lutMode, lutInvert
├── formulas[]             ← { id, expression, label }
├── norms[]                ← { label, mean, sd, markupLabel }
├── sessions[]             ← replaces old versions model
│   └── { id, name, calibration, markups, processing, ... }
├── images[]
└── templateId
```

### File Formats

- **`.cephx`**: `{ format: "cephx", version: "2.1", exported, project }`
- **`.cepht`** (v1.0): `{ format: "cepht", version: "1.0", name, markups: [{ label, type, def, color }], formulas, norms }` — definitions only, no point coordinates
- **`.cepht`** (v2.0): `{ format: "cepht", version: "2.0", name, markups: [{ label, type, def, color, points, placed }], formulas, norms }` — definitions + placed point coordinates

---

## 4. Markup System

### Markup Types

| Type                                          | Points   | Measurement                       | Visual                            |
| --------------------------------------------- | -------- | --------------------------------- | --------------------------------- |
| `point`                                       | 1        | —                                 | Dot with label                    |
| `line` / `parallel`                           | 2        | Length (mm)                       | Segment with infinite extension   |
| `perp`                                        | 4        | Perpendicular distance            | Distance from point to line       |
| `projDist`                                    | 4        | Signed projection distance        | Projection onto line              |
| `midpoint`                                    | 2        | —                                 | Midpoint dot                      |
| `perppoint`                                   | 3        | —                                 | Perpendicular point marker        |
| `arrow`                                       | 2        | Length                            | Directional arrow                 |
| `angle3`                                      | 3        | Angle (degrees, signed for ANB)   | Arc between 3 points              |
| `angle4`                                      | 4        | Angle (degrees, 4-point)          | Arc between two lines             |
| `polygon`                                     | 3+       | Area (mm²), Perimeter (mm)        | Filled polygon                    |
| `curve`                                       | 2+       | Length (Catmull-Rom spline)       | Smooth curve                      |
| `ellipse`                                     | 3        | Major/minor axis, area, perimeter | Ellipse fit                       |
| `arc`                                         | 3        | Arc length, radius, arc angle     | Arc segment                       |
| `circle`                                      | 2        | Radius, circumference, area       | Circle                            |
| `bezier`                                      | 2+       | Length (multi-segment cubic)      | Cubic bezier with control handles |
| `tangent`                                     | 2        | Length                            | Tangent line snapped to curve     |
| `concentric`                                  | 3        | Multi-ring arc                    | Concentric arcs                   |
| `ruler`                                       | 2        | Calibration reference             | Dashed line (excluded from stats) |
| `ratio` / `sum` / `difference` / `percentage` | —        | Composite value                   | Computed measurement              |
| `text`                                        | 1        | —                                 | Text label at position            |
| `silhouette`                                  | variable | Area, perimeter                   | SVG anatomical path               |

### Drawing Flow

1. User selects tool → `activeTool` set
2. Canvas click → `currentDraw` accumulates points
3. Tool completes → `finalizeMarkup()` creates markup with auto-label
4. Markup added via `addMarkup()` → automatic `refreshAutoMeas()` for dependent measurements
5. Undo/redo: `pushUndo()` snapshots markups before each change

### Hit Testing

- Point hit: distance ≤ radius (6px default)
- Line hit: perpendicular distance ≤ tolerance
- Polygon hit: point-in-polygon test
- Curve hit: distance to sampled spline points

---

## 5. Canvas Rendering Pipeline

Canvas manually managed via `useRef` + `useCallback`:

1. **`redraw()`**: Clears canvas, iterates all images and markups
2. **Image rendering**: `getProcessed()` cached result (brightness, contrast, LUT, edge enhance)
3. **Markup rendering**: `drawMarkup()` per type — points, lines, angles, polygons, curves, text
4. **Drawing in progress**: `drawInProgress()` shows temporary geometry
5. **Snap indicators**: Visual cue for snap targets
6. **Scale bar**: Drawn in viewport coordinates
7. **Annotations**: Markup labels rendered at computed positions

**Optimization**: Processed images cached in `procCache` (Map keyed by `${imgId}-${processing}-${lutMode}-${lutInvert}`). DPR-aware: `canvas.width = displayWidth * devicePixelRatio`. Canvas auto-resizes via `ResizeObserver`.

---

## 6. Calibration System

Two modes:
1. **Ruler calibration**: User draws ruler markup with known physical length → `pxPerMm = knownMm / rulerPixels`
2. **Manual calibration**: User enters `pxPerMm` directly

Once calibrated (`calibration.done = true`), all measurements convert from pixels to millimeters.

---

## 7. Image Processing Pipeline

| Operation    | Parameter                     | Range                                        |
| ------------ | ----------------------------- | -------------------------------------------- |
| Brightness   | `brightness`                  | -100 to 100                                  |
| Contrast     | `contrast`                    | -100 to 100                                  |
| Window/Level | `windowWidth`, `windowCenter` | 0-255                                        |
| Edge Enhance | `edgeEnhance`                 | 0-100 (unsharp mask kernel)                  |
| LUT Mode     | `lutMode`                     | gray, hot, cool, jet, viridis, bone, rainbow |
| Invert       | `lutInvert`                   | boolean                                      |

Processing applied per-image on Canvas `ImageData` pixel array. Results cached by composite key.

---

## 8. Formula System

- **Scope building**: `buildScope(markups, calibration)` creates variable map from all markup measurements
- **Evaluation**: `evalFormula(expression, scope)` uses `mathjs.compile()` for safe evaluation
- **Display**: KaTeX renders formulas as LaTeX (loaded lazily via CDN)
- **Predefined formulas**: Stored with `label`, `expression`, `katex` fields
- **Custom formulas**: Users add via editor, stored in `formulas[]`
- **Error handling**: Returns null on invalid expressions, empty catch blocks for non-critical failures

---

## 9. Predefined Analyses

Defined in `src/constants.js` as `PREDEFINED`:

- **`lateral`**: 10 analyses (General Ceph, Steiner, Ricketts, McNamara, Downs, Bjork, Tweed, Jarv-Bjork, Wits)
- **`ap`**: 6 analyses (Ricketts PA, General PA, Grummons, Hewitt, Svanholt-Solow, Grayson Multiplane)
- **`other`**: Grouped projections (SMV, OPG, TMJ views, Waters, Caldwell, Towne's, Hand-Wrist, CBCT)

Each analysis has `{ name, pts: [{ l, def, color }] }` and optional lines. Templates saved as `.cepht` files and loaded to auto-populate the markup panel with landmark placeholders.

---

## 10. Session Metadata Management

Managed via the **Session Metadata Modal** (spreadsheet-style table):

| Feature         | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Field columns   | Subject, Group, Timepoint, Patient ID, Operator                                                              |
| Dropdowns       | Populated from project-level managed lists; "Custom..." for ad-hoc values                                    |
| Batch assign    | Select multiple rows (shift-click) → batch action bar applies subject/group/timepoint/operator/patientId     |
| Filename parser | Auto-detect delimiters in filenames like `{patient}_{group}_{timepoint}.jpg` with preset patterns            |
| Preset buttons  | Groups (Treatment/Control/A/B), Timepoints (T0–T5/Baseline/6mo), Operators (Rater 1/2, Reader A/B), Subjects |
| Quick-status    | Visual tags per session indicating calibration state, markup count                                           |

Managed value lists stored on the project: `project.groups`, `project.timepoints`, `project.operators`. Study panels consume these via "From Managed" buttons.

---

## 11. Research Modules

Seven integrated research modules accessed via the Research Panel. Each follows a config → run → results pattern with a shared `ResultsDialog` for tables and charts. All modules support "From Managed" buttons to consume project-level groups/timepoints/operators.

### Reliability Module (`ReliabilityPanel.jsx` + `reliability.js`)

Guided multi-operator data collection workflow:

| Feature              | Description                                                                             |
| -------------------- | --------------------------------------------------------------------------------------- |
| ICC(2,1)             | Absolute agreement with 95% CI via Shrout & Fleiss                                      |
| Bland-Altman         | Mean bias, LoA, proportional bias regression, CI for limits                             |
| Dahlberg / SEM / MDC | Random error, standard error of measurement, minimal detectable change                  |
| Landmark Error Map   | Per-landmark centroid, radial error, 95% confidence ellipse from 2×2 eigendecomposition |
| Designs              | Intra-operator, inter-operator, method comparison                                       |
| Guided workflow      | ▶ Run Study → sequential operator→trial→case steps with progress tracking               |
| Clone sessions       | Each operator×trial gets a clean session copy (same image, independent markups)         |
| Auto-navigate        | "Open & Create" creates clone session and navigates to it in the workspace              |
| Occasion options     | 1–3 trials per operator (single trial for inter-operator)                               |
| Operator progress    | Per-operator bar with done/total counts                                                 |

**Workflow flow**: Configure operators/occasions/cases → click "Run Study" → for each step (Operator A / Trial 1 / Case 1, etc.), click "Open & Create" → place markups on clean canvas → "Complete & Next" → auto-advances. After all steps, run analysis for ICC/Bland-Altman/SEM.

### Descriptive / Normative Module (`descriptive.js`)

| Feature             | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| Descriptive Stats   | N, mean, SD, SEM, variance, min, max, median, Q1, Q3, IQR, percentiles |
| Reference Intervals | Parametric (mean ± 1.96 SD) and non-parametric (order statistics)      |
| Z-Scores            | Deviation from norm with percentile rank and clinical severity         |
| Predefined Norms    | Steiner, Downs, McNamara reference values                              |
| Normality Test      | D'Agostino-Pearson from skewness + kurtosis                            |
| Grouping            | By group, operator, or patient                                         |

### Comparative Module (`comparative.js`)

| Feature           | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Test Selection    | Routes: normality + Levene's → parametric or non-parametric                              |
| 2-group tests     | Independent t-test, Welch's t-test, Mann-Whitney U, Paired t-test, Wilcoxon signed-rank  |
| Multi-group tests | One-way ANOVA, Kruskal-Wallis, Repeated measures ANOVA, Friedman test                    |
| Post-hoc          | Tukey HSD, Bonferroni-corrected pairwise                                                 |
| Effect Sizes      | Cohen's d, Cohen's dz, rank-biserial r, η², ω², partial η², Kendall's W, epsilon-squared |
| MANOVA            | Wilks' lambda, Pillai's trace, Hotelling's trace, Roy's largest root                     |
| Corrections       | Bonferroni, Benjamini-Hochberg                                                           |

### Longitudinal Module (`longitudinal.js`)

| Feature       | Description                                             |
| ------------- | ------------------------------------------------------- |
| RM-ANOVA      | Repeated measures ANOVA with Mauchly's sphericity test  |
| Corrections   | Greenhouse-Geisser, Huynh-Feldt, Lower-bound epsilon    |
| LMM           | Two-level linear mixed model (random intercept + slope) |
| Pairwise      | Bonferroni-corrected paired comparisons                 |
| Change Scores | Mean change, SD, SEM, MDC, p-value per timepoint pair   |
| Model Types   | RM-ANOVA only, mixed model, or both                     |
 
### Superimposition / Growth Module (`superimposition.js`)

| Feature             | Description                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alignment           | Procrustes (all matching landmarks) or Structural (rotation-only, 2 user-selected plane points)                                                      |
| Displacement        | Per-landmark distance, direction, A/P and S/I decomposition with color coding                                                                        |
| Error Propagation   | Typical landmark error propagated through displacement; significance ratio and confidence levels                                                     |
| Rotation Tracking   | Mandibular, palatal, occlusal plane, Y-axis angle changes                                                                                            |
| Plane Intersections | Angle between reference planes (SN, mandibular, palatal)                                                                                             |
| Delta Norms         | Age/sex-stratified expected change values for SNA, SNB, ANB, SN-MP, interincisal, U1-NA, L1-NB                                                       |
| Clinical Patterns   | 8 pattern types: growth pattern, skeletal class, maxillary rotation, mandibular autorotation, compensation, interincisal, soft tissue, centroid size |
| Longitudinal        | Multi-timepoint pairwise trajectories and displacement velocity                                                                                      |
| Group-Level         | Per-landmark mean, SD, SE, 95% CI across cases                                                                                                       |
| Output Tabs         | Displacements, Patterns, Growth, Delta Norms, Angular, Linear, Error                                                                                 |

---

## 12. Sessions & Templates

### Sessions Model

Replaces the old versions system. A project contains multiple sessions, each with its own calibration, markups, and processing state. Sessions are managed through dedicated UI (filmstrip, session selector) and support the full markup lifecycle.

### Templates (.cepht)

- **v2.0** format with point coordinates, measurement preview, subset editing
- **Validation** against predefined analyses
- **Library** stored in localStorage for quick access
- **Export/Import** individual templates or full projects

### Batch Import

Multi-image import with optional CSV sidecar parsing for batch data ingestion.

---

## 13. Sessions Filmstrip

Floating bottom-center horizontal thumbnail bar showing all sessions. Supports quick navigation, add/delete, and visual indicators for calibrated vs. uncalibrated sessions.

---

## 14. Testing & CI

### Test Suite (377 tests, 17 files)

| Test File                      | Tests | Coverage                                                                                                                       |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| `utils.test.js`                | 97    | All geometry, statistics, formulas, ICC, Bland-Altman utilities                                                                |
| `cephxFormat.test.js`          | 40    | Import/export format validation                                                                                                |
| `researchGolden.test.js`       | 31    | Golden-value tests for t-test, ANOVA, Mann-Whitney, Wilcoxon, Spearman, BH, Shapiro-Wilk, Cohen's d, ICC, Dahlberg, regression |
| `distributions.test.js`        | 27    | Statistical distributions                                                                                                      |
| `statGoldenValues.test.js`     | 18    | Reference-value regression guards for fCDF, tDistributeCDF, chi2CDF, betaIncomplete                                            |
| `comparative.test.js`          | 18    | Test selection routing, Mann-Whitney, Wilcoxon, Box's M, multi-group structure                                                 |
| `imageStore.test.js`           | 14    | IDB image storage                                                                                                              |
| `descriptive.test.js`          | 12    | `runDescriptiveAll`, norm stratum selection, predefined norms                                                                  |
| `anonymize.test.js`            | 10    | PHI anonymization                                                                                                              |
| `validation.test.js`           | 9     | Cepht validation                                                                                                               |
| `diagnostic.test.js`           | 5     | Diagnostic tests                                                                                                               |
| `engine.test.js`               | 5     | Research engine                                                                                                                |
| `secureStorage.test.js`        | 5     | Secure storage                                                                                                                 |
| `reliability.test.js`          | 3     | ICC computation, Landmark error map                                                                                            |
| `longitudinal.test.js`         | 3     | RM-ANOVA, error handling                                                                                                       |
| `MarkupsPanel.test.jsx`        | 3     | Component smoke tests                                                                                                          |
| `NormsReferenceModal.test.jsx` | 3     | Component smoke tests                                                                                                          |

### CI Pipeline (`.github/workflows/test.yml`)

Runs on push/PR to main:
1. **Test matrix** — `npm ci` → `npm run lint` → `npm test` → `npm run build` across Node 18, 20, 22
2. **Audit** — `npm audit --omit=dev --audit-level=high` (blocks on high/critical)
3. **CodeQL** — GitHub semantic security analysis (security-extended queries)
4. **Dependency Review** — Blocks PRs introducing high/critical vulnerabilities

### Code Coverage

```bash
npm run test:coverage   # Generates text + lcov + html reports
```

---

## 15. Statistical Engine (src/utils.js)

### Descriptive Statistics

| Function                      | Description                       |
| ----------------------------- | --------------------------------- |
| `mean(arr)`                   | Arithmetic mean                   |
| `variance(arr, m)`            | Sample variance                   |
| `stdev(arr, m)`               | Standard deviation                |
| `median(arr)`                 | Median                            |
| `iqr(arr)`                    | Interquartile range (Q1, Q3, IQR) |
| `skewness(arr)`               | Fisher skewness                   |
| `kurtosis(arr)`               | Excess kurtosis                   |
| `coefficientOfVariation(arr)` | CV as percentage                  |

### Inferential Statistics

| Function                              | Description                        |
| ------------------------------------- | ---------------------------------- |
| `shapiroWilk(arr)`                    | Shapiro-Wilk normality test        |
| `oneWayAnova(...groups)`              | One-way ANOVA                      |
| `tTestPaired(arr1, arr2)`             | Paired t-test                      |
| `calculateICC(values)`                | ICC (2,1) with interpretation      |
| `calculateICC_CI(icc, n, k)`          | ICC confidence interval            |
| `dahlbergError(arr1, arr2)`           | Dahlberg random error              |
| `blandAltman(arr1, arr2)`             | Bland-Altman analysis              |
| `pearsonCorrelation(arr1, arr2)`      | Pearson r                          |
| `spearmanCorrelation(arr1, arr2)`     | Spearman rank correlation          |
| `correlationMatrix(datasets)`         | Pairwise correlation matrix        |
| `linearRegression(xVals, yVals)`      | Linear regression with R², p-value |
| `detectOutliers(arr, method)`         | IQR or Z-score outlier detection   |
| `confidenceInterval(arr, confidence)` | CI for mean                        |
| `normDeviation(value, norm)`          | Z-score and SD interpretation      |
| `standardError(arr, icc)`             | Standard error of measurement      |
| `minimalDetectableChange(sem)`        | MDC at 95% confidence              |

### Distribution Functions

| Function                  | Description                 |
| ------------------------- | --------------------------- |
| `gammaLn(x)`              | Log gamma (Lanczos)         |
| `betaIncomplete(a, b, x)` | Regularized incomplete beta |
| `betaCF(a, b, x)`         | Continued fraction for beta |
| `tDistributeCDF(t, df)`   | Student's t CDF             |
| `fCDF(f, d1, d2)`         | F-distribution CDF          |
| `normalCDF(x)`            | Standard normal CDF         |
| `normalQuantile(p)`       | Inverse normal CDF          |

---

## 16. Geometry & Canvas Utilities

| Function                                                     | Description                         |
| ------------------------------------------------------------ | ----------------------------------- |
| `dist(a, b)`                                                 | Euclidean distance                  |
| `angle3pt(p1, vtx, p2)`                                      | 3-point angle (degrees)             |
| `angle4pt(p1, p2, p3, p4)`                                   | 4-point angle (degrees)             |
| `perpDist(pt, a, b)`                                         | Perpendicular distance              |
| `polyArea(pts)`                                              | Shoelace formula                    |
| `polyLen(pts, closed)`                                       | Polygon perimeter / polyline length |
| `perpPoint(p, a, b)`                                         | Foot of perpendicular               |
| `projectedDistance(ptA, ptB, lineP1, lineP2)`                | Signed projection distance          |
| `vpts(m)`                                                    | Filter valid markup points          |
| `snapPoint(ip, markups, r, enabled)`                         | Snap to nearest point               |
| `snapToLine(ip, markups, r)`                                 | Snap to nearest line                |
| `computeMeasurements(m, cal)`                                | Type-specific measurement           |
| `catmullRom(ctx, pts, closed)`                               | Draw Catmull-Rom spline             |
| `sampleSpline(pts, closed, samplesPer)`                      | Sample B-spline points              |
| `splineArea(pts)` / `splineLen(pts, closed)`                 | B-spline area/length                |
| `alignOnePoint(src, dst)` / `alignTwoPoints(s1, s2, d1, d2)` | Point alignment                     |

---

## 17. Theme System

Four themes defined in `THEMES`:

| Theme        | ID       | Background | Accent    |
| ------------ | -------- | ---------- | --------- |
| Plasticity   | `bluish` | `#0f0f12`  | `#a855f7` |
| GitHub Dark  | `dark`   | `#0d1117`  | `#58a6ff` |
| Paper        | `paper`  | `#f5f5f5`  | `#2563eb` |
| GitHub Light | `light`  | `#e8eaed`  | `#06a23d` |

Theme objects provide consistent color keys: `bg`, `surf`, `surf2`, `surf3`, `bdr`, `tx`, `tx2`, `tx3`, `acc`, `acc2`, `accMuted`, `err`, `ok`, `warn`, `shadow`. Passed as `t` prop.

---

## 18. Keyboard Shortcuts

| Key | Tool             |
| --- | ---------------- |
| V   | Select/Move      |
| H   | Pan              |
| P   | Landmark (point) |
| L   | Line/Plane       |
| J   | Perp Point       |
| M   | Midpoint         |
| A   | Arrow            |
| 3   | Angle 3-pt       |
| 4   | Angle 4-pt       |
| D   | Perp Dist        |
| Q   | Parallel         |
| G   | Polygon          |
| C   | Curve            |
| E   | Ellipse          |
| U   | Arc              |
| O   | Circle           |
| B   | Bezier           |
| N   | Tangent          |
| X   | Concentric       |
| T   | Text             |
| R   | Ruler/Calibrate  |
| S   | Silhouette       |
| F   | Formula          |

---

## 19. Auto-Save System (Hybrid)

- **Metadata**: `localStorage`, key `"cephalo-autosave"` — project JSON (sessions, markups, configs)
- **Images**: IndexedDB (`Cephalometry StudioDB`) — image Blobs keyed by image ID, bypassing 5MB localStorage limit
- **Trigger**: Debounced `useEffect` (500ms) on any project state change
- **Restore**: On app load, metadata from localStorage, images loaded lazily from IDB
- **Clear**: On `.cephx` export, `localStorage.removeItem("cephalo-autosave")` + IDB clear
- **Banner**: "Auto-saved session recovered" on first load after restore
- **Indicator**: Timestamp display next to Save button, polled every 3s

---

## 20. LUT Presets

| ID        | Name      | Color Stops                                  |
| --------- | --------- | -------------------------------------------- |
| `gray`    | Grayscale | Black → White                                |
| `hot`     | Hot       | Black → Red → Yellow → White                 |
| `cool`    | Cool      | Cyan → Blue → Magenta                        |
| `jet`     | Jet       | Blue → Cyan → Green → Yellow → Red           |
| `viridis` | Viridis   | Purple → Blue → Green → Yellow               |
| `bone`    | Bone      | Black → Steel Blue → White                   |
| `rainbow` | Rainbow   | Red → Yellow → Green → Cyan → Blue → Magenta |

---

## 21. Build Output

```
dist/
├── index.html
└── assets/
    ├── index-<hash>.css
    ├── index-<hash>.js       (~548 KB gzipped)
    └── plotly.min-<hash>.js  (~1.38 MB gzipped, loaded dynamically)
```

Chart rendering uses Plotly.js loaded as a dynamic import (not in main bundle).

---

## 22. Limitations & Known Constraints

- No TypeScript — all values implicitly typed
- Undo/redo is in-memory only (not persisted across sessions)
- Image data stored as base64 data URLs (memory-intensive for large files)
- Canvas rendering is synchronous (no WebWorker offloading)
- No server-side component — entirely client-side SPA
- Single-user only, no collaboration features
- localStorage auto-save has ~5MB browser limit
- Research module functions (RM-ANOVA, MANOVA) work but some edge cases in repeated-measures data shapes have not been validated on real clinical datasets; golden-value regression tests now guard core p-value math (fCDF, tDistributeCDF, chi2CDF, betaIncomplete)

## 23. Context Menu & Interaction Features

### Right-Click Context Menu

Right-clicking the canvas opens a context menu with type-sensitive options:

**On a markup right-click:**
| Item             | Action                                             |
| ---------------- | -------------------------------------------------- |
| Focus            | Pans view + flashing golden ring (1.5s)            |
| Rename           | Prompts for new label                              |
| Change Color     | Opens native color picker                          |
| Duplicate        | Clones markup with +15px offset                    |
| Copy             | Serializes markup to internal clipboard            |
| Paste            | Places copied markup at cursor position            |
| Hide/Show        | Toggles `visible` flag                             |
| Lock/Unlock      | Toggles `locked` flag                              |
| Ref Landmark 1/2 | Sets as structural reference for overlay alignment |
| Copy Measurement | Copies measurement values to system clipboard      |
| Move to Front    | Reorders markup to top of z-order                  |
| Send to Back     | Reorders markup to bottom of z-order               |
| Group            | Assigns same `groupId` to all selected markups     |
| Ungroup          | Removes `groupId` from the markup                  |
| Delete           | Removes the markup                                 |

**On empty canvas right-click:**
| Item         | Action                                      |
| ------------ | ------------------------------------------- |
| Paste        | Pastes a previously copied markup at cursor |
| Select All   | Selects all markups on the canvas           |
| Calibrate    | Opens the calibration dialog                |
| Fit to View  | Resets zoom/pan to default                  |
| Grid: On/Off | Toggles a 50px grid overlay on the canvas   |

### Grid Overlay

Toggleable 50px grid (semi-transparent lines) via the context menu. The grid scrolls with the canvas pan and is drawn at the viewport level for performance.

### Group System

Markups can be grouped via the context menu (Group with multiple selected, or assign `groupId` property). Grouped markups drag together — when any member is dragged, all siblings with the same `groupId` move simultaneously. Ungroup removes the `groupId` to restore independent movement.

### refLabels Self-Healing System

When a markup is placed near an existing point (within 3px), the system automatically records `refLabels` — an array of point labels corresponding to each of the markup's points. When a referenced point is later moved (via drag), the **`syncRefDeps`** helper propagates the translation to all dependent markups:

- Lines, curves, polygons, beziers: points shift with the reference
- Circles, ellipses: center/radius points follow
- Tangents: contact point re-snaps to the parent curve
- Arrows: start/end positions update

This keeps splines, polygons, beziers, circles, ellipses, tangents, and arrows attached to their reference landmarks without manual re-adjustment.

### Flash Highlight

When a markup is clicked in the Markups panel, the canvas briefly flashes a pulsing golden ring (two concentric rings, 1.5s duration) centered on the markup. This gives an immediate visual clue of where the landmark is located on the image.
