import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { primaryMeasure } from "../lib/utils.js";
import {
  SD_RANGE, CATEGORY_ORDER, CATEGORY_LABELS, BANDS, bandOf, categoryOf, formatMeasure,
  normogramRows, comparisonValues,
} from "../lib/normogram.js";
import { isApproximateSd } from "../data/norms.js";
import { provenanceOf, aiReviewSummary } from "../workspace/aiReview.js";
import { studyReportContent, pdfSafe, fmtCell } from "../research/studyReportExport.js";
import { stripTags } from "../research/studyReport.js";
import { studyStatus } from "../research/studyState.js";
applyPlugin(jsPDF);

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT AND FONTS
// Helvetica (built in) covers Latin-1. Other text is set in a Unicode font,
// fetched from public/fonts/ only when a report needs it:
//   • Arabic (and other right-to-left scripts) → Amiri, shaped by jsPDF
//   • anything else (Greek letters in statistics, names in other scripts) → Noto Sans
// A few symbols neither font has are spelled out.
// ═══════════════════════════════════════════════════════════════════════════════
const NON_LATIN = /[^\t\n\r -ÿ–—‘’“”•…]/;
const RTL = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const SYMBOLS = { "≥": ">=", "≤": "<=", "→": "->", "≈": "~", "√": "sqrt", "−": "-" };
const mapSymbols = s => String(s).replace(/[≥≤→≈√−]/g, ch => SYMBOLS[ch]);
export const needsUnicodeFont = (...texts) => texts.some(x => x != null && NON_LATIN.test(String(x)));

const FONT_FILES = { arabic: ["Amiri-Regular.ttf", "Amiri"], unicode: ["NotoSans-Regular.ttf", "NotoSans"] };
const fontCache = {};
async function loadFont(file) {
  if (fontCache[file]) return fontCache[file];
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error("Font not available");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  fontCache[file] = btoa(bin);
  return fontCache[file];
}

// Text as it will be printed: symbols spelled out; without the Unicode font,
// characters Helvetica lacks (Greek letters) are spelled out too (pdfSafe).
const NON_LATIN_ALL = new RegExp(NON_LATIN.source, "g");
const cleanText = (doc, s) => (doc._fonts?.unicode ? mapSymbols(s) : mapSymbols(s).replace(NON_LATIN_ALL, ch => (RTL.test(ch) ? ch : pdfSafe(ch))));

