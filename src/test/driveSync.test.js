import { describe, it, expect, beforeEach } from "vitest";
import {
  syncCases, applySyncResult, makeCipher, createSyncConfig, unlockSyncKey, caseJson,
} from "../storage/driveSync.js";

// ═════════════════════════════════════════════════════════════════
// Cross-device sync. One in-memory Drive folder, two simulated devices
// (each with its own cases, image store and sync state), running the
// real engine. Covers every reconcile rule, encryption, and that a
// second sync with no edits changes nothing.
// ═════════════════════════════════════════════════════════════════

function memoryDrive() {
  const files = new Map();
  let seq = 0;
  return {
    files,
    list: async () => [...files.values()].map(({ id, name, appProperties }) => ({ id, name, appProperties: { ...appProperties } })),
    download: async (id) => files.get(id).bytes.slice(),
    create: async (name, bytes, appProperties) => { const id = `f${++seq}`; files.set(id, { id, name, bytes: bytes.slice(), appProperties: { ...appProperties } }); return id; },
    update: async (id, bytes, appProperties) => { const f = files.get(id); f.bytes = bytes.slice(); f.appProperties = { ...f.appProperties, ...appProperties }; },
  };
}

function device(drive, cipher) {
  const store = new Map(); // image key → payload
  const dev = {
    cases: [],
    state: null,
    images: {
      keys: async () => new Set(store.keys()),
      read: async (k) => store.get(k) || null,
      write: async (k, v) => { store.set(k, v); return true; },
    },
    store,
    answer: true, // reply to "remove cases deleted elsewhere?"
    asked: [],
    async sync() {
      const snapshot = dev.cases;
      const res = await syncCases({
        cases: snapshot, state: dev.state, drive, cipher, images: dev.images,
        confirmRemovals: async (list) => { dev.asked.push(list.map((p) => p.name)); return dev.answer; },
      });
      dev.cases = applySyncResult(dev.cases, snapshot, res);
      dev.state = res.state;
      return res.report;
    },
  };
  return dev;
}

const mkCase = (id, name, imgId) => ({
  id, name, modified: 1, meta: { name: "Jane Doe" },
  sessions: [{ id: `s-${id}`, markups: [{ id: "m", type: "point", label: "S", points: [{ x: 1, y: 2 }] }], images: imgId ? [{ id: imgId, name: "ceph.png", dataUrl: null }] : [] }],
});
const edit = (dev, id, patch) => { dev.cases = dev.cases.map((p) => (p.id === id ? { ...p, ...patch } : p)); };
const names = (dev) => dev.cases.map((p) => p.name).sort();
const IMG = new Uint8Array([1, 2, 3, 4, 5]);

