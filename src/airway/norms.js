// ═══════════════════════════════════════════════════════════════════════════════
// Airway references. Every value here was checked against the page image of its
// paper (docs/AIRWAY_MODULE_REWRITE_PLAN.md §3.7–3.9). A reference applies only to
// the construction its paper used, so don't reuse one for a similar-sounding measure,
// and don't add one without its paper, table and page.
// ═══════════════════════════════════════════════════════════════════════════════

export const SOURCES = {
  mcnamara: {
    cite: "McNamara 1984",
    full: "McNamara JA Jr. A method of cephalometric evaluation. Am J Orthod 1984;86(6):449-469.",
    where: "Table I, p. 451",
    sample: "111 untreated adults with well-balanced faces and Class I occlusion (Ann Arbor)",
    magnification: 0.08,
  },
  mislik: {
    cite: "Mislik 2014",
    full: "Mislik B, et al. Pharyngeal airway dimensions: a cephalometric, growth-study-based analysis of physiological variations in children aged 6-17. Eur J Orthod 2014;36:331-339.",
    where: "Tables 4 and 5, p. 336",
    sample: "880 healthy untreated Swiss schoolchildren, 1981–84",
    magnification: 0.075,
  },
  fujioka: {
    cite: "Fujioka 1979",
    full: "Fujioka M, Young LW, Girdany BR. Radiographic evaluation of adenoidal size in children: adenoidal-nasopharyngeal ratio. AJR 1979;133:401-404.",
    where: "Table 1, p. 402",
    sample: "1,398 children referred for imaging, 1 month to 16 years",
    magnification: null, // a ratio doesn't depend on enlargement
  },
  perez: {
    cite: "Pérez-Rodríguez 2021",
    full: "Pérez-Rodríguez LM, et al. Airways cephalometric norms from a sample of Caucasian children. J Clin Exp Dent 2021;13(9):e941-7.",
    where: "Table 4, p. e944",
    sample: "480 Spanish children aged 6, 8, 10 and 12, Class I and II",
    magnification: undefined, // not stated in the paper
  },
  sfondrini: {
    cite: "Sfondrini 2024",
    full: "Sfondrini MF, et al. Upper airway dimensions among different skeletal malocclusions. Dent J 2024;12:12.",
    where: "Table 4, p. 7",
    sample: "120 untreated Italian adults aged 18–50, 40 per skeletal class",
    magnification: undefined, // not stated in the paper
  },
};

// Sex → [mean, sd] (Table I).
const MCNAMARA = {
  "mcnamara-upper": { F: [17.4, 3.4], M: [17.4, 4.3] },
  "mcnamara-lower": { F: [11.3, 3.3], M: [13.5, 4.3] },
};

// Age → sex → [median, IQR width]. The paper prints the width of the IQR, not its
// bounds. Tables 2–3 disagree with these at several ages; 4–5 match the overall means.
const MISLIK = {
  "mislik-p": {
    6: { F: [8.06, 3.95], M: [9.02, 3.29] }, 7: { F: [6.08, 2.11], M: [7.18, 4.52] },
    8: { F: [8.60, 4.70], M: [8.52, 3.29] }, 9: { F: [9.06, 4.05], M: [7.24, 4.20] },
    10: { F: [9.06, 3.67], M: [9.03, 2.97] }, 11: { F: [8.40, 3.63], M: [8.37, 4.32] },
    12: { F: [8.54, 4.60], M: [8.25, 3.35] }, 13: { F: [8.94, 3.57], M: [8.06, 2.22] },
    14: { F: [9.00, 3.37], M: [9.14, 2.99] }, 15: { F: [8.74, 3.62], M: [9.06, 3.90] },
    16: { F: [9.50, 2.93], M: [9.22, 4.40] }, 17: { F: [9.75, 3.55], M: [8.74, 2.52] },
  },
  "mislik-t": {
    6: { F: [11.00, 7.73], M: [9.66, 7.15] }, 7: { F: [9.06, 5.65], M: [9.63, 4.79] },
    8: { F: [8.54, 4.46], M: [11.29, 4.95] }, 9: { F: [10.44, 4.09], M: [8.77, 5.19] },
    10: { F: [9.08, 4.71], M: [9.77, 4.58] }, 11: { F: [10.13, 5.18], M: [9.61, 4.04] },
    12: { F: [9.85, 5.73], M: [9.06, 4.50] }, 13: { F: [9.22, 4.89], M: [9.06, 6.27] },
    14: { F: [9.22, 4.59], M: [9.85, 4.67] }, 15: { F: [9.75, 4.67], M: [10.75, 3.68] },
    16: { F: [9.22, 5.65], M: [10.05, 3.66] }, 17: { F: [11.78, 5.09], M: [9.93, 4.37] },
  },
};
const MISLIK_SMALL_GROUPS = { 6: 11, 7: 21 };

// [median age in years, mean, sd]. The paper prints the 12 y 6 m SD as ".542", a
// misprint (its neighbours are about .15), so that row has a mean only.
const FUJIOKA = [
  [0.125, 0.329, 0.1154], [0.375, 0.457, 0.1242], [0.75, 0.508, 0.1087], [1.25, 0.548, 0.1023],
  [1.75, 0.538, 0.0940], [2.5, 0.555, 0.0991], [3.5, 0.567, 0.1021], [4.5, 0.588, 0.1129],
  [5.5, 0.586, 0.1046], [6.5, 0.575, 0.1182], [7.5, 0.555, 0.1174], [8.5, 0.568, 0.1108],
  [9.5, 0.536, 0.1372], [10.5, 0.511, 0.1515], [11.5, 0.532, 0.1401], [12.5, 0.518, null],
  [13.5, 0.458, 0.1521], [14.5, 0.435, 0.1436], [15.5, 0.380, 0.1533],
];

