// ═══════════════════════════════════════════════════════════════════════════════
// STUDY RESULTS VIEW — summary, caveats, tables/charts, exports, APA text, glossary
// (A4, A8, A9, A10, A11, A12, A13, A15). The per-type result tables and charts
// are the existing components, rendered unchanged.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { ReliabilityResults } from "./ReliabilityPanel.jsx";
import { DescriptiveResults } from "./DescriptivePanel.jsx";
import { ComparativeResults } from "./ComparativePanel.jsx";
import { LongitudinalResults } from "./LongitudinalPanel.jsx";
import { CorrelationResults } from "./CorrelationPanel.jsx";
import { DiagnosticResults } from "./DiagnosticPanel.jsx";
import { SuperimpositionResults } from "./SuperimpositionPanel.jsx";
import { AirwayStudyResults } from "./AirwayStudyPanel.jsx";
import { ReliabilityCharts, DescriptiveCharts, ComparativeCharts, LongitudinalCharts, CorrelationCharts, DiagnosticCharts, SuperimpositionCharts, AirwayCharts } from "./moduleCharts.jsx";
import { exportResultsCSV, buildResultsTables, tablesToTSV } from "./resultsExport.js";
import { exportStudyPDF, exportStudyWord } from "./studyReportExport.js";
import { summarizeStudy, methodsText, resultsText, referencesFor, stripTags } from "./studyReport.js";
import { collectStudyWarnings } from "./studyWarnings.js";
import { glossaryFor } from "./glossary.js";

const VIEWS = {
  reliability: [ReliabilityResults, ReliabilityCharts],
  descriptive: [DescriptiveResults, DescriptiveCharts],
  comparative: [ComparativeResults, ComparativeCharts],
  longitudinal: [LongitudinalResults, LongitudinalCharts],
  correlation: [CorrelationResults, CorrelationCharts],
  diagnostic: [DiagnosticResults, DiagnosticCharts],
  superimposition: [SuperimpositionResults, SuperimpositionCharts],
  airway: [AirwayStudyResults, AirwayCharts],
};

const LEVEL = { error: ["✕", "err"], warn: ["!", "warn"], info: ["i", "tx3"] };
const FLAG = { sig: ["●", "acc", "significant / notable"], warn: ["▲", "warn", "needs attention"], ok: ["○", "tx3", "not significant"] };

async function copyRich(html) {
  const plain = stripTags(html);
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      })]);
      return true;
    }
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

