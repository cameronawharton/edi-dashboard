/* ------------------------------------------------------------------ Group views (Nov 9 2026, Cameron)
   Each group gets its own Overview: County (FSS / County), Schools (CO/ED Education) and General Occupancies.
   Leaders switch groups with chips; field members see their own group. Also: the Today schedule from a calendar
   export (.ics), season-to-date stats on My work, and the Feedback page (suggestions and bugs sent to the owner). */
const GROUPS={schools:{label:"Schools",divs:["education"]},county:{label:"County",divs:["county"]},general:{label:"General Occupancies",divs:["general"]}};
const groupOfDiv=d=>d==="county"?"county":d==="general"?"general":"schools";
const groupOf=t=>t?groupOfDiv(divOf(t)):null;
const appOwner=()=>appBuild()?((window.EDI_CONFIG.owners||[]).map(x=>String(x).toLowerCase()).includes(myEmail())):amCaptain();
S.ui.ovGroup=S.ui.ovGroup||null;
const viewGroup=()=>{ const me=myTeamMember(); if(fieldUser()) return groupOf(me); return S.ui.ovGroup||(me&&["education","county","general"].includes(divOf(me))?groupOf(me):"schools"); };
/* latest month with Emergency Reporting or action-code data for a set of divisions */
function latestMonthFor(divs){ const ms=Object.values(S.er).filter(d=>divs.includes(d.division||"education")).map(d=>d.month).concat(Object.values(S.actions).filter(d=>divs.includes(memDiv(d.member))).map(d=>d.month)); return ms.sort().pop()||null; }
const monLabel=m=>m?`${MONTHS_FULL[+m.slice(5)-1]} ${m.slice(0,4)}`:"";

/* ---------- Today (calendar export) */
S.sched=S.sched||{};
function icsParse(text){
  const lines=text.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"").split(/\r?\n/); const out=[]; let ev=null;
  const val=l=>l.slice(l.indexOf(":")+1).replace(/\\n/g," ").replace(/\\,/g,",").replace(/\\;/g,";").trim();
  const when=l=>{ const v=val(l); const m=v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/); if(!m) return null;
    if(/Z$/.test(v)&&m[4]){ const t=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])); const loc=new Date(t.toLocaleString("en-US",{timeZone:"America/Chicago"}));
      return {d:`${loc.getFullYear()}-${String(loc.getMonth()+1).padStart(2,"0")}-${String(loc.getDate()).padStart(2,"0")}`,t:`${String(loc.getHours()).padStart(2,"0")}:${String(loc.getMinutes()).padStart(2,"0")}`}; }
    return {d:`${m[1]}-${m[2]}-${m[3]}`,t:m[4]?`${m[4]}:${m[5]}`:""}; };
  for(const l of lines){
    if(l==="BEGIN:VEVENT") ev={who:[]}; else if(l==="END:VEVENT"){ if(ev&&ev.s) out.push(ev); ev=null; }
    else if(ev){ const k=l.split(/[;:]/)[0];
      if(k==="DTSTART") ev.s=when(l); else if(k==="DTEND") ev.e=when(l); else if(k==="SUMMARY") ev.t=val(l); else if(k==="LOCATION") ev.l=val(l);
      else if(k==="RRULE") ev.rr=val(l); else if(k==="ORGANIZER"||k==="ATTENDEE"){ const cn=(l.match(/CN="?([^";:]+)/)||[])[1]; if(cn) ev.who.push(cn.trim()); } } }
  return out; }
/* weekly repeats (the common Outlook case) are expanded; other repeat rules keep their first date only */
function icsEvents(text){ const from=isoAdd(todayISO(),-7), to=isoAdd(todayISO(),60), out=[];
  for(const ev of icsParse(text)){ const base={s:ev.s.t,e:ev.e&&ev.e.d===ev.s.d?ev.e.t:"",t:ev.t||"(no title)",l:ev.l||"",who:ev.who.slice(0,8)};
    const dates=[ev.s.d]; const rr=ev.rr||""; if(/FREQ=WEEKLY/.test(rr)){ const until=((rr.match(/UNTIL=(\d{8})/)||[])[1]||"").replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3")||to; const iv=+((rr.match(/INTERVAL=(\d+)/)||[])[1]||1);
      let d=ev.s.d; for(let i=0;i<120;i++){ d=isoAdd(d,7*iv); if(d>until||d>to) break; dates.push(d); } }
    dates.filter(d=>d>=from&&d<=to).forEach(d=>out.push(Object.assign({d},base))); }
  return out.sort((a,b)=>a.d.localeCompare(b.d)||String(a.s).localeCompare(String(b.s))).slice(0,2000); }
