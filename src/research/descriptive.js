import { computeMeasurements, chi2CDF, tDistributeCDF } from "../lib/utils.js";
import { unitForKey, dominantUnit } from "./collect.js";
import { logError } from "../lib/logger.js";

// ─── Statistical helpers ──────────────────────────────────────────────────
function stdNormalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a = 0.3193815, b = -0.3565638, c = 1.7814779, d = -1.8212559, e = 1.3302744;
  const phi = 0.39894228 * Math.exp(-x * x / 2);
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  t = phi * t * (a + t * (b + t * (c + t * (d + t * e))));
  return x > 0 ? 1 - t : t;
}

function tCritical(p, df) {
  if (df <= 0) return 1.96;
  // For df > 1000 use z approximation
  if (df > 1000) return p >= 0.995 ? 2.576 : p >= 0.975 ? 1.96 : p >= 0.95 ? 1.645 : 0;
  // For df <= 1000, invert tDistributeCDF by bisection (exact)
  const target = p;
  let lo = 0.0, hi = 8.0, mid;
  for (let it = 0; it < 60; it++) {
    mid = (lo + hi) / 2;
    const cdf = tDistributeCDF(mid, df);
    if (cdf < target) lo = mid; else hi = mid;
    if (Math.abs(cdf - target) < 1e-10) break;
  }
  return (lo + hi) / 2;
}

// ─── Descriptive statistics for a single group of values ─────────────────
function descriptiveStats(values) {
  const n = values.length;
  if (n === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const sem = sd / Math.sqrt(n);

  const percentile = (p) => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const skewness = sd > 0
    ? values.reduce((a, v) => a + ((v - mean) / sd) ** 3, 0) * n / ((n - 1) * (n - 2))
    : 0;

  const excessKurtosis = n >= 4 && sd > 0
    ? (values.reduce((a, v) => a + ((v - mean) / sd) ** 4, 0) * n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)))
      - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3))
    : 0;

  const tCrit = tCritical(0.975, n - 1);
  const ciMean = [mean - tCrit * sem, mean + tCrit * sem];

  // D'Agostino-Pearson omnibus K² normality test (combined skewness + kurtosis)
  const sk = skewness;
  const ku = excessKurtosis;
  const zSk = n >= 8 ? sk / Math.sqrt(6 / n) : 0;
  const zKu = n >= 8 ? ku / Math.sqrt(24 / n) : 0;
  const k2 = zSk * zSk + zKu * zKu;
  const pNormal = n >= 8 ? 1 - chi2CDF(k2, 2) : 0;
  const isNormal = pNormal > 0.01; // 99% confidence

  return {
    n, mean, sd, sem, variance,
    min: sorted[0], max: sorted[n - 1],
    median: percentile(50),
    q1: percentile(25), q3: percentile(75),
    iqr: percentile(75) - percentile(25),
    p5: percentile(5), p95: percentile(95),
    p2_5: percentile(2.5), p97_5: percentile(97.5),
    skewness: sk, kurtosis: ku,
    ciMean,
    isNormal,
  };
}

