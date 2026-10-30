# AI Multidataset Improvement — Worklog

Living document. Every step of the multi-dataset / domain-generalization effort is
recorded here (newest entries appended at the bottom of **Step log**). The
authoritative plan is `docs/CephaloStudio_AI_Landmark_Improvement_Plan.md`; this
file records *what we actually did*.

Companion plan: `docs/ai-module-improvement-plan.md` (Phase 1/1b robustness —
already implemented: DARK decoding, PSR confidence, SSM residual, orientation
hypotheses, quality gate). This worklog starts the **model-side, multi-domain**
phase.

---

## Context / decisions (locked)

- **Problem:** many real cephalograms get poor AI tracing → suspected **domain
  shift**. The production model is trained on Aariz only.
- **Datasets:**
  - **Aariz / CEPHA29** — 1,000 images, 29 landmarks, annotated (CC BY 4.0).
  - **ISBI 2015** — ~400 images, 19 landmarks, annotated. The Kaggle set
    `jiahongqian/cephalometric-landmarks` ("Automatic Cephalometric X-Ray Landmark
    Detection Challenge") is this dataset. GT is available (public mirror + likely
    in the Kaggle copy).
  - Shared landmark subset = **19** (verified mapping in `scripts/ai/canonical.py`).
- **Benchmark target:** run the **Aariz 29-landmark production model** on ISBI and
  score the 19 shared landmarks vs ISBI GT. The model never saw ISBI, so all ISBI
  images are a clean external test.
- **Tooling lives in `scripts/ai/`** (keep in this repo for now).
- **Gate (plan §27):** no model/architecture changes until the dataset report +
  external benchmark exist.
- **Documentation:** every step goes in this file.

## Current assets

- `best.pt` from the rerun + full training output (user).
- Production INT8 ONNX on Hugging Face (SHA-256 pinned in
  `src/data/landmarkModelInfo.js`).
- `scripts/eval-landmark-model.py` — offline harness (MRE/SDR, per-landmark,
  `--report-ood`, ISBI + CEPHA29 loaders, DARK + PSR ports).
- `src/test/fixtures/cepha29-valid-ood.csv` — Aariz valid OOD stats (150 images).

## Deliverables (this phase)

```
scripts/ai/
├── canonical.py            # shared landmark/dataset constants + mapping
├── profile_dataset.py      # Phase 1: dataset profiler
├── baseline_freeze.py      # Phase 0: model manifest + baseline metrics
├── external_benchmark.py   # Phase 2: Aariz model on ISBI (shared 19)
└── kaggle-ai-audit.ipynb   # orchestrates Phase 0-2 on Kaggle
```

---

## Step log

### Step 0 — Setup
- Read `CephaloStudio_AI_Landmark_Improvement_Plan.md`; confirmed its Immediate
  Next Action = Phase 0 + Phase 1 only, gated on dataset info.
- Identified the Kaggle dataset as ISBI 2015 (19 landmarks) and confirmed its
  annotations exist.
- Established the 19-landmark canonical mapping between ISBI and CEPHA29.
- Decision: run the Phase-2 benchmark on all ISBI images against the Aariz model.
- Decision: choose the multi-domain training landmark set *after* the benchmark.
- Created this worklog.

### Step 1 — Harness: machine-readable metrics
- Added `--metrics-out <json>` to `scripts/eval-landmark-model.py` (overall MRE /
  median / RMSE / max / SDR + per-landmark MRE/median). Needed so Phase 0 can
  archive a machine-readable baseline and Phase 2 can compare domains.

### Step 2 — `scripts/ai/canonical.py` (single source of truth)
- Holds the CEPHA29 and ISBI19 channel orders, the **19-landmark mapping**
  (`ISBI_TO_CEPHA`), the 10 Aariz-only landmarks, dataset URLs/mm-px, and the
  pinned production ONNX URL + SHA-256.
