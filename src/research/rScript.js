// ═══════════════════════════════════════════════════════════════════════════════
// rScript.js — "Export R script": a self-contained .R file that reproduces a study
//
// The script embeds the exact values the app analyzes (long format, one row per
// session × measurement, read through sessionPrimaryMeasure like every research
// module) and runs the matching analysis with standard R functions, so a reviewer
// can check the app's numbers in R. Superimposition and the legacy airway study
// get the data only: their geometry has no standard R equivalent.
// ═══════════════════════════════════════════════════════════════════════════════

import { isResearchMarkup, sessionPrimaryMeasure } from "./collect.js";
import { scopedSessions } from "./dataPreview.js";

const SUPPORTED = new Set(["descriptive", "reliability", "comparative", "longitudinal", "correlation", "diagnostic"]);
export const rScriptSupported = type => SUPPORTED.has(type);

const patientIdOf = s => s?.subjectId || s?.meta?.patientId || "";

// Measurement labels a study reads (empty = all).
function labelsFor(study) {
  const c = study?.config || {};
  if (study?.type === "diagnostic") return [c.goldStandardLabel, ...(c.predictorLabels || [])].filter(Boolean);
  if (study?.type === "correlation" && c.dependentVar && !(c.labelIds || []).length) return [];
  return c.labelIds || [];
}

// { sessionId, extra } entries in the order the study uses them, with the design
// columns (case/operator/occasion, condition, subject/timepoint, descriptive group).
function designRows(study, sessions) {
  const c = study?.config || {};
  const byId = new Map((sessions || []).filter(Boolean).map(s => [s.id, s]));
  const out = [];
  switch (study?.type) {
    case "reliability": {
      const opName = id => (c.operators || []).find(o => (typeof o === "string" ? o : o.id) === id)?.name || id || "";
      for (const cs of c.cases || []) for (const m of cs.sessions || []) {
        out.push({ sessionId: m.sessionId, extra: { case: cs.name || cs.id, operator: opName(m.operatorId), occasion: m.occasion ?? "" } });
      }
      break;
    }
    case "comparative":
      for (const g of c.groups || []) (g.caseIds || []).forEach((id, i) => {
        out.push({ sessionId: id, extra: { condition: g.label, position: i + 1 } });
      });
      break;
    case "longitudinal":
      for (const subj of c.subjects || []) (c.timepoints || []).forEach((tp, j) => {
        const id = subj.records?.[tp.id];
        if (id) out.push({ sessionId: id, extra: { subject: subj.label || subj.id, timepoint: tp.label || tp.id, tp_index: j, target_age: tp.targetAge ?? "" } });
      });
      break;
    case "descriptive": {
      const by = c.groupBy || "none";
      for (const s of scopedSessions(study, sessions)) {
        const key = by === "group" ? s.meta?.group || "Ungrouped" : by === "operator" ? s.meta?.operatorId || "Unknown" : by === "patient" ? s.meta?.patientId || "Unknown" : "All";
        out.push({ sessionId: s.id, extra: { by: key } });
      }
      break;
    }
    default:
      for (const s of scopedSessions(study, sessions)) out.push({ sessionId: s.id, extra: {} });
  }
  return out.filter(r => byId.has(r.sessionId)).map(r => ({ ...r, session: byId.get(r.sessionId) }));
}

// Long-format data: one row per session × measurement label.
export function buildRData(study, sessions, calibration) {
  const labels = labelsFor(study);
  const rows = [];
  const extraKeys = [];
  for (const { session: s, extra } of designRows(study, sessions)) {
    for (const k of Object.keys(extra)) if (!extraKeys.includes(k)) extraKeys.push(k);
    const seen = new Set();
    for (const m of s.markups || []) {
      if (!isResearchMarkup(m)) continue;
      if (labels.length && !labels.includes(m.label)) continue;
      if (seen.has(m.label)) continue;
      const pm = sessionPrimaryMeasure(s, m, calibration);
      if (!pm || typeof pm.value !== "number" || !isFinite(pm.value)) continue;
      seen.add(m.label);
      rows.push({
        session_id: s.id, session: s.name || s.label || s.id, patient_id: patientIdOf(s),
        age: s.meta?.age ?? "", sex: s.meta?.sex ?? "", group: s.meta?.group ?? "",
        ...extra, measure: m.label, unit: pm.unit || "", value: pm.value,
      });
    }
  }
  const columns = ["session_id", "session", "patient_id", "age", "sex", "group", ...extraKeys, "measure", "unit", "value"];
  return { columns, rows };
}

