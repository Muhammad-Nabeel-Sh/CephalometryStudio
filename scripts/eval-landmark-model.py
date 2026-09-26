#!/usr/bin/env python3
"""
Offline evaluation harness for cephalometric landmark ONNX models.

Measures MRE / SDR / per-landmark error on the ISBI 2015 test set (cepha400)
and can toggle inference-side improvements (DARK sub-pixel decoding, test-time
augmentation, CLAHE preprocessing) so their impact can be quantified before
porting them to the app.

Usage
-----
    python scripts/eval-landmark-model.py --model public/models/landmarks-hrnet19.onnx
    python scripts/eval-landmark-model.py --dark
    python scripts/eval-landmark-model.py --dark --tta-flip --tta-scales 1.0,1.15
    python scripts/eval-landmark-model.py --clahe --limit 20

Images/annotations are downloaded once and cached under %TEMP%/opencode/isbi.
"""

import argparse
import csv
import io
import os
import ssl
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

import onnxruntime as ort

ANN_URL = "https://raw.githubusercontent.com/stolariks/medical-landmark-detection/main/data/isbi-2015/test/annotations.csv"
IMG_URL = "https://raw.githubusercontent.com/stolariks/medical-landmark-detection/main/data/isbi-2015/test/cepha400/{}"
CACHE = os.path.join(os.environ.get("TEMP", "/tmp"), "opencode", "isbi")

SYMS = ["S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
        "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar"]
NUM = len(SYMS)
INPUT = 768
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
PIXEL_MM = 0.1
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def _fetch(url, dest):
    if os.path.exists(dest):
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": "python-urllib"})
    data = urllib.request.urlopen(req, timeout=120, context=_CTX).read()
    open(dest, "wb").write(data)
    return dest


def load_annotations():
    os.makedirs(CACHE, exist_ok=True)
    path = _fetch(ANN_URL, os.path.join(CACHE, "annotations.csv"))
    txt = open(path, "r", encoding="utf-8", errors="replace").read()
    out = {}
    for row in csv.reader(io.StringIO(txt)):
        if not row or row[0] == "image_path":
            continue
        out[row[0]] = np.array([float(v) for v in row[1:]], np.float32).reshape(NUM, 2)
    return out


def load_image(name):
    os.makedirs(CACHE, exist_ok=True)
    path = _fetch(IMG_URL.format(name), os.path.join(CACHE, name))
    return Image.open(path).convert("RGB")


def clahe(gray_u8, clip=2.0, tiles=8):
    """Compact CLAHE (tile histogram equalisation + bilinear blending)."""
    h, w = gray_u8.shape
    th, tw = h // tiles, w // tiles
    maps = np.zeros((tiles, tiles, 256), np.float32)
    limit = clip * (th * tw) / 256.0
    for i in range(tiles):
        for j in range(tiles):
            tile = gray_u8[i * th:(i + 1) * th, j * tw:(j + 1) * tw]
            hist = np.bincount(tile.ravel(), minlength=256).astype(np.float32)
            excess = np.maximum(hist - limit, 0).sum()
            hist = np.minimum(hist, limit) + excess / 256.0
            cdf = np.cumsum(hist)
            maps[i, j] = cdf / cdf[-1] * 255.0
    # tile centres, bilinear blend
    ys = (np.arange(h) / th) - 0.5
    xs = (np.arange(w) / tw) - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, tiles - 1)
    x0 = np.clip(np.floor(xs).astype(int), 0, tiles - 1)
    y1 = np.clip(y0 + 1, 0, tiles - 1)
    x1 = np.clip(x0 + 1, 0, tiles - 1)
    wy = np.clip(ys - y0, 0, 1)[:, None]
    wx = np.clip(xs - x0, 0, 1)[None, :]
    gx = gray_u8.astype(np.int32)
    def m(iy, ix):
        return maps[iy[:, None], ix[None, :], gx]
    top = m(y0, x0) * (1 - wx) + m(y0, x1) * wx
    bot = m(y1, x0) * (1 - wx) + m(y1, x1) * wx
    return (top * (1 - wy) + bot * wy).astype(np.uint8)


