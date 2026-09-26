#!/usr/bin/env python3
"""
Convert the MIT-licensed 19-landmark HRNet-W32 cephalometric model
(cwlachap/hrnet-cephalometric-landmark-detection) to ONNX for in-browser use.

Weights are downloaded from the Hugging Face Hub (or pass --weights). The
architecture below matches the model card / published inference code
(HRNet-W32, 3-channel input, ImageNet normalization, 768x768).

Example
-------
python scripts/convert-hrnet19-onnx.py --verify sample.jpg
python scripts/convert-hrnet19-onnx.py --quantize --calib-dir ./sample-cephs

Outputs:
    landmarks-hrnet19.onnx        (FP32)
    landmarks-hrnet19.int8.onnx   (static QDQ INT8, with --quantize --calib-dir)

Note: use static QDQ quantization (the default here). Dynamic INT8 emits
ConvInteger, which onnxruntime-web does not implement, so the browser session
fails and the app falls back to its demo detector.

Then set `url` + `sha256` in src/data/landmarkModelInfo.js (landmarkSet
"isbi19", inputSize 768, inputChannels 3, ImageNet mean/std — already the
defaults). The channel order MUST match src/data/landmarkMap.js `ISBI19`:
    S N Or Po A B Pog Me Gn Go L1 U1 UL LL Sn Pog' PNS ANS Ar
"""

import argparse
import hashlib
import os
import sys

import torch
import torch.nn as nn

BN_MOMENTUM = 0.1
NUM_LANDMARKS = 19
INPUT_SIZE = 768
LANDMARK_ORDER = [
    "S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
    "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar",
]


# ─── HRNet-W32 (architecture from the published model) ────────────────────────
def conv3x3(in_planes, out_planes, stride=1):
    return nn.Conv2d(in_planes, out_planes, kernel_size=3, stride=stride, padding=1, bias=False)


class BasicBlock(nn.Module):
    expansion = 1

    def __init__(self, inplanes, planes, stride=1, downsample=None):
        super().__init__()
        self.conv1 = conv3x3(inplanes, planes, stride)
        self.bn1 = nn.BatchNorm2d(planes, momentum=BN_MOMENTUM)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = conv3x3(planes, planes)
        self.bn2 = nn.BatchNorm2d(planes, momentum=BN_MOMENTUM)
        self.downsample = downsample

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        if self.downsample is not None:
            residual = self.downsample(x)
        return self.relu(out + residual)


class Bottleneck(nn.Module):
    expansion = 4

    def __init__(self, inplanes, planes, stride=1, downsample=None):
        super().__init__()
        self.conv1 = nn.Conv2d(inplanes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes, momentum=BN_MOMENTUM)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes, momentum=BN_MOMENTUM)
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion, momentum=BN_MOMENTUM)
        self.relu = nn.ReLU(inplace=True)
        self.downsample = downsample

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))
        if self.downsample is not None:
            residual = self.downsample(x)
        return self.relu(out + residual)


class HighResolutionModule(nn.Module):
    def __init__(self, num_branches, blocks, num_blocks, num_inchannels, num_channels, fuse_method, multi_scale_output=True):
        super().__init__()
        self.num_inchannels = num_inchannels
        self.num_branches = num_branches
        self.multi_scale_output = multi_scale_output
        self.branches = self._make_branches(num_branches, blocks, num_blocks, num_channels)
        self.fuse_layers = self._make_fuse_layers()
        self.relu = nn.ReLU(True)

    def _make_one_branch(self, branch_index, block, num_blocks, num_channels, stride=1):
        downsample = None
        if stride != 1 or self.num_inchannels[branch_index] != num_channels[branch_index] * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.num_inchannels[branch_index], num_channels[branch_index] * block.expansion, 1, stride, bias=False),
                nn.BatchNorm2d(num_channels[branch_index] * block.expansion, momentum=BN_MOMENTUM))
        layers = [block(self.num_inchannels[branch_index], num_channels[branch_index], stride, downsample)]
        self.num_inchannels[branch_index] = num_channels[branch_index] * block.expansion
        for _ in range(1, num_blocks[branch_index]):
            layers.append(block(self.num_inchannels[branch_index], num_channels[branch_index]))
        return nn.Sequential(*layers)

    def _make_branches(self, num_branches, block, num_blocks, num_channels):
        return nn.ModuleList([self._make_one_branch(i, block, num_blocks, num_channels) for i in range(num_branches)])

    def _make_fuse_layers(self):
        if self.num_branches == 1:
            return None
        fuse_layers = []
        for i in range(self.num_branches if self.multi_scale_output else 1):
            fuse_layer = []
            for j in range(self.num_branches):
                if j > i:
                    fuse_layer.append(nn.Sequential(
                        nn.Conv2d(self.num_inchannels[j], self.num_inchannels[i], 1, bias=False),
                        nn.BatchNorm2d(self.num_inchannels[i]),
                        nn.Upsample(scale_factor=2 ** (j - i), mode='nearest')))
                elif j == i:
                    fuse_layer.append(None)
                else:
                    conv3x3s = []
                    for k in range(i - j):
                        out_ch = self.num_inchannels[i] if k == i - j - 1 else self.num_inchannels[j]
                        conv3x3s.append(nn.Sequential(
                            nn.Conv2d(self.num_inchannels[j], out_ch, 3, 2, 1, bias=False),
                            nn.BatchNorm2d(out_ch),
                            nn.ReLU(True) if k < i - j - 1 else nn.Identity()))
                    fuse_layer.append(nn.Sequential(*conv3x3s))
            fuse_layers.append(nn.ModuleList(fuse_layer))
        return nn.ModuleList(fuse_layers)

    def get_num_inchannels(self):
        return self.num_inchannels

    def forward(self, x):
        if self.num_branches == 1:
            return [self.branches[0](x[0])]
        for i in range(self.num_branches):
            x[i] = self.branches[i](x[i])
        x_fuse = []
        for i in range(len(self.fuse_layers)):
            y = x[0] if i == 0 else self.fuse_layers[i][0](x[0])
            for j in range(1, self.num_branches):
                y = y + (x[j] if i == j else self.fuse_layers[i][j](x[j]))
            x_fuse.append(self.relu(y))
        return x_fuse


