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
assert.equal(JSON.parse(stored.get('otrocad-drawing-previous'))[0].b.x,2);
vm.runInContext('objects[0].b.x=4; save()',context);
assert.equal(JSON.parse(stored.get('otrocad-drawing'))[0].b.x,4);
failure=true;
assert.equal(vm.runInContext('save()',context),false);
assert.equal(warnings.length,1);
assert.equal(JSON.parse(stored.get('otrocad-drawing'))[0].b.x,4);
vm.runInContext(source.slice(source.indexOf("$('#dxf').onclick="),source.indexOf("\n$('#pdf').onclick")),context);
context.objects=[{type:'text',a:{x:1,y:2},text:'COCINA',textHeight:14,layer:'Textos'}, {type:'hatch',a:{x:0,y:0},b:{x:2,y:1}}];
accept=false;handlers.get('#dxf').onclick();assert.equal(downloaded,null, 'No descargar si se rechaza pérdida de datos');
accept=true;handlers.get('#dxf').onclick();assert.match(downloaded.content,/\r\nTEXT\r\n/);assert.match(downloaded.content,/\r\nCOCINA\r\n/);
console.log('Storage and DXF checks passed: backup, failed storage warning, export loss warning, text entity');

const demoScope = {window:{}};
vm.runInNewContext(fs.readFileSync('editor/demo/vivienda.js','utf8'),demoScope);
const demo = demoScope.window.otroCadDemo.shapes;
assert.ok(demo.length > 100);
for (const name of ['SALA','COMEDOR','COCINA','DORMITORIO 1','DORMITORIO 2','BANO']) assert.ok(demo.some(x=>x.type==='text' && x.text===name));
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
assert.equal(roundtrip[0].type,'arc');assert.equal(roundtrip[1].type,'ellipse');
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