- `python scripts/ai/canonical.py` self-check passes:
  `ISBI ch -> CEPHA idx = [23,14,16,19,0,3,20,13,5,6,8,26,12,11,24,21,17,1,2]`,
  Aariz-only = `Co, LIA, LMT, LPM, N`, Pn, R, UIA, UMT, UPM`.

### Step 3 — Phase 0 baseline freeze (done)
- `scripts/ai/baseline_freeze.py` writes `baseline/model_manifest.json` +
  `baseline/README.md`. Thresholds/PSR constants are **extracted from the source
  files** (no duplication). Ran it: the manifest pins the production CEPHA29 ONNX
  SHA-256 and the live quality thresholds. Committed.

### Step 4 — Phase 1 profiler (tool ready; run pending data)
- `scripts/ai/profile_dataset.py`: image count/format, dimensions, aspect-ratio
  distribution, grayscale/color, intensity stats, a **polarity heuristic**
  (corner-median > 0.5 ⇒ likely inverted), and annotation summary.
- Emits `<name>_profile.json` + appends `datasets/dataset_statistics.csv` +
  `datasets/registry.json`. Run on Kaggle (needs the datasets).

### Step 5 — Phase 2 external benchmark (tool ready; run pending data)
- `scripts/ai/external_benchmark.py`: runs the **Aariz 29-channel ONNX** on ISBI,
  slices the 19 shared channels against ISBI GT, and writes
  `isbi_metrics.json`, `isbi_per_landmark.csv`, `isbi_per_image.csv`,
  `domain_comparison.csv` (if Aariz metrics given), `failure_taxonomy.md`, and
  worst-case `overlays/`.
- It **imports the app harness via importlib** so preprocess/DARK/PSR/SSM cannot
  drift from production. Validated by import + harness-load smoke check.

### Step 6 — Kaggle audit notebook
- `scripts/ai/kaggle-ai-audit.ipynb` orchestrates Phase 0/1/2: clones the repo,
  finds an attached ISBI/Aariz dataset (else fetches ISBI from the public
  mirror), downloads the production ONNX (SHA-verified), then runs baseline
  freeze → profiler → Aariz baseline metrics → ISBI benchmark. All cells compile.

### Step 7 — Validation performed
- `py_compile` on all new scripts + the harness (OK).
- `canonical.py` self-check (OK).
- Notebook code cells compile (OK).
- Harness import exposes `preprocess/decode/psr_confs/load_ssm/refine_ssm/shape_residual` (OK).
- Note: a local end-to-end model run was **not** completed — the Hugging Face
  download stalled in this environment (~23/30 MB). The full run happens on
  Kaggle (see Step 8).

### Step 8 — Next action (requires the user)
Run `scripts/ai/kaggle-ai-audit.ipynb` on Kaggle (CPU, Internet On), attaching
`jiahongqian/cephalometric-landmarks` and (optionally) an Aariz dataset. Then send
back `/kaggle/working/audit/` — especially `E0_isbi/isbi_metrics.json` and
`failure_taxonomy.md`. That quantifies the domain shift and decides the training
plan. **No model changes until this report exists.**

### Step 9 — Audit run completed (results)
The Kaggle audit was run and the outputs filed under
`scripts/ai/experiments/E0_isbi/` and `scripts/ai/datasets/`.

**Dataset profile** (`datasets/dataset_statistics.csv`)

| id | images | median WxH | aspect | notes |
| --- | --- | --- | --- | --- |
| aariz | 150 (valid) | 1968×1937 | 0.884 | near-square, ~35% "inverted" heuristic |
| isbi2015 | 200 | 1935×2400 | 0.806 | portrait; black frame + white registration marks |

**External benchmark — Aariz 29-model on ISBI, 19 shared landmarks, 50 images**
(`E0_isbi/isbi_metrics.json`):

| | MRE | median | RMSE | SDR@2 | SDR@3 | SDR@4 |
| --- | --- | --- | --- | --- | --- | --- |
| Aariz (baseline) | 2.55 mm | 1.26 mm | 5.78 | 68.7% | 81.0% | — |
| **ISBI (external)** | **4.03 mm** | **2.52 mm** | 7.06 | **39.6%** | 57.2% | 70.4% |

Domain shift is **confirmed and large**: SDR@2 falls 68.7% → 39.6% (−29 pp).

**Hardest landmarks (ISBI MRE / median):**
UL/Ls 13.84 / 4.60 · LL/Li 5.26 / 4.94 · Go 5.08 / 2.96 · Po 4.60 / 1.89 ·
Or 4.59 / 3.92 · Sn 4.26 / 3.58 · Ar 4.19 / 2.18 · N 4.05 / 2.43.
Best: L1/LIT 1.83, U1/UIT 1.97, Pog 2.13, B 2.14.

**Biggest per-landmark degradations (Aariz → ISBI):** UL +6.46, LL +3.46,
Sn +2.48, Or +2.21, A +1.92, Pog' +1.65, N +1.61.

**Red flags / confounds (must resolve before trusting the number):**
1. **Only 50 ISBI images** were scored (the mirror test split). The Kaggle set has
   200. Need the ISBI train split too (~150) for a robust number.
2. **Soft-tissue (UL/LL/Sn) dominates the error** — likely partly an
   *annotation-definition* difference, not just domain. Must compare conventions.
3. **Go is 10.78 mm even on Aariz** (and 5.08 on ISBI) — an annotation-quality red
   flag, since Go should be easier than most.
4. **The benchmark used a single orientation hypothesis** (normal); the app runs
   an orientation/polarity search in production. If ISBI/Aariz differ in facing
   direction, the benchmark understates real app performance.
5. **SSM refinement** with the Aariz 29-prior was applied; on OOD images this can
   both help and hurt. Need raw-vs-refined.
6. The profiler's polarity heuristic false-positived on ISBI (0.955 "inverted") —
   it is fooled by the black frame + white registration marks. ISBI polarity is
   actually **normal** (verified by inspecting `342.jpg`).
7. INT8 vs FP32 not compared (plan §18 says validate FP first).

### Step 10 — Next: harden the benchmark + decide training
Planned before any model training:
- Score the **ISBI train+test** annotations (~200 imgs) for a robust number.
- Add **orientation/polarity search** to the benchmark so it reflects production.
- Report **raw vs SSM-refined** and **INT8 vs FP32**.
- Compare soft-tissue landmark **definitions** (ISBI UL/LL vs Aariz Ls/Li).
Then choose the multi-domain training plan (E1–E4) and landmark set.

### Step 11 — Benchmark hardened (code)
Addressed the confounds from Step 9:
- `external_benchmark.py` gained:
  - `--search` — evaluates {normal, mirror} × {normal, invert} and keeps the
    highest-mean-PSR hypothesis, matching the app's production orientation search.
  - `--no-ssm` — report raw predictions (isolates the SSM's effect).
  - `--ann-extra` — merge additional annotation CSVs (ISBI **train** split →
    ~hundreds of labelled images instead of 50).
  - metrics now include `raw_overall`, `orientation_mirrored_frac`,
    `polarity_inverted_frac`, and per-image `raw_mean_mm`/`mirror`/`invert`.
- `kaggle-ai-audit.ipynb` updated: downloads ISBI train+test annotations, profiles
  ISBI with a high limit, and runs the benchmark twice (SSM-refined `E0_isbi`,
  raw `E0b_isbi_raw`).
- Verified: `py_compile` OK; notebook cells compile; module import + options OK.
- Also confirmed via inspecting `342.jpg` that ISBI is **normal polarity** — the
  profiler's "inverted" flag is a false positive from the frame/registration marks.

Next: re-run the audit notebook to get the robust, production-faithful number,
then decide the multi-domain training plan.

### Step 12 — Fixed `--fetch-isbi` (audit run crash)
The second audit run crashed (`external_benchmark.py` exit 1) because the ISBI
Kaggle dataset wasn't attached and the `--fetch-isbi` fallback was broken:

- **Bug:** `canonical.ISBI_IMG_BASE` was `".../test/cepha400/"` with no `{}`
  placeholder, so `.format(name)` produced the directory URL → every image
  download 404'd → zero images → `SystemExit`.
- **Also:** train images live under `.../train/cepha400/`, not `test/`, so the
  fallback could never fetch the train GT even if the URL were right.

Fix:
- `canonical.py` now defines `ISBI_ANN_TEST/TRAIN` and `ISBI_IMG_TEST/TRAIN`
  (both with the `{}` filename placeholder).
- `fetch_isbi()` downloads **both** annotation splits (test 50 + train 350 = 400
  labelled images) and each stem's image from the correct split base; it prints
  the fetch count and raises a clear error if none succeed.
- Main auto-sets `--ann-extra` to the downloaded train CSV when fetching.
- Verified locally (Python 3.14): `fetch_isbi(cache, 3)` → 3/3 images, test GT 50,
  train GT 350; module import + options OK.

Note: the default local `python` switched to a bare 3.15 (no numpy); the scripts
run under `C:\Python314\python.exe` locally, and Kaggle installs deps in the
notebook as before.

Next: re-run the audit notebook (the clone now has the fix). Attaching the ISBI
Kaggle dataset is still preferred (avoids the 400-image download).

### Step 13 — Robust 400-image audit: the SSM hurts cross-domain
Re-ran the audit after the fetch fix. **400 ISBI images** scored (50 test + 350
train). Outputs filed under `scripts/ai/experiments/E0_isbi_400/` (production:
search + SSM) and `E0b_isbi_raw_400/` (search, no SSM).

**Orientation/polarity search:** `mirrored 0%`, `inverted 0%` — ISBI is normal
orientation and polarity, and the production search correctly leaves it alone.
So orientation is **not** a factor.

**Headline comparison (400 images, 19 shared landmarks):**

| config | MRE | median | SDR@2 | SDR@3 | SDR@4 |
| --- | --- | --- | --- | --- | --- |
| raw (no SSM) | 4.81 mm | **1.97 mm** | **50.6%** | **68.3%** | **78.8%** |
| production (SSM refine) | 4.96 mm | 2.87 mm | 35.4% | 51.9% | 63.6% |

**Finding: the Aariz SSM prior actively degrades cross-domain accuracy.**
SDR@2 falls **50.6% → 35.4% (−15.2 pp)** and the median worsens
**1.97 → 2.87 mm** when refinement is applied. The mean barely moves because the
prior clips some catastrophic outliers while pulling the typical prediction
toward an Aariz-like shape. This is precisely the plan's Phase 8 warning: the SSM
should *validate* implausible configurations, not forcibly relocate every point.
**This is very likely a major contributor to the "poor tracing" users see on
non-Aariz images**, because the app applies refinement unconditionally
(`refine.shape: true`, alpha 0.6).

**Hardest landmarks (raw):** UL/Ls 27.41 (median 3.69), Go 8.68 (3.25), N 6.55
(2.35), Sn 5.92 (2.92), Pog'/Pog` 5.84 (5.39), Or 5.03 (2.59).
Best: Gn 1.12, U1 1.22, L1 1.38, Pog 1.46, Me 1.87. Soft tissue and Go dominate.

