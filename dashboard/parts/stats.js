/* ------------------------------------------------------------------ monthly statistics (Emergency Reporting import + division debrief) */
S.er=S.er||{}; S.stats=S.stats||{};
S.ui.st={month:null, div:"education", insp:"all", res:"all", log:false};
const ER_LIB="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const DIVISIONS=[["education","Education",true],["county","County Operations",true],["oper","Operational Permits",false],["general","General Occupancies",false],["serg","SERG",false]];
const MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/* Board layout: mirrors the Education sheet of the monthly stats workbook. r = workbook row. er = Emergency Reporting inspection types that fill the line. */
const BOARD=[
  {k:"all",r:4,label:"All Prevention Services",sum:["fire","actions","fss","boarding"],lvl:0},
  {k:"fire",r:6,label:"Fire Inspections",sum:["permit","existing"],lvl:0},
  {k:"permit",r:8,label:"Permit Based",sum:["cfccall","stb","fu233all","fps233","ug","precover","prelim","oppinsp","oppapp"],lvl:1,grp:"permit"},
  {k:"cfccall",r:9,label:"233-CFCC (total)",sum:["cfcc","school233"],lvl:2,grp:"permit"},
  {k:"cfcc",r:10,label:"233-CFCC",er:["233-CFCC"],lvl:3,grp:"permit"},
  {k:"school233",r:11,label:"233-School",er:["233-School"],lvl:3,grp:"permit"},
  {k:"stb",r:12,label:"233-Small Tenant Buildout",er:["233-Small Tenant Buildout"],lvl:2,grp:"permit"},
  {k:"fu233all",r:13,label:"233-Follow Up (total)",sum:["fu233","schfu233"],lvl:2,grp:"permit"},
  {k:"fu233",r:14,label:"233-Follow Up",er:["233-Follow Up"],lvl:3,grp:"permit",follow:true},
  {k:"schfu233",r:15,label:"233-School Follow-up",er:["233-School Follow Up"],lvl:3,grp:"permit",follow:true},
  {k:"fps233",r:16,label:"233-FPS Inspections",er:["233-FPS Inspections","233-FPS"],lvl:2,grp:"permit"},
  {k:"ug",r:17,label:"233-Underground",er:["233-Underground"],lvl:2,grp:"permit"},
  {k:"precover",r:18,label:"233-Pre-covers",er:["233-Pre-Cover","233-Pre-Covers"],lvl:2,grp:"permit"},
  {k:"prelim",r:19,label:"233-Preliminary",er:["233-Preliminary"],lvl:2,grp:"permit"},
  {k:"oppinsp",r:20,label:"233-Operational Permit Inspections",er:["233-Operational Permit Inspections","233-Operational Permit"],lvl:2,grp:"permit"},
  {k:"oppapp",r:21,label:"Operational Permit Applications",manual:true,lvl:2,grp:"permit"},
  {k:"opptime",r:22,label:"Average time to complete application approval",manual:true,measure:true,lvl:2,grp:"permit"},
  {k:"existing",r:24,label:"Existing Building Inspections",sum:["annualall","crl","crn","crr","fib","fu352","cmp","cmpfu","fpsn","county"],lvl:1,grp:"existing"},
  {k:"annualall",r:25,label:"352-Annual School (total)",sum:["annual","schfu352"],lvl:2,grp:"existing"},
  {k:"annual",r:26,label:"352-Annual School",er:["352-Annual School"],lvl:3,grp:"existing",rot:true},
  {k:"schfu352",r:27,label:"352-School Follow-up",er:["352-School Follow Up"],lvl:3,grp:"existing",rot:true,follow:true},
  {k:"crl",r:28,label:"352-Customer Request (License-required)",er:["352-Customer Request (Licensed)","352-Customer Request (License-required)","352-Customer Request (License Required)"],lvl:2,grp:"existing",rot:"daycare"},
  {k:"crn",r:29,label:"352-Customer Request (Non Licensed)",er:["352-Customer Request (Non Licensed)","352-Customer Request (Non-Licensed)"],lvl:2,grp:"existing"},
  {k:"crr",r:30,label:"352-Customer Request (Regulatory)",er:["352-Customer Request (Regulatory)"],lvl:2,grp:"existing"},
  {k:"fib",r:31,label:"352-Fire In Building",er:["352-Fire In Building"],lvl:2,grp:"existing"},
  {k:"fu352",r:32,label:"352-Follow Up",er:["352-Follow Up"],lvl:2,grp:"existing",follow:true},
  {k:"cmp",r:33,label:"352-Complaint",er:["352-Complaint"],lvl:2,grp:"existing"},
  {k:"cmpfu",r:34,label:"352-Complaint Follow Up",er:["352-Complaint Follow Up"],lvl:2,grp:"existing",follow:true},
  {k:"fpsn",r:35,label:"352-FPS Notification",er:["352-FPS Notification"],lvl:2,grp:"existing"},
  {k:"county",r:36,label:"County Buildings Annual Inspections",er:["352-County Buildings Annual","352-County Building Annual","County Buildings Annual Inspections"],lvl:2,grp:"existing"},
  {k:"actions",r:38,label:"Prevention Actions",sum:["assist","site","knox","cnr","fpnr","predoc","fmoi","fmoc","viol","cao","cit","chg","opn","sob"],lvl:0,grp:"actions"},
  {k:"assist",r:39,label:"Inspection Assist",manual:true,lvl:2,grp:"actions"},
  {k:"site",r:40,label:"Site Visit",manual:true,lvl:2,grp:"actions"},
  {k:"knox",r:41,label:"Knox Lock Site Visit",manual:true,lvl:2,grp:"actions"},
  {k:"cnr",r:42,label:"Complaint Notification Received",manual:true,lvl:2,grp:"actions"},
  {k:"w48",r:43,label:"Complaints responded to within 48 hours",manual:true,measure:true,lvl:2,grp:"actions"},
  {k:"fpnr",r:44,label:"Fire Protection Notifications Received",manual:true,lvl:2,grp:"actions"},
  {k:"predoc",r:45,label:"Pre-Inspection Document Reviews",manual:true,lvl:2,grp:"actions"},
  {k:"fmoi",r:46,label:"FMOs Issued",manual:true,lvl:2,grp:"actions"},
  {k:"fmoc",r:47,label:"FMOs Cleared",manual:true,lvl:2,grp:"actions"},
  {k:"viol",r:48,label:"Violations",manual:true,lvl:2,grp:"actions"},
  {k:"cao",r:49,label:"Referred to CAO",manual:true,lvl:2,grp:"actions"},
  {k:"cit",r:50,label:"Citations",manual:true,lvl:2,grp:"actions"},
  {k:"chg",r:51,label:"Charges Filed",manual:true,lvl:2,grp:"actions"},
  {k:"opn",r:52,label:"Operational Permit Notice Issuance",manual:true,lvl:2,grp:"actions"},
  {k:"sob",r:53,label:"SOB / Game Room / Task Force Operations",manual:true,lvl:2,grp:"actions"},
  {k:"fss",r:55,label:"FSS Activities",sum:["fss1","fss2","fss3","fss4","fss5","fss6"],lvl:0,grp:"fss"},
  {k:"fss1",r:56,label:"Tririga work requests received",manual:true,lvl:2,grp:"fss"},
  {k:"fss2",r:57,label:"Tririga work requests cleared",manual:true,lvl:2,grp:"fss"},
  {k:"fss3",r:58,label:"Site Visit",manual:true,lvl:2,grp:"fss"},
  {k:"fss4",r:59,label:"Inspections",manual:true,er:[],erDiv:"county",lvl:2,grp:"fss"},
  {k:"fss5",r:60,label:"On call",manual:true,lvl:2,grp:"fss"},
  {k:"fss6",r:61,label:"Other request",manual:true,lvl:2,grp:"fss"},
  {k:"boarding",r:63,label:"Boarding Homes Activities",sum:["bh1","bh2","bh3","bh4","bh5"],lvl:0,grp:"boarding"},
  {k:"bh1",r:64,label:"Complaints Received",manual:true,lvl:2,grp:"boarding"},
  {k:"bh2",r:65,label:"Complaints Cleared",manual:true,lvl:2,grp:"boarding"},
  {k:"bh3",r:66,label:"Site Visit",manual:true,lvl:2,grp:"boarding"},
  {k:"bh4",r:67,label:"Inspections",manual:true,lvl:2,grp:"boarding"},
  {k:"bh5",r:68,label:"Inspection Assist",manual:true,lvl:2,grp:"boarding"}
];
const BROW=Object.fromEntries(BOARD.map(b=>[b.k,b]));
const erNorm=s=>String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"").replace(/s$/,"");
const ERMAP={}; BOARD.forEach(b=>(b.er||[]).forEach(t=>{ ERMAP[erNorm(t)]=b.k; }));
/* families of types that Emergency Reporting names several ways ("233-FPS-Access Controls", "233-OPI-Operational Permit Inspection", "352-County Owned Building") */
const ERFAMILY=[[/^233countyown/,"cfcc"],[/^233fps/,"fps233"],[/^233(opi|operationalpermit)/,"oppinsp"],[/^352county/,"county"],[/^352annualschool/,"annual"],[/^352schoolfollow/,"schfu352"],[/^233schoolfollow/,"schfu233"],[/^233precover/,"precover"]];
const erRowFor=type=>{ const n=erNorm(type); if(ERMAP[n]) return ERMAP[n]; const f=ERFAMILY.find(([re])=>re.test(n)); return f?f[1]:null; };
const GRP_LABEL={permit:"Permit based",existing:"Existing building",actions:"Prevention actions",fss:"FSS",boarding:"Boarding homes"};

