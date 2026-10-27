// ═══════════════════════════════════════════════════════════════════════════════
// studyReportExport.js — printable study report (PDF) and Word document (A12)
//
// Both contain: title, date, warnings, summary, methods (APA), results (APA),
// result tables and references. The Word file is HTML saved as .doc, which Word,
// LibreOffice and Google Docs open with formatting (italics, tables) intact.
// ═══════════════════════════════════════════════════════════════════════════════

import { summarizeStudy, methodsText, resultsText, referencesFor, stripTags } from "./studyReport.js";
import { buildResultsTables } from "./resultsExport.js";
import { collectStudyWarnings } from "./studyWarnings.js";
import { STUDY_TYPES } from "./studyModel.js";

export const fmtCell = v => {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    if (!isFinite(v)) return "";
    if (Math.abs(v) > 0 && Math.abs(v) < 0.001) return v.toExponential(2);
    return Number.isInteger(v) ? String(v) : v.toFixed(3);
  }
  return String(v);
};

const safeName = s => String(s || "study").replace(/[^\w-]+/g, "_");

// jsPDF's standard fonts cover Latin-1 only: spell out Greek letters and symbols.
const PDF_MAP = { "η": "eta", "χ": "chi", "α": "alpha", "ε": "epsilon", "ρ": "rho", "σ": "sigma", "Σ": "sum", "√": "sqrt", "≥": ">=", "≤": "<=", "→": "->", "−": "-", "–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "•": "-", "±": "+/-" };
export const pdfSafe = text => String(text).replace(/[ηχαερσΣ√≥≤→−–—’‘“”•±]/g, ch => PDF_MAP[ch] ?? ch);
const escHtml = s => String(s).replace(/&(?!lt;|gt;|amp;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function studyReportContent(study, status) {
  const typeName = STUDY_TYPES.find(s => s.id === study.type)?.name || study.type;
  const summary = summarizeStudy(study);
  return {
    title: study.name,
    subtitle: `${typeName}${/stud(y|ies)$/i.test(typeName) ? "" : " study"} · ${new Date(study.lastRun?.at || study.updatedAt || Date.now()).toLocaleDateString()}`,
    warnings: collectStudyWarnings(study, { status }).map(w => w.text),
    summary,
    methods: methodsText(study).html,
    results: resultsText(study),
    tables: buildResultsTables(study),
    references: referencesFor(study),
    notes: study.config?.notes || "",
  };
}

export function studyReportHTML(content) {
  const table = t => `<h3>${escHtml(t.title)}</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:9pt">
<tr>${t.header.map(h => `<th style="background:#eee">${escHtml(h)}</th>`).join("")}</tr>
${t.rows.map(r => `<tr>${r.map(c => `<td>${escHtml(fmtCell(c))}</td>`).join("")}</tr>`).join("\n")}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(content.title)}</title>
<style>body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5;max-width:780px;margin:24px auto}h1{font-size:16pt}h2{font-size:13pt;margin-top:18pt}h3{font-size:11pt}p.ref{padding-left:2em;text-indent:-2em}.warn{color:#8a5a00}</style></head><body>
<h1>${escHtml(content.title)}</h1><p>${escHtml(content.subtitle)}</p>
${content.notes ? `<p><b>Notes.</b> ${escHtml(content.notes)}</p>` : ""}
${content.warnings.length ? `<h2>Caveats</h2><ul>${content.warnings.map(w => `<li class="warn">${escHtml(w)}</li>`).join("")}</ul>` : ""}
<h2>Summary</h2><p>${escHtml(content.summary.headline)}</p>
<h2>Methods</h2><p>${content.methods}</p>
<h2>Results</h2><p>${content.results}</p>
${content.tables.map(table).join("\n")}
<h2>References</h2>${content.references.map(r => `<p class="ref">${r}</p>`).join("")}
</body></html>`;
}

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export function exportStudyWord(study, status) {
  const html = studyReportHTML(studyReportContent(study, status));
  download(new Blob(["﻿" + html], { type: "application/msword" }), `${safeName(study.name)}_report.doc`);
}

// Builds the PDF document (no download) — separated for testing.
export async function buildStudyPDF(study, status) {
  const [{ jsPDF }, { applyPlugin }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  applyPlugin(jsPDF);
  const c = studyReportContent(study, status);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16, BW = W - 2 * M;
  let y = M;
  const ensure = h => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const para = (text, size = 10, style = "normal", color = [20, 20, 20]) => {
    doc.setFont("times", style); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(pdfSafe(stripTags(text)), BW)) { ensure(size * 0.5); doc.text(line, M, y); y += size * 0.45; }
    y += 2;
  };
  const heading = text => { y += 2; ensure(10); para(text, 12, "bold"); };

  para(c.title, 16, "bold");
  para(c.subtitle, 9, "normal", [90, 90, 90]);
  if (c.notes) para(`Notes. ${c.notes}`, 9);
  if (c.warnings.length) { heading("Caveats"); c.warnings.forEach(w => para(`• ${w}`, 9, "normal", [140, 90, 0])); }
  heading("Summary"); para(c.summary.headline);
  heading("Methods"); para(c.methods);
  heading("Results"); para(c.results);
  for (const t of c.tables) {
    ensure(20); para(t.title, 10, "bold");
    doc.autoTable({
      startY: y, head: [t.header.map(pdfSafe)], body: t.rows.map(r => r.map(v => pdfSafe(fmtCell(v)))),
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2 }, headStyles: { fillColor: [230, 230, 230], textColor: 20 },
      margin: { left: M, right: M }, theme: "grid",
    });
    y = doc.lastAutoTable.finalY + 6;
  }
  heading("References");
  c.references.forEach(r => para(r, 9));
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(pdfSafe(`Cephalometry Studio - ${c.title} - ${i}/${pages}`), M, H - 8);
  }
  return doc;
}

export async function exportStudyPDF(study, status) {
  const doc = await buildStudyPDF(study, status);
  doc.save(`${safeName(study.name)}_report.pdf`);
}
