// ─── Case storage: encrypted IndexedDB records (Phase 2, item 17) ────────────
//
// Cases used to be one encrypted envelope in localStorage (`cephalometry_projects`,
// ≈5 MB cap, rewritten whole on every save). They now live in IndexedDB
// (appDB.js), one AES-GCM record per case keyed by case id; images stay in the
// `images` store (encrypted by imageStore.js).
//
// Saving (`saveProjects`):
//   1. New images go to the image store first; any that fail keep their
//      dataUrl inside the case record so a radiograph is never dropped (D1).
//   2. Only cases whose JSON changed since this tab last read or wrote them are
//      encrypted and written, and only cases this tab knew and removed are
//      deleted — one transaction, so a save applies completely or not at all.
//      A case created in another tab is never deleted from here, and an empty
//      or failed load can never wipe the stored cases.
//   3. Images that dropped out of this tab's cases are deleted (warm diff).
//
// Migration from localStorage (`loadProjects`): the legacy envelope is
// decrypted, its cases are written to IndexedDB and read back and compared, and
// only then is it recorded as absorbed. The localStorage copy is removed on a
// LATER load, once the cases have been read back from IndexedDB again. If the
// envelope changes after it was absorbed (a tab still running an older build
// saved to it), cases that are newer there are merged in. If IndexedDB can't
// be used at all, the localStorage envelope stays the store, as before.

import { logWarn, logError } from "../lib/logger.js";
import { PROJECTS, META, idbAvailable, openAppDB, txDone, idbGet, idbPut, idbEntries, idbClear } from "./appDB.js";
import { storeImageBlob, getImageDataUrl, deleteImageBlob, deleteOrphanBlobs, getAllImageKeys, clearImageBlobs, encryptLegacyImages } from "./imageStore.js";
import { encryptJSON, decryptJSON, encryptBytes, decryptBytes, secureStorageAvailable, clearSecureStorage, deleteStoredKey } from "./secureStorage.js";
import { normalizeSessionImages, buildCephxPayload, BACKUP_FORMAT, BACKUP_VERSION } from "./cephxFormat.js";
import { storageNames, activeProfileId } from "./profiles.js";

// Legacy localStorage autosave (and fallback store) of the active profile.
export const STORAGE_KEY = storageNames().legacyKey;
export const STORAGE_EVENT = "Cephalometry Studio:storage-warning";

let _backend = null;           // "idb" | "ls"; chosen by loadProjects
let _saved = new Map();        // case id → JSON this tab last read or wrote (idb)
let _knownImageIds = new Set();
let _storedImages = new Map(); // image id → dataUrl already in the image store
let _saveChain = Promise.resolve();
let _idbQuotaWarned = false;
let _lsUnreadable = false;     // ls: the saved envelope couldn't be read → never overwrite it
let _backupSource = null;      // () => the app's current projects (setBackupSource)

// Surface a storage problem to the UI via a decoupled custom event (D3). The
// root component listens and renders a dismissible banner.
export function emitStorageWarning(kind, message) {
  try { window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { kind, message } })); } catch { /* best-effort */ }
}

const QUOTA = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);
const enc = new TextEncoder();
const dec = new TextDecoder();

// Image-store keys in use: each image's rendering, and its original pixels
// (`raw:<id>`) for 12–16-bit images.
export function collectReferencedImageIds(projects) {
  const ids = new Set();
  for (const p of projects || []) {
    for (const s of p?.sessions || []) {
      for (const img of s?.images || []) {
        if (img && img.id) ids.add(img.id);
        if (img?.raw?.key) ids.add(img.raw.key);
      }
    }
  }
  return ids;
}

// Legacy session.image → session.images[] so the GC baseline (and the rest of
// the app) sees the canonical shape (D4).
function normalizeProjects(projects) {
  return (projects || [])
    .filter(p => p && typeof p === "object")
    .map(p => ({ ...p, sessions: (p.sessions || []).map(s => normalizeSessionImages(s)) }));
}

