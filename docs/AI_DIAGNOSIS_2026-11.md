# AI accuracy round — step 1: diagnosis (2026-11-21)

Model: md29 (`Results 2/cephalometry-training/md29/20261103-2152`, FP32 and the locally
re-quantized INT8 that ships). Compared with md19. Evaluation sets on this machine: ISBI 2015
test (50 films, 0.1 mm/px) and Aariz valid (150 films, shared 19 landmarks; no pixel spacing
locally, so Aariz errors are in approximate mm with S–N scaled to 70 mm).

## 1. Most of the ISBI error is a labelling convention, not model error

The ISBI annotations change convention at film 301. Films 1–300 (the original ISBI 2015
training + Test1 sets) and films 301–400 (Test2) place several landmarks differently. After a
similarity alignment on 11 stable landmarks, the mean label position of films 301–400 minus
films 1–300 is:

| landmark | shift (mm) | direction (301–400 vs 1–300) |
|---|---|---|
| Pog' | 9.9 | 9.6 mm higher, 2.4 mm more anterior |
| B | 5.4 | 4.5 mm higher, 2.9 mm more posterior |
| Or | 4.3 | 3.5 mm higher, 2.5 mm more anterior |
| UL | 2.9 | 2.9 mm higher |
| LL | 2.6 | 1.8 mm lower, 1.9 mm more posterior |
| A | 2.3 | 2.2 mm higher |
| every other landmark | ≤ 1.8 | |

Within each group the change is consistent block by block (1–50, 51–100, … all agree; 301–350
and 351–400 agree), so it is not sampling noise: the two groups were labelled differently.

**All 50 ISBI test films are from 301–400.** md29 (and md19) learned the majority convention
(films 1–300 plus Aariz), so on the test films their mean error vector points exactly against
the label shift (cosine 0.96–1.00 for Pog', B, Or, UL, LL, A, ANS). These landmarks' errors are
78–91% bias, with small spread (SD 0.6–2 mm):

| | ISBI MRE | SDR@2 mm |
|---|---|---|
| md29 FP32 as reported | 2.14 mm | 63.7% |
| labels moved by the shift measured from the labels alone (6 landmarks > 2 mm) | 1.42 mm | 76.5% |
| per-landmark mean offset removed (upper bound) | 1.25 mm | 83.1% |
| md19, per-landmark offset removed | 1.22 mm | — |

Per landmark (md29, convention corrected from labels): Pog' 8.06 → 2.93, B 5.19 → 2.49,
Or 3.71 → 1.81, UL 3.21 → 0.89, LL 2.56 → 1.28, A 2.53 → 2.09 mm.

So the "ISBI 2.1 mm" headline mostly measures which convention the model follows. The
md29-vs-md19 gap reported in Step 28 (+0.09 mm) is inside this effect.

**Which convention is right?** See `docs/img/isbi-pog-conventions.jpg`. On films 1–300 Pog'
sits on the underside of the soft chin, near Me level (closer to soft-tissue gnathion); on films
301–400 it sits on the most prominent point of the soft chin, about level with Pog — the
textbook definition. Aariz agrees with films 301–400 for Pog' (Pog'−Pog ≈ 10.6 mm anterior,
level) and B. For Or, Aariz agrees with films 1–300. This needs a clinician's decision per
landmark before any retraining.

On Aariz the model has no meaningful bias on any landmark (all < 0.7 mm).

## 2. The real weak landmarks

With the convention removed, no film fails: the worst ISBI film averages 1.95 mm, the worst
Aariz film 2.39 mm. Errors over 4 mm are rare (2.6% ISBI, 1.9% Aariz) and concentrate on
**Po, PNS, Go, Ar, Or, ANS** (Aariz: Po 13, PNS 10, Go 8, Ar 6, Or 6, ANS 5 of 54). These are
low-contrast points or points with double (left/right) contours; their spread is 1.5–2 mm on
both datasets. This is where model work (a high-resolution refinement pass) can still gain.

