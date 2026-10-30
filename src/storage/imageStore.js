// ─── IndexedDB image store (D2 / D3 / D6; encrypted since DB v2) ─────────────
//
// Stores cephalogram images out-of-band from the case records so those stay
// small. Integrity behaviours:
//
//   D2 — Orphaned blobs are garbage-collected: `getAllImageKeys` +
//        `deleteOrphanBlobs(referencedIds)` let the autosave delete images no
//        longer referenced by any case (session delete, image removal, case
//        overwrite and clear are handled uniformly).
//   D3 — Unavailability / quota failures are reported as `{ ok, error }` (and
//        `idbAvailable()`) so the UI can show a banner and the autosave can keep
//        the dataUrl in the case record instead of dropping it.
//   D6 — Schema changes go through the versioned migration table in appDB.js.
//
// Record shapes in the `images` store (key = image id):
//   { v: 2, enc: true, type, iv, ct, at }  AES-GCM ciphertext (secureStorage key)
//   Blob                                     before v2, or when this browser
//                                            can't encrypt (http://); still
//                                            read, and `encryptLegacyImages`
//                                            converts them once encryption works.

import { logWarn } from "../lib/logger.js";
import { IMAGES, META, idbAvailable, markIdbUnavailable, openAppDB, reqDone, txDone, idbGet, idbPut } from "./appDB.js";
import { secureStorageAvailable, encryptBytes, decryptBytes } from "./secureStorage.js";

export { idbAvailable };

function dataUrlToBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const comma = dataUrl.indexOf(",");
  const meta = comma > 0 && dataUrl.slice(0, comma).match(/:(.*?);/);
  if (!meta) return null;
  try {
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type: meta[1] };
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

