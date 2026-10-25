import { normDeviation } from "./utils.js";
import { isApproximateSd } from "../data/norms.js";

export const RULES = {
  // ═══════════════════════════════════════════
  // SKELETAL — AP
  // ═══════════════════════════════════════════
  SNA: {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "SNA Angle",
    description: "Maxillary position relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protruded relative to cranial base";
      if (v < m) return "Maxilla is retruded relative to cranial base";
      return "Maxillary position is within normal range";
    },
  },
  SNB: {
    category: "skeletal", subgroup: "mandible-ap",
    label: "SNB Angle",
    description: "Mandibular position relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Mandible is prognathic relative to cranial base";
      if (v < m) return "Mandible is retrognathic relative to cranial base";
      return "Mandibular position is within normal range";
    },
  },
  ANB: {
    category: "skeletal", subgroup: "ap-differential",
    label: "ANB Angle",
    description: "Sagittal jaw relationship — difference between SNA and SNB (derived, can be negative)",
    interpret: (v, m) => {
      if (v > m) return "Skeletal Class II tendency (mandibular retrognathism or maxillary prognathism)";
      if (v < m) return "Skeletal Class III tendency (mandibular prognathism or maxillary retrognathism)";
      return "Sagittal jaw relationship is within normal range (Class I)";
    },
  },
  "N-A-Pog": {
    category: "skeletal", subgroup: "ap-differential",
    label: "N-A-Pog Angle",
    description: "Facial convexity angle",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is convex";
      if (v < m) return "Facial profile is concave";
      return "Facial profile is within normal range";
    },
  },
  "A-N-B": {
    category: "skeletal", subgroup: "ap-differential",
    label: "A-N-B Angle",
    description: "Skeletal convexity at nasion",
    interpret: (v, m) => {
      if (v > m) return "Increased skeletal convexity";
      if (v < m) return "Decreased skeletal convexity or straight profile";
      return "Skeletal convexity is within normal range";
    },
  },
  "Wits": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Wits Appraisal",
    description: "Sagittal jaw relationship measured along occlusal plane",
    interpret: (v, m) => {
      if (v > m) return "Skeletal Class II tendency (AO ahead of BO — maxillary protrusion or mandibular retrusion)";
      if (v < m) return "Skeletal Class III tendency (BO ahead of AO — mandibular protrusion or maxillary retrusion)";
      return "Wits appraisal is within normal range (Class I)";
    },
  },
  "Facial axis": {
    category: "skeletal", subgroup: "overall",
    label: "Facial Axis Angle",
    description: "Direction of facial growth (Ricketts)",
    interpret: (v, m) => {
      if (v < m) return "Vertical/dolichofacial growth pattern";
      if (v > m) return "Horizontal/brachyfacial growth pattern";
      return "Facial growth pattern is within normal range";
    },
  },
  "Facial depth": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Facial Depth Angle",
    description: "Mandibular prominence in relation to Frankfort horizontal",
    interpret: (v, m) => {
      if (v > m) return "Increased mandibular prominence";
      if (v < m) return "Decreased mandibular prominence";
      return "Mandibular prominence is within normal range";
    },
  },
  "Convexity": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Convexity (Point A to facial plane)",
    description: "Skeletal convexity measured in mm (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Increased facial convexity";
      if (v < m) return "Straight or concave facial profile";
      return "Facial convexity is within normal range";
    },
  },
  "Angle of Convexity": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Angle of Convexity",
    description: "Facial convexity angle (Downs)",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more convex";
      if (v < m) return "Facial profile is more concave or straight";
      return "Facial convexity angle is within normal range";
    },
  },
  "FMA": {
    category: "skeletal", subgroup: "vertical",
    label: "Frankfort-Mandibular Plane Angle",
    description: "Mandibular plane angle relative to Frankfort horizontal",
    interpret: (v, m) => {
      if (v > m) return "Hyperdivergent / high-angle skeletal pattern (increased vertical dimension)";
      if (v < m) return "Hypodivergent / low-angle skeletal pattern (decreased vertical dimension)";
      return "Vertical skeletal relationship is within normal range";
    },
  },
  "SN-MP": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-Mandibular Plane Angle",
    description: "Mandibular plane angle relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Hyperdivergent growth pattern (steep mandibular plane)";
      if (v < m) return "Hypodivergent growth pattern (flat mandibular plane)";
      return "Mandibular plane angle is within normal range";
    },
  },
  "GoGn-SN": {
    category: "skeletal", subgroup: "vertical",
    label: "GoGn-SN Angle",
    description: "Gonion-Gnathion to SN plane — mandibular inclination",
    interpret: (v, m) => {
      if (v > m) return "Increased mandibular inclination (hyperdivergent)";
      if (v < m) return "Decreased mandibular inclination (hypodivergent)";
      return "Mandibular inclination is within normal range";
    },
  },
  "SN-Occ": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-Occlusal Plane Angle",
    description: "Occlusal plane inclination relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane";
      if (v < m) return "Flat occlusal plane";
      return "Occlusal plane inclination is within normal range";
    },
  },
  "Lower facial height": {
    category: "skeletal", subgroup: "vertical",
    label: "Lower Facial Height Angle",
    description: "Proportion of lower facial height (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Increased lower facial height (long-face tendency)";
      if (v < m) return "Decreased lower facial height (short-face tendency)";
      return "Lower facial height is within normal range";
    },
  },
  "Mandibular arc": {
    category: "skeletal", subgroup: "overall",
    label: "Mandibular Arc Angle",
    description: "Curvature of mandibular corpus growth (Ricketts)",
    interpret: (v, m) => {
      if (v < m) return "Deficient mandibular corpus growth";
      if (v > m) return "Excessive mandibular corpus growth";
      return "Mandibular arc is within normal range";
    },
  },
  "Y-axis": {
    category: "skeletal", subgroup: "vertical",
    label: "Y-Axis Angle",
    description: "Direction of facial growth relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Vertical growth direction (dolichofacial)";
      if (v < m) return "Horizontal growth direction (brachyfacial)";
      return "Facial growth direction is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL
  // ═══════════════════════════════════════════
  "U1-NA": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-NA Angle",
    description: "Maxillary central incisor inclination relative to NA line",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-NA-mm": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-NA (mm)",
    description: "Maxillary incisor position relative to NA line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are protrusive";
      if (v < m) return "Maxillary incisors are retrusive";
      return "Maxillary incisor position is within normal range";
    },
  },
  "U1-SN": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-SN Angle",
    description: "Maxillary incisor inclination relative to SN plane",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-APog": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-APog Angle",
    description: "Maxillary incisor inclination relative to A-Pog line (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-APog-mm": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-APog (mm)",
    description: "Maxillary incisor position relative to A-Pog line (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are protrusive";
      if (v < m) return "Maxillary incisors are retrusive";
      return "Maxillary incisor position is within normal range";
    },
  },
  "L1-NB": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-NB Angle",
    description: "Mandibular incisor inclination relative to NB line",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined";
      if (v < m) return "Mandibular incisors are retroclined";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "L1-NB-mm": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-NB (mm)",
    description: "Mandibular incisor position relative to NB line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are protrusive";
      if (v < m) return "Mandibular incisors are retrusive";
      return "Mandibular incisor position is within normal range";
    },
  },
  "L1-MP": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-MP Angle (IMPA)",
    description: "Mandibular incisor inclination relative to mandibular plane",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined (lingual crown torque indicated)";
      if (v < m) return "Mandibular incisors are retroclined (labial crown torque indicated)";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "IMPA": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "IMPA",
    description: "Incisor Mandibular Plane Angle",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined";
      if (v < m) return "Mandibular incisors are retroclined";
      return "Incisor mandibular plane angle is within normal range";
    },
  },
  "Interincisal": {
    category: "dental", subgroup: "interincisal",
    label: "Interincisal Angle",
    description: "Angle between maxillary and mandibular incisors",
    interpret: (v, m) => {
      if (v > m) return "Interincisal angle is increased (incisors are retroclined relative to each other)";
      if (v < m) return "Interincisal angle is decreased (incisors are proclined relative to each other, bimaxillary protrusion tendency)";
      return "Interincisal relationship is within normal range";
    },
  },
  "U1-L1": {
    category: "dental", subgroup: "interincisal",
    label: "U1-L1 Angle (Interincisal)",
    description: "Angle between upper and lower incisors — same as Interincisal angle",
    interpret: (v, m) => {
      if (v > m) return "Interincisal angle is increased (incisors are retroclined relative to each other)";
      if (v < m) return "Interincisal angle is decreased (incisors are proclined relative to each other, bimaxillary protrusion tendency)";
      return "Incisor relationship is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SOFT TISSUE
  // ═══════════════════════════════════════════
  "NLA": {
    category: "soft-tissue", subgroup: "lip",
    label: "Nasolabial Angle",
    description: "Angle between columella and upper lip",
    interpret: (v, m) => {
      if (v > m) return "Nasolabial angle is obtuse (upper lip retrusive or nose drooping)";
      if (v < m) return "Nasolabial angle is acute (upper lip protrusive or nose tip elevated)";
      return "Nasolabial angle is within normal range";
    },
  },
  "ULP": {
    category: "soft-tissue", subgroup: "lip",
    label: "Upper Lip Position",
    description: "Upper lip prominence relative to esthetic plane",
    interpret: (v, m) => {
      if (v > m) return "Upper lip is protrusive";
      if (v < m) return "Upper lip is retrusive";
      return "Upper lip position is within normal range";
    },
  },
  "LLP": {
    category: "soft-tissue", subgroup: "lip",
    label: "Lower Lip Position",
    description: "Lower lip prominence relative to esthetic plane",
    interpret: (v, m) => {
      if (v > m) return "Lower lip is protrusive";
      if (v < m) return "Lower lip is retrusive";
      return "Lower lip position is within normal range";
    },
  },
  "Holdaway ratio": {
    category: "soft-tissue", subgroup: "lip",
    label: "Holdaway Ratio",
    description: "Ratio of soft tissue facial harmony",
    interpret: (v, m) => {
      if (v > m) return "Increased soft tissue convexity";
      if (v < m) return "Decreased soft tissue convexity or concave profile";
      return "Soft tissue harmony is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // AIRWAY
  // ═══════════════════════════════════════════
  "PAS": {
    category: "airway", subgroup: "pharyngeal",
    label: "Posterior Airway Space",
    description: "Pharyngeal airway space behind the tongue base",
    interpret: (v, m) => {
      if (v < m) return "Posterior airway space is narrowed (potential airway restriction)";
      if (v > m) return "Posterior airway space is adequate";
      return "Posterior airway space is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Cranial Base
  // ═══════════════════════════════════════════
  "N-S-Ar": {
    category: "skeletal", subgroup: "cranial-base",
    label: "N-S-Ar (Saddle Angle)",
    description: "Cranial base flexure at sella — angle between anterior and posterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Cranial base is more flexed (kyphotic) — anterior cranial base rotated downward relative to posterior";
      if (v < m) return "Cranial base is more extended (lordotic) — anterior cranial base rotated upward relative to posterior";
      return "Cranial base flexure is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Mandibular Shape
  // ═══════════════════════════════════════════
  "S-Ar-Go": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "S-Ar-Go (Articular Angle)",
    description: "Angle at articulare between posterior cranial base and mandibular ramus",
    interpret: (v, m) => {
      if (v > m) return "Increased articular angle — ramus is more posteriorly inclined";
      if (v < m) return "Decreased articular angle — ramus is more anteriorly inclined";
      return "Articular angle is within normal range";
    },
  },
  "Ar-Go-Me": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Ar-Go-Me (Gonial Angle)",
    description: "Angle between mandibular ramus and body — reflects mandibular shape and vertical pattern",
    interpret: (v, m) => {
      if (v > m) return "Increased gonial angle — associated with hyperdivergent growth and increased lower facial height";
      if (v < m) return "Decreased gonial angle — associated with hypodivergent growth and decreased lower facial height";
      return "Gonial angle is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Overall
  // ═══════════════════════════════════════════
  "Sum of angles": {
    category: "skeletal", subgroup: "overall",
    label: "Björk Sum of Angles",
    description: "Sum of saddle + articular + gonial angles — overall facial type indicator",
    interpret: (v, m) => {
      if (v > m) return "Increased sum — hyperdivergent facial type (vertical growth tendency)";
      if (v < m) return "Decreased sum — hypodivergent facial type (horizontal growth tendency)";
      return "Facial type is within normal range";
    },
  },
  "N-Pog": {
    category: "skeletal", subgroup: "overall",
    label: "N-Pog (Facial Plane)",
    description: "Facial plane line from nasion to pogonion — overall facial profile reference",
    interpret: (v, m) => {
      if (v > m) return "Facial plane is more anteriorly inclined";
      if (v < m) return "Facial plane is more posteriorly inclined";
      return "Facial plane inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — AP
  // ═══════════════════════════════════════════
  "N-A": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "N-A Angle",
    description: "Maxillary depth relative to nasion — position of Point A along cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is more protrusive relative to nasion";
      if (v < m) return "Maxilla is more retrusive relative to nasion";
      return "Maxillary depth is within normal range";
    },
  },
  "N-B": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "N-B Angle",
    description: "Mandibular depth relative to nasion — position of Point B along cranial base",
    interpret: (v, m) => {
      if (v > m) return "Mandible is more protrusive relative to nasion";
      if (v < m) return "Mandible is more retrusive relative to nasion";
      return "Mandibular depth is within normal range";
    },
  },
  "A-N": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "A-N Distance",
    description: "Linear distance from Point A to nasion — maxillary position",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protrusive relative to nasion";
      if (v < m) return "Maxilla is retrusive relative to nasion";
      return "Maxillary AP position is within normal range";
    },
  },
  "Facial angle": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Facial Angle",
    description: "Angle between Frankfort horizontal and facial plane (N-Pog)",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more prognathic (mandibular prominence)";
      if (v < m) return "Facial profile is more retrognathic (mandibular deficiency)";
      return "Facial angle is within normal range";
    },
  },
  "AB plane angle": {
    category: "skeletal", subgroup: "ap-differential",
    label: "AB Plane Angle",
    description: "Angle between A-B line and facial plane (N-Pog); negative when B is posterior to A (Downs)",
    interpret: (v, m) => {
      if (v < m) return "AB plane angle more negative — skeletal Class II tendency (Point B further posterior to A)";
      if (v > m) return "AB plane angle less negative or positive — skeletal Class III tendency (Point B forward relative to A)";
      return "AB plane angle is within normal range (Class I)";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Vertical / Plane Angles
  // ═══════════════════════════════════════════
  "Mandibular plane": {
    category: "skeletal", subgroup: "vertical",
    label: "Mandibular Plane Angle",
    description: "Angle of mandibular plane relative to reference (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular plane — hyperdivergent / high-angle pattern";
      if (v < m) return "Flat mandibular plane — hypodivergent / low-angle pattern";
      return "Mandibular plane angle is within normal range";
    },
  },
  "ML-NSL": {
    category: "skeletal", subgroup: "vertical",
    label: "ML-NSL Angle",
    description: "Mandibular line to NSL — mandibular inclination relative to anterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular inclination — hyperdivergent growth pattern";
      if (v < m) return "Flat mandibular inclination — hypodivergent growth pattern";
      return "Mandibular inclination is within normal range";
    },
  },
  "NL-NSL": {
    category: "skeletal", subgroup: "vertical",
    label: "NL-NSL Angle",
    description: "Nasal line to NSL — maxillary inclination relative to anterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxillary plane is steep — posterior maxillary vertical excess";
      if (v < m) return "Maxillary plane is flat — reduced maxillary inclination";
      return "Maxillary inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL — Additional
  // ═══════════════════════════════════════════
  "FMIA": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "FMIA (Frankfort-Mandibular Incisor Angle)",
    description: "Angle between Frankfort horizontal and long axis of mandibular incisor (Tweed)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are retroclined relative to Frankfort horizontal";
      if (v < m) return "Mandibular incisors are proclined relative to Frankfort horizontal";
      return "FMIA is within normal range";
    },
  },
  "L1-APog": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-APog Angle",
    description: "Mandibular incisor inclination relative to A-Pog line",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined relative to A-Pog line";
      if (v < m) return "Mandibular incisors are retroclined relative to A-Pog line";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "L1-APog-mm": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-APog (mm)",
    description: "Mandibular incisor position relative to A-Pog line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are protrusive relative to A-Pog line";
      if (v < m) return "Mandibular incisors are retrusive relative to A-Pog line";
      return "Mandibular incisor position is within normal range";
    },
  },
  "Occlusal plane": {
    category: "dental", subgroup: "occlusion",
    label: "Occlusal Plane Angle",
    description: "Inclination of the occlusal plane relative to a reference plane",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane — associated with hyperdivergent pattern";
      if (v < m) return "Flat occlusal plane — associated with hypodivergent pattern";
      return "Occlusal plane inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Additional Plane/Length
  // ═══════════════════════════════════════════
  "SN-GoGn": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-GoGn Angle",
    description: "Mandibular plane angle relative to SN (same as GoGn-SN)",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular plane — hyperdivergent growth pattern";
      if (v < m) return "Flat mandibular plane — hypodivergent growth pattern";
      return "Mandibular plane angle is within normal range";
    },
  },
  "SN-GoMe": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-GoMe Angle",
    description: "Mandibular plane angle relative to SN (measured at menton)",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular plane — hyperdivergent growth pattern";
      if (v < m) return "Flat mandibular plane — hypodivergent growth pattern";
      return "Mandibular plane angle is within normal range";
    },
  },
  "Occ plane-SN": {
    category: "dental", subgroup: "occlusion",
    label: "Occ Plane-SN Angle",
    description: "Occlusal plane inclination relative to SN (same as SN-Occ)",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane — associated with hyperdivergent pattern";
      if (v < m) return "Flat occlusal plane — associated with hypodivergent pattern";
      return "Occlusal plane inclination is within normal range";
    },
  },
  "Occlusal Plane-SN": {
    category: "dental", subgroup: "occlusion",
    label: "Occlusal Plane-SN Angle",
    description: "Occlusal plane inclination relative to SN",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane — associated with hyperdivergent pattern";
      if (v < m) return "Flat occlusal plane — associated with hypodivergent pattern";
      return "Occlusal plane inclination is within normal range";
    },
  },
  "SN-FH": {
    category: "skeletal", subgroup: "overall",
    label: "SN-FH Angle",
    description: "Angle between SN plane and Frankfort horizontal",
    interpret: (v, m) => {
      if (v > m) return "SN plane is steeply inclined relative to Frankfort horizontal";
      if (v < m) return "SN plane is flat relative to Frankfort horizontal";
      return "SN-FH relationship is within normal range";
    },
  },
  "S-N": {
    category: "skeletal", subgroup: "cranial-base",
    label: "S-N Length",
    description: "Anterior cranial base length (sella to nasion)",
    interpret: (v, m) => {
      if (v > m) return "Anterior cranial base is long";
      if (v < m) return "Anterior cranial base is short";
      return "Anterior cranial base length is within normal range";
    },
  },
  "Anterior cranial base": {
    category: "skeletal", subgroup: "cranial-base",
    label: "Anterior Cranial Base (S-N)",
    description: "Length of anterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Anterior cranial base is long";
      if (v < m) return "Anterior cranial base is short";
      return "Anterior cranial base length is within normal range";
    },
  },
  "Posterior cranial base": {
    category: "skeletal", subgroup: "cranial-base",
    label: "Posterior Cranial Base (S-Ba)",
    description: "Length of posterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Posterior cranial base is long";
      if (v < m) return "Posterior cranial base is short";
      return "Posterior cranial base length is within normal range";
    },
  },
  "S-Ar": {
    category: "skeletal", subgroup: "cranial-base",
    label: "S-Ar Length",
    description: "Posterior cranial base segment from sella to articulare",
    interpret: (v, m) => {
      if (v > m) return "Posterior cranial base (S-Ar segment) is long";
      if (v < m) return "Posterior cranial base (S-Ar segment) is short";
      return "Posterior cranial base length is within normal range";
    },
  },
  "Ar-Go": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Ar-Go Length",
    description: "Ramus height from articulare to gonion",
    interpret: (v, m) => {
      if (v > m) return "Mandibular ramus height is increased";
      if (v < m) return "Mandibular ramus height is decreased";
      return "Ramus height is within normal range";
    },
  },
  "Go-Pog": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Go-Pog Length",
    description: "Mandibular body length from gonion to pogonion",
    interpret: (v, m) => {
      if (v > m) return "Mandibular body length is increased";
      if (v < m) return "Mandibular body length is decreased";
      return "Mandibular body length is within normal range";
    },
  },
  "Ramus height": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Ramus Height",
    description: "Vertical height of mandibular ramus",
    interpret: (v, m) => {
      if (v > m) return "Ramus height is increased";
      if (v < m) return "Ramus height is decreased";
      return "Ramus height is within normal range";
    },
  },
  "S-N-A": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "S-N-A Angle",
    description: "Maxillary position relative to cranial base (same as SNA)",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protruded relative to cranial base";
      if (v < m) return "Maxilla is retruded relative to cranial base";
      return "Maxillary position is within normal range";
    },
  },
  "S-N-B": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "S-N-B Angle",
    description: "Mandibular position relative to cranial base (same as SNB)",
    interpret: (v, m) => {
      if (v > m) return "Mandible is prognathic relative to cranial base";
      if (v < m) return "Mandible is retrognathic relative to cranial base";
      return "Mandibular position is within normal range";
    },
  },
  "Facial plane": {
    category: "skeletal", subgroup: "overall",
    label: "Facial Plane (N-Pog)",
    description: "Facial plane line from nasion to pogonion",
    interpret: (v, m) => {
      if (v > m) return "Facial plane is more anteriorly inclined";
      if (v < m) return "Facial plane is more posteriorly inclined";
      return "Facial plane inclination is within normal range";
    },
  },
  "Facial convexity": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Facial Convexity Angle",
    description: "Angle of facial convexity — soft tissue profile assessment",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more convex";
      if (v < m) return "Facial profile is more concave or straight";
      return "Facial convexity is within normal range";
    },
  },
  "BaN-A": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "BaN-A Angle",
    description: "Maxillary position relative to cranial base (basion-nasion)",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protruded relative to basion-nasion plane";
      if (v < m) return "Maxilla is retruded relative to basion-nasion plane";
      return "Maxillary position (BaN-A) is within normal range";
    },
  },
  "BaN-B": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "BaN-B Angle",
    description: "Mandibular position relative to cranial base (basion-nasion)",
    interpret: (v, m) => {
      if (v > m) return "Mandible is prognathic relative to basion-nasion plane";
      if (v < m) return "Mandible is retrognathic relative to basion-nasion plane";
      return "Mandibular position (BaN-B) is within normal range";
    },
  },
  "BaN-Pog": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "BaN-Pog Angle",
    description: "Chin position relative to cranial base (basion-nasion)",
    interpret: (v, m) => {
      if (v > m) return "Chin is more prominent relative to basion-nasion plane";
      if (v < m) return "Chin is more retrusive relative to basion-nasion plane";
      return "Chin position (BaN-Pog) is within normal range";
    },
  },
  "Cranial base angle": {
    category: "skeletal", subgroup: "cranial-base",
    label: "Cranial Base Angle (N-S-Ba)",
    description: "Angle at sella between anterior and posterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Cranial base is more flexed (kyphotic)";
      if (v < m) return "Cranial base is more extended (lordotic)";
      return "Cranial base angle is within normal range";
    },
  },
  "Craniofacial angle": {
    category: "skeletal", subgroup: "overall",
    label: "Craniofacial Angle",
    description: "Overall craniofacial relationship (Delaire)",
    interpret: (v, m) => {
      if (v > m) return "Craniofacial angle is increased — dorsal rotation pattern";
      if (v < m) return "Craniofacial angle is decreased — ventral rotation pattern";
      return "Craniofacial angle is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Facial Height / Length
  // ═══════════════════════════════════════════
  "Anterior facial height (N-Me)": {
    category: "skeletal", subgroup: "vertical",
    label: "Anterior Facial Height (N-Me)",
    description: "Total anterior facial height from nasion to menton",
    interpret: (v, m) => {
      if (v > m) return "Anterior facial height is increased — long face pattern";
      if (v < m) return "Anterior facial height is decreased — short face pattern";
      return "Anterior facial height is within normal range";
    },
  },
  "N-Go": {
    category: "skeletal", subgroup: "vertical",
    label: "N-Go Length",
    description: "Posterior facial height from nasion to gonion",
    interpret: (v, m) => {
      if (v > m) return "Posterior facial height is increased";
      if (v < m) return "Posterior facial height is decreased";
      return "Posterior facial height is within normal range";
    },
  },
  "Posterior facial height (S-Go)": {
    category: "skeletal", subgroup: "vertical",
    label: "Posterior Facial Height (S-Go)",
    description: "Posterior facial height from sella to gonion",
    interpret: (v, m) => {
      if (v > m) return "Posterior facial height is increased";
      if (v < m) return "Posterior facial height is decreased";
      return "Posterior facial height is within normal range";
    },
  },
  "N-ANS": {
    category: "skeletal", subgroup: "vertical",
    label: "Upper Facial Height (N-ANS)",
    description: "Upper anterior facial height from nasion to anterior nasal spine",
    interpret: (v, m) => {
      if (v > m) return "Upper facial height is increased";
      if (v < m) return "Upper facial height is decreased";
      return "Upper facial height is within normal range";
    },
  },
  "Upper facial height": {
    category: "skeletal", subgroup: "vertical",
    label: "Upper Facial Height",
    description: "Upper third of facial height",
    interpret: (v, m) => {
      if (v > m) return "Upper facial height is increased";
      if (v < m) return "Upper facial height is decreased";
      return "Upper facial height is within normal range";
    },
  },
  "Midface height": {
    category: "skeletal", subgroup: "vertical",
    label: "Midface Height",
    description: "Midface vertical dimension",
    interpret: (v, m) => {
      if (v > m) return "Midface height is increased";
      if (v < m) return "Midface height is decreased";
      return "Midface height is within normal range";
    },
  },
  "Upper:lower facial ratio": {
    category: "skeletal", subgroup: "vertical",
    label: "Upper:Lower Facial Height Ratio",
    description: "Proportion of upper to lower facial height",
    interpret: (v, m) => {
      if (v > m) return "Upper facial height is proportionally greater than lower";
      if (v < m) return "Lower facial height is proportionally greater than upper";
      return "Upper:lower facial height ratio is within normal range";
    },
  },
  "Vertical facial ratio": {
    category: "skeletal", subgroup: "vertical",
    label: "Vertical Facial Ratio",
    description: "Ratio of posterior to anterior facial height",
    interpret: (v, m) => {
      if (v > m) return "Posterior facial height is proportionally large — hypodivergent tendency";
      if (v < m) return "Anterior facial height is proportionally large — hyperdivergent tendency";
      return "Vertical facial ratio is within normal range";
    },
  },
  "Facial width/height ratio": {
    category: "skeletal", subgroup: "vertical",
    label: "Facial Width/Height Ratio",
    description: "Overall facial proportion (width vs height)",
    interpret: (v, m) => {
      if (v > m) return "Face is proportionally wider relative to height";
      if (v < m) return "Face is proportionally taller relative to width";
      return "Facial width/height ratio is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — AP Linear (McNamara / Wylie)
  // ═══════════════════════════════════════════
  "Co-A": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "Co-A Length (McNamara)",
    description: "Maxillary length from condylion to Point A",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is long — maxillary prognathism";
      if (v < m) return "Maxilla is short — maxillary retrognathism";
      return "Maxillary length is within normal range";
    },
  },
  "Co-Pog": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Co-Pog Length (McNamara)",
    description: "Mandibular length from condylion to pogonion",
    interpret: (v, m) => {
      if (v > m) return "Mandible is long — mandibular prognathism";
      if (v < m) return "Mandible is short — mandibular retrognathism";
      return "Mandibular length is within normal range";
    },
  },
  "ANS-Me": {
    category: "skeletal", subgroup: "vertical",
    label: "ANS-Me (McNamara)",
    description: "Lower anterior facial height (McNamara analysis)",
    interpret: (v, m) => {
      if (v > m) return "Lower facial height is increased — vertical maxillary excess";
      if (v < m) return "Lower facial height is decreased";
      return "Lower facial height is within normal range";
    },
  },
  "MMD": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Maxillomandibular Difference",
    description: "Difference between mandibular length (Co-Gn) and maxillary length (Co-A)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular length is disproportionately greater than maxillary length";
      if (v < m) return "Maxillary length is disproportionately greater than mandibular length";
      return "Maxillomandibular difference is within normal range";
    },
  },
  "Maxillary depth": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "Maxillary Depth",
    description: "AP position of maxilla relative to a reference plane",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is more anteriorly positioned";
      if (v < m) return "Maxilla is more posteriorly positioned";
      return "Maxillary depth is within normal range";
    },
  },
  "Mandibular depth": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Mandibular Depth",
    description: "AP position of mandible relative to a reference plane",
    interpret: (v, m) => {
      if (v > m) return "Mandible is more anteriorly positioned";
      if (v < m) return "Mandible is more posteriorly positioned";
      return "Mandibular depth is within normal range";
    },
  },
  "N-PG": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "N-Pog Length (Wylie)",
    description: "Facial plane distance from nasion to pogonion (projected)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular projection is increased";
      if (v < m) return "Mandibular projection is decreased";
      return "Mandibular projection is within normal range";
    },
  },
  "A-B distance": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Wits Appraisal (AO-BO)",
    description: "Signed distance AO-BO along the functional occlusal plane; positive = AO anterior to BO",
    interpret: (v, m) => {
      if (v > m) return "Skeletal Class II tendency (AO ahead of BO — maxillary protrusion or mandibular retrusion)";
      if (v < m) return "Skeletal Class III tendency (BO ahead of AO — mandibular protrusion or maxillary retrusion)";
      return "Wits appraisal is within normal range (Class I)";
    },
  },
  "A to N-perp": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "Point A to Nasion-Perpendicular (McNamara)",
    description: "Signed distance of Point A from the N-perpendicular; positive = anterior",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protrusive relative to the cranial base";
      if (v < m) return "Maxilla is retrusive relative to the cranial base";
      return "Maxillary position is within normal range";
    },
  },
  "Pog to N-perp": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Pogonion to Nasion-Perpendicular (McNamara)",
    description: "Signed distance of Pogonion from the N-perpendicular; positive = anterior",
    interpret: (v, m) => {
      if (v > m) return "Chin is prognathic relative to the cranial base";
      if (v < m) return "Chin is retrognathic relative to the cranial base";
      return "Chin position is within normal range";
    },
  },
  "U1 to A-vertical": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "Upper Incisor to A-Vertical (McNamara)",
    description: "Signed distance of the upper incisor from the vertical through Point A",
    interpret: (v, m) => {
      if (v > m) return "Upper incisor is protrusive";
      if (v < m) return "Upper incisor is retrusive";
      return "Upper incisor position is within normal range";
    },
  },
  "Co-Gn": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Effective Mandibular Length Co-Gn (McNamara)",
    description: "Mandibular length from condylion to gnathion",
    interpret: (v, m) => {
      if (v > m) return "Mandible is long — mandibular prognathism";
      if (v < m) return "Mandible is short — mandibular retrognathism";
      return "Mandibular length is within normal range";
    },
  },
  "Jarabak ratio": {
    category: "skeletal", subgroup: "vertical",
    label: "Jarabak Ratio (S-Go / N-Me)",
    description: "Posterior to anterior face height ratio",
    interpret: (v, m) => {
      if (v < m) return "Low ratio — clockwise (vertical) growth tendency";
      if (v > m) return "High ratio — counter-clockwise (horizontal) growth tendency";
      return "Jarabak ratio is within the neutral range";
    },
  },
  "Angle of convexity": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Angle of Convexity (Downs)",
    description: "180° − N-A-Pog; positive = convex, negative = concave",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more convex";
      if (v < m) return "Facial profile is more concave or straight";
      return "Facial convexity angle is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // ANALYSIS-SPECIFIC INDICES
  // ═══════════════════════════════════════════
  "ODI": {
    category: "skeletal", subgroup: "vertical",
    label: "Overbite Depth Indicator (Kim)",
    description: "Combined assessment of vertical skeletal relationship (Kim analysis)",
    interpret: (v, m) => {
      if (v < m) return "Low ODI — suggests open bite skeletal tendency";
      if (v > m) return "High ODI — suggests deep bite skeletal tendency";
      return "ODI is within normal range";
    },
  },
  "APDI": {
    category: "skeletal", subgroup: "ap-differential",
    label: "AP Dysplasia Indicator (Kim)",
    description: "Combined assessment of sagittal skeletal relationship (Kim analysis)",
    interpret: (v, m) => {
      if (v > m) return "High APDI — suggests skeletal Class III tendency";
      if (v < m) return "Low APDI — suggests skeletal Class II tendency";
      return "APDI is within normal range";
    },
  },
  "CF": {
    category: "skeletal", subgroup: "overall",
    label: "Combination Factor (Kim)",
    description: "Combined vertical and sagittal index (Kim analysis)",
    interpret: (v, m) => {
      if (v > m) return "CF is elevated — see ODI and APDI components";
      if (v < m) return "CF is decreased — see ODI and APDI components";
      return "Combination factor is within normal range";
    },
  },
  "Z-angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "Z-Angle (Merrifield)",
    description: "Angle between Frankfort horizontal and profile line (Merrifield)",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more convex";
      if (v < m) return "Facial profile is more concave or straight";
      return "Z-angle is within normal range";
    },
  },
  "H-line": {
    category: "soft-tissue", subgroup: "profile",
    label: "H-Line (Holdaway)",
    description: "Harmony line from soft tissue chin to upper lip (Holdaway)",
    interpret: (v, m) => {
      if (v > m) return "Soft tissue profile is more convex";
      if (v < m) return "Soft tissue profile is more concave";
      return "H-line is within normal range";
    },
  },
  "H-angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "H-Angle (Holdaway)",
    description: "Angle between NB line and soft tissue harmony line (Holdaway)",
    interpret: (v, m) => {
      if (v > m) return "Soft tissue profile is more convex — increased upper lip prominence";
      if (v < m) return "Soft tissue profile is more concave — decreased upper lip prominence";
      return "H-angle is within normal range";
    },
  },
  "Björk sum": {
    category: "skeletal", subgroup: "overall",
    label: "Björk Sum of Angles",
    description: "Sum of saddle + articular + gonial angles — overall facial type",
    interpret: (v, m) => {
      if (v > m) return "Increased sum — hyperdivergent facial type (vertical growth tendency)";
      if (v < m) return "Decreased sum — hypodivergent facial type (horizontal growth tendency)";
      return "Facial type is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL — Additional / Aliases
  // ═══════════════════════════════════════════
  "Upper incisor to NA line": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "Upper Incisor to NA (mm)",
    description: "Maxillary incisor protrusion relative to NA line (same as U1-NA-mm)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are protrusive";
      if (v < m) return "Maxillary incisors are retrusive";
      return "Maxillary incisor position is within normal range";
    },
  },
  "Lower incisor to A-Pog": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "Lower Incisor to A-Pog (mm)",
    description: "Mandibular incisor position relative to A-Pog line (same as L1-APog-mm)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are protrusive relative to A-Pog line";
      if (v < m) return "Mandibular incisors are retrusive relative to A-Pog line";
      return "Mandibular incisor position is within normal range";
    },
  },
  "U1-ML": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "U1-ML Angle",
    description: "Angle between maxillary incisor and mandibular line",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisor is proclined relative to mandibular plane";
      if (v < m) return "Maxillary incisor is retroclined relative to mandibular plane";
      return "U1-ML angle is within normal range";
    },
  },
  "U1-NSL": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-NSL Angle",
    description: "Maxillary incisor inclination relative to NSL",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SOFT TISSUE — Profile / Esthetic
  // ═══════════════════════════════════════════
  "Upper lip to E-plane": {
    category: "soft-tissue", subgroup: "profile",
    label: "Upper Lip to E-Plane (Ricketts)",
    description: "Distance from upper lip to esthetic plane (nose-chin line)",
    interpret: (v, m) => {
      if (v > m) return "Upper lip is protrusive relative to esthetic plane";
      if (v < m) return "Upper lip is retrusive relative to esthetic plane";
      return "Upper lip position is within normal range";
    },
  },
  "Lower lip to E-plane": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lower Lip to E-Plane (Ricketts)",
    description: "Distance from lower lip to esthetic plane (nose-chin line)",
    interpret: (v, m) => {
      if (v > m) return "Lower lip is protrusive relative to esthetic plane";
      if (v < m) return "Lower lip is retrusive relative to esthetic plane";
      return "Lower lip position is within normal range";
    },
  },
  "Upper lip to S-line": {
    category: "soft-tissue", subgroup: "profile",
    label: "Upper Lip to S-Line (Steiner)",
    description: "Distance from upper lip to Steiner's S-line (SN-pogonion)",
    interpret: (v, m) => {
      if (v > m) return "Upper lip is protrusive relative to S-line";
      if (v < m) return "Upper lip is retrusive relative to S-line";
      return "Upper lip position is within normal range";
    },
  },
  "Lower lip to S-line": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lower Lip to S-Line (Steiner)",
    description: "Distance from lower lip to Steiner's S-line (SN-pogonion)",
    interpret: (v, m) => {
      if (v > m) return "Lower lip is protrusive relative to S-line";
      if (v < m) return "Lower lip is retrusive relative to S-line";
      return "Lower lip position is within normal range";
    },
  },
  "Upper lip protrusion": {
    category: "soft-tissue", subgroup: "profile",
    label: "Upper Lip Protrusion",
    description: "Upper lip prominence relative to a reference line",
    interpret: (v, m) => {
      if (v > m) return "Upper lip is protrusive";
      if (v < m) return "Upper lip is retrusive";
      return "Upper lip protrusion is within normal range";
    },
  },
  "Lower lip protrusion": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lower Lip Protrusion",
    description: "Lower lip prominence relative to a reference line",
    interpret: (v, m) => {
      if (v > m) return "Lower lip is protrusive";
      if (v < m) return "Lower lip is retrusive";
      return "Lower lip protrusion is within normal range";
    },
  },
  "Nasofrontal angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "Nasofrontal Angle",
    description: "Angle between forehead and nasal dorsum",
    interpret: (v, m) => {
      if (v > m) return "Nasofrontal angle is increased — deeper nasal root";
      if (v < m) return "Nasofrontal angle is decreased — shallower nasal root";
      return "Nasofrontal angle is within normal range";
    },
  },
  "Mentolabial angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "Mentolabial Angle",
    description: "Angle between lower lip and chin contour",
    interpret: (v, m) => {
      if (v > m) return "Mentolabial angle is increased — deeper labiomental groove";
      if (v < m) return "Mentolabial angle is decreased — shallower labiomental groove";
      return "Mentolabial angle is within normal range";
    },
  },
  "Cervicomental angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "Cervicomental Angle",
    description: "Angle between neck and chin — defines cervicomental definition",
    interpret: (v, m) => {
      if (v > m) return "Cervicomental angle is increased — poor cervicomental definition";
      if (v < m) return "Cervicomental angle is decreased — well-defined cervicomental contour";
      return "Cervicomental angle is within normal range";
    },
  },
  "Lip-chin-throat angle": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lip-Chin-Throat Angle (Arnett)",
    description: "Angle formed by lower lip, chin, and throat (Arnett analysis)",
    interpret: (v, m) => {
      if (v > m) return "Angle is increased — poor lower face-neck definition";
      if (v < m) return "Angle is decreased — well-defined lower face-neck contour";
      return "Lip-chin-throat angle is within normal range";
    },
  },
  "Interlabial gap": {
    category: "soft-tissue", subgroup: "profile",
    label: "Interlabial Gap",
    description: "Distance between upper and lower lip at rest",
    interpret: (v, m) => {
      if (v > m) return "Increased interlabial gap — possible lip incompetence";
      if (v < m) return "Lip closure is within normal limits";
      return "Interlabial gap is within normal range";
    },
  },
  "Upper lip vertical": {
    category: "soft-tissue", subgroup: "profile",
    label: "Upper Lip Vertical (Arnett)",
    description: "Vertical height of the upper lip (Arnett analysis)",
    interpret: (v, m) => {
      if (v > m) return "Upper lip vertical height is increased";
      if (v < m) return "Upper lip vertical height is decreased";
      return "Upper lip vertical height is within normal range";
    },
  },
  "Upper lip height": {
    category: "soft-tissue", subgroup: "profile",
    label: "Upper Lip Height",
    description: "Vertical height of upper lip",
    interpret: (v, m) => {
      if (v > m) return "Upper lip height is increased";
      if (v < m) return "Upper lip height is decreased";
      return "Upper lip height is within normal range";
    },
  },
  "Lower lip height": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lower Lip Height",
    description: "Vertical height of lower lip",
    interpret: (v, m) => {
      if (v > m) return "Lower lip height is increased";
      if (v < m) return "Lower lip height is decreased";
      return "Lower lip height is within normal range";
    },
  },
  "Nasal bridge length": {
    category: "soft-tissue", subgroup: "nasal",
    label: "Nasal Bridge Length",
    description: "Length of nasal bridge from nasion to pronasale",
    interpret: (v, m) => {
      if (v > m) return "Nasal bridge is long";
      if (v < m) return "Nasal bridge is short";
      return "Nasal bridge length is within normal range";
    },
  },
  "Nasal protrusion": {
    category: "soft-tissue", subgroup: "nasal",
    label: "Nasal Protrusion",
    description: "Anterior projection of the nose from the facial plane",
    interpret: (v, m) => {
      if (v > m) return "Nasal protrusion is increased — prominent nose";
      if (v < m) return "Nasal protrusion is decreased — flat nose";
      return "Nasal protrusion is within normal range";
    },
  },
  "Nasal width": {
    category: "soft-tissue", subgroup: "nasal",
    label: "Nasal Width",
    description: "Transverse width of the nose at alar base",
    interpret: (v, m) => {
      if (v > m) return "Nasal width is increased — wide nose";
      if (v < m) return "Nasal width is decreased — narrow nose";
      return "Nasal width is within normal range";
    },
  },
  "Nasal height": {
    category: "soft-tissue", subgroup: "nasal",
    label: "Nasal Height",
    description: "Vertical height of the nose from nasion to subnasale",
    interpret: (v, m) => {
      if (v > m) return "Nasal height is increased";
      if (v < m) return "Nasal height is decreased";
      return "Nasal height is within normal range";
    },
  },
  "Soft tissue facial plane": {
    category: "soft-tissue", subgroup: "profile",
    label: "Soft Tissue Facial Plane",
    description: "Soft tissue facial plane from glabella to soft tissue pogonion (Holdaway)",
    interpret: (v, m) => {
      if (v > m) return "Soft tissue facial plane is more anteriorly inclined";
      if (v < m) return "Soft tissue facial plane is more posteriorly inclined";
      return "Soft tissue facial plane is within normal range";
    },
  },
  "Lower facial profile": {
    category: "soft-tissue", subgroup: "profile",
    label: "Lower Facial Profile (Arnett)",
    description: "Overall lower facial soft tissue profile assessment (Arnett)",
    interpret: (v, m) => {
      if (v > m) return "Lower facial profile is more convex";
      if (v < m) return "Lower facial profile is more concave";
      return "Lower facial profile is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // AIRWAY
  // ═══════════════════════════════════════════
  "Minimum PAS": {
    category: "airway", subgroup: "pharyngeal",
    label: "Minimum Posterior Airway Space",
    description: "Narrowest sagittal dimension of the pharyngeal airway",
    interpret: (v, m) => {
      if (v < m) return "Minimum pharyngeal airway is narrowed — potential airway restriction";
      if (v > m) return "Pharyngeal airway is adequate";
      return "Minimum PAS is within normal range";
    },
  },
  "PNS-Ad1": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "PNS-Ad1 (Nasopharyngeal Airway)",
    description: "Nasopharyngeal airway depth at PNS level",
    interpret: (v, m) => {
      if (v < m) return "Nasopharyngeal airway is narrowed";
      if (v > m) return "Nasopharyngeal airway is adequate";
      return "Nasopharyngeal airway depth is within normal range";
    },
  },
  "SP-Ad2": {
    category: "airway", subgroup: "oropharyngeal",
    label: "SP-Ad2 (Oropharyngeal Airway)",
    description: "Oropharyngeal airway depth at level of soft palate",
    interpret: (v, m) => {
      if (v < m) return "Oropharyngeal airway is narrowed at the level of the soft palate";
      if (v > m) return "Oropharyngeal airway is adequate at the level of the soft palate";
      return "Oropharyngeal airway depth is within normal range";
    },
  },
  "Vallecula-Ad4": {
    category: "airway", subgroup: "hypopharyngeal",
    label: "Vallecula-Ad4 (Hypopharyngeal Airway)",
    description: "Hypopharyngeal airway depth at vallecula level",
    interpret: (v, m) => {
      if (v < m) return "Hypopharyngeal airway is narrowed at the level of the vallecula";
      if (v > m) return "Hypopharyngeal airway is adequate at the level of the vallecula";
      return "Hypopharyngeal airway depth is within normal range";
    },
  },
  "Nasopharynx": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "Nasopharyngeal Airway Area",
    description: "Cross-sectional area of the nasopharynx (PNS-Ad1-Ad2-SP)",
    interpret: (v, m) => {
      if (v < m - m * 0.3) return "Nasopharyngeal airway area is significantly reduced — possible adenoid hypertrophy or narrow nasopharynx";
      if (v < m) return "Nasopharyngeal airway area is mildly reduced";
      if (v > m + m * 0.3) return "Nasopharyngeal airway area is increased — patent nasopharynx";
      return "Nasopharyngeal airway area is within normal range";
    },
  },
  "Oropharynx": {
    category: "airway", subgroup: "oropharyngeal",
    label: "Oropharyngeal Airway Area",
    description: "Cross-sectional area of the oropharynx (SP-Ad3-Vallecula-Epiglottis-SP_mid)",
    interpret: (v, m) => {
      if (v < m - m * 0.3) return "Oropharyngeal airway area is significantly reduced — potential obstruction at soft palate or tongue base level";
      if (v < m) return "Oropharyngeal airway area is mildly reduced — possible retropalatal or retroglossal narrowing";
      if (v > m + m * 0.3) return "Oropharyngeal airway area is increased — patent oropharynx";
      return "Oropharyngeal airway area is within normal range";
    },
  },
  "Hypopharynx": {
    category: "airway", subgroup: "hypopharyngeal",
    label: "Hypopharyngeal Airway Area",
    description: "Cross-sectional area of the hypopharynx (Vallecula-Epiglottis-PAS_lowest-Ad4)",
    interpret: (v, m) => {
      if (v < m - m * 0.3) return "Hypopharyngeal airway area is significantly reduced — possible retroglossal or epiglottic obstruction";
      if (v < m) return "Hypopharyngeal airway area is mildly reduced";
      if (v > m + m * 0.3) return "Hypopharyngeal airway area is increased — patent hypopharynx";
      return "Hypopharyngeal airway area is within normal range";
    },
  },
  "PNS-Ad2": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "PNS-Ad2 (Nasopharyngeal Depth at So)",
    description: "Nasopharyngeal airway depth at the So level (midpoint S-Ba)",
    interpret: (v, m) => {
      if (v < m) return "Nasopharyngeal airway is narrowed at the So level";
      if (v > m) return "Nasopharyngeal airway is adequate at the So level";
      return "Nasopharyngeal airway depth at So level is within normal range";
    },
  },
  "SP_mid width": {
    category: "airway", subgroup: "oropharyngeal",
    label: "Upper Pharyngeal Width (Retropalatal)",
    description: "Width of the nasopharynx at the level of SP_mid (soft palate midpoint)",
    interpret: (v, m) => {
      if (v < m) return "Retropalatal airway width is narrowed — possible velopharyngeal obstruction";
      if (v > m) return "Retropalatal airway width is adequate";
      return "Retropalatal airway width is within normal range";
    },
  },
  "LP width": {
    category: "airway", subgroup: "hypopharyngeal",
    label: "Lower Pharyngeal Width",
    description: "Width of the lower pharynx at the C3-C4 level",
    interpret: (v, m) => {
      if (v < m) return "Lower pharyngeal width is narrowed — possible hypopharyngeal restriction";
      if (v > m) return "Lower pharyngeal width is adequate";
      return "Lower pharyngeal width is within normal range";
    },
  },
  "McUP": {
    category: "airway", subgroup: "oropharyngeal",
    label: "Minimum Cross-sectional Width — Upper Pharynx",
    description: "Minimum cross-sectional width of the upper pharynx (retropalatal)",
    interpret: (v, m) => {
      if (v < m) return "Critical narrowing of the upper pharynx — high risk of retropalatal collapse";
      if (v > m) return "Upper pharynx minimum width is adequate";
      return "Upper pharynx minimum width is within normal range";
    },
  },
  "McLP": {
    category: "airway", subgroup: "hypopharyngeal",
    label: "Minimum Cross-sectional Width — Lower Pharynx",
    description: "Minimum cross-sectional width of the lower pharynx (retroglossal)",
    interpret: (v, m) => {
      if (v < m) return "Critical narrowing of the lower pharynx — high risk of retroglossal collapse";
      if (v > m) return "Lower pharynx minimum width is adequate";
      return "Lower pharynx minimum width is within normal range";
    },
  },
  "MAS": {
    category: "airway", subgroup: "oropharyngeal",
    label: "Middle Airway Space",
    description: "Airway space at the mid-oropharyngeal level",
    interpret: (v, m) => {
      if (v < m) return "Middle airway space is narrowed — possible mid-oropharyngeal obstruction";
      if (v > m) return "Middle airway space is adequate";
      return "Middle airway space is within normal range";
    },
  },
  "IAS": {
    category: "airway", subgroup: "hypopharyngeal",
    label: "Inferior Airway Space",
    description: "Airway space at the hypopharyngeal level",
    interpret: (v, m) => {
      if (v < m) return "Inferior airway space is narrowed — possible hypopharyngeal obstruction";
      if (v > m) return "Inferior airway space is adequate";
      return "Inferior airway space is within normal range";
    },
  },
  "Vertical Airway Length": {
    category: "airway", subgroup: "overall",
    label: "Vertical Airway Length",
    description: "Vertical distance from PNS to the base of the epiglottis",
    interpret: (v, m) => {
      if (v > m) return "Vertical airway length is increased — possible long soft palate or low epiglottis";
      if (v < m) return "Vertical airway length is decreased — possible short pharynx";
      return "Vertical airway length is within normal range";
    },
  },
  "Eb-PNS": {
    category: "airway", subgroup: "overall",
    label: "Oblique Airway Length",
    description: "Oblique distance from the base of the epiglottis to PNS",
    interpret: (v, m) => {
      if (v > m) return "Oblique airway length is increased";
      if (v < m) return "Oblique airway length is decreased";
      return "Oblique airway length is within normal range";
    },
  },
  "Angle of Nasopharynx": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "Angle of the Nasopharynx",
    description: "Angle formed by the nasopharyngeal airway walls (PNS-Ad1-Ad2)",
    interpret: (v, m) => {
      if (v < m) return "Nasopharyngeal angle is acute — possible constricted nasopharyngeal inlet";
      if (v > m) return "Nasopharyngeal angle is obtuse — patent nasopharyngeal inlet";
      return "Nasopharyngeal angle is within normal range";
    },
  },
  "Adenoid/Nasopharynx Ratio": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "Adenoid/Nasopharynx Ratio",
    description: "Ratio of adenoid thickness to nasopharyngeal depth",
    interpret: (v, m) => {
      if (v > m + m * 0.3) return "Adenoid/nasopharynx ratio is significantly increased — adenoid hypertrophy causing airway compromise";
      if (v > m) return "Adenoid/nasopharynx ratio is mildly increased — borderline adenoid enlargement";
      if (v < m - m * 0.3) return "Adenoid/nasopharynx ratio is decreased — minimal adenoid tissue";
      return "Adenoid/nasopharynx ratio is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // VERTICAL — Additional Plane Angles
  // ═══════════════════════════════════════════
  "Occlusomandibular angle": {
    category: "dental", subgroup: "occlusion",
    label: "Occlusomandibular Angle",
    description: "Angle between occlusal plane and mandibular plane",
    interpret: (v, m) => {
      if (v > m) return "Occlusomandibular angle is increased";
      if (v < m) return "Occlusomandibular angle is decreased";
      return "Occlusomandibular angle is within normal range";
    },
  },
  "Occlusopalatal angle": {
    category: "dental", subgroup: "occlusion",
    label: "Occlusopalatal Angle",
    description: "Angle between occlusal plane and palatal plane",
    interpret: (v, m) => {
      if (v > m) return "Occlusopalatal angle is increased";
      if (v < m) return "Occlusopalatal angle is decreased";
      return "Occlusopalatal angle is within normal range";
    },
  },
  "Palatocranial angle": {
    category: "skeletal", subgroup: "vertical",
    label: "Palatocranial Angle",
    description: "Angle between palatal plane and cranial base",
    interpret: (v, m) => {
      if (v > m) return "Palatal plane is steep relative to cranial base";
      if (v < m) return "Palatal plane is flat relative to cranial base";
      return "Palatocranial angle is within normal range";
    },
  },
  "Palatomandibular angle": {
    category: "skeletal", subgroup: "vertical",
    label: "Palatomandibular Angle",
    description: "Angle between palatal plane and mandibular plane",
    interpret: (v, m) => {
      if (v > m) return "Palatomandibular angle is increased — hyperdivergent pattern";
      if (v < m) return "Palatomandibular angle is decreased — hypodivergent pattern";
      return "Palatomandibular angle is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL — Sassouni Angles
  // ═══════════════════════════════════════════
  "Angle I": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "Sassouni Angle I",
    description: "Sassouni archial analysis — maxillary incisor angle",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisor angle is increased";
      if (v < m) return "Maxillary incisor angle is decreased";
      return "Sassouni Angle I is within normal range";
    },
  },
  "Angle I'": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "Sassouni Angle I'",
    description: "Sassouni archial analysis — maxillary incisor angle (variant)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisor angle (I') is increased";
      if (v < m) return "Maxillary incisor angle (I') is decreased";
      return "Sassouni Angle I' is within normal range";
    },
  },
  "Angle I''": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "Sassouni Angle I''",
    description: "Sassouni archial analysis — maxillary incisor angle (variant 2)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisor angle (I'') is increased";
      if (v < m) return "Maxillary incisor angle (I'') is decreased";
      return "Sassouni Angle I'' is within normal range";
    },
  },
  "Angle M": {
    category: "dental", subgroup: "occlusion",
    label: "Sassouni Angle M",
    description: "Sassouni archial analysis — molar angle",
    interpret: (v, m) => {
      if (v > m) return "Molar angle (M) is increased";
      if (v < m) return "Molar angle (M) is decreased";
      return "Sassouni Angle M is within normal range";
    },
  },
  "Angle M'": {
    category: "dental", subgroup: "occlusion",
    label: "Sassouni Angle M'",
    description: "Sassouni archial analysis — molar angle (variant)",
    interpret: (v, m) => {
      if (v > m) return "Molar angle (M') is increased";
      if (v < m) return "Molar angle (M') is decreased";
      return "Sassouni Angle M' is within normal range";
    },
  },
  "Angle M''": {
    category: "dental", subgroup: "occlusion",
    label: "Sassouni Angle M''",
    description: "Sassouni archial analysis — molar angle (variant 2)",
    interpret: (v, m) => {
      if (v > m) return "Molar angle (M'') is increased";
      if (v < m) return "Molar angle (M'') is decreased";
      return "Sassouni Angle M'' is within normal range";
    },
  },
  "Angle R": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Sassouni Angle R",
    description: "Sassouni archial analysis — ramus angle",
    interpret: (v, m) => {
      if (v > m) return "Ramus angle (R) is increased";
      if (v < m) return "Ramus angle (R) is decreased";
      return "Sassouni Angle R is within normal range";
    },
  },
  "Angle rfl'": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Sassouni Angle rfl'",
    description: "Sassouni archial analysis — ramus/molar relationship angle",
    interpret: (v, m) => {
      if (v > m) return "Angle rfl' is increased";
      if (v < m) return "Angle rfl' is decreased";
      return "Sassouni Angle rfl' is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // AB plane aliases
  // ═══════════════════════════════════════════
  "AB plane": {
    category: "skeletal", subgroup: "ap-differential",
    label: "AB Plane Angle (Downs)",
    description: "Angle between AB line and facial plane (Downs)",
    interpret: (v, m) => {
      if (v < m) return "AB plane angle more negative — skeletal Class II tendency (Point B further posterior to A)";
      if (v > m) return "AB plane angle less negative or positive — skeletal Class III tendency (Point B forward relative to A)";
      return "AB plane angle is within normal range (Class I)";
    },
  },
  "SNB/Facial angle": {
    category: "assessment", subgroup: "overall",
    label: "Overall AP Assessment",
    description: "Combined assessment of mandibular AP position",
  },
  "ANB difference": {
    category: "assessment", subgroup: "sagittal",
    label: "Sagittal Classification",
    description: "Skeletal Class determination based on ANB",
  },
};

