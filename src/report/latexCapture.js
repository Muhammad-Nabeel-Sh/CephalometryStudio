import katex from "katex";
import "katex/dist/katex.min.css";

// ═══════════════════════════════════════════════════════════════════════════════
// LATEX FOR THE PDF REPORT
// Renders a formula with KaTeX, wraps it in a self-contained SVG (KaTeX's CSS
// and fonts inlined, since an SVG drawn as an image cannot load anything) and
// rasterises it to a PNG the report can place.
// ═══════════════════════════════════════════════════════════════════════════════
const FONT_PX = 44;
const SCALE = 2;

let cssPromise = null;

const toDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// KaTeX's rules from the page's style sheets, with each font's woff2 file
// replaced by a data URL. Built once per page load.
function katexCss() {
  if (!cssPromise) {
    cssPromise = (async () => {
      const parts = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        const base = sheet.href || location.href;
        for (const rule of rules) {
          if (rule.constructor?.name === "CSSFontFaceRule" || rule.type === 5) {
            const family = rule.style.getPropertyValue("font-family");
            if (!/KaTeX/.test(family)) continue;
            const src = rule.style.getPropertyValue("src");
            const m = /url\(["']?([^"')]+\.woff2)["']?\)/.exec(src);
            if (!m) continue;
            try {
              const res = await fetch(new URL(m[1], base));
              if (!res.ok) continue;
              const data = await toDataUrl(await res.blob());
              parts.push(`@font-face{font-family:${family};src:url(${data}) format("woff2");font-weight:${rule.style.getPropertyValue("font-weight") || "normal"};font-style:${rule.style.getPropertyValue("font-style") || "normal"};}`);
            } catch { /* that face falls back to a system serif */ }
          } else if (rule.cssText?.includes(".katex")) {
            parts.push(rule.cssText);
          }
        }
      }
      return parts.join("\n");
    })().catch(e => { cssPromise = null; throw e; });
  }
  return cssPromise;
}

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("The formula could not be drawn."));
  img.src = src;
});

// → { dataUrl, w, h } (w/h in CSS px at FONT_PX), or null if it cannot be drawn.
export async function renderLatex(latex, { color = "#111111" } = {}) {
  if (!latex || typeof document === "undefined") return null;
  const css = await katexCss();
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", pointerEvents: "none" });
  const box = document.createElement("div");
  Object.assign(box.style, { display: "inline-block", padding: "6px 8px", fontSize: `${FONT_PX}px`, color, lineHeight: "1.2", whiteSpace: "nowrap" });
  host.appendChild(box);
  document.body.appendChild(host);
  try {
    katex.render(latex, box, { throwOnError: false, displayMode: false, output: "html" });
    try { await document.fonts.ready; } catch { /* measure with what is loaded */ }
    const { width, height } = box.getBoundingClientRect();
    const w = Math.ceil(width), h = Math.ceil(height);
    if (!w || !h) return null;
    const xhtml = new XMLSerializer().serializeToString(box);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${xhtml}</div></foreignObject></svg>`;
    const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    const canvas = document.createElement("canvas");
    canvas.width = w * SCALE;
    canvas.height = h * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), w, h };
  } catch {
    return null;
  } finally {
    host.remove();
  }
}
