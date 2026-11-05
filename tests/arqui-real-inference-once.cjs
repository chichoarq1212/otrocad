'use strict';
/* One-off REAL Cloudflare Workers AI end-to-end smoke test.
 * Does not create a real user account: OtroCAD is public, quota is per IP.
 * A synthetic persona "Visitante de prueba" makes ONE inference request maximum.
 * Never retries /api/arqui POST; emits diagnostics and screenshots.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const BASE='https://otrocad.cristhian-torres-arq.workers.dev';
const prompt='Quiero una casa de 10 x 8 metros con tres dormitorios: uno máster con baño y dos con baño compartido; sala comedor, cocina con isla, patio posterior de 3 metros con lavandería y estacionamiento para dos carros.';
const OUT='/tmp/otrocad-real-ia';
fs.mkdirSync(OUT,{recursive:true});
let browser,page,postCount=0,realReply=null,statusBefore=null;
const screenshot=async(name)=>{
 if(!page)return;
 await page.screenshot({path:OUT+'/'+name,fullPage:true,timeout:8000}).catch(()=>{});
};
(async()=>{
 const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 browser=await chromium.launch({headless:true,...(binary?{executablePath:binary}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 page.setDefaultTimeout(12000);
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err)));
 page.on('response',async response=>{
  const req=response.request();
  if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/arqui'){
   try{realReply={status:response.status(),body:await response.json()}}
   catch(e){realReply={status:response.status(),error:String(e)}}
  }
 });
 await page.route('**/api/arqui',async route=>{
  if(route.request().method()==='POST'){
   postCount++;
   if(postCount>1){
    console.error('BLOCKED duplicate paid inference call.');
    await route.abort('blockedbyclient');return;
   }
  }
  await route.continue();
 });
 console.log('Navigating to real OtroCAD website as fictitious Visitor de prueba (no account required).');
 const loaded=await page.goto(BASE+'/editor/',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(loaded.status(),200);
 await page.waitForFunction(()=>!!window.OtroCadArqui&&!!window.OtroCadCivilAPI,null,{timeout:20000});
 statusBefore=await page.evaluate(async()=>{
  const r=await fetch('/api/arqui/status',{cache:'no-store'});
  return {http:r.status,body:await r.json()};
 });
 console.log('BEFORE quota status:',JSON.stringify(statusBefore));
 assert.equal(statusBefore.http,200);
 assert.equal(statusBefore.body.online,true,'Owner must enable automated free AI');
 assert(statusBefore.body.remaining>=1,'No quota remaining for this test IP. No model call made.');
 assert(statusBefore.body.globalRemaining>=1,'Global free quota exhausted. No model call made.');
 await page.evaluate(()=>window.OtroCadArqui.open());
 assert(await page.locator('#arquiPanel').isVisible());
 assert(!(await page.locator('#arquiAiSettings').isVisible()),'No provider selector should be visible');
 await page.locator('#arquiPrompt').fill(prompt);
 await page.locator('#arquiPropose').click();
 await page.waitForFunction(()=>{
  const form=document.getElementById('arquiPropose');
  return form&&!form.disabled;
 },null,{timeout:65000});
 await page.waitForTimeout(250);
 const diagnostic=await page.evaluate(()=>{
  const design=window.OtroCadArqui.preview();
  return {
   mode:document.getElementById('arquiMode')?.textContent,
   quotaText:document.getElementById('arquiCloudStatus')?.textContent,
   summary:document.getElementById('arquiSummary')?.textContent,
   log:Array.from(document.querySelectorAll('#arquiMessages .arqui-msg')).slice(-5).map(x=>x.textContent?.slice(0,850)),
   hasPreview:!!design,
   spec:design?.spec,
   floors:design?.floors?.length,
   elements:document.querySelectorAll('#arquiPreview line,#arquiPreview polygon,#arquiPreview text').length,
   drawButtonEnabled:!document.getElementById('arquiDraw')?.disabled
  };
 });
 console.log('REAL MODEL RESPONSE:',JSON.stringify(realReply));
 console.log('EDITOR DIAGNOSTIC:',JSON.stringify(diagnostic));
 assert.equal(postCount,1,'Only one real inference is allowed');
 assert(realReply,'The real website must call /api/arqui');
 assert.equal(realReply.status,200,'The AI server must return a usable architectural program');
 assert.equal(realReply.body.requiresReview,false,'This test brief should not ask for unnecessary clarification');
 assert(diagnostic.hasPreview,'The real model result must become a CAD preview');
 assert(diagnostic.drawButtonEnabled,'The editor should permit approving the generated drawing');
 assert(diagnostic.elements>100,'The preview must contain real CAD graphics');
 await screenshot('01-preview-real-ai.png');
 await page.locator('#arquiDraw').click();
 await page.waitForFunction(()=>/Plano creado|Diseño actualizado/.test(document.getElementById('arquiProgress')?.textContent||'')&&
    window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect).length>150,
   null,{timeout:28000});
 const cad=await page.evaluate(()=>{
  const objects=window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect);
  const layers={};
  for(const o of objects)layers[o.layer]=(layers[o.layer]||0)+1;
  return {count:objects.length,layers,labels:objects.filter(o=>o.type==='text')
   .map(o=>o.text).filter(s=>/PATIO|PARQUEO|LAVANDERÍA|DORMITORIO/.test(s))};
 });
 console.log('EDITABLE CAD OUTPUT:',JSON.stringify(cad));
 assert(cad.count>150);
 assert(cad.layers['AI-ARQ-MUROS']>0);
 assert(cad.layers['AI-ARQ-COTAS']>0);
 assert(cad.layers['AI-ARQ-PATIO']>0);
 assert(cad.layers['AI-ARQ-GARAJE']>0);
 await screenshot('02-plan-real-ai.png');
 const after=await page.evaluate(async()=>{
  const r=await fetch('/api/arqui/status',{cache:'no-store'});
  return await r.json();
 });
 assert.equal(postCount,1);
 assert(after.remaining<=statusBefore.body.remaining-1,'Server quota should decrease after one request');
 fs.writeFileSync(OUT+'/result.json',JSON.stringify({identity:'Visitante de prueba (anónimo)',prompt,
  statusBefore,realReply,diagnostic,cad,after,postCount,errors},null,2));
 console.log('SUCCESS: one REAL Workers AI inference generated '+cad.count+' editable CAD objects and consumed one free quota.');
 await browser.close();
})().catch(async error=>{
 console.error('REAL E2E TEST FAILED:',error);
 try{
  const info={identity:'Visitante de prueba (anónimo)',prompt,statusBefore,realReply,postCount,error:String(error)};
  fs.writeFileSync(OUT+'/failure.json',JSON.stringify(info,null,2));
  await screenshot('failure-real-ai.png');
 }catch(e){console.error('Diagnostics failed',String(e))}
 try{await browser?.close()}catch(e){}
 process.exitCode=1;
});
