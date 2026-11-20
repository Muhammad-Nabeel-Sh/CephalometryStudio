import { Chip } from "../ui/ui.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL SELECTOR — choose the measurements a study uses (none chosen = all).
// Shared by every study type's setup.
// ═══════════════════════════════════════════════════════════════════════════════
// `kind`: "all" (default), "measurements" (no landmarks) or "landmarks" (points only).
// `emptyMeansAll`: whether nothing selected means every label (measurements) or none.
export function LabelSelector({ sessions, selected, onToggle, t, kind = "all", emptyMeansAll = true, onSelectAll }) {
  const keep = m => m.label && m.type !== "ruler" && m.type !== "silhouette"
    && (kind === "landmarks" ? m.type === "point" : kind === "measurements" ? m.type !== "point" : true);
  const labels = [...new Set((sessions || []).flatMap(s => (s.markups || []).filter(keep).map(m => m.label)))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 13, color: t.tx3 }}>{kind === "landmarks" ? "No landmarks placed in these sessions." : kind === "measurements" ? "No measurements in these sessions." : "No labelled markups found."}</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {selected.length === 0
        ? (emptyMeansAll
          ? <span style={{ fontSize: 12, color: t.tx3 }}>All {labels.length} (pick some to narrow down)</span>
          : onSelectAll && <Chip t={t} onClick={() => onSelectAll(labels)} style={{ color: t.tx3 }}>Select all {labels.length}</Chip>)
        : <Chip t={t} onClick={() => labels.forEach(l => { if (selected.includes(l)) onToggle(l); })} style={{ color: t.tx3 }}>Clear ({selected.length})</Chip>}
      {labels.map(l => (
        <Chip key={l} t={t} mono on={selected.includes(l)} onClick={() => onToggle(l)}>{l}</Chip>
      ))}
    </div>
  );
}
