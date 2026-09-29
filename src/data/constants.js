// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - Themes, Tools, Predefined Analyses
// ═══════════════════════════════════════════════════════════════════════════════

import smvCsv from "../../Data/SMV.csv?raw";
import opgCsv from "../../Data/OPG.csv?raw";
import lateralCsv from "../../Data/LateralCeph.csv?raw";
import paCsv from "../../Data/PA_Ceph.csv?raw";
import handwristCsv from "../../Data/HandWrist.csv?raw";
import photolateralCsv from "../../Data/Photo_Lateral.csv?raw";
import photofrontalCsv from "../../Data/Photo_Frontal.csv?raw";
import airwayCsv from "../../Data/Airway.csv?raw";
import analysisMeasurementsCsv from "../../Data/AnalysisMeasurements.csv?raw";
import { parseAnalysisCsv } from "../report/csvParser.js";

const _smvAnalyses = parseAnalysisCsv(smvCsv);
const _opgAnalyses = parseAnalysisCsv(opgCsv);
const _lateralAnalyses = parseAnalysisCsv(lateralCsv);
const _paAnalyses = parseAnalysisCsv(paCsv);
const _handwristAnalyses = parseAnalysisCsv(handwristCsv);
const _photolateralAnalyses = parseAnalysisCsv(photolateralCsv);
const _photofrontalAnalyses = parseAnalysisCsv(photofrontalCsv);
const _airwayAnalyses = parseAnalysisCsv(airwayCsv);
const _measurementDefs = parseAnalysisCsv(analysisMeasurementsCsv);

// Build a measurement lookup by analysis name
const _measurementLookup = {};
for (const a of _measurementDefs) {
  _measurementLookup[a.name] = a.measurements;
}

