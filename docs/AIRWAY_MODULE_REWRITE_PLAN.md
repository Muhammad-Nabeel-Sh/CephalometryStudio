# Airway Analysis Module: Audit and Rewrite Plan

**Date:** 2026-11-06, revised twice after reading the 11 papers in `Research papers/`, most recently McNamara 1984, Riley 1983, Fujioka 1979 and Mislik 2014. **Status:** Phase 0 is done (see the changelog); the remaining phases are proposed.

## 1. Summary

Your suspicion is right. The module should be rewritten, not patched. The arithmetic mostly works, but the definitions and reference values underneath it can't be relied on:

- **Reference values:** at least one norm is anatomically impossible, and PNS-AD1's norm (15 mm) is far from what recent samples measure (about 20–26 mm).
- **Definitions:** the same landmark pair has up to three names and three norms, and some "widths" join two points on the same wall.
- **Stability:** on a test case, clicking "Generate Smooth Airway Boundaries" changed one airway width from 20.6 mm to 11.0 mm with no landmark moved.
- **Clinical claims:** the "OSA Risk Score" is a formula with no validation behind it, and it can say "multiple measurements" when only one is out of range.
- **No agreed method:** the papers define the same abbreviations differently, so a norm is only usable with the exact construction its paper used (§3.8). This is the main constraint on the rewrite.

**Recommendation:**

1. Ship a small safety fix: hide the risk score and the z-scores we can't trust (§5, Phase 0; done).
2. Rebuild around a small set of published measurements, each traceable to a source page, measured on traced airway walls (§4).

Estimated effort is **5–7 weeks of development, plus your time as the clinical reviewer** (§5). The papers now cover every age from infancy for the adenoid ratio, ages 6–17 for airway widths, and adults, though Mislik warns that individual variation makes any airway reference questionable (§3.9, §4.2).

## 2. What exists today

| Area | Where | Role |
|---|---|---|
| Engine | `src/research/airway.js` (974 lines) | 16 measurements, norms, boundary tracing, risk score |
| Panel | `src/panels/AirwayPanel.jsx` | Landmark grid, risk card, measurement list |
| Template | `Data/Airway.csv` | 22 landmarks and about 20 **different** measurements |
| Overlay | `drawAirwayOverlay` in `src/canvas/drawMarkups.js` | Recomputes its own widths and z-scores |
| Norms | `src/data/norms.js` (two tables), `AIRWAY_NORMS_STRATIFIED` in `airway.js`, `Airway.csv`, `AIRWAY_NORMS` in `src/data/constants.js` (no importers found) | Five overlapping sources |
| Study type | `AirwayStudyPanel.jsx`, `research/engine.js` | Reruns the panel for **one session**; no group statistics |
| Other users | `reportGenerator.js`, `studyReport.js`, `resultsExport.js`, `interpretation.js`, `PanelGuideModal.jsx` | Reports, exports and wording |

## 3. Audit findings

**How these were checked.** "Reproduced" means I ran the current code on a synthetic adult case at 10 px/mm, using a temporary test that has since been deleted. The coordinates are plausible but not from a real film, so trust the behaviour rather than each absolute value. "Code" means read directly from the source. Literature findings are in §3.7–3.9.

### 3.1 Critical: results that are wrong or misleading

