"""Build the dashboard: splice parts/ into base.html, inject the map geometry, write dist/tracker.html.
Usage: python3 dashboard/build.py      (run from anywhere)
dist/ also gets logos/ and streets/, the files published next to the page. Team photos are not in git; they are already
published with the live artifact and stay there between publishes."""
import os,shutil
HERE=os.path.dirname(os.path.abspath(__file__)); DIST=os.path.join(os.path.dirname(HERE),'dist')
s=open(os.path.join(HERE,'base.html')).read()
P=os.path.join(HERE,'parts')+'/'
css=open(P+'stats.css').read()+open(P+'people.css').read()+open(P+'detail.css').read()+open(P+'command.css').read(); js=open(P+'stats.js').read()+'\n'+open(P+'detail.js').read()+'\n'+open(P+'people.js').read()+'\n'+open(P+'actions.js').read()+'\n'+open(P+'command.js').read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a)); s=s.replace(a,b)
rep('@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}\n</style>', css+'@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}\n</style>')
rep('\nboot();\n</script>','\n'+js+'\nboot();\n</script>')
rep('["insights","Insights"],','["insights","Insights"],["stats","Monthly stats"],["brief","Command summary"],')
rep('insights:vInsights,','insights:vInsights,stats:vStats,brief:vBrief,person:vPerson,')
rep('el.innerHTML=fn(M);','el.innerHTML=S.ui.view==="person"?vPerson(M,S.ui.param):fn(M);')
rep('sub("inbox","inbox");','sub("inbox","inbox"); sub("er","er"); sub("stats","stats"); sub("log","log"); sub("actions","actions"); sub("flags","flags");')
rep('const fn={overview','if((S.ui.view==="stats"||S.ui.view==="brief")&&!S.loaded.ledgers){ el.innerHTML=`<div class="skeleton">Loading…</div>`; return; }\n  const fn={overview')
rep("""<span class="faint">No inspections on record.</span><span></span></div>`}</div>""","""<span class="faint">No inspections on record.</span><span></span></div>`}</div>${erActivityHTML(fid)}""")
# routing
rep('''if(h.startsWith("org-")){S.ui.view="org";S.ui.param=h.slice(4);}''','''if(h.startsWith("org-")){S.ui.view="org";S.ui.param=h.slice(4);} else if(h==="me"||h.startsWith("person-")){S.ui.view="person";S.ui.param=h==="me"?"me":h.slice(7); if(S.ui.pp) S.ui.pp.month=null;}''')
rep('''(k==="districts"&&S.ui.view==="org")''','''(k==="districts"&&S.ui.view==="org")||(k==="team"&&S.ui.view==="person")''')
rep('''const title = S.ui.view==="org" ? (S.orgs[S.ui.param]?.name||"District") :''','''const title = S.ui.view==="org" ? (S.orgs[S.ui.param]?.name||"District") : S.ui.view==="person" ? (S.ui.param==="me"?"My profile":"Profile") :''')
# header chip
rep('''<button class="btn primary" id="logbtn" type="button">+ Log inspection</button>''','''<button class="mechip" id="mechip" type="button" aria-label="Your profile"></button>
      <button class="btn primary" id="logbtn" type="button">+ Log inspection</button>''')
rep('''  $("#logbtn").hidden=!S.canWrite;''','''  $("#logbtn").hidden=!S.canWrite; { const mc=$("#mechip"); if(mc) mc.innerHTML=meChipHTML(); }''')
rep('''<span>${S.me.name?esc(S.me.name):"Signed in"} · ${myTeamMember()?esc(myTeamMember().name):'<a href="#team">link your name</a>'}</span>''','''<span>${myTeamMember()?`<a href="#me">${esc(memberName(myTeamMember().id,"rank"))}</a>`:`${S.me.name?esc(S.me.name):"Signed in"} · <a href="#" data-act="claim-open">choose your profile</a>`}</span>''')
# team page: field members only in productivity cards, leadership strip, photos, profile links
rep('''const ids=[...Object.keys(S.team).filter(k=>S.team[k].active!==false),''','''const ids=[...Object.keys(S.team).filter(k=>isField(S.team[k])&&divOf(S.team[k])===(S.ui.teamDiv||"education")),''')
rep('''<span class="avatar" style="background:${teamColor(id)}">${esc(name.split(" ").map(w=>w[0]).join("").slice(0,2))}</span><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(name)}</div>''','''${avatar(id,44)}<div style="flex:1;min-width:0"><div class="nm" ${S.team[id]?`data-person="${esc(id)}"`:""}>${esc(S.team[id]?memberName(id):name)}</div><div class="faint" style="font-size:11.5px">${S.team[id]?esc(roleOf(S.team[id]).label)+(S.team[id].unit?" · "+esc(S.team[id].unit):""):""}</div>''')
rep('''${S.canWrite&&S.team[id]&&!myTeamMember()&&!linked&&S.me.id?`<button class="btn sm" data-act="link-me" data-team="${id}" type="button">This is me</button>`:""}''','''${S.canWrite&&S.team[id]&&!myTeamMember()&&!linked&&S.me.id?`<button class="btn sm" data-act="claim" data-team="${id}" type="button">This is me</button>`:""}''')
rep('''  <div class="teamgrid">${cards}</div>''','''  ${(()=>{ const lead=Object.entries(S.team).filter(([,x])=>x.active!==false&&!isField(x)); return `<div class="chips">${Object.entries(DIVS).map(([k,l])=>`<button class="chip" type="button" data-teamdiv="${k}" aria-pressed="${(S.ui.teamDiv||"education")===k}">${l} <span class="faint">${Object.values(S.team).filter(x=>isField(x)&&divOf(x)===k).length}</span></button>`).join("")}</div>`+(lead.length?`<div class="leadrow">${lead.map(([lid,x])=>`<div class="leadcard" data-person="${esc(lid)}" role="link" tabindex="0">${avatar(lid,44)}<div><b>${esc(memberName(lid))}</b><small>${esc(roleOf(x).label)}${x.userId===S.me.id?" · you":""}</small></div></div>`).join("")}</div>`:""); })()}
  <div class="teamgrid">${cards}</div>''')