// ─── Reference interval ──────────────────────────────────────────────────
function referenceInterval(values, coverage = 0.95) {
  const stats = descriptiveStats(values);
  if (!stats || stats.n < 3) return null;

  const z = 1.96; // for 95% coverage
  const n = stats.n;

  // Parametric
  const lower = stats.mean - z * stats.sd;
  const upper = stats.mean + z * stats.sd;

  // CI for limits (Reed method approximation). The previous version used tCritical(0.95)
  // which gives a 90% two-sided CI mislabeled as "95%". Use t(0.975) for a proper 95% CI.
  const seLimit = stats.sd * Math.sqrt(1 / n + z * z / (2 * n));
  const tC = tCritical(0.975, n - 1);
  const lowerCi = [lower - tC * seLimit, lower + tC * seLimit];
  const upperCi = [upper - tC * seLimit, upper + tC * seLimit];

  // Non-parametric (order statistics). CLSI/IFCC recommends n ≥ 120 for stable
  // non-parametric reference intervals; warn when below this threshold.
  const sorted = [...values].sort((a, b) => a - b);
  const alpha = 1 - coverage;
  const rankLo = Math.max(0, Math.round(n * alpha / 2) - 1);
  const rankHi = Math.min(n - 1, Math.round(n * (1 - alpha / 2)) - 1);
  const npWarning = n < 120 ? `Non-parametric RI requires n ≥ 120 for stable limits (CLSI EP28-A3c); current n = ${n}. Treat the non-parametric limits with caution.` : null;

  return {
    coverage,
    method: stats.isNormal ? "parametric" : "non-parametric",
    parametric: { lower, upper, lowerCi, upperCi },
    nonParametric: { lower: sorted[rankLo], upper: sorted[rankHi] },
    nonParametricWarning: npWarning,
    recommendedLower: stats.isNormal ? lower : sorted[rankLo],
    recommendedUpper: stats.isNormal ? upper : sorted[rankHi],
  };
}

// ─── Z-score computation ─────────────────────────────────────────────────
// Direction-aware severity: in cephalometrics, a value above and below the norm
// have different clinical meanings (e.g. ANB +3 = Class II, ANB −3 = Class III).
// The previous version used only |z| with generic labels (Mild/Moderate/Severe)
// that ignored direction. We now report direction-specific interpretation.
function computeZScore(value, norm) {
  if (!norm || norm.sd === 0 || value == null) return null;
  const z = (value - norm.mean) / norm.sd;
  const percentileRank = stdNormalCdf(z) * 100;
  const abs = Math.abs(z);
  const direction = z > 0 ? "above" : z < 0 ? "below" : "at";

  // Standard SD-based severity banding (direction-agnostic magnitude)
  let level, clinical;
  if (abs < 1) { level = "Within 1 SD"; clinical = "Normal"; }
  else if (abs < 2) { level = "1–2 SD"; clinical = "Mild deviation"; }
  else if (abs < 3) { level = "2–3 SD"; clinical = "Moderate deviation"; }
  else { level = ">3 SD"; clinical = "Severe deviation"; }

  // Direction-specific clinical note for well-known cephalometric measures
  let directionNote = null;
  if (norm.label === "ANB") {
    if (z > 2) directionNote = "Class II skeletal pattern (ANB above norm)";
    else if (z < -2) directionNote = "Class III skeletal pattern (ANB below norm)";
  } else if (norm.label === "SNA") {
    if (z > 2) directionNote = "Maxillary prognathism (SNA above norm)";
    else if (z < -2) directionNote = "Maxillary retrognathism (SNA below norm)";
  } else if (norm.label === "SNB") {
    if (z > 2) directionNote = "Mandibular prognathism (SNB above norm)";
    else if (z < -2) directionNote = "Mandibular retrognathism (SNB below norm)";
  }

  return { z, percentileRank, level, clinical, direction, directionNote };
}

// ─── Built-in reference norms ────────────────────────────────────────────
// Cephalometric norms vary substantially by growth stage (pre-pubertal vs.
// post-pubertal), sex, and population. Two mechanisms guard against the
// previous silent misclassification (one adult value applied to a 9y-o and a
// 45y-o):
//   1. `strata`: an optional array of { group, ageMin, ageMax, sex, values }
//      strata. When present, selectNormStratum() picks the age/sex-matched
//      stratum and its values override the top-level `values` for any label
//      the stratum defines.
//   2. Mismatch warning: when no stratum matches and the patient's age falls
//      outside the norm's `ageRange`, a warning is attached to the z-score
//      so the UI can flag a likely-misapplied norm.
import { DEFAULT_NORMS } from "../data/norms.js";

function _normsToValues(norms) {
  const values = {};
  for (const n of norms) values[n.label] = { mean: n.mean, sd: n.sd };
  return values;
}

