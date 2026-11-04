# CO/ED Division Insight (formerly Education Division Insight, EDI)

School inspection and monthly prevention statistics dashboard for the Harris County Fire Marshal's Office (HCFMO), Prevention Bureau, County Operations and Education (CO/ED) Division. Renamed Nov 4 2026; build.py swaps the name in base.html. Owner: Capt. Cameron Wharton.

Live today as a claude.ai Artifact: **https://claude.ai/artifact/G97SvvhwHuddo6Ve8Bcy5n** (private, shared by Cameron from its Share menu). Its data lives in that artifact's database, not in this repo.

Read this file, then `docs/roles.md` (who sees what, decided Nov 3 2026), then `docs/domain.md` before touching inspections, coverage or the board.

## How Cameron works (follow this)

- Direct, opinionated recommendations, not menus of hedged options. Every number must hold up when questioned: say where it comes from.
- One decision at a time. Lock it, build it, ship it, then the next. He tests by using the page.
- No em dashes anywhere: UI copy, commit messages, replies. Plain words, short sentences.
- He often works from his phone. Keep replies short and give steps he can do in a phone browser.
- Real records and people's photos never go in git. `data/` is ignored. The repo is private.

## Layout

```
dashboard/base.html        the original single-file app (markup, CSS, JS). Treat as read-only: change it through hooks in build.py
dashboard/parts/           modules spliced in at build time (CSS and JS, concatenated in the order build.py lists)
  stats.js/.css            Emergency Reporting (ER) import, the monthly board, outcomes, hours panel, uploads grid
  detail.js/.css           district logos, street maps around schools, tap-to-call/email (telHref)
  people.js/.css           team, profiles, header identity chip, divisions, district assignments
  actions.js               action codes: board mapping, inspection assist check, report detail modal
  county.js/.css           County facilities page (#county): FSS owners, inspection months, county map with Downtown zoom, unassigned buildings
  command.js/.css          supervisor "Needs attention" panel, flag explain/accept/send back, Command summary page + print
dashboard/build.py         splices parts into base.html via exact-match rep() hooks, injects assets/geo_map.json -> dist/tracker.html
dashboard/harness.py       dist/test.html (data/seed) or dist/live.html (data/live) with a fake database for Playwright
dashboard/tests/           smoke.js (every view, fails on page errors), mock_head.html (fake db + claude.use shim)
dashboard/assets/          geo_map.json (Census TIGER), logos/<org>/, streets/<org>.json. Published next to the page
tools/er/                  Python parsers proven on October 2026: inspection report PDFs, action-code report PDF, reconcile, assist check
firebase/                  Firebase/PWA port started Oct 29, then tabled. Its src/app.html is STALE (predates stats, actions, command).
                           When the app move happens, regenerate it from dist/tracker.html; keep its shim, rules and build.
docs/                      roles.md (role decisions), domain.md (inspection rules)
data/  (not in git)        seed/ and live/ database snapshots for local testing
dist/  (not in git)        build output
```

`build.py` asserts every hook matches exactly once. If base.html text a hook targets is missing, the build stops: fix the hook, never loosen the assert.

## Build, test, publish

```
python3 dashboard/build.py                      # dist/tracker.html (+ logos/, streets/)
python3 dashboard/harness.py live               # dist/live.html from data/live
node dashboard/tests/smoke.js live              # Playwright; needs `playwright` resolvable (NODE_PATH=$(npm root -g))
```
Refresh `data/live` before testing against real data: ArtifactData `list` each collection with `out_dir: data/live` (collections below).
Publish: Artifact publish `file_path: dist/tracker.html` with `url` set to the artifact above. Team photos (`team/*.jpg`) are already published on the artifact and are kept between publishes; don't remove them.
Screenshot what you changed before publishing. Check a printed page with `page.pdf` when touching print styles (Command summary must stay one letter page).

## Data (artifact database collections)

