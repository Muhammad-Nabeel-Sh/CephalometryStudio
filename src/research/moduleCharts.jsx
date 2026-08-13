import { useRef, useEffect } from "react";
import { ChartCard, FONT, FONT_STACK, PALETTE, fmtP } from "./moduleChartsUtils.jsx";
import PlotlyChart, { heatmapLayout, heatmapData } from "./PlotlyChart.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// RELIABILITY CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function ReliabilityCharts({ results, t }) {
  const details = (results.details || []).filter(d => !d.skip);
  if (details.length === 0)
    return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ICCForestPlot details={details} t={t} />
      <ICCBarPlot details={details} t={t} />
      <CollectiveBlandAltman details={details} t={t} />
      <ErrorMapPlot results={results} t={t} />
      <MethodErrorBarPlot details={details} t={t} />
    </div>
  );
}

function ICCForestPlot({ details, t }) {
  if (details.length === 0) return null;
  const labels = details.map(d => d.label);
  const iccVals = details.map(d => d.icc);
  const ciL = details.map(d => d.ci95?.[0] ?? d.icc - 0.2);
  const ciU = details.map(d => d.ci95?.[1] ?? d.icc + 0.2);
  const colors = details.map(d => d.icc >= 0.9 ? t.ok : d.icc >= 0.75 ? t.acc : d.icc >= 0.5 ? t.warn : t.err);
  const xMin = Math.min(0, ...ciL) - 0.1;
  const xMax = Math.max(1, ...ciU) + 0.1;

  const ciTrace = {
    type: "scatter", mode: "markers",
    x: iccVals, y: labels,
    marker: { color: colors, size: 10, symbol: "diamond", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: iccVals.map((v, i) => ciU[i] - v),
      arrayminus: iccVals.map((v, i) => v - ciL[i]),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.3f} [%{customdata[0]:.3f}, %{customdata[1]:.3f}]<extra></extra>",
    customdata: iccVals.map((v, i) => [ciL[i], ciU[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 180, r: 60, t: 15, b: 45 },
    xaxis: { title: "Intraclass Correlation Coefficient (ICC)", range: [xMin, xMax], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: { text: "Landmark", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(220, details.length * 30 + 50),
    shapes: [{
      type: "line", x0: 0.75, x1: 0.75, y0: -0.5, y1: labels.length - 0.5,
      line: { color: t.tx + "70", width: 1, dash: "dash" }, layer: "below",
    }],
    annotations: [{
      x: 0.75, y: 1, xref: "x", yref: "paper",
      text: "ICC=0.75", showarrow: false, font: { size: 10, color: t.tx3 },
      yanchor: "bottom", xanchor: "center",
    }],
  };

  return <ChartCard title="ICC Forest Plot — All Landmarks" t={t}>
    <PlotlyChart data={[ciTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function ICCBarPlot({ details, t }) {
  const chartable = details.filter(d => d.icc != null);
  if (chartable.length === 0) return null;
  const sorted = [...chartable].sort((a, b) => b.icc - a.icc);
  const labels = sorted.map(d => `${d.label}  [${d.icc.toFixed(3)}]`);
  const iccVals = sorted.map(d => d.icc);
  const ciL = sorted.map(d => d.ci95?.[0] ?? d.icc - 0.2);
  const ciU = sorted.map(d => d.ci95?.[1] ?? d.icc + 0.2);
  const colors = sorted.map(d => d.icc >= 0.9 ? t.ok : d.icc >= 0.75 ? t.acc : d.icc >= 0.5 ? t.warn : t.err);
  const xMin = Math.min(0, ...ciL) - 0.05;
  const xMax = Math.max(1, ...ciU) + 0.05;

  const barTrace = {
    type: "bar", orientation: "h",
    y: labels, x: iccVals,
    marker: { color: colors, opacity: 0.75 },
    text: iccVals.map(v => v.toFixed(3)),
    textposition: "outside",
    textfont: { size: 9, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.3f} [%{customdata[0]:.3f}, %{customdata[1]:.3f}]<extra></extra>",
    customdata: iccVals.map((v, i) => [ciL[i], ciU[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 180, r: 70, t: 15, b: 45 },
    xaxis: { title: "ICC (ranked)", range: [xMin, xMax], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: { text: "Landmark", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(220, sorted.length * 30 + 50),
    bargap: 0.25,
    shapes: [{
      type: "line", x0: 0.75, x1: 0.75, y0: -0.5, y1: labels.length - 0.5,
      line: { color: t.tx + "70", width: 1, dash: "dash" }, layer: "below",
    }],
    annotations: [{
      x: 0.75, y: 1, xref: "x", yref: "paper",
      text: "ICC=0.75", showarrow: false, font: { size: 10, color: t.tx3 },
      yanchor: "bottom", xanchor: "center",
    }],
  };

  return <ChartCard title="ICC Ranked Bar — All Landmarks" t={t}>
    <PlotlyChart data={[barTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function CollectiveBlandAltman({ details, t }) {
  const chartable = details.filter(d => d.meanDiff != null).slice(0, 8);
  if (chartable.length === 0) return null;
  const COLORS = [t.acc, t.err, t.warn, t.ok, t.tx2, "#a78bfa", "#f472b6", "#34d399"];
  const unit = chartable[0]?.unit || "";
  const u = unit ? ` (${unit})` : "";

  const points = chartable.flatMap((d, idx) =>
    (d.points || []).map(p => ({ label: d.label, mean: p.mean, diff: p.diff, idx }))
  );
  const xMin = Math.min(...points.map(v => v.mean)) - 10;
  const xMax = Math.max(...points.map(v => v.mean)) + 10;
  const allDiffs = chartable.map(d => d.meanDiff);
  const allMargins = chartable.map(d => d.sdDiff * 3);
  const yMin = Math.min(...allDiffs) - Math.max(...allMargins);
  const yMax = Math.max(...allDiffs) + Math.max(...allMargins);

  const pointTrace = {
    type: "scatter", mode: "markers",
    x: points.map(p => p.mean), y: points.map(p => p.diff),
    marker: {
      color: points.map(p => COLORS[p.idx % COLORS.length]),
      size: 4, opacity: 0.4,
    },
    hovertemplate: `Mean: %{x:.1f}${unit}<br>Diff: %{y:.1f}${unit}<br>%{text}<extra></extra>`,
    text: points.map(p => p.label),
    showlegend: false,
  };

  const refTraces = [
    { type: "scatter", mode: "lines", x: [xMin, xMax], y: [0, 0], line: { color: t.acc, width: 1.5, dash: "dash" }, name: "Zero bias", showlegend: true },
    ...chartable.map((d, idx) => ({
      type: "scatter", mode: "lines", x: [xMin, xMax], y: [d.meanDiff, d.meanDiff],
      line: { color: COLORS[idx % COLORS.length], width: 1, dash: "dot" },
      name: d.label, showlegend: true,
    })),
  ];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 55, r: 20, t: 15, b: 45 },
    xaxis: { title: `Mean of measurements${u}`, gridcolor: t.surf3, zeroline: false, range: [xMin, xMax] },
    yaxis: { title: `Difference${u}`, gridcolor: t.surf3, zeroline: false, range: [yMin, yMax] },
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
    height: 400,
  };
  return <ChartCard title="Collective Bland-Altman — All Landmarks" t={t}><PlotlyChart data={[...refTraces, pointTrace]} layout={layout} style={{ height: layout.height }} /></ChartCard>;
}

function ErrorMapPlot({ results, t }) {
  const map = results.landmarkMap;
  if (!map) return null;
  const entries = Object.entries(map).map(([l, v]) => ({
    label: l,
    mean: v.meanError || 0,
    sd: v.sdError || 0,
    max: v.maxError,
    unit: v.unit || "",
  })).filter(e => e.sd > 0);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.sd - a.sd);
  const maxV = Math.max(...sorted.map(e => e.sd), 0.5);
  const unit = sorted[0]?.unit || "mm";

  const sdTrace = {
    type: "bar", orientation: "h",
    y: sorted.map(e => `${e.label}  (SD=${e.sd.toFixed(2)} ${e.unit})`),
    x: sorted.map(e => e.sd),
    marker: { color: t.acc, opacity: 0.7 },
    text: sorted.map(e => e.sd.toFixed(2)),
    textposition: "outside",
    textfont: { size: 9, color: t.tx3, family: FONT_STACK },
    showlegend: false,
    hovertemplate: `%{y}: SD = %{x:.2f} ${unit}<extra></extra>`,
  };
  const meanTrace = {
    type: "scatter", mode: "markers",
    y: sorted.map(e => `${e.label}  (SD=${e.sd.toFixed(2)} ${e.unit})`),
    x: sorted.map(e => e.mean),
    marker: { color: t.warn, size: 8, symbol: "diamond", line: { width: 1, color: t.bg } },
    showlegend: true, name: "Mean Error",
    hovertemplate: `Mean = %{x:.2f} ${unit}<extra></extra>`,
  };
  const maxTrace = {
    type: "scatter", mode: "markers",
    y: sorted.map(e => `${e.label}  (SD=${e.sd.toFixed(2)} ${e.unit})`),
    x: sorted.map(e => e.max),
    marker: { color: t.err, size: 6, symbol: "circle", line: { width: 1, color: t.bg } },
    showlegend: true, name: "Max Error",
    hovertemplate: `Max = %{x:.2f} ${unit}<extra></extra>`,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 180, r: 60, t: 15, b: 45 },
    xaxis: { title: `Error (${unit})`, range: [0, maxV * 1.3], gridcolor: t.surf3, zeroline: false },
    yaxis: { title: { text: "Landmark", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(240, sorted.length * 30 + 60),
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title="Method Error Ranking — Sort by SD" t={t}>
    <PlotlyChart data={[sdTrace, meanTrace, maxTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function MethodErrorBarPlot({ details, t }) {
  const chartable = details.filter(d => d.dahlberg != null || d.sem != null).slice(0, 20);
  if (chartable.length === 0) return null;
  const labels = chartable.map(d => d.label);
  const dahlberg = chartable.map(d => d.dahlberg);
  const sem = chartable.map(d => d.sem);
  const mdc = chartable.map(d => d.mdc);
  const maxV = Math.max(...chartable.flatMap(d => [d.dahlberg || 0, d.sem || 0, d.mdc || 0])) || 1;
  const unit = chartable[0]?.unit || "";
  const u = unit ? ` (${unit})` : "";

  const dahlbergTrace = {
    type: "bar", orientation: "h",
    y: labels, x: dahlberg,
    marker: { color: t.acc, opacity: 0.7 },
    showlegend: true, name: "Dahlberg",
    hovertemplate: `%{y}: Dahlberg = %{x:.2f} ${unit}<extra></extra>`,
  };
  const semTrace = {
    type: "bar", orientation: "h",
    y: labels, x: sem,
    marker: { color: t.warn, opacity: 0.7 },
    showlegend: true, name: "SEM",
    hovertemplate: `%{y}: SEM = %{x:.2f} ${unit}<extra></extra>`,
  };
  const mdcTrace = {
    type: "scatter", mode: "markers",
    y: labels, x: mdc,
    marker: { color: t.err, size: 8, symbol: "diamond" },
    showlegend: true, name: "MDC",
    hovertemplate: `%{y}: MDC = %{x:.2f} ${unit}<extra></extra>`,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 120, r: 30, t: 15, b: 45 },
    xaxis: { title: `Error${u}`, range: [0, maxV * 1.1], gridcolor: t.surf3, zeroline: false },
    yaxis: { title: { text: "Landmark", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(240, chartable.length * 24 + 50),
    barmode: "overlay",
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title="Method Error Comparison — All Landmarks" t={t}>
    <PlotlyChart data={[dahlbergTrace, semTrace, mdcTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIPTIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function DescriptiveCharts({ results, t }) {
  const combined = results.combined || {};
  const labels = Object.keys(combined);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DistributionsChart combined={combined} labels={labels} t={t} />
      <RaincloudPlot combined={combined} labels={labels} t={t} />
      <CVBarChart combined={combined} labels={labels} t={t} />
      <ZScoresProfileChart results={results} t={t} />
      <DistributionRangePlot combined={combined} labels={labels} t={t} />
    </div>
  );
}

function DistributionsChart({ combined, labels, t }) {
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2 && s.sd && isFinite(s.sd);
  });
  if (valid.length === 0) return null;

  return (
    <ChartCard title="Distributions with Normal Curve Overlay" t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {valid.map((label, idx) => {
          const s = combined[label].stats;
          const color = COLORS[idx % COLORS.length];
          const vals = combined[label].values || [];
          const hMin = s.mean - 3.5 * s.sd;
          const hMax = s.mean + 3.5 * s.sd;
          const nBins = 20;

          const binW = (hMax - hMin) / nBins || 1;
          const bins = Array.from({ length: nBins }, (_, i) => ({ x0: hMin + i * binW, x1: hMin + (i + 1) * binW, count: 0 }));
          for (const v of vals) {
            const bi = Math.min(Math.floor((v - hMin) / binW), nBins - 1);
            if (bi >= 0) bins[bi].count++;
          }
          const maxCount = Math.max(...bins.map(b => b.count), 1);

          const cX = [], cY = [];
          for (let s2 = 0; s2 <= 60; s2++) {
            const v = hMin + s2 * (hMax - hMin) / 60;
            const z = (v - s.mean) / s.sd;
            cX.push(v);
            cY.push(Math.exp(-0.5 * z * z) / (s.sd * Math.sqrt(2 * Math.PI)) * s.n * binW);
          }
          const yMax = Math.max(maxCount, ...cY) * 1.2 || 1;

          const data = [
            {
              type: "bar", x: bins.map(b => (b.x0 + b.x1) / 2), y: bins.map(b => b.count),
              width: binW * 0.85,
              marker: { color, opacity: 0.5, line: { color, width: 0.5 } },
              showlegend: false,
              hovertemplate: "[%{x:.1f}, %{customdata:.1f}): %{y}<extra></extra>",
              customdata: bins.map(b => b.x1),
            },
            {
              type: "scatter", mode: "lines",
              x: cX, y: cY,
              line: { color, width: 2 },
              showlegend: false,
              hovertemplate: "%{x:.2f}<br>Count: %{y:.1f}<extra></extra>",
            },
            {
              type: "scatter", mode: "lines",
              x: [s.mean, s.mean], y: [0, yMax * 0.8],
              line: { color: t.err, width: 1.5, dash: "dash" },
              showlegend: false,
            },
          ];

          const layout = {
            paper_bgcolor: t.surf2, plot_bgcolor: t.surf2,
            font: { color: t.tx2, family: FONT_STACK, size: 10 },
            margin: { l: 50, r: 16, t: 22, b: 4 },
            xaxis: { title: "Value", showgrid: false, zeroline: false, showticklabels: false, ticks: "" },
            yaxis: { title: "Density", showgrid: false, zeroline: false, showticklabels: false, ticks: "", range: [0, yMax] },
            height: 130,
            annotations: [
              {
                x: 0.02, y: 0.92, xref: "paper", yref: "paper",
                text: `<b>${label}</b>  n=${s.n}  μ=${s.mean.toFixed(1)}${combined[label]?.unit || ""}`,
                showarrow: false, xanchor: "left", yanchor: "top",
                font: { size: 10, color },
              },
            ],
          };

          return <PlotlyChart key={label} data={data} layout={layout} style={{ height: 120 }} />;
        })}
      </div>
    </ChartCard>
  );
}

// ─── Raincloud Plot (violin + boxplot + jitter) ──────────────────────────────
function RaincloudPlot({ combined, labels, t }) {
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2 && s.sd && isFinite(s.sd);
  });
  if (valid.length === 0) return null;
  const traces = valid.flatMap((label, idx) => {
    const color = COLORS[idx % COLORS.length];
    const vals = combined[label].values || [];
    return [
      {
        type: "violin", orientation: "h",
        y: vals.map(() => label), x: vals,
        name: label,
        scalemode: "width",
        bandwidth: Math.max(...vals) - Math.min(...vals) > 0 ? undefined : 1,
        box: { visible: true, width: 0.25 },
        points: "all", jitter: 0.4, pointpos: 1.8,
        marker: { size: 4, opacity: 0.6, color, line: { width: 0.5, color } },
        line: { color, width: 1.5 },
        fillcolor: color + "55",
        meanline: { visible: true, color: t.err },
        spanmode: "hard",
        showlegend: false,
        hovertemplate: `<b>${label}</b><br>%{x:.2f}<br>Q1: %{q1:.2f}, Median: %{median:.2f}, Q3: %{q3:.2f}<br>Mean: %{mean:.2f}<extra></extra>`,
      },
    ];
  });
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 100, r: 30, t: 10, b: 40 },
    xaxis: { title: "Value", zeroline: false, gridcolor: t.surf3, tickfont: { size: 10 } },
    yaxis: { title: "Group", autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(300, valid.length * 150),
    violingap: 0.4,
    violingroupgap: 0.4,
  };
  return <ChartCard title="Raincloud Plot — Distribution, Box Plot & Raw Data" t={t}><PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} /></ChartCard>;
}

function CVBarChart({ combined, labels, t }) {
  const chartable = labels.map(l => ({ label: l, cv: combined[l]?.stats?.sd / combined[l]?.stats?.mean })).filter(d => d.cv != null && isFinite(d.cv));
  if (chartable.length < 2) return null;
  const sorted = [...chartable].sort((a, b) => b.cv - a.cv);
  const sortedLabels = sorted.map(d => d.label);
  const sortedCV = sorted.map(d => d.cv);
  const maxCV = Math.max(...sortedCV) * 1.15;
  const barColors = sorted.map(d => {
    const pct = d.cv * 100;
    return pct > 15 ? t.err : pct > 10 ? t.warn : t.ok;
  });
  const pctText = sorted.map(d => (d.cv * 100).toFixed(1) + "%");

  const data = [{
    type: "bar", orientation: "h",
    y: sortedLabels, x: sortedCV,
    marker: { color: barColors, opacity: 0.7 },
    text: pctText,
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{text}<extra></extra>",
    showlegend: false,
  }];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 120, r: 60, t: 15, b: 45 },
    xaxis: { title: "Coefficient of Variation (%)", range: [0, maxCV], gridcolor: t.surf3, zeroline: false,
      tickformat: ",.0%", dtick: maxCV / 2 },
    yaxis: { title: { text: "Landmark", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(220, sorted.length * 22 + 50),
    bargap: 0.2,
  };

  return <ChartCard title="Coefficient of Variation — All Landmarks" t={t}>
    <PlotlyChart data={data} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function ZScoresProfileChart({ results, t }) {
  const zScores = results.zScores || {};
  const normIds = Object.keys(zScores);
  if (normIds.length === 0) return null;
  const firstNorm = zScores[normIds[0]];
  const labels = Object.keys(firstNorm).filter(k => k !== "_stratumWarning");
  if (labels.length < 2) return null;

  const zValues = labels.map(l => {
    const z = firstNorm[l]?.zScore;
    return z?.z != null && isFinite(z.z) ? z.z : null;
  });

  const validPairs = labels.map((l, i) => ({ label: l, z: zValues[i] })).filter(d => d.z != null);
  if (validPairs.length < 2) return null;
  const sorted = [...validPairs].sort((a, b) => b.z - a.z);

  const colors = sorted.map(d => {
    const a = Math.abs(d.z);
    return a < 1 ? t.ok : a < 2 ? t.warn : a < 3 ? t.err : "#7c3aed";
  });
  const maxAbs = Math.max(...sorted.map(d => Math.abs(d.z)), 1) * 1.25;

  const trace = {
    type: "bar", orientation: "h",
    y: sorted.map(d => `${d.label}  (z=${d.z >= 0 ? "+" : ""}${d.z.toFixed(2)})`),
    x: sorted.map(d => d.z),
    marker: { color: colors, opacity: 0.75 },
    text: sorted.map(d => (d.z >= 0 ? "+" : "") + d.z.toFixed(2)),
    textposition: "outside",
    textfont: { size: 9, color: t.tx3, family: FONT_STACK },
    hovertemplate: "%{y}: z=%{x:.2f}<extra></extra>",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 180, r: 70, t: 15, b: 45 },
    xaxis: { title: "Z-score", range: [-maxAbs, maxAbs], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3, dtick: 1 },
    yaxis: { title: { text: "Measurement", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(220, sorted.length * 30 + 50),
    bargap: 0.25,
    shapes: [
      { type: "line", x0: -1, x1: -1, y0: -0.5, y1: sorted.length - 0.5, line: { color: t.ok + "60", width: 1, dash: "dash" }, layer: "below" },
      { type: "line", x0: 1, x1: 1, y0: -0.5, y1: sorted.length - 0.5, line: { color: t.ok + "60", width: 1, dash: "dash" }, layer: "below" },
      { type: "line", x0: -2, x1: -2, y0: -0.5, y1: sorted.length - 0.5, line: { color: t.warn + "60", width: 1, dash: "dot" }, layer: "below" },
      { type: "line", x0: 2, x1: 2, y0: -0.5, y1: sorted.length - 0.5, line: { color: t.warn + "60", width: 1, dash: "dot" }, layer: "below" },
    ],
    annotations: [
      { x: 1, y: 1, xref: "x", yref: "paper", text: "z=+1", showarrow: false, font: { size: 8, color: t.ok }, xanchor: "left", yanchor: "bottom" },
      { x: -1, y: 1, xref: "x", yref: "paper", text: "z=-1", showarrow: false, font: { size: 8, color: t.ok }, xanchor: "right", yanchor: "bottom" },
      { x: 2, y: 1, xref: "x", yref: "paper", text: "z=+2", showarrow: false, font: { size: 8, color: t.warn }, xanchor: "left", yanchor: "bottom" },
      { x: -2, y: 1, xref: "x", yref: "paper", text: "z=-2", showarrow: false, font: { size: 8, color: t.warn }, xanchor: "right", yanchor: "bottom" },
    ],
  };

  return <ChartCard title={`Z-Score Profile — ${normIds.length > 1 ? "First Norm (" + normIds[0] + ")" : normIds[0]}`} t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
} 

function DistributionRangePlot({ combined, labels, t }) {
  const valid = labels.filter(l => {
    const s = combined[l]?.stats;
    return s && s.n >= 2 && isFinite(s.mean) && isFinite(s.sd);
  }).map(l => ({ label: l, stats: combined[l].stats }));
  if (valid.length < 2) return null;

  const sorted = [...valid].sort((a, b) => b.stats.mean - a.stats.mean);
  const allVals = sorted.flatMap(d => combined[d.label].values || []);
  const globalMin = Math.min(...allVals);
  const globalMax = Math.max(...allVals);
  const pad = (globalMax - globalMin) * 0.15 || 1;

  const pointTrace = {
    type: "scatter", mode: "markers",
    y: sorted.map(d => d.label),
    x: sorted.map(d => d.stats.mean),
    marker: { color: t.acc, size: 9, symbol: "diamond", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: true,
      array: sorted.map(d => d.stats.sd),
      thickness: 2, width: 8, color: t.acc,
    },
    hovertemplate: "%{y}: %{x:.2f} ± %{customdata[0]:.2f} (n=%{customdata[1]})<extra></extra>",
    customdata: sorted.map(d => [d.stats.sd, d.stats.n]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 120, r: 30, t: 15, b: 45 },
    xaxis: { title: "Mean ± SD", range: [globalMin - pad, globalMax + pad], gridcolor: t.surf3, zeroline: false },
    yaxis: { title: { text: "Measurement", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(240, sorted.length * 30 + 50),
  };

  return <ChartCard title="Mean ± SD — All Measurements" t={t}>
    <PlotlyChart data={[pointTrace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARATIVE CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function ComparativeCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  const nGroups = results.groups?.length || 0;
  const isPaired = results.design === "paired";
  const hasPostHoc = results.postHoc && Object.keys(results.postHoc).length > 0;
  const manyLabels = labels.length >= 10;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BarGraph labels={labels} results={results} t={t} />
      {nGroups === 2 && !isPaired && <MeanDiffForest labels={labels} results={results} t={t} />}
      {nGroups === 2 && isPaired && <PairedChangePlot labels={labels} results={results} t={t} />}
      {hasPostHoc && <TukeyHSDPlot results={results} t={t} />}
      <PValueWaterfall labels={labels} results={results} t={t} />
      {manyLabels && <VolcanoPlot labels={labels} results={results} t={t} />}
    </div>
  );
}

function BarGraph({ labels, results, t }) {
  const groupNames = results.groups?.map(g => g.label) || [];
  if (groupNames.length < 2) return null;
  const COLORS = PALETTE;

  const allData = labels.flatMap(([label, lr]) => {
    const rd = lr.rawData || {};
    return groupNames.map((gn, gi) => {
      const gd = rd[gn];
      if (!gd || !gd.values?.length) return null;
      const vals = gd.values;
      const m = gd.mean ?? vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = gd.sd ?? (vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) : 0);
      return { label, group: gn, mean: m, sd, n: vals.length, groupIdx: gi, color: COLORS[gi % COLORS.length] };
    }).filter(Boolean);
  });

  const landmarkNames = [...new Set(allData.map(d => d.label))];
  const barWidth = 0.7 / groupNames.length;
  const traces = groupNames.map((gn, gi) => ({
    type: "bar",
    name: gn,
    x: landmarkNames,
    y: landmarkNames.map(l => { const d = allData.find(x => x.label === l && x.group === gn); return d ? d.mean : 0; }),
    error_y: { type: "data", array: landmarkNames.map(l => { const d = allData.find(x => x.label === l && x.group === gn); return d ? d.sd : 0; }), visible: true, thickness: 1.5, width: 4 },
    marker: { color: COLORS[gi % COLORS.length], opacity: 0.85 },
    offset: (gi - (groupNames.length - 1) / 2) * barWidth,
    width: barWidth * 0.9,
    hovertemplate: `%{x}<br>${gn}: <b>%{y:.2f}</b> ± %{customdata[0]:.2f}<br>n=%{customdata[1]}<extra></extra>`,
    customdata: landmarkNames.map(l => { const d = allData.find(x => x.label === l && x.group === gn); return d ? [d.sd, d.n] : [0, 0]; }),
    showlegend: true,
  }));

  const yAll = allData.map(d => d.mean);
  const yMin = Math.min(0, ...yAll) * 1.1;
  const yMax = Math.max(0, ...yAll) * 1.15 || 1;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 55, r: 20, t: 15, b: Math.max(60, landmarkNames.length * 2 + 40) },
    xaxis: { tickangle: -35, tickfont: { size: 10 }, gridcolor: t.surf3, zeroline: false },
    yaxis: { title: "Mean ± SD", range: [yMin, yMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.bdr },
    height: Math.max(300, 80 + landmarkNames.length * 18),
    barmode: "group", bargap: 0.15, bargroupgap: 0.05,
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title={`Group Means — ${landmarkNames.length} Landmarks`} t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function MeanDiffForest({ labels, results, t }) {
  const groupNames = results.groups?.map(g => g.label) || [];
  if (groupNames.length !== 2) return null;
  const g0 = groupNames[0], g1 = groupNames[1];

  const rows = labels.map(([label, lr]) => {
    const rd = lr.rawData || {};
    const d0 = rd[g0], d1 = rd[g1];
    if (!d0?.values?.length || !d1?.values?.length) return null;
    const m0 = d0.mean ?? d0.values.reduce((a, b) => a + b, 0) / d0.values.length;
    const m1 = d1.mean ?? d1.values.reduce((a, b) => a + b, 0) / d1.values.length;
    const diff = m0 - m1;
    const v0 = d0.sd ? d0.sd ** 2 : (d0.values.length > 1 ? d0.values.reduce((s, v) => s + (v - m0) ** 2, 0) / (d0.values.length - 1) : 0);
    const v1 = d1.sd ? d1.sd ** 2 : (d1.values.length > 1 ? d1.values.reduce((s, v) => s + (v - m1) ** 2, 0) / (d1.values.length - 1) : 0);
    const n0 = d0.values.length, n1 = d1.values.length;
    const se = Math.sqrt(v0 / n0 + v1 / n1);
    const df = n0 + n1 - 2;
    const tCrit = df > 0 ? Math.max(1.96, Math.min(4, 1.96 + 2.5 / df)) : 1.96;
    const ciLo = diff - tCrit * se, ciHi = diff + tCrit * se;
    const pValue = lr.result?.pValue;
    const sig = pValue != null && pValue < (results.alpha || 0.05);
    return { label, diff, ciLo, ciHi, se, pValue, sig };
  }).filter(Boolean);

  if (rows.length === 0) return null;

  const allLo = rows.map(r => r.ciLo), allHi = rows.map(r => r.ciHi);
  const xMin = Math.min(0, ...allLo) - Math.max(1, Math.abs(Math.min(0, ...allLo)) * 0.15);
  const xMax = Math.max(0, ...allHi) + Math.max(1, Math.abs(Math.max(0, ...allHi)) * 0.15);
  const labels_n = rows.map(r => r.label);
  const colors = rows.map(r => r.sig ? t.err : t.ok);

  const trace = {
    type: "scatter", mode: "markers",
    x: rows.map(r => r.diff), y: labels_n,
    marker: { color: colors, size: 11, symbol: "diamond", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: rows.map(r => r.ciHi - r.diff),
      arrayminus: rows.map(r => r.diff - r.ciLo),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.2f} [%{customdata[0]:.2f}, %{customdata[1]:.2f}]<br>p=%{customdata[2]}<extra></extra>",
    customdata: rows.map(r => [r.ciLo, r.ciHi, fmtP(r.pValue)]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 140, r: 30, t: 15, b: 45 },
    xaxis: { title: `Mean Difference (${g0} − ${g1})`, range: [xMin, xMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(240, rows.length * 26 + 50),
    shapes: [{
      type: "line", x0: 0, x1: 0, y0: -0.5, y1: labels_n.length - 0.5,
      line: { color: t.tx3, width: 1, dash: "dash" },
    }],
  };

  return <ChartCard title={`Mean Difference — ${g0} vs ${g1}`} t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function PairedChangePlot({ labels, results, t }) {
  const groupNames = results.groups?.map(g => g.label) || [];
  if (groupNames.length !== 2) return null;
  const g0 = groupNames[0], g1 = groupNames[1];
  const COLORS = PALETTE;

  const charts = labels.map(([label, lr]) => {
    const rd = lr.rawData || {};
    const d0 = rd[g0]?.values || [], d1 = rd[g1]?.values || [];
    const n = Math.min(d0.length, d1.length);
    if (n < 2) return null;
    const pairs = Array.from({ length: n }, (_, i) => [d0[i], d1[i]]);
    const mean0 = d0.reduce((a, b) => a + b, 0) / n;
    const mean1 = d1.reduce((a, b) => a + b, 0) / n;
    const allVals = [...d0, ...d1];
    const yMin = Math.min(...allVals);
    const yMax = Math.max(...allVals);
    const yPad = (yMax - yMin) * 0.12 || 1;

    const individualTraces = pairs.map(pair => ({
      type: "scatter", mode: "lines+markers",
      x: [g0, g1], y: pair,
      marker: { size: 4, opacity: 0.2, color: COLORS[0] },
      line: { width: 0.5, color: COLORS[0], opacity: 0.2 },
      showlegend: false,
      hoverinfo: "skip",
    }));

    const meanTrace = {
      type: "scatter", mode: "lines+markers",
      x: [g0, g1], y: [mean0, mean1],
      marker: { size: 12, color: COLORS[1], symbol: "diamond", line: { width: 2, color: t.bg } },
      line: { width: 3, color: COLORS[1], dash: "solid" },
      name: "Mean",
      hovertemplate: `Mean: %{y:.2f}<extra></extra>`,
    };

    const layout = {
      paper_bgcolor: t.surf, plot_bgcolor: t.surf,
      font: { color: t.tx2, family: FONT_STACK, size: 10 },
      margin: { l: 30, r: 10, t: 24, b: 14 },
      xaxis: { tickfont: { size: 10 }, showgrid: false },
      yaxis: { range: [yMin - yPad, yMax + yPad], gridcolor: t.surf3, zeroline: false },
      height: 150,
      annotations: [{
        x: 0.5, y: 1.12, xref: "paper", yref: "paper",
        text: `<b>${label}</b> (n=${n})`, showarrow: false,
        xanchor: "center", yanchor: "top",
        font: { size: 11, color: t.tx },
      }],
      showlegend: false,
    };

    return <PlotlyChart key={label} data={[...individualTraces, meanTrace]} layout={layout} style={{ height: 120 }} />;
  }).filter(Boolean);

  if (charts.length === 0) return null;

  return <ChartCard title={`Paired Change — Individual Trajectories (${g0} → ${g1})`} t={t}>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{charts}</div>
  </ChartCard>;
}

function TukeyHSDPlot({ results, t }) {
  const entries = Object.entries(results.postHoc || {});
  if (entries.length === 0) return null;

  const chartData = entries.flatMap(([label, comparisons]) =>
    (comparisons || []).map(c => ({
      label,
      pair: `${c.groupA} vs ${c.groupB}`,
      diff: c.meanDiff, ciLo: c.ci95?.[0], ciHi: c.ci95?.[1],
      pValue: c.pAdjusted ?? c.pValue, sig: c.significant,
    }))
  );

  if (chartData.length === 0) return null;

  const allLo = chartData.map(d => d.ciLo ?? d.diff);
  const allHi = chartData.map(d => d.ciHi ?? d.diff);
  const xMin = Math.min(0, ...allLo) * 1.15 || -1;
  const xMax = Math.max(0, ...allHi) * 1.15 || 1;
  const yLabels = chartData.map(d => `${d.label}<br>${d.pair}`);
  const colors = chartData.map(d => d.sig ? t.err : t.ok);

  const trace = {
    type: "scatter", mode: "markers",
    x: chartData.map(d => d.diff), y: yLabels,
    marker: { color: colors, size: 9, symbol: "circle", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2, width: 0,
      array: chartData.map(d => (d.ciHi ?? d.diff) - d.diff),
      arrayminus: chartData.map(d => d.diff - (d.ciLo ?? d.diff)),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.2f} [%{customdata[0]:.2f}, %{customdata[1]:.2f}]<br>p=%{customdata[2]}<extra></extra>",
    customdata: chartData.map(d => [d.ciLo ?? d.diff, d.ciHi ?? d.diff, fmtP(d.pValue)]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 160, r: 30, t: 15, b: 45 },
    xaxis: { title: "Mean Difference", range: [xMin, xMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 9 } },
    height: Math.max(240, yLabels.length * 28 + 50),
    shapes: [{
      type: "line", x0: 0, x1: 0, y0: -0.5, y1: yLabels.length - 0.5,
      line: { color: t.tx3, width: 1, dash: "dash" },
    }],
  };

  return <ChartCard title="Post-Hoc Pairwise Differences (Tukey HSD / Bonferroni)" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function PValueWaterfall({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null);
  if (pLabels.length === 0) return null;
  const alpha = results.alpha || 0.05;

  const sorted = pLabels
    .map(([label, lr]) => ({ label, pValue: lr.result.pValue, adjusted: lr.mcCorrected?.adjusted }))
    .sort((a, b) => a.pValue - b.pValue);

  const pVals = sorted.map(d => d.pValue);
  const logP = pVals.map(p => -Math.log10(Math.max(p, 1e-12)));
  const adjP = sorted.map(d => d.adjusted != null ? -Math.log10(Math.max(d.adjusted, 1e-12)) : null);

  const yMax = Math.max(3, ...logP, ...adjP.filter(v => v != null)) * 1.2;
  const xLabels = sorted.map((d, i) => `${i + 1}. ${d.label.length > 12 ? d.label.slice(0, 10) + "\u2026" : d.label}`);

  const rawTrace = {
    type: "scatter", mode: "markers+lines",
    x: xLabels, y: logP,
    marker: { color: logP.map(p => p >= -Math.log10(alpha) ? t.err : t.ok), size: 8, symbol: "circle" },
    line: { color: t.tx3, width: 1, dash: "dot", shape: "spline" },
    name: "Raw p-value",
    hovertemplate: "%{x}<br>-log\u2081\u2080(p) = %{y:.2f}<br>p = %{customdata}<extra></extra>",
    customdata: pVals.map(p => fmtP(p)),
  };

  const adjTrace = adjP.every(v => v == null) ? null : {
    type: "scatter", mode: "markers",
    x: xLabels, y: adjP.map(v => v ?? null),
    marker: { color: t.acc, size: 6, symbol: "diamond-open" },
    name: "Corrected",
    hovertemplate: "%{x}: -log\u2081\u2080(p\u2090\u1d63\u1d65) = %{y:.2f}<extra></extra>",
  };

  const alphaLine = -Math.log10(alpha);
  const bonfLine = pLabels.length > 0 ? -Math.log10(alpha / pLabels.length) : null;
  const shapes = [
    { type: "line", x0: -0.5, x1: xLabels.length - 0.5, y0: alphaLine, y1: alphaLine, line: { color: t.err, width: 1.5, dash: "dash" } },
  ];
  if (bonfLine != null) {
    shapes.push({ type: "line", x0: -0.5, x1: xLabels.length - 0.5, y0: bonfLine, y1: bonfLine, line: { color: t.warn, width: 1, dash: "dot" } });
  }

  const data = [rawTrace];
  if (adjTrace) data.push(adjTrace);

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 50, r: 20, t: 15, b: Math.max(60, xLabels.length * 2 + 40) },
    xaxis: { tickangle: -45, tickfont: { size: 9 }, gridcolor: t.surf3, zeroline: false },
    yaxis: { title: "\u2212log\u2081\u2080(p)", range: [0, yMax], gridcolor: t.surf3, zeroline: false },
    height: Math.max(300, 80 + xLabels.length * 14),
    shapes,
    annotations: [
      { x: xLabels.length * 0.02, y: alphaLine, text: `\u03b1 = ${alpha}`, showarrow: false, font: { size: 9, color: t.err }, yanchor: "bottom" },
      ...(bonfLine != null ? [{ x: xLabels.length * 0.02, y: bonfLine, text: `Bonf. (${pLabels.length} tests)`, showarrow: false, font: { size: 9, color: t.warn }, yanchor: "bottom" }] : []),
    ],
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title={`P-Value Waterfall (\u03b1 = ${alpha})`} t={t}>
    <PlotlyChart data={data} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function VolcanoPlot({ labels, results, t }) {
  const pLabels = labels.filter(([, lr]) => lr.result?.pValue != null && lr.rawData);
  if (pLabels.length < 3) return null;
  const groupNames = results.groups?.map(g => g.label) || [];
  if (groupNames.length !== 2) return null;
  const g0 = groupNames[0], g1 = groupNames[1];
  const alpha = results.alpha || 0.05;

  const volcanoRows = pLabels.map(([label, lr]) => {
    const rd = lr.rawData || {};
    const d0 = rd[g0], d1 = rd[g1];
    if (!d0?.values?.length || !d1?.values?.length) return null;
    const m0 = d0.mean ?? d0.values.reduce((a, b) => a + b, 0) / d0.values.length;
    const m1 = d1.mean ?? d1.values.reduce((a, b) => a + b, 0) / d1.values.length;
    const diff = m0 - m1;
    const pooledSd = Math.sqrt(
      ((d0.sd ?? 0) ** 2 * (d0.values.length - 1) + (d1.sd ?? 0) ** 2 * (d1.values.length - 1)) /
      Math.max(d0.values.length + d1.values.length - 2, 1)
    ) || 1;
    const es = diff / pooledSd;
    const pValue = lr.result?.pValue ?? 1;
    return { label, diff, es, pValue, logP: -Math.log10(Math.max(pValue, 1e-12)), sig: pValue < alpha };
  }).filter(Boolean);

  if (volcanoRows.length < 3) return null;

  const esVals = volcanoRows.map(r => r.es);
  const logP = volcanoRows.map(r => r.logP);
  const xMin = Math.min(-0.5, ...esVals) - 0.3;
  const xMax = Math.max(0.5, ...esVals) + 0.3;
  const yMaxVal = Math.max(3, ...logP) * 1.15;
  const sigFlags = volcanoRows.map(r => r.sig);
  const plotLabels = volcanoRows.map(r => r.label.length > 10 ? r.label.slice(0, 8) + "\u2026" : r.label);

  const sigTrace = {
    type: "scatter", mode: "markers+text",
    x: esVals.filter((_, i) => sigFlags[i]),
    y: logP.filter((_, i) => sigFlags[i]),
    text: plotLabels.filter((_, i) => sigFlags[i]),
    textposition: "right",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    marker: { color: t.err, size: 8, opacity: 0.85 },
    name: `Significant (p<${alpha})`,
    hovertemplate: "%{text}: ES=%{x:.3f}, -log10(p)=%{y:.2f}<extra></extra>",
  };
  const nsTrace = {
    type: "scatter", mode: "markers",
    x: esVals.filter((_, i) => !sigFlags[i]),
    y: logP.filter((_, i) => !sigFlags[i]),
    marker: { color: t.tx3, size: 5, opacity: 0.5 },
    name: "Not significant",
    showlegend: true,
    hovertemplate: "ES=%{x:.3f}, -log10(p)=%{y:.2f}<extra></extra>",
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 55, r: 30, t: 15, b: 50 },
    xaxis: { title: "Cohen's d (effect size)", range: [xMin, xMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { title: "\u2212log\u2081\u2080(p)", range: [0, yMaxVal], gridcolor: t.surf3, zeroline: false },
    height: 380,
    shapes: [{
      type: "line", y0: -Math.log10(alpha), y1: -Math.log10(alpha),
      x0: xMin, x1: xMax,
      line: { color: t.err, width: 1, dash: "dash" },
    }],
    annotations: [{
      x: xMin + 0.02 * (xMax - xMin), y: -Math.log10(alpha),
      text: "\u03b1=" + alpha, showarrow: false,
      font: { size: 10, color: t.err },
      yanchor: "bottom",
    }],
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title="Volcano Plot — Effect Size vs. Significance" t={t}>
    <PlotlyChart data={[nsTrace, sigTrace]} layout={layout} style={{ height: 380 }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LONGITUDINAL CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function LongitudinalCharts({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip);
  if (labels.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <LongitudinalTrajectories labels={labels} t={t} />
      <MeanTrajectoryOverlay labels={labels} t={t} />
      <ChangeScoreForest labels={labels} t={t} />
    </div>
  );
}

function LongitudinalTrajectories({ labels, t }) {
  const COLORS = [t.acc, t.err, t.warn, t.ok, "#a78bfa", "#f472b6", "#34d399", t.tx2];

  return (
    <ChartCard title="Individual Trajectories" t={t}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {labels.map(([label, lr], idx) => {
          const rawData = lr.rawData || {};
          const tpNames = Object.keys(rawData);
          if (tpNames.length < 2) return null;
          const allVals = tpNames.flatMap(tp => rawData[tp]?.values || []);
          if (allVals.length === 0) return null;
          const yMin = Math.min(...allVals) - 2;
          const yMax = Math.max(...allVals) + 2;
          const color = COLORS[idx % COLORS.length];
          const nSubj = lr.nSubjects || 0;

          const traces = [];
          if (nSubj > 0) {
            for (let si = 0; si < nSubj; si++) {
              const pts = tpNames.map((tp, i) => {
                const vals = rawData[tp]?.values || [];
                return vals[si] != null ? { x: i, y: vals[si] } : null;
              }).filter(Boolean);
              if (pts.length < 2) continue;
              traces.push({
                type: "scatter", mode: "lines+markers",
                x: pts.map(p => p.x), y: pts.map(p => p.y),
                line: { color: t.tx3, width: 0.7 },
                marker: { size: 2, color: t.tx3, opacity: 0.25 },
                opacity: 0.25,
                showlegend: false, hoverinfo: "skip",
              });
            }
          }

          const means = tpNames.map(tp => {
            const vals = rawData[tp]?.values || [];
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          });
          const meanPts = means.map((m, i) => m != null ? { x: i, y: m } : null).filter(Boolean);
          if (meanPts.length >= 2) {
            traces.push({
              type: "scatter", mode: "lines+markers",
              x: meanPts.map(p => p.x), y: meanPts.map(p => p.y),
              line: { color, width: 3 },
              marker: { color, size: 8, symbol: "circle", line: { width: 1.5, color: t.bg } },
              name: label,
              hovertemplate: `<b>${label}</b><br>TP: %{x}<br>Mean: %{y:.2f}<extra></extra>`,
              showlegend: false,
            });
          }

          const l = {
            paper_bgcolor: t.surf2, plot_bgcolor: t.surf2,
            font: { color: t.tx2, family: FONT_STACK, size: 10 },
            margin: { l: 40, r: 12, t: 22, b: 28 },
            xaxis: {
              title: "Timepoint",
              tickmode: "array",
              tickvals: tpNames.map((_, i) => i),
              ticktext: tpNames,
              showgrid: false, zeroline: false,
              tickfont: { size: 10 },
            },
            yaxis: { title: "Value", range: [yMin, yMax], gridcolor: t.surf3, zeroline: false, tickfont: { size: 10 } },
            height: 200,
            annotations: [{
              x: 0, y: 1.05, xref: "paper", yref: "paper",
              text: `<b>${label}</b>`, showarrow: false,
              xanchor: "left", yanchor: "top",
              font: { size: 11, color: t.tx },
            }],
          };

          return <PlotlyChart key={label} data={traces} layout={l} style={{ height: 200 }} />;
        })}
      </div>
    </ChartCard>
  );
}

function MeanTrajectoryOverlay({ labels, t }) {
  const COLORS = PALETTE;
  const allTps = [...new Set(labels.flatMap(([, lr]) => Object.keys(lr.rawData || {})))].sort();
  if (allTps.length < 2) return null;

  const allMeans = labels.flatMap(([, lr]) => {
    const rd = lr.rawData || {};
    return allTps.flatMap(tp => { const v = rd[tp]?.values || []; return v.length ? [v.reduce((a, b) => a + b, 0) / v.length] : []; });
  });
  const yMin = Math.min(...allMeans) - 3;
  const yMax = Math.max(...allMeans) + 3;

  const traces = labels.map(([label, lr], li) => {
    const rd = lr.rawData || {};
    const pts = allTps.map((tp, i) => {
      const vals = rd[tp]?.values || [];
      const m = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return m != null ? { x: i, y: m } : null;
    }).filter(Boolean);
    if (pts.length < 2) return null;
    const color = COLORS[li % COLORS.length];
    return {
      type: "scatter", mode: "lines+markers",
      x: pts.map(p => p.x), y: pts.map(p => p.y),
      line: { color, width: 2.5 },
      marker: { color, size: 7, symbol: "circle", line: { width: 1.5, color: t.bg } },
      name: label,
      hovertemplate: `<b>${label}</b><br>%{x}: %{y:.2f}<extra></extra>`,
    };
  }).filter(Boolean);

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 60, r: 20, t: 15, b: 55 },
    xaxis: {
      tickmode: "array",
      tickvals: allTps.map((_, i) => i),
      ticktext: allTps,
      title: "Timepoint",
      gridcolor: t.surf3, zeroline: false,
      tickfont: { size: 10 },
    },
    yaxis: { title: "Mean value", range: [yMin, yMax], gridcolor: t.surf3, zeroline: false, tickfont: { size: 10 } },
    height: 380,
    legend: { orientation: "v", font: { size: 10 } },
  };

  return <ChartCard title="Mean Trajectory Overlay — All Landmarks" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 380 }} />
  </ChartCard>;
}

function ChangeScoreForest({ labels, t }) {
  const allRows = labels.flatMap(([label, lr]) =>
    (lr.changeScores || []).map(c => ({
      label, from: c.from, to: c.to,
      mean: c.meanChange, se: c.seChange || c.sdChange / Math.sqrt(c.n || 1) || Math.abs(c.meanChange) * 0.25, n: c.n,
    })));
  if (allRows.length < 2) return null;
  const maxAbs = Math.max(...allRows.map(r => Math.abs(r.mean)), 0.1) * 1.3;
  const yLabels = allRows.map(r => `${r.label}  ${r.from}\u2192${r.to}`);
  const colors = allRows.map(r => r.mean > 0 ? t.err : t.ok);

  const ciLower = allRows.map(r => r.mean - 1.96 * r.se);
  const ciUpper = allRows.map(r => r.mean + 1.96 * r.se);

  const trace = {
    type: "scatter", mode: "markers",
    y: yLabels, x: allRows.map(r => r.mean),
    marker: { color: colors, size: 10, symbol: "diamond", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2, width: 0,
      array: allRows.map((r, i) => ciUpper[i] - r.mean),
      arrayminus: allRows.map((r, i) => r.mean - ciLower[i]),
      color: colors,
    },
    hovertemplate: "%{y}: %{x:.2f} [%{customdata[0]:.2f}, %{customdata[1]:.2f}]<extra></extra>",
    customdata: allRows.map((r, i) => [ciLower[i], ciUpper[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 180, r: 50, t: 15, b: 45 },
    xaxis: { title: "Change score", range: [-maxAbs, maxAbs], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { title: { text: "Measurement", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(240, allRows.length * 28 + 50),
  };

  return <ChartCard title="Change Score Forest Plot" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function CorrelationCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <CorrelationMatrixPlot results={results} t={t} />
      <ScatterPairPlot results={results} t={t} />
      <ResidualDiagnosticPlot results={results} t={t} />
      <ROCCurvePlot results={results} t={t} />
    </div>
  );
}

const CORR_SCALE = [
  [0, "#b91c1c"],
  [0.25, "#ef4444"],
  [0.4, "#fca5a5"],
  [0.5, "#e5e7eb"],
  [0.6, "#93c5fd"],
  [0.75, "#3b82f6"],
  [1, "#1d4ed8"],
];
const CORR_TFONT = { color: "#1f2937", size: 10, family: "'DM Sans',sans-serif" };

function CorrelationMatrixPlot({ results, t }) {
  const { vars, matrix, n, method } = results;
  if (!vars || vars.length < 2) return null;
  const m = vars.length;
  const z = Array.from({ length: m }, () => Array(m).fill(null));
  const displayTxt = Array.from({ length: m }, () => Array(m).fill(""));
  const hoverTxt = Array.from({ length: m }, () => Array(m).fill(""));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) { z[i][j] = 1; displayTxt[i][j] = "1"; hoverTxt[i][j] = "diagonal"; continue; }
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      z[i][j] = d.r;
      displayTxt[i][j] = d.r.toFixed(2);
      hoverTxt[i][j] = `r=${d.r.toFixed(3)}${d.sigAdj ? "*" : " (ns)"}`;
    }
  }
  const data = heatmapData(z, vars, vars, displayTxt, {
    zmin: -1, zmax: 1,
    colorscale: CORR_SCALE,
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: CORR_TFONT,
    hovertemplate: "%{x} \u00d7 %{y}: <b>%{customdata}</b><extra></extra>",
  });
  const H = Math.max(400, m * 28 + 100);
  return (
    <ChartCard title={`Correlation Matrix \u2014 ${method} (n=${n})`} t={t}>
      <PlotlyChart data={data} layout={{...heatmapLayout(t, { height: H }), xaxis: { ...heatmapLayout(t).xaxis, title: { text: "Variable", font: { size: 12 } } }, yaxis: { ...heatmapLayout(t).yaxis, title: { text: "Variable", font: { size: 12 } } } }} style={{ height: H }} />
    </ChartCard>
  );
}

function ScatterPairPlot({ results, t }) {
  const { vars, matrix, n, rawPairs, descriptive } = results;
  if (!vars || vars.length < 2 || !rawPairs) return null;
  const N = Math.min(vars.length, 7);
  const selected = vars.slice(0, N);

  const maxLen = Math.max(...selected.map(v => (rawPairs[v] || []).length));
  const validIdx = [];
  for (let idx = 0; idx < maxLen; idx++) {
    if (selected.every(v => rawPairs[v]?.[idx] != null && isFinite(rawPairs[v][idx]))) {
      validIdx.push(idx);
    }
  }
  if (validIdx.length < 2) return null;

  const dimensions = selected.map(v => ({
    label: v,
    values: validIdx.map(idx => rawPairs[v][idx]),
  }));

  const hoverTexts = validIdx.map(idx =>
    selected.map(v => `${v}=${rawPairs[v][idx].toFixed(2)}`).join(", ")
  );

  const annotations = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        const d = descriptive?.[selected[i]];
        annotations.push({
          x: 0.5, y: 0.5,
          xref: `x${i + 1} domain`,
          yref: `y${i + 1} domain`,
          text: `<b>${selected[i]}</b><br>n=${d?.n || n}`,
          showarrow: false,
          font: { size: 10, color: t.tx2 },
          align: "center",
        });
      } else {
        const r = matrix[selected[i]]?.[selected[j]];
        if (!r) continue;
        annotations.push({
          x: 0.5, y: 0.5,
          xref: `x${j + 1} domain`,
          yref: `y${i + 1} domain`,
          text: `r=${r.r.toFixed(2)}${r.sigAdj ? "*" : ""}`,
          showarrow: false,
          font: { size: 10, color: t.bg },
          bgcolor: t.tx,
          opacity: 0.8,
        });
      }
    }
  }

  const axisCfg = {
    showgrid: true, gridcolor: t.surf3, zeroline: false,
    tickfont: { size: 10, color: t.tx3 },
    showline: false, ticks: "",
  };
  const layout = {
    paper_bgcolor: t.surf,
    plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    annotations,
    margin: { l: 40, r: 20, t: 50, b: 30 },
    hovermode: "closest",
  };
  for (let i = 0; i < N; i++) {
    const title = dimensions[i].label || "Variable";
    layout[`xaxis${i + 1}`] = { ...axisCfg, title: { text: title, font: { size: 11 } } };
    layout[`yaxis${i + 1}`] = { ...axisCfg, title: { text: title, font: { size: 11 } } };
  }

  const CELL = 130;
  const pxH = N * CELL + 20;
  const data = [{
    type: "splom",
    dimensions,
    text: hoverTexts,
    hovertemplate: "<b>%{text}</b><extra></extra>",
    marker: { size: 3, color: t.acc, opacity: 0.5, line: { width: 0.5, color: t.bg } },
    diagonal: { visible: false },
  }];

  return (
      <ChartCard title={`Scatter Plot Matrix (${selected.length} vars)`} t={t}>
      <PlotlyChart data={data} layout={layout} style={{ height: pxH, minHeight: pxH }} />
    </ChartCard>
  );
}

function ResidualDiagnosticPlot({ results, t }) {
  const reg = results.regression;
  if (!reg) return null;
  const fitted = reg.fitted;
  const residuals = reg.residuals;
  const cooksd = reg.cooksd;
  if (!fitted || !residuals || fitted.length === 0) return null;
  const n = fitted.length;
  const rMax = Math.max(...residuals.map(r => Math.abs(r)), 0.1);
  const cookArr = cooksd && cooksd.length ? cooksd : [];
  const cookMax = cookArr.length ? Math.max(...cookArr) : 0.1;

  const resColors = residuals.map(r => Math.abs(r) > rMax * 0.8 ? t.err : t.acc);
  const resTrace = {
    type: "scatter", mode: "markers",
    x: fitted, y: residuals,
    marker: { color: resColors, size: 5, opacity: 0.6 },
    hovertemplate: "Fitted: %{x:.2f}<br>Residual: %{y:.2f}<extra></extra>",
    showlegend: false,
  };

  const resLayout = {
    paper_bgcolor: t.surf2, plot_bgcolor: t.surf2,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    margin: { l: 55, r: 20, t: 10, b: 45 },
    xaxis: { title: "Fitted values", gridcolor: t.surf3, zeroline: false, tickfont: { size: 10 } },
    yaxis: { title: "Residuals", gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3, tickfont: { size: 10 } },
    height: 280,
    shapes: [{
      type: "line", y0: 0, y1: 0,
      x0: Math.min(...fitted), x1: Math.max(...fitted),
      line: { color: t.tx3, width: 0.5 },
    }],
  };

  return (
    <ChartCard title="Residual Diagnostics" t={t}>
      <div style={{ fontSize: FONT.sm, color: t.tx2, marginBottom: 4 }}>n = {n}  |  Mean residual: {residuals.reduce((a, b) => a + b, 0) / n.toFixed(3)}</div>
      <PlotlyChart data={[resTrace]} layout={resLayout} style={{ height: 280 }} />
      {cookArr.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: FONT.md, fontWeight: 600, color: t.tx, marginBottom: 6 }}>Cook's Distance</div>
          <PlotlyChart data={[{
            type: "bar",
            x: cookArr.map((_, i) => i),
            y: cookArr,
            marker: { color: cookArr.map(c => c > 4 / n ? t.err : t.acc), opacity: 0.7 },
            hovertemplate: "Index: %{x}<br>Cook's D: %{y:.4f}<extra></extra>",
            showlegend: false,
          }]} layout={{
            paper_bgcolor: t.surf2, plot_bgcolor: t.surf2,
            font: { color: t.tx2, family: FONT_STACK, size: 10 },
            margin: { l: 50, r: 30, t: 10, b: 40 },
            xaxis: { title: "Observation index", gridcolor: t.surf3, zeroline: false, tickfont: { size: 10 } },
            yaxis: { title: "Cook's Distance", range: [0, cookMax * 1.2], gridcolor: t.surf3, zeroline: false, tickfont: { size: 10 } },
            height: 120,
            shapes: cookMax > 4 / n ? [{
              type: "line", y0: 4 / n, y1: 4 / n,
              x0: -0.5, x1: cookArr.length - 0.5,
              line: { color: t.err, width: 1, dash: "dash" },
            }] : [],
          }} style={{ height: 120 }} />
        </div>
      )}
    </ChartCard>
  );
}

function ROCCurvePlot({ results, t }) {
  const log = results.logistic;
  if (!log || !log.roc) return null;
  const { roc, auc } = log;
  const traces = [
    { type: "scatter", mode: "lines", x: [0, 1], y: [0, 1], line: { color: t.bdr, width: 1, dash: "dash" }, name: "Chance", showlegend: false, hoverinfo: "skip" },
    { type: "scatter", mode: "lines", x: roc.map(p => p.fpr), y: roc.map(p => p.tpr), line: { color: t.acc, width: 2.5 }, name: "ROC", fill: "tozeroy", fillcolor: t.acc + "18", hovertemplate: "FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>" },
  ];
  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 50, r: 20, t: 10, b: 50 },
    xaxis: { title: "1 \u2212 Specificity (FPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Sensitivity (TPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    width: 400, height: 400,
  };
  return <ChartCard title={`ROC Curve — AUC = ${auc.toFixed(3)}`} t={t}><PlotlyChart data={traces} layout={layout} style={{ width: 400, height: 400 }} /></ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function DiagnosticCharts({ results, t }) {
  if (!results || results.note) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>{results?.note || "No data."}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DiagnosticROCCurves results={results} t={t} />
      <DiagnosticAUCComparison results={results} t={t} />
      <DiagnosticCalibrationPlot results={results} t={t} />
    </div>
  );
}

function DiagnosticROCCurves({ results, t }) {
  const { predictors } = results;
  const preds = Object.entries(predictors || {});
  if (preds.length === 0) return null;
  const COLORS = PALETTE;

  const traces = [
    {
      type: "scatter", mode: "lines",
      x: [0, 1], y: [0, 1],
      line: { color: t.tx3, width: 1, dash: "dash" },
      name: "Chance",
      showlegend: true,
      hoverinfo: "skip",
    },
    ...preds.map(([name, p], idx) => {
      if (!p.roc) return null;
      return {
        type: "scatter", mode: "lines",
        x: p.roc.points.map(pt => pt.fpr),
        y: p.roc.points.map(pt => pt.tpr),
        line: { color: COLORS[idx % COLORS.length], width: 2.5 },
        name: `${name} (AUC=${p.auc?.auc?.toFixed(3) || "—"})`,
        hovertemplate: `FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra>${name}</extra>`,
      };
    }).filter(Boolean),
  ];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 50, r: 20, t: 15, b: 50 },
    xaxis: { title: "1 \u2212 Specificity (FPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Sensitivity (TPR)", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    height: 350,
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title="ROC Curves — All Predictors" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 350 }} />
  </ChartCard>;
}

function DiagnosticAUCComparison({ results, t }) {
  const { comparisons } = results;
  if (!comparisons?.length) return null;
  const labels = comparisons.map(c => `${c.A} vs ${c.B}`);
  const diffs = comparisons.map(c => c.diff);
  const ciLower = comparisons.map(c => c.ci95?.[0] ?? c.diff - 0.05);
  const ciUpper = comparisons.map(c => c.ci95?.[1] ?? c.diff + 0.05);
  const sigColors = comparisons.map(c => c.significant ? t.ok : t.tx3);
  const absMax = Math.max(Math.abs(Math.min(...diffs, 0)), Math.abs(Math.max(...diffs, 0)), 0.05) * 1.15;

  const trace = {
    type: "scatter", mode: "markers",
    x: diffs, y: labels,
    marker: { color: sigColors, size: 11, symbol: "square", line: { width: 1, color: t.bg } },
    error_x: {
      type: "data", symmetric: false, thickness: 2.5, width: 0,
      array: diffs.map((v, i) => ciUpper[i] - v),
      arrayminus: diffs.map((v, i) => v - ciLower[i]),
      color: sigColors,
    },
    text: diffs.map((v, i) => `${v.toFixed(3)} ${comparisons[i].significant ? "*" : ""}`),
    textposition: "right",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.4f} [%{customdata[0]:.4f}, %{customdata[1]:.4f}]<extra></extra>",
    customdata: diffs.map((v, i) => [ciLower[i], ciUpper[i]]),
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 140, r: 80, t: 15, b: 45 },
    xaxis: { title: "AUC difference", range: [-absMax, absMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { title: { text: "Predictor", font: { size: 12 } }, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(200, comparisons.length * 44 + 50),
  };

  return <ChartCard title="AUC Comparisons" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DiagnosticCalibrationPlot({ results, t }) {
  const composite = results.composite;
  if (!composite?.calibration?.groups?.length) return null;
  const cal = composite.calibration;

  const groups = cal.groups;
  const mids = groups.map(g => g.midpoint);
  const obs = groups.map(g => g.obsProp);
  const err = groups.map(g => 1.96 * Math.sqrt(g.obsProp * (1 - g.obsProp) / g.n));

  const traces = [
    {
      type: "scatter", mode: "lines",
      x: [0, 1], y: [0, 1],
      line: { color: t.tx3, width: 1, dash: "dash" },
      name: "Perfect calibration",
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      type: "scatter", mode: "markers",
      x: mids, y: obs,
      marker: { color: t.acc, size: 9, symbol: "circle", line: { width: 1.5, color: t.bg } },
      error_y: {
        type: "data", symmetric: true,
        array: err,
        color: t.acc, thickness: 2, width: 6,
      },
      name: "Observed",
      hovertemplate: "Predicted: %{x:.3f}<br>Observed: %{y:.3f} ± %{customdata:.3f}<extra></extra>",
      customdata: err,
      showlegend: false,
    },
  ];

  const hlText = `H-L \u03c7\u00b2=${cal.hlStat?.toFixed(1)} p=${fmtP(cal.hlP)}`;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 55, r: 30, t: 15, b: 55 },
    xaxis: { title: "Predicted probability", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    yaxis: { title: "Observed proportion", range: [0, 1], gridcolor: t.surf3, zeroline: false, dtick: 0.25 },
    height: 390,
    annotations: [{
      x: 1, y: 1, xref: "paper", yref: "paper",
      text: hlText, showarrow: false,
      xanchor: "right", yanchor: "top",
      font: { size: 10, color: t.tx2 },
    }],
  };

  return <ChartCard title="Calibration Plot — Composite Index" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: 390 }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPERIMPOSITION CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function SuperimpositionCharts({ results, t }) {
  if (!results || results.error) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No chartable data.</div>;
  const displacements = results.displacements || [];
  if (displacements.length === 0) return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No displacement data.</div>;

  // Extract T1/T2 measurement pairs for normograms
  const angularData = (results.angularChanges || [])
    .filter(c => c.angle2 != null && c.angle1 != null && isFinite(c.angle2) && isFinite(c.angle1))
    .map(c => ({ label: c.label, t1: c.angle2, t2: c.angle1 }));
  const linearData = (results.linearChanges || [])
    .filter(c => c.value2 != null && c.value1 != null && isFinite(c.value2) && isFinite(c.value1))
    .map(c => ({ label: c.label, t1: c.value2, t2: c.value1, unit: c.unit }));
  const normogramData = angularData.length >= 3 ? angularData
    : linearData.length >= 3 ? linearData : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DisplacementBarPlot displacements={displacements} t={t} />
      <DisplacementPolarPlot displacements={displacements} t={t} />
      <DisplacementVectorField displacements={displacements} t={t} />
      {results.rotationTracking?.length > 0 && <RotationTrackingChart rotationTracking={results.rotationTracking} t={t} />}
      {results.planeIntersections?.length > 0 && <PlaneAngleChart planeIntersections={results.planeIntersections} t={t} />}
      {results.deltaNorms?.length > 0 && <DeltaNormChart deltaNorms={results.deltaNorms} t={t} />}
      {results.patterns?.length > 0 && <PatternSeverityBar patterns={results.patterns} t={t} />}
      {normogramData && (
        <ChartCard title="Superimposed Measurement Normogram" t={t}>
          <NormogramPolygon measurements={normogramData} t={t} />
        </ChartCard>
      )}
    </div>
  );
}

function DisplacementBarPlot({ displacements, t }) {
  const sorted = [...displacements].sort((a, b) => b.lenMm - a.lenMm);
  const colors = sorted.map(d => d.lenMm < 2 ? "#22c55e" : d.lenMm < 5 ? "#eab308" : "#ef4444");
  const axisUnit = sorted[0]?.unit || "mm";

  const trace = {
    type: "bar", orientation: "h",
    y: sorted.map(d => d.label),
    x: sorted.map(d => d.lenMm),
    marker: { color: colors, line: { width: 0 } },
    text: sorted.map(d => d.lenMm.toFixed(2) + " " + d.unit),
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    customdata: sorted.map(d => d.unit || ""),
    hovertemplate: "%{y}: %{x:.2f} %{customdata}<extra></extra>",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 100, r: 80, t: 15, b: 45 },
    xaxis: { title: `Displacement (${axisUnit})`, gridcolor: t.surf3, zeroline: false },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(200, displacements.length * 24 + 50),
  };

  return <ChartCard title="Landmark Displacement" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DisplacementPolarPlot({ displacements, t }) {
  const pts = displacements.filter(d => d.lenMm > 0.01);
  if (pts.length === 0) return null;

  const dirs = [
    { label: "N", angle: 90 }, { label: "NE", angle: 45 }, { label: "E", angle: 0 },
    { label: "SE", angle: -45 }, { label: "S", angle: -90 }, { label: "SW", angle: -135 },
    { label: "W", angle: 180 }, { label: "NW", angle: 135 },
  ];

  const sorted = [...pts].sort((a, b) => b.lenMm - a.lenMm);
  const trace = {
    type: "bar",
    x: sorted.map(d => d.lenMm),
    y: sorted.map(d => d.label),
    orientation: "h",
    marker: {
      color: sorted.map(d => {
        const norm = ((d.angle + 360) % 360);
        const hue = norm / 360;
        return `hsl(${Math.round(hue * 360)}, 65%, 55%)`;
      }),
    },
    text: sorted.map(d => {
      const norm = ((d.angle + 360) % 360);
      const closest = dirs.reduce((best, dir) => {
        const diff = Math.abs(norm - ((dir.angle + 360) % 360));
        const wrap = Math.min(diff, 360 - diff);
        return wrap < best.diff ? { ...dir, diff } : best;
      }, { diff: Infinity });
      return `${d.lenMm.toFixed(2)} ${d.unit} (${closest.label})`;
    }),
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    customdata: sorted.map(d => d.unit || ""),
    hovertemplate: "%{y}: %{x:.2f} %{customdata}<extra></extra>",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 80, r: 80, t: 15, b: 40 },
    xaxis: { gridcolor: t.surf3, zeroline: false, title: `Distance (${sorted[0]?.unit || "mm"})` },
    yaxis: { gridcolor: t.surf3, autorange: "reversed" },
    height: Math.max(200, sorted.length * 28 + 60),
    annotations: [{
      x: 0.5, y: 1.02, xref: "paper", yref: "paper",
      text: "Color = direction (compass)",
      showarrow: false, font: { size: 9, color: t.tx3 },
    }],
  };

  return <ChartCard title="Displacement Direction" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DisplacementVectorField({ displacements, t }) {
  const pts = displacements.filter(d => d.lenMm > 0.01);
  if (pts.length === 0) return null;

  const scale = 3;
  const traces = [];

  pts.forEach(d => {
    const ex = d.baseX + (d.dx || 0) * scale;
    const ey = d.baseY + (d.dy || 0) * scale;
    traces.push({
      type: "scatter", mode: "lines",
      x: [d.baseX, ex], y: [d.baseY, ey],
      line: { color: d.lenMm < 2 ? "#22c55e" : d.lenMm < 5 ? "#eab308" : "#ef4444", width: 2 },
      showlegend: false, hoverinfo: "skip",
    });
  });

  traces.push({
    type: "scatter", mode: "markers",
    x: pts.map(d => d.baseX),
    y: pts.map(d => d.baseY),
    marker: { color: pts.map(d => d.lenMm < 2 ? "#22c55e" : d.lenMm < 5 ? "#eab308" : "#ef4444"), size: 7, symbol: "circle", line: { width: 1, color: t.bg } },
    text: pts.map(d => `${d.label}: ${d.lenMm.toFixed(2)} mm`),
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
  });

  traces.push({
    type: "scatter", mode: "markers+text",
    x: pts.map(d => d.baseX + (d.dx || 0) * scale),
    y: pts.map(d => d.baseY + (d.dy || 0) * scale),
    marker: { color: pts.map(d => d.lenMm < 2 ? "#22c55e" : d.lenMm < 5 ? "#eab308" : "#ef4444"), size: 4, symbol: "triangle-up" },
    text: pts.map(d => d.label),
    textposition: "top center",
    textfont: { size: 8, color: t.tx2, family: FONT_STACK },
    showlegend: false, hoverinfo: "skip",
  });

  const allX = pts.flatMap(d => [d.baseX, d.baseX + (d.dx || 0) * scale]);
  const allY = pts.flatMap(d => [d.baseY, d.baseY + (d.dy || 0) * scale]);
  const pad = 20;
  const xMin = Math.min(...allX) - pad;
  const xMax = Math.max(...allX) + pad;
  const yMin = Math.min(...allY) - pad;
  const yMax = Math.max(...allY) + pad;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 50, r: 30, t: 15, b: 50 },
    xaxis: { range: [xMin, xMax], gridcolor: t.surf3, zeroline: false, title: "X (mm)" },
    yaxis: { range: [yMin, yMax], gridcolor: t.surf3, zeroline: false, title: "Y (mm)", scaleanchor: "x" },
    height: Math.max(350, Math.min(550, (yMax - yMin) / ((xMax - xMin) || 1) * 500)),
    annotations: [{
      x: 0.5, y: 1.02, xref: "paper", yref: "paper",
      text: "Vectors scaled 3\u00d7 for visibility",
      showarrow: false, font: { size: 9, color: t.tx3 },
    }],
  };

  return <ChartCard title="Displacement Vector Field" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function RotationTrackingChart({ rotationTracking, t }) {
  if (!rotationTracking?.length) return null;

  const TRAUMA_THRESHOLD = 2;
  const trace = {
    type: "bar",
    x: rotationTracking.map(rt => rt.label || rt.id),
    y: rotationTracking.map(rt => rt.deltaDeg),
    marker: { color: rotationTracking.map(rt => Math.abs(rt.deltaDeg) > TRAUMA_THRESHOLD ? t.err : t.ok), opacity: 0.7 },
    text: rotationTracking.map(rt => `${rt.deltaDeg >= 0 ? "+" : ""}${(rt.deltaDeg ?? 0).toFixed(2)}°`),
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertemplate: rotationTracking.map(rt =>
      `${rt.label || rt.id}: %{y:.2f}°<br>Direction: ${rt.direction || (rt.deltaDeg > 0 ? "opening" : "closing")}<extra></extra>`
    ),
    showlegend: false,
  };

  const absMax = Math.max(...rotationTracking.map(rt => Math.abs(rt.deltaDeg ?? 0)), 1) * 1.4;

  const annotations = [{
    x: 0.5, y: 1.02, xref: "paper", yref: "paper",
    text: `Threshold ±${TRAUMA_THRESHOLD}°`,
    showarrow: false, font: { size: 9, color: t.tx3 },
  }];

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 60, r: 30, t: 30, b: 50 },
    xaxis: { title: "Reference Plane", gridcolor: t.surf3, showgrid: false, tickfont: { size: 10 } },
    yaxis: { title: "Angle change (°)", range: [-absMax, absMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    height: 300,
    annotations,
    shapes: [
      { type: "line", x0: -0.5, x1: rotationTracking.length - 0.5, y0: TRAUMA_THRESHOLD, y1: TRAUMA_THRESHOLD, line: { color: t.tx3, width: 1, dash: "dash" } },
      { type: "line", x0: -0.5, x1: rotationTracking.length - 0.5, y0: -TRAUMA_THRESHOLD, y1: -TRAUMA_THRESHOLD, line: { color: t.tx3, width: 1, dash: "dash" } },
    ],
  };

  return <ChartCard title="Reference Plane Rotation" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: 300 }} />
  </ChartCard>;
}

function PlaneAngleChart({ planeIntersections, t }) {
  if (!planeIntersections?.length) return null;

  const yLabels = planeIntersections.map(pi => pi.name);
  const vals = planeIntersections.map(pi => pi.delta);
  const colors = vals.map(v => Math.abs(v) > 2 ? t.err : Math.abs(v) > 1 ? t.warn : t.ok);

  const trace = {
    type: "scatter", mode: "markers+text",
    x: vals, y: yLabels,
    marker: { color: colors, size: 12, symbol: "diamond", line: { width: 1, color: t.bg } },
    text: vals.map(v => `${v >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}°`),
    textposition: "right",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.2f}°<extra></extra>",
    showlegend: false,
  };

  const absMax = Math.max(...vals.map(Math.abs), 1) * 1.3;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 120, r: 60, t: 15, b: 45 },
    xaxis: { title: "Angle change (°)", range: [-absMax, absMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(200, planeIntersections.length * 36 + 50),
  };

  return <ChartCard title="Reference Plane Intersections" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function DeltaNormChart({ deltaNorms, t }) {
  if (!deltaNorms?.length) return null;

  const yLabels = deltaNorms.map(dn => dn.label);
  const actual = deltaNorms.map(dn => dn.delta);
  const expected = deltaNorms.map(dn => dn.norm?.expectedDelta ?? 0);
  const colors = deltaNorms.map(dn => {
    if (dn.within1SD) return t.ok;
    if (dn.within2SD) return t.warn;
    return t.err;
  });

  const traces = [
    {
      type: "bar", name: "Actual change",
      y: yLabels, x: actual,
      orientation: "h",
      marker: { color: colors, opacity: 0.75 },
      text: actual.map(v => `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}°`),
      textposition: "outside",
      textfont: { size: 10, color: t.tx2, family: FONT_STACK },
      hovertemplate: "%{y}: Actual %{x:.2f}°<extra></extra>",
      showlegend: true,
    },
    {
      type: "bar", name: "Expected change",
      y: yLabels, x: expected,
      orientation: "h",
      marker: { color: t.tx3, opacity: 0.35 },
      text: expected.map(v => `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}°`),
      textposition: "outside",
      textfont: { size: 9, color: t.tx3, family: FONT_STACK },
      hovertemplate: "%{y}: Expected %{x:.2f}°<extra></extra>",
      showlegend: true,
    },
  ];

  const absMax = Math.max(...actual.map(v => Math.abs(v ?? 0)), ...expected.map(v => Math.abs(v ?? 0)), 1) * 1.3;

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    barmode: "group",
    margin: { l: 100, r: 70, t: 15, b: 45 },
    xaxis: { title: "Change (°)", range: [-absMax, absMax], gridcolor: t.surf3, zeroline: true, zerolinecolor: t.tx3 },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(200, deltaNorms.length * 32 + 50),
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center", font: { size: 10 } },
  };

  return <ChartCard title="Delta Norms: Actual vs Expected Change" t={t}>
    <PlotlyChart data={traces} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

function PatternSeverityBar({ patterns, t }) {
  if (!patterns?.length) return null;

  const severityMap = { mild: 1, moderate: 2, severe: 3 };
  const severityColors = { mild: "#22c55e", moderate: "#eab308", severe: "#ef4444" };

  const sorted = [...patterns].sort((a, b) => (severityMap[b.severity] || 0) - (severityMap[a.severity] || 0));

  const trace = {
    type: "bar", orientation: "h",
    y: sorted.map(p => p.label),
    x: sorted.map(p => severityMap[p.severity] || 0),
    marker: { color: sorted.map(p => severityColors[p.severity] || t.tx3) },
    text: sorted.map(p => `${p.severity}: ${p.summary}`),
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertext: sorted.map(p => `${p.label}\nSeverity: ${p.severity}\n${p.summary}\n\n${p.detail}`),
    hoverinfo: "text",
    showlegend: false,
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 140, r: 80, t: 15, b: 40 },
    xaxis: { range: [0, 3.8], gridcolor: t.surf3, zeroline: false, tickvals: [1, 2, 3], ticktext: ["Mild", "Moderate", "Severe"] },
    yaxis: { gridcolor: t.surf3, autorange: "reversed" },
    height: Math.max(200, sorted.length * 32 + 60),
    annotations: [{
      x: 0.5, y: 1.02, xref: "paper", yref: "paper",
      text: "Severity: Mild (1) / Moderate (2) / Severe (3)",
      showarrow: false, font: { size: 9, color: t.tx3 },
    }],
  };

  return <ChartCard title="Clinical Pattern Profile" t={t}>
    <PlotlyChart data={[trace]} layout={layout} style={{ height: layout.height }} />
  </ChartCard>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

export function AirwayCharts({ results, t }) {
  const measurements = (results.measurements || []).filter(m => m.id !== "_global");
  if (measurements.length === 0) {
    return <div style={{ fontSize: FONT.md, color: t.tx3, textAlign: "center", padding: 20 }}>No airway data to chart.</div>;
  }

  const clinicalNotes = measurements.filter(m => m.clinicalNote);

  const trace = {
    type: "bar",
    orientation: "h",
    y: measurements.map(m => m.label),
    x: measurements.map(m => m.value != null ? m.value : 0),
    marker: {
      color: measurements.map(m => {
        if (m.zScore == null || !isFinite(m.zScore)) return t.tx3;
        if (Math.abs(m.zScore) <= 1) return "#22c55e";
        if (Math.abs(m.zScore) <= 2) return "#eab308";
        return "#ef4444";
      }),
    },
    text: measurements.map(m => m.value != null ? m.value.toFixed(2) + " " + (m.unit || "") : "—"),
    textposition: "outside",
    textfont: { size: 10, color: t.tx2, family: FONT_STACK },
    hovertemplate: "%{y}: %{x:.2f} %{customdata}<extra></extra>",
    customdata: measurements.map(m => (m.normMean != null ? `norm ${m.normMean.toFixed(1)} ± ${(m.normSD != null ? m.normSD.toFixed(1) : "—")}` : "")),
    showlegend: false,
  };

  const normTrace = {
    type: "scatter",
    mode: "lines",
    x: measurements.map(m => m.normMean || 0),
    y: measurements.map(m => m.label),
    line: { color: t.tx3, width: 1, dash: "dash" },
    showlegend: false,
    hoverinfo: "skip",
  };

  const layout = {
    paper_bgcolor: t.surf, plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    margin: { l: 150, r: 80, t: 15, b: 45 },
    xaxis: { title: "Measurement (" + (measurements[0]?.unit || "mm") + ")", gridcolor: t.surf3, zeroline: false },
    yaxis: { autorange: "reversed", zeroline: false, showgrid: false, tickfont: { size: 10 } },
    height: Math.max(220, measurements.length * 24 + 50),
    shapes: [{
      type: "line",
      x0: 0, x1: 0,
      y0: -0.5, y1: measurements.length - 0.5,
      line: { color: t.tx3, width: 0.5 },
    }],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ChartCard title="Airway Measurement Profile" t={t}>
        <PlotlyChart data={[normTrace, trace]} layout={layout} style={{ height: layout.height }} />
      </ChartCard>

      {clinicalNotes.length > 0 && (
        <ChartCard title="Clinical Findings" t={t}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {clinicalNotes.map(m => (
              <div key={m.id} style={{
                padding: "6px 8px", borderRadius: 4, background: t.surf2,
                borderLeft: `3px solid ${m.zScore != null && Math.abs(m.zScore) > 2 ? "#ef4444" : m.zScore != null && Math.abs(m.zScore) > 1 ? "#eab308" : "#22c55e"}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>{m.label}</div>
                <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>{m.clinicalNote}</div>
                {m.value != null && (
                  <div style={{ fontSize: 9, color: t.tx3, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                    Value: {m.value.toFixed(2)} {m.unit}  |  Z-score: {(m.zScore >= 0 ? "+" : "") + m.zScore.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOMOGRAM CHART — Canvas-based T1/T2 overlaid polygon
// ═══════════════════════════════════════════════════════════════════════════════

function drawNormogram(ctx, w, h, data, t) {
  const p = 60;
  const cx = w / 2 + 20, cy = h / 2 + 10;
  const r = Math.min((w - p * 2) / 2, (h - p * 2) / 2);
  const n = data.length;
  if (n < 3 || r < 40) return;

  // Normalize all values to 0..1
  let minV = Infinity, maxV = -Infinity;
  for (const d of data) {
    if (d.t1 < minV) minV = d.t1;
    if (d.t2 < minV) minV = d.t2;
    if (d.t1 > maxV) maxV = d.t1;
    if (d.t2 > maxV) maxV = d.t2;
  }
  const pad = (maxV - minV || 1) * 0.1;
  const scaleMin = minV - pad;
  const scaleR = (maxV + pad - scaleMin) || 1;

  function valToR(v) { return ((v - scaleMin) / scaleR) * r * 0.9; }
  function angle(i) { return -Math.PI / 2 + (2 * Math.PI * i) / n; }

  // Grid circles
  for (const g of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * g, 0, Math.PI * 2);
    ctx.strokeStyle = t.bdr + "44";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Axis lines + labels
  ctx.font = `10px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const a = angle(i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.strokeStyle = t.bdr + "66";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const lx = cx + (r + 48) * Math.cos(a), ly = cy + (r + 48) * Math.sin(a);
    ctx.textAlign = Math.abs(Math.cos(a)) < 0.1 ? "center" : Math.cos(a) > 0 ? "left" : "right";
    ctx.textBaseline = Math.abs(Math.sin(a)) < 0.1 ? "middle" : Math.sin(a) > 0 ? "top" : "bottom";
    ctx.fillStyle = t.tx;
    ctx.fillText(data[i].label, lx, ly);
  }

  function getPts(field) {
    return data.map((d, i) => {
      const a = angle(i);
      const vr = valToR(d[field]);
      return { x: cx + vr * Math.cos(a), y: cy + vr * Math.sin(a) };
    });
  }

  function drawPolygon(pts, color, dashed) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  const t1Pts = getPts("t1");
  const t2Pts = getPts("t2");

  drawPolygon(t2Pts, "#D55E00", false);  // T2 solid orange
  drawPolygon(t1Pts, "#0072B2", true);   // T1 dashed blue

  // Legend
  const legX = 12, legY = 12;
  ctx.fillStyle = t.bg + "cc";
  ctx.beginPath();
  ctx.roundRect(legX, legY, 90, 44, 4);
  ctx.fill();

  ctx.fillStyle = "#0072B2";
  ctx.fillRect(legX + 8, legY + 8, 12, 3);
  ctx.fillStyle = t.tx2;
  ctx.font = `9px ${FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("T1 (Base)", legX + 24, legY + 10);

  ctx.fillStyle = "#D55E00";
  ctx.fillRect(legX + 8, legY + 26, 12, 3);
  ctx.fillText("T2 (Compare)", legX + 24, legY + 28);
}

function NormogramPolygon({ measurements, t }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || measurements.length < 3) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = 350;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    drawNormogram(ctx, w, h, measurements, t);
  }, [measurements, t]);
  return <canvas ref={ref} style={{ width: "100%", height: 350 }} />;
}
