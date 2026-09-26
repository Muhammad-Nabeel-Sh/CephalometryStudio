// ═══════════════════════════════════════════════════════════════════════════════
// Model asset cache — downloads the ONNX weights on first use, verifies the
// SHA-256, and stores them in the Cache Storage API for offline reuse.
// All operations degrade gracefully when the APIs are unavailable (e.g. tests,
// older browsers, private-mode quota limits).
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = "ceph-ai-models-v1";

export async function sha256Hex(buffer) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function openCache() {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

export async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model download failed (HTTP ${res.status})`);
  if (!res.body || !onProgress) return res.arrayBuffer();
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total ? received / total : 0, received, total);
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

// Returns an ArrayBuffer for the model, preferring the cache. `sha256` is
// verified on both cache hits and fresh downloads when provided.
export async function loadModelAsset({ url, sha256, onProgress, force = false } = {}) {
  if (!url) throw new Error("No model URL configured");
  const cache = await openCache();

  if (cache && !force) {
    const hit = await cache.match(url);
    if (hit) {
      const buffer = await hit.arrayBuffer();
      if (!sha256 || (await sha256Hex(buffer)) === sha256) return buffer;
    }
  }

  const buffer = await fetchWithProgress(url, onProgress);
  if (sha256) {
    const hex = await sha256Hex(buffer);
    if (hex && hex !== sha256) throw new Error("Model checksum mismatch");
  }
  if (cache) {
    try {
      await cache.put(url, new Response(buffer.slice(0)));
    } catch {
      /* cache write is best-effort (quota/private mode) */
    }
  }
  return buffer;
}

export async function deleteModelAsset(url) {
  const cache = await openCache();
  if (cache) await cache.delete(url).catch(() => {});
}

export async function clearModelCache() {
  if (typeof caches === "undefined") return;
  await caches.delete(CACHE_NAME).catch(() => {});
}
