import { GuideBtn } from "../ui/ui.jsx";
import { useState, useMemo } from "react";
import { SILHOUETTES, getSilhouettesByCategory } from "../data/silhouettes.js";
import PanelGuideModal from "./PanelGuideModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// SILHOUETTES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function SilhouettesPanel({ t, onInsert }) {
  const grouped = useMemo(() => getSilhouettesByCategory(), []);
  const categories = Object.keys(grouped);
  const [search, setSearch] = useState("");
  const [guideKey, setGuideKey] = useState(null);

  const allSilhouettes = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(SILHOUETTES).filter(([key, s]) =>
      !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || key.toLowerCase().includes(q)
    );
  }, [search]);

  const renderThumbnail = (key, s, size = 80) => {
    const sc = 1;
    const cx = size / 2, cy = size / 2;
    const fill = s.color + "33";
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <rect width={size} height={size} fill={t.surf3} rx={4} />
        {s.paths.map((p, i) => {
          const d = p.points.map((pt, idx) => {
            const px = cx + pt.x * sc * 40;
            const py = cy + pt.y * sc * 40;
            return `${idx === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
          }).join(" ") + (p.closed ? "Z" : "");
          return <path key={i} d={d} fill={p.closed ? fill : "none"} stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" />;
        })}
      </svg>
    );
  };

  const hasFullTracing = allSilhouettes.some(([k]) => k === "fullTracing");
  const hasFullTracingWithDentition = allSilhouettes.some(([k]) => k === "fullTracingWithDentition");

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 11, color: t.tx2, lineHeight: 1.5 }}>
          Click a silhouette to place it on the canvas. Use handles to resize and rotate.
        </div>
        <GuideBtn t={t} onClick={() => setGuideKey("silhouettes")} />
      </div>
      {(hasFullTracing || hasFullTracingWithDentition) && !search && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {hasFullTracing && (
            <button key="fullTracing" onClick={() => onInsert("fullTracing")}
              style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>
              Full Tracing
            </button>
          )}
          {hasFullTracingWithDentition && (
            <button key="fullTracingWithDentition" onClick={() => onInsert("fullTracingWithDentition")}
              style={{ flex: 1, padding: "14px 8px", borderRadius: 10, border: `1.5px solid ${t.acc}`, background: t.acc + "15", cursor: "pointer", outline: "none", transition: "all 0.15s", fontSize: 12, fontWeight: 600, color: t.tx, textAlign: "center", lineHeight: 1.3 }}>
              With Dentition
            </button>
          )}
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search silhouettes..." style={{ width: "100%", padding: "7px 10px", border: `1px solid ${t.bdr}`, borderRadius: 6, background: t.surf3, color: t.tx, fontSize: 12, outline: "none", marginBottom: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
      {allSilhouettes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: t.tx3, fontSize: 12 }}>No silhouettes match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map(cat => {
            const items = allSilhouettes.filter(([k]) => grouped[cat]?.some(g => g.key === k));
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.acc, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                  {items.map(([key, s]) => (
                    <button key={key} onClick={() => onInsert(key)}
                      style={{ padding: 8, borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.15s", outline: "none" }}>
                      {renderThumbnail(key, s, 70)}
                      <span style={{ fontSize: 9, color: t.tx2, textAlign: "center", lineHeight: 1.3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
