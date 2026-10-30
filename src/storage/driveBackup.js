// ─── Encrypted backups in Google Drive ──────────────────────────────────────
//
// Stage 1 of cloud storage: the "Back up all cases" file (projectStore
// .buildBackupBlob) is encrypted with a passphrase on this device and uploaded
// to a "Cephalometry Studio backups" folder in the user's own Google Drive.
// Restoring downloads, decrypts and hands the backup to the normal restore
// path. There is no server: the browser talks to Google directly.
//
//   • Sign-in: Google Identity Services token model, scope drive.file — the app
//     can see only the files it created, nothing else in the user's Drive.
//     Tokens (about 1 hour) live in memory only; renewing needs a click.
//   • Encryption (optional, recommended): PBKDF2-SHA-256 (600 000 rounds,
//     random salt) → AES-GCM-256, header authenticated. Without the passphrase
//     an encrypted backup can't be read by anyone, including Google and us.
//     Without a passphrase the backup is the plain .cephx backup file.
//   • The REST helpers here are shared with cross-device sync (driveSync.js).
//   • Nothing is ever deleted automatically; removing a backup moves it to the
//     Drive trash.
//
// Container (.csb): "CSB1" | uint32 LE header length | header JSON | ciphertext

const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const GIS_URL = "https://accounts.google.com/gsi/client";
export const FOLDER_NAME = "Cephalometry Studio backups";
const CHECK_NAME = "passphrase-check.csb";
const CHECK_TEXT = "cephalometry-studio-passphrase-check";
const LAST_KEY = "cephalo_drive_last_backup";
export const KDF_ITERATIONS = 600000;
const MAGIC = [0x43, 0x53, 0x42, 0x31]; // "CSB1"
import { takeTokenHandoff } from "./profiles.js";

export class DriveError extends Error {
  constructor(message, kind = "error") { super(message); this.kind = kind; }
}

export const driveConfigured = () => !!CLIENT_ID;

export const isEncryptedBackup = (u8) => u8.length >= 4 && MAGIC.every((b, i) => u8[i] === b);

// ─── Encryption ──────────────────────────────────────────────────────────
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// bytes (Uint8Array) → encrypted container (Uint8Array). `info` goes into the
// (readable, authenticated) header, e.g. { cases: 12 } — never patient data.
export async function encryptBackup(bytes, passphrase, info = {}, { iterations = KDF_ITERATIONS } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = enc.encode(JSON.stringify({
    v: 1, app: "Cephalometry Studio", created: new Date().toISOString(), ...info,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64(salt) },
    cipher: { name: "AES-GCM", iv: b64(iv) },
  }));
  const key = await deriveKey(passphrase, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header }, key, bytes));
  const out = new Uint8Array(8 + header.length + ct.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(4, header.length, true);
  out.set(header, 8);
  out.set(ct, 8 + header.length);
  return out;
}

export function readBackupHeader(container) {
  const u8 = container instanceof Uint8Array ? container : new Uint8Array(container);
  if (u8.length < 8 || MAGIC.some((b, i) => u8[i] !== b)) throw new DriveError("This is not a Cephalometry Studio encrypted backup.");
  const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true);
  if (8 + len > u8.length) throw new DriveError("The backup file is incomplete.");
  const headerBytes = u8.subarray(8, 8 + len);
  let header;
  try { header = JSON.parse(dec.decode(headerBytes)); } catch { throw new DriveError("The backup file is damaged."); }
  return { header, headerBytes, ciphertext: u8.subarray(8 + len) };
}

// → plaintext Uint8Array; throws DriveError("…passphrase…", "passphrase").
export async function decryptBackup(container, passphrase) {
  const { header, headerBytes, ciphertext } = readBackupHeader(container);
  if (header.kdf?.name !== "PBKDF2" || header.cipher?.name !== "AES-GCM") throw new DriveError("This backup uses an unknown encryption format.");
  const key = await deriveKey(passphrase, unb64(header.kdf.salt), header.kdf.iterations);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(header.cipher.iv), additionalData: headerBytes }, key, ciphertext));
  } catch {
    throw new DriveError("Wrong passphrase, or the backup file is damaged.", "passphrase");
  }
}

// ─── Sign-in (Google Identity Services, loaded on demand) ────────────────
let gisPromise = null;
// { value, expiresAt }; a sign-in handed over by a profile switch is reused.
let token = (() => { const t = typeof window !== "undefined" ? takeTokenHandoff() : null; return t ? { value: t.value, expiresAt: t.expiresAt } : null; })();

