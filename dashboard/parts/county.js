/* ------------------------------------------------------------------ County facilities (FSS): owner by section, inspection months, map, unassigned buildings
   cfac/<slug>: {name,address,city,zip,section,fss,sqft,bda,systems,brands,annualMonth,semiMonth,monthsReview,src:"fss"|"oce",oce:{program,region,pct,use,year},lat,lng}
   Ownership comes from the FSS building list (Nov 4 2026). A building on the OCE Facilities and Regions map that is not on that list has no owner and is listed under Needs attention. */
S.cfac=S.cfac||{};
const FSS_SECTIONS=[["east","East","kaley-bowdoin"],["downtown","Downtown","bryan-darjean"],["west","West","dillon-eldridge"],["south","South","jimmie-gabriel"]];
const MONTHS_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
S.ui.cty=S.ui.cty||{who:"all",q:"",sel:null,zoom:"county"};
/* a removed building (status "removed") stays on file with who, when and why, and can be restored; it drops out of counts, the map and Needs attention */
const cfacAll=()=>Object.entries(S.cfac).map(([id,f])=>Object.assign({id},f));
const cfacList=()=>cfacAll().filter(f=>f.status!=="removed");
const cfacRemoved=()=>cfacAll().filter(f=>f.status==="removed");
const cfacAddrKey=s=>{ const m=String(s||"").toUpperCase().replace(/[.,#]/g," ").match(/^\s*(\d+)\s+(?:(?:N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+)?([A-Z0-9]+)/); return m?m[1]+"|"+m[2]:""; };
/* inspections in ER at a building's address, by anyone on the county team */
function cfacInspections(){ if(cfacInspections._rev===S._rev) return cfacInspections._m; const m={};
  const idx={}; cfacList().forEach(f=>{ const k=cfacAddrKey(f.address); if(k) (idx[k]=idx[k]||[]).push(f.id); });
  Object.values(S.er).filter(d=>(d.division||"education")==="county").forEach(d=>d.rows.forEach(r=>{ const ids=idx[cfacAddrKey(r.addr)]; if(ids) ids.forEach(id=>(m[id]=m[id]||[]).push(Object.assign({member:d.inspector},r))); }));
  Object.values(m).forEach(a=>a.sort((x,y)=>y.date.localeCompare(x.date))); cfacInspections._rev=S._rev; cfacInspections._m=m; return m; }
const monthTag=(n,review)=>n?`<span class="${review?"mrev":""}" title="${review?"Needs review by the FSS team":""}">${MONTHS_FULL[n-1].slice(0,3)}</span>`:`<span class="faint">–</span>`;
/* FSS sections: no official boundaries exist, so each point of the county goes to the specialist who owns most of the 7 nearest buildings
   (closer buildings count more). Drawn as row runs on a 4-unit grid and clipped to the county line. Recomputed when owners change. */
function fssRegions(){ if(fssRegions._rev===S._rev) return fssRegions._r; const B=cfacList().filter(f=>f.fss&&f.lat!=null).map(f=>{ const [x,y]=proj(f.lng,f.lat); return {x,y,o:f.fss}; });
  const [bx,by,bw,bh]=GEO.bbox, g=4, runs={}, sums={}, K=7, nd=new Float64Array(K), no=new Array(K);
  for(let y=by;y<by+bh;y+=g){ let cur=null, x0=bx;
    const nx=Math.ceil(bw/g); for(let i=0;i<=nx;i++){ const x=bx+i*g; let o=null;
      if(i<nx){ const cx=x+g/2, cy=y+g/2; for(let i=0;i<K;i++){ nd[i]=1e18; no[i]=null; }
        for(const b of B){ const d=(b.x-cx)*(b.x-cx)+(b.y-cy)*(b.y-cy); if(d>=nd[K-1]) continue; let j=K-1; while(j>0&&nd[j-1]>d){ nd[j]=nd[j-1]; no[j]=no[j-1]; j--; } nd[j]=d; no[j]=b.o; }
        let best=0; const v={}; for(let i=0;i<K;i++){ const w=no[i]; v[w]=(v[w]||0)+1/(Math.sqrt(nd[i])+8); if(v[w]>best){ best=v[w]; o=w; } }
        const S2=sums[o]=sums[o]||{x:0,y:0,n:0,x0:1e9,y0:1e9,x1:-1e9,y1:-1e9}; S2.x+=cx; S2.y+=cy; S2.n++; S2.x0=Math.min(S2.x0,x); S2.y0=Math.min(S2.y0,y); S2.x1=Math.max(S2.x1,x+g); S2.y1=Math.max(S2.y1,y+g); }
      if(o!==cur){ if(cur) (runs[cur]=runs[cur]||[]).push(`M${x0} ${y}h${x-x0}v${g}h${x0-x}z`); cur=o; x0=x; } } }
  fssRegions._r={runs,sums}; fssRegions._rev=S._rev; return fssRegions._r; }
function countyAttention(){ const L=cfacList(); return {unassigned:L.filter(f=>!f.fss), review:L.filter(f=>f.fss&&f.monthsReview), nomap:L.filter(f=>f.lat==null), dueNow:L.filter(f=>{ const m=+todayISO().slice(5,7); return f.fss&&(f.annualMonth===m||f.semiMonth===m); })}; }

function vCounty(M){ const st=S.ui.cty, L=cfacList(); if(!L.length) return `<div class="skeleton"><h2>No county facilities loaded</h2></div>`;
  const insp=cfacInspections(), A=countyAttention(), mo=+todayISO().slice(5,7);
  const owners=[...FSS_SECTIONS.map(([sec,label,id])=>({key:id,label:`${label} · ${memberName(id)}`,id,list:L.filter(f=>f.fss===id)})),{key:"none",label:"No owner",id:null,list:A.unassigned}];
  const tiles=`<div class="ctytiles">${owners.map(o=>{ const rev=o.list.filter(f=>f.monthsReview).length, seen=o.list.filter(f=>insp[f.id]&&insp[f.id].some(r=>r.date.slice(0,4)===todayISO().slice(0,4))).length;
    return `<button class="ctytile ${st.who===o.key?"on":""} ${o.id?"":"warn"}" data-ctywho="${o.key}" type="button" style="--tc:${o.id?teamColor(o.id):"var(--un)"}">${o.id?avatar(o.id,30):`<span class="ctyq">?</span>`}<span class="nm">${esc(o.label)}</span><b class="num">${o.list.length}</b><small>${o.id?`${seen} inspected in ${todayISO().slice(0,4)}${rev?` · ${rev} months to review`:""}`:"on the OCE map, not on the FSS list"}</small></button>`; }).join("")}</div>`;
  const R=cfacRemoved();
  const shown=(st.who==="removed"?R:L).filter(f=>(st.who==="all"||st.who==="removed"||(st.who==="none"?!f.fss:f.fss===st.who))&&(!st.q||(f.name+" "+f.address+" "+(f.oce&&f.oce.other||"")).toLowerCase().includes(st.q.toLowerCase()))).sort((a,b)=>a.name.localeCompare(b.name));
  /* map: county outline, water, major roads, one pin per building colored by owner */
  const RG=fssRegions(), bb=GEO.bbox, [dx,dy]=proj(-95.3585,29.7585), zs=RG.sums[st.zoom];
  let vb=st.zoom==="downtown"?[dx-8,dy-5.5,16,11]:zs?[zs.x0-15,zs.y0-15,zs.x1-zs.x0+30,zs.y1-zs.y0+30]:bb;
  { const ar=bb[2]/bb[3]; if(vb[2]/vb[3]<ar){ const w=vb[3]*ar; vb=[vb[0]-(w-vb[2])/2,vb[1],w,vb[3]]; } else { const h=vb[2]/ar; vb=[vb[0],vb[1]-(h-vb[3])/2,vb[2],h]; } }
  const k=vb[2]/bb[2];
  const pins=L.filter(f=>f.lat!=null).map(f=>{ const [x,y]=proj(f.lng,f.lat); const dim=st.who!=="all"&&!(st.who==="none"?!f.fss:f.fss===st.who);
    return `<g class="cpin ${f.fss?"":"none"} ${dim?"dim":""} ${st.sel===f.id?"sel":""}" data-cfac="${esc(f.id)}"><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${((f.fss?5:6)*Math.max(k,0.035)).toFixed(2)}" style="fill:${f.fss?teamColor(f.fss):"#fff"}"><title>${esc(f.name)} · ${esc(f.fss?memberName(f.fss):"No owner")}</title></circle></g>`; }).join("");
  const lbl=false?L.filter(f=>f.lat!=null).map(f=>{ const [x,y]=proj(f.lng,f.lat); return (x>vb[0]&&x<vb[0]+vb[2]&&y>vb[1]&&y<vb[1]+vb[3])?`<text class="clab" x="${x.toFixed(2)}" y="${(y-0.7).toFixed(2)}">${esc(f.name.length>26?f.name.slice(0,24)+"…":f.name)}</text>`:""; }).join(""):"";
  const regions=FSS_SECTIONS.map(([sec,label,id])=>RG.runs[id]?`<path class="freg" d="${RG.runs[id].join("")}" style="fill:${teamColor(id)}"/>`:"").join("");
  const fz=Math.max(k,0.06), ctxl=Object.entries(GEO.labels).filter(([n,l])=>n.startsWith("ctx:")&&(l.areaKm2>=40||k<0.5)).map(([n,l])=>`<text class="ctxlab" x="${l.x}" y="${l.y}" font-size="${(10.5*fz).toFixed(2)}">${esc(n.slice(4))}</text>`).join("");
  const wl=GEO.wlabels.map(w=>`<text class="wlab" x="${w.x}" y="${w.y}" font-size="${(11*fz).toFixed(2)}">${esc(w.n)}</text>`).join("");
  const sh=GEO.shields.map(s2=>{ const txt=s2.n==="Hardy"?"HARDY":s2.n==="Westpark"?"WPT":s2.n; const w=(txt.length*6.2+8)*fz, hh=13*fz; return `<g class="shield"><rect x="${(s2.x-w/2).toFixed(2)}" y="${(s2.y-hh/2).toFixed(2)}" width="${w.toFixed(2)}" height="${hh.toFixed(2)}" rx="${(3*fz).toFixed(2)}"/><text x="${s2.x}" y="${s2.y}" font-size="${(10*fz).toFixed(2)}">${esc(txt)}</text></g>`; }).join("");
  const secl=st.zoom==="downtown"?"":FSS_SECTIONS.map(([sec,label,id])=>{ const c=RG.sums[id]; if(!c) return ""; const n=L.filter(f=>f.fss===id).length; const x=c.x/c.n, y=c.y/c.n-(sec==="downtown"?26*fz:0);
    return `<g class="secl"><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${(15*fz).toFixed(2)}">${esc(label.toUpperCase())}</text><text x="${x.toFixed(1)}" y="${(y+15*fz).toFixed(1)}" font-size="${(11*fz).toFixed(2)}" class="sub">${esc(memberName(id))} · ${n}</text></g>`; }).join("");
  const map=`<div class="chips" style="margin-bottom:6px">${[["county","Whole county"],...FSS_SECTIONS.map(([sec,l,id])=>[id,l]),["downtown","Downtown close-up"]].map(([z,l])=>`<button class="chip" data-ctyzoom="${z}" aria-pressed="${st.zoom===z}" type="button">${l}</button>`).join("")}</div><svg class="ctymap" viewBox="${vb.map(v=>v.toFixed(2)).join(" ")}" role="img" aria-label="County facilities by FSS section"><defs><clipPath id="cty-clip"><path d="${GEO.county}"/></clipPath><pattern id="cty-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" stroke-width="1"/></pattern></defs>
    <rect x="${bb[0]-200}" y="${bb[1]-200}" width="${bb[2]+400}" height="${bb[3]+400}" class="cty-sea"/><path class="g-county" d="${GEO.county}"/><g clip-path="url(#cty-clip)">${regions}</g>
    ${GEO.water.map(d=>`<path class="g-water" d="${d}"/>`).join("")}${GEO.roads.map(r=>`<path class="g-road ${r.n==="BW 8"||r.n==="610"?"loop":""}" d="${r.d}"/>`).join("")}<path class="g-countyline" d="${GEO.county}"/>
    ${wl}${sh}${secl}${pins}${lbl}</svg>`;
  const legend=`<div class="ctylegend">${FSS_SECTIONS.map(([,label,id])=>`<span><i style="background:${teamColor(id)}"></i>${esc(label)} · ${esc(memberName(id,"first"))}</span>`).join("")}<span><i class="none"></i>No owner</span>${A.nomap.length?`<span class="faint">${A.nomap.length} not on the map (address not found)</span>`:""}</div>`;
  const rows=shown.map(f=>{ const last=(insp[f.id]||[])[0]; return `<tr class="click" data-cfac="${esc(f.id)}"><td><div style="font-weight:500">${esc(f.name)}</div><div class="faint" style="font-size:12px">${esc(f.address)}${f.city?", "+esc(f.city):""}${f.lat==null?' · <span style="color:var(--un)">not on map</span>':""}</div></td>
    <td style="white-space:nowrap">${f.fss?`${avatar(f.fss,20)} ${esc(memberName(f.fss,"first"))}`:`<span class="pill s-failed">No owner</span>`}</td>
    <td class="mono">${monthTag(f.annualMonth,f.monthsReview)}${f.annualMonth===mo||f.semiMonth===mo?` <span class="tag">this month</span>`:""}</td><td class="mono">${monthTag(f.semiMonth,f.monthsReview)}</td>
    <td class="hide-sm">${last?`${fmtDate(last.date)} <span class="faint">${esc(memberName(last.member,"first"))}</span>`:'<span class="faint">none on file</span>'}</td><td class="hide-sm faint" style="font-size:12px">${f.status==="removed"?`<span class="pill s-off">Removed</span> ${esc(f.removedReason||"")}<div>${f.removedBy?esc(memberName(f.removedBy,"first"))+" · ":""}${f.removedAt?fmtDate(f.removedAt.slice(0,10)):""}</div>`:esc((f.oce&&f.oce.use)||"")}</td></tr>`; }).join("");
  const att=[A.unassigned.length?["var(--bad)",`${A.unassigned.length} buildings on the OCE map have no FSS owner`,A.unassigned.slice(0,6).map(f=>esc(f.name)).join(", ")+(A.unassigned.length>6?` and ${A.unassigned.length-6} more`:""),"none"]:null,
    A.review.length?["var(--due)",`${A.review.length} buildings need their annual and semi-annual months reviewed`,FSS_SECTIONS.map(([,l,id])=>{ const n=A.review.filter(f=>f.fss===id).length; return n?`${esc(memberName(id,"first"))} ${n}`:""; }).filter(Boolean).join(" · "),null]:null,
    A.dueNow.length?["var(--accent)",`${A.dueNow.length} buildings scheduled this month`,"Annual or semi-annual month is "+MONTHS_FULL[mo-1],null]:null].filter(Boolean);
  return `<section class="sechead"><h2>County facilities</h2><span class="muted">${L.length} buildings · Fire Systems Specialists by section: East, Downtown, West, South. Owners come from the FSS building list; buildings only on the OCE Facilities and Regions map have no owner until one is set.</span></section>
  ${tiles}
  <div class="ctycols"><section class="panel"><div class="pb" style="padding:8px">${map}${legend}</div></section>
    <section class="panel"><div class="ph"><h3>Needs attention</h3></div><div class="pb attn">${att.length?att.map(([c,t,s,go])=>`<div class="ai" style="border-left-color:${c}"><div style="flex:1"><b>${t}</b><div class="faint" style="font-size:12.5px">${s}</div></div>${go?`<button class="btn sm" data-ctywho="${go}" type="button">Open</button>`:""}</div>`).join(""):'<p class="faint">Nothing waiting.</p>'}</div></section></div>
  <section class="panel"><div class="ph"><h3>${st.who==="all"?"All buildings":st.who==="none"?"No owner":st.who==="removed"?"Removed buildings":esc(memberName(st.who))}</h3><span class="faint">${shown.length}</span><span class="sp"></span>${R.length&&st.who!=="removed"?`<button class="btn sm ghost" data-ctywho="removed" type="button">Removed (${R.length})</button>`:""}<input type="search" id="cty-q" placeholder="Search name or address" value="${esc(st.q)}" style="width:220px">${st.who!=="all"?`<button class="btn sm ghost" data-ctywho="all" type="button">Show all</button>`:""}</div>
    <div class="tablewrap" style="max-height:560px"><table class="t"><thead><tr><th>Building</th><th>FSS</th><th>Annual</th><th>Semi-annual</th><th class="hide-sm">Last inspection</th><th class="hide-sm">Use</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="method" style="padding:0 16px 12px">Months marked in amber came from the FSS sheets for East, Downtown and South, where the semi-annual month repeated the annual month or sat two months after it. They stay as listed until the FSS sets them here. Last inspection matches Emergency Reporting inspections by street number and street name.</p></section>`; }

function openCfac(id){ const f=S.cfac[id]; if(!f) return; const insp=(cfacInspections()[id]||[]); const canEdit=S.canWrite&&(isSupervisor()||(myTeamMember()&&myTeamMember().id===f.fss));
  const sys=Object.entries(f.systems||{}).filter(([k,v])=>v!==false&&v!==0&&v!=="0").map(([k,v])=>`<span class="tag">${esc(k.replace(/([A-Z])/g," $1").toLowerCase())}${v===true?"":` ${esc(String(v))}`}</span>`).join(" ");
  const opt=(sel)=>`<option value="">Not set</option>`+MONTHS_FULL.map((m,i)=>`<option value="${i+1}" ${sel===i+1?"selected":""}>${m}</option>`).join("");
  openModal(`<div class="mh"><h2 class="cfh">${esc(f.name)}</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb" style="display:flex;flex-direction:column;gap:12px">
    <div class="rptgrid"><div><span class="eyebrow">Address</span><b>${esc(f.address)}</b><span class="faint">${esc(f.city||"")} ${esc(f.zip||"")}</span></div>
      <div><span class="eyebrow">FSS owner</span>${canEdit&&isSupervisor()?`<select id="cf-fss"><option value="">No owner</option>${FSS_SECTIONS.map(([,l,mid])=>`<option value="${mid}" ${f.fss===mid?"selected":""}>${esc(memberName(mid))} (${l})</option>`).join("")}</select>`:`<b>${f.fss?esc(memberName(f.fss)):"No owner"}</b>`}<span class="faint">${f.src==="oce"?"On the OCE map only":"From the FSS building list"}</span></div>
      <div><span class="eyebrow">Annual month</span>${canEdit?`<select id="cf-am">${opt(f.annualMonth)}</select>`:`<b>${f.annualMonth?MONTHS_FULL[f.annualMonth-1]:"Not set"}</b>`}</div>
      <div><span class="eyebrow">Semi-annual month</span>${canEdit?`<select id="cf-sm">${opt(f.semiMonth)}</select>`:`<b>${f.semiMonth?MONTHS_FULL[f.semiMonth-1]:"Not set"}</b>`}${f.monthsReview?`<span class="mrev" style="font-size:12px">Needs review</span>`:""}</div>
      ${f.oce?`<div><span class="eyebrow">OCE</span><b>${esc(f.oce.use||"")}</b><span class="faint">${f.oce.other?esc(f.oce.other)+" · ":""}Region ${esc(f.oce.region||"?")} · Pct ${esc(f.oce.pct||"?")}${f.oce.year?" · built "+esc(f.oce.year):""}</span></div>`:""}
      ${f.sqft?`<div><span class="eyebrow">Size</span><b class="mono">${Number(f.sqft).toLocaleString()} sq ft</b>${f.bda?`<span class="faint">BDA: ${esc(f.bda)}</span>`:""}</div>`:""}</div>
    ${sys?`<div><span class="eyebrow">Systems on file</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${sys}</div>${(f.brands||[]).length?`<div class="faint" style="font-size:12px;margin-top:4px">${f.brands.map(esc).join(" · ")}</div>`:""}</div>`:""}
    <div><span class="eyebrow">Inspections in Emergency Reporting (${insp.length})</span>${insp.length?`<div class="tablewrap"><table class="t"><tbody>${insp.slice(0,8).map(r=>`<tr><td class="mono">${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${esc(memberName(r.member,"first"))}</td><td>${erPill(r.res)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="faint" style="margin:4px 0 0">None loaded at this address yet.</p>`}</div></div>
    ${canEdit&&f.status!=="removed"?`<details class="cfrm"><summary>Remove this building</summary><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px"><input type="text" id="cf-why" placeholder="Why (sold, demolished, not county owned, duplicate)" style="flex:1;min-width:220px"><button class="btn danger" data-cfacrm="${esc(id)}" type="button">Remove</button></div><p class="faint" style="font-size:12px;margin:4px 0 0">It stays on file and can be restored. It leaves the counts, the map and Needs attention.</p></details>`:""}
    ${f.status==="removed"?`<div class="notice">Removed ${f.removedAt?fmtDate(f.removedAt.slice(0,10)):""}${f.removedBy?" by "+esc(memberName(f.removedBy)):""}${f.removedReason?": "+esc(f.removedReason):""}</div>`:""}</div>
    <div class="mf"><button class="btn" data-close="1" type="button">Close</button>${canEdit&&f.status==="removed"?`<button class="btn" data-cfacrestore="${esc(id)}" type="button">Restore</button>`:""}${canEdit&&f.status!=="removed"?`<button class="btn primary" data-cfacsave="${esc(id)}" type="button">Save</button>`:""}</div>`); }
document.addEventListener("click",async e=>{ const t=e.target;
  const z=t.closest("[data-ctyzoom]"); if(z){ S.ui.cty.zoom=z.dataset.ctyzoom; if(z.dataset.ctyzoom!=="county"&&z.dataset.ctyzoom!=="downtown") S.ui.cty.who=z.dataset.ctyzoom; else S.ui.cty.who="all"; render(); return; }
  const w=t.closest("[data-ctywho]"); if(w){ S.ui.cty.who=S.ui.cty.who===w.dataset.ctywho&&w.classList.contains("ctytile")?"all":w.dataset.ctywho; render(); return; }
  const c=t.closest("[data-cfac]"); if(c&&!t.closest(".modal")){ S.ui.cty.sel=c.dataset.cfac; openCfac(c.dataset.cfac); return; }
  const rm=t.closest("[data-cfacrm]"); if(rm){ const id=rm.dataset.cfacrm, why=($("#cf-why").value||"").trim(); if(!why){ flash("Say why the building is being removed."); return; }
    const ok=await write(()=>S.db.doc("cfac/"+id).update({status:"removed",removedReason:why,removedBy:(myTeamMember()||{}).id||null,removedAt:new Date().toISOString()}),`${S.cfac[id].name} removed`); if(ok) closeModal(); return; }
  const rs=t.closest("[data-cfacrestore]"); if(rs){ const id=rs.dataset.cfacrestore; const ok=await write(()=>S.db.doc("cfac/"+id).update({status:"active",restoredBy:(myTeamMember()||{}).id||null,restoredAt:new Date().toISOString()}),`${S.cfac[id].name} restored`); if(ok) closeModal(); return; }
  const sv=t.closest("[data-cfacsave]"); if(sv){ const id=sv.dataset.cfacsave, f=S.cfac[id]; const patch={};
    const am=$("#cf-am"), sm=$("#cf-sm"), fs=$("#cf-fss");
    if(am){ const a=+am.value||null, s=+sm.value||null; if(a!==f.annualMonth||s!==f.semiMonth){ patch.annualMonth=a; patch.semiMonth=s; patch.monthsReview=false; patch.monthsSetBy=(myTeamMember()||{}).id||null; patch.monthsSetAt=new Date().toISOString(); } }
    if(fs){ const v=fs.value||null; if(v!==f.fss){ patch.fss=v; patch.section=v?(FSS_SECTIONS.find(x=>x[2]===v)||[])[0]:null; patch.ownerLog={[new Date().toISOString()]:{from:f.fss||null,to:v,by:(myTeamMember()||{}).id||null}}; } }
    if(!Object.keys(patch).length){ closeModal(); return; }
    const ok=await write(()=>S.db.doc("cfac/"+id).update(patch),`${f.name} saved`); if(ok) closeModal(); return; }
});
document.addEventListener("input",e=>{ if(e.target.id==="cty-q"){ S.ui.cty.q=e.target.value; const pos=e.target.selectionStart; render(); const el=$("#cty-q"); if(el){ el.focus(); el.setSelectionRange(pos,pos); } } });
