// ═══════════════════════════════════════════════════════════════════════════════
// studyReport.js — plain-language summary + APA 7 methods/results text
//
// summarizeStudy(study)  → { headline, findings: [{ label, text, flag }], skipped }
// methodsText(study)     → paragraph (HTML with <i> for statistics) describing the analysis
// resultsText(study)     → per-measurement APA sentences (HTML)
// referencesFor(study)   → APA reference list for the methods cited
// Plain text: stripTags(html). APA conventions: italic statistic symbols, p to
// three decimals without a leading zero ("p < .001"), no leading zero for
// statistics bounded by 1 (r, ICC, AUC, η²), 95% CIs in square brackets.
// ═══════════════════════════════════════════════════════════════════════════════

import { ICC_MODELS } from "./reliability.js";
import { fmtNum } from "../lib/utils.js";

export const stripTags = html => String(html)
  .replace(/<sub>(.*?)<\/sub>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const fin = v => typeof v === "number" && isFinite(v);
// User-entered names (measurements, groups, variables) are escaped before they
// are placed in generated HTML.
const h = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function apaP(p) {
  if (!fin(p)) return "<i>p</i> = n/a";
  if (p < 0.001) return "<i>p</i> &lt; .001";
  return `<i>p</i> = ${fmtNum(p, 3).replace(/^0/, "")}`;
}
export const num = (v, d = 2) => (fin(v) ? v.toFixed(d) : "n/a");
// For statistics bounded in [−1, 1]: no leading zero.
export const bounded = (v, d = 2) => (fin(v) ? v.toFixed(d).replace(/^(-?)0\./, "$1.") : "n/a");
const ci = (lo, hi, f = num, unit = "") => (fin(lo) && fin(hi) ? `95% CI [${f(lo)}, ${f(hi)}]${unit ? " " + unit : ""}` : "");
const dfStr = df => (fin(df) ? (Number.isInteger(df) ? String(df) : fmtNum(df, 2)) : "?");
const u = unit => (unit && unit !== "°" ? ` ${unit}` : unit === "°" ? "°" : "");

const REFS = {
  shroutFleiss: "Shrout, P. E., & Fleiss, J. L. (1979). Intraclass correlations: Uses in assessing rater reliability. <i>Psychological Bulletin, 86</i>(2), 420–428. https://doi.org/10.1037/0033-2909.86.2.420",
  mcgrawWong: "McGraw, K. O., & Wong, S. P. (1996). Forming inferences about some intraclass correlation coefficients. <i>Psychological Methods, 1</i>(1), 30–46. https://doi.org/10.1037/1082-989X.1.1.30",
  kooLi: "Koo, T. K., & Li, M. Y. (2016). A guideline of selecting and reporting intraclass correlation coefficients for reliability research. <i>Journal of Chiropractic Medicine, 15</i>(2), 155–163. https://doi.org/10.1016/j.jcm.2016.02.012",
  ba1986: "Bland, J. M., & Altman, D. G. (1986). Statistical methods for assessing agreement between two methods of clinical measurement. <i>The Lancet, 327</i>(8476), 307–310. https://doi.org/10.1016/S0140-6736(86)90837-8",
  ba2007: "Bland, J. M., & Altman, D. G. (2007). Agreement between methods of measurement with multiple observations per individual. <i>Journal of Biopharmaceutical Statistics, 17</i>(4), 571–582. https://doi.org/10.1080/10543400701329422",
  dahlberg: "Dahlberg, G. (1940). <i>Statistical methods for medical and biological students</i>. George Allen & Unwin.",
  welch: "Welch, B. L. (1947). The generalization of ‘Student’s’ problem when several different population variances are involved. <i>Biometrika, 34</i>(1–2), 28–35. https://doi.org/10.1093/biomet/34.1-2.28",
  gamesHowell: "Games, P. A., & Howell, J. F. (1976). Pairwise multiple comparison procedures with unequal n’s and/or variances: A Monte Carlo study. <i>Journal of Educational Statistics, 1</i>(2), 113–125. https://doi.org/10.3102/10769986001002113",
  mannWhitney: "Mann, H. B., & Whitney, D. R. (1947). On a test of whether one of two random variables is stochastically larger than the other. <i>The Annals of Mathematical Statistics, 18</i>(1), 50–60. https://doi.org/10.1214/aoms/1177730491",
  kruskal: "Kruskal, W. H., & Wallis, W. A. (1952). Use of ranks in one-criterion variance analysis. <i>Journal of the American Statistical Association, 47</i>(260), 583–621. https://doi.org/10.1080/01621459.1952.10483441",
  dunn: "Dunn, O. J. (1964). Multiple comparisons using rank sums. <i>Technometrics, 6</i>(3), 241–252. https://doi.org/10.1080/00401706.1964.10490181",
  holm: "Holm, S. (1979). A simple sequentially rejective multiple test procedure. <i>Scandinavian Journal of Statistics, 6</i>(2), 65–70.",
  bh: "Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A practical and powerful approach to multiple testing. <i>Journal of the Royal Statistical Society: Series B, 57</i>(1), 289–300. https://doi.org/10.1111/j.2517-6161.1995.tb02031.x",
  gg: "Greenhouse, S. W., & Geisser, S. (1959). On methods in the analysis of profile data. <i>Psychometrika, 24</i>(2), 95–112. https://doi.org/10.1007/BF02289823",
  satterthwaite: "Satterthwaite, F. E. (1946). An approximate distribution of estimates of variance components. <i>Biometrics Bulletin, 2</i>(6), 110–114. https://doi.org/10.2307/3002019",
  lmerTest: "Kuznetsova, A., Brockhoff, P. B., & Christensen, R. H. B. (2017). lmerTest package: Tests in linear mixed effects models. <i>Journal of Statistical Software, 82</i>(13), 1–26. https://doi.org/10.18637/jss.v082.i13",
  royston: "Royston, P. (1995). Remark AS R94: A remark on algorithm AS 181: The W-test for normality. <i>Applied Statistics, 44</i>(4), 547–551. https://doi.org/10.2307/2986146",
  delong: "DeLong, E. R., DeLong, D. M., & Clarke-Pearson, D. L. (1988). Comparing the areas under two or more correlated receiver operating characteristic curves: A nonparametric approach. <i>Biometrics, 44</i>(3), 837–845. https://doi.org/10.2307/2531595",
  youden: "Youden, W. J. (1950). Index for rating diagnostic tests. <i>Cancer, 3</i>(1), 32–35.",
  software: "Cephalometry Studio [Computer software]. https://github.com/Muhammad-Nabeel-Sh/CephalometryStudio",
};

const MC_TEXT = {
  bonferroni: ["Bonferroni correction", null],
  holm: ["Holm’s step-down correction (Holm, 1979)", "holm"],
  bh: ["the Benjamini–Hochberg false-discovery-rate procedure (Benjamini & Hochberg, 1995)", "bh"],
};

const kooLi = icc => (!fin(icc) ? "" : icc < 0.5 ? "poor" : icc < 0.75 ? "moderate" : icc < 0.9 ? "good" : "excellent");

// ─── Per-type helpers ───────────────────────────────────────────────────────

function comparativeSentence(label, lr) {
  const r = lr.result || {}, n = lr.testName, es = lr.effectSize || {};
  let stat;
  if (n === "Welch's t-test" || n === "Independent t-test" || n === "Paired t-test") stat = `<i>t</i>(${dfStr(r.df)}) = ${num(r.t)}`;
  else if (n === "Welch's ANOVA") stat = `Welch’s <i>F</i>(${dfStr(r.df1)}, ${dfStr(r.df2)}) = ${num(r.F)}`;
  else if (n === "One-way ANOVA") stat = `<i>F</i>(${dfStr(r.dfBetween)}, ${dfStr(r.dfWithin)}) = ${num(r.F)}`;
  else if (n === "Repeated measures ANOVA") stat = `<i>F</i>(${dfStr(r.dfCond)}, ${dfStr(r.dfErr)}) = ${num(r.F)}`;
  else if (n === "Mann-Whitney U") stat = `<i>U</i> = ${num(r.U, 1)}`;
  else if (n === "Wilcoxon signed-rank") stat = `<i>W</i> = ${num(r.W, 1)}`;
  else if (n === "Kruskal-Wallis") stat = `<i>H</i>(${dfStr(r.df)}) = ${num(r.H)}`;
  else if (n === "Friedman test") stat = `χ²(${dfStr(r.df)}) = ${num(r.Q)}`;
  else stat = n || "";
  const esText = fin(es.cohensD) ? `, <i>d</i> = ${num(es.cohensD)}${es.ci95 ? ` ${ci(es.ci95[0], es.ci95[1])}` : ""}`
    : fin(es.cohensDz) ? `, <i>d<sub>z</sub></i> = ${num(es.cohensDz)}`
    : fin(es.etaSq) ? `, η² = ${bounded(es.etaSq)}`
    : fin(es.partialEtaSq) ? `, η<sub>p</sub>² = ${bounded(es.partialEtaSq)}`
    : fin(es.rankBiserial) ? `, <i>r</i><sub>rb</sub> = ${bounded(es.rankBiserial)}`
    : fin(es.epsilonSq) ? `, ε² = ${bounded(es.epsilonSq)}`
    : fin(es.kendallW) ? `, Kendall’s <i>W</i> = ${bounded(es.kendallW)}` : "";
  const adj = lr.mcCorrected && fin(lr.mcCorrected.adjusted) && lr.mcCorrected.adjusted !== r.pValue ? ` (adjusted ${apaP(lr.mcCorrected.adjusted)})` : "";
  const means = Object.entries(lr.rawData || {}).map(([g, d]) => `${h(g)}: <i>M</i> = ${num(d.mean)}, <i>SD</i> = ${num(d.sd)}`).join("; ");
  return `${h(label)}${lr.unit ? ` (${h(lr.unit)})` : ""} — ${means}; ${stat}, ${apaP(r.pValue)}${adj}${esText}.`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function summarizeStudy(study) {
  const res = study?.results;
  const findings = [], skipped = [];
  if (!res || res.error) return { headline: res?.error ? "The analysis failed." : "No results yet.", findings, skipped };
  const alpha = res.alpha || 0.05;
  let headline = "";

  switch (study.type) {
    case "reliability": {
      const ok = (res.details || []).filter(d => !d.skip && fin(d.icc));
      for (const d of res.details || []) if (d.skip) skipped.push({ label: d.label, reason: d.reason });
      const counts = {};
      for (const d of ok) { const c = d.iccRating || kooLi(d.icc); counts[c] = (counts[c] || 0) + 1; }
      headline = ok.length ? `${ok.length} measurement${ok.length > 1 ? "s" : ""} assessed — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")} reliability (Koo & Li, from the 95% CI).` : "No measurement could be assessed.";
      for (const d of ok) {
        findings.push({
          label: d.label, flag: d.icc < 0.75 ? "warn" : "ok",
          text: `ICC ${bounded(d.icc)} [${bounded(d.ci95?.[0])}, ${bounded(d.ci95?.[1])}] — ${d.iccRating || kooLi(d.icc)}. Bias ${num(d.meanDiff)}${u(d.unit)}, limits of agreement ${num(d.loaLower)} to ${num(d.loaUpper)}${u(d.unit)}.`,
        });
      }
      break;
    }
    case "comparative": {
      const entries = Object.entries(res.labels || {});
      const done = entries.filter(([, lr]) => !lr.skip && lr.result);
      for (const [l, lr] of entries) if (lr.skip) skipped.push({ label: l, reason: lr.reason });
      const sig = done.filter(([, lr]) => (lr.mcCorrected ? lr.mcCorrected.significant : lr.result.pValue < alpha));
      headline = done.length ? `${sig.length} of ${done.length} measurement${done.length > 1 ? "s" : ""} differ significantly between ${(res.groups || []).map(g => g.label).join(" and ")}${res.mcCorrection && res.mcCorrection !== "none" ? " after correction for multiple comparisons" : ""}.` : "No measurement could be compared.";
      for (const [l, lr] of done) {
        const significant = lr.mcCorrected ? lr.mcCorrected.significant : lr.result.pValue < alpha;
        findings.push({ label: l, flag: significant ? "sig" : "ok", text: stripTags(comparativeSentence(l, lr)).replace(/^[^—]+— /, "") });
      }
      break;
    }
    case "longitudinal": {
      const entries = Object.entries(res.labels || {});
      for (const [l, lr] of entries) if (lr.skip) skipped.push({ label: l, reason: lr.reason });
      const done = entries.filter(([, lr]) => !lr.skip);
      const changed = done.filter(([, lr]) => (lr.rmAnova?.pValue ?? lr.lmm?.fixedEffects?.[1]?.p ?? 1) < alpha);
      headline = done.length ? `${changed.length} of ${done.length} measurement${done.length > 1 ? "s" : ""} change significantly over time.` : "No measurement could be analyzed.";
      for (const [l, lr] of done) {
        const parts = [];
        if (lr.rmAnova) parts.push(`RM-ANOVA F = ${num(lr.rmAnova.F)}, p ${lr.rmAnova.pValue < 0.001 ? "< .001" : "= " + fmtNum(lr.rmAnova.pValue, 3).replace(/^0/, "")}`);
        const slope = lr.lmm?.fixedEffects?.[1];
        if (slope) parts.push(`growth ${num(slope.estimate)}${u(lr.unit)} per ${lr.lmm.timeUnit} [${num(slope.ci95[0])}, ${num(slope.ci95[1])}]`);
        const cs = lr.changeScores?.[lr.changeScores.length - 1];
        if (cs && !lr.lmm) parts.push(`${cs.from}→${cs.to} change ${num(cs.meanChange)}${u(lr.unit)}`);
        findings.push({ label: l, flag: (lr.rmAnova?.pValue ?? slope?.p ?? 1) < alpha ? "sig" : "ok", text: parts.join("; ") + "." });
      }
      break;
    }
    case "descriptive": {
      const entries = Object.entries(res.combined || {});
      headline = `${entries.length} measurement${entries.length === 1 ? "" : "s"} summarised across ${Object.values(res.groups || {}).reduce((a, g) => a + (g.sessions || 0), 0) || "the"} sessions.`;
      for (const [l, c] of entries) {
        const s = c.stats || {};
        const z = Object.values(res.zScores || {}).map(zs => zs?.[l]).find(Boolean);
        findings.push({ label: l, flag: z && Math.abs(z.zScore?.z ?? 0) > 2 ? "warn" : "ok", text: `n = ${s.n}, mean ${num(s.mean)} ± ${num(s.sd)}${u(c.unit)} (range ${num(s.min)}–${num(s.max)})${z?.zScore ? `; ${num(z.zScore.z)} SD from the norm` : ""}.` });
      }
      break;
    }
    case "correlation": {
      const vars = res.vars || [];
      const pairs = [];
      for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) {
        const c = res.matrix?.[vars[i]]?.[vars[j]];
        if (c) pairs.push({ a: vars[i], b: vars[j], ...c });
      }
      const sig = pairs.filter(p => (p.sigAdj ?? p.p < alpha));
      headline = pairs.length ? `${sig.length} of ${pairs.length} correlation${pairs.length > 1 ? "s" : ""} significant (${res.method || "pearson"}, n = ${res.n}).` : (res.note || "No correlations computed.");
      for (const p of pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 12)) {
        findings.push({ label: `${p.a} × ${p.b}`, flag: (p.sigAdj ?? p.p < alpha) ? "sig" : "ok", text: `r = ${bounded(p.r)}, p ${p.p < 0.001 ? "< .001" : "= " + fmtNum(p.p, 3).replace(/^0/, "")}.` });
      }
      if (res.regression?.r2 != null) findings.push({ label: `Regression → ${res.regression.dependentVar}`, flag: res.regression.pF < alpha ? "sig" : "ok", text: `R² = ${bounded(res.regression.r2)}, adjusted R² = ${bounded(res.regression.r2adj)}, F(${res.regression.df1}, ${res.regression.df2}) = ${num(res.regression.F)}.` });
      break;
    }
    case "diagnostic": {
      const preds = Object.entries(res.predictors || {});
      headline = preds.length ? `${preds.length} predictor${preds.length > 1 ? "s" : ""} evaluated against ${res.goldStandardLabel} (${res.nP} positive, ${res.nN} negative).` : (res.note || "No predictors evaluated.");
      for (const [name, p] of preds) {
        const a = p.auc || {}, y = p.optimalYouden || {};
        findings.push({ label: name, flag: a.auc >= 0.8 ? "sig" : "ok", text: `AUC ${bounded(a.auc)} [${bounded(a.ci95?.[0])}, ${bounded(a.ci95?.[1])}]${fin(y.threshold) ? `; best cut-off ${num(y.threshold)} (sensitivity ${num((y.sensitivity || 0) * 100, 0)}%, specificity ${num((y.specificity || 0) * 100, 0)}%)` : ""}.` });
      }
      break;
    }
    case "superimposition": {
      if (res.error) return { headline: res.error, findings, skipped };
      headline = `${res.matchedCount ?? 0} landmarks superimposed (${res.alignmentLabel || "registration"}); mean displacement ${num(res.stats?.mean)} mm.`;
      for (const d of [...(res.displacements || [])].sort((a, b) => (b.lenMm ?? 0) - (a.lenMm ?? 0)).slice(0, 8)) {
        findings.push({ label: d.label, flag: d.significant ? "sig" : "ok", text: `moved ${num(d.lenMm)} ${d.unit || "mm"}.` });
      }
      for (const p of res.patterns || []) findings.push({ label: p.label || p.type || "Pattern", flag: "warn", text: p.description || p.summary || "" });
      break;
    }
    case "airway": {
      const ms = (res.measurements || []).filter(m => m.id && !m.id.startsWith("_") && fin(m.value));
      headline = `${ms.length} airway measurement${ms.length === 1 ? "" : "s"} computed.`;
      for (const m of ms) findings.push({ label: m.label, flag: fin(m.zScore) && m.zScore < -2 ? "warn" : "ok", text: `${num(m.value)} ${m.unit || ""}${fin(m.zScore) ? ` (z = ${num(m.zScore)})` : ""} — ${m.interpretation || ""}`.trim() });
      break;
    }
    default:
      headline = "Results available.";
  }
  return { headline, findings, skipped };
}

