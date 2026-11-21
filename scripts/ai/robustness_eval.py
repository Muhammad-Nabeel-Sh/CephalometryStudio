#!/usr/bin/env python3
"""
Robustness, uncertainty and quality-gate evaluation for a 29-channel landmark model.

Answers, on held-out films (docs/AI_DIAGNOSIS_2026-11.md):

  1. orientation — accuracy of ONE pass on films shown normal, mirrored, inverted
     and mirrored+inverted (predictions mapped back). If all four match, the app
     can drop its 4-pass orientation search.
  2. uncertainty — does the distance between the normal pass and the mirrored
     pass (flip consistency) predict a point's error better than PSR confidence?
     Also scores the flip-averaged prediction (2-pass TTA).
  3. shape prior — MRE raw vs SSM-refined (always, and inside the residual band).
  4. quality gate — meanConf / lowFrac / residualRatio on the valid films and on
     upside-down films (a known-bad input), with suggested thresholds for
     src/lib/landmarkQuality.js.

ISBI films are scored with the per-film convention mask (canonical.isbi_masked);
Aariz films use their true pixel size when a spacing CSV is given.

Usage:
  python scripts/ai/robustness_eval.py --model landmarks-md29.int8.onnx \
      --isbi-images eval29/isbi19/Cephalograms --isbi-ann eval29/isbi19/annotations.csv \
      --aariz-images eval29/aariz29/Cephalograms \
      --aariz-ann "eval29/aariz29/Annotations/Cephalometric Landmarks/Merged29" \
      --aariz-spacing Aariz/cephalogram_machine_mappings.csv \
      --ssm src/data/shapeModel.cepha29.json --out audit/robustness
"""
import argparse
import csv
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from canonical import CEPHA29, ISBI19, ISBI_PIXEL_MM, isbi_masked, isbi_to_cepha_channel  # noqa: E402
from external_benchmark import load_harness, load_isbi_annotations  # noqa: E402

CONDITIONS = [("normal", False, False), ("mirrored", True, False),
              ("inverted", False, True), ("mirrored+inverted", True, True)]


def read_spacing(path):
    """{ceph_id: mm/px} from a CSV with a header naming the id and pixel-size columns."""
    out = {}
    if not path or not os.path.exists(path):
        return out
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        rows = list(csv.reader(f))
    if not rows:
        return out
    head = [h.strip().lower() for h in rows[0]]
    idc = next((i for i, h in enumerate(head) if "id" in h), 0)
    pxc = next((i for i, h in enumerate(head) if "pixel" in h or "spacing" in h or "mm" in h), len(head) - 1)
    for r in rows[1:]:
        try:
            out[os.path.splitext(r[idc].strip())[0]] = float(r[pxc])
        except (ValueError, IndexError):
            continue
    return out


def run_pass(mod, sess, img, mirror=False, invert=False, vflip=False):
    """One forward pass with the film transformed; points mapped back to the original frame."""
    ow, oh = img.size
    im = img
    if invert:
        im = ImageOps.invert(im.convert("L")).convert("RGB")
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if vflip:
        im = im.transpose(Image.FLIP_TOP_BOTTOM)
    x = mod.preprocess(im, size=mod.INPUT, use_clahe=False)
    hm = sess.run([sess.get_outputs()[0].name], {sess.get_inputs()[0].name: x})[0][0]
    pts, conf = mod.decode(hm, dark=True, sigma=2.0)
    psr = mod.psr_confs(hm, dark=True, sigma=2.0)
    pts[:, 0] *= ow / hm.shape[2]
    pts[:, 1] *= oh / hm.shape[1]
    if mirror:
        pts[:, 0] = ow - pts[:, 0]
    if vflip:
        pts[:, 1] = oh - pts[:, 1]
    return pts, conf, psr


