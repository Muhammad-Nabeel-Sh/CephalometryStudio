import { useState } from "react";
import { uid, normDeviation, deviationColor } from "../lib/utils.js";
import { DEFAULT_NORMS } from "../data/norms.js";
import { Btn, Tag, Inp } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { NormsReferenceModal } from "./NormsReferenceModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MeasurementsPanel({ allMeas, formulaMeas, t, calibration, norms, onUpdateNorms, onExportCSV, onOpenCalib, formatAngle, userPresets, onSavePreset, onDeletePreset }) {
  const [editingNorm, setEditingNorm] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [guideKey, setGuideKey] = useState(null);
  const hasMeas = allMeas.length > 0 || (formulaMeas && formulaMeas.length > 0);
  return (
    <div style={{ padding: 12 }}>
      {!calibration.done && <div style={{ background: t.warn + "22", border: `1px solid ${t.warn}44`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: t.warn }}>⚠ Calibrate for mm values.<button onClick={onOpenCalib} style={{ display: "block", marginTop: 6, background: t.warn, color: "#000", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Open Calibration</button></div>}
      {calibration.done && <div style={{ background: t.ok + "11", border: `1px solid ${t.ok}33`, borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 11, color: t.ok, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => setGuideKey("measurements")}
            style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, flexShrink: 0 }} title="Guide">?</button>
          <button onClick={onOpenCalib} style={{ background: "none", border: `1px solid ${t.ok}55`, color: t.ok, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10 }}>Edit</button>
        </div>
      </div>}

      <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
        <Btn t={t} small onClick={() => setShowGallery(true)} style={{ flex: 1 }}>Norms Reference</Btn>
        <Btn t={t} small onClick={() => {
          const existing = norms ? [...norms] : [];
          Object.values(DEFAULT_NORMS).forEach(preset => {
            preset.norms.forEach(n => {
              if (!existing.some(e => e.markupLabel === n.label && e.measureType === n.type))
                existing.push({ id: uid(), markupLabel: n.label, measureType: n.type, mean: n.mean, sd: n.sd, source: preset.source });
            });
          });
          onUpdateNorms(existing);
        }} style={{ flexShrink: 0 }}>+ All Presets</Btn>
      </div>
      {showGallery && <NormsReferenceModal t={t} onAdd={Object.assign((label, mean, sd, type, source) => {
        const existing = norms ? [...norms] : [];
        if (existing.some(e => e.markupLabel === label && e.measureType === type)) return;
        onUpdateNorms([...existing, { id: uid(), markupLabel: label, measureType: type, mean, sd, source }]);
      }, { __norms: norms || [] })} userPresets={userPresets} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onClose={() => setShowGallery(false)} />}

      {!hasMeas ? <div style={{ color: t.tx3, fontSize: 12, textAlign: "center", paddingTop: 20 }}>Place lines, angles, or polygons.</div>
        : <>
          {[...allMeas].sort((a, b) => (a.m.type === "point" ? 1 : 0) - (b.m.type === "point" ? 1 : 0)).map(({ m, meas }) => {
            const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
            return (
              <div key={m.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.color || t.acc, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{m.label || m.type}</span><Tag color={m.color || t.acc}>{m.type}</Tag></div>
                  {Object.entries(meas).filter(([k]) => !k.startsWith("_") && (m.type === "point" || (k !== "x" && k !== "y"))).map(([k, v]) => {
                  const calTypes = ["length","distance","area","perimeter","radius","circumference","majorAxis","minorAxis","arcLength","projectedDistance"];
                  const norm = !calibration.done && calTypes.includes(k) ? null : relNorms.find(n => n.measureType === k);
                  const dev = norm ? normDeviation(v, norm) : null;
                  return (
                    <div key={k} style={{ marginBottom: dev ? 10 : 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, alignItems: "center" }}>
                        <span>{k}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx, fontWeight: 600 }}>{k === "angle" ? formatAngle(v) : v.toFixed(2) + (k === "area" ? (calibration.done ? " mm²" : " px²") : (calibration.done ? " mm" : " px"))}</span>
                          <button onClick={() => setEditingNorm({ markupLabel: m.label, measureType: k, existing: norm })}
                            style={{ background: "none", border: `1px solid ${norm ? t.ok + "55" : t.bdr}`, color: norm ? t.ok : t.tx3, borderRadius: 3, padding: "0 4px", cursor: "pointer", fontSize: 9, fontWeight: 700, lineHeight: "16px" }}>
                            {norm ? "N" : "±N"}
                          </button>
                        </div>
                      </div>
                      {dev && <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, background: deviationColor(dev.sdUnits, t) + "18", border: `1px solid ${deviationColor(dev.sdUnits, t)}44` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                          <span style={{ color: t.tx2 }}>Norm: {norm.mean} ± {norm.sd}</span>
                          <span style={{ fontWeight: 700, color: deviationColor(dev.sdUnits, t) }}>{dev.delta > 0 ? "+" : ""}{dev.delta.toFixed(2)} ({dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)} SD)</span>
                        </div>
                        {norm.source && <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>{norm.source}</div>}
                      </div>}
                    </div>
                  );
                })}
              {editingNorm?.markupLabel === m.label && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.existing?.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
            </div>
          );
        })}
          {formulaMeas && formulaMeas.map(({ m, meas }) => {
            const relNorms = (norms || []).filter(n => n.markupLabel === m.label);
            return (
              <div key={m.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}`, borderLeft: `3px solid ${t.acc2}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.color || t.acc, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>{m.label || m.type}</span><Tag color={m.color || t.acc}>{m.type}</Tag></div>
                {Object.entries(meas).filter(([k]) => !k.startsWith("_")).map(([k, v]) => {
                  const norm = relNorms.find(n => n.measureType === k);
                  const dev = norm ? normDeviation(v, norm) : null;
                  const unitLabel = k === "value" ? (m.unit || "") : "";
                  return (
                    <div key={k} style={{ marginBottom: dev ? 10 : 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.tx2, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: t.tx3 }}>{k}{unitLabel ? " (" + unitLabel + ")" : ""}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx, fontWeight: 600 }}>{v.toFixed(2)}</span>
                          <button onClick={() => setEditingNorm({ markupLabel: m.label, measureType: k, existing: norm })}
                            style={{ background: "none", border: `1px solid ${norm ? t.ok + "55" : t.bdr}`, color: norm ? t.ok : t.tx3, borderRadius: 3, padding: "0 4px", cursor: "pointer", fontSize: 9, fontWeight: 700, lineHeight: "16px" }}>
                            {norm ? "N" : "±N"}
                          </button>
                        </div>
                      </div>
                      {dev && <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 5, background: deviationColor(dev.sdUnits, t) + "18", border: `1px solid ${deviationColor(dev.sdUnits, t)}44` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                          <span style={{ color: t.tx2 }}>Norm: {norm.mean} ± {norm.sd}</span>
                          <span style={{ fontWeight: 700, color: deviationColor(dev.sdUnits, t) }}>{dev.delta > 0 ? "+" : ""}{dev.delta.toFixed(2)} ({dev.sdUnits > 0 ? "+" : ""}{dev.sdUnits.toFixed(1)} SD)</span>
                        </div>
                        {norm.source && <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>{norm.source}</div>}
                      </div>}
                    </div>
                  );
                })}
              {editingNorm?.markupLabel === m.label && <InlineNormEditor t={t} {...editingNorm} onSave={(n) => { const filtered = (norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType)); onUpdateNorms([...filtered, { id: editingNorm.existing?.id || uid(), ...n }]); setEditingNorm(null); }} onDelete={() => { onUpdateNorms((norms || []).filter(x => !(x.markupLabel === editingNorm.markupLabel && x.measureType === editingNorm.measureType))); setEditingNorm(null); }} onClose={() => setEditingNorm(null)} />}
            </div>
          );
        })}
        </>}

      {hasMeas && <Btn t={t} small onClick={onExportCSV} style={{ width: "100%", marginTop: 8 }}>⬇ Export CSV</Btn>}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
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
