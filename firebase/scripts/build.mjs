// Build the installable app from the current dashboard.
//   1) python3 dashboard/build.py   -> dist/tracker.html (the same page published as the Claude artifact)
//   2) node firebase/scripts/build.mjs
//        dist/tracker.html  -> public/index.html (wrapped with PWA tags, config and the Firebase shim)
//        src/shim/firebase.js -> public/shim.js
//        dist/logos, dist/streets -> public/ (district logos and street maps, both public data)
//        public/sw.js with a fresh version, so installed copies pick up each deploy
// Real records never pass through here: they load into Firestore from the data bundle (see README).
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, copyFileSync } from "node:fs";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const r = (p) => root + p;
const dist = r("../dist/");
if (!existsSync(dist + "tracker.html")) { console.error("Run python3 dashboard/build.py first (dist/tracker.html is missing)."); process.exit(1); }

await build({ entryPoints: [r("src/shim/firebase.js")], bundle: true, format: "iife", minify: true, target: "es2020", outfile: r("public/shim.js"), logLevel: "warning" });

const version = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const claudeMsg = "This page keeps its records in a shared database that loads when it is opened in Claude by a signed-in member of the team.";
const app = readFileSync(dist + "tracker.html", "utf8")
  .replace(claudeMsg, "The app is published and waiting on its database. Records load once the Firebase project is connected.");
const head = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111518">
<meta name="robots" content="noindex,nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Insight">
<meta name="edi-version" content="${version}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/favicon-64.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script src="config.js"></script>
<script src="shim.js"></script>
<style>html,body{margin:0}[hidden]{display:none!important}</style>
</head><body>
`;
writeFileSync(r("public/index.html"), head + app + "\n</body></html>\n");

for (const d of ["logos", "streets"]) if (existsSync(dist + d)) cpSync(dist + d, r("public/" + d), { recursive: true });

writeFileSync(r("public/sw.js"), `// Offline shell. Network first so every deploy shows up right away; the last copy is used when there is no signal.
const VERSION = "${version}";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => { const c = res.clone(); caches.open(VERSION).then((ca) => ca.put(e.request, c)); return res; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html"))));
});
`);

if (!existsSync(r("public/config.js"))) {
  if (existsSync(r("config.public.js"))) copyFileSync(r("config.public.js"), r("public/config.js"));
  else copyFileSync(r("public/config.example.js"), r("public/config.js"));
}
mkdirSync(r("public/icons"), { recursive: true });
console.log("built public/index.html (" + Math.round(readFileSync(r("public/index.html")).length / 1024) + " KB), shim.js, sw.js, version " + version);
