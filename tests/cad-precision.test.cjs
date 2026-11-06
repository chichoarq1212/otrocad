'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('editor/editor.js', 'utf8');
let checkpoints = 0;
const base = {
  objects: [], selected: 0, offsetDistance: 1, offsetDistancePreset: true,
  status: {textContent:''}, distance: (a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  checkpoint:()=>{checkpoints++}, save:()=>{}, applySelection:()=>{}, render:()=>{}
};
vm.createContext(base);
vm.runInContext(src.slice(src.indexOf('function doOffset(q)'),src.indexOf('function handleTap(p)')), base);
function offset(a,b,q,d) {
  base.objects=[{type:'rect',a,b,layer:'General'}]; base.offsetDistance=d; base.selected=0;
  vm.runInContext('doOffset('+JSON.stringify(q)+')',base);
  return base.objects[1];
}
let o=offset({x:0,y:0},{x:10,y:4},{x:10.5,y:2},1);
assert.equal(o.a.x,-1); assert.equal(o.b.y,5);
o=offset({x:0,y:0},{x:10,y:4},{x:5,y:2},1);
assert.equal(o.a.x,1); assert.equal(o.b.y,3);
o=offset({x:0,y:0},{x:10,y:4},{x:11,y:2},5);
assert.equal(o.a.x,-5); assert.equal(o.b.y,9);
const before = checkpoints;
assert.equal(offset({x:0,y:0},{x:10,y:4},{x:5,y:2},2),undefined);
assert.equal(checkpoints,before);
const p={resetLineCoordinates(){},objects:[],start:{x:0,y:0},tool:'polygon',polySides:4,status:{textContent:''},lockedLayers:new Set(),distance:base.distance,$:()=>({value:'General'}),currentStyle:()=>({}),checkpoint:()=>{},save:()=>{},applySelection:()=>{},render:()=>{},updatePrompt:()=>{},clone:x=>JSON.parse(JSON.stringify(x))};
vm.createContext(p);
vm.runInContext(src.slice(src.indexOf('function commitEntity(endPoint)'),src.indexOf('function finishPoly()')),p);
vm.runInContext('commitEntity({x:0,y:2})',p);
assert.ok(Math.abs(p.objects[0].pts[0].x)<1e-9);
assert.ok(Math.abs(p.objects[0].pts[0].y-2)<1e-9);
console.log('Offset rectangular y orientación de polígonos: OK');

const ex = { objects:[], status:{textContent:''}, selectAt:()=>0,
 entitySegments:()=>[[{x:0,y:0},{x:1,y:0}],[{x:1,y:0},{x:1,y:1}]],
 clone:x=>JSON.parse(JSON.stringify(x)), checkpoint:()=>{}, applySelection:()=>{},clearSelection:()=>{},isVisibleModelEntity:()=>true,lockedLayers:new Set(),save:()=>{},render:()=>{} };
vm.createContext(ex);
vm.runInContext(src.slice(src.indexOf('function explodeSelection(indices)'),src.indexOf('let pointers=new Map()')),ex);
ex.objects=[{type:'circle',a:{x:0,y:0},b:{x:2,y:0}}];
vm.runInContext('explodeAt({x:0,y:0})',ex);
assert.equal(ex.objects.length,1); assert.equal(ex.objects[0].type,'circle');
ex.objects=[{type:'rect',a:{x:0,y:0},b:{x:1,y:1}}];
vm.runInContext('explodeAt({x:0,y:0})',ex);
assert.equal(ex.objects.length,2); assert.equal(ex.objects[0].type,'line');
console.log('EXPLODE protege curvas y convierte geometría compatible: OK');

const fillet = {};
vm.createContext(fillet);
vm.runInContext(src.slice(src.indexOf('function lineIntersection('),src.indexOf('function trimOrExtend(')),fillet);
fillet.l1={type:'line',a:{x:0,y:0},b:{x:5,y:0}};
fillet.l2={type:'line',a:{x:0,y:0},b:{x:0,y:5}};
const rounded=vm.runInContext('filletGeometry(l1,l2,{x:4,y:0},{x:0,y:4},1)',fillet);
assert.ok(Math.abs(rounded.t1.x-1)<1e-8); assert.ok(Math.abs(rounded.t2.y-1)<1e-8);
assert.ok(Math.abs(rounded.arc[1].x-(1-Math.SQRT1_2))<1e-8);
assert.ok(Math.abs(rounded.arc[1].y-(1-Math.SQRT1_2))<1e-8);
assert.equal(vm.runInContext('filletGeometry(l1,l2,{x:4,y:0},{x:0,y:4},10)',fillet),null);
assert.equal(vm.runInContext('filletGeometry(l1,l2,{x:4,y:0},{x:0,y:4},0).arc',fillet),null);
console.log('Empalme: tangencia, radio cero y radio excesivo verificados');

const ui={usesLineCoordinates:()=>false,window:{},objects:[{type:'line',a:{x:0,y:0},b:{x:5,y:0},layer:'General'},{type:'line',a:{x:0,y:0},b:{x:0,y:5},layer:'General'}], tool:'fillet',modifyTarget:-1,moveBase:null,status:{textContent:''}, lockedLayers:new Set(),snapPoint:p=>p,world:p=>p,constrain:p=>p,clone:x=>JSON.parse(JSON.stringify(x)),selectAt:p=>p.x>p.y?0:1,applySelection:()=>{},checkpoint:()=>{},save:()=>{},render:()=>{},prompt:()=> '1',$:()=>({value:'General'}),distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)};
vm.createContext(ui);
vm.runInContext(src.slice(src.indexOf('function lineIntersection('),src.indexOf('function trimOrExtend(')),ui);
vm.runInContext(src.slice(src.indexOf('function handleTap(p){'),src.indexOf('function transformEntityGeometry(')),ui);
vm.runInContext('handleTap({x:4,y:0});handleTap({x:0,y:4})',ui);
assert.equal(ui.objects.length,3);assert.equal(ui.objects[2].type,'arc');
assert.ok(Math.abs(ui.objects[0].a.x-1)<1e-8);
assert.ok(Math.abs(ui.objects[1].a.y-1)<1e-8);
console.log('Comando empalme: selección y creación verificadas');

