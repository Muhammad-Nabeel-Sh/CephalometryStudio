# Cephalometry Studio — Competitive Analysis

> **Date:** July 2026
> **Scope:** Feature-by-feature comparison against the most common and most powerful cephalometric analysis software packages currently available.

---

## Table of Contents

- [Cephalometry Studio — Competitive Analysis](#Cephalometry Studio--competitive-analysis)
  - [Table of Contents](#table-of-contents)
  - [1. Competitor Landscape](#1-competitor-landscape)
  - [2. Feature Comparison Matrix](#2-feature-comparison-matrix)
  - [3. Detailed Category Analysis](#3-detailed-category-analysis)
    - [3.1 Image Management \& DICOM](#31-image-management--dicom)
    - [3.2 Markup \& Tracing Tools](#32-markup--tracing-tools)
    - [3.3 Measurement \& Analysis Engine](#33-measurement--analysis-engine)
    - [3.4 Analysis Templates](#34-analysis-templates)
    - [3.5 AI / Automation](#35-ai--automation)
    - [3.6 Calibration](#36-calibration)
    - [3.7 Norms \& Reference Values](#37-norms--reference-values)
    - [3.8 Statistics \& Reproducibility — **Unique Advantage**](#38-statistics--reproducibility--unique-advantage)
    - [3.9 Database \& Multi-Patient Analytics](#39-database--multi-patient-analytics)
    - [3.10 Custom Formulas \& Computations](#310-custom-formulas--computations)
    - [3.11 Clinical Interpretation Engine](#311-clinical-interpretation-engine)
    - [3.12 Export \& Interoperability](#312-export--interoperability)
    - [3.13 Data Privacy \& Deployment](#313-data-privacy--deployment)
    - [3.14 3D / CBCT](#314-3d--cbct)
    - [3.15 Treatment Simulation \& VTO](#315-treatment-simulation--vto)
    - [3.16 Pricing Model](#316-pricing-model)
  - [4. Strengths \& Gaps](#4-strengths--gaps)
    - [Cephalometry Studio Strengths](#Cephalometry Studio-strengths)
    - [Critical Gaps](#critical-gaps)
  - [5. Strategic Recommendations](#5-strategic-recommendations)
    - [Near-Term (0–3 months)](#near-term-03-months)
    - [Medium-Term (3–9 months)](#medium-term-39-months)
    - [Long-Term (9–18 months)](#long-term-918-months)
    - [Defend the Unique Moat](#defend-the-unique-moat)

---

## 1. Competitor Landscape

| Software                    | Type                  | Price                               | Platform      | Key Differentiator                                                              |
| --------------------------- | --------------------- | ----------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| **Cephalometry Studio**     | Browser (local-first) | **Free**                            | Any (browser) | Full reproducibility suite, custom formulas, 40+ analyses, local-only privacy   |
| **Dolphin Imaging**         | Desktop               | ~$1,000–2,000/yr                    | Windows       | 3D CBCT, treatment simulation, industry incumbent                               |
| **WebCeph**                 | Cloud browser         | Free tier / $9.99–19.99/mo          | Any (browser) | AI auto-tracing, VTO/STO, low-cost entry                                        |
| **CephX**                   | Cloud browser         | $79–199/mo                          | Any (browser) | 100+ analyses, 3D ceph from CBCT, deep AI                                       |
| **OnyxCeph**                | Desktop               | $200–400/yr or €4,800–6,600 once    | Windows       | 120+ analyses, exhaustive library                                               |
| **AudaxCeph**               | Desktop               | ~$500 once                          | Windows       | AI tracing, VTO, superimposition, MDR/FDA cleared                               |
| **BCeph**                   | Browser (local)       | **Free**                            | Any (browser) | Free, local, 9+ core analyses, PDF reports                                      |
| **NemoCeph**                | Desktop               | Custom (€2,000–5,000)               | Windows       | 3D cephalometry, VTO/STO/morphing, treatment follow-up, NemoStudio ecosystem    |
| **Planmeca Romexis**        | Desktop/Cloud         | Custom ($3,000+)                    | Windows/macOS | Full imaging ecosystem, 2D+3D ceph, AI auto-landmarking, CAD/CAM integration    |
| **LabCeph / LightningCeph** | Desktop               | Free (LabCeph) / Shareware (LC 5.0) | Windows       | Freeware, VTO, Bezier curves, 19+ analyses, guided point placement              |
| **Ceppro (DDH Inc.)**       | Cloud browser         | Subscription                        | Any (browser) | AI-based 78-landmark detection, real-time treatment simulation, superimposition |
| **3Shape Ortho System**     | Desktop               | Custom                              | Windows       | Indirect bonding, digital setup, full ortho lab workflow                        |

---

## 2. Feature Comparison Matrix

| Feature                            | Cephalometry Studio                | Dolphin    | WebCeph   | CephX   | OnyxCeph   | AudaxCeph | NemoCeph        | Romexis    | BCeph   | LabCeph   |
| ---------------------------------- | ---------------------------------- | ---------- | --------- | ------- | ---------- | --------- | --------------- | ---------- | ------- | --------- |
| **Browser-based**                  | ✅ Yes                              | ❌ No       | ✅ Yes     | ✅ Yes   | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ✅ Yes   | ❌ No      |
| **Fully local / offline**          | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ✅ Yes      | ✅ Yes     | ✅ Yes           | ⚠️ Partial  | ✅ Yes   | ✅ Yes     |
| **No installation**                | ✅ Yes                              | ❌ No       | ✅ Yes     | ✅ Yes   | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ✅ Yes   | ❌ No      |
| **Free**                           | ✅ Yes                              | ❌ No       | ⚠️ Tiered  | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ✅ Yes   | ✅ Free    |
| **AI landmark detection**          | ❌ No                               | ❌ No       | ✅ Yes     | ✅ Yes   | ❌ No       | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ❌ No      |
| **Manual tracing**                 | ✅ Yes                              | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ✅ Yes   | ✅ Yes     |
| **Number of analyses**             | **40+**                            | 50+        | 20+       | 100+    | 120+       | 50+       | 50+             | 20+        | 9+      | 19+       |
| **Custom formulas**                | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ⚠️ Limited  | ✅ Yes     | ❌ No            | ❌ No       | ❌ No    | ✅ Yes     |
| **KaTeX formula display**          | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Clinical norms comparison**      | ✅ Yes                              | ✅ Yes      | ❌ No      | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ⚠️ Partial |
| **Predefined norm sets**           | 6+                                 | Many       | —         | Many    | Many       | Many      | Many            | Many       | —       | ⚠️ Basic   |
| **Reproducibility studies**        | ✅ **Built-in**                     | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **ICC calculation**                | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Dahlberg error**                 | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ⚠️ Separate | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Bland-Altman plots**             | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Paired t-test**                  | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **ANOVA**                          | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **SEM / MDC**                      | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Multi-patient database**         | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Descriptive stats**              | ✅ Yes                              | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ❌ No      |
| **Outlier detection**              | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Correlation matrix**             | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Linear regression**              | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Confidence intervals**           | ✅ Yes                              | ⚠️ Partial  | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Histogram viewer**               | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Image processing**               | ⚠️ Basic                            | ✅ Advanced | ✅ Basic   | ✅ Basic | ✅ Basic    | ✅ Basic   | ✅ Basic         | ✅ Advanced | ⚠️ Basic | ⚠️ Basic   |
| **LUT presets**                    | ✅ 13 presets                       | ✅ Yes      | ❌ No      | ❌ No    | ✅ Yes      | ❌ No      | ❌ No            | ✅ Yes      | ❌ No    | ❌ No      |
| **Edge enhancement**               | ✅ Yes                              | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ❌ No      |
| **DICOM support**                  | ⚠️ Basic                            | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Full     | ✅ Yes   | ✅ Yes     |
| **3D / CBCT**                      | ❌ No                               | ✅ Yes      | ❌ No      | ✅ Ceph  | ✅ Yes      | ❌ No      | ✅ Yes           | ✅ Full     | ❌ No    | ❌ No      |
| **Treatment simulation**           | ❌ No                               | ✅ Yes      | ✅ VTO/STO | ❌ No    | ❌ No       | ✅ VTO/STO | ✅ VTO/STO/Morph | ✅ VTO/STO  | ❌ No    | ✅ VTO     |
| **VTO**                            | ❌ No                               | ✅ Yes      | ✅ Yes     | ❌ No    | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ✅ Yes     |
| **Superimposition**                | ⚠️ Version overlay                  | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ✅ Yes     |
| **Growth tracking**                | ❌ No                               | ✅ Yes      | ❌ No      | ❌ No    | ✅ Yes      | ✅ Yes     | ✅ Yes           | ❌ No       | ❌ No    | ❌ No      |
| **Airway analysis**                | ✅ Basic                            | ✅ Yes      | ❌ No      | ❌ No    | ✅ Yes      | ❌ No      | ❌ No            | ✅ Yes      | ❌ No    | ❌ No      |
| **Image anonymization**            | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Version management**             | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Clinical interpretation**        | ✅ **Auto**                         | ⚠️ Basic    | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ⚠️ Basic    | ❌ No    | ✅ Guided  |
| **Silhouette overlays**            | ✅ 23 types                         | ✅ Yes      | ❌ No      | ❌ No    | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ❌ No      |
| **Template system**                | ✅ Yes (40+ presets)                | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ⚠️ Yes   | ✅ Yes     |
| **.cephx export/import**           | ✅ Yes                              | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **CSV export**                     | ✅ Yes                              | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ❌ No    | ❌ No      |
| **PDF report**                     | ✅ Yes                              | ✅ Yes      | ✅ Yes     | ✅ Yes   | ✅ Yes      | ✅ Yes     | ✅ Yes           | ✅ Yes      | ✅ Yes   | ✅ Yes     |
| **Angle mode (signed/abs/reflex)** | ✅ Yes                              | ✅ Yes      | ❌ No      | ❌ No    | ✅ Yes      | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Multiple themes**                | ✅ 4 themes                         | ❌ No       | ❌ No      | ❌ No    | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ❌ No    | ❌ No      |
| **Touch/tablet support**           | ✅ Yes (mobile toolbar, double-tap) | ❌ No       | ✅ Yes     | ✅ Yes   | ❌ No       | ❌ No      | ❌ No            | ❌ No       | ✅ Yes   | ❌ No      |

---

## 3. Detailed Category Analysis

### 3.1 Image Management & DICOM

**Cephalometry Studio** supports image loading via file dialog or drag-and-drop (PNG, JPEG, GIF, BMP, WebP, SVG, TIFF). Image adjustments include brightness, contrast, saturation, sharpen, blur, denoise, auto-adjust, and reset. 13 built-in LUT presets (grayscale, hot, cool, jet, viridis, bone, rainbow, ice, sepia, red/green/blue channel, fire). A histogram panel shows pixel intensity distribution. Flip (horizontal/vertical) and 90-degree rotation are supported. Zoom up to 10x with cursor-centered scaling.

The UI mentions DICOM support but there is no true DICOM parser — no DICOM tag reading, DICOMDIR browsing, modality detection, or multi-frame support. DICOM files may load via browser's native image rendering but this is unreliable.

**Comparison:**
- Dolphin and Planmeca Romexis lead with full DICOM tag browsing, multi-frame, modality-specific tools.
- AudaxCeph, NemoCeph, OnyxCeph, LabCeph all support DICOM via TWAIN or direct import.
- WebCeph/CephX expect AI-ready images, minimal processing.
- BCeph has basic image enhancement (brightness, contrast, sharpen, invert).

**Verdict:** Cephalometry Studio has decent image adjustment tools and the best LUT selection, but lacks a real DICOM parser. Mid-pack overall.

### 3.2 Markup & Tracing Tools

**Cephalometry Studio** offers 23+ tool types:
- **Points** (landmarks) with guided placement mode
- **Lines / planes** (infinite-line rendering with dash style options)
- **Angles** (3-point, 4-point)
- **Polygons / curves / bezier** (Catmull-Rom spline, multi-segment cubic bezier with control handles)
- **Ellipse / arc / circle / concentric arcs** (parametric curve fitting)
- **Tangent lines** (geometric tangent snapped to curves, follows parent curve on move)
- **Perpendicular distance, parallel lines, ratio, sum, difference, percentage, projected distance**
- **Midpoint, perpendicular point**
- **Arrows, text annotations**
- **Ruler for calibration**
- **23 SVG anatomical silhouettes** (categorized: soft tissue, sella, airway, etc.)
- **Right-click context menu** on all markups (Focus, Rename, Change Color, Duplicate, Copy/Paste, Hide/Show, Lock/Unlock, Ref Landmark, Move to Front/Back, Group/Ungroup, Copy Measurement, Delete)
- **Grid overlay** (toggleable 50px grid)
- **Group system** (groupId-based bulk drag)
- **refLabels auto-link** — markups automatically attach to nearby points (3px tolerance); dragging a point propagates to all dependent markups via `syncRefDeps`
- **Snap-to-landmark** and **snap-to-line** for precise placement
- **2D alignment** (point-based transform)
- **Right-click context menu**: copy, paste, lock/unlock, bring to front, send to back, toggle visibility
- **Undo/Redo**: full markup state history

**Comparison:**
- Toolset breadth is **above average** — more types than WebCeph (basic points+lines), BCeph (basic), or LabCeph.
- Comparable to Dolphin, NemoCeph, Romexis in manual tool variety.
- Behind OnyxCeph (arc tracing, ellipse fitting) and AudaxCeph (100+ auto-landmarks).
- The curve tool with Bezier/spline rendering is a differentiator — most competitors only do straight-line tracing.
- NemoCeph has guided point wizard; Cephalometry Studio's guided mode is similar.
- No automatic tracing or AI-assisted landmarking.

**Verdict:** Strong manual toolset. Lacks AI, but the variety of tools (spline, perp dist, parallel, ratio/sum/diff) exceeds most mid-range competitors.

### 3.3 Measurement & Analysis Engine

**Cephalometry Studio** computes measurements directly from markups:
- Lines → length, angle
- Angles (3pt) → angle
- Angles (4pt) → incAngle
- Polygons → area, perimeter
- Curves → area, length
- Perp distance → distance
- Ratio / Sum / Difference / Percentage → derived from label references
- Projected distance (projDist) → Wits-style signed projection
- All measurements in px or mm (with calibration)

**Comparison:**
- Standard measurement engine — no gaps compared to competitors in 2D.
- The derived measurement types (ratio, sum, difference, percentage, projDist) are **unique** — most competitors only offer basic distance/angle/area.
- The **custom formula system** (see §3.10) is the true differentiator.

### 3.4 Analysis Templates

**Cephalometry Studio** ships **40+ predefined analysis sets** organized by projection:

| Projection | Analyses                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lateral    | General, Steiner, Ricketts, McNamara, Downs, Bjork, Tweed, Jarv-Bjork, Wits, Holdaway, Sassouni, Arnett, ABO DI, CVM, Kim ODI/APDI, Eastman, Delaire, Merrifield Z-angle, Bimler, Tollaro, Lautrou, Gugino, Epker, COGS, Coben, Di Paolo, Farkas, Harvold, Hasund, Legan-Burstone, Riedel, Schwartz, Wylie, Basis, Cagliari, Chieti, McGann, Moorrees Mesh |
| AP/PA      | Ricketts PA, General PA, Grummons, Hewitt, Svanholt-Solow, Grayson, Van Arsdale, Sassouni Frontal, Moorrees Mesh                                                                                                                                                                                                                                           |
| SMV        | General SMV                                                                                                                                                                                                                                                                                                                                                |
| OPG        | General OPG                                                                                                                                                                                                                                                                                                                                                |
| Airway     | Pharyngeal Airway Analysis                                                                                                                                                                                                                                                                                                                                 |
| Other      | Lateral Photo, Frontal Photo, Hand-Wrist                                                                                                                                                                                                                                                                                                                   |

**Comparison:**
- Dolphin: 50+ — more but many are overlapping variations
- CephX: 100+ — deepest library, includes ethnic-specific norms
- OnyxCeph: 120+ — exhaustive
- AudaxCeph: 50+ (claims 200+ with customization)
- NemoCeph: 50+
- BCeph: 9+ — minimal
- WebCeph: 20+
- LabCeph: 19+
- Romexis: 20+

**Verdict:** 40+ templates places Cephalometry Studio solidly in the upper-mid range — more than WebCeph, BCeph, LabCeph, Romexis; comparable to AudaxCeph/NemoCeph; behind Dolphin/CephX/OnyxCeph. The CSV-defined analysis system is unique — no competitor offers user-editable CSV analysis definitions.

### 3.5 AI / Automation

**Cephalometry Studio has no AI** — all landmarks are placed manually.

**Comparison:**
- WebCeph, CephX, AudaxCeph, NemoCeph, Romexis, Ceppro all offer AI auto-tracing.
- LabCeph/LightningCeph offers guided step-by-step placement (not AI).
- BCeph: manual only (same as Cephalometry Studio).

**Critical Context — Recent Research (2024–2025):**
- A 2024 BMC Oral Health study comparing WebCeph, Cephio, and Ceppro found:
  - All three AI programs showed **significant differences vs. human experts** on 7–10 of 11 parameters
  - WebCeph differed on **10 of 11** parameters (2–9 unit differences)
  - Sensitivity and specificity were **<80%** for most parameters
  - The authors concluded: *"All three AI-based programs showed inaccuracies... clinicians should exercise caution when relying solely on AI-based analyses"*
- AI is most reliable in semi-automated mode where humans verify landmarks.

**Verdict:** Missing AI is the single biggest gap for time-saving. However, the reproducibility suite makes a compelling case for **manual gold-standard tracing** — researchers who need verified, publishable data may prefer manual tracing with rigorous error metrics over black-box AI with known inaccuracies.

### 3.6 Calibration

**Cephalometry Studio** supports ruler-based calibration with pxPerMm computed from a drawn line of known length. Manual px/mm entry (for DICOM with known metadata) is also supported. Calibration status shown in Measurements panel.

**Comparison:**
- All competitors support calibration. Cephalometry Studio's is simple and effective.
- CephX and WebCeph offer automatic ruler detection in AI pipeline.
- No automatic calibration (ruler detection in image).

**Verdict:** Adequate for manual workflow.

### 3.7 Norms & Reference Values

**Cephalometry Studio** has 6+ predefined norm sets (Steiner, Ricketts, Downs, McNamara, Bjork-Jarabak, Tweed) with 57+ individual norm entries from `AnalysisMeasurements.csv`. Norms include `type` field (angle/length) for context-aware matching. The Normogram panel provides visual polygon/radar chart + list view with SD-scaled axes. Norms are used in three contexts:
- **Main workspace** — per-measurement comparison with color-coded deviation badges
- **StudyDashboard** — reproducibility study means vs. norms
- **DatabaseDashboard** — multi-patient sample means vs. norms

**Comparison:**
- Dolphin/OnyxCeph/NemoCeph offer more norm sets (including ethnic-specific).
- CephX claims 100+ analyses but norms embedded in AI pipeline.
- WebCeph/BCeph have no norms comparison feature.
- LabCeph has basic norm comparison.
- Cephalometry Studio's norm system is **more transparent** than any competitor — norms are fully editable, source-cited, and user-extensible via CSV.

**Verdict:** Norms feature is strong — not the largest library, but the most user-accessible and transparent.

### 3.8 Statistics & Reproducibility — **Unique Advantage**

**Cephalometry Studio** has a **built-in research engine** with 6 integrated modules that no other cephalometric software offers:

| Module                    | Key Features                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reliability**           | ICC(2,1) with 95% CI, Bland-Altman (bias, LoA, proportional bias), Dahlberg/SEM/MDC, per-landmark error map (2×2 eigendecomposition), guided multi-operator data collection workflow                                                                                                       |
| **Descriptive/Normative** | N/mean/SD/SEM/median/IQR, reference intervals (parametric + non-parametric), z-scores, severity mapping, predefined norms (Steiner, Downs, McNamara), normality test                                                                                                                       |
| **Comparative**           | Auto test selection (normality + Levene's → parametric/non-parametric), independent/paired t-tests, Welch, Mann-Whitney, Wilcoxon, ANOVA, Kruskal-Wallis, Friedman, post-hoc (Tukey HSD, Bonferroni), effect sizes (Cohen's d, η², ω², rank-biserial), MANOVA (Wilks/Pillai/Hotelling/Roy) |
| **Longitudinal**          | RM-ANOVA with Mauchly sphericity test, GG/HF/LB epsilon corrections, LMM (two-level REML), pairwise Bonferroni, change scores with MDC                                                                                                                                                     |
| **Correlation**           | Pearson/Spearman/partial correlation, correlation matrix, linear regression, logistic regression with ROC/AUC                                                                                                                                                                              |
| **Diagnostic**            | Sensitivity/specificity, ROC curves, AUC, likelihood ratios, predictive values, cross-validation, calibration                                                                                                                                                                              |

| Feature                            | Cephalometry Studio                    | Any Competitor |
| ---------------------------------- | -------------------------------------- | -------------- |
| Intra/inter-operator study setup   | ✅ Guided workflow                      | ❌ None         |
| ICC (absolute agreement, 3 models) | ✅ + CI calculation                     | ❌              |
| Dahlberg error                     | ✅ + aggregate                          | ❌              |
| Bland-Altman plots                 | ✅ Plotly-rendered                      | ❌              |
| Paired t-test / Wilcoxon           | ✅ + p-value + effect size              | ❌              |
| ANOVA / Kruskal-Wallis             | ✅ + post-hoc                           | ❌              |
| RM-ANOVA with sphericity           | ✅ + GG/HF/LB corrections               | ❌              |
| Linear mixed model                 | ✅ Two-level REML                       | ❌              |
| MANOVA                             | ✅ Wilks/Pillai/Hotelling/Roy           | ❌              |
| SEM / MDC                          | ✅                                      | ❌              |
| Per-landmark error metrics         | ✅                                      | ❌              |
| Correlation matrix + logistic      | ✅                                      | ❌              |
| ROC/AUC + diagnostic CV            | ✅                                      | ❌              |
| Golden-value regression tests      | ✅ 18 stat tests guard p-value accuracy | ❌              |
| 269 unit tests                     | ✅ 15 test files                        | ❌              |

**No competitor** includes a statistical research framework. Researchers using Dolphin, OnyxCeph, NemoCeph, Romexis, or any other tool must export data and run analyses in SPSS, R, or Excel — an error-prone manual process.

**This is Cephalometry Studio's strongest differentiator and uncontested advantage.**

### 3.9 Database & Multi-Patient Analytics

**Cephalometry Studio** has a **database mode** that aggregates measurements across multiple patient images:
- Descriptive statistics (mean, SD, median, IQR, skewness, kurtosis, CV)
- Outlier detection (IQR and Z-score methods)
- Confidence intervals for any variable
- Linear regression (bivariate)
- Histograms with statistical overlay
- Full correlation matrix with heatmap
- Grouped statistics by timepoint or operator
- Normative comparison against predefined or custom norms

**Comparison:**
- Dolphin has some multi-patient reporting but no interactive analytics.
- OnyxCeph/NemoCeph have basic batch reporting.
- Romexis has patient database but limited analytics.
- No other browser-based tool offers any database analytics at all.
- BCeph has patient JSON backup but no in-app analytics.

**Verdict:** Major differentiator — especially for academic and research users.

### 3.10 Custom Formulas & Computations

**Cephalometry Studio** has a full **formula system** in `panels.jsx`:
- Users define named formulas using measurement names as variables
- Expressions compiled with mathjs (sandboxed eval)
- KaTeX rendering for LaTeX display in floating panel
- Variable scope auto-built from markup measurements
- Missing variable detection with user feedback
- Inline formula editor with real-time validation

**Comparison:**
- Dolphin: no custom formulas — only built-in analyses
- OnyxCeph: limited customization
- CephX/WebCeph: none — analyses are fixed
- NemoCeph/Romexis: no custom formulas
- AudaxCeph: analysis type creation module (200+ types with custom measurements) — closest competitor
- LabCeph: customizable analyses
- **Cephalometry Studio is one of the only tools with user-extensible formulas alongside AudaxCeph**

**Verdict:** Unique feature among browser-based tools. Enables researchers to define novel cephalometric indices without needing a software update.

### 3.11 Clinical Interpretation Engine

**Cephalometry Studio** has a **rule-based clinical interpretation engine** with 100+ rules organized into 11 diagnostic categories:
- Skeletal classification (Class I/II/III)
- Growth pattern / vertical dimension (hypo/hyperdivergent)
- Maxillary/mandibular position (prognathic/retrognathic)
- Dental relationship (incisor proclination/retroclination)
- Soft tissue profile (convex/straight/concave)
- Airway assessment
- Asymmetry evaluation
- TMJ / condylar position
- Growth assessment (CVM stages CS1–CS6)
- Transverse analysis (PA/SMV)
- Vertical dysplasia

Produces structured output with category, severity (mild/moderate/severe/normal), description text, and affected measurements.

**Comparison:**
- Dolphin: basic interpretation (color-coded deviations).
- Romexis: textual interpretation of measurement deviations.
- LabCeph/LightningCeph: step-by-step guided interpretation with diagnostic report.
- Ceppro: auto-interpretation with treatment simulation.
- Most other tools (WebCeph, CephX, BCeph): **no auto-interpretation at all**.
- Cephalometry Studio's rule engine is more comprehensive than any competitor's.

**Verdict:** Strong differentiator. Only LabCeph and Romexis offer anything comparable, and neither has the breadth of Cephalometry Studio's 100+ rule categories.

### 3.12 Export & Interoperability

| Format             | Cephalometry Studio | Dolphin | WebCeph | CephX  | OnyxCeph | NemoCeph | Romexis   | BCeph   |
| ------------------ | ------------------- | ------- | ------- | ------ | -------- | -------- | --------- | ------- |
| CSV                | ✅                   | ✅       | ✅       | ✅      | ✅        | ✅        | ✅         | ❌       |
| PNG/Screenshot     | ✅                   | ✅       | ✅       | ✅      | ✅        | ✅        | ✅         | ✅       |
| PDF Report         | ✅                   | ✅       | ✅       | ✅      | ✅        | ✅        | ✅         | ✅       |
| DICOM              | ⚠️ Basic read        | ✅ Full  | ✅ Read  | ✅ Read | ✅ Full   | ✅ Full   | ✅ Full    | ✅ Read  |
| Proprietary format | ✅ .cephx            | ✅ .dpf  | —       | —      | ✅ .cpr   | ✅ .ncm   | ✅ .romxis | ✅ .json |
| Template (.cepht)  | ✅                   | ❌       | ❌       | ❌      | ✅        | ❌        | ❌         | ❌       |

**Verdict:** Missing PDF report generation is the most significant export gap. CSV export is functional. .cephx format is a differentiator for multi-user workflows. DICOM reading is unreliable (no proper parser) — this needs attention.

### 3.13 Data Privacy & Deployment

**Cephalometry Studio:**
- ✅ 100% client-side (no server)
- ✅ No data ever leaves the browser
- ✅ No account required
- ✅ Fully offline-capable after initial load
- ✅ No telemetry or analytics
- ✅ Open source (implied)

**Comparison:**
- Dolphin/OnyxCeph/AudaxCeph/NemoCeph/LabCeph: local install, data on premise — good for HIPAA
- WebCeph/CephX/Ceppro: cloud-based — data stored on vendor servers
- BCeph: also local, same privacy model
- Romexis: hybrid (local install with optional cloud)

**Verdict:** Cephalometry Studio and BCeph have the strongest privacy postures — fully local with zero telemetry. This is a major selling point for institutions with strict data governance (GDPR, HIPAA).

### 3.14 3D / CBCT

**Cephalometry Studio:** ❌ No 3D support at all.

**Comparison:**
- Dolphin: full 3D CBCT with airway, TMJ, surgical planning
- OnyxCeph: 3D module available
- NemoCeph: 3D cephalometry (NemoFAB|Ortho module)
- Romexis: full 3D cephalometry with TFA Perrotti analysis, orthognathic surgery analysis
- CephX: 2D ceph from CBCT via patent-pending algorithm
- WebCeph/BCeph/AudaxCeph/LabCeph: 2D only

**Verdict:** Significant gap for users needing 3D. Acceptable for the 2D-only target market.

### 3.15 Treatment Simulation & VTO

**Cephalometry Studio:** ❌ None.

**Comparison:**
- Dolphin: full VTO, surgical simulation, morphing
- NemoCeph: VTO/STO/morphing with soft tissue prediction
- Romexis: VTO with prediction image
- AudaxCeph: VTO/STO with treatment simulation
- WebCeph: VTO/STO simulation
- OnyxCeph: VTO available
- LabCeph 5.0: VTO introduced
- Ceppro: real-time treatment simulation
- BCeph/CephX: no VTO

**Verdict:** Outside scope for a research-focused tool. Clinical competitors dominate here.

### 3.16 Pricing Model

| Software                | Annual Cost (1 seat)  | Cost per Analysis (est.) | Lock-in                        |
| ----------------------- | --------------------- | ------------------------ | ------------------------------ |
| **Cephalometry Studio** | **$0**                | **$0**                   | **None (open format)**         |
| BCeph                   | $0                    | $0                       | None                           |
| LabCeph Free            | $0                    | $0                       | None                           |
| WebCeph                 | $0–240                | $0–1.50                  | Cloud                          |
| AudaxCeph               | $500 once             | ~$0.50                   | Desktop                        |
| OnyxCeph                | $200–6,600            | ~$0.20–6.00              | Desktop                        |
| LightningCeph           | ~$50–100 (shareware)  | ~$0.05–0.10              | Desktop                        |
| Dolphin                 | $1,000–2,000          | ~$1.00–2.00              | Desktop + ecosystem            |
| CephX                   | $948–2,388            | ~$0.80–2.00              | Cloud                          |
| NemoCeph                | Custom ($2,000–5,000) | —                        | Desktop + NemoStudio ecosystem |
| Planmeca Romexis        | Custom ($3,000+)      | —                        | Hardware bundle                |
| Ceppro                  | Subscription          | Per-case                 | Cloud                          |
| 3Shape                  | Custom ($3,000+)      | —                        | Hardware bundle                |

**Verdict:** Cephalometry Studio, BCeph, and LabCeph Free are the only free options. Cephalometry Studio offers drastically more features than both.

---

## 4. Strengths & Gaps

### Cephalometry Studio Strengths

1. **Built-in Research Engine** — Unmatched. 6 integrated modules (Reliability, Descriptive, Comparative, Longitudinal, Correlation, Diagnostic) with guided data collection, MANOVA, LMM, ROC analysis, and golden-value regression tests. No competitor offers anything comparable.

2. **Custom Formula Engine** — One of the few tools (alongside AudaxCeph) that lets users define their own cephalometric indices. Combined with KaTeX rendering, this is a powerful research enabler.

3. **Multi-Patient Database Analytics** — Outlier detection, correlation matrices, regression, histograms, confidence intervals. Features normally requiring SPSS or R, built directly into the tracing workflow.

4. **Clinical Interpretation Engine** — 100+ rule-based engine covering 11 diagnostic categories. More comprehensive than any competitor's auto-interpretation feature.

5. **Data Privacy** — Fully local, no server, no account, no telemetry. Stronger than any cloud-based competitor. Tied with BCeph for strongest privacy posture.

6. **Breadth of Analyses** — 40+ analysis templates across 8 projections. More than WebCeph (20+), BCeph (9+), LabCeph (19+), or Romexis (20+). Comparable to AudaxCeph and NemoCeph.

7. **Pricing** — Free with no feature gating. BCeph is comparable but has 9+ analyses vs. Cephalometry Studio's 40+ and none of the statistical features.

8. **Extensible via CSV** — Analysis templates can be customized by editing CSV files, enabling users to define entirely new analysis frameworks. No other tool offers this.

9. **Template & Session System** — Session-based project model with subject/group/timepoint/operator metadata, filmstrip navigation, and batch import.

10. **Image Anonymization** — Irreversible patient data wipe — a feature absent in nearly all competitors.

11. **Mobile/Tablet Support** — Redesigned mobile toolbar with horizontal scroll + expandable bottom sheet, double-tap to finalize polygons/curves. One of the few browser-based tools optimized for touch.

12. **PDF Report Generation** — jsPDF-based export with measurement tables, norms comparison, and clinical interpretation. Closes the most significant export gap.

13. **Test Coverage** — 269 tests across 15 files with golden-value stat regression tests and coverage thresholds. Unique quality assurance for a medical measurement tool.

### Critical Gaps

1. **No AI Landmark Detection** — The most requested feature. Manual tracing is time-consuming and limits clinical adoption velocity.

2. **No 3D / CBCT** — Eliminates the tool from surgical planning and 3D orthodontic workflows.

3. **No Treatment Simulation / VTO** — WebCeph (free tier), NemoCeph, AudaxCeph, Dolphin, Romexis, and even LabCeph offer VTO. Absent here.

4. **No True Superimposition** — Version displacement vectors exist but no structural superimposition (Ba-N, S-N overlay).

5. **No True DICOM Parser** — UI mentions DICOM but relies on browser rendering. No tag reading, modality detection, or multi-frame support.

6. **No Collaborative / Cloud Features** — No shared workspaces, no multi-user concurrent access.

7. **No PWA/Offline Support** — No service worker for reliable offline operation; manifest exists but no cache strategies.

8. **No Multi-Language Support** — English only.

9. **No Structured Export** — No DICOM SR / FHIR / common stats formats (CSV/PDF/.cephx only).

---

## 5. Strategic Recommendations

### Near-Term (0–3 months)

1. **True DICOM Parser** — Implement basic DICOM tag reading (patient name, modality, pixel spacing) using an existing JS library (e.g., `dicom-parser`). This would fix the misleading "Supports DICOM" claim and add real value.

2. **Semi-Automated Landmarking** — Rather than full AI, implement a "landmark suggestion" system using basic image processing (edge detection + template matching) for the most reliable landmarks (Nasion, Sella, Porion, Orbitale).

3. **PWA Support** — Service worker + cache strategies for reliable offline operation. App manifest for installable experience.

### Medium-Term (3–9 months)

4. **AI Landmark Pipeline** — Integrate a TensorFlow.js or ONNX runtime model. Several open-source cephalometric models are available. Even 70% accurate auto-landmarking that the user corrects would be a major adoption driver.

5. **Superimposition Module** — Structural superimposition (Ba-N, S-N, Palatal plane) with overlay visualization. Leverage the existing session/version system.

6. **Structured Export** — DICOM SR, FHIR, or common statistical formats (SPSS .sav, R .rda) for research interoperability.

### Long-Term (9–18 months)

7. **Lightweight VTO** — Basic surgical treatment objective visualization. Focus on 2D profile prediction rather than full 3D CBCT.

8. **Research Collaboration Hub** — Shared study protocols, multi-center data aggregation (with anonymization), export to statistical formats.

### Defend the Unique Moat

The reproducibility and statistics suite is **Cephalometry Studio's uncontested advantage**. Invest in:
- More statistical outputs (meta-analysis, forest plots, funnel plots)
- Published validation studies using Cephalometry Studio's reproducibility framework
- Integration with research platforms (Open Science Framework, PubMed-compatible reporting)
- Dedicated "Research Mode" that guides users through study design to publication-ready outputs

---

*Analysis updated July 2026. Competitor feature data sourced from published comparative studies, vendor documentation, and independent reviews. Cephalometry Studio feature data extracted from source code at commit time of analysis.*
