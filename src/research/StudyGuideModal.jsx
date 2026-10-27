// ═══════════════════════════════════════════════════════════════════════════════
// STUDY GUIDE MODAL — Context-sensitive help for each research study type
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Modal } from "../panels/Modal.jsx";
import { Icon } from "../ui/icons.jsx";

const STEP_COLORS = {
  setup: { bg: "#3b82f6", label: "Setup" },
  configure: { bg: "#8b5cf6", label: "Configure" },
  run: { bg: "#10b981", label: "Run" },
  review: { bg: "#f59e0b", label: "Review" },
};

function StepBadge({ type }) {
  const c = STEP_COLORS[type];
  if (!c) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
      background: c.bg + "22", color: c.bg, letterSpacing: 0.3, marginLeft: 8,
    }}>
      {c.label}
    </span>
  );
}

function StepTimeline({ steps, t }) {
  return (
    <div style={{ marginLeft: 26, position: "relative" }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const stepType = step.type || "setup";
        const c = STEP_COLORS[stepType] || STEP_COLORS.setup;
        return (
          <div key={i} style={{ display: "flex", gap: 14, position: "relative", minHeight: isLast ? 0 : 52 }}>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                position: "absolute", left: 12, top: 26, width: 2,
                height: "calc(100% + 8px)", background: t.bdr + "88",
              }} />
            )}
            {/* Step number circle */}
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: c.bg, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2,
              position: "relative", zIndex: 1,
            }}>
              {i + 1}
            </div>
            {/* Step content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.bg }}>{step.label || `Step ${i + 1}`}</span>
                {step.type && <StepBadge type={step.type} />}
              </div>
              <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.6, marginTop: 3 }}>
                {step.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reliability SVG diagrams — three workflow types
// Each diagram shows session→case→rater mapping for a different design

function RelDiagram({ type }) {
  const color = type === "intra" ? "#3b82f6" : type === "inter" ? "#8b5cf6" : "#10b981";
  const light = color + "22";
  const labels = {
    intra: { title: "Intra-Observer", desc: "Same rater, repeat sessions", occ1: "Occasion 1", occ2: "Occasion 2 (2 weeks later)" },
    inter: { title: "Inter-Observer", desc: "Different raters, same session", rater1: "Rater 1 (Dr. Muhammad)", rater2: "Rater 2 (Dr. Abdullah)" },
    method: { title: "Method Comparison", desc: "Same case, two methods", m1: "Digital Tracing", m2: "Manual Tracing" },
  };
  const l = labels[type] || labels.intra;
  return (
    <svg viewBox="0 0 640 260" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">{l.title}</text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">{l.desc}</text>

      {/* Case box */}
      <rect x="260" y="56" width="120" height="48" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="320" y="76" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" fontFamily="sans-serif">Case (Patient 42)</text>
      <text x="320" y="95" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Same radiograph</text>

      {type === "intra" && (
        <>
          <line x1="320" y1="104" x2="185" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="55" y="130" width="180" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="145" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Session A ({l.occ1})</text>
          <text x="145" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Dr. Muhammad places marks</text>
          <line x1="320" y1="104" x2="455" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="385" y="130" width="220" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="495" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Session B ({l.occ2})</text>
          <text x="495" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Dr. Muhammad re-places marks</text>
          <line x1="145" y1="178" x2="145" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="495" y1="178" x2="495" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="145" y1="198" x2="495" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">ICC, Bland-Altman, SEM</text>
        </>
      )}

      {type === "inter" && (
        <>
          <line x1="320" y1="104" x2="185" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="55" y="130" width="180" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="145" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.rater1}</text>
          <text x="145" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Places marks independently</text>
          <line x1="320" y1="104" x2="455" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="405" y="130" width="180" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="495" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.rater2}</text>
          <text x="495" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Places marks independently</text>
          <line x1="145" y1="178" x2="145" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="495" y1="178" x2="495" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="145" y1="198" x2="495" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">ICC, Bland-Altman, SEM</text>
        </>
      )}

      {type === "method" && (
        <>
          <line x1="320" y1="104" x2="185" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="55" y="130" width="180" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="145" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.m1}</text>
          <text x="145" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Measure on digital image</text>
          <line x1="320" y1="104" x2="455" y2="134" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x="405" y="130" width="180" height="48" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="495" y="150" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">{l.m2}</text>
          <text x="495" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Measure on printed film</text>
          <line x1="145" y1="178" x2="145" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="495" y1="178" x2="495" y2="195" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="145" y1="198" x2="495" y2="198" stroke={color + "88"} strokeWidth="1.5" />
          <line x1="320" y1="198" x2="320" y2="215" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arr)" />
          <text x="320" y="237" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">Bland-Altman, Deming regression</text>
        </>
      )}

      <defs>
        <marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} />
        </marker>
      </defs>
    </svg>
  );
}

// Comparative diagrams: independent groups vs paired design
function CompDiagram({ type }) {
  const color = "#f472b6";
  const light = color + "22";
  return (
    <svg viewBox="0 0 640 260" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">
        {type === "independent" ? "Independent Groups Design" : "Paired / Repeated Measures Design"}
      </text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">
        {type === "independent" ? "Different subjects per group" : "Same subjects measured twice"}
      </text>

      {type === "independent" ? (
        <>
          {/* Group 1 */}
          <rect x="60" y="65" width="200" height="130" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="160" y="85" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" fontFamily="sans-serif">Group 1</text>
          <text x="160" y="102" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Untreated / Control</text>
          <circle cx="120" cy="125" r="6" fill={color} />
          <circle cx="160" cy="125" r="6" fill={color} />
          <circle cx="200" cy="125" r="6" fill={color} />
          <text x="160" y="150" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">n subjects, 1 measurement each</text>
          <text x="160" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Mean₁ ± SD₁</text>

          {/* Group 2 */}
          <rect x="380" y="65" width="200" height="130" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="480" y="85" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" fontFamily="sans-serif">Group 2</text>
          <text x="480" y="102" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Treated / Experimental</text>
          <circle cx="440" cy="125" r="6" fill={color} />
          <circle cx="480" cy="125" r="6" fill={color} />
          <circle cx="520" cy="125" r="6" fill={color} />
          <text x="480" y="150" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">n subjects, 1 measurement each</text>
          <text x="480" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Mean₂ ± SD₂</text>

          {/* Test arrow */}
          <line x1="260" y1="130" x2="380" y2="130" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrC)" strokeDasharray="6,4" />
          <text x="320" y="122" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Independent t-test</text>
          <text x="320" y="148" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">or Mann-Whitney U</text>

          <text x="320" y="220" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Tests whether Mean₁ − Mean₂ ≠ 0</text>
          <text x="320" y="235" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Assumes: independence, normality (or non-parametric fallback)</text>
          <text x="320" y="250" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Also: Levene's test for equal variance → Welch's t-test if violated</text>
        </>
      ) : (
        <>
          {/* Subject pool */}
          <rect x="60" y="65" width="180" height="130" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="150" y="85" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" fontFamily="sans-serif">Same Subjects</text>
          <text x="150" y="102" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Each measured twice</text>
          <circle cx="110" cy="125" r="6" fill={color} />
          <circle cx="150" cy="125" r="6" fill={color} />
          <circle cx="190" cy="125" r="6" fill={color} />

          {/* Arrow to Time 1 */}
          <line x1="240" y1="80" x2="320" y2="80" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrC)" />
          <text x="280" y="73" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">Time 1</text>
          {/* Time 1 box */}
          <rect x="330" y="55" width="150" height="50" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="405" y="75" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Pre-treatment</text>
          <text x="405" y="93" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Measure once</text>

          {/* Arrow to Time 2 */}
          <line x1="240" y1="160" x2="320" y2="160" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrC)" />
          <text x="280" y="153" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">Time 2</text>
          {/* Time 2 box */}
          <rect x="330" y="135" width="150" height="50" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="405" y="155" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Post-treatment</text>
          <text x="405" y="173" textAnchor="middle" fill={color + "cc"} fontSize="9.5" fontFamily="sans-serif">Measure again (same subjects)</text>

          {/* Difference arrow */}
          <line x1="385" y1="105" x2="385" y2="135" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrC)" />
          <text x="400" y="122" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">Difference scores</text>

          {/* Analysis */}
          <line x1="490" y1="130" x2="530" y2="130" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrC)" />
          <rect x="540" y="105" width="120" height="50" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
          <text x="590" y="125" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Paired t-test</text>
          <text x="590" y="142" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">or Wilcoxon</text>
        </>
      )}
      <defs><marker id="arrC" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} /></marker></defs>
    </svg>
  );
}