// ─── R text helpers ─────────────────────────────────────────────────────────

// An R double-quoted string literal.
export const rStr = v => `"${String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
const rVec = arr => `c(${arr.map(rStr).join(", ")})`;
const csvCell = v => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (v, d) => (v === undefined || v === null || v === "" || !isFinite(Number(v)) ? d : String(Number(v)));

function dataBlock({ columns, rows }) {
  const lines = [columns.map(csvCell).join(","), ...rows.map(r => columns.map(c => csvCell(typeof r[c] === "number" ? String(r[c]) : r[c])).join(","))];
  // R strings can't hold literal newlines here, so each CSV line is one element.
  return `.lines <- c(\n${lines.map(l => `  ${rStr(l)}`).join(",\n")}\n)
dat <- read.csv(text = .lines, stringsAsFactors = FALSE, check.names = FALSE,
                colClasses = c(session_id = "character", patient_id = "character", sex = "character", group = "character"))
rm(.lines)
measures <- sort(unique(dat$measure))
unit_of <- function(m) dat$unit[dat$measure == m][1]
cat(nrow(dat), "values,", length(unique(dat$session_id)), "sessions,", length(measures), "measurements\\n")`;
}

const need = pkgs => pkgs.map(p => `if (!requireNamespace(${rStr(p)}, quietly = TRUE)) install.packages(${rStr(p)})`).join("\n");

// ─── Analyses by study type ────────────────────────────────────────────────

function descriptiveR() {
  return `# Descriptive statistics per measurement (and per group when the study groups sessions).
# R's quantile() type 7 is used for quartiles; the app's percentile definition may differ slightly.
describe <- function(x) {
  x <- x[is.finite(x)]
  n <- length(x)
  c(n = n, mean = mean(x), sd = if (n > 1) sd(x) else NA, median = median(x),
    q1 = unname(quantile(x, 0.25)), q3 = unname(quantile(x, 0.75)), min = min(x), max = max(x),
    shapiro_p = if (n >= 3 && n <= 5000 && sd(x) > 0) shapiro.test(x)$p.value else NA)
}
desc <- do.call(rbind, lapply(split(dat, list(dat$measure, dat$by), drop = TRUE), function(d)
  data.frame(measure = d$measure[1], group = d$by[1], unit = d$unit[1], t(describe(d$value)), check.names = FALSE)))
rownames(desc) <- NULL
print(desc, digits = 4)`;
}

function reliabilityR(c) {
  const model = { icc1: "ICC1", icc1k: "ICC1k", icc2: "ICC2", icc2k: "ICC2k", icc3: "ICC3", icc3k: "ICC3k" }[c.iccModel] || "ICC2";
  const design = c.design || "intra";
  return `${need(["psych"])}
library(psych)

# Design: ${design}. Intra-rater: occasions are the raters, per operator and pooled.
# Inter-rater / method comparison: operators are the raters (repeated readings averaged).
# Only cases measured by every rater/occasion are used, as in the app.
design <- ${rStr(design)}
icc_row <- ${rStr(model)}   # the ICC form chosen in the study (psych::ICC row name)

reliability <- function(d) {
  rater <- if (design == "intra") paste0("occ", d$occasion) else d$operator
  w <- tapply(d$value, list(d$case, rater), mean)
  if (design == "intra") w <- w[, order(as.numeric(sub("occ", "", colnames(w)))), drop = FALSE]
  w <- w[complete.cases(w), , drop = FALSE]
  if (nrow(w) < 2 || ncol(w) < 2) return(NULL)
  icc <- psych::ICC(w, lmer = FALSE)$results
  r <- icc[icc$type == icc_row, ]
  dif <- w[, 2] - w[, 1]                 # second minus first, as in the app
  data.frame(n_cases = nrow(w), k = ncol(w), ICC = r$ICC, lower = r[["lower bound"]], upper = r[["upper bound"]],
             F = r$F, p = r$p, bias = mean(dif), sd_diff = sd(dif),
             loa_low = mean(dif) - 1.96 * sd(dif), loa_high = mean(dif) + 1.96 * sd(dif),
             dahlberg = sqrt(sum(dif^2) / (2 * length(dif))))
}