| # | Finding | Evidence |
|---|---|---|
| A1 | **N-PH norm is anatomically impossible.** Nasion to the posterior pharyngeal wall spans most of the head, but the norm is 24.3 ± 3.6 mm. | Reproduced: 73.4 mm, **z = +13.6**, shown as "Wider than average". A normal patient can never be normal. |
| A2 | **Upper and lower airway norms misuse McNamara.** R-PAS uses 11.2 ± 2.4 mm, labelled McNamara 1984. His adult upper pharynx is **17.4 mm** (SD 3.4–4.3), so a well-balanced adult would read about z = +2.6. The app's age and sex tables aren't in his paper. His lower pharynx (11.3 and 13.5 mm) does roughly match the app's 12.5. | McNamara 1984, Table I. **This reverses my previous revision**, which wrongly said not to use his values because I had only seen a summary. They are valid for adults measured his way (§3.8). |
| A3 | **Generating boundaries changes the results.** The button adds curves, and those curves silently replace the landmark measurements. | Reproduced, same landmarks: R-PAS 16.2 → 14.0 mm; **R-RG 20.6 → 11.0 mm**, which moves it from "Wider than average" to "Normal". |
| A4 | **The anterior boundary runs to the tongue tip.** Its order is PNS → SP → Vallecula → Epiglottis → **TT**, leaving the airway and crossing the mouth. Vallecula also comes before the epiglottis tip, which normally lies above it. | Reproduced: the generated wall ends at TT. |
| A5 | **The OSA Risk Score isn't validated.** It averages correlated z-scores against thresholds with no source, on the flawed norms above. A lateral cephalogram can't establish OSA. In Riley 1983, OSA patients without mandibular deficiency had a posterior airway space of 9–13 mm, the same as controls, so a normal film can't rule it out. | One z above 2.5 gives "high", with text saying "multiple measurements". Reproduced: the mean direction was −2.3 (airway larger than the norm), yet the result was "high". |
| A6 | **Min-CSA isn't measurable and usually doesn't compute.** It assumes a circular airway from one front-to-back width, but a sagittal film has no side-to-side information. The norm of 95 is simply that formula applied to about 11 mm, so it validates nothing. | Reproduced: with every landmark placed, the value is `null` and it says "Missing landmarks". The y-range uses the wrong array ends (`airway.js:786-787`). |
| A7 | **"Abnormal" flags almost everyone.** The panel calls any \|z\| > 1 abnormal. About 32% of a healthy population is outside ±1 SD on each measure. | With 14 independent measures, about **99.5%** of healthy people would have at least one flag (they are correlated, so the true figure differs). |
| A8 | **Pharyngeal area has no defined region.** The norm of 380 mm² contradicts the app's regional norms, which add up to 800 mm² (250 + 350 + 200). One paper reports 336 ± 86 mm², so 380 isn't absurd, but that paper's region differs from the app's, and area depends entirely on the region chosen. | Code plus Abdulhameed 2024. Reproduced: 1258 mm², z = +6.8, on a synthetic case with wide walls. |
| A9 | **PNS-AD1's norm is far too low.** The app used 15 ± 3 mm. Spanish children average 23.3 ± 3.6 mm, a Vietnamese Class II sample 22.9 ± 2.8 mm, and Italian adults 17.3–21.1 mm. A typical 10-year-old would read about z = +3. PNS-AD2 has a smaller gap (18 ± 4 vs 20.4 ± 3.5 mm). | Pérez-Rodríguez 2021, Nguyen 2025, Sfondrini 2024. **Fixed in Phase 0** by withholding both. |
| A11 | **Citations are false where we can check them.** McNamara 1984 has no R-PAS of 11.2, no age or sex tables, and no "Oropharyngeal Depth". Riley 1983 reports no airway area, so "Pharyngeal Area: Riley 1983" has no basis there. Fujioka's real ratio uses different landmarks from the app's. | Original papers. Solow, Schulhof, Lowe, Bibby, Pracharktam and Battagel remain unchecked. |
| A12 | **The lower airway warning pointed the wrong way.** The app warned about R-RG < 5 mm. McNamara says a small lower pharynx "is not remarkable", while **more than 15 mm** suggests a forward tongue or enlarged tonsils. | McNamara 1984. The warning was removed in Phase 0. |
| A10 | **An airway page appeared on non-airway cases.** A Steiner case with AI landmarks got an "Airway assessment" page holding only Mandibular Body Length, because Go and Me were placed. | Your `Case_001` report, page 6. **Fixed in Phase 0.** |

### 3.2 Definitions that disagree or don't make sense

The same two points have different names and norms, and which one you see depends on the screen:

| Points | Engine (panel, study, report) | Template (`Airway.csv`) | Other |
|---|---|---|---|
| SP–Ad3 | R-PAS 11.2 ± 2.4 | Minimum PAS 10 ± 3; McUP 10 ± 3 | |
| SP_mid–Ad3 | SP-AW 8.5 ± 1.8 | SP_mid width 12 ± 4 | |
| PNS–Eb | Oropharyngeal Depth 65 ± 10 | Eb-PNS 65 ± 10; Vertical Airway Length 70 ± 10 | |
| Eb–PAS_lowest | R-RG 12.5 ± 2.8 | McLP 11 ± 4 | |
| Vallecula–Ad4 | MAS 9.8 ± 2.5 | Vallecula-Ad4 20 ± 5 | `constants.js`: MAS 15 ± 4 |
| IAS | Epiglottis–PAS_lowest, 11.6 ± 3 | Eb–Ad4, 12 ± 4 | Overlay: Epiglottis–Ad4 |

Other definition problems:

- **Ad2 has three definitions:** at the So level (`Airway.csv`), perpendicular to PNS-Ba (engine note), and along Ba-N (norm note).
- **SP-AW's norm may be the wrong measure.** 8.5 ± 1.8 is identical to "Soft Palate Thickness" in `norms.js`, so it looks copied. Reproduced: 24.3 mm, z = +8.8.
- **Some "widths" don't cross the airway.** LP width joins LP and Ad4, which are both defined on the back wall. SP-Ad2 joins the palate tip to a high nasopharyngeal point, yet is called retropalatal depth.
- **Notes describe measurements that aren't computed.** MAS is described at a PNS-Pog' midpoint level and IAS at a C3-RGN level, but neither construction exists in the code.
- **"Vertical" distances aren't vertical.** Vertical Airway Length and Hyoid-C3 are straight-line distances.
- **PAS_lowest isn't lowest.** It sits at the epiglottis tip, above Ad4 at the vallecula.

### 3.3 Norm handling

| # | Finding | Evidence |
|---|---|---|
| N1 | **Sources can't be traced.** Age- and sex-stratified tables are attributed to papers such as McNamara 1984 with regular-looking values. They rise smoothly with age and differ by sex, while Pérez-Rodríguez 2021 found no significant sex difference. They may have been invented. | Must be checked against originals. All removed in Phase 0. |
| N2 | **Children can be compared with adult norms.** Tables start at age 8, then fall back to adult values with no notice. | Reproduced: a 5-year-old gets 11.2 ± 2.4, the same as the fallback used for adults. A 12-year-old of unknown sex also gets the adult norm. |
| N3 | **Ethnicity is applied by accident.** Every 18–39-year-old gets Hong Kong Chinese tongue norms. At 40 this switches to Caucasian Canadian. | Reproduced: male, 25: 72.0 ± 4.1; male, 45: 76.9 ± 5.6. |
| N4 | **Protocol is ignored.** Norms are used regardless of head position, magnification or how the landmark was defined. | Code. The magnification note is generic text. |
| N5 | **Evidence is overstated.** Clinical thresholds such as R-PAS < 5 mm being a "strong OSA screening indicator" have no citation. The study report says "age- and sex-specific reference values" even when it fell back to adult norms. It also flags only z < −2, so a high MP-H is never flagged. | Code. |

