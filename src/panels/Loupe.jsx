// ═══════════════════════════════════════════════════════════════════════════════
// Loupe — a magnified view beside the pointer, drawn from the source image rather
// than the screen, so it shows real detail with the current brightness and LUT.
// Listens to the canvas directly and draws once a frame, without React renders.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { loupePosition, loupeView } from "../lib/precision.js";

const CROSS = 14; // crosshair arm length, leaving the centre clear
const dpr = () => Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

// getImagePoint(canvasPos) → the image point to show, or null to hide the loupe.
// drawSource(ctx, zoom, pan) draws the image; drawMarks(ctx, zoom, pan) what's on it.
export function Loupe({ canvasRef, t, size = 180, factor = 4, getImagePoint, getViewZoom, drawSource, drawMarks }) {
  const wrapRef = useRef(null);
  const canvasEl = useRef(null);
  const markerRef = useRef(null);
  const live = useRef({});
  useEffect(() => {
    live.current = { factor, getImagePoint, getViewZoom, drawSource, drawMarks, accent: t.acc };
  });

  useEffect(() => {
    const src = canvasRef.current;
    if (!src) return;
    let raf = 0;
    let pointer = null; // { x, y, type, down } in canvas coordinates
    const scale = dpr();

    const hide = () => {
      if (wrapRef.current) wrapRef.current.style.display = "none";
      if (markerRef.current) markerRef.current.style.display = "none";
    };
    const draw = () => {
      raf = 0;
      const wrap = wrapRef.current, c = canvasEl.current;
      if (!wrap || !c || !pointer) return;
      const { factor: f, getImagePoint: at, getViewZoom, drawSource: image, drawMarks: marks, accent } = live.current;
      const ip = at(pointer);
      if (!ip) { hide(); return; }
      const r = src.getBoundingClientRect();
      const pos = loupePosition(pointer, { w: r.width, h: r.height }, size, pointer.type);
      wrap.style.display = "block";
      wrap.style.left = `${pos.left}px`;
      wrap.style.top = `${pos.top}px`;
      if (markerRef.current) {
        markerRef.current.style.display = pointer.down ? "block" : "none";
        markerRef.current.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
      }
      const { zoom, pan } = loupeView(ip, size, getViewZoom(), f);
      const ctx = c.getContext("2d");
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size, size);
      image(ctx, zoom, pan);
      marks(ctx, zoom, pan);
      const mid = size / 2;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mid, mid - CROSS - 4); ctx.lineTo(mid, mid - 4);
      ctx.moveTo(mid, mid + 4); ctx.lineTo(mid, mid + CROSS + 4);
      ctx.moveTo(mid - CROSS - 4, mid); ctx.lineTo(mid - 4, mid);
      ctx.moveTo(mid + 4, mid); ctx.lineTo(mid + CROSS + 4, mid);
      ctx.stroke();
    };
    const track = (e, down) => {
      const r = src.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top, type: e.pointerType, down };
      if (!raf) raf = requestAnimationFrame(draw);
    };
    // Two fingers are panning or zooming, not aiming.
    const fingers = new Set();
    const onDown = e => {
      if (e.pointerType === "touch") fingers.add(e.pointerId);
      if (fingers.size > 1) { pointer = null; hide(); return; }
      track(e, true);
    };
    const onMove = e => {
      const down = e.buttons !== 0;
      if (e.pointerType === "touch" && (!down || fingers.size !== 1)) return;
      track(e, down);
    };
    const onUp = e => {
      fingers.delete(e.pointerId);
      pointer = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      hide();
      if (e.type === "pointerup" && e.pointerType !== "touch") track(e, false); // still hovering
    };
    const onLeave = () => {
      if (pointer?.down) return;
      pointer = null;
      hide();
    };
    src.addEventListener("pointerdown", onDown);
    src.addEventListener("pointermove", onMove);
    src.addEventListener("pointerup", onUp);
    src.addEventListener("pointercancel", onUp);
    src.addEventListener("pointerleave", onLeave);
    return () => {
      src.removeEventListener("pointerdown", onDown);
      src.removeEventListener("pointermove", onMove);
      src.removeEventListener("pointerup", onUp);
      src.removeEventListener("pointercancel", onUp);
      src.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [canvasRef, size]);

  const px = Math.round(size * dpr());
  return (
    <>
      <div ref={markerRef} aria-hidden="true" style={{ display: "none", position: "absolute", left: -7, top: -7, width: 14, height: 14, borderRadius: "50%", border: `2px solid ${t.acc}`, boxShadow: "0 0 0 1px rgba(0,0,0,0.6)", pointerEvents: "none", zIndex: 9 }} />
      <div ref={wrapRef} aria-hidden="true" style={{ display: "none", position: "absolute", width: size, height: size, borderRadius: "50%", overflow: "hidden", border: `2px solid ${t.acc}`, boxShadow: `0 4px 16px ${t.shadow}`, pointerEvents: "none", zIndex: 9, background: "#000", boxSizing: "content-box" }}>
        <canvas ref={canvasEl} width={px} height={px} style={{ display: "block", width: size, height: size }} />
      </div>
    </>
  );
}
