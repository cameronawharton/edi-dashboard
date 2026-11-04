/* ------------------------------------------------------------------ supervisor attention panel, flag review, command summary for stakeholders */
S.flags=S.flags||{};
const SUP_ROLES=["captain","lieutenant","sergeant"];
const isSupervisor=()=>{ const m=myTeamMember(); return !!(m&&SUP_ROLES.includes(m.role)); };
const FLAGGED=["longer","shorter","place","noday"];
/* a stable id for an assist entry, so an explanation survives a reupload of the same entry */
function flagId(a){ let h=0; const s=String(a.desc||""); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return `${a.date.slice(0,7)}__${a.member}__${a.date}__${occKey(a.id).replace(/[^A-Z0-9-]/g,"")}__${h.toString(36)}`; }
function flagState(o){ const f=S.flags[flagId(o.a)]; if(!f) return "open"; return f.status||"explained"; } // open | explained | accepted | sentback
const FLAG_STATE={open:["Needs explanation","s-failed"],explained:["Explained, awaiting review","s-due"],accepted:["Accepted","s-done"],sentback:["Sent back: fix in ER and reupload","s-failed"]};
function flagCell(o){ if(!FLAGGED.includes(o.check)) return ""; const id=flagId(o.a), f=S.flags[id], st=flagState(o); const [l,c]=FLAG_STATE[st];
  const me=myTeamMember(); const own=me&&me.id===o.a.member; const canExplain=S.canWrite&&(own||isSupervisor()); const canReview=S.canWrite&&isSupervisor()&&f&&st==="explained";
  return `<div class="flagbox"><span class="pill ${c}">${l}</span>${f&&f.note?`<div class="flagnote">“${esc(f.note)}”<span class="faint"> ${esc(memberName(f.noteBy)||"")}${f.noteAt?" · "+fmtDate(f.noteAt.slice(0,10)):""}</span></div>`:""}
    ${f&&f.reviewBy?`<div class="faint" style="font-size:11.5px">${st==="accepted"?"Accepted":"Sent back"} by ${esc(memberName(f.reviewBy))}</div>`:""}
    <div class="flagacts">${canExplain&&st!=="accepted"?`<button class="btn sm" type="button" data-flagexp="${esc(id)}" data-mem="${esc(o.a.member)}">${f&&f.note?"Edit explanation":"Explain"}</button>`:""}${canReview?`<button class="btn sm" type="button" data-flagrev="accepted" data-fid="${esc(id)}">Accept</button><button class="btn sm" type="button" data-flagrev="sentback" data-fid="${esc(id)}">Send back</button>`:""}</div></div>`; }
function openExplain(id,member){ const f=S.flags[id]||{};
  openModal(`<div class="mh"><h2>Explain this assist</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb" style="display:flex;flex-direction:column;gap:10px">
    <p class="faint" style="margin:0;font-size:12.5px">Say what happened in a sentence or two. If the action code was entered wrong, correct it in Emergency Reporting; the corrected report is reuploaded by a sergeant or lieutenant and replaces this one.</p>
    <textarea id="flagnote" rows="4" style="width:100%">${esc(f.note||"")}</textarea></div>
    <div class="mf"><button class="btn" data-close="1" type="button">Cancel</button><button class="btn primary" type="button" data-flagsave="${esc(id)}" data-mem="${esc(member)}">Save</button></div>`); }
async function saveFlag(id,patch){ const ref=S.db.doc("flags/"+id);
  return write(async()=>{ if(S.flags[id]) await ref.update(patch); else await ref.set(patch); },"Saved"); }