function _buildAnalysis(id, label, src, overrideValues) {
  const ref = DEFAULT_NORMS[label];
  return { id, label: src.label || label, source: src.source || ref.source, population: src.population || ref.population, ageRange: src.ageRange || ref.ageRange, sex: src.sex || ref.sex, stratification: src.stratification || ref.stratification, values: overrideValues || _normsToValues(ref.norms) };
}

export const RESEARCH_NORMS = [
  _buildAnalysis("steiner", "Steiner", {
    label: "Steiner (Caucasian)",
    population: "Caucasian (North American)", ageRange: "Adult", sex: "Pooled (male + female)",
    stratification: "Not stratified by age, sex, or ethnicity. Applies a single adult value to all patients.",
  }),
  _buildAnalysis("downs", "Downs", {
    label: "Downs (Caucasian)",
    population: "Caucasian (North American)", ageRange: "Adolescent (12-17y)", sex: "Pooled (male + female)",
    stratification: "Not stratified by age, sex, or ethnicity. Based on adolescent subjects — may not apply to adults.",
  }, {
    "Facial angle": { mean: 87.8, sd: 3.6 },
    "Convexity": { mean: 0, sd: 5.9 },
    "AB plane": { mean: -4.6, sd: 3.7 },
    "Mandibular plane": { mean: 21.9, sd: 3.7 },
    "Y-axis": { mean: 59.4, sd: 3.8 },
    "Occlusal plane": { mean: 9.3, sd: 3.8 },
    "Interincisal": { mean: 135.4, sd: 5.8 },
    "U1-L1": { mean: 135.4, sd: 5.8 },
  }),
  {
    id: "mcnamara",
    label: "McNamara",
    values: {
      "Maxillary Depth": { mean: 90, sd: 3 },
      "Facial Depth": { mean: 88, sd: 3 },
      "ANB": { mean: 2, sd: 2 },
      "Lower facial height": { mean: 47, sd: 4 },
    },
    strata: [
      { group: "Child (9y) — male",   ageMin: 7,  ageMax: 10, sex: "male",   values: { "Effective Mandibular Length (Co-Gn)": { mean: 117, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 90, sd: 4 } } },
      { group: "Child (9y) — female", ageMin: 7,  ageMax: 10, sex: "female", values: { "Effective Mandibular Length (Co-Gn)": { mean: 115, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 88, sd: 4 } } },
      { group: "Adolescent (12y) — male",   ageMin: 11, ageMax: 13, sex: "male",   values: { "Effective Mandibular Length (Co-Gn)": { mean: 125, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 94, sd: 4 } } },
      { group: "Adolescent (12y) — female", ageMin: 11, ageMax: 13, sex: "female", values: { "Effective Mandibular Length (Co-Gn)": { mean: 120, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 92, sd: 4 } } },
      { group: "Adolescent (15y) — male",   ageMin: 14, ageMax: 17, sex: "male",   values: { "Effective Mandibular Length (Co-Gn)": { mean: 132, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 97, sd: 4 } } },
      { group: "Adolescent (15y) — female", ageMin: 14, ageMax: 17, sex: "female", values: { "Effective Mandibular Length (Co-Gn)": { mean: 125, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 94, sd: 4 } } },
      { group: "Adult (≥18y) — male",   ageMin: 18, ageMax: 120, sex: "male",   values: { "Effective Mandibular Length (Co-Gn)": { mean: 138, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 99, sd: 4 } } },
      { group: "Adult (≥18y) — female", ageMin: 18, ageMax: 120, sex: "female", values: { "Effective Mandibular Length (Co-Gn)": { mean: 128, sd: 6 }, "Effective Maxillary Length (Co-A)": { mean: 95, sd: 4 } } },
    ],
    source: "McNamara JA. A method of cephalometric evaluation. Am J Orthod. 1984;86(6):449-469. Linear age/sex-stratified values reproduced from McNamara & Brudon, Orthodontic and Orthopedic Cephalometry.",
    population: "Caucasian (North American)",
    ageRange: "Stratified (7y through adult)",
    sex: "Stratified (male / female)",
    stratification: "Maxillary Depth, Facial Depth, and ANB are age-stable angular measurements shared across strata. Lower facial height is also age-stable. Linear effective-length measurements (Co-Gn, Co-A) are stratified by age and sex. Means are approximate and vary slightly by source (±1-2 mm); verify against a population-matched reference before clinical use.",
  },
];