// Cheap fingerprint (cyrb53 + length) to notice that the legacy envelope changed.
function fingerprint(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${str.length}:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

function readLegacyRaw() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

// The legacy envelope: a bare JSON array (very old), {enc:true, iv, ct}, or
// {enc:false, plaintext}. → { ok, projects } | { ok:false, encrypted }
async function readLegacy(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { logError("loadProjects/parse", e); return { ok: false, encrypted: false }; }
  if (Array.isArray(parsed)) return { ok: true, projects: parsed };
  try {
    const projects = await decryptJSON(parsed);
    if (Array.isArray(projects)) return { ok: true, projects };
  } catch (e) { logWarn("Legacy autosave could not be decrypted:", e); }
  return { ok: false, encrypted: parsed?.enc === true };
}

function keyLossWarning() {
  emitStorageWarning(
    "key-loss",
    "Your saved data could not be decrypted. The encryption key may have been lost (cleared IndexedDB). If you have a backup file (.cephx), import it to restore your projects.",
  );
}

// ─── Case records ─────────────────────────────────────────────────────────
// { v:1, enc:true, iv, ct } or, when this browser can't encrypt, { v:1, enc:false, json }.
async function encodeRecord(json) {
  if (secureStorageAvailable()) {
    try {
      const { iv, ct } = await encryptBytes(enc.encode(json));
      return { v: 1, enc: true, iv, ct };
    } catch (e) {
      logWarn("Case encryption failed; storing unencrypted:", e);
      emitStorageWarning("encryption-unavailable", "Encryption failed unexpectedly. Patient data stored in plaintext — check browser security settings.");
    }
  }
  return { v: 1, enc: false, json };
}

async function decodeRecord(rec) {
  if (rec?.enc === true) return dec.decode(await decryptBytes(rec));
  if (rec?.enc === false && typeof rec.json === "string") return rec.json;
  throw new Error("Unrecognised case record");
}

// Every stored case. Records that can't be read are reported, never dropped:
// they stay in the database untouched.
async function readStoredRecords() {
  const projects = [], jsons = new Map(), unreadable = [];
  for (const [id, rec] of await idbEntries(PROJECTS)) {
    try {
      const json = await decodeRecord(rec);
      const p = JSON.parse(json);
      if (!p || typeof p !== "object") throw new Error("Not a case");
      projects.push(p);
      jsons.set(id, json);
    } catch (e) {
      unreadable.push(id);
      logWarn(`Case record ${id} could not be read:`, e);
    }
  }
  return { projects, jsons, unreadable };
}

// Stored order (meta.order) first; anything else after, oldest first.
function sortByOrder(projects, order) {
  const pos = new Map((order || []).map((id, i) => [id, i]));
  return projects
    .map((p, i) => ({ p, k: pos.has(p.id) ? pos.get(p.id) : Infinity, c: p.created || 0, i }))
    .sort((a, b) => a.k - b.k || a.c - b.c || a.i - b.i)
    .map(x => x.p);
}

// Persist images that carry an in-memory dataUrl and aren't stored yet. One at
// a time to bound memory (each is encrypted). → ids that could NOT be stored.
async function storeNewImages(projects) {
  const failedIds = new Set();
  let quota = false, unavailable = false;
  for (const p of projects) {
    for (const s of p.sessions || []) {
      for (const img of s.images || []) {
        if (!img || !img.dataUrl || !img.id) continue;
        if (_storedImages.get(img.id) === img.dataUrl) continue;
        const r = await storeImageBlob(img.id, img.dataUrl);
        if (r && r.ok) _storedImages.set(img.id, img.dataUrl);
        else {
          failedIds.add(img.id);
          if (r && r.error === "quota") quota = true;
          if (r && r.error === "unavailable") unavailable = true;
        }
      }
    }
  }
  if (quota && !_idbQuotaWarned) {
    _idbQuotaWarned = true;
    emitStorageWarning("idb-quota", "Image storage is full. Some new images could not be saved locally — export your project as .cephx to keep them, then clear local data.");
  }
  if (unavailable && !idbAvailable()) {
    emitStorageWarning("idb-unavailable", "Image storage is unavailable in this browser/session (e.g. private mode). Images won't persist across sessions — export your work as .cephx to keep it.");
  }
  return failedIds;
}

// The stored copy: null dataUrl for stored images, the dataUrl kept for
// failures so they survive in the (encrypted) record.
function stripImages(p, failedIds) {
  return {
    ...p,
    sessions: p.sessions?.map(s => ({
      ...s,
      images: s.images?.map(img => ({ ...img, dataUrl: img && failedIds.has(img.id) ? img.dataUrl : null })),
    })),
  };
}

// Warm diff only: delete images that dropped out of this tab's cases since the
// last save. (A full sweep runs separately — see sweepOrphanImages.)
async function collectDroppedImages(projects) {
  const referenced = collectReferencedImageIds(projects);
  if (_knownImageIds.size) {
    try { await deleteOrphanBlobs(referenced, _knownImageIds); }
    catch (e) { logWarn("Orphan blob GC failed:", e); }
  }
  for (const id of _storedImages.keys()) if (!referenced.has(id)) _storedImages.delete(id);
  _knownImageIds = referenced;
}

async function persistIdb(projects, { verify = false } = {}) {
  const failedIds = await storeNewImages(projects);
  const ids = new Set(), changed = [];
  for (const p of projects) {
    if (!p || !p.id) continue;
    ids.add(p.id);
    const json = JSON.stringify(stripImages(p, failedIds));
    if (_saved.get(p.id) !== json) changed.push({ id: p.id, json });
  }
  const removed = [..._saved.keys()].filter(id => !ids.has(id));
  // Encrypt before opening the transaction: an IDB transaction commits as soon
  // as it has no pending requests, so it can't wait on crypto.
  const records = [];
  for (const c of changed) records.push({ id: c.id, rec: await encodeRecord(c.json) });

  const db = await openAppDB();
  const tx = db.transaction([PROJECTS, META], "readwrite");
  const cases = tx.objectStore(PROJECTS);
  for (const { id, rec } of records) cases.put(rec, id);
  for (const id of removed) cases.delete(id);
  const meta = tx.objectStore(META);
  const prev = meta.get("projects");
  prev.onsuccess = () => meta.put({ ...(prev.result || {}), schema: 1, order: projects.map(p => p?.id).filter(Boolean), savedAt: Date.now() }, "projects");
  await txDone(tx);

  if (verify) {
    for (const c of changed) {
      if ((await decodeRecord(await idbGet(PROJECTS, c.id))) !== c.json) throw new Error(`Read-back check failed for case ${c.id}`);
    }
  }
  for (const c of changed) _saved.set(c.id, c.json);
  for (const id of removed) _saved.delete(id);
  await collectDroppedImages(projects);
}

// ─── localStorage fallback (no usable IndexedDB) ──────────────────────────
async function loadFromLocalStorage() {
  _backend = "ls";
  _lsUnreadable = false;
  const raw = readLegacyRaw();
  if (raw == null) return [];
  const legacy = await readLegacy(raw);
  if (legacy.ok) return legacy.projects;
  _lsUnreadable = true;
  if (legacy.encrypted) keyLossWarning();
  else emitStorageWarning("unreadable", "Your saved cases could not be read. Changes are not being saved, so the saved copy isn't overwritten — export your work as .cephx and reload.");
  return [];
}

// → false when nothing was written.
async function saveToLocalStorage(projects) {
  if (_lsUnreadable) return false; // never overwrite a saved copy we couldn't read
  const failedIds = await storeNewImages(projects);
  await collectDroppedImages(projects);
  const envelope = await encryptJSON(projects.map(p => stripImages(p, failedIds)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  return true;
}

// ─── Load ─────────────────────────────────────────────────────────────────
function finishLoad(projects) {
  projects = normalizeProjects(projects);
  _knownImageIds = collectReferencedImageIds(projects);
  return projects;
}

// Merge the legacy envelope into the IndexedDB cases (see the header).
// Returns the merged list; `meta` is the stored migration state.
async function absorbLegacy(raw, projects, meta, unreadableCount) {
  const fp = fingerprint(raw);
  if (meta && meta.legacyFingerprint === fp && !meta.legacyUnreadable) {
    // Absorbed on an earlier load and the cases have now been read back from
    // IndexedDB: retire the old copy (kept while any record is unreadable).
    if (!unreadableCount) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
      await idbPut(META, "projects", { ...meta, legacyFingerprint: null, legacyRemovedAt: Date.now() });
    }
    return projects;
  }
  const legacy = await readLegacy(raw);
  if (!legacy.ok) {
    if (!(meta?.legacyUnreadable && meta.legacyFingerprint === fp)) {
      if (legacy.encrypted) keyLossWarning();
      else emitStorageWarning("unreadable", "Some previously saved data could not be read and was left in place.");
    }
    await idbPut(META, "projects", { ...(meta || {}), legacyFingerprint: fp, legacyUnreadable: true });
    return projects;
  }
  // First migration (no absorb time yet): take every legacy case. Afterwards
  // (an older build wrote to it): take cases that are newer there, and cases
  // missing here only if they changed after the last absorb — a case deleted
  // here since then must not come back.
  const since = meta?.legacyAbsorbedAt ?? null;
  const byId = new Map(projects.map(p => [p.id, p]));
  const take = new Map();
  for (const lp of normalizeProjects(legacy.projects)) {
    if (!lp.id) continue;
    const cur = byId.get(lp.id);
    const newer = cur ? (lp.modified || 0) > (cur.modified || 0) : since == null || (lp.modified || lp.created || 0) > since;
    if (newer) take.set(lp.id, lp);
  }
  let merged = projects;
  if (take.size) {
    merged = projects.map(p => take.get(p.id) || p);
    for (const [id, lp] of take) if (!byId.has(id)) merged.push(lp);
    try {
      await persistIdb(merged, { verify: true });
    } catch (e) {
      // Keep using the localStorage copy this session; the next load retries.
      logError("Moving saved cases to IndexedDB failed", e);
      _backend = "ls";
      _lsUnreadable = false;
      emitStorageWarning("migration-failed", "Your cases could not be moved to the browser's database yet; they stay in the previous storage for now and the move is retried next time.");
      return merged;
    }
    if (since != null) {
      emitStorageWarning("legacy-merged", `Recovered ${take.size} case${take.size === 1 ? "" : "s"} saved by an older version of the app running in another tab.`);
    }
  }
  await idbPut(META, "projects", {
    ...((await idbGet(META, "projects")) || meta || {}),
    legacyFingerprint: fp, legacyUnreadable: false, legacyAbsorbedAt: Date.now(),
    migratedAt: meta?.migratedAt || Date.now(),
  });
  return merged;
}

// → the stored cases (normalized). Never throws; problems are reported via
// STORAGE_EVENT. Sets the backend for the following saves. Runs once per page
// (React StrictMode calls the load effect twice; two concurrent migrations
// would let the second retire the legacy copy in the same visit).
let _loadPromise = null;
export function loadProjects() {
  if (!_loadPromise) _loadPromise = loadOnce();
  return _loadPromise;
}

async function loadOnce() {
  _saved = new Map();
  _storedImages = new Map();
  _knownImageIds = new Set();
  _backend = null;
  if (!secureStorageAvailable()) {
    emitStorageWarning("encryption-unavailable", "Encryption is not available (requires HTTPS + modern browser). Patient data is stored unencrypted in this browser — do not use this app on a shared machine without HTTPS.");
  }
  if (!idbAvailable()) return finishLoad(await loadFromLocalStorage());
  try {
    await openAppDB();
  } catch (e) {
    logWarn("IndexedDB unavailable; using localStorage:", e);
    return finishLoad(await loadFromLocalStorage());
  }
  _backend = "idb";
  try {
    const stored = await readStoredRecords();
    for (const [id, json] of stored.jsons) _saved.set(id, json);
    const meta = (await idbGet(META, "projects")) || null;
    let projects = stored.projects;
    const raw = readLegacyRaw();
    if (raw != null) projects = await absorbLegacy(raw, projects, meta, stored.unreadable.length);
    if (stored.unreadable.length) {
      const n = stored.unreadable.length;
      emitStorageWarning("unreadable", `${n} saved case${n === 1 ? "" : "s"} could not be read. ${n === 1 ? "It is" : "They are"} left untouched; if this persists, restore from a backup.`);
    }
    return finishLoad(sortByOrder(projects, ((await idbGet(META, "projects")) || meta)?.order));
  } catch (e) {
    // Nothing is deleted on this path: saves only touch cases this tab knows.
    logError("loadProjects", e);
    emitStorageWarning("unreadable", "Your saved cases could not be read. New work is still saved and existing cases are left untouched — reload to try again.");
    return finishLoad([]);
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────
// Serialized so saves can't interleave (encryption is async); the last call
// always lands last. → Promise<boolean>: whether this save was written.
export function saveProjects(projects) {
  const run = _saveChain.then(async () => {
    if (!_backend) { logWarn("saveProjects called before loadProjects"); return false; }
    try {
      if (_backend === "idb") await persistIdb(projects || []);
      else if (!(await saveToLocalStorage(projects || []))) return false;
      return true;
    } catch (e) {
      if (e && QUOTA.has(e.name)) {
        emitStorageWarning(
          _backend === "idb" ? "idb-quota" : "ls-quota",
          "Storage is full. Your latest changes could not be saved. Export your cases (.cephx or a full backup) to keep them, then remove cases you no longer need.",
        );
      } else {
        logWarn("Failed to save projects:", e);
      }
      return false;
    }
  });
  _saveChain = run;
  return run;
}

// ─── Background maintenance (after load) ─────────────────────────────────
// Encrypts images stored before encryption existed, then sweeps orphaned
// images. Safe to call without awaiting.
export async function runStorageMaintenance({ sweepDelayMs = 60000 } = {}) {
  if (_backend !== "idb") return;
  try {
    const r = await encryptLegacyImages();
    if (r.encrypted) logWarn(`Encrypted ${r.encrypted} previously stored image(s).`);
  } catch (e) { logWarn("Image encryption pass failed:", e); }
  try { await sweepOrphanImages({ delayMs: sweepDelayMs }); }
  catch (e) { logWarn("Orphan image sweep failed:", e); }
}

// Image ids referenced by every stored case, the legacy envelope, and this
// tab; null when something can't be read (then nothing is deleted).
async function allReferencedImageIds() {
  const stored = await readStoredRecords();
  if (stored.unreadable.length) return null;
  const ids = collectReferencedImageIds(stored.projects);
  const raw = readLegacyRaw();
  if (raw != null) {
    const legacy = await readLegacy(raw);
    if (!legacy.ok) return null;
    for (const id of collectReferencedImageIds(normalizeProjects(legacy.projects))) ids.add(id);
  }
  for (const id of _knownImageIds) ids.add(id);
  for (const id of _storedImages.keys()) ids.add(id);
  return ids;
}

// Full sweep for images no case references (e.g. a tab closed between storing
// an image and saving its case). An image is deleted only if it is
// unreferenced on two reads `delayMs` apart, so a case another tab is saving
// right now has time to land.
export async function sweepOrphanImages({ delayMs = 60000 } = {}) {
  if (_backend !== "idb") return 0;
  const first = await allReferencedImageIds();
  if (!first) return 0;
  const candidates = (await getAllImageKeys()).filter(id => !first.has(id));
  if (!candidates.length) return 0;
  await new Promise(r => setTimeout(r, delayMs));
  const second = await allReferencedImageIds();
  if (!second) return 0;
  const orphans = candidates.filter(id => !second.has(id));
  for (const id of orphans) await deleteImageBlob(id);
  return orphans.length;
}

// ─── Clear ────────────────────────────────────────────────────────────────
// Wipe ALL local data: cases, images, the legacy envelope and the encryption
// key. Called only from the explicit "Clear all local data" actions.
export async function clearAllLocalData() {
  await _saveChain.catch(() => {}); // let an in-flight save land first, then wipe it
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  if (idbAvailable()) {
    try { await idbClear(PROJECTS); await idbClear(META); }
    catch (e) { logWarn("Clearing stored cases failed:", e); }
  }
  await clearImageBlobs();
  await clearSecureStorage(STORAGE_KEY, [`sync_${activeProfileId()}`]);
  _saved = new Map();
  _storedImages = new Map();
  _knownImageIds = new Set();
  _idbQuotaWarned = false;
  _lsUnreadable = false;
}

// Delete another profile's data on this device: its database, keys and
// localStorage copy (explicit "Remove profile" action; never the active one).
export async function deleteProfileData(profileId) {
  const names = storageNames(profileId);
  if (names.db === storageNames().db) throw new Error("Switch to another profile before removing this one.");
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(names.db);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  for (const id of [names.keyId, `sync_${profileId}`]) await deleteStoredKey(id).catch(() => {});
  try { localStorage.removeItem(names.legacyKey); } catch { /* best-effort */ }
}

// ─── Export and backup ────────────────────────────────────────────────────
// Fill in image data the case records leave out (images of sessions not
// opened in this visit). → { project, missing }
export async function hydrateProjectImages(project) {
  let missing = 0;
  const sessions = [];
  for (const s of project?.sessions || []) {
    const images = [];
    for (const img of s?.images || []) {
      if (img && !img.dataUrl && img.id) {
        const dataUrl = await getImageDataUrl(img.id);
        if (!dataUrl) missing++;
        images.push({ ...img, dataUrl: dataUrl || null });
      } else images.push(img);
    }
    sessions.push({ ...s, images });
  }
  return { project: { ...project, sessions }, missing };
}

// The app registers how to get its current cases (fresher than the debounced
// autosave); without it, backups read what is stored.
export function setBackupSource(fn) { _backupSource = typeof fn === "function" ? fn : null; }

// Every stored case, read-only: IndexedDB records plus the legacy envelope
// (newer copy wins). For backups when the app can't supply its state.
export async function readStoredProjects() {
  const byId = new Map();
  if (idbAvailable()) {
    try { for (const p of (await readStoredRecords()).projects) byId.set(p.id, p); }
    catch (e) { logWarn("Reading stored cases failed:", e); }
  }
  const raw = readLegacyRaw();
  if (raw != null) {
    const legacy = await readLegacy(raw);
    for (const p of legacy.ok ? normalizeProjects(legacy.projects) : []) {
      const cur = byId.get(p.id);
      if (!cur || (p.modified || 0) > (cur.modified || 0)) byId.set(p.id, p);
    }
  }
  return normalizeProjects([...byId.values()]);
}

// The backup as Blob parts, one case at a time, so a large backup never has to
// exist as a single JS string. → { blob, count, missing }
export async function buildBackupBlob(projects) {
  const parts = [`{"format":"${BACKUP_FORMAT}","version":"${BACKUP_VERSION}","exported":${Date.now()},"cases":[`];
  let missing = 0, count = 0;
  for (const p of projects || []) {
    if (!p || typeof p !== "object") continue;
    const h = await hydrateProjectImages(p);
    missing += h.missing;
    parts.push((count ? "," : "") + JSON.stringify(buildCephxPayload(h.project)));
    count++;
  }
  parts.push("]}");
  return { blob: new Blob(parts, { type: "application/json" }), count, missing };
}

// Download a backup of every case. → { count, missing }
export async function downloadBackup(projects) {
  const list = projects || (_backupSource ? _backupSource() : null) || (await readStoredProjects());
  const { blob, count, missing } = await buildBackupBlob(list);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Cephalometry-Studio-backup-${new Date().toISOString().slice(0, 10)}.cephx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return { count, missing };
}

// ─── Status (Settings) ────────────────────────────────────────────────────
export async function storageStatus() {
  const s = typeof navigator !== "undefined" ? navigator.storage : null;
  let usage = null, quota = null, persisted = false;
  try { const est = await s?.estimate?.(); usage = est?.usage ?? null; quota = est?.quota ?? null; } catch { /* unsupported */ }
  try { persisted = !!(await s?.persisted?.()); } catch { /* unsupported */ }
  return { backend: _backend, encrypted: secureStorageAvailable(), usage, quota, persisted, canPersist: typeof s?.persist === "function" };
}

// Ask the browser not to clear this site's data when space runs low.
export async function requestPersistentStorage() {
  try { return !!(await navigator.storage.persist()); } catch { return false; }
}

// Test helper: which backend the last load chose.
export const _storageBackend = () => _backend;
