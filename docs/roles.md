# EDI role views: decisions from the Nov 3, 2026 interview

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
