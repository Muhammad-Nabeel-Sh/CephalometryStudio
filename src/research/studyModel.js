export const STUDY_TYPES = [
  { id: "reliability",  name: "Reliability",                        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check-icon lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',  desc: "Intra/Inter-observer ICC, Bland-Altman, SEM", color: "#60a5fa", needsGroups: true  },
  { id: "descriptive",  name: "Descriptive and Normative Studies",  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-column-increasing-icon lucide-chart-column-increasing"><path d="M13 17V9"/><path d="M18 17V5"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-3"/></svg>',  desc: "Means, SDs, percentiles, normative ranges",      color: "#34d399", needsGroups: false },
  { id: "comparative",  name: "Comparative",                        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scale-icon lucide-scale"><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></svg>',  desc: "t-tests, ANOVA, effect sizes",                   color: "#f472b6", needsGroups: true  },
  { id: "longitudinal", name: "Longitudinal",                       icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-timeline-icon lucide-timeline"><path d="M4 12h.01"/><path d="M4 16h.01"/><path d="M4 20h.01"/><path d="M4 4h.01"/><path d="M4 8h.01"/><path d="M9.414 13.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 12z"/><path d="M9.414 21.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 20z"/><path d="M9.414 5.414A2 2 0 0 0 10.828 6H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 4z"/></svg>',  desc: "Growth tracking, change scores",                 color: "#fb923c", needsGroups: false },
  { id: "correlation",  name: "Correlation",                        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-scatter-icon lucide-chart-scatter"><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="18.5" cy="5.5" r=".5" fill="currentColor"/><circle cx="11.5" cy="11.5" r=".5" fill="currentColor"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="14.5" r=".5" fill="currentColor"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/></svg>',  desc: "Pearson/Spearman, regression",                   color: "#a78bfa", needsGroups: false },
  { id: "diagnostic",   name: "Diagnostic",                         icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_1607_9204)"><path d="M1.02893 10H5.31369C5.35432 10 5.39091 9.97542 5.40627 9.93781L6.92189 6.22668C6.95576 6.14376 7.07318 6.14376 7.10705 6.22668L10.1891 13.7733C10.223 13.8562 10.3404 13.8562 10.3743 13.7733L12.6496 8.20193C12.6819 8.12273 12.7923 8.11808 12.8312 8.19427L13.7252 9.94547C13.7423 9.97894 13.7767 10 13.8143 10H19M19 10C19 5.02944 14.9706 1 10 1C5.02944 1 1 5.02944 1 10C1 14.9706 5.02944 19 10 19C12.4853 19 14.7353 17.9926 16.364 16.364M19 10C19 12.4853 17.9926 14.7353 16.364 16.364M23 23.0002L16.364 16.364" stroke="currentcolor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_1607_9204"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>',  desc: "Sensitivity, specificity, ROC",                  color: "#f59e0b", needsGroups: true  },
  { id: "superimposition", name: "Superimposition / Growth",        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sprout-icon lucide-sprout"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/></svg>', desc: "T1-on-T2 Procrustes/structural overlay, displacement", color: "#e879f9", needsGroups: false },
  { id: "airway", name: "Airway Analysis",                          icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.4999 2V8.91693C10.4999 9.57769 10.1218 10.1791 9.52884 10.4663M13.5001 2V8.91693C13.5001 9.57769 13.8782 10.1791 14.4712 10.4663M9.52884 10.4663L9.44504 8.80191C9.40961 8.09813 9.14467 7.36499 8.48047 7.12961C7.3348 6.72361 5.47114 6.99708 3.29204 9.81626C1.26663 12.4366 0.876278 16.5582 1.03002 19.662C1.11847 21.4477 2.92913 22.4379 4.60612 21.818L7.93312 20.5882C9.16298 20.1336 9.95513 18.933 9.88919 17.6235L9.71207 14.1055M9.52884 10.4663L9.71207 14.1055M14.2879 14.1057L12.5164 13.22C12.1911 13.0574 11.8084 13.0574 11.4832 13.22L9.71207 14.1055M14.2879 14.1057L14.1108 17.6235C14.0449 18.933 14.837 20.1336 16.0669 20.5882L19.3939 21.818C21.0709 22.4379 22.8815 21.4477 22.97 19.662C23.1237 16.5582 22.7334 12.4366 20.708 9.81626C18.5289 6.99708 16.6652 6.72361 15.5195 7.12961C14.8553 7.36499 14.5904 8.09813 14.555 8.80191L14.4712 10.4663M14.2879 14.1057L14.4712 10.4663" stroke="currentcolor" stroke-width="1.5" stroke-linecap="round"/></svg>',desc: "Pharyngeal airway measurements, norms, z-scores", color: "#38bdf8", needsGroups: false },];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function mkStudy(type, opts = {}) {
  const meta = STUDY_TYPES.find(s => s.id === type);
  const base = {
    id: opts.id || uid(),
    type,
    name: opts.name || `New ${meta?.name || "Study"}`,
    description: opts.description || "",
    config: {
      sessionIds: opts.sessionIds || [],
      labelIds: opts.labelIds || [],
      groups: opts.groups || [],
      ...(opts.config || {}),
    },
    results: null,
    status: "configured",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (type === "reliability") {
    base.config.design = opts.config?.design || "intra";
    base.config.minTimeSeparation = opts.config?.minTimeSeparation ?? 14;
    base.config.operators = opts.config?.operators || [{ id: uid(), name: "Operator 1", role: "primary" }];
    base.config.cases = opts.config?.cases || [];
    base.config.protocol = {
      occasions: opts.config?.protocol?.occasions ?? 2,
      blindingEnforced: opts.config?.protocol?.blindingEnforced ?? false,
      revealAfter: opts.config?.protocol?.revealAfter || "all_complete",
    };
  }

  if (type === "descriptive") {
    base.config.groupBy = opts.config?.groupBy || "none";
    base.config.referenceNorms = opts.config?.referenceNorms || [];
  }

  if (type === "comparative") {
    base.config.design = opts.config?.design || "independent";
    base.config.alpha = opts.config?.alpha ?? 0.05;
    base.config.mcCorrection = opts.config?.mcCorrection || "bonferroni";
    base.config.groups = opts.config?.groups || [
      { id: uid(), label: "Group 1", caseIds: [] },
      { id: uid(), label: "Group 2", caseIds: [] },
    ];
  }

  if (type === "longitudinal") {
    base.config.timepoints = opts.config?.timepoints || [
      { id: uid(), label: "Pre", targetAge: null, window: 90 },
      { id: uid(), label: "Post", targetAge: null, window: 90 },
    ];
    base.config.subjects = opts.config?.subjects || [
      { id: uid(), label: "Subject 1", records: {} },
      { id: uid(), label: "Subject 2", records: {} },
    ];
    base.config.sphericityCorrection = opts.config?.sphericityCorrection || "greenhouse-geisser";
    base.config.modelType = opts.config?.modelType || "rm_anova";
    base.config.minTimeSeparation = opts.config?.minTimeSeparation ?? 30;
  }

  if (type === "superimposition") {
    base.config.baseSessionId = opts.config?.baseSessionId || "";
    base.config.compareSessionId = opts.config?.compareSessionId || "";
    base.config.method = opts.config?.method || "registration";
    base.config.registration = opts.config?.registration || "SN_S";
    base.config.planePoint1 = opts.config?.planePoint1 || "";
    base.config.planePoint2 = opts.config?.planePoint2 || "";
  }

  if (type === "airway") {
    base.config.sessionId = opts.config?.sessionId || "";
    base.config.showOverlay = opts.config?.showOverlay !== false;
  }

  return base;
}