def load_cases(args):
    """[(dataset, name, image_path, gt29 (29,2) with NaN where unscored, mm_per_px)]"""
    cases = []
    if args.isbi_images and args.isbi_ann:
        ann = load_isbi_annotations(args.isbi_ann)
        chan = isbi_to_cepha_channel()
        for p in sorted(glob.glob(os.path.join(args.isbi_images, "*"))):
            stem = os.path.splitext(os.path.basename(p))[0]
            if stem not in ann:
                continue
            gt = np.full((len(CEPHA29), 2), np.nan)
            skip = set(isbi_masked(stem))
            for i, s in enumerate(ISBI19):
                if s not in skip:
                    gt[chan[i]] = ann[stem][i]
            cases.append(("isbi", stem, p, gt, args.isbi_pixel_mm))
    if args.aariz_images and args.aariz_ann:
        spacing = read_spacing(args.aariz_spacing)
        n = 0
        for jp in sorted(glob.glob(os.path.join(args.aariz_ann, "*.json"))):
            if n >= args.aariz_limit:
                break
            d = json.load(open(jp, encoding="utf-8"))
            by = {lm["symbol"]: (lm["value"]["x"], lm["value"]["y"]) for lm in d.get("landmarks", [])
                  if "x" in (lm.get("value") or {})}
            if not all(s in by for s in CEPHA29):
                continue
            stem = os.path.splitext(os.path.basename(jp))[0]
            imgs = [q for q in glob.glob(os.path.join(args.aariz_images, stem + ".*"))]
            if not imgs:
                continue
            cases.append(("aariz", stem, imgs[0], np.array([by[s] for s in CEPHA29], float),
                          spacing.get(stem, args.aariz_pixel_mm)))
            n += 1
    return cases


def spearman(a, b):
    ra = np.argsort(np.argsort(a)); rb = np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1])


