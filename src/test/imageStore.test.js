import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ═════════════════════════════════════════════════════════════════
// imageStore — integrity behaviors fixed in D1/D2/D3/D6.
//   • storeImageBlob resolves (never rejects) and reports {ok, error?} so the
//     autosave can fall back to keeping the dataUrl in localStorage instead of
//     dropping it (D1/D3).
//   • deleteOrphanBlobs garbage-collects blobs no longer referenced by any
//     project (D2) — warm diff against a known-id baseline and a cold full scan.
//   • Schema-migration scaffolding + availability gating (D3/D6).
// jsdom has no real IndexedDB, so the available-path tests use a minimal
// hand-rolled IDB shim (scoped to exactly what imageStore exercises).
// ═════════════════════════════════════════════════════════════════

// ─── Minimal fake IndexedDB ───────────────────────────────────────────────
// Store ops fire as microtasks; transaction `oncomplete` fires as a macrotask
// (setTimeout 0) so all queued ops drain first — matching the real API's
// "complete after all requests" ordering that storeImageBlob relies on.
function createFakeIndexedDB() {
  const stores = new Map(); // storeName -> Map(key, value)
  function makeRequest(compute) {
    const req = { result: undefined, error: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try { req.result = compute(); if (req.onsuccess) req.onsuccess({ target: req }); }
      catch (e) { req.error = e; if (req.onerror) req.onerror({ target: req }); }
    });
    return req;
  }
  function storeFor(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      put: (v, k) => makeRequest(() => { map.set(k, v); }),
      get: (k) => makeRequest(() => (map.has(k) ? map.get(k) : undefined)),
      delete: (k) => makeRequest(() => { map.delete(k); }),
      clear: () => makeRequest(() => { map.clear(); }),
      getAllKeys: () => makeRequest(() => Array.from(map.keys())),
      openCursor: () => {
        const keys = Array.from(map.keys());
        const req = { result: null, onsuccess: null, onerror: null };
        let i = 0;
        const step = () => {
          req.result = i < keys.length ? { key: keys[i], continue: () => { i++; queueMicrotask(step); } } : null;
          if (req.onsuccess) req.onsuccess({ target: req });
        };
        queueMicrotask(step);
        return req;
      },
    };
  }
  function makeDB(version) {
    return {
      version,
      objectStoreNames: { contains: (n) => stores.has(n) },
      createObjectStore: (name) => { stores.set(name, stores.get(name) || new Map()); return storeFor(name); },
      transaction: (name) => {
        const tx = { _name: name, oncomplete: null, onerror: null, onabort: null,
          objectStore: (n) => storeFor(n || name) };
        setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
        return tx;
      },
      close: () => {},
      onversionchange: null,
    };
  }
  return {
    open: (name, version) => {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      queueMicrotask(() => {
        const db = makeDB(version);
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req, oldVersion: 0, newVersion: version });
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
    _stores: stores,
  };
}

