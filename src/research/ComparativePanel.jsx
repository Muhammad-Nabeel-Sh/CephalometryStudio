import { useState } from "react";
import { InfoBox } from "../ui/ui.jsx";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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

// ─── Config Panel ────────────────────────────────────────────────────────
export function ComparativeConfig({ study, sessions, onUpdateStudy, t, project }) {
  const config = study.config;
  const groups = config.groups || [];
  const labelIds = config.labelIds || [];

  const update = (patch) => {
    onUpdateStudy({ ...study, config: { ...config, ...patch } });
  };

  const addGroup = () => {
    update({ groups: [...groups, { id: uid(), label: `Group ${groups.length + 1}`, caseIds: [] }] });
  };

  const removeGroup = (id) => {
    if (groups.length <= 2) return;
    update({ groups: groups.filter(g => g.id !== id) });
  };

  const renameGroup = (id, label) => {
    update({ groups: groups.map(g => g.id === id ? { ...g, label } : g) });
  };

  const toggleSessionInGroup = (groupId, sessionId) => {
    update({
      groups: groups.map(g => {
        if (g.id !== groupId) return g;
        const ids = g.caseIds || [];
        return { ...g, caseIds: ids.includes(sessionId) ? ids.filter(id => id !== sessionId) : [...ids, sessionId] };
      }),
    });
  };

  const toggleLabel = (labelId) => {
    const next = labelIds.includes(labelId) ? labelIds.filter(id => id !== labelId) : [...labelIds, labelId];
    update({ labelIds: next });
  };

  const unusedSessions = sessions.filter(s => !groups.some(g => (g.caseIds || []).includes(s.id)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11 }}>

      <InfoBox t={t}>
        Each <b>group</b> contains sessions for one arm of the study.
        Assign sessions to groups, or use <b>"From Managed"</b> to
        auto-populate from managed groups, or <b>"From Groups"</b> from session metadata.
      </InfoBox>

      {/* Design selector */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Study Design</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["independent", "paired"].map(d => (
            <button key={d} onClick={() => update({ design: d })}
              style={{
                flex: 1, padding: "5px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${config.design === d ? t.acc : t.bdr}`,
                background: config.design === d ? t.acc + "22" : "transparent",
                color: config.design === d ? t.acc : t.tx2,
              }}>
              {d === "independent" ? "Independent" : "Paired"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: t.tx3, marginTop: 2 }}>
          {config.design === "independent" ? "Groups are independent (2 groups → t-test/Mann-Whitney; 3+ → ANOVA/Kruskal-Wallis)" :
           "Repeated measurements on same subjects (2 groups → paired t-test/Wilcoxon; 3+ → RM-ANOVA/Friedman)"}
        </div>
      </div>

      {/* Groups */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3 }}>Groups</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => {
              const managedGroups = project?.groups || [];
              if (managedGroups.length < 2) return;
              update({ groups: managedGroups.map(g => ({
                id: uid(), label: g,
                caseIds: sessions.filter(s => s.meta?.group === g).map(s => s.id),
              })) });
            }}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.acc}`, background: "transparent", color: t.acc, cursor: "pointer" }}>
              From Managed
            </button>
            <button onClick={() => {
              const uniqueGroups = [...new Set(sessions.map(s => s.meta?.group).filter(Boolean))];
              if (uniqueGroups.length < 2) return;
              update({ groups: uniqueGroups.map(g => ({
                id: uid(), label: g,
                caseIds: sessions.filter(s => s.meta?.group === g).map(s => s.id),
              })) });
            }}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>
              From Groups
            </button>
            <button onClick={addGroup}
              style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>
              + Add
            </button>
          </div>
        </div>
        {groups.map(g => (
          <div key={g.id} style={{ marginBottom: 6, padding: 8, borderRadius: 4, background: t.surf3, border: `1px solid ${t.bdr}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <input value={g.label} onChange={e => renameGroup(g.id, e.target.value)}
                style={{ flex: 1, padding: "3px 6px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 10, fontWeight: 600 }} />
              {groups.length > 2 && (
                <button onClick={() => removeGroup(g.id)}
                  style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 10, padding: 2 }}>✕</button>
              )}
            </div>
            {/* Sessions in group */}
            <div style={{ fontSize: 9, color: t.tx3, marginBottom: 3 }}>Cases ({(g.caseIds || []).length})</div>
            {(g.caseIds || []).map(sid => {
              const s = sessions.find(s => s.id === sid);
              if (!s) return null;
              return (
                <div key={sid} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, padding: "2px 4px", background: t.surf2, borderRadius: 3 }}>
                  <span style={{ flex: 1, fontSize: 9, color: t.tx, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name || s.label || sid.slice(0, 8)}
                  </span>
                  <button onClick={() => toggleSessionInGroup(g.id, sid)}
                    style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 9, padding: 1 }}>✕</button>
                </div>
              );
            })}
            {/* Add session to this group */}
            {unusedSessions.filter(s => !(g.caseIds || []).includes(s.id)).length > 0 && (
              <select value="" onChange={e => { if (e.target.value) toggleSessionInGroup(g.id, e.target.value); }}
                style={{ width: "100%", marginTop: 3, padding: "3px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
                <option value="">+ Add session...</option>
                {unusedSessions.filter(s => !(g.caseIds || []).includes(s.id)).map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.label || s.id.slice(0, 8)}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {/* Measurements */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Measurements</div>
        <LabelSelector sessions={sessions} selected={labelIds} onToggle={toggleLabel} t={t} />
      </div>

      {/* Alpha */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Settings</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 10, color: t.tx2, display: "flex", alignItems: "center", gap: 4 }}>
            Alpha:
            <select value={config.alpha ?? 0.05} onChange={e => update({ alpha: Number(e.target.value) })}
              style={{ padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
              {[0.01, 0.05, 0.1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 10, color: t.tx2, display: "flex", alignItems: "center", gap: 4 }}>
            MC Correction:
            <select value={config.mcCorrection || "bonferroni"} onChange={e => update({ mcCorrection: e.target.value })}
              style={{ padding: "2px 4px", borderRadius: 3, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 9 }}>
              {["bonferroni", "holm", "bh", "none"].map(c => <option key={c} value={c}>{c === "bh" ? "Benjamini-Hochberg" : c === "holm" ? "Holm" : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </label>
          <span style={{ fontSize: 9, color: t.tx3 }}>Effect size auto-selected per test</span>
        </div>
      </div>

      {/* Ready indicator */}
      <div style={{ fontSize: 10, color: t.tx2, textAlign: "center", padding: 6, background: t.surf3, borderRadius: 4 }}>
        {groups.some(g => !(g.caseIds || []).length) ? "⚠ Each group needs at least one case" :
         config.design === "paired" && groups.some(g => (g.caseIds || []).length !== (groups[0]?.caseIds || []).length) ? "⚠ Paired groups must have equal case counts" :
         `✓ ${groups.length} groups, ${labelIds.length || "all"} measurement(s)`}
      </div>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────
export function ComparativeResults({ results, t }) {
  const [tab, setTab] = useState("results");

  const tabs = [
    { id: "results", label: "Test Results" },
    { id: "assumptions", label: "Assumptions" },
    { id: "effects", label: "Effect Sizes" },
    { id: "posthoc", label: "Post-Hoc" },
    { id: "manova", label: "MANOVA" },
  ];

  if (results.error) {
    return <div style={{ fontSize: 11, color: t.err, padding: 12, textAlign: "center" }}>{results.error}</div>;
  }

  return (
    <div>
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

      {results.note && !Object.keys(results.labels || {}).length && (
        <div style={{ fontSize: 11, color: t.tx2, padding: 12, textAlign: "center" }}>{results.note}</div>
      )}

      {tab === "results" && <ResultsView results={results} t={t} />}
      {tab === "assumptions" && <AssumptionsView results={results} t={t} />}
      {tab === "effects" && <EffectSizeView results={results} t={t} />}
      {tab === "posthoc" && <PostHocView results={results} t={t} />}
      {tab === "manova" && <MANOVAView results={results} t={t} />}
    </div>
  );
}

// ─── Test Results Table ──────────────────────────────────────────────────
function ResultsView({ results, t }) {
  const entries = Object.entries(results.labels || {});
  const passed = entries.filter(([, lr]) => !lr.skip);
  const skipped = entries.filter(([, lr]) => lr.skip);

  if (passed.length === 0) {
    return (
      <div>
        <EmptyDetail message="No results available." t={t} />
        {skipped.length > 0 && (
          <div style={{ marginTop: 8, padding: 10, background: t.err + "0a", borderRadius: 6, border: `1px solid ${t.err}33` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.err, marginBottom: 4 }}>Skipped ({skipped.length})</div>
            {skipped.map(([label, lr]) => (
              <div key={label} style={{ fontSize: 9, color: t.tx2, marginBottom: 2 }}>
                <span style={{ color: t.tx, fontWeight: 600 }}>{label}</span>: {lr.reason || "Unknown"}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      {skipped.length > 0 && (
        <div style={{ marginBottom: 8, padding: 8, background: t.err + "0a", borderRadius: 6, border: `1px solid ${t.err}33`, fontSize: 9, color: t.tx2 }}>
          <span style={{ color: t.err, fontWeight: 700 }}>{skipped.length}</span> label(s) skipped. See Assumptions tab for details.
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Test", "Statistic", "df", "p-value", "Significant", "MC Adjusted"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {passed.map(([label, lr]) => {
            const r = lr.result;
            const statVal = lr.testName === "Independent t-test" || lr.testName === "Welch's t-test" ? r?.t :
              lr.testName === "One-way ANOVA" || lr.testName === "Repeated measures ANOVA" ? r?.F :
              lr.testName === "Mann-Whitney U" ? r?.U :
              lr.testName === "Wilcoxon signed-rank" ? r?.W :
              lr.testName === "Kruskal-Wallis" ? r?.H :
              lr.testName === "Friedman test" ? r?.Q : null;
            const df = lr.testName === "Independent t-test" || lr.testName === "Welch's t-test" ? r?.df :
              lr.testName === "One-way ANOVA" ? `${r?.dfBetween},${r?.dfWithin}` :
              lr.testName === "Repeated measures ANOVA" ? `${r?.dfCond},${r?.dfErr}` :
              lr.testName === "Kruskal-Wallis" || lr.testName === "Friedman test" ? r?.df : "—";
            const p = r?.pValue;
            const sig = p != null && p < (results.alpha || 0.05);
            const mcCorr = lr.mcCorrected;
            return (
              <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{label}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{lr.testName}</td>
                <td style={{ padding: "5px 6px", color: t.tx2, fontWeight: 700 }}>{statVal != null ? statVal.toFixed(4) : "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{df}</td>
                <td style={{ padding: "5px 6px", color: p != null ? (sig ? t.err : t.ok) : t.tx2, fontWeight: 700 }}>{p != null ? fmtP(p) : "—"}</td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: sig ? t.err + "22" : t.ok + "22",
                    border: `1px solid ${sig ? t.err + "44" : t.ok + "44"}`,
                    color: sig ? t.err : t.ok,
                  }}>{sig ? "Yes" : "No"}</span>
                </td>
                <td style={{ padding: "5px 6px", color: mcCorr ? (mcCorr.significant ? t.err : t.ok) : t.tx3 }}>
                  {mcCorr ? (mcCorr.significant ? "Yes" : "No") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Assumptions View ────────────────────────────────────────────────────
function AssumptionsView({ results, t }) {
  const entries = Object.entries(results.labels || {});
  const passed = entries.filter(([, lr]) => !lr.skip);
  const skipped = entries.filter(([, lr]) => lr.skip);

  if (passed.length === 0) {
    return (
      <div>
        <EmptyDetail message="No assumption data available." t={t} />
        {skipped.length > 0 && (
          <div style={{ marginTop: 8, padding: 10, background: t.err + "0a", borderRadius: 6, border: `1px solid ${t.err}33` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.err, marginBottom: 4 }}>Skipped ({skipped.length})</div>
            {skipped.map(([label, lr]) => (
              <div key={label} style={{ fontSize: 9, color: t.tx2, marginBottom: 2 }}>
                <span style={{ color: t.tx, fontWeight: 600 }}>{label}</span>: {lr.reason || "Unknown"}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const labels = passed;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Test", "All Normal?", "Equal Var?", "Shapiro-Wilk (per group)", "Levene's W", "Levene's p"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map(([label, lr]) => {
            const a = lr.assumptions || {};
            const normText = (a.normalityTests || []).map((t, i) => {
              const gLabel = Object.keys(lr.rawData || {})[i] || `G${i + 1}`;
              return `${gLabel}: W=${t?.W?.toFixed(3) || "—"}, p=${t?.pValue != null ? fmtP(t.pValue) : "—"}`;
            }).join("; ");
            return (
              <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{label}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{lr.testName}</td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: a.allNormal ? t.ok + "22" : t.err + "22",
                    border: `1px solid ${a.allNormal ? t.ok + "44" : t.err + "44"}`,
                    color: a.allNormal ? t.ok : t.err,
                  }}>{a.allNormal ? "Yes" : "No"}</span>
                </td>
                <td style={{ padding: "5px 6px" }}>
                  {a.levene ? (
                    <span style={{
                      padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                      background: a.equalVar ? t.ok + "22" : t.err + "22",
                      border: `1px solid ${a.equalVar ? t.ok + "44" : t.err + "44"}`,
                      color: a.equalVar ? t.ok : t.err,
                    }}>{a.equalVar ? "Yes" : "No"}</span>
                  ) : <span style={{ color: t.tx3 }}>N/A</span>}
                </td>
                <td style={{ padding: "5px 6px", color: t.tx2, fontSize: 9, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{normText}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{a.levene?.W?.toFixed(3) || "—"}</td>
                <td style={{ padding: "5px 6px", color: a.levene?.pValue != null ? (a.levene.pValue > 0.05 ? t.ok : t.err) : t.tx3 }}>
                  {a.levene?.pValue != null ? fmtP(a.levene.pValue) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Effect Size View ────────────────────────────────────────────────────
function EffectSizeView({ results, t }) {
  const labels = Object.entries(results.labels || {}).filter(([, lr]) => !lr.skip && lr.effectSize);
  if (labels.length === 0) return <EmptyDetail message="No effect size data available." t={t} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: t.surf2 }}>
            {["Label", "Measure", "Value", "95% CI", "Interpretation"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map(([label, lr]) => {
            const es = lr.effectSize;
            const value = es.cohensD ?? es.cohensDz ?? es.rankBiserial ?? es.matchedPairsR ?? es.etaSq ?? es.partialEtaSq ?? es.epsilonSq ?? es.kendallW ?? null;
            const ci = es.ci95;
            return (
              <tr key={label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{label}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{es.measure || "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2, fontWeight: 700 }}>{value != null ? value.toFixed(4) : "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{ci ? `[${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]` : "—"}</td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: esColor(es.interpretation),
                    border: `1px solid ${esColor(es.interpretation)}44`, color: esColor(es.interpretation),
                  }}>{es.interpretation}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function esColor(int) {
  if (int === "Negligible") return "#9ca3af";
  if (int === "Small") return "#60a5fa";
  if (int === "Medium") return "#f59e0b";
  if (int === "Large") return "#f97316";
  return "#ef4444";
}

// ─── Post-Hoc View ──────────────────────────────────────────────────────
function PostHocView({ results, t }) {
  const ph = results.postHoc || {};
  const labels = Object.keys(ph);
  if (labels.length === 0) return <EmptyDetail message="Post-hoc results available only for 3+ group designs." t={t} />;
  const isPaired = results.design === "paired";

  return (
    <div>
      {labels.map(label => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.tx, marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>{label}{results.labels?.[label]?.unit ? ` (${results.labels[label].unit})` : ""}</div>
          <div style={{ fontSize: 9, color: t.tx3, marginBottom: 4 }}>{isPaired ? "Bonferroni-corrected paired t-tests" : "Tukey's HSD"}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
            <thead>
              <tr style={{ background: t.surf2 }}>
                {["Group A", "Group B", "Mean Diff", isPaired ? "t" : "q", isPaired ? "p (adj.)" : "p-value", "Significant", isPaired ? "df" : "95% CI"].map(h => (
                  <th key={h} style={{ padding: "3px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ph[label].map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.groupA}</td>
                  <td style={{ padding: "4px 6px", color: t.tx }}>{c.groupB}</td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>{c.meanDiff?.toFixed(3) || "—"}</td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>{isPaired ? (c.t?.toFixed(3) || "—") : (c.q?.toFixed(3) || "—")}</td>
                  <td style={{ padding: "4px 6px", color: c.significant ? t.err : t.ok, fontWeight: 700 }}>{isPaired ? fmtP(c.pAdjusted) : fmtP(c.pValue)}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <span style={{
                      padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                      background: c.significant ? t.err + "22" : t.ok + "22",
                      color: c.significant ? t.err : t.ok,
                    }}>{c.significant ? "Yes" : "No"}</span>
                  </td>
                  <td style={{ padding: "4px 6px", color: t.tx2 }}>
                    {isPaired ? (c.df ?? "—") : (c.ci95 ? `[${c.ci95[0]?.toFixed(3) || "\u2014"}, ${c.ci95[1]?.toFixed(3) || "\u2014"}]` : "—")}
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

// ─── MANOVA View ─────────────────────────────────────────────────────────
function MANOVAView({ results, t }) {
  const m = results.manova;
  if (!m) return <EmptyDetail message="MANOVA requires 2+ outcome measurements with complete data across groups." t={t} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>Multivariate Analysis of Variance</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
          <thead>
            <tr style={{ background: t.surf2 }}>
              {["Statistic", "Value", "F (approx)", "df1", "df2", "p-value", "Significant"].map(h => (
                <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: t.tx3, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Wilks' Lambda", value: m.wilksLambda?.toFixed(4) },
              { label: "Pillai's Trace", value: m.pillaiTrace?.toFixed(4) },
              { label: "Hotelling's Trace", value: m.hotellingsTrace?.toFixed(4) },
              { label: "Roy's Largest Root", value: m.roysLargestRoot?.toFixed(4) },
            ].map(row => (
              <tr key={row.label} style={{ borderBottom: `1px solid ${t.bdr}22` }}>
                <td style={{ padding: "5px 6px", color: t.tx, fontWeight: 600 }}>{row.label}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{row.value}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{m.F?.toFixed(3) || "—"}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{m.df1}</td>
                <td style={{ padding: "5px 6px", color: t.tx2 }}>{m.df2}</td>
                <td style={{ padding: "5px 6px", color: m.pValue < 0.05 ? t.err : t.ok, fontWeight: 700 }}>{fmtP(m.pValue)}</td>
                <td style={{ padding: "5px 6px" }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700,
                    background: m.significant ? t.err + "22" : t.ok + "22",
                    border: `1px solid ${m.significant ? t.err + "44" : t.ok + "44"}`,
                    color: m.significant ? t.err : t.ok,
                  }}>{m.significant ? "Yes" : "No"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 9, color: t.tx3, marginTop: 6 }}>
          {m.nGroups} groups × {m.nDVs} dependent variables, N={m.N}
        </div>
      </div>
      <BoxMView boxM={m.boxM} t={t} />
    </div>
  );
}

// ─── Box's M (covariance homogeneity) View ─────────────────────────────────
function BoxMView({ boxM, t }) {
  if (!boxM) return null;
  if (boxM.skipped) {
    return (
      <div style={{ padding: "8px 10px", background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44`, fontSize: 10, color: t.tx3 }}>
        <span style={{ fontWeight: 700, color: t.tx2 }}>Box's M test: </span>{boxM.reason}
      </div>
    );
  }
  return (
    <div style={{ padding: 10, background: t.surf3, borderRadius: 6, border: `1px solid ${t.bdr}44` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 4 }}>Box's M Test — Covariance Homogeneity</div>
      <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: t.tx2, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>M = <b style={{ color: t.tx }}>{boxM.M.toFixed(3)}</b></span>
        <span>χ² = <b style={{ color: t.tx }}>{boxM.chi2.toFixed(3)}</b></span>
        <span>df = <b style={{ color: t.tx }}>{boxM.df}</b></span>
        <span>p = <b style={{ color: boxM.pValue < 0.05 ? t.err : t.ok }}>{fmtP(boxM.pValue)}</b></span>
        <span>c₁ = <b style={{ color: t.tx }}>{boxM.correction.toFixed(4)}</b></span>
      </div>
      <div style={{ fontSize: 9, color: boxM.pValue < 0.05 ? t.warn : t.tx3, marginTop: 4 }}>
        {boxM.pValue < 0.05
          ? "Covariance homogeneity rejected (p < 0.05). MANOVA is robust to mild violations but consider Pillai's Trace (most robust) over Wilks' Lambda if groups are unbalanced."
          : "Covariance homogeneity assumption met (p ≥ 0.05)."}
      </div>
      {boxM.warnings?.map((w, i) => (
        <div key={i} style={{ fontSize: 9, color: t.warn, marginTop: 2 }}>⚠ {w}</div>
      ))}
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────
function EmptyDetail({ message, t }) {
  return <div style={{ fontSize: 11, color: t.tx3, textAlign: "center", padding: 16 }}>{message}</div>;
}

function fmtP(p) {
  if (p == null || !isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}
