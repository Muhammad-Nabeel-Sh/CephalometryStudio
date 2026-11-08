// The "R script" button sits next to the tidy CSV in the study data preview.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DataPreview } from "../research/StudyTools.jsx";
import { mkStudy } from "../research/studyModel.js";
import { THEMES } from "../data/constants.js";
import { makeSession, lineMarkup } from "./helpers/cephFixtures.js";

afterEach(cleanup);
const t = THEMES.dark;
const sessions = [makeSession("a", [lineMarkup("L", 1)]), makeSession("b", [lineMarkup("L", 2)])];

describe("R script button", () => {
  it("is offered for supported study types with data", () => {
    render(<DataPreview t={t} study={mkStudy("descriptive")} sessions={sessions} calibration={{ done: true, pxPerMm: 1 }} />);
    expect(screen.getByRole("button", { name: "R script" }).disabled).toBe(false);
  });

  it("is disabled without data and absent for superimposition", () => {
    render(<DataPreview t={t} study={mkStudy("descriptive")} sessions={[]} calibration={{ done: true, pxPerMm: 1 }} />);
    expect(screen.getByRole("button", { name: "R script" }).disabled).toBe(true);
    cleanup();
    render(<DataPreview t={t} study={mkStudy("superimposition")} sessions={sessions} calibration={{ done: true, pxPerMm: 1 }} />);
    expect(screen.queryByRole("button", { name: "R script" })).toBeNull();
  });
});
