/* ------------------------------------------------------------------ School inspection calendar: each district gets a block of the school year per inspector
   windows/<season> = {start, end, breaks:[{label,start,end}], lanes:{member:[{id,label,orgs:[orgId],start,end}]}, draftedAt, draftedBy, editedAt}
   Drafted Nov 4 2026: blocks sized to campuses still due, nearest district next, school breaks left open for catch-up. Sergeants and up move blocks. */
S.windows=S.windows||{};
const CAL_BREAKS_2026=[{label:"Thanksgiving",start:"2026-11-23",end:"2026-11-27"},{label:"Winter break",start:"2026-12-21",end:"2027-01-01"},{label:"Spring break",start:"2027-03-15",end:"2027-03-19"}];
const isoAdd=(d,n)=>{ const t=new Date(d+"T12:00:00Z"); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); };
const mondayOf=d=>{ const t=new Date(d+"T12:00:00Z"); const w=(t.getUTCDay()+6)%7; return isoAdd(d,-w); };
function calWeeks(W){ const out=[]; for(let m=mondayOf(W.start); m<=W.end; m=isoAdd(m,7)){ const fri=isoAdd(m,4); const br=(W.breaks||[]).find(b=>m<=b.end&&fri>=b.start); out.push({mon:m,fri,br:br?br.label:null}); } return out; }
const edField=()=>Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)==="education"&&!t.hoursExempt).map(([id])=>id);
/* blocks for one inspector: one per ISD, one for all their charters and privates, one for daycares */
function calBlocksFor(M,id){ const os=Object.values(M.orgStats).filter(s=>s.org.assignedTo===id&&s.active); const blocks=[];
  const cen=s=>{ const fs=M.facs.filter(f=>f.orgId===s.id&&f.lat!=null); return fs.length?[fs.reduce((a,f)=>a+f.lng,0)/fs.length,fs.reduce((a,f)=>a+f.lat,0)/fs.length]:null; };
  os.filter(s=>s.org.type==="ISD").forEach(s=>blocks.push({id:s.id,label:s.org.name,orgs:[s.id],n:s.active,due:s.active-s.visited,c:cen(s)}));
  const sm=os.filter(s=>s.org.type==="Charter"||s.org.type==="Private"); if(sm.length){ const cs=sm.map(cen).filter(Boolean); blocks.push({id:"small-"+id,label:"Charters and privates",orgs:sm.map(s=>s.id),n:sm.reduce((a,s)=>a+s.active,0),due:sm.reduce((a,s)=>a+s.active-s.visited,0),c:cs.length?[cs.reduce((a,c)=>a+c[0],0)/cs.length,cs.reduce((a,c)=>a+c[1],0)/cs.length]:null}); }
  os.filter(s=>s.org.type==="Daycare").forEach(s=>blocks.push({id:s.id,label:s.org.name,orgs:[s.id],n:s.active,due:s.active-s.visited,c:cen(s)}));
  /* order: start with the district with the most still due, then always the nearest remaining one */
  const left=blocks.slice().sort((a,b)=>b.due-a.due); const ord=[]; let cur=left.shift(); while(cur){ ord.push(cur); if(!left.length) break;
    left.sort((a,b)=>{ const d=x=>x.c&&cur.c?Math.hypot((x.c[0]-cur.c[0])*0.87,x.c[1]-cur.c[1]):9; return d(a)-d(b); }); cur=left.shift(); }
  return ord; }
