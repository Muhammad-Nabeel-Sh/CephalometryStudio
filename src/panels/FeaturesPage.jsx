// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES (/features) — everything the app does, from the first landmark to a
// published result. Opened from the home page; the browser's Back returns.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Btn } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

// ─── Content ──────────────────────────────────────────────────────────────
const STATS = [
  ["29", "landmarks placed by AI in seconds"],
  ["23", "drawing and measuring tools"],
  ["8", "research study types"],
  ["0", "uploads: everything runs in your browser"],
];

const FLOW = [
  ["upload", "Import", "PNG, JPEG, DICOM or TIFF — calibrated from the file when it can be"],
  ["sparkle", "Trace", "AI places the landmarks; you review and correct"],
  ["ruler", "Measure", "Analyses, norms and interpretation update as you go"],
  ["chart", "Study", "Reliability, comparisons and growth across many cases"],
  ["note", "Report", "A PDF for the patient file or the methods section"],
];

const SECTIONS = [
  {
    id: "trace", eyebrow: "Tracing", color: "#7c5cfc", art: "trace",
    title: "Trace faster, without giving up control",
    lede: "An AI model finds the landmarks, and the workspace is built so checking and correcting them is quick.",
    items: [
      ["sparkle", "AI landmark detection", "A neural network locates 29 cephalometric landmarks on a lateral ceph, entirely on your device. Choose the analysis afterwards: the app shows which landmarks it found and which are still needed."],
      ["eye", "Review queue", "AI points are marked until you confirm them. Step through them one by one, and the report says which were reviewed."],
      ["target", "Guided tracing", "Place landmarks in order with a reference map of where each one sits, a magnifier, and Skip, Back or Unsure when a point is hard to see."],
      ["layers", "Tidy labels", "Labels move out of each other's way with leader lines, or show only for the active structure."],
      ["undo", "Visible undo", "Every change is listed, so you can see what an undo will take back."],
      ["cursor", "Pen, touch and mouse", "Built for tablets with a stylus as well as desktops: finger panning, precise pen placement."],
    ],
  },
  {
    id: "measure", eyebrow: "Measuring", color: "#38bdf8", art: "measure",
    title: "Every analysis you teach, and the ones you invent",
    lede: "Classic analyses are ready to go; everything else can be built from 23 drawing and measuring tools.",
    items: [
      ["book", "Built-in analyses", "Steiner, Ricketts, McNamara, Downs, Tweed and Björk-Jarabak on lateral cephs; Ricketts, Grummons, Hewitt and incisal canting on AP; plus panoramic, submentovertex, hand-wrist and photos."],
      ["ruler", "23 tools", "Points, lines, angles (3- and 4-point), perpendicular and projected distances, polygons, splines, Béziers, circles, tangents, ratios, sums and more — each measured live."],
      ["sigma", "Custom formulas", "Write your own measurements from existing ones, with LaTeX-typeset equations that also appear in the report."],
      ["scale", "Norms and interpretation", "Compare every value with population norms, see it on a normogram, and read a plain-language interpretation. Edit norms or add your own."],
      ["shuffle", "Signed, consistent conventions", "Signs follow the patient's facing direction (ANB, Wits, convexity), so values are comparable across images."],
    ],
  },
  {
    id: "images", eyebrow: "Images", color: "#34d399", art: "images",
    title: "Straight from the X-ray machine",
    lede: "Open the files your cephalostat produces and get millimetres you can trust.",
    items: [
      ["image", "DICOM and TIFF", "Uncompressed, RLE, JPEG, JPEG Lossless, JPEG-LS and JPEG 2000 DICOM files, and 16-bit TIFFs — no conversion needed. Patient fields in the file are never read."],
      ["ruler", "Automatic calibration", "Pixel spacing comes from the DICOM file, corrected for radiographic magnification when the device records it — and the app tells you when it isn't."],
      ["target", "Ruler tick detection", "Draw a line along the radiographic ruler and the app measures the tick spacing across the whole line, to a fraction of a pixel."],
      ["sliders", "Full-depth window and level", "12–16-bit images keep their original data, so you can bring out the soft-tissue profile or the bone without losing detail."],
      ["palette", "Image tools", "Brightness, contrast, edge enhancement, histogram and false-colour maps, plus image layers and overlays."],
      ["folder", "Batch import", "Bring in a whole folder of images with a CSV of patient and group details, one session per image."],
    ],
  },
  {
    id: "research", eyebrow: "Research", color: "#f59e0b", art: "research",
    title: "From a folder of cephs to a methods section",
    lede: "A full statistics workspace for cephalometric research, with results written up as you'd report them.",
    items: [
      ["check", "Reliability", "ICC (six forms), Bland-Altman and Dahlberg error, with blinded re-tracing: sessions are sealed until the measurement round is done."],
      ["chart", "Descriptive and normative", "Means, SDs, percentiles, reference intervals and z-scores against published norms."],
      ["scale", "Comparisons", "t-tests, ANOVA, MANOVA and non-parametric tests, chosen from the data, with post-hoc tests and effect sizes."],
      ["trend", "Growth and change", "Repeated-measures ANOVA, mixed models, and superimposition with displacements and rotation tracking."],
      ["target", "Correlation and diagnosis", "Correlation and regression (including logistic), ROC curves, optimal thresholds and cross-validated accuracy."],
      ["note", "Write-up included", "Plain-language summaries and APA-style methods and results text with references; export to PDF, Word or CSV."],
    ],
  },
  {
    id: "report", eyebrow: "Reports", color: "#f472b6", art: "report",
    title: "Reports worth handing over",
    lede: "One click turns a case into a polished PDF — for the patient file, a referral or a thesis appendix.",
    items: [
      ["note", "Complete PDF report", "Traced and original images, every measurement with norms, the normogram, interpretation, formulas and research results, with bookmarks."],
      ["palette", "Your look", "Light or dark report themes, your clinic name and logo."],
      ["layers", "Before and after", "Compare two sessions side by side in the same report."],
      ["shield", "Safe sharing", "Anonymize a case before export; the report warns when patient identifiers are still present."],
    ],
  },
  {
    id: "teach", eyebrow: "Teaching & community", color: "#fb923c", art: "teach",
    title: "Made for teaching, shared by its users",
    lede: "Worked examples to learn from, anatomical outlines to trace against, and a library of norms and templates that grows with every contribution.",
    items: [
      ["play", "Step-by-step examples", "Open a fully traced example case and learn it your way: browse it freely, build the tracing up in stages, follow a guided walk-through of every landmark group by group, or see how each measurement maps onto the landmarks."],
      ["bone", "Anatomical silhouettes", "Drop outline drawings of the cranial base, maxilla, mandible, orbit, pterygomaxillary fissure, external auditory meatus and cervical vertebrae onto the image as a tracing reference."],
      ["clipboard", "Templates", "Save an analysis — its landmarks, measurements, formulas and norms — as a template, with or without point positions, and share it with colleagues or students."],
      ["book", "Norms reference", "Browse the built-in norm database with sources and populations, build your own norm library, and import or export norms as CSV or JSON."],
      ["users", "Community library", "Install norm presets and example cases contributed by other users, straight from inside the app."],
      ["link", "Contribute back", "Share your own norm presets or teaching examples with the community through a simple contribution page."],
    ],
  },
  {
    id: "data", eyebrow: "Your data", color: "#a78bfa", art: "data",
    title: "Private by design, everywhere you work",
    lede: "No account, no server, no uploads. Your cases stay yours — and can follow you to your other devices if you want.",
    items: [
      ["lock", "Encrypted on your device", "Cases and images are stored in your browser, encrypted. Nothing is sent to us."],
      ["refresh", "Works offline", "Install it like an app; it opens and works without an internet connection."],
      ["users", "Profiles", "Separate sets of cases on one computer — for a clinic, a study, or each colleague."],
      ["cloud", "Sync through your Google Drive", "Link a profile to your Google account and your cases appear on every device you sign in on, optionally encrypted with your own passphrase."],
      ["save", "Backups", "Download every case in one file, or back up to Google Drive; restore any time."],
      ["folder", "Case manager", "Search, filter and sort every case; open, rename, duplicate, export or delete — one at a time or many."],
    ],
  },
];