const _lateralHardcoded = [
  { name: "General Ceph Analysis", pts: [
    { l: "N", def: "Nasion - the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "Sella - the geometric center of the pituitary fossa (sella turcica).", color: "#f59e0b" },
    { l: "Ba", def: "Basion - most inferior posterior point of the occipital bone.", color: "#f59e0b" },
    { l: "Or", def: "Orbitale - the lowest point on the inferior margin of the orbit.", color: "#60a5fa" },
    { l: "Po", def: "Porion - the superior point of the external auditory meatus.", color: "#60a5fa" },
    { l: "Ar", def: "Articulare - the point of intersection of the posterior border of the condylar process and the inferior border of the basilar part of the occipital bone.", color: "#60a5fa" },
    { l: "A", def: "Point A - the deepest point on the curve of the maxilla.", color: "#34d399" },
    { l: "B", def: "Point B - the deepest midline point on the mandible.", color: "#34d399" },
    { l: "ANS", def: "Anterior nasal spine - tip of the bony anterior nasal spine.", color: "#34d399" },
    { l: "PNS", def: "Posterior nasal spine - intersection of palatum posterior and fossa pterygopalatina.", color: "#34d399" },
    { l: "Pog", def: "Pogonion - the most anterior point on the chin.", color: "#a78bfa" },
    { l: "Gn", def: "Gnathion - a point on the chin determined by bisecting the facial and mandibular planes.", color: "#a78bfa" },
    { l: "Me", def: "Menton - the most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "Gonion - the point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "Co", def: "Condylion - the most superior point of the mandibular condyle.", color: "#34d399" },
    { l: "Is", def: "Incision superius - the incisal point of the most prominent maxillary central incisor.", color: "#fb923c" },
    { l: "Ii", def: "Incision inferius - the incisal point of the most prominent mandibular central incisor.", color: "#f472b6" },
    { l: "Prn", def: "Pronasale - the most protruded point of the apex nasi.", color: "#f472b6" },
    { l: "Sn", def: "Subnasale - midpoint of the columella base at the apex of the nasolabial angle.", color: "#f472b6" },
    { l: "Ss", def: "Superior sulcus - the deepest midline point between subnasion and the vermilion border.", color: "#f472b6" },
    { l: "Stms", def: "Stomion superius - the lowermost point on the vermilion of the upper lip.", color: "#f472b6" },
    { l: "Stmi", def: "Stomion inferius - the uppermost point on the vermilion of the lower lip.", color: "#f472b6" },
    { l: "Si", def: "Sulpion - the point of greatest concavity in the midline between the lower lip and chin.", color: "#f472b6" },
    { l: "TMJ", def: "Temporomandibular joint point - on the contour of the glenoid fossa.", color: "#60a5fa" },
    { l: "Ids", def: "Infradentale superius - the highest point on the alveolar crest between the mandibular central incisors.", color: "#f472b6" },
    { l: "Pr", def: "Prosthion - the most anterior point on the maxillary alveolar process.", color: "#34d399" },
    { l: "R", def: "Ramus — a point on the posterior border of the mandibular ramus.", color: "#a78bfa" },
    { l: "LPM", def: "Lower 2nd premolar cusp tip.", color: "#f472b6" },
    { l: "LMT", def: "Lower molar cusp tip.", color: "#f472b6" },
    { l: "UPM", def: "Upper 2nd premolar cusp tip.", color: "#fb923c" },
    { l: "UMT", def: "Upper molar cusp tip.", color: "#fb923c" },
    { l: "N'", def: "Soft tissue nasion — the most concave point of the soft tissue frontonasal region.", color: "#fbbf24" },
  ],
  lines: [
    { l: "Sella-Nasion line", def: "Line connecting Sella to Nasion.", color: "#f59e0b" },
    { l: "Frankfort Horizontal", def: "Plane connecting Porion to Orbitale.", color: "#60a5fa" },
    { l: "NBa plane", def: "Plane connecting Nasion to Basion.", color: "#f59e0b" },
    { l: "Mandibular plane", def: "Plane connecting Gonion to Menton.", color: "#a78bfa" },
  ]},
  { name: "Steiner Analysis", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "The center of sella turcica (the midpoint of the horizontal diameter).", color: "#f59e0b" },
    { l: "A", def: "The deepest midline point on the premaxilla between the anterior nasal spine and prosthion.", color: "#60a5fa" },
    { l: "B", def: "The deepest midline point on the mandible between infradentale and pogonion.", color: "#60a5fa" },
    { l: "ANS", def: "Anterior nasal spine is the tip of bony anterior nasal spine in the midline or median plane.", color: "#34d399" },
    { l: "PNS", def: "Posterior nasal spine is the intersection of a continuation of the anterior wall of the pterygopalatine fossa and the floor of the nose.", color: "#34d399" },
    { l: "Pog", def: "The most anterior point on the chin.", color: "#a78bfa" },
    { l: "Gn", def: "A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "Is", def: "The incisal point of the most prominent medial maxillary incisor.", color: "#fb923c" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Ia", def: "The root apex of the most anterior maxillary central incisor.", color: "#fb923c" },
    { l: "Iia", def: "The root apex of the most anterior mandibular central incisor.", color: "#f472b6" },
    { l: "APOcc", def: "Anterior point of occlusion — midpoint of incisor overbite on the functional occlusal plane.", color: "#34d399" },
    { l: "PPOcc", def: "Posterior point of occlusion — most distal molar contact on the functional occlusal plane.", color: "#34d399" },
    { l: "Prn", def: "Pronasale — the most protruded point of the apex nasi.", color: "#fbbf24" },
    { l: "Sn", def: "Subnasale — the midpoint of the columella base at the apex of the nasolabial angle.", color: "#fbbf24" },
    { l: "Pog'", def: "Soft tissue pogonion — the most anterior point on the soft tissue chin.", color: "#a78bfa" },
    { l: "UL", def: "Labrale superius — the midpoint of the upper vermilion border.", color: "#f472b6" },
    { l: "LL", def: "Labrale inferius — the midpoint of the lower vermilion border.", color: "#f472b6" },
  ]},
  { name: "Ricketts Analysis", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "The point representing the geometric center of the pituitary fossa (sella turcica).", color: "#f59e0b" },
    { l: "Ba", def: "Most inferior posterior point of the occipital bone.", color: "#f59e0b" },
    { l: "Or", def: "The lowest point on the inferior margin of the orbit.", color: "#60a5fa" },
    { l: "Po", def: "The superior point of the external auditory meatus (superior margin of temporomandibular fossa).", color: "#60a5fa" },
    { l: "Ar", def: "The point of intersection of the images of the posterior border of the condylar process of the mandible and the inferior border of the basilar part of the occipital bone.", color: "#60a5fa" },
    { l: "A", def: "The deepest point on the curve of the maxilla between the anterior nasal spine and the dental alveolus.", color: "#34d399" },
    { l: "B", def: "The deepest midline point on the mandible between infradentale and pogonion.", color: "#34d399" },
    { l: "ANS", def: "Tip of the anterior nasal spine.", color: "#34d399" },
    { l: "PNS", def: "The intersection of palatum posterior durum, palatum molle and fossa pterygopalatina.", color: "#34d399" },
    { l: "Pog", def: "Most anterior point on the midsagittal symphysis tangent to the facial plane.", color: "#a78bfa" },
    { l: "Gn", def: "The most inferior point on the contour of the chin.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "PT", def: "Pterygoid point — the most posterior-superior point of the pterygomaxillary fissure.", color: "#34d399" },
    { l: "Xi", def: "The geometric center of the ramus of the mandible.", color: "#a78bfa" },
    { l: "PM", def: "Point at the anterior border of the symphysis between point B and pogonion where curvature changes from concave to convex.", color: "#a78bfa" },
    { l: "DC", def: "Point selected in the center of the neck of the condyle where the basion-nasion plane crosses it.", color: "#34d399" },
    { l: "Is", def: "The incisal point of the most prominent medial maxillary incisor.", color: "#fb923c" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Ia", def: "The root apex of the most anterior maxillary central incisor.", color: "#fb923c" },
    { l: "Iia", def: "The root apex of the most anterior mandibular central incisor.", color: "#f472b6" },
    { l: "Prn", def: "Pronasale — the most protruded point of the apex nasi.", color: "#fbbf24" },
    { l: "Pog'", def: "Soft tissue pogonion — the most anterior point on the soft tissue chin.", color: "#a78bfa" },
    { l: "UL", def: "Labrale superius — the midpoint of the upper vermilion border.", color: "#f472b6" },
    { l: "LL", def: "Labrale inferius — the midpoint of the lower vermilion border.", color: "#f472b6" },
  ]},
  { name: "McNamara Analysis", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "A", def: "The deepest point on the curve of the maxilla between the anterior nasal spine and the dental alveolus.", color: "#60a5fa" },
    { l: "B", def: "The deepest midline point on the mandible between infradentale and pogonion.", color: "#60a5fa" },
    { l: "Pog", def: "The most anterior point on the mandible in the midline.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Co", def: "The most superior point of the mandibular condyle.", color: "#34d399" },
    { l: "ANS", def: "Tip of the anterior nasal spine.", color: "#34d399" },
    { l: "PNS", def: "The intersection of palatum posterior durum, palatum molle and fossa pterygopalatina.", color: "#34d399" },
    { l: "Is", def: "The incisal point of the most prominent medial maxillary incisor.", color: "#fb923c" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Ad", def: "Adenoid point — the most prominent point on the posterior pharyngeal wall opposite PNS.", color: "#fbbf24" },
  ]},
  { name: "Downs Analysis", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "Located by inspection of the profile image of the fossa.", color: "#f59e0b" },
    { l: "Or", def: "The lowest point on the left infraorbital margin.", color: "#60a5fa" },
    { l: "Po", def: "The highest point on the superior surface of the soft tissue of the external auditory meati.", color: "#60a5fa" },
    { l: "A", def: "The deepest midline point on the premaxilla between the anterior nasal spine and prosthion.", color: "#34d399" },
    { l: "B", def: "The deepest midline point on the mandible between infradentale and pogonion.", color: "#34d399" },
    { l: "Pog", def: "The most anterior point on the mandible in the midline.", color: "#a78bfa" },
    { l: "Gn", def: "A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "APOcc", def: "Anterior point of occlusion — midpoint of incisor overbite on the functional occlusal plane.", color: "#34d399" },
    { l: "PPOcc", def: "Posterior point of occlusion — most distal molar contact on the functional occlusal plane.", color: "#34d399" },
    { l: "Is", def: "The incisal point of the most prominent medial maxillary incisor.", color: "#fb923c" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Ia", def: "The root apex of the most anterior maxillary central incisor.", color: "#fb923c" },
    { l: "Iia", def: "The root apex of the most anterior mandibular central incisor.", color: "#f472b6" },
  ]},
  { name: "Bjork Analysis", pts: [
    { l: "Ar", def: "The point of intersection of the dorsal contours of processus articularis mandibulae and os temporale. The midpoint is used where double projection gives rise to two articulare points.", color: "#60a5fa" },
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "The center of sella turcica (the midpoint of the horizontal diameter).", color: "#f59e0b" },
    { l: "Or", def: "The deepest point on the infraorbital margin. The midpoint is used where double projection gives rise to two points.", color: "#60a5fa" },
    { l: "Po", def: "Porion is the most superior point of the external auditory meatus (the superior margin of the TMJ fossa, which lies at the same level may be substitute in the construction of the FH).", color: "#60a5fa" },
    { l: "A", def: "The deepest point on the contour of the alveolar projection, between the spinal point and prosthion.", color: "#34d399" },
    { l: "B", def: "The deepest point on the contour of the alveolar projection, between infradentale and pogonion.", color: "#34d399" },
    { l: "ANS", def: "The apex of spina nasalis anterior.", color: "#34d399" },
    { l: "PNS", def: "Posterior spine of palatum durum.", color: "#34d399" },
    { l: "Pog", def: "The most anterior point on the chin.", color: "#a78bfa" },
    { l: "Gn", def: "A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "Is", def: "The incisal point of the most prominent medial maxillary incisor.", color: "#fb923c" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Ia", def: "The root apex of the most anterior maxillary central incisor.", color: "#fb923c" },
    { l: "Iia", def: "The root apex of the most anterior mandibular central incisor.", color: "#f472b6" },
  ]},
  { name: "Tweed Analysis", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "The center of sella turcica (the midpoint of the horizontal diameter).", color: "#f59e0b" },
    { l: "Or", def: "The lowest point on the left infraorbital margin.", color: "#60a5fa" },
    { l: "Po", def: "The highest point on the superior surface of the soft tissue of the external auditory meati.", color: "#60a5fa" },
    { l: "A", def: "The deepest midline point on the premaxilla between the anterior nasal spine and prosthion.", color: "#60a5fa" },
    { l: "B", def: "The deepest midline point on the mandible between infradentale and pogonion.", color: "#60a5fa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
    { l: "Xi", def: "The midpoint of the Xi path (a small round radiopacity representing the intersection of the ramus plane with the posterior border of the mandibular canal).", color: "#34d399" },
    { l: "Pog", def: "The most anterior point on the chin.", color: "#a78bfa" },
    { l: "Ii", def: "The incisal point of the most prominent medial mandibular incisor.", color: "#f472b6" },
    { l: "Iia", def: "The root apex of the most anterior mandibular central incisor.", color: "#f472b6" },
  ]},
  { name: "Jarv-Bjork", pts: [
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "S", def: "The center of sella turcica (the midpoint of the horizontal diameter).", color: "#f59e0b" },
    { l: "Ba", def: "Most inferior posterior point of the occipital bone.", color: "#f59e0b" },
    { l: "Ar", def: "The point of intersection of the dorsal contours of processus articularis mandibulae and os temporale.", color: "#60a5fa" },
    { l: "Or", def: "The deepest point on the infraorbital margin.", color: "#60a5fa" },
    { l: "Po", def: "Porion is the most superior point of the external auditory meatus.", color: "#60a5fa" },
    { l: "PNS", def: "Posterior spine of palatum durum.", color: "#34d399" },
    { l: "ANS", def: "The apex of spina nasalis anterior.", color: "#34d399" },
    { l: "A", def: "The deepest point on the contour of the alveolar projection.", color: "#34d399" },
    { l: "B", def: "The deepest point on the contour of the alveolar projection.", color: "#34d399" },
    { l: "Pog", def: "The most anterior point on the chin.", color: "#a78bfa" },
    { l: "Gn", def: "A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.", color: "#a78bfa" },
    { l: "Me", def: "The most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
    { l: "Go", def: "The point of intersection of the ramus plane and the mandibular plane.", color: "#a78bfa" },
  ]},
  { name: "Wits Analysis", pts: [
    { l: "A", def: "The deepest point on the contour of the alveolar projection.", color: "#34d399" },
    { l: "B", def: "The deepest point on the contour of the mandibular symphysis.", color: "#34d399" },
    { l: "Po", def: "The highest point on the superior surface of the soft tissue of the external auditory meati.", color: "#60a5fa" },
    { l: "Or", def: "The lowest point on the left infraorbital margin.", color: "#60a5fa" },
    { l: "Ba", def: "Most inferior posterior point of the occipital bone.", color: "#f59e0b" },
    { l: "N", def: "Nasion is the most anterior point of the frontonasal suture in the middle.", color: "#f59e0b" },
    { l: "APOcc", def: "Anterior point of occlusion — midpoint of incisor overbite on the functional occlusal plane.", color: "#fb923c" },
    { l: "PPOcc", def: "Posterior point of occlusion — most distal molar contact on the functional occlusal plane.", color: "#fb923c" },
  ]},
];

