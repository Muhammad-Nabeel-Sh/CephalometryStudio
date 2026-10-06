#!/usr/bin/env python3
"""
Phase 0 — baseline freeze.

Writes a self-describing manifest of the model that ships today (architecture,
input, preprocessing, decoding, SSM refinement, robustness, quality-gate
thresholds, ONNX hash) so every later change can be compared against a frozen
reference.

Thresholds/PSR constants are read from the actual source files (single source of
truth), not duplicated here.

Usage:
  python scripts/ai/baseline_freeze.py \
      --model public/models/landmarks-cepha29.int8.onnx \
      --out scripts/ai/baseline
"""

import argparse
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from canonical import CEPHA29, PROD_MODEL_URL, PROD_MODEL_SHA256  # noqa: E402


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def extract_numeric_const(js, name):
    m = re.search(rf"{re.escape(name)}\s*=\s*([0-9.]+)", js)
    return float(m.group(1)) if m else None


def extract_object_numbers(js, object_name):
    """Best-effort: numbers inside `export const <object_name> = { ... };`."""
    m = re.search(rf"{re.escape(object_name)}\s*=\s*\{{(.*?)\}};", js, re.S)
    if not m:
        return {}
    body = m.group(1)
    out = {}
    for k, v in re.findall(r"(\w+)\s*:\s*([0-9.]+)", body):
        out[k] = float(v)
    return out


def main():
    ap = argparse.ArgumentParser(description="Freeze the baseline model manifest")
    ap.add_argument("--model", default=None, help="local ONNX path (for SHA-256); optional")
    ap.add_argument("--out", default=os.path.join(HERE, "baseline"))
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    lm_js = _read(os.path.join(ROOT, "src", "lib", "landmarkModel.js"))
    lq_js = _read(os.path.join(ROOT, "src", "lib", "landmarkQuality.js"))

    thresholds = extract_object_numbers(lq_js, "DEFAULT_QUALITY_THRESHOLDS")
    psr_scale = extract_numeric_const(lm_js, "PSR_SCALE")
    psr_floor = extract_numeric_const(lm_js, "PSR_FLOOR_FACTOR")

    model_sha = PROD_MODEL_SHA256
    model_path = None
    if args.model and os.path.exists(args.model):
        model_path = os.path.abspath(args.model)
        model_sha = sha256_file(args.model)

    manifest = {
        "modelId": "cepha29-hrnet-w32",
        "version": "cepha29-hrnet-w32-v1",
        "architecture": "HRNet-W32",
        "landmarkSet": "cepha29",
        "landmarks": len(CEPHA29),
        "channelOrder": CEPHA29,
        "input": {"width": 768, "height": 768, "channels": 3},
        "normalize": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        "decode": {"dark": True, "sigma": 2, "confidenceMode": "psr",
                   "psrScale": psr_scale, "psrFloorFactor": psr_floor},
        "refine": {"shape": True, "alpha": 0.6, "reg": 0.1, "k": 6, "wmin": 0.2},
        "robustness": {"autoOrientation": True, "autoPolarity": True, "clahe": "auto"},
        "qualityThresholds": thresholds,
        "trainingData": "Aariz / CEPHA29 (CC BY 4.0)",
        "source": {
            "url": PROD_MODEL_URL,
            "sha256": model_sha,
            "localPath": model_path,
        },
    }

    json.dump(manifest, open(os.path.join(args.out, "model_manifest.json"), "w", encoding="utf-8"),
              indent=2)

    readme = f"""# Baseline freeze

Model: **{manifest['modelId']} {manifest['version']}** ({manifest['architecture']},
{manifest['landmarks']} landmarks).

- ONNX: `{PROD_MODEL_URL}`
- SHA-256: `{model_sha}`

## Reproduce the baseline metrics (Aariz valid split)

```bash
python scripts/eval-landmark-model.py \\
  --model <landmarks-cepha29.int8.onnx> \\
  --set cepha29 --limit 200 --dark \\
  --ann-dir "<Aariz>/valid/Annotations/Cephalometric Landmarks/Senior Orthodontists" \\
  --images "<Aariz>/valid/Cephalograms" \\
  --metrics-out scripts/ai/baseline/aariz_valid_metrics.json \
  --report-ood --ood-out scripts/ai/baseline/aariz_valid_ood.csv
```

`--dark` is required (production decoding). Thresholds/PSR constants in
`model_manifest.json` are extracted from the source at freeze time.
"""
    open(os.path.join(args.out, "README.md"), "w", encoding="utf-8").write(readme)

    print(json.dumps(manifest, indent=2))
    print("\nwrote:", os.path.join(args.out, "model_manifest.json"), "+ README.md")


if __name__ == "__main__":
    main()
