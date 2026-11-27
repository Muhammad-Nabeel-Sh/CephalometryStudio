"""Score the crop refiner and a model ensemble on held-out films.

For each main model (ONNX, one pass, the app's preprocessing and DARK decode):
  * base            — the first pass alone
  * +refiner        — the refiner's landmarks re-placed from crops around the first pass
  * +refiner gated  — the same, but a refined point is kept only if it moved less
                      than --gate-mm (S-N-scaled mm), else the first pass is kept
With two or more models, also the ensemble (mean of the first passes), with and
without the refiner.

ISBI films are scored with the convention masks (canonical.isbi_masked) and split
into 1-300 / 301-400; Aariz in true mm when --aariz-spacing is given.

  python refine_eval.py --model md29c=landmarks-md29c.int8.onnx --model md29b=... \
      --refiner landmarks-refiner.onnx --isbi-images ... --isbi-ann ... \
      --aariz-images ... --aariz-ann ... --aariz-spacing ... --out audit/refine
Writes refine.json and refine.csv.
"""
import argparse
import csv
import json
import os
import sys
from types import SimpleNamespace

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from canonical import CEPHA29, ISBI_PIXEL_MM, isbi_group  # noqa: E402
from external_benchmark import load_harness  # noqa: E402
from refiner import refine_points  # noqa: E402
from robustness_eval import load_cases, run_pass  # noqa: E402


