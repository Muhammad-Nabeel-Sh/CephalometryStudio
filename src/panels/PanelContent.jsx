// ═══════════════════════════════════════════════════════════════════════════════
// Panel content router — maps rightPanel id to the correct component
// ═══════════════════════════════════════════════════════════════════════════════

import { SILHOUETTES } from "../data/silhouettes.js";
import { validateCepht } from "../storage/cephxFormat.js";

function hasPlacedCoords(markups) {
  return (markups || []).some(m => m.type === "point" && m.placed && m.points?.[0]?.x > -9000);
}
import { uid } from "../lib/utils.js";
import { logError } from "../lib/logger.js";
import { MarkupsPanel } from "./MarkupsPanel.jsx";
import { MeasurementsPanel } from "./MeasurementsPanel.jsx";
import { FormulasPanel } from "./FormulasPanel.jsx";
import { ImagePanel } from "./ImagePanel.jsx";
import { LayersPanel } from "./LayersPanel.jsx";
import { TemplatesPanel } from "./TemplatesPanel.jsx";
import { SilhouettesPanel } from "./SilhouettesPanel.jsx";
import { ExamplesPanel } from "./ExamplesPanel.jsx";
import SessionsPanel from "./SessionsPanel.jsx";
import { useEffect } from "react";
import { useUIStore } from "../state/uiStore.js";
import InterpretationPanel from "./InterpretationPanel.jsx";
import AirwayPanel from "./AirwayPanel.jsx";

// The studies module lives in a full-screen workspace; selecting the Research tab
// opens it, and this card reopens it after returning to the canvas.
function ResearchLauncher({ t, studies }) {
  const open = () => useUIStore.setState({ researchOpen: true });
  useEffect(() => { open(); }, []);
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.5 }}>
        Studies open in a full-screen workspace ({studies} stud{studies === 1 ? "y" : "ies"} in this project).
      </div>
      <button onClick={open}
        style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Open Research workspace
      </button>
    </div>
  );
}