const _existingLateralNames = new Set(_lateralHardcoded.map(a => a.name));
const _additionalLateral = _lateralAnalyses
  .filter(a => {
    if (a.pts.length === 0) return false;
    return !_existingLateralNames.has(a.name);
  });

export const THEMES = {
  bluish: { name: "Plasticity", id: "bluish", bg: "#0f0f12", surf: "#1a1a22", surf2: "#252530", surf3: "#323242", bdr: "#404058", tx: "#e4e4ef", tx2: "#9999ad", tx3: "#6a6a80", acc: "#a855f7", acc2: "#9333ea", accMuted: "rgba(168,85,247,0.15)", err: "#f87171", ok: "#4ade80", warn: "#fbbf24", shadow: "rgba(0,0,0,0.6)", inHeader: true },
  dark: { name: "GitHub Dark", id: "dark", bg: "#0d1117", surf: "#161b22", surf2: "#21262d", surf3: "#30363d", bdr: "#30363d", tx: "#c9d1d9", tx2: "#8b949e", tx3: "#6e7681", acc: "#58a6ff", acc2: "#388bfd", accMuted: "rgba(88,166,255,0.1)", err: "#f85149", ok: "#3fb950", warn: "#d29922", shadow: "rgba(0,0,0,0.4)", inHeader: true },
  paper: { name: "Paper", id: "paper", bg: "#e8eaed", surf: "#f6f8fa", surf2: "#ffffff", surf3: "#eaecf0", bdr: "#d0d0d0", tx: "#1a1a1a", tx2: "#4a4a4a", tx3: "#787878", acc: "#2563eb", acc2: "#1d4ed8", accMuted: "rgba(37,99,235,0.12)", err: "#dc2626", ok: "#16a34a", warn: "#ca8a04", shadow: "rgba(0, 0, 0, 0.2)", inHeader: true },
  light: { name: "GitHub Light", id: "light", bg: "#e8eaed", surf: "#f6f8fa", surf2: "#ffffff", surf3: "#eaecf0", bdr: "#d0d7de", tx: "#24292f", tx2: "#57606a", tx3: "#8c959f", acc: "#06a23d", acc2: "#078050", accMuted: "rgba(9,105,218,0.1)", err: "#cf222e", ok: "#1a7f37", warn: "#9a6700", shadow: "rgba(0,0,0,0.2)", inHeader: true },
};

