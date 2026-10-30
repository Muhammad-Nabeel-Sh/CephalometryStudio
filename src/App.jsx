import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  lazy,
  Suspense,
  Fragment,
} from "react";
import { THEMES, PREDEFINED, LUT_PRESETS } from "./data/constants.js";
import { KEYBINDINGS } from "./data/keybindings.js";
import { SILHOUETTES } from "./data/silhouettes.js";
import {
  uid,
  clamp,
  dist,
  vpts,
  computeMeasurements,
  snapPoint,
  snapPointResult,
  alignTwoPoints,
  buildScope,
  evalFormula,
  loadFormulaEngine,
  formulaTex,
  getMissingVars,
  autoControlPoints,
  findTangentOnCurve,
  snapTangentToCurve,
  mirrorPoint,
} from "./lib/utils.js";
import { resolveFacing } from "./lib/measureConventions.js";
import { generateInterpretation } from "./lib/interpretation.js";
import {
  processImageToCanvas,
  computeHistogram,
  FloatingHistogram,
} from "./canvas/imageUtils.jsx";
import { KatexSpan, LatexFloatingPanel } from "./hooks/useKatex.jsx";
import { Btn, Tag, Sld, PropRow, Inp, GuideBtn, Chip } from "./ui/ui.jsx";
import { detectRulerScale } from "./imaging/ruler.js";
import { BACKDROP } from "./ui/tokens.js";
import ToolBtn from "./ui/ToolBtn.jsx";
import {
  drawMarkup,
  drawInProgress,
  drawScaleBar,
  drawLUTLegend,
  drawSnapIndicator,
  drawDisplacementVectors,
  drawAirwayOverlay,
  hitTest,
  FINGER_SLOP,
  beginLabelLayout,
  flushLabelLayout,
  getSilhouetteHandlesImage,
} from "./canvas/drawMarkups.js";
import { MarkupsPanel } from "./panels/MarkupsPanel.jsx";
import { MeasurementsPanel } from "./panels/MeasurementsPanel.jsx";
import { Icon } from "./ui/icons.jsx";
import { FormulasPanel } from "./panels/FormulasPanel.jsx";
import { ImagePanel } from "./panels/ImagePanel.jsx";
import { LayersPanel } from "./panels/LayersPanel.jsx";
import { TemplatesPanel } from "./panels/TemplatesPanel.jsx";
import { SilhouettesPanel } from "./panels/SilhouettesPanel.jsx";
import { MarkupProps } from "./panels/MarkupProps.jsx";
import { ExamplesPanel } from "./panels/ExamplesPanel.jsx";
import { loadNormLibrary, saveNormLibrary } from "./data/normLibrary.js";
import { createRedraw } from "./canvas/redraw.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { autoCreateMeasurements, applyAnalysis, deriveNorms } from "./workspace/template.js";
import { runAutoTrace, findAnalysis } from "./workspace/autoTrace.js";
import { LANDMARK_MODEL } from "./data/landmarkModelInfo.js";
import {
  refreshAutoMeasurements,
  markupDefaults,
} from "./workspace/markupHelpers.js";
import {
  finalizeCalibRuler,
  finalizeCalibManual,
  exportCSV as exportCSVData,
} from "./workspace/calibration.js";
import { loadImageFile, handleImageDrop } from "./workspace/images.js";
import { IMAGE_ACCEPT } from "./imaging/readImage.js";
import { Modal } from "./panels/Modal.jsx";
import PanelGuideModal from "./panels/PanelGuideModal.jsx";
import HomePage from "./panels/HomePage.jsx";
import Toolbar from "./panels/Toolbar.jsx";
import TopBar from "./panels/TopBar.jsx";
import ErrorBoundary from "./ui/ErrorBoundary.jsx";
import SessionsPanel from "./panels/SessionsPanel.jsx";
import AirwayPanel from "./panels/AirwayPanel.jsx";
import { PanelContent } from "./panels/PanelContent.jsx";
import { PANEL_ICONS, PANEL_TABS } from "./panels/panelIcons.jsx";
import { RightPanelSidebar } from "./panels/RightPanelSidebar.jsx";
import SessionFilmstrip from "./panels/SessionFilmstrip.jsx";
import AnonModal from "./panels/AnonModal.jsx";
import AnalysisModal from "./panels/AnalysisModal.jsx";
// C6: the studies workspace, PDF report generator and formula engine load on
// first use instead of with the app.
const ResearchWorkspace = lazy(() => import("./research/ResearchWorkspace.jsx"));
import { useFormulaEngine } from "./hooks/useFormulaEngine.js";
import { useSourceWindow } from "./hooks/useSourceWindow.js";
import { sessionSeal, unsealSession, sealedSessions } from "./research/blinding.js";
import InterpretationPanel from "./panels/InterpretationPanel.jsx";
import NormogramPanel from "./panels/NormogramPanel.jsx";
import MobileTabBar from "./ui/MobileTabBar.jsx";
import MobileBottomSheet from "./ui/MobileBottomSheet.jsx";
import ContextMenu from "./ui/ContextMenu.jsx";
import { mkProject, updateSessionInProject } from "./model/project.js";
import { getImageDataUrl, idbAvailable } from "./storage/imageStore.js";
import {
  importCephxPayload,
  validateCepht,
  buildCephxPayload,
  isBackupPayload,
  parseBackupPayload,
} from "./storage/cephxFormat.js";
import { secureStorageAvailable } from "./storage/secureStorage.js";
import {
  loadProjects,
  saveProjects,
  clearAllLocalData,
  hydrateProjectImages,
  setBackupSource,
  downloadBackup,
  runStorageMaintenance,
  STORAGE_EVENT,
} from "./storage/projectStore.js";
import { anonymizeProject, hasUnanonymizedPHI } from "./report/anonymize.js";
import { logError } from "./lib/logger.js";
import { askConfirm, askText, notify, showInfo, dismissToastKey } from "./ui/dialogs.js";
import { describeChange, isNotableChange } from "./workspace/undoHistory.js";
import { nextToReview, confirmPoint } from "./workspace/aiReview.js";
import { PlacingGuide, Magnifier } from "./panels/PlacingGuide.jsx";
import { DialogHost } from "./ui/DialogHost.jsx";
import SettingsModal from "./panels/SettingsModal.jsx";
import DriveBackupDialog from "./panels/DriveBackupDialog.jsx";
import ProfileMenu from "./panels/ProfileMenu.jsx";
import SyncSetupDialog from "./panels/SyncSetupDialog.jsx";
import { useDriveSync } from "./hooks/useDriveSync.js";
import { switchProfile, activeProfile } from "./storage/profiles.js";
import { driveConfigured } from "./storage/driveBackup.js";
import { drawImageLayers, reportScale, printLabelScale } from "./canvas/imageLayers.js";
import { computeAirwayMeasurements, normalizeSex, normalizeAge } from "./research/airway.js";

import { useStoreDispatch, syncPlacingQueue } from "./state/workspaceStore.js";
import { useToolStore, useUIStore } from "./state/workspaceStore.js";
import {
  useSessionStore,
  setSessionChangeHandler,
} from "./state/sessionStore.js";

function profileProject(project) {
  const rows = [];
  const sessions = project.sessions || [];

  // Image totals
  let totalImgBytes = 0;
  sessions.forEach((s) => {
    const imgs = s.images || [];
    imgs.forEach((imgEntry) => {
      const du = imgEntry.dataUrl || "";
      if (du.length > 0) {
        totalImgBytes += du.length;
        rows.push({
          name: `${s.name || s.id} / ${imgEntry.name || imgEntry.id}`,
          what: "image.dataUrl",
          mb: (du.length / 1024 / 1024).toFixed(1),
        });
      }
    });
    const mu = s.markups ? JSON.stringify(s.markups).length : 0;
    if (mu > 1000)
      rows.push({
        name: s.name || s.id,
        what: "markups",
        mb: (mu / 1024 / 1024).toFixed(1),
      });
    const nu = s.norms ? JSON.stringify(s.norms).length : 0;
    if (nu > 1000)
      rows.push({
        name: s.name || s.id,
        what: "norms",
        mb: (nu / 1024 / 1024).toFixed(1),
      });
    const fu = s.formulas ? JSON.stringify(s.formulas).length : 0;
    if (fu > 1000)
      rows.push({
        name: s.name || s.id,
        what: "formulas",
        mb: (fu / 1024 / 1024).toFixed(1),
      });
    const mu2 = s.meta ? JSON.stringify(s.meta).length : 0;
    if (mu2 > 1000)
      rows.push({
        name: s.name || s.id,
        what: "meta",
        mb: (mu2 / 1024 / 1024).toFixed(1),
      });
  });

  // Research studies
  const rs = project.researchStudies || [];
  rs.forEach((r, i) => {
    const ru = JSON.stringify(r).length;
    if (ru > 10000)
      rows.push({
        name: r.name || "study[" + i + "]",
        what: "researchStudy",
        mb: (ru / 1024 / 1024).toFixed(1),
      });
  });

  // Everything else
  const subs = project.subjects || [];
  const rest = { subjects: subs, meta: project.meta || {} };
  const restBytes = JSON.stringify(rest).length;

  const imgMB = (totalImgBytes / 1024 / 1024).toFixed(1);
  const rsMB = rows
    .filter((r) => r.what === "researchStudy")
    .reduce((s, r) => s + parseFloat(r.mb), 0)
    .toFixed(1);
  const otherMB = (restBytes / 1024 / 1024).toFixed(1);

  rows.sort((a, b) => parseFloat(b.mb) - parseFloat(a.mb));
  const grandTotal =
    totalImgBytes +
    rs.reduce((s, r) => s + JSON.stringify(r).length, 0) +
    restBytes;
  return {
    rows,
    imgMB,
    rsMB,
    otherMB,
    grandTotalMB: (grandTotal / 1024 / 1024).toFixed(1),
  };
}

// `project` must carry its image data (hydrateProjectImages fills in images
// the case records leave out).
function exportCephx(project) {
  profileProject(project);
  const json = JSON.stringify(buildCephxPayload(project));
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(project.name || "project").replace(/\s+/g, "_")}.cephx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function importCephx(file, onLoad, onBackup) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      logError("Cephx import error:", err);
      notify("Cannot open the file — it is not valid JSON.", { tone: "err" });
      return;
    }
    if (isBackupPayload(parsed)) {
      const res = parseBackupPayload(parsed);
      if (!res.ok) notify(res.error, { tone: "err" });
      else onBackup?.(res);
      return;
    }
    const res = importCephxPayload(parsed);
    if (!res.ok) {
      notify(res.error, { tone: "err" });
      return;
    }
    onLoad(res.project);
    if (res.warnings && res.warnings.length) {
      showInfo({ title: "Imported with notes", items: res.warnings });
    }
  };
  reader.onerror = () => {
    logError("Cephx file read failed:", reader.error);
    notify("Could not read the file.", { tone: "err" });
  };
  reader.readAsText(file);
}
function exportCepht(template, version = "1.0") {
  const payload = {
    format: "cepht",
    version,
    exported: Date.now(),
    ...template,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
  a.download = `${template.name.replace(/\s+/g, "_")}.cepht`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function exportTemplateAsCepht(project, name, includeCoord) {
  const session =
    project.sessions?.find((s) => s.id === project.activeSessionId) ||
    project.sessions?.[0];
  const allMarkups = session?.markups || [];
  const markupsToExport = allMarkups.map((m) => {
    if (includeCoord) return { ...m, placed: m.placed !== false };
    const { points: _pts, placed: _p, ...rest } = m;
    return rest;
  });
  const template = {
    name,
    projection: project.projection,
    markups: markupsToExport,
    formulas: session?.formulas || [],
    norms: session?.norms || [],
  };
  exportCepht(template, includeCoord ? "2.0" : "1.0");
}
function hasPlacedCoords(markups) {
  return markups.some(
    (m) =>
      m.points &&
      m.points.length > 0 &&
      !m.points.every(
        (p) =>
          Math.abs((p.x || 0) + 99999) < 1 && Math.abs((p.y || 0) + 99999) < 1,
      ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════

const CALIB_MODES = [["ruler", "From Ruler"], ["ticks", "Detect Ticks"], ["manual", "Manual px/mm"]];

function CalibModal({ t, calibration, onFinish, rulerLabel, rulerCount, onDetectTicks, onApplyTicks }) {
  const [mm, setMm] = useState(String(calibration.knownMm || "10"));
  const [ppm, setPpm] = useState(String(calibration.pxPerMm || "1"));
  const [mode, setMode] = useState("ruler");
  const [guideKey, setGuideKey] = useState(null);
  const [tickMm, setTickMm] = useState(1);
  const [ticks, setTicks] = useState(null);
  return (
    <div>
      {calibration.done && calibration.method === "dicom" && (
        <div style={{ fontSize: 12, color: calibration.magnificationCorrected ? t.tx2 : t.warn, marginBottom: 12, lineHeight: 1.5 }}>
          Now calibrated from the DICOM file ({calibration.source}): {calibration.pxPerMm.toFixed(4)} px/mm.
          {!calibration.magnificationCorrected && " Measured at the detector, so radiographic magnification is included."}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {CALIB_MODES.map(([m, label]) => (
          <Btn
            key={m}
            t={t}
            small
            active={mode === m}
            onClick={() => setMode(m)}
          >
            {label}
          </Btn>
        ))}
        <GuideBtn t={t} onClick={() => setGuideKey("calibration")} style={{ marginLeft: "auto" }} />
      </div>
      {mode === "ticks" ? (
        <>
          <div style={{ fontSize: 13, color: t.tx2, marginBottom: 12, lineHeight: 1.6 }}>
            Draw a ruler line (⟺ key) along the radiographic ruler&apos;s tick marks, over at least 8 ticks.
            The spacing of the ticks is then measured automatically.
          </div>
          <PropRow label="Tick spacing" t={t}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0.5, 1, 2].map((v) => (
                <Chip key={v} t={t} on={tickMm === v} onClick={() => { setTickMm(v); setTicks(null); }}>{v} mm</Chip>
              ))}
            </div>
          </PropRow>
          <Btn t={t} onClick={() => setTicks(onDetectTicks(tickMm))} style={{ width: "100%", marginTop: 8 }}>
            Detect ticks
          </Btn>
          {ticks?.error && (
            <div role="alert" style={{ fontSize: 12, color: t.warn, marginTop: 10, lineHeight: 1.5 }}>{ticks.error}</div>
          )}
          {ticks && !ticks.error && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: t.tx, lineHeight: 1.5 }}>
                {ticks.ticks} ticks, one every {ticks.period.toFixed(2)} px:{" "}
                <strong style={{ color: t.ok, fontFamily: "'DM Mono',monospace" }}>{ticks.pxPerMm.toFixed(3)} px/mm</strong>
              </div>
              <div style={{ fontSize: 12, color: ticks.confidence < 0.4 ? t.warn : t.tx3, marginTop: 2 }}>
                Pattern match {Math.round(ticks.confidence * 100)}%{ticks.confidence < 0.4 ? " — check the line follows the ticks" : ""}
              </div>
              <Btn t={t} onClick={() => onApplyTicks(ticks)} style={{ width: "100%", marginTop: 10 }}>
                Set Calibration
              </Btn>
            </div>
          )}
          <div style={{ fontSize: 12, color: t.tx3, marginTop: 8, lineHeight: 1.5 }}>
            Magnification: a ruler at the midsagittal plane gives anatomical size; one at the detector includes the 8–15% magnification.
          </div>
        </>
      ) : mode === "ruler" ? (
        <>
          <div
            style={{
              fontSize: 13,
              color: t.tx2,
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            Draw a ruler on the image (⟺ key), then enter its real-world length.
          </div>
          {rulerLabel && (
            <div style={{ fontSize: 12, color: t.ok, marginBottom: 8 }}>
              Using ruler: <strong>{rulerLabel}</strong>
            </div>
          )}
          {!rulerLabel && rulerCount > 1 && (
            <div style={{ fontSize: 12, color: t.warn, marginBottom: 8 }}>
              ⚠ Multiple rulers found — draw a fresh ruler or delete extra
              rulers to avoid ambiguity.
            </div>
          )}
          <PropRow label="Distance (mm)" t={t}>
            <input
              type="number"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              min="1"
              style={{
                background: t.surf2,
                border: `1px solid ${t.bdr}`,
                borderRadius: 6,
                padding: "6px 10px",
                color: t.tx,
                fontSize: 14,
                width: "90%",
                fontFamily: "'DM Mono',monospace",
              }}
            />
          </PropRow>
          <div style={{ fontSize: 12, color: t.tx3, marginTop: 8 }}>
            2D cephalometric radiographs carry ~8–15% magnification. Ensure the
            ruler distance reflects the actual image scale (not CBCT).
          </div>
          <Btn
            t={t}
            onClick={() => onFinish(parseFloat(mm))}
            style={{ width: "100%", marginTop: 12 }}
          >
            Set Calibration
          </Btn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.tx2, marginBottom: 16 }}>
            Enter px/mm directly. DICOM images are calibrated automatically when the file has a pixel spacing.
          </div>
          {calibration.done && (
            <div style={{ fontSize: 12, color: t.ok, marginBottom: 10 }}>
              Current: {calibration.pxPerMm.toFixed(4)} px/mm
            </div>
          )}
          <PropRow label="px / mm" t={t}>
            <input
              type="number"
              value={ppm}
              onChange={(e) => setPpm(e.target.value)}
              step="0.001"
              min="0.001"
              style={{
                background: t.surf2,
                border: `1px solid ${t.bdr}`,
                borderRadius: 6,
                padding: "6px 10px",
                color: t.tx,
                fontSize: 14,
                width: "90%",
                fontFamily: "'DM Mono',monospace",
              }}
            />
          </PropRow>
          <div style={{ fontSize: 12, color: t.tx3, marginTop: 8 }}>
            2D cephalograms have ~8–15% inherent magnification. CBCT-derived
            px/mm is more accurate for linear measurements.
          </div>
          <Btn
            t={t}
            onClick={() => onFinish(parseFloat(mm), parseFloat(ppm))}
            style={{ width: "100%", marginTop: 12 }}
          >
            Apply
          </Btn>
        </>
      )}
      {guideKey && (
        <PanelGuideModal
          t={t}
          guideKey={guideKey}
          onClose={() => setGuideKey(null)}
        />
      )}
    </div>
  );
}

function TextModal({ t, onConfirm, onCancel, defaultColor }) {
  const [txt, setTxt] = useState("Label");
  const [fontSize, setFontSize] = useState(14);
  const [bold, setBold] = useState(false);
  const [color, setColor] = useState(defaultColor || "#38bdf8");
  return (
    <div>
      <PropRow label="Text" t={t}>
        <Inp value={txt} onChange={setTxt} t={t} />
      </PropRow>
      <PropRow label="Size" t={t}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="range"
            min={8}
            max={48}
            value={fontSize}
            onChange={(e) => setFontSize(+e.target.value)}
            style={{ flex: 1, accentColor: t.acc }}
          />
          <span
            style={{
              fontSize: 11,
              color: t.tx2,
              fontFamily: "'DM Mono',monospace",
              width: 30,
            }}
          >
            {fontSize}px
          </span>
        </div>
      </PropRow>
      <PropRow label="Bold" t={t}>
        <input
          type="checkbox"
          checked={bold}
          onChange={(e) => setBold(e.target.checked)}
          style={{ accentColor: t.acc }}
        />
      </PropRow>
      <PropRow label="Color" t={t}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{
            width: 40,
            height: 28,
            border: "none",
            cursor: "pointer",
            borderRadius: 4,
          }}
        />
      </PropRow>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Btn
          t={t}
          onClick={() => onConfirm(txt, { fontSize, bold, color })}
          style={{ flex: 1 }}
        >
          Add
        </Btn>
        <Btn t={t} onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

function FormulaEditor({ t, formula, scope, onSave, onClose }) {
  const [name, setName] = useState(formula?.name || "");
  const [latex, setLatex] = useState(formula?.latex || "");
  const [expr, setExpr] = useState(formula?.expression || "");
  const [unit, setUnit] = useState(formula?.unit || "");
  const [unitCustom, setUnitCustom] = useState("");
  const [desc, setDesc] = useState(formula?.description || "");
  const [bigLatex, setBigLatex] = useState(null);
  const [showFx, setShowFx] = useState(false);
  const inputRef = useRef(null);
  const formulaReady = useFormulaEngine();
  const preview = useMemo(() => (formulaReady ? evalFormula(expr, scope) : null), [expr, scope, formulaReady]);
  const missing = useMemo(() => getMissingVars(expr, scope), [expr, scope]);

  const groups = useMemo(() => {
    const cats = {
      Angles: [],
      Lengths: [],
      Points: [],
      Polygons: [],
      Other: [],
    };
    Object.keys(scope).forEach((k) => {
      if (k.endsWith("_angle")) cats.Angles.push(k);
      else if (k.endsWith("_length")) cats.Lengths.push(k);
      else if (k.endsWith("_x") || k.endsWith("_y")) cats.Points.push(k);
      else if (k.endsWith("_area") || k.endsWith("_perimeter"))
        cats.Polygons.push(k);
      else cats.Other.push(k);
    });
    return Object.entries(cats).filter(([, vs]) => vs.length > 0);
  }, [scope]);

  const insertVar = (varName) => {
    const el = inputRef.current;
    if (!el) {
      setExpr((prev) => prev + varName);
      return;
    }
    const start = el.selectionStart ?? expr.length;
    const end = el.selectionEnd ?? expr.length;
    setExpr((prev) => prev.slice(0, start) + varName + prev.slice(end));
    setTimeout(() => {
      el.focus();
      const p = start + varName.length;
      el.setSelectionRange(p, p);
    }, 0);
  };
  const handleSelect = (cat, e) => {
    const v = e.target.value;
    if (v && v !== "__placeholder") insertVar(v);
    e.target.value = "__placeholder";
  };

  const UNIT_OPTIONS = [
    { value: "", label: "None" },
    { value: "°", label: "Degrees (°)" },
    { value: "mm", label: "Millimeters (mm)" },
    { value: "mm²", label: "Square mm (mm²)" },
    { value: "mm³", label: "Cubic mm (mm³)" },
    { value: "%", label: "Percent (%)" },
    { value: "ratio", label: "Ratio" },
    { value: "°_mm", label: "°/mm" },
    { value: "__custom__", label: "Custom…" },
  ];
  const isCustomUnit =
    unit === "__custom__" ||
    (!!unit && !UNIT_OPTIONS.some((o) => o.value === unit));
  const displayUnit = isCustomUnit ? unitCustom || unit : unit;

  const selectStyle = {
    background: t.surf3,
    border: `1px solid ${t.bdr}`,
    borderRadius: 4,
    padding: "4px 6px",
    color: t.tx,
    fontSize: 11,
    fontFamily: "'DM Mono',monospace",
    width: "100%",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div>
      <PropRow label="Name" t={t}>
        <Inp
          value={name}
          onChange={setName}
          t={t}
          placeholder="e.g. ANB Angle"
        />
      </PropRow>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: t.tx2, marginBottom: 3 }}>
          LaTeX display
        </div>
        <Inp
          value={latex}
          onChange={setLatex}
          t={t}
          placeholder="\angle ANB = \angle SNA - \angle SNB"
        />
        {latex && (
          <div
            onClick={() => setBigLatex(latex)}
            style={{
              background: t.surf2,
              border: `1px solid ${t.bdr}`,
              borderRadius: 6,
              padding: "8px 12px",
              marginTop: 6,
              cursor: "pointer",
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <KatexSpan latex={latex} />
            <span style={{ fontSize: 9, color: t.tx3, marginLeft: "auto" }}>
              click to enlarge ↗
            </span>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: t.tx2,
            marginBottom: 3,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Expression (mathjs)
          <span
            onClick={() => setShowFx(!showFx)}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: t.acc,
              cursor: "pointer",
              background: t.accMuted,
              borderRadius: 3,
              padding: "1px 6px",
              fontFamily: "'DM Mono',monospace",
            }}
          >
            fx
          </span>
        </div>
        {showFx && (
          <div
            style={{
              background: t.surf2,
              border: `1px solid ${t.bdr}`,
              borderRadius: 6,
              padding: "8px 10px",
              marginBottom: 6,
              fontSize: 10,
              lineHeight: 1.7,
              color: t.tx2,
            }}
          >
            <b style={{ color: t.tx }}>Operators:</b> + - * / ^ %<br />
            <b style={{ color: t.tx }}>Functions:</b> sin(), cos(), tan(),
            asin(), acos(), atan(), atan2(y,x)
            <br />
            <span style={{ marginLeft: 50 }} />
            abs(), sqrt(), exp(), log(), log2(), log10()
            <br />
            <span style={{ marginLeft: 50 }} />
            ceil(), floor(), round(), min(a,b), max(a,b), pow(x,y)
            <br />
            <b style={{ color: t.tx }}>Constants:</b> pi, e
          </div>
        )}
        <Inp
          ref={inputRef}
          value={expr}
          onChange={setExpr}
          t={t}
          placeholder="SNA_angle - SNB_angle"
        />
        {groups.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, color: t.tx3 }}>Insert a variable:</div>
            {groups.map(([cat, vars]) => (
              <div
                key={cat}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: t.tx2,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    width: 60,
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {cat}
                </div>
                <select
                  style={selectStyle}
                  onChange={(e) => handleSelect(cat, e)}
                  defaultValue="__placeholder"
                >
                  <option value="__placeholder" disabled>
                    Select {cat.toLowerCase()}…
                  </option>
                  {vars.map((v) => (
                    <option key={v} value={v}>
                      {v}{" "}
                      {scope[v] !== undefined
                        ? `(${typeof scope[v] === "number" ? scope[v].toFixed(2) : scope[v]})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 8px",
          background:
            preview !== null ? t.ok + "11" : expr ? t.err + "11" : t.surf2,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: t.tx2 }}>Preview</span>
        <span
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 13,
            fontWeight: 700,
            color: preview !== null ? t.ok : expr ? t.err : t.tx3,
          }}
        >
          {preview !== null
            ? `${preview.toFixed(2)} ${displayUnit}`
            : expr
              ? missing.length > 0
                ? `Unknown: ${missing.join(", ")}`
                : "Error"
              : "—"}
        </span>
      </div>
      <PropRow label="Unit" t={t}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            width: "100%",
          }}
        >
          <select
            style={selectStyle}
            value={isCustomUnit ? "__custom__" : unit}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setUnit("__custom__");
                setUnitCustom("");
              } else {
                setUnit(e.target.value);
                setUnitCustom("");
              }
            }}
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {isCustomUnit && (
            <Inp
              value={unitCustom || (unit !== "__custom__" ? unit : "")}
              onChange={(v) => setUnitCustom(v)}
              t={t}
              placeholder="e.g. pixels"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          )}
        </div>
      </PropRow>
      <PropRow label="Notes" t={t}>
        <Inp value={desc} onChange={setDesc} t={t} placeholder="Reference" />
      </PropRow>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn
          t={t}
          onClick={() =>
            onSave({
              id: formula?.id || uid(),
              name,
              latex,
              expression: expr,
              unit: displayUnit,
              description: desc,
            })
          }
          style={{ flex: 1 }}
          disabled={!name || !expr}
        >
          Save
        </Btn>
        <Btn t={t} onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </Btn>
      </div>
      {bigLatex && (
        <LatexFloatingPanel
          latex={bigLatex}
          onClose={() => setBigLatex(null)}
        />
      )}
    </div>
  );
}
function MobileMorePanel({
  t,
  panels,
  panelIcons,
  onSelect,
  theme,
  setTheme,
  onSaveProject,
  dispatch,
}) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () =>
      setIsFs(
        !!(document.fullscreenElement || document.webkitFullscreenElement),
      );
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    onChange();
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        exit?.call(document);
      } else {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const p = req?.call(el);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      /* fullscreen unavailable */
    }
  };
  const actionBtn = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "16px 8px",
    background: t.surf2,
    borderRadius: 10,
    cursor: "pointer",
    color: t.tx,
    border: "1px solid transparent",
    transition: "background 0.15s",
  };
  return (
    <div style={{ padding: "12px 16px 16px" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: t.tx2,
          marginBottom: 12,
        }}
      >
        More Tools
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(84px,1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          onClick={onSaveProject}
          style={actionBtn}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.surf3)}
          onMouseLeave={(e) => (e.currentTarget.style.background = t.surf2)}
        >
          <span
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              color: t.acc,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 -960 960 960"
              width="20"
              fill={t.tx}
            >
              <path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM565-275q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z" />
            </svg>
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>
            Save
          </span>
        </button>
        <button
          onClick={() =>
            dispatch({ type: "SET", payload: { showExport: true } })
          }
          style={actionBtn}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.surf3)}
          onMouseLeave={(e) => (e.currentTarget.style.background = t.surf2)}
        >
          <span
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              color: t.acc,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 -960 960 960"
              width="20"
              fill={t.tx}
            >
              <path d="M160-80v-80h640v80H160Zm320-160L200-600h160v-280h240v280h160L480-240Zm0-130 116-150h-76v-280h-80v280h-76l116 150Zm0-150Z" />
            </svg>
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>
            Export
          </span>
        </button>
        <button
          onClick={() =>
            dispatch({ type: "SET", payload: { showNormogram: true } })
          }
          style={actionBtn}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.surf3)}
          onMouseLeave={(e) => (e.currentTarget.style.background = t.surf2)}
        >
          <span
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              color: t.acc,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 -960 960 960"
              width="20"
              fill={t.tx}
            >
              <path d="M200-120q-33 0-56.5-23.5T120-200v-640h80v640h640v80H200Zm40-120v-360h160v360H240Zm200 0v-560h160v560H440Zm200 0v-200h160v200H640Z" />
            </svg>
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>
            Normogram
          </span>
        </button>
        <button
          onClick={toggleFullscreen}
          style={{
            ...actionBtn,
            background: isFs ? t.acc + "22" : t.surf2,
            border: `1px solid ${isFs ? t.acc : t.bdr}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.surf3)}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isFs ? t.acc + "22" : t.surf2;
          }}
        >
          <span
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              color: t.acc,
            }}
          >
            {isFs ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20"
                viewBox="0 0 24 24"
                width="20"
                fill={t.tx}
              >
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20"
                viewBox="0 0 24 24"
                width="20"
                fill={t.tx}
              >
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>
            {isFs ? "Restore" : "Fullscreen"}
          </span>
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          padding: "0 2px",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.tx3,
            letterSpacing: "0.8px",
          }}
        >
          THEME
        </span>
        {Object.values(THEMES).map((th) => (
          <button
            key={th.id}
            onClick={() => setTheme(th.id)}
            title={th.name}
            aria-label={th.name}
            aria-pressed={theme === th.id}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border:
                theme === th.id ? `2px solid ${t.acc}` : `1px solid ${t.bdr}`,
              background: th.bg,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: th.acc,
              }}
            />
          </button>
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: t.tx3,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 8,
        }}
      >
        Panels
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 8,
        }}
      >
        {panels.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "16px 8px",
              background: t.surf2,
              borderRadius: 10,
              cursor: "pointer",
              color: t.tx,
              border: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.surf3)}
            onMouseLeave={(e) => (e.currentTarget.style.background = t.surf2)}
          >
            <span
              style={{
                height: 24,
                display: "flex",
                alignItems: "center",
                color: t.acc,
              }}
            >
              {panelIcons[key]}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════
