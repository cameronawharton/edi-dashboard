// Checks the adapter keeps the semantics the app relies on. Run: node tests/platform.test.mjs
import assert from "node:assert/strict";
import { makeFakeFirestore } from "./fake-firestore.js";
import { makePlatform } from "../src/shim/platform.js";

const F = makeFakeFirestore({ ledgers: { "x__2026-27": { org: "x", year: "2026-27", visits: { a: { date: "2026-10-01", result: "pass" } } } } });
const P = makePlatform(F, { currentUser: () => ({ uid: "u1", email: "a@fmo.hctx.net", displayName: "A" }) });

// update deep-merges a nested map entry without touching siblings
await P.db.doc("ledgers/x__2026-27").update({ visits: { b: { date: "2026-10-02", result: "fail" } } });
let d = (await P.db.doc("ledgers/x__2026-27").get()).data();
assert.equal(Object.keys(d.visits).length, 2); assert.equal(d.visits.a.result, "pass"); assert.equal(d.org, "x");
// nested partial update (void a visit) keeps other fields of that visit
await P.db.doc("ledgers/x__2026-27").update({ visits: { a: { voided: true } } });
d = (await P.db.doc("ledgers/x__2026-27").get()).data();
assert.equal(d.visits.a.voided, true); assert.equal(d.visits.a.date, "2026-10-01");
// update on a missing doc rejects with invalid_argument (the app then calls set with the full shape)
await assert.rejects(P.db.doc("ledgers/y__2026-27").update({ visits: {} }), (e) => e.code === "invalid_argument");
// set replaces
await P.db.doc("stats/education-2026").set({ year: 2026, manual: { site: { "10": 4 } } });
await P.db.doc("stats/education-2026").update({ manual: { site: { "11": 2 } } });
d = (await P.db.doc("stats/education-2026").get()).data();
assert.deepEqual(d.manual.site, { "10": 4, "11": 2 });
// collection snapshots see new docs
const seen = await new Promise((res) => { const un = P.db.collection("ledgers").onSnapshot((s) => { if (s.docs.length) { un(); res(s.docs.map((x) => x.id)); } }); });
assert.deepEqual(seen, ["x__2026-27"]);
// 4-segment private doc path works
await P.db.doc("data/users/u1/pins").set({ orgs: ["a"], facs: [] });
assert.equal((await P.db.doc("data/users/u1/pins").get()).exists, true);
// user
assert.deepEqual(await P.user.me(), { id: "u1", name: "A", email: "a@fmo.hctx.net" });
console.log("platform adapter: all checks passed");