/* result read from the notes Emergency Reporting attaches to each inspection */
function erResult(notes,coi){ const n=String(notes||"").toLowerCase();
  if(/no fire and life safety issues were observed/.test(n)) return "pass";
  if(/fire and life safety issues were observed|outstanding hazards|once all corrections have been made|violations that are required to be remedied/.test(n)) return "fail";
  if(/conditional certificate of compliance/.test(n)) return "conditional";
  if(coi) return "pass";
  return "unknown"; }
const ER_RES_LABEL={pass:"Pass",fail:"Hazards found",conditional:"Conditional CO",unknown:"No result in notes"};
const erPill=r=>`<span class="pill ${r==="fail"?"s-failed":r==="pass"?"s-done":r==="conditional"?"s-due":"s-off"}">${ER_RES_LABEL[r]||r}</span>`;
const hmsMin=s=>{ const m=String(s||"").match(/(\d+):(\d\d)(?::(\d\d))?/); return m?(+m[1])*60+(+m[2])+(m[3]?+m[3]/60:0):0; };
const fmtH=min=>min>=60?`${Math.floor(min/60)}h ${String(Math.round(min%60)).padStart(2,"0")}m`:`${Math.round(min)}m`;
function erPersonName(s){ const m=String(s||"").match(/^\s*([^,]+),\s*(.+)$/); return (m?`${m[2]} ${m[1]}`:String(s||"")).replace(/\s+/g," ").trim(); }
function addrKey(a){ const m=String(a||"").toLowerCase().match(/^\s*(\d+)\s+(?:[nsew]\.?\s+)?([a-z0-9]+)/); return m?m[1]+" "+m[2]:null; }
function bestFac(M,name,addr,filter){ const nt=tokens(name), ak=addrKey(addr); let best=null, bs=0;
  for(const f of M.facs){ if(filter&&!filter(f)) continue; const ft=tokens(f.name); let inter=0; nt.forEach(t=>{ if(ft.has(t)) inter++; });
    const same=!!ak&&addrKey(f.address)===ak; if(!inter&&!same) continue;
    let s=inter?inter/new Set([...nt,...ft]).size:0; if(same) s+=.6; if(s>bs){ bs=s; best=f; } }
  return bs>=.5?best:null; }

/* Parse one Emergency Reporting "Completed Inspections for Inspectors per Inspection Type" export (any grid of cell strings). */
function parseERGrid(grid,fileName){
  const out={file:fileName, inspectorRaw:"", start:null, end:null, rows:[], declared:{}, warnings:[]}; let type=null;
  for(const raw of grid){ const r=raw.map(x=>String(x??"").trim()); const a=r[0]||"";
    let m=a.match(/Inspector:\s*(.*?)\s*\|\s*Start Date:\s*(\S+)\s*\|\s*End Date:\s*(\S+)/i);
    if(m){ if(out.inspectorRaw&&out.inspectorRaw!==m[1]) out.warnings.push("This file lists more than one inspector. Each person's rows are kept under their own name."); out.inspectorRaw=out.inspectorRaw||m[1]; out.start=normDate(m[2]); out.end=normDate(m[3]); out.cur=m[1]; continue; }
    m=a.match(/^Inspection Type:\s*(.*)$/i); if(m){ type=m[1].trim(); continue; }
    if(/^TOTAL # INSPECTIONS/i.test(a)){ out.declared.count=+(r.filter(Boolean).pop()||0); continue; }
    if(/^TOTAL TIME FOR ALL/i.test(a)){ out.declared.time=r.filter(Boolean).pop(); continue; }
    if(/^TOTAL ADDITIONAL TIME/i.test(a)){ out.declared.add=r.filter(Boolean).pop(); continue; }
    if(type && /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d\d-\d\d/.test(r[3]||"") && (a||r[1])){ /* an inspection row: dated, under a type heading. IDs are sometimes typed oddly ("FMO- 201827", "387309721") */
      const notes=r[7]||""; const cm=notes.match(/Certificate of Inspection number for this Inspection is\s*([0-9]{4}-[0-9]+)/i); const coi=cm?cm[1]:"";
      const date=normDate(r[3]); const tin=r[4], tout=r[5]; let mins=hmsMin(tout)-hmsMin(tin); if(mins<0) mins+=1440;
      const addr=String(r[2]||"").split(/\n/).map(s=>s.trim()).filter(Boolean);
      const id=a.replace(/\s+/g,""), idOk=/^FMO-\d+$/i.test(id); if(!idOk) (out.oddIds=out.oddIds||[]).push(`${a||"(blank)"} at ${r[1]}`);
      out.rows.push({id:idOk?id.toUpperCase():(/^\d+$/.test(id)?"FMO-"+id:id||"(no ID)"), occ:r[1].replace(/\s*\(MAIN PAGE\)\s*/i," ").trim(), addr:addr[0]||"", city:addr[1]||"", date, tin:tin.slice(0,5), tout:tout.slice(0,5), mins:Math.round(mins), add:Math.round(hmsMin(r[6])),
        type:type||"(no type)", row:erRowFor(type), coi, res:erResult(notes,coi), insp:out.cur||""});
    } }
  out.rows.forEach((x,i)=>{ x.k=`${x.id}|${x.date}|${erNorm(x.type)}|${x.tin}|${i}`; });
  if(out.declared.count!=null && out.declared.count!==out.rows.length) out.warnings.push(`The report footer says ${out.declared.count} inspections but ${out.rows.length} rows were read.`);
  if(out.oddIds) out.warnings.push(`Occupancy ID typed off-format in Emergency Reporting, read anyway: ${out.oddIds.join("; ")}. Worth correcting at the source so the occupancy history stays linked.`);
  if(!out.rows.length) out.warnings.push("No inspection rows were found. Is this the Completed Inspections for Inspectors per Inspection Type report?");
  const bad=[...new Set(out.rows.filter(x=>!x.row).map(x=>x.type))]; if(bad.length) out.warnings.push(`Not on the board: ${bad.join(", ")}. These count in the inspector totals but fill no board line.`);
  return out; }

/* match ER rows to tracker facilities; decide which count toward the school rotation */
/* which tracker facility an ER row belongs to. Daycare lines match daycares; everything else prefers the school campus over a daycare at the same address */
function erFacFor(M,x){ const b=BROW[x.row]||{}; if(b.rot==="daycare") return bestFac(M,x.occ,x.addr,f=>f.type==="Daycare");
  return bestFac(M,x.occ,x.addr,f=>f.type!=="Daycare")||(b.rot?null:bestFac(M,x.occ,x.addr,null)); }
const ERFAC={rev:-1,m:{}};
function erLive(r){ if(ERFAC.rev!==S._rev){ ERFAC.rev=S._rev; ERFAC.m={}; } if(r.rot) return r;
  if(!(r.k in ERFAC.m)){ const f=erFacFor(model(),r); ERFAC.m[r.k]=f?[f.id,f.orgId]:[null,null]; } const [fac,org]=ERFAC.m[r.k]; return fac===r.fac?r:Object.assign({},r,{fac,org}); }
/* County: inspectors' 233 work keeps its 233 line, everything else is County Buildings Annual; FSS specialists' inspections are FSS Activities, Inspections */
function erRowForPerson(type,insp){ const row=erRowFor(type); const tid=teamIdFor(erPersonName(insp)); const t=tid&&S.team[tid]; if(!t||divOf(t)!=="county") return row;
  if(t.role==="specialist") return "fss4"; return /^\s*233/.test(type)?row:"county"; }
const erDivFor=team=>team&&S.team[team]?divOf(S.team[team]):"education";
function erPlan(P){ const M=model();
  P.rows.forEach(x=>{ x.row=erRowForPerson(x.type,x.insp); const b=BROW[x.row]||{};
    const f=erFacFor(M,x); x.fac=f?f.id:null; x.org=f?f.orgId:null;
    x.rotation=!!(f&&b.rot); x.include=x.rotation; }); }

let ERI=null; // import session {files:[parsed], busy}
function loadSheetJS(){ if(window.XLSX) return Promise.resolve(window.XLSX); return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=ER_LIB; s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error("lib")); document.head.appendChild(s); }); }
async function readERFile(file){
  const name=file.name; const low=name.toLowerCase();
  if(/\.(csv|txt)$/.test(low)) return parseERGrid(parseCSV(await file.text()),name);
  const XL=await loadSheetJS(); const wb=XL.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]]; const grid=XL.utils.sheet_to_json(ws,{header:1,raw:false,defval:""});
  return parseERGrid(grid,name); }
