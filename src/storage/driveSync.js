// ─── Cross-device sync through the user's Google Drive ─────────────────────
//
// A profile linked to a Google account keeps its cases in a "Cephalometry
// Studio sync" folder of that account's Drive, so signing in on another device
// brings them back. No server: each device talks to Drive directly, and every
// device keeps its full local copy (the app works offline and syncs later).
//
// Drive layout (one folder per account; the app sees only its own files):
//   sync.json         { v, encrypted, keyId, kdf?, wrap? } — no patient data
//   case-<id>         one file per case: its JSON (images left out);
//                     appProperties { cephCase: id, rev, deleted: "0"|"1" }
//   image-<key>       one file per stored image (rendering or raw:<id>);
//                     appProperties { cephImage: key }. Image ids never change
//                     content (a new window makes a new id), so each uploads once.
// With encryption, every file body is AES-GCM with a random data key; the data
// key is stored in sync.json wrapped by a key derived from the passphrase
// (PBKDF2-SHA-256). Each device unlocks it once and keeps it as a
// non-extractable key. Without encryption the files are plain JSON / images.
//
// Reconciling, per case, against what this device last synced (rev + hash):
//   changed here only          → upload (rev + 1)
//   changed in Drive only      → download, replace
//   changed on both            → keep both: the Drive version is added here as
//                                "… (from another device)", this one uploads
//   new in Drive               → download
//   deleted here               → mark deleted in Drive (deleted = "1")
//   deleted on another device  → removed here only if the user confirms;
//                                otherwise uploaded again
// Nothing is ever deleted automatically.

import { normalizeSessionImages } from "./cephxFormat.js";
import { deriveKey, DriveError, findFile, listFiles, download, upload, ensureFolder } from "./driveBackup.js";
import { getImageDataUrl, storeImageBlob, getRawPixels, storeRawPixels, getAllImageKeys } from "./imageStore.js";

export const SYNC_FOLDER = "Cephalometry Studio sync";
const CONFIG_NAME = "sync.json";
const MAGIC = [0x43, 0x53, 0x4b, 0x31]; // "CSK1"
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

// ─── Case form and fingerprint ───────────────────────────────────────────
// What is synced for a case: legacy shapes normalized, images without the
// in-memory dataUrl (images travel as their own files).
export function caseJson(p) {
  return JSON.stringify({
    ...p,
    sessions: (p.sessions || []).map((s) => {
      const n = normalizeSessionImages(s);
      return { ...n, images: (n.images || []).map((img) => ({ ...img, dataUrl: null })) };
    }),
  });
}

export function hash(str) {
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

export function imageKeys(p) {
  const keys = new Set();
  for (const s of p?.sessions || []) for (const img of s?.images || []) {
    if (img?.id) keys.add(img.id);
    if (img?.raw?.key) keys.add(img.raw.key);
  }
  return keys;
}

// ─── Encryption ──────────────────────────────────────────────────────────
// key null → files are stored as they are.
export function makeCipher(key) {
  if (!key) return { encrypted: false, seal: async (b) => b, open: async (b) => b };
  return {
    encrypted: true,
    async seal(bytes) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
      const out = new Uint8Array(4 + 12 + ct.length);
      out.set(MAGIC, 0); out.set(iv, 4); out.set(ct, 16);
      return out;
    },
    async open(bytes) {
      if (bytes.length < 16 || MAGIC.some((b, i) => bytes[i] !== b)) throw new DriveError("A synced file isn't encrypted with this folder's key.");
      try {
        return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(4, 16) }, key, bytes.subarray(16)));
      } catch {
        throw new DriveError("A synced file couldn't be decrypted (wrong key or damaged file).");
      }
    },
  };
}

// New sync settings. passphrase null → no encryption. → { config, key }
export async function createSyncConfig(passphrase, { iterations = 600000 } = {}) {
  const keyId = randomHex(8);
  const base = { v: 1, keyId, created: new Date().toISOString() };
  if (!passphrase) return { config: { ...base, encrypted: false }, key: null };
  const dataKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dataKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKey(passphrase, salt, iterations);
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(keyId) }, kek, raw));
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  raw.fill(0);
  return {
    config: { ...base, encrypted: true, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64(salt) }, wrap: { iv: b64(iv), key: b64(wrapped) } },
    key,
  };
}

// The data key from the passphrase (non-extractable). Throws kind "passphrase".
export async function unlockSyncKey(config, passphrase) {
  const kek = await deriveKey(passphrase, unb64(config.kdf.salt), config.kdf.iterations);
  let raw;
  try {
    raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(config.wrap.iv), additionalData: enc.encode(config.keyId) }, kek, unb64(config.wrap.key)));
  } catch {
    throw new DriveError("Wrong sync passphrase.", "passphrase");
  }
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  raw.fill(0);
  return key;
}

