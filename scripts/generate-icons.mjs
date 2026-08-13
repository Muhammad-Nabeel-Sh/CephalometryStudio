// Generates PWA/OS icon assets from the pure-vector logo (public/favicon.svg).
// Run: node scripts/generate-icons.mjs  (or npm run icons)
import sharp from "sharp";
import { readFileSync } from "node:fs";

const LOGO_SVG = readFileSync(new URL("../public/favicon.svg", import.meta.url));
const BG = "#1a1a2e";
const VIEWBOX = 405; // favicon.svg viewBox is 0 0 405 405

async function rasterizeLogo(px) {
  const density = Math.ceil((px / VIEWBOX) * 96);
  return sharp(LOGO_SVG, { density })
    .resize(px, px)
    .png()
    .toBuffer();
}

async function makeIcon({ width, height, logoPx, out }) {
  const logo = await rasterizeLogo(logoPx);
  await sharp({
    create: {
      width, height, channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, left: Math.round((width - logoPx) / 2), top: Math.round((height - logoPx) / 2) }])
    .png()
    .toFile(out);
  console.log(`wrote ${out} (${width}x${height}, logo ${logoPx}px)`);
}

// ─── Home-screen / manifest icons ─────────────────────────────────────────────
await makeIcon({ width: 192, height: 192, logoPx: 150, out: "public/icon-192.png" });
await makeIcon({ width: 512, height: 512, logoPx: 400, out: "public/icon-512.png" });
// Maskable: keep the logo inside the 80% safe zone (0.56 x 512 ≈ 287)
await makeIcon({ width: 512, height: 512, logoPx: 288, out: "public/icon-512-maskable.png" });
await makeIcon({ width: 180, height: 180, logoPx: 140, out: "public/apple-touch-icon.png" });

// ─── iOS launch (splash) images — logo ~16% of the short edge ─────────────────
const SPLASHES = [
  [640, 1136],   // iPhone SE 1st gen      (320x568 @2x)
  [750, 1334],   // iPhone 6/7/8           (375x667 @2x)
  [828, 1792],   // iPhone XR/11           (414x896 @2x)
  [1170, 2532],  // iPhone 12/13/14        (390x844 @3x)
  [1290, 2796],  // iPhone 14/15 Pro Max   (430x932 @3x)
  [1536, 2048],  // iPad                   (768x1024 @2x)
  [2048, 2732],  // iPad Pro 12.9"         (1024x1366 @2x)
];
for (const [w, h] of SPLASHES) {
  const logoPx = Math.round(Math.min(w, h) * 0.16);
  await makeIcon({ width: w, height: h, logoPx, out: `public/splash-${w}x${h}.png` });
}

// ─── Social card (og-image) — logo + wordmark, fall back to logo-only ─────────
async function makeOgImage() {
  const logoPx = 330;
  const logo = await rasterizeLogo(logoPx);
  const logoLeft = Math.round((1200 - logoPx) / 2);
  const logoTop = 70;

  const textSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <g transform="translate(${logoLeft},${logoTop})"></g>
  <text x="600" y="505" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#e4e4ef">Cephalometry Studio</text>
  <text x="600" y="555" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#8b8ba1">Browser-based cephalometric analysis</text>
</svg>`);

  const base = {
    create: { width: 1200, height: 630, channels: 4, background: BG },
  };
  const out = { input: logo, left: logoLeft, top: logoTop };

  const withText = await sharp(Buffer.from(textSvg)).composite([out]).png().toBuffer();
  const noText = await sharp(base).composite([out]).png().toBuffer();

  // Verify the text actually rendered (fontconfig may not find a font).
  const a = await sharp(withText).stats();
  const b = await sharp(noText).stats();
  const diff = a.channels.reduce((s, c, i) => s + Math.abs(c.mean - b.channels[i].mean), 0);
  if (diff < 0.5) {
    console.log("og-image: text did not render (no font found) — writing logo-only card");
    await sharp(noText).toFile("public/og-image.png");
  } else {
    await sharp(withText).toFile("public/og-image.png");
  }
  console.log("wrote public/og-image.png (1200x630)");
}
await makeOgImage();
