// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION PANEL — Config & Results UI for Correlation/Regression Studies
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { InfoBox } from "../ui/ui.jsx";
import PlotlyChart, { heatmapLayout, heatmapData } from "./PlotlyChart.jsx";

function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [
    ...new Set(
      (sessions || []).flatMap((s) =>
        (s.markups || [])
          .filter(
            (m) => m.label && m.type !== "ruler" && m.type !== "silhouette",
          )
          .map((m) => m.label),
      ),
    ),
  ].sort();
  if (labels.length === 0)
    return (
      <div style={{ fontSize: 10, color: t.tx3 }}>
        No labeled markups found.
      </div>
    );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {selected.length === 0 && (
        <span style={{ fontSize: 10, color: t.tx3, padding: "2px 0" }}>
          All ({labels.length})
        </span>
      )}
      {selected.length > 0 && (
        <button
          onClick={() =>
            labels.forEach((l) => {
              if (selected.includes(l)) onToggle(l);
            })
          }
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            border: `1px solid ${t.bdr}`,
            background: "transparent",
            color: t.tx3,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      )}
      {labels.map((l) => (
        <button
          key={l}
          onClick={() => onToggle(l)}
          style={{
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 3,
            cursor: "pointer",
            border: `1px solid ${selected.includes(l) ? t.acc : t.bdr}`,
            background: selected.includes(l) ? t.acc + "22" : "transparent",
            color: selected.includes(l) ? t.acc : t.tx2,
            fontWeight: selected.includes(l) ? 700 : 400,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function CorrelationConfig({ study, sessions, onUpdateStudy, t }) {
  const config = study.config;
  const labelIds = config.labelIds || [];
  const covariates = config.covariates || [];
  const depVar = config.dependentVar || "";
  const predVars = config.predictorVars || [];

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId)
      ? labelIds.filter((id) => id !== labelId)
      : [...labelIds, labelId];
    update({ labelIds: next });
  };

  const availableLabels = [
    ...new Set(
      (sessions || []).flatMap((s) =>
        (s.markups || [])
          .filter(
            (m) => m.label && m.type !== "ruler" && m.type !== "silhouette",
          )
          .map((m) => m.label),
      ),
    ),
  ].sort();

  const toggleCovariate = (l) => {
    const next = covariates.includes(l)
      ? covariates.filter((c) => c !== l)
      : [...covariates, l];
    update({ covariates: next });
  };

  const togglePredVar = (l) => {
    const next = predVars.includes(l)
      ? predVars.filter((v) => v !== l)
      : [...predVars, l];
    update({ predictorVars: next });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontSize: 11,
      }}
    >
      <InfoBox t={t}>
        Compute correlation matrices, partial correlations, and regression
        models from continuous cephalometric measurements.
      </InfoBox>

      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: t.tx3,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            marginBottom: 4,
          }}
        >
          Correlation Method
        </div>
        <select
          value={config.method || "pearson"}
          onChange={(e) => update({ method: e.target.value })}
          style={{
            width: "100%",
            padding: "5px 6px",
            borderRadius: 4,
            border: `1px solid ${t.bdr}`,
            background: t.surf,
            color: t.tx,
            fontSize: 10,
          }}
        >
          <option value="pearson">Pearson r</option>
          <option value="spearman">Spearman rho</option>
        </select>
      </div>

      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: t.tx3,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            marginBottom: 4,
          }}
        >
          Measurements
        </div>
        <LabelSelector
          sessions={sessions}
          selected={labelIds}
          onToggle={toggleLabel}
          t={t}
        />
      </div>

      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: t.tx3,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            marginBottom: 4,
          }}
        >
          Covariates (partial correlation)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {availableLabels.map((l) => (
            <button
              key={l}
              onClick={() => toggleCovariate(l)}
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 3,
                cursor: "pointer",
                border: `1px solid ${covariates.includes(l) ? t.acc : t.bdr}`,
                background: covariates.includes(l)
                  ? t.acc + "22"
                  : "transparent",
                color: covariates.includes(l) ? t.acc : t.tx2,
                fontWeight: covariates.includes(l) ? 700 : 400,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.bdr}44`, paddingTop: 8 }}>
        <InfoBox t={t}>Optional: configure a regression model below.</InfoBox>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: t.tx3,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Dependent Variable (Regression)
        </div>
        <select
          value={depVar}
          onChange={(e) => update({ dependentVar: e.target.value })}
          style={{
            width: "100%",
            padding: "5px 6px",
            borderRadius: 4,
            border: `1px solid ${t.bdr}`,
            background: t.surf,
            color: t.tx,
            fontSize: 10,
          }}
        >
          <option value="">— None —</option>
          {availableLabels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {depVar && (
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: t.tx3,
              textTransform: "uppercase",
              letterSpacing: 0.3,
              marginBottom: 4,
            }}
          >
            Predictors
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {availableLabels
              .filter((l) => l !== depVar)
              .map((l) => (
                <button
                  key={l}
                  onClick={() => togglePredVar(l)}
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 3,
                    cursor: "pointer",
                    border: `1px solid ${predVars.includes(l) ? t.acc : t.bdr}`,
                    background: predVars.includes(l)
                      ? t.acc + "22"
                      : "transparent",
                    color: predVars.includes(l) ? t.acc : t.tx2,
                    fontWeight: predVars.includes(l) ? 700 : 400,
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {l}
                </button>
              ))}
          </div>
          {predVars.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: t.tx3, marginBottom: 2 }}>
                Logistic regression threshold (binary outcome):
              </div>
              <input
                type="number"
                step="any"
                value={config.threshold ?? ""}
                onChange={(e) =>
                  update({
                    threshold: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Auto (split at 0.5)"
                style={{
                  width: "95%",
                  padding: "3px 6px",
                  borderRadius: 4,
                  border: `1px solid ${t.bdr}`,
                  background: t.surf,
                  color: t.tx,
                  fontSize: 10,
                }}
              />
            </div>
          )}
        </div>
      )}

      <div
        style={{
          fontSize: 10,
          color: t.tx2,
          textAlign: "center",
          padding: 6,
          background: t.surf3,
          borderRadius: 4,
        }}
      >
        {sessions.length === 0
          ? "⚠ No sessions available"
          : `✓ ${sessions.length} session(s), ${labelIds.length || "all"} measurement(s)`}
      </div>
    </div>
  );
}

function formatP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001***";
  if (p < 0.01) return p.toFixed(3) + "**";
  if (p < 0.05) return p.toFixed(3) + "*";
  return p.toFixed(3);
}

function TabBar({ tabs, active, onChange, t }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        marginBottom: 8,
        borderBottom: `1px solid ${t.bdr}44`,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "5px 10px",
            fontSize: 9,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            borderBottom:
              active === tab.id
                ? `2px solid ${t.acc}`
                : "2px solid transparent",
            background: "transparent",
            color: t.tx,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CorrelationResults({ results, t }) {
  const [tab, setTab] = useState("heatmap");

  const tabs = [
    { id: "heatmap", label: "Heatmap" },
    { id: "table", label: "Table" },
    { id: "partial", label: "Partial" },
    { id: "regression", label: "Regression" },
    { id: "logistic", label: "Logistic" },
    { id: "descriptive", label: "Descriptive" },
  ];

  if (!results || results.note) {
    return (
      <div
        style={{ fontSize: 11, color: t.tx2, padding: 16, textAlign: "center" }}
      >
        {results?.note || "No results available. Run the analysis first."}
      </div>
    );
  }

  return (
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab} t={t} />

      <div style={{ overflow: "auto" }}>
        {tab === "heatmap" && <CorrelationHeatmap results={results} t={t} />}
        {tab === "table" && <CorrelationTable results={results} t={t} />}
        {tab === "partial" && (
          <PartialCorrelationTable results={results} t={t} />
        )}
        {tab === "regression" && <RegressionView results={results} t={t} />}
        {tab === "logistic" && <LogisticView results={results} t={t} />}
        {tab === "descriptive" && (
          <DescriptiveSummary results={results} t={t} />
        )}
      </div>
    </div>
  );
}

const CORR_SCALE = [
  [0, "#b91c1c"],
  [0.25, "#ef4444"],
  [0.4, "#fca5a5"],
  [0.5, "#e5e7eb"],
  [0.6, "#93c5fd"],
  [0.75, "#3b82f6"],
  [1, "#1d4ed8"],
];
const CORR_TFONT = {
  color: "#1f2937",
  size: 9,
  family: "'DM Sans',sans-serif",
};

function CorrelationHeatmap({ results, t }) {
  const { vars, matrix, n, method } = results;
  if (!vars || vars.length < 2) return null;
  const m = vars.length;
  const z = Array.from({ length: m }, () => Array(m).fill(null));
  const displayTxt = Array.from({ length: m }, () => Array(m).fill(""));
  const hoverTxt = Array.from({ length: m }, () => Array(m).fill(""));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) {
        z[i][j] = 1;
        displayTxt[i][j] = "1";
        hoverTxt[i][j] = "diagonal";
        continue;
      }
      const d = matrix[vars[i]]?.[vars[j]];
      if (!d) continue;
      z[i][j] = d.r;
      displayTxt[i][j] = d.r.toFixed(2);
      hoverTxt[i][j] = `r=${d.r.toFixed(3)}${d.sigAdj ? "*" : " (ns)"}`;
    }
  }
  const data = heatmapData(z, vars, vars, displayTxt, {
    zmin: -1,
    zmax: 1,
    colorscale: CORR_SCALE,
    customdata: hoverTxt,
    texttemplate: "%{text}",
    textfont: CORR_TFONT,
    hovertemplate: "%{x} \u00d7 %{y}: <b>%{customdata}</b><extra></extra>",
  });
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 600 }}>
        <PlotlyChart
          data={data}
          layout={heatmapLayout(t, { height: Math.max(400, m * 28 + 80) })}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 4,
          fontSize: 10,
          color: t.tx2,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span style={{ color: t.tx3 }}>* BH-adjusted p&lt;0.05</span>
        <span style={{ color: t.tx3 }}>
          n={n} method={method}
        </span>
      </div>
    </div>
  );
}

function CorrelationTable({ results, t }) {
  const { vars, matrix } = results;
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        <thead>
          <tr style={{ background: t.surf2 }}>
            <th
              style={{
                padding: "4px 6px",
                textAlign: "left",
                color: t.tx,
                fontSize: 8,
                textTransform: "uppercase",
              }}
            >
              Variable
            </th>
            {vars.map((v) => (
              <th
                key={v}
                style={{
                  padding: "4px 6px",
                  textAlign: "center",
                  color: t.tx,
                  fontSize: 8,
                  textTransform: "uppercase",
                  maxWidth: 60,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vars.map((v1, i) => (
            <tr key={v1} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td
                style={{
                  padding: "5px 6px",
                  color: t.tx,
                  fontWeight: 600,
                  fontSize: 9,
                }}
              >
                {v1}
              </td>
              {vars.map((v2, j) => {
                const d = matrix[v1]?.[v2];
                if (!d)
                  return (
                    <td
                      key={v2}
                      style={{
                        padding: "5px 6px",
                        textAlign: "center",
                        color: t.tx3,
                      }}
                    >
                      —
                    </td>
                  );
                return (
                  <td
                    key={v2}
                    style={{
                      padding: "5px 6px",
                      textAlign: "center",
                      background: i === j ? t.surf2 : "transparent",
                      color: d.sigAdj ? t.acc : t.tx2,
                      fontWeight: d.sigAdj ? 700 : 400,
                    }}
                  >
                    {i === j ? "—" : `${d.r.toFixed(3)}${d.sigAdj ? "*" : ""}`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: t.tx3, marginTop: 4 }}>
        * BH-adjusted p &lt; 0.05
      </div>
    </div>
  );
}

function PartialCorrelationTable({ results, t }) {
  const partial = results.partial;
  if (!partial)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        No partial correlation results. Add covariates and re-run.
      </div>
    );

  const vars = results.vars;
  const covs = partial.covariates || [];
  return (
    <div>
      <div style={{ fontSize: 10, color: t.tx2, marginBottom: 8 }}>
        Controlling for: {covs.join(", ") || "none"}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <thead>
            <tr style={{ background: t.surf2 }}>
              <th
                style={{
                  padding: "4px 6px",
                  textAlign: "left",
                  color: t.tx,
                  fontSize: 8,
                  textTransform: "uppercase",
                }}
              >
                Variable
              </th>
              {vars.map((v) => (
                <th
                  key={v}
                  style={{
                    padding: "4px 6px",
                    textAlign: "center",
                    color: t.tx,
                    fontSize: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vars.map((v1, i) => (
              <tr key={v1} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td
                  style={{
                    padding: "5px 6px",
                    color: t.tx,
                    fontWeight: 600,
                    fontSize: 9,
                  }}
                >
                  {v1}
                </td>
                {vars.map((v2, j) => {
                  const d = partial[v1]?.[v2];
                  if (!d || i === j)
                    return (
                      <td
                        key={v2}
                        style={{
                          padding: "5px 6px",
                          textAlign: "center",
                          color: t.tx3,
                        }}
                      >
                        —
                      </td>
                    );
                  return (
                    <td
                      key={v2}
                      style={{
                        padding: "5px 6px",
                        textAlign: "center",
                        color: d.p < 0.05 ? t.acc : t.tx2,
                      }}
                    >
                      {d.r.toFixed(3)}
                      {d.p < 0.05 ? "*" : ""}
                    </td>
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

function DescriptiveSummary({ results, t }) {
  const desc = results.descriptive;
  if (!desc) return null;
  const labels = Object.keys(desc);
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Variable", "N", "Mean", "SD", "Min", "Max"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "4px 6px",
                  textAlign: "left",
                  color: t.tx,
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l) => {
            const d = desc[l];
            return (
              <tr key={l} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}
                >
                  {l}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{d.n}</td>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 700 }}
                >
                  {d.mean.toFixed(2)}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {d.sd.toFixed(2)}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {d.min.toFixed(2)}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {d.max.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RegressionView({ results, t }) {
  const reg = results.regression;
  if (!reg)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        No regression configured. Select dependent variable and predictors in
        config.
      </div>
    );
  if (reg.note)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        {reg.note}
      </div>
    );

  const {
    coefficients,
    terms,
    se,
    t: tStats,
    pValues,
    ci95,
    r2,
    r2adj,
    F,
    df1,
    df2,
    pF,
    aic,
    bic,
    vif,
    equation,
    diagnostics,
    influential,
  } = reg;

  const show = (v, d = 4) => (v != null ? Number(v).toFixed(d) : "—");

  return (
    <div style={{ fontSize: 12 }}>
      <div
        style={{
          padding: "8px 10px",
          background: t.surf3,
          borderRadius: 6,
          border: `1px solid ${t.bdr}44`,
          marginBottom: 12,
          fontFamily: "'DM Mono',monospace",
          fontSize: 11,
          color: t.tx,
        }}
      >
        {equation}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {[
          ["R²", show(r2, 4)],
          ["Adj. R²", show(r2adj, 4)],
          [`F(${df1},${df2})`, show(F, 3)],
          ["p (model)", pF != null ? formatP(pF) : "—"],
          ["AIC", show(aic, 1)],
          ["BIC", show(bic, 1)],
          ["σ²", show(reg.sigma2, 4)],
          ["n", reg.n],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              padding: "6px 8px",
              background: t.surf2,
              borderRadius: 6,
              border: `1px solid ${t.bdr}`,
            }}
          >
            <div style={{ fontSize: 9, color: t.tx3 }}>{label}</div>
            <div
              style={{
                fontWeight: 700,
                color: t.tx,
                fontFamily: "'DM Mono',monospace",
                fontSize: 11,
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <thead>
            <tr style={{ background: t.surf2 }}>
              {["Term", "β", "SE", "t", "p", "95% CI", "VIF"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "4px 6px",
                    textAlign: "left",
                    color: t.tx,
                    fontSize: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term, i) => (
              <tr key={term} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}
                >
                  {term}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    fontWeight: 600,
                    color: coefficients[i] > 0 ? "#60a5fa" : "#f472b6",
                  }}
                >
                  {show(coefficients[i])}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {show(se[i])}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {show(tStats[i], 3)}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    color: pValues[i] < 0.05 ? t.ok : t.tx2,
                    fontWeight: pValues[i] < 0.05 ? 700 : 400,
                  }}
                >
                  {formatP(pValues[i])}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2, fontSize: 9 }}>
                  [{show(ci95[i][0], 2)}, {show(ci95[i][1], 2)}]
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    color:
                      i === 0
                        ? t.tx3
                        : vif[i - 1] > 10
                          ? t.err
                          : vif[i - 1] > 5
                            ? t.warn
                            : t.tx,
                  }}
                >
                  {i === 0 ? "—" : vif[i - 1]?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diagnostics && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 180,
              padding: "8px 10px",
              background: t.surf3,
              borderRadius: 6,
              border: `1px solid ${t.bdr}44`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: t.tx3,
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Residual Normality
            </div>
            <div style={{ fontSize: 10 }}>
              W = {diagnostics.normalityResiduals?.W?.toFixed(4)}
            </div>
            <div style={{ fontSize: 10 }}>
              p = {diagnostics.normalityResiduals?.p?.toFixed(4)}
            </div>
            <div
              style={{
                fontSize: 10,
                color:
                  (diagnostics.normalityResiduals?.p || 0) < 0.05
                    ? t.err
                    : t.ok,
              }}
            >
              {(diagnostics.normalityResiduals?.p || 0) >= 0.05
                ? "✓ Normal"
                : "✗ Non-normal"}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 180,
              padding: "8px 10px",
              background: t.surf3,
              borderRadius: 6,
              border: `1px solid ${t.bdr}44`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: t.tx3,
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Heteroscedasticity (BP)
            </div>
            <div style={{ fontSize: 10 }}>
              BP = {diagnostics.heteroscedasticity?.statistic?.toFixed(2)}
            </div>
            <div style={{ fontSize: 10 }}>
              p = {diagnostics.heteroscedasticity?.p?.toFixed(4)}
            </div>
            <div
              style={{
                fontSize: 10,
                color:
                  (diagnostics.heteroscedasticity?.p || 0) >= 0.05
                    ? t.ok
                    : t.err,
              }}
            >
              {(diagnostics.heteroscedasticity?.p || 0) >= 0.05
                ? "✓ Homoscedastic"
                : "✗ Heteroscedastic"}
            </div>
          </div>
        </div>
      )}

      {influential && influential.length > 0 && (
        <div
          style={{
            padding: "8px 10px",
            background: t.warn + "18",
            borderRadius: 6,
            border: `1px solid ${t.warn}44`,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: t.warn,
              marginBottom: 4,
            }}
          >
            ⚠ Influential Cases
          </div>
          <div style={{ fontSize: 9, color: t.tx2 }}>
            {influential.map((d) => `#${d.index}`).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

function LogisticView({ results, t }) {
  const log = results.logistic;
  if (!log)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        No logistic regression configured. Set threshold in config and re-run.
      </div>
    );
  if (log.note)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        {log.note}
      </div>
    );

  const {
    coefficients,
    oddsRatios,
    terms,
    se,
    z,
    pValues,
    ci95,
    pseudoR2,
    aic,
    bic,
    accuracy,
    sensitivity,
    specificity,
    confusionMatrix: cm,
    auc,
  } = log;

  const show = (v, d = 4) => (v != null ? Number(v).toFixed(d) : "—");

  return (
    <div style={{ fontSize: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {[
          ["Pseudo R²", show(pseudoR2, 4)],
          ["AIC", show(aic, 1)],
          ["BIC", show(bic, 1)],
          ["Accuracy", show(accuracy, 3)],
          ["Sensitivity", show(sensitivity, 3)],
          ["Specificity", show(specificity, 3)],
          ["AUC", show(auc, 3)],
          ["n", log.n],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              padding: "6px 8px",
              background: t.surf2,
              borderRadius: 6,
              border: `1px solid ${t.bdr}`,
            }}
          >
            <div style={{ fontSize: 9, color: t.tx3 }}>{label}</div>
            <div
              style={{
                fontWeight: 700,
                color: t.tx,
                fontFamily: "'DM Mono',monospace",
                fontSize: 11,
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      {cm && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 12,
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              background: t.surf3,
              borderRadius: 4,
              border: `1px solid ${t.bdr}44`,
            }}
          >
            <span style={{ color: t.ok }}>TP: {cm.tp}</span>{" "}
            <span style={{ color: t.tx3 }}>|</span>
            <span style={{ color: t.err }}>FP: {cm.fp}</span>
          </div>
          <div
            style={{
              padding: "6px 10px",
              background: t.surf3,
              borderRadius: 4,
              border: `1px solid ${t.bdr}44`,
            }}
          >
            <span style={{ color: t.err }}>FN: {cm.fn}</span>{" "}
            <span style={{ color: t.tx3 }}>|</span>
            <span style={{ color: t.ok }}>TN: {cm.tn}</span>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 10,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <thead>
            <tr style={{ background: t.surf2 }}>
              {["Term", "β", "OR", "SE", "z", "p", "95% CI (OR)"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "4px 6px",
                    textAlign: "left",
                    color: t.tx,
                    fontSize: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term, i) => (
              <tr key={term} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}
                >
                  {term}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    fontWeight: 600,
                    color: coefficients[i] > 0 ? "#60a5fa" : "#f472b6",
                  }}
                >
                  {show(coefficients[i])}
                </td>
                <td
                  style={{ padding: "5px 6px", fontWeight: 700, color: t.tx }}
                >
                  {show(oddsRatios[i], 3)}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {show(se[i])}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {show(z[i], 3)}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    color: pValues[i] < 0.05 ? t.ok : t.tx2,
                    fontWeight: pValues[i] < 0.05 ? 700 : 400,
                  }}
                >
                  {formatP(pValues[i])}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2, fontSize: 9 }}>
                  [{show(ci95[i][0], 2)}, {show(ci95[i][1], 2)}]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
