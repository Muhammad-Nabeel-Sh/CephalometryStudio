// Runs the landmark detector off the main thread, so a trace never freezes the page.
// Spoken to by canvas/landmarkClient.js: { id, type: "init" | "detect", ... }.

import { initDetector, detectLandmarks, getDetectorDebug } from "./landmarkDetector.js";

self.onmessage = async ({ data }) => {
  const { id, type, opts, frame } = data;
  try {
    const result = type === "init"
      ? { backend: await initDetector(opts), debug: getDetectorDebug() }
      : await detectLandmarks(frame, opts);
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: e?.message || String(e) });
  }
};
