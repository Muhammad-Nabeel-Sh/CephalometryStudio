import { describe, it, expect } from "vitest";
import {
  ISBI19,
  CEPHA29,
  CEPHA31,
  LANDMARK_SETS,
  DEFAULT_LANDMARK_SET,
  NUM_LANDMARKS,
  CEPHA29_ORDER,
  CEPHA31_ORDER,
  getLandmarkSet,
  symbolAt,
  appLabelForSymbol,
  cepha29SymbolAt,
  mockDetections,
} from "../data/landmarkMap.js";

describe("landmark sets", () => {
  it("defines 19 ISBI and 29 CEPHA29 landmarks", () => {
    expect(ISBI19).toHaveLength(19);
    expect(CEPHA29).toHaveLength(29);
    expect(NUM_LANDMARKS).toBe(29);
    expect(LANDMARK_SETS.isbi19).toBe(ISBI19);
    expect(LANDMARK_SETS.cepha29).toBe(CEPHA29);
    expect(DEFAULT_LANDMARK_SET).toBe("isbi19");
  });

  it("defines CEPHA31 as CEPHA29 plus the two appended occlusal points", () => {
    expect(CEPHA31).toHaveLength(31);
    expect(LANDMARK_SETS.cepha31).toBe(CEPHA31);
    // The first 29 entries must be identical objects so channel indices 0..28
    // keep their meaning; the new points are appended, never inserted.
    for (let i = 0; i < 29; i++) expect(CEPHA31[i]).toBe(CEPHA29[i]);
    expect(CEPHA31_ORDER.slice(0, 29)).toEqual(CEPHA29_ORDER);
    expect(CEPHA31_ORDER.slice(29)).toEqual(["APOcc", "PPOcc"]);
    expect(appLabelForSymbol("APOcc", "cepha31")).toBe("APOcc");
    expect(appLabelForSymbol("PPOcc", "cepha31")).toBe("PPOcc");
  });

  it("keeps the CEPHA29 channel order stable (CephaloHRNet LANDMARK_SYMBOLS)", () => {
    expect(CEPHA29_ORDER).toEqual([
      "A", "ANS", "Ar", "B", "Co", "Gn", "Go", "LIA", "LIT", "LMT", "LPM",
      "Li", "Ls", "Me", "N", "N`", "Or", "PNS", "Pn", "Po", "Pog", "Pog`",
      "R", "S", "Sn", "UIA", "UIT", "UMT", "UPM",
    ]);
    expect(cepha29SymbolAt(10)).toBe("LPM");
    expect(cepha29SymbolAt(999)).toBeNull();
  });

  it("keeps the ISBI-19 channel order (cwlachap/HRNet)", () => {
    const order = getLandmarkSet("isbi19").map(l => l.symbol);
    expect(order).toEqual([
      "S", "N", "Or", "Po", "A", "B", "Pog", "Me", "Gn", "Go",
      "L1", "U1", "UL", "LL", "Sn", "Pog'", "PNS", "ANS", "Ar",
    ]);
    expect(symbolAt("isbi19", 0)).toBe("S");
    expect(symbolAt("isbi19", 18)).toBe("Ar");
  });

  it("falls back to the default set for unknown keys", () => {
    expect(getLandmarkSet("nope")).toBe(ISBI19);
  });
});

describe("symbol → app label mapping", () => {
  it("maps CEPHA29 aliases", () => {
    expect(appLabelForSymbol("Pn", "cepha29")).toBe("Prn");
    expect(appLabelForSymbol("UIT", "cepha29")).toBe("Is");
    expect(appLabelForSymbol("UIA", "cepha29")).toBe("Ia");
    expect(appLabelForSymbol("LIT", "cepha29")).toBe("Ii");
    expect(appLabelForSymbol("LIA", "cepha29")).toBe("Iia");
    expect(appLabelForSymbol("Ls", "cepha29")).toBe("UL");
    expect(appLabelForSymbol("Li", "cepha29")).toBe("LL");
    expect(appLabelForSymbol("Pog`", "cepha29")).toBe("Pog'");
  });

  it("maps the CEPHA29 dental/soft-tissue landmarks", () => {
    expect(appLabelForSymbol("R", "cepha29")).toBe("R");
    expect(appLabelForSymbol("LPM", "cepha29")).toBe("LPM");
    expect(appLabelForSymbol("LMT", "cepha29")).toBe("LMT");
    expect(appLabelForSymbol("UPM", "cepha29")).toBe("UPM");
    expect(appLabelForSymbol("UMT", "cepha29")).toBe("UMT");
    expect(appLabelForSymbol("N`", "cepha29")).toBe("N'");
  });

  it("maps every CEPHA29 landmark to an app label", () => {
    for (const l of CEPHA29) expect(l.app).toBeTruthy();
  });

  it("maps every ISBI-19 landmark to an app label", () => {
    for (const l of ISBI19) expect(l.app).toBeTruthy();
    expect(appLabelForSymbol("L1", "isbi19")).toBe("Ii");
    expect(appLabelForSymbol("U1", "isbi19")).toBe("Is");
    expect(appLabelForSymbol("UL", "isbi19")).toBe("UL");
    expect(appLabelForSymbol("LL", "isbi19")).toBe("LL");
    expect(appLabelForSymbol("Pog'", "isbi19")).toBe("Pog'");
  });

  it("defaults to the ISBI-19 set", () => {
    expect(appLabelForSymbol("S")).toBe("S");
    expect(appLabelForSymbol("Pn")).toBeNull();
  });
});

describe("mockDetections", () => {
  it("returns the set size, in-bounds and deterministic", () => {
    const px = new Uint8ClampedArray(40 * 30 * 4).fill(200);
    const a = mockDetections(px, 40, 30, "isbi19");
    const b = mockDetections(px, 40, 30, "isbi19");
    expect(a).toHaveLength(19);
    expect(a.map(d => d.symbol)).toEqual(b.map(d => d.symbol));
    expect(a.map(d => Math.round(d.x))).toEqual(b.map(d => Math.round(d.x)));
    for (const d of a) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThan(40);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThan(30);
      expect(d.confidence).toBeGreaterThan(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("supports the CEPHA29 set", () => {
    const px = new Uint8ClampedArray(40 * 30 * 4).fill(10);
    expect(mockDetections(px, 40, 30, "cepha29")).toHaveLength(29);
  });
});
