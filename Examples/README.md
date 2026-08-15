# Examples — Authoring Guide

Examples in Cephalometry Studio are **interactive teaching illustrations**, not a
loadable-analysis library. Each example is a single `.cepht` template file whose
markups (points + optional silhouette) are annotated so the **Examples** panel
can drive four teaching modes:

| Mode    | What the viewer shows                                                            |
| ------- | -------------------------------------------------------------------------------- |
| Browse  | Hover any point to read its `definition`; clickable group legend dims groups     |
| Guide   | Step-by-step placement order (groups or single points) with hints + pulsing ring |
| Measure | Mapping table: which points combine into each measurement, and what it tells you |
| Build   | Step-by-step tracing overlay: markups reveal in `stage` order, then all visible  |

---

## Quick start

1. In the workspace, place the points of your illustration. Select each point and
   fill in its **Definition** (and optionally **Hint**, **Group**, **Stage**) in the
   Markup panel.
2. **Export** the template (`.cepht`). It is automatically validated on export and
   again when opened in the Examples panel.
3. Drop the file into the repo's `Examples/` folder and add an entry to
   `Examples/manifest.json` (see below).

## The envelope

A valid example file is a `cepht` template plus optional envelope fields:

```jsonc
{
  "format": "cepht",
  "version": "2.0",
  "name": "My Illustration",
  "author": "Dr. Jane Doe",        // optional: attribution shown on the card
  "description": "…",              // optional: 1–2 lines on the card
  "projection": "lateral",         // optional: lateral|ap|smv|opg|handwrist|photolateral|photofrontal
  "analysisName": "Steiner Analysis", // optional: names a predefined analysis
  "markups": [ … ],                // required: the placed markups (see below)
  "measurements": [ … ]            // optional: teaching table for Measure mode
}
```

## Annotating markups

Each point markup can carry four optional teaching fields:

- **`definition`** (string) — hover tooltip text in Browse mode: *what the landmark is*.
- **`hint`** (string) — placement tip shown in Guide mode.
- **`group`** (string) — teaching group for the legend (e.g. "cranial base"). Points
  in the same group **must share one color**; the legend derives its chips from the
  data, nothing is hardcoded.
- **`stage`** (number or string) — reveal order for Build mode. Numeric stages are
  revealed ascending; named stages in first-appearance order. Markups without a
  stage are treated as always-visible **context** (e.g. a silhouette). If no markup
  has a stage, Build mode falls back to the point-by-point Guide order.

```jsonc
{
  "type": "point",
  "label": "Nasion",
  "definition": "Most anterior point of the frontonasal suture.",
  "hint": "Find where the nasal bone meets the frontal bone.",
  "group": "cranial base",
  "color": "#f59e0b"
}
```

## The measurements table (Measure mode)

`measurements` is an array of teaching entries. Each entry lists the **point labels**
that combine into the measure, an optional **`formula`** string (for computed
measures like ANB), and a one-line **`tells`** explanation:

```jsonc
"measurements": [
  { "name": "SNA", "pts": ["S", "N", "A"], "tells": "Maxillary antero-posterior position relative to the cranial base." },
  { "name": "ANB", "pts": ["S", "N", "A", "B"], "formula": "SNA − SNB", "tells": "AP skeletal relationship between the maxilla and mandible." }
]
```

In Measure mode the viewer draws dashed connecting lines over the points in `pts`
order and shows the name + formula + tells in a scrolling table.

## Publishing to the community feed

1. Add your `.cepht` to the repo's `Examples/` folder.
2. Add an entry to `Examples/manifest.json`:

```jsonc
{
  "version": "1.0",
  "updated": "2026-08-01",
  "examples": [
    {
      "id": "my-illustration",
      "url": "https://raw.githubusercontent.com/<owner>/<repo>/main/Examples/MyIllustration.cepht",
      "label": "My Illustration",
      "author": "Dr. Jane Doe",
      "description": "One-line description.",
      "projection": "lateral",
      "ptCount": 14
    }
  ]
}
```

3. The app fetches the manifest (cached 1 h, with stale-cache fallback offline) and
   validates each `.cepht` with `validateExample` before opening it — a bad file
   shows an error instead of the viewer.

Contributions are also linked from the in-app **contribute** page
(`public/contribute.html`).