### 3.4 Measurement geometry

| # | Finding | Evidence |
|---|---|---|
| G1 | **Curves are sorted by image height.** The tongue base and epiglottis can double back, so sorting scrambles them. | Code: `sampleBoundaryAtY`, `traceAirwayBoundary`. |
| G2 | **Narrowest width ignores anatomy.** It tests all point pairs inside a height band, so it can connect structures across regions. | Code: `findNarrowestPoint`. |
| G3 | **Head tilt affects results.** Levels are horizontal image rows, not anatomical planes. | Reproduced at 15° rotation: R-PAS 16.2 → 16.4 mm. Small here, but no measure should vary at all. |
| G4 | **Walls are chosen by label text.** A curve named "Anterior pharyngeal wall" matches "pharyngeal" and is treated as the back wall. | Reproduced: boundaries then return `null`. |
| G5 | **Name collisions change results.** A line named "PNS" replaces the PNS point. | Reproduced: SP-Length 32.8 → 190.6 mm. |
| G6 | **Edge snapping can pick the wrong edge.** It takes the largest brightness change within 15 px in any direction, so a bone edge is as attractive as the air boundary. | Code: `autoSnapBoundary`. |
| G7 | **The `placed` flag isn't checked.** Normal unplaced points are filtered by their placeholder coordinates, but a point with real coordinates and `placed: false` still counts. | Reproduced with an artificial point; low risk in current flows. |

### 3.5 Interface and documentation

- R-PAS is labelled a core measurement but needs Ad3, an advanced landmark, so "core complete" can't produce it.
- The panel promises 9 advanced measurements and the guide says 14 total, but the engine has 11 advanced and 16 total.
- The guide says to click a landmark name to place it, but the grid items have no click action.
- Landmark names (Ad3, SP_mid, PAS_lowest) are in-house labels with no published equivalent that I could trace, so users can't check them against the literature.
- There's no guidance on acceptable films, such as head position, tongue position or swallowing.
- Tests mostly lock in current behaviour. For example, one asserts that N-PH equals its distance and another that R-PAS < 5 mm triggers the note. None tests a norm's plausibility or that results stay stable.

### 3.6 Study module

The "Airway study" is one session's table, not a study. It has no groups, no reliability analysis and no way to pass measures to the Descriptive, Comparative or Longitudinal modules. That's a poor fit for what the app is best at.

### 3.7 The papers in `Research papers/`

The 11 papers you provided were read from extracted text. Anything else is marked as unconfirmed.

| Paper | Sample | What it adds | Cautions |
|---|---|---|---|
| **Major 2006**, systematic review, AJODO | 11 studies, children and adolescents | Cephalograms assess **adenoid size** reasonably (r = 0.60–0.88, best for area), but are **poor for nasopharynx size**. McNamara's line was the one consistently useful nasopharyngeal linear measure (r = 0.66–0.67). Fujioka's ratio scored r = 0.11 against endoscopy in one study. Best use: screening for ENT follow-up, looking for **several** deviant measures. | "No conclusive evidence". Weak gold standards, little blinding, age rarely handled. Not about adults or OSA. |
| **Pérez-Rodríguez 2021**, J Clin Exp Dent | 480 Spanish children, aged 6, 8, 10, 12; Class I and II, untreated | **Best child reference available here**: McNamara upper and lower pharynx, PNS-Ad1, Ad1-Ba, PNS-Ba, Ptm-Ba, PNS-H by age, sex and class. Upper airway grows with age; lower doesn't. Sex and class differences weren't significant. | Orthodontic patients; breathing not assessed. No Class III. Table errors to check: boys' PNS-Ad1 equals the total mean; a Class II PNS-Ba SD of 27.86. Magnification not stated. |
| **Sfondrini 2024**, Dent J | 120 Italian adults, 18–50, untreated, natural head position; 40 per class | **Best adult reference here**, with clear definitions: NL, PD, SPAS, MAS, PAS min, IAS, LPW, PL, PT, MPH. ICC 0.92–0.93 within and 0.91 between raters. | Only by class, not pooled. Consultation patients. One implausible outlier (NL 27.3 ± 37.29). Magnification not stated. |
| **Uslu-Akcam 2025**, J Clin Pediatr Dent | 70 Turkish adolescents, mean age 14.4 | A digital app matched manual tracing for McNamara upper (ICC 0.926) and lower pharynx (ICC 0.949), with mean differences of about 0.25 mm. **A benchmark for our validation.** | A method study from pretreatment patients, not a norm. Its lower pharynx (8.37 ± 2.35 mm) is well below other samples. |
| **Nguyen 2025**, J Orthod Sci | 106 Vietnamese patients, 14–25, Class II | Linear widths against CBCT volume: **r at most 0.59**. The abstract says "strong"; that is moderate, and the paper's conclusion overreaches. | Class II only, so unsuitable as a general norm. |
| **Abdulhameed 2024**, Cureus | 70 adults, mean age 22.9 | 2D area against CBCT volume, r = 0.83. Area 336 ± 86 mm² (men 370 ± 61, women 302 ± 88). | Correlation isn't agreement. Volume (3.4 cm³) is far below Nguyen's (26 cm³), so regions differ. An unrelated 2015 paper in my earlier search reported the same r = 0.831; worth checking. |
| **Meisgeier 2024**, J Clin Med | 100 non-OSAS adults before orthognathic surgery | Sagittal widths predicted narrow 3D airway (minimal area < 80 mm²): AUC 0.86–0.88, r about 0.7. Upper cut-offs: SPAS 12.5, MPAS 10.2, IPAS 13.5 mm. Airway shape depends on posture, tongue and breathing phase. Authors say incomplete landmark definitions make data **"methodologically impossible" to combine**. | **Measured on supine CT reconstructions, not upright films**, so the cut-offs don't transfer. Not an OSA sample. |

