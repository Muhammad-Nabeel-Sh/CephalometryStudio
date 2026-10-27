// Interface fonts, bundled from npm (Fontsource) instead of loaded from Google
// Fonts: no request leaves the site (privacy), they work offline, and the CSP
// needs no third-party font hosts. Each file declares latin + latin-ext
// subsets with unicode-range, so the browser fetches only what a page uses.
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/400-italic.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
