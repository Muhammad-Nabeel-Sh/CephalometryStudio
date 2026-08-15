import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);

// ─── Color palette (light theme for print) ────────────────────────────────────
const C = {
  bg: "#ffffff",
  surf: "#f4f6f9",
  surf2: "#e8ecf3",
  surf3: "#dcdfe7",
  bdr: "#c5cad5",
  tx: "#1a1d26",
  tx2: "#5a6278",
  tx3: "#8b93a8",
  acc: "#2563eb",
  acc2: "#a855f7",
  ok: "#16a34a",
  warn: "#d97706",
  err: "#dc2626",
  txhd: "#ffffff",
  dark: "#2d223e",
  dark2: "#252530",
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const BODY_W = PAGE_W - MARGIN * 2;
const BOTTOM_SAFE = PAGE_H - 10;

const LOGO_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 405 405" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;"><g><path d="M71.346,200.513c0,-137.5 258.333,-137.5 258.333,0" style="fill:none;fill-rule:nonzero;stroke:#06d375;stroke-width:14.58px;"/><path d="M200.513,108.846l0,108.333" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-opacity:0.47;stroke-width:6.18px;stroke-linecap:butt;stroke-dasharray:12.362,12.362;"/><path d="M371.133,81.725l-164.881,128.456" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-opacity:0.47;stroke-width:6.62px;stroke-linecap:butt;stroke-dasharray:13.25,13.25;"/><circle cx="200.513" cy="217.18" r="25" style="fill:none;stroke:#727ef8;stroke-width:6.25px;stroke-linecap:butt;"/><circle cx="200.513" cy="108.846" r="25" style="fill:#0d1117;stroke:#f59e0b;stroke-width:10.42px;stroke-linecap:butt;"/><circle cx="200.513" cy="108.846" r="12.5" style="fill:#f56644;"/><circle cx="67.18" cy="200.513" r="18.75" style="fill:#0d1117;stroke:#dc11e8;stroke-width:8.33px;stroke-linecap:butt;"/><circle cx="67.18" cy="200.513" r="8.333" style="fill:#a855f7;"/><path d="M227.511,140.194c40.051,-0.901 64.362,17.813 72.932,56.152" style="fill:none;fill-rule:nonzero;stroke:#b95bae;stroke-width:7.5px;"/></g></svg>`;

// ─── Utilities ───────────────────────────────────────────────────────────────
function fmtAngle(v) { return v != null ? v.toFixed(1) + "\u00b0" : "\u2014"; }
function fmtMm(v, unit) { return v != null ? v.toFixed(2) + " " + (unit || "mm") : "\u2014"; }
function fmtP(p) {
  if (p == null) return "\u2014";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
function sevColor(sd) {
  const a = Math.abs(sd);
  return a <= 1 ? C.ok : a <= 2 ? C.warn : C.err;
}

// ─── Page background ─────────────────────────────────────────────────────────
function darkBg(doc) {
  doc.setFillColor(C.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H - 12, "F");
}

// ─── Page footer (bar + page number, every page except cover) ──────────────
function pageFooter(doc) {
  var n = doc.internal.getNumberOfPages() - 1;
  doc.setFillColor(C.dark2);
  doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(C.txhd);
  doc.text("Page " + n, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
}

// ─── Page header (logo + app name + top line) ──────────────────────────────
function pageHeader(doc) {
  doc.setFillColor(C.acc);
  doc.rect(0, 0, PAGE_W, 2.5, "F");
  if (doc._logoPng) {
    try { doc.addImage(doc._logoPng, "PNG", MARGIN, 3.2, 5, 5); } catch { /* ignore */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.tx);
    doc.text("Cephalometry Studio", MARGIN + 7, 6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C.tx3);
    doc.text("Cephalometric Analysis Report", MARGIN + 36, 6.5);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.acc);
    doc.text("Cephalometry Studio", MARGIN, 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C.tx3);
    doc.text("Cephalometric Analysis Report", MARGIN + 30, 6);
  }
}

// ─── SVG → PNG conversion ────────────────────────────────────────────────────
function svgToPng(svg, svgW) {
  return new Promise((resolve) => {
    const hMatch = svg.match(/viewBox="[^"]* (\d+)"/) || svg.match(/height="(\d+)"/);
    const svgH = parseInt(hMatch?.[1] || "400");
    const scale = 3;
    const cw = svgW * scale;
    const ch = Math.round(cw * svgH / svgW);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL("image/png", 0.95));
    };
    img.onerror = () => resolve(null);
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  });
}

// ─── SVG chart generators ────────────────────────────────────────────────────

function genNormogramChart(rows, w) {
  const LB = 180, CL = 44, CR = 44, TOP = 32, RH = 30, SD_R = 2.5;
  const cw = w - LB - CL - CR;
  const cx = (sd) => LB + CL + cw / 2 + sd * (cw / 2 / SD_R);
  const totalH = TOP + rows.length * RH + 20;
  const clamped = rows.map(r => ({ ...r, sd: Math.max(-SD_R, Math.min(SD_R, r.dev.sdUnits)) }));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${totalH}" style="font-family:'DM Sans','DM Mono',sans-serif">
    <rect fill="${C.bg}" width="${w}" height="${totalH}"/>
    <rect x="${LB}" y="${TOP}" width="${w - LB - CR}" height="${rows.length * RH}" fill="${C.surf}" rx="4"/>
    <rect x="${cx(-1)}" y="${TOP}" width="${cx(1)-cx(-1)}" height="${rows.length*RH}" fill="${C.ok}18"/>
    <rect x="${cx(-2)}" y="${TOP}" width="${cx(-1)-cx(-2)}" height="${rows.length*RH}" fill="${C.warn}12"/>
    <rect x="${cx(1)}" y="${TOP}" width="${cx(2)-cx(1)}" height="${rows.length*RH}" fill="${C.warn}12"/>
    <rect x="${cx(-SD_R)}" y="${TOP}" width="${cx(-2)-cx(-SD_R)}" height="${rows.length*RH}" fill="${C.err}10"/>
    <rect x="${cx(2)}" y="${TOP}" width="${cx(SD_R)-cx(2)}" height="${rows.length*RH}" fill="${C.err}10"/>
    <line x1="${cx(0)}" y1="${TOP-4}" x2="${cx(0)}" y2="${TOP+rows.length*RH+4}" stroke="${C.tx3}" stroke-width="0.5" stroke-dasharray="3,3"/>`;

  [-2, -1, 1, 2].forEach(s => { svg += `<line x1="${cx(s)}" y1="${TOP-4}" x2="${cx(s)}" y2="${TOP+rows.length*RH+4}" stroke="${C.bdr}" stroke-width="0.5"/>`; });
  [-2, -1, 0, 1, 2].forEach(s => {
    svg += `<text x="${cx(s)}" y="${TOP-10}" text-anchor="middle" fill="${C.tx3}" font-size="9" font-family="'DM Mono',monospace">${s===0?"\u03bc":s>0?"+"+s+"\u03c3":s+"\u03c3"}</text>`;
  });
  rows.forEach((_, i) => {
    svg += `<line x1="${LB-4}" y1="${TOP+i*RH}" x2="${w-CR+4}" y2="${TOP+i*RH}" stroke="${C.bdr}" stroke-width="0.5" opacity="0.4"/>`;
  });

  const poly = clamped.map((r, i) => `${cx(r.sd)},${TOP+i*RH+RH/2}`).join(" ");
  clamped.forEach((r, i) => {
    const xc = cx(r.sd), yc = TOP + i * RH + RH / 2;
    const col = sevColor(r.dev.sdUnits);
    const lbl = (r.label || "").length > 14 ? r.label.slice(0, 12) + "\u2026" : r.label;
    const vs = (r.measureType === "angle" ? fmtAngle(r.value) : fmtMm(r.value, r.unit));
    svg += `<text x="${LB-8}" y="${yc+1}" text-anchor="end" dominant-baseline="middle" fill="${C.tx}" font-size="10" font-weight="600" font-family="'DM Mono',monospace">${lbl}</text>`;
    svg += `<circle cx="${xc}" cy="${yc}" r="4.5" fill="${col}" stroke="${C.bg}" stroke-width="1.5"/>`;
    svg += `<text x="${xc+9}" y="${yc+1}" dominant-baseline="middle" fill="${col}" font-size="9" font-weight="700" font-family="'DM Mono',monospace">${vs}</text>`;
  });
  svg += `<polyline points="${poly}" fill="none" stroke="${C.acc}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>`;
  svg += `</svg>`;
  return svg;
}

