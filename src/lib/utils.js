// ═══════════════════════════════════════════════════════════════════════════════
// UTILS - Geometry, Measurements, Snap, Alignment, Statistics
// ═══════════════════════════════════════════════════════════════════════════════

import { SILHOUETTES } from "../data/silhouettes.js";
import { normalCdf as normalCDF } from "./distributions.js";
import {
  angle3Convention, angle4Convention, isSignedPerp, orderForVertex, resolveFacing,
  signedAngle3, convexityAngle, abPlaneAngle, signedPerpDist, signedProjection,
} from "./measureConventions.js";

// mathjs (~650 KB) is loaded on first use (C6), not with the app. Until it has
// loaded, evalFormula() returns null; components that show formula values use
// useFormulaEngine() to re-render once it is ready.
let math = null;
let mathLoading = null;
const mathListeners = new Set();

export function loadFormulaEngine() {
  if (math) return Promise.resolve(true);
  if (!mathLoading) {
    mathLoading = import("mathjs").then(({ create, all }) => {
      const m = create(all, { number: "number", precision: 14 });
      m.import({
        import: () => { throw new Error("Not allowed"); },
        createUnit: () => { throw new Error("Not allowed"); },
        evaluate: () => { throw new Error("Not allowed"); },
        simplify: () => { throw new Error("Not allowed"); }
      }, { override: true });
      math = m;
      for (const fn of mathListeners) fn();
      mathListeners.clear();
      return true;
    }).catch(e => { mathLoading = null; throw e; });
  }
  return mathLoading;
}

export const formulaEngineReady = () => math !== null;

export function onFormulaEngineReady(fn) {
  if (math) { fn(); return () => {}; }
  mathListeners.add(fn);
  return () => mathListeners.delete(fn);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const onEnter = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } };

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export const angle3pt = (p1, vtx, p2) => {
  const u = { x: p1.x - vtx.x, y: p1.y - vtx.y }, w = { x: p2.x - vtx.x, y: p2.y - vtx.y };
  const cross = u.x * w.y - u.y * w.x;
  return Math.abs(Math.atan2(cross, u.x * w.x + u.y * w.y) * 180 / Math.PI);
};

export const angle4pt = (p1, p2, p3, p4) => {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y }, d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const cross = d1.x * d2.y - d1.y * d2.x;
  return Math.abs(Math.atan2(cross, d1.x * d2.x + d1.y * d2.y) * 180 / Math.PI);
};

export const perpDist = (pt, a, b) => {
  const num = Math.abs((b.y - a.y) * pt.x - (b.x - a.x) * pt.y + b.x * a.y - b.y * a.x);
  const den = dist(a, b);
  return den < 1e-9 ? 0 : num / den;
};

export const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
};

export const polyArea = pts => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return Math.abs(a / 2);
};

export const polyLen = (pts, closed = true) => {
  let p = 0;
  for (let i = 1; i < pts.length; i++) p += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 2) p += dist(pts[pts.length - 1], pts[0]);
  return p;
};

export const vpts = m => (m.points || []).filter(p => p.x > -9000);

export function sampleSpline(pts, closed = false, samplesPer = 24) {
  if (pts.length < 2) return pts;
  const ext = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1] || ext[ext.length - 1], p3 = ext[i + 2] || ext[ext.length - 1];
    for (let j = 0; j < samplesPer; j++) {
      const t = j / samplesPer, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

export const splineArea = (pts) => polyArea(sampleSpline(pts, true));

export const splineLen = (pts, closed = false) => polyLen(sampleSpline(pts, closed), false);

export const getInfiniteLinePoints = (p1, p2, w, h) => {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return [p1, p1];
  const nx = dx / len, ny = dy / len, dist = Math.max(w, h) * 4;
  return [{ x: p1.x - nx * dist, y: p1.y - ny * dist }, { x: p1.x + nx * dist, y: p1.y + ny * dist }];
};

// `ctx.facing` ("right" | "left") orients every signed measure in the patient
// frame (see lib/measureConventions.js). Callers that hold the whole markup list
// should pass `resolveFacing(session.facing, markups)`; it defaults to "right".
export function computeMeasurements(m, cal, ctx) {
  const calDone = cal?.done === true;
  const ppm = calDone ? (cal.pxPerMm || 1) : 1;
  const facing = ctx?.facing === "left" ? "left" : "right";
  const meas = {}, vp = vpts(m);
  // First point's position, in the same unit as every other value (mm when calibrated).
  if (vp.length > 0) { meas.x = vp[0].x / ppm; meas.y = vp[0].y / ppm; }
  if ((m.type === "line" || m.type === "parallel") && vp.length >= 2 && m.mode !== "infinite") {
    meas.length = dist(vp[0], vp[1]) / ppm;
  }
  if (m.type === "angle3" && vp.length >= 3) {
    const conv = angle3Convention(m);
    const [p0, p1, p2] = orderForVertex(m, vp.slice(0, 3));
    if (conv === "signed") meas.angle = signedAngle3(p0, p1, p2, facing);
    else if (conv === "convexity") meas.angle = convexityAngle(p0, p1, p2, facing);
    else if (conv === "supplement") meas.angle = 180 - angle3pt(p0, p1, p2);
    else meas.angle = angle3pt(p0, p1, p2);
  }
  if (m.type === "angle4" && vp.length >= 4) {
    meas.angle = angle4Convention(m) === "abPlane"
      ? abPlaneAngle(vp[0], vp[1], vp[2], vp[3], facing)
      : angle4pt(vp[0], vp[1], vp[2], vp[3]);
  }
  if (m.type === "polygon" && vp.length >= 3) {
    const useSpline = m.curveStyle === "bspline" && vp.length >= 3;
    meas.area = (useSpline ? splineArea(vp) : polyArea(vp)) / ppm ** 2;
    meas.perimeter = (useSpline ? splineLen(vp, true) : polyLen(vp, true)) / ppm;
  }
  if ((m.type === "curve" || m.type === "polyline") && vp.length >= 2) {
    const useSpline = m.curveStyle === "bspline" && vp.length >= 3;
    meas.length = (useSpline ? splineLen(vp, false) : polyLen(vp, false)) / ppm;
  }
  if (m.type === "perp" && vp.length >= 3) {
    meas.distance = (isSignedPerp(m) ? signedPerpDist(vp[2], vp[0], vp[1], facing) : perpDist(vp[2], vp[0], vp[1])) / ppm;
  }
  if (m.type === "ratio" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "sum" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "difference" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "percentage" && m.computedValue !== undefined) { meas.value = m.computedValue; }
  if (m.type === "projDist" && vp.length >= 4) { meas.projectedDistance = signedProjection(vp[0], vp[1], vp[2], vp[3], facing) / ppm; }
  if (m.type === "silhouette") {
    const paths = (m.paths || SILHOUETTES?.[m.silhouetteType]?.paths);
    if (paths && paths.length > 0) {
      const rot = m.rotation || 0;
      const sc = m.scale || 1;
      const pos = m.position || { x: 0, y: 0 };
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      let totalPerimeter = 0;
      let totalArea = 0;
      for (const path of paths) {
        if (path.points.length < 2) continue;
        const transformed = path.points.map(p => {
          const sx = p.x * sc * 100;
          const sy = p.y * sc * 100;
          return {
            x: sx * cosR - sy * sinR + pos.x,
            y: sx * sinR + sy * cosR + pos.y,
          };
        });
        let perim = 0;
        for (let i = 1; i < transformed.length; i++) perim += dist(transformed[i - 1], transformed[i]);
        if (path.closed && transformed.length > 2) perim += dist(transformed[transformed.length - 1], transformed[0]);
        totalPerimeter += perim;
        if (path.closed && transformed.length >= 3) totalArea += polyArea(transformed);
      }
      if (totalPerimeter > 0) meas.perimeter = totalPerimeter / ppm;
      if (totalArea > 0) meas.area = totalArea / (ppm * ppm);
    }
  }
  if (m.type === "ellipse" && vp.length >= 3) {
    const ell = ellipseFromAxes(vp);
    if (ell) {
      meas.majorAxis = Math.max(ell.rx, ell.ry) * 2 / ppm;
      meas.minorAxis = Math.min(ell.rx, ell.ry) * 2 / ppm;
      meas.area = Math.PI * ell.rx * ell.ry / (ppm * ppm);
      meas.perimeter = ellipsePerimeter(ell.rx, ell.ry) / ppm;
    }
  }
  if (m.type === "arc" && vp.length >= 3) {
    meas.arcLength = arcLength3pts(vp[0], vp[1], vp[2]) / ppm;
    const c = circleFrom3pts(vp[0], vp[1], vp[2]);
    if (c) { meas.radius = c.r / ppm; meas.arcAngle = arcAngle3pts(vp[0], vp[1], vp[2]); }
  }
  if (m.type === "circle" && vp.length >= 2) {
    const r = dist(vp[0], vp[1]);
    meas.radius = r / ppm;
    meas.circumference = 2 * Math.PI * r / ppm;
    meas.area = Math.PI * r * r / (ppm * ppm);
  }
  if (m.type === "bezier" && vp.length >= 2) { const cp = (m.cp && m.cp.length === 2 * (vp.length - 1)) ? m.cp : autoControlPoints(vp); meas.length = multiBezierLength(vp, cp) / ppm; }
  if (m.type === "tangent" && vp.length >= 2) { meas.length = dist(vp[0], vp[1]) / ppm; }
  if (m.type === "concentric" && vp.length >= 3) {
    meas.arcLength = arcLength3pts(vp[0], vp[1], vp[2]) / ppm;
    const c = circleFrom3pts(vp[0], vp[1], vp[2]);
    if (c) meas.radius = c.r / ppm;
  }
  meas._unit = calDone ? "mm" : "px";
  return meas;
}

// The clinically meaningful value of each markup type. `x`/`y` (the first
// point's raw pixel position) are never a measurement; points have none.
export const PRIMARY_MEASURE_KEY = {
  line: "length", parallel: "length", ruler: "length", arrow: "length", tangent: "length",
  angle3: "angle", angle4: "angle",
  polygon: "area", ellipse: "area", circle: "area",
  arc: "arcLength", concentric: "arcLength",
  curve: "length", polyline: "length", bezier: "length",
  perp: "distance", projDist: "projectedDistance",
  ratio: "value", sum: "value", difference: "value", percentage: "value",
};

const AREA_KEYS = new Set(["area"]);

// { key, value, unit } for the markup's primary measurement, or null when the
// markup has none (points, unfinished shapes, infinite lines). Every research
// collector, export and computed measurement must read values through this.
export function primaryMeasure(m, cal, ctx) {
  const key = PRIMARY_MEASURE_KEY[m?.type];
  if (!key) return null;
  const meas = computeMeasurements(m, cal, ctx);
  const value = meas[key];
  if (typeof value !== "number" || !isFinite(value)) return null;
  let unit;
  if (key === "angle") unit = "°";
  else if (m.type === "ratio") unit = "";
  else if (m.type === "percentage") unit = "%";
  // Sums/differences inherit the unit of what they combine (° for Björk's sum).
  else if ((m.type === "sum" || m.type === "difference") && m.valueUnit === "°") unit = "°";
  else if (AREA_KEYS.has(key)) unit = meas._unit === "mm" ? "mm²" : "px²";
  else unit = meas._unit === "mm" ? "mm" : "px";
  return { key, value, unit };
}

export const catmullRom = (ctx, pts, closed = false) => {
  if (pts.length < 2) return;
  const ext = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1] || ext[ext.length - 1], p3 = ext[i + 2] || ext[ext.length - 1];
    for (let j = 1; j <= 24; j++) {
      const t = j / 24, t2 = t * t, t3 = t2 * t;
      ctx.lineTo(0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3));
    }
  }
  if (closed) ctx.closePath();
};

