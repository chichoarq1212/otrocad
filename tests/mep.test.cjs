'use strict';
const assert=require('node:assert/strict');
const mep=require('../editor/mep.js');
const source=[{x:0,y:0},{x:4,y:0},{x:4,y:3}],original=JSON.stringify(source);
const duct=mep.route(source,{system:'supply',width:400,height:250,flow:800,tag:'IMP-01'});
assert.equal(JSON.stringify(source),original);assert.equal(duct[0].mep.role,'centerline');assert.equal(duct[0].mep.flowM3h,800);
assert.equal(duct[1].pts[0].y,.2);assert.equal(duct[2].pts[0].y,-.2);
assert.deepEqual(duct[1].pts[1],{x:3.8,y:.2});assert.deepEqual(duct[2].pts[1],{x:4.2,y:-.2});
assert.match(duct.at(-1).text,/400×250 mm.*800 m³\/h/);
for(const system of Object.keys(mep.systems)){
 const items=mep.route(source,{system,diameter:110,slope:2});assert.ok(items.every(s=>s.layer===mep.systems[system].layer));assert.match(items.at(-1).text,/i=2%/);
}
const mm=mep.route([{x:0,y:0},{x:4000,y:0}],{system:'supply',units:'mm',width:400});
assert.equal(mm[1].pts[0].y,200);assert.equal(mm.at(-1).textHeightWorld,140);
for(const kind of Object.keys(mep.symbolNames)){
 const normal=mep.symbol(kind,{x:0,y:0},{system:'cold',tag:'EQ-01'}),rotated=mep.symbol(kind,{x:10,y:20},{system:'cold',rotation:90,units:'mm'});
 assert.ok(normal.length>=2);assert.ok(normal.every(o=>['line','poly','polygon','circle','text'].includes(o.type)));assert.equal(normal.filter(o=>o.mep.role==='symbol').length,1);
 for(let i=0;i<normal.length;i++)for(const key of ['a','b'])if(normal[i][key]){assert.ok(Math.abs(rotated[i][key].x-(10-normal[i][key].y*1000))<1e-7);assert.ok(Math.abs(rotated[i][key].y-(20+normal[i][key].x*1000))<1e-7)}
 assert.ok(normal.every(o=>o.groupId===normal[0].groupId));
}
const totals=mep.quantities([...duct,...mep.symbol('diffuser',{x:4,y:3},{system:'supply'})]);assert.equal(totals.length,2);assert.equal(totals[0].length,7);assert.equal(totals[1].count,1);
assert.equal(mep.quantities(mm,'mm')[0].length,4);
assert.throws(()=>mep.route(source,{system:'cold',diameter:0}),/diámetro/);assert.throws(()=>mep.route(source,{system:'supply',width:-4}),/ancho/);
assert.throws(()=>mep.route([{x:0,y:0},{x:0,y:0}],{system:'cold'}),/distintos/);
assert.throws(()=>mep.route([{x:NaN,y:0},{x:1,y:0}],{system:'cold'}),/coordenadas/);
const turn=mep.route([{x:0,y:0},{x:5,y:0},{x:0,y:.001}],{system:'supply'});assert.ok(turn[1].pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
console.log('MEP passed: 14 systems, native symbol catalog, grouped geometry, unit conversion, rotated insertion, duct joins, labels and quantities.');
// Export the actual entities with the editor's writer and read them back.
const fs=require('node:fs'),vm=require('node:vm'),cad=fs.readFileSync('editor/editor.js','utf8');
const fixture=[...duct,...Object.keys(mep.symbolNames).flatMap((kind,i)=>mep.symbol(kind,{x:i*2,y:-4},{system:'cold',tag:kind}))];
const scope={confirm:()=>true,objects:fixture,colors:{General:'#ffffff'},zoom:35,units:'m',distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),$:()=>({})};vm.createContext(scope);
vm.runInContext(cad.slice(cad.indexOf('function buildDxf(){'),cad.indexOf("\n$('#dxf').onclick")),scope);
vm.runInContext(cad.slice(cad.indexOf('const CAD_TEXT_FONT_CATALOG='),cad.indexOf('\nfunction drawEntity(')),scope);
vm.runInContext(cad.slice(cad.indexOf('function parseDxfEntities(source){'),cad.indexOf('\nasync function download(')),scope);
const reopened=vm.runInContext('parseDxfEntities(buildDxf())',scope);
assert.equal(reopened.length,fixture.length,'All route outlines, symbol primitives and labels must survive DXF');
assert.ok(reopened.some(o=>o.type==='text'&&o.text.includes('IMP-01')));assert.ok(reopened.some(o=>o.layer==='MEP-AGUA-FRIA'));
if(process.argv[2])fs.writeFileSync(process.argv[2],vm.runInContext('buildDxf()',scope));
console.log('MEP DXF round-trip passed: complete catalog geometry, units, layers and annotations.');
