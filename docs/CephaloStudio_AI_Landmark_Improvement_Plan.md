# CephaloStudio AI Landmark Detection — Multi-Dataset Improvement Plan

## Purpose

This document defines the execution plan for the next generation of CephaloStudio's automatic cephalometric landmark detection system.

The current system already includes:

- CephaloHRNet-based landmark detection
- Training on the Aariz dataset
- Two additional cephalometric datasets available for expansion
- ONNX export for browser/inference deployment
- Image preprocessing and normalization
- DARK sub-pixel heatmap decoding
- PSR/confidence estimation
- Shape/SSM-based plausibility checking
- Orientation/polarity hypotheses
- Quality gating
- Editable AI-generated landmarks
- An existing React/Vite CephaloStudio application

The objective is **not simply to improve the validation score on the original Aariz distribution**. The objective is to build a robust, clinically useful, research-grade system that generalizes across radiographic domains and can later expand to additional landmarks and analyses.

The principal target is:

> **Approach expert inter-operator agreement across diverse lateral cephalograms, while exposing uncertainty and allowing rapid human correction.**

WebCeph or other commercial systems may be used later for comparative benchmarking, but they should not be treated as the ground-truth reference.

---

# 1. Core Development Principles

## 1.1 Separate model development from application development

The AI training system should be independent from the React application.

Recommended architecture:

```text
cephalo-ai/
├── datasets/
├── configs/
├── models/
├── training/
├── inference/
├── evaluation/
├── preprocessing/
├── postprocessing/
├── experiments/
├── notebooks/
└── export/
```

The web application should consume a versioned model artifact and manifest.

```text
CephaloStudio
      │
      ▼
model manifest
      │
      ▼
ONNX model
      │
      ▼
inference adapter
      │
      ▼
landmarks + confidence + metadata
```

Do not embed training-specific assumptions into the frontend.

---

# 2. Phase 0 — Establish the Baseline

## Objective

Freeze the current Aariz-trained model and document exactly what it does before changing anything.

## Tasks

1. Save the current ONNX model as a versioned baseline.
2. Record:
   - architecture
   - input resolution
   - number of landmarks
   - channel ordering
   - preprocessing
   - normalization
   - quantization
   - DARK decoding parameters
   - confidence calculation
   - SSM configuration
   - orientation hypotheses
   - quality gates
3. Create a reproducible inference script that can process a directory of images.
4. Save predictions as structured JSON/CSV.
5. Save evaluation metrics.

## Required baseline metrics

For every landmark:

- Mean Radial Error (MRE)
- Median Radial Error
- RMSE
- SDR@2 mm
- SDR@2.5 mm
- SDR@3 mm
- SDR@4 mm

Also report:

- overall MRE
- overall SDR
- failure rate
- percentage requiring manual correction

## Deliverable

```text
baseline/
├── model.onnx
├── model_manifest.json
├── predictions/
├── metrics.json
├── per_landmark_metrics.csv
└── README.md
```

## Acceptance criterion

The baseline can be reproduced from a clean environment without relying on undocumented settings.

---

# 3. Phase 1 — Dataset Inventory and Harmonization

This is the highest-priority phase.

The project now has:

- Aariz
- Dataset B
- Dataset C

Do not immediately concatenate all three datasets.

First characterize them.

## 3.1 Create a dataset registry

```json
{
  "datasets": [
    {
      "id": "aariz",
      "name": "Aariz",
      "landmark_count": 29
    },
    {
      "id": "dataset_b",
      "name": "Dataset B",
      "landmark_count": null
    },
    {
      "id": "dataset_c",
      "name": "Dataset C",
      "landmark_count": null
    }
  ]
}
```

Replace the placeholder metadata with the actual dataset information.

## 3.2 Document for every dataset

- image count
- image dimensions
- pixel spacing if available
- grayscale/polarity conventions
- acquisition source
- device/vendor if available
- annotation format
- landmark count
- landmark definitions
- coordinate convention
- annotation units
- missing landmarks
- train/validation/test partitions
- licensing restrictions