function erDocId(month,inspName){ const tid=teamIdFor(erPersonName(inspName)); return `${month}__${tid||slug(erPersonName(inspName))}`; }
/* split a parsed file into month × inspector groups (one stored document each) */
function erGroups(P){ const g={}; P.rows.forEach(x=>{ const mo=(x.date||"").slice(0,7); if(!mo) return; const id=erDocId(mo,x.insp); (g[id]=g[id]||{id,month:mo,inspName:erPersonName(x.insp),team:teamIdFor(erPersonName(x.insp)),rows:[]}).rows.push(x); }); return Object.values(g); }

function openERImport(){ ERI={files:[],busy:false}; renderERI(); }
function renderERI(){
  const files=ERI.files; let body;
  if(!files.length) body=`<div class="erdrop"><p style="margin:0">Choose the <b>Completed Inspections for Inspectors per Inspection Type</b> reports exported from Emergency Reporting, one per inspector. Select several at once. The .xls files work as saved.</p>
    <input type="file" id="erfiles" multiple accept=".xls,.xlsx,.csv"><p class="faint" style="margin:0;font-size:12px">Nothing saves until you review and press Save. Importing a month again for the same inspector replaces that month, so a corrected export never double counts.</p>${ERI.busy?`<p class="muted" style="margin:0">Reading files…</p>`:""}${ERI.err?`<div class="notice">${esc(ERI.err)}</div>`:""}</div>`;
  else { const M=model(); const groups=files.flatMap(erGroups);
    const rotRows=files.flatMap(P=>P.rows.filter(x=>x.rotation));
    const known=new Set(M.visits.filter(v=>!v.voided&&v.coi).map(v=>v.coi)), keyed=new Set(M.visits.filter(v=>!v.voided).map(v=>v.facility+"|"+v.date));
    rotRows.forEach(x=>{ x.dup=(x.coi&&known.has(x.coi))||keyed.has(x.fac+"|"+x.date); if(x.dup) x.include=false; });
    body=`<div class="erfiles">${files.map((P,i)=>{ const n=P.rows.length, ty={}; P.rows.forEach(x=>ty[x.type]=(ty[x.type]||0)+1);
      const tid=teamIdFor(erPersonName(P.inspectorRaw)); const ok=P.declared.count==null||P.declared.count===n;
      return `<div class="erfile"><div class="erfh"><b>${esc(erPersonName(P.inspectorRaw)||"Unknown inspector")}</b>${tid?"":`<span class="pill s-due">Not on the team list</span>`}<span class="faint">${P.start?fmtDate(P.start):"?"} to ${P.end?fmtDate(P.end):"?"}</span><span class="sp"></span><span class="mono">${n} inspections</span>${ok?`<span class="pill s-done" title="Matches the report footer">✓ footer</span>`:""}<button class="btn sm ghost" data-act="er-dropfile" data-i="${i}" type="button" aria-label="Remove file">✕</button></div>
        <div class="faint" style="font-size:12px">${esc(P.file)}</div>
        <div class="ertypes">${Object.entries(ty).sort((a,b)=>b[1]-a[1]).map(([t,c])=>`<span class="tag ${erRowFor(t)?"":"warn"}">${esc(t)} · ${c}</span>`).join("")}</div>
        ${P.warnings.map(w=>`<div class="notice">${esc(w)}</div>`).join("")}</div>`; }).join("")}</div>
      ${groups.some(g=>S.er[g.id])?`<div class="notice">Already imported, will be replaced: ${groups.filter(g=>S.er[g.id]).map(g=>`${esc(g.inspName)} for ${MON3[+g.month.slice(5)-1]} ${g.month.slice(0,4)} (${S.er[g.id].rows.length} rows, ${fmtDate((S.er[g.id].importedAt||"").slice(0,10))})`).join("; ")}.</div>`:""}
      <div><span class="eyebrow">School visits that count toward coverage</span><p class="faint" style="margin:4px 0 8px;font-size:12.5px">Annual school inspections and licensed daycare inspections that match a school in the tracker are added to that school's record as a visit. Construction inspections (233 types) at schools are linked to the school's activity but do not count toward the rotation.</p>
      ${rotRows.length?`<div class="tablewrap"><table class="t"><thead><tr><th></th><th>Date</th><th>In Emergency Reporting</th><th>Tracker school</th><th>Result</th></tr></thead><tbody>${rotRows.map(x=>{ const f=M.byId[x.fac]; return `<tr><td><input type="checkbox" data-erx="${esc(x.k)}" ${x.include?"checked":""} ${x.dup?"disabled":""} aria-label="Add this visit"></td><td class="mono">${fmtDate(x.date)}</td><td>${esc(x.occ)}<div class="faint" style="font-size:12px">${esc(x.type)} · ${esc(erPersonName(x.insp))}</div></td><td>${f?`${esc(f.name)}<div class="faint" style="font-size:12px">${esc(f.org.name)}</div>`:""}${x.dup?`<div class="faint" style="font-size:12px">Already on file${x.coi?" (COI "+esc(x.coi)+")":""}</div>`:""}</td><td>${erPill(x.res)}${x.coi?` <span class="mono">${esc(x.coi)}</span>`:""}</td></tr>`; }).join("")}</tbody></table></div>`:`<div class="faint" style="font-size:12.5px">None in these files.</div>`}</div>
      <div class="faint" style="font-size:12.5px">${files.reduce((s,P)=>s+P.rows.filter(x=>x.fac&&!x.rotation).length,0)} other inspections matched a school and will show in its activity.</div>
      <input type="file" id="erfiles" multiple accept=".xls,.xlsx,.csv" aria-label="Add more files">`; }
  const n=files.reduce((s,P)=>s+P.rows.length,0), v=files.reduce((s,P)=>s+P.rows.filter(x=>x.include).length,0);
  openModal(`<div class="mh"><h2>Import from Emergency Reporting</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb">${body}</div>
    <div class="mf"><button class="btn" data-close="1" type="button">Cancel</button>${files.length&&S.canWrite?`<button class="btn primary" data-act="er-save" type="button">Save ${n} inspections${v?` + ${v} school visit${v>1?"s":""}`:""}</button>`:""}</div>`,true);
}
async function erAddFiles(list){ ERI.busy=true; ERI.err=null; renderERI();
  for(const f of list){ try{ const P=await readERFile(f); erPlan(P); ERI.files.push(P); }catch(e){ ERI.err=e&&e.message==="lib"?"The spreadsheet reader could not load. Save the report as CSV from Excel and choose that instead.":`${f.name} could not be read.`; } }
  ERI.busy=false; renderERI(); }
