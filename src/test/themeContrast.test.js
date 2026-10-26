import { describe, it, expect } from "vitest";
import { THEMES } from "../data/constants.js";

// C2: WCAG 2.1 AA — normal-size text needs a contrast ratio of at least 4.5:1.
const lum = hex => {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("theme text contrast (WCAG AA)", () => {
  for (const th of Object.values(THEMES)) {
    it(`${th.name}: text colours are readable on panel backgrounds`, () => {
      for (const fg of ["tx", "tx2", "tx3", "acc", "err", "ok", "warn"]) {
        for (const bg of ["bg", "surf", "surf2"]) {
          expect(ratio(th[fg], th[bg]), `${th.id} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(ratio(th.tx2, th.surf3), `${th.id} tx2 on surf3`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
