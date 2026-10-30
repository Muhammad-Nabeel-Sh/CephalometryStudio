// ═══════════════════════════════════════════════════════════════════════════════
// SUPERIMPOSITION PANEL — Config & Results UI for Superimposition/Growth Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { REGISTRATIONS } from "./superimposition.js";
import { InfoBox, Chip, TabBar } from "../ui/ui.jsx";
import { DELTA_NORMS } from "./superimposition.js";
import { LabelSelector } from "./LabelSelector.jsx";
import { fmtNum } from "../lib/utils.js";

const TAB_DEFS = [
  { id: "displacement", label: "Displacements" },
  { id: "patterns",     label: "Patterns" },
  { id: "growth",       label: "Growth" },
  { id: "deltaNorms",   label: "Delta Norms" },
  { id: "angular",      label: "Angular" },
  { id: "linear",       label: "Linear" },
  { id: "error",        label: "Error" },
];

// ─── Shared label selector ───────────────────────────────────────────────────


// ─── Config Panel ────────────────────────────────────────────────────────────

export function SuperimpositionConfig({ study, sessions, onUpdateStudy, t }) {
  const config = study.config;
  const baseId = config.baseSessionId || "";
  const compareId = config.compareSessionId || "";
  const method = config.method || "procrustes";
  const planePt1 = config.planePoint1 || "";
  const planePt2 = config.planePoint2 || "";
  const labelIds = config.labelIds || [];

  const update = (patch) => onUpdateStudy({ ...study, config: { ...config, ...patch } });

  const sessionList = (sessions || []).filter(s => s && (s.markups || []).length > 0);
  const baseSession = sessionList.find(s => s.id === baseId);
  const compareSession = sessionList.find(s => s.id === compareId);

  const uniquePointLabels = [...new Set(
    [baseSession, compareSession].filter(Boolean).flatMap(s =>
      (s.markups || []).filter(m => m.type === "point" && m.label).map(m => m.label)
    )
  )].sort();

  const toggleLabel = (label) => {
    const next = labelIds.includes(label) ? labelIds.filter(l => l !== label) : [...labelIds, label];
    update({ labelIds: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <InfoBox t={t}>
        Superimpose two tracings to visualize skeletal/dental change. Includes growth pattern detection, delta norm comparison, rotation tracking, and error quantification.
      </InfoBox>

      <div>
        <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Base (T1 / Pre) Session *</div>
        <select value={baseId} onChange={e => update({ baseSessionId: e.target.value })}
          style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 12 }}>
          <option value="">Select base session...</option>
          {sessionList.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 6)}{s.meta?.timepoint ? ` (${s.meta.timepoint})` : ""}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Compare (T2 / Post) Session *</div>
        <select value={compareId} onChange={e => update({ compareSessionId: e.target.value })}
          style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 12 }}>
          <option value="">Select compare session...</option>
          {sessionList.filter(s => s.id !== baseId).map(s => (
            <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 6)}{s.meta?.timepoint ? ` (${s.meta.timepoint})` : ""}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Alignment Method</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "registration", label: "Stable structure (recommended)" }, { id: "structural", label: "Custom reference plane" }, { id: "procrustes", label: "Procrustes best-fit" }].map(opt => (
            <Chip t={t} on={method === opt.id} key={opt.id} onClick={() => update({ method: opt.id })} style={{ flex: 1, padding: "6px 8px", textAlign: "center" }}>
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      {method === "registration" && (
        <div style={{ padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Registration</div>
          <select value={config.registration || "SN_S"} onChange={e => update({ registration: e.target.value })}
            style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf2, color: t.tx, fontSize: 12 }}>
            {REGISTRATIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <div style={{ fontSize: 12, color: t.tx3, marginTop: 4, lineHeight: 1.5 }}>
            Registers on a structure that is stable during growth (rotation + translation, no scaling), so displacements show real growth and treatment change. Use the cranial-base registration for overall change, maxillary/mandibular registrations for regional change.
          </div>
        </div>
      )}

      {method === "procrustes" && (
        <div style={{ padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44`, fontSize: 12, color: t.tx3, lineHeight: 1.5 }}>
          Best-fit over all matched landmarks spreads change across stable and growing regions — use it for shape comparison, not for reading growth.
          <label style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, color: t.tx2, fontSize: 12 }}>
            <input type="checkbox" checked={!!config.allowScale} onChange={e => update({ allowScale: e.target.checked })} />
            Scale to equal size (size-standardised shape comparison — removes growth in size)
          </label>
        </div>
      )}

      {method === "structural" && (
        <div style={{ padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Reference Plane Points</div>
          <div style={{ fontSize: 12, color: t.tx3, marginBottom: 6 }}>Select two landmarks: the first is the registration point, the line to the second sets orientation (rotation + translation, no scaling).</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Point 1</div>
              <select value={planePt1} onChange={e => update({ planePoint1: e.target.value })}
                style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf2, color: t.tx, fontSize: 12 }}>
                <option value="">Select...</option>
                {uniquePointLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Point 2</div>
              <select value={planePt2} onChange={e => update({ planePoint2: e.target.value })}
                style={{ width: "100%", padding: "5px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf2, color: t.tx, fontSize: 12 }}>
                <option value="">Select...</option>
                {uniquePointLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3, fontWeight: 600 }}>Landmarks {labelIds.length > 0 ? `(${labelIds.length} selected)` : "(all)"}</div>
        <LabelSelector sessions={sessionList} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Patient demographics for delta norms */}
      <div style={{ padding: 8, borderRadius: 6, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 12, color: t.tx2, marginBottom: 6, fontWeight: 600 }}>Patient Info (for Delta Norms)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Sex</div>
            <select value={config.sex || ""} onChange={e => update({ sex: e.target.value })}
              style={{ width: "100%", fontSize: 12, padding: "3px 5px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit" }}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Age at T1</div>
            <input type="number" min="4" max="30" step="0.5" value={config.ageStart || ""} onChange={e => update({ ageStart: +e.target.value })}
              style={{ width: "100%", fontSize: 12, padding: "3px 5px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>Age at T2</div>
            <input type="number" min="4" max="30" step="0.5" value={config.ageEnd || ""} onChange={e => update({ ageEnd: +e.target.value })}
              style={{ width: "100%", fontSize: 12, padding: "3px 5px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontFamily: "inherit" }} />
          </div>
        </div>
      </div>

      {baseSession && compareSession && (
        <div style={{ fontSize: 12, color: t.tx3, padding: "6px 8px", background: t.surf2, borderRadius: 4 }}>
          Base: {baseSession.markups?.filter(m => m.type === "point" && m.label).length || 0} points
          {" | "}
          Compare: {compareSession.markups?.filter(m => m.type === "point" && m.label).length || 0} points
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ───────────────────────────────────────────────────────────

export function SuperimpositionResults({ results, t }) {
  const [tab, setTab] = useState("displacement");

  if (!results) return <div style={{ fontSize: 12, color: t.tx3, padding: 16 }}>No results. Run the analysis first.</div>;
  if (results.error) return <div style={{ fontSize: 12, color: t.err, padding: 16 }}>Error: {results.error}</div>;

  const {
    alignmentLabel, matchedCount, totalSrc, totalDst,
    displacements, angularChanges, linearChanges,
    rotationTracking, planeIntersections, centroidSize, stats,
    deltaNorms, patterns, errSummary,
    baseSession, compareSession, method,
  } = results;

  const sorted = [...(displacements || [])].sort((a, b) => b.lenMm - a.lenMm);
  const activeTabs = TAB_DEFS.filter(tb => {
    if (tb.id === "growth") return rotationTracking?.length > 0 || planeIntersections?.length > 0;
    if (tb.id === "deltaNorms") return deltaNorms?.length > 0;
    if (tb.id === "patterns") return patterns?.length > 0;
    if (tb.id === "error") return errSummary != null;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ padding: "8px 12px", background: t.surf2, borderRadius: 6, fontSize: 12, color: t.tx2 }}>
        <div style={{ fontWeight: 700, color: t.tx, marginBottom: 2 }}>
          {baseSession?.name || "T1"} → {compareSession?.name || "T2"}
        </div>
        <div>
          Method: <span style={{ color: t.acc }}>{method === "procrustes" ? "Procrustes" : method === "registration" ? "Stable-structure registration" : "Custom reference plane"}</span>
          {" | "}Aligned on: {alignmentLabel}
        </div>
        <div>
          Matched: <span style={{ color: t.ok }}>{matchedCount}</span> / {totalSrc} base / {totalDst} compare landmarks
        </div>
        {results.calibrationUsed && <div style={{ color: t.ok }}>Calibrated (mm)</div>}
        {!results.calibrationUsed && <div style={{ color: t.warn }}>Not calibrated (px)</div>}
      </div>

      {/* Stats summary */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "Mean", value: stats.mean?.toFixed(2), color: t.acc },
            { label: "Max", value: stats.max?.toFixed(2), color: t.err },
            { label: "Median", value: stats.median?.toFixed(2), color: t.ok },
            { label: "SD", value: stats.sd?.toFixed(2), color: t.tx2 },
          ].map(s => (
            <div key={s.label} style={{ padding: "6px 8px", background: t.surf2, borderRadius: 4, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: t.tx3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: t.tx3 }}>{displacements?.[0]?.unit || "mm"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Centroid size */}
      {centroidSize && (
        <div style={{ padding: "6px 10px", background: t.surf2, borderRadius: 4, fontSize: 12, display: "flex", gap: 16 }}>
          <span>Centroid size: <b>{centroidSize.base?.toFixed(1)}</b> → <b>{centroidSize.compare?.toFixed(1)}</b></span>
          <span style={{ color: centroidSize.pctChange > 0 ? t.ok : centroidSize.pctChange < 0 ? t.err : t.tx2 }}>
            {centroidSize.pctChange > 0 ? "+" : ""}{centroidSize.pctChange?.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Tab bar */}
      <TabBar t={t} tabs={activeTabs} active={tab} onChange={setTab} style={{ marginBottom: 10 }} />

      {/* ─── Displacement Table ─── */}
      {tab === "displacement" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Landmark</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Distance</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Dir</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Ant/Post</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Sup/Inf</th>
                <th style={{ textAlign: "center", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Sig.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.label} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                  <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{d.label}</td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                    <span style={{ color: d.lenMm < 2 ? t.ok : d.lenMm < 5 ? t.warn : t.err, fontWeight: 600 }}>
                      {fmtNum(d.lenMm, 2)} {d.unit}
                    </span>
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                    {d.angle?.toFixed(0)}°
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                    {d.dxMm != null ? `${d.dxMm > 0 ? "+" : ""}${fmtNum(d.dxMm, 1)}` : "—"}
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                    {d.dyMm != null ? `${d.dyMm > 0 ? "+" : ""}${fmtNum(d.dyMm, 1)}` : "—"}
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "center" }}>
                    <span style={{
                      fontSize: 12, padding: "1px 5px", borderRadius: 3, fontWeight: 600,
                      background: d.confidenceLevel === "high" ? t.ok + "22" : d.confidenceLevel === "moderate" ? t.warn + "22" : t.tx3 + "22",
                      color: d.confidenceLevel === "high" ? t.ok : d.confidenceLevel === "moderate" ? t.warn : t.tx3,
                    }}>
                      {d.confidenceLevel || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Patterns Tab ─── */}
      {tab === "patterns" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(!patterns || patterns.length === 0) ? (
            <div style={{ fontSize: 12, color: t.tx3, padding: 12 }}>No clinical patterns detected.</div>
          ) : (
            patterns.map((p, i) => {
              const sevColor = p.severity === "severe" ? t.err : p.severity === "moderate" ? t.warn : t.ok;
              return (
                <div key={i} style={{ padding: 10, borderRadius: 6, background: t.surf2, borderLeft: `3px solid ${sevColor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{p.label}</span>
                    <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 3, background: sevColor + "22", color: sevColor, fontWeight: 600 }}>
                      {p.severity?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.tx2, marginBottom: 2 }}>{p.summary}</div>
                  {p.detail && <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.5 }}>{p.detail}</div>}
                  <div style={{ fontSize: 12, color: t.tx3, marginTop: 2 }}>Category: {p.category}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Growth / Rotation Tab ─── */}
      {tab === "growth" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Rotation tracking */}
          {rotationTracking && rotationTracking.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Plane Rotation Tracking</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Plane</th>
                    <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Base</th>
                    <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Compare</th>
                    <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Change</th>
                    <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {rotationTracking.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                      <td style={{ padding: "3px 6px", fontWeight: 600, color: t.tx }}>{r.label}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{r.baseAngleDeg?.toFixed(1)}°</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{r.compareAngleDeg?.toFixed(1)}°</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                        <span style={{ color: Math.abs(r.deltaDeg) < 2 ? t.ok : Math.abs(r.deltaDeg) < 5 ? t.warn : t.err, fontWeight: 600 }}>
                          {r.deltaDeg > 0 ? "+" : ""}{r.deltaDeg?.toFixed(1)}°
                        </span>
                      </td>
                      <td style={{ padding: "3px 6px", fontSize: 12, color: t.tx2 }}>{r.direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Plane intersections */}
          {planeIntersections && planeIntersections.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Reference Plane Angles</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {planeIntersections.map(p => (
                  <div key={p.name} style={{ padding: 8, background: t.surf2, borderRadius: 4, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(p.delta) < 1 ? t.ok : t.warn, fontFamily: "'DM Mono',monospace" }}>
                      {p.delta > 0 ? "+" : ""}{p.delta?.toFixed(1)}°
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Delta Norms Tab ─── */}
      {tab === "deltaNorms" && (
        <div style={{ overflowX: "auto" }}>
          {(!deltaNorms || deltaNorms.length === 0) ? (
            <div style={{ fontSize: 12, color: t.tx3, padding: 12 }}>
              No delta norm data available. Enter patient sex and ages at T1/T2 in the config panel.
              {DELTA_NORMS.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  Available norms: {DELTA_NORMS.map(n => n.label).join(", ")}
                </div>
              )}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Measurement</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Actual Δ</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Expected Δ</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Z-score</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {deltaNorms.map((d, i) => (
                  <tr key={`${d.label}::${d.measureKey}`} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontWeight: 600, color: t.tx }}>{d.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                      {d.delta > 0 ? "+" : ""}{d.delta?.toFixed(2)} {d.unit}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>
                      {d.norm?.expectedDelta > 0 ? "+" : ""}{d.norm?.expectedDelta?.toFixed(2)} ± {d.norm?.expectedSD?.toFixed(2)}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right" }}>
                      <span style={{
                        fontWeight: 700, fontFamily: "'DM Mono',monospace",
                        color: d.within1SD ? t.ok : d.within2SD ? t.warn : t.err,
                      }}>
                        {d.zScore > 0 ? "+" : ""}{d.zScore?.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: "3px 6px", fontSize: 12, color: t.tx2 }}>{d.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Angular Changes Tab ─── */}
      {tab === "angular" && (
        <div style={{ overflowX: "auto" }}>
          {(!angularChanges || angularChanges.length === 0) ? (
            <div style={{ fontSize: 12, color: t.tx3, padding: 12 }}>No matching angular measurements found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Angle</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T1</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T2</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {angularChanges.map((c, i) => (
                  <tr key={c.label} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{c.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.angle2?.toFixed(1)}°</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.angle1?.toFixed(1)}°</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      <span style={{ color: Math.abs(c.delta) < 1 ? t.ok : Math.abs(c.delta) < 3 ? t.warn : t.err, fontWeight: 600 }}>
                        {c.delta > 0 ? "+" : ""}{c.delta?.toFixed(1)}°
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Linear Changes Tab ─── */}
      {tab === "linear" && (
        <div style={{ overflowX: "auto" }}>
          {(!linearChanges || linearChanges.length === 0) ? (
            <div style={{ fontSize: 12, color: t.tx3, padding: 12 }}>No matching linear measurements found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Measurement</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T1</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>T2</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {linearChanges.map((c, i) => (
                  <tr key={`${c.label}::${c.measureKey}`} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{c.label} ({c.measureKey})</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.value2?.toFixed(2)} {c.unit}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{c.value1?.toFixed(2)} {c.unit}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      <span style={{ color: Math.abs(c.delta) < 1 ? t.ok : Math.abs(c.delta) < 3 ? t.warn : t.err, fontWeight: 600 }}>
                        {c.delta > 0 ? "+" : ""}{c.delta?.toFixed(2)} {c.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Error Tab ─── */}
      {tab === "error" && errSummary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "Total", value: errSummary.totalLandmarks, color: t.tx },
              { label: "Significant", value: errSummary.significantDisplacements, color: t.ok },
              { label: "Non-significant", value: errSummary.nonSignificant, color: t.tx3 },
              { label: "High Confidence", value: errSummary.highConfidence, color: t.acc },
            ].map(s => (
              <div key={s.label} style={{ padding: "6px 8px", background: t.surf2, borderRadius: 4, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: t.tx3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.6, padding: "6px 8px", background: t.surf2, borderRadius: 4 }}>
            <b style={{ color: t.tx2 }}>Significance:</b> Each displacement is compared against the typical measurement error for that landmark (0.4-0.8 mm from published literature). A displacement is flagged as "significant" when it exceeds 2x the propagated error, meaning it is likely a real anatomical change rather than measurement noise.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Landmark</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Displacement</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Error (±)</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>S/N Ratio</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", color: t.tx3, borderBottom: `1px solid ${t.bdr}` }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={d.label} style={{ background: i % 2 === 0 ? "transparent" : t.surf2 + "44" }}>
                    <td style={{ padding: "3px 6px", fontFamily: "'DM Mono',monospace", color: t.tx }}>{d.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{d.lenMm?.toFixed(2)} mm</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx3 }}>±{d.propagatedErrorMm?.toFixed(2)} mm</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx2 }}>{d.significanceRatio?.toFixed(1)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>
                      <span style={{
                        fontSize: 12, padding: "1px 5px", borderRadius: 3, fontWeight: 600,
                        background: d.confidenceLevel === "high" ? t.ok + "22" : d.confidenceLevel === "moderate" ? t.warn + "22" : t.err + "22",
                        color: d.confidenceLevel === "high" ? t.ok : d.confidenceLevel === "moderate" ? t.warn : t.err,
                      }}>
                        {d.confidenceLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