**Confidence barely predicts error.** The PSR confidence per point correlates −0.11 (ISBI) and
−0.24 (Aariz) with the point's error; the lowest 10% of confidence have a mean error of
1.5–1.6 mm vs 1.1–1.2 mm for the rest. Good enough to rank, not to flag individual points: the
uncertainty step needs a better signal (flip consistency, heatmap spread, or an ensemble).

## 3. INT8

The shipped (locally re-quantized) INT8 is fine: mean 0.28 mm from FP32 over all 29 channels
(p99 1.2 mm), MRE change −0.01 mm on ISBI and +0.03 mm on Aariz (95% CI ±0.01).

**Why the Kaggle INT8 broke (reproduced locally, onnxruntime 1.30):**

| calibration set (MinMax) | median activation scale | peak agreement with FP32 |
|---|---|---|
| 16 Aariz + 16 ISBI (the Kaggle recipe) | 0.448 | broken (peaks 90–130 px off) |
| 16 ISBI only | 0.448 | broken |
| 16 Aariz only | 0.014 | good (≤ 2 px for 93–100% of channels) |
| 16 Aariz + 16 ISBI, Percentile | 0.252 | broken |

The FP32 model's internal activations on ISBI films reach ~3,000 (Aariz ~30). The blow-up
starts in stage 1 (`/stage1/stage1.3/conv3`) on a strip along the top edge of the ISBI film
(the dark frame border). The heatmaps stay correct in FP32, but calibration takes that range
for every layer, leaving no INT8 resolution for real anatomy. The cause is the films, not the
onnxruntime version. Percentile clipping does not help because the strip covers many pixels.

The 2026-11 decision to calibrate on both domains (Step 25) is what broke it.

## Recommendations for the rest of the round

1. **Decide the convention per landmark** (Pog', B, Or, UL, LL, A) — a clinical call. Then
   relabel or mask the other group in training: e.g. mask Pog'/B/UL/LL/A/Or on ISBI films
   1–300 (if the 301–400 + Aariz convention wins) so the model is never taught both.
2. **Fix the benchmark before measuring gains.** Report ISBI 1–300 and 301–400 separately
   (hold out films from each), and always report Aariz test. Until then, ISBI MRE is not a
   valid accuracy target.
3. **Calibrate INT8 on films without the ISBI frame** (Aariz only, or ISBI with the border
   cropped). Keep the export's peak-agreement check. Change `kaggle-multidomain29.ipynb` cell 7.
4. **Model work goes to Po, PNS, Go, Ar, Or, ANS**: a crop-based refinement at higher
   resolution, and border-crop/frame augmentation (the stage-1 response to the frame shows the
   network reacts strongly to it).
5. **Uncertainty**: build and test a better per-point signal before showing confidence in the
   app.

Scripts used (scratchpad, not kept in the repo): prediction dump over ISBI test + Aariz valid,
signed error analysis in the S–N frame, label-shift alignment, re-quantization experiments.

## Decision and changes (2026-11-21)

**Convention: Aariz's, on every disputed landmark** (the textbook one for Pog' and B). Aariz
was compared with both ISBI groups by offsets to neighbouring landmarks (whole-skull alignment
mixes in population differences): Aariz matches films 301–400 for Pog' (0.4 mm vs 9.7), B and
A, and films 1–300 for Or, UL and LL.

- `scripts/ai/canonical.py`: `ISBI_MASK_BY_GROUP` (films 1–300: Pog', B, A; films 301–400: Or,
  UL, LL), `isbi_group`, `isbi_masked`.
- `kaggle-multidomain29.ipynb`: those labels are masked in training (270 ISBI train films, 810
  labels masked); 40 films from 1–300 are held out as test next to the mirror's 50 from 301–400;
  INT8 is calibrated on 32 Aariz films only; the comparison table adds `ISBI 1-300` and
  `ISBI 301-400`.
- `external_benchmark.py --mask-conventions`: skips each film's masked landmarks and reports
  `by_group`. Without the flag it scores all 19, as before.

Checked locally: the data-build cell on the real ISBI labels (splits, masks, no overlap, test
CSV), and the benchmark on both film groups. The training run itself is next, on Kaggle.

