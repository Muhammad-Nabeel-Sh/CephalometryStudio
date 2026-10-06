#!/usr/bin/env python3
"""
Phase 2 — external domain benchmark.

Runs the production **Aariz 29-landmark** model on the **ISBI 2015** cohort and
scores the 19 shared landmarks against ISBI ground truth. Because the model is
trained on Aariz only, every ISBI image is out-of-domain — this measures the
domain shift directly.

Reuses the app's offline harness (preprocess / DARK decode / PSR / SSM) via
importlib so preprocessing and decoding can never drift from production.

Usage (ISBI images + annotations provided):
  python scripts/ai/external_benchmark.py \
      --model public/models/landmarks-cepha29.int8.onnx \
      --isbi-images /path/to/isbi/images \
      --isbi-ann   /path/to/isbi/annotations.csv \
      --out scripts/ai/experiments/E0_isbi

Or let it fetch ISBI from the public mirror:
  python scripts/ai/external_benchmark.py --model <onnx> --fetch-isbi --limit 400 \
      --out scripts/ai/experiments/E0_isbi

Outputs:
  isbi_metrics.json, isbi_per_landmark.csv, isbi_per_image.csv,
  domain_comparison.csv (if --aariz-metrics given), failure_taxonomy.md,
  overlays/*.png
"""

import argparse
import csv
import importlib.util
import json
import os
import sys
import urllib.request
from collections import defaultdict

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from canonical import (  # noqa: E402
    CEPHA29, ISBI19, ISBI_TO_CEPHA, isbi_to_cepha_channel,
    ISBI_PIXEL_MM, ISBI_ANN_CSV, ISBI_IMG_BASE,
)

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")


def load_harness():
    path = os.path.join(ROOT, "scripts", "eval-landmark-model.py")
    spec = importlib.util.spec_from_file_location("evalmod", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def list_images(d, limit):
    files = []
    for ext in IMG_EXTS:
        files += [p for p in sorted(os.listdir(d)) if p.lower().endswith(ext)]
    return sorted(set(files))[:limit]


def load_isbi_annotations(path):
    """CSV: image_path,1_x,1_y,...,19_x,19_y -> {stem: (19,2)} in ISBI19 order."""
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if not row or row[0] == "image_path":
                continue
            vals = [float(v) for v in row[1:]]
            pts = np.array(vals, np.float32).reshape(-1, 2)
            if pts.shape[0] != len(ISBI19):
                continue
            out[os.path.splitext(os.path.basename(row[0]))[0]] = pts
    return out


def _download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "python-urllib"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())


def fetch_isbi(cache, limit):
    os.makedirs(cache, exist_ok=True)
    ann_path = os.path.join(cache, "annotations.csv")
    if not os.path.exists(ann_path):
        _download(ISBI_ANN_CSV, ann_path)
    ann = load_isbi_annotations(ann_path)
    stems = list(ann.keys())[:limit]
    for s in stems:
        for ext in (".jpg", ".png"):
            dest = os.path.join(cache, s + ext)
            if os.path.exists(dest):
                break
            try:
                _download(ISBI_IMG_BASE.format(s + ext), dest)
                break
            except Exception:
                continue
    return ann_path, cache, stems


def predict(mod, sess, img, dark, sigma):
    ow, oh = img.size
    x = mod.preprocess(img, size=mod.INPUT, use_clahe=False)
    iname = sess.get_inputs()[0].name
    oname = sess.get_outputs()[0].name
    hm = sess.run([oname], {iname: x})[0][0]  # (C, h, w)
    if hm.shape[1] != 192:
        from scipy.ndimage import zoom
        hm = np.stack([zoom(hm[c], (192 / hm.shape[1], 192 / hm.shape[2]), order=1)
                       for c in range(hm.shape[0])])
    pts, conf = mod.decode(hm, dark=dark, sigma=sigma)
    pts[:, 0] *= ow / 192.0
    pts[:, 1] *= oh / 192.0
    psr = mod.psr_confs(hm, dark=dark, sigma=sigma)
    return pts, conf, psr, (ow, oh)


