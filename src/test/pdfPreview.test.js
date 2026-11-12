import { describe, it, expect } from "vitest";
import { canPreviewPdf, pdfPreviewSupported } from "../report/pdfPreview.js";

describe("canPreviewPdf", () => {
  it("previews on a desktop browser with a PDF viewer", () => {
    expect(canPreviewPdf({ touchPrimary: false, pdfViewerEnabled: true })).toBe(true);
  });

  it("previews on a desktop browser that does not report a viewer", () => {
    expect(canPreviewPdf({ touchPrimary: false, pdfViewerEnabled: undefined })).toBe(true);
  });

  it("downloads directly on phones and tablets", () => {
    // iPhone and iPad report a viewer but show only the first page in a frame.
    expect(canPreviewPdf({ touchPrimary: true, pdfViewerEnabled: true })).toBe(false);
    expect(canPreviewPdf({ touchPrimary: true, pdfViewerEnabled: false })).toBe(false);
  });

  it("downloads directly when the browser has no PDF viewer", () => {
    expect(canPreviewPdf({ touchPrimary: false, pdfViewerEnabled: false })).toBe(false);
  });
});

describe("pdfPreviewSupported", () => {
  const win = (touch, viewer) => ({
    matchMedia: q => ({ matches: q === "(hover: none) and (pointer: coarse)" ? touch : false }),
    navigator: { pdfViewerEnabled: viewer },
  });

  it("reads a touch-first screen", () => {
    expect(pdfPreviewSupported(win(true, true))).toBe(false);
  });

  it("reads a desktop", () => {
    expect(pdfPreviewSupported(win(false, true))).toBe(true);
  });

  it("falls back to previewing when it cannot tell", () => {
    expect(pdfPreviewSupported({ navigator: {} })).toBe(true);
  });
});
