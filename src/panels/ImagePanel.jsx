import { useState } from "react";
import { LUT_PRESETS } from "../data/constants.js";
import { Sld, Divider, PanelHeader, Btn, GuideBtn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ImagePanel({ t, processing, setProcessing, lutMode, setLutMode, lutInvert, setLutInvert, showLUT, setShowLUT, showScaleBar, setShowScaleBar, calibration, onOpenCalib, onReset, onShowHist, showHistogram }) {
  const [guideKey, setGuideKey] = useState(null);
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Window & Level
        <GuideBtn t={t} onClick={() => setGuideKey("image")} style={{ marginLeft: 6 }} />
      </PanelHeader>
      <Sld label="W Center" value={processing.windowCenter} min={0} max={255} onChange={v => { const p = { ...processing, windowCenter: v }; setProcessing(p); }} t={t} />
      <Sld label="W Width" value={processing.windowWidth} min={0} max={255} onChange={v => { const p = { ...processing, windowWidth: v }; setProcessing(p); }} t={t} />
      <Divider t={t} />
      <PanelHeader t={t}>Brightness & Contrast</PanelHeader>
      <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v => { const p = { ...processing, brightness: v }; setProcessing(p); }} t={t} />
      <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v => { const p = { ...processing, contrast: v }; setProcessing(p); }} t={t} unit="%" />
      <Sld label="Edge Enhance" value={processing.edgeEnhance} min={0} max={100} onChange={v => { const p = { ...processing, edgeEnhance: v }; setProcessing(p); }} t={t} unit="%" />
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}><Btn t={t} small onClick={onReset} style={{ flex: 1 }}>↺ Reset</Btn><Btn t={t} small active={showHistogram} onClick={onShowHist} style={{ flex: 1 }}>▦ Histogram</Btn></div>
      <Divider t={t} />
      <PanelHeader t={t}>
        LUT Colorization
        <GuideBtn t={t} onClick={() => setGuideKey("lut")} label="LUT Guide" style={{ marginLeft: 6 }} />
      </PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <Btn t={t} small active={showLUT} onClick={() => setShowLUT(v => !v)}>Legend</Btn>
        <Btn t={t} small active={lutInvert} onClick={() => setLutInvert(!lutInvert)}>⇅ Invert</Btn>
        <Btn t={t} small onClick={() => { setLutMode("gray"); setLutInvert(false); }}>Revert</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
        {LUT_PRESETS.map(lut => (
          <button key={lut.id} onClick={() => setLutMode(lut.id)}
            style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${lutMode === lut.id ? t.acc : t.bdr}`, background: lutMode === lut.id ? t.accMuted : t.surf2, cursor: "pointer", fontSize: 11, color: lutMode === lut.id ? t.acc : t.tx, fontWeight: lutMode === lut.id ? 700 : 400 }}>
            <div style={{ height: 8, borderRadius: 2, marginBottom: 4, background: `linear-gradient(90deg,${(lutInvert ? [...lut.stops].reverse() : lut.stops).join(",")})` }} />
            {lut.name}
          </button>
        ))}
      </div>
      <Divider t={t} />
      <PanelHeader t={t}>Scale & Calibration</PanelHeader>
      {calibration.done ? <div style={{ fontSize: 12, color: t.ok, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span><button onClick={onOpenCalib} style={{ background: "none", border: `1px solid ${t.ok}55`, color: t.ok, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10 }}>Edit</button></div> : <div style={{ fontSize: 12, color: t.tx2, marginBottom: 8 }}>Not calibrated. Use ruler tool (R).</div>}
      <Btn t={t} small active={showScaleBar} onClick={() => setShowScaleBar(v => !v)}>On-Screen Scale Bar</Btn>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
