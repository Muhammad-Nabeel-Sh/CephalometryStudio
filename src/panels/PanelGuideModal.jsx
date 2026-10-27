// ═══════════════════════════════════════════════════════════════════════════════
// PANEL GUIDE MODAL — Context-sensitive help for sessions, subjects, silhouettes
// ═══════════════════════════════════════════════════════════════════════════════

import { Modal } from "./Modal.jsx";
import { Icon } from "../ui/icons.jsx";

const GUIDES = {
  sessions: {
    title: "Sessions Guide",
    icon: "folder",
    sections: [
      {
        heading: "What is a session?",
        body: "A session represents one patient visit or imaging event. Each session contains its own set of markups, calibration data, image layers, formulas, and norms. The active session is the one currently being edited in the workspace.",
        icon: "book",
      },
      {
        heading: "Session lifecycle",
        items: [
          "Create a new session with the + Add button or the Batch Import tool",
          "Duplicate a session to create reliability trials or timepoint copies",
          "Assign metadata (group, timepoint, operator, age, sex) via the Metadata modal — this is how research modules identify cases",
          "Delete a session with the ✕ button (only when more than one session exists)",
          "Switch between sessions via the filmstrip at the bottom or the session list",
        ],
        icon: "refresh",
      },
      {
        heading: "Session metadata fields",
        items: [
          "Patient ID — for identifying the case across sessions",
          "Operator — the rater or clinician who created the session (used in inter-rater reliability)",
          "Group — assigns the session to a study group (e.g., 'Treated', 'Control')",
          "Timepoint — the visit number or time label (e.g., 'T1', 'T2')",
          "Trial number — used for intra-rater reliability (e.g., trial 1, trial 2)",
          "Age / Sex — used for age/sex-stratified normative comparison",
        ],
        icon: "tag",
      },
      {
        heading: "Compare & overlay",
        body: "The compare feature lets you overlay two sessions to visualise changes. Select a compare session from the dropdown, set two anchor landmarks for alignment, and adjust the blend opacity. Displacement vectors show how far each landmark moved between sessions.",
        icon: "search",
      },
      {
        heading: "Tips",
        body: "• Use the filmstrip at the bottom to quickly switch between sessions\n• Session thumbnails show a calibration indicator (⟺) when calibrated\n• The reliability workflow requires at least 2 sessions per case\n• Duplicate a session before modifying landmarks to create a version history",
        icon: "bulb",
      },
    ],
  },

  comparisons: {
    title: "Comparisons Guide",
    icon: "search",
    sections: [
      {
        heading: "What is comparison?",
        body: "Compare lets you overlay two sessions to visualise changes between timepoints, treatments, or raters. The compared session's markups are rendered on the canvas on top of the active session, with alignment, blending, displacement vectors, tracking lines, and airway overlay controls.",
        icon: "book",
      },
      {
        heading: "Alignment modes",
        items: [
          "2-Point — pick two landmarks as anchors; the compared session is translated, rotated, and scaled so those landmarks match",
          "Procrustes — uses ALL matching landmarks to compute the optimal rotation, translation, and scale via generalized Procrustes analysis",
          "Vector Scale — scales the length of the displacement arrows",
        ],
        icon: "target",
      },
      {
        heading: "Overlay tools",
        items: [
          "⇝ Vec — draws displacement lines between matching landmarks (green <2mm, yellow 2-5mm, red >5mm)",
          "Overlay — renders the compared session semi-transparently with the chosen alignment",
          "Blend — controls the transparency of the overlaid session",
          "Show tracking lines — connects each landmark to its matched position",
          "Show airway overlay — highlights the airway tracing of the compared session",
        ],
        icon: "image",
      },
      {
        heading: "Tips",
        body: "• Ensure both sessions use matching landmark labels — Procrustes, displacement vectors, and airway overlay rely on label matching\n• Select a compare session from the dropdown; the active session is the base\n• For a full quantified analysis (deltas, angles, growth), use the Superimposition research module\n• The compare overlay shares the same 2-Point / Procrustes algorithms used by the Superimposition module",
        icon: "bulb",
      },
    ],
  },

  subjects: {
    title: "Subjects Guide",
    icon: "person",
    sections: [
      {
        heading: "What is a subject?",
        body: "A subject represents a patient or specimen being studied across multiple sessions. Subjects link sessions together — each subject has one session per timepoint. This is how the Longitudinal and Comparative modules track individuals over time.",
        icon: "book",
      },
      {
        heading: "Creating & managing subjects",
        items: [
          "Add subjects manually with the + Add button or use preset generators for quick setup",
          "Subjects store a label and a mapping of timepoint → session ID (via the Metadata table)",
          "Use the CSV upload in Batch Import to create subjects from your study spreadsheet",
          "Subjects are used by the Longitudinal study module (each subject tracked across timepoints) and the Reliability module (each subject = one case)",
        ],
        icon: "refresh",
      },
      {
        heading: "Subject ↔ session mapping",
        body: "The key concept: each subject can have one session per timepoint. For example, Subject 1 might have 'Session A' at T1 (baseline), 'Session B' at T2 (6 months), and 'Session C' at T3 (12 months). The Metadata modal's table editor lets you assign each subject's sessions per timepoint in a spreadsheet-like grid.",
        icon: "link",
      },
      {
        heading: "Tips",
        body: "• Create subjects before running Longitudinal or Comparative studies — they auto-populate the study config\n• Use meaningful subject labels that match your study IDs\n• Subject metadata (age, sex) can be auto-derived from session metadata when all sessions agree\n• Subjects are project-level — they persist across all studies within the project",
        icon: "bulb",
      },
    ],
  },

  silhouettes: {
    title: "Silhouettes Guide",
    icon: "palette",
    sections: [
      {
        heading: "What are silhouettes?",
        body: "Silhouettes are pre-drawn anatomical outlines that can be placed on the cephalogram. They serve as visual reference overlays for tracing, superimposition, and anatomical identification. There are 23 silhouettes across categories including Full Tracing, Cranial Base, Facial Skeleton, Soft Tissue, Teeth, and Airway.",
        icon: "book",
      },
      {
        heading: "Placing & manipulating",
        items: [
          "Click any silhouette in the grid to place it on the canvas at a default position",
          "Drag the silhouette to reposition it on the image",
          "Use the corner handles (appear on selection) to resize proportionally",
          "Use the rotation handle (circle above center) to rotate around the centroid",
          "Each silhouette can have its own color, line style (solid/dashed), and visibility",
        ],
        icon: "cursor",
      },
      {
        heading: "Silhouette categories",
        items: [
          "Full Tracing — complete cephalometric tracing outlines (with/without dentition)",
          "Cranial Base & Sella — reference structures for cranial base superimposition",
          "Facial Skeleton — maxilla, mandible, orbits, nasal bones, key ridge",
          "Soft Tissue — facial profile, pharyngeal airway",
          "Teeth — maxillary and mandibular first molars",
          "Airway — epiglottis, hyoid, cervical vertebrae (C3, C4) for airway assessment",
        ],
        icon: "tag",
      },
      {
        heading: "Integration with other features",
        body: "Silhouettes work alongside regular markups — they are rendered in the same canvas layer. You can add point landmarks on top of silhouettes for measurement. The Full Tracing silhouettes are particularly useful as a baseline template for manual tracing.",
        icon: "link",
      },
      {
        heading: "Tips",
        body: "• Use the search bar to quickly find silhouettes by name or category\n• The 'Full Tracing' and 'With Dentition' buttons at the top place complete tracing sets at once\n• Adjust silhouette opacity via the Layers panel after placement\n• Silhouettes can be locked to prevent accidental movement\n• Each silhouette path is editable — Ctrl+click adds control points, Shift+click removes them",
        icon: "bulb",
      },
    ],
  },

  templates: {
    title: "Templates Guide",
    icon: "clipboard",
    sections: [
      {
        heading: "What are templates?",
        body: "Templates are pre-defined sets of anatomical landmarks, lines, angles, and measurements that define a cephalometric analysis. Each projection type (Lateral, AP, SMV, OPG, Hand-Wrist, Photos) has its own set of built-in analyses. You can also import custom templates as .cepht files.",
        icon: "book",
      },
      {
        heading: "Built-in analyses",
        items: [
          "Lateral Ceph — Steiner, Ricketts, McNamara, Downs, Bjork, Tweed, Wits, General Ceph, Jarv-Bjork",
          "AP/PA Ceph — Ricketts, General PA, Grummons Frontal Asymmetry, Hewitt, Svanholt-Solow, Grayson Multiplane",
          "SMV / OPG / Hand-Wrist — loaded from CSV reference data",
          "Each analysis defines the landmarks to place, their definitions, and the expected norm values",
        ],
        icon: "library",
      },
      {
        heading: "How to use a template",
        items: [
          "Select a template from the list for your projection type",
          "Click the template to view its landmarks in detail",
          "Click 'Load' to add the landmarks to your current session — they appear as unplaced points",
          "Use the placing mode (auto-activated) to click each point on the image",
          "As you place points, auto-created measurements populate the Measurements panel",
        ],
        icon: "cursor",
      },
      {
        heading: "Custom templates (.cepht)",
        items: [
          "Export any session's landmarks as a .cepht file via the Export dialog",
          "Version 1.0 exports definitions only (labels, types, colors)",
          "Version 2.0 also exports placed point coordinates — useful for templates with reference positions",
          "Import .cepht files via the 'Import .cepht' button or drag-and-drop",
          "Imported templates are stored in your browser's localStorage for reuse across projects",
        ],
        icon: "box",
      },
      {
        heading: "Template editing & subset loading",
        body: "Before loading a template, you can toggle individual landmarks on/off to load only a subset. This is useful when you only need specific measurements from a large analysis. Select the template, then click the subset tool icon to enter selection mode, then check/uncheck landmarks.",
        icon: "scissors",
      },
      {
        heading: "Tips",
        body: "• Use the search/filter bar to quickly find analyses by name\n• The 'General Ceph Analysis' template covers the most commonly used landmarks\n• For research studies, ensure all raters use the same template for consistency\n• Imported templates persist across sessions — manage them via the delete button\n• Template norms are automatically added when auto-creating measurements",
        icon: "bulb",
      },
    ],
  },

  formulas: {
    title: "Formulas Guide",
    icon: "sigma",
    sections: [
      {
        heading: "What are formulas?",
        body: "Formulas let you define derived measurements using mathematical expressions that reference existing landmark measurements. For example, you can compute the difference between two angles, a ratio of two lengths, or a custom cephalometric index. Formulas are evaluated using the mathjs library with a security sandbox.",
        icon: "book",
      },
      {
        heading: "How formulas work",
        items: [
          "Each formula has a name, a mathematical expression, an optional LaTeX display, and a unit",
          "Variables are landmark labels (e.g., SNA, ANB, SN-MP) or label_measurement pairs (e.g., SNA_angle, SN_MP_angle)",
          "The scope automatically includes all measurement values from the current session's markups",
          "Expressions can use: +, -, *, /, sin(), cos(), tan(), sqrt(), abs(), log(), pow(), min(), max(), and more",
          "Results are updated in real-time as you move landmarks",
        ],
        icon: "gear",
      },
      {
        heading: "Expression examples",
        items: [
          "SNA + SNB — sum of two angles",
          "SNA - SNB — difference (same as ANB)",
          "SN_MP / GoGn_SN — ratio of two plane angles",
          "abs(SNA - 82) / 2 — z-score deviation from Steiner norm",
          "(U1_NA - L1_NB) / 2 — mean of two incisor inclinations",
        ],
        icon: "note",
      },
      {
        heading: "LaTeX display",
        body: "You can optionally provide a LaTeX expression for pretty-printing the formula using KaTeX rendering. This is purely for display in the Formulas panel and the PDF report — the actual computation uses the mathjs expression. LaTeX is useful for documentation and presentations.",
        icon: "ruler",
      },
      {
        heading: "Tips",
        body: "• Pin a formula to display its result in the Measurements panel alongside regular measurements\n• Formula expressions are AST-sandboxed for security — only mathematical functions are allowed\n• Missing variables cause the formula to show 'N/A' — use the scope browser to check available variables\n• Formulas are session-specific and exported with .cephx files\n• For complex computations, break the calculation into multiple formulas",
        icon: "bulb",
      },
    ],
  },

  norms: {
    title: "Clinical Norms Guide",
    icon: "chart",
    sections: [
      {
        heading: "What are norms?",
        body: "Clinical norms are reference values (mean ± SD) for cephalometric measurements, sourced from published research. They allow you to compare a patient's measurements against population standards and compute z-scores that indicate how far the patient deviates from the norm.",
        icon: "book",
      },
      {
        heading: "Built-in norm presets",
        items: [
          "Steiner (1953) — SNA, SNB, ANB, SN-MP, U1-NA, L1-NB, Interincisal — Caucasian adult",
          "Ricketts (1960) — Facial axis, Facial depth, Mandibular plane, Convexity — mixed age",
          "Downs (1948) — Facial angle, Convexity, AB plane, Y-axis — adolescent (12-17y)",
          "McNamara (1984) — Maxillary depth, Facial depth, ANB — stratified by age/sex for linear measures",
          "Bjork-Jarabak (1972) — Sum of angles, N-S-Ar, S-Ar-Go, Ar-Go-Me — Scandinavian",
          "Tweed (1954) — FMA, FMIA, IMPA, SNA, SNB, ANB — adult",
          "Airway (Composite) — Nasopharynx, Oropharynx, Hypopharynx, PAS, widths — adult norms",
        ],
        icon: "library",
      },
      {
        heading: "My Library (custom presets)",
        items: [
          "Create your own norm presets with the 'My Library' tab in the Norms Reference modal",
          "Each preset has: name, source/citation, population, age range, sex, and a table of norms",
          "Add/edit/delete norms within a preset — batch editing of mean, SD, and type",
          "Custom presets are saved locally and persist across sessions",
          "Export any preset as JSON or CSV for sharing with colleagues",
          "Import presets from JSON files (full metadata) or CSV files (label, mean, sd, type columns)",
        ],
        icon: "folder",
      },
      {
        heading: "Adding norms to measurements",
        items: [
          "Open the Norms Reference modal from the Measurements panel",
          "Browse tab: search and add norms from built-in or custom presets",
          "My Library tab: create new presets, import, export, and manage your collection",
          "Click '+ Add' to add a single norm, or 'Add All' to add all norms from a preset",
          "Added norms appear in the measurements panel with deviation indicators",
          "Norms are session-specific and exported with .cephx files",
        ],
        icon: "plus",
      },
      {
        heading: "Interpreting deviation",
        body: "Each norm shows a deviation indicator: green (≤1 SD = within normal range), yellow (1-2 SD = borderline), red (>2 SD = abnormal). The z-score = (value - mean) / SD. For example, an SNA of 86° with norm 82±2 gives z = +2.0 — this is flagged as abnormal (2 SD above the mean). The Interpretation panel provides clinical text descriptions for each deviation.",
        icon: "trend",
      },
      {
        heading: "Tips",
        body: "• Norms are population-specific — the built-in norms are predominantly Caucasian North American\n• Age/sex-stratified norms exist for McNamara linear measurements — enter patient age/sex in session metadata\n• You can add custom norms by clicking the ±N button on any measurement and entering mean/SD manually\n• The Normogram panel visualises all deviations in a single chart\n• Norms do not affect measurements — they only provide reference context\n• Export your custom presets to JSON and share them with colleagues or contribute to the community library",
        icon: "bulb",
      },
    ],
  },
  image: {
    title: "Image Processing Guide",
    icon: "image",
    sections: [
      {
        heading: "Window & Level",
        body: 'Adjust the grayscale mapping of the radiograph. "W Center" sets the midpoint of the visible grayscale range; "W Width" sets the range around that center. Narrower widths increase contrast for a specific density range — useful for examining soft tissue vs bone in the same image.',
        icon: "sliders",
      },
      {
        heading: "Brightness & Contrast",
        body: "Fine-tune the overall image appearance. Brightness shifts the entire histogram up or down. Contrast stretches or compresses the tonal range. Edge Enhance sharpens anatomical boundaries using an unsharp mask filter.",
        icon: "sun",
      },
      {
        heading: "LUT Colorization",
        body: "Apply false-color look-up tables to the grayscale image. Grayscale is the default clinical view. Hot/Cool/Jet/Viridis/Bone/Rainbow map density values to color gradients — useful for highlighting subtle density differences in airway or bone assessment. Click Legend to show the color bar on the canvas.",
        icon: "palette",
      },
      {
        heading: "Scale & Calibration",
        body: "Shows the current calibration (px/mm) if set. Use the ruler tool (R key) to draw a line of known length on the image, then click Calibrate to set the scale. The on-screen scale bar renders a calibrated ruler directly on the canvas.",
        icon: "ruler",
      },
      {
        heading: "Histogram",
        body: "The floating histogram shows the pixel value distribution of the current image. Use it to identify optimal window/level settings by visually matching the histogram peaks to anatomical structures (bone, soft tissue, air).",
        icon: "chart",
      },
    ],
  },

  layers: {
    title: "Layers Guide",
    icon: "layers",
    sections: [
      {
        heading: "What are layers?",
        body: "The Layers panel manages multiple images stacked on the canvas. Each image can have its own opacity, blend mode, color tint, and positional offset. This is essential for superimposition workflows — overlaying tracings, comparing timepoints, or fusing different imaging modalities.",
        icon: "book",
      },
      {
        heading: "Image controls",
        items: [
          "Toggle visibility (◎/○) to show/hide individual images",
          "Reorder images with ↑/↓ buttons — the top image renders last (on top)",
          "Adjust opacity with the slider to see through to images below",
          "Blend modes control how overlapping images combine: Normal (simple overlay), Multiply (darkens), Screen (lightens), Overlay, Difference, Luminosity",
          "Serial color adds a color tint to help distinguish stacked images",
          "X/Y offsets shift the image position for manual registration",
        ],
        icon: "cursor",
      },
      {
        heading: "Adding images to the stack",
        body: "Click the dashed '+ Add to stack' area at the bottom of the panel to add more images. You can also drop image files directly onto the canvas. Each new image is added to the stack and can be independently positioned and styled.",
        icon: "plus",
      },
      {
        heading: "Tips",
        body: "• Use different serial colors for each image in a stack to quickly identify which is which\n• The Align button helps match two images using reference landmarks\n• Lowering opacity of the top image is the fastest way to visually compare two radiographs\n• Reset offset (⊙) snaps the image back to (0,0) if it gets lost off-screen",
        icon: "bulb",
      },
    ],
  },

  markups: {
    title: "Markups Guide",
    icon: "pencil",
    sections: [
      {
        heading: "What are markups?",
        body: "Markups are the annotations, landmarks, measurements, and drawings you place on the cephalometric image. There are 23 markup types including points, lines, angles, polygons, curves, ellipses, arcs, circles, beziers, tangents, text labels, arrows, and anatomical silhouettes.",
        icon: "book",
      },
      {
        heading: "Tool reference",
        items: [
          "Select/Move (V) — click to select, drag to move. Shift+click for multi-select, box drag for area select",
          "Pan (H) — drag to pan the canvas. Middle-mouse-button also pans in any tool",
          "Landmark (P) — click to place a point. Snap assistant highlights nearby existing points",
          "Line/Plane (L) — two points define a line. Switch between segment and infinite mode",
          "Angle 3-pt (3) — vertex then two arms. Angle 4-pt (4) — two lines define the angle",
          "Polygon (G) / Curve (C) — click points, double-click or switch tool to finalize. Ctrl+click to add, Shift+click to remove vertices",
          "Bezier (B) — place anchor points, control handles auto-generate. Ctrl+click adjusts control points",
          "Ruler (R) — draw a line of known length for calibration",
        ],
        icon: "gear",
      },
      {
        heading: "Markup properties",
        body: "Select a markup to see its properties in the Properties panel. You can rename, change color, adjust line width, toggle visibility, lock position, and (for polygons/curves) switch between linear and B-spline interpolation. Right-click any markup for the context menu with additional actions.",
        icon: "gear",
      },
      {
        heading: "Auto-measurements & ref labels",
        body: "When you load an analysis template, auto-created measurements appear as locked markups that reference placed landmarks via refLabels. When you move a referenced landmark, all dependent measurements update automatically. The refreshAutoMeas function ensures computed values (ratios, sums, differences) stay in sync.",
        icon: "link",
      },
      {
        heading: "Undo & snap",
        body: "Undo/Redo (Ctrl+Z/Y) supports up to 200 steps, covering markup moves, deletions, calibration changes, and formula edits. Snap mode (toggle in toolbar) attracts new points to existing landmarks within 12px — useful for consistent placement across sessions.",
        icon: "undo",
      },
    ],
  },

  calibration: {
    title: "Calibration Guide",
    icon: "ruler",
    sections: [
      {
        heading: "Why calibrate?",
        body: "Calibration tells the app the real-world scale of your radiograph. Without it, all linear measurements (lengths, distances, areas) are in pixels instead of millimeters. Calibration affects every downstream feature: norm comparisons, z-scores, research studies, and the PDF report.",
        icon: "target",
      },
      {
        heading: "Ruler method",
        body: 'Draw a line (R key) on the image between two points of known distance — typically the calibration ball or ruler included in the radiograph. Enter the real-world distance in mm. The app divides the pixel length by the known mm to compute pxPerMm. A ruler length of at least 10px is required for a valid calibration.',
        icon: "ruler",
      },
      {
        heading: "Manual method",
        body: 'Enter px/mm directly from DICOM metadata. Most DICOM files store PixelSpacing (0018,1164) in mm. For example, a value of 0.2 mm/pixel means 5 px/mm (1/0.2). This method is more accurate when DICOM metadata is available because it avoids ruler placement error.',
        icon: "keyboard",
      },
      {
        heading: "Important notes",
        body: '• 2D cephalometric radiographs carry ~8–15% inherent magnification — linear measurements calibrated from a 2D image are NOT directly comparable to CBCT-derived measurements.\n• Calibration is session-specific. Loading a new image resets calibration — you must recalibrate.\n• The ruler method is only as accurate as your ruler placement. Use the widest known-distance available.\n• Manual DICOM-based calibration is preferred when available: it eliminates ruler placement error.',
        icon: "warning",
      },
    ],
  },

  export: {
    title: "Export Guide",
    icon: "save",
    sections: [
      {
        heading: "Export formats",
        items: [
          "Measurements CSV — exports all current session measurements as a spreadsheet with measurement type, value, and unit columns",
          "Anonymized .cephx — (recommended) exports the full project with all PHI removed. Patient ID is replaced with ANON-xxx. Provenance hashes are NOT retained by default",
          "Full Project .cephx — exports everything including PHI. Only use for secure backups. A confirmation dialog warns when PHI is present",
          "PDF Report — generates a clinical-style PDF with cover page, images, measurements table, normograms, research studies, and interpretation sections",
          "Template .cepht — exports the current session's markup definitions as a reusable template. v1.0 = definitions only, v2.0 = with point coordinates",
        ],
        icon: "clipboard",
      },
      {
        heading: "When to use each format",
        items: [
          ".cephx (anonymized) — sharing with collaborators, publishing supplementary data, storing in a research repository",
          ".cephx (full) — personal backup, transferring between your own devices, archiving for medicolegal purposes",
          "PDF Report — presenting to patients, referring clinicians, or including in clinical notes",
          ".cepht template — creating reusable analysis templates for consistent landmark placement across cases",
          "CSV — importing measurement data into SPSS, Excel, or statistical software for further analysis",
        ],
        icon: "chart",
      },
    ],
  },

  startup: {
    title: "Getting Started Guide",
    icon: "play",
    sections: [
      {
        heading: "Quick start workflow",
        items: [
          "1. Select a projection type (Lateral Ceph, AP/PA, SMV, etc.) on the Home page",
          "2. Load a cephalometric image — drag & drop or use the file browser",
          "3. (Optional) Calibrate the image using the ruler tool or enter DICOM px/mm",
          "4. Load an analysis template (e.g., Steiner, Ricketts) to auto-create landmarks",
          "5. Place each landmark by clicking on the image — the app guides you through the list",
          "6. Review measurements, z-scores against norms, and the normogram visualization",
          "7. Export results as CSV, PDF report, or .cephx project file",
        ],
        icon: "note",
      },
      {
        heading: "Key concepts",
        items: [
          "Sessions — each patient visit or imaging event has its own session with markups and calibration",
          "Templates — pre-defined landmark sets for standard cephalometric analyses",
          "Calibration — essential for accurate mm measurements. Recalibrate for each image",
          "Markups — all annotations (points, lines, angles, curves) are stored as markups",
          "Norms — reference values for comparing measurements against population standards",
          "Research studies — formal analyses (reliability, comparative, longitudinal) using your data",
        ],
        icon: "sparkle",
      },
    ],
  },

  batchImport: {
    title: "Batch Import Guide",
    icon: "box",
    sections: [
      {
        heading: "What is batch import?",
        body: "Batch import lets you import multiple images at once and optionally attach metadata via a CSV sidecar file. This is the fastest way to set up a multi-session project for research — especially useful for reliability studies, longitudinal cohorts, and multi-patient datasets.",
        icon: "book",
      },
      {
        heading: "CSV sidecar format",
        items: [
          "CSV file should have one row per image, with columns matching session metadata fields",
          "The image filename column must match the actual image file names (without the file extension for matching)",
          "Supported metadata columns: patientId, age, sex, group, timepoint, operatorId, subjectId, trialNumber",
          "Rows without a matching image file are skipped. Images without a matching CSV row are imported with blank metadata",
          "CSV files must use RFC 4180 format — commas as separators, double-quotes for quoted fields, \\r\\n line endings",
        ],
        icon: "clipboard",
      },
      {
        heading: "Workflow",
        items: [
          "1. Prepare your images (PNG, JPEG, TIFF) and optional CSV sidecar in the same folder",
          "2. Click Batch Import from the Sessions panel toolbar",
          "3. Select the images first, then optionally select the CSV file",
          "4. Review the merged table — each row shows the image preview and parsed metadata",
          "5. Assign metadata to any images that don't have CSV rows using the editable cells",
          "6. Click Import — each image becomes a new session in the current project",
        ],
        icon: "refresh",
      },
      {
        heading: "Tips",
        body: "• File names in CSV are matched case-insensitively against image file names (without extension)\n• Maximum image size: 100 MB per file\n• The CSV parser handles quoted fields with embedded newlines — useful for multi-line notes fields\n• Metadata values can be bulk-assigned using the 'Set for selected' buttons after selecting rows",
        icon: "bulb",
      },
    ],
  },

  anonymization: {
    title: "Anonymization Guide",
    icon: "shield",
    sections: [
      {
        heading: "What is anonymization?",
        body: "Anonymization removes all patient-identifying information (PHI) from the project while preserving research-relevant structure. Patient identifiers are replaced with anonymous IDs, operator names are pseudonymized to 'Rater-N', and research labels (groups, timepoints) are kept intact.",
        icon: "book",
      },
      {
        heading: "What gets cleared",
        items: [
          "Project-level: patientId → ANON-xxx, patientName, DOB, age, clinician, facility, referral, notes",
          "Session-level: patientId, age, sex, subjectId per session",
          "Operator IDs: pseudonymized to Rater-1, Rater-2, etc. — preserving inter-rater reliability structure",
          "An audit log entry is appended recording: timestamp, operator, reason, and fields cleared",
        ],
        icon: "erase",
      },
      {
        heading: "What is kept",
        items: [
          "Research labels: group assignments, timepoint labels, trial numbers",
          "All markups, measurements, formulas, and norms — these are not PHI",
          "Calibration data and image processing settings",
          "Research study configurations and results (without patient identifiers)",
        ],
        icon: "check",
      },
      {
        heading: "Provenance hashes",
        body: "When enabled (opt-in), the anonymizer stores salted SHA-256 hashes of each original PHI value in the audit log. This lets an auditor later verify the original values without the app retaining them. The salt is NOT exported with the file, preventing rainbow-table attacks. Provenance is opt-in by default since v2.1.",
        icon: "key",
      },
    ],
  },

  lut: {
    title: "LUT Colorization Guide",
    icon: "palette",
    sections: [
      {
        heading: "What is a LUT?",
        body: "A Look-Up Table (LUT) maps each grayscale intensity (0–255) to a specific color. Applying a false-color LUT to a radiograph can reveal subtle density differences that are difficult to distinguish in grayscale alone. The image pixels are not modified — only the on-screen rendering is changed.",
        icon: "book",
      },
      {
        heading: "Controls",
        items: [
          "Legend — toggles the color bar overlay on the canvas showing the intensity-to-color mapping",
          "Invert — reverses the LUT direction (dark→light becomes light→dark), useful for viewing inverted radiographs",
          "Revert — resets to default Grayscale mode with invert off",
        ],
        icon: "sliders",
      },
      {
        heading: "Grayscale",
        body: "The default clinical view. Maps intensity directly to luminance (black→white). This is the standard for diagnostic radiology and should be used when making clinical measurements.",
        icon: "palette",
      },
      {
        heading: "Hot",
        body: "Black → red → yellow → white. Mimics a thermal camera palette. Low intensities appear dark, mid-range intensities appear red/orange, and high intensities appear yellow/white. Useful for highlighting areas of high bone density or metallic artifacts.",
        icon: "palette",
      },
      {
        heading: "Cool",
        body: "Cyan → blue → magenta. A blue-dominant palette that maps mid-range intensities to cool tones. Useful for soft tissue visualization where blue contrast against bone improves delineation.",
        icon: "palette",
      },
      {
        heading: "Jet",
        body: "Blue → cyan → green → yellow → red. The classic rainbow palette used widely in medical imaging. High contrast between adjacent intensity ranges makes it excellent for identifying density transitions — for example, the boundary between bone and airway. Can be visually overwhelming for continuous gradients.",
        icon: "palette",
      },
      {
        heading: "Viridis",
        body: "Dark purple → teal → green → yellow. A perceptually uniform colormap designed for scientific visualization. Equal steps in data produce equal steps in perceived color, making it ideal for quantitative density comparison. Perceptually uniform even when printed in grayscale or viewed by colorblind users.",
        icon: "palette",
      },
      {
        heading: "Magma",
        body: "Black → dark purple → magenta → orange → light yellow. A perceptually uniform palette from the matplotlib family. Similar to Inferno but with more magenta/pink in the mid-range, which improves contrast in soft tissue densities. Good for airway assessment.",
        icon: "palette",
      },
      {
        heading: "Inferno",
        body: "Black → dark purple → red → orange → yellow. A perceptually uniform palette with warm tones throughout. The strong red-to-orange transition makes it particularly effective for distinguishing cortical bone from trabecular bone and soft tissue.",
        icon: "palette",
      },
      {
        heading: "Cividis",
        body: "Dark blue → teal → sage → gold → yellow. Specifically designed for accessibility — it is optimized to be perceived identically by people with and without color vision deficiency (colorblindness). Use this when presenting to colleagues or in publications where accessibility is important.",
        icon: "access",
      },
      {
        heading: "Bone",
        body: "Black → blue-gray → white. A bi-tonal palette that mimics the appearance of X-ray film with a slight blue tint. The blue-gray mid-range improves the perception of soft tissue vs. bone boundaries compared to pure grayscale.",
        icon: "bone",
      },
      {
        heading: "Rainbow",
        body: "Red → yellow → green → cyan → blue → magenta. A full-spectrum hue cycle. Unlike Jet, it starts and ends at red, making it suitable for cyclic data. The wide hue range provides maximum visual contrast between adjacent intensity levels.",
        icon: "palette",
      },
      {
        heading: "Tips",
        body: "• Always revert to Grayscale before making clinical measurements — false colors can be misleading\n• Viridis/Magma/Inferno/Cividis are perceptually uniform: equal data intervals produce equal perceived color steps\n• Use Cividis for publications and presentations to ensure accessibility\n• Jet provides the highest visual contrast but can introduce artifacts at hue boundaries\n• The Legend toggle shows the color bar on the canvas for reference",
        icon: "bulb",
      },
    ],
  },

  interpretation: {
    title: "Interpretation Guide",
    icon: "clipboard",
    sections: [
      {
        heading: "What is the interpretation?",
        body: "The Interpretation panel generates automated clinical text descriptions for each measurement compared against its norm. It uses SD-banding: deviations within 1 SD are reported as 'within normal range', 1-2 SD as 'borderline', and >2 SD as 'abnormal'. Direction-specific notes are provided for key measurements like ANB (Class II/III).",
        icon: "book",
      },
      {
        heading: "How to read the output",
        items: [
          "Each deviation shows: measurement value, norm mean±SD, delta (difference from mean), and z-score",
          "Color coding: green (≤1 SD = normal), yellow (1-2 SD = borderline), red (>2 SD = abnormal)",
          "Pattern recognition: common clinical patterns (e.g., skeletal Class II, hyperdivergent) are detected across multiple measurements and reported as Combined Findings",
        ],
        icon: "chart",
      },
      {
        heading: "Editing interpretations",
        body: "Interpretations are auto-generated but can be overridden by clicking the edit icon on any entry. Custom edits are tracked separately and persist for the session. The original auto-generated text is replaced with your custom text in the PDF report.",
        icon: "pencil",
      },
    ],
  },

  normogram: {
    title: "Normogram Guide",
    icon: "trend",
    sections: [
      {
        heading: "What is a normogram?",
        body: "The Normogram visualises all measurement deviations in a single chart, making it easy to spot patterns at a glance. Each measurement is plotted as a point on an SD scale — its position relative to the center (0 SD = norm mean) shows how far the patient deviates from the reference.",
        icon: "book",
      },
      {
        heading: "Chart modes",
        items: [
          "Polygon chart (default) — measurements are connected by a polyline, creating a 'facial signature' pattern. The colored bands show ±1 SD (green), ±2 SD (yellow), and >2 SD (red) ranges",
          "Radar chart — measurements radiate from a center point, with SD rings. Good for spotting which measurements are most deviant",
          "Summary — text-only compact view showing each label, value, norm, and deviation",
          "Wiggle chart — horizontal bars showing the direction and magnitude of each deviation",
        ],
        icon: "chart",
      },
      {
        heading: "Reading the chart",
        items: [
          "Center line (0 SD) = exact norm mean. Points to the right are above the norm, points to the left are below",
          "Green zone (0 to ±1 SD) = within normal range. Yellow zone (±1 to ±2 SD) = borderline. Red zone (>±2 SD) = abnormal",
          "Each point is color-coded by severity. Hover or tap for detailed values",
          "The polygon pattern shape is characteristic of different malocclusion types — a steeply dipping pattern often indicates a specific skeletal pattern",
        ],
        icon: "eye",
      },
      {
        heading: "Exporting",
        body: "The normogram can be exported as SVG (vector graphic for publication), PNG (raster for reports), or CSV (raw deviation data for further analysis). Use the download buttons at the bottom of the panel.",
        icon: "save",
      },
    ],
  },

  measurements: {
    title: "Measurements Panel Guide",
    icon: "ruler",
    sections: [
      {
        heading: "Reading measurements",
        body: "Each measurement card shows the measurement name (e.g., length, angle, area) and its numeric value with the appropriate unit (mm, mm², px, px², or °). The unit reflects your calibration status — calibrated sessions show mm, uncalibrated show px.",
        icon: "book",
      },
      {
        heading: "Norms & deviation indicators",
        items: [
          "The ±N button next to each measurement opens the Norm Reference Gallery to add a norm comparison",
          "Once a norm is added, the card shows the deviation: green (≤1 SD = normal), yellow (1–2 SD = borderline), red (>2 SD = abnormal)",
          "Click the N button again to edit or delete the norm",
          "The Norms Reference Gallery has preset norms (Steiner, Ricketts, Downs, etc.) searchable by name or source",
          "You can also add custom norms by typing mean and SD directly",
        ],
        icon: "chart",
      },
      {
        heading: "Formula measurements",
        body: "Pinned formulas appear in the Measurements panel with a purple left border. Their values update in real-time as you move landmarks. The ±N button works the same way for formulas — you can add norm comparisons to formula results.",
        icon: "sigma",
      },
      {
        heading: "CSV export",
        body: "The ⬇ Export CSV button at the bottom exports all current measurements (including pinned formulas) to a CSV file compatible with Excel, SPSS, and R. The CSV includes columns for markup ID, type, label, pixel coordinates, measurement type, value, and unit (mm or px).",
        icon: "save",
      },
      {
        heading: "Calibration warning",
        body: "When the session is not calibrated, a prominent amber warning banner appears at the top of the panel. Linear measurements are shown in pixels (px) and norm comparisons for linear measurements are skipped. Angle measurements are unaffected by calibration.",
        icon: "warning",
      },
    ],
  },

  sessionMetadata: {
    title: "Session Metadata Guide",
    icon: "tag",
    sections: [
      {
        heading: "What is metadata?",
        body: "Session metadata assigns structured labels (patient ID, group, timepoint, operator, age, sex) to each session. Research modules use these labels to organise data for analysis. For example, the Comparative module groups sessions by their 'group' field, and the Longitudinal module tracks subjects across timepoints.",
        icon: "book",
      },
      {
        heading: "Metadata columns",
        items: [
          "Patient ID — a unique identifier linking sessions to the same patient. Used by the Reliability module to group sessions by case",
          "Group — assigns the session to a study arm (e.g., 'Treated', 'Control'). Used by the Comparative module",
          "Timepoint — the study visit or time label (e.g., 'T1', 'T2', '6mo'). Used by the Longitudinal module",
          "Operator — identifies who created the session. Used by Reliability (inter-rater) studies",
          "Subject ID — links sessions to subjects across timepoints. Used by Longitudinal studies",
          "Age / Sex — used for age/sex-stratified normative comparison. Toggle via the 'More Columns' button",
        ],
        icon: "tag",
      },
      {
        heading: "Bulk operations",
        items: [
          "Select multiple sessions using the checkboxes, then use the 'Set for selected' buttons to assign metadata in bulk",
          "The 'Parse Filenames' tool extracts metadata from image filenames using patterns like 'Patient42_T1_DrSmith.dcm'",
          "Group/Timepoint/Operator presets are managed via the modal buttons — add, remove, or rename values that appear in dropdowns",
        ],
        icon: "refresh",
      },
      {
        heading: "Tips",
        body: "• Metadata is stored per-session and persists when you duplicate sessions\n• The grouped/timepoint counts in the header show how many sessions have been assigned\n• Age/sex columns are hidden by default — click the 'More Columns' toggle to show them\n• The spreadsheet grid supports keyboard navigation: Tab moves to the next cell",
        icon: "bulb",
      },
    ],
  },

  superimposition: {
    title: "Superimposition Guide",
    icon: "shuffle",
    sections: [
      {
        heading: "What is superimposition?",
        body: "Superimposition overlays two cephalometric tracings to visualize and quantify positional changes over time (growth, treatment, or relapse). It computes per-landmark displacement vectors, angular changes, and linear measurement deltas between a base (T1) and comparison (T2) session.",
        icon: "book",
      },
      {
        heading: "Alignment methods",
        items: [
          "Procrustes — Uses ALL matching landmarks to compute optimal rotation, translation, and scale via Generalized Procrustes Analysis (Kabsch algorithm). No manual anchor points needed. Best when both sessions have a complete landmark set",
          "Structural — Select any two landmarks to define a reference plane. The source session is rotated (no scale/translation) so that plane aligns with the destination. Use this when you want the superimposition anchored on a specific anatomical structure, e.g. Sella–Nasion for cranial base registration",
          "2-Point — Manual alignment using two anchor landmarks. The source is translated, rotated, and scaled so the two anchor points exactly match the destination. Simple but sensitive to landmark placement error",
        ],
        icon: "gear",
      },
      {
        heading: "Output tabs",
        items: [
          "Displacements — Per-landmark distance (mm) and direction (degrees) from base to comparison. Color-coded: green (<2mm), yellow (2-5mm), red (>5mm)",
          "Angular — Changes in angle measurements (angle3/angle4 markups) between sessions. Positive = opening, negative = closing",
          "Linear — Changes in linear measurements (lines, rulers) between sessions. Shows delta and percent change",
        ],
        icon: "chart",
      },
      {
        heading: "Canvas overlay",
        body: "In the Sessions panel, click 'Overlay' next to a comparison session to render it semi-transparently on the canvas. The overlay alignment mode (2-Point / Procrustes / Structural) matches the same algorithms used in this research module.",
        icon: "image",
      },
      {
        heading: "Tips",
        body: "• Ensure both sessions have matching landmark labels — Procrustes and displacement vectors rely on label matching\n• The 'Matched' count in the header shows how many landmarks were found in both sessions\n• Centroid Size comparison reveals overall size change (scaling) independent of position\n• Use Procrustes for growth analysis where scale change is expected (e.g., T1→T2 in a growing patient)",
        icon: "bulb",
      },
    ],
  },

  airway: {
    title: "Airway Analysis Guide",
    icon: "lungs",
    sections: [
      {
        heading: "What is airway analysis?",
        body: "The Airway panel computes pharyngeal airway dimensions from lateral cephalometric landmarks. It evaluates retropalatal, retroglossal, and total airway spaces against normative data, and produces an OSA (Obstructive Sleep Apnea) risk score based on multi-measurement deviation analysis.",
        icon: "book",
      },
      {
        heading: "Quick start",
        items: [
          "Click 'Load Airway Template' to place all required landmarks at once",
          "Place each landmark on the lateral cephalogram by clicking on the image",
          "Calibrate the image (R key → draw ruler → enter known mm) for accurate measurements",
          "Review measurements, z-scores, and the OSA risk scorecard in the panel",
        ],
        icon: "play",
      },
      {
        heading: "Required landmarks",
        items: [
          "Core (10): PNS, N, PH, C3, H, Me, Go, SP, Eb, TT — enables 5 core measurements",
          "Advanced (9): SP_mid, Ba, Ad1, Ad2, Ad3, Ad4, Vallecula, Epiglottis, PAS_lowest — unlocks 9 additional measurements",
          "Click a landmark name in the grid to enter placing mode for that specific point",
          "Green checkmark = placed, amber warning = not yet placed, lock icon = advanced (requires core complete)",
        ],
        icon: "pin",
      },
      {
        heading: "14 airway measurements",
        items: [
          "Core (5): N-PH, R-PAS, MP-H, SP-Length, Tongue-Length",
          "Advanced (9): R-RG, SP-AW, PNS-AD1, PNS-AD2, MAS, IAS, Oropharyngeal Depth, Hyoid-C3, Mandibular Body",
          "Each measurement shows its source publication and age/sex-stratified norm ranges",
          "Core measurements cover OSA screening; advanced measurements provide detailed regional analysis",
        ],
        icon: "ruler",
      },
      {
        heading: "OSA Risk Scorecard",
        body: "The composite risk score aggregates all measurements into a single risk level: Low (green), Moderate (amber), or High (red). The score is based on the mean absolute z-score across all measurements and the count of critical (|z| > 2) values. This is a screening tool — polysomnography is the gold standard for OSA diagnosis.",
        icon: "warning",
      },
      {
        heading: "Airway overlay",
        body: "Toggle the 'Airway Overlay' checkbox to render the airway boundaries on the canvas. The overlay shows the anterior and posterior pharyngeal walls as colored curves. Use the 'Generate Smooth Airway Boundaries' button to auto-trace the airway outline using Catmull-Rom interpolation with boundary-snapping to image edges.",
        icon: "image",
      },
      {
        heading: "Normative data",
        body: "Measurements are compared against age/sex-stratified norms from published sources (Solow, McNamara, Schulhof, Pracharktam, Bibby, Lowe, Dempewolf). Each measurement shows its source publication. Set patient sex and age in session metadata for stratified comparisons. Without demographics, adult norms are used by default.",
        icon: "chart",
      },
      {
        heading: "Tips",
        body: "• R-PAS < 5mm is a strong indicator of severe retropalatal narrowing\n• MP-H is elevated in OSA patients — it reflects posterior tongue position\n• 2D cephalometric airway is an approximation — CBCT provides 3D volumetric analysis\n• Auto-generated boundaries are approximate — review and adjust curves if needed\n• Calibrate before placing landmarks for accurate mm-based measurements\n• The airway overlay uses orange color in compare mode to distinguish from the current session",
        icon: "bulb",
      },
    ],
  },
};

export default function PanelGuideModal({ t, guideKey, onClose }) {
  const guide = GUIDES[guideKey];
  if (!guide) return null;

  return (
    <Modal t={t} title={guide.title} onClose={onClose} customWidth={"60%"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {guide.sections.map((section, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon name={section.icon} size={16} color={t.acc} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{section.heading}</span>
            </div>

            {section.body && (
              <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.6, whiteSpace: "pre-wrap", marginLeft: 24 }}>{section.body}</div>
            )}

            {section.items && (
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 40, fontSize: 12, color: t.tx2, lineHeight: 1.8 }}>
                {section.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