# assignments on team page, small fixes
rep('''  <p class="faint" style="font-size:12.5px;max-width:75ch;margin:0">Visits from the spreadsheets carry no inspector name, so they are credited to the inspector assigned to that district on the workbook. New visits logged here record the inspector chosen on the form and the account that entered them. Link your account with “This is me” so the form picks your name by default.</p>''','''  ${assignPanel(M)}
  <p class="faint" style="font-size:12.5px;max-width:75ch;margin:0">Visits from the spreadsheets carry no inspector name, so they were credited to the inspector assigned to that district on the workbook. Visits logged here or imported from Emergency Reporting carry the actual inspector. Choose your profile at the top right so the forms pick your name by default.</p>''')
rep('''$("#rotchip").textContent="Rotation "+rotationFor(curYear());''','''$("#rotchip").textContent="Rotation "+rotationFor(curYear()); { const yp=$(".yearpick"); if(yp) yp.style.display=(S.ui.view==="stats"||S.ui.view==="brief"||S.ui.view==="person")?"none":""; }''')
rep('''["import","Import CSV"]''','''["import","Import other CSV"]''')
rep('''<p class="muted" style="margin:0;max-width:75ch">Bring in inspection visits from another system or an old spreadsheet tab saved as CSV.''','''<div class="notice">Emergency Reporting exports go through <a href="#stats">Monthly stats</a> → Import Emergency Reporting, not here.</div><p class="muted" style="margin:0;max-width:75ch">Bring in inspection visits from another system or an old spreadsheet tab saved as CSV.''')

# detail: logos and street maps
rep('''openModal(`<div class="mh"><h2>${esc(f.name)}</h2>''','''openModal(`<div class="mh"><h2>${logoImg(logoFor(f),40)}${esc(f.name)}</h2>''')
rep('''<div class="muted">${esc(f.address||"No address on file")}${gm?` · <a href="${gm}" target="_blank" rel="noopener">Open in Google Maps</a>`:""}</div>''','''<div class="muted">${esc(f.address||"No address on file")}${gm?` · <a href="${gm}" target="_blank" rel="noopener">Open in Google Maps</a>`:""}</div>${streetMapHTML(f)}''')
rep('''<div><span class="eyebrow">${M.Y} · Rotation ${M.L} · ${esc(teamName(o.assignedTo))}</span><h2>${esc(o.name)}</h2></div>''','''<div class="brandrow">${logoImg(o.logo,52)}<div><span class="eyebrow">${M.Y} · Rotation ${M.L} · ${esc(teamName(o.assignedTo))}</span><h2>${esc(o.name)}</h2></div></div>''')
rep('''  <section class="panel"><div class="pb orghead">''','''  <div class="orgbrand">${logoImg(o.logo,72)}<div><span class="eyebrow">${TYPE_LABEL[o.type]}${o.assignedTo?" · "+esc(teamName(o.assignedTo)):""}</span><h2>${esc(o.name)}</h2></div></div>
  <section class="panel"><div class="pb orghead">''')
rep('''<g id="g-roads" ${mp.layers.roads?"":"hidden"}>''','''<g id="g-streets"></g><g id="g-roads" ${mp.layers.roads?"":"hidden"}>''')
rep('''  svg.innerHTML=h;
  MAPSTATE={M,hover:null};''','''  svg.innerHTML=h;
  MAPSTATE={M,hover:null}; drawStreets();''')