**What this changes:**

- **Lateral films do carry some information.** Widths and areas relate moderately to 3D size. Reports should say that without implying a volume, and Min-CSA stays removed.
- **The clinical message is about adenoids and screening, not sleep apnea.** No paper here validates diagnosing OSA from a film. Meisgeier states polysomnography is the gold standard.
- **Add an adenoid area measure,** since area outperformed linear measures in Major.
- **Show patterns, not single flags,** following Major's advice to look for several deviant measures.
- **Sex matters less than the old tables implied.** Pérez-Rodríguez found no significant sex difference in children. Sfondrini found sex effects on MAS, IAS and PAS min in adults, with small R² (0.03–0.06).

**The four original papers:**

| Paper | Sample | What it adds | Cautions |
|---|---|---|---|
| **McNamara 1984**, Am J Orthod | 111 adults with well-balanced faces and Class I occlusion (Ann Arbor), mean age about 27–31; 8% enlargement | Defines upper and lower pharynx. Adults: upper 17.4 ± 3.4 (women), 17.4 ± 4.3 (men); lower 11.3 ± 3.3 (women), 13.5 ± 4.3 (men). Upper ≤ 5 mm is "only an indicator" for ENT evaluation. Lower > 15 mm suggests a forward tongue or enlarged tonsils. | Selected for good faces, not representative. **The ≤ 5 mm cue has weak support:** against nasal resistance, Major reports sensitivity 0.32 and specificity 0.83. Column order inferred from the table; check the PDF. |
| **Mislik 2014**, Eur J Orthod | 880 healthy untreated Swiss schoolchildren, 6–17, randomly selected; 7.5% magnification; head stabilized, no swallowing | **Best sample for ages 6–17:** "p" (shortest soft palate to wall) and "t" (shortest tongue to wall), with median and IQR by age and sex. Minimal age effect and no real sex effect. ICC about 0.93–0.95. | **Its main conclusion is that high individual variation makes a mean reference questionable.** Values aren't normally distributed, so z-scores don't fit. Few children at ages 6 and 7 (11 and 21). Breathing problems weren't excluded. Tables 2–3 conflict with Tables 4–5 at several ages; 4–5 agree with the overall means. |
| **Fujioka 1979**, AJR | 1,398 children, 1 month to 16 years | Defines the A/N ratio, with means and SDs by age. Peak 0.59 at 4.5 years, 0.38 at 15.5. No sex difference. Above 0.80 suggests enlarged adenoids (34 of 36 judged enlarged). **A ratio doesn't depend on magnification.** | Children referred for imaging, so not random. Validated against experts viewing the same films. Major records r = 0.11 against endoscopy in one study. |
| **Riley 1983**, Sleep | 10 OSA patients and **5 control men** with cephalograms | PAS on the B-Go line, 11 ± 1 mm; PNS-P 37 ± 3 mm; MP-H 15.4 ± 3 mm. Natural head position, upright, teeth together. | **Too small for a norm.** The stated SDs don't match its own five controls (PAS about 1.7, MP-H about 4.7, from the table). All men. |

**What these change:**

- **McNamara's values are usable for adults,** using his exact method: the upper measurement is taken on the **anterior half** of the soft palate outline.
- **Distinct measurements have been conflated.** McNamara's upper pharynx (17.4 mm in adults), Mislik's shortest palate-to-wall distance (about 9 mm in children), and SPAS (about 12 mm in adults) aren't interchangeable. This probably explains much of the spread I saw earlier. Pérez-Rodríguez and Uslu-Akcam cite McNamara but leave out "anterior half", so their values may not match his method.
- **Reference presentation has to change.** Following Mislik, airway widths get a typical range (median and IQR, or percentiles) rather than a z-score, and no value is called abnormal for falling outside it.
- **Riley's values stay out of the norm table.** Its finding about OSA without mandibular deficiency is the part worth keeping.
- **Swallowing check:** McNamara says an inverted-V soft palate means the film was taken during swallowing, which limits the upper measurement. This goes in the film check.

**Still not read:** Linder-Aronson & Henrikson 1973. It no longer blocks anything, because Pérez-Rodríguez defines its nasopharyngeal measures fully. The other sources cited in the old code (Solow, Schulhof, Lowe, Bibby, Pracharktam, Battagel, Samman) aren't needed, because none of their values is planned for the rewrite. The exception is that MP-H and SP-Length still show z-scores from Bibby and Lowe until Phase 2 replaces them. Sfondrini's adult values for the same measures are close.

### 3.8 The same names mean different things

This is the strongest finding, and the app's current definitions match none of these exactly:

