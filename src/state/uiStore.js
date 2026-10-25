import { create } from "zustand";

let initialFavorites = ["select", "pan", "point", "line", "angle3", "ruler", "arrow"];
try {
  const saved = localStorage.getItem("cephalo_favTools");
  if (saved) initialFavorites = JSON.parse(saved);
} catch { /* localStorage unavailable */ }

export const useUIStore = create(() => ({
  showScaleBar: false,
  showDefTooltips: true,
  showLUT: false,
  showHistogram: false,
  showAnnotations: true,
  annotationSize: 1,
  rightPanel: "markups",
  // Full-screen Research workspace (opened from the Research tab).
  researchOpen: false,
  showCalib: false,
  pendingRuler: null,
  showExport: false,
  showAnon: false,
  showNormogram: false,
  pendingTextPos: null,
  showFormulaEditor: false,
  editFormulaId: null,
  showMobilePanel: false,
  mobileTab: "canvas",
  mobileToolsExpanded: false,
  toolbarPos: { x: 70, y: 100 },
  toolbarDragging: false,
  rightPanelWidth: 440,
  rightPanelResizing: false,
  showDisplacement: false,
  showGroupsLegend: false,
  compareSessionId: null,
  displacementOverlay: false,
  refLandmark1: "",
  refLandmark2: "",
  overlayBlend: 0.5,
  overlayAlignMode: "2pt",
  overlayVectorScale: 1,
  showTrackingLines: false,
  showCpAlways: false,
  showAnchorAlways: false,
  defaultLineStyle: "solid",
  defaultMarkupColor: null,
  defaultLineWidth: 1.5,
  autoHideLabels: false,
  annotationBold: false,
  snapTolerance: 12,

  // from useWorkspaceUIState
  compareSession: null,
  showGrid: false,
  showAirwayOverlay: false,
  showReportOptions: false,
  filmstripOpen: true,
  guideKey: null,
  reportSections: {
    cover: true,
    images: true,
    measurements: true,
    normograms: true,
    research: true,
    formulas: true,
    interpretation: true,
  },
  pinnedFormulas: new Set(),
  copiedMarkup: null,
  contextMenu: null,
  favoriteTools: initialFavorites,
}));