function draftWindows(M,start,end){ const W={start,end,breaks:CAL_BREAKS_2026,lanes:{}}; const work=calWeeks(W).filter(w=>!w.br);
  edField().forEach(id=>{ const bl=calBlocksFor(M,id).filter(b=>b.due>0); /* finished districts need no window */ if(!bl.length) return; const tot=bl.reduce((a,b)=>a+Math.max(b.due,0),0)||1, N=work.length;
    /* whole weeks, at least one each, shared by campuses still due (largest remainder) */
    let wk=bl.map(b=>Math.max(1,Math.floor(Math.max(b.due,0)/tot*N))); let spare=N-wk.reduce((a,b)=>a+b,0);
    const rem=bl.map((b,i)=>[i,Math.max(b.due,0)/tot*N-Math.floor(Math.max(b.due,0)/tot*N)]).sort((a,b)=>b[1]-a[1]);
    for(let j=0;spare>0;j=(j+1)%rem.length){ wk[rem[j][0]]++; spare--; }
    while(spare<0){ const i=wk.indexOf(Math.max(...wk)); wk[i]--; spare++; }
    let p=0; W.lanes[id]=bl.map((b,i)=>{ const s=work[p], e=work[Math.min(p+wk[i]-1,N-1)]; p+=wk[i]; return {id:b.id,label:b.label,orgs:b.orgs,start:s.mon,end:e.fri}; }); });
  return W; }
function blockProgress(M,b,season){ const fs=M.facs.filter(f=>b.orgs.includes(f.orgId)&&f.state!=="excluded"); const done=fs.filter(f=>f.visited).length, today=todayISO();
  const pace=today<b.start?0:today>b.end?1:(Date.parse(today)-Date.parse(b.start))/(Date.parse(b.end)-Date.parse(b.start)+864e5);
  const st=done>=fs.length?"done":today>b.end?"late":today<b.start?"upcoming":done/Math.max(fs.length,1)+0.1<pace?"behind":"now";
  return {n:fs.length,done,pace,st}; }
const CAL_ST={done:["Done","s-done"],late:["Window passed","s-failed"],behind:["Behind pace","s-due"],now:["In window","s-off"],upcoming:["Upcoming",""]};

