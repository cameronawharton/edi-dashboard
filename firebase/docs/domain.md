# Domain rules

Everything here was worked out with Cameron against real files. The code that implements each rule is named so you can find it in `src/app.html`.

## School year, rotation, coverage (`yearOf`, `rotationFor`, `model`)

- School year runs Aug 1 to Jul 31 (`settings.yearStartMonth = 8`). The pace line runs to the work end month (May).
- Public ISD campuses rotate A, B, C: 2025-26 = A, 2026-27 = B, 2027-28 = C (`settings.rotationAnchor`). `ABC` or the `walk-every-year` flag means every year.
- Targets: each ISD inspects at least 30% of its active campuses per year; charters, privates and ISD daycares 100% per year.
- Coverage = active campuses with at least one non-voided visit dated inside the school year / active campuses. Closed or removed campuses drop out, except in past years when they were inspected that year.
- A facility with `since` later than the year is not counted in that year (daycares were added in 2026-27).
- Facility state for a year: `done` (last visit passed), `failed` (last visit failed), `due`, `off` (ISD, other rotation letter), `unassigned` (ISD with no letter), `excluded`.

## Emergency Reporting import (`parseERGrid`, `erPlan`, `erSave`)

Report: "Completed Inspections for Inspectors per Inspection Type for Date Range", exported as .xls, one file per inspector per month.

- Header row: `Inspector: Last, First | Start Date: MM/DD/YYYY | End Date: ...`. Sections start with `Inspection Type: X`. Columns: ID, OCCUPANCY, ADDRESS (multi-line), DATE, TIME IN, TIME OUT, ADDITIONAL TIME, NOTES.
- A row is an inspection when it sits under a type heading and has a date. Do not key on the ID: inspectors type IDs badly ("FMO- 201827", "387309721", "FMO-1422 - 1"). Odd IDs are read and flagged.
- The footer `TOTAL # INSPECTIONS:` is checked against rows read. This caught two dropped rows in September; keep the check.
- The ID column is the occupancy (FMO-1873 repeats across visits), not an inspection id. Row key = `id|date|type|time in|index`.
- On-site minutes = time out minus time in. "Additional time" is reported separately.
- Result is read from the notes (there is no result field):
  - pass if "no fire and life safety issues were observed"
  - fail if "fire and life safety issues were observed", "outstanding hazards", "once all corrections have been made", or "violations that are required to be remedied"
  - conditional if "Conditional Certificate of Compliance"
  - pass if a Certificate of Inspection number is present ("Certificate of Inspection number for this Inspection is 2026-11102")
  - otherwise unknown (mostly underground and pre-cover checks). Do not use the word "failed": it appears in fee boilerplate.
- Re-importing a month for an inspector replaces that month (doc id `YYYY-MM__team-id`), so corrected exports never double count.

### Which inspections touch the school rotation

- `352-Annual School` and `352-School Follow-up` matched to a school become rotation visits (`kind` initial / reinspection).
- `352-Customer Request (Licensed)` matched to an ISD daycare becomes a daycare rotation visit (licensing inspections).
- 233 types (CFCC, School, Follow Up, Underground, Pre-Cover...) are construction inspections. They link to the school's activity but never count toward the 30%.
- A rotation visit is skipped when the COI number or the same facility and date is already on file.

### Matching an occupancy to a tracker facility (`bestFac`, `erFacFor`)

Token overlap of names (elementary->elem, middle->ms, high->hs; ISD and filler words dropped) plus 0.6 when the street number and first street word match. Threshold 0.5. Daycare lines only match daycares; everything else prefers the school campus over a daycare at the same address. Matches for non-rotation rows are recomputed when read, so improving the matcher fixes old imports.

## Monthly board (`BOARD`, `yearGrid`)

Mirrors the Education tab of `2026_MONTHLY_STATS_Prevention.xlsm` (workbook row numbers kept in `BOARD[].r` and in the CSV export). Calendar months, not school years.

- Inspection lines fill from Emergency Reporting for any month with an import; otherwise the board as entered by hand.
- Type names that map to a line are in `BOARD[].er` plus `ERFAMILY` for families ER spells several ways (233-FPS-Access Controls -> FPS Inspections; 233-OPI-Operational Permit Inspection -> Operational Permit Inspections; 352-County Owned Building -> County Buildings). `233-Special Events` has no Education line.
- Prevention Actions (assists, site visits, Knox, FMOs, violations...) are not in Emergency Reporting. Precedence per line and month: monthly entry by a sergeant > sum of the team's personal activity logs > board as entered.
- Projected = YTD x days in year / days elapsed through the selected month.
- September 2026 check: 62 in Emergency Reporting = 62 on the board.

## People and roles

Captain Cameron Wharton; Lt. Durrell Kennedy (oversight of County Operations and Education, reads and reports, does not log daily); Sgt. Isela Regalado (runs the monthly Emergency Reporting imports; also inspects); Inspectors Deanna Burciaga (95P50), Donald Hewett (95P40), Mason Montagna (95P44), Matt Martinez (95P24). `field: false` keeps leadership out of team productivity cards.
