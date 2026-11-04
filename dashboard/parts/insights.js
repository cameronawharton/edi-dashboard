/* ------------------------------------------------------------------ insights */
function dataYears(){ const ys=new Set(Object.values(S.ledgers).map(l=>l.year)); ys.add(yearOf(todayISO())); return [...ys].sort().reverse(); }
function prevYear(Y){ const s=+Y.slice(0,4)-1; return `${s}-${String(s+1).slice(2)}`; }
const TYPE_PICK=[["ISD","ISDs"],["Charter","charter operators"],["Private","private schools"],["CP","charter and private operators"],["all","districts and operators of every type"]];
const typeOk=(t,pick)=>pick==="all"||(pick==="CP"?(t==="Charter"||t==="Private"):t===pick);
const yearSel=(id,val,years)=>`<select class="inl" data-ins="${id}">${years.map(y=>`<option ${y===val?"selected":""}>${y}</option>`).join("")}</select>`;
const typeSel=(id,val,opts)=>`<select class="inl" data-ins="${id}">${(opts||TYPE_PICK).map(([v,l])=>`<option value="${v}" ${v===val?"selected":""}>${l}</option>`).join("")}</select>`;
function sentenceBox(id,text){ return `<div class="sentence"><span id="${id}">${esc(text)}</span><button class="copy" data-act="copy-sentence" data-target="${id}" type="button">Copy</button></div>`; }
function monthKeys(Y){ const s=+Y.slice(0,4), sm=settings().yearStartMonth, out=[]; for(let i=0;i<12;i++){ const m=((sm-1+i)%12)+1, y=s+((sm-1+i)>=12?1:0); out.push(`${y}-${String(m).padStart(2,"0")}`);} return out; }
function barsSVG(series,labels){ // series: [{name,color,values}]
  const W=560,H=150,pl=28,pb=22,pt=8,n=labels.length,max=Math.max(1,...series.flatMap(s=>s.values)); const step=Math.pow(10,Math.floor(Math.log10(max))); const top=Math.ceil(max/step)*step||1;
  const gw=(W-pl)/n, bw=Math.min(14,(gw-6)/series.length);
  let g=""; [0,.5,1].forEach(t=>{ const y=pt+(H-pt-pb)*(1-t); g+=`<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-5}" y="${y+3}" text-anchor="end" font-size="9.5" fill="var(--ink3)" font-family="var(--f-mono)">${Math.round(top*t)}</text>`; });
  labels.forEach((l,i)=>{ const x0=pl+i*gw+(gw-bw*series.length)/2; series.forEach((s,j)=>{ const v=s.values[i]||0, h=(H-pt-pb)*v/top; if(v) g+=`<rect x="${(x0+j*bw).toFixed(1)}" y="${(H-pb-h).toFixed(1)}" width="${(bw-1.5).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${s.color}"><title>${s.name}, ${l}: ${v}</title></rect>`; });
    g+=`<text x="${(pl+i*gw+gw/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="9.5" fill="var(--ink3)" font-family="var(--f-mono)">${l}</text>`; });
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Inspections by month">${g}</svg><div class="legend-line">${series.map(s=>`<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div></div>`; }
function median(a){ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; }
const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);

