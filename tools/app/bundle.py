"""Make the data bundle the app loads into Firestore ("Load data" button, owner only).

Input:  data/fresh/<collection>/<id>.json, as saved by ArtifactData list with out_dir (the live artifact database).
Output: data/bundle.json = {"made": iso, "collections": {name: {id: fields}}}. data/ is not in git.

Staff photos are dropped (initials only until IT hosts the app), and Claude account links (userId) are cleared
because Firebase sign-in ids are different: each person links their profile again with "This is me".
"""
import json, os, sys, datetime
root = os.path.join(os.path.dirname(__file__), '..', '..')
src = os.path.join(root, 'data', sys.argv[1] if len(sys.argv) > 1 else 'fresh')
out = {'made': datetime.datetime.now().isoformat(timespec='seconds'), 'collections': {}}
for col in sorted(os.listdir(src)):
    d = os.path.join(src, col)
    if not os.path.isdir(d): continue
    docs = {}
    for f in sorted(os.listdir(d)):
        if not f.endswith('.json'): continue
        raw = json.load(open(os.path.join(d, f)))
        data = raw.get('data', raw) if isinstance(raw, dict) else raw
        if col == 'team':
            for k in ('photo', 'portrait', 'userId', 'accountName', 'linkedAt'): data.pop(k, None)
        docs[f[:-5]] = data
    out['collections'][col] = docs
path = os.path.join(root, 'data', 'bundle.json')
json.dump(out, open(path, 'w'), separators=(',', ':'))
print(path, round(os.path.getsize(path) / 1024), 'KB', {c: len(v) for c, v in out['collections'].items()})
