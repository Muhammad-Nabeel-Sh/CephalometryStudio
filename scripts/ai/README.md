# scripts/ai — multi-dataset AI tooling

Tooling for the multi-dataset / domain-generalization effort described in
`docs/CephaloStudio_AI_Landmark_Improvement_Plan.md`. Progress is logged in
`docs/ai-multidataset-worklog.md`.

## Why

The production landmark model is trained on **Aariz (CEPHA29) only** and is
suspected to generalize poorly to other radiographic domains. This directory
measures that before changing anything (plan §27 gate: no model changes until the
dataset report + external benchmark exist).

## Contents

| File | Phase | Purpose |
| --- | --- | --- |
| `canonical.py` | — | Channel orders, the 19-landmark ISBI↔CEPHA29 mapping, dataset URLs/mm-px. Single source of truth. |
| `baseline_freeze.py` | 0 | Emits `baseline/model_manifest.json` (architecture, decode, SSM, thresholds, ONNX hash). |
| `profile_dataset.py` | 1 | Profiles a dataset directory (counts, dimensions, aspect, polarity, annotations). |
| `external_benchmark.py` | 2 | Runs the Aariz 29-model on ISBI 2015 and scores the 19 shared landmarks. |
| `kaggle-ai-audit.ipynb` | 0–2 | Orchestrates everything on Kaggle. |

## Quick start (Kaggle)

Run `kaggle-ai-audit.ipynb` with **CPU**, **Internet On**, and (recommended) the
`jiahongqian/cephalometric-landmarks` dataset attached. It downloads the
production model, then runs Phase 0/1/2. Outputs land in `/kaggle/working/audit/`.

## Quick start (local)

```bash
# 0. baseline manifest
python scripts/ai/baseline_freeze.py --model <landmarks-cepha29.int8.onnx> --out scripts/ai/baseline

# 1. profile a dataset
python scripts/ai/profile_dataset.py --images /path/Cephalograms --name aariz \
    --ann-dir /path/Annotations --out scripts/ai/datasets

# 2. external benchmark (Aariz model on ISBI)
python scripts/ai/external_benchmark.py \
    --model <landmarks-cepha29.int8.onnx> \
    --ssm src/data/shapeModel.cepha29.json \
    --isbi-images /path/isbi/images --isbi-ann /path/isbi/annotations.csv \
    --out scripts/ai/experiments/E0_isbi
```

`--fetch-isbi` downloads ISBI from the public mirror if you don't have it locally.

## Method notes

- **Preprocessing/DARK/PSR/SSM are imported from `scripts/eval-landmark-model.py`**
  via `importlib`, so the benchmark can never drift from production decoding.
- The model outputs 29 channels; the benchmark selects the 19 shared landmarks
  using `canonical.isbi_to_cepha_channel()` and compares against ISBI GT.
- ISBI pixel spacing is assumed 0.1 mm/px (`--pixel-mm` to override).
- The **19 shared landmarks** are safe to merge (same definitions):
  S, N, Or, Po, A, B, Pog, Me, Gn, Go, Ar, PNS, ANS, Sn, Pog', LIT, UIT, Ls, Li.
  The 10 Aariz-only landmarks have no ISBI equivalent.