// ─── Diagnostic synthesis ───────────────────────────────────────────────────
// Combines individual deviations into the statements a clinician makes: the
// sagittal class and which jaw drives it, the vertical pattern, dental
// compensation, and where measures disagree. `sign` orients each indicator so
// that + means Class II (sagittal) or more vertical/high-angle (vertical).
const SAGITTAL_INDICATORS = [
  { labels: ["ANB", "A-N-B"], sign: 1 },
  { labels: ["Wits", "A-B distance"], sign: 1 },
  { labels: ["AB plane angle", "AB plane"], sign: -1 },
  { labels: ["Convexity"], sign: 1, types: ["distance"] },
];
const MAXILLA_INDICATORS = [{ labels: ["SNA", "S-N-A"], sign: 1 }, { labels: ["A to N-perp"], sign: 1 }, { labels: ["Maxillary depth", "Maxillary Depth"], sign: 1 }];
const MANDIBLE_INDICATORS = [{ labels: ["SNB", "S-N-B"], sign: 1 }, { labels: ["Pog to N-perp"], sign: 1 }, { labels: ["Facial depth", "Facial angle"], sign: 1 }];
const VERTICAL_INDICATORS = [
  { labels: ["FMA", "Mandibular plane angle", "Mandibular plane"], sign: 1 },
  { labels: ["SN-GoMe", "SN-GoGn", "SN-MP", "GoGn-SN", "ML-NSL"], sign: 1 },
  { labels: ["Y-axis"], sign: 1 },
  { labels: ["Lower facial height"], sign: 1 },
  { labels: ["Facial axis"], sign: -1 },
  { labels: ["Jarabak ratio"], sign: -1 },
];
const UPPER_INCISOR = ["U1-NA (°)", "U1-NA", "U1-SN", "U1-NSL", "U1-APog"];
const LOWER_INCISOR = ["IMPA", "L1-MP", "L1-NB (°)", "L1-NB", "L1-APog"];

