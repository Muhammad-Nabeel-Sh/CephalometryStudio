import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory, IDBDatabase } from "fake-indexeddb";

// ═════════════════════════════════════════════════════════════════
// Case storage in encrypted IndexedDB records + migration from the
// localStorage envelope (Phase 2, item 17). fake-indexeddb gives real
// IndexedDB semantics (transactions, versions, blocking); WebCrypto is
// Node's. Each `visit()` re-imports the modules — a page load with the
// same browser storage — so module state never leaks between "visits".
// ═════════════════════════════════════════════════════════════════

const KEY = "cephalometry_projects";
const IMG = "data:image/png;base64," + btoa("radiograph-bytes-0123456789");
const IMG2 = "data:image/jpeg;base64," + btoa("second-radiograph");

function mkCase(id, { modified = 1000, created = 1, images = [], name } = {}) {
  return {
    id, name: name || `Case ${id}`, created, modified, projection: "lateral",
    meta: { patientId: `PID-${id}`, name: "Jane Doe" },
    sessions: [{ id: `s-${id}`, label: "T0", markups: [{ id: `m-${id}`, type: "point", label: "S", points: [{ x: 1, y: 2 }] }], images }],
    activeSessionId: `s-${id}`,
  };
}
const img = (id, dataUrl = IMG) => ({ id, name: "ceph", dataUrl, dx: 0, dy: 0, opacity: 1, blendMode: "normal", visible: true, color: "none", transform: { tx: 0, ty: 0, rot: 0, scale: 1 } });

async function visit() {
  vi.resetModules();
  return {
    store: await import("../storage/projectStore.js"),
    images: await import("../storage/imageStore.js"),
    secure: await import("../storage/secureStorage.js"),
  };
}

// Raw access to the app database, bypassing the modules under test.
function rawDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("Cephalometry Studio");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function raw(store, key) {
  const db = await rawDB();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally { db.close(); }
}
async function rawKeys(store) {
  const db = await rawDB();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally { db.close(); }
}
async function rawPut(store, key, value) {
  const db = await rawDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
const text = (buf) => new TextDecoder().decode(new Uint8Array(buf));
const byId = (list) => Object.fromEntries(list.map(p => [p.id, p]));

let events;
const onEvent = (e) => events.push(e.detail);

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  events = [];
  window.addEventListener("Cephalometry Studio:storage-warning", onEvent);
});
afterEach(() => {
  window.removeEventListener("Cephalometry Studio:storage-warning", onEvent);
  vi.restoreAllMocks();
});

