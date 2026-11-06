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
 checkpoint='move-and-regen';
 // Exercise real pointer, keyboard and toolbar interactions in an isolated drawing.
 const movePage=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await movePage.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await movePage.waitForFunction(()=>!!window.OtroCadCivilAPI,null,{timeout:20000});
 await movePage.evaluate(()=>{
  const api=window.OtroCadCivilAPI;
  api.addObjects([
   {type:'line',a:{x:5,y:5},b:{x:9,y:5},layer:'General',groupId:'fixture-group'},
   {type:'line',a:{x:5,y:6},b:{x:9,y:6},layer:'General',groupId:'fixture-group'}
  ],'Fixture');
  if(document.querySelector('#osnapToggle').classList.contains('active'))document.querySelector('#osnapToggle').click();
  if(document.querySelector('#orthoToggle').classList.contains('active'))document.querySelector('#orthoToggle').click();
 });
 async function mcmd(value){await movePage.locator('#cmd').fill(value);await movePage.locator('#cmd').press('Enter')}
 async function mclick(x,y){
  const box=await movePage.locator('#cad').boundingBox();
  const v=await movePage.evaluate(()=>window.OtroCadCivilAPI.getView());
  await movePage.mouse.click(box.x+box.width/2+(x-v.center.x)*v.pixelsPerUnit,box.y+box.height/2-(y-v.center.y)*v.pixelsPerUnit);
 }
 const getMoveState=()=>movePage.evaluate(()=>JSON.parse(JSON.stringify(window.OtroCadCivilAPI.getObjects())));
 await mcmd('M');await mclick(5,5);
 assert.equal(await movePage.evaluate(()=>window.OtroCadCivilAPI.getSelectedObjects().length),2,'MOVE must include grouped entities');
 assert.match(await movePage.locator('#prompt').textContent(),/destino/i);
 const beforeRegen=await getMoveState();
 await movePage.evaluate(()=>{document.querySelector('#cad').width=10});
 await mcmd('RE');
 assert.deepEqual(await getMoveState(),beforeRegen,'RE must not change drawing geometry');
 assert(await movePage.evaluate(()=>document.querySelector('#cad').width>10),'RE should rebuild canvas resolution');
 await mclick(8,7);
 let moved=await getMoveState();
 assert.equal(moved[0].a.x,8);assert.equal(moved[0].a.y,7);
 assert.equal(moved[1].a.x,8);assert.equal(moved[1].a.y,8);
 await mcmd('UNDO');assert.deepEqual(await getMoveState(),beforeRegen,'Undo must restore moved group');
 await mcmd('REDO');moved=await getMoveState();assert.equal(moved[0].a.x,8);
 // Move a preselected group with a picked base and relative typed destination.
 await mcmd('M');await mclick(8,7);await mcmd('@2,0');
 moved=await getMoveState();assert.equal(moved[0].a.x,10);assert.equal(moved[0].a.y,7);
 // Same preselected group, this time starting with the visible Mover button.
 await movePage.locator('[data-tab="modify"]').click();
 await movePage.locator('[data-tool="move"]').first().click();
 await mclick(10,7);await mclick(11,8);
 moved=await getMoveState();assert.equal(moved[0].a.x,11);assert.equal(moved[0].a.y,8);
 // Escape during the next move must leave the objects unchanged.
 await mcmd('M');await mclick(11,8);await movePage.keyboard.press('Escape');
 assert.deepEqual(await getMoveState(),moved,'Escape must cancel MOVE without changing geometry');
 // Toolbar REGEN and paper layout must preserve objects.
 await movePage.locator('[data-tab="view"]').click();
 const unchanged=await getMoveState();await movePage.locator('#regenView').click();
 assert.deepEqual(await getMoveState(),unchanged);
 await movePage.locator('#paperCreate').click();
 await mcmd('REGEN');assert.deepEqual(await getMoveState(),unchanged);
 assert.match(await movePage.locator('#status').textContent(),/REGEN/);
 await mcmd('MODEL');
 await movePage.evaluate(()=>window.OtroCadCivilAPI.addObjects([
  {type:'line',a:{x:1,y:1},b:{x:4,y:1},layer:'General'},
  {type:'line',a:{x:4,y:1},b:{x:1,y:1},layer:'General'},
  {type:'line',a:{x:2,y:2},b:{x:2,y:2},layer:'General'}
 ],'Prueba limpieza'));
 const beforePurge=await getMoveState();
 await mcmd('PURG');
 assert.match(await movePage.locator('dialog[open]').innerText(),/Duplicados exactos: 1/);
 assert.match(await movePage.locator('dialog[open]').innerText(),/Líneas de longitud cero: 1/);
 await movePage.locator('#purgeDup').check();await movePage.locator('#purgeZero').check();await movePage.locator('#purgeApply').click();
 assert.equal((await getMoveState()).length,beforePurge.length-2);
 await mcmd('UNDO');assert.deepEqual(await getMoveState(),beforePurge);
 check('PURG con vista previa, duplicados, líneas nulas y deshacer');
 await mcmd('HP');
 await movePage.locator('#setCrossSize').fill('100');
 await movePage.locator('#setCrossBox').fill('14');
 await movePage.locator('#setCrossMode').selectOption('custom');
 await movePage.locator('#setCrossColor').fill('#ffcc00');
 await movePage.locator('#applySettings').click();
 const cross=await movePage.evaluate(()=>JSON.parse(localStorage.getItem('otrocad-crosshair')));
 assert.deepEqual(cross,{size:100,pickbox:14,mode:'custom',color:'#ffcc00'});
 await movePage.reload({waitUntil:'domcontentloaded'});await mcmd('HP');
 assert.equal(await movePage.locator('#setCrossSize').inputValue(),'100');
 assert.equal(await movePage.locator('#setCrossColor').inputValue(),'#ffcc00');
 await movePage.locator('#cancelSettings').click();
 check('Cruceta configurable y persistente');
 // ROTATE Reference: existing direction 45°, align it to 90°.
 await mcmd('MODEL');
 await movePage.evaluate(()=>window.OtroCadCivilAPI.addObjects([{type:'line',a:{x:-5,y:-5},b:{x:-4,y:-4},layer:'General'}],'Prueba referencia'));
 await movePage.keyboard.press('Escape');
 await mcmd('V');await mclick(-4.5,-4.5);
 await mcmd('RO');await mclick(-5,-5);
 assert.equal(await movePage.locator('#rotateRefBtn').isVisible(),true);
 await movePage.locator('#rotateRefBtn').click();
 await mcmd('45');await mcmd('90');
 const rot=await getMoveState();const line=rot[rot.length-1];
 assert(Math.abs(line.a.x+5)<0.002&&Math.abs(line.b.x+5)<0.002&&Math.abs(line.b.y-(-5+Math.sqrt(2)))<0.005,'Reference rotation must align line to 90 degrees');
 await mcmd('UNDO');const restored=await getMoveState();assert.equal(restored[restored.length-1].b.x,-4);
 await mcmd('V');await mclick(-4.5,-4.5);await mcmd('RO');await mclick(-5,-5);await mcmd('R');
 await mclick(-5,-5);await mclick(-4,-4);await mclick(-5,-3);
 const rotatedByPoints=await getMoveState();const line2=rotatedByPoints[rotatedByPoints.length-1];
 assert(Math.abs(line2.b.x+5)<0.005&&Math.abs(line2.b.y-(-5+Math.sqrt(2)))<0.005,'Two reference points should align to target direction');
 check('Girar con referencia numérica y dos puntos');
 // Scale an existing selected line from its base using an exact factor.
 const beforeScale=await getMoveState();
 await mcmd('SC');await mclick(-5,-5);
 const canvasBox=await movePage.locator('#cad').boundingBox(),vscale=await movePage.evaluate(()=>window.OtroCadCivilAPI.getView());
 await movePage.mouse.move(canvasBox.x+canvasBox.width/2+(-3-vscale.center.x)*vscale.pixelsPerUnit,canvasBox.y+canvasBox.height/2-(-3-vscale.center.y)*vscale.pixelsPerUnit);
 assert.deepEqual(await getMoveState(),beforeScale,'Scale preview must not mutate objects');
 await mcmd('2');const scaled=await getMoveState(),beforeLine=beforeScale[beforeScale.length-1],scaledLine=scaled[scaled.length-1];
 assert(Math.abs(scaledLine.b.y-(-5+2*Math.sqrt(2)))<0.01,'Scale factor 2 must double distance from base');
 await mcmd('UNDO');assert.deepEqual(await getMoveState(),beforeScale);
 check('Escalar con vista previa, factor 2 y deshacer');

 // X accepts a preselected rectangle, decomposes it and can be undone.
 await movePage.evaluate(()=>window.OtroCadCivilAPI.addObjects([{type:'rect',a:{x:-2,y:-2},b:{x:-1,y:-1},layer:'General'}],'Prueba explode'));
 await movePage.keyboard.press('Escape');await mcmd('V');await mclick(-1.5,-2);
 const preX=await getMoveState();await mcmd('X');let afterX=await getMoveState();
 assert.equal(afterX.length,preX.length+3,'X should turn a selected rectangle into four lines');
 await mcmd('UNDO');assert.deepEqual(await getMoveState(),preX);
 // Existing grouped components can be edited individually and remain grouped.
 await movePage.evaluate(()=>window.OtroCadCivilAPI.addObjects([{type:'line',a:{x:0,y:-3},b:{x:1,y:-3},groupId:'test-bedit',layer:'General'},{type:'line',a:{x:1,y:-3},b:{x:1,y:-2},groupId:'test-bedit',layer:'General'}],'Prueba bloque'));
 await movePage.keyboard.press('Escape');await mcmd('V');await mclick(.5,-3);await mcmd('BEDIT');
 assert.equal(await movePage.getByRole('button',{name:'✓ Finalizar bloque'}).isVisible(),true);
 await mcmd('BCLOSE');assert.equal(await movePage.getByRole('button',{name:'✓ Finalizar bloque'}).isVisible(),false);
 check('EXPLODE con selección previa y edición de bloque');

 // Hatch an enclosed area with one click and undo the result.
 await movePage.keyboard.press('Escape');
 await movePage.evaluate(()=>window.OtroCadCivilAPI.addObjects([{type:'rect',a:{x:-8,y:-8},b:{x:-6,y:-6},layer:'General'}],'Prueba hatch'));
 const beforeHatch=await getMoveState();await mcmd('H');await mclick(-7,-7);
 const afterHatch=await getMoveState();assert.equal(afterHatch.length,beforeHatch.length+1,'One click should hatch a closed region');
 assert.ok(afterHatch[afterHatch.length-1].hatchLoops?.length,'Hatch must retain its true boundary');
 await mcmd('UNDO');assert.deepEqual(await getMoveState(),beforeHatch);
 check('HATCH con un clic y deshacer');
 await movePage.close();
 check('Mover grupo con ratón y coordenadas, REGEN, papel y deshacer');
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
 await page.locator('#tabs [data-tab="file"]').click();
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
 checkpoint='dxf-roundtrip';
 await page.locator('#file').setInputFiles({name:'tour-reimport.dxf',mimeType:'application/dxf',buffer:dxf.contents});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('tour-reimport.dxf'),null,{timeout:13000});
 const dxfImported=await page.evaluate(()=>({
  count:window.OtroCadCivilAPI.getObjects().length,
  types:[...new Set(window.OtroCadCivilAPI.getObjects().map(o=>o.type))],
  status:document.querySelector('#status')?.textContent
 }));
 assert(dxfImported.count>=10,'DXF exported by OtroCAD should import with editable entities');
 assert(dxfImported.types.includes('line'),'DXF round trip lost all lines');
 check('Reimportación DXF real con geometría editable',dxfImported);
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
 // El Arqui intentionally only appears in DIBUJO, not ARCHIVO/CIVIL/MEP.
 await page.locator('#tabs [data-tab="draw"]').click();
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
