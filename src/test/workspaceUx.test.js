import { describe, it, expect, beforeEach } from "vitest";
import { describeChange, historyEntries, isNotableChange } from "../workspace/undoHistory.js";
import { reviewQueue, nextToReview, confirmPoint, provenanceOf } from "../workspace/aiReview.js";
import { layoutLabels } from "../canvas/drawMarkups.js";
import { mapSymbolFor, MEAN_SHAPE } from "../data/landmarkReference.js";
import { TOOL_MODES, NAV_TOOLS, TOOL_INFO, modeOfTool, toolKey, toolTitle } from "../data/toolModes.js";
import { TOOLS } from "../data/constants.js";
import { askConfirm, askText, notify, closeDialog, _dialogState, _resetDialogs } from "../ui/dialogs.js";

const pt = (id, label, x, y, extra = {}) => ({ id, type: "point", label, points: [{ x, y }], ...extra });
const snap = (markups, extra = {}) => JSON.stringify({ markups, norms: [], calibration: { done: false, pxPerMm: 1 }, formulas: [], processing: {}, ...extra });

describe("B6 — undo descriptions", () => {
  const S = pt("s", "S", 10, 10), N = pt("n", "N", 50, 10);

  it("names deletes, moves, renames and adds", () => {
    expect(describeChange(snap([S, N]), snap([S]))).toMatchObject({ kind: "delete", text: "Deleted N" });
    expect(describeChange(snap([S]), snap([{ ...S, points: [{ x: 12, y: 10 }] }]))).toMatchObject({ kind: "move", text: "Moved S" });
    expect(describeChange(snap([S]), snap([{ ...S, label: "Sella" }])).text).toBe("Renamed S → Sella");
    expect(describeChange(snap([S]), snap([S, N]))).toMatchObject({ kind: "add", text: "Added N" });
    expect(describeChange(snap([S, N]), snap([])).text).toBe("Cleared 2 markups");
  });

  it("describes the user's edit, not the measurements that follow it", () => {
    const ang = { id: "a", type: "angle3", label: "SNA", autoCreated: true, points: [{ x: 0, y: 0 }] };
    const moved = describeChange(snap([S, ang]), snap([{ ...S, points: [{ x: 11, y: 10 }] }, { ...ang, points: [{ x: 1, y: 0 }] }]));
    expect(moved.text).toBe("Moved S");
  });

  it("calibration, placement and confirmation", () => {
    expect(describeChange(snap([S]), snap([S], { calibration: { done: true, pxPerMm: 10 } })).text).toBe("Calibrated (10.00 px/mm)");
    const unplaced = { ...S, placed: false, points: [{ x: -99999, y: -99999 }] };
    expect(describeChange(snap([unplaced]), snap([{ ...S, placed: true }])).kind).toBe("place");
    expect(describeChange(snap([{ ...S, aiPlaced: true, aiReviewed: false }]), snap([{ ...S, aiPlaced: true, aiReviewed: true }])).text).toBe("Confirmed S");
  });

  it("only easy-to-miss steps get an undo toast", () => {
    expect(isNotableChange({ kind: "delete", count: 1 })).toBe(true);
    expect(isNotableChange({ kind: "move", count: 1 })).toBe(true);
    expect(isNotableChange({ kind: "add", count: 1 })).toBe(false);
    expect(isNotableChange({ kind: "place", count: 1 })).toBe(false);
    expect(isNotableChange({ kind: "edit", count: 1 })).toBe(false);
    expect(isNotableChange({ kind: "edit", count: 3 })).toBe(true);
  });

  it("history lists newest first with the number of undos to reach each step", () => {
    const s0 = snap([]), s1 = snap([S]), s2 = snap([S, N]);
    const h = historyEntries([s0, s1], s2);
    expect(h.map(e => [e.steps, e.text])).toEqual([[1, "Added N"], [2, "Added S"]]);
  });
});

