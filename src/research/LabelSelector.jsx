import { Chip } from "../ui/ui.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL SELECTOR — choose the measurements a study uses (none chosen = all).
// Shared by every study type's setup.
// ═══════════════════════════════════════════════════════════════════════════════
export function LabelSelector({ sessions, selected, onToggle, t }) {
  const labels = [...new Set((sessions || []).flatMap(s =>
    (s.markups || []).filter(m => m.label && m.type !== "ruler" && m.type !== "silhouette").map(m => m.label)
  ))].sort();
  if (labels.length === 0) return <div style={{ fontSize: 13, color: t.tx3 }}>No labelled markups found.</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {selected.length === 0
        ? <span style={{ fontSize: 12, color: t.tx3 }}>All {labels.length} (pick some to narrow down)</span>
        : <Chip t={t} onClick={() => labels.forEach(l => { if (selected.includes(l)) onToggle(l); })} style={{ color: t.tx3 }}>Clear ({selected.length})</Chip>}
      {labels.map(l => (
        <Chip key={l} t={t} mono on={selected.includes(l)} onClick={() => onToggle(l)}>{l}</Chip>
      ))}
    </div>
  );
}
