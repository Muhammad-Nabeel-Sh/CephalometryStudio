// ═══════════════════════════════════════════════════════════════════════════════
// In-app history entries: the workspace ({ cephView: "workspace" }) and, on top of
// it on phones and tablets, an open panel sheet ({ cephxSheet: true }). Several
// popstate listeners share one Back, so each decides from where history landed.
// ═══════════════════════════════════════════════════════════════════════════════

const inWorkspace = state => state?.cephView === "workspace" || state?.cephxSheet === true;

// The workspace closes only when Back goes past its own entry.
export const leavesWorkspace = state => !inWorkspace(state);

// The sheet closes once Back has left the sheet's entry.
export const closesSheet = state => state?.cephxSheet !== true;