## 3.3 Build a landmark harmonization table

Do not assume that identical names imply identical anatomical definitions.

Example:

| Canonical landmark | Aariz | Dataset B | Dataset C |
|---|---|---|---|
| S | ✓ | ✓ | ✓ |
| N | ✓ | ✓ | ✓ |
| A | ✓ | ✓ | ✓ |
| B | ✓ | ✓ | ✓ |
| Pog | ✓ | ✓ | ✓ |
| ... | ... | ... | ... |

For each landmark document:

- canonical name
- anatomical definition
- dataset-specific name
- whether definitions are equivalent
- whether the landmark can safely be merged
- whether it should be excluded from the shared training set

## 3.4 Do not merge ambiguous landmarks

If two datasets use materially different annotation definitions, keep them separate until their compatibility is established.

## Deliverables

```text
datasets/
├── registry.json
├── landmark_mapping.csv
├── dataset_statistics.csv
├── annotation_conventions.md
└── preprocessing_profiles/
```

## Acceptance criterion

Every training landmark has a documented definition and a deterministic mapping to a canonical landmark ID.

---

# 4. Phase 2 — External Domain Benchmark

Before training on Dataset B and Dataset C, establish how badly the existing model generalizes.

This is essential.

## 4.1 Create an untouched external test set

The final external test set must never be used for:

- training
- augmentation tuning
- hyperparameter selection
- model selection
- SSM tuning
- threshold tuning

If the datasets contain official test partitions, preserve them.

If not, create a locked test subset before experimentation.

## 4.2 Benchmark the current model

Run the existing baseline model on:

- Aariz test
- Dataset B test
- Dataset C test

Report separately.

Example:

```text
                 Aariz     Dataset B     Dataset C

MRE
SDR@2
SDR@2.5
SDR@3
SDR@4
Failure rate
```

## 4.3 Produce per-landmark domain-shift plots

For each landmark:

```text
Aariz MRE
Dataset B MRE
Dataset C MRE
```

This identifies which landmarks fail because of domain shift.

## 4.4 Categorize failures

Create a failure taxonomy:

- incorrect polarity
- poor contrast
- image noise
- cropping
- unusual framing
- anatomical superimposition
- dental artifacts
- soft-tissue ambiguity
- landmark definition ambiguity
- severe skeletal discrepancy
- pathology
- model localization failure
- post-processing failure

## Deliverable

```text
evaluation/external_baseline/
├── overall_metrics.csv
├── per_landmark_metrics.csv
├── domain_comparison.csv
├── failure_cases/
└── failure_analysis.md
```

## Acceptance criterion

The team knows exactly which landmarks and domains are responsible for the current generalization failure.

---

# 5. Phase 3 — Build the Multi-Domain Training Dataset

## Objective

Create a unified training dataset without destroying dataset-specific information.

## 5.1 Preserve dataset identity

Every sample should contain:

```json
{
  "image": "...",
  "dataset": "aariz",
  "split": "train",
  "landmarks": {},
  "landmark_schema": "canonical_v1"
}
```

Dataset identity is important for later domain analysis.

## 5.2 Use a canonical coordinate system

Convert all datasets to:

```text
x = horizontal pixel coordinate
y = vertical pixel coordinate
```

with explicit image dimensions.

Do not silently resize coordinates.

## 5.3 Keep the original annotation

Store both:

```text
original annotation
canonical annotation
```

so conversion can be audited.

## 5.4 Dataset balancing

Do not allow the largest dataset to dominate training automatically.

Test strategies such as:

- balanced dataset sampling
- weighted sampling
- batch-level domain balancing

Do not select a strategy solely because it improves Aariz validation performance.

---

# 6. Phase 4 — Robust Preprocessing and Augmentation

The purpose of augmentation is to simulate realistic domain variation, not to generate unrealistic radiographs.

## 6.1 Recommended augmentations

Use controlled variation in:

### Intensity

- contrast
- brightness
- gamma
- exposure
- CLAHE
- mild histogram variation

### Image quality

