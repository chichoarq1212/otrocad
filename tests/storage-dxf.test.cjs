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
context.objects=[{type:'text',a:{x:1,y:2},text:'COCINA',textHeight:14,layer:'Textos'}, {type:'ellipse',a:{x:0,y:0},b:{x:2,y:1}}];
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