// Load early (e.g. when the dialog opens) so the sign-in popup opens within
// the click that asks for it — browsers block popups opened later.
export function loadGoogleSignIn() {
  if (!driveConfigured()) return Promise.reject(new DriveError("Google Drive isn't set up for this site.", "config"));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_URL;
      s.async = true;
      s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new DriveError("Google sign-in didn't load.", "network")));
      s.onerror = () => reject(new DriveError("Google sign-in couldn't be loaded. Check the connection.", "network"));
      document.head.appendChild(s);
    });
    gisPromise.catch(() => { gisPromise = null; });
  }
  return gisPromise;
}

export const isConnected = () => !!token && token.expiresAt > Date.now() + 60000;
export const currentToken = () => (isConnected() ? { ...token } : null);

// Call from a click handler: opens Google's consent popup the first time.
// `email` suggests that account; `chooseAccount` always shows the account list.
export async function connect({ email, chooseAccount = false } = {}) {
  const oauth2 = await loadGoogleSignIn();
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ...(email && !chooseAccount ? { login_hint: email } : {}),
      callback: (resp) => {
        if (resp.error) return reject(new DriveError(resp.error === "access_denied" ? "Google Drive access was not allowed." : `Google sign-in failed (${resp.error}).`, "auth"));
        if (!oauth2.hasGrantedAllScopes(resp, SCOPE)) return reject(new DriveError("Google Drive access was not allowed. Tick the Drive permission when asked.", "auth"));
        token = { value: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        resolve();
      },
      error_callback: (err) => reject(new DriveError(
        err?.type === "popup_failed_to_open" ? "The Google sign-in window was blocked. Allow pop-ups for this site and try again."
          : err?.type === "popup_closed" ? "Google sign-in was cancelled." : "Google sign-in failed.", "auth")),
    });
    client.requestAccessToken({ prompt: chooseAccount ? "select_account" : "" });
  });
}

export async function disconnect() {
  const t = token;
  token = null;
  if (t && window.google?.accounts?.oauth2) {
    await new Promise((resolve) => window.google.accounts.oauth2.revoke(t.value, () => resolve()));
  }
}

// ─── Drive REST (transport replaceable in tests) ─────────────────────────
let transport = {
  fetch: (...a) => fetch(...a),
  // PUT with upload progress (fetch has none).
  put(url, body, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url);
      x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
      x.onload = () => resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, json: async () => JSON.parse(x.responseText || "{}") });
      x.onerror = () => reject(new DriveError("The upload failed. Check the connection and try again.", "network"));
      x.send(body);
    });
  },
};
export function _setTransport(t, tok) { transport = { ...transport, ...t }; if (tok) token = { value: tok, expiresAt: Date.now() + 3600000 }; }

function authHeader() {
  if (!isConnected()) throw new DriveError("Connect Google Drive first (sign-ins last about an hour).", "auth");
  return { Authorization: `Bearer ${token.value}` };
}

export async function api(url, opts = {}) {
  let res;
  try {
    res = await transport.fetch(url.startsWith("http") ? url : API + url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
  } catch (e) {
    if (e instanceof DriveError) throw e;
    throw new DriveError("Google Drive couldn't be reached. Check the connection.", "network");
  }
  if (res.status === 401) { token = null; throw new DriveError("Your Google sign-in has expired. Connect again.", "auth"); }
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json())?.error?.message || ""; } catch { /* not JSON */ }
    if (res.status === 403 && /quota|storage/i.test(msg)) throw new DriveError("Your Google Drive is full.", "quota");
    throw new DriveError(`Google Drive error ${res.status}${msg ? `: ${msg}` : ""}.`);
  }
  return opts.raw ? res : res.status === 204 ? null : res.json();
}

const q = (s) => encodeURIComponent(s);

export async function accountEmail() {
  const r = await api("/about?fields=user(emailAddress)");
  return r?.user?.emailAddress || "";
}

// The app's folder (drive.file: only folders this app created are visible).
export async function ensureFolder(name = FOLDER_NAME) {
  const found = await api(`/files?q=${q(`mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`)}&fields=files(id)&pageSize=1`);
  if (found.files?.length) return found.files[0].id;
  const made = await api("/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }) });
  return made.id;
}

export async function findFile(folderId, name) {
  const r = await api(`/files?q=${q(`'${folderId}' in parents and name='${name}' and trashed=false`)}&fields=files(id)&pageSize=1`);
  return r.files?.[0]?.id || null;
}

// Every file in a folder matching an extra query clause, all pages.
export async function listFiles(folderId, clause = "", fields = "id,name,size,createdTime,modifiedTime,appProperties") {
  const out = [];
  let page = "";
  do {
    const r = await api(`/files?q=${q(`'${folderId}' in parents and trashed=false${clause ? ` and ${clause}` : ""}`)}&pageSize=1000&fields=nextPageToken,files(${fields})${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
    out.push(...(r.files || []));
    page = r.nextPageToken || "";
  } while (page);
  return out;
}

// Change a file's metadata (e.g. appProperties) without new content.
export async function updateMeta(fileId, meta) {
  await api(`/files/${fileId}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta) });
}

