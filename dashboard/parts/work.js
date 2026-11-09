/* ------------------------------------------------------------------ My work: the field member's landing page (Nov 4 2026, from the inspector interview)
   Actionable first: what is coming up (district window, campuses left, who to call), follow-ups owed, what to fix in ER, then their own numbers
   and the team's progress (never other people's hours). Everything here is read from ER, the calendar and the district records: nothing is entered twice. */
S.ui.work=S.ui.work||{who:null,month:null,all:false};
const WK_DAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const wkDate=(iso,dow)=>{ if(!iso) return ""; const t=new Date(iso.slice(0,10)+"T12:00:00Z"); return `${dow?WK_DAY[t.getUTCDay()]+" ":""}${MON3[t.getUTCMonth()]} ${t.getUTCDate()}`; };
const navField=()=>{ const m=myTeamMember(); const d=m?divOf(m):"education";
  return d==="county"?["work","overview","county","team","feedback"]:d==="general"?["work","overview","team","feedback"]:["work","overview","calendar","map","districts","team","feedback"]; };
function navViews(){ return fieldUser()?navField().map(k=>VIEWS.find(v=>v[0]===k)).filter(Boolean):VIEWS; }
/* first page after sign-in: field members land on My work */
function landWork(){ autoLink(); if(S.ui._landed||!S.me.id||!Object.keys(S.team).length) return; S.ui._landed=true; if(!location.hash&&fieldUser()){ S.ui.view="work"; S.ui.param=null; } }

/* the district contact to schedule through: point of contact or facilities/safety lead before the superintendent */
function leadContact(o){ const cs=(o&&o.contacts||[]).filter(c=>c&&(c.phone||c.email)); if(!cs.length) return null;
  const rank=c=>{ const r=String(c.role||"").toLowerCase(); return /point of contact/.test(r)?0:/facilit|mainten|fire|safety|emergenc|security|operat/.test(r)?1:/csss|director|campus/.test(r)?2:/superintendent/.test(r)?4:3; };
  return cs.slice().sort((a,b)=>rank(a)-rank(b))[0]; }
function contactHTML(c,small){ if(!c) return `<span class="faint">No contact on file</span>`;
  return `<span class="wkc ${small?"sm":""}"><b>${esc(c.name||"")}</b>${c.role?`<small>${esc(c.role)}</small>`:""}${c.phone?`<a class="btn sm" href="${telHref(c.phone)}">Call</a>`:""}${c.email?`<a class="btn sm" href="mailto:${esc(c.email)}">Email</a>`:""}</span>`; }
