// Security rules tests. Needs the Firestore emulator (Java 11+):  npm run test:rules
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let env;
const team = {
  "cameron-wharton": { name: "Cameron Wharton", role: "captain", email: "Cameron.Wharton@fmo.hctx.net" },
  "isela-regalado": { name: "Isela Regalado", role: "sergeant", email: "Isela.Regalado@fmo.hctx.net" },
  "deanna-burciaga": { name: "Deanna Burciaga", role: "inspector", email: "Deanna.Burciaga@fmo.hctx.net" },
  "donald-hewett": { name: "Donald Hewett", role: "inspector", email: "Donald.Hewett@fmo.hctx.net" },
};
const as = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();

before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-edi", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [id, t] of Object.entries(team)) await setDoc(doc(db, "team", id), t);
    await setDoc(doc(db, "members", "capt"), { team: "cameron-wharton" });
    await setDoc(doc(db, "members", "sgt"), { team: "isela-regalado" });
    await setDoc(doc(db, "members", "deanna"), { team: "deanna-burciaga" });
    await setDoc(doc(db, "orgs", "klein-isd"), { name: "Klein ISD", type: "ISD", assignedTo: "deanna-burciaga", facilities: {} });
    await setDoc(doc(db, "ledgers", "klein-isd__2026-27"), { org: "klein-isd", year: "2026-27", visits: {} });
  });
});

test("strangers and non-county emails get nothing", async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "orgs/klein-isd")));
  await assertFails(getDoc(doc(as("x", "x@gmail.com"), "team/cameron-wharton")));
});
test("a county address can read the roster but not records until it claims a profile", async () => {
  const db = as("donald", "Donald.Hewett@fmo.hctx.net");
  await assertSucceeds(getDoc(doc(db, "team/donald-hewett")));
  await assertFails(getDoc(doc(db, "orgs/klein-isd")));
});
test("claiming only works for the profile with your email", async () => {
  const db = as("donald", "Donald.Hewett@fmo.hctx.net");
  await assertFails(setDoc(doc(db, "members/donald"), { team: "cameron-wharton" }));
  await assertSucceeds(setDoc(doc(db, "members/donald"), { team: "donald-hewett" }));
  await assertSucceeds(updateDoc(doc(db, "team/donald-hewett"), { userId: "donald", accountName: "Donald", linkedAt: "x" }));
  await assertFails(updateDoc(doc(db, "team/donald-hewett"), { role: "captain" }));
  await assertSucceeds(getDoc(doc(db, "orgs/klein-isd")));
});
test("inspectors log visits but cannot reassign districts or touch imports", async () => {
  const db = as("deanna", "Deanna.Burciaga@fmo.hctx.net");
  await assertSucceeds(updateDoc(doc(db, "ledgers/klein-isd__2026-27"), { "visits.v1": { date: "2026-10-01", result: "pass" } }));
  await assertSucceeds(updateDoc(doc(db, "orgs/klein-isd"), { notes: "gate code changed" }));
  await assertFails(updateDoc(doc(db, "orgs/klein-isd"), { assignedTo: "donald-hewett" }));
  await assertFails(setDoc(doc(db, "er/2026-10__deanna-burciaga"), { rows: [] }));
  await assertFails(deleteDoc(doc(db, "ledgers/klein-isd__2026-27")));
});
test("activity logs: your own month only, unless you are a sergeant or above", async () => {
  const d = as("deanna", "Deanna.Burciaga@fmo.hctx.net");
  await assertSucceeds(setDoc(doc(d, "log/deanna-burciaga__2026-10"), { member: "deanna-burciaga", month: "2026-10", entries: {} }));
  await assertFails(setDoc(doc(d, "log/donald-hewett__2026-10"), { member: "donald-hewett", month: "2026-10", entries: {} }));
  await assertSucceeds(setDoc(doc(as("sgt", "Isela.Regalado@fmo.hctx.net"), "log/donald-hewett__2026-10"), { member: "donald-hewett", month: "2026-10", entries: {} }));
});
test("sergeant imports and reassigns; only the captain edits roles and settings", async () => {
  const s = as("sgt", "Isela.Regalado@fmo.hctx.net"), c = as("capt", "Cameron.Wharton@fmo.hctx.net");
  await assertSucceeds(setDoc(doc(s, "er/2026-10__deanna-burciaga"), { rows: [] }));
  await assertSucceeds(updateDoc(doc(s, "orgs/klein-isd"), { assignedTo: "donald-hewett" }));
  await assertFails(updateDoc(doc(s, "team/deanna-burciaga"), { role: "sergeant" }));
  await assertFails(setDoc(doc(s, "config/settings"), { yearStartMonth: 8 }));
  await assertSucceeds(updateDoc(doc(c, "team/deanna-burciaga"), { role: "sergeant" }));
  await assertSucceeds(setDoc(doc(c, "config/settings"), { yearStartMonth: 8 }));
});
test("pins are private to each person", async () => {
  await assertSucceeds(setDoc(doc(as("deanna", "Deanna.Burciaga@fmo.hctx.net"), "data/users/deanna/pins"), { orgs: [], facs: [] }));
  await assertFails(getDoc(doc(as("sgt", "Isela.Regalado@fmo.hctx.net"), "data/users/deanna/pins")));
});