blocks_dict = {'BASIC': BasicBlock, 'BOTTLENECK': Bottleneck}


class HRNet(nn.Module):
    def __init__(self, num_joints=NUM_LANDMARKS):
        super().__init__()
        self.inplanes = 64
        self.conv1 = nn.Conv2d(3, 64, kernel_size=3, stride=2, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(64, momentum=BN_MOMENTUM)
        self.conv2 = nn.Conv2d(64, 64, kernel_size=3, stride=2, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(64, momentum=BN_MOMENTUM)
        self.relu = nn.ReLU(inplace=True)
        self.layer1 = self._make_layer(Bottleneck, 64, 4)

        self.stage2_cfg = {'NUM_MODULES': 1, 'NUM_BRANCHES': 2, 'BLOCK': 'BASIC', 'NUM_BLOCKS': [4, 4], 'NUM_CHANNELS': [32, 64]}
        num_channels = [ch * BasicBlock.expansion for ch in self.stage2_cfg['NUM_CHANNELS']]
        self.transition1 = self._make_transition_layer([256], num_channels)
        self.stage2, pre_stage_channels = self._make_stage(self.stage2_cfg, num_channels)

        self.stage3_cfg = {'NUM_MODULES': 4, 'NUM_BRANCHES': 3, 'BLOCK': 'BASIC', 'NUM_BLOCKS': [4, 4, 4], 'NUM_CHANNELS': [32, 64, 128]}
        num_channels = [ch * BasicBlock.expansion for ch in self.stage3_cfg['NUM_CHANNELS']]
        self.transition2 = self._make_transition_layer(pre_stage_channels, num_channels)
        self.stage3, pre_stage_channels = self._make_stage(self.stage3_cfg, num_channels)

        self.stage4_cfg = {'NUM_MODULES': 3, 'NUM_BRANCHES': 4, 'BLOCK': 'BASIC', 'NUM_BLOCKS': [4, 4, 4, 4], 'NUM_CHANNELS': [32, 64, 128, 256]}
        num_channels = [ch * BasicBlock.expansion for ch in self.stage4_cfg['NUM_CHANNELS']]
        self.transition3 = self._make_transition_layer(pre_stage_channels, num_channels)
        self.stage4, pre_stage_channels = self._make_stage(self.stage4_cfg, num_channels, multi_scale_output=False)

        self.final_layer = nn.Conv2d(pre_stage_channels[0], num_joints, kernel_size=1, stride=1, padding=0)

    def _make_transition_layer(self, num_channels_pre, num_channels_cur):
        num_branches_cur = len(num_channels_cur)
        num_branches_pre = len(num_channels_pre)
        transition_layers = []
        for i in range(num_branches_cur):
            if i < num_branches_pre:
                if num_channels_cur[i] != num_channels_pre[i]:
                    transition_layers.append(nn.Sequential(
                        nn.Conv2d(num_channels_pre[i], num_channels_cur[i], 3, 1, 1, bias=False),
                        nn.BatchNorm2d(num_channels_cur[i]), nn.ReLU(inplace=True)))
                else:
                    transition_layers.append(None)
            else:
                conv3x3s = []
                for j in range(i + 1 - num_branches_pre):
                    inchannels = num_channels_pre[-1]
                    outchannels = num_channels_cur[i] if j == i - num_branches_pre else inchannels
                    conv3x3s.append(nn.Sequential(
                        nn.Conv2d(inchannels, outchannels, 3, 2, 1, bias=False),
                        nn.BatchNorm2d(outchannels), nn.ReLU(inplace=True)))
                transition_layers.append(nn.Sequential(*conv3x3s))
        return nn.ModuleList(transition_layers)

    def _make_layer(self, block, planes, blocks, stride=1):
        downsample = None
        if stride != 1 or self.inplanes != planes * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.inplanes, planes * block.expansion, 1, stride, bias=False),
                nn.BatchNorm2d(planes * block.expansion, momentum=BN_MOMENTUM))
        layers = [block(self.inplanes, planes, stride, downsample)]
        self.inplanes = planes * block.expansion
        for _ in range(1, blocks):
            layers.append(block(self.inplanes, planes))
        return nn.Sequential(*layers)

    def _make_stage(self, layer_config, num_inchannels, multi_scale_output=True):
        num_modules = layer_config['NUM_MODULES']
        num_branches = layer_config['NUM_BRANCHES']
        num_blocks = layer_config['NUM_BLOCKS']
        num_channels = layer_config['NUM_CHANNELS']
        block = blocks_dict[layer_config['BLOCK']]
        modules = []
        for i in range(num_modules):
            reset_multi_scale = multi_scale_output or i < num_modules - 1
            modules.append(HighResolutionModule(num_branches, block, num_blocks, num_inchannels, num_channels, 'SUM', reset_multi_scale))
            num_inchannels = modules[-1].get_num_inchannels()
        return nn.Sequential(*modules), num_inchannels

    def forward(self, x):
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.relu(self.bn2(self.conv2(x)))
        x = self.layer1(x)
        x_list = [self.transition1[i](x) if self.transition1[i] else x for i in range(self.stage2_cfg['NUM_BRANCHES'])]
        y_list = self.stage2(x_list)
        x_list = []
        for i in range(self.stage3_cfg['NUM_BRANCHES']):
            idx = min(i, len(y_list) - 1)
            x_list.append(self.transition2[i](y_list[idx]) if self.transition2[i] else y_list[i])
        y_list = self.stage3(x_list)
        x_list = []
        for i in range(self.stage4_cfg['NUM_BRANCHES']):
            idx = min(i, len(y_list) - 1)
            x_list.append(self.transition3[i](y_list[idx]) if self.transition3[i] else y_list[i])
        y_list = self.stage4(x_list)
        return self.final_layer(y_list[0])


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def export_onnx(model, dummy, out, opset):
    """Export with whichever torch ONNX exporter is available.

    Newer torch defaults to the dynamo exporter (needs `onnxscript`); older
    torch uses the legacy exporter (needs `onnx`). Try both and give a clear
    remedy if neither dependency is installed.
    """
    errors = []
    for kwargs in ({"dynamo": True}, {"dynamo": False}, {}):
        try:
            torch.onnx.export(
                model, dummy, out, opset_version=opset,
                input_names=["input"], output_names=["heatmaps"], **kwargs,
            )
            return
        except TypeError:
            continue  # this torch version has no `dynamo` kwarg
        except Exception as e:  # noqa: BLE001
            errors.append(f"  {kwargs or 'default'}: {type(e).__name__}: {e}")
    raise SystemExit(
        "ONNX export failed. Install the exporter dependency for your torch:\n"
        "  pip install onnxscript   # torch >= 2.6 (dynamo exporter)\n"
        "  pip install onnx         # legacy exporter\n\n"
        "Attempts:\n" + "\n".join(errors)
    )


