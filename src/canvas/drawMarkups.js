import { clamp, dist, angle3pt, angle4pt, computeMeasurements, polyArea, polyLen, vpts, catmullRom, sampleCatmullRom, splineArea, splineLen, getInfiniteLinePoints, ellipseFromAxes, circleFrom3pts, autoControlPoints, distToMultiBezier, distToEllipse, distToArc, perpPoint, perpPointSeg, distToSeg } from "../lib/utils.js";
import { SILHOUETTES } from "../data/silhouettes.js";
import { LUT_PRESETS } from "../data/constants.js";
import { AIRWAY_NORMS } from "../data/norms.js";

function isReproPointVisible(m, reproCollecting){
  if(!reproCollecting || !m.repro) return true;
  return m.repro.studyId === reproCollecting.studyId && m.repro.opId === reproCollecting.opId && m.repro.trialIdx === reproCollecting.trialIdx;
}

let _annotationBold = false;
// Profile direction for signed labels (set per drawMarkup call from displayOpts).
let _facing = "right";

export function drawMeasLabel(ctx, text, x, y, showAnnotations = true, annotationSize = 1, m = null, color = "#fff", bgColor = "rgba(46, 46, 46, 0.85)"){
  if(!showAnnotations || (m && m.noLabel)) return;
  
  const fontSize = 10 * annotationSize;
  const prevFont = ctx.font;
  ctx.font = `${_annotationBold ? "bold " : ""}${fontSize}px "DM Mono",monospace`;
  
  const prevFill = ctx.fillStyle;
  if(bgColor){
    const metrics = ctx.measureText(text);
    const padding = 3 * annotationSize;
    const bgHeight = 14 * annotationSize;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x - padding, y - bgHeight + 2, metrics.width + padding * 2, bgHeight + 4 , 5);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.fillStyle = prevFill;
  ctx.font = prevFont;
}

