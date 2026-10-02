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

ISBI19 = ["S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
          "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar"]
CEPHA29 = ["A", "ANS", "Ar", "B", "Co", "Gn", "Go", "LIA", "LIT", "LMT", "LPM",
           "Li", "Ls", "Me", "N", "N`", "Or", "PNS", "Pn", "Po", "Pog", "Pog`",
           "R", "S", "Sn", "UIA", "UIT", "UMT", "UPM"]
SYMS = ISBI19
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


def load_annotations_cepha29(ann_dir):
    """Read CEPHA29 annotation JSONs -> {ceph_id: (NUM, 2)} in CEPHA29 order."""
    import glob
    import json

    out = {}
    for path in sorted(glob.glob(os.path.join(ann_dir, "*.json"))):
        try:
            data = json.load(open(path, "r", encoding="utf-8"))
        except Exception:
            continue
        by = {}
        for lm in data.get("landmarks", []):
            v = lm.get("value") or {}
            if lm.get("symbol") and "x" in v and "y" in v:
                by[lm["symbol"]] = (float(v["x"]), float(v["y"]))
        if not all(s in by for s in CEPHA29):
            continue
        cid = data.get("ceph_id") or os.path.splitext(os.path.basename(path))[0]
        out[cid] = np.array([by[s] for s in CEPHA29], np.float32)
    return out


def load_spacing_csv(path):
    """Optional CSV: ceph_id, mm_per_pixel (uses the first and last columns)."""
    mapping = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for i, row in enumerate(csv.reader(f)):
            if not row:
                continue
            try:
                mapping[row[0]] = float(row[-1])
            except ValueError:
                continue  # header
    return mapping


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


# ─── Out-of-distribution reporting (mirrors src/lib/landmarkQuality.js) ───────
#
# The browser gates a trace on (a) per-landmark PSR confidence and (b) the
# orthogonal residual to the shape prior. These helpers reproduce both, so the
# thresholds can be calibrated on real predictions instead of synthetic
# fixtures (see docs/ai-module-improvement-plan.md §14).

def psr_noise_floor(n, floor_factor=0.85):
    """Expected maximum of n iid Gaussian samples, scaled. Mirrors psrNoiseFloor."""
    if n <= 7:
        return 0.0
    t = float(np.sqrt(2.0 * np.log(n)))
    return floor_factor * (t - (np.log(np.log(n)) + np.log(4.0 * np.pi)) / (2.0 * t))


def psr_confidence(plane, peak_idx, scale=6.0, floor_factor=0.85):
    """Peak-to-sidelobe ratio at `peak_idx`, squashed to [0,1). Mirrors psrFromPlane."""
    n = plane.size
    peak = float(plane[peak_idx])
    if n == 0 or not np.isfinite(peak):
        return 0.0, 0.0
    if float(plane.max() - plane.min()) <= 1e-9:
        return 0.0, 0.0
    mu = float(plane.mean())
    sd = float(plane.std()) or 1e-6
    psr = (peak - mu) / sd
    excess = max(0.0, psr - psr_noise_floor(n, floor_factor))
    return excess / (excess + scale), psr


def psr_confs(hm, dark=True, sigma=2.0, scale=6.0):
    """Per-channel PSR confidence on the plane the browser measures: the
    linearly blurred response at the argmax of the log response (DARK)."""
    from scipy.ndimage import gaussian_filter
    out = np.zeros(hm.shape[0], np.float32)
    for c in range(hm.shape[0]):
        if dark:
            sm = gaussian_filter(hm[c].astype(np.float64), sigma)
            idx = int(np.argmax(np.log(np.clip(sm, 1e-6, None))))
        else:
            sm = hm[c].astype(np.float64)
            idx = int(np.argmax(sm))
        out[c] = psr_confidence(sm.reshape(-1), idx, scale=scale)[0]
    return out