function genRadarChart(rows) {
  const n = rows.length;
  if (!n) return "";
  const CX = 280, CY = 200, R = 140, LR = R + 22, SD_R = 2.5;
  const H = 420;
  const pts = rows.map((r, i) => {
    const a = 2 * Math.PI * i / n - Math.PI / 2;
    const sd = Math.max(-SD_R, Math.min(SD_R, r.dev.sdUnits));
    const rad = R * (sd + SD_R) / (2 * SD_R);
    return { ...r, a, sd, rad, x: CX + rad * Math.cos(a), y: CY + rad * Math.sin(a) };
  });

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 ${H}" style="font-family:'DM Sans','DM Mono',sans-serif">
    <rect fill="${C.bg}" width="560" height="${H}"/>
    <text x="${CX}" y="18" text-anchor="middle" fill="${C.tx2}" font-size="12" font-weight="700" font-family="'Syne',sans-serif">Radar Normogram \u2014 Z-score Pattern</text>`;

  [-2, -1, 1, 2].forEach(s => {
    const r = R * (s + SD_R) / (2 * SD_R);
    svg += `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${s===0?C.tx3:C.bdr}" stroke-width="${s===0?0.5:0.3}" stroke-dasharray="${s===0?'3,3':'2,3'}" opacity="0.5"/>`;
    svg += `<text x="${CX+4}" y="${CY-r-4}" fill="${C.tx3}" font-size="8" font-family="'DM Mono',monospace" opacity="0.6">${s>0?"+"+s+"\u03c3":s+"\u03c3"}</text>`;
  });
  pts.forEach(p => { svg += `<line x1="${CX}" y1="${CY}" x2="${p.x}" y2="${p.y}" stroke="${C.bdr}" stroke-width="0.5" opacity="0.15"/>`; });
  svg += `<polygon points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}" fill="${C.acc}18" stroke="${C.acc}" stroke-width="1.5" stroke-linejoin="round"/>`;
  pts.forEach(p => {
    const lx = CX + LR * Math.cos(p.a), ly = CY + LR * Math.sin(p.a);
    const anc = lx > CX + 5 ? "start" : lx < CX - 5 ? "end" : "middle";
    svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${sevColor(p.dev.sdUnits)}" stroke="${C.bg}" stroke-width="1.5"/>`;
    svg += `<text x="${lx}" y="${ly+1}" text-anchor="${anc}" dominant-baseline="middle" fill="${C.tx}" font-size="7" font-weight="600" font-family="'DM Mono',monospace">${p.label}</text>`;
  });
  svg += `</svg>`;
  return svg;
}
// ─── Section builders ────────────────────────────────────────────────────────

