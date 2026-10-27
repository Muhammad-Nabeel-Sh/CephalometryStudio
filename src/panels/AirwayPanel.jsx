import { useMemo, useState } from "react";
import { computeAirwayMeasurements, generateAirwayBoundaries, computeAirwayRiskScore, AIRWAY_LANDMARKS_CORE, AIRWAY_LANDMARKS_ADVANCED, coreLandmarksComplete } from "../research/airway.js";
import { InfoBox, Tag, Btn } from "../ui/ui.jsx";
import { PREDEFINED } from "../data/constants.js";
import PanelGuideModal from "./PanelGuideModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isPlaced(markups, label) {
  try {
    const lo = label.toLowerCase();
    return markups.some(
      (m) =>
        m.visible !== false &&
        m.label &&
        m.label.toLowerCase() === lo &&
        m.points &&
        m.points.length > 0 &&
        m.points[0].x > -9000
    );
  } catch {
    return false;
  }
}

// The engine's wording already knows which direction is pathological (a wide
// airway is not "constrained"; a long soft palate is not "patent").
function zBadge(m, t) {
  if (m.zScore === null || m.zScore === undefined) return { color: t.tx3, label: "—" };
  const label = m.interpretation || "—";
  if (label === "Normal") return { color: t.ok, label };
  if (/^(Narrow|Increased)$/.test(label)) return { color: t.err, label };
  if (/^Borderline/.test(label)) return { color: t.warn, label };
  return { color: t.tx2, label }; // above/below average, wider than average
}

