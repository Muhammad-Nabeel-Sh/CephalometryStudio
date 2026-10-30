import { fmtNum } from "../lib/utils.js";
/* eslint-disable react-refresh/only-export-components */

// ─── Safe Number Guard ─────────────────────────────────────────────────────────
export function safeNum(v, fallback = 0) {
  return (v != null && isFinite(v)) ? v : fallback;
}

// ─── Safe Range (prevents zero-divide in scale functions) ─────────────────────
export function safeRange(min, max) {
  const span = max - min;
  return (span !== 0 && isFinite(span)) ? span : 1;
}



// ─── Type Scale ──────────────────────────────────────────────────────────────
export const FONT = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 12,
  xl: 14,
  title: 13,
  tick: 9,
  annotation: 10,
};

export const FONT_STACK = "'DM Sans','DM Mono',monospace";

// ─── Color Palette (Okabe-Ito inspired, colorblind-friendly) ─────────────────
export const PALETTE = [
  "#0072B2", "#D55E00", "#009E73", "#CC79A7",
  "#F0E442", "#56B4E9", "#E69F00", "#000000",
];

// ─── Chart Card Wrapper ──────────────────────────────────────────────────────
export function ChartCard({ title, children, t, pad = "8px" }) {
  return (
    <div style={{ padding: typeof pad === "string" ? pad : `${pad}px`, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: FONT.title, fontWeight: 700, color: t.tx, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Label Wrapper (multi-line ellipsis-free) ────────────────────────────────
export function wrapLabel(label, maxLen = 16) {
  if (!label || label.length <= maxLen) return [label || ""];
  const words = label.split(/\s+/);
  if (words.length > 1) {
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length <= maxLen) {
        cur = (cur + " " + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length > 1 ? lines : [label.slice(0, maxLen - 1) + "\u2026"];
  }
  const lines = [];
  for (let i = 0; i < label.length; i += maxLen) {
    lines.push(label.slice(i, i + maxLen));
  }
  return lines;
}

export function fmtP(p) {
  if (p == null || !isFinite(p)) return "\u2014";
  if (p < 0.001) return "<.001";
  return fmtNum(p, 3).replace(/^0(?=\.)/, "");
}
