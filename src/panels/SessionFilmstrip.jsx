import { useState, useEffect } from "react";
import { mkSession } from "../model/session.js";
import { addSession, removeSession } from "../model/project.js";
import { onEnter } from "../lib/utils.js";
import { askConfirm } from "../ui/dialogs.js";

export default function SessionFilmstrip({ project, t, onUpdateProject, compact }) {
  const sessions = project?.sessions || [];
  const activeId = project?.activeSessionId;
  const [hoveredId, setHoveredId] = useState(null);

  const handleSetActive = (id) => {
    if (id !== activeId) onUpdateProject({ ...project, activeSessionId: id });
  };

  const handleAdd = () => {
    const session = mkSession({ name: `Session ${sessions.length + 1}` });
    onUpdateProject(addSession(project, session));
  };

  const handleRemove = async (id) => {
    if (sessions.length <= 1) return;
    const name = sessions.find(s => s.id === id)?.name;
    if (!(await askConfirm({ title: `Delete session${name ? ` “${name}”` : ""}?`, message: "Its image, tracing and measurements are removed from this case.", confirmLabel: "Delete session", danger: true }))) return;
    onUpdateProject(removeSession(project, id));
  };

  return (
    <div className="mobile-chrome" style={{
      display: "flex", alignItems: "stretch", gap: 0, flexShrink: 0,
      background: t.surf, borderBottom: `1px solid ${t.bdr}`,
      overflow: "hidden", height: compact ? 44 : 62,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: compact ? 2 : 4,
        padding: compact ? "2px 6px" : "6px 10px",
        overflowX: "auto", overflowY: "hidden", flex: 1,
        maxWidth: compact ? "none" : 5 * (52 + 4) + 30 + 20,
        scrollbarWidth: "thin",
        scrollbarColor: `${t.bdr} transparent`,
      }}>
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          const thumbSize = compact ? { w: 28, h: 22 } : { w: 40, h: 30 };
          const cw = compact ? 46 : 52;
          return (
            <div
              key={s.id}
              tabIndex={0}
              role="option"
              aria-selected={isActive}
              aria-label={s.label || s.name || "Session"}
              onClick={() => handleSetActive(s.id)}
              onKeyDown={onEnter(() => handleSetActive(s.id))}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(s.id)}
              onBlur={() => setHoveredId(null)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: compact ? 1 : 2, flexShrink: 0,
                width: cw, height: compact ? 38 : 50, borderRadius: 6, cursor: "pointer",
                background: isActive ? t.accMuted : "transparent",
                border: `2px solid ${isActive ? t.acc : "transparent"}`,
                transition: "all 0.15s", position: "relative",
                padding: compact ? "1px 0" : "2px 0",
              }}
            >
              <div style={{
                width: thumbSize.w, height: thumbSize.h, borderRadius: 3, overflow: "hidden",
                background: t.surf3, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                <SessionThumb dataUrl={s.images?.[0]?.dataUrl} />
              </div>
              {!compact && <div style={{
                fontSize: 8, color: isActive ? t.acc : t.tx2, textAlign: "center",
                maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", fontWeight: isActive ? 700 : 400, lineHeight: 1.2,
              }}>
                {s.label || s.name || "Session"}
              </div>}
              {hoveredId === s.id && sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                  title="Delete session"
                  style={{
                    position: "absolute", top: -3, right: -3,
                    width: compact ? 12 : 14, height: compact ? 12 : 14, borderRadius: "50%",
                    border: "none", background: t.err, color: "#fff",
                    fontSize: compact ? 7 : 8, lineHeight: "12px", textAlign: "center",
                    cursor: "pointer", padding: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              )}
            </div>
          );
        })}
        <button
          onClick={handleAdd}
          title="Add session"
          aria-label="Add session"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: 6, flexShrink: 0,
            border: `1px dashed ${t.bdr}`, background: "transparent",
            color: t.tx3, cursor: "pointer", fontSize: compact ? 13 : 16, lineHeight: 1,
            transition: "all 0.15s", marginLeft: compact ? 1 : 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.acc; e.currentTarget.style.color = t.acc; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bdr; e.currentTarget.style.color = t.tx3; }}
        >+</button>
      </div>
    </div>
  );
}

// ─── Session thumbnail (D7) ──────────────────────────────────────────────────
// The filmstrip renders one thumb per session. Previously each `<img src>` held
// the full base64 dataUrl in the DOM attribute — for a multi-session case that's
// N copies of a multi-MB string living in the DOM. Here the dataUrl is decoded
// to a Blob once and displayed via a short `blob:` object URL that is revoked on
// change/unmount, so the DOM only ever holds the small reference. The base64
// still lives in React state (needed for save/export) but is no longer mirrored
// into every thumbnail's DOM attribute.
function SessionThumb({ dataUrl }) {
  const [objectUrl, setObjectUrl] = useState(null);
  useEffect(() => {
    if (!dataUrl) { setObjectUrl(null); return; }  // eslint-disable-line react-hooks/set-state-in-effect
    let url = null;
    try {
      const [meta, b64] = dataUrl.split(",");
      const mime = (meta && meta.match(/:(.*?);/) && meta.match(/:(.*?);/)[1]) || "image/png";
      const bin = atob(b64 || "");
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      url = URL.createObjectURL(new Blob([arr], { type: mime }));
    } catch { url = null; }
    setObjectUrl(url);
    // Revoke the object URL when the dataUrl changes or the component unmounts
    // (Strict-Mode-safe: each effect run owns its own URL and cleans it up).
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [dataUrl]);
  if (!objectUrl) {
    return <span style={{ fontSize: 14, opacity: 0.25, lineHeight: 1 }}>⊞</span>;
  }
  return (
    <img src={objectUrl} alt="" draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );
}
