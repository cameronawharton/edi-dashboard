/* ------------------------------------------------------------------ Inspectors: a supervisor's page for one person (Nov 10 2026, Cameron)
   The app is a supervisory and management tool. Inspectors do not use it; their work reaches them as a list the sergeant sends.
   Actionable first: where they are in the calendar, follow-ups owed, what to fix in ER, then numbers and everything uploaded so far.
   Everything is read from ER, the calendar and the district records: nothing is entered here. (View id stays "work".) */
S.ui.work=S.ui.work||{who:null,month:null,all:false,old:false};
const WK_DAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const wkDate=(iso,dow)=>{ if(!iso) return ""; const t=new Date(iso.slice(0,10)+"T12:00:00Z"); return `${dow?WK_DAY[t.getUTCDay()]+" ":""}${MON3[t.getUTCMonth()]} ${t.getUTCDate()}`; };
const wkDateY=iso=>iso?`${wkDate(iso)}${iso.slice(0,4)!==todayISO().slice(0,4)?" "+iso.slice(0,4):""}`:"";
const ageText=d=>d<60?`${d} days`:d<365?`${Math.round(d/30.4)} months`:`${(d/365).toFixed(1)} years`;
/* first page after sign-in: captain and chief land on the Command summary; everyone else on their group's Overview (viewGroup) */
function landRole(){ autoLink(); if(S.ui._landed||!S.me.id||!Object.keys(S.team).length) return; const me=myTeamMember(); if(!me) return;
  S.ui._landed=true; if(location.hash) return; if(["chief","captain"].includes(me.role)){ S.ui.view="brief"; S.ui.param=null; } }

/* the district contact to schedule through: point of contact or facilities/safety lead before the superintendent */
function leadContact(o){ const cs=(o&&o.contacts||[]).filter(c=>c&&(c.phone||c.email)); if(!cs.length) return null;
  const rank=c=>{ const r=String(c.role||"").toLowerCase(); return /point of contact/.test(r)?0:/facilit|mainten|fire|safety|emergenc|security|operat/.test(r)?1:/csss|director|campus/.test(r)?2:/superintendent/.test(r)?4:3; };
  return cs.slice().sort((a,b)=>rank(a)-rank(b))[0]; }
function contactHTML(c,small){ if(!c) return `<span class="faint">No contact on file</span>`;
  return `<span class="wkc ${small?"sm":""}"><b>${esc(c.name||"")}</b>${c.role?`<small>${esc(c.role)}</small>`:""}${c.phone?`<a class="btn sm" href="${telHref(c.phone)}">Call</a>`:""}${c.email?`<a class="btn sm" href="mailto:${esc(c.email)}">Email</a>`:""}</span>`; }
const lastVisit=f=>(f.visitsAll||[]).filter(v=>!v.voided&&v.date).map(v=>v.date).sort().pop()||null;

/* follow-ups, built once per data change for everyone.
   At each occupancy, the latest inspection with a pass or fail written decides it. If that one failed (or passed with conditions and a
   next date) and nothing came after it, the follow-up is owed by whoever did it. If a later inspection exists but has no pass or fail in
   its notes, the follow-up is closed and the later inspection goes to Fix in ER as "result not written" for whoever did it. */
