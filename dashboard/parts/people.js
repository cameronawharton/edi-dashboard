/* ------------------------------------------------------------------ people: profiles, sign-in presence, personal activity log */
S.log=S.log||{};
S.ui.pp={month:null};
const ROLES={chief:{label:"Assistant Chief",short:"A/C",about:"Executive leadership over Prevention Inspection Services."},
  captain:{label:"Captain",short:"Capt.",about:"Bureau command. Full access to settings, profiles and every report."},
  lieutenant:{label:"Lieutenant",short:"Lt.",about:"Division command. Reviews the division's work and pulls what leadership needs."},
  manager:{label:"Manager",short:"Mgr.",about:"Leads a civilian services team for the bureau."},
  sergeant:{label:"Sergeant",short:"Sgt.",about:"Runs the monthly Emergency Reporting imports and keeps the division's records current."},
  inspector:{label:"Inspector",short:"Insp.",about:"School inspections across assigned districts. Work goes in once, through Emergency Reporting."},
  specialist:{label:"Fire Systems Specialist",short:"FSS",about:"Fire systems oversight for county facilities."},
  liaison:{label:"Engineer Liaison",short:"Liaison",about:"Engineering liaison and code expert for the bureau."},
  admin:{label:"Administrative Staff",short:"Admin",about:"Administrative support for the Prevention Bureau."}};
const ROLE_ORDER=["chief","captain","lieutenant","manager","sergeant","inspector","specialist","liaison","admin"];
/* Nov 9 2026: every division under Asst. Chief Howell (org chart). "command" holds the chief, captain and liaison and is shown as the leadership row, not a tab */
/* Nov 9 2026 (Cameron): Asst. Chief Howell > Capt. Wharton > Lt. Kennedy over CO/ED (Sgt. Regalado: Education, Sgt. Solis: FSS / County)
   and Lt. Kronenberger over General Occupancies (Sgt. Lawhorn: East, Sgt. Kveton: West); Harrell is on the Alternative Methods plan review team.
   Division keys drive the stats logic (education, county, general); the org tree on the Team page comes from team.reportsTo. */
const DIVS={education:"CO/ED · Education",county:"CO/ED · FSS / County",general:"General Occupancies",admin:"Administrative Services",amr:"Alternative Methods",serg:"S.E.R.G."};
const LEAD_ROLES=["chief","captain","lieutenant"];
/* people on the selected tab who are not in the productivity cards (managers, admin staff, liaison) */
function teamLead(){ const d=S.ui.teamDiv||"education"; return Object.entries(S.team).filter(([,x])=>x.active!==false&&!isField(x)&&!LEAD_ROLES.includes(x.role)&&divOf(x)===d).sort((a,b)=>(ROLE_ORDER.indexOf(a[1].role)-ROLE_ORDER.indexOf(b[1].role))||a[1].name.localeCompare(b[1].name)); }
const divCount=k=>Object.values(S.team).filter(x=>x.active!==false&&divOf(x)===k&&!LEAD_ROLES.includes(x.role)).length;
/* chain of command, drawn from reportsTo. Leaves (people nobody reports to) sit as chips under their supervisor */
function orgTree(){ const act=Object.entries(S.team).filter(([,t])=>t.active!==false); if(!act.some(([,t])=>t.reportsTo)) return "";
  const kids={}; act.forEach(([id,t])=>{ const p=t.reportsTo&&S.team[t.reportsTo]?t.reportsTo:"_root"; (kids[p]=kids[p]||[]).push(id); });
  const rank=id=>ROLE_ORDER.indexOf(S.team[id].role||"inspector"), ord=(a,b)=>rank(a)-rank(b)||memberName(a).localeCompare(memberName(b));
  const label=id=>{ const t=S.team[id]; return `<span class="ot-who" data-person="${esc(id)}" role="link" tabindex="0">${avatar(id,28)}<span><b>${esc(memberName(id))}</b><small>${esc(roleOf(t).label)}${t.section?" · "+esc(t.section):""}</small></span></span>`; };
  const node=id=>{ const ch=(kids[id]||[]).sort(ord), team=["sergeant","manager"].includes(S.team[id].role), leaves=team?ch.filter(c=>!kids[c]):[], subs=team?ch.filter(c=>kids[c]):ch;
    if(!kids[id]&&!team) return `<li>${label(id)}</li>`;
    return `<li>${label(id)}${leaves.length?`<div class="ot-leaves">${leaves.map(c=>`<span class="ot-chip" data-person="${esc(c)}" role="link" tabindex="0">${avatar(c,22)}${esc(memberName(c))}</span>`).join("")}</div>`:""}${subs.length?`<ul>${subs.map(node).join("")}</ul>`:""}</li>`; };
  const roots=(kids._root||[]).sort(ord), tops=roots.filter(r=>kids[r]), loose=roots.filter(r=>!kids[r]);
  return `<section class="panel"><div class="ph"><h3>Organization</h3><span class="faint">Prevention Inspection Services</span></div><div class="pb"><ul class="orgtree">${tops.map(node).join("")}</ul>
    ${loose.length?`<div class="ot-loose"><span class="eyebrow">Outside this chain</span>${loose.map(c=>`<span class="ot-chip" data-person="${esc(c)}" role="link" tabindex="0">${avatar(c,22)}${esc(memberName(c))}${S.team[c].tester?" · test partner":""}</span>`).join("")}</div>`:""}</div></section>`; }
