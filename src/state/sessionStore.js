import { create } from "zustand";
import { refreshAutoMeasurements } from "../workspace/markupHelpers.js";

const EMPTY_CALIB = { done: false, pxPerMm: 1 };
const EMPTY_PROC = { brightness: 0, contrast: 0, windowWidth: 0, windowCenter: 128, edgeEnhance: 0 };

let _onChange = null;
export function setSessionChangeHandler(fn) { _onChange = fn; }
export function getSessionChangeHandler() { return _onChange; }

export const useSessionStore = create((set, get) => ({
  markups: [],
  calibration: EMPTY_CALIB,
  norms: [],
  formulas: [],
  processing: EMPTY_PROC,
  sessionImage: [],
  angleMode: "signed-deg",
  lutMode: "gray",
  lutInvert: false,

  undoStack: [],
  redoStack: [],
  undoVersion: 0,

  loadFromSession(session) {
    set({
      markups: session?.markups || [],
      calibration: session?.calibration || EMPTY_CALIB,
      norms: session?.norms || [],
      formulas: session?.formulas || [],
      processing: session?.processing || EMPTY_PROC,
      sessionImage: session?.images || [],
      angleMode: session?.angleMode || "signed-deg",
      lutMode: session?.lutMode || "gray",
      lutInvert: session?.lutInvert || false,
      undoStack: [],
      redoStack: [],
      undoVersion: get().undoVersion + 1,
    });
  },

  snapshot() {
    const s = get();
    return JSON.stringify({
      markups: s.markups,
      norms: s.norms,
      calibration: s.calibration,
      formulas: s.formulas,
      processing: s.processing,
    });
  },

  pushUndo() {
    set(state => ({
      undoStack: [...state.undoStack.slice(-199), get().snapshot()],
      redoStack: [],
      undoVersion: state.undoVersion + 1,
    }));
  },

  pushUndoSnapshot(snapshot) {
    set(state => ({
      undoStack: [...state.undoStack.slice(-199), snapshot],
      redoStack: [],
      undoVersion: state.undoVersion + 1,
    }));
  },

  undo() {
    const state = get();
    if (!state.undoStack.length) return;
    const current = state.snapshot();
    const prevStr = state.undoStack[state.undoStack.length - 1];
    const parsed = JSON.parse(prevStr);
    set({
      markups: parsed.markups ?? [],
      calibration: parsed.calibration ?? EMPTY_CALIB,
      norms: parsed.norms ?? [],
      formulas: parsed.formulas ?? [],
      processing: parsed.processing ?? EMPTY_PROC,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, current],
      undoVersion: state.undoVersion + 1,
    });
    _onChange?.();
  },

  redo() {
    const state = get();
    if (!state.redoStack.length) return;
    const current = state.snapshot();
    const nextStr = state.redoStack[state.redoStack.length - 1];
    const parsed = JSON.parse(nextStr);
    set({
      markups: parsed.markups ?? [],
      calibration: parsed.calibration ?? EMPTY_CALIB,
      norms: parsed.norms ?? [],
      formulas: parsed.formulas ?? [],
      processing: parsed.processing ?? EMPTY_PROC,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, current],
      undoVersion: state.undoVersion + 1,
    });
    _onChange?.();
  },

  updMarkups(fn) {
    const ms = refreshAutoMeasurements(fn(get().markups), get().calibration);
    set({ markups: ms });
    _onChange?.();
  },

  updMarkup(id, patch) {
    get().updMarkups(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m));
  },

  delMarkup(id) {
    get().pushUndo();
    get().updMarkups(ms => ms.filter(m => m.id !== id));
  },

  addMarkup(m) {
    get().pushUndo();
    set(state => ({ markups: [...state.markups, m] }));
    _onChange?.();
  },

  // Mirror a project-side session patch back into the store (project→store direction).
  // Ref-equality guard prevents a loop with _onChange (store→project). Never fires _onChange —
  // the caller has already written the project.
  merge(patch) {
    const s = get();
    const next = {};
    for (const k of ["markups", "calibration", "norms", "formulas", "processing", "angleMode", "lutMode", "lutInvert"]) {
      if (patch[k] !== undefined && patch[k] !== s[k]) next[k] = patch[k];
    }
    if (patch.images !== undefined && patch.images !== s.sessionImage) next.sessionImage = patch.images;
    if (Object.keys(next).length) set(next);
  },
}));
