// ═══════════════════════════════════════════════════════════════════════════════
// Draw a session's image layers (position, transform, opacity, blend, tint,
// and the processed version — brightness/contrast/LUT — when there is one).
// Shared by the canvas redraw and the PDF report capture so the report shows
// what the user sees.
// ═══════════════════════════════════════════════════════════════════════════════

export function drawImageLayers(ctx, images, { zoom = 1, pan = { x: 0, y: 0 }, getProcessed, imgRefs }) {
  (images || []).forEach(imgE => {
    if (!imgE.visible) return;
    const src = (getProcessed && getProcessed(imgE)) || imgRefs?.current?.[imgE.id];
    if (!src) return;
    const tf = imgE.transform || { tx: 0, ty: 0, rot: 0, scale: 1 };
    const nw = src.naturalWidth || src.width || 600;
    const nh = src.naturalHeight || src.height || 500;
    ctx.save();
    ctx.globalAlpha = imgE.opacity ?? 1;
    ctx.globalCompositeOperation = imgE.blendMode || "normal";
    ctx.translate(pan.x + (imgE.dx || 0) * zoom, pan.y + (imgE.dy || 0) * zoom);
    ctx.translate((nw / 2 + tf.tx) * zoom, (nh / 2 + tf.ty) * zoom);
    ctx.rotate(tf.rot || 0);
    ctx.scale((tf.scale || 1) * zoom, (tf.scale || 1) * zoom);
    ctx.drawImage(src, -nw / 2, -nh / 2);
    if (imgE.color && imgE.color !== "none") {
      ctx.globalCompositeOperation = "color";
      ctx.fillStyle = imgE.color + "77";
      ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
    }
    ctx.restore();
  });
}

// Largest side of an exported image (keeps report PDFs a reasonable size).
export const REPORT_IMAGE_MAX = 1800;

// The scale for a report image whose base layer is nw × nh.
export const reportScale = (nw, nh) => Math.min(1, REPORT_IMAGE_MAX / Math.max(nw || 1, nh || 1));

// Label size (drawMeasLabel's annotationSize) that prints at about 2.3 mm when
// an image `outW` pixels wide is placed `printedMm` wide on the page.
export const printLabelScale = (outW, printedMm) => Math.max(1, (2.3 * outW / Math.max(1, printedMm)) / 10);
