import xlrd,re,json,collections,sys
D='/mnt/user-data/uploads/Stat Tracking/'
F=['Inspection 1.xls','Inspections 2.xls','Inspections 3.xls','Inspections 4.xls','Completed Inspections for Inspectors per Inspection Type for Date Range (25).xls']
def ex_rows():
    out=[]
    for f in F:
        s=xlrd.open_workbook(D+f,logfile=open('/dev/null','w')).sheet_by_index(0); typ=None; insp=None
        for r in range(s.nrows):
            v=[str(x).strip() for x in s.row_values(r)]
            m=re.match(r'Inspector:\s*(.*?)\s*\|',v[0]); 
            if m: insp=m.group(1); continue
            m=re.match(r'Inspection Type:\s*(.*)',v[0])
            if m: typ=m.group(1).strip(); continue
            if typ and re.match(r'\d\d/\d\d/\d{4}',v[3]):
                out.append(dict(insp=insp,type=typ,id=re.sub(r'\s','',v[0]),occ=v[1],date=v[3],tin=v[4][:5],tout=v[5][:5],add=v[6],notes=v[7]))
    return out
def mdy(s): m,d,y=s.split('/'); return f"{y}-{int(m):02d}-{int(d):02d}"
E=ex_rows(); R=json.load(open(sys.argv[1]))
def h(t): return t.zfill(5) if t else t
used=set(); pairs=[]; extra=[]
for r in R:
    key=(r['inspector'],mdy(r['date']),h(r['tin']))
    hit=[i for i,e in enumerate(E) if i not in used and e['insp']==r['inspector'] and mdy(e['date'])==key[1] and h(e['tin'])==key[2]]
    if not hit: hit=[i for i,e in enumerate(E) if i not in used and e['insp']==r['inspector'] and mdy(e['date'])==key[1] and e['type']==r['type']]
    if hit: used.add(hit[0]); pairs.append((r,E[hit[0]]))
    else: extra.append(r)
missing=[e for i,e in enumerate(E) if i not in used]
print('PDF reports',len(R),'export rows',len(E),'matched',len(pairs),'PDF-only',len(extra),'export-only',len(missing))
for r in extra: print('  PDF only:',r['inspector'],r['date'],r['type'],'|',r['occupancy'],'|',r['result'],'| authorized',r['authorized'])
for e in missing: print('  export only:',e['insp'],e['date'],e['type'],e['occ'])
# field agreement
agree=collections.Counter(); diffs=collections.defaultdict(list)
for r,e in pairs:
    chk={'type':r['type']==e['type'],'date':mdy(r['date'])==mdy(e['date']),'time_in':h(r['tin'])==h(e['tin']),'time_out':h(r['tout'])==h(e['tout']),
         'occupancy_id':re.sub(r'\s','',r['occ_id'] or '').upper()==e['id'].upper() or (e['id'].isdigit() and r['occ_id'].endswith(e['id'])),
         'inspector':True}
    for k,v in chk.items():
        agree[k]+=v
        if not v: diffs[k].append((r['occupancy'],r.get(k) if k!='occupancy_id' else r['occ_id'], e['id'] if k=='occupancy_id' else e.get({'time_in':'tin','time_out':'tout'}.get(k,k))))
print({k:f"{v}/{len(pairs)}" for k,v in agree.items()})
for k,v in diffs.items(): print(k,v[:6])
json.dump({'pairs':[(r,e) for r,e in pairs],'extra':extra,'missing':missing},open(sys.argv[2],'w'))
