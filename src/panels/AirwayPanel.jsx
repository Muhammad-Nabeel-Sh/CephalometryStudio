import { useMemo, useState } from "react";
import { InfoBox, Btn, GuideBtn } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { SMALL_BTN } from "../ui/tokens.js";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { useUIStore } from "../state/uiStore.js";
import { AIRWAY_ADENOID_AREA, AIRWAY_LANDMARKS, AIRWAY_REGIONS, AIRWAY_WALLS } from "../airway/definitions.js";
import { AIRWAY_NOTICE, airwayNeeds, computeAirway, findLandmark, findWall } from "../airway/compute.js";

// ═══════════════════════════════════════════════════════════════════════════════
// AIRWAY PANEL — check the film, place landmarks, trace walls, read the results.
// ═══════════════════════════════════════════════════════════════════════════════

const FILM_FIELDS = [
  { key: "posture", label: "Posture", options: [["upright", "Upright"], ["supine", "Supine"]] },
  { key: "head", label: "Head position", options: [["natural", "Natural head position"], ["frankfort", "Frankfort horizontal"], ["other", "Other"]] },
  { key: "teeth", label: "Teeth and lips", options: [["together", "Teeth together, lips relaxed"], ["other", "Other"]] },
  { key: "swallowing", label: "Soft palate", options: [["no", "No sign of swallowing"], ["yes", "Inverted V (swallowing)"]] },
];

function SectionTitle({ t, step, children, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 6px", fontSize: 13, fontWeight: 700, color: t.tx }}>
      <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: done ? t.ok : t.surf3, color: done ? t.bg : t.tx2 }}>
        {done ? <Icon name="check" size={14} /> : step}
      </span>
      {children}
    </div>
  );
}

