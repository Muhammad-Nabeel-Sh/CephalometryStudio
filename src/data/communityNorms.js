// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY NORMS — Fetch, cache, and install community-contributed norm presets
// from a public GitHub repository.
//
// The repo stores a `norms/community.json` file with this format:
// { "version": "1.0", "updated": "ISO date", "presets": [ ... ] }
//
// Each preset has: name, source, population, ageRange, sex, stratification,
// contributor (optional), norms: [{ label, mean, sd, type }]
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_KEY = "ceph_community_norms";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── CONFIG — Update these to match your GitHub repo ────────────────────────
const GITHUB_OWNER = "Muhammad-Nabeel-Sh";
const GITHUB_REPO = "CephalometryStudio";
const GITHUB_BRANCH = "main";

export const COMMUNITY_REPO_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/norms/community.json`;
const CONTRIBUTION_URL = `/contribute.html`;
const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/norms`;

// ─── Cache ──────────────────────────────────────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - (data.ts || 0) > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), ...data })); } catch { /* quota */ }
}

export function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchCommunityNorms(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = loadCache();
    if (cached) return { ok: true, presets: cached.presets, cached: true, updated: cached.updated };
  }
  try {
    const resp = await fetch(COMMUNITY_REPO_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.presets || !Array.isArray(data.presets)) throw new Error("Invalid format: missing presets array");
    const result = { ok: true, presets: data.presets, cached: false, updated: data.updated || null };
    saveCache({ presets: data.presets, updated: data.updated || null });
    return result;
  } catch (err) {
    const cached = loadCache();
    if (cached) return { ok: true, presets: cached.presets, cached: true, updated: cached.updated, stale: true, error: err.message };
    return { ok: false, presets: [], error: err.message };
  }
}

// ─── Install ────────────────────────────────────────────────────────────────

export function installPreset(preset, existingPresets) {
  const existing = new Set((existingPresets || []).map(p => p.name?.toLowerCase()));
  if (existing.has(preset.name?.toLowerCase())) return { ok: false, error: "Already installed" };
  return { ok: true, preset };
}

// ─── URLs ───────────────────────────────────────────────────────────────────

export function getContributionURL() { return CONTRIBUTION_URL; }
export function getRepoURL() { return REPO_URL; }
