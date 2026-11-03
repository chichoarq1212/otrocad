const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('editor/editor.js', 'utf8');
const handlers = new Map();
let stored = new Map(), failure = false, warnings = [], downloaded = null, accept = true;
const context = {
  $: selector => { if (!handlers.has(selector)) handlers.set(selector, {}); return handlers.get(selector); },
  objects: [{type:'line', a:{x:0,y:0}, b:{x:2,y:0},layer:'Muros'}],
  undo:[], redo:[], clone: x => JSON.parse(JSON.stringify(x)),
  localStorage: {setItem(k,v){if(failure)throw Error('quota');stored.set(k,v)},getItem:k=>stored.get(k)||null},
  alert: message=>warnings.push(message), confirm:()=>accept,
  clearSelection:()=>{}, render:()=>{}, status:{textContent:''},
  colors:{General:'#ffffff'}, units:'m', zoom:35, distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  download:(name, content)=>{downloaded={name,content}}
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('let storageWarningShown=false;'),source.indexOf('function selectedItems()')),context);
vm.runInContext(source.slice(source.indexOf('function save(){'),source.indexOf('function world(')),context);
assert.equal(vm.runInContext('checkpoint()',context),true);
assert.equal(JSON.parse(stored.get('otrocad-drawing-previous')).shapes[0].b.x,2);
vm.runInContext('objects[0].b.x=4; save()',context);
assert.equal(JSON.parse(stored.get('otrocad-drawing'))[0].b.x,4);
failure=true;
assert.equal(vm.runInContext('save()',context),false);
assert.equal(warnings.length,1);
assert.equal(JSON.parse(stored.get('otrocad-drawing'))[0].b.x,4);
vm.runInContext(source.slice(source.indexOf("function buildDxf(){"),source.indexOf("\n$('#pdf').onclick")),context);
context.objects=[{type:'text',a:{x:1,y:2},text:'COCINA',textHeight:14,layer:'Textos'}, {type:'hatch',a:{x:0,y:0},b:{x:2,y:1}}];
accept=false;handlers.get('#dxf').onclick();assert.equal(downloaded,null, 'No descargar si se rechaza pérdida de datos');
accept=true;handlers.get('#dxf').onclick();assert.match(downloaded.content,/\r\nTEXT\r\n/);assert.match(downloaded.content,/\r\nCOCINA\r\n/);
console.log('Storage and DXF checks passed: backup, failed storage warning, export loss warning, text entity');

