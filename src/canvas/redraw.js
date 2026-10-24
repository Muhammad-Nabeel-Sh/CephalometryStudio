// ═══════════════════════════════════════════════════════════════════════════════
// Canvas redraw pipeline — extracted from App.jsx
// Accepts a "draw context" object bundling all refs, state, and draw helpers.
// ═══════════════════════════════════════════════════════════════════════════════

import { vpts } from "../lib/utils.js";
import { procrustesAlign } from "../research/superimposition.js";

export function createRedraw(dc) {
  return function redraw() {
    const canvas = dc.canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = dc.dprRef.current;
    ctx2d.save();
    ctx2d.scale(dpr, dpr);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const mousePos = dc.mousePosRef.current;
    const snapPos = dc.snapPosRef.current;
    const boxSelectRect = dc.boxSelectRectRef.current;
    const pan = dc.panRef.current;

    const {
      markups, selectedId, selectedIds, sessionImage, calibration, t,
      currentDraw, snapEnabled, showScaleBar, showDefTooltips, showLUT,
      showAnnotations, annotationSize, showDisplacement, compareSession,
      getProcessed, angleMode, facing, lutMode, lutInvert, activeTool,
      displacementOverlay, overlayBlend, overlayAlignMode, overlayVectorScale,
      showTrackingLines, refLandmark1, refLandmark2, showCalib, pendingRuler,
      showGrid, showAirwayOverlay, showCpAlways, showAnchorAlways,
      snapTolerance, autoHideLabels, annotationBold, showGroupsLegend,
    } = dc;
    const zoom = dc.zoomRef.current;

    ctx2d.clearRect(0, 0, W, H);
    ctx2d.fillStyle = t.bg;
    ctx2d.fillRect(0, 0, W, H);

    // ── Empty canvas placeholder ──
    if (sessionImage.length === 0 && markups.length === 0) {
      ctx2d.fillStyle = t.surf;
      ctx2d.fillRect(pan.x, pan.y, 600 * zoom, 500 * zoom);
      ctx2d.strokeStyle = t.bdr;
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(pan.x, pan.y, 600 * zoom, 500 * zoom);
      ctx2d.fillStyle = t.tx3;
      ctx2d.font = '15px "DM Sans",sans-serif';
      ctx2d.textAlign = "center";
      ctx2d.fillText("Drop or open a cephalogram image", pan.x + 300 * zoom, pan.y + 240 * zoom);
      ctx2d.fillText("Open Image  •  drag & drop", pan.x + 300 * zoom, pan.y + 265 * zoom);
      ctx2d.textAlign = "left";
    } else {
      // ── Draw images ──
      sessionImage.forEach(imgE => {
        if (!imgE.visible) return;
        const src = getProcessed(imgE) || dc.imgRefs.current[imgE.id];
        if (!src) return;
        const tf = imgE.transform || { tx: 0, ty: 0, rot: 0, scale: 1 };
        const nw = src.naturalWidth || src.width || 600;
        const nh = src.naturalHeight || src.height || 500;
        ctx2d.save();
        ctx2d.globalAlpha = imgE.opacity ?? 1;
        ctx2d.globalCompositeOperation = imgE.blendMode || "normal";
        ctx2d.translate(pan.x + (imgE.dx || 0) * zoom, pan.y + (imgE.dy || 0) * zoom);
        ctx2d.translate((nw / 2 + tf.tx) * zoom, (nh / 2 + tf.ty) * zoom);
        ctx2d.rotate(tf.rot || 0);
        ctx2d.scale((tf.scale || 1) * zoom, (tf.scale || 1) * zoom);
        ctx2d.drawImage(src, -nw / 2, -nh / 2);
        if (imgE.color && imgE.color !== "none") {
          ctx2d.globalCompositeOperation = "color";
          ctx2d.fillStyle = imgE.color + "77";
          ctx2d.fillRect(-nw / 2, -nh / 2, nw, nh);
        }
        ctx2d.restore();
      });
    }

    const drawMarkups = markups;
    const drawCalibration = calibration;

    // ── Overlay: compare session aligned ──
    if (displacementOverlay && compareSession) {
      ctx2d.save();
      ctx2d.globalAlpha = overlayBlend;
      const compMarkups = compareSession.markups || [];
      let tf = null;
      if (overlayAlignMode === "procrustes") {
        const srcPts = [], dstPts = [];
        const seen = new Set();
        compMarkups.forEach(m => {
          if (m.type !== "point" || !m.label || seen.has(m.label)) return;
          seen.add(m.label);
          const match = markups.find(o => o.type === "point" && o.label === m.label);
          if (match && match.points[0] && m.points[0]) {
            dstPts.push(m.points[0]);
            srcPts.push(match.points[0]);
          }
        });
        if (srcPts.length >= 2) tf = procrustesAlign(dstPts, srcPts);
      } else if (overlayAlignMode === "2pt" && refLandmark1 && refLandmark2) {
        const p1a = vpts(markups.find(m => m.type === "point" && m.label === refLandmark1) || {});
        const p1b = vpts(markups.find(m => m.type === "point" && m.label === refLandmark2) || {});
        const p2a = vpts(compMarkups.find(m => m.type === "point" && m.label === refLandmark1) || {});
        const p2b = vpts(compMarkups.find(m => m.type === "point" && m.label === refLandmark2) || {});
        if (p1a.length && p1b.length && p2a.length && p2b.length) tf = dc.alignTwoPoints(p2a[0], p2b[0], p1a[0], p1b[0]);
      }
      if (tf && !tf.error) {
        ctx2d.translate(pan.x, pan.y);
        ctx2d.scale(zoom, zoom);
        ctx2d.translate(tf.tx, tf.ty);
        ctx2d.rotate(tf.rot);
        ctx2d.scale(tf.scale, tf.scale);
        compMarkups.forEach(m => dc.drawMarkup(ctx2d, m, 1, { x: 0, y: 0 }, drawCalibration, null, t, false, dc.canvasSize.current, angleMode, false, annotationSize, null));
      } else {
        compMarkups.forEach(m => dc.drawMarkup(ctx2d, m, zoom, pan, drawCalibration, null, t, false, dc.canvasSize.current, angleMode, false, annotationSize, null));
      }
      ctx2d.restore();
    }

    // ── Pre/post airway overlay ──
    if (showAirwayOverlay && compareSession) {
      dc.drawAirwayOverlay(ctx2d, compareSession.markups || [], zoom, pan, drawCalibration, "orange", t);
    }

    // ── Draw all markups ──
        drawMarkups.forEach(m => dc.drawMarkup(ctx2d, m, zoom, pan, drawCalibration, selectedId, t, false, dc.canvasSize.current, angleMode, showAnnotations, annotationSize, dc.hoveredPtRef.current, { showCpAlways, showAnchorAlways, autoHideLabels, annotationBold, facing }));

    // ── Calibration ruler highlight ──
    if (showCalib && pendingRuler) {
      const rp = drawMarkups.find(m => m.id === pendingRuler.id);
      if (rp) {
        const vp = vpts(rp);
        if (vp.length >= 2) {
          const sp0 = { x: vp[0].x * zoom + pan.x, y: vp[0].y * zoom + pan.y };
          const sp1 = { x: vp[1].x * zoom + pan.x, y: vp[1].y * zoom + pan.y };
          const now = Date.now(), pulse = 0.5 + 0.5 * Math.sin(now / 200);
          ctx2d.save();
          ctx2d.strokeStyle = `rgba(255,215,0,${0.4 + 0.4 * pulse})`;
          ctx2d.lineWidth = 4;
          ctx2d.setLineDash([8, 4]);
          ctx2d.beginPath();
          ctx2d.moveTo(sp0.x, sp0.y);
          ctx2d.lineTo(sp1.x, sp1.y);
          ctx2d.stroke();
          ctx2d.setLineDash([]);
          ctx2d.restore();
          const mx = (sp0.x + sp1.x) / 2, my = (sp0.y + sp1.y) / 2;
          ctx2d.save();
          ctx2d.fillStyle = `rgba(255,215,0,${0.7 + 0.3 * pulse})`;
          ctx2d.font = "bold 11px 'DM Sans',sans-serif";
          ctx2d.textAlign = "center";
          ctx2d.fillText("Calibration ruler", mx, my - 10);
          ctx2d.restore();
        }
      }
    }

    // ── Displacement vectors ──
    if (showDisplacement) {
      if (!compareSession) {
        ctx2d.fillStyle = "rgba(0,0,0,0.6)";
        ctx2d.fillRect(8, 8, 220, 36);
        ctx2d.fillStyle = "#ffd700";
        ctx2d.font = "bold 12px 'DM Sans',sans-serif";
        ctx2d.fillText("\u21DD Select a compare version in Versions panel", 16, 28);
      } else {
        dc.drawDisplacementVectors(ctx2d, drawMarkups, compareSession.markups || [], zoom, pan, drawCalibration, overlayVectorScale);
      }
      if (compareSession && activeTool === "select") {
        const mPos = dc.mouseCanvasRef.current;
        const compMarkups = compareSession.markups || [];
        const pxPerMm = drawCalibration?.done ? drawCalibration.pxPerMm : 0;
        let hoveredDisp = null;
        drawMarkups.filter(m => m.type === "point").forEach(m1 => {
          if (hoveredDisp) return;
          const m2 = compMarkups.find(m => m.type === "point" && m.label === m1.label);
          if (!m2) return;
          const vp1 = vpts(m1), vp2 = vpts(m2);
          if (!vp1.length || !vp2.length) return;
          const sx1 = vp1[0].x * zoom + pan.x, sy1 = vp1[0].y * zoom + pan.y;
          const sx2 = vp2[0].x * zoom + pan.x, sy2 = vp2[0].y * zoom + pan.y;
          const midX = (sx1 + sx2) / 2, midY = (sy1 + sy2) / 2;
          const dMid = Math.sqrt((mPos.x - midX) ** 2 + (mPos.y - midY) ** 2);
          const imgDx = vp2[0].x - vp1[0].x, imgDy = vp2[0].y - vp1[0].y;
          const imgLen = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
          if (dMid < Math.max(18, imgLen * zoom * 0.5)) {
            const lenMm = pxPerMm > 0 ? imgLen / pxPerMm : null;
            const dxMm = pxPerMm > 0 ? imgDx / pxPerMm : imgDx;
            const dyMm = pxPerMm > 0 ? (-imgDy) / pxPerMm : -imgDy;
            hoveredDisp = { label: m1.label, lenMm, dxMm, dyMm, midX, midY };
          }
        });
        if (hoveredDisp) {
          const tipX = hoveredDisp.midX + 14, tipY = hoveredDisp.midY - 12;
          const lines = [hoveredDisp.label];
          if (hoveredDisp.lenMm != null) lines.push(`${hoveredDisp.lenMm.toFixed(2)} mm`);
          lines.push(`A/P: ${hoveredDisp.dxMm >= 0 ? "+" : ""}${hoveredDisp.dxMm.toFixed(1)}  S/I: ${hoveredDisp.dyMm >= 0 ? "+" : ""}${hoveredDisp.dyMm.toFixed(1)}`);
          ctx2d.save();
          ctx2d.shadowColor = "rgba(0,0,0,0.4)";
          ctx2d.shadowBlur = 8;
          ctx2d.shadowOffsetY = 2;
          ctx2d.font = '11px "DM Mono",monospace';
          const tipW = Math.max(...lines.map(l => ctx2d.measureText(l).width)) + 16;
          const tipH = 14 + lines.length * 14;
          let tx = tipX, ty = tipY;
          const W2 = dc.canvasSize.current?.w || 800, H2 = dc.canvasSize.current?.h || 600;
          if (tx + tipW > W2 - 8) tx = hoveredDisp.midX - tipW - 14;
          if (ty + tipH > H2 - 8) ty = H2 - tipH - 8;
          if (ty < 8) ty = 8;
          ctx2d.fillStyle = t.surf2;
          ctx2d.beginPath();
          ctx2d.roundRect(tx, ty, tipW, tipH, 6);
          ctx2d.fill();
          ctx2d.shadowColor = "transparent";
          ctx2d.shadowBlur = 0;
          ctx2d.shadowOffsetY = 0;
          ctx2d.fillStyle = t.acc;
          ctx2d.beginPath();
          ctx2d.roundRect(tx, ty, tipW, 3, { upperLeft: 6, upperRight: 6 });
          ctx2d.fill();
          ctx2d.fillStyle = t.tx;
          ctx2d.font = 'bold 10px "DM Mono",monospace';
          ctx2d.fillText(lines[0], tx + 8, ty + 14);
          ctx2d.fillStyle = t.tx2;
          ctx2d.font = '9px "DM Mono",monospace';
          lines.slice(1).forEach((l, i) => ctx2d.fillText(l, tx + 8, ty + 28 + i * 14));
          ctx2d.restore();
        }
      }
    }

    // ── Tracking lines ──
    if (showTrackingLines && compareSession) {
      ctx2d.save();
      ctx2d.setLineDash([4, 4]);
      ctx2d.lineWidth = 1;
      ctx2d.strokeStyle = "rgba(168,85,247,0.45)";
      const compMarkups = compareSession.markups || [];
      drawMarkups.filter(m => m.type === "point").forEach(m1 => {
        const m2 = compMarkups.find(m => m.type === "point" && m.label === m1.label);
        if (!m2) return;
        const vp1 = vpts(m1), vp2 = vpts(m2);
        if (!vp1.length || !vp2.length) return;
        const sp1 = { x: vp1[0].x * zoom + pan.x, y: vp1[0].y * zoom + pan.y };
        const sp2 = { x: vp2[0].x * zoom + pan.x, y: vp2[0].y * zoom + pan.y };
        ctx2d.beginPath();
        ctx2d.moveTo(sp1.x, sp1.y);
        ctx2d.lineTo(sp2.x, sp2.y);
        ctx2d.stroke();
      });
      ctx2d.setLineDash([]);
      ctx2d.restore();
    }

    // ── Airway overlay (base session) ──
    if (showAirwayOverlay) dc.drawAirwayOverlay(ctx2d, drawMarkups, zoom, pan, drawCalibration, undefined, t);

    // ── Definition tooltip ──
    if (showDefTooltips && dc.hoveredPtRef.current?.type === "point" && activeTool === "select") {
      const hp = drawMarkups.find(m => m.id === dc.hoveredPtRef.current.mid);
      if (hp && hp.definition) {
        const vp = vpts(hp);
        if (vp.length) {
          const sp = { x: vp[0].x * zoom + pan.x, y: vp[0].y * zoom + pan.y };
          const tipW = Math.max(120, Math.min(340, W - sp.x - 20));
          ctx2d.font = '11px "DM Sans",sans-serif';
          const lines = [];
          let line = "";
          for (const word of hp.definition.split(" ")) {
            const test = line ? line + " " + word : word;
            if (ctx2d.measureText(test).width > tipW - 24 && line) { lines.push(line); line = word; } else line = test;
          }
          if (line) lines.push(line);
          const tipH = Math.max(54, 38 + lines.length * 18);
          let tx = sp.x + 14, ty = sp.y - 10;
          if (tx + tipW > W - 8) tx = sp.x - tipW - 14;
          if (ty + tipH > H - 8) ty = H - tipH - 8;
          if (ty < 8) ty = 8;
          ctx2d.save();
          ctx2d.shadowColor = "rgba(0,0,0,0.4)";
          ctx2d.shadowBlur = 10;
          ctx2d.shadowOffsetY = 2;
          ctx2d.fillStyle = t.surf2;
          ctx2d.beginPath();
          ctx2d.roundRect(tx, ty, tipW, tipH, 8);
          ctx2d.fill();
          ctx2d.shadowColor = "transparent";
          ctx2d.shadowBlur = 0;
          ctx2d.shadowOffsetY = 0;
          ctx2d.fillStyle = t.acc;
          ctx2d.beginPath();
          ctx2d.roundRect(tx, ty, tipW, 3, { upperLeft: 8, upperRight: 8 });
          ctx2d.fill();
          ctx2d.fillStyle = t.tx;
          ctx2d.font = 'bold 12px "DM Sans",sans-serif';
          ctx2d.fillText(hp.label, tx + 12, ty + 20);
          ctx2d.fillStyle = t.tx2;
          ctx2d.font = '11px "DM Sans",sans-serif';
          lines.forEach((l, i) => ctx2d.fillText(l, tx + 12, ty + 38 + i * 16));
          ctx2d.restore();
        }
      }
    }

    // ── Drawing in progress ──
    if (currentDraw) dc.drawInProgress(ctx2d, currentDraw, mousePos, zoom, pan, t);

    // ── Snap indicator ──
    if ((snapEnabled.points || snapEnabled.lines) && snapPos) {
      const _mouseImg = { x: (mousePos.x - pan.x) / zoom, y: (mousePos.y - pan.y) / zoom };
      dc.drawSnapIndicator(ctx2d, snapPos, zoom, pan, drawMarkups, _mouseImg, snapTolerance / zoom, snapEnabled);
    }

    // ── Box select rectangle ──
    if (boxSelectRect) {
      const { x1, y1, x2, y2 } = boxSelectRect;
      ctx2d.save();
      ctx2d.strokeStyle = t.acc;
      ctx2d.lineWidth = 1.5 / zoom;
      ctx2d.setLineDash([4 / zoom, 4 / zoom]);
      ctx2d.strokeRect(x1 * zoom + pan.x, y1 * zoom + pan.y, (x2 - x1) * zoom, (y2 - y1) * zoom);
      ctx2d.fillStyle = t.acc + "22";
      ctx2d.fillRect(x1 * zoom + pan.x, y1 * zoom + pan.y, (x2 - x1) * zoom, (y2 - y1) * zoom);
      ctx2d.setLineDash([]);
      ctx2d.restore();
    }

    // ── Multi-select bounding box ──
    if (selectedIds.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedIds.forEach(id => {
        const m = markups.find(x => x.id === id);
        if (!m || m.visible === false) return;
        let pts = [];
        if (m.type === "silhouette") {
          const pos = m.position || { x: 0, y: 0 };
          if (pos.x > -9000) pts.push(pos);
          const paths = m.paths || dc.silhouettes[m.silhouetteType]?.paths;
          if (paths) {
            const rot = m.rotation || 0; const sc = m.scale || 1; const baseSize = 100;
            const cosR = Math.cos(rot); const sinR = Math.sin(rot);
            paths.forEach(path => { path.points.forEach(p => {
              const sx = p.x * sc * baseSize; const sy = p.y * sc * baseSize;
              pts.push({ x: sx * cosR - sy * sinR + pos.x, y: sx * sinR + sy * cosR + pos.y });
            }); });
          }
        } else { pts = vpts(m); }
        pts.forEach(p => {
          if (p.x > -9000) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
        });
      });
      if (isFinite(minX)) {
        ctx2d.save();
        const bx = minX * zoom + pan.x, by = minY * zoom + pan.y, bw = (maxX - minX) * zoom, bh = (maxY - minY) * zoom;
        const pad = 4 / zoom;
        ctx2d.strokeStyle = t.acc;
        ctx2d.lineWidth = 1.5 / zoom;
        ctx2d.setLineDash([5 / zoom, 4 / zoom]);
        ctx2d.strokeRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
        ctx2d.setLineDash([]);
        const hs = 6 / zoom;
        const hc = [[bx - pad, by - pad], [bx + bw + pad, by - pad], [bx - pad, by + bh + pad], [bx + bw + pad, by + bh + pad]];
        hc.forEach(([cx, cy]) => {
          ctx2d.fillStyle = t.surf;
          ctx2d.strokeStyle = t.acc;
          ctx2d.lineWidth = 1 / zoom;
          ctx2d.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
          ctx2d.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
        });
        ctx2d.restore();
      }
    }

    // ── Grid overlay ──
    if (showGrid) {
      ctx2d.save();
      ctx2d.strokeStyle = t.bdr + "33";
      ctx2d.lineWidth = 0.5 / zoom;
      const gs = 50 / zoom;
      const ox = pan.x % gs, oy = pan.y % gs;
      for (let gx = -ox; gx < W; gx += gs) { ctx2d.beginPath(); ctx2d.moveTo(gx, 0); ctx2d.lineTo(gx, H); ctx2d.stroke(); }
      for (let gy = -oy; gy < H; gy += gs) { ctx2d.beginPath(); ctx2d.moveTo(0, gy); ctx2d.lineTo(W, gy); ctx2d.stroke(); }
      ctx2d.restore();
    }

    if (showScaleBar) dc.drawScaleBar(ctx2d, zoom, drawCalibration, W, H);

    // ── Flash highlight ──
    if (dc.flashMarkupIdRef.current) {
      const _fm = markups.find(m => m.id === dc.flashMarkupIdRef.current);
      if (_fm) {
        const _fp = vpts(_fm);
        if (_fp.length) {
          const _fcx = _fp.reduce((s, p) => s + p.x, 0) / _fp.length, _fcy = _fp.reduce((s, p) => s + p.y, 0) / _fp.length;
          const _el = (performance.now() - dc.flashStartTimeRef.current) / 1500;
          const _op = 0.7 * (1 - _el), _sc = 1 + _el * 0.5;
          const _sx = _fcx * zoom + pan.x, _sy = _fcy * zoom + pan.y, _br = Math.max(20, 5 * Math.sqrt(zoom)) * _sc;
          ctx2d.save();
          ctx2d.strokeStyle = `rgba(255,215,0,${_op})`;
          ctx2d.lineWidth = 3 * Math.sqrt(zoom);
          for (let _i = 0; _i < 2; _i++) { const _r = _br + _i * 8 * Math.sqrt(zoom) * _sc; ctx2d.beginPath(); ctx2d.arc(_sx, _sy, _r, 0, Math.PI * 2); ctx2d.stroke(); }
          ctx2d.restore();
        }
      }
    }

    if (showLUT) dc.drawLUTLegend(ctx2d, lutMode, lutInvert, W, H, t);

    // ── Groups legend ──
    if (showGroupsLegend) drawGroupsLegend(ctx2d, markups, t, W, H);

    // ── Coordinate readout ──
    if (mousePos) {
      const ip = { x: (mousePos.x - pan.x) / zoom, y: (mousePos.y - pan.y) / zoom };
      const coordTxt = `${ip.x.toFixed(1)}, ${ip.y.toFixed(1)} px${calibration.done ? ` · (${(ip.x / calibration.pxPerMm).toFixed(1)}, ${(ip.y / calibration.pxPerMm).toFixed(1)} mm)` : ""}`;
      ctx2d.font = '11px "DM Mono",monospace';
      const tw = ctx2d.measureText(coordTxt).width;
      ctx2d.fillStyle = t.surf + "ee";
      ctx2d.strokeStyle = t.bdr;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.roundRect(22, H - 30, tw + 16, 22, 6);
      ctx2d.fill();
      ctx2d.stroke();
      ctx2d.fillStyle = t.tx2;
      ctx2d.fillText(coordTxt, 30, H - 14);
    }

    ctx2d.restore(); // end DPR scale
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Groups legend — drawn on the main canvas when the markup settings toggle is on.
// Derives { id, color, count } from the optional `group` field on point markups.
// ────────────────────────────────────────────────────────────────────────────────
export function drawGroupsLegend(ctx, markups, t, W, H) {
  const map = new Map();
  for (const m of markups) {
    if (m.type !== "point" || !m.group) continue;
    const g = map.get(m.group) || { id: m.group, color: m.color || t.acc, count: 0 };
    g.count++;
    map.set(m.group, g);
  }
  const groups = [...map.values()];
  if (!groups.length) return;

  const padX = 10, rowH = 18, headH = 20;
  const font = '11px "DM Sans",sans-serif';
  const countFont = '10px "DM Mono",monospace';
  ctx.save();
  ctx.font = font;
  let w = 90;
  for (const g of groups) {
    ctx.font = countFont;
    const cw = ctx.measureText(String(g.count)).width;
    ctx.font = font;
    w = Math.max(w, 28 + ctx.measureText(g.id).width + cw + 12);
  }
  w = Math.min(w, W - 24);
  const maxRows = Math.max(1, Math.floor((H - 18) / rowH));
  const rows = groups.slice(0, maxRows);
  const h = headH + rows.length * rowH + 6;
  const x = padX, y = padX;

  ctx.fillStyle = t.surf + "e6";
  ctx.strokeStyle = t.bdr;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = t.tx3;
  ctx.font = 'bold 8px "DM Sans",sans-serif';
  ctx.fillText("GROUPS", x + 10, y + 14);

  ctx.font = font;
  rows.forEach((g, i) => {
    const ry = y + headH + i * rowH;
    ctx.fillStyle = g.color;
    ctx.fillRect(x + 10, ry + 2, 12, 12);
    ctx.strokeStyle = t.bdr;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10, ry + 2, 12, 12);
    ctx.fillStyle = t.tx;
    ctx.fillText(g.id, x + 28, ry + 13);
    ctx.font = countFont;
    ctx.fillStyle = t.tx3;
    const cw = ctx.measureText(String(g.count)).width;
    ctx.fillText(String(g.count), x + w - 10 - cw, ry + 13);
    ctx.font = font;
  });
  ctx.restore();
}
