import { useRef, useMemo, useCallback, useState } from "react";
import { RULES } from "../lib/interpretation.js";
import { resolveFacing } from "../lib/measureConventions.js";
import {
  SD_RANGE, CATEGORY_ORDER, CATEGORY_LABELS, BANDS, bandOf, percentileOf, formatPercentile,
  formatMeasure, normogramRows, comparisonValues, chartLayout,
} from "../lib/normogram.js";
import PanelGuideModal from "./PanelGuideModal.jsx";

const W = 700;
const LABEL_W = 200;
const CHART_L = 40;
const CHART_R = 90;
const TOP = 56;
const ROW_H = 36;
const HEADER_H = 26;
const BOTTOM = 24;
const CHART_W = W - LABEL_W - CHART_L - CHART_R;
const CHART_X = LABEL_W + CHART_L;

const xOf = sd => CHART_X + CHART_W / 2 + sd * (CHART_W / 2 / SD_RANGE);
const clampZ = z => Math.max(-SD_RANGE, Math.min(SD_RANGE, z));
const offScale = z => Math.abs(z) > SD_RANGE;

// Dark-on-light colours for downloads that go into documents and slides.
const PRINT_T = {
  id: "print", tx: "#1a1d26", tx2: "#4a5268", tx3: "#5f6678", bdr: "#b8bfcc", surf: "#f1f3f7",
  acc: "#2563eb", ok: "#15803d", warn: "#b45309", err: "#b91c1c",
};

const toneColor = (t, z) => t[BANDS[bandOf(z)].tone];

