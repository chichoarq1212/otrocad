'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const OUT='/tmp/otrocad-browser-smoke';
const prompt='Quiero una casa de 10 x 8 con 3 habitaciones, dos de ellas con baño compartido y una con baño máster, sala, comedor, cocina con isla, puerta trasera para patio de 3 metros con lavandería y parqueo para 2 carros.';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:binary}:{}) ,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const errors=[],remoteCalls=[];
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
  const dest=r.url();
  if(/\/api\/arqui|openrouter\.ai|generativelanguage\.googleapis\.com|api\.openai\.com|api\.groq\.com/.test(dest))
   remoteCalls.push(dest);
 });
 await page.route('**/api/arqui*',r=>r.abort('blockedbyclient'));
 const target=process.env.OTROCAD_TEST_URL||'http://127.0.0.1:4173/editor/';
 console.log('Opening offline OtroCAD:',target);
 const res=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(res.status(),200);
 await page.waitForFunction(()=>window.OtroCadArqui&&window.OtroCadArchitecturalKnowledge&&window.OtroCadCivilAPI,
  null,{timeout:20000});
 await page.evaluate(()=>window.OtroCadArqui.open());
 assert.equal(await page.locator('#arquiPanel').isVisible(),true);
 assert.equal(await page.locator('#arquiAiSettings').count(),0,'No provider settings');
 assert.equal(await page.locator('#arquiCloudStatus').count(),0,'No cloud credit counter');
 assert.match(await page.locator('#arquiLocalStatus').textContent(),/0 créditos/);
 await page.locator('#arquiPrompt').fill(prompt);
 await page.waitForTimeout(600);
 assert((await page.locator('#arquiPreview polygon').count())>100,'The draft must show CAD walls while typing');
 await page.locator('#arquiPropose').click();
 await page.waitForFunction(()=>window.OtroCadArqui.preview()?.layoutKind==='compact-coherent-v3',
  null,{timeout:16000});
 const plan=await page.evaluate(()=>{
  const p=window.OtroCadArqui.preview();
  return {spec:p.spec,levels:p.floors.length,roomNames:p.floors.flatMap(f=>f.rooms.map(r=>r.name)),
   stairs:p.floors.map(f=>f.stair),audits:p.audit,
   draftGeometry:document.querySelectorAll('#arquiPreview line,#arquiPreview polygon,#arquiPreview text').length,
   beforeCAD:window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect).length};
 });
 assert.deepEqual([plan.spec.houseWidth,plan.spec.houseDepth],[10,8]);
 assert.equal(plan.spec.garageSpaces,2);
 assert.equal(plan.spec.patioLaundry,true);
 assert.equal(plan.spec.bathrooms,2);
 assert.equal(plan.levels,2);
 assert.deepEqual(plan.audits,[]);
 assert.equal(plan.stairs[0].x,plan.stairs[1].x);
 assert.equal(plan.stairs[0].y,plan.stairs[1].y);
 assert(plan.draftGeometry>200);
 assert.equal(plan.beforeCAD,0,'Preview must not edit drawing until approval');
 await page.screenshot({path:OUT+'/01-propuesta-estatica.png',fullPage:true});
 await page.locator('#arquiDraw').click();
 await page.waitForFunction(()=>
  /Plano creado|Diseño actualizado/.test(document.getElementById('arquiProgress')?.textContent||'')&&
  window.OtroCadCivilAPI.getObjects().filter(e=>e.aiArchitect).length>400,
  null,{timeout:20000});
 const result=await page.evaluate(()=>{
  const shapes=window.OtroCadCivilAPI.getObjects().filter(e=>e.aiArchitect);
  const layers=[...new Set(shapes.map(e=>e.layer))];
  const texts=shapes.filter(e=>e.type==='text').map(e=>e.text);
  return {entities:shapes.length,layers,
   baths:texts.filter(x=>/BAÑO MÁSTER|BAÑO COMPARTIDO/.test(x)),
   stairTreads:shapes.filter(x=>x.aiElement==='stair-tread').length,
   landings:shapes.filter(x=>x.aiElement==='turn-landing').length,
   parking:texts.filter(x=>/PARQUEO [12]/.test(x)),
   patio:texts.filter(x=>x.includes('PATIO POSTERIOR')),
   laundry:texts.filter(x=>x.includes('LAVANDERÍA'))};
 });
 assert(result.entities>400);
 assert.equal(result.baths.length,2);
 assert(result.stairTreads>=28);
 assert(result.landings===2);
 assert.equal(result.parking.length,2);
 assert(result.patio.length>=1);
 assert(result.laundry.length>=1);
 await page.screenshot({path:OUT+'/02-modelo-cad-completo.png',fullPage:true});
 await page.evaluate(()=>{document.getElementById('arquiPanel').hidden=true});
 await page.screenshot({path:OUT+'/03-plano-sin-panel.png',fullPage:true});
 await page.evaluate(()=>{document.getElementById('arquiPanel').hidden=false});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:OUT+'/04-iphone-interfaz-local.png',fullPage:true});
 assert.equal(await page.locator('#arquiAiSettings').count(),0);
 assert.equal(remoteCalls.length,0,'No cloud-model requests or third-party AI calls');
 assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
 fs.writeFileSync(OUT+'/result.json',JSON.stringify({prompt,plan,result,remoteCalls,errors},null,2));
 console.log('PASS static OtroCAD: '+result.entities+' editable CAD entities, actual U stairs and 2 bathrooms, 0 AI calls.');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