def preprocess(img, size=INPUT, use_clahe=False):
    im = img.convert("L") if use_clahe else img
    if use_clahe:
        g = np.asarray(im, np.uint8)
        im = Image.fromarray(clahe(g)).convert("RGB")
    im = im.resize((size, size), Image.Resampling.BILINEAR)
    a = np.asarray(im, np.float32) / 255.0
    return ((a - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)


def decode(hm, dark=False, sigma=2.0):
    """hm: (C, H, W) heatmaps -> (C, 2) sub-pixel coords (x, y)."""
    if dark:
        m = np.stack([gaussian_filter(hm[c], sigma) for c in range(hm.shape[0])])
        m = np.log(np.clip(m, 1e-6, None))
    else:
        m = hm
    C, H, W = m.shape
    out = np.zeros((C, 2), np.float32)
    conf = np.zeros((C,), np.float32)
    for c in range(C):
        idx = int(np.argmax(m[c]))
        y, x = divmod(idx, W)
        px, py = float(x), float(y)
        if not dark:
            # quadratic sub-pixel refinement
            if 0 < x < W - 1:
                l, r = m[c, y, x - 1], m[c, y, x + 1]
                den = l - 2 * m[c, y, x] + r
                if den != 0:
                    px = x + 0.5 * (l - r) / den
            if 0 < y < H - 1:
                u, d = m[c, y - 1, x], m[c, y + 1, x]
                den = u - 2 * m[c, y, x] + d
                if den != 0:
                    py = y + 0.5 * (u - d) / den
        else:
            # Taylor-based refinement on the log-heatmap (DARK)
            if 0 < x < W - 1 and 0 < y < H - 1:
                dx = 0.5 * (m[c, y, x + 1] - m[c, y, x - 1])
                dy = 0.5 * (m[c, y + 1, x] - m[c, y - 1, x])
                dxx = m[c, y, x + 1] - 2 * m[c, y, x] + m[c, y, x - 1]
                dyy = m[c, y + 1, x] - 2 * m[c, y, x] + m[c, y - 1, x]
                dxy = 0.25 * (m[c, y + 1, x + 1] - m[c, y + 1, x - 1] - m[c, y - 1, x + 1] + m[c, y - 1, x - 1])
                Hm = np.array([[dxx, dxy], [dxy, dyy]], np.float32)
                if abs(np.linalg.det(Hm)) > 1e-9:
                    off = -np.linalg.inv(Hm) @ np.array([dx, dy], np.float32)
                    if np.all(np.abs(off) < 1.0):
                        px, py = x + off[0], y + off[1]
        out[c] = (px, py)
        conf[c] = float(np.max(hm[c]))
    return out, conf


# ─── Statistical shape model (SSM) refinement ────────────────────────────────

def load_ssm(path):
    import json
    m = json.load(open(path, "r", encoding="utf-8"))
    return {
        "landmarks": m["landmarks"],
        "mean": np.array(m["mean"], np.float64),
        "components": np.array(m["components"], np.float64),
        "sigmas": np.array(m["sigmas"], np.float64),
    }


def _sim_transform(Y, X):
    """s, R, t such that X ≈ s * (Y @ R.T) + t (row-vector points, no reflection)."""
    ym, xm = Y.mean(0), X.mean(0)
    yc, xc = Y - ym, X - xm
    H = yc.T @ xc
    U, S, Vt = np.linalg.svd(H)
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[-1] *= -1
        R = Vt.T @ U.T
    s = S.sum() / (yc ** 2).sum()
    t = xm - s * (ym @ R.T)
    return s, R, t


def refine_ssm(pts, conf, ssm, alpha=1.0, reg=0.05, k=10, wmin=0.2, clip=3.0, iters=3, tau=None):
    """Robust iterative projection onto the shape subspace.

    Each pass: align to the mean shape, weighted-project onto the PCA subspace,
    then down-weight points whose residual to the reconstruction is large
    (outliers) and repeat. Finally blend the reconstruction with the input.
    """
    N = pts.shape[0]
    model_pts = ssm["mean"].reshape(-1, 2)
    if N != model_pts.shape[0]:
        return pts
    V = ssm["components"][:k]
    sig = ssm["sigmas"][:k]
    base_w = np.clip(conf, wmin, 1.0)
    w = base_w.copy()
    cur = pts.astype(np.float64).copy()
    for _ in range(max(1, iters)):
        s, R, t = _sim_transform(cur, model_pts)
        xa = s * (cur @ R.T) + t
        VW = V * np.repeat(w, 2)[None, :]
        A = VW @ V.T + reg * np.eye(V.shape[0])
        b = np.linalg.solve(A, VW @ (xa.reshape(-1) - ssm["mean"]))
        b = np.clip(b, -clip * sig, clip * sig)
        xr = (ssm["mean"] + V.T @ b).reshape(-1, 2)
        res = np.linalg.norm(xa - xr, axis=1)
        thr = tau if tau is not None else max(2.0, float(np.median(res)) * 3.0)
        w = base_w * np.minimum(1.0, thr / np.maximum(res, 1e-6))
        cur = (((1 - alpha) * xa + alpha * xr) - t) @ R / s
    return cur.astype(np.float32)


def predict(sess, img, args):
    iname = sess.get_inputs()[0].name
    oname = sess.get_outputs()[0].name
    ow, oh = img.size
    acc = None
    for scale in args.scales:
        size = int(round(INPUT * scale))
        for flip in ([False, True] if args.tta_flip else [False]):
            im = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else img
            x = preprocess(im, size, args.clahe)
            hm = sess.run([oname], {iname: x})[0][0]  # (C, h, w)
            if flip:
                hm = hm[:, :, ::-1]
            if hm.shape[1] != 192:
                from scipy.ndimage import zoom
                hm = np.stack([zoom(hm[c], (192 / hm.shape[1], 192 / hm.shape[2]), order=1) for c in range(NUM)])
            acc = hm if acc is None else acc + hm
    acc /= (len(args.scales) * (2 if args.tta_flip else 1))
    pts, conf = decode(acc, dark=args.dark, sigma=args.sigma)
    pts[:, 0] *= ow / 192.0
    pts[:, 1] *= oh / 192.0
    return pts, conf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="public/models/landmarks-hrnet19.onnx")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--dark", action="store_true", help="DARK sub-pixel decoding")
    ap.add_argument("--sigma", type=float, default=2.0, help="Gaussian sigma for DARK")
    ap.add_argument("--tta-flip", action="store_true")
    ap.add_argument("--tta-scales", default="1.0", help="comma list, e.g. 1.0,1.15")
    ap.add_argument("--clahe", action="store_true")
    ap.add_argument("--ssm", default=None, help="path to shape-model JSON (enables SSM refinement)")
    ap.add_argument("--ssm-alpha", type=float, default=0.6)
    ap.add_argument("--ssm-reg", type=float, default=0.1)
    ap.add_argument("--ssm-k", type=int, default=6)
    ap.add_argument("--ssm-wmin", type=float, default=0.2)
    ap.add_argument("--ssm-iters", type=int, default=1)
    ap.add_argument("--labels", action="store_true", help="print per-landmark errors")
    args = ap.parse_args()
    args.scales = [float(s) for s in args.tta_scales.split(",")]
    ssm = load_ssm(args.ssm) if args.ssm else None

    ann = load_annotations()
    names = [n for n in ann if n.endswith(".jpg")][: args.limit]
    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])

    per = []
    used = 0
    for name in names:
        try:
            img = load_image(name)
        except Exception as e:
            print("skip", name, e)
            continue
        pred, conf = predict(sess, img, args)
        if ssm is not None:
            pred = refine_ssm(pred, conf, ssm, alpha=args.ssm_alpha, reg=args.ssm_reg, k=args.ssm_k, wmin=args.ssm_wmin, iters=args.ssm_iters)
        per.append(np.linalg.norm(pred - ann[name], axis=1) * PIXEL_MM)
        used += 1

    E = np.concatenate(per)
    tag = f"dark={args.dark} tta_flip={args.tta_flip} scales={args.scales} clahe={args.clahe}"
    if ssm is not None:
        tag += f" ssm(a={args.ssm_alpha},r={args.ssm_reg},k={args.ssm_k},w={args.ssm_wmin})"
    print(f"\n{os.path.basename(args.model)}  [{tag}]")
    print(f"images={used} landmarks={len(E)}")
    print(f"MRE={E.mean():.2f}mm  median={np.median(E):.2f}  max={E.max():.2f}")
    for t in (2, 2.5, 3, 4):
        print(f"  SDR@{t}mm = {np.mean(E <= t) * 100:.1f}%")
    if args.labels:
        m = np.array(per).mean(0)
        print("  per-landmark:", ", ".join(f"{SYMS[k]}={m[k]:.1f}" for k in np.argsort(-m)))


if __name__ == "__main__":
    main()
