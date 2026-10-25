import { runReliabilityAll } from "./reliability.js";
import { runDescriptiveAll } from "./descriptive.js";
import { runComparativeAll } from "./comparative.js";
import { runLongitudinalAll } from "./longitudinal.js";
import { runCorrelationAll, runRegression, runLogisticRegression } from "./correlation.js";
import { runDiagnosticAll } from "./diagnostic.js";
import { runSuperimpositionAll } from "./superimposition.js";
import { computeAirwayMeasurements } from "./airway.js";
import { logError } from "../lib/logger.js";
import { scopedSessions } from "./dataPreview.js";

// `onProgress` is an optional coarse-grained callback (fraction 0..1, label).
// It exists so the Web Worker wrapper (engineClient.js) can stream progress to
// the UI without freezing the main thread. The synchronous call path (used in
// tests and as a Worker fallback) ignores it when not provided.
export function runStudy(study, sessions, calibration, onProgress) {
  if (study.status === "running") return study;
  const config = study.config;
  const prog = typeof onProgress === "function" ? (p, label) => { try { onProgress(p, label); } catch { /* progress callback is best-effort */ } } : () => {};

  let results = {};
  // Descriptive/correlation/diagnostic studies may be limited to selected sessions.
  sessions = scopedSessions(study, sessions);

  try {
    prog(0.05, `starting ${study.type}`);
    switch (study.type) {
      case "reliability":
        prog(0.2, "reliability");
        results = runReliabilityAll(sessions, config, calibration);
        break;
      case "descriptive":
        prog(0.2, "descriptive");
        results = runDescriptiveAll(sessions, config, calibration);
        break;
      case "comparative":
        prog(0.2, "comparative");
        results = runComparativeAll(sessions, config, calibration);
        break;
      case "longitudinal":
        prog(0.2, "longitudinal");
        results = runLongitudinalAll(sessions, config, calibration);
        break;
      case "correlation":
        prog(0.2, "correlation");
        results = runCorrelationAll(sessions, config, calibration);
        if (config.dependentVar && config.predictorVars?.length > 0) {
          prog(0.5, "regression");
          results.regression = runRegression(sessions, config, calibration);
        }
        if (config.dependentVar && config.predictorVars?.length > 0 && config.threshold !== undefined && config.threshold !== "") {
          prog(0.75, "logistic");
          results.logistic = runLogisticRegression(sessions, config, calibration);
        }
        break;
      case "diagnostic":
        prog(0.2, "diagnostic");
        results = runDiagnosticAll(sessions, config, calibration);
        break;
      case "superimposition":
        prog(0.2, "superimposition");
        results = runSuperimpositionAll(sessions, config, calibration);
        break;

      case "airway":
        prog(0.2, "airway");
        {
          const session = sessions.find(s => s.id === config.sessionId);
          const markups = session?.markups || [];
          const cal = session?.calibration?.done ? session.calibration : calibration;
          const sex = config.sex || session?.meta?.gender || "";
          const age = config.age ?? session?.meta?.age ?? null;
          const measurements = computeAirwayMeasurements(markups, cal, sex, age);
          results = {
            measurements,
            sessionName: session?.name || "",
            sessionId: session?.id || "",
            calibrationUsed: cal?.done || false,
            sex,
            age,
          };
        }
        break;

      default:
        results = { note: "Unknown study type" };
    }
    prog(0.95, "finalizing");
  } catch (e) {
    // Always surface errors (was gated on `import.meta.env.DEV`, so production errors
    // were silently swallowed — the user saw a generic "error" status with no message
    // to debug from). Capture the stack for diagnostics; PHI-safe log in prod.
    logError("Study run error:", e);
    return {
      ...study,
      status: "error",
      results: {
        error: e.message,
        stack: e.stack || null,
        studyType: study.type,
        timestamp: Date.now(),
      },
    };
  }

  prog(1, "complete");
  return {
    ...study,
    status: "completed",
    updatedAt: Date.now(),
    results,
  };
}
