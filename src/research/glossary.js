// ═══════════════════════════════════════════════════════════════════════════════
// glossary.js — short explanations of the statistics shown in study results (A13)
// Grouped by study type so the results view can list the relevant terms first.
// ═══════════════════════════════════════════════════════════════════════════════

export const GLOSSARY = [
  // Reliability
  { term: "ICC (intraclass correlation)", types: ["reliability"], text: "How much of the variation between measurements comes from real differences between patients rather than from measurement error. 1 = perfect reliability. Read it from the 95% CI: below 0.5 poor, 0.5–0.75 moderate, 0.75–0.9 good, above 0.9 excellent (Koo & Li, 2016)." },
  { term: "ICC model", types: ["reliability"], text: "ICC(1) treats raters as interchangeable; ICC(2) generalises to other raters and penalises systematic differences (absolute agreement); ICC(3) ignores systematic offsets (consistency). The ‘k’ forms describe the reliability of the mean of k measurements." },
  { term: "Bland-Altman bias", types: ["reliability"], text: "The average difference between two measurement occasions, raters or methods (second minus first). A bias far from zero means one systematically measures higher." },
  { term: "Limits of agreement (LoA)", types: ["reliability"], text: "Bias ± 1.96 SD of the differences: 95% of differences between two measurements of the same patient are expected to fall within these limits." },
  { term: "Dahlberg error", types: ["reliability"], text: "The typical random error of a single measurement, √(Σd²/2n) for duplicate measurements. In the units of the measurement." },
  { term: "SEM / MDC", types: ["reliability", "longitudinal"], text: "Standard error of measurement (typical error of one measurement) and minimal detectable change (1.96·√2·SEM): a change smaller than the MDC cannot be told apart from measurement error." },
  // Comparative
  { term: "Welch’s t-test / ANOVA", types: ["comparative"], text: "Compare means between groups without assuming equal variances — the recommended default for clinical samples." },
  { term: "Games-Howell", types: ["comparative"], text: "Pairwise comparisons after Welch’s ANOVA that stay valid with unequal group sizes and variances." },
  { term: "Mann-Whitney / Kruskal-Wallis", types: ["comparative"], text: "Rank-based alternatives to the t-test / ANOVA; robust to outliers and skewed data. Kruskal-Wallis is followed by Dunn’s test." },
  { term: "Wilcoxon / Friedman", types: ["comparative"], text: "Rank-based tests for paired measurements (two conditions / three or more conditions)." },
  { term: "Sensitivity check", types: ["comparative"], text: "The same comparison with the other family of tests (rank-based vs parametric). If both agree, the conclusion does not depend on distributional assumptions." },
  { term: "Holm / Bonferroni / Benjamini-Hochberg", types: ["comparative", "correlation"], text: "Corrections for testing many measurements at once. Bonferroni and Holm control the chance of any false positive (Holm is more powerful); Benjamini-Hochberg controls the proportion of false discoveries." },
  { term: "Cohen’s d / dz", types: ["comparative"], text: "Standardised mean difference (between groups / of paired changes). Roughly 0.2 small, 0.5 medium, 0.8 large." },
  { term: "η² / partial η² / ε²", types: ["comparative", "longitudinal"], text: "Proportion of variance explained by the groups or time. Roughly .01 small, .06 medium, .14 large." },
  // Longitudinal
  { term: "Sphericity / Greenhouse-Geisser ε", types: ["longitudinal", "comparative"], text: "Repeated-measures ANOVA assumes equal variances of all pairwise differences (sphericity). ε < 1 measures the violation and shrinks the degrees of freedom to keep the test valid." },
  { term: "Linear mixed model (REML)", types: ["longitudinal"], text: "Models each patient’s own growth line around the group trajectory. Uses every visit (patients with missing visits are kept) and the real ages between visits." },
  { term: "Random slope", types: ["longitudinal"], text: "Allows growth rate to differ between patients; kept when a likelihood-ratio test shows patients really grow at different rates." },
  { term: "Satterthwaite df", types: ["longitudinal"], text: "Degrees of freedom for mixed-model tests, estimated from the data (as R’s lmerTest)." },
  // Descriptive
  { term: "Reference interval", types: ["descriptive"], text: "The range expected to contain 95% of healthy individuals’ values. Parametric (mean ± 1.96 SD) for normal data, otherwise from percentiles (needs n ≥ 120 to be stable)." },
  { term: "z-score", types: ["descriptive", "airway"], text: "How many standard deviations a value is from the norm. |z| > 2 is unusual." },
  { term: "Shapiro-Wilk", types: ["descriptive", "comparative"], text: "Test of normality. With small samples it has little power; with large samples it flags trivial departures — use it as a diagnostic, not to choose the test." },
  // Correlation / diagnostic
  { term: "Pearson r / Spearman ρ", types: ["correlation"], text: "Strength of a linear (Pearson) or monotonic (Spearman) association, from −1 to 1." },
  { term: "R² (regression)", types: ["correlation"], text: "Proportion of the outcome’s variance explained by the predictors; adjusted R² penalises extra predictors." },
  { term: "AUC (ROC)", types: ["diagnostic"], text: "Probability that a randomly chosen positive case scores higher than a negative one. 0.5 = chance, 0.7–0.8 acceptable, 0.8–0.9 excellent, above 0.9 outstanding." },
  { term: "Youden cut-off", types: ["diagnostic"], text: "The threshold that maximises sensitivity + specificity − 1." },
  // Superimposition
  { term: "Registration", types: ["superimposition"], text: "How two tracings are aligned before measuring change. Stable-structure registrations (cranial base, maxilla, symphysis) show real growth; best-fit Procrustes spreads change across all landmarks." },
];

export function glossaryFor(type) {
  const own = GLOSSARY.filter(g => g.types.includes(type));
  const rest = GLOSSARY.filter(g => !g.types.includes(type));
  return [...own, ...rest];
}