const FU={rev:-1,by:null};
function fuIndex(){ if(FU.rev===S._rev&&FU.by) return FU.by; const occ={}, by={}, today=todayISO();
  Object.values(S.er).forEach(d=>d.rows.forEach(r=>{ const k=r.id+"|"+erNorm(r.occ); (occ[k]=occ[k]||[]).push(Object.assign({member:d.inspector,month:d.month},erLive(r))); }));
  const put=(id,kind,x)=>{ if(!id) return; const p=by[id]=by[id]||{open:[],notWritten:[]}; p[kind].push(x); };
  Object.values(occ).forEach(list=>{ list.sort((a,b)=>a.date.localeCompare(b.date)||String(a.tin).localeCompare(String(b.tin)));
    let ki=-1; for(let i=list.length-1;i>=0;i--) if(list[i].res!=="unknown"){ ki=i; break; } if(ki<0) return; const r=list[ki];
    if(!(r.res==="fail"||(r.res==="conditional"&&r.nx&&r.nx.d))) return;
    const later=list.slice(ki+1).filter(x=>x.date>r.date);
    if(later.length){ const u=later[later.length-1]; put(u.member,"notWritten",{r:u,prev:r}); return; }
    const due=r.nx&&r.nx.d||null; const st=!due?(r.src?"nodate":"unknown"):due<today?"overdue":days(today,due)<=7?"week":"later";
    put(r.member,"open",{r,due,st,age:days(r.date,today)}); });
  const ord={overdue:0,nodate:1,week:2,later:3,unknown:4};
  Object.values(by).forEach(p=>{ p.open.sort((a,b)=>ord[a.st]-ord[b.st]||String(a.due||a.r.date).localeCompare(String(b.due||b.r.date))); p.notWritten.sort((a,b)=>b.r.date.localeCompare(a.r.date)); });
  FU.rev=S._rev; FU.by=by; return by; }
function followUps(id){ return (fuIndex()[id]||{}).open||[]; }
function notWritten(id){ return (fuIndex()[id]||{}).notWritten||[]; }
const FU_OLD=180; /* days: older follow-ups stay listed, folded under their age */
const FU_ST={overdue:["Overdue","s-failed"],nodate:["No next date in ER","s-failed"],week:["Due this week","s-due"],later:["Scheduled","s-off"],unknown:["Re-inspection owed","s-due"]};

/* things only the person can fix, at the source */
function fixItems(id){ const div=memDiv(id), out={flags:[],noTime:[],noDate:[],notWritten:notWritten(id)};
  const months=[...new Set(Object.values(S.actions).filter(d=>d.member===id).map(d=>d.month))].sort().reverse();
  months.forEach(m=>{ assistCheck(m,div).filter(o=>o.a.member===id&&FLAGGED.includes(o.check)&&["open","sentback"].includes(flagState(o))).forEach(o=>out.flags.push(o));
    const h=actHours(id,m); if(h.noH) out.noTime.push({month:m,n:h.noH,by:h.missByCode||{}}); });
  out.noDate=followUps(id).filter(x=>x.st==="nodate");
  out.n=out.flags.length+out.noTime.reduce((s,x)=>s+x.n,0)+out.noDate.length+out.notWritten.length; return out; }

function workMonths(id){ return [...new Set(Object.values(S.er).filter(d=>d.inspector===id).map(d=>d.month).concat(Object.values(S.actions).filter(d=>d.member===id).map(d=>d.month)))].sort().reverse(); }
/* default person: the first inspector in the viewer's group */
function workWho(){ const w=S.ui.work, me=myTeamMember();
  if(w.who&&S.team[w.who]) return w.who;
  let div=me?divOf(me):"education"; if(!Object.values(S.team).some(t=>isField(t)&&!t.hoursExempt&&divOf(t)===div)) div="education";
  const f=Object.entries(S.team).filter(([,t])=>isField(t)&&!t.hoursExempt&&divOf(t)===div).sort((a,b)=>a[1].name.localeCompare(b[1].name));
  return f.length?f[0][0]:null; }