document.addEventListener("click",async e=>{ const t=e.target;
  const ex=t.closest("[data-flagexp]"); if(ex){ openExplain(ex.dataset.flagexp,ex.dataset.mem); return; }
  const sv=t.closest("[data-flagsave]"); if(sv){ const note=($("#flagnote").value||"").trim(); if(!note){ flash("Write a short explanation first."); return; } const id=sv.dataset.flagsave;
    const ok=await saveFlag(id,Object.assign(S.flags[id]?{}:{month:id.slice(0,7),member:sv.dataset.mem},{note,noteBy:(myTeamMember()||{}).id||S.me.id||null,noteAt:new Date().toISOString(),status:"explained",reviewBy:null,reviewAt:null})); if(ok) closeModal(); return; }
  const rv=t.closest("[data-flagrev]"); if(rv){ await saveFlag(rv.dataset.fid,{status:rv.dataset.flagrev,reviewBy:(myTeamMember()||{}).id||null,reviewAt:new Date().toISOString()}); return; }
  const go=t.closest("[data-jump]"); if(go){ const el=document.getElementById(go.dataset.jump); if(el){ if(el.tagName==="DETAILS") el.open=true; el.scrollIntoView({behavior:"smooth",block:"start"}); } return; }
  const pr=t.closest("[data-act='brief-print']"); if(pr){ window.print(); return; }
});

/* ---- weekly supervisor check */
function attentionPanel(month,div){ div=div||"education"; const M=model(); const i=+month.slice(5)-1, year=+month.slice(0,4);
  const field=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)===div).map(([id])=>id);
  const haveER=erDocsFor(month,div).length>0;
  const low=haveER?field.map(id=>[id,personHours(id,month)]).filter(([,h])=>h.perDay<HOURS_TARGET).sort((a,b)=>a[1].perDay-b[1].perDay):[];
  const A=assistCheck(month,div).filter(o=>FLAGGED.includes(o.check)); const open=A.filter(o=>["open","sentback"].includes(flagState(o))), review=A.filter(o=>flagState(o)==="explained");
  const behind=div!=="education"?[]:Object.values(M.orgStats).filter(s=>s.behind).sort((a,b)=>(b.expected-b.coverage)*b.active-(a.expected-a.coverage)*a.active);
  const box=(n,title,body,jump,warn)=>`<div class="att ${n?warn||"warn":"ok"}"><div class="atth"><b class="num">${n}</b><span>${title}</span>${jump&&n?`<button class="btn sm ghost" type="button" data-jump="${jump}">Review</button>`:""}</div>${n?`<div class="attb">${body}</div>`:`<div class="attb faint">Nothing here.</div>`}</div>`;
  const lowB=low.map(([id,h])=>`<span class="attrow">${avatar(id,20)} ${esc(memberName(id))} <span class="mono">${h.perDay.toFixed(1)} h/day</span></span>`).join("");
  const flagB=`${open.length?`<span class="attrow">${open.length} with no explanation or sent back</span>`:""}${review.length?`<span class="attrow">${review.length} explained, waiting for your review</span>`:""}${[...new Set(open.map(o=>o.a.member))].map(id=>`<span class="attrow">${avatar(id,20)} ${esc(memberName(id))} <span class="mono">${open.filter(o=>o.a.member===id).length}</span></span>`).join("")}`;
  const behB=behind.slice(0,8).map(s=>`<span class="attrow click" data-org="${esc(s.id)}">${esc(s.org.name)} <span class="mono">${Math.max(1,Math.ceil((s.expected-s.coverage)*s.active))} behind</span>${s.org.assignedTo?` <span class="faint">· ${esc(memberName(s.org.assignedTo))}</span>`:` <span class="faint">· unassigned</span>`}</span>`).join("")+(behind.length>8?`<span class="faint">and ${behind.length-8} more</span>`:"");
  return `<section class="panel"><div class="ph"><h3>Needs attention</h3><span class="faint">${MON3[i]} ${year} · weekly supervisor check</span></div><div class="pb attgrid">
    ${box(haveER?low.length:0,`under ${HOURS_TARGET} hours per day`,haveER?lowB:"",haveER?"hourspanel":null)}
    ${box(open.length+review.length,"assists that don't line up",flagB,"actionspanel")}
    ${div==="education"?box(behind.length,`districts behind rotation pace (${M.Y})`,behB,null):""}
  </div>${haveER?"":`<p class="method" style="padding:0 16px 14px">Hours need this month's Emergency Reporting exports.</p>`}</section>`; }