out <- list()
for (m in measures) {
  d <- dat[dat$measure == m, ]
  r <- reliability(d)
  if (!is.null(r)) out[[length(out) + 1]] <- data.frame(measure = m, operator = "all", unit = unit_of(m), r)
  if (design == "intra" && length(unique(d$operator)) > 1) for (op in unique(d$operator)) {
    r <- reliability(d[d$operator == op, ])
    if (!is.null(r)) out[[length(out) + 1]] <- data.frame(measure = m, operator = op, unit = unit_of(m), r)
  }
}
rel <- do.call(rbind, out)
print(rel, digits = 4)
# The Bland-Altman columns compare the first two raters/occasions. For methods measured
# with replicates the app uses the Bland & Altman (2007) method instead.`;
}

function comparativeR(c) {
  const policy = c.testPolicy || "welch";
  const mc = c.mcCorrection || "bonferroni";
  const padj = { bonferroni: "bonferroni", holm: "holm", bh: "BH", none: "none" }[mc] || "bonferroni";
  const paired = c.design === "paired";
  return `# Design: ${paired ? "paired (repeated conditions)" : "independent groups"}. Test policy: ${policy}.
# Multiple-comparison correction across measurements: ${mc}.
policy <- ${rStr(policy)}
paired <- ${paired ? "TRUE" : "FALSE"}
alpha <- ${num(c.alpha, "0.05")}
dat$condition <- factor(dat$condition, levels = ${rVec((c.groups || []).map(g => g.label))})
${paired ? `# Subjects are matched by patient ID when every case has a unique one, otherwise by
# position in each group's case list (the app does the same).
ids_ok <- all(dat$patient_id != "") && !any(duplicated(dat[, c("condition", "measure", "patient_id")]))
dat$subject <- if (ids_ok) dat$patient_id else as.character(dat$position)
` : ""}
compare <- function(d) {
  k <- nlevels(droplevels(d$condition))
  if (any(table(d$condition) < 2)) return(NULL)
${paired ? `  w <- reshape(d[, c("subject", "condition", "value")], idvar = "subject", timevar = "condition", direction = "wide")
  w <- w[complete.cases(w), ]
  long <- d[d$subject %in% w$subject, ]
  long$subject <- factor(long$subject)
  if (policy == "nonparametric") {
    if (k == 2) { t <- wilcox.test(w[[2]], w[[3]], paired = TRUE, exact = FALSE); return(data.frame(test = "Wilcoxon signed-rank", statistic = t$statistic, p = t$p.value)) }
    t <- friedman.test(value ~ condition | subject, data = long); return(data.frame(test = "Friedman", statistic = t$statistic, p = t$p.value))
  }
  if (k == 2) { t <- t.test(w[[2]], w[[3]], paired = TRUE); return(data.frame(test = "Paired t-test", statistic = t$statistic, p = t$p.value)) }
  a <- summary(aov(value ~ condition + Error(subject / condition), data = long))
  tab <- a[["Error: subject:condition"]][[1]]
  data.frame(test = "Repeated measures ANOVA (uncorrected; the app applies Greenhouse-Geisser when sphericity fails)", statistic = tab[1, "F value"], p = tab[1, "Pr(>F)"])` : `  if (policy == "nonparametric") {
    if (k == 2) { t <- wilcox.test(value ~ condition, data = d, exact = FALSE); return(data.frame(test = "Mann-Whitney U", statistic = t$statistic, p = t$p.value)) }
    t <- kruskal.test(value ~ condition, data = d); return(data.frame(test = "Kruskal-Wallis", statistic = t$statistic, p = t$p.value))
  }
  if (k == 2) { t <- t.test(value ~ condition, data = d, var.equal = FALSE); return(data.frame(test = "Welch's t-test", statistic = t$statistic, p = t$p.value)) }
  t <- oneway.test(value ~ condition, data = d, var.equal = FALSE)
  data.frame(test = "Welch's ANOVA", statistic = t$statistic, p = t$p.value)`}
}

out <- list()
for (m in measures) {
  r <- compare(droplevels(dat[dat$measure == m, ]))
  if (!is.null(r)) out[[length(out) + 1]] <- data.frame(measure = m, unit = unit_of(m), r)
}
cmp <- do.call(rbind, out)
cmp$p_adjusted <- p.adjust(cmp$p, method = ${rStr(padj)})
rownames(cmp) <- NULL
print(cmp, digits = 4)${policy === "auto" ? `
# This study uses the legacy assumption-driven policy (normality + Levene's test decide the
# test). The script runs the Welch / rank-based family; compare with the test the app names.` : ""}`;
}