async function uploadSchedule(group,file){ const text=await file.text(); const events=icsEvents(text);
  if(!events.length){ flash("No events in the next 60 days were found in that file."); return; }
  const me=myTeamMember();
  await write(()=>S.db.doc("config/schedule-"+group).set({group,events,file:file.name,uploadedAt:new Date().toISOString(),by:me?me.id:(S.me.name||"")}),`${events.length} calendar entries loaded for ${GROUPS[group].label}`); }
function todayPanel(group,personId){ const sc=S.sched[group]; const today=todayISO();
  const nm=personId&&S.team[personId]?S.team[personId].name.split(" ").pop().toLowerCase():null;
  const mine=e=>!nm||(e.t+" "+(e.who||[]).join(" ")).toLowerCase().includes(nm);
  const evs=sc?sc.events.filter(mine):[]; const tod=evs.filter(e=>e.d===today), next=evs.filter(e=>e.d>today).slice(0,6);
  const row=e=>`<li><span class="mono gtime">${e.s?e.s+(e.e?"–"+e.e:""):"All day"}</span><span class="gev"><b>${esc(e.t)}</b>${e.l?`<small>${esc(e.l)}</small>`:""}</span></li>`;
  const up=isSupervisor()?`<label class="btn sm" style="margin-left:auto">Upload calendar<input type="file" accept=".ics,text/calendar" data-schedup="${group}" hidden></label>`:"";
  return `<section class="panel"><div class="ph"><h3>Today</h3><span class="faint">${wkDate(today,true)}</span>${up}</div><div class="pb">
    ${!sc?`<p style="margin:0">No calendar loaded for ${esc(GROUPS[group].label)} yet.${isSupervisor()?" In Outlook, save the team calendar as an .ics file (File > Save Calendar), then upload it here.":" A supervisor loads the team calendar here."}</p>`
    :`${tod.length?`<ul class="glist">${tod.map(row).join("")}</ul>`:`<p style="margin:0">${personId?"Nothing on the team calendar with your name today.":"Nothing on the team calendar today."}</p>`}
      ${next.length?`<div class="eyebrow" style="margin-top:12px">Coming up</div><ul class="glist">${next.map(e=>`<li><span class="mono gtime">${wkDate(e.d)}</span><span class="gev"><b>${esc(e.t)}</b><small>${e.s?e.s:"All day"}${e.l?" · "+esc(e.l):""}</small></span></li>`).join("")}</ul>`:""}
      <p class="method" style="margin:10px 0 0">From ${esc(sc.file||"a calendar export")}, loaded ${wkDate(sc.uploadedAt.slice(0,10))}${sc.by&&S.team[sc.by]?` by ${esc(memberName(sc.by))}`:""}. A live Outlook feed replaces this upload when county IT connects it.</p>`}
  </div></section>`; }

/* ---------- Overview by group */
function groupChips(g){ if(fieldUser()) return ""; return `<div class="chips" style="margin-bottom:14px">${Object.entries(GROUPS).map(([k,v])=>`<button class="chip" type="button" data-ovgroup="${k}" aria-pressed="${g===k}">${v.label}</button>`).join("")}</div>`; }
function snapshot(divs,title){ const m=latestMonthFor(divs); if(!m) return `<section class="panel"><div class="ph"><h3>${title}</h3></div><div class="pb"><p style="margin:0">No Emergency Reporting or action-code uploads yet.</p></div></section>`;
  const rows=Object.values(S.er).filter(d=>d.month===m&&divs.includes(d.division||"education")).flatMap(d=>d.rows.map(erLive));
  const acts=divs.reduce((s,dv)=>s+actRows(m,dv).length,0); const people=new Set(Object.values(S.er).filter(d=>d.month===m&&divs.includes(d.division||"education")).map(d=>d.inspector)).size;
  const tile=(v,l)=>`<div><b class="num">${v}</b><span>${l}</span></div>`;
  return `<section class="panel"><div class="ph"><h3>${title}</h3><span class="faint">${monLabel(m)}${m<todayISO().slice(0,7)?" · latest upload":""}</span><a class="faint" href="#stats" style="margin-left:auto;font-size:12.5px">Monthly stats</a></div><div class="pb"><div class="wktiles">
    ${tile(rows.length,"inspections")}${tile(rows.filter(r=>r.res==="fail").length,"found hazards")}${tile(rows.filter(r=>r.coi).length+rows.filter(r=>r.res==="conditional").length,"certificates issued")}${tile(acts,"action codes")}${tile(people,"people with uploads")}
  </div></div></section>`; }