const demoScope = {window:{}};
vm.runInNewContext(fs.readFileSync('editor/demo/vivienda.js','utf8'),demoScope);
const demo = demoScope.window.otroCadDemo.shapes;
assert.ok(demo.length > 100);
for (const name of ['SALA','COMEDOR','COCINA','DORMITORIO 1','DORMITORIO 2','BAÑO']) assert.ok(demo.some(x=>x.type==='text' && x.text===name));
for (const type of ['line','rect','arc','hatch','dim']) assert.ok(demo.some(x=>x.type===type));
console.log('Demo checks passed: rooms and editable drawing entities');
const parserCode = source.slice(source.indexOf('function parseDxfEntities(source){'), source.indexOf('\nasync function download('));
vm.runInContext(parserCode,context);
const dxf = ['0','SECTION','2','BLOCKS','0','LINE','10','99','20','99','11','100','21','100','0','ENDSEC',
'0','SECTION','2','ENTITIES','0','LINE','8','Muro','420','5682920','10','0','20','0','11','4','21','0',
'0','ARC','10','0','20','0','40','2','50','0','51','90','0','HATCH','8','Muros',
'0','LWPOLYLINE','90','2','70','0','10','0','20','0','42','0.5','10','1','20','0','0','ENDSEC','0','EOF'].join('\n');
context.dxf=dxf;
const parsed=vm.runInContext('parseDxfEntities(dxf)',context);
assert.equal(parsed.length,3, 'No se deben importar las definiciones dentro de BLOCKS como geometría suelta');
assert.equal(parsed[1].type,'arc');
assert.ok(Math.abs(parsed[1].pts[2].y-2)<1e-9);
assert.ok(parsed.importWarnings.some(s=>s.includes('HATCH')));
assert.ok(parsed.importWarnings.some(s=>s.includes('curvas')));
assert.equal(parsed[0].color, '#56b6e8');
console.log('DXF import checks passed: section boundaries, arc, colors and unsupported objects');
context.objects=[{type:'arc',pts:[{x:1,y:0},{x:0,y:1},{x:-1,y:0}]}, {type:'ellipse',a:{x:3,y:4},b:{x:5,y:5}}];
downloaded=null;handlers.get('#dxf').onclick();
assert.match(downloaded.content,/\r\nARC\r\n/);
assert.match(downloaded.content,/\r\nELLIPSE\r\n/);
context.roundtrip=downloaded.content;
const roundtrip=vm.runInContext('parseDxfEntities(roundtrip)',context);
assert.equal(roundtrip[0].type,'arc');assert.equal(roundtrip[1].type,'ellipse');assert.equal(roundtrip.drawingUnits,'m');
assert.ok(Math.abs(roundtrip[1].b.x-5)<1e-9);assert.ok(Math.abs(roundtrip[1].b.y-5)<1e-9);
console.log('DXF round-trip checks passed: native arcs and aligned ellipses');
const selectionScope = {objects:[],zoom:100,hiddenLayers:new Set(),lockedLayers:new Set(),screen:p=>({x:p.x*100,y:-p.y*100}),distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)};
vm.createContext(selectionScope);
vm.runInContext(source.slice(source.indexOf('function arcParams('),source.indexOf('\nconst CAD_THEMES=')),selectionScope);
vm.runInContext(source.slice(source.indexOf('function selectAt('),source.indexOf('function gripDescriptors(')),selectionScope);
selectionScope.objects=[{type:'arc',pts:[{x:1,y:0},{x:0,y:1},{x:-1,y:0}]}];
assert.equal(vm.runInContext('selectAt({x:0,y:1})',selectionScope),0, 'Seleccionar un arco por su curva');
assert.equal(vm.runInContext('selectAt({x:0,y:-1})',selectionScope),-1, 'No seleccionar el arco por la semicircunferencia opuesta');
selectionScope.objects=[{type:'ellipse',a:{x:0,y:0},b:{x:2,y:1}}];
assert.equal(vm.runInContext('selectAt({x:-2,y:0})',selectionScope),0, 'Seleccionar el lado negativo de la elipse');
assert.equal(vm.runInContext('selectAt({x:0,y:0})',selectionScope),-1, 'No seleccionar toda el área interior');
console.log('Selection checks passed: arcs and full ellipses');
selectionScope.world = p=>({x:p.x/100,y:-p.y/100});
vm.runInContext(source.slice(source.indexOf('function boundsPoints(o){'),source.indexOf("\n$('#fit').onclick")),selectionScope);
const circleBounds=selectionScope.boundsPoints({type:'circle',a:{x:0,y:0},b:{x:2,y:0}});
assert.ok(circleBounds.some(p=>p.x===-2&&p.y===-2));
const ellipseBounds=selectionScope.boundsPoints({type:'ellipse',a:{x:5,y:5},b:{x:7,y:6}});
assert.ok(ellipseBounds.some(p=>p.x===3&&p.y===4));
const arcBounds=selectionScope.boundsPoints({type:'arc',pts:[{x:1,y:0},{x:0,y:1},{x:-1,y:0}]});
assert.ok(arcBounds.some(p=>Math.abs(p.y-1)<1e-9));
console.log('Fit checks passed: circle, ellipse and arc extents');
(async()=>{
 context.objects=[{type:'line',a:{x:0,y:0},b:{x:1,y:1}}];
 let written='',closed=false;
 context.window={showSaveFilePicker:async()=>({createWritable:async()=>({write:async value=>{written=value},close:async()=>{closed=true}})})};
 await handlers.get('#saveAsDxf').onclick();
 assert.match(written,/\r\nLINE\r\n/);assert.equal(closed,true);assert.match(context.status.textContent,/guardado/i);
 context.window={};context.prompt=()=> 'Plano/prueba';downloaded=null;
 await handlers.get('#saveAsDxf').onclick();
 assert.equal(downloaded.name,'Plano_prueba.dxf');
 console.log('Save-as checks passed: file picker and download fallback');
})().catch(error=>{console.error(error);process.exitCode=1});
vm.runInContext(source.slice(source.indexOf('function entitySegments(s){'),source.indexOf('function lineIntersection(')),selectionScope);
selectionScope.objects=[{type:'arc',pts:[{x:1,y:0},{x:0,y:1},{x:-1,y:0}]}];
let segments=selectionScope.entitySegments(selectionScope.objects[0]);
assert.ok(segments.flat().every(p=>Math.abs(p.x)<=1.001&&p.y>=-0.001&&p.y<=1.001),'Segmentos del arco deben estar en coordenadas del dibujo');
assert.deepEqual(Array.from(selectionScope.selectByWindow({left:-1.2,right:1.2,bottom:-.2,top:1.2},true)),[0]);
selectionScope.objects=[{type:'circle',a:{x:0,y:0},b:{x:10,y:0}}];
assert.deepEqual(Array.from(selectionScope.selectByWindow({left:-.5,right:.5,bottom:-.5,top:.5},false)),[],'Una ventana dentro de un círculo no cruza su contorno');
console.log('Window selection checks passed: world-space arcs and crossing boundaries');
context.objects=[{type:'hatch',a:{x:1,y:2},b:{x:3,y:4},hatchPattern:'SOLID',hatchOpacity:1,layer:'Muros',color:'#850e1d'}];
accept=true;downloaded=null;handlers.get('#dxf').onclick();
assert.match(downloaded.content,/\r\nHATCH\r\n/);
context.roundtrip=downloaded.content;
const wallRoundtrip=vm.runInContext('parseDxfEntities(roundtrip)',context);
assert.equal(wallRoundtrip.length,1);assert.equal(wallRoundtrip[0].type,'hatch');assert.equal(wallRoundtrip[0].hatchOpacity,1);
assert.equal(wallRoundtrip[0].a.x,1);assert.equal(wallRoundtrip[0].b.y,4);
console.log('Solid wall hatch DXF round-trip passed');
const geometryScope={};vm.createContext(geometryScope);
vm.runInContext(source.slice(source.indexOf('function transformEntityGeometry('),source.indexOf('function translate(')),geometryScope);
geometryScope.rectangle={type:'rect',a:{x:0,y:0},b:{x:2,y:1}};
vm.runInContext('transformEntityGeometry(rectangle,p=>({x:(p.x-p.y)/Math.SQRT2,y:(p.x+p.y)/Math.SQRT2}),false)',geometryScope);
assert.equal(geometryScope.rectangle.type,'polygon');assert.equal(geometryScope.rectangle.pts.length,4);
assert.ok(Math.abs(geometryScope.rectangle.pts[2].x-1/Math.SQRT2)<1e-9);
console.log('Rectangle transformation check passed');
const groupScope={objects:[{groupId:'a',layer:'General'},{groupId:'a',layer:'General'},{groupId:'b',layer:'General'}],selected:-1,selectedSet:new Set(),hiddenLayers:new Set(),lockedLayers:new Set()};
vm.createContext(groupScope);
vm.runInContext(source.slice(source.indexOf('function selectedItems()'),source.indexOf('function clearSelection()')),groupScope);
vm.runInContext('applySelection([0])',groupScope);
assert.deepEqual(Array.from(vm.runInContext('selectedItems()',groupScope)),[0,1]);
const catalogScope={window:{}};vm.runInNewContext(fs.readFileSync('editor/library/furnishings.js','utf8'),catalogScope);
const sofa=catalogScope.window.otroCadFurnitureCatalog.find(item=>item.id==='sofa');
assert.ok(Math.abs(sofa.width-2.1336)<1e-6);assert.ok(sofa.shapes.length>1);
console.log('Furniture checks passed: grouped selection and true-scale CC0 sofa');
const tapScope={tool:'text',start:null,units:'m',objects:[],status:{textContent:''},lockedLayers:new Set(),snapPoint:p=>p,world:p=>p,constrain:p=>p,prompt:()=> 'SALA',clone:x=>JSON.parse(JSON.stringify(x)),currentStyle:()=>({layer:'Textos'}),checkpoint:()=>{},save:()=>{},applySelection:()=>{},render:()=>{},$:(id)=>({value:id==='#layer'?'General':''}),pointFromInputs:()=>null,document:{activeElement:null},commitEntity:p=>{tapScope.committed=p}};
vm.createContext(tapScope);vm.runInContext(source.slice(source.indexOf('function handleTap(p){'),source.indexOf('function transformEntityGeometry(')),tapScope);
vm.runInContext('handleTap({x:2,y:3})',tapScope);assert.equal(tapScope.objects[0].text,'SALA');assert.equal(tapScope.objects[0].a.x,2);
tapScope.tool='dimaligned';tapScope.start={x:0,y:0};vm.runInContext('handleTap({x:3,y:4})',tapScope);assert.equal(tapScope.committed.x,3);assert.equal(tapScope.committed.y,4);
console.log('Text and aligned dimension creation checks passed');
const snapScope={osnapOn:true,osEnd:false,osMid:false,osCenter:false,osQuadrant:true,osIntersection:false,snapRadius:12,zoom:100,objects:[{type:'circle',a:{x:0,y:0},b:{x:2,y:0}}],hiddenLayers:new Set(),distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),pointLineDistance:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)},entitySegments:s=>[[s.a,s.b]]};
vm.createContext(snapScope);vm.runInContext(source.slice(source.indexOf('function lineIntersection('),source.indexOf('function trimOrExtend(')),snapScope);vm.runInContext(source.slice(source.indexOf('function snapCandidate('),source.indexOf('function snapPoint(')),snapScope);
let snap=vm.runInContext('snapCandidate({x:0.03,y:2.02})',snapScope);assert.equal(snap.type,'CUADRANTE');assert.equal(snap.point.y,2);
snapScope.osQuadrant=false;snapScope.osIntersection=true;snapScope.objects=[{type:'line',a:{x:-1,y:0},b:{x:1,y:0}},{type:'line',a:{x:0,y:-1},b:{x:0,y:1}}];
snap=vm.runInContext('snapCandidate({x:0.02,y:0.02})',snapScope);assert.equal(snap.type,'INTERSECCIÓN');assert.equal(snap.point.x,0);assert.equal(snap.point.y,0);
console.log('Object snap checks passed: quadrant and line intersection');
tapScope.tool='measure';tapScope.start=null;tapScope.temp=null;tapScope.updatePrompt=()=>{};tapScope.distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
vm.runInContext('handleTap({x:0,y:0});handleTap({x:3,y:4})',tapScope);
assert.match(tapScope.status.textContent,/Distancia: 5\.000 m/);assert.equal(tapScope.start,null);
console.log('Distance measurement check passed');