function vCalendar(M){ const W=S.windows[M.Y]; const canEdit=S.canWrite&&isSupervisor();
  if(!W) return `<section class="sechead"><h2>Inspection calendar</h2></section><div class="skeleton"><p>No calendar for ${M.Y} yet.</p>${canEdit?`<button class="btn primary" data-act="cal-draft" type="button">Draft the calendar</button>`:""}</div>`;
  const weeks=calWeeks(W), today=todayISO(), wi=d=>{ const i=weeks.findIndex(w=>w.mon<=d&&d<=isoAdd(w.mon,6)); return i<0?(d<weeks[0].mon?0:weeks.length-1):i; };
  const months=[]; weeks.forEach((w,i)=>{ const m=w.mon.slice(0,7); if(!months.length||months[months.length-1].m!==m) months.push({m,i,n:0}); months[months.length-1].n++; });
  const head=`<div class="calrow calhead"><div class="calwho"></div><div class="calgrid" style="--n:${weeks.length}">${months.map(m=>`<span style="grid-column:${m.i+1}/span ${m.n}">${MON3[+m.m.slice(5)-1]}</span>`).join("")}</div></div>`;
  const brk=weeks.map((w,i)=>w.br?`<i class="calbr" style="grid-column:${i+1}" title="${esc(w.br)}: open for catch-up"></i>`:"").join("");
  const tw=weeks.findIndex(w=>w.mon<=today&&today<=isoAdd(w.mon,6));
  const lanes=Object.entries(W.lanes).map(([id,bl])=>{ const tot=bl.reduce((a,b)=>a+blockProgress(M,b).n,0), dn=bl.reduce((a,b)=>a+blockProgress(M,b).done,0);
    return `<div class="calrow"><div class="calwho" data-person="${esc(id)}">${avatar(id,26)}<span><b>${esc(memberName(id))}</b><small>${dn} of ${tot} done</small></span></div><div class="calgrid" style="--n:${weeks.length}">${brk}${tw>=0?`<i class="caltoday" style="grid-column:${tw+1}"></i>`:""}
      ${bl.map((b,bi)=>{ const P=blockProgress(M,b), a=wi(b.start), z=wi(b.end); return `<button class="calblk st-${P.st}" style="grid-column:${a+1}/${z+2};--tc:${teamColor(id)}" data-calblk="${esc(id)}|${bi}" type="button" title="${esc(b.label)} · ${fmtDate(b.start)} to ${fmtDate(b.end)} · ${P.done} of ${P.n}"><span>${esc(b.label)}</span><i style="width:${P.n?P.done/P.n*100:0}%"></i></button>`; }).join("")}</div></div>`; }).join("");
  const all=Object.entries(W.lanes).flatMap(([id,bl])=>bl.map(b=>({id,b,P:blockProgress(M,b)}))); const now=all.filter(x=>today>=x.b.start&&today<=x.b.end), late=all.filter(x=>x.P.st==="late"||x.P.st==="behind");
  return `<section class="sechead"><h2>Inspection calendar</h2><span class="muted">${M.Y} · every school due · each district has a block of the school year with its inspector. Thanksgiving, winter break and spring break stay open for catch-up.${W.draft!==false?" Drafted from campus counts; move any block to fit how the districts actually run.":""}</span><span class="sp"></span>${canEdit?`<button class="btn sm" data-act="cal-draft" type="button">Redraft from today</button>`:""}</section>
  <section class="panel"><div class="pb calwrap">${head}${lanes}<div class="calkey"><span><i class="calbr"></i>School break, open for catch-up</span><span><i class="caltoday"></i>This week</span>${Object.entries(CAL_ST).map(([k,[l]])=>`<span><i class="calblk st-${k}" style="--tc:var(--ink3)"></i>${l}</span>`).join("")}</div></div></section>
  <div class="stcols"><section class="panel"><div class="ph"><h3>In a window now</h3><span class="faint">${now.length}</span></div><div class="pb" style="display:flex;flex-direction:column;gap:6px">${now.length?now.map(x=>`<div class="calline" data-calblk="${esc(x.id)}|${W.lanes[x.id].indexOf(x.b)}">${avatar(x.id,22)} <b>${esc(x.b.label)}</b> <span class="faint">until ${fmtDate(x.b.end)}</span><span class="sp"></span><span class="mono">${x.P.done}/${x.P.n}</span> <span class="pill ${CAL_ST[x.P.st][1]}">${CAL_ST[x.P.st][0]}</span></div>`).join(""):'<p class="faint" style="margin:0">No district window open this week.</p>'}</div></section>
    <section class="panel"><div class="ph"><h3>Behind or passed</h3><span class="faint">${late.length}</span></div><div class="pb" style="display:flex;flex-direction:column;gap:6px">${late.length?late.map(x=>`<div class="calline" data-calblk="${esc(x.id)}|${W.lanes[x.id].indexOf(x.b)}">${avatar(x.id,22)} <b>${esc(x.b.label)}</b> <span class="faint">${fmtDate(x.b.start)} to ${fmtDate(x.b.end)}</span><span class="sp"></span><span class="mono">${x.P.done}/${x.P.n}</span> <span class="pill ${CAL_ST[x.P.st][1]}">${CAL_ST[x.P.st][0]}</span></div>`).join(""):'<p class="faint" style="margin:0">Nothing behind.</p>'}</div></section></div>`; }

function calPanel(M,id){ const W=S.windows[M.Y]; const bl=W&&W.lanes[id]; if(!bl||!bl.length) return ""; const today=todayISO();
  return `<section class="panel"><div class="ph"><h3>Inspection calendar</h3><a class="faint" href="#calendar" style="margin-left:auto;font-size:12.5px">Whole team</a></div><div class="pb" style="display:flex;flex-direction:column;gap:6px">${bl.map((b,bi)=>{ const P=blockProgress(M,b); const on=today>=b.start&&today<=b.end;
    return `<div class="calline ${on?"on":""}" data-calblk="${esc(id)}|${bi}"><span class="mono faint" style="width:104px;font-size:11.5px">${fmtDate(b.start).slice(0,-3)} to ${fmtDate(b.end).slice(0,-3)}</span><b style="flex:1;font-size:12.5px">${esc(b.label)}</b><span class="mono" style="font-size:12px">${P.done}/${P.n}</span>${P.st!=="upcoming"?` <span class="pill ${CAL_ST[P.st][1]}">${CAL_ST[P.st][0]}</span>`:""}</div>`; }).join("")}
    <p class="faint" style="font-size:11.5px;margin:4px 0 0">School breaks are open for catch-up.</p></div></section>`; }

