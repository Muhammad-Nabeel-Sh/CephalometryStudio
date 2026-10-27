import { useState, useRef, useEffect } from "react";
import { Sld, PanelHeader, Btn, GuideBtn } from "../ui/ui.jsx";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { Modal } from "./Modal.jsx";
import { alignTwoPoints } from "../lib/utils.js";

// ═══════════════════════════════════════════════════════════════════════════════════════
// LAYERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════════════
export function LayersPanel({ t, images, markups, onUpdateImages, onAddImage }) {
  const [guideKey, setGuideKey] = useState(null);
  const [alignOpen, setAlignOpen] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const updImg = (id, patch) => onUpdateImages(images.map(i => i.id === id ? { ...i, ...patch } : i));
  const move = (idx, dir) => { const imgs = [...images]; [imgs[idx], imgs[idx + dir]] = [imgs[idx + dir], imgs[idx]]; onUpdateImages(imgs); };
  const SCOLS = ["none", "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
  return (
    <div style={{ padding: 12 }}>
      <PanelHeader t={t}>
        Image Stack ({images.length})
        <GuideBtn t={t} onClick={() => setGuideKey("layers")} style={{ marginLeft: 6 }} />
      </PanelHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Btn t={t} small onClick={() => setAlignOpen(true)}>⊕ Align</Btn>
        <Btn t={t} small onClick={() => setTransformOpen(true)}>⟲ Transform</Btn>
      </div>
      {images.length === 0 && <div style={{ color: t.tx3, fontSize: 12 }}>No images loaded.</div>}
      {images.map((img, idx) => (
        <div key={img.id} style={{ marginBottom: 10, border: `1px solid ${t.bdr}`, borderRadius: 8, padding: 10, background: t.surf2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <button onClick={() => updImg(img.id, { visible: !img.visible })} title="Toggle visibility" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: img.visible ? t.acc : t.tx3 }}>{img.visible ? "◎" : "○"}</button>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name || `Img ${idx + 1}`}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {idx > 0 && <button onClick={() => move(idx, -1)} title="Move up" style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 12 }}>↑</button>}
              {idx < images.length - 1 && <button onClick={() => move(idx, 1)} title="Move down" style={{ background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 3, padding: "1px 4px", cursor: "pointer", fontSize: 12 }}>↓</button>}
            </div>
            <button onClick={() => onUpdateImages(images.filter(i => i.id !== img.id))} title="Remove image" style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
          <Sld label="Opacity" value={Math.round((img.opacity || 1) * 100)} min={0} max={100} onChange={v => updImg(img.id, { opacity: v / 100 })} t={t} unit="%" />
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3 }}>Blend mode</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{["normal", "multiply", "screen", "overlay", "difference", "luminosity"].map(bm => (<button key={bm} onClick={() => updImg(img.id, { blendMode: bm })} style={{ padding: "2px 4px", fontSize: 12, border: `1px solid ${t.bdr}`, borderRadius: 4, background: img.blendMode === bm ? t.acc : t.surf3, color: img.blendMode === bm ? (t.id === "light" ? "#fff" : t.bg) : t.tx2, cursor: "pointer", fontWeight: 600 }}>{bm}</button>))}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3 }}>Serial color</div>
            <div style={{ display: "flex", gap: 4 }}>{SCOLS.map(c => (<button key={c} onClick={() => updImg(img.id, { color: c })} style={{ width: 20, height: 20, borderRadius: 4, background: c === "none" ? "transparent" : c, border: `2px solid ${img.color === c ? t.acc : t.bdr}`, cursor: "pointer", fontSize: 12, color: t.tx3, display: "flex", alignItems: "center", justifyContent: "center" }}>{c === "none" ? "✕" : ""}</button>))}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["X", "Y"].map((ax, ai) => (<div key={ax} style={{ flex: 1 }}><div style={{ fontSize: 12, color: t.tx3, marginBottom: 2 }}>{ax} offset</div><input type="number" value={ai === 0 ? img.dx || 0 : img.dy || 0} onChange={e => updImg(img.id, { [ai === 0 ? "dx" : "dy"]: +e.target.value })} style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "3px 5px", color: t.tx, fontSize: 12, fontFamily: "'DM Mono',monospace", boxSizing: "border-box" }} /></div>))}
            <button onClick={() => updImg(img.id, { dx: 0, dy: 0 })} title="Reset offset" style={{ alignSelf: "flex-end", background: "none", border: `1px solid ${t.bdr}`, color: t.tx2, borderRadius: 4, padding: "3px 5px", cursor: "pointer", fontSize: 12, height: 24 }}>⊙</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={onAddImage} style={{ cursor: "pointer", display: "block", width: "100%", background: "none", border: `2px dashed ${t.bdr}`, borderRadius: 8, padding: 12, textAlign: "center", color: t.tx2, fontSize: 12 }}>+ Add to stack</button>
      {alignOpen && <ImageAlignModal t={t} images={images} markups={markups || []} onApply={(id, patch) => { updImg(id, patch); }} onClose={() => setAlignOpen(false)} />}
      {transformOpen && <ImageTransformModal t={t} images={images} onApply={(id, patch) => { updImg(id, patch); }} onClose={() => setTransformOpen(false)} />}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// IMAGE TRANSFORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════════════