def strip_prefixes(state):
    out = {}
    for k, v in state.items():
        for prefix in ("module.", "backbone.", "model."):
            if k.startswith(prefix):
                k = k[len(prefix):]
        out[k] = v
    return out


def load_weights(path):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if isinstance(ckpt, dict):
        for key in ("model_state_dict", "state_dict", "model", "net"):
            if key in ckpt and isinstance(ckpt[key], dict):
                ckpt = ckpt[key]
                break
    return strip_prefixes(ckpt)


def verify(model, image_path, out_png):
    """Run the model and draw index+symbol labels so the channel order can be
    confirmed visually before wiring it into the app."""
    from PIL import Image, ImageDraw

    img = Image.open(image_path).convert("RGB")
    ow, oh = img.size
    resized = img.resize((INPUT_SIZE, INPUT_SIZE), Image.Resampling.BILINEAR)
    arr = torch.from_numpy(
        __import__("numpy").array(resized).astype("float32") / 255.0
    ).permute(2, 0, 1).unsqueeze(0)
    mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
    with torch.no_grad():
        heat = model((arr - mean) / std)
    hw = heat.shape[-1]
    idx = heat.reshape(1, NUM_LANDMARKS, -1).argmax(2)[0]
    draw = ImageDraw.Draw(img)
    for i in range(NUM_LANDMARKS):
        x = int((idx[i] % hw) * ow / hw)
        y = int((idx[i] // hw) * oh / hw)
        draw.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(255, 0, 0), width=2)
        draw.text((x + 6, y - 6), f"{i}:{LANDMARK_ORDER[i]}", fill=(255, 255, 0))
    img.save(out_png)
    print(f"Wrote verification overlay: {out_png}")


def quantize_web(fp32_path, out_path, calib_dir):
    """Static QDQ quantization — the web-compatible form.

    Dynamic quantization emits ConvInteger, which onnxruntime-web does not
    implement, so the browser session fails to load. Static QDQ keeps float
    Conv with Quantize/Dequantize nodes and int8 weights instead.
    """
    import glob
    import numpy as np
    from PIL import Image
    from onnxruntime.quantization import quantize_static, CalibrationDataReader, QuantType, QuantFormat
    import onnxruntime as ort

    files = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
        files += glob.glob(os.path.join(calib_dir, ext))
    files = sorted(files)
    if not files:
        print(f"No calibration images found in {calib_dir}; skipping quantization.")
        return False

    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)

    def tensor_of(path):
        im = Image.open(path).convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.Resampling.BILINEAR)
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