const importFixture=['0','SECTION','2','BLOCKS','0','BLOCK','2','WALL','10','1','20','0','0','LINE','8','Muros','10','1','20','0','11','3','21','0','0','ENDBLK','0','BLOCK','2','*D1','10','0','20','0','0','LINE','10','0','20','1','11','2','21','1','0','MTEXT','10','1','20','1','40','0.2','1','2.00','0','ENDBLK','0','ENDSEC','0','SECTION','2','ENTITIES','0','INSERT','2','WALL','10','10','20','5','0','DIMENSION','2','*D1','0','HATCH','70','1','91','1','92','3','93','3','10','0','20','0','10','2','20','0','10','1','20','1','97','0','0','TEXT','10','0','20','0','40','1','50','90','1','MURO','0','ENDSEC','0','EOF'].join('\n');
const imported=context.parseDxfEntities(importFixture);
assert.ok(imported.some(x=>x.type==='line'&&x.a.x===10&&x.b.x===12&&x.a.y===5),'INSERT must translate block coordinates');
assert.ok(imported.some(x=>x.groupId?.startsWith('dxf-dimension')&&x.type==='text'&&x.text==='2.00'),'DIMENSION graphics should retain label');
assert.ok(imported.some(x=>x.type==='polygon'&&x.solidFill&&x.pts.length===3),'solid polygon hatch should be retained');
assert.ok(imported.some(x=>x.type==='text'&&x.text==='MURO'&&x.textRotation===90),'rotated text should retain its angle');
console.log('DXF checks passed: block translation, dimension graphics, polygon hatch and rotated text');