function ImageTransformModal({ t, images, onApply, onClose }) {
  const [targetId, setTargetId] = useState(images.length ? images[images.length - 1].id : null);
  const img = images.find(i => i.id === targetId) || images[images.length - 1];
  if (!img) {
    return (
      <Modal t={t} title="Transform Image" onClose={onClose}>
        <div style={{ color: t.tx3, fontSize: 12 }}>No images to transform.</div>
      </Modal>
    );
  }
  const tf = img.transform || { tx: 0, ty: 0, rot: 0, scale: 1 };
  const apply = patch => onApply(img.id, patch);
  const num = (v, label, onChange, step) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: t.tx2, width: 70, flexShrink: 0 }}>{label}</div>
      <input type="number" value={v} step={step} onChange={e => onChange(+e.target.value)}
        style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 6px", color: t.tx, fontSize: 12, fontFamily: "'DM Mono',monospace" }} />
    </div>
  );
  return (
    <Modal t={t} title="Transform Image" onClose={onClose}>
      <div style={{ fontSize: 12, color: t.tx2, marginBottom: 10 }}>Position, rotation and scale applied to the selected image.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.tx2, width: 70, flexShrink: 0 }}>Image</div>
        <select value={img.id} onChange={e => setTargetId(e.target.value)}
          style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 6px", color: t.tx, fontSize: 12 }}>
          {images.map((im, i) => <option key={im.id} value={im.id}>{im.name || `Img ${i + 1}`}</option>)}
        </select>
      </div>
      {num(Math.round(tf.tx), "X offset", v => apply({ transform: { ...tf, tx: v } }))}
      {num(Math.round(tf.ty), "Y offset", v => apply({ transform: { ...tf, ty: v } }))}
      {num(Math.round(tf.rot * 180 / Math.PI * 10) / 10, "Rotation °", v => apply({ transform: { ...tf, rot: v * Math.PI / 180 } }), 0.5)}
      {num(tf.scale, "Scale", v => apply({ transform: { ...tf, scale: Math.max(0.01, v) } }), 0.05)}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Btn t={t} small onClick={() => apply({ transform: { tx: 0, ty: 0, rot: 0, scale: 1 }, dx: 0, dy: 0 })}>Reset</Btn>
        <Btn t={t} small onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// IMAGE ALIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════════════
