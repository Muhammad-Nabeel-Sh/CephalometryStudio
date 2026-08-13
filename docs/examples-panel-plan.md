# Examples Panel — Interactive Illustration Plan

> Status: **all 7 phases done (45 examples tests). Practice-placing (Phase 4) skipped — explicitly out of scope.** Community feed + authoring docs shipped in Phase 7; final verification green (lint 0, 425 tests, build OK).
> Feature: Turn the Examples panel into a library of **interactive teaching
> illustrations** that guide users in placing points and understanding
> cephalometric analyses.

---

## 1. Vision

Examples are **not** a loadable-analysis library. Each example is an interactive
illustration — a traced ceph with placed points (plus silhouettes) that a user
can *explore* and *learn from*:

- hover any point to read its name and definition;
- step through the points in order, guided by group and hints;
- practice placing the points themselves and get feedback;
- see which points combine into which measurements (SNA, ANB, …);
- watch the tracing build up stage by stage.

The example file format is exactly the user-authored `.cepht` — the verbose
labels and silhouette paths in `Examples/Landmarks.cepht` are ideal teaching
material and need no short-label/analysis plumbing.

---

## 2. Current State

- `src/panels/ExamplesPanel.jsx` is live (Coming Soon overlay removed): it
  browses `EXAMPLE_LIST` as metadata cards and opens a `ExampleViewerModal`
  with pan / zoom / double-click-fit and point-definition tooltips on hover.
- `Examples/Landmarks.cepht`: 35 placed points with full names (Nasion, Sella
  Turcica, Point A, …) plus silhouette tracing paths — the raw material for
  every teaching feature below.
- `src/data/examplesData.js` exposes `EXAMPLE_LIST` entries with `description`,
  `author`, `projection`, `analysisName`, `ptCount`.
- `validateExample` (`src/storage/cephxFormat.js`) checks the cepht structure
  plus envelope field types / projection whitelist.

---

## 3. Foundation (done)

- Envelope fields on `.cepht` examples: `description`, `author`, `projection`,
  `analysisName` — validated by `validateExample` (optional but typed; unknown
  `projection` rejected).
- `EXAMPLE_LIST` metadata surfaced in the panel cards and viewer header.
- Tests (`src/test/examples.test.js`): validator unit tests, bundled examples
  parse + validate, optional analysis-label contract for any example that
  declares `analysisName`.

---

## 4. Interactive Illustration Features

All five selected features are implemented in/around `ExampleViewerModal`
(`src/panels/ExamplesPanel.jsx`). Order = suggested build order; each is
independently shippable + verifiable.

### 4.1 Hover / group teaching

- Hover tooltips with name + definition already exist.
- Add **color-coded groups** with a legend: assign each point a group
  (cranial base / maxillary / mandibular / dentition / soft tissue) and render
  an always-visible legend that explains the colors in the viewer.
- Group source: an optional `group` field on each point markup. Convention
  (documented in the authoring guide): every point in a group shares the same
  `color`, so the legend can derive `{ id, color, count }` straight from the
  data. Viewers that don't know groups still render consistently. Clicking a
  group in the legend (or hovering any of its points) dims the other groups.
- Authoring: `MarkupProps` has a **Group** field on points (free text with
  suggestions from existing groups). Assigning an existing group adopts that
  group's color; a new group seeds its color from the point's current color.
  Recoloring any grouped point propagates to the whole group. The `group`
  field survives the normal "Template .cepht (with placements)" export, so an
  example is made by: place markups → define → group → save template → drop in
  `Examples/`.
- Workspace: the Markups panel gear (Display) has a **Groups legend** toggle
  that overlays the same legend on the main canvas. In the Examples viewer the
  legend is always shown whenever the data has groups.

### 4.2 Step-by-step placement guide

- "Guide mode": walk the user through the points in a sensible order (group by
  group), highlighting the current point on the canvas (pulse ring), with
  prev/next controls and a progress indicator.
- Each step shows: point name, definition, and a "what to look for" hint.
- Hints come from the existing `definition` plus an optional per-markup `hint`.
- **Done (Phase 3):** `buildGuideSteps(markups)` in `examplesData.js` filters
  unplaced points and sorts group-by-group in first-appearance order (ungrouped
  last). The viewer has a Browse/Guide toggle; guide mode shows a step strip
  (prev/next, step x/y, progress bar, group chip, point name + definition +
  TIP), a pulsing numbered ring around the current point, auto-focus on step
  change, dimming of all other markups, and ←/→/Esc keyboard navigation.

### 4.3 Practice-placing on the example

- "Practice mode": the tracing and reference points are hidden (or ghosted);
  the user clicks on the canvas to place the current point.
- Feedback: distance-to-reference tolerance → "correct" (green) / "close" /
  "far", with a gentle nudge hint after a miss; final score summary.
- Reuses the viewer's existing hit-testing + draw pipeline.

### 4.4 Measurement explanation

- When an example declares `analysisName` (or ships an explicit
  `measurements` list in the envelope), show a **measurement mapping table**:
  which points combine into which measurement (e.g. SNA = S · N · A), with a
  one-line "what it tells you".