// Generic warning for any normative comparison
export const NORM_WARNING = "Reference norms are population-specific. Values not stratified by age, sex, or ethnicity may not apply to the patient being analyzed. Interpret z-scores with caution and consider using population-matched norms.";

// ─── Age/sex-aware norm stratum selection ─────────────────────────────────
// Given a norm (which may carry a `strata` array) and the patient's age/sex,
// pick the matching stratum and merge its values over the top-level values.
// Returns { values, stratum, warning } where `warning` is non-null when the
// patient context is missing or falls outside the norm's applicability.
export function selectNormStratum(norm, patientAge, patientSex) {
  const base = { ...(norm.values || {}) };
  if (!norm.strata || norm.strata.length === 0) {
    return { values: base, stratum: null, warning: ageRangeMismatch(norm.ageRange, patientAge, norm.sex) };
  }
  let matched = null;
  if (patientAge != null) {
    const byAge = norm.strata.filter(s => patientAge >= (s.ageMin ?? -Infinity) && patientAge <= (s.ageMax ?? Infinity));
    if (byAge.length > 0) {
      matched = byAge.find(s => patientSex && s.sex === patientSex) || byAge.find(s => !s.sex || s.sex === "pooled") || byAge[0];
    }
  }
  if (!matched) matched = norm.strata.find(s => /adult/i.test(s.group || "")) || norm.strata[0];
  const merged = { ...base, ...(matched.values || {}) };
  let warning = null;
  if (patientAge == null) {
    warning = `No patient age provided — using the "${matched.group}" stratum. Enter the patient age for an age-matched comparison.`;
  } else if (patientSex && matched.sex && matched.sex !== patientSex) {
    warning = `No stratum for sex "${patientSex}" at age ${patientAge}; using "${matched.group}".`;
  }
  return { values: merged, stratum: matched, warning };
}

function ageRangeMismatch(ageRange, patientAge, sexField) {
  if (patientAge == null || !ageRange) return null;
  const ar = String(ageRange).toLowerCase();
  if (/adult/.test(ar) && patientAge < 16) {
    return `Patient age ${patientAge} is below the adult range of this norm ("${ageRange}"). Applying adult values to a growing patient can systematically misclassify skeletal pattern.`;
  }
  if (/adolescent/.test(ar) && (patientAge < 11 || patientAge > 17)) {
    return `Patient age ${patientAge} is outside the adolescent range of this norm ("${ageRange}").`;
  }
  if (/child/.test(ar) && patientAge > 12) {
    return `Patient age ${patientAge} is above the child range of this norm ("${ageRange}").`;
  }
  if (sexField && /male/.test(sexField) && patientAge != null) return null;
  return null;
}

// ─── Collect measurement values per label from sessions ──────────────────
function collectMeasurements(sessions, labelIds, calibration) {
  const byLabel = {};
  for (const s of sessions) {
    if (!s) continue;
    const cal = s.calibration?.done ? s.calibration : calibration || { done: false, pxPerMm: 1 };
    const markups = s.markups || [];
    for (const m of markups) {
      if (!m.label) continue;
      if (labelIds.length > 0 && !labelIds.includes(m.label)) continue;
      if (m.type === "ruler" || m.type === "silhouette") continue;
      if (!m.visible || !m.placed) continue;
        try {
          const vals = computeMeasurements(m, cal);
          for (const [key, raw] of Object.entries(vals)) {
            if (typeof raw !== "number" || !isFinite(raw)) continue;
            if (!byLabel[m.label]) byLabel[m.label] = [];
            byLabel[m.label].push({ value: raw, key, sessionId: s.id, unit: unitForKey(key, vals._unit) });
          }
          // If no specific measureKey, also push the first numeric value
          if (!Object.keys(vals).some(k => typeof vals[k] === "number")) {
            const first = Object.values(vals).find(v => typeof v === "number" && isFinite(v));
            if (first != null) {
              if (!byLabel[m.label]) byLabel[m.label] = [];
              byLabel[m.label].push({ value: first, key: "value", sessionId: s.id, unit: vals._unit === "mm" ? "mm" : "px" });
            }
          }
        } catch (e) { logError("descriptive/collect", e); }
    }
  }
  return byLabel;
}