// ─── Image payloads ──────────────────────────────────────────────────────
// uint32 LE header length | header JSON | bytes
function pack(header, bytes) {
  const h = enc.encode(JSON.stringify(header));
  const out = new Uint8Array(4 + h.length + bytes.length);
  new DataView(out.buffer).setUint32(0, h.length, true);
  out.set(h, 4); out.set(bytes, 4 + h.length);
  return out;
}
function unpack(u8) {
  const n = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(0, true);
  return { header: JSON.parse(dec.decode(u8.subarray(4, 4 + n))), bytes: u8.slice(4 + n) };
}
const RAW_TYPES = { int16: Int16Array, uint16: Uint16Array, uint8: Uint8Array };

function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, comma).split(";")[0] || "application/octet-stream";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}
function bytesDataUrl(mime, bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(s)}`;
}

// This device's image store, as the engine sees it.
export const localImages = {
  async keys() { return new Set(await getAllImageKeys()); },
  async read(key) {
    if (key.startsWith("raw:")) {
      const r = await getRawPixels(key);
      return r ? pack({ kind: "raw", meta: r.meta }, new Uint8Array(r.pixels.buffer, r.pixels.byteOffset, r.pixels.byteLength)) : null;
    }
    const du = await getImageDataUrl(key);
    if (!du) return null;
    const { mime, bytes } = dataUrlBytes(du);
    return pack({ kind: "image", mime }, bytes);
  },
  async write(key, payload) {
    const { header, bytes } = unpack(payload);
    if (header.kind === "raw") {
      const T = RAW_TYPES[header.meta?.dtype] || Uint16Array;
      return (await storeRawPixels(key, new T(bytes.buffer, bytes.byteOffset, bytes.byteLength / T.BYTES_PER_ELEMENT), header.meta)).ok;
    }
    return (await storeImageBlob(key, bytesDataUrl(header.mime, bytes))).ok;
  },
};

// ─── Drive folder, as the engine sees it ─────────────────────────────────
export async function driveFolder() {
  const folderId = await ensureFolder(SYNC_FOLDER);
  return {
    folderId,
    list: () => listFiles(folderId, "", "id,name,appProperties"),
    async readConfig() {
      const id = await findFile(folderId, CONFIG_NAME);
      return id ? JSON.parse(dec.decode(await download(id))) : null;
    },
    writeConfig: (config) => upload(enc.encode(JSON.stringify(config, null, 1)), { name: CONFIG_NAME, parents: [folderId], mimeType: "application/json", description: "Cephalometry Studio sync settings (no patient data)." }),
    download,
    create: (name, bytes, appProperties) => upload(bytes, { name, parents: [folderId], mimeType: "application/octet-stream", appProperties }),
    update: (fileId, bytes, appProperties) => upload(bytes, { appProperties }, { fileId }),
  };
}

// ─── The engine ──────────────────────────────────────────────────────────
// cases: this device's cases (current). state: { cases: { id: { fileId, rev,
// hash } } } from the last sync. confirmRemovals(cases) → Promise<boolean>.
// → { replace: Map(id → case), add: [case], remove: [id], state, report }
export async function syncCases({ cases, state, drive, cipher, images, confirmRemovals, copyName, onProgress }) {
  const st = { cases: { ...(state?.cases || {}) } };
  const report = { uploaded: 0, downloaded: 0, removed: 0, conflicts: [], images: 0 };
  const say = (m) => onProgress?.(m);

  say("Checking Google Drive…");
  const remoteCases = new Map(), remoteImages = new Map();
  for (const f of await drive.list()) {
    const ap = f.appProperties || {};
    if (ap.cephCase) remoteCases.set(ap.cephCase, { fileId: f.id, rev: Number(ap.rev) || 0, deleted: ap.deleted === "1" });
    else if (ap.cephImage) remoteImages.set(ap.cephImage, f.id);
  }
  const local = new Map(cases.map((p) => [p.id, p]));
  const json = new Map(cases.map((p) => [p.id, caseJson(p)]));
  const localKeys = await images.keys();

  const fetchCase = async (fileId) => JSON.parse(dec.decode(await cipher.open(await drive.download(fileId))));
  const fetchImages = async (p) => {
    for (const key of imageKeys(p)) {
      if (localKeys.has(key) || !remoteImages.has(key)) continue;
      if (await images.write(key, await cipher.open(await drive.download(remoteImages.get(key))))) { localKeys.add(key); report.images++; }
    }
  };
  const pushImages = async (p) => {
    for (const key of imageKeys(p)) {
      if (remoteImages.has(key)) continue;
      const payload = await images.read(key);
      if (!payload) continue; // not stored on this device
      remoteImages.set(key, await drive.create(`image-${key}`, await cipher.seal(payload), { cephImage: key }));
      report.images++;
    }
  };
  const pushCase = async (p, text, remote) => {
    await pushImages(p);
    const rev = (remote?.rev || 0) + 1;
    const body = await cipher.seal(enc.encode(text));
    const props = { rev: String(rev), deleted: "0" };
    const fileId = remote ? (await drive.update(remote.fileId, body, props), remote.fileId)
      : await drive.create(`case-${p.id}`, body, { cephCase: p.id, ...props });
    st.cases[p.id] = { fileId, rev, hash: hash(text) };
    report.uploaded++;
  };

  const replace = new Map(), add = [], remove = [];
  const removals = [];
  const conflict = async (id, l, r) => {
    const theirs = await fetchCase(r.fileId);
    await fetchImages(theirs);
    const copy = { ...theirs, id: Math.random().toString(36).slice(2, 10), name: copyName ? copyName(theirs) : `${theirs.name || "Case"} (from another device)` };
    add.push(copy);
    report.conflicts.push(l.name || theirs.name || "Case");
    await pushCase(l, json.get(id), r);
    await pushCase(copy, caseJson(copy), null);
  };

  const ids = [...new Set([...local.keys(), ...remoteCases.keys(), ...Object.keys(st.cases)])];
  let done = 0;
  for (const id of ids) {
    say(`Syncing cases… ${++done}/${ids.length}`);
    const l = local.get(id), r = remoteCases.get(id), b = st.cases[id];
    const lHash = l ? hash(json.get(id)) : null;
    const lChanged = !!l && (!b || b.hash !== lHash);
    const rChanged = !!r && (!b || b.rev !== r.rev);
    if (!l && !r) { delete st.cases[id]; continue; }
    if (l && !r) { await pushCase(l, json.get(id), null); continue; }
    if (!l && r) {
      if (r.deleted) { st.cases[id] = { fileId: r.fileId, rev: r.rev, hash: null, deleted: true }; continue; }
      if (b && !b.deleted && !rChanged) {
        // Deleted on this device since the last sync: record it in Drive.
        const rev = r.rev + 1;
        await drive.update(r.fileId, await cipher.seal(new Uint8Array(0)), { rev: String(rev), deleted: "1" });
        st.cases[id] = { fileId: r.fileId, rev, hash: null, deleted: true };
        report.removed++;
        continue;
      }
      const theirs = await fetchCase(r.fileId); // new in Drive (or changed there after we deleted it)
      await fetchImages(theirs);
      add.push(theirs);
      st.cases[id] = { fileId: r.fileId, rev: r.rev, hash: hash(caseJson(theirs)) };
      report.downloaded++;
      continue;
    }
    // On both sides.
    if (r.deleted) {
      if (b && !lChanged) removals.push({ id, l, r });
      else await pushCase(l, json.get(id), r); // changed here: keep it (upload again)
      continue;
    }
    if (!b) {
      // First sync of this case on this device: same content, or keep both.
      const theirs = await fetchCase(r.fileId);
      if (hash(caseJson(theirs)) === lHash) st.cases[id] = { fileId: r.fileId, rev: r.rev, hash: lHash };
      else { await fetchImages(theirs); await conflict(id, l, r); }
      continue;
    }
    if (!lChanged && !rChanged) continue;
    if (lChanged && !rChanged) { await pushCase(l, json.get(id), r); continue; }
    if (!lChanged && rChanged) {
      const theirs = await fetchCase(r.fileId);
      await fetchImages(theirs);
      replace.set(id, theirs);
      st.cases[id] = { fileId: r.fileId, rev: r.rev, hash: hash(caseJson(theirs)) };
      report.downloaded++;
      continue;
    }
    await conflict(id, l, r);
  }

  if (removals.length) {
    const ok = await confirmRemovals(removals.map((x) => x.l));
    for (const { id, l, r } of removals) {
      if (ok) {
        remove.push(id);
        st.cases[id] = { fileId: r.fileId, rev: r.rev, hash: null, deleted: true };
        report.removed++;
      } else {
        await pushCase(l, json.get(id), r);
      }
    }
  }
  return { replace, add, remove, state: st, report };
}

// Apply a sync result to the app's current cases. Cases edited while the sync
// ran are left as they are (the next sync reconciles them).
export function applySyncResult(current, snapshot, result) {
  const before = new Map(snapshot.map((p) => [p.id, p]));
  const untouched = (p) => before.get(p.id) === p;
  let out = current
    .filter((p) => !(result.remove.includes(p.id) && untouched(p)))
    .map((p) => (result.replace.has(p.id) && untouched(p) ? result.replace.get(p.id) : p));
  const have = new Set(out.map((p) => p.id));
  out = out.concat(result.add.filter((p) => !have.has(p.id)));
  return out;
}

export { DriveError };
