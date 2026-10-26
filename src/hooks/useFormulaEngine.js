import { useEffect, useState } from "react";
import { formulaEngineReady, loadFormulaEngine, onFormulaEngineReady } from "../lib/utils.js";

// Loads the formula engine (mathjs) on first use and returns true once it is
// ready, so formula values computed before then are recomputed (C6).
export function useFormulaEngine() {
  const [ready, setReady] = useState(formulaEngineReady);
  useEffect(() => {
    if (ready) return undefined;
    const off = onFormulaEngineReady(() => setReady(true));
    loadFormulaEngine().catch(() => { /* offline: formulas stay empty until a reload */ });
    return off;
  }, [ready]);
  return ready;
}
