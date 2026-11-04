"""County facilities: FSS building list (xlsx, one sheet per FSS section) + OCE Facilities and Regions map table (OCR json).
Writes data/county/cfac.json: {slug: facility}. FSS list decides ownership; OCE-only buildings stay unassigned (flagged).
Usage: python3 tools/county/build_county.py <fss.xlsx> <oce_ocr.json> <out.json>"""
import sys,re,json,openpyxl,collections
fss_x,oce_j,out=sys.argv[1:4]
SECT={'East':('east','kaley-bowdoin'),'DT':('downtown','bryan-darjean'),'West':('west','dillon-eldridge'),'South':('south','jimmie-gabriel')}
MON=['january','february','march','april','may','june','july','august','september','october','november','december']
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')[:60]
ABBR={'street':'st','st.':'st','road':'rd','rd.':'rd','drive':'dr','dr.':'dr','boulevard':'blvd','blvd.':'blvd','avenue':'ave','ave.':'ave','freeway':'fwy','frwy':'fwy','fwy.':'fwy','parkway':'pkwy','lane':'ln','ln.':'ln','highway':'hwy','court':'ct','north':'n','south':'s','east':'e','west':'w','n.':'n','s.':'s','e.':'e','w.':'w','route':'rte'}
def akey(num,street):
    st=' '.join(ABBR.get(w,w) for w in re.sub(r'[#,].*$','',str(street or '')).lower().replace('.',' ').split())
    st=re.sub(r'\b(st|rd|dr|blvd|ave|fwy|pkwy|ln|hwy|ct|rte)\b','',st).strip()
    n=re.match(r'\d+',str(num or '').strip()); return (n.group(0) if n else '')+'|'+' '.join(st.split()[:2])
def mon(v):
    v=str(v or '').strip().lower()
    for i,m in enumerate(MON):
        if v.startswith(m[:3]): return i+1
    return None
wb=openpyxl.load_workbook(fss_x,data_only=True); F={}
for ws in wb:
    sec=next(v for k,v in SECT.items() if ws.title.strip().endswith(k)); h=[str(c.value or '').strip() for c in ws[1]]
    for r in ws.iter_rows(min_row=2,values_only=True):
        if not r[3]: continue
        d=dict(zip(h,r)); name=str(d['Name']).strip(); num=d['Address']; street=d['Street']
        sid=slug(name); base=sid; k=2
        while sid in F: sid=f'{base}-{k}'; k+=1
        sysf={}
        for col,key in [('Fire Alarm','fireAlarm'),('Smoke Detector','smoke'),('Heat Detector','heat'),('Pull Station','pull'),('Waterflow','waterflow'),('Tamper','tamper'),('Visual Strobes','strobes'),('Horn Strobes','hornStrobes'),('Elevator Relays','elevator'),('Power Supplies','powerSupplies'),('Duct Detector','duct'),('Emerg Lighting','emergLighting'),('Sprinkler','sprinkler'),('Backflow','backflow'),('Standpipes','standpipes'),('Extinguisher','extinguisher'),('Kitchen Hood','kitchenHood'),('Suppression','suppression')]:
            v=d.get(col)
            if v not in (None,'','-','N/A'): sysf[key]=v if isinstance(v,(int,float,bool)) else str(v).strip()
        brands=[str(r[i]).strip() for i,x in enumerate(h) if x=='Brand' and r[i] not in (None,'','N/A')]
        F[sid]={'name':name,'address':f"{num} {street}".strip() if num else str(street or ''),'city':str(d['City'] or '').strip().title(),'zip':str(d['Zip'] or ''),'area':d['Area'],
            'section':sec[0],'fss':sec[1],'sqft':d['SQFT.'] if isinstance(d['SQFT.'],(int,float)) else None,'bda':(str(d['BDA']).strip() if d['BDA'] else None),
            'systems':sysf,'brands':brands,'annualMonth':mon(d.get('Anual Month')),'semiMonth':mon(d.get('Semi-Annual Month')),
            'monthsReview':sec[0]!='west','src':'fss','ak':akey(num,street)}
oce=json.load(open(oce_j)); byak=collections.defaultdict(list)
for k,f in F.items(): byak[f['ak']].append(k)
def cleanreg(v): v=v.strip(); return v if re.fullmatch(r'[1-8]|CP',v) else None
matched=0; oceonly=[]
for o in oce:
    m=re.match(r'\s*(\d+)\s+(.*?),\s*([A-Za-z .]+),\s*(\d{5})',o['address'])
    rec={'program':o['program'],'region':cleanreg(o['region']),'pct':o['pct'] if o['pct'] in '1234' and o['pct'] else None,'use':o['use'],'year':o['year'] or None,'oceName':o['building'],'other':o['other'] or None,'sqftOCE':o['sqft']}
    hit=byak.get(akey(m.group(1),m.group(2))) if m else None
    if not hit:  # name match: exact, then one name contained in the other (JP court codes dropped)
        def nn(x): return slug(re.sub(r'\bJP\s*\d+-\d+\b|\(.*?\)','',x or ''))
        names=[nn(o['building'])]+([nn(o['other'])] if o['other'] else [])
        hit=[k for k,f in F.items() if nn(f['name']) in names]
        if not hit: hit=[k for k,f in F.items() if any(len(n)>=8 and len(nn(f['name']))>=8 and (n in nn(f['name']) or nn(f['name']) in n) for n in names)]
    if not hit and m:  # same street number and first street word
        num=m.group(1); w1=(m.group(2).lower().split() or [''])[0]
        hit=[k for k,f in F.items() if f['src']=='fss' and f['address'].split()[:1]==[num] and w1 in f['address'].lower()]
    MANUAL={'HCFMO Hazmat Station2':'harris-county-hazmat-station-2','Marine Division':'sheriffs-marine-divison'}  # same address, different wording
    if not hit and o['building'].strip() in MANUAL and MANUAL[o['building'].strip()] in F: hit=[MANUAL[o['building'].strip()]]
    if hit:
        for k in hit: F[k]['oce']=rec
        matched+=1
    else:
        sid='oce-'+slug(o['building']); 
        F[sid]={'name':o['building'],'other':o['other'] or None,'address':(m.group(1)+' '+m.group(2)) if m else o['address'],'city':m.group(3).strip() if m else '','zip':m.group(4) if m else '',
                'section':None,'fss':None,'src':'oce','oce':rec,'monthsReview':False}
        oceonly.append(o['building'])
for f in F.values(): f.pop('ak',None)
json.dump(F,open(out,'w'),indent=0)
print('fss',sum(1 for f in F.values() if f['src']=='fss'),'oce matched',matched,'oce only',len(oceonly)); print(oceonly)
