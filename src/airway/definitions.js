// ═══════════════════════════════════════════════════════════════════════════════
// Airway registry: the one definition of every landmark, traced wall and measure.
// The panel, overlay, report, template and research modules all read from here.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  closestBetween, closestOnPolyline, dist, firstHit, footOnLine, lineHits, pointAtFraction,
  polygonArea, polylineLength, sectionBetween,
} from "./geometry.js";

// `aliases` are labels from other analyses and from the older airway template.
export const AIRWAY_LANDMARKS = {
  S: { label: "S", def: "Sella: centre of the pituitary fossa." },
  N: { label: "N", def: "Nasion: most anterior point of the frontonasal suture." },
  A: { label: "A", def: "Point A: deepest point on the anterior border of the maxilla." },
  B: { label: "B", def: "Point B: deepest point on the anterior border of the mandibular symphysis." },
  ANS: { label: "ANS", def: "Anterior nasal spine." },
  PNS: { label: "PNS", def: "Posterior nasal spine: posterior limit of the hard palate." },
  Ptm: { label: "Ptm", aliases: ["PTM"], def: "Pterygomaxillary fissure, most inferior point of its posterior border." },
  Ba: { label: "Ba", def: "Basion: most anterior point of the foramen magnum." },
  Ho: { label: "Hormion", aliases: ["Ho"], def: "Hormion: where the perpendicular from PNS to S-Ba meets the cranial base." },
  Go: { label: "Go", def: "Gonion: point on the angle of the mandible." },
  Gn: { label: "Gn", def: "Gnathion: most anterior and inferior point of the chin." },
  Me: { label: "Me", def: "Menton: lowest point of the mandibular symphysis." },
  Uvula: { label: "Uvula tip", aliases: ["SP", "U1", "Uvula"], def: "Tip of the soft palate." },
  MPA: { label: "MPA", def: "Middle point of the anterior (upper) surface of the soft palate." },
  Epi: { label: "Epiglottis tip", aliases: ["Epiglottis", "Ph1"], def: "Superior margin of the epiglottis." },
  Val: { label: "Vallecula", aliases: ["Va1"], def: "Base of the epiglottic vallecula." },
  Hy: { label: "Hyoid", aliases: ["H", "H1", "Hyoidale"], def: "Most anterior and superior point on the body of the hyoid bone." },
  Ac: { label: "Adenoid convexity", aliases: ["A'"], def: "Fujioka A': point of maximal convexity along the inferior margin of the adenoid shadow." },
  Bo1: { label: "Basiocciput 1", def: "Upper point on the straight part of the anterior margin of the basiocciput." },
  Bo2: { label: "Basiocciput 2", def: "Lower point on the straight part of the anterior margin of the basiocciput." },
  Sbs: { label: "Synchondrosis", aliases: ["D'", "SBS"], def: "Fujioka D': anteroinferior edge of the sphenobasioccipital synchondrosis. If it isn't clear, where the posteroinferior margin of the lateral pterygoid plate crosses the floor of the bony nasopharynx." },
};

export const AIRWAY_WALLS = {
  wall: { label: "Posterior pharyngeal wall", help: "From the nasopharynx down past the vallecula, along the soft tissue surface, including the adenoid surface." },
  softPalate: { label: "Soft palate outline", help: "Along its posterior (airway) surface, starting at PNS and ending at the uvula tip." },
  tongue: { label: "Tongue base", help: "Along the back of the tongue, from above the uvula tip level down past the lower border of the mandible and the vallecula." },
};
export const AIRWAY_ADENOID_AREA = { label: "Adenoid area", help: "Closed outline of the adenoid soft tissue." };

export const AIRWAY_REGIONS = [
  { id: "adenoid", label: "Adenoid" },
  { id: "nasopharynx", label: "Nasopharynx" },
  { id: "retropalatal", label: "Behind the soft palate" },
  { id: "retroglossal", label: "Behind the tongue" },
  { id: "hypopharynx", label: "Hypopharynx" },
  { id: "softPalate", label: "Soft palate" },
  { id: "hyoid", label: "Hyoid" },
  { id: "area", label: "Areas" },
];

