// End-to-end smoke test of the built app through the production platform adapter (Firestore faked in memory).
// Needs: npm run build, data/export (data bundle), data/source/stat-tracking (Emergency Reporting exports).
// Run: node tests/app-smoke.mjs
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const fake = (await build({ entryPoints: [root + "tests/fake-shim-entry.js"], bundle: true, format: "iife", write: false })).outputFiles[0].text;
const seed = {};
for (const col of readdirSync(root + "data/export")) { seed[col] = {}; for (const f of readdirSync(`${root}data/export/${col}`)) { const r = JSON.parse(readFileSync(`${root}data/export/${col}/${f}`, "utf8")); seed[col][f.slice(0, -5)] = r.data && r.id ? r.data : r; } }
const emails = JSON.parse(readFileSync(root + "data/team-emails.json", "utf8"));
for (const [id, t] of Object.entries(seed.team || {})) { delete t.userId; delete t.accountName; delete t.linkedAt; t.email = emails[id]; }

const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  if (p === "/shim.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(`window.__SEED=${JSON.stringify(seed)};\n${fake}`); }
  if (p === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("window.EDI_CONFIG={};"); }
  const f = root + "public" + p; if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.route("**/fonts.googleapis.com/**", (r) => r.abort());
const ok = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

await p.goto(base + "#overview"); await p.waitForTimeout(1200);
ok(await p.isVisible(".prog"), "overview renders from the export");
ok((await p.textContent("#mechip")).includes("Choose your profile"), "identity chip asks to choose a profile");
await p.click("#mechip"); await p.click('[data-act="claim"][data-team="cameron-wharton"]'); await p.waitForTimeout(500);
ok((await p.textContent("#mechip")).includes("Cameron Wharton"), "claim links the profile");
ok(await p.evaluate(() => __FAKE.store.get("members/u_test")?.team === "cameron-wharton"), "claim writes members/{uid} for the security rules");

const dir = root + "data/source/stat-tracking/";
const oct = ["Inspection 1.xls", "Inspections 2.xls", "Inspections 3.xls", "Inspections 4.xls", "Completed Inspections for Inspectors per Inspection Type for Date Range (25).xls"].map((f) => dir + f);
await p.evaluate(() => (location.hash = "stats")); await p.waitForTimeout(400);
await p.click('.sthead [data-act="er-import"]'); await p.setInputFiles("#erfiles", oct); await p.waitForTimeout(1500);
const n = await p.evaluate(() => ERI.files.reduce((s, f) => s + f.rows.length, 0));
ok(n === 72, `October exports parse to 72 inspections (got ${n})`);
await p.click('[data-act="er-save"]'); await p.waitForTimeout(800);
ok(await p.evaluate(() => [...__FAKE.store.keys()].filter((k) => k.startsWith("er/2026-10__")).length === 5), "five October import documents written");
const added = await p.evaluate(() => Object.values(__FAKE.store.get("ledgers/cy-fair-isd__2026-27")?.visits || {}).filter((v) => v.source === "Emergency Reporting").length);
ok(added >= 2, `rotation visits added to Cy-Fair ISD (${added})`);

await p.evaluate(() => (location.hash = "me")); await p.waitForTimeout(400);
await p.selectOption("#lg-kind", "site"); await p.fill("#lg-n", "2"); await p.click('[data-act="log-add"]'); await p.waitForTimeout(400);
ok(await p.evaluate(() => Object.keys(__FAKE.store.get("log/cameron-wharton__" + new Date().toISOString().slice(0, 7))?.entries || {}).length === 1), "activity log entry written to log/{team}__{month}");

await p.evaluate(() => (location.hash = "team")); await p.waitForTimeout(400);
const oid = await p.getAttribute("[data-assign]", "data-assign");
await p.selectOption(`[data-assign="${oid}"]`, "deanna-burciaga"); await p.waitForTimeout(400);
ok(await p.evaluate((o) => __FAKE.store.get("orgs/" + o).assignedTo === "deanna-burciaga" && Object.keys(__FAKE.store.get("orgs/" + o).assignLog || {}).length === 1, oid), "assignment change saved with history");

await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no horizontal scroll at phone width");
ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close(); server.close();
