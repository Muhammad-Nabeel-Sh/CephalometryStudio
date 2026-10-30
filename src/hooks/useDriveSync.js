// ═══════════════════════════════════════════════════════════════════════════════
// Cross-device sync for the active profile (storage/driveSync.js), used once at
// the app root. A profile with a linked Google account syncs its cases with
// that account's Drive: when the app loads with a sign-in, after edits, and
// every half minute while open (to pick up other devices). Google sign-ins last
// about an hour; then the status is "signin" until the user clicks.
//
// status: off (no Google account) | signin | setup (first device: choose
// encryption) | locked (encrypted: passphrase needed on this device) |
// syncing | idle | error
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { activeProfile, activeProfileId, addProfile, profileForEmail, updateProfile } from "../storage/profiles.js";
import { driveConfigured, isConnected, connect, disconnect, accountEmail, currentToken } from "../storage/driveBackup.js";
import { driveFolder, createSyncConfig, unlockSyncKey, makeCipher, syncCases, applySyncResult, localImages } from "../storage/driveSync.js";
import { saveProjects } from "../storage/projectStore.js";
import { idbGet, idbPut, META } from "../storage/appDB.js";
import { getStoredKey, putStoredKey, deleteStoredKey } from "../storage/secureStorage.js";
import { askConfirm, notify } from "../ui/dialogs.js";

const AUTO_MS = 30000;
const syncKeyId = () => `sync_${activeProfileId()}`;
const linkedEmail = () => (driveConfigured() ? activeProfile().email || "" : "");

async function confirmRemovals(cases) {
  const n = cases.length;
  const list = cases.slice(0, 6).map((p) => `“${p.name || "Untitled"}”`).join(", ") + (n > 6 ? `, and ${n - 6} more` : "");
  return askConfirm({
    title: "Cases deleted on another device",
    message: `${n === 1 ? "A case was" : `${n} cases were`} deleted on another device: ${list}. Remove ${n === 1 ? "it" : "them"} from this device too? If you keep ${n === 1 ? "it" : "them"}, ${n === 1 ? "it goes" : "they go"} back to your other devices.`,
    confirmLabel: "Remove here too",
    cancelLabel: "Keep",
    danger: true,
  });
}