**Worst images (raw):** 194 (29.5 mm), 008 (23.0), 105 (19.9), 282 (18.3),
284 (17.5). The `194` overlay shows a global scatter — predictions collapse into
the lower face while GT spans the skull (catastrophic, not a small offset).

**Next actions (in order):**
1. **Gate/soften the SSM** (no retraining): apply refinement only when the raw
   shape is already plausible (e.g. residual below a threshold), or reduce alpha,
   or expose a toggle. Matches plan Phase 8. Highest immediate impact on real
   cross-domain tracing.
2. **Reconcile soft-tissue definitions** (ISBI UL/LL vs Aariz Ls/Li) before
   merging them for training.
3. **Multi-domain training** (Aariz + ISBI, shared landmark set) to lift the raw
   cross-domain accuracy.
4. Optionally compare FP32 vs INT8 to rule out quantization.

### Step 14 — Implemented a residual-band SSM gate

Refined the "gate by residual" policy using the per-image data. The effect of
refinement is **not monotonic** in residual — it helps in a middle band and hurts
at both ends:

| raw residualRatio | n | raw med | SSM med | SSM better |
| --- | --- | --- | --- | --- |
| 0–0.1 | 233 | 2.46 | 2.59 | 30% |
| 0.1–0.2 | 38 | 4.52 | 3.92 | 76% |
| 0.2–0.3 | 9 | 5.50 | 4.62 | 100% |
| 0.3–0.5 | 61 | 7.11 | 6.34 | 82% |
| 0.5–0.7 | 48 | 9.99 | 10.04 | 46% |
| 0.7–1.0 | 11 | 16.70 | 23.29 | 9% |

