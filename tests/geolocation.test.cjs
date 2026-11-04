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
assert.equal(geo.tileAvailability({data:[0],location:{left:72085,top:131269,width:1,height:1}},72085,131269),false,'Reject the exact missing ocean tile shown in the report');
assert.equal(geo.tileAvailability({data:[1],location:{left:1126,top:2051,width:1,height:1}},1126,2051),true,'The same region has lower-resolution imagery');
assert.equal(geo.tileAvailability({error:{code:422}},0,0),false);
assert.equal(geo.tileAvailability({data:[1],location:{left:0,top:0,width:1,height:1}},1,0),null,'Do not index outside an adjusted tilemap response');
assert.equal(geo.tileAvailability({},0,0),null);
const probes=[];
assert.equal(geo.availableLevel(19,144170,262538,(z,x,y)=>{probes.push([z,x,y]);return {status:'ready',available:z===12}}),12);
assert.deepEqual(probes.at(-1),[12,1126,2051],'Fallback retains geographic location as resolution decreases');
assert.equal(geo.availableLevel(18,72085,131269,()=>({status:'loading'})),null,'Wait for coverage before requesting missing image tiles');
assert.equal(geo.availableLevel(3,1,1,()=>({status:'ready',available:false})),-1);
assert.deepEqual(geo.parentTileWindow(3,5,6,1),{x:1,y:1,source:[64,128,64,64]},'Parent imagery is cropped to the child footprint, never stretched over the wrong place');
const legacy={enabled:true,mode:'local',east:500000,north:9970000};
assert.equal(geo.legacyExample(legacy),true);assert.equal(geo.validate(legacy).configured,false,'Old example coordinates are not a project reference');
assert.equal(geo.validate({...legacy,east:778000}).configured,true,'Preserve previously assigned real references');
assert.equal(geo.validate({...legacy,enabled:false,east:778000}).configured,true,'Turning the basemap off must not erase a real reference');
assert.equal(geo.legacyExample({...legacy,mode:'utm',enabled:false}),true,'Unused initial defaults must also migrate to Ecuador');
for(const region of ['continental','galapagos']){
 const s=geo.ecuadorState(region,{x:12,y:34});
 const ll=proj4(geo.crs(s),'EPSG:4326',[s.east,s.north]);
 assert.equal(s.configured,false,'An Ecuador overview must never georeference a project implicitly');
 assert.equal(s.localX,12);assert.equal(s.localY,34);
 if(region==='continental'){assert.ok(ll[0]>-81&&ll[0]<-75);assert.ok(ll[1]>-5&&ll[1]<1.7)}
 else{assert.ok(ll[0]>-93&&ll[0]<-89);assert.ok(ll[1]>-2&&ll[1]<2)}
}
assert.ok(source.includes('?blankTile=false'),'Never accept provider placeholder images as actual map data');
assert.ok(html.includes('vendor/proj4/proj4.js')&&html.includes('geolocation.js'),'Bundle projection and map code');
assert.match(source,/pending>=8/,'Limit simultaneous visible-tile requests');
assert.doesNotMatch(source,/no-cache|no-store|prefetch|downloadAll/,'Respect map tile caching and avoid bulk downloads');
assert.match(source,/goto.arcgisonline.com\/maps\/World_Imagery/,'Visible map credits must link to source attribution');
assert.match(fs.readFileSync('editor/editor.js','utf8'),/const map=window\.OtroCadGeolocation;map\?\.draw\(ctx/,'Map must render beneath CAD entities');
// Run startup against old saved settings, not just the standalone projection helpers.
function startup(saved,objects=[]){
 const vm=require('node:vm'),nodes={},views=[],stored=new Map();
 function node(id){
  const el={id,children:[],hidden:false,value:'',style:{},dataset:{},listeners:{},clientWidth:1200,clientHeight:700,
   append(...children){this.children.push(...children)},insertBefore(child){this.children.unshift(child)},
   addEventListener(name,handler){this.listeners[name]=handler},querySelector(){return nodes.civil}};
  Object.defineProperty(el,'innerHTML',{set(value){for(const m of String(value).matchAll(/id="([^"]+)"/g))node(m[1])}});
  nodes[id]=el;return el;
 }
 const stage=node('stage'),groups=node('groups');node('civil');node('tabs');let active=false;
 const api={getObjects:()=>objects,getView:()=>({center:{x:0,y:0},pixelsPerUnit:35}),getUnits:()=> 'm',
  setView:(center,scale)=>views.push({center,scale}),setStatus(){},repaint(){}};
 const window={proj4,OtroCadCivilAPI:api,OtroCadCivilCommands:{},addEventListener(){}};
 const document={getElementById:id=>nodes[id]||null,querySelector:selector=>selector.includes('.active')?(active?nodes.civil:null):nodes.civil,createElement:()=>node('element-'+Object.keys(nodes).length)};
 const context={window,document,localStorage:{getItem:()=>JSON.stringify(saved),setItem:(k,v)=>stored.set(k,v)},
  requestAnimationFrame(){},AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 return {state:JSON.parse(stored.get('otrocad-geolocation-v1')),views,nodes,objects,map:window.OtroCadGeolocation,clickTab(tab){active=tab==='civil';nodes.tabs.listeners.click({target:{closest:()=>({dataset:{tab}})}})}};
}
const migrated=startup(legacy);
assert.equal(migrated.state.region,'continental');assert.equal(migrated.state.configured,false);
assert.equal(migrated.views.length,0,'No automatic map or camera change at startup');assert.equal(migrated.map.isVisible(),false);migrated.clickTab('civil');assert.equal(migrated.map.isVisible(),true);assert.equal(migrated.views.length,1);assert.ok(migrated.views[0].scale<.01,'Replace the old ocean view with an overview of Ecuador');
migrated.clickTab('mep');assert.equal(migrated.map.isVisible(),false,'Map is hidden outside Civil');assert.equal(migrated.nodes.stage.children[0].hidden,true);assert.equal(migrated.views.length,2,'Leaving the overview restores the CAD camera');migrated.clickTab('civil');assert.equal(migrated.views.length,3,'Returning to Civil restores the overview');
const real=startup({...legacy,east:778000,north:9978000});
assert.equal(real.state.configured,true);assert.equal(real.state.east,778000);assert.equal(real.views.length,0,'Preserve a real project reference and its view');
const drawing=[{type:'line',a:{x:0,y:0},b:{x:5,y:2}}],copy=JSON.stringify(drawing);
const needsReference=startup(legacy,drawing);
assert.equal(needsReference.state.enabled,false);assert.equal(needsReference.views.length,0);
assert.equal(JSON.stringify(drawing),copy,'Never move or georeference existing geometry using an overview location');
console.log('Geolocation passed: WGS84 UTM N/S, meters/cm/mm, local anchors, rotation, round trips, immutable geometry, tile bounds and attribution.');