describe("imageStore", () => {
  beforeEach(() => { vi.resetModules(); try { delete window.indexedDB; } catch {} }); // eslint-disable-line no-empty
  afterEach(() => { try { delete window.indexedDB; } catch {} }); // eslint-disable-line no-empty

  async function withFakeIdb(fn) {
    window.indexedDB = createFakeIndexedDB();
    const m = await import("../storage/imageStore.js");
    return fn(m);
  }

  // ─── Unavailable path (D3) ──────────────────────────────────────────────
  it("idbAvailable() is false without IndexedDB", async () => {
    const m = await import("../storage/imageStore.js");
    expect(m.idbAvailable()).toBe(false);
  });

  it("storeImageBlob never rejects and reports 'unavailable' when IDB is missing (D3)", async () => {
    const m = await import("../storage/imageStore.js");
    const r = await m.storeImageBlob("id1", "data:image/png;base64,AAAA");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("unavailable");
  });

  it("getImageDataUrl returns null when IDB is missing", async () => {
    const m = await import("../storage/imageStore.js");
    expect(await m.getImageDataUrl("id1")).toBeNull();
  });

  // ─── Orphan GC logic (D2) ───────────────────────────────────────────────
  it("deleteOrphanBlobs warm-diffs the known-id baseline and reports dropped ids (D2)", async () => {
    const m = await import("../storage/imageStore.js");
    // IDB unavailable → deleteImageBlob is a no-op, but the returned count
    // reflects the diff: b and d dropped out of [a,b,c,d].
    const n = await m.deleteOrphanBlobs(new Set(["a", "c"]), new Set(["a", "b", "c", "d"]));
    expect(n).toBe(2);
  });

  it("deleteOrphanBlobs warm path returns 0 when nothing dropped", async () => {
    const m = await import("../storage/imageStore.js");
    const n = await m.deleteOrphanBlobs(new Set(["a", "b"]), new Set(["a", "b"]));
    expect(n).toBe(0);
  });

  it("deleteOrphanBlobs cold path returns 0 when IDB unavailable (no keys to scan)", async () => {
    const m = await import("../storage/imageStore.js");
    const n = await m.deleteOrphanBlobs(new Set(["a", "b"]));
    expect(n).toBe(0);
  });

  // ─── Available path (fake IDB): store/get/delete round-trip + GC sweep ──
  it("idbAvailable() is true once a fake IDB is installed", async () => {
    await withFakeIdb(async (m) => { expect(m.idbAvailable()).toBe(true); });
  });

  it("storeImageBlob round-trips a dataUrl through the blob store (D1)", async () => {
    await withFakeIdb(async (m) => {
      const data = "data:image/png;base64,AAAA";
      expect(await m.storeImageBlob("id1", data)).toEqual({ ok: true });
      const out = await m.getImageDataUrl("id1");
      expect(typeof out).toBe("string");
      expect(out.startsWith("data:")).toBe(true);
    });
  });

  it("storeImageBlob reports bad-data for a non-dataUrl payload", async () => {
    await withFakeIdb(async (m) => {
      const r = await m.storeImageBlob("id1", "not-a-data-url");
      expect(r.ok).toBe(false);
      expect(r.error).toBe("bad-data");
    });
  });

  it("deleteImageBlob removes a stored blob", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("id1", "data:image/png;base64,AAAA");
      await m.deleteImageBlob("id1");
      expect(await m.getImageDataUrl("id1")).toBeNull();
    });
  });

  it("getAllImageKeys returns every stored key", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("k1", "data:image/png;base64,AAAA");
      await m.storeImageBlob("k2", "data:image/png;base64,BBbb");
      const keys = await m.getAllImageKeys();
      expect(keys.slice().sort()).toEqual(["k1", "k2"]);
    });
  });

  it("deleteOrphanBlobs cold sweep deletes only unreferenced blobs (D2)", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("keep", "data:image/png;base64,AAAA");
      await m.storeImageBlob("orphan", "data:image/png;base64,BBbb");
      const n = await m.deleteOrphanBlobs(new Set(["keep"])); // no prevKnown → full scan
      expect(n).toBe(1);
      expect(await m.getImageDataUrl("keep")).toBeTruthy();
      expect(await m.getImageDataUrl("orphan")).toBeNull();
    });
  });

  it("deleteOrphanBlobs warm sweep deletes only dropped ids (D2)", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("keep", "data:image/png;base64,AAAA");
      await m.storeImageBlob("gone", "data:image/png;base64,BBbb");
      const n = await m.deleteOrphanBlobs(new Set(["keep"]), new Set(["keep", "gone"]));
      expect(n).toBe(1);
      expect(await m.getImageDataUrl("keep")).toBeTruthy();
      expect(await m.getImageDataUrl("gone")).toBeNull();
    });
  });

  // ─── Encryption at rest (DB v2) ─────────────────────────────────────────
  it("stores new images encrypted, not as plain blobs", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("id1", "data:image/png;base64,AAAA");
      const rec = window.indexedDB._stores.get("images").get("id1");
      expect(rec.enc).toBe(true);
      expect(rec.type).toBe("image/png");
      expect(rec.iv).toBeTruthy();
    });
  });

  it("encryptLegacyImages converts images stored before v2 and keeps them readable", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("new", "data:image/png;base64,AAAA"); // opens the DB
      const images = window.indexedDB._stores.get("images");
      images.set("old", new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: "image/png" }));
      const before = await m.getImageDataUrl("old"); // legacy blobs still read
      expect(before.startsWith("data:image/png;base64,")).toBe(true);

      expect(await m.encryptLegacyImages()).toEqual({ encrypted: 1, failed: 0 });
      expect(images.get("old").enc).toBe(true);
      expect(await m.getImageDataUrl("old")).toBe(before);
      // Recorded as done: the next visit doesn't rescan every image.
      expect(await m.encryptLegacyImages()).toEqual({ encrypted: 0, failed: 0 });
    });
  });

  it("clearImageBlobs removes every blob", async () => {
    await withFakeIdb(async (m) => {
      await m.storeImageBlob("k1", "data:image/png;base64,AAAA");
      await m.storeImageBlob("k2", "data:image/png;base64,BBbb");
      await m.clearImageBlobs();
      expect(await m.getAllImageKeys()).toEqual([]);
    });
  });
});