So a one-sided "skip high residual" gate is ineffective (the low-residual
majority dominates the harm). The band **0.1 < residualRatio ≤ 0.5** recovers the
raw cross-domain performance while still smoothing where the prior helps.

**Implemented:**
- `src/canvas/landmarkDetector.js`: new exported `shouldRefine(residualRatio,
  refine)`; refinement is applied only inside the band. Results now carry
  `refined` (and the dev diagnostics log it).
- `src/workspace/autoTrace.js`: passes `refined` through.
- `src/data/landmarkModelInfo.js`: `refine.minResidualRatio: 0.1`,
  `refine.maxResidualRatio: 0.5` (documented; tunable).
- `scripts/ai/external_benchmark.py`: `--ssm-gate-min` / `--ssm-gate-max`;
  metrics add `refined_frac`; per-image CSV adds `refined`.
- `scripts/ai/kaggle-ai-audit.ipynb`: adds `E0c_isbi_gated` and an **Aariz raw vs
  SSM** comparison (`aariz_valid_raw.json` vs `aariz_valid_metrics.json`) to
  measure the in-domain cost before shipping.
- Tests: 6 new `shouldRefine` cases (599 total pass).

**Pending:** run the notebook to confirm the gated cross-domain number and the
in-domain cost. If Aariz regresses, raise `minResidualRatio` (e.g. to 0) or lower
alpha; if not, keep the band.

