// ═══════════════════════════════════════════════════════════════════════════════
// WHAT'S NEW — release highlights shown on the home screen at every visit
// (panels/WhatsNewDialog.jsx) and from "What's new" in the home page footer.
// For a new release, update the id, title and items.
// ═══════════════════════════════════════════════════════════════════════════════

export const WHATS_NEW = {
  id: "2026-11",
  title: "A big update to Cephalometry Studio",
  subtitle: "AI tracing, DICOM, encrypted storage, Google Drive sync and much more — in a nutshell:",
  items: [
    { icon: "sparkle", color: "#7c5cfc", title: "AI landmark detection", tag: "AI",
      text: "29 landmarks placed in seconds, entirely in your browser. Review each AI point, then pick the analysis — the app shows what's still missing." },
    { icon: "image", color: "#34d399", title: "DICOM and TIFF, calibrated", tag: "Imaging",
      text: "Open files straight from the cephalostat (JPEG-LS and JPEG 2000 too). Millimetres come from the file; window and level use the full 16-bit image." },
    { icon: "target", color: "#f59e0b", title: "Faster, guided tracing", tag: "Workspace",
      text: "A reference map, magnifier and step-by-step placement, tidy labels, visible undo, and ruler calibration that finds the ticks for you." },
    { icon: "lock", color: "#a78bfa", title: "Encrypted, offline, yours", tag: "Privacy",
      text: "Cases and images are encrypted in a real database with room to grow. The app works offline, and nothing is ever deleted automatically." },
    { icon: "cloud", color: "#38bdf8", title: "Google Drive backup and sync", tag: "Cloud",
      text: "Back up to your own Drive and see your cases on every device you sign in on, optionally protected by your passphrase. Profiles keep sets of cases apart." },
    { icon: "folder", color: "#fb923c", title: "A home for your cases", tag: "Organise",
      text: "Pick up where you left off, and manage every case in one place: search, rename, duplicate, export or delete many at once." },
    { icon: "note", color: "#f472b6", title: "Reports worth handing over", tag: "Reports",
      text: "Light or dark PDF reports with your logo, typeset formulas, the normogram, and your research results with every chart." },
    { icon: "chart", color: "#4ade80", title: "Sturdier research", tag: "Research",
      text: "Clearer results views and write-ups, and studies with very small groups no longer break after saving." },
  ],
  also: "Also new: a consistent look across every dialog, self-hosted fonts, and a Features page that shows everything the app can do.",
};
