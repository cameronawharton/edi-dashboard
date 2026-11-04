// Load the data export (data/export/<collection>/<doc id>.json) into Firestore.
//
//   Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/import-data.mjs --project demo-edi
//   Production: gcloud auth application-default login   (or GOOGLE_APPLICATION_CREDENTIALS=service-account.json)
//               node scripts/import-data.mjs --project <your-project-id>
//
// Options: --only orgs,ledgers   import only some collections
//          --dry                 count what would be written, write nothing
// Team docs: sign-in links from the old Claude version (userId/accountName/linkedAt) are cleared so people
// claim their profile fresh; work emails come from data/team-emails.json when present.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const projectId = arg("--project") || process.env.GCLOUD_PROJECT;
if (!projectId) { console.error("Pass --project <id>"); process.exit(1); }
const only = arg("--only") ? arg("--only").split(",") : null;
const dry = args.includes("--dry");
const root = new URL("..", import.meta.url).pathname;
const dir = root + "data/export";
if (!existsSync(dir)) { console.error("No data/export folder. Unzip the data bundle inside the repo folder."); process.exit(1); }

initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore();
const emails = existsSync(root + "data/team-emails.json") ? JSON.parse(readFileSync(root + "data/team-emails.json", "utf8")) : {};

let total = 0;
for (const col of readdirSync(dir)) {
  if (only && !only.includes(col)) continue;
  const files = readdirSync(`${dir}/${col}`).filter((f) => f.endsWith(".json"));
  let batch = db.batch(), n = 0;
  for (const f of files) {
    const raw = JSON.parse(readFileSync(`${dir}/${col}/${f}`, "utf8"));
    const data = raw && raw.data && raw.id ? raw.data : raw; // exports keep {id, data, version}; plain docs also accepted
    const id = f.slice(0, -5);
    if (col === "team") { delete data.userId; delete data.accountName; delete data.linkedAt; if (emails[id]) data.email = emails[id]; }
    if (!dry) batch.set(db.collection(col).doc(id), data);
    n++; total++;
    if (n % 400 === 0 && !dry) { await batch.commit(); batch = db.batch(); }
  }
  if (!dry) await batch.commit();
  console.log(`${dry ? "would write" : "wrote"} ${String(n).padStart(4)}  ${col}`);
}
console.log(`${total} documents ${dry ? "counted" : "imported"} into ${projectId}${process.env.FIRESTORE_EMULATOR_HOST ? " (emulator)" : ""}`);
