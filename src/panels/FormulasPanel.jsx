import { useState } from "react";
import { evalFormula, onEnter } from "../lib/utils.js";
import { PanelHeader, Btn, GuideBtn } from "../ui/ui.jsx";
import { KatexSpan, LatexFloatingPanel } from "../hooks/useKatex.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { useFormulaEngine } from "../hooks/useFormulaEngine.js";

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function FormulasPanel({ formulas, t, scope, onAdd, onEdit, onDelete, pinnedFormulas, onPinFormula }) {
  const [bigLatex, setBigLatex] = useState(null);
  const [guideKey, setGuideKey] = useState(null);
  useFormulaEngine(); // re-render with values once the engine has loaded
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Custom Formulas
        <GuideBtn t={t} onClick={() => setGuideKey("formulas")} style={{ marginLeft: 6 }} />
      </PanelHeader>
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 12, lineHeight: 1.5 }}>Define derived measurements. Variables use landmark label names.</div>
      {formulas.map(f => {
        const val = evalFormula(f.expression, scope);
        const pinned = pinnedFormulas?.has(f.id);
        const isValid = val !== null && isFinite(val);
        return (
          <div key={f.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: t.acc }}>{f.name}</div>{f.unit && <div style={{ fontSize: 10, color: t.tx3 }}>{f.unit}</div>}</div>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => onEdit(f.id)} style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10 }}>Edit</button><button onClick={() => onDelete(f.id)} title="Delete formula" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button></div>
            </div>
            {f.latex && <div role="button" tabIndex={0} onClick={() => setBigLatex(f.latex)} onKeyDown={onEnter(() => setBigLatex(f.latex))} style={{ background: t.surf3, borderRadius: 4, padding: "6px 10px", marginBottom: 8, cursor: "pointer", border: `1px solid ${t.bdr}`, minHeight: 28, display: "flex", alignItems: "center" }}>
              <KatexSpan latex={f.latex} block={false} fontSize={10} />
              <span style={{ fontSize: 9, color: t.tx3, marginLeft: "auto", paddingLeft: 8 }}>click to enlarge</span>
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: t.tx2 }}>Result</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: isValid ? t.acc : t.err }}>{isValid ? `${val.toFixed(2)} ${f.unit || ""}` : "N/A"}</span>
            </div>
            {isValid && <div style={{ marginTop: 6 }}>
              <button onClick={() => onPinFormula(f.id)}
                style={{ width: "100%", padding: "4px 0", fontSize: 10, fontWeight: 700, borderRadius: 4, border: `1px solid ${pinned ? t.ok : t.bdr}`, background: pinned ? t.ok + "18" : "transparent", color: pinned ? t.ok : t.tx2, cursor: "pointer", transition: "all 0.15s" }}>
                {pinned ? "✓ In Measurements" : "+ Add to Measurements"}
              </button>
            </div>}
          </div>
        );
      })}
      <Btn t={t} small onClick={onAdd} style={{ width: "100%", padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>New Formula</Btn>
      {bigLatex && <LatexFloatingPanel latex={bigLatex} onClose={() => setBigLatex(null)} />}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