function ImageAlignModal({ t, images, markups, onApply, onClose }) {
  const [targetId, setTargetId] = useState(images.length ? images[images.length - 1].id : null);
  const canvasRef = useRef(null);
  const imgElRef = useRef(null);
  const drawScaleRef = useRef(1);

  const labels = [];
  const seen = new Set();
  (markups || []).forEach(m => {
    if (m.type !== "point" || !m.label || seen.has(m.label)) return;
    seen.add(m.label);
    labels.push(m.label);
  });
  const [l1, setL1] = useState(() => labels[0] || "");
  const [l2, setL2] = useState(() => labels[1] || "");
  const [p1, setP1] = useState(null);
  const [p2, setP2] = useState(null);
  const [err, setErr] = useState("");

  const img = images.find(i => i.id === targetId) || images[images.length - 1];
  const baseOf = label => {
    const m = (markups || []).find(x => x.type === "point" && x.label === label);
    if (!m || !m.points || !m.points[0] || m.points[0].x <= -9000) return null;
    return m.points[0];
  };

  useEffect(() => {
    if (!img) return;
    const el = new Image();
    el.onload = () => {
      imgElRef.current = el;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const MAXW = 460;
      const ds = Math.min(1, MAXW / (el.naturalWidth || 600));
      drawScaleRef.current = ds;
      canvas.width = Math.max(1, (el.naturalWidth || 600) * ds);
      canvas.height = Math.max(1, (el.naturalHeight || 500) * ds);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    };
    el.src = img.dataUrl;
    return () => { el.onload = null; el.onerror = null; };
  }, [img]);

  const handleClick = e => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElRef.current) return;
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0) return;
    const dx = (e.clientX - r.left) * (canvas.width / r.width) / drawScaleRef.current;
    const dy = (e.clientY - r.top) * (canvas.height / r.height) / drawScaleRef.current;
    const pt = { x: dx, y: dy };
    setErr("");
    if (!p1) setP1(pt);
    else if (!p2) setP2(pt);
    else setP1(pt);
  };

  const computed = (p1 && p2) ? alignTwoPoints(p1, p2, baseOf(l1) || p1, baseOf(l2) || p2) : null;

  const apply = () => {
    if (images.length < 2) { setErr("Add a second image to the stack first."); return; }
    if (!img) return;
    const b1 = baseOf(l1), b2 = baseOf(l2);
    if (!b1 || !b2) { setErr("Select two reference landmarks. Place point markups on the base image first."); return; }
    if (!p1 || !p2) { setErr("Click the two reference landmarks on the preview image above."); return; }
    const el = imgElRef.current;
    if (!el) { setErr("Preview image not loaded yet."); return; }
    const { tx, ty, rot, scale } = alignTwoPoints(p1, p2, b1, b2);
    const cx = (el.naturalWidth || 600) / 2, cy = (el.naturalHeight || 500) / 2;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    onApply(img.id, {
      transform: { tx: tx - cx + (cx * cos - cy * sin) * scale, ty: ty - cy + (cx * sin + cy * cos) * scale, rot, scale },
      dx: 0, dy: 0,
    });
    onClose();
  };

  if (images.length < 2) {
    return (
      <Modal t={t} title="Align Images" onClose={onClose}>
        <div style={{ color: t.tx3, fontSize: 12, lineHeight: 1.5 }}>Add a second image to the stack first — then place two point landmarks on the base image and align the top image to them.</div>
      </Modal>
    );
  }

  return (
    <Modal t={t} title="Align Images" onClose={onClose} customWidth={520}>
      <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.5, marginBottom: 12 }}>
        Match the selected image to the base image using two reference landmarks. The landmarks must already be placed as point markups on the base image.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: t.tx2, width: 70, flexShrink: 0 }}>Align image</div>
        <select value={img.id} onChange={e => { setTargetId(e.target.value); setP1(null); setP2(null); }}
          style={{ flex: 1, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 6px", color: t.tx, fontSize: 12 }}>
          {images.map((im, i) => <option key={im.id} value={im.id}>{im.name || `Img ${i + 1}`}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3 }}>Landmark 1 (base)</div>
          <select value={l1} onChange={e => { setL1(e.target.value); setP1(null); setP2(null); }}
            style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 6px", color: t.tx, fontSize: 12 }}>
            {labels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: t.tx2, marginBottom: 3 }}>Landmark 2 (base)</div>
          <select value={l2} onChange={e => { setL2(e.target.value); setP1(null); setP2(null); }}
            style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 6px", color: t.tx, fontSize: 12 }}>
            {labels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      {labels.length === 0 && <div style={{ fontSize: 12, color: t.warn, marginBottom: 8 }}>No point landmarks found. Place two point markups on the base image first.</div>}
      <div style={{ fontSize: 12, color: t.tx3, marginBottom: 4 }}>
        {!p1 ? "Click landmark 1 on the preview" : !p2 ? "Click landmark 2 on the preview" : "Both landmarks set — click a point to redo."}
      </div>
      <div style={{ border: `1px solid ${t.bdr}`, borderRadius: 8, overflow: "hidden", marginBottom: 10, background: "#111" }}>
        <canvas ref={canvasRef} onClick={handleClick} style={{ display: "block", width: "100%", cursor: "crosshair" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, fontSize: 12, color: t.tx2 }}>
        <span>{p1 ? `L1: (${Math.round(p1.x)}, ${Math.round(p1.y)})` : "L1: —"}</span>
        <span>{p2 ? `L2: (${Math.round(p2.x)}, ${Math.round(p2.y)})` : "L2: —"}</span>
        {computed && <span>Rot {(computed.rot * 180 / Math.PI).toFixed(1)}° · Scale {computed.scale.toFixed(3)}×</span>}
      </div>
      {err && <div style={{ fontSize: 12, color: t.err, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn t={t} small onClick={apply}>Align</Btn>
        <Btn t={t} small onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}
