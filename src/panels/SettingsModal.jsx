// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS (C3) — every preference in one place. Display and tracing settings
// are remembered between visits (uiStore); angle display and profile direction
// belong to the open case and are saved with it.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { THEMES } from "../data/constants.js";
import { useUIStore } from "../state/uiStore.js";
import { LANDMARK_MODEL } from "../data/landmarkModelInfo.js";
import { clearModelCache } from "../storage/modelCache.js";
import { storageStatus, requestPersistentStorage } from "../storage/projectStore.js";
import { askConfirm, notify } from "../ui/dialogs.js";

const COLORS = [
  { label: "Automatic", value: null }, { label: "Orange", value: "#f59e0b" }, { label: "Sky", value: "#38bdf8" },
  { label: "Pink", value: "#f472b6" }, { label: "Green", value: "#4ade80" }, { label: "Violet", value: "#a78bfa" },
  { label: "Red", value: "#f87171" }, { label: "White", value: "#ffffff" },
];

function Section({ t, title, note, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${t.bdr}` }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tx }}>{title}</h3>
        {note && <div style={{ fontSize: 12, color: t.tx3, marginTop: 2 }}>{note}</div>}
      </div>
      {children}
    </section>
  );
}

function Row({ t, label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <div style={{ fontSize: 13, color: t.tx }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: t.tx3, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Switch({ t, checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={!!checked} aria-label={label} onClick={onChange}
      style={{ width: 40, height: 22, borderRadius: 11, border: `1px solid ${checked ? t.acc : t.bdr}`, background: checked ? t.acc : t.surf3, position: "relative", cursor: "pointer", padding: 0 }}>
      <span style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: checked ? t.bg : t.tx3, transition: "left 0.15s" }} />
    </button>
  );
}

// Shrink an uploaded logo to at most 400 px (it is kept with the preferences).
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("This is not an image the browser can open."));
      img.onload = () => {
        const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const MB = n => (n == null ? "" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(0.1, n / 1e6).toFixed(1)} MB`);

const selStyle = t => ({ padding: "5px 8px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, fontFamily: "inherit" });

export default function SettingsModal({ t, theme, setTheme, angleMode, setAngleMode, facingSetting, setFacingSetting, resolvedFacing, magnifierOn, toggleMagnifier, storageEncrypted, onBackup, onDrive, onClose }) {
  const ui = useUIStore();
  const set = patch => useUIStore.setState(patch);
  const toggle = k => () => useUIStore.setState(s => ({ [k]: !s[k] }));
  const [sign, unit] = (angleMode || "signed-deg").split("-");
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState(null);
  useEffect(() => {
    let live = true;
    storageStatus().then(s => { if (live) setStore(s); });
    return () => { live = false; };
  }, []);
  const askPersist = async () => {
    const ok = await requestPersistentStorage();
    setStore(s => (s ? { ...s, persisted: ok } : s));
    notify(ok ? "The browser will keep this site's data when space runs low." : "The browser did not agree. Installing the app, or using it often, makes this more likely.", { tone: ok ? "ok" : "info" });
  };

  const removeModel = async () => {
    if (!(await askConfirm({ title: "Remove the downloaded AI model?", message: "It is downloaded again (about 30 MB) the next time you use AI Trace.", confirmLabel: "Remove" }))) return;
    setBusy(true);
    try { await clearModelCache(); notify("Downloaded AI model removed.", { tone: "ok" }); }
    finally { setBusy(false); }
  };

  return (
    <Modal t={t} title="Settings" onClose={onClose} customWidth={560}>
      <Section t={t} title="Appearance">
        <Row t={t} label="Theme">
          <div role="radiogroup" aria-label="Theme" style={{ display: "flex", gap: 6 }}>
            {Object.values(THEMES).map(th => (
              <button key={th.id} role="radio" aria-checked={theme === th.id} onClick={() => setTheme(th.id)} title={th.name} aria-label={th.name}
                style={{ width: 30, height: 30, borderRadius: 7, background: th.bg, border: theme === th.id ? `2px solid ${t.acc}` : `1px solid ${t.bdr}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: th.acc }} />
              </button>
            ))}
          </div>
        </Row>
        <Row t={t} label="Label size" hint="Landmark and measurement labels on the image">
          <input type="range" min={0.5} max={3} step={0.1} value={ui.annotationSize} onChange={e => set({ annotationSize: Number(e.target.value) })} aria-label="Label size" />
          <span style={{ fontSize: 12, color: t.tx2, width: 40, textAlign: "right" }}>{Math.round(ui.annotationSize * 100)}%</span>
        </Row>
        <Row t={t} label="Readable text" hint="At least 12 px everywhere; turn off for denser panels"><Switch t={t} label="Readable text" checked={ui.readableText} onChange={toggle("readableText")} /></Row>
        <Row t={t} label="Show labels"><Switch t={t} label="Show labels" checked={ui.showAnnotations} onChange={toggle("showAnnotations")} /></Row>
        <Row t={t} label="Bold labels"><Switch t={t} label="Bold labels" checked={ui.annotationBold} onChange={toggle("annotationBold")} /></Row>
        <Row t={t} label="Avoid overlapping labels" hint="Moves crowded labels apart with a leader line"><Switch t={t} label="Avoid overlapping labels" checked={ui.labelLayout} onChange={toggle("labelLayout")} /></Row>
        <Row t={t} label="Labels for the active analysis only"><Switch t={t} label="Labels for the active analysis only" checked={ui.labelsActiveOnly} onChange={toggle("labelsActiveOnly")} /></Row>
        <Row t={t} label="Landmark names only" hint="Hide measurement values on the image"><Switch t={t} label="Landmark names only" checked={ui.autoHideLabels} onChange={toggle("autoHideLabels")} /></Row>
        <Row t={t} label="Definition tooltips" hint="Show a landmark's definition on hover"><Switch t={t} label="Definition tooltips" checked={ui.showDefTooltips} onChange={toggle("showDefTooltips")} /></Row>
        <Row t={t} label="Scale bar"><Switch t={t} label="Scale bar" checked={ui.showScaleBar} onChange={toggle("showScaleBar")} /></Row>
      </Section>

      <Section t={t} title="Tracing">
        {toggleMagnifier && <Row t={t} label="Magnifier while placing landmarks"><Switch t={t} label="Magnifier while placing landmarks" checked={magnifierOn} onChange={toggleMagnifier} /></Row>}
        <Row t={t} label="Snap radius" hint="How close the cursor must be to snap to a point">
          <input type="range" min={4} max={30} step={1} value={ui.snapTolerance} onChange={e => set({ snapTolerance: Number(e.target.value) })} aria-label="Snap radius" />
          <span style={{ fontSize: 12, color: t.tx2, width: 40, textAlign: "right" }}>{ui.snapTolerance}px</span>
        </Row>
        <Row t={t} label="New line width">
          <input type="range" min={0.5} max={4} step={0.25} value={ui.defaultLineWidth} onChange={e => set({ defaultLineWidth: Number(e.target.value) })} aria-label="New line width" />
          <span style={{ fontSize: 12, color: t.tx2, width: 40, textAlign: "right" }}>{ui.defaultLineWidth}px</span>
        </Row>
        <Row t={t} label="New line style">
          <select value={ui.defaultLineStyle} onChange={e => set({ defaultLineStyle: e.target.value })} style={selStyle(t)} aria-label="New line style">
            <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
          </select>
        </Row>
        <Row t={t} label="New markup colour">
          <div role="radiogroup" aria-label="New markup colour" style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 230 }}>
            {COLORS.map(c => (
              <button key={c.label} role="radio" aria-checked={ui.defaultMarkupColor === c.value} onClick={() => set({ defaultMarkupColor: c.value })} title={c.label} aria-label={c.label}
                style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${ui.defaultMarkupColor === c.value ? t.acc : t.bdr}`, background: c.value || "transparent", cursor: "pointer", padding: 0, color: t.tx3, fontSize: 11 }}>
                {!c.value && "A"}
              </button>
            ))}
          </div>
        </Row>
        <Row t={t} label="Bezier handles always visible">
          <Switch t={t} label="Show control points" checked={ui.showCpAlways} onChange={toggle("showCpAlways")} />
          <span style={{ fontSize: 12, color: t.tx3 }}>control</span>
          <Switch t={t} label="Show anchor points" checked={ui.showAnchorAlways} onChange={toggle("showAnchorAlways")} />
          <span style={{ fontSize: 12, color: t.tx3 }}>anchor</span>
        </Row>
      </Section>

      {setAngleMode && (
        <Section t={t} title="Measurements" note="Saved with this case">
          <Row t={t} label="Angle units">
            <select value={unit} onChange={e => setAngleMode(`${sign}-${e.target.value}`)} style={selStyle(t)} aria-label="Angle units">
              <option value="deg">Degrees</option><option value="rad">Radians</option>
            </select>
          </Row>
          <Row t={t} label="Angle display" hint="Signed keeps the direction (e.g. negative ANB)">
            <select value={sign} onChange={e => setAngleMode(`${e.target.value}-${unit}`)} style={selStyle(t)} aria-label="Angle display">
              <option value="signed">Signed</option><option value="abs">Absolute</option><option value="simple">Simple</option><option value="reflex">Reflex</option>
            </select>
          </Row>
          {setFacingSetting && (
            <Row t={t} label="Profile faces" hint="Anterior is positive for signed measures (ANB, Wits, E-line…)">
              <select value={facingSetting} onChange={e => setFacingSetting(e.target.value)} style={selStyle(t)} aria-label="Profile faces">
                <option value="auto">Automatic ({resolvedFacing})</option><option value="right">Right</option><option value="left">Left</option>
              </select>
            </Row>
          )}
        </Section>
      )}

      <Section t={t} title="PDF report" note="Shown on the report's cover and page headers">
        <Row t={t} label="Clinic or institution">
          <input value={ui.reportClinicName || ""} onChange={e => set({ reportClinicName: e.target.value })} placeholder="e.g. University Dental Hospital" aria-label="Clinic or institution"
            style={{ ...selStyle(t), width: 220 }} />
        </Row>
        <Row t={t} label="Logo" hint="PNG or JPEG; resized to 400 px">
          {ui.reportClinicLogo && <img src={ui.reportClinicLogo} alt="Clinic logo" style={{ height: 28, maxWidth: 90, objectFit: "contain", background: "#fff", borderRadius: 4, padding: 2 }} />}
          <label style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, color: t.tx2, fontSize: 13, cursor: "pointer" }}>
            {ui.reportClinicLogo ? "Replace" : "Choose image"}
            <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
              onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try { set({ reportClinicLogo: await readLogo(f) }); } catch (err) { notify(err.message, { tone: "err" }); }
              }} />
          </label>
          {ui.reportClinicLogo && (
            <button onClick={() => set({ reportClinicLogo: null })}
              style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 13, cursor: "pointer" }}>
              Remove
            </button>
          )}
        </Row>
      </Section>

      <Section t={t} title="AI landmark detection">
        <Row t={t} label="Model" hint={`${LANDMARK_MODEL.version} · runs in your browser; images are not uploaded`}>
          <button onClick={removeModel} disabled={busy}
            style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 13, cursor: busy ? "wait" : "pointer" }}>
            Remove downloaded model
          </button>
        </Row>
      </Section>

      <Section t={t} title="Data and privacy">
        <div style={{ fontSize: 13, color: storageEncrypted ? t.tx2 : t.warn, lineHeight: 1.5 }}>
          {storageEncrypted
            ? "Cases and images are stored only in this browser, encrypted. Nothing is uploaded."
            : "⚠ This browser cannot encrypt stored data; patient identifiers are stored unencrypted. Avoid real patient data on shared devices."}
        </div>
        {store?.usage != null && (
          <Row t={t} label="Space used" hint={store.backend === "ls" ? "In the browser's small local storage — this browser can't use its database here." : "In the browser's database for this site."}>
            <span style={{ fontSize: 13, color: t.tx2 }}>{MB(store.usage)}{store.quota ? ` of ${MB(store.quota)}` : ""}</span>
          </Row>
        )}
        {store?.canPersist && (
          <Row t={t} label="Keep data when space runs low" hint="Otherwise the browser may clear this site's data when the disk is nearly full.">
            {store.persisted
              ? <span style={{ fontSize: 13, color: t.ok }}>On</span>
              : <button onClick={askPersist} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 13, cursor: "pointer" }}>Ask the browser</button>}
          </Row>
        )}
        {onBackup && (
          <Row t={t} label="Backup" hint="One file with every case and its images. Restore it with Import on the home page.">
            <button onClick={onBackup} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 13, cursor: "pointer" }}>Back up all cases</button>
          </Row>
        )}
        {onDrive && (
          <Row t={t} label="Google Drive" hint="Encrypted backups in your own Google Drive. Restore them from the home page.">
            <button onClick={() => { onClose(); onDrive(); }} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: t.tx2, fontSize: 13, cursor: "pointer" }}>Back up to Drive…</button>
          </Row>
        )}
        <div style={{ fontSize: 12, color: t.tx3 }}>To delete everything, use “Clear all local data” on the home page.</div>
      </Section>
    </Modal>
  );
}