/* the list a supervisor sends: follow-ups owed and what to fix in ER, in plain words */
function sendListText(id){ const t=S.team[id], fu=followUps(id), fx=fixItems(id), me=myTeamMember(); const L=[];
  const fuLine=x=>{ const r=x.r; return `- ${r.occ}${r.addr?` (${r.addr})`:""}: ${r.type} ${r.res==="fail"?"failed":"conditional"} ${wkDateY(r.date)}. ${x.st==="overdue"?`Next inspection was due ${wkDateY(x.due)}.`:x.due?`Next inspection ${wkDateY(x.due)}.`:"No next inspection date in ER."}`; };
  L.push(`${memberName(id,"first")},`,"",`Here are your open items as of ${wkDateY(todayISO())} ${todayISO().slice(0,4)}. They come from what is in Emergency Reporting, so an entry fixed in ER clears after the next upload.`,"");
  if(fu.length){ L.push(`Follow-ups owed (${fu.length}):`); fu.forEach(x=>L.push(fuLine(x))); L.push(""); }
  const fixL=[];
  fx.notWritten.forEach(x=>fixL.push(`- ${x.r.occ}: ${x.r.type} on ${wkDateY(x.r.date)} has no pass or fail written in the notes.`));
  fx.flags.forEach(o=>fixL.push(`- Assist on ${wkDateY(o.a.date)} at ${o.a.occ}: ${ASSIST_LABEL[o.check][0]}${(S.flags[flagId(o.a)]||{}).status==="sentback"?" (sent back, correct it in ER)":""}.`));
  fx.noTime.forEach(x=>fixL.push(`- ${x.n} action code${x.n>1?"s":""} in ${MONTHS_FULL[+x.month.slice(5)-1]} with no time written.`));
  fx.noDate.forEach(x=>fixL.push(`- ${x.r.occ}: add the next inspection date to the ${wkDateY(x.r.date)} report.`));
  if(fixL.length){ L.push(`Fix in Emergency Reporting (${fixL.length}):`,...fixL,""); }
  if(!fu.length&&!fixL.length) L.push("Nothing open. Your entries line up.","");
  L.push("Let me know if anything here is wrong.","",me?memberName(me.id):(S.me.name||""));
  return {text:L.join("\n"),to:(t&&(t.email||t.emailLc))||"",n:fu.length+fixL.length}; }
function sendListMail(id){ const s=sendListText(id); let body=s.text;
  if(body.length>1800){ const lines=body.split("\n"); let keep=[]; for(const l of lines){ if((keep.join("\n")+l).length>1600) break; keep.push(l); } body=keep.join("\n")+"\n\n(The list is longer than an email link allows. The rest is in Prevention Services Insight.)"; }
  return `mailto:${encodeURIComponent(s.to)}?subject=${encodeURIComponent(`Open items: follow-ups and ER fixes, ${wkDateY(todayISO())}`)}&body=${encodeURIComponent(body)}`; }

function vWork(M){ const id=workWho(); const w=S.ui.work;
  if(!id) return `<div class="skeleton"><h2>Inspectors</h2><p>No inspectors are on the team list yet.</p></div>`;
  const t=S.team[id], county=divOf(t)==="county", general=divOf(t)==="general";
  const picker=`<select id="wk-who" aria-label="Inspector">${Object.entries(DIVS).map(([dk,dl])=>{ const ppl=Object.entries(S.team).filter(([,x])=>isField(x)&&divOf(x)===dk).sort((a,b)=>a[1].name.localeCompare(b[1].name)); return ppl.length?`<optgroup label="${esc(dl)}">${ppl.map(([k])=>`<option value="${esc(k)}" ${k===id?"selected":""}>${esc(memberName(k))}</option>`).join("")}</optgroup>`:""; }).join("")}</select>`;
  const lastER=Object.values(S.er).filter(d=>d.inspector===id).flatMap(d=>d.rows.map(r=>r.date)).sort().pop();
  const sl=sendListText(id);
  const head=`<section class="wkhead">${avatar(id,46)}<div><span class="eyebrow">${wkDate(todayISO(),true)} · ${esc(roleOf(t).label)}${t.unit?` · Unit ${esc(t.unit)}`:""}</span><h2>${esc(memberName(id))}</h2>
    <span class="faint" style="font-size:12.5px">${lastER?`Emergency Reporting loaded through ${wkDateY(lastER)}. Work done since then shows after the next upload.`:"No Emergency Reporting export loaded yet."}</span></div><span class="sp"></span>
    <div class="wkpick">${picker}<span class="wkacts"><a class="btn sm primary" href="${sendListMail(id)}" title="Opens an email to ${esc(memberName(id,"first"))} with their follow-ups and ER fixes">Send list${sl.n?` (${sl.n})`:""}</a><button class="btn sm" type="button" data-act="wk-copy">Copy list</button></span></div></section>`;
  const fx=fixItems(id), fu=followUps(id);
  return `${head}<div class="wkcols"><div class="wkmain">${general?"":county?wkCounty(M,id):wkComing(M,id)}${wkFollow(id,fu)}${wkFix(id,fx)}${wkSeason(id)}</div>
    <div class="wkside">${todayPanel(groupOf(t),id)}${wkNumbers(M,id)}</div></div>`; }

