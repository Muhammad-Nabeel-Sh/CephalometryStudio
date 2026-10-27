import { useState, useRef, useMemo } from "react";
import { DEFAULT_NORMS } from "../data/norms.js";
import { addPreset, exportLibraryJSON, exportPresetJSON, exportPresetCSV, importLibraryJSON, importPresetCSV, validatePreset } from "../data/normLibrary.js";
import { fetchCommunityNorms, installPreset, getContributionURL, getRepoURL } from "../data/communityNorms.js";
import { Btn, GuideBtn, TabBar } from "../ui/ui.jsx";
import { SMALL_BTN } from "../ui/tokens.js";
import { DialogShell } from "./Modal.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { askConfirm } from "../ui/dialogs.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";

// ═══════════════════════════════════════════════════════════════════════════════
// NORMS REFERENCE GALLERY MODAL — Browse presets + manage personal library
// Styled like the app's other dialogs (ui Modal, Settings): surface panel,
// plain section headers, Btn actions, Settings-style inputs.
// ═══════════════════════════════════════════════════════════════════════════════
const _emptyPreset = () => ({ name: "", source: "", population: "", ageRange: "", sex: "", stratification: "", norms: [{ label: "", mean: 0, sd: 1, type: "angle" }] });

const MONO = "'DM Mono',monospace";
const inputStyle = t => ({ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, fontFamily: "inherit" });
const smallBtn = SMALL_BTN;

function Tag({ color, children }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}55`, borderRadius: 4, padding: "0 5px", lineHeight: "16px", whiteSpace: "nowrap" }}>{children}</span>;
}

function Empty({ t, children }) {
  return <div style={{ textAlign: "center", padding: "36px 16px", color: t.tx3, fontSize: 13, lineHeight: 1.6 }}>{children}</div>;
}

function Notice({ t, children, onDismiss }) {
  return (
    <div role="alert" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", border: `1px solid ${t.err}66`, borderRadius: 6, fontSize: 12, color: t.err, whiteSpace: "pre-wrap" }}>
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss" style={{ background: "none", border: "none", color: t.err, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>}
    </div>
  );
}

const th = (t, align = "left") => ({ textAlign: align, padding: "6px 12px", color: t.tx3, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${t.bdr}` });
const td = { padding: "6px 12px", fontSize: 13 };

