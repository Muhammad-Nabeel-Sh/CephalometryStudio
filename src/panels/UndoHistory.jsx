// ═══════════════════════════════════════════════════════════════════════════════
// Undo history list (B6) — the recent steps, newest first; clicking one undoes
// back to just before it.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../state/sessionStore.js";
import { historyEntries } from "../workspace/undoHistory.js";

const KIND_ICON = { add: "+", place: "◉", move: "↔", delete: "✕", edit: "✎", calibrate: "⟺", other: "•" };

export function UndoHistoryButton({ t, undoSteps }) {
  const [open, setOpen] = useState(null); // { depth, entries, top, left }
  const btnRef = useRef(null);
  const boxRef = useRef(null);
  const depth = useSessionStore(s => s.undoStack.length);

  const toggle = () => {
    if (open) { setOpen(null); return; }
    const st = useSessionStore.getState();
    const r = btnRef.current.getBoundingClientRect();
    setOpen({ depth: st.undoStack.length, entries: historyEntries(st.undoStack, st.snapshot()), top: Math.max(8, Math.min(r.top, window.innerHeight - 380)), left: r.right + 8 });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (!boxRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(null); };
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(null); } };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open]);

  // The list is a snapshot of the moment it opened; close it when history moves on.
  if (open && open.depth !== depth) setOpen(null);

  return (
    <>
      <button ref={btnRef} onClick={toggle} disabled={!depth} aria-expanded={!!open} aria-haspopup="menu"
        title="Undo history" aria-label="Undo history"
        style={{ width: "100%", height: 26, borderRadius: 6, border: "none", background: open ? t.accMuted : "transparent", color: depth ? t.tx2 : t.bdr, cursor: depth ? "pointer" : "not-allowed", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span aria-hidden="true">🕘</span> History
      </button>
      {open && (
        <div ref={boxRef} role="menu" aria-label="Undo history"
          style={{ position: "fixed", top: open.top, left: open.left, zIndex: 40, width: 260, maxHeight: 370, overflowY: "auto", background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 8, boxShadow: `0 8px 24px ${t.shadow}`, padding: 4 }}>
          <div style={{ fontSize: 12, color: t.tx3, padding: "6px 8px 4px" }}>Click a step to undo it and everything after it.</div>
          {open.entries.map(e => (
            <button key={e.steps} role="menuitem" onClick={() => { setOpen(null); undoSteps(e.steps); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "none", borderRadius: 5, background: "transparent", color: t.tx, fontSize: 13, textAlign: "left", cursor: "pointer" }}
              onMouseEnter={ev => { ev.currentTarget.style.background = t.accMuted; }} onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}>
              <span aria-hidden="true" style={{ width: 16, textAlign: "center", color: e.kind === "delete" ? t.err : t.tx3 }}>{KIND_ICON[e.kind] || "•"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text}</span>
              {e.steps > 1 && <span style={{ fontSize: 11, color: t.tx3 }}>{e.steps} steps</span>}
            </button>
          ))}
          {depth > open.entries.length && <div style={{ fontSize: 12, color: t.tx3, padding: "4px 8px" }}>…and {depth - open.entries.length} earlier</div>}
        </div>
      )}
    </>
  );
}
