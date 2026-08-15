// ─── IndexedDB image-blob store (D2 / D3 / D6) ─────────────────────────────
//
// Stores cephalogram image blobs out-of-band from the localStorage autosave so
// the (PHI-bearing, encrypted) autosave envelope stays small. Previously this
// module had three integrity defects fixed here:
//
//   D2 — Orphaned blobs leaked forever. `deleteImageBlob` existed but no caller
//        invoked it when sessions/images/projects were removed. We now expose
//        `getAllImageKeys` + `deleteOrphanBlobs(referencedIds)` so the autosave
//        path can garbage-collect blobs that are no longer referenced by any
//        project (handles session delete, image removal, project overwrite and
//        project clear uniformly).
//   D3 — IDB unavailability / quota failures were swallowed silently. The
//        store now reports `{ ok, error }` and a cached `idbAvailable()` flag
//        so the UI can surface a banner ("images won't persist across
//        sessions") and the autosave can keep the dataUrl in localStorage as a
//        fallback rather than dropping it.
//   D6 — No schema-migration path (`DB_VERSION` was 1 with a bare
//        `createObjectStore`). We still keep the schema at v1 but route
//        `onupgradeneeded` through a versioned migration table so future
//        bumps are explicit and safe.
//
// Storage shape (v1): a single `images` object store keyed by image id, value
// = Blob. No indexes (keys are looked up directly).

const DB_NAME = "Cephalometry Studio";
const DB_VERSION = 1;
const STORE_NAME = "images";

import { logWarn } from "../lib/logger.js";

let dbPromise = null;
let _idbAvailable = null; // null = untested; boolean once probed

// Probe IndexedDB availability WITHOUT opening a database (so incognito /
// disabled-IDB contexts don't even create a DB). Cached so callers can cheaply
// decide whether to show the "images won't persist" banner (D3).
export function idbAvailable() {
  if (_idbAvailable !== null) return _idbAvailable;
  try {
    _idbAvailable = typeof indexedDB !== "undefined" && !!window.indexedDB;
  } catch {
    _idbAvailable = false;
  }
  return _idbAvailable;
}

// ─── Schema migrations (D6) ──────────────────────────────────────────────
// Each migration runs from oldVersion → newVersion in order inside
// `onupgradeneeded`. v0 → v1 creates the images store. Add entries here for
// future versions; never mutate past entries.
const MIGRATIONS = {
  1(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
};

function runMigrations(db, oldVersion, newVersion) {
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    const m = MIGRATIONS[v];
    if (m) m(db);
  }
}

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error("IndexedDB not available"));
      _idbAvailable = false;
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error("IndexedDB blocked")); };
    // A versionchange from another tab can invalidate our connection; reset so
    // the next call reopens fresh rather than using a blocked/tombstoned handle.
    req.onupgradeneeded = (e) => runMigrations(e.target.result, e.oldVersion, e.newVersion);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
  });
  // A failed open must not poison the cache for a later retry (e.g. user
  // clears storage then continues editing).
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const parts = dataUrl.split(",");
  const meta = parts[0] && parts[0].match(/:(.*?);/);
  if (!meta) return null;
  const mime = meta[1];
  try {
    const bytes = atob(parts[1] || "");
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// Classify an IDB failure so the caller can pick the right fallback (D3).
// Quota errors keep the dataUrl in localStorage; "unavailable" triggers the
// banner; anything else is logged and treated as a store failure.
function classifyError(e) {
  if (!e) return "unknown";
  const name = e.name || "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return "quota";
  if (name === "UnknownError" || name === "InvalidStateError") return "unavailable";
  return "error";
}

// ─── Store ───────────────────────────────────────────────────────────────
// Returns { ok: boolean, error?: "quota"|"unavailable"|"error"|"bad-data" }.
// Never rejects — the autosave path awaits this and decides whether to keep
// the dataUrl as a localStorage fallback (D1/D3).
export async function storeImageBlob(id, dataUrl) {
  if (!idbAvailable()) return { ok: false, error: "unavailable" };
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return { ok: false, error: "bad-data" };
  try {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("aborted"));
    });
    return { ok: true };
  } catch (e) {
    const kind = classifyError(e);
    if (kind !== "bad-data") logWarn("IDB store failed:", e);
    if (kind === "unavailable") { dbPromise = null; _idbAvailable = false; }
    return { ok: false, error: kind };
  }
}

export async function getImageDataUrl(id) {
  if (!idbAvailable()) return null;
  try {
    const db = await getDB();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!blob) return null;
    return blobToDataUrl(blob);
  } catch (e) {
    logWarn("IDB load failed:", e);
    return null;
  }
}

export async function deleteImageBlob(id) {
  if (!idbAvailable()) return;
  try {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("aborted"));
    });
  } catch (e) {
    logWarn("IDB delete failed:", e);
  }
}

// Enumerate every blob key in the store. Used by `deleteOrphanBlobs` for a
// full GC sweep when the autosave's in-memory "known ids" set is empty (cold
// start after an upgrade, where we don't yet know what's referenced).
export async function getAllImageKeys() {
  if (!idbAvailable()) return [];
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      // getAllKeys is available in all modern browsers; fall back to openCursor.
      if (store.getAllKeys) {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(Array.from(req.result || []));
        req.onerror = () => reject(req.error);
      } else {
        const keys = [];
        const cur = store.openCursor();
        cur.onsuccess = () => { const c = cur.result; if (c) { keys.push(c.key); c.continue(); } else resolve(keys); };
        cur.onerror = () => reject(cur.error);
      }
    });
  } catch (e) {
    logWarn("IDB getAllKeys failed:", e);
    return [];
  }
}

// ─── Orphan garbage collection (D2) ──────────────────────────────────────
// `referencedIds`: the set of image ids still referenced by some project's
// sessions. Any blob whose id is NOT in that set is deleted. Returns the count
// of deleted blobs. Two modes:
//   • warm: caller passes the previous known-ids set as `prevKnown` so we only
//     diff against ids that dropped out this cycle (cheap, no full scan).
//   • cold: `prevKnown` omitted → full scan via getAllImageKeys (used on first
//     save after load when we have no prior baseline).
export async function deleteOrphanBlobs(referencedIds, prevKnown) {
  referencedIds = referencedIds instanceof Set ? referencedIds : new Set(referencedIds || []);
  let orphans;
  if (prevKnown && (prevKnown instanceof Set ? prevKnown.size : prevKnown.length) > 0) {
    const prev = prevKnown instanceof Set ? prevKnown : new Set(prevKnown);
    orphans = [...prev].filter(id => !referencedIds.has(id));
  } else {
    const all = await getAllImageKeys();
    orphans = all.filter(id => !referencedIds.has(id));
  }
  if (orphans.length === 0) return 0;
  await Promise.all(orphans.map(id => deleteImageBlob(id)));
  return orphans.length;
}

export async function clearImageBlobs() {
  if (!idbAvailable()) return;
  try {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("aborted"));
    });
  } catch (e) {
    logWarn("IDB clear failed:", e);
  }
}
