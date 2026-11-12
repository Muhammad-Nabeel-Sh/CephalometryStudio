// ═══════════════════════════════════════════════════════════════════════════════
// STUDY RESULTS VIEW — the results as a manuscript page: summary, tables,
// figures, then methods, results text and references, printed on white or dark
// paper. Caveats sit beside the page as notes. The per-type result tables and
// charts are the existing components, drawn with the paper's theme.
// Exports live in the workspace header (studyExports.js).
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
import { summarizeStudy, methodsText, resultsText, referencesFor, stripTags } from "./studyReport.js";
import { collectStudyWarnings } from "./studyWarnings.js";
import { glossaryFor } from "./glossary.js";
import { useUIStore } from "../state/uiStore.js";
import { Chip } from "../ui/ui.jsx";
import { paperTheme, sheetBackground } from "./paper.js";

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

const NOTE_COLOR = { error: "err", warn: "warn", info: "tx3" };
const FLAG = { sig: ["●", "acc", "significant or notable"], warn: ["▲", "warn", "needs attention"], ok: ["○", "tx3", "not significant"] };
const SERIF = "'Source Serif 4', Georgia, serif";
const SANS = "'DM Sans', sans-serif";
const THEME_DARK_SWATCH = "#1a1a22";

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

const FIX_LABEL = { run: "Re-run", data: "Check data", setup: "Fix in setup" };