export const sampleCatmullRom = (pts, closed = false) => {
  if (pts.length < 2) return pts.slice();
  const ext = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1], pts[pts.length - 1]];
  const out = [pts[0]];
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1] || ext[ext.length - 1], p3 = ext[i + 2] || ext[ext.length - 1];
    for (let j = 1; j <= 12; j++) {
      const t = j / 12, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
};

export const projectedDistance = (ptA, ptB, lineP1, lineP2) => {
  const dx = lineP2.x - lineP1.x, dy = lineP2.y - lineP1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  const tA = ((ptA.x - lineP1.x) * dx + (ptA.y - lineP1.y) * dy) / len2;
  const tB = ((ptB.x - lineP1.x) * dx + (ptB.y - lineP1.y) * dy) / len2;
  return (tA - tB) * Math.sqrt(len2);
};

export const perpPoint = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
};

// Projection of p onto line (a,b); returns null when the foot lies outside the segment (a,b).
export const perpPointSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0 || t > 1) return null;
  return { x: a.x + t * dx, y: a.y + t * dy };
};

export function sampleCurvePoints(pts, n) {
  if (!pts || pts.length < 2) return pts || [];
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const totalLen = lens[lens.length - 1];
  if (totalLen < 1e-9) return [pts[0]];
  const samples = [];
  for (let i = 0; i <= n; i++) {
    const target = (i / n) * totalLen;
    let seg = 0;
    for (let j = 1; j < lens.length; j++) {
      if (lens[j] >= target) { seg = j - 1; break; }
      if (j === lens.length - 1) seg = j - 1;
    }
    const segLen = lens[seg + 1] - lens[seg];
    const t = segLen < 1e-9 ? 0 : (target - lens[seg]) / segLen;
    samples.push({ x: pts[seg].x + t * (pts[seg + 1].x - pts[seg].x), y: pts[seg].y + t * (pts[seg + 1].y - pts[seg].y) });
  }
  return samples;
}

const snapPointCore = (ip, markups, r, enabled) => {
  if (!enabled || (!enabled.points && !enabled.lines)) return { point: ip, kind: null };
  let best = ip, bestD = r, bestKind = null;

  for (const m of markups) {
    if (m.visible === false) continue;
    const vp = vpts(m);

    if (enabled.points) {
      for (const p of vp) {
        const d = dist(p, ip);
        if (d < bestD) { bestD = d; best = p; bestKind = "point"; }
      }
    }

    if (enabled.lines && (m.type === "line" || m.type === "parallel") && vp.length >= 2) {
      const pr = m.mode === "infinite" ? perpPoint(ip, vp[0], vp[1]) : perpPointSeg(ip, vp[0], vp[1]);
      if (pr) {
        const d = dist(pr, ip);
        if (d < bestD) { bestD = d; best = pr; bestKind = "line"; }
      }
    }
  }
  return { point: best === ip ? ip : { ...best }, kind: bestKind };
};

export const snapPoint = (ip, markups, r, enabled) => snapPointCore(ip, markups, r, enabled).point;

// Same as snapPoint but also reports the snap kind ("point" | "line" | null).
export const snapPointResult = (ip, markups, r, enabled) => snapPointCore(ip, markups, r, enabled);

export const alignOnePoint = (src, dst) => ({ tx: dst.x - src.x, ty: dst.y - src.y, rot: 0, scale: 1 });

export const alignTwoPoints = (s1, s2, d1, d2) => {
  const srcA = Math.atan2(s2.y - s1.y, s2.x - s1.x), dstA = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  const rot = dstA - srcA, srcLen = dist(s1, s2), dstLen = dist(d1, d2), scale = srcLen > 1e-9 ? dstLen / srcLen : 1;
  const cos = Math.cos(rot) * scale, sin = Math.sin(rot) * scale;
  return { tx: d1.x - (cos * s1.x - sin * s1.y), ty: d1.y - (sin * s1.x + cos * s1.y), rot, scale };
};

export function buildScope(markups, calibration, facingSetting) {
  const scope = {};
  const ctx = { facing: resolveFacing(facingSetting, markups) };
  markups.forEach(m => {
    const meas = computeMeasurements(m, calibration, ctx);
    const lbl = (m.label || m.type).replace(/[^a-zA-Z0-9]/g, "_");
    Object.entries(meas).forEach(([k, v]) => {
      if (k.startsWith("_")) return;
      scope[lbl] = v;
      scope[`${lbl}_${k}`] = v;
    });
    // The bare label means the markup's primary measurement, never a coordinate.
    const pk = PRIMARY_MEASURE_KEY[m.type];
    if (pk && typeof meas[pk] === "number" && isFinite(meas[pk])) scope[lbl] = meas[pk];
  });
  return scope;
}

export function measUnit(meas) {
  if (meas._unit === "mm") return "mm";
  if (meas._unit === "px") return "px";
  return "";
}

export function measUnitSq(meas) {
  const u = measUnit(meas);
  return u ? u + "²" : "";
}

const _builtins = new Set(["sin","cos","tan","asin","acos","atan","atan2","abs","sqrt","exp","log","log2","log10","ceil","floor","round","min","max","pow","pi","e","i","true","false","Infinity","NaN"]);

