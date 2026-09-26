#!/usr/bin/env python3
"""
Export a CEPHA29 cephalometric landmark model (HRNet-W32/W48) to ONNX for
in-browser inference with onnxruntime-web.

Prerequisite: train (or obtain) a checkpoint with CephaloHRNet
(https://github.com/Cestovatels/CephaloHRNet, MIT). See scripts/train-cepha29/README.md.

Example
-------
python scripts/export-landmark-onnx.py \
    --repo ../CephaloHRNet \
    --weights ../CephaloHRNet/runs/train/cepha29/best.pt \
    --model hrnet_w32 --input-size 768 \
    --quantize --calib-dir ./sample-cephs --verify sample.jpg

Outputs:
    landmarks-cepha29.onnx        (FP32)
    landmarks-cepha29.int8.onnx   (static QDQ INT8, with --quantize --calib-dir)

IMPORTANT: INT8 must be **static QDQ**. Dynamic quantization emits ConvInteger,
which onnxruntime-web does not implement — the browser session then fails and
the app silently falls back to its demo detector.

After export, upload the .onnx to a GitHub Release, then set `url` + `sha256`
(and `inputSize` / `inputChannels` / `normalize`) in src/data/landmarkModelInfo.js.
The CEPHA29 channel order must match src/data/landmarkMap.js `CEPHA29`.
"""

import argparse
import glob
import hashlib
import os
import sys

# CEPHA29 output-channel order — must match src/data/landmarkMap.js `CEPHA29`.
CEPHA29 = ["A", "ANS", "Ar", "B", "Co", "Gn", "Go", "LIA", "LIT", "LMT", "LPM",
           "Li", "Ls", "Me", "N", "N`", "Or", "PNS", "Pn", "Po", "Pog", "Pog`",
           "R", "S", "Sn", "UIA", "UIT", "UMT", "UPM"]
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def export_onnx(model, dummy, out, opset):
    """Export with whichever torch ONNX exporter is available (see
    scripts/convert-hrnet19-onnx.py for details)."""
    import torch

    errors = []
    for kwargs in ({"dynamo": True}, {"dynamo": False}, {}):
        try:
            torch.onnx.export(
                model, dummy, out, opset_version=opset,
                input_names=["input"], output_names=["heatmaps"], **kwargs,
            )
            return
        except TypeError:
            continue
        except Exception as e:  # noqa: BLE001
            errors.append(f"  {kwargs or 'default'}: {type(e).__name__}: {e}")
    raise SystemExit(
        "ONNX export failed. Install the exporter dependency for your torch:\n"
        "  pip install onnxscript   # torch >= 2.6 (dynamo exporter)\n"
        "  pip install onnx         # legacy exporter\n\n"
        "Attempts:\n" + "\n".join(errors)
    )


