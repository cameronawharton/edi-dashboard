/* ------------------------------------------------------------------ map */
let MAPSTATE=null;
const SHORT=oid=>(S.orgs[oid]?.name||oid).replace(/ C?ISD$/,"");
function fullExtent(){ return GEO.bbox.slice(); }
function fitOrg(oid){ const L=GEO.labels[oid]; if(!L) return fullExtent(); const [x,y,w,h]=L.bbox; const p=Math.max(w,h)*.14; return [x-p,y-p,w+2*p,h+2*p]; }
const clamp01=x=>Math.max(0,Math.min(1,x));
function rampFill(s){ if(!s||!s.active) return "var(--land)"; return `color-mix(in oklab, var(--ramp1) ${Math.round(clamp01(s.coverage/s.target)*100)}%, var(--ramp0))`; }
function covColor(cov,tgt,pace){ return cov+1e-9>=tgt?"var(--ok)":(cov>=pace-0.05?"var(--due)":"var(--bad)"); }
function ringSVG(size,cov,tgt,color,sub){
  const sw=Math.max(6,size*.085), r=size/2-sw/2-1, c=2*Math.PI*r, cx=size/2;
  let tk=""; if(tgt>0&&tgt<1){ const a=-Math.PI/2+tgt*2*Math.PI, r1=r-sw*.9, r2=r+sw*.9; tk=`<line class="tk" x1="${(cx+r1*Math.cos(a)).toFixed(1)}" y1="${(cx+r1*Math.sin(a)).toFixed(1)}" x2="${(cx+r2*Math.cos(a)).toFixed(1)}" y2="${(cx+r2*Math.sin(a)).toFixed(1)}"/>`; }
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" data-to="${cov}" data-c="${c.toFixed(2)}" role="img" aria-label="${pct(cov)} inspected, target ${pct(tgt)}">
    <circle class="bg" cx="${cx}" cy="${cx}" r="${r.toFixed(1)}" style="stroke-width:${sw}"/>
    <circle class="fg" cx="${cx}" cy="${cx}" r="${r.toFixed(1)}" stroke="${color}" style="stroke-width:${sw}" stroke-dasharray="0 ${c.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>${tk}
    <text x="${cx}" y="${sub?cx-size*.06:cx}" font-size="${(size*.27).toFixed(1)}">0%</text>${sub?`<text x="${cx}" y="${cx+size*.17}" font-size="${(size*.1).toFixed(1)}" style="font-family:var(--f-body);font-weight:500;fill:var(--ink3)">${esc(sub)}</text>`:""}</svg>`; }
function animateRings(root){
  if(!root) return; const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("svg.ring[data-to]").forEach(svg=>{
    const to=+svg.dataset.to, c=+svg.dataset.c, fg=svg.querySelector(".fg"), tx=svg.querySelector("text"); const t0=performance.now(), dur=reduce?0:850;
    const step=t=>{ const k=dur?Math.min(1,(t-t0)/dur):1, e=1-Math.pow(1-k,3), v=to*e; fg.setAttribute("stroke-dasharray",`${(Math.min(1,v)*c).toFixed(2)} ${c}`); tx.textContent=Math.round(v*100)+"%"; if(k<1) requestAnimationFrame(step); };
    requestAnimationFrame(step); svg.removeAttribute("data-to"); });
}
function progAll(M){ const p=M.prog.ISD; return Object.assign({},p,{pace:p.target*M.pf}); }

function vMap(M){
  const mp=S.ui.map; mp.sel=mp.sel && S.orgs[mp.sel] && GEO.isd[mp.sel] ? mp.sel : null;
  if(!mp.vb) mp.vb=mp.sel?fitOrg(mp.sel):fullExtent();
  const lay=mp.layers, t=settings().targets.ISD;
  return `<div class="mapgrid"><div class="mapbox" id="mapbox">
    <svg id="mapsvg" viewBox="${mp.vb.join(" ")}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Harris County school districts"></svg>
    <div class="maptools"><div class="maplayers"><span class="eyebrow">Show on map</span>
      ${[["isd","Campus pins in an open district"],["sites","Charter, private & daycare sites"],["roads","Highways"],["closed","Closed or excluded campuses"]].map(([k,l])=>`<label><input type="checkbox" data-layer="${k}" ${lay[k]?"checked":""}> ${l}</label>`).join("")}</div></div>
    <div class="mapctl"><button class="btn" data-zoom="1.6" aria-label="Zoom in" type="button">+</button><button class="btn" data-zoom="0.625" aria-label="Zoom out" type="button">−</button><button class="btn" data-act="map-reset" aria-label="Show the whole county" title="Whole county" type="button">⤢</button></div>
    <div class="legend"><span class="eyebrow">ISD coverage toward the ${pct(t)} target</span><div class="ramp"></div><div class="scale"><span>0%</span><span>${pct(t/2)}</span><span>${pct(t)}+</span></div>
      <div class="row"><span><i class="dot" style="background:var(--bad)"></i>Behind pace</span><span><i class="hatchkey"></i>Not tracked by this division</span></div>
      ${mp.sel||lay.sites?`<div class="row"><span><i class="dot" style="background:var(--ok)"></i>Inspected</span><span><i class="dot" style="background:var(--due)"></i>Due</span><span><i class="dot" style="background:var(--bad)"></i>Failed</span><span><i class="dot" style="background:var(--off)"></i>Off-cycle</span>${lay.sites?`<span><i class="sqd" style="background:var(--ink2)"></i>Charter / private / daycare</span>`:""}</div>`:""}</div>
    ${mp.placing?`<div class="placing-banner">Click where <b>${esc(M.byId[mp.placing]?.name||"")}</b> sits <button class="btn sm" data-act="cancel-place" type="button">Cancel</button></div>`:""}
    <div class="hovercard" id="hovercard" aria-hidden="true"></div><div class="tooltip" id="maptip" hidden></div>
  </div><aside class="side" id="mapside">${mapSide(M,mp.sel)}</aside></div>`;
}

function orgIssues(M,s){
  const o=s.org, oid=s.id, out=[]; const fs=M.facs.filter(f=>f.orgId===oid);
  const failed=fs.filter(f=>f.state==="failed");
  if(failed.length) out.push(["var(--bad)",`${failed.length} failed, awaiting re-inspection`,failed.map(f=>esc(f.name)).join(", ")]);
  const b=yearBounds(M.Y); const wk=Math.max(1,(Date.parse(b.workEnd)-Date.parse(todayISO()))/(7*864e5));
  if(s.need>0){ const per=s.need/wk; out.push([s.behind?"var(--bad)":"var(--due)", s.behind?`Behind pace: ${pct(s.coverage)} done, ${pct(s.expected)} expected by today`:`${s.need} more inspection${s.need>1?"s":""} to reach ${pct(s.target)}`, `About ${per<1?per.toFixed(1):Math.ceil(per)} per week through ${fmtDate(b.workEnd)} keeps the district on target.`]); }
  if(s.unassigned) out.push(["var(--un)",`${s.unassigned} campus${s.unassigned>1?"es have":" has"} no rotation letter`,"Use Balance rotation on the district page to assign them."]);
  const noPin=fs.filter(f=>f.state!=="excluded"&&f.lat==null); if(noPin.length) out.push(["var(--off)",`${noPin.length} campus${noPin.length>1?"es are":" is"} not on the map`,noPin.slice(0,4).map(f=>esc(f.name)).join(", ")+(noPin.length>4?"…":"")]);
  if(!(o.contacts||[]).length) out.push(["var(--off)","No district contacts on file","Add the superintendent, CSSS member and point of contact on the district page."]);
  if(!o.assignedTo) out.push(["var(--off)","No inspector assigned","Pick an inspector under Edit district."]);
  return out;
}
function mapSide(M,sel){
  const mp=S.ui.map;
  if(!sel){
    const P=progAll(M); const rows=Object.values(M.orgStats).filter(s=>GEO.isd[s.id]).sort((a,b)=>a.coverage/a.target-b.coverage/b.target||a.org.name.localeCompare(b.org.name));
    const other=["Charter","Private","Daycare"].map(t=>{const p=M.prog[t]; return `<div class="cov" style="grid-template-columns:minmax(0,1fr) 110px 44px;font-size:12.5px"><span>${TYPE_LABEL[t]} <span class="faint">${p.visited}/${p.active}</span></span>${meter(p.coverage,p.target,p.target*M.pf,true)}<span class="mono">${pct(p.coverage)}</span></div>`;}).join("");
    return `<div class="bhead"><span class="eyebrow">${M.Y} season · Rotation ${M.L}</span><h2>Harris County ISDs</h2>
      <div class="hero">${ringSVG(104,P.coverage,P.target,covColor(P.coverage,P.target,P.pace),"of campuses")}<div class="facts">
        <div><b>${P.visited}</b><span>inspected</span></div><div><b>${P.active}</b><span>active campuses</span></div>
        <div><b>${P.met}<span class="faint" style="font-size:15px">/${P.orgs}</span></b><span>districts at ${pct(P.target)}</span></div><div><b>${P.need}</b><span>still needed</span></div></div></div>
      <span class="muted" style="font-size:12.5px">Hover a district to see where it stands. Click one to open its briefing.</span></div>
    <div class="scroll"><div class="bsec" style="padding-bottom:4px"><h3>Furthest from target first</h3></div><div class="rank">
      ${rows.map((s,i)=>`<div class="r" data-mapsel="${s.id}" data-hover-isd="${s.id}"><span class="i">${String(i+1).padStart(2,"0")}</span><span class="nm">${esc(s.org.name)}${s.behind?' <i class="dot" style="background:var(--bad);width:7px;height:7px;vertical-align:middle" title="Behind pace"></i>':""}</span>${meter(s.coverage,s.target,s.target*M.pf,true)}<span class="mono">${pct(s.coverage)}</span></div>`).join("")}</div>
      <div class="bsec" style="border-top:1px solid var(--line)"><h3>100% annual programs</h3>${other}<a class="btn sm" href="#facilities" data-facstate="due-annual" style="align-self:flex-start">List what is still due</a></div></div>`;
  }
  const s=M.orgStats[sel], o=s.org, L=GEO.labels[sel]||{};
  const fs=M.facs.filter(f=>f.orgId===sel && (f.state!=="excluded"));
  const counts={}; ["done","failed","due","unassigned","off"].forEach(k=>counts[k]=fs.filter(f=>f.state===k).length);
  const tot=fs.length||1;
  const fl=mp.filter; const shown=fs.filter(f=>fl==="all"||(fl==="rotation"?(f.inRotation||f.visited):fl==="attention"?(f.state==="due"||f.state==="failed"||f.state==="unassigned"):fl==="done"?f.visited:true));
  const order=["failed","due","unassigned","done","off"]; const GL={failed:"Failed · re-inspect",due:"Due this year",unassigned:"No rotation letter",done:"Inspected this year",off:"Off-cycle"};
  const groups=order.map(k=>{ const list=shown.filter(f=>f.state===k).sort((a,b)=>a.name.localeCompare(b.name)); if(!list.length) return "";
    return `<div class="fgroup"><div class="gh"><i class="dot" style="background:${STATE_FILL[k]}"></i>${GL[k]} <span class="faint">${list.length}</span></div>
      ${list.map(f=>`<div class="frow ${mp.hot===f.id?"hot":""}" data-mapfac="${esc(f.id)}"><span class="grow">${esc(f.name)}</span><span class="when">${f.lastY?fmtDate(f.lastY.date):(f.lastAny?fmtDate(f.lastAny.date):"")}</span><button class="copy" data-act="open-fac" data-fac="${esc(f.id)}" type="button" aria-label="Open ${esc(f.name)}">Open</button></div>`).join("")}</div>`; }).join("");
  const issues=orgIssues(M,s);
  const projects=Object.entries(S.projects).filter(([,p])=>p.org===sel && p.phase!=="Complete");
  const contacts=(o.contacts||[]);
  const exclusions=M.facs.filter(f=>f.orgId===sel&&f.state==="excluded");
  return `<div class="bhead"><div class="top"><button class="btn sm ghost" data-act="map-reset" type="button">← County</button><span class="sp" style="flex:1"></span><a class="btn sm" href="#org-${sel}">District page</a>${S.canWrite?`<button class="btn sm primary" data-act="log" type="button">Log inspection</button>`:""}</div>
    <div><span class="eyebrow">${M.Y} · Rotation ${M.L} · ${esc(teamName(o.assignedTo))}</span><h2>${esc(o.name)}</h2></div>
    <div class="hero">${ringSVG(108,s.coverage,s.target,covColor(s.coverage,s.target,s.expected),"inspected")}<div class="facts">
      <div><b>${s.visited}<span class="faint" style="font-size:15px">/${s.active}</span></b><span>campuses</span></div>
      <div><b>${s.need}</b><span>to ${pct(s.target)}</span></div><div><b style="color:${s.failed?"var(--bad)":"inherit"}">${s.failed}</b><span>failed</span></div></div></div></div>
  <div class="scroll">
    <div class="bsec"><h3>Key issues <span class="mono">${issues.length}</span></h3>${issues.length?issues.map(([c,t,d])=>`<div class="issue"><span class="bar" style="background:${c}"></span><div><b>${t}</b><div class="muted" style="font-size:12.5px">${d}</div></div></div>`).join(""):`<span class="muted">No open issues. This district is on track.</span>`}</div>
    <div class="bsec"><h3>Inspection status</h3>
      <div class="stack" role="img" aria-label="Campus status breakdown">${order.map(k=>counts[k]?`<i style="width:${counts[k]/tot*100}%;background:${STATE_FILL[k]}" title="${GL[k]}: ${counts[k]}"></i>`:"").join("")}</div>
      <div class="stackkey">${order.filter(k=>counts[k]).map(k=>`<span><i class="dot" style="background:${STATE_FILL[k]}"></i>${counts[k]} ${GL[k].split(" ·")[0].toLowerCase()}</span>`).join("")}${exclusions.length?`<span class="faint">${exclusions.length} closed or excluded</span>`:""}</div>
      <div class="chips">${[["rotation","This season"],["attention","Needs attention"],["done","Inspected"],["all","All"]].map(([k,l])=>`<button class="chip" data-mapfilter="${k}" aria-pressed="${fl===k}" type="button">${l}</button>`).join("")}</div>
      ${groups||`<span class="muted">Nothing in this filter.</span>`}</div>
    <div class="bsec"><h3>Key contacts</h3>${contacts.length?contacts.map(c=>`<div class="ccard"><span class="role">${esc(c.role||"Contact")}</span><span class="nm">${esc(c.name||"")}</span><span></span>
      ${c.phone?`<span class="ln"><span class="mono">${esc(c.phone)}</span><button class="copy" data-act="copy" data-text="${esc(c.phone)}" type="button">Copy</button></span>`:""}
      ${c.email?`<span class="ln"><span class="mono">${esc(c.email)}</span><button class="copy" data-act="copy" data-text="${esc(c.email)}" type="button">Copy</button></span>`:""}</div>`).join(""):`<span class="muted">None on file.</span>`}</div>
    ${projects.length?`<div class="bsec"><h3>Active projects</h3>${projects.map(([id,p])=>`<div class="frow" data-project="${esc(id)}"><span class="tag">${esc(p.phase)}</span><span class="grow">${esc(p.name)}</span><span class="when">${p.target?fmtDate(p.target):""}</span></div>`).join("")}</div>`:""}
    <div class="bsec"><h3>About this district</h3><span class="muted" style="font-size:12.5px">${L.areaKm2?`${L.areaKm2.toLocaleString()} km² inside Harris County`:""}${L.inCounty&&L.inCounty<0.98?`, about ${Math.round(L.inCounty*100)}% of the district. The dashed line shows the part beyond the county.`:"."}${o.notes?" "+esc(o.notes):""}</span></div>
  </div>`;
}

const STATE_FILL={done:"var(--ok)",failed:"var(--bad)",due:"var(--due)",off:"var(--off)",unassigned:"var(--un)",excluded:"var(--line)"};
function mountMap(M){
  const svg=$("#mapsvg"); if(!svg) return; const mp=S.ui.map, sel=mp.sel;
  let h=`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--land)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--hatch)" stroke-width="2"/></pattern>
    <filter id="liftShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow id="liftDS" dx="0" dy="3" stdDeviation="4" flood-color="#0b1520" flood-opacity=".32"/></filter></defs>`;
  h+=`<rect x="-3000" y="-3000" width="8000" height="8000" fill="var(--outside)"/>`;
  h+=Object.values(GEO.outside).map(d=>`<path class="g-outside" d="${d}"/>`).join("");
  h+=`<path class="g-county" d="${GEO.county}"/>`;
  h+=Object.values(GEO.ctx).map(d=>`<path class="g-ctx" d="${d}"/>`).join("");
  h+=`<g id="g-isd">`+Object.entries(GEO.isd).map(([oid,d])=>{ const s=M.orgStats[oid]; const isSel=sel===oid; const nm=S.orgs[oid]?.name||oid;
    return `<path class="isd ${sel&&!isSel?"dim":""} ${isSel?"sel":""}" d="${d}" data-isd="${oid}" tabindex="0" role="button" aria-label="${esc(nm)}: ${pct(s?s.coverage:0)} of campuses inspected" style="fill:${isSel?"var(--sel-fill)":rampFill(s)}"/>`; }).join("")+`</g>`;
  h+=GEO.water.map(d=>`<path class="g-water" d="${d}"/>`).join("");
  h+=`<g id="g-roads" ${mp.layers.roads?"":"hidden"}>${GEO.roads.map(r=>`<path class="g-road ${r.n==="BW 8"||r.n==="610"?"loop":""}" d="${r.d}"/>`).join("")}</g>`;
  h+=`<path class="g-countyline" d="${GEO.county}"/><g id="g-lift"></g><g id="pins"></g><g id="labels"></g>`;
  svg.innerHTML=h;
  MAPSTATE={M,hover:null}; rescale();
  let drag=null;
  svg.onpointerdown=e=>{ if(e.button!==0) return; drag={x:e.clientX,y:e.clientY,vb:mp.vb.slice(),moved:false}; };
  svg.onpointermove=e=>{
    if(drag){ const r=svg.getBoundingClientRect(); const sc=Math.max(mp.vb[2]/r.width,mp.vb[3]/r.height); const dx=(e.clientX-drag.x)*sc, dy=(e.clientY-drag.y)*sc;
      if(!drag.moved && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4){ drag.moved=true; svg.setPointerCapture(e.pointerId); svg.classList.add("drag"); liftDistrict(null); }
      if(drag.moved){ mp.vb=[drag.vb[0]-dx,drag.vb[1]-dy,drag.vb[2],drag.vb[3]]; svg.setAttribute("viewBox",mp.vb.join(" ")); return; } }
    hoverTip(e); const d=e.target.closest("[data-isd]"); liftDistrict(d?d.dataset.isd:null);
  };
  svg.onpointerleave=()=>{ if(!drag) liftDistrict(null); };
  svg.onpointerup=e=>{ svg.classList.remove("drag"); const d=drag; drag=null; if(d&&d.moved){ rescale(); return; } onMapClick(e); };
  svg.onwheel=e=>{ e.preventDefault(); zoomAt(e.deltaY<0?1.25:0.8,e.clientX,e.clientY); };
  svg.onkeydown=e=>{ const d=e.target.closest("[data-isd]"); if(d&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); selectMapOrg(d.dataset.isd); } };
  svg.onfocusin=e=>{ const d=e.target.closest("[data-isd]"); if(d) liftDistrict(d.dataset.isd); };
  svg.classList.toggle("placing",!!mp.placing);
  animateRings($("#mapside"));
}
function svgPoint(cx,cy){ const svg=$("#mapsvg"); const pt=svg.createSVGPoint(); pt.x=cx; pt.y=cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function screenPoint(x,y){ const svg=$("#mapsvg"); const pt=svg.createSVGPoint(); pt.x=x; pt.y=y; const p=pt.matrixTransform(svg.getScreenCTM()); const r=$("#mapbox").getBoundingClientRect(); return [p.x-r.left,p.y-r.top]; }
function pxScale(){ const svg=$("#mapsvg"); if(!svg) return 1; const r=svg.getBoundingClientRect(); const vb=S.ui.map.vb; return Math.max(vb[2]/(r.width||1), vb[3]/(r.height||1)); }
function rescale(){ const k=pxScale(); const pat=$("#hatch"); if(pat){ pat.setAttribute("width",7*k); pat.setAttribute("height",7*k); pat.querySelector("rect").setAttribute("width",7*k); pat.querySelector("rect").setAttribute("height",7*k); const ln=pat.querySelector("line"); ln.setAttribute("y2",7*k); ln.setAttribute("stroke-width",2.2*k); }
  const ds=$("#liftDS"); if(ds){ ds.setAttribute("dy",4*k); ds.setAttribute("stdDeviation",5*k); }
  drawPins(); drawLabels(); }
function zoomAt(f,cx,cy){ const mp=S.ui.map, svg=$("#mapsvg"); if(!svg) return; const r=svg.getBoundingClientRect(); if(cx==null){cx=r.left+r.width/2;cy=r.top+r.height/2;}
  const p=svgPoint(cx,cy); const w=Math.min(1600,Math.max(10,mp.vb[2]/f)), h=mp.vb[3]*(w/mp.vb[2]);
  mp.vb=[p.x-(p.x-mp.vb[0])*(w/mp.vb[2]), p.y-(p.y-mp.vb[1])*(h/mp.vb[3]), w, h]; svg.setAttribute("viewBox",mp.vb.join(" ")); liftDistrict(null); rescale(); }
function animateTo(vb){ const mp=S.ui.map, svg=$("#mapsvg"); if(!svg){mp.vb=vb;return;} const from=mp.vb.slice(), t0=performance.now(), dur=matchMedia("(prefers-reduced-motion: reduce)").matches?0:560;
  liftDistrict(null);
  const step=t=>{ const k=dur?Math.min(1,(t-t0)/dur):1, e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2; mp.vb=from.map((v,i)=>v+(vb[i]-v)*e); svg.setAttribute("viewBox",mp.vb.join(" ")); if(k<1) requestAnimationFrame(step); else rescale(); }; requestAnimationFrame(step); }
function liftDistrict(oid){
  if(!MAPSTATE) return; const g=$("#g-lift"), card=$("#hovercard"); if(!g) return;
  if(oid===S.ui.map.sel) oid=null;
  if(MAPSTATE.hover===oid) return; MAPSTATE.hover=oid;
  document.querySelectorAll(".rank .r.hot").forEach(x=>x.classList.remove("hot"));
  if(!oid){ g.innerHTML=""; card.classList.remove("on"); return; }
  const r=document.querySelector(`.rank .r[data-hover-isd="${oid}"]`); if(r) r.classList.add("hot");
  const M=MAPSTATE.M, s=M.orgStats[oid], k=pxScale(), d=GEO.isd[oid];
  g.innerHTML=`<g class="lift-wrap" style="transform:translate(0px,0px);transition:transform .2s ease-out"><path class="lift" d="${d}" style="fill:${rampFill(s)}"/><path class="lift-edge" d="${d}"/></g>`;
  requestAnimationFrame(()=>{ const w=g.querySelector(".lift-wrap"); if(w) w.style.transform=`translate(0px,${(-5*k).toFixed(2)}px)`; });
  const L=GEO.labels[oid]; if(!s||!L){ card.classList.remove("on"); return; }
  let [x,y]=screenPoint(L.x,L.bbox[1]); const box=$("#mapbox").getBoundingClientRect();
  x=Math.max(140,Math.min(box.width-140,x)); const below=y<190; if(below) [,y]=screenPoint(L.x,L.bbox[1]+L.bbox[3]);
  card.style.left=x+"px"; card.style.top=Math.max(8,Math.min(box.height-8,y))+"px"; card.style.transform=below?"translate(-50%,14px)":"translate(-50%,calc(-100% - 14px))";
  card.innerHTML=`${ringSVG(66,s.coverage,s.target,covColor(s.coverage,s.target,s.expected))}<div class="t">${esc(s.org.name)}</div>
    <div class="s">${s.visited} of ${s.active} campuses inspected</div><div class="s">Rotation ${M.L}: ${s.rotDone}/${s.rotTotal} · ${s.need?s.need+" more to "+pct(s.target):"target met"}${s.failed?` · <span style="color:var(--bad)">${s.failed} failed</span>`:""}</div>`;
  card.classList.add("on"); animateRings(card);
}
function visiblePins(M){ const mp=S.ui.map, lay=mp.layers;
  return M.facs.filter(f=>{ if(f.lat==null) return false; if(f.state==="excluded"&&!lay.closed) return false;
    if(f.type==="ISD"){ if(!lay.isd||!mp.sel||f.orgId!==mp.sel) return false; const fl=mp.filter;
      if(f.state==="excluded") return true; if(fl==="rotation"&&!(f.inRotation||f.visited)) return false; if(fl==="attention"&&!(f.state==="due"||f.state==="failed"||f.state==="unassigned")) return false; if(fl==="done"&&!f.visited) return false; return true; }
    if(f.type==="Daycare"&&mp.sel&&lay.isd&&f.parentOrg===mp.sel) return true;
    return !!lay.sites; }); }
function drawPins(){ if(!MAPSTATE) return; const M=MAPSTATE.M, g=$("#pins"); if(!g) return; const k=pxScale(), mp=S.ui.map, r=5*k;
  const pins=visiblePins(M).sort((a,b)=>(a.state==="failed")-(b.state==="failed")||(mp.hot===a.id)-(mp.hot===b.id));
  g.innerHTML=pins.map(f=>{ const [x,y]=proj(f.lng,f.lat), fill=STATE_FILL[f.state], hot=mp.hot===f.id?" hot":"", rr=hot?r*1.5:r;
    if(f.type==="ISD") return `<circle class="pin${hot}" data-mapfac="${esc(f.id)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rr.toFixed(2)}" fill="${fill}"/>`;
    const q=rr*1.05; return `<rect class="pin${hot}" data-mapfac="${esc(f.id)}" x="${(x-q).toFixed(2)}" y="${(y-q).toFixed(2)}" width="${(2*q).toFixed(2)}" height="${(2*q).toFixed(2)}" fill="${fill}" transform="rotate(45 ${x.toFixed(2)} ${y.toFixed(2)})"/>`; }).join(""); }
function drawLabels(){ const g=$("#labels"); if(!g||!MAPSTATE) return; const k=pxScale(), mp=S.ui.map, M=MAPSTATE.M; let h="";
  for(const [n,l] of Object.entries(GEO.labels)){ if(!n.startsWith("ctx:")) continue; if(l.areaKm2<40 && k>0.9) continue; h+=`<text class="ctxlab" x="${l.x}" y="${l.y}" font-size="${(10.5*k).toFixed(2)}">${esc(n.slice(4))} ISD</text>`; }
  for(const w of GEO.wlabels){ h+=`<text class="wlab" x="${w.x}" y="${w.y}" font-size="${(11*k).toFixed(2)}">${esc(w.n)}</text>`; }
  if(mp.layers.roads) for(const s of GEO.shields){ const txt=s.n==="Hardy"?"HARDY":s.n==="Westpark"?"WPT":s.n; const w=(txt.length*6.2+8)*k, hh=13*k;
    h+=`<g class="shield"><rect x="${(s.x-w/2).toFixed(2)}" y="${(s.y-hh/2).toFixed(2)}" width="${w.toFixed(2)}" height="${hh.toFixed(2)}" rx="${(3*k).toFixed(2)}"/><text x="${s.x}" y="${s.y}" font-size="${(10*k).toFixed(2)}">${esc(txt)}</text></g>`; }
  for(const [oid,l] of Object.entries(GEO.labels)){ if(oid.startsWith("ctx:")||!GEO.isd[oid]) continue; if(mp.sel===oid) continue; const s=M.orgStats[oid]; if(!s) continue;
    if(l.bbox[2]/k<54) continue;
    const nm=SHORT(oid).toUpperCase(), pc=pct(s.coverage), fs=11*k, w=Math.max(nm.length*6.6+10, 46)*k, hh=30*k, x=l.x-w/2, y=l.y-hh/2;
    h+=`<g class="chip ${mp.sel?"dim":""}"><rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${hh.toFixed(2)}" rx="${(5*k).toFixed(2)}"/>
      <text class="nm" x="${l.x}" y="${(l.y-2.5*k).toFixed(2)}" font-size="${fs.toFixed(2)}" text-anchor="middle">${esc(nm)}</text>
      <text class="pc" x="${l.x}" y="${(l.y+10*k).toFixed(2)}" font-size="${(10*k).toFixed(2)}" text-anchor="middle">${pc}</text>
      ${s.behind?`<circle class="flag" cx="${(x+w-5*k).toFixed(2)}" cy="${(y+5*k).toFixed(2)}" r="${(3.2*k).toFixed(2)}"/>`:""}</g>`; }
  g.innerHTML=h; }
function hoverTip(e){ const tip=$("#maptip"); if(!tip) return; const t=e.target.closest("[data-mapfac]"); if(!t||!MAPSTATE){ tip.hidden=true; return; } const f=MAPSTATE.M.byId[t.dataset.mapfac]; if(!f){tip.hidden=true;return;}
  const r=$("#mapbox").getBoundingClientRect(); tip.hidden=false; tip.style.left=(e.clientX-r.left)+"px"; tip.style.top=(e.clientY-r.top)+"px"; tip.textContent=`${f.name} · ${STATE_LABEL[f.state]}`; }
async function onMapClick(e){ const mp=S.ui.map;
  if(mp.placing){ const p=svgPoint(e.clientX,e.clientY); const [lng,lat]=unproj(p.x,p.y); const f=MAPSTATE.M.byId[mp.placing]; mp.placing=null;
    if(f) await write(()=>patchFacility(f.orgId,f.id,{lat:+lat.toFixed(5),lng:+lng.toFixed(5),geoSrc:"manual"}),`${f.name} placed on the map`); render(); return; }
  const pin=e.target.closest("[data-mapfac]"); if(pin){ openFacility(pin.dataset.mapfac); return; }
  const d=e.target.closest("[data-isd]"); if(d){ if(d.dataset.isd!==mp.sel) selectMapOrg(d.dataset.isd); return; } }
function selectMapOrg(oid){ const mp=S.ui.map; mp.sel=oid; mp.hot=null; if(!MAPSTATE) return; const M=MAPSTATE.M;
  $("#mapside").innerHTML=mapSide(M,oid); $("#mapside .scroll")&&($("#mapside .scroll").scrollTop=0);
  const legend=document.querySelector(".mapbox .legend"); if(legend){ const tmp=document.createElement("div"); tmp.innerHTML=vMap(M); legend.replaceWith(tmp.querySelector(".legend")); }
  mountMap(M); animateTo(oid?fitOrg(oid):fullExtent()); }
