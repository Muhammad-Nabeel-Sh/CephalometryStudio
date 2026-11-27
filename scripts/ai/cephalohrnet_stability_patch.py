"""Patch CephaloHRNet's train.py for stable fine-tuning and robust checkpoint choice.

Why (docs/AI_DIAGNOSIS_2026-11.md, "md29b results"): in the md29b run validation
loss was NaN on 4 of 11 epochs and validation MRE swung between 1.15 and 15.6 mm
while SDR@2 stayed at 85-86%, so a few films blew up. Validation always ran under
fp16 autocast (even without --amp), and the mean-MRE pick kept epoch 3.

Changes (all opt-in by flag except FP32 validation):
  * Validation runs in FP32. --val-amp restores the old fp16 validation.
  * Non-finite losses and heatmaps are counted and the films named, per epoch.
  * --ema-decay D: keep an exponential moving average of the weights, validate
    and save that (best.pt's "model" is the EMA when enabled).
  * --select {mre,clipped,median,sdr2}: what "best" means. "clipped" is the mean
    error with each point capped at --clip-mm (default 10 mm), so one film that
    blows up cannot decide the checkpoint, but still counts.
  * --outlier-mm M: list validation films whose mean error exceeds M mm, and
    append them to <run>/val_outliers.jsonl.

Usage (notebook, after the mask and augmentation patches):
  from cephalohrnet_stability_patch import apply_stability_patches
  apply_stability_patches("/kaggle/working/CephaloHRNet")
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from cephalohrnet_mask_patch import _apply  # noqa: E402

MARK = "--ema-decay"

_ARGS_OLD = "    p.add_argument('--seed', type=int, default=42, help='random seed')\n"
_ARGS_NEW = _ARGS_OLD + (
    "    p.add_argument('--val-amp', action='store_true',\n"
    "                   help='validate under fp16 autocast (default: FP32)')\n"
    "    p.add_argument('--ema-decay', type=float, default=0.0,\n"
    "                   help='EMA of the weights for validation/saving (0 = off)')\n"
    "    p.add_argument('--select', type=str, default='mre',\n"
    "                   choices=['mre', 'clipped', 'median', 'sdr2'],\n"
    "                   help='validation score that picks best.pt')\n"
    "    p.add_argument('--clip-mm', type=float, default=10.0,\n"
    "                   help='per-point cap for --select clipped (mm)')\n"
    "    p.add_argument('--outlier-mm', type=float, default=5.0,\n"
    "                   help='log validation films with mean error above this (mm)')\n"
)

_EVAL_OLD_SIG = "def evaluate(model, loader, criterion, device, imgsz):\n"
_EVAL_NEW_SIG = "def evaluate(model, loader, criterion, device, imgsz, use_amp=False, clip_mm=10.0):\n"

_EVAL_OLD_INIT = "    all_pred, all_gt, all_ps, all_mask = [], [], [], []\n"
_EVAL_NEW_INIT = ("    all_pred, all_gt, all_ps, all_mask = [], [], [], []\n"
                  "    all_ids, nonfinite_ids, n_loss = [], [], 0\n")

_EVAL_OLD_AC = ("        with autocast('cuda', enabled=device.type == 'cuda'):\n"
                "            hm_pred = model(imgs)\n")
_EVAL_NEW_AC = ("        with autocast('cuda', enabled=use_amp and device.type == 'cuda'):\n"
                "            hm_pred = model(imgs)\n"
                "        hm_pred = hm_pred.float()\n"
                "        ids = list(batch['ceph_id'])\n"
                "        bad = (~torch.isfinite(hm_pred)).flatten(1).any(dim=1).cpu().tolist()\n"
                "        nonfinite_ids += [i for i, b in zip(ids, bad) if b]\n"
                "        hm_pred = torch.nan_to_num(hm_pred, nan=0.0, posinf=0.0, neginf=0.0)\n"
                "        all_ids += ids\n")

_EVAL_OLD_LOSS = "        total_loss += loss.item() * imgs.size(0)\n"
_EVAL_NEW_LOSS = ("        if math.isfinite(loss.item()):\n"
                  "            total_loss += loss.item() * imgs.size(0)\n"
                  "            n_loss += imgs.size(0)\n")

_EVAL_OLD_RET = ("    avg_loss = total_loss / len(loader.dataset)\n\n"
                 "    return avg_loss, metrics, sdr\n")
_EVAL_NEW_RET = ("    avg_loss = total_loss / n_loss if n_loss else float('nan')\n"
                 "    em = metrics.get('errors_mm')\n"
                 "    if em is not None:\n"
                 "        vis = mask_np > 0\n"
                 "        pts = em[vis]\n"
                 "        pts = pts[np.isfinite(pts)]\n"
                 "        metrics['median_mm'] = float(np.median(pts)) if pts.size else float('nan')\n"
                 "        metrics['clipped_mm'] = float(np.minimum(pts, clip_mm).mean()) if pts.size else float('nan')\n"
                 "        per = np.where(vis, em, 0).sum(axis=1) / np.maximum(1, vis.sum(axis=1))\n"
                 "        metrics['per_film_mm'] = dict(zip(all_ids, per.tolist()))\n"
                 "    metrics['nonfinite_ids'] = nonfinite_ids\n"
                 "    return avg_loss, metrics, sdr\n")

_MODEL_OLD = "    model = model.to(device)\n"
_MODEL_NEW = ("    model = model.to(device)\n"
              "    ema = None\n"
              "    if args.ema_decay > 0:\n"
              "        import copy\n"
              "        ema = copy.deepcopy(model).eval()\n"
              "        for p_ in ema.parameters():\n"
              "            p_.requires_grad_(False)\n"
              "        print(f\"EMA of the weights: decay {args.ema_decay}\")\n")

_LOOP_OLD_INIT = ("        model.train()\n"
                  "        train_loss = 0.0\n")
_LOOP_NEW_INIT = ("        model.train()\n"
                  "        train_loss = 0.0\n"
                  "        bad_steps = 0\n")

_STEP_OLD = ("            scaler.step(optimizer)\n"
             "            scaler.update()\n")
_STEP_NEW = ("            scaler.step(optimizer)\n"
             "            scaler.update()\n"
             "            if ema is not None:\n"
             "                with torch.no_grad():\n"
             "                    for e_, m_ in zip(ema.state_dict().values(), model.state_dict().values()):\n"
             "                        if e_.dtype.is_floating_point:\n"
             "                            e_.mul_(args.ema_decay).add_(m_.detach(), alpha=1 - args.ema_decay)\n"
             "                        else:\n"
             "                            e_.copy_(m_)\n")

_TL_OLD = "            train_loss += loss.item() * imgs.size(0)\n"
_TL_NEW = ("            if math.isfinite(loss.item()):\n"
           "                train_loss += loss.item() * imgs.size(0)\n"
           "            else:\n"
           "                bad_steps += 1\n")

_VAL_OLD = ("        val_loss, val_metrics, val_sdr = evaluate(\n"
            "            model, val_loader, criterion, device, args.imgsz)\n")
_VAL_NEW = ("        eval_model = ema if ema is not None else model\n"
            "        val_loss, val_metrics, val_sdr = evaluate(\n"
            "            eval_model, val_loader, criterion, device, args.imgsz,\n"
            "            use_amp=args.val_amp, clip_mm=args.clip_mm)\n"
            "        if bad_steps:\n"
            "            print(f\"  non-finite training loss on {bad_steps} steps\")\n"
            "        if val_metrics['nonfinite_ids']:\n"
            "            print(f\"  non-finite heatmaps on {len(val_metrics['nonfinite_ids'])} validation films: \"\n"
            "                  f\"{val_metrics['nonfinite_ids'][:10]}\")\n"
            "        per_film = val_metrics.get('per_film_mm', {})\n"
            "        worst = sorted(((v, k) for k, v in per_film.items() if v > args.outlier_mm), reverse=True)\n"
            "        if worst:\n"
            "            print(f\"  {len(worst)} validation films above {args.outlier_mm} mm: \"\n"
            "                  + ', '.join(f'{k} {v:.1f}' for v, k in worst[:10]))\n"
            "        import json as _json\n"
            "        with open(run_dir / 'val_outliers.jsonl', 'a') as _f:\n"
            "            _f.write(_json.dumps({'epoch': epoch, 'bad_steps': bad_steps,\n"
            "                                  'nonfinite': val_metrics['nonfinite_ids'],\n"
            "                                  'over': {k: round(v, 2) for v, k in worst},\n"
            "                                  'median_mm': val_metrics.get('median_mm'),\n"
            "                                  'clipped_mm': val_metrics.get('clipped_mm')}) + '\\n')\n")

_PRINT_OLD = ("            'MRE_px': mre_px, 'MRE_mm': mre_mm,\n"
              "            **val_sdr,\n"
              "        })\n")
_PRINT_NEW = ("            'MRE_px': mre_px, 'MRE_mm': mre_mm,\n"
              "            'median_mm': val_metrics.get('median_mm', float('nan')),\n"
              "            'clipped_mm': val_metrics.get('clipped_mm', float('nan')),\n"
              "            **val_sdr,\n"
              "        })\n")

_BEST_OLD = ("        is_best = mre_px < best_mre\n"
             "        if is_best:\n"
             "            best_mre = mre_px\n")
_BEST_NEW = ("        score = {\n"
             "            'mre': mre_px,\n"
             "            'clipped': val_metrics.get('clipped_mm', float('nan')),\n"
             "            'median': val_metrics.get('median_mm', float('nan')),\n"
             "            'sdr2': -val_sdr.get('sdr_2.0mm', 0.0),\n"
             "        }[args.select]\n"
             "        is_best = math.isfinite(score) and score < best_mre\n"
             "        if is_best:\n"
             "            best_mre = score\n")

_SAVE_OLD = ("                'epoch': epoch, 'model': model.state_dict(),\n"
             "                'best_mre': best_mre, 'args': vars(args),\n"
             "                'val_mre_mm': mre_mm, **val_sdr,\n")
_SAVE_NEW = ("                'epoch': epoch, 'model': eval_model.state_dict(),\n"
             "                'best_mre': best_mre, 'args': vars(args), 'select': args.select,\n"
             "                'ema': ema is not None,\n"
             "                'val_mre_mm': mre_mm, 'val_median_mm': val_metrics.get('median_mm'),\n"
             "                'val_clipped_mm': val_metrics.get('clipped_mm'), **val_sdr,\n")

_BESTMSG_OLD = "            print(f\"  [BEST] MRE_px={best_mre:.4f} px  MRE_mm={mre_mm:.4f} mm  -> saved best.pt\")\n"
_BESTMSG_NEW = ("            print(f\"  [BEST] {args.select}={best_mre:.4f}  MRE_mm={mre_mm:.4f} mm  \"\n"
                "                  f\"median={val_metrics.get('median_mm', float('nan')):.3f} mm  -> saved best.pt\")\n")

_LAST_OLD = ("            'optimizer': optimizer.state_dict(),\n"
             "            'best_mre': best_mre, 'args': vars(args),\n"
             "        }, run_dir / 'last.pt')\n")
_LAST_NEW = ("            'optimizer': optimizer.state_dict(),\n"
             "            'best_mre': best_mre, 'args': vars(args),\n"
             "            'ema_model': ema.state_dict() if ema is not None else None,\n"
             "        }, run_dir / 'last.pt')\n")

_FINAL_OLD = "    print(f\"  Best Val MRE : {best_mre:.4f} px\")\n"
_FINAL_NEW = "    print(f\"  Best val {args.select}: {best_mre:.4f}\")\n"


def apply_stability_patches(root):
    """Apply the stability patch to a CephaloHRNet checkout (idempotent per checkout)."""
    root = os.path.abspath(root)
    tr = os.path.join(root, "train.py")
    if MARK in open(tr, encoding="utf-8").read():
        print("stability patch already applied")
        return
    _apply(tr, [
        (_ARGS_OLD, _ARGS_NEW),
        (_EVAL_OLD_SIG, _EVAL_NEW_SIG),
        (_EVAL_OLD_INIT, _EVAL_NEW_INIT),
        (_EVAL_OLD_AC, _EVAL_NEW_AC),
        (_EVAL_OLD_LOSS, _EVAL_NEW_LOSS),
        (_EVAL_OLD_RET, _EVAL_NEW_RET),
        (_MODEL_OLD, _MODEL_NEW),
        (_LOOP_OLD_INIT, _LOOP_NEW_INIT),
        (_STEP_OLD, _STEP_NEW),
        (_TL_OLD, _TL_NEW),
        (_VAL_OLD, _VAL_NEW),
        (_PRINT_OLD, _PRINT_NEW),
        (_BEST_OLD, _BEST_NEW),
        (_SAVE_OLD, _SAVE_NEW),
        (_BESTMSG_OLD, _BESTMSG_NEW),
        (_LAST_OLD, _LAST_NEW),
        (_FINAL_OLD, _FINAL_NEW),
    ], "train.py (stability)")


if __name__ == "__main__":
    apply_stability_patches(sys.argv[1] if len(sys.argv) > 1 else ".")