// Longitudinal diagram: subjects across timepoints
function LongDiagram() {
  const color = "#fb923c";
  const light = color + "22";
  return (
    <svg viewBox="0 0 640 260" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">Longitudinal / Growth Tracking Design</text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Same subjects, repeated measurements across time</text>

      {/* Subject */}
      <rect x="60" y="65" width="150" height="140" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="135" y="85" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Subject 1</text>
      <circle cx="110" cy="110" r="5" fill={color} />
      <circle cx="135" cy="110" r="5" fill={color} />
      <circle cx="160" cy="110" r="5" fill={color} />
      <circle cx="110" cy="135" r="5" fill={color} />
      <circle cx="160" cy="135" r="5" fill={color} />

      {/* Timepoints */}
      <line x1="210" y1="75" x2="300" y2="75" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrL)" />
      <line x1="210" y1="115" x2="300" y2="115" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrL)" />
      <line x1="210" y1="155" x2="300" y2="155" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrL)" />
      <line x1="210" y1="195" x2="300" y2="195" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrL)" />

      {/* T1 */}
      <rect x="300" y="55" width="100" height="40" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="350" y="72" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Timepoint 1</text>
      <text x="350" y="88" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">(Baseline)</text>
      {/* T2 */}
      <rect x="300" y="95" width="100" height="40" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="350" y="112" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Timepoint 2</text>
      <text x="350" y="128" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">(+6 months)</text>
      {/* T3 */}
      <rect x="300" y="135" width="100" height="40" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="350" y="152" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Timepoint 3</text>
      <text x="350" y="168" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">(+12 months)</text>
      {/* T4 */}
      <rect x="300" y="175" width="100" height="40" rx="6" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="350" y="192" textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="sans-serif">Timepoint 4</text>
      <text x="350" y="208" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">(+24 months)</text>

      {/* Analysis */}
      <line x1="400" y1="100" x2="480" y2="100" stroke={color + "88"} strokeWidth="1.5" markerEnd="url(#arrL)" />
      <rect x="470" y="75" width="150" height="110" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="545" y="95" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Analysis</text>
      <line x1="485" y1="105" x2="605" y2="105" stroke={color + "44"} strokeWidth="0.5" />
      <text x="545" y="118" textAnchor="middle" fill={color} fontSize="9.5" fontFamily="sans-serif">RM-ANOVA</text>
      <text x="545" y="132" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">(sphericity-corrected)</text>
      <text x="545" y="148" textAnchor="middle" fill={color} fontSize="9.5" fontFamily="sans-serif">Mixed Model (LMM)</text>
      <text x="545" y="162" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Change scores</text>
      <text x="545" y="176" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Pairwise comparisons</text>

      <defs><marker id="arrL" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} /></marker></defs>
    </svg>
  );
}

// Airway diagram: sagittal view concept
function AirwayDiagram() {
  const color = "#38bdf8";
  const light = color + "22";
  return (
    <svg viewBox="0 0 640 280" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">Lateral Cephalometric Airway Analysis</text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">Sagittal view — 12 measurements from bony &amp; soft-tissue landmarks</text>

      {/* Skull outline */}
      <ellipse cx="300" cy="130" rx="120" ry="100" fill="none" stroke={color + "33"} strokeWidth="1.5" strokeDasharray="4,4" />

      {/* Sella-Nasion line */}
      <line x1="230" y1="60" x2="380" y2="60" stroke={color + "66"} strokeWidth="1.5" strokeDasharray="3,3" />
      <circle cx="230" cy="60" r="4" fill={color} />
      <circle cx="380" cy="60" r="4" fill={color} />
      <text x="225" y="52" textAnchor="end" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">S</text>
      <text x="385" y="52" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">N</text>

      {/* PNS */}
      <circle cx="340" cy="110" r="4" fill={color} />
      <text x="350" y="107" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">PNS</text>

      {/* Soft palate / SP */}
      <line x1="340" y1="110" x2="310" y2="150" stroke={color} strokeWidth="2" />
      <circle cx="310" cy="150" r="4" fill={color} />
      <text x="318" y="148" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">SP</text>

      {/* Posterior pharyngeal wall */}
      <line x1="390" y1="70" x2="390" y2="210" stroke={color + "88"} strokeWidth="2" />
      <circle cx="390" cy="90" r="4" fill={color} />
      <text x="398" y="93" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">PH</text>

      {/* Airway space labels */}
      <rect x="330" y="105" width="55" height="20" rx="3" fill={light} stroke={color} strokeWidth="1" />
      <text x="357" y="119" textAnchor="middle" fill={color} fontSize="8" fontWeight="600" fontFamily="sans-serif">R-PAS</text>

      <rect x="330" y="155" width="55" height="20" rx="3" fill={light} stroke={color} strokeWidth="1" />
      <text x="357" y="169" textAnchor="middle" fill={color} fontSize="8" fontWeight="600" fontFamily="sans-serif">R-RG</text>

      {/* Mandibular plane */}
      <line x1="240" y1="210" x2="380" y2="200" stroke={color + "55"} strokeWidth="1.5" strokeDasharray="3,3" />
      <text x="240" y="225" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Mandibular Plane</text>

      {/* Hyoid */}
      <circle cx="320" cy="195" r="4" fill="#f59e0b" />
      <text x="330" y="192" fill="#f59e0b" fontSize="9" fontWeight="600" fontFamily="sans-serif">H</text>
      <line x1="320" y1="199" x2="320" y2="207" stroke="#f59e0b88" strokeWidth="1" strokeDasharray="2,2" />
      <text x="355" y="206" textAnchor="middle" fill="#f59e0b" fontSize="8" fontFamily="sans-serif">MP-H</text>

      {/* C3 */}
      <rect x="400" y="195" width="40" height="25" rx="4" fill={light} stroke={color} strokeWidth="1" />
      <text x="420" y="212" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">C3</text>

      {/* Legend */}
      <rect x="460" y="55" width="155" height="130" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="537" y="73" textAnchor="middle" fill={color} fontSize="10" fontWeight="700" fontFamily="sans-serif">Key Measurements</text>
      <line x1="475" y1="80" x2="595" y2="80" stroke={color + "44"} strokeWidth="0.5" />
      <text x="475" y="95" fill={color} fontSize="9" fontFamily="sans-serif">R-PAS</text>
      <text x="595" y="95" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Retropalatal</text>
      <text x="475" y="110" fill={color} fontSize="9" fontFamily="sans-serif">R-RG</text>
      <text x="595" y="110" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Retroglossal</text>
      <text x="475" y="125" fill="#f59e0b" fontSize="9" fontFamily="sans-serif">MP-H</text>
      <text x="595" y="125" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Hyoid position</text>
      <text x="475" y="140" fill={color} fontSize="9" fontFamily="sans-serif">MAS</text>
      <text x="595" y="140" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Middle airway</text>
      <text x="475" y="155" fill={color} fontSize="9" fontFamily="sans-serif">IAS</text>
      <text x="595" y="155" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Inferior airway</text>
      <text x="475" y="170" fill={color} fontSize="9" fontFamily="sans-serif">MP-H</text>
      <text x="595" y="170" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Hyoid position</text>

      <text x="320" y="260" textAnchor="middle" fill={color + "aa"} fontSize="9" fontFamily="sans-serif">R-PAS &lt; 5mm = severe narrowing | MP-H elevated in OSA | 14 measurements, age/sex-stratified norms</text>
    </svg>
  );
}