def shape_residual(pts, ssm, k=None, reg=0.1, clip=3.0):
    """Orthogonal residual + Mahalanobis to the PCA prior. Mirrors the JS
    fitShape(): similarity transform WITHOUT reflection, full-prior fit by
    default (k=None -> all components)."""
    model_pts = ssm["mean"].reshape(-1, 2)
    N = model_pts.shape[0]
    if pts.shape[0] != N:
        return None
    V, sig = ssm["components"], ssm["sigmas"]
    K = V.shape[0] if k is None else min(k, V.shape[0])

    # complex-multiplier similarity transform (a, b, tx, ty), no reflection
    mx, my = pts.mean(0)
    Mx, My = model_pts.mean(0)
    x, y = pts[:, 0] - mx, pts[:, 1] - my
    wx, wy = model_pts[:, 0] - Mx, model_pts[:, 1] - My
    den = float((x * x + y * y).sum())
    if den < 1e-12:
        a, b, tx, ty = 1.0, 0.0, Mx - mx, My - my
    else:
        a = float((x * wx + y * wy).sum()) / den
        b = float((x * wy - y * wx).sum()) / den
        tx = Mx - (a * mx - b * my)
        ty = My - (b * mx + a * my)
    xa = np.stack([a * pts[:, 0] - b * pts[:, 1] + tx,
                   b * pts[:, 0] + a * pts[:, 1] + ty], axis=1)

    Vk, sigk = V[:K], sig[:K]
    A = Vk @ Vk.T + reg * np.eye(K)
    bb = np.linalg.solve(A, Vk @ (xa.reshape(-1) - ssm["mean"]))
    bb = np.clip(bb, -clip * sigk, clip * sigk)
    maha = float(np.sqrt(np.sum((bb / np.maximum(sigk, 1e-12)) ** 2)))
    rec = (ssm["mean"] + Vk.T @ bb).reshape(-1, 2)
    residual = float(np.sqrt(np.sum((xa - rec) ** 2) / N))
    centroid = model_pts.mean(0)
    size = float(np.linalg.norm(model_pts - centroid, axis=1).mean())
    return {
        "residual": residual,
        "residualRatio": residual / size if size > 0 else 0.0,
        "mahalanobis": maha,
        "size": size,
        "k": K,
    }


def _finite(vals):
    return [float(v) for v in vals if v is not None and np.isfinite(v)]


def _pct(vals, p):
    v = _finite(vals)
    return float(np.percentile(v, p)) if v else float("nan")