// ─── Formula sandbox (P7) ───────────────────────────────────────────────────
// User-authored expressions are evaluated with mathjs. The previous gate was a
// regex token allowlist (`\b[a-zA-Z_]\w*\b`) plus an empty-scope evaluate —
// robust for flat expressions but bypass-prone via property access / assignment
// / function-definition nodes that the regex doesn't model. We now PARSE the
// expression to an AST and reject every node that isn't on an explicit allowlist
// (constants, operators, allowed functions/symbols). This blocks `import`,
// `evaluate`, `map`, property access (`x.constructor`), assignment, function
// definition, and block statements — the mathjs surfaces that could reach
// non-math globals. Numeric scope values are substituted inline first, so no
// user symbol ever reaches mathjs's global resolver.
const _ALLOWED_FUNCS = new Set([
  "sin","cos","tan","asin","acos","atan","atan2","abs","sqrt","cbrt","exp",
  "log","log2","log10","ceil","floor","round","min","max","pow","sign","hypot",
]);
const _ALLOWED_CONSTS = new Set(["pi","PI","e","E","i","tau","true","false","Infinity","NaN"]);
const _ALLOWED_NODE_TYPES = new Set([
  "ConstantNode","OperatorNode","UnaryNode","ParenthesisNode","ConditionalNode",
  "SymbolNode","FunctionNode",
]);

function _validateFormulaAst(node) {
  if (!_ALLOWED_NODE_TYPES.has(node.type)) return false;
  if (node.type === "SymbolNode") return _ALLOWED_CONSTS.has(node.name);
  if (node.type === "FunctionNode") {
    // The function name lives on `.fn` (a SymbolNode) — authorize it by name
    // against the function allowlist, then recurse into the ARGUMENTS only.
    // (Descending into `.fn` would re-test the name as a const and reject it.)
    const name = (node.fn && node.fn.name) || node.name;
    if (!_ALLOWED_FUNCS.has(name)) return false;
    for (const a of (node.args || [])) if (!_validateFormulaAst(a)) return false;
    return true;
  }
  // Other allowed node types (OperatorNode, UnaryNode, ParenthesisNode,
  // ConditionalNode) — recurse over their children via mathjs's `.forEach`,
  // which is stable across node property-name differences.
  let ok = true;
  node.forEach((child) => { if (ok && !_validateFormulaAst(child)) ok = false; });
  return ok;
}

export function evalFormula(expr, scope) {
  try {
    // Inline-substitute numeric scope values so the residual expression contains
    // only numbers + allowed math symbols/functions (no user symbols reach the
    // mathjs global resolver).
    let s = expr; const keys = Object.keys(scope).sort((a,b)=>b.length-a.length);
    const used = new Set();
    for (const k of keys) {
      const v = scope[k];
      if (typeof v === "number" && isFinite(v)) {
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "g");
        if (re.test(s)) { re.lastIndex = 0; s = s.replace(re, `(${v})`); used.add(k); }
      }
    }
    // Reject any user variable that wasn't substituted (missing data) BEFORE the
    // AST gate so the error is "missing var", not "disallowed symbol".
    const tokens = (expr.match(/\b[a-zA-Z_]\w*\b/g)||[]).filter(w=>!/^\d+$/.test(w)&&!_builtins.has(w));
    const missing = tokens.filter(w=>!used.has(w));
    if (missing.length > 0) return null;
    // AST sandbox: parse and reject any non-allowlisted node/type/function.
    if (!math) { loadFormulaEngine().catch(() => {}); return null; }
    const ast = math.parse(s);
    if (!_validateFormulaAst(ast)) return null;
    const r = ast.compile().evaluate({});
    return typeof r === "number" && isFinite(r) ? r : null;
  } catch { return null; }
}

export function getMissingVars(expr, scope) {
  if (!expr) return [];
  const keys = Object.keys(scope).sort((a,b)=>b.length-a.length);
  const used = new Set();
  let s = expr;
  for (const k of keys) {
    const v = scope[k];
    if (typeof v === "number" && isFinite(v)) {
      const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "g");
      if (re.test(s)) { re.lastIndex = 0; s = s.replace(re, ""); used.add(k); }
    }
  }
  const tokens = (expr.match(/\b[a-zA-Z_]\w*\b/g)||[]).filter(w=>!/^\d+$/.test(w)&&!_builtins.has(w));
  return [...new Set(tokens.filter(w=>!used.has(w)))];
}

export function normDeviation(value, norm) {
  const delta = value - norm.mean, sdUnits = norm.sd > 0 ? delta / norm.sd : 0;
  return { delta, sdUnits, within1SD: Math.abs(sdUnits) <= 1, within2SD: Math.abs(sdUnits) <= 2 };
}

export const deviationColor = (sdUnits, t) => {
  const a = Math.abs(sdUnits);
  if (a <= 1) return t.ok;
  if (a <= 2) return t.warn;
  return t.err;
};

export const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

export const variance = (arr, m) => arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);

export const stdev = (arr, m) => Math.sqrt(variance(arr, m));

export const gammaLn = x => {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaLn(1 - x);
  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
};

export const betaIncomplete = (a, b, x) => {
  if (x < 0 || x > 1) return 0;
  if (x === 0 || x === 1) return x;
  const bt = Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betaCF(a, b, x) / a;
  return 1 - bt * betaCF(b, a, 1 - x) / b;
};

// Lentz continued fraction for the incomplete beta function (Numerical Recipes 3rd ed.).
// Previous version had two defects: the initializer omitted the `d = 1/d` step and set
// `h` directly, and the per-iteration `del` used `d * h` instead of `d * c`. Both collapsed
// betaIncomplete to 0/1 extremes, which silently broke EVERY t-test and F-test p-value.
export const betaCF = (a, b, x) => {
  const maxIter = 100, eps = 3e-14, fpm = 1e-30;
  let m, m2, aa, c, d, del, h;
  const qab = a + b, qap = a + 1, qam = a - 1;
  c = 1;
  d = 1 - qab * x / qap;
  if (Math.abs(d) < fpm) d = fpm;
  d = 1 / d;
  h = d;
  for (m = 1; m <= maxIter; m++) {
    m2 = 2 * m;
    aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpm) d = fpm;
    c = 1 + aa / c;
    if (Math.abs(c) < fpm) c = fpm;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpm) d = fpm;
    c = 1 + aa / c;
    if (Math.abs(c) < fpm) c = fpm;
    d = 1 / d;
    del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
};

export const tDistributeCDF = (t, df) => {
  const x = df / (df + t * t);
  return 1 - 0.5 * betaIncomplete(df / 2, 0.5, x);
};

export function tTestPaired(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const n = arr1.length;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const m = mean(diffs);
  const s = stdev(diffs, m);
  if (s === 0) return null;
  const tStat = m / (s / Math.sqrt(n));
  const df = n - 1;
  const pValue = 2 * (1 - tDistributeCDF(Math.abs(tStat), df));
  return { t: tStat, df, pValue, significant: pValue < 0.05 };
}

export function calculateICC(values) {
  const k = values.length;
  if (k < 2) return null;
  const n = values[0].length;
  if (n < 2) return null;
  const grandMean = mean(values.flat());
  const rowMeans = values.map(row => mean(row));
  const colMeans = Array(n).fill(0).map((_, j) => mean(values.map(row => row[j])));
  const SSB = n * rowMeans.reduce((sum, rm) => sum + (rm - grandMean) ** 2, 0);
  const SSC = k * colMeans.reduce((sum, cm) => sum + (cm - grandMean) ** 2, 0);
  const SST = values.flat().reduce((s, x) => s + (x - grandMean) ** 2, 0);
  const SSW = SST - SSB - SSC;
  const MSB = SSB / (k - 1);
  const MSC = SSC / (n - 1);
  const MSW = SSW / ((k - 1) * (n - 1));
  if (MSW === 0) return null;
  const rA = (MSB - MSW) / (MSB + (n - 1) * MSW);
  const rC = (MSC - MSW) / (MSC + (k - 1) * MSW);
  const rK = (MSB - MSW) / MSB;
  const rM = (MSC - MSW) / MSC;
  return { ICC_Absolute: rA, ICC_Consistency: rC, ICC_Average: rK, ICC_Consistency_Avg: rM, interpretation: getICCInterpretation(rA || rC) };
}

export const getICCInterpretation = icc => {
  if (icc < 0) return "Poor";
  if (icc < 0.5) return "Poor";
  if (icc < 0.75) return "Moderate";
  if (icc < 0.9) return "Good";
  return "Excellent";
};