// `onSwitch(profileId, token)` saves and switches profile (App root).
export function useDriveSync({ projects, setProjects, loaded, onSwitch }) {
  const [status, setStatus] = useState(() => (linkedEmail() ? "signin" : "off"));
  const [info, setInfo] = useState({ lastSync: null, report: null, error: null, progress: null });
  const projectsRef = useRef(projects);
  const ctx = useRef(null); // { drive, config, cipher }
  const busy = useRef(false);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Last sync time from the previous visit.
  useEffect(() => {
    if (!linkedEmail()) return;
    idbGet(META, "sync").then((s) => { if (s?.lastSync) setInfo((i) => ({ ...i, lastSync: s.lastSync })); }).catch(() => {});
  }, []);

  const syncNow = useCallback(async () => {
    if (busy.current || !linkedEmail()) return;
    if (!isConnected()) { setStatus("signin"); return; }
    busy.current = true;
    setStatus("syncing");
    setInfo((i) => ({ ...i, error: null, progress: "Connecting to Google Drive…" }));
    try {
      if (!ctx.current?.cipher) {
        const drive = ctx.current?.drive || await driveFolder();
        const config = ctx.current?.config || await drive.readConfig();
        if (!config) { ctx.current = { drive, config: null }; setStatus("setup"); return; }
        let key = null;
        if (config.encrypted) {
          const stored = await getStoredKey(syncKeyId());
          if (stored?.keyId !== config.keyId) { ctx.current = { drive, config }; setStatus("locked"); return; }
          key = stored.key;
        }
        ctx.current = { drive, config, cipher: makeCipher(key) };
      }
      await saveProjects(projectsRef.current); // images are in the store before they're read
      const saved = await idbGet(META, "sync").catch(() => null);
      const snapshot = projectsRef.current;
      const res = await syncCases({
        cases: snapshot,
        state: saved?.keyId === ctx.current.config.keyId ? saved : null,
        drive: ctx.current.drive,
        cipher: ctx.current.cipher,
        images: localImages,
        confirmRemovals,
        onProgress: (progress) => setInfo((i) => ({ ...i, progress })),
      });
      setProjects((cur) => applySyncResult(cur, snapshot, res));
      const lastSync = Date.now();
      await idbPut(META, "sync", { ...res.state, keyId: ctx.current.config.keyId, lastSync });
      setInfo({ lastSync, report: res.report, error: null, progress: null });
      setStatus("idle");
      const { downloaded, conflicts } = res.report;
      if (conflicts.length) {
        notify(`${conflicts.length} case${conflicts.length === 1 ? " was" : "s were"} changed on two devices; both versions are kept (“from another device”).`, { tone: "warn", duration: 12000 });
      } else if (downloaded) {
        notify(`${downloaded} case${downloaded === 1 ? "" : "s"} updated from your other devices.`, { tone: "ok" });
      }
    } catch (e) {
      if (e?.kind === "auth") setStatus("signin");
      else { setStatus("error"); setInfo((i) => ({ ...i, error: e?.message || "Sync failed.", progress: null })); }
    } finally {
      busy.current = false;
    }
  }, [setProjects]);

  // First device: create the sync folder's settings. passphrase null → no encryption.
  const setupSync = useCallback(async (passphrase) => {
    const drive = ctx.current?.drive || await driveFolder();
    const existing = await drive.readConfig(); // another device may have set it up meanwhile
    if (existing) {
      ctx.current = { drive, config: existing };
      if (existing.encrypted) { setStatus("locked"); return "locked"; }
      ctx.current.cipher = makeCipher(null);
    } else {
      const { config, key } = await createSyncConfig(passphrase || null);
      await drive.writeConfig(config);
      if (key) await putStoredKey(syncKeyId(), { key, keyId: config.keyId });
      ctx.current = { drive, config, cipher: makeCipher(key) };
    }
    setStatus("idle");
    await syncNow();
    return "done";
  }, [syncNow]);

  // Another device encrypted the folder: unlock it here once.
  const unlock = useCallback(async (passphrase) => {
    const { config } = ctx.current;
    const key = await unlockSyncKey(config, passphrase);
    await putStoredKey(syncKeyId(), { key, keyId: config.keyId });
    ctx.current = { ...ctx.current, cipher: makeCipher(key) };
    setStatus("idle");
    await syncNow();
  }, [syncNow]);

  // Sign in to this profile's Google account (call from a click).
  const signIn = useCallback(async () => {
    const want = linkedEmail();
    await connect({ email: want });
    const email = await accountEmail();
    if (want && email.toLowerCase() !== want.toLowerCase()) {
      await disconnect();
      throw new Error(`You signed in as ${email}, but this profile syncs with ${want}. Sign in with that account.`);
    }
    await syncNow();
  }, [syncNow]);

  // Link this profile to a Google account (call from a click). If another
  // profile already uses that account, switch to it instead.
  const linkGoogle = useCallback(async () => {
    await connect({ chooseAccount: true });
    const email = await accountEmail();
    const me = activeProfile();
    const other = profileForEmail(email);
    if (other && other.id !== me.id) { await onSwitch(other.id, currentToken()); return; }
    updateProfile(me.id, { email, ...(me.name === "This device" ? { name: email } : {}) });
    ctx.current = null;
    setStatus("idle");
    await syncNow();
  }, [syncNow, onSwitch]);

  // A new profile for another Google account (or the existing one), switched to.
  const addGoogleProfile = useCallback(async () => {
    await connect({ chooseAccount: true });
    const email = await accountEmail();
    const p = profileForEmail(email) || addProfile({ email, name: email });
    await onSwitch(p.id, currentToken());
  }, [onSwitch]);

  // Stop syncing this profile: cases stay here and in Drive.
  const stopSync = useCallback(async () => {
    await disconnect();
    updateProfile(activeProfileId(), { email: undefined });
    await deleteStoredKey(syncKeyId()).catch(() => {});
    await idbPut(META, "sync", null).catch(() => {});
    ctx.current = null;
    setStatus("off");
    setInfo({ lastSync: null, report: null, error: null, progress: null });
  }, []);

  // Sync when the app opens with a sign-in (e.g. right after switching profile).
  useEffect(() => {
    if (!loaded || !linkedEmail() || !isConnected()) return;
    const t = setTimeout(syncNow, 0);
    return () => clearTimeout(t);
  }, [loaded, syncNow]);

  // After edits, and periodically while open, to pick up other devices.
  useEffect(() => {
    if (!loaded || status !== "idle") return;
    const t = setTimeout(syncNow, AUTO_MS);
    return () => clearTimeout(t);
  }, [projects, loaded, status, syncNow]);

  return {
    status, email: linkedEmail(), ...info,
    syncNow, setupSync, unlock, signIn, linkGoogle, addGoogleProfile, stopSync,
    available: driveConfigured(),
  };
}