function NormRows({ t, norms, onAddOne }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th(t)}>Measurement</th>
          <th style={th(t, "right")}>Mean</th>
          <th style={th(t, "right")}>SD</th>
          <th style={th(t, "center")}>Type</th>
          {onAddOne && <th style={th(t, "right")}><span style={{ position: "absolute", left: -9999 }}>Add</span></th>}
        </tr></thead>
        <tbody>
          {norms.map((n, i) => (
            <tr key={i} style={{ borderBottom: i < norms.length - 1 ? `1px solid ${t.bdr}66` : "none" }}>
              <td style={{ ...td, color: t.tx, fontWeight: 600, whiteSpace: "nowrap" }}>{n.label}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: t.tx }}>{Number(n.mean).toFixed(1)}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: MONO, color: t.tx2 }}>± {Number(n.sd).toFixed(1)}</td>
              <td style={{ ...td, textAlign: "center", color: t.tx2, fontSize: 12 }}>{n.type}</td>
              {onAddOne && <td style={{ ...td, textAlign: "right", padding: "3px 12px" }}>
                <Btn t={t} small ghost title={`Add the ${n.label} norm`} onClick={() => onAddOne(n)} style={{ ...smallBtn, color: t.acc }}>+ Add</Btn>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PresetCard({ t, title, tags, source, actions, children }) {
  return (
    <section style={{ marginBottom: 12, border: `1px solid ${t.bdr}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tx }}>{title || "Untitled"}</h3>
            {tags}
          </div>
          {source && <div style={{ fontSize: 12, color: t.tx3, marginTop: 2 }}>{source}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>{actions}</div>
      </div>
      {children}
    </section>
  );
}

export function NormsReferenceModal({ t, onAdd, onClose, userPresets, onSavePreset, onDeletePreset }) {
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [guideKey, setGuideKey] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  // Escape closes the preset editor first, then the reference dialog.
  const dialogRef = useDialogA11y(editingPreset ? () => setEditingPreset(null) : onClose);
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

  const allBuiltIn = useMemo(() => Object.entries(DEFAULT_NORMS).map(([key, p]) => ({ key, ...p, name: p.name || key, builtIn: true })), []);
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

  const addOne = (n, source) => {
    const existing = onAdd.__norms || [];
    if (!existing.some(e => e.markupLabel === n.label && e.measureType === n.type)) onAdd(n.label, n.mean, n.sd, n.type, source);
  };
  const deletePreset = async p => {
    if (await askConfirm({ title: `Delete "${p.name}"?`, message: "The preset is removed from your norm library.", confirmLabel: "Delete", danger: true })) onDeletePreset(p.id);
  };

  function renderPreset(p) {
    const file = (p.name || "preset").replace(/\s+/g, "_");
    return (
      <PresetCard key={p.key} t={t} title={p.name} source={[p.source, p.population].filter(Boolean).join(" · ")}
        tags={<>
          {!p.builtIn && <Tag color={t.ok}>My library</Tag>}
          {p.sdApproximate && <span title={p.sdNote || "The SDs are approximate."}><Tag color={t.warn}>Approx. SD</Tag></span>}
        </>}
        actions={<>
          <Btn t={t} small onClick={() => p.norms.forEach(n => onAdd(n.label, n.mean, n.sd, n.type, p.source))} style={{ ...smallBtn, color: t.acc, border: `1px solid ${t.acc}66` }}>Add all ({p.norms.length})</Btn>
          {!p.builtIn && <>
            <Btn t={t} small onClick={() => setEditingPreset({ ...p })} style={smallBtn}>Edit</Btn>
            <Btn t={t} small danger onClick={() => deletePreset(p)} style={smallBtn}>Delete</Btn>
          </>}
          <Btn t={t} small ghost title="Export as JSON" onClick={() => downloadJSON(exportPresetJSON(p), `${file}.json`)} style={smallBtn}>JSON</Btn>
          <Btn t={t} small ghost title="Export as CSV" onClick={() => downloadJSON(exportPresetCSV(p), `${file}.csv`)} style={smallBtn}>CSV</Btn>
        </>}>
        <NormRows t={t} norms={p.norms} onAddOne={n => addOne(n, p.source)} />
      </PresetCard>
    );
  }

  const builtInCount = allBuiltIn.reduce((s, p) => s + (p.norms?.length || 0), 0);
  const userCount = allUser.reduce((s, p) => s + (p.norms?.length || 0), 0);

  if (editingPreset) {
    const p = editingPreset;
    const close = () => { setEditingPreset(null); setEditErrors([]); };
    function updPatch(patch) { setEditingPreset(prev => ({ ...prev, ...patch })); }
    function updNorm(i, field, val) { setEditingPreset(prev => { const norms = [...prev.norms]; norms[i] = { ...norms[i], [field]: val }; return { ...prev, norms }; }); }
    function addNorm() { setEditingPreset(prev => ({ ...prev, norms: [...prev.norms, { label: "", mean: 0, sd: 1, type: "angle" }] })); }
    function removeNorm(i) { setEditingPreset(prev => ({ ...prev, norms: prev.norms.filter((_, j) => j !== i) })); }
    const field = (label, key, placeholder, full) => (
      <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: full ? "1 / -1" : undefined, fontSize: 13, color: t.tx2 }}>
        {label}
        <input value={p[key]} onChange={e => updPatch({ [key]: e.target.value })} placeholder={placeholder} style={inputStyle(t)} />
      </label>
    );
    const cell = { ...inputStyle(t), padding: "4px 6px" };
    return (
      <DialogShell zIndex={9999} t={t} dialogRef={dialogRef} label={p.id ? "Edit norm preset" : "New norm preset"} title={p.id ? "Edit preset" : "New preset"} onClose={close} width={640}>
        <div style={{ padding: "4px 24px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {editErrors.length > 0 && <Notice t={t}>{editErrors.join("\n")}</Notice>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {field("Preset name *", "name", "e.g. Harvold (Norwegian)", true)}
            {field("Source / citation", "source", "e.g. Harvold, 1974")}
            {field("Population", "population", "e.g. Norwegian")}
            {field("Age range", "ageRange", "e.g. Adult / Mixed / 12-17y")}
            {field("Sex", "sex", "e.g. Pooled / Male / Female")}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1", fontSize: 13, color: t.tx2 }}>
              Stratification notes
              <textarea value={p.stratification} onChange={e => updPatch({ stratification: e.target.value })} rows={2} placeholder="Notes about age/sex/ethnic stratification" style={{ ...inputStyle(t), resize: "vertical" }} />
            </label>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tx }}>Norms ({p.norms.length})</h3>
              <Btn t={t} small onClick={addNorm} style={smallBtn}>+ Add norm</Btn>
            </div>
            <div style={{ border: `1px solid ${t.bdr}`, borderRadius: 8, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th(t)}>Measurement</th>
                  <th style={{ ...th(t, "right"), width: 80 }}>Mean</th>
                  <th style={{ ...th(t, "right"), width: 70 }}>SD</th>
                  <th style={{ ...th(t, "center"), width: 90 }}>Type</th>
                  <th style={{ ...th(t), width: 32 }}><span style={{ position: "absolute", left: -9999 }}>Remove</span></th>
                </tr></thead>
                <tbody>
                  {p.norms.map((n, i) => (
                    <tr key={i}>
                      <td style={{ padding: "4px 4px 4px 8px" }}><input value={n.label} onChange={e => updNorm(i, "label", e.target.value)} aria-label="Measurement" placeholder="Label" style={{ ...cell, fontWeight: 600 }} /></td>
                      <td style={{ padding: 4 }}><input type="number" value={n.mean} onChange={e => updNorm(i, "mean", parseFloat(e.target.value) || 0)} aria-label="Mean" style={{ ...cell, textAlign: "right", fontFamily: MONO }} /></td>
                      <td style={{ padding: 4 }}><input type="number" value={n.sd} onChange={e => updNorm(i, "sd", parseFloat(e.target.value) || 0)} aria-label="SD" step="0.1" min="0" style={{ ...cell, textAlign: "right", fontFamily: MONO }} /></td>
                      <td style={{ padding: 4 }}><select value={n.type} onChange={e => updNorm(i, "type", e.target.value)} aria-label="Type" style={cell}>{["angle", "length", "area", "ratio", "value"].map(tp => <option key={tp} value={tp}>{tp}</option>)}</select></td>
                      <td style={{ padding: "4px 8px 4px 0", textAlign: "center" }}><button onClick={() => removeNorm(i)} title="Remove" aria-label={`Remove ${n.label || "norm"}`} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn t={t} small onClick={close}>Cancel</Btn>
            <Btn t={t} small active onClick={handleSavePreset}>Save preset</Btn>
          </div>
        </div>
      </DialogShell>
    );
  }

  const counts = `${builtInCount} built-in${userCount > 0 ? ` · ${userCount} custom` : ""}${communityPresets.length > 0 ? ` · ${communityPresets.length} community` : ""}`;
  const TABS = [
    { id: "browse", label: "Browse" },
    { id: "community", label: communityPresets.length ? `Community (${communityPresets.length})` : "Community" },
    { id: "library", label: allUser.length ? `My library (${allUser.length})` : "My library" },
  ];

  return (
    <DialogShell zIndex={9999} t={t} dialogRef={dialogRef} label="Norms reference" onClose={onClose} width={720}
      title={<>Norms reference
        <GuideBtn t={t} onClick={() => setGuideKey("norms")} label="Norms guide" />
      </>}
      extra={<span style={{ fontSize: 12, color: t.tx3 }}>{counts}</span>}>
      <TabBar t={t} tabs={TABS} active={tab} style={{ padding: "0 24px" }}
        onChange={id => { setTab(id); setEditingPreset(null); setImportError(null); if (id === "community") fetchCommunity(false); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {importError && <Notice t={t} onDismiss={() => setImportError(null)}>{importError}</Notice>}

        {tab === "browse" && <>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, source or measurement" aria-label="Search norms" style={{ ...inputStyle(t), padding: "8px 10px" }} />
          <div>
            {filteredPresets.length === 0 ? <Empty t={t}>No presets match your search.</Empty> : filteredPresets.map(renderPreset)}
          </div>
        </>}

        {tab === "community" && <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn t={t} small onClick={() => fetchCommunity(true)} disabled={communityLoading}>{communityLoading ? "Loading…" : "Refresh"}</Btn>
            <span style={{ fontSize: 12, color: t.tx3, flex: 1 }}>{communityUpdated ? `Updated ${new Date(communityUpdated).toLocaleDateString()}` : ""}</span>
            <Btn t={t} small onClick={() => window.open(getContributionURL(), "_blank")}>Contribute a preset</Btn>
            <Btn t={t} small ghost onClick={() => window.open(getRepoURL(), "_blank")}>Repository</Btn>
          </div>
          {communityError && <Notice t={t}>{communityError}</Notice>}
          <div>
            {communityLoading && communityPresets.length === 0 && <Empty t={t}>Fetching community presets…</Empty>}
            {!communityLoading && communityPresets.length === 0 && !communityError && (
              <Empty t={t}>
                No community presets yet.<br />
                <a href={getContributionURL()} target="_blank" rel="noreferrer" style={{ color: t.acc }}>Contribute the first one</a>
              </Empty>
            )}
            {communityPresets.map((cp, i) => {
              const isInstalled = installedNames.has(cp.name?.toLowerCase());
              return (
                <PresetCard key={i} t={t} title={cp.name}
                  source={[cp.source, cp.contributor].filter(Boolean).join(" · ")}
                  tags={<Tag color={t.tx2}>Community</Tag>}
                  actions={isInstalled
                    ? <Tag color={t.ok}>Installed</Tag>
                    : <Btn t={t} small onClick={() => { const result = installPreset(cp, userPresets); if (result.ok) onSavePreset(result.preset, "add"); }} style={{ ...smallBtn, color: t.acc, border: `1px solid ${t.acc}66` }}>Install ({cp.norms?.length || 0})</Btn>}>
                  {cp.norms?.length > 0 && <NormRows t={t} norms={cp.norms} />}
                </PresetCard>
              );
            })}
          </div>
        </>}

        {tab === "library" && <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn t={t} small active onClick={() => setEditingPreset(_emptyPreset())}>+ New preset</Btn>
            <Btn t={t} small onClick={() => jsonRef.current?.click()}>Import JSON</Btn>
            <Btn t={t} small onClick={() => csvRef.current?.click()}>Import CSV</Btn>
            {allUser.length > 0 && <Btn t={t} small ghost onClick={() => downloadJSON(exportLibraryJSON(allUser), "norm_library.json")}>Export all</Btn>}
            <input ref={jsonRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: "none" }} />
            <input ref={csvRef} type="file" accept=".csv" onChange={handleImportCSV} style={{ display: "none" }} />
          </div>
          <div>
            {allUser.length === 0
              ? <Empty t={t}>No custom presets yet.<br />Create one, or import a JSON or CSV file.</Empty>
              : allUser.map(renderPreset)}
          </div>
        </>}
      </div>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </DialogShell>
  );
}
