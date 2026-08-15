---
title: 'Cephalometry Studio: an open-source, browser-based platform for cephalometric analysis and orthodontic research'
tags:
  - cephalometry
  - orthodontics
  - medical imaging
  - statistics
  - javascript
  - visualization
authors:
  - name: "Mohamed Nabil Ibrahim Salem Shaesha"
    orcid: 0009-0004-7190-1364
    affiliation: 1
affiliations:
  - name: "Pharos University in Alexandria" 
    index: 1
date: 15 August 2026
bibliography: paper.bib

---

# Summary

Cephalometry Studio is a free, open-source web application for cephalometric
analysis — the measurement of standardized skull and facial landmarks on
lateral, frontal, and other head radiographs, which underpins diagnosis and
treatment planning in orthodontics and orthognathic surgery. It provides
manual and template-assisted landmarking with 40+ predefined analyses and over
500 landmarks, 23 markup types (points, planes, angles, polygons, splines,
Beziers, and derived measurements), a ruler-based calibration workflow with
calibration-aware unit handling, a 100-rule clinical interpretation engine, a
normogram visualization, and a normative database with age- and sex-stratified
reference values. Uniquely among cephalometric tools, it embeds a complete
statistical research suite — reliability studies (intraclass correlation
coefficients with exact confidence intervals, Bland-Altman analysis with
exact small-sample limits-of-agreement confidence intervals, Dahlberg/SEM/MDC
error estimates, and landmark error maps), descriptive and normative
statistics, comparative tests (with automatic test selection and MANOVA),
longitudinal analyses (RM-ANOVA with sphericity corrections and mixed models),
correlation and regression, diagnostic performance (ROC/AUC), and
superimposition/growth analysis — with publication-style tables, charts, and
CSV export. The entire application runs in the browser; measurements, images,
and projects are stored locally (encrypted at rest), so patient data never
leaves the user's device.

# Statement of need

Cephalometric tracing has been central to orthodontic diagnosis since
Broadbent's introduction of the cephalostat [@broadbent1931], and the
landmark-based analyses of Downs, Steiner, Ricketts, and McNamara remain
standard clinical practice today [@downs1948; @steiner1953; @ricketts1960;
@mcnamara1984]. However, landmark identification error is a well-documented
limitation: repeated tracing of the same radiograph yields measurable
disagreement between and within observers, and any study using cephalometric
measurements must quantify this error [@houston1983; @dahlberg1940;
@bland1986; @shrout1979]. Commercial platforms (Dolphin Imaging, WebCeph,
OnyxCeph) offer sophisticated tracing workflows but require paid licenses,
upload patient images to vendor servers, and provide no integrated
reproducibility statistics — researchers must export measurements to
spreadsheets and re-implement ICC, Bland-Altman, and Dahlberg analyses in
external statistical packages. Free alternatives offer only a small subset of
analyses and no research tooling.

Cephalometry Studio fills this gap: a single, freely accessible tool in which a
clinician or researcher can trace images, obtain calibrated measurements with
population-referenced norms, run the complete measurement-error and
longitudinal statistics required for scientific reporting, and export
publication-ready tables and charts — while keeping all patient data on the
local device. The integrated reliability workflow (blinded re-tracing trials
with minimum time-separation checks and trial locking) is designed to support
the methodological requirements of orthodontic research [@walter1998;
@carkeet2015].

# Functionality

![The Cephalometry Studio home screen, with project management and the analysis launcher.](screenshots/1-homepage.png){ width=90% }

Cephalometry Studio is a client-side React application (JavaScript) with a Canvas
2D tracing engine; it requires no server and can be used offline as a
progressive web app. Images are imported as PNG/JPEG (plus browser-rendered
DICOM), calibrated via a ruler or known-distance method, and traced with
point, line, angle, polygon, spline, and Bezier tools that snap to existing
landmarks. Loading an analysis template (`.cepht`) auto-creates the analysis
measurements, linked to their landmarks by immutable identifiers so that
renaming a landmark never breaks dependent measurements. A clinical
interpretation engine compares each measurement against age- and
sex-stratified norms and generates plain-language findings, visualized as a
normogram.

![Tracing workspace: landmarks, planes, and auto-generated measurements on a calibrated lateral cephalogram.](screenshots/2-canvas.png){ width=90% }

The research module operates on study designs built from sessions (subject ×
timepoint × operator): reliability studies with ICC(2,1) and exact F-based
confidence intervals, Bland-Altman plots with exact limits-of-agreement
confidence intervals [@carkeet2015], Dahlberg error, SEM, MDC, and landmark
error maps; descriptive statistics with reference intervals and z-scores;
comparative studies with automatic test selection (normality and variance
checks route to parametric or non-parametric tests), post-hoc corrections, and
MANOVA; longitudinal studies with RM-ANOVA (Mauchly's sphericity test with
Greenhouse-Geisser/Huynh-Feldt corrections) and linear mixed models;
correlation and linear/logistic regression; diagnostic studies with ROC/AUC,
confidence intervals, and calibration; and superimposition studies with
Procrustes or structural alignment, displacement analysis, and growth-pattern
classification. All results render as tables and charts and export to CSV,
PDF, or DOCX.

![Clinical interpretation engine output with normative comparison.](screenshots/4-interpretation.png){ width=90% }

Statistical implementations are guarded by a test suite of 459 automated
tests, including golden-value regression tests that check core distributions
and estimators against published reference values (e.g., Shrout-Fleiss ICC,
Bland-Altman limits of agreement), and continuous integration runs linting,
tests, and builds across Node.js versions [@shrout1979; @bland1986].

The software is intended for research and clinical decision support; as with
any 2D cephalometric tool, measurements assume a lateral projection and are
subject to magnification, and reference norms are population-specific.

# Acknowledgements

The authors declare no funding associated with this software. This work was
developed as an independent open-source project.

# References