function Btn({ t, onClick, children, active, title, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        border: `1px solid ${active ? t.acc : t.bdr}`, background: active ? t.acc + "22" : "transparent", color: active ? t.acc : t.tx, fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

export function WarningsStrip({ t, warnings, onFix }) {
  if (!warnings.length) return null;
  return (
    <div role="list" aria-label="Caveats" style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      {warnings.map((w, i) => {
        const [icon, col] = LEVEL[w.level] || LEVEL.info;
        return (
          <div role="listitem" key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 10px", borderRadius: 6, background: t[col] + "14", border: `1px solid ${t[col]}33`, fontSize: 12, color: t.tx, lineHeight: 1.45 }}>
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: 8, background: t[col], color: t.bg, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <span style={{ flex: 1 }}>{w.text}</span>
            {w.fix && onFix && <button onClick={() => onFix(w.fix)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.acc, cursor: "pointer", flexShrink: 0 }}>{w.fix === "run" ? "Re-run" : w.fix === "data" ? "Check data" : "Fix in setup"}</button>}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ t, study, onFix }) {
  const s = useMemo(() => summarizeStudy(study), [study]);
  return (
    <section aria-label="Summary" style={{ padding: "12px 14px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.tx, marginBottom: s.findings.length ? 8 : 0, lineHeight: 1.4 }}>{s.headline}</div>
      {s.findings.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {s.findings.map((f, i) => {
            const [icon, col, meaning] = FLAG[f.flag] || FLAG.ok;
            return (
              <li key={i} style={{ fontSize: 12.5, color: t.tx2, lineHeight: 1.45, display: "flex", gap: 8 }}>
                <span aria-label={meaning} title={meaning} style={{ color: t[col], width: 12, flexShrink: 0 }}>{icon}</span>
                <span><b style={{ color: t.tx }}>{f.label}</b> — {f.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {s.skipped.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: t.warn }}>
          {s.skipped.length} measurement{s.skipped.length > 1 ? "s" : ""} could not be analyzed: {s.skipped.slice(0, 4).map(x => x.label).join(", ")}{s.skipped.length > 4 ? "…" : ""}.
          {onFix && <button onClick={() => onFix("setup")} style={{ marginLeft: 8, fontSize: 11, padding: "1px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.acc, cursor: "pointer" }}>Fix in setup</button>}
        </div>
      )}
    </section>
  );
}

function TextPanel({ t, study }) {
  const m = useMemo(() => methodsText(study), [study]);
  const r = useMemo(() => resultsText(study), [study]);
  const refs = useMemo(() => referencesFor(study), [study]);
  const [copied, setCopied] = useState("");
  const copy = async (key, html) => { const ok = await copyRich(html); setCopied(ok ? key : "failed"); setTimeout(() => setCopied(""), 1800); };
  const block = (key, title, html, isList) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.3 }}>{title}</span>
        <button onClick={() => copy(key, isList ? html.map(x => `<p>${x}</p>`).join("") : `<p>${html}</p>`)}
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
          {copied === key ? "Copied ✓" : copied === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
      {isList
        ? html.map((x, i) => <p key={i} style={{ margin: "0 0 4px", paddingLeft: "2em", textIndent: "-2em", fontSize: 12.5, color: t.tx2, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: x }} />)
        : <p style={{ margin: 0, fontSize: 13, color: t.tx2, lineHeight: 1.6, fontFamily: "Georgia, 'Times New Roman', serif" }} dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
  return (
    <section aria-label="Methods and results text" style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: t.tx3, marginBottom: 8 }}>APA 7 style, generated from this run. Check it against your protocol before pasting — it describes what was computed, not why.</div>
      {block("m", "Methods", m.html)}
      {r && block("r", "Results", r)}
      {block("ref", "References", refs, true)}
    </section>
  );
}

function GlossaryPanel({ t, type }) {
  const [q, setQ] = useState("");
  const items = glossaryFor(type).filter(g => !q || (g.term + g.text).toLowerCase().includes(q.toLowerCase()));
  return (
    <section aria-label="Glossary" style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, marginBottom: 12 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search terms…" aria-label="Search glossary"
        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12, marginBottom: 8, boxSizing: "border-box" }} />
      <dl style={{ margin: 0, display: "grid", gap: 8 }}>
        {items.map(g => (
          <div key={g.term}>
            <dt style={{ fontSize: 12.5, fontWeight: 700, color: g.types.includes(type) ? t.tx : t.tx2 }}>{g.term}</dt>
            <dd style={{ margin: "2px 0 0", fontSize: 12, color: t.tx2, lineHeight: 1.5 }}>{g.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function StudyResultsView({ t, study, status, onFix, wide }) {
  const [view, setView] = useState(wide ? "both" : "tables");
  const [panel, setPanel] = useState(null); // "text" | "glossary" | null
  const [msg, setMsg] = useState("");
  const warnings = useMemo(() => collectStudyWarnings(study, { status }), [study, status]);
  const [Tables, Charts] = VIEWS[study.type] || [];
  const flash = text => { setMsg(text); setTimeout(() => setMsg(""), 2200); };

  const copyTable = async () => {
    const tsv = tablesToTSV(buildResultsTables(study));
    try { await navigator.clipboard.writeText(tsv); flash("Table copied — paste into Excel or Word."); } catch { flash("Copy failed — your browser blocked clipboard access."); }
  };
  const pdf = async () => {
    flash("Building PDF…");
    try { await exportStudyPDF(study, status); flash("PDF saved."); } catch (e) { flash(`PDF failed: ${e?.message || e}`); }
  };

  if (!study.results) return <div style={{ fontSize: 13, color: t.tx3, padding: 24, textAlign: "center" }}>No results yet — run the analysis first.</div>;

  return (
    <div>
      <WarningsStrip t={t} warnings={warnings} onFix={onFix} />
      {!study.results.error && <SummaryCard t={t} study={study} onFix={onFix} />}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <div role="group" aria-label="View" style={{ display: "flex", gap: 4 }}>
          <Btn t={t} active={view === "tables"} onClick={() => setView("tables")}>Tables</Btn>
          <Btn t={t} active={view === "charts"} onClick={() => setView("charts")}>Charts</Btn>
          <Btn t={t} active={view === "both"} onClick={() => setView("both")}>Side by side</Btn>
        </div>
        <span style={{ width: 1, height: 22, background: t.bdr, margin: "0 4px" }} />
        <Btn t={t} active={panel === "text"} onClick={() => setPanel(p => (p === "text" ? null : "text"))} title="Ready-to-paste APA methods and results text">Methods &amp; results text</Btn>
        <Btn t={t} active={panel === "glossary"} onClick={() => setPanel(p => (p === "glossary" ? null : "glossary"))}>Glossary</Btn>
        <span style={{ flex: 1 }} />
        <Btn t={t} onClick={copyTable} title="Copy the result tables (tab-separated)">Copy table</Btn>
        <Btn t={t} onClick={() => exportResultsCSV(study)}>CSV</Btn>
        <Btn t={t} onClick={pdf}>PDF report</Btn>
        <Btn t={t} onClick={() => { exportStudyWord(study, status); flash("Word document saved."); }}>Word</Btn>
      </div>
      {msg && <div role="status" style={{ fontSize: 12, color: t.acc, marginBottom: 8 }}>{msg}</div>}

      {panel === "text" && <TextPanel t={t} study={study} />}
      {panel === "glossary" && <GlossaryPanel t={t} type={study.type} />}

      {Tables && (
        <div style={{ display: "grid", gridTemplateColumns: view === "both" && wide ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          {view !== "charts" && (
            // Readability (A11): the result tables were drawn at 8–10 px; scale them up here.
            <div className="rs-tables" style={{ zoom: 1.2, fontVariantNumeric: "tabular-nums", minWidth: 0 }}>
              <Tables results={study.results} t={t} />
            </div>
          )}
          {view !== "tables" && Charts && <div style={{ minWidth: 0 }}><Charts results={study.results} t={t} /></div>}
        </div>
      )}
    </div>
  );
}
