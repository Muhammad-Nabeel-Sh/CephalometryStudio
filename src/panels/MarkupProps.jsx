import { useState, useMemo } from "react";
import { computeMeasurements, normDeviation, deviationColor, uid } from "../lib/utils.js";
import { Btn, PropRow, Inp, Divider } from "../ui/ui.jsx";
import { useSessionStore } from "../state/sessionStore.js";
import { resolveFacing, isSignedPerp } from "../lib/measureConventions.js";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupProps({ m, t, theme, onUpdate, onDelete, calibration, onParallel, formatAngle, norms, onUpdateNorms, groupOptions, stageOptions }) {
  const facing = useSessionStore(s => resolveFacing(s.facing, s.markups));
  const meas = computeMeasurements(m, calibration, { facing });
  const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
  const [editingNorm, setEditingNorm] = useState(null);

  const groupColor = useMemo(() => {
    const g = (groupOptions || []).find(g => g.id === m.group);
    return g ? g.color : (m.color || t.acc);
  }, [groupOptions, m.group, m.color, t]);

  const onUpdateGroup = value => {
    const v = (value || "").trim();
    const existing = (groupOptions || []).find(g => g.id === v);
    if (existing) {
      const c = existing.color;
      onUpdate({ group: v, color: c, strokeColor: c, fillColor: c + "22" });
    } else {
      onUpdate({ group: v || null });
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 12, color: t.tx, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Properties</span><Btn t={t} small danger onClick={onDelete}>Delete</Btn></div>
      <PropRow label="Label" t={t}><Inp value={m.label || ""} onChange={v => onUpdate({ label: v })} t={t} /></PropRow>
      {m.type === "point" && <><PropRow label="Definition" t={t}><Inp value={m.definition || ""} onChange={v => onUpdate({ definition: v })} t={t} /></PropRow><PropRow label="Hint" t={t}><Inp value={m.hint || ""} onChange={v => onUpdate({ hint: v })} t={t} placeholder="placement tip (guide mode)" /></PropRow><PropRow label="Size" t={t}><input type="range" min="3" max="14" value={m.size || 6} onChange={e => onUpdate({ size: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Group" t={t}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input list="markup-group-options" value={m.group || ""} onChange={e => onUpdateGroup(e.target.value)} placeholder="e.g. soft tissue" style={{ flex: 1, minWidth: 0, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, fontFamily: "inherit" }} /><datalist id="markup-group-options">{(groupOptions || []).filter(g => g.id !== m.group).map(g => <option key={g.id} value={g.id} />)}</datalist>{m.group && <span title={`Group "${m.group}"`} style={{ width: 16, height: 16, borderRadius: 4, background: groupColor, border: `1px solid ${t.bdr}`, flexShrink: 0 }} />}{m.group && <button onClick={() => onUpdateGroup("")} title="Clear group" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}>&times;</button>}</div></PropRow><PropRow label="Stage" t={t}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><input list="markup-stage-options" value={m.stage ?? ""} onChange={e => onUpdate({ stage: e.target.value.trim() || null })} placeholder="optional (build mode)" style={{ flex: 1, minWidth: 0, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, fontFamily: "inherit" }} /><datalist id="markup-stage-options">{(stageOptions || []).filter(s => s !== String(m.stage ?? "")).map(s => <option key={s} value={s} />)}</datalist>{m.stage != null && m.stage !== "" && <button onClick={() => onUpdate({ stage: null })} title="Clear stage" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}>&times;</button>}</div></PropRow></>}
      {m.type === "text" && <><PropRow label="Text" t={t}><Inp value={m.text || ""} onChange={v => onUpdate({ text: v })} t={t} /></PropRow><PropRow label="Size" t={t}><input type="range" min="8" max="48" value={m.fontSize || 14} onChange={e => onUpdate({ fontSize: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Bold" t={t}><input type="checkbox" checked={!!m.bold} onChange={e => onUpdate({ bold: e.target.checked })} style={{ accentColor: t.acc }} /></PropRow></>}
      {(m.type === "curve" || m.type === "polyline" || m.type === "polygon") && <PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow>}
      {(m.type === "curve" || m.type === "polyline" || m.type === "polygon") && <PropRow label="Style" t={t}><div style={{ display: "flex", gap: 4 }}>{["linear", "bspline"].map(s => <button key={s} onClick={() => onUpdate({ curveStyle: s })} style={{ padding: "2px 8px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: m.curveStyle === s ? t.acc : "transparent", color: m.curveStyle === s ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600 }}>{s === "linear" ? "Linear" : "B-Spline"}</button>)}</div></PropRow>}
      {(m.type === "curve" || m.type === "polyline" || m.type === "polygon") && <PropRow label="Points" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{m.points?.length || 0} pts</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>}
      <PropRow label="Color" t={t}><input type="color" value={m.color || m.strokeColor || "#38bdf8"} onChange={e => onUpdate(m.type === "polygon" ? { strokeColor: e.target.value } : { color: e.target.value })} style={{ width: 40, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }} /></PropRow>
      {m.type === "polygon" && <PropRow label="Fill" t={t}><input type="color" value={(m.fillColor || "#38bdf8aa").slice(0, 7)} onChange={e => onUpdate({ fillColor: e.target.value + "33" })} style={{ width: 40, height: 24, padding: 0, border: "none", cursor: "pointer", borderRadius: 4 }} /></PropRow>}
      {["line", "angle3", "angle4", "curve", "polyline", "perp", "parallel", "projDist", "ratio", "sum", "difference", "percentage", "ellipse", "arc", "circle", "bezier", "tangent", "concentric"].includes(m.type) && <PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width || 1.5} onChange={e => onUpdate({ width: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow>}
      {m.type === "silhouette" && <><PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width || 1.5} onChange={e => onUpdate({ width: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Scale" t={t}><input type="range" min="0.1" max="5" step="0.05" value={m.scale || 1} onChange={e => onUpdate({ scale: +e.target.value })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Rotation" t={t}><input type="range" min="0" max="360" step="1" value={(m.rotation || 0) * (180 / Math.PI)} onChange={e => onUpdate({ rotation: +e.target.value * (Math.PI / 180) })} style={{ width: "100%", accentColor: t.acc }} /></PropRow><PropRow label="Show Frame" t={t}><input type="checkbox" checked={m.showFrame !== false} onChange={e => onUpdate({ showFrame: e.target.checked })} style={{ accentColor: t.acc }} /></PropRow><PropRow label="Points" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{(m.paths || []).reduce((s, p) => s + p.points.length, 0)} pts</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>{(m.paths?.length || 0) > 1 && (() => { const g = {}; m.paths.forEach((p, i) => { const k = p.name || `Path ${i + 1}`; if (!g[k]) g[k] = { name: k, indices: [] }; g[k].indices.push(i); }); return <><Divider t={t} /><div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>Path Colors</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{Object.entries(g).map(([k, v]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 10, color: t.tx2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span><input type="color" value={(m.paths[v.indices[0]]?.color || t.acc).slice(0, 7)} onChange={e => { const updated = m.paths.map((p, i) => v.indices.includes(i) ? { ...p, color: e.target.value } : p); onUpdate({ paths: updated }); }} style={{ width: 28, height: 18, padding: 0, border: "none", cursor: "pointer", borderRadius: 3 }} /></div>)}</div></> })()}</>}
      {(m.type === "perp" || m.type === "projDist") && (
        <PropRow label="Sign" t={t}>
          {m.type === "perp" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.tx2 }}
              title="Signed: positive = anterior to the reference line (superior for near-horizontal lines), in the patient's frame.">
              <input type="checkbox" checked={isSignedPerp(m)} onChange={e => onUpdate({ signed: e.target.checked })} />
              Signed (anterior +)
            </label>
          ) : (
            <span style={{ fontSize: 11, color: t.tx3 }}>First point anterior of second = +</span>
          )}
        </PropRow>
      )}
      {(m.type === "line" || m.type === "parallel") && <><PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Type" t={t}><div style={{ display: "flex", gap: 4 }}>{["segment", "infinite"].map(s => <button key={s} onClick={() => onUpdate({ mode: s })} style={{ padding: "2px 8px", fontSize: 10, border: `1px solid ${t.bdr}`, borderRadius: 4, background: m.mode === s ? t.acc : "transparent", color: m.mode === s ? (theme === "light" ? "#fff" : t.bg) : t.tx, cursor: "pointer", fontWeight: 600 }}>{s === "segment" ? "2-Point" : "Infinite"}</button>)}</div></PropRow><PropRow label="∥ Clone" t={t}><Btn t={t} small onClick={onParallel} style={{ fontSize: 10 }}>Create Parallel</Btn></PropRow></>}
      {["arc", "ellipse", "circle", "concentric", "bezier", "tangent"].includes(m.type) && <PropRow label="Dash" t={t}><select value={m.style || "solid"} onChange={e => onUpdate({ style: e.target.value })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 6px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow>}
      {m.type === "bezier" && <PropRow label="Anchors" t={t}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ fontSize: 11, color: t.tx2 }}>{m.points?.length || 0} pts · {Math.max(0, (m.points?.length || 1) - 1)} seg</span><span style={{ fontSize: 9, color: t.tx3 }}>Ctrl+click add • Shift+click remove</span></div></PropRow>}
      {m.type === "concentric" && <><PropRow label="Arcs" t={t}><input type="range" min="2" max="10" step="1" value={m.count || 4} onChange={e => { const count = +e.target.value; const spacing = m.spacing || 0.3; onUpdate({ count, offsets: Array.from({ length: count }, (_, i) => i * spacing) }); }} style={{ width: "100%", accentColor: t.acc }} /><span style={{ fontSize: 10, color: t.tx2, marginLeft: 6 }}>{m.count || 4}</span></PropRow><PropRow label="Spacing" t={t}><input type="range" min="0.05" max="1" step="0.05" value={m.spacing || 0.3} onChange={e => { const spacing = +e.target.value; const count = m.count || 4; onUpdate({ spacing, offsets: Array.from({ length: count }, (_, i) => i * spacing) }); }} style={{ width: "100%", accentColor: t.acc }} /><span style={{ fontSize: 10, color: t.tx2, marginLeft: 6 }}>{((m.spacing || 0.3) * 100).toFixed(0)}%</span></PropRow></>}
      {(()=>{const fm=Object.entries(meas).filter(([k])=>!k.startsWith("_")&&(m.type==="point"||(k!=="x"&&k!=="y")));return fm.length>0&&<div style={{marginTop:10,padding:8,background:t.surf3,borderRadius:6}}>{fm.map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.tx2}}><span style={{textTransform:"capitalize"}}>{k}</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{k==="angle"?formatAngle(v):v.toFixed(2)+(k==="area"?(calibration?.done?" mm²":" px²"):(calibration?.done?" mm":" px"))}</span></div>)}</div>;})()}
      {(()=>{const calTypes=["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];return relNorms.length>0&&<div style={{marginTop:8,padding:8,background:t.surf3,borderRadius:6}}><div style={{fontSize:10,color:t.tx2,marginBottom:6,fontWeight:600}}>Clinical Norms</div>{relNorms.map(n=>{const val=meas[n.measureType];const dev=val!==undefined&&(calibration?.done||!calTypes.includes(n.measureType))?normDeviation(val,n):null;return(<div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,marginBottom:4}}><span style={{color:t.tx2}}>{n.measureType}: {n.mean}±{n.sd}</span><div style={{display:"flex",gap:4,alignItems:"center"}}>{dev&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:deviationColor(dev.sdUnits,t),fontWeight:700}}>{dev.delta>0?"+":""}{dev.delta.toFixed(1)}({dev.sdUnits>0?"+":""}{dev.sdUnits.toFixed(1)}SD)</span>}<button onClick={()=>setEditingNorm({id:n.id,markupLabel:n.markupLabel,measureType:n.measureType,mean:n.mean,sd:n.sd,source:n.source})} style={{background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:3,padding:"0 4px",cursor:"pointer",fontSize:9,lineHeight:"16px"}}>Edit</button></div></div>)})}</div>})()}
      {editingNorm && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
    </div>
  );
}

function InlineNormEditor({ t, markupLabel, measureType, existing, onSave, onDelete, onClose }) {
  const [mean, setMean] = useState(String(existing?.mean || ""));
  const [sd, setSd] = useState(String(existing?.sd || ""));
  const [source, setSource] = useState(existing?.source || "");
  const [ageRange, setAgeRange] = useState(existing?.ageRange || "");
  const [sex, setSex] = useState(existing?.sex || "");
  return (
    <div style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.acc, marginBottom: 8 }}>Norm for {markupLabel} &middot; {measureType}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Mean</div><Inp value={mean} onChange={setMean} t={t} type="number" placeholder="e.g. 82" style={{ width: "100%" }} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>SD</div><Inp value={sd} onChange={setSd} t={t} type="number" placeholder="e.g. 3" style={{ width: "100%" }} /></div>
      </div>
      <div style={{ marginBottom: 6 }}><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Source</div><Inp value={source} onChange={setSource} t={t} placeholder="e.g. Steiner 1953, Caucasian adults" style={{ width: "100%" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Age Range</div><Inp value={ageRange} onChange={setAgeRange} t={t} placeholder="e.g. Adult / 12-17y" style={{ width: "100%" }} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Sex</div><Inp value={sex} onChange={setSex} t={t} placeholder="e.g. Pooled / Male / Female" style={{ width: "100%" }} /></div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn t={t} small onClick={() => onSave({ markupLabel, measureType, mean: parseFloat(mean), sd: parseFloat(sd), source, ageRange, sex })} disabled={!mean || !sd} style={{ flex: 1 }}>Save</Btn>
        {existing && <Btn t={t} small danger onClick={onDelete}>Del</Btn>}
        <Btn t={t} small onClick={onClose}>&times;</Btn>
      </div>
    </div>
  );
}