// Fisher-z CI for single-rater ICC(1,1) or ICC(2,1). This is an alternative to the
// F-based CI used by iccShroutFleiss in reliability.js. Does NOT support average-measure
// ICC(k,k) forms. Use iccShroutFleiss for full-featured ICC CIs.
// @deprecated Prefer the F-based CI in reliability.js which handles all ICC types.
export function calculateICC_CI(icc, n, k, confidence = 0.95) {
  if (icc == null || n < 2 || k < 2) return null;
  const r = Math.max(-0.999, Math.min(0.999, icc));
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(k * (n - 1) - 1);
  const zCrit = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;
  const lo = z - zCrit * se;
  const hi = z + zCrit * se;
  const lower = (Math.exp(2 * lo) - 1) / (Math.exp(2 * lo) + 1);
  const upper = (Math.exp(2 * hi) - 1) / (Math.exp(2 * hi) + 1);
  return { lower, upper, confidence };
}

export function dahlbergError(arr1, arr2) {
  if (arr1.length !== arr2.length) return null;
  const n = arr1.length;
  if (n < 2) return null;
  const sumSq = arr1.reduce((s, v, i) => s + (v - arr2[i]) ** 2, 0);
  return { error: Math.sqrt(sumSq / (2 * n)), n };
}

export function blandAltman(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const diffs = arr1.map((v, i) => v - arr2[i]);
  const means = arr1.map((v, i) => (v + arr2[i]) / 2);
  const m = mean(diffs);
  const s = stdev(diffs, m);
  const loa = m - 1.96 * s;
  const loa2 = m + 1.96 * s;
  return { meanDiff: m, stdDiff: s, lowerLOA: loa, upperLOA: loa2, means, minMean: Math.min(...means), maxMean: Math.max(...means) };
}

export const median = arr => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const iqr = arr => {
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
};

export const skewness = arr => {
  const n = arr.length, m = mean(arr), s = stdev(arr, m);
  if (s === 0) return 0;
  return (n / ((n - 1) * (n - 2))) * arr.reduce((sum, x) => sum + ((x - m) / s) ** 3, 0);
};

export const kurtosis = arr => {
  const n = arr.length, m = mean(arr), s = stdev(arr, m);
  if (s === 0) return 0;
  const m4 = arr.reduce((sum, x) => sum + (x - m) ** 4, 0) / n;
  return (m4 / s ** 4) - 3;
};

export const coefficientOfVariation = arr => {
  const m = mean(arr);
  if (m === 0) return null;
  return (stdev(arr, m) / Math.abs(m)) * 100;
};

export const standardError = (arr, icc) => {
  const s = stdev(arr, mean(arr));
  if (icc == null || icc < 0 || icc > 1) return s / Math.sqrt(arr.length);
  return s * Math.sqrt(1 - icc);
};

export const minimalDetectableChange = (sem, confidence = 1.96) => confidence * sem * Math.sqrt(2);

// Shapiro-Wilk W and p-value — Royston (1995) algorithm AS R94, the method
// used by R's shapiro.test (coefficients, small-sample n ≤ 11 and large-sample
// normalising transformations). The previous version used Shapiro-Francia
// weights with a single large-n p-value formula, which grossly overstated p for
// small samples (Shapiro & Wilk's own skewed example scored p ≈ 0.998).
const SW_C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
const SW_C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
const SW_C3 = [0.544, -0.39978, 0.025054, -6.714e-4];
const SW_C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
const SW_C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
const SW_C6 = [-0.4803, -0.082676, 0.0030302];
const poly = (c, x) => c.reduceRight((acc, ci) => acc * x + ci, 0);

function shapiroCoefficients(n) {
  const n2 = Math.floor(n / 2);
  if (n === 3) return [Math.SQRT1_2];
  const an25 = n + 0.25;
  const m = Array.from({ length: n2 }, (_, i) => normalQuantile((i + 1 - 0.375) / an25)); // negative (lower half)
  const summ2 = 2 * m.reduce((sum, v) => sum + v * v, 0);
  const ssumm2 = Math.sqrt(summ2);
  const rsn = 1 / Math.sqrt(n);
  const a1 = poly(SW_C1, rsn) - m[0] / ssumm2;
  const a = Array(n2);
  a[0] = a1;
  let i1, fac;
  if (n > 5) {
    i1 = 2;
    const a2 = -m[1] / ssumm2 + poly(SW_C2, rsn);
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
    a[1] = a2;
  } else {
    i1 = 1;
    fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
  }
  for (let i = i1; i < n2; i++) a[i] = -m[i] / fac;
  return a;
}

export function shapiroWilk(arr) {
  const n = arr.length;
  if (n < 3 || n > 5000) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = mean(sorted);
  const ss = sorted.reduce((s, x) => s + (x - m) ** 2, 0);
  if (ss === 0) return { W: 1, pValue: 1, normal: true };
  const coeffs = shapiroCoefficients(n);
  let b = 0;
  for (let i = 0; i < coeffs.length; i++) b += coeffs[i] * (sorted[n - 1 - i] - sorted[i]);
  const W = Math.min(1, (b ** 2) / ss);
  const pValue = shapiroPValue(W, n);
  return { W, pValue, normal: pValue > 0.05 };
}

function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  // Tails (Acklam): the rational form evaluated at q = min(p, 1 − p) is the
  // LOWER-tail quantile (negative); mirror it for the upper tail.
  const q = p < pLow ? p : 1 - p;
  if (q < pLow) {
    const r = Math.sqrt(-2 * Math.log(q));
    const x = (((((c[0]*r+c[1])*r+c[2])*r+c[3])*r+c[4])*r+c[5]) / ((((d[0]*r+d[1])*r+d[2])*r+d[3])*r+1);
    return p < 0.5 ? x : -x;
  }
  const r = p - 0.5;
  const r2 = r * r;
  return (((((a[0]*r2+a[1])*r2+a[2])*r2+a[3])*r2+a[4])*r2+a[5])*r / (((((b[0]*r2+b[1])*r2+b[2])*r2+b[3])*r2+b[4])*r2+1);
}

function shapiroPValue(W, n) {
  if (W >= 1) return 1;
  if (n === 3) {
    const p = (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.PI / 3);
    return Math.max(0, Math.min(1, p));
  }
  const w1 = Math.log(1 - W);
  let y, mu, sigma;
  if (n <= 11) {
    const gamma = poly([-2.273, 0.459], n);
    if (w1 >= gamma) return 1e-99;
    y = -Math.log(gamma - w1);
    mu = poly(SW_C3, n);
    sigma = Math.exp(poly(SW_C4, n));
  } else {
    const xx = Math.log(n);
    y = w1;
    mu = poly(SW_C5, xx);
    sigma = Math.exp(poly(SW_C6, xx));
  }
  return 1 - normalCDF((y - mu) / sigma);
}

export function oneWayAnova(...groups) {
  if (groups.length < 2) return null;
  const all = groups.flat();
  const N = all.length, k = groups.length;
  const grandMean = mean(all);
  const ssBetween = groups.reduce((ss, g) => ss + g.length * (mean(g) - grandMean) ** 2, 0);
  const ssWithin = groups.reduce((ss, g) => {
    const m = mean(g);
    return ss + g.reduce((s, x) => s + (x - m) ** 2, 0);
  }, 0);
  const dfBetween = k - 1, dfWithin = N - k;
  if (dfWithin <= 0 || ssWithin === 0) return null;
  const msBetween = ssBetween / dfBetween, msWithin = ssWithin / dfWithin;
  const F = msBetween / msWithin;
  const pValue = 1 - fCDF(F, dfBetween, dfWithin);
  return { F, dfBetween, dfWithin, msBetween, msWithin, ssBetween, ssWithin, pValue, significant: pValue < 0.05 };
}

// F-distribution CDF: P(F ≤ f) = I_{d1·f/(d1·f+d2)}(d1/2, d2/2).
// Previous version used x = d2/(d2+d1·f) with swapped beta params, which computed
// I_{d1·f/(...)}(d2/2, d1/2) — a different distribution — so every F-based p-value
// (ANOVA, Levene, RM-ANOVA, MANOVA, …) was wrong even after betaCF was fixed.
export function fCDF(f, d1, d2) {
  if (f <= 0 || d1 <= 0 || d2 <= 0) return 0;
  const x = (d1 * f) / (d1 * f + d2);
  return betaIncomplete(d1 / 2, d2 / 2, x);
}