function vOverviewGroup(M){ const g=viewGroup(); const head=groupChips(g);
  if(g==="county") return head+ovCounty(M);
  if(g==="general") return head+ovGeneral(M);
  return head+ovSchools(M); }

function ovSchools(M){ const W=S.windows[M.Y], today=todayISO(); const ids=edField();
  const rows=ids.map(id=>{ const lane=(W&&W.lanes[id])||[]; const cur=lane.find(b=>today>=b.start&&today<=b.end); const P=cur?blockProgress(M,cur):null;
    const left=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded"&&!f.visited).length;
    return `<tr class="click" data-person="${esc(id)}"><td>${avatar(id,26)} ${esc(memberName(id))}</td><td>${cur?`<b>${esc(cur.label)}</b><small class="faint" style="display:block">${wkDate(cur.start)} to ${wkDate(cur.end)}</small>`:'<span class="faint">No window this week</span>'}</td><td class="r mono">${P?`${P.done}/${P.n}`:"–"}</td><td>${P?`<span class="pill ${CAL_ST[P.st][1]}">${CAL_ST[P.st][0]}</span>`:""}</td><td class="r mono">${left}</td></tr>`; }).join("");
  const wk=W?calWeeks(W).find(x=>x.mon<=today&&today<=isoAdd(x.mon,6)):null;
  const behind=[]; ids.forEach(id=>((W&&W.lanes[id])||[]).forEach((b,bi)=>{ const P=blockProgress(M,b); if(P.st==="late"||P.st==="behind") behind.push({id,b,bi,P}); }));
  const due=M.facs.filter(f=>f.org&&f.state!=="excluded"&&!f.visited&&ids.includes(f.org.assignedTo)); const all=M.facs.filter(f=>f.org&&f.state!=="excluded"&&ids.includes(f.org.assignedTo));
  const byOrg={}; due.forEach(f=>{ (byOrg[f.orgId]=byOrg[f.orgId]||{o:f.org,n:0}).n++; });
  const prj=Object.entries(S.projects||{}).map(([id,p])=>Object.assign({id},p)).filter(p=>!/complete|closed|done/i.test(p.phase||""));
  return `<div class="gcols"><div class="gmain">
    ${behind.length?`<div class="notice bad"><b>${behind.length} district window${behind.length>1?"s are":" is"} behind schedule.</b> ${behind.map(x=>`<a href="#" data-calblk="${esc(x.id)}|${x.bi}">${esc(x.b.label)} (${esc(memberName(x.id,"first"))}, ${x.P.n-x.P.done} left)</a>`).join(" · ")}</div>`:""}
    <section class="panel"><div class="ph"><h3>This week</h3><span class="faint">${wk&&wk.br?esc(wk.br)+": open for catch-up":"District each inspector is working"}</span><a class="faint" href="#calendar" style="margin-left:auto;font-size:12.5px">Inspection calendar</a></div>
      <div class="pb" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr><th>Inspector</th><th>District this week</th><th class="r">Done</th><th>Status</th><th class="r">Left this season</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="panel"><div class="ph"><h3>Campuses still due this season</h3><span class="faint">${due.length} of ${all.length} · every campus is due every year</span></div><div class="pb">
      <div class="meter" style="margin-bottom:12px"><i style="width:${all.length?(all.length-due.length)/all.length*100:0}%"></i></div>
      <div class="eyebrow">ISDs</div><div class="gchips" style="margin:6px 0 12px">${Object.entries(byOrg).filter(([,x])=>x.o.type==="ISD").sort((a,b)=>b[1].n-a[1].n).map(([oid,x])=>`<a class="gchip" href="#org-${esc(oid)}">${esc(x.o.name)} <b>${x.n}</b></a>`).join("")}</div>
      <div class="eyebrow">Charters, privates and daycares</div><div class="gchips" style="margin-top:6px">${["Charter","Private","Daycare"].map(ty=>{ const n=due.filter(f=>f.org.type===ty).length, o=Object.values(byOrg).filter(x=>x.o.type===ty).length; return n?`<a class="gchip" href="#districts">${ty==="Private"?"Privates":ty+"s"} <b>${n}</b><small class="faint">${o} operator${o>1?"s":""}</small></a>`:""; }).join("")}</div></div></section>
    <section class="panel"><div class="ph"><h3>Construction projects underway</h3><span class="faint">${prj.length}</span><a class="faint" href="#projects" style="margin-left:auto;font-size:12.5px">Active projects</a></div><div class="pb">
      ${prj.length?`<ul class="glist">${prj.map(p=>`<li><span class="gev"><b>${esc(p.name)}</b><small>${esc((S.orgs[p.org]||{}).name||p.org||"")} · ${esc(p.kind||"")} · ${esc(p.phase||"")}${p.owner&&S.team[p.owner]?" · "+esc(memberName(p.owner)):""}</small></span></li>`).join("")}</ul>`:'<p style="margin:0">No projects on file.</p>'}</div></section>
  </div><div class="gside">${todayPanel("schools")}${snapshot(["education"],"Schools this month")}</div></div>
  <details class="gmore"><summary>District coverage detail</summary>${vOverview(M)}</details>`; }

