#!/usr/bin/env python3
"""
Phase 1 — dataset profiler.

Given a directory of cephalograms, emit a factual profile: image count, formats,
dimensions, aspect ratios, grayscale/color, intensity stats, a polarity heuristic
(positive vs inverted film), and — if annotations are supplied — their format and
landmark coverage.

Usage:
  python scripts/ai/profile_dataset.py \
      --images /path/to/Cephalograms --name isbi2015 \
      --ann-dir /path/to/Annotations --limit 200 \
      --out scripts/ai/datasets

Outputs:
  <out>/<name>_profile.json      full profile
  <out>/dataset_statistics.csv   one row per dataset (updated/appended)
  <out>/registry.json            dataset registry (updated)
"""

import argparse
import csv
import glob
import json
import os
import sys
from collections import Counter

import numpy as np
from PIL import Image

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")


def _list_images(d, limit):
    files = []
    for ext in IMG_EXTS:
        files += glob.glob(os.path.join(d, "*" + ext))
        files += glob.glob(os.path.join(d, "*" + ext.upper()))
    return sorted(set(files))[:limit]


def _corner_median(gray):
    """Median intensity of the four 5% corner patches (background proxy)."""
    h, w = gray.shape
    cy, cx = max(1, h // 20), max(1, w // 20)
    patches = [gray[:cy, :cx], gray[:cy, -cx:], gray[-cy:, :cx], gray[-cy:, -cx:]]
    return float(np.median(np.concatenate([p.ravel() for p in patches])))


def profile_images(images_dir, limit=200):
    files = _list_images(images_dir, limit)
    if not files:
        raise SystemExit(f"No images found in {images_dir}")

    widths, heights, aspects, means, stds, corner_medians = [], [], [], [], [], []
    formats = Counter()
    color = 0
    n_sampled = 0

    for p in files:
        formats[os.path.splitext(p)[1].lower()] += 1
        try:
            im = Image.open(p)
        except Exception:
            continue
        w, h = im.size
        widths.append(w)
        heights.append(h)
        aspects.append(w / h if h else 0.0)
        if im.mode == "RGB":
            color += 1
        g = np.asarray(im.convert("L"), np.float32) / 255.0
        means.append(float(g.mean()))
        stds.append(float(g.std()))
        corner_medians.append(_corner_median(g))
        n_sampled += 1

    def pct(a, q):
        return float(np.percentile(a, q)) if a else None

    # Polarity heuristic: in a positive lateral ceph the background (air) is dark,
    # so the corner median is low. A light background suggests an inverted film.
    inv_frac = float(np.mean([1.0 if c > 0.5 else 0.0 for c in corner_medians])) if corner_medians else 0.0

    return {
        "image_count": len(files),
        "sampled": n_sampled,
        "formats": dict(formats),
        "color_images": color,
        "grayscale_images": n_sampled - color,
        "width": {"min": min(widths), "median": pct(widths, 50), "max": max(widths)},
        "height": {"min": min(heights), "median": pct(heights, 50), "max": max(heights)},
        "aspect_ratio": {
            "min": round(min(aspects), 3), "median": round(pct(aspects, 50), 3),
            "p95": round(pct(aspects, 95), 3), "max": round(max(aspects), 3),
        },
        "intensity_mean": round(float(np.mean(means)), 4) if means else None,
        "intensity_std": round(float(np.mean(stds)), 4) if stds else None,
        "corner_median": round(float(np.mean(corner_medians)), 4) if corner_medians else None,
        "likely_inverted_fraction": round(inv_frac, 3),
    }


def profile_annotations(ann_dir):
    if not ann_dir or not os.path.isdir(ann_dir):
        return {"present": False}
    jsons = sorted(glob.glob(os.path.join(ann_dir, "*.json")))
    csvs = sorted(glob.glob(os.path.join(ann_dir, "*.csv")))
    out = {
        "present": True,
        "json_files": len(jsons),
        "csv_files": len(csvs),
        "dir": os.path.abspath(ann_dir),
    }
    if jsons:
        symbols = set()
        for p in jsons[:50]:
            try:
                data = json.load(open(p, encoding="utf-8"))
            except Exception:
                continue
            for lm in data.get("landmarks", []):
                if lm.get("symbol"):
                    symbols.add(lm["symbol"])
        out["format"] = "json (landmarks:[{symbol,value:{x,y}}])"
        out["landmark_count"] = len(symbols)
        out["symbols"] = sorted(symbols)
    elif csvs:
        out["format"] = "csv"
        out["sample_csv"] = os.path.basename(csvs[0])
    return out


def update_csv(path, row):
    fields = list(row.keys())
    rows = []
    if os.path.exists(path):
        with open(path, newline="", encoding="utf-8") as f:
            rows = [r for r in csv.DictReader(f)]
    rows = [r for r in rows if r.get("id") != row["id"]] + [row]
    # union of fields, preserving existing order then new
    for r in rows:
        for k in r:
            if k not in fields:
                fields.append(k)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def update_registry(path, entry):
    reg = {"datasets": []}
    if os.path.exists(path):
        try:
            reg = json.load(open(path, encoding="utf-8"))
        except Exception:
            pass
    reg["datasets"] = [d for d in reg.get("datasets", []) if d.get("id") != entry["id"]] + [entry]
    json.dump(reg, open(path, "w", encoding="utf-8"), indent=2)


def main():
    ap = argparse.ArgumentParser(description="Profile a cephalogram dataset")
    ap.add_argument("--images", required=True, help="image directory")
    ap.add_argument("--name", required=True, help="dataset id (e.g. aariz, isbi2015)")
    ap.add_argument("--ann-dir", default=None, help="annotation directory (optional)")
    ap.add_argument("--limit", type=int, default=200, help="max images to sample")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "datasets"))
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    profile = {
        "id": args.name,
        "images_dir": os.path.abspath(args.images),
        "images": profile_images(args.images, args.limit),
        "annotations": profile_annotations(args.ann_dir),
    }
    json.dump(profile, open(os.path.join(args.out, f"{args.name}_profile.json"), "w", encoding="utf-8"), indent=2)

    im = profile["images"]
    update_csv(os.path.join(args.out, "dataset_statistics.csv"), {
        "id": args.name,
        "images": im["image_count"],
        "sampled": im["sampled"],
        "width_median": im["width"]["median"],
        "height_median": im["height"]["median"],
        "aspect_median": im["aspect_ratio"]["median"],
        "color_images": im["color_images"],
        "intensity_mean": im["intensity_mean"],
        "corner_median": im["corner_median"],
        "likely_inverted_fraction": im["likely_inverted_fraction"],
        "annotated": profile["annotations"].get("present", False),
        "landmark_count": profile["annotations"].get("landmark_count", ""),
    })
    update_registry(os.path.join(args.out, "registry.json"), {
        "id": args.name,
        "images_dir": os.path.abspath(args.images),
        "image_count": im["image_count"],
        "landmark_count": profile["annotations"].get("landmark_count"),
        "annotation_format": profile["annotations"].get("format", "none"),
        "annotated": profile["annotations"].get("present", False),
    })

    print(json.dumps(profile, indent=2))
    print("\nwrote:", os.path.join(args.out, "dataset_statistics.csv"), "+ registry.json")


if __name__ == "__main__":
    main()
