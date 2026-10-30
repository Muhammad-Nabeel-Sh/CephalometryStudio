// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE MENU (home page header) — switch profiles, add one (local or a Google
// account), and the sync status of the active profile (hooks/useDriveSync.js).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { listProfiles, activeProfileId, addProfile, updateProfile, removeProfile, DEFAULT_ID } from "../storage/profiles.js";
import { deleteProfileData } from "../storage/projectStore.js";
import { loadGoogleSignIn } from "../storage/driveBackup.js";
import { askConfirm, askText, notify } from "../ui/dialogs.js";

function ago(t) {
  if (!t) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

function syncLine(sync) {
  switch (sync.status) {
    case "off": return "On this device only";
    case "signin": return "Sign in to sync";
    case "setup": return "Sync setup not finished";
    case "locked": return "Locked: enter the sync passphrase";
    case "syncing": return sync.progress || "Syncing…";
    case "error": return sync.error || "Sync failed";
    default: return sync.lastSync ? `Synced ${ago(sync.lastSync)}` : "Synced";
  }
}

export default function ProfileMenu({ t, sync, onSwitch, onOpenSetup }) {
  const [open, setOpen] = useState(false);
  const [, setVersion] = useState(0); // re-read the profile list after changes
  const ref = useRef(null);
  const profiles = listProfiles();
  const me = profiles.find((p) => p.id === activeProfileId()) || profiles[0];

  useEffect(() => {
    if (!open) return;
    if (sync.available) loadGoogleSignIn().catch(() => {}); // so sign-in popups open inside the click
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, sync.available]);

  const act = (fn) => async () => {
    try { await fn(); } catch (e) { notify(e?.message || "Something went wrong.", { tone: "err" }); }
  };

  const addLocal = act(async () => {
    const name = await askText({ title: "New profile", label: "Profile name", defaultValue: "", confirmLabel: "Create" });
    if (!name?.trim()) return;
    await onSwitch(addProfile({ name }).id);
  });
  const rename = act(async () => {
    const name = await askText({ title: "Rename profile", label: "Profile name", defaultValue: me.name });
    if (!name?.trim()) return;
    updateProfile(me.id, { name: name.trim() });
    setVersion((v) => v + 1);
  });
  const remove = (p) => act(async () => {
    const ok = await askConfirm({
      title: `Remove “${p.name}” from this device?`,
      message: p.email
        ? `Its cases on this device are deleted. They stay in ${p.email}'s Google Drive and come back if you add that account again.`
        : "Its cases on this device are deleted permanently. Back them up first if you need them.",
      confirmLabel: "Remove profile",
      danger: true,
    });
    if (!ok) return;
    await deleteProfileData(p.id);
    removeProfile(p.id);
    setVersion((v) => v + 1);
  });
  const stop = act(async () => {
    const ok = await askConfirm({
      title: "Stop syncing this profile?",
      message: `Cases stay on this device and in ${sync.email}'s Google Drive; changes here no longer reach your other devices.`,
      confirmLabel: "Stop syncing",
    });
    if (ok) { await sync.stopSync(); setVersion((v) => v + 1); }
  });

  const item = { display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderRadius: 6, background: "transparent", color: t.tx, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
  const dot = (c) => <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
  const statusColor = sync.status === "error" ? t.err : ["signin", "setup", "locked"].includes(sync.status) ? t.warn : t.tx3;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Profiles and sync"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, cursor: "pointer", fontFamily: "inherit", maxWidth: 240 }}>
        {dot(me.color)}
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{me.name}</span>
          <span style={{ fontSize: 12, color: statusColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{syncLine(sync)}</span>
        </span>
        <span aria-hidden style={{ color: t.tx3, fontSize: 12 }}>▾</span>
      </button>

      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, maxWidth: "90vw", background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 10, boxShadow: `0 12px 32px ${t.shadow}`, padding: 8, zIndex: 60 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.tx3, padding: "4px 10px" }}>Profiles</div>
          {profiles.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center" }}>
              <button role="menuitemradio" aria-checked={p.id === me.id} onClick={p.id === me.id ? undefined : act(() => onSwitch(p.id))}
                style={{ ...item, display: "flex", alignItems: "center", gap: 8, fontWeight: p.id === me.id ? 700 : 400, cursor: p.id === me.id ? "default" : "pointer" }}>
                {dot(p.color)}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {p.email && p.email !== p.name && <span style={{ display: "block", fontSize: 12, color: t.tx3, overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</span>}
                </span>
                {p.id === me.id && <span style={{ color: t.acc }}>✓</span>}
              </button>
              {p.id !== me.id && p.id !== DEFAULT_ID && (
                <button onClick={remove(p)} title={`Remove ${p.name} from this device`} aria-label={`Remove ${p.name}`}
                  style={{ border: "none", background: "transparent", color: t.tx3, cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>×</button>
              )}
            </div>
          ))}

          <div style={{ borderTop: `1px solid ${t.bdr}`, margin: "6px 0" }} />
          {sync.available ? (
            sync.email ? (
              <div style={{ padding: "4px 10px 6px", fontSize: 12, color: t.tx2, lineHeight: 1.5 }}>
                Syncs with <strong style={{ color: t.tx }}>{sync.email}</strong>
                <div style={{ color: statusColor }}>{syncLine(sync)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {sync.status === "signin" && <button style={{ ...item, width: "auto", border: `1px solid ${t.acc}`, color: t.acc }} onClick={act(sync.signIn)}>Sign in to sync</button>}
                  {["setup", "locked"].includes(sync.status) && <button style={{ ...item, width: "auto", border: `1px solid ${t.acc}`, color: t.acc }} onClick={() => { setOpen(false); onOpenSetup(); }}>Finish sync setup</button>}
                  {["idle", "error"].includes(sync.status) && <button style={{ ...item, width: "auto", border: `1px solid ${t.bdr}` }} onClick={act(sync.syncNow)}>Sync now</button>}
                  <button style={{ ...item, width: "auto", color: t.tx3 }} onClick={stop}>Stop syncing</button>
                </div>
              </div>
            ) : (
              <button role="menuitem" style={item} onClick={act(sync.linkGoogle)}>Sync this profile with Google Drive…</button>
            )
          ) : (
            <div style={{ padding: "4px 10px", fontSize: 12, color: t.tx3 }}>Google Drive sync isn't set up for this site.</div>
          )}

          <div style={{ borderTop: `1px solid ${t.bdr}`, margin: "6px 0" }} />
          <button role="menuitem" style={item} onClick={addLocal}>Add a profile on this device…</button>
          {sync.available && <button role="menuitem" style={item} onClick={act(sync.addGoogleProfile)}>Add a Google account…</button>}
          <button role="menuitem" style={item} onClick={rename}>Rename this profile…</button>
        </div>
      )}
    </div>
  );
}
