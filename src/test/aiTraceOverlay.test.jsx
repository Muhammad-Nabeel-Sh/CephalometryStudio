import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TraceDialog, AITraceButton } from "../panels/AITraceOverlay.jsx";
import { describeDownload } from "../workspace/autoTrace.js";
import { THEMES } from "../data/constants.js";

const t = { ...THEMES.dark, id: "dark" };

describe("describeDownload", () => {
  it("shows the size, and a time estimate once it is meaningful", () => {
    expect(describeDownload(12e6, 30e6, 1000)).toBe("12 of 30 MB");
    expect(describeDownload(15e6, 30e6, 20000)).toBe("15 of 30 MB, about 20 seconds left");
    expect(describeDownload(3e6, 30e6, 30000)).toBe("3 of 30 MB, about 5 minutes left");
    expect(describeDownload(30e6, 30e6, 30000)).toBe("30 of 30 MB");
  });

  it("works when the server does not report a size", () => {
    expect(describeDownload(7e6, 0, 5000)).toBe("7 MB downloaded");
  });
});

describe("TraceDialog", () => {
  it("warns about the first-use download, shows progress and can cancel", () => {
    const cancel = vi.fn();
    render(<TraceDialog t={t} onCancel={cancel} status={{ phase: "downloading", received: 15e6, total: 30e6, elapsedMs: 20000 }} />);
    expect(screen.getByText(/First use only/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    fireEvent.click(screen.getByText("Cancel download"));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("drops the warning when the model is already available, and can still cancel", () => {
    const cancel = vi.fn();
    render(<TraceDialog t={t} onCancel={cancel} status={{ phase: "detecting" }} />);
    expect(screen.getByText("Finding landmarks")).toBeTruthy();
    expect(screen.queryByText(/First use only/)).toBeNull();
    fireEvent.click(screen.getByText("Cancel"));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".ai-trace-dot").length).toBe(29);
  });
});

describe("AITraceButton", () => {
  it("cannot be started twice", () => {
    const start = vi.fn();
    const { rerender } = render(<AITraceButton t={t} onClick={start} />);
    fireEvent.click(screen.getByText("AI Trace"));
    expect(start).toHaveBeenCalledTimes(1);
    rerender(<AITraceButton t={t} busy onClick={start} />);
    fireEvent.click(screen.getByText("Tracing…"));
    expect(start).toHaveBeenCalledTimes(1);
  });
});
