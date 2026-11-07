import { describe, it, expect } from "vitest";
import { leavesWorkspace, closesSheet } from "../lib/viewHistory.js";

// Back (or a sheet closing itself) moves through history entries. Each listener
// must look at where history landed, not just react to any Back.
describe("leavesWorkspace", () => {
  it("stays in the workspace when a closed sheet lands on the workspace entry", () => {
    expect(leavesWorkspace({ cephView: "workspace" })).toBe(false);
  });

  it("stays in the workspace on a sheet entry", () => {
    expect(leavesWorkspace({ cephxSheet: true })).toBe(false);
  });

  it("leaves when Back reaches the page before the workspace", () => {
    expect(leavesWorkspace(null)).toBe(true);
    expect(leavesWorkspace({ cephView: "cases" })).toBe(true);
  });
});

describe("closesSheet", () => {
  it("closes the sheet once Back has left its entry", () => {
    expect(closesSheet({ cephView: "workspace" })).toBe(true);
    expect(closesSheet(null)).toBe(true);
  });

  it("keeps the sheet while its entry is current", () => {
    expect(closesSheet({ cephxSheet: true })).toBe(false);
  });
});