// Correlation diagram: scatter plot concept
function CorrDiagram({ type }) {
  const color = "#a78bfa";
  const light = color + "22";
  const label = type === "positive" ? "Positive Correlation (r = 0.87)" : type === "negative" ? "Negative Correlation (r = −0.82)" : "No Correlation (r ≈ 0)";
  const points = type === "positive"
    ? [[80,200],[100,180],[120,170],[140,150],[160,140],[180,120],[200,100],[220,85],[240,70],[260,55]]
    : type === "negative"
    ? [[80,50],[100,70],[120,85],[140,105],[160,120],[180,140],[200,155],[220,175],[240,190],[260,210]]
    : [[100,60],[120,190],[140,130],[160,80],[180,170],[200,100],[220,150],[240,110],[260,180],[280,140]];
  return (
    <svg viewBox="0 0 640 260" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">Correlation Analysis</text>
      <text x="320" y="38" textAnchor="middle" fill={color + "cc"} fontSize="10" fontFamily="sans-serif">{label}</text>
      {/* Scatter axes */}
      <line x1="70" y1="40" x2="70" y2="230" stroke={color + "88"} strokeWidth="1.5" />
      <line x1="50" y1="230" x2="570" y2="230" stroke={color + "88"} strokeWidth="1.5" />
      <text x="55" y="35" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Y</text>
      <text x="560" y="243" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">X</text>
      {/* Dots */}
      {points.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r="5" fill={color} opacity="0.7" />
      ))}
      {/* Regression line for positive/negative */}
      {type !== "none" && (
        <line x1="70" y1={type === "positive" ? 210 : 55} x2="280" y2={type === "positive" ? 50 : 215} stroke={color} strokeWidth="2" strokeDasharray="5,3" />
      )}
      {/* Regression result box */}
      <rect x="420" y="55" width="180" height="100" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="510" y="75" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Regression</text>
      <line x1="435" y1="85" x2="585" y2="85" stroke={color + "44"} strokeWidth="0.5" />
      <text x="510" y="100" textAnchor="middle" fill={color} fontSize="10" fontFamily="sans-serif">Linear: y = ax + b</text>
      <text x="510" y="115" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">VIF for multicollinearity</text>
      <text x="510" y="130" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Partial correlation</text>
      <text x="510" y="145" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Logistic: odds ratios</text>

      <defs><marker id="arrD" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} /></marker></defs>
    </svg>
  );
}

// Diagnostic diagram: ROC concept
function DiagDiagram() {
  const color = "#f59e0b";
  const light = color + "22";
  return (
    <svg viewBox="0 0 640 260" style={{ width: "95%", height: "auto", display: "block" }}>
      <text x="320" y="22" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="sans-serif">Diagnostic Performance Analysis</text>
      {/* ROC axes */}
      <line x1="80" y1="40" x2="80" y2="220" stroke={color + "88"} strokeWidth="1.5" />
      <line x1="60" y1="220" x2="380" y2="220" stroke={color + "88"} strokeWidth="1.5" />
      <text x="70" y="35" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Sensitivity (TPR)</text>
      <text x="380" y="243" textAnchor="end" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">1 − Specificity (FPR)</text>
      {/* Diagonal reference */}
      <line x1="80" y1="220" x2="380" y2="40" stroke={color + "44"} strokeWidth="1" strokeDasharray="4,4" />
      {/* ROC curve */}
      <path d="M80,220 Q150,160 200,100 Q250,60 380,40" fill="none" stroke={color} strokeWidth="2.5" />
      {/* AUC label */}
      <text x="230" y="170" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="sans-serif">AUC = 0.87</text>
      <text x="230" y="185" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">[95% CI: 0.81, 0.93]</text>

      {/* Confusion matrix */}
      <rect x="420" y="50" width="170" height="170" rx="8" fill={light} stroke={color} strokeWidth="1.5" />
      <text x="505" y="70" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif">Confusion Matrix</text>
      <line x1="435" y1="80" x2="570" y2="80" stroke={color + "44"} strokeWidth="0.5" />
      {/* Matrix grid */}
      <rect x="450" y="95" width="45" height="25" rx="3" fill={color + "18"} stroke={color + "88"} strokeWidth="1" />
      <text x="472" y="112" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">TP</text>
      <rect x="505" y="95" width="45" height="25" rx="3" fill={color + "18"} stroke={color + "88"} strokeWidth="1" />
      <text x="527" y="112" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">FP</text>
      <rect x="450" y="130" width="45" height="25" rx="3" fill={color + "18"} stroke={color + "88"} strokeWidth="1" />
      <text x="472" y="147" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">FN</text>
      <rect x="505" y="130" width="45" height="25" rx="3" fill={color + "18"} stroke={color + "88"} strokeWidth="1" />
      <text x="527" y="147" textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="sans-serif">TN</text>
      <text x="505" y="175" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Sens = TP / (TP+FN)</text>
      <text x="505" y="190" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Spec = TN / (TN+FP)</text>
      <text x="505" y="205" textAnchor="middle" fill={color + "cc"} fontSize="9" fontFamily="sans-serif">Youden's J = Sens+Spec−1</text>

      <defs><marker id="arrE" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={color + "88"} /></marker></defs>
    </svg>
  );
}