function fmtVal(v) {
  if (v === null || v === undefined) return "—";
  return v % 1 === 0 ? v.toFixed(1) : v.toFixed(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AirwayPanel({ t, markups, calibration, norms, loadAirwayTier, onUpdateMarkups, showOverlay, onToggleOverlay, onLoadTemplate, dispatch, sex, age, getImagePixels }) {
  void norms;
  void onUpdateMarkups;
  const [guideKey, setGuideKey] = useState(null);

  const measurements = useMemo(
    () => computeAirwayMeasurements(markups, calibration, sex, age),
    [markups, calibration, sex, age],
  );

  const summary = useMemo(() => {
    const valid = measurements.filter((m) => m.value !== null && m.zScore !== null);
    const total = valid.length;
    const abnormal = valid.filter((m) => Math.abs(m.zScore) > 1).length;
    return { total, normal: total - abnormal, abnormal };
  }, [measurements]);

  const calDone = calibration?.done === true;
  const unit = calDone ? "mm" : "px";
  const coreComplete = coreLandmarksComplete(markups);

  return (
    <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ─── Header ─── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginTop: 8, display: "flex", alignItems: "center" }}>
        Airway Analysis
        <button onClick={() => setGuideKey("airway")}
          style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
      </div>
      <InfoBox t={t}>
        Computes pharyngeal airway dimensions from placed cephalometric landmarks.
        Place required landmarks below to enable measurements.
      </InfoBox>

      {/* ─── Load Airway Template ─── */}
      {(() => {
        const airwayAnalysis = (PREDEFINED.lateral || []).find(
          (a) => a.name && a.name.toLowerCase().includes("airway")
        );
        const hasAirwayLandmarks = airwayAnalysis
          ? ["PNS", "SP", "N"].filter((l) =>
              markups.some(
                (m) =>
                  m.visible !== false &&
                  m.placed &&
                  m.label?.toLowerCase() === l.toLowerCase()
              )
            ).length >= 3
          : false;
        if (airwayAnalysis && !hasAirwayLandmarks) {
          return (
            <Btn
              t={t}
              onClick={() => {
                onLoadTemplate && onLoadTemplate(airwayAnalysis);
                dispatch && dispatch({ type: "SET", payload: { rightPanel: "airway" } });
              }}
              style={{
                background: t.acc,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Load Airway Template
            </Btn>
          );
        }
        return null;
      })()}

      {/* ─── Calibration warning ─── */}
      {!calDone && (
        <div
          style={{
            background: t.warn + "18",
            border: `1px solid ${t.warn}44`,
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11,
            color: t.warn,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>⚠</span>
          <span>Not calibrated — values shown in pixels</span>
        </div>
      )}

      {/* ─── Core Landmarks ─── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.tx2,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          Core Landmarks (5 measurements)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {AIRWAY_LANDMARKS_CORE.map((label) => {
            const placed = isPlaced(markups, label);
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 6px",
                  borderRadius: 4,
                  background: placed ? t.ok + "0a" : t.surf3 + "66",
                  border: `1px solid ${placed ? t.ok + "30" : t.bdr}`,
                  cursor: "default",
                  fontSize: 10,
                  color: t.tx,
                  transition: "all 0.12s",
                  fontFamily: "'DM Mono', monospace",
                }}
                title={placed ? `${label} placed` : `${label} — not yet placed`}
              >
                {placed ? (
                  <span style={{ color: t.ok, fontSize: 12 }}>✓</span>
                ) : (
                  <span style={{ color: t.warn, fontSize: 12 }}>⚠</span>
                )}
                <span style={{ flex: 1 }}>{label}</span>
              </div>
            );
          })}
        </div>
        {AIRWAY_LANDMARKS_CORE.some(l => !isPlaced(markups, l)) && (
          <button
            onClick={() => loadAirwayTier && loadAirwayTier(AIRWAY_LANDMARKS_CORE)}
            style={{
              marginTop: 6,
              width: "100%",
              background: t.acc,
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "6px 10px",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Place All Core
          </button>
        )}
      </div>

      {/* ─── Advanced Landmarks ─── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: coreComplete ? t.acc : t.tx3,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Advanced Landmarks (9 additional measurements)
          {coreComplete && (
            <span style={{ fontSize: 8, color: t.ok, fontWeight: 600 }}>CORE COMPLETE</span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {AIRWAY_LANDMARKS_ADVANCED.map((label) => {
            const placed = isPlaced(markups, label);
            const disabled = !coreComplete;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 6px",
                  borderRadius: 4,
                  background: placed ? t.ok + "0a" : disabled ? t.surf3 + "33" : t.surf3 + "66",
                  border: `1px solid ${placed ? t.ok + "30" : disabled ? t.bdr + "66" : t.bdr}`,
                  cursor: "default",
                  fontSize: 10,
                  color: disabled ? t.tx3 : t.tx,
                  transition: "all 0.12s",
                  fontFamily: "'DM Mono', monospace",
                  opacity: disabled ? 0.5 : 1,
                }}
                title={disabled ? "Place all core landmarks first" : placed ? `${label} placed` : `${label} — not yet placed`}
              >
                {placed ? (
                  <span style={{ color: t.ok, fontSize: 12 }}>✓</span>
                ) : (
                  <span style={{ color: disabled ? t.tx3 : t.warn, fontSize: 12 }}>{disabled ? "🔒" : "⚠"}</span>
                )}
                <span style={{ flex: 1 }}>{label}</span>
              </div>
            );
          })}
        </div>
        {coreComplete && AIRWAY_LANDMARKS_ADVANCED.some(l => !isPlaced(markups, l)) && (
          <button
            onClick={() => loadAirwayTier && loadAirwayTier(AIRWAY_LANDMARKS_ADVANCED)}
            style={{
              marginTop: 6,
              width: "100%",
              background: t.acc,
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "6px 10px",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Place All Advanced
          </button>
        )}
      </div>

      {/* ─── Divider ─── */}
      <div style={{ height: 1, background: t.bdr, margin: "2px 0" }} />

      {/* ─── Airway Overlay Toggle ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 6,
          background: t.surf3 + "44",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggleOverlay}
      >
        <input
          type="checkbox"
          checked={showOverlay}
          onChange={onToggleOverlay}
          style={{ accentColor: t.acc, cursor: "pointer", margin: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: t.tx, flex: 1 }}>
          Airway Overlay
        </span>
        <span style={{ fontSize: 9, color: t.tx3 }}>
          {showOverlay ? "Visible" : "Hidden"}
        </span>
      </div>

      {/* ─── REC 2: OSA Risk Scorecard ─── */}
      {(() => {
        const risk = computeAirwayRiskScore(measurements);
        if (!risk) return null;
        const color = risk.risk === "high" ? t.err : risk.risk === "moderate" ? t.warn : t.ok;
        const bg = risk.risk === "high" ? t.err + "18" : risk.risk === "moderate" ? t.warn + "18" : t.ok + "18";
        return (
          <div style={{ padding: 10, borderRadius: 6, background: bg, border: `1px solid ${color}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.6 }}>OSA Risk Score</span>
              <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>{risk.risk.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: t.tx2, lineHeight: 1.5 }}>{risk.summary}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 9, color: t.tx3 }}>
              <span>Mean z: {risk.score?.toFixed(2)}</span>
              <span>Flagged: {risk.flaggedCount}/{risk.measuredCount}</span>
              <span>Critical: {risk.criticalCount}</span>
            </div>
          </div>
        );
      })()}

      {/* ─── REC 1: Auto-Trace Airway Boundaries ─── */}
      {(() => {
        const hasKeyPts = ["PNS", "SP", "Ad1", "Ad3"].filter(l =>
          markups.some(m => m.visible !== false && m.placed && m.label?.toLowerCase() === l.toLowerCase())
        ).length >= 3;
        if (!hasKeyPts) return null;
        return (
          <Btn
            t={t}
            onClick={() => {
              // Pixels of the radiograph itself, in image coordinates (not the
              // zoomed, panned, drawn-over screen canvas).
              const imageData = getImagePixels ? getImagePixels() : null;
              const bounds = generateAirwayBoundaries(markups, imageData);
              if (!bounds) return;
              const curves = [];
              if (bounds.anterior.length >= 2) {
                curves.push({
                  id: Math.random().toString(36).slice(2, 10),
                  type: "curve",
                  label: "Anterior Airway Boundary",
                  points: bounds.anterior,
                  color: "#38bdf8",
                  visible: true,
                  locked: false,
                  curveStyle: "catmull",
                });
              }
              if (bounds.posterior.length >= 2) {
                curves.push({
                  id: Math.random().toString(36).slice(2, 10),
                  type: "curve",
                  label: "Posterior Airway Boundary",
                  points: bounds.posterior,
                  color: "#38bdf8",
                  visible: true,
                  locked: false,
                  curveStyle: "catmull",
                });
              }
              if (curves.length > 0 && onUpdateMarkups) {
                onUpdateMarkups({ markups: [...markups, ...curves] });
              }
            }}
            style={{
              background: t.surf3,
              color: t.tx,
              border: `1px solid ${t.bdr}`,
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Generate Smooth Airway Boundaries
          </Btn>
        );
      })()}

      {/* ─── Measurements ─── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.tx2,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          Measurements
        </div>
        {measurements.length === 0 ? (
          <div style={{ fontSize: 10, color: t.tx3, textAlign: "center", padding: "12px 0" }}>
            No airway measurements available.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {measurements.map((m) => {
              const badge = zBadge(m, t);
              const valStr = m.value !== null ? `${fmtVal(m.value)} ${m.unit || unit}` : "—";
              const rangeStr =
                m.normMean && m.normSD
                  ? `${(m.normMean - m.normSD).toFixed(1)}–${(m.normMean + m.normSD).toFixed(1)} ${m.unit || unit}`
                  : "—";
              const tier = m.tier || "core";
              const tierColor = tier === "core" ? t.tx3 : t.acc;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "2px 6px",
                    padding: "5px 8px",
                    borderRadius: 5,
                    background: t.surf2,
                    border: `1px solid ${t.bdr}`,
                    borderLeft: m.value !== null ? `3px solid ${badge.color}` : `3px solid ${t.tx3}44`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: t.tx,
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {m.label}
                    </div>
                    <span
                      style={{
                        fontSize: 7,
                        color: tierColor,
                        background: tier === "core" ? t.surf3 : t.acc + "18",
                        padding: "1px 4px",
                        borderRadius: 3,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                      }}
                    >
                      {tier}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: m.value !== null ? t.tx : t.tx3,
                      textAlign: "right",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {valStr}
                  </div>
                  {m.zScore !== null && (
                    <div
                      style={{
                        fontSize: 8,
                        color: t.tx3,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: badge.color,
                          flexShrink: 0,
                        }}
                      />
                      {badge.label}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 8,
                      color: t.tx3,
                      textAlign: "right",
                    }}
                  >
                    {rangeStr}
                  </div>
                  {m.normSource && (
                    <div
                      style={{
                        fontSize: 7,
                        color: t.tx3,
                        fontStyle: "italic",
                        gridColumn: "1 / -1",
                      }}
                    >
                      Source: {m.normSource}{m.basis === "traced boundary" ? " · measured on the traced airway walls" : ""}
                    </div>
                  )}
                  {m.value === null && (
                    <div
                      style={{
                        fontSize: 8,
                        color: t.tx3,
                        fontStyle: "italic",
                        gridColumn: "1 / -1",
                      }}
                    >
                      {m.interpretation || "Missing landmarks"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Summary ─── */}
      {summary.total > 0 && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: t.surf3,
            border: `1px solid ${t.bdr}`,
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {summary.abnormal === 0 ? (
            <span style={{ color: t.ok, fontWeight: 600 }}>
              All measurements within normal range
            </span>
          ) : (
            <span
              style={{
                color: summary.abnormal > summary.total / 2 ? t.err : t.warn,
                fontWeight: 600,
              }}
            >
              {summary.abnormal} of {summary.total} measurements abnormal
            </span>
          )}
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