const dirHref=f=>{ const q=f.address?`${f.address}${f.city?", "+f.city:""}, TX`:f.lat!=null?`${f.lat},${f.lng}`:""; return q?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`:""; };
const lastVisit=f=>(f.visitsAll||[]).filter(v=>!v.voided&&v.date).map(v=>v.date).sort().pop()||null;
/* pre-filled scheduling email to the district lead, campuses still due listed */
function scheduleMail(id,o,c,b,fs){ if(!c||!c.email) return "";
  const first=String(c.name||"").replace(/^(dr|mr|mrs|ms)\.?\s+/i,"").split(" ")[0]||"";
  const subj=`Fire inspections: ${o.name} campuses, ${wkDate(b.start)} to ${wkDate(b.end)}`;
  let list=""; let n=0; for(const f of fs){ const ln=`- ${f.name}${f.address?` (${f.address})`:""}\n`; if((list+ln).length>1100) break; list+=ln; n++; } if(n<fs.length) list+=`- and ${fs.length-n} more\n`;
  const body=`Good morning${first?" "+first:""},\n\nI am scheduling the annual fire inspections for ${o.name} campuses between ${wkDate(b.start)} and ${wkDate(b.end)}. These campuses are still due this school year:\n\n${list}\nPlease send me dates and times that work, and the best contact at each campus.\n\nThank you,\n${memberName(id)}\nHarris County Fire Marshal's Office`;
  return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`; }

/* follow-ups owed by a person: the latest inspection at an occupancy failed (or passed with conditions and a next date), and it was theirs */
function followUps(id){ const by={};
  Object.values(S.er).forEach(d=>d.rows.forEach(r=>{ if(r.res==="unknown") return; const k=r.id+"|"+erNorm(r.occ); (by[k]=by[k]||[]).push(Object.assign({member:d.inspector,month:d.month},erLive(r))); }));
  const today=todayISO(), out=[];
  Object.values(by).forEach(list=>{ list.sort((a,b)=>a.date.localeCompare(b.date)||String(a.tin).localeCompare(String(b.tin))); const r=list[list.length-1];
    if(r.member!==id) return; if(!(r.res==="fail"||(r.res==="conditional"&&r.nx&&r.nx.d))) return;
    const due=r.nx&&r.nx.d||null; const st=!due?(r.src?"nodate":"unknown"):due<today?"overdue":days(today,due)<=7?"week":"later";
    out.push({r,due,st,age:days(r.date,today)}); });
  const ord={overdue:0,nodate:1,week:2,later:3,unknown:4};
  return out.sort((a,b)=>ord[a.st]-ord[b.st]||String(a.due||a.r.date).localeCompare(String(b.due||b.r.date))); }
const FU_ST={overdue:["Overdue","s-failed"],nodate:["No next date in ER","s-failed"],week:["Due this week","s-due"],later:["Scheduled","s-off"],unknown:["Next date not loaded",""]};
const icsEsc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
/* one Outlook appointment, titled the way the team names them: type and campus */
function followUpICS(r){ const d=r.nx.d.replace(/-/g,""), d2=isoAdd(r.nx.d,1).replace(/-/g,""), stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
  const fails=(r.fl||[]).filter(x=>!/^Printed on |^Inspection Topics:?$/i.test(x.q||"")).length;
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HCFMO//Prevention Services Insight//EN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${erNorm(r.k)}@coed-insight`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${d2}`,
    `SUMMARY:${icsEsc(`${r.nx.t||"Follow-up"} ${r.occ}`)}`,`LOCATION:${icsEsc([r.addr,r.city].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${icsEsc(`Occupancy ${r.id}. ${r.rt||"Failed"} on ${wkDate(r.date)} ${r.date.slice(0,4)}${fails?`, ${fails} item${fails>1?"s":""} to recheck`:""}. Set the time when you confirm with the site.`)}`,
    "TRANSP:TRANSPARENT","END:VEVENT","END:VCALENDAR"].join("\r\n")+"\r\n"; }

/* things only the person can fix, at the source */
function fixItems(id){ const div=memDiv(id), out={flags:[],noTime:[],noDate:[]};
  const months=[...new Set(Object.values(S.actions).filter(d=>d.member===id).map(d=>d.month))].sort().reverse();
  months.forEach(m=>{ assistCheck(m,div).filter(o=>o.a.member===id&&FLAGGED.includes(o.check)&&["open","sentback"].includes(flagState(o))).forEach(o=>out.flags.push(o));
    const h=actHours(id,m); if(h.noH) out.noTime.push({month:m,n:h.noH,by:h.missByCode||{}}); });
  out.noDate=followUps(id).filter(x=>x.st==="nodate");
  out.n=out.flags.length+out.noTime.reduce((s,x)=>s+x.n,0)+out.noDate.length; return out; }

function workMonths(id){ return [...new Set(Object.values(S.er).filter(d=>d.inspector===id).map(d=>d.month).concat(Object.values(S.actions).filter(d=>d.member===id).map(d=>d.month)))].sort().reverse(); }
function workWho(){ const w=S.ui.work, me=myTeamMember();
  if(me&&fieldUser()&&!(me.tester&&w.who&&S.team[w.who])) return me.id; /* a test partner (team.tester) may preview any inspector */
  if(w.who&&S.team[w.who]) return w.who;
  if(me&&isField(me)&&workMonths(me.id).length) return me.id;
  let div=me?divOf(me):"education"; if(!Object.values(S.team).some(t=>isField(t)&&divOf(t)===div)) div="education";
  const f=Object.entries(S.team).filter(([,t])=>isField(t)&&!t.hoursExempt&&divOf(t)===div).sort((a,b)=>a[1].name.localeCompare(b[1].name));
  return f.length?f[0][0]:null; }

function vWork(M){ const id=workWho(); const w=S.ui.work; const me=myTeamMember();
  if(!id) return `<div class="skeleton"><h2>My work</h2><p>Choose your profile first so this page can show your schools and follow-ups.</p><button class="btn primary" data-act="claim-open" type="button">Choose your profile</button></div>`;
  const t=S.team[id], self=me&&me.id===id, county=divOf(t)==="county";
  const picker=(!fieldUser()||(me&&me.tester))?`${me&&me.tester&&fieldUser()?'<span class="faint" style="font-size:12.5px">Preview as</span>':""}<select id="wk-who" aria-label="Whose work">${Object.entries(DIVS).map(([dk,dl])=>`<optgroup label="${esc(dl)}">${Object.entries(S.team).filter(([,x])=>isField(x)&&divOf(x)===dk).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k])=>`<option value="${esc(k)}" ${k===id?"selected":""}>${esc(memberName(k))}</option>`).join("")}</optgroup>`).join("")}</select>`:"";
  const lastER=Object.values(S.er).filter(d=>d.inspector===id).flatMap(d=>d.rows.map(r=>r.date)).sort().pop();
  const head=`<section class="wkhead">${avatar(id,46)}<div><span class="eyebrow">${wkDate(todayISO(),true)} · ${esc(roleOf(t).label)}${t.unit?` · Unit ${esc(t.unit)}`:""}</span><h2>${esc(memberName(id))}</h2>
    <span class="faint" style="font-size:12.5px">${lastER?`Emergency Reporting loaded through ${wkDate(lastER)}. Work done since then shows after the next upload.`:"No Emergency Reporting export loaded yet."}</span></div><span class="sp"></span>${picker}</section>`;
  const fx=fixItems(id), fu=followUps(id);
  const general=divOf(t)==="general";
  return `${head}<div class="wkcols"><div class="wkmain">${general?"":county?wkCounty(M,id):wkComing(M,id)}${wkFollow(id,fu)}${wkFix(id,fx)}${wkSeason(id)}</div>
    <div class="wkside">${todayPanel(groupOf(t),id)}${wkNumbers(M,id)}${general?"":county?wkTeamCounty(id):wkTeam(M,id)}</div></div>`; }

/* 1 · coming up: the open district window, campuses left, weekly pace, who to call */
function wkComing(M,id){ const W=S.windows[M.Y]; const lane=(W&&W.lanes[id])||[]; const today=todayISO();
  if(!lane.length){ const mine=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded"); const left=mine.filter(f=>!f.visited).length;
    if(!mine.length) return `<section class="panel"><div class="ph"><h3>Coming up</h3></div><div class="pb"><p style="margin:0">No schools are assigned to ${esc(memberName(id,"first"))} yet. Assignments are made on the Team page; ${esc(DIVS[divOf(S.team[id])]||"this division")} work shows here once its Emergency Reporting exports are loaded.</p></div></section>`;
    return `<section class="panel"><div class="ph"><h3>Coming up</h3></div><div class="pb">${left?`<p style="margin:0">${left} assigned campuses still due this season. No calendar window yet: a sergeant drafts it on the <a href="#calendar">Inspection calendar</a>.</p>`:`<p style="margin:0">Every assigned campus is inspected this season.</p>`}</div></section>`; }
  const wk=calWeeks(W).find(x=>x.mon<=today&&today<=isoAdd(x.mon,6)); const brk=wk&&wk.br;
  const cur=lane.find(b=>today>=b.start&&today<=b.end), next=lane.filter(b=>b.start>today).sort((a,b)=>a.start.localeCompare(b.start))[0];
  const behind=lane.filter(b=>b!==cur).map(b=>({b,P:blockProgress(M,b)})).filter(x=>x.P.st==="late"||x.P.st==="behind");
  const blk=(b,label)=>{ const P=blockProgress(M,b); const fs=M.facs.filter(f=>b.orgs.includes(f.orgId)&&f.state!=="excluded"&&!f.visited).sort((a,c)=>a.name.localeCompare(c.name));
    const from=today>b.start?today:b.start; const wl=Math.max(1,calWeeks({start:from,end:b.end,breaks:W.breaks}).filter(x=>!x.br).length); const left=P.n-P.done;
    const one=b.orgs.length===1?S.orgs[b.orgs[0]]:null, lead=one?leadContact(one):null, mail=one?scheduleMail(id,Object.assign({id:b.orgs[0]},one),lead,b,fs):"";
    const show=S.ui.work.all?fs:fs.slice(0,8);
    return `<div class="wkblk"><div class="wkbh"><div><span class="eyebrow">${label}</span><h4>${esc(b.label)}</h4><span class="faint">${wkDate(b.start)} to ${wkDate(b.end)} · ${P.done} of ${P.n} done</span></div><span class="pill ${CAL_ST[P.st][1]}">${CAL_ST[P.st][0]}</span></div>
      <div class="meter thin" style="margin:8px 0 4px"><i style="width:${P.n?P.done/P.n*100:0}%;background:${teamColor(id)}"></i></div>
      ${left?`<p class="wkpace"><b class="num">${left}</b> left · about <b>${Math.ceil(left/wl)} a week</b> for ${wl} working week${wl>1?"s":""} to finish in the window</p>`:`<p class="wkpace">Every campus in this window is done.</p>`}
      ${one?`<div class="wklead"><span class="eyebrow">Schedule through</span>${contactHTML(lead)}${mail?`<a class="btn sm primary" href="${mail}">Email to schedule</a>`:""}</div>`:""}
      ${fs.length?`<ul class="wklist">${show.map(f=>{ const lv=lastVisit(f), dh=dirHref(f), lc=one?null:leadContact(f.org);
        return `<li><button class="wkfac" type="button" data-fac="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(f.address||"")}${!one?` · ${esc(f.org.name)}`:""}${lv?` · last inspected ${wkDate(lv)} ${lv.slice(0,4)}`:" · no inspection on record"}</small></button>
          <span class="wkacts">${lc&&lc.phone?`<a class="btn sm" href="${telHref(lc.phone)}" title="${esc(lc.name||"")}">Call</a>`:""}${lc&&lc.email?`<a class="btn sm" href="mailto:${esc(lc.email)}" title="${esc(lc.name||"")}">Email</a>`:""}${dh?`<a class="btn sm" href="${dh}" target="_blank" rel="noopener">Directions</a>`:""}</span></li>`; }).join("")}</ul>
        ${fs.length>show.length?`<button class="btn sm ghost" type="button" data-act="wk-all">Show all ${fs.length}</button>`:""}`:""}</div>`; };
  const parts=[];
  if(brk) parts.push(`<div class="notice">This week is ${esc(brk)}: no window is set, so it is open for catch-up.</div>`);
  if(cur) parts.push(blk(cur,"District window now"));
  else if(next) parts.push(blk(next,`Next window starts ${wkDate(next.start,true)}`));
  if(behind.length) parts.push(`<div class="wkbehind"><span class="eyebrow">Catch up</span>${behind.map(x=>`<div class="calline" data-calblk="${esc(id)}|${lane.indexOf(x.b)}"><b style="flex:1">${esc(x.b.label)}</b><span class="mono">${x.P.n-x.P.done} left</span> <span class="pill ${CAL_ST[x.P.st][1]}">${CAL_ST[x.P.st][0]}</span></div>`).join("")}</div>`);
  if(cur&&next) parts.push(`<p class="faint" style="margin:0;font-size:12.5px">Next: <b>${esc(next.label)}</b> from ${wkDate(next.start,true)}. Lead time helps: email that district now if you have not.</p>`);
  if(!cur&&!next&&!behind.length) parts.push(`<p style="margin:0">No more windows this season.</p>`);
  return `<section class="panel" id="wk-coming"><div class="ph"><h3>Coming up</h3><a class="faint" href="#calendar" style="margin-left:auto;font-size:12.5px">Whole calendar</a></div><div class="pb wkstack">${parts.join("")}</div></section>`; }

/* 1 · FSS variant: your buildings due this month and next, and anything due last month with nothing in ER */
function wkCounty(M,id){ const mine=cfacList().filter(f=>f.fss===id);
  if(!mine.length) return `<section class="panel"><div class="ph"><h3>Coming up</h3></div><div class="pb"><p style="margin:0">No county buildings are assigned to you. Your inspections come from requests and projects; follow-ups owed are below.</p></div></section>`;
  const today=todayISO(), m=+today.slice(5,7), nm=m%12+1, pm=(m+10)%12+1, I=cfacInspections();
  const due=mm=>mine.filter(f=>f.annualMonth===mm||f.semiMonth===mm);
  const inMonth=(f,ym)=>(I[f.id]||[]).some(r=>r.date.slice(0,7)===ym);
  const pym=m===1?`${+today.slice(0,4)-1}-12`:`${today.slice(0,4)}-${String(pm).padStart(2,"0")}`, haveP=Object.values(S.er).some(d=>d.inspector===id&&d.month===pym);
  const missed=haveP?due(pm).filter(f=>!f.monthsReview&&!inMonth(f,pym)):[]; /* months still under review are not held against anyone */
  const row=(f,mm)=>{ const last=(I[f.id]||[])[0], dh=dirHref(f); const kind=f.annualMonth===mm?"Annual":"Semi-annual";
    return `<li><button class="wkfac" type="button" data-cfac="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(f.address||"")} · ${kind}${f.monthsReview?' · <span class="mrev">month to review</span>':""}${last?` · last in ER ${wkDate(last.date)} ${last.date.slice(0,4)}`:" · none in ER"}</small></button><span class="wkacts">${dh?`<a class="btn sm" href="${dh}" target="_blank" rel="noopener">Directions</a>`:""}</span></li>`; };
  const grp=(title,list,mm,warn)=>`<div class="wkblk"><div class="wkbh"><div><span class="eyebrow">${title}</span><h4>${list.length} building${list.length===1?"":"s"}</h4></div>${warn&&list.length?`<span class="pill s-failed">${warn}</span>`:""}</div>${list.length?`<ul class="wklist">${list.map(f=>row(f,mm)).join("")}</ul>`:""}</div>`;
  const rev=mine.filter(f=>f.monthsReview).length;
  return `<section class="panel" id="wk-coming"><div class="ph"><h3>Coming up</h3><a class="faint" href="#county" style="margin-left:auto;font-size:12.5px">County facilities</a></div><div class="pb wkstack">
    ${missed.length?grp(`Due in ${MONTHS_FULL[pm-1]}, nothing in ER`,missed,pm,"Check"):""}${grp(`Due in ${MONTHS_FULL[m-1]}`,due(m),m)}${grp(`Due in ${MONTHS_FULL[nm-1]}`,due(nm),nm)}
    ${rev?`<p class="faint" style="margin:0;font-size:12.5px">${rev} of your ${mine.length} buildings have inspection months still to review. Open a building on <a href="#county">County facilities</a> and save its months to clear it.</p>`:""}</div></section>`; }

/* 2 · follow-ups owed */
function wkFollow(id,fu){ const n=fu.filter(x=>x.st!=="unknown").length;
  return `<section class="panel" id="wk-follow"><div class="ph"><h3>Follow-ups</h3><span class="faint">${fu.length?`${fu.length} open`:"none open"}</span></div><div class="pb wkstack">
    ${fu.length?`<ul class="wklist">${fu.filter(x=>x.st!=="unknown").map(fuRow).join("")}</ul>${fu.some(x=>x.st==="unknown")?`<details class="opens"><summary>${fu.filter(x=>x.st==="unknown").length} with no next date loaded (no inspection report PDFs for that month)</summary><ul class="wklist">${fu.filter(x=>x.st==="unknown").map(fuRow).join("")}</ul></details>`:""}
      <p class="method" style="margin:0">A follow-up drops off when Emergency Reporting shows a later inspection at the same occupancy. ${n?`"Add to Outlook" saves the appointment named the way the team names them, type and campus, on the next inspection date from ER.`:""} Checking Outlook for a booked visit comes with the calendar connection.</p>`
      :`<p style="margin:0">No failed inspections waiting on a follow-up.</p>`}</div></section>`; }
function fuRow(x){ const r=x.r, [l,c]=FU_ST[x.st];
      return `<li><button class="wkfac" type="button" ${r.fac?`data-fac="${esc(r.fac)}"`:`data-erk="${esc(r.k)}"`}><b>${esc(r.occ)}</b><small>${esc(r.addr||"")} · ${esc(r.type)} ${r.res==="fail"?"failed":"conditional"} ${wkDate(r.date)}${r.rt?` (${esc(r.rt)})`:""}</small></button>
        <span class="wkacts"><span class="pill ${c}">${l}${x.due&&x.st!=="nodate"?` · ${wkDate(x.due,true)}`:""}</span>${r.src?reportBadge(r):""}${x.due&&x.due>=todayISO()?`<button class="btn sm" type="button" data-ics="${esc(r.k)}">Add to Outlook</button>`:""}</span></li>`; }

/* 3 · fix in ER */
function wkFix(id,fx){ const me=myTeamMember(); const canExp=S.canWrite&&((me&&me.id===id)||isSupervisor());
  const items=[];
  fx.flags.forEach(o=>{ const [l]=ASSIST_LABEL[o.check]; const f=S.flags[flagId(o.a)];
    items.push(`<li><div class="wkfac"><b>Assist ${wkDate(o.a.date)}: ${esc(o.a.occ)}</b><small>${esc(l)}${o.who?` · assisting ${esc(o.who)}`:""}${f&&f.status==="sentback"?` · sent back by ${esc(memberName(f.reviewBy))}: correct it in ER`:""}</small></div><span class="wkacts">${canExp?`<button class="btn sm" type="button" data-flagexp="${esc(flagId(o.a))}" data-mem="${esc(o.a.member)}">${f&&f.note?"Edit explanation":"Explain"}</button>`:""}</span></li>`); });
  fx.noTime.forEach(x=>items.push(`<li><div class="wkfac"><b>${x.n} action code${x.n>1?"s":""} with no time written · ${MON3[+x.month.slice(5)-1]}</b><small class="mono">${Object.entries(x.by).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${esc(c)} ${n}`).join(" · ")}</small><small>Each counts 15 minutes until the time is in the entry, for example "- 2 hours" or "8:00 AM to 10:00 AM".</small></div></li>`));
  fx.noDate.forEach(x=>items.push(`<li><div class="wkfac"><b>No next inspection date: ${esc(x.r.occ)}</b><small>${esc(x.r.type)} failed ${wkDate(x.r.date)}. Add the follow-up date to the report in ER.</small></div><span class="wkacts">${reportBadge(x.r)}</span></li>`));
  return `<section class="panel" id="wk-fix"><div class="ph"><h3>Fix in Emergency Reporting</h3><span class="faint">${fx.n||"nothing"}</span></div><div class="pb">${items.length?`<ul class="wklist">${items.join("")}</ul><p class="method" style="margin:8px 0 0">Fix it once in ER. The next upload replaces the month and the item clears here.</p>`:`<p style="margin:0">Nothing to fix. Your entries line up.</p>`}</div></section>`; }

/* 4 · my numbers */
function wkNumbers(M,id){ const ms=workMonths(id); const w=S.ui.work; const month=ms.includes(w.month)?w.month:(ms[0]||defaultMonth());
  const rows=Object.values(S.er).filter(d=>d.month===month&&d.inspector===id).flatMap(d=>d.rows.map(erLive));
  const first=rows.filter(r=>!(BROW[r.row]||{}).follow&&r.res!=="unknown"), pass1=first.filter(r=>r.res!=="fail").length;
  const acts=actRows(month,memDiv(id),id).length; const h=seesHoursOf(id)&&!hoursExempt(id)?personHours(id,month):null;
  const county=divOf(S.team[id])==="county"; const myFacs=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded"); const done=myFacs.filter(f=>f.visited).length;
  const mine=county?cfacList().filter(f=>f.fss===id).length:0;
  const tile=(v,l,sub,c)=>`<div><b class="num" ${c?`style="color:${c}"`:""}>${v}</b><span>${l}</span>${sub?`<small>${sub}</small>`:""}</div>`;
  return `<section class="panel" id="wk-nums"><div class="ph"><h3>${seesHoursOf(id)&&myTeamMember()&&myTeamMember().id===id?"My numbers":"Numbers"}</h3><span class="sp"></span>${ms.length>1?`<select id="wk-month" aria-label="Month">${ms.map(m=>`<option value="${m}" ${m===month?"selected":""}>${MON3[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("")}</select>`:`<span class="faint">${MON3[+month.slice(5)-1]} ${month.slice(0,4)}</span>`}</div>
    <div class="pb"><div class="wktiles">
      ${tile(rows.length,"inspections in ER")}
      ${tile(rows.filter(r=>r.res==="fail").length,"found hazards")}
      ${first.length>=1?tile(pct(pass1/first.length),"passed first visit",`${pass1} of ${first.length}`):""}
      ${tile(rows.filter(r=>r.coi).length+rows.filter(r=>r.res==="conditional").length,"certificates issued","including conditional COs")}
      ${tile(acts,"action codes")}
      ${h?tile(h.perDay.toFixed(1),"hours per day",`target ${HOURS_TARGET} · ${h.total.toFixed(1)} h over ${h.days} days`,h.perDay>=HOURS_TARGET?"var(--ok)":h.perDay>=HOURS_TARGET*.8?"var(--due)":"var(--bad)"):""}
      ${!county&&myFacs.length?tile(pct(done/myFacs.length),"of assigned schools inspected",`${done} of ${myFacs.length} this season`):""}
      ${county&&mine?tile(mine,"county buildings you own"):""}
    </div><a class="btn sm ghost" href="#person-${esc(id)}" style="margin-top:10px">Full profile</a></div></section>`; }

/* 5 · teammates: windows and progress, never hours */
function wkTeam(M,id){ const W=S.windows[M.Y]; const today=todayISO(); const ids=edField().filter(k=>k!==id); if(!ids.length) return "";
  return `<section class="panel"><div class="ph"><h3>Team</h3><span class="faint">${M.Y}</span></div><div class="pb" style="display:flex;flex-direction:column;gap:8px">${ids.map(k=>{ const fs=M.facs.filter(f=>f.org&&f.org.assignedTo===k&&f.state!=="excluded"); const dn=fs.filter(f=>f.visited).length;
    const lane=(W&&W.lanes[k])||[]; const cur=lane.find(b=>today>=b.start&&today<=b.end); const P=cur?blockProgress(M,cur):null;
    return `<div class="wkmate" data-person="${esc(k)}">${avatar(k,30)}<span class="wkmn"><b>${esc(memberName(k))}</b><small>${cur?`${esc(cur.label)} · ${P.done}/${P.n}`:"No window this week"}</small></span><span class="sp"></span><span class="mono" title="Assigned schools inspected this season">${fs.length?pct(dn/fs.length):"–"}</span></div>`; }).join("")}</div></section>`; }
function wkTeamCounty(id){ const ids=Object.entries(S.team).filter(([k,t])=>k!==id&&isField(t)&&divOf(t)==="county"&&!t.hoursExempt).map(([k])=>k); if(!ids.length) return ""; const m=+todayISO().slice(5,7);
  return `<section class="panel"><div class="ph"><h3>Team</h3></div><div class="pb" style="display:flex;flex-direction:column;gap:8px">${ids.map(k=>{ const own=cfacList().filter(f=>f.fss===k); const due=own.filter(f=>f.annualMonth===m||f.semiMonth===m).length;
    return `<div class="wkmate" data-person="${esc(k)}">${avatar(k,30)}<span class="wkmn"><b>${esc(memberName(k))}</b><small>${own.length?`${own.length} buildings · ${due} due in ${MON3[m-1]}`:esc(roleOf(S.team[k]).label)}</small></span></div>`; }).join("")}</div></section>`; }

document.addEventListener("change",e=>{ const t=e.target;
  if(t.id==="wk-who"){ S.ui.work.who=t.value; S.ui.work.month=null; S.ui.work.all=false; render(); }
  if(t.id==="wk-month"){ S.ui.work.month=t.value; render(); } });
document.addEventListener("click",async e=>{ const t=e.target;
  if(t.closest('[data-act="wk-all"]')){ S.ui.work.all=true; render(); return; }
  if(t.closest('[data-act="claim-open"]')){ openClaim(); return; }
  const ic=t.closest("[data-ics]"); if(ic){ const r=erRowByKey(ic.dataset.ics); if(!r||!r.nx) return; await saveFile(`${(r.nx.t||"Follow-up").replace(/[^\w-]+/g," ").trim()} ${String(r.occ).replace(/[^\w-]+/g," ").trim()}.ics`.slice(0,120),followUpICS(r)); return; }
  const ek=t.closest("[data-erk]"); if(ek){ openReport(ek.dataset.erk); return; }
  const fb=t.closest(".wkfac[data-fac]"); if(fb){ openFacility(fb.dataset.fac); return; }
});
