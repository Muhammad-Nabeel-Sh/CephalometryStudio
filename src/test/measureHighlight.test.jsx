import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { highlightTargets, drawMeasurementHighlight } from "../canvas/measureHighlight.js";
import { MeasurementsPanel } from "../panels/MeasurementsPanel.jsx";
import { useUIStore } from "../state/uiStore.js";
import { THEMES } from "../data/constants.js";

const pt = (id, label, x, y, extra = {}) => ({ id, type: "point", label, points: [{ x, y }], ...extra });
const S = pt("s", "S", 10, 10), N = pt("n", "N", 50, 10), A = pt("a", "A", 60, 60), B = pt("b", "B", 55, 90);
const SNA = { id: "sna", type: "angle3", label: "SNA", points: [S.points[0], N.points[0], A.points[0]], refLabels: ["S", "N", "A"] };
const SNB = { id: "snb", type: "angle3", label: "SNB", points: [S.points[0], N.points[0], B.points[0]], refLabels: ["S", "N", "B"] };
const ANB = { id: "anb", type: "difference", label: "ANB", points: [], refLabels: ["SNA", "SNB"] };
const MARKUPS = [S, N, A, B, SNA, SNB, ANB];

describe("highlightTargets", () => {
  it("shows an angle with the landmarks it is built from", () => {
    expect(highlightTargets(MARKUPS, "sna").sort()).toEqual(["a", "n", "s", "sna"]);
  });

  it("follows a computed measure to the measures and landmarks behind it", () => {
    expect(highlightTargets(MARKUPS, "anb").sort()).toEqual(["a", "b", "n", "s", "sna", "snb"]);
  });

  it("finds a renamed landmark through its template id", () => {
    const renamed = pt("s2", "Sella (moved)", 10, 10, { templateId: "steiner::S", templateLabel: "S" });
    const angle = { ...SNA, refLabels: ["Old S", "N", "A"], refTemplateIds: ["steiner::S", null, null] };
    expect(highlightTargets([renamed, N, A, angle], "sna")).toContain("s2");
  });

  it("shows a landmark on its own", () => {
    expect(highlightTargets(MARKUPS, "s")).toEqual(["s"]);
  });

  it("leaves out hidden markups and unplaced landmarks", () => {
    const hidden = { ...N, visible: false };
    const unplaced = { ...A, points: [{ x: -99999, y: -99999 }], placed: false };
    expect(highlightTargets([S, hidden, unplaced, SNA], "sna").sort()).toEqual(["s", "sna"]);
  });

  it("is empty for an unknown id, and survives a reference loop", () => {
    expect(highlightTargets(MARKUPS, "nope")).toEqual([]);
    const loopA = { id: "x", type: "sum", label: "X", points: [], refLabels: ["Y"] };
    const loopB = { id: "y", type: "sum", label: "Y", points: [], refLabels: ["X"] };
    expect(highlightTargets([loopA, loopB, S], "x")).toEqual([]); // nothing drawable, but it returns
  });
});

describe("drawMeasurementHighlight", () => {
  const fakeCtx = () => ({ save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fillStyle: "", strokeStyle: "", lineWidth: 0, shadowColor: "", shadowBlur: 0 });

  it("dims the canvas, then redraws the targets on top", () => {
    const ctx = fakeCtx();
    const drawn = [];
    drawMeasurementHighlight(ctx, { markups: MARKUPS, ids: ["sna", "s", "n", "a"], zoom: 1, pan: { x: 0, y: 0 }, W: 400, H: 300, color: "#a78bfa", drawOne: m => drawn.push(m.id) });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(drawn.sort()).toEqual(["a", "n", "s", "sna"]);
    expect(ctx.arc).toHaveBeenCalledTimes(3); // a ring on each landmark
  });

  it("draws nothing without targets", () => {
    const ctx = fakeCtx();
    drawMeasurementHighlight(ctx, { markups: MARKUPS, ids: [], zoom: 1, pan: { x: 0, y: 0 }, W: 400, H: 300, color: "#fff", drawOne: () => {} });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("MeasurementsPanel highlight", () => {
  const t = THEMES.dark;
  const panel = () => render(
    <MeasurementsPanel allMeas={[{ m: SNA, meas: { angle: 82 } }, { m: SNB, meas: { angle: 80 } }]} formulaMeas={[]} t={t}
      calibration={{ done: false }} norms={[]} onUpdateNorms={() => {}} onExportCSV={() => {}} onOpenCalib={() => {}}
      formatAngle={v => `${v}°`} userPresets={[]} onSavePreset={() => {}} onDeletePreset={() => {}} />,
  );
  const card = label => screen.getByText(label).closest("[data-measurement]");
  const current = () => useUIStore.getState().measurementHighlight;

  afterEach(() => {
    cleanup();
    useUIStore.setState({ measurementHighlight: null });
  });

  it("highlights while a mouse is over a card", () => {
    panel();
    fireEvent.pointerEnter(card("SNA"), { pointerType: "mouse" });
    expect(current()).toBe("sna");
    fireEvent.pointerLeave(card("SNA"), { pointerType: "mouse" });
    expect(current()).toBeNull();
  });

  it("marks the highlighted card", () => {
    panel();
    fireEvent.pointerEnter(card("SNB"), { pointerType: "pen" });
    expect(card("SNB").getAttribute("data-highlighted")).toBe("true");
    expect(card("SNA").getAttribute("data-highlighted")).toBe("false");
  });

  it("highlights on keyboard focus", () => {
    panel();
    fireEvent.focus(card("SNA").querySelector("button"));
    expect(current()).toBe("sna");
  });

  it("toggles with a tap on a touch screen, which has no hover", () => {
    panel();
    fireEvent.pointerEnter(card("SNA"), { pointerType: "touch" });
    expect(current()).toBeNull();
    fireEvent.pointerDown(card("SNA"), { pointerType: "touch" });
    fireEvent.click(card("SNA"));
    expect(current()).toBe("sna");
    fireEvent.pointerDown(card("SNA"), { pointerType: "touch" });
    fireEvent.click(card("SNA"));
    expect(current()).toBeNull();
  });

  it("does not toggle when the tap is on a button in the card", () => {
    panel();
    const button = card("SNA").querySelector("button");
    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);
    expect(current()).toBeNull();
  });

  it("clears the highlight when the panel closes", () => {
    const { unmount } = panel();
    fireEvent.pointerEnter(card("SNA"), { pointerType: "mouse" });
    unmount();
    expect(current()).toBeNull();
  });
});