// Chi-square CDF = regularized lower incomplete gamma P(df/2, x/2).
// Lower branch (y < a+1): convergent series (NR gser). Upper branch (y >= a+1): Lentz
// continued fraction for Q(a,y)=1-P(a,y) (NR gcf). The previous implementation used an
// asymptotic series for the upper branch that diverges for moderate y (terms oscillate
// and grow, never reaching the 1e-14 break), producing NaN/0 — so normality, sphericity
// and Hosmer-Lemeshow violations went undetected exactly when they matter.
function _gserLowerGamma(a, x) {
  const eps = 1e-14, maxIter = 300;
  const logBase = -x + a * Math.log(x) - gammaLn(a);
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 1; n <= maxIter; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * eps) break;
  }
  return sum * Math.exp(logBase);
}
function _gcfUpperGamma(a, x) {
  const eps = 3e-14, fpm = 1e-30, maxIter = 300;
  const logBase = -x + a * Math.log(x) - gammaLn(a);
  let b = x + 1 - a;
  let c = 1 / fpm;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= maxIter; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpm) d = fpm;
    c = b + an / c;
    if (Math.abs(c) < fpm) c = fpm;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return Math.exp(logBase) * h;
}
export function chi2CDF(x, df) {
  if (x <= 0 || df <= 0) return 0;
  const a = df / 2, y = x / 2;
  if (y < a + 1) return _gserLowerGamma(a, y);
  const q = _gcfUpperGamma(a, y);
  const p = 1 - q;
  return p > 1 ? 1 : p < 0 ? 0 : p;
}

export function spearmanCorrelation(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const rank1 = rankArray(arr1), rank2 = rankArray(arr2);
  return pearsonCorrelation(rank1, rank2);
}

function rankArray(arr) {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function pearsonCorrelation(arr1, arr2) {
  if (arr1.length !== arr2.length || arr1.length < 2) return null;
  const n = arr1.length, m1 = mean(arr1), m2 = mean(arr2);
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < n; i++) {
    const a = arr1[i] - m1, b = arr2[i] - m2;
    num += a * b; d1 += a * a; d2 += b * b;
  }
  const den = Math.sqrt(d1 * d2);
  return den === 0 ? null : num / den;
}

export function correlationMatrix(datasets) {
  const n = datasets.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = pearsonCorrelation(datasets[i], datasets[j]);
      matrix[i][j] = r; matrix[j][i] = r;
    }
  }
  return matrix;
}

export function aggregateDahlberg(pairedArrays) {
  if (pairedArrays.length < 1) return null;
  const errors = pairedArrays.map(({ vals1, vals2 }) => {
    if (!vals1 || !vals2 || vals1.length < 2) return null;
    const d = dahlbergError(vals1, vals2);
    return d ? d.error : null;
  }).filter(e => e !== null);
  if (!errors.length) return null;
  return { mean: mean(errors), max: Math.max(...errors), min: Math.min(...errors), count: errors.length };
}

export function computePerLandmarkError(study, metric, labels) {
  if (!study || !labels?.length) return [];
  const results = [];
  if (study.type === "intra" && study.operators[0]?.trials?.length >= 2) {
    const trials = study.operators[0].trials;
    for (let i = 0; i < trials.length - 1; i++) {
      for (let j = i + 1; j < trials.length; j++) {
        labels.forEach(lab => {
          const m1 = (trials[i].measurements || []).find(x => x.label === lab);
          const m2 = (trials[j].measurements || []).find(x => x.label === lab);
          if (m1 && m2) {
            const v1 = metric === "x" ? m1.x : m1.y;
            const v2 = metric === "x" ? m2.x : m2.y;
            results.push({ lab, pair: `T${i + 1} vs T${j + 1}`, diff: v1 - v2, absDiff: Math.abs(v1 - v2) });
          }
        });
      }
    }
  } else if (study.type === "inter" && study.operators.length >= 2) {
    for (let i = 0; i < study.operators.length - 1; i++) {
      for (let j = i + 1; j < study.operators.length; j++) {
        labels.forEach(lab => {
          const m1 = (study.operators[i].trials?.[0]?.measurements || []).find(x => x.label === lab);
          const m2 = (study.operators[j].trials?.[0]?.measurements || []).find(x => x.label === lab);
          if (m1 && m2) {
            const v1 = metric === "x" ? m1.x : m1.y;
            const v2 = metric === "x" ? m2.x : m2.y;
            results.push({ lab, pair: `${study.operators[i].name || `Op${i+1}`} vs ${study.operators[j].name || `Op${j+1}`}`, diff: v1 - v2, absDiff: Math.abs(v1 - v2) });
          }
        });
      }
    }
  }
  const byLabel = {};
  results.forEach(r => {
    if (!byLabel[r.lab]) byLabel[r.lab] = { diffs: [] };
    byLabel[r.lab].diffs.push(r.diff);
  });
  return Object.entries(byLabel).map(([lab, data]) => {
    const diffs = data.diffs;
    const sumSq = diffs.reduce((s, d) => s + d ** 2, 0);
    const dahlberg = Math.sqrt(sumSq / (2 * diffs.length));
    const m = mean(diffs);
    const s = stdev(diffs, m);
    const cv = coefficientOfVariation(diffs.map(Math.abs));
    return { lab, n: diffs.length, meanDiff: m, sdDiff: s, dahlberg, cv, absMean: mean(diffs.map(Math.abs)) };
  });
}

export function detectSystematicBias(study, metric, labels) {
  if (!study || !labels?.length) return [];
  const biases = [];
  if (study.type === "intra" && study.operators[0]?.trials?.length >= 2) {
    const trials = study.operators[0].trials;
    for (let i = 0; i < trials.length - 1; i++) {
      for (let j = i + 1; j < trials.length; j++) {
        const vals1 = [], vals2 = [];
        labels.forEach(lab => {
          const m1 = (trials[i].measurements || []).find(x => x.label === lab);
          const m2 = (trials[j].measurements || []).find(x => x.label === lab);
          if (m1 && m2) { vals1.push(metric === "x" ? m1.x : m1.y); vals2.push(metric === "x" ? m2.x : m2.y); }
        });
        if (vals1.length >= 2) {
          const t = tTestPaired(vals1, vals2);
          if (t) biases.push({ pair: `Trial ${i + 1} vs ${j + 1}`, t: t.t, pValue: t.pValue, significant: t.significant, n: vals1.length });
        }
      }
    }
  } else if (study.type === "inter" && study.operators.length >= 2) {
    for (let i = 0; i < study.operators.length - 1; i++) {
      for (let j = i + 1; j < study.operators.length; j++) {
        const vals1 = [], vals2 = [];
        labels.forEach(lab => {
          const m1 = (study.operators[i].trials?.[0]?.measurements || []).find(x => x.label === lab);
          const m2 = (study.operators[j].trials?.[0]?.measurements || []).find(x => x.label === lab);
          if (m1 && m2) { vals1.push(metric === "x" ? m1.x : m1.y); vals2.push(metric === "x" ? m2.x : m2.y); }
        });
        if (vals1.length >= 2) {
          const t = tTestPaired(vals1, vals2);
          if (t) biases.push({ pair: `${study.operators[i].name || `Op${i+1}`} vs ${study.operators[j].name || `Op${j+1}`}`, t: t.t, pValue: t.pValue, significant: t.significant, n: vals1.length });
        }
      }
    }
  }
  return biases;
}

export function anovaAcrossSessions(study, metric, labels) {
  if (!study || !labels?.length) return null;
  const groups = [];
  if (study.type === "intra") {
    const trials = study.operators[0]?.trials || [];
    if (trials.length < 3) return null;
    trials.forEach(tr => {
      const vals = (tr.measurements || []).filter(m => labels.includes(m.label)).map(m => metric === "x" ? m.x : m.y);
      if (vals.length >= 2) groups.push(vals);
    });
  } else {
    if (study.operators.length < 3) return null;
    study.operators.forEach(op => {
      const vals = (op.trials?.[0]?.measurements || []).filter(m => labels.includes(m.label)).map(m => metric === "x" ? m.x : m.y);
      if (vals.length >= 2) groups.push(vals);
    });
  }
  if (groups.length < 3) return null;
  return oneWayAnova(...groups);
}

export function computeNormsComparison(descriptiveStats, norms, calibration) {
  if (!norms?.length || !descriptiveStats?.length) return [];
  const ppm = calibration?.pxPerMm || 1;
  return descriptiveStats.filter(ds => ds.mean !== null).map(ds => {
    const norm = norms.find(n => n.label === ds.lab);
    if (!norm) return { ...ds, normZ: null, normMean: null, normSD: null, withinNorm: null, deviation: null };
    const normMeanMm = norm.mean_mm || norm.mean;
    const normSDMm = norm.sd_mm || norm.sd;
    const statMm = ds.mean / ppm;
    const statSDMm = (ds.sd || 0) / ppm;
    const z = normSDMm > 0 ? (statMm - normMeanMm) / normSDMm : null;
    return { ...ds, statMm, statSDMm, normMean: normMeanMm, normSD: normSDMm, normZ: z, withinNorm: z !== null && Math.abs(z) <= 2, deviation: z !== null ? statMm - normMeanMm : null };
  });
}

