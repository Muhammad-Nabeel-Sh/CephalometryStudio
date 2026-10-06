# Baseline freeze

Model: **cepha29-hrnet-w32 cepha29-hrnet-w32-v1** (HRNet-W32,
29 landmarks).

- ONNX: `https://huggingface.co/MuhammadNabeelSh/cephalometry-landmarks/resolve/main/landmarks-cepha29.int8.onnx`
- SHA-256: `f7f1db9cc2de37c0fa94dab431d7d3446d1d8ffc62fa92e6610c2380af83080d`

## Reproduce the baseline metrics (Aariz valid split)

```bash
python scripts/eval-landmark-model.py \
  --model <landmarks-cepha29.int8.onnx> \
  --set cepha29 --limit 200 --dark \
  --ann-dir "<Aariz>/valid/Annotations/Cephalometric Landmarks/Senior Orthodontists" \
  --images "<Aariz>/valid/Cephalograms" \
  --metrics-out scripts/ai/baseline/aariz_valid_metrics.json   --report-ood --ood-out scripts/ai/baseline/aariz_valid_ood.csv
```

`--dark` is required (production decoding). Thresholds/PSR constants in
`model_manifest.json` are extracted from the source at freeze time.