| collection | doc id | holds |
|---|---|---|
| orgs | org slug | district/operator: name, type (ISD, Charter, Private, Daycare), facilities, contacts[{role,name,phone,email}], assignedTo, logo |
| ledgers | `<org>__<season>` e.g. `klein-isd__2026-27` | visits {id: {facility,date,kind,result,coi,inspector,source,erKey,...}} |
| er | `<YYYY-MM>__<member>` | one inspector's month from the ER export: rows[{k,id,occ,addr,city,date,tin,tout,mins,add,type,row,coi,res,fac,org,rot, src,rt,fl,nx,po}] |
| actions | `<YYYY-MM>__<member>` | action-code entries: rows[{c,cn,id,occ,addr,date,desc,h,hs}] |
| flags | `<YYYY-MM>__<member>__<date>__<occ>__<hash>` | assist flag review: note, noteBy, status (explained, accepted, sentback), reviewBy |
| stats | `<division>-<year>` | board as entered (board.k.MM), manual entries (manual.k.MM), days worked (days.member.MM), boardIssues |
| team | person slug | name, preferred, role (captain, lieutenant, sergeant, inspector, specialist), division (education, county), field, unit, userId, photo |
| log | `<member>__<YYYY-MM>` | activity log entries. RETIRED as an input (Nov 3): everything goes through ER |
| cfac | building slug (`oce-` prefix = on the OCE map only) | county building: name, address, city, zip, section, fss (member id or null), sqft, bda, systems, brands, annualMonth, semiMonth (1-12), monthsReview, src (fss/oce), oce {program, region, pct, use, year}, lat, lng, ownerLog |
| projects, config, inbox | | construction projects, settings, intake |

Write with ArtifactData. Pin `if_version` on every existing doc. Prefer one `batch` per change. When importing, run the app's own logic (erPlan, renderERI, erSave) in the harness and write the docs it produces, instead of hand-building records.

## Rules that are settled