/* ---- command summary (assistant chiefs and up): division numbers, positive highlights by rule */
function highlightCriteria(month){ const field=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)==="education").map(([id])=>id); const M=model();
  const A=assistCheck(month).filter(o=>FLAGGED.includes(o.check)); const unexplained=new Set(A.filter(o=>flagState(o)!=="accepted").map(o=>o.a.member));
  const O=erOutcomes(month,"education"); const res={}; field.forEach(id=>res[id]={c:[]});
  if(erDocsFor(month,"education").length) field.forEach(id=>{ const h=personHours(id,month); if(h.perDay>=HOURS_TARGET&&!unexplained.has(id)) res[id].c.push(`${h.perDay.toFixed(1)} hours per day with every flag cleared`); });
  const fv={}; O.first.forEach(r=>{ const id=r.member||teamIdFor(r.inspName); if(!res[id]) return; const o=fv[id]=fv[id]||{n:0,p:0}; o.n++; if(r.res!=="fail") o.p++; });
  const fvR=Object.entries(fv).filter(([,o])=>o.n>=5).map(([id,o])=>[id,o.p/o.n,o]); const top=Math.max(-1,...fvR.map(x=>x[1]));
  fvR.filter(x=>x[1]===top).forEach(([id,r,o])=>res[id].c.push(`best first-visit pass rate, ${pct(r)} of ${o.n}`));
  const cl={}; O.cleared.forEach(c=>{ const id=teamIdFor(c.from.inspName); if(!res[id]) return; (cl[id]=cl[id]||[]).push(c.days); });
  const clR=Object.entries(cl).filter(([,d])=>d.length>=2).map(([id,d])=>[id,median(d),d.length]); const fast=Math.min(Infinity,...clR.map(x=>x[1]));
  clR.filter(x=>x[1]===fast).forEach(([id,m,n])=>res[id].c.push(`fastest hazard closure, median ${Math.round(m)} days over ${n}`));
  field.forEach(id=>{ const os=Object.values(M.orgStats).filter(s=>s.org.assignedTo===id&&s.active); if(os.length&&os.every(s=>s.met)) res[id].c.push(`finished the rotation in all ${os.length} assigned districts`); });
  return Object.entries(res).filter(([,o])=>o.c.length>=2).map(([id,o])=>({id,c:o.c})); }

