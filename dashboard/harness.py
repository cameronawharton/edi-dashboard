"""Build test pages that run the dashboard against a fake database, for Playwright.
  dist/test.html  seeded from data/seed/<collection>/<id>.json   (python3 dashboard/harness.py)
  dist/live.html  seeded from data/live/<collection>/<id>.json   (python3 dashboard/harness.py live)
data/ is not in git. Fill data/live by reading the live artifact database (ArtifactData list with out_dir)."""
import os,sys,json,glob
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); DIST=os.path.join(ROOT,'dist')
mode=sys.argv[1] if len(sys.argv)>1 else 'seed'
docs={}
for p in glob.glob(os.path.join(ROOT,'data',mode,'*','*.json')):
    c=p.split(os.sep)[-2]; d=json.load(open(p)); docs.setdefault(c,{})[os.path.basename(p)[:-5]]=d.get('data',d) if isinstance(d,dict) else d
head=open(os.path.join(HERE,'tests','mock_head.html')).read().replace('__DATA__',json.dumps(docs))
if mode=='live': head=head.replace("id:'u_test',name:'Cameron'","id:'u_25cOUAG2OVAtv2aYekEpJw',name:'Cameron Wharton'")
html=open(os.path.join(DIST,'tracker.html')).read()
out=os.path.join(DIST,'live.html' if mode=='live' else 'test.html'); open(out,'w').write(head+html+'</body></html>')
print(out,sum(len(v) for v in docs.values()),'docs')
