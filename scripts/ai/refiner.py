"""Crop refiner: a second, small heatmap model that re-places selected landmarks
from a high-resolution crop around the first-pass prediction.

Why (docs/AI_DIAGNOSIS_2026-11.md): most errors over 4 mm come from Po, PNS, Go,
Ar, Or and ANS. The main model sees the film at 768 px and decodes a 192 px
heatmap (about 1 mm per heatmap pixel on an ISBI film). The refiner looks at a
25.6 mm crop at 256 px (about 0.1 mm per input pixel, 0.2 mm per heatmap pixel).

Scale needs no calibration: crops are sized from the S-N distance of the points
(taken as 70 mm), so a film's pixel size never has to be known. Training uses the
labelled S and N; inference uses the first pass's.

Crop geometry (shared by training, export and the app; keep in sync):
    step   = (|S - N| / SN_MM) * crop_mm / size      # source px per crop px
    src(u) = c + R(theta) * step * (u - size / 2)     # u = crop pixel (x, y)
    heatmap index g = u / stride                      # stride = size / heatmap size
Inference uses theta = 0.

Commands:
  python refiner.py train  --data md29 --out runs/refiner [--landmarks Po PNS ...]
  python refiner.py export --weights runs/refiner/best.pt --out landmarks-refiner.onnx
The export writes <out>.json next to the model with the geometry above.
"""
import argparse
import glob
import json
import math
import os
import random
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from canonical import CEPHA29  # noqa: E402

WEAK = ["Po", "PNS", "Go", "Ar", "Or", "ANS"]
SN_MM = 70.0
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


# ──────────────────────────────────────────────
# Geometry (numpy + cv2; no torch)
# ──────────────────────────────────────────────

def crop_matrix(center, sn_px, crop_mm, size, theta=0.0, scale=1.0):
    """2x3 matrix mapping crop pixel (u, v) -> source pixel (x, y)."""
    step = (sn_px / SN_MM) * crop_mm / size / scale
    c, s = math.cos(theta), math.sin(theta)
    a = np.array([[c, -s], [s, c]], np.float64) * step
    t = np.asarray(center, np.float64) - a @ np.array([size / 2, size / 2])
    return np.hstack([a, t[:, None]])


