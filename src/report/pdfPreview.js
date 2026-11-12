// ═══════════════════════════════════════════════════════════════════════════════
// Whether the PDF report can be previewed in the page. The preview is the
// browser's own PDF viewer in an <iframe>: Android Chrome has none, and iPhone
// and iPad show only the first page. Those devices download the report instead.
// ═══════════════════════════════════════════════════════════════════════════════

export const canPreviewPdf = ({ touchPrimary, pdfViewerEnabled }) => !touchPrimary && pdfViewerEnabled !== false;

export function pdfPreviewSupported(win = window) {
  let touchPrimary = false;
  try { touchPrimary = !!win.matchMedia?.("(hover: none) and (pointer: coarse)").matches; } catch { /* no matchMedia */ }
  return canPreviewPdf({ touchPrimary, pdfViewerEnabled: win.navigator?.pdfViewerEnabled });
}
