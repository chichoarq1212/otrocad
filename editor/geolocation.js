/* WGS84/UTM basemap for model space. Proj4js supplies the projection math. */
(()=>{
'use strict';
const projection=typeof window!=='undefined'?window.proj4:require('./vendor/proj4/proj4.js');
const HALF=20037508.342789244,TILE=256;
const unitScale=units=>units==='mm'?.001:units==='cm'?.01:1;
const ECUADOR={continental:{lon:-78.4,lat:-1.5,zone:17,span:820000,name:'Ecuador continental'},galapagos:{lon:-90.5,lat:-.6,zone:15,span:650000,name:'Galápagos'}};
function legacyExample(s){return !!s&&['local','utm'].includes(s.mode)&&Number(s.east)===500000&&Number(s.north)===9970000&&s.configured===undefined}
function validate(input){
 const initial=projection('EPSG:4326','EPSG:32717',[-78.4,-1.5]);
 const s={enabled:false,configured:false,region:'continental',style:'satellite',zone:17,hemisphere:'S',mode:'utm',east:initial[0],north:initial[1],localX:0,localY:0,rotation:0,opacity:.8,...input};
 s.zone=Number(s.zone);s.hemisphere=String(s.hemisphere).toUpperCase();
 for(const key of ['east','north','localX','localY','rotation','opacity'])s[key]=Number(s[key]);
 if(!Number.isInteger(s.zone)||s.zone<1||s.zone>60||!['N','S'].includes(s.hemisphere))throw Error('Selecciona una zona UTM de 1 a 60 y hemisferio N/S.');
 if(!['utm','local'].includes(s.mode)||!['satellite','roads','hybrid'].includes(s.style))throw Error('Tipo de mapa o referencia no válido.');
 if(['east','north','localX','localY','rotation','opacity'].some(key=>!Number.isFinite(s[key])))throw Error('Las coordenadas y el ángulo deben ser números válidos.');
 if(s.east<100000||s.east>900000||s.north<0||s.north>10000000)throw Error('Revisa Este (100000–900000 m) y Norte (0–10000000 m).');
 if(s.opacity<.1||s.opacity>1)throw Error('La opacidad debe estar entre 10 y 100 %.');
 s.enabled=s.enabled===true;
 s.configured=input?.configured===true||(input?.configured===undefined&&['local','utm'].includes(input?.mode)&&input?.east!==undefined&&input?.north!==undefined&&!legacyExample(input));
 if(!['continental','galapagos'].includes(s.region))s.region='continental';
 return s;
}
function ecuadorState(region='continental',origin={x:0,y:0}){
 const place=ECUADOR[region]||ECUADOR.continental;
 const point=projection('EPSG:4326','EPSG:'+(32700+place.zone),[place.lon,place.lat]);
 return validate({enabled:true,configured:false,region,mode:'local',zone:place.zone,east:point[0],north:point[1],localX:origin.x,localY:origin.y});
}
function crs(s){return 'EPSG:'+((s.hemisphere==='S'?32700:32600)+s.zone)}
function modelToUtm(point,s,units='m'){
 const scale=unitScale(units);
 if(s.mode==='utm')return [point.x*scale,point.y*scale];
 const a=s.rotation*Math.PI/180,c=Math.cos(a),n=Math.sin(a),x=(point.x-s.localX)*scale,y=(point.y-s.localY)*scale;
 return [s.east+x*c-y*n,s.north+x*n+y*c];
}
function utmToModel(point,s,units='m'){
 const scale=unitScale(units);
 if(s.mode==='utm')return {x:point[0]/scale,y:point[1]/scale};
 const a=s.rotation*Math.PI/180,c=Math.cos(a),n=Math.sin(a),x=point[0]-s.east,y=point[1]-s.north;
 return {x:s.localX+(x*c+y*n)/scale,y:s.localY+(-x*n+y*c)/scale};
}
const modelToMercator=(p,s,u)=>projection(crs(s),'EPSG:3857',modelToUtm(p,s,u));
const mercatorToModel=(p,s,u)=>utmToModel(projection('EPSG:3857',crs(s),p),s,u);
function tileBounds(points,z){
 const span=2*HALF/2**z,n=2**z;
 const xs=points.map(p=>(p[0]+HALF)/span),ys=points.map(p=>(HALF-p[1])/span);
 return {span,x0:Math.max(0,Math.floor(Math.min(...xs))),x1:Math.min(n-1,Math.floor(Math.max(...xs))),
  y0:Math.max(0,Math.floor(Math.min(...ys))),y1:Math.min(n-1,Math.floor(Math.max(...ys)))};
}
function tileAvailability(json,x,y){
 if(json?.error?.code===422)return false;
 const box=json?.location;if(!box||!Array.isArray(json.data))return null;
 const column=x-box.left,row=y-box.top;
 if(column<0||row<0||column>=box.width||row>=box.height)return null;
 const value=json.data[row*box.width+column];return value===1?true:value===0?false:null;
}
function parentTileWindow(z,x,y,level){
 const factor=2**(z-level),size=TILE/factor;
 return {x:Math.floor(x/factor),y:Math.floor(y/factor),source:[(x%factor)*size,(y%factor)*size,size,size]};
}
function availableLevel(z,x,y,lookup){
 while(z>=0){
  const entry=lookup(z,x,y);if(!entry||entry.status==='loading')return null;
  if(entry.available!==false)return z;
  z--;x=Math.floor(x/2);y=Math.floor(y/2);
 }
 return -1;
}
const helpers={validate,crs,unitScale,modelToUtm,utmToModel,modelToMercator,mercatorToModel,tileBounds,tileAvailability,parentTileWindow,ecuadorState,legacyExample,availableLevel};
if(typeof module==='object'&&module.exports){module.exports=helpers;return}
const api=window.OtroCadCivilAPI,stage=document.getElementById('stage'),groups=document.getElementById('groups');
if(!api||!stage||!groups||!projection)return;
const key='otrocad-geolocation-v1',cache=new Map(),coverage=new Map();let pending=0,pendingCoverage=0,queued=false;
let state=validate({}),migrateExample=false,overviewReturn=null,overviewView=null;
try{const stored=JSON.parse(localStorage.getItem(key)||'{}');migrateExample=legacyExample(stored);state=validate(stored)}catch(_){}
const attribution=document.createElement('div');attribution.id='cadMapAttribution';attribution.hidden=true;stage.append(attribution);
const group=document.createElement('div');group.className='toolgroup';group.dataset.panel='civil';
group.hidden=!document.querySelector('[data-tab="civil"].active');
group.innerHTML='<span class="group-title">GEOLOCALIZACIÓN</span><button id="cadGeolocation" class="civil-tool" type="button" title="Asignar coordenadas WGS84 / UTM y cargar mapa georreferenciado"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="7"/><path d="M12 3v14M5 10h14M8 20l4 3 4-3"/><circle class="cad-node" cx="12" cy="10" r="1.5"/></svg></span><span class="civil-label">Geolocalización</span></button><select id="cadMapStyle" aria-label="Mapa base"><option value="off">Mapa apagado</option><option value="satellite">Satélite</option><option value="roads">Mapa vial</option><option value="hybrid">Satélite + etiquetas</option></select><button id="cadMapCenter" type="button" title="Centrar la vista en la referencia geográfica">Centrar mapa</button>';
const countryButton=document.createElement('button');countryButton.type='button';countryButton.id='cadEcuadorView';countryButton.textContent='Ver Ecuador';countryButton.title='Vista general de Ecuador sin asignar coordenadas al plano';group.append(countryButton);
groups.insertBefore(group,groups.querySelector('[data-panel="civil"]'));
const byId=id=>document.getElementById(id),styleSelect=byId('cadMapStyle');
function persist(){try{localStorage.setItem(key,JSON.stringify(state))}catch(_){}styleSelect.value=state.enabled?state.style:'off'}
function redraw(){if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;api.repaint()})}}
function restore(value){try{state=legacyExample(value)?validate({}):validate(value||{})}catch(_){state=validate({})}persist();redraw()}
function setEnabled(enabled){state.enabled=enabled;state.userDisabled=!enabled;persist();attribution.hidden=!isVisible();redraw()}
function showEcuador(region='continental'){
 if(!state.configured&&api.getObjects().length){showSettings();api.setStatus('Ingresa las coordenadas reales del levantamiento para ubicar el plano en Ecuador.');return}
 if(!state.configured&&!overviewReturn)overviewReturn=api.getView();
 const place=ECUADOR[region]||ECUADOR.continental,units=api.getUnits();let center;
 if(state.configured){center=utmToModel(projection('EPSG:4326',crs(state),[place.lon,place.lat]),state,units);state.enabled=true}
 else{const style=state.style;center=api.getView().center;state=ecuadorState(region,center);state.style=style}
 state.userDisabled=false;persist();
 api.setView(center,Math.min(stage.clientWidth/750000,stage.clientHeight/place.span)*unitScale(units));
 api.setStatus(place.name+' · '+(state.configured?'referencia del proyecto conservada':'vista general; configura UTM antes de ubicar un plano'));
}
function centerMap(){
 if(!state.configured){showEcuador(state.region);return}
 const center=state.mode==='utm'?utmToModel([state.east,state.north],state,api.getUnits()):{x:state.localX,y:state.localY};
 api.setView(center,unitScale(api.getUnits())*1.2);
}
function showSettings(){
 const view=api.getView(),scale=unitScale(api.getUnits());
 const guess={east:view.center.x*scale,north:view.center.y*scale};
 const utmView=guess.east>=100000&&guess.east<=900000&&guess.north>=0&&guess.north<=10000000;
 const defaults={...state};if(!state.configured&&utmView)Object.assign(defaults,guess,{mode:'utm'});
 if(!state.enabled&&!utmView&&state.mode==='utm')Object.assign(defaults,{mode:'local',localX:view.center.x,localY:view.center.y});
 const dlg=document.createElement('dialog');dlg.id='cadGeoSettings';dlg.className='cad-utility-dialog cad-geolocation-settings';
 dlg.innerHTML='<form><h3>Geolocalización · mapa base</h3><p>Asigna el sistema del levantamiento para superponer el mapa debajo del diseño vial.</p><div class="cad-utility-grid">'+
 '<label>Zona UTM WGS84<select name="zone" aria-label="Zona UTM"><optgroup label="Ecuador continental"><option value="17">17 · Ecuador occidental</option><option value="18">18 · Ecuador oriental</option></optgroup><optgroup label="Galápagos"><option value="15">15 · Galápagos occidental</option><option value="16">16 · Galápagos oriental</option></optgroup><optgroup label="Otras zonas">'+Array.from({length:60},(_,i)=>i+1).filter(z=>![15,16,17,18].includes(z)).map(z=>'<option value="'+z+'">'+z+'</option>').join('')+'</optgroup></select></label>'+
 '<label>Hemisferio<select name="hemisphere" aria-label="Hemisferio"><option value="S">Sur · EPSG:327xx</option><option value="N">Norte · EPSG:326xx</option></select></label>'+
 '<label class="geo-wide">Coordenadas del dibujo<select name="mode" aria-label="Referencia del dibujo"><option value="utm">El dibujo ya está en coordenadas UTM</option><option value="local">Vincular un origen local a un punto UTM conocido</option></select></label>'+
 '<label>Este UTM de referencia (m)<input name="east" aria-label="Este UTM" type="number" step="any" required></label>'+
 '<label>Norte UTM de referencia (m)<input name="north" aria-label="Norte UTM" type="number" step="any" required></label>'+
 '<label data-local>X del punto en el dibujo<input name="localX" aria-label="X local" type="number" step="any" required></label>'+
 '<label data-local>Y del punto en el dibujo<input name="localY" aria-label="Y local" type="number" step="any" required></label>'+
 '<label data-local>Giro del eje X hacia UTM (°)<input name="rotation" aria-label="Giro respecto a UTM" type="number" step="any" required></label>'+
 '<label>Mapa<select name="style" aria-label="Tipo de mapa"><option value="satellite">Satélite · Esri</option><option value="roads">Mapa vial · Esri</option><option value="hybrid">Satélite + etiquetas · Esri</option></select></label>'+
 '<label>Opacidad (%)<input name="opacity" aria-label="Opacidad del mapa" type="number" min="10" max="100" step="5" required></label></div>'+
 '<label class="geo-center"><input name="center" type="checkbox" checked> Centrar vista en la referencia</label>'+
 '<p class="geo-note">17S y 18S son opciones habituales en Ecuador; usa la zona y el datum de tu levantamiento. Un plano PSAD56 requiere conversión previa a WGS84. El mapa es una referencia visual en línea; no reemplaza el levantamiento ni se incluye en DWG/DXF o PDF.</p>'+
 '<p class="cad-utility-error" role="alert"></p><div class="cad-utility-actions"><button type="button" data-ecuador>Vista Ecuador</button><button type="button" data-islands>Galápagos</button><button type="button" data-close>Cancelar</button><button type="submit">Aplicar mapa</button></div></form>';
 document.body.append(dlg);const form=dlg.querySelector('form');
 for(const name of ['zone','hemisphere','mode','east','north','localX','localY','rotation','style'])form.elements[name].value=defaults[name];
 if(!state.configured&&!utmView){form.elements.east.value='';form.elements.north.value='';form.elements.east.placeholder='Este real del levantamiento';form.elements.north.placeholder='Norte real del levantamiento'}
 form.elements.opacity.value=Math.round(defaults.opacity*100);
 const sync=()=>{for(const node of dlg.querySelectorAll('[data-local]'))node.hidden=form.elements.mode.value!=='local'};
 form.elements.mode.onchange=sync;sync();
 dlg.querySelector('[data-close]').onclick=()=>dlg.close();
 for(const [selector,region] of [['[data-ecuador]','continental'],['[data-islands]','galapagos']])dlg.querySelector(selector).onclick=()=>{if(!state.configured&&api.getObjects().length){dlg.querySelector('[role="alert"]').textContent='Primero ingresa y aplica la georreferencia real del plano.';return}dlg.close();showEcuador(region)};
 form.onsubmit=event=>{
  event.preventDefault();
  try{
   const value={enabled:true,configured:true};for(const name of ['zone','hemisphere','mode','east','north','localX','localY','rotation','style'])value[name]=form.elements[name].value;
   value.opacity=Number(form.elements.opacity.value)/100;const next=validate(value);
   const latlon=projection(crs(next),'EPSG:4326',[next.east,next.north]);
   if(!latlon.every(Number.isFinite)||Math.abs(latlon[1])>84)throw Error('La referencia no corresponde a una posición UTM válida.');
   state=next;overviewReturn=null;overviewView=null;persist();dlg.close();if(form.elements.center.checked)centerMap();redraw();
   api.setStatus('Mapa '+crs(state)+' · '+(state.mode==='utm'?'coordenadas UTM':'origen local vinculado')+' · geometría conservada');
  }catch(error){dlg.querySelector('[role="alert"]').textContent=error.message}
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
byId('cadGeolocation').onclick=showSettings;byId('cadMapCenter').onclick=()=>state.enabled?centerMap():showSettings();
countryButton.onclick=()=>showEcuador();
styleSelect.onchange=()=>{if(styleSelect.value==='off')setEnabled(false);else if(!state.configured&&!api.getObjects().length){state.style=styleSelect.value;showEcuador(state.region)}else if(!state.enabled){state.style=styleSelect.value;showSettings();persist()}else{state.style=styleSelect.value;persist();redraw()}};
const imagery='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const roads='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/';
const labels='https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/';
function tileService(layer){return layer==='roads'?roads:layer==='labels'?labels:imagery}
function tileUrl(layer,z,x,y){return tileService(layer)+z+'/'+y+'/'+x+'?blankTile=false'}
function getCoverage(layer,z,x,y){
 const id=layer+'/'+z+'/'+x+'/'+y;let entry=coverage.get(id);
 if(entry)return entry;
 if(pendingCoverage>=4)return null;
 entry={status:'loading',available:null};coverage.set(id,entry);pendingCoverage++;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 const url=tileService(layer).replace(/\/tile\/$/,'/tilemap/')+z+'/'+y+'/'+x+'/1/1?f=json';
 fetch(url,{signal:controller.signal}).then(response=>response.json()).then(json=>{
  entry.available=tileAvailability(json,x,y);entry.status='ready';
 }).catch(()=>{entry.status='ready'}).finally(()=>{clearTimeout(timer);pendingCoverage--;redraw()});
 if(coverage.size>512){for(const [old,item] of coverage)if(item.status!=='loading'){coverage.delete(old);break}}
 return entry;
}
function coverageLevel(layer,z,x,y){
 return availableLevel(z,x,y,(level,column,row)=>getCoverage(layer,level,column,row));
}
function getTile(layer,z,x,y){
 const id=layer+'/'+z+'/'+x+'/'+y;let entry=cache.get(id);
 if(entry){cache.delete(id);cache.set(id,entry);return entry}
 if(pending>=8)return null;
 entry={status:'loading',image:new Image()};cache.set(id,entry);pending++;
 entry.image.crossOrigin='anonymous';
 entry.image.onload=()=>{entry.status='loaded';pending--;redraw()};
 entry.image.onerror=()=>{entry.status='error';pending--;redraw()};
 entry.image.src=tileUrl(layer,z,x,y);
 if(cache.size>160){for(const [old,item] of cache){if(item.status!=='loading'){cache.delete(old);break}}}
 return entry;
}
function imageForTile(layer,z,x,y){
 for(let level=z;level>=0;level--){
  const parent=parentTileWindow(z,x,y,level),entry=getTile(layer,level,parent.x,parent.y);
  if(!entry||entry.status==='loading')return {status:'loading'};
  if(entry.status==='loaded')return {...entry,level,source:parent.source};
 }
 return {status:'error'};
}
function drawTile(ctx,image,p,source=[0,0,TILE,TILE]){
 // Two affine triangles preserve grid rotation and the projected tile corners.
 const [nw,ne,se,sw]=p;
 ctx.save();ctx.beginPath();ctx.moveTo(nw.x,nw.y);ctx.lineTo(ne.x,ne.y);ctx.lineTo(sw.x,sw.y);ctx.closePath();ctx.clip();
 ctx.transform((ne.x-nw.x)/TILE,(ne.y-nw.y)/TILE,(sw.x-nw.x)/TILE,(sw.y-nw.y)/TILE,nw.x,nw.y);ctx.drawImage(image,...source,0,0,TILE,TILE);ctx.restore();
 ctx.save();ctx.beginPath();ctx.moveTo(se.x,se.y);ctx.lineTo(sw.x,sw.y);ctx.lineTo(ne.x,ne.y);ctx.closePath();ctx.clip();
 ctx.transform((se.x-sw.x)/TILE,(se.y-sw.y)/TILE,(se.x-ne.x)/TILE,(se.y-ne.y)/TILE,ne.x+sw.x-se.x,ne.y+sw.y-se.y);ctx.drawImage(image,...source,0,0,TILE,TILE);ctx.restore();
}
function isVisible(){return state.enabled&&!!document.querySelector('[data-tab="civil"].active')}
function draw(ctx,view){
 attribution.hidden=!isVisible();if(!isVisible())return;
 if(!state.configured&&api.getObjects().length){attribution.textContent='Georreferencia pendiente: abre Geolocalización e ingresa las coordenadas reales del plano.';attribution.style.bottom=(byId('layoutBar').offsetHeight+5)+'px';return}
 try{
  const {world,screen,width,height,units}=view;
  const center=world({x:width/2,y:height/2});
  const ll=projection(crs(state),'EPSG:4326',modelToUtm(center,state,units));
  if(!ll.every(Number.isFinite)||Math.abs(ll[1])>84)throw Error('La vista está fuera de la zona UTM configurada.');
  const points=[[0,0],[width,0],[width,height],[0,height],[width/2,0],[width/2,height]].map(p=>modelToMercator(world({x:p[0],y:p[1]}),state,units));
  const pixelsPerMeter=api.getView().pixelsPerUnit/unitScale(units),cos=Math.cos(ll[1]*Math.PI/180);
  let z=Math.max(0,Math.min(19,Math.round(Math.log2(2*HALF*pixelsPerMeter*cos/TILE)))),bounds=tileBounds(points,z);
  while(z>0&&(bounds.x1-bounds.x0+1)*(bounds.y1-bounds.y0+1)>64)bounds=tileBounds(points,--z);
  const layers=state.style==='hybrid'?['satellite','labels']:[state.style];let loaded=0,errors=0,waiting=0,reduced=false;
  ctx.save();ctx.globalAlpha=state.opacity;
  try{for(const layer of layers){
   const centerMerc=modelToMercator(center,state,units),n=2**z,span=2*HALF/n;
   const cx=Math.max(0,Math.min(n-1,Math.floor((centerMerc[0]+HALF)/span))),cy=Math.max(0,Math.min(n-1,Math.floor((HALF-centerMerc[1])/span)));
   const level=coverageLevel(layer,z,cx,cy);
   if(level===null){waiting++;continue}if(level<0){errors++;continue}
   const area=tileBounds(points,level);if(level<z)reduced=true;
   for(let y=area.y0;y<=area.y1;y++)for(let x=area.x0;x<=area.x1;x++){
    const entry=imageForTile(layer,level,x,y);if(entry.status==='loading'){waiting++;continue}if(entry.status==='error'){errors++;continue}
    const left=x*area.span-HALF,top=HALF-y*area.span;
    const quad=[[left,top],[left+area.span,top],[left+area.span,top-area.span],[left,top-area.span]].map(p=>screen(mercatorToModel(p,state,units)));
    drawTile(ctx,entry.image,quad,entry.source);loaded++;if(entry.level<level)reduced=true;
   }
  }}finally{ctx.restore()}
  const source=state.style==='roads'?'Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, GIS User Community':'Esri, Vantor, Earthstar Geographics, GIS User Community'+(state.style==='hybrid'?' · etiquetas: Esri, HERE, Garmin, © OpenStreetMap contributors, GIS User Community':'');
  const prefix=state.configured?crs(state):'Vista '+ECUADOR[state.region].name+' · plano sin georreferenciar';
  attribution.textContent=prefix+' · '+source+(reduced?' · Detalle reducido por cobertura':'')+(waiting?' · Cargando mapa…':errors&&!loaded?' · Mapa no disponible: revisa conexión o proveedor':'');
  const credit=document.createElement('a');credit.href=state.style==='roads'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer':'https://goto.arcgisonline.com/maps/World_Imagery';credit.target='_blank';credit.rel='noopener';credit.textContent=' · Créditos';attribution.append(credit);
  attribution.style.bottom=(byId('layoutBar').offsetHeight+5)+'px';
 }catch(error){attribution.textContent=crs(state)+' · '+error.message}
}
window.OtroCadGeolocation={draw,isVisible,getState:()=>({...state}),restore,clear:()=>restore(null),showSettings,setEnabled,showEcuador,
 modelToUtm:(point,units)=>modelToUtm(point,state,units),
 utmToModel:(pair,units)=>utmToModel(pair,state,units),
 formatCoordinate:(point,units)=>{if(!isVisible())return '';if(!state.configured)return ' · Vista Ecuador · georreferencia del plano pendiente';const p=modelToUtm(point,state,units);return ' · E '+p[0].toFixed(2)+' · N '+p[1].toFixed(2)+' · '+crs(state)}};
Object.assign(window.OtroCadCivilCommands,{C3DGEO:showSettings,GEOGRAPHICLOCATION:showSettings,GEOMAP:showSettings,GEOMAPOFF:()=>setEnabled(false),ECUADOR:()=>showEcuador(),GALAPAGOS:()=>showEcuador('galapagos')});
window.addEventListener('online',()=>{for(const [id,item] of cache)if(item.status==='error')cache.delete(id);for(const [id,item] of coverage)if(item.available===null&&item.status!=='loading')coverage.delete(id);redraw()});
document.getElementById('tabs').addEventListener('click',event=>{
 const tab=event.target.closest('[data-tab]');if(!tab)return;
 if(tab.dataset.tab==='civil'){
  if(!state.configured&&state.enabled&&!overviewReturn&&!api.getObjects().length){overviewReturn=api.getView();if(overviewView)api.setView(overviewView.center,overviewView.pixelsPerUnit);else showEcuador(state.region)}
  else if(!state.configured&&!state.enabled&&!state.userDisabled&&!api.getObjects().length)showEcuador();
 }else if(overviewReturn&&!state.configured){overviewView=api.getView();const previous=overviewReturn;overviewReturn=null;api.setView(previous.center,previous.pixelsPerUnit)}
 attribution.hidden=!isVisible();redraw();
});
if(migrateExample){state.enabled=false;state.userDisabled=false}
persist();redraw();
})();
