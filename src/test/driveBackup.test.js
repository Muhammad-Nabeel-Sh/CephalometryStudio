import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptBackup, decryptBackup, readBackupHeader, DriveError, _setTransport,
  ensureFolder, uploadBackup, listBackups, fetchBackup, checkPassphrase, setPassphraseCheck, trashBackup, FOLDER_NAME,
} from "../storage/driveBackup.js";

// ═════════════════════════════════════════════════════════════════
// Google Drive backups: the encrypted container, and the Drive REST
// calls against an in-memory fake Drive (no network). Key derivation
// uses few rounds here; the app uses 600 000.
// ═════════════════════════════════════════════════════════════════

const FAST = { iterations: 1000 };
const text = (u8) => new TextDecoder().decode(u8);

describe("encrypted backup container", () => {
  it("round-trips and keeps patient data out of the file", async () => {
    const plain = new TextEncoder().encode(JSON.stringify({ patient: "Jane Doe", cases: [1, 2] }));
    const box = await encryptBackup(plain, "correct horse battery", { cases: 2 }, FAST);
    expect(text(box)).not.toContain("Jane Doe");
    expect(readBackupHeader(box).header).toMatchObject({ v: 1, cases: 2, kdf: { name: "PBKDF2", iterations: 1000 }, cipher: { name: "AES-GCM" } });
    expect(text(await decryptBackup(box, "correct horse battery"))).toContain("Jane Doe");
  });

  it("rejects a wrong passphrase, a tampered header and a foreign file", async () => {
    const box = await encryptBackup(new Uint8Array([1, 2, 3]), "passphrase-one", {}, FAST);
    await expect(decryptBackup(box, "passphrase-two")).rejects.toMatchObject({ kind: "passphrase" });
    const tampered = box.slice();
    tampered[text(tampered).indexOf("Cephalometry")] ^= 1; // still valid JSON, but the header is authenticated
    await expect(decryptBackup(tampered, "passphrase-one")).rejects.toMatchObject({ kind: "passphrase" });
    const broken = box.slice();
    broken[9] = 0x7b; // header no longer JSON
    await expect(decryptBackup(broken, "passphrase-one")).rejects.toBeInstanceOf(DriveError);
    expect(() => readBackupHeader(new Uint8Array(20))).toThrow(/not a Cephalometry Studio/);
  });

  it("uses a fresh salt and IV every time", async () => {
    const a = readBackupHeader(await encryptBackup(new Uint8Array([1]), "same passphrase", {}, FAST)).header;
    const b = readBackupHeader(await encryptBackup(new Uint8Array([1]), "same passphrase", {}, FAST)).header;
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
  });
});