function ovCounty(M){ const today=todayISO(), m=+today.slice(5,7); const I=cfacInspections(); const bl=cfacList();
  const ids=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)==="county").map(([k])=>k);
  const fu=ids.flatMap(id=>followUps(id).map(x=>Object.assign({id},x))).sort((a,b)=>String(a.due||"9").localeCompare(String(b.due||"9"))||a.r.date.localeCompare(b.r.date));
  const ann=bl.filter(f=>f.annualMonth===m), semi=bl.filter(f=>f.semiMonth===m);
  const done=f=>(I[f.id]||[]).some(r=>r.date.slice(0,7)===today.slice(0,7));
  const sys=f=>{ const s=f.systems||{}; return [s.fireAlarm&&"Fire alarm",s.sprinkler&&"Sprinkler",s.suppression&&"Suppression",s.kitchenHood&&"Kitchen hood",s.standpipes&&"Standpipes",f.bda==="yes"&&"BDA"].filter(Boolean); };
  const bRow=(f,kind)=>`<li><button class="wkfac" type="button" data-cfac="${esc(f.id)}"><b>${esc(f.name)}</b><small>${kind} · ${f.fss&&S.team[f.fss]?esc(memberName(f.fss)):"No owner"}${f.monthsReview?' · <span class="mrev">month to review</span>':""}${sys(f).length?" · "+sys(f).join(", "):""}</small></button>${done(f)?'<span class="pill s-done">Done</span>':""}</li>`;
  const fuRows=fu.slice(0,12).map(x=>`<li><span class="gev"><b>${esc(x.r.occ)}</b><small>${esc(memberName(x.id))} · failed ${wkDate(x.r.date)} · ${x.due?(x.st==="overdue"?"overdue since ":"due ")+wkDate(x.due):"no next date in ER yet"}</small></span><span class="pill ${x.st==="unknown"?"s-due":FU_ST[x.st][1]}">${x.st==="unknown"?"Re-inspection owed":FU_ST[x.st][0]}</span></li>`).join("");
  return `<div class="gcols"><div class="gmain">
    <section class="panel"><div class="ph"><h3>Re-inspections coming up</h3><span class="faint">${fu.length} open</span></div><div class="pb">${fu.length?`<ul class="glist">${fuRows}</ul>${fu.length>12?`<p class="faint" style="margin:8px 0 0;font-size:12.5px">${fu.length-12} more on each person's My work page.</p>`:""}`:'<p style="margin:0">No failed inspections waiting on a re-inspection.</p>'}</div></section>
    <section class="panel"><div class="ph"><h3>Due in ${MONTHS_FULL[m-1]}</h3><span class="faint">${ann.length} annual · ${semi.length} semi-annual</span><a class="faint" href="#county" style="margin-left:auto;font-size:12.5px">County facilities</a></div><div class="pb">
      ${ann.length||semi.length?`<ul class="glist">${ann.map(f=>bRow(f,"Annual")).join("")}${semi.map(f=>bRow(f,"Semi-annual")).join("")}</ul>`:'<p style="margin:0">Nothing is due this month.</p>'}
      <p class="method" style="margin:8px 0 0">${bl.filter(f=>f.monthsReview).length} buildings still have inspection months to review, so this list grows as owners set them.</p></div></section>
  </div><div class="gside">${todayPanel("county")}${snapshot(["county"],"County this month")}</div></div>`; }

