"""Team profiles from the Prevention Bureau org chart (Canva, Asst. Chief Howell, Oct 21 2026), scope Cameron set on Nov 9 2026:
everyone under Asst. Chief Howell: Capt. Wharton, Lt. Kennedy (Education + FSS/County), Lt. Kronenberger (General Inspections),
Administrative Services, the engineer liaison; plus Madison Davis (S.E.R.G. / F.S.C.) for the inspector test.

Writes data/team-bundle.json (merge mode: existing fields such as userId stay). data/ is not in git.
emailLc follows the county pattern first.last@fmo.hctx.net. It is only a match key: a profile links when that person signs in
with that exact verified address. A wrong guess means the profile does not link; fix it in the app.
Names are as the existing records spell them (ER exports) when the person is already in the app; new people as the chart spells them.
"""
import json, os, re, datetime
root = os.path.join(os.path.dirname(__file__), '..', '..')
def slug(n): return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
def email(n, first=None):
    parts = n.split(); f = (first or parts[0]); l = parts[-1]
    return f"{f}.{l}@fmo.hctx.net".lower()
P = {}
def add(name, role, division, field, section=None, reportsTo=None, unit=None, hoursExempt=None, preferred=None, emailFirst=None, note=None):
    d = {'name': name, 'role': role, 'division': division, 'field': field, 'active': True, 'emailLc': email(name, emailFirst)}
    if section: d['section'] = section
    if reportsTo: d['reportsTo'] = reportsTo
    if unit: d['unit'] = unit
    if hoursExempt is not None: d['hoursExempt'] = hoursExempt
    if preferred: d['preferred'] = preferred
    if note: d['orgNote'] = note
    P[slug(name)] = d
# command
add('Micheal Howell', 'chief', 'command', False, 'Prevention Inspection Services')
add('Cameron Wharton', 'captain', 'education', False, 'Prevention Inspection Services', 'micheal-howell')
add('Jacqueline Harrell', 'liaison', 'amr', False, 'Alternative Methods Plan Review', 'cameron-wharton')
# CO/ED (Lt. Kennedy)
add('Durrell Kennedy', 'lieutenant', 'education', False, 'CO/ED', 'cameron-wharton', hoursExempt=True)
add('Isela Regalado', 'sergeant', 'education', True, 'Education', 'durrell-kennedy', hoursExempt=True)
for n, u in [('Donald Hewett', '95P40'), ('Deanna Burciaga', '95P50'), ('Matthew Martinez', '95P24'), ('Mason Montagna', '95P44')]:
    add(n, 'inspector', 'education', True, 'Education', 'isela-regalado', unit=u, preferred='Matt' if n.startswith('Matthew') else None)
add('Juan Solis', 'sergeant', 'county', True, 'FSS / County', 'durrell-kennedy', hoursExempt=True)
for n in ['Priscilla Gonzales', 'Victor King']: add(n, 'inspector', 'county', True, 'County', 'juan-solis')
for n in ['Jimmie Gabriel', 'Kaley Bowdoin', 'Dillon Eldridge', 'Bryan Darjean']: add(n, 'specialist', 'county', True, 'F.S.S.', 'juan-solis')
# General Occupancies (Lt. Kronenberger)
add('Jeffrey Kronenberger', 'lieutenant', 'general', False, 'General Occupancies', 'cameron-wharton', hoursExempt=True)
add('Jacob Lawhorn', 'sergeant', 'general', True, 'General Occupancies (East)', 'jeffrey-kronenberger', hoursExempt=True)
for n in ['Joseph Heeger', 'Robert High', 'Tyler Huber', 'Diana Regalado', 'Damian Phillip']: add(n, 'inspector', 'general', True, 'General Occupancies (East)', 'jacob-lawhorn')
add('Clinton Kveton', 'sergeant', 'general', True, 'General Occupancies (West)', 'jeffrey-kronenberger', hoursExempt=True)
for n in ['Cody Mangum', 'Kenneth Smith', 'Robert Morgan', 'Alexis Sauceda', 'Shelton Easley']: add(n, 'inspector', 'general', True, 'General Occupancies (West)', 'clinton-kveton')
# Administrative Services
add('Kimberly Perez', 'manager', 'admin', False, 'Prevention Administrative Services', 'cameron-wharton')
for n in ['Ivett Ramos', 'Jessica Cerros', 'Cayley Montes']: add(n, 'admin', 'admin', False, 'Administrative Services', 'kimberly-perez')
# test inspector outside this scope (S.E.R.G., F.S.C. under Lt. Lamont / Sgt. Charanza on the chart)
add('Madison Davis', 'inspector', 'serg', True, 'S.E.R.G. / F.S.C.', note='Under Lt. Joseph Lamont and Sgt. David Charanza (Prevention Regulation Services). Added for the inspector test.')
P['madison-davis']['tester'] = True  # test partner: inspector view plus 'Preview as' any inspector (Cameron, Nov 9 2026)
out = {'made': datetime.datetime.now().isoformat(timespec='seconds'), 'merge': True, 'collections': {'team': P}}
path = os.path.join(root, 'data', 'team-bundle.json'); json.dump(out, open(path, 'w'), indent=1)
existing = set(f[:-5] for f in os.listdir(os.path.join(root, 'data', 'fresh', 'team')))
print(len(P), 'profiles;', len(set(P) & existing), 'existing updated;', len(set(P) - existing), 'new;', 'existing not on chart:', sorted(existing - set(P)))
