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
