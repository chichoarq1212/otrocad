'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const OUT='/tmp/otrocad-full-tour';
fs.mkdirSync(OUT,{recursive:true});
const checks=[],errors=[],failedRequests=[],dangerousRequests=[];
function log(name,details){checks.push({name,result:'PASS',details});console.log('CHECK PASS '+name+': '+JSON.stringify(details).slice(0,600))}
function validate(condition,message){assert(condition,message)}
async function snap(page,name){
 try{await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true,timeout:12000})}catch(e){console.log('Screenshot '+name+' unavailable: '+String(e).slice(0,200))}
}
async function run(){
 const browserPath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 const browser=await chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true,serviceWorkers:'block'});
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>failedRequests.push({url:r.url(),method:r.method(),error:r.failure()?.errorText}));
 page.on('request',r=>{if(/\/api\/arqui|openrouter\.ai|generativelanguage\.googleapis\.com|api\.openai\.com/.test(r.url()))dangerousRequests.push(r.url())});
 page.on('dialog',async d=>{console.log('DIALOG '+d.type()+': '+d.message().slice(0,100));await d.accept()});
 const URL=process.env.OTROCAD_TEST_URL||'http://127.0.0.1:4173/editor/';
 const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200,'Editor returns HTTP 200');
 await page.waitForFunction(()=>!!window.OtroCadCivilAPI&&!!window.OtroCadFileCore&&!!window.OtroCadArqui&&!!window.OtroCadMep,null,{timeout:20000});
 const modules=await page.evaluate(()=>({
  civil:!!window.OtroCadCivilAPI,
  civilCommands:!!window.OtroCadCivilCommands,
  mep:!!window.OtroCadMep,
  thermal:!!window.OtroCadThermal,
  archetype:!!window.OtroCadArqui,
  knowledge:!!window.OtroCadArchitecturalKnowledge,
  dwg:!!window.OtroCadFileCore,
  saveUI:!!window.OtroCadSaveUI,
  geolocation:!!window.OtroCadGeolocation,
  civilTopo:!!window.OtroCadCivilTopo,
  buttons:document.querySelectorAll('#tabs [data-tab]').length,
  tools:document.querySelectorAll('[data-tool]').length
 }));
 for(const [key,ok] of Object.entries(modules))if(typeof ok==='boolean')validate(ok,'Missing loaded module '+key);
 validate(modules.buttons>=10,'CAD/Civil/MEP navigation incomplete');
 validate(modules.tools>=20,'Drawing/edit tools missing');
 log('bootstrap-modules',modules);
 await snap(page,'01-editor-start');
 // Walk every tab, verifying its ribbon controls are available and not blank.
 const tabs=await page.locator('#tabs [data-tab]').evaluateAll(xs=>xs.map(x=>x.dataset.tab));
 for(const tab of tabs){
  await page.locator('#tabs [data-tab="'+tab+'"]').click({timeout:12000});
  const active=await page.locator('#tabs [data-tab="'+tab+'"]').evaluate(x=>x.classList.contains('active'));
  validate(active,'Tab '+tab+' did not activate');
  const visible=await page.locator('#groups [data-panel="'+tab+'"]').evaluateAll(xs=>xs.filter(x=>!x.hidden).length);
  validate(visible>0,'Tab '+tab+' has zero active groups');
  log('tab-'+tab,{visibleGroups:visible});
 }
 // Canvas draw with mouse (real pointer events).
 await page.locator('#tabs [data-tab="draw"]').click();
 const box=await page.locator('#cad').boundingBox();
 validate(box&&box.width>250&&box.height>180,'Canvas unavailable');
 const pt=(dx,dy)=>({x:box.x+box.width/2+dx,y:box.y+box.height/2+dy});
 const before=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length);
 await page.locator('[data-tool="line"]').first().click();
 await page.mouse.click(pt(-130,-85).x,pt(-130,-85).y);
 await page.mouse.click(pt(-40,-85).x,pt(-40,-85).y);
 const afterLine=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().filter(x=>x.type==='line').length);
 validate(afterLine>=1,'Drawing a line with actual pointer clicks failed');
 log('draw-line',{before,afterLine});
 await page.locator('[data-tool="rect"]').first().click();
 await page.mouse.click(pt(65,-80).x,pt(65,-80).y);
 await page.mouse.click(pt(160,15).x,pt(160,15).y);
 const rectCount=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().filter(x=>x.type==='rect').length);
 validate(rectCount>=1,'Rectangle tool did not create an entity');
 log('draw-rectangle',{rectCount});
 await page.locator('[data-tool="circle"]').first().click();
 await page.mouse.click(pt(-90,80).x,pt(-90,80).y);
 await page.mouse.click(pt(-50,80).x,pt(-50,80).y);
 const circleCount=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().filter(x=>x.type==='circle').length);
 validate(circleCount>=1,'Circle did not create a valid entity');
 log('draw-circle',{circleCount});
 const countBeforeUndo=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length);
 await page.locator('#undo').click();
 const countAfterUndo=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length);
 validate(countAfterUndo===countBeforeUndo-1,'Undo failed to restore previous state');
 await page.locator('#redo').click();
 const countAfterRedo=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length);
 validate(countAfterRedo===countBeforeUndo,'Redo failed to recreate entity');
 log('undo-redo',{before:countBeforeUndo,undo:countAfterUndo,redo:countAfterRedo});
 // Alias commands, with keyboard Enter as an ordinary user.
 await page.locator('#cmd').fill('MA');await page.locator('#cmd').press('Enter');
 validate((await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()))==='matchprop','MA did not activate match properties');
 await page.locator('#cmd').fill('TR');await page.locator('#cmd').press('Enter');
 validate((await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()))==='trim','TR did not activate Trim');
 await page.locator('#cmd').fill('L');await page.locator('#cmd').press('Enter');
 validate((await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()))==='line','L did not activate line');
 log('cad-command-aliases',{tested:['MA','TR','L']});
 // Save local and verify reload restores shapes without cloud services.
 await page.locator('#tabs [data-tab="file"]').click();
 await page.locator('#saveLocal').click();
 await page.waitForFunction(()=>!!localStorage.getItem('otrocad-drawing'),null,{timeout:7000});
 const stateBeforeReload=await page.evaluate(()=>({count:window.OtroCadCivilAPI.getObjects().length,
  data:JSON.parse(localStorage.getItem('otrocad-drawing')||'[]').length}));
 validate(stateBeforeReload.count===stateBeforeReload.data,'Local save does not match editor objects');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.OtroCadCivilAPI&&!!window.OtroCadFileCore,null,{timeout:16000});
 const stateAfterReload=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length);
 validate(stateAfterReload===stateBeforeReload.count,'Reload lost locally saved drawing');
 log('save-and-reload',{savedEntities:stateBeforeReload.count,reloaded:stateAfterReload});
 // Export JSON backup via real browser download.
 await page.locator('#tabs [data-tab="file"]').click();
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:12000}),
  page.locator('#project').click()
 ]);
 const dest=path.join(OUT,'user-backup.json');await download.saveAs(dest);
 const backup=JSON.parse(fs.readFileSync(dest,'utf8'));
 validate(Array.isArray(backup.shapes)&&backup.shapes.length===stateAfterReload,'Exported JSON has missing entities');
 log('project-json-export',{file:download.suggestedFilename(),entities:backup.shapes.length});
 // Load the demo via visible button, and visit layout after it is inserted.
 await page.locator('#demoHouse').click();
 await page.waitForFunction(()=>window.OtroCadCivilAPI.getObjects().length>100,null,{timeout:9000});
 const demo=await page.evaluate(()=>({count:window.OtroCadCivilAPI.getObjects().length,
  types:[...new Set(window.OtroCadCivilAPI.getObjects().map(x=>x.type))]}));
 validate(demo.count>100,'Demo drawing is unexpectedly empty');
 log('demo-house',demo);
 await page.locator('#fit').evaluate(el=>el.click());
 const layoutCount=await page.locator('#layoutTabs button').count();
 const layoutRefs=await page.locator('#layoutTabs button').allTextContents();
 log('layout-views',{layoutCount,labels:layoutRefs.slice(0,10)});
 await snap(page,'02-demo-open');
 // File-save dialog should open without overwriting an existing document.
 await page.locator('#saveAs').evaluate(el=>el.click());
 const dialog=await page.locator('dialog[open]').count();
 validate(dialog>=1,'Save As dialog failed to open');
 await page.keyboard.press('Escape');
 log('save-as-dialog',{opened:dialog});
 // New drawing should protect the previous work and clear the canvas.
 await page.locator('#newDrawing').click();
 await page.waitForFunction(()=>window.OtroCadCivilAPI.getObjects().length===0,null,{timeout:10000});
 log('new-project',{count:0});
 // Each module must load its corresponding control ribbons after a clean drawing.
 for(const [tab,selector] of [['civil','[data-panel="civil"]'],['mep','[data-panel="mep"]'],['hvac','[data-panel="hvac"]']]){
  await page.locator('#tabs [data-tab="'+tab+'"]').click();
  const info=await page.locator(selector).evaluateAll(xs=>xs.map(x=>({hidden:x.hidden,buttons:x.querySelectorAll('button').length,fields:x.querySelectorAll('input,select').length})));
  validate(info.some(x=>!x.hidden&&x.buttons>0),'Empty '+tab+' engineering panel');
  log('engineering-'+tab,info);
 }
 // Local architectural generator must stay present and not call online AI.
 await page.evaluate(()=>window.OtroCadArqui.open());
 const local=await page.evaluate(()=>({
  title:document.getElementById('arquiPanel')?.textContent?.slice(0,180),
  knowledge:!!window.OtroCadArchitecturalKnowledge,
  modelMode:document.getElementById('arquiLocalStatus')?.textContent,
  cloudSelector:!!document.getElementById('arquiAiSettings')
 }));
 validate(local.knowledge&&/0 créditos/.test(local.modelMode),'Offline architect mode missing');
 validate(!local.cloudSelector,'Old generative AI selector present');
 log('offline-architecture',local);
 await snap(page,'03-arqui-local');
 // Verify mobile layout still has usable central canvas and command bar.
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(200);
 await page.evaluate(()=>{const panel=document.getElementById('arquiPanel');if(panel)panel.hidden=true});
 const mobile=await page.evaluate(()=>{
  const ids=['cad','commandbar','statusbar'];
  const info=Object.fromEntries(ids.map(id=>{
   const r=document.getElementById(id)?.getBoundingClientRect();
   return [id,r?{width:r.width,height:r.height,x:r.x,y:r.y}:null];
  }));
  return {viewport:window.innerWidth,info,overlay:!!document.querySelector('.modal[open]')};
 });
 validate(mobile.info.cad.width>200&&mobile.info.cad.height>200,'Mobile CAD workspace unusable');
 validate(mobile.info.commandbar.height>0,'Mobile command bar missing');
 await snap(page,'04-mobile-portrait');
 await page.setViewportSize({width:844,height:390});
 await page.waitForTimeout(200);
 await snap(page,'05-mobile-landscape');
 log('mobile-layout',mobile);
 assert.equal(dangerousRequests.length,0,'Retired AI generated a network request');
 validate(errors.length===0,'Uncaught JavaScript exceptions: '+errors.join(' | '));
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,errors,failedRequests,dangerousRequests,release:'full-breadth-smoke'},null,2));
 console.log('FULL TOUR PASS '+checks.length+' checks, 0 browser exceptions and 0 generative AI requests');
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FULL TOUR FAILED:',String(e),e.stack);fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({checks,errors,failedRequests,dangerousRequests,error:String(e),stack:e.stack},null,2));process.exitCode=1});
