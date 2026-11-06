import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PenOnlyBtn } from "../panels/Toolbar.jsx";
import { useUIStore, PREF_KEYS } from "../state/uiStore.js";
import { THEMES } from "../data/constants.js";

const t = THEMES.dark;
const setTouchPoints = n => Object.defineProperty(navigator, "maxTouchPoints", { value: n, configurable: true });

afterEach(() => {
  cleanup();
  setTouchPoints(0);
  useUIStore.setState({ penOnly: false });
});

describe("PenOnlyBtn", () => {
  it("is hidden on a device without touch", () => {
    setTouchPoints(0);
    render(<PenOnlyBtn t={t} theme="dark" />);
    expect(screen.queryByRole("button", { name: "Pen-only drawing" })).toBeNull();
  });

  it("toggles pen-only mode on a touch device", () => {
    setTouchPoints(5);
    render(<PenOnlyBtn t={t} theme="dark" />);
    const btn = screen.getByRole("button", { name: "Pen-only drawing" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(useUIStore.getState().penOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Pen-only drawing" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("stays available to turn off when it was left on", () => {
    setTouchPoints(0);
    useUIStore.setState({ penOnly: true });
    render(<PenOnlyBtn t={t} theme="dark" />);
    expect(screen.getByRole("button", { name: "Pen-only drawing" })).toBeTruthy();
  });

  it("is remembered between visits", () => {
    expect(PREF_KEYS).toContain("penOnly");
  });
});