const transformedBlockFixture=[
 '0','SECTION','2','BLOCKS',
 '0','BLOCK','2','DOOR','10','1','20','0',
 '0','LINE','8','Muros','10','1','20','0','11','3','21','0',
 '0','TEXT','8','Textos','10','1','20','1','40','0.5','50','0','1','PUERTA',
 '0','ENDBLK','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','INSERT','2','DOOR','10','10','20','20','41','2','42','1','50','90',
 '0','ENDSEC','0','EOF'
].join('\n');
const transformedBlocks=context.parseDxfEntities(transformedBlockFixture);
const transformedLine=transformedBlocks.find(x=>x.type==='line');
const transformedText=transformedBlocks.find(x=>x.type==='text');
assert.ok(transformedLine,'Rotated/scaled block line should import');
assert.ok(Math.abs(transformedLine.a.x-10)<1e-8&&Math.abs(transformedLine.a.y-20)<1e-8,'Block base point should align with insertion point');
assert.ok(Math.abs(transformedLine.b.x-10)<1e-8&&Math.abs(transformedLine.b.y-24)<1e-8,'Block line should preserve scale and 90-degree rotation');
assert.ok(transformedText,'Block text should import');
assert.ok(Math.abs(transformedText.a.x-9)<1e-8&&Math.abs(transformedText.a.y-20)<1e-8,'Block text position should be transformed');
assert.ok(Math.abs(transformedText.textRotation-90)<1e-8,'Block text rotation should be transformed');
assert.ok(transformedText.textHeightWorld>0.7&&transformedText.textHeightWorld<0.71,'Block text height should follow geometric scale');

