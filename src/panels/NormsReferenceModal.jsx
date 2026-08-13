import { useState, useRef, useMemo } from "react";
import { DEFAULT_NORMS } from "../data/norms.js";
import { addPreset, exportLibraryJSON, exportPresetJSON, exportPresetCSV, importLibraryJSON, importPresetCSV, validatePreset } from "../data/normLibrary.js";
import { fetchCommunityNorms, installPreset, getContributionURL, getRepoURL } from "../data/communityNorms.js";
import { Btn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// NORMS REFERENCE GALLERY MODAL — Browse presets + manage personal library
// ═══════════════════════════════════════════════════════════════════════════════
const _emptyPreset = () => ({ name: "", source: "", population: "", ageRange: "", sex: "", stratification: "", norms: [{ label: "", mean: 0, sd: 1, type: "angle" }] });

export function NormsReferenceModal({ t, onAdd, onClose, userPresets, onSavePreset, onDeletePreset }) {
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [guideKey, setGuideKey] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  const [editErrors, setEditErrors] = useState([]);
  const [importError, setImportError] = useState(null);
  const jsonRef = useRef(null);
  const csvRef = useRef(null);
  const query = search.toLowerCase();

  const [communityPresets, setCommunityPresets] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState(null);
  const [communityUpdated, setCommunityUpdated] = useState(null);
  const installedNames = useMemo(() => new Set((userPresets || []).map(p => p.name?.toLowerCase())), [userPresets]);
  const communityFetched = useRef(false);

  function fetchCommunity(force) {
    if (!force && communityFetched.current) return;
    communityFetched.current = true;
    setCommunityLoading(true);
    fetchCommunityNorms(force).then(result => {
      setCommunityLoading(false);
      if (result.ok) { setCommunityPresets(result.presets); setCommunityUpdated(result.updated); setCommunityError(null); }
      else setCommunityError(result.error);
    });
  }

  const allBuiltIn = useMemo(() => Object.entries(DEFAULT_NORMS).map(([key, p]) => ({ key, ...p, builtIn: true })), []);
  const allUser = useMemo(() => (userPresets || []).map(p => ({ key: p.id, ...p, builtIn: false })), [userPresets]);
  const allPresets = useMemo(() => [...allBuiltIn, ...allUser], [allBuiltIn, allUser]);

  const filteredPresets = useMemo(() => {
    if (!query) return allPresets;
    return allPresets.filter(p => p.name?.toLowerCase().includes(query) || p.source?.toLowerCase().includes(query) || p.norms?.some(n => n.label?.toLowerCase().includes(query)));
  }, [allPresets, query]);

  function handleImportJSON(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importLibraryJSON(reader.result, userPresets || []);
      if (result.ok) { result.newPresets.forEach(p => onSavePreset(p, "add")); setTab("library"); setImportError(null); }
      else setImportError(result.errors.join("\n"));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleImportCSV(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importPresetCSV(reader.result);
      if (result.ok) { setEditingPreset({ ..._emptyPreset(), ...result.preset, name: file.name.replace(/\.csv$/i, "") }); setTab("editor"); setImportError(null); }
      else setImportError(result.errors.join("\n"));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function downloadJSON(text, filename) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function handleSavePreset() {
    const errs = validatePreset(editingPreset); setEditErrors(errs);
    if (errs.length > 0) return;
    if (editingPreset.id) { onSavePreset({ id: editingPreset.id, ...editingPreset }, "update"); }
    else { const result = addPreset(editingPreset); if (result.ok) onSavePreset(result.preset, "add"); }
    setEditingPreset(null); setEditErrors([]);
  }

  function PresetTable({ preset, source, onAddOne, onAddAll, builtIn, onEdit, onDelete, onExportJSON, onExportCSV }) {
    return (
      <div style={{ marginBottom: 14, border: `1px solid ${t.bdr}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: builtIn ? t.acc : t.ok }}>{preset.name || "?"}</span>
            {!builtIn && <span style={{ fontSize: 8, color: t.ok, marginLeft: 4, background: t.ok + "22", borderRadius: 3, padding: "0 4px", fontWeight: 700 }}>MY</span>}
            <span style={{ fontSize: 10, color: t.tx3, marginLeft: 8 }}>{source || preset.source}</span>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            {onAddAll && <button onClick={onAddAll} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: t.acc + "22", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 700 }}>Add All ({preset.norms.length})</button>}
            {!builtIn && <>
              <button onClick={onEdit} style={{ padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, cursor: "pointer", fontSize: 9 }} title="Edit">Edit</button>
              <button onClick={onDelete} style={{ padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.err}55`, background: "transparent", color: t.err, cursor: "pointer", fontSize: 9 }} title="Delete">Del</button>
            </>}
            <button onClick={onExportJSON} style={{ padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer", fontSize: 9 }} title="Export JSON">JSON</button>
            <button onClick={onExportCSV} style={{ padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer", fontSize: 9 }} title="Export CSV">CSV</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${t.bdr}44`, background: t.surf3 }}>
              <th style={{ textAlign: "left", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Label</th>
              <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Mean</th>
              <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>SD</th>
              <th style={{ textAlign: "center", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Type</th>
              {onAddOne && <th style={{ textAlign: "right", padding: "5px 10px" }}></th>}
            </tr></thead>
            <tbody>
              {preset.norms.map((n, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}33` }}>
                  <td style={{ padding: "5px 10px", color: t.tx, fontWeight: 600, whiteSpace: "nowrap" }}>{n.label}</td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx }}>{Number(n.mean).toFixed(1)}</td>
                  <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx3 }}>&plusmn; {Number(n.sd).toFixed(1)}</td>
                  <td style={{ padding: "5px 10px", textAlign: "center" }}><span style={{ background: (n.type === "angle" ? t.warn : t.ok) + "22", color: n.type === "angle" ? t.warn : t.ok, borderRadius: 3, padding: "1px 5px", fontSize: 8, fontWeight: 700 }}>{n.type}</span></td>
                  {onAddOne && <td style={{ padding: "5px 10px", textAlign: "right" }}><button onClick={() => onAddOne(n.label, n.mean, n.sd, n.type, source || preset.source)} style={{ padding: "2px 7px", borderRadius: 4, border: `1px solid ${t.acc}55`, background: "transparent", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 600 }}>+ Add</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const builtInCount = allBuiltIn.reduce((s, p) => s + (p.norms?.length || 0), 0);
  const userCount = allUser.reduce((s, p) => s + (p.norms?.length || 0), 0);

  if (editingPreset) {
    const p = editingPreset;
    function updPatch(patch) { setEditingPreset(prev => ({ ...prev, ...patch })); }
    function updNorm(i, field, val) { setEditingPreset(prev => { const norms = [...prev.norms]; norms[i] = { ...norms[i], [field]: val }; return { ...prev, norms }; }); }
    function addNorm() { setEditingPreset(prev => ({ ...prev, norms: [...prev.norms, { label: "", mean: 0, sd: 1, type: "angle" }] })); }
    function removeNorm(i) { setEditingPreset(prev => ({ ...prev, norms: prev.norms.filter((_, j) => j !== i) })); }
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }} onClick={() => { setEditingPreset(null); setEditErrors([]); }}>
        <div style={{ background: t.bg, border: `1px solid ${t.bdr}`, borderRadius: 12, width: "min(90vw, 640px)", maxHeight: "min(90vh, 700px)", display: "flex", flexDirection: "column", boxShadow: `0 24px 64px ${t.shadow}50` }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.acc, marginBottom: 10 }}>{p.id ? "Edit Preset" : "New Preset"}</div>
            {editErrors.length > 0 && <div style={{ background: t.err + "22", border: `1px solid ${t.err}44`, borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 10, color: t.err, whiteSpace: "pre-wrap" }}>{editErrors.join("\n")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Preset Name *</div><input value={p.name} onChange={e => updPatch({ name: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }} placeholder="e.g. Harvold (Norwegian)" /></div>
              <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Source / Citation</div><input value={p.source} onChange={e => updPatch({ source: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }} placeholder="e.g. Harvold, 1974" /></div>
              <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Population</div><input value={p.population} onChange={e => updPatch({ population: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }} placeholder="e.g. Norwegian" /></div>
              <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Age Range</div><input value={p.ageRange} onChange={e => updPatch({ ageRange: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }} placeholder="e.g. Adult / Mixed / 12-17y" /></div>
              <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Sex</div><input value={p.sex} onChange={e => updPatch({ sex: e.target.value })} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11 }} placeholder="e.g. Pooled / Male / Female" /></div>
              <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Stratification Notes</div><textarea value={p.stratification} onChange={e => updPatch({ stratification: e.target.value })} rows={2} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${t.bdr}`, borderRadius: 4, background: t.surf3, color: t.tx, fontSize: 11, resize: "vertical", fontFamily: "inherit" }} placeholder="Notes about age/sex/ethnic stratification" /></div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Norms ({p.norms.length})</span>
              <button onClick={addNorm} style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${t.acc}55`, background: t.acc + "22", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 700 }}>+ Add Norm</button>
            </div>
            <div style={{ border: `1px solid ${t.bdr}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: t.surf3, borderBottom: `1px solid ${t.bdr}` }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: t.tx2, fontWeight: 600 }}>Label</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx2, fontWeight: 600, width: 60 }}>Mean</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: t.tx2, fontWeight: 600, width: 50 }}>SD</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", color: t.tx2, fontWeight: 600, width: 65 }}>Type</th>
                  <th style={{ width: 24 }}></th>
                </tr></thead>
                <tbody>
                  {p.norms.map((n, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${t.bdr}33` }}>
                      <td style={{ padding: 2 }}><input value={n.label} onChange={e => updNorm(i, "label", e.target.value)} style={{ width: "100%", padding: "3px 5px", border: `1px solid transparent`, borderRadius: 3, background: "transparent", color: t.tx, fontSize: 10, fontWeight: 600 }} placeholder="Label" /></td>
                      <td style={{ padding: 2 }}><input type="number" value={n.mean} onChange={e => updNorm(i, "mean", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "3px 5px", border: `1px solid transparent`, borderRadius: 3, background: "transparent", color: t.tx, fontSize: 10, textAlign: "right", fontFamily: "'DM Mono',monospace" }} /></td>
                      <td style={{ padding: 2 }}><input type="number" value={n.sd} onChange={e => updNorm(i, "sd", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "3px 5px", border: `1px solid transparent`, borderRadius: 3, background: "transparent", color: t.tx, fontSize: 10, textAlign: "right", fontFamily: "'DM Mono',monospace" }} step="0.1" min="0" /></td>
                      <td style={{ padding: 2, textAlign: "center" }}><select value={n.type} onChange={e => updNorm(i, "type", e.target.value)} style={{ padding: "2px 4px", border: `1px solid transparent`, borderRadius: 3, background: "transparent", color: t.tx, fontSize: 9 }}>{["angle", "length", "area", "ratio", "value"].map(tp => <option key={tp} value={tp}>{tp}</option>)}</select></td>
                      <td style={{ padding: 2, textAlign: "center" }}><button onClick={() => removeNorm(i)} style={{ background: "none", border: "none", color: t.err, cursor: "pointer", fontSize: 12, padding: "0 3px" }} title="Remove">&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <Btn t={t} small onClick={handleSavePreset} style={{ flex: 1 }}>Save Preset</Btn>
              <Btn t={t} small onClick={() => { setEditingPreset(null); setEditErrors([]); }} style={{ flex: 1 }}>Cancel</Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: t.bg, border: `1px solid ${t.bdr}`, borderRadius: 12, width: "min(90vw, 680px)", maxHeight: "min(90vh, 720px)", display: "flex", flexDirection: "column", boxShadow: `0 24px 64px ${t.shadow}50` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${t.bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>&#x1F4D6;</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.tx, flex: 1 }}>Norms Reference
            <button onClick={() => setGuideKey("norms")} style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0, marginLeft: 6, verticalAlign: "middle" }} title="Guide">?</button>
          </span>
          <span style={{ fontSize: 10, color: t.tx3, fontFamily: "'DM Mono',monospace" }}>{builtInCount} built-in{userCount > 0 ? ` + ${userCount} custom` : ""}{communityPresets.length > 0 ? ` + ${communityPresets.length} community` : ""}</span>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>&times;</button>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.bdr}`, flexShrink: 0 }}>
          {[{ id: "browse", label: "Browse" }, { id: "community", label: "Community" }, { id: "library", label: "My Library" }].map(tb => (
            <button key={tb.id} onClick={() => { setTab(tb.id); setEditingPreset(null); setImportError(null); if (tb.id === "community") fetchCommunity(false); }} style={{ flex: 1, padding: "8px 12px", background: tab === tb.id ? t.surf2 : "transparent", border: "none", borderBottom: tab === tb.id ? `2px solid ${t.acc}` : "2px solid transparent", color: tab === tb.id ? t.acc : t.tx3, fontSize: 11, fontWeight: tab === tb.id ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>{tb.label}{tb.id === "library" && userCount > 0 ? ` (${allUser.length})` : ""}{tb.id === "community" && communityPresets.length > 0 ? ` (${communityPresets.length})` : ""}</button>
          ))}
        </div>
        {/* Search (browse only) */}
        {tab === "browse" && <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.bdr}44`, flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, source, or measurement..." style={{ width: "85%", padding: "8px 10px", border: `1px solid ${t.bdr}`, borderRadius: 8, background: t.surf3, color: t.tx, fontSize: 12, outline: "none" }} />
        </div>}
        {/* Import error */}
        {importError && <div style={{ margin: "8px 16px 0", padding: "6px 10px", background: t.err + "22", border: `1px solid ${t.err}44`, borderRadius: 6, fontSize: 10, color: t.err, whiteSpace: "pre-wrap" }}>{importError}<button onClick={() => setImportError(null)} style={{ marginLeft: 8, background: "none", border: "none", color: t.err, cursor: "pointer" }}>&times;</button></div>}
        {/* Browse tab */}
        {tab === "browse" && <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {filteredPresets.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: t.tx3, fontSize: 12 }}>No presets match your search.</div>
          ) : filteredPresets.map(p => (
            <PresetTable key={p.key} preset={p} source={p.source} builtIn={p.builtIn}
              onAddOne={(label, mean, sd, type, source) => { const existing = []; if (onAdd.__norms) existing.push(...onAdd.__norms); if (!existing.some(e => e.markupLabel === label && e.measureType === type)) onAdd(label, mean, sd, type, source); }}
              onAddAll={() => p.norms.forEach(n => onAdd(n.label, n.mean, n.sd, n.type, p.source))}
              {...(!p.builtIn ? { onEdit: () => setEditingPreset({ ...p }), onDelete: () => { if (window.confirm(`Delete "${p.name}" from your library?`)) onDeletePreset(p.id); } } : {})}
              onExportJSON={() => downloadJSON(exportPresetJSON(p), `${p.name.replace(/\s+/g, "_")}.json`)}
              onExportCSV={() => downloadJSON(exportPresetCSV(p), `${p.name.replace(/\s+/g, "_")}.csv`)}
            />
          ))}
        </div>}
        {/* Community tab */}
        {tab === "community" && <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <Btn t={t} small onClick={() => fetchCommunity(true)} disabled={communityLoading}>
              {communityLoading ? "Loading..." : "Refresh"}
            </Btn>
            <span style={{ fontSize: 10, color: t.tx3, flex: 1 }}>{communityUpdated ? `Updated: ${new Date(communityUpdated).toLocaleDateString()}` : ""}</span>
            <button onClick={() => window.open(getContributionURL(), "_blank")} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${t.ok}55`, background: t.ok + "11", color: t.ok, cursor: "pointer", fontSize: 9, fontWeight: 600 }}>Contribute Preset</button>
            <button onClick={() => window.open(getRepoURL(), "_blank")} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx3, cursor: "pointer", fontSize: 9 }}>Repo</button>
          </div>
          {communityError && <div style={{ marginBottom: 10, padding: "6px 10px", background: t.err + "22", border: `1px solid ${t.err}44`, borderRadius: 6, fontSize: 10, color: t.err }}>{communityError}</div>}
          {communityLoading && communityPresets.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: t.tx3, fontSize: 12 }}>Fetching community presets...</div>
          )}
          {!communityLoading && communityPresets.length === 0 && !communityError && (
            <div style={{ textAlign: "center", padding: 40, color: t.tx3, fontSize: 12 }}>
              <div style={{ marginBottom: 8, fontSize: 20 }}>&#x1F310;</div>
              No community presets available yet.<br />
              <a href={getContributionURL()} target="_blank" rel="noreferrer" style={{ color: t.acc, fontSize: 11 }}>Contribute the first one</a>
            </div>
          )}
          {communityPresets.map((cp, i) => {
            const isInstalled = installedNames.has(cp.name?.toLowerCase());
            return (
              <div key={i} style={{ marginBottom: 14, border: `1px solid ${t.bdr}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: t.surf2, borderBottom: `1px solid ${t.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.acc }}>{cp.name}</span>
                    <span style={{ fontSize: 8, color: t.ok, marginLeft: 4, background: t.ok + "22", borderRadius: 3, padding: "0 4px", fontWeight: 700 }}>COMMUNITY</span>
                    <span style={{ fontSize: 10, color: t.tx3, marginLeft: 8 }}>{cp.source}</span>
                    {cp.contributor && <span style={{ fontSize: 9, color: t.tx3, marginLeft: 4 }}>&middot; {cp.contributor}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                    {isInstalled ? (
                      <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, color: t.ok, background: t.ok + "22" }}>Installed</span>
                    ) : (
                      <button onClick={() => { const result = installPreset(cp, userPresets); if (result.ok) onSavePreset(result.preset, "add"); }} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: t.acc + "22", color: t.acc, cursor: "pointer", fontSize: 9, fontWeight: 700 }}>Install ({cp.norms?.length || 0})</button>
                    )}
                  </div>
                </div>
                {cp.norms && cp.norms.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                      <thead><tr style={{ borderBottom: `1px solid ${t.bdr}44`, background: t.surf3 }}>
                        <th style={{ textAlign: "left", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Label</th>
                        <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Mean</th>
                        <th style={{ textAlign: "right", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>SD</th>
                        <th style={{ textAlign: "center", padding: "5px 10px", color: t.tx2, fontWeight: 600 }}>Type</th>
                      </tr></thead>
                      <tbody>
                        {cp.norms.map((n, j) => (
                          <tr key={j} style={{ borderBottom: `1px solid ${t.bdr}33` }}>
                            <td style={{ padding: "5px 10px", color: t.tx, fontWeight: 600, whiteSpace: "nowrap" }}>{n.label}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx }}>{Number(n.mean).toFixed(1)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: t.tx3 }}>&plusmn; {Number(n.sd).toFixed(1)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "center" }}><span style={{ background: (n.type === "angle" ? t.warn : t.ok) + "22", color: n.type === "angle" ? t.warn : t.ok, borderRadius: 3, padding: "1px 5px", fontSize: 8, fontWeight: 700 }}>{n.type}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>}
        {/* Library tab */}
        {tab === "library" && <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Btn t={t} small onClick={() => setEditingPreset(_emptyPreset())} style={{ flex: 1 }}>+ New Preset</Btn>
            <Btn t={t} small onClick={() => jsonRef.current?.click()}>Import JSON</Btn>
            <Btn t={t} small onClick={() => csvRef.current?.click()}>Import CSV</Btn>
            {allUser.length > 0 && <Btn t={t} small onClick={() => downloadJSON(exportLibraryJSON(allUser), "norm_library.json")}>Export All</Btn>}
            <input ref={jsonRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: "none" }} />
            <input ref={csvRef} type="file" accept=".csv" onChange={handleImportCSV} style={{ display: "none" }} />
          </div>
          {allUser.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: t.tx3, fontSize: 12 }}>
              <div style={{ marginBottom: 8, fontSize: 20 }}>&#x1F4E6;</div>
              No custom presets yet.<br />Create one or import from a JSON/CSV file.
            </div>
          ) : allUser.map(p => (
            <PresetTable key={p.id} preset={p} source={p.source} builtIn={false}
              onAddOne={(label, mean, sd, type, source) => { const existing = []; if (onAdd.__norms) existing.push(...onAdd.__norms); if (!existing.some(e => e.markupLabel === label && e.measureType === type)) onAdd(label, mean, sd, type, source); }}
              onAddAll={() => p.norms.forEach(n => onAdd(n.label, n.mean, n.sd, n.type, p.source))}
              onEdit={() => setEditingPreset({ ...p })}
              onDelete={() => { if (window.confirm(`Delete "${p.name}" from your library?`)) onDeletePreset(p.id); }}
              onExportJSON={() => downloadJSON(exportPresetJSON(p), `${p.name.replace(/\s+/g, "_")}.json`)}
              onExportCSV={() => downloadJSON(exportPresetCSV(p), `${p.name.replace(/\s+/g, "_")}.csv`)}
            />
          ))}
        </div>}
        {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
      </div>
    </div>
  );
}