function ovGeneral(M){ const ppl=Object.entries(S.team).filter(([,t])=>t.active!==false&&divOf(t)==="general");
  const sec=s=>ppl.filter(([,t])=>(t.section||"").includes(s));
  const card=(title,list)=>`<section class="panel"><div class="ph"><h3>${title}</h3><span class="faint">${list.length}</span></div><div class="pb gchips">${list.map(([id])=>`<span class="ot-chip" data-person="${esc(id)}" role="link" tabindex="0">${avatar(id,22)}${esc(memberName(id))}</span>`).join("")}</div></section>`;
  return `<div class="gcols"><div class="gmain">
    <div class="notice">General Occupancies is set up with ${ppl.length} people. Its inspections, follow-ups and numbers fill in here once their Emergency Reporting exports and action codes are loaded, the same way CO/ED's are.</div>
    ${card("East · Sgt. Lawhorn",sec("East"))}${card("West · Sgt. Kveton",sec("West"))}
  </div><div class="gside">${todayPanel("general")}${snapshot(["general"],"General Occupancies this month")}</div></div>`; }

/* ---------- My work: everything uploaded so far, by month */
function wkSeason(id){ const ms=workMonths(id).slice().sort(); if(!ms.length) return "";
  const self=seesHoursOf(id)&&!hoursExempt(id);
  const row=m=>{ const rows=Object.values(S.er).filter(d=>d.month===m&&d.inspector===id).flatMap(d=>d.rows.map(erLive)); const a=actRows(m,memDiv(id),id).length; const h=self?personHours(id,m):null;
    return {m,n:rows.length,f:rows.filter(r=>r.res==="fail").length,c:rows.filter(r=>r.coi).length+rows.filter(r=>r.res==="conditional").length,a,h:h?h.perDay:null}; };
  const R=ms.map(row), T=R.reduce((s,r)=>({n:s.n+r.n,f:s.f+r.f,c:s.c+r.c,a:s.a+r.a}),{n:0,f:0,c:0,a:0});
  return `<section class="panel" id="wk-season"><div class="ph"><h3>Everything uploaded so far</h3><span class="faint">${ms.length} month${ms.length>1?"s":""}</span></div><div class="pb" style="padding:0;overflow-x:auto"><table class="tbl"><thead><tr><th>Month</th><th class="r">Inspections</th><th class="r">Hazards</th><th class="r">Certificates</th><th class="r">Action codes</th>${self?'<th class="r">Hours/day</th>':""}</tr></thead>
    <tbody>${R.map(r=>`<tr><td>${MON3[+r.m.slice(5)-1]} ${r.m.slice(0,4)}</td><td class="r mono">${r.n}</td><td class="r mono">${r.f}</td><td class="r mono">${r.c}</td><td class="r mono">${r.a}</td>${self?`<td class="r mono">${r.h!=null?r.h.toFixed(1):"–"}</td>`:""}</tr>`).join("")}
    <tr class="gtot"><td>Total</td><td class="r mono">${T.n}</td><td class="r mono">${T.f}</td><td class="r mono">${T.c}</td><td class="r mono">${T.a}</td>${self?"<td></td>":""}</tr></tbody></table></div></section>`; }