def overlay(img, gt, pred, path):
    im = img.convert("RGB").copy()
    d = ImageDraw.Draw(im)
    for (x, y), (px, py) in zip(gt, pred):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(0, 220, 0), width=2)      # GT
        d.ellipse([px - 4, py - 4, px + 4, py + 4], outline=(255, 40, 40), width=2)  # pred
    im.save(path)


def main():
    ap = argparse.ArgumentParser(description="External benchmark: Aariz model on ISBI")
    ap.add_argument("--model", required=True, help="29-channel ONNX path")
    ap.add_argument("--isbi-images", default=None, help="ISBI image directory")
    ap.add_argument("--isbi-ann", default=None, help="ISBI annotations CSV")
    ap.add_argument("--fetch-isbi", action="store_true", help="fetch ISBI from the public mirror")
    ap.add_argument("--cache", default=os.path.join(HERE, ".cache", "isbi"))
    ap.add_argument("--ssm", default=None, help="Aariz 29-landmark prior (enables SSM refinement)")
    ap.add_argument("--dark", action="store_true", default=True)
    ap.add_argument("--sigma", type=float, default=2.0)
    ap.add_argument("--pixel-mm", type=float, default=ISBI_PIXEL_MM)
    ap.add_argument("--limit", type=int, default=400)
    ap.add_argument("--overlay", type=int, default=12, help="save N worst-case overlays")
    ap.add_argument("--aariz-metrics", default=None, help="Aariz metrics.json for domain comparison")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import onnxruntime as ort
    mod = load_harness()
    os.makedirs(args.out, exist_ok=True)

    if args.fetch_isbi or not (args.isbi_images and args.isbi_ann):
        ann_path, img_dir, stems = fetch_isbi(args.cache, args.limit)
        args.isbi_ann, args.isbi_images = ann_path, img_dir
    else:
        stems = None

    ann = load_isbi_annotations(args.isbi_ann)
    ssm = mod.load_ssm(args.ssm) if args.ssm else None
    chan = isbi_to_cepha_channel()
    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])

    files = list_images(args.isbi_images, args.limit) if args.isbi_images else (stems or [])
    if not files:
        raise SystemExit("No ISBI images found.")

    per_lm = defaultdict(list)          # symbol -> [err_mm]
    per_img = []                        # dicts
    ood = []
    worst = []

    for name in files:
        stem = os.path.splitext(name)[0]
        if stem not in ann:
            continue
        img_path = os.path.join(args.isbi_images, name)
        try:
            img = Image.open(img_path).convert("RGB")
        except Exception:
            continue
        pts, conf, psr, _ = predict(mod, sess, img, args.dark, args.sigma)
        raw = pts.copy()
        if ssm is not None:
            pts = mod.refine_ssm(pts, conf, ssm, alpha=0.6, reg=0.1, k=6, wmin=0.2, iters=1)

        pred19 = pts[chan]              # (19,2)
        gt19 = ann[stem]
        err = np.linalg.norm(pred19 - gt19, axis=1) * args.pixel_mm
        for i, sym in enumerate(ISBI19):
            per_lm[sym].append(float(err[i]))

        res = mod.shape_residual(raw, ssm) if ssm is not None else None
        row = {
            "image": name, "mean_mm": float(err.mean()), "max_mm": float(err.max()),
            "meanConf": float(np.mean(psr)), "residualRatio": (res or {}).get("residualRatio"),
        }
        per_img.append(row)
        ood.append(row)
        worst.append((float(err.mean()), name, img, gt19, pred19))

    # ── metrics ──
    all_err = np.array([e for v in per_lm.values() for e in v])
    per_lm_mre = {s: float(np.mean(v)) for s, v in per_lm.items()}
    per_lm_med = {s: float(np.median(v)) for s, v in per_lm.items()}
    metrics = {
        "model": os.path.basename(args.model),
        "dataset": "ISBI 2015",
        "images": len(per_img),
        "shared_landmarks": len(ISBI19),
        "overall": {
            "mre_mm": float(all_err.mean()),
            "median_mm": float(np.median(all_err)),
            "rmse_mm": float(np.sqrt((all_err ** 2).mean())),
            "max_mm": float(all_err.max()),
            "sdr_2.0mm": float(np.mean(all_err <= 2) * 100),
            "sdr_2.5mm": float(np.mean(all_err <= 2.5) * 100),
            "sdr_3.0mm": float(np.mean(all_err <= 3) * 100),
            "sdr_4.0mm": float(np.mean(all_err <= 4) * 100),
        },
        "per_landmark": {s: {"mre_mm": per_lm_mre[s], "median_mm": per_lm_med[s]} for s in ISBI19},
    }
    json.dump(metrics, open(os.path.join(args.out, "isbi_metrics.json"), "w", encoding="utf-8"), indent=2)

    with open(os.path.join(args.out, "isbi_per_landmark.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["isbi_symbol", "cepha_symbol", "mre_mm", "median_mm", "n"])
        for s in ISBI19:
            w.writerow([s, ISBI_TO_CEPHA[s], f"{per_lm_mre[s]:.4f}", f"{per_lm_med[s]:.4f}", len(per_lm[s])])

    with open(os.path.join(args.out, "isbi_per_image.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["image", "mean_mm", "max_mm", "meanConf", "residualRatio"])
        for r in per_img:
            w.writerow([r["image"], f'{r["mean_mm"]:.3f}', f'{r["max_mm"]:.3f}',
                        f'{r["meanConf"]:.4f}', "" if r["residualRatio"] is None else f'{r["residualRatio"]:.5f}'])

    # ── domain comparison (Aariz vs ISBI) ──
    if args.aariz_metrics and os.path.exists(args.aariz_metrics):
        aar = json.load(open(args.aariz_metrics, encoding="utf-8"))
        with open(os.path.join(args.out, "domain_comparison.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["scope", "metric", "aariz", "isbi", "delta"])
            for k in ("mre_mm", "median_mm", "rmse_mm", "sdr_2.0mm", "sdr_3.0mm"):
                a = aar["overall"].get(k)
                b = metrics["overall"].get(k)
                w.writerow(["overall", k, a, b, (None if a is None else round(b - a, 4))])
            # per-landmark on the shared set (map CEPHA symbol -> ISBI symbol)
            cepha_by = {v: k for k, v in ISBI_TO_CEPHA.items()}
            for ceph, isbi_sym in cepha_by.items():
                a = aar.get("per_landmark", {}).get(ceph, {}).get("mre_mm")
                b = per_lm_mre.get(isbi_sym)
                if a is not None and b is not None:
                    w.writerow(["landmark", f"{isbi_sym} ({ceph})", a, round(b, 4), round(b - a, 4)])

    # ── failure taxonomy ──
    worst.sort(key=lambda t: -t[0])
    lines = ["# ISBI external benchmark — failure taxonomy", "",
             f"Model: `{os.path.basename(args.model)}`  |  Images: {len(per_img)}  "
             f"|  Overall MRE: {metrics['overall']['mre_mm']:.2f} mm  "
             f"|  SDR@2mm: {metrics['overall']['sdr_2.0mm']:.1f}%", "",
             "## Hardest landmarks (highest MRE)", ""]
    for s, v in sorted(per_lm_mre.items(), key=lambda kv: -kv[1]):
        lines.append(f"- {s} ({ISBI_TO_CEPHA[s]}): {v:.2f} mm (median {per_lm_med[s]:.2f})")
    lines += ["", "## Worst images", ""]
    odir = os.path.join(args.out, "overlays")
    os.makedirs(odir, exist_ok=True)
    for i, (m, name, img, gt, pred) in enumerate(worst[:20]):
        lines.append(f"- {name}: mean {m:.2f} mm")
        if i < args.overlay:
            overlay(img, gt, pred, os.path.join(odir, f"fail_{i+1:02d}_{os.path.splitext(name)[0]}.png"))
    open(os.path.join(args.out, "failure_taxonomy.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

    print(json.dumps(metrics, indent=2))
    print("\nwrote:", args.out)


if __name__ == "__main__":
    main()
