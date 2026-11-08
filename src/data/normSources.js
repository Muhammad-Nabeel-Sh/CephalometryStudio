// ═══════════════════════════════════════════════════════════════════════════════
// normSources.js — where each analysis's norms come from (audit: docs/NORM_AUDIT.md)
//
// One entry per analysis in Data/AnalysisMeasurements.csv and per norm preset in
// norms.js. `sd` says whether the cited source itself published standard
// deviations for its norms:
//   "published"   the source reports means with SDs (the values in the app have
//                 NOT yet been checked row by row against its tables)
//   "approximate" the source gave means or target ranges only; the app's SDs are
//                 conventional approximations
//   "unsourced"   no primary source with SDs is identified for this table
// z-scores and severity grades from anything but "published" are flagged.
// `pmid`/`doi` are filled only when PubMed confirmed them (2026-11-08). A citation
// without a PMID was not verified (older journals and books aren't indexed); an
// empty citation means no source is known.
// ═══════════════════════════════════════════════════════════════════════════════

const AJO = "Am J Orthod";

export const NORM_SOURCES = {
  "Steiner Analysis": { citation: `Steiner CC. Cephalometrics for you and me. ${AJO}. 1953;39(10):729-755.`, population: "North American (white), adult", sd: "approximate", note: "Steiner published mean values only." },
  "Tweed Analysis": { citation: "Tweed CH. The Frankfort-mandibular incisor angle (FMIA) in orthodontic diagnosis, treatment planning and prognosis. Angle Orthod. 1954;24(3):121-169.", population: "North American (white), adult", sd: "approximate", note: "Tweed gave target values and ranges, not SDs." },
  "General Ceph Analysis": { citation: "Compiled from Steiner (1953) and Downs (1948).", sd: "approximate", note: "A compiled table; its ±2° values are Steiner's conventional SDs." },
  "Downs Analysis": { citation: `Downs WB. Variations in facial relationships: their significance in treatment and prognosis. ${AJO}. 1948;34(10):812-840.`, pmid: "18882558", doi: "10.1016/0002-9416(48)90015-3", population: "North American (white), 12-17 years, excellent occlusion (n = 20)", sd: "published" },
  "McNamara Analysis": { citation: `McNamara JA Jr. A method of cephalometric evaluation. ${AJO}. 1984;86(6):449-469.`, pmid: "6594933", doi: "10.1016/s0002-9416(84)90352-x", population: "North American (white) adults with well-balanced faces (Bolton, Burlington, Ann Arbor samples)", sd: "published", note: "Length norms are size- and sex-dependent." },
  "Ricketts Analysis": { citation: "Ricketts RM. A foundation for cephalometric communication. Am J Orthod. 1960;46(5):330-357.", population: "North American (white), age 9 values with growth changes", sd: "unsourced", note: "Ricketts' 'clinical deviations' come from his later publications; which values the app uses has not been traced." },
  "Ricketts PA": { citation: "Ricketts RM et al. Orthodontic diagnosis and planning. Rocky Mountain Orthodontics; 1982.", population: "North American (white)", sd: "unsourced" },
  "Bjork Analysis": { citation: "Björk A. The face in profile. Sven Tandlak Tidskr. 1947;40(5B, suppl).", population: "Swedish boys (12 years) and conscripts (21-23 years)", sd: "unsourced", note: "Björk's tables have SDs, but the app's values have not been traced to them." },
  "Jarv-Bjork": { citation: "Jarabak JR, Fizzell JA. Technique and treatment with light-wire edgewise appliances. 2nd ed. Mosby; 1972.", population: "North American (white)", sd: "unsourced" },
  "Wits Analysis": { citation: `Jacobson A. The "Wits" appraisal of jaw disharmony. ${AJO}. 1975;67(2):125-138.`, pmid: "1054214", doi: "10.1016/0002-9416(75)90065-2", population: "North American adults with excellent occlusion (21 men, 25 women)", sd: "published", note: "Women 0 mm, men 1 mm (BO ahead of AO), per the paper's abstract; the app's single 0 ± 2 mm row has not been checked against the paper's SDs." },
  "Kim Analysis": { citation: `Kim YH. Overbite depth indicator with particular reference to anterior open-bite. ${AJO}. 1974;65(6):586-611. Kim YH, Vietas JJ. Anteroposterior dysplasia indicator. ${AJO}. 1978;73(6):619-633.`, pmid: "4524490, 276266", doi: "10.1016/0002-9416(74)90255-3, 10.1016/0002-9416(78)90223-3", population: "Children with normal occlusion (APDI: n = 102)", sd: "published", note: "APDI 81.4° ± 3.79 (Kim & Vietas abstract). Norms stay withheld until the composite indicators are implemented." },
  "Holdaway Analysis": { citation: `Holdaway RA. A soft-tissue cephalometric analysis and its use in orthodontic treatment planning. Part I. ${AJO}. 1983;84(1):1-28.`, pmid: "6575614", doi: "10.1016/0002-9416(83)90144-6", population: "Patients from the author's practice", sd: "approximate", note: "Holdaway gave ideal values and acceptable ranges, not SDs." },
  "Merrifield Z-angle": { citation: `Merrifield LL. The profile line as an aid in critically evaluating facial esthetics. ${AJO}. 1966;52(11):804-822.`, pmid: "5223046", doi: "10.1016/0002-9416(66)90250-8", population: "North American (white), adolescents and adults", sd: "approximate", note: "Merrifield gave an ideal value with a range." },
  "Legan and Burstone Soft Tissue": { citation: "Legan HL, Burstone CJ. Soft tissue cephalometric analysis for orthognathic surgery. J Oral Surg. 1980;38(10):744-751.", pmid: "6932485", population: "North American (white) adults", sd: "published" },
  "COGS Analysis": { citation: "Burstone CJ, James RB, Legan H, Murphy GA, Norton LA. Cephalometrics for orthognathic surgery. J Oral Surg. 1978;36(4):269-277.", pmid: "273073", population: "North American (white) adults", sd: "published", note: "COGS norms are sex-specific; the app's single set has not been checked against them." },
  "Arnett Analysis": { citation: "Arnett GW, Jelic JS, Kim J, et al. Soft tissue cephalometric analysis: diagnosis and treatment planning of dentofacial deformity. Am J Orthod Dentofacial Orthop. 1999;116(3):239-253.", pmid: "10474095", population: "North American (white) adults, by sex (46 women, 20 men)", sd: "published", note: "Arnett's norms are sex-specific; the app's single set has not been checked against them." },
  "Grummons Frontal Asymmetry": { citation: "Grummons DC, Kappeyne van de Coppello MA. A frontal asymmetry analysis. J Clin Orthod. 1987;21(7):448-465.", pmid: "3476493", sd: "unsourced", note: "An asymmetry analysis; the paper gives construction, not population SDs." },
  "Grummons Simplified AP": { citation: "Grummons DC, Kappeyne van de Coppello MA. A frontal asymmetry analysis. J Clin Orthod. 1987;21(7):448-465.", pmid: "3476493", sd: "unsourced" },
  "Moorrees Mesh": { citation: `Moorrees CF, van Venrooij ME, Lebret LM, et al. New norms for the mesh diagram analysis. ${AJO}. 1976;69(1):57-71.`, pmid: "1061501", doi: "10.1016/0002-9416(76)90098-1", population: "North American (white) children and adolescents", sd: "published", note: "Norms are age- and sex-specific; the app's single set has not been checked against them." },
  "Sassouni Analysis": { citation: `Sassouni V. A classification of skeletal facial types. ${AJO}. 1969;55(2):109-123.`, pmid: "5249177", doi: "10.1016/0002-9416(69)90122-5", sd: "unsourced" },
  "Sassouni Frontal": { citation: "Sassouni V. Diagnosis and treatment planning via roentgenographic cephalometry. Am J Orthod. 1958;44:433-463.", sd: "unsourced" },
  "Epker's Soft Tissue Analysis": { citation: "Epker BN, Fish LC. Dentofacial deformities: integrated orthodontic and surgical correction. Mosby; 1986.", sd: "unsourced" },
  "Harvold": { citation: "Harvold EP. The activator in interceptive orthodontics. Mosby; 1974.", population: "North American children, age- and sex-specific tables", sd: "unsourced" },
  "Riedel": { citation: "Riedel RA. The relation of maxillary structures to cranium in malocclusion and in normal occlusion. Angle Orthod. 1952;22(3):142-145.", sd: "unsourced" },
  "Wylie": { citation: "Wylie WL. The assessment of anteroposterior dysplasia. Angle Orthod. 1947;17(3):97-109.", sd: "unsourced" },
  "Coben Craniofacial and Dentition": { citation: "Coben SE. The integration of facial skeletal variants. Am J Orthod. 1955;41(6):407-434.", sd: "unsourced" },
  "Di Paolo's Quadrilateral": { citation: "Di Paolo RJ, Philip C, Maganzini AL, Hirce JD. The quadrilateral analysis: an individualized skeletal assessment. Am J Orthod. 1983;83(1):19-32.", pmid: "6571768", doi: "10.1016/0002-9416(83)90267-1", sd: "unsourced", note: "An individualized analysis (ratios between the patient's own lengths), not population norms." },
  "Farkas and Coworkers Soft Tissue": { citation: "Farkas LG. Anthropometry of the head and face. 2nd ed. Raven Press; 1994.", sd: "unsourced" },
  "Hasund (Bergen)": { citation: "Hasund A. Klinische Kephalometrie für die Bergen-Technik. Bergen; 1974.", sd: "unsourced" },
  "Schwartz": { citation: "Schwarz AM. Die Röntgenostatik. Urban & Schwarzenberg; 1958.", sd: "unsourced" },
  "Bimler Analysis": { citation: "", sd: "unsourced" },
  "Lautrou Analysis": { citation: "", sd: "unsourced" },
  "Gugino Analysis": { citation: "Gugino CF. An orthodontic philosophy. Rocky Mountain Orthodontics; 1977.", sd: "unsourced" },
  "Tollaro Analysis": { citation: "", sd: "unsourced" },
  "Delaire Analysis": { citation: "Delaire J. L'analyse architecturale et structurale crânio-faciale (de profil). Rev Stomatol Chir Maxillofac. 1978;79(1):1-33.", sd: "unsourced" },
  "Eastman Analysis": { citation: "Mills JRE. The application and importance of cephalometry in orthodontic treatment. Orthodontist. 1970;2:32-47.", population: "British (white)", sd: "unsourced" },
  "Hewitt": { citation: "", sd: "unsourced" },
  "Svanholt-Solow": { citation: "Svanholt P, Solow B. Assessment of midline discrepancies on the postero-anterior cephalometric radiograph. Trans Eur Orthod Soc. 1977:261-268.", sd: "unsourced" },
  "Grayson Multiplane": { citation: "Grayson BH, McCarthy JG, Bookstein F. Analysis of craniofacial asymmetry by multiplane cephalometry. Am J Orthod. 1983;84(3):217-224.", pmid: "6577794", doi: "10.1016/0002-9416(83)90129-x", sd: "unsourced" },
  "Van Arsdale": { citation: "", sd: "unsourced" },
  "Cagliari": { citation: "", sd: "unsourced" },
  "Chieti": { citation: "", sd: "unsourced" },
  "McGann": { citation: "", sd: "unsourced" },
  "Basis": { citation: "", sd: "unsourced" },
  "ABO DI Analysis": { citation: "American Board of Orthodontics. Discrepancy Index.", sd: "unsourced", note: "The DI uses scoring thresholds, not population norms." },
  "CVM Analysis": { citation: "Baccetti T, Franchi L, McNamara JA Jr. The cervical vertebral maturation (CVM) method. Semin Orthod. 2005;11(3):119-129.", sd: "unsourced" },
  "Hand-Wrist Analysis": { citation: "Fishman LS. Radiographic evaluation of skeletal maturation. Angle Orthod. 1982;52(2):88-112.", pmid: "6980608", doi: "10.1043/0003-3219(1982)052<0088:REOSM>2.0.CO;2", sd: "unsourced" },
  "General PA Analysis": { citation: "", sd: "unsourced" },
  "General SMV Analysis": { citation: "", sd: "unsourced" },
  "General OPG Analysis": { citation: "", sd: "unsourced" },
  "General Analysis": { citation: "", sd: "unsourced" },
  "Lateral Photo Analysis": { citation: "", sd: "unsourced" },
  "Frontal Photo Analysis": { citation: "", sd: "unsourced" },
};

