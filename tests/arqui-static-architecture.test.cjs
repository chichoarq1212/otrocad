'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const model=require('../editor/arqui-planner.js');
const knowledge=require('../editor/arqui-knowledge.js');
const professional=require('../editor/arqui-professional.js');
const runtime={OtroCadArquiPlanner:model,OtroCadArchitecturalKnowledge:knowledge};
vm.runInNewContext(fs.readFileSync('editor/arqui-house-layout.js','utf8'),{window:runtime});
const engine=runtime.OtroCadArquiPlanner;
const prompt='Quiero una casa 10 x 8 con 3 habitaciones - dos de ellas con baño compartido y una con baño master - sala comedor y cocina con isla puerta trasera para salir a patio de 3 metros de fondo con lavanderia. parque 2 carros';
const spec=engine.parsePrompt(prompt);
assert.equal(spec.dimensionMeaning,'house');
assert.deepEqual([spec.houseWidth,spec.houseDepth],[10,8]);
assert.deepEqual([spec.lotWidth,spec.lotDepth],[10,16.5]);
assert.equal(spec.bathrooms,2);
assert.equal(spec.garageSpaces,2);
assert.equal(spec.rearDoor,true);
assert.equal(spec.patioLaundry,true);
const plan=engine.design(spec);
assert.equal(plan.floors.length,2);
assert.equal(plan.layoutKind,'compact-coherent-v3');
assert.equal(plan.floors.filter(x=>x.level===1).length,1);
assert.equal(plan.floors[0].stair.x,plan.floors[1].stair.x);
assert.equal(plan.floors[0].stair.y,plan.floors[1].stair.y);
assert.equal(plan.floors[0].stair.width,plan.floors[1].stair.width);
assert.equal(plan.floors[0].stair.depth,plan.floors[1].stair.depth);
assert.equal(plan.floors[0].stair.spec.risers,16);
assert.equal(plan.floors[0].stair.spec.riser,.175);
assert.equal(plan.floors[0].stair.spec.tread,.28);
assert.equal(plan.floors[0].stair.spec.landing,1.05);
assert.equal(plan.floors[0].usableHall,1.21);
assert.equal(knowledge.auditPlan(plan).length,0,'No plan violates the own dimension rulebook');
const bedrooms=plan.floors.flatMap(f=>f.rooms.filter(r=>r.kind==='bedroom'));
const baths=plan.floors.flatMap(f=>f.rooms.filter(r=>r.kind==='bath'));
assert.equal(bedrooms.length,3);
assert.equal(baths.length,2);
assert(baths.some(r=>r.name.includes('MÁSTER')));
assert(baths.some(r=>r.name.includes('COMPARTIDO')));
assert(plan.floors[1].rooms.some(r=>r.kind==='closet'),'Master bathroom receives an interior privacy buffer');
assert(plan.floors[1].partitions.suiteX>0,'Suite has actual interior partition');
assert(plan.patio?.laundry===true);
assert(plan.garage?.spaces===2);
const entities=professional.generate(plan,{projectId:'local-test'});
assert(entities.length>400&&entities.length<1000);
const layers=new Set(entities.map(e=>e.layer));
for(const k of ['AI-ARQ-ESCALERAS','AI-ARQ-PATIO','AI-ARQ-GARAJE','AI-ARQ-MUROS','AI-ARQ-HATCH-MUROS','AI-ARQ-COTAS','AI-ARQ-ABERTURAS','AI-ARQ-VENTANAS']) assert(layers.has(k),k);
const txt=entities.filter(x=>x.type==='text').map(x=>x.text);
for(const label of ['BAÑO MÁSTER','BAÑO COMPARTIDO','PARQUEO 1','PARQUEO 2','LAVANDERÍA']) assert(txt.includes(label),'Missing '+label);
const stairSteps=entities.filter(x=>x.aiElement==='stair-tread');
assert(stairSteps.length>=28,'U stair must have two flights and repeated treads');
assert(entities.some(e=>e.aiElement==='turn-landing'),'U stair must have a real CAD landing polygon');
const doorArcs=entities.filter(e=>e.aiElement==='door-swing');
assert(doorArcs.length>=9,'Actual joinery with door swing arcs');
const openings=(floor,side)=>floor.doors[side].map(d=>({y:floor.y+d.y,w:d.width}));
for(const f of plan.floors){
 for(const side of ['left','right']){
  const arr=openings(f,side).sort((a,b)=>a.y-b.y);
  for(let i=1;i<arr.length;i++)assert(arr[i].y-arr[i-1].y>(arr[i].w+arr[i-1].w)/2+.10,'Door openings clash');
 }
}
const collisionOnPlane=(a,b)=>{
 if(a.type!=='arc'||b.type!=='arc')return false;
 const x1=a.pts.map(q=>q.x),y1=a.pts.map(q=>q.y),x2=b.pts.map(q=>q.x),y2=b.pts.map(q=>q.y);
 return Math.max(...x1)>Math.min(...x2)+.05 &&Math.max(...x2)>Math.min(...x1)+.05 &&
  Math.max(...y1)>Math.min(...y2)+.05 &&Math.max(...y2)>Math.min(...y1)+.05;
};
for(let i=0;i<doorArcs.length;i++)for(let j=i+1;j<doorArcs.length;j++){
 const a=doorArcs[i],b=doorArcs[j];
 const aY=a.pts[0].y,bY=b.pts[0].y;
 if(Math.abs(aY-bY)>8.1)continue; // plans are drawn separately
 assert(!collisionOnPlane(a,b),'Door swing projections overlap: '+i+' '+j);
}
const content=fs.readFileSync('editor/arqui-assistant.js','utf8');
assert(!/fetch\(|OpenRouter|ARQUI_AUTO_ENABLED|\\/api\\/arqui|arquiAiProvider|arquiAiKey/.test(content),'Assistant must not contain online inference code');
const html=fs.readFileSync('editor/index.html','utf8');
assert(html.includes('src="arqui-knowledge.js"'));
assert(!html.includes('src="arqui-user-ai.js"'));
assert(!html.includes('src="arqui-oauth.js"'));
const sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('./editor/arqui-knowledge.js'));
const cfg=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
assert(!cfg.main&&!cfg.ai&&!cfg.durable_objects,'Cloudflare must serve static assets only');
const second=engine.interpret('agranda la cocina 50 cm',spec);
assert(second.canGenerate);
const revised=engine.design(second.spec);
assert(revised.floors[0].rooms.find(r=>r.kind==='kitchen').depth>plan.floors[0].rooms.find(r=>r.kind==='kitchen').depth);
console.log('OFFLINE ARCHITECTURE OK: 2 floors, 3 bedrooms, private/shared baths, stairs in U with aligned vertical well, 1.21m clear corridor, collision audit, complete CAD, 0 external AI requests.');
