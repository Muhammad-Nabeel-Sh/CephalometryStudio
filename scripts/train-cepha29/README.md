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

Uses the MIT-licensed [CephaloHRNet](https://github.com/Cestovatels/CephaloHRNet)
project, then exports with `scripts/export-landmark-onnx.py`.

## 1. Get the dataset

CEPHA29 / Aariz — 1,000 lateral cephalograms, 29 landmarks, free for research:

- Kaggle: <https://www.kaggle.com/datasets/felixtemko/cepha29>
- Figshare (Aariz): <https://figshare.com/articles/dataset/Aariz/22149727>

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

## 2. Train

```bash
git clone https://github.com/Cestovatels/CephaloHRNet.git
cd CephaloHRNet
python -m venv venv && venv\Scripts\activate        # Windows
pip install -r requirements.txt

python train.py --data Dataset --model hrnet_w32 \
  --epochs 200 --batch 8 --amp --device cuda
```

`runs/train/<name>/best.pt` is the checkpoint to export.

## 3. Export to ONNX

```bash
python ../scripts/export-landmark-onnx.py \
  --repo . \
  --weights runs/train/<name>/best.pt \
  --model hrnet_w32 --input-size 512 --quantize
```

## 4. Publish + wire up

1. Upload `landmarks-hrnet.int8.onnx` to a GitHub Release (or HuggingFace).
2. Set in `src/data/landmarkModelInfo.js`:

```js
url: "https://github.com/<you>/<repo>/releases/download/<tag>/landmarks-hrnet.int8.onnx",
sha256: "<printed by the export script>",
inputSize: 512,
inputChannels: 3,
ortUrl: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js",
wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
```

Until `url` and `ortUrl` are both set, the app runs the deterministic demo
detector so the auto-trace UI stays testable.

## Licensing

- CephaloHRNet code: MIT.
- CEPHA29/Aariz dataset: free for research — verify terms before commercial use.
- Model weights derived from the dataset inherit those constraints.
