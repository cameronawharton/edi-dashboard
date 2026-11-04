# Education Division Insight (EDI)

School inspection tracking for the Harris County Fire Marshal's Office (HCFMO) Prevention Bureau, Education Division.
Owner: Capt. Cameron Wharton. Started as a claude.ai Artifact (Oct 2026); this repo moves it to Firebase so the team
can install it on iOS, Android and desktop as a Progressive Web App.

Read this file first, then `docs/domain.md` before changing anything that touches inspections, coverage or the monthly board.

## How Cameron works (follow this)

- Direct, opinionated recommendations; no menus of hedged options. Numbers must hold up when questioned: say where each comes from.
- One decision at a time. Lock it, build it, then move on. He tests by using the app, then gives the next goal.
- No em dashes in UI copy or messages to him. Plain words, short sentences.
- Real records and people's photos never go in git (`data/` is ignored). The repo should be private.

## Layout

```
src/app.html            the whole app: markup, CSS, vanilla JS (about 2,050 lines). __GEO__ is replaced at build time.
src/geo_map.json        Harris County map geometry (Census TIGER: county, unified school districts, roads, water)
src/shim/platform.js    adapter that gives the app its backend API (see "Platform contract")
src/shim/firebase.js    Firebase Auth + Firestore wiring, sign-in screen, service worker registration
public/                 hosting root. build writes index.html and shim.js here
public/config.js        per-project Firebase config (gitignored; copied from config.example.js on first build)
public/vendor/          SheetJS 0.18.5 (reads Emergency Reporting .xls exports in the browser)
firestore.rules         role-based security rules (members/{uid} -> team/{id}.role)
scripts/build.mjs       build: inject geo, wrap page with PWA head, bundle shim (esbuild), copy photos
scripts/import-data.mjs load data/export/** into Firestore (emulator or production)
tests/                  platform.test.mjs (adapter), app-smoke.mjs (Playwright, whole app on a fake Firestore), rules.test.mjs
data/                   NOT IN GIT: export/ (records), photos/, source/ (original workbooks, ER exports), team-emails.json
```

Commands: `npm run build`, `npm test`, `npm run test:rules` (needs Java for the emulator), `npm run emulators`,
`npm run import:emulator`, `npm run import -- --project <id>`, `npm run deploy`.

## Platform contract

The app never imports Firebase. It calls `await window.claude.use("db" | "user" | "downloads")` (a name kept from the
Artifact runtime). `src/shim/platform.js` implements those on Firestore. The app depends on these exact semantics:

- `db.collection(path).onSnapshot(next, err)`; `db.doc(path).onSnapshot/get/set/update/delete`
- `update()` deep-merges nested maps: adding a visit is `update({visits: {[id]: rec}})`; voiding is `update({visits: {[id]: {voided: true}}})`.
- `update()` on a missing document rejects `{code: "invalid_argument"}`; callers then `set()` the full document (see `upsertLedger`, `saveVisits`, `saveManual`, `addLogEntry`).
- errors reject with `{code}`; the app shows "That change did not save (code)".
- `user.me()` -> `{id, name}`; `id` is the Firebase uid and is what `team/{id}.userId` stores.

If you change the adapter, run `node tests/platform.test.mjs` and `node tests/app-smoke.mjs`.

## Firestore data model

| Collection | Doc id | Contents |
|---|---|---|
| `orgs` | slug, e.g. `cy-fair-isd` | district or operator: `name, type (ISD/Charter/Private/Daycare), target, assignedTo (team id), assignLog {iso: {from,to,by}}, contacts[], notes, facilities {fid: {name, address, rotation A/B/C/ABC, status, lat, lng, since, flags[]}}` |
| `ledgers` | `<org>__<school year>` e.g. `klein-isd__2026-27` | `org, year, visits {vid: {facility, date, kind initial/reinspection, result pass/fail/partial/unknown, coi, inspector, source, erKey, voided}}` |
| `projects` | `prj-...` | active district projects: `name, org, kind, phase, permit, started, target, owner` |
| `team` | slug, e.g. `deanna-burciaga` | profile: `name, preferred, role captain/lieutenant/sergeant/inspector, field bool, unit, email, photo, portrait, userId, profile {tagline, banner}` |
| `members` | Firebase uid | `{team}`; written when someone claims a profile. Security rules read role through it |
| `er` | `<YYYY-MM>__<team id>` | one Emergency Reporting import (month x inspector): `rows[] {k,id,occ,addr,date,tin,tout,mins,add,type,row,coi,res,fac,org,rot}` |
| `stats` | `education-2026` | monthly board: `board {line: {MM: n}}` as hand-entered from the Excel workbook (Jan-Sep 2026), `manual {line: {MM: n}}`, `boardIssues[]` |
| `log` | `<team id>__<YYYY-MM>` | personal activity log: `entries {id: {date, k (board line), n, note, voided}}` |
| `config` | `settings`, `audit` | targets, rotation anchor, season months; workbook audit findings |
| `inbox` | any | items from outside feeds awaiting approval |
| `data/users/{uid}/pins` | | private pinned districts and schools |