function interpretationText(label, value, normMean) {
  try {
    const rule = RULES[label];
    if (rule && rule.interpret) return rule.interpret(value, normMean);
  } catch { return ""; }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CHART PIECES
// ═══════════════════════════════════════════════════════════════════════════════
function ChartFrame({ t, layout, svgRef, children, legend }) {
  const totalH = layout.bottom + BOTTOM;
  const span = [TOP, layout.bottom];
  const zone = (a, b, fill) => <rect x={xOf(a)} y={span[0]} width={xOf(b) - xOf(a)} height={span[1] - span[0]} fill={fill} />;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${totalH}`} role="img" aria-label="Normogram"
      style={{ maxWidth: "100%", minWidth: 560, width: 1000, height: "auto", display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
      {zone(-1, 1, t.ok + "18")}
      {zone(-2, -1, t.warn + "14")}
      {zone(1, 2, t.warn + "14")}
      {zone(-SD_RANGE, -2, t.err + "12")}
      {zone(2, SD_RANGE, t.err + "12")}
      {[-2, -1, 0, 1, 2].map(sd => (
        <g key={sd}>
          <line x1={xOf(sd)} y1={TOP - 4} x2={xOf(sd)} y2={layout.bottom + 4}
            stroke={sd === 0 ? t.tx3 : t.bdr} strokeWidth={sd === 0 ? 0.8 : 0.5} strokeDasharray={sd === 0 ? "3,3" : undefined} />
          <text x={xOf(sd)} y={TOP - 12} textAnchor="middle" fill={t.tx2} fontSize="11" fontFamily="'DM Mono',monospace">
            {sd === 0 ? "mean" : sd > 0 ? `+${sd} SD` : `${sd} SD`}
          </text>
        </g>
      ))}
      {layout.items.map((it, i) => it.kind === "header" ? (
        <g key={`h${i}`}>
          <text x={8} y={it.y + it.h / 2 + 4} fill={t.tx2} fontSize="11" fontWeight="700" letterSpacing="0.5">
            {(CATEGORY_LABELS[it.cat] || it.cat).toUpperCase()}
          </text>
          <line x1={8} y1={it.y + it.h - 2} x2={W - 8} y2={it.y + it.h - 2} stroke={t.bdr} strokeWidth="0.6" />
        </g>
      ) : (
        <g key={`r${i}`}>
          <circle cx={14} cy={it.y + it.h / 2} r={4} fill={it.row.color || t.tx3} />
          <text x={LABEL_W - 8} y={it.y + it.h / 2 + 1} textAnchor="end" dominantBaseline="middle" fill={t.tx} fontSize="12" fontWeight="600" fontFamily="'DM Mono',monospace">
            {it.row.label}{it.row.approxSd ? " ≈" : ""}
          </text>
        </g>
      ))}
      {legend}
      {children}
    </svg>
  );
}

function Legend({ t, compareName, primaryName }) {
  if (!compareName) return null;
  return (
    <g fontSize="11" fill={t.tx2}>
      <circle cx={14} cy={14} r={5} fill={t.acc} />
      <text x={24} y={18}>{primaryName}</text>
      <circle cx={200} cy={14} r={5} fill="none" stroke={t.tx2} strokeWidth="1.5" />
      <text x={210} y={18}>{compareName}</text>
    </g>
  );
}

// Marker for one value; off-scale values become an arrow at the chart edge.
function Marker({ x, y, z, color, hollow, t }) {
  if (offScale(z)) {
    const dir = z > 0 ? 1 : -1;
    const tip = x + dir * 7;
    return <polygon points={`${tip},${y} ${x - dir * 3},${y - 6} ${x - dir * 3},${y + 6}`} fill={hollow ? "none" : color} stroke={hollow ? t.tx2 : "#fff"} strokeWidth="1.2" />;
  }
  return hollow
    ? <circle cx={x} cy={y} r={5} fill="none" stroke={t.tx2} strokeWidth="1.5" />
    : <circle cx={x} cy={y} r={5.5} fill={color} stroke="#fff" strokeWidth="1.5" />;
}

const valueText = (row, fmt) => fmt(row) + (offScale(row.z) ? ` (${row.z > 0 ? "+" : ""}${row.z.toFixed(1)} SD)` : "");

// ═══════════════════════════════════════════════════════════════════════════════
// POLYGON CHART
// ═══════════════════════════════════════════════════════════════════════════════
function PolygonChart({ rows, t, fmt, svgRef, compare, compareName, primaryName }) {
  const layout = useMemo(() => chartLayout(rows, TOP, ROW_H, HEADER_H), [rows]);
  const rowItems = layout.items.filter(i => i.kind === "row");
  // One line per category, so unrelated groups are not joined.
  const lines = CATEGORY_ORDER.map(cat => rowItems.filter(i => i.row.category === cat)).filter(g => g.length > 1);
  return (
    <ChartFrame t={t} layout={layout} svgRef={svgRef} legend={<Legend t={t} compareName={compareName} primaryName={primaryName} />}>
      {compare && lines.map((g, k) => {
        const pts = g.filter(i => compare[i.row.label]).map(i => `${xOf(clampZ(compare[i.row.label].z))},${i.y + i.h / 2}`);
        return pts.length > 1 ? <polyline key={`c${k}`} points={pts.join(" ")} fill="none" stroke={t.tx2} strokeWidth="1.5" strokeDasharray="4,3" /> : null;
      })}
      {lines.map((g, k) => (
        <polyline key={k} points={g.map(i => `${xOf(clampZ(i.row.z))},${i.y + i.h / 2}`).join(" ")}
          fill="none" stroke={t.acc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.75" />
      ))}
      {rowItems.map(({ row, y, h }) => {
        const cy = y + h / 2, x = xOf(clampZ(row.z)), c = compare?.[row.label];
        return (
          <g key={row.label}>
            {c && <Marker x={xOf(clampZ(c.z))} y={cy} z={c.z} hollow t={t} />}
            <Marker x={x} y={cy} z={row.z} color={toneColor(t, row.z)} t={t} />
            <text x={Math.min(x + 12, W - 4)} y={cy + 1} dominantBaseline="middle" fill={toneColor(t, row.z)} fontSize="11" fontWeight="700" fontFamily="'DM Mono',monospace">
              {valueText(row, fmt)}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIGGLE BAR CHART (WebCeph / BCeph style)
// ═══════════════════════════════════════════════════════════════════════════════
function WiggleChart({ rows, t, fmt, svgRef, compare, compareName, primaryName }) {
  const layout = useMemo(() => chartLayout(rows, TOP, ROW_H, HEADER_H), [rows]);
  return (
    <ChartFrame t={t} layout={layout} svgRef={svgRef} legend={<Legend t={t} compareName={compareName} primaryName={primaryName} />}>
      {layout.items.filter(i => i.kind === "row").map(({ row, y, h }) => {
        const cy = y + h / 2, z = clampZ(row.z), color = toneColor(t, row.z);
        const barH = compare ? h * 0.42 : h * 0.55;
        const shift = compare ? barH / 2 + 1 : 0; // main bar above, comparison below
        const c = compare?.[row.label];
        const bar = (zz, top, height, props) => {
          const left = zz < 0 ? xOf(zz) : xOf(0);
          const w = Math.abs(xOf(zz) - xOf(0));
          return w > 0 ? <rect x={left} y={top} width={w} height={height} rx="3" {...props} /> : null;
        };
        const labelX = z < 0 ? xOf(z) - 6 : Math.max(xOf(z), xOf(0)) + 6;
        return (
          <g key={row.label}>
            {bar(z, cy - barH / 2 - shift, barH, { fill: color, opacity: 0.85 })}
            {c && bar(clampZ(c.z), cy + 1, barH, { fill: "none", stroke: t.tx2, strokeWidth: 1.2, strokeDasharray: "3,2" })}
            {offScale(row.z) && <Marker x={xOf(z)} y={cy - shift} z={row.z} color={color} t={t} />}
            <text x={labelX} y={cy - shift + 1} textAnchor={z < 0 ? "end" : "start"} dominantBaseline="middle"
              fill={color} fontSize="11" fontWeight="700" fontFamily="'DM Mono',monospace">
              {valueText(row, fmt)}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR CHART — z-score pattern (rows in category order)
// ═══════════════════════════════════════════════════════════════════════════════
function RadarChart({ rows, t, svgRef, compare, compareName, primaryName }) {
  const n = rows.length;
  if (n === 0) return null;
  const CX = 350, CY = 290, R = 190, labelR = R + 26;
  const radius = z => R * ((clampZ(z) + SD_RANGE) / (2 * SD_RANGE));
  const at = (i, z) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { angle, x: CX + radius(z) * Math.cos(angle), y: CY + radius(z) * Math.sin(angle) };
  };
  const points = rows.map((row, i) => ({ row, ...at(i, row.z) }));
  const comparePts = compare ? rows.map((row, i) => (compare[row.label] ? at(i, compare[row.label].z) : null)) : [];

  return (
    <svg ref={svgRef} viewBox="0 0 700 590" role="img" aria-label="Radar normogram"
      style={{ maxWidth: "100%", minWidth: 560, width: 1000, height: "auto", display: "block", overflow: "visible", fontFamily: "'DM Sans','DM Mono',sans-serif", userSelect: "none" }}>
      <Legend t={t} compareName={compareName} primaryName={primaryName} />
      {[-2, -1, 0, 1, 2].map(sd => (
        <g key={sd}>
          <circle cx={CX} cy={CY} r={radius(sd)} fill={sd === 0 ? t.ok + "12" : "none"}
            stroke={sd === 0 ? t.tx3 : t.bdr} strokeWidth={sd === 0 ? 0.8 : 0.6} strokeDasharray={sd === 0 ? "3,3" : "2,3"} />
          <text x={CX + 4} y={CY - radius(sd) - 4} fill={t.tx2} fontSize="10" fontFamily="'DM Mono',monospace">
            {sd === 0 ? "mean" : sd > 0 ? `+${sd} SD` : `${sd} SD`}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <line key={`s${i}`} x1={CX} y1={CY} x2={CX + R * Math.cos(p.angle)} y2={CY + R * Math.sin(p.angle)} stroke={t.bdr} strokeWidth="0.5" opacity="0.5" />
      ))}
      {compare && comparePts.filter(Boolean).length > 2 && (
        <polygon points={comparePts.filter(Boolean).map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={t.tx2} strokeWidth="1.5" strokeDasharray="4,3" />
      )}
      <polygon points={points.map(p => `${p.x},${p.y}`).join(" ")} fill={t.acc + "18"} stroke={t.acc} strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => {
        const lx = CX + labelR * Math.cos(p.angle), ly = CY + labelR * Math.sin(p.angle);
        const anchor = lx > CX + 5 ? "start" : lx < CX - 5 ? "end" : "middle";
        const c = comparePts[i];
        return (
          <g key={p.row.label}>
            {c && <circle cx={c.x} cy={c.y} r={4} fill="none" stroke={t.tx2} strokeWidth="1.5" />}
            <circle cx={p.x} cy={p.y} r={4.5} fill={toneColor(t, p.row.z)} stroke="#fff" strokeWidth="1.5" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fill={t.tx} fontSize="11" fontWeight="600" fontFamily="'DM Mono',monospace">
              {p.row.label}{offScale(p.row.z) ? (p.row.z > 0 ? " ▲" : " ▼") : ""}
            </text>
          </g>
        );
      })}
      <text x={CX} y={578} textAnchor="middle" fill={t.tx2} fontSize="11">
        The outline's shape depends on the order of the measurements — read each value against the rings.
      </text>
    </svg>
  );
}

function ChartView({ mode, ...props }) {
  if (mode === "polygon") return <PolygonChart {...props} />;
  if (mode === "wiggle") return <WiggleChart {...props} />;
  if (mode === "radar") return <RadarChart {...props} />;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY — counts per band and category
// ═══════════════════════════════════════════════════════════════════════════════
function SummaryView({ rows, t, fmt }) {
  const count = list => ({ within1: list.filter(r => bandOf(r.z) === "within1").length, "1to2": list.filter(r => bandOf(r.z) === "1to2").length, beyond2: list.filter(r => bandOf(r.z) === "beyond2").length });
  const all = count(rows);
  return (
    <div style={{ width: "100%", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" }}>
        {Object.entries(BANDS).map(([k, b]) => (
          <div key={k} style={{ background: t[b.tone] + "18", border: `1px solid ${t[b.tone]}40`, borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t[b.tone] }}>{all[k]}</div>
            <div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>{b.label}</div>
            <div style={{ fontSize: 12, color: t.tx3 }}>{rows.length ? Math.round(all[k] / rows.length * 100) + "%" : "—"}</div>
          </div>
        ))}
      </div>
      {CATEGORY_ORDER.map(cat => {
        const list = rows.filter(r => r.category === cat);
        if (!list.length) return null;
        const c = count(list);
        return (
          <div key={cat} style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 8 }}>
              {CATEGORY_LABELS[cat]} <span style={{ fontSize: 12, color: t.tx3, fontWeight: 400, marginLeft: 6 }}>{list.length} measurements</span>
            </div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
              {Object.entries(BANDS).map(([k, b]) => c[k] > 0 && <div key={k} style={{ flex: c[k], background: t[b.tone] }} />)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {list.map(r => {
                const col = toneColor(t, r.z);
                return (
                  <span key={r.label} style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, background: col + "18", color: col, border: `1px solid ${col}30`, fontWeight: 600 }}>
                    {r.label} {fmt(r)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE — sortable
// ═══════════════════════════════════════════════════════════════════════════════
function DataTable({ rows, t, fmt, compare, compareName }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const key = r => (sortCol === "label" ? r.label : sortCol === "value" ? r.value : sortCol === "z" ? r.z : r.norm.mean);
    return [...rows].sort((a, b) => {
      const va = key(a), vb = key(b);
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * dir;
    });
  }, [rows, sortCol, sortDir]);
  const toggle = col => { if (sortCol === col) setSortDir(d => (d === "asc" ? "desc" : "asc")); else { setSortCol(col); setSortDir("asc"); } };
  const th = (label, col, align = "right") => (
    <th key={label} onClick={col ? () => toggle(col) : undefined} aria-sort={col && sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
      style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: t.tx, cursor: col ? "pointer" : "default", textAlign: align, borderBottom: `2px solid ${t.bdr}`, whiteSpace: "nowrap" }}>
      {label}{col && sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
  const td = { padding: "5px 10px", fontSize: 12 };
  return (
    <div style={{ width: "100%", overflowX: "auto", fontFamily: "'DM Sans','DM Mono',sans-serif" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {th("Measurement", "label", "left")}{th("Value", "value")}{th("Norm (mean ± SD)", "mean")}{th("z", "z")}{th("Percentile", null)}{th("Band", null, "left")}
            {compare && th(compareName || "Compare", null)}{compare && th("Change", null)}
            {th("Interpretation", null, "left")}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const col = toneColor(t, row.z), c = compare?.[row.label];
            return (
              <tr key={row.label} style={{ borderBottom: `1px solid ${t.bdr}40` }}>
                <td style={{ ...td, fontWeight: 600, color: t.tx }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: row.color || t.tx3, marginRight: 6 }} />
                  {row.label}{row.approxSd ? " ≈" : ""}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: col, fontWeight: 700 }}>{fmt(row)}</td>
                <td style={{ ...td, textAlign: "right", color: t.tx2 }}>{formatMeasure(row.norm.mean, row.unit)} ± {row.norm.sd.toFixed(1)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: col, fontWeight: 700 }}>{row.z > 0 ? "+" : ""}{row.z.toFixed(2)}</td>
                <td style={{ ...td, textAlign: "right", color: t.tx2 }}>{formatPercentile(percentileOf(row.z))}</td>
                <td style={td}><span style={{ fontSize: 12, fontWeight: 700, padding: "1px 8px", borderRadius: 8, background: col + "18", color: col, whiteSpace: "nowrap" }}>{BANDS[bandOf(row.z)].label}</span></td>
                {compare && <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c ? formatMeasure(c.value, c.unit) : "—"}</td>}
                {compare && <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c ? `${row.value - c.value > 0 ? "+" : ""}${formatMeasure(row.value - c.value, row.unit)}` : "—"}</td>}
                <td style={{ ...td, color: t.tx2, maxWidth: 220, lineHeight: 1.35 }}>{interpretationText(row.label, row.value, row.norm.mean)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: t.tx3, marginTop: 6, textAlign: "center" }}>{rows.length} measurements · click a column header to sort</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The chart with a title block above it, as a standalone SVG (transparent).
function composeSvg(svgEl, lines, color) {
  const vb = svgEl.viewBox.baseVal;
  const head = 14 + lines.length * 20;
  const text = lines.map((l, i) => `<text x="8" y="${20 + i * 20}" fill="${color}" font-size="${i === 0 ? 16 : 12}" font-weight="${i === 0 ? 700 : 400}">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vb.width}" height="${vb.height + head}" viewBox="0 0 ${vb.width} ${vb.height + head}" font-family="'DM Sans','Segoe UI',Arial,sans-serif">${text}<svg x="0" y="${head}" width="${vb.width}" height="${vb.height}" viewBox="0 0 ${vb.width} ${vb.height}" overflow="visible">${svgEl.innerHTML}</svg></svg>`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export default function NormogramPanel({ markups, norms, t, formatAngle, calibration, facing, sessions = [], activeSessionId, caseName }) {
  const screenRef = useRef(null);
  const printRef = useRef(null);
  const [chartMode, setChartMode] = useState("polygon");
  const [guideKey, setGuideKey] = useState(null);
  const [compareId, setCompareId] = useState("");
  const [exportColours, setExportColours] = useState("print");

  const { rows, hiddenUncalibrated } = useMemo(() => normogramRows(markups, norms, calibration, facing), [markups, norms, calibration, facing]);
  const active = sessions.find(s => s.id === activeSessionId);
  const others = sessions.filter(s => s.id !== activeSessionId);
  const compareSession = others.find(s => s.id === compareId) || null;
  // Cheap (a few dozen rows), so computed each render.
  const compare = compareSession
    ? comparisonValues(rows, compareSession.markups, compareSession.calibration, resolveFacing(compareSession.facing, compareSession.markups))
    : null;
  const sessionName = s => (s ? [s.label, s.name].filter(Boolean).join(" · ") || "Session" : "This session");
  const primaryName = sessionName(active);
  const compareName = compareSession ? sessionName(compareSession) : null;

  const fmt = useCallback(row => formatMeasure(row.value, row.unit, formatAngle), [formatAngle]);
  const normSources = [...new Set(rows.map(r => r.norm.source).filter(Boolean))];

  const exportLines = () => [
    "Cephalometric normogram",
    [caseName, primaryName + (compareName ? ` vs ${compareName}` : ""), new Date().toLocaleDateString()].filter(Boolean).join(" · "),
    normSources.length ? `Norms: ${normSources.join("; ")}` : null,
  ].filter(Boolean);
  const exportSvgString = () => {
    const el = exportColours === "print" ? printRef.current : screenRef.current;
    if (!el) return null;
    return composeSvg(el, exportLines(), exportColours === "print" ? PRINT_T.tx : t.tx);
  };
  const downloadSVG = () => {
    const s = exportSvgString();
    if (s) saveBlob(new Blob([s], { type: "image/svg+xml" }), "normogram.svg");
  };
  const downloadPNG = () => {
    const s = exportSvgString();
    if (!s) return;
    const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0); // transparent background
      canvas.toBlob(blob => { if (blob) saveBlob(blob, "normogram.png"); URL.revokeObjectURL(url); }, "image/png");
    };
    img.src = url;
  };
  const downloadCSV = () => {
    const header = ["Category", "Measurement", "Value", "Unit", "Norm mean", "Norm SD", "SD approximate", "z", "Percentile", "Band", ...(compare ? [`${compareName} value`, "Change"] : []), "Interpretation"];
    const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(",")];
    for (const r of rows) {
      const c = compare?.[r.label];
      lines.push([
        CATEGORY_LABELS[r.category], r.label, r.value.toFixed(3), r.unit, r.norm.mean, r.norm.sd, r.approxSd ? "yes" : "no",
        r.z.toFixed(3), percentileOf(r.z).toFixed(1), BANDS[bandOf(r.z)].label,
        ...(compare ? [c ? c.value.toFixed(3) : "", c ? (r.value - c.value).toFixed(3) : ""] : []),
        interpretationText(r.label, r.value, r.norm.mean),
      ].map(q).join(","));
    }
    saveBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "normogram.csv");
  };

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: t.tx2, fontSize: 14, lineHeight: 1.6 }}>
        No measurements with norms found. Add norms in the Measurements panel.
        {hiddenUncalibrated > 0 && <div style={{ color: t.warn, marginTop: 8 }}>{hiddenUncalibrated} distance or area measurement{hiddenUncalibrated === 1 ? " is" : "s are"} hidden until the image is calibrated (norms are in mm).</div>}
      </div>
    );
  }

  const chartProps = { mode: chartMode, rows, fmt, compare, compareName, primaryName };
  const isChart = ["polygon", "wiggle", "radar"].includes(chartMode);
  const btn = primary => ({ padding: "6px 14px", borderRadius: 6, border: primary ? "none" : `1px solid ${t.bdr}`, background: primary ? t.acc : t.surf2, color: primary ? t.bg : t.tx, cursor: "pointer", fontSize: 12, fontWeight: 700 });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
        <div role="tablist" aria-label="Normogram view" style={{ display: "flex", flexWrap: "wrap", gap: 4, background: t.surf2, borderRadius: 8, padding: 3, border: `1px solid ${t.bdr}` }}>
          {[
            { id: "polygon", label: "Polygon", icon: "⬡" },
            { id: "wiggle", label: "Wiggle", icon: "▬" },
            { id: "radar", label: "Radar", icon: "◎" },
            { id: "summary", label: "Summary", icon: "☰" },
            { id: "table", label: "Table", icon: "⊞" },
          ].map(mode => (
            <button key={mode.id} role="tab" aria-selected={chartMode === mode.id} onClick={() => setChartMode(mode.id)}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: chartMode === mode.id ? t.acc : "transparent",
                color: chartMode === mode.id ? (t.id === "light" || t.id === "paper" ? "#fff" : t.bg) : t.tx2, fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <span aria-hidden="true" style={{ fontSize: 13 }}>{mode.icon}</span> {mode.label}
            </button>
          ))}
        </div>
        {others.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.tx2 }}>
            Compare with
            <select value={compareId} onChange={e => setCompareId(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12, fontFamily: "inherit" }}>
              <option value="">No comparison</option>
              {others.map(s => <option key={s.id} value={s.id}>{sessionName(s)}</option>)}
            </select>
          </label>
        )}
        <button onClick={() => setGuideKey("normogram")} title="Guide" aria-label="Normogram guide"
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 20, height: 20, fontSize: 11, lineHeight: "18px", textAlign: "center", cursor: "pointer", padding: 0 }}>?</button>
      </div>

      <div style={{ width: "100%", maxWidth: 820, overflowX: "auto" }}>
        {isChart && <ChartView {...chartProps} t={t} svgRef={screenRef} />}
        {chartMode === "summary" && <SummaryView rows={rows} t={t} fmt={fmt} />}
        {chartMode === "table" && <DataTable rows={rows} t={t} fmt={fmt} compare={compare} compareName={compareName} />}
      </div>
      {/* Print-colour copy of the chart, used for downloads only. */}
      {isChart && exportColours === "print" && (
        <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, width: 1000, pointerEvents: "none", visibility: "hidden" }}>
          <ChartView {...chartProps} t={PRINT_T} svgRef={printRef} />
        </div>
      )}

      <div style={{ fontSize: 12, color: t.tx3, marginTop: 8, textAlign: "center", lineHeight: 1.6, maxWidth: 720 }}>
        {normSources.length > 0 && <div>Norms: {normSources.join("; ")}</div>}
        {rows.some(r => r.approxSd) && <div>≈ the published source gives no exact SD for this norm; its position is indicative.</div>}
        {rows.some(r => Math.abs(r.z) > SD_RANGE) && <div>Arrows at the edge mark values beyond ±{SD_RANGE} SD; the value shows its z-score.</div>}
        {hiddenUncalibrated > 0 && <div style={{ color: t.warn }}>{hiddenUncalibrated} distance or area measurement{hiddenUncalibrated === 1 ? " is" : "s are"} hidden until the image is calibrated (norms are in mm).</div>}
        {compare && Object.keys(compare).length < rows.length && <div>{rows.length - Object.keys(compare).length} measurement(s) are missing in {compareName}.</div>}
      </div>

      {isChart && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.tx2 }}>
            Colours
            <select value={exportColours} onChange={e => setExportColours(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 12, fontFamily: "inherit" }}>
              <option value="print">Print (dark text)</option>
              <option value="screen">As on screen</option>
            </select>
          </label>
          <button onClick={downloadSVG} style={btn(false)}>Download SVG</button>
          <button onClick={downloadPNG} style={btn(true)}>Download PNG</button>
        </div>
      )}
      {chartMode === "table" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
          <button onClick={downloadCSV} style={btn(true)}>Download CSV</button>
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
