// ─── Encryption-at-rest for the PHI-bearing localStorage autosave (P1) ──────
//
// The autosave blob (`cephalometry_projects`) carries patient identifiers
// (patientId, name, dob, age, gender, ethnicity, clinician, facility, …) in
// plaintext. This module wraps the payload with AES-GCM (256-bit) before it
// lands in localStorage, using a per-install key stored in a SEPARATE
// IndexedDB store (not localStorage) and generated non-extractable so the raw
// key bytes cannot be read out by same-origin script.
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

const KEY_DB = "Cephalometry Studio_Secure";
const KEY_STORE = "keys";
const KEY_ID = "autosave_v1";

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKey() {
  if (_keyPromise) return _keyPromise;
  const p = (async () => {
    const db = await openKeyDB();
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

// Wipe the encryption key store and the autosave blob. Called by the explicit
// "Clear all local data" UI action (which also clears the image IDB).
export async function clearSecureStorage(autosaveKey) {
  try { if (autosaveKey) localStorage.removeItem(autosaveKey); } catch { /* best-effort */ }
  try {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(KEY_DB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch { /* best-effort */ }
  _keyPromise = null;
}
