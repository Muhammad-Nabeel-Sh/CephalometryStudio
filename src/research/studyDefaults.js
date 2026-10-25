// ═══════════════════════════════════════════════════════════════════════════════
// studyDefaults.js — the user's preferred analysis settings (A16)
//
// Only methodological choices are remembered (α, multiple-comparison correction,
// test policy, ICC model, sphericity correction, …) — never study-specific data
// such as groups, cases or subjects. Stored per browser; storage failures (private
// mode, blocked site data) fall back to the built-in defaults.
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "cephalometry_study_defaults_v1";

// Settings that can be remembered or copied between studies, per study type.
export const SETTING_KEYS = {
  reliability: ["iccModel", "design", "minTimeSeparation"],
  descriptive: ["groupBy"],
  comparative: ["alpha", "mcCorrection", "testPolicy", "design"],
  longitudinal: ["sphericityCorrection", "modelType", "timeAxis", "growthCurve", "covariate", "minTimeSeparation"],
  correlation: ["method"],
  diagnostic: ["cvMethod", "cvK"],
  superimposition: ["method", "registration", "allowScale"],
  airway: [],
};

export function loadStudyDefaults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function pickSettings(type, config) {
  const out = {};
  for (const k of SETTING_KEYS[type] || []) if (config?.[k] !== undefined) out[k] = config[k];
  return out;
}

export function saveStudyDefaults(type, config) {
  const all = loadStudyDefaults();
  all[type] = pickSettings(type, config);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export function defaultsFor(type) {
  return loadStudyDefaults()[type] || {};
}

// Copy the methodological settings of `source` onto `target` (same type only).
export function copySettings(target, source) {
  if (!source || source.type !== target.type) return target;
  return { ...target, config: { ...target.config, ...pickSettings(target.type, source.config) } };
}