// ─── Group sessions by demographic variable ──────────────────────────────
function groupSessions(sessions, groupBy) {
  if (groupBy === "none") return { All: sessions };

  const groups = {};
  for (const s of sessions) {
    if (!s) continue;
    let key = "Unknown";
    if (groupBy === "group") key = s.meta?.group || "Ungrouped";
    else if (groupBy === "operator") key = s.meta?.operatorId || "Unknown";
    else if (groupBy === "patient") key = s.meta?.patientId || "Unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

// ─── Main entry point ────────────────────────────────────────────────────
export function runDescriptiveAll(sessions, config, calibration) {
  const { labelIds, groupBy, referenceNorms } = config;

  const groups = groupSessions(sessions, groupBy || "none");
  const groupNames = Object.keys(groups);

  const results = {
    groups: {},
    groupOrder: groupNames,
    combined: {},
    referenceNorms: referenceNorms || [],
    predefinedNorms: RESEARCH_NORMS,
  };

  for (const gName of groupNames) {
    const gSessions = groups[gName];
    const byLabel = collectMeasurements(gSessions, labelIds || [], calibration);
    const groupResult = { sessions: gSessions.length, labels: {} };

    for (const [label, samples] of Object.entries(byLabel)) {
      const values = samples.map(s => s.value);
      const stats = descriptiveStats(values);
      const refInterval = referenceInterval(values);
      groupResult.labels[label] = { values, stats, referenceInterval: refInterval, unit: dominantUnit(samples, "key") };
    }

    results.groups[gName] = groupResult;
  }

  // Combined (all sessions)
  const allByLabel = collectMeasurements(sessions, labelIds || [], calibration);
  for (const [label, samples] of Object.entries(allByLabel)) {
    const values = samples.map(s => s.value);
    const stats = descriptiveStats(values);
    const refInterval = referenceInterval(values);
    results.combined[label] = { values, stats, referenceInterval: refInterval, unit: dominantUnit(samples, "key") };
  }

  // Compute z-scores against reference norms
  if (referenceNorms && referenceNorms.length > 0) {
    results.zScores = {};
    // Patient context for age/sex-aware norm stratum selection. Prefer an
    // explicit config value; otherwise infer from session meta if all sessions
    // agree (e.g. a single-patient study).
    let patientAge = config.patientAge != null ? Number(config.patientAge) : null;
    let patientSex = config.patientSex || null;
    if (patientAge == null || !patientSex) {
      const ages = sessions.map(s => s.meta?.age).filter(a => a != null && a !== "");
      const sexes = sessions.map(s => s.meta?.sex).filter(sx => sx != null && sx !== "");
      if (patientAge == null && ages.length > 0 && new Set(ages).size === 1) patientAge = Number(ages[0]);
      if (!patientSex && sexes.length > 0 && new Set(sexes).size === 1) patientSex = sexes[0];
    }
    results.patientContext = { age: patientAge, sex: patientSex };
    for (const norm of referenceNorms) {
      results.zScores[norm.id] = {};
      const sel = selectNormStratum(norm, patientAge, patientSex);
      for (const [label, data] of Object.entries(results.combined)) {
        const normVal = sel.values?.[label];
        if (normVal) {
          results.zScores[norm.id][label] = {
            norm: normVal,
            zScore: computeZScore(data.stats?.mean, { ...normVal, label }),
            stratum: sel.stratum ? sel.stratum.group : null,
            ageSexWarning: sel.warning,
          };
        }
      }
      if (sel.warning) results.zScores[norm.id]._stratumWarning = sel.warning;
    }
  }

  return results;
}
