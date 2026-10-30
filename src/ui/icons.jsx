// ═══════════════════════════════════════════════════════════════════════════════
// LINE ICONS — small outline icons in the style of the panel icons
// (24 px grid, 2 px round stroke, currentColor). Used in place of emoji.
// ═══════════════════════════════════════════════════════════════════════════════
const P = {
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.6-1.7" /></>,
  shield: <path d="M12 3l7 3v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6z" />,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h7" /><path d="M9 17h5" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  pause: <><path d="M9 5v14" /><path d="M15 5v14" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  pin: <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5" /><path d="M12 12v9" /></>,
  bone: <path d="M8.5 5.5a2.5 2.5 0 1 0-3 3l10 10a2.5 2.5 0 1 0 3-3 2.5 2.5 0 1 0-3-3l-4-4a2.5 2.5 0 1 0-3-3z" />,
  tooth: <path d="M7 3C5 3 4 5 4 7c0 3 1 5 2 8s1 6 3 6 1.5-5 3-5 1 5 3 5 2-3 3-6 2-5 2-8c0-2-1-4-3-4s-3 1-5 1-3-1-5-1z" />,
  lungs: <><path d="M12 4v7" /><path d="M12 9c-1 1.4-2.3 2-4 2" /><path d="M12 9c1 1.4 2.3 2 4 2" /><path d="M8.5 7C5.5 8 4 12 4 16c0 2 1 3 3 3s3-1 3-3V9" /><path d="M15.5 7c3 1 4.5 5 4.5 9 0 2-1 3-3 3s-3-1-3-3V9" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /></>,
  bulb: <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>,
  book: <><path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" /><path d="M5 20a2 2 0 0 0 2 1h12v-3" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" /><path d="M20 3.5v5h-5" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 8" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-.8 2-1.8 0-1.2-1-1.6-1-2.6 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" /></>,
  cursor: <path d="m5 3 14 7-6 2-2 6z" />,
  library: <><path d="M3 9l9-5 9 5" /><path d="M5 9v9M10 9v9M14 9v9M19 9v9" /><path d="M3 20h18" /></>,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5 20 18M8.5 16.5 20 6" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  ruler: <><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></>,
  trend: <><path d="M4 4v16h16" /><path d="m7 15 4-4 3 3 5-6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sigma: <path d="M17 6V5H7l5 7-5 7h10v-1" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" /></>,
  warning: <><path d="M12 3 21.5 20h-19z" /><path d="M12 10v4M12 17h.01" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3" /><rect x="8" y="13" width="8" height="8" /></>,
  play: <path d="m7 4 13 8-13 8z" />,
  sparkle: <path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  shuffle: <><path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></>,
  scale: <><path d="M12 3v18M6 21h12M4 8h16" /><path d="M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z" /></>,
  hospital: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 7v6M9 10h6" /></>,
  access: <><circle cx="12" cy="4.5" r="1.5" /><path d="m5 8 7 2 7-2M12 10v4M9 21l3-7 3 7" /></>,
  erase: <><path d="M20 4 10 14" /><path d="m7 13 4 4-3 4H4l-1-4z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  checksquare: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  upload: <><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 19h16" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
};



export function Icon({ name, size = 16, color = "currentColor", style, title }) {
  const body = P[name];
  if (!body) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      role={title ? "img" : undefined} aria-hidden={title ? undefined : "true"} aria-label={title}
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