/* the published app links a signed-in person to the profile whose county email matches; nobody can take someone else's profile */
const appBuild=()=>!!window.EDI_CONFIG;
const myEmail=()=>String((S.me&&(S.me.email||S.me.name))||"").toLowerCase();
function autoLink(){ if(!appBuild()||S.ui._autolinked||!S.me.id||!S.canWrite||myTeamMember()||!Object.keys(S.team).length) return; S.ui._autolinked=true;
  const hit=Object.entries(S.team).find(([,t])=>t.emailLc&&t.emailLc===myEmail()&&!t.userId); if(hit) claimProfile(hit[0]); }
const divOf=t=>(t&&t.division)||"education";
const HOURS_TARGET=6.5; // average hours worked per day the bureau expects at minimum
/* supervisors exempt from the hours target (Nov 4 2026): team.hoursExempt. Their hours still show, without a target */
const hoursExempt=id=>!!(S.team[id]&&S.team[id].hoursExempt);
const BANNERS={standard:{label:"Standard"}}; // more presets later; profile.banner picks one
const LOG_KINDS=[...BOARD.filter(b=>b.manual&&!b.measure&&b.grp==="actions"),BROW.oppapp];
const roleOf=t=>ROLES[(t&&t.role)||"inspector"]||ROLES.inspector;
const isField=t=>t&&t.active!==false&&t.field!==false;
function memberName(id,opt){ const t=S.team[id]; if(!t) return id||"Unknown"; const parts=t.name.split(" "); const first=t.preferred||parts[0]; const nm=opt==="first"?first:`${first} ${parts.slice(1).join(" ")}`; return opt==="rank"?`${roleOf(t).short} ${nm}`:nm; }
function avatar(id,size,cls){ const t=S.team[id]||{}; const nm=t.name||String(id||"?"); const ini=nm.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return `<span class="av ${cls||""}" style="--s:${size||32}px;background:${teamColor(id)}" aria-hidden="true">${esc(ini)}${t.photo?`<img src="${esc(t.photo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</span>`; }
const amCaptain=()=>{ const m=myTeamMember(); return !!m&&m.role==="captain"; };
const canEditPerson=id=>S.canWrite&&(amCaptain()||(myTeamMember()&&myTeamMember().id===id));
const canLogFor=id=>S.canWrite&&!!myTeamMember()&&(myTeamMember().id===id||["captain","sergeant"].includes(myTeamMember().role));

/* top-bar identity chip */
function meChipHTML(){ if(S.offline||!S.ready) return ""; const m=myTeamMember();
  if(m) return `${avatar(m.id,30)}<span class="mc-t"><b>${esc(memberName(m.id))}</b><small>${esc(roleOf(m).label)}${m.unit?` · ${esc(m.unit)}`:""}</small></span>`;
  return `<span class="av empty" style="--s:30px" aria-hidden="true">?</span><span class="mc-t"><b>Choose your profile</b><small>${S.me.name?`Signed in as ${esc(S.me.name)}`:"Signed in"}</small></span>`; }
function openClaim(){ const mine=myTeamMember(); const list=Object.entries(S.team).filter(([,t])=>t.active!==false).sort((a,b)=>(ROLE_ORDER.indexOf(a[1].role||"inspector")-ROLE_ORDER.indexOf(b[1].role||"inspector"))||a[1].name.localeCompare(b[1].name));
  openModal(`<div class="mh"><h2>Who is signed in?</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb">
    <p class="muted" style="margin:0">${appBuild()?`You are signed in as <b>${esc(myEmail()||"this account")}</b>. Your profile links on its own when this address matches the county email on file.`:`You are signed in to Claude as <b>${esc(S.me.name||"this account")}</b>. Pick your profile once and this account stays linked to it: your name shows at the top of every page and the inspections and activity you log are credited to you.`}</p>
    <div class="claimgrid">${list.map(([id,t])=>{ const taken=t.userId&&t.userId!==S.me.id; const me=t.userId===S.me.id;
      return `<button class="claimcard ${me?"on":""}" type="button" ${taken||mine?"disabled":`data-act="claim" data-team="${esc(id)}"`}>${avatar(id,64)}<b>${esc(memberName(id))}</b><small>${esc(roleOf(t).label)}</small><span class="faint" style="font-size:11.5px">${me?"You":taken?"Already linked":"Select"}</span></button>`; }).join("")}</div>
    ${mine?`<p class="faint" style="margin:0;font-size:12.5px">This account is linked to ${esc(memberName(mine.id))}. To switch, open your profile and choose “Not me”.</p>`:`<p class="faint" style="margin:0;font-size:12.5px">Not listed? Ask the captain to add you on the Team page.</p>`}</div>`,true); }
async function claimProfile(id){ if(myTeamMember()) return; const t=S.team[id]; if(!t||(t.userId&&t.userId!==S.me.id)) return;
  if(appBuild()&&(t.emailLc||"")!==myEmail()){ flash(`That profile belongs to ${memberName(id)}. Profiles link to the county email on file; ask Capt. Wharton if yours is wrong.`); return; }
  if(await write(()=>S.db.doc("team/"+id).update({userId:S.me.id,accountName:S.me.name||"",linkedAt:new Date().toISOString()}),`Signed in as ${memberName(id)}`)){ closeModal(); location.hash="me"; } }

/* personal log */
function logDocs(month){ return Object.entries(S.log).filter(([,d])=>!month||d.month===month).map(([id,d])=>Object.assign({id},d)); }
function logEntries(member,month){ return logDocs(month).filter(d=>!member||d.member===member).flatMap(d=>Object.entries(d.entries||{}).filter(([,e])=>e&&!e.voided).map(([eid,e])=>Object.assign({eid,doc:d.id,member:d.member},e))).sort((a,b)=>b.date.localeCompare(a.date)||String(b.at).localeCompare(String(a.at))); }
function teamLogSums(month){ const es=logEntries(null,month); const k={}; es.forEach(e=>{ k[e.k]=(k[e.k]||0)+(+e.n||0); }); return {any:es.length>0,k,people:new Set(es.map(e=>e.member)).size}; }
async function addLogEntry(member){ const date=$("#lg-date").value, k=$("#lg-kind").value, n=Math.max(1,Math.round(+$("#lg-n").value||1)), note=$("#lg-note").value.trim(), hv=$("#lg-h").value.trim(), h=hv===""?undefined:Math.max(0,Math.round(+hv*4)/4);
  if(!date||!k){ flash("Pick a date and an activity."); return; } const month=date.slice(0,7), id=`${member}__${month}`, eid=uid("a");
  const entry={date,k,n,h,note:note||undefined,by:S.me.id||null,at:new Date().toISOString()}; Object.keys(entry).forEach(x=>entry[x]===undefined&&delete entry[x]);
  const ref=S.db.doc("log/"+id);
  const ok=await write(async()=>{ if(S.log[id]) await ref.update({entries:{[eid]:entry}}); else { try{ await ref.update({entries:{[eid]:entry}}); }catch(e){ if(e&&e.code==="invalid_argument") await ref.set({member,month,entries:{[eid]:entry}}); else throw e; } } },`Logged ${n} × ${BROW[k].label}`);
  if(ok){ $("#lg-n").value=1; $("#lg-note").value=""; $("#lg-h").value=""; } }

/* profile page */
function personMonth(id){ const st=S.ui.pp; if(st.month) return st.month; const ms=[...Object.values(S.er).filter(d=>d.inspector===id).map(d=>d.month), ...logDocs().filter(d=>d.member===id).map(d=>d.month)].sort(); const t=todayISO().slice(0,7); return ms.length&&ms[ms.length-1]<t&&!logDocs(t).some(d=>d.member===id)?ms[ms.length-1]:t; }
function personStats(id,month){ const er=erRowsFor(month,S.team[id]?divOf(S.team[id]):"education").filter(r=>r.member===id); const M=model(yearOf(month+"-15"));
  const visits=M.visits.filter(v=>!v.voided&&v.inspector===id&&v.date.slice(0,7)===month); const acts=logEntries(id,month);
  return {er,visits,acts,actN:acts.reduce((s,e)=>s+(+e.n||0),0),fail:er.filter(r=>r.res==="fail").length,coi:er.filter(r=>r.coi).length+er.filter(r=>r.res==="conditional").length,mins:er.reduce((s,r)=>s+(r.mins||0),0)}; }
function vPerson(M,pid){
  const me=myTeamMember(); const id=pid==="me"?(me&&me.id):pid; const t=S.team[id];
  if(!t){ if(pid==="me") return `<div class="skeleton"><h2>No profile linked yet</h2><p>Choose your profile so the dashboard knows who you are.</p>${S.ready&&!S.offline?`<button class="btn primary" data-act="claim-open" type="button">Choose your profile</button>`:""}</div>`;
    return `<div class="skeleton"><h2>Profile not found</h2><a class="btn" href="#team">Back to the team</a></div>`; }
  const R=roleOf(t), self=me&&me.id===id, month=personMonth(id), mi=+month.slice(5)-1, ml=`${MON3[mi]} ${month.slice(0,4)}`, P=personStats(id,month);
  const months=[...new Set([todayISO().slice(0,7),month,...Object.values(S.er).filter(d=>d.inspector===id).map(d=>d.month),...logDocs().filter(d=>d.member===id).map(d=>d.month)])].sort().reverse();
  const head=`<section class="phead banner-${esc((t.profile&&t.profile.banner)||"standard")}" style="--tc:${teamColor(id)}"><div class="pbanner"><span class="pb-unit">${esc(t.unit||"")}</span></div>
    <div class="pid">${t.portrait||t.photo?`<img class="pportrait" src="${esc(t.portrait||t.photo)}" alt="Portrait of ${esc(t.name)}">`:avatar(id,120,"pav")}
      <div class="pname"><span class="eyebrow">${esc(R.label)}${t.unit?` · Unit ${esc(t.unit)}`:""}</span><h2>${esc(memberName(id))}</h2>${t.preferred&&t.preferred!==t.name.split(" ")[0]?`<span class="faint">${esc(t.name)}</span>`:""}
        ${t.profile&&t.profile.tagline?`<p class="ptag">${esc(t.profile.tagline)}</p>`:`<p class="ptag faint">${esc(R.about)}</p>`}
        <div class="pchips">${self?`<span class="pill s-done">Signed in as you</span>`:t.userId?`<span class="pill s-off">Linked</span>`:`<span class="pill s-off">Not signed in yet</span>`}${!isField(t)?`<span class="tag">Oversight</span>`:""}</div></div>
      <div class="pact">${canEditPerson(id)?`<button class="btn sm" data-act="person-edit" data-team="${esc(id)}" type="button">Edit profile</button>`:""}${self?`<button class="btn sm ghost" data-act="unclaim" data-team="${esc(id)}" type="button">Not me</button>`:""}</div></div></section>`;
  const msel=`<select id="pp-month" aria-label="Month">${months.map(m=>`<option value="${m}" ${m===month?"selected":""}>${MON3[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("")}</select>`;
  const tiles=`<div class="pstats">
    <div><b>${P.er.length}</b><span>inspections in Emergency Reporting</span></div><div><b>${P.fail}</b><span>found hazards</span></div><div><b>${P.coi}</b><span>certificates issued</span></div>
    ${seesHoursOf(id)?(h=>`<div><b>${h.perDay.toFixed(1)}</b><span>hours per day · ${h.total.toFixed(1)} h over ${h.days} days</span></div>`)(personHours(id,month)):""}<div><b>${P.visits.length}</b><span>school inspections this month</span></div><div><b>${actRows(month,divOf(t),id).length}</b><span>action codes entered</span></div></div>`;
  const insp=P.er.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const inspPanel=`<section class="panel"><div class="ph"><h3>Inspections</h3><span class="faint">${ml} · from Emergency Reporting</span></div>${insp.length?`<div class="tablewrap" style="max-height:420px"><table class="t"><thead><tr><th>Date</th><th>Type</th><th>Occupancy</th><th>Result</th></tr></thead><tbody>${insp.map(r=>`<tr ${r.fac?`class="click" data-fac="${esc(r.fac)}"`:""}><td class="mono">${fmtDate(r.date)}</td><td class="faint">${esc(r.type)}</td><td>${esc(r.occ)}</td><td>${erPill(r.res)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="pb faint" style="font-size:12.5px">No Emergency Reporting import for ${ml} yet.</div>`}</section>`;
  const assigned=Object.values(M.orgStats).filter(s=>s.org.assignedTo===id&&s.active);
  const myFacs=M.facs.filter(f=>f.org&&f.org.assignedTo===id&&f.state!=="excluded");
  const typeCount=["ISD","Charter","Private","Daycare"].map(ty=>{ const fs=myFacs.filter(f=>f.type===ty); return {ty,n:fs.length,done:fs.filter(f=>f.visited).length}; });
  const typeTiles=`<div class="asgtypes">${typeCount.map(c=>`<div class="${c.n?"":"none"}"><b class="num">${c.n}</b><span>${{ISD:"ISD campuses",Charter:"Charter campuses",Private:"Private schools",Daycare:"Daycares"}[c.ty]}</span><small class="faint">${c.n?`${c.done} inspected this season`:"none assigned"}</small></div>`).join("")}</div>`;
  const asg=assigned.length?`<section class="panel"><div class="ph"><h3>Assigned schools</h3><span class="faint">${M.Y} · ${myFacs.length} total, all due every season</span></div><div class="pb" style="display:flex;flex-direction:column;gap:8px">${typeTiles}<span class="eyebrow" style="margin-top:6px">By district or operator</span>${assigned.map(s=>`<div class="cov" style="grid-template-columns:minmax(0,1fr) 110px 44px;cursor:pointer" data-org="${s.id}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px">${esc(s.org.name)}</span>${meter(s.coverage,s.target,s.target*M.pf,true)}<span class="mono">${pct(s.coverage)}</span></div>`).join("")}</div></section>`:"";
  let extra="";
  if(t.role==="sergeant"||t.role==="captain"||t.role==="lieutenant"){
    const fm=Object.entries(S.team).filter(([,x])=>isField(x)&&(t.role==="captain"||t.role==="lieutenant"||divOf(x)===divOf(t))); const lastMo=Object.values(S.er).map(d=>d.month).sort().pop()||month;
    const rows=fm.map(([mid])=>{ const ps=personStats(mid,lastMo); const file=S.er[`${lastMo}__${mid}`]; return `<tr class="click" data-person="${esc(mid)}"><td style="white-space:nowrap">${avatar(mid,24)} ${esc(memberName(mid))}</td><td class="r mono">${file?file.rows.length:'<span class="pill s-due">no file</span>'}</td><td class="r mono">${ps.fail}</td><td class="r mono">${actRows(lastMo,divOf(S.team[mid]),mid).length}</td><td class="r mono">${ps.mins?fmtH(ps.mins):"–"}</td></tr>`; }).join("");
    extra=`<section class="panel"><div class="ph"><h3>${t.role==="sergeant"?"Monthly import status":"Team at a glance"}</h3><span class="faint">${MON3[+lastMo.slice(5)-1]} ${lastMo.slice(0,4)}</span><span class="sp"></span>${t.role==="sergeant"&&self?`<button class="btn sm primary" data-act="er-import" type="button">Import Emergency Reporting</button>`:`<a class="btn sm" href="#stats">Monthly stats</a>`}</div><div class="tablewrap"><table class="t"><thead><tr><th>Member</th><th class="r">ER inspections</th><th class="r">Hazards</th><th class="r">Action codes</th><th class="r">On site</th></tr></thead><tbody>${rows}</tbody></table></div></section>`; }
  const body=isField(t)?`<div class="pcols"><div class="pmain">${extra}${inspPanel}</div><div class="pside">${calPanel(M,id)}${asg}</div></div>`:`<div class="pcols"><div class="pmain">${extra}</div><div class="pside"><section class="panel"><div class="pb" style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Shortcuts</span><a class="btn" href="#stats">Monthly stats</a><a class="btn" href="#insights">Insights</a><a class="btn" href="#map">Map</a><a class="btn" href="#team">Team</a></div></section></div></div>`;
  return `${head}<div class="sechead" style="align-items:center"><span class="eyebrow">Month</span>${msel}</div>${isField(t)?tiles:""}${body}`;
}
function openPersonEdit(id){ const t=S.team[id]; const cap=amCaptain(); const pf=t.profile||{};
  openModal(`<div class="mh"><h2>Edit profile</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb"><div class="formgrid">
    <div class="field"><label for="pe-name">Full name</label><input type="text" id="pe-name" value="${esc(t.name)}" ${cap?"":"disabled"}></div>
    <div class="field"><label for="pe-pref">Goes by</label><input type="text" id="pe-pref" value="${esc(t.preferred||"")}" placeholder="${esc(t.name.split(" ")[0])}"></div>
    <div class="field"><label for="pe-unit">Unit number</label><input type="text" id="pe-unit" value="${esc(t.unit||"")}" placeholder="95P00"></div>
    <div class="field"><label for="pe-role">Role</label><select id="pe-role" ${cap?"":"disabled"}>${Object.entries(ROLES).map(([k,r])=>`<option value="${k}" ${(t.role||"inspector")===k?"selected":""}>${r.label}</option>`).join("")}</select></div>
    <div class="field" style="grid-column:1/-1"><label for="pe-tag">Tagline</label><input type="text" id="pe-tag" maxlength="120" value="${esc(pf.tagline||"")}" placeholder="One line about you or your focus"></div>
    ${cap?`<label class="pintoggle" style="grid-column:1/-1"><input type="checkbox" id="pe-field" ${t.field!==false?"checked":""}> Field member (counts in team productivity)</label>`:""}
  </div>${cap&&t.userId?`<div class="notice" style="margin-top:12px">Linked to the Claude account ${esc(t.accountName||t.userId)}. <button class="btn sm" data-act="unclaim" data-team="${esc(id)}" type="button">Unlink</button></div>`:""}</div>
  <div class="mf"><button class="btn" data-close="1" type="button">Cancel</button><button class="btn primary" data-act="person-save" data-team="${esc(id)}" type="button">Save</button></div>`); }
async function savePerson(id){ const cap=amCaptain(); const patch={preferred:$("#pe-pref").value.trim()||null,unit:$("#pe-unit").value.trim()||null,profile:{tagline:$("#pe-tag").value.trim()||null}};
  if(cap){ patch.name=$("#pe-name").value.trim()||S.team[id].name; patch.role=$("#pe-role").value; patch.field=$("#pe-field").checked; }
  if(await write(()=>S.db.doc("team/"+id).update(Object.assign(patch,{updatedAt:new Date().toISOString()})),"Profile saved")) closeModal(); }

document.addEventListener("click", async e=>{ const t=e.target;
  if(t.closest("#mechip")){ if(myTeamMember()) location.hash="me"; else openClaim(); return; }
  const pr=t.closest("[data-person]"); if(pr&&!t.closest("[data-act]")){ location.hash="person-"+pr.dataset.person; return; }
  const a=t.closest("[data-act]"); if(!a) return;
  switch(a.dataset.act){
    case "claim-open": openClaim(); return;
    case "claim": await claimProfile(a.dataset.team); return;
    case "unclaim": { if(a.dataset.confirm!=="1"){ a.dataset.confirm="1"; a.textContent="Confirm"; return; } if(await write(()=>S.db.doc("team/"+a.dataset.team).update({userId:null,accountName:null}),"Unlinked")){ closeModal(); } return; }
    case "person-edit": openPersonEdit(a.dataset.team); return;
    case "person-save": await savePerson(a.dataset.team); return;
    case "log-add": a.disabled=true; await addLogEntry(a.dataset.team); a.disabled=false; return;
    case "log-void": await write(()=>S.db.doc("log/"+a.dataset.doc).update({entries:{[a.dataset.eid]:{voided:true,voidedBy:S.me.id||null}}}),"Removed"); return;
  } });
document.addEventListener("change", e=>{ if(e.target.id==="pp-month"){ S.ui.pp.month=e.target.value; render(); } });

/* district assignments: one table to swap who covers what. History of each change is kept on the district; past inspections keep their own inspector. */
S.ui.asg={type:"all"};
function assignPanel(M){ const st=S.ui.asg; const field=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)==="education").sort((a,b)=>a[1].name.localeCompare(b[1].name));
  const all=Object.values(M.orgStats).filter(s=>s.active>0);
  const rows=all.filter(s=>st.type==="all"||(st.type==="none"?!s.org.assignedTo:s.org.type===st.type)).sort((a,b)=>["ISD","Charter","Private","Daycare"].indexOf(a.org.type)-["ISD","Charter","Private","Daycare"].indexOf(b.org.type)||a.org.name.localeCompare(b.org.name));
  const load=field.map(([id])=>{ const os=all.filter(s=>s.org.assignedTo===id); return `<span class="asgload">${avatar(id,22)} ${esc(memberName(id))} <b>${os.length}</b> <span class="faint">· ${os.reduce((n,s)=>n+s.active,0)} facilities</span></span>`; }).join("");
  const none=all.filter(s=>!s.org.assignedTo);
  const last=o=>{ const h=Object.entries(o.assignLog||{}).sort().pop(); return h?`${fmtDate(h[0].slice(0,10))}${h[1].from?` · was ${esc(memberName(h[1].from))}`:""}`:""; };
  return `<section class="panel" id="assignments"><div class="ph"><h3>District assignments</h3><span class="faint">${all.length} districts and operators · ${none.length} unassigned</span><span class="sp"></span>
    <div class="chips">${[["all","All"],["ISD","ISDs"],["Charter","Charters"],["Private","Privates"],["Daycare","Daycares"],["none","Unassigned"]].map(([k,l])=>`<button class="chip" type="button" data-asgtype="${k}" aria-pressed="${st.type===k}">${l}</button>`).join("")}</div></div>
    <div class="pb asgloadrow">${load}</div>
    <div class="tablewrap" style="max-height:560px"><table class="t"><thead><tr><th>District / operator</th><th>Type</th><th class="r">Active</th><th>Coverage ${M.Y}</th><th>Assigned inspector</th><th class="hide-sm">Last change</th></tr></thead><tbody>
    ${rows.map(s=>`<tr><td><a href="#org-${esc(s.id)}">${esc(s.org.name)}</a></td><td><span class="tag">${TYPE_SHORT[s.org.type]}</span></td><td class="r mono">${s.active}</td><td><div style="display:flex;gap:8px;align-items:center">${meter(s.coverage,s.target,s.target*M.pf,true)}<span class="mono">${pct(s.coverage)}</span></div></td>
      <td><select data-assign="${esc(s.id)}" ${S.canWrite?"":"disabled"} aria-label="Inspector for ${esc(s.org.name)}"><option value="">Unassigned</option>${field.map(([id])=>`<option value="${id}" ${s.org.assignedTo===id?"selected":""}>${esc(memberName(id))}</option>`).join("")}${s.org.assignedTo&&!field.some(([id])=>id===s.org.assignedTo)?`<option value="${esc(s.org.assignedTo)}" selected>${esc(teamName(s.org.assignedTo))}</option>`:""}</select></td>
      <td class="hide-sm faint" style="font-size:12px">${last(s.org)}</td></tr>`).join("")}</tbody></table></div>
    <p class="method" style="padding:0 16px 14px">Changing an assignment only changes who covers the district from now on. Inspections already on file stay credited to whoever did them, and every change is kept in the district's history.</p></section>`; }
document.addEventListener("click", e=>{ const b=e.target.closest("[data-asgtype]"); if(b){ S.ui.asg.type=b.dataset.asgtype; const y=window.scrollY; render(); window.scrollTo(0,y); } });
document.addEventListener("change", async e=>{ const t=e.target; if(!t.dataset.assign) return; const oid=t.dataset.assign, o=S.orgs[oid]; const to=t.value||null, from=o.assignedTo||null; if(to===from) return;
  const ts=new Date().toISOString(); const y=window.scrollY;
  await write(()=>patchOrg(oid,{assignedTo:to,assignLog:{[ts]:{from,to,by:S.me.id||null}}}),`${o.name}: ${to?memberName(to):"unassigned"}${from?` (was ${memberName(from)})`:""}`); window.scrollTo(0,y); });
document.addEventListener("click", e=>{ const b=e.target.closest("[data-teamdiv]"); if(b){ S.ui.teamDiv=b.dataset.teamdiv; render(); } });