| Name | Sfondrini 2024 | Nguyen 2025 | Meisgeier 2024 | Pérez-Rodríguez 2021 |
|---|---|---|---|---|
| **SPAS** | Mid soft palate, perpendicular to nearest wall point | Behind soft palate, parallel to palatal plane | Midway between uvula tip and PNS, parallel to B-Go | |
| **MAS / MPAS** | "Mean": uvula tip to its wall projection | "Middle": through uvula tip, parallel to palatal plane | At uvula tip, parallel to B-Go | |
| **IAS / IPAS** | Epiglottis top, nearest perpendicular wall point | Through epiglottis tip, parallel to palatal plane | **On the B-Go line** | |
| **PNS-Ad1** | NL: PNS to **posterior wall** on PNS-Ba | PNS-AD1: airway width on PNS-Ba | | PNS to **adenoid tissue** on PNS-Ba |
| **Upper nasopharynx** | PD: PNS to wall, parallel to bispinal plane | PNS-AD2: along a "PNS-R" line | | PNS-H: PNS to hormion, perpendicular to S-Ba |
| **Lower pharynx** | PAS min: tongue base on the Go-B line to wall (same line as Riley's PAS) | | | McNamara: tongue/mandible intersection to nearest wall (same in Uslu-Akcam) |
| **Upper pharynx** | | | | "Posterior wall of the soft palate" to closest wall. **McNamara adds: on the anterior half of the outline.** Mislik's "p": shortest distance anywhere |

**Consequence for the design:** a measurement in the registry isn't "SPAS". It is "SPAS (Sfondrini 2024)", with one construction, and only that paper's reference applies. Hormion also shares the label "H" with the hyoid in this app, so landmark labels must be namespaced.

### 3.9 How the app's old values compare

Means in mm. Samples and definitions differ between columns, so this is a plausibility check, not a validation.

| App measure | Old norm | Children and adolescents | Adults | Verdict |
|---|---|---|---|---|
| R-PAS / upper pharynx | 11.2 ± 2.4 | "p": 8.1 at 6 → 9.2 at 17 (Mislik). Upper airway: 7.5 at 6 → 11.4 at 12 (Pérez-Rodríguez). 10.1 ± 2.6 at about 14 (Uslu-Akcam) | **McNamara 17.4 ± 3.4–4.3.** SPAS 11.3–12.6 (Sfondrini, other method) | Fits no source's method; replace by method and age |
| R-RG / lower pharynx | 12.5 ± 2.8 | "t": 9.3–11.2, no clear age trend (Mislik). 11.6 ± 2.6 (Pérez-Rodríguez). 8.4 ± 2.4 (Uslu-Akcam) | McNamara 11.3 and 13.5. PAS min 11.1–11.4 (Sfondrini) | Close to McNamara's adults; too high for children |
| PNS-AD1 | 15 ± 3 | 23.3 ± 3.6 (19.6 at 6 → 26.2 at 12, Pérez-Rodríguez). 22.9 ± 2.8 (Nguyen, 14–25) | NL 17.3–21.1 (Sfondrini) | **Too low** |
| PNS-AD2 | 18 ± 4 | PNS-H 30.0 ± 2.6 (other construction). 20.4 ± 3.5 (Nguyen) | PD 18.4–22.0 (other construction) | Definition unclear |
| MAS | 9.8 ± 2.5 | 10.6 ± 2.6 (Nguyen) | 9.0–10.2 (Sfondrini) | Plausible for Sfondrini's definition |
| IAS | 11.6 ± 3.0 | 11.0 ± 3.0 (Nguyen) | 10.3–11.0 (Sfondrini) | Plausible; definition varies |
| SP-AW | 8.5 ± 1.8 | | PT (thickness) 9.4–9.7 (Sfondrini) | **A thickness value, not an airway width** |
| Soft palate length | 32.4 ± 3.2 | | PL 30.9–33.3, SD 4.3–5.8 (Sfondrini). 37 ± 3 (Riley, 5 men) | Plausible; SD too narrow |
| MP-H | 12.3 ± 3.5 | | MPH 12.8–14.6, SD 4.2–5.3 (Sfondrini). 15.4 ± 3 (Riley, 5 men) | Plausible; SD too narrow |
| N-PH | 24.3 ± 3.6 | | | No support in any paper |
| A/N ratio (app's) | none | Real Fujioka ratio: 0.33 at 1.5 months, peak 0.59 at 4.5 years, 0.38 at 15.5 | | App's ratio is a different measure; replace |

## 4. The new design

### 4.1 Rules

1. **No number without a source.** Every norm records citation, page or table, population, age range, sex, sample size, head position and magnification handling. Without a checked source, the app shows the measurement but no z-score.
2. **One definition per measurement.** A single registry drives the panel, overlay, template, report, exports and research modules. Nothing recomputes its own version.
3. **Describe, don't diagnose.** Results read as "smaller than the reference group". There's no risk score, and no wording suggesting OSA can be established from this film.
4. **Results don't change by surprise.** Each value states how it was measured. A new wall never replaces a value silently.
5. **Measurements follow anatomy.** They're computed from planes and wall curves, and rotation, translation or mirroring leaves them unchanged.
6. **Norms must fit the patient.** No suitable reference group means no z-score, and the app says why. Children never fall back to adult values, and ethnicity is never assumed.

### 4.2 Proposed measurements

Final inclusion depends on Phase 1 confirming each source.

| Region | Measure | Construction | Status |
|---|---|---|---|
The measures shown depend on the patient's age, so a user sees one coherent set rather than several versions of "airway width":

| Age | Region | Measure | Construction | Reference |
|---|---|---|---|---|
| **1 month–16 years** | Adenoid | **A/N ratio (Fujioka)** | Adenoid convexity to basiocciput line ÷ PNS to sphenobasioccipital synchondrosis | Fujioka by age. Unaffected by magnification. Above 0.80: suggests enlarged adenoids |
| **6–17** | Retropalatal | **"p" (Mislik)** | Shortest soft palate to back wall | Median and IQR by age and sex |
| **6–17** | Retroglossal | **"t" (Mislik)** | Shortest tongue to back wall | Median and IQR by age and sex |
| **6–12** | Nasopharynx | PNS-Ad1, Ad1-Ba, PNS-Ba, Ptm-Ba, PNS-H | Pérez-Rodríguez's definitions | Mean ± SD by age |
| **Children** | Adenoid | Adenoid area | Soft tissue area with a stated boundary | None; value only. Best-supported adenoid measure (Major) |
| **Adults** | Retropalatal | **Upper pharynx (McNamara)** | Anterior half of soft palate outline to nearest back-wall point | McNamara by sex; well-balanced faces, 8% enlargement |
| **Adults** | Retroglossal | **Lower pharynx (McNamara)** | Tongue/lower mandible border to nearest back-wall point | McNamara by sex |
| **Adults** | Oropharynx | SPAS, MAS, PAS min | Sfondrini's constructions | Sfondrini by skeletal class |
| **Adults** | Hypopharynx | IAS, LPW | Sfondrini's constructions | Sfondrini by skeletal class |
| **Adults** | Soft palate | PL, PT | Sfondrini's constructions | Sfondrini by skeletal class |
| **Adults** | Hyoid | MPH | Hyoid to mandibular plane (Go-Gn) | Sfondrini by skeletal class. Its text defines H1 two ways; settle before use |
| **Any** | Areas | Regional areas | Between traced walls and stated planes | None until one matches the construction |

**How each reference is shown:**

- **Airway widths in children ("p", "t"):** "typical range" from Mislik, stating that individual variation is high. No z-score, no flag.
- **Other measures:** z-score only where the paper gives mean and SD and its distribution is plausibly normal. Note that the sample is defined narrowly where that applies (McNamara: well-balanced faces).
- **Skeletal class:** Sfondrini's adult references need the patient's class, from ANB as that paper defines it. Keep the class values separate and show which group was used.
- **Population:** every comparison names its sample ("880 Swiss schoolchildren, 1981–84"). These samples don't represent all populations, and the app never infers ethnicity.

**Magnification:** norms include their film's enlargement (McNamara 8%, Mislik 7.5%). If a film is calibrated at the midsagittal plane, its mm values exclude that enlargement, so at McNamara's 17.4 mm the mismatch is about 1.3 mm. Each reference stores its factor, and each comparison shows whether it matches the film's calibration. See decision 8.

**Remaining gaps:** children under 6 have only the A/N ratio. Ages 13–17 have "p", "t" and the A/N ratio only. Sex-specific tables come from the paper as printed, including its small groups at ages 6 and 7, which get a warning.

**Removed:**

| Measurement | Why |
|---|---|
| N-PH | Impossible norm; no support in any paper |
| Min-CSA | Not measurable from a sagittal film |
| OSA Risk Score | Not validated |
| SP-AW, LP width | Incoherent as built, and SP-AW's norm is a thickness value |
| Current MAS, IAS, SPAS, R-PAS, R-RG | Replaced by the constructions above |
| App's "Adenoid/Nasopharynx Ratio" | Not Fujioka's ratio; replaced by it |
| Vertical Airway Length, Eb-PNS, Oropharyngeal Depth | Duplicates |
| Mandibular Body | Available from other analyses. Meisgeier links GoGn to airway size weakly (AUC 0.63), so it isn't an airway result |
| Tongue Length, Hyoid-C3 | Return only with a confirmed definition and norm |

### 4.3 Tracing workflow

Steps run in order, and each can be completed on its own:

1. **Check the film:** record posture (upright or supine), head position, teeth and lips, tongue, swallowing or breathing instructions, calibration and magnification. Unknown is allowed, and is reported. McNamara, Mislik, Riley, Sfondrini, Nguyen and Meisgeier all treat these as affecting results, and supine data can't be compared with upright norms. Include McNamara's check: an inverted-V soft palate suggests swallowing during exposure.
2. **Bony references:** reuse existing points. AI Trace already provides S, N, PNS, Go, Me and B. Add Ba and, for the A/N ratio, the basiocciput line and sphenobasioccipital synchondrosis, with Fujioka's fallback when the synchondrosis isn't clear.
3. **Trace three walls:** back wall, soft palate outline and tongue base, each as a named curve placed by the user. Curves stay in the order they were drawn, never sorted by height.
4. **Soft tissue and hyoid points:** uvula tip, epiglottis tip, vallecula, hyoid.
5. **Review:** measurement lines are drawn on the film, so each value can be checked by eye.

Most points that today need manual placement (Ad1–Ad4, PAS_lowest) become **calculated** from the planes and curves. That means less clicking and less disagreement between users.

### 4.4 Edge-assisted tracing

- Search along each curve's normal rather than in every direction, looking for the expected dark-air to bright-tissue edge.
- Show suggested curves as a preview the user accepts or edits. Nothing changes until accepted.
- Keep it optional. No airway landmarks or contours exist in the AI model today, so a learned model stays a later project that would need labelled data.

### 4.5 Results display

- Group by region, with a compact range strip showing the value against the reference group and the group named.
- Use three states: *within reference range* (±2 SD), *outside reference range*, or *no suitable reference*. Don't use "abnormal" or red for a single 1 SD difference.
- For children's adenoid and nasopharynx measures, summarize patterns: "3 of 5 nasopharyngeal measures are outside the reference range. Consider ENT evaluation if there are clinical signs." This follows Major 2006. Thresholds need your approval.
- Published cues appear only as cited statements, never as verdicts: A/N above 0.80 (Fujioka), upper pharynx ≤ 5 mm "only as an indicator" and lower pharynx above 15 mm (McNamara). A value outside these cues is never described as reassuring, since sensitivity is low.
- Include a note in reports that a lateral film is 2D, and that widths relate only moderately to 3D airway size (r about 0.6–0.7 in Nguyen and Meisgeier).
- Add a "how this was measured" line with the source, and the film's protocol if it differs from the source.

### 4.6 Research integration

Remove the single-session "Airway study". Instead, register airway measures so that Descriptive, Reliability, Comparative, Longitudinal and Correlation studies can select them like any other. A preset could add airway reliability to a study, which is more useful for theses and papers than a single table.

### 4.7 Code structure

```
src/airway/
  definitions.js    Registry: landmarks, measures, constructions, display text
  geometry.js       Pure: planes, curve distance, areas (no labels, no React)
  compute.js        Registry + markups + patient → results with provenance
  norms.js          Checked norms only, each with full source metadata
  normLookup.js     Picks a matching reference group, or explains why not
  migrate.js        Reads older sessions and templates
src/panels/airway/  Workflow steps, results and film-quality check
```

The overlay only draws `compute.js` output. Markups link by `templateId`, so a line that shares a name can't replace a landmark (G5). `Data/Airway.csv` becomes generated from, or replaced by, the registry. `research/airway.js` and the extra norm tables are deleted at the end.

### 4.8 Existing data

- **Nothing is deleted.** Existing landmarks and curves stay in saved sessions and `.cephx` files.
- Mappings like Ad1 → ad1 are offered only where the old point really matches. Others stay as ordinary markups, labelled "from an older version".
- **Saved results will change.** Saved studies keep their old values, marked "calculated with the older airway method", with a clear re-run option. The changelog should state this too, since published or thesis work may have used the old numbers.

## 5. Phases

Estimates assume one developer with an AI assistant. The source review depends on your access to the papers.

| Phase | Work | Done when | Effort |
|---|---|---|---|
| **0. Safety fix (done)** | Removed the risk score, clinical notes and Min-CSA. Withheld z-scores except MP-H and SP-Length, for adults only. Generated curves no longer replace values. Added a "being revised" notice. Children never get adult norms. After reading the papers, also withheld PNS-AD1 and PNS-AD2, removed the stratified tables, and stopped Go-Me alone creating an airway report page. | Nothing misleading on screen or in reports | Done |
| **1. Source review** | Reading done (§3.7–3.9). Recheck every value with the PDFs open, including McNamara's columns and Mislik's conflicting tables, build the norm table with page numbers, and settle §8. You approve the measure list. | A signed-off norm table with page references | 1–2 days of dev + your review |
| **2. Engine** | Registry, geometry, compute, norm lookup, tests (§6) | All engine tests pass, with no UI yet | 1–1.5 weeks |
| **3. Workflow and overlay** | Film check, wall tracing, constructed points, results, overlay | A case can be traced end to end | 1.5–2 weeks |
| **4. Edge assist** | Preview-only wall suggestions | Measured against hand tracing | 3–5 days |
| **5. Integration** | Reports, exports, research modules, guides, migration, removal of old code | No references to old code; older files open | 1 week |
| **6. Validation** | Reliability study on real films (§7); fix what it reveals | Results reviewed and published in the docs | 2–3 days of dev + tracing time |

Phase 0 can ship straight away. Phases 1–3 are the core. Phase 4 can wait if needed.

## 6. Testing

- **Worked examples:** hand-calculated digital phantoms with known answers for each construction.
- **Invariance:** rotate, translate, mirror and rescale any case; each measure must stay the same in mm.
- **Plausibility:** run every measure with a norm on realistic adult and child fixtures, expecting |z| < 3. This alone would have caught A1, A8 and A9.
- **Definition match:** a norm can only attach to the construction its paper used, so SPAS (Sfondrini) can't use Meisgeier's cut-off.
- **Reference data:** every norm entry needs complete source metadata, and a test fails without it.
- **Lookup:** children never get adult norms, sex or age gaps give "no suitable reference", and ethnicity is never inferred.
- **Stability:** adding unrelated markups, or a line that shares a landmark's name, doesn't change results.
- **Consistency:** the panel, overlay, report and exports show identical values.
- **Wording:** a test fails if "OSA", "apnea" or "risk" appears in result text.
- **Migration:** old sessions open, and old studies keep their values and are flagged.

## 7. Validation

Before describing the module as validated:

- **Reliability:** two raters trace 30–50 films twice, using the blinded reliability workflow. Report ICC, Bland-Altman limits and Dahlberg error per measure. Measures with poor agreement get a warning or are dropped. **Targets from the papers:** ICC above 0.9 within and between raters (Sfondrini 0.91–0.93, Mislik about 0.93–0.95), and within about 0.25 mm of manual tracing for McNamara's measures (Uslu-Akcam: ICC 0.93–0.95). Report agreement, not only correlation.
- **Check against published values:** on a suitable sample, compare group means with the source populations. A large gap suggests a construction error.
- **Edge assist:** compare wall suggestions with hand tracing, as point-to-curve distance and as the effect on each measure.
- **Ethics:** existing public or anonymized films may be enough. New patient films may need approval.

## 8. Decisions for you

| # | Decision | My recommendation |
|---|---|---|
| 1 | Remove OSA wording entirely? | **Yes.** The papers support describing the airway and, for children's adenoids, suggesting ENT evaluation. |
| 2 | Which measures for which ages? | **The age table in §4.2:** Mislik and Fujioka for children, McNamara and Sfondrini for adults. |
| 3 | Which reference populations? | **Only those with checked sources.** Name the sample, and let users choose when more than one applies. Never infer ethnicity. |
| 4 | Keep the single-session study type? | **Replace it** with airway measures in the existing research modules. |
| 5 | Which definition of SPAS, MAS and IAS? | **Sfondrini's**, because its adult reference comes with it. You may prefer another as the clinician. |
| 6 | Show typical ranges rather than z-scores for children's "p" and "t"? | **Yes,** as Mislik's non-normal data and conclusion require. |
| 7 | Show McNamara's ≤ 5 mm, > 15 mm and Fujioka's > 0.80 as cited cues? | **Yes,** worded as his statement and with no flag colour, plus your review of the wording. |
| 8 | When a film's calibration excludes enlargement, adjust the comparison? | **Don't adjust values.** Show the mismatch next to the comparison, and record what the user's calibration means. Adjusting would hide an assumption, though you may prefer otherwise. |

## 9. Sources

**Read from extracted text (`Research papers/`, kept out of the repository):**

- Major MP, Flores-Mir C, Major PW. Assessment of lateral cephalometric diagnosis of adenoid hypertrophy and posterior upper airway obstruction: a systematic review. Am J Orthod Dentofacial Orthop 2006;130:700-8. doi:10.1016/j.ajodo.2005.05.050
- Pérez-Rodríguez LM, et al. Airways cephalometric norms from a sample of Caucasian children. J Clin Exp Dent 2021;13(9):e941-7. doi:10.4317/jced.58105
- Sfondrini MF, et al. Upper airway dimensions among different skeletal malocclusions. Dent J 2024;12:12. doi:10.3390/dj12010012
- Uslu-Akcam O, Koz S. Is the app-aided cephalometric analysis reliable in terms of airway measurements? J Clin Pediatr Dent 2025;49(6):163-171. doi:10.22514/jocpd.2025.138
- Nguyen TTN, et al. Evaluation of the pharyngeal airway dimensions measured by cephalometrics and cone beam computed tomography in patients with skeletal Class II malocclusions. J Orthodont Sci 2025;14:24. doi:10.4103/jos.jos_124_24
- Abdulhameed SA, et al. Assessing the accuracy of lateral cephalogram in quantifying three-dimensional pharyngeal airway morphology compared to CBCT. Cureus 2024;16(3):e57301. doi:10.7759/cureus.57301
- Meisgeier A, et al. Cephalometric screening assessment for superior airway space narrowing. J Clin Med 2024;13:2685. doi:10.3390/jcm13092685

- McNamara JA Jr. A method of cephalometric evaluation. Am J Orthod 1984;86(6):449-469.
- Mislik B, Hänggi MP, Signorelli L, Peltomäki TA, Patcas R. Pharyngeal airway dimensions: a cephalometric, growth-study-based analysis of physiological variations in children aged 6-17. Eur J Orthod 2014;36:331-339. doi:10.1093/ejo/cjt068
- Fujioka M, Young LW, Girdany BR. Radiographic evaluation of adenoidal size in children: adenoidal-nasopharyngeal ratio. AJR 1979;133:401-404.
- Riley R, Guilleminault C, Herran J, Powell N. Cephalometric analyses and flow-volume loops in obstructive sleep apnea patients. Sleep 1983;6(4):303-311.

Numbers in §3.7–3.9 were read from PDF text extraction. Recheck them with the PDFs open before they enter the norm table.

**Seen only as summaries or abstracts during the first version:**

- OSA and cephalometry: [Armalaite and others](https://em-consulte.com/article/1111046/resume/craniofacial-and-upper-airway-morphology-in-adult-), [Neelapu summary](https://cats.uthscsa.edu/published_cats_friendly.php?id=3104), [Finke et al. 2023](https://www.pubmed.gov/37485571/)
- Head posture: [review of posture effects](https://ejomr.org/JOMR/archives/2016/1/e1/v7n1e1ht.htm), [reproducibility on natural head position films, AJODO 2005](https://avesis.marmara.edu.tr/yayin/bb70e2a0-a097-4f14-8250-e5f4827d9837/reproducibility-of-airway-dimensions-and-tongue-and-hyoid-positions-on-lateral-cephalograms)
- [Open Dentistry Journal 2015](https://opendentistryjournal.com/VOLUME/9/PAGE/263/FULLTEXT/), [Angle Orthod 2017 systematic review](https://angle-orthodontist.kglmeridian.com/view/journals/angl/87/1/article-p159.xml)
