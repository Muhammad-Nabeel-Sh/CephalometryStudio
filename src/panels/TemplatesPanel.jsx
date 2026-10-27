import { useState, useRef } from "react";
import { onEnter } from "../lib/utils.js";
import { logWarn } from "../lib/logger.js";
import { PREDEFINED } from "../data/constants.js";
import { Btn, GuideBtn, RemoveBtn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { askConfirm, notify } from "../ui/dialogs.js";
import { Icon } from "../ui/icons.jsx";
import { SMALL_BTN } from "../ui/tokens.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "ceph_imported_templates";
function loadImportedTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveImportedTemplates(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e) { logWarn("Failed to save templates:", e); }
}

function measTypeLabel(type) {
  const map = { line: "Line", angle3: "Angle", angle4: "Angle", perp: "Perp", polygon: "Polygon", ratio: "Ratio", sum: "Sum", difference: "Diff", percentage: "Pct", projDist: "Dist", ellipse: "Ellipse", arc: "Arc", circle: "Circle", bezier: "Length", tangent: "Length", concentric: "Concentric" };
  return map[type] || type;
}

export function TemplatesPanel({ t, projection, onLoadTemplate, onImportCepht }) {
  let allTemplates = PREDEFINED[projection] || [];
  const [guideKey, setGuideKey] = useState(null);
  if (projection === "other") {
    const subKeys = ["smv", "opg", "handwrist", "photolateral", "photofrontal"];
    subKeys.forEach(key => {
      if (PREDEFINED[key]) allTemplates = allTemplates.concat(PREDEFINED[key]);
    });
  }
  const uniqueTemplates = allTemplates.filter((tmpl, idx, self) => idx === self.findIndex(t => t.name === tmpl.name));
  const [importedTemplates, setImportedTemplates] = useState(loadImportedTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState(null);
  const cephtInputRef = useRef(null);

  const handleImport = (data) => {
    onImportCepht(data);
    const exists = importedTemplates.some(t => t.name === data.name);
    if (data.name && !exists) {
      const updated = [...importedTemplates, { name: data.name, projection: data.projection || projection, markups: data.markups, formulas: data.formulas, norms: data.norms }];
      setImportedTemplates(updated);
      saveImportedTemplates(updated);
    }
  };

  const deleteImported = (name) => {
    const updated = importedTemplates.filter(t => t.name !== name);
    setImportedTemplates(updated);
    saveImportedTemplates(updated);
    if (selectedTemplate?.name === name) setSelectedTemplate(null);
  };

  const handleLoad = (tmpl, e) => {
    e?.stopPropagation();
    if (editMode && selectedLabels) {
      const filtered = { ...tmpl, pts: tmpl.pts?.filter(pt => selectedLabels.has(pt.l)) || [] };
      onLoadTemplate(filtered);
      setEditMode(false);
      setSelectedLabels(null);
    } else {
      onLoadTemplate(tmpl);
    }
  };

  const toggleLabel = (label) => {
    setSelectedLabels(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const sections = [];
  if (selectedTemplate) {
    if (selectedTemplate.pts?.length > 0) sections.push({ type: "Landmarks", icon: "◉", items: selectedTemplate.pts.map(pt => ({ label: pt.l, def: pt.def, color: pt.color, type: "point" })) });
    if (selectedTemplate.lines?.length > 0) sections.push({ type: "Lines", icon: "⟋", items: selectedTemplate.lines.map(ln => ({ label: ln.l, def: ln.def, color: ln.color, type: "line" })) });
    if (selectedTemplate.angles?.length > 0) sections.push({ type: "Angles", icon: "∠", items: selectedTemplate.angles.map(ang => ({ label: ang.l, def: ang.def, color: ang.color, type: "angle" })) });
    if (selectedTemplate.distances?.length > 0) sections.push({ type: "Distances", icon: "↔", items: selectedTemplate.distances.map(dist => ({ label: dist.l, def: dist.def, color: dist.color, type: "distance" })) });
    if (selectedTemplate.planes?.length > 0) sections.push({ type: "Planes", icon: "▭", items: selectedTemplate.planes.map(pl => ({ label: pl.l, def: pl.def, color: pl.color, type: "plane" })) });
    if (selectedTemplate.projections?.length > 0) sections.push({ type: "Projections", icon: "▦", items: selectedTemplate.projections.map(p => ({ label: p.name, def: p.def, color: p.color, type: "projection" })) });
    if (selectedTemplate.markups?.length > 0) sections.push({ type: "Imported Items", icon: <Icon name="clipboard" size={14} />, items: selectedTemplate.markups.map(m => ({ label: m.label || m.type, def: m.definition || "", color: m.color || t.tx3, type: m.type })) });
    if (selectedTemplate.measurements?.length > 0) sections.push({
      type: "Measurements", icon: <Icon name="ruler" size={14} />,
      items: selectedTemplate.measurements.map(m => ({
        label: m.l,
        def: m.def || measTypeLabel(m.type),
        color: m.color || t.acc,
        type: m.type,
        refs: m.pts?.join(", "),
        norm: m.norm ? `${m.norm.mean}±${m.norm.sd}` : null,
      }))
    });
  }

  if (selectedTemplate) {
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    const displayName = selectedTemplate.name || selectedTemplate.group;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.bdr}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={() => { setSelectedTemplate(null); setEditMode(false); setSelectedLabels(null); }} title="Back to templates" style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 18, padding: 4, display: "flex", alignItems: "center" }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ fontSize: 12, color: t.tx2 }}>{totalItems} item{totalItems !== 1 ? "s" : ""}</div>
          </div>
          {selectedTemplate.pts && <>{
            editMode ? (
              <Btn t={t} small onClick={() => { setEditMode(false); setSelectedLabels(null); }} style={SMALL_BTN}>Cancel</Btn>
            ) : (
              <Btn t={t} small onClick={(e) => { e.stopPropagation(); setEditMode(true); setSelectedLabels(new Set(selectedTemplate.pts.map(pt => pt.l))); }} style={SMALL_BTN}>Edit</Btn>
            )
          }</>}
          {selectedTemplate.pts && <Btn t={t} small active onClick={(e) => handleLoad(selectedTemplate, e)} style={SMALL_BTN}>
            {editMode ? `Load ${selectedLabels?.size || 0} pts` : "Load"}
          </Btn>}
          {importedTemplates.some(t => t.name === selectedTemplate.name) && (
            <Btn t={t} small ghost danger title="Delete template" onClick={async (e) => { e.stopPropagation(); if (await askConfirm({ title: `Delete "${selectedTemplate.name}"?`, message: "The template is removed from your library.", confirmLabel: "Delete", danger: true })) deleteImported(selectedTemplate.name); }} style={{ ...SMALL_BTN, padding: "4px 6px" }}><Icon name="trash" size={15} /></Btn>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {totalItems === 0 && <div style={{ fontSize: 12, color: t.tx2, textAlign: "center", padding: "20px 0" }}>No details available for this template.</div>}
          {sections.map(sec => (
            <div key={sec.type} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: t.acc }}>{sec.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>{sec.type}</span>
                <span style={{ fontSize: 12, color: t.tx3, background: t.surf2, padding: "1px 6px", borderRadius: 4 }}>{sec.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec.items.map((item, i) => {
                  const canToggle = editMode && selectedLabels && selectedTemplate.pts?.some(pt => pt.l === item.label);
                  const isSelected = canToggle ? selectedLabels.has(item.label) : true;
                  return (
                    <div key={i} onClick={() => { if (canToggle) toggleLabel(item.label); }}
                      style={{ padding: 12, borderRadius: 8, background: t.surf2, border: `1px solid ${canToggle && !isSelected ? t.bdr : item.color || t.bdr}44`, cursor: canToggle ? "pointer" : "default", opacity: isSelected ? 1 : 0.45, transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {canToggle && <span style={{ fontSize: 12, color: isSelected ? t.acc : t.tx3, flexShrink: 0, lineHeight: 1 }}><Icon name={isSelected ? "checksquare" : "square"} size={14} /></span>}
                        <div style={{ width: 10, height: 10, borderRadius: item.type === "angle" || item.type === "angle3" || item.type === "angle4" ? "2px" : "50%", background: item.color || t.acc, flexShrink: 0 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "'DM Mono',monospace" }}>{item.label}</div>
                        {item.refs && <span style={{ fontSize: 12, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>({item.refs})</span>}
                        {item.norm && <span style={{ fontSize: 12, color: t.ok, background: t.ok + "18", padding: "1px 5px", borderRadius: 3, marginLeft: "auto" }}>norm {item.norm}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.5 }}>{item.def || "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <input type="file" ref={cephtInputRef} accept=".cepht" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file && onImportCepht) { const reader = new FileReader(); reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (data.format === "cepht") { handleImport(data); } else notify("This is not a valid .cepht template file.", { tone: "err" }); } catch { notify("Cannot parse file.", { tone: "err" }); } }; reader.readAsText(file); } e.target.value = ""; }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.45, flex: 1 }}>
          Browse cephalometric analysis templates. Click a template to view landmarks with definitions. Click <strong>Load</strong> to add points to your workspace.
        </div>
        <GuideBtn t={t} onClick={() => setGuideKey("templates")} style={{ marginRight: 6 }} />
        <Btn t={t} small onClick={() => cephtInputRef.current?.click()} style={{ ...SMALL_BTN, marginLeft: 8, flexShrink: 0 }}>Import .cepht</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {uniqueTemplates.map(tmpl => {
          const displayName = tmpl.name || tmpl.group;
          const totalPts = tmpl.pts?.length || tmpl.projections?.length || 0;
          const measCount = tmpl.measurements?.length || 0;
          return (
            <div key={displayName} role="button" tabIndex={0} onClick={() => setSelectedTemplate(tmpl)} onKeyDown={onEnter(() => setSelectedTemplate(tmpl))} style={{ padding: "12px", borderRadius: 8, background: t.surf2, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
                <div style={{ fontSize: 12, color: t.tx2 }}>{totalPts} pts{measCount ? ` · ${measCount} meas` : ""}</div>
              </div>
              {tmpl.pts && <Btn t={t} small active onClick={(e) => handleLoad(tmpl, e)} style={{ ...SMALL_BTN, flexShrink: 0 }}>Load</Btn>}
            </div>
          );
        })}
      </div>
      {importedTemplates.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx3, textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 0 8px" }}>Imported Templates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {importedTemplates.map(tmpl => (
              <div key={tmpl.name} role="button" tabIndex={0} onClick={() => setSelectedTemplate(tmpl)} onKeyDown={onEnter(() => setSelectedTemplate(tmpl))} style={{ padding: "10px 12px", borderRadius: 8, background: t.surf3, border: `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tmpl.name}</div>
                  <div style={{ fontSize: 12, color: t.tx3 }}>{tmpl.markups?.length || 0} items{tmpl.projection ? ` · ${tmpl.projection}` : ""}</div>
                </div>
                <RemoveBtn t={t} label="Remove template" onClick={(e) => { e.stopPropagation(); deleteImported(tmpl.name); }} />
              </div>
            ))}
          </div>
        </>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
