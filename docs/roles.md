# EDI role views: decisions from the Nov 3, 2026 interview

> **Superseded Nov 10 2026 (Cameron):** the app is a supervisory and management tool, not a daily tool for inspectors. Only chief, captain, lieutenants, sergeants and managers use it. The "Employee (inspector)" and "Inspector interview" sections below are history: inspectors get their follow-ups and ER fixes from their sergeant's "Send list" email on the Inspectors page. The supervisor and stakeholder sections still stand.

Rule that governs everything: all work is entered in Emergency Reporting (ER). The dashboard reads ER exports, action-code reports and Outlook calendars. Nobody keys work into the dashboard.

## Employee (inspector)
- Lands on **My month**: own hours per day vs 6.5 target, own inspections, open hazards, flags, areas of focus (schools due in assigned districts).
- **Outlook calendar upload** (.ics export) sets days worked, leave and training so hours per day is fair. This replaces the manual Days Worked entry.
- Sees **own hours only**. Sergeant and up see the team table.
- Sees own assist flags, adds a short explanation, corrects the entry in ER, and the corrected export is reuploaded (replace, never add).
- The activity log is retired as an input. Everything goes through ER.

## Supervisor (sergeant, lieutenant)
- Weekly check. One "Needs attention" panel at the top, no digging:
  - Hours per day trending under 6.5
  - Assist variances not explained or fixed
  - Inspection assists that don't line up with an inspection
  - Schools or districts behind rotation pace
- Explained flags: **Accept** closes the flag. **Send back** means fix it in ER and reupload.
- Lieutenants and sergeants do the monthly uploads: ER exports, action codes and calendars. The uploads grid shows what is missing.

## Stakeholder (assistant chiefs first, then the Fire Marshal and Commissioners Court)
- Questions the stakeholder view answers:
  - Staffing: can we cover every school each year?
  - Workload balance: are districts and hours spread fairly across the team?
  - Risk: where do hazards stay open longest, and which schools fail repeatedly?
  - Budget and value: what does the division deliver per hour and per inspector?
- Delivery: a live read-only stakeholder page plus a monthly one-page report.
- Division stats and breakdowns come first. No individual performance numbers.
- Exception, positive highlights: an employee is named when they meet **two of four** in the same month:
  1. 6.5 hours per day or more with no unexplained flags
  2. Best first-visit pass rate on their schools
  3. Fastest hazard closure (median days from failed inspection to the follow-up that clears it)
  4. First to finish their assigned districts' rotation

## Open items
- Create EDU: align the team's action codes to board lines, with hours written in one consistent spot.
- Real logins and role permissions need the app move (Firebase). The current artifact knows who the viewer is only after they are linked.

## Contacts (added Nov 3)
- Every phone number is a tap-to-call link and every email opens a new message, on the district page and the map side panel. Done in the current dashboard.
- App phase: add the same links to team profiles, add Text, and add "Log this call" so the contact shows on the school's record.

## Inspector interview (Nov 4 2026, Cameron answering as an inspector)
- **When used:** during admin time (scheduling, email cleanup), mostly at a desk. Not a between-stops field tool. ER reports are entered in the truck after the inspection when possible, otherwise back at the office.
- **How work happens:** inspections are scheduled weeks ahead with each district's facilities lead. Call-ahead and email relationships are paramount.
- **One place for everything (hard rule):** no logging anything twice. Appointments live in Outlook, inspections in ER, contacts in the dashboard. The dashboard reads; it never asks for a second entry.
  - Outlook appointments are titled "type and campus" (e.g. "Annual - Cypress Falls HS"). Wanted: a live feed from each inspector's Outlook calendar.
  - The ER report's "Next inspection date" is the follow-up date (inconsistent today, should be exact in practice).
  - Pass: the school gets the inspection report. Fail: the report plus a scheduled follow-up date.
  - Contacts: the assigned inspector keeps their districts' contacts current in the dashboard.
- **My work page, top to bottom:** actionable items first: who is coming up (campuses to schedule and booked appointments), follow-ups needed, then stats nearby.
- **Nudges:** no routine emails (apathy). Urgent items only. The key one: a follow-up date from a failed inspection with no matching Outlook appointment.
- **Peers:** inspectors see teammates' windows, appointments and progress, never their hours.
- **Biggest time waster today:** spreadsheets.

## Built from the interview (Nov 4 2026, artifact v23)
- My work is live: inspectors and specialists land on it with a five-item nav (county: three). Coming up, Follow-ups, Fix in ER, My numbers, Team. Nothing is typed into it.
- "Email to schedule" opens a message to the district's point of contact listing the campuses still due in the window. "Add to Outlook" on a follow-up saves an appointment titled type and campus on the ER next-inspection date, so the later Outlook feed can match it.
- Removed for inspectors: "+ Log inspection", per-row Log buttons, the profile activity log, Needs attention, ER import, other people's hours.
- Waiting on the app move: checking Outlook for a booked visit (the urgent nudge), push alerts, real per-person privacy.