async function erSave(){
  const groups=ERI.files.flatMap(erGroups); const now=new Date().toISOString(); const vlist=[];
  const keep=x=>({k:x.k,id:x.id,occ:x.occ,addr:x.addr,city:x.city,date:x.date,tin:x.tin,tout:x.tout,mins:x.mins,add:x.add,type:x.type,row:x.row,coi:x.coi||"",res:x.res,fac:x.fac||null,org:x.org||null,rot:x.rotation&&x.include?true:false,...(x.src?{src:x.src,rt:x.rt||"",fl:x.fl||[],nx:x.nx||null,po:x.inExport===false}:{})});
  ERI.files.forEach(P=>P.rows.filter(x=>x.include&&x.fac).forEach(x=>{ const b=BROW[x.row]||{};
    const rec={facility:x.fac,date:x.date,kind:b.follow?"reinspection":"initial",result:x.res==="conditional"?"partial":x.res,coi:x.coi||undefined,inspector:teamIdFor(erPersonName(x.insp))||undefined,
      notes:`${x.type} · ${x.id}`,source:"Emergency Reporting",erKey:x.k,loggedBy:S.me.id||undefined,loggedAt:now};
    Object.keys(rec).forEach(k=>rec[k]===undefined&&delete rec[k]); vlist.push({orgId:x.org,year:yearOf(x.date),vid:uid("e"),rec}); }));
  const ok=await write(async()=>{ for(const g of groups){ const P=ERI.files.find(p=>p.rows.includes(g.rows[0]));
      await S.db.doc("er/"+g.id).set({division:erDivFor(g.team),month:g.month,inspector:g.team||null,inspectorName:g.inspName,file:P.file,period:{start:P.start,end:P.end},importedAt:now,importedBy:S.me.id||null,importedByName:S.me.name||"",rows:g.rows.map(keep)}); }
    if(vlist.length) await saveVisits(vlist); },`Saved ${groups.reduce((s,g)=>s+g.rows.length,0)} inspections${vlist.length?` and ${vlist.length} school visits`:""}`);
  if(ok){ const mo=groups.map(g=>g.month).sort().pop(); if(mo) S.ui.st.month=mo; ERI=null; closeModal(); if(location.hash!=="#stats") location.hash="stats"; else render(); } }

/* ---- monthly numbers */
function statDoc(div,year){ return S.stats[`${div}-${year}`]||{}; }
function erRowsFor(month,div){ return Object.values(S.er).filter(d=>d.month===month&&(d.division||"education")===div).flatMap(d=>d.rows.map(r=>Object.assign({insp:d.inspector||d.inspectorName,inspName:d.inspectorName,member:d.inspector},erLive(r)))); }
function erDocsFor(month,div){ return Object.entries(S.er).filter(([,d])=>d.month===month&&(d.division||"education")===div).map(([id,d])=>Object.assign({id},d)); }
/* value grid for a calendar year: leaf values from ER (when that month has imports), manual entries, or the board as entered */
function yearGrid(div,year){
  const D=statDoc(div,year), out={v:{},src:{},board:{},er:{}};
  for(let i=0;i<12;i++){ const mo=`${year}-${String(i+1).padStart(2,"0")}`, mm=mo.slice(5); const ers=erRowsFor(mo,div); const hasER=ers.length>0;
    const cnt={}; ers.forEach(r=>{ if(r.row) cnt[r.row]=(cnt[r.row]||0)+1; }); const tl=div==="education"?teamLogSums(mo):{any:false,k:{}}, ac=actionSums(mo,div);
    BOARD.filter(b=>!b.sum).forEach(b=>{ const bv=D.board&&D.board[b.k]&&D.board[b.k][mm]; const mv=D.manual&&D.manual[b.k]&&D.manual[b.k][mm];
      (out.board[b.k]=out.board[b.k]||[])[i]=bv??null; const erOK=b.er&&(!b.erDiv||b.erDiv===div); (out.er[b.k]=out.er[b.k]||[])[i]=hasER&&erOK?(cnt[b.k]||0):null;
      let v=null, s="none";
      if(erOK&&hasER){ v=cnt[b.k]||0; s="er"; } else if(b.manual&&mv!=null){ v=mv; s="manual"; } else if(b.manual&&ac.any&&ACT_LINES.includes(b.k)){ v=ac.k[b.k]||0; s="act"; } else if(b.manual&&tl.any){ v=tl.k[b.k]||0; s="team"; } else if(bv!=null){ v=bv; s="board"; }
      (out.v[b.k]=out.v[b.k]||[])[i]=v; (out.src[b.k]=out.src[b.k]||[])[i]=s; }); }
  const calc=k=>{ const b=BROW[k]; if(!b.sum) return out.v[k]; if(out.v[k]) return out.v[k]; const arr=[]; for(let i=0;i<12;i++){ let s=null; b.sum.forEach(c=>{ const x=calc(c)[i]; if(x!=null) s=(s||0)+x; }); arr[i]=s; } out.v[k]=arr; return arr; };
  BOARD.forEach(b=>calc(b.k)); return out; }
const sumTo=(arr,i)=>{ let s=null; for(let j=0;j<=i;j++) if(arr[j]!=null) s=(s||0)+arr[j]; return s; };
function projected(ytd,month){ if(ytd==null) return null; const [y,m]=month.split("-").map(Number); const t=todayISO(); const end=t.slice(0,7)===month?t:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
  const doy=(Date.parse(end)-Date.UTC(y,0,1))/864e5+1; const len=(y%4===0)?366:365; return Math.round(ytd*len/doy); }
function statMonths(){ const set=new Set(Object.values(S.er).map(d=>d.month)); Object.values(S.stats).forEach(d=>{ [d.board,d.manual].forEach(g=>{ if(!g) return; Object.values(g).forEach(o=>Object.entries(o||{}).forEach(([mm,v])=>{ if(v!=null) set.add(`${d.year}-${mm}`); })); }); });
  const t=todayISO().slice(0,7); set.add(t); return [...set].filter(m=>m<=t).sort().reverse(); }
function defaultMonth(){ const er=Object.values(S.er).map(d=>d.month).sort().pop(); if(er) return er; const d=new Date(); d.setDate(0); return d.toISOString().slice(0,7); }

/* outcomes from the ER rows of a month, plus the follow-through across every imported month */
function erOutcomes(month,div){
  const rows=erRowsFor(month,div); const known=rows.filter(r=>r.res!=="unknown");
  const first=rows.filter(r=>!(BROW[r.row]||{}).follow&&r.res!=="unknown"), fu=rows.filter(r=>(BROW[r.row]||{}).follow);
  const all=Object.values(S.er).filter(d=>(d.division||"education")===div&&d.month<=month).flatMap(d=>d.rows.map(r=>Object.assign({inspName:d.inspectorName},r))).filter(r=>r.res!=="unknown").sort((a,b)=>a.date.localeCompare(b.date)||a.tin.localeCompare(b.tin));
  const by={}; all.forEach(r=>{ (by[r.id+"|"+erNorm(r.occ)]=by[r.id+"|"+erNorm(r.occ)]||[]).push(r); });
  const end=todayISO().slice(0,7)===month?todayISO():new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
  const open=[], cleared=[];
  Object.values(by).forEach(list=>{ let failAt=null; list.forEach(r=>{ if(r.res==="fail"){ if(!failAt) failAt=r; } else if(failAt){ if(r.date.slice(0,7)===month) cleared.push({r,from:failAt,days:days(failAt.date,r.date)}); failAt=null; } });
    if(failAt) open.push({r:list[list.length-1],from:failAt,days:days(failAt.date,end)}); });
  const schools=new Set(rows.filter(r=>r.fac).map(r=>r.fac));
  return {rows,known,first,fu,open:open.sort((a,b)=>b.days-a.days),cleared,schools,
    pass:rows.filter(r=>r.res==="pass").length, fail:rows.filter(r=>r.res==="fail").length, cond:rows.filter(r=>r.res==="conditional").length, unk:rows.filter(r=>r.res==="unknown").length,
    coi:rows.filter(r=>r.coi).length, firstFail:first.filter(r=>r.res==="fail").length, fuClear:fu.filter(r=>r.res==="pass"||r.res==="conditional").length,
    mins:rows.reduce((s,r)=>s+(r.mins||0),0), add:rows.reduce((s,r)=>s+(r.add||0),0)}; }