export const TOOLS = [
  { id: "select", icon: "⊹", label: "Select/Move", key: "v" },
  { id: "pan", icon: "⊕", label: "Pan", key: "h" },
  null,
  { id: "point", icon: "◉", label: "Landmark", key: "p" },
  { id: "line", icon: "⟋", label: "Line/Plane", key: "l" },
  { id: "perppoint", icon: "⊦", label: "Perp Point", key: "j" },
  { id: "midpoint", icon: "◈", label: "Midpoint", key: "m" },
  { id: "arrow", icon: "→", label: "Arrow", key: "a" },
  { id: "angle3", icon: "∠", label: "Angle 3-pt", key: "3" },
  { id: "angle4", icon: "∡", label: "Angle 4-pt", key: "4" },
  { id: "perp", icon: "⊥", label: "Perp Dist", key: "d" },
  { id: "parallel", icon: "⫿", label: "Parallel", key: "q" },
  { id: "polygon", icon: "⬡", label: "Polygon", key: "g" },
  { id: "curve", icon: "∿", label: "Curve", key: "c" },
  { id: "polyline", icon: "⌇", label: "Polyline", key: "y" },
  { id: "ellipse", icon: "◯", label: "Ellipse", key: "e" },
  { id: "arc", icon: "◠", label: "Arc", key: "u" },
  { id: "circle", icon: "⊙", label: "Circle", key: "o" },
  { id: "bezier", icon: "≂", label: "Bezier", key: "b" },
  { id: "text", icon: "T", label: "Text", key: "t" },
  null,
  { id: "ruler", icon: "⟺", label: "Ruler/Cal", key: "r" },
  { id: "tangent", icon: "⊸", label: "Tangent", key: "n" },
  { id: "concentric", icon: "◎", label: "Concentric", key: "w" },
  { id: "mirror", icon: "⌈⌉", label: "Mirror", key: "x" },
];