function pick(deviations, ind) {
  for (const l of ind.labels) {
    const d = deviations.find(x => x.label === l && (!ind.types || ind.types.includes(x.measureType)));
    if (d && isFinite(d.zScore)) return { label: d.label, z: ind.sign * d.zScore };
  }
  return null;
}
const firstOf = (deviations, labels) => deviations.find(d => labels.includes(d.label) && isFinite(d.zScore)) || null;

export function synthesizeDiagnosis(deviations) {
  const sag = SAGITTAL_INDICATORS.map(i => pick(deviations, i)).filter(Boolean);
  const vert = VERTICAL_INDICATORS.map(i => pick(deviations, i)).filter(Boolean);
  if (!sag.length && !vert.length) return null;
  const statements = [], disagreements = [];

  // Sagittal: majority of indicators beyond ±1 SD.
  let skeletalClass = null;
  if (sag.length) {
    const ii = sag.filter(x => x.z > 1), iii = sag.filter(x => x.z < -1);
    skeletalClass = ii.length > iii.length ? "II" : iii.length > ii.length ? "III" : "I";
    if (ii.length && iii.length) disagreements.push(`Sagittal indicators conflict: ${ii.map(x => x.label).join(", ")} suggest Class II while ${iii.map(x => x.label).join(", ")} suggest Class III.`);
    const anb = sag.find(x => ["ANB", "A-N-B"].includes(x.label)), wits = sag.find(x => ["Wits", "A-B distance"].includes(x.label));
    if (anb && wits && Math.abs(anb.z - wits.z) > 1.5 && (Math.abs(anb.z) > 1 || Math.abs(wits.z) > 1)) {
      const sn = firstOf(deviations, ["SN-FH"]);
      disagreements.push(`ANB (${anb.z >= 0 ? "+" : ""}${anb.z.toFixed(1)} SD) and Wits (${wits.z >= 0 ? "+" : ""}${wits.z.toFixed(1)} SD) disagree. ANB depends on the position of nasion and the SN plane, Wits on the occlusal plane${sn ? ` — SN-FH is ${sn.zScore >= 0 ? "+" : ""}${sn.zScore.toFixed(1)} SD here` : ""}. Weigh the measure whose reference is more reliable for this patient.`);
    }
    let detail = "";
    if (skeletalClass !== "I") {
      const mx = MAXILLA_INDICATORS.map(i => pick(deviations, i)).filter(Boolean);
      const md = MANDIBLE_INDICATORS.map(i => pick(deviations, i)).filter(Boolean);
      const maxZ = mx.length ? mx.reduce((a, x) => a + x.z, 0) / mx.length : null;
      const manZ = md.length ? md.reduce((a, x) => a + x.z, 0) / md.length : null;
      const causes = [];
      if (skeletalClass === "II") {
        if (manZ != null && manZ < -1) causes.push("mandibular retrusion");
        if (maxZ != null && maxZ > 1) causes.push("maxillary protrusion");
      } else {
        if (manZ != null && manZ > 1) causes.push("mandibular protrusion");
        if (maxZ != null && maxZ < -1) causes.push("maxillary retrusion");
      }
      detail = causes.length
        ? ` due to ${causes.join(" and ")}`
        : (maxZ != null || manZ != null) ? " — each jaw is within range on its own; the discrepancy is in their relationship" : "";
      if (mx.length && md.length && Math.sign(mx[0].z) !== Math.sign(mx[mx.length - 1].z) && Math.abs(mx[0].z - mx[mx.length - 1].z) > 2) {
        disagreements.push(`Maxillary position differs between ${mx[0].label} and ${mx[mx.length - 1].label} — check the inclination of the SN plane.`);
      }
    }
    statements.push(`Skeletal Class ${skeletalClass}${detail}.`);
  }

  // Vertical: mean oriented z.
  if (vert.length) {
    const vz = vert.reduce((a, x) => a + x.z, 0) / vert.length;
    statements.push(vz > 1 ? "Hyperdivergent (high-angle, vertical) pattern." : vz < -1 ? "Hypodivergent (low-angle, horizontal) pattern." : "Normodivergent vertical pattern.");
    const hi = vert.filter(x => x.z > 1.5), lo = vert.filter(x => x.z < -1.5);
    if (hi.length && lo.length) disagreements.push(`Vertical indicators conflict: ${hi.map(x => x.label).join(", ")} vs ${lo.map(x => x.label).join(", ")}.`);
  }

  // Dentoalveolar compensation.
  const u = firstOf(deviations, UPPER_INCISOR), l = firstOf(deviations, LOWER_INCISOR);
  if (skeletalClass === "II" && ((l && l.zScore > 1) || (u && u.zScore < -1))) {
    statements.push(`Dentoalveolar compensation: ${[l && l.zScore > 1 ? "lower incisors proclined" : null, u && u.zScore < -1 ? "upper incisors retroclined" : null].filter(Boolean).join(", ")} — masks part of the skeletal discrepancy.`);
  } else if (skeletalClass === "III" && ((l && l.zScore < -1) || (u && u.zScore > 1))) {
    statements.push(`Dentoalveolar compensation: ${[u && u.zScore > 1 ? "upper incisors proclined" : null, l && l.zScore < -1 ? "lower incisors retroclined" : null].filter(Boolean).join(", ")} — masks part of the skeletal discrepancy.`);
  }

  return { skeletalClass, statements, disagreements };
}

