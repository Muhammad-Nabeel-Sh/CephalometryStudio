// ═══════════════════════════════════════════════════════════════════════════════
// CASE MANAGER — every case of the active profile in one place: search, filter
// and sort; a list of cases or patients with their session timelines; open,
// rename, duplicate, export and delete (also for several cases at once); and
// the data actions (import, backups, Google Drive, clear local data).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import { Btn, Tag, Chip } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { SMALL_BTN } from "../ui/tokens.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { groupByPatient, searchPatients, patientOfCase } from "../model/patients.js";
import { SessionThumb } from "./SessionFilmstrip.jsx";

const PROJ_LABEL = { lateral: "Lateral", ap: "AP", other: "Other" };
const MAX_CHIPS = 8;
const clean = (s) => String(s ?? "").trim();
const day = (t) => (t ? new Date(t).toLocaleDateString() : "");
const traced = (p) => (p.sessions || []).some((s) => (s.markups || []).some((m) => m.type === "point" && m.placed !== false));
const firstImage = (p) => {
  const s = (p.sessions || []).find((x) => x.id === p.activeSessionId) || p.sessions?.[0];
  return s?.images?.[0] || null;
};

function caseMatches(p, words) {
  if (!words.length) return true;
  const hay = [p.name, p.projection, PROJ_LABEL[p.projection], p.meta?.name, p.meta?.patientId, p.meta?.clinician, p.meta?.facility,
    ...(p.sessions || []).flatMap((s) => [s.label, s.name])].map((x) => clean(x).toLowerCase()).join(" ");
  return words.every((w) => hay.includes(w));
}

const SORTS = {
  recent: (a, b) => (b.modified || 0) - (a.modified || 0),
  name: (a, b) => clean(a.name).localeCompare(clean(b.name)),
  patient: (a, b) => clean(a.meta?.name || a.meta?.patientId).localeCompare(clean(b.meta?.name || b.meta?.patientId)),
  created: (a, b) => (b.created || 0) - (a.created || 0),
};