function longitudinalR(c) {
  const wantLmm = c.modelType === "mixed_model" || c.modelType === "both";
  const cov = c.covariate === "sex" || c.covariate === "group" ? c.covariate : null;
  const quad = c.growthCurve === "quadratic";
  return `# Repeated measures over timepoints. RM-ANOVA uses subjects measured at every timepoint.
dat$timepoint <- factor(dat$timepoint, levels = ${rVec((c.timepoints || []).map(tp => tp.label || tp.id))})
dat$subject <- factor(dat$subject)

out <- list()
for (m in measures) {
  d <- droplevels(dat[dat$measure == m, ])
  full <- names(which(table(d$subject) == nlevels(d$timepoint)))
  dc <- droplevels(d[d$subject %in% full, ])
  if (length(full) < 3) next
  a <- summary(aov(value ~ timepoint + Error(subject / timepoint), data = dc))
  tab <- a[["Error: subject:timepoint"]][[1]]
  out[[length(out) + 1]] <- data.frame(measure = m, unit = unit_of(m), n_complete = length(full),
    F = tab[1, "F value"], df1 = tab[1, "Df"], df2 = tab[2, "Df"], p_uncorrected = tab[1, "Pr(>F)"])
}
rm_anova <- do.call(rbind, out)
print(rm_anova, digits = 4)
# The app also tests sphericity (Mauchly) and applies the ${c.sphericityCorrection || "greenhouse-geisser"} correction;
# for that in R see afex::aov_ez() or ez::ezANOVA().
${wantLmm ? `
${need(["lmerTest"])}
library(lmerTest)
# Linear mixed model (REML, Satterthwaite df). As in the app, a random slope per subject is
# kept only when the REML likelihood-ratio test supports it (50:50 chi-square mixture of
# df 1 and 2, p < 0.05); otherwise the model has a random intercept only. Time is the patient's age when every visit has one, else the timepoints' target
# ages, else the visit index (the app's "${c.timeAxis || "auto"}" setting picks the same way).
time_of <- function(d) {
  axis <- ${rStr(c.timeAxis || "auto")}
  age_ok <- all(is.finite(suppressWarnings(as.numeric(d$age))))
  tgt_ok <- all(is.finite(suppressWarnings(as.numeric(d$target_age))))
  if (axis == "auto") axis <- if (age_ok) "age" else if (tgt_ok) "targetAge" else "index"
  if (axis == "age" && !age_ok) axis <- if (tgt_ok) "targetAge" else "index"
  if (axis == "targetAge" && !tgt_ok) axis <- "index"
  t <- switch(axis, age = as.numeric(d$age), targetAge = as.numeric(d$target_age), index = d$tp_index)
  t - min(t)   # intercept = expected value at the earliest time
}
for (m in measures) {
  d <- droplevels(dat[dat$measure == m, ])
  if (length(unique(d$subject)) < 3) next
  d$time <- time_of(d)
${cov ? `  d <- d[d[[${rStr(cov)}]] != "", ]
` : ""}  fixed <- "value ~ time${quad ? " + I(time^2)" : ""}${cov ? ` + ${cov} + time:${cov}` : ""}"
  ri <- lmer(as.formula(paste(fixed, "+ (1 | subject)")), data = d, REML = TRUE)
  rs <- tryCatch(suppressMessages(lmer(as.formula(paste(fixed, "+ (1 + time | subject)")), data = d, REML = TRUE)), error = function(e) NULL)
  fit <- ri
  cat("\\n==", m, "(", unit_of(m), ")\\n")
  if (!is.null(rs)) {
    lr <- max(0, 2 * (as.numeric(logLik(rs)) - as.numeric(logLik(ri))))
    p_slope <- 0.5 * pchisq(lr, 1, lower.tail = FALSE) + 0.5 * pchisq(lr, 2, lower.tail = FALSE)
    if (p_slope < 0.05) fit <- rs
    cat("Random slope: LRT", round(lr, 3), "p =", signif(p_slope, 4), if (p_slope < 0.05) "(kept)" else "(not kept)", "\\n")
  }
  print(summary(fit)$coefficients, digits = 4)
}` : ""}`;
}