export function methodsText(study) {
  const c = study?.config || {}, res = study?.results || {};
  const parts = [];
  const refsUsed = new Set(["software"]);
  switch (study?.type) {
    case "reliability": {
      const model = ICC_MODELS[c.iccModel || "icc2"];
      const design = c.design === "intra" ? "Intra-rater reliability" : c.design === "inter" ? "Inter-rater reliability" : "Agreement between measurement methods";
      const nCases = res.summary?.cases ?? (c.cases || []).length;
      const replicates = (res.details || []).some(d => /2007/.test(d.method || ""));
      parts.push(`${design} was assessed on ${nCases} cases${c.design === "intra" ? ` traced on ${c.protocol?.occasions || 2} occasions${c.minTimeSeparation ? ` at least ${c.minTimeSeparation} days apart` : ""}` : ""}${c.protocol?.blindingEnforced ? ", with earlier tracings hidden from the rater (blinded)" : ""}.`);
      parts.push(`Reliability was quantified with the intraclass correlation coefficient, ${model.label} (${model.description.toLowerCase()}), with 95% confidence intervals (Shrout & Fleiss, 1979; McGraw & Wong, 1996), interpreted following Koo and Li (2016).`);
      parts.push(`Agreement was described with Bland–Altman bias and 95% limits of agreement (${replicates ? "Bland & Altman, 2007, for replicated measurements" : "Bland & Altman, 1986"}), and measurement error with Dahlberg’s formula (Dahlberg, 1940), the standard error of measurement and the minimal detectable change.`);
      ["shroutFleiss", "mcgrawWong", "kooLi", replicates ? "ba2007" : "ba1986", "dahlberg"].forEach(r => refsUsed.add(r));
      break;
    }
    case "comparative": {
      const policy = c.testPolicy || res.testPolicy || "welch";
      const paired = c.design === "paired";
      const groups = (c.groups || []).map(g => h(g.label));
      let tests;
      if (policy === "nonparametric") { tests = paired ? "Wilcoxon signed-rank tests (Friedman tests for three or more conditions, followed by pairwise Wilcoxon tests)" : "Mann–Whitney U tests (Kruskal–Wallis tests for three or more groups, followed by Dunn’s tests)"; refsUsed.add(paired ? "holm" : "mannWhitney"); if (!paired) { refsUsed.add("kruskal"); refsUsed.add("dunn"); } }
      else if (policy === "auto") tests = "tests selected from normality (Shapiro–Wilk; Royston, 1995) and variance checks";
      else { tests = paired ? "paired t-tests (repeated-measures ANOVA with the Greenhouse–Geisser correction for three or more conditions; Greenhouse & Geisser, 1959)" : "Welch’s t-tests (Welch’s ANOVA with Games–Howell post-hoc comparisons for three or more groups; Welch, 1947; Games & Howell, 1976)"; if (paired) refsUsed.add("gg"); else { refsUsed.add("welch"); refsUsed.add("gamesHowell"); } }
      if (policy === "auto") refsUsed.add("royston");
      const groupList = groups.length > 1 ? `${groups.slice(0, -1).join(", ")} and ${groups[groups.length - 1]}` : groups.join("");
      parts.push(`${paired ? "Repeated measurements" : "Measurements"} were compared between ${groupList} using ${tests}, specified before the analysis${policy !== "auto" ? "; the rank-based (or parametric) counterpart is reported as a sensitivity analysis" : ""}.`);
      const mc = MC_TEXT[c.mcCorrection || res.mcCorrection];
      if (mc) { parts.push(`P-values were adjusted across measurements using ${mc[0]}.`); if (mc[1]) refsUsed.add(mc[1]); }
      parts.push(`Significance was set at α = ${(c.alpha ?? 0.05).toString().replace(/^0/, "")}.`);
      break;
    }
    case "longitudinal": {
      const lmm = Object.values(res.labels || {}).find(lr => lr.lmm)?.lmm;
      if (c.modelType !== "mixed_model") { parts.push("Change across timepoints was tested with repeated-measures ANOVA, using Mauchly’s test of sphericity and the Greenhouse–Geisser correction (Greenhouse & Geisser, 1959), with Bonferroni-adjusted pairwise comparisons."); refsUsed.add("gg"); }
      if (lmm || c.modelType === "mixed_model" || c.modelType === "both") {
        const axis = lmm?.timeAxis === "age" ? "patient age in years" : lmm?.timeAxis === "targetAge" ? "the planned age at each timepoint" : "visit number";
        parts.push(`Growth was modelled with a linear mixed model fitted by restricted maximum likelihood, with a random intercept per subject${lmm?.randomSlope ? " and a random slope, retained after a likelihood-ratio test" : ""}, ${lmm?.growthCurve === "quadratic" ? "linear and quadratic terms of" : "a linear term of"} ${axis}${lmm?.covariate ? `, and ${lmm.covariate.name} with its interaction with time` : ""}. Fixed effects were tested with Satterthwaite degrees of freedom (Satterthwaite, 1946; Kuznetsova et al., 2017).`);
        refsUsed.add("satterthwaite"); refsUsed.add("lmerTest");
      }
      break;
    }
    case "descriptive":
      parts.push("Measurements were summarised with the mean, standard deviation, median and range; normality was checked with the Shapiro–Wilk test (Royston, 1995), and 95% reference intervals were computed parametrically for normally distributed variables and non-parametrically otherwise.");
      refsUsed.add("royston");
      if ((c.referenceNorms || []).length) parts.push(`Values were compared with published norms (${(c.referenceNorms || []).map(n => h(n.label || n.id)).join(", ")}) as z-scores.`);
      break;
    case "correlation":
      parts.push(`Associations were assessed with ${c.method === "spearman" ? "Spearman’s rank correlation" : "Pearson’s correlation"}, with p-values adjusted by the Benjamini–Hochberg procedure (Benjamini & Hochberg, 1995).`);
      refsUsed.add("bh");
      if (res.regression?.r2 != null) parts.push(`A multiple linear regression predicted ${h(res.regression.dependentVar)} from ${(res.regression.predictorVars || []).map(h).join(", ")}; collinearity was checked with variance inflation factors.`);
      break;
    case "diagnostic":
      parts.push(`Diagnostic accuracy for ${h(res.goldStandardLabel || c.goldStandardLabel)} was assessed with ROC analysis; the area under the curve is reported with DeLong 95% confidence intervals (DeLong et al., 1988), and the optimal cut-off was chosen by the Youden index (Youden, 1950).`);
      refsUsed.add("delong"); refsUsed.add("youden");
      break;
    case "superimposition":
      parts.push(`Serial tracings were superimposed using ${h(res.alignmentLabel || "a structural registration")} (rotation and translation only), and landmark displacements are reported in millimetres.`);
      break;
    case "airway":
      parts.push("Pharyngeal airway dimensions were measured on the lateral cephalogram and compared with age- and sex-specific reference values where available.");
      break;
    default:
  }
  parts.push("Analyses were performed in Cephalometry Studio.");
  return { html: parts.join(" "), refs: [...refsUsed] };
}