rep('''tip.textContent=`${f.name} · ${STATE_LABEL[f.state]}`; }''','''tip.innerHTML=`<span class="tl">${logoImg(logoFor(f),28)}<span>${esc(f.name)} · ${STATE_LABEL[f.state]}</span></span>`; }''')
rep('''...new Set(vs.map(v=>v.inspector||"_none").filter(x=>!S.team[x]))]''','''...((S.ui.teamDiv||"education")==="education"?new Set(vs.map(v=>v.inspector||"_none").filter(x=>!S.team[x])):[])]''')
# contacts: tap to call or email
rep('''${c.phone?`<div class="mono">${esc(c.phone)}</div>`:""}${c.email?`<div class="email mono">${esc(c.email)}</div>`:""}''','''${c.phone?`<a class="mono clink" href="${telHref(c.phone)}">${esc(c.phone)}</a>`:""}${c.email?`<a class="email mono clink" href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}''')
rep('''<span class="ln"><span class="mono">${esc(c.phone)}</span>''','''<span class="ln"><a class="mono clink" href="${telHref(c.phone)}">${esc(c.phone)}</a>''')
rep('''<span class="ln"><span class="mono">${esc(c.email)}</span>''','''<span class="ln"><a class="mono clink" href="mailto:${esc(c.email)}">${esc(c.email)}</a>''')
ROTSTAT='    ${isISD?`<div class="stat"><span class="eyebrow">Rotation ${M.L}</span><b class="num">${s.rotDone}<span class="faint" style="font-size:18px">/${s.rotTotal}</span></b><span class="faint" style="font-size:12px">A ${rotCounts.A} · B ${rotCounts.B} · C ${rotCounts.C}</span></div>`:""}\n'
# No rotation (Nov 4 2026): every school, private, charter and daycare is due every season, target 100%.
rep('function settings(){ return Object.assign({yearStartMonth:8,workEndMonth:5,rotationAnchor:{year:"2025-26",letter:"A"},targets:{ISD:.30,Charter:1,Private:1,Daycare:1}}, S.settings||{}); }',
    'function settings(){ return Object.assign({yearStartMonth:8,workEndMonth:5,rotationAnchor:{year:"2025-26",letter:"A"}}, S.settings||{}, {targets:{ISD:1,Charter:1,Private:1,Daycare:1}}); }')
rep('function target(org){ return org.target ?? settings().targets[org.type] ?? 1; }','function target(org){ return 1; }')
rep('const required = f.type!=="ISD" ? true : (f.rotation===L || f.rotation==="ABC" || (f.flags||[]).includes("walk-every-year"));','const required = true;')
rep('    else if(f.type==="ISD" && !f.rotation) f.state="unassigned";\n','')
rep('<span class="rot-chip" id="rotchip" title="Rotation group inspected this year">B</span>','<span class="rot-chip" id="rotchip" hidden></span>')
rep('$("#rotchip").textContent="Rotation "+rotationFor(curYear());','')
rep("<span class=\"muted\">Rotation <b>${M.L}</b> is this year's 30% group. Pace line","<span class=\"muted\">Every school, private, charter and daycare is due every season. Pace line")
rep('<th class="r hide-sm">Rot. ${M.L}</th><th class="r">To ${pct(settings().targets.ISD)}</th>','<th class="r">Still needed</th>')
rep('<td class="r num mono hide-sm">${s.rotDone}/${s.rotTotal}</td><td class="r num mono">${s.need?','<td class="r num mono">${s.need?')
rep(ROTSTAT,'')
rep('${isISD?`<span style="flex:1"></span><div class="chips">${[["all","All"],["A","Rotation A"]','${false?`<span style="flex:1"></span><div class="chips">${[["all","All"],["A","Rotation A"]')
rep('<th>Facility</th>${isISD?"<th>Rot.</th>":""}','<th>Facility</th>')
rep('    ${isISD?`<td>${rotBadge(f.rotation,M.L)}</td>`:""}<td>${f.state==="excluded"','    <td>${f.state==="excluded"')
# app name (Nov 4 2026): Education Division Insight -> CO/ED Division Insight
assert s.count("Education Division Insight")==4, s.count("Education Division Insight")
s=s.replace("Education Division Insight","CO/ED Division Insight")
html=s.replace('__GEO__',open(os.path.join(HERE,'assets','geo_map.json')).read())
os.makedirs(DIST,exist_ok=True); open(os.path.join(DIST,'tracker.html'),'w').write(html)
for sub in ('logos','streets'):
    shutil.copytree(os.path.join(HERE,'assets',sub),os.path.join(DIST,sub),dirs_exist_ok=True)
print('dist/tracker.html',len(html)//1024,'KB')