assert.ok(vm.runInContext('filletGeometry(l1,l2,{x:0,y:0},{x:0,y:0},1)',fillet));

const chamferScope = {};
vm.createContext(chamferScope);
vm.runInContext(src.slice(src.indexOf('function lineIntersection('),src.indexOf('function trimOrExtend(')),chamferScope);
const bevel=vm.runInContext('chamferGeometry({type:"line",a:{x:0,y:0},b:{x:5,y:0}},{type:"line",a:{x:0,y:0},b:{x:0,y:5}},{x:4,y:0},{x:0,y:4},1,2)',chamferScope);
assert.ok(bevel);
assert.ok(Math.abs(bevel.t1.x-1)<1e-9 && Math.abs(bevel.t1.y)<1e-9);
assert.ok(Math.abs(bevel.t2.x)<1e-9 && Math.abs(bevel.t2.y-2)<1e-9);
assert.equal(vm.runInContext('chamferGeometry({type:"line",a:{x:0,y:0},b:{x:1,y:0}},{type:"line",a:{x:0,y:0},b:{x:0,y:1}},{x:1,y:0},{x:0,y:1},2,2)',chamferScope),null);
console.log('Chaflán: dos distancias independientes y rechazo de distancias excesivas verificados');

const trim = {
  objects: [], status:{textContent:''}, trimState:{phase:'cut',boundaries:new Set()},
  isVisibleModelEntity:s=>s.visible!==false, entitySegments:s=>[[s.a,s.b]],
  clone:x=>JSON.parse(JSON.stringify(x)), checkpoint:()=>{}, clearSelection:()=>{},save:()=>{},render:()=>{}
};
vm.createContext(trim);
vm.runInContext(src.slice(src.indexOf('function lineIntersection('),src.indexOf('function trimOrExtend(')), trim);
const target={type:'line',a:{x:0,y:0},b:{x:10,y:0}};
const edge1={type:'line',a:{x:3,y:-1},b:{x:3,y:1}};
const edge2={type:'line',a:{x:7,y:-1},b:{x:7,y:1}};
trim.objects=[target,edge1,edge2];trim.trimState.boundaries.add(edge1);
vm.runInContext('quickTrim(0,{x:1,y:0})',trim);
assert.equal(trim.objects[0].a.x,3); assert.equal(trim.objects[0].b.x,10);
trim.objects=[target,edge1,edge2];trim.trimState={phase:'quick',boundaries:new Set()};
vm.runInContext('quickTrim(0,{x:5,y:0})',trim);
assert.equal(trim.objects[0].b.x,3);assert.equal(trim.objects[1].a.x,7);
console.log('TRIM: recorte rápido y bordes elegidos verificados');

const hatchScope={distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)};
vm.createContext(hatchScope);
vm.runInContext(src.slice(src.indexOf('function pointLineDistance('),src.indexOf('function ',src.indexOf('function pointLineDistance(')+10)),hatchScope);
vm.runInContext(src.slice(src.indexOf('function entitySegments('),src.indexOf('function inSelectionRect(')),hatchScope);
vm.runInContext(src.slice(src.indexOf('function pointInPolygon('),src.indexOf('function objectContainsPoint(')),hatchScope);
vm.runInContext(src.slice(src.indexOf('function findHatchFaces('),src.indexOf('function hatchAtPoint(')),hatchScope);
const outer={type:'rect',a:{x:0,y:0},b:{x:10,y:10}},inner={type:'rect',a:{x:4,y:4},b:{x:6,y:6}};
let region=hatchScope.findHatchFaces([outer,inner],{x:1,y:1});assert.equal(region.loops.length,2,'Hatch should preserve an internal island');
region=hatchScope.findHatchFaces([outer,{type:'line',a:{x:5,y:0},b:{x:5,y:10}}],{x:1,y:1});assert.ok(region.loops[0].every(p=>p.x<=5),'Hatch should stop at intersecting divider');
assert.ok(hatchScope.findHatchFaces([{type:'line',a:{x:0,y:0},b:{x:2,y:0}}],{x:1,y:1}).error,'Open boundary must be rejected');
console.log('HATCH: recintos, división, islas y contornos abiertos verificados');
