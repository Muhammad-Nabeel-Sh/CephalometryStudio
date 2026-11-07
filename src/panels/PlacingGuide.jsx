// ═══════════════════════════════════════════════════════════════════════════════
// Guided tracing (B2) — the landmark-placing banner: a reference map with the
// landmark highlighted, its definition, Skip / Back / Unsure, and a magnifier.
// ═══════════════════════════════════════════════════════════════════════════════

import { MEAN_SHAPE as MEAN, MAP_OUTLINES as OUTLINES, MAP_BOX as BOX, mapSymbolFor } from "../data/landmarkReference.js";
import { useSessionStore } from "../state/sessionStore.js";
import { useUIStore } from "../state/uiStore.js";
import { stepLoupeZoom } from "../lib/precision.js";
import { resolveFacing } from "../lib/measureConventions.js";
import { Icon } from "../ui/icons.jsx";

function LandmarkMap({ t, symbol, facing }) {
  const flip = facing === "left";
  const hl = symbol && MEAN[symbol];
  return (
    <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} width={112} height={Math.round(112 * BOX.h / BOX.w)}
      role="img" aria-label={symbol ? `Reference position of ${symbol}` : "Reference skull map"}
      style={{ flexShrink: 0, background: t.surf2, borderRadius: 6, border: `1px solid ${t.bdr}` }}>
      <g transform={flip ? `translate(${2 * BOX.x + BOX.w} 0) scale(-1 1)` : undefined}>
        {OUTLINES.map((line, i) => (
          <polyline key={i} points={line.filter(s => MEAN[s]).map(s => `${MEAN[s].x},${MEAN[s].y}`).join(" ")}
            fill="none" stroke={t.tx3} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
        ))}
        {Object.entries(MEAN).map(([s, p]) => <circle key={s} cx={p.x} cy={p.y} r={11} fill={t.tx3} opacity={0.8} />)}
        {hl && <>
          <circle cx={hl.x} cy={hl.y} r={44} fill="none" stroke={t.acc} strokeWidth={10} />
          <circle cx={hl.x} cy={hl.y} r={20} fill={t.acc} />
        </>}
      </g>
    </svg>
  );
}

const pill = (t, active, tone) => ({
  padding: "4px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 500,
  border: `1px solid ${active ? (tone || t.acc) : t.bdr}`, background: active ? (tone || t.acc) + "22" : "transparent", color: active ? (tone || t.acc) : t.tx2,
});

export function PlacingGuide({ t, markup, idx, total, unsure, onToggleUnsure, onSkip, onBack, magnifier, onToggleMagnifier }) {
  const facing = useSessionStore(s => resolveFacing(s.facing, s.markups));
  const symbol = mapSymbolFor(markup);
  const defText = markup.definition || "No definition available";
  const loupeZoom = useUIStore(s => s.loupeZoom);
  const stepZoom = direction => useUIStore.setState({ loupeZoom: stepLoupeZoom(loupeZoom, direction) });
  return (
    <div role="status" aria-label={`Place ${markup.label}: ${defText}`}
      style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "min(600px,calc(100% - 32px))", background: t.surf, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 8 }}>
      <div style={{ height: 4, background: t.surf3 }}>
        <div style={{ height: "100%", width: `${Math.round((idx / Math.max(1, total)) * 100)}%`, background: t.acc, transition: "width 0.2s" }} />
      </div>
      <div style={{ padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <LandmarkMap t={t} symbol={symbol} facing={facing} />
          {!symbol && <span style={{ fontSize: 10, color: t.tx3, maxWidth: 112, textAlign: "center" }}>Not on the reference map</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: t.tx, fontFamily: "'DM Sans',sans-serif" }}>{markup.label}</span>
            <span style={{ fontSize: 12, color: t.tx3 }}>{idx + 1} of {total}</span>
          </div>
          <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.45, fontFamily: "'DM Sans',sans-serif" }}>{defText}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={onBack} title="Back to the previous landmark (Backspace)" style={pill(t, false)}>← Back</button>
            <button onClick={onSkip} title="Leave this landmark for later (Esc)" style={pill(t, false)}>Skip</button>
            <button onClick={onToggleUnsure} aria-pressed={unsure} title="Flag this landmark for review after you place it" style={pill(t, unsure, t.warn)}>
              {unsure ? "⚑ Unsure" : "⚐ Unsure"}
            </button>
            <button onClick={onToggleMagnifier} aria-pressed={magnifier} title="Show a magnified view beside the pointer" style={{ ...pill(t, magnifier), marginLeft: "auto" }}><Icon name="search" size={13} /> Loupe</button>
            {magnifier && <>
              <button onClick={() => stepZoom(-1)} aria-label="Less loupe zoom" title="Less loupe zoom" style={pill(t, false)}>−</button>
              <span style={{ fontSize: 12, color: t.tx2, fontFamily: "'DM Mono',monospace", minWidth: 24, textAlign: "center" }}>{loupeZoom}×</span>
              <button onClick={() => stepZoom(1)} aria-label="More loupe zoom" title="More loupe zoom" style={pill(t, false)}>+</button>
            </>}
          </div>
          <div style={{ fontSize: 11, color: t.tx3 }}>Press, adjust, then lift to place · two fingers pan and zoom · the next landmark follows automatically</div>
        </div>
      </div>
    </div>
  );
}