const minsertFixture=[
 '0','SECTION','2','BLOCKS',
 '0','BLOCK','2','UNIT','10','0','20','0',
 '0','LINE','10','0','20','0','11','1','21','0',
 '0','ENDBLK','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','MINSERT','2','UNIT','10','10','20','20','70','2','71','2','44','5','45','3',
 '0','ENDSEC','0','EOF'
].join('\n');
const minserted=context.parseDxfEntities(minsertFixture).filter(x=>x.type==='line');
assert.equal(minserted.length,4,'MINSERT should expand its row/column array');
assert.ok(minserted.some(x=>Math.abs(x.a.x-15)<1e-8&&Math.abs(x.a.y-20)<1e-8),'MINSERT column spacing should be retained');
assert.ok(minserted.some(x=>Math.abs(x.a.x-10)<1e-8&&Math.abs(x.a.y-23)<1e-8),'MINSERT row spacing should be retained');

const legacyPolylineFixture=[
 '0','SECTION','2','ENTITIES',
 '0','POLYLINE','8','Muros','66','1','70','1',
 '0','VERTEX','10','0','20','0',
 '0','VERTEX','10','2','20','0',
 '0','VERTEX','10','1','20','1',
 '0','SEQEND',
 '0','POLYLINE','8','Muros','66','1','70','0',
 '0','VERTEX','10','0','20','0','42','0.41421356237',
 '0','VERTEX','10','2','20','0',
 '0','SEQEND',
 '0','LWPOLYLINE','8','Muros','90','2','70','0',
 '10','0','20','0','42','0.41421356237',
 '10','2','20','0',
 '0','ENDSEC','0','EOF'
].join('\n');
const legacyPolylines=context.parseDxfEntities(legacyPolylineFixture);
const closedLegacy=legacyPolylines.find(x=>x.type==='polygon');
const curvedLegacy=legacyPolylines.find(x=>x.type==='poly');
assert.ok(closedLegacy&&closedLegacy.pts.length===3,'Legacy closed POLYLINE should import as a polygon');
assert.ok(curvedLegacy&&curvedLegacy.pts.length>3,'Legacy bulged POLYLINE should be tessellated into curve points');
assert.ok(curvedLegacy.pts.some(p=>p.y<0),'Bulge direction should be preserved');
const curvedLight=legacyPolylines.filter(x=>x.type==='poly').at(-1);
assert.ok(curvedLight&&curvedLight.pts.length>3,'LWPOLYLINE bulges should be tessellated too');
console.log('Advanced DXF import checks passed: scaled/rotated blocks, MINSERT arrays and legacy/bulged polylines');