def print_ood_report(ood, target=0.05):
    """Percentiles + recommended thresholds for a target false-low rate."""
    confs = _finite([c for o in ood for c in o["psr"]])
    mean_conf = [o["meanConf"] for o in ood]
    low_frac = [o["lowFrac"] for o in ood]
    rr = [o["residualRatio"] for o in ood]
    mh = [o["mahalanobis"] for o in ood]
    hi = (1.0 - target) * 100.0  # e.g. 95th percentile

    print("\n=== OOD / confidence report ({} images) ===".format(len(ood)))
    print("per-landmark confidence   p05={:.3f}  p50={:.3f}  p95={:.3f}".format(
        _pct(confs, 5), _pct(confs, 50), _pct(confs, 95)))
    print("image mean confidence     p05={:.3f}  p50={:.3f}  p95={:.3f}".format(
        _pct(mean_conf, 5), _pct(mean_conf, 50), _pct(mean_conf, 95)))
    print("image low-landmark frac   p50={:.3f}  p75={:.3f}  p95={:.3f}".format(
        _pct(low_frac, 50), _pct(low_frac, 75), _pct(low_frac, 95)))
    print("residualRatio             p50={:.4f}  p75={:.4f}  p95={:.4f}  p99={:.4f}".format(
        _pct(rr, 50), _pct(rr, 75), _pct(rr, hi), _pct(rr, 99)))
    print("mahalanobis               p50={:.3f}  p75={:.3f}  p95={:.3f}  p99={:.3f}".format(
        _pct(mh, 50), _pct(mh, 75), _pct(mh, hi), _pct(mh, 99)))

    print("\nSuggested DEFAULT_QUALITY_THRESHOLDS for target false-low <= {:.0%}:".format(target))
    print("  lowLandmarkConfidence: {:.3f},".format(_pct(confs, 5)))
    print("  minMeanConfidence:     {:.3f},".format(_pct(mean_conf, 5)))
    print("  mediumMeanConfidence:  {:.3f},".format(_pct(mean_conf, 50)))
    print("  mediumLowFraction:     {:.3f},".format(_pct(low_frac, 75)))
    print("  maxLowFraction:        {:.3f},".format(_pct(low_frac, hi)))
    print("  residualRatioMedium:   {:.4f},".format(_pct(rr, 75)))
    print("  residualRatioHigh:     {:.4f},".format(_pct(rr, hi)))
    print("  mahalanobisMedium:     {:.3f},".format(_pct(mh, 75)))
    print("  mahalanobisHigh:       {:.3f},".format(_pct(mh, hi)))


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
    psr = psr_confs(acc, dark=args.dark, sigma=args.sigma) if args.report_ood else None
    return pts, conf, psr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="public/models/landmarks-hrnet19.onnx")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--set", default="isbi19", choices=["isbi19", "cepha29"], dest="set_name")
    ap.add_argument("--ann-dir", default=None, help="cepha29: annotation JSON directory")
    ap.add_argument("--images", default=None, help="cepha29: image directory")
    ap.add_argument("--pixel-mm", type=float, default=PIXEL_MM, help="mm per pixel (ISBI default 0.1)")
    ap.add_argument("--spacing-csv", default=None, help="cepha29: ceph_id,mm_per_px CSV")
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
    ap.add_argument("--report-ood", action="store_true",
                    help="report PSR confidence + shape-residual distributions and suggest quality thresholds")
    ap.add_argument("--ood-target", type=float, default=0.05,
                    help="target false-low rate for the suggested thresholds (default 0.05)")
    ap.add_argument("--ood-out", default=None, help="write per-image OOD stats to this CSV")
    args = ap.parse_args()
    args.scales = [float(s) for s in args.tta_scales.split(",")]

    global SYMS, NUM
    if args.set_name == "cepha29":
        SYMS, NUM = CEPHA29, len(CEPHA29)

    ssm = load_ssm(args.ssm) if args.ssm else None
    if args.report_ood and ssm is None:
        default_ssm = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "src", "data", f"shapeModel.{args.set_name}.json"))
        if os.path.exists(default_ssm):
            ssm = load_ssm(default_ssm)
            print("report-ood: using prior", default_ssm)
    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])

    spacing = load_spacing_csv(args.spacing_csv) if args.spacing_csv else {}
    cases = []  # (image_source, gt, mm_per_px)
    if args.set_name == "cepha29":
        if not (args.ann_dir and args.images):
            raise SystemExit("--set cepha29 requires --ann-dir and --images")
        import glob
        ann = load_annotations_cepha29(args.ann_dir)
        imgs = []
        for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff"):
            imgs += glob.glob(os.path.join(args.images, ext))
        for path in sorted(imgs):
            stem = os.path.splitext(os.path.basename(path))[0]
            if stem in ann:
                cases.append((path, ann[stem], spacing.get(stem, args.pixel_mm)))
        cases = cases[: args.limit]
    else:
        ann = load_annotations()
        names = [n for n in ann if n.endswith(".jpg")][: args.limit]
        cases = [(n, ann[n], PIXEL_MM) for n in names]

    per = []
    used = 0
    ood = []
    for src, gt, mm in cases:
        try:
            img = Image.open(src).convert("RGB") if os.path.exists(src) else load_image(src)
        except Exception as e:
            print("skip", src, e)
            continue
        pred, conf, psr = predict(sess, img, args)
        if args.report_ood and psr is not None:
            # OOD stats are measured on the RAW prediction, before refinement.
            res = shape_residual(pred, ssm) if ssm is not None else None
            ood.append({
                "image": os.path.basename(str(src)),
                "meanConf": float(np.mean(psr)),
                "minConf": float(np.min(psr)),
                "lowFrac": float(np.mean(psr < 0.2)),
                "residualRatio": (res or {}).get("residualRatio"),
                "mahalanobis": (res or {}).get("mahalanobis"),
                "psr": psr,
            })
        if ssm is not None:
            pred = refine_ssm(pred, conf, ssm, alpha=args.ssm_alpha, reg=args.ssm_reg, k=args.ssm_k, wmin=args.ssm_wmin, iters=args.ssm_iters)
        per.append(np.linalg.norm(pred - gt, axis=1) * mm)
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

    if args.report_ood and ood:
        print_ood_report(ood, target=args.ood_target)
        if args.ood_out:
            import csv as _csv
            with open(args.ood_out, "w", newline="", encoding="utf-8") as f:
                w = _csv.writer(f)
                w.writerow(["image", "meanConf", "minConf", "lowFrac", "residualRatio", "mahalanobis"])
                for o in ood:
                    w.writerow([o["image"], f'{o["meanConf"]:.4f}', f'{o["minConf"]:.4f}',
                                f'{o["lowFrac"]:.4f}',
                                "" if o["residualRatio"] is None else f'{o["residualRatio"]:.5f}',
                                "" if o["mahalanobis"] is None else f'{o["mahalanobis"]:.4f}'])
            print("wrote", args.ood_out)


if __name__ == "__main__":
    main()
