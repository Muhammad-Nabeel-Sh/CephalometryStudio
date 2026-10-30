// ─── Profiles ───────────────────────────────────────────────────────────────
//
// A profile is a separate set of cases on this device: its own IndexedDB
// database, encryption key and localStorage fallback. A profile can be local
// only, or linked to a Google account, whose Drive folder then syncs its cases
// across devices (storage/driveSync.js).
//
// The first ("default") profile keeps the names the app always used, so
// existing data needs no migration. Switching profiles reloads the page: every
// store and cache starts clean for the new profile. A Google sign-in made just
// before the switch is handed over through sessionStorage so the user isn't
// asked twice (it's an access token of ≈1 hour, removed as soon as it is read).
//
// The list ({ profiles, activeId }) has no patient data: names, colours, the
// linked Google email.

const KEY = "cephalo_profiles_v1";
const HANDOFF = "cephalo_token_handoff";
export const DEFAULT_ID = "default";
const COLORS = ["#7c5cfc", "#38bdf8", "#34d399", "#f59e0b", "#f472b6", "#fb923c", "#a78bfa", "#4ade80"];

const defaults = () => ({ profiles: [{ id: DEFAULT_ID, name: "This device", color: COLORS[0], created: Date.now() }], activeId: DEFAULT_ID });

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && Array.isArray(v.profiles) && v.profiles.length) {
      if (!v.profiles.some((p) => p.id === v.activeId)) v.activeId = v.profiles[0].id;
      return v;
    }
  } catch { /* storage blocked or corrupt */ }
  return defaults();
}

function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ }
}

// Fixed for the life of the page (switching reloads).
const ACTIVE_ID = read().activeId;

export const listProfiles = () => read().profiles;
export const activeProfileId = () => ACTIVE_ID;
export const activeProfile = () => read().profiles.find((p) => p.id === ACTIVE_ID) || defaults().profiles[0];

// Where a profile's data lives.
export function storageNames(id = ACTIVE_ID) {
  const def = id === DEFAULT_ID;
  return {
    db: def ? "Cephalometry Studio" : `Cephalometry Studio::${id}`,
    keyId: def ? "autosave_v1" : `profile_${id}`,
    legacyKey: def ? "cephalometry_projects" : `cephalometry_projects::${id}`,
  };
}

export function addProfile({ name, email } = {}) {
  const v = read();
  const id = Math.random().toString(36).slice(2, 10);
  const p = { id, name: (name || email || "New profile").trim(), color: COLORS[v.profiles.length % COLORS.length], created: Date.now(), ...(email ? { email } : {}) };
  v.profiles.push(p);
  write(v);
  return p;
}

export function updateProfile(id, patch) {
  const v = read();
  v.profiles = v.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
  write(v);
  return v.profiles.find((p) => p.id === id);
}

export const profileForEmail = (email) => (email ? read().profiles.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase()) : null);

// Make `id` active and reload. `token`: a fresh Google sign-in to hand over.
export function switchProfile(id, { token } = {}) {
  const v = read();
  if (!v.profiles.some((p) => p.id === id)) return;
  v.activeId = id;
  write(v);
  try {
    if (token) sessionStorage.setItem(HANDOFF, JSON.stringify({ ...token, profileId: id }));
  } catch { /* the user signs in again after the reload */ }
  window.location.reload();
}

// The handed-over sign-in for the active profile (read once).
export function takeTokenHandoff() {
  try {
    const raw = sessionStorage.getItem(HANDOFF);
    sessionStorage.removeItem(HANDOFF);
    const t = raw ? JSON.parse(raw) : null;
    return t && t.profileId === ACTIVE_ID && t.expiresAt > Date.now() + 60000 ? t : null;
  } catch { return null; }
}

// Remove a profile from the list (its data is deleted by the caller first).
export function removeProfile(id) {
  if (id === DEFAULT_ID) return;
  const v = read();
  v.profiles = v.profiles.filter((p) => p.id !== id);
  if (v.activeId === id) v.activeId = DEFAULT_ID;
  write(v);
}
