/* ------------------------------------------------------------------ detail: school and district logos, street maps around schools */
/* Logos: facility.logo or the district's org.logo (paths to files published with the page, logos/<org>/<file>.png). */
function logoFor(f){ return (f && (f.logo || (f.org && f.org.logo))) || null; }
function logoImg(src,size,cls,alt){ return src?`<span class="logo ${cls||""}" style="--s:${size}px"><img src="${esc(src)}" alt="${esc(alt||"")}" loading="lazy" onerror="this.parentNode.remove()"></span>`:""; }

/* Streets: Census TIGER primary, secondary and local roads within about 0.9 km of each school, one file per district
   (streets/<org>.json), loaded only when a school or district from that district is opened. */
const STREETS={}; // org -> {schools:{fid:[[name,mtfcc,[dx,dy,...]],...]}} | null (none) | Promise
function loadStreets(oid){
  if(oid in STREETS) return STREETS[oid] instanceof Promise?STREETS[oid]:Promise.resolve(STREETS[oid]);
  STREETS[oid]=fetch(`streets/${oid}.json`).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{ STREETS[oid]=j; return j; });
  return STREETS[oid]; }
function streetsReady(oid){ const s=STREETS[oid]; return s && !(s instanceof Promise) ? s : null; }
function decodeRoads(list){ return (list||[]).map(([n,c,d])=>{ const pts=[]; let x=0,y=0; for(let i=0;i<d.length;i+=2){ x+=d[i]; y+=d[i+1]; pts.push([x/100,y/100]); } return {n,c,pts}; }); }
const ROAD_CLASS=c=>c==="S1100"?"r1":c==="S1200"?"r2":(c==="S1630"||c==="S1640")?"r3":(c==="S1740"||c==="S1730"||c==="S1780")?"r5":"r4";
const pathD=pts=>"M"+pts.map(p=>p[0].toFixed(2)+" "+p[1].toFixed(2)).join("L");

