import { useState, useMemo } from "react";
import PlotlyChart from "./PlotlyChart.jsx";
import { computeClinicalThreshold } from "./diagnostic.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TAB BAR (shared with other panels)
// ═══════════════════════════════════════════════════════════════════════════════
function TabBar({ tabs, active, onChange, t }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: `1px solid ${t.bdr}44`,
        marginBottom: 10,
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "5px 10px",
            fontSize: 9,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            border: "none",
            borderBottom:
              active === tab.id
                ? `2px solid ${t.acc}`
                : "2px solid transparent",
            background: "transparent",
            color: active === tab.id ? t.acc : t.tx,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
export function DiagnosticConfig({ study, sessions, onUpdateStudy, t }) {
  const c = study.config;

  const allLabels = useMemo(() => {
    const labels = new Set();
    for (const s of sessions || []) {
      for (const m of s.markups || []) {
        if (m.label && m.type !== "ruler" && m.type !== "silhouette")
          labels.add(m.label);
      }
    }
    return [...labels].sort();
  }, [sessions]);

  const togglePredictor = (label) => {
    const cur = c.predictorLabels || [];
    const next = cur.includes(label)
      ? cur.filter((l) => l !== label)
      : [...cur, label];
    onUpdateStudy({ ...study, config: { ...c, predictorLabels: next } });
  };

  const setHigherIsPositive = (label, val) => {
    onUpdateStudy({
      ...study,
      config: {
        ...c,
        higherIsPositive: { ...(c.higherIsPositive || {}), [label]: val },
      },
    });
  };

  return (
    <div style={{ fontSize: 11 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: t.tx3,
          textTransform: "uppercase",
          letterSpacing: 0.3,
          marginBottom: 6,
        }}
      >
        Gold Standard
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>
          Label (binary classifier)
        </div>
        <select
          value={c.goldStandardLabel || ""}
          onChange={(e) =>
            onUpdateStudy({
              ...study,
              config: { ...c, goldStandardLabel: e.target.value },
            })
          }
          style={{
            width: "94%",
            padding: "4px 6px",
            borderRadius: 4,
            border: `1px solid ${t.bdr}`,
            background: t.surf,
            color: t.tx,
            fontSize: 11,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          <option value="">Select gold standard</option>
          {allLabels
            .filter((l) => !(c.predictorLabels || []).includes(l))
            .map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
        </select>
      </div>
      {c.goldStandardLabel && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>
            Positive class value
          </div>
          <input
            value={c.goldStandardPositive ?? ""}
            onChange={(e) =>
              onUpdateStudy({
                ...study,
                config: { ...c, goldStandardPositive: e.target.value },
              })
            }
            placeholder="e.g. 4 (values ≥ this = positive class)"
            style={{
              width: "90%",
              padding: "4px 6px",
              borderRadius: 4,
              border: `1px solid ${t.bdr}`,
              background: t.surf,
              color: t.tx,
              fontSize: 11,
              fontFamily: "'DM Mono',monospace",
            }}
          />
        </div>
      )}

      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: t.tx3,
          textTransform: "uppercase",
          letterSpacing: 0.3,
          marginBottom: 6,
          marginTop: 12,
        }}
      >
        Predictors
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          marginBottom: 8,
        }}
      >
        {allLabels
          .filter((l) => l !== c.goldStandardLabel)
          .map((l) => {
            const selected = (c.predictorLabels || []).includes(l);
            const hip = c.higherIsPositive?.[l] ?? true;
            return (
              <div
                key={l}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 6px",
                  borderRadius: 4,
                  background: selected ? t.acc + "12" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => togglePredictor(l)}
                  style={{ accentColor: t.acc, cursor: "pointer", margin: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    color: selected ? t.acc : t.tx2,
                  }}
                >
                  {l}
                </span>
                {selected && (
                  <label
                    style={{
                      fontSize: 9,
                      color: t.tx3,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hip}
                      onChange={(e) => setHigherIsPositive(l, e.target.checked)}
                      style={{
                        accentColor: t.acc,
                        cursor: "pointer",
                        margin: 0,
                      }}
                    />
                    higher = positive
                  </label>
                )}
              </div>
            );
          })}
      </div>

      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: t.tx3,
          textTransform: "uppercase",
          letterSpacing: 0.3,
          marginBottom: 6,
          marginTop: 8,
        }}
      >
        Settings
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>Alpha</div>
          <select
            value={c.alpha ?? 0.05}
            onChange={(e) =>
              onUpdateStudy({
                ...study,
                config: { ...c, alpha: Number(e.target.value) },
              })
            }
            style={{
              padding: "3px 4px",
              borderRadius: 4,
              border: `1px solid ${t.bdr}`,
              background: t.surf,
              color: t.tx,
              fontSize: 10,
            }}
          >
            <option value={0.05}>0.05</option>
            <option value={0.01}>0.01</option>
            <option value={0.001}>0.001</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>CV Method</div>
          <select
            value={c.cvMethod || "loocv"}
            onChange={(e) =>
              onUpdateStudy({
                ...study,
                config: { ...c, cvMethod: e.target.value },
              })
            }
            style={{
              padding: "3px 4px",
              borderRadius: 4,
              border: `1px solid ${t.bdr}`,
              background: t.surf,
              color: t.tx,
              fontSize: 10,
            }}
          >
            <option value="loocv">LOOCV</option>
            <option value="kfold">K-Fold</option>
          </select>
        </div>
        {c.cvMethod === "kfold" && (
          <div>
            <div style={{ fontSize: 9, color: t.tx3 }}>K</div>
            <input
              type="number"
              min={3}
              max={20}
              value={c.cvK || 10}
              onChange={(e) =>
                onUpdateStudy({
                  ...study,
                  config: {
                    ...c,
                    cvK: Math.max(3, Math.min(20, Number(e.target.value))),
                  },
                })
              }
              style={{
                width: 40,
                padding: "3px 4px",
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
export function DiagnosticResults({ results, t }) {
  const [tab, setTab] = useState("roc");
  const [selectedPred, setSelectedPred] = useState(null);
  const [fpCost, setFpCost] = useState(1);
  const [fnCost, setFnCost] = useState(1);
  const [highlightPt, setHighlightPt] = useState(null);

  if (!results || results.note) {
    return (
      <div
        style={{ fontSize: 11, color: t.tx2, padding: 16, textAlign: "center" }}
      >
        {results?.note || "No results available. Run the analysis first."}
      </div>
    );
  }

  const { predictors, predictorNames, composite, crossVal } = results;
  const currentPred =
    selectedPred && predictors[selectedPred] ? selectedPred : predictorNames[0];

  const tabs = [
    { id: "roc", label: "ROC Curve" },
    { id: "metrics", label: "Metrics" },
    { id: "compare", label: "Compare" },
    { id: "calibration", label: "Calibration" },
    { id: "composite", label: "Composite" },
    { id: "cv", label: "Validation" },
    { id: "report", label: "Report" },
  ];

  return (
    <div>
      {/* Predictor selector */}
      <div
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}
      >
        {predictorNames.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedPred(name)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              border: `1px solid ${currentPred === name ? t.acc : t.bdr}`,
              background: currentPred === name ? t.acc + "22" : "transparent",
              color: currentPred === name ? t.acc : t.tx2,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {name}
          </button>
        ))}
        {predictorNames.length > 1 && (
          <button
            onClick={() => setSelectedPred(null)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              border: `1px solid ${currentPred == null ? t.warn : t.bdr}`,
              background: currentPred == null ? t.warn + "22" : "transparent",
              color: currentPred == null ? t.warn : t.tx2,
            }}
          >
            All
          </button>
        )}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} t={t} />

      <div style={{ overflow: "auto" }}>
        {tab === "roc" && (
          <ROCCurveView
            result={
              currentPred
                ? predictors[currentPred]
                : predictors[predictorNames[0]]
            }
            t={t}
            fpCost={fpCost}
            fnCost={fnCost}
            setFpCost={setFpCost}
            setFnCost={setFnCost}
            highlightPt={highlightPt}
            setHighlightPt={setHighlightPt}
          />
        )}
        {tab === "metrics" && (
          <MetricsTableView
            result={
              currentPred
                ? predictors[currentPred]
                : predictors[predictorNames[0]]
            }
            highlightPt={highlightPt}
            t={t}
          />
        )}
        {tab === "compare" && <CompareROCView results={results} t={t} />}
        {tab === "calibration" && currentPred && (
          <CalibrationView result={predictors[currentPred]} t={t} />
        )}
        {tab === "composite" && <CompositeView composite={composite} t={t} />}
        {tab === "cv" && <CrossValidationView crossVal={crossVal} t={t} />}
        {tab === "report" && <DiagnosticReport results={results} t={t} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROC CURVE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ROCCurveView({
  result,
  t,
  fpCost,
  fnCost,
  setFpCost,
  setFnCost,
  highlightPt,
  setHighlightPt,
}) {
  if (!result)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Select a predictor.
      </div>
    );

  const { roc, auc, optimalThresholds: opts } = result;
  if (!roc || !auc)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Insufficient data for ROC.
      </div>
    );

  const W = 380,
    H = 380,
    pad = 50;
  const sx = (fpr) => pad + fpr * (W - 2 * pad);
  const sy = (tpr) => H - pad - tpr * (H - 2 * pad);
  const optYouden = opts.byYouden;
  const optClinical = computeClinicalThreshold(
    result.roc.thresholdMetrics,
    fpCost,
    fnCost,
  );
  const rocPath = roc.points
    .map((pt, i) => `${i === 0 ? "M" : "L"}${sx(pt.fpr)},${sy(pt.tpr)}`)
    .join(" ");
  const fillPath = rocPath + ` L${sx(1)},${sy(0)} L${sx(0)},${sy(0)} Z`;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <svg
        width={W}
        height={H}
        style={{
          border: `1px solid ${t.bdr}`,
          borderRadius: 8,
          background: t.surf2,
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1={sx(v)}
              y1={pad}
              x2={sx(v)}
              y2={H - pad}
              stroke={t.bdr}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <line
              x1={pad}
              y1={sy(v)}
              x2={W - pad}
              y2={sy(v)}
              stroke={t.bdr}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <text
              x={sx(v)}
              y={H - pad + 14}
              fill={t.tx2}
              fontSize={9}
              textAnchor="middle"
            >
              {v.toFixed(2)}
            </text>
            <text
              x={pad - 8}
              y={sy(v) + 4}
              fill={t.tx2}
              fontSize={9}
              textAnchor="end"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(1)}
          stroke={t.tx3}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        <path d={fillPath} fill={t.acc} fillOpacity={0.1} />
        <path
          d={rocPath}
          fill="none"
          stroke={t.acc}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <circle
          cx={sx(optYouden.fpr)}
          cy={sy(optYouden.tpr)}
          r={6}
          fill={t.ok}
          stroke="#fff"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHighlightPt(optYouden)}
          onMouseLeave={() => setHighlightPt(null)}
        />
        <circle
          cx={sx(optClinical.fpr)}
          cy={sy(optClinical.tpr)}
          r={6}
          fill={t.warn}
          stroke="#fff"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHighlightPt(optClinical)}
          onMouseLeave={() => setHighlightPt(null)}
        />
        {roc.thresholdMetrics.map((pt, i) => (
          <circle
            key={i}
            cx={sx(pt.fpr)}
            cy={sy(pt.tpr)}
            r={highlightPt === pt ? 5 : 3}
            fill={highlightPt === pt ? t.acc : "transparent"}
            stroke={highlightPt === pt ? t.acc : "transparent"}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHighlightPt(pt)}
            onMouseLeave={() => setHighlightPt(null)}
          />
        ))}
        <text
          x={W / 2}
          y={H - 6}
          fill={t.tx2}
          fontSize={11}
          textAnchor="middle"
        >
          1 &minus; Specificity (FPR)
        </text>
        <text
          x={14}
          y={H / 2}
          fill={t.tx2}
          fontSize={11}
          textAnchor="middle"
          transform={`rotate(-90, 14, ${H / 2})`}
        >
          Sensitivity (TPR)
        </text>
        <rect
          x={W - 140}
          y={pad + 8}
          width={86}
          height={26}
          rx={5}
          fill={t.acc + "22"}
          stroke={t.acc}
          strokeWidth={0.5}
        />
        <text
          x={W - 97}
          y={pad + 25}
          fill={t.acc}
          fontSize={12}
          textAnchor="middle"
          fontWeight={700}
        >
          AUC = {auc.auc.toFixed(3)}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 200 }}>
        <AUCSummaryCard auc={auc} t={t} />
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.tx,
              marginBottom: 4,
            }}
          >
            Optimal Thresholds
          </div>
          <ThresholdCard
            label={`Youden's J (${optYouden.youdenJ.toFixed(3)})`}
            pt={optYouden}
            color={t.ok}
            t={t}
          />
          <ThresholdCard
            label={`Clinical utility`}
            pt={optClinical}
            color={t.warn}
            t={t}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: t.tx2, marginBottom: 4 }}>
            Clinical cost weighting
          </div>
          <Slider
            label="FP cost"
            value={fpCost}
            min={0.1}
            max={10}
            step={0.1}
            onChange={setFpCost}
            t={t}
          />
          <Slider
            label="FN cost"
            value={fnCost}
            min={0.1}
            max={10}
            step={0.1}
            onChange={setFnCost}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