## State at handoff (29 Oct 2026)

- Live data exported to `data/export/` from the Artifact: 90 orgs, 554 facilities (521 active), 256 visits (223 in 2025-26, 33 in 2026-27), 6 projects, September 2026 Emergency Reporting import (62 inspections, matches the hand count), team of 7.
- October 2026 exports (5 files, 72 inspections) are in `data/source/stat-tracking/` and were NOT yet imported. Import them in the app (Monthly stats > Import Emergency Reporting) after the data load. Expected: 8 new rotation visits, 10 skipped as already on file.
- Team emails in `data/team-emails.json`: four come from Emergency Reporting signatures; Isela.Regalado and Durrell.Kennedy follow the same pattern but are unverified. Confirm with Cameron before the first sign-in.

## Open items Cameron knows about (do not "fix" without him)

1. Sharing and live use with the team (this migration is that step).
2. District assignments: 72 of 90 districts/operators (every private, charter and daycare operator) have no inspector. He and Sgt. Regalado will assign them in the app (Team > District assignments; history is kept).
3. Active projects are incomplete; he is reviewing which are real. None of the 6 has a start date.
4. District-by-district sweeps to confirm every school in the county jurisdiction is listed. 28 active facilities have no map location, 9 no address. Two licensed daycares from October exports are missing: Bammel Middle Early Head Start (16711 Ella Blvd) and Katy ISD East Transportation Daycare (2901 Dulaney Rd).
5. Klein ISD "Vistas" has no rotation letter; may be an every-year facility.
6. 14 of 62 September inspections have no pass/fail in Emergency Reporting notes. Cameron may standardize a "Result:" line in reports.
7. Ten 2025-26 failures have no passing re-inspection on file (6 Tomball ISD campuses failed Apr 16-17, 3 Klein, 1 Galena Park). Offered: carry unresolved failures into the next year as "re-inspection owed". Not built.
8. Occupancy IDs typed wrong in Emergency Reporting: Momentum HS `387309721`, Jessie Lee Pumphrey Elem `387296346`, Aldine ISD CDC `FMO-1422 - 1`, Epps Island Elem `10869`.
9. Excel monthly workbook issues (I25 hard-coded, O6 #REF!, 2022 header dates, Prevention!C25 pulls the wrong Fireworks row). The app's board replaces the Education tab.

## Roadmap Cameron has stated (in his order)

1. Monthly statistics debrief from Emergency Reporting exports, Education first (done), then the other divisions: County Operations, Operational Permits, General Occupancies, SERG. The County Operations sergeant may adopt this next.
2. Team profiles and the inspector workflow: inspect in Emergency Reporting, then update the school in the app (status, pass/fail, time frames). Profiles done; personal activity log done.
3. School records: square footage, address, enrollment; later a school logo on hover. No photos of facilities (photos live in other systems).
4. Street-level map (TIGER roads per district, no satellite imagery).
5. Physical app for daily use on iOS, Android and desktop (this repo).

## Suggested next engineering steps

1. Create the Firebase project, run `npm run test:rules` (the rules have not been run against the emulator yet), deploy, import.
2. Gate UI by role (today any member sees edit buttons; the rules refuse the write and the app shows a toast).
3. Split `src/app.html` into modules (Vite) once the Firebase version is stable. Keep behavior identical; the smoke test is the safety net.
4. Store app wrappers (Capacitor) only if the PWA is not enough (push notifications on iOS work for installed PWAs on iOS 16.4+).
