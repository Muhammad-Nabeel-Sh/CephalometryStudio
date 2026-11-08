// ─── PNG encoding off the main thread ────────────────────────────────────────
// A canvas's toBlob is throttled to about one call a second while the tab is in
// the background, which made long DICOM imports crawl when the user switched tabs.
// Encoding here isn't throttled. In: { id, width, height, rgba (transferred) }.
// Out: { id, blob } or { id, error }.

self.onmessage = async (e) => {
  const { id, width, height, rgba } = e.data;
  try {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    self.postMessage({ id, blob: await canvas.convertToBlob({ type: "image/png" }) });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