export function resultsText(study) {
  const res = study?.results;
  if (!res) return "";
  const out = [];
  switch (study.type) {
    case "reliability":
      for (const d of (res.details || []).filter(x => !x.skip && fin(x.icc))) {
        out.push(`${h(d.label)}: ICC = ${bounded(d.icc)}, ${ci(d.ci95?.[0], d.ci95?.[1], bounded)} (${d.iccRating || kooLi(d.icc)}); bias = ${num(d.meanDiff)}${h(u(d.unit))}, 95% limits of agreement [${num(d.loaLower)}, ${num(d.loaUpper)}]${h(u(d.unit))}; Dahlberg error = ${num(d.dahlberg)}${h(u(d.unit))}.`);
      }
      break;
    case "comparative":
      for (const [l, lr] of Object.entries(res.labels || {}).filter(([, x]) => !x.skip && x.result)) out.push(comparativeSentence(l, lr));
      break;
    case "longitudinal":
      for (const [l, lr] of Object.entries(res.labels || {}).filter(([, x]) => !x.skip)) {
        const s = [];
        const r = lr.rmAnova;
        if (r) s.push(`<i>F</i>(${dfStr(r.dfTimeCorrected ?? r.dfTime)}, ${dfStr(r.dfErrorCorrected ?? r.dfError)}) = ${num(r.F)}, ${apaP(r.pValue)}, η<sub>p</sub>² = ${bounded(r.partialEtaSq)}${r.eps < 1 ? `, ε = ${bounded(r.eps)}` : ""}`);
        for (const fe of lr.lmm?.fixedEffects || []) if (!/^Intercept/.test(fe.term)) s.push(`${h(fe.term)}: <i>b</i> = ${num(fe.estimate)}, ${ci(fe.ci95?.[0], fe.ci95?.[1])}, <i>t</i>(${dfStr(fe.df)}) = ${num(fe.t)}, ${apaP(fe.p)}`);
        if (s.length) out.push(`${h(l)}${lr.unit ? ` (${h(lr.unit)})` : ""}: ${s.join("; ")}.`);
      }
      break;
    case "correlation": {
      const vars = res.vars || [];
      for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) {
        const c = res.matrix?.[vars[i]]?.[vars[j]];
        if (c) out.push(`${h(vars[i])} and ${h(vars[j])}: <i>${res.method === "spearman" ? "r<sub>s</sub>" : "r"}</i>(${dfStr(c.df ?? (c.n - 2))}) = ${bounded(c.r)}, ${apaP(c.p)}.`);
      }
      const rg = res.regression;
      if (rg?.r2 != null) out.push(`Regression: <i>R</i>² = ${bounded(rg.r2)}, adjusted <i>R</i>² = ${bounded(rg.r2adj)}, <i>F</i>(${rg.df1}, ${rg.df2}) = ${num(rg.F)}, ${apaP(rg.pF)}.`);
      break;
    }
    case "diagnostic":
      for (const [name, p] of Object.entries(res.predictors || {})) {
        const a = p.auc || {}, y = p.optimalYouden || {};
        out.push(`${h(name)}: AUC = ${bounded(a.auc)}, ${ci(a.ci95?.[0], a.ci95?.[1], bounded)}${fin(y.threshold) ? `; at a cut-off of ${num(y.threshold)}, sensitivity = ${num((y.sensitivity || 0) * 100, 1)}% and specificity = ${num((y.specificity || 0) * 100, 1)}%` : ""}.`);
      }
      break;
    default: {
      const s = summarizeStudy(study);
      out.push(...s.findings.map(f => `${h(f.label)}: ${h(f.text)}`));
    }
  }
  return out.join(" ");
}

export function referencesFor(study) {
  return methodsText(study).refs.map(k => REFS[k]).filter(Boolean).sort((a, b) => stripTags(a).localeCompare(stripTags(b)));
}