const _existingApNames = new Set([
  "Ricketts","General PA Analysis","Grummons Frontal Asymmetry","Hewitt","Svanholt-Solow","Grayson Multiplane",
]);
const _additionalAp = _paAnalyses
  .filter(a => {
    if (a.pts.length === 0) return false;
    return !_existingApNames.has(a.name);
  });

export const PREDEFINED = {
  lateral: [..._lateralHardcoded, ..._additionalLateral, ..._airwayAnalyses],
  ap: [
    ..._additionalAp,
    { name: "Ricketts", pts: [
      { l: "Crg", def: "Crista galli - the most superior point of the Crista galli.", color: "#f59e0b" },
      { l: "ANS", def: "Anterior nasal spine - tip of the anterior nasal spine.", color: "#60a5fa" },
      { l: "A", def: "Point A - the deepest point on the curve of the maxilla.", color: "#60a5fa" },
      { l: "Me", def: "Menton - the most inferior midline point on the mandibular symphysis.", color: "#a78bfa" },
      { l: "Z-R", def: "The most internal (medial) point of the frontozygomatic suture on the right side.", color: "#fb923c" },
      { l: "Z-L", def: "The most internal (medial) point of the frontozygomatic suture on the left side.", color: "#fb923c" },
      { l: "ZA-R", def: "The most external (lateral) border of the zygomatic arch on the right side.", color: "#fb923c" },
      { l: "ZA-L", def: "The most external (lateral) border of the zygomatic arch on the left side.", color: "#fb923c" },
      { l: "J-R", def: "The deepest point of the lateral contour of the maxillary alveolar process on the right side.", color: "#60a5fa" },
      { l: "J-L", def: "The deepest point of the lateral contour of the maxillary alveolar process on the left side.", color: "#60a5fa" },
      { l: "AG-R", def: "The deepest point of the antegonial notch on the lower border of the right mandible.", color: "#a78bfa" },
      { l: "AG-L", def: "The deepest point of the antegonial notch on the lower border of the left mandible.", color: "#a78bfa" },
      { l: "NC-R", def: "The widest lateral point of the nasal cavity on the right side.", color: "#f472b6" },
      { l: "NC-L", def: "The widest lateral point of the nasal cavity on the left side.", color: "#f472b6" },
    ]},
    { name: "General PA Analysis", pts: [
      { l: "ag-R", def: "The highest point in the antegonial notch on the right side.", color: "#a78bfa" },
      { l: "ag-L", def: "The highest point in the antegonial notch on the left side.", color: "#a78bfa" },
      { l: "ANS", def: "The center of the intersection of the nasal septum and the palate.", color: "#60a5fa" },
      { l: "cd/Con-R", def: "The most superior and the middle point on the contour of the right condyle head.", color: "#34d399" },
      { l: "cd/Con-L", def: "The most superior and the middle point on the contour of the left condyle head.", color: "#34d399" },
      { l: "Cg", def: "The most superior and anterior points on the median ridge of the bone that projects upward from the cribriform plate of the ethmoid bone.", color: "#f59e0b" },
      { l: "cor-R", def: "The most superior point of the coronoid process on the right side.", color: "#fb923c" },
      { l: "cor-L", def: "The most superior point of the coronoid process on the left side.", color: "#fb923c" },
      { l: "Go-R", def: "The most posterior inferior point of the right mandibular angle.", color: "#a78bfa" },
      { l: "Go-L", def: "The most posterior inferior point of the left mandibular angle.", color: "#a78bfa" },
      { l: "iif/L1M", def: "The dental midline point of the incisal edge of the mandibular central incisor.", color: "#f472b6" },
      { l: "isf/U1M", def: "The dental midline point of the incisal edge of the maxillary central incisor.", color: "#fb923c" },
      { l: "Jug-R", def: "The right intersection of the tuberosity of maxilla and zygomatic buttress.", color: "#60a5fa" },
      { l: "Jug-L", def: "The left intersection of the tuberosity of maxilla and zygomatic buttress.", color: "#60a5fa" },
      { l: "lm/L6MC-R", def: "The most lateral cusp point of the right mandibular first molar crown.", color: "#f472b6" },
      { l: "lm/L6MC-L", def: "The most lateral cusp point of the left mandibular first molar crown.", color: "#f472b6" },
      { l: "lo-R", def: "The intersection of the lateral orbital contour with the innominate line on the right side.", color: "#60a5fa" },
      { l: "lo-L", def: "The intersection of the lateral orbital contour with the innominate line on the left side.", color: "#60a5fa" },
      { l: "lpa-R", def: "The most lateral aspect of the piriform aperture on the right side.", color: "#f472b6" },
      { l: "lpa-L", def: "The most lateral aspect of the piriform aperture on the left side.", color: "#f472b6" },
      { l: "m", def: "Located by projecting the mental spine on the lower mandibular border, perpendicular to the line ag-ag.", color: "#a78bfa" },
      { l: "ma/Mst-R", def: "The most inferior point of the right mastoid process.", color: "#34d399" },
      { l: "ma/Mst-L", def: "The most inferior point of the left mastoid process.", color: "#34d399" },
      { l: "Me", def: "The most inferior point of the symphysis of the mandible.", color: "#a78bfa" },
      { l: "mf-R", def: "The centre of the mental foramen on the right side.", color: "#a78bfa" },
      { l: "mf-L", def: "The centre of the mental foramen on the left side.", color: "#a78bfa" },
      { l: "mo-R", def: "The point on the medial orbital margin that is closest to the median plane on the right side.", color: "#60a5fa" },
      { l: "mo-L", def: "The point on the medial orbital margin that is closest to the median plane on the left side.", color: "#60a5fa" },
      { l: "mx-R", def: "The intersection of the lateral contour of the maxillary alveolar process and the lower contour of the maxillozygomatic process of the maxilla on the right side.", color: "#60a5fa" },
      { l: "mx-L", def: "The intersection of the lateral contour of the maxillary alveolar process and the lower contour of the maxillozygomatic process of the maxilla on the left side.", color: "#60a5fa" },
      { l: "mzmf-R", def: "Point at the medial margin of the zygomaticofrontal suture on the right side.", color: "#f59e0b" },
      { l: "mzmf-L", def: "Point at the medial margin of the zygomaticofrontal suture on the left side.", color: "#f59e0b" },
      { l: "lzmf-R", def: "Point at the lateral margin of the zygomaticofrontal suture on the right side.", color: "#f59e0b" },
      { l: "lzmf-L", def: "Point at the lateral margin of the zygomaticofrontal suture on the left side.", color: "#f59e0b" },
      { l: "om", def: "The projection on the line lo-lo of the top of the nasal septum at the base of the crista galli.", color: "#f59e0b" },
      { l: "Sph-R", def: "The right intersection of sphenoid bone greater and lesser wing.", color: "#f59e0b" },
      { l: "Sph-L", def: "The left intersection of sphenoid bone greater and lesser wing.", color: "#f59e0b" },
      { l: "tns", def: "The highest point on the superior aspect of the nasal septum.", color: "#f59e0b" },
      { l: "um/U6MC-R", def: "The most lateral cusp point of the right maxillary first molar crown.", color: "#fb923c" },
      { l: "um/U6MC-L", def: "The most lateral cusp point of the left maxillary first molar crown.", color: "#fb923c" },
      { l: "za-R", def: "Point at the most lateral border of the centre of the zygomatic arch on the right side.", color: "#fb923c" },
      { l: "za-L", def: "Point at the most lateral border of the centre of the zygomatic arch on the left side.", color: "#fb923c" },
    ]},
    { name: "Grummons Frontal Asymmetry", pts: [
      { l: "Cg", def: "The most superior point of the crista galli, used to construct the mid-sagittal reference (MSR) line.", color: "#f59e0b" },
      { l: "ANS", def: "The tip of the anterior nasal spine, used with Cg to establish the mid-sagittal reference (MSR) line.", color: "#60a5fa" },
      { l: "Co-R", def: "The most superior point on the condylar head of the right mandible.", color: "#34d399" },
      { l: "Co-L", def: "The most superior point on the condylar head of the left mandible.", color: "#34d399" },
      { l: "Z-R", def: "The medial margin of the zygomaticofrontal suture on the right side.", color: "#fb923c" },
      { l: "Z-L", def: "The medial margin of the zygomaticofrontal suture on the left side.", color: "#fb923c" },
      { l: "J-R", def: "The intersection of the outline of the maxillary tuberosity and the zygomatic buttress on the right side.", color: "#60a5fa" },
      { l: "J-L", def: "The intersection of the outline of the maxillary tuberosity and the zygomatic buttress on the left side.", color: "#60a5fa" },
      { l: "Ag-R", def: "The highest point of the antegonial notch on the right side.", color: "#a78bfa" },
      { l: "Ag-L", def: "The highest point of the antegonial notch on the left side.", color: "#a78bfa" },
      { l: "Me", def: "The lowest point on the symphyseal shadow of the mandible.", color: "#a78bfa" },
    ]},
    { name: "Hewitt", pts: [
      { l: "N", def: "The most anterior point of the frontonasal suture, used to assess upper facial symmetry.", color: "#f59e0b" },
      { l: "ANS", def: "The tip of the anterior nasal spine, used as a central point for mid-face symmetry triangulation.", color: "#60a5fa" },
      { l: "Me", def: "The most inferior point on the mandibular symphysis, used for lower facial triangulation.", color: "#a78bfa" },
      { l: "Cd-R", def: "The most superior point of the condylar head on the right side.", color: "#34d399" },
      { l: "Cd-L", def: "The most superior point of the condylar head on the left side.", color: "#34d399" },
      { l: "Go-R", def: "The most lateral and inferior point of the mandibular angle on the right side.", color: "#a78bfa" },
      { l: "Go-L", def: "The most lateral and inferior point of the mandibular angle on the left side.", color: "#a78bfa" },
    ]},
    { name: "Svanholt-Solow", pts: [
      { l: "Mx-R", def: "The deepest point on the lateral contour of the right maxilla.", color: "#60a5fa" },
      { l: "Mx-L", def: "The deepest point on the lateral contour of the left maxilla.", color: "#60a5fa" },
      { l: "Lo-R", def: "The intersection of the lateral orbital contour with the innominate line on the right side.", color: "#60a5fa" },
      { l: "Lo-L", def: "The intersection of the lateral orbital contour with the innominate line on the left side.", color: "#60a5fa" },
      { l: "Upper dental midline", def: "The midpoint between the central incisors on the maxillary arch.", color: "#fb923c" },
      { l: "Lower dental midline", def: "The midpoint between the central incisors on the mandibular arch.", color: "#f472b6" },
    ]},
    { name: "Grayson Multiplane", pts: [
      { l: "N", def: "The most anterior point of the frontonasal suture in the midline.", color: "#f59e0b" },
      { l: "ANS", def: "The most anterior point of the anterior nasal spine.", color: "#60a5fa" },
      { l: "Pr", def: "The most inferior anterior point on the maxillary alveolar process between the central incisors.", color: "#fb923c" },
      { l: "Id", def: "The highest and most anterior point on the mandibular alveolar process between the central incisors.", color: "#f472b6" },
      { l: "Me", def: "The lowest point on the mandibular symphysis.", color: "#a78bfa" },
      { l: "Zf-R", def: "The junction of the zygomatic and frontal bones at the lateral orbital rim on the right side.", color: "#fb923c" },
      { l: "Zf-L", def: "The junction of the zygomatic and frontal bones at the lateral orbital rim on the left side.", color: "#fb923c" },
    ]},
  ],
  smv: _smvAnalyses,
  opg: _opgAnalyses,
  handwrist: _handwristAnalyses,
  photolateral: _photolateralAnalyses,
  photofrontal: _photofrontalAnalyses,
  other: [
    { group: "Head and Neck Projections", projections: [
      { name: "Submentovertex (SMV)", def: "Evaluating cranial base symmetry, condylar angulation, and transverse discrepancies from a bottom-up angle.", color: "#f59e0b" },
      { name: "Panoramic Radiograph (OPG)", def: "Providing a broad overview of the dentition, jaws, and vertical ramal/condylar asymmetries.", color: "#60a5fa" },
      { name: "Transcranial View (Schüller)", def: "Evaluating the lateral aspect of the TMJ and condylar position/translation.", color: "#34d399" },
      { name: "Transpharyngeal View (Parma)", def: "Providing a clear view of the condylar head and neck across the pharynx.", color: "#a78bfa" },
      { name: "Transorbital View (Zimmer)", def: "Viewing the TMJ from an anterior-to-posterior perspective through the orbit.", color: "#fb923c" },
      { name: "Waters View", def: "Examining the midface, maxillary sinuses, and zygomatic arches.", color: "#f472b6" },
      { name: "Caldwell View", def: "Evaluating the frontal and ethmoid sinuses, as well as lateral orbital walls.", color: "#c084fc" },
      { name: "Towne's View", def: "Checking for medial/lateral condylar displacement and evaluating the occipital bone.", color: "#22d3ee" },
    ]},
    { group: "Growth & Skeletal Maturation", projections: [
      { name: "Hand-Wrist Radiograph", def: "Assessing skeletal bone age and pubertal growth stages.", color: "#fbbf24" },
    ]},
    { group: "Modern 3D Imaging", projections: [
      { name: "CBCT Derived Views", def: "A single 3D volumetric scan that digitally recreates 2D views without superimposition or magnification.", color: "#34d399" },
    ]},
  ],
};