def crop(gray, m, size):
    """Bilinear crop of a uint8 grayscale film; outside the film reads 0."""
    import cv2
    return cv2.warpAffine(gray, m, (size, size), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def to_crop(m, pts):
    """Source points (N, 2) -> crop coordinates under matrix m."""
    a, t = m[:, :2], m[:, 2]
    return (np.linalg.inv(a) @ (np.asarray(pts, np.float64) - t).T).T


def to_source(m, uv):
    return (m[:, :2] @ np.asarray(uv, np.float64).T).T + m[:, 2]


def normalize(patch):
    """uint8 (H, W) -> float32 (3, H, W), ImageNet-normalized like the main model."""
    a = patch.astype(np.float32) / 255.0
    return ((a[None] - MEAN[:, None, None]) / STD[:, None, None]).astype(np.float32)


def gaussian(hm_size, g, sigma):
    ys, xs = np.mgrid[0:hm_size, 0:hm_size].astype(np.float32)
    return np.exp(-((xs - g[0]) ** 2 + (ys - g[1]) ** 2) / (2 * sigma ** 2))


def decode_dark(hm, sigma=1.0):
    """(K, H, W) -> (K, 2) sub-pixel index coordinates (DARK: Taylor step on the log)."""
    from scipy.ndimage import gaussian_filter
    out = np.zeros((hm.shape[0], 2), np.float64)
    for k in range(hm.shape[0]):
        m = np.log(np.clip(gaussian_filter(hm[k].astype(np.float64), sigma), 1e-10, None))
        h, w = m.shape
        y, x = divmod(int(np.argmax(m)), w)
        px, py = float(x), float(y)
        if 1 <= x < w - 1 and 1 <= y < h - 1:
            dx = 0.5 * (m[y, x + 1] - m[y, x - 1])
            dy = 0.5 * (m[y + 1, x] - m[y - 1, x])
            dxx = m[y, x + 1] - 2 * m[y, x] + m[y, x - 1]
            dyy = m[y + 1, x] - 2 * m[y, x] + m[y - 1, x]
            dxy = 0.25 * (m[y + 1, x + 1] - m[y + 1, x - 1] - m[y - 1, x + 1] + m[y - 1, x - 1])
            det = dxx * dyy - dxy ** 2
            if det != 0:
                ox = (dyy * dx - dxy * dy) / det
                oy = (dxx * dy - dxy * dx) / det
                if abs(ox) < 1 and abs(oy) < 1:
                    px, py = x - ox, y - oy
        out[k] = (px, py)
    return out


def refine_points(run, gray, pts, landmarks, meta):
    """Refine `landmarks` of a 29-point prediction `pts` (source px) on one film.

    run(batch (B, 3, S, S) float32) -> heatmaps (B, K, H, H). Returns a copy of pts.
    """
    sym = {s: i for i, s in enumerate(CEPHA29)}
    sn = float(np.linalg.norm(pts[sym["S"]] - pts[sym["N"]]))
    if not np.isfinite(sn) or sn <= 1:
        return pts.copy()
    size, crop_mm = meta["size"], meta["crop_mm"]
    order = meta["landmarks"]
    mats, batch = [], []
    for s in landmarks:
        m = crop_matrix(pts[sym[s]], sn, crop_mm, size)
        mats.append(m)
        batch.append(normalize(crop(gray, m, size)))
    hms = run(np.stack(batch))
    stride = size / hms.shape[-1]
    out = pts.copy()
    for j, s in enumerate(landmarks):
        g = decode_dark(hms[j, order.index(s)][None])[0]
        out[sym[s]] = to_source(mats[j], (g * stride)[None])[0]
    return out


# ──────────────────────────────────────────────
# Data
# ──────────────────────────────────────────────

def load_split(root, split, annotators="Merged29", landmarks=WEAK):
    """[(id, gray uint8, pts (29, 2), visible bool (29,))] for films with S and N labelled."""
    from PIL import Image
    ann = os.path.join(root, split, "Annotations", "Cephalometric Landmarks", annotators)
    out = []
    for jp in sorted(glob.glob(os.path.join(ann, "*.json"))):
        d = json.load(open(jp, encoding="utf-8"))
        stem = os.path.splitext(os.path.basename(jp))[0]
        imgs = glob.glob(os.path.join(root, split, "Cephalograms", stem + ".*"))
        if not imgs:
            continue
        by = {lm["symbol"]: (lm["value"]["x"], lm["value"]["y"]) for lm in d.get("landmarks", [])}
        pts = np.array([by.get(s, (-1, -1)) for s in CEPHA29], np.float64)
        vis = np.array([(s in d["visible"]) if "visible" in d else True for s in CEPHA29])
        vis &= (pts[:, 0] >= 0) & (pts[:, 1] >= 0)
        si, ni = CEPHA29.index("S"), CEPHA29.index("N")
        if not (vis[si] and vis[ni]) or not any(vis[CEPHA29.index(s)] for s in landmarks):
            continue
        gray = np.asarray(Image.open(imgs[0]).convert("L"), np.uint8)
        out.append((stem, gray, pts, vis))
    return out


def jitter_mm(rng):
    """First-pass-like offset in S-N-scaled mm: mostly ~1.5 mm, sometimes several."""
    sd = 1.5 if rng.random() < 0.7 else 4.0
    v = rng.normal(0, sd, 2)
    n = np.linalg.norm(v)
    return v * (8.0 / n) if n > 8.0 else v


class CropSet:
    """One sample per (film, target landmark). Torch-free; wrapped by a Dataset."""

    def __init__(self, films, landmarks, size, crop_mm, hm_size, sigma, train, seed=0):
        self.films, self.landmarks = films, landmarks
        self.size, self.crop_mm, self.hm, self.sigma, self.train = size, crop_mm, hm_size, sigma, train
        self.items = [(f, s) for f, (_, _, _, vis) in enumerate(films)
                      for s in landmarks if vis[CEPHA29.index(s)]]
        rng = np.random.default_rng(seed)
        # Validation offsets are fixed so epochs are comparable.
        self.fixed = [jitter_mm(rng) for _ in self.items]

    def __len__(self):
        return len(self.items)

    def sample(self, i, rng):
        f, s = self.items[i]
        _, gray, pts, vis = self.films[f]
        si, ni = CEPHA29.index("S"), CEPHA29.index("N")
        sn = float(np.linalg.norm(pts[si] - pts[ni]))
        if self.train:
            sn *= rng.uniform(0.95, 1.05)          # first-pass S-N is not exact
            off = jitter_mm(rng)
            theta = math.radians(rng.uniform(-10, 10))
            scale = rng.uniform(0.9, 1.1)
        else:
            off, theta, scale = self.fixed[i], 0.0, 1.0
        center = pts[CEPHA29.index(s)] + off * sn / SN_MM
        m = crop_matrix(center, sn, self.crop_mm, self.size, theta, scale)
        patch = crop(gray, m, self.size)
        if self.train:
            p = patch.astype(np.float32)
            p = (p - p.mean()) * rng.uniform(0.75, 1.3) + p.mean() + rng.uniform(-20, 20)
            p = 255.0 * (np.clip(p, 0, 255) / 255.0) ** rng.uniform(0.8, 1.25)
            if rng.random() < 0.3:
                p += rng.normal(0, rng.uniform(2, 8), p.shape)
            patch = np.clip(p, 0, 255).astype(np.uint8)
        stride = self.size / self.hm
        uv = to_crop(m, pts) / stride
        target = np.zeros((len(self.landmarks), self.hm, self.hm), np.float32)
        mask = np.zeros((len(self.landmarks),), np.float32)
        for k, t in enumerate(self.landmarks):
            j = CEPHA29.index(t)
            g = uv[j]
            if vis[j] and -2 <= g[0] <= self.hm + 1 and -2 <= g[1] <= self.hm + 1:
                target[k] = gaussian(self.hm, g, self.sigma)
                mask[k] = 1.0
        # mm per source px for this film in S-N-scaled mm (for error reporting)
        return normalize(patch), target, mask, CEPHA29.index(s), m, SN_MM / sn


# ──────────────────────────────────────────────
# Model (torch)
# ──────────────────────────────────────────────

RESNET18_URL = "https://download.pytorch.org/models/resnet18-f37072fd.pth"


def _resnet18(pretrained):
    """torchvision-compatible ResNet-18 (same parameter names), without torchvision."""
    import torch
    import torch.nn as nn

    class Block(nn.Module):
        def __init__(self, cin, cout, stride):
            super().__init__()
            self.conv1 = nn.Conv2d(cin, cout, 3, stride, 1, bias=False)
            self.bn1 = nn.BatchNorm2d(cout)
            self.relu = nn.ReLU(inplace=True)
            self.conv2 = nn.Conv2d(cout, cout, 3, 1, 1, bias=False)
            self.bn2 = nn.BatchNorm2d(cout)
            self.downsample = None
            if stride != 1 or cin != cout:
                self.downsample = nn.Sequential(nn.Conv2d(cin, cout, 1, stride, bias=False), nn.BatchNorm2d(cout))

        def forward(self, x):
            idt = x if self.downsample is None else self.downsample(x)
            y = self.relu(self.bn1(self.conv1(x)))
            return self.relu(self.bn2(self.conv2(y)) + idt)

    class R18(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv1 = nn.Conv2d(3, 64, 7, 2, 3, bias=False)
            self.bn1 = nn.BatchNorm2d(64)
            self.relu = nn.ReLU(inplace=True)
            self.maxpool = nn.MaxPool2d(3, 2, 1)
            self.layer1 = nn.Sequential(Block(64, 64, 1), Block(64, 64, 1))
            self.layer2 = nn.Sequential(Block(64, 128, 2), Block(128, 128, 1))
            self.layer3 = nn.Sequential(Block(128, 256, 2), Block(256, 256, 1))
            self.layer4 = nn.Sequential(Block(256, 512, 2), Block(512, 512, 1))

    r = R18()
    if pretrained:
        sd = torch.hub.load_state_dict_from_url(RESNET18_URL, map_location="cpu", progress=False)
        missing, _ = r.load_state_dict({k: v for k, v in sd.items() if not k.startswith("fc.")}, strict=False)
        assert not missing, missing
        print("ResNet-18 encoder: ImageNet weights")
    return r


def build_model(k, pretrained=False):
    import torch.nn as nn
    import torch.nn.functional as F

    class Refiner(nn.Module):
        """ResNet-18 encoder + FPN-style decoder to stride 2 (256 px in -> 128 px heatmaps)."""

        def __init__(self):
            super().__init__()
            r = _resnet18(pretrained)
            self.stem = nn.Sequential(r.conv1, r.bn1, r.relu)          # /2, 64
            self.pool = r.maxpool
            self.l1, self.l2, self.l3, self.l4 = r.layer1, r.layer2, r.layer3, r.layer4
            ch = 96
            self.lat = nn.ModuleList(nn.Conv2d(c, ch, 1) for c in (64, 64, 128, 256, 512))
            self.smooth = nn.Sequential(
                nn.Conv2d(ch, ch, 3, padding=1), nn.BatchNorm2d(ch), nn.ReLU(inplace=True),
                nn.Conv2d(ch, ch, 3, padding=1), nn.BatchNorm2d(ch), nn.ReLU(inplace=True))
            self.head = nn.Conv2d(ch, k, 1)

        def forward(self, x):
            c0 = self.stem(x)
            c1 = self.l1(self.pool(c0))
            c2 = self.l2(c1)
            c3 = self.l3(c2)
            c4 = self.l4(c3)
            y = self.lat[4](c4)
            for lat, c in ((self.lat[3], c3), (self.lat[2], c2), (self.lat[1], c1), (self.lat[0], c0)):
                y = F.interpolate(y, size=c.shape[-2:], mode="bilinear", align_corners=False) + lat(c)
            return self.head(self.smooth(y))

    return Refiner()


def _torch_dataset(cs, seed):
    import torch

    class DS(torch.utils.data.Dataset):
        def __len__(self):
            return len(cs)

        def __getitem__(self, i):
            rng = np.random.default_rng((seed, i, random.getrandbits(32)))
            x, t, m, j, mat, mm = cs.sample(i, rng)
            return (torch.from_numpy(x), torch.from_numpy(t), torch.from_numpy(m),
                    j, torch.from_numpy(mat), mm)
    return DS()


def train(args):
    import torch
    from torch.utils.data import DataLoader

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    dev = torch.device(args.device if args.device != "auto" else ("cuda" if torch.cuda.is_available() else "cpu"))
    t0 = time.time()
    tr = load_split(args.data, "train", landmarks=args.landmarks)
    va = load_split(args.data, "valid", landmarks=args.landmarks)
    print(f"films: train {len(tr)}  valid {len(va)}  ({time.time() - t0:.0f} s to load)", flush=True)
    hm = args.size // 2
    cs_tr = CropSet(tr, args.landmarks, args.size, args.crop_mm, hm, args.sigma, True)
    cs_va = CropSet(va, args.landmarks, args.size, args.crop_mm, hm, args.sigma, False, seed=1)
    print(f"crops per epoch: train {len(cs_tr)}  valid {len(cs_va)}", flush=True)
    dl_tr = DataLoader(_torch_dataset(cs_tr, args.seed), batch_size=args.batch, shuffle=True,
                       num_workers=args.workers, drop_last=True, persistent_workers=args.workers > 0)
    dl_va = DataLoader(_torch_dataset(cs_va, args.seed), batch_size=args.batch, shuffle=False,
                       num_workers=args.workers)

    model = build_model(len(args.landmarks), pretrained=args.pretrained).to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    total = args.epochs * len(dl_tr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=total, pct_start=0.05)
    os.makedirs(args.out, exist_ok=True)
    best, bad = float("inf"), 0
    log = []
    for ep in range(1, args.epochs + 1):
        model.train()
        tl, n = 0.0, 0
        for x, t, m, *_ in dl_tr:
            x, t, m = x.to(dev), t.to(dev), m.to(dev)
            p = model(x)
            # Foreground-weighted MSE: plain MSE on a small Gaussian collapses to an
            # all-zero map first (most pixels are background).
            w = 1.0 + args.fg_weight * (t > 0.05).float()
            loss = ((w * (p - t) ** 2).mean(dim=(2, 3)) * m).sum() / m.sum().clamp(min=1)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            tl += loss.item() * x.size(0)
            n += x.size(0)
        errs = evaluate(model, dl_va, dev, args.landmarks, args.size)
        stats = {"epoch": ep, "train_loss": tl / max(1, n),
                 "valid_mre": float(np.mean(errs["all"])),
                 "valid_median": float(np.median(errs["all"])),
                 "valid_clipped": float(np.mean(np.minimum(errs["all"], 10.0))),
                 "start_mre": float(np.mean(errs["start"])),
                 "per_landmark": {s: float(np.mean(v)) for s, v in errs["by"].items()}}
        log.append(stats)
        msg = (f"[{ep:3d}/{args.epochs}] loss {stats['train_loss']:.5f}  valid MRE {stats['valid_mre']:.3f} "
               f"(median {stats['valid_median']:.3f}, start {stats['start_mre']:.2f})  "
               + " ".join(f"{s} {v:.2f}" for s, v in stats["per_landmark"].items()))
        if stats["valid_clipped"] < best:
            best, bad = stats["valid_clipped"], 0
            torch.save({"model": model.state_dict(), "landmarks": args.landmarks, "size": args.size,
                        "crop_mm": args.crop_mm, "sigma": args.sigma, "epoch": ep, "stats": stats},
                       os.path.join(args.out, "best.pt"))
            msg += "  [best]"
        else:
            bad += 1
        print(msg, flush=True)
        json.dump(log, open(os.path.join(args.out, "log.json"), "w"), indent=1)
        if args.patience and bad >= args.patience:
            print(f"early stop at epoch {ep}")
            break
    print("best valid clipped MRE (S-N-scaled mm):", round(best, 3))


def evaluate(model, loader, dev, landmarks, size):
    """Radial errors in S-N-scaled mm on fixed-offset validation crops."""
    import torch
    model.eval()
    by = {s: [] for s in landmarks}
    allv, start = [], []
    with torch.no_grad():
        for x, t, m, j, mat, mm in loader:
            hm = model(x.to(dev)).float().cpu().numpy()
            stride = size / hm.shape[-1]
            for b in range(hm.shape[0]):
                s = CEPHA29[int(j[b])]
                k = landmarks.index(s)
                g = decode_dark(hm[b, k][None])[0]
                tg = decode_dark(t[b, k].numpy()[None])[0]           # label, via its own Gaussian
                mt = mat[b].numpy()
                p = to_source(mt, (g * stride)[None])[0]
                q = to_source(mt, (tg * stride)[None])[0]
                c = to_source(mt, np.array([[size / 2, size / 2]]))[0]
                e = float(np.linalg.norm(p - q)) * float(mm[b])
                by[s].append(e)
                allv.append(e)
                start.append(float(np.linalg.norm(c - q)) * float(mm[b]))
    return {"by": by, "all": np.array(allv), "start": np.array(start)}


def export(args):
    import torch
    ck = torch.load(args.weights, map_location="cpu", weights_only=False)
    model = build_model(len(ck["landmarks"]))
    model.load_state_dict(ck["model"])
    model.eval()
    x = torch.zeros(1, 3, ck["size"], ck["size"])
    torch.onnx.export(model, x, args.out, input_names=["input"], output_names=["heatmaps"],
                      dynamic_axes={"input": {0: "batch"}, "heatmaps": {0: "batch"}}, opset_version=17,
                      dynamo=False)
    meta = {"landmarks": ck["landmarks"], "size": ck["size"], "crop_mm": ck["crop_mm"],
            "heatmap": ck["size"] // 2, "sn_mm": SN_MM, "set": "cepha29", "epoch": ck["epoch"],
            "valid": ck.get("stats")}
    json.dump(meta, open(os.path.splitext(args.out)[0] + ".json", "w"), indent=1)
    import onnxruntime as ort
    sess = ort.InferenceSession(args.out, providers=["CPUExecutionProvider"])
    xb = np.random.default_rng(0).normal(size=(3, 3, ck["size"], ck["size"])).astype(np.float32)
    ref = model(torch.from_numpy(xb)).detach().numpy()
    got = sess.run(None, {"input": xb})[0]
    print(f"exported {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB), "
          f"max |onnx - torch| = {np.abs(ref - got).max():.2e}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train")
    t.add_argument("--data", required=True, help="dataset root with train/ and valid/ (Merged29 annotations)")
    t.add_argument("--out", required=True)
    t.add_argument("--landmarks", nargs="+", default=WEAK)
    t.add_argument("--size", type=int, default=256)
    t.add_argument("--crop-mm", type=float, default=25.6)
    t.add_argument("--sigma", type=float, default=2.0, help="target Gaussian sigma (heatmap px)")
    t.add_argument("--fg-weight", type=float, default=20.0, help="extra loss weight on the Gaussian")
    t.add_argument("--epochs", type=int, default=40)
    t.add_argument("--batch", type=int, default=32)
    t.add_argument("--lr", type=float, default=1e-3)
    t.add_argument("--patience", type=int, default=10)
    t.add_argument("--workers", type=int, default=2)
    t.add_argument("--pretrained", action="store_true", help="ImageNet ResNet-18 encoder (downloads)")
    t.add_argument("--device", default="auto")
    t.add_argument("--seed", type=int, default=29)
    e = sub.add_parser("export")
    e.add_argument("--weights", required=True)
    e.add_argument("--out", required=True)
    args = ap.parse_args()
    for s in getattr(args, "landmarks", []):
        assert s in CEPHA29, s
    train(args) if args.cmd == "train" else export(args)


if __name__ == "__main__":
    main()
