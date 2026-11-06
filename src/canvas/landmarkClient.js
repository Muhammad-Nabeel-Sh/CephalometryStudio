// ═══════════════════════════════════════════════════════════════════════════════
// The app's way to the landmark detector: same calls as canvas/landmarkDetector.js,
// run in a Web Worker so a trace never freezes the page and can be cancelled.
//
// If the worker cannot start or load the runtime (old browser, blocked module
// worker), the detector runs on the main thread instead: slower to live with, but
// the trace still works.
//
// Threads need a cross-origin isolated page. We get that from the
// Document-Isolation-Policy header, not COOP/COEP, because COOP would cut the link
// to Google's sign-in popup. Browsers without the header run one thread: same
// landmarks, about 3x slower (measured 10.1 s vs 3.7 s with 4 threads, 3 s with 8).
// ═══════════════════════════════════════════════════════════════════════════════

import * as inPage from "./landmarkDetector.js";

let _worker = null;
let _inPage = typeof Worker === "undefined";
const THREADS = globalThis.crossOriginIsolated ? Math.min(8, Math.ceil((navigator.hardwareConcurrency || 2) / 2)) : 1;
let _debug = null;
let _nextId = 1;
const _pending = new Map();

function abortError() {
  return new DOMException("Cancelled", "AbortError");
}

// Ends the worker and fails whatever it was doing. A later init starts a new one.
function stopWorker(error) {
  _worker?.terminate();
  _worker = null;
  for (const { reject } of _pending.values()) reject(error);
  _pending.clear();
}

function startWorker() {
  if (_worker) return;
  _worker = new Worker(new URL("./landmarkDetector.worker.js", import.meta.url), { type: "module" });
  _worker.onmessage = ({ data }) => {
    const call = _pending.get(data.id);
    if (!call) return;
    _pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error));
    else call.resolve(data.result);
  };
  _worker.onerror = (e) => {
    e.preventDefault?.();
    stopWorker(new Error(e.message || "The AI worker stopped"));
  };
}

function call(message, transfer, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const id = _nextId++;
    const onAbort = () => stopWorker(abortError());
    signal?.addEventListener("abort", onAbort, { once: true });
    const done = (fn) => (value) => {
      signal?.removeEventListener("abort", onAbort);
      fn(value);
    };
    _pending.set(id, { resolve: done(resolve), reject: done(reject) });
    _worker.postMessage({ ...message, id }, transfer);
  });
}

// `signal` is taken out here: an AbortSignal cannot be sent to a worker.
export async function initDetector({ signal, ...opts } = {}) {
  if (!_inPage) {
    try {
      startWorker();
      const { backend, debug } = await call({ type: "init", opts: { ...opts, numThreads: THREADS } }, [], signal);
      _debug = debug;
      if (backend === "onnx") return backend;
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      _debug = e?.message || String(e);
    }
    stopWorker(new Error("The AI worker stopped"));
    _inPage = true;
  }
  return inPage.initDetector(opts);
}

export async function detectLandmarks(input, { signal, ...opts } = {}) {
  if (_inPage || !_worker) return inPage.detectLandmarks(input, opts);
  const read = inPage.readPixels(input);
  if (!read) throw new Error("No image to trace");
  // Pixels the caller passed in stay theirs; transferring would empty their array.
  const pixels = read.pixels === input.pixels ? read.pixels.slice() : read.pixels;
  return call({ type: "detect", opts, frame: { pixels, width: read.width, height: read.height } }, [pixels.buffer], signal);
}

export function getDetectorDebug() {
  return _inPage ? inPage.getDetectorDebug() || _debug : _debug;
}