// Real architectural DWG compatibility: hatch islands, curved edges, nested dimension symbols, block attributes.
const hatchLoopsFixture=[
 '0','SECTION','2','ENTITIES',
 '0','HATCH','8','Pisos','2','SOLID','70','1','91','2',
 '92','3','72','0','73','1','93','4',
 '10','0','20','0','10','10','20','0','10','10','20','10','10','0','20','10','97','0',
 '92','3','72','0','73','1','93','4',
 '10','3','20','3','10','7','20','3','10','7','20','7','10','3','20','7','97','0',
 '75','1','76','1','98','0',
 '0','HATCH','8','Detalles','2','ANSI31','70','0','91','1',
 '92','1','93','1','72','2','10','20','20','20','40','2','50','0','51','360','73','1','97','0',
 '75','1','76','1','52','45','41','1','78','1','53','45','43','0','44','0','45','0','46','0.25','79','0','98','0',
 '0','ENDSEC','0','EOF'
].join('\n');
const architecturalHatches=context.parseDxfEntities(hatchLoopsFixture);
assert.equal(architecturalHatches.length,2,'Both solid hatch with island and curved patterned hatch must import');
assert.equal(architecturalHatches[0].type,'polygon');
assert.equal(architecturalHatches[0].hatchLoops.length,2,'Interior island/hole must not be lost');
assert.equal(architecturalHatches[0].solidFill,true);
assert.equal(architecturalHatches[1].type,'polygon');
assert.equal(architecturalHatches[1].hatchPattern,'ANSI31');
assert.ok(architecturalHatches[1].pts.length>20,'Arc boundary should be tessellated');
assert.ok(!architecturalHatches.importWarnings.some(w=>w.includes('HATCH')),'Supported hatch geometry must not be marked omitted');
context.objects=architecturalHatches;accept=true;downloaded=null;handlers.get('#dxf').onclick();
assert.match(downloaded.content,/\r\nHATCH\r\n/);
const hatchRoundtrip=context.parseDxfEntities(downloaded.content);
assert.equal(hatchRoundtrip[0].hatchLoops.length,2,'DXF export must retain the hole');
assert.equal(hatchRoundtrip[1].hatchPattern,'ANSI31','DXF export must retain hatch pattern name');
console.log('Architectural HATCH checks passed: curved edges, islands, pattern and DXF round-trip');

const dimensionsAndAttributes=[
 '0','SECTION','2','BLOCKS',
 '0','BLOCK','2','ARROW','10','0','20','0',
 '0','LINE','10','0','20','0','11','1','21','0','0','ENDBLK',
 '0','BLOCK','2','*D7','10','0','20','0',
 '0','LINE','10','0','20','0','11','10','21','0',
 '0','INSERT','2','ARROW','10','10','20','0','0','ENDBLK',
 '0','BLOCK','2','LABEL','10','0','20','0',
 '0','ATTDEF','70','0','2','NUM','1','PENDIENTE','10','0','20','0',
 '0','LINE','10','0','20','0','11','2','21','0','0','ENDBLK',
 '0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','DIMENSION','2','*D7',
 '0','INSERT','2','LABEL','10','5','20','5','66','1',
 '0','ATTRIB','2','NUM','1','DEPTO 1','10','5','20','5','40','0.3',
 '0','SEQEND',
 '0','MTEXT','10','1','20','1','40','0.4','1','{\\fArial|b1;SALA\\P\\S1#2; m}',
 '0','VIEWPORT','10','0','20','0','40','5','41','3','69','2',
 '0','ENDSEC','0','EOF'
].join('\n');
const architecturalDims=context.parseDxfEntities(dimensionsAndAttributes);
assert.equal(architecturalDims.filter(o=>o.groupId?.startsWith('dxf-dimension')).length,2,'Dimension nested INSERT arrow must import');
assert.ok(architecturalDims.some(o=>o.text==='DEPTO 1'),'Block ATTRIB must appear as editable text');
assert.ok(!architecturalDims.some(o=>o.text==='PENDIENTE'),'Non-constant ATTDEF should not duplicate the inserted attribute');
assert.ok(architecturalDims.some(o=>o.text==='SALA\n1/2 m'),'MTEXT formatting must decode into readable text');
assert.ok(architecturalDims.some(o=>o.mtextRaw?.includes('\\fArial')),'Original MTEXT formatting should be retained for export');
assert.ok(!architecturalDims.importWarnings.some(w=>/símbolos de cota|VIEWPORT|ATTDEF/.test(w)),'No false omission warning for recovered symbols/attributes');
assert.ok(architecturalDims.importNotes.some(w=>w.includes('DIMENSION')));
console.log('Architectural DIMENSION/INSERT checks passed: nested symbols, attributes, formatted MTEXT and viewports');