- **Season** runs Aug 1 to May 31. **No rotation (Nov 4 2026):** with four inspectors, every ISD campus, charter, private and daycare is due every season, target 100%. build.py forces settings().targets to 1 and target(org) to 1, makes every active facility required, and hides rotation letters, chips and columns. The rotation letter data stays on facilities but is not used.
- **ER export** ("Completed Inspections for Inspectors per Inspection Type"): a row is a date under an `Inspection Type:` heading. Check the footer count against rows read. Digits-only occupancy IDs get `FMO-`. Result is read from the notes text (`erResult`). Reimporting a month for a person replaces it.
- **School visits that count toward coverage** (code still calls them rotation visits): 352-Annual School, 352-School Follow-up, and 352-Customer Request (Licensed) for daycares only. 233 construction types link to the school but never count toward rotation.
- **Inspection report PDFs** (one per approved inspection, TCPDF) carry the overall result text, failed checklist items with notes, next inspection. October 2026 matched the export 72 of 72; 5 more were approved after the export. Strip "Printed on..." and "Inspection Topics:" lines from failed items.
- **Action codes -> board**: INSP Inspection Assist (row 39), VISIT Site Visit (40), KNOX (41), FMO Issued (46), FMO cleared (47), VIOL (48), FPSN Fire Protection Notifications (44). COI, COC, CCOC, NTF (note to file), OCR, SWO, Occupant Certificate are shown but never summed.
- **County Operations** (decided Nov 4 2026): Victor King and Priscilla Gonzales: 233 inspections go to the matching 233 line (233-County Owned Building counts as 233-CFCC), everything else to County Buildings Annual Inspections. FSS specialists (Bowdoin, Darjean, Eldridge, Gabriel): every inspection goes to FSS Activities, Inspections (fss4) and nowhere else. Their non-FSS action codes use the same mapping as Education.
- **FSS codes -> FSS Activities**: FSS-V Site Visit (fss3), FSS-COS Call Out For Service = On call (fss5), FSS-TW Trirga Work Task = Tririga received (fss1), FSS-TS Tririga Status = Tririga cleared (fss2) only when the entry says closed/cleared/completed/resolved, otherwise Other request; every other FSS code (Administration, Assist Other Groups, Consultation, Plan Review x3, Training/CE) is Other request (fss6). FSS codes count on whichever division the person belongs to.
- **ER exports must be one inspector per file.** A multi-inspector export is grouped by inspection type and has no inspector per row; do not attribute rows from signatures.
- **Action codes export** (.xls "Occupancies for Action Codes for Date Range") covers the whole bureau with a name per row: `tools/er/action_codes_xls.py` keeps team members only. It may omit codes not selected in ER (CCOC, OCR); keep those rows from an earlier source when replacing a month.
- **Days worked** default to 20 per person per month. A whole-team number per division and month (stats.daysAll.MM) overrides the default; a person's own number (stats.days.member.MM) overrides both. Target 6.5 hours per day for everyone, both divisions, except supervisors flagged team.hoursExempt (Solis, Regalado, Kennedy): their hours show with an "exempt" tag and no target, and they are left out of Needs attention, the hours highlight and the Command summary hours range.
- **Prevention action source precedence**: monthly hand entry > action codes > team log > board as entered.
- **Hours**: ER on-site + additional minutes, plus hours written in action-code descriptions ("- 2 hours", "30 min", "8:00 AM to 10:00 AM"). An action-code entry with no time written counts as 15 minutes (ACT_BASELINE_H, decided Nov 4 2026), for every code; Needs attention lists each person with their count of such entries by code. Target 6.5 per day. Days worked: see County Operations rules above (default 20).
- **Assist check**: match the named person (last name, first name, or nickname such as Matt) on the same date and occupancy ID; within 30 minutes of their on-site time is a match. Categories: match, no hours, longer, shorter, different location, no inspection that day, outside team, no name.
- **Highlights** on the Command summary: a person is named only if they meet two of four in the month (6.5 h/day with every flag cleared; best first-visit pass rate, min 5; fastest hazard closure, min 2; rotation finished in all assigned districts). Otherwise division numbers only.

## Open items, in order

1. Inspection email route: ER emails a PDF per approved inspection. Send them to a mailbox the app reads so stats land within minutes, no monthly upload.
2. App move (Firebase PWA, installable, real sign-in per person): needed for "My month" with own hours only, and role permissions.
3. Outlook calendar (.ics) upload for days worked, leave and training.
4. Action-code importer in the page (today they are loaded by script from the PDF).
5. "Create EDU": standardize the team's action codes to one board line each, hours always written the same way.
6. Contacts: Text option, "Log this call" onto the school record, call/email on team profiles.
7. County facilities (built Nov 4 2026): 190 buildings from the FSS building list (owners: East Kaley Bowdoin 55, Downtown Bryan Darjean 27, West Dillon Eldridge 50, South Jimmie Gabriel 58) merged with the OCE Facilities and Regions map (145 buildings, OCR'd; 124 matched by address or name). 21 OCE-only buildings have no owner and show in Needs attention until a sergeant assigns one. Annual/semi-annual months for East, Downtown and South are flagged monthsReview (Cameron: leave for the team to set); saving months in the building popup clears the flag. 11 addresses did not geocode (Census). Rebuild with tools/county/build_county.py; coordinates came from the Census one-line geocoder run in Chrome.
   School assignments were rebalanced Nov 4 2026 ("Balance it"): whole ISDs kept together, privates/charters by nearest inspector. Deanna 139 (Cy-Fair, Katy, Alief), Matt 135 (Spring, Tomball, Waller, Klein + north charters), Mason 131 (Humble, Crosby, Goose Creek, Huffman, Clear Creek, Pasadena, Galena Park, Channelview, ISD Daycares + east/south privates and charters), Donald 116 (Aldine, Sheldon + central privates and charters). History is in each org's assignLog.
8. Question waiting on Cameron: board line for 233-Special Events.