function vStats(M){
  const st=S.ui.st; if(!st.month) st.month=defaultMonth(); const month=st.month, year=+month.slice(0,4), i=+month.slice(5)-1, div=st.div;
  const G=yearGrid(div,year), D=statDoc(div,year), docs=erDocsFor(month,div), O=erOutcomes(month,div), hasER=O.rows.length>0;
  const prevMo=i>0?i-1:null; const val=k=>G.v[k][i], prev=k=>prevMo==null?null:G.v[k][prevMo];
  const delta=(a,b)=>a==null||b==null||b===0?"":`<span class="delta ${a>=b?"up":"down"}">${a>=b?"+":""}${a-b} vs ${MON3[prevMo]}</span>`;
  const mlabel=`${["January","February","March","April","May","June","July","August","September","October","November","December"][i]} ${year}`;
  const ytdAll=sumTo(G.v.all,i), projAll=projected(ytdAll,month);
  const months=statMonths(); if(!months.includes(month)) months.unshift(month);
  const divChips=DIVISIONS.map(([k,l,on])=>`<button class="chip" type="button" ${on?`data-stdiv="${k}"`:"disabled"} aria-pressed="${div===k}" title="${on?"":"Set up after Education is proven"}">${l}</button>`).join("");
  /* tiles */
  const tile=(lbl,v,sub,extra)=>`<div class="stt"><span class="eyebrow">${lbl}</span><b class="num">${v??"–"}</b><span class="sub">${sub||""}</span>${extra||""}</div>`;
  const tiles=`<div class="sttiles">
    ${tile("All prevention services",val("all"),`YTD ${ytdAll??"–"} · on pace for ${projAll??"–"}`,delta(val("all"),prev("all")))}
    ${tile("Fire inspections",val("fire"),`${val("permit")??0} permit based · ${val("existing")??0} existing building`,delta(val("fire"),prev("fire")))}
    ${tile("Prevention actions",val("actions"),G.src.assist[i]==="manual"?"monthly entry":G.src.assist[i]==="act"?`from action codes, ${actionSums(month,div).people} people`:G.src.assist[i]==="team"?(n=>`from ${n} ${n===1?"person's log":"people's logs"}`)(teamLogSums(month).people):G.src.assist[i]==="board"?"from the board":"not entered yet",delta(val("actions"),prev("actions")))}
    ${tile("Hazards found",hasER?O.fail:"–",hasER?`${O.known.length?pct(O.fail/O.known.length):"–"} of inspections with a result`:"needs an Emergency Reporting import")}
    ${tile("Field time",hasER?fmtH(O.mins):"–",hasER?`on site · plus ${fmtH(O.add)} additional`:"needs an Emergency Reporting import")}
  </div>`;
  /* outcomes */
  const outcomes=hasER?`<section class="panel"><div class="ph"><h3>What the work produced</h3><span class="faint">${mlabel} · from ${O.rows.length} Emergency Reporting inspections</span></div><div class="pb"><div class="outgrid">
    <div class="oc"><b>${O.first.length?pct(1-O.firstFail/O.first.length):"–"}</b><span>passed on the first visit</span><small>${O.first.length-O.firstFail} of ${O.first.length} first-time inspections with a result</small></div>
    <div class="oc"><b>${O.fuClear}<span class="of"> of ${O.fu.length}</span></b><span>follow-ups found the hazards corrected</span><small>${O.fu.length-O.fuClear} still had hazards or no result</small></div>
    <div class="oc"><b>${O.coi+O.cond}</b><span>certificates issued</span><small>${O.coi} certificates of inspection · ${O.cond} conditional COs</small></div>
    <div class="oc"><b>${O.schools.size}</b><span>schools in the tracker touched</span><small>${O.rows.filter(r=>r.rot).length} counted toward school coverage</small></div>
    <div class="oc"><b>${O.cleared.length?Math.round(median(O.cleared.map(c=>c.days)))+"d":"–"}</b><span>median days from hazard to correction</span><small>${O.cleared.length?`${O.cleared.length} cleared this month`:"Fills in as follow-ups across months are imported"}</small></div>
    <div class="oc ${O.open.length?"warn":""}"><b>${O.open.length}</b><span>locations with hazards still open</span><small>last result on file is a failed inspection</small></div>
  </div>${O.open.length?`<details class="opens"><summary>Open hazards (${O.open.length})</summary><div class="tablewrap"><table class="t"><thead><tr><th>Location</th><th>Found</th><th class="r">Days open</th><th>Inspector</th><th>Last type</th></tr></thead><tbody>${O.open.map(o=>`<tr ${o.r.fac?`class="click" data-fac="${esc(o.r.fac)}"`:""}><td>${esc(o.r.occ)}<div class="faint" style="font-size:12px">${esc(o.r.addr)}</div></td><td class="mono">${fmtDate(o.from.date)}</td><td class="r mono">${o.days}</td><td>${esc(o.r.inspName||"")}</td><td class="faint">${esc(o.r.type)}</td></tr>`).join("")}</tbody></table></div></details>`:""}
  ${O.unk?`<p class="method">${O.unk} inspection${O.unk>1?"s":""} had no result Emergency Reporting could state (no certificate number and no hazard wording in the notes). These are mostly underground and pre-cover checks. They count in every total but not in the pass and fail rates.</p>`:""}</div></section>`:
  `<section class="panel"><div class="pb empty">No Emergency Reporting files imported for ${mlabel}. The board below shows the numbers as they were entered by hand.${S.canWrite?` <button class="btn sm primary" data-act="er-import" type="button">Import files</button>`:""}</div></section>`;
  /* reconcile */
  const leaf=BOARD.filter(b=>b.er); const diffs=leaf.filter(b=>G.board[b.k][i]!=null&&G.er[b.k][i]!=null&&G.board[b.k][i]!==G.er[b.k][i]);
  const comparable=leaf.filter(b=>G.board[b.k][i]!=null&&G.er[b.k][i]!=null&&(G.board[b.k][i]||G.er[b.k][i]));
  const bTot=leaf.reduce((s,b)=>s+(G.board[b.k][i]||0),0), eTot=leaf.reduce((s,b)=>s+(G.er[b.k][i]||0),0);
  const boardHas=leaf.some(b=>G.board[b.k][i]!=null);
  const files=docs.length?`<div class="erchips">${docs.sort((a,b)=>a.inspectorName.localeCompare(b.inspectorName)).map(d=>`<span class="tag">${esc(d.inspectorName)} · ${d.rows.length}</span>`).join("")}${Object.entries(S.team).filter(([id,t])=>isField(t)&&divOf(t)==="education"&&!docs.some(d=>d.inspector===id)).map(([,t])=>`<span class="tag warn">${esc(t.name)} · no file</span>`).join("")}</div>`:"";
  const reconcile=hasER?`<section class="panel"><div class="ph"><h3>Emergency Reporting check</h3><span class="faint">${docs.length} file${docs.length>1?"s":""} imported</span><span class="sp"></span>${S.canWrite?`<button class="btn sm" data-act="er-import" type="button">Import more</button>`:""}</div><div class="pb" style="display:flex;flex-direction:column;gap:10px">${files}
    ${boardHas?`<div class="recon ${diffs.length?"":"ok"}"><b>${eTot} in Emergency Reporting · ${bTot} on the board as entered</b><span>${diffs.length?`${comparable.length-diffs.length} of ${comparable.length} inspection lines match. The gap of ${bTot-eTot} usually means a file is missing or an inspection was entered after the export.`:`Every inspection line matches the board.`}</span></div>
    ${diffs.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Line</th><th class="r">Board</th><th class="r">Emergency Reporting</th><th class="r">Gap</th></tr></thead><tbody>${diffs.map(b=>`<tr><td>${esc(b.label)}</td><td class="r mono">${G.board[b.k][i]}</td><td class="r mono">${G.er[b.k][i]}</td><td class="r mono">${G.board[b.k][i]-G.er[b.k][i]>0?"+":""}${G.board[b.k][i]-G.er[b.k][i]}</td></tr>`).join("")}</tbody></table></div>`:""}`:`<p class="faint" style="margin:0;font-size:12.5px">No hand-entered board numbers for this month to compare against. Emergency Reporting is the source.</p>`}
    <p class="method">Inspection lines on the board below use the Emergency Reporting counts for any month that has an import. Prevention action lines come from a monthly entry if one was made, otherwise the action-code report, otherwise the team's own log.</p></div></section>`:"";
  /* inspectors */
  const insp={}; O.rows.forEach(r=>{ const k=r.inspName||"Unknown"; const o=insp[k]=insp[k]||{n:0,permit:0,existing:0,pass:0,fail:0,cond:0,unk:0,mins:0,add:0,schools:new Set()}; o.n++; const g=(BROW[r.row]||{}).grp; if(g==="permit") o.permit++; else if(g==="existing") o.existing++; o[r.res==="conditional"?"cond":r.res==="unknown"?"unk":r.res]++; o.mins+=r.mins||0; o.add+=r.add||0; if(r.fac) o.schools.add(r.fac); });
  const inspT=hasER?`<section class="panel"><div class="ph"><h3>By inspector</h3><span class="faint">${mlabel}</span></div><div class="tablewrap"><table class="t"><thead><tr><th>Inspector</th><th class="r">Inspections</th><th class="r">Permit</th><th class="r">Existing</th><th class="r">Pass</th><th class="r">Hazards</th><th class="r">Cond. CO</th><th class="r">No result</th><th class="r">On site</th><th class="r">Avg / insp.</th><th class="r">Schools</th></tr></thead><tbody>
    ${Object.entries(insp).sort((a,b)=>b[1].n-a[1].n).map(([k,o])=>`<tr><td ${teamIdFor(k)?`data-person="${esc(teamIdFor(k))}" style="cursor:pointer"`:""}>${avatar(teamIdFor(k)||k,24)} ${esc(k)}</td><td class="r mono"><b>${o.n}</b></td><td class="r mono">${o.permit}</td><td class="r mono">${o.existing}</td><td class="r mono">${o.pass}</td><td class="r mono">${o.fail}</td><td class="r mono">${o.cond}</td><td class="r mono">${o.unk}</td><td class="r mono">${fmtH(o.mins)}</td><td class="r mono">${Math.round(o.mins/o.n)}m</td><td class="r mono">${o.schools.size}</td></tr>`).join("")}</tbody></table></div></section>`:"";
  /* board */
  const qMonth=j=>j===i?"cur":(j>i?"fut":"");
  const cell=(b,j)=>{ const v=G.v[b.k][j], s=b.sum?"":G.src[b.k][j]; return `<td class="r mono ${qMonth(j)} src-${s}" ${s==="er"?'title="From Emergency Reporting"':s==="manual"?'title="Monthly entry"':s==="team"?'title="Sum of the team\'s own log entries"':s==="act"?'title="From the action-code report"':""}>${v==null?"":v}</td>`; };
  const ytd=b=>b.measure?"":sumTo(G.v[b.k],i)??"";
  const boardT=`<section class="panel"><div class="ph"><h3>${DIVISIONS.find(d=>d[0]===div)[1]} board · ${year}</h3><span class="legend-line"><span><i class="dot" style="background:var(--accent)"></i>Emergency Reporting</span><span><i class="dot" style="background:var(--act)"></i>Action codes</span><span><i class="dot" style="background:var(--un)"></i>Team log</span><span><i class="dot" style="background:var(--ok)"></i>Monthly entry</span><span><i class="dot" style="background:var(--ink3)"></i>Board as entered</span></span><span class="sp"></span>${S.canWrite?`<button class="btn sm" data-act="st-manual" type="button">Enter ${MON3[i]} actions</button>`:""}<button class="btn sm" data-act="st-export" type="button">Board (.csv)</button></div>
    <div class="tablewrap boardwrap"><table class="t sboard"><thead><tr><th>Line</th>${MON3.map((m,j)=>`<th class="r ${qMonth(j)}">${m}</th>`).join("")}<th class="r">YTD</th><th class="r">Projected</th></tr></thead><tbody>
    ${BOARD.map(b=>`<tr class="lv${b.lvl} ${b.sum?"tot":""} ${b.measure?"meas":""}"><td>${esc(b.label)}</td>${MON3.map((_,j)=>cell(b,j)).join("")}<td class="r mono"><b>${ytd(b)}</b></td><td class="r mono">${b.measure?"":projected(sumTo(G.v[b.k],i),month)??""}</td></tr>`).join("")}
    </tbody></table></div>${(D.boardIssues||[]).length?`<div class="pb"><span class="eyebrow">Problems found in the workbook</span><ul class="issues">${D.boardIssues.map(x=>`<li><span class="mono">${esc(x.cell)}</span> ${esc(x.note)}</li>`).join("")}</ul></div>`:""}</section>`;
  /* trend */
  const upto=MON3.slice(0,Math.max(i+1,1));
  const trend=`<section class="panel"><div class="ph"><h3>Inspections by month</h3><span class="faint">${year}</span></div><div class="pb">${barsSVG([{name:"Permit based",color:"var(--accent)",values:upto.map((_,j)=>G.v.permit[j]||0)},{name:"Existing building",color:"var(--ok)",values:upto.map((_,j)=>G.v.existing[j]||0)},{name:"Prevention actions",color:"var(--due)",values:upto.map((_,j)=>G.v.actions[j]||0)}],upto)}</div></section>`;
  /* log */
  const LR=O.rows.filter(r=>(st.insp==="all"||r.inspName===st.insp)&&(st.res==="all"||r.res===st.res)).sort((a,b)=>a.date.localeCompare(b.date)||a.tin.localeCompare(b.tin));
  const log=hasER?`<section class="panel"><details ${st.log?"open":""} id="stlog"><summary class="ph"><h3>Inspection log</h3><span class="faint">${O.rows.length} inspections</span></summary>
    <div class="pb" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><select id="st-insp"><option value="all">Every inspector</option>${Object.keys(insp).sort().map(k=>`<option ${st.insp===k?"selected":""}>${esc(k)}</option>`).join("")}</select><select id="st-res"><option value="all">Any result</option>${Object.entries(ER_RES_LABEL).map(([k,l])=>`<option value="${k}" ${st.res===k?"selected":""}>${l}</option>`).join("")}</select><span class="faint">${LR.length} shown</span></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Inspector</th><th>Type</th><th>Occupancy</th><th>Result</th><th class="r">On site</th><th>Tracker</th></tr></thead><tbody>
    ${LR.map(r=>{ const f=M.byId[r.fac]; return `<tr ${f?`class="click" data-fac="${esc(f.id)}"`:""}><td class="mono">${fmtDate(r.date)}<div class="faint">${esc(r.tin)}–${esc(r.tout)}</div></td><td>${esc(r.inspName||"")}</td><td class="faint">${esc(r.type)}</td><td>${esc(r.occ)}<div class="faint" style="font-size:12px">${esc(r.addr)} · <span class="mono">${esc(r.id)}</span></div></td><td>${erPill(r.res)}${r.coi?`<div class="mono faint" style="font-size:12px">COI ${esc(r.coi)}</div>`:""}${reportBadge(r)}</td><td class="r mono">${r.mins}m</td><td>${f?`${esc(f.name)}${r.rot?' <span class="tag">rotation</span>':""}`:""}</td></tr>`; }).join("")}</tbody></table></div></details></section>`:"";
  return `<div class="sechead sthead"><select id="st-month" aria-label="Month">${months.map(m=>`<option value="${m}" ${m===month?"selected":""}>${MON3[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("")}</select><div class="chips">${divChips}</div><span class="sp"></span>
    <button class="btn sm" data-act="st-copy" type="button">Copy debrief</button>${S.canWrite?`<button class="btn primary" data-act="er-import" type="button">Import Emergency Reporting</button>`:""}</div>
    ${div==="education"||div==="county"?attentionPanel(month,div):""}${tiles}<div class="stcols">${outcomes}${reconcile}</div>${inspT}${div==="education"||div==="county"?hoursPanel(month,div)+actionsPanel(month,div):""}${trend}${boardT}${div==="education"||div==="county"?uploadsPanel(year,div):""}${log}`;
}
function debriefText(){ const st=S.ui.st, month=st.month, year=+month.slice(0,4), i=+month.slice(5)-1, G=yearGrid(st.div,year), O=erOutcomes(month,st.div), v=k=>G.v[k][i]??0;
  const L=[`HCFMO Prevention Bureau · ${DIVISIONS.find(d=>d[0]===st.div)[1]} Division · Monthly statistics · ${MON3[i]} ${year}`,"",
    `All prevention services: ${v("all")} (YTD ${sumTo(G.v.all,i)??0}, on pace for ${projected(sumTo(G.v.all,i),month)??0} this year)`,
    `Fire inspections: ${v("fire")} (${v("permit")} permit based, ${v("existing")} existing building)`,`Prevention actions: ${v("actions")}`];
  if(O.rows.length){ L.push("",`Outcomes (${O.rows.length} inspections in Emergency Reporting):`,
    `  Passed on first visit: ${O.first.length?pct(1-O.firstFail/O.first.length):"n/a"} (${O.first.length-O.firstFail} of ${O.first.length})`,
    `  Hazards found: ${O.fail}; follow-ups with hazards corrected: ${O.fuClear} of ${O.fu.length}`,
    `  Certificates issued: ${O.coi} COIs, ${O.cond} conditional COs`,`  Locations with hazards still open: ${O.open.length}`,`  Time on site: ${fmtH(O.mins)} (plus ${fmtH(O.add)} additional)`,
    `  Schools in the tracker touched: ${O.schools.size}`); }
  return L.join("\n"); }
function stExport(){ const st=S.ui.st, year=+st.month.slice(0,4), i=+st.month.slice(5)-1, G=yearGrid(st.div,year);
  saveFile(`${st.div}-monthly-stats-${year}.csv`, csv([["Workbook row","Line",...MON3,"YTD","Projected"],...BOARD.map(b=>[b.r,b.label,...MON3.map((_,j)=>G.v[b.k][j]??""),b.measure?"":sumTo(G.v[b.k],i)??"",b.measure?"":projected(sumTo(G.v[b.k],i),st.month)??""])])); }
function openManual(){ const st=S.ui.st, month=st.month, year=+month.slice(0,4), i=+month.slice(5)-1, G=yearGrid(st.div,year);
  const rows=BOARD.filter(b=>b.manual); let grp="";
  openModal(`<div class="mh"><h2>${MON3[i]} ${year} · entries without an Emergency Reporting export</h2><button class="btn sm ghost" data-close="1" type="button" aria-label="Close">✕</button></div><div class="mb"><p class="faint" style="margin:0;font-size:12.5px">A number here overrides everything else for the month. Leave a line blank to use the team's own log entries${teamLogSums(month).any?` (shown in grey, from ${teamLogSums(month).people} people)`:""}, or the board as it was entered by hand.</p><div class="mangrid">
    ${rows.map(b=>{ const h=b.grp!==grp?(grp=b.grp,`<div class="manh eyebrow">${GRP_LABEL[b.grp]}</div>`):""; const D=statDoc(st.div,year); const mv=D.manual&&D.manual[b.k]&&D.manual[b.k][month.slice(5)]; const v=G.v[b.k][i]; return `${h}<label class="manrow"><span>${esc(b.label)}</span><input type="number" min="0" step="${b.measure?"0.1":"1"}" data-man="${b.k}" value="${mv??""}" placeholder="${v??""}"></label>`; }).join("")}</div></div>
    <div class="mf"><button class="btn" data-close="1" type="button">Cancel</button><button class="btn primary" data-act="st-manual-save" type="button">Save</button></div>`); }
async function saveManual(){ const st=S.ui.st, year=+st.month.slice(0,4), mm=st.month.slice(5), id=`${st.div}-${year}`; const manual={};
  document.querySelectorAll("[data-man]").forEach(el=>{ const v=el.value.trim(); manual[el.dataset.man]={[mm]:v===""?null:+v}; });
  const ref=S.db.doc("stats/"+id); const patch={manual,updatedAt:new Date().toISOString(),updatedBy:S.me.id||null};
  const ok=await write(async()=>{ if(S.stats[id]) await ref.update(patch); else { try{ await ref.update(patch); }catch(e){ if(e&&e.code==="invalid_argument") await ref.set(Object.assign({division:st.div,year},patch)); else throw e; } } },"Saved");
  if(ok) closeModal(); }
function erActivityHTML(fid){ const rows=Object.values(S.er).flatMap(d=>d.rows.map(erLive).filter(r=>r.fac===fid).map(r=>Object.assign({inspName:d.inspectorName},r))).sort((a,b)=>b.date.localeCompare(a.date));
  if(!rows.length) return ""; return `<div><span class="eyebrow">Emergency Reporting activity</span></div><div class="hist">${rows.map(r=>`<div class="h"><span class="mono">${fmtDate(r.date)}</span><span>${esc(r.type)} ${erPill(r.res)}${r.coi?` <span class="mono">COI ${esc(r.coi)}</span>`:""} ${reportBadge(r)}${r.rt?`<br><span>${esc(r.rt)}${r.nx?` · next ${esc(r.nx.t||"inspection")} ${fmtDate(r.nx.d)}`:""}</span>`:""}<br><span class="faint">${esc(r.inspName)} · ${esc(r.occ)} · <span class="mono">${esc(r.id)}</span>${r.rot?" · counted as a rotation visit":""}</span></span><span></span></div>`).join("")}</div>`; }

document.addEventListener("click", async e=>{ const t=e.target;
  const dv=t.closest("[data-stdiv]"); if(dv){ S.ui.st.div=dv.dataset.stdiv; render(); return; }
  const a=t.closest("[data-act]"); if(!a) return;
  switch(a.dataset.act){
    case "er-import": openERImport(); return;
    case "er-dropfile": ERI.files.splice(+a.dataset.i,1); renderERI(); return;
    case "er-save": a.disabled=true; await erSave(); a.disabled=false; return;
    case "st-manual": openManual(); return;
    case "st-manual-save": a.disabled=true; await saveManual(); a.disabled=false; return;
    case "st-export": stExport(); return;
    case "st-copy": { const txt=debriefText(); try{ await navigator.clipboard.writeText(txt); flash("Debrief copied"); }catch(err){ openModal(`<div class="mh"><h2>Debrief text</h2><button class="btn sm ghost" data-close="1" type="button">✕</button></div><div class="mb"><pre class="code">${esc(txt)}</pre></div>`); } return; }
  } });
document.addEventListener("change", e=>{ const t=e.target;
  if(t.id==="erfiles"&&t.files&&t.files.length){ erAddFiles([...t.files]); return; }
  if(t.dataset.erx&&ERI){ ERI.files.forEach(P=>P.rows.forEach(x=>{ if(x.k===t.dataset.erx) x.include=t.checked; })); const btn=$('[data-act="er-save"]'); if(btn){ const n=ERI.files.reduce((s,P)=>s+P.rows.length,0), v=ERI.files.reduce((s,P)=>s+P.rows.filter(x=>x.include).length,0); btn.textContent=`Save ${n} inspections${v?` + ${v} school visit${v>1?"s":""}`:""}`; } return; }
  if(t.id==="st-month"){ S.ui.st.month=t.value; render(); }
  if(t.id==="st-insp"){ S.ui.st.insp=t.value; S.ui.st.log=true; render(); }
  if(t.id==="st-res"){ S.ui.st.res=t.value; S.ui.st.log=true; render(); }
});
document.addEventListener("toggle", e=>{ if(e.target.id==="stlog") S.ui.st.log=e.target.open; }, true);

/* ---- hours worked and days worked (target: HOURS_TARGET average per day) */
function weekdaysIn(month){ const [y,m]=month.split("-").map(Number); const t=todayISO(); const last=t.slice(0,7)===month?+t.slice(8,10):new Date(Date.UTC(y,m,0)).getUTCDate(); let n=0; for(let d=1;d<=last;d++){ const w=new Date(Date.UTC(y,m-1,d)).getUTCDay(); if(w&&w<6) n++; } return n; }
function personHours(id,month){
  const er=Object.values(S.er).filter(d=>d.month===month&&d.inspector===id).flatMap(d=>d.rows);
  const erMin=er.reduce((s,r)=>s+(r.mins||0)+(r.add||0),0);
  const AH=actHours(id,month); const acts=logEntries(id,month); const actH=AH.any?AH.h:acts.reduce((s,e)=>s+(+e.h||0),0);
  const D=statDoc(S.team[id]?divOf(S.team[id]):"education",+month.slice(0,4)), mm=month.slice(5); const set=D.days&&D.days[id]&&D.days[id][mm];
  const all=D.daysAll&&D.daysAll[mm]; const days=set!=null?set:all!=null?all:DAYS_DEFAULT;
  const total=erMin/60+actH; return {er:er.length,erH:erMin/60,actH,actSrc:AH.any?"codes":acts.some(e=>e.h)?"log":null,actNoH:AH.noH,actMiss:AH.missByCode||{},total,days,daysSet:set!=null,perDay:days?total/days:0}; }
const DAYS_DEFAULT=20;
function hoursPanel(month,div){ div=div||"education";
  const i=+month.slice(5)-1, year=+month.slice(0,4); const people=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)===div).sort((a,b)=>a[1].name.localeCompare(b[1].name));
  if(!people.length) return "";
  const canSet=S.canWrite&&myTeamMember()&&["captain","lieutenant","sergeant"].includes(myTeamMember().role);
  const rows=people.map(([id])=>{ const h=personHours(id,month); const ex=hoursExempt(id); const c=ex?"var(--ink3)":h.perDay>=HOURS_TARGET?"var(--ok)":h.perDay>=HOURS_TARGET*.8?"var(--due)":"var(--bad)";
    return `<tr><td style="white-space:nowrap" data-person="${esc(id)}">${avatar(id,24)} ${esc(memberName(id))}</td><td class="r mono">${h.erH.toFixed(1)}</td><td class="r mono" title="${h.actSrc==="codes"?`From the action-code report${h.actNoH?`; ${h.actNoH} entries had no time written and count 15 minutes each`:""}`:h.actSrc==="log"?"From activity log entries":""}">${h.actH?h.actH.toFixed(1):"–"}${h.actSrc==="log"?"<sup>log</sup>":""}</td><td class="r mono"><b>${h.total.toFixed(1)}</b></td>
      <td class="r">${canSet?`<input type="number" class="daysin ${h.daysSet?"set":""}" min="0" max="31" step="0.5" value="${h.days}" data-days="${esc(id)}" aria-label="Days worked, ${esc(memberName(id))}">`:`<span class="mono">${h.days}</span>`}</td>
      <td><div class="hrsbar"><div class="meter thin" style="width:110px"><i style="width:${Math.min(100,h.perDay/8*100)}%;background:${c}"></i>${ex?"":`<span class="tick" style="left:calc(${HOURS_TARGET/8*100}% - 1px)"></span>`}</div><span class="mono" style="color:${c}">${h.perDay.toFixed(1)}</span>${ex?`<span class="tag" title="Supervisor, not held to the ${HOURS_TARGET} hour target">exempt</span>`:""}</div></td></tr>`; }).join("");
  const D=statDoc(div,year), allSet=D.daysAll&&D.daysAll[month.slice(5)];
  return `<section class="panel" id="hourspanel"><div class="ph"><h3>Hours worked</h3><span class="faint">${MON3[i]} ${year} · target ${HOURS_TARGET} hours per day on average</span><span class="sp"></span>${canSet?`<label class="faint" style="font-size:12.5px;display:flex;gap:6px;align-items:center">Days worked, whole team <input type="number" class="daysin ${allSet!=null?"set":""}" min="0" max="31" step="0.5" value="${allSet??DAYS_DEFAULT}" data-daysall="${esc(div)}" aria-label="Days worked for the whole team"></label>`:""}</div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Member</th><th class="r">Inspection hours</th><th class="r">Action-code hours</th><th class="r">Total</th><th class="r">Days worked</th><th>Hours per day</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="method" style="padding:0 16px 14px">Inspection hours are time on site plus additional time from the Emergency Reporting exports. Action-code hours are read from the hours written in each action-code entry ("- 2 hours", "30 min", "8:00 AM to 10:00 AM"); an entry with no time written counts as 15 minutes, and the person and code are listed under Needs attention so it gets fixed at the source. When no action-code report is loaded for a month, hours from activity log entries are used instead (marked log). Days worked start at ${DAYS_DEFAULT} for everyone${canSet?". Change the whole-team number at the top, or type over one person's number for leave, holidays or training. Bold means it was set by hand, and a person's own number wins over the team number. Hours per day recalculates right away":" and are adjusted by a sergeant or above"}.</p></section>`; }
async function saveDays(id,val,divAll){ const st=S.ui.st, year=+st.month.slice(0,4), mm=st.month.slice(5); const div=divAll||(S.team[id]?divOf(S.team[id]):"education"), docId=`${div}-${year}`; const v=val===""?null:Math.max(0,+val);
  const patch=Object.assign(divAll?{daysAll:{[mm]:v}}:{days:{[id]:{[mm]:v}}},{updatedAt:new Date().toISOString(),updatedBy:S.me.id||null}); const ref=S.db.doc("stats/"+docId);
  await write(async()=>{ if(S.stats[docId]) await ref.update(patch); else { try{ await ref.update(patch); }catch(e){ if(e&&e.code==="invalid_argument") await ref.set(Object.assign({division:div,year},patch)); else throw e; } } },divAll?`Days worked set to ${v??DAYS_DEFAULT} for the team`:`Days worked saved for ${memberName(id)}`); }
document.addEventListener("change", e=>{ const t=e.target; if(t.dataset&&t.dataset.days){ saveDays(t.dataset.days,t.value.trim()); } else if(t.dataset&&t.dataset.daysall){ saveDays(null,t.value.trim(),t.dataset.daysall); } });

/* ---- what has been uploaded, so nobody loads the same month twice */
function uploadsPanel(year,div){ div=div||"education";
  const people=Object.entries(S.team).filter(([,t])=>isField(t)&&divOf(t)===div).sort((a,b)=>a[1].name.localeCompare(b[1].name));
  const t=todayISO(), last=+t.slice(0,4)===year?+t.slice(5,7):12; const months=[]; for(let m=1;m<=last;m++) months.push(`${year}-${String(m).padStart(2,"0")}`);
  const cell=(id,mo)=>{ const d=S.er[`${mo}__${id}`], a=S.actions[`${mo}__${id}`]; if(!d&&!a) return `<td class="up none">–</td>`;
    return `<td class="up ok">${d?`<span title="Inspections: ${esc(d.file||"")} · loaded ${esc((d.importedAt||"").slice(0,10))}${d.importedByName?" by "+esc(d.importedByName):""}">✓ <span class="mono">${d.rows.length}</span></span>`:`<span class="none">–</span>`}${a?`<span class="upact" title="Action codes: ${esc(a.source||"")}">codes <span class="mono">${(a.rows||[]).length}</span></span>`:""}</td>`; };
  return `<section class="panel"><div class="ph"><h3>Uploads on file</h3><span class="faint">Emergency Reporting exports, ${year}</span></div>
    <div class="tablewrap"><table class="t uptable"><thead><tr><th>Member</th>${months.map(m=>`<th class="r">${MON3[+m.slice(5)-1]}</th>`).join("")}</tr></thead><tbody>
    ${people.map(([id])=>`<tr><td style="white-space:nowrap">${avatar(id,22)} ${esc(memberName(id))}</td>${months.map(m=>cell(id,m)).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="method" style="padding:0 16px 14px">A check means that person's inspection export for the month is loaded, with the count of inspections; "codes" means their action-code entries are loaded too; hover it to see the file, the date and who loaded it. Loading the same month again replaces it instead of adding to it, so a corrected export never double counts.</p></section>`; }
