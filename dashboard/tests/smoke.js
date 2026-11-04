// Smoke test: open every view of the built dashboard on the fake database and fail on any page error.
// Usage: python3 dashboard/build.py && python3 dashboard/harness.py live && node dashboard/tests/smoke.js live
const {chromium}=require('playwright'); const path=require('path');
const mode=process.argv[2]==='live'?'live':'test'; const page=path.resolve(__dirname,'../../dist',mode+'.html');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto('file://'+page+'#overview');await p.waitForTimeout(1200);
  const views=await p.evaluate(()=>VIEWS.map(v=>v[0]));
  for(const v of [...views,'me']){ await p.evaluate(h=>location.hash=h,v); await p.waitForTimeout(400);
    const n=await p.evaluate(()=>document.querySelector('#view').innerText.length); console.log(v.padEnd(12),n,'chars'); }
  await p.evaluate(()=>{location.hash='stats';}); await p.waitForTimeout(300);
  const months=await p.evaluate(()=>[...document.querySelectorAll('#st-month option')].map(o=>o.value));
  for(const m of months){ await p.selectOption('#st-month',m); await p.waitForTimeout(150); }
  console.log('stats months',months.length);
  console.log(errs.length?'FAIL\n'+errs.join('\n'):'PASS: no page errors'); await b.close(); process.exit(errs.length?1:0); })();
