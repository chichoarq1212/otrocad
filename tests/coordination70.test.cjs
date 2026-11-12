const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../editor/coordination-core70.js'),'utf8'),sandbox);
const core = sandbox.window.OtroCadCoordinationCore70;
const copy = x => JSON.parse(JSON.stringify(x));
const wall = () => ({id:'wall-1',type:'wall',name:'Muro',pos:[0,0,0],rot:[0,0,0],scale:[1,1,1],layer:'base',bim:{level:'Planta baja'},params:{length:5,openings:[{id:'door-1',offset:1,width:1}]}});
const packet = (changes,revision=1) => ({schema:'esquechat-otrocad/1',projectId:'project-1',units:'m',revision,changes});
const added = o => packet([{id:o.id,op:'add',before:null,after:o}]);

test('rechaza unidades, revisiones e IDs duplicados inválidos',()=>{
  const p=added(wall());
  assert.throws(()=>core.validatePacket70({...p,units:'mm'}));
  assert.throws(()=>core.validatePacket70({...p,revision:-1}));
  assert.throws(()=>core.validatePacket70({...p,changes:[...p.changes,...p.changes]}));
});
test('importa muro y abertura y conserva el dibujo ajeno al intercambio',()=>{
  const unrelated={type:'line',a:{x:99,y:0},b:{x:100,y:0}};
  const r=core.previewCadDelta70([unrelated],added(wall()));
  assert.equal(r.changed,1);assert.equal(r.shapes.length,3);
  assert.deepEqual(copy(r.shapes[0]),unrelated);
  assert.deepEqual(r.shapes.slice(1).map(s=>s.link70.role).join(','),'wall,opening:door-1');
});
test('exporta cambio de longitud manteniendo ID y acepta confirmación 3D',()=>{
  const original=wall();const shapes=core.previewCadDelta70([],added(original)).shapes;
  shapes.find(s=>s.link70.role==='wall').b.x=6;
  const delta=core.cadChanges70(shapes,'project-1',{'wall-1':original});
  assert.equal(delta.changes[0].id,'wall-1');assert.equal(delta.changes[0].after.params.length,6);
  const acknowledged=core.previewCadDelta70(shapes,{...delta,revision:2});
  assert.equal(acknowledged.shapes[0].link70.source.params.length,6);
  assert.equal(core.cadChanges70(acknowledged.shapes,'project-1').changes.length,0);
});
test('detecta conflicto sin alterar geometría local',()=>{
  const original=wall();const shapes=core.previewCadDelta70([],added(original)).shapes;
  shapes[0].b.x=6;const before=JSON.stringify(shapes);const after=copy(original);after.params.length=7;
  assert.throws(()=>core.previewCadDelta70(shapes,packet([{id:original.id,op:'update',before:original,after}],2)),/Conflicto/);
  assert.equal(JSON.stringify(shapes),before);
});
test('exporta eliminación de abertura y del muro desde la línea base',()=>{
  const original=wall();const shapes=core.previewCadDelta70([],added(original)).shapes;
  const delta=core.cadChanges70(shapes.filter(s=>s.link70.role==='wall'),'project-1',{'wall-1':original});
  assert.equal(delta.changes[0].after.params.openings.length,0);
  const deletion=core.cadChanges70([],'project-1',{'wall-1':original});
  assert.equal(deletion.changes[0].op,'delete');assert.equal(deletion.changes[0].id,original.id);
});
test('rechaza abertura separada del muro',()=>{
  const shapes=core.previewCadDelta70([],added(wall())).shapes;
  shapes.find(s=>s.link70.role.startsWith('opening:')).a.y=1;
  assert.throws(()=>core.cadChanges70(shapes,'project-1'),/eje del muro/);
});
test('redimensiona huella rectangular y rechaza deformaciones',()=>{
  const slab={...wall(),type:'slab',id:'slab-1',params:{w:4,d:3}};
  const shapes=core.previewCadDelta70([],added(slab)).shapes;
  shapes[0].pts[1].x=5;shapes[0].pts[2].x=5;
  assert.equal(core.cadChanges70(shapes,'project-1').changes[0].after.params.w,5);
  shapes[0].pts[2].y=4;
  assert.throws(()=>core.cadChanges70(shapes,'project-1'),/rectangular/);
});
test('advierte elementos no compatibles y mantiene los restantes',()=>{
  const unsupported={...wall(),id:'mesh-1',type:'mesh'};
  const r=core.previewCadDelta70([],added(unsupported));
  assert.equal(r.changed,0);assert.equal(r.warnings.length,1);assert.equal(r.shapes.length,0);
});
test('aplicación 3D rechaza otro proyecto y capas bloqueadas',()=>{
  const original=wall(),after=copy(original);after.name='Cambiado';
  const doc={objects:[original],layers:[{id:'base',locked:true}],collaboration70:{projectId:'project-1'}};
  const delta=packet([{id:original.id,op:'update',before:original,after}]);
  assert.throws(()=>core.applyDelta70(doc,{...delta,projectId:'other'},()=>{}),/otro proyecto/);
  assert.throws(()=>core.applyDelta70(doc,delta,()=>{}),/bloqueado/);
  assert.equal(doc.objects[0].name,'Muro');
});