/* ---------- Feedback */
S.feedback=S.feedback||{}; S.ui.fbSent=S.ui.fbSent||[];
const FB_TYPES=["Suggestion","Bug","Data correction"], FB_ST={new:"New",considering:"Considering",done:"Done",no:"Not now"};
function vFeedback(){ const me=myTeamMember(); const signed=!!S.me.id&&S.canWrite;
  const form=signed?`<section class="panel"><div class="ph"><h3>Send a suggestion or report a problem</h3></div><div class="pb">
      <form id="fbform" class="fbform"><div class="fbrow"><label>Type<select name="type">${FB_TYPES.map(t=>`<option>${t}</option>`).join("")}</select></label>
      <label>Page<select name="page">${VIEWS.filter(v=>v[0]!=="feedback").map(v=>`<option value="${v[0]}" ${v[0]===S.ui.fbFrom?"selected":""}>${esc(v[1])}</option>`).join("")}</select></label></div>
      <label>What should change, or what went wrong?<textarea name="text" rows="5" maxlength="3000" required placeholder="Plain words are fine. For a problem, say what you clicked and what you expected."></textarea></label>
      <button class="btn primary" type="submit">Send</button></form>
      ${S.ui.fbSent.length?`<p class="faint" style="margin:10px 0 0;font-size:12.5px">Sent this visit: ${S.ui.fbSent.length}. Capt. Wharton reviews every one.</p>`:""}</div></section>`
    :`<section class="panel"><div class="pb"><p style="margin:0">Sign in with your county email (bottom left, "Sign in to edit") to send suggestions and problem reports.</p></div></section>`;
  const list=Object.entries(S.feedback).map(([id,f])=>Object.assign({id},f)).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const inbox=appOwner()?`<section class="panel"><div class="ph"><h3>Everything sent in</h3><span class="faint">${list.filter(f=>(f.status||"new")==="new").length} new · ${list.length} total</span><button class="btn sm" type="button" data-act="fb-export" style="margin-left:auto">Export for Claude</button></div><div class="pb">
      ${list.length?`<ul class="glist">${list.map(f=>`<li class="fbitem"><span class="gev"><b>${esc(f.type||"Suggestion")} · ${esc((VIEWS.find(v=>v[0]===f.page)||[0,f.page||""])[1])}</b><span class="fbtext">${esc(f.text||"")}</span><small>${esc(f.name||f.email||"")} · ${wkDate(String(f.at).slice(0,10))}</small></span>
        <select data-fbst="${esc(f.id)}" aria-label="Status">${Object.entries(FB_ST).map(([k,l])=>`<option value="${k}" ${(f.status||"new")===k?"selected":""}>${l}</option>`).join("")}</select></li>`).join("")}</ul>`:'<p style="margin:0">Nothing sent in yet.</p>'}
      <p class="method" style="margin:10px 0 0">"Export for Claude" saves a file to your Downloads folder. Tell Claude it is there and it picks the items up from your computer.</p></div></section>`:"";
  return `<div class="sechead"><p class="muted" style="margin:0;max-width:70ch">Ideas, problems and wrong numbers all go to Capt. Wharton, who reviews them and decides what changes in the app.</p></div>${form}${inbox}`; }

document.addEventListener("click",e=>{ const g=e.target.closest("[data-ovgroup]"); if(g){ S.ui.ovGroup=g.dataset.ovgroup; render(); return; }
  if(e.target.closest('[data-act="fb-export"]')){ const items=Object.entries(S.feedback).map(([id,f])=>Object.assign({id},f)); saveFile(`insight-feedback-${todayISO()}.json`,JSON.stringify({exported:new Date().toISOString(),items},null,1)); } });
document.addEventListener("change",async e=>{ const t=e.target;
  if(t.matches("[data-schedup]")&&t.files[0]){ await uploadSchedule(t.dataset.schedup,t.files[0]); t.value=""; }
  if(t.matches("[data-fbst]")) await write(()=>S.db.doc("feedback/"+t.dataset.fbst).update({status:t.value,statusAt:new Date().toISOString()}),"Status saved"); });
document.addEventListener("submit",async e=>{ if(e.target.id!=="fbform") return; e.preventDefault(); const f=e.target; const text=f.text.value.trim(); if(!text) return;
  const me=myTeamMember(); const id=`fb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const ok=await write(()=>S.db.doc("feedback/"+id).set({type:f.type.value,page:f.page.value,text,uid:S.me.id,email:myEmail(),name:me?memberName(me.id):(S.me.name||""),member:me?me.id:null,at:new Date().toISOString(),status:"new"}),"Sent. Thank you.");
  if(ok){ S.ui.fbSent.push(id); f.reset(); render(); } });