export function detectOutliers(arr, method = "iqr") {
  if (arr.length < 4) return { outliers: [], values: arr };
  const indexed = arr.map((v, i) => ({ v, i }));
  if (method === "zscore") {
    const m = mean(arr), s = stdev(arr, m);
    if (s === 0) return { outliers: [], values: arr };
    const outliers = indexed.filter(x => Math.abs(x.v - m) / s > 2).map(x => ({ ...x, zScore: (x.v - m) / s }));
    return { outliers, values: arr, mean: m, sd: s };
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25), q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx], q3 = sorted[q3Idx], iqrVal = q3 - q1;
  const lo = q1 - 1.5 * iqrVal, hi = q3 + 1.5 * iqrVal;
  const outliers = indexed.filter(x => x.v < lo || x.v > hi).map(x => ({ ...x }));
  return { outliers, values: arr, q1, q3, iqr: iqrVal, bounds: [lo, hi] };
}

// Helper function to get exact t-values for small samples or Z-scores for larger ones
function getTCriticalValue(confidence, df) {
  // Standard Normal Distribution (Z-scores) for large sample sizes (df > 30)
  const zScores = { 0.90: 1.645, 0.95: 1.960, 0.99: 2.576 };
  
  if (df > 30) {
    return zScores[confidence] || 1.960;
  }

  // Lookup table for exact t-values for degrees of freedom 1 to 30
  const tTable = {
    1: { 0.90: 6.314, 0.95: 12.706, 0.99: 63.657 },
    2: { 0.90: 2.920, 0.95: 4.303, 0.99: 9.925 },
    3: { 0.90: 2.353, 0.95: 3.182, 0.99: 5.841 },
    4: { 0.90: 2.132, 0.95: 2.776, 0.99: 4.604 },
    5: { 0.90: 2.015, 0.95: 2.571, 0.99: 4.032 },
    6: { 0.90: 1.943, 0.95: 2.447, 0.99: 3.707 },
    7: { 0.90: 1.895, 0.95: 2.365, 0.99: 3.499 },
    8: { 0.90: 1.860, 0.95: 2.306, 0.99: 3.355 },
    9: { 0.90: 1.833, 0.95: 2.262, 0.99: 3.250 },
    10: { 0.90: 1.812, 0.95: 2.228, 0.99: 3.169 },
    11: { 0.90: 1.796, 0.95: 2.201, 0.99: 3.106 },
    12: { 0.90: 1.782, 0.95: 2.179, 0.99: 3.055 },
    13: { 0.90: 1.771, 0.95: 2.160, 0.99: 3.012 },
    14: { 0.90: 1.761, 0.95: 2.145, 0.99: 2.977 },
    15: { 0.90: 1.753, 0.95: 2.131, 0.99: 2.947 },
    16: { 0.90: 1.746, 0.95: 2.120, 0.99: 2.921 },
    17: { 0.90: 1.740, 0.95: 2.110, 0.99: 2.898 },
    18: { 0.90: 1.734, 0.95: 2.101, 0.99: 2.878 },
    19: { 0.90: 1.729, 0.95: 2.093, 0.99: 2.861 },
    20: { 0.90: 1.725, 0.95: 2.086, 0.99: 2.845 },
    21: { 0.90: 1.721, 0.95: 2.080, 0.99: 2.831 },
    22: { 0.90: 1.717, 0.95: 2.074, 0.99: 2.819 },
    23: { 0.90: 1.714, 0.95: 2.069, 0.99: 2.807 },
    24: { 0.90: 1.711, 0.95: 2.064, 0.99: 2.797 },
    25: { 0.90: 1.708, 0.95: 2.060, 0.99: 2.787 },
    26: { 0.90: 1.706, 0.95: 2.056, 0.99: 2.779 },
    27: { 0.90: 1.703, 0.95: 2.052, 0.99: 2.771 },
    28: { 0.90: 1.701, 0.95: 2.048, 0.99: 2.763 },
    29: { 0.90: 1.699, 0.95: 2.045, 0.99: 2.756 },
    30: { 0.90: 1.697, 0.95: 2.042, 0.99: 2.750 }
  };

  // Fallback to 0.95 if an unsupported confidence level is passed
  const safeConf = tTable[df][confidence] ? confidence : 0.95;
  return tTable[df][safeConf];
}

export function confidenceInterval(arr, confidence = 0.95) {
  const n = arr.length;
  if (n < 2) return null;
  
  const m = mean(arr);
  const s = stdev(arr, m); 
  
  if (s === 0) return { mean: m, sd: 0, lower: m, upper: m, margin: 0, n, confidence };
  
  const se = s / Math.sqrt(n);
  const df = n - 1; // Degrees of freedom
  
  // Calculate margin using exact t-distribution critical values
  const tCritical = getTCriticalValue(confidence, df);
  const margin = tCritical * se;
  
  return { mean: m, sd: s, se, lower: m - margin, upper: m + margin, margin, n, confidence };
}

export function linearRegression(xVals, yVals) {
  if (xVals.length !== yVals.length || xVals.length < 3) return null;
  const n = xVals.length;
  const mx = mean(xVals), my = mean(yVals);
  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xVals[i] - mx, dy = yVals[i] - my;
    ssxy += dx * dy; ssxx += dx * dx; ssyy += dy * dy;
  }
  if (ssxx === 0 || ssyy === 0) return null;
  const slope = ssxy / ssxx;
  const intercept = my - slope * mx;
  const r2 = (ssxy ** 2) / (ssxx * ssyy);
  const r = Math.sqrt(r2) * (slope >= 0 ? 1 : -1);
  const sse = ssyy - (ssxy ** 2) / ssxx;
  const seSlope = Math.sqrt(sse / (n - 2) / ssxx);
  const seIntercept = seSlope * Math.sqrt((1 / n) * xVals.reduce((s, x) => s + x * x, 0));
  const tSlope = seSlope < 1e-15 ? Infinity : slope / seSlope;
  const tIntercept = seIntercept < 1e-15 ? Infinity : intercept / seIntercept;
  const df = n - 2;
  const pValue = isFinite(tSlope) ? 2 * (1 - tDistributeCDF(Math.abs(tSlope), df)) : 0;
  const seResidual = Math.sqrt(sse / (n - 2));
  return { slope, intercept, r2, r, seSlope, seIntercept, tSlope, tIntercept, pValue, significant: pValue < 0.05, seResidual, n, equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ellipse / Arc / Bezier geometry helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function fitEllipse(pts) {
  if (!pts || pts.length < 3) return null;
  const [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }] = pts;
  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-10) return null;
  const sq = p => p.x * p.x + p.y * p.y;
  const ux = ((sq({ x: x1, y: y1 }) * (y2 - y3) + sq({ x: x2, y: y2 }) * (y3 - y1) + sq({ x: x3, y: y3 }) * (y1 - y2)) / D);
  const uy = ((sq({ x: x1, y: y1 }) * (x3 - x2) + sq({ x: x2, y: y2 }) * (x1 - x3) + sq({ x: x3, y: y3 }) * (x2 - x1)) / D);
  const r1 = Math.hypot(x1 - ux, y1 - uy);
  const r2 = Math.hypot(x2 - ux, y2 - uy);
  const r3 = Math.hypot(x3 - ux, y3 - uy);
  const avgR = (r1 + r2 + r3) / 3;
  return { cx: ux, cy: uy, rx: avgR, ry: avgR * 0.6, rotation: Math.atan2(y2 - y1, x2 - x1) };
}

export function ellipseFromAxes(pts) {
  if (!pts || pts.length < 3) return null;
  const [center, majorEnd, minorEnd] = pts;
  const rx = dist(center, majorEnd);
  const ry = dist(center, minorEnd);
  if (rx < 0.5 || ry < 0.5) return null;
  const rotation = Math.atan2(majorEnd.y - center.y, majorEnd.x - center.x);
  return { cx: center.x, cy: center.y, rx, ry, rotation };
}

export function mirrorPoint(pt, axisP1, axisP2) {
  const dx = axisP2.x - axisP1.x;
  const dy = axisP2.y - axisP1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return { x: pt.x, y: pt.y };
  const t = ((pt.x - axisP1.x) * dx + (pt.y - axisP1.y) * dy) / len2;
  const projX = axisP1.x + t * dx;
  const projY = axisP1.y + t * dy;
  return { x: 2 * projX - pt.x, y: 2 * projY - pt.y };
}

export function ellipsePerimeter(rx, ry) {
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}

export function circleFrom3pts(p1, p2, p3) {
  const ax = p1.x, ay = p1.y, bx = p2.x, by = p2.y, cx = p3.x, cy = p3.y;
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
  return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) };
}

