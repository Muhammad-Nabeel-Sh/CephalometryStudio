# Landmark models

The app's AI auto-trace needs a trained ONNX landmark model. Two routes:

## Fast path — use the MIT 19-landmark model (no training)

1. Convert the pretrained `cwlachap` HRNet-W32 (19 landmarks, MIT):

```bash
pip install torch pillow huggingface_hub onnx onnxscript onnxruntime numpy
python scripts/convert-hrnet19-onnx.py --quantize \
  --calib-dir /path/to/sample-cephs --verify /path/to/sample.jpg
```

INT8 must be **static QDQ** (the script's default). Dynamic quantization emits
`ConvInteger`, which onnxruntime-web cannot run — the browser session then fails
and the app silently falls back to the demo detector.

`--verify` writes an overlay PNG labelling each channel with its index + symbol
so you can confirm the order matches `ISBI19` in `src/data/landmarkMap.js`.

2. Copy the ONNX Runtime and drop the model in place — no source edit needed
   (the manifest defaults to these local paths):

```bash
npm install onnxruntime-web
npm run setup:ort
copy landmarks-hrnet19.int8.onnx public\models\
```

3. `npm run dev` → **Markups → AI Trace**. To host the weights elsewhere (CDN /
   GitHub Release) instead, override `url` + `sha256` in
   `src/data/landmarkModelInfo.js`.

> Measured on 20 ISBI 2015 test images (offline harness
> `scripts/eval-landmark-model.py`):
> - plain argmax decoding ≈ 3.1 mm MRE / 33% within 2 mm
> - + **DARK** decoding ≈ 2.6 mm / 41% (the main decoder win)
> - + **SSM refinement** (PCA shape prior via `scripts/build-shape-model.py`)
>   ≈ **2.27 mm / ~52%**
>
> TTA (flip/scale) and CLAHE did not help. Still below commercial cloud tools
> (WebCeph/CephX), which train on far larger private datasets — treat
> auto-trace as an assist and verify each point.

## Full path — train CEPHA29 (29 landmarks)

Recommended: run the ready-made **Kaggle notebook**
(`scripts/train-cepha29/kaggle-notebook.ipynb`) on a free **T4**. It clones
CephaloHRNet, trains, and exports the ONNX.

### 1. Get the dataset

CEPHA29 = the **Aariz Cephalometric Dataset** — 1,000 lateral cephalograms,
29 landmarks, **CC BY 4.0** (attribution required):

- Figshare (primary): <https://doi.org/10.6084/m9.figshare.27986417> — `Aariz.zip` (~1.95 GB)
- Code: <https://github.com/manwaarkhd/aariz> (MIT)

The Kaggle mirror (`felixtemko/cepha29`) no longer exists — the notebook now
**auto-downloads `Aariz.zip` from Figshare** (Kaggle Internet must be On) and
verifies its md5 before extracting.

Expected layout (CephaloHRNet built-in support):

```
Dataset/
├── train/
│   ├── Cephalograms/
│   └── Annotations/Cephalometric Landmarks/{Junior,Senior} Orthodontists/*.json
├── valid/
└── test/
```

The annotation JSON symbol order defines the model's output channel order and
**must** match `CEPHA29` in `src/data/landmarkMap.js`:

```
A ANS B Me N Or Pog PNS Pn R S Ar Co Gn Go Po
LPM LIT LMT UPM UIA UIT UMT LIA Li Ls N` Pog` Sn
```

### 2. Train

**Kaggle (recommended):** create a notebook with Accelerator *GPU T4 x2* and
Internet **On** (the notebook downloads the dataset), then run
`kaggle-notebook.ipynb`. Training command it uses:

```bash
python train.py --data $DATASET --model hrnet_w32 \
  --imgsz 768 --batch 4 --epochs 200 --loss awing --amp --device 0 \
  --pretrained --workers 2 --patience 30 --name cepha29_w32_768 \
  --annotators "Junior Orthodontists" "Senior Orthodontists"
```

`--annotators` accepts one or more annotation directory names; pass both
Junior + Senior to average them (best quality), or omit for the default
`Senior Orthodontists`. (`--average_ann` is **not** a valid flag in this
CephaloHRNet build.)

`imgsz` is **square** (the app resizes to `inputSize × inputSize`). ~5–10 h on a
T4 at 768² (drop to `--imgsz 512` if needed). Enable “Save Version” and resume
from `last.pt` — Kaggle sessions cap at 12 h.

`runs/train/<name>/best.pt` is the checkpoint to export.

### 3. Export to ONNX (web-compatible)

```bash
python scripts/export-landmark-onnx.py \
  --repo ../CephaloHRNet \
  --weights ../CephaloHRNet/runs/train/<name>/best.pt \
  --model hrnet_w32 --num-landmarks 29 --input-size 768 \
  --quantize --calib-dir ./sample-cephs --verify sample.jpg
```

INT8 is **static QDQ** (the script's default). **Never** use dynamic
quantization — it emits `ConvInteger`, which onnxruntime-web cannot run, and the
app silently falls back to its demo detector. `--verify` writes an overlay PNG
labelling each channel with its index + symbol so you can confirm the CEPHA29
order.

### 4. Publish + wire up

1. Upload `landmarks-cepha29.int8.onnx` to a GitHub Release (or HuggingFace).
2. Set in `src/data/landmarkModelInfo.js` (`enabled: true`, `landmarkSet: "cepha29"`):

```js
enabled: true,
landmarkSet: "cepha29",
inputSize: 768,
inputChannels: 3,
normalize: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
decode: { dark: true, sigma: 2 },
refine: { shape: true, alpha: 0.6, reg: 0.1, k: 6, wmin: 0.2 },
url: "https://github.com/<you>/<repo>/releases/download/<tag>/landmarks-cepha29.int8.onnx",
sha256: "<printed by the export script>",
```

3. Build the CEPHA29 shape prior (for the SSM refinement):

```bash
python scripts/build-shape-model.py --set cepha29 \
  --ann-dir "<Dataset>/train/Annotations/Cephalometric Landmarks/Senior Orthodontists"
```

4. Deployment: `vercel.json` must allow WebAssembly (`'wasm-unsafe-eval'`) and
   the model host (`connect-src`). See the top-level README / AGENTS notes.

## Licensing

- CephaloHRNet code: MIT.
- CEPHA29 / Aariz dataset: **CC BY 4.0** (commercial use allowed with attribution).
- Model weights derived from the dataset are subject to the same attribution.