describe("sync between two devices", () => {
  let drive, a, b;
  beforeEach(() => {
    drive = memoryDrive();
    const plain = makeCipher(null);
    a = device(drive, plain);
    b = device(drive, plain);
  });

  it("a new device downloads every case with its images", async () => {
    a.cases = [mkCase("c1", "Case 1", "img1"), mkCase("c2", "Case 2")];
    a.store.set("img1", IMG);
    expect(await a.sync()).toMatchObject({ uploaded: 2, images: 1 });
    expect(await b.sync()).toMatchObject({ downloaded: 2, images: 1 });
    expect(names(b)).toEqual(["Case 1", "Case 2"]);
    expect(b.store.get("img1")).toEqual(IMG);
    // Nothing changes on a second round.
    expect(await a.sync()).toMatchObject({ uploaded: 0, downloaded: 0 });
    expect(await b.sync()).toMatchObject({ uploaded: 0, downloaded: 0 });
  });

  it("an edit on one device reaches the other", async () => {
    a.cases = [mkCase("c1", "Case 1")];
    await a.sync(); await b.sync();
    edit(b, "c1", { name: "Case 1 (edited on B)" });
    expect(await b.sync()).toMatchObject({ uploaded: 1 });
    expect(await a.sync()).toMatchObject({ downloaded: 1 });
    expect(names(a)).toEqual(["Case 1 (edited on B)"]);
  });

  it("edits on both devices keep both versions", async () => {
    a.cases = [mkCase("c1", "Case 1")];
    await a.sync(); await b.sync();
    edit(a, "c1", { name: "A's version" });
    edit(b, "c1", { name: "B's version" });
    await a.sync();
    const r = await b.sync();
    expect(r.conflicts).toEqual(["B's version"]);
    expect(names(b)).toEqual(["A's version (from another device)", "B's version"]);
    await a.sync();
    expect(names(a)).toEqual(["A's version (from another device)", "B's version"]);
    // and they settle
    expect(await a.sync()).toMatchObject({ uploaded: 0, downloaded: 0, conflicts: [] });
    expect(await b.sync()).toMatchObject({ uploaded: 0, downloaded: 0, conflicts: [] });
  });

  it("a deletion is applied elsewhere only when the user agrees", async () => {
    a.cases = [mkCase("c1", "Case 1"), mkCase("c2", "Case 2")];
    await a.sync(); await b.sync();
    a.cases = a.cases.filter((p) => p.id !== "c1"); // deleted on A
    expect(await a.sync()).toMatchObject({ removed: 1 });

    b.answer = false;
    await b.sync();
    expect(b.asked).toEqual([["Case 1"]]);
    expect(names(b)).toEqual(["Case 1", "Case 2"]); // kept, and uploaded again
    await a.sync();
    expect(names(a)).toEqual(["Case 1", "Case 2"]); // so A gets it back

    a.cases = a.cases.filter((p) => p.id !== "c1");
    await a.sync();
    b.answer = true;
    await b.sync();
    expect(names(b)).toEqual(["Case 2"]);
  });

  it("a case edited here survives a deletion made elsewhere", async () => {
    a.cases = [mkCase("c1", "Case 1")];
    await a.sync(); await b.sync();
    a.cases = [];
    await a.sync();
    edit(b, "c1", { name: "Still needed" });
    await b.sync();
    expect(b.asked).toEqual([]); // no question: the edit wins
    await a.sync();
    expect(names(a)).toEqual(["Still needed"]);
  });

  it("the same case on both devices before the first sync isn't duplicated", async () => {
    const c = mkCase("c1", "Case 1");
    a.cases = [c];
    b.cases = [JSON.parse(caseJson(c))]; // e.g. restored from the same backup
    await a.sync();
    const r = await b.sync();
    expect(r.conflicts).toEqual([]);
    expect(names(b)).toEqual(["Case 1"]);
  });

  it("cases edited while a sync ran are not overwritten", async () => {
    a.cases = [mkCase("c1", "Case 1")];
    await a.sync(); await b.sync();
    edit(a, "c1", { name: "From A" });
    await a.sync();
    const snapshot = b.cases;
    const res = await syncCases({ cases: snapshot, state: b.state, drive, cipher: makeCipher(null), images: b.images, confirmRemovals: async () => true });
    const editedMeanwhile = snapshot.map((p) => ({ ...p, name: "Typed on B during sync" }));
    expect(applySyncResult(editedMeanwhile, snapshot, res).map((p) => p.name)).toEqual(["Typed on B during sync"]);
  });
});

describe("encrypted sync", () => {
  it("keeps patient data out of Drive and needs the passphrase on a new device", async () => {
    const drive = memoryDrive();
    const { config, key } = await createSyncConfig("correct horse battery", { iterations: 1000 });
    expect(JSON.stringify(config)).not.toContain("correct horse");
    const a = device(drive, makeCipher(key));
    a.cases = [mkCase("c1", "Case 1", "img1")];
    a.store.set("img1", IMG);
    await a.sync();
    for (const f of drive.files.values()) expect(new TextDecoder().decode(f.bytes)).not.toContain("Jane Doe");

    await expect(unlockSyncKey(config, "wrong passphrase")).rejects.toMatchObject({ kind: "passphrase" });
    const b = device(drive, makeCipher(await unlockSyncKey(config, "correct horse battery")));
    await b.sync();
    expect(b.cases[0].meta.name).toBe("Jane Doe");
    expect(b.store.get("img1")).toEqual(IMG);
  });

  it("without a passphrase the folder needs no key", async () => {
    const { config, key } = await createSyncConfig(null);
    expect(config.encrypted).toBe(false);
    expect(key).toBeNull();
  });
});
