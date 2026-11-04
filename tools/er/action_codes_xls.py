"""Action codes export (.xls, "Occupancies for Action Codes for Date Range") -> actions docs for team members.
Usage: python3 tools/er/action_codes_xls.py <export.xls> <team_dir> <out.json> [YYYY-MM]
The export covers the whole bureau; only people in team_dir (data/live/team) are kept. One doc per member per month:
  actions/<YYYY-MM>__<member> = {division, month, member, source, rows:[{c,cn,id,occ,addr,date,desc,h,hs}]}"""
import sys,os,re,json,glob,xlrd,collections
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
def tmin(s):
    m=re.match(r'(\d{1,2})(?::(\d\d))?\s*([AP])\.?M',s.replace(' ','').upper())
    if not m: return None
    h=int(m.group(1))%12+(12 if m.group(3)=='P' else 0); return h*60+int(m.group(2) or 0)
def hours(d):
    m=re.search(r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\.?\s*(?:and\s*)?(\d+)\s*min',d,re.I)
    if m: return float(m.group(1))+int(m.group(2))/60,'stated'
    m=re.search(r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b',d,re.I)
    if m: return float(m.group(1)),'stated'
    m=re.search(r'(\d+)\s*min',d,re.I)
    if m: return int(m.group(1))/60,'stated'
    m=re.search(r'(\d{1,2}(?::\d\d)?\s*[AaPp]\.?[Mm])\s*(?:-|to|–)\s*(\d{1,2}(?::\d\d)?\s*[AaPp]\.?[Mm])',d)
    if m:
        a,b=tmin(m.group(1)),tmin(m.group(2))
        if a is not None and b is not None and b>a: return (b-a)/60,'time range'
    return None,None
def split_heading(h):
    m=re.match(r'^(.*?)\s+-\s+(FSS\s*-\s*.*)$',h)
    if m: code,name=m.group(1),m.group(2)
    else: code,name=(h.split(' - ',1)+[''])[:2]
    return re.sub(r'\s+','',code).upper(), name.strip()
def iso(mdy): m,d,y=mdy.split('/'); return f"{y}-{int(m):02d}-{int(d):02d}"
src,team_dir,out=sys.argv[1:4]; only=sys.argv[4] if len(sys.argv)>4 else None
team={}
for p in glob.glob(os.path.join(team_dir,'*.json')):
    t=json.load(open(p)); t=t.get('data',t); n=t['name'].split(); team[f"{n[-1]}, {n[0]}".lower()]=(os.path.basename(p)[:-5],t.get('division','education'))
alias={'martinez, matt':'martinez, matthew'}
s=xlrd.open_workbook(src,logfile=open(os.devnull,'w')).sheet_by_index(0)
head=None; docs={}; skipped=collections.Counter(); seen=collections.Counter()
for r in range(s.nrows):
    v=s.row_values(r); nz=[x for x in v if x!='']
    if not nz: continue
    if v[0]=='ID': head=True; continue
    if head and len(nz)==1 and isinstance(nz[0],str) and not re.match(r'\d',nz[0]): code,name=split_heading(nz[0]); continue
    if head and len(nz)>=4 and re.match(r'\d{1,2}/\d{1,2}/\d{4}',str(v[3])):
        who=str(v[4]).strip().lower(); who=alias.get(who,who)
        if who not in team: skipped[v[4]]+=1; continue
        mid,div=team[who]; date=iso(str(v[3])[:10]); mo=date[:7]
        if only and mo!=only: continue
        desc=str(v[5]).strip(); h,hs=hours(desc); seen[code]+=1
        d=docs.setdefault(f"{mo}__{mid}",{'division':div,'month':mo,'member':mid,'source':os.path.basename(src),'rows':[]})
        d['rows'].append({'c':code,'cn':name,'id':str(v[0]).strip(),'occ':str(v[1]).strip(),'addr':str(v[2]).strip(),'date':date,'desc':desc[:400],'h':round(h,2) if h is not None else None,'hs':hs})
for d in docs.values(): d['rows'].sort(key=lambda x:(x['date'],x['c']))
json.dump(docs,open(out,'w'))
print({k:len(v['rows']) for k,v in sorted(docs.items())}); print('codes',dict(seen)); print('other personnel skipped',sum(skipped.values()))