function correlationR(c) {
  const method = c.method === "spearman" ? "spearman" : "pearson";
  const reg = c.dependentVar && (c.predictorVars || []).length;
  const logit = reg && c.threshold !== undefined && c.threshold !== "" && isFinite(Number(c.threshold));
  return `# One row per session, one column per measurement. Correlations use sessions with every value.
wide <- reshape(dat[, c("session_id", "measure", "value")], idvar = "session_id", timevar = "measure", direction = "wide")
names(wide) <- sub("^value\\\\.", "", names(wide))
vars <- setdiff(names(wide), "session_id")
cc <- wide[complete.cases(wide[, vars]), vars, drop = FALSE]
cat("Complete sessions:", nrow(cc), "\\n")
method <- ${rStr(method)}
print(round(cor(cc, method = method), 3))
pairs <- combn(vars, 2, simplify = FALSE)
cors <- do.call(rbind, lapply(pairs, function(p) {
  t <- cor.test(cc[[p[1]]], cc[[p[2]]], method = method, exact = FALSE)
  data.frame(x = p[1], y = p[2], r = unname(t$estimate), p = t$p.value,
             lower = if (!is.null(t$conf.int)) t$conf.int[1] else NA, upper = if (!is.null(t$conf.int)) t$conf.int[2] else NA)
}))
print(cors, digits = 4)
${reg ? `
# Linear regression of ${c.dependentVar} on ${(c.predictorVars || []).join(", ")}
dv <- ${rStr(c.dependentVar)}
ivs <- ${rVec(c.predictorVars)}
rd <- wide[complete.cases(wide[, c(dv, ivs)]), c(dv, ivs)]
f <- reformulate(sprintf("\`%s\`", ivs), response = sprintf("\`%s\`", dv))
fit <- lm(f, data = rd)
print(summary(fit))
print(confint(fit))
if (length(ivs) > 1) { X <- model.matrix(fit)[, -1, drop = FALSE]; print(sapply(seq_len(ncol(X)), function(j) 1 / (1 - summary(lm(X[, j] ~ X[, -j]))$r.squared))) }  # VIF
` : ""}${logit ? `
# Logistic regression: outcome = ${c.dependentVar} >= ${Number(c.threshold)}
rd$outcome <- as.integer(rd[[dv]] >= ${Number(c.threshold)})
lfit <- glm(reformulate(sprintf("\`%s\`", ivs), response = "outcome"), family = binomial, data = rd)
print(summary(lfit))
print(exp(cbind(OR = coef(lfit), confint.default(lfit))))
` : ""}`;
}

