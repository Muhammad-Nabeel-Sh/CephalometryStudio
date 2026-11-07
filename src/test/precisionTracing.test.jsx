import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { loupePosition, loupeView, stepLoupeZoom, nudgeDelta, canNudge, LOUPE_ZOOMS, LOUPE_MAX_SCALE } from "../lib/precision.js";
import { NudgePad } from "../panels/NudgePad.jsx";
import { PlacingGuide } from "../panels/PlacingGuide.jsx";
import { useUIStore, PREF_KEYS } from "../state/uiStore.js";
import { THEMES } from "../data/constants.js";

const t = THEMES.dark;
const AREA = { w: 800, h: 600 };
const SIZE = 180;
const covers = (pos, p) => p.x >= pos.left && p.x <= pos.left + SIZE && p.y >= pos.top && p.y <= pos.top + SIZE;

afterEach(() => {
  cleanup();
  useUIStore.setState({ loupeZoom: 4 });
});

describe("loupePosition", () => {
  it("sits up and to the left of a pen, away from the writing hand", () => {
    const pos = loupePosition({ x: 400, y: 300 }, AREA, SIZE, "pen");
    expect(pos.left + SIZE).toBeLessThan(400);
    expect(pos.top + SIZE).toBeLessThan(300);
  });

  it("sits above a finger, clear of the fingertip", () => {
    const pos = loupePosition({ x: 400, y: 400 }, AREA, SIZE, "touch");
    expect(pos.top + SIZE).toBeLessThanOrEqual(400 - 40);
  });

  it.each([
    ["top-left", { x: 5, y: 5 }],
    ["top-right", { x: 795, y: 5 }],
    ["bottom-left", { x: 5, y: 595 }],
    ["bottom-right", { x: 795, y: 595 }],
    ["top edge", { x: 400, y: 2 }],
  ])("stays on the canvas and off the point at the %s", (_name, p) => {
    for (const type of ["pen", "touch", "mouse"]) {
      const pos = loupePosition(p, AREA, SIZE, type);
      expect(pos.left).toBeGreaterThanOrEqual(0);
      expect(pos.top).toBeGreaterThanOrEqual(0);
      expect(pos.left + SIZE).toBeLessThanOrEqual(AREA.w);
      expect(pos.top + SIZE).toBeLessThanOrEqual(AREA.h);
      expect(covers(pos, p)).toBe(false);
    }
  });
});

describe("loupeView", () => {
  it("puts the aimed image point in the centre", () => {
    const { zoom, pan } = loupeView({ x: 512, y: 300 }, 180, 2, 4);
    expect(zoom).toBe(8);
    expect(512 * zoom + pan.x).toBe(90);
    expect(300 * zoom + pan.y).toBe(90);
  });

  it("magnifies the source even when the view is zoomed far out", () => {
    expect(loupeView({ x: 0, y: 0 }, 180, 0.05, 2).zoom).toBeGreaterThanOrEqual(1);
  });

  it("caps the scale when the view is zoomed far in", () => {
    expect(loupeView({ x: 0, y: 0 }, 180, 15, 8).zoom).toBe(LOUPE_MAX_SCALE);
  });
});

describe("stepLoupeZoom", () => {
  it("moves through the steps and stops at the ends", () => {
    expect(stepLoupeZoom(4, 1)).toBe(6);
    expect(stepLoupeZoom(4, -1)).toBe(3);
    expect(stepLoupeZoom(LOUPE_ZOOMS[0], -1)).toBe(LOUPE_ZOOMS[0]);
    expect(stepLoupeZoom(LOUPE_ZOOMS.at(-1), 1)).toBe(LOUPE_ZOOMS.at(-1));
  });

  it("recovers from a saved value that is not a step", () => {
    expect(LOUPE_ZOOMS).toContain(stepLoupeZoom(5, 1));
  });

  it("is remembered between visits", () => {
    expect(PREF_KEYS).toContain("loupeZoom");
  });
});

describe("nudgeDelta", () => {
  it("moves one image pixel in the arrow's direction", () => {
    expect(nudgeDelta("ArrowUp")).toEqual({ dx: 0, dy: -1 });
    expect(nudgeDelta("ArrowDown")).toEqual({ dx: 0, dy: 1 });
    expect(nudgeDelta("ArrowLeft")).toEqual({ dx: -1, dy: 0 });
    expect(nudgeDelta("ArrowRight")).toEqual({ dx: 1, dy: 0 });
  });

  it("uses Alt for a quarter pixel and Shift for five", () => {
    expect(nudgeDelta("ArrowRight", { alt: true })).toEqual({ dx: 0.25, dy: 0 });
    expect(nudgeDelta("ArrowLeft", { shift: true })).toEqual({ dx: -5, dy: 0 });
  });

  it("ignores other keys", () => {
    expect(nudgeDelta("a")).toBeNull();
  });
});

describe("canNudge", () => {
  const point = { id: "p", type: "point", points: [{ x: 1, y: 1 }] };

  it("accepts one unlocked point", () => {
    expect(canNudge(point)).toBe(true);
  });

  it.each([
    ["nothing", null],
    ["a line", { ...point, type: "line" }],
    ["a locked point", { ...point, locked: true }],
    ["a hidden point", { ...point, visible: false }],
    ["an unplaced template point", { ...point, placed: false }],
  ])("refuses %s", (_name, m) => {
    expect(canNudge(m)).toBe(false);
  });
});

describe("NudgePad", () => {
  it("sends one step per arrow, a pixel by default", () => {
    const onNudge = vi.fn();
    render(<NudgePad t={t} label="Or" onNudge={onNudge} />);
    fireEvent.click(screen.getByRole("button", { name: "Nudge up" }));
    expect(onNudge).toHaveBeenLastCalledWith(0, -1);
    fireEvent.click(screen.getByRole("button", { name: "Nudge right" }));
    expect(onNudge).toHaveBeenLastCalledWith(1, 0);
  });

  it("can switch to quarter-pixel steps", () => {
    const onNudge = vi.fn();
    render(<NudgePad t={t} label="Or" onNudge={onNudge} />);
    fireEvent.click(screen.getByRole("button", { name: "Fine steps" }));
    fireEvent.click(screen.getByRole("button", { name: "Nudge left" }));
    expect(onNudge).toHaveBeenLastCalledWith(-0.25, 0);
  });

  it("names the point it moves", () => {
    render(<NudgePad t={t} label="Or" onNudge={() => {}} />);
    expect(screen.getByRole("group", { name: "Nudge Or" })).toBeTruthy();
  });
});

describe("PlacingGuide loupe controls", () => {
  const markup = { id: "p", label: "N", definition: "Nasion", type: "point" };
  const props = { t, markup, idx: 0, total: 3, onToggleUnsure() {}, onSkip() {}, onBack() {}, onToggleMagnifier() {} };

  it("changes the loupe zoom", () => {
    render(<PlacingGuide {...props} magnifier />);
    fireEvent.click(screen.getByRole("button", { name: "More loupe zoom" }));
    expect(useUIStore.getState().loupeZoom).toBe(6);
  });

  it("hides the zoom when the loupe is off", () => {
    render(<PlacingGuide {...props} magnifier={false} />);
    expect(screen.queryByRole("button", { name: "More loupe zoom" })).toBeNull();
  });

  it("explains press, adjust and lift", () => {
    render(<PlacingGuide {...props} magnifier />);
    expect(screen.getByText(/lift to place/i)).toBeTruthy();
  });
});