// Merge CSV measurements into PREDEFINED analyses
for (const a of PREDEFINED.lateral) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.ap) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.smv) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.opg) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.handwrist) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.photolateral) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}
for (const a of PREDEFINED.photofrontal) {
  if (_measurementLookup[a.name]) {
    a.measurements = _measurementLookup[a.name];
  }
}

// Make "General Ceph Analysis" a superset of "Steiner Analysis": the default
// template then auto-runs every Steiner landmark + measurement (plus the extra
// CEPHA29 points added above), so AI Trace on a fresh case yields the full set.
{
  const general = PREDEFINED.lateral.find((a) => a.name === "General Ceph Analysis");
  const steiner = PREDEFINED.lateral.find((a) => a.name === "Steiner Analysis");
  if (general && steiner) {
    const havePt = new Set((general.pts || []).map((p) => p.l));
    general.pts = [
      ...(general.pts || []),
      ...((steiner.pts || []).filter((p) => !havePt.has(p.l))),
    ];
    const haveM = new Set((general.measurements || []).map((m) => m.l));
    general.measurements = [
      ...(general.measurements || []),
      ...((steiner.measurements || []).filter((m) => !haveM.has(m.l))),
    ];
  }
}

export const AIRWAY_NORMS = {
  source: "Composite — McNamara, Riley-Powell, Guilleminault, Solow",
  strata: [
    {
      group: "Adult (≥18y)",
      norms: [
        { label: "Nasopharynx", mean: 250, sd: 50, type: "area" },
        { label: "Oropharynx", mean: 350, sd: 60, type: "area" },
        { label: "Hypopharynx", mean: 200, sd: 40, type: "area" },
        { label: "PNS-Ad1", mean: 15, sd: 3, type: "length" },
        { label: "SP-Ad2", mean: 11, sd: 3, type: "length" },
        { label: "Vallecula-Ad4", mean: 20, sd: 5, type: "length" },
        { label: "Minimum PAS", mean: 10, sd: 3, type: "length" },
        { label: "PNS-Ad2", mean: 18, sd: 4, type: "length" },
        { label: "UP width", mean: 12, sd: 4, type: "length" },
        { label: "LP width", mean: 18, sd: 5, type: "length" },
        { label: "McUP", mean: 10, sd: 3, type: "length" },
        { label: "McLP", mean: 11, sd: 4, type: "length" },
        { label: "SPAS", mean: 10, sd: 3, type: "length" },
        { label: "MAS", mean: 15, sd: 4, type: "length" },
        { label: "IAS", mean: 12, sd: 4, type: "length" },
        { label: "Vertical Airway Length", mean: 70, sd: 10, type: "length" },
        { label: "Eb-PNS", mean: 65, sd: 10, type: "length" },
        { label: "Angle of Nasopharynx", mean: 140, sd: 10, type: "angle" },
        { label: "Adenoid/Nasopharynx Ratio", mean: 0.5, sd: 0.15, type: "ratio" },
      ],
    },
    {
      group: "Child (6-12y)",
      norms: [
        { label: "Nasopharynx", mean: 180, sd: 40, type: "area" },
        { label: "Oropharynx", mean: 260, sd: 50, type: "area" },
        { label: "Hypopharynx", mean: 150, sd: 35, type: "area" },
        { label: "PNS-Ad1", mean: 12, sd: 3, type: "length" },
        { label: "SP-Ad2", mean: 9, sd: 3, type: "length" },
        { label: "Vallecula-Ad4", mean: 16, sd: 4, type: "length" },
        { label: "Minimum PAS", mean: 8, sd: 3, type: "length" },
        { label: "McUP", mean: 8, sd: 3, type: "length" },
        { label: "McLP", mean: 9, sd: 3, type: "length" },
        { label: "Vertical Airway Length", mean: 55, sd: 8, type: "length" },
        { label: "Adenoid/Nasopharynx Ratio", mean: 0.6, sd: 0.15, type: "ratio" },
      ],
    },
    {
      group: "Adolescent (13-17y)",
      norms: [
        { label: "Nasopharynx", mean: 220, sd: 45, type: "area" },
        { label: "Oropharynx", mean: 310, sd: 55, type: "area" },
        { label: "Hypopharynx", mean: 180, sd: 38, type: "area" },
        { label: "PNS-Ad1", mean: 14, sd: 3, type: "length" },
        { label: "SP-Ad2", mean: 10, sd: 3, type: "length" },
        { label: "Vallecula-Ad4", mean: 18, sd: 4, type: "length" },
        { label: "Minimum PAS", mean: 9, sd: 3, type: "length" },
        { label: "McUP", mean: 9, sd: 3, type: "length" },
        { label: "McLP", mean: 10, sd: 3, type: "length" },
        { label: "Vertical Airway Length", mean: 63, sd: 9, type: "length" },
        { label: "Adenoid/Nasopharynx Ratio", mean: 0.55, sd: 0.15, type: "ratio" },
      ],
    },
    {
      group: "Male (adult)",
      norms: [
        { label: "Oropharynx", mean: 370, sd: 60, type: "area" },
        { label: "Hypopharynx", mean: 210, sd: 40, type: "area" },
        { label: "Vertical Airway Length", mean: 74, sd: 9, type: "length" },
      ],
    },
    {
      group: "Female (adult)",
      norms: [
        { label: "Oropharynx", mean: 330, sd: 55, type: "area" },
        { label: "Hypopharynx", mean: 190, sd: 38, type: "area" },
        { label: "Vertical Airway Length", mean: 66, sd: 8, type: "length" },
      ],
    },
  ],
};

