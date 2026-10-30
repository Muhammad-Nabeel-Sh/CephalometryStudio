// ─── The app's IndexedDB database ──────────────────────────────────────────
//
// One database ("Cephalometry Studio") holds everything the app keeps on the
// device apart from the encryption key (secureStorage.js keeps that in its own
// database):
//   images   — cephalogram images, encrypted (imageStore.js)       since v1
//   projects — one encrypted record per case (projectStore.js)      since v2
//   meta     — bookkeeping: migration state, image-encryption pass  since v2
//
// Bumping the version also fences off tabs still running an older build: their
// `indexedDB.open(name, 1)` fails with VersionError, so they can no longer
// write or garbage-collect images; their saves land in the legacy
// localStorage envelope, which projectStore.js merges on the next load.

import { storageNames } from "./profiles.js";

// The active profile's database (the default profile keeps the original name).
export const DB_NAME = storageNames().db;
export const DB_VERSION = 2;
export const IMAGES = "images";
export const PROJECTS = "projects";
export const META = "meta";

let dbPromise = null;
let _idbAvailable = null; // null = untested; boolean once probed

// Probe IndexedDB availability WITHOUT opening a database (so incognito /
// disabled-IDB contexts don't even create a DB). Cached so callers can cheaply
// decide whether to show the "images won't persist" banner (D3).
export function idbAvailable() {
  if (_idbAvailable !== null) return _idbAvailable;
  try {
    _idbAvailable = typeof indexedDB !== "undefined" && !!indexedDB;
  } catch {
    _idbAvailable = false;
  }
  return _idbAvailable;
}

// Called when an operation shows the database cannot be used in this context.
export function markIdbUnavailable() {
  _idbAvailable = false;
  dbPromise = null;
}

// ─── Schema migrations (D6) ──────────────────────────────────────────────
// Each migration runs from oldVersion → newVersion in order inside
// `onupgradeneeded`. Never mutate past entries; add a new version instead.
const MIGRATIONS = {
  1(db) {
    if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
  },
  2(db) {
    if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS);
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
  },
};

function runMigrations(db, oldVersion, newVersion) {
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    const m = MIGRATIONS[v];
    if (m) m(db);
  }
}

export function openAppDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      _idbAvailable = false;
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let blockedTimer = null, gaveUp = false;
    req.onerror = () => { clearTimeout(blockedTimer); reject(req.error); };
    // Another tab still holds the old version open. Its onversionchange closes
    // it (older builds do too), so wait briefly before giving up.
    req.onblocked = () => {
      blockedTimer = setTimeout(() => { gaveUp = true; reject(new Error("IndexedDB blocked")); }, 5000);
    };
    req.onupgradeneeded = (e) => runMigrations(e.target.result, e.oldVersion, e.newVersion);
    req.onsuccess = () => {
      clearTimeout(blockedTimer);
      const db = req.result;
      if (gaveUp) { db.close(); return; }
      // A newer build in another tab wants to upgrade: let it, and reopen
      // fresh on the next call rather than using a closed handle.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
  });
  // A failed open must not poison the cache for a later retry (e.g. user
  // clears storage then continues editing).
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

// Close and forget the connection (tests, and before deleting the database).
export async function closeAppDB() {
  const p = dbPromise;
  dbPromise = null;
  if (!p) return;
  try { (await p).close(); } catch { /* never opened */ }
}

// ─── Promise helpers ─────────────────────────────────────────────────────
export function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
}

// Read one value from a store (undefined when missing).
export async function idbGet(store, key) {
  const db = await openAppDB();
  return reqDone(db.transaction(store, "readonly").objectStore(store).get(key));
}

export async function idbPut(store, key, value) {
  const db = await openAppDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  return txDone(tx);
}

// Every [key, value] pair of a store.
export async function idbEntries(store) {
  const db = await openAppDB();
  const os = db.transaction(store, "readonly").objectStore(store);
  const [keys, values] = await Promise.all([reqDone(os.getAllKeys()), reqDone(os.getAll())]);
  return keys.map((k, i) => [k, values[i]]);
}

export async function idbClear(store) {
  const db = await openAppDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).clear();
  return txDone(tx);
}