- Gaussian noise
- sensor-like noise
- mild blur
- JPEG compression
- resolution degradation

### Geometry

- small rotation
- small translation
- mild scaling
- mild cropping

### Polarity

- normal/inverted when appropriate

### Framing

- different borders
- padding
- aspect ratios
- mild crop variation

## 6.2 Avoid excessive geometric augmentation

Cephalometric anatomy has meaningful geometry.

Do not introduce transformations that make the image anatomically unrealistic.

## 6.3 Keep an augmentation profile

```yaml
augmentation:
  brightness:
    probability: ...
  contrast:
    probability: ...
  gamma:
    probability: ...
  clahe:
    probability: ...
  blur:
    probability: ...
  noise:
    probability: ...
  rotation:
    degrees: ...
  scaling:
    range: ...
```

The exact values should be selected experimentally.

---

# 7. Phase 5 — Multi-Domain CephaloHRNet Training

## Objective

Train a model that learns anatomical landmarks across multiple radiographic domains.

Start with the existing CephaloHRNet architecture before introducing a completely different architecture.

## 7.1 First experiment

Train the existing model with:

```text
Aariz + Dataset B + Dataset C
```

using the canonical landmark subset.

This establishes whether additional data alone solves the generalization problem.

## 7.2 Keep experiments isolated

Compare:

```text
Experiment A
Aariz only

Experiment B
Aariz + B

Experiment C
Aariz + C

Experiment D
Aariz + B + C
```

Then compare all against the locked external test.

## 7.3 Loss weighting

Initially use a simple loss.

Only introduce landmark-specific loss weights after identifying consistently difficult landmarks.

Potential later formulation:

```text
L =
L_heatmap
+
λ_visibility L_visibility
+
λ_regression L_coordinate
```

Do not add multiple loss components simultaneously without an ablation study.

## Acceptance criterion

The multi-domain model must improve external-domain performance without unacceptable degradation on the original Aariz test distribution.

---

# 8. Phase 6 — Coarse-to-Fine Landmark Refinement

If the multi-domain HRNet still produces large localization errors, implement a second-stage refinement network.

## Architecture

```text
Full image
    │
    ▼
HRNet
    │
    ▼
Coarse landmark
    │
    ▼
Local crop
    │
    ▼
High-resolution refinement network
    │
    ▼
Final landmark
```

## Start with difficult landmarks

Do not implement all landmarks simultaneously.

Select approximately 5–10 landmarks based on Phase 2 errors.

Likely candidates may include:

- A
- PNS
- Porion
- incisor apices
- soft-tissue landmarks

The actual selection must come from measured errors.

## Refinement crop

The crop size should be large enough to contain local anatomy but small enough to provide substantially higher effective resolution.

Test several crop scales.

## Deliverables

```text
models/
├── global_detector.onnx
└── local_refiner.onnx
```

## Acceptance criterion

Refinement produces a statistically meaningful reduction in error on the targeted landmarks.

---

# 9. Phase 7 — Visibility and Uncertainty

The system should distinguish:

> "The model is confident."

from:

> "The model cannot reliably determine this landmark."

## 9.1 Visibility prediction

Add a visibility/confidence output where feasible.

Example:

```json
{
  "landmark": "PNS",
  "x": 421.2,
  "y": 512.7,
  "confidence": 0.74,
  "visibility": 0.43
}
```

## 9.2 Test-Time Augmentation uncertainty

Run controlled transformations:

```text
original
mirror if applicable
contrast variation
small rotation +
small rotation -
```

Transform predictions back to the original coordinate system.

Calculate prediction dispersion.

Example:

```text
A:
mean position = (421.4, 512.1)
TTA spread = 2.1 px
```

Large spread should trigger review.

## 9.3 Confidence calibration

Do not assume that raw confidence is calibrated.

Measure:

- confidence vs actual error
- reliability curves
- failure probability at different confidence levels

## UI

Show:

```text
A-point
Confidence: High
Uncertainty: ±1.8 px
```

and:

