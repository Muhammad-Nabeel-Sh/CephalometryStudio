// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY EXAMPLES — Fetch, cache, and browse community-contributed example
// illustrations (.cepht teaching files) from a public GitHub repository.
//
// The repo stores a manifest at `Examples/manifest.json` with this format:
// { "version": "1.0", "updated": "ISO date", "examples": [
//   { "id", "url", "label", "author", "description", "projection", "ptCount" }
// ] }
//
// The manifest is small and cached (1 h). The .cepht bodies are fetched on
// demand when a user opens an example, and validated with `validateExample`
// before it reaches the viewer.
// ═══════════════════════════════════════════════════════════════════════════════

import { validateExample } from "../storage/cephxFormat.js";

const CACHE_KEY = "ceph_community_examples";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── CONFIG — Update these to match your GitHub repo ────────────────────────
const GITHUB_OWNER = "Muhammad-Nabeel-Sh";
const GITHUB_REPO = "CephalometryStudio";
const GITHUB_BRANCH = "main";

export const COMMUNITY_EXAMPLES_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/Examples/manifest.json`;
const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/Examples`;
const CONTRIBUTION_URL = "/contribute.html";

// ─── Manifest parsing ───────────────────────────────────────────────────────

// Normalises a raw manifest JSON object into { updated, examples } where each
// example is a browse-card entry. Returns null for a structurally bad manifest
// so callers can show a friendly error. Unknown fields are dropped; a missing
// `url` disqualifies the entry.
export function parseCommunityManifest(data) {
  if (!data || !Array.isArray(data.examples)) return null;
  const examples = data.examples
    .map((ex, i) => {
      if (!ex || typeof ex !== "object") return null;
      const url = typeof ex.url === "string" ? ex.url : "";
      if (!url) return null;
      const id = typeof ex.id === "string" && ex.id ? ex.id : `community-${i}`;
      const ptCount = typeof ex.ptCount === "number" ? ex.ptCount : 0;
      return {
        id,
        url,
        label: typeof ex.label === "string" && ex.label ? ex.label : id,
        subtitle: typeof ex.subtitle === "string" ? ex.subtitle : "",
        description: typeof ex.description === "string" ? ex.description : "",
        author: typeof ex.author === "string" ? ex.author : "",
        projection: typeof ex.projection === "string" ? ex.projection : "",
        analysisName: typeof ex.analysisName === "string" ? ex.analysisName : "",
        ptCount,
        badge: ptCount ? `${ptCount} pts` : "community",
      };
    })
    .filter(Boolean);
  return { updated: typeof data.updated === "string" ? data.updated : null, examples };
}

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

export function clearCommunityCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

// Returns { ok, examples, cached, updated, stale?, error? }. On network failure
// falls back to a stale cache if one exists.
export async function fetchCommunityExamples(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = loadCache();
    if (cached) return { ok: true, examples: cached.examples, cached: true, updated: cached.updated };
  }
  try {
    const resp = await fetch(COMMUNITY_EXAMPLES_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const parsed = parseCommunityManifest(await resp.json());
    if (!parsed) throw new Error("Invalid manifest: missing examples array");
    saveCache({ examples: parsed.examples, updated: parsed.updated });
    return { ok: true, examples: parsed.examples, cached: false, updated: parsed.updated };
  } catch (err) {
    const cached = loadCache();
    if (cached) return { ok: true, examples: cached.examples, cached: true, updated: cached.updated, stale: true, error: err.message };
    return { ok: false, examples: [], error: err.message };
  }
}

// Fetches a single example .cepht and validates it before it can be opened.
// Returns { ok, data, error? }.
export async function fetchExampleFile(url) {
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const err = validateExample(data);
    if (err) throw new Error(`Invalid example: ${err}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

// ─── URLs ───────────────────────────────────────────────────────────────────

export function getContributionURL() { return CONTRIBUTION_URL; }
export function getRepoURL() { return REPO_URL; }
