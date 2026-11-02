'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('editor/editor.js', 'utf8');
const base = {
  objects: [], selected: 0, offsetDistance: 1, offsetDistancePreset: true,
  status: {textContent:''}, distance: (a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  checkpoint:()=>{}, save:()=>{}, applySelection:()=>{}, render:()=>{}
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
assert.equal(offset({x:0,y:0},{x:10,y:4},{x:5,y:2},2),undefined);
const p={objects:[],start:{x:0,y:0},tool:'polygon',polySides:4,status:{textContent:''},lockedLayers:new Set(),distance:base.distance,$:()=>({value:'General'}),currentStyle:()=>({}),checkpoint:()=>{},save:()=>{},applySelection:()=>{},render:()=>{},updatePrompt:()=>{},clone:x=>JSON.parse(JSON.stringify(x))};
vm.createContext(p);
vm.runInContext(src.slice(src.indexOf('function commitEntity(endPoint)'),src.indexOf('function finishPoly()')),p);
vm.runInContext('commitEntity({x:0,y:2})',p);
assert.ok(Math.abs(p.objects[0].pts[0].x)<1e-9);
assert.ok(Math.abs(p.objects[0].pts[0].y-2)<1e-9);
console.log('Offset rectangular y orientación de polígonos: OK');