```text
PNS
Confidence: Low
Review recommended
```

---

# 10. Phase 8 — Shape Model / SSM as a Validator

The existing SSM should remain, but its role should be carefully controlled.

## Principle

The SSM should primarily detect implausible configurations rather than forcibly relocating every prediction.

```text
AI prediction
     │
     ▼
SSM validation
     │
 ┌───┴────┐
 ▼        ▼
plausible suspicious
           │
           ▼
       user review
```

## Record both positions

Never overwrite the raw model prediction.

Store:

```json
{
  "rawPrediction": {},
  "validatedPrediction": {},
  "ssmResidual": 3.2,
  "reviewRequired": true
}
```

This preserves provenance.

---

# 11. Phase 9 — Landmark-Specific Hard Case Optimization

After the multi-domain model is stable, create a difficulty profile.

Example:

| Landmark | MRE | SDR@2 | Difficulty |
|---|---:|---:|---|
| S | ... | ... | Low |
| N | ... | ... | Low |
| A | ... | ... | High |
| PNS | ... | ... | High |
| U1 apex | ... | ... | Very high |

Then apply targeted interventions.

Possible interventions:

1. higher loss weight
2. oversampling
3. dedicated refinement crop
4. landmark-specific augmentation
5. improved annotation quality
6. additional expert annotations

Do not modify everything simultaneously.

---

# 12. Phase 10 — Expandable Landmark Registry

The model and application must not be hard-coded around 29 landmarks.

## Create a canonical landmark registry

```json
{
  "id": "A",
  "name": "Point A",
  "category": "skeletal",
  "definition": "...",
  "laterality": "midline",
  "requiredFor": [
    "Steiner",
    "Downs"
  ]
}
```

## Model manifest

```json
{
  "modelId": "cephhrnet-v2",
  "version": "2.0.0",
  "input": {
    "width": 768,
    "height": 768
  },
  "landmarks": [
    "S",
    "N",
    "A",
    "B"
  ]
}
```

The frontend reads the manifest rather than assuming channel positions.

## Future expansion

A future model can add:

- additional skeletal landmarks
- soft-tissue landmarks
- dental landmarks
- surgical planning landmarks
- pathology-related landmarks

without rewriting the core landmark engine.

---

# 13. Phase 11 — AI-to-Tracing Integration

Once landmark detection is reliable:

```text
AI landmarks
      ↓
landmark registry
      ↓
geometric primitives
      ↓
lines
      ↓
angles
      ↓
distances
      ↓
cephalometric analyses
```

The AI should not directly calculate Steiner/Ricketts/etc.

It should provide landmarks.

The existing deterministic measurement engine should perform the geometry.

This ensures that:

- AI model errors are distinguishable from calculation errors
- analyses remain reproducible
- manually corrected landmarks automatically update all measurements

---

# 14. Phase 12 — Human-in-the-Loop Review

The final workflow should be:

```text
Import image
      ↓
AI Trace
      ↓
Landmarks appear
      ↓
Confidence/uncertainty indicators
      ↓
Review difficult landmarks
      ↓
Move/delete/add landmarks
      ↓
Accept trace
      ↓
Measurements automatically update
```

## Store AI and final coordinates separately

Example:

```json
{
  "landmark": "A",
  "ai": {
    "x": 421,
    "y": 512,
    "confidence": 0.91
  },
  "final": {
    "x": 427,
    "y": 516,
    "edited": true
  }
}
```

This is essential for research.

---

# 15. Phase 13 — Reproducibility and Provenance

Every AI trace should record:

- model ID
- model version
- ONNX hash
- preprocessing profile
- image dimensions
- coordinate transformation
- inference date/time
- confidence
- uncertainty
- raw prediction
- post-processing
- SSM residual
- final user correction

Example:

```json
{
  "aiTrace": {
    "model": "cephhrnet-v2",
    "modelHash": "...",
    "preprocessing": "profile-v3",
    "decoder": "DARK-v2",
    "postprocessing": "validator-v2"
  }
}
```

This should be embedded in the `.cephx` project format.

