/* ------------------------------------------------------------------ action codes (Emergency Reporting "Action Codes" report) and inspection report detail */
S.actions=S.actions||{};
/* which board line each action code fills. Codes not listed here are shown but never summed into the board. */
const ACT_BOARD={INSP:"assist",VISIT:"site",KNOX:"knox",FMO:"fmoi",FMOC:"fmoc",VIOL:"viol",FPSN:"fpnr"};
/* FSS codes (County, FSS Activities): Site Visit, Call Out For Service (On call), Trirga Work Task (Tririga received), Tririga Status counts as cleared only when it says so; every other FSS code is Other request */
const TRIRIGA_CLEARED=/\b(clear(ed)?|closed?|complete[d]?|resolved)\b/i;
const isFSS=a=>/^\s*FSS\b/i.test(a.cn||"")||/^\s*FSS/i.test(a.c||"");
function fssLine(a){ const n=String(a.cn||a.c||"").toLowerCase();
  if(/site\s*visit/.test(n)) return "fss3"; if(/call\s*out/.test(n)) return "fss5"; if(/work\s*task/.test(n)) return "fss1";
  if(/status/.test(n)) return TRIRIGA_CLEARED.test(a.desc||"")?"fss2":"fss6"; return "fss6"; }
/* codes arrive as "FMO", "FMO-Clr", "FPSN", "FPSN-Clear" ... only the plain FPSN (received) is on the board */
const actLine=a=>{ if(isFSS(a)) return fssLine(a); const c=String(a.c||"").toUpperCase().replace(/\s+/g,""); if(/^FMO/.test(c)) return (/CL/.test(c)||/clear/i.test(a.cn||""))?"fmoc":"fmoi"; return ACT_BOARD[c]||null; };
const ACT_LINES=[...Object.values(ACT_BOARD),"fss1","fss2","fss3","fss5","fss6"];
const memDiv=id=>S.team[id]?divOf(S.team[id]):"education";
const ASSIST_TOL=30; // minutes either way before an assist is flagged against the inspection it supports
function actDocsFor(month,div){ return Object.entries(S.actions).filter(([,d])=>d.month===month&&(d.division||"education")===div).map(([id,d])=>Object.assign({id},d)); }
function actRows(month,div,member){ return actDocsFor(month,div).filter(d=>!member||d.member===member).flatMap(d=>(d.rows||[]).map(r=>Object.assign({member:d.member},r))); }
/* board-line sums for a month, plus the codes that have no board line */
function actionSums(month,div){ const docs=actDocsFor(month,div||"education"); const k={}, other={};
  docs.forEach(d=>(d.rows||[]).forEach(r=>{ const line=actLine(r); if(line) k[line]=(k[line]||0)+1; else { const o=other[r.c]=other[r.c]||{cn:r.cn,n:0,h:0}; o.n++; o.h+=actH(r); } }));
  return {any:docs.length>0,k,other,people:new Set(docs.map(d=>d.member)).size}; }
/* an entry with no time written counts as ACT_BASELINE_H (15 minutes, decided Nov 4 2026) and is listed in Needs attention */
const ACT_BASELINE_H=0.25;
const actH=r=>r.h==null?ACT_BASELINE_H:(+r.h||0);
function actHours(member,month){ const dv=memDiv(member); const rows=actRows(month,dv,member); const miss=rows.filter(r=>r.h==null); const byCode={}; miss.forEach(r=>byCode[r.c]=(byCode[r.c]||0)+1);
  return {any:actDocsFor(month,dv).some(d=>d.member===member),h:rows.reduce((s,r)=>s+actH(r),0),n:rows.length,noH:miss.length,missByCode:byCode}; }

/* inspection assist check: an assist entry names who was helped; find that person's inspection the same day at the same occupancy and compare time */
function assistTarget(desc){ const m=String(desc||"").match(/(?:assist(?:ed)?(?:\s+\w+)?\s+with|assisted)\s+(?:([A-Z])\.\s*|([A-Z])\s+(?=[A-Z][a-z]))?([A-Z][A-Za-z]+)/i); if(!m) return null;
  const w=m[3].toLowerCase(); const ini=(m[1]||m[2]||"");
  const hit=Object.entries(S.team).find(([,t])=>{ const p=t.name.toLowerCase().split(/\s+/); const first=(t.preferred||p[0]).toLowerCase(), last=p[p.length-1];
    return w===last||w===first||w===p[0]||(w.length>=4&&(p[0].startsWith(w)||w.startsWith(p[0]))); });
  return {label:(ini?ini+". ":"")+m[3],id:hit?hit[0]:null}; }
