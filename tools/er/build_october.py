"""Build dashboard-ready October data: report rows per inspector (app import shape + enrichment) and action-code docs per member."""
import json,re,sys
S='/tmp/claude-0/-home-claude/6289af8a-f1f6-5fc8-93f3-93fc022fc98b/scratchpad/'
J=json.load(open(S+'recon.json')); X=json.load(open(S+'analysis.json'))
TEAM={'Regalado, Isela':'isela-regalado','Burciaga, Deanna':'deanna-burciaga','Hewett, Donald':'donald-hewett','Martinez, Matthew':'matthew-martinez','Montagna, Mason':'mason-montagna'}
def iso(mdy): m,d,y=mdy.split('/'); return f"{y}-{int(m):02d}-{int(d):02d}"
def res(r):
    x=(r['result'] or '').lower()
    if 'correction notice' in x: return 'fail'
    if 'conditional' in x: return 'conditional'
    if any(k in x for k in ['certificate of','passed','cleared']): return 'pass'
    return 'unknown'
def street(a):
    m=re.match(r'(.+?\b(?:RD|DR|ST|LN|BLVD|PKY|FWY|AVE|CT|WAY|HWY|TRL|CIR|PL|RNCH|LOOP|PKWY|Freeway|Road|Drive)\b\.?(?:\s*#\S+)?)',a or '',re.I)
    return m.group(1) if m else (a or '')
rows={}
pairs=[(r,e) for r,e in J['pairs']]+[(r,None) for r in J['extra']]
for r,e in pairs:
    nx=r['next'] or ''; m=re.match(r'(\d+/\d+/\d{4})\s*(.*)',nx)
    fails=[{'q':i['q'][:160],'n':i['notes'][:320]} for i in r['fails']]
    row={'id':(e['id'] if e else re.sub(r'\s','',r['occ_id'])),'occ':(e['occ'] if e else r['occupancy']).replace(' (MAIN PAGE)','').strip(),
         'addr':(e and e.get('addr')) or street(r['address']),'city':'','date':iso(r['date']),'tin':r['tin'].zfill(5),'tout':r['tout'].zfill(5),
         'mins':r['insp_min'] or 0,'add':r['add_min'] or 0,'type':r['type'],'coi':(r['coi'][0] if r['coi'] and res(r)!='fail' else ''),'res':res(r),
         'insp':r['inspector'],'rt':r['result'],'fl':fails,'nx':({'d':iso(m.group(1)),'t':m.group(2).strip()} if m else None),'src':'report','inExport':bool(e)}
    if re.fullmatch(r'\d+',row['id']): row['id']='FMO-'+row['id']
    rows.setdefault(r['inspector'],[]).append(row)
for k in rows: rows[k].sort(key=lambda x:(x['date'],x['tin']))
# export rows lack addr in recon (ex_rows has no addr). take addr from PDF street
for k,v in rows.items():
    for x in v:
        if not x['addr']: x['addr']=street(next(r['address'] for r,e in pairs if r['inspector']==k and iso(r['date'])==x['date'] and r['tin'].zfill(5)==x['tin']))
files=[{'file':f'{k.split(", ")[1]} {k.split(", ")[0]} October Inspections.pdf','inspectorRaw':k,'start':'2026-10-01','end':'2026-10-31','rows':v,'declared':{'count':len(v)},'warnings':[]} for k,v in rows.items()]
json.dump(files,open(S+'oct_import.json','w'))
# action codes
acts={}
for a in X['edu']:
    code,name=a['code'].split(' - ',1)
    acts.setdefault(TEAM[a['person']],[]).append({'c':code,'cn':name,'id':a['id'],'occ':a['name'],'addr':a['addr'],'date':iso(a['date']),'desc':a['desc'][:400],'h':a['hrs'],'hs':a['hsrc']})
docs={f"2026-10__{m}":{'division':'education','month':'2026-10','member':m,'source':'October Action Codes.pdf','rows':sorted(v,key=lambda x:(x['date'],x['c']))} for m,v in acts.items()}
json.dump(docs,open(S+'oct_actions.json','w'))
print({k:len(v) for k,v in rows.items()}, {k:len(v['rows']) for k,v in docs.items()}, 'bytes', len(json.dumps(files)), len(json.dumps(docs)))
print(max(len(json.dumps(v)) for v in rows.values()))
