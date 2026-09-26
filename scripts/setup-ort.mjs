// Copies the onnxruntime-web runtime from node_modules into public/ort/ so the
// detection Web Worker can load it offline from a same-origin URL.
//
//   npm install onnxruntime-web
//   npm run setup:ort
//
// Then set ortUrl: "/ort/ort.min.js" + wasmPaths: "/ort/" in
// src/data/landmarkModelInfo.js (already the defaults).

import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules", "onnxruntime-web", "dist");
const dest = resolve(root, "public", "ort");

if (!existsSync(src)) {
  console.error(
    "onnxruntime-web not found. Install it first:\n\n  npm install onnxruntime-web\n",
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const files = readdirSync(dest).filter((f) => f.endsWith(".js") || f.endsWith(".wasm") || f.endsWith(".mjs"));
console.log(`Copied ${files.length} runtime file(s) to public/ort/`);
for (const f of files) console.log(`  ${f}`);
console.log('\nSet ortUrl: "/ort/ort.min.js" and wasmPaths: "/ort/" in src/data/landmarkModelInfo.js');
