'use strict';
// End-to-end functional tour of the actual OtroCAD web editor.
// No model requests or external account. Capture each completed checkpoint.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const OUT='/tmp/otrocad-functional-tour';
fs.mkdirSync(OUT,{recursive:true});
let browser,page,checkpoint='launch';
const results=[],pageErrors=[],modelCalls=[];
const check=(name,extra={})=>{results.push({name,status:'PASS',...extra});console.log('TOUR PASS:',name,JSON.stringify(extra))};
async function command(text){
 const cmd=page.locator('#cmd');
 await cmd.fill(text);
 await page.locator('#cmdRun').click();
 await page.waitForTimeout(75);
}
async function entityCount(){return page.evaluate(()=>window.OtroCadCivilAPI.getObjects().length)}
async function snapshot(name){
 await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,timeout:9500});
}
async function roundTrip(download){
 const path=await download.path();
 assert(fs.statSync(path).size>100, 'Empty download');
 return {path,contents:fs.readFileSync(path),name:download.suggestedFilename()};
}
(async()=>{
 const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
 browser=await chromium.launch({headless:true,...(binary?{executablePath:binary}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true,serviceWorkers:'block'});
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>pageErrors.push(String(e).slice(0,450)));
 page.on('request',r=>{if(/\/api\/arqui|openrouter\.ai|generativelanguage\.googleapis\.com|api\.openai\.com/.test(r.url()))modelCalls.push(r.url())});
 page.on('dialog',async d=>{await d.accept(d.type()==='prompt'?'1':undefined).catch(()=>{})});
 await page.route('**/api/arqui*',r=>r.abort('blockedbyclient'));
 const url=process.env.OTROCAD_TEST_URL||'http://127.0.0.1:4173/editor/';
 checkpoint='start';
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>!!window.OtroCadCivilAPI&&!!window.OtroCadFileCore&&!!window.OtroCadCivilMath&&!!window.OtroCadMep&&!!window.OtroCadArqui&&!!window.OtroCadArchitecturalKnowledge,null,{timeout:20000});
 const initial=await page.evaluate(()=>({units:window.OtroCadCivilAPI.getUnits(),objects:window.OtroCadCivilAPI.getObjects().length,canvas:document.querySelector('#cad').getBoundingClientRect().width}));
 assert(initial.canvas>200);
 check('Carga del editor y módulos CAD/Civil/MEP/Arqui',initial);
 checkpoint='commands';
 await command('L');await command('1,1');await command('6,1');
 let objs=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects());
 assert(objs.some(x=>x.type==='line'&&x.a.x===1&&x.a.y===1&&x.b.x===6&&x.b.y===1),'LINE and coordinate entry failed');
 check('LINE desde la barra de comandos con coordenadas', {objects:objs.length});
 await command('REC');await command('1,2');await command('5,5');
 objs=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects());
 assert(objs.some(x=>x.type==='rect'&&x.a.x===1&&x.a.y===2&&x.b.x===5&&x.b.y===5),'RECT did not create native rectangle');
 check('RECT con dimensiones y puntos exactos');
 await command('C');await command('8,5');await command('10,5');
 objs=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects());
 assert(objs.some(x=>x.type==='circle'),'CIRCLE did not create circle');
 check('CIRCLE geométrico');
 await command('PL');await command('0,8');await command('3,8');await command('3,11');
 await page.evaluate(()=>window.OtroCadCivilAPI.finishDrawing());
 objs=await page.evaluate(()=>window.OtroCadCivilAPI.getObjects());
 assert(objs.some(x=>x.type==='poly'&&x.pts.length>=3),'PLINE could not finish polyline');
 check('PLINE con tres vértices');
 checkpoint='undo-redo';
 const countBefore=await entityCount();
 await command('UNDO');const undone=await entityCount();
 assert(undone<countBefore,'UNDO should remove last command');
 await command('REDO');assert.equal(await entityCount(),countBefore,'REDO did not restore');
 check('Deshacer y rehacer',{before:countBefore,afterUndo:undone});
 checkpoint='cad-tools';
 await command('MA');assert.equal(await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()),'matchprop');
 await command('O 0.5');assert.equal(await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()),'offset');
 await command('FILLET');assert.equal(await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()),'fillet');
 await command('TRIM');assert.equal(await page.evaluate(()=>window.OtroCadCivilAPI.getActiveTool()),'trim');
 check('Herramientas MA, OFFSET, FILLET y TRIM reconocidas');
 await page.evaluate(()=>window.OtroCadCivilAPI.startDrawingTool('select'));
 checkpoint='tabs';
 for(const tab of ['draw','modify','annotate','view','layers','civil','mep','hvac']){
  const t=page.locator('[data-tab="'+tab+'"]');
  if(await t.count()){
   await t.click();
   assert.equal(await t.getAttribute('aria-selected'),'true','Tab activation failed: '+tab);
  }
 }
 check('Pestañas Dibujo, Modificar, Anotar, Vista, Capas, Civil y MEP');
 checkpoint='civil';
 await page.evaluate(()=>{
  const api=window.OtroCadCivilAPI;
  api.ensureLayer('PUNTOS TOPO','#4ca6d5');
  const pts=[
   {id:'P1',x:0,y:0,z:10},{id:'P2',x:10,y:0,z:11},
   {id:'P3',x:10,y:10,z:13},{id:'P4',x:0,y:10,z:12}
  ];
  api.addObjects(pts.map(p=>({type:'point',a:{x:p.x,y:p.y},z:p.z,
   civilPoint:true,civilPointId:p.id,layer:'PUNTOS TOPO',color:'#4ca6d5'})),'Puntos prueba');
  window.OtroCadCivilCommands.C3DTIN();
 });
 let civil=await page.evaluate(()=>({points:window.OtroCadCivilAPI.getObjects().filter(x=>x.civilPoint).length,
  tin:window.OtroCadCivilAPI.getObjects().filter(x=>x.civilTin).length}));
 assert.equal(civil.points,4);assert(civil.tin>=2,'TIN with four known survey points failed');
 check('Civil 3D: puntos XYZ y superficie TIN',civil);
 await page.evaluate(()=>window.OtroCadCivilCommands.C3DCONTOURS());
 civil=await page.evaluate(()=>({contours:window.OtroCadCivilAPI.getObjects().filter(x=>x.civilContour).length}));
 assert(civil.contours>0,'Contour lines were not generated from valid surface');
 check('Civil 3D: curvas de nivel',civil);
 checkpoint='mep';
 const sys=await page.evaluate(()=>window.OtroCadMep.getSystemInfo());
 assert(sys.some(x=>x.id==='cold')&&sys.some(x=>x.id==='supply'),'Water and HVAC systems missing');
 await page.evaluate(()=>{
  window.OtroCadMep.chooseSystem('cold');
  if(!window.OtroCadMep.commitRoute([{x:15,y:2},{x:19,y:2},{x:19,y:5}]))throw Error('Cold water network failed');
  window.OtroCadMep.chooseSystem('supply');
  if(!window.OtroCadMep.commitRoute([{x:22,y:2},{x:28,y:2}]))throw Error('HVAC network failed');
 });
 const mep=await page.evaluate(()=>({layers:[...new Set(window.OtroCadCivilAPI.getObjects().filter(x=>String(x.layer).startsWith('MEP-')).map(x=>x.layer))],
  items:window.OtroCadCivilAPI.getObjects().filter(x=>String(x.layer).startsWith('MEP-')).length,
  quantities:window.OtroCadMep.getQuantities().length}));
 assert(mep.layers.includes('MEP-AGUA-FRIA')&&mep.layers.includes('MEP-AIRE-IMPULSION'),'MEP route layers missing');
 assert(mep.items>=2);check('MEP: redes de agua y ductos HVAC',mep);
 checkpoint='layouts';
 await page.locator('#paperCreate').click();
 await page.waitForTimeout(300);
 const layouts=await page.locator('#layoutTabs button').allTextContents();
 assert(layouts.length>=2,'No paper layout created');
 check('Presentaciones de papel / Layout',{tabs:layouts.slice(0,8)});
 await command('MODEL');
 checkpoint='files';
 const [project]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),page.locator('#project').click()
 ]);
 const json=await roundTrip(project);
 assert(json.name.endsWith('.json'),'Project download missing JSON');
 const parsed=JSON.parse(json.contents.toString('utf8'));
 assert(Array.isArray(parsed.shapes)&&parsed.shapes.length>10);
 assert(Array.isArray(parsed.layouts)&&parsed.layouts.length>=1);
 check('Exportación de proyecto editable y layouts',{bytes:json.contents.length,shapes:parsed.shapes.length});
 const [dxfDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:16000}),page.locator('#dxf').click()
 ]);
 const dxf=await roundTrip(dxfDownload);
 assert(dxf.name.endsWith('.dxf'));
 assert(dxf.contents.toString('utf8').includes('ENTITIES'),'DXF missing ENTITIES table');
 check('Exportación DXF',{bytes:dxf.contents.length});
 checkpoint='new-import';
 await page.locator('#newDrawing').click();await page.waitForTimeout(700);
 assert.equal(await entityCount(),0,'New drawing should clear workspace');
 check('Dibujo nuevo sin perder copias recuperables');
 await page.locator('#file').setInputFiles({name:'tour.json',mimeType:'application/json',buffer:json.contents});
 await page.waitForFunction(()=>window.OtroCadCivilAPI.getObjects().length>10,null,{timeout:12000});
 const imported=await entityCount();
 assert.equal(imported,parsed.shapes.length,'JSON import count mismatch');
 check('Reimportación de proyecto y objetos editables',{objects:imported});
 checkpoint='mobile';
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{
  const r=id=>{const e=document.getElementById(id);const b=e?.getBoundingClientRect();return {exists:!!e,width:b?.width,height:b?.height}};
  return {canvas:r('cad'),command:r('cmd'),ribbon:r('ribbon'),mobile:r('mobileBottomToggle')};
 });
 assert(mobile.canvas.width>=300);assert(mobile.command.exists);
 await snapshot('tour-mobile');
 check('Interfaz móvil vertical sin pérdida de editor',{canvasWidth:mobile.canvas.width});
 checkpoint='arqui';
 await page.evaluate(()=>window.OtroCadArqui.open());
 assert(await page.locator('#arquiPanel').isVisible());
 const stats=await page.evaluate(()=>({knowledge:window.OtroCadArchitecturalKnowledge.version,
   hasProvider:!!document.getElementById('arquiAiProvider'),
   hasLocal:!!document.getElementById('arquiLocalStatus')}));
 assert(stats.hasLocal&&!stats.hasProvider,'Static architectural assistant should not require AI provider');
 check('El Arqui con biblioteca estática y sin claves',stats);
 assert.equal(modelCalls.length,0,'Unexpected remote generative AI');
 if(pageErrors.length)throw Error('Page runtime exceptions: '+pageErrors.join(' | '));
 await snapshot('tour-arqui');
 const report={target:url,headlessChromium:true,results,pageErrors,modelCalls};
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
 console.log('FULL FUNCTIONAL TOUR PASS: '+results.length+' checkpoints, no model/API calls.');
 await browser.close();
})().catch(async e=>{
 console.error('FULL TOUR FAILED at '+checkpoint+': '+String(e));
 console.error(e.stack||e);
 try{
  const diagnostic=page?await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,
   tool:window.OtroCadCivilAPI?.getActiveTool?.(),entities:window.OtroCadCivilAPI?.getObjects?.().length,
   tabs:[...document.querySelectorAll('#tabs button.active')].map(x=>x.dataset.tab),
   url:location.href})).catch(x=>({error:String(x)})):{error:'Page not initialized'};
  fs.writeFileSync(OUT+'/failure.json',JSON.stringify({checkpoint,error:String(e),stack:e.stack,results,pageErrors,modelCalls,diagnostic},null,2));
  if(page)await snapshot('tour-failure').catch(()=>{});
  console.error('DIAGNOSTIC '+JSON.stringify(diagnostic));
 }catch(x){console.error('Diagnostics error '+String(x))}
 try{await browser?.close()}catch(_){}
 process.exitCode=1;
});
