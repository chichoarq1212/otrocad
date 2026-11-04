'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const road=require('../editor/civil-road.js');
const html=fs.readFileSync('editor/index.html','utf8');
const ui=fs.readFileSync('editor/civil-road-ui.js','utf8');
const css=fs.readFileSync('editor/civil-road-ui.css','utf8');
const ribbon=fs.readFileSync('editor/civil-ribbon.css','utf8');
const civil=fs.readFileSync('editor/civil3d.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const build=fs.readFileSync('scripts/build-pages.cjs','utf8');
const alignment=[{x:742345.1,y:9976534.5},{x:742365.1,y:9976534.5}];
for(const type of ['solid','dashed','double','edge','crosswalk','arrow','island','sign','roadtext']){
 const out=road.generate(alignment,type,{width:3.5,label:'PARE'});
 assert.ok(out.length>0,type+' should produce real CAD entities');
 assert.ok(out.every(x=>['line','polygon','circle','text'].includes(x.type)),'CAD shapes only '+type);
 assert.ok(out.every(x=>x.layer.startsWith('CIVIL-')),'civil layer metadata '+type);
 assert.ok(out.every(x=>x.civilRoadMarking===type),'preserve road element identity '+type);
 const points=out.flatMap(x=>(x.pts||[]).concat(x.a?[x.a]:[],x.b?[x.b]:[]));
 assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'finite UTM geometry '+type);
 if(type==='island')assert.ok(out.length>2);
 if(type==='roadtext')assert.ok(out.some(x=>x.type==='text'&&x.text==='PARE'));
}
const saved=road.generate([{x:0,y:0},{x:20000,y:0}],'edge',{units:'mm'});
assert.equal(saved[0].b.x,20000,'road units must preserve millimeters');
assert.throws(()=>road.generate([{x:0,y:0},{x:50000,y:0}],'dashed',{dash:.2,gap:.2}),/divide el eje/i,
 'long dashed roads must not freeze the browser');
assert.doesNotMatch(ui,/\bprompt\s*\(/,'Road wizard should not interrupt users with prompt()');
assert.match(ui,/id='civilRoadPanel'|id="civilRoadPanel"/,'road properties panel exists');
assert.match(ui,/roadUseSelection/,'user can select an axis without closing panel');
assert.match(ui,/roadCategories/,'types grouped in familiar road categories');
assert.match(ui,/roadPreview/,'road geometry preview present');
assert.match(ui,/roadApply/,'explicit apply required to change the drawing');
assert.match(ui,/math\.generate\(currentAxis,current,options\(\)\)/,'Apply must recalculate with active selection');
assert.match(ui,/el\('roadApply'\)\.disabled=!validGeometry/,'Cannot apply a sample preview without an axis');
assert.match(ui,/function previewSVG\(/,'Preview should show actual generated geometry');
assert.match(ui,/function selectedAxis\(/,'Selected line/polyline required');
assert.match(ui,/Object\.assign\(window\.OtroCadCivilCommands/,'Old keyboard aliases must remain');
assert.match(ui,/iconPath=/,'Icons must be consistent CAD vectors');
assert.match(ui,/SEÑALIZACIÓN VIAL/);
assert.match(css,/\[hidden\]\{display:none!important\}/,'Panel respects hidden state');
assert.match(css,/orientation:landscape/,'iPhone landscape response retained');
assert.match(css,/body\.cad-civil-active/,'Only Civil ribbon gets extra buttons');
assert.match(ribbon,/text-overflow:ellipsis!important/,'Long captions must not overlap');
assert.match(ribbon,/overflow-x:auto!important/,'Ribbon should scroll horizontally');
assert.match(ribbon,/cad-civil-active/,'Other modules must keep their ribbon unchanged');
assert.match(civil,/MutationObserver\(syncCivilRibbon\)/,'Ribbon style tracks tab changes');
assert.match(civil,/shortLabels=/,'Civil button labels should be abbreviated');
assert.match(html,/href="civil-ribbon\.css"/);
assert.match(html,/href="civil-road-ui\.css"/);
assert.match(html,/src="civil-road\.js"><\/script><script src="civil-road-ui\.js"/,
 'road math must load before road palette');
for(const asset of ['civil-road-ui.js','civil-ribbon.css','civil-road-ui.css']){
 assert.ok(sw.includes('./editor/'+asset),'Offline cache missing '+asset);
 assert.ok(build.includes("'editor/"+asset+"'"),'Deploy bundle missing '+asset);
}
console.log('Civil ribbon and road panel checks passed: UTM geometry, preview, safe Apply, mobile CSS and offline packaging.');
