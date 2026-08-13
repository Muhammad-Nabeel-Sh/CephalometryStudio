import { useState } from "react";
import { mean } from "../lib/utils.js";
import { InfoBox } from "../ui/ui.jsx";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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

// ─── Config Panel ──────────────────────────────────────────────────────────
export function LongitudinalConfig({
  study,
  sessions,
  onUpdateStudy,
  t,
  project,
}) {
  const config = study.config;
  const timepoints = config.timepoints || [];
  const subjects = config.subjects || [];
  const labelIds = config.labelIds || [];

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const addTimepoint = () => {
    const id = uid();
    // Also add empty record slot in each subject
    const updatedSubjects = subjects.map((s) => ({
      ...s,
      records: { ...(s.records || {}), [id]: null },
    }));
    update({
      timepoints: [
        ...timepoints,
        { id, label: `T${timepoints.length}`, targetAge: null, window: 90 },
      ],
      subjects: updatedSubjects,
    });
  };

  const removeTimepoint = (id) => {
    if (timepoints.length <= 2) return;
    update({
      timepoints: timepoints.filter((tp) => tp.id !== id),
      subjects: subjects.map((s) => {
        const r = { ...(s.records || {}) };
        delete r[id];
        return { ...s, records: r };
      }),
    });
  };

  const renameTimepoint = (id, label) => {
    update({
      timepoints: timepoints.map((tp) =>
        tp.id === id ? { ...tp, label } : tp,
      ),
    });
  };

  const addSubject = () => {
    const id = uid();
    const records = {};
    for (const tp of timepoints) records[tp.id] = null;
    update({
      subjects: [
        ...subjects,
        { id, label: `Subject ${subjects.length + 1}`, records },
      ],
    });
  };

  const removeSubject = (id) => {
    if (subjects.length <= 3) return;
    update({ subjects: subjects.filter((s) => s.id !== id) });
  };

  const renameSubject = (id, label) => {
    update({
      subjects: subjects.map((s) => (s.id === id ? { ...s, label } : s)),
    });
  };

  const setRecord = (subjectId, tpId, sessionId) => {
    update({
      subjects: subjects.map((s) => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          records: { ...(s.records || {}), [tpId]: sessionId || null },
        };
      }),
    });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId)
      ? labelIds.filter((id) => id !== labelId)
      : [...labelIds, labelId];
    update({ labelIds: next });
  };

  const totalAssigned = subjects.reduce(
    (sum, s) => sum + Object.values(s.records || {}).filter(Boolean).length,
    0,
  );

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
        Each <b>subject</b> is measured at multiple <b>timepoints</b>. Define
        timepoints and subjects, then assign each subject's session to each
        timepoint. Use <b>"From Managed"</b> to auto-populate from managed
        timepoints and subjects, or <b>"From Sessions"</b>
        from session metadata.
      </InfoBox>

      {/* Model type */}
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
          Model
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["rm_anova", "mixed_model"].map((m) => (
            <button
              key={m}
              onClick={() => update({ modelType: m })}
              style={{
                flex: 1,
                padding: "5px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${config.modelType === m ? t.acc : t.bdr}`,
                background:
                  config.modelType === m ? t.acc + "22" : "transparent",
                color: config.modelType === m ? t.acc : t.tx2,
              }}
            >
              {m === "rm_anova" ? "RM-ANOVA" : "Mixed Model*"}
            </button>
          ))}
        </div>
        {config.modelType === "mixed_model" && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              borderRadius: 4,
              background: t.warn + "18",
              border: `1px solid ${t.warn}44`,
              fontSize: 10,
              color: t.tx2,
              lineHeight: 1.5,
            }}
          >
            <b style={{ color: t.warn }}>Pseudo-OLS approximation.</b> Not a
            true REML/ML mixed model. Fixed effects fitted via pooled OLS;
            cluster-robust SEs partially correct for within-subject correlation.
            Random-intercept variance estimated post-hoc (method-of-moments) and
            may go <b>negative</b> &mdash; clamped to 0 in display.
            LogLik/AIC/BIC use OLS likelihood. Use a proper mixed-model library
            for definitive inference.
          </div>
        )}
      </div>

      {/* Sphericity correction */}
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
          Sphericity Correction
        </div>
        <select
          value={config.sphericityCorrection || "greenhouse-geisser"}
          onChange={(e) => update({ sphericityCorrection: e.target.value })}
          style={{
            width: "100%",
            padding: "4px 6px",
            borderRadius: 4,
            border: `1px solid ${t.bdr}`,
            background: t.surf,
            color: t.tx,
            fontSize: 10,
          }}
        >
          <option value="none">None (assume sphericity)</option>
          <option value="greenhouse-geisser">Greenhouse-Geisser</option>
          <option value="huynh-feldt">Huynh-Feldt</option>
          <option value="lower-bound">Lower bound</option>
        </select>
      </div>

      {/* Minimum time separation between timepoints */}
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
          Min. Time Separation (days)
        </div>
        <input
          type="number"
          min={1}
          value={config.minTimeSeparation ?? 30}
          onChange={(e) =>
            update({ minTimeSeparation: Math.max(1, Number(e.target.value)) })
          }
          style={{
            width: "95%",
            padding: "4px 6px",
            borderRadius: 4,
            border: `1px solid ${t.bdr}`,
            background: t.surf,
            color: t.tx,
            fontSize: 10,
          }}
        />
        <div style={{ fontSize: 8, color: t.tx3, marginTop: 2 }}>
          Subjects whose consecutive timepoints are closer than this are flagged
          at run time.
        </div>
      </div>

      {/* Timepoints */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: t.tx3,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Timepoints
          </span>
          <button
            onClick={addTimepoint}
            style={{
              fontSize: 9,
              padding: "2px 8px",
              borderRadius: 3,
              border: `1px solid ${t.acc}`,
              background: "transparent",
              color: t.acc,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {timepoints.map((tp, idx) => (
            <div
              key={tp.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 6px",
                borderRadius: 4,
                background: t.surf3,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: t.tx3,
                  fontWeight: 600,
                  minWidth: 16,
                }}
              >
                #{idx + 1}
              </span>
              <input
                value={tp.label}
                onChange={(e) => renameTimepoint(tp.id, e.target.value)}
                style={{
                  flex: 1,
                  padding: "3px 6px",
                  borderRadius: 3,
                  border: `1px solid ${t.bdr}`,
                  background: t.surf,
                  color: t.tx,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
              {timepoints.length > 2 && (
                <button
                  onClick={() => removeTimepoint(tp.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: t.tx3,
                    cursor: "pointer",
                    fontSize: 10,
                    padding: 2,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Subjects matrix */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: t.tx3,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Subjects ({subjects.length})
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                const managedTps = project?.timepoints || [];
                const managedSubjects = project?.subjects || [];
                if (managedTps.length < 2 || managedSubjects.length < 1) return;
                const newTps = managedTps.map((l) => ({
                  id: uid(),
                  label: l,
                  targetAge: null,
                  window: 90,
                }));
                const newSubjects = managedSubjects
                  .filter((sub) => sessions.some((s) => s.subjectId === sub.id))
                  .map((sub) => {
                    const records = {};
                    for (const tp of newTps) {
                      const match = sessions.find(
                        (s) =>
                          s.subjectId === sub.id &&
                          s.meta?.timepoint === tp.label,
                      );
                      records[tp.id] = match?.id || null;
                    }
                    return { id: sub.id, label: sub.label, records };
                  });
                if (newTps.length >= 2 && newSubjects.length >= 1) {
                  update({ timepoints: newTps, subjects: newSubjects });
                }
              }}
              style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 3,
                border: `1px solid ${t.acc}`,
                background: "transparent",
                color: t.acc,
                cursor: "pointer",
              }}
            >
              From Managed
            </button>
            <button
              onClick={() => {
                const uniqueTpLabels = [
                  ...new Set(
                    sessions.map((s) => s.meta?.timepoint).filter(Boolean),
                  ),
                ];
                const newTps = uniqueTpLabels.map((l) => ({
                  id: uid(),
                  label: l,
                  targetAge: null,
                  window: 90,
                }));
                const projectSubjects = project?.subjects || [];
                const newSubjects = projectSubjects
                  .filter((sub) =>
                    sessions.some(
                      (s) => s.subjectId === sub.id && s.meta?.timepoint,
                    ),
                  )
                  .map((sub) => {
                    const records = {};
                    for (const tp of newTps) {
                      const match = sessions.find(
                        (s) =>
                          s.subjectId === sub.id &&
                          s.meta?.timepoint === tp.label,
                      );
                      records[tp.id] = match?.id || null;
                    }
                    return { id: sub.id, label: sub.label, records };
                  });
                if (newTps.length >= 2 && newSubjects.length >= 1) {
                  update({ timepoints: newTps, subjects: newSubjects });
                }
              }}
              style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 3,
                border: `1px solid ${t.acc}`,
                background: "transparent",
                color: t.acc,
                cursor: "pointer",
              }}
            >
              From Sessions
            </button>
            <button
              onClick={addSubject}
              style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 3,
                border: `1px solid ${t.bdr}`,
                background: "transparent",
                color: t.tx2,
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: "3px 6px",
                    textAlign: "left",
                    color: t.tx,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Subject
                </th>
                {timepoints.map((tp) => (
                  <th
                    key={tp.id}
                    style={{
                      padding: "3px 6px",
                      textAlign: "center",
                      color: t.tx,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tp.label}
                  </th>
                ))}
                <th style={{ width: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                  <td style={{ padding: "3px 4px" }}>
                    <input
                      value={s.label}
                      onChange={(e) => renameSubject(s.id, e.target.value)}
                      style={{
                        width: 90,
                        padding: "2px 4px",
                        borderRadius: 3,
                        border: `1px solid ${t.bdr}`,
                        background: t.surf,
                        color: t.tx,
                        fontSize: 9,
                      }}
                    />
                  </td>
                  {timepoints.map((tp) => {
                    const sessionId = s.records?.[tp.id];
                    return (
                      <td
                        key={tp.id}
                        style={{ padding: "3px 4px", textAlign: "center" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <select
                            value={sessionId || ""}
                            onChange={(e) =>
                              setRecord(s.id, tp.id, e.target.value || null)
                            }
                            style={{
                              flex: 1,
                              minWidth: 70,
                              maxWidth: 110,
                              padding: "2px 3px",
                              borderRadius: 3,
                              border: `1px solid ${t.bdr}`,
                              background: t.surf,
                              color: t.tx,
                              fontSize: 8,
                            }}
                          >
                            <option value="">—</option>
                            {sessions.map((ses) => (
                              <option key={ses.id} value={ses.id}>
                                {ses.name || ses.label || ses.id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                          {sessionId && (
                            <button
                              onClick={() => setRecord(s.id, tp.id, null)}
                              style={{
                                background: "none",
                                border: "none",
                                color: t.tx3,
                                cursor: "pointer",
                                fontSize: 8,
                                padding: 1,
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: "3px 4px", textAlign: "center" }}>
                    {subjects.length > 3 && (
                      <button
                        onClick={() => removeSubject(s.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: t.tx3,
                          cursor: "pointer",
                          fontSize: 9,
                          padding: 2,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 8, color: t.tx3, marginTop: 2 }}>
          {totalAssigned} session assignment{totalAssigned !== 1 ? "s" : ""}{" "}
          across {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Measurements */}
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

      {/* Ready indicator */}
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
        {timepoints.length < 2
          ? "⚠ At least 2 timepoints required"
          : subjects.length < 3
            ? "⚠ At least 3 subjects required"
            : subjects.some((s) => timepoints.some((tp) => !s.records?.[tp.id]))
              ? "⚠ Every subject needs a session at every timepoint"
              : `✓ ${subjects.length} subjects × ${timepoints.length} timepoints, ${labelIds.length || "all"} measurement(s)`}
      </div>
    </div>
  );
}

// ─── Results Panel ─────────────────────────────────────────────────────────
export function LongitudinalResults({ results, t }) {
  const [tab, setTab] = useState("trajectories");

  const tabs = [
    { id: "trajectories", label: "Trajectories" },
    { id: "sphericity", label: "Sphericity" },
    { id: "anova", label: "ANOVA" },
    { id: "pairwise", label: "Pairwise" },
    { id: "mixed", label: "Mixed Model" },
    { id: "change", label: "Change" },
  ];

  if (results.error) {
    return (
      <div
        style={{ fontSize: 11, color: t.err, padding: 12, textAlign: "center" }}
      >
        {results.error}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 8,
          borderBottom: `1px solid ${t.bdr}44`,
          overflowX: "auto",
        }}
      >
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            style={{
              padding: "5px 10px",
              fontSize: 9,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom:
                tab === tabItem.id
                  ? `2px solid ${t.acc}`
                  : "2px solid transparent",
              background: "transparent",
              color: tab === tabItem.id ? t.acc : t.tx3,
              whiteSpace: "nowrap",
            }}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "trajectories" && <TrajectoryView results={results} t={t} />}
      {tab === "sphericity" && <SphericityView results={results} t={t} />}
      {tab === "anova" && <ANOVAView results={results} t={t} />}
      {tab === "pairwise" && <PairwiseView results={results} t={t} />}
      {tab === "mixed" && <MixedModelView results={results} t={t} />}
      {tab === "change" && <ChangeView results={results} t={t} />}
    </div>
  );
}

// ─── SVG Trajectory Plot ──────────────────────────────────────────────────
function TrajectoryView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip,
  );

  if (labels.length === 0)
    return <EmptyDetail message="No trajectory data available." t={t} />;

  const W = 500,
    H = 250;

  return (
    <div style={{ overflowX: "auto" }}>
      {labels.map(([label, lr]) => {
        const rawData = lr.rawData || {};
        const tpNames = Object.keys(rawData);

        const allVals = tpNames.flatMap((tp) => rawData[tp]?.values || []);
        const yMin = allVals.length > 0 ? Math.min(...allVals) - 2 : 0;
        const yMax = allVals.length > 0 ? Math.max(...allVals) + 2 : 100;
        const xScale = (i) =>
          60 + i * ((W - 80) / Math.max(tpNames.length - 1, 1));
        const yScale = (v) => H - 40 - ((v - yMin) / (yMax - yMin)) * (H - 60);

        return (
          <div
            key={label}
            style={{
              marginBottom: 16,
              padding: 8,
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
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {label}
            </div>
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              style={{ overflow: "visible", display: "block" }}
            >
              {[...Array(5)].map((_, i) => {
                const v = yMin + (i * (yMax - yMin)) / 4;
                return (
                  <g key={i}>
                    <line
                      x1={60}
                      y1={yScale(v)}
                      x2={W - 20}
                      y2={yScale(v)}
                      stroke={t.bdr}
                      strokeWidth={0.5}
                    />
                    <text
                      x={54}
                      y={yScale(v) + 3}
                      fill={t.tx2}
                      fontSize={8}
                      textAnchor="end"
                    >
                      {v.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              {tpNames.map((tp, i) => (
                <text
                  key={tp}
                  x={xScale(i)}
                  y={H - 10}
                  fill={t.tx2}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {tp}
                </text>
              ))}

              {/* Individual trajectories */}
              {lr.nSubjects > 0 &&
                Array.from({ length: lr.nSubjects }, (_, si) => {
                  const pts = tpNames
                    .map((tp, i) => {
                      const vals = rawData[tp]?.values || [];
                      const val = vals[si];
                      return val != null ? `${xScale(i)},${yScale(val)}` : null;
                    })
                    .filter(Boolean);
                  if (pts.length < 2) return null;
                  return (
                    <path
                      key={si}
                      d={`M${pts.join("L")}`}
                      fill="none"
                      stroke={t.tx3}
                      strokeWidth={0.6}
                      opacity={0.35}
                    />
                  );
                })}

              {/* Mean trajectory */}
              {tpNames.length >= 2 &&
                (() => {
                  const meanPts = tpNames
                    .map((tp, i) => {
                      const vals = rawData[tp]?.values || [];
                      return vals.length > 0
                        ? `${xScale(i)},${yScale(mean(vals))}`
                        : null;
                    })
                    .filter(Boolean);
                  if (meanPts.length < 2) return null;
                  return (
                    <g>
                      <path
                        d={`M${meanPts.join("L")}`}
                        fill="none"
                        stroke={t.acc}
                        strokeWidth={2.5}
                      />
                      {tpNames.map((tp, i) => {
                        const vals = rawData[tp]?.values || [];
                        const m = vals.length > 0 ? mean(vals) : null;
                        if (m == null) return null;
                        return (
                          <circle
                            key={tp}
                            cx={xScale(i)}
                            cy={yScale(m)}
                            r={4.5}
                            fill={t.acc}
                            stroke={t.bg}
                            strokeWidth={1}
                          />
                        );
                      })}
                    </g>
                  );
                })()}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sphericity View ──────────────────────────────────────────────────────
function SphericityView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip && lr.rmAnova?.sphericity,
  );

  if (labels.length === 0)
    return (
      <EmptyDetail message="Sphericity test requires 3+ timepoints." t={t} />
    );

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
            {[
              "Label",
              "Mauchly's W",
              "χ²",
              "df",
              "p-value",
              "Spherical?",
              "GG ε",
              "HF ε",
              "LB ε",
              "Used ε",
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
          {labels.map(([label, lr]) => {
            const s = lr.rmAnova.sphericity;
            const r = lr.rmAnova;
            return (
              <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}
                >
                  {label}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {s.W?.toFixed(4) || "—"}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {s.chi2?.toFixed(3) || "—"}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {s.df ?? "—"}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    color: s.spherical ? t.ok : t.err,
                    fontWeight: 700,
                  }}
                >
                  {fmtP(s.p)}
                </td>
                <td style={{ padding: "5px 6px" }}>
                  <Badge
                    value={s.spherical ? "Yes" : "No"}
                    ok={s.spherical}
                    t={t}
                  />
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {r.ggEps?.toFixed(4) || "—"}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {r.hfEps?.toFixed(4) || "—"}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>
                  {r.lbEps?.toFixed(4) || "—"}
                </td>
                <td
                  style={{ padding: "5px 6px", color: t.tx, fontWeight: 700 }}
                >
                  {r.eps?.toFixed(4) || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ANOVA Table View ─────────────────────────────────────────────────────
function ANOVAView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip && lr.rmAnova,
  );

  if (labels.length === 0)
    return <EmptyDetail message="No ANOVA results available." t={t} />;

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
            {[
              "Label",
              "Source",
              "SS",
              "df",
              "MS",
              "F",
              "p-value",
              "Sig.",
              "η²p",
              "ω²",
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
          {labels.flatMap(([label, lr]) => {
            const r = lr.rmAnova;
            if (!r) return [];
            const rows = [
              {
                source: "Timepoint",
                ss: r.ssTime,
                df: `${r.dfTime} (${r.dfTimeCorrected?.toFixed(2)})`,
                ms: r.msTime,
                F: r.F,
                p: r.pValue,
                sig: r.significant,
              },
              {
                source: "Subject",
                ss: r.ssSubj,
                df: r.dfSubj,
                ms: r.ssSubj / r.dfSubj,
                F: null,
                p: null,
                sig: null,
              },
              {
                source: "Error",
                ss: r.ssError,
                df: `${r.dfError} (${r.dfErrorCorrected?.toFixed(2)})`,
                ms: r.msError,
                F: null,
                p: null,
                sig: null,
              },
            ];
            const hdr = (
              <tr key={`${label}-hdr`} style={{ background: t.surf2 + "44" }}>
                <td
                  style={{
                    padding: "5px 6px",
                    color: t.tx,
                    fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                  }}
                  colSpan={9}
                >
                  {label}
                  {lr.unit ? ` (${lr.unit})` : ""}
                </td>
              </tr>
            );
            const dataRows = rows.map((row) => (
              <tr
                key={`${label}-${row.source}`}
                style={{ borderBottom: `1px solid ${t.bdr}22` }}
              >
                <td style={{ padding: "4px 6px", color: t.tx }}></td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {row.source}
                </td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {row.ss?.toFixed(2) || "—"}
                </td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {row.df ?? "—"}
                </td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {row.ms?.toFixed(3) || "—"}
                </td>
                <td
                  style={{ padding: "4px 6px", color: t.tx2, fontWeight: 700 }}
                >
                  {row.F?.toFixed(4) || "—"}
                </td>
                <td
                  style={{
                    padding: "4px 6px",
                    color:
                      row.sig === true
                        ? t.err
                        : row.sig === false
                          ? t.ok
                          : t.tx2,
                    fontWeight: 700,
                  }}
                >
                  {row.p != null ? fmtP(row.p) : "—"}
                </td>
                <td style={{ padding: "4px 6px" }}>
                  {row.sig != null ? (
                    <Badge value={row.sig ? "Yes" : "No"} ok={!row.sig} t={t} />
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {r.partialEtaSq?.toFixed(4) || "—"}
                </td>
                <td style={{ padding: "4px 6px", color: t.tx2 }}>
                  {r.omegaSq?.toFixed(4) || "—"}
                </td>
              </tr>
            ));
            const note = (
              <tr key={`${label}-note`} style={{ fontSize: 8, color: t.tx3 }}>
                <td style={{ padding: "2px 6px" }} colSpan={9}>
                  Correction: {r.correctionUsed || "none"} (ε ={" "}
                  {r.eps?.toFixed(4)}), N = {r.n}, k = {r.k}
                </td>
              </tr>
            );
            return [hdr, ...dataRows, note];
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pairwise View ───────────────────────────────────────────────────────
function PairwiseView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip && (lr.pairwise || []).length > 0,
  );

  if (labels.length === 0)
    return (
      <EmptyDetail
        message="No pairwise results available (need 2+ timepoints)."
        t={t}
      />
    );

  return (
    <div>
      {labels.map(([label, lr]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: t.tx,
              marginBottom: 4,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {label}
            {lr.unit ? ` (${lr.unit})` : ""}
          </div>
          <div style={{ fontSize: 9, color: t.tx3, marginBottom: 4 }}>
            Bonferroni-corrected paired t-tests
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
                  "From",
                  "To",
                  "Mean Diff",
                  "SD",
                  "t",
                  "df",
                  "p (adj.)",
                  "Sig.",
                  "Cohen's d",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "3px 6px",
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
              {(lr.pairwise || []).map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.tpA}</td>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.tpB}</td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.meanDiff?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.sd?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.t?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.df ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "4px 6px",
                      color: c.significant ? t.err : t.ok,
                      fontWeight: 700,
                    }}
                  >
                    {fmtP(c.pAdjusted)}
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <Badge
                      value={c.significant ? "Yes" : "No"}
                      ok={!c.significant}
                      t={t}
                    />
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.d?.toFixed(3) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ─── Mixed Model View ─────────────────────────────────────────────────────
function MixedModelView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip && lr.lmm,
  );

  if (labels.length === 0)
    return (
      <EmptyDetail
        message="Mixed model results available only when 'Mixed Model' is selected."
        t={t}
      />
    );

  return (
    <div>
      {/* Prominent limitation banner */}
      <div
        style={{
          marginBottom: 12,
          padding: "8px 10px",
          borderRadius: 4,
          background: t.warn + "18",
          border: `1px solid ${t.warn}44`,
          fontSize: 10,
          color: t.tx2,
          lineHeight: 1.5,
        }}
      >
        <b style={{ color: t.warn }}>
          Pseudo-OLS approximation &mdash; not a true REML/ML mixed model.
        </b>
        Fixed effects fitted via pooled OLS ignoring within-subject correlation;
        cluster-robust SEs partially correct for anti-conservative bias.
        Random-intercept variance is a method-of-moments estimate that can go{" "}
        <b>negative</b> (clamped to 0). LogLik/AIC/BIC are OLS-based (not REML).
        Use a proper mixed-model library for definitive inference.
      </div>
      {labels.map(([label, lr]) => {
        const m = lr.lmm;
        if (!m) return null;
        return (
          <div key={label} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: t.tx,
                marginBottom: 6,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {label}
            </div>

            {/* Fixed effects */}
            <div style={{ marginBottom: 8 }}>
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
                Fixed Effects
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
                    {["Term", "Estimate", "SE", "t", "p-value", "95% CI"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "3px 6px",
                            textAlign: "left",
                            color: t.tx,
                            fontSize: 8,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(m.fixedEffects || []).map((fe, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${t.bdr}22` }}
                    >
                      <td
                        style={{
                          padding: "4px 6px",
                          color: t.tx,
                          fontWeight: 600,
                        }}
                      >
                        {fe.term}
                      </td>
                      <td style={{ padding: "4px 6px", color: t.tx2 }}>
                        {fe.estimate?.toFixed(4) || "—"}
                      </td>
                      <td style={{ padding: "4px 6px", color: t.tx2 }}>
                        {fe.se?.toFixed(4) || "—"}
                      </td>
                      <td style={{ padding: "4px 6px", color: t.tx2 }}>
                        {fe.t?.toFixed(3) || "—"}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          color: (fe.p || 1) < 0.05 ? t.err : t.ok,
                          fontWeight: 700,
                        }}
                      >
                        {fmtP(fe.p)}
                      </td>
                      <td style={{ padding: "4px 6px", color: t.tx2 }}>
                        {fe.ci95
                          ? `[${fe.ci95[0].toFixed(3)}, ${fe.ci95[1].toFixed(3)}]`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Random effects */}
            <div style={{ marginBottom: 8 }}>
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
                Random Effects
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
                    {["Component", "Variance"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "3px 6px",
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
                  {[
                    {
                      label: "Subject (intercept)",
                      val: m.randomEffects?.subjectVariance,
                    },
                    {
                      label: "Slope (time)",
                      val: m.randomEffects?.slopeVariance,
                    },
                    {
                      label: "Residual",
                      val: m.randomEffects?.residualVariance,
                    },
                    { label: "ICC", val: m.randomEffects?.icc },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${t.bdr}22` }}
                    >
                      <td style={{ padding: "4px 6px", color: t.tx }}>
                        {row.label}
                      </td>
                      <td style={{ padding: "4px 6px", color: t.tx2 }}>
                        {row.val?.toFixed(4) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Model fit */}
            <div style={{ padding: 8, background: t.surf2, borderRadius: 4 }}>
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
                Model Fit
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  fontSize: 10,
                  color: t.tx2,
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                <span>LogLik: {m.fit?.logLik?.toFixed(2) || "—"}</span>
                <span>AIC: {m.fit?.aic?.toFixed(1) || "—"}</span>
                <span>BIC: {m.fit?.bic?.toFixed(1) || "—"}</span>
                <span>N: {m.fit?.n || "—"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Change Score View ────────────────────────────────────────────────────
function ChangeView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(
    ([, lr]) => !lr.skip && (lr.changeScores || []).length > 0,
  );

  if (labels.length === 0)
    return <EmptyDetail message="No change score data available." t={t} />;

  return (
    <div>
      {labels.map(([label, lr]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: t.tx,
              marginBottom: 4,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {label}
            {lr.unit ? ` (${lr.unit})` : ""}
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
                  "From",
                  "To",
                  "Mean Δ",
                  "SD Δ",
                  "SEM",
                  "MDC",
                  "Δ > MDC?",
                  "t",
                  "p-value",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "3px 6px",
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
              {(lr.changeScores || []).map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.from}</td>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.to}</td>
                  <td
                    style={{
                      padding: "4px 6px",
                      color: c.meanChange > 0 ? t.err : t.ok,
                      fontWeight: 700,
                    }}
                  >
                    {c.meanChange?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.sd?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.sem?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.mdc?.toFixed(3) || "—"}
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <Badge
                      value={c.mdcExceeded ? "Yes" : "No"}
                      ok={!c.mdcExceeded}
                      t={t}
                    />
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {c.t?.toFixed(3) || "—"}
                  </td>
                  <td
                    style={{
                      padding: "4px 6px",
                      color: (c.pValue || 1) < 0.05 ? t.err : t.ok,
                      fontWeight: 700,
                    }}
                  >
                    {fmtP(c.pValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────
function Badge({ value, ok, t }) {
  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: 3,
        fontSize: 8,
        fontWeight: 700,
        background: ok ? t.ok + "22" : t.err + "22",
        border: `1px solid ${ok ? t.ok + "44" : t.err + "44"}`,
        color: ok ? t.ok : t.err,
      }}
    >
      {value}
    </span>
  );
}

function EmptyDetail({ message, t }) {
  return (
    <div
      style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 16 }}
    >
      {message}
    </div>
  );
}

function fmtP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