function buildCover(doc, project, session) {
  darkBg(doc);

  // Large accent block at top
  doc.setFillColor(C.dark2);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Decorative side bar
  doc.setFillColor(C.acc2);
  doc.rect(0, 0, 8, PAGE_H, "F");

  // Logo
  if (doc._logoPng) {
    try { doc.addImage(doc._logoPng, "PNG", PAGE_W - MARGIN - 54, 240, 54, 54); } catch { /* ignore */ }
  }

  // Title area
  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.setTextColor(C.txhd);
  const titleX = doc._logoPng ? MARGIN + 10 : MARGIN;
  doc.text("Cephalometric", titleX, 45);
  doc.text("Analysis Report", titleX, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(C.txhd);
  doc.text(project.name || "Untitled Case", titleX, 96);

  // Separator
  doc.setDrawColor(C.bdr);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 106, PAGE_W - MARGIN, 106);

  // Patient info in a structured layout
  const meta = project.meta || {};
  const leftCol = [
    ["Patient ID", meta.patientId],
    ["Name", meta.name],
    ["Age", meta.age],
    ["Gender", meta.gender],
  ];
  const rightCol = [
    ["Projection", project.projection],
    ["Session", session?.name],
    ["Date", new Date(project.modified || Date.now()).toLocaleDateString()],
    ["Report Generated", new Date().toLocaleString()],
  ];

  let y = 122;
  doc.setFontSize(9);
  doc.setTextColor(C.txhd);
  doc.text("PATIENT INFORMATION", MARGIN, y);
  y += 8;

  const colW = (BODY_W - 20) / 2;
  leftCol.forEach(([l, v]) => {
    doc.setFontSize(9);
    doc.setTextColor(C.txhd);
    doc.text(l, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(C.txhd);
    doc.text(v || "\u2014", MARGIN + 34, y);
    doc.setFont("helvetica", "normal");
    y += 7;
  });

  y = 122 + 8;
  rightCol.forEach(([l, v]) => {
    doc.setFontSize(9);
    doc.setTextColor(C.txhd);
    doc.text(l, MARGIN + colW + 10, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(C.txhd);
    doc.text(v || "\u2014", MARGIN + colW + 10 + 34, y);
    doc.setFont("helvetica", "normal");
    y += 7;
  });

  // Disclaimer footer
  doc.setFillColor(C.dark2);
  doc.rect(0, PAGE_H - 22, PAGE_W, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(C.txhd);
  doc.text("RESEARCH & EDUCATIONAL USE ONLY", MARGIN, PAGE_H - 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor("#ffffffbb");
  doc.text("Cephalometry Studio is intended for research and educational purposes only. It is not approved or cleared for ", MARGIN, PAGE_H - 9);
  doc.text("clinical diagnosis or treatment planning. Clinical decisions should not be made solely on the basis of these measurements.", MARGIN, PAGE_H - 4);
}

function getImageDimensions(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function buildImages(doc, origDataUrl, markupDataUrl) {
  if (!origDataUrl && !markupDataUrl) return;

  // ── Original image (large, ~85% of page) ──
  if (origDataUrl) {
    doc.addPage();
    darkBg(doc);
    pageHeader(doc);

    const dim = await getImageDimensions(origDataUrl);
    const aspect = dim ? dim.w / dim.h : 1.6;
    const maxImgArea = PAGE_H * 0.85;
    let dw = BODY_W - 8;
    let dh = dw / aspect;
    if (dh > maxImgArea) { dh = maxImgArea; dw = dh * aspect; }

    doc.setFillColor(C.surf);
    doc.roundedRect(MARGIN, 14, dw + 8, dh + 18, 4, 4, "F");
    doc.setFontSize(7);
    doc.setTextColor(C.tx2);
    doc.text("Original Image", MARGIN + 4, 20);
    if (dw > 0 && dh > 0) try { doc.addImage(origDataUrl, "PNG", MARGIN + 4, 26, dw, dh); } catch { /* ignore */ }
  }

  // ── Marked-up image (large, ~85% of page) ──
  if (markupDataUrl) {
    doc.addPage();
    darkBg(doc);
    pageHeader(doc);

    const dim = await getImageDimensions(markupDataUrl);
    const aspect = dim ? dim.w / dim.h : 1.6;
    const maxImgArea = PAGE_H * 0.85;
    let dw = BODY_W - 8;
    let dh = dw / aspect;
    if (dh > maxImgArea) { dh = maxImgArea; dw = dh * aspect; }

    doc.setFillColor(C.surf);
    doc.roundedRect(MARGIN, 14, dw + 8, dh + 18, 4, 4, "F");
    doc.setFontSize(7);
    doc.setTextColor(C.tx2);
    doc.text("Marked-up Image with Analysis Overlay", MARGIN + 4, 20);
    if (dw > 0 && dh > 0) try { doc.addImage(markupDataUrl, "PNG", MARGIN + 4, 26, dw, dh); } catch { /* ignore */ }
  }
}

function buildMeasurements(doc, allMeas, norms) {
  if (!allMeas || !allMeas.length) return;

  doc.addPage();
  darkBg(doc);
  pageHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(C.tx);
  doc.text("Measurements", MARGIN, 20);
  doc.setFontSize(9);
  doc.setTextColor(C.tx2);
  doc.text(allMeas.length + " markups", MARGIN, 28);

  const rows = [];
  for (const { m, meas } of allMeas) {
    if (!m.label) continue;
    for (const [mt, val] of Object.entries(meas)) {
      if (mt === "x" || mt === "y" || mt.startsWith("_")) continue;
      if (typeof val !== "number" || !isFinite(val)) continue;
      const n = norms.find(x => x.markupLabel === m.label && x.measureType === mt);
      const vs = mt === "angle" ? fmtAngle(val) : fmtMm(val, meas._unit);
      const z = n && n.sd > 0 ? ((val - n.mean) / n.sd).toFixed(2) : "\u2014";
      rows.push([m.label, vs, n ? n.mean.toFixed(1) : "\u2014", n ? n.sd.toFixed(2) : "\u2014", z]);
    }
  }
  if (!rows.length) return;

  doc.autoTable({
    startY: 36, head: [["Measurement", "Value", "Norm Mean", "Norm SD", "Z-score"]], body: rows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
    headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 8.5, fontStyle: "bold", halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: "bold", halign: "center", valign: "middle" },
      1: { cellWidth: 38, fontStyle: "bold", halign: "center", valign: "middle" },
      2: { cellWidth: 34, textColor: C.tx2, halign: "center", valign: "middle" },
      3: { cellWidth: 29, textColor: C.tx2, halign: "center", valign: "middle" },
      4: { cellWidth: 29, fontStyle: "bold", halign: "center", valign: "middle" },
    },
    alternateRowStyles: { fillColor: C.surf2 },
    margin: { left: MARGIN, right: MARGIN, bottom: 10 }, tableWidth: BODY_W,
  });
}

async function buildNormogram(doc, allMeas, norms) {
  if (!allMeas || !norms) return;

  // Build rows
  const rows = [];
  for (const { m, meas } of allMeas) {
    if (!m.label) continue;
    for (const [mt, val] of Object.entries(meas)) {
      if (mt.startsWith("_")) continue;
      if (typeof val !== "number" || !isFinite(val)) continue;
      const n = norms.find(x => x.markupLabel === m.label && x.measureType === mt);
      if (!n || n.sd <= 0) continue;
      const delta = val - n.mean;
      rows.push({ label: m.label, value: val, measureType: mt, norm: n, dev: { delta, sdUnits: n.sd > 0 ? delta / n.sd : 0 }, color: m.color, unit: meas._unit });
    }
  }
  const seen = new Set();
  const unique = rows.filter(r => { const k = r.label; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!unique.length) return;

  // Helper: get SVG viewBox dimensions
  function svgDim(svg) {
    const m = svg.match(/viewBox="(\d+) (\d+) (\d+) (\d+)"/);
    return m ? { w: +m[3], h: +m[4] } : null;
  }

  // Generate SVG chart images
  const svgPoly = genNormogramChart(unique, 660);
  const svgRadar = genRadarChart(unique);
  const [polyPng, radarPng] = await Promise.all([svgToPng(svgPoly, 660), svgRadar ? svgToPng(svgRadar, 560) : null]);

  doc.addPage();
  darkBg(doc);
  pageHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(C.tx);
  doc.text("Normogram \u2014 Z-score Profile", MARGIN, 20);
  doc.setFontSize(9);
  doc.setTextColor(C.tx2);
  doc.text(unique.length + " measurements vs normative data", MARGIN, 28);

  let y = 34;
  if (polyPng) {
    try {
      const dim = svgDim(svgPoly);
      const aspect = dim ? dim.w / dim.h : 2.5;
      const dw = BODY_W;
      const dh = dw / aspect;
      doc.addImage(polyPng, "PNG", MARGIN, y, dw, dh);
      y += dh + 8;
    } catch { y += 4; }
  }

  if (radarPng) {
    try {
      const dim = svgDim(svgRadar);
      const aspect = dim ? dim.w / dim.h : 1.33;
      const dw = BODY_W;
      const dh = dw / aspect;
      if (y + dh + 8 > BOTTOM_SAFE) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(C.tx);
        doc.text("Normogram Charts (cont.)", MARGIN, 20); y = 28; }
      doc.addImage(radarPng, "PNG", MARGIN, y, dw, dh);
      y += dh + 8;
    } catch { y += 4; }
  }

  // Summary table removed — charts only
}

function buildAirway(doc, project) {
  const studies = project.researchStudies || [];
  const airwayStudy = studies.find(s => s.type === "airway" && s.results?.measurements?.length > 0);
  if (!airwayStudy) {
    doc.addPage();
    darkBg(doc);
    pageHeader(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(C.tx);
    doc.text("Airway Assessment", MARGIN, 20);
    doc.setFontSize(9);
    doc.setTextColor(C.tx2);
    doc.setFont("helvetica", "normal");
    doc.text("No airway analysis data available", MARGIN, 30);
    return;
  }

  doc.addPage();
  darkBg(doc);
  pageHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(C.tx);
  doc.text("Airway Assessment", MARGIN, 20);

  const res = airwayStudy.results;
  let y = 30;
  if (res.sessionName) {
    doc.setFontSize(8);
    doc.setTextColor(C.tx2);
    doc.setFont("helvetica", "normal");
    doc.text("Session: " + res.sessionName, MARGIN, y);
    y += 5;
  }

  const measurements = (res.measurements || []).filter(m => m.id !== "_global");
  const body = measurements.map(m => [
    m.label || "\u2014",
    m.value != null ? m.value.toFixed(2) + " " + (m.unit || "") : "\u2014",
    m.normMean != null ? m.normMean.toFixed(1) + " \u00b1 " + (m.normSD != null ? m.normSD.toFixed(1) : "\u2014") : "\u2014",
    m.zScore != null ? (m.zScore >= 0 ? "+" : "") + m.zScore.toFixed(2) : "\u2014",
    m.interpretation || "\u2014",
  ]);

  doc.autoTable({
    startY: y, head: [["Measurement", "Value", "Norm", "Z-score", "Interpretation"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
    headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 7.5, fontStyle: "bold", halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: C.surf2 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold", halign: "center", valign: "middle" },
      1: { cellWidth: 24, halign: "center", valign: "middle" },
      2: { cellWidth: 28, textColor: C.tx2, halign: "center", valign: "middle" },
      3: { cellWidth: 20, fontStyle: "bold", halign: "center", valign: "middle" },
      4: { cellWidth: 40, halign: "center", valign: "middle" },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 10 },
    tableWidth: BODY_W,
  });
  y = (doc.lastAutoTable?.finalY || y) + 8;

  // Clinical findings
  const clinicalNotes = measurements.filter(m => m.clinicalNote);
  if (clinicalNotes.length > 0) {
    if (y > BOTTOM_SAFE - 50) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(C.acc);
    doc.text("Clinical Findings", MARGIN, y);
    y += 6;

    for (const m of clinicalNotes) {
      if (y > BOTTOM_SAFE - 30) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
      doc.setFillColor(C.surf);
      doc.roundedRect(MARGIN, y, BODY_W, 20, 3, 3, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C.tx);
      doc.text(m.label, MARGIN + 4, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(C.tx2);
      doc.text(m.clinicalNote, MARGIN + 4, y + 14);
      y += 22;
    }
  }

  // Global summary note
  const global = (res.measurements || []).find(m => m.id === "_global");
  if (global?.interpretation) {
    if (y > BOTTOM_SAFE - 20) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
    y += 4;
    doc.setFillColor(C.surf2);
    doc.roundedRect(MARGIN, y, BODY_W, 14, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(C.tx);
    doc.text(global.interpretation, MARGIN + 4, y + 9);
  }
}

function buildResearchStudies(doc, project) {
  const studies = project.researchStudies || [];
  if (!studies.length) return;

  for (const study of studies) {
    if (!study.results) continue;
    const res = study.results;

    doc.addPage();
    darkBg(doc);
    pageHeader(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(C.tx);
    doc.text(study.name || "Research Study", MARGIN, 20);
    doc.setFontSize(9);
    doc.setTextColor(C.tx2);
    doc.text("Type: " + (study.type || "\u2014"), MARGIN, 28);

    const TYPE_TITLES = {
      reliability: "Reliability Analysis (ICC)",
      descriptive: "Descriptive Statistics",
      comparative: "Comparative Analysis",
      longitudinal: "Longitudinal Analysis",
      correlation: "Correlation Analysis",
      diagnostic: "Diagnostic Analysis",
      superimposition: "Superimposition / Growth Analysis",
      airway: "Airway Analysis",
    };

    const title = TYPE_TITLES[study.type] || "Results";
    doc.setFontSize(10);
    doc.setTextColor(C.acc);
    doc.setFont("helvetica", "bold");
    doc.text(title, MARGIN, 38);

    const opts = {
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
      headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 8, fontStyle: "bold", halign: "center", valign: "middle" },
      alternateRowStyles: { fillColor: C.surf2 },
      margin: { left: MARGIN, right: MARGIN, bottom: 10 },
      tableWidth: BODY_W,
    };

    if (study.type === "reliability" && res.details) {
      const details = (res.details || []).filter(d => !d.skip);
      const body = details.map(d => [
        d.label || "\u2014",
        d.icc != null ? d.icc.toFixed(3) : "\u2014",
        d.ci95 ? d.ci95[0].toFixed(3) + " \u2013 " + d.ci95[1].toFixed(3) : "\u2014",
        d.sem != null ? d.sem.toFixed(3) : "\u2014",
        d.mdc != null ? d.mdc.toFixed(3) : "\u2014",
        d.dahlberg != null ? d.dahlberg.toFixed(3) : "\u2014",
        d.interpretation || "\u2014",
      ]);
      opts.columnStyles = {
        0: { cellWidth: 34, fontStyle: "bold", halign: "center", valign: "middle" },
        1: { cellWidth: 18, halign: "center", valign: "middle" },
        2: { cellWidth: 28, textColor: C.tx2, halign: "center", valign: "middle" },
        3: { cellWidth: 18, halign: "center", valign: "middle" },
        4: { cellWidth: 18, halign: "center", valign: "middle" },
        5: { cellWidth: 22, halign: "center", valign: "middle" },
        6: { cellWidth: 36, halign: "center", valign: "middle" },
      };
      doc.autoTable({ startY: 42, head: [["Landmark", "ICC", "95% CI", "SEM", "MDC", "Dahlberg", "Interp."]], body, ...opts });
    }

    if (study.type === "descriptive" && res.details) {
      const body = res.details.map(d => [
        d.label || "\u2014", d.n ?? "\u2014",
        d.mean != null ? d.mean.toFixed(2) : "\u2014", d.sd != null ? d.sd.toFixed(2) : "\u2014",
        d.median != null ? d.median.toFixed(2) : "\u2014", d.q1 != null ? d.q1.toFixed(2) : "\u2014",
        d.q3 != null ? d.q3.toFixed(2) : "\u2014", d.min != null ? d.min.toFixed(2) : "\u2014",
        d.max != null ? d.max.toFixed(2) : "\u2014",
      ]);
      opts.columnStyles = {
        0: { cellWidth: 32, fontStyle: "bold", halign: "center", valign: "middle" },
        1: { cellWidth: 14, halign: "center", valign: "middle" },
        2: { cellWidth: 20, halign: "center", valign: "middle" },
        3: { cellWidth: 18, halign: "center", valign: "middle" },
        4: { cellWidth: 20, halign: "center", valign: "middle" },
        5: { cellWidth: 18, halign: "center", valign: "middle" },
        6: { cellWidth: 18, halign: "center", valign: "middle" },
        7: { cellWidth: 18, halign: "center", valign: "middle" },
        8: { cellWidth: 18, halign: "center", valign: "middle" },
      };
      doc.autoTable({ startY: 42, head: [["Measurement", "N", "Mean", "SD", "Median", "Q1", "Q3", "Min", "Max"]], body, ...opts });
    }

    if (study.type === "comparative" && res.tests) {
      const tests = Array.isArray(res.tests) ? res.tests : [res.tests];
      const body = tests.map(t => [
        t.test || t.method || "\u2014",
        t.statistic != null ? t.statistic.toFixed(3) : "\u2014",
        t.df != null ? t.df : "\u2014",
        fmtP(t.pValue),
        t.significant ? "Yes" : "No",
        t.effectSize != null ? t.effectSize.toFixed(3) : "\u2014",
        t.effectSizeLabel || "\u2014",
      ]);
      opts.columnStyles = {
        0: { cellWidth: 36, fontStyle: "bold", halign: "center", valign: "middle" },
        1: { cellWidth: 24, halign: "center", valign: "middle" },
        2: { cellWidth: 14, halign: "center", valign: "middle" },
        3: { cellWidth: 24, halign: "center", valign: "middle" },
        4: { cellWidth: 16, halign: "center", valign: "middle" },
        5: { cellWidth: 22, halign: "center", valign: "middle" },
        6: { cellWidth: 34, halign: "center", valign: "middle" },
      };
      doc.autoTable({ startY: 42, head: [["Test", "Statistic", "df", "p-value", "Sig.", "Effect Size", "Interpretation"]], body, ...opts });

      if (res.posthoc && res.posthoc.length > 0) {
        const phArr = Array.isArray(res.posthoc) ? res.posthoc : [res.posthoc];
        const phBody = phArr.map(ph => [
          ph.group1 || ph.compare?.[0] || "\u2014",
          ph.group2 || ph.compare?.[1] || "\u2014",
          ph.diff != null ? ph.diff.toFixed(3) : "\u2014",
          fmtP(ph.pValue ?? ph.padj),
          ph.significant ? "Yes" : "No",
        ]);
        doc.addPage();
        darkBg(doc);
        pageHeader(doc);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(C.acc);
        doc.text("Post-hoc Comparisons", MARGIN, 20);
        const phOpts = {
          startY: 26, head: [["Group 1", "Group 2", "Difference", "p-value (adj)", "Sig."]], body: phBody,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
          headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 8.5, fontStyle: "bold", halign: "center", valign: "middle" },
          alternateRowStyles: { fillColor: C.surf2 },
          margin: { left: MARGIN, right: MARGIN, bottom: 10 }, tableWidth: BODY_W,
          columnStyles: {
            2: { cellWidth: 32, halign: "center", valign: "middle" },
            3: { cellWidth: 36, halign: "center", valign: "middle" },
          },
        };
        doc.autoTable(phOpts);
      }
    }

    if (study.type === "longitudinal" && res.tests) {
      const tests = Array.isArray(res.tests) ? res.tests : [res.tests];
      const body = tests.map(t => [
        t.test || t.method || t.type || "\u2014",
        t.F != null ? t.F.toFixed(3) : t.statistic != null ? t.statistic.toFixed(3) : "\u2014",
        t.df1 != null ? t.df1 : t.df ?? "\u2014",
        t.df2 != null ? t.df2 : "\u2014",
        fmtP(t.pValue),
        t.significant ? "Yes" : "No",
        t.sphericityCorrected ? "Yes" : "No",
      ]);
      opts.columnStyles = {
        0: { cellWidth: 36, fontStyle: "bold", halign: "center", valign: "middle" },
        1: { cellWidth: 22, halign: "center", valign: "middle" },
        2: { cellWidth: 14, halign: "center", valign: "middle" },
        3: { cellWidth: 14, halign: "center", valign: "middle" },
        4: { cellWidth: 24, halign: "center", valign: "middle" },
        5: { cellWidth: 16, halign: "center", valign: "middle" },
        6: { cellWidth: 24, halign: "center", valign: "middle" },
      };
      doc.autoTable({ startY: 42, head: [["Test", "F/Stat", "df1", "df2", "p-value", "Sig.", "Spher. Corr."]], body, ...opts });
    }

    if (study.type === "correlation" && res.matrix) {
      const labels = Object.keys(res.matrix);
      const body = labels.map(l => {
        const row = [l];
        labels.forEach(l2 => {
          const v = res.matrix[l]?.[l2];
          row.push(v != null && typeof v === "number" && isFinite(v) ? v.toFixed(3) : "\u2014");
        });
        return row;
      });
      const cols = labels.map(() => ({ cellWidth: Math.max(16, Math.min(28, BODY_W / (labels.length + 1))), halign: "center", valign: "middle" }));
      opts.columnStyles = { 0: { cellWidth: 40, fontStyle: "bold", halign: "center", valign: "middle" }, ...Object.fromEntries(cols.map((c, i) => [i + 1, c])) };
      const headRow = [""].concat(labels).map(l => l.length > 8 ? l.slice(0, 6) + "\u2026" : l);
      doc.autoTable({ startY: 42, head: [headRow], body, ...opts });
    }

    if (study.type === "superimposition" && res.displacements) {
      let y = 42;

      // Alignment info
      if (res.alignmentLabel) {
        doc.setFontSize(8);
        doc.setTextColor(C.tx2);
        doc.setFont("helvetica", "normal");
        doc.text("Method: " + res.alignmentLabel, MARGIN, y);
        y += 6;
      }

      // Displacement table
      const disps = res.displacements || [];
      if (disps.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(C.acc);
        doc.setFont("helvetica", "bold");
        doc.text("Landmark Displacements", MARGIN, y);
        y += 5;

        const dBody = disps.sort((a, b) => (b.lenMm || 0) - (a.lenMm || 0)).map(d => [
          d.label || "\u2014",
          fmtMm(d.lenMm, d.unit),
          (d.dxMm != null ? (d.dxMm >= 0 ? "+" : "") + d.dxMm.toFixed(2) : "\u2014"),
          (d.dyMm != null ? (d.dyMm >= 0 ? "+" : "") + d.dyMm.toFixed(2) : "\u2014"),
          d.confidenceLevel || "\u2014",
          d.isSignificant ? "Yes" : "No",
        ]);
        doc.autoTable({
          startY: y, head: [["Landmark", "Displacement", "Ant/Post (mm)", "Sup/Inf (mm)", "Confidence", "Sig."]],
          body: dBody,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
          headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 7.5, fontStyle: "bold", halign: "center", valign: "middle" },
          alternateRowStyles: { fillColor: C.surf2 },
          columnStyles: {
            0: { cellWidth: 32, fontStyle: "bold", halign: "center", valign: "middle" },
            1: { cellWidth: 24, halign: "center", valign: "middle" },
            2: { cellWidth: 28, halign: "center", valign: "middle" },
            3: { cellWidth: 28, halign: "center", valign: "middle" },
            4: { cellWidth: 24, halign: "center", valign: "middle" },
            5: { cellWidth: 18, halign: "center", valign: "middle" },
          },
          margin: { left: MARGIN, right: MARGIN, bottom: 10 },
          tableWidth: BODY_W,
        });
        y = (doc.lastAutoTable?.finalY || y) + 8;
      }

      // Summary stats
      if (res.stats) {
        if (y > BOTTOM_SAFE - 30) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
        doc.setFontSize(9);
        doc.setTextColor(C.acc);
        doc.setFont("helvetica", "bold");
        doc.text("Summary Statistics", MARGIN, y);
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(C.tx);
        doc.setFont("helvetica", "normal");
        doc.text(`Mean: ${res.stats.mean.toFixed(2)} mm  |  SD: ${res.stats.sd.toFixed(2)} mm  |  Max: ${res.stats.max.toFixed(2)} mm  |  N: ${res.stats.count}`, MARGIN, y);
        y += 8;
      }

      // Rotation tracking
      if (res.rotationTracking?.length > 0) {
        if (y > BOTTOM_SAFE - 30) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
        doc.setFontSize(9);
        doc.setTextColor(C.acc);
        doc.setFont("helvetica", "bold");
        doc.text("Reference Plane Rotation", MARGIN, y);
        y += 5;
        const rBody = res.rotationTracking.map(rt => [
          rt.label || rt.id,
          (rt.baseAngleDeg != null ? rt.baseAngleDeg.toFixed(1) + "\u00b0" : "\u2014"),
          (rt.compareAngleDeg != null ? rt.compareAngleDeg.toFixed(1) + "\u00b0" : "\u2014"),
          (rt.deltaDeg != null ? (rt.deltaDeg >= 0 ? "+" : "") + rt.deltaDeg.toFixed(2) + "\u00b0" : "\u2014"),
          rt.direction || "\u2014",
        ]);
        doc.autoTable({
          startY: y, head: [["Plane", "Base", "Compare", "Change", "Direction"]],
          body: rBody, theme: "grid",
          styles: { font: "helvetica", fontSize: 7, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
          headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 7.5, fontStyle: "bold", halign: "center", valign: "middle" },
          alternateRowStyles: { fillColor: C.surf2 },
          margin: { left: MARGIN, right: MARGIN, bottom: 10 },
          tableWidth: BODY_W,
        });
        y = (doc.lastAutoTable?.finalY || y) + 8;
      }

      // Clinical patterns narrative
      if (res.patterns?.length > 0) {
        if (y > BOTTOM_SAFE - 50) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
        doc.setFontSize(9);
        doc.setTextColor(C.acc);
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Pattern Analysis", MARGIN, y);
        y += 6;

        for (const p of res.patterns) {
          if (y > BOTTOM_SAFE - 36) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
          const sevC = p.severity === "severe" ? C.err : p.severity === "moderate" ? C.warn : C.ok;
          const boxH = p.detail ? 30 : 20;

          doc.setFillColor(C.surf);
          doc.roundedRect(MARGIN, y, BODY_W, boxH, 3, 3, "F");
          doc.setFillColor(sevC);
          doc.rect(MARGIN, y, 2.5, boxH, "F");

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(C.tx);
          doc.text((p.label || p.category || "") + "  \u2014  " + (p.summary || ""), MARGIN + 6, y + 7);

          doc.setFontSize(6.5);
          doc.setTextColor(sevC);
          doc.text((p.severity || "").toUpperCase(), MARGIN + BODY_W - 20, y + 7);

          if (p.detail) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(C.tx2);
            const det = p.detail.length > 120 ? p.detail.slice(0, 117) + "..." : p.detail;
            doc.text(det, MARGIN + 6, y + 16);
          }

          y += boxH + 3;
        }
      }

      // Error summary
      if (res.errSummary) {
        if (y > BOTTOM_SAFE - 20) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
        y += 4;
        doc.setFontSize(8);
        doc.setTextColor(C.tx3);
        doc.setFont("helvetica", "normal");
        doc.text(`Error: ${res.errSummary.totalLandmarks} landmarks | ${res.errSummary.significantDisplacements} significant | ${res.errSummary.highConfidence} high confidence`, MARGIN, y);
      }

      // Delta norms
      if (res.deltaNorms?.length > 0) {
        if (y > BOTTOM_SAFE - 30) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
        doc.setFontSize(9);
        doc.setTextColor(C.acc);
        doc.setFont("helvetica", "bold");
        doc.text("Delta Norm Comparison", MARGIN, y);
        y += 5;
        const dnBody = res.deltaNorms.map(dn => [
          dn.label || "\u2014",
          (dn.delta != null ? (dn.delta >= 0 ? "+" : "") + dn.delta.toFixed(2) : "\u2014"),
          (dn.norm?.expectedDelta != null ? (dn.norm.expectedDelta >= 0 ? "+" : "") + dn.norm.expectedDelta.toFixed(2) : "\u2014"),
          (dn.zScore != null ? (dn.zScore >= 0 ? "+" : "") + dn.zScore.toFixed(2) : "\u2014"),
          dn.interpretation || "\u2014",
        ]);
        doc.autoTable({
          startY: y, head: [["Measurement", "Actual (\u00b0)", "Expected (\u00b0)", "Z-score", "Interpretation"]],
          body: dnBody, theme: "grid",
          styles: { font: "helvetica", fontSize: 7, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
          headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 7.5, fontStyle: "bold", halign: "center", valign: "middle" },
          alternateRowStyles: { fillColor: C.surf2 },
          columnStyles: {
            0: { cellWidth: 32, fontStyle: "bold", halign: "center", valign: "middle" },
            1: { cellWidth: 22, halign: "center", valign: "middle" },
            2: { cellWidth: 22, halign: "center", valign: "middle" },
            3: { cellWidth: 18, halign: "center", valign: "middle" },
            4: { cellWidth: 50, fontSize: 6.5, halign: "center", valign: "middle" },
          },
          margin: { left: MARGIN, right: MARGIN, bottom: 10 },
          tableWidth: BODY_W,
        });
      }
    }
  }
}

function buildFormulas(doc, formulas, formulaValues) {
  if (!formulas || !formulas.length) return;

  const body = formulas.map(f => {
    const val = formulaValues?.[f.id];
    return [
      f.name || "Unnamed",
      f.expression || "\u2014",
      val != null && isFinite(val) ? val.toFixed(2) + (f.unit ? " " + f.unit : "") : "N/A",
    ];
  });

  doc.autoTable({
    startY: (doc.lastAutoTable?.finalY || 36) + 6,
    head: [["Name", "Expression", "Value"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
    headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 8.5, fontStyle: "bold", halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold", halign: "center", valign: "middle" },
      1: { cellWidth: 80, textColor: C.tx2, fontStyle: "italic", halign: "center", valign: "middle" },
      2: { cellWidth: 30, fontStyle: "bold", halign: "center", valign: "middle" },
    },
    alternateRowStyles: { fillColor: C.surf2 },
    margin: { left: MARGIN, right: MARGIN, bottom: 10 },
    tableWidth: BODY_W,
  });
}

function buildInterpretation(doc, interpretation) {
  if (!interpretation) return;
  const { deviations, patterns } = interpretation;
  if (!deviations || !deviations.length) return;

  doc.addPage();
  darkBg(doc);
  pageHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(C.tx);
  doc.text("Clinical Interpretation", MARGIN, 20);
  doc.setFontSize(9);
  doc.setTextColor(C.tx2);
  doc.text(deviations.length + " measurements analyzed", MARGIN, 28);

  let y = 40;

  // Pattern findings
  if (patterns && patterns.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(C.acc);
    doc.setFont("helvetica", "bold");
    doc.text("Combined Findings", MARGIN, y);
    y += 10;

    for (const p of patterns) {
      const sev = p.severity || "moderate";
      const sevC = sev === "severe" ? C.err : sev === "moderate" ? C.warn : C.ok;
      const boxH = p.detail ? 38 : 22;

      doc.setFillColor(C.surf);
      doc.roundedRect(MARGIN, y, BODY_W, boxH, 3, 3, "F");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C.tx);
      doc.text(p.label || "Pattern", MARGIN + 6, y + 8);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(sevC);
      doc.text(sev.toUpperCase(), MARGIN + BODY_W - 28, y + 8);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C.tx);
      doc.text(p.summary || "", MARGIN + 6, y + 20);

      if (p.detail) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.tx2);
        doc.text(p.detail || "", MARGIN + 6, y + 32);
      }
      y += boxH + 6;
    }
    y += 6;
  }

  // Deviations table
  const rows = deviations.map(d => {
    const sevL = !d.within2SD ? "Severe" : d.within2SD && !d.within1SD ? "Borderline" : "Normal";
    const vs = d.measureType === "angle" ? fmtAngle(d.value) : fmtMm(d.value);
    return [
      d.label, d.description || "", vs,
      (d.delta > 0 ? "+" : "") + d.delta.toFixed(2),
      (d.zScore > 0 ? "+" : "") + d.zScore.toFixed(1),
      sevL, d.interpretation || "",
    ];
  });

  doc.autoTable({
    startY: y,
    head: [["Measurement", "Description", "Value", "Delta", "Z-score", "Severity", "Interpretation"]],
    body: rows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.3, halign: "center", valign: "middle" },
    headStyles: { fillColor: C.dark2, textColor: C.txhd, fontSize: 7.5, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold", halign: "center", valign: "middle" },
        1: { cellWidth: 36, textColor: C.tx2, fontSize: 6.5, halign: "center", valign: "middle" },
        2: { cellWidth: 20, fontStyle: "bold", halign: "center", valign: "middle" },
        3: { cellWidth: 18, halign: "center", valign: "middle" },
        4: { cellWidth: 18, fontStyle: "bold", halign: "center", valign: "middle" },
        5: { cellWidth: 18, halign: "center", valign: "middle" },
        6: { cellWidth: 36, fontSize: 6.5, cellPadding: 0.5, halign: "center", valign: "middle" },
      },
    alternateRowStyles: { fillColor: C.surf2 },
    margin: { left: MARGIN, right: MARGIN, bottom: 10 },
    tableWidth: BODY_W,
  });

  // ── Deviation boxes by category (on a new page) ──
  const catOrder = ["skeletal", "dental", "soft-tissue", "airway", "other"];
  const catLabels = { skeletal: "Skeletal", dental: "Dental", "soft-tissue": "Soft Tissue", airway: "Airway", other: "Other" };
  const groups = {};
  for (const d of deviations) {
    const cat = d.category || "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(d);
  }

  doc.addPage();
  darkBg(doc);
  pageHeader(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(C.tx);
  doc.text("Deviations by Category", MARGIN, 20);
  y = 28;

  for (const cat of catOrder) {
    const items = groups[cat];
    if (!items || !items.length) continue;
    if (y > BOTTOM_SAFE - 48) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }

    // Category header
    doc.setFontSize(8);
    doc.setTextColor(C.tx3);
    doc.setFont("helvetica", "bold");
    doc.text(catLabels[cat] || cat, MARGIN, y);
    y += 5;

    for (const d of items) {
      if (y > BOTTOM_SAFE - 46) { doc.addPage(); darkBg(doc); pageHeader(doc); y = 18; }
      const sevLabel = !d.within2SD ? "Severe" : d.within2SD && !d.within1SD ? "Borderline" : "Normal";
      const sevC = sevLabel === "Severe" ? C.err : sevLabel === "Borderline" ? C.warn : C.ok;
      const boxH = 32;

      // Box with left color border
      doc.setFillColor(C.surf2);
      doc.roundedRect(MARGIN, y, BODY_W, boxH, 3, 3, "F");
      doc.setFillColor(sevC);
      doc.rect(MARGIN, y, 2.5, boxH, "F");

      // Label + severity badge
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C.tx);
      doc.text(d.label || "", MARGIN + 8, y + 7);

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(sevC);
      doc.text(sevLabel, MARGIN + BODY_W - 22, y + 7);

      // Value line
      const vs = d.measureType === "angle" ? fmtAngle(d.value) : fmtMm(d.value);
      const dv = (d.delta > 0 ? "+" : "") + d.delta.toFixed(2) + " (" + (d.zScore > 0 ? "+" : "") + d.zScore.toFixed(1) + " SD)";
      doc.setFontSize(8);
      doc.setTextColor(sevC);
      doc.setFont("helvetica", "bold");
      doc.text(vs + "  --  " + dv, MARGIN + 8, y + 14);

      // Description
      if (d.description) {
        doc.setFontSize(7);
        doc.setTextColor(C.tx3);
        doc.setFont("helvetica", "normal");
        const desc = d.description.length > 100 ? d.description.slice(0, 97) + "..." : d.description;
        doc.text(desc, MARGIN + 8, y + 19);
      }

      // Interpretation
      const interp = d.interpretation || "No specific interpretation available.";
      doc.setFontSize(7);
      doc.setTextColor(C.tx2);
      doc.setFont("helvetica", "normal");
      const interpShort = interp.length > 90 ? interp.slice(0, 87) + "..." : interp;
      doc.text(interpShort, MARGIN + 8, y + 24);

      // Norm reference
      doc.setFontSize(5.5);
      doc.setTextColor(C.tx3);
      doc.text("Norm: " + (d.mean != null ? d.mean.toFixed(1) : "?") + " +/- " + (d.sd != null ? d.sd.toFixed(1) : "?"), MARGIN + 8, y + 28);

      y += boxH + 3;
    }
    y += 3;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function generateReport({
  project,
  session,
  allMeas,
  norms,
  formulas,
  formulaValues,
  originalImageDataUrl,
  markupImageDataUrl,
  interpretation,
  sections = {
    cover: true, images: true, measurements: true, normograms: true,
    research: true, formulas: true, interpretation: true, airway: true,
  },
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc._logoPng = await svgToPng(LOGO_SVG, 405);

  if (sections.cover !== false) buildCover(doc, project, session);
  // Footer on every page after cover
  if (sections.cover === false) pageFooter(doc);
  doc.internal.events.subscribe("addPage", () => pageFooter(doc));
  if (sections.images !== false) await buildImages(doc, originalImageDataUrl, markupImageDataUrl);
  if (sections.measurements !== false) {
    buildMeasurements(doc, allMeas, norms);
    if (sections.formulas !== false) buildFormulas(doc, formulas, formulaValues);
  } else if (sections.formulas !== false) {
    buildFormulas(doc, formulas, formulaValues);
  }
  if (sections.normograms !== false) await buildNormogram(doc, allMeas, norms);
  if (sections.airway !== false) buildAirway(doc, project);
  if (sections.research !== false) buildResearchStudies(doc, project);
  if (sections.interpretation !== false) buildInterpretation(doc, interpretation);

  doc.save((project.name || "report").replace(/\s+/g, "_") + "_report.pdf");
  return doc;
}