const occKey=s=>String(s||"").replace(/\s+/g,"").toUpperCase();
function assistCheck(month,div){ div=div||"education"; const out=[];
  actRows(month,div).filter(r=>String(r.c).toUpperCase()==="INSP").forEach(a=>{ const t=assistTarget(a.desc); const o={a,who:t?t.label:"?",target:t&&t.id};
    if(!t){ o.check="noname"; out.push(o); return; }
    if(!t.id||!isField(S.team[t.id])||divOf(S.team[t.id])!==div){ o.check="outside"; out.push(o); return; }
    const theirs=Object.values(S.er).filter(d=>d.inspector===t.id).flatMap(d=>d.rows);
    const same=theirs.filter(r=>r.date===a.date), at=same.filter(r=>occKey(r.id)===occKey(a.id));
    if(at.length){ const r=at[0]; o.r=r; if(a.h==null) o.check="nohours"; else { o.diff=Math.round(a.h*60-(r.mins||0)); o.check=Math.abs(o.diff)<=ASSIST_TOL?"ok":o.diff>0?"longer":"shorter"; } }
    else if(same.length){ o.check="place"; o.theirs=same; }
    else { o.check="noday"; o.near=theirs.filter(r=>occKey(r.id)===occKey(a.id)); }
    out.push(o); });
  return out.sort((x,y)=>x.a.date.localeCompare(y.a.date)); }
const ASSIST_LABEL={ok:["Matches","s-done"],nohours:["Matched, no hours given","s-off"],longer:["Longer than the inspection","s-due"],shorter:["Shorter than the inspection","s-due"],place:["Different location that day","s-failed"],noday:["No inspection that day","s-failed"],outside:["Assisted someone outside the team","s-off"],noname:["No name in the entry","s-off"]};

function actionsPanel(month,div){ div=div||"education"; const docs=actDocsFor(month,div); const i=+month.slice(5)-1, year=+month.slice(0,4);
  if(!docs.length) return `<section class="panel"><div class="ph"><h3>Action codes</h3><span class="faint">${MON3[i]} ${year}</span></div><div class="pb empty">No action-code report loaded for this month. Prevention action lines on the board fall back to the team's own log entries or the board as entered.</div></section>`;
  const codes={}; docs.forEach(d=>(d.rows||[]).forEach(r=>{ const c=codes[r.c]=codes[r.c]||{cn:r.cn,line:actLine(r),by:{},n:0,h:0}; c.n++; c.h+=actH(r); c.noH=(c.noH||0)+(r.h==null?1:0); c.by[d.member]=(c.by[d.member]||0)+1; }));
  const people=docs.map(d=>d.member).sort((a,b)=>memberName(a).localeCompare(memberName(b)));
  const order=Object.entries(codes).sort((a,b)=>(!!b[1].line-!!a[1].line)||b[1].n-a[1].n);
  const rowsHTML=order.map(([c,o])=>`<tr><td><span class="mono">${esc(c)}</span> ${esc(o.cn||"")}<div class="faint" style="font-size:12px">${o.line?`Board: ${esc(BROW[o.line].label)}`:"Not on the board"}</div></td>${people.map(p=>`<td class="r mono">${o.by[p]||""}</td>`).join("")}<td class="r mono"><b>${o.n}</b></td><td class="r mono">${o.h?o.h.toFixed(1):"–"}${o.noH?`<div class="faint" style="font-size:11.5px" title="Entries with no time written count 15 minutes each">${o.noH} at 15 min</div>`:""}</td></tr>`).join("");
  const A=assistCheck(month,div); const cnt={}; A.forEach(o=>cnt[o.check]=(cnt[o.check]||0)+1); const flagged=A.filter(o=>["longer","shorter","place","noday"].includes(o.check));
  const arow=o=>{ const [lbl,cls]=ASSIST_LABEL[o.check]; const r=o.r;
    const theirs=r?`${esc(memberName(o.target))}: ${esc(r.type)}, ${esc(r.tin)}–${esc(r.tout)}, ${r.mins} min on site`:o.theirs?`${esc(memberName(o.target))} was at ${o.theirs.map(x=>esc(x.occ)).join(", ")}`:o.near&&o.near.length?`${esc(memberName(o.target))} inspected it ${o.near.map(x=>fmtDate(x.date)).join(", ")}`:o.target&&S.team[o.target]?`Nothing on file for ${esc(memberName(o.target))} that day`:"";
    return `<tr><td class="mono">${fmtDate(o.a.date)}</td><td style="white-space:nowrap">${avatar(o.a.member,22)} ${esc(memberName(o.a.member))}</td><td>${esc(o.who)}</td><td>${esc(o.a.occ)}<div class="faint mono" style="font-size:12px">${esc(o.a.id)}</div></td><td class="r mono" style="white-space:nowrap">${o.a.h!=null?o.a.h.toFixed(2).replace(/\.?0+$/,"")+" h":"–"}</td><td><span class="pill ${cls}">${lbl}</span>${o.diff!=null&&o.check!=="ok"?` <span class="mono faint">${o.diff>0?"+":""}${o.diff} min</span>`:""}<div class="faint" style="font-size:12px">${theirs}</div>${flagCell(o)}</td></tr>`; };
  const ahead=`<thead><tr><th>Date</th><th>Entered by</th><th>Assisted</th><th>Occupancy</th><th class="r">Hours</th><th>Check</th></tr></thead>`;
  return `<section class="panel" id="actionspanel"><div class="ph"><h3>Action codes</h3><span class="faint">${MON3[i]} ${year} · ${docs.reduce((s,d)=>s+(d.rows||[]).length,0)} entries from ${esc(docs[0].source||"the action-code report")}</span></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Code</th>${people.map(p=>`<th class="r">${esc(memberName(p,"first"))}</th>`).join("")}<th class="r">Total</th><th class="r">Hours</th></tr></thead><tbody>${rowsHTML}</tbody></table></div>
    <div class="pb" style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line)"><div><span class="eyebrow">Inspection assist check</span>
      <p class="faint" style="margin:4px 0 0;font-size:12.5px">${A.length} assists. Each one is matched to the inspection of the person named, same day and same occupancy ID, and the hours compared with their time on site (within ${ASSIST_TOL} minutes counts as a match).</p></div>
      <div class="erchips">${Object.entries(ASSIST_LABEL).filter(([k])=>cnt[k]).map(([k,[l,c]])=>`<span class="pill ${c}">${l} · ${cnt[k]}</span>`).join("")}</div>
      ${flagged.length?`<div class="tablewrap"><table class="t">${ahead}<tbody>${flagged.map(arow).join("")}</tbody></table></div>`:`<div class="recon ok"><b>No variances</b><span>Every assist with a named team member lines up with an inspection.</span></div>`}
      <details class="opens"><summary>All assists (${A.length})</summary><div class="tablewrap"><table class="t">${ahead}<tbody>${A.map(arow).join("")}</tbody></table></div></details></div></section>`; }

