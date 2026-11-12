// What a study still needs before it can run, for the setup page's readiness
// panel. Each item: { id, level: "ok" | "block" | "warn", text }. Nothing here
// stops a run; it says, up front, what the analysis would otherwise report.

import { assignmentReport } from "./assignment.js";

// Study types whose setup has a measurement picker (config.labelIds).
const PICKS_MEASUREMENTS = new Set(["reliability", "descriptive", "comparative", "longitudinal", "correlation", "superimposition"]);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function setupReadiness(study, sessions) {
  const config = study?.config || {};
  const items = [];
  const add = (id, ok, okText, problem, level = "block") => items.push({ id, level: ok ? "ok" : level, text: ok ? okText : problem });
  const report = assignmentReport(study, sessions);

  if (study.type === "comparative") {
    const groups = config.groups || [];
    const empty = groups.filter(g => !(g.caseIds || []).length);
    const unequal = config.design === "paired" && groups.some(g => (g.caseIds || []).length !== (groups[0]?.caseIds || []).length);
    add("groups", groups.length >= 2 && !empty.length && !unequal,
      `${plural(groups.length, "group")}, each with sessions`,
      groups.length < 2 ? "Add at least two groups" : empty.length ? `Add sessions to ${empty.map(g => g.label || "each group").join(", ")}` : "Paired groups need the same number of sessions");
  } else if (study.type === "reliability") {
    const n = (config.cases || []).length;
    add("cases", n >= 2, `${plural(n, "case")} to measure`, n ? "Add at least two cases" : "Add the cases to measure");
  } else if (study.type === "longitudinal") {
    // A subject counts once it has sessions at two or more timepoints (new studies
    // start with empty placeholder subjects).
    const n = (config.subjects || []).filter(s => Object.values(s.records || {}).filter(Boolean).length >= 2).length;
    add("subjects", n >= 2, `${plural(n, "subject")} followed over time`, n ? "Add sessions for at least two subjects at two or more timepoints" : "Assign each subject's sessions to its timepoints");
  } else {
    add("sessions", report.used > 0, `${plural(report.used, "session")} in the study`, "Add sessions to the study");
  }

  if (PICKS_MEASUREMENTS.has(study.type)) {
    const n = (config.labelIds || []).length;
    add("measurements", n > 0, `${plural(n, "measurement")} chosen`, "Choose at least one measurement");
  }

  const problems = [];
  if (report.duplicates.length) problems.push(`${plural(report.duplicates.length, "session")} used more than once`);
  if (report.missing.length) problems.push(`${plural(report.missing.length, "assigned session")} no longer ${report.missing.length === 1 ? "exists" : "exist"}`);
  if (problems.length) items.push({ id: "assignment", level: "warn", text: `${problems.join("; ")}. Check the assignment.` });
  if (report.unassigned.length && report.used > 0) items.push({ id: "unassigned", level: "warn", text: `${plural(report.unassigned.length, "traced session")} not in the study` });

  return { ready: !items.some(i => i.level === "block"), items };
}