// ─── Section illustrations (simple line art in the theme's colours) ────────
function Art({ kind, color, t }) {
  const s = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const dot = (x, y, r = 4) => <circle cx={x} cy={y} r={r} fill={color} />;
  const box = { width: "100%", height: "100%" };
  switch (kind) {
    case "trace":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <path d="M60 30 Q110 5 150 40 Q165 70 150 95 Q140 120 118 128 Q96 135 88 120 Q72 112 70 95 Q50 85 52 62 Q50 42 60 30Z" {...s} opacity="0.5" />
          <path d="M70 55 L140 45 M86 70 L128 100 M100 40 L112 118" stroke={t.tx3} strokeWidth="1" strokeDasharray="3 3" />
          {dot(70, 55)}{dot(140, 45)}{dot(100, 40)}{dot(86, 70)}{dot(128, 100)}{dot(112, 118)}
          <circle cx="128" cy="100" r="11" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
          <text x="142" y="128" fontSize="11" fill={color} fontFamily="DM Mono, monospace">AI ✓</text>
        </svg>
      );
    case "measure":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <path d="M40 120 L100 30 L165 110" {...s} />
          <path d="M84 54 A28 28 0 0 1 116 56" {...s} />
          <text x="86" y="78" fontSize="13" fill={color} fontFamily="DM Mono, monospace">82.4°</text>
          {[[30, 135, 60], [70, 135, 90], [110, 135, 45], [150, 135, 70]].map(([x, y, w], i) => <rect key={i} x={x} y={y - 4} width={w * 0.35} height="4" rx="2" fill={color} opacity={0.3 + i * 0.15} />)}
        </svg>
      );
    case "images":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <rect x="35" y="20" width="110" height="105" rx="8" {...s} />
          <path d="M55 105 Q75 60 95 70 Q115 80 125 45" {...s} opacity="0.6" />
          <rect x="155" y="25" width="10" height="95" rx="3" stroke={color} strokeWidth="1.5" fill="none" />
          {Array.from({ length: 10 }, (_, i) => <line key={i} x1="155" x2={i % 5 ? 160 : 165} y1={30 + i * 9} y2={30 + i * 9} stroke={color} strokeWidth="1.5" />)}
          <text x="40" y="142" fontSize="11" fill={color} fontFamily="DM Mono, monospace">DICOM · 16-bit · 0.1 mm</text>
        </svg>
      );
    case "research":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <path d="M30 125 H175 M30 125 V20" stroke={t.tx3} strokeWidth="1.5" />
          {[[45, 70], [70, 50], [95, 85], [120, 35], [145, 60]].map(([x, h], i) => <rect key={i} x={x} y={125 - h} width="16" height={h} rx="3" fill={color} opacity={0.35 + i * 0.12} />)}
          <path d="M40 100 Q80 60 110 70 T170 30" {...s} />
          <text x="120" y="22" fontSize="11" fill={color} fontFamily="DM Mono, monospace">ICC 0.94</text>
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <rect x="55" y="12" width="90" height="126" rx="6" {...s} />
          <rect x="66" y="24" width="68" height="36" rx="3" fill={color} opacity="0.25" />
          {[70, 80, 90, 100, 110].map((y, i) => <line key={y} x1="66" x2={i % 2 ? 120 : 134} y1={y} y2={y} stroke={t.tx3} strokeWidth="2" strokeLinecap="round" />)}
          <path d="M112 118 l8 8 l16 -18" {...s} />
        </svg>
      );
    case "teach":
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <rect x="20" y="18" width="160" height="104" rx="8" {...s} />
          <path d="M70 45 Q95 30 118 50 Q126 72 112 92 Q96 104 84 92 Q66 84 70 45Z" {...s} opacity="0.55" />
          {[[78, 52, 1], [112, 56, 2], [104, 90, 3]].map(([x, y, n]) => (
            <g key={n}><circle cx={x} cy={y} r="8" fill={color} /><text x={x} y={y + 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={t.bg}>{n}</text></g>
          ))}
          <path d="M140 40 h26 M140 52 h20 M140 64 h24" stroke={t.tx3} strokeWidth="2" strokeLinecap="round" />
          <path d="M80 122 l-14 18 M120 122 l14 18" {...s} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 150" style={box} aria-hidden>
          <path d="M60 110 h80 a26 26 0 0 0 3 -52 a38 38 0 0 0 -72 -8 a30 30 0 0 0 -11 60z" {...s} opacity="0.6" />
          <rect x="80" y="70" width="40" height="32" rx="5" {...s} />
          <path d="M88 70 v-9 a12 12 0 0 1 24 0 v9" {...s} />
          <circle cx="100" cy="86" r="3.5" fill={color} />
        </svg>
      );
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────
function FeatureCard({ t, color, icon, title, text }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? t.surf2 : t.surf, border: `1px solid ${hov ? color + "88" : t.bdr}`, borderRadius: 14, padding: 18, transition: "all 0.18s", transform: hov ? "translateY(-3px)" : "none", boxShadow: hov ? `0 12px 30px ${t.shadow}` : "none" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: t.tx, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: t.tx2, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

export default function FeaturesPage({ t, onClose, onNewCase }) {
  const mobile = useMediaQuery("(max-width: 760px)");
  const pad = mobile ? 16 : 32;
  const go = (id) => document.getElementById(`feat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.tx, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Top bar with section links */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: t.bg + "ee", backdropFilter: "blur(8px)", borderBottom: `1px solid ${t.bdr}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: `10px ${pad}px`, display: "flex", alignItems: "center", gap: 10 }}>
          <Btn t={t} small onClick={onClose}>← Home</Btn>
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>Features</span>
          <Btn t={t} small active onClick={onNewCase} style={{ marginLeft: "auto" }}>Start a case</Btn>
        </div>
        <nav aria-label="Feature sections" style={{ maxWidth: 1180, margin: "0 auto", padding: `0 ${pad}px 10px`, display: "flex", gap: 6, overflowX: "auto" }}>
          {SECTIONS.map((sec) => (
            <button key={sec.id} onClick={() => go(sec.id)}
              style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1px solid ${sec.color}55`, background: sec.color + "14", color: t.tx, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {sec.eyebrow}
            </button>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: `${mobile ? 40 : 72}px ${pad}px ${mobile ? 28 : 40}px`, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(600px 260px at 50% 0%, ${t.acc}22, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-block", background: t.accMuted, border: `1px solid ${t.acc}44`, borderRadius: 20, padding: "5px 16px", fontSize: 12, color: t.acc, fontWeight: 600, letterSpacing: 0.5, marginBottom: 20 }}>EVERYTHING IN ONE PLACE</div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(32px,5vw,58px)", margin: "0 0 16px", lineHeight: 1.1, letterSpacing: -1.5 }}>
            From the first landmark<br /><span style={{ color: t.acc }}>to the published result</span>
          </h1>
          <p style={{ color: t.tx2, fontSize: mobile ? 16 : 18, maxWidth: 680, margin: "0 auto", lineHeight: 1.7 }}>
            Cephalometry Studio traces, measures, analyses and reports — and runs research studies across hundreds of cases.
            All in your browser, with your patients' data never leaving your device unless you choose.
          </p>
        </div>
        {/* Stats */}
        <div style={{ position: "relative", maxWidth: 980, margin: `${mobile ? 28 : 40}px auto 0`, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12 }}>
          {STATS.map(([n, label]) => (
            <div key={label} style={{ background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 14, padding: "16px 12px" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 34, color: t.acc, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 13, color: t.tx2, marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section aria-label="How it works" style={{ maxWidth: 1180, margin: "0 auto", padding: `8px ${pad}px ${mobile ? 32 : 48}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(5,1fr)", gap: mobile ? 8 : 0, alignItems: "stretch" }}>
          {FLOW.map(([icon, title, text], i) => (
            <div key={title} style={{ display: "flex", alignItems: mobile ? "center" : "stretch", gap: 0 }}>
              <div style={{ flex: 1, background: t.surf, border: `1px solid ${t.bdr}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: mobile ? "row" : "column", gap: 10, alignItems: mobile ? "center" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: t.acc, color: t.bg, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <Icon name={icon} size={18} color={t.acc} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
                  <div style={{ fontSize: 13, color: t.tx2, lineHeight: 1.5, marginTop: 2 }}>{text}</div>
                </div>
              </div>
              {!mobile && i < FLOW.length - 1 && <div aria-hidden style={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", color: t.tx3 }}>→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Sections */}
      {SECTIONS.map((sec, i) => (
        <section key={sec.id} id={`feat-${sec.id}`} aria-labelledby={`feat-${sec.id}-h`}
          style={{ scrollMarginTop: 110, borderTop: `1px solid ${t.bdr}`, background: i % 2 ? t.surf + "66" : "transparent" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: `${mobile ? 36 : 56}px ${pad}px` }}>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : i % 2 ? "1fr 260px" : "260px 1fr", gap: mobile ? 16 : 40, alignItems: "center", marginBottom: 28 }}>
              <div style={{ order: mobile || i % 2 === 0 ? 0 : 1, height: mobile ? 130 : 190, background: sec.color + "10", border: `1px solid ${sec.color}33`, borderRadius: 18, padding: 12 }}>
                <Art kind={sec.art} color={sec.color} t={t} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: sec.color, marginBottom: 8 }}>{sec.eyebrow}</div>
                <h2 id={`feat-${sec.id}-h`} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(24px,3vw,36px)", margin: "0 0 10px", lineHeight: 1.15, letterSpacing: -0.5 }}>{sec.title}</h2>
                <p style={{ margin: 0, fontSize: 16, color: t.tx2, lineHeight: 1.7, maxWidth: 620 }}>{sec.lede}</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
              {sec.items.map(([icon, title, text]) => <FeatureCard key={title} t={t} color={sec.color} icon={icon} title={title} text={text} />)}
            </div>
          </div>
        </section>
      ))}

      {/* Closing call to action */}
      <section style={{ borderTop: `1px solid ${t.bdr}`, textAlign: "center", padding: `${mobile ? 40 : 64}px ${pad}px` }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(24px,3vw,36px)", margin: "0 0 10px" }}>Ready when you are</h2>
        <p style={{ margin: "0 auto 22px", fontSize: 16, color: t.tx2, maxWidth: 560, lineHeight: 1.7 }}>
          No sign-up and nothing to install. Open a radiograph and see the landmarks appear.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn t={t} active onClick={onNewCase} style={{ padding: "10px 22px", fontSize: 15 }}>Start a new case</Btn>
          <Btn t={t} onClick={onClose} style={{ padding: "10px 22px", fontSize: 15 }}>Back to home</Btn>
        </div>
        <p style={{ margin: "28px auto 0", fontSize: 12, color: t.tx3, maxWidth: 640, lineHeight: 1.6 }}>
          For research and education. Not approved or cleared for clinical diagnosis or treatment planning.
        </p>
      </section>
    </div>
  );
}
