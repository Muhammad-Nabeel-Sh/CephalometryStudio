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
