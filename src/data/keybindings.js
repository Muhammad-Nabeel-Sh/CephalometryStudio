// ═══════════════════════════════════════════════════════════════════════════════
// KEYBINDINGS — Single source of truth for all global keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════════════
//
// Each entry defines a key combination and an action ID.
// The actual handler logic lives in App.jsx — this file is purely declarative.
//
// Fields:
//   id     — action identifier (used by the handler in App.jsx)
//   key    — the e.key value to match, lowercase (compared after toLowerCase())
//   ctrl   — true if Ctrl (Windows) or Cmd (Mac) must be held (default: false)
//   shift  — true if Shift must be held (default: false)
//   toolId — for id:"tool" entries, the tool id to activate (from TOOLS)
//
// Tool shortcuts are listed here alongside all other shortcuts so that
// every key → action mapping lives in one file.  The TOOLS array in
// constants.js is still the source for toolbar UI metadata (icon, label).
// ═══════════════════════════════════════════════════════════════════════════════

export const KEYBINDINGS = [
  // ─── Undo / Redo ────────────────────────────────────────────────────────────
  { id: "undo",            key: "z", ctrl: true },
  { id: "redo",            key: "y", ctrl: true },

  // ─── Escape ─────────────────────────────────────────────────────────────────
  // Composite: clear selection → close mobile tools → advance/finish placing
  { id: "escape",          key: "escape" },

  // ─── Context Menu ───────────────────────────────────────────────────────────
  { id: "contextMenu",     key: "f10", shift: true },
  { id: "contextMenu",     key: "contextmenu" },
  { id: "contextMenu",     key: "apps" },

  // ─── Placing (undo step) ───────────────────────────────────────────────────
  // Active only while placingMode && placingQueue.length > 0.
  // Falls through to "delete selected" if those conditions are not met.
  { id: "placeUndo",       key: "backspace" },

  // ─── Delete selected markups ────────────────────────────────────────────────
  { id: "deleteSelected",  key: "delete" },

  // ─── Zoom ───────────────────────────────────────────────────────────────────
  { id: "zoomIn",          key: "+" },
  { id: "zoomIn",          key: "=" },
  { id: "zoomOut",         key: "-" },
  { id: "zoomReset",       key: "0" },

  // ─── Research workspace ───────────────────────────────────────────────────
  // Before the tools, so Shift+R isn't taken as the ruler.
  { id: "research",        key: "r", shift: true },

  // ─── Tool shortcuts ─────────────────────────────────────────────────────────
  // Single-key shortcuts that activate a drawing/selection tool.
  // Must come after non-tool bindings so that e.g. Ctrl+Z isn't caught as "z".
  { id: "tool",            key: "v", toolId: "select" },
  { id: "tool",            key: "h", toolId: "pan" },
  { id: "tool",            key: "p", toolId: "point" },
  { id: "tool",            key: "l", toolId: "line" },
  { id: "tool",            key: "j", toolId: "perppoint" },
  { id: "tool",            key: "m", toolId: "midpoint" },
  { id: "tool",            key: "a", toolId: "arrow" },
  { id: "tool",            key: "3", toolId: "angle3" },
  { id: "tool",            key: "4", toolId: "angle4" },
  { id: "tool",            key: "d", toolId: "perp" },
  { id: "tool",            key: "q", toolId: "parallel" },
  { id: "tool",            key: "g", toolId: "polygon" },
  { id: "tool",            key: "c", toolId: "curve" },
  { id: "tool",            key: "y", toolId: "polyline" },
  { id: "tool",            key: "e", toolId: "ellipse" },
  { id: "tool",            key: "u", toolId: "arc" },
  { id: "tool",            key: "o", toolId: "circle" },
  { id: "tool",            key: "b", toolId: "bezier" },
  { id: "tool",            key: "t", toolId: "text" },
  { id: "tool",            key: "r", toolId: "ruler" },
  { id: "tool",            key: "n", toolId: "tangent" },
  { id: "tool",            key: "w", toolId: "concentric" },
  { id: "tool",            key: "x", toolId: "mirror" },
];

// The first binding a key event matches. Bindings that don't ask for Ctrl/Shift
// also match with them held, so order matters (see the research entry).
export function matchKeybinding(e) {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  const shift = !!e.shiftKey;
  const key = String(e.key || "").toLowerCase();
  return KEYBINDINGS.find(b => (!b.ctrl || ctrl) && (!b.shift || shift) && b.key === key) || null;
}
