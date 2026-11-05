'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p=require('../editor/arqui-planner.js');
const refs=require('../editor/arqui-references.js');
const prompt=p.parsePrompt('Diseña una vivienda de dos plantas, terreno de 12 × 20 m, tres dormitorios con garaje.');
assert.equal(prompt.lotWidth,12);
assert.equal(prompt.lotDepth,20);
assert.equal(prompt.floors,2);
assert.equal(prompt.bedrooms,3);
assert.equal(prompt.garage,true);
assert.equal(p.parsePrompt('Casa en terreno 12x20 con 3 habitaciones sin garaje').garage,false);
const plan=p.design({lotWidth:12,lotDepth:20,floors:1,bedrooms:3,garage:true});
assert.equal(plan.floors.length,1);
assert.equal(plan.floors[0].rooms.filter(r=>r.kind==='bedroom').length,3);
assert.ok(plan.garage&&plan.garage.width>=3&&plan.garage.depth>=5.2);
assert.ok(plan.garage.x+plan.garage.width<=plan.spec.lotWidth+.001);
assert.ok(plan.warnings.length>0);
assert.match(plan.provenance,/NO se han consultado/);
for(const floor of plan.floors){
 const hall=floor.rooms.find(r=>r.kind==='circulation');
 assert.ok(hall&&hall.width>=1.2,'corridor must meet schematic accessibility target');
 for(const room of floor.rooms){
  assert.ok(room.area>0&&room.depth>0&&room.width>0);
  assert.ok(room.x>=0&&room.y>=0&&room.x+room.width<=floor.width+.001&&room.y+room.depth<=floor.depth+.001);
  if(room.kind==='bedroom')assert.ok(room.width>=2.8&&room.area>=9);
 }
}
const two=p.design({lotWidth:12,lotDepth:20,floors:2,bedrooms:3,garage:true});
assert.equal(two.floors.length,2);
assert.ok(two.floors[0].rooms.some(x=>x.name==='ESCALERA'));
assert.ok(two.floors[1].rooms.some(x=>x.name==='DORMITORIO PRINCIPAL'));
assert.equal(two.floors[1].rooms.filter(x=>x.kind==='bedroom').length,3);
assert.ok(two.floors[1].x>two.floors[0].x+two.floors[0].width);
const initial=JSON.stringify(plan);
const entities=p.toEntities(plan,{origin:{x:500,y:600},units:'cm',projectId:'test-arqui-1'});
assert.ok(entities.length>70);
assert.ok(entities.every(x=>x.aiArchitect===true&&x.aiProjectId==='test-arqui-1'));
assert.ok(entities.some(x=>x.layer==='AI-ARQ-ABERTURAS'&&x.type==='arc'));
assert.ok(entities.some(x=>x.layer==='AI-ARQ-VENTANAS'&&x.type==='line'));
assert.ok(entities.some(x=>x.layer==='AI-ARQ-COTAS'&&x.type==='text'));
assert.ok(entities.some(x=>x.text?.includes('DORMITORIO')));
assert.ok(entities.some(x=>x.text?.includes('SALA')));
assert.ok(entities.some(x=>x.text?.includes('GARAJE')||x.text?.includes('ESTACIONAMIENTO')));
assert.ok(entities.filter(x=>x.type==='line').every(x=>Number.isFinite(x.a.x)&&Number.isFinite(x.a.y)&&Number.isFinite(x.b.x)&&Number.isFinite(x.b.y)));
assert.ok(entities.some(x=>x.a?.x>1000),'units conversion to centimetres required');
assert.equal(JSON.stringify(plan),initial,'conversion must not mutate plan');
const e2=p.toEntities(two,{units:'m',projectId:'test-two'});
assert.ok(e2.length>entities.length);
assert.equal(e2.filter(x=>x.type==='text'&&x.text.includes('PLANTA')).length,2);
assert.throws(()=>p.design({lotWidth:9,lotDepth:13,bedrooms:4}),/fondo|profundidades/i);
assert.throws(()=>p.design({lotWidth:6,lotDepth:20}),/Ancho/i);
assert.throws(()=>p.design({lotWidth:9,lotDepth:17,bedrooms:4,floors:1}),/profundidades/i);
const kitchen=p.parsePrompt('agranda cocina 50 cm',plan.spec);
assert.equal(kitchen.kitchenExtra,.5);
const bigger=p.design(kitchen);
assert.ok(bigger.floors[0].rooms.find(x=>x.name==='COCINA').area>
 plan.floors[0].rooms.find(x=>x.name==='COCINA').area);
const storage={
 data:new Map(),getItem(x){return this.data.get(x)||null},setItem(k,v){this.data.set(k,v)}
};
assert.deepEqual(refs.get(storage),[]);
const entry=refs.makeEntry('Neufert','Capítulo autorizado · vivienda',
 'Estudio de circulación de puertas, ventanas y escaleras. '.repeat(5));
assert.ok(entry.sections.length>0);
refs.add(entry,storage);
assert.equal(refs.get(storage)[0].source,'Neufert');
const found=refs.search('ventanas escaleras',refs.get(storage));
assert.ok(found.length>0&&found[0].source==='Neufert');
refs.remove('Neufert',entry.title,storage);
assert.equal(refs.get(storage).length,0);
assert.throws(()=>refs.makeEntry('Plazola','libro completo','A'.repeat(190000)),/180 kB/);
const html=fs.readFileSync('editor/index.html','utf8');
const assistant=fs.readFileSync('editor/arqui-assistant.js','utf8');
const css=fs.readFileSync('editor/arqui-assistant.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const build=fs.readFileSync('scripts/build-pages.cjs','utf8');
const img=fs.readFileSync('editor/assets/el-arqui.webp');
assert.equal(img.toString('ascii',0,4),'RIFF');
assert.equal(img.toString('ascii',8,12),'WEBP');
assert.equal(img.toString('ascii',12,16),'VP8X');
assert.ok((img[20]&0x10)!==0,'User avatar must retain transparent alpha');
assert.match(assistant,/El Arqui · Motor Local/);
assert.match(assistant,/assets\/el-arqui\.webp/);
assert.match(assistant,/allowed=new Set\(\['draw'/,'El Arqui appears only on architectural CAD tabs');
assert.match(assistant,/api\.addObjectsAnimated/);
assert.match(assistant,/api\.replaceObjects/);
assert.match(assistant,/api\.removeObjects/);
assert.match(assistant,/Tu anteproyecto ya está dibujado|Dibujar plano completo en CAD/);
assert.match(assistant,/confirm\(/,'Explicit approval before touching existing CAD');
assert(!assistant.includes('referenceExcerpts'),'Reference excerpts stay on device; no model transport');
assert.match(css,/orientation:landscape/);
for(const name of ['arqui-planner.js','arqui-knowledge.js','arqui-house-layout.js','arqui-references.js','arqui-assistant.js']){
 assert.ok(html.includes('src="'+name+'"'));
 assert.ok(sw.includes('./editor/'+name));
 assert.ok(build.includes("'editor/"+name+"'"));
}
assert.ok(html.includes('arqui-assistant.css'));
assert.ok(sw.includes('./editor/assets/el-arqui.webp'));
console.log('Static Arqui checks passed: no IA credits, local architecture library, transparent avatar, dimensional criteria and CAD approval.');

{
 const input = p.parsePrompt('Quiero una vivienda pequeña de 12x8 con 3 cuartos y el terreno 15x10');
 assert.equal(input.lotWidth, 15);
 assert.equal(input.lotDepth, 10);
 assert.throws(() => p.design(input), /terreno de 15 x 10 m/);
}