export function PanelContent({ rightPanel, panelIcons, panelTabs, t,
  pMarkups, pSessions,
  allMeas, formulaMeas, calibration, norms, formatAngle,
  exportCSV, userPresets, handleSavePreset, handleDeletePreset, updSession, dispatch,
  formulas, measScope, pinnedFormulas, setPinnedFormulas,
  processing, lutMode, lutInvert, showLUT, setShowLUT, showScaleBar, setShowScaleBar,
  showHistogram, setShowHistogram,
  sessionImage, stackImgRef,
  project,
  markups, loadAirwayTier, showAirwayOverlay, setShowAirwayOverlay, loadTemplate, patientSex, patientAge, canvasRef,
  canvasSize, toImage, addMarkup, pushUndo,
}) {

  return (
    <>
      <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${t.bdr}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>{panelIcons[rightPanel] || "\uD835\uDE9C"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {panelTabs.find(([id]) => id === rightPanel)?.[1]}
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <style>{`.panel-scroll::-webkit-scrollbar{display:none}`}</style>
        <div className="panel-scroll">
          {rightPanel === "markups" && <MarkupsPanel {...pMarkups} />}
          {rightPanel === "measurements" && <MeasurementsPanel allMeas={allMeas} formulaMeas={formulaMeas} t={t} calibration={calibration} norms={norms} onUpdateNorms={ns => updSession({ norms: ns })} onExportCSV={exportCSV} onOpenCalib={() => dispatch({ type: "SET", payload: { showCalib: true } })} formatAngle={formatAngle} userPresets={userPresets} onSavePreset={handleSavePreset} onDeletePreset={handleDeletePreset} />}
          {rightPanel === "formulas" && <FormulasPanel formulas={formulas} t={t} scope={measScope} onAdd={() => dispatch({ type: "SET", payload: { editFormulaId: null, showFormulaEditor: true } })} onEdit={id => dispatch({ type: "SET", payload: { editFormulaId: id, showFormulaEditor: true } })} onDelete={id => updSession({ formulas: formulas.filter(f => f.id !== id) })} pinnedFormulas={pinnedFormulas} onPinFormula={id => setPinnedFormulas(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />}
          {rightPanel === "image" && <ImagePanel t={t} processing={processing} setProcessing={p => updSession({ processing: p })} lutMode={lutMode} setLutMode={m => updSession({ lutMode: m })} lutInvert={lutInvert} setLutInvert={v => updSession({ lutInvert: v })} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} calibration={calibration} onOpenCalib={() => dispatch({ type: "SET", payload: { showCalib: true } })} onReset={() => updSession({ processing: { brightness: 0, contrast: 0, windowWidth: 0, windowCenter: 128, edgeEnhance: 0 }, lutMode: "gray", lutInvert: false })} onShowHist={() => setShowHistogram(v => !v)} showHistogram={showHistogram} />}
          {rightPanel === "layers" && <LayersPanel t={t} images={sessionImage} markups={markups} onUpdateImages={imgs => updSession({ images: imgs })} onAddImage={() => stackImgRef.current?.click()} />}
          {rightPanel === "sessions" && <SessionsPanel {...pSessions} />}
          {rightPanel === "research" && <ResearchLauncher t={t} studies={(project?.researchStudies || []).length} />}
          {rightPanel === "interpretation" && <InterpretationPanel allMeas={allMeas} norms={norms} t={t} formatAngle={formatAngle} calibration={calibration} />}
          {rightPanel === "airway" && <AirwayPanel t={t} markups={markups} calibration={calibration} norms={norms} loadAirwayTier={loadAirwayTier} showOverlay={showAirwayOverlay} onToggleOverlay={() => setShowAirwayOverlay(v => !v)} onUpdateMarkups={updSession} onLoadTemplate={loadTemplate} dispatch={dispatch} sex={patientSex} age={patientAge} canvasRef={canvasRef} />}
          {rightPanel === "silhouettes" && <SilhouettesPanel t={t} onInsert={(silhouetteType) => {
            try {
              const def = SILHOUETTES[silhouetteType]; if (!def) return;
              const cw = canvasSize.current?.w || 800, ch = canvasSize.current?.h || 600;
              const center = toImage(cw / 2, ch / 2);
              const scale = def.onInsertFit ? Math.min(cw, ch) / 100 : 1;
              addMarkup({ type: "silhouette", silhouetteType, position: center, scale, rotation: 0, color: def.color, fillColor: def.color + "22", width: 1.5, label: def.name, paths: def.paths.map(p => ({ ...p, points: p.points.map(pt => ({ ...pt })) })) });
            } catch (e) { logError("Silhouette insert error:", e); }
          }} />}
          {rightPanel === "templates" && <TemplatesPanel t={t} projection={project.projection} onLoadTemplate={loadTemplate} onImportCepht={data => {
            const err = validateCepht(data); if (err) { alert(err); return; }
            const hasCoords = data.version === "2.0" && hasPlacedCoords(data.markups);
            const newMarkups = data.markups.map(m => {
              const base = { ...m, id: uid(), definition: m.definition || m.def || "", visible: m.visible !== false };
              if (hasCoords) return { ...base, placed: m.placed !== false, points: m.points || [{ x: -99999, y: -99999 }] };
              return { ...base, placed: false, points: m.type === "silhouette" ? m.points : [{ x: -99999, y: -99999 }] };
            });
            pushUndo();
            const updated = [...markups, ...newMarkups];
            if (hasCoords) updSession({ markups: updated, analysisTemplate: data.name });
            else {
              updSession({ markups: updated, analysisTemplate: data.name || "" });
              const qids = newMarkups.filter(m => !m.placed).map(m => m.id);
              dispatch({ type: "SET", payload: { placingQueue: qids, placingIdx: 0, placingMode: true, rightPanel: "markups" } });
            }
          }} />}
          {rightPanel === "examples" && <ExamplesPanel t={t} />}
        </div>
      </div>
    </>
  );
}
