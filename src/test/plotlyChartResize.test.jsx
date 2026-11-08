// Research charts fit their container: a fixed layout width is dropped, and the chart
// refits whenever its box changes (switching tables / charts / side by side), not only
// on window resizes (Plotly's own `responsive`).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

const plotly = vi.hoisted(() => ({ newPlot: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } }));
vi.mock("plotly.js-basic-dist-min", () => plotly);

import PlotlyChart from "../research/PlotlyChart.jsx";

let observers = [];
class FakeRO {
  constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
  observe(el) { this.el = el; }
  disconnect() { this.disconnected = true; }
}

afterEach(() => { cleanup(); observers = []; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("PlotlyChart sizing", () => {
  it("drops a fixed width and refits when its container changes size", async () => {
    vi.stubGlobal("ResizeObserver", FakeRO);
    const { unmount } = render(<PlotlyChart data={[{ type: "bar", x: [1], y: [1] }]} layout={{ width: 400, height: 300 }} />);
    await waitFor(() => expect(plotly.newPlot).toHaveBeenCalled());
    const layout = plotly.newPlot.mock.calls.at(-1)[2];
    expect(layout.width).toBeUndefined();
    expect(layout.autosize).toBe(true);
    expect(layout.height).toBe(300);

    const ro = observers.at(-1);
    Object.defineProperty(ro.el, "clientWidth", { value: 350, configurable: true });
    plotly.Plots.resize.mockClear();
    vi.useFakeTimers();
    ro.cb([]); ro.cb([]); ro.cb([]);          // a burst of size changes → one refit
    vi.advanceTimersByTime(100);
    expect(plotly.Plots.resize).toHaveBeenCalledTimes(1);
    expect(plotly.Plots.resize).toHaveBeenCalledWith(ro.el);

    unmount();
    expect(ro.disconnected).toBe(true);
  });
});