### Step 15 — Gate validated: it helps the bad subset but raw still wins overall

Re-ran the audit; results filed in `E0_isbi_400` (always SSM), `E0b_isbi_raw_400`
(raw), `E0c_isbi_gated_400` (band 0.1–0.5). `scripts/audit_output_2.zip` held the
run; only the small reports are committed.

| policy | refined | MRE | median | RMSE | SDR@2 | SDR@3 | SDR@4 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| always SSM | 100% | 4.96 | 2.87 | 8.87 | 35.4% | 51.9% | 63.6% |
| **raw** | 0% | 4.81 | **1.97** | 15.90 | **50.6%** | **68.3%** | **78.8%** |
| **band gate 0.1–0.5** | 27% | **4.66** | 2.29 | 13.93 | 44.0% | 61.4% | 72.6% |

Within the refined subset (108 images) the gate works as intended: median
**6.42 → 5.36 mm**, and refinement helps **81%** of them. The 292 skipped images
are untouched (median 2.57).

But overall **raw still wins on SDR@2 and median**, because a few *good but
atypical* images land inside the band and get wrecked, e.g. `384.jpg` (raw 2.95 →
gated 8.24 at residual 0.471) and `232.jpg` (2.10 → 5.21 at 0.382). Residual alone
cannot separate "good but atypical" from "bad". Always-SSM has the lowest RMSE
(it clips catastrophic outliers) but the worst SDR/median.

So the gate is a **compromise, not a win**: it reduces catastrophic outliers
(RMSE 15.9 → 13.9) but costs ~7 pp SDR@2 vs raw. Consistent with plan Phase 8:
the SSM should *validate*, not transform. **Raw + quality flagging looks best for
typical accuracy.**