function blobToBytes(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// Duck-typed: a Blob read back from IndexedDB need not be an instance of this
// realm's Blob.
const isBlobLike = (v) => !!v && typeof v === "object" && typeof v.size === "number" && typeof v.type === "string" && !v.enc;
const isEncrypted = (v) => !!v && typeof v === "object" && v.enc === true && !!v.iv && !!v.ct;

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function encryptRecord(bytes, type) {
  const { iv, ct } = await encryptBytes(bytes);
  return { v: 2, enc: true, type, iv, ct, at: Date.now() };
}

// Classify an IDB failure so the caller can pick the right fallback (D3).
// Quota errors keep the dataUrl in the case record; "unavailable" triggers the
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
// Never rejects — the autosave awaits this and decides whether to keep the
// dataUrl in the case record (D1/D3). Encrypts when the browser can; if
// encryption fails the image is still stored (unencrypted) rather than lost,
// and the encryption pass is re-armed.
export async function storeImageBlob(id, dataUrl) {
  if (!idbAvailable()) return { ok: false, error: "unavailable" };
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return { ok: false, error: "bad-data" };
  try {
    let value = null;
    if (secureStorageAvailable()) {
      try { value = await encryptRecord(parsed.bytes, parsed.type); }
      catch (e) { logWarn("Image encryption failed; storing unencrypted:", e); }
    }
    const db = await openAppDB();
    const tx = db.transaction([IMAGES, META], "readwrite");
    if (value) tx.objectStore(IMAGES).put(value, id);
    else {
      tx.objectStore(IMAGES).put(new Blob([parsed.bytes], { type: parsed.type }), id);
      tx.objectStore(META).put({ encrypted: false, at: Date.now() }, "images");
    }
    await txDone(tx);
    return { ok: true };
  } catch (e) {
    const kind = classifyError(e);
    logWarn("IDB store failed:", e);
    if (kind === "unavailable") markIdbUnavailable();
    return { ok: false, error: kind };
  }
}

async function recordToDataUrl(v) {
  if (isEncrypted(v)) {
    if (!secureStorageAvailable()) return null;
    const pt = await decryptBytes(v);
    return blobToDataUrl(new Blob([new Uint8Array(pt)], { type: v.type || "application/octet-stream" }));
  }
  if (isBlobLike(v)) return blobToDataUrl(v);
  return null;
}

export async function getImageDataUrl(id) {
  if (!idbAvailable()) return null;
  try {
    const db = await openAppDB();
    const v = await reqDone(db.transaction(IMAGES, "readonly").objectStore(IMAGES).get(id));
    return v ? await recordToDataUrl(v) : null;
  } catch (e) {
    logWarn("IDB load failed:", e);
    return null;
  }
}

// ─── Original pixels of 12–16-bit images ────────────────────────────────
// Stored once at import under `raw:<image id>` (the entry's raw.key), next to
// the 8-bit rendering, so the window can be changed later:
//   { v: 2, enc: true, kind: "raw", iv, ct, meta, at }   (meta: imaging/voi.js; no PHI)
//   { v: 2, enc: false, kind: "raw", bytes, meta, at }   when encryption is unavailable
const RAW_TYPES = { int16: Int16Array, uint16: Uint16Array, uint8: Uint8Array };
const isPlainRaw = (v) => !!v && v.kind === "raw" && v.enc === false && !!v.bytes;

export async function storeRawPixels(key, pixels, meta) {
  if (!idbAvailable()) return { ok: false, error: "unavailable" };
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  try {
    let value = null;
    if (secureStorageAvailable()) {
      try {
        const { iv, ct } = await encryptBytes(bytes);
        value = { v: 2, enc: true, kind: "raw", iv, ct, meta, at: Date.now() };
      } catch (e) { logWarn("Raw image encryption failed; storing unencrypted:", e); }
    }
    const db = await openAppDB();
    const tx = db.transaction([IMAGES, META], "readwrite");
    if (value) tx.objectStore(IMAGES).put(value, key);
    else {
      tx.objectStore(IMAGES).put({ v: 2, enc: false, kind: "raw", bytes: bytes.slice().buffer, meta, at: Date.now() }, key);
      tx.objectStore(META).put({ encrypted: false, at: Date.now() }, "images");
    }
    await txDone(tx);
    return { ok: true };
  } catch (e) {
    logWarn("IDB raw store failed:", e);
    if (classifyError(e) === "unavailable") markIdbUnavailable();
    return { ok: false, error: classifyError(e) };
  }
}

// → { pixels, meta } or null (not stored here, e.g. a case imported from a file).
export async function getRawPixels(key) {
  if (!key || !idbAvailable()) return null;
  try {
    const db = await openAppDB();
    const v = await reqDone(db.transaction(IMAGES, "readonly").objectStore(IMAGES).get(key));
    if (!v || v.kind !== "raw" || !v.meta) return null;
    if (v.enc && !secureStorageAvailable()) return null;
    const buf = v.enc ? await decryptBytes(v) : v.bytes;
    const T = RAW_TYPES[v.meta.dtype] || Uint16Array;
    return { pixels: new T(buf), meta: v.meta };
  } catch (e) {
    logWarn("IDB raw load failed:", e);
    return null;
  }
}

// ─── One-time encryption of images stored before v2 ─────────────────────
// Images are converted one at a time (bounded memory). Each is encrypted,
// written, read back and decrypted, and compared with the original bytes; if
// that check fails the original unencrypted copy is put back, so nothing is
// lost. The pass is skipped once `meta.images.encrypted` records that every
// image is encrypted (storeImageBlob clears it when it has to store one plain).
export async function encryptLegacyImages() {
  if (!idbAvailable() || !secureStorageAvailable()) return { encrypted: 0, failed: 0, skipped: true };
  try {
    const state = await idbGet(META, "images");
    if (state?.encrypted) return { encrypted: 0, failed: 0 };
    const db = await openAppDB();
    const keys = await reqDone(db.transaction(IMAGES, "readonly").objectStore(IMAGES).getAllKeys());
    let encrypted = 0, failed = 0;
    for (const id of keys) {
      const v = await reqDone(db.transaction(IMAGES, "readonly").objectStore(IMAGES).get(id));
      const plainRaw = isPlainRaw(v);
      if (!isBlobLike(v) && !plainRaw) continue;
      try {
        const bytes = new Uint8Array(plainRaw ? v.bytes : await blobToBytes(v));
        const rec = plainRaw
          ? { v: 2, enc: true, kind: "raw", ...(await encryptBytes(bytes)), meta: v.meta, at: v.at || Date.now() }
          : await encryptRecord(bytes, v.type);
        let tx = db.transaction(IMAGES, "readwrite");
        tx.objectStore(IMAGES).put(rec, id);
        await txDone(tx);
        const back = await reqDone(db.transaction(IMAGES, "readonly").objectStore(IMAGES).get(id));
        const ok = isEncrypted(back) && sameBytes(bytes, new Uint8Array(await decryptBytes(back)));
        if (!ok) {
          tx = db.transaction(IMAGES, "readwrite");
          tx.objectStore(IMAGES).put(v, id);
          await txDone(tx);
          throw new Error("read-back check failed");
        }
        encrypted++;
      } catch (e) {
        failed++;
        logWarn("Image encryption failed:", e);
      }
    }
    if (!failed) await idbPut(META, "images", { encrypted: true, at: Date.now() });
    return { encrypted, failed };
  } catch (e) {
    logWarn("Image encryption pass failed:", e);
    return { encrypted: 0, failed: 1 };
  }
}

export async function deleteImageBlob(id) {
  if (!idbAvailable()) return;
  try {
    const db = await openAppDB();
    const tx = db.transaction(IMAGES, "readwrite");
    tx.objectStore(IMAGES).delete(id);
    await txDone(tx);
  } catch (e) {
    logWarn("IDB delete failed:", e);
  }
}

// Enumerate every image key in the store. Used by `deleteOrphanBlobs` for a
// full sweep when there is no "known ids" baseline.
export async function getAllImageKeys() {
  if (!idbAvailable()) return [];
  try {
    const db = await openAppDB();
    const store = db.transaction(IMAGES, "readonly").objectStore(IMAGES);
    // getAllKeys is available in all modern browsers; fall back to openCursor.
    if (store.getAllKeys) return Array.from((await reqDone(store.getAllKeys())) || []);
    return await new Promise((resolve, reject) => {
      const keys = [];
      const cur = store.openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { keys.push(c.key); c.continue(); } else resolve(keys); };
      cur.onerror = () => reject(cur.error);
    });
  } catch (e) {
    logWarn("IDB getAllKeys failed:", e);
    return [];
  }
}

// ─── Orphan garbage collection (D2) ──────────────────────────────────────
// `referencedIds`: the image ids still referenced by some case. Any image whose
// id is NOT in that set is deleted. Returns the count of deleted images.
//   • warm: `prevKnown` = the ids referenced at the previous save, so only ids
//     that dropped out this cycle are deleted (cheap, no full scan).
//   • cold: `prevKnown` omitted → full scan via getAllImageKeys. projectStore
//     runs this only after re-reading every stored case, twice, a minute apart.
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
    const db = await openAppDB();
    const tx = db.transaction(IMAGES, "readwrite");
    tx.objectStore(IMAGES).clear();
    await txDone(tx);
  } catch (e) {
    logWarn("IDB clear failed:", e);
  }
}