function vInsights(){
  const I=S.ui.ins, years=dataYears(), cur=curYear();
  if(!I.q1year) I.q1year=years.find(y=>y<yearOf(todayISO()))||years[0];
  const cards=[];
  /* Q1: threshold */
  { const M=model(I.q1year); const os=Object.values(M.orgStats).filter(s=>typeOk(s.org.type,I.q1type)&&s.active>0).sort((a,b)=>b.coverage-a.coverage); const thr=Math.max(0,Math.min(100,+I.q1thr||0))/100;
    const met=os.filter(s=>s.coverage+1e-9>=thr); const share=os.length?met.length/os.length:0; const tl=(TYPE_PICK.find(t=>t[0]===I.q1type)||[,""])[1];
    const sent=`In ${I.q1year}, ${met.length} of ${os.length} ${tl} (${pct(share)}) inspected at least ${pct(thr)} of their active campuses.`;
    cards.push(`<section class="qcard"><div class="q">What share of ${typeSel("q1type",I.q1type)} reached <input class="inl num" type="number" min="0" max="100" step="5" data-ins="q1thr" value="${Math.round(thr*100)}">% inspection coverage in ${yearSel("q1year",I.q1year,years)}?</div>
      <div class="ans"><b>${met.length}<span class="of"> of ${os.length}</span></b><span class="big2">${pct(share)}</span></div>${sentenceBox("s-q1",sent)}
      <div class="qlist">${os.map(s=>`<div class="qrow" data-org="${s.id}"><span class="nm">${esc(s.org.name)}</span><div class="meter thin"><i style="width:${Math.min(100,s.coverage*100)}%;background:${s.coverage+1e-9>=thr?"var(--ok)":"var(--ink3)"}"></i><span class="tick" style="left:calc(${Math.min(100,thr*100)}% - 1px)"></span></div><span class="mono">${s.visited}/${s.active}</span><span class="mono">${pct(s.coverage)}</span></div>`).join("")}</div>
      <p class="method">Coverage is the share of a district's active campuses with at least one inspection dated inside the school year (${settings().yearStartMonth===8?"Aug 1 to Jul 31":"season start to end"}). Closed or excluded campuses are left out unless they were inspected that year.${I.q1year<yearOf(todayISO())?"":" This season is still in progress."}</p></section>`); }
  /* Q2: projects started */
  { const months=Math.max(1,+I.q2months||12); const since=new Date(); since.setMonth(since.getMonth()-months); const sinceISO=since.toISOString().slice(0,10);
    const os=Object.entries(S.orgs).filter(([,o])=>typeOk(o.type,I.q2type)&&o.type!=="Daycare"); const ps=Object.entries(S.projects).map(([id,p])=>Object.assign({id},p)).filter(p=>S.orgs[p.org]&&typeOk(S.orgs[p.org].type,I.q2type)&&(I.q2kind==="any"||p.kind===I.q2kind));
    const dated=ps.filter(p=>p.started), undated=ps.filter(p=>!p.started); const inWin=dated.filter(p=>p.started>=sinceISO&&p.started<=todayISO());
    const withP=new Set(inWin.map(p=>p.org)); const share=os.length?withP.size/os.length:0; const tl=(TYPE_PICK.find(t=>t[0]===I.q2type)||[,""])[1];
    const sent=`In the last ${months} months, ${withP.size} of ${os.length} ${tl} (${pct(share)}) started a new ${I.q2kind==="any"?"project":I.q2kind.toLowerCase()+" project"}.`;
    cards.push(`<section class="qcard"><div class="q">What share of ${typeSel("q2type",I.q2type,TYPE_PICK.slice(0,4).concat([["all","districts and operators"]]))} started a <select class="inl" data-ins="q2kind">${["any","New construction","Addition","Renovation","Portable buildings","Fire alarm / sprinkler upgrade"].map(k=>`<option value="${k}" ${I.q2kind===k?"selected":""}>${k==="any"?"new project of any kind":k.toLowerCase()+" project"}</option>`).join("")}</select> in the last <input class="inl num" type="number" min="1" max="60" data-ins="q2months" value="${months}"> months?</div>
      ${undated.length&&!dated.length?`<div class="ans warn"><b>Not answerable yet</b></div><div class="notice">None of the ${undated.length} projects on file has a start date. Open each one under Active projects and fill in “Started.” This answer fills in as soon as dates exist.</div>`:
      `<div class="ans"><b>${withP.size}<span class="of"> of ${os.length}</span></b><span class="big2">${pct(share)}</span></div>${sentenceBox("s-q2",sent)}
      ${undated.length?`<div class="notice">${undated.length} project${undated.length>1?"s have":" has"} no start date and ${undated.length>1?"are":"is"} not counted: ${undated.map(p=>esc(p.name)).join(", ")}.</div>`:""}
      <div class="qlist">${inWin.sort((a,b)=>b.started.localeCompare(a.started)).map(p=>`<div class="qrow" data-project="${esc(p.id)}"><span class="nm">${esc(p.name)}</span><span class="muted">${esc(S.orgs[p.org]?.name||"")}</span><span class="tag">${esc(p.phase||"")}</span><span class="mono">${fmtDate(p.started)}</span></div>`).join("")}</div>`}
      <p class="method">Counts districts with at least one project whose start date falls in the window. Only projects logged under Active projects are counted.</p></section>`); }
  /* Q3: workload */
  { const Y=I.q3year||cur, P=prevYear(Y); const vs=y=>Object.values(S.ledgers).filter(l=>l.year===y).flatMap(l=>Object.values(l.visits||{})).filter(v=>v&&!v.voided);
    const a=vs(Y), b=vs(P); const mk=monthKeys(Y), mkP=monthKeys(P); const lab=mk.map(m=>"JFMAMJJASOND"[+m.slice(5)-1]);
    const isCur=Y===yearOf(todayISO()); const offset=days(yearBounds(Y).start,todayISO()); const cutP=new Date(Date.parse(yearBounds(P).start)+offset*864e5).toISOString().slice(0,10);
    const bTD=isCur?b.filter(v=>v.date<=cutP):b; const init=a.filter(v=>v.kind==="initial").length; const fac=new Set(a.map(v=>v.facility)).size;
    const diff=a.length-bTD.length;
    const sent=`${isCur?`So far in ${Y}`:`In ${Y}`}, the team logged ${a.length} inspection visits (${init} initial, ${a.length-init} re-inspections) covering ${fac} facilities${b.length?`, ${diff>=0?diff+" more":Math.abs(diff)+" fewer"} than ${isCur?"the same point in":"in"} ${P}`:""}.`;
    cards.push(`<section class="qcard wide"><div class="q">How many inspections did the team complete in ${yearSel("q3year",Y,years)}?</div>
      <div class="ans"><b>${a.length}<span class="of"> visits</span></b><span class="big2">${fac} facilities</span>${b.length?`<span class="delta ${diff>=0?"up":"down"}">${diff>=0?"+":""}${diff} vs ${isCur?"same point in ":""}${P}</span>`:""}</div>${sentenceBox("s-q3",sent)}
      ${barsSVG([{name:P,color:"var(--ink3)",values:mkP.map(m=>b.filter(v=>v.date.slice(0,7)===m).length)},{name:Y,color:"var(--accent)",values:mk.map(m=>a.filter(v=>v.date.slice(0,7)===m).length)}],lab)}
      <p class="method">Every logged visit counts once, including re-inspections. Voided visits are left out. Visits from the spreadsheets keep their original dates.</p></section>`); }
  /* Q4: failures cleared */
  { const Y=I.q4year||cur; const M=model(Y); const fails=[]; const cleared=[];
    for(const f of M.facs){ const vs=f.visitsAll.filter(v=>!v.voided).slice().sort((x,y)=>x.date.localeCompare(y.date)); vs.forEach((v,i)=>{ if(v.year!==Y||v.result!=="fail") return; fails.push(f); const nx=vs.slice(i+1).find(w=>w.result!=="fail"); if(nx) cleared.push({f,d:days(v.date,nx.date)}); }); }
    const open=M.facs.filter(f=>f.state==="failed"); const med=median(cleared.map(c=>c.d));
    const sent=`In ${Y}, inspections found ${fails.length} failure${fails.length===1?"":"s"}. ${cleared.length} ${cleared.length===1?"was":"were"} cleared by a passing re-inspection${med!=null?`, a median of ${Math.round(med)} days later`:""}; ${open.length} ${open.length===1?"is":"are"} still open.`;
    cards.push(`<section class="qcard"><div class="q">How quickly are failed inspections cleared in ${yearSel("q4year",Y,years)}?</div>
      <div class="ans"><b>${med!=null?Math.round(med):"–"}<span class="of"> days median</span></b><span class="big2">${cleared.length}/${fails.length} cleared</span></div>${sentenceBox("s-q4",sent)}
      ${open.length?`<div class="qlist">${open.map(f=>`<div class="qrow" data-fac="${esc(f.id)}"><span class="nm">${esc(f.name)}</span><span class="muted">${esc(f.org.name)}</span><span class="mono">${f.lastY?fmtDate(f.lastY.date):""}</span><span class="pill s-failed">open</span></div>`).join("")}</div>`:""}
      <p class="method">A failure is an inspection marked fail. It is cleared by the next visit to the same facility that is not a fail. The spreadsheets recorded few failures, so earlier years undercount.</p></section>`); }
  /* Q5: three-year cycle */
  { const Y=I.q5year||cur; const s=+Y.slice(0,4); const win=[0,1,2].map(i=>`${s-i}-${String(s-i+1).slice(2)}`); const have=win.filter(y=>Object.values(S.ledgers).some(l=>l.year===y));
    const M=model(Y); const seen=new Set(); Object.values(S.ledgers).filter(l=>win.includes(l.year)).forEach(l=>Object.values(l.visits||{}).forEach(v=>{ if(v&&!v.voided) seen.add(v.facility); }));
    const os=Object.values(M.orgStats).filter(x=>x.org.type==="ISD"&&x.active).map(x=>{ const fs=M.facs.filter(f=>f.orgId===x.id&&f.state!=="excluded"); const c=fs.filter(f=>seen.has(f.id)).length; return {x,n:fs.length,c}; }).sort((a,b)=>b.c/b.n-a.c/a.n);
    const N=os.reduce((t,o)=>t+o.n,0), C=os.reduce((t,o)=>t+o.c,0);
    const sent=`Across ${win[2]} to ${win[0]}, ${C} of ${N} active ISD campuses (${pct(N?C/N:0)}) were inspected at least once.${have.length<3?` Only ${have.length} of the 3 years are on record so far.`:""}`;
    cards.push(`<section class="qcard"><div class="q">Is every ISD campus seen at least once in the three-year cycle ending ${yearSel("q5year",Y,years)}?</div>
      <div class="ans"><b>${pct(N?C/N:0)}</b><span class="big2">${C} of ${N} campuses</span></div>${sentenceBox("s-q5",sent)}
      <div class="qlist">${os.map(o=>`<div class="qrow" data-org="${o.x.id}"><span class="nm">${esc(o.x.org.name)}</span><div class="meter thin"><i style="width:${o.n?o.c/o.n*100:0}%;background:var(--accent)"></i></div><span class="mono">${o.c}/${o.n}</span><span class="mono">${pct(o.n?o.c/o.n:0)}</span></div>`).join("")}</div>
      <p class="method">Rotations A, B and C each cover about a third of a district, so a full cycle should reach 100%. Years in the window: ${win.slice().reverse().join(", ")}.</p></section>`); }
  /* Q6: rotation adherence */
  { const Y=I.q6year||cur; const M=model(Y), L=rotationFor(Y); const isd=M.facs.filter(f=>f.type==="ISD"&&f.visited); const inR=isd.filter(f=>f.inRotation).length;
    const rot=M.facs.filter(f=>f.type==="ISD"&&f.inRotation); const rotDone=rot.filter(f=>f.visited).length;
    const sent=`In ${Y}, ${inR} of ${isd.length} ISD campuses inspected (${pct(isd.length?inR/isd.length:0)}) were in that year's Rotation ${L} or on the every-year list, and ${rotDone} of ${rot.length} rotation campuses (${pct(rot.length?rotDone/rot.length:0)}) have been done.`;
    cards.push(`<section class="qcard"><div class="q">Is the work following the rotation in ${yearSel("q6year",Y,years)}?</div>
      <div class="ans"><b>${pct(isd.length?inR/isd.length:0)}<span class="of"> on rotation</span></b><span class="big2">${rotDone}/${rot.length} of Rotation ${L} done</span></div>${sentenceBox("s-q6",sent)}
      <p class="method">Compares each inspected ISD campus with its rotation letter. Off-rotation inspections are not wrong (complaints, new buildings, requests), but a high share means the rotation group is falling behind.</p></section>`); }
  /* story strip */
  const Y=cur, P=prevYear(Y), A=model(Y), B=model(P);
  const strip=[["ISD campuses inspected",A.prog.ISD.visited,B.prog.ISD.visited],["ISDs at "+pct(settings().targets.ISD),A.prog.ISD.met,B.prog.ISD.met],["Charter & private inspected",A.prog.Charter.visited+A.prog.Private.visited,B.prog.Charter.visited+B.prog.Private.visited],["Daycares inspected",A.prog.Daycare.visited,B.prog.Daycare.visited],["Total visits",A.visits.filter(v=>v.year===Y&&!v.voided).length,A.visits.filter(v=>v.year===P&&!v.voided).length]];
  return `<section class="panel"><div class="ph"><h3>${Y} so far, next to ${P}</h3><span class="faint">${pct(A.pf)} of the season has elapsed</span><span style="flex:1"></span><button class="btn sm" data-act="copy-all-insights" type="button">Copy every answer</button></div>
    <div class="pb strip">${strip.map(([l,a,b])=>`<div><span class="eyebrow">${l}</span><b class="num">${a}</b><span class="faint mono">${P}: ${b}</span></div>`).join("")}</div></section>
  <div class="insgrid">${cards.join("")}</div>
  <p class="faint" style="font-size:12.5px;max-width:80ch;margin:0">Every number here is computed live from the tracker's records. Change a filter in a question and the answer and its sentence update together. Need a question that isn't here yet? Tell Claude what you need to answer and it can be added as a new card.</p>`;
}
