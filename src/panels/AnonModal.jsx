import { PropRow, Btn, GuideBtn } from "../ui/ui.jsx";
import { anonymizeProject } from "../report/anonymize.js";
import { useState } from "react";
import PanelGuideModal from "./PanelGuideModal.jsx";
import { askConfirm } from "../ui/dialogs.js";
import { Icon } from "../ui/icons.jsx";

// Anonymization is now NON-destructive to the audit trail: it clears patient
// identifiers from project.meta AND every session.meta, pseudonymizes operator
// IDs, and appends a structured {timestamp, operatorId, reason, provenance}
// entry to meta.anonymizationLog so there is a who/when record (was missing).
export default function AnonModal({ t, project, onUpdateProject }) {
  const [guideKey, setGuideKey] = useState(null);
  const anonymize = async () => {
    if (!(await askConfirm({ title: "Remove all patient identifiers?", message: "Patient name, DOB, age, sex, subject ID and per-session patient IDs will be cleared. Operator IDs will be pseudonymized (Rater-1, Rater-2…). Research group/timepoint labels are kept. An audit-log entry (who/when) is recorded.", confirmLabel: "Remove identifiers", danger: true }))) return;
    const anon = await anonymizeProject(project, { reason: "manual" });
    onUpdateProject(anon);
  };

  const log = project.meta?.anonymizationLog || [];

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.tx, flex: 1 }}>Patient Metadata</span>
          <GuideBtn t={t} onClick={() => setGuideKey("anonymization")} />
        </div>
        {[["patientId", "Patient ID"], ["patientName", "Name"], ["dob", "DOB"], ["age", "Age"], ["gender", "Gender"], ["clinician", "Clinician"], ["facility", "Facility"]].map(([k, label]) => (
          <PropRow key={k} label={label} t={t}><input type="text" value={project.meta[k] || ""} onChange={e => onUpdateProject({ ...project, meta: { ...project.meta, [k]: e.target.value } })} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: 240, fontFamily: "inherit" }} /></PropRow>
        ))}
      </div>

      {project.meta.anonymized ? (
        <div style={{ padding: 10, background: t.ok + "11", border: `1px solid ${t.ok}33`, borderRadius: 6, fontSize: 12, color: t.ok, marginBottom: 16 }}>✓ Case is anonymized.</div>
      ) : (
        <Btn t={t} danger onClick={anonymize} style={{ width: "100%" }}><Icon name="shield" size={14} /> Anonymize <br/>(clears patient IDs, keeps research labels)</Btn>
      )}

      {/* Audit trail (P3): who/when/what was cleared, with salted provenance hashes. */}
      {log.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: t.surf3, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 8 }}>Anonymization Audit Log</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {log.map((e, i) => (
              <div key={i} style={{ fontSize: 10, color: t.tx2, fontFamily: "'DM Mono',monospace", lineHeight: 1.5, borderBottom: i < log.length - 1 ? `1px solid ${t.bdr}22` : "none", paddingBottom: 6 }}>
                <div><span style={{ color: t.tx3 }}>when:</span> {e.iso || new Date(e.timestamp).toISOString()}</div>
                <div><span style={{ color: t.tx3 }}>by:</span> {e.operatorId} <span style={{ color: t.tx3 }}>· reason:</span> {e.reason}</div>
                <div><span style={{ color: t.tx3 }}>cleared:</span> {(e.fieldsCleared || []).join(", ")}</div>
                {e.provenance && <div><span style={{ color: t.tx3 }}>provenance:</span> {Object.keys(e.provenance.hashes || {}).length} salted SHA-256 hash(es) retained for verification</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {guideKey && <PanelGuideModal t={t} guideKey={guideKey} onClose={() => setGuideKey(null)} />}
    </div>
  );
}
