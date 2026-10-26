import { useState, useRef, useMemo, useCallback } from "react";
import { Modal } from "./Modal.jsx";
import { Btn } from "../ui/ui.jsx";
import { logError } from "../lib/logger.js";
import { mkSession } from "../model/session.js";
import { mkSubject, addSubject, addSession } from "../model/project.js";
import { parseCsv } from "../model/csv.js";
import { uid } from "../lib/utils.js";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { notify } from "../ui/dialogs.js";

const META_KEYS = new Set([
  "patientId", "operatorId", "group", "timepoint", "age", "sex", "trialNumber",
]);

export default function BatchImportModal({ t, project, onUpdateProject, onClose }) {
  const [images, setImages] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [guideKey, setGuideKey] = useState(null);
  const imgRef = useRef(null);
  const csvRef = useRef(null);

  const handleImages = useCallback(async (files) => {
    const valid = Array.from(files).filter(f => {
      if (!f.type.startsWith("image/")) { notify(`"${f.name}" is not an image file. Skipped.`, { tone: "warn" }); return false; }
      if (f.size > 100 * 1024 * 1024) { notify(`"${f.name}" is too large (${(f.size/1024/1024).toFixed(1)} MB). Maximum 100 MB. Skipped.`, { tone: "warn" }); return false; }
      return true;
    });
    if (valid.length === 0) return;
    const reads = valid.map(f => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ file: f, dataUrl: r.result });
      r.onerror = rej;
      r.readAsDataURL(f);
    }));
    try {
      const loaded = await Promise.all(reads);
      setImages(loaded);
    } catch { /* ignore */ }
  }, []);

  const handleCsv = useCallback((file) => {
    const r = new FileReader();
    r.onload = () => {
      const { headers, rows } = parseCsv(r.result);
      setCsvHeaders(headers);
      setCsvRows(rows);
    };
    r.readAsText(file);
  }, []);

  const merged = useMemo(() => {
    if (images.length === 0) return [];
    return images.map(({ file, dataUrl }) => {
      const baseName = file.name.replace(/\.[^.]+$/, "").toLowerCase();
      const matchedRow = csvRows.find(r => {
        const csvName = (r.filename || r.file || r.name || "").toLowerCase().trim();
        const csvBase = csvName.replace(/\.[^.]+$/, "");
        return csvBase === baseName || csvName === file.name.toLowerCase();
      });
      const meta = {};
      if (matchedRow) {
        Object.entries(matchedRow).forEach(([k, v]) => {
          const isMeta = META_KEYS.has(k);
          if (k === "name") return;
          if (k === "filename" || k === "file") return;
          if (isMeta) {
            const val = k === "trialNumber" ? (parseInt(v, 10) || null) : v;
            meta[k] = val;
          } else {
            meta[k] = v;
          }
        });
      }
      return {
        name: matchedRow?.name || file.name.replace(/\.[^.]+$/, ""),
        imageEntry: {
          id: uid(),
          name: file.name,
          dataUrl,
          dx: 0, dy: 0,
          opacity: 1,
          blendMode: "normal",
          visible: true,
          color: "none",
          transform: { tx: 0, ty: 0, rot: 0, scale: 1 },
        },
        meta,
        matched: !!matchedRow,
      };
    });
  }, [images, csvRows]);

  const handleImport = () => {
    setBusy(true);
    try {
      let proj = project;
      const subjectMap = {}; // label -> subjectId
      merged.forEach(item => {
        const subjectLabel = item.meta.subject || item.meta.patientId || "";
        if (subjectLabel && !subjectMap[subjectLabel]) {
          const sub = mkSubject({ label: subjectLabel });
          subjectMap[subjectLabel] = sub.id;
          proj = addSubject(proj, sub);
        }
        const session = mkSession({
          name: item.name,
          images: [item.imageEntry],
          meta: item.meta,
          subjectId: subjectMap[subjectLabel] || "",
        });
        proj = addSession(proj, session);
      });
      onUpdateProject(proj);
      onClose();
    } catch (e) { logError("Batch import error:", e); }
    setBusy(false);
  };

  const csvColumns = csvHeaders.filter(h => h !== "filename" && h !== "file" && h !== "name");

  return (
    <><Modal t={t} title="Batch Import Sessions" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
          <button onClick={() => setGuideKey("batchImport")}
            style={{ background: "none", border: `1px solid ${t.tx3}55`, color: t.tx3, borderRadius: 10, width: 18, height: 18, fontSize: 10, lineHeight: "16px", textAlign: "center", cursor: "pointer", padding: 0 }} title="Guide">?</button>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Btn
              t={t}
              onClick={() => imgRef.current?.click()}
              style={{ width: "100%", textAlign: "center", padding: "32px 16px", background: t.surf2, border: `2px dashed ${t.bdr}`, fontSize: 13 }}
            >
              {images.length ? `${images.length} images selected` : "Click to select images"}
            </Btn>
            <input ref={imgRef} type="file" multiple accept="image/*" style={{ display: "none" }}
              onChange={e => { if (e.target.files.length) handleImages(e.target.files); e.target.value = ""; }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Btn
              t={t}
              onClick={() => csvRef.current?.click()}
              style={{ width: "100%", textAlign: "center", padding: "32px 16px", background: t.surf2, border: `2px dashed ${t.bdr}`, fontSize: 13 }}
            >
              {csvRows.length ? `CSV: ${csvRows.length} rows` : "Optional: select CSV metadata"}
            </Btn>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={e => { if (e.target.files[0]) handleCsv(e.target.files[0]); e.target.value = ""; }}
            />
          </div>
        </div>

        {merged.length > 0 && (
          <div style={{ maxHeight: 260, overflow: "auto", border: `1px solid ${t.bdr}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: t.surf3, color: t.tx2, position: "sticky", top: 0 }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}`, minWidth: 80 }}>Session Name</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}` }}>Image</th>
                  {csvColumns.map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${t.bdr}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {merged.map((item, i) => (
                  <tr key={i} style={{ color: t.tx, background: i % 2 ? t.surf3 : "transparent" }}>
                    <td style={{ padding: "4px 8px", borderBottom: `1px solid ${t.bdr}` }}>{item.name}</td>
                    <td style={{ padding: "4px 8px", borderBottom: `1px solid ${t.bdr}`, color: item.matched ? t.ok : t.tx3 }}>
                      {item.matched ? "✓ matched" : "no metadata"}
                    </td>
                    {csvColumns.map(h => (
                      <td key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${t.bdr}` }}>
                        {item.meta[h] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn t={t} ghost onClick={onClose}>Cancel</Btn>
          <Btn t={t} onClick={handleImport} disabled={images.length === 0 || busy}>
            {busy ? "Importing..." : `Import ${merged.length} session${merged.length !== 1 ? "s" : ""}`}
          </Btn>
        </div>
      </div>
    </Modal>
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </>
  );
}