function openCalBlock(id,bi){ const M=model(), W=S.windows[M.Y], b=W.lanes[id][bi], P=blockProgress(M,b); const canEdit=S.canWrite&&isSupervisor();
  const fs=M.facs.filter(f=>b.orgs.includes(f.orgId)&&f.state!=="excluded").sort((a,c)=>a.visited-c.visited||a.name.localeCompare(c.name));
  openModal(`<div class="mh"><h2>${esc(b.label)}</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb" style="display:flex;flex-direction:column;gap:12px">
    <div class="rptgrid"><div><span class="eyebrow">Inspector</span><b>${esc(memberName(id))}</b></div><div><span class="eyebrow">Window</span>${canEdit?`<span style="display:flex;gap:6px;align-items:center"><input type="date" id="cb-s" value="${b.start}"> to <input type="date" id="cb-e" value="${b.end}"></span>`:`<b>${fmtDate(b.start)} to ${fmtDate(b.end)}</b>`}</div>
      <div><span class="eyebrow">Progress</span><b class="mono">${P.done} of ${P.n}</b><span class="pill ${CAL_ST[P.st][1]}">${CAL_ST[P.st][0]}</span></div></div>
    <div class="tablewrap" style="max-height:320px"><table class="t"><tbody>${fs.map(f=>`<tr class="click" data-fac="${esc(f.id)}"><td>${esc(f.name)}${b.orgs.length>1?`<div class="faint" style="font-size:12px">${esc(f.org.name)}</div>`:""}</td><td>${statePill(f.state)}</td><td class="mono faint">${f.lastY?fmtDate(f.lastY.date):""}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="mf"><button class="btn" data-close="1" type="button">Close</button>${canEdit?`<button class="btn primary" data-calsave="${esc(id)}|${bi}" type="button">Save window</button>`:""}</div>`); }
document.addEventListener("click",async e=>{ const t=e.target;
  const cb=t.closest("[data-calblk]"); if(cb&&!t.closest(".modal")){ const [id,bi]=cb.dataset.calblk.split("|"); openCalBlock(id,+bi); return; }
  const cs=t.closest("[data-calsave]"); if(cs){ const [id,bi]=cs.dataset.calsave.split("|"); const s=$("#cb-s").value, en=$("#cb-e").value; if(!s||!en||en<s){ flash("The end date must be after the start."); return; }
    const M=model(); const lane=S.windows[M.Y].lanes[id].map((b,i)=>i===+bi?Object.assign({},b,{start:s,end:en}):b);
    const ok=await write(()=>S.db.doc("windows/"+M.Y).update({lanes:{[id]:lane},editedAt:new Date().toISOString(),editedBy:(myTeamMember()||{}).id||null}),"Window saved"); if(ok) closeModal(); return; }
  const dr=t.closest('[data-act="cal-draft"]'); if(dr){ const M=model(); const start=mondayOf(todayISO()>`${M.Y.slice(0,4)}-10-01`?todayISO():`${M.Y.slice(0,4)}-10-05`); const W=draftWindows(M,start,`${+M.Y.slice(0,4)+1}-05-28`);
    await write(()=>S.db.doc("windows/"+M.Y).set(Object.assign(W,{draft:true,draftedAt:new Date().toISOString(),draftedBy:(myTeamMember()||{}).id||null})),"Calendar drafted"); return; }
});
