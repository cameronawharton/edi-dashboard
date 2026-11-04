// App-shell service worker: the page opens offline; Firestore's own cache keeps the records.
// Bump VERSION on every deploy that changes index.html or shim.js (scripts/build.mjs does not do this for you).
const VERSION = "edi-v1";
const SHELL = ["./", "index.html", "shim.js", "config.js", "manifest.webmanifest", "vendor/xlsx.full.min.js", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Firebase, fonts, map tiles go straight to the network
  // network first for the page so updates arrive; cache fallback when offline
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match("index.html"))));
});