function ResultRow({ t, m }) {
  const [open, setOpen] = useState(false);
  const value = m.value === null ? "—" : `${m.value.toFixed(m.unit ? 1 : 2)}${m.unit ? ` ${m.unit}` : ""}`;
  const color = m.state === "outside" ? t.warn : m.state === "within" ? t.ok : t.tx3;
  return (
    <div style={{ padding: "6px 8px", borderRadius: 6, background: t.surf2, border: `1px solid ${t.bdr}` }}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{ display: "flex", width: "100%", gap: 8, alignItems: "baseline", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: t.tx, textAlign: "left" }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: m.value === null ? t.tx3 : t.tx }}>{value}</span>
      </button>
      <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.45, color }}>
        {m.interpretation}{m.zScore !== null ? ` (z ${m.zScore >= 0 ? "+" : ""}${m.zScore.toFixed(1)})` : ""}
      </div>
      {m.referenceText && (
        <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.45, color: t.tx2 }}>
          {m.referenceText}: {m.referenceGroup}, {m.normSource}
        </div>
      )}
      {(m.referenceWarning || m.magnificationNote) && (
        <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.45, color: t.tx3 }}>{[m.referenceWarning, m.magnificationNote].filter(Boolean).join(" ")}</div>
      )}
      {open && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${t.bdr}`, fontSize: 12, lineHeight: 1.45, color: t.tx2 }}>
          {m.method}
          {m.referenceSample && <div style={{ marginTop: 2 }}>Sample: {m.referenceSample} ({m.referenceWhere}).</div>}
        </div>
      )}
    </div>
  );
}

export default function AirwayPanel({ t, markups, calibration, facing, sex, age, film, onUpdateFilm, actions, showOverlay, onToggleOverlay, getImagePixels }) {
  const [guideKey, setGuideKey] = useState(null);
  const [notice, setNotice] = useState(null);
  const traceRole = useUIStore(s => s.airwayTraceRole);
  const suggestion = useUIStore(s => s.airwaySuggestion);

  const res = useMemo(
    () => computeAirway(markups, calibration, { age, sex, facing, film }),
    [markups, calibration, age, sex, facing, film],
  );
  const needs = useMemo(() => airwayNeeds(age), [age]);
  const missingLandmarks = needs.landmarks.filter(id => !findLandmark(markups, id));
  const wallRows = [
    ...needs.walls.map(id => ({ id, ...AIRWAY_WALLS[id] })),
    ...(needs.adenoid ? [{ id: "adenoid", ...AIRWAY_ADENOID_AREA, optional: true }] : []),
  ];
  const wallsDone = needs.walls.every(id => findWall(markups, id));
  const calDone = calibration?.done === true;

  const suggest = (role) => {
    setNotice(null);
    const curve = markups.find(m => m.airwayRole === role);
    const img = getImagePixels?.();
    if (!img) { setNotice("Edge suggestions need an image with no rotation or scaling applied."); return; }
    if (!actions.suggestWall(role, curve, img, facing, calDone ? calibration.pxPerMm : undefined)) setNotice("No clear edge near this trace, so there's no suggestion. Keep your trace, or redraw it closer to the wall.");
  };

  const regions = AIRWAY_REGIONS
    .map(r => ({ ...r, rows: res.measurements.filter(m => m.region === r.id) }))
    .filter(r => r.rows.length);
  const measured = res.measurements.filter(m => m.value !== null).length;

  return (
    <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginTop: 8, display: "flex", alignItems: "center" }}>
        Airway Analysis
        <GuideBtn t={t} onClick={() => setGuideKey("airway")} style={{ marginLeft: 6 }} />
      </div>
      <InfoBox t={t}>{AIRWAY_NOTICE}</InfoBox>

      {!calDone && (
        <div style={{ padding: "8px 10px", borderRadius: 6, background: t.warn + "18", border: `1px solid ${t.warn}44`, fontSize: 12, color: t.tx }}>
          Not calibrated, so values are in pixels and can't be compared.
        </div>
      )}

      {/* ─── 1. Patient and film ─── */}
      <section>
        <SectionTitle t={t} step={1} done={age !== null && Boolean(sex)}>Patient and film</SectionTitle>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: t.tx2, marginBottom: 6 }}>
          Age {age ?? "not set"}, sex {sex === "F" ? "female" : sex === "M" ? "male" : "not set"}
          {res.skeletalClass ? `, skeletal Class ${res.skeletalClass} (ANB ${res.anb.toFixed(1)}°)` : ""}.
          {age === null && " Age chooses the measures and references; add it in the session details."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {FILM_FIELDS.map(f => (
            <label key={f.key} style={{ fontSize: 12, color: t.tx2, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              {f.label}
              <select value={film?.[f.key] || ""} onChange={e => onUpdateFilm({ ...(film || {}), [f.key]: e.target.value })}
                style={{ padding: "4px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: t.surf3, color: t.tx, fontSize: 12, fontFamily: "inherit", minWidth: 0, width: "100%" }}>
                <option value="">Not recorded</option>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      {/* ─── 2. Landmarks ─── */}
      <section>
        <SectionTitle t={t} step={2} done={!missingLandmarks.length}>Landmarks</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {needs.landmarks.map(id => {
            const placed = Boolean(findLandmark(markups, id));
            return (
              <button key={id} type="button" title={AIRWAY_LANDMARKS[id].def} onClick={() => actions.placeLandmarks([id])}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontFamily: "inherit", border: `1px solid ${placed ? t.ok + "55" : t.bdr}`, background: placed ? t.ok + "12" : "transparent", color: placed ? t.tx : t.tx2 }}>
                {placed && <Icon name="check" size={12} color={t.ok} />}
                {AIRWAY_LANDMARKS[id].label}
              </button>
            );
          })}
        </div>
        {missingLandmarks.length > 0 && (
          <Btn t={t} small onClick={() => actions.placeLandmarks(missingLandmarks)} style={{ marginTop: 6, width: "100%" }}>
            Place {missingLandmarks.length} missing landmark{missingLandmarks.length === 1 ? "" : "s"}
          </Btn>
        )}
      </section>

      {/* ─── 3. Walls ─── */}
      <section>
        <SectionTitle t={t} step={3} done={wallsDone}>Trace the walls</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {wallRows.map(w => {
            const traced = Boolean(findWall(markups, w.id));
            const active = traceRole === w.id;
            return (
              <div key={w.id} style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${active ? t.acc : t.bdr}`, background: t.surf2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {traced && <Icon name="check" size={14} color={t.ok} />}
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.tx }}>{w.label}{w.optional ? " (optional)" : ""}</span>
                  <Btn t={t} small onClick={() => actions.traceWall(w.id)} style={SMALL_BTN}>{traced ? "Retrace" : "Trace"}</Btn>
                  {traced && w.id !== "adenoid" && <Btn t={t} small onClick={() => suggest(w.id)} style={SMALL_BTN}>Suggest</Btn>}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.45, color: t.tx3 }}>
                  {active ? "Click along the wall on the image, then double-click to finish." : w.help}
                </div>
                {suggestion?.role === w.id && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.bdr}` }}>
                    <div style={{ fontSize: 12, lineHeight: 1.45, color: t.tx2 }}>
                      Suggested wall shown dashed. An edge was found along {Math.round(suggestion.foundFraction * 100)}% of the trace, on average {suggestion.meanShift.toFixed(1)} px from it. Check it against the film.
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <Btn t={t} small active onClick={() => actions.acceptSuggestion()} style={SMALL_BTN}>Use suggestion</Btn>
                      <Btn t={t} small onClick={() => actions.discardSuggestion()} style={SMALL_BTN}>Keep my trace</Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {notice && <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, color: t.warn }}>{notice}</div>}
      </section>

      {/* ─── 4. Results ─── */}
      <section>
        <SectionTitle t={t} step={4} done={measured > 0}>Results</SectionTitle>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: t.tx, cursor: "pointer" }}>
          <input type="checkbox" checked={showOverlay} onChange={onToggleOverlay} style={{ accentColor: t.acc, margin: 0 }} />
          Show measurements on the image
        </label>
        {res.pattern && (
          <div style={{ padding: "8px 10px", marginBottom: 8, borderRadius: 6, background: t.warn + "18", border: `1px solid ${t.warn}44`, fontSize: 12, lineHeight: 1.5, color: t.tx }}>{res.pattern.text}</div>
        )}
        {[...res.cues, ...(res.swallowNote ? [{ id: "swallow", text: res.swallowNote }] : [])].map(c => (
          <div key={c.id} style={{ padding: "6px 8px", marginBottom: 8, borderRadius: 6, background: t.surf3, fontSize: 12, lineHeight: 1.5, color: t.tx2 }}>{c.text}</div>
        ))}
        {regions.map(r => (
          <div key={r.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>{r.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {r.rows.map(m => <ResultRow key={m.id} t={t} m={m} />)}
            </div>
          </div>
        ))}
      </section>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
