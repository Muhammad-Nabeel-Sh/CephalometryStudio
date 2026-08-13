// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIPTIVE PANEL — Config & Results UI for Descriptive/Normative Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, Fragment } from "react";
import { RESEARCH_NORMS } from "./descriptive.js";
import { InfoBox } from "../ui/ui.jsx";

function sid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Config Panel ────────────────────────────────────────────────────────
export function DescriptiveConfig({ study, sessions, onUpdateStudy, t }) {
  const config = study.config;
  const labelIds = config.labelIds || [];

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId) ? labelIds.filter(id => id !== labelId) : [...labelIds, labelId];
    update({ labelIds: next });
  };

  const addNorm = () => {
    const norms = config.referenceNorms || [];
    update({
      referenceNorms: [...norms, {
        id: sid(),
        label: `Norm ${norms.length + 1}`,
        values: {},
      }],
    });
  };

  const removeNorm = (id) => {
    update({ referenceNorms: (config.referenceNorms || []).filter(n => n.id !== id) });
  };

  const updateNormLabel = (id, label) => {
    update({ referenceNorms: (config.referenceNorms || []).map(n => n.id === id ? { ...n, label } : n) });
  };

  const addNormValue = (normId, measLabel) => {
    update({
      referenceNorms: (config.referenceNorms || []).map(n =>
        n.id === normId ? { ...n, values: { ...n.values, [measLabel]: { mean: 0, sd: 1 } } } : n
      ),
    });
  };

  const updateNormValue = (normId, measLabel, field, val) => {
    update({
      referenceNorms: (config.referenceNorms || []).map(n => {
        if (n.id !== normId) return n;
        const v = { ...(n.values[measLabel] || { mean: 0, sd: 1 }) };
        v[field] = Number(val) || 0;
        return { ...n, values: { ...n.values, [measLabel]: v } };
      }),
    });
  };

  const removeNormValue = (normId, measLabel) => {
    update({
      referenceNorms: (config.referenceNorms || []).map(n => {
        if (n.id !== normId) return n;
        const v = { ...n.values };
        delete v[measLabel];
        return { ...n, values: v };
      }),
    });
  };

  const addPredefinedNorm = (norm) => {
    update({
      referenceNorms: [...(config.referenceNorms || []), { ...norm, id: sid() }],
    });
  };

  // Available labels from sessions
  const availableLabels = [...new Set((sessions || []).flatMap(s =>
    (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)
  ))].sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11 }}>

      <InfoBox t={t}>
        Compute descriptive statistics, reference intervals and z-scores
        from your session measurements. Optionally group by a metadata field.
      </InfoBox>

      {/* Grouping */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Group By</div>
        <select value={config.groupBy || "none"} onChange={e => update({ groupBy: e.target.value })}
          style={{ width: "100%", padding: "5px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10 }}>
          <option value="none">All sessions (no grouping)</option>
          <option value="group">By group (session meta)</option>
          <option value="operator">By operator</option>
          <option value="patient">By patient</option>
        </select>
      </div>

      {/* Patient context for age/sex-aware norm comparison */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Patient Context (for norm comparison)</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" placeholder="Age" value={config.patientAge ?? ""} onChange={e => update({ patientAge: e.target.value === "" ? null : e.target.value })}
            style={{ width: 70, padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10 }} />
          <select value={config.patientSex || ""} onChange={e => update({ patientSex: e.target.value || null })}
            style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10 }}>
            <option value="">Sex (any)</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div style={{ fontSize: 8, color: t.tx3, marginTop: 2 }}>Used to pick the age/sex-matched norm stratum and warn on mismatch. Leave blank to auto-derive from session meta.</div>
      </div>

      {/* Measurements */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Measurements</div>
        <LabelSelector sessions={sessions} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Reference norms */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>Reference Norms</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => {
              // Collect norms from all sessions, group by source
              const sessionNorms = sessions.flatMap(s => s.norms || []);
              if (sessionNorms.length === 0) return;
              const groups = {};
              sessionNorms.forEach(n => {
                const key = n.source || "Imported";
                if (!groups[key]) groups[key] = { id: sid(), label: key, values: {} };
                groups[key].values[n.markupLabel] = { mean: n.mean, sd: n.sd };
              });
              const existing = config.referenceNorms || [];
              update({ referenceNorms: [...existing, ...Object.values(groups)] });
            }}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
              From Norms
            </button>
            <button onClick={addNorm}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>
              + Custom
            </button>
          </div>
        </div>

        {/* Norms from session norms panel */}
        {(() => {
          const sessionNorms = sessions.flatMap(s => s.norms || []);
          if (sessionNorms.length === 0) return null;
          // Build unique sources
          const sources = [...new Set(sessionNorms.map(n => n.source || "Imported"))];
          return (
            <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 4, background: t.surf2, border: `1px solid ${t.bdr}44` }}>
              <div style={{ fontSize: 9, color: t.tx3, marginBottom: 4 }}>Norms defined in workspace:</div>
              {sources.map(src => {
                const norms = sessionNorms.filter(n => (n.source || "Imported") === src);
                const alreadyImported = (config.referenceNorms || []).some(r => r.label === src);
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, fontSize: 9 }}>
                    <span style={{ flex: 1, color: t.tx2, fontFamily: "'DM Mono',monospace" }}>{src} ({norms.length})</span>
                    <button onClick={() => {
                      const vals = {};
                      norms.forEach(n => { vals[n.markupLabel] = { mean: n.mean, sd: n.sd }; });
                      update({ referenceNorms: [...(config.referenceNorms || []), { id: sid(), label: src, values: vals }] });
                    }} disabled={alreadyImported}
                      style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: alreadyImported ? t.tx3 : t.acc, cursor: alreadyImported ? "default" : "pointer", opacity: alreadyImported ? 0.5 : 1 }}>
                      {alreadyImported ? "Imported" : "Import"}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Predefined norms */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: t.tx3, marginBottom: 3 }}>Predefined:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {RESEARCH_NORMS.map(n => {
              const alreadyAdded = (config.referenceNorms || []).some(r => r.label === n.label);
              return (
                <button key={n.id} onClick={() => addPredefinedNorm(n)} disabled={alreadyAdded}
                  style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: alreadyAdded ? "default" : "pointer",
                    border: `1px solid ${t.bdr}`, background: alreadyAdded ? t.surf3 : "transparent",
                    color: alreadyAdded ? t.tx3 : t.tx2, opacity: alreadyAdded ? 0.6 : 1,
                  }}>
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom norms */}
        {(config.referenceNorms || []).map(norm => (
          <div key={norm.id} style={{ marginBottom: 6, padding: 8, borderRadius: 4, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <input value={norm.label} onChange={e => updateNormLabel(norm.id, e.target.value)}
                style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10, fontWeight: 600 }} />
              <button onClick={() => removeNorm(norm.id)}
                style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 2 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {Object.entries(norm.values || {}).map(([meas, v]) => (
                <div key={meas} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ flex: 1, fontSize: 9, fontFamily: "'DM Mono',monospace", color: t.tx }}>{meas}</span>
                  <input type="number" step="any" value={v.mean} onChange={e => updateNormValue(norm.id, meas, "mean", e.target.value)}
                    placeholder="Mean" style={{ width: 55, padding: "2px 4px", borderRadius: 2, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }} />
                  <span style={{ fontSize: 9, color: t.tx3 }}>±</span>
                  <input type="number" step="any" value={v.sd} onChange={e => updateNormValue(norm.id, meas, "sd", e.target.value)}
                    placeholder="SD" style={{ width: 50, padding: "2px 4px", borderRadius: 2, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }} />
                  <button onClick={() => removeNormValue(norm.id, meas)}
                    style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 9, padding: 1 }}>✕</button>
                </div>
              ))}
            </div>
            {/* Add measurement to this norm */}
            <select value="" onChange={e => { if (e.target.value) addNormValue(norm.id, e.target.value); }}
              style={{ width: "100%", marginTop: 4, padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
              <option value="">+ Add measurement...</option>
              {availableLabels.filter(l => !norm.values?.[l]).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Ready indicator */}
      <div style={{ fontSize: 10, color: t.tx2, textAlign: "center", padding: 6, background: t.surf3, borderRadius: 4 }}>
        {sessions.length === 0 ? "⚠ No sessions available" :
         `✓ ${sessions.length} session(s), ${labelIds.length || "all"} measurement(s)`}
      </div>
    </div>
  );
}

// ─── Label Selector ──────────────────────────────────────────────────────
function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [...new Set((sessions || []).flatMap(s =>
    (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)
  ))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 10, color: t.tx3 }}>No labeled markups found.</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {selected.length === 0 && <span style={{ fontSize: 10, color: t.tx3, padding: "2px 0" }}>All ({labels.length})</span>}
      {selected.length > 0 && (
        <button onClick={() => labels.forEach(l => { if (selected.includes(l)) onToggle(l); })}
          style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer" }}>
          Clear
        </button>
      )}
      {labels.map(l => (
        <button key={l} onClick={() => onToggle(l)}
          style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
            border: `1px solid ${selected.includes(l) ? t.acc : t.bdr}`,
            background: selected.includes(l) ? t.acc + "22" : "transparent",
            color: selected.includes(l) ? t.acc : t.tx2,
            fontWeight: selected.includes(l) ? 700 : 400,
            fontFamily: "'DM Mono',monospace",
          }}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Results Panel ──────────────────────────────────────────────────────
export function DescriptiveResults({ results, t }) {
  const [tab, setTab] = useState("descriptive");
  const [group, setGroup] = useState("all");
  const [sortBy, setSortBy] = useState("label");

  const tabs = [
    { id: "descriptive", label: "Descriptive" },
    { id: "refinterval", label: "Ref. Intervals" },
    { id: "zscores", label: "Z-Scores" },
    { id: "summary", label: "Summary" },
  ];

  const groupKeys = results.groupOrder || [];
  const useGroup = group === "all" ? null : group;
  const data = useGroup ? results.groups?.[useGroup]?.labels : results.combined;
  const labelNames = data ? Object.keys(data).sort() : [];

  const sortedLabels = [...labelNames];
  if (sortBy === "n") sortedLabels.sort((a, b) => (data[b]?.stats?.n || 0) - (data[a]?.stats?.n || 0));
  else if (sortBy === "mean") sortedLabels.sort((a, b) => (data[b]?.stats?.mean || 0) - (data[a]?.stats?.mean || 0));

  return (
    <div>
      {/* Controls bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {groupKeys.length > 1 && (
          <select value={group} onChange={e => setGroup(e.target.value)}
            style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
            <option value="all">All groups</option>
            {groupKeys.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
          <option value="label">Sort: Label</option>
          <option value="n">Sort: N</option>
          <option value="mean">Sort: Mean</option>
        </select>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8, borderBottom: `1px solid ${t.bdr}44` }}>
        {tabs.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            style={{
              padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: tab === tabItem.id ? `2px solid ${t.acc}` : "2px solid transparent",
              background: "transparent", color: tab === tabItem.id ? t.acc : t.tx3,
            }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "descriptive" && <DescriptiveTable labels={sortedLabels} data={data} t={t} />}
      {tab === "refinterval" && <RefIntervalTable labels={sortedLabels} data={data} t={t} />}
      {tab === "zscores" && <ZScoreTable results={results} labels={sortedLabels} t={t} />}
      {tab === "summary" && <SummaryTable results={results} labels={sortedLabels} t={t} />}
    </div>
  );
}

// ─── Descriptive Stats Table ────────────────────────────────────────────
function DescriptiveTable({ labels, data, t }) {
  const valid = labels.filter(l => data[l]?.stats);
  if (valid.length === 0) return <EmptyDetail message="No data available. Run analysis first." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Unit", "N", "Mean", "SD", "SEM", "Median", "Q1", "Q3", "Min", "Max", "Skew", "Kurt"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(l => {
            const s = data[l].stats;
            return (
              <tr key={l} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{l}</td>
                <td style={{ padding: "5px 6px", color: t.tx3 }}>{data[l].unit || "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.n}</td>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 700 }}>{s.mean.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.sd.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.sem.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.median.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.q1.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.q3.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.min.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.max.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.skewness.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{s.kurtosis.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Reference Interval Table ──────────────────────────────────────────
function RefIntervalTable({ labels, data, t }) {
  const valid = labels.filter(l => data[l]?.referenceInterval);
  if (valid.length === 0) return <EmptyDetail message="No reference interval data available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Unit", "Method", "Lower", "Upper", "90% CI Lower", "90% CI Upper"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map(l => {
            const ri = data[l].referenceInterval;
            return (
              <tr key={l} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{l}</td>
                <td style={{ padding: "5px 6px", color: t.tx3 }}>{data[l].unit || "—"}</td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: t.acc + "22", color: t.acc, fontWeight: 600 }}>
                    {ri.method}
                  </span>
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{ri.recommendedLower?.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{ri.recommendedUpper?.toFixed(2)}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {ri.parametric?.lowerCi ? `[${ri.parametric.lowerCi[0].toFixed(2)}, ${ri.parametric.lowerCi[1].toFixed(2)}]` : "—"}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {ri.parametric?.upperCi ? `[${ri.parametric.upperCi[0].toFixed(2)}, ${ri.parametric.upperCi[1].toFixed(2)}]` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Z-Score Table ──────────────────────────────────────────────────────
function ZScoreTable({ results, labels, t }) {
  const norms = results.referenceNorms || [];
  const zScores = results.zScores || {};
  if (norms.length === 0) return <EmptyDetail message="No reference norms configured. Add norms and re-run." t={t} />;

  const validLabels = labels.filter(l => norms.some(n => zScores[n.id]?.[l]?.zScore));
  const ctx = results.patientContext;
  const warnings = norms.map(n => zScores[n.id]?._stratumWarning).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ctx && (ctx.age != null || ctx.sex) && (
        <div style={{ fontSize: 9, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>
          Patient context: {ctx.age != null ? `age ${ctx.age}` : "age —"}{ctx.sex ? `, ${ctx.sex}` : ""}
        </div>
      )}
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 9, color: t.warn, background: t.warn + "14", border: `1px solid ${t.warn}33`, borderRadius: 4, padding: "4px 6px" }}>⚠ {w}</div>
      ))}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
          <thead>
            <tr style={{ background: t.surf2 }}>
              <th style={{ padding: "4px 6px", textAlign: "left", color: t.tx, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>Label</th>
              {norms.map(n => (
                <th key={n.id} colSpan={2} style={{ padding: "4px 6px", textAlign: "center", color: t.tx, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  {n.label}
                  {zScores[n.id]?.[validLabels[0]]?.stratum && (
                    <div style={{ fontSize: 7, color: t.tx3, textTransform: "none", fontWeight: 400, marginTop: 2 }}>{zScores[n.id]?.[validLabels[0]]?.stratum}</div>
                  )}
                </th>
              ))}
            </tr>
            <tr style={{ background: t.surf2 }}>
              <th></th>
              {norms.map(n => (
                <Fragment key={n.id}>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: t.tx, fontSize: 7 }}>Z</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: t.tx, fontSize: 7 }}>%ile</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {validLabels.map(l => (
              <tr key={l} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{l}</td>
                {norms.map(n => {
                  const z = zScores[n.id]?.[l]?.zScore;
                  const zVal = z?.z;
                  const pctVal = z?.percentileRank;
                  return (
                    <Fragment key={n.id}>
                      <td style={{ padding: "5px 6px", color: z ? zColor(zVal) : t.tx3 }}>
                        {zVal != null && isFinite(zVal) ? zVal.toFixed(3) : "\u2014"}
                      </td>
                      <td style={{ padding: "5px 6px", color: t.tx2 }}>
                        {pctVal != null && isFinite(pctVal) ? pctVal.toFixed(1) : "\u2014"}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function zColor(z) {
  const a = Math.abs(z);
  if (a < 1) return "#34d399";
  if (a < 2) return "#fb923c";
  if (a < 3) return "#f87171";
  return "#dc2626";
}

// ─── Summary Table ──────────────────────────────────────────────────────
function SummaryTable({ results, labels, t }) {
  const norms = results.referenceNorms || [];
  const combined = results.combined || {};
  const valid = labels.filter(l => combined[l]?.stats);

  if (valid.length === 0) return <EmptyDetail message="No data to summarize." t={t} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Descriptive Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
          <span>Sessions:</span><span style={{ color: t.tx, fontWeight: 600 }}>{results.groupOrder?.length || 0} groups</span>
          <span>Measurements:</span><span style={{ color: t.tx }}>{valid.length}</span>
          <span>Reference norms:</span><span style={{ color: t.tx }}>{norms.length}</span>
        </div>
      </div>

      {/* Distribution summary */}
      <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", fontSize: 10, color: t.tx2 }}>
          <span>Normal (approx.):</span>
          <span style={{ color: t.ok, fontWeight: 600 }}>{valid.filter(l => combined[l].stats?.isNormal).length}</span>
          <span>Non-normal:</span>
          <span style={{ color: t.err, fontWeight: 600 }}>{valid.filter(l => !combined[l].stats?.isNormal).length}</span>
        </div>
      </div>

      {/* Reference norms match */}
      {norms.length > 0 && (
        <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Norm Comparison</div>
          {norms.map(n => (
            <div key={n.id} style={{ marginBottom: 4, fontSize: 10, color: t.tx2 }}>
              <div style={{ fontWeight: 600, color: t.tx, marginBottom: 2 }}>{n.label}</div>
              {Object.keys(n.values || {}).filter(m => combined[m]?.stats).map(m => {
                const z = (combined[m].stats.mean - n.values[m].mean) / n.values[m].sd;
                return (
                  <div key={m} style={{ display: "flex", gap: 8, marginLeft: 8, fontSize: 9 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", color: t.tx }}>{m}:</span>
                    <span style={{ color: zColor(z) }}>
                      {combined[m].stats.mean.toFixed(2)} vs {n.values[m].mean} (z={z.toFixed(2)})
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyDetail({ message, t }) {
  return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 16 }}>{message}</div>;
}
