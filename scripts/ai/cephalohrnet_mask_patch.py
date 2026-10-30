"""Patch CephaloHRNet for masked multi-domain training (29 landmarks).

Adds per-landmark visibility so one model can train on:
  * Aariz / CEPHA29  — all 29 landmarks visible
  * ISBI 2015        — only the 19 shared landmarks visible (the other 10 masked)

Changes:
  data/dataset.py  -> `visible` field -> per-sample mask; masked heatmap channels zeroed
  utils/losses.py  -> AdaptiveWingLoss / MSE accept a (B, N) mask
  utils/metrics.py -> compute_mre / compute_sdr accept a mask
  train.py         -> passes masks to loss/metrics; loads the head when shapes match
  test.py          -> passes masks to metrics; skips never-visible landmarks

Usage:
  python scripts/ai/cephalohrnet_mask_patch.py /kaggle/working/CephaloHRNet
  # or, from the app repo in a notebook:
  #   sys.path.insert(0, "CephalometryStudio/scripts/ai")
  #   from cephalohrnet_mask_patch import apply_mask_patches
  #   apply_mask_patches("/kaggle/working/CephaloHRNet")
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from canonical import CEPHA29, ISBI19, ISBI_TO_CEPHA  # noqa: E402


def _apply(path, pairs, label):
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    src = open(path, encoding="utf-8").read()
    for old, new in pairs:
        if old not in src:
            raise RuntimeError(
                f"{label}: patch target not found (upstream changed?):\n{old[:200]}"
            )
        src = src.replace(old, new, 1)
    open(path, "w", encoding="utf-8").write(src)
    print("patched", label)


def apply_mask_patches(root):
    """Apply every masked-training patch to a CephaloHRNet checkout."""
    root = os.path.abspath(root)

    _apply(
        os.path.join(root, "data", "dataset.py"),
        [
            (
                "    return np.array([lm_dict[sym] for sym in LANDMARK_SYMBOLS], dtype=np.float32)\n",
                "    return np.array([lm_dict[sym] for sym in LANDMARK_SYMBOLS], dtype=np.float32)\n"
                "\n"
                "\n"
                "def load_visibility(ann_path, symbols=None):\n"
                "    \"\"\"Per-landmark visibility from an optional `visible: [symbols]` field.\n"
                "\n"
                "    Absent field -> all visible. Used by the multi-domain dataset (ISBI images\n"
                "    supervise only the 19 shared landmarks).\n"
                "    \"\"\"\n"
                "    if symbols is None:\n"
                "        symbols = LANDMARK_SYMBOLS\n"
                "    with open(ann_path, 'r') as f:\n"
                "        data = json.load(f)\n"
                "    vis = data.get('visible')\n"
                "    if vis is None:\n"
                "        return np.ones(len(symbols), dtype=np.float32)\n"
                "    present = set(vis)\n"
                "    return np.array([1.0 if s in present else 0.0 for s in symbols], dtype=np.float32)\n",
            ),
            (
                "        heatmaps     = generate_heatmaps(landmarks_hm, hm_size, hm_size, self.sigma)\n",
                "        heatmaps     = generate_heatmaps(landmarks_hm, hm_size, hm_size, self.sigma)\n"
                "        # Multi-domain supervision: an absent landmark must not teach a peak.\n"
                "        mask = load_visibility(s['ann_paths'][0], LANDMARK_SYMBOLS)\n"
                "        if mask.min() < 1.0:\n"
                "            heatmaps[mask < 0.5] = 0.0\n",
            ),
            (
                "            'ceph_id':        s['ceph_id'],\n",
                "            'mask':           torch.from_numpy(mask),\n"
                "            'ceph_id':        s['ceph_id'],\n",
            ),
        ],
        "dataset.py",
    )

    _apply(
        os.path.join(root, "utils", "losses.py"),
        [
            (
                "    def forward(self, pred, target):\n        \"\"\"\n        pred:   (B, N, H, W) float – predicted heatmaps (raw or sigmoid)",
                "    def forward(self, pred, target, mask=None):\n        \"\"\"\n        pred:   (B, N, H, W) float – predicted heatmaps (raw or sigmoid)",
            ),
            (
                "        )\n        return loss.mean()\n",
                "        )\n"
                "        if mask is not None:\n"
                "            m = mask.float().to(loss.device).view(loss.shape[0], loss.shape[1], 1, 1)\n"
                "            denom = (m.sum() * loss.shape[2] * loss.shape[3]).clamp_min(1.0)\n"
                "            return (loss * m).sum() / denom\n"
                "        return loss.mean()\n",
            ),
            (
                "    def forward(self, pred, target):\n        return F.mse_loss(pred, target)\n",
                "    def forward(self, pred, target, mask=None):\n"
                "        if mask is None:\n"
                "            return F.mse_loss(pred, target)\n"
                "        m = mask.float().to(pred.device).view(pred.shape[0], pred.shape[1], 1, 1)\n"
                "        denom = (m.sum() * pred.shape[2] * pred.shape[3]).clamp_min(1.0)\n"
                "        return (F.mse_loss(pred, target, reduction='none') * m).sum() / denom\n",
            ),
        ],
        "losses.py",
    )

    old_mre = '''def compute_mre(
    pred_coords: np.ndarray,
    gt_coords: np.ndarray,
    pixel_sizes: np.ndarray = None,
) -> dict:
    """
    Compute Mean Radial Error (MRE) per sample and overall.

    Args:
        pred_coords: (B, N, 2) in original image pixels
        gt_coords:   (B, N, 2) in original image pixels
        pixel_sizes: (B,) mm/pixel spacing; if None, only pixel MRE returned

    Returns:
        dict with keys: 'mre_px', 'mre_mm' (optional), 'per_sample_mre'
    """
    errors_px = compute_radial_errors(pred_coords, gt_coords)  # (B, N)
    result = {
        'mre_px': float(errors_px.mean()),
        'per_sample_mre': errors_px.mean(axis=1),   # (B,)
        'per_lm_mre': errors_px.mean(axis=0),        # (N,)
        'errors_px': errors_px,
    }
    if pixel_sizes is not None:
        errors_mm = errors_px * pixel_sizes[:, None]  # (B, N)
        result['mre_mm'] = float(errors_mm.mean())
        result['per_lm_mre_mm'] = errors_mm.mean(axis=0)
        result['errors_mm'] = errors_mm
    return result
'''
    new_mre = '''def compute_mre(
    pred_coords: np.ndarray,
    gt_coords: np.ndarray,
    pixel_sizes: np.ndarray = None,
    mask: np.ndarray = None,
) -> dict:
    """MRE per sample and overall, optionally restricted to visible landmarks.

    mask: (B, N) float with 1 for supervised landmarks, 0 for absent ones.
    Never-visible landmarks are excluded; their per-landmark value is NaN.
    """
    errors_px = compute_radial_errors(pred_coords, gt_coords)  # (B, N)
    w = None if mask is None else mask.astype(np.float32)

    def _safe_div(num, den):
        den = np.asarray(den, np.float32)
        return np.divide(num, den, out=np.full_like(num, np.nan, dtype=np.float32), where=den > 0)

    if w is None:
        mre_px = float(errors_px.mean())
        per_sample = errors_px.mean(axis=1)
        per_lm = errors_px.mean(axis=0)
    else:
        denom = max(1.0, float(w.sum()))
        mre_px = float((errors_px * w).sum() / denom)
        per_sample = (errors_px * w).sum(axis=1) / np.maximum(1.0, w.sum(axis=1))
        per_lm = _safe_div((errors_px * w).sum(axis=0), w.sum(axis=0))
    result = {
        'mre_px': mre_px,
        'per_sample_mre': per_sample,
        'per_lm_mre': per_lm,
        'errors_px': errors_px,
    }
    if pixel_sizes is not None:
        errors_mm = errors_px * pixel_sizes[:, None]
        result['errors_mm'] = errors_mm
        if w is None:
            result['mre_mm'] = float(errors_mm.mean())
            result['per_lm_mre_mm'] = errors_mm.mean(axis=0)
        else:
            denom = max(1.0, float(w.sum()))
            result['mre_mm'] = float((errors_mm * w).sum() / denom)
            result['per_lm_mre_mm'] = _safe_div((errors_mm * w).sum(axis=0), w.sum(axis=0))
    return result
'''

    _apply(
        os.path.join(root, "utils", "metrics.py"),
        [
            (old_mre, new_mre),
            (
                "def compute_sdr(\n    errors_mm: np.ndarray,\n    thresholds=(2.0, 2.5, 3.0, 4.0),\n) -> dict:",
                "def compute_sdr(\n    errors_mm: np.ndarray,\n    thresholds=(2.0, 2.5, 3.0, 4.0),\n    mask: np.ndarray = None,\n) -> dict:",
            ),
            (
                "    return {\n        f'sdr_{t}mm': float((errors_mm < t).mean() * 100)\n        for t in thresholds\n    }",
                "    vals = errors_mm.ravel() if mask is None else errors_mm[mask > 0]\n"
                "    return {\n        f'sdr_{t}mm': float((vals < t).mean() * 100)\n        for t in thresholds\n    }",
            ),
        ],
        "metrics.py",
    )

    _apply(
        os.path.join(root, "train.py"),
        [
            ("    all_pred, all_gt, all_ps = [], [], []", "    all_pred, all_gt, all_ps, all_mask = [], [], [], []"),
            ("        loss = criterion(hm_pred.float(), hm_gt)", "        loss = criterion(hm_pred.float(), hm_gt, batch['mask'].to(device))"),
            ("        all_ps.append(batch['pixel_size'].numpy())", "        all_ps.append(batch['pixel_size'].numpy())\n        all_mask.append(batch['mask'].numpy())"),
            ("    ps_np = np.concatenate(all_ps, axis=0)", "    ps_np = np.concatenate(all_ps, axis=0)\n    mask_np = np.concatenate(all_mask, axis=0)"),
            ("    metrics = compute_mre(pred_np, gt_np, ps_np)", "    metrics = compute_mre(pred_np, gt_np, ps_np, mask_np)"),
            ("    sdr = compute_sdr(metrics['errors_mm'])", "    sdr = compute_sdr(metrics['errors_mm'], mask=mask_np)"),
            ("                loss = criterion(hm_pred, hm_gt)", "                loss = criterion(hm_pred, hm_gt, batch['mask'].to(device))"),
            (
                "        matched = {k: v for k, v in state.items()\n                   if k in model_dict and 'head' not in k and model_dict[k].shape == v.shape}",
                "        matched = {k: v for k, v in state.items()\n                   if k in model_dict and model_dict[k].shape == v.shape}",
            ),
        ],
        "train.py",
    )

    _apply(
        os.path.join(root, "test.py"),
        [
            ("    all_pred, all_gt, all_ps = [], [], []", "    all_pred, all_gt, all_ps, all_mask = [], [], [], []"),
            ("            all_ps.append(batch['pixel_size'].numpy())", "            all_ps.append(batch['pixel_size'].numpy())\n            all_mask.append(batch['mask'].numpy())"),
            ("    ps_np   = np.concatenate(all_ps,    axis=0)", "    ps_np   = np.concatenate(all_ps,    axis=0)\n    mask_np = np.concatenate(all_mask,  axis=0)"),
            ("    mre_result = compute_mre(pred_np, gt_np, ps_np)", "    mre_result = compute_mre(pred_np, gt_np, ps_np, mask_np)"),
            ("    sdr_result = compute_sdr(mre_result['errors_mm'])", "    sdr_result = compute_sdr(mre_result['errors_mm'], mask=mask_np)"),
            (
                "    for i, sym in enumerate(LANDMARK_SYMBOLS):\n        print(f\"  {sym:<8}  {LANDMARK_TITLES[sym]:<30}  {per_lm_mm[i]:>9.4f}\")",
                "    for i, sym in enumerate(LANDMARK_SYMBOLS):\n        if not np.isfinite(per_lm_mm[i]):\n            continue\n        print(f\"  {sym:<8}  {LANDMARK_TITLES[sym]:<30}  {per_lm_mm[i]:>9.4f}\")",
            ),
        ],
        "test.py",
    )
    return True


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "CephaloHRNet"
    apply_mask_patches(target)
    print("done")
