'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const proj4=require('../editor/vendor/proj4/proj4.js');
const geo=require('../editor/geolocation.js');
const close=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
for(const zone of [1,17,18,60])for(const hemisphere of ['N','S']){
 const state=geo.validate({zone,hemisphere});
 const longitude=zone*6-183,north=hemisphere==='S'?10000000:0;
 const model={x:500000,y:north};
 const merc=geo.modelToMercator(model,state,'m');
 const expected=proj4('EPSG:4326','EPSG:3857',[longitude,0]);
 close(merc[0],expected[0]);close(merc[1],expected[1]);
 const back=geo.mercatorToModel(merc,state,'m');close(back.x,model.x);close(back.y,model.y);
}
for(const units of ['m','cm','mm'])for(const rotation of [0,32,90,-20]){
 const state=geo.validate({mode:'local',east:778000,north:9978000,localX:120,localY:80,rotation});
 const anchor=geo.modelToUtm({x:120,y:80},state,units);
 close(anchor[0],778000);close(anchor[1],9978000);
 const original={x:450,y:-200};
 const before={...original};
 const merc=geo.modelToMercator(original,state,units);
 const restored=geo.mercatorToModel(merc,state,units);
 close(restored.x,original.x,.002);close(restored.y,original.y,.002);
 assert.deepEqual(original,before,'Map projection must not mutate CAD geometry');
}
const state=geo.validate({});
close(geo.modelToUtm({x:500000000,y:9970000000},state,'mm')[0],500000);
for(const patch of [{zone:0},{zone:61},{hemisphere:'x'},{opacity:0},{east:0},{north:10000001},{rotation:'invalid'}])assert.throws(()=>geo.validate(patch));
const tiles=geo.tileBounds([[-1,-1],[1,1]],1);
assert.equal(tiles.x0,0);assert.equal(tiles.x1,1);assert.equal(tiles.y0,0);assert.equal(tiles.y1,1);
const source=fs.readFileSync('editor/geolocation.js','utf8'),html=fs.readFileSync('editor/index.html','utf8');
assert.ok(html.includes('vendor/proj4/proj4.js')&&html.includes('geolocation.js'),'Bundle projection and map code');
assert.match(source,/pending>=8/,'Limit simultaneous visible-tile requests');
assert.doesNotMatch(source,/no-cache|no-store|prefetch|downloadAll/,'Respect map tile caching and avoid bulk downloads');
assert.match(source,/goto.arcgisonline.com\/maps\/World_Imagery/,'Visible map credits must link to source attribution');
assert.match(fs.readFileSync('editor/editor.js','utf8'),/const map=window\.OtroCadGeolocation;map\?\.draw\(ctx/,'Map must render beneath CAD entities');
console.log('Geolocation passed: WGS84 UTM N/S, meters/cm/mm, local anchors, rotation, round trips, immutable geometry, tile bounds and attribution.');
