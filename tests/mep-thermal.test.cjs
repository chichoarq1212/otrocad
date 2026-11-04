'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const thermal=require('../editor/mep-thermal.js');
const almost=(got,want,tolerance=1e-5)=>{
 assert.ok(Math.abs(got-want)<tolerance,String(got)+' not approximately '+String(want));
};
const hvac=thermal.hvac({
 length:10,width:10,height:3,outdoor:30,inside:20,uWall:.5,uRoof:.5,uGlass:3,
 glazing:0,irradiance:0,people:0,lighting:0,equipment:0,ach:0,deltaW:0,marginPct:0
});
almost(hvac.geometry.wallArea,120);
almost(hvac.envelope.walls,600);
almost(hvac.envelope.roof,500);
almost(hvac.designKW,1.1);
almost(hvac.designBTUh,1100*3.412141633);
assert.equal(hvac.mode,'hvac');
const humid=thermal.hvac({...hvac.inputs,ach:2,deltaW:8});
assert.ok(humid.air.sensibleW>0&&humid.air.latentW>0);
assert.ok(humid.designKW>hvac.designKW);
const highSolar=thermal.hvac({...hvac.inputs,glazing:10,irradiance:500,shgc:.5,shading:1});
almost(highSolar.envelope.solar,2500);
assert.ok(highSolar.envelope.walls<hvac.envelope.walls);
assert.throws(()=>thermal.hvac({...hvac.inputs,length:0}),/Largo/);
assert.throws(()=>thermal.hvac({...hvac.inputs,outdoor:12,inside:22}),/temperatura|exterior/i);
assert.throws(()=>thermal.hvac({...hvac.inputs,marginPct:150}),/Reserva/);
const base={
 length:5,width:4,height:3,inside:2,outdoor:32,floorOutside:20,
 uWall:.25,uRoof:.22,uFloor:.35,
 ach:0,deltaW:0,productKgDay:0,lightingW:0,fansW:0,people:0,
 defrostKWh:0,marginPct:0,operationHours:24
};
const cold=thermal.coldRoom(base);
almost(cold.transmissionW.walls,405);
almost(cold.transmissionW.roof,132);
almost(cold.transmissionW.floor,126);
almost(cold.breakdownKWh.transmission,15.912);
almost(cold.capacityKW,.663);
almost(cold.panelThicknessMm,88.32);
const stocked=thermal.coldRoom({...base,productKgDay:100,entryProductT:20,cpAbove:3.5});
almost(stocked.breakdownKWh.product,1.75);
const frozen=thermal.coldRoom({
 ...base,inside:-10,productKgDay:100,entryProductT:10,freezeT:-1,
 cpAbove:3.5,cpBelow:1.7,latentFreeze:250,processHours:8,operationHours:20
});
almost(frozen.productKJkg,303.8);
almost(frozen.breakdownKWh.product,100*303.8/3600);
assert.ok(frozen.capacityKW>frozen.averageKW,'Fast freeze pull-down must affect required capacity');
assert.ok(frozen.pullDownKW>frozen.averageKW);
assert.ok(frozen.designKWhDay>stocked.designKWhDay);
assert.throws(()=>thermal.coldRoom({...base,inside:35}),/ambiente|consigna/i);
assert.throws(()=>thermal.coldRoom({...base,operationHours:0}),/Horas/);
assert.throws(()=>thermal.coldRoom({...base,productKgDay:-1}),/producto/i);
const start={x:742345.12,y:9976534.23};
const original=JSON.stringify(start);
const plan=thermal.plan(start,{length:5,width:4,height:3,door:1.2,panelMm:100,inside:2});
assert.ok(plan.length>=18);
assert.equal(JSON.stringify(start),original,'Plan must not mutate insertion point');
assert.ok(plan.every(e=>e.layer==='MEP-CUARTOS-FRIOS'));
assert.ok(plan.some(e=>e.type==='text'&&e.text.includes('CUARTO FRÍO')));
assert.ok(plan.some(e=>e.type==='text'&&e.text.includes('PUERTA')));
assert.ok(plan.filter(e=>e.type==='line').every(e=>
 [e.a?.x,e.a?.y,e.b?.x,e.b?.y].every(Number.isFinite)));
const mm=thermal.plan({x:0,y:0},{length:5,width:4,height:3,door:1.1,panelMm:100,units:'mm'});
assert.ok(mm.some(e=>e.type==='line'&&e.b.x===5000));
assert.throws(()=>thermal.plan({x:0,y:0},{length:2,width:2,door:2}),/puerta/i);
const mep=fs.readFileSync('editor/mep.js','utf8');
const ui=fs.readFileSync('editor/mep-thermal-ui.js','utf8');
const kelvin=fs.readFileSync('editor/kelvin-assistant.js','utf8');
const html=fs.readFileSync('editor/index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const build=fs.readFileSync('scripts/build-pages.cjs','utf8');
const ribbon=fs.readFileSync('editor/mep-ribbon.css','utf8');
const styles=fs.readFileSync('editor/mep-thermal-ui.css','utf8');
assert.match(mep,/function syncMepRibbon\(/);
assert.match(mep,/pendingColdRoom/);
assert.match(mep,/startColdRoomLayout\(input\)/);
assert.match(mep,/window\.OtroCadThermal\.plan\(point,value\)/);
assert.match(mep,/getPreview\(\)[\s\S]*?pendingColdRoom/);
assert.match(ui,/Cuarto frío \/ congelación/);
assert.match(ui,/mep\.startColdRoomLayout/);
assert.match(ui,/thermalReport/);
assert.match(ui,/thermalExport/);
assert.match(ui,/Cargas térmicas/);
assert.match(ui,/Cuartos fríos/);
assert.match(ui,/COLDROOM/);
assert.match(kelvin,/window\.OtroCadThermalUI/);
assert.match(kelvin,/coldroom/);
assert.match(ribbon,/body\.cad-mep-active/);
assert.match(ribbon,/text-overflow:ellipsis!important/);
assert.match(ribbon,/overflow-x:auto!important/);
assert.match(styles,/orientation:landscape/);
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
for(const name of ['mep-thermal.js','mep-thermal-ui.js'])assert.ok(scripts.includes(name));
assert.ok(scripts.indexOf('mep-thermal.js')<scripts.indexOf('mep.js'));
assert.ok(scripts.indexOf('mep.js')<scripts.indexOf('mep-thermal-ui.js'));
assert.ok(scripts.indexOf('mep-thermal-ui.js')<scripts.indexOf('kelvin-assistant.js'));
for(const name of ['mep-ribbon.css','mep-thermal-ui.css'])
 assert.ok(html.includes('href="'+name+'"'));
for(const name of ['mep-thermal.js','mep-thermal-ui.js','mep-thermal-ui.css','mep-ribbon.css']){
 assert.ok(sw.includes('./editor/'+name),'SW missing '+name);
 assert.ok(build.includes("'editor/"+name+"'"),'Bundle missing '+name);
}
console.log('MEP thermal and cold-room design tests passed: SI loads, latent/freezing, fast pull-down, UTM plan, responsive ribbon and offline shipping.');
