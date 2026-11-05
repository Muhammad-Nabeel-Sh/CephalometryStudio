// ═══════════════════════════════════════════════════════════════════════════════
// AI Trace: the button that starts a trace and the screen shown while it runs.
//
// Inference blocks the main thread (single-threaded wasm), so everything that
// must keep moving during detection is a CSS opacity/transform animation on HTML
// elements (see "AI Trace" in index.css). SVG attributes and JS timers would freeze.
// ═══════════════════════════════════════════════════════════════════════════════

import { MEAN_SHAPE, MAP_BOX, MAP_OUTLINES } from "../data/landmarkReference.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { useUIStore } from "../state/uiStore.js";
import { BACKDROP } from "../ui/tokens.js";
import { Btn } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { describeDownload } from "../workspace/autoTrace.js";

// Radiographic film stays dark in every theme.
const FILM_BG = "radial-gradient(circle at 50% 42%, #1d3a49 0%, #10222d 58%, #0a161e 100%)";
const LINE_DIM = "rgba(160, 200, 215, 0.2)";
const LINE_LIT = "#b9dfec";

const OUTLINES = MAP_OUTLINES.map((syms) =>
  syms.map((s) => `${MEAN_SHAPE[s].x},${MEAN_SHAPE[s].y}`).join(" "));

const DOTS = Object.entries(MEAN_SHAPE).map(([symbol, p]) => ({
  symbol,
  left: ((p.x - MAP_BOX.x) / MAP_BOX.w) * 100,
  top: ((p.y - MAP_BOX.y) / MAP_BOX.h) * 100,
}));

const TITLES = {
  downloading: "Downloading the AI model",
  preparing: "Getting the AI model ready",
  detecting: "Finding landmarks",
};

function TraceLines({ color }) {
  return (
    <svg viewBox={`${MAP_BOX.x} ${MAP_BOX.y} ${MAP_BOX.w} ${MAP_BOX.h}`} aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {OUTLINES.map((points) => (
        <polyline key={points} points={points} fill="none" stroke={color} strokeWidth={MAP_BOX.w / 150}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// The mean skull map being traced. With `progress` (0–1) the trace follows it;
// without, a scan repeats and each landmark lights up as the scan reaches it.
function TraceFilm({ progress }) {
  const known = progress != null;
  const y = known ? progress * 100 : 0;
  return (
    <div className={known ? undefined : "ai-trace-looping"} aria-hidden="true"
      style={{ position: "relative", aspectRatio: `${MAP_BOX.w} / ${MAP_BOX.h}`, maxHeight: "42vh", margin: "0 auto", overflow: "hidden", background: FILM_BG, width: "100%" }}>
      <TraceLines color={LINE_DIM} />
      <div className="ai-trace-reveal" style={{ position: "absolute", inset: 0, overflow: "hidden", ...(known ? { transform: `translateY(${y - 100}%)` } : null) }}>
        <div className="ai-trace-reveal-inner" style={{ position: "absolute", inset: 0, ...(known ? { transform: `translateY(${100 - y}%)` } : null) }}>
          <TraceLines color={LINE_LIT} />
        </div>
      </div>
      {DOTS.map((d) => (
        <div key={d.symbol} className="ai-trace-dot" style={{
          left: `${d.left}%`, top: `${d.top}%`,
          ...(known ? { opacity: d.top <= y ? 1 : 0.3 } : { animationDelay: `${(d.top / 100) * 2.88}s` }),
        }} />
      ))}
      <div className="ai-trace-scan" style={known ? { transform: `translateY(${y - 100}%)` } : undefined} />
    </div>
  );
}

// Shown while a trace runs; `aiTrace` in uiStore holds the phase and download
// progress, so progress updates re-render only this component.
export function AITraceOverlay({ t, onCancelDownload }) {
  const status = useUIStore((s) => s.aiTrace);
  if (!status) return null;
  return <TraceDialog t={t} status={status} onCancelDownload={onCancelDownload} />;
}

export function TraceDialog({ t, status, onCancelDownload }) {
  const { phase, received = 0, total = 0, elapsedMs = 0 } = status;
  const downloading = phase === "downloading";
  const ref = useDialogA11y(downloading ? onCancelDownload : undefined);
  const percent = downloading && total ? Math.min(100, Math.round((received / total) * 100)) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ai-trace-title"
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: BACKDROP, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={ref} tabIndex={-1}
        style={{ width: "100%", maxWidth: 400, maxHeight: "100%", overflowY: "auto", background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 12, outline: "none", boxShadow: `0 16px 48px ${t.shadow}` }}>
        <TraceFilm progress={percent != null ? percent / 100 : null} />
        <div style={{ padding: "16px 20px 20px" }}>
          <div id="ai-trace-title" role="status" style={{ fontSize: 17, fontWeight: 600, color: t.tx }}>{TITLES[phase] || TITLES.preparing}</div>
          {downloading ? (
            <>
              <div role="progressbar" aria-label="Model download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}
                style={{ height: 6, marginTop: 12, borderRadius: 3, overflow: "hidden", background: t.surf3 }}>
                <div style={{ height: "100%", width: `${percent ?? 0}%`, borderRadius: 3, background: t.acc, transition: "width 0.25s linear" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: t.tx2, fontVariantNumeric: "tabular-nums" }}>{describeDownload(received, total, elapsedMs)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, padding: "10px 12px", borderRadius: 8, background: t.warn + "18", fontSize: 13, lineHeight: 1.45, color: t.tx }}>
                <Icon name="warning" size={16} color={t.warn} style={{ marginTop: 1 }} />
                <span>First use only: the model is about 30 MB and can take a few minutes on a slow connection. Keep this tab open. After this, AI Trace starts right away, even offline.</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <Btn t={t} small onClick={onCancelDownload}>Cancel download</Btn>
              </div>
            </>
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.45, color: t.tx2 }}>
              {phase === "detecting" && "This can take up to a minute on slower devices, and the page won't respond until it finishes. "}
              Your image stays on this device.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AITraceButton({ t, busy, onClick }) {
  const onAccent = t.id === "light" ? "#fff" : t.bg;
  return (
    <button type="button" className="ai-trace-btn" disabled={busy} onClick={onClick}
      title="Detect landmarks on this image with AI. It runs in your browser; the first use downloads the model (about 30 MB)."
      style={{ "--ai-ring": t.accMuted, background: t.acc, color: onAccent }}>
      {busy
        ? <span aria-hidden="true" style={{ width: 16, height: 16, border: `2px solid ${onAccent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        : <Icon name="aiTrace" size={20} />}
      {busy ? "Tracing…" : "AI Trace"}
    </button>
  );
}