def pct(v, q):
    v = np.asarray([x for x in v if x is not None and np.isfinite(x)])
    return float(np.percentile(v, q)) if len(v) else None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--model", required=True)
    ap.add_argument("--isbi-images"); ap.add_argument("--isbi-ann")
    ap.add_argument("--isbi-pixel-mm", type=float, default=ISBI_PIXEL_MM)
    ap.add_argument("--aariz-images"); ap.add_argument("--aariz-ann")
    ap.add_argument("--aariz-spacing", default=None, help="CSV: cephalogram id, pixel size (mm/px)")
    ap.add_argument("--aariz-pixel-mm", type=float, default=0.1, help="fallback when no spacing entry")
    ap.add_argument("--aariz-limit", type=int, default=100)
    ap.add_argument("--ssm", default=None, help="29-landmark shape prior JSON")
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import onnxruntime as ort
    mod = load_harness()
    so = ort.SessionOptions()
    if args.threads:
        so.intra_op_num_threads = args.threads
    sess = ort.InferenceSession(args.model, so, providers=["CPUExecutionProvider"])
    ssm = mod.load_ssm(args.ssm) if args.ssm and os.path.exists(args.ssm) else None
    cases = load_cases(args)
    if not cases:
        raise SystemExit("no films found")
    os.makedirs(args.out, exist_ok=True)

    errs = {c: [] for c, _, _ in CONDITIONS}          # per condition: list of (dataset, err[29])
    flipd, psr_all, err_n = [], [], []                  # per point, normal pass
    tta, ssm_always, ssm_band = [], [], []
    gate_ok, gate_bad = [], []
    for k, (ds, stem, path, gt, mm) in enumerate(cases):
        img = Image.open(path).convert("RGB")
        scored = ~np.isnan(gt[:, 0])
        out = {}
        for cname, mir, inv in CONDITIONS:
            pts, conf, psr = run_pass(mod, sess, img, mir, inv)
            out[cname] = (pts, conf, psr)
            e = np.linalg.norm(pts - np.nan_to_num(gt), axis=1) * mm
            errs[cname].append((ds, np.where(scored, e, np.nan)))
        p0, c0, s0 = out["normal"]
        p1 = out["mirrored"][0]
        e0 = np.linalg.norm(p0 - np.nan_to_num(gt), axis=1) * mm
        d = np.linalg.norm(p0 - p1, axis=1) * mm
        flipd += list(d[scored]); psr_all += list(s0[scored]); err_n += list(e0[scored])
        pm = (p0 + p1) / 2
        tta.append(np.where(scored, np.linalg.norm(pm - np.nan_to_num(gt), axis=1) * mm, np.nan))
        res = mod.shape_residual(p0, ssm) if ssm is not None else None
        rr = (res or {}).get("residualRatio")
        if ssm is not None:
            pr = mod.refine_ssm(p0, c0, ssm, alpha=0.6, reg=0.1, k=6, wmin=0.2, iters=1)
            er = np.linalg.norm(pr - np.nan_to_num(gt), axis=1) * mm
            ssm_always.append(np.where(scored, er, np.nan))
            inband = rr is not None and 0.1 <= rr <= 0.5
            ssm_band.append(np.where(scored, er if inband else e0, np.nan))
        gate_ok.append({"meanConf": float(np.mean(s0)), "lowFrac": float(np.mean(s0 < 0.2)), "residualRatio": rr})
        # Upside-down film (points mapped back): a known-bad input for the quality gate.
        pv, _, sv = run_pass(mod, sess, img, vflip=True)
        rv = mod.shape_residual(pv, ssm) if ssm is not None else None
        gate_bad.append({"meanConf": float(np.mean(sv)), "lowFrac": float(np.mean(sv < 0.2)),
                         "residualRatio": (rv or {}).get("residualRatio")})
        print(f"[{k + 1}/{len(cases)}] {ds} {stem}: normal {np.nanmean(np.where(scored, e0, np.nan)):.2f} mm", flush=True)

    def summary(arrays):
        e = np.concatenate(arrays)
        e = e[np.isfinite(e)]
        return {"mre_mm": float(e.mean()), "median_mm": float(np.median(e)),
                "sdr_2.0mm": float(np.mean(e <= 2) * 100), "sdr_4.0mm": float(np.mean(e <= 4) * 100), "points": int(len(e))}

    datasets = sorted({c[0] for c in cases})
    report = {"model": os.path.basename(args.model), "films": {d: sum(1 for c in cases if c[0] == d) for d in datasets}}
    report["orientation"] = {c: {d: summary([r for d_, r in errs[c] if d_ == d]) for d in datasets}
                             for c, _, _ in CONDITIONS}
    flipd, psr_all, err_n = map(np.asarray, (flipd, psr_all, err_n))
    top = flipd >= np.percentile(flipd, 90)
    low = psr_all <= np.percentile(psr_all, 10)
    report["uncertainty"] = {
        "spearman_flip_distance_vs_error": spearman(flipd, err_n),
        "spearman_psr_vs_error": spearman(-psr_all, err_n),
        "error_top10pct_flip_distance_mm": float(err_n[top].mean()),
        "error_rest_flip_mm": float(err_n[~top].mean()),
        "error_lowest10pct_psr_mm": float(err_n[low].mean()),
        "error_rest_psr_mm": float(err_n[~low].mean()),
        "flip_distance_p50_p90_p99_mm": [pct(flipd, 50), pct(flipd, 90), pct(flipd, 99)],
        "frac_err_over_4mm_caught_by_top10pct_flip": float(np.mean(top[err_n > 4])) if np.any(err_n > 4) else None,
    }
    report["flip_tta"] = summary(tta)
    report["normal"] = summary([r for _, r in errs["normal"]])
    if ssm is not None:
        report["ssm"] = {"always": summary(ssm_always), "band_0.1_0.5": summary(ssm_band)}

    def dist(rows, key):
        v = [r[key] for r in rows]
        return {"p01": pct(v, 1), "p05": pct(v, 5), "p50": pct(v, 50), "p95": pct(v, 95), "p99": pct(v, 99),
                "max": pct(v, 100), "min": pct(v, 0)}
    report["quality"] = {
        "valid": {k: dist(gate_ok, k) for k in ("meanConf", "lowFrac", "residualRatio")},
        "upside_down": {k: dist(gate_bad, k) for k in ("meanConf", "lowFrac", "residualRatio")},
    }
    v_rr, b_rr = report["quality"]["valid"]["residualRatio"], report["quality"]["upside_down"]["residualRatio"]
    if v_rr["p95"] is not None and b_rr["p05"] is not None:
        report["quality"]["suggested"] = {
            "residualRatioMedium": round(v_rr["p95"], 3),
            # midway between the most atypical valid film and the bulk of the bad ones
            "residualRatioHigh": round((v_rr["max"] + b_rr["p05"]) / 2, 3),
            "separable": bool(v_rr["max"] < b_rr["p05"]),
        }
    json.dump(report, open(os.path.join(args.out, "robustness.json"), "w", encoding="utf-8"), indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