def quantize_web(fp32_path, out_path, calib_dir, size, channels):
    """Static QDQ quantization — the only web-compatible form (dynamic INT8
    produces ConvInteger, unsupported by onnxruntime-web)."""
    import numpy as np
    from PIL import Image
    from onnxruntime.quantization import quantize_static, CalibrationDataReader, QuantType, QuantFormat
    import onnxruntime as ort

    files = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff"):
        files += glob.glob(os.path.join(calib_dir, ext))
    files = sorted(files)
    if not files:
        print(f"No calibration images found in {calib_dir}; skipping quantization.")
        return False

    mean = np.array(MEAN, np.float32)
    std = np.array(STD, np.float32)

    def tensor_of(path):
        im = Image.open(path).convert("RGB").resize((size, size), Image.Resampling.BILINEAR)
        a = np.asarray(im, np.float32) / 255.0
        return ((a - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)

    iname = ort.InferenceSession(fp32_path).get_inputs()[0].name

    class Reader(CalibrationDataReader):
        def __init__(self):
            self.it = iter(files)

        def get_next(self):
            try:
                return {iname: tensor_of(next(self.it))}
            except StopIteration:
                return None

    print(f"Calibrating on {len(files)} images (static QDQ)...")
    quantize_static(fp32_path, out_path, Reader(), quant_format=QuantFormat.QDQ,
                    per_channel=True, weight_type=QuantType.QInt8, activation_type=QuantType.QUInt8)
    return True


def verify(model, image_path, out_png, size):
    """Run the model and draw index:symbol labels so the channel order can be
    confirmed visually before wiring it into the app."""
    import numpy as np
    import torch
    from PIL import Image, ImageDraw

    img = Image.open(image_path).convert("RGB")
    ow, oh = img.size
    resized = img.resize((size, size), Image.Resampling.BILINEAR)
    arr = np.asarray(resized, np.float32) / 255.0
    arr = (arr - np.array(MEAN, np.float32)) / np.array(STD, np.float32)
    x = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)
    with torch.no_grad():
        heat = model(x)
    hw = heat.shape[-1]
    idx = heat.reshape(1, -1, hw * hw).argmax(2)[0]
    draw = ImageDraw.Draw(img)
    for i in range(len(CEPHA29)):
        px = int((idx[i] % hw) * ow / hw)
        py = int((idx[i] // hw) * oh / hw)
        draw.ellipse([px - 5, py - 5, px + 5, py + 5], outline=(255, 0, 0), width=2)
        draw.text((px + 6, py - 6), f"{i}:{CEPHA29[i]}", fill=(255, 255, 0))
    img.save(out_png)
    print(f"Wrote verification overlay: {out_png}")


def load_state_dict(path):
    import torch

    ckpt = torch.load(path, map_location="cpu")
    if isinstance(ckpt, dict):
        for key in ("model_state_dict", "state_dict", "model", "net"):
            if key in ckpt and isinstance(ckpt[key], dict):
                ckpt = ckpt[key]
                break
    return {k.replace("module.", "", 1): v for k, v in ckpt.items()}


def main():
    ap = argparse.ArgumentParser(description="Export CEPHA29 HRNet to ONNX")
    ap.add_argument("--repo", required=True, help="Path to the CephaloHRNet repo (contains models/hrnet.py)")
    ap.add_argument("--weights", required=True, help="Path to the trained checkpoint (.pt/.pth)")
    ap.add_argument("--model", default="hrnet_w32", choices=["hrnet_w32", "hrnet_w48"])
    ap.add_argument("--num-landmarks", type=int, default=29)
    ap.add_argument("--input-size", type=int, default=768)
    ap.add_argument("--input-channels", type=int, default=3)
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--out", default="landmarks-cepha29.onnx")
    ap.add_argument("--quantize", action="store_true", help="Also emit a web-compatible static QDQ INT8 model")
    ap.add_argument("--calib-dir", default=None, help="Folder of sample cephalograms used to calibrate INT8 quantization")
    ap.add_argument("--verify", default=None, help="Sample image for a channel-order overlay")
    args = ap.parse_args()

    try:
        import torch
    except ImportError:
        sys.exit("PyTorch is required: pip install torch")

    repo = os.path.abspath(args.repo)
    if not os.path.isfile(os.path.join(repo, "models", "hrnet.py")):
        sys.exit(f"models/hrnet.py not found under {repo}")
    sys.path.insert(0, repo)

    from models.hrnet import build_hrnet  # noqa: E402

    model = build_hrnet(model_name=args.model, num_landmarks=args.num_landmarks)
    state = load_state_dict(args.weights)
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:
        print(f"Warning: {len(missing)} missing keys (e.g. {missing[:3]})")
    if unexpected:
        print(f"Warning: {len(unexpected)} unexpected keys (e.g. {unexpected[:3]})")
    model.eval()

    dummy = torch.randn(1, args.input_channels, args.input_size, args.input_size)
    with torch.no_grad():
        out = model(dummy)
    print(f"Model output shape: {tuple(out.shape)}  (channels should equal {args.num_landmarks})")
    if out.shape[1] != args.num_landmarks:
        sys.exit("Output channel count does not match --num-landmarks; check the checkpoint.")

    if args.verify:
        verify(model, args.verify, args.out.replace(".onnx", "-verify.png"), args.input_size)

    export_onnx(model, dummy, args.out, args.opset)
    print(f"Exported FP32: {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")
    print(f"  sha256: {sha256_file(args.out)}")

    if args.quantize:
        if not args.calib_dir:
            print("Skipping INT8: pass --calib-dir <folder of sample cephs> for web-compatible "
                  "static QDQ quantization (dynamic INT8 uses ConvInteger, which "
                  "onnxruntime-web cannot run).")
        else:
            try:
                qout = args.out.replace(".onnx", "") + ".int8.onnx"
                if quantize_web(args.out, qout, args.calib_dir, args.input_size, args.input_channels):
                    print(f"Exported INT8 (QDQ): {qout} ({os.path.getsize(qout) / 1e6:.1f} MB)")
                    print(f"  sha256: {sha256_file(qout)}")
            except ImportError:
                print("Skipping quantization (pip install onnxruntime pillow numpy).")

    print("\nNext: upload the .onnx to a GitHub Release and set url/sha256 in "
          "src/data/landmarkModelInfo.js")


if __name__ == "__main__":
    main()
