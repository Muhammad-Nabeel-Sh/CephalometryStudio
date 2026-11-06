import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, cleanup } from "@testing-library/react";
import TopBar from "../panels/TopBar.jsx";
import { THEMES } from "../data/constants.js";

const renderBar = (themeId = "dark") => render(
  <TopBar t={THEMES[themeId]} theme={themeId} project={{ projection: "lateral" }} onHome={() => {}} onSave={() => {}}
    openImgRef={{ current: null }} importRef={{ current: null }} calibration={{ done: false }} setTheme={() => {}} />,
);
const ACTIONS = ["Back to Home", "Snap settings", "Toggle scale bar", "Toggle definition tooltips", "Toggle annotations",
  "Open image", "Import (.cephx)", "Save project", "Export", "Normogram", "Anonymize", "Settings"];

afterEach(cleanup);

describe("TopBar buttons", () => {
  it("uses the same button for every action", () => {
    renderBar();
    for (const name of ACTIONS) {
      expect(screen.getByRole("button", { name }).className, name).toContain("topbar-btn");
    }
  });

  it("gives every icon the same size", () => {
    renderBar();
    const sizes = ACTIONS.map(name => {
      const svg = screen.getByRole("button", { name }).querySelector("svg");
      return `${svg.getAttribute("width")}x${svg.getAttribute("height")}`;
    });
    expect(new Set(sizes)).toEqual(new Set(["20x20"]));
  });

  it("lets icons take the button's colour, so active states stay readable", () => {
    renderBar();
    for (const name of ACTIONS) {
      const svg = screen.getByRole("button", { name }).querySelector("svg");
      for (const attr of ["fill", "stroke"]) {
        const value = svg.getAttribute(attr);
        if (value !== null) expect(["currentColor", "none"], `${name} ${attr}`).toContain(value);
      }
    }
  });

  it("marks toggles as pressed and leaves plain actions unmarked", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Toggle annotations" }).hasAttribute("aria-pressed")).toBe(true);
    expect(screen.getByRole("button", { name: "Save project" }).hasAttribute("aria-pressed")).toBe(false);
  });

  it("has fixed desktop sizes and larger touch sizes in the stylesheet", () => {
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.css"), "utf8");
    expect(css).toMatch(/\.topbar-btn\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/);
    expect(css).toMatch(/@media \(max-width: 1024px\), \(pointer: coarse\)\s*\{[^@]*\.topbar-btn\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/);
  });
});