const seg = (a, b) => ({ px: dist(a, b), line: [a, b] });
const toWall = (p, c) => {
  const near = closestOnPolyline(p, c.wall);
  return { px: near.d, line: [p, near.point] };
};
// PNS-Ba crossing the wall: Ad1, shared by the children's and adult measures.
const ad1 = (c) => firstHit(c.PNS, c.Ba, c.wall);
const ad1Why = "The wall must cross the PNS-Ba line";

// Soft palate outline running from PNS to the uvula, however it was drawn.
function palateFromPns(c) {
  const p = c.softPalate;
  if (!c.PNS) return p;
  return dist(p[0], c.PNS) <= dist(p[p.length - 1], c.PNS) ? p : [...p].reverse();
}

const CHILD = [0, 18], ADULT = [18, Infinity];

// `ages` is [from, to). `concern` marks the direction that counts towards the
// nasopharyngeal pattern summary (Major 2006). `compute` gets the points and densified
// walls listed in `needs` and returns { px, line } or { why }.
export const AIRWAY_MEASURES = [
  {
    id: "an-ratio", label: "A/N ratio", short: "A/N", region: "adenoid", dim: "ratio", ages: [0, 16], concern: "high",
    needs: ["Ac", "Bo1", "Bo2", "PNS", "Sbs"],
    method: "Adenoid convexity to the basiocciput line, divided by PNS to the synchondrosis (Fujioka 1979).",
    compute: (c) => {
      const foot = footOnLine(c.Ac, c.Bo1, c.Bo2);
      const N = dist(c.PNS, c.Sbs);
      if (!foot || N === 0) return { why: "The basiocciput points or PNS and synchondrosis coincide" };
      return { value: dist(c.Ac, foot) / N, line: [c.Ac, foot] };
    },
  },
  {
    id: "adenoid-area", label: "Adenoid area", short: "Ad area", region: "adenoid", dim: "area", ages: CHILD,
    needs: ["adenoid"], method: "Area of the adenoid outline you traced. Best-supported adenoid measure (Major 2006); no published reference for this construction.",
    compute: (c) => ({ px: polygonArea(c.adenoid), line: null }),
  },
  {
    id: "pns-ad1", label: "PNS-Ad1", region: "nasopharynx", dim: "length", ages: [6, 13], concern: "low",
    needs: ["PNS", "Ba", "wall"], method: "PNS to the adenoid surface along PNS-Ba (Pérez-Rodríguez 2021).",
    compute: (c) => { const h = ad1(c); return h ? seg(c.PNS, h.point) : { why: ad1Why }; },
  },
  {
    id: "ad1-ba", label: "Ad1-Ba", region: "nasopharynx", dim: "length", ages: [6, 13], concern: "high",
    needs: ["PNS", "Ba", "wall"], method: "Adenoid surface to Ba along PNS-Ba (Pérez-Rodríguez 2021).",
    compute: (c) => { const h = ad1(c); return h ? seg(h.point, c.Ba) : { why: ad1Why }; },
  },
  {
    id: "pns-ba", label: "PNS-Ba", region: "nasopharynx", dim: "length", ages: [6, 13],
    needs: ["PNS", "Ba"], method: "Lower sagittal width of the nasopharynx (Pérez-Rodríguez 2021).",
    compute: (c) => seg(c.PNS, c.Ba),
  },
  {
    id: "ptm-ba", label: "Ptm-Ba", region: "nasopharynx", dim: "length", ages: [6, 13],
    needs: ["Ptm", "Ba"], method: "Posterior sagittal width of the bony nasopharynx (Pérez-Rodríguez 2021).",
    compute: (c) => seg(c.Ptm, c.Ba),
  },
  {
    id: "pns-h", label: "PNS-Hormion", short: "PNS-H", region: "nasopharynx", dim: "length", ages: [6, 13], concern: "low",
    needs: ["PNS", "Ho"], method: "Total thickness of the upper nasopharynx (Pérez-Rodríguez 2021).",
    compute: (c) => seg(c.PNS, c.Ho),
  },
  {
    id: "nl", label: "NL (nasopharynx length)", short: "NL", region: "nasopharynx", dim: "length", ages: ADULT,
    needs: ["PNS", "Ba", "wall"], method: "PNS to the posterior wall along PNS-Ba (Sfondrini 2024).",
    compute: (c) => { const h = ad1(c); return h ? seg(c.PNS, h.point) : { why: ad1Why }; },
  },
  {
    id: "pd", label: "PD (nasopharynx depth)", short: "PD", region: "nasopharynx", dim: "length", ages: ADULT,
    needs: ["PNS", "ANS", "wall"], method: "PNS to the posterior wall, parallel to the bispinal plane (Sfondrini 2024).",
    compute: (c) => {
      const behind = { x: 2 * c.PNS.x - c.ANS.x, y: 2 * c.PNS.y - c.ANS.y };
      const h = firstHit(c.PNS, behind, c.wall);
      return h ? seg(c.PNS, h.point) : { why: "The wall must cross the line extended back from ANS-PNS" };
    },
  },
  {
    id: "mislik-p", label: "Distance p", short: "p", region: "retropalatal", dim: "length", ages: [6, 18],
    needs: ["softPalate", "wall"], method: "Shortest distance from the soft palate to the posterior wall (Mislik 2014).",
    compute: (c) => { const n = closestBetween(c.softPalate, c.wall); return { px: n.d, line: [n.a, n.b] }; },
  },
  {
    id: "mcnamara-upper", label: "Upper pharynx (McNamara)", short: "Upper", region: "retropalatal", dim: "length", ages: ADULT,
    needs: ["softPalate", "wall", "PNS"], method: "Anterior half of the soft palate outline to the closest point on the posterior wall (McNamara 1984).",
    compute: (c) => {
      const p = palateFromPns(c);
      const n = closestBetween(sectionBetween(p, 0, polylineLength(p) / 2), c.wall);
      return { px: n.d, line: [n.a, n.b] };
    },
  },
  {
    id: "spas", label: "SPAS", region: "retropalatal", dim: "length", ages: ADULT,
    needs: ["softPalate", "wall", "PNS"], method: "Midpoint of the soft palate's posterior border to the closest point on the posterior wall (Sfondrini 2024).",
    compute: (c) => toWall(pointAtFraction(palateFromPns(c), 0.5), c),
  },
  {
    id: "mas", label: "MAS", region: "retropalatal", dim: "length", ages: ADULT,
    needs: ["Uvula", "wall"], method: "Uvula tip to the posterior wall (Sfondrini 2024). The paper says \"projection\"; the closest point is used.",
    compute: (c) => toWall(c.Uvula, c),
  },
  {
    id: "mislik-t", label: "Distance t", short: "t", region: "retroglossal", dim: "length", ages: [6, 18],
    needs: ["tongue", "wall"], method: "Shortest distance from the tongue to the posterior wall (Mislik 2014).",
    compute: (c) => { const n = closestBetween(c.tongue, c.wall); return { px: n.d, line: [n.a, n.b] }; },
  },
  {
    id: "mcnamara-lower", label: "Lower pharynx (McNamara)", short: "Lower", region: "retroglossal", dim: "length", ages: ADULT,
    needs: ["tongue", "wall", "Go", "Me"], method: "Where the tongue crosses the lower border of the mandible (the Go-Me line) to the closest point on the posterior wall (McNamara 1984).",
    compute: (c) => {
      const hits = lineHits(c.Go, c.Me, c.tongue);
      if (!hits.length) return { why: "The tongue trace must reach the Go-Me line" };
      const hit = hits.reduce((best, h) => (dist(h.point, c.Go) < dist(best.point, c.Go) ? h : best));
      return toWall(hit.point, c);
    },
  },
  {
    id: "pas-min", label: "PAS min", region: "retroglossal", dim: "length", ages: ADULT,
    needs: ["tongue", "wall", "B", "Go"], method: "Tongue base to the posterior wall along the B-Go line (Sfondrini 2024).",
    compute: (c) => {
      const t = firstHit(c.B, c.Go, c.tongue);
      if (!t) return { why: "The tongue trace must cross the B-Go line" };
      const w = firstHit(c.B, c.Go, c.wall, t.t);
      return w ? seg(t.point, w.point) : { why: "The wall must cross the B-Go line" };
    },
  },
  {
    id: "ias", label: "IAS", region: "hypopharynx", dim: "length", ages: ADULT,
    needs: ["Epi", "wall"], method: "Superior margin of the epiglottis to the closest point on the posterior wall (Sfondrini 2024).",
    compute: (c) => toWall(c.Epi, c),
  },
  {
    id: "lpw", label: "LPW", region: "hypopharynx", dim: "length", ages: ADULT,
    needs: ["Val", "wall"], method: "Base of the vallecula to the closest point on the posterior wall (Sfondrini 2024).",
    compute: (c) => toWall(c.Val, c),
  },
  {
    id: "pl", label: "PL (soft palate length)", short: "PL", region: "softPalate", dim: "length", ages: ADULT,
    needs: ["PNS", "Uvula"], method: "PNS to the uvula tip (Sfondrini 2024).",
    compute: (c) => seg(c.PNS, c.Uvula),
  },
  {
    id: "pt", label: "PT (soft palate thickness)", short: "PT", region: "softPalate", dim: "length", ages: ADULT,
    needs: ["softPalate", "MPA", "PNS"], method: "Middle of the anterior surface to the middle of the posterior surface (Sfondrini 2024).",
    compute: (c) => seg(c.MPA, pointAtFraction(palateFromPns(c), 0.5)),
  },
  {
    id: "mph", label: "MPH", region: "hyoid", dim: "length", ages: ADULT,
    needs: ["Hy", "Go", "Gn"], method: "Hyoid to the mandibular plane (Go-Gn), perpendicular (Sfondrini 2024).",
    compute: (c) => {
      const foot = footOnLine(c.Hy, c.Go, c.Gn);
      return foot ? seg(c.Hy, foot) : { why: "Go and Gn coincide" };
    },
  },
  {
    id: "area-retropalatal", label: "Retropalatal area", short: "RP area", region: "area", dim: "area", ages: [0, Infinity],
    needs: ["softPalate", "wall", "PNS"], method: "Between the soft palate and the posterior wall, from PNS to the uvula. This app's definition; no published reference.",
    compute: (c) => {
      const p = palateFromPns(c);
      const top = closestOnPolyline(p[0], c.wall), bottom = closestOnPolyline(p[p.length - 1], c.wall);
      return { px: polygonArea([...p, ...sectionBetween(c.wall, bottom.at, top.at)]), line: null };
    },
  },
  {
    id: "area-retroglossal", label: "Retroglossal area", short: "RG area", region: "area", dim: "area", ages: [0, Infinity],
    needs: ["tongue", "wall"], method: "Between the tongue base and the posterior wall, along the traced tongue. This app's definition; no published reference.",
    compute: (c) => {
      const t = c.tongue;
      const a = closestOnPolyline(t[0], c.wall), b = closestOnPolyline(t[t.length - 1], c.wall);
      return { px: polygonArea([...t, ...sectionBetween(c.wall, b.at, a.at)]), line: null };
    },
  },
];

export const measureAppliesToAge = (measure, age) =>
  age === null || age === undefined || (age >= measure.ages[0] && age < measure.ages[1]);

export const isWallNeed = (need) => need === "adenoid" || Boolean(AIRWAY_WALLS[need]);