const PATTERN_RECOGNIZERS = [
  {
    id: "diagnostic-summary",
    label: "Diagnostic Summary",
    analyze: (deviations) => {
      const d = synthesizeDiagnosis(deviations);
      if (!d) return null;
      return { severity: d.skeletalClass && d.skeletalClass !== "I" ? "moderate" : "mild", summary: d.statements.join(" "), detail: "Synthesised from the sagittal, vertical and incisor measurements above; confirm clinically.", diagnosis: d };
    },
  },
  {
    id: "measure-disagreement",
    label: "Measures Disagree",
    analyze: (deviations) => {
      const d = synthesizeDiagnosis(deviations);
      if (!d || !d.disagreements.length) return null;
      return { severity: "mild", summary: "Some measurements point in different directions", detail: d.disagreements.join(" ") };
    },
  },
  {
    id: "skeletal-class",
    label: "Skeletal Class",
    analyze: (deviations) => {
      const anb = deviations.find(d => d.label === "ANB");
      const wits = deviations.find(d => d.label === "Wits" || d.label === "A-B distance");
      if (!anb && !wits) return null;
      const anbZ = anb?.zScore ?? 0;
      const witsZ = wits?.zScore ?? 0;
      if (anbZ > 1.5 || witsZ > 1.5) return { severity: anbZ > 2 || witsZ > 2 ? "severe" : "moderate", summary: "Skeletal Class II pattern", detail: "ANB and/or Wits appraisal indicate sagittal imbalance with mandibular deficiency or maxillary excess." };
      if (anbZ < -1.5 || witsZ < -1.5) return { severity: anbZ < -2 || witsZ < -2 ? "severe" : "moderate", summary: "Skeletal Class III pattern", detail: "ANB and/or Wits appraisal indicate sagittal imbalance with mandibular excess or maxillary deficiency." };
      return null;
    },
  },
  {
    id: "vertical-pattern",
    label: "Vertical Pattern",
    analyze: (deviations) => {
      const vert = deviations.filter(d => d.category === "skeletal" && ["vertical", "overall"].includes(d.subgroup));
      if (vert.length === 0) return null;
      const avgZ = vert.reduce((s, d) => s + d.zScore, 0) / vert.length;
      if (avgZ > 1.2) return { severity: avgZ > 2 ? "severe" : "moderate", summary: "Hyperdivergent growth pattern", detail: "Multiple vertical measurements indicate a tendency toward increased lower facial height and steep mandibular plane." };
      if (avgZ < -1.2) return { severity: avgZ < -2 ? "severe" : "moderate", summary: "Hypodivergent growth pattern", detail: "Multiple vertical measurements indicate a tendency toward decreased lower facial height and flat mandibular plane." };
      return null;
    },
  },
  {
    id: "incisor-compensation",
    label: "Incisor Compensation",
    analyze: (deviations) => {
      const upper = firstOf(deviations, UPPER_INCISOR);
      const lower = firstOf(deviations, LOWER_INCISOR);
      if (!upper || !lower) return null;
      if (upper.zScore > 1 && lower.zScore > 1) return { severity: "moderate", summary: "Bimaxillary protrusion", detail: "Both maxillary and mandibular incisors are proclined — common in bimaxillary dentoalveolar protrusion." };
      if (upper.zScore > 1 && lower.zScore < -1) return { severity: "moderate", summary: "Compensated Class II Division 2 pattern", detail: "Maxillary incisors are proclined while mandibular incisors are retroclined — compensatory mechanism." };
      if (upper.zScore < -1 && lower.zScore > 1) return { severity: "moderate", summary: "Proclined lower incisors with retroclined upper incisors", detail: "May indicate dentoalveolar compensation for skeletal discrepancy." };
      return null;
    },
  },
  {
    id: "airway-skeletal-crossref",
    label: "Airway-Skeletal Correlation",
    analyze: (deviations) => {
      const airway = deviations.filter(d => d.category === "airway");
      if (airway.length < 2) return null;
      const avgAirZ = airway.reduce((s, d) => s + d.zScore, 0) / airway.length;
      const vert = deviations.filter(d => d.category === "skeletal" && ["vertical", "overall"].includes(d.subgroup));
      const sag = deviations.filter(d => d.category === "skeletal" && ["ap-differential", "sagittal"].includes(d.subgroup));
      const vertZ = vert.length ? vert.reduce((s, d) => s + d.zScore, 0) / vert.length : 0;
      const sagZ = sag.length ? sag.reduce((s, d) => s + d.zScore, 0) / sag.length : 0;
      if (avgAirZ < -1 && vertZ > 1) return { severity: Math.min(Math.abs(avgAirZ), vertZ) > 2 ? "severe" : "moderate", summary: "Narrow airway with hyperdivergent pattern", detail: "Hyperdivergent facial type associated with reduced pharyngeal airway — increased risk of sleep-disordered breathing." };
      if (avgAirZ < -1 && sagZ < -1) return { severity: Math.min(Math.abs(avgAirZ), Math.abs(sagZ)) > 2 ? "severe" : "moderate", summary: "Narrow airway with Class III pattern", detail: "Skeletal Class III pattern with reduced pharyngeal airway — may have macroglossia-related airway restriction." };
      if (avgAirZ < -1 && sagZ > 1) return { severity: Math.min(Math.abs(avgAirZ), sagZ) > 2 ? "severe" : "moderate", summary: "Narrow airway with Class II pattern", detail: "Skeletal Class II pattern with mandibular deficiency contributing to reduced pharyngeal airway space." };
      if (avgAirZ > 1 && vertZ < -1) return { severity: "mild", summary: "Wide airway with hypodivergent pattern", detail: "Hypodivergent facial type with wide pharyngeal airway — typical association." };
      return null;
    },
  },
  {
    id: "osa-risk",
    label: "OSA Risk Screening",
    analyze: (deviations) => {
      const criticalNarrowing = deviations.filter(d =>
        d.category === "airway" && d.zScore < -1.5
      );
      if (criticalNarrowing.length < 2) return null;
      const hasMinimal = deviations.some(d => (d.label === "Minimum PAS" || d.label === "McUP" || d.label === "McLP") && d.zScore < -1.5);
      const hasArea = deviations.some(d => (d.label === "Oropharynx" || d.label === "Hypopharynx") && d.zScore < -1.5);
      const hasNaso = deviations.some(d => d.label === "Nasopharynx" && d.zScore < -1.5);
      const vert = deviations.filter(d => d.category === "skeletal" && ["vertical", "overall"].includes(d.subgroup));
      const vertZ = vert.length ? vert.reduce((s, d) => s + d.zScore, 0) / vert.length : 0;
      if ((hasMinimal || hasArea) && vertZ > 1.5) return { severity: "severe", summary: "High OSA risk — narrow airway with hyperdivergent pattern", detail: "Multiple airway segments show critical narrowing (>1.5 SD below mean) in a hyperdivergent skeletal pattern. Strongly recommend sleep study (polysomnography) referral." };
      if (hasMinimal && hasArea) return { severity: "severe", summary: "High OSA risk — multi-level airway narrowing", detail: "Both cross-sectional widths and airway areas show significant narrowing. Sleep-disordered breathing likely. Consider ENT/sleep medicine referral." };
      if (criticalNarrowing.length >= 3) return { severity: "moderate", summary: "Moderate OSA risk — generalized airway narrowing", detail: "Three or more airway measurements show narrowing >1.5 SD. Consider OSA screening questionnaire (STOP-BANG, Epworth)." };
      if (hasMinimal || (hasNaso && hasArea)) return { severity: "mild", summary: "Low-moderate OSA risk — focal airway narrowing", detail: "Focal airway narrowing detected in one or two segments. Monitor for symptoms of sleep-disordered breathing." };
      return null;
    },
  },
];

