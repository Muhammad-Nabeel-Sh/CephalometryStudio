// The study's export actions, shown in the workspace header's Export menu.
// `say` reports progress and outcomes to the user.

import { exportResultsCSV, buildResultsTables, tablesToTSV } from "./resultsExport.js";
import { exportStudyPDF, exportStudyWord } from "./studyReportExport.js";
import { downloadRScript, rScriptSupported } from "./rScript.js";

export function studyExportItems({ study, status, sessions, calibration, say }) {
  return [
    {
      label: "PDF report",
      onClick: async () => {
        say("Building the PDF…");
        try { await exportStudyPDF(study, status); say("PDF saved."); } catch (e) { say(`The PDF couldn't be built: ${e?.message || e}`); }
      },
    },
    { label: "Word document", onClick: () => { exportStudyWord(study, status); say("Word document saved."); } },
    { label: "CSV", onClick: () => { exportResultsCSV(study); say("CSV saved."); } },
    {
      label: "Copy table",
      onClick: async () => {
        try { await navigator.clipboard.writeText(tablesToTSV(buildResultsTables(study))); say("Table copied. Paste it into Excel or Word."); }
        catch { say("The table couldn't be copied: your browser blocked clipboard access."); }
      },
    },
    {
      label: "R script",
      hidden: !(sessions && rScriptSupported(study.type)),
      onClick: () => { downloadRScript(study, sessions, calibration); say("R script saved. It holds the study's current data."); },
    },
  ];
}
