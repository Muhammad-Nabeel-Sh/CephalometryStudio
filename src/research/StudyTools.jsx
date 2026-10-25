// ═══════════════════════════════════════════════════════════════════════════════
// STUDY TOOLS — data preview (what a study will analyze) + sample-size calculator
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { buildDataMatrix, dataMatrixToCSV } from "./dataPreview.js";
import { nTwoMeans, nPaired, nCorrelation, nICC, nBlandAltman } from "./sampleSize.js";

const fmt = v => (typeof v === "number" && isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2)) : "");

export function DataPreview({ study, sessions, calibration, t, defaultOpen = false }) {
  const matrix = useMemo(() => buildDataMatrix(study, sessions, calibration), [study, sessions, calibration]);
  const [open, setOpen] = useState(defaultOpen);

  const download = () => {
    const blob = new Blob([dataMatrixToCSV(matrix)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(study.name || "study").replace(/[^\w-]+/g, "_")}_data.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: open ? t.surf3 : "transparent", color: t.tx, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {open ? "Hide data" : "Preview data"} ({matrix.rows.length} sessions × {matrix.columns.length} measurements)
        </button>
        <button onClick={download} disabled={!matrix.rows.length} title="Tidy CSV (one row per session) for R / SPSS / Excel"
          style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 11, cursor: matrix.rows.length ? "pointer" : "default", opacity: matrix.rows.length ? 1 : 0.4 }}>
          CSV
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          {[...matrix.warnings, ...(matrix.missingSessions ? [`${matrix.missingSessions} mapped session(s) no longer exist.`] : [])].map((w, i) => (
            <div key={i} style={{ fontSize: 10, color: t.warn, marginBottom: 4 }}>⚠ {w}</div>
          ))}
          {matrix.columns.length === 0 ? (
            <div style={{ fontSize: 11, color: t.tx3 }}>No measurements found. Landmarks alone are not analyzed — apply an analysis or draw angles/distances.</div>
          ) : (
            <div style={{ overflow: "auto", maxHeight: 260, border: `1px solid ${t.bdr}`, borderRadius: 4 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: t.surf2, position: "sticky", top: 0 }}>
                    <th style={{ padding: "4px 6px", textAlign: "left", color: t.tx2 }}>Session</th>
                    {matrix.columns.map(c => (
                      <th key={c.label} style={{ padding: "4px 6px", textAlign: "right", color: t.tx2 }} title={`${c.n} value(s)`}>
                        {c.label}{c.unit && !c.label.includes(`(${c.unit})`) ? <span style={{ color: t.tx3, fontWeight: 400 }}> {c.unit}</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r, i) => (
                    <tr key={`${r.sessionId}-${i}`} style={{ borderTop: `1px solid ${t.bdr}55` }}>
                      <td style={{ padding: "3px 6px", color: t.tx }} title={r.role}>{r.sessionName}{r.role ? <span style={{ color: t.tx3 }}> · {r.role}</span> : null}</td>
                      {matrix.columns.map(c => (
                        <td key={c.label} style={{ padding: "3px 6px", textAlign: "right", color: r.values[c.label] === undefined ? t.err : t.tx2 }}>
                          {r.values[c.label] === undefined ? "—" : fmt(r.values[c.label])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DESIGNS = {
  twoMeans: { label: "Two independent groups (t-test)", param: "Cohen's d", def: 0.5, run: (e, a, p) => nTwoMeans(e, a, p), unit: "per group", hint: "d = mean difference ÷ SD. 0.2 small, 0.5 medium, 0.8 large." },
  paired: { label: "Paired / before–after (paired t-test)", param: "Cohen's dz", def: 0.5, run: (e, a, p) => nPaired(e, a, p), unit: "subjects", hint: "dz = mean change ÷ SD of the changes." },
  correlation: { label: "Correlation (Pearson r)", param: "Expected r", def: 0.3, run: (e, a, p) => nCorrelation(e, a, p), unit: "subjects", hint: "Smallest correlation worth detecting." },
  icc: { label: "Reliability (ICC)", param: "Expected ICC", def: 0.85, extra: true, run: (e, a, p, x) => nICC(e, x.rho0, x.k, a, p), unit: "subjects", hint: "Walter et al. (1998): tests ICC > the minimum acceptable value (one-sided α)." },
  ba: { label: "Agreement (Bland-Altman)", param: "LoA precision (± SD)", def: 0.5, run: e => nBlandAltman(e), unit: "subjects", hint: "95% CI half-width of each limit of agreement, in SDs of the differences." },
};

export function SampleSizeCalculator({ t }) {
  const [design, setDesign] = useState("twoMeans");
  const [effect, setEffect] = useState(DESIGNS.twoMeans.def);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [rho0, setRho0] = useState(0.7);
  const [k, setK] = useState(2);
  const d = DESIGNS[design];
  const n = d.run(Number(effect), Number(alpha), Number(power), { rho0: Number(rho0), k: Number(k) });

  const input = (value, set, step, min, max) => (
    <input type="number" value={value} step={step} min={min} max={max} onChange={e => set(e.target.value)}
      style={{ width: 70, padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 11 }} />
  );
  const row = (label, el) => (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, color: t.tx2, marginBottom: 6 }}>{label}{el}</label>
  );

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 8 }}>Sample size</div>
      <select value={design} onChange={e => { setDesign(e.target.value); setEffect(DESIGNS[e.target.value].def); }}
        style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 11, marginBottom: 8 }}>
        {Object.entries(DESIGNS).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}
      </select>
      {row(d.param, input(effect, setEffect, 0.05, 0.01, 5))}
      {d.extra && row("Minimum acceptable ICC (H₀)", input(rho0, setRho0, 0.05, 0, 0.99))}
      {d.extra && row("Raters / occasions (k)", input(k, setK, 1, 2, 10))}
      {design !== "ba" && row(design === "icc" ? "α (one-sided)" : "α (two-sided)", input(alpha, setAlpha, 0.01, 0.001, 0.2))}
      {design !== "ba" && row("Power (1 − β)", input(power, setPower, 0.05, 0.5, 0.99))}
      <div style={{ padding: "8px 10px", borderRadius: 6, background: t.acc + "14", border: `1px solid ${t.acc}44`, marginTop: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: t.acc, fontFamily: "'DM Mono',monospace" }}>{n ? `n = ${n}` : "—"} <span style={{ fontSize: 11, fontWeight: 500, color: t.tx2 }}>{n ? d.unit : "check the inputs"}</span></div>
        <div style={{ fontSize: 10, color: t.tx3, marginTop: 4, lineHeight: 1.5 }}>{d.hint} Add 10–20 % for dropouts and unusable films.</div>
      </div>
    </div>
  );
}