// Norm presets in norms.js are keyed by short names.
// A norm added from a preset carries the preset's `source` text, so those match too.
const PRESET_ALIASES = {
  Steiner: "Steiner Analysis", Tweed: "Tweed Analysis", Downs: "Downs Analysis", McNamara: "McNamara Analysis", Ricketts: "Ricketts Analysis", "Bjork-Jarabak": "Jarv-Bjork",
  "Steiner, 1953 / Am J Orthod": "Steiner Analysis", "Tweed, 1954": "Tweed Analysis", "Downs, 1948 / Am J Orthod": "Downs Analysis",
  "McNamara, 1984 / Am J Orthod": "McNamara Analysis", "Ricketts, 1960 / Am J Orthod": "Ricketts Analysis", "Jarabak, 1972": "Jarv-Bjork",
};

export function normSource(name) {
  if (!name) return null;
  return NORM_SOURCES[name] || NORM_SOURCES[PRESET_ALIASES[name]] || null;
}

// Many compiled analyses copy Steiner's SNA/SNB/ANB ±2°.
const STEINER_COPIES = new Set(["SNA", "SNB", "ANB", "S-N-A", "S-N-B", "A-N-B"]);

// "published" | "approximate" | "unsourced", or null for norms the app didn't ship
// (the user's own presets): those are not flagged.
export function sdStatus(analysisName, label, sd) {
  if (STEINER_COPIES.has(label) && sd === 2) return "approximate";
  const src = normSource(analysisName);
  return src ? src.sd : null;
}

export const SD_STATUS_TEXT = {
  approximate: { tag: "SD approx.", detail: "The source published no SD for this norm; the SD is a conventional approximation, so the deviation grade is indicative." },
  unsourced: { tag: "SD unsourced", detail: "No published SD has been traced for this norm, so the deviation grade is indicative." },
};
