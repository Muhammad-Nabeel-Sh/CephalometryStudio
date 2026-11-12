import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("../research/engineClient.js", () => ({ runStudyAsync: vi.fn(() => new Promise(() => {})) }));

// A desktop-width screen, where the app shows its disclaimer bar.
window.matchMedia = q => ({ matches: q === "(min-width: 1025px)", media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const { setupReadiness } = await import("../research/setupReadiness.js");
const { default: ResearchWorkspace } = await import("../research/ResearchWorkspace.jsx");
const { mkStudy } = await import("../research/studyModel.js");
const { useUIStore, showPanel } = await import("../state/uiStore.js");
const { matchKeybinding } = await import("../data/keybindings.js");
const { default: TopBar } = await import("../panels/TopBar.jsx");
const { THEMES } = await import("../data/constants.js");

const t = THEMES.bluish;
const traced = id => ({ id, name: id, markups: [{ id: id + "m", type: "point", label: "S", points: [{ x: 1, y: 1 }] }] });
const sessions = [traced("s1"), traced("s2"), traced("s3"), traced("s4")];
const blocking = r => r.items.filter(i => i.level === "block").map(i => i.id);

afterEach(() => {
  cleanup();
  useUIStore.setState({ researchOpen: false, rightPanel: "markups" });
});

describe("setupReadiness", () => {
  it("is ready when sessions and measurements are chosen", () => {
    const study = mkStudy("descriptive", { sessionIds: ["s1", "s2"], labelIds: ["SNA"] });
    const r = setupReadiness(study, sessions);
    expect(r.ready).toBe(true);
    expect(blocking(r)).toEqual([]);
  });

  it("asks for at least one measurement", () => {
    const r = setupReadiness(mkStudy("descriptive", { sessionIds: ["s1"] }), sessions);
    expect(r.ready).toBe(false);
    expect(blocking(r)).toContain("measurements");
  });

  it("does not ask for measurements where a study type has none to choose", () => {
    const r = setupReadiness(mkStudy("diagnostic", { sessionIds: ["s1"] }), sessions);
    expect(r.items.map(i => i.id)).not.toContain("measurements");
  });

  it("needs a session in every comparison group", () => {
    const study = mkStudy("comparative", { labelIds: ["SNA"] });
    study.config.groups = [{ id: "g1", label: "Class I", caseIds: ["s1"] }, { id: "g2", label: "Class II", caseIds: [] }];
    expect(blocking(setupReadiness(study, sessions))).toContain("groups");
    study.config.groups[1].caseIds = ["s2"];
    expect(blocking(setupReadiness(study, sessions))).not.toContain("groups");
  });

  it("needs equal group sizes for a paired comparison", () => {
    const study = mkStudy("comparative", { labelIds: ["SNA"] });
    study.config.design = "paired";
    study.config.groups = [{ id: "g1", label: "T1", caseIds: ["s1", "s2"] }, { id: "g2", label: "T2", caseIds: ["s3"] }];
    expect(blocking(setupReadiness(study, sessions))).toContain("groups");
  });

  it("needs cases for a reliability study and subjects for a longitudinal one", () => {
    expect(blocking(setupReadiness(mkStudy("reliability", { labelIds: ["SNA"] }), sessions))).toContain("cases");
    expect(blocking(setupReadiness(mkStudy("longitudinal", { labelIds: ["SNA"] }), sessions))).toContain("subjects");
  });

  it("warns about a session used twice without blocking", () => {
    const study = mkStudy("comparative", { labelIds: ["SNA"] });
    study.config.groups = [{ id: "g1", label: "A", caseIds: ["s1"] }, { id: "g2", label: "B", caseIds: ["s1"] }];
    const r = setupReadiness(study, sessions);
    expect(r.items.find(i => i.id === "assignment")?.level).toBe("warn");
  });
});

describe("opening the workspace", () => {
  it("the Research tab opens the workspace and leaves the side panel as it was", () => {
    useUIStore.setState({ rightPanel: "measurements" });
    showPanel("research");
    expect(useUIStore.getState().researchOpen).toBe(true);
    expect(useUIStore.getState().rightPanel).toBe("measurements");
  });

  it("other tabs still switch the side panel", () => {
    showPanel("airway");
    expect(useUIStore.getState().rightPanel).toBe("airway");
    expect(useUIStore.getState().researchOpen).toBe(false);
  });

  it("Shift+R opens it, and plain R is still the ruler", () => {
    expect(matchKeybinding({ key: "R", shiftKey: true })?.id).toBe("research");
    expect(matchKeybinding({ key: "r" })).toMatchObject({ id: "tool", toolId: "ruler" });
  });

  it("the top bar has a Research button", () => {
    render(<TopBar t={t} theme="bluish" project={{ projection: "lateral" }} onHome={() => {}} onSave={() => {}}
      openImgRef={{ current: null }} importRef={{ current: null }} calibration={{ done: false }} setTheme={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Research (Shift+R)" }));
    expect(useUIStore.getState().researchOpen).toBe(true);
  });
});

describe("workspace layout", () => {
  const open = studies => render(<ResearchWorkspace t={t} project={{ sessions, researchStudies: studies, activeSessionId: "s1" }} onUpdateProject={vi.fn()} calibration={{ done: false }} onClose={() => {}} />);

  it("puts the sample size calculator in the header", () => {
    open([]);
    const header = screen.getByRole("banner");
    const btn = within(header).getByRole("button", { name: "Sample size calculator" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("complementary", { name: "Studies" })).queryByText(/Sample size/)).toBeNull();
  });

  it("stops above the disclaimer bar", () => {
    open([]);
    expect(screen.getByRole("dialog", { name: "Research workspace" }).style.bottom).not.toBe("0px");
  });

  it("lays setup out as sections with a readiness check beside them", () => {
    open([mkStudy("descriptive", { name: "Norms", sessionIds: ["s1"] })]);
    fireEvent.click(screen.getByRole("tab", { name: "Setup" }));
    const ready = screen.getByRole("region", { name: "Before you run" });
    expect(within(ready).getByText(/Choose at least one measurement/)).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(["Sessions", "Analysis"]));
  });
});
