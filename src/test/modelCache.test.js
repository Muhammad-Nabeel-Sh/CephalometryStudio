import { describe, it, expect, vi, afterEach } from "vitest";
import { sha256Hex, loadModelAsset, clearModelCache, deleteModelAsset } from "../storage/modelCache.js";

const ABC_SHA = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const ABC_BUF = new TextEncoder().encode("abc").buffer;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sha256Hex", () => {
  it("computes the known SHA-256 of 'abc'", async () => {
    expect(await sha256Hex(ABC_BUF)).toBe(ABC_SHA);
  });
});

describe("loadModelAsset", () => {
  it("rejects when no URL is configured", async () => {
    await expect(loadModelAsset({})).rejects.toThrow(/No model URL/);
  });

  it("returns the downloaded buffer when the checksum matches", async () => {
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => ABC_BUF,
    })));
    const buf = await loadModelAsset({ url: "https://example.test/m.onnx", sha256: ABC_SHA });
    expect(new Uint8Array(buf)).toEqual(new Uint8Array(ABC_BUF));
  });

  it("rejects a mismatched checksum", async () => {
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => ABC_BUF,
    })));
    await expect(
      loadModelAsset({ url: "https://example.test/m.onnx", sha256: "0".repeat(64) }),
    ).rejects.toThrow(/checksum/i);
  });

  it("surfaces HTTP errors", async () => {
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(loadModelAsset({ url: "https://example.test/missing.onnx" })).rejects.toThrow(/404/);
  });
});

describe("cache helpers degrade gracefully", () => {
  it("do not throw when Cache Storage is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearModelCache()).resolves.toBeUndefined();
    await expect(deleteModelAsset("https://example.test/m.onnx")).resolves.toBeUndefined();
  });
});
