// ═══════════════════════════════════════════════════════════════════════════════
// Nudge pad — moves the selected landmark in small, exact steps, for touch screens
// (a keyboard uses the arrow keys). Steps are in image pixels.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Icon } from "../ui/icons.jsx";

const STEP = 44;
const ARROWS = [
  { name: "up", dx: 0, dy: -1, col: 2, row: 1, d: "m6 15 6-6 6 6" },
  { name: "left", dx: -1, dy: 0, col: 1, row: 2, d: "m15 18-6-6 6-6" },
  { name: "right", dx: 1, dy: 0, col: 3, row: 2, d: "m9 18 6-6-6-6" },
  { name: "down", dx: 0, dy: 1, col: 2, row: 3, d: "m6 9 6 6 6-6" },
];

export function NudgePad({ t, label, onNudge, style }) {
  const [fine, setFine] = useState(false);
  const step = fine ? 0.25 : 1;
  const btn = { width: STEP, height: STEP, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: "none", borderRadius: 8, background: t.surf2, color: t.tx, cursor: "pointer", touchAction: "manipulation" };
  return (
    <div role="group" aria-label={`Nudge ${label}`} className="mobile-chrome"
      style={{ position: "absolute", display: "grid", gridTemplateColumns: `repeat(3, ${STEP}px)`, gridTemplateRows: `repeat(3, ${STEP}px)`, gap: 3, padding: 6, background: t.surf + "ee", border: `1px solid ${t.bdr}`, borderRadius: 12, boxShadow: `0 4px 16px ${t.shadow}`, zIndex: 8, ...style }}>
      {ARROWS.map(a => (
        <button key={a.name} aria-label={`Nudge ${a.name}`} title={`Move ${label} ${step} px ${a.name}`}
          onClick={() => onNudge(a.dx * step, a.dy * step)}
          style={{ ...btn, gridColumn: a.col, gridRow: a.row }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={a.d} /></svg>
        </button>
      ))}
      <button aria-label="Fine steps" aria-pressed={fine} title={fine ? "Quarter-pixel steps" : "One-pixel steps"} onClick={() => setFine(v => !v)}
        style={{ ...btn, gridColumn: 2, gridRow: 2, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", background: fine ? t.acc : "transparent", color: fine ? (t.id === "light" ? "#fff" : t.bg) : t.tx2 }}>
        {fine ? "¼" : <Icon name="target" size={18} />}
      </button>
    </div>
  );
}