// Age group → [mean, sd]. The printed header reads 6, 8, 12, 10, a misprint: the
// paper's text gives upper airway 10.11 at age 10 and 11.41 at age 12.
const PEREZ = {
  "pns-ad1": { 6: [19.578, 2.509], 8: [22.479, 2.265], 10: [24.914, 2.959], 12: [26.155, 2.633] },
  "ad1-ba": { 6: [26.626, 2.884], 8: [25.104, 2.567], 10: [23.215, 2.784], 12: [23.342, 2.541] },
  "pns-ba": { 6: [45.916, 3.383], 8: [47.245, 2.857], 10: [48.295, 3.273], 12: [49.169, 2.898] },
  "ptm-ba": { 6: [44.652, 2.851], 8: [45.236, 2.941], 10: [46.028, 2.998], 12: [47.056, 3.704] },
  "pns-h": { 6: [28.088, 2.166], 8: [29.518, 2.071], 10: [30.722, 2.141], 12: [31.679, 2.332] },
};

// Skeletal class → [mean, sd].
const SFONDRINI = {
  nl: { I: [19.88, 3.30], II: [21.07, 3.49], III: [17.26, 3.37] },
  pd: { I: [21.06, 3.22], II: [21.97, 3.45], III: [18.41, 3.45] },
  spas: { I: [11.95, 2.36], II: [12.57, 2.96], III: [11.25, 3.07] },
  mas: { I: [8.99, 2.37], II: [10.19, 2.98], III: [10.08, 3.06] },
  "pas-min": { I: [11.11, 2.85], II: [11.41, 3.40], III: [11.19, 3.52] },
  ias: { I: [10.73, 2.51], II: [10.97, 3.39], III: [10.30, 3.33] },
  lpw: { I: [14.02, 3.24], II: [13.89, 3.02], III: [12.58, 3.75] },
  pl: { I: [33.29, 4.33], II: [30.93, 5.43], III: [30.85, 5.80] },
  pt: { I: [9.38, 1.64], II: [9.37, 2.61], III: [9.71, 2.51] },
  mph: { I: [12.81, 4.72], II: [13.18, 5.30], III: [14.64, 4.17] },
};

export const reference = {
  // → { source, kind, group, mean, sd, median, iqr, warning } or { reason }.
  lookup(measureId, { age, sex, skeletalClass }) {
    if (MCNAMARA[measureId]) {
      if (age === null) return { reason: "Add the patient's age to compare" };
      if (age < 18) return { reason: "This reference is for adults" };
      if (!sex) return { reason: "Add the patient's sex to compare" };
      const [mean, sd] = MCNAMARA[measureId][sex];
      return { source: SOURCES.mcnamara, kind: "meanSd", mean, sd, group: sex === "F" ? "women" : "men" };
    }
    if (MISLIK[measureId]) {
      if (age === null) return { reason: "Add the patient's age to compare" };
      const year = Math.floor(age);
      if (year < 6 || year > 17) return { reason: "This reference covers ages 6–17" };
      if (!sex) return { reason: "Add the patient's sex to compare" };
      const [median, iqr] = MISLIK[measureId][year][sex];
      return {
        source: SOURCES.mislik, kind: "medianIqr", median, iqr,
        group: `${sex === "F" ? "girls" : "boys"} aged ${year}`,
        warning: MISLIK_SMALL_GROUPS[year] ? `Only ${MISLIK_SMALL_GROUPS[year]} children at this age.` : null,
      };
    }
    if (measureId === "an-ratio") {
      if (age === null) return { reason: "Add the patient's age to compare" };
      if (age >= 16) return { reason: "This reference covers ages up to 16" };
      const target = age < 1 ? age : Math.floor(age) + 0.5;
      const row = FUJIOKA.reduce((best, r) => (Math.abs(r[0] - target) < Math.abs(best[0] - target) ? r : best));
      return { source: SOURCES.fujioka, kind: "meanSd", mean: row[1], sd: row[2], group: `median age ${row[0]} years`, warning: row[2] === null ? "The paper's SD for this age is misprinted, so only the mean is shown." : null };
    }
    if (PEREZ[measureId]) {
      if (age === null) return { reason: "Add the patient's age to compare" };
      const year = Math.floor(age);
      if (year < 6 || year > 13) return { reason: "This reference covers ages 6–12" };
      const group = Math.min(12, year - (year % 2));
      const [mean, sd] = PEREZ[measureId][group];
      return { source: SOURCES.perez, kind: "meanSd", mean, sd, group: group === year ? `age ${group}` : `age ${group} (nearest published group)` };
    }
    if (SFONDRINI[measureId]) {
      if (age === null) return { reason: "Add the patient's age to compare" };
      if (age < 18 || age > 50) return { reason: "This reference covers ages 18–50" };
      if (!skeletalClass) return { reason: "Place S, N, A and B to find the skeletal class" };
      const [mean, sd] = SFONDRINI[measureId][skeletalClass];
      return { source: SOURCES.sfondrini, kind: "meanSd", mean, sd, group: `skeletal Class ${skeletalClass}` };
    }
    return { reason: "No published reference for this construction" };
  },
};

// Skeletal class from ANB, as Sfondrini 2024 defines it (p. 2–3).
export function skeletalClassFromAnb(anb) {
  if (typeof anb !== "number" || !isFinite(anb)) return null;
  if (anb > 4) return "II";
  if (anb < 0) return "III";
  return "I";
}

// Every reference value in table form, for tests and audits.
export const REFERENCE_TABLES = { MCNAMARA, MISLIK, FUJIOKA, PEREZ, SFONDRINI };
