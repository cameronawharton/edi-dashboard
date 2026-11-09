// Smoke test of the built app through the production platform adapter, Firestore faked in memory.
// Seeds from ../data/live (the artifact database snapshot; NOT in git). Visits every view at desktop and phone width,
// fails on any page error or horizontal scroll. Screenshots go to SHOTS (env) when set.
// Run: npm run build && node tests/app-smoke.mjs
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const live = root + "../data/live/";
const fake = (await build({ entryPoints: [root + "tests/fake-shim-entry.js"], bundle: true, format: "iife", write: false })).outputFiles[0].text;
const seed = {};
for (const col of readdirSync(live)) {
  if (!statSync(live + col).isDirectory()) continue;
  seed[col] = {};
  for (const f of readdirSync(live + col)) { const d = JSON.parse(readFileSync(live + col + "/" + f, "utf8")); seed[col][f.replace(/\.json$/, "")] = d.data || d; }
}
for (const t of Object.values(seed.team || {})) { delete t.photo; delete t.portrait; }

const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  if (p === "/shim.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(`window.__SEED=${JSON.stringify(seed)};window.__USER=${process.env.AS_USER ? JSON.stringify({ uid: process.env.AS_USER }) : "null"};\n${fake}`); }
  if (p === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("window.EDI_CONFIG={openRead:true};"); }
  if (p === "/sw.js") { res.writeHead(404); return res.end(); }
  const f = root + "public" + p; if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const views = (process.env.VIEWS || "overview,work,stats,brief,calendar,county,map,districts,facilities,team,me,projects,closed,data,insights").split(",");
const b = await chromium.launch();
let bad = 0;
for (const [w, h, label] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await p.goto(base + (process.env.START || "")); await p.waitForTimeout(1500);
  for (const v of views) {
    await p.evaluate((v) => (location.hash = v), v); await p.waitForTimeout(500);
    const len = await p.evaluate(() => document.querySelector("#view")?.innerText.length || 0);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    const flag = len < 200 || (label === "phone" && sw > w + 1);
    if (flag) bad++;
    console.log(`${flag ? "FAIL" : "ok  "} ${label} ${v} text=${len} width=${sw}`);
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${label}-${v}.png`, fullPage: label === "phone" });
  }
  if (errs.length) { bad++; console.log("PAGE ERRORS", label, errs.slice(0, 5)); }
  await p.close();
}
await b.close(); server.close();
if (bad) { console.log(bad + " problems"); process.exit(1); } else console.log("all views render");