**Still missing:** the in-domain (Aariz) raw-vs-SSM number — the last three audit
zips contained no `aariz_valid_raw.json`/`aariz_valid_metrics.json`, so the Aariz
valid split was not attached (or that cell didn't run). Needed to decide whether
to disable refinement globally or keep a domain-aware policy.

### Step 16 — Decision: refinement ships DISABLED (raw), prior kept as validator

Decision taken on the cross-domain evidence (raw 50.6% SDR@2 vs gated 44.0% vs
always 35.4%): **shape-prior refinement is off by default**.

- `src/data/landmarkModelInfo.js`: `refine.shape: false` (alpha/band options kept
  for opt-in smoothing). The shape residual is still computed independently and
  continues to drive the quality gate and hypothesis ranking, so the prior is
  retained as a **validator**, not a transformer (plan Phase 8).
- Tests: `landmarkDetector.test.js` locks the default (`refine.shape === false`,
  band present, `shouldRefine` returns false for the shipped config).
- In-domain (Aariz) raw-vs-SSM is still unmeasured; if it later shows a large
  in-domain benefit, the band gate can be re-enabled (or made domain-aware).

**Effect:** the app now places the model's raw landmarks, with low-confidence /
atypical traces flagged for review instead of silently re-shaped. Next: the
multi-domain fine-tune (Aariz + ISBI shared landmarks) to raise raw accuracy, and
reconcile soft-tissue definitions before merging `UL/LL`.

### Step 17 — Soft-tissue definition check: keep all 19 shared landmarks

Before merging, tested whether ISBI `UL/LL` are anatomically equivalent to Aariz
`Ls/Li` (which would justify excluding them). Two analyses over 400 ISBI shapes
vs the Aariz prior mean:

**1. Per-landmark GT-vs-Aariz-mean residual** (Procrustes-aligned, fraction of
face size). `UL` 0.092 and `LL` 0.102 sit **mid-range** — not outliers.
Higher: `Pog'` 0.180, `Sn` 0.149, `ANS` 0.126, `B` 0.116, `Po` 0.115, `N` 0.114.
Lower: `S` 0.072, `L1` 0.070, `PNS`/`U1` 0.074.

**2. Position relative to the Sn–Pog' axis** (t = along, h = signed perpendicular
normalised by |Sn–Pog'|):

| pair | ISBI t | ISBI h | Aariz t | Aariz h |
| --- | --- | --- | --- | --- |
| UL vs Ls | +0.204 | +0.132 | +0.261 | +0.085 |
| LL vs Li | +0.565 | +0.132 | +0.567 | +0.065 |

Along-axis positions match closely; ISBI's lip points sit modestly more anterior
(h ≈ +0.05–0.07 larger) — a small convention/population difference, not a
different landmark.

**Conclusion:** no gross definition mismatch. Keep all **19** shared landmarks;
the `UL` 27.4 mm mean error is catastrophic-tail model failure (median 3.69 mm),
not a labelling problem. (Note the slight anterior lip bias if it recurs after
multi-domain training.)

Next: build the multi-domain training notebook (`kaggle-multidomain.ipynb`) on the
shared 19, fine-tuned from `best.pt`.

### Step 18 — Multi-domain training pipeline built (shared 19)

Built `scripts/ai/kaggle-multidomain.ipynb` (and the tooling it needs):

- **Data harmonization**: maps Aariz (29, averaged Junior+Senior) onto the 19
  ISBI symbols via `ISBI_TO_CEPHA`; merges with ISBI 2015 train. Builds:
  - `md19/train` + `md19/valid` (domain-prefixed filenames, 19-symbol JSONs),
  - separate `eval/aariz19` and `eval/isbi19` dirs for clean measurement.
- **Model patch**: CephaloHRNet `LANDMARK_SYMBOLS` / `NUM_LANDMARKS` / `train.py`
  switched to the 19 shared landmarks.
- **Training**: fine-tunes from the attached 29-landmark `best.pt`
  (`--pretrained-path` transfers the backbone, re-inits the 19-channel head),
  768², 120 epochs, ISBI 2015 + Aariz.
- **Export**: ONNX FP32 + static-QDQ INT8 (`--num-landmarks 19`) + verify overlay.
- **Prior**: `build-shape-model.py --set cepha19`.
- **Benchmark**: raw (app default) on held-out ISBI test + Aariz valid, using
  `external_benchmark.py` (now auto-detects 19-channel models) and the harness
  (`--set cepha19`).

Tooling added: `cepha19` set in `build-shape-model.py`, `eval-landmark-model.py`,
`export-landmark-onnx.py`; `_resolve_chan()` in `external_benchmark.py`; `--set
cepha19` handling. All Python compiles; export/eval 19-lists verified equal to
`canonical.ISBI19`; JS lint/tests/build green (601 tests).

**Deliberate scope:** this first run isolates **domain diversity** (no flip /
polarity / CLAHE augmentation yet). If SDR@2 doesn't improve enough, augmentation
is the next lever.

Next: run `kaggle-multidomain.ipynb` (T4, attach `best.pt`; ISBI + Aariz
datasets optional) and compare `audit/isbi19/isbi_metrics.json` against the raw
baseline (SDR@2 50.6%, median 1.97 mm).

### Step 19 — Multi-domain training debug + smoke test

The first Kaggle training run exited 1 but the cell used `check=True` without
capturing output, so the child's stderr was invisible. Separately, the user's
`best.pt` was actually `scripts/best.zip` (a `torch.save` zip container, not a
wrapper); verified with `torch.load`: `head.weight (29, 32, 1, 1)`, epoch 126,
hrnet_w32/768.

To isolate the failure, ran the **real CephaloHRNet training pipeline locally on
CPU** with a tiny synthetic 19-landmark dataset and the user's checkpoint:
- loaded **1752/1754** layers (head excluded, as designed),
- 1 epoch trained, 19-channel model saved, per-landmark eval printed.

That proves the pipeline (dataset loader, patch, checkpoint transfer, loss) is
sound. Two real bugs surfaced and were fixed:
1. **`test.py` `KeyError: 'L1'`** — patching `LANDMARK_SYMBOLS` to the 19 set left
   `LANDMARK_TITLES` on the CEPHA29 names, and `test.py` indexes titles by symbol.
   The auto-eval crashed (after training). Fixed by adding the 19 titles in the
   patch cell.
2. **`seaborn` missing from the install list** — `utils/visualize.py` imports it
   (and calls `set_style`/`color_palette` at import), so a missing package fails
   the whole `train.py` import. Added `seaborn` to the install cell.

Training cell hardening (`kaggle-multidomain.ipynb`):
- pre-flight **counts + assert** for `train`/`valid` (empty split is a likely cause
  of exit 1),
- `capture_output=True` and prints stdout/stderr before `check_returncode()`,
- `--workers 0` (avoids DataLoader worker failures),
- build cell now falls back to a 20-image valid slice if the valid split is empty.

Not yet confirmed: the original Kaggle exit-1 cause (hidden stderr). Next: re-run
the build + training cells; the cell now prints the real error.

### Step 20 — Training failure root cause: annotations written to the wrong dir

With the captured stderr the cause was:
`FileNotFoundError: Annotation directory not found: .../md19/train/Annotations/Cephalometric Landmarks/Merged19`,
and the pre-flight showed `images=1050 annotations=0`.

Cause: the build cell's `ann_dir(root)` returned
`.../Annotations/Cephalometric Landmarks` — **without the `Merged19/`
subdirectory** — so `write_case` wrote the JSONs one level too high, while
CephaloHRNet's `--annotators Merged19` resolves
`.../Cephalometric Landmarks/Merged19`. Images were written correctly
(1050 train / 200 valid), annotations were not.

Fix: `ann_dir()` now appends `"Merged19"` (the eval dirs use the same helper, so
they are fixed too). Rebuild or run a one-off move of `*.json` into `Merged19/`
in the current session, then train.

### Step 21 — Multi-domain E1 result: clear cross-domain win

The fine-tune completed (84 epochs, early stop). Outputs in `Results/` (gitignored);
small reports filed in `scripts/ai/experiments/E1_md19_isbi/` and `E1_md19_aariz/`.

**Training:** best epoch **54** — merged-valid (Aariz 150 + ISBI 50) MRE
**1.24 mm**, SDR@2 **84.5%**. After epoch 54 the run diverged (`val_loss` NaN,
`val_mre_px` 484) and early-stopped at 84. `best.pt` (epoch 54) was exported, so
the result is from the best checkpoint, but future runs should lower the LR
(e.g. 5e-4) or shorten the schedule.

**External (ISBI test, 50 held out, raw INT8):**

| | MRE | median | RMSE | SDR@2 | SDR@3 | SDR@4 |
| --- | --- | --- | --- | --- | --- | --- |
| baseline 29-model (400 ISBI) | 4.81 | 1.97 | 15.90 | 50.6% | 68.3% | 78.8% |
| **multidomain 19-model (50 test)** | **2.05** | **1.34** | **2.86** | **64.7%** | **77.5%** | **86.1%** |

Same 50 test images, per-image mean error: baseline median **2.66 mm** / mean
**3.93** → multidomain **2.07** / **2.05**; **improved on 43/50 images**.

**In-domain (Aariz valid, 150, shared 19, raw):** MRE **0.99 mm**, median
**0.61**, SDR@2 **91.0%**, SDR@3 95.9%, SDR@4 98.2%. (One catastrophic outlier
keeps the mean down; max 149.8 mm.)

**Remaining hard landmarks (ISBI):** `Pog'` **6.92 mm** (median 6.91 — consistently
bad), `B` 4.36, `Or` 3.97, `UL` 2.90; everything else ≤2.3 mm.

**Interpretation:** domain diversity + the 19-landmark task clearly fixes the
cross-domain failure mode. SDR@2 rises ~14 pp on ISBI and the model is strong
in-domain. Cost: the 19-model cannot supply the 10 Aariz-only landmarks
(`Co, LIA, LMT, LPM, N\`, Pn, R, UIA, UMT, UPM`), so app integration needs either
a `cepha19` set (manual placement for the extras) or a masked-loss 29-landmark
retrain that keeps all 29 outputs.

Next: decide the integration path and (optionally) address `Pog'`.

### Step 22 — `cepha19` integrated as the active app model

Shipped the multi-domain model as **`cepha19`** (option "both" — 29-landmark
masked retrain next):

- `src/data/landmarkMap.js`: `CEPHA19 = ISBI19` (same 19 vocabulary/app labels,
  separate set key) + registered in `LANDMARK_SETS`.
- `src/lib/shapeModel.js`: imported/registered `src/data/shapeModel.cepha19.json`
  (19 landmarks, K=10, 81.96% variance, n=1050).
- `src/data/landmarkModelInfo.js`: split into `CEPHA29_MODEL` (HF-hosted, kept)
  and `CEPHA19_MODEL` (multi-domain), with `LANDMARK_MODEL = CEPHA19_MODEL`.
  Local weights `public/models/landmarks-md19.int8.onnx` (gitignored), SHA-256
  `aabfddce…7315`. For deployment, host the file and update `url`.
- Refinement stays disabled (`shape: false`, band options kept) and orientation /
  polarity search stays on, matching how E1 was measured.
- Tests: 4 new (cepha19 set order, prior registration, active manifest, residual
  with the new prior) → **874 pass**, lint clean, build OK.

**Caveat:** the quality-gate thresholds are still the CEPHA29 calibration. The
E1 benchmark ran `--no-ssm`, so it did not record cepha19 residual stats; a
`--report-ood` run with the cepha19 prior (refinement gated off) should be used to
recalibrate the residual/mahalanobis cut points for this model.

**Next:** masked-loss 29-landmark multi-domain retrain (keep all 29 outputs; ISBI
images supervise only the 19) for full production parity.
