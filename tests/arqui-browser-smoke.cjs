'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');

const mockSpec={
 dimensionMeaning:'house',houseWidth:10,houseDepth:8,siteAssumed:true,
 lotWidth:10,lotDepth:16.5,frontSetback:5.5,backSetback:3,sideSetback:0,
 floors:2,bedrooms:3,bathrooms:2,mainSuite:true,socialBath:false,
 kitchenIsland:true,patioDepth:3,patioLaundry:true,rearDoor:true,
 garage:true,garageSpaces:2
};
const brief='Quiero una casa de 10 por 8 metros, tres habitaciones, una máster con baño y dos con baño compartido, sala comedor, cocina con isla, patio de 3 metros atrás con lavandería, puerta al patio y parque para dos carros.';
const answer={spec:mockSpec,reason:'Propuesta de dos plantas en casa 10x8, terreno de referencia 10x16.5 pendiente de confirmar.',requiresReview:false};

let activeBrowser=null,activePage=null,requestLog=[];
(async()=>{
 const binaries=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
 const binary=binaries.find(x=>fs.existsSync(x));
 const browser=activeBrowser=await chromium.launch({headless:true,...(binary?{executablePath:binary}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=activePage=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e).slice(0,320)));
 page.on('console',msg=>{if(msg.type()==='error')console.error('Chrome console:',msg.text().slice(0,400))});
 let requests=0;
 requestLog=[];
 page.on('requestfailed',req=>requestLog.push({url:req.url(),error:req.failure()?.errorText}));
 await page.route('**/api/arqui/status',async route=>{
  requestLog.push({url:route.request().url(),method:'GET'});
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({online:true,limit:2,remaining:2,globalRemaining:20,reset:'00:00 UTC'})});
 });
 await page.route('**/api/arqui',async route=>{
  const req=route.request();
  requestLog.push({url:req.url(),method:req.method()});
  assert.equal(req.method(),'POST');
  requests++;
  const sent=req.postDataJSON();
  assert.equal(sent.mode,'architecture');
  assert(sent.message.includes('casa de 10 por 8'));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ...answer,remaining:1,limit:2,globalRemaining:19
  })});
 });
 const target=process.env.OTROCAD_TEST_URL||'http://127.0.0.1:4173/editor/';
 page.setDefaultTimeout(8500);console.log('Chrome: navegando a '+target);
 const res=await page.goto(target,{waitUntil:'domcontentloaded',timeout:25000});
 assert.equal(res.status(),200);
 await page.waitForFunction(()=>!!window.OtroCadArqui&&!!window.OtroCadCivilAPI,
  null,{timeout:15000});
 console.log('Chrome: OtroCAD inicializado, abriendo El Arqui');
 await page.evaluate(()=>window.OtroCadArqui.open());
 assert.equal(await page.locator('#arquiPanel').isVisible(),true);
 assert.equal(await page.locator('#arquiAiSettings').isVisible(),false,'No provider dropdown should be visible');
 await page.waitForFunction(()=>document.querySelector('#arquiCloudStatus')?.textContent?.includes('consultas disponibles'),null,{timeout:12000});
 await page.locator('#arquiPrompt').fill(brief);
 console.log('Chrome: enviando solicitud al modelo simulado');
 await page.locator('#arquiPropose').click();
 await page.waitForFunction(()=>window.OtroCadArqui.preview()?.spec?.dimensionMeaning==='house',null,{timeout:15000});
 const initial=await page.evaluate(()=>({
  spec:window.OtroCadArqui.preview().spec,
  floors:window.OtroCadArqui.preview().floors.length,
  rooms:window.OtroCadArqui.preview().floors.flatMap(f=>f.rooms).map(r=>r.name),
  previewMarks:document.querySelectorAll('#arquiPreview line,#arquiPreview polygon,#arquiPreview text').length,
  beforeDraw:window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect).length
 }));
 assert.equal(requests,1);
 assert.equal(initial.spec.houseWidth,10);
 assert.equal(initial.spec.lotDepth,16.5);
 assert.equal(initial.floors,2);
 assert.equal(initial.beforeDraw,0,'Preview must not mutate CAD before approval');
 assert(initial.previewMarks>200,'SVG must contain the actual drawing geometry');
 console.log('Chrome: vista previa generada; aprobando entidades CAD');
 await page.locator('#arquiDraw').click();
 await page.waitForFunction(()=>
  /Plano creado|Diseño actualizado/.test(document.getElementById('arquiProgress')?.textContent||'')&&
  window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect).length>350,
  null,{timeout:18000});
 const geometry=await page.evaluate(()=>{
  const objects=window.OtroCadCivilAPI.getObjects().filter(x=>x.aiArchitect);
  const layers={};
  for(const e of objects)layers[e.layer]=(layers[e.layer]||0)+1;
  const labels=objects.filter(e=>e.type==='text').map(e=>e.text);
  return {entityCount:objects.length,layers,labels};
 });
 assert(geometry.layers['AI-ARQ-MUROS']>0);
 assert(geometry.layers['AI-ARQ-PATIO']>0);
 assert(geometry.layers['AI-ARQ-GARAJE']>0);
 assert(geometry.layers['AI-ARQ-COTAS']>0);
 assert(geometry.labels.includes('PARQUEO 1')&&geometry.labels.includes('PARQUEO 2'));
 assert(geometry.labels.some(x=>x.includes('LAVANDERÍA')));
 assert(errors.length===0,'Browser JS errors: '+errors.join(' | '));
 fs.mkdirSync('/tmp/otrocad-browser-smoke',{recursive:true});
 await page.screenshot({path:'/tmp/otrocad-browser-smoke/preview-and-cad.png',fullPage:true});
 // Repeat UI audit at iPhone-sized viewport: no provider selector or API key.
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(160);
 const mobile=await page.evaluate(()=>{
  const panel=document.getElementById('arquiPanel');
  const quota=document.getElementById('arquiCloudStatus');
  const advanced=document.getElementById('arquiAiSettings');
  const rect=panel.getBoundingClientRect();
  return {panelWidth:rect.width,panelLeft:rect.left,
   quotaVisible:!!quota&&quota.getBoundingClientRect().height>0,
   advancedHidden:advanced.hidden,
   mode:document.getElementById('arquiMode')?.textContent||''};
 });
 assert(mobile.panelWidth<=390,'Panel de IA debe caber en el teléfono');
 assert(mobile.panelLeft>=0,'Panel no debe salirse por la izquierda');
 assert(mobile.quotaVisible,'El contador de IA debe ser visible en celular');
 assert(mobile.advancedHidden,'Nadie debe escoger un proveedor de IA');
 await page.screenshot({path:'/tmp/otrocad-browser-smoke/iphone-auto-ia.png',fullPage:true});
 fs.writeFileSync('/tmp/otrocad-browser-smoke/report.json',JSON.stringify({
  tested:new Date().toISOString(),url:target,model:'Cloudflare Workers AI (intercepted mock)',
  requests,initial:{...initial,spec:{lotWidth:initial.spec.lotWidth,lotDepth:initial.spec.lotDepth,
   houseWidth:initial.spec.houseWidth,houseDepth:initial.spec.houseDepth,patioDepth:initial.spec.patioDepth}},
  geometry:{entityCount:geometry.entityCount,layers:geometry.layers,labels:geometry.labels.filter(x=>/PARQUEO|PATIO|LAVANDERÍA/.test(x))},
  jsErrors:errors
 },null,2));
 console.log('CHROME REAL BROWSER PASS: automatic model mock -> SVG preview -> approved '+geometry.entityCount+' editable CAD entities');
 await browser.close();
})().catch(async error=>{
 console.error('ERROR navegador El Arqui:',error);
 try{
  fs.mkdirSync('/tmp/otrocad-browser-smoke',{recursive:true});
  if(activePage){
   const details=await activePage.evaluate(()=>({
    url:location.href,readyState:document.readyState,
    mode:document.getElementById('arquiMode')?.textContent,
    summary:document.getElementById('arquiSummary')?.textContent,
    context:document.getElementById('arquiContext')?.textContent,
    message:Array.from(document.querySelectorAll('#arquiMessages .arqui-msg')).slice(-3).map(e=>e.textContent?.slice(0,200)),
    objectCount:window.OtroCadCivilAPI?.getObjects?.().length||0
   })).catch(e=>({error:String(e)}));
   console.error('Chrome network trace:',JSON.stringify(requestLog));
   fs.writeFileSync('/tmp/otrocad-browser-smoke/failure.json',JSON.stringify({error:String(error),details,requestLog},null,2));
   await activePage.screenshot({path:'/tmp/otrocad-browser-smoke/failure.png',timeout:4500}).catch(()=>{});
  }
 }catch(e){console.error('Error recolectando diagnóstico',e)}
 try{await activeBrowser?.close()}catch(e){console.error('Error cerrando navegador',e)}
 process.exitCode=1;
});