## Next run bundle (md29b, 2026-11-21)

One Kaggle run instead of several (`kaggle-multidomain29.ipynb`):

- **Shorter:** starts from `best_md29.pt`, 30 epochs at lr 2e-4 (about 3 h instead of 9);
  falls back to the original `best.pt` and 80 epochs.
- **Convention masks** (above).
- **Augmentation** (`scripts/ai/cephalohrnet_aug_patch.py`, flags `--flip-prob 0.5
  --invert-prob 0.2 --border-prob 0.3`): mirror (x' = size − x; no channel swap, no
  landmark has a left/right twin), polarity inversion, and dark or bright film-frame bands
  with plate edges, narrowed so they never cover a visible landmark.
- **Aariz-only INT8 calibration.**
- **Evaluation:** compared with the app's current md29 (not md19) and the original model;
  Aariz now scored in true mm (`cephalogram_machine_mappings.csv`; earlier tables assumed
  0.1 mm/px for every Aariz film); `scripts/ai/robustness_eval.py` adds one-pass accuracy
  on mirrored / inverted films, flip consistency vs PSR as uncertainty, flip-TTA, shape
  prior on/off, and quality-gate thresholds from valid vs upside-down films.
- Outputs are named `md29b` so they don't collide with the hosted md29.

Not in this run: a refinement model for Po, PNS, Go, Ar, Or, ANS, and ensembles.

## md29b results (Kaggle run, 2026-11-25; outputs in `Results 3/`, not in git)

Held-out films, same for every model (`audit_md29/comparison.csv`; ISBI 1-300 = 40 held-out
films, 301-400 = the mirror's 50; Aariz in true mm):

| model | ISBI MRE | ISBI 1-300 | ISBI 301-400 | Aariz all | Aariz SDR@2 |
|---|---|---|---|---|---|
| md29b INT8 | **1.57** | **1.32** | **1.77** | 1.30 | 82.1% |
| md29b FP32 | 1.53 | 1.29 | 1.73 | 1.24 | 83.3% |
| md29 INT8 (app now) | 1.68 | 1.34* | 1.96 | 1.30 | 82.1% |
| cepha29 INT8 (original) | 3.47 | 4.96 | 2.28 | 2.86 | 78.1% |

\* md29 trained on these films. INT8 costs 0.04–0.06 mm (`peak match 100%` at export).

**Training was unstable.** Validation loss was NaN on epochs 2, 4, 6 and 7 and validation MRE
swung between 1.15 and 15.6 mm while SDR@2 stayed at 85–86%, so a few validation films blew
up (likely fp16 overflow under AMP; the ISBI frame already drives activations to ~3,000).
Early stopping kept epoch 3, so the augmentation had only three epochs to work.

**Robustness** (`audit_md29/robustness.csv`, INT8): one pass on a mirrored film is 3.75 mm on
ISBI (md29: 91 mm), on an inverted film 18.6 mm (md29: 98 mm). Not good enough to drop the
orientation search: keep `autoOrientation` and `autoPolarity`. Simulating the app's search
(first pass, short-circuit on "high", rank) with md29b picked the right hypothesis on 60/60
normal, 60/60 mirrored, 24/24 inverted and 24/24 inverted+mirrored films; a correct-but-mirrored
first pass still reads residualRatio ≈ 1.0 in model space, so it is never accepted.

**Uncertainty:** flip distance (ρ 0.25) does not beat PSR (ρ 0.29) for md29b. Keep PSR.
**Shape prior:** always-on hurts (1.67 vs 1.57 mm); the 0.1–0.5 band is unchanged.
**Quality gate:** valid residualRatio max 0.18, upside-down min 0.77, so the current 0.5 / 0.7
still separate them; the suggested 0.065 "medium" would flag 5% of good films. No change.

**Verdict:** md29b is better than or equal to md29 on every held-out column, with no change to
the app's search or gate. Ship it. A later run that fixes the NaNs (validation in FP32, or
`--amp` off) could still teach orientation and polarity.