describe("projectStore — IndexedDB records", () => {
  it("saves cases as encrypted records and writes nothing to localStorage", async () => {
    const { store } = await visit();
    expect(await store.loadProjects()).toEqual([]);
    expect(await store.saveProjects([mkCase("a"), mkCase("b")])).toBe(true);
    expect(store._storageBackend()).toBe("idb");
    expect(localStorage.getItem(KEY)).toBeNull();
    const rec = await raw("projects", "a");
    expect(rec.enc).toBe(true);
    expect(rec.json).toBeUndefined();
    expect(text(rec.ct)).not.toContain("Jane Doe");

    const next = await visit();
    const loaded = await next.store.loadProjects();
    expect(loaded.map(p => p.id)).toEqual(["a", "b"]);
    expect(loaded[0].meta.name).toBe("Jane Doe");
    expect(loaded[0].sessions[0].markups[0].points).toEqual([{ x: 1, y: 2 }]);
  });

  it("keeps images out of the case record and encrypted in the image store", async () => {
    const { store, images } = await visit();
    await store.loadProjects();
    await store.saveProjects([mkCase("a", { images: [img("i1")] })]);
    const imgRec = await raw("images", "i1");
    expect(imgRec.enc).toBe(true);
    expect(text(imgRec.ct)).not.toContain("radiograph");
    expect(await images.getImageDataUrl("i1")).toBe(IMG);

    const next = await visit();
    const [p] = await next.store.loadProjects();
    expect(p.sessions[0].images[0].id).toBe("i1");
    expect(p.sessions[0].images[0].dataUrl).toBeNull();
    const { project, missing } = await next.store.hydrateProjectImages(p);
    expect(missing).toBe(0);
    expect(project.sessions[0].images[0].dataUrl).toBe(IMG);
  });

  it("rewrites only changed cases and deletes only cases this tab removed", async () => {
    const tabA = await visit();
    await tabA.store.loadProjects();
    await tabA.store.saveProjects([mkCase("a"), mkCase("b")]);
    const ivB = Array.from((await raw("projects", "b")).iv);

    const tabB = await visit(); // a second tab, opened after A saved
    expect((await tabB.store.loadProjects()).map(p => p.id)).toEqual(["a", "b"]);

    await tabA.store.saveProjects([mkCase("a", { name: "A edited" }), mkCase("b"), mkCase("c")]);
    expect(Array.from((await raw("projects", "b")).iv)).toEqual(ivB); // unchanged → not rewritten

    // Tab B never saw case c; it removes b and edits a.
    await tabB.store.saveProjects([mkCase("a", { name: "A from B", modified: 2000 })]);

    const after = byId(await (await visit()).store.loadProjects());
    expect(Object.keys(after).sort()).toEqual(["a", "c"]);
    expect(after.a.name).toBe("A from B");
  });

  it("an empty or failed load can never wipe stored cases", async () => {
    const first = await visit();
    await first.store.loadProjects();
    await first.store.saveProjects([mkCase("a"), mkCase("b")]);
    // A record this browser can't decrypt (e.g. written with a lost key).
    await rawPut("projects", "z", { v: 1, enc: true, iv: new Uint8Array(12), ct: new Uint8Array(40).buffer });

    const { store } = await visit();
    const loaded = await store.loadProjects();
    expect(loaded.map(p => p.id).sort()).toEqual(["a", "b"]);
    expect(events.some(e => e.kind === "unreadable")).toBe(true);
    await store.saveProjects([]); // the user deleted a and b; z is unknown here
    expect((await rawKeys("projects")).sort()).toEqual(["z"]);
  });

  it("keeps the stored order of cases", async () => {
    const { store } = await visit();
    await store.loadProjects();
    await store.saveProjects([mkCase("m"), mkCase("a"), mkCase("x")]);
    expect((await (await visit()).store.loadProjects()).map(p => p.id)).toEqual(["m", "a", "x"]);
  });

  it("saveProjects before loadProjects writes nothing", async () => {
    const { store } = await visit();
    expect(await store.saveProjects([mkCase("a")])).toBe(false);
    await store.loadProjects();
    expect(await rawKeys("projects")).toEqual([]);
  });

  it("loads once per page even when called twice (React StrictMode)", async () => {
    const legacy = await visit();
    localStorage.setItem(KEY, JSON.stringify(await legacy.secure.encryptJSON([mkCase("a")])));
    const { store } = await visit();
    const [p1, p2] = await Promise.all([store.loadProjects(), store.loadProjects()]);
    expect(p1).toBe(p2);
    expect(localStorage.getItem(KEY)).not.toBeNull(); // not retired in the same visit
  });
});

