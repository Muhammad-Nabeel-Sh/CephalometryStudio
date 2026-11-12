// ═══════════════════════════════════════════════════════════════════════════════
// Research workspace pieces: the action menus and the study progress bars.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Btn } from "../ui/ui.jsx";

// A button that opens a list of actions. Items: { label, onClick, danger, hidden },
// or a function returning them, built when the menu opens.
export function Menu({ t, label, children, items, title }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const toggle = () => {
    if (!open) setList(typeof items === "function" ? items() : items);
    setOpen(v => !v);
  };
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }} onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }}>
      <span aria-haspopup="menu" aria-expanded={open} style={{ display: "contents" }}>
        <Btn t={t} small title={title} onClick={toggle}>{children || label}</Btn>
      </span>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 5, minWidth: 180, padding: 4, borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, boxShadow: `0 8px 24px ${t.shadow}` }}>
          {list.filter(i => !i.hidden).map(i => (
            <button key={i.label} role="menuitem" onClick={() => { setOpen(false); i.onClick(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 6, background: "transparent", color: i.danger ? t.err : t.tx, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = t.surf3; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Setup, data and results as three short bars. The last one carries the run status.
const RESULT_COLOR = { current: "ok", stale: "warn", legacy: "warn", error: "err", running: "acc" };
export function Pipeline({ t, status, ran }) {
  const bars = [t.acc, ran ? t.acc : t.surf3, RESULT_COLOR[status] ? t[RESULT_COLOR[status]] : t.surf3];
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 3 }}>
      {bars.map((c, i) => <span key={i} data-testid="pipeline-step" style={{ width: 16, height: 3, borderRadius: 2, background: c }} />)}
    </span>
  );
}
