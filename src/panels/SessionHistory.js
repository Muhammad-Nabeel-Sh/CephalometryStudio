// A session's audit trail (model/audit.js) in a dialog, newest first.
import { showInfo } from "../ui/dialogs.js";
import { auditLines } from "../model/audit.js";

export function showSessionHistory(session) {
  const lines = auditLines(session?.auditLog || []);
  const lock = session?.lock;
  return showInfo({
    title: `History: ${session?.name || "session"}`,
    message: [
      lock ? `Locked by the study “${lock.studyName}” since ${new Date(lock.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}${lock.by ? ` (${lock.by})` : ""}. Its landmarks, measurements and calibration can't be changed until it's unlocked.` : "",
      lines.length ? "Changes to landmarks, measurements, calibration and the image, newest first. Edits made within a few minutes of each other are grouped." : "No changes recorded yet. Changes made from now on are listed here.",
    ].filter(Boolean).join("\n\n"),
    items: lines.slice(0, 200),
  });
}