def main():
    ap = argparse.ArgumentParser(description="Convert cwlachap 19-landmark HRNet to ONNX")
    ap.add_argument("--weights", default=None, help="Local best_model.pth (else download from HF)")
    ap.add_argument("--out", default="landmarks-hrnet19.onnx")
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--quantize", action="store_true", help="Also emit a web-compatible static QDQ INT8 model")
    ap.add_argument("--calib-dir", default=None, help="Folder of sample cephalograms used to calibrate INT8 quantization")
    ap.add_argument("--verify", default=None, help="Sample image path for an order-verification overlay")
    args = ap.parse_args()

    weights = args.weights
    if not weights:
        try:
            from huggingface_hub import hf_hub_download
        except ImportError:
            sys.exit("Provide --weights or: pip install huggingface_hub")
        weights = hf_hub_download(
            repo_id="cwlachap/hrnet-cephalometric-landmark-detection",
            filename="best_model.pth",
        )

    model = HRNet(num_joints=NUM_LANDMARKS)
    missing, unexpected = model.load_state_dict(load_weights(weights), strict=False)
    if missing:
        print(f"Warning: {len(missing)} missing keys (e.g. {missing[:3]})")
    if unexpected:
        print(f"Warning: {len(unexpected)} unexpected keys (e.g. {unexpected[:3]})")
    model.eval()

    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    with torch.no_grad():
        out = model(dummy)
    print(f"Output shape: {tuple(out.shape)} (channels should be {NUM_LANDMARKS})")
    if out.shape[1] != NUM_LANDMARKS:
        sys.exit("Unexpected output channel count; check the checkpoint.")

    if args.verify:
        verify(model, args.verify, "landmarks-hrnet19-verify.png")

    export_onnx(model, dummy, args.out, args.opset)
    print(f"Exported FP32: {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")
    print(f"  sha256: {sha256_file(args.out)}")

    if args.quantize:
        if not args.calib_dir:
            print("Skipping INT8: pass --calib-dir <folder of sample cephs> for "
                  "web-compatible static QDQ quantization (dynamic INT8 uses "
                  "ConvInteger, which onnxruntime-web cannot run).")
        else:
            try:
                qout = args.out.replace(".onnx", "") + ".int8.onnx"
                if quantize_web(args.out, qout, args.calib_dir):
                    print(f"Exported INT8 (QDQ): {qout} ({os.path.getsize(qout) / 1e6:.1f} MB)")
                    print(f"  sha256: {sha256_file(qout)}")
            except ImportError:
                print("Skipping quantization (pip install onnxruntime pillow numpy).")

    print("\nLandmark channel order (must match src/data/landmarkMap.js ISBI19):")
    print("  " + " ".join(LANDMARK_ORDER))
    print("\nNext: upload the .onnx to a GitHub Release and set url/sha256 in "
          "src/data/landmarkModelInfo.js")


if __name__ == "__main__":
    main()