export function drawMarkup(ctx, m, zoom, pan, cal, sel, t, reproCollecting, canvasSize, angleMode, showAnnotations = true, annotationSize = 1, hoveredPt = null, displayOpts = {}){
  if(m.visible === false) return;
  if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) return;
  const { autoHideLabels, annotationBold, facing } = displayOpts;
  _annotationBold = !!annotationBold;
  _facing = facing === "left" ? "left" : "right";
  
  const sc = p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y });
  const fmtAngle = (v) => {
    const [sign, unit] = angleMode?.split("-") || ["signed", "deg"];
    if(sign === "abs") v = Math.abs(v);
    else if(sign === "simple") v = Math.abs(v);
    else if(sign === "reflex") v = Math.abs(v) > 180 ? 360 - Math.abs(v) : 360 - Math.abs(v);
    if(unit === "rad") return (v * Math.PI / 180).toFixed(4) + " rad";
    return v.toFixed(1) + "°";
  };
  
  const sp = vpts(m).map(sc);
  if(!sp.length && m.type !== "silhouette") return;
  
  const isSel = sel === m.id;
  const drawLabel = showAnnotations && !(autoHideLabels && m.type !== "point");
  ctx.save();
  try {
    switch(m.type){
      case "point":
        drawPoint(ctx, m, sp, isSel, t, zoom, pan, showAnnotations, annotationSize);
        break;
      case "arrow":
        drawArrow(ctx, m, sp, t, zoom);
        break;
      case "line":
      case "parallel":
        drawLine(ctx, m, sp, isSel, t, cal, zoom, canvasSize, drawLabel, annotationSize);
        break;
      case "angle3":
        drawAngle3(ctx, m, sp, isSel, t, cal, zoom, fmtAngle, drawLabel, annotationSize);
        break;
      case "angle4":
        drawAngle4(ctx, m, sp, t, fmtAngle, zoom, drawLabel, annotationSize);
        break;
      case "polygon":
        drawPolygon(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "curve":
      case "polyline":
        drawCurve(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "perp":
        drawPerp(ctx, m, sp, t, cal, zoom, pan, drawLabel, annotationSize);
        break;
      case "text":
        drawText(ctx, m, sp, isSel, t, zoom, showAnnotations, annotationSize);
        break;
      case "projDist":
        drawProjDist(ctx, m, sp, isSel, t, cal, zoom, pan, drawLabel, annotationSize);
        break;
      case "ruler":
        drawRuler(ctx, m, sp, t, zoom, drawLabel, annotationSize);
        break;
      case "silhouette":
        drawSilhouette(ctx, m, isSel, t, zoom, pan, showAnnotations, annotationSize, hoveredPt);
        break;
      case "ellipse":
        drawEllipse(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "arc":
        drawArc(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "circle":
        drawCircle(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "bezier":
        drawBezier(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt, pan, displayOpts);
        break;
      case "tangent":
        drawTangent(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize, hoveredPt);
        break;
      case "concentric":
        drawConcentric(ctx, m, sp, isSel, t, cal, zoom, drawLabel, annotationSize);
        break;
    }
  } catch { /*silent*/ }
  ctx.restore();
}

function drawPoint(ctx, m, sp, isSel, t, zoom, pan, showAnnotations, annotationSize = 1){
  const p = sp[0], r = (m.size || 6) * Math.sqrt(zoom);
  
  if(m.arrowFrom && m.arrowFrom.x > -9000){
    const ap = { x: m.arrowFrom.x * zoom + pan.x, y: m.arrowFrom.y * zoom + pan.y };
    ctx.strokeStyle = m.color || t.acc;
    ctx.lineWidth = 2 * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.moveTo(ap.x, ap.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    
    const angle = Math.atan2(p.y - ap.y, p.x - ap.x);
    const arrowSize = 10 * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - arrowSize * Math.cos(angle - Math.PI/6), p.y - arrowSize * Math.sin(angle - Math.PI/6));
    ctx.lineTo(p.x - arrowSize * Math.cos(angle + Math.PI/6), p.y - arrowSize * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = m.color || t.acc;
    ctx.fill();
  }
  
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = m.color || t.acc;
  ctx.fill();
  
  if(isSel){
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - r * 1.9, p.y);
  ctx.lineTo(p.x + r * 1.9, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r * 1.9);
  ctx.lineTo(p.x, p.y + r * 1.9);
  ctx.stroke();
  
  if(m.label && showAnnotations && !m.noLabel){
    const fs = clamp(11 * Math.sqrt(zoom) * annotationSize, 9, 16);
    ctx.font = `bold ${fs}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || t.acc;
    drawMeasLabel(ctx, m.label, p.x + r + 3, p.y - r - 1, showAnnotations, annotationSize, m);
  }
}

function drawArrow(ctx, m, sp, t, zoom){
  if(sp.length < 2){ ctx.restore(); return; }
  const p1 = sp[0], p2 = sp[1];
  
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = (m.width || 2) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const arrowSize = 12 * Math.sqrt(zoom);
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p2.x - arrowSize * Math.cos(angle - Math.PI/6), p2.y - arrowSize * Math.sin(angle - Math.PI/6));
  ctx.lineTo(p2.x - arrowSize * Math.cos(angle + Math.PI/6), p2.y - arrowSize * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = m.color || t.acc;
  ctx.fill();
}

function drawLine(ctx, m, sp, isSel, t, cal, zoom, canvasSize, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  const isInfinite = m.mode === "infinite";
  const cw = canvasSize?.w || 800, ch = canvasSize?.h || 600;
  const linePts = isInfinite ? getInfiniteLinePoints(sp[0], sp[1], cw, ch) : [sp[0], sp[1]];
  
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(linePts[0].x, linePts[0].y);
  ctx.lineTo(linePts[1].x, linePts[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom) + 4;
    ctx.beginPath();
    ctx.moveTo(linePts[0].x, linePts[0].y);
    ctx.lineTo(linePts[1].x, linePts[1].y);
    ctx.stroke();
    sp.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle =  t.color || "#ba1c1c";
      ctx.fill();
    });
  }

  
  if(showAnnotations && (m.type === "line" || m.type === "parallel") && !isInfinite && cal?.done && cal.pxPerMm){
    const ip = vpts(m);
    if(ip.length >= 2){
      const d = dist(ip[0], ip[1]) / cal.pxPerMm;
      const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
      ctx.font = `${clamp(10 * Math.sqrt(zoom) * annotationSize, 8, 14)}px "DM Mono",monospace`;
      ctx.fillStyle = m.color || t.acc;
      drawMeasLabel(ctx, d.toFixed(1) + " mm", mid.x + 10, mid.y - 15, showAnnotations, annotationSize, m);
    }
  }
  
  if(isSel && m.locked && showAnnotations && !m.noLabel){
    const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
    ctx.font = `${clamp(10 * Math.sqrt(zoom) * annotationSize, 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = "#f59e0b";
    drawMeasLabel(ctx, "🔒", mid.x + 5, mid.y + 28, showAnnotations, annotationSize, m);
  }
}

function drawAngle3(ctx, m, sp, isSel, t, cal, zoom, fmtAngle, showAnnotations, annotationSize = 1){
  if(sp.length < 3){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#f472b6";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.lineTo(sp[2].x, sp[2].y);
  ctx.stroke();
  
  const ip = vpts(m);
  const v1 = { x: ip[0].x - ip[1].x, y: ip[0].y - ip[1].y };
  const v2 = { x: ip[2].x - ip[1].x, y: ip[2].y - ip[1].y };
  const a1 = Math.atan2(v1.y, v1.x);
  const a2 = Math.atan2(v2.y, v2.x);
  const arcR = 24 * Math.sqrt(zoom);
  
  let startA = a1, endA = a2;
  if(endA < startA){ const tmp = startA; startA = endA; endA = tmp; }
  if(endA - startA > Math.PI){ startA += Math.PI * 2; }
  
  ctx.beginPath();
  ctx.arc(sp[1].x, sp[1].y, arcR, startA, endA);
  ctx.strokeStyle = (m.color || "#f472b6") + "99";
  ctx.lineWidth = (m.width || 1.5) * 0.8 * Math.sqrt(zoom);
  ctx.stroke();
  
  if(showAnnotations && !m.noLabel){
    // Same value the measurement tables use (signed/convexity conventions included).
    const ang = computeMeasurements(m, null, { facing: _facing }).angle ?? angle3pt(ip[0], ip[1], ip[2]);
    const midA = (startA + endA) / 2;
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#f472b6";
    drawMeasLabel(ctx, fmtAngle(ang), sp[1].x + Math.cos(midA) * (arcR + 16), sp[1].y + Math.sin(midA) * (arcR + 16), showAnnotations, annotationSize, m);
  }
}

function drawAngle4(ctx, m, sp, t, fmtAngle, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 4){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#f472b6";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(sp[2].x, sp[2].y);
  ctx.lineTo(sp[3].x, sp[3].y);
  ctx.stroke();
  
  if(showAnnotations && !m.noLabel){
    const ip = vpts(m);
    const ang = computeMeasurements(m, null, { facing: _facing }).angle ?? angle4pt(ip[0], ip[1], ip[2], ip[3]);
    const cx = (sp[0].x + sp[1].x + sp[2].x + sp[3].x) / 4;
    const cy = (sp[0].y + sp[1].y + sp[2].y + sp[3].y) / 4;
    
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#f472b6";
    drawMeasLabel(ctx, fmtAngle(ang), cx, cy - 8, showAnnotations, annotationSize, m);
  }
}

function drawPolygon(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize = 1, hoveredPt = null){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.beginPath();
  if(m.curveStyle === "bspline" && sp.length >= 3) catmullRom(ctx, sp, true);
  else{
    ctx.moveTo(sp[0].x, sp[0].y);
    sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
  }
  
  ctx.fillStyle = m.fillColor || "rgba(56,189,248,0.12)";
  ctx.fill();
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.strokeStyle = m.strokeColor || t.acc;
  ctx.lineWidth = (m.strokeWidth || 1.5) * Math.sqrt(zoom);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    sp.forEach((p, i) => {
      const isHovered = hoveredPt?.ptIdx === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHovered ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? t.acc : (t.color || "#ba1c1c");
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
  
  if(showAnnotations && cal?.done && sp.length >= 3 && !m.noLabel){
    const ip = vpts(m);
    const cx = sp.reduce((s, p) => s + p.x, 0) / sp.length;
    const cy = sp.reduce((s, p) => s + p.y, 0) / sp.length;
    const area = (m.curveStyle === "bspline" ? splineArea(ip) : polyArea(ip)) / cal.pxPerMm ** 2;
    ctx.font = `${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = m.strokeColor || t.acc;
    drawMeasLabel(ctx, area.toFixed(1) + " mm²", cx - 20, cy, showAnnotations, annotationSize, m, "#00c3ff", null);
  }
}

function drawCurve(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize = 1, hoveredPt = null){
  if(sp.length < 2){ ctx.restore(); return; }
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.strokeStyle = m.color || "#fb923c";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.beginPath();
  
  if(m.curveStyle === "bspline" && sp.length >= 3) catmullRom(ctx, sp, false);
  else{
    ctx.moveTo(sp[0].x, sp[0].y);
    sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    sp.forEach((p, i) => {
      const isHovered = hoveredPt?.ptIdx === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHovered ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? t.acc : (t.color || "#ba1c1c");
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
  
  if(showAnnotations && cal?.done && !m.noLabel){
    const ip = vpts(m);
    const lp = sp[Math.floor(sp.length / 2)];
    const len = (m.curveStyle === "bspline" && ip.length >= 3 ? splineLen(ip, false) : polyLen(ip, false)) / cal.pxPerMm;
    ctx.font = `${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#fb923c";
    drawMeasLabel(ctx, len.toFixed(1) + " mm", lp.x + 5, lp.y - 8, showAnnotations, annotationSize, m, "#00c3ff", null);
  }
}

function drawPerp(ctx, m, sp, t, cal, zoom, pan, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#a78bfa";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  
  if(sp.length >= 3 && showAnnotations){
    const ip = vpts(m);
    if(ip.length >= 3){
      const ax = ip[0].x, ay = ip[0].y;
      const bx = ip[1].x, by = ip[1].y;
      const px = ip[2].x, py = ip[2].y;
      const t2 = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / Math.max(dist(ip[0], ip[1]) ** 2, 1e-9);
      const fx = ax + t2 * (bx - ax);
      const fy = ay + t2 * (by - ay);
      const fs = { x: fx * zoom + pan.x, y: fy * zoom + pan.y };
      
      ctx.setLineDash([4 * zoom, 4 * zoom]);
      ctx.strokeStyle = (m.color || "#a78bfa") + "cc";
      ctx.beginPath();
      ctx.moveTo(sp[2].x, sp[2].y);
      ctx.lineTo(fs.x, fs.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      const d2 = dist(ip[0], ip[1]);
      if(d2 > 1e-6){
        const dx = (bx - ax) / d2 * 8 * Math.sqrt(zoom);
        const dy = (by - ay) / d2 * 8 * Math.sqrt(zoom);
        ctx.strokeStyle = m.color || "#a78bfa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fs.x + dx, fs.y + dy);
        ctx.lineTo(fs.x + dx - dy, fs.y + dy + dx);
        ctx.lineTo(fs.x - dy, fs.y + dx);
        ctx.stroke();
      }
      
      if(cal?.done && !m.noLabel){
        const pd = computeMeasurements(m, cal, { facing: _facing }).distance ?? 0;
        const lx = (sp[2].x + fs.x) / 2;
        const ly = (sp[2].y + fs.y) / 2;
        ctx.font = `bold ${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
        ctx.fillStyle = m.color || "#a78bfa";
        drawMeasLabel(ctx, pd.toFixed(1) + " mm", lx + 5, ly, showAnnotations, annotationSize, m);
      }
    }
  }
}

function drawProjDist(ctx, m, sp, isSel, t, cal, zoom, pan, showAnnotations, annotationSize = 1){
  if(sp.length < 4){ ctx.restore(); return; }
  const ip = vpts(m);
  if(ip.length < 4) return;
  const col = m.color || "#a78bfa";

  // reference line (points 2 and 3)
  ctx.strokeStyle = col + "88";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([6 * Math.sqrt(zoom), 4 * Math.sqrt(zoom)]);
  ctx.beginPath();
  ctx.moveTo(sp[2].x, sp[2].y);
  ctx.lineTo(sp[3].x, sp[3].y);
  ctx.stroke();
  ctx.setLineDash([]);

  // perpendiculars from ptA and ptB to reference line
  const foot = (idx) => {
    const ax = ip[2].x, ay = ip[2].y, bx = ip[3].x, by = ip[3].y;
    const px = ip[idx].x, py = ip[idx].y;
    const t2 = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / Math.max(dist(ip[2], ip[3]) ** 2, 1e-9);
    return { x: ax + t2 * (bx - ax), y: ay + t2 * (by - ay) };
  };
  const fA = foot(0), fB = foot(1);
  const sfA = { x: fA.x * zoom + pan.x, y: fA.y * zoom + pan.y };
  const sfB = { x: fB.x * zoom + pan.x, y: fB.y * zoom + pan.y };

  ctx.strokeStyle = col + "66";
  ctx.lineWidth = 1 * Math.sqrt(zoom);
  ctx.setLineDash([3 * Math.sqrt(zoom), 3 * Math.sqrt(zoom)]);
  ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); ctx.lineTo(sfA.x, sfA.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sp[1].x, sp[1].y); ctx.lineTo(sfB.x, sfB.y); ctx.stroke();
  ctx.setLineDash([]);

  // projected segment (between foot points)
  ctx.strokeStyle = col;
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.beginPath();
  ctx.moveTo(sfA.x, sfA.y);
  ctx.lineTo(sfB.x, sfB.y);
  ctx.stroke();

  // right-angle markers at foot points
  const ang = (p, ref1, ref2) => {
    const d = Math.min(dist(p, ref1), dist(p, ref2)) * 0.15;
    const dx = ref2.x - ref1.x, dy = ref2.y - ref1.y, len = Math.sqrt(dx * dx + dy * dy);
    if(len < 1e-9) return;
    const nx = dx / len * d, ny = dy / len * d;
    const perpx = -ny, perpy = nx;
    ctx.strokeStyle = col + "88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + perpx, p.y + perpy);
    ctx.lineTo(p.x + perpx + nx, p.y + perpy + ny);
    ctx.lineTo(p.x + nx, p.y + ny);
    ctx.stroke();
  };
  ang(sfA, sp[2], sp[3]);
  ang(sfB, sp[2], sp[3]);

  // annotation
  if(cal?.done && showAnnotations && !m.noLabel){
    const pd = computeMeasurements(m, cal, { facing: _facing }).projectedDistance ?? 0;
    const mx = (sfA.x + sfB.x) / 2;
    const my = (sfA.y + sfB.y) / 2 - 8 * Math.sqrt(zoom);
    ctx.font = `bold ${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = col;
    drawMeasLabel(ctx, pd.toFixed(1) + " mm", mx, my, showAnnotations, annotationSize, m);
  }
}

function drawText(ctx, m, sp, isSel, t, zoom){
  if(!sp.length){ ctx.restore(); return; }
  
  const p = sp[0];
  const fs = clamp((m.fontSize || 14) * Math.sqrt(zoom), 8, 48);
  ctx.font = `${m.bold ? "bold " : ""}${fs}px "DM Sans",sans-serif`;
  ctx.fillStyle = m.color || t.acc;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(m.text || "Text", p.x, p.y);
  ctx.shadowBlur = 0;
  
  if(isSel){
    const mtr = ctx.measureText(m.text || "Text");
    ctx.strokeStyle = t.acc + "88";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(p.x - 2, p.y - fs, mtr.width + 4, fs + 6);
    ctx.setLineDash([]);
  }
}

function drawRuler(ctx, m, sp, t, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2 * Math.sqrt(zoom);
  ctx.setLineDash([6 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  [sp[0], sp[1]].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8 * Math.sqrt(zoom));
    ctx.lineTo(p.x, p.y + 8 * Math.sqrt(zoom));
    ctx.stroke();
  });
  
  if(showAnnotations && !m.noLabel){
    const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = "#facc15";
    drawMeasLabel(ctx, m.label || "ruler", mid.x + 5, mid.y - 8, showAnnotations, annotationSize, m);
  }
}

function drawEllipse(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize, hoveredPt) {
  if (sp.length < 3) return;
  const ell = ellipseFromAxes(sp);
  if (!ell) return;
  const cx = ell.cx, cy = ell.cy;
  const rx = ell.rx, ry = ell.ry;
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, ell.rotation, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  sp.forEach((p, i) => {
    const isH = hoveredPt && hoveredPt.type === "ellipse" && hoveredPt.mid === m.id && hoveredPt.ptIdx === i;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (isSel || isH ? 5 : 3.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = isH ? "#fff" : (m.color || t.acc);
    ctx.fill();
    if (isSel) { ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
  if (showAnnotations && !m.noLabel) {
    drawMeasLabel(ctx, m.label || "Ellipse", cx, cy - ry - 10, showAnnotations, annotationSize, m, m.color || t.acc);
  }
}

function drawArc(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize, hoveredPt) {
  if (sp.length < 3) return;
  const c = circleFrom3pts(sp[0], sp[1], sp[2]);
  if (!c) { ctx.beginPath(); sp.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke(); return; }
  const cx = c.cx, cy = c.cy;
  const r = c.r;
  let a1 = Math.atan2(sp[0].y - cy, sp[0].x - cx);
  let a2 = Math.atan2(sp[1].y - cy, sp[1].x - cx);
  let a3 = Math.atan2(sp[2].y - cy, sp[2].x - cx);
  const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = norm(a1); a2 = norm(a2); a3 = norm(a3);
  let start = a1, sweep = norm(a3 - a1);
  if (norm(a2 - a1) > sweep) { start = a3; sweep = 2 * Math.PI - sweep; }
  ctx.strokeStyle = m.color || "#fb923c";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + sweep);
  ctx.stroke();
  ctx.setLineDash([]);
  sp.forEach((p, i) => {
    const isH = hoveredPt && hoveredPt.type === "arc" && hoveredPt.mid === m.id && hoveredPt.ptIdx === i;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (isSel || isH ? 5 : 3.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = isH ? "#fff" : (m.color || "#fb923c");
    ctx.fill();
    if (isSel) { ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
  if (showAnnotations && !m.noLabel) {
    const mid = { x: (sp[0].x + sp[2].x) / 2, y: (sp[0].y + sp[2].y) / 2 };
    drawMeasLabel(ctx, m.label || "Arc", mid.x, mid.y - 10, showAnnotations, annotationSize, m, m.color || "#fb923c");
  }
}

function drawCircle(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize, hoveredPt) {
  if (sp.length < 2) return;
  const r = dist(sp[0], sp[1]);
  const cx = sp[0].x, cy = sp[0].y, cr = r;
  ctx.strokeStyle = m.color || "#38bdf8";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  sp.forEach((p, i) => {
    const isH = hoveredPt && hoveredPt.type === "circle" && hoveredPt.mid === m.id && hoveredPt.ptIdx === i;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (isSel || isH ? 5 : 3.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = isH ? "#fff" : (m.color || "#38bdf8");
    ctx.fill();
    if (isSel) { ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
  if (showAnnotations && !m.noLabel) {
    drawMeasLabel(ctx, m.label || "Circle", cx, cy - cr - 10, showAnnotations, annotationSize, m, m.color || "#38bdf8");
  }
}

function drawBezier(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize, hoveredPt, pan, displayOpts = {}) {
  if (sp.length < 2) return;
  const cp = (m.cp && m.cp.length === 2 * (sp.length - 1))
    ? m.cp.map(p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }))
    : autoControlPoints(sp);
  ctx.strokeStyle = m.color || "#c084fc";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  for (let i = 0; i < sp.length - 1; i++) {
    ctx.bezierCurveTo(cp[2 * i].x, cp[2 * i].y, cp[2 * i + 1].x, cp[2 * i + 1].y, sp[i + 1].x, sp[i + 1].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  if (isSel) {
    ctx.strokeStyle = m.color + "44";
    ctx.lineWidth = 1;
    ctx.setLineDash([3 * zoom, 3 * zoom]);
    for (let i = 0; i < sp.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sp[i].x, sp[i].y); ctx.lineTo(cp[2 * i].x, cp[2 * i].y);
      ctx.moveTo(cp[2 * i + 1].x, cp[2 * i + 1].y); ctx.lineTo(sp[i + 1].x, sp[i + 1].y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  if (isSel || displayOpts.showCpAlways) {
    cp.forEach((p, i) => {
      const isH = hoveredPt && hoveredPt.type === "bezierCp" && hoveredPt.mid === m.id && hoveredPt.cpIdx === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (isH ? 8 : 6) * Math.sqrt(zoom), 0, 2 * Math.PI);
      ctx.fillStyle = isH ? "#fff" : (m.color || "#c084fc") + "cc";
      ctx.fill();
      ctx.strokeStyle = t.tx2; ctx.lineWidth = 1; ctx.stroke();
    });
  }
  if (isSel || displayOpts.showAnchorAlways) {
    sp.forEach((p, i) => {
      const isH = hoveredPt && hoveredPt.type === "bezier" && hoveredPt.mid === m.id && hoveredPt.ptIdx === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (isSel || isH ? 6 : 4.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
      ctx.fillStyle = isH ? "#fff" : (m.color || "#c084fc");
      ctx.fill();
      if (isSel) { ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
  }
  if (showAnnotations && !m.noLabel) {
    const mid = sp[Math.floor(sp.length / 2)];
    drawMeasLabel(ctx, m.label || "Bezier", mid.x, mid.y - 10, showAnnotations, annotationSize, m, m.color || "#c084fc");
  }
}

function drawTangent(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize, hoveredPt) {
  if (sp.length < 2) return;
  ctx.strokeStyle = m.color || "#fbbf24";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (m.tangentAngle != null) {
    const tAngle = m.tangentAngle;
    const rAngle = tAngle - Math.PI / 2;
    const sq = 8 * Math.sqrt(zoom);
    const ox = Math.cos(rAngle) * sq, oy = Math.sin(rAngle) * sq;
    ctx.beginPath();
    ctx.strokeStyle = (m.color || "#fbbf24") + "66";
    ctx.lineWidth = 1;
    ctx.setLineDash([3 * zoom, 3 * zoom]);
    ctx.moveTo(sp[0].x - ox, sp[0].y - oy);
    ctx.lineTo(sp[0].x + ox, sp[0].y + oy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sp[0].x, sp[0].y, 3 * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = (m.color || "#fbbf24") + "44";
    ctx.fill();
  }
  sp.forEach((p, i) => {
    const isH = hoveredPt && hoveredPt.type === "tangent" && hoveredPt.mid === m.id && hoveredPt.ptIdx === i;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (isSel || isH ? 5 : 3.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = isH ? "#fff" : (m.color || "#fbbf24");
    ctx.fill();
    if (isSel) { ctx.strokeStyle = t.acc; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
  if (showAnnotations && !m.noLabel) {
    const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
    drawMeasLabel(ctx, m.label || "Tangent", mid.x, mid.y - 10, showAnnotations, annotationSize, m, m.color || "#fbbf24");
  }
}

function drawConcentric(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize) {
  if (sp.length < 3) return;
  const c = circleFrom3pts(sp[0], sp[1], sp[2]);
  if (!c) return;
  const cx = c.cx, cy = c.cy;
  const r = c.r;
  let a1 = Math.atan2(sp[0].y - cy, sp[0].x - cx);
  let a2 = Math.atan2(sp[1].y - cy, sp[1].x - cx);
  let a3 = Math.atan2(sp[2].y - cy, sp[2].x - cx);
  const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  a1 = norm(a1); a2 = norm(a2); a3 = norm(a3);
  let start = a1, sweep = norm(a3 - a1);
  if (norm(a2 - a1) > sweep) { start = a3; sweep = 2 * Math.PI - sweep; }
  const count = m.count || 4;
  const spacing = m.spacing || 0.3;
  const offsets = m.offsets || Array.from({ length: count }, (_, i) => i * spacing);
  const baseColor = m.color || "#60a5fa";
  if (m.style === "dashed") ctx.setLineDash([6 * zoom, 4 * zoom]);
  else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 3 * zoom]);
  offsets.forEach((off, i) => {
    const rr = r * (1 + off);
    const alpha = Math.max(0.3, 1 - i * (0.7 / Math.max(offsets.length - 1, 1)));
    ctx.strokeStyle = baseColor;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, start, start + sweep);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  sp.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, (isSel ? 5 : 3.5) * Math.sqrt(zoom), 0, 2 * Math.PI);
    ctx.fillStyle = baseColor;
    ctx.fill();
  });
  if (showAnnotations && !m.noLabel) {
    drawMeasLabel(ctx, m.label || "Concentric", cx, cy - r * (1 + offsets[offsets.length - 1]) - 10, showAnnotations, annotationSize, m, baseColor);
  }
}

function drawSilhouette(ctx, m, isSel, t, zoom, pan, showAnnotations, annotationSize, hoveredPt = null) {
  try {
  const paths = m.paths || SILHOUETTES[m.silhouetteType]?.paths;
  if (!paths) return;

  const rot = m.rotation || 0;
  const sc = m.scale || 1;
  const pos = m.position || { x: 0, y: 0 };
  const baseSize = 100;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  function transform(p) {
    const sx = p.x * sc * baseSize;
    const sy = p.y * sc * baseSize;
    const rx = sx * cosR - sy * sinR;
    const ry = sx * sinR + sy * cosR;
    return {
      x: (rx + pos.x) * zoom + pan.x,
      y: (ry + pos.y) * zoom + pan.y,
    };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  const nameColor = {};
  if (m.pathColors) {
    paths.forEach((p, i) => { if (p.name && m.pathColors[i]) nameColor[p.name] = m.pathColors[i]; });
  }

  paths.forEach((path, pi) => {
    if (path.points.length < 2) return;
    const sp = path.points.map(transform);

    sp.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const pc = m.pathColors?.[pi] || (path.name && nameColor[path.name]);
    let strokeColor, fillColor;
    if (pc) {
      strokeColor = pc;
      fillColor = pc + "22";
    } else {
      const defColor = path.color || SILHOUETTES[m.silhouetteType]?.color;
      strokeColor = m.color || defColor;
      fillColor = m.fillColor || (m.color || defColor) + "22";
    }
    const lineWidth = (m.width || 1.5) * Math.sqrt(zoom);

    if (m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
    else if (m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
    else ctx.setLineDash([]);

    if (path.closed) {
      ctx.beginPath();
      if (sp.length >= 3) catmullRom(ctx, sp, true);
      else {
        ctx.moveTo(sp[0].x, sp[0].y);
        sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
      }
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else {
      ctx.beginPath();
      if (sp.length >= 3) catmullRom(ctx, sp, false);
      else {
        ctx.moveTo(sp[0].x, sp[0].y);
        sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  });

  if (isSel && minX < Infinity) {
    const pad = 6 * Math.sqrt(zoom);
    const bminX = minX - pad, bmaxX = maxX + pad;
    const bminY = minY - pad, bmaxY = maxY + pad;

    // Draw draggable point handles on editable silhouettes
    if (m.paths) {
      paths.forEach((path, pi) => {
        path.points.forEach((p, ptI) => {
          const isHovered = hoveredPt?.type === "silhouette" && hoveredPt?.mid === m.id && hoveredPt?.pathIdx === pi && hoveredPt?.ptIdx === ptI;
          const sp = transform(p);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, (isHovered ? 8 : 4) * Math.sqrt(zoom), 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.strokeStyle = isHovered ? t.acc2 : t.acc;
          ctx.lineWidth = isHovered ? 3 : 1.5;
          ctx.stroke();
        });
      });
    }

    if (m.showFrame !== false) {
    ctx.strokeStyle = t.acc + "66";
    ctx.lineWidth = 1;
    ctx.setLineDash([4 * Math.sqrt(zoom), 3 * Math.sqrt(zoom)]);
    ctx.strokeRect(bminX, bminY, bmaxX - bminX, bmaxY - bminY);
    ctx.setLineDash([]);

    const handleColor = "#fff";
    const borderColor = t.acc;
    const corners = [
      { x: bminX, y: bminY },
      { x: bmaxX, y: bminY },
      { x: bminX, y: bmaxY },
      { x: bmaxX, y: bmaxY },
    ];

    corners.forEach((p, ci) => {
      const isHov = hoveredPt?.type === "corner" && hoveredPt?.mid === m.id && hoveredPt?.cornerIdx === ci;
      const sz = (isHov ? 9 : 6) * Math.sqrt(zoom);
      ctx.fillStyle = handleColor;
      ctx.strokeStyle = isHov ? t.acc2 : borderColor;
      ctx.lineWidth = isHov ? 2.5 : 1.5;
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      ctx.strokeRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    });

    const rotCX = (bminX + bmaxX) / 2;
    const rotCY = bminY - pad - 18 * Math.sqrt(zoom);
    const isRotHov = hoveredPt?.type === "rotate" && hoveredPt?.mid === m.id;
    const rotSz = (isRotHov ? 9 : 6) * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.arc(rotCX, rotCY, rotSz, 0, Math.PI * 2);
    ctx.fillStyle = isRotHov ? t.acc2 : handleColor;
    ctx.fill();
    ctx.strokeStyle = isRotHov ? t.acc2 : borderColor;
    ctx.lineWidth = isRotHov ? 2.5 : 1.5;
    ctx.stroke();
    ctx.strokeStyle = (isRotHov ? t.acc2 : borderColor) + "66";
    ctx.lineWidth = isRotHov ? 1.5 : 1;
    ctx.setLineDash([3 * Math.sqrt(zoom), 3 * Math.sqrt(zoom)]);
    ctx.beginPath();
    ctx.moveTo(rotCX, rotCY + rotSz);
    ctx.lineTo(rotCX, corners[0].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isRotHov ? t.acc2 : borderColor;
    ctx.font = `${(isRotHov ? 13 : 10) * Math.sqrt(zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("↻", rotCX, rotCY + rotSz + 12 * Math.sqrt(zoom));
    }
  }
  } catch { /*silent*/ }
}

export function drawInProgress(ctx, draw, mp, zoom, pan, t){
  if(!draw) return;
  
  const sc = p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y });
  const sp = draw.points.filter(p => p.x > -9000).map(sc);
  
  ctx.save();
  ctx.strokeStyle = t.acc + "cc";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  
  if(draw.type === "midpoint" && sp.length === 1 && mp){
    const mid = { x: (sp[0].x + mp.x) / 2, y: (sp[0].y + mp.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  else if(draw.type === "perppoint" && sp.length === 2 && mp){
    const p1 = sp[0], p2 = sp[1];
    ctx.strokeStyle = "#f472b6" + "cc";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    
    const lx1 = p2.x - p1.x, ly1 = p2.y - p1.y;
    const lx2 = -ly1, ly2 = lx1;
    
    ctx.setLineDash([]);
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mp.x - lx2 * 2, mp.y - ly2 * 2);
    ctx.lineTo(mp.x + lx2 * 2, mp.y + ly2 * 2);
    ctx.stroke();
  }
  else if(draw.type === "arrow" && sp.length === 1 && mp){
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    
    const angle = Math.atan2(mp.y - sp[0].y, mp.x - sp[0].x);
    const arrowSize = 12;
    ctx.beginPath();
    ctx.moveTo(mp.x, mp.y);
    ctx.lineTo(mp.x - arrowSize * Math.cos(angle - Math.PI/6), mp.y - arrowSize * Math.sin(angle - Math.PI/6));
    ctx.lineTo(mp.x - arrowSize * Math.cos(angle + Math.PI/6), mp.y - arrowSize * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = "#34d399";
    ctx.fill();
  }
  else if(draw.type === "ellipse" && sp.length >= 1 && mp){
    if(sp.length === 1){
      const r = dist(sp[0], mp);
      ctx.beginPath();
      ctx.ellipse(sp[0].x, sp[0].y, r, r, 0, 0, Math.PI * 2);
      ctx.stroke();
      [sp[0], mp].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.acc; ctx.fill(); });
    }else{
      const pts = [sp[0], sp[1], mp];
      const ell = ellipseFromAxes(pts);
      if(ell){
        ctx.beginPath();
        ctx.ellipse(ell.cx, ell.cy, ell.rx, ell.ry, ell.rotation, 0, Math.PI * 2);
        ctx.stroke();
      }
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.acc; ctx.fill(); });
    }
  }
  else if(draw.type === "arc" && sp.length >= 2 && mp){
    const pts = [...sp, mp];
    const c = circleFrom3pts(pts[0], pts[1], pts[2]);
    if(c){
      let a1 = Math.atan2(pts[0].y - c.cy, pts[0].x - c.cx);
      let a2 = Math.atan2(pts[1].y - c.cy, pts[1].x - c.cx);
      let a3 = Math.atan2(pts[2].y - c.cy, pts[2].x - c.cx);
      const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      a1 = norm(a1); a2 = norm(a2); a3 = norm(a3);
      let start = a1, sweep = norm(a3 - a1);
      if(norm(a2 - a1) > sweep){ start = a3; sweep = 2 * Math.PI - sweep; }
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.r, start, start + sweep);
      ctx.stroke();
    }
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.acc; ctx.fill(); });
  }
  else if(draw.type === "circle" && sp.length === 1 && mp){
    const r = dist(sp[0], mp);
    ctx.beginPath();
    ctx.arc(sp[0].x, sp[0].y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  else if(draw.type === "bezier" && sp.length >= 1 && mp){
    const pts = [...sp, mp];
    if(pts.length >= 2){
      const cp = autoControlPoints(pts);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 0; i < pts.length - 1; i++){
        ctx.bezierCurveTo(cp[2*i].x, cp[2*i].y, cp[2*i+1].x, cp[2*i+1].y, pts[i+1].x, pts[i+1].y);
      }
      ctx.stroke();
      ctx.strokeStyle = t.acc + "44";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for(let i = 0; i < pts.length - 1; i++){
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(cp[2*i].x, cp[2*i].y);
        ctx.moveTo(cp[2*i+1].x, cp[2*i+1].y); ctx.lineTo(pts[i+1].x, pts[i+1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.acc; ctx.fill(); });
  }
  else if(draw.type === "tangent" && sp.length === 1 && mp){
    if(draw.tangentAngle != null){
      const p0=sp[0];
      const a=draw.tangentAngle;
      const dx=mp.x-p0.x,dy=mp.y-p0.y;
      const proj=dx*Math.cos(a)+dy*Math.sin(a);
      const ep={x:p0.x+proj*Math.cos(a),y:p0.y+proj*Math.sin(a)};
      ctx.beginPath();
      ctx.moveTo(p0.x,p0.y);
      ctx.lineTo(ep.x,ep.y);
      ctx.stroke();
    }else{
      ctx.beginPath();
      ctx.moveTo(sp[0].x,sp[0].y);
      ctx.lineTo(mp.x,mp.y);
      ctx.stroke();
    }
  }
  else if(draw.type === "concentric" && sp.length >= 2 && mp){
    const pts = [...sp, mp];
    if(pts.length >= 3){
      const c = circleFrom3pts(pts[0], pts[1], pts[2]);
      if(c){
        const count = draw.count || 4;
        const spacing = draw.spacing || 0.3;
        Array.from({ length: count }, (_, i) => i * spacing).forEach(off => {
          ctx.beginPath();
          ctx.arc(c.cx, c.cy, c.r * (1 + off), 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    }
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.acc; ctx.fill(); });
  }
  else if(draw.type === "mirror" && sp.length >= 1 && mp){
    if(sp.length === 1){
      ctx.beginPath();
      ctx.moveTo(sp[0].x, sp[0].y);
      ctx.lineTo(mp.x, mp.y);
      ctx.strokeStyle = t.warn || "#facc15";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sp[0].x, sp[0].y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }else if(sp.length === 2){
      ctx.beginPath();
      ctx.moveTo(sp[1].x, sp[1].y);
      ctx.lineTo(mp.x, mp.y);
      ctx.strokeStyle = t.warn || "#facc15";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      [sp[1], mp].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = t.warn || "#facc15"; ctx.fill(); });
      const adx = mp.x - sp[1].x, ady = mp.y - sp[1].y;
      const alen2 = adx * adx + ady * ady;
      if(alen2 > 1e-10){
        const tt = ((sp[0].x - sp[1].x) * adx + (sp[0].y - sp[1].y) * ady) / alen2;
        const gx = 2 * (sp[1].x + tt * adx) - sp[0].x;
        const gy = 2 * (sp[1].y + tt * ady) - sp[0].y;
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = t.ok || "#22c55e";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  else if(sp.length === 1 && mp){
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
  }
  else if(sp.length >= 2){
    ctx.beginPath();
    if((draw.type === "curve" || draw.type === "polygon") && draw.curveStyle === "bspline" && sp.length >= 3){
      catmullRom(ctx, sp, false);
    }
    else{
      ctx.moveTo(sp[0].x, sp[0].y);
      sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    }
    if(mp) ctx.lineTo(mp.x, mp.y);
    if(draw.type === "polygon" && mp) ctx.lineTo(sp[0].x, sp[0].y);
    ctx.stroke();
  }
  
  if(draw.type !== "arrowpoint"){
    sp.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = t.acc;
      ctx.fill();
    });
  }
  
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawScaleBar(ctx, zoom, cal, cw, ch){
  if(!cal?.done) return;
  
  const pxPerMm = cal.pxPerMm * zoom;
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const mm = nice.find(v => v * pxPerMm >= 70) || 100;
  const bw = mm * pxPerMm;
  const x0 = cw - bw - 16;
  const y0 = ch - 28;
  
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x0 - 8, y0 - 20, bw + 36, 28);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + bw, y0);
  ctx.moveTo(x0, y0 - 7);
  ctx.lineTo(x0, y0 + 4);
  ctx.moveTo(x0 + bw, y0 - 7);
  ctx.lineTo(x0 + bw, y0 + 4);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `bold 10px "DM Mono",monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${mm} mm`, x0 + bw/2, y0 - 8);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawLUTLegend(ctx, lutMode, lutInvert, cw, ch, t){
  const preset = LUT_PRESETS.find(l => l.id === lutMode);
  if(!preset) return;
  
  const bx = cw - 58, by = 20, bh = Math.min(ch * 0.4, 180), bw = 18;
  const stops = lutInvert ? [...preset.stops].reverse() : preset.stops;
  
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(bx - 10, by - 8, bw + 56, bh + 36);
  
  const grad = ctx.createLinearGradient(0, by, 0, by + bh);
  stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  
  ctx.fillStyle = "#fff";
  ctx.font = `9px "DM Mono",monospace`;
  ctx.textAlign = "left";
  for(let i = 0; i <= 4; i++){
    const y = by + bh * i / 4;
    ctx.fillText(Math.round(255 * (1 - i/4)), bx + bw + 4, y + 3);
  }
  ctx.fillStyle = t.acc;
  ctx.font = `bold 9px "DM Mono",monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${preset.name}${lutInvert ? " ⇅" : ""}`, bx + bw/2, by + bh + 16);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawSnapIndicator(ctx, sn, zoom, pan, markups, mouseImg, snapRadius, snapEnabled){
  const sx = sn.x * zoom + pan.x;
  const sy = sn.y * zoom + pan.y;
  const col = sn.kind === "line" ? "#38bdf8" : "#ffd700";

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = col + "66";
  ctx.beginPath();
  ctx.moveTo(sx - 18, sy);
  ctx.lineTo(sx + 18, sy);
  ctx.moveTo(sx, sy - 18);
  ctx.lineTo(sx, sy + 18);
  ctx.stroke();

  if(markups && mouseImg && snapRadius){
    ctx.strokeStyle = col + "33";
    ctx.lineWidth = 1.5;
    for(const m of markups){
      if(m.visible === false) continue;
      const vp = vpts(m);

      if(snapEnabled?.points){
        for(const p of vp){
          const dx = p.x - mouseImg.x, dy = p.y - mouseImg.y;
          if(Math.sqrt(dx*dx + dy*dy) < snapRadius){
            const psx = p.x * zoom + pan.x, psy = p.y * zoom + pan.y;
            ctx.beginPath();
            ctx.arc(psx, psy, 8, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      if(snapEnabled?.lines && (m.type === "line" || m.type === "parallel") && vp.length >= 2){
        const pr = m.mode === "infinite" ? perpPoint(mouseImg, vp[0], vp[1]) : perpPointSeg(mouseImg, vp[0], vp[1]);
        if(!pr) continue;
        const d = dist(pr, mouseImg);
        if(d < snapRadius){
          const psx = pr.x * zoom + pan.x, psy = pr.y * zoom + pan.y;
          ctx.beginPath();
          ctx.arc(psx, psy, 8, 0, Math.PI * 2);
          ctx.stroke();
          const x1 = vp[0].x * zoom + pan.x, y1 = vp[0].y * zoom + pan.y;
          const x2 = vp[1].x * zoom + pan.x, y2 = vp[1].y * zoom + pan.y;
          ctx.strokeStyle = col + "55";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = col + "33";
          ctx.lineWidth = 1.5;
        }
      }
    }
  }
  ctx.restore();
}

function getZColor(z) {
  const a = Math.abs(z);
  if (a <= 1) return "#22c55e";
  if (a <= 2) return "#eab308";
  return "#ef4444";
}

export function drawAirwayOverlay(ctx, markups, zoom, pan, cal, colorMode, t) {
  if (!cal?.done) return;
  const ppm = cal.pxPerMm;
  const sc = p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y });

  const colors = colorMode === "orange"
    ? { fill: "rgba(213, 94, 0, 0.06)", stroke: "rgba(213, 94, 0, 0.3)" }
    : { fill: "rgba(56, 189, 248, 0.06)", stroke: "rgba(56, 189, 248, 0.25)" };

  const findPt = (label) => {
    const m = markups.find(mk => mk.type === "point" && mk.label === label && mk.visible !== false);
    if (!m) return null;
    const vp = vpts(m);
    return vp.length ? vp[0] : null;
  };

  const pns = findPt("PNS"), ad1 = findPt("Ad1"), ad2 = findPt("Ad2");
  const sp = findPt("SP"), ad3 = findPt("Ad3");
  const val = findPt("Vallecula"), ad4 = findPt("Ad4");
  const epi = findPt("Epiglottis"), pasbot = findPt("PAS_lowest");
  const go = findPt("Go"), me = findPt("Me"), h = findPt("H");
  if (!pns || !ad1 || !ad2 || !sp) return;

  const anteriorPoints = [pns];
  if (sp) anteriorPoints.push(sp);
  if (val) anteriorPoints.push(val);
  if (epi) anteriorPoints.push(epi);
  const posteriorPoints = [ad1, ad2];
  if (ad3) posteriorPoints.push(ad3);
  if (pasbot) posteriorPoints.push(pasbot);
  if (ad4) posteriorPoints.push(ad4);

  const nAnt = anteriorPoints.length;
  const nPost = posteriorPoints.length;
  if (nAnt < 2 || nPost < 2) return;

  const normKeyMap = {
    "PNS-Ad1": "PNS-AD1",
    "SP-Ad2": "PNS-AD2",
    "McUP": "R-PAS",
    "MAS": "MAS",
    "McLP": "IAS",
  };

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(sc(anteriorPoints[0]).x, sc(anteriorPoints[0]).y);
  for (let i = 1; i < nAnt; i++) ctx.lineTo(sc(anteriorPoints[i]).x, sc(anteriorPoints[i]).y);
  for (let i = nPost - 1; i >= 0; i--) ctx.lineTo(sc(posteriorPoints[i]).x, sc(posteriorPoints[i]).y);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1;
  ctx.setLineDash([4 * zoom, 4 * zoom]);
  ctx.stroke();
  ctx.setLineDash([]);

  const levelLabels = [];

  if (pns && ad1) { levelLabels.push({ ant: pns, post: ad1, label: "PNS-Ad1" }); }
  if (sp && ad2) { levelLabels.push({ ant: sp, post: ad2, label: "SP-Ad2" }); }
  if (sp && ad3) { levelLabels.push({ ant: sp, post: ad3, label: "McUP" }); }
  if (val && ad4) { levelLabels.push({ ant: val, post: ad4, label: "MAS" }); }
  if (epi && pasbot) { levelLabels.push({ ant: epi, post: pasbot, label: "McLP" }); }
  if (epi && ad4) { levelLabels.push({ ant: epi, post: ad4, label: "IAS" }); }
  if (go && me && h) { levelLabels.push({ ant: h, post: { x: h.x, y: h.y }, label: "MP-H", isPerp: true, lineP1: go, lineP2: me }); }

  const allAnt = [...anteriorPoints], allPost = [...posteriorPoints];

  levelLabels.forEach((ll) => {
    let w, spA, spP, mx, my;

    let dxPerp, dyPerp, denPerp, projX, projY;
    if (ll.isPerp && ll.lineP1 && ll.lineP2) {
      dxPerp = ll.lineP2.x - ll.lineP1.x;
      dyPerp = ll.lineP2.y - ll.lineP1.y;
      denPerp = Math.sqrt(dxPerp * dxPerp + dyPerp * dyPerp);
      const num = Math.abs(
        (ll.lineP2.y - ll.lineP1.y) * ll.ant.x -
        (ll.lineP2.x - ll.lineP1.x) * ll.ant.y +
        ll.lineP2.x * ll.lineP1.y -
        ll.lineP2.y * ll.lineP1.x
      );
      w = denPerp < 1e-9 ? 0 : num / denPerp / ppm;
      const t = denPerp < 1e-9 ? 0 : ((ll.ant.x - ll.lineP1.x) * dxPerp + (ll.ant.y - ll.lineP1.y) * dyPerp) / (denPerp * denPerp);
      projX = ll.lineP1.x + t * dxPerp;
      projY = ll.lineP1.y + t * dyPerp;
      spA = sc({ x: (ll.ant.x + projX) / 2, y: (ll.ant.y + projY) / 2 });
      spP = sc({ x: (ll.ant.x + projX) / 2, y: (ll.ant.y + projY) / 2 });
      mx = spA.x;
      my = spA.y;
    } else {
      w = dist(ll.ant, ll.post) / ppm;
      spA = sc(ll.ant);
      spP = sc(ll.post);
      mx = (spA.x + spP.x) / 2;
      my = (spA.y + spP.y) / 2;
    }

    const nk = normKeyMap[ll.label] || ll.label;
    const norm = AIRWAY_NORMS[nk];
    const z = norm && norm.sd > 0 ? (w - norm.mean) / norm.sd : null;
    const color = z !== null ? getZColor(z) : (t?.tx2 || "#fff");

    if (!ll.isPerp) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * Math.sqrt(zoom);
      ctx.beginPath();
      ctx.moveTo(spA.x, spA.y);
      ctx.lineTo(spP.x, spP.y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * Math.sqrt(zoom);
      ctx.setLineDash([5 * Math.sqrt(zoom), 3 * Math.sqrt(zoom)]);
      ctx.beginPath();
      ctx.moveTo(sc(ll.ant).x, sc(ll.ant).y);
      ctx.lineTo(sc({ x: projX, y: projY }).x, sc({ x: projX, y: projY }).y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = t?.tx3 || "#ccc";
    ctx.font = `${clamp(8 * Math.sqrt(zoom), 6, 11)}px "DM Mono",monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${ll.label}`, mx, my - 10 * Math.sqrt(zoom));
    ctx.fillStyle = t?.tx || "#fff";
    ctx.font = `bold ${clamp(9 * Math.sqrt(zoom), 7, 12)}px "DM Mono",monospace`;
    ctx.fillText(`${w.toFixed(1)} mm`, mx, my + 14 * Math.sqrt(zoom));
    ctx.textAlign = "left";
  });

  const sortedAnt = [...allAnt].sort((a, b) => a.y - b.y);
  const sortedPost = [...allPost].sort((a, b) => a.y - b.y);
  const yMin = Math.max(sortedAnt[0]?.y || 0, sortedPost[0]?.y || 0);
  const yMax = Math.min(sortedAnt[sortedAnt.length - 1]?.y || 0, sortedPost[sortedPost.length - 1]?.y || 0);

  if (yMax > yMin) {
    const N = 100;
    const antSamples = [], postSamples = [];
    for (let i = 0; i <= N; i++) {
      const y = yMin + (yMax - yMin) * (i / N);
      for (let j = 1; j < sortedAnt.length; j++) {
        if (y >= sortedAnt[j - 1].y && y <= sortedAnt[j].y) {
          const dy = sortedAnt[j].y - sortedAnt[j - 1].y;
          const f = dy === 0 ? 0 : (y - sortedAnt[j - 1].y) / dy;
          antSamples.push({ x: sortedAnt[j - 1].x + f * (sortedAnt[j].x - sortedAnt[j - 1].x), y });
          break;
        }
      }
      for (let j = 1; j < sortedPost.length; j++) {
        if (y >= sortedPost[j - 1].y && y <= sortedPost[j].y) {
          const dy = sortedPost[j].y - sortedPost[j - 1].y;
          const f = dy === 0 ? 0 : (y - sortedPost[j - 1].y) / dy;
          postSamples.push({ x: sortedPost[j - 1].x + f * (sortedPost[j].x - sortedPost[j - 1].x), y });
          break;
        }
      }
    }

    let dynMinW = Infinity, dynAntPt = null, dynPostPt = null;
    for (const a of antSamples) {
      for (const p of postSamples) {
        const dx = p.x - a.x, dy = p.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < dynMinW) { dynMinW = d; dynAntPt = a; dynPostPt = p; }
      }
    }

    if (dynAntPt && dynPostPt && dynMinW < Infinity) {
      const wMm = dynMinW / ppm;
      const sxA = dynAntPt.x * zoom + pan.x, syA = dynAntPt.y * zoom + pan.y;
      const sxP = dynPostPt.x * zoom + pan.x, syP = dynPostPt.y * zoom + pan.y;
      const mx = (sxA + sxP) / 2, my = (syA + syP) / 2;
      ctx.strokeStyle = t?.err || "#f87171";
      ctx.lineWidth = 2.5 * Math.sqrt(zoom);
      ctx.setLineDash([5 * Math.sqrt(zoom), 3 * Math.sqrt(zoom)]);
      ctx.beginPath();
      ctx.moveTo(sxA, syA);
      ctx.lineTo(sxP, syP);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t?.err || "#f87171";
      ctx.font = `bold ${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`↓ Narrowest (${wMm.toFixed(1)} mm)`, mx, my - 14 * Math.sqrt(zoom));
      ctx.textAlign = "left";
    }
  }

  ctx.restore();
}

function drawDisplacementArrow(ctx, x1, y1, x2, y2, lenPx, scale, color, label){
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if(len < 1) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // dot at origin (current version)
  ctx.beginPath();
  ctx.arc(x1, y1, 3.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();

  // dot at destination (compare version)
  ctx.beginPath();
  ctx.arc(x2, y2, 3.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#f472b6";
  ctx.fill();

  // arrowhead at destination
  const angle = Math.atan2(dy, dx);
  const hl = Math.min(len * 0.25, 10 * scale);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl * Math.cos(angle - 0.45), y2 - hl * Math.sin(angle - 0.45));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl * Math.cos(angle + 0.45), y2 - hl * Math.sin(angle + 0.45));
  ctx.stroke();

  // label
  ctx.fillStyle = color;
  ctx.font = `${clamp(9 * scale, 7, 12)}px "DM Mono",monospace`;
  ctx.fillText(label, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4);
}

function displacementColor(px, pxPerMm){
  const mm = pxPerMm > 0 ? px / pxPerMm : px;
  if(mm < 2) return "#22c55e";
  if(mm < 5) return "#eab308";
  return "#ef4444";
}

export function drawDisplacementVectors(ctx, m1arr, m2arr, zoom, pan, calibration, vectorScale){
  ctx.save();
  const pxPerMm = calibration?.done ? calibration.pxPerMm : 0;
  const scale = Math.sqrt(zoom);
  const vScale = vectorScale || 1;

  const pairs = [];  // { label, type, lenPx, color, from, to }

  // ── Points ──
  m1arr.filter(m => m.type === "point").forEach(m1 => {
    const m2 = m2arr.find(m => m.type === "point" && m.label === m1.label);
    if(!m2) return;
    const vp1 = vpts(m1), vp2 = vpts(m2);
    if(!vp1.length || !vp2.length) return;
    const imgDx = vp2[0].x - vp1[0].x, imgDy = vp2[0].y - vp1[0].y;
    const imgLen = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
    if(imgLen < 0.1) return;
    const p1 = { x: vp1[0].x * zoom + pan.x, y: vp1[0].y * zoom + pan.y };
    const p2raw = { x: vp2[0].x * zoom + pan.x, y: vp2[0].y * zoom + pan.y };
    const dxRaw = p2raw.x - p1.x, dyRaw = p2raw.y - p1.y;
    const p2 = vScale === 1 ? p2raw : { x: p1.x + dxRaw * vScale, y: p1.y + dyRaw * vScale };
    const mmVal = pxPerMm > 0 ? imgLen / pxPerMm : imgLen;
    const color = displacementColor(imgLen, pxPerMm);
    const label = pxPerMm > 0 ? mmVal.toFixed(1) + "mm" : imgLen.toFixed(1) + "px";
    drawDisplacementArrow(ctx, p1.x, p1.y, p2.x, p2.y, imgLen * zoom, scale, color, label);
    pairs.push({ label: m1.label, type: "point", lenPx: imgLen * zoom, color, from: p1, to: p2, labelText: label });
  });

  // ── Lines (endpoints) ──
  m1arr.filter(m => m.type === "line").forEach(m1 => {
    const m2 = m2arr.find(m => m.type === "line" && m.label === m1.label);
    if(!m2) return;
    const pts1 = vpts(m1), pts2 = vpts(m2);
    if(pts1.length < 2 || pts2.length < 2) return;
    for(let i = 0; i < 2; i++){
      const imgDx = pts2[i].x - pts1[i].x, imgDy = pts2[i].y - pts1[i].y;
      const imgLen = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
      if(imgLen < 0.1) continue;
      const p1 = { x: pts1[i].x * zoom + pan.x, y: pts1[i].y * zoom + pan.y };
      const p2raw = { x: pts2[i].x * zoom + pan.x, y: pts2[i].y * zoom + pan.y };
      const dxRaw = p2raw.x - p1.x, dyRaw = p2raw.y - p1.y;
      const p2 = vScale === 1 ? p2raw : { x: p1.x + dxRaw * vScale, y: p1.y + dyRaw * vScale };
      const mmVal = pxPerMm > 0 ? imgLen / pxPerMm : imgLen;
      const color = displacementColor(imgLen, pxPerMm);
      const label = pxPerMm > 0 ? mmVal.toFixed(1) + "mm" : imgLen.toFixed(1) + "px";
      drawDisplacementArrow(ctx, p1.x, p1.y, p2.x, p2.y, imgLen * zoom, scale, color, label);
      pairs.push({ label: m1.label + "[" + i + "]", type: "line", lenPx: imgLen * zoom, color, from: p1, to: p2, labelText: label });
    }
  });

  // ── Angles (angle change) ──
  m1arr.filter(m => m.type === "angle3" || m.type === "angle4").forEach(m1 => {
    const m2 = m2arr.find(m => (m.type === "angle3" || m.type === "angle4") && m.label === m1.label);
    if(!m2) return;
    const pts1 = vpts(m1), pts2 = vpts(m2);
    if(pts1.length < (m1.type === "angle3" ? 3 : 4) || pts2.length < (m2.type === "angle3" ? 3 : 4)) return;
    const a1 = m1.type === "angle3" ? angle3pt(pts1[0], pts1[1], pts1[2]) : angle4pt(pts1[0], pts1[1], pts1[2], pts1[3]);
    const a2 = m1.type === "angle3" ? angle3pt(pts2[0], pts2[1], pts2[2]) : angle4pt(pts2[0], pts2[1], pts2[2], pts2[3]);
    const diff = a2 - a1;
    // draw indicator at vertex
    const ctr = pts1.length >= 2 ? { x: pts1[1].x * zoom + pan.x, y: pts1[1].y * zoom + pan.y } : null;
    if(ctr){
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ctr.x, ctr.y, 12 * scale, Math.min(a1, a2), Math.max(a1, a2));
      ctx.stroke();
      ctx.setLineDash([]);
      const sign = diff >= 0 ? "+" : "";
      ctx.fillStyle = "#a855f7";
      ctx.font = `bold ${clamp(10 * scale, 8, 14)}px "DM Mono",monospace`;
      ctx.fillText(sign + diff.toFixed(1) + "°", ctr.x + 14 * scale, ctr.y - 6 * scale);
    }
    pairs.push({ label: m1.label, type: "angle", lenPx: Math.abs(diff), color: "#a855f7", from: null, to: null, labelText: diff.toFixed(1) + "°" });
  });

  // ── Polygons (vertex displacement) ──
  m1arr.filter(m => m.type === "polygon").forEach(m1 => {
    const m2 = m2arr.find(m => m.type === "polygon" && m.label === m1.label);
    if(!m2) return;
    const pts1 = vpts(m1), pts2 = vpts(m2);
    const n = Math.min(pts1.length, pts2.length);
    for(let i = 0; i < n; i++){
      const p1 = { x: pts1[i].x * zoom + pan.x, y: pts1[i].y * zoom + pan.y };
      const p2 = { x: pts2[i].x * zoom + pan.x, y: pts2[i].y * zoom + pan.y };
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const lenPx = Math.sqrt(dx * dx + dy * dy);
      if(lenPx < 1) continue;
      const color = displacementColor(lenPx, pxPerMm);
      const mmStr = pxPerMm > 0 ? (lenPx / pxPerMm).toFixed(1) + "mm" : "";
      const label = pxPerMm > 0 ? mmStr : lenPx.toFixed(1) + "px";
      drawDisplacementArrow(ctx, p1.x, p1.y, p2.x, p2.y, lenPx, scale, color, label);
      pairs.push({ label: m1.label + "[" + i + "]", type: "polygon", lenPx, color, from: p1, to: p2, labelText: label });
    }
  });

  // ── Stats summary ──
  const mmPairs = pairs.filter(p => p.lenPx > 0 && p.from && p.to);
  if(mmPairs.length > 0 && pxPerMm > 0){
    const mmVals = mmPairs.map(p => p.lenPx / pxPerMm);
    const avgMM = mmVals.reduce((a, b) => a + b, 0) / mmVals.length;
    const maxMM = Math.max(...mmVals);
    const minMM = Math.min(...mmVals);
    const boxW = 180, boxH = 72, boxX = 10, boxY = 10;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 6) : ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.font = `bold 11px "DM Sans",sans-serif`;
    ctx.fillText("⇝ Displacement stats", boxX + 10, boxY + 16);
    ctx.font = `10px "DM Mono",monospace`;
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Mean: " + avgMM.toFixed(1) + "mm", boxX + 10, boxY + 34);
    ctx.fillStyle = "#eab308";
    ctx.fillText("Max: " + maxMM.toFixed(1) + "mm", boxX + 10, boxY + 50);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Min: " + minMM.toFixed(1) + "mm", boxX + 10, boxY + 66);
  } else if(mmPairs.length > 0){
    const avgPx = mmPairs.reduce((s, p) => s + p.lenPx, 0) / mmPairs.length;
    const maxPx = Math.max(...mmPairs.map(p => p.lenPx));
    const minPx = Math.min(...mmPairs.map(p => p.lenPx));
    const boxW = 180, boxH = 72, boxX = 10, boxY = 10;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 6) : ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.font = `bold 11px "DM Sans",sans-serif`;
    ctx.fillText("⇝ Displacement stats", boxX + 10, boxY + 16);
    ctx.font = `10px "DM Mono",monospace`;
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Mean: " + avgPx.toFixed(1) + "px", boxX + 10, boxY + 34);
    ctx.fillStyle = "#eab308";
    ctx.fillText("Max: " + maxPx.toFixed(1) + "px", boxX + 10, boxY + 50);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Min: " + minPx.toFixed(1) + "px", boxX + 10, boxY + 66);
  }

  ctx.restore();
}

function silhouetteHitTest(m, ip, zoom) {
  try {
  const paths = m.paths || SILHOUETTES[m.silhouetteType]?.paths;
  if (!paths) return false;
  const rot = m.rotation || 0;
  const sc = m.scale || 1;
  const pos = m.position || { x: 0, y: 0 };
  const baseSize = 100;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  paths.forEach(path => {
    path.points.forEach(p => {
      const sx = p.x * sc * baseSize;
      const sy = p.y * sc * baseSize;
      const rx = sx * cosR - sy * sinR;
      const ry = sx * sinR + sy * cosR;
      const tx = rx + pos.x;
      const ty = ry + pos.y;
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    });
  });
  const pad = 8 / zoom;
  const topPad = pad + 24 / Math.sqrt(zoom);
  return ip.x >= minX - pad && ip.x <= maxX + pad && ip.y >= minY - topPad && ip.y <= maxY + pad;
  } catch { return false; }
}

export function getSilhouetteHandlesImage(m, zoom = 1) {
  try {
  const paths = m.paths || SILHOUETTES[m.silhouetteType]?.paths;
  if (!paths) return { corners: [], rotCenter: null };
  const rot = m.rotation || 0;
  const sc = m.scale || 1;
  const pos = m.position || { x: 0, y: 0 };
  const baseSize = 100;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  paths.forEach(path => {
    path.points.forEach(p => {
      const sx = p.x * sc * baseSize;
      const sy = p.y * sc * baseSize;
      const rx = sx * cosR - sy * sinR;
      const ry = sx * sinR + sy * cosR;
      const tx = rx + pos.x;
      const ty = ry + pos.y;
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    });
  });
  const pad = 6 / Math.sqrt(zoom);
  const hSize = 6;
  if (!isFinite(minX) || !isFinite(maxX)) return { corners: [], rotCenter: null };
  const corners = [
    { x: minX - pad, y: minY - pad },
    { x: maxX + pad, y: minY - pad },
    { x: minX - pad, y: maxY + pad },
    { x: maxX + pad, y: maxY + pad },
  ];
  const centerX = (minX + maxX) / 2;
  const rotCenter = { x: centerX, y: minY - pad - 18 / Math.sqrt(zoom) };
  return { corners, rotCenter, hSize, bbox: { minX, maxX, minY, maxY } };
  } catch { return { corners: [], rotCenter: null }; }
}

export function hitTest(markups, ip, zoom, reproCollecting){
  const thr = 8 / zoom;
  
  for(let i = markups.length - 1; i >= 0; i--){
    const m = markups[i];
    if(m.visible === false) continue;
    if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) continue;
    if(m.type === "point"){
      const vp = vpts(m);
      if(vp.length && dist(vp[0], ip) < thr + (m.size || 6) / zoom) return m.id;
    }
  }
  
  for(let i = markups.length - 1; i >= 0; i--){
    const m = markups[i];
    if(m.visible === false) continue;
    if(m.type === "point") continue;
    if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) continue;
    
    const vp = vpts(m);
    if((m.type === "line" || m.type === "parallel" || m.type === "ruler") && vp.length >= 2 && distToSeg(ip, vp[0], vp[1]) < thr) return m.id;
    if((m.type === "angle3" || m.type === "angle4") && vp.some(p => dist(p, ip) < thr * 2)) return m.id;
    if((m.type === "polygon" || m.type === "curve" || m.type === "polyline") && vp.length >= 2){
      const isClosed = m.type === "polygon";
      const useSpline = m.curveStyle === "bspline" && vp.length >= 3;
      const segs = useSpline ? sampleCatmullRom(vp, isClosed) : vp;
      const n = isClosed ? segs.length : segs.length - 1;
      for(let j = 0; j < n; j++){
        if(distToSeg(ip, segs[j], segs[(j + 1) % segs.length]) < thr) return m.id;
      }
    }
    if(m.type === "perp" && vp.length >= 2 && distToSeg(ip, vp[0], vp[1]) < thr) return m.id;
    if(m.type === "projDist" && vp.length >= 4 && distToSeg(ip, vp[2], vp[3]) < thr) return m.id;
    if(m.type === "perp" && vp.length >= 3 && dist(vp[2], ip) < thr * 2) return m.id;
    if(m.type === "text" && vp.length && dist(vp[0], ip) < thr * 4) return m.id;
    if(m.type === "silhouette" && silhouetteHitTest(m, ip, zoom)) return m.id;
    if(m.type === "ellipse" && vp.length >= 3){
      const ell = ellipseFromAxes(vp);
      if(ell){ const d = distToEllipse(ip, ell.cx, ell.cy, ell.rx, ell.ry, ell.rotation); if(d !== null && d < thr) return m.id; }
    }
    if(m.type === "arc" && vp.length >= 3){
      const d = distToArc(ip, vp[0], vp[1], vp[2]);
      if(d !== null && d < thr) return m.id;
    }
    if(m.type === "circle" && vp.length >= 2){
      const r = dist(vp[0], vp[1]);
      if(Math.abs(dist(vp[0], ip) - r) < thr) return m.id;
    }
    if(m.type === "bezier" && vp.length >= 2){
      const cp = (m.cp && m.cp.length === 2 * (vp.length - 1)) ? m.cp : autoControlPoints(vp);
      for(let j = 0; j < cp.length; j++){if(dist(ip, cp[j]) < thr * 1.5) return m.id;}
      const d = distToMultiBezier(ip, vp, cp);
      if(d < thr) return m.id;
    }
    if(m.type === "tangent" && vp.length >= 2 && distToSeg(ip, vp[0], vp[1]) < thr) return m.id;
    if(m.type === "concentric" && vp.length >= 3){
      const c = circleFrom3pts(vp[0], vp[1], vp[2]);
      if(c){
        const count = m.count || 4;
        const spacing = m.spacing || 0.3;
        const offsets = m.offsets || Array.from({ length: count }, (_, i) => i * spacing);
        const dCenter = dist(ip, { x: c.cx, y: c.cy });
        const matches = offsets.some(off => Math.abs(dCenter - c.r * (1 + off)) < thr * 2);
        if(matches) return m.id;
      }
    }
  }
  
  return null;
}
