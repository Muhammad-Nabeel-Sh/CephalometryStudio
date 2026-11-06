// ═══════════════════════════════════════════════════════════════════════════════
// NORMS — Single source of truth for cephalometric reference norms
// All modules (constants.js, descriptive.js) MUST import from here.
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_NORMS = {
  Steiner: {
    source: "Steiner, 1953 / Am J Orthod",
    citation: "Steiner CC. Cephalometrics for you and me. Am J Orthod. 1953;39(10):729-755.",
    sdApproximate: true,
    sdNote: "Steiner published mean values only; the SDs here are conventional approximations, so z-scores and severity bands are indicative.",
    population: "Caucasian (North American)",
    ageRange: "Adult",
    sex: "Pooled (male + female)",
    stratification: "Not stratified by age, sex, or ethnicity. Single adult value — do not apply to growing patients.",
    norms: [
      { label: "SNA", mean: 82, sd: 2, type: "angle" },
      { label: "SNB", mean: 80, sd: 2, type: "angle" },
      { label: "ANB", mean: 2, sd: 2, type: "angle" },
      { label: "SN-MP", mean: 32, sd: 2, type: "angle" },
      { label: "GoGn-SN", mean: 32, sd: 2, type: "angle" },
      { label: "SN-Occ", mean: 14, sd: 2, type: "angle" },
      { label: "U1-NA", mean: 22, sd: 2, type: "angle" },
      { label: "U1-NA-mm", mean: 4, sd: 2, type: "length" },
      { label: "L1-NB", mean: 25, sd: 2, type: "angle" },
      { label: "L1-NB-mm", mean: 4, sd: 2, type: "length" },
      { label: "Interincisal", mean: 131, sd: 5, type: "angle" },
      { label: "U1-L1", mean: 131, sd: 5, type: "angle" },
    ],
  },
  Ricketts: {
    source: "Ricketts, 1960 / Am J Orthod",
    citation: "Ricketts RM. A foundation for cephalometric communication. Am J Orthod. 1960;46(5):330-357.",
    population: "Caucasian (North American)",
    ageRange: "Mixed (growing and adult)",
    sex: "Pooled (male + female)",
    stratification: "Not stratified by age or sex in this table. Ricketts' original norms are age-stratified — verify against age-matched source.",
    norms: [
      { label: "Facial axis", mean: 90, sd: 3, type: "angle" },
      { label: "Facial depth", mean: 87, sd: 3, type: "angle" },
      { label: "Mandibular plane", mean: 26, sd: 4, type: "angle" },
      { label: "Lower facial height", mean: 47, sd: 4, type: "angle" },
      { label: "Mandibular arc", mean: 26, sd: 4, type: "angle" },
      { label: "Convexity", mean: 2, sd: 2, type: "length" },
      { label: "Interincisal", mean: 130, sd: 6, type: "angle" },
      { label: "U1-APog", mean: 28, sd: 4, type: "angle" },
      { label: "U1-APog-mm", mean: 3.5, sd: 2.5, type: "length" },
      { label: "L1-APog", mean: 22, sd: 4, type: "angle" },
      { label: "L1-APog-mm", mean: 1.5, sd: 2, type: "length" },
    ],
  },
  Downs: {
    source: "Downs, 1948 / Am J Orthod",
    citation: "Downs WB. Variations in facial relationships: their significance in treatment and prognosis. Am J Orthod. 1948;34(10):812-840.",
    population: "Caucasian (North American)",
    ageRange: "Adolescent (12-17y)",
    sex: "Pooled (male + female)",
    stratification: "Not stratified by age, sex, or ethnicity. Based on adolescent subjects — may not apply to adults.",
    norms: [
      { label: "Facial angle", mean: 87.8, sd: 3.6, type: "angle" },
      { label: "Angle of convexity", mean: 0, sd: 5.1, type: "angle", note: "Signed: positive = convex (A anterior to N-Pog)." },
      { label: "AB plane angle", mean: -4.6, sd: 3.7, type: "angle", note: "Signed: negative = B posterior to A, relative to the facial plane." },
      { label: "Mandibular plane", mean: 21.9, sd: 3.7, type: "angle" },
      { label: "Y-axis", mean: 59.4, sd: 3.8, type: "angle" },
      { label: "Occlusal plane", mean: 9.3, sd: 3.8, type: "angle" },
      { label: "Interincisal", mean: 135.4, sd: 5.8, type: "angle" },
      { label: "U1-L1", mean: 135.4, sd: 5.8, type: "angle" },
    ],
  },
  McNamara: {
    source: "McNamara, 1984 / Am J Orthod",
    citation: "McNamara JA Jr. A method of cephalometric evaluation. Am J Orthod. 1984;86(6):449-469.",
    population: "Caucasian (North American)",
    ageRange: "Mixed (children and adults, not separated)",
    sex: "Pooled (male + female)",
    stratification: "Adult female values (McNamara 1984). Effective lengths are size- and sex-dependent (male: Co-A 99.8±6.0, Co-Gn 134.3±6.8, ANS-Me 74.6±5.0); children: A to N-perp ≈ 0 mm, Pog to N-perp ≈ −8 to −6 mm.",
    norms: [
      { label: "A to N-perp", mean: 1, sd: 2, type: "length" },
      { label: "Pog to N-perp", mean: -1, sd: 4, type: "length" },
      { label: "Co-A", mean: 91, sd: 4.3, type: "length" },
      { label: "Co-Gn", mean: 120.2, sd: 5.3, type: "length" },
      { label: "MMD", mean: 29.2, sd: 3.5, type: "length", note: "SD approximate (derived)." },
      { label: "ANS-Me", mean: 66.7, sd: 4.1, type: "length" },
      { label: "U1 to A-vertical", mean: 5, sd: 1.5, type: "length" },
      { label: "Lower incisor to A-Pog", mean: 2, sd: 1, type: "length" },
    ],
  },
  "Bjork-Jarabak": {
    source: "Jarabak, 1972",
    population: "Caucasian (Scandinavian)",
    ageRange: "Mixed (growing and adult)",
    sex: "Pooled (male + female)",
    stratification: "Not stratified by age or sex in this table. Björk-Jarabak proportions are growth-stage sensitive — verify against age-matched source.",
    norms: [
      { label: "Sum of angles", mean: 396, sd: 6, type: "angle" },
      { label: "N-S-Ar", mean: 123, sd: 5, type: "angle" },
      { label: "S-Ar-Go", mean: 143, sd: 6, type: "angle" },
      { label: "Ar-Go-Me", mean: 130, sd: 7, type: "angle" },
      { label: "ML-NSL", mean: 32, sd: 2, type: "angle" },
      { label: "NL-NSL", mean: 8.5, sd: 3, type: "angle" },
    ],
  },
  Tweed: {
    source: "Tweed, 1954",
    citation: "Tweed CH. The Frankfort-mandibular incisor angle (FMIA) in orthodontic diagnosis, treatment planning and prognosis. Angle Orthod. 1954;24(3):121-169.",
    sdApproximate: true,
    sdNote: "Tweed gave target ranges, not SDs; the SDs here are approximations.",
    population: "Caucasian (North American)",
    ageRange: "Adult",
    sex: "Pooled (male + female)",
    stratification: "Not stratified by age, sex, or ethnicity. Single adult value — do not apply to growing patients.",
    norms: [
      { label: "FMA", mean: 25, sd: 3, type: "angle" },
      { label: "FMIA", mean: 65, sd: 3, type: "angle" },
      { label: "IMPA", mean: 90, sd: 3, type: "angle" },
      { label: "SNA", mean: 82, sd: 2, type: "angle" },
      { label: "SNB", mean: 80, sd: 2, type: "angle" },
      { label: "ANB", mean: 2, sd: 2, type: "angle" },
    ],
  },
};

// Norms whose SD was not published by the source (conventional approximations).
// Steiner and Tweed gave means/ranges only, and many compiled analyses copy
// Steiner's SNA/SNB/ANB ±2°. These are flagged so z-scores read as indicative.
const APPROXIMATE_SD_ANALYSES = new Set(["Steiner Analysis", "Tweed Analysis", "General Ceph Analysis"]);
const STEINER_COPIES = new Set(["SNA", "SNB", "ANB", "S-N-A", "S-N-B", "A-N-B"]);

export function isApproximateSd(analysisName, label, sd) {
  if (APPROXIMATE_SD_ANALYSES.has(analysisName)) return true;
  return STEINER_COPIES.has(label) && sd === 2;
}

export const AIRWAY_NORMS = {
  // Sources not yet checked against the originals; see docs/AIRWAY_MODULE_REWRITE_PLAN.md.
  "MP-H": { mean: 12.3, sd: 3.5, source: "Bibby 1984 (not yet verified)" },
  "SP-Length": { mean: 32.4, sd: 3.2, source: "Lowe 1985 (not yet verified)" },
};

