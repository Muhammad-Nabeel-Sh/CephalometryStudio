// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY STUDY PANEL — Config & Results UI for Airway Analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { InfoBox, Btn } from "../ui/ui.jsx";

// ─── Config Panel ─────────────────────────────────────────────────────────

export function AirwayStudyConfig({ study, sessions, onUpdateStudy, t }) {
  const config = study.config;
  const sessionId = config.sessionId || (sessions.length > 0 ? sessions[0].id : "");

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const session = sessions.find(s => s.id === sessionId);
  const meta = session?.meta || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <InfoBox t={t}>
        Select a session and optional patient demographics to compute airway measurements against normative data.
      </InfoBox>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 4 }}>
          Session
        </div>
        <select
          value={sessionId}
          onChange={e => update({ sessionId: e.target.value })}
          style={{
            width: "100%", padding: "6px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`,
            background: t.surf3, color: t.tx, fontSize: 12, fontFamily: "inherit",
          }}>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.id}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 4 }}>
            Sex
          </div>
          <select
            value={config.sex || meta.gender || ""}
            onChange={e => update({ sex: e.target.value })}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`,
              background: t.surf3, color: t.tx, fontSize: 12, fontFamily: "inherit",
            }}>
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 4 }}>
            Age
          </div>
          <input
            type="number"
            value={config.age ?? meta.age ?? ""}
            onChange={e => update({ age: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="years"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`,
              background: t.surf3, color: t.tx, fontSize: 12, fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────

export function AirwayStudyResults({ results, t }) {
  if (!results) {
    return (
      <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", padding: 20 }}>
        Run analysis to see airway measurements.
      </div>
    );
  }

  if (results.error) {
    return (
      <div style={{ fontSize: 12, color: t.err, padding: 8, background: t.err + "12", borderRadius: 4 }}>
        {results.error}
      </div>
    );
  }

  const measurements = results.measurements || [];
  if (measurements.length === 0) {
    return (
      <div style={{ fontSize: 12, color: t.tx3, textAlign: "center", padding: 20 }}>
        No airway measurements computed.
      </div>
    );
  }

  const zColor = (z) => {
    if (z == null || !isFinite(z)) return t.tx3;
    if (Math.abs(z) <= 1) return "#22c55e";
    if (Math.abs(z) <= 2) return "#eab308";
    return "#ef4444";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {results.sessionName && (
        <div style={{ fontSize: 12, color: t.tx3, marginBottom: 4, fontStyle: "italic" }}>
          Session: {results.sessionName}
          {results.sex ? `  |  Sex: ${results.sex}` : ""}
          {results.age ? `  |  Age: ${results.age}` : ""}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: t.surf3, borderBottom: `1px solid ${t.bdr}` }}>
              <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600, color: t.tx }}>Measurement</th>
              <th style={{ padding: "4px 6px", textAlign: "center", fontWeight: 600, color: t.tx }}>Value</th>
              <th style={{ padding: "4px 6px", textAlign: "center", fontWeight: 600, color: t.tx }}>Norm Mean ± SD</th>
              <th style={{ padding: "4px 6px", textAlign: "center", fontWeight: 600, color: t.tx }}>Z-Score</th>
              <th style={{ padding: "4px 6px", textAlign: "center", fontWeight: 600, color: t.tx }}>Interpretation</th>
              <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600, color: t.tx }}>Clinical Note</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map(m => {
              const isSummary = m.id === "_global";
              return (
                <tr key={m.id} style={{
                  borderBottom: `1px solid ${t.bdr}44`,
                  background: isSummary ? t.acc + "0c" : "transparent",
                  fontWeight: isSummary ? 700 : 400,
                }}>
                  <td style={{ padding: "4px 6px", color: t.tx, whiteSpace: "nowrap" }}>{m.label}</td>
                  <td style={{ padding: "4px 6px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: m.value != null ? t.tx : t.tx3 }}>
                    {m.value != null ? m.value.toFixed(2) + " " + (m.unit || "") : "—"}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "center", color: t.tx2 }}>
                    {m.normMean != null ? m.normMean.toFixed(1) + " ± " + (m.normSD != null ? m.normSD.toFixed(1) : "—") : "—"}
                  </td>
                  <td style={{
                    padding: "4px 6px", textAlign: "center", fontWeight: 600,
                    fontFamily: "'DM Mono',monospace", color: zColor(m.zScore),
                  }}>
                    {m.zScore != null ? (m.zScore >= 0 ? "+" : "") + m.zScore.toFixed(2) : "—"}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "center", color: m.interpretation ? t.tx2 : t.tx3 }}>
                    {m.interpretation || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", fontSize: 12, color: t.tx2, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.clinicalNote || (isSummary ? m.interpretation : "") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
