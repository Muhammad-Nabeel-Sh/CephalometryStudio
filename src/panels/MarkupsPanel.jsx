import { useState } from "react";
import { computeMeasurements, normDeviation, deviationColor, onEnter } from "../lib/utils.js";
import { Btn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { MarkupGearSettings } from "./MarkupGearSettings.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUPS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupsPanel({ markups, t, theme, selectedId, onSelect, onDelete, onToggleVisible, onToggleLock, onToggleLabel, onToggleGroupVisible, onReplace, replacingId, calibration, placingMode, placingQueue, placingIdx, onStopPlacing, onPausePlacing, onResumePlacing,   onClear, onAddPoint, norms, formatAngle, angleMode, setAngleMode, dispatch, showCpAlways, showAnchorAlways,
  onAutoTrace, autoTraceBusy, autoTraceInfo, onAutoTraceDismiss, autoTraceQuality, onAutoTraceRetry,
  showAnnotations, setShowAnnotations, annotationSize, setAnnotationSize,
  showDefTooltips, setShowDefTooltips, showDisplacement, setShowDisplacement,
  showGrid, setShowGrid, showAirwayOverlay, setShowAirwayOverlay,
  showGroupsLegend, setShowGroupsLegend,
  defaultLineStyle, setDefaultLineStyle, defaultMarkupColor, setDefaultMarkupColor,
  defaultLineWidth, setDefaultLineWidth, autoHideLabels, setAutoHideLabels,
  annotationBold, setAnnotationBold, snapTolerance, setSnapTolerance,
  onLockAll, onUnlockAll,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [guideKey, setGuideKey] = useState(null);
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const sections = [
    { id: "point", label: "Landmarks", types: ["point"], icon: "◉", color: t.acc },
    { id: "line", label: "Lines & Planes", types: ["line", "parallel", "ruler"], icon: "⟋", color: "#38bdf8" },
    { id: "angle", label: "Angles", types: ["angle3", "angle4"], icon: "∠", color: "#f472b6" },
    { id: "curve", label: "Open Curves", types: ["curve", "polyline", "bezier", "tangent"], icon: "∿", color: "#fb923c" },
    { id: "polygon", label: "Polygons", types: ["polygon"], icon: "⬡", color: "#4ade80" },
    { id: "ellipse", label: "Ellipses & Circles", types: ["ellipse", "circle", "arc", "concentric"], icon: "◯", color: "#60a5fa" },
    { id: "other", label: "Measurements", types: ["perp","ratio","sum","difference","percentage","projDist"], icon: "⊥", color: "#a78bfa" },
    { id: "annotation", label: "Annotations", types: ["arrow", "text"], icon: "📝", color: "#fbbf24" },
    { id: "silhouette", label: "Silhouettes", types: ["silhouette"], icon: "🧑", color: "#f59e0b" },
  ];

  const handleClear = () => {
    if (markups.length === 0) {
      setShowClearConfirm(false);
      return;
    }
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    onClear();
    setShowClearConfirm(false);
  };

  return (
    <div>
      {showClearConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 12, padding: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.tx, marginBottom: 8 }}>Clear All Markups?</div>
            <div style={{ fontSize: 12, color: t.tx2, marginBottom: 20 }}>This will remove all {markups.length} markups from the workspace. This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn t={t} small onClick={() => setShowClearConfirm(false)}>Cancel</Btn>
              <Btn t={t} small danger onClick={confirmClear}>Clear All</Btn>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: "8px 10px", display: "flex", gap: 4, borderBottom: `1px solid ${t.bdr}`, flexShrink: 0, flexWrap: "nowrap", overflowX: "auto" }}>
        <Btn t={t} small onClick={onAddPoint} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>+ Point</Btn>
        {onAutoTrace && (
          <Btn t={t} small onClick={autoTraceBusy ? undefined : () => onAutoTrace()} title="AI auto-trace landmarks"
            style={{ whiteSpace: "nowrap", flexShrink: 0, background: autoTraceBusy ? t.surf2 : t.accMuted, color: autoTraceBusy ? t.tx3 : t.acc, border: `1px solid ${t.acc}` }}>
            {autoTraceBusy ? "Tracing…" : "AI Trace"}
          </Btn>
        )}
        {!placingMode && placingQueue.length === 0 && <Btn t={t} small onClick={onResumePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>▶ Start</Btn>}
        {!placingMode && placingQueue.length > 0 && <Btn t={t} small onClick={onResumePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>▶ Resume</Btn>}
        {placingMode && <Btn t={t} small onClick={onPausePlacing} style={{ whiteSpace: "nowrap", flexShrink: 0, background: t.warn + "22", color: t.warn, border: `1px solid ${t.warn}` }}>⏸</Btn>}
        {(placingMode || placingQueue.length > 0) && <Btn t={t} small danger onClick={onStopPlacing} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>⏹ End</Btn>}
        <Btn t={t} small danger onClick={handleClear} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Clear</Btn>
        <MarkupGearSettings
          t={t} theme={theme} dispatch={dispatch} markups={markups}
          angleMode={angleMode} setAngleMode={setAngleMode}
          showCpAlways={showCpAlways} showAnchorAlways={showAnchorAlways}
          showAnnotations={showAnnotations} setShowAnnotations={setShowAnnotations}
          annotationSize={annotationSize} setAnnotationSize={setAnnotationSize}
          showDefTooltips={showDefTooltips} setShowDefTooltips={setShowDefTooltips}
          showDisplacement={showDisplacement} setShowDisplacement={setShowDisplacement}
          showGrid={showGrid} setShowGrid={setShowGrid}
          showAirwayOverlay={showAirwayOverlay} setShowAirwayOverlay={setShowAirwayOverlay}
          showGroupsLegend={showGroupsLegend} setShowGroupsLegend={setShowGroupsLegend}
          defaultLineStyle={defaultLineStyle} setDefaultLineStyle={setDefaultLineStyle}
          defaultMarkupColor={defaultMarkupColor} setDefaultMarkupColor={setDefaultMarkupColor}
          defaultLineWidth={defaultLineWidth} setDefaultLineWidth={setDefaultLineWidth}
          autoHideLabels={autoHideLabels} setAutoHideLabels={setAutoHideLabels}
          annotationBold={annotationBold} setAnnotationBold={setAnnotationBold}
          snapTolerance={snapTolerance} setSnapTolerance={setSnapTolerance}
          onLockAll={onLockAll} onUnlockAll={onUnlockAll}
        />
        <button onClick={() => setGuideKey("markups")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, flexShrink: 0 }} title="Guide">?</button>
      </div>
      {autoTraceInfo && (
        <div style={{ padding: "6px 10px", background: autoTraceInfo.tone === "err" ? t.err + "18" : autoTraceInfo.tone === "warn" ? t.warn + "18" : t.accMuted, borderBottom: `1px solid ${t.bdr}`, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontSize: 11, color: t.tx2 }}>{autoTraceInfo.message}</span>
          {onAutoTraceDismiss && <button onClick={onAutoTraceDismiss} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 13, flexShrink: 0 }}>×</button>}
        </div>
      )}
      {autoTraceQuality && autoTraceQuality.level !== "high" && (
        <div style={{ padding: "8px 10px", background: autoTraceQuality.level === "low" ? t.err + "14" : t.warn + "14", borderBottom: `1px solid ${t.bdr}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: autoTraceQuality.level === "low" ? t.err : t.warn, fontWeight: 700 }}>
            {autoTraceQuality.level === "low" ? "Low-confidence trace" : "Check these landmarks"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>
            {autoTraceQuality.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <div style={{ fontSize: 10, color: t.tx3 }}>
            Measurements and norms derived from these points may be wrong — verify before use.
          </div>
          {onAutoTraceRetry && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <Btn t={t} small disabled={autoTraceBusy} onClick={() => onAutoTraceRetry({ mirror: true, invert: false })}>Re-trace mirrored</Btn>
              <Btn t={t} small disabled={autoTraceBusy} onClick={() => onAutoTraceRetry({ mirror: false, invert: true })}>Re-trace inverted</Btn>
              <Btn t={t} small disabled={autoTraceBusy} onClick={() => onAutoTraceRetry({ mirror: false, invert: false })}>Re-trace as-is</Btn>
            </div>
          )}
        </div>
      )}
      {sections.map(sec => {
        const items = markups.filter(m => sec.types.includes(m.type));
        if (items.length === 0) return null;
        const isCollapsed = collapsed[sec.id];
        const allVisible = items.every(m => m.visible !== false);
        return (
          <div key={sec.id}>
            <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, background: t.surf2, borderBottom: `1px solid ${t.bdr}`, borderTop: `1px solid ${t.bdr}`, userSelect: "none" }}>
              <div role="button" tabIndex={0} onClick={() => toggle(sec.id)} onKeyDown={onEnter(() => toggle(sec.id))} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, minWidth: 0 }}>
                <span style={{ color: sec.color, fontSize: 12 }}>{sec.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>{sec.label}</span>
                <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{items.length}</span>
                <span style={{ color: t.tx3, fontSize: 10, transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onToggleGroupVisible && onToggleGroupVisible(sec.types); }} title={allVisible ? `Hide all ${sec.label}` : `Show all ${sec.label}`} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: allVisible ? sec.color : "transparent", border: `2px solid ${sec.color}`, opacity: allVisible ? 1 : 0.3, transition: "all 0.15s" }} />
              </button>
            </div>
            {!isCollapsed && items.map(m => {
              const meas = computeMeasurements(m, calibration);
              const filteredMeas = Object.entries(meas).filter(([k]) => !k.startsWith("_") && (m.type === "point" || (k !== "x" && k !== "y"))); const u = meas._unit === "mm" ? "mm" : "px"; const ms = filteredMeas.map(([k, v]) => k === "angle" ? formatAngle(v) : v.toFixed(1) + (k === "area" ? ` ${u}²` : ` ${u}`)).join("  ");
              const isHidden = m.visible === false, isPlacing = placingMode && placingQueue[placingIdx] === m.id, isLocked = m.locked;
              const unplaced = m.type === "point" && !m.placed;
              const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
              return (
                <div key={m.id} style={{ borderBottom: `1px solid ${t.bdr + "66"}`, background: isPlacing ? t.acc + "11" : selectedId === m.id ? t.accMuted : "transparent" }}>
                  <div style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => onToggleVisible(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={isHidden ? "Show" : "Hide"}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: isHidden ? "transparent" : m.color || m.strokeColor || t.acc, border: `2px solid ${m.color || m.strokeColor || t.acc}`, opacity: isHidden ? 0.35 : 1, transition: "all 0.15s" }} />
                    </button>
                    <button onClick={() => onToggleLock(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={isLocked ? "Unlock" : "Lock"}>
                      <span style={{ fontSize: 11, color: isLocked ? t.warn : t.tx3 }}>{isLocked ? "🔒" : "🔓"}</span>
                    </button>
                    <button onClick={() => onToggleLabel(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title={m.noLabel ? "Show label" : "Hide label"}>
                      <span style={{ fontSize: 12, color: m.noLabel ? t.tx3 : t.acc }}>{m.noLabel ? "Aa" : "Aa"}</span>
                    </button>
                    {m.type !== "text" && <button onClick={() => onReplace && onReplace(m.type, m.id)} style={{ background: replacingId === m.id ? t.accMuted : "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} title="Replace mode">
                      <span style={{ fontSize: 16, color: replacingId === m.id ? t.acc : t.tx2 }}>⚙</span>
                    </button>}
                    <div role="button" tabIndex={0} onClick={() => onSelect(m.id === selectedId ? null : m.id)} onKeyDown={onEnter(() => onSelect(m.id === selectedId ? null : m.id))} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isHidden ? t.tx3 : t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isPlacing && <span style={{ color: t.warn, marginRight: 4 }}>📍</span>}
                        {unplaced && !isPlacing && <span style={{ color: t.tx3, marginRight: 4 }}>○</span>}
                        {m.label || m.type}
                        {(m.type === "curve" || m.type === "polyline") && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "polygon" && m.curveStyle === "bspline" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>[spline]</span>}
                        {m.type === "text" && m.text && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>"{m.text.slice(0, 15)}{m.text.length > 15 ? "…" : ""}"</span>}
                        {m.type === "arrow" && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>→</span>}
                        {isLocked && <span style={{ fontSize: 9, color: t.warn, marginLeft: 4 }}>[locked]</span>}
                      </div>
                      {ms && !isHidden && <div style={{ fontSize: 12, color: t.acc, fontFamily: "'DM Mono',monospace" }}>{ms}</div>}
                      {relNorms.length > 0 && !isHidden && ms && <NormBadges norms={relNorms} meas={meas} calibration={calibration} t={t} />}
                    </div>
                    <button onClick={() => onDelete(m.id)} title="Delete markup" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {markups.length === 0 && <div style={{ padding: 24, textAlign: "center", color: t.tx3, fontSize: 12 }}>No markups yet.<br />Select a tool and click on the image.</div>}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

function NormBadges({ norms, meas, t, calibration }) {
  const calDone = calibration?.done === true;
  const calTypes = ["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
      {norms.map(n => {
        const val = meas[n.measureType];
        if (val === undefined) return null;
        if (!calDone && calTypes.includes(n.measureType)) return null;
        const dev = normDeviation(val, n);
        const col = deviationColor(dev.sdUnits, t);
        return (<span key={n.id} style={{ background: col + "22", color: col, border: `1px solid ${col}44`, borderRadius: 3, padding: "0px 4px", fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
          {dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)}SD
        </span>);
      })}
    </div>
  );
}