function diagnosticR(c) {
  const preds = (c.predictorLabels || []).filter(p => p !== c.goldStandardLabel);
  const numericGs = c.goldStandardPositive != null && c.goldStandardPositive !== "" && isFinite(Number(c.goldStandardPositive));
  const hip = c.higherIsPositive || {};
  return `${need(["pROC"])}
library(pROC)

# Reference standard: ${c.goldStandardLabel} ${numericGs ? `>= ${Number(c.goldStandardPositive)}` : `== ${c.goldStandardPositive}`} counts as positive.
wide <- reshape(dat[, c("session_id", "measure", "value")], idvar = "session_id", timevar = "measure", direction = "wide")
names(wide) <- sub("^value\\\\.", "", names(wide))
gs <- ${rStr(c.goldStandardLabel)}
wide$positive <- ${numericGs ? `as.integer(!is.na(wide[[gs]]) & wide[[gs]] >= ${Number(c.goldStandardPositive)})` : `as.integer(as.character(wide[[gs]]) == ${rStr(c.goldStandardPositive)})`}
predictors <- ${rVec(preds)}
higher_is_positive <- c(${preds.map(p => `${rStr(p)} = ${hip[p] === false ? "FALSE" : "TRUE"}`).join(", ")})
alpha <- ${num(c.alpha, "0.05")}

for (p in predictors) {
  d <- wide[is.finite(wide[[p]]), ]
  r <- roc(d$positive, d[[p]], levels = c(0, 1), direction = if (higher_is_positive[[p]]) "<" else ">", quiet = TRUE)
  # DeLong variance; like the app, the interval is built on the logit scale so it stays in 0-1.
  a <- as.numeric(auc(r)); se <- sqrt(var(r, method = "delong"))
  z <- qnorm(1 - alpha / 2); l <- log(a / (1 - a)); sl <- se / (a * (1 - a))
  ci <- plogis(c(l - z * sl, l + z * sl))
  best <- coords(r, "best", best.method = "youden", ret = c("threshold", "sensitivity", "specificity"), transpose = FALSE)
  cat(sprintf("\\n%s: AUC %.3f, SE %.4f (%.0f%% CI %.3f to %.3f), n = %d (%d positive)\\n", p, a, se, 100 * (1 - alpha), ci[1], ci[2], nrow(d), sum(d$positive)))
  print(best)
}
# pROC gives the Youden threshold as a midpoint between two observed values; the app gives
# the observed value itself, with the same sensitivity and specificity.
# The app also reports calibration (Hosmer-Lemeshow) and cross-validated AUC${c.cvMethod ? ` (${c.cvMethod}${c.cvK ? `, k = ${c.cvK}` : ""}, seed ${c.cvSeed ?? "default"})` : ""};
# its random folds use its own generator, so cross-validated values won't match R exactly.`;
}

// ─── Script ──────────────────────────────────────────────────────────────────

export function buildRScript(study, sessions, calibration, { appVersion = "", now = new Date() } = {}) {
  const data = buildRData(study, sessions, calibration);
  const c = study?.config || {};
  const body = {
    descriptive: descriptiveR, reliability: reliabilityR, comparative: comparativeR,
    longitudinal: longitudinalR, correlation: correlationR, diagnostic: diagnosticR,
  }[study?.type];
  const head = `# ─────────────────────────────────────────────────────────────────────────────
# ${String(study?.name || "Study").replace(/\r?\n/g, " ")}
# ${study?.type || ""} study exported from Cephalometry Studio${appVersion ? ` ${appVersion}` : ""} on ${now.toISOString().slice(0, 10)}
#
# The data below are the exact values the app analyzed: each markup's primary
# measurement (mm when the session is calibrated, otherwise px; angles in degrees),
# in the patient-facing frame. Run the whole file in R (4.0 or later).
# Small differences from the app can come from rounding, quantile definitions and
# random cross-validation folds. Larger ones are worth reporting.
# ─────────────────────────────────────────────────────────────────────────────
`;
  const analysis = body ? body(c) : `# This study type has no standard R equivalent, so only its data are included.`;
  const empty = data.rows.length ? "" : `\nstop("This study has no measurement values yet. Map sessions to the study first.")\n`;
  return `${head}\n${dataBlock(data)}\n${empty}\n${analysis}\n`;
}

export function rScriptFilename(study) {
  return `${(study?.name || "study").replace(/[^\w-]+/g, "_")}.R`;
}

export function downloadRScript(study, sessions, calibration) {
  const blob = new Blob([buildRScript(study, sessions, calibration)], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = rScriptFilename(study);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
