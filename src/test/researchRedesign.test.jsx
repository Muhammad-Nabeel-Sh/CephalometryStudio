import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

// Layout tests: the statistics and their tables are covered elsewhere, so the
// per-type result views, charts and report text are stubbed here.
vi.mock("../research/engineClient.js", () => ({ runStudyAsync: vi.fn(() => new Promise(() => {})) }));
vi.mock("../research/moduleCharts.jsx", () => {
  const C = () => <figure data-testid="charts" />;
  return { ReliabilityCharts: C, DescriptiveCharts: C, ComparativeCharts: C, LongitudinalCharts: C, CorrelationCharts: C, DiagnosticCharts: C, SuperimpositionCharts: C, AirwayCharts: C };
});
vi.mock("../research/DescriptivePanel.jsx", () => ({ DescriptiveResults: () => <table data-testid="tables"><tbody><tr><td>SNA</td></tr></tbody></table>, DescriptiveConfig: () => <div>descriptive setup</div> }));
vi.mock("../research/studyReport.js", () => ({
  summarizeStudy: () => ({ headline: "SNA averaged 82 degrees.", findings: [{ label: "SNA", text: "82 ± 3°", flag: "ok" }], skipped: [] }),
  methodsText: () => ({ html: "Twenty cephalograms were traced." }),
  resultsText: () => "SNA was 82°.",
  referencesFor: () => ["Shrout PE, Fleiss JL. 1979."],
  stripTags: s => s,
}));
vi.mock("../research/studyWarnings.js", () => ({ collectStudyWarnings: () => [{ level: "warn", text: "Only 8 sessions; intervals are wide.", fix: "setup" }] }));

window.matchMedia ??= q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const { default: ResearchWorkspace } = await import("../research/ResearchWorkspace.jsx");
const { default: StudyResultsView } = await import("../research/StudyResultsView.jsx");
const { useUIStore, PREF_KEYS } = await import("../state/uiStore.js");
const { THEMES } = await import("../data/constants.js");

const t = THEMES.bluish;
const sessions = [{ id: "s1", name: "T0", markups: [] }, { id: "s2", name: "T1", markups: [] }];
const study = (extra = {}) => ({ id: "st1", type: "descriptive", name: "SNA norms", config: { measurements: ["SNA"] }, results: null, status: "configured", createdAt: 1, updatedAt: 1, ...extra });
const withResults = () => study({ results: { measurements: [], timestamp: 2 }, status: "completed", lastRun: { at: 2, ms: 100 } });

function workspace(studies = [study()]) {
  const onUpdateProject = vi.fn();
  render(<ResearchWorkspace t={t} project={{ sessions, researchStudies: studies, activeSessionId: "s1" }} onUpdateProject={onUpdateProject} calibration={{ done: false }} onClose={() => {}} />);
  return { onUpdateProject };
}

afterEach(() => {
  cleanup();
  useUIStore.setState({ researchPaper: "white" });
});

describe("study header", () => {
  it("has three tabs and protocol notes, with no separate run step", () => {
    workspace();
    const names = screen.getAllByRole("tab").map(el => el.textContent);
    expect(names).toEqual(["Setup", "Data", "Results", "Protocol notes"]);
  });

  it("runs from the header", () => {
    workspace();
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeTruthy();
  });

  it("offers a re-run once there are results", () => {
    workspace([withResults()]);
    expect(screen.getByRole("button", { name: /^Re-run/ })).toBeTruthy();
  });

  it("keeps rename, duplicate, archive, delete and the guide in one menu", () => {
    workspace();
    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const items = screen.getAllByRole("menuitem").map(el => el.textContent);
    expect(items).toEqual(["Rename", "Duplicate", "Archive", "Delete", "Guide"]);
  });

  it("shows every export in one menu", () => {
    workspace([withResults()]);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const items = screen.getAllByRole("menuitem").map(el => el.textContent);
    expect(items).toEqual(["PDF report", "Word document", "CSV", "Copy table", "R script"]);
  });
});

describe("study list", () => {
  it("shows each study's progress with its status in words", () => {
    workspace();
    const row = screen.getByRole("button", { name: /SNA norms/ });
    expect(row.getAttribute("aria-label")).toMatch(/Not run/);
    expect(within(row).getAllByTestId("pipeline-step")).toHaveLength(3);
  });
});

describe("new study", () => {
  it("is chosen by the question being asked", () => {
    const { onUpdateProject } = workspace([]);
    fireEvent.click(screen.getByRole("radio", { name: /How do groups differ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create study" }));
    const next = onUpdateProject.mock.calls.at(-1)[0]({ researchStudies: [] });
    expect(next.researchStudies[0].type).toBe("comparative");
  });

  it("lists every study type under some question", () => {
    workspace([]);
    const text = screen.getAllByRole("radio").map(r => r.textContent).join(" ");
    for (const name of ["Reliability", "Comparative", "Longitudinal", "Superimposition", "Descriptive", "Correlation", "Diagnostic"]) {
      expect(text).toMatch(new RegExp(name, "i"));
    }
  });

  it("leaves out legacy study types, as before", () => {
    workspace([]);
    const text = screen.getAllByRole("radio").map(r => r.textContent).join(" ");
    expect(text).not.toMatch(/Airway/);
  });
});

describe("results page", () => {
  const results = () => render(<StudyResultsView t={t} study={withResults()} status="current" onFix={() => {}} wide sessions={sessions} calibration={{ done: false }} />);
  const sheet = () => document.querySelector("[data-paper]");

  it("is a white page by default", () => {
    results();
    expect(sheet().getAttribute("data-paper")).toBe("white");
    expect(sheet().style.background).toBe("rgb(255, 255, 255)");
  });

  it("switches to dark paper and remembers it", () => {
    results();
    fireEvent.click(screen.getByRole("radio", { name: "Dark paper" }));
    expect(useUIStore.getState().researchPaper).toBe("dark");
    expect(sheet().getAttribute("data-paper")).toBe("dark");
    expect(PREF_KEYS).toContain("researchPaper");
  });

  it("puts the summary, tables, figures and methods on the page", () => {
    results();
    const page = within(sheet());
    expect(page.getByText("SNA averaged 82 degrees.")).toBeTruthy();
    expect(page.getByTestId("tables")).toBeTruthy();
    expect(page.getByTestId("charts")).toBeTruthy();
    expect(page.getByText("Twenty cephalograms were traced.")).toBeTruthy();
    expect(page.getAllByRole("button", { name: /^Copy/ }).length).toBeGreaterThan(0);
  });

  it("shows caveats as notes beside the page", () => {
    results();
    const notes = screen.getByRole("complementary", { name: "Notes on these results" });
    expect(within(notes).getByText(/intervals are wide/)).toBeTruthy();
    expect(sheet().contains(notes)).toBe(false);
  });
});
