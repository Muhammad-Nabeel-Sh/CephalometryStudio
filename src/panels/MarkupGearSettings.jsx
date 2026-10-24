import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP GEAR SETTINGS — dropdown with Display, Defaults, Snap, Bezier, Bulk
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({ t, label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: t.tx3, letterSpacing: 0.5, marginTop: 8, marginBottom: 5, textTransform: "uppercase" }}>{label}</div>
  );
}

function ToggleRow({ t, label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 4, fontSize: 11, color: t.tx }}>
      <div
        role="checkbox" aria-checked={checked} tabIndex={0}
        onClick={onChange}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(); } }}
        style={{ width: 28, height: 16, borderRadius: 8, background: checked ? t.acc : t.surf3, border: `1px solid ${checked ? t.acc : t.bdr}`, position: "relative", transition: "background 0.15s", flexShrink: 0, cursor: "pointer" }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 1, left: checked ? 13 : 1, transition: "left 0.15s" }} />
      </div>
      <span>{label}</span>
    </label>
  );
}

function SliderRow({ t, label, value, min, max, step, onChange, displayValue }) {
  return (
    <div style={{ marginBottom: 4, fontSize: 11, color: t.tx }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontSize: 10, color: t.tx2, fontFamily: "'DM Mono',monospace" }}>{displayValue ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: t.acc, height: 3 }} />
    </div>
  );
}

const PRESET_COLORS = [
  { label: "Auto", value: null },
  { label: "Blue", value: "#38bdf8" },
  { label: "Pink", value: "#f472b6" },
  { label: "Green", value: "#4ade80" },
  { label: "Orange", value: "#fb923c" },
  { label: "Purple", value: "#c084fc" },
  { label: "Yellow", value: "#fbbf24" },
  { label: "White", value: "#ffffff" },
];

