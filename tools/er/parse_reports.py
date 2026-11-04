"""Read Emergency Reporting inspection report PDFs (text from pdftotext -layout) into structured records."""
import re, sys, json, glob, os
def clean(s): return re.sub(r'\s+',' ',s or '').strip()
def split_reports(txt):
    lines=txt.split('\n'); starts=[]
    for i,l in enumerate(lines):
        if 'Occupancy ID:' in l:
            for j in range(i-1,max(-1,i-6),-1):
                if re.match(r'\s*Occupancy:',lines[j]): starts.append(j); break
    out=[]
    for k,s in enumerate(starts):
        e=starts[k+1]-1 if k+1<len(starts) else len(lines)
        out.append('\n'.join(lines[s:e]))
    return out
def grab(pat,t,flags=0):
    m=re.search(pat,t,flags); return clean(m.group(1)) if m else None
def parse_report(t):
    r={}
    m=re.search(r'Occupancy:(.*?)\n(?=\s*Occupancy ID:)',t,re.S); r['occupancy']=clean(m.group(1)) if m else None; r['occ_id']=grab(r'Occupancy ID:\s*(.+)',t); r['address']=grab(r'Address:\s*(.+)',t)
    r['type']=grab(r'Inspection Type:\s*(.+)',t)
    m=re.search(r'Inspection Date:\s*(\d+/\d+/\d{4})\s+By:\s*([^(\n]+?)\s*\(([^)]*)\)',t)
    if m: r['date']=m.group(1); r['inspector']=clean(m.group(2)); r['unit']=m.group(3)
    r['form']=grab(r'Form:\s*(.+)',t)
    m=re.search(r'Time In:\s*(\d{1,2}:\d\d)\s+Time Out:\s*(\d{1,2}:\d\d)',t); 
    if m: r['tin'],r['tout']=m.group(1),m.group(2)
    r['authorized']=grab(r'Authorized Date:\s*(\S+)',t)
    nx=grab(r'Next Inspection Date:\s*(.+)',t); r['next']=nx
    # checklist items: Status lines with preceding question title
    items=[]; L=t.split('\n')
    for i,l in enumerate(L):
        m=re.match(r'\s*Status:\s*(PASS|FAIL|N/A|NA|Yes|No|\S+)',l)
        if m:
            # title = nearest non-empty line 2 lines above (question) ; notes = following "Notes:" block
            j=i-1; desc=[]
            while j>=0 and L[j].strip() and not L[j].strip().startswith('Notes:') and not L[j].strip().startswith('Status:'): desc.insert(0,L[j].strip()); j-=1
            q=desc[0] if desc else ''
            notes=[]; k=i+1
            if k<len(L) and L[k].strip().startswith('Notes:'):
                notes.append(L[k].strip()[6:].strip()); k+=1
                while k<len(L) and L[k].strip() and not re.match(r'\s*(Status:|Printed on|Additional Time|Summary:)',L[k]): notes.append(L[k].strip()); k+=1
            items.append({'q':clean(q),'status':m.group(1).upper(),'notes':clean(' '.join(notes))})
    r['items']=items
    r['fails']=[x for x in items if x['status']=='FAIL']
    m=re.search(r'Total Additional Time:\s*(\d+)\s*minutes',t); r['add_min']=int(m.group(1)) if m else 0
    m=re.search(r'Inspection Time:\s*(\d+)\s*minutes',t); r['insp_min']=int(m.group(1)) if m else None
    m=re.search(r'Total Time:\s*(\d+)\s*minutes',t); r['total_min']=int(m.group(1)) if m else None
    cats=re.findall(r'\n\s*([A-Z][A-Za-z /&-]+? - [A-Za-z /&()-]+?)\s{2,}(\d+/\d+/\d{4} [\d:]+ [AP]M)\s+(\d+/\d+/\d{4} [\d:]+ [AP]M)',t)
    r['time_items']=[{'cat':clean(c),'start':s,'end':e} for c,s,e in cats]
    res=re.findall(r'Overall Result:\s*(.+)',t); r['result']=clean(res[0]) if res else None; r['result_count']=len(res)
    r['coi']=sorted(set(re.findall(r'\b(20\d\d-1\d{4})\b',t)))
    r['pages']=t.count('Printed on')
    return r
def load_all(folder):
    recs=[]
    for f in sorted(glob.glob(folder+'/*.txt')):
        txt=open(f).read()
        for rt in split_reports(txt):
            r=parse_report(rt); r['file']=os.path.basename(f); recs.append(r)
    return recs
if __name__=='__main__':
    recs=load_all(sys.argv[1]); json.dump(recs,open(sys.argv[2],'w'),indent=1)
    print(len(recs),'reports')
