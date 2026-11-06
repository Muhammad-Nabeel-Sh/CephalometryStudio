import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A worker stand-in the test answers by hand.
class FakeWorker {
  static last = null;
  constructor() {
    this.sent = [];
    this.terminated = false;
    FakeWorker.last = this;
  }
  postMessage(message, transfer) {
    this.sent.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  reply(result) {
    const { id } = this.sent[this.sent.length - 1].message;
    this.onmessage({ data: { id, result } });
  }
  replyError(error) {
    const { id } = this.sent[this.sent.length - 1].message;
    this.onmessage({ data: { id, error } });
  }
}

const flush = () => new Promise((r) => setTimeout(r));
const frame = () => ({ pixels: new Uint8ClampedArray(16), width: 2, height: 2 });

async function loadClient() {
  vi.resetModules();
  return import("../canvas/landmarkClient.js");
}

async function ready(client) {
  const init = client.initDetector({ landmarkSet: "cepha29" });
  await flush();
  FakeWorker.last.reply({ backend: "onnx", debug: null });
  await init;
}

describe("landmarkClient", () => {
  beforeEach(() => {
    FakeWorker.last = null;
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("runs detection in the worker and leaves the caller's pixels intact", async () => {
    const client = await loadClient();
    await ready(client);
    const input = frame();
    const run = client.detectLandmarks(input, { landmarkSet: "cepha29" });
    await flush();
    const { message, transfer } = FakeWorker.last.sent[1];
    expect(message.type).toBe("detect");
    expect(transfer[0]).toBe(message.frame.pixels.buffer);
    expect(message.frame.pixels).not.toBe(input.pixels);
    FakeWorker.last.reply({ landmarks: [], backend: "onnx" });
    await expect(run).resolves.toMatchObject({ backend: "onnx" });
  });

  it("never sends the abort signal to the worker, and cancelling ends the worker", async () => {
    const client = await loadClient();
    await ready(client);
    const controller = new AbortController();
    const run = client.detectLandmarks(frame(), { signal: controller.signal });
    await flush();
    expect("signal" in FakeWorker.last.sent[1].message.opts).toBe(false);
    controller.abort();
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.last.terminated).toBe(true);
  });

  it("uses threads only on a cross-origin isolated page", async () => {
    let client = await loadClient();
    client.initDetector({});
    await flush();
    expect(FakeWorker.last.sent[0].message.opts.numThreads).toBe(1);

    vi.stubGlobal("crossOriginIsolated", true);
    vi.stubGlobal("navigator", { hardwareConcurrency: 16 });
    client = await loadClient();
    client.initDetector({});
    await flush();
    expect(FakeWorker.last.sent[0].message.opts.numThreads).toBe(8);
  });

  it("starts a new worker after a cancelled one", async () => {
    const client = await loadClient();
    await ready(client);
    const first = FakeWorker.last;
    const controller = new AbortController();
    const run = client.detectLandmarks(frame(), { signal: controller.signal });
    controller.abort();
    await run.catch(() => {});
    await ready(client);
    expect(FakeWorker.last).not.toBe(first);
  });

  it("passes on detection errors from the worker", async () => {
    const client = await loadClient();
    await ready(client);
    const run = client.detectLandmarks(frame(), {});
    await flush();
    FakeWorker.last.replyError("Model has 19 outputs, expected 29");
    await expect(run).rejects.toThrow(/19 outputs/);
  });

  it("falls back to the main thread when the worker cannot load the model", async () => {
    const client = await loadClient();
    const init = client.initDetector({ landmarkSet: "cepha29" });
    await flush();
    const worker = FakeWorker.last;
    worker.reply({ backend: "mock", debug: "onnxruntime-web not loaded" });
    await expect(init).resolves.toBe("mock");
    expect(worker.terminated).toBe(true);
    const res = await client.detectLandmarks({ pixels: new Uint8ClampedArray(4 * 64 * 64).fill(128), width: 64, height: 64 }, { landmarkSet: "cepha29" });
    expect(res.backend).toBe("mock");
    expect(worker.sent).toHaveLength(1);
  });

  it("runs on the main thread when the browser has no workers", async () => {
    vi.stubGlobal("Worker", undefined);
    const client = await loadClient();
    await expect(client.initDetector({ landmarkSet: "cepha29" })).resolves.toBe("mock");
  });
});
