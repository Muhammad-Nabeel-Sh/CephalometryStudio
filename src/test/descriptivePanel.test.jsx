import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DescriptiveResults } from "../research/DescriptivePanel.jsx";
import { THEMES } from "../data/constants.js";

// ═════════════════════════════════════════════════════════════════
// Saved study results: statistics that can't be computed for a tiny
// group (SD of one value, skewness of two) are NaN, and the autosave's
// JSON turns NaN into null. The table must show "—", not crash.
// ═════════════════════════════════════════════════════════════════

describe("Descriptive results table", () => {
  it("shows a dash for statistics stored as null instead of crashing", () => {
    const stats = { n: 1, mean: 82, sd: NaN, sem: NaN, median: 82, q1: 82, q3: 82, min: 82, max: 82, skewness: NaN, kurtosis: 0 };
    const saved = JSON.parse(JSON.stringify({ combined: { SNA: { stats, unit: "°" } }, groupOrder: [] }));
    expect(saved.combined.SNA.stats.sd).toBeNull();
    render(<DescriptiveResults results={saved} t={THEMES.dark} />);
    const row = screen.getByText("SNA").closest("tr");
    expect(row.textContent).toContain("82.00");
    expect(row.querySelectorAll("td")[4].textContent).toBe("—"); // SD
  });
});