export const LUT_PRESETS = [
  { id: "gray", name: "Grayscale", stops: ["#000", "#fff"] },
  { id: "hot", name: "Hot", stops: ["#000", "#f00", "#ff0", "#fff"] },
  { id: "cool", name: "Cool", stops: ["#0ff", "#00f", "#f0f"] },
  { id: "jet", name: "Jet", stops: ["#00f", "#0ff", "#0f0", "#ff0", "#f00"] },
  { id: "viridis", name: "Viridis", stops: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] },
  { id: "magma", name: "Magma", stops: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#fdb42f", "#fcffa4"] },
  { id: "inferno", name: "Inferno", stops: ["#000004", "#160b39", "#420a68", "#6a176e", "#932667", "#bc3754", "#dd513a", "#f37819", "#fca50a", "#fcffa4"] },
  { id: "cividis", name: "Cividis", stops: ["#00204c", "#003f8c", "#1a5c8c", "#467b8c", "#6f948c", "#a3b07a", "#d4b84d", "#fde23a"] },
  { id: "bone", name: "Bone", stops: ["#000", "#5e7ba0", "#fff"] },
  { id: "rainbow", name: "Rainbow", stops: ["#f00", "#ff0", "#0f0", "#0ff", "#00f", "#f0f"] },
];