function AUCSummaryCard({ auc, t }) {
  const fmt = (v) => (v != null ? v.toFixed(4) : "—");
  return (
    <div
      style={{
        padding: "8px 10px",
        background: t.surf3,
        borderRadius: 6,
        border: `1px solid ${t.bdr}44`,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <span style={{ fontSize: 9, color: t.tx3 }}>AUC</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.acc }}>
            {fmt(auc.auc)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 9, color: t.tx3 }}>SE</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.tx2 }}>
            {fmt(auc.seAUC)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 9, color: t.tx3 }}>95% CI</span>
          <div style={{ fontSize: 11, color: t.tx }}>
            [{fmt(auc.ci95?.[0])}, {fmt(auc.ci95?.[1])}]
          </div>
        </div>
        <div>
          <span style={{ fontSize: 9, color: t.tx3 }}>p (vs. 0.5)</span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: (auc.p || 1) < 0.05 ? t.ok : t.tx2,
            }}
          >
            {fmtP(auc.p)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThresholdCard({ label, pt, color, t }) {
  if (!pt) return null;
  return (
    <div
      style={{
        padding: "6px 8px",
        marginBottom: 4,
        background: t.surf3,
        borderRadius: 4,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 8, color: t.tx3, marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 9 }}>
        <span style={{ color }}>Thr={pt.threshold?.toFixed(2) || "—"}</span>
        <span style={{ color: t.tx2 }}>Se={pt.sensitivity?.toFixed(3)}</span>
        <span style={{ color: t.tx2 }}>Sp={pt.specificity?.toFixed(3)}</span>
        <span style={{ color: t.tx2 }}>Acc={pt.accuracy?.toFixed(3)}</span>
        <span style={{ color: t.tx2 }}>PPV={pt.ppv?.toFixed(3)}</span>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, t }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
    >
      <span style={{ fontSize: 9, color: t.tx2, minWidth: 50 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: t.acc, cursor: "pointer", height: 4 }}
      />
      <span
        style={{
          fontSize: 9,
          color: t.tx,
          minWidth: 30,
          textAlign: "right",
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
function MetricsTableView({ result, highlightPt, t }) {
  if (!result)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        No data.
      </div>
    );
  const { roc, auc, optimalYouden } = result;
  if (!roc) return null;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {[
          ["AUC", auc?.auc?.toFixed(4) || "—"],
          ["SE", auc?.seAUC?.toFixed(4) || "—"],
          [
            "95% CI",
            auc?.ci95
              ? `[${auc.ci95[0].toFixed(3)}, ${auc.ci95[1].toFixed(3)}]`
              : "—",
          ],
          ["p (H₀: AUC=0.5)", fmtP(auc?.p)],
          ["Cases", roc.n],
          ["Prevalence", `${((roc.nP / roc.n) * 100).toFixed(1)}%`],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              padding: "4px 6px",
              background: t.surf2,
              borderRadius: 4,
              border: `1px solid ${t.bdr}`,
            }}
          >
            <div style={{ fontSize: 8, color: t.tx3 }}>{label}</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: t.tx,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 9,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        <thead>
          <tr style={{ background: t.surf2 }}>
            {[
              "Threshold",
              "Se",
              "Sp",
              "PPV",
              "NPV",
              "Acc",
              "F1",
              "LR+",
              "LR−",
              "Youden J",
              "DOR",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "3px 4px",
                  textAlign: "right",
                  color: t.tx,
                  fontSize: 7,
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
          {roc.thresholdMetrics.map((pt, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${t.bdr}22`,
                background: highlightPt === pt ? t.acc + "22" : "transparent",
                cursor: "pointer",
              }}
            >
              <td
                style={{
                  padding: "2px 4px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: t.tx,
                }}
              >
                {pt.threshold?.toFixed(2) || "—"}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.sensitivity.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.specificity.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.ppv.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.npv.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.accuracy.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.f1.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.lrPos.toFixed(2)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.lrNeg.toFixed(2)}
              </td>
              <td
                style={{
                  padding: "2px 4px",
                  textAlign: "right",
                  color: pt.youdenJ === optimalYouden?.youdenJ ? t.ok : t.tx2,
                  fontWeight: pt.youdenJ === optimalYouden?.youdenJ ? 700 : 400,
                }}
              >
                {pt.youdenJ.toFixed(3)}
              </td>
              <td
                style={{ padding: "2px 4px", textAlign: "right", color: t.tx2 }}
              >
                {pt.dor.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE ROCS
// ═══════════════════════════════════════════════════════════════════════════════
function CompareROCView({ results, t }) {
  const { comparisons, predictors } = results;
  if (!comparisons?.length)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Need at least 2 predictors for comparison.
      </div>
    );

  return (
    <div>
      {/* Side-by-side mini ROC curves */}
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}
      >
        {Object.entries(predictors).map(([name, p]) => {
          if (!p.roc) return null;
          const W = 180,
            H = 180,
            pad = 25;
          const sx = (fpr) => pad + fpr * (W - 2 * pad);
          const sy = (tpr) => H - pad - tpr * (H - 2 * pad);
          const rocPath = p.roc.points
            .map((pt, i) => `${i === 0 ? "M" : "L"}${sx(pt.fpr)},${sy(pt.tpr)}`)
            .join(" ");
          return (
            <div key={name} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 8,
                  color: t.tx2,
                  marginBottom: 2,
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                {name}
              </div>
              <svg
                width={W}
                height={H}
                style={{
                  border: `1px solid ${t.bdr}`,
                  borderRadius: 4,
                  background: t.surf,
                }}
              >
                <line
                  x1={sx(0)}
                  y1={sy(0)}
                  x2={sx(1)}
                  y2={sy(1)}
                  stroke={t.tx3}
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
                <path
                  d={rocPath}
                  fill="none"
                  stroke={t.acc}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <text
                  x={W - pad}
                  y={pad + 8}
                  fill={t.acc}
                  fontSize={7}
                  textAnchor="end"
                  fontWeight={700}
                >
                  AUC={p.auc.auc.toFixed(3)}
                </text>
              </svg>
            </div>
          );
        })}
      </div>

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
            {[
              "Comparison",
              "AUC₁",
              "AUC₂",
              "ΔAUC",
              "SE",
              "z",
              "p",
              "Adj. p",
              "95% CI",
            ].map((h) => (
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
          {comparisons.map((c, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "4px 6px", color: t.tx, fontWeight: 600 }}>
                {c.A} vs {c.B}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {c.aucA.toFixed(4)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {c.aucB.toFixed(4)}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  color: c.diff > 0 ? t.ok : t.err,
                  fontWeight: 700,
                }}
              >
                {c.diff > 0 ? "+" : ""}
                {c.diff.toFixed(4)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {c.se.toFixed(4)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {c.z.toFixed(3)}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  color: c.significant ? t.ok : t.tx2,
                  fontWeight: c.significant ? 700 : 400,
                }}
              >
                {fmtP(c.p)}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  color: c.sigAdj ? t.ok : t.tx2,
                  fontWeight: c.sigAdj ? 700 : 400,
                }}
              >
                {fmtP(c.pAdj)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2, fontSize: 9 }}>
                [{c.ci95[0].toFixed(3)}, {c.ci95[1].toFixed(3)}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALIBRATION VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function CalibrationView({ result, t }) {
  if (!result?.roc)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        No calibration data.
      </div>
    );
  const cal = result.calibration;
  if (!cal?.groups?.length)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Calibration data not available for individual predictors. Use Composite
        Index tab for calibration.
      </div>
    );

  const groups = cal.groups.filter((g) => g.n > 0);
  const scData = [
    {
      type: "scatter",
      mode: "markers",
      x: groups.map((g) => g.midpoint),
      y: groups.map((g) => g.obsProp),
      error_y: {
        type: "data",
        symmetric: false,
        thickness: 1.5,
        width: 6,
        array: groups.map(
          (g) => 1.96 * Math.sqrt((g.obsProp * (1 - g.obsProp)) / g.n),
        ),
        arrayminus: groups.map(
          (g) => 1.96 * Math.sqrt((g.obsProp * (1 - g.obsProp)) / g.n),
        ),
      },
      marker: { color: t.acc, size: 8, line: { color: "#fff", width: 1 } },
      hovertemplate:
        "Predicted: %{x:.3f}<br>Observed: %{y:.3f}<br>n=%{customdata}<extra></extra>",
      customdata: groups.map((g) => g.n),
      showlegend: false,
    },
  ];
  const idealLine = {
    type: "scatter",
    mode: "lines",
    x: [0, 1],
    y: [0, 1],
    line: { color: t.tx3, width: 1, dash: "dash" },
    showlegend: false,
    hoverinfo: "skip",
  };
  const scLayout = {
    paper_bgcolor: t.surf2,
    plot_bgcolor: t.surf2,
    font: { color: t.tx2, family: "'DM Sans','DM Mono',monospace", size: 11 },
    margin: { l: 50, r: 20, t: 10, b: 50 },
    xaxis: {
      title: { text: "Predicted probability", font: { size: 12 } },
      range: [0, 1],
      gridcolor: t.surf3,
      zeroline: false,
    },
    yaxis: {
      title: { text: "Observed proportion", font: { size: 12 } },
      range: [0, 1],
      gridcolor: t.surf3,
      zeroline: false,
    },
    width: 400,
    height: 350,
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <PlotlyChart
        data={[idealLine, ...scData]}
        layout={scLayout}
        style={{ width: 400, height: 350, minHeight: 0 }}
      />

      <div style={{ flex: 1 }}>
        <div
          style={{
            padding: "8px 10px",
            background: t.surf3,
            borderRadius: 6,
            border: `1px solid ${t.bdr}44`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: t.tx,
              marginBottom: 6,
            }}
          >
            Calibration Summary
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              fontSize: 10,
            }}
          >
            <div>
              <span style={{ color: t.tx3 }}>H-L &chi;² = </span>
              <span style={{ color: t.tx, fontWeight: 700 }}>
                {cal.hlStat.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: t.tx3 }}>p = </span>
              <span
                style={{
                  color: cal.wellCalibrated ? t.ok : t.err,
                  fontWeight: 700,
                }}
              >
                {fmtP(cal.hlP)}
              </span>
            </div>
            <div>
              <span style={{ color: t.tx3 }}>ICI = </span>
              <span style={{ color: t.tx }}>{cal.ici.toFixed(4)}</span>
            </div>
            <div>
              <span style={{ color: t.tx3 }}>Brier = </span>
              <span style={{ color: t.tx }}>{cal.brier.toFixed(4)}</span>
            </div>
            <div>
              <span style={{ color: t.tx3 }}>Brier skill = </span>
              <span style={{ color: t.tx }}>{cal.brierSkill.toFixed(4)}</span>
            </div>
            <div>
              <span style={{ color: cal.wellCalibrated ? t.ok : t.err }}>
                {cal.wellCalibrated
                  ? "✓ Well-calibrated"
                  : "✗ Poor calibration"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE INDEX
// ═══════════════════════════════════════════════════════════════════════════════
function CompositeView({ composite, t }) {
  if (!composite)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Need at least 2 predictors and 5 cases to build composite index.
      </div>
    );
  const predNames =
    composite.beta.length > 1
      ? [
          `Intercept`,
          ...Array(composite.beta.length - 1)
            .fill(0)
            .map((_, i) => `Predictor ${i + 1}`),
        ]
      : ["Intercept"];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {[
          ["AUC", composite.auc?.auc?.toFixed(4) || "—"],
          [
            "95% CI",
            composite.auc?.ci95
              ? `[${composite.auc.ci95[0].toFixed(3)}, ${composite.auc.ci95[1].toFixed(3)}]`
              : "—",
          ],
          ["Nagelkerke R²", composite.r2Nag?.toFixed(4) || "—"],
          ["AIC", composite.aic?.toFixed(1) || "—"],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              padding: "4px 6px",
              background: t.surf2,
              borderRadius: 4,
              border: `1px solid ${t.bdr}`,
            }}
          >
            <div style={{ fontSize: 8, color: t.tx3 }}>{label}</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: t.tx,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
          marginBottom: 10,
        }}
      >
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Term", "β", "SE", "z", "p", "OR", "OR 95% CI"].map((h) => (
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
          {composite.beta.map((b, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
              <td style={{ padding: "4px 6px", color: t.tx, fontWeight: 600 }}>
                {predNames[i]}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {b.toFixed(4)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {composite.se[i].toFixed(4)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {composite.z[i].toFixed(3)}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  color: (composite.pVal[i] || 1) < 0.05 ? t.ok : t.tx2,
                  fontWeight: (composite.pVal[i] || 1) < 0.05 ? 700 : 400,
                }}
              >
                {fmtP(composite.pVal[i])}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2 }}>
                {(composite.OR[i] || 0).toFixed(3)}
              </td>
              <td style={{ padding: "4px 6px", color: t.tx2, fontSize: 9 }}>
                [{(composite.OR_CI[i]?.[0] || 0).toFixed(2)},{" "}
                {(composite.OR_CI[i]?.[1] || 0).toFixed(2)}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-VALIDATION VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function CrossValidationView({ crossVal, t }) {
  if (!crossVal)
    return (
      <div
        style={{ fontSize: 11, color: t.tx3, padding: 12, textAlign: "center" }}
      >
        Cross-validation requires 5+ cases with 2+ predictors.
      </div>
    );

  return (
    <div
      style={{
        padding: "8px 10px",
        background: t.surf3,
        borderRadius: 6,
        border: `1px solid ${t.bdr}44`,
      }}
    >
      <div
        style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 8 }}
      >
        Cross-Validation Results
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>Method</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>
            {crossVal.method === "loocv" ? "LOOCV" : `K-Fold (k=${crossVal.k})`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>Apparent AUC</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx2 }}>
            {crossVal.apparentAUC?.toFixed(4) || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>CV AUC</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.acc }}>
            {crossVal.cvAUC?.auc?.toFixed(4) || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>Optimism</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: crossVal.optimism > 0.05 ? t.warn : t.tx2,
            }}
          >
            {crossVal.optimism?.toFixed(4) || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>CV AUC 95% CI</div>
          <div style={{ fontSize: 10, color: t.tx }}>
            {crossVal.cvAUC?.ci95
              ? `[${crossVal.cvAUC.ci95[0].toFixed(3)}, ${crossVal.cvAUC.ci95[1].toFixed(3)}]`
              : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.tx3 }}>Folds</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx2 }}>
            {crossVal.nFolds || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════════
function DiagnosticReport({ results, t }) {
  const {
    predictors,
    predictorNames,
    comparisons,
    composite,
    crossVal,
    n,
    nP,
    nN,
    alpha,
  } = results;

  return (
    <div style={{ fontSize: 10, maxWidth: 600 }}>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: t.tx,
            marginBottom: 4,
          }}
        >
          Diagnostic Accuracy Report
        </div>
        <div style={{ color: t.tx2, lineHeight: 1.6 }}>
          Analyzed <b>{predictorNames.length}</b> predictor
          {predictorNames.length > 1 ? "s" : ""} across <b>{n}</b> cases ({nP}{" "}
          positive, {nN} negative). Alpha = {alpha}.
        </div>
      </div>

      {predictorNames.map((name) => {
        const p = predictors[name];
        if (!p?.auc) return null;
        return (
          <div
            key={name}
            style={{
              padding: "6px 8px",
              background: t.surf2,
              borderRadius: 4,
              border: `1px solid ${t.bdr}44`,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: t.tx,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {name}
            </div>
            <div style={{ color: t.tx2, marginTop: 2 }}>
              AUC = {p.auc.auc.toFixed(3)} (95% CI: [{p.auc.ci95[0].toFixed(3)},{" "}
              {p.auc.ci95[1].toFixed(3)}]), p = {fmtP(p.auc.p)}
              &nbsp;|&nbsp; Optimal threshold (Youden):{" "}
              {p.optimalYouden?.threshold?.toFixed(2) || "—"}
            </div>
            <div style={{ color: t.tx3, marginTop: 1, fontSize: 9 }}>
              Se = {p.optimalYouden?.sensitivity?.toFixed(3)}, Sp ={" "}
              {p.optimalYouden?.specificity?.toFixed(3)}, PPV ={" "}
              {p.optimalYouden?.ppv?.toFixed(3)}, NPV ={" "}
              {p.optimalYouden?.npv?.toFixed(3)}
            </div>
          </div>
        );
      })}

      {comparisons?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: t.tx, marginBottom: 4 }}>
            ROC Comparisons
          </div>
          {comparisons.map((c, i) => (
            <div key={i} style={{ color: t.tx2, fontSize: 9, marginBottom: 2 }}>
              {c.A} vs {c.B}: &Delta;AUC = {c.diff > 0 ? "+" : ""}
              {c.diff.toFixed(3)}, z = {c.z.toFixed(2)}, p = {fmtP(c.p)}{" "}
              {c.significant ? "*" : ""}
            </div>
          ))}
        </div>
      )}

      {composite && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: t.tx, marginBottom: 4 }}>
            Composite Index
          </div>
          <div style={{ color: t.tx2 }}>
            AUC = {composite.auc?.auc?.toFixed(3) || "—"}, Nagelkerke R² ={" "}
            {composite.r2Nag?.toFixed(4) || "—"}
            {crossVal && (
              <> | CV AUC = {crossVal.cvAUC?.auc?.toFixed(3) || "—"}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function fmtP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(4);
  return p.toFixed(3);
}
