# Contributing to Cephalometry Studio

Thank you for your interest in contributing! Cephalometry Studio is a browser-based
cephalometric analysis platform built with React + Vite and vanilla Canvas 2D.
All patient data stays on the user's device — there is no backend.

## Development setup

Prerequisites: Node.js 18+ and npm.

```bash
git clone https://github.com/Muhammad-Nabeel-Sh/CephalometryStudio.git
cd CephalometryStudio
npm install
npm run dev        # development server with hot reload
npm run build      # production build
npm run preview    # preview the production build locally
```

## Tests and lint

```bash
npm test           # run the full Vitest suite (459 tests)
npm run lint       # ESLint across the project
npm run icons      # regenerate PWA/OS icons from public/favicon.svg (requires sharp)
```

Tests use [Vitest](https://vitest.dev/) and live in `src/test/`. Statistical
code is guarded by golden-value regression tests
(`researchGolden.test.js`, `statGoldenValues.test.js`) that compare results
against published reference values — do not "fix" a failing golden test by
adjusting its expected value without documenting the methodology change.

## Code style

- JavaScript/JSX, no TypeScript; double quotes for imports
- Inline styles only (no CSS framework); theme colors come from the `THEMES`
  object via the `t` prop
- Components are function components; Zustand stores for global state
  (`src/state/`); see `AGENTS.md` for the full architecture guide
- Prefer named exports; default export only for the root component

## Making a change

1. Open an issue describing the bug or feature (templates exist in
   `.github/ISSUE_TEMPLATE/`).
2. Create a branch from `main`.
3. Make your change; keep diffs focused.
4. Run `npm run lint` and `npm test` and make sure everything passes.
5. Open a pull request with a clear description and any screenshots for UI
   changes.

## Adding a new analysis or markup type

Follow the "Common Development Tasks" section of `AGENTS.md`:

- New markup type: register in `TOOLS` (`src/data/constants.js`), add
  rendering/hit-testing in `src/canvas/drawMarkups.js`, measurements in
  `src/lib/utils.js` (`computeMeasurements`)
- New analysis: add point definitions to `Data/*.csv` (they are parsed into
  `PREDEFINED`) and measurement definitions to `Data/AnalysisMeasurements.csv`
- New norms: add to `src/data/norms.js` (`DEFAULT_NORMS`) — this is the single
  source of truth

## Clinical and statistical rigor

- Calibration-aware units: every measurement result must carry `_unit`
  (`"mm" | "px"`) and research results must propagate `unit` to tables, charts,
  and CSV exports
- Reference norms must cite their population, age range, sex, and source
- Statistical implementations should reference the original literature in
  comments (e.g. Shrout & Fleiss for ICC, Carkeet for exact LoA CIs)

## Questions?

Open a discussion or issue in the repository.
