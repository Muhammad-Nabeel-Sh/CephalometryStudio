import { useMemo } from "react";
import { PREDEFINED } from "../data/constants.js";
import { Modal } from "./Modal.jsx";
import { analysisCoverage } from "../workspace/template.js";

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS MODAL — after AI auto-trace (decoupled flow)
//
// The detector places every landmark it can find, independently of any template.
// This modal lets the user pick which analysis to apply, showing for each how
// many landmarks the AI already supplied and which ones still need manual
// placement (plus how many measurements the current points unlock).
// ═══════════════════════════════════════════════════════════════════════════════

function analysesForProjection(projection) {
  let list = PREDEFINED[projection] || [];
  if (projection === "other") {
    for (const key of ["smv", "opg", "handwrist", "photolateral", "photofrontal"]) {
      if (PREDEFINED[key]) list = list.concat(PREDEFINED[key]);
    }
  }
  return list.filter((a, i, self) => i === self.findIndex((x) => x.name === a.name));
}

function Chip({ t, children, tone }) {
  const bg = tone === "ok" ? t.ok + "18" : tone === "warn" ? t.warn + "18" : t.surf3;
  const col = tone === "ok" ? t.ok : tone === "warn" ? t.warn : t.tx2;
  return (
    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: bg, color: col, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function AnalysisModal({ t, projection, markups, onPick, onClose }) {
  const rows = useMemo(() => {
    const list = analysesForProjection(projection);
    return list
      .map((a) => ({ a, cov: analysisCoverage(a, markups) }))
      .sort((x, y) => (y.cov.measReady - x.cov.measReady) || (y.cov.have - x.cov.have) || x.a.name.localeCompare(y.a.name));
  }, [projection, markups]);

  const placedCount = useMemo(
    () => (markups || []).filter((m) => m.type === "point" && m.placed && m.points?.[0]?.x > -9000).length,
    [markups],
  );

  return (
    <Modal t={t} title="Choose an analysis for the AI landmarks" onClose={onClose} wide customWidth={640}>
      <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.5, marginBottom: 14 }}>
        The AI placed <strong style={{ color: t.tx }}>{placedCount}</strong> landmark{placedCount === 1 ? "" : "s"}.
        Pick an analysis to auto-build its measurements from those points and queue any missing landmarks for manual placement.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(({ a, cov }) => {
          const complete = cov.missing.length === 0;
          return (
            <button
              key={a.name}
              onClick={() => onPick(a.name)}
              style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 8,
                border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx,
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.acc; e.currentTarget.style.background = t.accMuted; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.bdr; e.currentTarget.style.background = t.surf2; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{a.name}</span>
                {cov.measTotal > 0 && (
                  <Chip t={t} tone={cov.measReady === cov.measTotal ? "ok" : cov.measReady > 0 ? "warn" : undefined}>
                    {cov.measReady}/{cov.measTotal} measurements
                  </Chip>
                )}
                <Chip t={t} tone={complete ? "ok" : undefined}>
                  {cov.have}/{cov.total} landmarks
                </Chip>
              </div>
              {complete ? (
                <div style={{ fontSize: 11, color: t.ok }}>All landmarks already placed by AI.</div>
              ) : (
                <div style={{ fontSize: 11, color: t.tx2 }}>
                  <span style={{ color: t.warn }}>{cov.missing.length} to place manually: </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx3 }}>{cov.missing.join(", ")}</span>
                </div>
              )}
            </button>
          );
        })}
        {rows.length === 0 && (
          <div style={{ fontSize: 12, color: t.tx2, textAlign: "center", padding: "20px 0" }}>
            No analyses available for this projection.
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={() => onPick(null)}
          style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
        >
          Points only
        </button>
      </div>
    </Modal>
  );
}