export function arcLength3pts(p1, p2, p3) {
  const c = circleFrom3pts(p1, p2, p3);
  if (!c) return dist(p1, p3);
  let a1 = Math.atan2(p1.y - c.cy, p1.x - c.cx);
  let a2 = Math.atan2(p2.y - c.cy, p2.x - c.cx);
  let a3 = Math.atan2(p3.y - c.cy, p3.x - c.cx);
  const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = normalize(a1); a2 = normalize(a2); a3 = normalize(a3);
  const between = (a, lo, hi) => lo <= hi ? (a >= lo && a <= hi) : (a >= lo || a <= hi);
  let angle = normalize(a3 - a1);
  if (between(a2, a1, a1 + angle)) return c.r * angle;
  return c.r * (2 * Math.PI - angle);
}

export function arcAngle3pts(p1, p2, p3) {
  const c = circleFrom3pts(p1, p2, p3);
  if (!c) return 0;
  let a1 = Math.atan2(p1.y - c.cy, p1.x - c.cx);
  let a3 = Math.atan2(p3.y - c.cy, p3.x - c.cx);
  let a2 = Math.atan2(p2.y - c.cy, p2.x - c.cx);
  const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = normalize(a1); a2 = normalize(a2); a3 = normalize(a3);
  let angle = normalize(a3 - a1);
  if (normalize(a2 - a1) > angle) angle = 2 * Math.PI - angle;
  return angle * 180 / Math.PI;
}

export function cubicBezierPoint(t, p0, p1, p2, p3) {
  if (!p0 || !p1 || !p2 || !p3) return { x: 0, y: 0 };
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
  };
}

export function cubicBezierLength(p0, p1, p2, p3, samples = 64) {
  if (!p0 || !p1 || !p2 || !p3) return 0;
  let len = 0, prev = p0;
  for (let i = 1; i <= samples; i++) {
    const cur = cubicBezierPoint(i / samples, p0, p1, p2, p3);
    len += dist(prev, cur);
    prev = cur;
  }
  return len;
}

export function cubicBezierTangent(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function distToBezier(pt, p0, p1, p2, p3, samples = 64) {
  if (!p0 || !p1 || !p2 || !p3) return Infinity;
  let minD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const bp = cubicBezierPoint(i / samples, p0, p1, p2, p3);
    const d = dist(pt, bp);
    if (d < minD) minD = d;
  }
  return minD;
}

export function autoControlPoints(anchors) {
  const n = anchors.length;
  if (n < 2) return [];
  const cp = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = anchors[i - 1] || anchors[i];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[i + 2] || anchors[i + 1];
    cp.push({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 });
    cp.push({ x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 });
  }
  return cp;
}

export function multiBezierLength(anchors, cp, samples = 32) {
  if (anchors.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    len += cubicBezierLength(anchors[i], cp[2 * i], cp[2 * i + 1], anchors[i + 1], samples);
  }
  return len;
}

export function distToMultiBezier(pt, anchors, cp, samples = 32) {
  if (anchors.length < 2) return Infinity;
  let minD = Infinity;
  for (let i = 0; i < anchors.length - 1; i++) {
    const d = distToBezier(pt, anchors[i], cp[2 * i], cp[2 * i + 1], anchors[i + 1], samples);
    if (d < minD) minD = d;
  }
  return minD;
}

export function distToEllipse(pt, cx, cy, rx, ry, rot = 0, samples = 96) {
  let minD = Infinity;
  const cosR = Math.cos(-rot), sinR = Math.sin(-rot);
  const dx = pt.x - cx, dy = pt.y - cy;
  const lx = dx * cosR - dy * sinR, ly = dx * sinR + dy * cosR;
  for (let i = 0; i <= samples; i++) {
    const a = (2 * Math.PI * i) / samples;
    const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    const d = Math.hypot(lx - ex, ly - ey);
    if (d < minD) minD = d;
  }
  return minD;
}

export function distToArc(pt, p1, p2, p3, samples = 64) {
  const c = circleFrom3pts(p1, p2, p3);
  if (!c) return Math.min(dist(pt, p1), dist(pt, p2), dist(pt, p3));
  let a1 = Math.atan2(p1.y - c.cy, p1.x - c.cx);
  let a2 = Math.atan2(p2.y - c.cy, p2.x - c.cx);
  let a3 = Math.atan2(p3.y - c.cy, p3.x - c.cx);
  const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = normalize(a1); a2 = normalize(a2); a3 = normalize(a3);
  let start = a1, end = normalize(a3 - a1);
  if (normalize(a2 - a1) > end) { start = a3; end = 2 * Math.PI - end; }
  let minD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const a = start + (end * i) / samples;
    const ax = c.cx + c.r * Math.cos(a), ay = c.cy + c.r * Math.sin(a);
    const d = dist(pt, { x: ax, y: ay });
    if (d < minD) minD = d;
  }
  return minD;
}

export function tangentAtCirclePoint(cx, cy, r, px, py, tangentLen = 50) {
  const angle = Math.atan2(py - cy, px - cx);
  const perpAngle = angle + Math.PI / 2;
  return {
    x1: px - tangentLen * Math.cos(perpAngle),
    y1: py - tangentLen * Math.sin(perpAngle),
    x2: px + tangentLen * Math.cos(perpAngle),
    y2: py + tangentLen * Math.sin(perpAngle)
  };
}

