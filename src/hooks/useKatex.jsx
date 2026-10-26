/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { useDialogA11y } from "./useDialogA11y.js";
// KaTeX is BUNDLED from the npm package (was loaded at runtime from
// cdnjs.cloudflare.com with no integrity/SRI — a supply-chain and offline
// risk for a clinical tool). Bundling ships the matched CSS+JS from the same
// origin as the app, so a CDN compromise or offline clinic can't break or
// hijack rendering. It is split into its own chunk and loaded the first time a
// formula is shown (C6), so it no longer weighs on start-up.
let katex = null;
let katexLoading = null;
function loadKatex() {
  if (!katexLoading) {
    katexLoading = Promise.all([import("katex"), import("katex/dist/katex.min.css")])
      .then(([mod]) => { katex = mod.default || mod; return katex; })
      .catch(e => { katexLoading = null; throw e; });
  }
  return katexLoading;
}

// Returns true once KaTeX has loaded (and starts loading it).
export function useKatex() {
  const [ready, setReady] = useState(() => katex !== null);
  useEffect(() => {
    if (ready) return undefined;
    let live = true;
    loadKatex().then(() => { if (live) setReady(true); }).catch(() => { /* offline */ });
    return () => { live = false; };
  }, [ready]);
  return ready;
}

export function KatexSpan({ latex, block = false, large = false, fontSize }) {
  const ready = useKatex();
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !ready || !katex) return;
    try {
      katex.render(latex, ref.current, {
        throwOnError: false, displayMode: block,
        output: "html",
      });
    } catch { /* ignore KaTeX render errors */ }
  }, [latex, block, ready]);
  const size = fontSize ? `${fontSize}pt` : (large ? "2.4rem" : "inherit");
  return (
    <span ref={ref}
      style={{ fontSize: size, fontFamily: "inherit", display: block ? "block" : "inline" }}
    />
  );
}

export function LatexFloatingPanel({ latex, onClose }) {
  const ref = useDialogA11y(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Formula" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div ref={ref} onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 16, padding: "48px 60px", maxWidth: "80vw", minWidth: 360, boxShadow: "0 32px 80px rgba(0,0,0,0.5)", position: "relative" }}>
        <button onClick={onClose} title="Close" style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        <div style={{ color: "#111", fontSize: "40pt", fontFamily: "'KaTeX_Main',serif", textAlign: "center", lineHeight: 1.4 }}>
          <KatexSpan latex={latex} block fontSize={40} />
        </div>
        <div style={{ marginTop: 24, padding: "8px 12px", background: "#f5f5f5", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#555", textAlign: "center", wordBreak: "break-all" }}>{latex}</div>
      </div>
    </div>
  );
}