function vBrief(M){ const st=S.ui.st; if(!st.month) st.month=defaultMonth(); const month=st.month, year=+month.slice(0,4), i=+month.slice(5)-1;
  const mlabel=`${["January","February","March","April","May","June","July","August","September","October","November","December"][i]} ${year}`;
  const G=yearGrid("education",year), O=erOutcomes(month,"education"), hasER=O.rows.length>0;
  const field=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)==="education").map(([id])=>id);
  const months=statMonths(); if(!months.includes(month)) months.unshift(month);
  /* staffing: visits still needed this season vs the rate the team is delivering */
  const b=yearBounds(M.Y), today=todayISO(); const P=M.prog; const need=["ISD","Charter","Private","Daycare"].reduce((s,t)=>s+P[t].need,0);
  const wkLeft=Math.max(0,(Date.parse(b.workEnd)-Date.parse(today))/6048e5); const wkIn=Math.max(1,(Date.parse(today)-Date.parse(b.start))/6048e5); const done=M.visits.filter(v=>!v.voided&&v.date>=b.start&&v.date<=today).length;
  const recent=done/wkIn; const finishWk=recent?need/recent:Infinity; const finish=isFinite(finishWk)?new Date(Date.parse(today)+finishWk*6048e5).toISOString().slice(0,10):null; const needWk=wkLeft?need/wkLeft:0;
  const onTrack=recent>=needWk; const perInsp=field.length?needWk/field.length:0; const gap=Math.max(0,needWk-recent);
  /* workload: spread without names */
  const hrs=field.map(id=>personHours(id,month).perDay).filter(x=>x>0), loads=field.map(id=>Object.values(M.orgStats).filter(s=>s.org.assignedTo===id&&s.active).reduce((s,x)=>s+x.active,0));
  const unassigned=Object.values(M.orgStats).filter(s=>s.active&&!s.org.assignedTo);
  /* risk: repeat failures across every imported month */
  const allRows=Object.values(S.er).filter(d=>(d.division||"education")==="education"&&d.month<=month).flatMap(d=>d.rows.map(erLive));
  const byOcc={}; allRows.filter(r=>r.res==="fail").forEach(r=>{ const k=occKey(r.id); (byOcc[k]=byOcc[k]||{occ:r.occ,n:0,fac:r.fac}).n++; });
  const repeat=Object.values(byOcc).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n);
  const fails=allRows.filter(r=>r.date.slice(0,7)===month).flatMap(r=>r.fl||[]); const topItems={}; fails.forEach(f=>{ const q=f.q.replace(/\s+/g," ").trim(); const m=q.match(/^(HC\s+)?(\d{3,4}(?:\.\d+)*)\s+(.*)$/); if(!m) return; const k=(m[1]||"")+m[2]; const o=topItems[k]=topItems[k]||{n:0,label:m[3].replace(/^[-–\s]+/,"").replace(/[.\s]+$/,"")}; o.n++; });
  /* value */
  const H=field.map(id=>personHours(id,month)); const insH=H.reduce((s,h)=>s+h.erH,0), actH=H.reduce((s,h)=>s+h.actH,0), days=H.reduce((s,h)=>s+h.days,0);
  const HL=highlightCriteria(month);
  const tile=(lbl,v,sub)=>`<div class="stt"><span class="eyebrow">${lbl}</span><b class="num">${v??"–"}</b><span class="sub">${sub||""}</span></div>`;
  const sec=(h,body)=>`<section class="panel brief"><div class="ph"><h3>${h}</h3></div><div class="pb">${body}</div></section>`;
  const kv=(k,v,n)=>`<div class="kv"><span>${k}</span><b class="mono">${v}</b>${n?`<small class="faint">${n}</small>`:""}</div>`;
  return `<div class="sechead sthead noprint"><select id="st-month" aria-label="Month">${months.map(m=>`<option value="${m}" ${m===month?"selected":""}>${MON3[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("")}</select><span class="faint">Education Division · for command staff</span><span class="sp"></span><button class="btn" type="button" data-act="brief-print">Print one-page report</button></div>
  <div class="briefhead"><span class="eyebrow">HCFMO Prevention Bureau · Education Division</span><h2>${mlabel} command summary</h2></div>
  <div class="sttiles">
    ${tile("Prevention services",G.v.all[i],`YTD ${sumTo(G.v.all,i)??"–"} · on pace for ${projected(sumTo(G.v.all,i),month)??"–"}`)}
    ${tile("Inspections",G.v.fire[i],`${G.v.permit[i]??0} permit · ${G.v.existing[i]??0} existing building`)}
    ${tile("School coverage",pct(P.ISD.coverage),`${P.ISD.visited} of ${P.ISD.active} campuses · target ${pct(P.ISD.target)}`)}
    ${tile("Hazards still open",hasER?O.open.length:"–",hasER?`median ${O.cleared.length?Math.round(median(O.cleared.map(c=>c.days)))+" days":"–"} to correct`:"")}
    ${tile("Field hours",(insH+actH).toFixed(0),`${field.length} inspectors · ${days} days worked`)}
  </div>
  <div class="briefgrid">
  ${sec("Staffing: can we cover every school this season?",`${kv("Visits still needed",need,`${M.Y} season, all school types`)}${kv("Weeks left in the season",wkLeft.toFixed(0),`through ${fmtDate(b.workEnd)}`)}${kv("Needed per week",needWk.toFixed(1),`${perInsp.toFixed(1)} per inspector`)}${kv("Delivered per week",recent.toFixed(1),`${done} rotation visits since ${fmtDate(b.start)}`)}${kv("Projected finish at this pace",finish?fmtDate(finish):"–",`season ends ${fmtDate(b.workEnd)}`)}
    <div class="recon ${onTrack?"ok":""}"><b>${onTrack?"On pace to cover every school":"Behind the pace needed to cover every school"}</b><span>${onTrack?"The season-to-date pace covers what remains.":`About ${gap.toFixed(1)} more rotation visits a week are needed to finish on time. Only rotation visits count toward coverage; construction and follow-up work is in the inspection totals above.`}</span></div>`)}
  ${sec("Workload balance",`${kv("Campuses assigned per inspector",loads.length?`${Math.min(...loads)} to ${Math.max(...loads)}`:"–","lowest to highest")}${kv("Hours per day",hrs.length?`${Math.min(...hrs).toFixed(1)} to ${Math.max(...hrs).toFixed(1)}`:"–",`target ${HOURS_TARGET}`)}${kv("Team average",hrs.length?(hrs.reduce((s,x)=>s+x,0)/hrs.length).toFixed(1):"–","hours per day")}${kv("Districts with no inspector assigned",unassigned.length,unassigned.slice(0,4).map(s=>s.org.name).join(", "))}`)}
  ${sec("Risk",`${kv("Locations with hazards still open",hasER?O.open.length:"–",O.open.length?`oldest open ${O.open[0].days} days`:"")}${kv("Locations that failed more than once",repeat.length,"across every imported month")}
    ${repeat.length?`<ul class="issues">${repeat.slice(0,5).map(x=>`<li>${esc(x.occ)} <span class="mono faint">${x.n} failed inspections</span></li>`).join("")}</ul>`:""}
    ${fails.length?`<span class="eyebrow" style="display:block;margin-top:10px">Most cited fire code sections this month</span><ul class="issues">${Object.entries(topItems).sort((a,b)=>b[1].n-a[1].n).slice(0,5).map(([k,o])=>`<li><span class="mono">${esc(k)}</span> ${esc(o.label.length>80?o.label.slice(0,77)+"…":o.label)} <span class="mono faint">${o.n}</span></li>`).join("")}</ul>`:""}`)}
  ${sec("Budget and value",`${kv("Inspection hours",insH.toFixed(0),"on site plus additional time")}${kv("Action-code hours",actH.toFixed(0),"site visits, assists, other coded work")}${kv("Inspections per 100 field hours",(insH+actH)?((O.rows.length/(insH+actH))*100).toFixed(1):"–")}${kv("Hazards found per 10 inspections",O.rows.length?(O.fail/O.rows.length*10).toFixed(1):"–")}${kv("Certificates issued",O.coi+O.cond,`${O.coi} COIs · ${O.cond} conditional`)}`)}
  </div>
  ${sec("Highlights",HL.length?HL.map(h=>`<div class="hl">${avatar(h.id,36)}<div><b>${esc(memberName(h.id,"rank"))}</b><ul>${h.c.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div></div>`).join(""):`<p class="faint" style="margin:0">No one met two of the four highlight measures this month.</p>`)
    .replace('<div class="pb">','<div class="pb"><p class="method" style="margin:0 0 8px">A person is named when they meet two of four in the same month: 6.5 hours per day with every flag cleared; best first-visit pass rate (at least 5 first visits); fastest hazard closure (at least 2 corrected); rotation finished in every assigned district.</p>')}
  <p class="method">Sources: Emergency Reporting inspection exports, inspection report PDFs and the action-code report, loaded monthly by sergeants and lieutenants. Individual performance is not shown here except as highlights.</p>`; }
