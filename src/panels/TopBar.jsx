import { useState, useRef, useEffect } from "react";
import { THEMES } from "../data/constants.js";
import { Btn, Tag } from "../ui/ui.jsx";
import { useStoreDispatch } from "../state/workspaceStore.js";
import { useToolStore, useUIStore } from "../state/workspaceStore.js";
import { Icon } from "../ui/icons.jsx";

export default function TopBar({
  t, theme, project, onHome,
  onSave,
  openImgRef, importRef, calibration,
  setTheme,
}) {
  const dispatch = useStoreDispatch();
  const snapEnabled = useToolStore(s => s.snapEnabled);
  const placingMode = useToolStore(s => s.placingMode);
  const placingQueue = useToolStore(s => s.placingQueue);
  const placingIdx = useToolStore(s => s.placingIdx);
  const showScaleBar = useUIStore(s => s.showScaleBar);
  const showDefTooltips = useUIStore(s => s.showDefTooltips);
  const showAnnotations = useUIStore(s => s.showAnnotations);
  const annotationSize = useUIStore(s => s.annotationSize);
  const showDisplacement = useUIStore(s => s.showDisplacement);
  const compareSession = useUIStore(s => s.compareSession);

  const [snapDrop, setSnapDrop] = useState(false);
  const [snapRect, setSnapRect] = useState(null);
  const snapRef = useRef(null);
  useEffect(() => {
    if (!snapDrop) return;
    if (snapRef.current) setSnapRect(snapRef.current.getBoundingClientRect());
    const fn = e => { if (snapRef.current && !snapRef.current.contains(e.target)) setSnapDrop(false); };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, [snapDrop]);
  const anySnap = snapEnabled.points || snapEnabled.lines;
  const toggleSnap = (key) => dispatch({ type: "SET", payload: { snapEnabled: { ...snapEnabled, [key]: !snapEnabled[key] } } });
  return (
    <div className="topbar" style={{ background: t.surf, flexShrink: 0, overflowX: "auto", overflowY: "hidden", position: "relative", zIndex: 10 }}>
      <button onClick={onHome} title="Back to Home" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, flexShrink: 0, color: t.tx }}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z" /></svg>
      </button>
      <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, flexShrink: 0 }}>
        <span className="topbar-logo"><img src="/favicon.svg" alt="Website Icon" width="40" height="40" /></span>
        <span className="hide-mobile" style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: t.tx, fontSize: 17, display: "inline-flex", alignItems: "center", gap: 6 }}>Cephalometry Studio<span style={{ fontSize: 8, fontWeight: 700, color: t.acc, background: t.accMuted, borderRadius: 5, padding: "1px 5px", letterSpacing: 0.8 }}>BETA</span></span>
      </button>
      <div style={{ width: 1, height: 20, background: t.bdr, flexShrink: 0 }} />
      <Tag color={t.acc}>{project.projection?.toUpperCase()}</Tag>
      {project.meta?.anonymized && <Tag color={t.ok}><Icon name="lock" size={11} /> Anon</Tag>}
      {calibration.done && <Tag color={t.ok}>⟺{"\u00A0"}{calibration.pxPerMm.toFixed(2)}px/mm</Tag>}
      {placingMode && <Tag color={t.warn}><Icon name="pin" size={11} /> {placingIdx + 1}/{placingQueue.length}</Tag>}
      <div style={{ flex: 1 }} />
      <div className="hide-mobile" style={{display:"contents"}}>
        <div ref={snapRef} style={{ position: "relative" }}>
          <Btn ghost t={t} small active={anySnap} title="Snap settings" onClick={() => setSnapDrop(v => !v)}>
            <svg fill={t.tx} width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.7,12.818a1.022,1.022,0,0,1,0,1.445L20.154,15.81l-3.589-3.589,1.547-1.548a1.022,1.022,0,0,1,1.444,0ZM9.737,2.3,8.19,3.846l3.59,3.589,1.546-1.547a1.021,1.021,0,0,0,0-1.444L11.181,2.3A1.021,1.021,0,0,0,9.737,2.3ZM4.478,19.522a8.458,8.458,0,0,0,11.963,0l2.269-2.268-3.589-3.589-2.269,2.268a3.384,3.384,0,0,1-4.785-4.785l2.269-2.269L6.747,5.29,4.478,7.559A8.458,8.458,0,0,0,4.478,19.522Z" /></svg>
          </Btn>
          {snapDrop && snapRect && <div style={{ position: "fixed", top: snapRect.bottom + 4, right: window.innerWidth - snapRect.right, background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: "6px 0", minWidth: 160, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "4px 12px", fontSize: 11, color: t.tx3, fontWeight: 600, letterSpacing: 0.5 }}>SNAP TO</div>
            {[["points", "Points"], ["lines", "Lines"]].map(([key, label]) => (
              <button key={key} onClick={() => toggleSnap(key)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 12px", background: "none", border: "none", cursor: "pointer", color: t.tx, fontSize: 13 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${snapEnabled[key] ? t.acc : t.tx3}`, background: snapEnabled[key] ? t.acc : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {snapEnabled[key] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                {label}
              </button>
            ))}
          </div>}
        </div>
        <Btn ghost t={t} small active={showScaleBar} title="Toggle scale bar" onClick={() => dispatch({ type: "SET", payload: { showScaleBar: !showScaleBar } })}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.tx} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler-dimension-line-icon lucide-ruler-dimension-line"><path d="M10 15v-3"/><path d="M14 15v-3"/><path d="M18 15v-3"/><path d="M2 8V4"/><path d="M22 6H2"/><path d="M22 8V4"/><path d="M6 15v-3"/><rect x="2" y="12" width="20" height="8" rx="2"/></svg>
        </Btn>
        <Btn ghost t={t} small active={showDefTooltips} title="Toggle definition tooltips" onClick={() => dispatch({ type: "SET", payload: { showDefTooltips: !showDefTooltips } })}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" /></svg>
        </Btn>
        <Btn ghost t={t} small active={showAnnotations} title="Toggle annotations" onClick={() => dispatch({ type: "SET", payload: { showAnnotations: !showAnnotations } })}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M338-241q16 0 23-10.5t9-24.5q2-10 3.5-20t3.5-22q2-11 4.5-24t5.5-30q23-5 45-8.5t43-5.5q23-3 45.5-4.5T564-394q5 24 10.5 43t11.5 36q8 23 17.5 38t23.5 26q14 11 30.5 12t28.5-9q9-7 9-21t-8-35q-5-11-8.5-22.5T670-350q-5-14-9-25.5t-7-22.5q13-1 23.5-4.5T695-412q7-6 10.5-14.5T709-445q0-11-4.5-18.5T691-476q-9-5-22.5-6.5t-30.5.5q-2-18-4-35.5t-5-35.5q-3-17-5.5-35t-7.5-35q-6-26-17-44.5T574-698q-13-11-28.5-16.5T511-720q-22 0-42 9t-40 27q-11 11-22 23.5T386-631q-8-6-14.5-8t-14.5-2q-11 0-18.5 6t-7.5 20q0 18-2 36t-6 36q-5 26-11 51.5T301-440q-11 2-19.5 5.5T267-427q-8 5-11.5 12.5T252-399q0 7 2 13t7 11q5 5 12 7.5t16 3.5q-1 12-1.5 22.5T287-321q0 21 3 36t9 25q6 10 15.5 14.5T338-241Zm71-223q6-23 14-44.5t18-44.5q16-37 34-59t32-22q11 0 19 17t13 51q3 20 5 43t4 43q-17 1-35 2.5t-35 3.5q-17 2-34.5 4.5T409-464ZM160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v640q0 33-23.5 56.5T800-80H160Zm0-80h640v-640H160v640Zm0 0v-640 640Z" /></svg>
        </Btn>
        {showAnnotations && <input type="range" min="0.5" max="2" step="0.1" value={annotationSize} onChange={e => dispatch({ type: "SET", payload: { annotationSize: +e.target.value } })} style={{ width: 60, marginLeft: 4, accentColor: t.acc }} title={`Annotation size: ${annotationSize.toFixed(1)}`} />}
        {compareSession && <Btn ghost t={t} small active={showDisplacement} title="Toggle displacement vectors" onClick={() => dispatch({ type: "SET", payload: { showDisplacement: !showDisplacement } })}>⇝ Vec</Btn>}
        <div style={{ width: 1, height: 20, background: t.bdr }} />
      </div>
      <Btn ghost t={t} small title="Open image" onClick={() => openImgRef.current?.click()}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
          <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z" />
        </svg>
      </Btn>
      <Btn ghost t={t} small title="Import (.cephx)" onClick={() => importRef.current?.click()}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
          <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
        </svg>
      </Btn>
      <span className="hide-mobile" style={{display:"contents"}}><Btn ghost t={t} small title="Save project" onClick={onSave}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
          <path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM565-275q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z" />
        </svg>
      </Btn>
      <Btn ghost t={t} small title="Export" onClick={() => dispatch({ type: "SET", payload: { showExport: true } })}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-80v-80h640v80H160Zm320-160L200-600h160v-280h240v280h160L480-240Zm0-130 116-150h-76v-280h-80v280h-76l116 150Zm0-150Z" /></svg>
      </Btn>
      <Btn ghost t={t} small title="Normogram" onClick={() => dispatch({ type: "SET", payload: { showNormogram: true } })}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M200-120q-33 0-56.5-23.5T120-200v-640h80v640h640v80H200Zm40-120v-360h160v360H240Zm200 0v-560h160v560H440Zm200 0v-200h160v200H640Z" /></svg>
      </Btn></span>
      <span className="hide-mobile" style={{display:"contents"}}><Btn ghost t={t} small title="Anonymize" onClick={() => dispatch({ type: "SET", payload: { showAnon: true } })}>
        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z" /></svg>
      </Btn></span>
      <Btn ghost t={t} small title="Settings" onClick={() => dispatch({ type: "SET", payload: { showSettings: true } })}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.tx} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </Btn>
      <span className="hide-mobile" style={{display:"contents"}}>
        <div style={{ width: 1, height: 20, background: t.bdr, flexShrink: 0 }} />
        {Object.values(THEMES).map(th => (
          <button key={th.id} onClick={() => setTheme(th.id)} title={th.name} aria-label={th.name} aria-pressed={theme === th.id} style={{ width: 22, height: 22, borderRadius: 6, border: theme === th.id ? `2px solid ${t.acc}` : `1px solid ${t.bdr}`, background: th.bg, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: th.acc }} />
          </button>
        ))}
      </span>
    </div>
  );
}
