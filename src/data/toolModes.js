// ═══════════════════════════════════════════════════════════════════════════════
// Toolbar task modes (B1) — which tools each mode shows, with a one-line hint.
// Shortcut keys come from data/keybindings.js so they are defined once.
// ═══════════════════════════════════════════════════════════════════════════════

import { KEYBINDINGS } from "./keybindings.js";

export const TOOL_MODES = [
  { id: "trace", label: "Trace", tools: ["point", "midpoint", "ruler"] },
  { id: "measure", label: "Measure", tools: ["line", "angle3", "angle4", "perp", "perppoint", "parallel", "tangent"] },
  { id: "draw", label: "Draw", tools: ["polyline", "polygon", "curve", "bezier", "circle", "ellipse", "arc", "concentric", "mirror", "arrow", "text"] },
  { id: "all", label: "All", tools: null },
];

// Select and Pan stay visible in every mode.
export const NAV_TOOLS = ["select", "pan"];

export const TOOL_INFO = {
  select: { label: "Select / Move", hint: "Select, drag and edit markups" },
  pan: { label: "Pan", hint: "Drag to move the image (the middle mouse button pans in any tool)" },
  point: { label: "Landmark", hint: "Place a named point" },
  midpoint: { label: "Midpoint", hint: "Point halfway between two points" },
  perppoint: { label: "Perp line", hint: "Line perpendicular to a line, through a point" },
  ruler: { label: "Ruler", hint: "Draw a known distance to calibrate mm" },
  line: { label: "Line", hint: "Line or plane through two points" },
  angle3: { label: "Angle 3-pt", hint: "Angle at a vertex (3 points)" },
  angle4: { label: "Angle 4-pt", hint: "Angle between two lines (4 points)" },
  perp: { label: "Perp dist", hint: "Distance from a point to a line" },
  parallel: { label: "Parallel", hint: "Line parallel to another through a point" },
  tangent: { label: "Tangent", hint: "Tangent line touching a curve" },
  polyline: { label: "Polyline", hint: "Open path of straight segments" },
  polygon: { label: "Polygon", hint: "Closed area (area and perimeter)" },
  curve: { label: "Curve", hint: "Smooth curve through points" },
  bezier: { label: "Bezier", hint: "Bezier curve with control points" },
  circle: { label: "Circle", hint: "Circle from centre and radius" },
  ellipse: { label: "Ellipse", hint: "Ellipse from its axes" },
  arc: { label: "Arc", hint: "Arc through three points" },
  concentric: { label: "Concentric", hint: "Concentric circles" },
  mirror: { label: "Mirror", hint: "Mirror markups across an axis" },
  arrow: { label: "Arrow", hint: "Annotation arrow" },
  text: { label: "Text", hint: "Text note on the image" },
};

const KEY_OF = Object.fromEntries(KEYBINDINGS.filter(b => b.id === "tool").map(b => [b.toolId, b.key.toUpperCase()]));
export const toolKey = id => KEY_OF[id] || "";

export function toolTitle(id) {
  const info = TOOL_INFO[id];
  if (!info) return id;
  const k = toolKey(id);
  return `${info.label}${k ? ` (${k})` : ""} — ${info.hint}`;
}

// The mode a tool belongs to (null for Select/Pan, which live in every mode).
export function modeOfTool(id) {
  if (NAV_TOOLS.includes(id)) return null;
  return TOOL_MODES.find(m => m.tools?.includes(id))?.id || null;
}
