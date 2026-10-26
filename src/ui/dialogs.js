// ═══════════════════════════════════════════════════════════════════════════════
// In-app dialogs and toasts (B5) — replace window.alert / confirm / prompt
//
//   await askConfirm({ title, message, confirmLabel, danger })  → true / false
//   await askText({ title, label, defaultValue })               → string / null
//   showInfo({ title, message, items })                          → Promise (closed)
//   notify(text, { tone, action: { label, onClick }, duration, key }) → toast id
//
// Callable from anywhere (React or plain modules); <DialogHost t={t} /> (ui/DialogHost.jsx)
// is mounted once at the app root and renders the queue.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from "zustand";

export const useDialogStore = create(() => ({ dialogs: [], toasts: [] }));

let seq = 0;
const nextId = () => `d${++seq}`;

function openDialog(kind, opts) {
  return new Promise(resolve => {
    const id = nextId();
    useDialogStore.setState(s => ({ dialogs: [...s.dialogs, { id, kind, ...opts, resolve }] }));
  });
}

export function closeDialog(id, value) {
  const d = useDialogStore.getState().dialogs.find(x => x.id === id);
  useDialogStore.setState(s => ({ dialogs: s.dialogs.filter(x => x.id !== id) }));
  d?.resolve(value);
}

export const askConfirm = (opts = {}) => openDialog("confirm", opts);
export const askText = (opts = {}) => openDialog("text", opts);
export const showInfo = (opts = {}) => openDialog("info", opts);

// A toast with a `key` replaces the previous toast with the same key.
export function notify(text, { tone = "info", action = null, duration, key = null } = {}) {
  const id = nextId();
  const ms = duration ?? (action ? 8000 : tone === "err" ? 7000 : 4000);
  useDialogStore.setState(s => ({ toasts: [...s.toasts.filter(x => !key || x.key !== key).slice(-3), { id, key, text, tone, action }] }));
  setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id) {
  useDialogStore.setState(s => ({ toasts: s.toasts.filter(x => x.id !== id) }));
}

export function dismissToastKey(key) {
  useDialogStore.setState(s => ({ toasts: s.toasts.filter(x => x.key !== key) }));
}

// Test/teardown helper.
export function _resetDialogs() {
  useDialogStore.setState({ dialogs: [], toasts: [] });
}
export const _dialogState = () => useDialogStore.getState();