/* inspection report detail (from the report PDFs Emergency Reporting emails for each approved inspection) */
function erRowByKey(k){ for(const d of Object.values(S.er)) for(const r of d.rows) if(r.k===k) return Object.assign({inspName:d.inspectorName,member:d.inspector},erLive(r)); return null; }
function reportBadge(r){ if(!r.src) return ""; const n=(r.fl||[]).filter(x=>!/^Printed on |^Inspection Topics:?$/i.test(x.q||"")).length; return `<button class="btn sm ghost rptbtn" type="button" data-errow="${esc(r.k)}" title="Open the inspection report">${n?`${n} failed item${n>1?"s":""}`:"Report"}</button>`; }
function openReport(k){ const r=erRowByKey(k); if(!r) return; r.fl=(r.fl||[]).filter(x=>!/^Printed on |^Inspection Topics:?$/i.test(x.q||"")); const f=r.fac&&model().byId[r.fac];
  openModal(`<div class="mh"><h2>${f?logoImg(logoFor(f),36):""}${esc(r.occ)}</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb" style="display:flex;flex-direction:column;gap:12px">
    <div class="rptgrid"><div><span class="eyebrow">Inspection</span><b>${esc(r.type)}</b><span class="faint">${fmtDate(r.date)} · ${esc(r.tin)}–${esc(r.tout)} · ${esc(r.inspName||"")}</span></div>
      <div><span class="eyebrow">Occupancy</span><b class="mono">${esc(r.id)}</b><span class="faint">${esc(r.addr)}${r.city?", "+esc(r.city):""}</span></div>
      <div><span class="eyebrow">Overall result</span><b>${esc(r.rt||ER_RES_LABEL[r.res]||"")}</b><span>${erPill(r.res)}${r.coi?` <span class="mono faint">COI ${esc(r.coi)}</span>`:""}</span></div>
      <div><span class="eyebrow">Time</span><b class="mono">${r.mins} min on site</b><span class="faint">plus ${r.add||0} min additional</span></div>
      ${r.nx?`<div><span class="eyebrow">Next inspection</span><b>${fmtDate(r.nx.d)}</b><span class="faint">${esc(r.nx.t||"")}</span></div>`:""}</div>
    ${(r.fl||[]).length?`<div><span class="eyebrow">Failed checklist items (${r.fl.length})</span><ol class="fails">${r.fl.map(x=>`<li><b>${esc(x.q)}</b>${x.n?`<div class="faint">${esc(x.n)}</div>`:""}</li>`).join("")}</ol></div>`:`<p class="faint" style="margin:0">No failed checklist items on the report.</p>`}
    ${r.po?`<div class="notice">This report was approved after the Emergency Reporting export was pulled, so it came from the report PDF alone.</div>`:""}</div>
    <div class="mf">${f?`<button class="btn" type="button" data-fac="${esc(f.id)}">Open ${esc(f.name)}</button>`:""}<button class="btn" data-close="1" type="button">Close</button></div>`); }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-errow]"); if(b){ e.stopPropagation(); e.preventDefault(); openReport(b.dataset.errow); } },true);