describe("B4 — review queue", () => {
  const ms = [
    pt("a", "A", 0, 0, { aiPlaced: true, aiReviewed: false, aiConfidence: 0.9 }),
    pt("b", "B", 0, 0, { aiPlaced: true, aiReviewed: false, aiConfidence: 0.2 }),
    pt("c", "C", 0, 0, { aiPlaced: true, aiReviewed: true, aiConfidence: 0.1 }),
    pt("d", "D", 0, 0, { unsure: true }),
  ];

  it("lowest confidence first, then unsure points; reviewed ones are skipped", () => {
    expect(reviewQueue(ms)).toEqual(["b", "a", "d"]);
  });

  it("next wraps around and starts at the top when nothing is selected", () => {
    expect(nextToReview(ms, null)).toBe("b");
    expect(nextToReview(ms, "a")).toBe("d");
    expect(nextToReview(ms, "d")).toBe("b");
    expect(nextToReview(ms.map(m => ({ ...m, aiReviewed: true, unsure: false })), null)).toBe(null);
  });

  it("confirming clears the AI and unsure flags; provenance records unsure", () => {
    const after = confirmPoint(confirmPoint(ms, "b"), "d");
    expect(after.find(m => m.id === "b").aiReviewed).toBe(true);
    expect(after.find(m => m.id === "d").unsure).toBeUndefined();
    expect(reviewQueue(after)).toEqual(["a"]);
    expect(provenanceOf(ms[3])).toBe("manual, marked unsure");
  });
});

describe("B3 — label layout", () => {
  const lab = (text, x, y, priority = 1, order = 0) => ({ text, x, y, w: 40, pad: 3, bgH: 14, priority, order });

  it("leaves free labels alone and moves overlapping ones off each other", () => {
    const out = layoutLabels([lab("SNA", 100, 100, 1, 0), lab("SNB", 104, 102, 1, 1), lab("far", 400, 400, 1, 2)]);
    const [a, b, c] = out;
    expect([a.dx, a.dy]).toEqual([0, 0]);
    expect(b.dx !== 0 || b.dy !== 0).toBe(true);
    expect([c.dx, c.dy]).toEqual([0, 0]);
    const box = L => ({ x: L.x + L.dx - L.pad, y: L.y + L.dy - L.bgH + 2, w: L.w + 2 * L.pad, h: L.bgH + 4 });
    const A = box(a), B = box(b);
    const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
    expect(overlap).toBe(false);
  });

  it("the selected markup keeps its place", () => {
    const out = layoutLabels([lab("other", 100, 100, 2, 0), lab("selected", 102, 100, 0, 1)]);
    expect(out.find(l => l.text === "selected")).toMatchObject({ dx: 0, dy: 0 });
  });
});

describe("B2 — reference map lookup", () => {
  it("finds landmarks by app label, symbol or name", () => {
    expect(mapSymbolFor({ label: "S" })).toBe("S");
    expect(mapSymbolFor({ label: "Is" })).toBe("UIT");
    expect(mapSymbolFor({ label: "N'" })).toBe("N`");
    expect(mapSymbolFor({ label: "Prn" })).toBe("Pn");
    expect(mapSymbolFor({ label: "My S", templateLabel: "Go" })).toBe("Go");
    expect(mapSymbolFor({ label: "Basion" })).toBe(null);
  });

  it("the mean shape faces right (nasion anterior to sella)", () => {
    expect(MEAN_SHAPE.N.x).toBeGreaterThan(MEAN_SHAPE.S.x);
  });
});

describe("B1 — tool modes", () => {
  it("every toolbar tool is in exactly one mode or always visible", () => {
    for (const tool of TOOLS.filter(Boolean)) {
      const inModes = TOOL_MODES.filter(m => m.tools?.includes(tool.id)).length;
      expect(NAV_TOOLS.includes(tool.id) ? inModes : inModes - 1, tool.id).toBe(0);
      expect(TOOL_INFO[tool.id], tool.id).toBeTruthy();
    }
  });

  it("tooltips carry the keyboard shortcut", () => {
    expect(toolKey("point")).toBe("P");
    expect(toolTitle("angle3")).toMatch(/^Angle 3-pt \(3\) — /);
    expect(modeOfTool("ruler")).toBe("trace");
    expect(modeOfTool("select")).toBe(null);
  });
});

describe("B5 — dialogs", () => {
  beforeEach(() => _resetDialogs());

  it("confirm and text dialogs resolve with the user's answer", async () => {
    const p = askConfirm({ title: "Delete?" });
    const d = _dialogState().dialogs[0];
    expect(d).toMatchObject({ kind: "confirm", title: "Delete?" });
    closeDialog(d.id, true);
    await expect(p).resolves.toBe(true);
    const q = askText({ defaultValue: "x" });
    closeDialog(_dialogState().dialogs[0].id, null);
    await expect(q).resolves.toBe(null);
    expect(_dialogState().dialogs).toHaveLength(0);
  });

  it("a keyed toast replaces the previous one", () => {
    notify("Moved S", { key: "undo" });
    notify("Deleted N", { key: "undo" });
    notify("Saved");
    expect(_dialogState().toasts.map(x => x.text)).toEqual(["Deleted N", "Saved"]);
  });
});