---

# 16. Phase 14 — Research Validation

Before claiming high-level performance, perform formal validation.

## Dataset-level metrics

- MRE
- median radial error
- RMSE
- SDR@2 mm
- SDR@2.5 mm
- SDR@3 mm
- SDR@4 mm

## Landmark-level metrics

Report all metrics separately for each landmark.

## Human comparison

Have at least two trained operators annotate an independent subset.

Calculate:

- inter-operator error
- AI vs expert 1
- AI vs expert 2
- AI vs consensus

The most important comparison is:

```text
AI error
vs
human inter-operator variability
```

## Additional analyses

- Bland–Altman where appropriate
- ICC for derived measurements
- coordinate displacement distributions
- failure-case analysis

---

# 17. Phase 15 — Benchmark Against Existing Software

Only after expert-based validation should you compare against:

- WebCeph
- other available systems
- manual tracing

The comparison should use the same images and the same reference annotations.

Do not treat commercial software output as ground truth.

Record:

```text
Human consensus
AI
Commercial software
```

and compare each against the reference.

---

# 18. Phase 16 — ONNX and Browser Deployment

Once the model is stable:

```text
PyTorch
   ↓
ONNX
   ↓
ONNX Runtime
   ↓
CephaloStudio
```

Validate that ONNX predictions match the reference PyTorch implementation within an explicitly defined tolerance.

Test:

- float32
- float16 if supported
- INT8 if used

Do not optimize/quantize before the floating-point model is validated.

## Required deployment test

```text
PyTorch output
      vs
ONNX output
```

Compare every landmark coordinate and confidence.

---

# 19. Phase 17 — Performance and UX

Target:

- predictable inference time
- progress indicator
- cancellation if possible
- no UI blocking
- clear AI status
- obvious low-confidence landmarks
- easy correction

Example:

```text
AI tracing...
29 / 29 landmarks detected

Review required: 3 landmarks
```

---

# 20. Phase 18 — Safety and Failure Handling

The AI must be allowed to say:

> "I am uncertain."

rather than always returning a confident trace.

Automatic review should trigger when:

- confidence is low
- TTA spread is high
- SSM residual is high
- landmark falls outside expected anatomical region
- image quality is poor
- orientation is ambiguous
- multiple hypotheses disagree

The application should never silently present a low-confidence prediction as a definitive clinical measurement.

---

# 21. Recommended Experiment Matrix

Use a controlled experiment table.

| Experiment | Training data | Architecture | Purpose |
|---|---|---|---|
| E0 | Aariz | Current HRNet | Baseline |
| E1 | Aariz+B | Current HRNet | Dataset contribution |
| E2 | Aariz+C | Current HRNet | Dataset contribution |
| E3 | Aariz+B+C | Current HRNet | Multi-domain baseline |
| E4 | Aariz+B+C | + augmentation | Domain robustness |
| E5 | Aariz+B+C | + refinement | Localization |
| E6 | Aariz+B+C | + visibility | Uncertainty |
| E7 | Aariz+B+C | + targeted refinement | Hard landmarks |
| E8 | Final | Full pipeline | Deployment candidate |

Do not compare models only on the training-domain validation set.

---

# 22. Recommended Directory Structure

```text
cephalo-ai/
│
├── datasets/
│   ├── aariz/
│   ├── dataset_b/
│   ├── dataset_c/
│   ├── registry.json
│   └── landmark_mapping.csv
│
├── configs/
│   ├── baseline.yaml
│   ├── multidomain.yaml
│   ├── refinement.yaml
│   └── final.yaml
│
├── models/
│   ├── checkpoints/
│   ├── onnx/
│   └── manifests/
│
├── training/
│   ├── train.py
│   ├── losses.py
│   ├── augmentations.py
│   └── samplers.py
│
├── inference/
│   ├── predict.py
│   ├── decoder.py
│   ├── confidence.py
│   └── pipeline.py
│
├── refinement/
│   ├── cropper.py
│   ├── model.py
│   └── train.py
│
├── validation/
│   ├── metrics.py
│   ├── benchmark.py
│   ├── reliability.py
│   └── reports.py
│
├── experiments/
│   ├── E0/
│   ├── E1/
│   ├── E2/
│   └── ...
│
└── docs/
    ├── DATASETS.md
    ├── LANDMARKS.md
    ├── MODEL.md
    └── VALIDATION.md
```