export async function download(fileId) {
  const res = await api(`/files/${fileId}?alt=media`, { raw: true });
  return new Uint8Array(await res.arrayBuffer());
}

// Resumable upload (works for any size); `fileId` updates an existing file
// (`meta` then holds only the fields to change, e.g. appProperties).
export async function upload(bytes, meta, { fileId, onProgress } = {}) {
  const url = fileId ? `${UPLOAD}/files/${fileId}?uploadType=resumable` : `${UPLOAD}/files?uploadType=resumable&fields=id`;
  const init = await api(url, {
    method: fileId ? "PATCH" : "POST", raw: true,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/octet-stream" },
    body: JSON.stringify(meta || {}),
  });
  const session = init.headers.get("Location");
  if (!session) throw new DriveError("Google Drive didn't start the upload.");
  const res = await transport.put(session, new Blob([bytes], { type: "application/octet-stream" }), onProgress);
  if (!res.ok) throw new DriveError(`The upload failed (error ${res.status}).`);
  return (await res.json()).id || fileId;
}

export async function hasPassphraseCheck(folderId) {
  return !!(await findFile(folderId, CHECK_NAME));
}

// The passphrase check file lets later backups (and other devices) confirm the
// same passphrase is used. → "match" | "mismatch" | "none"
export async function checkPassphrase(folderId, passphrase) {
  const id = await findFile(folderId, CHECK_NAME);
  if (!id) return "none";
  try {
    return dec.decode(await decryptBackup(await download(id), passphrase)) === CHECK_TEXT ? "match" : "mismatch";
  } catch (e) {
    if (e.kind === "passphrase") return "mismatch";
    throw e;
  }
}

export async function setPassphraseCheck(folderId, passphrase) {
  const bytes = await encryptBackup(enc.encode(CHECK_TEXT), passphrase);
  const id = await findFile(folderId, CHECK_NAME);
  return upload(bytes, id ? {} : { name: CHECK_NAME, parents: [folderId], mimeType: "application/octet-stream" }, { fileId: id || undefined });
}

// Upload a backup Blob, encrypted when a passphrase is given (.csb), else as
// the plain backup file (.cephx). → { id, name, size, encrypted }
export async function uploadBackup(folderId, blob, passphrase, { cases = 0, onProgress } = {}) {
  const encrypted = !!passphrase;
  onProgress?.(0, encrypted ? "Encrypting…" : "Preparing…");
  const plain = new Uint8Array(await blob.arrayBuffer());
  const bytes = encrypted ? await encryptBackup(plain, passphrase, { cases }) : plain;
  const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
  const name = `Cephalometry-Studio-backup-${stamp}.${encrypted ? "csb" : "cephx"}`;
  const n = `${cases} case${cases === 1 ? "" : "s"}`;
  const id = await upload(bytes, {
    name, parents: [folderId], mimeType: encrypted ? "application/octet-stream" : "application/json",
    description: encrypted
      ? `Encrypted Cephalometry Studio backup (${n}). Restore it in the app with your backup passphrase.`
      : `Cephalometry Studio backup (${n}), not encrypted. Restore it in the app or with Import.`,
    appProperties: { cephBackup: "1", cases: String(cases), encrypted: encrypted ? "1" : "0" },
  }, { onProgress: (f) => onProgress?.(f, "Uploading…") });
  return { id, name, size: bytes.length, encrypted };
}

// Newest first. → [{ id, name, size, createdTime, cases, encrypted }]
export async function listBackups(folderId) {
  const r = await api(`/files?q=${q(`'${folderId}' in parents and trashed=false and appProperties has { key='cephBackup' and value='1' }`)}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,size,createdTime,appProperties)`);
  return (r.files || []).map((f) => ({
    id: f.id, name: f.name, size: Number(f.size) || 0, createdTime: f.createdTime,
    cases: Number(f.appProperties?.cases) || 0, encrypted: f.appProperties?.encrypted !== "0",
  }));
}

// Download (and decrypt when encrypted) → the backup's text (JSON).
export async function fetchBackup(fileId, passphrase) {
  const bytes = await download(fileId);
  if (!isEncryptedBackup(bytes)) return dec.decode(bytes);
  if (!passphrase) throw new DriveError("This backup is encrypted: enter the passphrase it was made with.", "passphrase");
  return dec.decode(await decryptBackup(bytes, passphrase));
}

// Moves to the Drive trash (recoverable there for 30 days).
export async function trashBackup(fileId) {
  await api(`/files/${fileId}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
}

// ─── Last backup (this device) ───────────────────────────────────────────
export function lastBackup() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch { return null; }
}
export function recordBackup(info) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), ...info })); } catch { /* storage blocked */ }
}
