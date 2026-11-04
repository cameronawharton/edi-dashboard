import pdfplumber,re,json,sys,collections
pdf=pdfplumber.open(sys.argv[1]); rows=[]; code=None
for pg in pdf.pages:
    for tb in pg.extract_tables():
        for row in tb:
            c=[(x or '').replace('\n',' ').strip() for x in row]
            if not any(c): continue
            if c[0] and all(not x for x in c[1:]) and re.match(r'^[A-Z][A-Za-z0-9/&]* - ',c[0]): code=c[0]; continue
            if c[0]=='ID' or 'Harris County Fire Marshal' in c[0] or 'Occupancies for Action' in c[0]: continue
            if len(c)>=6 and re.match(r'\d{1,2}/\d{1,2}/\d{4}',c[3]):
                rows.append(dict(code=code,id=re.sub(r'\s','',c[0]),name=c[1],addr=c[2],date=c[3],person=c[4],desc=c[5]))
            elif rows and not c[3] and (c[5] or c[1]):   # continuation across a page break
                rows[-1]['desc']+=' '+c[5]
json.dump(rows,open(sys.argv[2],'w'),indent=1)
print(len(rows),'action rows'); print(collections.Counter(r['code'] for r in rows))