/* 1 · where they are in the calendar: the open district window, campuses left, weekly pace, who to call */
function wkComing(M,id){ const W=S.windows[M.Y]; const lane=(W&&W.lanes[id])||[]; const today=todayISO(); const first=esc(memberName(id,"first"));
  if(!lane.length){ const mine=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded"); const left=mine.filter(f=>!f.visited).length;
    if(!mine.length) return `<section class="panel"><div class="ph"><h3>Calendar</h3></div><div class="pb"><p style="margin:0">No schools are assigned to ${first}. Assignments are made on the Team page.</p></div></section>`;
    return `<section class="panel"><div class="ph"><h3>Calendar</h3></div><div class="pb">${left?`<p style="margin:0">${left} assigned campuses still due this season. No calendar window yet: draft it on the <a href="#calendar">Inspection calendar</a>.</p>`:`<p style="margin:0">Every assigned campus is inspected this season.</p>`}</div></section>`; }
  const wk=calWeeks(W).find(x=>x.mon<=today&&today<=isoAdd(x.mon,6)); const brk=wk&&wk.br;
  const cur=lane.find(b=>today>=b.start&&today<=b.end), next=lane.filter(b=>b.start>today).sort((a,b)=>a.start.localeCompare(b.start))[0];
  const behind=lane.filter(b=>b!==cur).map(b=>({b,P:blockProgress(M,b)})).filter(x=>x.P.st==="late"||x.P.st==="behind");
  const blk=(b,label)=>{ const P=blockProgress(M,b); const fs=M.facs.filter(f=>b.orgs.includes(f.orgId)&&f.state!=="excluded"&&!f.visited).sort((a,c)=>a.name.localeCompare(c.name));
    const from=today>b.start?today:b.start; const wl=Math.max(1,calWeeks({start:from,end:b.end,breaks:W.breaks}).filter(x=>!x.br).length); const left=P.n-P.done;
    const one=b.orgs.length===1?S.orgs[b.orgs[0]]:null, lead=one?leadContact(one):null;
    const show=S.ui.work.all?fs:fs.slice(0,8);
    return `<div class="wkblk"><div class="wkbh"><div><span class="eyebrow">${label}</span><h4>${esc(b.label)}</h4><span class="faint">${wkDate(b.start)} to ${wkDate(b.end)} · ${P.done} of ${P.n} done</span></div><span class="pill ${CAL_ST[P.st][1]}">${CAL_ST[P.st][0]}</span></div>
      <div class="meter thin" style="margin:8px 0 4px"><i style="width:${P.n?P.done/P.n*100:0}%;background:${teamColor(id)}"></i></div>
      ${left?`<p class="wkpace"><b class="num">${left}</b> left · about <b>${Math.ceil(left/wl)} a week</b> for ${wl} working week${wl>1?"s":""} to finish in the window</p>`:`<p class="wkpace">Every campus in this window is done.</p>`}
      ${one?`<div class="wklead"><span class="eyebrow">District contact</span>${contactHTML(lead)}</div>`:""}
      ${fs.length?`<ul class="wklist">${show.map(f=>{ const lv=lastVisit(f);
        return `<li><button class="wkfac" type="button" data-fac="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(f.address||"")}${!one?` · ${esc(f.org.name)}`:""}${lv?` · last inspected ${wkDateY(lv)}`:" · no inspection on record"}</small></button></li>`; }).join("")}</ul>
        ${fs.length>show.length?`<button class="btn sm ghost" type="button" data-act="wk-all">Show all ${fs.length}</button>`:""}`:""}</div>`; };
  const parts=[];
  if(brk) parts.push(`<div class="notice">This week is ${esc(brk)}: no window is set, so it is open for catch-up.</div>`);
  if(cur) parts.push(blk(cur,"District window now"));
  else if(next) parts.push(blk(next,`Next window starts ${wkDate(next.start,true)}`));
  if(behind.length) parts.push(`<div class="wkbehind"><span class="eyebrow">Behind</span>${behind.map(x=>`<div class="calline" data-calblk="${esc(id)}|${lane.indexOf(x.b)}"><b style="flex:1">${esc(x.b.label)}</b><span class="mono">${x.P.n-x.P.done} left</span> <span class="pill ${CAL_ST[x.P.st][1]}">${CAL_ST[x.P.st][0]}</span></div>`).join("")}</div>`);
  if(cur&&next) parts.push(`<p class="faint" style="margin:0;font-size:12.5px">Next: <b>${esc(next.label)}</b> from ${wkDate(next.start,true)}.</p>`);
  if(!cur&&!next&&!behind.length) parts.push(`<p style="margin:0">No more windows this season.</p>`);
  return `<section class="panel" id="wk-coming"><div class="ph"><h3>Calendar</h3><a class="faint" href="#calendar" style="margin-left:auto;font-size:12.5px">Whole calendar</a></div><div class="pb wkstack">${parts.join("")}</div></section>`; }

