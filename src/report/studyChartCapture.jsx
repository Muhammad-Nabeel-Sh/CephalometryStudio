import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  ReliabilityCharts, DescriptiveCharts, ComparativeCharts, LongitudinalCharts,
  CorrelationCharts, DiagnosticCharts, SuperimpositionCharts, AirwayCharts,
} from "../research/moduleCharts.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY CHARTS FOR THE PDF REPORT
// Renders a study's Charts view off screen in the report's colours, waits for
// its Plotly charts to draw, and returns each one as a PNG.
// ═══════════════════════════════════════════════════════════════════════════════
const CHARTS = {
  reliability: ReliabilityCharts,
  descriptive: DescriptiveCharts,
  comparative: ComparativeCharts,
  longitudinal: LongitudinalCharts,
  correlation: CorrelationCharts,
  diagnostic: DiagnosticCharts,
  superimposition: SuperimpositionCharts,
  airway: AirwayCharts,
};

const WIDTH = 900;

const wait = ms => new Promise(r => setTimeout(r, ms));

// Wait until the number of drawn charts stops changing (or give up).
async function waitForCharts(host, { settle = 800, timeout = 9000 } = {}) {
  const start = Date.now();
  let last = -1, stableSince = Date.now();
  while (Date.now() - start < timeout) {
    await wait(150);
    const n = [...host.querySelectorAll(".js-plotly-plot")].filter(el => el._fullLayout).length;
    if (n !== last) { last = n; stableSince = Date.now(); }
    else if (n > 0 && Date.now() - stableSince >= settle) break;
  }
  return [...host.querySelectorAll(".js-plotly-plot")].filter(el => el._fullLayout);
}

export async function captureStudyCharts(study, palette) {
  const Charts = CHARTS[study?.type];
  if (!Charts || !study.results || typeof document === "undefined") return [];
  const t = { ...palette, accMuted: palette.acc + "22", shadow: "none" };
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${WIDTH}px`, background: t.bg, pointerEvents: "none" });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<Charts results={study.results} t={t} />));
    const plots = await waitForCharts(host);
    if (!plots.length) return [];
    const Plotly = await import("plotly.js-basic-dist-min");
    const out = [];
    for (const gd of plots) {
      const w = gd._fullLayout.width || WIDTH, h = gd._fullLayout.height || 400;
      try {
        const dataUrl = await Plotly.toImage(gd, { format: "png", width: w, height: h, scale: 2 });
        out.push({ dataUrl, w, h });
      } catch { /* skip a chart that cannot be exported */ }
    }
    return out;
  } finally {
    root.unmount();
    host.remove();
  }
}