function sdInterpretationText(zScore, normLabel, interpretFn, value, normMean) {
  const absZ = Math.abs(zScore);
  if (absZ <= 1) {
    return `${normLabel} is within normal range`;
  }
  const directionText = interpretFn(value, normMean);
  const severity = absZ > 2 ? "Abnormal" : "Borderline";
  const direction = directionText.includes("within normal range") ? "" : ` (${directionText})`;
  return `${severity} deviation${direction}`;
}

export function generateInterpretation(allMeas, norms, calibration) {
  const deviations = [];
  const calDone = calibration?.done === true;
  const calTypes = ["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];
  for (const { m, meas } of allMeas) {
    if (!m.label) continue;
    for (const [measureType, value] of Object.entries(meas)) {
      if (measureType.startsWith("_")) continue;
      if (typeof value !== "number" || !isFinite(value)) continue;
      if (!calDone && calTypes.includes(measureType)) continue;
      const norm = norms.find(n => n.markupLabel === m.label && n.measureType === measureType);
      if (!norm || norm.sd <= 0) continue;
      const dev = normDeviation(value, norm);
      const rule = RULES[m.label] || RULES[m.label.split(" ").slice(0, 2).join(" ")];
      const interpretFn = rule?.interpret || (() => "");
      deviations.push({
        label: m.label,
        measureType,
        value,
        mean: norm.mean,
        sd: norm.sd,
        delta: dev.delta,
        zScore: dev.sdUnits,
        within1SD: dev.within1SD,
        within2SD: dev.within2SD,
        category: rule?.category || "other",
        subgroup: rule?.subgroup || "",
        description: rule?.description || "",
        interpretation: sdInterpretationText(dev.sdUnits, rule?.label || m.label, interpretFn, value, norm.mean),
        normSource: norm.source,
        sdApproximate: norm.sdApproximate === true || isApproximateSd(norm.source, m.label, norm.sd),
      });
    }
  }
  const patterns = [];
  for (const recognizer of PATTERN_RECOGNIZERS) {
    const result = recognizer.analyze(deviations);
    if (result) patterns.push({ id: recognizer.id, label: recognizer.label, ...result });
  }
  return { deviations, patterns };
}