// ─── A tiny in-memory Drive ───────────────────────────────────────────────
function fakeDrive() {
  const files = new Map(); // id → { id, name, parents, mimeType, appProperties, trashed, createdTime, bytes }
  const sessions = new Map(); // session url → { meta, fileId }
  let seq = 0;
  const json = (body, status = 200, headers = {}) => ({ ok: status < 300, status, json: async () => body, headers: { get: (k) => headers[k] ?? null }, arrayBuffer: async () => body });
  const match = (f, query) => {
    if (f.trashed) return false;
    const parent = query.match(/'([^']+)' in parents/)?.[1];
    const name = query.match(/name='([^']+)'/)?.[1];
    if (parent && !(f.parents || []).includes(parent)) return false;
    if (name && f.name !== name) return false;
    if (/mimeType='application\/vnd.google-apps.folder'/.test(query) && f.mimeType !== "application/vnd.google-apps.folder") return false;
    if (/key='cephBackup'/.test(query) && f.appProperties?.cephBackup !== "1") return false;
    return true;
  };
  return {
    files,
    fetch: async (url, opts = {}) => {
      expect(opts.headers?.Authorization).toBe("Bearer test-token");
      const u = new URL(url);
      const method = opts.method || "GET";
      if (u.pathname.startsWith("/upload/")) {
        const id = u.pathname.split("/files/")[1];
        const s = `https://upload.example/session/${++seq}`;
        sessions.set(s, { meta: JSON.parse(opts.body || "{}"), fileId: id });
        return json({}, 200, { Location: s });
      }
      if (u.pathname === "/drive/v3/files" && method === "GET") {
        const query = decodeURIComponent(u.searchParams.get("q"));
        let list = [...files.values()].filter((f) => match(f, query));
        if (/createdTime desc/.test(u.searchParams.get("orderBy") || "")) list = list.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
        return json({ files: list.map(({ bytes, ...f }) => ({ ...f, size: String(bytes?.length || 0) })) });
      }
      if (u.pathname === "/drive/v3/files" && method === "POST") {
        const f = { id: `f${++seq}`, ...JSON.parse(opts.body), createdTime: new Date(Date.now() + seq).toISOString() };
        files.set(f.id, f);
        return json({ id: f.id });
      }
      const id = u.pathname.split("/files/")[1];
      if (method === "GET" && u.searchParams.get("alt") === "media") return json(files.get(id).bytes.buffer);
      if (method === "PATCH") { Object.assign(files.get(id), JSON.parse(opts.body)); return json({ id }); }
      throw new Error(`unexpected ${method} ${url}`);
    },
    put: async (session, blob) => {
      const { meta, fileId } = sessions.get(session);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const id = fileId || `f${++seq}`;
      files.set(id, { ...(files.get(id) || { id, createdTime: new Date(Date.now() + seq).toISOString(), ...meta }), bytes });
      return { ok: true, status: 200, json: async () => ({ id }) };
    },
  };
}

describe("Drive backup calls", () => {
  let drive;
  beforeEach(() => { drive = fakeDrive(); _setTransport(drive, "test-token"); });

  it("creates the app folder once, then reuses it", async () => {
    const a = await ensureFolder();
    const b = await ensureFolder();
    expect(a).toBe(b);
    expect([...drive.files.values()].filter((f) => f.name === FOLDER_NAME)).toHaveLength(1);
  });

  it("uploads an encrypted backup, lists it, and restores it with the passphrase", async () => {
    const folder = await ensureFolder();
    const payload = JSON.stringify({ format: "cephx-backup", version: "1.0", cases: [{ project: { name: "Jane Doe" } }] });
    const steps = [];
    const res = await uploadBackup(folder, new Blob([payload]), "a long passphrase", { cases: 1, onProgress: (f, l) => steps.push(l) });
    expect(steps[0]).toMatch(/Encrypting/);
    const stored = drive.files.get(res.id);
    expect(text(stored.bytes)).not.toContain("Jane Doe");
    expect(stored.parents).toEqual([folder]);
    const list = await listBackups(folder);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: res.id, cases: 1 });
    expect(await fetchBackup(res.id, "a long passphrase")).toBe(payload);
    await expect(fetchBackup(res.id, "wrong passphrase!")).rejects.toMatchObject({ kind: "passphrase" });
  }, 20000);

  it("checks that later backups use the same passphrase", async () => {
    const folder = await ensureFolder();
    expect(await checkPassphrase(folder, "first passphrase")).toBe("none");
    await setPassphraseCheck(folder, "first passphrase");
    expect(await checkPassphrase(folder, "first passphrase")).toBe("match");
    expect(await checkPassphrase(folder, "another one!!")).toBe("mismatch");
    await setPassphraseCheck(folder, "another one!!"); // replaces the check, doesn't add a file
    expect([...drive.files.values()].filter((f) => f.name === "passphrase-check.csb")).toHaveLength(1);
    expect(await checkPassphrase(folder, "another one!!")).toBe("match");
  }, 20000);

  it("moves a backup to the trash instead of deleting it", async () => {
    const folder = await ensureFolder();
    const { id } = await uploadBackup(folder, new Blob(["x"]), "a long passphrase");
    await trashBackup(id);
    expect(drive.files.get(id).trashed).toBe(true);
    expect(await listBackups(folder)).toEqual([]);
  }, 20000);

  it("turns an expired sign-in into a clear error", async () => {
    _setTransport({ fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
    await expect(ensureFolder()).rejects.toMatchObject({ kind: "auth" });
  });
});