// Route each string (doc.text and table cells) to the font that can show it.
function enableUnicodeText(doc, fonts) {
  for (const [key, [file, name]] of Object.entries(FONT_FILES)) {
    if (!fonts[key]) continue;
    doc.addFileToVFS(file, fonts[key]);
    doc.addFont(file, name, "normal");
  }
  doc._fonts = { arabic: !!fonts.arabic, unicode: !!fonts.unicode };
  const fontFor = str => (RTL.test(str) && doc._fonts.arabic ? "Amiri" : NON_LATIN.test(str) && doc._fonts.unicode ? "NotoSans" : null);
  const text = doc.text.bind(doc);
  doc.text = (t, x, y, opts, ...rest) => {
    const str = Array.isArray(t) ? t.join(" ") : String(t ?? "");
    const font = fontFor(str);
    if (!font) return text(t, x, y, opts, ...rest);
    const f = doc.getFont();
    doc.setFont(font, "normal");
    const o = font === "Amiri" ? { ...(opts || {}), isInputVisual: false, isOutputVisual: true, isInputRtl: true, isOutputRtl: false } : opts;
    const out = text(t, x, y, o, ...rest);
    doc.setFont(f.fontName, f.fontStyle);
    return out;
  };
  const table = doc.autoTable.bind(doc);
  doc.autoTable = opts => table({
    ...opts,
    didParseCell: data => {
      opts?.didParseCell?.(data);
      const font = fontFor(String(data.cell.raw?.content ?? data.cell.raw ?? ""));
      if (font) { data.cell.styles.font = font; data.cell.styles.fontStyle = "normal"; }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEMES — Light: white pages for printing. Dark: the app's Plasticity theme.
// dark2/txhd: table-header fill/text; cover*/foot*: cover and page footer.
// ═══════════════════════════════════════════════════════════════════════════════
export const REPORT_THEMES = {
  light: {
    id: "light",
    bg: "#ffffff", surf: "#f4f6f9", surf2: "#e8ecf3", surf3: "#dcdfe7", bdr: "#c5cad5",
    tx: "#1a1d26", tx2: "#4a5268", tx3: "#5f6678",
    acc: "#2563eb", acc2: "#7c3aed", ok: "#15803d", warn: "#b45309", err: "#b91c1c",
    dark2: "#2b2f3a", txhd: "#ffffff",
    coverBg: "#ffffff", coverTx: "#1a1d26", coverTx2: "#4a5268", footBg: "#eef1f6", footTx: "#4a5268",
  },
  dark: {
    id: "dark",
    bg: "#0f0f12", surf: "#1a1a22", surf2: "#252530", surf3: "#323242", bdr: "#404058",
    tx: "#e4e4ef", tx2: "#9b9baf", tx3: "#8c8c9f",
    acc: "#b269f8", acc2: "#9333ea", ok: "#4ade80", warn: "#fbbf24", err: "#f87171",
    dark2: "#323242", txhd: "#e4e4ef",
    coverBg: "#0f0f12", coverTx: "#e4e4ef", coverTx2: "#9b9baf", footBg: "#1a1a22", footTx: "#9b9baf",
  },
};
// The palette of the report being generated (set at the start of generateReport).
let C = REPORT_THEMES.light;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const BODY_W = PAGE_W - MARGIN * 2;
const BOTTOM_SAFE = PAGE_H - 10;
const CONTENT_TOP = 18;

const PROJECTION_LABELS = { lateral: "Lateral cephalogram", ap: "AP cephalogram", other: "Other projection" };

// The app logo. Its white guide lines are recoloured for the light cover.
const LOGO_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg width="100%" height="100%" viewBox="0 0 405 405" version="1.1" xmlns="http://www.w3.org/2000/svg" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;"><g><path d="M71.346,200.513c0,-137.5 258.333,-137.5 258.333,0" style="fill:none;fill-rule:nonzero;stroke:#06d375;stroke-width:14.58px;"/><path d="M200.513,108.846l0,108.333" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-opacity:0.47;stroke-width:6.18px;stroke-linecap:butt;stroke-dasharray:12.362,12.362;"/><path d="M371.133,81.725l-164.881,128.456" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-opacity:0.47;stroke-width:6.62px;stroke-linecap:butt;stroke-dasharray:13.25,13.25;"/><circle cx="200.513" cy="217.18" r="25" style="fill:none;stroke:#727ef8;stroke-width:6.25px;stroke-linecap:butt;"/><circle cx="200.513" cy="108.846" r="25" style="fill:#0d1117;stroke:#f59e0b;stroke-width:10.42px;stroke-linecap:butt;"/><circle cx="200.513" cy="108.846" r="12.5" style="fill:#f56644;"/><circle cx="67.18" cy="200.513" r="18.75" style="fill:#0d1117;stroke:#dc11e8;stroke-width:8.33px;stroke-linecap:butt;"/><circle cx="67.18" cy="200.513" r="8.333" style="fill:#a855f7;"/><path d="M227.511,140.194c40.051,-0.901 64.362,17.813 72.932,56.152" style="fill:none;fill-rule:nonzero;stroke:#b95bae;stroke-width:7.5px;"/></g></svg>`;
const logoFor = palette => (palette.id === "light" ? LOGO_SVG.replace(/stroke:#fff;stroke-opacity:0\.47/g, "stroke:#1a1d26;stroke-opacity:0.55") : LOGO_SVG);

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
// A value with its own unit (°, mm, mm², px, %, or none for ratios).
function fmtValue(v, unit) {
  if (v == null || !isFinite(v)) return "—";
  if (unit === "°") return v.toFixed(1) + "°";
  return v.toFixed(2) + (unit ? (unit === "%" ? "%" : " " + unit) : "");
}
// Unit of an interpretation deviation from its measure type.
function unitForType(mt, calibrated) {
  if (mt === "angle") return "°";
  if (mt === "ratio" || mt === "value") return "";
  if (mt === "percentage") return "%";
  if (mt === "area") return calibrated ? "mm²" : "px²";
  return calibrated ? "mm" : "px";
}
const toneOf = z => C[BANDS[bandOf(z)].tone];
const zText = z => (z == null || !isFinite(z) ? "—" : `${z > 0 ? "+" : ""}${z.toFixed(2)}`);
const safeFile = s => String(s || "report").trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_") || "report";
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const reportFileName = (caseName, date = new Date()) => `${safeFile(caseName)}_${isoDate(date)}_report.pdf`;

const tableStyles = (size = 8) => ({
  theme: "grid",
  styles: { font: "helvetica", fontSize: size, textColor: C.tx, fillColor: C.surf, lineColor: C.bdr, lineWidth: 0.25, valign: "middle", cellPadding: 1.5 },
  headStyles: { fillColor: C.dark2, textColor: C.txhd, fontStyle: "bold", fontSize: size + 0.5 },
  alternateRowStyles: { fillColor: C.surf2 },
  margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: 16 },
  tableWidth: BODY_W,
});

// A full-width group row inside a table (e.g. "SKELETAL").
const groupRow = (label, cols) => [{ content: label, colSpan: cols, styles: { fontStyle: "bold", fillColor: C.surf3, textColor: C.tx2, fontSize: 7.5, halign: "left" } }];

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════
function darkBg(doc) {
  doc.setFillColor(C.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

// The document's first page is used when it is still empty (no cover).
function newPage(doc) {
  if (doc._firstPageFree) { doc._firstPageFree = false; return; }
  doc.addPage();
}

// Start a section on a new page and record it for the PDF's bookmarks.
function startSection(doc, title, { parent = null, subtitle = null } = {}) {
  newPage(doc);
  const page = doc.getCurrentPageInfo().pageNumber;
  doc._marks.push({ title, page, parent });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(C.tx);
  doc.text(cleanText(doc, title), MARGIN, 20);
  let y = 26;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(C.tx2);
    for (const line of doc.splitTextToSize(cleanText(doc, subtitle), BODY_W)) { doc.text(line, MARGIN, y + 1); y += 4.2; }
    y += 2;
  }
  return y + 2;
}

// A text flow with page breaks; returns helpers bound to a running y.
function textFlow(doc, startY) {
  let y = startY;
  const breakIfNeeded = h => {
    if (y + h <= BOTTOM_SAFE - 6) return;
    newPage(doc);
    y = CONTENT_TOP;
  };
  const para = (text, { size = 9, style = "normal", color = C.tx, gap = 1.5, indent = 0 } = {}) => {
    const lh = size * 0.42;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(cleanText(doc, stripTags(String(text ?? ""))), BODY_W - indent)) {
      breakIfNeeded(lh);
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.text(line, MARGIN + indent, y);
      y += lh;
    }
    y += gap;
  };
  const heading = text => { y += 2; breakIfNeeded(16); para(text, { size: 10.5, style: "bold", color: C.acc, gap: 1 }); };
  const image = (dataUrl, w, h, caption) => {
    const dw = Math.min(BODY_W, w), dh = dw * (h / w);
    breakIfNeeded(dh + (caption ? 6 : 2));
    if (caption) para(caption, { size: 8.5, style: "bold", color: C.tx2, gap: 1 });
    try { doc.addImage(dataUrl, imageFormat(dataUrl), MARGIN, y, dw, dh); } catch { /* skip unreadable image */ }
    y += dh + 4;
  };
  return { para, heading, image, breakIfNeeded, get y() { return y; }, set y(v) { y = v; } };
}

function pageFooter(doc, n, total) {
  doc.setFillColor(C.footBg);
  doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(C.footTx);
  doc.text("Research & educational use only", MARGIN, PAGE_H - 6);
  doc.text("Page " + n + " of " + total, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
}

// Header: app (or clinic) on the left, case and session on the right — so a
// loose page still says whose report it is.
function pageHeader(doc) {
  doc.setFillColor(C.acc);
  doc.rect(0, 0, PAGE_W, 2.5, "F");
  let x = MARGIN;
  if (doc._logoPng) {
    try { doc.addImage(doc._logoPng, "PNG", MARGIN, 3.4, 5, 5); x += 7; } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(C.tx);
  doc.text(cleanText(doc, doc._headerLeft || "Cephalometry Studio"), x, 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(C.tx2);
  const [caseName, session] = (doc._headerRight || []).map(s => cleanText(doc, s));
  let right = PAGE_W - MARGIN;
  if (session) {
    doc.text(session, right, 7, { align: "right" });
    right -= doc.getTextWidth(session) + 2;
    doc.text("·", right, 7, { align: "right" });
    right -= 3;
  }
  if (caseName) doc.text(caseName.length > 45 ? caseName.slice(0, 43) + "…" : caseName, right, 7, { align: "right" });
  doc.setDrawColor(C.bdr);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 10, PAGE_W - MARGIN, 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════════════════════════════
function svgToPng(svg, svgW) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(null); return; }
    const hMatch = svg.match(/viewBox="[^"]* ([\d.]+)"/) || svg.match(/height="([\d.]+)"/);
    const svgH = parseFloat(hMatch?.[1] || "400");
    const scale = 3;
    const cw = svgW * scale;
    const ch = Math.round(cw * svgH / svgW);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext?.("2d");
    if (!ctx) { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(timer);
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  });
}

const imageFormat = url => (/^data:image\/jpe?g/i.test(url || "") ? "JPEG" : "PNG");

function getImageDimensions(url) {
  return new Promise((resolve) => {
    if (!url || typeof Image === "undefined") { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMOGRAM CHARTS (SVG) — same rows as the app's Normogram: categories,
// neutral bands, off-scale arrows, "≈" for approximate SDs, comparison markers.
// ═══════════════════════════════════════════════════════════════════════════════
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function polygonSvg(rows, compare, names) {
  const W = 700, LABEL_W = 200, CHART_L = 40, CHART_R = 96, TOP = names.compare ? 56 : 40, ROW_H = 32, HEAD_H = 24;
  const CW = W - LABEL_W - CHART_L - CHART_R, CX0 = LABEL_W + CHART_L;
  const xOf = z => CX0 + CW / 2 + Math.max(-SD_RANGE, Math.min(SD_RANGE, z)) * (CW / 2 / SD_RANGE);
  const items = [];
  let y = TOP, cat = null;
  for (const r of rows) {
    if (r.category !== cat) { cat = r.category; items.push({ kind: "h", cat, y }); y += HEAD_H; }
    items.push({ kind: "r", r, y: y + ROW_H / 2 });
    y += ROW_H;
  }
  const bottom = y, H = bottom + 22;
  const zone = (a, b, fill) => `<rect x="${xOf(a)}" y="${TOP}" width="${xOf(b) - xOf(a)}" height="${bottom - TOP}" fill="${fill}"/>`;
  const marker = (x, yy, z, color, hollow) => {
    if (Math.abs(z) > SD_RANGE) {
      const d = z > 0 ? 1 : -1;
      return `<polygon points="${x + d * 7},${yy} ${x - d * 3},${yy - 6} ${x - d * 3},${yy + 6}" fill="${hollow ? "none" : color}" stroke="${hollow ? C.tx2 : C.bg}" stroke-width="1.2"/>`;
    }
    return hollow ? `<circle cx="${x}" cy="${yy}" r="5" fill="none" stroke="${C.tx2}" stroke-width="1.5"/>` : `<circle cx="${x}" cy="${yy}" r="5.5" fill="${color}" stroke="${C.bg}" stroke-width="1.5"/>`;
  };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`;
  svg += zone(-1, 1, C.ok + "22") + zone(-2, -1, C.warn + "1a") + zone(1, 2, C.warn + "1a") + zone(-SD_RANGE, -2, C.err + "18") + zone(2, SD_RANGE, C.err + "18");
  for (const sd of [-2, -1, 0, 1, 2]) {
    svg += `<line x1="${xOf(sd)}" y1="${TOP - 4}" x2="${xOf(sd)}" y2="${bottom + 4}" stroke="${sd === 0 ? C.tx3 : C.bdr}" stroke-width="${sd === 0 ? 0.8 : 0.5}"${sd === 0 ? ' stroke-dasharray="3,3"' : ""}/>`;
    svg += `<text x="${xOf(sd)}" y="${TOP - 10}" text-anchor="middle" fill="${C.tx2}" font-size="11">${sd === 0 ? "mean" : sd > 0 ? `+${sd} SD` : `${sd} SD`}</text>`;
  }
  if (names.compare) {
    svg += `<circle cx="14" cy="14" r="5" fill="${C.acc}"/><text x="24" y="18" fill="${C.tx2}" font-size="11">${esc(names.primary)}</text>`;
    svg += `<circle cx="230" cy="14" r="5" fill="none" stroke="${C.tx2}" stroke-width="1.5"/><text x="240" y="18" fill="${C.tx2}" font-size="11">${esc(names.compare)}</text>`;
  }
  const lines = {}, cLines = {};
  for (const it of items) {
    if (it.kind === "h") {
      svg += `<text x="8" y="${it.y + 16}" fill="${C.tx2}" font-size="11" font-weight="700">${esc((CATEGORY_LABELS[it.cat] || it.cat).toUpperCase())}</text>`;
      svg += `<line x1="8" y1="${it.y + HEAD_H - 2}" x2="${W - 8}" y2="${it.y + HEAD_H - 2}" stroke="${C.bdr}" stroke-width="0.6"/>`;
      continue;
    }
    const { r } = it, col = toneOf(r.z), x = xOf(r.z);
    (lines[r.category] = lines[r.category] || []).push(`${x},${it.y}`);
    svg += `<text x="${LABEL_W - 8}" y="${it.y + 4}" text-anchor="end" fill="${C.tx}" font-size="12" font-weight="600">${esc(r.label)}${r.approxSd ? " ~" : ""}</text>`;
    const c = compare?.[r.label];
    if (c) {
      (cLines[r.category] = cLines[r.category] || []).push(`${xOf(c.z)},${it.y}`);
      svg += marker(xOf(c.z), it.y, c.z, C.tx2, true);
    }
    svg += marker(x, it.y, r.z, col, false);
    const off = Math.abs(r.z) > SD_RANGE ? ` (${r.z > 0 ? "+" : ""}${r.z.toFixed(1)} SD)` : "";
    svg += `<text x="${Math.min(x + 11, W - 4)}" y="${it.y + 4}" fill="${col}" font-size="11" font-weight="700">${esc(formatMeasure(r.value, r.unit))}${off}</text>`;
  }
  for (const pts of Object.values(cLines)) if (pts.length > 1) svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${C.tx2}" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  for (const pts of Object.values(lines)) if (pts.length > 1) svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${C.acc}" stroke-width="2" stroke-linejoin="round" opacity="0.75"/>`;
  return { svg: svg + "</svg>", w: W, h: H };
}

function radarSvg(rows, compare) {
  const n = rows.length, W = 700, H = 560, CX = 350, CY = 270, R = 185;
  const rad = z => R * ((Math.max(-SD_RANGE, Math.min(SD_RANGE, z)) + SD_RANGE) / (2 * SD_RANGE));
  const at = (i, z) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { a, x: CX + rad(z) * Math.cos(a), y: CY + rad(z) * Math.sin(a) };
  };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`;
  for (const sd of [-2, -1, 0, 1, 2]) {
    svg += `<circle cx="${CX}" cy="${CY}" r="${rad(sd)}" fill="${sd === 0 ? C.ok + "18" : "none"}" stroke="${sd === 0 ? C.tx3 : C.bdr}" stroke-width="0.7" stroke-dasharray="${sd === 0 ? "3,3" : "2,3"}"/>`;
    svg += `<text x="${CX + 4}" y="${CY - rad(sd) - 4}" fill="${C.tx2}" font-size="10">${sd === 0 ? "mean" : sd > 0 ? `+${sd} SD` : `${sd} SD`}</text>`;
  }
  const pts = rows.map((r, i) => ({ r, ...at(i, r.z) }));
  pts.forEach(p => { svg += `<line x1="${CX}" y1="${CY}" x2="${CX + R * Math.cos(p.a)}" y2="${CY + R * Math.sin(p.a)}" stroke="${C.bdr}" stroke-width="0.5"/>`; });
  if (compare) {
    const cp = rows.map((r, i) => (compare[r.label] ? at(i, compare[r.label].z) : null)).filter(Boolean);
    if (cp.length > 2) svg += `<polygon points="${cp.map(p => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${C.tx2}" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }
  svg += `<polygon points="${pts.map(p => `${p.x},${p.y}`).join(" ")}" fill="${C.acc}22" stroke="${C.acc}" stroke-width="2" stroke-linejoin="round"/>`;
  pts.forEach(p => {
    const lx = CX + (R + 24) * Math.cos(p.a), ly = CY + (R + 24) * Math.sin(p.a);
    const anchor = lx > CX + 5 ? "start" : lx < CX - 5 ? "end" : "middle";
    svg += `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${toneOf(p.r.z)}" stroke="${C.bg}" stroke-width="1.5"/>`;
    svg += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" fill="${C.tx}" font-size="11" font-weight="600">${esc(p.r.label)}${Math.abs(p.r.z) > SD_RANGE ? (p.r.z > 0 ? " ▲" : " ▼") : ""}</text>`;
  });
  svg += `<text x="${CX}" y="${H - 10}" text-anchor="middle" fill="${C.tx2}" font-size="11">The outline's shape depends on the order of the measurements; read each value against the rings.</text>`;
  return { svg: svg + "</svg>", w: W, h: H };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER
// ═══════════════════════════════════════════════════════════════════════════════
function buildCover(doc, project, session, clinic) {
  doc.setFillColor(C.coverBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(C.acc2);
  doc.rect(0, 0, 8, PAGE_H, "F");

  let titleY = 45;
  if (clinic?.logo) {
    try { doc.addImage(clinic.logo, imageFormat(clinic.logo), MARGIN + 10, 16, 40, 20, undefined, "FAST"); titleY = 56; } catch { /* ignore */ }
  }
  if (clinic?.name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(C.coverTx2);
    doc.text(cleanText(doc, clinic.name), PAGE_W - MARGIN, 24, { align: "right" });
  }
  if (doc._coverLogoPng) {
    try { doc.addImage(doc._coverLogoPng, "PNG", PAGE_W - MARGIN - 40, 245, 40, 40); } catch { /* ignore */ }
  }

  const titleX = MARGIN + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(C.coverTx);
  doc.text("Cephalometric", titleX, titleY);
  doc.text("Analysis Report", titleX, titleY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(cleanText(doc, project.name || "Untitled case"), titleX, titleY + 34);

  const sepY = titleY + 44;
  doc.setDrawColor(C.bdr);
  doc.setLineWidth(0.3);
  doc.line(titleX, sepY, PAGE_W - MARGIN, sepY);

  const meta = project.meta || {};
  const left = [
    ["Patient ID", meta.patientId], ["Name", meta.name], ["Date of birth", meta.dob], ["Age", meta.age], ["Sex", meta.gender],
  ];
  const right = [
    ["Projection", PROJECTION_LABELS[project.projection] || project.projection],
    ["Session", [session?.label, session?.name].filter(Boolean).join(" · ")],
    ["Session date", new Date(session?.timestamp || project.created || Date.now()).toLocaleDateString()],
    ["Clinician", meta.clinician], ["Facility", meta.facility],
  ];
  let y = sepY + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(C.coverTx2);
  doc.text("PATIENT AND CASE", titleX, y);
  y += 8;
  const colW = (PAGE_W - MARGIN - titleX) / 2;
  const column = (rows, x) => {
    let yy = y;
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(C.coverTx2);
      doc.text(label, x, yy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(C.coverTx);
      doc.text(cleanText(doc, value ? String(value) : "—"), x + 30, yy);
      yy += 7;
    }
  };
  column(left, titleX);
  column(right, titleX + colW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(C.coverTx2);
  doc.text(`Report generated ${new Date().toLocaleString()}`, titleX, y + 5 * 7 + 6);

  doc.setFillColor(C.footBg);
  doc.rect(0, PAGE_H - 22, PAGE_W, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(C.coverTx);
  doc.text("RESEARCH & EDUCATIONAL USE ONLY", MARGIN, PAGE_H - 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(C.footTx);
  doc.text("Cephalometry Studio is intended for research and educational purposes only. It is not approved or cleared for clinical", MARGIN, PAGE_H - 9.5);
  doc.text("diagnosis or treatment planning. Clinical decisions should not be made solely on the basis of these measurements.", MARGIN, PAGE_H - 5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════════════════════════════
async function buildImages(doc, origDataUrl, markupDataUrl) {
  for (const [url, title] of [[origDataUrl, "Original image"], [markupDataUrl, "Tracing and measurements"]]) {
    if (!url) continue;
    const y0 = startSection(doc, title);
    const dim = await getImageDimensions(url);
    const aspect = dim ? dim.w / dim.h : 1.25;
    let dw = BODY_W, dh = dw / aspect;
    const maxH = BOTTOM_SAFE - 8 - y0;
    if (dh > maxH) { dh = maxH; dw = dh * aspect; }
    try { doc.addImage(url, imageFormat(url), MARGIN + (BODY_W - dw) / 2, y0, dw, dh); } catch { /* ignore */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS — calibration statement, AI provenance, grouped table
// ═══════════════════════════════════════════════════════════════════════════════
// One value per markup: its primary measure, with that measure's unit.
export function measurementRows(allMeas, norms, calibration, facing) {
  const rows = [];
  for (const { m } of allMeas || []) {
    if (!m.label || m.type === "point") continue;
    const pm = primaryMeasure(m, calibration, { facing });
    if (!pm) continue;
    const order = (norms || []).findIndex(x => x.markupLabel === m.label && x.measureType === pm.key);
    const n = order >= 0 ? norms[order] : null;
    rows.push({
      label: m.label, key: pm.key, value: pm.value, unit: pm.unit, norm: n, order: order >= 0 ? order : Infinity,
      category: categoryOf(m.label),
      approxSd: !!n && (n.sdApproximate === true || isApproximateSd(n.source, m.label, n.sd)),
    });
  }
  return rows;
}

const LINEAR = new Set(["mm", "px", "mm²", "px²"]);

export function calibrationStatement(calibration, projection) {
  if (!calibration?.done) {
    return "Not calibrated: distances and areas are in image pixels and are not compared with norms (norms are in mm). Angles and ratios are unaffected.";
  }
  const ppm = Number(calibration.pxPerMm);
  const ceph = projection === "lateral" || projection === "ap" || !projection;
  if (calibration.method === "dicom") {
    const mag = calibration.magnificationCorrected
      ? " The spacing is in the patient: the device corrected it for radiographic magnification."
      : ceph ? " The spacing is at the detector, so radiographic magnification (typically 8–15% on cephalograms) is included in these values." : "";
    return `Calibrated from the DICOM file (${calibration.source}): ${ppm.toFixed(2)} px/mm (${(1 / ppm).toFixed(3)} mm per pixel).${mag}`;
  }
  const how = calibration.method === "ticks" ? `from the tick marks of a ruler on the image (${calibration.source})`
    : calibration.knownMm ? `from a ruler of ${calibration.knownMm} mm on the image` : "manually";
  const mag = ceph
    ? " Radiographic magnification (typically 8–15% on cephalograms) is included in these values unless the ruler was at the midsagittal plane."
    : "";
  return `Calibrated ${how}: ${ppm.toFixed(2)} px/mm (${(1 / ppm).toFixed(3)} mm per pixel).${mag}`;
}

function buildMeasurements(doc, ctx) {
  const { allMeas, norms, calibration, facing, markups, project } = ctx;
  const data = measurementRows(allMeas, norms, calibration, facing);
  const points = (markups || []).filter(m => m.type === "point" && m.placed !== false && m.points?.[0]?.x > -9000);
  if (!data.length && !points.length) return false;

  const flow = textFlow(doc, startSection(doc, "Measurements"));
  flow.para(calibrationStatement(calibration, project?.projection), { size: 8.5, color: calibration?.done ? C.tx2 : C.warn });

  // AI provenance — which landmarks the detector placed and whether they were checked.
  const ai = aiReviewSummary(points);
  if (ai.total > 0) {
    const manual = points.length - ai.total;
    const reviewed = ai.total - ai.pending - ai.adjusted;
    flow.para(`Landmarks: ${points.length} placed — ${manual} manually, ${ai.total} by AI (${reviewed} reviewed as placed, ${ai.adjusted} adjusted, ${ai.pending} not reviewed).`, { size: 8.5, color: ai.pending ? C.warn : C.tx2 });
  } else if (points.length) {
    flow.para(`Landmarks: ${points.length} placed manually.`, { size: 8.5, color: C.tx2 });
  }

  if (data.length) {
    const sorted = [...data].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.order - b.order);
    const body = [];
    let cat = null;
    for (const r of sorted) {
      if (r.category !== cat) { cat = r.category; body.push(groupRow((CATEGORY_LABELS[cat] || cat).toUpperCase(), 5)); }
      const comparable = r.norm && r.norm.sd > 0 && !(LINEAR.has(r.unit) && !calibration?.done);
      const z = comparable ? (r.value - r.norm.mean) / r.norm.sd : null;
      body.push([
        r.label + (r.approxSd ? " ~" : ""),
        fmtValue(r.value, r.unit),
        r.norm ? `${fmtValue(r.norm.mean, LINEAR.has(r.unit) ? r.unit.replace("px", "mm") : r.unit)} ± ${r.norm.sd.toFixed(1)}` : "—",
        zText(z),
        z == null ? "—" : BANDS[bandOf(z)].label,
      ]);
    }
    flow.y += 1;
    doc.autoTable({
      ...tableStyles(8),
      startY: flow.y,
      head: [["Measurement", "Value", "Norm (mean ± SD)", "z", "Band"]],
      body,
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 52 }, 1: { halign: "right", cellWidth: 30 }, 2: { halign: "right", textColor: C.tx2, cellWidth: 42 }, 3: { halign: "right", cellWidth: 18 } },
      didParseCell: d => {
        if (d.section === "body" && d.column.index >= 3 && typeof d.cell.raw === "string" && d.cell.raw !== "—") {
          const z = d.column.index === 3 ? parseFloat(d.cell.raw) : null;
          const band = d.column.index === 4 ? Object.values(BANDS).find(b => b.label === d.cell.raw) : null;
          if (z != null && isFinite(z)) d.cell.styles.textColor = toneOf(z);
          if (band) d.cell.styles.textColor = C[band.tone];
        }
      },
    });
    flow.y = doc.lastAutoTable.finalY + 4;
    const notes = [];
    if (data.some(r => r.approxSd)) notes.push("~ the published source gives no exact SD for this norm; its z-score is indicative.");
    if (!calibration?.done && data.some(r => r.norm && LINEAR.has(r.unit))) notes.push("Distances and areas are not compared with norms until the image is calibrated.");
    notes.forEach(n => flow.para(n, { size: 7.5, color: C.tx2, gap: 0.5 }));
  }

  // Landmark provenance table (only when the AI placed any landmark).
  if (ai.total > 0) {
    flow.heading("Landmark provenance");
    const rows = points.map(m => [m.label || "?", provenanceOf(m)]);
    const half = Math.ceil(rows.length / 2);
    const body = rows.slice(0, half).map((r, i) => [...r, ...(rows[half + i] || ["", ""])]);
    doc.autoTable({
      ...tableStyles(7.5),
      startY: flow.y,
      head: [["Landmark", "Source", "Landmark", "Source"]],
      body,
      didParseCell: d => {
        if (d.section === "body" && (d.column.index === 1 || d.column.index === 3) && /NOT reviewed/.test(String(d.cell.raw))) {
          d.cell.styles.textColor = C.warn;
          d.cell.styles.fontStyle = "bold";
        }
      },
    });
    flow.y = doc.lastAutoTable.finalY + 4;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION COMPARISON (e.g. T0 vs T1)
// ═══════════════════════════════════════════════════════════════════════════════
const sessionLabel = s => [s?.label, s?.name].filter(Boolean).join(" · ") || "Session";

export function comparisonRows(markups, calibration, facing, other) {
  const out = [];
  if (!other) return out;
  const otherFacing = other.facing || facing;
  for (const m of markups || []) {
    if (!m.label || m.type === "point") continue;
    const o = (other.markups || []).find(x => x.label === m.label && x.type !== "point");
    if (!o) continue;
    const a = primaryMeasure(m, calibration, { facing });
    const b = primaryMeasure(o, other.calibration, { facing: otherFacing });
    if (!a || !b || a.key !== b.key) continue;
    if (LINEAR.has(a.unit) && (!calibration?.done || !other.calibration?.done)) continue;
    out.push({ label: m.label, unit: a.unit, value: a.value, other: b.value, change: a.value - b.value, category: categoryOf(m.label) });
  }
  return out.sort((x, y) => CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category));
}

function buildComparison(doc, ctx) {
  const { compare, markups, calibration, facing, session } = ctx;
  if (!compare) return;
  const rows = comparisonRows(markups, calibration, facing, compare);
  const flow = textFlow(doc, startSection(doc, "Session comparison", { subtitle: `${sessionLabel(session)} compared with ${sessionLabel(compare)}. Change = this session − ${sessionLabel(compare)}.` }));
  if (!rows.length) { flow.para("No measurement is available in both sessions.", { color: C.tx2 }); return; }
  const body = [];
  let cat = null;
  for (const r of rows) {
    if (r.category !== cat) { cat = r.category; body.push(groupRow((CATEGORY_LABELS[cat] || cat).toUpperCase(), 4)); }
    body.push([r.label, fmtValue(r.other, r.unit), fmtValue(r.value, r.unit), `${r.change > 0 ? "+" : ""}${fmtValue(r.change, r.unit)}`]);
  }
  doc.autoTable({
    ...tableStyles(8),
    startY: flow.y,
    head: [["Measurement", sessionLabel(compare), sessionLabel(session), "Change"]],
    body,
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
  });
  flow.y = doc.lastAutoTable.finalY + 4;
  if (!calibration?.done || !compare.calibration?.done) flow.para("Distances and areas are compared only when both sessions are calibrated.", { size: 7.5, color: C.tx2 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMOGRAM
// ═══════════════════════════════════════════════════════════════════════════════
async function buildNormogram(doc, ctx) {
  const { markups, norms, calibration, facing, compare, session } = ctx;
  const { rows, hiddenUncalibrated } = normogramRows(markups, norms, calibration, facing);
  if (!rows.length) return;
  const cmp = compare ? comparisonValues(rows, compare.markups, compare.calibration, compare.facing || facing) : null;
  const names = { primary: sessionLabel(session), compare: compare ? sessionLabel(compare) : null };

  const flow = textFlow(doc, startSection(doc, "Normogram", { subtitle: `${rows.length} measurements against their norms (z-scores)${compare ? `; hollow markers: ${names.compare}` : ""}.` }));
  const poly = polygonSvg(rows, cmp, names);
  const polyPng = await svgToPng(poly.svg, poly.w);
  if (polyPng) flow.image(polyPng, BODY_W, BODY_W * (poly.h / poly.w));
  if (rows.length >= 3) {
    const radar = radarSvg(rows, cmp);
    const radarPng = await svgToPng(radar.svg, radar.w);
    if (radarPng) flow.image(radarPng, BODY_W * 0.85, BODY_W * 0.85 * (radar.h / radar.w), "Radar view");
  }
  const sources = [...new Set(rows.map(r => r.norm.source).filter(Boolean))];
  if (sources.length) flow.para(`Norms: ${sources.join("; ")}.`, { size: 7.5, color: C.tx2, gap: 0.5 });
  if (rows.some(r => r.approxSd)) flow.para("~ the published source gives no exact SD for this norm; its position is indicative.", { size: 7.5, color: C.tx2, gap: 0.5 });
  if (rows.some(r => Math.abs(r.z) > SD_RANGE)) flow.para(`Arrows at the edge mark values beyond ±${SD_RANGE} SD; the value shows its z-score.`, { size: 7.5, color: C.tx2, gap: 0.5 });
  if (hiddenUncalibrated) flow.para(`${hiddenUncalibrated} distance or area measurement(s) are not shown until the image is calibrated.`, { size: 7.5, color: C.warn, gap: 0.5 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY
// ═══════════════════════════════════════════════════════════════════════════════
const hasAirwayValues = res => (res?.measurements || []).some(m => m.value != null && !String(m.id).startsWith("_"));

function buildAirway(doc, project, live) {
  // The Airway panel's results for this session come first; a Research airway
  // study is used when the session has no airway landmarks. No page at all
  // when there is nothing to report.
  const studies = project.researchStudies || [];
  const source = hasAirwayValues(live) ? { results: live } : studies.find(s => s.type === "airway" && hasAirwayValues(s.results));
  if (!source) return;
  const res = source.results;
  const flow = textFlow(doc, startSection(doc, "Airway assessment", { subtitle: res.sessionName ? `Session: ${res.sessionName}` : null }));
  const measurements = (res.measurements || []).filter(m => !String(m.id).startsWith("_") && m.value != null);
  doc.autoTable({
    ...tableStyles(7.5),
    startY: flow.y,
    head: [["Measurement", "Value", "Norm (mean ± SD)", "z", "Interpretation"]],
    body: measurements.map(m => [
      m.label || "—",
      m.value != null ? `${m.value.toFixed(2)} ${m.unit || ""}`.trim() : "—",
      m.normMean != null ? `${m.normMean.toFixed(1)} ± ${m.normSD != null ? m.normSD.toFixed(1) : "—"}` : "—",
      zText(m.zScore),
      m.interpretation || "—",
    ]),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { halign: "right" }, 2: { halign: "right", textColor: C.tx2 }, 3: { halign: "right" } },
  });
  flow.y = doc.lastAutoTable.finalY + 6;
  const notes = measurements.filter(m => m.clinicalNote);
  if (notes.length) {
    flow.heading("Clinical notes");
    notes.forEach(m => flow.para(`${m.label}: ${m.clinicalNote}`, { size: 8.5, gap: 1 }));
  }
  const global = (res.measurements || []).find(m => m.id === "_global");
  if (global?.interpretation) flow.para(global.interpretation, { size: 9, style: "bold" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAS
// ═══════════════════════════════════════════════════════════════════════════════
// Mm per CSS px of a rendered equation: KaTeX's 44 px type prints at about 16 pt.
const EQ_MM_PER_PX = 0.13;

function fmtFormulaValue(f, val) {
  if (val == null || !isFinite(val)) return "N/A";
  return val.toFixed(2) + (!f.unit ? "" : f.unit === "°" ? "°" : " " + f.unit);
}

// Each formula as a block: its name, the equation drawn large (the LaTeX the
// user wrote, otherwise the expression typeset), and its value.
async function buildFormulas(doc, formulas, formulaValues, { renderLatex, formulaTex } = {}) {
  if (!formulas || !formulas.length) return;
  const flow = textFlow(doc, startSection(doc, "Custom formulas"));
  for (const f of formulas) {
    const tex = f.latex?.trim() || formulaTex?.(f.expression) || null;
    let eq = null;
    if (tex && renderLatex) {
      try { eq = await renderLatex(tex, { color: C.tx }); } catch { eq = null; }
    }
    let dw = 0, dh = 0;
    if (eq) {
      dw = eq.w * EQ_MM_PER_PX;
      dh = eq.h * EQ_MM_PER_PX;
      const k = Math.min(1, (BODY_W - 10) / dw);
      dw *= k;
      dh *= k;
    }
    const boxH = eq ? dh + 8 : 16;
    flow.breakIfNeeded(12 + boxH + 14);
    flow.heading(f.name || "Unnamed formula");
    if (f.description) flow.para(f.description, { size: 8.5, color: C.tx2, gap: 1 });
    const top = flow.y;
    doc.setFillColor(C.surf);
    doc.setDrawColor(C.bdr);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, top, BODY_W, boxH, 2, 2, "FD");
    if (eq) {
      try { doc.addImage(eq.dataUrl, "PNG", MARGIN + (BODY_W - dw) / 2, top + 4, dw, dh); } catch { /* skip */ }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.setTextColor(C.tx);
      const line = doc.splitTextToSize(cleanText(doc, f.expression || "—"), BODY_W - 10)[0];
      doc.text(line, PAGE_W / 2, top + 10, { align: "center" });
    }
    flow.y = top + boxH + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(C.acc);
    doc.text(cleanText(doc, `= ${fmtFormulaValue(f, formulaValues?.[f.id])}`), PAGE_W / 2, flow.y, { align: "center" });
    flow.y += 6;
    if (f.latex?.trim() && f.expression) flow.para(`Computed as: ${f.expression}`, { size: 8, color: C.tx3, gap: 1 });
    flow.y += 4;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH STUDIES — the same content as each study's own report, plus charts
// ═══════════════════════════════════════════════════════════════════════════════
export function reportableStudies(project, studyIds) {
  const all = (project?.researchStudies || []).filter(st => !st.archived && st.results && !st.results.error);
  return Array.isArray(studyIds) ? all.filter(st => studyIds.includes(st.id)) : all;
}

async function buildResearchStudies(doc, ctx) {
  const { project, calibration, studyIds, captureStudyCharts } = ctx;
  const studies = reportableStudies(project, studyIds);
  if (!studies.length) return;
  doc._marks.push({ title: "Research studies", page: doc.getNumberOfPages() + (doc._firstPageFree ? 0 : 1), parent: null, group: true });

  for (const study of studies) {
    const status = studyStatus(study, project.sessions || [], calibration);
    const c = studyReportContent(study, status);
    const flow = textFlow(doc, startSection(doc, c.title, { parent: "Research studies", subtitle: c.subtitle }));
    if (status === "stale") flow.para("These results are out of date: the data changed after the study was run. Re-run it in the Research workspace for current figures.", { size: 9, color: C.warn });
    if (c.notes) flow.para(`Notes. ${c.notes}`, { size: 9, color: C.tx2 });
    if (c.warnings.length) {
      flow.heading("Caveats");
      c.warnings.forEach(w => flow.para(`- ${w}`, { size: 8.5, color: C.warn, indent: 2, gap: 0.8 }));
    }
    flow.heading("Summary");
    flow.para(c.summary.headline);
    const findings = c.summary.findings || [];
    findings.slice(0, 15).forEach(f => {
      const text = f.label && !String(f.text).startsWith(f.label) ? `${f.label}: ${f.text}` : f.text;
      flow.para(`- ${text}`, { size: 8.5, indent: 2, gap: 0.8, color: f.flag === "sig" || f.flag === "warn" ? C.tx : C.tx2 });
    });
    if (findings.length > 15) flow.para(`… and ${findings.length - 15} more (see the tables).`, { size: 8.5, color: C.tx2, indent: 2 });
    flow.heading("Methods");
    flow.para(c.methods);
    flow.heading("Results");
    flow.para(c.results);

    for (const t of c.tables) {
      if (!t.rows?.length) continue;
      flow.y += 1;
      flow.breakIfNeeded(24);
      flow.para(t.title, { size: 9.5, style: "bold", gap: 1 });
      doc.autoTable({
        ...tableStyles(t.header.length > 8 ? 6.5 : 7.5),
        startY: flow.y,
        head: [t.header.map(h => cleanText(doc, h))],
        body: t.rows.map(r => r.map(v => cleanText(doc, fmtCell(v)))),
      });
      flow.y = doc.lastAutoTable.finalY + 6;
    }

    if (captureStudyCharts) {
      let charts = [];
      try { charts = await captureStudyCharts(study, C); } catch { charts = []; }
      if (charts.length) {
        flow.heading("Charts");
        charts.forEach(ch => flow.image(ch.dataUrl, BODY_W, BODY_W * (ch.h / ch.w)));
      }
    }

    if (c.references.length) {
      flow.heading("References");
      c.references.forEach(r => flow.para(r, { size: 8, color: C.tx2, gap: 0.8 }));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERPRETATION — an overview table, then one box per measurement with its
// description and interpretation (no repetition between the two)
// ═══════════════════════════════════════════════════════════════════════════════
function buildInterpretation(doc, interpretation, calibrated) {
  if (!interpretation) return;
  const { deviations, patterns } = interpretation;
  if (!deviations || !deviations.length) return;
  const flow = textFlow(doc, startSection(doc, "Interpretation", { subtitle: `${deviations.length} measurements compared with their norms.` }));

  if (patterns?.length) {
    flow.heading("Combined findings");
    for (const p of patterns) {
      const sevC = p.severity === "severe" ? C.err : p.severity === "moderate" ? C.warn : C.ok;
      flow.para(`${p.label || "Pattern"} — ${(p.severity || "moderate").toUpperCase()}`, { size: 9.5, style: "bold", color: sevC, gap: 0.5 });
      if (p.summary) flow.para(p.summary, { size: 9, gap: 0.5 });
      if (p.detail) flow.para(p.detail, { size: 8.5, color: C.tx2 });
    }
  }

  const sorted = [...deviations].sort((a, b) => CATEGORY_ORDER.indexOf(a.category || "other") - CATEGORY_ORDER.indexOf(b.category || "other"));
  flow.heading("Overview");
  const body = [];
  let cat = null;
  for (const d of sorted) {
    const c = d.category || "other";
    if (c !== cat) { cat = c; body.push(groupRow((CATEGORY_LABELS[c] || c).toUpperCase(), 5)); }
    const unit = unitForType(d.measureType, calibrated);
    body.push([d.label + (d.sdApproximate ? " ~" : ""), fmtValue(d.value, unit), `${fmtValue(d.mean, unit)} ± ${d.sd != null ? d.sd.toFixed(1) : "?"}`, zText(d.zScore), BANDS[bandOf(d.zScore)].label]);
  }
  doc.autoTable({
    ...tableStyles(8),
    startY: flow.y,
    head: [["Measurement", "Value", "Norm (mean ± SD)", "z", "Band"]],
    body,
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 52 }, 1: { halign: "right" }, 2: { halign: "right", textColor: C.tx2 }, 3: { halign: "right" } },
    didParseCell: d => {
      if (d.section !== "body" || d.column.index < 3 || typeof d.cell.raw !== "string") return;
      const band = Object.values(BANDS).find(b => b.label === d.cell.raw);
      if (band) d.cell.styles.textColor = C[band.tone];
      const z = d.column.index === 3 ? parseFloat(d.cell.raw) : NaN;
      if (isFinite(z)) d.cell.styles.textColor = toneOf(z);
    },
  });
  flow.y = doc.lastAutoTable.finalY + 6;

  flow.heading("Details");
  for (const d of sorted) {
    const unit = unitForType(d.measureType, calibrated);
    const head = `${d.label}: ${fmtValue(d.value, unit)} (${d.delta > 0 ? "+" : ""}${fmtValue(d.delta, unit)}, ${zText(d.zScore)} SD) — ${BANDS[bandOf(d.zScore)].label}`;
    flow.breakIfNeeded(14);
    flow.para(head, { size: 9, style: "bold", color: toneOf(d.zScore), gap: 0.5 });
    if (d.description) flow.para(d.description, { size: 8, color: C.tx3, gap: 0.3 });
    flow.para(d.interpretation || "No specific interpretation available.", { size: 8.5, color: C.tx2, gap: 0.3 });
    flow.para(`Norm ${fmtValue(d.mean, unit)} ± ${d.sd != null ? d.sd.toFixed(1) : "?"}${d.normSource ? ` (${d.normSource})` : ""}${d.sdApproximate ? " — SD approximate" : ""}`, { size: 7.5, color: C.tx3, gap: 2 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateReport({
  project,
  session,
  allMeas,
  markups,
  norms,
  formulas,
  formulaValues,
  originalImageDataUrl,
  markupImageDataUrl,
  interpretation,
  airway = null,
  calibration = null,
  facing = "right",
  sections = {
    cover: true, images: true, measurements: true, normograms: true,
    research: true, formulas: true, interpretation: true, airway: true,
  },
  theme = "light",
  compare = null,          // another session ({ markups, calibration, facing, label, name })
  studyIds = null,         // research studies to include (null = all with results)
  captureStudyCharts = null, // async (study, palette) => [{ dataUrl, w, h }]
  renderLatex = null,      // async (latex, { color }) => { dataUrl, w, h } | null
  formulaTex = null,       // (expression) => LaTeX | null, for formulas without LaTeX
  clinic = null,           // { name, logo (data URL) }
  save = true,
}) {
  C = REPORT_THEMES[theme] || REPORT_THEMES.light;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc._marks = [];
  // Every page (including ones a long table continues onto) starts with the
  // theme's background, painted before anything else is drawn on it.
  darkBg(doc);
  doc.internal.events.subscribe("addPage", () => darkBg(doc));
  doc._logoPng = await svgToPng(logoFor(C), 405);
  doc._coverLogoPng = doc._logoPng;
  const cal = calibration || session?.calibration || null;
  const marks = markups || (allMeas || []).map(x => x.m);
  const ctx = { project, session, allMeas, markups: marks, norms, calibration: cal, facing, compare, studyIds, captureStudyCharts };

  const caseName = project?.name || "Untitled case";
  doc._headerLeft = clinic?.name || "Cephalometry Studio";
  doc._headerRight = [caseName, session ? sessionLabel(session) : ""];
  doc.setProperties({
    title: `Cephalometric report: ${caseName}`,
    subject: `${sessionLabel(session)}${compare ? ` vs ${sessionLabel(compare)}` : ""}`,
    author: clinic?.name || "Cephalometry Studio",
    creator: "Cephalometry Studio",
    keywords: "cephalometry, cephalometric analysis, report",
  });

  // Fonts for text Helvetica cannot show (names in other scripts, Greek in statistics).
  const research = sections.research !== false ? reportableStudies(project, studyIds) : [];
  const texts = [
    project?.name, ...Object.values(project?.meta || {}), session?.name, clinic?.name,
    ...marks.map(m => m?.label), ...(formulas || []).flatMap(f => [f.name, f.description]),
    ...(airway?.measurements || []).map(m => m.label),
    ...research.flatMap(st => { const c = studyReportContent(st, null); return [c.title, c.methods, c.results, ...c.tables.flatMap(t => t.header)]; }),
  ];
  const needArabic = texts.some(x => x != null && RTL.test(String(x)));
  const needOther = texts.some(x => x != null && NON_LATIN.test(mapSymbols(String(x)).replace(/[֐-ࣿיִ-﷿ﹰ-ﻼ\s]/g, "")));
  if (needArabic || needOther) {
    const fonts = {};
    try { if (needArabic) fonts.arabic = await loadFont(FONT_FILES.arabic[0]); } catch { /* falls back */ }
    try { if (needOther) fonts.unicode = await loadFont(FONT_FILES.unicode[0]); } catch { /* falls back */ }
    if (fonts.arabic || fonts.unicode) enableUnicodeText(doc, fonts);
  }

  const hasCover = sections.cover !== false;
  if (hasCover) buildCover(doc, project, session, clinic);
  else doc._firstPageFree = true;
  if (sections.images !== false) await buildImages(doc, originalImageDataUrl, markupImageDataUrl);
  if (sections.measurements !== false) buildMeasurements(doc, ctx);
  if (compare && sections.comparison !== false) buildComparison(doc, ctx);
  if (sections.formulas !== false) await buildFormulas(doc, formulas, formulaValues, { renderLatex, formulaTex });
  if (sections.normograms !== false) await buildNormogram(doc, ctx);
  if (sections.airway !== false) buildAirway(doc, project, airway);
  if (sections.research !== false) await buildResearchStudies(doc, ctx);
  if (sections.interpretation !== false) buildInterpretation(doc, interpretation, cal?.done === true);

  // Header and "Page i of N" footer on every page after the cover (including
  // pages a long table continued onto).
  const total = doc.internal.getNumberOfPages();
  const first = hasCover ? 2 : 1;
  for (let i = first; i <= total; i++) {
    doc.setPage(i);
    pageHeader(doc);
    pageFooter(doc, i - first + 1, total - first + 1);
  }

  // Bookmarks (the PDF's outline / table of contents).
  try {
    if (hasCover) doc.outline.add(null, "Cover", { pageNumber: 1 });
    const parents = {};
    for (const m of doc._marks) {
      if (m.group) {
        const firstChild = doc._marks.find(x => x.parent === m.title);
        if (firstChild) parents[m.title] = doc.outline.add(null, m.title, { pageNumber: firstChild.page });
        continue;
      }
      doc.outline.add(m.parent ? parents[m.parent] || null : null, cleanText(doc, m.title), { pageNumber: m.page });
    }
  } catch { /* bookmarks are optional */ }

  doc._fileName = reportFileName(caseName);
  if (save) doc.save(doc._fileName);
  return doc;
}