// ─── Patients view (cases grouped by patient, with session timelines) ─────
function TimelineChip({ t, row, showProjection, onOpen }) {
  const when = row.age != null ? `${row.age} y` : row.date ? new Date(row.date).toLocaleDateString() : "";
  const title = `${row.caseName} · ${row.label || row.name}${row.name && row.label ? ` (${row.name})` : ""}${when ? ` · ${when}` : ""}${row.traced ? "" : " · not traced yet"}`;
  return (
    <button onClick={() => onOpen(row.projectId, row.sessionId)} title={title} aria-label={`Open ${title}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "5px 9px", borderRadius: 8, border: `1px solid ${row.traced ? t.acc + "66" : t.bdr}`, background: row.traced ? t.accMuted : "transparent", color: t.tx, cursor: "pointer", fontFamily: "inherit", minWidth: 64 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{row.label || row.name || "Session"}</span>
      <span style={{ fontSize: 12, color: t.tx2 }}>{[showProjection ? PROJ_LABEL[row.projection] || row.projection : null, when].filter(Boolean).join(" · ") || " "}</span>
    </button>
  );
}

function PatientRow({ t, g, onOpen, onNewCase }) {
  const projections = new Set(g.cases.map((p) => p.projection));
  const chips = g.timeline.slice(0, MAX_CHIPS);
  const title = g.anonymized && g.kind !== "study" ? "Anonymized patient" : g.title;
  return (
    <div style={{ border: `1px solid ${t.bdr}`, borderRadius: 12, padding: "12px 14px", background: t.surf, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: t.tx, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {title}
            {g.kind === "patient" && g.patientId && !g.anonymized && <Tag color={t.acc}>ID {g.patientId}</Tag>}
            {g.kind === "study" && <Tag color={t.warn}>Study</Tag>}
            {g.kind === "case" && <span style={{ fontSize: 12, fontWeight: 500, color: t.tx3 }}>no patient details</span>}
            {g.anonymized && <Tag color={t.ok}><Icon name="lock" size={11} /> anonymized</Tag>}
          </div>
          <div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>
            {g.kind === "study"
              ? `${g.patientCount} patients · ${g.sessionCount} sessions`
              : `${g.cases.length} case${g.cases.length === 1 ? "" : "s"} · ${g.sessionCount} session${g.sessionCount === 1 ? "" : "s"}`}
            {" · updated "}{day(g.modified)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn t={t} small onClick={() => onOpen(g.cases[0].id)} title={`Open ${g.cases[0].name}`}>Open</Btn>
          {g.kind === "patient" && <Btn t={t} small onClick={() => onNewCase(g)} title="Start another case (e.g. another projection) for this patient">+ New case</Btn>}
        </div>
      </div>
      {g.kind !== "study" && chips.length > 0 && (
        <div role="list" aria-label="Sessions, oldest first" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "stretch" }}>
          {chips.map((row, i) => (
            <div role="listitem" key={row.sessionId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span aria-hidden="true" style={{ color: t.tx3, fontSize: 12 }}>→</span>}
              <TimelineChip t={t} row={row} showProjection={projections.size > 1} onOpen={onOpen} />
            </div>
          ))}
          {g.timeline.length > MAX_CHIPS && <span style={{ alignSelf: "center", fontSize: 12, color: t.tx3 }}>+{g.timeline.length - MAX_CHIPS} more</span>}
        </div>
      )}
    </div>
  );
}

// ─── Cases view (one row per case) ────────────────────────────────────────
function IconBtn({ t, icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `1px solid ${t.bdr}`, background: "transparent", color: danger ? t.err : t.tx2, cursor: "pointer", padding: 0, flexShrink: 0 }}>
      <Icon name={icon} size={15} />
    </button>
  );
}

function CaseRow({ t, p, selected, onSelect, actions, compact }) {
  const who = patientOfCase(p);
  const img = firstImage(p);
  const n = p.sessions?.length || 0;
  return (
    <div role="row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: `1px solid ${t.bdr}`, background: selected ? t.accMuted : "transparent" }}>
      <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${p.name}`} style={{ flexShrink: 0 }} />
      <button onClick={() => actions.open(p)} title={`Open ${p.name}`} aria-label={`Open ${p.name}`}
        style={{ width: 56, height: 44, borderRadius: 6, overflow: "hidden", border: `1px solid ${t.bdr}`, background: t.surf3, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {img ? <SessionThumb id={img.id} dataUrl={img.dataUrl} /> : <Icon name="image" size={18} color={t.tx3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={() => actions.open(p)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: t.tx, fontSize: 14, fontWeight: 600, fontFamily: "inherit", textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {p.name || "Untitled case"}
        </button>
        <div style={{ fontSize: 12, color: t.tx2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span>{p.meta?.anonymized ? "Anonymized" : who.name || (who.patientId ? `ID ${who.patientId}` : "No patient details")}</span>
          {compact && <span style={{ color: t.tx3, width: "100%" }}>{PROJ_LABEL[p.projection] || p.projection} · {day(p.modified)}</span>}
        </div>
      </div>
      {!compact && (
        <>
          <span style={{ width: 70, fontSize: 13, color: t.tx2 }}>{PROJ_LABEL[p.projection] || p.projection || "—"}</span>
          <span style={{ width: 80, fontSize: 13, color: t.tx2 }}>{n} session{n === 1 ? "" : "s"}</span>
          <span style={{ width: 90, fontSize: 12, color: traced(p) ? t.ok : t.tx3 }}>{traced(p) ? "Traced" : "Not traced"}</span>
          <span style={{ width: 90, fontSize: 13, color: t.tx2 }}>{day(p.modified)}</span>
        </>
      )}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {!compact && <IconBtn t={t} icon="pencil" label={`Rename ${p.name}`} onClick={() => actions.rename(p)} />}
        {!compact && <IconBtn t={t} icon="copy" label={`Duplicate ${p.name}`} onClick={() => actions.duplicate(p)} />}
        <IconBtn t={t} icon="download" label={`Export ${p.name} (.cephx)`} onClick={() => actions.exportCases([p])} />
        <IconBtn t={t} icon="trash" label={`Delete ${p.name}`} onClick={() => actions.remove([p])} danger />
      </div>
    </div>
  );
}

// ─── Manager ──────────────────────────────────────────────────────────────
export default function CaseManager({ t, projects, profileName, storageEncrypted, onClose, onOpen, onNewCase, onImport, onBackup, onDrive, onClearLocalData, actions }) {
  const compact = useMediaQuery("(max-width: 760px)");
  const [view, setView] = useState("cases");
  const [q, setQ] = useState("");
  const [proj, setProj] = useState("all");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState(() => new Set());
  const fileRef = useRef(null);

  const cases = useMemo(() => {
    const words = clean(q).toLowerCase().split(/\s+/).filter(Boolean);
    return projects.filter((p) => (proj === "all" || p.projection === proj) && caseMatches(p, words)).sort(SORTS[sort]);
  }, [projects, proj, sort, q]);
  const groups = useMemo(() => searchPatients(groupByPatient(projects.filter((p) => proj === "all" || p.projection === proj)), q), [projects, proj, q]);
  const chosen = projects.filter((p) => selected.has(p.id));
  const allShown = cases.length > 0 && cases.every((p) => selected.has(p.id));
  const select = (id, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const clearSel = () => setSelected(new Set());
  const rowActions = {
    open: (p) => onOpen(p.id),
    rename: actions.rename,
    duplicate: actions.duplicate,
    exportCases: actions.exportCases,
    remove: async (list) => { if (await actions.remove(list)) setSelected((s) => { const n = new Set(s); list.forEach((p) => n.delete(p.id)); return n; }); },
  };
  const counts = { all: projects.length, lateral: 0, ap: 0, other: 0 };
  for (const p of projects) if (counts[p.projection] != null) counts[p.projection]++;
  const select$ = { padding: "6px 8px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 13, fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.tx, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: t.bg, borderBottom: `1px solid ${t.bdr}`, padding: compact ? "12px 16px" : "14px 28px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Btn t={t} small onClick={onClose} style={SMALL_BTN}>← Home</Btn>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Cases</h1>
          <div style={{ fontSize: 12, color: t.tx3 }}>{profileName} · {projects.length} case{projects.length === 1 ? "" : "s"}</div>
        </div>
        <input ref={fileRef} type="file" accept=".cephx,.json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ""; }} />
        <Btn t={t} small onClick={() => fileRef.current?.click()} title="Open a case file (.cephx) or restore a backup" style={SMALL_BTN}><Icon name="upload" size={14} /> Import</Btn>
        {onBackup && projects.length > 0 && <Btn t={t} small onClick={onBackup} title="Download one file with every case and its images" style={SMALL_BTN}><Icon name="download" size={14} /> Back up all</Btn>}
        {onDrive && <Btn t={t} small onClick={onDrive} title="Back up to or restore from Google Drive" style={SMALL_BTN}><Icon name="cloud" size={14} /> Google Drive</Btn>}
        <Btn t={t} small active onClick={() => onNewCase()} style={SMALL_BTN}>+ New case</Btn>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: compact ? "12px 12px 40px" : "18px 28px 48px" }}>
        {/* Search, filters, view */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.tx3, display: "flex" }}><Icon name="search" size={15} /></span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, ID, case, clinician, session…" aria-label="Search cases"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${t.bdr}`, background: t.surf, color: t.tx, fontSize: 14, fontFamily: "inherit" }} />
          </div>
          <div role="group" aria-label="Projection" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[["all", "All"], ["lateral", "Lateral"], ["ap", "AP"], ["other", "Other"]].map(([k, l]) => (
              <Chip key={k} t={t} on={proj === k} onClick={() => setProj(k)}>{l} <span style={{ opacity: 0.6 }}>{counts[k]}</span></Chip>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {view === "cases" && (
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={select$}>
                <option value="recent">Recently updated</option>
                <option value="created">Recently created</option>
                <option value="name">Case name</option>
                <option value="patient">Patient</option>
              </select>
            )}
            <div role="group" aria-label="View" style={{ display: "flex", gap: 4 }}>
              <Chip t={t} on={view === "cases"} onClick={() => setView("cases")}><Icon name="list" size={13} /> Cases</Chip>
              <Chip t={t} on={view === "patients"} onClick={() => setView("patients")}><Icon name="users" size={13} /> Patients</Chip>
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 16px", color: t.tx2, border: `1px dashed ${t.bdr}`, borderRadius: 12 }}>
            <div style={{ fontSize: 16, color: t.tx, fontWeight: 600, marginBottom: 6 }}>No cases yet</div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>Start a new case, or import a .cephx file or a backup.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn t={t} active onClick={() => onNewCase()}>+ New case</Btn>
              <Btn t={t} onClick={() => fileRef.current?.click()}>Import</Btn>
            </div>
          </div>
        ) : view === "cases" ? (
          <div role="table" aria-label="Cases" style={{ border: `1px solid ${t.bdr}`, borderRadius: 12, overflow: "hidden", background: t.surf }}>
            {/* column header / selection bar */}
            <div role="row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: `1px solid ${t.bdr}`, background: t.surf2, fontSize: 12, color: t.tx3, fontWeight: 600, minHeight: 34 }}>
              <input type="checkbox" checked={allShown} onChange={(e) => setSelected(e.target.checked ? new Set(cases.map((p) => p.id)) : new Set())} aria-label="Select all shown cases" />
              {selected.size > 0 ? (
                <>
                  <span style={{ color: t.tx }}>{selected.size} selected</span>
                  <Btn t={t} small onClick={() => actions.exportCases(chosen)} style={SMALL_BTN}><Icon name="download" size={13} /> Export</Btn>
                  <Btn t={t} small danger onClick={() => rowActions.remove(chosen)} style={SMALL_BTN}><Icon name="trash" size={13} /> Delete</Btn>
                  <button onClick={clearSel} style={{ background: "none", border: "none", color: t.tx3, cursor: "pointer", fontSize: 12 }}>Clear selection</button>
                </>
              ) : (
                <>
                  <span style={{ width: 56 }} />
                  <span style={{ flex: 1 }}>Case · patient</span>
                  {!compact && <><span style={{ width: 70 }}>View</span><span style={{ width: 80 }}>Sessions</span><span style={{ width: 90 }}>Tracing</span><span style={{ width: 90 }}>Updated</span><span style={{ width: 4 * 34 }} /></>}
                </>
              )}
            </div>
            {cases.length === 0
              ? <div style={{ padding: 16, fontSize: 14, color: t.tx2 }}>No case matches “{q}”.</div>
              : cases.map((p) => <CaseRow key={p.id} t={t} p={p} compact={compact} selected={selected.has(p.id)} onSelect={(on) => select(p.id, on)} actions={rowActions} />)}
          </div>
        ) : (
          groups.length === 0
            ? <div style={{ fontSize: 14, color: t.tx2, padding: "16px 0" }}>No patient or case matches “{q}”.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.map((g) => <PatientRow key={g.key} t={t} g={g} onOpen={onOpen} onNewCase={onNewCase} />)}
            </div>
        )}

        {/* Data on this device */}
        <section aria-label="Data on this device" style={{ marginTop: 28, padding: "14px 16px", border: `1px solid ${t.bdr}`, borderRadius: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: storageEncrypted ? t.tx2 : t.warn }}>
          <Icon name={storageEncrypted ? "lock" : "warning"} size={16} />
          <span style={{ flex: 1, minWidth: 220, lineHeight: 1.5 }}>
            {storageEncrypted
              ? "Cases, images and patient details are stored in this browser, encrypted. They leave this device only through exports, backups or sync you set up."
              : "This browser can't encrypt stored data (it needs HTTPS and a modern browser): patient details are stored unencrypted. Avoid real patient data on shared devices."}
          </span>
          {onClearLocalData && <Btn t={t} small danger onClick={onClearLocalData} style={SMALL_BTN}>Clear all local data…</Btn>}
        </section>
      </main>
    </div>
  );
}