const inheritedLayerFixture=[
 '0','SECTION','2','BLOCKS','0','BLOCK','2','MURO','10','0','20','0',
 '0','LINE','8','0','10','0','20','0','11','2','21','0','0','ENDBLK','0','ENDSEC',
 '0','SECTION','2','ENTITIES','0','INSERT','2','MURO','8','Arquitectura','10','5','20','5',
 '0','ENDSEC','0','EOF'
].join('\n');
const inheritedLine=context.parseDxfEntities(inheritedLayerFixture).find(o=>o.type==='line');
assert.equal(inheritedLine.layer,'Arquitectura','Layer 0 geometry inside a block must inherit INSERT layer');
console.log('INSERT layer inheritance check passed');


const dimensionDefpointsFixture=[
 '0','SECTION','2','BLOCKS',
 '0','BLOCK','2','*D88','10','0','20','0',
 '0','LINE','8','COTAS','10','0','20','0','11','3','21','0',
 '0','POINT','8','DEFPOINTS','10','0','20','0',
 '0','POINT','8','DEFPOINTS','10','3','20','0',
 '0','TEXT','8','COTAS','10','1','20','0.2','40','0.3','1','3.00',
 '0','ENDBLK','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','DIMENSION','2','*D88','8','COTAS',
 '0','POINT','8','Marcadores','10','8','20','8',
 '0','ENDSEC','0','EOF'
].join('\n');
const defpointEntities=context.parseDxfEntities(dimensionDefpointsFixture);
assert.equal(defpointEntities.filter(o=>o.groupId?.startsWith('dxf-dimension')).length,2,'Dimension geometry must not create visible DEFPOINTS markers');
assert.ok(!defpointEntities.importWarnings.some(w=>w.includes('DIMENSION')),'DEFPOINTS references are not missing dimension graphics');
assert.equal(defpointEntities.filter(o=>o.type==='point').length,1,'Visible POINT should remain editable');
context.objects=defpointEntities;downloaded=null;accept=true;handlers.get('#dxf').onclick();
assert.match(downloaded.content,/\r\nPOINT\r\n/,'Visible POINT should survive DXF export');

const nestedFailureFixture=[
 '0','SECTION','2','BLOCKS',
 '0','BLOCK','2','*D99','10','0','20','0',
 '0','LINE','10','0','20','0','11','2','21','0',
 '0','UNSUPPORTED_DWG_ENTITY','10','1','20','1',
 '0','ENDBLK','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','DIMENSION','2','*D99',
 '0','ENDSEC','0','EOF'
].join('\n');
const nestedFailure=context.parseDxfEntities(nestedFailureFixture);
assert.ok(nestedFailure.importWarnings.some(w=>w.includes('DIMENSION con elementos gráficos no compatibles')));
assert.equal(nestedFailure.importDiagnostics['DIMENSION → UNSUPPORTED_DWG_ENTITY omitido'],1,'Report should explain what is missing inside a dimension');
console.log('Dimension DEFPOINTS and nested diagnostics checks passed');
