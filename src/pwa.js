import { registerSW } from "virtual:pwa-register";
import { notify } from "./ui/dialogs.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER — offline app shell (production builds only, see main.jsx)
// A new version waits until the user chooses to reload, so an update never
// interrupts a tracing in progress.
// ═══════════════════════════════════════════════════════════════════════════════
export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      notify("A new version of Cephalometry Studio is available.", {
        key: "sw-update",
        duration: 10 * 60 * 1000,
        action: { label: "Reload", onClick: () => updateSW(true) },
      });
    },
    onOfflineReady() {
      notify("Cephalometry Studio can now open without an internet connection.", { key: "sw-offline" });
    },
  });
}
