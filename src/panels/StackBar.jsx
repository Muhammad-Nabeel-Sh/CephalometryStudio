// ═══════════════════════════════════════════════════════════════════════════════
// StackBar — moves through the frames of a multi-frame DICOM (model/stack.js)
//
// Sits over the top of the canvas: previous / next, a slider and "Frame n of N".
// The mouse wheel over the bar steps frames too. On the canvas: Shift + wheel,
// Page Up / Page Down, Home / End (App).
// ═══════════════════════════════════════════════════════════════════════════════

import { Icon } from "../ui/icons.jsx";

export function StackBar({ t, index, count, onShow, style }) {
  if (!(count > 1)) return null;
  const btn = (disabled) => ({
    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
    border: `1px solid ${t.bdr}`, background: "transparent", color: disabled ? t.tx3 : t.tx, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1, flexShrink: 0,
  });
  return (
    <div role="group" aria-label="Frames"
      onWheel={(e) => { const d = Math.sign(e.deltaY || e.deltaX); if (d) { e.preventDefault(); onShow(index + d); } }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 6,
        display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8,
        background: t.surf + "ee", border: `1px solid ${t.bdr}`, boxShadow: `0 4px 14px ${t.shadow}`,
        width: "min(420px, calc(100% - 32px))", ...style,
      }}>
      <span title="This session holds every frame of the file" style={{ display: "flex", color: t.tx2, flexShrink: 0 }}><Icon name="frames" size={18} /></span>
      <button type="button" aria-label="Previous frame" title="Previous frame (Page Up)" disabled={index <= 0} onClick={() => onShow(index - 1)} style={btn(index <= 0)}>
        <Icon name="chevronLeft" size={18} />
      </button>
      <input type="range" min={1} max={count} step={1} value={index + 1} aria-label="Frame"
        aria-valuetext={`Frame ${index + 1} of ${count}`}
        onChange={(e) => onShow(Number(e.target.value) - 1)}
        style={{ flex: 1, minWidth: 60, accentColor: t.acc }} />
      <button type="button" aria-label="Next frame" title="Next frame (Page Down)" disabled={index >= count - 1} onClick={() => onShow(index + 1)} style={btn(index >= count - 1)}>
        <Icon name="chevronRight" size={18} />
      </button>
      <span aria-live="polite" style={{ fontSize: 13, color: t.tx, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", minWidth: 64, textAlign: "right" }}
        title="Shift + mouse wheel, Page Up / Page Down or Home / End on the canvas">
        {index + 1} / {count}
      </span>
    </div>
  );
}