/* 1 · FSS variant: their buildings due this month and next, and anything due last month with nothing in ER */
function wkCounty(M,id){ const mine=cfacList().filter(f=>f.fss===id); const first=esc(memberName(id,"first"));
  if(!mine.length) return `<section class="panel"><div class="ph"><h3>Buildings due</h3></div><div class="pb"><p style="margin:0">No county buildings are assigned to ${first}. Their inspections come from requests and projects; follow-ups owed are below.</p></div></section>`;
  const today=todayISO(), m=+today.slice(5,7), nm=m%12+1, pm=(m+10)%12+1, I=cfacInspections();
  const due=mm=>mine.filter(f=>f.annualMonth===mm||f.semiMonth===mm);
  const inMonth=(f,ym)=>(I[f.id]||[]).some(r=>r.date.slice(0,7)===ym);
  const pym=m===1?`${+today.slice(0,4)-1}-12`:`${today.slice(0,4)}-${String(pm).padStart(2,"0")}`, haveP=Object.values(S.er).some(d=>d.inspector===id&&d.month===pym);
  const missed=haveP?due(pm).filter(f=>!f.monthsReview&&!inMonth(f,pym)):[]; /* months still under review are not held against anyone */
  const row=(f,mm)=>{ const last=(I[f.id]||[])[0]; const kind=f.annualMonth===mm?"Annual":"Semi-annual";
    return `<li><button class="wkfac" type="button" data-cfac="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(f.address||"")} · ${kind}${f.monthsReview?' · <span class="mrev">month to review</span>':""}${last?` · last in ER ${wkDateY(last.date)}`:" · none in ER"}</small></button></li>`; };
  const grp=(title,list,mm,warn)=>`<div class="wkblk"><div class="wkbh"><div><span class="eyebrow">${title}</span><h4>${list.length} building${list.length===1?"":"s"}</h4></div>${warn&&list.length?`<span class="pill s-failed">${warn}</span>`:""}</div>${list.length?`<ul class="wklist">${list.map(f=>row(f,mm)).join("")}</ul>`:""}</div>`;
  const rev=mine.filter(f=>f.monthsReview).length;
  return `<section class="panel" id="wk-coming"><div class="ph"><h3>Buildings due</h3><a class="faint" href="#county" style="margin-left:auto;font-size:12.5px">County facilities</a></div><div class="pb wkstack">
    ${missed.length?grp(`Due in ${MONTHS_FULL[pm-1]}, nothing in ER`,missed,pm,"Check"):""}${grp(`Due in ${MONTHS_FULL[m-1]}`,due(m),m)}${grp(`Due in ${MONTHS_FULL[nm-1]}`,due(nm),nm)}
    ${rev?`<p class="faint" style="margin:0;font-size:12.5px">${rev} of ${first}'s ${mine.length} buildings have inspection months still to review. Open a building on <a href="#county">County facilities</a> and save its months to clear it.</p>`:""}</div></section>`; }

/* 2 · follow-ups owed */
function wkFollow(id,fu){ const recent=fu.filter(x=>x.age<=FU_OLD), old=fu.filter(x=>x.age>FU_OLD);
  return `<section class="panel" id="wk-follow"><div class="ph"><h3>Follow-ups owed</h3><span class="faint">${fu.length?`${fu.length} open`:"none open"}</span></div><div class="pb wkstack">
    ${fu.length?`${recent.length?`<ul class="wklist">${recent.map(fuRow).join("")}</ul>`:`<p style="margin:0">None from the last 6 months.</p>`}
      ${old.length?`<details class="opens" ${S.ui.work.old?"open":""}><summary>${old.length} older than 6 months, never re-inspected in ER</summary><ul class="wklist">${old.map(fuRow).join("")}</ul></details>`:""}
      <p class="method" style="margin:0">A follow-up closes when Emergency Reporting shows a later inspection at the same occupancy. If that later inspection has no pass or fail written, it moves to Fix in ER.</p>`
      :`<p style="margin:0">No failed inspections waiting on a follow-up.</p>`}</div></section>`; }
function fuRow(x){ const r=x.r, [l,c]=FU_ST[x.st];
  return `<li><button class="wkfac" type="button" ${r.fac?`data-fac="${esc(r.fac)}"`:`data-erk="${esc(r.k)}"`}><b>${esc(r.occ)}</b><small>${esc(r.addr||"")} · ${esc(r.type)} ${r.res==="fail"?"failed":"conditional"} ${wkDateY(r.date)}${r.rt?` (${esc(r.rt)})`:""} · ${ageText(x.age)} ago</small></button>
    <span class="wkacts"><span class="pill ${c}">${l}${x.due&&x.st!=="nodate"?` · ${wkDate(x.due,true)}`:""}</span>${r.src?reportBadge(r):""}</span></li>`; }

/* 3 · fix in ER */
function wkFix(id,fx){ const canExp=S.canWrite&&isSupervisor();
  const items=[];
  fx.notWritten.forEach(x=>items.push(`<li><button class="wkfac" type="button" data-erk="${esc(x.r.k)}"><b>No result written: ${esc(x.r.occ)}</b><small>${esc(x.r.type)} on ${wkDateY(x.r.date)} has no pass or fail in its notes. It followed a ${x.prev.res==="fail"?"failed":"conditional"} ${esc(x.prev.type)} on ${wkDateY(x.prev.date)}${x.prev.member&&x.prev.member!==id?` by ${esc(memberName(x.prev.member))}`:""}.</small></button></li>`));
  fx.flags.forEach(o=>{ const [l]=ASSIST_LABEL[o.check]; const f=S.flags[flagId(o.a)];
    items.push(`<li><div class="wkfac"><b>Assist ${wkDateY(o.a.date)}: ${esc(o.a.occ)}</b><small>${esc(l)}${o.who?` · assisting ${esc(o.who)}`:""}${f&&f.status==="sentback"?` · sent back by ${esc(memberName(f.reviewBy))}: correct it in ER`:""}</small></div><span class="wkacts">${canExp?`<button class="btn sm" type="button" data-flagexp="${esc(flagId(o.a))}" data-mem="${esc(o.a.member)}">${f&&f.note?"Edit explanation":"Explain"}</button>`:""}</span></li>`); });
  fx.noTime.forEach(x=>items.push(`<li><div class="wkfac"><b>${x.n} action code${x.n>1?"s":""} with no time written · ${MON3[+x.month.slice(5)-1]} ${x.month.slice(0,4)}</b><small class="mono">${Object.entries(x.by).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${esc(c)} ${n}`).join(" · ")}</small><small>Each counts 15 minutes until the time is in the entry, for example "- 2 hours" or "8:00 AM to 10:00 AM".</small></div></li>`));
  fx.noDate.forEach(x=>items.push(`<li><div class="wkfac"><b>No next inspection date: ${esc(x.r.occ)}</b><small>${esc(x.r.type)} failed ${wkDateY(x.r.date)}. Add the follow-up date to the report in ER.</small></div><span class="wkacts">${reportBadge(x.r)}</span></li>`));
  return `<section class="panel" id="wk-fix"><div class="ph"><h3>Fix in Emergency Reporting</h3><span class="faint">${fx.n||"nothing"}</span></div><div class="pb">${items.length?`<ul class="wklist">${items.join("")}</ul><p class="method" style="margin:8px 0 0">Fixed once in ER, the next upload replaces the month and the item clears here.</p>`:`<p style="margin:0">Nothing to fix. Entries line up.</p>`}</div></section>`; }

/* 4 · numbers for a month */
function wkNumbers(M,id){ const ms=workMonths(id); const w=S.ui.work; const month=ms.includes(w.month)?w.month:(ms[0]||defaultMonth());
  const rows=Object.values(S.er).filter(d=>d.month===month&&d.inspector===id).flatMap(d=>d.rows.map(erLive));
  const first=rows.filter(r=>!(BROW[r.row]||{}).follow&&r.res!=="unknown"), pass1=first.filter(r=>r.res!=="fail").length;
  const acts=actRows(month,memDiv(id),id).length; const h=!hoursExempt(id)?personHours(id,month):null;
  const county=divOf(S.team[id])==="county"; const myFacs=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded"); const done=myFacs.filter(f=>f.visited).length;
  const mine=county?cfacList().filter(f=>f.fss===id).length:0;
  const tile=(v,l,sub,c)=>`<div><b class="num" ${c?`style="color:${c}"`:""}>${v}</b><span>${l}</span>${sub?`<small>${sub}</small>`:""}</div>`;
  return `<section class="panel" id="wk-nums"><div class="ph"><h3>Numbers</h3><span class="sp"></span>${ms.length>1?`<select id="wk-month" aria-label="Month">${ms.map(m=>`<option value="${m}" ${m===month?"selected":""}>${MON3[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("")}</select>`:`<span class="faint">${MON3[+month.slice(5)-1]} ${month.slice(0,4)}</span>`}</div>
    <div class="pb"><div class="wktiles">
      ${tile(rows.length,"inspections in ER")}
      ${tile(rows.filter(r=>r.res==="fail").length,"found hazards")}
      ${first.length>=1?tile(pct(pass1/first.length),"passed first visit",`${pass1} of ${first.length}`):""}
      ${tile(rows.filter(r=>r.coi).length+rows.filter(r=>r.res==="conditional").length,"certificates issued","including conditional COs")}
      ${tile(acts,"action codes")}
      ${h?tile(h.perDay.toFixed(1),"hours per day",`target ${HOURS_TARGET} · ${h.total.toFixed(1)} h over ${h.days} days`,h.perDay>=HOURS_TARGET?"var(--ok)":h.perDay>=HOURS_TARGET*.8?"var(--due)":"var(--bad)"):""}
      ${!county&&myFacs.length?tile(pct(done/myFacs.length),"of assigned schools inspected",`${done} of ${myFacs.length} this season`):""}
      ${county&&mine?tile(mine,"county buildings owned"):""}
    </div><a class="btn sm ghost" href="#person-${esc(id)}" style="margin-top:10px">Full profile</a></div></section>`; }

document.addEventListener("change",e=>{ const t=e.target;
  if(t.id==="wk-who"){ S.ui.work.who=t.value; S.ui.work.month=null; S.ui.work.all=false; render(); }
  if(t.id==="wk-month"){ S.ui.work.month=t.value; render(); } });
document.addEventListener("toggle",e=>{ if(e.target.matches&&e.target.matches("#wk-follow details")) S.ui.work.old=e.target.open; },true);
document.addEventListener("click",async e=>{ const t=e.target;
  if(t.closest('[data-act="wk-all"]')){ S.ui.work.all=true; render(); return; }
  if(t.closest('[data-act="wk-copy"]')){ const s=sendListText(workWho()); try{ await navigator.clipboard.writeText(s.text); flash("List copied. Paste it into an email or Teams message."); }catch(err){ flash("Copy did not work in this browser. Use Send list instead."); } return; }
  const ek=t.closest("[data-erk]"); if(ek){ openReport(ek.dataset.erk); return; }
  const fb=t.closest(".wkfac[data-fac]"); if(fb){ openFacility(fb.dataset.fac); return; }
});
