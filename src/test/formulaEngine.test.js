import { describe, it, expect } from "vitest";
import { evalFormula, formulaEngineReady, loadFormulaEngine, onFormulaEngineReady } from "../lib/utils.js";

// C6: mathjs is not part of start-up; it loads on first use.
describe("formula engine loads on demand", () => {
  it("returns null before loading, starts the load, and evaluates afterwards", async () => {
    expect(formulaEngineReady()).toBe(false);
    let notified = false;
    onFormulaEngineReady(() => { notified = true; });
    expect(evalFormula("SNA - SNB", { SNA: 82, SNB: 80 })).toBe(null);
    await loadFormulaEngine();
    expect(formulaEngineReady()).toBe(true);
    expect(notified).toBe(true);
    expect(evalFormula("SNA - SNB", { SNA: 82, SNB: 80 })).toBe(2);
  }, 60000); // first import of mathjs can be slow under a full parallel run
});