export function MarkupGearSettings({
  t, theme, dispatch, markups,
  angleMode, setAngleMode, facingSetting = "auto", setFacingSetting, resolvedFacing = "right", showCpAlways, showAnchorAlways,
  showAnnotations, setShowAnnotations, annotationSize, setAnnotationSize,
  showDefTooltips, setShowDefTooltips, showDisplacement, setShowDisplacement,
  showGrid, setShowGrid, showAirwayOverlay, setShowAirwayOverlay,
  showGroupsLegend, setShowGroupsLegend,
  defaultLineStyle, setDefaultLineStyle, defaultMarkupColor, setDefaultMarkupColor,
  defaultLineWidth, setDefaultLineWidth, autoHideLabels, setAutoHideLabels,
  annotationBold, setAnnotationBold, snapTolerance, setSnapTolerance,
  onLockAll, onUnlockAll,
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, [open]);

  const [sign, unit] = angleMode?.split("-") || ["signed", "deg"];
  const hasMarkups = markups.length > 0;
  const allLocked = hasMarkups && markups.every(m => m.locked);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} title="Settings" style={{ padding: "2px 6px", fontSize: 11, border: `1px solid ${open ? t.acc : t.tx3 + "55"}`, borderRadius: 4, background: open ? t.accMuted : "none", color: open ? t.acc : t.tx3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", lineHeight: "14px", whiteSpace: "nowrap" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      {open && rect && (
        <div style={{ position: "fixed", top: rect.bottom + 4, left: Math.max(8, rect.left - 210), background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: "10px 12px", minWidth: 210, maxHeight: "calc(100vh - 40px)", overflowY: "auto", zIndex: 9999, boxShadow: `0 4px 20px ${t.shadow}` }}>

          {/* ── DISPLAY ── */}
          <SectionHeader t={t} label="Display" />
          <ToggleRow t={t} label="Annotations" checked={showAnnotations} onChange={() => setShowAnnotations(v => !v)} />
          <ToggleRow t={t} label="Def. tooltips" checked={showDefTooltips} onChange={() => setShowDefTooltips(v => !v)} />
          <ToggleRow t={t} label="Auto-hide labels" checked={autoHideLabels} onChange={() => setAutoHideLabels(v => !v)} />
          <ToggleRow t={t} label="Bold labels" checked={annotationBold} onChange={() => setAnnotationBold(v => !v)} />
          <SliderRow t={t} label="Annotation size" value={annotationSize} min={0.5} max={3} step={0.1} onChange={setAnnotationSize} displayValue={`${(annotationSize * 100).toFixed(0)}%`} />
          <ToggleRow t={t} label="Displacement" checked={showDisplacement} onChange={() => setShowDisplacement(v => !v)} />
          <ToggleRow t={t} label="Grid overlay" checked={showGrid} onChange={() => setShowGrid(v => !v)} />
          <ToggleRow t={t} label="Airway overlay" checked={showAirwayOverlay} onChange={() => setShowAirwayOverlay(v => !v)} />
          <ToggleRow t={t} label="Groups legend" checked={showGroupsLegend} onChange={() => setShowGroupsLegend(v => !v)} />

          {/* ── DEFAULTS ── */}
          <SectionHeader t={t} label="Defaults" />
          <SliderRow t={t} label="Line width" value={defaultLineWidth} min={0.5} max={4} step={0.25} onChange={setDefaultLineWidth} displayValue={`${defaultLineWidth}px`} />
          <div style={{ marginBottom: 4, fontSize: 11, color: t.tx }}>
            <div style={{ marginBottom: 3 }}>Line style</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["solid", "dashed", "dotted"].map(s => (
                <button key={s} onClick={() => setDefaultLineStyle(s)}
                  style={{ flex: 1, padding: "3px 0", fontSize: 10, fontWeight: 600, borderRadius: 4, border: `1px solid ${defaultLineStyle === s ? t.acc : t.bdr}`, background: defaultLineStyle === s ? t.acc + "22" : "transparent", color: defaultLineStyle === s ? t.acc : t.tx3, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 4, fontSize: 11, color: t.tx }}>
            <div style={{ marginBottom: 3 }}>Markup color</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {PRESET_COLORS.map(c => (
                <button key={c.label} onClick={() => setDefaultMarkupColor(c.value)} title={c.label}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${defaultMarkupColor === c.value ? t.tx : t.bdr}`, background: c.value || "transparent", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {!c.value && <span style={{ fontSize: 9, color: t.tx3, fontWeight: 700 }}>∅</span>}
                  {defaultMarkupColor === c.value && c.value && <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${t.acc}` }} />}
                </button>
              ))}
            </div>
          </div>

          {/* ── SNAP ── */}
          <SectionHeader t={t} label="Snap" />
          <SliderRow t={t} label="Snap radius" value={snapTolerance} min={4} max={30} step={1} onChange={setSnapTolerance} displayValue={`${snapTolerance}px`} />

          {/* ── ANGLE ── */}
          <SectionHeader t={t} label="Angle" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <button onClick={() => setAngleMode(`${sign}-${unit === "deg" ? "rad" : "deg"}`)}
              style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, border: `1px solid ${t.bdr}`, borderRadius: 4, background: unit === "deg" ? t.acc : "transparent", color: unit === "deg" ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontFamily: "inherit" }}>
              {unit === "deg" ? "°" : "rad"}
            </button>
            <select value={sign} onChange={e => setAngleMode(`${e.target.value}-${unit}`)}
              style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "2px 4px", color: t.tx, fontSize: 10, fontFamily: "inherit", cursor: "pointer", flex: 1 }}>
              <option value="signed">signed</option>
              <option value="abs">abs</option>
              <option value="simple">simple</option>
              <option value="reflex">reflex</option>
            </select>
          </div>
          {setFacingSetting && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 11, color: t.tx }}
              title="Direction the patient's profile faces. Signed measures (ANB, Wits, E-line, convexity, incisor-to-line distances) are computed with anterior = positive.">
              <span style={{ flexShrink: 0 }}>Profile faces</span>
              <select value={facingSetting} onChange={e => setFacingSetting(e.target.value)}
                style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "2px 4px", color: t.tx, fontSize: 11, fontFamily: "inherit", cursor: "pointer", flex: 1 }}>
                <option value="auto">Auto ({resolvedFacing})</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
          )}

          {/* ── BEZIER ── */}
          <SectionHeader t={t} label="Bezier" />
          <div style={{ display: "flex", gap: 6 }}>
            <ToggleChip t={t} active={showCpAlways} label="Ctrl pts" onClick={() => dispatch({ type: "SET", payload: { showCpAlways: !showCpAlways } })} />
            <ToggleChip t={t} active={showAnchorAlways} label="Anchor pts" onClick={() => dispatch({ type: "SET", payload: { showAnchorAlways: !showAnchorAlways } })} />
          </div>

          {/* ── BULK ACTIONS ── */}
          <SectionHeader t={t} label="Bulk" />
          <div style={{ display: "flex", gap: 6 }}>
            <button disabled={!hasMarkups} onClick={onLockAll}
              style={{ flex: 1, padding: "4px 0", fontSize: 10, fontWeight: 600, borderRadius: 4, border: `1px solid ${t.bdr}`, background: allLocked ? t.warn + "22" : "transparent", color: allLocked ? t.warn : t.tx3, cursor: hasMarkups ? "pointer" : "default", fontFamily: "inherit", opacity: hasMarkups ? 1 : 0.4 }}>
              🔒 Lock all
            </button>
            <button disabled={!hasMarkups} onClick={onUnlockAll}
              style={{ flex: 1, padding: "4px 0", fontSize: 10, fontWeight: 600, borderRadius: 4, border: `1px solid ${t.bdr}`, background: !allLocked && hasMarkups ? t.ok + "22" : "transparent", color: !allLocked && hasMarkups ? t.ok : t.tx3, cursor: hasMarkups ? "pointer" : "default", fontFamily: "inherit", opacity: hasMarkups ? 1 : 0.4 }}>
              🔓 Unlock all
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

function ToggleChip({ t, active, label, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, borderRadius: 4, border: `1px solid ${active ? t.acc : t.bdr}`, background: active ? t.acc + "22" : "transparent", color: active ? t.acc : t.tx3, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s" }}>
      {label}
    </button>
  );
}
