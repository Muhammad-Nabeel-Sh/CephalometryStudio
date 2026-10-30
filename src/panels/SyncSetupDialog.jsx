// ═══════════════════════════════════════════════════════════════════════════════
// SYNC SETUP — the first device chooses whether synced cases are encrypted with
// a passphrase (optional, recommended); other devices unlock with it once.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Btn, FieldLabel } from "../ui/ui.jsx";
import { askConfirm } from "../ui/dialogs.js";

const MIN_PASS = 10;

export default function SyncSetupDialog({ t, sync, onClose }) {
  const locked = sync.status === "locked";
  const [encrypt, setEncrypt] = useState(true);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const input = { padding: "7px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };

  const go = async () => {
    setError(null);
    try {
      if (locked) {
        if (!pass) throw new Error("Enter the sync passphrase.");
        setBusy(true);
        await sync.unlock(pass);
      } else if (encrypt) {
        if (pass.length < MIN_PASS) throw new Error(`Use a passphrase of at least ${MIN_PASS} characters.`);
        if (pass !== pass2) throw new Error("The two passphrases don't match.");
        setBusy(true);
        await sync.setupSync(pass);
      } else {
        const ok = await askConfirm({
          title: "Sync without encryption?",
          message: "Patient names, details and images will be stored readable in this Google account's Drive. Encrypt unless the data is anonymised or the account is approved for patient data.",
          confirmLabel: "Sync unencrypted",
          danger: true,
        });
        if (!ok) return;
        setBusy(true);
        await sync.setupSync(null);
      }
      onClose();
    } catch (e) {
      setError(e?.kind === "passphrase" ? "Wrong passphrase. Use the one set when sync was first turned on." : e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal t={t} title={locked ? "Unlock synced cases" : "Turn on sync"} onClose={onClose} customWidth={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: t.tx2, lineHeight: 1.5 }}>
        {locked ? (
          <div>
            The cases synced with <strong style={{ color: t.tx }}>{sync.email}</strong> are encrypted. Enter the sync passphrase
            once on this device; it is then remembered here.
          </div>
        ) : (
          <>
            <div>
              Cases of this profile will be kept in a “Cephalometry Studio sync” folder in
              <strong style={{ color: t.tx }}> {sync.email}</strong>&apos;s Google Drive, and appear on every device where you
              sign in with that account. They also stay on this device.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: t.tx }}>
              <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
              Encrypt with a passphrase (recommended)
            </label>
            {!encrypt && <div style={{ fontSize: 12, color: t.warn }}>Without a passphrase, anyone with access to this Google account can read the patient data in the sync folder.</div>}
          </>
        )}
        {(locked || encrypt) && (
          <div>
            <FieldLabel t={t}>Sync passphrase</FieldLabel>
            <input type="password" autoComplete={locked ? "current-password" : "new-password"} value={pass} onChange={(e) => setPass(e.target.value)}
              style={input} aria-label="Sync passphrase" placeholder={locked ? "" : `At least ${MIN_PASS} characters`} />
            {!locked && (
              <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)}
                style={{ ...input, marginTop: 6 }} aria-label="Repeat the sync passphrase" placeholder="Repeat the passphrase" />
            )}
            {!locked && <div style={{ fontSize: 12, color: t.warn, marginTop: 4 }}>You need it on each new device. If it is lost, the synced copy can't be opened (the cases on your devices are not affected).</div>}
          </div>
        )}
        {error && <div role="alert" style={{ color: t.err }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn t={t} ghost onClick={onClose} disabled={busy}>Later</Btn>
          <Btn t={t} active onClick={go} disabled={busy}>{busy ? "Working…" : locked ? "Unlock and sync" : "Start syncing"}</Btn>
        </div>
      </div>
    </Modal>
  );
}
