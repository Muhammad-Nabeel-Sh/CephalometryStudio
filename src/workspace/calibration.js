import { dist, vpts, computeMeasurements } from "../lib/utils.js";
import { resolveFacing } from "../lib/measureConventions.js";
import { provenanceOf } from "./aiReview.js";

export function finalizeCalibRuler(ruler, mm, markups, { pushUndo, updSession, dispatch }) {
  let rp = ruler;
  if (!rp) {
    const rulers = markups.filter(m => m.type === "ruler");
    if (rulers.length === 0) return;
    if (rulers.length > 1) return; // ambiguous — CalibModal warns the user
    rp = rulers[0];
  }
  const vp = vpts(rp);
  if (vp.length < 2) return;
  const pixelDist = dist(vp[0], vp[1]);
  if (pixelDist < 10) return;
  const ppm = pixelDist / mm;
  if (!isFinite(ppm) || ppm <= 0 || ppm > 1000) return;
  pushUndo();
  updSession({ calibration: { done: true, pxPerMm: ppm, knownMm: mm || "" } });
  dispatch({ type: "SET", payload: { showCalib: false } });
}

export function finalizeCalibManual(ppmValue, pushUndo, updSession, dispatch) {
  const p = parseFloat(ppmValue);
  if (!isFinite(p) || p <= 0 || p > 1000) return;
  pushUndo();
  updSession({ calibration: { done: true, pxPerMm: p, knownMm: "" } });
  dispatch({ type: "SET", payload: { showCalib: false } });
}

export function exportCSV(markups, calibration, formatAngle, projectName, facing) {
  const rows = [["ID", "Type", "Label", "Definition", "Points_px", "Measurement", "Value", "Unit", "Source"]];
  const ctx = { facing: facing || resolveFacing("auto", markups) };
  markups.forEach(m => {
    const meas = computeMeasurements(m, calibration, ctx);
    const ps = vpts(m).map(p => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(";");
    const src = provenanceOf(m);
    if (!Object.keys(meas).length) rows.push([m.id, m.type, m.label || "", m.definition || "", ps, "", "", "", src]);
    else Object.entries(meas).forEach(([k, v]) => {
      if (k.startsWith("_")) return;
      rows.push([m.id, m.type, m.label || "", m.definition || "", ps, k, v.toFixed(2), k === "angle" ? formatAngle(v) : (k === "x" || k === "y" || meas._unit !== "mm") ? "px" : "mm", src]);
    });
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type: "text/csv" }));
  a.download = `${projectName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
