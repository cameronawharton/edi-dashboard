// Build: src/app.html (+ geo data) -> public/index.html, src/shim/firebase.js -> public/shim.js
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const r = (p) => root + p;

// 1) bundle the Firebase shim (classic script, runs before the app)
await build({ entryPoints: [r("src/shim/firebase.js")], bundle: true, format: "iife", minify: true, target: "es2020", outfile: r("public/shim.js"), logLevel: "warning" });

// 2) page: inject map geometry, wrap in a full document with PWA tags
const app = readFileSync(r("src/app.html"), "utf8").replace("__GEO__", readFileSync(r("src/geo_map.json"), "utf8"));
const head = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111518">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="EDI">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/favicon-64.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script src="config.js"></script>
<script src="shim.js"></script>
<style>html,body{margin:0}[hidden]{display:none!important}</style>
</head><body>
`;
writeFileSync(r("public/index.html"), head + app + "\n</body></html>\n");

// 3) team photos live outside git (data/photos); copy them in when present
if (existsSync(r("data/photos"))) {
  mkdirSync(r("public/team"), { recursive: true });
  for (const f of readdirSync(r("data/photos"))) copyFileSync(r("data/photos/" + f), r("public/team/" + f));
}
// 4) config.js must exist (copied from the example on first build)
if (!existsSync(r("public/config.js"))) copyFileSync(r("public/config.example.js"), r("public/config.js"));
console.log("built public/index.html (" + Math.round(readFileSync(r("public/index.html")).length / 1024) + " KB) and public/shim.js");