def summary(errs):
    e = np.concatenate([x[np.isfinite(x)] for x in errs]) if errs else np.array([])
    if not e.size:
        return None
    return {"mre_mm": round(float(e.mean()), 3), "median_mm": round(float(np.median(e)), 3),
            "sdr_2mm": round(float(np.mean(e <= 2) * 100), 2), "sdr_4mm": round(float(np.mean(e <= 4) * 100), 2),
            "points": int(e.size)}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--model", action="append", required=True, help="tag=path.onnx (repeat)")
    ap.add_argument("--refiner", default=None, help="refiner ONNX (its .json sits next to it)")
    ap.add_argument("--iters", type=int, default=1, help="refiner passes per point")
    ap.add_argument("--gate-mm", type=float, default=4.0)
    ap.add_argument("--isbi-images"); ap.add_argument("--isbi-ann")
    ap.add_argument("--isbi-pixel-mm", type=float, default=ISBI_PIXEL_MM)
    ap.add_argument("--aariz-images"); ap.add_argument("--aariz-ann")
    ap.add_argument("--aariz-spacing", default=None)
    ap.add_argument("--aariz-pixel-mm", type=float, default=0.1)
    ap.add_argument("--aariz-limit", type=int, default=1000)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import onnxruntime as ort
    mod = load_harness()
    models = []
    for spec in args.model:
        tag, path = spec.split("=", 1)
        models.append((tag, ort.InferenceSession(path, providers=["CPUExecutionProvider"])))
    meta, rsess = None, None
    if args.refiner:
        meta = json.load(open(os.path.splitext(args.refiner)[0] + ".json", encoding="utf-8"))
        rsess = ort.InferenceSession(args.refiner, providers=["CPUExecutionProvider"])
    targets = meta["landmarks"] if meta else []
    tidx = [CEPHA29.index(s) for s in targets]

    def run_ref(batch):
        return rsess.run(None, {"input": batch})[0]

    cases = load_cases(SimpleNamespace(**vars(args)))
    if not cases:
        raise SystemExit("no films found")
    os.makedirs(args.out, exist_ok=True)

    variants = {}                     # name -> list of (group, err[29])
    shifts = []                       # refiner shift (S-N mm) vs whether it helped

    def add(name, group, pts, gt, mm):
        e = np.linalg.norm(pts - np.nan_to_num(gt), axis=1) * mm
        e[np.isnan(gt[:, 0])] = np.nan
        variants.setdefault(name, []).append((group, e))

    def refined(gray, pts):
        out = pts
        for _ in range(args.iters):
            out = refine_points(run_ref, gray, out, targets, meta)
        return out

    def gated(base, ref, sn_px):
        out = ref.copy()
        move = np.linalg.norm(ref - base, axis=1) * 70.0 / sn_px
        out[move > args.gate_mm] = base[move > args.gate_mm]
        return out

    si, ni = CEPHA29.index("S"), CEPHA29.index("N")
    for k, (ds, stem, path, gt, mm) in enumerate(cases):
        img = Image.open(path).convert("RGB")
        gray = np.asarray(img.convert("L"), np.uint8)
        group = ds if ds != "isbi" else "isbi " + isbi_group(stem)
        firsts = []
        for tag, sess in models:
            p0 = run_pass(mod, sess, img)[0].astype(np.float64)
            firsts.append(p0)
            add(tag, group, p0, gt, mm)
            if rsess is not None:
                p1 = refined(gray, p0)
                sn = float(np.linalg.norm(p0[si] - p0[ni]))
                add(tag + " +refiner", group, p1, gt, mm)
                add(tag + " +refiner gated", group, gated(p0, p1, sn), gt, mm)
                for j in tidx:
                    if not np.isnan(gt[j, 0]):
                        e0 = np.linalg.norm(p0[j] - gt[j]) * mm
                        e1 = np.linalg.norm(p1[j] - gt[j]) * mm
                        shifts.append((float(np.linalg.norm(p1[j] - p0[j]) * 70.0 / sn), float(e1 - e0)))
        if len(models) > 1:
            pe = np.mean(firsts, axis=0)
            add("ensemble", group, pe, gt, mm)
            if rsess is not None:
                add("ensemble +refiner", group, refined(gray, pe), gt, mm)
        print(f"[{k + 1}/{len(cases)}] {group} {stem}", flush=True)

    groups = sorted({g for v in variants.values() for g, _ in v})
    report = {"films": {g: sum(1 for c in cases if (c[0] if c[0] != "isbi" else "isbi " + isbi_group(c[1])) == g)
                        for g in groups},
              "refiner": meta, "iters": args.iters, "gate_mm": args.gate_mm, "variants": {}}
    rows = []
    for name, lst in variants.items():
        r = {"all": summary([e for _, e in lst]),
             "isbi": summary([e for g, e in lst if g.startswith("isbi")]),
             **{g: summary([e for gg, e in lst if gg == g]) for g in groups},
             "per_landmark": {s: round(float(np.nanmean([e[CEPHA29.index(s)] for _, e in lst])), 3)
                              for s in CEPHA29
                              if np.isfinite([e[CEPHA29.index(s)] for _, e in lst]).any()}}
        report["variants"][name] = r
        row = {"variant": name}
        for g in ["isbi", *groups]:
            if r.get(g):
                row[f"{g} MRE"] = r[g]["mre_mm"]
                row[f"{g} SDR@2"] = r[g]["sdr_2mm"]
        for s in targets or ["Po", "PNS", "Go", "Ar", "Or", "ANS"]:
            row[s] = r["per_landmark"].get(s)
        rows.append(row)
    if shifts:
        sh = np.array(shifts)
        bins = [0, 1, 2, 4, 8, 1e9]
        report["shift_vs_gain"] = [
            {"shift_mm": f"{a}-{b if b < 1e9 else 'inf'}", "points": int(((sh[:, 0] >= a) & (sh[:, 0] < b)).sum()),
             "mean_change_mm": round(float(sh[(sh[:, 0] >= a) & (sh[:, 0] < b), 1].mean()), 3)
             if ((sh[:, 0] >= a) & (sh[:, 0] < b)).any() else None}
            for a, b in zip(bins[:-1], bins[1:])]
    json.dump(report, open(os.path.join(args.out, "refine.json"), "w", encoding="utf-8"), indent=2)
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(os.path.join(args.out, "refine.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(r)
    if shifts:
        print("refiner shift vs error change:", report["shift_vs_gain"])


if __name__ == "__main__":
    main()
