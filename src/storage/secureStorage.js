// ─── Encryption-at-rest for cases and images (P1) ──────────────────────────
//
// Cases carry patient identifiers (patientId, name, dob, age, gender,
// ethnicity, clinician, facility, …) and radiographs. This module encrypts
// them with AES-GCM (256-bit) before they are stored — case records and images
// in IndexedDB (projectStore.js, imageStore.js; `encryptBytes`), and the legacy
// localStorage autosave (`encryptJSON`) — using a per-install key stored in a
// SEPARATE IndexedDB database and generated non-extractable so the raw key
// bytes cannot be read out by same-origin script.
//
// Threat model & honest limits:
//   ✓ Stops casual inspection (DevTools → Application → localStorage no longer
//     shows PHI; it shows an {iv, ct} envelope).
//   ✓ The localStorage blob alone (browser sync, shared machine, backup) is
//     unreadable without the IDB key.
//   ✗ Does NOT stop a same-origin XSS, which can read both the blob and the
//     CryptoKey from IDB. XSS resistance comes from the CSP (P4).
//   ✗ Does NOT replace anonymize-before-export (P2/P3).
//
// Fallback: when SubtleCrypto or IndexedDB is unavailable (insecure http://
// context, very old browser), the payload is stored as a plaintext envelope so
// the app still works — the UI is told via `secureStorageAvailable()` so it can
// warn the user.

import { storageNames } from "./profiles.js";

// One key database for all profiles; each profile has its own key in it.
const KEY_DB = "Cephalometry Studio_Secure";
const KEY_STORE = "keys";
const KEY_ID = storageNames().keyId;

let _keyPromise = null;

export function secureStorageAvailable() {
  try {
    return typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
  } catch { return false; }
}

function openKeyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE)) req.result.createObjectStore(KEY_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Let "Clear all local data" delete this database even while open.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getKey() {
  if (_keyPromise) return _keyPromise;
  const p = (async () => {
    const db = await openKeyDB();
    // The CryptoKey stays usable after the connection is closed; an open
    // connection would block deleteDatabase and stall every later save.
    try {
      const existing = await new Promise((resolve, reject) => {
        const tx = db.transaction(KEY_STORE, "readonly");
        const r = tx.objectStore(KEY_STORE).get(KEY_ID);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(KEY_STORE, "readwrite");
        tx.objectStore(KEY_STORE).put(key, KEY_ID);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return key;
    } finally {
      db.close();
    }
  })();
  p.catch(() => { _keyPromise = null; });
  _keyPromise = p;
  return p;
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Binary form for IndexedDB records (cases and images): IDB stores typed
// arrays natively, so there is no base64 step. Callers check
// `secureStorageAvailable()` first; these throw when the key can't be used.
export async function encryptBytes(bytes) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv, ct };
}

export async function decryptBytes({ iv, ct }) {
  const key = await getKey();
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
}

// Returns the envelope object to JSON.stringify into localStorage.
// When encryption is unavailable (HTTP, old browser), emits a warning and
// returns a plaintext envelope so the app still functions. Callers can check
// `secureStorageAvailable()` to decide whether to warn the user.
export async function encryptJSON(obj) {
  if (!secureStorageAvailable()) {
    try { window.dispatchEvent(new CustomEvent("Cephalometry Studio:storage-warning", { detail: { kind: "encryption-unavailable", message: "Encryption is not available (requires HTTPS + modern browser). Patient data is stored in plaintext in localStorage — do not use this app on a shared machine without HTTPS." } })); } catch { /* dispatchEvent is best-effort */ }
    return { v: 1, enc: false, plaintext: JSON.stringify(obj) };
  }
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    return { v: 1, enc: true, iv: b64(iv), ct: b64(ct) };
  } catch {
    try { window.dispatchEvent(new CustomEvent("Cephalometry Studio:storage-warning", { detail: { kind: "encryption-unavailable", message: "Encryption failed unexpectedly. Patient data stored in plaintext — check browser security settings." } })); } catch { /* dispatchEvent is best-effort */ }
    return { v: 1, enc: false, plaintext: JSON.stringify(obj) };
  }
}

// Decrypts an envelope produced by encryptJSON. Returns null for a non-envelope
// (so the caller can detect the legacy plaintext-array form and migrate it).
export async function decryptJSON(envelope) {
  if (!envelope || typeof envelope !== "object") return null;
  if (envelope.enc === false && envelope.plaintext != null) {
    return JSON.parse(envelope.plaintext);
  }
  if (envelope.enc !== true) return null;
  if (!secureStorageAvailable()) return null;
  const key = await getKey();
  const iv = fromB64(envelope.iv);
  const ct = fromB64(envelope.ct);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// Other keys kept next to the profile key (e.g. the Drive sync key), stored
// as non-extractable CryptoKeys. `id` is namespaced by the caller.
async function keyStoreOp(mode, fn) {
  const db = await openKeyDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, mode);
      const r = fn(tx.objectStore(KEY_STORE));
      tx.oncomplete = () => resolve(r?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("aborted"));
    });
  } finally {
    db.close();
  }
}
export const getStoredKey = (id) => keyStoreOp("readonly", (s) => s.get(id)).then((k) => k || null);
export const putStoredKey = (id, key) => keyStoreOp("readwrite", (s) => s.put(key, id));
export const deleteStoredKey = (id) => keyStoreOp("readwrite", (s) => s.delete(id));

// Wipe this profile's encryption key and autosave blob. Called by the explicit
// "Clear all local data" action (which also clears the profile's database).
// Other profiles' keys stay: deleting the whole key database would make their
// cases unreadable.
export async function clearSecureStorage(autosaveKey, keyIds = []) {
  try { if (autosaveKey) localStorage.removeItem(autosaveKey); } catch { /* best-effort */ }
  try {
    for (const id of [KEY_ID, ...keyIds]) await deleteStoredKey(id);
  } catch { /* best-effort */ }
  _keyPromise = null;
}
