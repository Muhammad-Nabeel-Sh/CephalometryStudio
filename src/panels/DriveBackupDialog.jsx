// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE BACKUP — encrypted backups of every case in the user's own Drive
// (storage/driveBackup.js). Opened from the home page (backup and restore) and
// from Settings (backup only; restoring belongs on the home page).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { Btn, FieldLabel } from "../ui/ui.jsx";
import { SMALL_BTN } from "../ui/tokens.js";
import { askConfirm, notify } from "../ui/dialogs.js";
import { buildBackupBlob } from "../storage/projectStore.js";
import { parseBackupPayload } from "../storage/cephxFormat.js";
import {
  FOLDER_NAME, loadGoogleSignIn, connect, disconnect, isConnected, accountEmail, ensureFolder,
  hasPassphraseCheck, checkPassphrase, setPassphraseCheck, uploadBackup, listBackups, fetchBackup,
  trashBackup, lastBackup, recordBackup,
} from "../storage/driveBackup.js";

const MIN_PASS = 10;
const MB = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(0.1, n / 1e6).toFixed(1)} MB`);
const when = (t) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function DriveBackupDialog({ t, projects, canRestore, onRestore, onClose }) {
  const [account, setAccount] = useState(null); // { email, folderId, hasCheck }
  const [busy, setBusy] = useState(null);       // status text while working
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [encrypt, setEncrypt] = useState(true);
  const [backups, setBackups] = useState(null);
  const [last, setLast] = useState(() => lastBackup());

  // Load Google's sign-in script now, so the popup opens inside the click.
  useEffect(() => { loadGoogleSignIn().catch(() => {}); }, []);

  const input = { padding: "7px 10px", borderRadius: 6, border: `1px solid ${t.bdr}`, background: t.surf2, color: t.tx, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const firstBackup = account && !account.hasCheck;

  const run = async (label, fn) => {
    setError(null);
    setBusy(label);
    setProgress(null);
    try { await fn(); }
    catch (e) {
      setError(e?.message || "Something went wrong.");
      if (e?.kind === "auth") setAccount(null);
    } finally { setBusy(null); setProgress(null); }
  };

  const doConnect = () => run("Connecting to Google Drive…", async () => {
    if (!isConnected()) await connect();
    const [email, folderId] = await Promise.all([accountEmail(), ensureFolder()]);
    setAccount({ email, folderId, hasCheck: await hasPassphraseCheck(folderId) });
  });

  const doDisconnect = () => run("Disconnecting…", async () => {
    await disconnect();
    setAccount(null);
    setBackups(null);
  });

  const doBackup = () => run("Preparing the backup…", async () => {
    if (!encrypt) {
      const ok = await askConfirm({
        title: "Back up without encryption?",
        message: "The backup will contain patient names and images readable by anyone with access to this Google account. Encrypt it unless the data is anonymised or your Google account is approved for patient data.",
        confirmLabel: "Back up unencrypted",
        danger: true,
      });
      if (!ok) return;
    } else {
      if (pass.length < MIN_PASS) throw new Error(`Use a passphrase of at least ${MIN_PASS} characters.`);
      if (firstBackup && pass !== pass2) throw new Error("The two passphrases don't match.");
    }
    if (encrypt && account.hasCheck) {
      setBusy("Checking the passphrase…");
      if ((await checkPassphrase(account.folderId, pass)) === "mismatch") {
        const ok = await askConfirm({
          title: "Different passphrase",
          message: "This passphrase is not the one used for your earlier Drive backups. Each backup can only be restored with the passphrase it was made with. Use this passphrase from now on?",
          confirmLabel: "Use the new passphrase",
          danger: true,
        });
        if (!ok) return;
        await setPassphraseCheck(account.folderId, pass);
      }
    }
    setBusy("Collecting cases and images…");
    const { blob, count, missing } = await buildBackupBlob(projects);
    const res = await uploadBackup(account.folderId, blob, encrypt ? pass : null, {
      cases: count,
      onProgress: (f, label) => { setBusy(label); setProgress(f); },
    });
    if (encrypt && !account.hasCheck) {
      await setPassphraseCheck(account.folderId, pass);
      setAccount((a) => ({ ...a, hasCheck: true }));
    }
    recordBackup({ cases: count, size: res.size, account: account.email });
    setLast(lastBackup());
    setPass2("");
    if (backups) setBackups(await listBackups(account.folderId));
    notify(
      missing
        ? `Backed up ${count} case${count === 1 ? "" : "s"} to Google Drive, but ${missing} image${missing === 1 ? "" : "s"} couldn't be read and ${missing === 1 ? "is" : "are"} missing.`
        : `Backed up ${count} case${count === 1 ? "" : "s"} (${MB(res.size)}) to Google Drive${res.encrypted ? "" : ", not encrypted"}.`,
      { tone: missing ? "warn" : "ok" },
    );
  });

  const doList = () => run("Looking for backups…", async () => setBackups(await listBackups(account.folderId)));

  const doRestore = (b) => run("Downloading the backup…", async () => {
    if (b.encrypted && !pass) throw new Error("Enter the passphrase this backup was made with.");
    const text = await fetchBackup(b.id, pass);
    setBusy("Reading the backup…");
    const res = parseBackupPayload(JSON.parse(text));
    if (!res.ok) throw new Error(res.error);
    onClose();
    onRestore(res);
  });

  const doTrash = (b) => run("Moving to the Drive trash…", async () => {
    const ok = await askConfirm({
      title: "Move this backup to the trash?",
      message: `The backup of ${when(b.createdTime)} goes to the Google Drive trash, where it can be restored for 30 days.`,
      confirmLabel: "Move to trash",
      danger: true,
    });
    if (!ok) return;
    await trashBackup(b.id);
    setBackups((list) => list.filter((x) => x.id !== b.id));
  });

  return (
    <Modal t={t} title="Google Drive backup" onClose={onClose} customWidth={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13, color: t.tx2, lineHeight: 1.5 }}>
        <div>
          Backups of every case, with images and patient details, in a folder called
          “{FOLDER_NAME}” in your own Google Drive. The app can only see the files it creates there.
          With a passphrase, backups are encrypted before they leave this device; without it, nobody,
          including us, can open them.
        </div>

        {/* Account */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {account ? (
            <>
              <span style={{ color: t.ok, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>Connected: {account.email || "Google account"}</span>
              <Btn t={t} small ghost onClick={doDisconnect} disabled={!!busy} style={SMALL_BTN}>Disconnect</Btn>
            </>
          ) : (
            <Btn t={t} onClick={doConnect} disabled={!!busy}>Connect Google Drive</Btn>
          )}
        </div>

        {account && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: t.tx }}>
              <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
              Encrypt with a passphrase (recommended)
            </label>
            {!encrypt && (
              <div style={{ fontSize: 12, color: t.warn }}>
                Without a passphrase the backup is an ordinary .cephx file: anyone with access to this Google account can read the patient data in it.
              </div>
            )}
            {(encrypt || backups?.some((b) => b.encrypted)) && <div>
              <FieldLabel t={t}>{encrypt ? "Backup passphrase" : "Passphrase (to restore encrypted backups)"}</FieldLabel>
              <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} style={input}
                placeholder={`At least ${MIN_PASS} characters`} aria-label="Backup passphrase" />
              {encrypt && firstBackup && (
                <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} style={{ ...input, marginTop: 6 }}
                  placeholder="Repeat the passphrase" aria-label="Repeat the passphrase" />
              )}
              {encrypt && (
                <div style={{ fontSize: 12, color: firstBackup ? t.warn : t.tx3, marginTop: 4 }}>
                  {firstBackup
                    ? "Write it down somewhere safe. If it is lost, the backups can't be restored — there is no reset."
                    : "The same passphrase as your earlier backups."}
                </div>
              )}
            </div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn t={t} active onClick={doBackup} disabled={!!busy || !projects?.length}>
                Back up {projects?.length || 0} case{projects?.length === 1 ? "" : "s"} now
              </Btn>
              {canRestore && <Btn t={t} onClick={doList} disabled={!!busy}>Restore from Drive…</Btn>}
            </div>
          </>
        )}

        {busy && (
          <div role="status" style={{ color: t.tx }}>
            {busy}{progress != null ? ` ${Math.round(progress * 100)}%` : ""}
            {progress != null && (
              <div style={{ height: 4, background: t.surf3, borderRadius: 2, marginTop: 6 }}>
                <div style={{ height: 4, width: `${Math.round(progress * 100)}%`, background: t.acc, borderRadius: 2 }} />
              </div>
            )}
          </div>
        )}
        {error && <div role="alert" style={{ color: t.err }}>{error}</div>}

        {backups && (
          <div style={{ border: `1px solid ${t.bdr}`, borderRadius: 8, maxHeight: 240, overflowY: "auto" }}>
            {backups.length === 0 && <div style={{ padding: 12, color: t.tx3 }}>No backups in this Google Drive yet.</div>}
            {backups.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${t.bdr}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.tx }}>{when(b.createdTime)}</div>
                  <div style={{ fontSize: 12, color: t.tx3 }}>{b.cases} case{b.cases === 1 ? "" : "s"} · {MB(b.size)} · {b.encrypted ? "encrypted" : "not encrypted"}</div>
                </div>
                <Btn t={t} small onClick={() => doRestore(b)} disabled={!!busy} style={SMALL_BTN}>Restore</Btn>
                <Btn t={t} small ghost danger onClick={() => doTrash(b)} disabled={!!busy} style={SMALL_BTN}>Trash</Btn>
              </div>
            ))}
          </div>
        )}
        {backups?.length > 0 && <div style={{ fontSize: 12, color: t.tx3 }}>Restoring adds the backup&apos;s cases; you are asked before any case here is replaced. Enter that backup&apos;s passphrase above first.</div>}

        <div style={{ fontSize: 12, color: t.tx3 }}>
          {last ? `Last Drive backup from this device: ${when(last.at)} (${last.cases} case${last.cases === 1 ? "" : "s"}).` : "No Drive backup from this device yet."}
          {" "}Sign-ins last about an hour; you may be asked to connect again.
        </div>
      </div>
    </Modal>
  );
}
