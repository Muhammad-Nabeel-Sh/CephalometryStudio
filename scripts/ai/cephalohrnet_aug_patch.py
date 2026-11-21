"""Patch CephaloHRNet's training augmentation: mirror, invert and film-frame borders.

Why (docs/AI_DIAGNOSIS_2026-11.md):
  * mirror / invert — the app runs the model up to 4 times per film (identity,
    mirrored, inverted, both) because the model only knows right-facing,
    normal-polarity films. A model trained on all four could drop that search.
    A left-right flip is label-safe for lateral cephs: no landmark has a
    left/right twin, so channels are not swapped; only x changes (x' = size - x,
    the same convention as the app's mirrored pass).
  * frame borders — ISBI films carry a dark frame whose edge drives early HRNet
    activations ~100x above anatomy (what broke the Kaggle INT8). Random dark or
    bright bands and plate-edge lines teach the network to ignore them. Bands are
    narrowed so they never cover a visible landmark.

Changes:
  data/transforms.py -> CephaloTransform(flip_prob, invert_prob, border_prob),
                        applied after the resize and before the affine
  train.py           -> --flip-prob / --invert-prob / --border-prob (default 0 = unchanged)

Usage (notebook, after the mask patch):
  from cephalohrnet_aug_patch import apply_aug_patches
  apply_aug_patches("/kaggle/working/CephaloHRNet")
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from cephalohrnet_mask_patch import _apply  # noqa: E402

_METHOD = '''    def _orientation_and_frame(self, img, landmarks, imgsz):
        """Mirror, invert and film-frame borders (see scripts/ai/cephalohrnet_aug_patch.py)."""
        landmarks = landmarks.copy()
        if self.flip_prob and random.random() < self.flip_prob:
            img = np.ascontiguousarray(img[:, ::-1])
            landmarks[:, 0] = imgsz - landmarks[:, 0]
        if self.invert_prob and random.random() < self.invert_prob:
            img = 255 - img
        if self.border_prob and random.random() < self.border_prob:
            img = img.copy()
            # Landmarks inside the image (masked sentinels sit outside and are ignored).
            inside = (landmarks[:, 0] >= 0) & (landmarks[:, 0] < imgsz) & \\
                     (landmarks[:, 1] >= 0) & (landmarks[:, 1] < imgsz)
            pts = landmarks[inside]
            room = {
                "top": pts[:, 1].min() if len(pts) else imgsz,
                "bottom": imgsz - pts[:, 1].max() if len(pts) else imgsz,
                "left": pts[:, 0].min() if len(pts) else imgsz,
                "right": imgsz - pts[:, 0].max() if len(pts) else imgsz,
            }
            sides = [s for s in room if random.random() < 0.5] or [random.choice(list(room))]
            dark = random.random() < 0.6
            for side in sides:
                w = int(min(random.uniform(0.01, 0.06) * imgsz, room[side] - 8))
                if w <= 0:
                    continue
                v = random.randint(0, 40) if dark else random.randint(200, 255)
                if side == "top":
                    img[:w] = v
                elif side == "bottom":
                    img[imgsz - w:] = v
                elif side == "left":
                    img[:, :w] = v
                else:
                    img[:, imgsz - w:] = v
                if random.random() < 0.5 and w > 4:
                    # bright plate/film edge just inside the band
                    t = random.randint(1, 3)
                    e = random.randint(220, 255)
                    if side == "top":
                        img[w - t:w] = e
                    elif side == "bottom":
                        img[imgsz - w:imgsz - w + t] = e
                    elif side == "left":
                        img[:, w - t:w] = e
                    else:
                        img[:, imgsz - w:imgsz - w + t] = e
        return img, landmarks

    def _random_affine(self, img, landmarks, imgsz):
'''


def apply_aug_patches(root):
    """Apply the augmentation patch to a CephaloHRNet checkout (idempotent per checkout)."""
    root = os.path.abspath(root)
    tf = os.path.join(root, "data", "transforms.py")
    if "_orientation_and_frame" in open(tf, encoding="utf-8").read():
        print("augmentation patch already applied")
        return
    _apply(
        tf,
        [
            ("        blur_prob=0.3,\n    ):\n",
             "        blur_prob=0.3,\n        flip_prob=0.0,\n        invert_prob=0.0,\n        border_prob=0.0,\n    ):\n"),
            ("        self.blur_prob = blur_prob\n",
             "        self.blur_prob = blur_prob\n        self.flip_prob = flip_prob\n"
             "        self.invert_prob = invert_prob\n        self.border_prob = border_prob\n"),
            ("        img, landmarks = self._random_affine(img, landmarks, imgsz)\n",
             "        img, landmarks = self._orientation_and_frame(img, landmarks, imgsz)\n"
             "        img, landmarks = self._random_affine(img, landmarks, imgsz)\n"),
            ("    def _random_affine(self, img, landmarks, imgsz):\n", _METHOD),
            ("            blur_prob=kwargs.get('blur_prob', 0.3),\n",
             "            blur_prob=kwargs.get('blur_prob', 0.3),\n"
             "            flip_prob=kwargs.get('flip_prob', 0.0),\n"
             "            invert_prob=kwargs.get('invert_prob', 0.0),\n"
             "            border_prob=kwargs.get('border_prob', 0.0),\n"),
        ],
        "transforms.py (augmentation)",
    )
    _apply(
        os.path.join(root, "train.py"),
        [
            ("    p.add_argument('--scale-high', type=float, default=1.15, help='random scale upper bound')\n",
             "    p.add_argument('--scale-high', type=float, default=1.15, help='random scale upper bound')\n"
             "    p.add_argument('--flip-prob', type=float, default=0.0, help='horizontal mirror probability')\n"
             "    p.add_argument('--invert-prob', type=float, default=0.0, help='polarity inversion probability')\n"
             "    p.add_argument('--border-prob', type=float, default=0.0, help='film-frame border probability')\n"),
            ("        rotation=args.rotation, scale=(args.scale_low, args.scale_high),\n    )\n",
             "        rotation=args.rotation, scale=(args.scale_low, args.scale_high),\n"
             "        flip_prob=args.flip_prob, invert_prob=args.invert_prob, border_prob=args.border_prob,\n    )\n"),
        ],
        "train.py (augmentation flags)",
    )


if __name__ == "__main__":
    apply_aug_patches(sys.argv[1] if len(sys.argv) > 1 else ".")
