/* ------------------------------------------------------------------ explorer (facilities) */
const EX_DEFAULT={q:"",types:[],orgs:[],rot:[],states:[],insp:[],pinned:false,group:"org",sort:"name",dq:""};
const ROT_OPTS=[["A","Rotation A"],["B","Rotation B"],["C","Rotation C"],["ABC","Every year"],["none","No letter"],["annual","Annual (non-ISD)"]];
const STATE_OPTS=[["failed","Failed · re-inspect"],["due","Due this year"],["done","Inspected"],["off","Off-cycle"],["unassigned","No rotation"],["excluded","Closed / excluded"]];
const rotKey=f=>f.type!=="ISD"?"annual":(f.rotation||"none");
const isPinned=f=>!!(S.pins.facs[f.id]||S.pins.orgs[f.orgId]||(f.parentOrg&&S.pins.orgs[f.parentOrg]));
function exMatch(f,X,skip){
  if(skip!=="states"){ if(X.states.length){ if(!X.states.includes(f.state)) return false; } else if(f.state==="excluded") return false; }
  else if(f.state==="excluded" && !X.states.includes("excluded")) { /* counting excluded facet */ }
  if(skip!=="types" && X.types.length && !X.types.includes(f.type)) return false;
  if(skip!=="orgs" && X.orgs.length && !X.orgs.includes(f.orgId) && !(f.parentOrg && X.orgs.includes(f.parentOrg))) return false;
  if(skip!=="rot" && X.rot.length && !X.rot.includes(rotKey(f))) return false;
  if(skip!=="insp" && X.insp.length && !X.insp.includes(f.org.assignedTo||"none")) return false;
  if(skip!=="pinned" && X.pinned && !isPinned(f)) return false;
  if(X.q){ const q=X.q.toLowerCase(); if(!(f.name+" "+f.org.name+" "+(f.address||"")).toLowerCase().includes(q)) return false; }
  return true;
}
function facetCounts(M,X,key,fn){ const c={}; for(const f of M.facs){ if(!exMatch(f,X,key)) continue; const k=fn(f); c[k]=(c[k]||0)+1; } return c; }
function vFacilities(M){
  const X=S.ui.ex;
  const rows=M.facs.filter(f=>exMatch(f,X));
  const cType=facetCounts(M,X,"types",f=>f.type), cRot=facetCounts(M,X,"rot",rotKey), cState=facetCounts(M,X,"states",f=>f.state), cInsp=facetCounts(M,X,"insp",f=>f.org.assignedTo||"none"), cOrg=facetCounts(M,X,"orgs",f=>f.orgId);
  const pinnedN=M.facs.filter(f=>exMatch(f,X,"pinned")&&isPinned(f)).length;
  const chip=(key,val,label,n)=>{ const on=X[key].includes(val); return `<button class="chip" data-exf="${key}" data-v="${esc(val)}" aria-pressed="${on}" type="button" ${!n&&!on?"disabled":""}>${label}<span class="n">${n||0}</span></button>`; };
  const dq=X.dq.toLowerCase();
  const orgList=Object.entries(S.orgs).filter(([id,o])=>o.type!=="Daycare"||true).map(([id,o])=>({id,o,n:cOrg[id]||0,on:X.orgs.includes(id)}))
    .filter(x=>(x.n||x.on||S.pins.orgs[x.id]) && (!dq||x.o.name.toLowerCase().includes(dq)))
    .sort((a,b)=>(b.on-a.on)||(!!S.pins.orgs[b.id]-!!S.pins.orgs[a.id])||(["ISD","Charter","Private","Daycare"].indexOf(a.o.type)-["ISD","Charter","Private","Daycare"].indexOf(b.o.type))||a.o.name.localeCompare(b.o.name));
  const inspIds=[...Object.keys(S.team),"none"].filter(id=>cInsp[id]||X.insp.includes(id));
  const active=[]; X.types.forEach(v=>active.push(["types",v,TYPE_SHORT[v]])); X.orgs.forEach(v=>active.push(["orgs",v,S.orgs[v]?.name||v])); X.rot.forEach(v=>active.push(["rot",v,(ROT_OPTS.find(r=>r[0]===v)||[,v])[1]])); X.states.forEach(v=>active.push(["states",v,STATE_LABEL[v]||"Closed / excluded"])); X.insp.forEach(v=>active.push(["insp",v,v==="none"?"No inspector":teamName(v)]));
  if(X.pinned) active.push(["pinned","1","Pinned only"]); if(X.q) active.push(["q","1",`“${X.q}”`]);
  // summary
  const act=rows.filter(f=>f.state!=="excluded"); const cnt=k=>act.filter(f=>f.state===k).length; const vis=act.filter(f=>f.visited).length;
  const orgsShown=new Set(rows.map(f=>f.orgId)).size;
  // grouping
  const sorters={name:(a,b)=>a.name.localeCompare(b.name), last:(a,b)=>(b.lastAny?.date||"").localeCompare(a.lastAny?.date||""), oldest:(a,b)=>(a.lastAny?.date||"0").localeCompare(b.lastAny?.date||"0"), state:(a,b)=>["failed","due","unassigned","done","off","excluded"].indexOf(a.state)-["failed","due","unassigned","done","off","excluded"].indexOf(b.state)||a.name.localeCompare(b.name)};
  rows.sort(sorters[X.sort]||sorters.name);
  const gkey={org:f=>f.orgId,rotation:rotKey,state:f=>f.state,none:()=>"all"}[X.group]||(f=>f.orgId);
  const glabel={org:k=>S.orgs[k]?.name||k,rotation:k=>(ROT_OPTS.find(r=>r[0]===k)||[,k])[1],state:k=>STATE_LABEL[k]||k,none:()=>"All results"}[X.group];
  const groups={}; rows.forEach(f=>{ const k=gkey(f); (groups[k]=groups[k]||[]).push(f); });
  const gorder=Object.keys(groups).sort((a,b)=> X.group==="state"? ["failed","due","unassigned","done","off","excluded"].indexOf(a)-["failed","due","unassigned","done","off","excluded"].indexOf(b) : X.group==="rotation"? ROT_OPTS.findIndex(r=>r[0]===a)-ROT_OPTS.findIndex(r=>r[0]===b) : String(glabel(a)).localeCompare(String(glabel(b))));
  const showOrgCol=X.group!=="org";
  const LIMIT=600; let shown=0;
  const body=gorder.map(k=>{ const list=groups[k]; const a=list.filter(f=>f.state!=="excluded"), v=a.filter(f=>f.visited).length;
    const o=X.group==="org"?S.orgs[k]:null; const st=o?M.orgStats[k]:null;
    const head=`<tr class="grp"><td colspan="${showOrgCol?8:7}"><div class="grph">${o?pinBtn("org",k):""}<b>${esc(glabel(k))}</b><span class="faint">${list.length} ${list.length===1?"facility":"facilities"}</span>${a.length?`<span class="gmeter">${meter(a.length?v/a.length:0, st?st.target:(X.group==="none"?0:0.3), 0, true)}</span><span class="mono">${v}/${a.length} · ${pct(v/a.length)}</span>`:""}${o?`<a class="btn sm ghost" href="#org-${k}">District page</a>`:""}</div></td></tr>`;
    const rs=list.map(f=>{ if(shown++>=LIMIT) return ""; return `<tr class="click" data-fac="${esc(f.id)}"><td class="pincell">${pinBtn("fac",f.id,f)}</td><td><div style="font-weight:500">${esc(f.name)}</div><div class="faint" style="font-size:12px">${esc(f.address||"")}</div></td>${showOrgCol?`<td class="muted">${esc(f.org.name)}</td>`:""}
      <td>${f.type==="ISD"?rotBadge(f.rotation,M.L):'<span class="faint" style="font-size:12px">annual</span>'}</td><td>${f.state==="excluded"?`<span class="pill s-excluded">${STATUS_LABEL[f.status]||"Excluded"}</span>`:statePill(f.state)}</td>
      <td class="hide-sm mono">${f.lastAny?fmtDate(f.lastAny.date)+` <span class="faint">${esc(f.lastAny.year)}</span>`:"<span class='faint'>never</span>"}</td><td class="hide-sm muted">${esc(teamName(f.org.assignedTo))}</td>
      <td class="r">${S.canWrite&&f.state!=="excluded"?`<button class="btn sm" data-act="log" data-fac="${esc(f.id)}" type="button">Log</button>`:""}</td></tr>`; }).join("");
    return head+rs; }).join("");
  const narrow=matchMedia("(max-width: 900px)").matches;
  return `<div class="explorer">
  <details class="exf" ${narrow?"":"open"}><summary><span class="eyebrow">Filters</span>${active.length?`<span class="tag">${active.length} on</span>`:""}</summary>
    <div class="exfb">
    <input type="search" id="exq" placeholder="Search schools, districts, addresses" value="${esc(X.q)}">
    <label class="pintoggle"><input type="checkbox" data-act="ex-pinned" ${X.pinned?"checked":""}> <span>★ Pinned only</span><span class="n mono">${pinnedN}</span></label>
    <div class="fset"><span class="eyebrow">Program</span><div class="chips">${["ISD","Charter","Private","Daycare"].map(t=>chip("types",t,TYPE_SHORT[t],cType[t])).join("")}</div></div>
    <div class="fset"><span class="eyebrow">Rotation</span><div class="chips">${ROT_OPTS.map(([v,l])=>chip("rot",v,l,cRot[v])).join("")}</div></div>
    <div class="fset"><span class="eyebrow">Status in ${M.Y}</span><div class="chips">${STATE_OPTS.map(([v,l])=>chip("states",v,l,cState[v])).join("")}</div></div>
    <div class="fset"><span class="eyebrow">Assigned inspector</span><div class="chips">${inspIds.map(id=>chip("insp",id,id==="none"?"None":esc(teamName(id).split(" ")[0]+" "+(teamName(id).split(" ")[1]||"")[0]+"."),cInsp[id])).join("")}</div></div>
    <div class="fset"><div class="sechead" style="gap:6px"><span class="eyebrow">Districts &amp; operators</span><span class="sp" style="flex:1"></span>${X.orgs.length?`<button class="copy" data-act="ex-orgs-none" type="button">Clear</button>`:""}</div>
      <input type="search" id="exdq" placeholder="Find a district" value="${esc(X.dq)}">
      <div class="olist">${orgList.map(x=>`<div class="orow ${x.on?"on":""}">${pinBtn("org",x.id)}<label><input type="checkbox" data-exorg="${x.id}" ${x.on?"checked":""}> <span class="nm">${esc(x.o.name)}</span></label><span class="tag">${TYPE_SHORT[x.o.type]}</span><span class="n mono">${x.n}</span></div>`).join("")||`<span class="faint" style="font-size:12px">No match</span>`}</div></div>
    ${active.length?`<button class="btn sm" data-act="ex-clear" type="button">Clear all filters</button>`:""}</div></details>
  <div class="exm">
    <section class="panel"><div class="pb exsum">
      <div class="exnums"><div><b class="num">${rows.length}</b><span>facilities</span></div><div><b class="num">${orgsShown}</b><span>districts / operators</span></div><div><b class="num">${pct(act.length?vis/act.length:0)}</b><span>inspected in ${M.Y}</span></div><div><b class="num" style="color:${cnt("failed")?"var(--bad)":"inherit"}">${cnt("failed")}</b><span>failed</span></div><div><b class="num">${cnt("due")}</b><span>due</span></div></div>
      <div class="stack" role="img" aria-label="Status breakdown">${["failed","due","unassigned","done","off"].map(k=>cnt(k)?`<i style="width:${cnt(k)/Math.max(1,act.length)*100}%;background:${STATE_FILL[k]}" title="${STATE_LABEL[k]}: ${cnt(k)}"></i>`:"").join("")}</div>
      ${active.length?`<div class="chips">${active.map(([k,v,l])=>`<button class="chip on-tag" data-exrm="${k}" data-v="${esc(v)}" type="button">${esc(l)} ✕</button>`).join("")}</div>`:`<span class="faint" style="font-size:12.5px">Showing every active facility. Narrow it with the filters.</span>`}
      <div class="exctl"><label>Group by <select id="exgroup">${[["org","District"],["rotation","Rotation"],["state","Status"],["none","No grouping"]].map(([v,l])=>`<option value="${v}" ${X.group===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <label>Sort <select id="exsort">${[["name","Name"],["state","Status"],["last","Most recent inspection"],["oldest","Longest since inspection"]].map(([v,l])=>`<option value="${v}" ${X.sort===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <span class="sp" style="flex:1"></span><button class="btn sm" data-act="ex-export" type="button" ${rows.length?"":"disabled"}>Export these ${rows.length} (.csv)</button></div></div></section>
    <section class="panel"><div class="tablewrap"><table class="t ext"><thead><tr><th></th><th>Facility</th>${showOrgCol?"<th>District / operator</th>":""}<th>Rot.</th><th>${M.Y}</th><th class="hide-sm">Last inspection</th><th class="hide-sm">Inspector</th><th></th></tr></thead><tbody>${body}</tbody></table>
      ${rows.length?"":`<div class="empty">Nothing matches these filters. <button class="btn sm" data-act="ex-clear" type="button">Clear filters</button></div>`}${rows.length>LIMIT?`<div class="empty">Showing ${LIMIT} of ${rows.length}. Narrow the filters to see the rest, or export them.</div>`:""}</div></section>
  </div></div>`;
}
function pinBtn(kind,id,f){ const on=kind==="org"?!!S.pins.orgs[id]:!!S.pins.facs[id]; const via=kind==="fac"&&!on&&f&&(S.pins.orgs[f.orgId]);
  return `<button class="pin-star ${on?"on":""} ${via?"via":""}" data-act="pin" data-kind="${kind}" data-id="${esc(id)}" type="button" aria-pressed="${on}" title="${on?"Unpin":"Pin"}${via?" (district is pinned)":""}" aria-label="${on?"Unpin":"Pin"}">${on||via?"★":"☆"}</button>`; }
function exSet(patch){ Object.assign(S.ui.ex,patch); persistUI(); render(); }
function exToggle(key,val){ const a=S.ui.ex[key]; const i=a.indexOf(val); if(i<0) a.push(val); else a.splice(i,1); persistUI(); render(); }
function exOpen(patch){ S.ui.ex=Object.assign(JSON.parse(JSON.stringify(EX_DEFAULT)),{group:S.ui.ex.group,sort:S.ui.ex.sort},patch); persistUI(); if(location.hash==="#facilities") render(); else location.hash="facilities"; }
async function togglePin(kind,id){
  const key=kind==="org"?"orgs":"facs"; const next={orgs:Object.assign({},S.pins.orgs),facs:Object.assign({},S.pins.facs)};
  if(next[key][id]) delete next[key][id]; else next[key][id]=1;
  S.pins=next; render();
  try{ localStorage.setItem("hcfmo-pins",JSON.stringify(next)); }catch(e){}
  if(S.db&&S.me.id){ try{ await S.db.doc(`data/users/${S.me.id}/prefs/pins`).set({orgs:Object.keys(next.orgs),facs:Object.keys(next.facs)}); }catch(e){ /* local copy kept */ } }
}
function exportExplorer(M){ const X=S.ui.ex; const rows=M.facs.filter(f=>exMatch(f,X));
  return saveFile(`explorer-${M.Y}-${rows.length}.csv`, csv([["Facility","District / operator","Type","Address","Rotation","Status "+M.Y,"Last inspection","Last result","COI #","Assigned inspector","Pinned"],
    ...rows.map(f=>[f.name,f.org.name,f.type,f.address,f.type==="ISD"?(f.rotation==="ABC"?"Every year":f.rotation||""):"Annual",f.state==="excluded"?(STATUS_LABEL[f.status]||"Excluded"):STATE_LABEL[f.state],f.lastAny?f.lastAny.date:"",f.lastAny?f.lastAny.result:"",f.lastAny?f.lastAny.coi:"",teamName(f.org.assignedTo),isPinned(f)?"yes":""])])); }