/* the street map shown when a school is opened */
function streetMapHTML(f){
  if(f.lat==null) return "";
  const data=streetsReady(f.orgId);
  if(STREETS[f.orgId]===null) return "";
  if(!data){ loadStreets(f.orgId).then(j=>{ const el=document.getElementById("smap-"+f.id); if(el&&j) el.outerHTML=streetMapHTML(f); else if(el) el.remove(); }); return `<div class="smap loading" id="smap-${esc(f.id)}"><span class="faint">Loading streets…</span></div>`; }
  const roads=decodeRoads(data.schools[f.id]||[]); if(!roads.length) return "";
  const [cx,cy]=proj(f.lng,f.lat), hw=6.2, hh=4.3, vb=[cx-hw,cy-hh,2*hw,2*hh];
  const inBox=([x,y])=>x>vb[0]-1&&x<vb[0]+vb[2]+1&&y>vb[1]-1&&y<vb[1]+vb[3]+1;
  const order={r5:0,r4:1,r3:2,r2:3,r1:4}; roads.sort((a,b)=>order[ROAD_CLASS(a.c)]-order[ROAD_CLASS(b.c)]);
  let g=`<rect x="${vb[0]-2}" y="${vb[1]-2}" width="${vb[2]+4}" height="${vb[3]+4}" class="sm-land"/>`;
  g+=roads.map(r=>`<path class="sm-case ${ROAD_CLASS(r.c)}" d="${pathD(r.pts)}"/>`).join("");
  g+=roads.map(r=>`<path class="sm-road ${ROAD_CLASS(r.c)}" d="${pathD(r.pts)}"/>`).join("");
  /* one label per street name, on its longest visible stretch */
  const best={}; roads.forEach(r=>{ if(!r.n||ROAD_CLASS(r.c)==="r5") return; for(let i=1;i<r.pts.length;i++){ const a=r.pts[i-1], b=r.pts[i]; if(!inBox(a)||!inBox(b)) continue; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(!best[r.n]||L>best[r.n].L) best[r.n]={L,a,b,c:r.c}; } });
  const labels=Object.entries(best).filter(([n,x])=>x.L>0.9).sort((a,b)=>b[1].L-a[1].L).slice(0,14);
  g+=labels.map(([n,x])=>{ let ang=Math.atan2(x.b[1]-x.a[1],x.b[0]-x.a[0])*180/Math.PI; if(ang>90) ang-=180; if(ang<-90) ang+=180; const mx=(x.a[0]+x.b[0])/2, my=(x.a[1]+x.b[1])/2;
    return `<text class="sm-label ${ROAD_CLASS(x.c)}" transform="translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(${ang.toFixed(1)})" dy="0.09">${esc(n)}</text>`; }).join("");
  /* every tracked facility in view, this school on top */
  const near=model().facs.filter(o=>o.lat!=null&&o.id!==f.id&&inBox(proj(o.lng,o.lat)));
  const pin=(o,me)=>{ const [x,y]=proj(o.lng,o.lat); return `<g class="sm-pin ${me?"me":""}" data-fac="${esc(o.id)}"><circle cx="${x}" cy="${y}" r="${me?0.34:0.22}" style="fill:${STATE_FILL[o.state]||"var(--off)"}"><title>${esc(o.name)} · ${esc(STATE_LABEL[o.state]||"")}</title></circle>${me?"":`<text x="${x}" y="${y-0.34}" class="sm-near">${esc(o.name)}</text>`}</g>`; };
  g+=near.map(o=>pin(o,false)).join("")+pin(f,true);
  const kmW=vb[2]*96.1/1000; // 1 unit of x is about 96 m at this latitude
  const bar=0.5/kmW*vb[2]; // 500 m
  g+=`<g class="sm-scale"><line x1="${vb[0]+0.4}" x2="${vb[0]+0.4+bar}" y1="${vb[1]+vb[3]-0.4}" y2="${vb[1]+vb[3]-0.4}"/><text x="${vb[0]+0.4}" y="${vb[1]+vb[3]-0.6}">500 m</text></g>`;
  return `<div class="smap" id="smap-${esc(f.id)}"><svg viewBox="${vb.map(v=>v.toFixed(2)).join(" ")}" role="img" aria-label="Streets around ${esc(f.name)}">${g}</svg>
    <div class="sm-foot"><span>${near.length?`${near.length} other tracked ${near.length>1?"facilities":"facility"} nearby`:"Streets within about half a mile"}</span><span class="faint">Census TIGER roads</span>${f.address?`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address+", TX")}" target="_blank" rel="noopener">Directions</a>`:""}</div></div>`;
}

/* main map: when a district with street data is selected, draw its school-area streets */
function drawStreets(){ const g=$("#g-streets"); if(!g||!MAPSTATE) return; const oid=S.ui.map.sel; g.innerHTML="";
  if(!oid) return; const data=streetsReady(oid);
  if(!data){ if(STREETS[oid]!==null) loadStreets(oid).then(j=>{ if(j&&S.ui.map.sel===oid) drawStreets(); }); return; }
  const seen=new Set(); let h="";
  Object.values(data.schools).forEach(list=>decodeRoads(list).forEach(r=>{ const k=r.n+"|"+r.pts[0].join(",")+"|"+r.pts.length; if(seen.has(k)) return; seen.add(k); h+=`<path class="g-street ${ROAD_CLASS(r.c)}" d="${pathD(r.pts)}"/>`; }));
  g.innerHTML=h; }

/* contacts: a phone number becomes a tap-to-call link (digits only, extension kept as ",ext") */
function telHref(p){ const s=String(p||""); const m=s.match(/^(.*?)(?:\s*(?:x|ext\.?|extension)\s*(\d+))?\s*$/i); const d=(m[1]||"").replace(/[^\d+]/g,""); return "tel:"+d+(m&&m[2]?","+m[2]:""); }
