// ═══════════════════════════════════════════════════════════════════════════════
// Window & level on the ORIGINAL pixels of a 12–16-bit image (DICOM, TIFF).
//
// The image the app draws is an 8-bit rendering; its stored values live in the
// image store under entry.raw.key. Moving a slider re-renders from those values
// into a preview canvas (drawn instead of the image, via `previewFor`); when the
// user pauses, the rendering is saved as a NEW image id with the new window, so
// sessions sharing the old image (duplicates, reliability raters) keep theirs.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { uid } from "../lib/utils.js";
import { getRawPixels } from "../storage/imageStore.js";
import { buildLut, renderGray } from "../imaging/voi.js";
import { logWarn } from "../lib/logger.js";

const COMMIT_MS = 600;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// `setLoadedImage(id, img)`: register a decoded image for drawing.
// `onSourceChange(id)`: the pixels drawn for image `id` changed (drop cached
// processing, redraw). `getImages()`: the session's current images.
export function useSourceWindow({ sessionImage, setLoadedImage, updSession, getImages, onSourceChange }) {
  const base = (sessionImage || []).find((i) => i?.raw?.key) || null;
  const key = base?.raw?.key || null;
  const [loaded, setLoaded] = useState({ key: null, status: "none" });
  const [draft, setDraft] = useState(null); // { id, window } while previewing/saving
  const rawRef = useRef(null);
  const previewRef = useRef(null); // { id, canvas, version }
  const pendingRef = useRef(null);
  const frameRef = useRef(0);
  const timerRef = useRef(0);
  const baseRef = useRef(base);
  useEffect(() => { baseRef.current = base; });

  // Load the stored values of the base image.
  useEffect(() => {
    let live = true;
    if (!key) { rawRef.current = null; return; }
    if (rawRef.current?.key === key) return;
    getRawPixels(key).then((r) => {
      if (!live) return;
      rawRef.current = r ? { key, ...r } : null;
      setLoaded({ key, status: r ? "ready" : "missing" });
    });
    return () => { live = false; };
  }, [key]);

  // Leaving the image ends any preview.
  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    clearTimeout(timerRef.current);
    previewRef.current = null;
  }, [base?.id]);

  const status = !key ? "none" : loaded.key === key ? loaded.status : "loading";

  const commit = useCallback(async () => {
    const pv = previewRef.current, entry = baseRef.current, win = pendingRef.current;
    if (!pv || !entry || pv.id !== entry.id || !win) return;
    try {
      const blob = await new Promise((resolve, reject) => pv.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"));
      const dataUrl = await blobToDataUrl(blob);
      if (previewRef.current !== pv || baseRef.current?.id !== entry.id) return; // superseded
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
      if (previewRef.current !== pv || baseRef.current?.id !== entry.id) return;
      const id = uid();
      setLoadedImage(id, img);
      const saved = win.lut ? { name: win.name, lut: true } : { name: win.name, center: win.center, width: win.width };
      updSession({ images: (getImages() || []).map((e) => (e.id === entry.id ? { ...e, id, dataUrl, raw: { ...e.raw, window: saved } } : e)) });
      previewRef.current = null;
      setDraft(null);
      onSourceChange(entry.id);
    } catch (e) {
      logWarn("Saving the new window failed:", e);
    }
  }, [setLoadedImage, updSession, getImages, onSourceChange]);

  // Preview `win` now; save it once the user pauses.
  const setWindow = useCallback((win) => {
    const entry = baseRef.current, raw = rawRef.current;
    if (!entry || !raw || raw.key !== entry.raw?.key) return;
    pendingRef.current = win;
    setDraft({ id: entry.id, window: win });
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const w = pendingRef.current, { meta, pixels } = raw;
      let pv = previewRef.current;
      if (!pv || pv.id !== entry.id) {
        const canvas = document.createElement("canvas");
        canvas.width = meta.width;
        canvas.height = meta.height;
        pv = { id: entry.id, canvas, version: 0, image: null };
      }
      const ctx = pv.canvas.getContext("2d");
      if (!pv.image) pv.image = ctx.createImageData(meta.width, meta.height);
      renderGray(pixels, meta, buildLut(meta, w), pv.image.data);
      ctx.putImageData(pv.image, 0, 0);
      previewRef.current = { ...pv, version: pv.version + 1 };
      onSourceChange(entry.id);
    });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commit, COMMIT_MS);
  }, [commit, onSourceChange]);

  // The canvas to draw for an image instead of its saved rendering (or null),
  // and a version for cache keys. Read from the draw pipeline.
  const previewFor = useCallback((id) => {
    const pv = previewRef.current;
    return pv && pv.id === id ? pv : null;
  }, []);

  const raw = base?.raw || null;
  return {
    status, // "none" | "loading" | "ready" | "missing"
    bits: raw?.bits,
    min: raw?.min,
    max: raw?.max,
    presets: raw?.presets || [],
    window: draft && draft.id === base?.id ? draft.window : raw?.window || null,
    saving: !!(draft && draft.id === base?.id),
    setWindow,
    previewFor,
  };
}
