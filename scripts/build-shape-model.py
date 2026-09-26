#!/usr/bin/env python3
"""
Build a statistical shape model (SSM) for cephalometric landmarks and export a
compact JSON prior used by the browser refinement pass (src/lib/shapeModel.js).

The prior is a PCA of Procrustes-aligned landmark configurations. Refinement
projects noisy detector predictions onto this shape subspace, which removes
implausible "outlier" configurations (e.g. a Gonion 8 mm off).

Sets
----
  isbi19  — public ISBI 2015 annotations (fetched from GitHub); 19 landmarks.
  cepha29 — CEPHA29/Aariz annotations (local directory of JSON files); 29 landmarks.

Usage
-----
    python scripts/build-shape-model.py                       # isbi19 (default)
    python scripts/build-shape-model.py --set cepha29 \
        --ann-dir "<Dataset>/train/Annotations/Cephalometric Landmarks/Senior Orthodontists"
    python scripts/build-shape-model.py --k 12 --out src/data/shapeModel.isbi19.json
"""

import argparse
import csv
import glob
import io
import json
import os
import ssl
import urllib.request

import numpy as np

ISBI_ANN_URL = "https://raw.githubusercontent.com/stolariks/medical-landmark-detection/main/data/isbi-2015/train/annotations.csv"

ISBI19 = ["S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
          "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar"]

CEPHA29 = ["A", "ANS", "B", "Me", "N", "Or", "Pog", "PNS", "Pn", "R", "S",
           "Ar", "Co", "Gn", "Go", "Po", "LPM", "LIT", "LMT", "UPM", "UIA",
           "UIT", "UMT", "LIA", "Li", "Ls", "N`", "Pog`", "Sn"]

SETS = {"isbi19": ISBI19, "cepha29": CEPHA29}

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "python-urllib"})
    return urllib.request.urlopen(req, timeout=120, context=_CTX).read().decode("utf-8", "replace")


def load_shapes_isbi19():
    txt = fetch(ISBI_ANN_URL)
    shapes = []
    for row in csv.reader(io.StringIO(txt)):
        if not row or row[0] == "image_path":
            continue
        shapes.append(np.array([float(v) for v in row[1:]], np.float64).reshape(len(ISBI19), 2))
    return np.stack(shapes)


def load_shapes_cepha29(ann_dir):
    files = sorted(glob.glob(os.path.join(ann_dir, "*.json")))
    if not files:
        raise SystemExit(f"No .json annotations found in {ann_dir}")
    shapes = []
    skipped = 0
    for path in files:
        try:
            data = json.load(open(path, "r", encoding="utf-8"))
        except Exception:
            skipped += 1
            continue
        by_symbol = {}
        for lm in data.get("landmarks", []):
            sym = lm.get("symbol")
            val = lm.get("value") or {}
            if sym is not None and "x" in val and "y" in val:
                by_symbol[sym] = (float(val["x"]), float(val["y"]))
        if not all(s in by_symbol for s in CEPHA29):
            skipped += 1
            continue
        shapes.append(np.array([by_symbol[s] for s in CEPHA29], np.float64))
    if skipped:
        print(f"skipped {skipped} file(s) missing symbols")
    return np.stack(shapes)


def similarity_align(Y, X):
    """Align point set Y onto X by scale+rotation+translation (no reflection)."""
    yc = Y - Y.mean(0)
    xc = X - X.mean(0)
    H = yc.T @ xc
    U, S, Vt = np.linalg.svd(H)
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[-1] *= -1
        R = Vt.T @ U.T
    scale = S.sum() / (yc ** 2).sum()
    return (scale * (yc @ R.T)) + X.mean(0)


def generalized_procrustes(shapes, iters=12):
    ref = shapes.mean(0)
    aligned = shapes.copy()
    for _ in range(iters):
        for i in range(len(aligned)):
            aligned[i] = similarity_align(aligned[i], ref)
        ref = aligned.mean(0)
    return aligned, ref


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="isbi19", choices=sorted(SETS), dest="set_name")
    ap.add_argument("--ann-dir", default=None, help="CEpha29 annotation JSON directory (required for --set cepha29)")
    ap.add_argument("--k", type=int, default=10, help="number of PCA components to keep")
    ap.add_argument("--out", default=None, help="output JSON (default src/data/shapeModel.<set>.json)")
    args = ap.parse_args()

    syms = SETS[args.set_name]
    if args.set_name == "cepha29":
        if not args.ann_dir:
            raise SystemExit("--set cepha29 requires --ann-dir <annotations folder>")
        shapes = load_shapes_cepha29(args.ann_dir)
    else:
        shapes = load_shapes_isbi19()
    print(f"loaded {len(shapes)} shapes x {shapes.shape[1]} landmarks ({args.set_name})")

    aligned, mean = generalized_procrustes(shapes)
    flat = aligned.reshape(len(aligned), -1)
    mean_flat = flat.mean(0)
    X = flat - mean_flat

    U, S, Vt = np.linalg.svd(X, full_matrices=False)
    eig = (S ** 2) / (len(aligned) - 1)
    var = eig / eig.sum()
    print("explained variance (first 10):", np.round(np.cumsum(var)[:10], 3))

    K = min(args.k, Vt.shape[0])
    sigmas = np.sqrt(eig[:K])
    comps = Vt[:K]

    model = {
        "set": args.set_name,
        "landmarks": syms,
        "mean": [round(float(v), 4) for v in mean_flat],
        "sigmas": [round(float(v), 4) for v in sigmas],
        "components": [[round(float(v), 5) for v in c] for c in comps],
        "explainedVariance": round(float(var[:K].sum()), 4),
        "n": int(len(aligned)),
    }
    out = os.path.abspath(args.out or os.path.join(
        os.path.dirname(__file__), "..", "src", "data", f"shapeModel.{args.set_name}.json"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, separators=(",", ":"))
    print(f"wrote {out} ({os.path.getsize(out)} bytes, K={K}, {model['explainedVariance']*100:.1f}% variance)")


if __name__ == "__main__":
    main()
