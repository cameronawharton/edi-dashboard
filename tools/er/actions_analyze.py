import json,re,collections,sys
A=json.load(open(sys.argv[1])); J=json.load(open(sys.argv[2]))
R=[r for r,e in J['pairs']]+J['extra']
EDU={'Regalado, Isela':'Regalado','Burciaga, Deanna':'Burciaga','Hewett, Donald':'Hewett','Martinez, Matthew':'Martinez','Montagna, Mason':'Montagna'}
def tmin(s):
    m=re.match(r'(\d{1,2})(?::(\d\d))?\s*([AP])\.?M',s.replace(' ','').upper()); 
    if not m: return None
    h=int(m.group(1))%12+(12 if m.group(3)=='P' else 0); return h*60+int(m.group(2) or 0)
def hours(desc):
    d=desc
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
E=[dict(a,**{'hrs':hours(a['desc'])[0],'hsrc':hours(a['desc'])[1]}) for a in A if a['person'] in EDU]
by=collections.Counter(a['code'] for a in E)
print('hours found',sum(1 for a in E if a['hrs'] is not None),'of',len(E)); print(collections.Counter((a['code'],a['hrs'] is not None) for a in E))
# inspection assist verification
FIRST={'mason':'Montagna, Mason','deanna':'Burciaga, Deanna','donald':'Hewett, Donald','matthew':'Martinez, Matthew','matt':'Martinez, Matthew','isela':'Regalado, Isela'}
NAMES={'hewett':'Hewett, Donald','burciaga':'Burciaga, Deanna','martinez':'Martinez, Matthew','montagna':'Montagna, Mason','regalado':'Regalado, Isela'}
def mdy(s): m,d,y=s.split('/'); return f"{y}-{int(m):02d}-{int(d):02d}"
res=[]
for a in [x for x in E if x['code'].startswith('INSP')]:
    m=re.search(r'(?i:assist(?:ed)?(?:\s+\w+)?\s+with|assisted)\s+(?:([A-Z])\.\s*|([A-Z])\s+(?=[A-Z][a-z]))?([A-Z][A-Za-z]+)',a['desc'])
    who=m.group(3).lower() if m else None; full=NAMES.get(who) or FIRST.get(who)
    st={'person':a['person'],'date':a['date'],'occ':a['name'],'id':a['id'],'assisted':(((m.group(1) or m.group(2) or '')+'. ' if (m.group(1) or m.group(2)) else '')+m.group(3)) if m else '?','hrs':a['hrs'],'desc':a['desc']}
    if not full: st['check']='outside team' if m else 'no name'; res.append(st); continue
    same=[r for r in R if r['inspector']==full and mdy(r['date'])==mdy(a['date'])]
    at=[r for r in same if re.sub(r'\s','',r['occ_id']).upper()==a['id'].upper()]
    if at:
        r=at[0]; st['their_min']=r['insp_min']; st['their_total']=r['total_min']; st['their_type']=r['type']
        if a['hrs'] is None: st['check']='matched, no hours given'
        else:
            diff=a['hrs']*60-r['insp_min']; st['diff_min']=diff
            st['check']='matched' if abs(diff)<=30 else ('assist longer than inspection' if diff>0 else 'assist shorter than inspection')
    elif same: st['check']='date ok, different location'; st['their']=[x['occupancy'] for x in same]
    else:
        near=[r for r in R if r['inspector']==full and re.sub(r'\s','',r['occ_id']).upper()==a['id'].upper()]
        st['check']='no inspection that day' + (f" (they inspected it {', '.join(r['date'] for r in near)})" if near else '')
    res.append(st)
print(collections.Counter(s['check'].split(' (')[0] for s in res))
for s in res:
    if s['check']!='matched' and s['check']!='outside team': print(' ',s['check'],'|',s['person'],s['date'],'|',s['occ'],'| with',s['assisted'],'| hrs',s['hrs'],'| theirs',s.get('their_min'),s.get('their'))
json.dump({'edu':E,'assists':res},open(sys.argv[3],'w'),indent=1)
