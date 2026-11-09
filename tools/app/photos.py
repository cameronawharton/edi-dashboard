"""Staff photos for the app (Cameron, Nov 9 2026: "upload the team images"). Photos never go in git: this writes
data/photos-bundle.json, a merge-mode bundle that sets team.photo (160px square JPEG) and team.portrait (320x400 JPEG)
as data URLs on each profile, loaded with "Load data".
Sources: argv[1] = folder of 'Last, First YYYY.jpg' studio photos; argv[2] = folder of hs-<id>.png circle crops cut from the
bureau org chart (used only for people with no studio photo).
"""
import sys, os, io, json, base64, glob, re, datetime
from PIL import Image, ImageOps
staff, chart = sys.argv[1], sys.argv[2]
root = os.path.join(os.path.dirname(__file__), '..', '..')
team = set(f[:-5] for f in os.listdir(os.path.join(root, 'data', 'live', 'team')))
def url(im, q=78):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
out = {}
for f in sorted(glob.glob(os.path.join(staff, '*.jpg'))):
    m = re.match(r'([^,]+),\s*([A-Za-z]+)', os.path.basename(f))
    pid = (m.group(2) + '-' + m.group(1)).lower().replace(' ', '-')
    if pid not in team: print('no profile for', f); continue
    im = ImageOps.exif_transpose(Image.open(f)); w, h = im.size
    if w >= h:   # landscape studio shot, head around 36% down
        s = int(0.64 * h); cx, cy = w // 2, int(0.37 * h)
        sq = im.crop((cx - s // 2, max(0, cy - s // 2), cx + s // 2, max(0, cy - s // 2) + s))
        pw = int(0.8 * h); por = im.crop((w // 2 - pw // 2, 0, w // 2 + pw // 2, h))
    else:        # portrait studio shot
        s = int(0.75 * w); cy = int(0.27 * h)
        sq = im.crop(((w - s) // 2, max(0, cy - s // 2), (w + s) // 2, max(0, cy - s // 2) + s))
        por = im.crop((0, 0, w, int(1.25 * w)))
    out[pid] = {'photo': url(sq.resize((160, 160), Image.LANCZOS)), 'portrait': url(por.resize((320, 400), Image.LANCZOS), 74)}
for f in sorted(glob.glob(os.path.join(chart, 'hs-*.png'))):
    pid = os.path.basename(f)[3:-4]
    if pid in out or pid not in team: continue
    im = Image.open(f).convert('RGB'); w = im.size[0]; i = int(w * 0.16)
    sq = im.crop((i, i, w - i, w - i))   # inside the circle, no white corners
    out[pid] = {'photo': url(sq.resize((160, 160), Image.LANCZOS)), 'portrait': url(sq.resize((320, 320), Image.LANCZOS))}
path = os.path.join(root, 'data', 'photos-bundle.json')
json.dump({'made': datetime.datetime.now().isoformat(timespec='seconds'), 'merge': True, 'collections': {'team': out}}, open(path, 'w'))
print(len(out), 'people with photos,', round(os.path.getsize(path) / 1024), 'KB:', ', '.join(sorted(out)))