---

# 23. What NOT to Do Yet

Do not simultaneously:

- replace HRNet
- add a transformer
- add an ensemble
- redesign the SSM
- add 20 new landmarks
- change preprocessing
- change quantization
- change confidence calculation

That would make it impossible to determine what actually improved performance.

The development strategy should be:

```text
Measure
  ↓
Identify failure
  ↓
Change one major component
  ↓
Ablate
  ↓
Validate externally
  ↓
Keep/reject
```

---

# 24. Definition of "Production-Ready AI Trace"

Do not declare the system ready because one validation score is good.

The candidate model should satisfy all of the following:

## Accuracy

- strong overall MRE
- strong SDR
- no catastrophic landmark-specific failures
- performance maintained across all three datasets

## Robustness

- polarity variation
- contrast variation
- resolution variation
- device/domain variation
- different anatomical patterns

## Uncertainty

- meaningful confidence
- uncertainty detection
- low-confidence cases flagged

## Human interaction

- every landmark editable
- correction immediately updates analyses
- raw AI prediction preserved

## Reproducibility

- model version recorded
- preprocessing recorded
- ONNX hash recorded
- predictions reproducible

## Extensibility

- landmark registry
- model manifest
- arbitrary landmark count
- additional models supported

---

# 25. Final Target Architecture

```text
                    CephaloStudio
                         │
                         ▼
                  Image ingestion
                         │
                         ▼
                preprocessing layer
                         │
                         ▼
              orientation / quality
                         │
                         ▼
                global HRNet model
                         │
                         ▼
                 coarse landmarks
                         │
                         ▼
              high-resolution refiner
                         │
                         ▼
                 DARK decoding
                         │
                         ▼
             confidence + visibility
                         │
                         ▼
               TTA uncertainty
                         │
                         ▼
               anatomical validator
                         │
                         ▼
                   SSM validator
                         │
                         ▼
                 human review
                         │
                         ▼
                final landmarks
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      geometric engine         provenance layer
             │                       │
             ▼                       ▼
       measurements             .cephx record
             │
             ▼
       cephalometric analyses
             │
             ▼
       statistics/reliability
```

---

# 26. Suggested Execution Order for OpenCode Go

The coding agent should implement the project in this order:

### Sprint 1
Dataset registry + landmark harmonization + baseline evaluator.

### Sprint 2
External benchmark pipeline + per-landmark/domain reports.

### Sprint 3
Unified multi-domain dataloader + augmentation profiles.

### Sprint 4
Multi-domain HRNet training experiments E1–E4.

### Sprint 5
External evaluation and hard-landmark identification.

### Sprint 6
Coarse-to-fine refinement prototype.

### Sprint 7
Visibility + TTA uncertainty.

### Sprint 8
SSM/anatomical validator integration.

### Sprint 9
Landmark registry + model manifest + dynamic channel mapping.

### Sprint 10
Human-in-the-loop correction + provenance.

### Sprint 11
ONNX conversion/validation + browser integration.

### Sprint 12
Final external validation + benchmark report.

---

# 27. Immediate Next Action

Before asking the coding agent to modify the model, provide it with:

1. the names of Dataset B and Dataset C
2. their landmark counts
3. annotation formats
4. image formats
5. train/validation/test structure
6. current CephaloHRNet training code
7. current preprocessing code
8. current ONNX inference code
9. current landmark registry/channel mapping
10. current evaluation results on Aariz and the two additional datasets

Then instruct the agent to implement **Phase 0 and Phase 1 only**.

Do not allow it to begin architectural modifications until the dataset harmonization report has been generated.

This ensures that subsequent changes are evidence-driven rather than speculative.
