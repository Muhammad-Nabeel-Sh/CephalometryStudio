// ═══════════════════════════════════════════════════════════════════════════════
// NORM LIBRARY — Persistent cross-session norm preset manager
// Stores user-created norm presets in localStorage, separate from per-session norms.
// Built-in presets live in src/norms.js and are never stored here.
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "ceph_norm_library";
const VALID_TYPES = ["angle", "length", "area", "ratio", "value"];
const EXPORT_FORMAT = "ceph-norms";
const EXPORT_VERSION = "1.0";

// ─── Storage ────────────────────────────────────────────────────────────────

export function loadNormLibrary() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

export function saveNormLibrary(presets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* quota — silent */ }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

let _counter = Date.now();
function _uid() { _counter++; return "np_" + _counter.toString(36) + Math.random().toString(36).slice(2, 6); }

export function addPreset(preset) {
  const errors = validatePreset(preset);
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  const p = { id: _uid(), name: preset.name.trim(), source: (preset.source || "").trim(), population: (preset.population || "").trim(), ageRange: (preset.ageRange || "").trim(), sex: (preset.sex || "").trim(), stratification: (preset.stratification || "").trim(), citation: (preset.citation || "").trim(), doi: (preset.doi || "").trim(), sampleSize: Number.isFinite(Number(preset.sampleSize)) && preset.sampleSize !== "" ? Number(preset.sampleSize) : null, norms: preset.norms.map(n => ({ label: n.label.trim(), mean: Number(n.mean), sd: Number(n.sd), type: VALID_TYPES.includes(n.type) ? n.type : "angle" })) };
  return { ok: true, preset: p };
}

export function updatePreset(id, patch) {
  if (patch.norms) {
    const errors = patch.norms.map((n, i) => { const e = []; if (!n.label?.trim()) e.push(`Row ${i + 1}: missing label`); if (typeof n.mean !== "number" || !isFinite(n.mean)) e.push(`Row ${i + 1}: invalid mean`); if (typeof n.sd !== "number" || !isFinite(n.sd) || n.sd <= 0) e.push(`Row ${i + 1}: invalid SD`); return e; }).flat();
    if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  }
  const clean = {};
  for (const k of ["name", "source", "population", "ageRange", "sex", "stratification"]) { if (patch[k] !== undefined) clean[k] = String(patch[k]).trim(); }
  if (patch.norms) clean.norms = patch.norms.map(n => ({ label: n.label.trim(), mean: Number(n.mean), sd: Number(n.sd), type: VALID_TYPES.includes(n.type) ? n.type : "angle" }));
  return { ok: true, patch: clean };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validatePreset(p) {
  const errors = [];
  if (!p?.name?.trim()) errors.push("Preset name is required");
  if (!p?.norms || !Array.isArray(p.norms) || p.norms.length === 0) errors.push("At least one norm is required");
  (p?.norms || []).forEach((n, i) => {
    if (!n.label?.trim()) errors.push(`Norm ${i + 1}: label is required`);
    if (typeof n.mean !== "number" || !isFinite(n.mean)) errors.push(`Norm ${i + 1} ("${n.label || "?"}"): mean must be a number`);
    if (typeof n.sd !== "number" || !isFinite(n.sd) || n.sd <= 0) errors.push(`Norm ${i + 1} ("${n.label || "?"}"): SD must be a positive number`);
    if (n.type && !VALID_TYPES.includes(n.type)) errors.push(`Norm ${i + 1} ("${n.label || "?"}"): unknown type "${n.type}"`);
  });
  return errors;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function exportLibraryJSON(userPresets) {
  const payload = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exported: new Date().toISOString(), presets: userPresets.map(p => ({ name: p.name, source: p.source, population: p.population, ageRange: p.ageRange, sex: p.sex, stratification: p.stratification, norms: p.norms })) };
  return JSON.stringify(payload, null, 2);
}

export function exportPresetJSON(preset) {
  const payload = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exported: new Date().toISOString(), presets: [{ name: preset.name, source: preset.source, population: preset.population, ageRange: preset.ageRange, sex: preset.sex, stratification: preset.stratification, norms: preset.norms }] };
  return JSON.stringify(payload, null, 2);
}

export function exportPresetCSV(preset) {
  const header = "label,mean,sd,type";
  const rows = preset.norms.map(n => `${n.label.includes(",") ? `"${n.label}"` : n.label},${n.mean},${n.sd},${n.type}`);
  return header + "\n" + rows.join("\n");
}

// ─── Import ─────────────────────────────────────────────────────────────────

export function importLibraryJSON(jsonString, existingPresets) {
  let data;
  try { data = JSON.parse(jsonString); } catch { return { ok: false, imported: 0, skipped: 0, errors: ["Invalid JSON"] }; }
  if (!data || data.format !== EXPORT_FORMAT) return { ok: false, imported: 0, skipped: 0, errors: [`Expected format "${EXPORT_FORMAT}", got "${data?.format || "none"}"`] };
  if (!data.presets || !Array.isArray(data.presets) || data.presets.length === 0) return { ok: false, imported: 0, skipped: 0, errors: ["No presets found in file"] };
  const existingNames = new Set((existingPresets || []).map(p => p.name.toLowerCase()));
  let imported = 0, skipped = 0;
  const errors = [];
  const newPresets = [];
  for (const raw of data.presets) {
    const errs = validatePreset(raw);
    if (errs.length > 0) { errors.push(`"${raw.name || "?"}": ${errs.join("; ")}`); continue; }
    if (existingNames.has(raw.name.toLowerCase())) { skipped++; continue; }
    const result = addPreset(raw);
    if (result.ok) { newPresets.push(result.preset); imported++; existingNames.add(raw.name.toLowerCase()); } else { errors.push(`"${raw.name}": ${result.error}`); }
  }
  return { ok: imported > 0, imported, skipped, errors, newPresets };
}

export function importPresetCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, errors: ["CSV must have a header row and at least one data row"] };
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const labelIdx = header.indexOf("label"), meanIdx = header.indexOf("mean"), sdIdx = header.indexOf("sd"), typeIdx = header.indexOf("type");
  if (labelIdx === -1 || meanIdx === -1 || sdIdx === -1) return { ok: false, errors: ["CSV must have 'label', 'mean', and 'sd' columns"] };
  const norms = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const label = cols[labelIdx], mean = parseFloat(cols[meanIdx]), sd = parseFloat(cols[sdIdx]);
    const type = typeIdx !== -1 && VALID_TYPES.includes(cols[typeIdx]) ? cols[typeIdx] : "angle";
    if (!label) { errors.push(`Row ${i + 1}: missing label`); continue; }
    if (!isFinite(mean)) { errors.push(`Row ${i + 1} ("${label}"): invalid mean`); continue; }
    if (!isFinite(sd) || sd <= 0) { errors.push(`Row ${i + 1} ("${label}"): invalid SD`); continue; }
    norms.push({ label, mean, sd, type });
  }
  if (norms.length === 0) return { ok: false, errors: errors.length > 0 ? errors : ["No valid norms found"] };
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, preset: { name: "", source: "", population: "", ageRange: "", sex: "", stratification: "", norms } };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function presetCount(allPresets) { return allPresets.reduce((s, p) => s + (p.norms?.length || 0), 0); }
