// ═══════════════════════════════════════════════════════════════════════════════
// DialogHost — renders the in-app dialog queue and toasts from ui/dialogs.js
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useDialogStore, closeDialog, dismissToast } from "./dialogs.js";

function DialogBox({ t, d }) {
  const [value, setValue] = useState(d.defaultValue ?? "");
  const boxRef = useRef(null);
  const firstRef = useRef(null);
  const cancelValue = d.kind === "confirm" ? false : d.kind === "text" ? null : undefined;
  const accept = () => closeDialog(d.id, d.kind === "confirm" ? true : d.kind === "text" ? value : undefined);

  useEffect(() => {
    const prev = document.activeElement;
    (firstRef.current || boxRef.current)?.focus();
    if (d.kind === "text") firstRef.current?.select?.();
    return () => { try { prev?.focus?.(); } catch { /* element gone */ } };
  }, [d.kind]);

  // Escape / Tab are handled here first (capture), so a dialog opened over a
  // Modal or the Research workspace never closes those as well.
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(d.id, cancelValue); return; }
      if (e.key === "Tab" && boxRef.current) {
        const f = boxRef.current.querySelectorAll("button,input,[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      // App shortcuts (Delete, Ctrl+Z, tool keys) must not act behind the dialog.
      // Native defaults (typing, Enter submits, Space clicks) still happen.
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [d.id, cancelValue]);

  const btn = (primary, danger) => ({
    padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: primary ? 700 : 500, cursor: "pointer",
    border: primary ? "none" : `1px solid ${t.bdr}`,
    background: primary ? (danger ? t.err : t.acc) : "transparent",
    color: primary ? (danger ? "#fff" : t.id === "light" || t.id === "paper" ? "#fff" : t.bg) : t.tx2,
  });
  const titleId = `${d.id}-title`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(d.id, cancelValue); }}>
      <form ref={boxRef} role={d.kind === "info" ? "dialog" : "alertdialog"} aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onSubmit={e => { e.preventDefault(); accept(); }}
        style={{ width: "min(440px, 100%)", maxHeight: "85vh", overflowY: "auto", background: t.surf, color: t.tx, border: `1px solid ${t.bdr}`, borderRadius: 12, padding: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", gap: 12, outline: "none" }}>
        <div id={titleId} style={{ fontSize: 16, fontWeight: 700 }}>{d.title || (d.kind === "confirm" ? "Are you sure?" : d.kind === "text" ? "Enter a value" : "Notice")}</div>
        {d.message && <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.55, whiteSpace: "pre-line" }}>{d.message}</div>}
        {d.items?.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: t.tx2, lineHeight: 1.55 }}>
            {d.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
        {d.kind === "text" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: t.tx2 }}>
            {d.label}
            <input ref={firstRef} value={value} onChange={e => setValue(e.target.value)} placeholder={d.placeholder || ""}
              style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 14 }} />
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          {d.kind !== "info" && (
            <button type="button" onClick={() => closeDialog(d.id, cancelValue)} style={btn(false)} ref={d.kind === "confirm" && d.danger ? firstRef : undefined}>
              {d.cancelLabel || "Cancel"}
            </button>
          )}
          <button type="submit" style={btn(true, d.danger)} disabled={d.kind === "text" && d.required !== false && !String(value).trim()}
            ref={d.kind === "info" || (d.kind === "confirm" && !d.danger) ? firstRef : undefined}>
            {d.confirmLabel || (d.kind === "info" ? "OK" : d.kind === "text" ? "Save" : "Continue")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DialogHost({ t }) {
  const dialogs = useDialogStore(s => s.dialogs);
  const toasts = useDialogStore(s => s.toasts);
  const top = dialogs[dialogs.length - 1];
  const toneColor = tone => (tone === "err" ? t.err : tone === "warn" ? t.warn : tone === "ok" ? t.ok : t.acc);
  return (
    <>
      {top && <DialogBox key={top.id} t={t} d={top} />}
      {toasts.length > 0 && (
        <div aria-live="polite" style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1001, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "min(560px, calc(100% - 32px))", pointerEvents: "none" }}>
          {toasts.map(x => (
            <div key={x.id} role={x.tone === "err" ? "alert" : "status"}
              style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: t.surf, color: t.tx, border: `1px solid ${t.bdr}`, borderLeft: `4px solid ${toneColor(x.tone)}`, boxShadow: `0 6px 20px ${t.shadow}`, fontSize: 13, maxWidth: "100%" }}>
              <span style={{ flex: 1, lineHeight: 1.4, whiteSpace: "pre-line" }}>{x.text}</span>
              {x.action && (
                <button onClick={() => { dismissToast(x.id); x.action.onClick(); }}
                  style={{ padding: "4px 10px", borderRadius: 5, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                  {x.action.label}
                </button>
              )}
              <button onClick={() => dismissToast(x.id)} aria-label="Dismiss" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
