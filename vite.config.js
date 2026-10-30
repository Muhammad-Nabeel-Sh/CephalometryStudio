import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

// Same-origin requests under a path prefix (for runtime caching rules).
const under = prefix => ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(prefix);

export default defineConfig({
  plugins: [
    react(),
    // Service worker (production builds only): the app shell is precached so the
    // app opens offline; the ONNX runtime and the PDF fonts are cached the first
    // time they are used. The landmark model has its own cache (storage/modelCache.js).
    VitePWA({
      registerType: "prompt",       // src/pwa.js asks before reloading into a new version
      injectRegister: false,
      manifest: false,              // public/site.webmanifest is kept as is
      workbox: {
        // wasm: the DICOM decoders (~400 KB) so DICOM files open offline too;
        // the AI runtime under /ort/ is excluded below and cached on use.
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,webmanifest,wasm}"],
        globIgnores: ["models/**", "ort/**", "fonts/**", "splash-*.png", "og-image.png", "contribute.html", "404.html"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/contribute\.html/, /^\/models\//, /^\/ort\//, /^\/fonts\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Runtime JS + wasm (~11 MB): fresh when online, cached copy offline.
          { urlPattern: under("/ort/"), handler: "NetworkFirst", options: { cacheName: "ort-runtime", expiration: { maxEntries: 8 } } },
          // Amiri / Noto Sans for the PDF report.
          { urlPattern: under("/fonts/"), handler: "CacheFirst", options: { cacheName: "report-fonts", expiration: { maxEntries: 8 } } },
        ],
      },
    }),
  ],
  worker: { format: "es" },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    // Results/ holds local AI training outputs (incl. a copy of the app).
    exclude: [...configDefaults.exclude, "Results/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/main.jsx", "src/pwa.js"],
      thresholds: {
        statements: 16,
        branches: 10,
        functions: 11,
        lines: 18,
      },
    },
  },
});