const GUIDES = {
  reliability: {
    title: "Reliability Study Guide",
    diagramTypes: ["intra", "inter", "method"],
    diagramLabels: { intra: "Intra-Observer", inter: "Inter-Observer", method: "Method Comparison" },
    sections: [
      {
        heading: "What it measures",
        body: "Quantifies the reproducibility and consistency of landmark identification and measurements. Determines whether repeated measurements by the same rater (intra-observer) or different raters (inter-observer) produce clinically acceptable agreement.",
        icon: "target",
      },
      {
        heading: "When to use",
        body: "Before starting a clinical study or multi-rater project. Run a reliability study to: (1) calibrate raters against a gold standard, (2) determine if a new measurement method is reproducible enough for clinical use, or (3) establish the measurement error for sample size calculations in a planned study.",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "Each case must have ≥ 2 sessions marked by the same rater (intra) or by different raters (inter). Labels must match across sessions. A minimum of 10 cases is recommended for stable ICC estimates; 30+ cases for precise confidence intervals (Walter et al. 1998).",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          {
            label: "Create reliability sessions",
            body: "For each case, create separate sessions for each rater/occasion. Use Duplicate Session and assign operator IDs via the Session Metadata modal.",
            type: "setup",
          },
          {
            label: "Map sessions to cases",
            body: "Go to the Sessions panel → Reliability tab. Map each session to a case, operator, and occasion number. This tells the engine which measurements should be compared.",
            type: "setup",
          },
          {
            label: "Create & configure study",
            body: "Go to Research → New Study → Reliability. Choose intra-observer (same rater, repeat sessions) or inter-observer (different raters). Set the ICC model (2,1 absolute is most common) and minimum time separation between occasions.",
            type: "configure",
          },
          {
            label: "Select measurement labels",
            body: "Choose which landmark labels to include. Only labels present in ALL mapped sessions with the same name will be analyzed.",
            type: "configure",
          },
          {
            label: "Run the study",
            body: "Click Run. The engine computes ICC with 95% CI, Bland-Altman limits, Dahlberg/SEM/MDC, and landmark error maps for each selected label.",
            type: "run",
          },
          {
            label: "Review results & warnings",
            body: "Check the warnings section for sample size concerns or time-separation violations. Open the Results dialog to explore charts and export data.",
            type: "review",
          },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "ICC (2,1)", desc: "Absolute agreement — the primary metric. >0.90 = excellent, 0.75–0.90 = good, 0.50–0.75 = moderate, <0.50 = poor" },
          { label: "95% CI", desc: "Confidence interval for the ICC. Wide CI = imprecise estimate (need more cases)" },
          { label: "Bland-Altman", desc: "Mean difference ± 1.96 SD = limits of agreement. The bias CI tells you if the mean difference is significantly different from zero" },
          { label: "Dahlberg Error", desc: "Technical error of measurement in the original unit (mm or px). √(Σd²/2n)" },
          { label: "SEM", desc: "Standard error of measurement — σ<sub>total</sub> × √(1−ICC). Differs from Dahlberg when ≥3 occasions are used." },
          { label: "MDC (95%)", desc: "Minimal detectable change = 1.96 × √2 × SEM. Changes smaller than this cannot be distinguished from measurement error" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• ICC assumes that cases are a random sample from the population and raters are either fixed or random depending on the model.\n• With fewer than 10 cases, ICC confidence intervals will be wide — interpret as preliminary.\n• Bland-Altman with 3+ occasions: all pairwise differences are computed, which inflates the sample size for the bias CI — a variance-inflation factor is applied to compensate.\n• The landmark error map reports radial errors around the mean landmark position. Use it to identify landmarks with poor placement consistency.",
        icon: "bulb",
      },
    ],
  },

  descriptive: {
    title: "Descriptive & Normative Study Guide",
    sections: [
      {
        heading: "What it measures",
        body: "Computes summary statistics (mean, SD, percentiles, reference intervals) for any set of landmark measurements. Compares the sample distribution against normative reference values to compute z-scores and identify deviations from the norm.",
        icon: "chart",
      },
      {
        heading: "When to use",
        body: "At any stage of analysis — descriptive statistics are the foundation for all subsequent research. Use this module to: (1) characterize your sample (mean age, mean SNA, etc.), (2) establish reference intervals for a new population, (3) compute z-scores against published norms, or (4) screen for outliers before running comparative tests.",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "At least one session with placed and visible markups. Labels must match the normative reference labels (e.g., 'SNA', 'ANB', 'SN-MP'). For per-group analysis, sessions must have a 'group' metadata field assigned. For age/sex-stratified z-scores, patient age and sex must be set in session metadata.",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Place & label landmarks", body: "Ensure all required landmarks are placed and visible. Verify labels match the normative reference names (e.g., 'SNA' not 'Sna').", type: "setup" },
          { label: "Assign metadata (optional)", body: "For group comparisons, assign each session to a group via the Session Metadata modal. For age/sex-stratified norms, set age and sex in session metadata.", type: "setup" },
          { label: "Create & configure study", body: "Go to Research → New Study → Descriptive. Choose whether to group sessions and which reference norms to compare against (Steiner, Ricketts, Downs, or custom).", type: "configure" },
          { label: "Select measurement labels", body: "Choose which labels to include. The study will compute descriptive stats for each label across all selected sessions.", type: "configure" },
          { label: "Run the study", body: "Results include mean, SD, SEM, median, IQR, percentiles, parametric/non-parametric reference intervals, and z-scores for each selected norm.", type: "run" },
          { label: "Review distributions & outliers", body: "Check the skewness/kurtosis values and the D'Agostino-Pearson normality test. Review the reference interval warnings if n < 120 for non-parametric limits.", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "Descriptive Stats", desc: "Mean, SD, SEM, min, max, median, Q1, Q3, IQR, P5, P95, P2.5, P97.5" },
          { label: "Normality (D'Agostino-Pearson)", desc: "K² test combining skewness and kurtosis. p > 0.01 suggests normality" },
          { label: "Reference Interval (95%)", desc: "Parametric: mean ± 1.96×SD (if normal). Non-parametric: 2.5th–97.5th percentiles (if n ≥ 120)" },
          { label: "CI for RI limits", desc: "95% CI around the reference limits using Reed's approximation. Wide CI = imprecise limits" },
          { label: "z-scores", desc: "(Value − Norm Mean) / Norm SD. |z| ≤ 1 = normal, 1–2 = borderline, >2 = abnormal. Direction-specific notes for ANB, SNA, SNB" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• Reference intervals computed from small samples (n < 120) are unstable for non-parametric limits — the parametric method is preferred when normality holds.\n• The D'Agostino-Pearson normality test requires n ≥ 8; for smaller samples, results are best considered exploratory.\n• z-scores against Steiner/Ricketts/Downs norms assume the patient matches the norm's population (Caucasian North American). Population mismatch is warned but not blocked.\n• The integrated reference intervals estimate where 95% of a healthy population falls — they do NOT indicate clinical abnormality thresholds.",
        icon: "bulb",
      },
    ],
  },

  comparative: {
    title: "Comparative Study Guide",
    diagramTypes: ["independent", "paired"],
    diagramLabels: { independent: "Independent Groups", paired: "Paired / Repeated" },
    sections: [
      {
        heading: "What it measures",
        body: "Tests whether two or more groups differ on a cephalometric measurement. Automatically selects the appropriate statistical test based on data characteristics (normality, sample size, design). Computes effect sizes and post-hoc comparisons for multi-group designs.",
        icon: "scale",
      },
      {
        heading: "When to use",
        body: "Use when you need to compare groups: (1) treated vs untreated subjects, (2) pre-treatment vs post-treatment measurements, (3) multiple treatment modalities, (4) different age/sex groups. Supports both independent (between-subjects) and paired (within-subjects) designs.",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "At least 2 groups with ≥ 2 sessions each. Labels must match across groups. For paired designs, group sizes must be equal. Minimum 5 cases per group recommended for parametric tests (t-test, ANOVA); non-parametric alternatives (Mann-Whitney, Kruskal-Wallis) work with ≥ 2 per group.",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Assign groups to sessions", body: "In the Sessions panel, assign each session to a group (e.g., 'Treated', 'Control') via the Session Metadata modal. Alternatively define groups in the study config.", type: "setup" },
          { label: "Create & configure study", body: "Go to Research → New Study → Comparative. Choose independent or paired design. Set α level (default 0.05) and multiple comparison correction (Bonferroni or Benjamini-Hochberg).", type: "configure" },
          { label: "Define groups", body: "Add groups and assign case IDs (sessions) to each. For 3+ groups, post-hoc tests are automatically computed.", type: "configure" },
          { label: "Select measurement labels", body: "Choose the labels to compare across groups. Each label is tested independently with a warning for multiple comparisons.", type: "configure" },
          { label: "Run the study", body: "The engine runs normality tests (Shapiro-Wilk) and Levene's test, then selects: Independent t-test / Welch's t-test / Mann-Whitney U, or One-way ANOVA / Kruskal-Wallis. Effect sizes (Cohen's d, η², rank-biserial) are computed.", type: "run" },
          { label: "Review post-hoc & MANOVA", body: "For 3+ groups, Tukey HSD or Bonferroni-corrected paired t-tests are computed. If multiple labels are selected, MANOVA (Wilks/Pillai/Hotelling/Roy) with Box's M test is run automatically.", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "Test selection routing", desc: "Normal + equal var → t-test/ANOVA; Normal + unequal var → Welch's t-test; Non-normal → Mann-Whitney U / Kruskal-Wallis" },
          { label: "Effect sizes", desc: "Cohen's d (independent t), Cohen's dz (paired t), Rank-biserial r (Mann-Whitney), η²/ω² (ANOVA), ε² (Kruskal-Wallis), Kendall's W (Friedman)" },
          { label: "Post-hoc (3+ groups)", desc: "Tukey HSD for ANOVA (studentized range distribution), Bonferroni-corrected t-tests for RM-ANOVA" },
          { label: "Multiple comparison correction", desc: "Bonferroni: p × m (conservative). Benjamini-Hochberg: controls FDR (less conservative, more power)" },
          { label: "MANOVA", desc: "Wilks' Λ, Pillai's trace, Hotelling's trace, Roy's largest root. Box's M tests covariance homogeneity" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• t-tests/ANOVA assume normality within each group. The Shapiro-Wilk test is used; sample size < 5 triggers non-parametric fallback.\n• Levene's test is median-based, which is robust to non-normality.\n• For 2-group independent designs with unequal variance, Welch's t-test is automatically used (no need to manually check).\n• Tukey HSD controls familywise error rate for all pairwise comparisons. The studentized range CDF is computed numerically via Simpson quadrature.\n• MANOVA requires complete data across all labels for each case. Cases with missing labels are excluded.",
        icon: "bulb",
      },
    ],
  },

  longitudinal: {
    title: "Longitudinal Study Guide",
    diagramTypes: ["longitudinal"],
    diagramLabels: { longitudinal: "Growth Tracking" },
    sections: [
      {
        heading: "What it measures",
        body: "Analyzes how cephalometric measurements change over time within the same subjects. Supports repeated measures ANOVA (with sphericity correction) and a pseudo-linear mixed model for growth trajectory analysis.",
        icon: "trend",
      },
      {
        heading: "When to use",
        body: "Essential for growth studies, treatment outcome tracking, and any design where the same subjects are measured at multiple timepoints. Use to: (1) assess treatment effects over time, (2) model growth curves, (3) detect when significant change occurs between visits, (4) compute individual change scores against the minimal detectable change (MDC).",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "≥ 2 timepoints, ≥ 3 subjects. Each subject must have a session at each timepoint (complete data required for RM-ANOVA). Timepoints should be separated by clinically meaningful intervals (default minimum: 30 days). Labels must match across all timepoints.",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Create timepoint sessions", body: "Create separate sessions for each subject at each timepoint (e.g., 'Subject1_T1', 'Subject1_T2', 'Subject1_T3'). Assign timepoint metadata via the Session Metadata modal.", type: "setup" },
          { label: "Define subjects & timepoints", body: "In the study config, define subjects (linked to sessions via records) and timepoints (with labels and optional target age). Map each session to the right subject and timepoint.", type: "setup" },
          { label: "Configure analysis type", body: "Choose RM-ANOVA (recommended for 2-4 timepoints) or Mixed Model (better for >4 timepoints or missing data). Set sphericity correction: Greenhouse-Geisser (conservative, default) or Huynh-Feldt (less conservative).", type: "configure" },
          { label: "Select measurement labels", body: "Choose the labels to analyze longitudinally.", type: "configure" },
          { label: "Run the study", body: "Results include RM-ANOVA with sphericity tests (Mauchly's W, GG/HF/LB epsilon), pairwise comparisons (Bonferroni-corrected), change scores with MDC flags, and growth slopes from the LMM.", type: "run" },
          { label: "Review trajectories", body: "Check the sphericity assumption — if violated, use the corrected df. Review individual change scores: |change| > MDC indicates a real change beyond measurement error. Review the LMM fixed effects (intercept + slope).", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "RM-ANOVA F", desc: "Tests whether timepoint means differ. Sphericity-corrected df are reported when Mauchly's test is significant" },
          { label: "Mauchly's W", desc: "Tests sphericity (equal variances of differences). p < 0.05 = violated → use corrected df" },
          { label: "GG/HF/LB epsilon", desc: "Correction factors: GG ≤ HF ≤ 1. Lower epsilon = more severe sphericity violation" },
          { label: "Pairwise comparisons", desc: "Bonferroni-corrected paired t-tests between each pair of timepoints. Reports Cohen's dz" },
          { label: "Change scores", desc: "Mean change + SD + t-test for each timepoint pair. MDC flag: |mean change| > MDC indicates real change" },
          { label: "LMM (OLS pseudo-model)", desc: "Fixed effects: Intercept + Time. Random: subject variance, slope variance, ICC. Cluster-robust SEs. Model is a simplified alternative — use a proper mixed-model tool for definitive inference" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• RM-ANOVA requires complete data — subjects with missing timepoints are excluded. For missing data, use the LMM option which fits all available observations.\n• The LMM is a pooled OLS with cluster-robust SEs (sandwich estimator), not a full REML mixed model. The df are based on the number of subjects, not observations, to avoid anti-conservative p-values.\n• Individual MDC uses the SD of the difference scores (not the SEM of the mean), which is the correct formula for determining if an individual patient's change exceeds measurement error.\n• Time-separation violations are flagged when consecutive timepoints are too close together — this inflates the apparent stability of measurements. Respect the minimum interval.",
        icon: "bulb",
      },
    ],
  },

  correlation: {
    title: "Correlation & Regression Study Guide",
    diagramTypes: ["positive", "negative", "none"],
    diagramLabels: { positive: "Positive r", negative: "Negative r", none: "No Correlation" },
    sections: [
      {
        heading: "What it measures",
        body: "Quantifies the relationship between two or more cephalometric variables. Computes Pearson or Spearman correlation coefficients with confidence intervals, partial correlations controlling for covariates, and linear or logistic regression models with full diagnostic output.",
        icon: "link",
      },
      {
        heading: "When to use",
        body: "Use to explore associations between measurements: (1) does mandibular length correlate with facial height?, (2) can SNA predict ANB?, (3) what is the odds ratio of airway restriction given a low PAS value? Supports both continuous outcomes (linear regression) and binary outcomes (logistic regression).",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "All sessions must have the same set of labels (complete data). Minimum 3 sessions for correlation, 10 for linear regression, 10 per class for logistic regression. Labels must be numeric. For partial correlation, covariate labels must also be present in all sessions.",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Place landmarks consistently", body: "Ensure all required landmarks are placed and visible in every session. Missing labels cause the session to be excluded from that analysis.", type: "setup" },
          { label: "Create & configure study", body: "Go to Research → New Study → Correlation. Choose Pearson (parametric) or Spearman (non-parametric for ordinal/non-normal data).", type: "configure" },
          { label: "Select variables", body: "Choose dependent variable and predictors. For linear/logistic regression, select the dependent variable and at least one predictor.", type: "configure" },
          { label: "Configure regression (optional)", body: "For logistic regression, set a threshold to binarize the dependent variable. Covariates can be added for partial correlation.", type: "configure" },
          { label: "Run the study", body: "Results include the correlation matrix with p-values, BH-adjusted for multiple comparisons. Regression includes coefficients, R², ANOVA F-test, VIF, diagnostic plots.", type: "run" },
          { label: "Check diagnostics", body: "For linear regression: review residual normality (Shapiro-Wilk), heteroscedasticity (Breusch-Pagan), influential points (Cook's D), and VIF (≥ 5 indicates multicollinearity). For logistic: check convergence and separation warnings.", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "Correlation matrix", desc: "Pearson r or Spearman ρ with 95% CI (Fisher z), t-test p-value, BH-adjusted significance" },
          { label: "Partial correlation", desc: "Correlation between two variables after removing the effect of covariates — residualized via OLS" },
          { label: "Linear regression", desc: "Coefficients, SE, t, p, 95% CI, R², adjusted R², F-test, AIC/BIC, VIF, diagnostics (normality, heteroscedasticity, influential points)" },
          { label: "Logistic regression", desc: "Odds ratios with 95% CI, pseudo-R², AUC with DeLong CI, Youden-optimal cutoff, sensitivity/specificity, confusion matrix" },
          { label: "VIF", desc: "Variance Inflation Factor — quantifies multicollinearity. VIF ≥ 5 indicates predictors are highly correlated" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• Pearson correlation is sensitive to outliers — check scatter plots before interpreting. Spearman is more robust.\n• Linear regression assumes: linearity, independence, homoscedasticity, normality of residuals. Diagnostics are provided for all four.\n• Logistic regression uses Newton-Raphson optimization with step-halving. Separation (perfect prediction) causes non-convergence — reduce the model or collect more data.\n• VIF is computed by regressing each predictor on all others. A VIF of 5 means the SE of that coefficient is inflated by √5 ≈ 2.2× due to collinearity.\n• Benjamini-Hochberg adjustment controls the false discovery rate — less conservative than Bonferroni, appropriate for exploratory correlation analyses.",
        icon: "bulb",
      },
    ],
  },

  diagnostic: {
    title: "Diagnostic Performance Study Guide",
    diagramTypes: ["roc"],
    diagramLabels: { roc: "ROC Curve" },
    sections: [
      {
        heading: "What it measures",
        body: "Evaluates how well a cephalometric measurement can discriminate between two clinical conditions (e.g., airway restriction vs normal, skeletal Class II vs Class I). Computes the ROC curve, AUC with DeLong confidence intervals, optimal thresholds, and logistic regression-based composite indices.",
        icon: "hospital",
      },
      {
        heading: "When to use",
        body: "Essential for diagnostic accuracy studies: (1) determine the best cutoff value for a measurement to screen for a condition, (2) compare the diagnostic performance of multiple measurements, (3) combine multiple measurements into a composite diagnostic index, (4) estimate the cross-validated AUC for a predictive model.",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "\u2265 10 cases with \u2265 5 per class. Each case needs the gold-standard label (binary or numeric with threshold) and at least one predictor measurement. Predictors must be different from the gold standard. All cases must have complete data on all predictors and the gold standard.",
        icon: "chart",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Define gold standard", body: "Identify which label and value defines the 'positive' condition. For binary labels (e.g., 'AirwayRestriction = yes'), select the matching string. For numeric labels (e.g., 'ANB > 4°'), enter the threshold value.", type: "setup" },
          { label: "Select predictor measurements", body: "Choose one or more measurements to evaluate as diagnostic tests. Each predictor is analyzed independently for ROC/AUC, and all are combined into a logistic composite index.", type: "setup" },
          { label: "Create & configure study", body: "Go to Research → New Study → Diagnostic. Set the gold standard label and positive value. Choose predictors. Optionally set the direction (higher = positive or lower = positive).", type: "configure" },
          { label: "Configure cross-validation (optional)", body: "For the composite index, choose LOOCV (default, unbiased but high variance) or k-fold (more stable, set k=10). A seeded PRNG ensures reproducibility.", type: "configure" },
          { label: "Run the study", body: "Results include per-predictor ROC/AUC, DeLong CI, optimal thresholds (Youden/F1/distance/accuracy), calibration (Hosmer-Lemeshow), and pairwise AUC comparisons. Composite index + cross-validated AUC.", type: "run" },
          { label: "Review & compare", body: "Compare AUCs across predictors with Bonferroni-adjusted p-values. Check the optimal threshold that maximizes Sensitivity+Specificity−1 (Youden). Review the composite index calibration. Cross-validated AUC gives a less optimistic estimate of model performance.", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "ROC curve", desc: "Sensitivity vs 1−Specificity across all thresholds. The curve's shape shows the trade-off between true positives and false positives" },
          { label: "AUC", desc: "Area Under the ROC Curve. 0.5 = random, 0.7−0.8 = acceptable, 0.8−0.9 = excellent, >0.9 = outstanding" },
          { label: "DeLong CI", desc: "Non-parametric confidence interval for AUC using the method of DeLong et al. Accounts for the correlation structure of the data" },
          { label: "Optimal threshold", desc: "Youden's J (max Sens+Spec−1), F1, distance to perfect (0,1), and accuracy. Wilson CIs provided for sensitivity, specificity, PPV, NPV" },
          { label: "Composite index", desc: "Logistic regression combining all predictors. Includes coefficients, OR, pseudo-R², AIC/BIC, predicted probabilities, and its own ROC/AUC" },
          { label: "Cross-validated AUC", desc: "Apparent AUC minus optimism (mean per-fold train AUC − test AUC). Less biased than the apparent AUC from the full model" },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• ROC analysis requires a binary gold standard. Continuous measurements must be dichotomized with a clinically meaningful threshold.\n• Small samples (n < 50 per group) produce wide DeLong CIs — treat AUC estimates as preliminary.\n• The Hosmer-Lemeshow test for calibration has low power in small samples; groups with expected count < 5 trigger a warning.\n• Cross-validated AUC with LOOCV is nearly unbiased but has high variance. k-fold CV (k=10) reduces variance at the cost of slight bias.\n• The composite logistic index is fitted by Newton-Raphson with step-halving — if convergence fails due to separation, collect more data or use fewer predictors.",
        icon: "bulb",
      },
    ],
  },

  superimposition: {
    title: "Superimposition & Growth Study Guide",
    sections: [
      {
        heading: "What it measures",
        body: "Superimposes two cephalometric tracings (T1 \u2192 T2) to visualize and quantify skeletal/dental change over time. Computes per-landmark displacement vectors, angular changes, linear deltas, growth pattern classification, reference plane rotation tracking, and delta norm comparisons against normative growth data.",
        icon: "shuffle",
      },
      {
        heading: "When to use",
        body: "Use for: (1) Treatment outcome evaluation \u2014 quantify skeletal/dental change after orthodontic treatment or orthognathic surgery. (2) Growth monitoring \u2014 track natural growth patterns over serial cephalograms. (3) Relapse assessment \u2014 measure post-treatment stability. (4) Clinical research \u2014 compare displacement patterns between groups or against normative standards.",
        icon: "chart",
      },
      {
        heading: "Data requirements",
        body: "\u2265 2 sessions (T1 base, T2 comparison) with matching landmark labels. At least 2 matching point landmarks required for Procrustes or structural alignment. For 2-point alignment, select 2 anchor landmarks present in both sessions. Calibration (pxPerMm) enables mm-based analysis; without it, results are in pixel units. Patient demographics (sex, age) enable delta norm comparisons.",
        icon: "box",
      },
      {
        heading: "Alignment methods",
        items: [
          { label: "Procrustes (Best-Fit)", desc: "Uses ALL matching landmarks to compute optimal rotation, translation, and scale via Kabsch algorithm. Best for complete landmark sets." },
          { label: "2-Point", desc: "Select two landmarks as anchors. Full rigid alignment (translation + rotation + scale). Simple but sensitive to landmark placement error." },
          { label: "Structural", desc: "Select any two landmarks to define a reference plane. Rotation-only alignment (no scale/translation). Use for cranial-base, palatal-plane, or mandibular-plane registration." },
        ],
        icon: "gear",
      },
      {
        heading: "Output tabs",
        items: [
          { label: "Displacements", desc: "Per-landmark distance (mm) and direction. Color-coded: green (<2mm), yellow (2\u20135mm), red (>5mm). Confidence level based on propagated typical error." },
          { label: "Patterns", desc: "Automated clinical pattern detection: growth pattern, skeletal class change, maxillary rotation, mandibular autorotation, incisor changes, profile changes." },
          { label: "Growth", desc: "Reference plane rotation tracking (SN, Ba-N, palatal, mandibular, FH, OP) and plane intersection angles." },
          { label: "Delta Norms", desc: "Comparison of observed measurement changes against age/sex-stratified normative growth data with z-scores." },
          { label: "Angular", desc: "Angle measurement changes between sessions (ANB, SNA, SNB, etc.)." },
          { label: "Linear", desc: "Linear measurement changes (length, distance, area, perimeter)." },
          { label: "Error", desc: "Propagated typical landmark error analysis with significance ratios and confidence levels." },
        ],
        icon: "chart",
      },
      {
        heading: "Tips & limitations",
        body: "\u2022 Procrustes alignment is sensitive to landmark quality \u2014 ensure consistent landmark identification across sessions.\n\u2022 Structural alignment is rotation-only; use 2-point if you also need scale correction.\n\u2022 The 'Matched' count shows how many landmarks were found in both sessions \u2014 more matches give more reliable Procrustes alignment.\n\u2022 Delta norms require patient demographics (sex + age at T1/T2). Without them, delta norm comparisons are skipped.\n\u2022 Clinical patterns are derived from rotation tracking and angular changes \u2014 they depend on having the relevant reference-plane landmarks (Sella, Nasion, ANS, etc.) in both sessions.",
        icon: "bulb",
      },
    ],
  },

  airway: {
    title: "Airway Analysis Study Guide",
    sections: [
      {
        heading: "What it measures",
        body: "Computes pharyngeal airway dimensions from lateral cephalometric landmarks. Evaluates retropalatal, retroglossal, and total airway spaces against age/sex-stratified normative data. Produces an OSA (Obstructive Sleep Apnea) risk score based on multi-measurement deviation analysis.",
        icon: "lungs",
      },
      {
        heading: "When to use",
        body: "Use for: (1) Airway assessment before orthodontic treatment or orthognathic surgery. (2) OSA screening using cephalometric measurements. (3) Evaluating airway changes after mandibular advancement, maxillary expansion, or other treatments that affect the pharyngeal space. (4) Research comparing airway dimensions across patient groups.",
        icon: "clipboard",
      },
      {
        heading: "Data requirements",
        body: "A lateral cephalometric radiograph with ≥16 airway landmarks placed. Core landmarks (10): PNS, N, PH, C3, H, Me, Go, SP, Eb, TT — enables 7 core measurements. Advanced landmarks (6): Ba, Ad1, Ad3, Vallecula, Epiglottis, PAS_lowest — unlocks 9 additional measurements. Calibration (pxPerMm) is required for mm-based measurements and norm comparisons. Patient sex and age enable age/sex-stratified norms.",
        icon: "chart",
      },
      {
        heading: "Required landmarks",
        items: [
          { label: "Core landmarks (10)", desc: "PNS (posterior nasal spine), N (nasion), PH (posterior pharyngeal wall), C3 (3rd cervical vertebra), H (hyoid), Me (menton), Go (gonion), SP (soft palate tip), Eb (epiglottis base), TT (tongue tip)" },
          { label: "Advanced landmarks (9)", desc: "SP_mid (soft palate midpoint), Ba (basion), Ad1 (adenoid point 1), Ad2 (adenoid point 2), Ad3 (adenoid point 3), Ad4 (adenoid point 4), Vallecula, Epiglottis (tip), PAS_lowest (lowest posterior airway point)" },
          { label: "Tiered system", desc: "Core landmarks enable 5 OSA-critical measurements. Advanced landmarks unlock 9 additional measurements for detailed regional analysis. Place core landmarks first — advanced landmarks unlock when all core are placed." },
        ],
        icon: "pin",
      },
      {
        heading: "Step-by-step workflow",
        icon: "note",
        steps: [
          { label: "Load Airway Template", body: "Click 'Load Airway Template' in the Airway panel to place core landmarks. Alternatively, place them manually using the Landmark tool.", type: "setup" },
          { label: "Place core landmarks", body: "Click each core landmark on the lateral cephalogram. Follow the placement guide in the Core Landmarks grid — green checkmarks indicate placed landmarks.", type: "setup" },
          { label: "Calibrate", body: "Draw a ruler of known length (R key) and enter the real-world distance. Calibration is required for mm-based measurements and norm comparisons.", type: "configure" },
          { label: "Review core measurements", body: "The panel computes 5 core airway measurements automatically. Each shows the value, normal range, z-score, source publication, and clinical significance. Green = normal, yellow = borderline, red = constrained.", type: "run" },
          { label: "Place advanced landmarks (optional)", body: "Once all core landmarks are placed, advanced landmarks unlock. Place SP_mid, Ba, Ad1, Ad2, Ad3, Ad4, Vallecula, Epiglottis, PAS_lowest for detailed regional analysis.", type: "configure" },
          { label: "Review advanced measurements", body: "9 additional measurements become available: R-RG, SP-AW, PNS-AD1, PNS-AD2, MAS, IAS, Oropharyngeal Depth, Hyoid-C3, Mandibular Body.", type: "run" },
          { label: "Check OSA risk", body: "The OSA Risk Scorecard aggregates all measurements into a composite risk level (low/moderate/high). Review the flagged measurements and critical values.", type: "review" },
          { label: "Generate boundaries (optional)", body: "Click 'Generate Smooth Airway Boundaries' to auto-trace the anterior and posterior airway walls using Catmull-Rom interpolation with boundary-snapping.", type: "review" },
        ],
      },
      {
        heading: "Output explained",
        items: [
          { label: "Core measurements (5)", desc: "N-PH, R-PAS, MP-H, SP-Length, Tongue-Length" },
          { label: "Advanced measurements (9)", desc: "R-RG, SP-AW, PNS-AD1, PNS-AD2, MAS, IAS, Oropharyngeal Depth, Hyoid-C3, Mandibular Body" },
          { label: "Z-scores", desc: "(Value − Norm Mean) / Norm SD. |z| ≤ 1 = normal, 1–2 = borderline, >2 = constrained (narrow)" },
          { label: "OSA Risk Score", desc: "Composite risk level based on mean z-score across all measurements. High risk = mean |z| > 1.5 or ≥3 critical measurements. Moderate = mean |z| > 1.0 or ≥2 critical" },
          { label: "Normative data", desc: "Age/sex-stratified norms from Solow, McNamara, Schulhof, Pracharktam, Bibby, Lowe, Dempewolf, and Standard sources. Each measurement shows its source publication." },
        ],
        icon: "trend",
      },
      {
        heading: "Tips & limitations",
        body: "• 2D cephalometric airway measurements are an approximation — CBCT provides 3D volumetric analysis for definitive airway assessment.\n• The retropalatal space (R-PAS) is the most clinically significant measurement for OSA screening — values <5mm suggest severe narrowing.\n• MP-H (hyoid position) is elevated in OSA patients — it reflects posterior tongue position and mandibular rotation.\n• Age/sex-stratified norms are important — pediatric airway dimensions differ significantly from adults.\n• The OSA risk score is a screening tool, not a diagnostic — polysomnography is the gold standard for OSA diagnosis.\n• Auto-generated boundaries are approximate — review and manually adjust curves if precise boundary definition is needed.",
        icon: "bulb",
      },
    ],
  },
};

export default function StudyGuideModal({ t, studyType, onClose }) {
  const guide = GUIDES[studyType];
  const [diagramTab, setDiagramTab] = useState(guide?.diagramTypes?.[0] || null);
  if (!guide) return null;

  return (
    <Modal t={t} title={guide.title} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {guide.diagramTypes && (
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
              {guide.diagramTypes.map(dt => (
                <button key={dt} onClick={() => setDiagramTab(dt)}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: diagramTab === dt ? t.acc : t.surf3,
                    color: diagramTab === dt ? "#fff" : t.tx2,
                    transition: "all 0.15s",
                  }}>
                  {guide.diagramLabels?.[dt] || dt}
                </button>
              ))}
            </div>
            {studyType === "reliability" && <RelDiagram type={diagramTab} />}
            {studyType === "comparative" && <CompDiagram type={diagramTab} />}
            {studyType === "longitudinal" && <LongDiagram />}
            {studyType === "correlation" && <CorrDiagram type={diagramTab} />}
            {studyType === "diagnostic" && <DiagDiagram />}
            {studyType === "airway" && <AirwayDiagram />}
          </div>
        )}
        {guide.sections.map((section, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name={section.icon} size={18} color={t.acc} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{section.heading}</span>
            </div>

            {section.body && (
              <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.6, whiteSpace: "pre-wrap", marginLeft: 26 }}>{section.body}</div>
            )}

            {section.steps && (
              <StepTimeline steps={section.steps} t={t} />
            )}

            {section.items && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 26 }}>
                {section.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: t.tx }}>{item.label}</span>
                    <span style={{ color: t.tx2 }}> — {item.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
