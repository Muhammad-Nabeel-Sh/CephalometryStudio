// ═══════════════════════════════════════════════════════════════════════════════
// WHAT'S NEW — the release highlights (data/whatsNew.js), shown on the home
// screen at every visit and from the footer link. It doubles as the welcome:
// go to the home page, or continue the most recently changed case.
// ═══════════════════════════════════════════════════════════════════════════════

import { Btn } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { BACKDROP } from "../ui/tokens.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { WHATS_NEW } from "../data/whatsNew.js";

export default function WhatsNewDialog({ t, onClose, onFeatures, latestCase, onContinue }) {
  const ref = useDialogA11y(onClose);
  const mobile = useMediaQuery("(max-width: 640px)");
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: BACKDROP, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 10 : 24 }}>
      {/* Fits the screen: the highlights scroll, the buttons stay visible. */}
      <div ref={ref} style={{ width: 820, maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 18, overflow: "hidden", boxShadow: `0 30px 80px rgba(0,0,0,0.45)` }}>
        {/* Banner */}
        <div style={{ position: "relative", flexShrink: 0, padding: mobile ? "18px 16px 14px" : "26px 32px 20px", background: `linear-gradient(135deg, ${t.acc}33, ${t.acc}08 60%, transparent)`, borderBottom: `1px solid ${t.bdr}` }}>
          <button onClick={onClose} aria-label="Close" title="Close"
            style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, fontSize: 22, cursor: "pointer" }}>×</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: t.acc, color: t.bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${t.acc}55` }}>
              <Icon name="sparkle" size={22} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.acc }}>What&apos;s new</span>
          </div>
          <h2 id="whats-new-title" style={{ margin: "0 0 6px", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: mobile ? 22 : 28, lineHeight: 1.15, color: t.tx }}>{WHATS_NEW.title}</h2>
          <p style={{ margin: 0, fontSize: 15, color: t.tx2, lineHeight: 1.6 }}>{WHATS_NEW.subtitle}</p>
        </div>

        {/* Highlights */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: mobile ? 14 : "18px 24px", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 10, alignContent: "start" }}>
          {WHATS_NEW.items.map((it) => (
            <div key={it.title} style={{ display: "flex", gap: 12, padding: 14, borderRadius: 12, border: `1px solid ${t.bdr}`, background: t.bg }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: it.color + "22", color: it.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={it.icon} size={19} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: t.tx }}>{it.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: it.color, background: it.color + "1c", borderRadius: 6, padding: "1px 6px" }}>{it.tag}</span>
                </div>
                <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.55 }}>{it.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${t.bdr}`, padding: mobile ? "12px 14px 14px" : "14px 24px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 260px", fontSize: 13, color: t.tx3, lineHeight: 1.5 }}>
            {WHATS_NEW.also}{" "}
            {onFeatures && (
              <button onClick={onFeatures} style={{ background: "none", border: "none", padding: 0, color: t.acc, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Explore all features →
              </button>
            )}
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", width: mobile ? "100%" : undefined }}>
            <Btn t={t} onClick={onClose} style={mobile ? { flex: 1 } : undefined}>Homepage</Btn>
            {latestCase && (
              <Btn t={t} active onClick={onContinue} title={`Open ${latestCase.name || "your latest case"}`}
                style={{ maxWidth: mobile ? "100%" : 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(mobile ? { flex: 1 } : {}) }}>
                Continue to “{latestCase.name || "Untitled case"}” →
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