describe("projectStore — migration from localStorage", () => {
  it("moves an encrypted envelope, keeps it until a later load, then removes it", async () => {
    const legacy = await visit();
    localStorage.setItem(KEY, JSON.stringify(await legacy.secure.encryptJSON([mkCase("a"), mkCase("b")])));

    const first = await visit();
    expect((await first.store.loadProjects()).map(p => p.id)).toEqual(["a", "b"]);
    expect(first.store._storageBackend()).toBe("idb");
    expect((await raw("projects", "a")).enc).toBe(true);
    expect(localStorage.getItem(KEY)).not.toBeNull(); // old copy kept on the first visit
    expect((await raw("meta", "projects")).legacyAbsorbedAt).toBeGreaterThan(0);

    const second = await visit();
    expect((await second.store.loadProjects()).map(p => p.id)).toEqual(["a", "b"]);
    expect(localStorage.getItem(KEY)).toBeNull(); // read back from IndexedDB → retired
    expect((await (await visit()).store.loadProjects()).length).toBe(2);
  });

  it("moves the very old plaintext array form", async () => {
    localStorage.setItem(KEY, JSON.stringify([mkCase("old")]));
    const { store } = await visit();
    const [p] = await store.loadProjects();
    expect(p.id).toBe("old");
    expect((await raw("projects", "old")).enc).toBe(true);
  });

  it("moves an image kept inline in the envelope into the image store", async () => {
    // Inline dataUrls happen when image storage failed when the case was saved.
    localStorage.setItem(KEY, JSON.stringify([mkCase("a", { images: [img("i1")] })]));
    const { store, images } = await visit();
    await store.loadProjects();
    expect(await images.getImageDataUrl("i1")).toBe(IMG);
    const [p] = await (await visit()).store.loadProjects();
    expect(p.sessions[0].images[0].dataUrl).toBeNull(); // record no longer carries it
  });

  it("normalizes the legacy session.image shape on the way", async () => {
    const c = mkCase("a");
    c.sessions[0].images = undefined;
    c.sessions[0].image = { id: "legacy-img", name: "x", dataUrl: null };
    localStorage.setItem(KEY, JSON.stringify([c]));
    const [p] = await (await visit()).store.loadProjects();
    expect(p.sessions[0].images.map(i => i.id)).toEqual(["legacy-img"]);
    expect(p.sessions[0].image).toBeUndefined();
  });

  it("if the move fails, keeps the localStorage copy and keeps saving there", async () => {
    localStorage.setItem(KEY, JSON.stringify([mkCase("a")]));
    const orig = IDBDatabase.prototype.transaction;
    const spy = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (stores, mode) {
      if (mode === "readwrite" && [].concat(stores).includes("projects")) throw new DOMException("Full", "QuotaExceededError");
      return orig.call(this, stores, mode);
    });
    const { store } = await visit();
    expect((await store.loadProjects()).map(p => p.id)).toEqual(["a"]);
    expect(store._storageBackend()).toBe("ls");
    expect(events.some(e => e.kind === "migration-failed")).toBe(true);
    expect(await store.saveProjects([mkCase("a"), mkCase("b")])).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)).enc).toBe(true);
    spy.mockRestore();

    // Next visit: the move is retried and now succeeds, with the newer case.
    const next = await visit();
    expect((await next.store.loadProjects()).map(p => p.id).sort()).toEqual(["a", "b"]);
    expect(next.store._storageBackend()).toBe("idb");
    expect((await rawKeys("projects")).sort()).toEqual(["a", "b"]);
  });

  it("an envelope that can't be decrypted is reported and left in place", async () => {
    const lost = JSON.stringify({ v: 1, enc: true, iv: btoa("123456789012"), ct: btoa("not really ciphertext") });
    localStorage.setItem(KEY, lost);
    const { store } = await visit();
    expect(await store.loadProjects()).toEqual([]);
    expect(events.some(e => e.kind === "key-loss")).toBe(true);
    await store.saveProjects([mkCase("new")]);
    await (await visit()).store.loadProjects();
    await (await visit()).store.loadProjects();
    expect(localStorage.getItem(KEY)).toBe(lost); // never retired while unreadable
  });

  it("merges cases an older build saved to localStorage after the move", async () => {
    localStorage.setItem(KEY, JSON.stringify([mkCase("a", { modified: 100 }), mkCase("b", { modified: 100 }), mkCase("c", { modified: 100 })]));
    const first = await visit();
    await first.store.loadProjects();
    // In the new build: a is edited, c is deleted.
    await first.store.saveProjects([mkCase("a", { modified: 200, name: "A new" }), mkCase("b", { modified: 100 })]);

    // Meanwhile a tab still running the old build saves its whole envelope:
    // its a is older, its b is newer, c is its stale copy, d is new there.
    const later = Date.now() + 60000;
    localStorage.setItem(KEY, JSON.stringify([
      mkCase("a", { modified: 150, name: "A old tab" }),
      mkCase("b", { modified: later, name: "B old tab" }),
      mkCase("c", { modified: 100 }),
      mkCase("d", { modified: later, created: later }),
    ]));

    const merged = byId(await (await visit()).store.loadProjects());
    expect(Object.keys(merged).sort()).toEqual(["a", "b", "d"]); // c stays deleted
    expect(merged.a.name).toBe("A new");
    expect(merged.b.name).toBe("B old tab");
    expect(events.some(e => e.kind === "legacy-merged" && /2 cases/.test(e.message))).toBe(true);
    expect(localStorage.getItem(KEY)).not.toBeNull(); // kept until the next load reads it back
    await (await visit()).store.loadProjects();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("projectStore — fallback, clearing, sweep, backup", () => {
  it("falls back to localStorage when IndexedDB is unavailable", async () => {
    delete globalThis.indexedDB;
    const { store } = await visit();
    expect(await store.loadProjects()).toEqual([]);
    expect(store._storageBackend()).toBe("ls");
    expect(await store.saveProjects([mkCase("a")])).toBe(true);
    const env = JSON.parse(localStorage.getItem(KEY));
    expect(env.enc).toBe(false); // no IndexedDB → no key store → plaintext envelope (warned)
    expect((await (await visit()).store.loadProjects()).map(p => p.id)).toEqual(["a"]);
  });

  it("never overwrites a localStorage envelope it couldn't read", async () => {
    delete globalThis.indexedDB;
    const unreadable = JSON.stringify({ v: 1, enc: true, iv: "AAAA", ct: "BBBB" });
    localStorage.setItem(KEY, unreadable);
    const { store } = await visit();
    expect(await store.loadProjects()).toEqual([]);
    expect(await store.saveProjects([mkCase("a")])).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(unreadable);
  });

  it("clear removes cases, images, the old copy and the key — and saving still works after", async () => {
    const { store } = await visit();
    await store.loadProjects();
    await store.saveProjects([mkCase("a", { images: [img("i1")] })]);
    localStorage.setItem(KEY, "[]");
    await store.clearAllLocalData();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await rawKeys("projects")).toEqual([]);
    expect(await rawKeys("images")).toEqual([]);

    // The key database is deleted too; a new key must be created without the
    // delete stalling (an open key connection used to block it).
    const saved = await Promise.race([store.saveProjects([mkCase("b")]), new Promise(r => setTimeout(() => r("stalled"), 3000))]);
    expect(saved).toBe(true);
    expect((await (await visit()).store.loadProjects()).map(p => p.id)).toEqual(["b"]);
  });

  it("sweeps only images unreferenced on both checks", async () => {
    const tabA = await visit();
    await tabA.store.loadProjects();
    await tabA.store.saveProjects([mkCase("a", { images: [img("keep")] })]);
    await tabA.images.storeImageBlob("orphan", IMG);
    await tabA.images.storeImageBlob("pending", IMG2); // another tab is about to save its case

    const tabB = await visit();
    await tabB.store.loadProjects();
    const sweep = tabB.store.sweepOrphanImages({ delayMs: 80 });
    await new Promise(r => setTimeout(r, 20));
    await tabA.store.saveProjects([mkCase("a", { images: [img("keep")] }), mkCase("p", { images: [img("pending", IMG2)] })]);
    expect(await sweep).toBe(1);
    expect((await rawKeys("images")).sort()).toEqual(["keep", "pending"]);
  });

  it("keeps a 16-bit image's original pixels encrypted while referenced, and deletes them with it", async () => {
    const { store, images } = await visit();
    await store.loadProjects();
    const meta = { width: 2, height: 2, dtype: "uint16", bitsStored: 12, smin: 1, smax: 4000 };
    expect(await images.storeRawPixels("raw:i1", Uint16Array.from([1, 2, 3, 4000]), meta)).toEqual({ ok: true });
    const rec = await raw("images", "raw:i1");
    expect(rec).toMatchObject({ enc: true, kind: "raw" });
    expect(rec.bytes).toBeUndefined();
    const back = await images.getRawPixels("raw:i1");
    expect(back.pixels).toBeInstanceOf(Uint16Array);
    expect(Array.from(back.pixels)).toEqual([1, 2, 3, 4000]);
    expect(back.meta).toEqual(meta);

    await store.saveProjects([mkCase("a", { images: [{ ...img("i1"), raw: { key: "raw:i1", bits: 12 } }] })]);
    expect(await store.sweepOrphanImages({ delayMs: 10 })).toBe(0);
    expect((await rawKeys("images")).sort()).toEqual(["i1", "raw:i1"]);
    await store.saveProjects([mkCase("a")]); // the image was removed
    expect(await rawKeys("images")).toEqual([]);
    expect(await images.getRawPixels("raw:i1")).toBeNull();
  });

  it("deletes the images of a removed session on the next save", async () => {
    const { store } = await visit();
    await store.loadProjects();
    await store.saveProjects([mkCase("a", { images: [img("i1")] }), mkCase("b", { images: [img("i2", IMG2)] })]);
    await store.saveProjects([mkCase("a", { images: [img("i1")] })]);
    expect(await rawKeys("images")).toEqual(["i1"]);
  });

  it("a backup holds every case with its images and restores through the .cephx importer", async () => {
    const { store } = await visit();
    await store.loadProjects();
    await store.saveProjects([mkCase("a", { images: [img("i1")] }), mkCase("b")]);
    const [a, b] = await (await visit()).store.loadProjects(); // images come back as dataUrl:null
    const { blob, count, missing } = await store.buildBackupBlob([a, b]);
    expect([count, missing]).toEqual([2, 0]);
    const payload = JSON.parse(await blob.text());
    const fmt = await import("../storage/cephxFormat.js");
    expect(fmt.isBackupPayload(payload)).toBe(true);
    const res = fmt.parseBackupPayload(payload);
    expect(res.ok).toBe(true);
    expect(res.projects.map(p => p.id)).toEqual(["a", "b"]);
    expect(res.projects[0].sessions[0].images[0].dataUrl).toBe(IMG);
    expect(res.projects[0].meta.name).toBe("Jane Doe");
  });

  it("restoring skips broken entries instead of failing", async () => {
    const fmt = await import("../storage/cephxFormat.js");
    const good = fmt.buildCephxPayload(mkCase("a"));
    const res = fmt.parseBackupPayload({ format: "cephx-backup", version: "1.0", cases: [good, { format: "cephx", project: { id: "x" } }] });
    expect(res.ok).toBe(true);
    expect(res.projects.map(p => p.id)).toEqual(["a"]);
    expect(res.skipped).toBe(1);
    expect(fmt.parseBackupPayload({ format: "cephx" }).ok).toBe(false);
  });

  it("hydrateProjectImages counts images it can't find", async () => {
    const { store } = await visit();
    await store.loadProjects();
    const { missing, project } = await store.hydrateProjectImages(mkCase("a", { images: [{ ...img("gone"), dataUrl: null }] }));
    expect(missing).toBe(1);
    expect(project.sessions[0].images[0].dataUrl).toBeNull();
  });
});
