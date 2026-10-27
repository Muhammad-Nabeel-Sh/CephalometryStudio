import { create } from "zustand";

let initialFavorites = ["select", "pan", "point", "line", "angle3", "ruler", "arrow"];
try {
  const saved = localStorage.getItem("cephalo_favTools");
  if (saved) initialFavorites = JSON.parse(saved);
} catch { /* localStorage unavailable */ }

// C3: display and tracing preferences are remembered between visits.
export const PREF_KEYS = [
  "showDefTooltips", "showAnnotations", "annotationSize", "showScaleBar",
  "autoHideLabels", "annotationBold", "labelLayout", "labelsActiveOnly",
  "snapTolerance", "defaultLineStyle", "defaultMarkupColor", "defaultLineWidth",
  "showCpAlways", "showAnchorAlways", "readableText", "reportTheme",
  "reportClinicName", "reportClinicLogo",
];
const PREFS_KEY = "cephalo_prefs_v1";
let savedPrefs = {};
try {
  const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  if (raw && typeof raw === "object") for (const k of PREF_KEYS) if (k in raw) savedPrefs[k] = raw[k];
} catch { /* localStorage unavailable or corrupt */ }

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
  // B3: move overlapping labels apart; show labels of the active analysis only.
  labelLayout: true,
  labelsActiveOnly: false,
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
    airway: true,
    research: true,
    formulas: true,
    interpretation: true,
  },
  pinnedFormulas: new Set(),
  copiedMarkup: null,
  contextMenu: null,
  favoriteTools: initialFavorites,
  showSettings: false,
  // C2: 12 px minimum text size across the app.
  readableText: true,
  // PDF report style: "light" (white pages) or "dark" (Plasticity theme).
  reportTheme: "light",
  // Clinic name and logo (small PNG data URL) for the report cover and header.
  reportClinicName: "",
  reportClinicLogo: null,
  ...savedPrefs,
}));

useUIStore.subscribe((s, prev) => {
  if (!PREF_KEYS.some(k => s[k] !== prev[k])) return;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(PREF_KEYS.map(k => [k, s[k]])))); } catch { /* storage blocked */ }
});