export function midpointOnArc(p1, p2, p3) {
  const c = circleFrom3pts(p1, p2, p3);
  if (!c) return { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
  let a1 = Math.atan2(p1.y - c.cy, p1.x - c.cx);
  let a2 = Math.atan2(p2.y - c.cy, p2.x - c.cx);
  let a3 = Math.atan2(p3.y - c.cy, p3.x - c.cx);
  const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = normalize(a1); a2 = normalize(a2); a3 = normalize(a3);
  let start = a1, sweep = normalize(a3 - a1);
  if (normalize(a2 - a1) > sweep) { start = a3; sweep = 2 * Math.PI - sweep; }
  const mid = start + sweep / 2;
  return { x: c.cx + c.r * Math.cos(mid), y: c.cy + c.r * Math.sin(mid) };
}

export function simplifyRDP(pts, tolerance) {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  const first = pts[0], last = pts[pts.length - 1];
  const dx = last.x - first.x, dy = last.y - first.y;
  const lenSq = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const t = lenSq > 0 ? ((pts[i].x - first.x) * dx + (pts[i].y - first.y) * dy) / lenSq : 0;
    const px = first.x + clamp(t, 0, 1) * dx, py = first.y + clamp(t, 0, 1) * dy;
    const d = Math.hypot(pts[i].x - px, pts[i].y - py);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tolerance) {
    const left = simplifyRDP(pts.slice(0, maxI + 1), tolerance);
    const right = simplifyRDP(pts.slice(maxI), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function projectOnSegment(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return { t: 0, dist: dist(pt, a) };
  const t = clamp(((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq, 0, 1);
  return { t, dist: dist(pt, { x: a.x + t * dx, y: a.y + t * dy }) };
}

export function nearestPointOnCubicBezier(pt, p0, p1, p2, p3, samples = 64) {
  let bestT = 0, bestD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const bp = cubicBezierPoint(t, p0, p1, p2, p3);
    const d = dist(pt, bp);
    if (d < bestD) { bestD = d; bestT = t; }
  }
  for (let pass = 0; pass < 3; pass++) {
    const lo = Math.max(0, bestT - 1 / samples), hi = Math.min(1, bestT + 1 / samples);
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = lo + (hi - lo) * i / steps;
      const bp = cubicBezierPoint(t, p0, p1, p2, p3);
      const d = dist(pt, bp);
      if (d < bestD) { bestD = d; bestT = t; }
    }
  }
  const tp = cubicBezierPoint(bestT, p0, p1, p2, p3);
  const tg = cubicBezierTangent(bestT, p0, p1, p2, p3);
  const angle = Math.atan2(tg.y, tg.x);
  return { point: tp, t: bestT, dist: bestD, angle };
}

export function nearestPointOnMultiBezier(pt, anchors, cp, samplesPerSeg = 32) {
  if (anchors.length < 2) return null;
  let best = null;
  for (let i = 0; i < anchors.length - 1; i++) {
    const r = nearestPointOnCubicBezier(pt, anchors[i], cp[2 * i], cp[2 * i + 1], anchors[i + 1], samplesPerSeg);
    if (!best || r.dist < best.dist) best = { ...r, segIdx: i };
  }
  return best;
}

export function nearestPointOnSampledCurve(pt, samples) {
  if (!samples || samples.length < 2) return null;
  let bestD = Infinity, bestI = 0, bestT = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const r = projectOnSegment(pt, samples[i], samples[i + 1]);
    if (r.dist < bestD) { bestD = r.dist; bestI = i; bestT = r.t; }
  }
  const a = samples[bestI], b = samples[bestI + 1];
  const tp = { x: a.x + bestT * (b.x - a.x), y: a.y + bestT * (b.y - a.y) };
  const dx = b.x - a.x, dy = b.y - a.y;
  const angle = Math.atan2(dy, dx);
  return { point: tp, dist: bestD, angle, t: (bestI + bestT) / (samples.length - 1) };
}

export function snapTangentToCurve(curveMarkup, dragPt) {
  if (!curveMarkup) return null;
  const vp = vpts(curveMarkup);
  if (curveMarkup.type === "circle" && vp.length >= 2) {
    const cx = vp[0].x, cy = vp[0].y, r = dist(vp[0], vp[1]);
    if (r < 1) return null;
    const a = Math.atan2(dragPt.y - cy, dragPt.x - cx);
    return { tangentPoint: { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }, tangentAngle: a + Math.PI / 2 };
  }
  if (curveMarkup.type === "arc" && vp.length >= 3) {
    const c = circleFrom3pts(vp[0], vp[1], vp[2]);
    if (!c || c.r < 1) return null;
    const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let a1 = normalize(Math.atan2(vp[0].y - c.cy, vp[0].x - c.cx));
    let a2 = normalize(Math.atan2(vp[1].y - c.cy, vp[1].x - c.cx));
    let a3 = normalize(Math.atan2(vp[2].y - c.cy, vp[2].x - c.cx));
    let start = a1, sweep = normalize(a3 - a1);
    if (normalize(a2 - a1) > sweep) { start = a3; sweep = 2 * Math.PI - sweep; }
    let aClick = Math.atan2(dragPt.y - c.cy, dragPt.x - c.cx);
    aClick = normalize(aClick);
    let rel = normalize(aClick - start);
    if (rel > sweep) rel = rel > Math.PI ? 0 : sweep;
    const a = start + rel;
    return { tangentPoint: { x: c.cx + c.r * Math.cos(a), y: c.cy + c.r * Math.sin(a) }, tangentAngle: a + Math.PI / 2 };
  }
  if (curveMarkup.type === "ellipse" && vp.length >= 3) {
    const ell = ellipseFromAxes(vp);
    if (!ell) return null;
    const r = nearestPointOnSampledCurve(dragPt, Array.from({length: 96}, (_, i) => {
      const a = (2 * Math.PI * i) / 96;
      return { x: ell.cx + ell.rx * Math.cos(a) * Math.cos(ell.rotation) - ell.ry * Math.sin(a) * Math.sin(ell.rotation), y: ell.cy + ell.rx * Math.cos(a) * Math.sin(ell.rotation) + ell.ry * Math.sin(a) * Math.cos(ell.rotation) };
    }));
    if (!r) return null;
    const a = 2 * Math.PI * r.t;
    const nx = Math.cos(a) * Math.cos(ell.rotation) / ell.rx - Math.sin(a) * Math.sin(ell.rotation) / ell.ry;
    const ny = Math.cos(a) * Math.sin(ell.rotation) / ell.rx + Math.sin(a) * Math.cos(ell.rotation) / ell.ry;
    return { tangentPoint: r.point, tangentAngle: Math.atan2(ny, nx) + Math.PI / 2 };
  }
  if (curveMarkup.type === "bezier" && vp.length >= 2) {
    const cp = (curveMarkup.cp && curveMarkup.cp.length === 2 * (vp.length - 1)) ? curveMarkup.cp : autoControlPoints(vp);
    const r = nearestPointOnMultiBezier(dragPt, vp, cp, 48);
    if (!r) return null;
    return { tangentPoint: r.point, tangentAngle: r.angle + Math.PI / 2 };
  }
  if ((curveMarkup.type === "curve" || curveMarkup.type === "polyline") && vp.length >= 2) {
    const samples = sampleSpline(curveMarkup.type === "curve" ? vp : vp, false, 16);
    const r = nearestPointOnSampledCurve(dragPt, samples);
    if (!r) return null;
    return { tangentPoint: r.point, tangentAngle: r.angle + Math.PI / 2 };
  }
  return null;
}

export function findTangentOnCurve(markups, clickPt, threshold) {
  let best = null;
  let bestDist = Infinity;
  for (const m of markups) {
    if (m.visible === false || m.locked) continue;
    const vp = vpts(m);
    if (m.type === "circle" && vp.length >= 2) {
      const cx = vp[0].x, cy = vp[0].y;
      const r = dist(vp[0], vp[1]);
      if (r < 1) continue;
      const dx = clickPt.x - cx, dy = clickPt.y - cy;
      const dCenter = Math.sqrt(dx * dx + dy * dy);
      const dCircle = Math.abs(dCenter - r);
      if (dCircle < threshold && dCircle < bestDist) {
        bestDist = dCircle;
        const a = Math.atan2(dy, dx);
        const tp = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        best = { tangentPoint: tp, tangentAngle: a + Math.PI / 2, curveId: m.id, curveCenter: { x: cx, y: cy }, curveRadius: r };
      }
    } else if (m.type === "arc" && vp.length >= 3) {
      const c = circleFrom3pts(vp[0], vp[1], vp[2]);
      if (!c || c.r < 1) continue;
      const normalize = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let a1 = normalize(Math.atan2(vp[0].y - c.cy, vp[0].x - c.cx));
      let a2 = normalize(Math.atan2(vp[1].y - c.cy, vp[1].x - c.cx));
      let a3 = normalize(Math.atan2(vp[2].y - c.cy, vp[2].x - c.cx));
      let start = a1, sweep = normalize(a3 - a1);
      if (normalize(a2 - a1) > sweep) { start = a3; sweep = 2 * Math.PI - sweep; }
      const samples = 64;
      for (let i = 0; i <= samples; i++) {
        const a = start + (sweep * i) / samples;
        const sx = c.cx + c.r * Math.cos(a), sy = c.cy + c.r * Math.sin(a);
        const d = dist(clickPt, { x: sx, y: sy });
        if (d < threshold && d < bestDist) {
          bestDist = d;
          const tp = { x: sx, y: sy };
          best = { tangentPoint: tp, tangentAngle: a + Math.PI / 2, curveId: m.id, curveCenter: { x: c.cx, y: c.cy }, curveRadius: c.r };
        }
      }
    } else if (m.type === "ellipse" && vp.length >= 3) {
      const ell = ellipseFromAxes(vp);
      if (!ell) continue;
      const samples = 96;
      for (let i = 0; i < samples; i++) {
        const a = (2 * Math.PI * i) / samples;
        const ex = ell.cx + ell.rx * Math.cos(a) * Math.cos(ell.rotation) - ell.ry * Math.sin(a) * Math.sin(ell.rotation);
        const ey = ell.cy + ell.rx * Math.cos(a) * Math.sin(ell.rotation) + ell.ry * Math.sin(a) * Math.cos(ell.rotation);
        const d = dist(clickPt, { x: ex, y: ey });
        if (d < threshold && d < bestDist) {
          bestDist = d;
          const nx = Math.cos(a) * Math.cos(ell.rotation) / ell.rx - Math.sin(a) * Math.sin(ell.rotation) / ell.ry;
          const ny = Math.cos(a) * Math.sin(ell.rotation) / ell.rx + Math.sin(a) * Math.cos(ell.rotation) / ell.ry;
          const na = Math.atan2(ny, nx);
          best = { tangentPoint: { x: ex, y: ey }, tangentAngle: na + Math.PI / 2, curveId: m.id, curveCenter: { x: ell.cx, y: ell.cy }, curveRadius: Math.max(ell.rx, ell.ry) };
        }
      }
    } else if (m.type === "bezier" && vp.length >= 2) {
      const cp = (m.cp && m.cp.length === 2 * (vp.length - 1)) ? m.cp : autoControlPoints(vp);
      const r = nearestPointOnMultiBezier(clickPt, vp, cp, 48);
      if (r && r.dist < threshold && r.dist < bestDist) {
        bestDist = r.dist;
        best = { tangentPoint: r.point, tangentAngle: r.angle + Math.PI / 2, curveId: m.id };
      }
    } else if ((m.type === "curve" || m.type === "polyline") && vp.length >= 2) {
      const samples = sampleSpline(m.type === "curve" ? vp : vp, false, 16);
      const r = nearestPointOnSampledCurve(clickPt, samples);
      if (r && r.dist < threshold && r.dist < bestDist) {
        bestDist = r.dist;
        best = { tangentPoint: r.point, tangentAngle: r.angle + Math.PI / 2, curveId: m.id };
      }
    }
  }
  return best;
}