// Covers a session whose tracing is sealed by a blinded reliability study. The
// seal can only be broken explicitly (two clicks), and the break is logged on
// the study and reported with its results.
function SealedSessionCover({ t, seal, onOpenResearch, onUnseal }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sealed session"
      style={{ position: "fixed", inset: 0, zIndex: 50, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ maxWidth: 460, padding: 24, borderRadius: 12, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Icon name="lock" size={18} color={t.acc} /> Sealed for blinding</div>
        <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.6 }}>
          {seal.reason.replace(/\.$/, "")} (study “{seal.studyName}”). Continue with the next tracing from the study’s workflow.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onOpenResearch} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: t.acc, color: t.bg, fontWeight: 700, cursor: "pointer" }}>
            Back to the study
          </button>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${t.err}88`, background: "transparent", color: t.err, cursor: "pointer" }}>
              Break the seal…
            </button>
          ) : (
            <button onClick={onUnseal} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: t.err, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Unseal — this is recorded in the study
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Workspace({
  project,
  onUpdateProject,
  onHome,
  t,
  theme,
  setTheme,
  onSave,
  onImport,
  onBackup,
  onDrive,
}) {
  // ══════════════════════════════════════
  // CANVAS + REFS
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const procCache = useRef(new Map());
  const imgRefs = useRef({});
  const rafRef = useRef(null);
  // F1: pointer state lives in refs (not reducer state) so mousemove skips React re-render
  const mousePosRef = useRef(null);
  const snapPosRef = useRef(null);
  const flashMarkupIdRef = useRef(null);
  const flashStartTimeRef = useRef(0);
  const boxSelectRectRef = useRef(null);
  const panRef = useRef({ x: 40, y: 40 });
  const zoomRef = useRef(1);
  // F2: device-pixel-ratio for crisp HiDPI rendering (capped at 2 to bound per-frame fill cost)
  const dprRef = useRef(Math.max(1, Math.min(window.devicePixelRatio || 1, 2)));
  // F4: offscreen canvas for static content (image+markups) — blitted on mousemove
  const staticDirtyRef = useRef(true);
  // F8: rAF handle for ResizeObserver coalescing
  const resizeRafRef = useRef(null);

  const themeRef = useRef(t);
  themeRef.current = t;

  // file input refs
  const openImgRef = useRef(null);
  const stackImgRef = useRef(null);
  const importRef = useRef(null);

  const dispatch = useStoreDispatch();
  const selectedId = useToolStore((s) => s.selectedId);
  const selectedIds = useToolStore((s) => s.selectedIds);
  const replacingId = useToolStore((s) => s.replacingId);
  const currentDraw = useToolStore((s) => s.currentDraw);
  const activeTool = useToolStore((s) => s.activeTool);
  const snapEnabled = useToolStore((s) => s.snapEnabled);
  const placingMode = useToolStore((s) => s.placingMode);
  const placingQueue = useToolStore((s) => s.placingQueue);
  const placingIdx = useToolStore((s) => s.placingIdx);
  const loadingImages = useToolStore((s) => s.loadingImages);
  const spotlightMode = useToolStore((s) => s.spotlightMode);

  const showScaleBar = useUIStore((s) => s.showScaleBar);
  const showDefTooltips = useUIStore((s) => s.showDefTooltips);
  const showLUT = useUIStore((s) => s.showLUT);
  const showHistogram = useUIStore((s) => s.showHistogram);
  const showAnnotations = useUIStore((s) => s.showAnnotations);
  const annotationSize = useUIStore((s) => s.annotationSize);
  const showDisplacement = useUIStore((s) => s.showDisplacement);
  const showGroupsLegend = useUIStore((s) => s.showGroupsLegend);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const showCalib = useUIStore((s) => s.showCalib);
  const pendingRuler = useUIStore((s) => s.pendingRuler);
  const showExport = useUIStore((s) => s.showExport);
  const showAnon = useUIStore((s) => s.showAnon);
  const showNormogram = useUIStore((s) => s.showNormogram);
  const pendingTextPos = useUIStore((s) => s.pendingTextPos);
  const showFormulaEditor = useUIStore((s) => s.showFormulaEditor);
  const editFormulaId = useUIStore((s) => s.editFormulaId);
  const showMobilePanel = useUIStore((s) => s.showMobilePanel);
  const mobileTab = useUIStore((s) => s.mobileTab);
  const mobileToolsExpanded = useUIStore((s) => s.mobileToolsExpanded);
  const toolbarPos = useUIStore((s) => s.toolbarPos);
  const toolbarDragging = useUIStore((s) => s.toolbarDragging);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const researchOpen = useUIStore((s) => s.researchOpen);
  const showSettings = useUIStore((s) => s.showSettings);
  const closeResearch = useCallback(() => useUIStore.setState({ researchOpen: false }), []);
  const rightPanelResizing = useUIStore((s) => s.rightPanelResizing);
  const displacementOverlay = useUIStore((s) => s.displacementOverlay);
  const refLandmark1 = useUIStore((s) => s.refLandmark1);
  const refLandmark2 = useUIStore((s) => s.refLandmark2);
  const overlayBlend = useUIStore((s) => s.overlayBlend);
  const overlayAlignMode = useUIStore((s) => s.overlayAlignMode);
  const overlayVectorScale = useUIStore((s) => s.overlayVectorScale);
  const showTrackingLines = useUIStore((s) => s.showTrackingLines);
  const showCpAlways = useUIStore((s) => s.showCpAlways);
  const showAnchorAlways = useUIStore((s) => s.showAnchorAlways);
  const defaultLineStyle = useUIStore((s) => s.defaultLineStyle);
  const defaultMarkupColor = useUIStore((s) => s.defaultMarkupColor);
  const defaultLineWidth = useUIStore((s) => s.defaultLineWidth);
  const autoHideLabels = useUIStore((s) => s.autoHideLabels);
  const annotationBold = useUIStore((s) => s.annotationBold);
  const snapTolerance = useUIStore((s) => s.snapTolerance);
  const compareSession = useUIStore((s) => s.compareSession);
  const showGrid = useUIStore((s) => s.showGrid);
  const showAirwayOverlay = useUIStore((s) => s.showAirwayOverlay);
  const showReportOptions = useUIStore((s) => s.showReportOptions);
  const filmstripOpen = useUIStore((s) => s.filmstripOpen);
  const guideKey = useUIStore((s) => s.guideKey);
  const reportSections = useUIStore((s) => s.reportSections);
  const reportTheme = useUIStore((s) => s.reportTheme);
  const reportClinicName = useUIStore((s) => s.reportClinicName);
  const reportClinicLogo = useUIStore((s) => s.reportClinicLogo);
  // Report options: session to compare with, studies to include (null = all),
  // and the generated PDF waiting in the preview.
  const [reportCompareId, setReportCompareId] = useState("");
  const [reportStudyIds, setReportStudyIds] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const pinnedFormulas = useUIStore((s) => s.pinnedFormulas);

  const markups = useSessionStore((s) => s.markups);
  const calibration = useSessionStore((s) => s.calibration);
  const norms = useSessionStore((s) => s.norms);
  const formulas = useSessionStore((s) => s.formulas);
  const processing = useSessionStore((s) => s.processing);
  const sessionImage = useSessionStore((s) => s.sessionImage);
  const fitToView = useCallback(() => {
    zoomRef.current = 1;
    dispatch({ type: "SET", payload: { zoom: 1 } });
    panRef.current = { x: 40, y: 40 };
    dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } });
  }, [dispatch]);
  const isMobile = useMediaQuery("(max-width: 1024px)"); // compact layout: phones + tablets (portrait/landscape)
  // C5: tablets keep the magnifier (useful with a stylus); phones have no room for it.
  const isPhone = useMediaQuery("(max-width: 640px)");

  // ─── Mobile sheet: share save logic + browser-back integration ───
  const handleSaveProject = useCallback(async () => {
    if (
      hasUnanonymizedPHI(project) &&
      !(await askConfirm({
        title: "Export with patient identifiers?",
        message: "This project still contains patient identifiers (name, DOB, age, etc.). Exporting will include them. Use the Export dialog for an anonymized export.",
        confirmLabel: "Export anyway",
        danger: true,
      }))
    )
      return;
    const patched = {
      ...project,
      sessions: project.sessions?.map((s) => ({
        ...s,
        images: s.images?.map((img) => ({
          ...img,
          dataUrl: imgRefs.current[img.id]?.src || img.dataUrl,
        })),
      })),
    };
    onSave?.(patched);
  }, [project, onSave]);
  const sheetBackRef = useRef(false);
  const sheetOpen = isMobile && mobileTab !== "canvas";
  useEffect(() => {
    if (!sheetOpen) return;
    window.history.pushState({ cephxSheet: true }, "");
    const onPop = () => {
      if (sheetBackRef.current) {
        sheetBackRef.current = false;
        return;
      }
      useUIStore.setState({ mobileTab: "canvas" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheetOpen]);
  const closeSheet = useCallback(() => {
    useUIStore.setState({ mobileTab: "canvas" });
    if (window.history.state?.cephxSheet) {
      sheetBackRef.current = true;
      window.history.back();
    }
  }, []);

  // ─── Stable setter helpers (passed as props to children) ───
  const setSelectedId = useCallback((v) => {
    useToolStore.setState({
      selectedId:
        typeof v === "function" ? v(useToolStore.getState().selectedId) : v,
    });
  }, []);
  const setActiveTool = useCallback((v) => {
    useToolStore.setState({ activeTool: v, currentDraw: null });
  }, []);
  const setRightPanel = useCallback(
    (v) => useUIStore.setState({ rightPanel: v }),
    [],
  );
  const setPlacingQueue = useCallback((v) => {
    useToolStore.setState({
      placingQueue:
        typeof v === "function" ? v(useToolStore.getState().placingQueue) : v,
    });
  }, []);
  const setShowLUT = useCallback((v) => {
    useUIStore.setState({
      showLUT: typeof v === "function" ? v(useUIStore.getState().showLUT) : v,
    });
  }, []);
  const setShowScaleBar = useCallback((v) => {
    useUIStore.setState({
      showScaleBar:
        typeof v === "function" ? v(useUIStore.getState().showScaleBar) : v,
    });
  }, []);
  const setShowHistogram = useCallback((v) => {
    useUIStore.setState({
      showHistogram:
        typeof v === "function" ? v(useUIStore.getState().showHistogram) : v,
    });
  }, []);
  const setShowDisplacement = useCallback((v) => {
    useUIStore.setState({
      showDisplacement:
        typeof v === "function" ? v(useUIStore.getState().showDisplacement) : v,
    });
  }, []);
  const setDisplacementOverlay = useCallback((v) => {
    useUIStore.setState({
      displacementOverlay:
        typeof v === "function"
          ? v(useUIStore.getState().displacementOverlay)
          : v,
    });
  }, []);
  const setRefLandmark1 = useCallback((v) => {
    useUIStore.setState({
      refLandmark1:
        typeof v === "function" ? v(useUIStore.getState().refLandmark1) : v,
    });
  }, []);
  const setRefLandmark2 = useCallback((v) => {
    useUIStore.setState({
      refLandmark2:
        typeof v === "function" ? v(useUIStore.getState().refLandmark2) : v,
    });
  }, []);
  const setOverlayBlend = useCallback((v) => {
    useUIStore.setState({
      overlayBlend:
        typeof v === "function" ? v(useUIStore.getState().overlayBlend) : v,
    });
  }, []);
  const setOverlayAlignMode = useCallback((v) => {
    useUIStore.setState({
      overlayAlignMode:
        typeof v === "function" ? v(useUIStore.getState().overlayAlignMode) : v,
    });
  }, []);
  const setOverlayVectorScale = useCallback((v) => {
    useUIStore.setState({
      overlayVectorScale:
        typeof v === "function"
          ? v(useUIStore.getState().overlayVectorScale)
          : v,
    });
  }, []);
  const setShowTrackingLines = useCallback((v) => {
    useUIStore.setState({
      showTrackingLines:
        typeof v === "function"
          ? v(useUIStore.getState().showTrackingLines)
          : v,
    });
  }, []);
  const setCompareSession = useCallback(
    (v) =>
      useUIStore.setState({
        compareSession:
          typeof v === "function" ? v(useUIStore.getState().compareSession) : v,
      }),
    [],
  );
  const setContextMenu = useCallback(
    (v) =>
      useUIStore.setState({
        contextMenu:
          typeof v === "function" ? v(useUIStore.getState().contextMenu) : v,
      }),
    [],
  );
  const setShowGrid = useCallback((v) => {
    useUIStore.setState({
      showGrid: typeof v === "function" ? v(useUIStore.getState().showGrid) : v,
    });
  }, []);
  const setShowAirwayOverlay = useCallback((v) => {
    useUIStore.setState({
      showAirwayOverlay:
        typeof v === "function"
          ? v(useUIStore.getState().showAirwayOverlay)
          : v,
    });
  }, []);
  const setShowGroupsLegend = useCallback((v) => {
    useUIStore.setState({
      showGroupsLegend:
        typeof v === "function" ? v(useUIStore.getState().showGroupsLegend) : v,
    });
  }, []);
  const setShowReportOptions = useCallback((v) => {
    useUIStore.setState({
      showReportOptions:
        typeof v === "function"
          ? v(useUIStore.getState().showReportOptions)
          : v,
    });
  }, []);
  const setFilmstripOpen = useCallback((v) => {
    useUIStore.setState({
      filmstripOpen:
        typeof v === "function" ? v(useUIStore.getState().filmstripOpen) : v,
    });
  }, []);
  const setGuideKey = useCallback(
    (v) => useUIStore.setState({ guideKey: v }),
    [],
  );
  const setReportSections = useCallback((v) => {
    useUIStore.setState({
      reportSections:
        typeof v === "function" ? v(useUIStore.getState().reportSections) : v,
    });
  }, []);
  const setPinnedFormulas = useCallback((v) => {
    useUIStore.setState({
      pinnedFormulas:
        typeof v === "function" ? v(useUIStore.getState().pinnedFormulas) : v,
    });
  }, []);

  const defaultSections = {
    cover: true,
    images: true,
    measurements: true,
    normograms: true,
    airway: true,
    research: true,
    formulas: true,
    interpretation: true,
  };

  const rightPanelWidthRef = useRef(rightPanelWidth);
  rightPanelWidthRef.current = rightPanelWidth;
  const toolbarPosRef = useRef(toolbarPos);
  toolbarPosRef.current = toolbarPos;
  // Panel collapse state — useRef + DOM manipulation to avoid canvas re-renders
  const collapsedRef = useRef(false);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const skipResizeRef = useRef(false);
  const syncCollapsed = () => {
    if (!panelRef.current) return;
    if (collapsedRef.current) {
      panelRef.current.style.width = "52px";
      if (contentRef.current) {
        contentRef.current.style.maxWidth = "0px";
        contentRef.current.style.opacity = "0";
      }
      if (toggleBtnRef.current) toggleBtnRef.current.innerText = "◀";
    } else {
      panelRef.current.style.width = rightPanelWidth + "px";
      if (contentRef.current) {
        contentRef.current.style.maxWidth = "800px";
        contentRef.current.style.opacity = "1";
      }
      if (toggleBtnRef.current) toggleBtnRef.current.innerText = "▶";
    }
  };
  useLayoutEffect(syncCollapsed);
  const toggleCollapsed = () => {
    collapsedRef.current = !collapsedRef.current;
    skipResizeRef.current = true;
    syncCollapsed();
    setTimeout(() => {
      skipResizeRef.current = false;
      const el = containerRef.current;
      if (el) {
        const c = canvasRef.current;
        if (c) {
          const dpr = dprRef.current;
          c.width = el.clientWidth * dpr;
          c.height = el.clientHeight * dpr;
          c.style.width = el.clientWidth + "px";
          c.style.height = el.clientHeight + "px";
          canvasSize.current = { w: el.clientWidth, h: el.clientHeight };
          staticDirtyRef.current = true;
          scheduleRedraw();
        }
      }
    }, 300);
  };

  useEffect(() => {
    if (!rightPanelResizing) return;
    const onMove = (e) => {
      const nw = Math.max(
        200,
        Math.min(500, rightPanelWidthRef.current + e.movementX),
      );
      rightPanelWidthRef.current = nw;
      dispatch({ type: "SET", payload: { rightPanelWidth: nw } });
    };
    const onUp = () =>
      dispatch({ type: "SET", payload: { rightPanelResizing: false } });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rightPanelResizing, dispatch]);

  useEffect(() => {
    if (!toolbarDragging) return;
    const onMove = (e) => {
      const np = {
        x: toolbarPosRef.current.x + e.movementX,
        y: toolbarPosRef.current.y + e.movementY,
      };
      toolbarPosRef.current = np;
      dispatch({ type: "SET", payload: { toolbarPos: np } });
    };
    const onUp = () =>
      dispatch({ type: "SET", payload: { toolbarDragging: false } });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [toolbarDragging, dispatch]);

  // ─── These must be declared before any useEffect that references them ──────
  // ══════════════════════════════════════
  // SESSION STATE
  const activeSession =
    project.sessions?.find((s) => s.id === project.activeSessionId) ||
    project.sessions?.[0];
  // Blinded reliability collection: is the session on screen sealed?
  const activeSeal = useMemo(
    () => (activeSession ? sessionSeal(project, activeSession.id) : null),
    [project, activeSession],
  );

  // Migration: legacy session.image -> session.images[]
  const legacyMigrationDoneRef = useRef(false);
  useEffect(() => {
    if (legacyMigrationDoneRef.current) return;
    if (!activeSession) return;
    if (activeSession.images?.length) return;
    const oldImg =
      activeSession.image ||
      project.images?.[0] ||
      project.sessions?.find((s) => s.image)?.image;
    if (oldImg) {
      const entry = oldImg.id
        ? oldImg
        : {
            id: uid(),
            name: "Imported",
            dataUrl: oldImg.dataUrl || oldImg,
            dx: 0,
            dy: 0,
            opacity: 1,
            blendMode: "normal",
            visible: true,
            color: "none",
            transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
          };
      onUpdateProject(
        updateSessionInProject(project, activeSession.id, {
          images: [entry],
          image: undefined,
        }),
      );
    }
    legacyMigrationDoneRef.current = true;
  }, [activeSession, project, onUpdateProject, activeSession?.id]);

  // ══════════════════════════════════════
  // DRAG + EVENT REFS
  const isPanning = useRef(false);
  const panStart = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(null);
  const dragStartState = useRef(null);
  const dragMid = useRef(null);
  const dragPtIdx = useRef(null);
  const multiDragIdsRef = useRef(null);

  const silhouetteAction = useRef(null);
  const hoveredPtRef = useRef(null);
  const mouseCanvasRef = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 800, h: 600 });
  const lastTapRef = useRef(0);

  // Auto-start placing mode when project has unplaced markups (from wizard)
  const placingInitRef = useRef(true);
  useEffect(() => {
    if (!placingInitRef.current) return;
    placingInitRef.current = false;
    const unplaced = markups.filter((m) => !m.placed && m.type === "point");
    if (unplaced.length > 0) {
      setPlacingQueue(unplaced.map((m) => m.id));
      dispatch({ type: "SET", payload: { placingIdx: 0 } });
      dispatch({ type: "SET", payload: { placingMode: true } });
      dispatch({ type: "SET", payload: { rightPanel: "markups" } });
    }
  }, [dispatch, markups, setPlacingQueue]);

  const lutMode = activeSession?.lutMode || "gray";
  const lutInvert = activeSession?.lutInvert || false;
  const analysisTemplate = activeSession?.analysisTemplate || "blank";
  // Read by the canvas redraw (labels for the active analysis only, B3).
  const analysisTemplateRef = useRef(analysisTemplate);
  useEffect(() => { analysisTemplateRef.current = analysisTemplate; }, [analysisTemplate]);
  // Session details first, then the case's patient details (New Case form).
  // "" is unknown, not age 0; sex accepts M/F/Male/Female.
  const patientSex = normalizeSex(activeSession?.meta?.sex) || normalizeSex(project?.meta?.gender);
  const patientAge = normalizeAge(activeSession?.meta?.age) ?? normalizeAge(project?.meta?.age);
  const selectedMarkup = markups.find((m) => m.id === selectedId);

  const groupOptions = useMemo(() => {
    const map = new Map();
    for (const m of markups) {
      if (!m.group || m.type !== "point") continue;
      const g = map.get(m.group) || {
        id: m.group,
        color: m.color || "",
        count: 0,
      };
      g.count++;
      map.set(m.group, g);
    }
    return [...map.values()];
  }, [markups]);

  const stageOptions = useMemo(() => {
    const set = new Set();
    for (const m of markups) {
      if (m.stage == null || m.stage === "") continue;
      set.add(String(m.stage));
    }
    return [...set];
  }, [markups]);

  const [userPresets, setUserPresets] = useState(() => loadNormLibrary());
  const handleSavePreset = useCallback((preset, mode) => {
    setUserPresets((prev) => {
      const next =
        mode === "update"
          ? prev.map((p) => (p.id === preset.id ? preset : p))
          : [...prev, preset];
      saveNormLibrary(next);
      return next;
    });
  }, []);
  const handleDeletePreset = useCallback((id) => {
    setUserPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveNormLibrary(next);
      return next;
    });
  }, []);

  const updSessionRef = useRef();
  updSessionRef.current = (patch) =>
    // Apply to the LATEST project (functional update), not the render's snapshot.
    // Two updSession calls in one tick (e.g. loadImageFile: images then
    // calibration) would otherwise both rebuild from the same stale project and
    // the second would clobber the first.
    onUpdateProject((prev) =>
      updateSessionInProject(prev, activeSession.id, patch),
    );
  const updSession = useCallback((patch) => {
    updSessionRef.current(patch);
    // Mirror project-side session writes back into the Zustand store so the canvas
    // (which renders from the store) reflects them immediately — e.g. keyboard delete,
    // template loads, lock/unlock/hide/clear all call updSession({markups}) directly.
    // Ref-equality guard in merge() breaks the store→project↔project→store loop.
    useSessionStore.getState().merge(patch);
  }, []);
  // ─── Two-way sync: session ↔ Zustand sessionStore ──────────────
  const lastSessionIdRef = useRef(null);
  useEffect(() => {
    const sid = activeSession?.id;
    if (sid && sid !== lastSessionIdRef.current) {
      lastSessionIdRef.current = sid;
      useSessionStore.getState().loadFromSession(activeSession);
    }
  }, [activeSession]);
  useEffect(() => {
    setSessionChangeHandler(() => {
      const s = useSessionStore.getState();
      updSession({
        markups: s.markups,
        calibration: s.calibration,
        norms: s.norms,
        formulas: s.formulas,
        processing: s.processing,
        angleMode: s.angleMode,
        facing: s.facing,
        lutMode: s.lutMode,
        lutInvert: s.lutInvert,
      });
    });
    return () => setSessionChangeHandler(null);
  }, [updSession]);
  const angleMode = activeSession?.angleMode || "signed-deg";
  const setAngleMode = (m) => updSession({ angleMode: m });
  // Profile direction for signed measures (ANB, Wits, E-line, convexity…).
  const facingSetting = activeSession?.facing || "auto";
  const setFacingSetting = (f) => updSession({ facing: f });
  const facing = useMemo(() => resolveFacing(facingSetting, markups), [facingSetting, markups]);
  const formatAngle = useCallback(
    (v) => {
      const [sign, unit] = angleMode.split("-");
      let val = v;
      if (sign === "abs") val = Math.abs(v);
      else if (sign === "simple") val = Math.abs(v);
      else if (sign === "reflex")
        val = Math.abs(v) > 180 ? Math.abs(v) : 360 - Math.abs(v);
      if (unit === "rad") return ((val * Math.PI) / 180).toFixed(4) + " rad";
      return val.toFixed(1) + "°";
    },
    [angleMode],
  );
  const pushUndo = useCallback(() => useSessionStore.getState().pushUndo(), []);
  // B6: undo/redo say what they did, with the opposite action on the toast.
  // `undoingRef` tells the push watcher below that these stack changes are not
  // new user actions.
  const undoingRef = useRef(false);
  const undoSteps = useCallback((k = 1) => {
    const st = useSessionStore.getState();
    const n = Math.min(k, st.undoStack.length);
    if (!n) return;
    const what = describeChange(st.undoStack[st.undoStack.length - 1], st.snapshot()).text;
    undoingRef.current = true;
    try { for (let i = 0; i < n; i++) useSessionStore.getState().undo(); } finally { undoingRef.current = false; }
    syncPlacingQueue();
    notify(n === 1 ? `Undone: ${what}` : `Undone ${n} steps`, { key: "undo", duration: 4000, action: { label: "Redo", onClick: () => redoStepsRef.current(n) } });
  }, []);
  const redoSteps = useCallback((k = 1) => {
    const st = useSessionStore.getState();
    const n = Math.min(k, st.redoStack.length);
    if (!n) return;
    undoingRef.current = true;
    try { for (let i = 0; i < n; i++) useSessionStore.getState().redo(); } finally { undoingRef.current = false; }
    syncPlacingQueue();
    const after = useSessionStore.getState();
    const what = describeChange(after.undoStack[after.undoStack.length - 1], after.snapshot()).text;
    notify(n === 1 ? `Redone: ${what}` : `Redone ${n} steps`, { key: "undo", duration: 4000, action: { label: "Undo", onClick: () => undoSteps(n) } });
  }, [undoSteps]);
  const redoStepsRef = useRef(redoSteps);
  useEffect(() => { redoStepsRef.current = redoSteps; }, [redoSteps]);
  const undo = useCallback(() => undoSteps(1), [undoSteps]);
  const redo = useCallback(() => redoSteps(1), [redoSteps]);
  // A deletion, move, multi-edit or calibration gets a "… · Undo" toast once it
  // settles (drags push their snapshot at mouse-up). Any newer action retires
  // the toast so its Undo never reverts something else.
  useEffect(() => {
    let timer = null;
    const unsub = useSessionStore.subscribe((s, prev) => {
      if (undoingRef.current || s.undoStack === prev.undoStack) return;
      if (!s.undoStack.length || s.undoStack.length < prev.undoStack.length) return;
      if (s.redoStack.length) return;
      dismissToastKey("undo");
      clearTimeout(timer);
      const depth = s.undoStack.length;
      timer = setTimeout(() => {
        const st = useSessionStore.getState();
        if (st.undoStack.length !== depth) return;
        const c = describeChange(st.undoStack[depth - 1], st.snapshot());
        if (isNotableChange(c)) notify(c.text, { key: "undo", action: { label: "Undo", onClick: () => { if (useSessionStore.getState().undoStack.length === depth) undoSteps(1); } } });
      }, 450);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [undoSteps]);
  const refreshAutoMeas = useCallback(
    (ms) => refreshAutoMeasurements(ms, calibration, facingSetting),
    [calibration, facingSetting],
  );
  const updMarkups = useCallback((fn) => {
    useSessionStore.getState().pushUndo();
    useSessionStore.getState().updMarkups(fn);
  }, []);
  const updMarkup = useCallback(
    (id, patch) => useSessionStore.getState().updMarkup(id, patch),
    [],
  );
  const delMarkup = useCallback(
    (id) => {
      useSessionStore.getState().delMarkup(id);
      if (selectedId === id)
        dispatch({ type: "SET", payload: { selectedId: null } });
    },
    [selectedId, dispatch],
  );
  // ══════════════════════════════════════
  // MARKUP CRUD
  const addMarkupRef = useRef();
  addMarkupRef.current = (partial) => {
    const store = useSessionStore.getState();
    const m = markupDefaults(partial, store.markups, t);
    store.addMarkup(m);
    dispatch({ type: "SET", payload: { selectedId: m.id } });
    return m;
  };
  const addMarkup = useCallback((partial) => addMarkupRef.current(partial), []);
  const finalizeMarkupRef = useRef();
  finalizeMarkupRef.current = (draw) => {
    const ms = useSessionStore.getState().markups;
    const D = {
      line: {
        color: t.acc,
        width: defaultLineWidth,
        style: defaultLineStyle,
        mode: "segment",
        label: `Line ${ms.filter((m) => m.type === "line").length + 1}`,
        showLength: true,
      },
      angle3: {
        color: "#f472b6",
        width: defaultLineWidth,
        label: `Angle ${ms.filter((m) => m.type === "angle3").length + 1}`,
      },
      angle4: {
        color: "#c084fc",
        width: defaultLineWidth,
        label: `Inc_Angle ${ms.filter((m) => m.type === "angle4").length + 1}`,
      },
      polygon: {
        strokeColor: t.acc,
        fillColor: t.acc + "22",
        strokeWidth: defaultLineWidth,
        label: `Polygon ${ms.filter((m) => m.type === "polygon").length + 1}`,
      },
      curve: {
        color: "#fb923c",
        width: defaultLineWidth,
        curveStyle:
          defaultLineStyle === "dashed"
            ? "dashed"
            : defaultLineStyle === "dotted"
              ? "dotted"
              : "solid",
        label: `Trace ${ms.filter((m) => m.type === "curve").length + 1}`,
      },
      polyline: {
        color: "#fb923c",
        width: defaultLineWidth,
        label: `Polyline ${ms.filter((m) => m.type === "polyline").length + 1}`,
      },
      perp: {
        color: "#a78bfa",
        width: defaultLineWidth,
        label: `Perp ${ms.filter((m) => m.type === "perp").length + 1}`,
      },
      ellipse: {
        color: "#60a5fa",
        width: defaultLineWidth,
        label: `Ellipse ${ms.filter((m) => m.type === "ellipse").length + 1}`,
      },
      arc: {
        color: "#fb923c",
        width: defaultLineWidth,
        label: `Arc ${ms.filter((m) => m.type === "arc").length + 1}`,
      },
      circle: {
        color: "#38bdf8",
        width: defaultLineWidth,
        label: `Circle ${ms.filter((m) => m.type === "circle").length + 1}`,
      },
      bezier: {
        color: "#c084fc",
        width: defaultLineWidth,
        cp: autoControlPoints(draw.points || []),
        label: `Bezier ${ms.filter((m) => m.type === "bezier").length + 1}`,
      },
      tangent: {
        color: "#f97316",
        width: defaultLineWidth,
        label: `Tangent ${ms.filter((m) => m.type === "tangent").length + 1}`,
      },
      concentric: {
        color: "#60a5fa",
        width: defaultLineWidth,
        count: 4,
        spacing: 0.3,
        label: `Concentric ${ms.filter((m) => m.type === "concentric").length + 1}`,
      },
    };
    const newMarkup = { ...(D[draw.type] || {}), ...draw };
    if (defaultMarkupColor) {
      if (newMarkup.fillColor !== undefined) {
        newMarkup.strokeColor = defaultMarkupColor;
        newMarkup.fillColor = defaultMarkupColor + "22";
      } else newMarkup.color = defaultMarkupColor;
    }
    if (draw.replacingId) {
      pushUndo();
      updMarkup(draw.replacingId, {
        points: draw.points,
        placed: true,
        curveStyle: draw.curveStyle,
      });
      dispatch({ type: "SET", payload: { replacingId: null } });
    } else {
      addMarkup(newMarkup);
    }
  };
  const finalizeMarkup = useCallback(
    (draw) => finalizeMarkupRef.current(draw),
    [],
  );

  const loadAirwayTier = useCallback(
    (landmarkLabels) => {
      const store = useSessionStore.getState();
      const airwayAnalysis = (PREDEFINED.lateral || []).find(
        (a) => a.name && a.name.toLowerCase().includes("airway"),
      );
      const defMap = {};
      if (airwayAnalysis) {
        airwayAnalysis.pts.forEach((pt) => {
          defMap[pt.l.toLowerCase()] = pt;
        });
      }
      const newMarkups = [];
      landmarkLabels.forEach((label) => {
        const alreadyPlaced = store.markups.some(
          (m) =>
            m.type === "point" &&
            m.label?.toLowerCase() === label.toLowerCase() &&
            m.placed &&
            m.visible !== false,
        );
        if (alreadyPlaced) return;
        const def = defMap[label.toLowerCase()];
        const id = uid();
        newMarkups.push({
          id,
          type: "point",
          points: [{ x: -99999, y: -99999 }],
          label,
          definition: def?.def || "",
          color: def?.color || t.acc,
          size: 6,
          visible: true,
          placed: false,
        });
      });
      if (!newMarkups.length) return;
      pushUndo();
      store.updMarkups(() => [...store.markups, ...newMarkups]);
      dispatch({
        type: "SET",
        payload: { placingQueue: newMarkups.map((m) => m.id) },
      });
      dispatch({ type: "SET", payload: { placingIdx: 0 } });
      dispatch({ type: "SET", payload: { placingMode: true } });
      dispatch({ type: "SET", payload: { rightPanel: "airway" } });
    },
    [t.acc, pushUndo, dispatch],
  );

  // load images — from dataUrl (just imported) or from IndexedDB (restored from auto-save)
  useEffect(() => {
    const pending = sessionImage.filter((imgE) => !imgRefs.current[imgE.id]);
    if (!pending.length) return;
    dispatch({ type: "SET", payload: { loadingImages: true } });
    let loaded = 0;
    const onLoad = (id, src) => {
      const img = new Image();
      img.onload = () => {
        imgRefs.current[id] = img;
        loaded++;
        if (loaded === pending.length)
          dispatch({ type: "SET", payload: { loadingImages: false } });
        scheduleRedraw();
      };
      img.onerror = () => {
        loaded++;
        if (loaded === pending.length)
          dispatch({ type: "SET", payload: { loadingImages: false } });
      };
      img.src = src;
    };
    pending.forEach((imgE) => {
      if (imgE.dataUrl) {
        onLoad(imgE.id, imgE.dataUrl);
      } else {
        getImageDataUrl(imgE.id).then((dataUrl) => {
          if (dataUrl) {
            onLoad(imgE.id, dataUrl);
          } else {
            loaded++;
            if (loaded === pending.length)
              dispatch({ type: "SET", payload: { loadingImages: false } });
          }
        });
      }
    });
  }, [sessionImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Window & level on the original pixels of 12–16-bit images (DICOM, TIFF):
  // a live preview replaces the image while the sliders move.
  const getSessionImages = useCallback(() => useSessionStore.getState().sessionImage, []);
  const onSourceChange = useCallback((id) => {
    for (const k of procCache.current.keys())
      if (k.startsWith(id + "-")) procCache.current.delete(k);
    staticDirtyRef.current = true;
    scheduleRedrawRef.current?.();
  }, []);
  const setLoadedImage = useCallback((id, img) => { imgRefs.current[id] = img; }, []);
  const sourceWindow = useSourceWindow({
    sessionImage,
    setLoadedImage,
    updSession,
    getImages: getSessionImages,
    onSourceChange,
  });
  const { previewFor } = sourceWindow;

  // ══════════════════════════════════════
  // CANVAS DRAW PIPELINE
  const getProcessed = useCallback((imgEntry) => {
    const p = useSessionStore.getState().processing;
    const lm = useSessionStore.getState().lutMode;
    const li = useSessionStore.getState().lutInvert;
    const pv = previewFor(imgEntry.id);
    const key = `${imgEntry.id}-${JSON.stringify(p)}-${lm}-${li}${pv ? `-pv${pv.version}` : ""}`;
    const cached = procCache.current.get(key);
    if (cached) return cached;
    const processed = processImageToCanvas(
      pv ? pv.canvas : imgRefs.current[imgEntry.id],
      p,
      lm,
      li,
    );
    // Don't cache a miss: the image may not be decoded yet (e.g. right after a
    // session switch). Caching null here would permanently hide the image even
    // after it loads.
    if (!processed) return null;
    for (const k of procCache.current.keys())
      if (k.startsWith(imgEntry.id + "-") && k !== key)
        procCache.current.delete(k);
    procCache.current.set(key, processed);
    staticDirtyRef.current = true;
    return processed;
  }, [previewFor]);

  // F7: clear processed-image cache when switching sessions
  useEffect(() => {
    procCache.current.clear();
  }, [activeSession?.id]);

  // F6: memoize histogram computation — avoid re-running on every render while histogram is open
  const histImgRef = sessionImage[0]
    ? imgRefs.current[sessionImage[0].id]
    : null;
  const histData = useMemo(() => computeHistogram(histImgRef), [histImgRef]);

  const toImage = useCallback(
    (sx, sy) => ({
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    }),
    [],
  );
  const getCanvasPos = useCallback((e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  // U2: zoom-to-landmark — when selecting from MarkupsPanel, pan viewport to center on the markup
  const flashRafRef = useRef(null);
  const flashTimerRef = useRef(null);
  const selectAndFocusMarkup = useCallback(
    (id, opts = {}) => {
      setSelectedId(id);
      if (!id) return;
      const m = useSessionStore.getState().markups.find((x) => x.id === id);
      if (!m) return;
      const pts = vpts(m);
      if (!pts.length) return;
      // B4: review zooms in (never out) so the point can be judged.
      if (opts.zoom && zoomRef.current < opts.zoom) {
        zoomRef.current = opts.zoom;
        dispatch({ type: "SET", payload: { zoom: opts.zoom } });
      }
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const cw = canvasSize.current.w,
        ch = canvasSize.current.h;
      const dpr = dprRef.current;
      const newPan = {
        x: cw / dpr / 2 - cx * zoomRef.current,
        y: ch / dpr / 2 - cy * zoomRef.current,
      };
      panRef.current = newPan;
      dispatch({ type: "SET", payload: { pan: newPan } });
      flashMarkupIdRef.current = id;
      flashStartTimeRef.current = performance.now();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        flashMarkupIdRef.current = null;
        flashTimerRef.current = null;
      }, 1500);
      if (flashRafRef.current) cancelAnimationFrame(flashRafRef.current);
      const _fl = () => {
        if (!flashMarkupIdRef.current) return;
        flashRafRef.current = requestAnimationFrame(_fl);
        scheduleRedrawRef.current();
      };
      flashRafRef.current = requestAnimationFrame(_fl);
    },
    [setSelectedId, dispatch],
  );

  // B4: step through landmarks that need checking (unreviewed AI points, lowest
  // confidence first, then points marked unsure). `confirmId` confirms that
  // point first.
  // B2: guided tracing — "unsure" is set for one queued landmark (by id), so
  // skipping or going back never carries it to another; the magnifier
  // preference is remembered.
  const [placingUnsureId, setPlacingUnsureId] = useState(null);
  const placingUnsureRef = useRef(null);
  useEffect(() => { placingUnsureRef.current = placingUnsureId; }, [placingUnsureId]);
  const [magnifierOn, setMagnifierOn] = useState(() => {
    try { return localStorage.getItem("cephalo_magnifier") !== "off"; } catch { return true; }
  });
  const toggleMagnifier = useCallback(() => {
    setMagnifierOn((v) => {
      try { localStorage.setItem("cephalo_magnifier", v ? "off" : "on"); } catch { /* storage blocked */ }
      return !v;
    });
  }, []);
  const endPlacing = useCallback(() => {
    dispatch({ type: "SET", payload: { placingMode: false, placingQueue: [], placingIdx: 0 } });
  }, [dispatch]);
  // Same behaviour as Esc / Backspace while placing.
  const placingSkip = useCallback(() => {
    const ts = useToolStore.getState();
    if (ts.placingIdx < ts.placingQueue.length - 1)
      dispatch({ type: "SET", payload: { placingIdx: ts.placingIdx + 1 } });
    else endPlacing();
  }, [dispatch, endPlacing]);
  const placingBack = useCallback(() => {
    const ts = useToolStore.getState();
    if (ts.placingIdx > 0) undo();
    else endPlacing();
  }, [undo, endPlacing]);

  const reviewNext = useCallback(
    (confirmId) => {
      const st = useSessionStore.getState();
      if (confirmId) {
        st.pushUndo();
        st.updMarkups((ms) => confirmPoint(ms, confirmId));
      }
      const current = confirmId || useToolStore.getState().selectedId;
      const next = nextToReview(useSessionStore.getState().markups, current);
      if (!next) {
        notify("All landmarks are reviewed.", { tone: "ok", key: "review" });
        return;
      }
      selectAndFocusMarkup(next, { zoom: 2.5 });
    },
    [selectAndFocusMarkup],
  );

  // F2+F8: ResizeObserver with DPR scaling and rAF coalescing
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (skipResizeRef.current) return;
      // F8: coalesce multiple resize frames into one rAF
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const el = containerRef.current;
        if (!el) return;
        const c = canvasRef.current;
        if (!c) return;
        const dpr = dprRef.current;
        c.width = el.clientWidth * dpr;
        c.height = el.clientHeight * dpr;
        c.style.width = el.clientWidth + "px";
        c.style.height = el.clientHeight + "px";
        canvasSize.current = { w: el.clientWidth, h: el.clientHeight };
        staticDirtyRef.current = true; // F4: canvas resized → rebuild static cache
        scheduleRedraw();
      });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const redraw = useCallback(() => {
    const ss = useSessionStore.getState();
    const ts = useToolStore.getState();
    const us = useUIStore.getState();
    const dc = {
      canvasRef,
      dprRef,
      mousePosRef,
      snapPosRef,
      boxSelectRectRef,
      panRef,
      zoomRef,
      mouseCanvasRef,
      flashMarkupIdRef,
      flashStartTimeRef,
      canvasSize,
      imgRefs,
      hoveredPtRef,
      drawMarkup,
      drawInProgress,
      drawScaleBar,
      drawLUTLegend,
      drawSnapIndicator,
      drawDisplacementVectors,
      drawAirwayOverlay,
      markups: ss.markups,
      calibration: ss.calibration,
      sessionImage: ss.sessionImage,
      selectedId: ts.selectedId,
      selectedIds: ts.selectedIds,
      currentDraw: ts.currentDraw,
      snapEnabled: ts.snapEnabled,
      angleMode: ss.angleMode,
      facing: resolveFacing(ss.facing, ss.markups),
      lutMode: ss.lutMode,
      lutInvert: ss.lutInvert,
      activeTool: ts.activeTool,
      t: themeRef.current,
      showScaleBar: us.showScaleBar,
      showDefTooltips: us.showDefTooltips,
      showLUT: us.showLUT,
      showAnnotations: us.showAnnotations,
      annotationSize: us.annotationSize,
      showDisplacement: us.showDisplacement,
      compareSession: us.compareSession,
      displacementOverlay: us.displacementOverlay,
      overlayBlend: us.overlayBlend,
      overlayAlignMode: us.overlayAlignMode,
      overlayVectorScale: us.overlayVectorScale,
      showTrackingLines: us.showTrackingLines,
      refLandmark1: us.refLandmark1,
      refLandmark2: us.refLandmark2,
      showCalib: us.showCalib,
      pendingRuler: us.pendingRuler,
      showGrid: us.showGrid,
      showAirwayOverlay: us.showAirwayOverlay,
      showCpAlways: us.showCpAlways,
      showAnchorAlways: us.showAnchorAlways,
      snapTolerance: us.snapTolerance,
      autoHideLabels: us.autoHideLabels,
      labelLayout: us.labelLayout,
      labelsActiveOnly: us.labelsActiveOnly,
      activeAnalysis: analysisTemplateRef.current,
      annotationBold: us.annotationBold,
      showGroupsLegend: us.showGroupsLegend,
      getProcessed,
      alignTwoPoints,
      silhouettes: SILHOUETTES,
    };
    createRedraw(dc)();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        redraw();
      });
  }, [redraw]);
  const scheduleRedraw = useCallback(() => {
    if (!rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        redraw();
      });
  }, [redraw]);
  const scheduleRedrawRef = useRef(scheduleRedraw);
  scheduleRedrawRef.current = scheduleRedraw;
  // W3: listen for image-processed events from the worker and trigger a redraw
  useEffect(() => {
    const onProcessed = () => scheduleRedrawRef.current();
    window.addEventListener("Cephalometry Studio:image-processed", onProcessed);
    return () =>
      window.removeEventListener(
        "Cephalometry Studio:image-processed",
        onProcessed,
      );
  }, []);

  // F9: central redraw watcher — restores the pre-Zustand "state change → redraw" trigger.
  // The Zustand refactor made `redraw` a stable useCallback([]) reading getState(), which
  // silently removed the auto-redraw that the old `useEffect([redraw])` provided. Subscribing
  // (without React re-renders) and scheduling a redraw whenever any canvas-affecting state
  // reference changes restores live feedback for selection, drawing previews, deletions and
  // display toggles.
  const lastRedrawStateRef = useRef(null);
  useEffect(() => {
    const pick = () => {
      const ss = useSessionStore.getState(),
        ts = useToolStore.getState(),
        us = useUIStore.getState();
      return {
        m: ss.markups,
        c: ss.calibration,
        i: ss.sessionImage,
        z: ts.zoom,
        p: ts.pan,
        cd: ts.currentDraw,
        sid: ts.selectedId,
        sids: ts.selectedIds,
        at: ts.activeTool,
        se: ts.snapEnabled,
        pr: ss.processing,
        lm: ss.lutMode,
        li: ss.lutInvert,
        am: ss.angleMode,
        fc: ss.facing,
        sg: us.showGrid,
        sb: us.showScaleBar,
        dt: us.showDefTooltips,
        an: us.showAnnotations,
        lut: us.showLUT,
        as: us.annotationSize,
        disp: us.showDisplacement,
        cmp: us.compareSession,
        aw: us.showAirwayOverlay,
        cpa: us.showCpAlways,
        ana: us.showAnchorAlways,
        tol: us.snapTolerance,
        al: us.autoHideLabels,
        ll: us.labelLayout,
        lao: us.labelsActiveOnly,
        ab: us.annotationBold,
        sgl: us.showGroupsLegend,
        ovd: us.displacementOverlay,
        ovb: us.overlayBlend,
        ovs: us.overlayVectorScale,
        ovm: us.overlayAlignMode,
        rl1: us.refLandmark1,
        rl2: us.refLandmark2,
        stl: us.showTrackingLines,
      };
    };
    lastRedrawStateRef.current = pick();
    const check = () => {
      const k = pick(),
        p = lastRedrawStateRef.current;
      let dirty = false;
      for (const kk in k) {
        if (k[kk] !== p[kk]) {
          dirty = true;
          break;
        }
      }
      if (dirty) {
        lastRedrawStateRef.current = k;
        scheduleRedrawRef.current();
      }
    };
    const u1 = useSessionStore.subscribe(check);
    const u2 = useToolStore.subscribe(check);
    const u3 = useUIStore.subscribe(check);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // U3: Keep redrawing while calibration modal is open (pulsing highlight animation)
  useEffect(() => {
    if (!showCalib || !pendingRuler) return;
    let raf;
    const loop = () => {
      scheduleRedrawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showCalib, pendingRuler]);

  // U4: When switching back to canvas on mobile, trigger a redraw (display:none→flex transition)
  useEffect(() => {
    if (isMobile && mobileTab === "canvas") {
      requestAnimationFrame(() => scheduleRedrawRef.current());
    }
  }, [isMobile, mobileTab]);

  // ══════════════════════════════════════
  // IMAGE LOADING
  const loadImage = useCallback(
    (file, addToStack = false) =>
      loadImageFile(file, addToStack, {
        // Read when the file is ready, so stacked files don't overwrite each other.
        getImages: () => useSessionStore.getState().sessionImage,
        dispatch,
        updSession,
        imgRefs,
        canvasSize,
        panRef,
        zoomRef,
      }),
    [dispatch, updSession, imgRefs, canvasSize, panRef, zoomRef],
  );

  const handleDrop = useCallback(
    (e) => {
      handleImageDrop(e, loadImage);
    },
    [loadImage],
  );

  useEffect(() => {
    const fn = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();
      const matched = KEYBINDINGS.find((b) => {
        if (b.ctrl && !ctrl) return false;
        if (b.shift && !shift) return false;
        return b.key === key;
      });
      if (matched) {
        switch (matched.id) {
          case "undo":
            undo();
            return;
          case "redo":
            redo();
            return;
          case "escape": {
            boxSelectRectRef.current = null;
            dispatch({
              type: "SET",
              payload: { currentDraw: null, selectedId: null, selectedIds: [] },
            });
            if (mobileToolsExpanded)
              dispatch({
                type: "SET",
                payload: { mobileToolsExpanded: false },
              });
            else if (placingMode) {
              if (placingIdx < placingQueue.length - 1)
                dispatch({
                  type: "SET",
                  payload: { placingIdx: placingIdx + 1 },
                });
              else {
                dispatch({ type: "SET", payload: { placingMode: false } });
                dispatch({ type: "SET", payload: { placingQueue: [] } });
                dispatch({ type: "SET", payload: { placingIdx: 0 } });
              }
            }
            return;
          }
          case "contextMenu": {
            e.preventDefault();
            const hitMarkup = selectedId || null;
            setContextMenu({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
              markupId: hitMarkup,
              imageX: 0,
              imageY: 0,
            });
            return;
          }
          case "placeUndo": {
            if (placingMode && placingQueue.length > 0) {
              if (placingIdx > 0) {
                undo();
              } else {
                dispatch({ type: "SET", payload: { placingMode: false } });
                dispatch({ type: "SET", payload: { placingQueue: [] } });
                dispatch({ type: "SET", payload: { placingIdx: 0 } });
              }
              return;
            }
            const idsToDelete = selectedIds.length
              ? selectedIds
              : selectedId
                ? [selectedId]
                : [];
            const ms = useSessionStore.getState().markups;
            const lockedIds = new Set(
              ms.filter((m) => m.locked).map((m) => m.id),
            );
            const filtered = idsToDelete.filter((id) => !lockedIds.has(id));
            if (filtered.length) {
              pushUndo();
              updSession({
                markups: refreshAutoMeas(
                  ms.filter((m) => !filtered.includes(m.id)),
                ),
              });
            }
            dispatch({
              type: "SET",
              payload: { selectedIds: [], selectedId: null },
            });
            return;
          }
          case "deleteSelected": {
            const idsToDelete = selectedIds.length
              ? selectedIds
              : selectedId
                ? [selectedId]
                : [];
            const ms = useSessionStore.getState().markups;
            const lockedIds = new Set(
              ms.filter((m) => m.locked).map((m) => m.id),
            );
            const filtered = idsToDelete.filter((id) => !lockedIds.has(id));
            if (filtered.length) {
              pushUndo();
              updSession({
                markups: refreshAutoMeas(
                  ms.filter((m) => !filtered.includes(m.id)),
                ),
              });
            }
            dispatch({
              type: "SET",
              payload: { selectedIds: [], selectedId: null },
            });
            return;
          }
          case "zoomIn": {
            zoomRef.current = clamp(zoomRef.current * 1.15, 0.05, 15);
            dispatch({ type: "SET", payload: { zoom: zoomRef.current } });
            return;
          }
          case "zoomOut": {
            zoomRef.current = clamp(zoomRef.current / 1.15, 0.05, 15);
            dispatch({ type: "SET", payload: { zoom: zoomRef.current } });
            return;
          }
          case "zoomReset": {
            zoomRef.current = 1;
            dispatch({ type: "SET", payload: { zoom: 1 } });
            panRef.current = { x: 40, y: 40 };
            dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } });
            return;
          }
          case "tool": {
            dispatch({ type: "SET", payload: { activeTool: matched.toolId } });
            dispatch({ type: "SET", payload: { currentDraw: null } });
            return;
          }
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [
    selectedId,
    selectedIds,
    placingMode,
    placingIdx,
    placingQueue,
    delMarkup,
    redo,
    undo,
    dispatch,
    pushUndo,
    refreshAutoMeas,
    updSession,
    mobileToolsExpanded,
    setContextMenu,
  ]);

  // ══════════════════════════════════════
  // EVENT HANDLERS
  const handleMouseDown = useCallback(
    (e) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = {
          mx: e.clientX,
          my: e.clientY,
          px: panRef.current.x,
          py: panRef.current.y,
        };
        return;
      }
      if (e.button !== 0) return;
      const sp = getCanvasPos(e);
      let ip = toImage(sp.x, sp.y);
      ip = snapPoint(ip, markups, snapTolerance / zoomRef.current, snapEnabled);
      if (
        placingMode &&
        placingQueue.length > 0 &&
        placingIdx < placingQueue.length
      ) {
        const qid = placingQueue[placingIdx];
        const updatedMarkups = markups.map((m) =>
          m.id === qid ? { ...m, points: [ip], placed: true, ...(placingUnsureRef.current === qid ? { unsure: true } : {}) } : m,
        );
        // Only instantiate measurements whose landmarks are all placed, so
        // partially-placed analyses never show phantom (placeholder-coordinate) values.
        const placedSet = new Set(
          updatedMarkups
            .filter((m) => m.type === "point" && m.placed)
            .map((m) => m.templateLabel || m.label),
        );
        const newAuto = autoCreateMeasurements(
          updatedMarkups,
          analysisTemplate,
          calibration,
          facingSetting,
        ).filter((m) => (m.refLabels || []).every((rl) => placedSet.has(rl)));
        const newNorms = deriveNorms(newAuto, analysisTemplate).filter(
          (n) =>
            !norms.some(
              (x) => x.markupLabel === n.markupLabel && x.measureType === n.measureType,
            ),
        );
        pushUndo();
        updSession({
          markups: refreshAutoMeas([...updatedMarkups, ...newAuto]),
          norms: [...norms, ...newNorms],
        });
        if (placingIdx < placingQueue.length - 1)
          dispatch({ type: "SET", payload: { placingIdx: placingIdx + 1 } });
        else {
          dispatch({ type: "SET", payload: { placingMode: false } });
          dispatch({ type: "SET", payload: { placingQueue: [] } });
          dispatch({ type: "SET", payload: { placingIdx: 0 } });
        }
        return;
      }
      if (activeTool === "pan") {
        isPanning.current = true;
        panStart.current = {
          mx: e.clientX,
          my: e.clientY,
          px: panRef.current.x,
          py: panRef.current.y,
        };
        return;
      }
      if (activeTool === "select") {
        const hit = hitTest(markups, ip, zoomRef.current, undefined, e.fromFinger ? FINGER_SLOP : 8);
        if (!hit) {
          boxSelectRectRef.current = { x1: ip.x, y1: ip.y, x2: ip.x, y2: ip.y };
          dispatch({
            type: "SET",
            payload: { selectedIds: [], selectedId: null },
          });
          return;
        }
        setSelectedId(hit);
        const m = markups.find((x) => x.id === hit);
        const isMulti = selectedIds.length && selectedIds.includes(hit);
        if (isMulti) {
          multiDragIdsRef.current = [...selectedIds];
          dragStart.current = ip;
          isDragging.current = true;
          dragStartState.current = useSessionStore.getState().snapshot();
          return;
        }
        if (selectedIds.length)
          dispatch({ type: "SET", payload: { selectedIds: [] } });
        if (m?.locked) {
          isDragging.current = false;
          return;
        }
        if (m?.type === "silhouette") {
          try {
            const handles = getSilhouetteHandlesImage(m, zoomRef.current);
            const thr =
              Math.max(10, 20 * Math.sqrt(zoomRef.current)) / zoomRef.current;
            if (
              handles.rotCenter &&
              isFinite(handles.rotCenter.x) &&
              dist(ip, handles.rotCenter) < thr
            ) {
              silhouetteAction.current = {
                type: "rotate",
                markupId: hit,
                startIp: ip,
                initialRotation: m.rotation || 0,
                center: {
                  x: (handles.bbox.minX + handles.bbox.maxX) / 2,
                  y: (handles.bbox.minY + handles.bbox.maxY) / 2,
                },
              };
              dragStartState.current = useSessionStore.getState().snapshot();
              return;
            }
            if (m.paths) {
              const ptThr = 8 / zoomRef.current;
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1,
                bestPtIdx = -1,
                bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) {
                    bestDist = d;
                    bestPathIdx = pi;
                    bestPtIdx = ptI;
                  }
                });
              });
              if (bestDist < ptThr && !e.ctrlKey && !e.shiftKey) {
                isDragging.current = true;
                dragMid.current = hit;
                dragStartState.current = useSessionStore.getState().snapshot();
                dragPtIdx.current = { pathIdx: bestPathIdx, ptIdx: bestPtIdx };
                dragStart.current = ip;
                return;
              }
            }
            if (e.ctrlKey && m.paths) {
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1,
                bestPtIdx = -1,
                bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) {
                    bestDist = d;
                    bestPathIdx = pi;
                    bestPtIdx = ptI;
                  }
                });
              });
              const dnx =
                ((ip.x - pos.x) * cosR + (ip.y - pos.y) * sinR) /
                (sc * baseSize);
              const dny =
                (-(ip.x - pos.x) * sinR + (ip.y - pos.y) * cosR) /
                (sc * baseSize);
              const newPaths = m.paths.map((path, pi) => {
                if (pi !== bestPathIdx) return path;
                const newPoints = [...path.points];
                newPoints.splice(bestPtIdx + 1, 0, { x: dnx, y: dny });
                return { ...path, points: newPoints };
              });
              pushUndo();
              updMarkup(hit, { paths: newPaths });
              return;
            }
            if (e.shiftKey && m.paths) {
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1,
                bestPtIdx = -1,
                bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) {
                    bestDist = d;
                    bestPathIdx = pi;
                    bestPtIdx = ptI;
                  }
                });
              });
              if (m.paths[bestPathIdx].points.length > 2) {
                const newPaths = m.paths.map((path, pi) => {
                  if (pi !== bestPathIdx) return path;
                  return {
                    ...path,
                    points: path.points.filter((_, i) => i !== bestPtIdx),
                  };
                });
                pushUndo();
                updMarkup(hit, { paths: newPaths });
              }
              return;
            }
            const cornerThr =
              Math.max(6, 10 * Math.sqrt(zoomRef.current)) / zoomRef.current;
            for (let hi = 0; hi < handles.corners.length; hi++) {
              const c = handles.corners[hi];
              if (isFinite(c.x) && dist(ip, c) < cornerThr) {
                const cx = (handles.bbox.minX + handles.bbox.maxX) / 2;
                const cy = (handles.bbox.minY + handles.bbox.maxY) / 2;
                silhouetteAction.current = {
                  type: "resize",
                  markupId: hit,
                  startIp: ip,
                  initialScale: m.scale || 1,
                  center: { x: cx, y: cy },
                  initialDist: dist(ip, { x: cx, y: cy }),
                };
                dragStartState.current = useSessionStore.getState().snapshot();
                return;
              }
            }
          } catch (e) {
            logError("Silhouette handle error", e);
          }
          isDragging.current = true;
          dragMid.current = hit;
          dragStartState.current = useSessionStore.getState().snapshot();
          dragPtIdx.current = -1;
          dragStart.current = ip;
          return;
        }
        if (
          e.ctrlKey &&
          (m.type === "curve" ||
            m.type === "polyline" ||
            m.type === "polygon" ||
            m.type === "bezier")
        ) {
          const vp = vpts(m);
          let bestIdx = -1,
            bestDist = Infinity;
          for (let i = 0; i < vp.length; i++) {
            const d = dist(ip, vp[i]);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          const newPoints = [...m.points];
          newPoints.splice(bestIdx + 1, 0, ip);
          const patch = { points: newPoints };
          if (
            m.type === "bezier" &&
            Array.isArray(m.cp) &&
            m.cp.length === 2 * (m.points.length - 1) &&
            bestIdx < vp.length - 1
          ) {
            const oc = m.cp,
              nc = new Array(oc.length + 2);
            let j = 0;
            for (; j < 2 * bestIdx; j++) nc[j] = oc[j];
            nc[j] = oc[j];
            j++;
            const p0 = vp[bestIdx],
              p1 = ip,
              p2 = vp[bestIdx + 1];
            nc[j] = {
              x: p1.x - (p2.x - p1.x) / 6,
              y: p1.y - (p2.y - p1.y) / 6,
            };
            j++;
            nc[j] = {
              x: p1.x + (p2.x - p0.x) / 6,
              y: p1.y + (p2.y - p0.y) / 6,
            };
            j++;
            nc[j] = oc[j - 2];
            j++;
            for (; j < nc.length; j++) nc[j] = oc[j - 2];
            patch.cp = nc;
          } else if (m.type === "bezier")
            patch.cp = autoControlPoints(newPoints);
          pushUndo();
          updMarkup(hit, patch);
          return;
        }
        if (
          e.shiftKey &&
          (m.type === "curve" ||
            m.type === "polyline" ||
            m.type === "polygon" ||
            m.type === "bezier")
        ) {
          const vp = vpts(m);
          let bestIdx = -1,
            bestDist = Infinity;
          for (let i = 0; i < vp.length; i++) {
            const d = dist(ip, vp[i]);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          if (bestIdx >= 0 && vp.length > 2) {
            const newPoints = m.points.filter((_, i) => i !== bestIdx);
            const patch = { points: newPoints };
            if (
              m.type === "bezier" &&
              Array.isArray(m.cp) &&
              m.cp.length === 2 * (m.points.length - 1)
            ) {
              const oc = m.cp;
              if (bestIdx === 0) patch.cp = oc.slice(2);
              else if (bestIdx === vp.length - 1)
                patch.cp = oc.slice(0, oc.length - 2);
              else {
                const nc = new Array(oc.length - 2);
                let j = 0;
                for (; j < 2 * bestIdx - 1; j++) nc[j] = oc[j];
                nc[j] = oc[2 * bestIdx + 1];
                j++;
                for (; j < nc.length; j++) nc[j] = oc[j + 2];
                patch.cp = nc;
              }
            } else if (m.type === "bezier")
              patch.cp = autoControlPoints(newPoints);
            pushUndo();
            updMarkup(hit, patch);
          }
          return;
        }
        if (m.type === "bezier" && hoveredPtRef.current?.type === "bezierCp") {
          isDragging.current = true;
          dragMid.current = hit;
          dragStartState.current = useSessionStore.getState().snapshot();
          dragPtIdx.current = { type: "cp", idx: hoveredPtRef.current.cpIdx };
          dragStart.current = ip;
          return;
        }
        isDragging.current = true;
        dragMid.current = hit;
        dragStartState.current = useSessionStore.getState().snapshot();
        let bi = 0,
          bd = Infinity;
        (m.points || []).forEach((p, i) => {
          const d = dist(p, ip);
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        if (bd > 12 / zoomRef.current) bi = -1;
        dragPtIdx.current = bi;
        dragStart.current = ip;
        return;
      }
      if (activeTool === "text") {
        dispatch({ type: "SET", payload: { pendingTextPos: ip } });
        return;
      }
      if (activeTool === "point") {
        if (replacingId) {
          pushUndo();
          updMarkup(replacingId, { points: [ip], placed: true });
          dispatch({ type: "SET", payload: { replacingId: null } });
          return;
        }
        const nNon = markups.filter(
          (m) => m.type === "point" && !m.repro,
        ).length;
        addMarkup({
          type: "point",
          points: [ip],
          label: `P${nNon + 1}`,
          color: t.acc,
          size: 6,
          definition: "",
        });
        return;
      }
      if (activeTool === "ruler") {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: { currentDraw: { type: "ruler", points: [ip] } },
          });
        else {
          const ruler = {
            ...currentDraw,
            type: "ruler",
            points: [...currentDraw.points, ip],
            label: "Ruler",
          };
          dispatch({ type: "SET", payload: { pendingRuler: ruler } });
          addMarkup(ruler);
          dispatch({ type: "SET", payload: { currentDraw: null } });
          dispatch({ type: "SET", payload: { showCalib: true } });
        }
        return;
      }
      if (activeTool === "parallel") {
        if (
          selectedMarkup &&
          (selectedMarkup.type === "line" || selectedMarkup.type === "parallel")
        ) {
          const vp = vpts(selectedMarkup);
          if (vp.length >= 2) {
            const dx = vp[1].x - vp[0].x,
              dy = vp[1].y - vp[0].y,
              len = Math.sqrt(dx * dx + dy * dy) || 1,
              half = len / 2;
            addMarkup({
              type: "parallel",
              points: [
                { x: ip.x - (dx / len) * half, y: ip.y - (dy / len) * half },
                { x: ip.x + (dx / len) * half, y: ip.y + (dy / len) * half },
              ],
              color: "#34d399",
              width: 1.5,
              style: "solid",
              label: `∥`,
              showLength: true,
            });
            return;
          }
        }
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: { currentDraw: { type: "line", points: [ip] } },
          });
        else {
          finalizeMarkup({
            ...currentDraw,
            points: [...currentDraw.points, ip],
          });
          dispatch({ type: "SET", payload: { currentDraw: null } });
        }
        return;
      }
      if (activeTool === "midpoint") {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: { currentDraw: { type: "midpoint", points: [ip] } },
          });
        else {
          const p1 = currentDraw.points[0],
            p2 = ip;
          if (p1.x > -9000 && p2.x > -9000) {
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const n = markups.filter((m) => m.type === "point").length;
            addMarkup({
              type: "point",
              points: [mid],
              label: `M${n + 1}`,
              color: "#fbbf24",
              size: 6,
              definition: "Midpoint",
            });
          }
          dispatch({ type: "SET", payload: { currentDraw: null } });
        }
        return;
      }
      if (activeTool === "perppoint") {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: { currentDraw: { type: "perppoint", points: [ip] } },
          });
        else if (currentDraw.points.length === 1)
          dispatch({
            type: "SET",
            payload: {
              currentDraw: {
                type: "perppoint",
                points: [currentDraw.points[0], ip],
              },
            },
          });
        else {
          const p1 = currentDraw.points[0],
            p2 = currentDraw.points[1],
            p3 = ip;
          if (p1.x > -9000 && p2.x > -9000 && p3.x > -9000) {
            const lx1 = p2.x - p1.x,
              ly1 = p2.y - p1.y;
            const lx2 = -ly1,
              ly2 = lx1;
            const perpPt = { x: p3.x + lx2, y: p3.y + ly2 };
            const n =
              markups.filter((m) => m.type === "line" || m.type === "perp")
                .length + 1;
            addMarkup({
              type: "line",
              mode: "segment",
              points: [perpPt, p3],
              color: "#f472b6",
              width: 1.5,
              style: "solid",
              label: `⊥${n}`,
              showLength: true,
            });
          }
          dispatch({ type: "SET", payload: { currentDraw: null } });
        }
        return;
      }
      if (activeTool === "arrow") {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: { currentDraw: { type: "arrow", points: [ip] } },
          });
        else {
          const p1 = currentDraw.points[0],
            p2 = ip;
          if (p1.x > -9000 && p2.x > -9000) {
            addMarkup({
              type: "arrow",
              points: [p1, p2],
              color: "#34d399",
              width: 2,
            });
          }
          dispatch({ type: "SET", payload: { currentDraw: null } });
        }
        return;
      }
      if (activeTool === "tangent") {
        if (!currentDraw) {
          const thr = 25 / zoomRef.current;
          const hit = findTangentOnCurve(markups, ip, thr);
          if (hit) {
            const a = hit.tangentAngle;
            dispatch({
              type: "SET",
              payload: {
                currentDraw: {
                  type: "tangent",
                  points: [hit.tangentPoint],
                  tangentAngle: a,
                  tangentCurveId: hit.curveId,
                  tangentCenter: hit.curveCenter,
                  tangentRadius: hit.curveRadius,
                },
              },
            });
          } else {
            dispatch({
              type: "SET",
              payload: { currentDraw: { type: "tangent", points: [ip] } },
            });
          }
        } else {
          const p0 = currentDraw.points[0];
          if (currentDraw.tangentAngle != null) {
            const a = currentDraw.tangentAngle;
            const dx = ip.x - p0.x,
              dy = ip.y - p0.y;
            const proj = dx * Math.cos(a) + dy * Math.sin(a);
            const ep = {
              x: p0.x + proj * Math.cos(a),
              y: p0.y + proj * Math.sin(a),
            };
            finalizeMarkup({ ...currentDraw, points: [p0, ep] });
          } else {
            finalizeMarkup({ ...currentDraw, points: [p0, ip] });
          }
          dispatch({ type: "SET", payload: { currentDraw: null } });
        }
        return;
      }
      if (
        activeTool === "ellipse" ||
        activeTool === "arc" ||
        activeTool === "circle" ||
        activeTool === "concentric"
      ) {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: {
              currentDraw: {
                type: activeTool,
                points: [ip],
                curveStyle: "linear",
                replacingId,
              },
            },
          });
        else {
          const nps = [...currentDraw.points, ip];
          const need = { ellipse: 3, arc: 3, circle: 2, concentric: 3 }[
            activeTool
          ];
          if (need && nps.length >= need) {
            finalizeMarkup({ ...currentDraw, points: nps });
            dispatch({ type: "SET", payload: { currentDraw: null } });
          } else
            dispatch({
              type: "SET",
              payload: { currentDraw: { ...currentDraw, points: nps } },
            });
        }
        return;
      }
      if (activeTool === "mirror") {
        if (!currentDraw) {
          let bestId = null,
            bd = Infinity;
          const thr = 16 / zoomRef.current;
          for (const m2 of markups) {
            if (m2.type !== "point" || m2.visible === false || m2.locked)
              continue;
            const vp2 = vpts(m2);
            if (!vp2.length) continue;
            const d = dist(ip, vp2[0]);
            if (d < thr && d < bd) {
              bd = d;
              bestId = m2.id;
            }
          }
          if (!bestId) return;
          const src = markups.find((m2) => m2.id === bestId);
          if (!src) return;
          const sv = vpts(src);
          if (!sv.length) return;
          dispatch({
            type: "SET",
            payload: {
              currentDraw: {
                type: "mirror",
                points: [{ x: sv[0].x, y: sv[0].y }],
                sourceId: src.id,
                sourceLabel: src.label || "",
              },
            },
          });
        } else {
          const nps = [...currentDraw.points, ip];
          if (nps.length >= 3) {
            const [srcPt, ax1, ax2] = nps;
            const mp = mirrorPoint(srcPt, ax1, ax2);
            const primeLabel = (currentDraw.sourceLabel || "Point") + "'";
            addMarkup({
              type: "point",
              points: [{ x: mp.x, y: mp.y }],
              color: THEMES[theme].acc,
              label: primeLabel,
              mirrorOf: currentDraw.sourceLabel || "",
            });
            dispatch({ type: "SET", payload: { currentDraw: null } });
          } else {
            dispatch({
              type: "SET",
              payload: { currentDraw: { ...currentDraw, points: nps } },
            });
          }
        }
        return;
      }
      if (activeTool === "bezier") {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: {
              currentDraw: { type: "bezier", points: [ip], replacingId },
            },
          });
        else {
          dispatch({
            type: "SET",
            payload: {
              currentDraw: {
                ...currentDraw,
                points: [...currentDraw.points, ip],
              },
            },
          });
        }
        return;
      }
      if (
        [
          "line",
          "angle3",
          "angle4",
          "polygon",
          "curve",
          "polyline",
          "perp",
        ].includes(activeTool)
      ) {
        if (!currentDraw)
          dispatch({
            type: "SET",
            payload: {
              currentDraw: {
                type: activeTool,
                points: [ip],
                curveStyle: activeTool === "curve" ? "bspline" : "linear",
                replacingId,
              },
            },
          });
        else {
          const nps = [...currentDraw.points, ip];
          const need = { line: 2, angle3: 3, angle4: 4, perp: 3 }[activeTool];
          if (need && nps.length >= need) {
            finalizeMarkup({ ...currentDraw, points: nps });
            dispatch({ type: "SET", payload: { currentDraw: null } });
          } else
            dispatch({
              type: "SET",
              payload: { currentDraw: { ...currentDraw, points: nps } },
            });
        }
        return;
      }
    },
    [
      activeTool,
      markups,
      snapEnabled,
      currentDraw,
      selectedMarkup,
      selectedIds,
      placingMode,
      placingQueue,
      placingIdx,
      replacingId,
      setSelectedId,
      updMarkup,
      addMarkup,
      finalizeMarkup,
      toImage,
      getCanvasPos,
      t,
      analysisTemplate,
      facingSetting,
      dispatch,
      norms,
      pushUndo,
      refreshAutoMeas,
      updSession,
      calibration,
      snapTolerance,
      theme,
    ],
  );

  const syncTangents = useCallback(
    (curveId, dx, dy) => {
      markups.forEach((tm) => {
        if (tm.type === "tangent" && tm.tangentCurveId === curveId) {
          const pts = tm.points || [];
          if (tm.tangentAngle != null) {
            const newPts = [
              { x: pts[0].x + dx, y: pts[0].y + dy },
              { x: pts[1].x + dx, y: pts[1].y + dy },
            ];
            updMarkup(tm.id, { points: newPts });
          } else {
            updMarkup(tm.id, {
              points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            });
          }
        }
      });
    },
    [markups, updMarkup],
  );
  const syncRefDeps = useCallback(
    (dragM, dx, dy) => {
      if (!dragM) return;
      markups.forEach((dm) => {
        if (dm.type === "point" || !dm.refLabels) return;
        const rl = dm.refLabels;
        const rt = dm.refTemplateIds || [];
        let changed = false;
        const pts = (dm.points || []).map((p, i) => {
          const tid = rt[i];
          const matches =
            tid && dragM.templateId
              ? tid === dragM.templateId
              : rl[i] === dragM.label ||
                (dragM.templateLabel && rl[i] === dragM.templateLabel);
          if (matches) {
            changed = true;
            return { x: p.x + dx, y: p.y + dy };
          }
          return p;
        });
        if (changed) {
          const patch = { points: pts };
          if (dm.type === "bezier" && dm.cp)
            patch.cp = dm.cp.map((cp) => ({ x: cp.x + dx, y: cp.y + dy }));
          updMarkup(dm.id, patch);
        }
      });
    },
    [markups, updMarkup],
  );

  const handleMouseMove = useCallback(
    (e) => {
      const sp = getCanvasPos(e);
      mouseCanvasRef.current = sp;
      // F1: write pointer state to refs — no dispatch, no React re-render
      mousePosRef.current = sp;
      if (
        (snapEnabled.points || snapEnabled.lines) &&
        activeTool !== "select" &&
        activeTool !== "pan"
      ) {
        const ip = toImage(sp.x, sp.y);
        const sr = snapPointResult(
          ip,
          markups,
          snapTolerance / zoomRef.current,
          snapEnabled,
        );
        const sn = sr.point;
        const prev = snapPosRef.current;
        snapPosRef.current =
          Math.abs(sn.x - ip.x) > 0.1 || Math.abs(sn.y - ip.y) > 0.1
            ? { x: sn.x, y: sn.y, kind: sr.kind }
            : null;
        if (
          (prev === null) !== (snapPosRef.current === null) ||
          (prev &&
            snapPosRef.current &&
            (prev.x !== snapPosRef.current.x ||
              prev.y !== snapPosRef.current.y))
        )
          scheduleRedrawRef.current();
      } else {
        if (snapPosRef.current !== null) {
          snapPosRef.current = null;
          scheduleRedrawRef.current();
        }
      }
      if (
        activeTool === "select" &&
        !isDragging.current &&
        !isPanning.current &&
        !silhouetteAction.current &&
        !boxSelectRectRef.current
      ) {
        const ip = toImage(sp.x, sp.y);
        let best = null,
          bd = Infinity;
        const ptThr = 12 / zoomRef.current;
        for (const m2 of markups) {
          if (m2.locked || m2.visible === false) continue;
          if (m2.type === "point") {
            const vp = vpts(m2);
            if (vp.length) {
              const d = dist(ip, vp[0]);
              if (d < bd && d < ptThr) {
                bd = d;
                best = { type: "point", mid: m2.id };
              }
            }
          }
          if (m2.type === "silhouette") {
            const paths = m2.paths || SILHOUETTES[m2.silhouetteType]?.paths;
            if (!paths) continue;
            const rot = m2.rotation || 0;
            const sc = m2.scale || 1;
            const pos = m2.position || { x: 0, y: 0 };
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            paths.forEach((path, pi) => {
              path.points.forEach((p, ptI) => {
                const sx = p.x * sc * 100;
                const sy = p.y * 100;
                const rx = sx * cosR - sy * sinR;
                const ry = sx * sinR + sy * cosR;
                const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                if (d < bd && d < ptThr) {
                  bd = d;
                  best = {
                    type: "silhouette",
                    mid: m2.id,
                    pathIdx: pi,
                    ptIdx: ptI,
                  };
                }
              });
            });
            if (m2.id === selectedId) {
              try {
                const h = getSilhouetteHandlesImage(m2, zoomRef.current);
                const rotThr =
                  Math.max(10, 22 * Math.sqrt(zoomRef.current)) /
                  zoomRef.current;
                if (h.rotCenter && isFinite(h.rotCenter.x)) {
                  const d = dist(ip, h.rotCenter);
                  if (d < rotThr && d < bd) {
                    bd = d;
                    best = { type: "rotate", mid: m2.id };
                  }
                }
                const cornerThr =
                  Math.max(8, 12 * Math.sqrt(zoomRef.current)) /
                  zoomRef.current;
                h.corners.forEach((c, ci) => {
                  if (isFinite(c.x)) {
                    const d = dist(ip, c);
                    if (d < cornerThr && d < bd) {
                      bd = d;
                      best = { type: "corner", mid: m2.id, cornerIdx: ci };
                    }
                  }
                });
              } catch {
                /*silent*/
              }
            }
          } else if (
            m2.type === "curve" ||
            m2.type === "polyline" ||
            m2.type === "polygon" ||
            m2.type === "bezier" ||
            m2.type === "tangent"
          ) {
            if (m2.type === "bezier" && m2.cp) {
              m2.cp.forEach((p, i) => {
                const d = dist(ip, p);
                if (d < bd && d < ptThr) {
                  bd = d;
                  best = { type: "bezierCp", mid: m2.id, cpIdx: i };
                }
              });
            }
            (m2.points || []).forEach((p, i) => {
              const d = dist(ip, p);
              if (d < bd && d < ptThr) {
                bd = d;
                best = {
                  type:
                    m2.type === "bezier"
                      ? "bezier"
                      : m2.type === "tangent"
                        ? "tangent"
                        : "path",
                  mid: m2.id,
                  ptIdx: i,
                };
              }
            });
          }
        }
        const _prevHover = hoveredPtRef.current;
        hoveredPtRef.current = best;
        if (JSON.stringify(_prevHover) !== JSON.stringify(best))
          scheduleRedrawRef.current();
      } else {
        hoveredPtRef.current = null;
      }
      const _hp = hoveredPtRef.current;
      const _isPanning = isPanning.current;
      const _curCursor =
        _hp &&
        (_hp.type === "bezierCp" ||
          _hp.type === "bezier" ||
          _hp.type === "path" ||
          _hp.type === "point" ||
          _hp.type === "tangent" ||
          _hp.type === "silhouette" ||
          _hp.type === "rotate" ||
          _hp.type === "corner")
          ? "pointer"
          : _isPanning
            ? "grabbing"
            : activeTool === "pan"
              ? "grab"
              : activeTool === "select"
                ? "default"
                : "crosshair";
      if (canvasRef.current.style.cursor !== _curCursor)
        canvasRef.current.style.cursor = _curCursor;
      if (boxSelectRectRef.current) {
        const ip = toImage(sp.x, sp.y);
        boxSelectRectRef.current = {
          ...boxSelectRectRef.current,
          x2: ip.x,
          y2: ip.y,
        };
        scheduleRedrawRef.current();
        return;
      }
      if (isPanning.current && panStart.current) {
        panRef.current = {
          x: panStart.current.px + (e.clientX - panStart.current.mx),
          y: panStart.current.py + (e.clientY - panStart.current.my),
        };
        scheduleRedrawRef.current();
        return;
      }
      if (isDragging.current && multiDragIdsRef.current) {
        const ip = toImage(sp.x, sp.y);
        const dx = ip.x - dragStart.current.x,
          dy = ip.y - dragStart.current.y;
        const ids = multiDragIdsRef.current;
        ids.forEach((cid) => {
          const cm = markups.find((x) => x.id === cid);
          if (cm) syncRefDeps(cm, dx, dy);
        });
        useSessionStore.getState().updMarkups((ms) =>
          ms.map((m) => {
            if (!ids.includes(m.id)) return m;
            if (m.type === "silhouette")
              return {
                ...m,
                position: {
                  x: (m.position?.x || 0) + dx,
                  y: (m.position?.y || 0) + dy,
                },
              };
            return {
              ...m,
              points: (m.points || []).map((p) =>
                p.x > -9000 ? { x: p.x + dx, y: p.y + dy } : p,
              ),
            };
          }),
        );
        ids.forEach((cid) => {
          const cm = markups.find((x) => x.id === cid);
          if (!cm) return;
          if (
            [
              "circle",
              "arc",
              "ellipse",
              "bezier",
              "curve",
              "polyline",
              "polygon",
            ].includes(cm.type)
          )
            syncTangents(cid, dx, dy);
        });
        dragStart.current = ip;
        scheduleRedrawRef.current();
        return;
      }
      if (isDragging.current && dragMid.current) {
        const ip = toImage(sp.x, sp.y);
        const dx = ip.x - dragStart.current.x,
          dy = ip.y - dragStart.current.y;
        const m = markups.find((x) => x.id === dragMid.current);
        if (!m) return;
        if (m.type === "silhouette") {
          if (
            typeof dragPtIdx.current === "object" &&
            dragPtIdx.current !== null
          ) {
            const sc = m.scale || 1;
            const rot = m.rotation || 0;
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            const baseSize = 100;
            const dnx = (cosR * dx + sinR * dy) / (sc * baseSize);
            const dny = (-sinR * dx + cosR * dy) / (sc * baseSize);
            const { pathIdx, ptIdx } = dragPtIdx.current;
            updMarkup(dragMid.current, {
              paths: (m.paths || []).map((path, pi) => ({
                ...path,
                points: path.points.map((p, ptI) =>
                  pi === pathIdx && ptI === ptIdx
                    ? { x: p.x + dnx, y: p.y + dny }
                    : p,
                ),
              })),
            });
          } else {
            updMarkup(dragMid.current, {
              position: {
                x: (m.position?.x || 0) + dx,
                y: (m.position?.y || 0) + dy,
              },
            });
          }
        } else if (
          m.type === "tangent" &&
          dragPtIdx.current === 0 &&
          m.tangentCurveId
        ) {
          const curve = markups.find((c) => c.id === m.tangentCurveId);
          if (curve) {
            const raw = {
              x: (m.points[0] || {}).x + dx,
              y: (m.points[0] || {}).y + dy,
            };
            const snapped = snapTangentToCurve(curve, raw);
            if (snapped) {
              const ep = m.points[1] || raw;
              const a = snapped.tangentAngle;
              const dex = ep.x - snapped.tangentPoint.x,
                dey = ep.y - snapped.tangentPoint.y;
              const proj = dex * Math.cos(a) + dey * Math.sin(a);
              const newEp = {
                x: snapped.tangentPoint.x + proj * Math.cos(a),
                y: snapped.tangentPoint.y + proj * Math.sin(a),
              };
              updMarkup(dragMid.current, {
                points: [snapped.tangentPoint, newEp],
                tangentAngle: snapped.tangentAngle,
              });
            }
          } else {
            updMarkup(dragMid.current, {
              points: (m.points || []).map((p, i) =>
                i === 0 ? { x: p.x + dx, y: p.y + dy } : p,
              ),
            });
          }
        } else if (
          m.type === "bezier" &&
          typeof dragPtIdx.current === "object" &&
          dragPtIdx.current?.type === "cp"
        ) {
          const cp = [...(m.cp || [])];
          const ci = dragPtIdx.current.idx;
          if (ci < cp.length) cp[ci] = { x: cp[ci].x + dx, y: cp[ci].y + dy };
          updMarkup(dragMid.current, { cp });
        } else if (
          m.type === "bezier" &&
          typeof dragPtIdx.current === "number" &&
          dragPtIdx.current >= 0
        ) {
          const ni = dragPtIdx.current;
          const pts = (m.points || []).map((p, i) =>
            i === ni ? { x: p.x + dx, y: p.y + dy } : p,
          );
          const cp = Array.isArray(m.cp) ? [...m.cp] : [];
          if (cp.length === 2 * (pts.length - 1)) {
            if (ni > 0 && cp[2 * ni - 1])
              cp[2 * ni - 1] = {
                x: cp[2 * ni - 1].x + dx,
                y: cp[2 * ni - 1].y + dy,
              };
            if (ni < pts.length - 1 && cp[2 * ni])
              cp[2 * ni] = { x: cp[2 * ni].x + dx, y: cp[2 * ni].y + dy };
          }
          updMarkup(dragMid.current, { points: pts, cp });
        } else {
          syncRefDeps(m, dx, dy);
          updMarkup(dragMid.current, {
            points: (m.points || []).map((p, i) =>
              i === dragPtIdx.current ? { x: p.x + dx, y: p.y + dy } : p,
            ),
          });
          syncTangents(m.id, dx, dy);
        }
        dragStart.current = ip;
        scheduleRedrawRef.current();
      }
      if (silhouetteAction.current) {
        try {
          const ip = toImage(sp.x, sp.y);
          const sa = silhouetteAction.current;
          const m = markups.find((x) => x.id === sa.markupId);
          if (!m || !isFinite(sa.center.x) || !isFinite(sa.center.y)) {
            silhouetteAction.current = null;
            return;
          }
          if (
            sa.type === "resize" &&
            isFinite(sa.initialDist) &&
            sa.initialDist > 0
          ) {
            const d = dist(ip, sa.center);
            if (!isFinite(d)) return;
            const f = d / sa.initialDist;
            updMarkup(sa.markupId, {
              scale: Math.max(0.05, Math.min(20, sa.initialScale * f)),
            });
          } else if (sa.type === "rotate" && isFinite(sa.startIp.x)) {
            const a = Math.atan2(ip.y - sa.center.y, ip.x - sa.center.x);
            const s = Math.atan2(
              sa.startIp.y - sa.center.y,
              sa.startIp.x - sa.center.x,
            );
            updMarkup(sa.markupId, { rotation: sa.initialRotation + (a - s) });
          }
          scheduleRedrawRef.current();
        } catch {
          silhouetteAction.current = null; /*silent*/
        }
      }
    },
    [
      activeTool,
      markups,
      snapEnabled,
      selectedId,
      updMarkup,
      toImage,
      getCanvasPos,
      syncTangents,
      syncRefDeps,
      snapTolerance,
    ],
  );

  const handleMouseUp = () => {
    if (boxSelectRectRef.current) {
      const { x1, y1, x2, y2 } = boxSelectRectRef.current;
      boxSelectRectRef.current = null;
      const minX = Math.min(x1, x2),
        maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2),
        maxY = Math.max(y1, y2);
      const inside = markups.filter((m) => {
        if (m.locked || m.visible === false) return false;
        const pts =
          m.type === "silhouette" ? (m.position ? [m.position] : []) : vpts(m);
        return pts.some(
          (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
        );
      });
      const ids = inside.map((m) => m.id);
      dispatch({
        type: "SET",
        payload: {
          selectedIds: ids,
          selectedId: ids.length === 1 ? ids[0] : null,
        },
      });
      multiDragIdsRef.current = null;
    }
    if (
      (isDragging.current || silhouetteAction.current) &&
      dragStartState.current
    ) {
      const currentState = useSessionStore.getState().snapshot();
      if (dragStartState.current !== currentState) {
        useSessionStore.getState().pushUndoSnapshot(dragStartState.current);
      }
      dragStartState.current = null;
    }
    isPanning.current = false;
    isDragging.current = false;
    silhouetteAction.current = null;
    multiDragIdsRef.current = null;
  };
  const handleDblClick = () => {
    if (
      ["polygon", "curve", "polyline", "bezier"].includes(activeTool) &&
      currentDraw?.points.length >= 2
    ) {
      finalizeMarkup(currentDraw);
      dispatch({ type: "SET", payload: { currentDraw: null } });
    }
  };
  const handleCanvasContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      const sp = getCanvasPos(e);
      const ip = toImage(sp.x, sp.y);
      const hit = hitTest(markups, ip, zoomRef.current);
      setContextMenu(
        hit
          ? {
              x: e.clientX,
              y: e.clientY,
              markupId: hit,
              imageX: ip.x,
              imageY: ip.y,
            }
          : {
              x: e.clientX,
              y: e.clientY,
              markupId: null,
              imageX: ip.x,
              imageY: ip.y,
            },
      );
    },
    [markups, getCanvasPos, toImage, setContextMenu],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let syncPending = false;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > 0.1 || Math.abs(e.deltaX) > 0.1) {
        e.preventDefault();
        e.stopPropagation();
        const sp = getCanvasPos(e);
        const cz = zoomRef.current;
        const f = e.deltaY > 0 ? 0.9 : 1.1;
        const nz = clamp(cz * f, 0.05, 15);
        zoomRef.current = nz;
        const prev = panRef.current;
        panRef.current = {
          x: sp.x - (sp.x - prev.x) * (nz / cz),
          y: sp.y - (sp.y - prev.y) * (nz / cz),
        };
        scheduleRedrawRef.current();
        if (!syncPending) {
          syncPending = true;
          requestAnimationFrame(() => {
            syncPending = false;
            dispatch({ type: "SET", payload: { zoom: zoomRef.current } });
          });
        }
      }
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [dispatch, getCanvasPos]);
  const touchStartRef = useRef();
  const touchMoveRef = useRef();
  const touchEndRef = useRef();
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const stylusRef = useRef(false);
  const gestureRef = useRef("none");
  const pinchRef = useRef(null);
  const panCandidateRef = useRef(null);
  const syncZoomRef = useRef(false);
  const syncZoom = () => {
    if (!syncZoomRef.current) {
      syncZoomRef.current = true;
      requestAnimationFrame(() => {
        syncZoomRef.current = false;
        dispatch({ type: "SET", payload: { zoom: zoomRef.current } });
      });
    }
  };
  touchStartRef.current = (e) => {
    const touches = e.touches;
    if (touches.length === 1) {
      if (gestureRef.current === "pinch") return;
      const t2 = touches[0];
      // C5: a stylus (Apple Pencil) acts like a mouse — precise drags and
      // placement, no double-tap zoom or one-finger panning.
      if (t2.touchType === "stylus") {
        gestureRef.current = "single";
        panCandidateRef.current = null;
        stylusRef.current = true;
        handleMouseDown({ button: 0, clientX: t2.clientX, clientY: t2.clientY });
        return;
      }
      stylusRef.current = false;
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        gestureRef.current = "none";
        const canFinish =
          ["polygon", "curve", "polyline", "bezier"].includes(activeTool) &&
          currentDraw?.points.length >= 2;
        if (canFinish) {
          handleDblClick();
        } else {
          const sp = getCanvasPos({ clientX: t2.clientX, clientY: t2.clientY });
          const cz = zoomRef.current,
            nz = clamp(cz * 1.5, 0.05, 15);
          zoomRef.current = nz;
          const prev = panRef.current;
          panRef.current = {
            x: sp.x - (sp.x - prev.x) * (nz / cz),
            y: sp.y - (sp.y - prev.y) * (nz / cz),
          };
          scheduleRedrawRef.current();
          syncZoom();
        }
        return;
      }
      lastTapRef.current = now;
      gestureRef.current = "single";
      panCandidateRef.current = null;
      const sp = getCanvasPos({ clientX: t2.clientX, clientY: t2.clientY });
      const ip = toImage(sp.x, sp.y);
      const hit = hitTest(markups, ip, zoomRef.current, undefined, FINGER_SLOP);
      if (activeTool === "select" && !hit) {
        panCandidateRef.current = { x: t2.clientX, y: t2.clientY };
      } else {
        handleMouseDown({
          button: 0,
          clientX: t2.clientX,
          clientY: t2.clientY,
          fromFinger: true,
        });
      }
      longPressStartRef.current = { x: t2.clientX, y: t2.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (navigator.vibrate) navigator.vibrate(20);
        setContextMenu({
          x: t2.clientX,
          y: t2.clientY,
          markupId: hit || null,
          imageX: ip.x,
          imageY: ip.y,
        });
      }, 500);
    }
    if (touches.length === 2) {
      if (gestureRef.current === "single") {
        if (panCandidateRef.current) panCandidateRef.current = null;
        isDragging.current = false;
        isPanning.current = false;
        silhouetteAction.current = null;
        multiDragIdsRef.current = null;
      }
      gestureRef.current = "pinch";
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const a = touches[0],
        b = touches[1];
      const cx = (a.clientX + b.clientX) / 2,
        cy = (a.clientY + b.clientY) / 2;
      const r = canvasRef.current.getBoundingClientRect();
      const ip = toImage(cx - r.left, cy - r.top);
      pinchRef.current = {
        d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        nz: zoomRef.current,
        ip,
      };
      if (
        (activeTool === "curve" ||
          activeTool === "polyline" ||
          activeTool === "polygon") &&
        currentDraw?.points.length >= 2
      ) {
        handleMouseDown({ button: 0, clientX: cx, clientY: cy, ctrlKey: true });
      }
    }
  };
  touchMoveRef.current = (e) => {
    // A fingertip always jitters a little; only a real move (> 10 px) cancels
    // the long-press context menu (C5).
    if (longPressTimerRef.current) {
      const t0 = e.touches[0], st = longPressStartRef.current;
      if (!t0 || !st || e.touches.length > 1 || Math.hypot(t0.clientX - st.x, t0.clientY - st.y) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
    if (stylusRef.current && e.touches.length === 1) {
      handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      return;
    }
    if (
      gestureRef.current === "pinch" &&
      e.touches.length >= 2 &&
      pinchRef.current
    ) {
      const a = e.touches[0],
        b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const nz = clamp(
        pinchRef.current.nz * (d / pinchRef.current.d),
        0.05,
        15,
      );
      zoomRef.current = nz;
      const cx = (a.clientX + b.clientX) / 2,
        cy = (a.clientY + b.clientY) / 2;
      const r = canvasRef.current.getBoundingClientRect();
      const sp = { x: cx - r.left, y: cy - r.top };
      panRef.current = {
        x: sp.x - pinchRef.current.ip.x * nz,
        y: sp.y - pinchRef.current.ip.y * nz,
      };
      scheduleRedrawRef.current();
      syncZoom();
      return;
    }
    if (e.touches.length === 1) {
      const t2 = e.touches[0];
      if (panCandidateRef.current) {
        const dx = t2.clientX - panCandidateRef.current.x,
          dy = t2.clientY - panCandidateRef.current.y;
        if (Math.hypot(dx, dy) > 8) {
          isPanning.current = true;
          panStart.current = {
            px: panRef.current.x,
            py: panRef.current.y,
            mx: t2.clientX,
            my: t2.clientY,
          };
          panCandidateRef.current = null;
        }
      }
      handleMouseMove({ clientX: t2.clientX, clientY: t2.clientY });
    }
  };
  touchEndRef.current = (e) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (stylusRef.current) {
      stylusRef.current = false;
      gestureRef.current = "none";
      handleMouseUp();
      return;
    }
    if (gestureRef.current === "pinch") {
      if (e.touches.length === 0) {
        gestureRef.current = "none";
        pinchRef.current = null;
        handleMouseUp();
      }
      return;
    }
    if (panCandidateRef.current) {
      const ct = e.changedTouches[0];
      panCandidateRef.current = null;
      handleMouseDown({ button: 0, clientX: ct.clientX, clientY: ct.clientY });
    }
    gestureRef.current = "none";
    handleMouseUp();
  };
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const opts = { passive: false };
    const onStart = (e) => {
      e.preventDefault();
      touchStartRef.current(e);
    };
    const onMove = (e) => {
      e.preventDefault();
      touchMoveRef.current(e);
    };
    const onEnd = (e) => {
      touchEndRef.current(e);
    };
    const onCancel = (e) => {
      touchEndRef.current(e);
    };
    c.addEventListener("touchstart", onStart, opts);
    c.addEventListener("touchmove", onMove, opts);
    c.addEventListener("touchend", onEnd, opts);
    c.addEventListener("touchcancel", onCancel, opts);
    return () => {
      c.removeEventListener("touchstart", onStart);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("touchend", onEnd);
      c.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  // ══════════════════════════════════════
  // CALIBRATION + TEMPLATE + EXPORT
  const finalizeCalib = useCallback(
    (mm, manualPpm) => {
      if (manualPpm) {
        finalizeCalibManual(manualPpm, pushUndo, updSession, dispatch);
        return;
      }
      finalizeCalibRuler(pendingRuler, mm, markups, {
        pushUndo,
        updSession,
        dispatch,
      });
    },
    [pendingRuler, markups, pushUndo, updSession, dispatch],
  );

  const loadTemplate = (analysis) => {
    const newMarkups = [];
    const pointIds = {};
    analysis.pts.forEach((pt) => {
      const alreadyPlaced = markups.some(
        (m) =>
          m.type === "point" &&
          m.placed &&
          m.visible !== false &&
          (m.label?.toLowerCase() === pt.l.toLowerCase() ||
            m.templateLabel?.toLowerCase() === pt.l.toLowerCase()),
      );
      if (alreadyPlaced) return;
      const id = uid();
      pointIds[pt.l] = id;
      newMarkups.push({
        id,
        type: "point",
        points: [{ x: -99999, y: -99999 }],
        label: pt.l,
        templateLabel: pt.l,
        templateId: `${analysis.name}::${pt.l}`,
        definition: pt.def,
        color: pt.color,
        size: 6,
        visible: true,
        placed: false,
      });
    });
    pushUndo();
    updSession({
      markups: [...markups, ...newMarkups],
      analysisTemplate: analysis.name,
    });
    setPlacingQueue(newMarkups.map((m) => m.id));
    dispatch({ type: "SET", payload: { placingIdx: 0 } });
    dispatch({ type: "SET", payload: { placingMode: true } });
    dispatch({ type: "SET", payload: { rightPanel: "markups" } });
    if (analysis.name?.toLowerCase().includes("airway")) {
      dispatch({ type: "SET", payload: { rightPanel: "airway" } });
    }
  };

  const exportCSV = useCallback(() => {
    exportCSVData(markups, calibration, formatAngle, project.name, facing);
  }, [markups, calibration, formatAngle, project.name, facing]);

  // Report images: downscaled to at most REPORT_IMAGE_MAX px (smaller PDFs).
  // The marked-up copy draws the image layers as shown on screen (processing,
  // transforms, overlays), then the tracing with labels sized to print at
  // about 2.3 mm, laid out so they don't overlap.
  // The radiograph's own pixels in image coordinates (for airway edge snapping).
  // Null when the base image is rotated or scaled, where pixels and image
  // coordinates no longer line up 1:1.
  const getImagePixels = useCallback(() => {
    const base = (sessionImage || []).find((x) => x.visible !== false) || sessionImage?.[0];
    const imgEl = base ? imgRefs.current[base.id] : null;
    if (!imgEl || !imgEl.naturalWidth) return null;
    const tf = base.transform || {};
    if ((tf.rot || 0) !== 0 || (tf.scale ?? 1) !== 1) return null;
    const ox = Math.round((base.dx || 0) + (tf.tx || 0)), oy = Math.round((base.dy || 0) + (tf.ty || 0));
    if (ox < 0 || oy < 0) return null;
    const c = document.createElement("canvas");
    c.width = imgEl.naturalWidth + ox;
    c.height = imgEl.naturalHeight + oy;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(imgEl, ox, oy);
    try { return ctx.getImageData(0, 0, c.width, c.height); } catch { return null; }
  }, [sessionImage]);

  const captureReportImages = useCallback(async () => {
    const base = (sessionImage || []).find((x) => x.visible !== false) || sessionImage?.[0];
    const imgEl = base ? imgRefs.current[base.id] : null;
    if (!imgEl || !imgEl.naturalWidth) return { original: null, markup: null };
    const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight;
    const k = reportScale(nw, nh);
    const W = Math.round(nw * k), H = Math.round(nh * k);
    const canvas = () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return [c, ctx];
    };
    const [oc, octx] = canvas();
    octx.drawImage(imgEl, 0, 0, W, H);
    const [mc, ctx] = canvas();
    drawImageLayers(ctx, sessionImage, { zoom: k, pan: { x: 0, y: 0 }, getProcessed, imgRefs });
    // Same fit as the PDF page: 166 mm wide unless the height limit (252 mm) binds.
    const printedMm = Math.min(166, 252 * (W / H));
    const labelScale = printLabelScale(W, printedMm);
    beginLabelLayout(ctx);
    markups
      .filter((m) => m.visible !== false)
      .forEach((m) =>
        drawMarkup(ctx, m, k, { x: 0, y: 0 }, calibration, null, t, false, { w: W, h: H }, angleMode, true, labelScale, null, { facing, annotationBold: true }),
      );
    flushLabelLayout(ctx);
    return { original: oc.toDataURL("image/jpeg", 0.9), markup: mc.toDataURL("image/jpeg", 0.92) };
  }, [sessionImage, markups, calibration, t, facing, angleMode, getProcessed]);

  // Ruler tick detection (calibration dialog): measures the tick spacing along
  // the drawn ruler line — the pending one, or the only ruler.
  const detectTicks = useCallback((tickMm) => {
    const rulers = markups.filter((m) => m.type === "ruler");
    const r = pendingRuler || (rulers.length === 1 ? rulers[0] : null);
    if (!r) {
      return { error: rulers.length > 1 ? "Several rulers are drawn: draw a fresh one along the tick marks, or delete the extra ones." : "Draw a ruler line (⟺ key) along the ruler's tick marks first." };
    }
    const vp = vpts(r);
    if (vp.length < 2) return { error: "The ruler line is incomplete." };
    return detectRulerScale(getImagePixels(), vp[0], vp[1], tickMm);
  }, [markups, pendingRuler, getImagePixels]);
  const applyTicks = useCallback((res) => {
    if (!(res?.pxPerMm > 0)) return;
    pushUndo();
    updSession({ calibration: { done: true, pxPerMm: res.pxPerMm, knownMm: "", method: "ticks", source: `${res.ticks} ticks, ${res.tickMm} mm apart` } });
    dispatch({ type: "SET", payload: { showCalib: false } });
  }, [pushUndo, updSession, dispatch]);

  const measScope = useMemo(
    () => buildScope(markups, calibration, facingSetting),
    [markups, calibration, facingSetting],
  );
  const formulaEngineReady = useFormulaEngine();
  const allMeas = useMemo(
    () =>
      markups
        .map((m) => ({ m, meas: computeMeasurements(m, calibration, { facing }) }))
        .filter((x) => Object.keys(x.meas).length > 0),
    [markups, calibration, facing],
  );
  const formulaMeas = useMemo(() => {
    const res = [];
    formulas.forEach((f) => {
      if (!pinnedFormulas.has(f.id)) return;
      const v = evalFormula(f.expression, measScope);
      if (v !== null && isFinite(v)) {
        res.push({
          m: {
            id: "fm_" + f.id,
            type: "formula",
            label: f.name,
            color: t.acc2,
          },
          meas: { value: v },
        });
      }
    });
    return res;
  }, [formulas, measScope, pinnedFormulas, t, formulaEngineReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const cursorStyle =
    {
      select: "default",
      boxselect: "crosshair",
      pan: "grab",
      point: "crosshair",
      line: "crosshair",
      angle3: "crosshair",
      angle4: "crosshair",
      polygon: "crosshair",
      curve: "crosshair",
      perp: "crosshair",
      parallel: "crosshair",
      midpoint: "crosshair",
      perppoint: "crosshair",
      arrow: "crosshair",
      text: "text",
      ruler: "crosshair",
    }[activeTool] || "default";
  const _availAnalyses = PREDEFINED[project.projection] || [];

  const panelIcons = PANEL_ICONS;
  const panelTabs = PANEL_TABS;

  // ── Gear-settings setters ──
  const _set = (v) => dispatch({ type: "SET", payload: v });
  const setShowAnnotations = (v) =>
    _set({ showAnnotations: typeof v === "function" ? v(showAnnotations) : v });
  const setAnnotationSize = (v) =>
    _set({ annotationSize: typeof v === "function" ? v(annotationSize) : v });
  const setShowDefTooltips = (v) =>
    _set({ showDefTooltips: typeof v === "function" ? v(showDefTooltips) : v });
  const setDefaultLineStyle = (v) =>
    _set({
      defaultLineStyle: typeof v === "function" ? v(defaultLineStyle) : v,
    });
  const setDefaultMarkupColor = (v) =>
    _set({
      defaultMarkupColor: typeof v === "function" ? v(defaultMarkupColor) : v,
    });
  const setDefaultLineWidth = (v) =>
    _set({
      defaultLineWidth: typeof v === "function" ? v(defaultLineWidth) : v,
    });
  const setAutoHideLabels = (v) =>
    _set({ autoHideLabels: typeof v === "function" ? v(autoHideLabels) : v });
  const setAnnotationBold = (v) =>
    _set({ annotationBold: typeof v === "function" ? v(annotationBold) : v });
  const setSnapTolerance = (v) =>
    _set({ snapTolerance: typeof v === "function" ? v(snapTolerance) : v });

  const [autoTraceBusy, setAutoTraceBusy] = useState(false);
  // Auto-trace messages/quality are per-session (i.e. per filmstrip entry):
  // switching the active session must not carry a previous session's warning
  // along with it. Keyed by session id, runtime-only.
  const [autoTraceBySession, setAutoTraceBySession] = useState({});
  const autoTraceSessionId = activeSession?.id || null;
  const autoTraceInfo = (autoTraceSessionId && autoTraceBySession[autoTraceSessionId]?.info) || null;
  const autoTraceQuality = (autoTraceSessionId && autoTraceBySession[autoTraceSessionId]?.quality) || null;
  const setAutoTraceInfo = useCallback((info) => {
    if (!autoTraceSessionId) return;
    setAutoTraceBySession((m) => ({
      ...m,
      [autoTraceSessionId]: { ...(m[autoTraceSessionId] || {}), info },
    }));
  }, [autoTraceSessionId]);
  const setAutoTraceQuality = useCallback((quality) => {
    if (!autoTraceSessionId) return;
    setAutoTraceBySession((m) => ({
      ...m,
      [autoTraceSessionId]: { ...(m[autoTraceSessionId] || {}), quality },
    }));
  }, [autoTraceSessionId]);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const handleAutoTrace = useCallback(async (traceOpts = {}) => {
    const target = sessionImage?.[0] ? imgRefs.current[sessionImage[0].id] : null;
    if (!target) {
      setAutoTraceInfo({ message: "Load an image before running auto-trace.", tone: "warn" });
      return;
    }
    const forceHypothesis = traceOpts?.forceHypothesis || null;
    setAutoTraceBusy(true);
    setAutoTraceInfo({ message: forceHypothesis ? "Re-tracing with the selected image transform…" : "Detecting landmarks…", tone: "info" });
    try {
      const summary = await runAutoTrace({
        imageInput: target,
        calibration,
        store: useSessionStore.getState(),
        forceHypothesis,
        suppressUndo: !!traceOpts.suppressUndo,
      });
      setAutoTraceQuality(summary.quality || null);
      if (summary.backend === "mock") {
        setAutoTraceInfo({
          message: summary.added
            ? `Demo detector placed ${summary.added} placeholder points — these are NOT anatomically accurate. Configure a trained model to trace real landmarks.`
            : "Demo detector found nothing to add.",
          tone: "warn",
        });
        return;
      }
      if (!summary.added) {
        setAutoTraceInfo({ message: "No new landmarks detected.", tone: "warn" });
        return;
      }
      const q = summary.quality;
      const qLevel = q?.level || "high";
      const qNote = qLevel === "high"
        ? ` (confidence ${Math.round((q.meanConfidence || 0) * 100)}%)`
        : qLevel === "medium"
          ? " — low confidence, please verify these points"
          : " — low confidence, review carefully before using these measurements";
      const xNote = summary.orientation === "mirrored"
        ? " Image appears horizontally mirrored — landmarks were re-mapped to match it."
        : summary.polarity === "inverted"
          ? " Image polarity was inverted before tracing."
          : "";
      setAutoTraceInfo({
        message: `AI placed ${summary.added} landmark${summary.added === 1 ? "" : "s"}${qNote}.${xNote} Choose an analysis to build measurements.`,
        tone: qLevel === "high" ? "ok" : qLevel === "medium" ? "warn" : "err",
      });
      setShowAnalysisModal(true);
    } catch (e) {
      setAutoTraceInfo({ message: `Auto-trace failed: ${e?.message || e}`, tone: "err" });
    } finally {
      setAutoTraceBusy(false);
    }
  }, [sessionImage, calibration, setAutoTraceInfo, setAutoTraceQuality]);

  const handleAutoTraceRetry = useCallback((hyp) => {
    // Drop the previous AI points so a re-trace replaces rather than duplicates.
    // The snapshot is pushed *before* the removal, so a single undo restores the
    // trace the user is replacing — suppressUndo keeps the insert on that same
    // history step instead of adding a second one.
    const st = useSessionStore.getState();
    const aiIds = (st.markups || [])
      .filter((m) => m.aiPlaced === true || typeof m.aiConfidence === "number")
      .map((m) => m.id);
    if (aiIds.length) {
      st.pushUndo();
      st.updMarkups((ms) => ms.filter((m) => !aiIds.includes(m.id)));
    }
    handleAutoTrace({ forceHypothesis: hyp, suppressUndo: aiIds.length > 0 });
  }, [handleAutoTrace]);

  const handlePickAnalysis = useCallback((analysisName) => {
    setShowAnalysisModal(false);
    if (!analysisName) return;
    const analysis = findAnalysis(analysisName);
    if (!analysis) return;
    const res = applyAnalysis(markups, analysis, calibration, facingSetting);
    pushUndo();
    const mergedNorms = [...norms];
    for (const n of res.norms) {
      if (!mergedNorms.some((x) => x.markupLabel === n.markupLabel && x.measureType === n.measureType)) mergedNorms.push(n);
    }
    updSession({
      markups: refreshAutoMeas(res.markups),
      analysisTemplate: analysis.name,
      norms: mergedNorms,
    });
    const qids = res.missing.map((m) => m.id);
    dispatch({ type: "SET", payload: { placingQueue: qids } });
    dispatch({ type: "SET", payload: { placingIdx: 0 } });
    dispatch({ type: "SET", payload: { placingMode: qids.length > 0 } });
    dispatch({ type: "SET", payload: { rightPanel: "markups" } });
    setAutoTraceInfo({
      message: `${analysis.name}: ${res.measurements.length} measurement${res.measurements.length === 1 ? "" : "s"} computed from AI points${
        res.missing.length ? `, ${res.missing.length} landmark${res.missing.length === 1 ? "" : "s"} left to place` : ""
      }.`,
      tone: res.missing.length ? "info" : "ok",
    });
  }, [markups, calibration, facingSetting, norms, refreshAutoMeas, pushUndo, updSession, dispatch, setAutoTraceInfo]);

  // ── Panel prop bundles ──
  const pMarkups = {
    markups,
    t,
    theme,
    selectedId,
    onSelect: selectAndFocusMarkup,
    onReviewNext: reviewNext,
    onDelete: delMarkup,
    calibration,
    placingMode,
    placingQueue,
    placingIdx,
    norms,
    formatAngle,
    angleMode,
    setAngleMode,
    facingSetting,
    setFacingSetting,
    facing,
    replacingId,
    dispatch,
    showCpAlways,
    showAnchorAlways,
    showAnnotations,
    setShowAnnotations,
    annotationSize,
    setAnnotationSize,
    showDefTooltips,
    setShowDefTooltips,
    showDisplacement,
    setShowDisplacement,
    showGrid,
    setShowGrid,
    showAirwayOverlay,
    setShowAirwayOverlay,
    showGroupsLegend,
    setShowGroupsLegend,
    defaultLineStyle,
    setDefaultLineStyle,
    defaultMarkupColor,
    setDefaultMarkupColor,
    defaultLineWidth,
    setDefaultLineWidth,
    autoHideLabels,
    setAutoHideLabels,
    annotationBold,
    setAnnotationBold,
    snapTolerance,
    setSnapTolerance,
    onLockAll: () => {
      pushUndo();
      updSession({ markups: markups.map((m) => ({ ...m, locked: true })) });
    },
    onUnlockAll: () => {
      pushUndo();
      updSession({ markups: markups.map((m) => ({ ...m, locked: false })) });
    },
    onToggleVisible: (id) => {
      pushUndo();
      updMarkup(id, {
        visible: markups.find((m) => m.id === id)?.visible === false,
      });
    },
    onToggleLock: (id) => {
      pushUndo();
      updMarkup(id, { locked: !markups.find((m) => m.id === id)?.locked });
    },
    onToggleLabel: (id) => {
      pushUndo();
      updMarkup(id, { noLabel: !markups.find((m) => m.id === id)?.noLabel });
    },
    onToggleGroupVisible: (types) => {
      const group = markups.filter((m) => types.includes(m.type));
      if (!group.length) return;
      const allVisible = group.every((m) => m.visible !== false);
      pushUndo();
      updSession({
        markups: refreshAutoMeas(
          markups.map((m) =>
            types.includes(m.type)
              ? { ...m, visible: allVisible ? false : true }
              : m,
          ),
        ),
      });
    },
    onStopPlacing: () => {
      dispatch({
        type: "SET",
        payload: { placingMode: false, placingQueue: [], placingIdx: 0 },
      });
    },
    onPausePlacing: () =>
      dispatch({ type: "SET", payload: { placingMode: false } }),
    onResumePlacing: () => {
      // "Start" with no queue: queue the landmarks that are not placed yet.
      if (!useToolStore.getState().placingQueue.length) {
        const qids = useSessionStore.getState().markups
          .filter((m) => m.type === "point" && m.placed === false)
          .map((m) => m.id);
        if (!qids.length) {
          notify("Every landmark is already placed.", { tone: "ok" });
          return;
        }
        dispatch({ type: "SET", payload: { placingQueue: qids, placingIdx: 0, placingMode: true } });
        return;
      }
      dispatch({ type: "SET", payload: { placingMode: true } });
    },
    onClear: () => {
      pushUndo();
      updSession({ markups: [] });
    },
    onAddPoint: () => {
      dispatch({
        type: "SET",
        payload: { activeTool: "point", currentDraw: null },
      });
    },
    // AI auto-trace is gated off in production until the model/ORT assets are
    // hosted (Phase 2). Dev always shows it. MarkupsPanel hides the button when
    // `onAutoTrace` is absent.
    ...(LANDMARK_MODEL.enabled || import.meta.env.DEV
      ? {
          onAutoTrace: handleAutoTrace,
          autoTraceBusy,
          autoTraceInfo,
          autoTraceQuality,
          onAutoTraceDismiss: () => setAutoTraceInfo(null),
          onAutoTraceRetry: handleAutoTraceRetry,
        }
      : {}),
    onReplace: (type, id) => {
      if (replacingId === id) {
        dispatch({
          type: "SET",
          payload: { replacingId: null, activeTool: "select" },
        });
      } else {
        dispatch({
          type: "SET",
          payload: { replacingId: id, activeTool: type },
        });
      }
      dispatch({ type: "SET", payload: { currentDraw: null } });
    },
  };
  const pSessions = {
    project,
    t,
    onUpdateProject,
    activeSession,
    compareSession,
    setCompareSession,
    showDisplacement,
    setShowDisplacement,
    displacementOverlay,
    setDisplacementOverlay,
    refLandmark1,
    setRefLandmark1,
    refLandmark2,
    setRefLandmark2,
    overlayBlend,
    setOverlayBlend,
    overlayAlignMode,
    setOverlayAlignMode,
    overlayVectorScale,
    setOverlayVectorScale,
    showTrackingLines,
    setShowTrackingLines,
    showAirwayOverlay,
    setShowAirwayOverlay,
    calibration,
    formatAngle,
    setActiveSession: (id) =>
      onUpdateProject({ ...project, activeSessionId: id }),
    onExportTemplate: (v) =>
      exportCepht({
        name: `${project.name}`,
        projection: project.projection,
        markups: v.markups || [],
        formulas: v.formulas || [],
        norms: v.norms || [],
      }),
  };

  return (
    <div
      className="app-root"
      style={{
        display: "flex",
        flexDirection: "column",
        background: t.bg,
        color: t.tx,
        fontFamily: "'DM Sans',sans-serif",
        overflow: "hidden",
      }}
    >
      {/* hidden file inputs */}
      <input
        ref={openImgRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) loadImage(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={stackImgRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) loadImage(e.target.files[0], true);
          e.target.value = "";
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept=".cephx"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) onImport(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {/* TOP BAR */}
      <TopBar
        t={t}
        theme={theme}
        project={project}
        onHome={onHome}
        compareSession={compareSession}
        showAnnotations={showAnnotations}
        annotationSize={annotationSize}
        showDisplacement={showDisplacement}
        onSave={handleSaveProject}
        openImgRef={openImgRef}
        importRef={importRef}
        dispatch={dispatch}
        calibration={calibration}
        snapEnabled={snapEnabled}
        showScaleBar={showScaleBar}
        showDefTooltips={showDefTooltips}
        placingMode={placingMode}
        placingQueue={placingQueue}
        placingIdx={placingIdx}
        setTheme={setTheme}
      />

      {/* BODY */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Toolbar + Canvas — always visible; bottom sheet overlays on mobile */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Toolbar
            activeTool={activeTool}
            theme={theme}
            t={t}
            dispatch={dispatch}
            setActiveTool={setActiveTool}
            sessionImage={sessionImage}
            calibration={calibration}
            spotlightMode={spotlightMode}
            updSession={updSession}
            panRef={panRef}
            zoomRef={zoomRef}
            undo={undo}
            undoSteps={undoSteps}
            redo={redo}
            handleDblClick={handleDblClick}
            currentDraw={currentDraw}
            mobileToolsExpanded={mobileToolsExpanded}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            }}
          >
            {isMobile && (
              <SessionFilmstrip
                compact
                project={project}
                t={t}
                onUpdateProject={onUpdateProject}
              />
            )}
            <div
              ref={containerRef}
              className="canvas-wrapper"
              style={{ flex: 1, background: t.bg, position: "relative" }}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  cursor: cursorStyle,
                  touchAction: "none",
                  background: "transparent",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onAuxClick={(e) => e.preventDefault()}
                onDoubleClick={handleDblClick}
                onContextMenu={handleCanvasContextMenu}
              />
              {loadingImages && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: t.bg + "cc",
                    zIndex: 10,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        border: `3px solid ${t.bdr}`,
                        borderTopColor: t.acc,
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        margin: "0 auto 10px",
                      }}
                    />
                    <div style={{ fontSize: 13, color: t.tx2 }}>
                      Loading images…
                    </div>
                  </div>
                </div>
              )}
              {placingMode &&
                placingQueue.length > 0 &&
                placingIdx < placingQueue.length &&
                markups.find((x) => x.id === placingQueue[placingIdx]) && (
                  <>
                    {magnifierOn && !isPhone && <Magnifier canvasRef={canvasRef} t={t} />}
                    <PlacingGuide
                      t={t}
                      markup={markups.find((x) => x.id === placingQueue[placingIdx])}
                      idx={placingIdx}
                      total={placingQueue.length}
                      unsure={placingUnsureId === placingQueue[placingIdx]}
                      onToggleUnsure={() => {
                        const qid = placingQueue[placingIdx];
                        setPlacingUnsureId((v) => (v === qid ? null : qid));
                      }}
                      onSkip={placingSkip}
                      onBack={placingBack}
                      magnifier={magnifierOn}
                      onToggleMagnifier={toggleMagnifier}
                    />
                  </>
                )}
              <div className="draw-status">
                {currentDraw && (
                  <div
                    style={{
                      background: t.acc + "22",
                      border: `1px solid ${t.acc}`,
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 11,
                      color: t.acc,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {["polygon", "curve", "polyline", "bezier"].includes(
                      activeTool,
                    )
                      ? `${currentDraw.points.length} pts · ${isMobile ? "double-tap to finish" : "dbl-click to finish"}`
                      : activeTool === "tangent"
                        ? `${currentDraw.points.length === 1 ? (currentDraw.tangentAngle != null ? "tangent snapped · click for endpoint" : "click 2nd point") : ""}`
                        : activeTool === "mirror"
                          ? currentDraw.points.length === 1
                            ? "select axis pt 1"
                            : currentDraw.points.length === 2
                              ? "select axis pt 2 → mirror"
                              : ""
                          : (() => {
                              const n = {
                                line: 2,
                                angle3: 3,
                                angle4: 4,
                                perp: 3,
                                ruler: 2,
                                ellipse: 3,
                                arc: 3,
                                circle: 2,
                                tangent: 2,
                                concentric: 3,
                              }[activeTool];
                              return n
                                ? `${currentDraw.points.length}/${n}`
                                : `${currentDraw.points.length} pts`;
                            })()}
                  </div>
                )}
              </div>
              <div className="filmstrip-container">
                {filmstripOpen ? (
                  <div
                    className="filmstrip-open"
                    style={{
                      borderRadius: 8,
                      background: t.surf + "ee",
                      border: `1px solid ${t.bdr}`,
                      boxShadow: `0 2px 12px ${t.shadow}44`,
                      backdropFilter: "blur(6px)",
                      display: "flex",
                      alignItems: "stretch",
                      overflow: "hidden",
                    }}
                  >
                    <SessionFilmstrip
                      project={project}
                      t={t}
                      onUpdateProject={onUpdateProject}
                    />
                    <button
                      onClick={() => setFilmstripOpen(false)}
                      title="Collapse filmstrip"
                      style={{
                        background: "none",
                        border: "none",
                        borderLeft: `1px solid ${t.bdr}`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 6px",
                        color: t.tx3,
                        fontSize: 10,
                        flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = t.tx)}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = t.tx3)
                      }
                    >
                      ◀
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setFilmstripOpen(true)}
                    title="Show filmstrip"
                    className="filmstrip-collapsed"
                    style={{
                      background: t.surf + "ee",
                      border: `1px solid ${t.bdr}`,
                      borderRadius: 6,
                      boxShadow: `0 2px 12px ${t.shadow}44`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 4px",
                      color: t.tx3,
                      fontSize: 10,
                      backdropFilter: "blur(6px)",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = t.tx)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = t.tx3)}
                  >
                    ▶
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — desktop only */}
        {!isMobile && (
          <div
            ref={panelRef}
            className={`right-panel${showMobilePanel ? " right-panel-open" : ""}`}
            style={{
              width: rightPanelWidth,
              background: t.surf,
              userSelect: rightPanelResizing ? "none" : "auto",
              cursor: rightPanelResizing ? "col-resize" : "auto",
              transition: "width 0.25s ease",
            }}
          >
            <RightPanelSidebar
              t={t}
              rightPanel={rightPanel}
              setRightPanel={setRightPanel}
              panelTabs={panelTabs}
              toggleBtnRef={toggleBtnRef}
              toggleCollapsed={toggleCollapsed}
              showMobilePanel={showMobilePanel}
            />
            <div
              ref={contentRef}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minWidth: 0,
                maxWidth: 800,
                opacity: 1,
                transition: "max-width 0.25s ease, opacity 0.2s ease",
              }}
            >
              <PanelContent
                rightPanel={rightPanel}
                panelIcons={panelIcons}
                panelTabs={panelTabs}
                t={t}
                pMarkups={pMarkups}
                pSessions={pSessions}
                allMeas={allMeas}
                formulaMeas={formulaMeas}
                calibration={calibration}
                norms={norms}
                formatAngle={formatAngle}
                exportCSV={exportCSV}
                userPresets={userPresets}
                handleSavePreset={handleSavePreset}
                handleDeletePreset={handleDeletePreset}
                updSession={updSession}
                dispatch={dispatch}
                formulas={formulas}
                measScope={measScope}
                pinnedFormulas={pinnedFormulas}
                setPinnedFormulas={setPinnedFormulas}
                processing={processing}
                lutMode={lutMode}
                lutInvert={lutInvert}
                showLUT={showLUT}
                setShowLUT={setShowLUT}
                showScaleBar={showScaleBar}
                setShowScaleBar={setShowScaleBar}
                showHistogram={showHistogram}
                setShowHistogram={setShowHistogram}
                sessionImage={sessionImage}
                sourceWindow={sourceWindow}
                stackImgRef={stackImgRef}
                project={project}
                onUpdateProject={onUpdateProject}
                markups={markups}
                loadAirwayTier={loadAirwayTier}
                showAirwayOverlay={showAirwayOverlay}
                setShowAirwayOverlay={setShowAirwayOverlay}
                loadTemplate={loadTemplate}
                patientSex={patientSex}
                patientAge={patientAge}
                getImagePixels={getImagePixels}
                canvasSize={canvasSize}
                toImage={toImage}
                addMarkup={addMarkup}
                pushUndo={pushUndo}
              />
              {selectedMarkup && (
                <div
                  className="markupprops-panel"
                  style={{
                    borderTop: `1px solid ${t.bdr}`,
                    padding: 12,
                    flexShrink: 0,
                    overflowY: "auto",
                    scrollbarWidth: "none",
                  }}
                >
                  <MarkupProps
                    m={selectedMarkup}
                    t={t}
                    theme={theme}
                    onUpdate={(p) => {
                      pushUndo();
                      updMarkup(selectedMarkup.id, p);
                      if (p.color && selectedMarkup.group) {
                        markups
                          .filter(
                            (x) =>
                              x.id !== selectedMarkup.id &&
                              x.group === selectedMarkup.group &&
                              x.type === "point",
                          )
                          .forEach((x) =>
                            updMarkup(x.id, {
                              color: p.color,
                              strokeColor: p.color,
                              fillColor: p.color + "22",
                            }),
                          );
                      }
                    }}
                    onDelete={() => delMarkup(selectedMarkup.id)}
                    calibration={calibration}
                    onParallel={() =>
                      dispatch({
                        type: "SET",
                        payload: { activeTool: "parallel" },
                      })
                    }
                    formatAngle={formatAngle}
                    norms={norms}
                    onUpdateNorms={(ns) => updSession({ norms: ns })}
                    groupOptions={groupOptions}
                    stageOptions={stageOptions}
                  />
                </div>
              )}
            </div>
            <div
              onMouseDown={() =>
                dispatch({ type: "SET", payload: { rightPanelResizing: true } })
              }
              style={{
                width: 4,
                cursor: "col-resize",
                background: rightPanelResizing ? t.acc : "transparent",
                transition: "background 0.15s",
                flexShrink: 0,
              }}
            />
          </div>
        )}
      </div>

      {/* MOBILE: swipeable bottom sheet (overlays canvas) */}
      {isMobile && (
        <MobileBottomSheet
          t={t}
          isOpen={mobileTab !== "canvas"}
          onClose={closeSheet}
        >
          {mobileTab === "more" ? (
            <MobileMorePanel
              t={t}
              panels={panelTabs.filter(
                ([k]) => !["markups", "measurements"].includes(k),
              )}
              panelIcons={panelIcons}
              onSelect={(key) => {
                useUIStore.setState({ mobileTab: key, rightPanel: key });
              }}
              theme={theme}
              setTheme={setTheme}
              onSaveProject={handleSaveProject}
              dispatch={dispatch}
            />
          ) : (
            <>
              <PanelContent
                rightPanel={rightPanel}
                panelIcons={panelIcons}
                panelTabs={panelTabs}
                t={t}
                pMarkups={pMarkups}
                pSessions={pSessions}
                allMeas={allMeas}
                formulaMeas={formulaMeas}
                calibration={calibration}
                norms={norms}
                formatAngle={formatAngle}
                exportCSV={exportCSV}
                userPresets={userPresets}
                handleSavePreset={handleSavePreset}
                handleDeletePreset={handleDeletePreset}
                updSession={updSession}
                dispatch={dispatch}
                formulas={formulas}
                measScope={measScope}
                pinnedFormulas={pinnedFormulas}
                setPinnedFormulas={setPinnedFormulas}
                processing={processing}
                lutMode={lutMode}
                lutInvert={lutInvert}
                showLUT={showLUT}
                setShowLUT={setShowLUT}
                showScaleBar={showScaleBar}
                setShowScaleBar={setShowScaleBar}
                showHistogram={showHistogram}
                setShowHistogram={setShowHistogram}
                sessionImage={sessionImage}
                sourceWindow={sourceWindow}
                stackImgRef={stackImgRef}
                project={project}
                onUpdateProject={onUpdateProject}
                markups={markups}
                loadAirwayTier={loadAirwayTier}
                showAirwayOverlay={showAirwayOverlay}
                setShowAirwayOverlay={setShowAirwayOverlay}
                loadTemplate={loadTemplate}
                patientSex={patientSex}
                patientAge={patientAge}
                getImagePixels={getImagePixels}
                canvasSize={canvasSize}
                toImage={toImage}
                addMarkup={addMarkup}
                pushUndo={pushUndo}
              />
              {selectedMarkup && (
                <div
                  style={{
                    borderTop: `1px solid ${t.bdr}`,
                    padding: 12,
                    flexShrink: 0,
                  }}
                >
                  <MarkupProps
                    m={selectedMarkup}
                    t={t}
                    theme={theme}
                    onUpdate={(p) => {
                      pushUndo();
                      updMarkup(selectedMarkup.id, p);
                      if (p.color && selectedMarkup.group) {
                        markups
                          .filter(
                            (x) =>
                              x.id !== selectedMarkup.id &&
                              x.group === selectedMarkup.group &&
                              x.type === "point",
                          )
                          .forEach((x) =>
                            updMarkup(x.id, {
                              color: p.color,
                              strokeColor: p.color,
                              fillColor: p.color + "22",
                            }),
                          );
                      }
                    }}
                    onDelete={() => delMarkup(selectedMarkup.id)}
                    calibration={calibration}
                    onParallel={() =>
                      dispatch({
                        type: "SET",
                        payload: { activeTool: "parallel" },
                      })
                    }
                    formatAngle={formatAngle}
                    norms={norms}
                    onUpdateNorms={(ns) => updSession({ norms: ns })}
                    groupOptions={groupOptions}
                    stageOptions={stageOptions}
                  />
                </div>
              )}
            </>
          )}
        </MobileBottomSheet>
      )}

      {isMobile && <MobileTabBar t={t} />}

      <ContextMenu
        theme={t}
        markups={markups}
        calibration={calibration}
        onAddMarkup={addMarkup}
        onUpdMarkup={updMarkup}
        onUpdMarkups={updMarkups}
        onSelectAndFocus={selectAndFocusMarkup}
        onDelMarkup={delMarkup}
        onFitToView={fitToView}
      />

      {/* MODALS */}
      {showCalib && (
        <Modal
          t={t}
          title="Calibration"
          onClose={() =>
            dispatch({ type: "SET", payload: { showCalib: false } })
          }
        >
          <CalibModal
            t={t}
            calibration={calibration}
            onFinish={finalizeCalib}
            rulerLabel={pendingRuler?.label || null}
            rulerCount={markups.filter((m) => m.type === "ruler").length}
            onDetectTicks={detectTicks}
            onApplyTicks={applyTicks}
          />
        </Modal>
      )}
      {showExport && (
        <Modal
          t={t}
          title="Export"
          onClose={() =>
            dispatch({ type: "SET", payload: { showExport: false } })
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <GuideBtn t={t} onClick={() => setGuideKey("export")} />
            </div>
            <Btn
              t={t}
              onClick={() => {
                exportCSV();
                dispatch({ type: "SET", payload: { showExport: false } });
              }}
            >
              Measurements CSV
            </Btn>
            <Btn
              t={t}
              onClick={async () => {
                const anon = await anonymizeProject(project, {
                  reason: "export",
                });
                onSave?.(anon);
                dispatch({ type: "SET", payload: { showExport: false } });
              }}
            >
              Anonymized .cephx (recommended)
            </Btn>
            <Btn
              t={t}
              danger={hasUnanonymizedPHI(project)}
              onClick={async () => {
                if (
                  hasUnanonymizedPHI(project) &&
                  !(await askConfirm({
                    title: "Export with patient identifiers?",
                    message: "This project still contains patient identifiers (name, DOB, age, etc.). A full project file will include them. Consider exporting an anonymized .cephx instead.",
                    confirmLabel: "Export anyway",
                    danger: true,
                  }))
                )
                  return;
                onSave?.(project);
                dispatch({ type: "SET", payload: { showExport: false } });
              }}
            >
              {hasUnanonymizedPHI(project)
                ? "⚠ Full Project .cephx (contains PHI)"
                : "Full Project .cephx"}
            </Btn>
            <Btn
              t={t}
              onClick={() => {
                setReportSections({ ...defaultSections });
                setShowReportOptions(true);
              }}
            >
              PDF Report
            </Btn>
            <Btn
              t={t}
              onClick={async () => {
                const name = await askText({ title: "Export template", label: "Template name", defaultValue: project.name });
                if (name) {
                  exportTemplateAsCepht(project, name);
                  dispatch({ type: "SET", payload: { showExport: false } });
                }
              }}
            >
              Template .cepht (definitions only)
            </Btn>
            <Btn
              t={t}
              onClick={async () => {
                const name = await askText({ title: "Export template with placed points", label: "Template name", defaultValue: project.name + " (placed)" });
                if (name) {
                  exportTemplateAsCepht(project, name, true);
                  dispatch({ type: "SET", payload: { showExport: false } });
                }
              }}
            >
              Template .cepht (with placements)
            </Btn>
            <Btn
              t={t}
              ghost
              onClick={() => {
                const p = profileProject(project);
                showInfo({
                  title: "Project size",
                  items: [`Images: ${p.imgMB} MB`, `Research: ${p.rsMB} MB`, `Meta/subjects: ${p.otherMB} MB`, `Total: ${p.grandTotalMB} MB`],
                  message: "The browser console has the full breakdown.",
                });
              }}
            >
              Check Size
            </Btn>
          </div>
        </Modal>
      )}
      {showReportOptions && (
        <Modal
          t={t}
          title="PDF Report Options"
          onClose={() => setShowReportOptions(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div role="radiogroup" aria-label="Report style" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: t.tx2 }}>Style</span>
              {[
                ["light", "Light (white pages)"],
                ["dark", "Dark (Plasticity)"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={reportTheme === id}
                  onClick={() => useUIStore.setState({ reportTheme: id })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${reportTheme === id ? t.acc : t.bdr}`,
                    background: reportTheme === id ? t.accMuted : "transparent",
                    color: reportTheme === id ? t.acc : t.tx2,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {(() => {
              const sealed = sealedSessions(project);
              const others = (project.sessions || []).filter((s) => s.id !== activeSession?.id && !sealed.has(s.id));
              if (!others.length) return null;
              return (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.tx2, marginBottom: 6, flexWrap: "wrap" }}>
                  Compare with
                  <select value={reportCompareId} onChange={(e) => setReportCompareId(e.target.value)}
                    style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13 }}>
                    <option value="">No comparison</option>
                    {others.map((s) => <option key={s.id} value={s.id}>{[s.label, s.name].filter(Boolean).join(" · ") || "Session"}</option>)}
                  </select>
                </label>
              );
            })()}
            <div style={{ fontSize: 11, color: t.tx2, marginBottom: 4 }}>
              Select sections to include in the report:
            </div>
            {[
              ["cover", "Cover Page"],
              ["images", "Original & Marked-up Images"],
              ["measurements", "Measurements Table"],
              ["normograms", "Normogram Charts"],
              ["airway", "Airway Assessment"],
              ["research", "Research Studies"],
              ["formulas", "Custom Formulas"],
              ["interpretation", "Clinical Interpretation"],
            ].map(([key, label]) => (
              <Fragment key={key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() =>
                    setReportSections((s) => ({ ...s, [key]: !s[key] }))
                  }
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: `1px solid ${reportSections[key] ? t.acc : t.bdr}`,
                    background: reportSections[key]
                      ? t.acc + "22"
                      : "transparent",
                    color: reportSections[key] ? t.acc : t.tx3,
                    cursor: "pointer",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {reportSections[key] && <span>✓</span>}
                </button>
                <span
                  style={{
                    fontSize: 13,
                    color: t.tx,
                    userSelect: "none",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setReportSections((s) => ({ ...s, [key]: !s[key] }))
                  }
                >
                  {label}
                </span>
              </div>
              {key === "research" && reportSections.research && (() => {
              const studies = (project.researchStudies || []).filter((st) => !st.archived && st.results && !st.results.error);
              if (!studies.length) return <div style={{ fontSize: 12, color: t.tx3, marginLeft: 30 }}>No research study has results yet.</div>;
              const chosen = reportStudyIds || studies.map((st) => st.id);
              return (
                <div role="group" aria-label="Studies to include" style={{ marginLeft: 30, display: "flex", flexDirection: "column", gap: 4 }}>
                  {studies.map((st) => (
                    <label key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.tx2, cursor: "pointer" }}>
                      <input type="checkbox" checked={chosen.includes(st.id)}
                        onChange={() => setReportStudyIds(chosen.includes(st.id) ? chosen.filter((id) => id !== st.id) : [...chosen, st.id])} />
                      {st.name || st.type}
                    </label>
                  ))}
                </div>
              );
              })()}
              </Fragment>
            ))}
            <div
              style={{
                borderTop: `1px solid ${t.bdr}`,
                marginTop: 10,
                paddingTop: 12,
                display: "flex",
                gap: 10,
              }}
            >
              <Btn
                t={t}
                onClick={async () => {
                  setShowReportOptions(false);
                  if (
                    hasUnanonymizedPHI(project) &&
                    !(await askConfirm({
                      title: "Report with patient identifiers?",
                      message: "This project contains patient identifiers (name, DOB, etc.). The PDF report will include them on the cover. This software is intended for research and educational purposes only.",
                      confirmLabel: "Create report",
                      danger: true,
                    }))
                  ) {
                    setShowReportOptions(true);
                    return;
                  }
                  try {
                    const { original: origUrl, markup: markupUrl } = await captureReportImages();
                    // Same as the Interpretation panel: linear measures need calibration.
                    const interp = generateInterpretation(allMeas, norms, calibration);
                    setReportBusy(true);
                    const [{ generateReport }, { captureStudyCharts }, { renderLatex }] = await Promise.all([
                      import("./report/reportGenerator.js"),
                      import("./report/studyChartCapture.jsx"),
                      import("./report/latexCapture.js"),
                      loadFormulaEngine().catch(() => false),
                    ]);
                    const cmp = (project.sessions || []).find((s) => s.id === reportCompareId && s.id !== activeSession?.id);
                    const fv = {};
                    formulas.forEach((f) => {
                      const v = evalFormula(f.expression, measScope);
                      if (v !== null) fv[f.id] = v;
                    });
                    const doc = await generateReport({
                      project,
                      session: activeSession,
                      allMeas,
                      markups,
                      norms,
                      formulas,
                      formulaValues: fv,
                      originalImageDataUrl: origUrl,
                      markupImageDataUrl: markupUrl,
                      interpretation: interp,
                      // The Airway panel's live results for this session.
                      airway: {
                        measurements: computeAirwayMeasurements(markups, calibration, patientSex, patientAge),
                        sessionName: activeSession?.name,
                      },
                      calibration,
                      facing,
                      sections: reportSections,
                      theme: reportTheme,
                      compare: cmp ? { ...cmp, facing: resolveFacing(cmp.facing, cmp.markups) } : null,
                      studyIds: reportStudyIds,
                      captureStudyCharts,
                      renderLatex,
                      formulaTex,
                      clinic: reportClinicName || reportClinicLogo ? { name: reportClinicName, logo: reportClinicLogo } : null,
                      save: false,
                    });
                    const blob = doc.output("blob");
                    setReportPreview({ url: URL.createObjectURL(blob), fileName: doc._fileName, pages: doc.internal.getNumberOfPages() });
                  } catch (e) {
                    logError("PDF generation failed:", e);
                    notify("The PDF report could not be created. " + (e?.message || ""), { tone: "err" });
                  } finally {
                    setReportBusy(false);
                  }
                }}
                style={{ flex: 1 }}
              >
                Generate PDF
              </Btn>
              <Btn
                t={t}
                onClick={() => setShowReportOptions(false)}
                style={{ flex: 1 }}
                ghost
              >
                Cancel
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      {reportBusy && (
        <div role="status" aria-live="polite" style={{ position: "fixed", inset: 0, zIndex: 3000, background: BACKDROP, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 22px", borderRadius: 12, background: t.surf, border: `1px solid ${t.bdr}`, color: t.tx, fontSize: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${t.bdr}`, borderTopColor: t.acc, animation: "spin 0.8s linear infinite" }} />
            Creating the PDF report…
          </div>
        </div>
      )}
      {reportPreview && (
        <Modal
          t={t}
          title={`Report preview · ${reportPreview.pages} page${reportPreview.pages === 1 ? "" : "s"}`}
          customWidth={900}
          onClose={() => { URL.revokeObjectURL(reportPreview.url); setReportPreview(null); }}
        >
          <iframe title="PDF report preview" src={reportPreview.url} style={{ width: "100%", height: "70vh", border: `1px solid ${t.bdr}`, borderRadius: 6, background: "#fff" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 12, color: t.tx3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reportPreview.fileName}</span>
            <Btn t={t} ghost onClick={() => { URL.revokeObjectURL(reportPreview.url); setReportPreview(null); setShowReportOptions(true); }}>Change options</Btn>
            <Btn
              t={t}
              onClick={() => {
                const a = document.createElement("a");
                a.href = reportPreview.url;
                a.download = reportPreview.fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              Download PDF
            </Btn>
          </div>
        </Modal>
      )}
      {pendingTextPos && (
        <Modal
          t={t}
          title="Text Annotation"
          onClose={() =>
            dispatch({ type: "SET", payload: { pendingTextPos: null } })
          }
        >
          <TextModal
            t={t}
            defaultColor="#fbbf24"
            onConfirm={(txt, opts) => {
              addMarkup({
                type: "text",
                points: [pendingTextPos],
                text: txt,
                ...opts,
              });
              dispatch({ type: "SET", payload: { pendingTextPos: null } });
            }}
            onCancel={() =>
              dispatch({ type: "SET", payload: { pendingTextPos: null } })
            }
          />
        </Modal>
      )}
      {showSettings && (
        <SettingsModal
          t={t}
          theme={theme}
          setTheme={setTheme}
          angleMode={angleMode}
          setAngleMode={setAngleMode}
          facingSetting={facingSetting}
          setFacingSetting={setFacingSetting}
          resolvedFacing={facing}
          magnifierOn={magnifierOn}
          toggleMagnifier={toggleMagnifier}
          storageEncrypted={secureStorageAvailable()}
          onBackup={onBackup}
          onDrive={onDrive}
          onClose={() => useUIStore.setState({ showSettings: false })}
        />
      )}
      {showAnon && (
        <Modal
          t={t}
          title="Anonymization"
          onClose={() =>
            dispatch({ type: "SET", payload: { showAnon: false } })
          }
        >
          <AnonModal
            t={t}
            project={project}
            onUpdateProject={onUpdateProject}
            onClose={() =>
              dispatch({ type: "SET", payload: { showAnon: false } })
            }
          />
        </Modal>
      )}
      {showNormogram && (
        <Modal
          t={t}
          title="Cephalometric Normogram"
          wide
          onClose={() =>
            dispatch({ type: "SET", payload: { showNormogram: false } })
          }
        >
          <NormogramPanel
            markups={markups}
            norms={norms}
            t={t}
            formatAngle={formatAngle}
            calibration={calibration}
            facing={facing}
            // Sessions sealed by a blinded reliability study are not offered for comparison.
            sessions={(project.sessions || []).filter((s) => !sealedSessions(project).has(s.id))}
            activeSessionId={activeSession?.id}
            caseName={project.name}
          />
        </Modal>
      )}

      {activeSeal && !researchOpen && (
        <SealedSessionCover
          t={t}
          seal={activeSeal}
          onOpenResearch={() => useUIStore.setState({ researchOpen: true })}
          onUnseal={() => onUpdateProject((prev) => unsealSession(prev, activeSeal.studyId, activeSession.id))}
        />
      )}

      {researchOpen && (
        <Suspense
          fallback={
            <div role="status" style={{ position: "fixed", inset: 0, zIndex: 60, background: t.bg, color: t.tx2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              Loading the Research workspace…
            </div>
          }
        >
          <ResearchWorkspace
            t={t}
            project={project}
            onUpdateProject={onUpdateProject}
            calibration={calibration}
            onClose={closeResearch}
          />
        </Suspense>
      )}

      {showAnalysisModal && (
        <AnalysisModal
          t={t}
          projection={project.projection}
          markups={markups}
          quality={autoTraceQuality}
          onPick={handlePickAnalysis}
          onClose={() => handlePickAnalysis(null)}
        />
      )}

      {showFormulaEditor && (
        <Modal
          t={t}
          title={editFormulaId ? "Edit Formula" : "New Formula"}
          onClose={() =>
            dispatch({ type: "SET", payload: { showFormulaEditor: false } })
          }
        >
          <FormulaEditor
            t={t}
            formula={
              editFormulaId
                ? formulas.find((f) => f.id === editFormulaId)
                : null
            }
            scope={measScope}
            onSave={(f) => {
              const newFs = editFormulaId
                ? formulas.map((x) => (x.id === editFormulaId ? f : x))
                : [...formulas, f];
              updSession({ formulas: newFs });
              dispatch({ type: "SET", payload: { showFormulaEditor: false } });
            }}
            onClose={() =>
              dispatch({ type: "SET", payload: { showFormulaEditor: false } })
            }
          />
        </Modal>
      )}
      {showHistogram && (
        <FloatingHistogram
          hist={histData}
          t={t}
          lutMode={lutMode}
          lutInvert={lutInvert}
          processing={processing}
          onProcessingChange={(p) => updSession({ processing: p })}
          onClose={() =>
            dispatch({ type: "SET", payload: { showHistogram: false } })
          }
        />
      )}
      {guideKey && (
        <PanelGuideModal
          t={t}
          guideKey={guideKey}
          onClose={() => setGuideKey(null)}
        />
      )}
      {!isMobile && (
        <div
          style={{
            position: "relative",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            background: t.surf,
            borderTop: `1px solid ${t.surf}`,
            padding: "3px 12px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            fontSize: 9,
            color: t.tx3,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 8,
              color: t.warn,
              letterSpacing: 0.5,
            }}
          >
            ⚠ RESEARCH & EDUCATIONAL USE ONLY
          </span>
          <span>
            Not cleared for clinical diagnosis. Clinical decisions should not
            rely solely on these measurements.
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CephalometryStudio() {
  const splashMobile = useMediaQuery("(max-width: 640px)");
  const [theme, setTheme] = useState("bluish");
  // C2: focus ring colour follows the theme; readable-text floor from Settings.
  const readableText = useUIStore((s) => s.readableText);
  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--focus-ring", (THEMES[theme] || THEMES.bluish).acc);
    el.classList.toggle("readable-text", !!readableText);
  }, [theme, readableText]);
  const t = useMemo(() => ({ ...THEMES[theme], id: theme }), [theme]);
  // Start empty and async-load the encrypted autosave so the PHI blob is never
  // held in plaintext localStorage. `loaded` guards the save effect so the
  // initial empty state can't clobber the just-decrypted projects.
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // ── History-API navigation: HomePage ⇄ Workspace are in-app views, so the
  // browser Back button (and the Android back gesture) must return to the
  // homepage instead of leaving the site. Opening a project pushes a history
  // entry; `popstate` then switches back to the homepage. A second Back
  // (from the homepage) still leaves the site as usual.
  // C1: the home page can open a particular session of a case.
  const openProject = (id, sessionId) => {
    if (sessionId)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id && p.activeSessionId !== sessionId && p.sessions?.some((s) => s.id === sessionId)
            ? { ...p, activeSessionId: sessionId }
            : p,
        ),
      );
    window.history.pushState({ cephView: "workspace" }, "");
    // Opening any case answers the "Welcome back" prompt; it must not come
    // back on returning home with an out-of-date suggestion.
    setWelcome(null);
    setActiveId(id);
  };
  const goHome = () => {
    if (window.history.state?.cephView === "workspace") window.history.back();
    else setActiveId(null);
  };
  useEffect(() => {
    const onPopState = () => {
      if (activeId) setActiveId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeId]);
  // On load, greet the user with a choice: jump straight into the most recent
  // project (canvas) or land on the homepage. `welcome` holds the project id to
  // offer; it is consumed by the first click and never re-shown during the session.
  const [welcome, setWelcome] = useState(null);
  const dirtyRef = useRef(false);
  // D3: surface IDB-unavailable / storage-quota failures as a dismissible banner
  // instead of silently degrading (incognito mode, full storage). The autosave
  // emits `Cephalometry Studio:storage-warning` events; this listens for them.
  // The initial "IDB unavailable" seed is computed lazily on first render
  // (idbAvailable() is a synchronous, cached check) so no setState runs in
  // an effect body.
  const [storageWarn, setStorageWarn] = useState(() =>
    idbAvailable()
      ? null
      : {
          kind: "idb-unavailable",
          message:
            "Image storage is unavailable in this browser/session (e.g. private mode). Images won't persist across sessions — export your work as .cephx to keep it.",
        }
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lp = await loadProjects();
      if (cancelled) return;
      // Cases are never deleted automatically (the 90-day retention purge
      // was removed); only the user deletes them.
      setProjects(lp);
      // Not on /features: someone opening that page came to read about the app.
      if (lp.length > 0 && window.location.pathname !== "/features") {
        // Offer the MOST RECENTLY MODIFIED project (projects are stored in
        // insertion order, so [0] would be the oldest).
        const mostRecent = lp.reduce((a, b) =>
          (b.modified || 0) > (a.modified || 0) ? b : a,
        );
        setWelcome({ projectId: mostRecent.id });
      }
      setLoaded(true);
      // Encrypt images stored before encryption existed; sweep orphans.
      runStorageMaintenance();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onWarn = (e) => setStorageWarn((e && e.detail) || null);
    window.addEventListener(STORAGE_EVENT, onWarn);
    return () => window.removeEventListener(STORAGE_EVENT, onWarn);
  }, []);

  // Backups (home page, Settings, error screen) take the live cases, which
  // are fresher than the debounced autosave.
  useEffect(() => {
    setBackupSource(() => projects);
  }, [projects]);
  // Google Drive backup dialog: { canRestore } while open (restore only from home).
  const [driveDialog, setDriveDialog] = useState(null);
  const openDrive = driveConfigured() ? (canRestore) => setDriveDialog({ canRestore }) : null;

  // Mobile: enter browser fullscreen by default on load. Browsers reject a
  // load-time requestFullscreen() (it needs a user gesture — and logs an error
  // even when the promise is caught), so we only request it on the first tap
  // anywhere: after one interaction the canvas is fullscreen, gesture-safe.
  useEffect(() => {
    if (!splashMobile) return;
    let attempted = false;
    const enterFs = () => {
      if (document.fullscreenElement || document.webkitFullscreenElement)
        return;
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      try {
        const p = req?.call(el);
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        /* fullscreen unavailable */
      }
    };
    const onGesture = () => {
      if (attempted) return;
      attempted = true;
      enterFs();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("touchstart", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, [splashMobile]);

  // W4: debounce autosave so rapid edits don't encrypt-write per tick. The
  // leave-page warning stays armed until the latest scheduled save succeeded.
  const saveTimerRef = useRef(null);
  const saveSeqRef = useRef(0);
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const seq = ++saveSeqRef.current;
    saveTimerRef.current = setTimeout(() => {
      saveProjects(projects).then((ok) => {
        if (ok && seq === saveSeqRef.current) dirtyRef.current = false;
      });
    }, 800);
  }, [projects]);

  useEffect(() => {
    if (loaded) {
      dirtyRef.current = true;
      debouncedSave();
    }
  }, [projects, loaded, debouncedSave]);

  // Profiles reload the page: save first, so nothing is lost or prompted.
  const switchToProfile = useCallback(async (id, token) => {
    clearTimeout(saveTimerRef.current);
    saveSeqRef.current++;
    await saveProjects(projects);
    dirtyRef.current = false;
    switchProfile(id, { token });
  }, [projects]);
  // Cross-device sync of the active profile through its Google Drive.
  const sync = useDriveSync({ projects, setProjects, loaded, onSwitch: switchToProfile });
  // The setup/unlock dialog opens when sync needs it, until dismissed.
  const [syncSetupDismissed, setSyncSetupDismissed] = useState(null);
  const showSyncSetup = ["setup", "locked"].includes(sync.status) && syncSetupDismissed !== sync.status;

  useEffect(() => {
    const handler = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const activeProject = projects.find((p) => p.id === activeId);

  const updateProject = (id, patch) => {
    dirtyRef.current = true;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? typeof patch === "function"
            ? patch(p)
            : { ...p, ...patch, modified: Date.now() }
          : p,
      ),
    );
  };

  const handleClearLocalData = async () => {
    if (
      !(await askConfirm({
        title: "Clear ALL local data?",
        message: `This permanently deletes every project, image, and patient identifier stored in this browser for this profile. This cannot be undone. Export any project you want to keep as a .cephx file first.${sync.email ? ` Cases synced with ${sync.email} stay in Google Drive and come back at the next sync; stop syncing first if you don't want that.` : ""}`,
        confirmLabel: "Delete everything",
        danger: true,
      }))
    )
      return;
    // A pending autosave must not write the old cases back after the wipe.
    clearTimeout(saveTimerRef.current);
    saveSeqRef.current++;
    await clearAllLocalData();
    dirtyRef.current = false;
    setProjects([]);
    setActiveId(null);
  };

  const createProject = (projection, result) => {
    const p = { ...mkProject(projection), name: result.name };
    // Patient details from the New Case form (previously collected but dropped).
    const f = result.meta || {};
    const str = (v) => (v == null ? "" : String(v).trim());
    p.meta = {
      ...p.meta,
      patientId: str(f.patientId),
      name: str(f.patientName),
      dob: str(f.dob),
      age: str(f.age),
      gender: str(f.gender),
      ethnicity: str(f.ethnicity),
      clinician: str(f.clinician),
      facility: str(f.facility),
      referral: str(f.referral),
      notes: str(f.notes),
    };
    const session = p.sessions.find((s) => s.id === p.activeSessionId);
    session.meta = { ...session.meta, patientId: p.meta.patientId, age: p.meta.age };
    // The wizard's image entry as built (its name, and for DICOM/TIFF the
    // source and original-pixels link); a bare dataUrl gets a new entry.
    if (result.image)
      session.images = [
        typeof result.image === "object" && result.image.id
          ? { ...result.image }
          : {
              id: uid(),
              name: "Imported",
              dataUrl: result.image.dataUrl || result.image,
              dx: 0,
              dy: 0,
              opacity: 1,
              blendMode: "normal",
              visible: true,
              color: "none",
              transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
            },
      ];
    session.calibration = result.calibration || {
      done: false,
      pxPerMm: 1,
      knownMm: "",
    };
    if (
      result.templateType === "analysis" ||
      result.templateType === "complete"
    ) {
      const analysis = result.analysis;
      if (analysis) {
        session.markups = analysis.pts.map((pt) => ({
          id: uid(),
          type: "point",
          points: [{ x: -99999, y: -99999 }],
          label: pt.l,
          definition: pt.def,
          color: pt.color,
          size: 6,
          visible: true,
          placed: false,
        }));
        session.analysisTemplate = analysis.name;
      }
    } else if (result.templateType === "upload" && result.templateData) {
      const d = result.templateData;
      const err = validateCepht(d);
      if (!err && d.markups) {
        const hasCoords = d.version === "2.0" && hasPlacedCoords(d.markups);
        session.markups = d.markups.map((m) => {
          const base = {
            ...m,
            id: uid(),
            definition: m.definition || m.def || "",
            visible: m.visible !== false,
          };
          if (hasCoords)
            return {
              ...base,
              placed: m.placed !== false,
              points: m.points || [{ x: -99999, y: -99999 }],
            };
          return { ...base, placed: false, points: [{ x: -99999, y: -99999 }] };
        });
        if (d.formulas) session.formulas = d.formulas;
        if (d.norms) session.norms = d.norms;
        session.analysisTemplate = d.name || "Imported";
      }
    }
    setProjects((prev) => [...prev, p]);
    openProject(p.id);
  };

  const importCephxFile = (file) => {
    importCephx(file, async (proj) => {
      const existing = projects.find((p) => p.id === proj.id);
      if (
        existing &&
        !(await askConfirm({
          title: "Replace the existing case?",
          message: `A case with this ID (“${existing.name || proj.name || "untitled"}”) already exists. Importing replaces it.`,
          confirmLabel: "Replace",
          danger: true,
        }))
      )
        return;
      setProjects((prev) => [...prev.filter((p) => p.id !== proj.id), proj]);
      openProject(proj.id);
    }, restoreBackup);
  };

  // A backup adds its cases; cases that already exist here are replaced only
  // if the user says so.
  const restoreBackup = async ({ projects: incoming, warnings }) => {
    if (!incoming.length) {
      notify("The backup contains no cases.", { tone: "err" });
      return;
    }
    const have = new Set(projects.map((p) => p.id));
    const clashes = incoming.filter((p) => have.has(p.id)).length;
    const replace =
      clashes > 0 &&
      (await askConfirm({
        title: "Restore backup",
        message: `The backup has ${incoming.length} case${incoming.length === 1 ? "" : "s"}; ${clashes} already exist${clashes === 1 ? "s" : ""} here. Replace ${clashes === 1 ? "it" : "them"} with the backup ${clashes === 1 ? "copy" : "copies"}, or keep your current ${clashes === 1 ? "version" : "versions"} and add only the others?`,
        confirmLabel: "Replace with backup",
        cancelLabel: "Keep current",
        danger: true,
      }));
    const add = incoming.filter((p) => replace || !have.has(p.id));
    const ids = new Set(add.map((p) => p.id));
    if (add.length) setProjects((prev) => [...prev.filter((p) => !ids.has(p.id)), ...add]);
    notify(
      add.length
        ? `Restored ${add.length} case${add.length === 1 ? "" : "s"} from the backup.`
        : "No cases were added; every case in the backup is already here.",
      { tone: add.length ? "ok" : "info" },
    );
    if (warnings.length) showInfo({ title: "Restored with notes", items: warnings });
  };

  // One case as a .cephx file, with the images of every session.
  const exportOneCase = async (proj) => {
    const { project: full, missing } = await hydrateProjectImages(proj);
    exportCephx(full);
    if (missing)
      notify(
        `${missing} image${missing === 1 ? "" : "s"} could not be read from this browser's storage and ${missing === 1 ? "is" : "are"} missing from the file.`,
        { tone: "err" },
      );
  };

  // Case manager actions (home page → Cases).
  const caseActions = {
    rename: async (p) => {
      const name = await askText({ title: "Rename case", label: "Case name", defaultValue: p.name || "" });
      if (name?.trim()) updateProject(p.id, { name: name.trim() });
    },
    duplicate: (p) => {
      // Same sessions and images (image ids never change content), new case id.
      const copy = { ...JSON.parse(JSON.stringify(p)), id: uid(), name: `${p.name || "Case"} (copy)`, created: Date.now(), modified: Date.now() };
      setProjects((prev) => [...prev, copy]);
      notify(`Duplicated “${p.name || "Case"}”.`, { tone: "ok" });
    },
    exportCases: async (list) => {
      if (!list.length) return;
      if (
        list.some(hasUnanonymizedPHI) &&
        !(await askConfirm({
          title: list.length === 1 ? "Export with patient identifiers?" : `Export ${list.length} cases with patient identifiers?`,
          message: "The file includes patient identifiers (name, date of birth, …), unencrypted. Use Anonymize in the case for a shareable copy.",
          confirmLabel: "Export anyway",
          danger: true,
        }))
      )
        return;
      if (list.length === 1) await exportOneCase(list[0]);
      else {
        const { count, missing } = await downloadBackup(list);
        notify(`Exported ${count} cases in one backup file${missing ? `; ${missing} image${missing === 1 ? "" : "s"} could not be read` : ""}.`, { tone: missing ? "warn" : "ok" });
      }
    },
    // → true when deleted
    remove: async (list) => {
      if (!list.length) return false;
      const n = list.length;
      const ok = await askConfirm({
        title: n === 1 ? `Delete “${list[0].name || "Untitled case"}”?` : `Delete ${n} cases?`,
        message: `${n === 1 ? "The case, its sessions and images are" : "These cases, their sessions and images are"} deleted from this browser. This can't be undone; export or back up first if you may need ${n === 1 ? "it" : "them"}.${sync.email ? " Your other synced devices will be asked whether to remove them too." : ""}`,
        confirmLabel: n === 1 ? "Delete case" : `Delete ${n} cases`,
        danger: true,
      });
      if (!ok) return false;
      const ids = new Set(list.map((p) => p.id));
      setProjects((prev) => prev.filter((p) => !ids.has(p.id)));
      notify(`Deleted ${n} case${n === 1 ? "" : "s"}.`, { tone: "ok" });
      return true;
    },
  };

  const handleBackup = async () => {
    if (
      projects.some(hasUnanonymizedPHI) &&
      !(await askConfirm({
        title: "Back up all cases",
        message: "The backup contains every case with its images and patient identifiers, unencrypted. Keep the file somewhere safe; it can be restored here with Import.",
        confirmLabel: "Save backup",
      }))
    )
      return;
    try {
      const { count, missing } = await downloadBackup(projects);
      notify(
        missing
          ? `Backup of ${count} case${count === 1 ? "" : "s"} saved, but ${missing} image${missing === 1 ? "" : "s"} could not be read and ${missing === 1 ? "is" : "are"} missing from it.`
          : `Backup of ${count} case${count === 1 ? "" : "s"} saved.`,
        { tone: missing ? "warn" : "ok" },
      );
    } catch (e) {
      logError("Backup failed", e);
      notify("The backup could not be created.", { tone: "err" });
    }
  };

  return (
    <ErrorBoundary t={t}>
      <div style={{ background: t.bg, minHeight: "100vh" }}>
        <DialogHost t={t} />
        {storageWarn && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              background: t.warn + "22",
              borderBottom: `1px solid ${t.warn}`,
              color: t.tx,
              fontSize: 12,
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 40,
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.4 }}>
              ⚠ {storageWarn.message}
            </span>
            <button
              onClick={() => setStorageWarn(null)}
              aria-label="Dismiss warning"
              style={{
                background: "none",
                border: `1px solid ${t.bdr}`,
                borderRadius: 4,
                color: t.tx2,
                cursor: "pointer",
                fontSize: 13,
                padding: "1px 7px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}
        {loaded && welcome && !activeId && (
          <Modal
            t={t}
            title="Welcome back"
            onClose={() => setWelcome(null)}
            customWidth={splashMobile ? 340 : 420}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: splashMobile ? 20 : 16,
              }}
            >
              <div
                style={{
                  fontSize: splashMobile ? 14 : 12,
                  color: t.tx2,
                  lineHeight: 1.6,
                }}
              >
                You have saved projects in this browser.
                {projects.find((p) => p.id === welcome.projectId)?.name && (
                  <span>
                    {" "}
                    Your most recent one is{" "}
                    <strong style={{ color: t.tx }}>
                      {projects.find((p) => p.id === welcome.projectId).name}
                    </strong>
                    .
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: splashMobile ? "column" : "row",
                  justifyContent: splashMobile ? "stretch" : "flex-end",
                  gap: 10,
                }}
              >
                <Btn
                  t={t}
                  onClick={() => setWelcome(null)}
                  style={
                    splashMobile
                      ? { width: "100%", padding: "14px 16px", fontSize: 15 }
                      : undefined
                  }
                >
                  Homepage
                </Btn>
                <Btn
                  t={t}
                  active
                  onClick={() => {
                    openProject(welcome.projectId);
                    setWelcome(null);
                  }}
                  style={
                    splashMobile
                      ? { width: "100%", padding: "14px 16px", fontSize: 15 }
                      : undefined
                  }
                >
                  Continue to canvas
                </Btn>
              </div>
            </div>
          </Modal>
        )}
        {!activeId && !loaded && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              color: t.tx3,
              fontSize: 12,
            }}
          >
            Loading your projects…
          </div>
        )}
        {!activeId && loaded && (
          <HomePage
            t={t}
            theme={theme}
            setTheme={setTheme}
            projects={projects}
            onOpen={openProject}
            onCreate={createProject}
            onImport={importCephxFile}
            storageEncrypted={secureStorageAvailable()}
            onClearLocalData={handleClearLocalData}
            onBackup={handleBackup}
            onDrive={openDrive && (() => openDrive(true))}
            profileName={activeProfile().name}
            caseActions={caseActions}
            profileMenu={<ProfileMenu t={t} sync={sync} onSwitch={switchToProfile} onOpenSetup={() => setSyncSetupDismissed(null)} />}
          />
        )}
        {activeId && activeProject && (
          <Workspace
            key={activeId}
            project={activeProject}
            onUpdateProject={(patch) => updateProject(activeId, patch)}
            onHome={goHome}
            t={t}
            theme={theme}
            setTheme={setTheme}
            onSave={async (proj) => {
              // Images of sessions not opened in this visit come from storage.
              await exportOneCase(proj);
              dirtyRef.current = false;
            }}
            onImport={importCephxFile}
            onBackup={handleBackup}
            onDrive={openDrive && (() => openDrive(false))}
          />
        )}
        {showSyncSetup && (
          <SyncSetupDialog t={t} sync={sync} onClose={() => setSyncSetupDismissed(sync.status)} />
        )}
        {driveDialog && (
          <DriveBackupDialog
            t={t}
            projects={projects}
            canRestore={driveDialog.canRestore}
            onRestore={restoreBackup}
            onClose={() => setDriveDialog(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
