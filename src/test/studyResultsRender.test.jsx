import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { runStudy } from "../research/engine.js";
import { mkStudy, STUDY_TYPES } from "../research/studyModel.js";
import { makeSession, angleMarkup } from "./helpers/cephFixtures.js";
import { THEMES } from "../data/constants.js";
import { ReliabilityResults } from "../research/ReliabilityPanel.jsx";
import { DescriptiveResults } from "../research/DescriptivePanel.jsx";
import { ComparativeResults } from "../research/ComparativePanel.jsx";
import { LongitudinalResults } from "../research/LongitudinalPanel.jsx";
import { CorrelationResults } from "../research/CorrelationPanel.jsx";
import { DiagnosticResults } from "../research/DiagnosticPanel.jsx";
import { SuperimpositionResults } from "../research/SuperimpositionPanel.jsx";
import { AirwayStudyResults } from "../research/AirwayStudyPanel.jsx";

// ═════════════════════════════════════════════════════════════════
// Every study type's results view must survive tiny groups after a
// reload: statistics that can't be computed (SD of one value, …) are
// NaN, and the saved project turns NaN into null. Results are run on
// small realistic data, round-tripped through JSON like the autosave,
// then rendered.
// ═════════════════════════════════════════════════════════════════

const VIEWS = {
  reliability: ReliabilityResults, descriptive: DescriptiveResults, comparative: ComparativeResults,
  longitudinal: LongitudinalResults, correlation: CorrelationResults, diagnostic: DiagnosticResults,
  superimposition: SuperimpositionResults, airway: AirwayStudyResults,
};

function sessions() {
  const s = (id, sna, snb, meta) => makeSession(id, [angleMarkup("SNA", sna), angleMarkup("SNB", snb, { cx: 900 })], { meta: { patientId: meta.subject, operatorId: "op1", trialNumber: meta.trial, ...meta }, subjectId: meta.subject });
  const first = s("s1", 80, 77, { group: "A", timepoint: "T0", subject: "p1", trial: 1 });
  first.markups.push(angleMarkup("ANB", 3, { cx: 1300 })); // only one value: SD, skewness… undefined
  return [
    first,
    s("s2", 82, 78, { group: "A", timepoint: "T1", subject: "p1", trial: 2 }),
    s("s3", 85, 80, { group: "B", timepoint: "T0", subject: "p2", trial: 1 }),
  ];
}

describe("study results views with saved tiny-group results", () => {
  for (const { id } of STUDY_TYPES) {
    it(`${id} renders without crashing`, () => {
      const ss = sessions();
      const study = mkStudy(id, { labelIds: ["SNA", "SNB", "ANB"], sessionIds: ss.map(x => x.id), groups: ["A", "B"] });
      if (id === "airway") study.config.sessionId = "s1";
      if (id === "diagnostic") Object.assign(study.config, { referenceVar: "SNA", threshold: 81, predictorVars: ["SNB"] });
      if (id === "correlation") Object.assign(study.config, { dependentVar: "SNA", predictorVars: ["SNB"] });
      const ran = runStudy(study, ss, { done: true, pxPerMm: 1 });
      const saved = JSON.parse(JSON.stringify(ran.results ?? {}));
      const View = VIEWS[id];
      expect(View).toBeTruthy();
      expect(() => render(<View results={saved} t={THEMES.dark} />)).not.toThrow();
    });
  }
});
