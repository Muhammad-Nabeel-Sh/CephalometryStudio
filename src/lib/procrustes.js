// ═══════════════════════════════════════════════════════════════════════════════
// Procrustes alignment (rotation + translation, optional scale) and centroid
// helpers. Shared by the canvas comparison overlay and the superimposition
// research module.
// ═══════════════════════════════════════════════════════════════════════════════

export function centroid(pts) {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / n, y: sy / n };
}

export function centroidSize(pts) {
  const c = centroid(pts);
  let s = 0;
  for (const p of pts) { const dx = p.x - c.x, dy = p.y - c.y; s += dx * dx + dy * dy; }
  return Math.sqrt(s);
}

// Rotation + translation by default. Scaling to equal centroid size removes the
// size change a growth comparison is meant to measure, so it is opt-in
// (`allowScale`) for size-standardised shape comparison only.
export function procrustesAlign(sourcePts, destPts, { allowScale = false } = {}) {
  if (sourcePts.length < 2 || destPts.length < 2 || sourcePts.length !== destPts.length) {
    return { tx: 0, ty: 0, rot: 0, scale: 1, error: "Need ≥2 matched landmarks" };
  }

  const srcCentroid = centroid(sourcePts);
  const dstCentroid = centroid(destPts);
  const srcC = sourcePts.map(p => ({ x: p.x - srcCentroid.x, y: p.y - srcCentroid.y }));
  const dstC = destPts.map(p => ({ x: p.x - dstCentroid.x, y: p.y - dstCentroid.y }));

  const srcCS = centroidSize(srcC);
  const dstCS = centroidSize(dstC);
  const scale = allowScale && srcCS > 1e-12 ? dstCS / srcCS : 1;
  const srcS = srcC.map(p => ({ x: p.x * scale, y: p.y * scale }));

  let Hxx = 0, Hxy = 0, Hyx = 0, Hyy = 0;
  for (let i = 0; i < srcS.length; i++) {
    Hxx += srcS[i].x * dstC[i].x;
    Hxy += srcS[i].x * dstC[i].y;
    Hyx += srcS[i].y * dstC[i].x;
    Hyy += srcS[i].y * dstC[i].y;
  }

  const angle = Math.atan2(Hxy - Hyx, Hxx + Hyy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = dstCentroid.x - (cos * srcCentroid.x * scale - sin * srcCentroid.y * scale);
  const ty = dstCentroid.y - (sin * srcCentroid.x * scale + cos * srcCentroid.y * scale);

  return { tx, ty, rot: angle, scale };
}
