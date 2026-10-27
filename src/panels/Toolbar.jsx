import { useState } from "react";
import { clamp } from "../lib/utils.js";
import ToolBtn from "../ui/ToolBtn.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { useStoreDispatch, useSessionStore } from "../state/workspaceStore.js";
import { useToolStore, useUIStore } from "../state/workspaceStore.js";
import { TOOL_MODES, NAV_TOOLS, TOOL_INFO, toolKey, toolTitle, modeOfTool } from "../data/toolModes.js";
import { UndoHistoryButton } from "./UndoHistory.jsx";
import { Icon } from "../ui/icons.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// Tool icons (shared by the desktop rail and the mobile sheet)
// ═══════════════════════════════════════════════════════════════════════════════
const svg = (children, { size = 24, stroke = 1.5, viewBox = "0 0 24 24" } = {}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

function toolIcons(t) {
  return {
    select: svg(<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>),
    pan: svg(<><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></>),
    point: "◉",
    midpoint: svg(<><path d="M2 12h5" /><path d="M17 12h5" /><path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M8.5 8.5l7 7" /><path d="M15.5 8.5l-7 7" /></>),
    line: svg(<><path d="M4 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M16 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7.5 16.5l9 -9" /></>),
    parallel: svg(<><path d="M21 17l-18 0" /><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M21 7l-18 0" /></>),
    perppoint: svg(<path d="M7 4v16h10" />),
    perp: svg(<><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M10 14l2 -2m2.007 -2.007l6 -6" /><path d="M15 4h5v5" /><path d="M3 3l18 18" /></>),
    angle3: svg(<><path d="M21 19h-18l9 -15" /><path d="M20.615 15.171h.015" /><path d="M19.515 11.771h.015" /><path d="M17.715 8.671h.015" /><path d="M15.415 5.971h.015" /></>),
    angle4: svg(<><path d="M16 4h4v4" /><path d="M15 9l5 -5" /><path d="M4 20l5 -5" /><path d="M16 20h4v-4" /><path d="M4 4l16 16" /></>),
    polyline: svg(<><path d="m10.586 5.414-5.172 5.172"/><path d="m18.586 13.414-5.172 5.172"/><path d="M6 12h12"/><circle cx="12" cy="20" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="4" cy="12" r="2"/></>, { stroke: 2 }),
    polygon: svg(<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>, { stroke: 2 }),
    curve: svg(<><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></>, { stroke: 2 }),
    bezier: svg(<><path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" /><path d="M7 5l7 0" /><path d="M10 19l7 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M7 5.5a5 6.5 0 0 1 5 6.5a5 6.5 0 0 0 5 6.5" /></>),
    arrow: svg(<><path d="M13 5H19V11"/><path d="M19 5L5 19"/></>, { stroke: 2 }),
    text: svg(<path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/>),
    circle: svg(<><path d="M20.34 17.52a10 10 0 1 0-2.82 2.82"/><circle cx="19" cy="19" r="2"/><path d="m13.41 13.41 4.18 4.18"/><circle cx="12" cy="12" r="2"/></>, { stroke: 2 }),
    ellipse: svg(<ellipse cx="12" cy="12" rx="10" ry="6"/>, { stroke: 2 }),
    tangent: svg(<><circle cx="17" cy="4" r="2"/><path d="M15.59 5.41 5.41 15.59"/><circle cx="4" cy="17" r="2"/><path d="M12 22s-4-9-1.5-11.5S22 12 22 12"/></>, { stroke: 2 }),
    arc: svg(<><path d="m12.99 6.74 1.93 3.44"/><path d="M19.136 12a10 10 0 0 1-14.271 0"/><path d="m21 21-2.16-3.84"/><path d="m3 21 8.02-14.26"/><circle cx="12" cy="5" r="2"/></>, { stroke: 2 }),
    concentric: svg(<><path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/></>, { stroke: 2 }),
    mirror: svg(<><path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></>, { stroke: 2 }),
    ruler: <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-240q-33 0-56.5-23.5T80-320v-320q0-33 23.5-56.5T160-720h640q33 0 56.5 23.5T880-640v320q0 33-23.5 56.5T800-240H160Zm0-80h640v-320H680v160h-80v-160h-80v160h-80v-160h-80v160h-80v-160H160v320Zm120-160h80-80Zm160 0h80-80Zm160 0h80-80Zm-120 0Z" /></svg>,
  };
}

const toolOf = (icons, id) => ({ id, icon: icons[id], label: TOOL_INFO[id]?.label || id });

// The compact grid of the "All" mode keeps the previous two-column layout.
const ALL_GRID = [
  ["point", "midpoint"], ["line", "parallel"], ["perppoint", "perp"], ["angle3", "angle4"],
  ["polyline", "polygon"], ["curve", "bezier"], ["arrow", "text"], ["circle", "ellipse"],
  ["tangent", "arc"], ["concentric", "mirror"], ["ruler"],
];

const MODE_KEY = "cephalo_toolMode";
const loadMode = () => {
  try { const m = localStorage.getItem(MODE_KEY); if (TOOL_MODES.some(x => x.id === m)) return m; } catch { /* storage blocked */ }
  return "all";
};

// A full-width tool button with its name and shortcut (desktop rail, B1).
function LabeledToolBtn({ id, icon, active, onClick, theme, t }) {
  const [hov, setHov] = useState(false);
  const fg = active ? (theme === "light" ? "#fff" : t.bg) : hov ? t.acc : t.tx;
  return (
    <button title={toolTitle(id)} aria-label={toolTitle(id)} aria-pressed={active} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "100%", height: 36, borderRadius: 7, border: "none", padding: "0 6px", display: "flex", alignItems: "center", gap: 8,
        background: active ? t.acc : hov ? t.accMuted : "transparent", color: fg, cursor: "pointer", transition: "background 0.15s",
        boxShadow: active ? `0 0 0 2px ${t.acc}` : "none" }}>
      <span aria-hidden="true" style={{ position: "relative", width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
        <span style={{ display: "flex", transform: "scale(0.85)" }}>{icon}</span>
        {toolKey(id) && <span data-small style={{ position: "absolute", right: -5, bottom: -4, fontSize: 9, lineHeight: 1, opacity: 0.75, fontFamily: "'DM Mono',monospace" }}>{toolKey(id)}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{TOOL_INFO[id]?.label}</span>
    </button>
  );
}

export default function Toolbar({
  theme, t,
  sessionImage, calibration, updSession,
  panRef, zoomRef,
  undo, redo, undoSteps,
  handleDblClick,
}) {
  const dispatch = useStoreDispatch();
  const activeTool = useToolStore(s => s.activeTool);
  const zoom = useToolStore(s => s.zoom);
  const currentDraw = useToolStore(s => s.currentDraw);
  const spotlightMode = useToolStore(s => s.spotlightMode);
  const mobileToolsExpanded = useUIStore(s => s.mobileToolsExpanded);
  const mobileTab = useUIStore(s => s.mobileTab);
  const favoriteTools = useUIStore(s => s.favoriteTools);
  const isMobile = useMediaQuery("(max-width: 1024px)"); // compact toolbar: phones + tablets
  const undoStackSize = useSessionStore(s => s.undoStack.length);
  const redoStackSize = useSessionStore(s => s.redoStack.length);
  const canUndo = undoStackSize > 0;
  const canRedo = redoStackSize > 0;
  const icons = toolIcons(t);

  // B1: task mode. A shortcut for a tool in another mode switches to that mode.
  const [mode, setModeState] = useState(loadMode);
  const [seenTool, setSeenTool] = useState(activeTool);
  if (seenTool !== activeTool) {
    setSeenTool(activeTool);
    const m = modeOfTool(activeTool);
    if (mode !== "all" && m && m !== mode) setModeState(m);
  }
  const setMode = m => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked */ } };

  const pick = (id) => {
    dispatch({ type: "SET", payload: { activeTool: id } });
    dispatch({ type: "SET", payload: { currentDraw: null } });
  };

  if (isMobile && mobileTab === "canvas") {
    const selTool = (id) => {
      pick(id);
      dispatch({ type: "SET", payload: { mobileToolsExpanded: false } });
    };
    const toggleFav = (id) => {
      const cur = useUIStore.getState().favoriteTools;
      const next = cur.includes(id) ? cur.filter(t => t !== id) : [...cur, id];
      useUIStore.setState({ favoriteTools: next });
      try { localStorage.setItem("cephalo_favTools", JSON.stringify(next)); } catch { /* localStorage unavailable */ }
    };
    const CATEGORIES = [
      { name: "Select & Navigate", tools: ["select","pan"] },
      { name: "Points", tools: ["point","midpoint"] },
      { name: "Lines", tools: ["line","parallel","perp","perppoint"] },
      { name: "Angles", tools: ["angle3","angle4"] },
      { name: "Shapes", tools: ["polygon","circle","ellipse","arc","bezier","curve","polyline"] },
      { name: "Annotations", tools: ["text","arrow","ruler"] },
      { name: "Other", tools: ["mirror","tangent","concentric"] },
    ];
    const favSet = new Set(favoriteTools);
    return (<>
      {/* Collapsed bar — favorites + controls */}
      <div className="mobile-chrome" style={{ position: "absolute", bottom: 56, left: 8, right: 8, height: 40, display: "flex", alignItems: "center", borderRadius: 10, zIndex: 15, background: t.surf + "ee", backdropFilter: "blur(6px)", boxShadow: `0 2px 12px ${t.shadow}44`, border: `1px solid ${t.bdr}33`, padding: "0 4px", gap: 1, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {favoriteTools.map(id => icons[id] && (
          <ToolBtn key={id} tool={toolOf(icons, id)} active={activeTool === id} onClick={() => selTool(id)} theme={theme} t={t} style={{ flexShrink: 0 }} />
        ))}
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={undo} disabled={!canUndo} aria-label="Undo" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: canUndo ? t.tx2 : t.bdr, cursor: canUndo ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Undo">↶</button>
        <button onClick={redo} disabled={!canRedo} aria-label="Redo" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: canRedo ? t.tx2 : t.bdr, cursor: canRedo ? "pointer" : "not-allowed", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Redo">↷</button>
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={() => { const nz=clamp(zoomRef.current*1.3,0.05,15);zoomRef.current=nz;dispatch({ type: "SET", payload: { zoom: nz } }); }} aria-label="Zoom In" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>＋</button>
        <button onClick={() => { const nz=clamp(zoomRef.current/1.3,0.05,15);zoomRef.current=nz;dispatch({ type: "SET", payload: { zoom: nz } }); }} aria-label="Zoom Out" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>－</button>
        <button onClick={() => { zoomRef.current=1;dispatch({ type: "SET", payload: { zoom: 1 } }); panRef.current = { x: 40, y: 40 }; dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } }); }} aria-label="Fit" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⊙</button>
        <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
        <button onClick={() => dispatch({ type: "SET", payload: { mobileToolsExpanded: v => !v } })} aria-label="More tools" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: mobileToolsExpanded ? t.acc : t.surf2, color: mobileToolsExpanded ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: mobileToolsExpanded ? `0 0 0 2px ${t.acc}` : "none" }} title="More tools">⋯</button>
        {currentDraw && ["polygon", "curve", "polyline"].includes(activeTool) && (<>
          <div style={{ width: 1, height: 28, background: t.bdr, flexShrink: 0 }} />
          <button onClick={handleDblClick} aria-label="Finish shape" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: t.ok, color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Finish">✓</button>
        </>)}
      </div>
      {/* Expanded bottom sheet — categorized with favorites */}
      {mobileToolsExpanded && (<>
        <div onClick={() => dispatch({ type: "SET", payload: { mobileToolsExpanded: false } })} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 19 }} />
        <div className="mobile-chrome" style={{ position: "fixed", bottom: 100, left: 8, right: 8, maxHeight: "55vh", background: t.surf, border: `1px solid ${t.bdr}33`, borderRadius: 12, zIndex: 20, overflowY: "auto", overscrollBehavior: "contain", padding: "12px 8px 8px", boxShadow: `0 -4px 20px ${t.shadow}44` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 8px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.tx2, fontFamily: "'DM Sans',sans-serif" }}>All Tools</span>
            <span style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{(zoom * 100).toFixed(0)}%{calibration.done ? ` · ⟺${calibration.pxPerMm.toFixed(1)}` : ""}</span>
          </div>
          {CATEGORIES.map(cat => (
            <div key={cat.name} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: "0.5px", padding: "2px 8px", marginBottom: 1 }}>{cat.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {cat.tools.map(id => icons[id] && (
                  <div key={id} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <ToolBtn tool={toolOf(icons, id)} active={activeTool === id} onClick={() => selTool(id)} theme={theme} t={t} style={{ flex: 1, height: 46 }} />
                    <button onClick={(e) => { e.stopPropagation(); toggleFav(id); }}
                      style={{ position: "absolute", top: 1, right: 1, width: 18, height: 18, borderRadius: 4, border: "none", background: favSet.has(id) ? t.acc + "33" : "transparent", color: favSet.has(id) ? t.acc : t.tx3, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      title={favSet.has(id) ? "Remove from favorites" : "Add to favorites"}>{favSet.has(id) ? "★" : "☆"}</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>)}
    </>);
  }

  if (isMobile) return null;

  const modeTools = TOOL_MODES.find(m => m.id === mode)?.tools;
  const gridBtn = (id) => (
    <ToolBtn key={id} tool={{ ...toolOf(icons, id), label: toolTitle(id) }} active={activeTool === id} onClick={() => pick(id)} theme={theme} t={t} style={{ flex: 1 }} />
  );

  return (
    <div className="no-scrollbar" style={{ width: 120, background: t.surf, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 1, flexShrink: 0, overflowY: "auto", scrollbarWidth: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
        {/* Task modes */}
        <div role="tablist" aria-label="Tool mode" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 2 }}>
          {TOOL_MODES.map(m => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}
              title={m.id === "all" ? "All tools as icons" : `${m.label} tools`}
              style={{ height: 24, borderRadius: 5, border: `1px solid ${mode === m.id ? t.acc : t.bdr}`, background: mode === m.id ? t.accMuted : "transparent", color: mode === m.id ? t.acc : t.tx2, fontSize: 11, fontWeight: mode === m.id ? 700 : 500, cursor: "pointer", padding: 0 }}>
              {m.label}
            </button>
          ))}
        </div>
        {/* Select | Pan — every mode */}
        <div style={{ display: "flex", gap: 1 }}>
          {NAV_TOOLS.map(gridBtn)}
        </div>
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "2px 0" }} />
        {modeTools ? (
          <div role="tabpanel" aria-label={`${mode} tools`} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {modeTools.map(id => (
              <LabeledToolBtn key={id} id={id} icon={icons[id]} active={activeTool === id} onClick={() => pick(id)} theme={theme} t={t} />
            ))}
          </div>
        ) : (
          ALL_GRID.map(row => (
            <div key={row.join()} style={{ display: "flex", gap: 1, justifyContent: "center" }}>{row.map(gridBtn)}</div>
          ))
        )}
        {/* Spotlight mode */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
          <button onClick={() => { const next = !spotlightMode; dispatch({ type: "SET", payload: { spotlightMode: next } }); if (sessionImage.length > 0) { const img = sessionImage[0]; const upd = next ? { ...img, opacityBeforeSpotlight: img.opacity || 1, opacity: 0.5 } : { ...img, opacity: img.opacityBeforeSpotlight || 1 }; updSession({ images: sessionImage.map((x, i) => i === 0 ? upd : x) }); } }} title="Spotlight (reduce image opacity)" aria-label="Spotlight" style={{ width: 42, height: 42, borderRadius: 8, border: "none", background: spotlightMode ? t.acc : t.surf2, color: spotlightMode ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: spotlightMode ? `0 0 0 2px ${t.acc}` : "none" }}><Icon name="bulb" size={18} /></button>
        </div>
        {/* Separator */}
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "4px 0" }} />
        {/* Undo | Redo */}
        <div style={{ display: "flex", gap: 1 }}>
          <button onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canUndo ? t.tx2 : t.bdr, cursor: canUndo ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Undo (Ctrl+Z)">{svg(<><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></>)}</button>
          <button onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl+Y)" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: canRedo ? t.tx2 : t.bdr, cursor: canRedo ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Redo (Ctrl+Y)">{svg(<><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></>)}</button>
        </div>
        {undoSteps && <UndoHistoryButton t={t} undoSteps={undoSteps} />}
        {/* Zoom in | Zoom out */}
        <div style={{ display: "flex", gap: 1 }}>
          <button onClick={() => { const nz=clamp(zoomRef.current*1.3,0.05,15);zoomRef.current=nz;dispatch({ type: "SET", payload: { zoom: nz } }); }} aria-label="Zoom In" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18,fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom In (+)">＋</button>
          <button onClick={() => { const nz=clamp(zoomRef.current/1.3,0.05,15);zoomRef.current=nz;dispatch({ type: "SET", payload: { zoom: nz } }); }} aria-label="Zoom Out" style={{ flex: 1, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Zoom Out (−)">－</button>
        </div>
        {/* Fit to Window */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => { zoomRef.current=1;dispatch({ type: "SET", payload: { zoom: 1 } }); panRef.current = { x: 40, y: 40 }; dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } }); }} aria-label="Fit to Window" style={{ width: 38, height: 32, borderRadius: 6, border: "none", background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Reset zoom (0)">⊙</button>
        </div>
        <div style={{ width: "100%", height: 1, background: t.bdr, margin: "4px 0" }} />
        {/* Zoom % */}
        <div style={{ display: "flex", justifyContent: "center" }}><div style={{ fontSize: 14, color: t.tx3, fontFamily: "'DM Mono',monospace", textAlign: "center", padding: "2px 0" }}>{(zoom * 100).toFixed(0)}%</div></div>
      </div>
    </div>
  );
}
