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
    --model hrnet_w32 --input-size 512 --quantize

Outputs:
    landmarks-hrnet.onnx          (FP32)
    landmarks-hrnet.int8.onnx     (dynamic INT8, when --quantize is passed)

After export, upload the .onnx to a GitHub Release, then set `url` + `sha256`
(and `inputSize` / `inputChannels`) in src/data/landmarkModelInfo.js.
The CEPHA29 channel order must match src/data/landmarkMap.js `CEPHA29`.
"""

import argparse
import hashlib
import os
import sys


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
    ap.add_argument("--input-size", type=int, default=512)
    ap.add_argument("--input-channels", type=int, default=3)
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--out", default="landmarks-hrnet.onnx")
    ap.add_argument("--quantize", action="store_true", help="Also emit a dynamic INT8 model")
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

    export_onnx(model, dummy, args.out, args.opset)
    print(f"Exported FP32: {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")
    print(f"  sha256: {sha256_file(args.out)}")

    if args.quantize:
        try:
            from onnxruntime.quantization import quantize_dynamic, QuantType
        except ImportError:
            print("Skipping quantization (pip install onnxruntime).")
        else:
            qout = args.out.replace(".onnx", "") + ".int8.onnx"
            quantize_dynamic(args.out, qout, weight_type=QuantType.QInt8)
            print(f"Exported INT8: {qout} ({os.path.getsize(qout) / 1e6:.1f} MB)")
            print(f"  sha256: {sha256_file(qout)}")

    print("\nNext: upload the .onnx to a GitHub Release and set url/sha256 in "
          "src/data/landmarkModelInfo.js")


if __name__ == "__main__":
    main()
