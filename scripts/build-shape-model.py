#!/usr/bin/env python3
"""
Build a statistical shape model (SSM) for cephalometric landmarks from public
ISBI 2015 annotations, and export a compact JSON prior used by the browser
refinement pass (src/lib/shapeModel.js).

The prior is a PCA of Procrustes-aligned landmark configurations. Refinement
projects noisy detector predictions onto this shape subspace, which removes
implausible "outlier" configurations (e.g. a Gonion 8 mm off).

Usage
-----
    python scripts/build-shape-model.py
    python scripts/build-shape-model.py --k 12 --out src/data/shapeModel.isbi19.json
"""

import argparse
import csv
import io
import json
import os
import ssl
import urllib.request

import numpy as np

ANN_URL = "https://raw.githubusercontent.com/stolariks/medical-landmark-detection/main/data/isbi-2015/train/annotations.csv"
SYMS = ["S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
        "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar"]
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "python-urllib"})
    return urllib.request.urlopen(req, timeout=120, context=_CTX).read().decode("utf-8", "replace")


def load_shapes():
    txt = fetch(ANN_URL)
    shapes = []
    for row in csv.reader(io.StringIO(txt)):
        if not row or row[0] == "image_path":
            continue
        shapes.append(np.array([float(v) for v in row[1:]], np.float64).reshape(len(SYMS), 2))
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
    ap.add_argument("--k", type=int, default=10, help="number of PCA components to keep")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "src", "data", "shapeModel.isbi19.json"))
    args = ap.parse_args()

    shapes = load_shapes()
    print(f"loaded {len(shapes)} shapes x {shapes.shape[1]} landmarks")
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
        "landmarks": SYMS,
        "mean": [round(float(v), 4) for v in mean_flat],
        "sigmas": [round(float(v), 4) for v in sigmas],
        "components": [[round(float(v), 5) for v in c] for c in comps],
        "explainedVariance": round(float(var[:K].sum()), 4),
        "n": int(len(aligned)),
    }
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, separators=(",", ":"))
    print(f"wrote {out} ({os.path.getsize(out)} bytes, K={K}, {model['explainedVariance']*100:.1f}% variance)")


if __name__ == "__main__":
    main()
