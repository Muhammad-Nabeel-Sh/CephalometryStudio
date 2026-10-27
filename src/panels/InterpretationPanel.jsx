import { GuideBtn } from "../ui/ui.jsx";
import { useMemo, useState, useRef, useCallback } from "react";
import { generateInterpretation } from "../lib/interpretation.js";
import { deviationColor } from "../lib/utils.js";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { Icon } from "../ui/icons.jsx";

const CATEGORY_ORDER = ["skeletal", "dental", "soft-tissue", "airway", "other"];
const CATEGORY_LABELS = {
  skeletal: "Skeletal", dental: "Dental", "soft-tissue": "Soft Tissue",
  airway: "Airway", other: "Other",
};
const CATEGORY_ICONS = {
  skeletal: "bone", dental: "tooth", "soft-tissue": "person", airway: "lungs", other: "layers",
};

export default function InterpretationPanel({ allMeas, norms, t, formatAngle, calibration }) {
  const [userEdits, setUserEdits] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [guideKey, setGuideKey] = useState(null);
  const editRef = useRef(null);

  const handleEdit = useCallback((key, text) => {
    setUserEdits(prev => ({ ...prev, [key]: text }));
    setEditingKey(null);
  }, []);

  const { deviations, patterns } = useMemo(
    () => generateInterpretation(allMeas, norms, calibration),
    [allMeas, norms, calibration]
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const d of deviations) {
      const cat = d.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }, [deviations]);

  if (deviations.length === 0) {
    return (
      <div style={{ padding: 16, color: t.tx3, fontSize: 12, textAlign: "center" }}>
        No measurements with norms found. Add norms in the Measurements panel.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, flex: 1 }}>Clinical Interpretation</span>
        <GuideBtn t={t} onClick={() => setGuideKey("interpretation")} />
      </div>
      {!calibration?.done && <div style={{ background: t.warn + "22", border: `1px solid ${t.warn}44`, borderRadius: 8, padding: 12, fontSize: 12, color: t.warn }}>⚠ Calibrate your image ⟺ to enable linear norms comparison. Angle norms are still shown below.</div>}
      {/* Pattern recognition section */}
      {patterns.length > 0 && (
        <div style={{ background: t.acc + "10", borderRadius: 8, border: `1px solid ${t.acc}30`, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.acc, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Combined Findings
          </div>
          {patterns.map(p => {
            const sevColor = p.severity === "severe" ? t.err : p.severity === "moderate" ? t.warn : t.ok;
            return (
              <div key={p.id} style={{ marginBottom: 10, padding: 10, background: t.surf2, borderRadius: 6, border: `1px solid ${t.bdr}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{p.label}</span>
                  <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 4, background: sevColor + "20", color: sevColor, fontWeight: 600 }}>{p.severity}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 2 }}>{p.summary}</div>
                <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.5 }}>{p.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deviations by category */}
      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        return (
          <div key={cat}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Icon name={CATEGORY_ICONS[cat]} size={15} color={t.tx2} />
              <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {CATEGORY_LABELS[cat]}
              </span>
              <span style={{ fontSize: 12, color: t.tx3, background: t.surf2, padding: "1px 6px", borderRadius: 4 }}>
                {items.length}
              </span>
            </div>
            {items.map(d => {
              const sevColor = deviationColor(d.zScore, t);
              const sevLabel = !d.within2SD ? "Severe" : d.within2SD && !d.within1SD ? "Borderline" : "Normal";
              return (
                <div key={d.label + d.measureType} style={{
                  marginBottom: 8, padding: "10px 12px", borderRadius: 8,
                  background: t.surf2, border: `1px solid ${t.bdr}`,
                  borderLeft: `3px solid ${sevColor}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "'DM Mono',monospace" }}>
                        {d.label}
                      </span>
                      <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 4, background: sevColor + "20", color: sevColor, fontWeight: 600 }}>
                        {sevLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: sevColor }}>
                      {d.delta > 0 ? "+" : ""}{d.delta.toFixed(2)} ({d.zScore > 0 ? "+" : ""}{d.zScore.toFixed(1)}σ)
                    </span>
                  </div>
                  {d.description && (
                    <div style={{ fontSize: 12, color: t.tx3, marginBottom: 4, lineHeight: 1.4 }}>{d.description}</div>
                  )}
                  <div style={{ fontSize: 12, color: t.tx2, fontWeight: 500, lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                    {editingKey === d.label + d.measureType ? (
                      <textarea ref={editRef}
                        defaultValue={userEdits[d.label + d.measureType] || d.interpretation}
                        onBlur={e => handleEdit(d.label + d.measureType, e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(d.label + d.measureType, e.target.value); } }}
                        autoFocus
                        style={{ flex: 1, fontSize: 12, lineHeight: 1.5, background: t.surf3, color: t.tx, border: `1px solid ${t.acc}`, borderRadius: 4, padding: "4px 6px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                      />
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{userEdits[d.label + d.measureType] || d.interpretation || "No specific interpretation available."}</span>
                        <span onClick={() => setEditingKey(d.label + d.measureType)}
                          style={{ cursor: "pointer", fontSize: 12, color: t.acc, opacity: 0.7, userSelect: "none", flexShrink: 0, padding: "1px 4px", borderRadius: 3, background: t.acc + "15" }}
                          title="Edit interpretation">✏</span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: t.tx3, marginTop: 4 }}>
                    Patient: {d.measureType === "angle" && formatAngle ? formatAngle(d.value) : d.value.toFixed(2)} &nbsp;|&nbsp; Norm: {d.mean.toFixed(1)} ± {d.sd.toFixed(1)}
                    {d.normSource && <> &nbsp;—&nbsp; {d.normSource}</>}
                    {d.sdApproximate && <span title="The source published no SD for this norm; the SD is a conventional approximation, so the deviation grade is indicative." style={{ marginLeft: 6, padding: "0 4px", borderRadius: 3, border: `1px solid ${t.warn}`, color: t.warn }}>SD approx.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Uncategorized items */}
      {grouped.other && CATEGORY_ORDER.includes("other") && null}
      {Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)).map(cat => {
        const items = grouped[cat];
        return (
          <div key={cat}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx3, textTransform: "uppercase", marginBottom: 8 }}>
              {cat}
            </div>
            {items.map(d => (
              <div key={d.label} style={{ marginBottom: 8, padding: 10, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{d.label}</div>
                <div style={{ fontSize: 12, color: t.tx2 }}>{d.interpretation}</div>
              </div>
            ))}
          </div>
        );
      })}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
