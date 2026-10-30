import { useState, useEffect } from "react";
import { mkSession } from "../model/session.js";
import { addSession, removeSession } from "../model/project.js";
import { onEnter } from "../lib/utils.js";
import { askConfirm } from "../ui/dialogs.js";
import { getImageDataUrl } from "../storage/imageStore.js";

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
                <SessionThumb id={s.images?.[0]?.id} dataUrl={s.images?.[0]?.dataUrl} />
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
// A small (≤ 96 px) copy of the session's first image, shown via a `blob:` URL
// so the DOM never holds the multi-MB base64. Images restored from storage have
// no dataUrl in memory, so the thumbnail reads the stored image by id. An image
// id's pixels never change (a new window makes a new id), so thumbnails are
// cached by id for the visit.
const THUMB_PX = 96;
const thumbCache = new Map(); // image id → Promise<blob: URL | null>

function makeThumb(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, THUMB_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.8);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function thumbFor(id, dataUrl) {
  if (!id) return dataUrl ? makeThumb(dataUrl) : Promise.resolve(null);
  if (!thumbCache.has(id)) {
    const p = (dataUrl ? Promise.resolve(dataUrl) : getImageDataUrl(id)).then((src) => (src ? makeThumb(src) : null));
    // A miss (image not loaded yet) is retried next time rather than cached.
    p.then((url) => { if (!url) thumbCache.delete(id); });
    thumbCache.set(id, p);
  }
  return thumbCache.get(id);
}

export function SessionThumb({ id, dataUrl }) {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    let live = true;
    thumbFor(id, dataUrl).then((url) => { if (live) setThumb(url ? { id, url } : null); });
    return () => { live = false; };
  }, [id, dataUrl]);
  if (!thumb || thumb.id !== id) {
    return <span style={{ fontSize: 14, opacity: 0.25, lineHeight: 1 }}>⊞</span>;
  }
  return (
    <img src={thumb.url} alt="" draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );
}