function Notes({ t, warnings, onFix, side }) {
  if (!warnings.length) return null;
  return (
    <aside aria-label="Notes on these results" style={{ display: "flex", flexDirection: "column", gap: side ? 18 : 8, paddingTop: side ? 36 : 0, order: side ? 0 : -1 }}>
      {warnings.map((w, i) => {
        const col = t[NOTE_COLOR[w.level] || "tx3"];
        return (
          <div key={i} style={{ borderLeft: `2px solid ${col}`, borderRadius: 0, paddingLeft: 10, fontSize: 12.5, lineHeight: 1.5, color: t.tx2 }}>
            <span style={{ color: w.level === "info" ? t.tx2 : col }}>{w.text}</span>
            {w.fix && onFix && (
              <button onClick={() => onFix(w.fix)} style={{ display: "block", marginTop: 4, padding: 0, border: "none", background: "none", color: t.acc, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                {FIX_LABEL[w.fix] || "Fix in setup"}
              </button>
            )}
          </div>
        );
      })}
    </aside>
  );
}

function Summary({ pt, study, onFix }) {
  const s = useMemo(() => summarizeStudy(study), [study]);
  return (
    <header style={{ marginBottom: 28 }}>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: 21, lineHeight: 1.35, color: pt.tx }}>{s.headline}</p>
      {s.findings.length > 0 && (
        <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {s.findings.map((f, i) => {
            const [icon, col, meaning] = FLAG[f.flag] || FLAG.ok;
            return (
              <li key={i} style={{ fontFamily: SERIF, fontSize: 14, color: pt.tx2, lineHeight: 1.55, display: "flex", gap: 10 }}>
                <span aria-label={meaning} title={meaning} style={{ color: pt[col], width: 12, flexShrink: 0, fontFamily: SANS }}>{icon}</span>
                <span><span style={{ color: pt.tx, fontWeight: 600 }}>{f.label}</span>: {f.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {s.skipped.length > 0 && (
        <p style={{ margin: "12px 0 0", fontFamily: SANS, fontSize: 12.5, color: pt.warn }}>
          {s.skipped.length} measurement{s.skipped.length > 1 ? "s" : ""} couldn't be analyzed: {s.skipped.slice(0, 4).map(x => x.label).join(", ")}{s.skipped.length > 4 ? "…" : ""}.
          {onFix && <button onClick={() => onFix("setup")} style={{ marginLeft: 8, padding: 0, border: "none", background: "none", color: pt.acc, fontSize: 12.5, fontFamily: SANS, cursor: "pointer" }}>Fix in setup</button>}
        </p>
      )}
    </header>
  );
}

function SectionTitle({ pt, children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "28px 0 8px" }}>
      <h3 style={{ margin: 0, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: pt.tx }}>{children}</h3>
      {action}
    </div>
  );
}

function Writeup({ pt, study }) {
  const m = useMemo(() => methodsText(study), [study]);
  const r = useMemo(() => resultsText(study), [study]);
  const refs = useMemo(() => referencesFor(study), [study]);
  const [copied, setCopied] = useState("");
  const copy = async (key, html) => { const ok = await copyRich(html); setCopied(ok ? key : "failed"); setTimeout(() => setCopied(""), 1800); };
  const copyBtn = (key, html, what) => (
    <button onClick={() => copy(key, html)} aria-label={`Copy ${what}`}
      style={{ padding: 0, border: "none", background: "none", color: pt.acc, fontSize: 12.5, fontFamily: SANS, cursor: "pointer" }}>
      {copied === key ? "Copied" : copied === "failed" ? "Couldn't copy" : "Copy"}
    </button>
  );
  const prose = { margin: 0, fontFamily: SERIF, fontSize: 14, lineHeight: 1.7, color: pt.tx2, maxWidth: "68ch" };
  return (
    <section aria-label="Methods and results text">
      <SectionTitle pt={pt} action={copyBtn("m", `<p>${m.html}</p>`, "methods")}>Methods</SectionTitle>
      <p style={prose} dangerouslySetInnerHTML={{ __html: m.html }} />
      {r && <>
        <SectionTitle pt={pt} action={copyBtn("r", `<p>${r}</p>`, "results")}>Results</SectionTitle>
        <p style={prose} dangerouslySetInnerHTML={{ __html: r }} />
      </>}
      <SectionTitle pt={pt} action={copyBtn("ref", refs.map(x => `<p>${x}</p>`).join(""), "references")}>References</SectionTitle>
      {refs.map((x, i) => <p key={i} style={{ ...prose, fontSize: 13, margin: "0 0 4px", paddingLeft: "2em", textIndent: "-2em" }} dangerouslySetInnerHTML={{ __html: x }} />)}
      <p style={{ margin: "16px 0 0", fontFamily: SANS, fontSize: 12, color: pt.tx3 }}>
        APA 7 style, written from this run. It says what was computed, not why, so check it against your protocol before you paste it.
      </p>
    </section>
  );
}

function GlossaryPanel({ t, type }) {
  const [q, setQ] = useState("");
  const items = glossaryFor(type).filter(g => !q || (g.term + g.text).toLowerCase().includes(q.toLowerCase()));
  return (
    <section aria-label="Glossary" style={{ marginTop: 20, padding: "14px 16px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search terms" aria-label="Search glossary"
        style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
      <dl style={{ margin: 0, display: "grid", gap: 10 }}>
        {items.map(g => (
          <div key={g.term}>
            <dt style={{ fontSize: 13, fontWeight: 600, color: g.types.includes(type) ? t.tx : t.tx2 }}>{g.term}</dt>
            <dd style={{ margin: "2px 0 0", fontSize: 12.5, color: t.tx2, lineHeight: 1.55 }}>{g.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function StudyResultsView({ t, study, status, onFix, wide }) {
  const [view, setView] = useState(wide ? "both" : "tables");
  const [glossary, setGlossary] = useState(false);
  const paper = useUIStore(s => s.researchPaper) === "dark" ? "dark" : "white";
  const pt = paperTheme(paper, t);
  const warnings = useMemo(() => collectStudyWarnings(study, { status }), [study, status]);
  const [Tables, Charts] = VIEWS[study.type] || [];

  if (!study.results) return <div style={{ fontSize: 13, color: t.tx3, padding: 24, textAlign: "center" }}>No results yet. Run the analysis first.</div>;

  const layout = wide ? [["tables", "Tables"], ["charts", "Charts"], ["both", "Side by side"]] : [["tables", "Tables"], ["charts", "Charts"]];
  const shown = !wide && view === "both" ? "tables" : view;
  const side = wide && warnings.length > 0;
  const paperBtn = (mode, label) => (
    <button role="radio" aria-checked={paper === mode} onClick={() => useUIStore.setState({ researchPaper: mode })}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
        border: `1px solid ${paper === mode ? t.acc : t.bdr}`, background: paper === mode ? t.acc + "22" : "transparent", color: paper === mode ? t.tx : t.tx2 }}>
      <span aria-hidden="true" style={{ width: 10, height: 12, borderRadius: 2, border: `1px solid ${t.tx3}`, background: mode === "white" ? "#ffffff" : THEME_DARK_SWATCH }} />
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div role="group" aria-label="Layout" style={{ display: "flex", gap: 4 }}>
          {layout.map(([id, label]) => <Chip key={id} t={t} on={shown === id} onClick={() => setView(id)}>{label}</Chip>)}
        </div>
        <span style={{ flex: 1 }} />
        <div role="radiogroup" aria-label="Paper" style={{ display: "flex", gap: 4 }}>
          {paperBtn("white", "White paper")}
          {paperBtn("dark", "Dark paper")}
        </div>
        <Chip t={t} on={glossary} onClick={() => setGlossary(v => !v)}>Glossary</Chip>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: side ? "minmax(0, 1fr) 220px" : "minmax(0, 1fr)", gap: side ? 24 : 12, alignItems: "start" }}>
        <article data-paper={paper} className="rs-sheet"
          style={{ "--rs-rule": pt.tx, background: sheetBackground(paper, pt), color: pt.tx, borderRadius: 4, padding: wide ? "40px 48px" : "22px 18px",
            border: paper === "dark" ? `1px solid ${pt.bdr}` : "none", minWidth: 0 }}>
          {study.results.error
            ? <p style={{ margin: 0, fontFamily: SANS, fontSize: 14, color: pt.err }}>The analysis stopped with an error: {String(study.results.error)}</p>
            : <Summary pt={pt} study={study} onFix={onFix} />}
          {Tables && (
            <div style={{ display: "grid", gridTemplateColumns: shown === "both" ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
              {shown !== "charts" && (
                <section aria-label="Tables" style={{ minWidth: 0, overflowX: "auto" }}>
                  {/* The result tables were drawn small; this scales them to reading size. */}
                  <div className="rs-tables" style={{ zoom: 1.15, fontVariantNumeric: "tabular-nums", minWidth: 0 }}>
                    <Tables results={study.results} t={pt} />
                  </div>
                </section>
              )}
              {shown !== "tables" && Charts && (
                <section aria-label="Figures" style={{ minWidth: 0 }}>
                  <Charts key={paper} results={study.results} t={pt} /* Plotly keeps its first colours */ />
                </section>
              )}
            </div>
          )}
          {!study.results.error && <Writeup pt={pt} study={study} />}
        </article>
        <Notes t={t} warnings={warnings} onFix={onFix} side={side} />
      </div>

      {glossary && <GlossaryPanel t={t} type={study.type} />}
    </div>
  );
}