- Explain computed measures (difference / ratio / sum / percentage) briefly.
- Source: resolve `analysisName` → `PREDEFINED[projection]` measurements
  (already used by the tests' `findAnalysis` helper).
- **Done (Phase 5):** Landmarks.cepht ships an explicit `measurements` envelope
  (14 classic lateral measurements: SNA, SNB, ANB, SN–MP, FMA, Y-axis, Facial
  angle, U1–SN, Interincisal, IMPA, Convexity, Gonial angle, upper/lower lip–E
  plane). Each entry is `{ name, pts: [point labels], formula?, tells }`.
  `validateExample` validates the envelope (optional; typed; `pts` = non-empty
  label-array). The viewer has a **Measure** mode (third segment of the mode
  switcher): a scrollable right-hand table lists every measurement with its
  formula + one-liner; clicking a card dims all unrelated markups and draws a
  dashed line connecting the mapped points (numbered vertices) on the tracing.

### 4.5 Step-by-step tracing overlay

- "Build mode": reveal the tracing in stages (e.g. by group, or by the
  markups' stored z-order) with a slider / play control, showing how a complete
  tracing is assembled.
- Implementation: render only markups whose stage ≤ current, using the existing
  `drawMarkup` calls with a stage filter.
- **Done (Phase 6):** stage ordering is per-markup via an optional `stage`
  field (number or string) — `buildStages(markups)` in `examplesData.js`
  derives explicit stages (numeric ascending, named by first-appearance;
  unstaged markups become always-visible context) and falls back to
  **point-by-point** guide order when no markup has a `stage` (placed points
  revealed one per step, group by group, ungrouped last; non-point markups —
  the tracing — stay as context). The viewer has a **Build** mode (4th
  segment): a control strip with prev/next, play/pause (▶ / Space), a range
  slider, stage chip and an "Adds:" listing of the current stage's markups;
  the canvas reveals context + all stages ≤ current and hides the rest.
  `MarkupProps` gained a **Stage** authoring field (free text + suggestions
  from existing stages), and `validateExample` checks the field's type.

---

## 5. File-by-File Change List

| File | Change |
| --- | --- |
| `src/panels/ExamplesPanel.jsx` | Viewer gains legend (4.1), guide mode (4.2), practice mode (4.3), measurement table (4.4), build mode (4.5); mode switcher UI. |
| `src/data/examplesData.js` | Expose optional `group`/`hint`/stage info on entries (pass-through). |
| `src/storage/cephxFormat.js` | Optionally extend `validateExample` for new optional fields (typed, never required). |
| `Examples/Landmarks.cepht` | Optionally annotate points with `group` / `hint` to power 4.1–4.5. |
| `src/test/examples.test.js` | Extend for any new envelope fields; keep the 12 existing foundation tests. |

---

## 6. Phased Implementation

- **Phase 1 — foundation (done):** `validateExample`, `EXAMPLE_LIST` metadata,
  bundled-example validation tests. Panel live with View-only browse.
- **Phase 2 — hover / group teaching + legend** (4.1, done): Landmarks points
  annotated with `group` (cranial base / maxillary / mandibular / dentition /
  soft tissue) + matching palette colors; viewer derives a clickable group
  legend from the data, dims non-focused groups while hovering or after a
  group click, and the tooltip shows the point's group. 4 tests added (16 total).
- **Phase 3 — step-by-step placement guide** (4.2, done): Guide mode with step
  navigation + highlighted point. `buildGuideSteps` helper, viewer mode toggle,
  step strip (prev/next/progress/definition/hint), pulsing ring + auto-focus +
  group dimming, ←/→/Esc keyboard nav. 7 tests added (23 total).
- **Phase 4 — practice-placing (skipped for now):** Practice mode with feedback
  + score.
- **Phase 5 — measurement explanation** (4.4, done): `measurements` envelope on
  Landmarks (14 teaching measurements), `validateExample` checks it, Measure
  mode with clickable mapping table + dashed connecting lines on the tracing.
  7 tests added (30 total).
- **Phase 6 — step-by-step tracing overlay** (4.5, done): Build mode with
  reveal slider. `buildStages` helper (explicit `stage` fields, point-by-point
  guide-order fallback, non-point markups = context), Build segment + control
  strip (prev/next/slider/play/Space), hidden-until-revealed rendering,
  `Stage` authoring field in MarkupProps. 9 tests added (39 total).
- **Phase 7 — community + authoring docs (done):** `src/data/communityExamples.js`
  (manifest fetch/cache/validate, `fetchExampleFile`, `clearCommunityCache`,
  `getRepoURL`/`getContributionURL`), Community section in `ExamplesPanel` (refresh,
  loading/error/stale-cache states, `.cepht` fetch + `validateExample` gate),
  `Examples/README.md` authoring guide, `parseCommunityManifest` tests. 6 tests
  added (45 total).

Phases 2–6 are independent additions to the same viewer and can ship in any
order; each ends with lint + tests + build green.

---

## 7. Verification

```bash
npx eslint src/panels/ExamplesPanel.jsx src/data/examplesData.js src/storage/cephxFormat.js src/test/examples.test.js
npm test          # all suites pass
npm run build     # expect OK (pre-existing mathjs chunk warning only)
```

Manual: open Examples panel → View Landmarks → hover points (definitions),
toggle each mode (legend, guide, practice, measurements, build), confirm no
console errors and that pan/zoom still work in every mode.
