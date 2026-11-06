(()=>{
const $=s=>document.querySelector(s), canvas=$('#cad'),ctx=canvas.getContext('2d'),stage=$('#stage'),status=$('#status'),promptEl=$('#prompt');
let objects=[],undo=[],redo=[],tool='line',start=null,temp=null,selected=-1,selectedSet=new Set(),modifyTargets=[],poly=[],arcPoints=[],cursor={x:0,y:0},zoom=35,offset={x:0,y:0},drag=null;
const MAX_MODEL_ZOOM=1e7;
let lastCommand='',cursorCommandEl=null,contextMenuEl=null,activeFurniture=null;
let activeLayout='Model',layouts=[],layoutViewportRecords=[],hideModelAnnotations=false,layoutRenderTransform=null,lastModelCamera=null,activePaperPlotStyle=null;
function newGroupId(){return 'bloque-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
let rightClickMode='context',rightClickDuringCommand='enter';
try{const prefs=JSON.parse(localStorage.getItem('otrocad-mouse-preferences')||'{}');if(['context','repeat'].includes(prefs.mode))rightClickMode=prefs.mode;if(['enter','context'].includes(prefs.active))rightClickDuringCommand=prefs.active}catch(e){}
let gridOn=true,orthoOn=false,snapOn=false,osnapOn=true,osEnd=true,osMid=true,osCenter=true,osQuadrant=false,osIntersection=false,osNearest=false,osParallel=false,osGeom=false,osInsertion=false,osTangent=false,osExtension=true,osApparent=false,osPerpendicular=false,parallelDirection=null,polarOn=false,crossOn=true,moveBase=null,modifyTarget=-1,polySides=6,offsetDistance=1,offsetDistancePreset=false,printing=false,units='m',gridStep=1,polarStep=15,snapRadius=12,hiddenLayers=new Set(),lockedLayers=new Set();
try{const savedUnits=localStorage.getItem('otrocad-units');if(['m','cm','mm'].includes(savedUnits))units=savedUnits}catch(e){}
try{const p=JSON.parse(localStorage.getItem('otrocad-drafting')||'{}');if(typeof p.gridOn==='boolean')gridOn=p.gridOn;if(typeof p.orthoOn==='boolean')orthoOn=p.orthoOn;if(typeof p.snapOn==='boolean')snapOn=p.snapOn;if(typeof p.osnapOn==='boolean')osnapOn=p.osnapOn;if(typeof p.osEnd==='boolean')osEnd=p.osEnd;if(typeof p.osMid==='boolean')osMid=p.osMid;if(typeof p.osCenter==='boolean')osCenter=p.osCenter;if(typeof p.osQuadrant==='boolean')osQuadrant=p.osQuadrant;if(typeof p.osIntersection==='boolean')osIntersection=p.osIntersection;if(typeof p.osNearest==='boolean')osNearest=p.osNearest;if(typeof p.osParallel==='boolean')osParallel=p.osParallel;if(typeof p.osGeom==='boolean')osGeom=p.osGeom;if(typeof p.osInsertion==='boolean')osInsertion=p.osInsertion;if(typeof p.osTangent==='boolean')osTangent=p.osTangent;if(typeof p.osExtension==='boolean')osExtension=p.osExtension;if(typeof p.osApparent==='boolean')osApparent=p.osApparent;if(typeof p.osPerpendicular==='boolean')osPerpendicular=p.osPerpendicular;if(typeof p.polarOn==='boolean')polarOn=p.polarOn;if(typeof p.crossOn==='boolean')crossOn=p.crossOn;if(Number.isFinite(p.gridStep)&&p.gridStep>0)gridStep=p.gridStep;if(Number.isFinite(p.polarStep)&&p.polarStep>=1&&p.polarStep<=90)polarStep=p.polarStep;if(Number.isFinite(p.snapRadius)&&p.snapRadius>=2&&p.snapRadius<=40)snapRadius=p.snapRadius}catch(e){}
let crossPrefs={size:12,pickbox:10,mode:'auto',color:'#ffffff'};try{const p=JSON.parse(localStorage.getItem('otrocad-crosshair')||'{}');if(Number.isFinite(p.size))crossPrefs.size=Math.max(1,Math.min(100,p.size));if(Number.isFinite(p.pickbox))crossPrefs.pickbox=Math.max(4,Math.min(30,p.pickbox));if(['auto','custom'].includes(p.mode))crossPrefs.mode=p.mode;if(/^#[0-9a-f]{6}$/i.test(p.color||''))crossPrefs.color=p.color}catch(e){}
function saveDraftPreferences(){try{localStorage.setItem('otrocad-drafting',JSON.stringify({gridOn,orthoOn,snapOn,osnapOn,osEnd,osMid,osCenter,osQuadrant,osIntersection,osNearest,osParallel,osGeom,osInsertion,osTangent,osExtension,osApparent,osPerpendicular,polarOn,crossOn,gridStep,polarStep,snapRadius}))}catch(e){}}
const colors={General:'#dce8f5',Muros:'#56b7e8',Cotas:'#f3c83e',Detalles:'#c69cff',Topografía:'#70d6a3',Vialidad:'#ff9b6b'};
function resolveCadColor(s,lightBackground=false){
 const base=String((!lightBackground&&s.colorDark)||s.color||colors[s.layer]||colors.General).toLowerCase();
 if(base==='auto'||base==='#dce8f5')return lightBackground?'#111111':'#ffffff';
 return base;
}
function canvasIsLight(){
 if(printing||activeLayout!=='Model')return true;
 const bg=getComputedStyle($('#stage')).backgroundColor;
 const values=bg.match(/[0-9.]+/g);
 if(!values||values.length<3)return false;
 const [r,g,b]=values.slice(0,3).map(Number);
 return (0.2126*r+0.7152*g+0.0722*b)>145;
}
const clone=x=>JSON.parse(JSON.stringify(x));
let storageWarningShown=false;
function storageWarning(){if(!storageWarningShown){storageWarningShown=true;alert('No se pudo guardar la copia local. Descarga una copia del proyecto y comprueba el espacio o los permisos del navegador.')}}
function backupPrevious(){try{localStorage.setItem('otrocad-drawing-previous',JSON.stringify({shapes:objects,units,layouts:typeof layouts==='undefined'?[]:layouts,viewports:typeof layoutViewportRecords==='undefined'?[]:layoutViewportRecords,activeLayout:typeof activeLayout==='undefined'?'Model':activeLayout}));return true}catch(e){storageWarning();return false}}
function checkpoint(){const backedUp=backupPrevious();undo.push(clone(objects));if(undo.length>100)undo.shift();redo=[];return backedUp}

function cadRecoverySnapshot(){
 return {version:3,savedAt:Date.now(),shapes:objects,units,layouts,viewports:layoutViewportRecords,activeLayout};
}
function cadRecoveryDatabase(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB no disponible'));return}
  let request;
  try{request=indexedDB.open('OtroCADRecovery',1)}catch(error){reject(error);return}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('snapshots'))request.result.createObjectStore('snapshots')};
  request.onerror=()=>reject(request.error||new Error('No se pudo abrir IndexedDB'));
  request.onsuccess=()=>resolve(request.result);
 });
}
async function cadRecoveryWrite(key,value){
 const db=await cadRecoveryDatabase();
 try{await new Promise((resolve,reject)=>{
  const txn=db.transaction('snapshots','readwrite');
  txn.oncomplete=()=>resolve();
  txn.onerror=()=>reject(txn.error||new Error('No se pudo guardar en IndexedDB'));
  txn.onabort=()=>reject(txn.error||new Error('Se canceló el respaldo'));
  try{txn.objectStore('snapshots').put(value,key)}catch(error){reject(error)}
 })}finally{db.close()}
}
async function cadRecoveryRead(key){
 const db=await cadRecoveryDatabase();
 try{return await new Promise((resolve,reject)=>{
  const txn=db.transaction('snapshots','readonly');
  const req=txn.objectStore('snapshots').get(key);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error||new Error('No se pudo recuperar el respaldo'));
  txn.onabort=()=>reject(txn.error||new Error('Se canceló la lectura'));
 })}finally{db.close()}
}
function cadRecoveryRestoreCandidate(record){
 if(typeof record==='string'){try{record=JSON.parse(record)}catch(error){return null}}
 if(Array.isArray(record))return {shapes:record,savedAt:0};
 return record&&Array.isArray(record.shapes)?record:null;
}
async function protectDrawingBeforeReplacement(){
 if(!objects.length&&!layouts.length&&!layoutViewportRecords.length)return true;
 const snapshot=cadRecoverySnapshot();
 let text;
 try{text=JSON.stringify(snapshot)}catch(error){alert('No se pudo preparar la copia del dibujo actual. No se cambió nada.');return false}
 let backedUpLocally=false;
 try{
  localStorage.setItem('otrocad-drawing-previous',text);
  backedUpLocally=true;
 }catch(error){console.warn('Respaldo en localStorage no disponible; probando IndexedDB:',error)}
 // Keep a separate durable recovery point so a subsequent Undo checkpoint
 // on the new drawing cannot overwrite the prior imported project.
 try{
  await cadRecoveryWrite('previous',snapshot);
  status.textContent='Dibujo anterior protegido en almacenamiento ampliado del navegador';
  return true;
 }catch(error){console.warn('No se pudo guardar una segunda copia en IndexedDB:',error)}
 if(backedUpLocally)return true;
 // A download plus explicit acknowledgement is the last resort; never silently discard a plan.
 try{
  await download('otrocad-respaldo-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',text,'application/json');
 }catch(error){alert('El navegador no permite guardar una copia. Se conservará el dibujo actual.');return false}
 return confirm('El navegador no tiene espacio para guardar otra copia local. Se ha solicitado descargar el archivo de respaldo OtroCAD.\n\nComprueba que el archivo .json aparece en Descargas antes de continuar.\n\n¿Confirmas que ya guardaste el respaldo y deseas continuar?');
}
function pushReplacementUndo(){
 undo.push(clone(objects));if(undo.length>100)undo.shift();redo=[];
}
async function cadReadLastBackup(){
 let fromLocal=null,fromDatabase=null;
 try{fromLocal=cadRecoveryRestoreCandidate(localStorage.getItem('otrocad-drawing-previous'))}catch(error){console.warn('No se pudo leer respaldo local:',error)}
 try{fromDatabase=cadRecoveryRestoreCandidate(await cadRecoveryRead('previous'))}catch(error){console.warn('No se pudo leer respaldo ampliado:',error)}
 if(!fromDatabase)return fromLocal;
 if(!fromLocal)return fromDatabase;
 return Number(fromDatabase.savedAt||0)>Number(fromLocal.savedAt||0)?fromDatabase:fromLocal;
}

function selectedItems(){const out=new Set(selectedSet);if(selected>=0)out.add(selected);return [...out].filter(i=>i>=0&&i<objects.length).sort((a,b)=>a-b)}
let editingBlockId=null;
function applySelection(indices,additive=false){const next=additive?new Set(selectedItems()):new Set(),groups=new Set();for(const i of indices)if(i>=0&&i<objects.length){next.add(i);if(objects[i]?.groupId&&objects[i].groupId!==editingBlockId)groups.add(objects[i].groupId)}if(groups.size)objects.forEach((o,j)=>{if(groups.has(o.groupId)&&!hiddenLayers.has(o.layer)&&!lockedLayers.has(o.layer))next.add(j)});selectedSet=next;selected=next.size?[...next].sort((a,b)=>a-b).at(-1):-1}
function clearSelection(){selected=-1;selectedSet.clear()}
function deleteSelection(){const ids=selectedItems();if(!ids.length)return;checkpoint();ids.sort((a,b)=>b-a).forEach(i=>objects.splice(i,1));clearSelection();save();render();status.textContent=ids.length===1?'Objeto eliminado':ids.length+' objetos eliminados'}
let cadAutosaveDirty=0,cadAutosaveTimer=null,cadAutosaveRunning=false,cadLastIndexedSave=0,cadLastCheckpointAt=0;
function scheduleCadAutosave(){
 cadAutosaveDirty++;
 if(cadAutosaveTimer)clearTimeout(cadAutosaveTimer);
 cadAutosaveTimer=setTimeout(()=>{cadAutosaveTimer=null;void persistCadProgress();},6500);
}
async function persistCadProgress(force=false){
 if(cadAutosaveRunning||(!force&&!cadAutosaveDirty))return false;
 cadAutosaveRunning=true;
 const startVersion=cadAutosaveDirty,snapshot=cadRecoverySnapshot();
 try{
  if(Date.now()-cadLastCheckpointAt>=180000){
   const current=await cadRecoveryRead('autosave-latest').catch(()=>null);
   if(current?.shapes)await cadRecoveryWrite('autosave-previous',current);
   cadLastCheckpointAt=Date.now();
  }
  await cadRecoveryWrite('autosave-latest',snapshot);
  cadLastIndexedSave=Date.now();
  if(cadAutosaveDirty===startVersion)cadAutosaveDirty=0;
  window.OtroCadSaveUI?.updateProgress?.(cadLastIndexedSave);
  return true;
 }catch(error){console.warn('No se pudo guardar punto de recuperación en IndexedDB',error);return false}
 finally{cadAutosaveRunning=false}
}
function save(){
 let saved=false;
 try{
  localStorage.setItem('otrocad-drawing',JSON.stringify(objects));
  localStorage.setItem('otrocad-units',units);saved=true;
 }catch(e){storageWarning()}
 if(typeof scheduleCadAutosave==='function')scheduleCadAutosave();return saved;
}

function world(p){return{x:(p.x-canvas.clientWidth/2-offset.x)/zoom,y:(canvas.clientHeight/2+offset.y-p.y)/zoom}}
function screen(p){if(layoutRenderTransform)return{x:layoutRenderTransform.tx+p.x*layoutRenderTransform.scale,y:layoutRenderTransform.ty-p.y*layoutRenderTransform.scale};return{x:canvas.clientWidth/2+offset.x+p.x*zoom,y:canvas.clientHeight/2+offset.y-p.y*zoom}}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function round(p){const precision=typeof zoom==='number'&&zoom>500?1e9:1000;return{x:Math.round(p.x*precision)/precision,y:Math.round(p.y*precision)/precision}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}
function normalize(a){return (a%360+360)%360}
let activeSnap=null;
function snapCandidate(p,excludedIndex=-1){
 if(!osnapOn)return null;
 let best=null,limit=snapRadius/zoom;
 // Do not magnetize a grip to its own geometry in any OSNAP mode.
 const snapObjects=excludedIndex>=0?objects.filter((_,i)=>i!==excludedIndex):objects;
 for(const s of snapObjects){
  if(!isVisibleModelEntity(s))continue;
  const pts=[];
  if(osEnd){
   if(s.a&&!['circle','ellipse','text'].includes(s.type))pts.push({point:s.a,type:'PUNTO FINAL'});
   if(s.b&&!['circle','ellipse'].includes(s.type))pts.push({point:s.b,type:'PUNTO FINAL'});
   if(s.pts){const endpoints=s.type==='arc'?[s.pts[0],s.pts[s.pts.length-1]]:s.pts;for(const v of endpoints)if(v)pts.push({point:v,type:'PUNTO FINAL'})}
   if((s.type==='rect'||s.type==='hatch')&&s.a&&s.b)pts.push({point:{x:s.a.x,y:s.b.y},type:'PUNTO FINAL'},{point:{x:s.b.x,y:s.a.y},type:'PUNTO FINAL'});
  }
  if(osMid){
   if(s.a&&s.b&&['line','leader','dim','dimaligned'].includes(s.type))pts.push({point:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},type:'PUNTO MEDIO'});
   if(['poly','polygon'].includes(s.type)&&s.pts?.length>1){const n=s.pts.length-1+(s.type==='polygon'?1:0);for(let i=0;i<n;i++){const a=s.pts[i],b=s.pts[(i+1)%s.pts.length];pts.push({point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},type:'PUNTO MEDIO'})}}
  }
  if(osCenter&&s.a&&['circle','ellipse'].includes(s.type))pts.push({point:s.a,type:'CENTRO'});
  if(osQuadrant&&s.a&&s.b&&['circle','ellipse'].includes(s.type)){const rx=s.type==='circle'?distance(s.a,s.b):Math.abs(s.b.x-s.a.x),ry=s.type==='circle'?rx:Math.abs(s.b.y-s.a.y);for(const [dx,dy] of [[rx,0],[-rx,0],[0,ry],[0,-ry]])pts.push({point:{x:s.a.x+dx,y:s.a.y+dy},type:'CUADRANTE'})}
  for(const candidate of pts){const d=distance(p,candidate.point);if(d<limit){limit=d;best=candidate}}
 }
 if(osIntersection){
  const near=[],radius=snapRadius/zoom;
  for(const s of snapObjects){if(!isVisibleModelEntity(s)||!['line','poly','polygon','rect'].includes(s.type))continue;for(const [a,b] of entitySegments(s)){if(pointLineDistance(p,a,b)<=radius){near.push([a,b]);if(near.length>=256)break}}if(near.length>=256)break}
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const hit=lineIntersection(near[i][0],near[i][1],near[j][0],near[j][1],true);if(hit){const d=distance(p,hit);if(d<limit){limit=d;best={point:{x:hit.x,y:hit.y},type:'INTERSECCIÓN'}}}}
 }

 if(typeof osGeom!=='undefined'&&osGeom){for(const shape of snapObjects){if(hiddenLayers.has(shape.layer))continue;let point=null;if(shape.type==='rect'&&shape.a&&shape.b)point={x:(shape.a.x+shape.b.x)/2,y:(shape.a.y+shape.b.y)/2};else if(shape.type==='polygon'&&shape.pts?.length>=3){let area=0,x=0,y=0;for(let i=0;i<shape.pts.length;i++){const a=shape.pts[i],b=shape.pts[(i+1)%shape.pts.length],v=a.x*b.y-b.x*a.y;area+=v;x+=(a.x+b.x)*v;y+=(a.y+b.y)*v}if(Math.abs(area)>1e-12)point={x:x/(3*area),y:y/(3*area)}}if(point){const d=distance(p,point);if(d<limit){limit=d;best={point,type:'CENTRO GEOMÉTRICO'}}}}}
 if(typeof osInsertion!=='undefined'&&osInsertion){for(const shape of snapObjects){if(hiddenLayers.has(shape.layer)||shape.type!=='text'||!shape.a)continue;const d=distance(p,shape.a);if(d<limit){limit=d;best={point:shape.a,type:'INSERCIÓN'}}}}
 if(typeof osTangent!=='undefined'&&osTangent&&typeof start!=='undefined'&&start){for(const shape of snapObjects){if(hiddenLayers.has(shape.layer)||shape.type!=='circle'||!shape.a||!shape.b)continue;const dx=start.x-shape.a.x,dy=start.y-shape.a.y,r=distance(shape.a,shape.b),d2=dx*dx+dy*dy;if(d2<r*r||d2<1e-18)continue;const k=r*r/d2,h=r*Math.sqrt(Math.max(0,d2-r*r))/d2;for(const sign of [-1,1]){const point={x:shape.a.x+k*dx-sign*h*dy,y:shape.a.y+k*dy+sign*h*dx},d=distance(p,point);if(d<limit){limit=d;best={point,type:'TANGENTE'}}}}}
 if(typeof osExtension!=='undefined'&&osExtension){for(const shape of snapObjects){if(hiddenLayers.has(shape.layer)||shape.type!=='line'||!shape.a||!shape.b)continue;const a=shape.a,b=shape.b,dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/den;if(t>=0&&t<=1)continue;const point={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,point);if(d<limit){limit=d;best={point,type:'EXTENSIÓN',origin:t<0?a:b}}}}
 if(typeof osApparent!=='undefined'&&osApparent){const lines=snapObjects.filter(s=>s.type==='line'&&s.a&&s.b&&!hiddenLayers.has(s.layer)).slice(0,128);for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const hit=lineIntersection(lines[i].a,lines[i].b,lines[j].a,lines[j].b,false);if(!hit)continue;const d=distance(p,hit);if(d<limit){limit=d;best={point:{x:hit.x,y:hit.y},type:'INTERSECCIÓN APARENTE'}}}}
 if(typeof osPerpendicular!=='undefined'&&osPerpendicular&&typeof start!=='undefined'&&start){
  for(const shape of snapObjects){if(hiddenLayers.has(shape.layer)||!['line','poly','polygon','rect'].includes(shape.type))continue;for(const [a,b] of entitySegments(shape)){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=((start.x-a.x)*dx+(start.y-a.y)*dy)/den;if(t<0||t>1)continue;const point={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,point);if(d<limit){limit=d;best={point,type:'PERPENDICULAR'}}}}
 }
 if(typeof osNearest!=='undefined'&&osNearest&&!best){
  for(const shape of snapObjects){if(hiddenLayers.has(shape.layer))continue;
   if(shape.type==='circle'&&shape.a&&shape.b){const r=distance(shape.a,shape.b),d=distance(p,shape.a);if(d>1e-12){const point={x:shape.a.x+(p.x-shape.a.x)*r/d,y:shape.a.y+(p.y-shape.a.y)*r/d},delta=distance(p,point);if(delta<limit){limit=delta;best={point,type:'MÁS CERCANO'}}}continue}
   if(!['line','poly','polygon','rect','leader','dim','dimaligned'].includes(shape.type))continue;
   for(const [a,b] of entitySegments(shape)){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)),point={x:a.x+t*dx,y:a.y+t*dy},delta=distance(p,point);if(delta<limit){limit=delta;best={point,type:'MÁS CERCANO'}}}
  }
 }
 return best;
}
function snapPoint(p,excludedIndex=-1){
 const candidate=snapCandidate(p,excludedIndex);activeSnap=candidate;
 if(candidate)return {...candidate.point};
 const q={...p};
 if(snapOn){q.x=Math.round(q.x/gridStep)*gridStep;q.y=Math.round(q.y/gridStep)*gridStep}
 return q;
}

function constrain(p){
 const base=tool==='poly'&&poly.length?poly[poly.length-1]:(['move','copy'].includes(tool)&&moveBase?moveBase:start);
 if(!base)return p;
 let dx=p.x-base.x,dy=p.y-base.y;
 if(orthoOn){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
 else if(typeof osParallel!=='undefined'&&osParallel&&osnapOn&&['line','poly'].includes(tool)){
  for(const item of objects){if(item.type!=='line'||hiddenLayers.has(item.layer))continue;const length=distance(item.a,item.b);if(length>1e-9&&pointLineDistance(p,item.a,item.b)<=snapRadius/zoom){parallelDirection={x:(item.b.x-item.a.x)/length,y:(item.b.y-item.a.y)/length};break}}
  if(parallelDirection){const d=dx*parallelDirection.x+dy*parallelDirection.y,cross=Math.abs(dx*parallelDirection.y-dy*parallelDirection.x);if(Math.hypot(dx,dy)>1e-9&&cross/Math.hypot(dx,dy)<Math.sin(5*Math.PI/180)){dx=d*parallelDirection.x;dy=d*parallelDirection.y;status.textContent='PARALELO · línea de referencia'}}
 }
 else if(polarOn){const len=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(polarStep*Math.PI/180))*(polarStep*Math.PI/180);dx=len*Math.cos(a);dy=len*Math.sin(a)}
 return round({x:base.x+dx,y:base.y+dy});
}
function arcParams(points){if(!points||points.length<3)return null;const p=points.map(screen),[a,b,c]=p;const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-6)return null;const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;const x=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;const a1=Math.atan2(a.y-y,a.x-x),am=Math.atan2(b.y-y,b.x-x),a3=Math.atan2(c.y-y,c.x-x),span=v=>(v+Math.PI*2)%(Math.PI*2),ccw=span(a3-a1),mid=span(am-a1);return{x,y,r:Math.hypot(a.x-x,a.y-y),a1,a3,anticlockwise:mid>ccw}}
const CAD_THEMES={white:'#ffffff',black:'#050709',dark:'#101820',graphite:'#242a30',slate:'#34424d',bluegray:'#405665'};
let cadTheme='dark';try{cadTheme=localStorage.getItem('otrocad-canvas-theme')||'dark'}catch(e){}
function applyCanvasTheme(name){if(!CAD_THEMES[name])return;cadTheme=name;$('#stage').style.backgroundColor=CAD_THEMES[name];try{localStorage.setItem('otrocad-canvas-theme',name)}catch(e){}render();status.textContent='Fondo: '+name.toUpperCase()}
function cadLineDash(linetype){
 const name=String(linetype||'CONTINUOUS').toUpperCase();
 if(name.includes('DASHDOT')||name.includes('CENTER'))return [16,5,3,5];
 if(name.includes('PHANTOM'))return [18,5,3,5,3,5];
 if(name.includes('HIDDEN')||name.includes('DASH'))return [9,5];
 if(name.includes('DOT'))return [1.5,5];
 return [];
}
function cadHatchGradient(s,points){
 const colors=s.hatchGradientColors;
 if(!colors?.length||!points?.length)return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const r=Math.max(1,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))/2);
 const a=-Number(s.hatchGradientAngle||0)*Math.PI/180,dx=Math.cos(a)*r,dy=Math.sin(a)*r;
 const gradient=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
 gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]||colors[0]);
 return gradient;
}
function strokeCadHatchPattern(s,allPoints){
 const defs=s.hatchPatternLines;
 if(!defs?.length||!allPoints?.length)return false;
 const xs=allPoints.map(p=>p.x),ys=allPoints.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const radius=Math.min(40000,Math.hypot(maxX-minX,maxY-minY)+100),corners=[[minX,minY],[maxX,minY],[minX,maxY],[maxX,maxY]];
 let rendered=0;
 for(const def of defs.slice(0,64)){
  const angle=Number(def.angle||0)*Math.PI/180,d={x:Math.cos(angle),y:-Math.sin(angle)},n={x:-d.y,y:d.x};
  const base=screen(def.base||{x:0,y:0}),delta={x:Number(def.offset?.x||0)*zoom,y:-Number(def.offset?.y||0)*zoom};
  const step=delta.x*n.x+delta.y*n.y;
  if(!Number.isFinite(step)||Math.abs(step)<1e-7)continue;
  const projections=corners.map(p=>p.x*n.x+p.y*n.y),baseProj=base.x*n.x+base.y*n.y;
  const kA=(Math.min(...projections)-baseProj)/step,kB=(Math.max(...projections)-baseProj)/step;
  const low=Math.ceil(Math.min(kA,kB)-1),high=Math.floor(Math.max(kA,kB)+1);
  if(!Number.isFinite(low)||!Number.isFinite(high))continue;
  const dash=(def.dashes||[]).map(v=>Math.max(.75,Math.min(2000,Math.abs(Number(v))*zoom)));
  ctx.setLineDash(dash.length?dash:[]);
  ctx.lineWidth=Math.max(.7,Math.min(2,Number(s.lineweight||.25)*2.4));
  const count=Math.max(0,high-low+1),stride=Math.max(1,Math.ceil(count/Math.max(1,1200-rendered)));
  for(let k=low;k<=high&&rendered<1200;k+=stride){
   const p={x:base.x+k*delta.x,y:base.y+k*delta.y};
   ctx.beginPath();ctx.moveTo(p.x-d.x*radius,p.y-d.y*radius);ctx.lineTo(p.x+d.x*radius,p.y+d.y*radius);ctx.stroke();rendered++;
  }
  if(rendered>=1200)break;
 }
 ctx.setLineDash([]);
 return rendered>0;
}

const CAD_TEXT_FONT_CATALOG=[
 {id:'arial',label:'Arial',file:'arial.ttf',boldFile:'arialbd.ttf',italicFile:'ariali.ttf',boldItalicFile:'arialbi.ttf',family:'Arial, Helvetica, sans-serif'},
 {id:'arial-narrow',label:'Arial Narrow',file:'arialn.ttf',boldFile:'arialnb.ttf',italicFile:'arialni.ttf',boldItalicFile:'arialnbi.ttf',family:'"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'},
 {id:'bahnschrift',label:'Bahnschrift',file:'bahnschrift.ttf',boldFile:'bahnschrift.ttf',italicFile:'bahnschrift.ttf',boldItalicFile:'bahnschrift.ttf',family:'Bahnschrift, "Arial Narrow", Arial, sans-serif'},
 {id:'book-antiqua',label:'Book Antiqua',file:'BKANT.TTF',boldFile:'ANTQUAB.TTF',italicFile:'ANTQUAI.TTF',boldItalicFile:'ANTQUABI.TTF',family:'"Book Antiqua", Palatino, serif'},
 {id:'calibri',label:'Calibri',file:'calibri.ttf',boldFile:'calibrib.ttf',italicFile:'calibrii.ttf',boldItalicFile:'calibriz.ttf',family:'Calibri, "Segoe UI", Arial, sans-serif'},
 {id:'cambria',label:'Cambria',file:'cambria.ttf',boldFile:'cambriab.ttf',italicFile:'cambriai.ttf',boldItalicFile:'cambriaz.ttf',family:'Cambria, Georgia, serif'},
 {id:'candara',label:'Candara',file:'candara.ttf',boldFile:'candarab.ttf',italicFile:'candarai.ttf',boldItalicFile:'candaraz.ttf',family:'Candara, Calibri, Arial, sans-serif'},
 {id:'century-gothic',label:'Century Gothic',file:'gothic.ttf',boldFile:'gothicb.ttf',italicFile:'gothici.ttf',boldItalicFile:'gothicbi.ttf',family:'"Century Gothic", Arial, sans-serif'},
 {id:'comic-sans',label:'Comic Sans MS',file:'comic.ttf',boldFile:'comicbd.ttf',italicFile:'comic.ttf',boldItalicFile:'comicbd.ttf',family:'"Comic Sans MS", cursive, sans-serif'},
 {id:'consolas',label:'Consolas',file:'consola.ttf',boldFile:'consolab.ttf',italicFile:'consolai.ttf',boldItalicFile:'consolaz.ttf',family:'Consolas, "Courier New", monospace'},
 {id:'courier-new',label:'Courier New',file:'cour.ttf',boldFile:'courbd.ttf',italicFile:'couri.ttf',boldItalicFile:'courbi.ttf',family:'"Courier New", Courier, monospace'},
 {id:'franklin-gothic',label:'Franklin Gothic Medium',file:'framd.ttf',boldFile:'framd.ttf',italicFile:'framd.ttf',boldItalicFile:'framd.ttf',family:'"Franklin Gothic Medium", Arial, sans-serif'},
 {id:'garamond',label:'Garamond',file:'gara.ttf',boldFile:'garabd.ttf',italicFile:'garait.ttf',boldItalicFile:'garabi.ttf',family:'Garamond, Georgia, serif'},
 {id:'georgia',label:'Georgia',file:'georgia.ttf',boldFile:'georgiab.ttf',italicFile:'georgiai.ttf',boldItalicFile:'georgiaz.ttf',family:'Georgia, "Times New Roman", serif'},
 {id:'impact',label:'Impact',file:'impact.ttf',boldFile:'impact.ttf',italicFile:'impact.ttf',boldItalicFile:'impact.ttf',family:'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'},
 {id:'lucida-console',label:'Lucida Console',file:'lucon.ttf',boldFile:'lucon.ttf',italicFile:'lucon.ttf',boldItalicFile:'lucon.ttf',family:'"Lucida Console", Consolas, monospace'},
 {id:'palatino',label:'Palatino Linotype',file:'pala.ttf',boldFile:'palab.ttf',italicFile:'palai.ttf',boldItalicFile:'palabi.ttf',family:'"Palatino Linotype", Palatino, serif'},
 {id:'segoe-ui',label:'Segoe UI',file:'segoeui.ttf',boldFile:'segoeuib.ttf',italicFile:'segoeuii.ttf',boldItalicFile:'segoeuiz.ttf',family:'"Segoe UI", Arial, sans-serif'},
 {id:'tahoma',label:'Tahoma',file:'tahoma.ttf',boldFile:'tahomabd.ttf',italicFile:'tahoma.ttf',boldItalicFile:'tahomabd.ttf',family:'Tahoma, Arial, sans-serif'},
 {id:'times-new-roman',label:'Times New Roman',file:'times.ttf',boldFile:'timesbd.ttf',italicFile:'timesi.ttf',boldItalicFile:'timesbi.ttf',family:'"Times New Roman", Times, serif'},
 {id:'trebuchet',label:'Trebuchet MS',file:'trebuc.ttf',boldFile:'trebucbd.ttf',italicFile:'trebucit.ttf',boldItalicFile:'trebucbi.ttf',family:'"Trebuchet MS", Arial, sans-serif'},
 {id:'verdana',label:'Verdana',file:'verdana.ttf',boldFile:'verdanab.ttf',italicFile:'verdanai.ttf',boldItalicFile:'verdanaz.ttf',family:'Verdana, Geneva, sans-serif'},
 {id:'shx-txt',label:'AutoCAD TXT (SHX)',file:'txt.shx',boldFile:'txt.shx',italicFile:'txt.shx',boldItalicFile:'txt.shx',family:'"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'},
 {id:'shx-simplex',label:'AutoCAD Simplex (SHX)',file:'simplex.shx',boldFile:'simplex.shx',italicFile:'simplex.shx',boldItalicFile:'simplex.shx',family:'"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'},
 {id:'shx-romans',label:'AutoCAD Romans (SHX)',file:'romans.shx',boldFile:'romans.shx',italicFile:'romans.shx',boldItalicFile:'romans.shx',family:'"Times New Roman", Georgia, serif'},
 {id:'shx-romand',label:'AutoCAD RomanD (SHX)',file:'romand.shx',boldFile:'romand.shx',italicFile:'romand.shx',boldItalicFile:'romand.shx',family:'"Times New Roman", Georgia, serif'},
 {id:'shx-iso',label:'AutoCAD ISO (SHX)',file:'iso.shx',boldFile:'iso.shx',italicFile:'iso.shx',boldItalicFile:'iso.shx',family:'"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'},
 {id:'shx-isocp',label:'AutoCAD ISOCP (SHX)',file:'isocp.shx',boldFile:'isocp.shx',italicFile:'isocp.shx',boldItalicFile:'isocp.shx',family:'"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'},
 {id:'shx-gothic',label:'AutoCAD Gothic (SHX)',file:'gothice.shx',boldFile:'gothice.shx',italicFile:'gothice.shx',boldItalicFile:'gothice.shx',family:'Arial, Helvetica, sans-serif'},
 {id:'shx-script',label:'AutoCAD Script (SHX)',file:'script.shx',boldFile:'script.shx',italicFile:'script.shx',boldItalicFile:'script.shx',family:'"Segoe Script", "Comic Sans MS", cursive'},
 {id:'shx-complex',label:'AutoCAD Complex (SHX)',file:'complex.shx',boldFile:'complex.shx',italicFile:'complex.shx',boldItalicFile:'complex.shx',family:'"Times New Roman", Georgia, serif'},
 {id:'shx-technic',label:'AutoCAD Technic (SHX)',file:'technic.shx',boldFile:'technic.shx',italicFile:'technic.shx',boldItalicFile:'technic.shx',family:'"Arial Narrow", Arial, sans-serif'}
];
function cadFontEntryForFile(file){
 const base=String(file||'').replace(/\\/g,'/').split('/').pop().toLowerCase();
 return CAD_TEXT_FONT_CATALOG.find(entry=>[entry.file,entry.boldFile,entry.italicFile,entry.boldItalicFile].some(name=>String(name||'').toLowerCase()===base))||null;
}
function cadFontVariantFile(entry,bold,italic){
 if(bold&&italic)return entry.boldItalicFile||entry.boldFile||entry.file;
 if(bold)return entry.boldFile||entry.file;
 if(italic)return entry.italicFile||entry.file;
 return entry.file;
}
function cadFontFamilyFromFile(file){
 const entry=cadFontEntryForFile(file);if(entry)return entry.family;
 const base=String(file||'txt.shx').replace(/\\/g,'/').split('/').pop().toLowerCase();
 if(/impact/.test(base))return 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
 if(/arialn|narrow|condensed|txt|simplex|iso|technic/.test(base))return '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif';
 if(/arial|verdana|tahoma|segoe|gothic|framd/.test(base))return 'Arial, Helvetica, sans-serif';
 if(/romans|romand|times|serif|complex/.test(base))return '"Times New Roman", Georgia, serif';
 if(/mono|courier|consola|lucon/.test(base))return '"Courier New", monospace';
 if(/script/.test(base))return '"Segoe Script", "Comic Sans MS", cursive';
 return 'Arial, Helvetica, sans-serif';
}
function wrapCadTextLines(value,maxWidth,measureText){
 const paragraphs=String(value??'').replace(/\r/g,'').split('\n'),out=[];
 const measure=typeof measureText==='function'?measureText:()=>0;
 for(const paragraph of paragraphs){
  const words=paragraph.match(/\S+/g)||[];
  if(!words.length){out.push('');continue}
  let line='';
  for(const word of words){
   const candidate=line?line+' '+word:word;
   if(line&&maxWidth>0&&measure(candidate)>maxWidth){out.push(line);line=word}else line=candidate;
   if(maxWidth>0&&line&&measure(line)>maxWidth){
    let part='';
    for(const char of Array.from(line)){
     const next=part+char;
     if(part&&measure(next)>maxWidth){out.push(part);part=char}else part=next;
    }
    line=part;
   }
  }
  if(line)out.push(line);
 }
 return out.length?out:[''];
}
function cadTextBoundsWorld(s){
 if(!s||s.type!=='text'||!s.a||!ctx||typeof ctx.measureText!=='function')return [];
 const height=Math.max(.001,Number(s.textHeightWorld||Number(s.textHeight||14)/Math.max(zoom,.001))),size=Math.max(.5,height*zoom);
 const fontFile=String(s.textFontFile||'txt.shx'),fontFamily=s.textFontFamily||cadFontFamilyFromFile(fontFile);
 const bold=Boolean(s.textFontBold)||/(?:bd|bold|bi)\.(?:ttf|otf)$/i.test(fontFile),italic=Boolean(s.textFontItalic)||/(?:italic|oblique|i|it|z|bi)\.(?:ttf|otf)$/i.test(fontFile);
 ctx.save();ctx.font=(bold?'bold ':'')+(italic?'italic ':'')+size+'px '+fontFamily;
 const value=String(s.text||'Texto'),mtext=Boolean(s.isMText)||Number(s.mtextWidthWorld||0)>0,widthFactor=Math.max(.05,Math.min(20,Number(s.textWidthFactor||s.textStyleWidthFactor)||1));
 const lines=mtext&&Number(s.mtextWidthWorld)>0?wrapCadTextLines(value,Number(s.mtextWidthWorld)*zoom/widthFactor,t=>ctx.measureText(t).width):value.split('\n');
 const widths=lines.map(line=>ctx.measureText(line).width),maxWidth=Math.max(1,...widths);
 let renderWidthFactor=widthFactor;
 const horizontal=Number(s.textHorizontalAlignment||0),vertical=Number(s.textVerticalAlignment||0);
 if(!mtext&&(horizontal===3||horizontal===5)&&Number(s.textFitWidthWorld)>0){const natural=maxWidth*renderWidthFactor,target=Number(s.textFitWidthWorld)*zoom;if(natural>0)renderWidthFactor*=target/natural}
 const lineHeight=size*1.2*(Number(s.mtextLineSpacingFactor)>0?Math.max(.5,Math.min(4,Number(s.mtextLineSpacingFactor))):1);
 let xMin=0,xMax=maxWidth,yMin=0,yMax=lines.length*lineHeight;
 if(mtext){
  const boxWidth=Number(s.mtextWidthWorld)>0?Number(s.mtextWidthWorld)*zoom/widthFactor:maxWidth;
  const attachment=Math.max(1,Math.min(9,Math.round(Number(s.mtextAttachment||1)))),column=(attachment-1)%3,row=Math.floor((attachment-1)/3);
  xMin=column===0?0:column===1?-boxWidth/2:-boxWidth;xMax=xMin+boxWidth;
  const totalHeight=Math.max(size,lines.length*lineHeight);yMin=row===0?0:row===1?-totalHeight/2:-totalHeight;yMax=yMin+totalHeight;
 }else{
  xMin=horizontal===1||horizontal===4?-maxWidth/2:horizontal===2?-maxWidth:0;xMax=xMin+maxWidth;
  const baseTop=vertical===1?-size:vertical===2?-.5*size:vertical===3?0:-.8*size;
  const baseBottom=vertical===1?0:vertical===2?.5*size:vertical===3?size:.2*size;
  yMin=baseTop;yMax=(lines.length-1)*lineHeight+baseBottom;
 }
 const anchor=(!mtext&&(horizontal||vertical)&&horizontal!==3&&horizontal!==5&&s.textAlignmentPoint)?s.textAlignmentPoint:s.a;
 const anchorScreen=screen(anchor),theta=Number(s.textRotation||0)*Math.PI/180,c=Math.cos(theta),sn=Math.sin(theta),shear=Math.tan(Math.max(-80,Math.min(80,Number(s.textObliqueAngle||0)))*Math.PI/180),flipX=Number(s.textGenerationFlags||0)&2?-1:1,flipY=Number(s.textGenerationFlags||0)&4?-1:1;
 const corners=[[xMin,yMin],[xMax,yMin],[xMax,yMax],[xMin,yMax]].map(([x,y])=>{
  const lx=x*renderWidthFactor*flipX+shear*y,ly=y*flipY;
  return world({x:anchorScreen.x+c*lx+sn*ly,y:anchorScreen.y-sn*lx+c*ly});
 });
 ctx.restore();return corners;
}

function drawEntity(s,sel=false,preview=false){
 ctx.save();const drawZoom=layoutRenderTransform?.scale||zoom;let color=resolveCadColor(s,canvasIsLight());
 if(typeof activePaperPlotStyle!=='undefined'&&activePaperPlotStyle==='monochrome')color='#111111';
 else if(typeof activePaperPlotStyle!=='undefined'&&activePaperPlotStyle==='grayscale'){
  const match=color.match(/^#([0-9a-f]{6})$/i);
  if(match){const n=parseInt(match[1],16),gray=Math.round(.2126*((n>>16)&255)+.7152*((n>>8)&255)+.0722*(n&255));
   color='#'+[gray,gray,gray].map(v=>Math.min(215,Math.max(40,v)).toString(16).padStart(2,'0')).join('');}
 }
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=preview?1.5:(sel?2.2:Math.max(.8,Math.min(8,Number(s.lineweight||.25)*2.4)));ctx.setLineDash(preview?[8,6]:cadLineDash(s.linetype));ctx.lineDashOffset=0;ctx.globalAlpha=preview?.95:Math.max(0,Math.min(1,Number(s.cadOpacity??1)));
 const a=s.a&&screen(s.a),b=s.b&&screen(s.b);
 if(s.type==='point'){ctx.beginPath();ctx.moveTo(a.x-4,a.y);ctx.lineTo(a.x+4,a.y);ctx.moveTo(a.x,a.y-4);ctx.lineTo(a.x,a.y+4);ctx.stroke()}
 else if(s.type==='line'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 else if(s.type==='poly'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.stroke()}
 else if(s.type==='arc'){const g=arcParams(s.pts);if(g){ctx.beginPath();ctx.arc(g.x,g.y,g.r,g.a1,g.a3,g.anticlockwise);ctx.stroke()}else{const ps=s.pts.map(screen);ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ctx.quadraticCurveTo(ps[1].x,ps[1].y,ps[2].x,ps[2].y);ctx.stroke()}}
 else if(s.type==='leader'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.font='12px system-ui';ctx.fillText(s.text||'',b.x+4,b.y-4)}
 else if(s.type==='circle'){ctx.beginPath();ctx.arc(a.x,a.y,distance(a,b),0,Math.PI*2);ctx.stroke()}
 else if(s.type==='rect'||s.type==='hatch'){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);if(s.type==='rect'||!s.importedHatch||sel||preview)ctx.strokeRect(x,y,w,h);if(s.type==='hatch'){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.lineWidth=.8;const spacing=Math.max(5,Math.min(60,Number(s.hatchSpacing||10)));const pattern=s.hatchPattern||'ANSI31';if(pattern==='SOLID'){ctx.globalAlpha=Math.max(0,Math.min(1,Number(s.hatchOpacity??.18)));ctx.fillStyle=cadHatchGradient(s,[{x,y},{x:x+w,y:y+h}])||color;ctx.fillRect(x,y,w,h)}else if(s.hatchPatternLines?.length){strokeCadHatchPattern(s,[{x,y},{x:x+w,y:y+h}])}else{const lines=(reverse)=>{for(let k=-h-w;k<w+h*2;k+=spacing){ctx.beginPath();if(reverse){ctx.moveTo(x+k,y);ctx.lineTo(x+k-h,y+h)}else{ctx.moveTo(x+k,y);ctx.lineTo(x+k+h,y+h)}ctx.stroke()}};lines(false);if(pattern==='CROSS')lines(true);if(pattern==='GRID'){for(let k=0;k<w;k+=spacing){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k,y+h);ctx.stroke()}for(let k=0;k<h;k+=spacing){ctx.beginPath();ctx.moveTo(x,y+k);ctx.lineTo(x+w,y+k);ctx.stroke()}}}ctx.restore()}}
 else if(s.type==='ellipse'){ctx.beginPath();ctx.ellipse(a.x,a.y,Math.abs(b.x-a.x),Math.abs(b.y-a.y),0,0,Math.PI*2);ctx.stroke()}
 else if(s.type==='polygon'){
  const loops=s.hatchLoops?.length?s.hatchLoops:[s.pts],allPoints=[];
  ctx.beginPath();
  for(const loop of loops){loop.forEach((p,i)=>{const v=screen(p);allPoints.push(v);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.closePath()}
  if(s.solidFill&&!preview){
   ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,Number(s.hatchOpacity??1)))*Math.max(0,Math.min(1,Number(s.cadOpacity??1)));
   ctx.fillStyle=cadHatchGradient(s,allPoints)||color;ctx.fill('evenodd');ctx.restore();
  }else if(s.hatchPattern&&!preview&&allPoints.length){
   ctx.save();ctx.clip('evenodd');ctx.globalAlpha=Math.max(0,Math.min(1,Number(s.hatchOpacity??.65)));
   if(!strokeCadHatchPattern(s,allPoints)){
    const xs=allPoints.map(p=>p.x),ys=allPoints.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    const radius=Math.min(30000,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))+20);
    const spacing=Math.max(5,Math.min(100,Math.abs(Number(s.hatchSpacingWorld)||.2)*drawZoom));
    ctx.translate(cx,cy);ctx.rotate(-Number(s.hatchAngle||45)*Math.PI/180);ctx.lineWidth=.8;
    let lines=0;for(let x=-radius;x<=radius&&lines<800;x+=spacing,lines++){ctx.beginPath();ctx.moveTo(x,-radius);ctx.lineTo(x,radius);ctx.stroke()}
   }
   ctx.restore();
  }
  if(!s.importedHatch||sel||preview||s.civilTin||s.civilSlope){ctx.beginPath();for(const loop of loops){loop.forEach((point,i)=>{const v=screen(point);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.closePath()}ctx.stroke()}
 }
 else if(s.type==='dim'||s.type==='dimaligned'){const g=dimensionGeometry(s);if(g){const da=screen(g.a),db=screen(g.b),mid=screen(g.mid);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(da.x,da.y);ctx.moveTo(b.x,b.y);ctx.lineTo(db.x,db.y);ctx.moveTo(da.x,da.y);ctx.lineTo(db.x,db.y);ctx.stroke();ctx.beginPath();ctx.moveTo(da.x-4,da.y-4);ctx.lineTo(da.x+4,da.y+4);ctx.moveTo(db.x-4,db.y-4);ctx.lineTo(db.x+4,db.y+4);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle=resolveCadColor(s,canvasIsLight());ctx.fillText(g.length.toFixed(2)+' '+units,mid.x+7,mid.y-8)}}
 else if(s.type==='text'){
  const size=Math.max(.5,s.textHeightWorld?Number(s.textHeightWorld)*drawZoom:Number(s.textHeight||14));
  const fontFile=String(s.textFontFile||'txt.shx'),fontFamily=s.textFontFamily||cadFontFamilyFromFile(fontFile);
  const fontBold=Boolean(s.textFontBold)||/(?:bd|bold)/i.test(fontFile),fontItalic=Boolean(s.textFontItalic)||/(?:italic|oblique)/i.test(fontFile);
  ctx.font=(fontBold?'bold ':'')+(fontItalic?'italic ':'')+size+'px '+fontFamily;
  const value=String(s.text||'Texto'),mtext=Boolean(s.isMText)||Number(s.mtextWidthWorld||0)>0,widthFactor=Math.max(.05,Math.min(20,Number(s.textWidthFactor)||1));
  const oblique=Math.max(-80,Math.min(80,Number(s.textObliqueAngle||0)))*Math.PI/180,flags=Number(s.textGenerationFlags||0);
  const horizontal=Number(s.textHorizontalAlignment||0),vertical=Number(s.textVerticalAlignment||0);let renderWidthFactor=widthFactor;
  if(!mtext&&(horizontal===3||horizontal===5)&&Number(s.textFitWidthWorld)>0){const natural=ctx.measureText(value).width*renderWidthFactor,target=Number(s.textFitWidthWorld)*drawZoom;if(natural>0)renderWidthFactor*=target/natural}
  const anchorWorld=(!mtext&&(horizontal||vertical)&&horizontal!==3&&horizontal!==5&&s.textAlignmentPoint)?s.textAlignmentPoint:s.a;
  const anchor=screen(anchorWorld); // Convert CAD world coordinates to pixels before drawing any TEXT/MTEXT.
  ctx.translate(anchor.x,anchor.y);ctx.rotate(-Number(s.textRotation||0)*Math.PI/180);
  ctx.transform(renderWidthFactor*(flags&2?-1:1),0,Math.tan(oblique),flags&4?-1:1,0,0);
  const lineHeight=size*1.2*(Number(s.mtextLineSpacingFactor)>0?Math.max(.5,Math.min(4,Number(s.mtextLineSpacingFactor))):1);
  if(mtext){
   const requestedWidth=Number(s.mtextWidthWorld||0)*drawZoom/widthFactor;
   const lines=requestedWidth>0?wrapCadTextLines(value,requestedWidth,t=>ctx.measureText(t).width):value.split('\n');
   const boxWidth=requestedWidth>0?requestedWidth:Math.max(0,...lines.map(line=>ctx.measureText(line).width));
   const attachment=Math.max(1,Math.min(9,Math.round(Number(s.mtextAttachment||1)))),column=(attachment-1)%3,row=Math.floor((attachment-1)/3);
   ctx.textAlign=column===0?'left':column===1?'center':'right';ctx.textBaseline='top';
   const x=column===0?0:column===1?boxWidth/2:boxWidth,totalHeight=lines.length*lineHeight,y=row===0?0:row===1?-totalHeight/2:-totalHeight;
   lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));
  }else{
   ctx.textAlign=horizontal===1||horizontal===4?'center':horizontal===2?'right':'left';
   ctx.textBaseline=vertical===1?'bottom':vertical===2?'middle':vertical===3?'top':'alphabetic';
   value.split('\n').forEach((line,i)=>ctx.fillText(line,0,i*lineHeight));
  }
 }
 ctx.restore();
}
function drawGrid(w,h){
 if(!gridOn)return;let gap=zoom*gridStep;while(gap<18)gap*=2;while(gap>80)gap/=2;
 ctx.strokeStyle=canvasIsLight()?'#e1e7ee':'#263747';ctx.lineWidth=1;ctx.beginPath();
 const ox=(w/2+offset.x)%gap,oy=(h/2+offset.y)%gap;
 for(let x=ox;x<w;x+=gap){ctx.moveTo(x,0);ctx.lineTo(x,h)}
 for(let y=oy;y<h;y+=gap){ctx.moveTo(0,y);ctx.lineTo(w,y)}
 ctx.stroke();
 const o=screen({x:0,y:0});ctx.strokeStyle=canvasIsLight()?'#9aa9b8':'#46637b';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(o.x,0);ctx.lineTo(o.x,h);ctx.moveTo(0,o.y);ctx.lineTo(w,o.y);ctx.stroke();
}
function activeAnchor(){return tool==='poly'&&poly.length?poly[poly.length-1]:start}
let offsetAwaitingDistance=false;
let lineCoordinateMode='absolute',lineCoordinates={x:null,y:null};
function civilUtmInputActive(){
 return ['line','poly'].includes(tool)&&!!document.querySelector?.('[data-tab="civil"].active')&&!!window.OtroCadCivilTopo;
}
function usesLineCoordinates(){return ['line','poly'].includes(tool)&&(civilUtmInputActive()||lineCoordinateMode!=='polar')}
function resetLineCoordinates(){lineCoordinates={x:null,y:null}}
function coordinatePoint(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 if(civilUtmInputActive())return window.OtroCadCivilTopo.toModel(x,y);
 const base=lineCoordinateMode==='relative'?(activeAnchor()||{x:0,y:0}):{x:0,y:0};
 return {x:base.x+x,y:base.y+y};
}
function coordinateCorner(reference){
 if(civilUtmInputActive()){
  const xy=window.OtroCadCivilTopo.fromModel(reference);
  const east=lineCoordinates.x??xy.east,north=lineCoordinates.y??xy.north;
  return window.OtroCadCivilTopo.toModel(east,north);
 }
 const base=lineCoordinateMode==='relative'?(activeAnchor()||{x:0,y:0}):{x:0,y:0};
 const point={...reference};for(const axis of ['x','y'])if(lineCoordinates[axis]!==null&&Number.isFinite(lineCoordinates[axis]))point[axis]=base[axis]+lineCoordinates[axis];
 return point;
}
function acceptDynamicPoint(point){
 if(!point)return false;
 if(!usesLineCoordinates()){commitEntity(point);return true}
 const layer=$('#layer').value;if(lockedLayers.has(layer)){status.textContent='La capa actual está bloqueada';return false}
 if(tool==='poly'){poly.push({...point});temp=null;resetLineCoordinates();render();updatePrompt();status.textContent='Vértice por coordenadas · Enter para terminar';return true}
 if(!start){start={...point};temp={type:'line',a:{...point},b:{...point},...currentStyle(layer)};resetLineCoordinates();render();updatePrompt();status.textContent=(civilUtmInputActive()?'Primer punto UTM E/N':'Primer punto X/Y')+' fijado · indica el extremo';return true}
 commitEntity(point);return true;
}
let rectangleDimensions={width:null,height:null},rectangleDirections={x:1,y:1};
function resetRectangleDimensions(){rectangleDimensions={width:null,height:null};rectangleDirections={x:1,y:1}}
function rectangleCorner(reference){
 if(!start)return reference;
 const point={x:reference.x,y:reference.y};
 if(Math.abs(reference.x-start.x)>1e-10)rectangleDirections.x=Math.sign(reference.x-start.x);
 if(Math.abs(reference.y-start.y)>1e-10)rectangleDirections.y=Math.sign(reference.y-start.y);
 for(const [dimension,axis] of [['width','x'],['height','y']]){
  const value=rectangleDimensions[dimension];
  if(value!==null&&Number.isFinite(value))point[axis]=start[axis]+(value<0?value:value*rectangleDirections[axis]);
 }
 return point;
}
function cursorNumber(value){const raw=String(value).trim();return raw===''?NaN:Number(raw.replace(',','.'))}
function positionCursorInput(element,point){
 const width=element.offsetWidth||310,height=element.offsetHeight||54;
 const bottom=stage.clientHeight-($('#layoutBar')?.offsetHeight||38)-8;
 element.style.left=Math.max(8,Math.min(point.x+18,stage.clientWidth-width-8))+'px';
 element.style.top=Math.max(8,Math.min(point.y+18,bottom-height))+'px';
}
// Dynamic input: dimensional feedback follows the actual snapped point without
// intercepting mouse/touch events. The editable input panel remains available.
let dynamicInputOn=true;
try{dynamicInputOn=localStorage.getItem('otrocad-dynmode')!=='off'}catch(e){}
const cursorMeasureEl=document.createElement('div');
cursorMeasureEl.id='cadCursorMeasure';
cursorMeasureEl.className='cad-cursor-measure';
cursorMeasureEl.hidden=true;
cursorMeasureEl.setAttribute('aria-hidden','true');
stage.append(cursorMeasureEl);
function toggleDynamicInput(){
 dynamicInputOn=!dynamicInputOn;
 try{localStorage.setItem('otrocad-dynmode',dynamicInputOn?'on':'off')}catch(e){}
 updateDynamic();
 status.textContent='Entrada dinámica F12: '+(dynamicInputOn?'ACTIVADA':'DESACTIVADA');
}
function updateDynamic(){
 const panel=$('#dynamic'),rect=tool==='rect',offsetEntry=tool==='offset'&&offsetAwaitingDistance,cartesian=usesLineCoordinates()&&dynamicInputOn;
 panel.classList.toggle('cad-rect-input',rect);panel.classList.toggle('cad-offset-input',offsetEntry);
 panel.classList.toggle('cad-coordinate-input',cartesian);
 $('#dynCoordMode').hidden=!['line','poly'].includes(tool)||civilUtmInputActive();
 $('#dynCoordMode').value=lineCoordinateMode;
 $('#dynAngle').hidden=offsetEntry;$('#dynAngleLabel').hidden=offsetEntry;$('#acceptPoint').hidden=offsetEntry;
 $('#dynHint').hidden=!rect&&!offsetEntry&&!cartesian;
 $('#dynLen').classList.toggle('is-locked',(rect&&rectangleDimensions.width!==null)||(cartesian&&lineCoordinates.x!==null));
 $('#dynAngle').classList.toggle('is-locked',(rect&&rectangleDimensions.height!==null)||(cartesian&&lineCoordinates.y!==null));
 const anchor=activeAnchor();
 if(offsetEntry){
  panel.style.display='flex';cursorMeasureEl.hidden=true;
  $('#dynamic label').textContent='OFFSET ('+units+')';
  $('#dynLen').setAttribute('aria-label','Distancia OFFSET');
  $('#dynHint').textContent='Enter: aceptar · Esc: cancelar';
  positionCursorInput(panel,cursor);
  return;
 }
 if(cartesian&&!$('#cmd').value.trim()){
  panel.style.display='flex';cursorMeasureEl.hidden=true;
  const point=temp?.b||snapPoint(world(cursor)),civil=civilUtmInputActive(),
   base=lineCoordinateMode==='relative'&&!civil?(anchor||{x:0,y:0}):{x:0,y:0};
  const topo=civil?window.OtroCadCivilTopo.fromModel(point):null;
  $('#dynamic label').textContent=civil?'E (UTM m)':(lineCoordinateMode==='relative'?'ΔX':'X')+' ('+units+')';
  $('#dynAngleLabel').textContent=civil?'N (UTM m)':(lineCoordinateMode==='relative'?'ΔY':'Y')+' ('+units+')';
  $('#dynLen').setAttribute('aria-label',civil?'Este UTM metros':'Coordenada X');
  $('#dynAngle').setAttribute('aria-label',civil?'Norte UTM metros':'Coordenada Y');
  if(document.activeElement!==$('#dynLen')&&lineCoordinates.x===null)$('#dynLen').value=(civil?topo.east:point.x-base.x).toFixed(3);
  if(document.activeElement!==$('#dynAngle')&&lineCoordinates.y===null)$('#dynAngle').value=(civil?topo.north:point.y-base.y).toFixed(3);
  $('#dynHint').textContent=(civil?'Civil UTM · E / N en metros':anchor?'Extremo':'Primer punto')+' · Tab / ;: cambiar campo · Enter: fijar'+(anchor?' · L '+distance(anchor,point).toFixed(3)+' '+units:'');
  positionCursorInput(panel,cursor);return;
 }
 if(dynamicInputOn&&['line','poly'].includes(tool)&&lineCoordinateMode==='polar'&&!anchor&&!$('#cmd').value.trim()){panel.style.display='flex';positionCursorInput(panel,cursor);$('#dynamic label').textContent='LONGITUD ('+units+')';$('#dynAngleLabel').textContent='ÁNGULO';$('#dynLen').value='';$('#dynAngle').value='';cursorMeasureEl.hidden=true;return}
 if(!dynamicInputOn||!anchor||!temp||(rect&&$('#cmd').value.trim())){panel.style.display='none';cursorMeasureEl.hidden=true;return}
 panel.style.display='flex';
 $('#dynamic label').textContent=(rect?'ANCHO':'LONGITUD')+' ('+units+')';
 $('#dynAngleLabel').textContent=rect?'ALTO ('+units+')':'ÁNGULO';
 $('#dynLen').setAttribute('aria-label',rect?'Ancho del rectángulo':'Longitud');
 $('#dynAngle').setAttribute('aria-label',rect?'Alto del rectángulo':'Ángulo');
 if(rect){
  if(document.activeElement!==$('#dynLen')&&rectangleDimensions.width===null)$('#dynLen').value=Math.abs(temp.b.x-anchor.x).toFixed(3);
  if(document.activeElement!==$('#dynAngle')&&rectangleDimensions.height===null)$('#dynAngle').value=Math.abs(temp.b.y-anchor.y).toFixed(3);
  $('#dynHint').textContent='Tab / ; / ,: cambiar medida · Enter: crear';
  cursorMeasureEl.hidden=true;
  positionCursorInput(panel,cursor);
  return;
 }
 panel.style.left='';panel.style.top='';
 const len=distance(anchor,temp.b),ang=normalize(angle(anchor,temp.b));
 if(document.activeElement!==$('#dynLen'))$('#dynLen').value=len.toFixed(3);
 if(document.activeElement!==$('#dynAngle'))$('#dynAngle').value=ang.toFixed(1);
 cursorMeasureEl.textContent=(tool==='circle'?'R ':'↔ ')+len.toFixed(3)+' '+units+(tool==='circle'?'':'  ·  '+ang.toFixed(1)+'°');
 cursorMeasureEl.hidden=false;
 const p=screen(temp.b),sw=Math.max(0,stage.clientWidth),sh=Math.max(0,stage.clientHeight);
 const bw=cursorMeasureEl.offsetWidth||148,bh=cursorMeasureEl.offsetHeight||26;
 const x=Math.min(Math.max(8,p.x+18),Math.max(8,sw-bw-8));
 const y=p.y+bh+22>sh?Math.max(8,p.y-bh-18):Math.max(8,p.y+18);
 cursorMeasureEl.style.left=x+'px';cursorMeasureEl.style.top=y+'px';
}
function updateRectangleInput(axis,value){
 if(usesLineCoordinates()){
  lineCoordinates[axis==='width'?'x':'y']=cursorNumber(value);
  if(temp)temp.b=coordinateCorner(temp.b);render();return;
 }
 if(tool!=='rect'||!start)return;
 rectangleDimensions[axis]=cursorNumber(value);
 if(temp)temp.b=rectangleCorner(temp.b);
 render();
}
function acceptOffsetDistance(value){
 const distance=cursorNumber(value);
 if(!(distance>0)||!Number.isFinite(distance)){status.textContent='OFFSET: ingresa una distancia positiva';return false}
 offsetDistance=distance;offsetDistancePreset=true;offsetAwaitingDistance=false;updatePrompt();
 stage.focus({preventScroll:true});render();updateCursorCommand();
 status.textContent='OFFSET '+distance+' '+units+' · selecciona el objeto';return true;
}
function handleCursorDimensionKey(event,active){
 if(event.ctrlKey||event.metaKey||event.altKey)return false;
 const rect=tool==='rect'&&start&&dynamicInputOn;
 const offset=tool==='offset'&&offsetAwaitingDistance;
 const coordinates=usesLineCoordinates()&&dynamicInputOn;
 if(!rect&&!offset&&!coordinates)return false;
 const input=active===$('#dynLen')||active===$('#dynAngle');
 if(['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)&&!input)return false;
 if($('#cmd').value.trim())return false;
 if(event.key==='Escape'){event.preventDefault();cancelCurrentAction();stage.focus({preventScroll:true});return true}
 if(event.key==='F12'&&(rect||coordinates)){event.preventDefault();stage.focus({preventScroll:true});toggleDynamicInput();return true}
 if(event.key==='Enter'){
  if(coordinates&&!input&&lineCoordinates.x===null&&lineCoordinates.y===null)return false;
  event.preventDefault();
  if(offset)acceptOffsetDistance($('#dynLen').value);
  else{const point=pointFromInputs();if(point){acceptDynamicPoint(point);stage.focus({preventScroll:true})}else status.textContent=coordinates?(civilUtmInputActive()?'Ingresa Este y Norte UTM válidos':'Ingresa X e Y válidos'):'Rectángulo: ancho y alto deben ser distintos de cero'}
  return true;
 }
 if(event.key==='Tab'||((rect||coordinates)&&[';',','].includes(event.key))){
  event.preventDefault();
  if(coordinates&&input)lineCoordinates[active===$('#dynLen')?'x':'y']=cursorNumber(active.value);
  const next=(rect||coordinates)&&active===$('#dynLen')?$('#dynAngle'):$('#dynLen');
  next.focus({preventScroll:true});next.select();return true;
 }
 if(!input&&/^[0-9.+-]$/.test(event.key)){
  event.preventDefault();const field=$('#dynLen');field.focus({preventScroll:true});field.value=event.key;
  if(rect||coordinates)updateRectangleInput('width',field.value);
  return true;
 }
 return false;
}
function showDraftSettings(){
 const dlg=document.createElement('dialog');
 dlg.style.cssText='border:1px solid #536a80;border-radius:10px;background:#172333;color:#e8eef6;max-width:92vw;max-height:90dvh;overflow:auto;width:430px;padding:18px;box-shadow:0 16px 50px #0009';
 dlg.innerHTML=`<form method="dialog" style="display:grid;gap:12px;font:14px system-ui">
 <h3 style="margin:0;color:#62b8e8">Drafting Settings · Configuración de dibujo</h3><p style="margin:0;color:#bdcee2;font-size:12px">OSNAP + Punto final conecta líneas exactamente. ORTHO restringe direcciones.</p>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
 <label><input id="setGrid" type="checkbox" ${gridOn?'checked':''}> Rejilla F7</label>
 <label><input id="setSnap" type="checkbox" ${snapOn?'checked':''}> Snap F9</label>
 <label><input id="setOrtho" type="checkbox" ${orthoOn?'checked':''}> ORTHO F8</label>
 <label><input id="setPolar" type="checkbox" ${polarOn?'checked':''}> POLAR F10</label>
 <label><input id="setOsnap" type="checkbox" ${osnapOn?'checked':''}> Referencias F3</label>
 <label><input id="setCross" type="checkbox" ${crossOn?'checked':''}> Cruceta</label>
 </div>
 <fieldset style="border:1px solid #536a80;border-radius:6px;display:grid;gap:8px"><legend>Cruceta CAD</legend><label>Tamaño de cruceta (% de pantalla) <input id="setCrossSize" type="number" min="1" max="100" value="${crossPrefs.size}" style="width:100%;padding:7px"></label><label>Tamaño del cuadro central (px) <input id="setCrossBox" type="number" min="4" max="30" value="${crossPrefs.pickbox}" style="width:100%;padding:7px"></label><label>Color <select id="setCrossMode"><option value="auto">Automático según fondo</option><option value="custom">Personalizado</option></select> <input id="setCrossColor" type="color" value="${crossPrefs.color}"></label><small>100 % extiende la cruceta por toda la pantalla.</small></fieldset>
 <fieldset style="border:1px solid #536a80;border-radius:6px;display:grid;gap:7px"><legend>Referencias a objetos · OSNAP</legend><label><input id="setOsEnd" type="checkbox" ${osEnd?'checked':''}> Punto final (Endpoint)</label><label><input id="setOsMid" type="checkbox" ${osMid?'checked':''}> Punto medio (Midpoint)</label><label><input id="setOsCenter" type="checkbox" ${osCenter?'checked':''}> Centro (Center)</label><label><input id="setOsQuadrant" type="checkbox" ${osQuadrant?'checked':''}> Cuadrante (Quadrant)</label><label><input id="setOsIntersection" type="checkbox" ${osIntersection?'checked':''}> Intersección de segmentos</label><label><input id="setOsNearest" type="checkbox" ${osNearest?'checked':''}> Punto más cercano (Nearest)</label><label><input id="setOsParallel" type="checkbox" ${osParallel?'checked':''}> Paralelo (Parallel)</label><label><input id="setGeom" type="checkbox" ${osGeom?'checked':''}> Centro geométrico</label><label><input id="setInsertion" type="checkbox" ${osInsertion?'checked':''}> Inserción de texto</label><label><input id="setTangent" type="checkbox" ${osTangent?'checked':''}> Tangente (círculo)</label><label><input id="setExtension" type="checkbox" ${osExtension?'checked':''}> Extensión (líneas)</label><label><input id="setApparent" type="checkbox" ${osApparent?'checked':''}> Intersección aparente (2D)</label><label><input id="setOsPerpendicular" type="checkbox" ${osPerpendicular?'checked':''}> Perpendicular</label></fieldset>
 <fieldset style="border:1px solid #536a80;border-radius:6px;display:grid;gap:9px"><legend>Mouse · Botón derecho</legend><label>Cuando no hay un comando activo<select id="setRightClickMode" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="context">Mostrar menú contextual</option><option value="repeat">Repetir última acción</option></select></label><label>Durante un comando<select id="setRightClickActive" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="enter">Funcionar como Enter</option><option value="context">Mostrar menú contextual</option></select></label><small style="color:#aebed2">Si eliges repetir, Shift + clic derecho abre el menú contextual.</small></fieldset>
 <label>Unidades de dibujo <select id="setUnits" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option><option value="mm">Milímetros (mm)</option></select></label>
 <label>Espaciado de rejilla <input id="setGridStep" type="number" min="0.001" step="0.1" value="${gridStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Incremento polar (grados) <input id="setPolarStep" type="number" min="1" max="90" step="1" value="${polarStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Radio de referencias (px) <input id="setSnapRadius" type="number" min="2" max="40" step="1" value="${snapRadius}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <div style="display:flex;justify-content:flex-end;gap:8px"><button id="cancelSettings" type="button">Cancelar</button><button id="applySettings" type="button" style="background:#f3c83e;color:#101b2e;font-weight:800">Aplicar</button></div>
 </form>`;
 document.body.append(dlg);dlg.querySelector('#setCrossMode').value=crossPrefs.mode;dlg.querySelector('#setUnits').value=units;dlg.querySelector('#setRightClickMode').value=rightClickMode;dlg.querySelector('#setRightClickActive').value=rightClickDuringCommand;
 dlg.querySelector('#cancelSettings').onclick=()=>dlg.close();
 dlg.querySelector('#applySettings').onclick=()=>{
  gridOn=dlg.querySelector('#setGrid').checked;snapOn=dlg.querySelector('#setSnap').checked;orthoOn=dlg.querySelector('#setOrtho').checked;polarOn=dlg.querySelector('#setPolar').checked;osnapOn=dlg.querySelector('#setOsnap').checked;osEnd=dlg.querySelector('#setOsEnd').checked;osMid=dlg.querySelector('#setOsMid').checked;osCenter=dlg.querySelector('#setOsCenter').checked;osQuadrant=dlg.querySelector('#setOsQuadrant').checked;osIntersection=dlg.querySelector('#setOsIntersection').checked;osNearest=dlg.querySelector('#setOsNearest').checked;osParallel=dlg.querySelector('#setOsParallel').checked;osGeom=dlg.querySelector('#setGeom').checked;osInsertion=dlg.querySelector('#setInsertion').checked;osTangent=dlg.querySelector('#setTangent').checked;osExtension=dlg.querySelector('#setExtension').checked;osApparent=dlg.querySelector('#setApparent').checked;osPerpendicular=dlg.querySelector('#setOsPerpendicular').checked;crossOn=dlg.querySelector('#setCross').checked;
  crossPrefs={size:Math.max(1,Math.min(100,Number(dlg.querySelector('#setCrossSize').value)||12)),pickbox:Math.max(4,Math.min(30,Number(dlg.querySelector('#setCrossBox').value)||10)),mode:dlg.querySelector('#setCrossMode').value,color:dlg.querySelector('#setCrossColor').value};try{localStorage.setItem('otrocad-crosshair',JSON.stringify(crossPrefs))}catch(e){}
  units=dlg.querySelector('#setUnits').value;gridStep=Math.max(.001,Number(dlg.querySelector('#setGridStep').value)||1);polarStep=Math.max(1,Math.min(90,Number(dlg.querySelector('#setPolarStep').value)||15));snapRadius=Math.max(2,Math.min(40,Number(dlg.querySelector('#setSnapRadius').value)||12));
  for(const [id,on] of [['gridToggle',gridOn],['snapToggle',snapOn],['orthoToggle',orthoOn],['polarToggle',polarOn],['osnapToggle',osnapOn],['crossToggle',crossOn]])updateToggle('#'+id,on);rightClickMode=dlg.querySelector('#setRightClickMode').value;rightClickDuringCommand=dlg.querySelector('#setRightClickActive').value;try{localStorage.setItem('otrocad-mouse-preferences',JSON.stringify({mode:rightClickMode,active:rightClickDuringCommand}))}catch(e){}saveDraftPreferences();save();dlg.close();status.textContent='Drafting Settings aplicado · botón derecho configurado';render();
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
function updatePrompt(){if(tool==='hatch'){promptEl.textContent='HATCH · haz clic dentro de un recinto cerrado · Esc para terminar';return}if(tool==='scale'&&activeLayout==='Model'){promptEl.textContent='ESCALAR · '+(moveBase?'mueve el cursor o escribe factor y Enter':(modifyTargets.length||selectedItems().length?'indica punto base':'selecciona objeto(s)'));return}if(['move','copy'].includes(tool)&&activeLayout==='Model'){promptEl.textContent=(tool==='move'?'MOVER':'COPIAR')+' · '+(moveBase?'indica punto destino':(modifyTargets.length||selectedItems().length?'indica punto base':'selecciona el objeto por el punto base'));return}if(activeLayout!=='Model'){promptEl.textContent='PRESENTACIÓN · hoja de impresión · vuelve a Modelo para editar';return}if(tool==='rect'&&start){promptEl.textContent='Esquina opuesta · ancho · Tab / ; · alto · Enter';return}if(usesLineCoordinates()){promptEl.textContent=(activeAnchor()?'Extremo':'Primer punto')+' · X/Y junto al cursor · Tab / ;: cambiar campo · Enter: fijar';return}if(tool==='offset'){promptEl.textContent=offsetAwaitingDistance?'OFFSET · distancia · Enter':'OFFSET · objeto · lado · Esc para terminar';return}promptEl.textContent=tool==='matchprop'?(matchState.source?'MA · DESTINO · Esc: finalizar':'MA · ORIGEN · selecciona el objeto que presta su estilo'):tool==='select'?'SELECCIÓN · dos clics o arrastra · izquierda→derecha: VENTANA · derecha→izquierda: CRUCE':((start||poly.length)?'Siguiente punto · longitud y ángulo editables':('Comando: '+tool.toUpperCase()))}

function isVisibleModelEntity(s){
 return (s.cadLayout||'Model')==='Model'&&!hiddenLayers.has(s.layer)&&!(hideModelAnnotations&&s.type==='text');
}
function defaultCadLayout(){
 return {name:'Presentación 1',paperWidth:420,paperHeight:297,margin:10,source:'new',
  viewportFit:'all',plotScale:'fit',plotStyle:'color',sheetTemplate:true,
  projectName:'PROYECTO',sheetTitle:'PLANO GENERAL',sheetNumber:'01',revision:'00'};
}
function ensureCadLayout(){
 const found=paperLayoutsSafe();if(found.length)return found[0];
 const sheet=defaultCadLayout();layouts=[sheet];return sheet;
}
function paperLayoutsSafe(){
 return Array.isArray(layouts)?layouts.filter(x=>x&&typeof x.name==='string'&&x.name&&x.name!=='Model'):[];
}
function saveLayoutState(){
 try{localStorage.setItem('otrocad-layout-state',JSON.stringify({layouts:paperLayoutsSafe(),viewports:layoutViewportRecords,activeLayout,hideModelAnnotations}))}catch(e){console.warn('No se pudieron guardar los layouts:',e)}
}
function refreshLayoutTabs(){
 const tabs=$('#layoutTabs');if(!tabs)return;tabs.textContent='';
 const add=(name,label)=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;button.className='cad-layout-tab'+(activeLayout===name?' active':'');button.setAttribute('aria-current',activeLayout===name?'page':'false');
  button.onclick=()=>switchCadLayout(name);tabs.append(button)
 };
 add('Model','▦ Modelo');
 paperLayoutsSafe().forEach(x=>add(x.name,'▤ '+x.name));
 const settings=$('#paperSetup');if(settings){settings.hidden=activeLayout==='Model';settings.title='Configurar página de '+activeLayout+' para CAD y Civil 3D'}
 const vButton=$('#paperViewports');if(vButton)vButton.hidden=activeLayout==='Model';
 const annotations=$('#toggleAnnotations');if(annotations){annotations.hidden=activeLayout!=='Model';annotations.textContent=hideModelAnnotations?'Textos: ocultos':'Textos: visibles';annotations.setAttribute('aria-pressed',String(hideModelAnnotations))}
 document.body.classList.toggle('cad-paper-active',activeLayout!=='Model');
}
function switchCadLayout(name){
 if(name!=='Model'&&!paperLayoutsSafe().some(x=>x.name===name))return false;
 if(activeLayout==='Model'&&name!=='Model'&&Number(zoom)>0){lastModelCamera={center:{x:-offset.x/zoom,y:offset.y/zoom},viewHeight:canvas.clientHeight/zoom};}
 activeLayout=name;clearSelection();tool='select';start=null;temp=null;poly=[];arcPoints=[];modifyTarget=-1;modifyTargets=[];drag=null;selectionStart=null;selectionBox=null;selectionClickAnchor=null;gripDrag=null;activeSnap=null;
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool==='select'));
 if($('#properties'))$('#properties').classList.remove('open');
 refreshLayoutTabs();saveLayoutState();updatePrompt();render();
 status.textContent=name==='Model'?'Modelo · geometría a escala real':'Presentación '+name+' · hoja de impresión; para editar la geometría regresa a Modelo';
 return true;
}
function createCadLayout(){
 // One shared CAD/Civil presentation by default; never discard existing DWG layouts.
 const layout=ensureCadLayout();switchCadLayout(layout.name);
}
function modelExtentsForPaper(){
 const modelObjects=objects.filter(o=>(o.cadLayout||'Model')==='Model'),geometry=modelObjects.filter(o=>o.type!=='text');const p=(geometry.length?geometry:modelObjects).flatMap(boundsPoints);
 if(!p.length)return {center:{x:0,y:0},width:10,height:10};
 const xs=p.map(v=>v.x),ys=p.map(v=>v.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 return{center:{x:(minx+maxx)/2,y:(miny+maxy)/2},width:Math.max(maxx-minx,.001),height:Math.max(maxy-miny,.001)};
}
function cadLayoutScaleHint(layout){
 const sheetText=objects.filter(o=>o.cadLayout===layout.name&&o.type==='text').map(o=>String(o.text||''));
 for(const text of sheetText){
  const match=text.match(/\b(?:ESCALA|ESC\.?|SCALE)\s*(?:DE\s*)?1\s*[:\/]\s*(\d+(?:[.,]\d+)?)/i);
  if(match){const scale=Number(match[1].replace(',','.'));if(scale>=1&&scale<=10000)return {ratio:scale,source:'escala escrita en la lámina'}}
 }
 return null;
}
function cadPaperMissingViewportArea(layout){
 const pw=Math.max(30,Number(layout.paperWidth)||420),ph=Math.max(30,Number(layout.paperHeight)||297);
 const margin=Math.max(8,Math.min(22,Number(layout.margin)||10));
 // Most architectural sheets reserve the right-hand column for notes and schedules.
 // Use existing paper text coordinates to locate that area; never move those annotations.
 const rightTexts=objects.filter(o=>o.cadLayout===layout.name&&o.type==='text'&&o.a&&Number.isFinite(o.a.x)&&
    o.a.x>pw*.58&&o.a.x<pw*.96&&o.a.y>ph*.12&&o.a.y<ph*.89)
  .map(o=>o.a.x).sort((a,b)=>a-b);
 const divider=rightTexts.length?Math.max(pw*.53,Math.min(pw*.78,rightTexts[0]-margin)):pw*.69;
 const left=Math.max(margin,pw*.035),right=Math.max(left+pw*.25,divider-margin*.4);
 const bottom=Math.max(margin,ph*.135),top=Math.max(bottom+ph*.38,ph*.865);
 return {center:{x:(left+right)/2,y:(bottom+top)/2},width:right-left,height:top-bottom,estimated:true};
}
function cadPaperViewportUsable(v,layout){
 if(!(Number(v.width)>1e-8&&Number(v.height)>1e-8))return false;
 const pw=Math.max(30,Number(layout.paperWidth)||420),ph=Math.max(30,Number(layout.paperHeight)||297);
 const x=Number(v.center?.x),y=Number(v.center?.y);
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 // Reject degenerate/off-sheet viewports from damaged conversion metadata.
 const minx=x-Number(v.width)/2,maxx=x+Number(v.width)/2,miny=y-Number(v.height)/2,maxy=y+Number(v.height)/2;
 const intersectW=Math.max(0,Math.min(maxx,pw)-Math.max(minx,0));
 const intersectH=Math.max(0,Math.min(maxy,ph)-Math.max(miny,0));
 return intersectW>Math.min(Number(v.width)*.15,pw*.07)&&intersectH>Math.min(Number(v.height)*.15,ph*.07);
}
function modelPaperViewportEstimate(vp,layout){
 const ext=modelExtentsForPaper(),height=Number(vp.height||0),width=Number(vp.width||0);
 if(!(height>0&&width>0))return null;
 const unitMm=units==='mm'?1:units==='cm'?10:1000;
 const annotated=cadLayoutScaleHint(layout),explicit=Number(layout.plotScale)>0?Number(layout.plotScale):null;
 const ratio=explicit||annotated?.ratio||null;
 const viewHeight=ratio?height*ratio/unitMm:Math.max(ext.height*1.1,ext.width*height/width*1.1,.01);
 const reportedCenter=vp.viewCenter||{x:0,y:0};
 const hasCenter=Boolean(vp.viewCenterKnown)&&Number.isFinite(reportedCenter.x)&&Number.isFinite(reportedCenter.y);
 return {...vp,viewCenter:hasCenter?reportedCenter:ext.center,viewHeight,estimated:true,
  estimateSource:ratio?(explicit?'escala elegida por usuario':annotated.source):'encuadre de geometría del Modelo',
  centerEstimated:!hasCenter,heightEstimated:true,originalViewHeight:vp.viewHeight};
}
function cadStandardSheetArea(layout){
 const pw=Math.max(30,Number(layout.paperWidth)||420),ph=Math.max(30,Number(layout.paperHeight)||297);
 const margin=Math.max(0,Number(layout.margin)||0);
 const band=layout.sheetTemplate?Math.max(28,Math.min(38,ph*.12)):0;
 const width=Math.max(5,pw-2*margin),height=Math.max(5,ph-2*margin-band);
 return {center:{x:pw/2,y:margin+band+height/2},width,height};
}
function manualCadPaperView(layout){
 const c=layout.manualView;
 if(!c||!Number.isFinite(Number(c.viewHeight))||Number(c.viewHeight)<=0||!Number.isFinite(Number(c.center?.x))||!Number.isFinite(Number(c.center?.y)))return null;
 const area=layout.sheetTemplate?cadStandardSheetArea(layout):cadPaperMissingViewportArea(layout);
 return {...area,layout:layout.name,id:2,status:1,viewCenter:{x:Number(c.center.x),y:Number(c.center.y)},viewHeight:Number(c.viewHeight),
  generated:true,manual:true,paperRegionEstimated:true,estimated:false};
}
function effectivePaperViewports(layout){
 if(layout.viewportFit==='custom'&&Array.isArray(layout.customViewports)&&layout.customViewports.length)
  return layout.customViewports.filter(v=>v&&Number(v.width)>0&&Number(v.height)>0&&Number(v.viewHeight)>0);
 if(layout.viewportFit==='manual'){const manual=manualCadPaperView(layout);if(manual)return [manual]}
 const imported=layout.viewportFit!=='all'?layoutViewportRecords.filter(v=>v.layout===layout.name&&v.id!==1):[];
 const ext=modelExtentsForPaper(),fallbackArea=cadPaperMissingViewportArea(layout);
 if(imported.length){
  const active=imported.filter(v=>v.status!==0);
  const candidates=active.length?active:imported; // All recovered VIEWPORTs might be marked inactive by a converter.
  return candidates.slice(0,20).map(v=>{
   const validPaperArea=cadPaperViewportUsable(v,layout);
   const recoveryArea=validPaperArea?null:fallbackArea;
   const paperView=recoveryArea?{...v,center:recoveryArea.center,width:recoveryArea.width,height:recoveryArea.height}:v;
   let result;
   if(!Number.isFinite(Number(paperView.viewHeight))||Number(paperView.viewHeight)<=1e-8){
    result=modelPaperViewportEstimate(paperView,layout);
   }else{
    const center=paperView.viewCenter||{},validCenter=Number.isFinite(Number(center.x))&&Number.isFinite(Number(center.y));
    result=paperView.viewCenterKnown===false||!validCenter
     ?{...paperView,viewCenter:ext.center,estimated:true,centerEstimated:true,heightEstimated:false,estimateSource:'centro geométrico provisional (altura original conservada)'}
     :paperView;
   }
   if(!result)return null;
   if(recoveryArea)result={...result,estimated:true,paperRegionEstimated:true,
     estimateSource:result.estimateSource||'región libre de anotaciones de la hoja'};
   if(v.status===0)result={...result,estimated:true,offViewportRecovered:true};
   return result;
  }).filter(Boolean);
 }
 if(layout.source!=='new'&&layout.viewportFit!=='all'){
  // A converted AutoCAD sheet can retain its border and title block but lose all
  // VIEWPORT objects. Show a clearly labeled, non-destructive *screen-only* recovery
  // when there is usable model geometry, rather than silently leaving the sheet blank.
  if(!objects.some(o=>(o.cadLayout||'Model')==='Model'))return [];
  const implied={layout:layout.name,id:2,status:1,...fallbackArea,viewCenterKnown:false,viewHeight:0};
  const provisional=modelPaperViewportEstimate(implied,layout);
  return provisional?[{...provisional,generated:true,estimated:true,paperRegionEstimated:true,viewportMissing:true}]:[];
 }
 const {center,width,height}=cadStandardSheetArea(layout);
 const unitMm=units==='mm'?1:units==='cm'?10:1000,scaleRatio=Number(layout.plotScale);
 const modelHeight=scaleRatio>0?Math.max(1e-6,height*scaleRatio/unitMm):Math.max(ext.height*1.10,ext.width*height/Math.max(width,1)*1.10,1e-6);
 return[{layout:layout.name,center,width,height,viewCenter:ext.center,viewHeight:modelHeight,id:2,status:1,generated:true}];
}
function describePaperLayoutState(layout,viewports){
 const paperCount=objects.filter(x=>x.cadLayout===layout.name).length;
 const importedCount=layoutViewportRecords.filter(x=>x.layout===layout.name&&x.id!==1).length;
 const lines=[];
 if(layout.source!=='new'&&!viewports.length&&layout.viewportFit!=='all')
  lines.push(importedCount?'La ventana gráfica no incluye datos suficientes para dibujar el Modelo.':'El archivo no proporcionó un VIEWPORT utilizable para esta hoja. Revisa ⚙ Hoja o el informe de importación.');
 const estimated=viewports.filter(v=>v.estimated);
 if(estimated.length){
  const withHeight=estimated.filter(v=>v.heightEstimated);
  if(withHeight.length)lines.push('VISTA PROVISIONAL: faltaba la altura del VIEWPORT; se utilizó '+withHeight[0].estimateSource+'. La escala original no está verificada.');
  if(estimated.some(v=>v.centerEstimated))lines.push('CENTRO PROVISIONAL: el conversor no preservó la ubicación de la vista; se usó el centro geométrico del Modelo sin modificar la geometría.');
 }
 if(viewports.some(v=>v.manual))lines.push('VISTA CONFIGURADA POR USUARIO: se utilizó el encuadre tomado del Modelo. Esta configuración es independiente del VIEWPORT original.');
 const recoveredArea=viewports.filter(v=>v.paperRegionEstimated&&!v.manual);
 if(recoveredArea.length)lines.push('VENTANA RECUPERADA: el DWG convertido no conservó la posición o tamaño de la ventana gráfica. Se colocó una vista provisional en el área libre de la lámina, sin cambiar el original.');
 if(viewports.some(v=>v.viewportMissing))lines.push('La conversión no entregó ninguna ventana gráfica; esta vista no representa un VIEWPORT original.');
 if(viewports.some(v=>v.offViewportRecovered))lines.push('Un VIEWPORT figura desactivado en los datos importados. Se muestra provisionalmente para revisión.');
 if(layout.source!=='new'&&paperCount===0)
  lines.push('No se recuperaron entidades propias del espacio Papel para esta presentación.');
 if(layout.source!=='new'&&viewports.length&&!objects.some(x=>(x.cadLayout||'Model')==='Model'))
  lines.push('No se recuperó la geometría de Modelo necesaria para las ventanas gráficas.');
 return {paperCount,importedCount,message:lines.join(' ')};
}
function showPaperLayoutNotice(layout,viewports){
 let notice=document.getElementById('cadLayoutNotice');
 if(!notice){notice=document.createElement('div');notice.id='cadLayoutNotice';notice.setAttribute('role','status');$('#stage').append(notice)}
 const info=describePaperLayoutState(layout,viewports);
 notice.hidden=!info.message;
 if(info.message){
  notice.textContent=layout.name+': '+info.message+' · Papel: '+info.paperCount+' entidades; VIEWPORT: '+info.importedCount;
 }
}
function drawUnifiedSheetTemplate(layout,paperPoint,scale){
 // Page-only graphic: it never moves or replaces CAD/Civil entities.
 const w=Number(layout.paperWidth)||420,h=Number(layout.paperHeight)||297;
 const m=Math.max(5,Math.min(12,Number(layout.margin)||10));
 const band=Math.max(28,Math.min(38,h*.12)),usableW=Math.max(75,w-2*m);
 const blockW=Math.min(185,usableW),x=w-m-blockW,y=m,top=y+band;
 const rect=(px,py,rw,rh)=>{
  const p=paperPoint({x:px,y:py+rh});ctx.strokeRect(p.x,p.y,rw*scale,rh*scale);
 };
 const line=(x1,y1,x2,y2)=>{
  const a=paperPoint({x:x1,y:y1}),b=paperPoint({x:x2,y:y2});
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 };
 const label=(value,px,py,size=3.1,bold=false)=>{
  const p=paperPoint({x:px,y:py});
  ctx.font=(bold?'700 ':'400 ')+Math.max(7,size*scale)+'px Arial,sans-serif';
  ctx.fillText(String(value||'').slice(0,65),p.x,p.y);
 };
 ctx.save();ctx.strokeStyle='#1e293b';ctx.fillStyle='#15243a';
 ctx.lineWidth=Math.max(.6,.26*scale);ctx.setLineDash([]);
 rect(m,m,w-2*m,h-2*m);rect(x,y,blockW,band);
 const split1=x+blockW*.60,split2=x+blockW*.84;
 line(x,top-band*.48,x+blockW,top-band*.48);
 line(split1,y,split1,top);line(split2,y,split2,top);
 label('PROYECTO / PROJECT',x+3,top-4,2.5);
 label(layout.projectName||'PROYECTO',x+3,top-10,3.5,true);
 label(layout.sheetTitle||'PLANO GENERAL',x+3,y+7,3.6,true);
 label('PLANO',split1+2,top-4,2.5);
 label(layout.sheetNumber||'01',split1+3,y+7,4.2,true);
 label('REV.',split2+2,top-4,2.5);
 label(layout.revision||'00',split2+3,y+7,4.2,true);
 label('OTROCAD · CAD / CIVIL 3D',m+3,m+4,2.4);
 const currentViews=effectivePaperViewports(layout);
 const single=currentViews.length===1?currentViews[0]:null;
 const mmPerUnit=units==='mm'?1:units==='cm'?10:1000;
 const exactRatio=single?Number(single.viewHeight)*mmPerUnit/Math.max(1e-9,Number(single.height)):NaN;
 const scaleName=currentViews.length>1?'VARIAS':Number.isFinite(exactRatio)&&exactRatio>0
  ?'1:'+Number(exactRatio.toFixed(2)):Number(layout.plotScale)>0?'1:'+Number(layout.plotScale):'AJUSTAR';
 label('ESCALA '+scaleName,x+3,y+3,2.5);
 ctx.restore();
}
function renderPaperLayout(){
 const layout=paperLayoutsSafe().find(x=>x.name===activeLayout);if(!layout){activeLayout='Model';render();return}
 const w=canvas.clientWidth,h=canvas.clientHeight;
 const pw=Math.max(30,Number(layout.paperWidth)||420),ph=Math.max(30,Number(layout.paperHeight)||297);
 const pad=printing?0:Math.max(22,Math.min(50,w*.06));
 const scale=Math.max(.00001,Math.min((w-pad*2)/pw,(h-pad*2)/ph)),paperW=pw*scale,paperH=ph*scale,x0=(w-paperW)/2,y0=(h-paperH)/2;
 const paperPoint=p=>({x:x0+Number(p.x)*scale,y:y0+(ph-Number(p.y))*scale});
 ctx.clearRect(0,0,w,h);ctx.fillStyle=printing?'#ffffff':'#dfe6f1';ctx.fillRect(0,0,w,h);
 ctx.save();if(!printing){ctx.shadowColor='#24354c55';ctx.shadowBlur=18;ctx.shadowOffsetY=5}
 ctx.fillStyle='#fff';ctx.fillRect(x0,y0,paperW,paperH);ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(x0,y0,paperW,paperH);ctx.clip();
 const vps=effectivePaperViewports(layout);
 activePaperPlotStyle=['color','monochrome','grayscale'].includes(layout.plotStyle)?layout.plotStyle:'color';
 showPaperLayoutNotice(layout,vps);
 for(const vp of vps){
  const center=paperPoint(vp.center),vw=Number(vp.width)*scale,vh=Number(vp.height)*scale;
  if(!Number.isFinite(vw)||!Number.isFinite(vh)||vw<=0||vh<=0)continue;
  ctx.save();ctx.beginPath();ctx.rect(center.x-vw/2,center.y-vh/2,vw,vh);ctx.clip();
  const drawingScale=vh/Math.max(1e-9,Number(vp.viewHeight)||1),viewCenter=vp.viewCenter||{x:0,y:0};
  layoutRenderTransform={tx:center.x-Number(viewCenter.x||0)*drawingScale,ty:center.y+Number(viewCenter.y||0)*drawingScale,scale:drawingScale};
  if(Number(vp.twist)){ctx.translate(center.x,center.y);ctx.rotate(-Number(vp.twist)*Math.PI/180);ctx.translate(-center.x,-center.y)}
  for(const o of objects)if((o.cadLayout||'Model')==='Model'&&o.importedHatch&&!hiddenLayers.has(o.layer))drawEntity(o);
  for(const o of objects)if((o.cadLayout||'Model')==='Model'&&!o.importedHatch&&!hiddenLayers.has(o.layer)&&!(layout.hideModelText&&o.type==='text'))drawEntity(o);
  layoutRenderTransform=null;ctx.restore();
  if(!printing){ctx.save();ctx.strokeStyle='#3b8be1';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.strokeRect(center.x-vw/2,center.y-vh/2,vw,vh);ctx.restore()}
 }
 layoutRenderTransform={tx:x0,ty:y0+paperH,scale};
 for(const o of objects)if(o.cadLayout===activeLayout&&o.importedHatch&&!hiddenLayers.has(o.layer))drawEntity(o);
 for(const o of objects)if(o.cadLayout===activeLayout&&!o.importedHatch&&!hiddenLayers.has(o.layer))drawEntity(o);
 layoutRenderTransform=null;ctx.restore();
 activePaperPlotStyle=null;
 if(layout.sheetTemplate)drawUnifiedSheetTemplate(layout,paperPoint,scale);
 if(!printing){
  ctx.save();const margin=Math.max(0,Math.min(Number(layout.margin)||0,Math.min(pw,ph)/4))*scale;
  ctx.strokeStyle='#9eacbe';ctx.setLineDash([4,4]);ctx.strokeRect(x0+margin,y0+margin,Math.max(0,paperW-2*margin),Math.max(0,paperH-2*margin));ctx.setLineDash([]);
  ctx.fillStyle='#193f77';ctx.font='bold 12px system-ui';ctx.fillText(layout.name+' · '+Math.round(pw)+' × '+Math.round(ph)+' mm',x0+5,Math.max(14,y0-8));ctx.restore();
 }
 $('#dynamic').style.display='none';
}
function showCadViewportManager(){
 const layout=paperLayoutsSafe().find(l=>l.name===activeLayout);
 if(!layout)return;
 const base=effectivePaperViewports(layout);
 const rows=clone(base.length?base:[{layout:layout.name,id:2,status:1,center:{x:210,y:148},width:380,height:250,viewCenter:{x:0,y:0},viewHeight:10}]);
 const dlg=document.createElement('dialog');dlg.className='cad-utility-dialog cad-paper-settings cad-viewport-manager';
 dlg.innerHTML='<form method="dialog"><h3>Ventanas gráficas · CAD y Civil 3D</h3>'+
 '<p>Configura las vistas del mismo Modelo dentro de la hoja. No cambia la geometría original ni los VIEWPORT importados.</p>'+
 '<label>Ventana<select id="vpPick"></select></label>'+
 '<div class="cad-viewports-grid">'+
 '<label>Escala 1 : <input id="vpRatio" type="number" min="1" max="1000000" step="any"></label>'+
 '<label>Centro X (Modelo)<input id="vpX" type="number" step="any"></label>'+
 '<label>Centro Y (Modelo)<input id="vpY" type="number" step="any"></label>'+
 '<label>Posición X en hoja (mm)<input id="vpPaperX" type="number" step="any"></label>'+
 '<label>Posición Y en hoja (mm)<input id="vpPaperY" type="number" step="any"></label>'+
 '<label>Ancho de ventana (mm)<input id="vpWidth" type="number" min="5" step="any"></label>'+
 '<label>Alto de ventana (mm)<input id="vpHeight" type="number" min="5" step="any"></label></div>'+
 '<button type="button" id="vpUseModel">Capturar última vista de Modelo</button>'+
 '<button type="button" id="vpSplit">Dividir en dos ventanas</button>'+
 '<button type="button" id="vpRestore">Restablecer ventanas originales</button>'+
 '<p id="vpError" role="status"></p><div class="cad-utility-actions">'+
 '<button type="button" id="vpCancel">Cancelar</button><button type="button" id="vpApply">Aplicar ventanas</button></div></form>';
 document.body.append(dlg);
 const q=id=>dlg.querySelector('#'+id),unitMm=units==='mm'?1:units==='cm'?10:1000;
 let selected=0;
 const fill=()=>{
  q('vpPick').textContent='';
  rows.forEach((v,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent='Ventana '+(i+1);q('vpPick').append(op)});
  q('vpPick').value=String(selected);
  const v=rows[selected];
  q('vpRatio').value=String(Math.max(1,Math.round(Number(v.viewHeight||1)*unitMm/Math.max(1,Number(v.height))*1000)/1000));
  q('vpX').value=String(Number(v.viewCenter?.x)||0);q('vpY').value=String(Number(v.viewCenter?.y)||0);
  q('vpPaperX').value=String(Number(v.center?.x)||0);q('vpPaperY').value=String(Number(v.center?.y)||0);
  q('vpWidth').value=String(Number(v.width)||100);q('vpHeight').value=String(Number(v.height)||100);
  q('vpSplit').disabled=rows.length>1;
 };
 const capture=()=>{
  const ratio=Number(q('vpRatio').value),x=Number(q('vpX').value),y=Number(q('vpY').value),
   px=Number(q('vpPaperX').value),py=Number(q('vpPaperY').value),
   width=Number(q('vpWidth').value),height=Number(q('vpHeight').value);
  if(![ratio,x,y,px,py,width,height].every(Number.isFinite)||ratio<1||ratio>1000000||width<5||height<5){
   q('vpError').textContent='Comprueba escala, centros y tamaños de ventana.';return false;
  }
  const v=rows[selected];
  rows[selected]={...v,layout:layout.name,id:Number(v.id)||selected+2,status:1,
   center:{x:px,y:py},width,height,viewCenter:{x,y},viewHeight:height*ratio/unitMm,
   viewCenterKnown:true,estimated:false,generated:true,manual:true};
  q('vpError').textContent='';return true;
 };
 q('vpPick').onchange=()=>{
  const index=Number(q('vpPick').value);if(!capture()){q('vpPick').value=String(selected);return}
  selected=index;fill();
 };
 q('vpUseModel').onclick=()=>{
  if(!lastModelCamera){q('vpError').textContent='Vuelve a Modelo, encuadra la zona y luego regresa a la presentación.';return}
  q('vpX').value=String(lastModelCamera.center.x);q('vpY').value=String(lastModelCamera.center.y);
  q('vpRatio').value=String(Math.max(1,Math.round(lastModelCamera.viewHeight*unitMm/Math.max(1,Number(q('vpHeight').value)))));
  q('vpError').textContent='Vista de Modelo capturada; pulsa Aplicar.';
 };
 q('vpSplit').onclick=()=>{
  if(!capture()||rows.length!==1)return;
  const a=rows[0],half=Math.max(5,(a.width-5)/2);
  const left={...a,center:{x:a.center.x-(half+5)/2,y:a.center.y},width:half};
  const right={...a,id:3,center:{x:a.center.x+(half+5)/2,y:a.center.y},width:half,
   viewCenter:{...a.viewCenter}};
  rows.splice(0,1,left,right);selected=0;fill();
 };
 q('vpRestore').onclick=()=>{
  layout.viewportFit=layout.source==='new'?'all':'imported';
  delete layout.customViewports;saveLayoutState();render();
  status.textContent='Ventanas originales restablecidas';dlg.close();
 };
 q('vpCancel').onclick=()=>dlg.close();
 q('vpApply').onclick=()=>{
  if(!capture())return;
  if(rows.some(v=>!cadPaperViewportUsable(v,layout))){
   q('vpError').textContent='Una ventana está fuera de la hoja. Ajusta su centro o sus dimensiones.';return;
  }
  layout.customViewports=clone(rows);layout.viewportFit='custom';saveLayoutState();render();
  status.textContent='Presentación '+layout.name+' · '+rows.length+' ventana(s) a escala';dlg.close();
 };
 dlg.addEventListener('close',()=>dlg.remove());fill();dlg.showModal();
}
function showCadPaperSettings(){
 const layout=paperLayoutsSafe().find(l=>l.name===activeLayout);if(!layout)return;
 const sizes=[['A4',297,210],['A3',420,297],['A2',594,420],['A1',841,594],['A0',1189,841],['Carta',279.4,215.9],['Oficio',355.6,215.9]];
 const dialog=document.createElement('dialog');dialog.className='cad-utility-dialog cad-paper-settings';
 dialog.innerHTML='<form method="dialog"><h3>Configuración de página · CAD y Civil 3D</h3><p>Una sola presentación técnica para arquitectura, topografía y Civil 3D. El Modelo y sus entidades originales no se modifican.</p>'+
 '<label>Formato de papel<select id="paperSize">'+sizes.map(x=>'<option value="'+x[0]+'">'+x[0]+'</option>').join('')+'<option value="custom">Personalizado</option></select></label>'+
 '<label>Orientación<select id="paperOrientation"><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></label>'+
 '<label>Ancho (mm)<input id="paperWidth" type="number" min="30" max="2000" step="0.1"></label>'+
 '<label>Alto (mm)<input id="paperHeight" type="number" min="30" max="2000" step="0.1"></label>'+
 '<label>Margen guía (mm)<input id="paperMargin" type="number" min="0" max="100" step="1"></label>'+
 '<label>Ventana de dibujo<select id="paperFit"><option value="imported">Conservar VIEWPORT importados</option><option value="all">Encuadrar todo el modelo</option><option value="manual">Usar vista seleccionada desde Modelo</option><option value="custom">Usar ventanas configuradas (MVIEW)</option></select></label>'+'<label>Escala de la vista (si se encuadra el modelo)<select id="paperScale"><option value="fit">Ajustar a la hoja</option><option value="10">1:10</option><option value="20">1:20</option><option value="25">1:25</option><option value="50">1:50</option><option value="75">1:75</option><option value="100">1:100</option><option value="200">1:200</option><option value="500">1:500</option><option value="1000">1:1000</option><option value="2000">1:2000</option><option value="5000">1:5000</option></select></label>'+'<label>Estilo de impresión<select id="paperPlotStyle"><option value="color">Color</option><option value="grayscale">Escala de grises</option><option value="monochrome">Monocromático (negro)</option></select></label>'+
 '<label class="paper-check"><input type="checkbox" id="paperTemplate"> Incluir marco y cajetín técnico en esta hoja</label>'+
 '<label>Proyecto<input id="paperProjectName" type="text" maxlength="60"></label>'+
 '<label>Nombre de la lámina<input id="paperSheetTitle" type="text" maxlength="60"></label>'+
 '<label>Número de plano<input id="paperSheetNumber" type="text" maxlength="15"></label>'+
 '<label>Revisión<input id="paperRevision" type="text" maxlength="12"></label>'+
 '<label class="paper-check"><input type="checkbox" id="paperModelText"> Mostrar anotaciones de Modelo dentro de la ventana</label>'+
 '<button type="button" id="paperViewportManager">▣ Editar ventanas y escalas (MVIEW)</button>'+
 '<button type="button" id="paperCopyModelView">Usar el último encuadre visible de Modelo</button>'+'<p>Para elegir una planta: encuádrela en Modelo, regresa a esta hoja y captura esa vista. El cajetín se imprime en PDF; la exportación DWG/DXF todavía no lo convierte en entidades nativas de papel.</p>'+
 '<p id="paperWarning" role="status"></p><div class="cad-utility-actions"><button type="button" id="paperCancel">Cancelar</button><button type="button" id="paperApply">Aplicar</button></div></form>';
 document.body.append(dialog);
 const byId=id=>dialog.querySelector('#'+id);
 byId('paperWidth').value=layout.paperWidth||420;byId('paperHeight').value=layout.paperHeight||297;byId('paperMargin').value=layout.margin??10;
 byId('paperFit').value=['all','manual','custom'].includes(layout.viewportFit)?layout.viewportFit:'imported';
 byId('paperScale').value=String(layout.plotScale||'fit');byId('paperModelText').checked=!layout.hideModelText;
 byId('paperPlotStyle').value=['color','grayscale','monochrome'].includes(layout.plotStyle)?layout.plotStyle:'color';
 byId('paperTemplate').checked=Boolean(layout.sheetTemplate);
 byId('paperProjectName').value=layout.projectName||'PROYECTO';
 byId('paperSheetTitle').value=layout.sheetTitle||'PLANO GENERAL';
 byId('paperSheetNumber').value=layout.sheetNumber||'01';
 byId('paperRevision').value=layout.revision||'00';
 byId('paperViewportManager').onclick=()=>{dialog.close();showCadViewportManager()};
 const found=sizes.find(p=>Math.abs(Math.max(layout.paperWidth,layout.paperHeight)-p[1])<1&&Math.abs(Math.min(layout.paperWidth,layout.paperHeight)-p[2])<1);
 byId('paperSize').value=found?found[0]:'custom';byId('paperOrientation').value=layout.paperWidth>=layout.paperHeight?'landscape':'portrait';
 const resizeFromPreset=()=>{const preset=sizes.find(p=>p[0]===byId('paperSize').value);if(!preset)return;const vertical=byId('paperOrientation').value==='portrait';byId('paperWidth').value=vertical?preset[2]:preset[1];byId('paperHeight').value=vertical?preset[1]:preset[2]};
 byId('paperSize').onchange=resizeFromPreset;byId('paperOrientation').onchange=resizeFromPreset;
 let selectedModelView=layout.manualView||null;
 byId('paperCopyModelView').onclick=()=>{
  if(!lastModelCamera){byId('paperWarning').textContent='Regresa a Modelo, encuadra la planta con zoom y vuelve a abrir esta configuración.';return}
  selectedModelView={center:{...lastModelCamera.center},viewHeight:lastModelCamera.viewHeight};
  byId('paperFit').value='manual';byId('paperWarning').textContent='Vista de Modelo capturada. Pulsa Aplicar para mostrar esa planta en la lámina.';
 };
 byId('paperCancel').onclick=()=>dialog.close();
 byId('paperApply').onclick=()=>{
  const pw=Number(byId('paperWidth').value),ph=Number(byId('paperHeight').value),margin=Number(byId('paperMargin').value);
  if(!Number.isFinite(pw)||!Number.isFinite(ph)||pw<30||ph<30||pw>2000||ph>2000||!Number.isFinite(margin)||margin<0||margin>=Math.min(pw,ph)/3){byId('paperWarning').textContent='Revisa las medidas y los márgenes de impresión.';return}
  if(byId('paperFit').value==='manual'&&!selectedModelView){byId('paperWarning').textContent='Primero selecciona una vista desde Modelo con el botón azul.';return}
  if(byId('paperFit').value==='custom'&&!layout.customViewports?.length){byId('paperWarning').textContent='Primero configura las ventanas en MVIEW.';return}
  layout.paperWidth=pw;layout.paperHeight=ph;layout.margin=margin;layout.viewportFit=byId('paperFit').value;
  layout.plotScale=byId('paperScale').value;layout.hideModelText=!byId('paperModelText').checked;
  layout.plotStyle=byId('paperPlotStyle').value;layout.sheetTemplate=byId('paperTemplate').checked;
  layout.projectName=byId('paperProjectName').value.trim().slice(0,60);
  layout.sheetTitle=byId('paperSheetTitle').value.trim().slice(0,60);
  layout.sheetNumber=byId('paperSheetNumber').value.trim().slice(0,15);
  layout.revision=byId('paperRevision').value.trim().slice(0,12);
  if(selectedModelView)layout.manualView=selectedModelView;
  saveLayoutState();render();status.textContent='Hoja '+layout.name+' · '+pw+' × '+ph+' mm';dialog.close();
 };
 dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function render(){
 const refButton=document.getElementById('rotateRefBtn');if(refButton)refButton.hidden=!(tool==='rotate'&&moveBase&&activeLayout==='Model');
 if(activeLayout!=='Model'){cursorMeasureEl.hidden=true;$('#dynamic').style.display='none';if(cursorCommandEl)cursorCommandEl.hidden=true;const credit=$('#cadMapAttribution');if(credit)credit.hidden=true;renderPaperLayout();return}
 const oldPaperNotice=document.getElementById('cadLayoutNotice');if(oldPaperNotice)oldPaperNotice.hidden=true;
 const finish=$('#finish-poly');finish.hidden=tool!=='poly'||poly.length===0;finish.disabled=poly.length<2;
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle=printing?'#ffffff':(getComputedStyle($('#stage')).backgroundColor||'#101820');ctx.fillRect(0,0,w,h);
 if(!printing){const map=window.OtroCadGeolocation;map?.draw(ctx,{world,screen,width:w,height:h,units});ctx.save();if(map?.isVisible())ctx.globalAlpha=.16;drawGrid(w,h);ctx.restore()}
 // Imported CAD hatches are background fills; keep dimensions, walls and labels visible on top.
 objects.forEach((s,i)=>{if(s.importedHatch&&isVisibleModelEntity(s))drawEntity(s,i===selected||selectedSet.has(i))});
 objects.forEach((s,i)=>{if(!s.importedHatch&&isVisibleModelEntity(s))drawEntity(s,i===selected||selectedSet.has(i))});
 drawSelectionGrips();if(!printing&&activeSnap?.type==='EXTENSIÓN'&&activeSnap.origin){const a=screen(activeSnap.origin),b=screen(activeSnap.point);ctx.save();ctx.strokeStyle='#f7cf56';ctx.lineWidth=1.3;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}
 if(!printing&&activeSnap&&osnapOn){const sp=screen(activeSnap.point);ctx.save();ctx.strokeStyle='#ffdc45';ctx.fillStyle='#ffdc45';ctx.lineWidth=2;ctx.beginPath();if(activeSnap.type==='CENTRO')ctx.arc(sp.x,sp.y,6,0,Math.PI*2);else if(activeSnap.type==='PUNTO MEDIO'){ctx.moveTo(sp.x,sp.y-7);ctx.lineTo(sp.x-7,sp.y+6);ctx.lineTo(sp.x+7,sp.y+6);ctx.closePath()}else ctx.rect(sp.x-6,sp.y-6,12,12);ctx.stroke();ctx.font='11px system-ui';ctx.fillText(activeSnap.type,sp.x+12,sp.y-10);ctx.restore()}
 if(!printing&&selectionBox){const l=Math.min(selectionBox.a.x,selectionBox.b.x),r=Math.max(selectionBox.a.x,selectionBox.b.x),t=Math.min(selectionBox.a.y,selectionBox.b.y),b=Math.max(selectionBox.a.y,selectionBox.b.y),win=selectionBox.b.x>=selectionBox.a.x;ctx.save();ctx.fillStyle=win?'rgba(55,145,255,.14)':'rgba(48,210,125,.14)';ctx.strokeStyle=win?'#4a9bff':'#35d28a';ctx.lineWidth=1.4;ctx.setLineDash(win?[]:[7,4]);ctx.fillRect(l,t,r-l,b-t);ctx.strokeRect(l,t,r-l,b-t);ctx.setLineDash([]);ctx.font='11px system-ui';ctx.fillStyle=win?'#78b8ff':'#65e6a8';ctx.fillText(win?'VENTANA':'CRUCE',l+5,Math.max(13,t-5));ctx.restore()}
 if(!printing&&moveBase&&['move','copy'].includes(tool)&&modifyTargets.length){
  const q=constrain(snapPoint(world(cursor))),dx=q.x-moveBase.x,dy=q.y-moveBase.y;
  ctx.save();ctx.globalAlpha=.5;for(const i of modifyTargets.slice(0,300)){if(objects[i]){const preview=clone(objects[i]);translate(preview,dx,dy);drawEntity(preview,false,true)}}ctx.restore();
  const a=screen(moveBase),b=screen(q);ctx.save();ctx.setLineDash([6,4]);ctx.strokeStyle='#ffcf23';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
 }
 if(!printing&&moveBase&&tool==='scale'&&modifyTargets.length){
  const q=world(cursor),factor=distance(moveBase,q)/scaleReference;
  if(Number.isFinite(factor)&&factor>1e-6){
   ctx.save();ctx.globalAlpha=.55;
   for(const i of modifyTargets){if(!objects[i])continue;const preview=clone(objects[i]),scale=p=>({x:moveBase.x+(p.x-moveBase.x)*factor,y:moveBase.y+(p.y-moveBase.y)*factor});if(preview.a)preview.a=scale(preview.a);if(preview.b)preview.b=scale(preview.b);if(preview.pts)preview.pts=preview.pts.map(scale);if(preview.hatchLoops)preview.hatchLoops=preview.hatchLoops.map(loop=>loop.map(scale));if(preview.textAlignmentPoint)preview.textAlignmentPoint=scale(preview.textAlignmentPoint);if(preview.type==='text')preview.textHeightWorld=Number(preview.textHeightWorld||.4)*factor;if((preview.type==='dim'||preview.type==='dimaligned')&&Number.isFinite(preview.dimOffset))preview.dimOffset*=factor;preview.linetype='HIDDEN';drawEntity(preview,false,true)}
   ctx.restore();const a=screen(moveBase),b=screen(q);ctx.save();ctx.setLineDash([6,4]);ctx.strokeStyle='#ffcf23';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.font='13px system-ui';ctx.fillStyle='#ffcf23';ctx.fillText('Factor '+factor.toFixed(3)+' · escribe valor en CMD',b.x+12,b.y-10);ctx.restore();
  }
 }
 if(!printing&&temp)drawEntity(temp,false,true);
 if(!printing)for(const item of window.OtroCadMep?.getPreview()||[])drawEntity(item,false,true);
 if(!printing&&tool==='poly'&&poly.length)drawEntity({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)},false);
 if(!printing&&start&&crossOn){const p=screen(start);ctx.strokeStyle=resolveCadColor({layer:'General',color:'#dce8f5'},canvasIsLight());ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.stroke()}
 if(!printing&&crossOn){const p=cursor,half=Math.max(6,crossPrefs.pickbox/2),len=crossPrefs.size>=100?Math.max(w,h):Math.max(12,Math.min(w,h)*crossPrefs.size/200);ctx.save();ctx.strokeStyle=crossPrefs.mode==='auto'?(canvasIsLight()?'#1a1a1a':'#ffffff'):crossPrefs.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.max(0,p.x-len),p.y);ctx.lineTo(p.x-half,p.y);ctx.moveTo(p.x+half,p.y);ctx.lineTo(Math.min(w,p.x+len),p.y);ctx.moveTo(p.x,Math.max(0,p.y-len));ctx.lineTo(p.x,p.y-half);ctx.moveTo(p.x,p.y+half);ctx.lineTo(p.x,Math.min(h,p.y+len));ctx.stroke();ctx.strokeRect(p.x-half,p.y-half,half*2,half*2);ctx.restore()}
 const anchor=activeAnchor();if(!printing&&temp&&anchor){const b=screen(temp.b);ctx.fillStyle='#62b8e8';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();/* Dimensions are positioned near the snapped cursor by updateDynamic. */}
 if(printing){$('#dynamic').style.display='none';cursorMeasureEl.hidden=true}else updateDynamic();
 if(cursorCommandEl)updateCursorCommand();
}
function resize(){const d=window.devicePixelRatio||1,r=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);render()}
const matchState={source:null,sourceIndex:-1,applied:0};
const matchStyleKeys=['layer','color','trueColor','colorIndex','lineweight','linetype','linetypeScale','cadOpacity','plotStyle','lineWidth','transparency'];
const matchTypeKeys={
 text:['textHeightWorld','textHeight','textFontFamily','textFontFile','textFontBold','textFontItalic','textWidthFactor','textObliqueAngle','textRotation','textStyle','mtextLineSpacingFactor'],
 polygon:['solidFill','hatchPattern','hatchAngle','hatchSpacingWorld','hatchOpacity','hatchPatternLines','hatchGradientColors','hatchGradientAngle'],
 hatch:['hatchPattern','hatchAngle','hatchSpacing','hatchOpacity','hatchPatternLines','hatchSpacingWorld'],
 dim:['dimStyle','dimTextHeight','dimArrowSize','dimColor','dimLineweight'],
 dimaligned:['dimStyle','dimTextHeight','dimArrowSize','dimColor','dimLineweight']
};
function matchPropertiesAt(q){
 const hit=selectAt(q);
 if(hit<0){status.textContent=matchState.source?'MA: selecciona un objeto de destino · Esc para terminar':'MA: selecciona el objeto ORIGEN';return}
 const item=objects[hit];
 if(!matchState.source){
  matchState.source=clone(item);matchState.sourceIndex=hit;matchState.applied=0;
  status.textContent='MA · origen: '+item.type+' en '+item.layer+' · toca los DESTINOS o Esc para terminar';return;
 }
 if(hit===matchState.sourceIndex){status.textContent='MA: selecciona objetos de destino distintos al origen';return}
 if(lockedLayers.has(item.layer)){status.textContent='MA: destino en una capa bloqueada';return}
 const source=matchState.source,patch={},clear=[];
 const transfer=key=>{
  if(Object.prototype.hasOwnProperty.call(source,key))patch[key]=clone(source[key]);
  else if(Object.prototype.hasOwnProperty.call(item,key))clear.push(key);
 };
 for(const key of matchStyleKeys)transfer(key);
 if(item.type===source.type)for(const key of matchTypeKeys[item.type]||[])transfer(key);
 // Never copy geometry, positions, layouts, groups or project identity.
 if(!Object.keys(patch).length&&!clear.length){status.textContent='MA: el origen no tiene propiedades transferibles';return}
 checkpoint();
 for(const key of clear)delete item[key];
 for(const [key,value] of Object.entries(patch))item[key]=value;
 if(patch.layer)window.OtroCadCivilAPI?.ensureLayer(patch.layer,patch.color||source.color);
 save();render();matchState.applied++;
 status.textContent='MA · '+matchState.applied+' objeto(s) igualados · selecciona otro destino · Esc para terminar';
}
let scaleReference=1;
let rotateRef={phase:'off',first:null,angle:0};
let trimState={phase:'quick',boundaries:new Set()};
function setTool(t,options={}){rotateRef={phase:'off',first:null,angle:0};if(t==='trim')trimState={phase:'quick',boundaries:new Set()};updateTrimPanel(t);if(t!=='matchprop'){matchState.source=null;matchState.sourceIndex=-1}if(activeLayout!=='Model'&&t!=='select'){status.textContent='Vista papel: vuelve a Modelo para editar el dibujo';return}parallelDirection=null;resetRectangleDimensions();resetLineCoordinates();window.OtroCadMep?.onToolChanged(t);offsetAwaitingDistance=t==='offset'&&!options.offsetDistanceProvided;if(t==='offset'){clearSelection();offsetDistancePreset=!!options.offsetDistanceProvided;if(offsetAwaitingDistance)$('#dynLen').value=String(offsetDistance)}selectionClickAnchor=null;selectionBox=null;selectionStart=null;tool=t;start=null;temp=null;poly=[];arcPoints=[];moveBase=null;modifyTarget=-1;modifyTargets=[];document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#insertFurniture').classList.toggle('active',t==='furniture');updatePrompt();render();if(offsetAwaitingDistance){$('#dynLen').focus({preventScroll:true});$('#dynLen').select();status.textContent='OFFSET: escribe distancia y pulsa Enter'}}
function selectAt(q){
 let found=-1,best=14/zoom;
 for(let i=objects.length-1;i>=0;i--){const s=objects[i];if(!isVisibleModelEntity(s)||lockedLayers.has(s.layer))continue;let d=1e9;
  if(s.type==='poly'||s.type==='polygon'){const loops=s.hatchLoops?.length?s.hatchLoops:[s.pts];for(const loop of loops){const count=loop.length-1+(s.type==='polygon'?1:0);for(let j=0;j<count;j++)d=Math.min(d,pointLineDistance(q,loop[j],loop[(j+1)%loop.length]))}}
  else if(s.type==='rect'||s.type==='hatch'){if(q.x>=Math.min(s.a.x,s.b.x)-best&&q.x<=Math.max(s.a.x,s.b.x)+best&&q.y>=Math.min(s.a.y,s.b.y)-best&&q.y<=Math.max(s.a.y,s.b.y)+best)d=0}
  else if(s.type==='ellipse'){const rx=Math.abs(s.b.x-s.a.x),ry=Math.abs(s.b.y-s.a.y);if(rx&&ry){const normalized=Math.hypot((q.x-s.a.x)/rx,(q.y-s.a.y)/ry);d=Math.abs(normalized-1)*Math.min(rx,ry)}}
  else if(s.type==='arc'&&s.pts?.length>=3){const g=arcParams(s.pts);if(g){const p=screen(q),theta=Math.atan2(p.y-g.y,p.x-g.x),span=v=>(v+2*Math.PI)%(2*Math.PI),onArc=g.anticlockwise?span(g.a1-theta)<=span(g.a1-g.a3):span(theta-g.a1)<=span(g.a3-g.a1);d=onArc?Math.abs(Math.hypot(p.x-g.x,p.y-g.y)-g.r)/zoom:Math.min(distance(q,s.pts[0]),distance(q,s.pts[2]))}else for(let j=0;j<s.pts.length-1;j++)d=Math.min(d,pointLineDistance(q,s.pts[j],s.pts[j+1]))}
  else if(s.type==='circle')d=Math.abs(distance(q,s.a)-distance(s.a,s.b));
  else if(s.type==='dim'||s.type==='dimaligned'){const g=dimensionGeometry(s);if(g)d=Math.min(pointLineDistance(q,g.a,g.b),pointLineDistance(q,s.a,g.a),pointLineDistance(q,s.b,g.b))}
  else if(s.type==='text'){const bounds=cadTextBoundsWorld(s);if(bounds.length===4){if(pointInPolygon(q,bounds))d=0;else for(let j=0;j<4;j++)d=Math.min(d,pointLineDistance(q,bounds[j],bounds[(j+1)%4]))}}
  else if(s.a&&s.b)d=pointLineDistance(q,s.a,s.b);else if(s.a)d=distance(q,s.a);
  if(d<best){best=d;found=i}
 }
 return found
}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function dimensionGeometry(s){
 if(!s.a||!s.b)return null;
 const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,length=Math.hypot(dx,dy);if(length<1e-12)return null;
 const nx=-dy/length,ny=dx/length,offset=Number(s.dimOffset)||0;
 const a={x:s.a.x+nx*offset,y:s.a.y+ny*offset},b={x:s.b.x+nx*offset,y:s.b.y+ny*offset};
 return {a,b,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},nx,ny,length};
}
function gripDescriptors(s){
 const out=[],add=(key,p)=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))out.push({key,p})};
 if(s.type==='dim'||s.type==='dimaligned'){add('a',s.a);add('b',s.b);const g=dimensionGeometry(s);if(g)add('dimOffset',g.mid)}
 else if(s.type==='line'||s.type==='leader'){add('a',s.a);add('b',s.b)}
 else if(s.type==='rect'||s.type==='hatch'){
  if(s.a&&s.b){add('rect0',{x:s.a.x,y:s.a.y});add('rect1',{x:s.b.x,y:s.a.y});add('rect2',{x:s.b.x,y:s.b.y});add('rect3',{x:s.a.x,y:s.b.y})}
 }else if(s.type==='circle'&&s.a&&s.b){
  const r=distance(s.a,s.b);add('a',s.a);add('radius',{x:s.a.x+r,y:s.a.y});add('radius',{x:s.a.x-r,y:s.a.y});add('radius',{x:s.a.x,y:s.a.y+r});add('radius',{x:s.a.x,y:s.a.y-r});
 }else if(s.type==='ellipse'&&s.a&&s.b){
  add('a',s.a);add('rx+',{x:s.a.x+Math.abs(s.b.x-s.a.x),y:s.a.y});add('rx-',{x:s.a.x-Math.abs(s.b.x-s.a.x),y:s.a.y});add('ry+',{x:s.a.x,y:s.a.y+Math.abs(s.b.y-s.a.y)});add('ry-',{x:s.a.x,y:s.a.y-Math.abs(s.b.y-s.a.y)});
 }else if(s.type==='point'||s.type==='text'){add('a',s.a||(s.pts&&s.pts[0]))}
 else if(s.type==='poly'||s.type==='polygon'||s.type==='arc'){(s.pts||[]).forEach((p,i)=>add('pt:'+i,p))}
 return out;
}
function cadHasTouchGrips(){return !!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)}
function drawSelectionGrips(){
 if(printing||activeLayout!=='Model'||tool!=='select')return;
 const r=cadHasTouchGrips()?7:4;
 ctx.save();
 for(const idx of selectedItems()){
  const s=objects[idx];if(!s||!isVisibleModelEntity(s))continue;
  for(const g of gripDescriptors(s)){
   const p=screen(g.p);ctx.fillStyle='#f7fbff';ctx.strokeStyle='#1675c9';ctx.lineWidth=1.4;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);
  }
 }
 ctx.restore();
}
function findGripAt(p,isTouch=false){
 // Finger pads cover tiny CAD grips: 27px minimum touch target radius.
 let found=null,best=isTouch||cadHasTouchGrips()?27:12;
 for(const idx of selectedItems()){
  const s=objects[idx];if(!s||!isVisibleModelEntity(s)||lockedLayers.has(s.layer))continue;
  for(const g of gripDescriptors(s)){const q=screen(g.p),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<best){best=d;found={index:idx,key:g.key}}}
 }
 return found;
}
function applyGrip(s,key,q){
 const p={x:q.x,y:q.y};
 if(key==='dimOffset'){const g=dimensionGeometry(s);if(g)s.dimOffset=(p.x-s.a.x)*g.nx+(p.y-s.a.y)*g.ny;return}
 if(key==='a'){if(s.a)s.a=p;else if(s.pts?.length)s.pts[0]=p;return}
 if(key==='b'){if(s.b)s.b=p;else if(s.pts?.length>1)s.pts[1]=p;return}
 if(key==='radius'){if(s.b)s.b=p;return}
 if(key==='rx+'||key==='rx-'){if(s.a&&s.b)s.b.x=s.a.x+(key==='rx+'?1:-1)*Math.abs(p.x-s.a.x);return}
 if(key==='ry+'||key==='ry-'){if(s.a&&s.b)s.b.y=s.a.y+(key==='ry+'?1:-1)*Math.abs(p.y-s.a.y);return}
 if(key.startsWith('rect')&&s.a&&s.b){
  const k=Number(key.slice(4));
  if(k===0){s.a.x=p.x;s.a.y=p.y}
  else if(k===1){s.b.x=p.x;s.a.y=p.y}
  else if(k===2){s.b.x=p.x;s.b.y=p.y}
  else if(k===3){s.a.x=p.x;s.b.y=p.y}
  return;
 }
 if(key.startsWith('pt:')&&s.pts){const i=Number(key.slice(3));if(s.pts[i])s.pts[i]=p}
}
function cancelGripDrag(){
 if(!gripDrag)return;
 if(objects[gripDrag.index])objects[gripDrag.index]=clone(gripDrag.before);
 if(gripDrag.historyAdded&&undo.length)undo.pop();
 gripDrag=null;render();
}

function openTextEditor(index){
 const targets=(Array.isArray(index)?index:[index]).filter(i=>objects[i]?.type==='text'),batchMode=targets.length>1,s=objects[targets[0]];if(!s){status.textContent='Selecciona primero uno o varios textos';return false}
 const dlg=document.createElement('dialog');dlg.className='cad-utility-dialog cad-text-editor';
 const fontOptions=CAD_TEXT_FONT_CATALOG.map(font=>'<option value="'+font.id+'">'+font.label+'</option>').join('');
 dlg.innerHTML='<form method="dialog"><h3>Editor de texto CAD</h3><p>Modifica el contenido, la altura real del dibujo, la tipografía y la composición. Los cambios se guardan en el objeto seleccionado.</p>'+
 '<label class="cad-text-content">Contenido<textarea id="cadTextValue" rows="4" spellcheck="false"></textarea></label>'+
 '<div class="cad-text-grid"><label>Tipografía<select id="cadTextFont">'+fontOptions+'</select></label>'+
 '<label>Altura ('+units+')<input id="cadTextHeight" type="number" min="0.001" step="any"></label>'+
 '<label>Factor de ancho<input id="cadTextWidthFactor" type="number" min="0.05" max="20" step="0.05"></label>'+
 '<label>Rotación (°)<input id="cadTextRotation" type="number" step="0.1"></label>'+
 '<label>Inclinación (°)<input id="cadTextOblique" type="number" min="-80" max="80" step="0.5"></label>'+
 '<label>Color<input id="cadTextColor" type="color"></label>'+
 '<label>Alineación horizontal<select id="cadTextAlign"><option value="0">Izquierda</option><option value="1">Centro</option><option value="2">Derecha</option><option value="3">Alinear</option><option value="5">Ajustar</option></select></label>'+
 '<label>Alineación vertical<select id="cadTextVertical"><option value="0">Línea base</option><option value="1">Inferior</option><option value="2">Centro</option><option value="3">Superior</option></select></label>'+
 '<label>Ancho de MTEXT ('+units+')<input id="cadTextMTextWidth" type="number" min="0" step="any"></label>'+
 '<label>Interlineado<input id="cadTextLineSpacing" type="number" min="0.5" max="4" step="0.05"></label>'+
 '<label>Ancho para Alinear/Ajustar ('+units+')<input id="cadTextFitWidth" type="number" min="0" step="any"></label></div>'+
 '<div class="cad-text-checks"><label><input id="cadTextBold" type="checkbox"> Negrita</label><label><input id="cadTextItalic" type="checkbox"> Cursiva</label><label><input id="cadTextIsMText" type="checkbox"> Texto multilínea (MTEXT)</label></div>'+
 '<label>Posición del bloque MTEXT<select id="cadTextAttachment"><option value="1">Superior izquierda</option><option value="2">Superior centro</option><option value="3">Superior derecha</option><option value="4">Centro izquierda</option><option value="5">Centro</option><option value="6">Centro derecha</option><option value="7">Inferior izquierda</option><option value="8">Inferior centro</option><option value="9">Inferior derecha</option></select></label>'+
 '<div class="cad-text-presets"><span>Alturas rápidas</span><button type="button" data-height-m="0.12">Pequeño</button><button type="button" data-height-m="0.18">Normal</button><button type="button" data-height-m="0.25">Mediano</button><button type="button" data-height-m="0.35">Título</button></div>'+
 '<div class="cad-text-preview-label">VISTA PREVIA</div><div id="cadTextPreview" class="cad-text-preview"></div>'+
 '<div class="cad-utility-error" id="cadTextError" role="alert"></div><div class="cad-utility-actions"><button type="button" id="cadTextCancel">Cancelar</button><button type="button" id="cadTextApply">Aplicar cambios</button></div></form>';
 document.body.append(dlg);
 const $d=id=>dlg.querySelector('#'+id),font=cadFontEntryForFile(s.textFontFile)||CAD_TEXT_FONT_CATALOG[0],value=String(s.text||'');
 $d('cadTextValue').value=batchMode?'':value;$d('cadTextFont').value=font.id;if(batchMode){$d('cadTextValue').disabled=true;$d('cadTextValue').placeholder='Se conservará el contenido individual de los '+targets.length+' textos seleccionados.';}
 $d('cadTextHeight').value=Number(s.textHeightWorld||Number(s.textHeight||14)/Math.max(zoom,.001));
 $d('cadTextWidthFactor').value=Number(s.textWidthFactor||s.textStyleWidthFactor||1);
 $d('cadTextRotation').value=Number(s.textRotation||0);$d('cadTextOblique').value=Number(s.textObliqueAngle||s.textStyleObliqueAngle||0);
 $d('cadTextColor').value=/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:(colors[s.layer]||colors.General);
 $d('cadTextAlign').value=String(Number(s.textHorizontalAlignment||0));$d('cadTextVertical').value=String(Number(s.textVerticalAlignment||0));
 $d('cadTextMTextWidth').value=Number(s.mtextWidthWorld||0);$d('cadTextLineSpacing').value=Number(s.mtextLineSpacingFactor||1);
 $d('cadTextFitWidth').value=Number(s.textFitWidthWorld||0);$d('cadTextBold').checked=Boolean(s.textFontBold)||/(?:bd|bold|bi)\.(?:ttf|otf)$/i.test(String(s.textFontFile||''));
 $d('cadTextItalic').checked=Boolean(s.textFontItalic)||/(?:italic|oblique|i|it|z|bi)\.(?:ttf|otf)$/i.test(String(s.textFontFile||''));
 $d('cadTextIsMText').checked=Boolean(s.isMText)||Number(s.mtextWidthWorld||0)>0||value.includes('\n');
 $d('cadTextAttachment').value=String(Number(s.mtextAttachment||1));
 const preview=$d('cadTextPreview'),previewUpdate=()=>{
  const selectedFont=CAD_TEXT_FONT_CATALOG.find(item=>item.id===$d('cadTextFont').value)||CAD_TEXT_FONT_CATALOG[0];
  preview.style.fontFamily=selectedFont.family;preview.style.fontWeight=$d('cadTextBold').checked?'700':'400';preview.style.fontStyle=$d('cadTextItalic').checked?'italic':'normal';
  preview.style.fontSize=Math.max(12,Math.min(30,Number($d('cadTextHeight').value)*20||16))+'px';
  preview.textContent=batchMode?'Vista previa del formato para '+targets.length+' textos':($d('cadTextValue').value||'Vista previa del texto');
 };
 ['cadTextFont','cadTextBold','cadTextItalic','cadTextHeight','cadTextValue'].forEach(id=>$d(id).addEventListener('input',previewUpdate));
 dlg.querySelectorAll('[data-height-m]').forEach(button=>button.onclick=()=>{$d('cadTextHeight').value=(Number(button.dataset.heightM)*(units==='mm'?1000:units==='cm'?100:1)).toFixed(3);previewUpdate()});
 $d('cadTextCancel').onclick=()=>dlg.close();
 $d('cadTextApply').onclick=()=>{
  const newText=$d('cadTextValue').value,height=Number($d('cadTextHeight').value),widthFactor=Number($d('cadTextWidthFactor').value),rotation=Number($d('cadTextRotation').value),oblique=Number($d('cadTextOblique').value),mtextWidth=Number($d('cadTextMTextWidth').value),lineSpacing=Number($d('cadTextLineSpacing').value),fitWidth=Number($d('cadTextFitWidth').value),error=$d('cadTextError');
  if(!batchMode&&!newText.trim()){error.textContent='El contenido no puede quedar vacío.';return}
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(widthFactor)||widthFactor<.05||widthFactor>20||!Number.isFinite(rotation)||!Number.isFinite(oblique)||oblique< -80||oblique>80||!Number.isFinite(mtextWidth)||mtextWidth<0||!Number.isFinite(lineSpacing)||lineSpacing<.5||lineSpacing>4||!Number.isFinite(fitWidth)||fitWidth<0){error.textContent='Revisa altura, ancho, rotación, inclinación e interlineado.';return}
  const selectedFont=CAD_TEXT_FONT_CATALOG.find(item=>item.id===$d('cadTextFont').value)||CAD_TEXT_FONT_CATALOG[0],bold=$d('cadTextBold').checked,italic=$d('cadTextItalic').checked,fontFile=cadFontVariantFile(selectedFont,bold,italic),isMText=$d('cadTextIsMText').checked||newText.includes('\n'),horizontal=Number($d('cadTextAlign').value),vertical=Number($d('cadTextVertical').value);
  checkpoint();
  for(const targetIndex of targets){
   const target=objects[targetIndex];if(!target||target.type!=='text')continue;
   if(!batchMode)target.text=newText;
   target.textHeightWorld=height;delete target.textHeight;target.textWidthFactor=widthFactor;
   if(!batchMode)target.textRotation=rotation;
   target.textObliqueAngle=oblique;target.textFontFile=fontFile;target.textFontFamily=selectedFont.family;target.textFontBold=bold;target.textFontItalic=italic;
   target.textStyleFixedHeight=0;target.textStyleWidthFactor=widthFactor;target.textStyleObliqueAngle=oblique;
   target.textStyleName='OTROCAD_'+selectedFont.id.replace(/[^a-z0-9]+/gi,'_').toUpperCase()+(bold?'_B':'')+(italic?'_I':'');target.color=$d('cadTextColor').value;
   if(!batchMode){
    delete target.mtextRaw;delete target.mtextPlain;
    if(isMText){target.isMText=true;target.mtextWidthWorld=mtextWidth;target.mtextAttachment=Number($d('cadTextAttachment').value);target.mtextLineSpacingFactor=lineSpacing;target.mtextPlain=newText;delete target.textAlignmentPoint;delete target.textFitWidthWorld}
    else{delete target.isMText;delete target.mtextWidthWorld;delete target.mtextAttachment;delete target.mtextLineSpacingFactor;target.textHorizontalAlignment=horizontal;target.textVerticalAlignment=vertical;if((horizontal===3||horizontal===5)&&fitWidth>0){target.textFitWidthWorld=fitWidth;const angle=rotation*Math.PI/180;target.textAlignmentPoint={x:target.a.x+fitWidth*Math.cos(angle),y:target.a.y+fitWidth*Math.sin(angle)}}else{delete target.textFitWidthWorld;delete target.textAlignmentPoint}}
   }
  }
  save();render();showProperties();status.textContent=(batchMode?'Formato aplicado a '+targets.length+' textos':'Texto actualizado')+' · '+selectedFont.label+' · altura '+height+' '+units;dlg.close();
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();previewUpdate();$d('cadTextValue').focus();return true;
}
function editSelectedText(){
 const ids=selectedItems().filter(i=>objects[i]?.type==='text');
 if(!ids.length){status.textContent='Selecciona un texto o haz doble clic sobre él';return false}
 return openTextEditor(ids.length===1?ids[0]:ids);
}
function showProperties(){
 const box=$('#properties'),content=$('#propContent'),ids=selectedItems();
 if(ids.length>1){box.classList.add('open');content.innerHTML=ids.length+' objetos seleccionados. Puedes moverlos, copiarlos o eliminarlos como conjunto.';const textIds=ids.filter(i=>objects[i]?.type==='text');if(textIds.length){const edit=document.createElement('button');edit.type='button';edit.textContent='Editar formato de '+textIds.length+' textos…';edit.style.width='100%';edit.style.marginTop='10px';edit.onclick=()=>openTextEditor(textIds);content.append(edit)}return}
 if(selected<0){content.textContent='Selecciona una entidad para editar sus propiedades.';return}
 const s=objects[selected];box.classList.add('open');content.innerHTML='';
 const addLabel=(txt,node)=>{const l=document.createElement('label');l.textContent=txt;content.append(l,node)};
 const color=document.createElement('input');color.type='color';color.value=/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:(colors[s.layer]||colors.General);addLabel('Color de línea',color);
 const weight=document.createElement('select');['0.13','0.18','0.25','0.35','0.50','0.70','1.00'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v+' mm';weight.append(o)});weight.value=String(s.lineweight||.25);addLabel('Grosor de línea',weight);
 const type=document.createElement('select');[['CONTINUOUS','Continua'],['DASHED','Discontinua']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;type.append(o)});type.value=s.linetype||'CONTINUOUS';addLabel('Tipo de línea',type);
 let heightInput=null;
 if(s.type==='text'){
  const edit=document.createElement('button');edit.type='button';edit.textContent='Editar contenido y tipografía…';edit.style.width='100%';edit.style.margin='8px 0';edit.onclick=()=>openTextEditor(selected);content.append(edit);
  heightInput=document.createElement('input');heightInput.type='number';heightInput.min='0.001';heightInput.step='any';heightInput.value=Number(s.textHeightWorld||Number(s.textHeight||14)/Math.max(zoom,.001));addLabel('Altura del texto ('+units+')',heightInput);
  const info=document.createElement('small');info.textContent='Fuente: '+String(s.textFontFile||'txt.shx')+' · doble clic sobre el texto para editarlo';content.append(info);
 }
 const coordInputs=[];
 if(s.a&&s.b){[['X inicial',s.a.x],['Y inicial',s.a.y],['X final',s.b.x],['Y final',s.b.y]].forEach(([k,v])=>{const inp=document.createElement('input');inp.type='number';inp.step='0.001';inp.value=Number(v).toFixed(3);addLabel(k,inp);coordInputs.push([k,inp])})}
 const apply=document.createElement('button');apply.textContent='Aplicar propiedades';apply.onclick=()=>{checkpoint();s.color=color.value;s.lineweight=Number(weight.value);s.linetype=type.value;if(heightInput){const height=Number(heightInput.value);if(Number.isFinite(height)&&height>0){s.textHeightWorld=height;delete s.textHeight}}coordInputs.forEach(([k,inp])=>{const v=Number(inp.value);if(!Number.isFinite(v))return;if(k==='X inicial')s.a.x=v;if(k==='Y inicial')s.a.y=v;if(k==='X final')s.b.x=v;if(k==='Y final')s.b.y=v});save();render();showProperties();status.textContent='Propiedades actualizadas'};content.append(apply);
}

function selectionForUtility(){return selectedItems().filter(i=>objects[i]&&!hiddenLayers.has(objects[i].layer)&&!lockedLayers.has(objects[i].layer))}
function showArrayDialog(){
 const ids=selectionForUtility();if(!ids.length){status.textContent='Matriz: selecciona primero uno o varios objetos';alert('Selecciona primero uno o varios objetos para crear la matriz.');return}
 const sources=ids.map(i=>clone(objects[i]));
 const dlg=document.createElement('dialog');dlg.className='cad-utility-dialog';
 dlg.innerHTML=`<form method="dialog"><h3>Matriz rectangular</h3><p>Se copiarán ${ids.length} objeto(s). Las distancias se miden entre elementos, en ${units}.</p><div class="cad-utility-grid"><label>Filas<input id="arrayRows" type="number" min="1" max="50" value="2" step="1"></label><label>Columnas<input id="arrayCols" type="number" min="1" max="50" value="2" step="1"></label><label>Separación horizontal<input id="arrayDx" type="number" step="any" value="2"></label><label>Separación vertical<input id="arrayDy" type="number" step="any" value="2"></label></div><p class="cad-utility-error" role="alert"></p><div class="cad-utility-actions"><button type="button" id="arrayCancel">Cancelar</button><button type="button" id="arrayApply">Crear matriz</button></div></form>`;
 document.body.append(dlg);dlg.querySelector('#arrayCancel').onclick=()=>dlg.close();
 dlg.querySelector('#arrayApply').onclick=()=>{
  const rows=Number(dlg.querySelector('#arrayRows').value),cols=Number(dlg.querySelector('#arrayCols').value),dx=Number(dlg.querySelector('#arrayDx').value),dy=Number(dlg.querySelector('#arrayDy').value),error=dlg.querySelector('.cad-utility-error');
  if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>50||cols>50){error.textContent='Usa entre 1 y 50 filas y columnas.';return}
  if(rows*cols<=1||(rows*cols-1)*sources.length>1000){error.textContent='Crea al menos una copia y un máximo de 1000 objetos nuevos.';return}
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||(cols>1&&dx===0)||(rows>1&&dy===0)){error.textContent='Indica separaciones válidas distintas de cero para las filas o columnas repetidas.';return}
  if(sources.some(s=>lockedLayers.has(s.layer))){error.textContent='Desbloquea las capas antes de crear la matriz.';return}
  checkpoint();const created=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){if(row===0&&col===0)continue;const groups=new Map();for(const source of sources){const cp=clone(source);if(cp.groupId){if(!groups.has(cp.groupId))groups.set(cp.groupId,newGroupId());cp.groupId=groups.get(cp.groupId)}translate(cp,col*dx,row*dy);objects.push(cp);created.push(objects.length-1)}}
  save();applySelection(created);setTool('select');render();status.textContent='Matriz creada · '+created.length+' objeto(s) nuevos';dlg.close();
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
function selectedCircles(){return selectionForUtility().map(i=>objects[i]).filter(s=>s.type==='circle'&&s.a&&s.b&&distance(s.a,s.b)>1e-9)}
function createCircleAnnotations(mode){
 const circles=selectedCircles();if(!circles.length){status.textContent='Selecciona uno o varios círculos';alert('Selecciona primero uno o varios círculos.');return}
 const layer=mode==='center'?$('#layer').value:'Cotas';if(lockedLayers.has(layer)){status.textContent='La capa '+layer+' está bloqueada';alert('La capa '+layer+' está bloqueada.');return}
 checkpoint();const created=[];const style=currentStyle(layer);style.linetype='CONTINUOUS';
 for(const circle of circles){const r=distance(circle.a,circle.b),center=circle.a,id=newGroupId();
  if(mode==='center'){const d=r*.2;for(const [a,b] of [[{x:center.x-d,y:center.y},{x:center.x+d,y:center.y}],[{x:center.x,y:center.y-d},{x:center.x,y:center.y+d}]]){objects.push({type:'line',a,b,...style,groupId:id});created.push(objects.length-1)}}
  else{const vx=(circle.b.x-center.x)/r,vy=(circle.b.y-center.y)/r,first=mode==='diameter'?{x:center.x-vx*r,y:center.y-vy*r}:clone(center),end={x:center.x+vx*r,y:center.y+vy*r};objects.push({type:'line',a:first,b:end,...style,groupId:id});created.push(objects.length-1);objects.push({type:'text',a:{x:end.x,y:end.y},text:(mode==='diameter'?'Ø':'R')+(mode==='diameter'?2*r:r).toFixed(2)+' '+units,textHeightWorld:Math.max(r*.10,.001),...style,groupId:id});created.push(objects.length-1)}
 }
 save();applySelection(created);setTool('select');render();status.textContent=(mode==='center'?'Marcas de centro':'Cotas no asociativas')+' creadas: '+circles.length;
}
function selectedArea(){
 const ids=selectionForUtility(),areas=[];
 for(const i of ids){const s=objects[i];let value=null;
  if((s.type==='rect'||s.type==='hatch')&&s.a&&s.b)value=Math.abs((s.b.x-s.a.x)*(s.b.y-s.a.y));
  else if(s.type==='circle'&&s.a&&s.b)value=Math.PI*distance(s.a,s.b)**2;
  else if(s.type==='ellipse'&&s.a&&s.b)value=Math.PI*Math.abs((s.b.x-s.a.x)*(s.b.y-s.a.y));
  else if(s.type==='polygon'&&s.pts?.length>=3){let sum=0;for(let j=0;j<s.pts.length;j++){const p=s.pts[j],q=s.pts[(j+1)%s.pts.length];sum+=p.x*q.y-q.x*p.y}value=Math.abs(sum)/2}
  if(value!==null)areas.push(value);
 }
 if(!areas.length){status.textContent='Área: selecciona un rectángulo, polígono, círculo o elipse';alert('Selecciona un rectángulo, polígono, círculo o elipse para medir el área.');return}
 const total=areas.reduce((a,b)=>a+b,0),msg='Área total: '+total.toFixed(3)+' '+units+'² · '+areas.length+' objeto(s)'+(areas.length<ids.length?' · '+(ids.length-areas.length)+' no compatibles':'');status.textContent=msg;alert(msg);
}
function createCenterline(){
 const lines=selectionForUtility().map(i=>objects[i]);
 if(lines.length!==2||lines.some(s=>s.type!=='line'||!s.a||!s.b)){alert('Selecciona exactamente dos líneas paralelas para crear el eje.');return}
 const [a,b]=lines,la=distance(a.a,a.b),lb=distance(b.a,b.b);if(la<1e-9||lb<1e-9){status.textContent='Las líneas deben tener longitud';return}
 const ux=(a.b.x-a.a.x)/la,uy=(a.b.y-a.a.y)/la,vx=(b.b.x-b.a.x)/lb,vy=(b.b.y-b.a.y)/lb;
 if(Math.abs(ux*vy-uy*vx)>1e-6){alert('Las líneas deben ser paralelas. No se modificó el dibujo.');return}
 const project=p=>p.x*ux+p.y*uy,normal=p=>-p.x*uy+p.y*ux;
 const lo=Math.max(Math.min(project(a.a),project(a.b)),Math.min(project(b.a),project(b.b))),hi=Math.min(Math.max(project(a.a),project(a.b)),Math.max(project(b.a),project(b.b)));
 if(hi-lo<1e-9){alert('Las líneas no tienen un tramo coincidente.');return}
 const layer=$('#layer').value;if(lockedLayers.has(layer)){alert('Desbloquea la capa actual antes de crear el eje.');return}
 const n=(normal(a.a)+normal(b.a))/2,point=t=>({x:ux*t-uy*n,y:uy*t+ux*n});
 checkpoint();objects.push({type:'line',a:point(lo),b:point(hi),...currentStyle(layer),linetype:'DASHED'});save();applySelection([objects.length-1]);setTool('select');render();status.textContent='Eje creado entre líneas paralelas';
}

function pointFromInputs(){if(usesLineCoordinates())return coordinatePoint(cursorNumber($('#dynLen').value),cursorNumber($('#dynAngle').value));const anchor=activeAnchor();const ls=$('#dynLen').value.trim(),as=$('#dynAngle').value.trim();if(!anchor||!ls||!as)return null;const len=cursorNumber(ls),ang=cursorNumber(as);if(!Number.isFinite(len)||!Number.isFinite(ang))return null;if(tool==='rect'){if(Math.abs(len)<1e-9||Math.abs(ang)<1e-9)return null;return {x:anchor.x+(len<0?len:len*rectangleDirections.x),y:anchor.y+(ang<0?ang:ang*rectangleDirections.y)}}if(len<0)return null;const rad=ang*Math.PI/180;return round({x:anchor.x+len*Math.cos(rad),y:anchor.y+len*Math.sin(rad)})}
function currentStyle(layer){const picked=($('#drawColor')?.value||'#dce8f5').toLowerCase();const color=picked==='#dce8f5'&&layer!=='General'?(colors[layer]||picked):picked;return {layer,color,lineweight:Number($('#lineweight')?.value||.25),linetype:$('#linetype')?.value||'CONTINUOUS'}}
function commitEntity(endPoint){
 if(!start)return;
 if(distance(start,endPoint)<1e-9){status.textContent='El segundo punto debe ser distinto al primero';return}
 if(tool==='rect'&&(Math.abs(start.x-endPoint.x)<1e-9||Math.abs(start.y-endPoint.y)<1e-9)){status.textContent='Rectángulo: ancho y alto deben ser distintos de cero';return}
 const layer=$('#layer').value;if(lockedLayers.has(layer)){status.textContent='La capa '+layer+' está bloqueada';return}
 const style=currentStyle(layer);
 checkpoint();
 if(tool==='line')objects.push({type:'line',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='dim'||tool==='dimaligned')objects.push({type:tool,a:clone(start),b:clone(endPoint),...style,layer:'Cotas'});
 else if(tool==='rect'||tool==='hatch'||tool==='ellipse')objects.push({type:tool,a:clone(start),b:clone(endPoint),...(tool==='hatch'?{hatchPattern:$('#hatchPattern')?.value||'ANSI31',hatchSpacing:Number($('#hatchSpacing')?.value||10)}:{}),...style});
 else if(tool==='circle')objects.push({type:'circle',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='polygon'){const n=Math.max(3,Math.min(64,polySides));const r=distance(start,endPoint);const pts=[];for(let i=0;i<n;i++){const a=Math.atan2(endPoint.y-start.y,endPoint.x-start.x)+2*Math.PI*i/n;pts.push({x:start.x+r*Math.cos(a),y:start.y+r*Math.sin(a)})}objects.push({type:'polygon',pts,...style})}
 save();applySelection([objects.length-1]);start=null;temp=null;resetLineCoordinates();if(tool==='rect')resetRectangleDimensions();render();updatePrompt();
}
function finishPoly(){if(poly.length<2){status.textContent='La polilínea necesita al menos dos puntos';return false}if(lockedLayers.has($('#layer').value)){status.textContent='La capa actual está bloqueada';return false}if(window.OtroCadMep?.hasRoute()){if(!window.OtroCadMep.commitRoute(clone(poly)))return false;setTool('select');return true}checkpoint();objects.push({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)});save();poly=[];start=null;temp=null;resetLineCoordinates();render();updatePrompt();status.textContent='Polilínea terminada';return true}
function doOffset(q){
 if(selected<0){
  const hit=selectAt(q);applySelection(hit>=0?[hit]:[]);
  if(selected<0){status.textContent='Selecciona una entidad para OFFSET';return}
  status.textContent='OFFSET: indica el lado del desfase';render();return;
 }
 const s=objects[selected],d=offsetDistance,style={layer:s.layer,color:s.color,lineweight:s.lineweight,linetype:s.linetype},before=objects.length;
 if(s.type==='line'){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;
  const side=((q.x-s.a.x)*(-dy/L)+(q.y-s.a.y)*(dx/L))>=0?1:-1,ox=-dy/L*d*side,oy=dx/L*d*side;
  checkpoint();objects.push({type:'line',a:{x:s.a.x+ox,y:s.a.y+oy},b:{x:s.b.x+ox,y:s.b.y+oy},...style});
 }else if(s.type==='circle'){
  const r=distance(s.a,s.b),newR=r+(distance(q,s.a)>r?d:-d);
  if(newR<=0){status.textContent='El desfase dejaría un radio no válido';return}checkpoint();objects.push({type:'circle',a:clone(s.a),b:{x:s.a.x+newR,y:s.a.y},...style});
 }else if(s.type==='rect'){
  const minX=Math.min(s.a.x,s.b.x),maxX=Math.max(s.a.x,s.b.x),minY=Math.min(s.a.y,s.b.y),maxY=Math.max(s.a.y,s.b.y),inside=q.x>=minX&&q.x<=maxX&&q.y>=minY&&q.y<=maxY,expand=inside?-d:d;
  if(inside&&(maxX-minX<=2*d||maxY-minY<=2*d)){status.textContent='El desfase dejaría un rectángulo no válido';return}checkpoint();objects.push({type:'rect',a:{x:minX-expand,y:minY-expand},b:{x:maxX+expand,y:maxY+expand},...style});
 }else{status.textContent='OFFSET disponible para líneas, círculos y rectángulos';return}
 if(objects.length===before){status.textContent='No se pudo crear el OFFSET';return}save();applySelection([]);render();status.textContent='OFFSET creado · selecciona otro objeto o Esc para terminar';
}
// Find bounded planar faces from actual visible drawing edges; never invent a boundary.
function findHatchFaces(shapes,point,tolerance=1e-7){
 const segs=[];
 for(const shape of shapes){
  if(!['line','poly','polygon','rect','circle','ellipse','arc'].includes(shape.type)||shape.hatchPattern||shape.solidFill||shape.importedHatch)continue;
  for(const [a,b] of entitySegments(shape))if(a&&b&&distance(a,b)>tolerance)segs.push({a,b,ts:[0,1]});
 }
 if(segs.length>1200)return {error:'El dibujo contiene demasiados bordes para detectar el recinto; aísla las capas necesarias.'};
 const cross=(x,y,u,v)=>x*v-y*u;
 for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
  const A=segs[i],B=segs[j],rx=A.b.x-A.a.x,ry=A.b.y-A.a.y,sx=B.b.x-B.a.x,sy=B.b.y-B.a.y;
  if(Math.max(A.a.x,A.b.x)+tolerance<Math.min(B.a.x,B.b.x)||Math.max(B.a.x,B.b.x)+tolerance<Math.min(A.a.x,A.b.x)||Math.max(A.a.y,A.b.y)+tolerance<Math.min(B.a.y,B.b.y)||Math.max(B.a.y,B.b.y)+tolerance<Math.min(A.a.y,A.b.y))continue;
  const den=cross(rx,ry,sx,sy),qx=B.a.x-A.a.x,qy=B.a.y-A.a.y;
  if(Math.abs(den)<1e-14)continue;
  const t=cross(qx,qy,sx,sy)/den,u=cross(qx,qy,rx,ry)/den;
  if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9){A.ts.push(Math.max(0,Math.min(1,t)));B.ts.push(Math.max(0,Math.min(1,u)))}
 }
 const vertices=[],grid=new Map(),edges=new Set();
 function vertex(p){const x=Math.round(p.x/tolerance),y=Math.round(p.y/tolerance);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const key=(x+dx)+','+(y+dy);for(const id of grid.get(key)||[])if(distance(vertices[id].p,p)<=tolerance)return id}const id=vertices.length,key=x+','+y;vertices.push({p,links:[]});if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);return id}
 for(const e of segs){e.ts.sort((a,b)=>a-b);for(let k=1;k<e.ts.length;k++){const t=e.ts[k-1],u=e.ts[k];if(u-t<1e-10)continue;const at=v=>({x:e.a.x+(e.b.x-e.a.x)*v,y:e.a.y+(e.b.y-e.a.y)*v}),a=vertex(at(t)),b=vertex(at(u));if(a===b)continue;const key=Math.min(a,b)+':'+Math.max(a,b);if(edges.has(key))continue;edges.add(key);vertices[a].links.push(b);vertices[b].links.push(a)}}
 vertices.forEach(v=>v.links.sort((a,b)=>Math.atan2(vertices[a].p.y-v.p.y,vertices[a].p.x-v.p.x)-Math.atan2(vertices[b].p.y-v.p.y,vertices[b].p.x-v.p.x)));
 const visited=new Set(),faces=[];
 for(let a=0;a<vertices.length;a++)for(const b of vertices[a].links){
  if(visited.has(a+':'+b))continue;let u=a,v=b,loop=[],closed=false;
  for(let n=0;n<=edges.size*2+1;n++){const key=u+':'+v;if(visited.has(key))break;visited.add(key);loop.push(vertices[u].p);const links=vertices[v].links,index=links.indexOf(u);if(index<0||!links.length)break;const w=links[(index-1+links.length)%links.length];u=v;v=w;if(u===a&&v===b){closed=true;break}}
  if(!closed||loop.length<3)continue;const area=loop.reduce((sum,p,i)=>{const q=loop[(i+1)%loop.length];return sum+p.x*q.y-q.x*p.y},0)/2;if(area>tolerance*tolerance)faces.push({loop,area})
 }
 const containers=faces.filter(f=>pointInPolygon(point,f.loop)).sort((a,b)=>a.area-b.area);
 if(!containers.length)return {error:'No se encontró un contorno cerrado. Revisa uniones, huecos y capas visibles.'};
 const outer=containers[0],holes=faces.filter(f=>f!==outer&&f.area<outer.area&&f.loop.every(p=>pointInPolygon(p,outer.loop)&&outer.loop.every((q,i)=>pointLineDistance(p,q,outer.loop[(i+1)%outer.loop.length])>tolerance)));
 return {loops:[outer.loop,...holes.map(f=>f.loop)]}
}
function hatchAtPoint(point){
 const result=findHatchFaces(objects.filter(isVisibleModelEntity),point);
 if(result.error){status.textContent='HATCH · '+result.error;return}
 const pattern=$('#hatchPattern')?.value||'ANSI31',spacing=Math.max(.001,Number($('#hatchSpacing')?.value||10));
 checkpoint();objects.push({type:'polygon',pts:clone(result.loops[0]),hatchLoops:clone(result.loops),hatchPattern:pattern,solidFill:pattern.toUpperCase()==='SOLID',hatchSpacingWorld:spacing/50,importedHatch:true,...currentStyle($('#layer').value)});
 save();clearSelection();render();status.textContent='HATCH creado · '+(result.loops.length-1)+' isla(s) detectadas · clic en otra zona o Esc para terminar';
}
function handleTap(p){
 const exactPoint=arguments[1]||null;
 if(tool==='matchprop'){matchPropertiesAt(world(p));return}
 let q=exactPoint?clone(exactPoint):constrain(snapPoint(world(p)));if(usesLineCoordinates())q=coordinateCorner(q);
 if(window.OtroCadMep?.placeAt(q))return;
 if(!['select','pan','move','copy','offset','trim','extend','explode','measure'].includes(tool)&&lockedLayers.has($('#layer').value)){status.textContent='La capa '+$('#layer').value+' está bloqueada';return}
 if(tool==='hatch'){hatchAtPoint(exactPoint||world(p));return}
 if(tool==='arc'){
  arcPoints.push(q);
  if(arcPoints.length===3){checkpoint();objects.push({type:'arc',pts:clone(arcPoints),...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);arcPoints=[];status.textContent='Arco creado';}
  else status.textContent='Arco: marca el '+(arcPoints.length===1?'segundo':'tercer')+' punto';
  render();return;
 }
 if(tool==='leader'){
  if(!start){start=q;temp={type:'line',a:clone(q),b:clone(q),...currentStyle($('#layer').value)};status.textContent='Marca el extremo de la directriz';render();return}
  const label=prompt('Texto de la directriz','');
  checkpoint();objects.push({type:'leader',a:clone(start),b:clone(q),text:label||'',...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);start=null;temp=null;render();status.textContent='Directriz creada';return;
 }
 if(tool==='measure'){
  if(!start){start=clone(q);temp={type:'line',a:clone(q),b:clone(q),...currentStyle($('#layer').value)};status.textContent='Medir: indica el segundo punto';render();return}
  const length=distance(start,q),dx=q.x-start.x,dy=q.y-start.y;status.textContent='Distancia: '+length.toFixed(3)+' '+units+' · ΔX '+dx.toFixed(3)+' · ΔY '+dy.toFixed(3);start=null;temp=null;render();updatePrompt();return;
 }
 if(tool==='text'){
  const value=prompt('Texto de la anotación','');if(value===null)return;if(!value.trim()){status.textContent='No se creó un texto vacío';return}
  const unitFactor=units==='mm'?1000:units==='cm'?100:1;checkpoint();objects.push({type:'text',a:clone(q),text:value,textHeightWorld:.25*unitFactor,textStyleName:'OTROCAD_ARIAL',textFontFile:'arial.ttf',textFontFamily:'Arial, Helvetica, sans-serif',textWidthFactor:1,textStyleWidthFactor:1,textFontBold:false,textFontItalic:false,...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);render();status.textContent='Texto creado';return;
 }
 if(tool==='furniture'){
  if(!activeFurniture){status.textContent='Elige un símbolo en BLOQUES';return}
  if(lockedLayers.has($('#layer').value)){status.textContent='La capa actual está bloqueada';return}
  const factor=Number($('#blockScale').value),rotation=Number($('#blockRotation').value)*Math.PI/180;
  if(!Number.isFinite(factor)||factor<.1||factor>10){status.textContent='La escala debe estar entre 0.1 y 10';return}
  const co=Math.cos(rotation),si=Math.sin(rotation),origin=clone(q),groupId=newGroupId(),ids=[],unitFactor=units==='mm'?1000:units==='cm'?100:1;
  const transform=p=>({x:origin.x+factor*unitFactor*(p.x*co-p.y*si),y:origin.y+factor*unitFactor*(p.x*si+p.y*co)});
  checkpoint();for(const source of activeFurniture.shapes){const shape={...clone(source),...currentStyle($('#layer').value),groupId};if(shape.a)shape.a=transform(shape.a);if(shape.b)shape.b=transform(shape.b);if(shape.pts)shape.pts=shape.pts.map(transform);objects.push(shape);ids.push(objects.length-1)}
  save();applySelection(ids);render();status.textContent=activeFurniture.name+' colocado · '+ids.length+' elementos agrupados';return;
 }
 if(tool==='select'){const hit=selectAt(q);applySelection(hit>=0?[hit]:[]);showProperties();render();return}
 if(tool==='pan'){return}
 if(tool==='offset'){if(offsetAwaitingDistance){$('#dynLen').focus({preventScroll:true});status.textContent='OFFSET: confirma la distancia con Enter';return}doOffset(q);return}
 if(tool==='poly'){poly.push(q);resetLineCoordinates();temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Polilínea: marca otro vértice o pulsa Enter';return}
 if(tool==='explode'){explodeAt(q);return}
 if(tool==='fillet'){
  const hit=selectAt(q);
  if(hit<0||objects[hit]?.type!=='line'){status.textContent='Empalme: selecciona una línea';return}
  if(modifyTarget<0){modifyTarget=hit;moveBase=clone(q);applySelection([hit]);status.textContent='Empalme: selecciona la segunda línea';return}
  if(hit===modifyTarget){status.textContent='Selecciona otra línea';return}
  const raw=prompt('Radio del empalme (0 para esquina)', '0');if(raw===null)return;
  const radius=Number(String(raw).trim().replace(',','.'));if(String(raw).trim()===''||!Number.isFinite(radius)||radius<0){status.textContent='Introduce un radio válido';return}
  const first=objects[modifyTarget],second=objects[hit],g=filletGeometry(first,second,moveBase,q,radius);
  if(!g){status.textContent='No se puede empalmar: comprueba las líneas y el radio';return}
  checkpoint();first[g.a.replace]=clone(g.t1);second[g.b.replace]=clone(g.t2);
  if(g.arc)objects.push({type:'arc',pts:g.arc.map(clone),layer:first.layer,color:first.color,lineweight:first.lineweight,linetype:first.linetype});
  save();applySelection([modifyTarget,hit]);modifyTarget=-1;moveBase=null;render();status.textContent='Empalme aplicado';return;
 }
 if(tool==='chamfer'){
  const hit=selectAt(q);
  if(hit<0||objects[hit]?.type!=='line'){status.textContent='Chaflán: selecciona una línea';return}
  if(modifyTarget<0){modifyTarget=hit;moveBase=clone(q);applySelection([hit]);status.textContent='Chaflán: selecciona la segunda línea';return}
  if(hit===modifyTarget){status.textContent='Selecciona otra línea';return}
  const raw=prompt('Distancia del chaflán (una distancia o dos separadas por coma)','0.25');if(raw===null)return;
  const values=String(raw).trim().replace(/\s/g,'').replace(';',',').split(',').map(Number);
  if(!values.length||values.length>2||values.some(v=>!Number.isFinite(v)||v<=0)){status.textContent='Introduce una o dos distancias positivas';return}
  const d1=values[0],d2=values[1]??d1,first=objects[modifyTarget],second=objects[hit],g=chamferGeometry(first,second,moveBase,q,d1,d2);
  if(!g){status.textContent='No se puede aplicar el chaflán: revisa las líneas y las distancias';return}
  checkpoint();first[g.a.replace]=clone(g.t1);second[g.b.replace]=clone(g.t2);
  objects.push({type:'line',a:clone(g.t1),b:clone(g.t2),layer:first.layer,color:first.color,lineweight:first.lineweight,linetype:first.linetype});
  save();applySelection([modifyTarget,hit,objects.length-1]);modifyTarget=-1;moveBase=null;render();status.textContent='CHAFLÁN aplicado';return;
 }
 if(tool==='trim'||tool==='extend'){
  const pick=world(p),idx=selectAt(pick);if(tool==='trim'&&trimState.phase==='boundaries'){if(idx<0){status.textContent='Selecciona un borde de corte';return}const edge=objects[idx];if(!entitySegments(edge).length){status.textContent='Este objeto no puede usarse como borde';return}trimState.boundaries.has(edge)?trimState.boundaries.delete(edge):trimState.boundaries.add(edge);applySelection(objects.map((o,i)=>trimState.boundaries.has(o)?i:-1).filter(i=>i>=0));updateTrimPanel('trim');render();return}if(idx<0){status.textContent='Toca el tramo que deseas modificar';return}
  const mode=tool==='trim'&&p.shiftForTrim?'extend':tool;
  if(mode==='trim')quickTrim(idx,pick);else trimOrExtend(idx,pick,'extend');return;
 }
 if(['move','copy','rotate','mirror','scale'].includes(tool)){
  if(modifyTargets.length===0){
   modifyTargets=selectedItems();
   if(!modifyTargets.length){const hit=selectAt(world(p));if(hit>=0){applySelection([hit]);modifyTargets=selectedItems();if(tool==='move'||tool==='copy'){moveBase=clone(q);status.textContent=(tool==='move'?'MOVER':'COPIAR')+' · punto base fijado en la selección · indica el punto destino';}else status.textContent='Objeto seleccionado · indica punto base';updatePrompt();render();return}}
   if(!modifyTargets.length){status.textContent='Selecciona uno o varios objetos';return}
  }
  if(!moveBase){moveBase=clone(q);if(tool==='scale'){const pts=modifyTargets.flatMap(i=>objects[i]?boundsPoints(objects[i]):[]);scaleReference=Math.max(...pts.map(v=>distance(moveBase,v)),1e-6);if(!Number.isFinite(scaleReference))scaleReference=1}status.textContent=tool==='mirror'?'Indica el segundo punto del eje':tool==='rotate'?'Indica el ángulo de giro':tool==='scale'?'Indica el factor de escala con la distancia':'Punto base fijado · indica punto destino';updatePrompt();render();return}
  if(tool==='rotate'&&rotateRef.phase==='first'){rotateRef.first=clone(q);rotateRef.phase='second';status.textContent='REFERENCIA · indica el segundo punto de la dirección existente';render();return}
  if(tool==='rotate'&&rotateRef.phase==='second'){if(distance(q,rotateRef.first)<1e-9){status.textContent='Referencia: los puntos deben ser distintos';return}rotateRef.angle=Math.atan2(q.y-rotateRef.first.y,q.x-rotateRef.first.x);rotateRef.phase='target';status.textContent='REFERENCIA · indica el nuevo ángulo o punto destino';render();return}
  let dx=q.x-moveBase.x,dy=q.y-moveBase.y;
  if(tool==='rotate'&&rotateRef.phase==='target'){if(Math.hypot(dx,dy)<1e-9){status.textContent='Destino: escoge un punto distinto al punto base';return}const a=Math.atan2(dy,dx)-rotateRef.angle;dx=Math.cos(a);dy=Math.sin(a)}
  const targets=modifyTargets.filter(i=>i>=0&&i<objects.length);
  if(tool==='mirror'&&Math.hypot(dx,dy)<1e-9){status.textContent='Eje de simetría demasiado corto';return}
  if(tool==='scale'&&Math.hypot(dx,dy)<1e-6){status.textContent='Factor de escala no válido';return}
  const transformAngle=Math.atan2(dy,dx),axisStep=tool==='mirror'?Math.PI/4:Math.PI/2,axisAligned=Math.abs(transformAngle/axisStep-Math.round(transformAngle/axisStep))<1e-7;
  if(['rotate','mirror'].includes(tool)&&targets.some(i=>{const item=objects[i];return (!axisAligned&&['hatch','ellipse'].includes(item.type))||(item.type==='hatch'&&item.hatchPattern!=='SOLID')})){status.textContent='Esta transformación aún no admite elipses giradas o este hachurado; no se modificó el dibujo';return}
  checkpoint();const created=[],copiedGroups=new Map();
  for(const idx of targets){const src=objects[idx];
   if(tool==='move'||tool==='copy'){
    if(tool==='copy'){const cp=clone(src);if(cp.groupId){if(!copiedGroups.has(cp.groupId))copiedGroups.set(cp.groupId,newGroupId());cp.groupId=copiedGroups.get(cp.groupId)}translate(cp,dx,dy);objects.push(cp);created.push(objects.length-1)}
    else translate(src,dx,dy);
   }else if(tool==='rotate'){
    const ang=Math.atan2(dy,dx),co=Math.cos(ang),si=Math.sin(ang),rotate=p=>{const x=p.x-moveBase.x,y=p.y-moveBase.y;return{x:moveBase.x+x*co-y*si,y:moveBase.y+x*si+y*co}};
    transformEntityGeometry(src,rotate,axisAligned);
   }else if(tool==='mirror'){
    const len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,mirror=p=>{const x=p.x-moveBase.x,y=p.y-moveBase.y,t=x*ux+y*uy,px=moveBase.x+t*ux,py=moveBase.y+t*uy;return{x:2*px-p.x,y:2*py-p.y}};
    transformEntityGeometry(src,mirror,axisAligned);
   }else if(tool==='scale'){
    const factor=Math.hypot(dx,dy)/scaleReference,scale=p=>({x:moveBase.x+(p.x-moveBase.x)*factor,y:moveBase.y+(p.y-moveBase.y)*factor});
    if(src.a)src.a=scale(src.a);if(src.b)src.b=scale(src.b);if(src.pts)src.pts=src.pts.map(scale);if(src.hatchLoops)src.hatchLoops=src.hatchLoops.map(loop=>loop.map(scale));if(src.type==='text'){src.textHeightWorld=Number(src.textHeightWorld||.4)*factor;if(Number(src.mtextWidthWorld)>0)src.mtextWidthWorld*=factor;if(Number(src.textFitWidthWorld)>0)src.textFitWidthWorld*=factor;if(src.textAlignmentPoint)src.textAlignmentPoint=scale(src.textAlignmentPoint)}if((src.type==='dim'||src.type==='dimaligned')&&Number.isFinite(src.dimOffset))src.dimOffset*=factor;
   }
  }
  if(tool==='copy')applySelection(created);else applySelection(targets);
  save();modifyTarget=-1;modifyTargets=[];moveBase=null;rotateRef={phase:'off',first:null,angle:0};render();updatePrompt();status.textContent=tool.toUpperCase()+' aplicado a '+targets.length+' objeto(s)';return;
 }
 if(!start){if(tool==='rect')resetRectangleDimensions();if(usesLineCoordinates())resetLineCoordinates();start=q;temp={type:tool,a:clone(q),b:clone(q),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';updatePrompt();render();return}
 let end=tool==='rect'?rectangleCorner(q):usesLineCoordinates()?coordinateCorner(q):pointFromInputs();if(!end)end=q;else if(tool!=='rect'&&document.activeElement!==$('#dynLen')&&document.activeElement!==$('#dynAngle'))end=q;
 if(!usesLineCoordinates())end=constrain(end);
 if(tool==='line'||tool==='dim'||tool==='dimaligned'||tool==='rect'||tool==='hatch'||tool==='circle'||tool==='ellipse'||tool==='polygon'){commitEntity(end)}
}
function transformEntityGeometry(s,transform,axisAligned){
 if(s.type==='rect'&&!axisAligned&&s.a&&s.b){const a=s.a,b=s.b;s.pts=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(transform);s.type='polygon';delete s.a;delete s.b;return}
 const oldAnchor=s.a?clone(s.a):null,oldRotation=Number(s.textRotation||0);if(s.a)s.a=transform(s.a);if(s.b)s.b=transform(s.b);if(s.pts)s.pts=s.pts.map(transform);if(s.hatchLoops)s.hatchLoops=s.hatchLoops.map(loop=>loop.map(transform));if(s.textAlignmentPoint)s.textAlignmentPoint=transform(s.textAlignmentPoint);if(s.type==='text'&&oldAnchor){const rad=oldRotation*Math.PI/180,baseEnd=transform({x:oldAnchor.x+Math.cos(rad),y:oldAnchor.y+Math.sin(rad)}),newAnchor=s.a||transform(oldAnchor);s.textRotation=Math.atan2(baseEnd.y-newAnchor.y,baseEnd.x-newAnchor.x)*180/Math.PI}
}
function translate(s,dx,dy){if(s.a){s.a.x+=dx;s.a.y+=dy}if(s.textAlignmentPoint){s.textAlignmentPoint.x+=dx;s.textAlignmentPoint.y+=dy}if(s.b){s.b.x+=dx;s.b.y+=dy}if(s.pts)s.pts.forEach(p=>{p.x+=dx;p.y+=dy});if(s.hatchLoops)s.hatchLoops.forEach(loop=>loop.forEach(p=>{p.x+=dx;p.y+=dy}))}
function entitySegments(s){
 const pts=[];
 if(s.type==='dim'||s.type==='dimaligned'){const g=dimensionGeometry(s);return g?[[s.a,g.a],[s.b,g.b],[g.a,g.b]]:[]}
 if(s.type==='line'||s.type==='leader'){if(s.a&&s.b)pts.push([s.a,s.b]);return pts}
 if(s.type==='rect'||s.type==='hatch'){const a=s.a,b=s.b;return [[a,{x:b.x,y:a.y}],[{x:b.x,y:a.y},b],[b,{x:a.x,y:b.y}],[{x:a.x,y:b.y},a]]}
 if(s.type==='circle'){const r=distance(s.a,s.b);let prev=null;for(let i=0;i<=72;i++){const t=i*Math.PI*2/72,p={x:s.a.x+r*Math.cos(t),y:s.a.y+r*Math.sin(t)};if(prev)pts.push([prev,p]);prev=p}return pts}
 if(s.type==='ellipse'){let prev=null;for(let i=0;i<=64;i++){const t=i*Math.PI*2/64,p={x:s.a.x+(s.b.x-s.a.x)*Math.cos(t),y:s.a.y+(s.b.y-s.a.y)*Math.sin(t)};if(prev)pts.push([prev,p]);prev=p}return pts}
 if(s.type==='arc'&&s.pts?.length>=3){const g=arcParams(s.pts);let prev=null;for(let i=0;i<=48;i++){let p;if(g){const span=g.anticlockwise?-((g.a1-g.a3+Math.PI*2)%(Math.PI*2)):((g.a3-g.a1+Math.PI*2)%(Math.PI*2)),t=g.a1+span*i/48;p=world({x:g.x+g.r*Math.cos(t),y:g.y+g.r*Math.sin(t)})}else{const t=i/48,u=1-t,a=s.pts[0],b=s.pts[1],d=s.pts[2];p={x:u*u*a.x+2*u*t*b.x+t*t*d.x,y:u*u*a.y+2*u*t*b.y+t*t*d.y}}if(prev)pts.push([prev,p]);prev=p}return pts}
 if(s.hatchLoops?.length){for(const loop of s.hatchLoops)for(let i=0;i<loop.length;i++)pts.push([loop[i],loop[(i+1)%loop.length]]);return pts}
 if(s.pts&&s.pts.length>1){for(let i=1;i<s.pts.length;i++)pts.push([s.pts[i-1],s.pts[i]]);if(s.type==='polygon')pts.push([s.pts[s.pts.length-1],s.pts[0]])}
 return pts
}
function inSelectionRect(p,r){return p.x>=r.left-1e-8&&p.x<=r.right+1e-8&&p.y>=r.bottom-1e-8&&p.y<=r.top+1e-8}
function segmentHitsRect(a,b,r){
 let t0=0,t1=1,dx=b.x-a.x,dy=b.y-a.y;
 const tests=[[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.bottom],[dy,r.top-a.y]];
 for(const [p,q] of tests){if(Math.abs(p)<1e-12){if(q<0)return false;continue}const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}
 return true
}
function pointInPolygon(p,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y||1e-12)+a.x))inside=!inside}return inside}
function objectContainsPoint(s,p){
 if(s.type==='hatch')return p.x>=Math.min(s.a.x,s.b.x)&&p.x<=Math.max(s.a.x,s.b.x)&&p.y>=Math.min(s.a.y,s.b.y)&&p.y<=Math.max(s.a.y,s.b.y);
 return false
}
function selectByWindow(rect,windowMode){
 const hits=[];
 for(let i=0;i<objects.length;i++){
  const s=objects[i];if(!isVisibleModelEntity(s)||lockedLayers.has(s.layer))continue;
  const segs=entitySegments(s),pts=[];
  if(s.type==='text')pts.push(...cadTextBoundsWorld(s));
  else if(segs.length){for(const [a,b] of segs)pts.push(a,b)}
  else {if(s.a)pts.push(s.a);if(s.b)pts.push(s.b);if(s.pts)pts.push(...s.pts)}
  if(!pts.length)continue;
  const fully=pts.every(p=>inSelectionRect(p,rect));
  if(windowMode){if(fully)hits.push(i);continue}
  const vertexHit=pts.some(p=>inSelectionRect(p,rect));
  const edgeHit=segs.some(([a,b])=>segmentHitsRect(a,b,rect));
  const center={x:(rect.left+rect.right)/2,y:(rect.bottom+rect.top)/2};
  if(s.type==='text'){
   const bounds=cadTextBoundsWorld(s),rectCorners=[{x:rect.left,y:rect.bottom},{x:rect.right,y:rect.bottom},{x:rect.right,y:rect.top},{x:rect.left,y:rect.top}],textEdgeHit=bounds.some((p,j)=>segmentHitsRect(p,bounds[(j+1)%bounds.length],rect)),rectCornerHit=rectCorners.some(p=>pointInPolygon(p,bounds));
   if(vertexHit||textEdgeHit||rectCornerHit||pointInPolygon(center,bounds))hits.push(i);
   continue;
  }
  if(vertexHit||edgeHit||objectContainsPoint(s,center))hits.push(i);
 }
 return hits
}
function lineIntersection(a,b,c,d,segments=true){
 const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
 if(Math.abs(den)<1e-10)return null;
 const qx=c.x-a.x,qy=c.y-a.y,t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
 if(segments&&(t< -1e-8||t>1+1e-8||u< -1e-8||u>1+1e-8))return null;
 return {x:a.x+t*rx,y:a.y+t*ry,t,u};
}
function filletGeometry(first,second,pick1,pick2,radius){
 if(!first||!second||first.type!=='line'||second.type!=='line'||!Number.isFinite(radius)||radius<0)return null;
 const intersection=lineIntersection(first.a,first.b,second.a,second.b,false);if(!intersection)return null;
 const p={x:intersection.x,y:intersection.y};
 const branch=(line,pick)=>{
  const va={x:line.a.x-p.x,y:line.a.y-p.y},vb={x:line.b.x-p.x,y:line.b.y-p.y},vq={x:pick.x-p.x,y:pick.y-p.y};
  const dot=v=>v.x*vq.x+v.y*vq.y;
  const keep=Math.hypot(vq.x,vq.y)<1e-9?(Math.hypot(va.x,va.y)>=Math.hypot(vb.x,vb.y)?'a':'b'):(dot(va)>=dot(vb)?'a':'b'),v=keep==='a'?va:vb,len=Math.hypot(v.x,v.y);
  return len>1e-9?{keep,replace:keep==='a'?'b':'a',unit:{x:v.x/len,y:v.y/len},len}:null;
 };
 const a=branch(first,pick1),b=branch(second,pick2);if(!a||!b)return null;
 const dot=Math.max(-1,Math.min(1,a.unit.x*b.unit.x+a.unit.y*b.unit.y)),theta=Math.acos(dot);
 if(theta<1e-6||Math.PI-theta<1e-6)return null;
 if(radius===0)return {a,b,t1:p,t2:p,arc:null};
 const t=radius/Math.tan(theta/2);if(!Number.isFinite(t)||t>=a.len-1e-9||t>=b.len-1e-9)return null;
 const t1={x:p.x+a.unit.x*t,y:p.y+a.unit.y*t},t2={x:p.x+b.unit.x*t,y:p.y+b.unit.y*t};
 const bis={x:a.unit.x+b.unit.x,y:a.unit.y+b.unit.y},bl=Math.hypot(bis.x,bis.y),cl=radius/Math.sin(theta/2);
 const center={x:p.x+bis.x/bl*cl,y:p.y+bis.y/bl*cl};
 const mx=t1.x+t2.x-2*center.x,my=t1.y+t2.y-2*center.y,ml=Math.hypot(mx,my);if(ml<1e-9)return null;
 const mid={x:center.x+radius*mx/ml,y:center.y+radius*my/ml};
 return {a,b,t1,t2,arc:[t1,mid,t2]};
}
function chamferGeometry(first,second,pick1,pick2,distance1,distance2){
 if(!first||!second||first.type!=='line'||second.type!=='line'||!Number.isFinite(distance1)||!Number.isFinite(distance2)||distance1<=0||distance2<=0)return null;
 const intersection=lineIntersection(first.a,first.b,second.a,second.b,false);if(!intersection)return null;
 const p={x:intersection.x,y:intersection.y};
 const branch=(line,pick)=>{
  const va={x:line.a.x-p.x,y:line.a.y-p.y},vb={x:line.b.x-p.x,y:line.b.y-p.y},vq={x:pick.x-p.x,y:pick.y-p.y};
  const dot=v=>v.x*vq.x+v.y*vq.y;
  const keep=Math.hypot(vq.x,vq.y)<1e-9?(Math.hypot(va.x,va.y)>=Math.hypot(vb.x,vb.y)?'a':'b'):(dot(va)>=dot(vb)?'a':'b');
  const v=keep==='a'?va:vb,len=Math.hypot(v.x,v.y);
  return len>1e-9?{keep,replace:keep==='a'?'b':'a',unit:{x:v.x/len,y:v.y/len},len}:null;
 };
 const a=branch(first,pick1),b=branch(second,pick2);
 if(!a||!b||distance1>=a.len-1e-9||distance2>=b.len-1e-9)return null;
 return {a,b,t1:{x:p.x+a.unit.x*distance1,y:p.y+a.unit.y*distance1},t2:{x:p.x+b.unit.x*distance2,y:p.y+b.unit.y*distance2}};
}
function quickTrim(index,pick){
 const shape=objects[index];if(!shape||shape.type!=='line'){status.textContent='RECORTAR rápido admite líneas; otras entidades aún no son compatibles';return}
 const a=shape.a,b=shape.b,dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18){status.textContent='Línea sin longitud';return}
 const t=Math.max(0,Math.min(1,((pick.x-a.x)*dx+(pick.y-a.y)*dy)/den)),cuts=[0,1];
 objects.forEach((other,i)=>{if(i===index||!isVisibleModelEntity(other)||(trimState.phase==='cut'&&!trimState.boundaries.has(other)))return;for(const [c,d] of entitySegments(other)){const h=lineIntersection(a,b,c,d,true);if(h&&h.t>1e-8&&h.t<1-1e-8)cuts.push(h.t)}});
 cuts.sort((x,y)=>x-y);const bounds=cuts.filter((x,i)=>i===0||Math.abs(x-cuts[i-1])>1e-8);if(bounds.length<3){status.textContent='No hay un borde de corte que cruce esta línea';return}
 if(bounds.some(x=>Math.abs(x-t)<1e-7)){status.textContent='Toca un tramo, no exactamente la intersección';return}
 let n=0;while(n<bounds.length-2&&t>bounds[n+1])n++;const lo=bounds[n],hi=bounds[n+1],point=v=>({x:a.x+dx*v,y:a.y+dy*v}),pieces=[];
 if(lo>1e-8)pieces.push({...clone(shape),a:clone(a),b:point(lo)});if(hi<1-1e-8)pieces.push({...clone(shape),a:point(hi),b:clone(b)});
 checkpoint();objects.splice(index,1,...pieces);clearSelection();save();render();status.textContent='Tramo recortado · toca otro tramo o pulsa Esc';
}
function trimOrExtend(index,q,mode){
 const s=objects[index];if(!s||s.type!=='line'){status.textContent=mode.toUpperCase()+' en esta alfa requiere una línea';return}
 const endpoint=distance(q,s.a)<=distance(q,s.b)?'a':'b',a=s.a,b=s.b,other=[];
 objects.forEach((o,i)=>{if(i!==index)entitySegments(o).forEach(seg=>other.push(seg))});
 const hits=[];
 for(const [c,d] of other){const h=lineIntersection(a,b,c,d,mode==='trim');if(!h||distance(h,endpoint==='a'?a:b)<1e-6)continue;
  if(mode==='extend'&&(h.u< -1e-8||h.u>1+1e-8||(endpoint==='a'?h.t>=0:h.t<=1)))continue;
  hits.push(h);
 }
 if(!hits.length){status.textContent='No se encontró una intersección compatible';return}
 hits.sort((x,y)=>distance(x,endpoint==='a'?a:b)-distance(y,endpoint==='a'?a:b));
 checkpoint();s[endpoint]={x:hits[0].x,y:hits[0].y};save();applySelection([index]);modifyTarget=-1;render();status.textContent=mode.toUpperCase()+' aplicado';
}
function explodeSelection(indices){
 const ids=[...new Set(indices)].filter(i=>objects[i]&&isVisibleModelEntity(objects[i])&&!lockedLayers.has(objects[i].layer));
 const groups=new Set(ids.map(i=>objects[i].groupId).filter(Boolean));
 // A block spanning a locked layer cannot be partially broken apart.
 for(const id of [...groups])if(objects.some(o=>o.groupId===id&&lockedLayers.has(o.layer)))groups.delete(id);
 const groupMembers=objects.map((o,i)=>groups.has(o.groupId)?i:-1).filter(i=>i>=0);
 const simple=ids.filter(i=>!objects[i].groupId&&['poly','polygon','rect'].includes(objects[i].type)&&entitySegments(objects[i]).length);
 if(!groupMembers.length&&!simple.length){status.textContent='EXPLODE: selecciona bloques, polilíneas, polígonos o rectángulos desbloqueados';return false}
 checkpoint();groupMembers.forEach(i=>delete objects[i].groupId);
 let count=groupMembers.length;
 for(const i of simple.sort((a,b)=>b-a)){const item=objects[i],parts=entitySegments(item).map(([a,b])=>({type:'line',a:clone(a),b:clone(b),layer:item.layer,color:item.color,lineweight:item.lineweight,linetype:item.linetype,cadLayout:item.cadLayout}));objects.splice(i,1,...parts);count+=parts.length}
 clearSelection();save();render();status.textContent='EXPLODE · '+count+' elementos editables';return true
}
function explodeAt(q){const i=selectAt(q);if(i<0){status.textContent='EXPLODE · selecciona un bloque o polilínea';return}explodeSelection([i])}

let pointers=new Map(),pinch=null,selectionStart=null,selectionBox=null,selectionAdditive=false,multiSelectOn=false,gripDrag=null,middlePan=null,selectionClickAnchor=null;
function closeBlockEditing(){if(!editingBlockId)return;editingBlockId=null;blockEditButton.hidden=true;clearSelection();setTool('select');status.textContent='Edición del bloque finalizada';render()}
function editBlock(index){const id=objects[index]?.groupId;if(!id){status.textContent='Selecciona un bloque para editar';return}if(objects.some(o=>o.groupId===id&&lockedLayers.has(o.layer))){status.textContent='Desbloquea las capas del bloque antes de editarlo';return}editingBlockId=id;clearSelection();setTool('select');blockEditButton.hidden=false;status.textContent='Edición de bloque: selecciona sus elementos individualmente · pulsa Finalizar bloque';render()}
const blockEditButton=document.createElement('button');blockEditButton.type='button';blockEditButton.textContent='✓ Finalizar bloque';blockEditButton.hidden=true;blockEditButton.style.cssText='position:absolute;top:10px;right:10px;z-index:35;padding:8px 12px;background:#175bea;color:white;border:0;border-radius:6px;cursor:pointer';blockEditButton.onclick=closeBlockEditing;stage.appendChild(blockEditButton);


stage.setAttribute('tabindex','-1');
const commandUiStyle=document.createElement('style');
commandUiStyle.textContent='#otrocad-cursor-command{position:absolute;z-index:40;display:flex;align-items:center;gap:8px;max-width:300px;padding:7px 10px;border:1px solid #6b91c7;border-radius:6px;background:rgba(12,30,54,.96);color:#f5f8ff;box-shadow:0 6px 22px #0008;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;pointer-events:none;transform:translate(14px,14px);white-space:nowrap}#otrocad-cursor-command[hidden],#otrocad-context-menu[hidden]{display:none!important}#otrocad-cursor-command .cmd-tag{padding:3px 5px;border-radius:3px;background:#ffcf23;color:#173665;font:800 10px system-ui;letter-spacing:.5px}#otrocad-cursor-command .cmd-value{overflow:hidden;text-overflow:ellipsis}#otrocad-context-menu{position:fixed;z-index:99999;display:grid;gap:2px;min-width:245px;max-width:min(290px,calc(100vw - 16px));padding:6px;border:1px solid #b9cbe7;border-radius:8px;background:#f8faff;color:#173665;box-shadow:0 14px 42px #061b3d55;font:13px Inter,system-ui,Arial}#otrocad-context-menu .cad-menu-title{padding:7px 9px 8px;color:#6980a3;font-size:10px;font-weight:850;letter-spacing:.8px}#otrocad-context-menu .cad-menu-item{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;min-height:34px;padding:7px 9px;border:0;border-radius:5px;background:transparent;color:#173665;text-align:left;font:600 12px Inter,system-ui,Arial}#otrocad-context-menu .cad-menu-item:hover:not(:disabled){background:#e8f0ff;color:#185be8}#otrocad-context-menu .cad-menu-item:disabled{opacity:.38;cursor:default}#otrocad-context-menu .cad-menu-hint{color:#7185a4;font-size:10px;font-weight:500}#otrocad-context-menu .cad-menu-sep{height:1px;margin:4px 3px;background:#dbe5f4}#otrocad-context-menu .cad-menu-item.primary{background:#eaf1ff;color:#185be8;font-weight:800}#stage:focus{outline:none}';
document.head.append(commandUiStyle);
cursorCommandEl=document.createElement('div');
cursorCommandEl.id='otrocad-cursor-command';
cursorCommandEl.hidden=true;
cursorCommandEl.innerHTML='<span class="cmd-tag">CMD</span><span class="cmd-value"></span>';
stage.append(cursorCommandEl);
contextMenuEl=document.createElement('div');
contextMenuEl.id='otrocad-context-menu';
contextMenuEl.hidden=true;
contextMenuEl.setAttribute('role','menu');
document.body.append(contextMenuEl);
try{lastCommand=localStorage.getItem('otrocad-last-command')||''}catch(e){}
function updateTrimPanel(activeTool){
 const panel=document.getElementById('trimOptions');if(!panel)return;
 panel.hidden=activeTool!=='trim';if(panel.hidden)return;
 const detail=panel.querySelector('.trim-detail');if(detail)detail.textContent=trimState.phase==='boundaries'?'Selecciona bordes ('+trimState.boundaries.size+') y pulsa Listo':trimState.phase==='cut'?'Toca el tramo · bordes seleccionados: '+trimState.boundaries.size:'Toca el tramo · todos los bordes visibles';
}
function finishTrimBoundaries(){
 if(trimState.boundaries.size){trimState.phase='cut';status.textContent='TRIM: toca el tramo que deseas quitar'}
 else{trimState.phase='quick';status.textContent='TRIM rápido: todos los bordes visibles'}
 clearSelection();updateTrimPanel('trim');render();
}
const trimPanel=document.getElementById('trimOptions');
if(trimPanel){
 trimPanel.querySelector('[data-trim="quick"]').onclick=()=>{trimState={phase:'quick',boundaries:new Set()};clearSelection();updateTrimPanel('trim');render();status.textContent='TRIM rápido: toca el tramo'};
 trimPanel.querySelector('[data-trim="edges"]').onclick=()=>{trimState={phase:'boundaries',boundaries:new Set()};clearSelection();updateTrimPanel('trim');render();status.textContent='TRIM: selecciona bordes y pulsa Listo o Enter'};
 trimPanel.querySelector('[data-trim="done"]').onclick=finishTrimBoundaries;
 trimPanel.querySelector('[data-trim="exit"]').onclick=()=>setTool('select');
}
function updateCursorCommand(){
 const value=$('#cmd').value.trim();
 if(tool==='offset'&&offsetAwaitingDistance){cursorCommandEl.hidden=true;return}
 if(!value&&tool!=='trim'&&tool!=='extend'&&tool!=='offset'){cursorCommandEl.hidden=true;return}
 cursorCommandEl.hidden=false;
 const maxX=Math.max(8,stage.clientWidth-210),maxY=Math.max(8,stage.clientHeight-42);
 cursorCommandEl.style.left=Math.max(8,Math.min(cursor.x+12,maxX))+'px';
 cursorCommandEl.style.top=Math.max(8,Math.min(cursor.y+12,maxY))+'px';
 cursorCommandEl.querySelector('.cmd-value').textContent=value||(tool==='offset'?(selected<0?'Selecciona objeto · ':'Indica lado · ')+offsetDistance+' '+units:tool==='trim'?'Toca para recortar · Shift + clic: alargar':'Toca el extremo para alargar');
}
function hideCadContextMenu(){if(contextMenuEl)contextMenuEl.hidden=true}
function addCadMenuDivider(){const line=document.createElement('div');line.className='cad-menu-sep';contextMenuEl.append(line)}
function addCadMenuItem(label,hint,action,disabled=false,primary=false){
 const b=document.createElement('button');b.type='button';b.className='cad-menu-item'+(primary?' primary':'');b.disabled=!!disabled;b.setAttribute('role','menuitem');
 const name=document.createElement('span');name.textContent=label;
 const key=document.createElement('span');key.className='cad-menu-hint';key.textContent=hint||'';
 b.append(name,key);
 b.addEventListener('click',()=>{hideCadContextMenu();if(!b.disabled){action();stage.focus({preventScroll:true})}});
 contextMenuEl.append(b);
}
function cancelCurrentAction(){
 $('#cmd').value='';updateCursorCommand();
 hideCadContextMenu();setTool('select');selectionStart=null;selectionBox=null;selectionClickAnchor=null;activeSnap=null;
 render();updatePrompt();status.textContent='Comando cancelado · modo SELECCIÓN (ventana y cruce)';
}
function performEnterAction(){
 if(tool==='offset'&&offsetAwaitingDistance){acceptOffsetDistance($('#dynLen').value);return}
 if(tool==='trim'&&trimState.phase==='boundaries'&&!$('#cmd').value.trim()){finishTrimBoundaries();return}
 if(tool==='scale'&&!$('#cmd').value.trim()){status.textContent=moveBase?'ESCALAR: escribe factor o indica punto destino':(selectedItems().length?'ESCALAR: indica punto base':'ESCALAR: selecciona los objetos');return}
 if(['move','copy'].includes(tool)&&!$('#cmd').value.trim()){status.textContent=moveBase?'Indica el punto destino con un clic o coordenadas':(selectedItems().length?'Indica el punto base con un clic o coordenadas':'Selecciona el objeto por el punto base');updatePrompt();return}
 if(tool==='rect'&&start&&dynamicInputOn){const point=pointFromInputs();if(point)commitEntity(point);else status.textContent='Rectángulo: indica ancho y alto válidos';return}
 if(selectionClickAnchor){selectionClickAnchor=null;selectionStart=null;selectionBox=null;render();status.textContent='Ventana de selección terminada';return}
 const raw=$('#cmd').value.trim();
 if(raw){$('#cmd').value='';updateCursorCommand();runCommand(raw);return}
 if(poly.length){if(finishPoly()){setTool('select');status.textContent='Polilínea terminada · Enter o espacio para repetir'}return}
 if(tool==='line'&&start){start=null;temp=null;setTool('select');status.textContent='Línea terminada · Enter o espacio para repetir LÍNEA';return}
 if(start){
  let q=pointFromInputs();
  if(q&&distance(start,q)<=1e-9)q=null;
  if(!q&&temp&&temp.b&&distance(start,temp.b)>1e-9)q=round(temp.b);
  if(q){commitEntity(q);return}
  status.textContent='Indica el punto final o introduce longitud y ángulo';return;
 }
 if(arcPoints.length){status.textContent='Arco: marca el siguiente punto o pulsa Escape para cancelar';return}
 if(tool!=='select'&&tool!=='pan'){setTool('select');status.textContent='Comando terminado · Enter o espacio para repetir';return}
 if(lastCommand){runCommand(lastCommand);return}
 status.textContent='Modo SELECCIÓN';
}
function submitCommand(){
 const raw=$('#cmd').value.trim();
 if(raw){$('#cmd').value='';updateCursorCommand();runCommand(raw);return}
 performEnterAction();
}
function showCadKeyboardHelp(){
 let dlg=document.getElementById('cadKeyboardHelp');
 if(!dlg){
  dlg=document.createElement('dialog');
  dlg.id='cadKeyboardHelp';dlg.className='cad-utility-dialog cad-shortcut-help';
  dlg.innerHTML='<h3>⌨ OtroCAD · Atajos de teclado</h3>'+
   '<p>Escribe el comando con el lienzo activo y pulsa Enter o Espacio. '+
   'En el campo CMD, usa espacios para separar parámetros.</p>'+
   '<div class="cad-help-grid">'+
   '<div><b>Dibujo</b><span>L, PL, C, A, REC, H, T</span></div>'+
   '<div><b>Modificar</b><span>M, CO / CP, O, TR, EX, RO, MI, SC, F, CHA, X, E</span></div>'+
   '<div><b>Vista y precisión</b><span>RE / REGEN, Z E, PAN, DS / HP, F3, F7, F8, F9, F10, F12</span></div>'+
   '<div><b>Archivo</b><span>Ctrl+S DWG · Ctrl+O abrir · Ctrl+N nuevo · Ctrl+P imprimir · Ctrl+Shift+E DXF</span></div>'+
   '<div><b>Edición</b><span>Ctrl+Z deshacer · Ctrl+Y rehacer · Ctrl+1 propiedades · Esc cancelar</span></div>'+
   '<div><b>Entrada numérica</b><span>L, primer punto, mover cursor, 5 ↵ · @3,4 ↵ · @5&lt;30 ↵</span></div>'+
   '<div><b>Rectángulo</b><span>REC · primera esquina · ancho · Tab o ; · alto · Enter. También ancho;alto en CMD.</span></div>'+
   '<div><b>Offset</b><span>O · distancia · Enter · objeto · lado. Esc para terminar; O 2.5 acepta la distancia directamente.</span></div>'+
   '<div><b>Civil 3D</b><span>C3DTIN, C3DCONTOURS, C3DPROFILE, C3DSECTION, C3DVOLUME, C3DEXPORTTIN</span></div>'+
   '</div><button type="button" class="cad-shortcut-close">Cerrar</button>';
  document.body.append(dlg);
  dlg.querySelector('.cad-shortcut-close').onclick=()=>dlg.close();
 }
 dlg.showModal();
}
function repeatLastCommand(){
 if(!lastCommand){status.textContent='Todavía no hay un comando anterior';return}
 $('#cmd').value='';updateCursorCommand();runCommand(lastCommand);
}
function showCadContextMenu(e){
 e.preventDefault();
 contextMenuEl.innerHTML='<div class="cad-menu-title">OTROCAD · MENÚ CONTEXTUAL</div>';
 const raw=$('#cmd').value.trim();
 const enterLabel=raw?'Ejecutar comando':(poly.length?'Enter · Terminar polilínea':(tool==='line'&&start?'Enter · Terminar línea':(start?'Enter · Confirmar punto':'Enter · Repetir comando')));
 addCadMenuItem(enterLabel,'↵',performEnterAction,!raw&&!poly.length&&!start&&!lastCommand,true);
 addCadMenuItem('Repetir último comando',lastCommand||'—',repeatLastCommand,!lastCommand);
 addCadMenuDivider();
 addCadMenuItem('Salir del comando · Seleccionar','Esc',cancelCurrentAction,false);
 addCadMenuItem('Configurar clic derecho','⚙',showDraftSettings);
 addCadMenuItem('Deshacer','Ctrl + Z',()=>$('#undo').click(),!undo.length);
 addCadMenuItem('Rehacer','Ctrl + Y',()=>$('#redo').click(),!redo.length);
 addCadMenuDivider();
 addCadMenuItem('Eliminar selección','Supr',()=>{deleteSelection();showProperties()},!selectedItems().length);
 addCadMenuItem('Seleccionar todo','Ctrl + A',()=>{applySelection(objects.map((_,i)=>i));showProperties();render()},!objects.length);
 addCadMenuItem('Propiedades','Ctrl + 1',()=>{$('#properties').classList.toggle('open');showProperties()});
 addCadMenuItem('Encuadrar dibujo','Zoom ext.',()=>$('#fit').click());
 addCadMenuItem('Activar encuadre','PAN',()=>setTool('pan'));
 contextMenuEl.hidden=false;
 const rect=contextMenuEl.getBoundingClientRect();
 contextMenuEl.style.left=Math.max(8,Math.min(e.clientX,window.innerWidth-rect.width-8))+'px';
 contextMenuEl.style.top=Math.max(8,Math.min(e.clientY,window.innerHeight-rect.height-8))+'px';
}
$('#cmd').addEventListener('input',updateCursorCommand);
applyCanvasTheme(cadTheme);
$('#canvasTheme').addEventListener('change',e=>applyCanvasTheme(e.target.value));$('#canvasTheme').value=cadTheme;
$('#cmd').addEventListener('keydown',e=>{
 // Space must remain a valid separator in commands such as OFFSET 2.5 and ZOOM E.
 if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();submitCommand();$('#cmd').blur()}
 else if(e.key==='Escape'){e.preventDefault();cancelCurrentAction();$('#cmd').blur();stage.focus({preventScroll:true})}
});
$('#cmdRun').addEventListener('click',()=>{submitCommand();$('#cmd').blur()});
$('#keyboardHelpBtn').addEventListener('click',showCadKeyboardHelp);
$('#rotateRefBtn').addEventListener('click',()=>runCommand('R'));
$('#smartPurge').addEventListener('click',showSmartPurge);
$('#regenView').addEventListener('click',()=>{resize();status.textContent='REGEN · vista regenerada sin modificar el dibujo'});
document.addEventListener('pointerdown',e=>{if(contextMenuEl&&!contextMenuEl.contains(e.target))hideCadContextMenu()});
contextMenuEl.addEventListener('contextmenu',e=>e.preventDefault());

canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='touch')e.preventDefault();
 if(activeLayout!=='Model'){e.preventDefault();return}
 if(e.button===1){e.preventDefault();hideCadContextMenu();middlePan={pointerId:e.pointerId,point:pointer(e),offset:clone(offset)};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';status.textContent='PAN temporal · arrastra con la rueda presionada';return}
 if(e.button===2){e.preventDefault();return}
 stage.focus({preventScroll:true});hideCadContextMenu();
 // Safari WebKit occasionally rejects capture during orientation changes.
 // Keep canvas gestures working even when capture cannot be established.
 if(typeof canvas.setPointerCapture==='function')try{canvas.setPointerCapture(e.pointerId)}catch(error){console.warn('Pointer capture unavailable; using canvas pointer events',error)}
 const p=pointer(e);cursor=p;pointers.set(e.pointerId,p);
 if(pointers.size===2){if(gripDrag)cancelGripDrag();const v=[...pointers.values()];pinch={dist:distance(v[0],v[1]),zoom,anchor:world({x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2})};start=null;temp=null;selectionStart=null;selectionBox=null;return}
 if(tool==='pan'){drag={point:p,offset:clone(offset)};return}
 if(tool==='select'){
  if(selectionClickAnchor){selectionStart=null;selectionBox={a:selectionClickAnchor,b:p};selectionAdditive=multiSelectOn||!!(e.shiftKey||e.ctrlKey||e.metaKey);finishSelectionWindow(selectionBox);selectionClickAnchor=null;selectionBox=null;render();return}
  const grip=findGripAt(p,e.pointerType==='touch');if(grip){checkpoint();gripDrag={...grip,pointerId:e.pointerId,before:clone(objects[grip.index]),moved:false,historyAdded:true};status.textContent='Grip activo · arrastra el punto y suelta para confirmar';render();return}selectionStart=p;selectionBox=null;selectionAdditive=multiSelectOn||!!(e.shiftKey||e.ctrlKey||e.metaKey);return}
 p.shiftForTrim=e.shiftKey;handleTap(p);
});
canvas.addEventListener('pointermove',e=>{
 if(activeLayout!=='Model')return;
 if(e.pointerType==='touch'&&pointers.has(e.pointerId))e.preventDefault();
 const p=pointer(e);
 if(middlePan&&middlePan.pointerId===e.pointerId){offset.x=middlePan.offset.x+p.x-middlePan.point.x;offset.y=middlePan.offset.y+p.y-middlePan.point.y;render();return}cursor=p;updateCursorCommand();$('#crossinfo').textContent='X '+world(p).x.toFixed(zoom>500?6:3)+' '+units+' · Y '+world(p).y.toFixed(zoom>500?6:3)+' '+units+' · Z 0.000'+(window.OtroCadGeolocation?.formatCoordinate(world(p),units)||'');
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);activeSnap=snapCandidate(world(p));if(activeSnap)status.textContent='OSNAP · '+activeSnap.type+' · clic para conectar';
 if(pointers.size===2&&pinch){const v=[...pointers.values()];zoom=Math.max(.000001,Math.min(MAX_MODEL_ZOOM,pinch.zoom*distance(v[0],v[1])/(pinch.dist||1)));const mid={x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2};offset.x=mid.x-canvas.clientWidth/2-pinch.anchor.x*zoom;offset.y=mid.y-canvas.clientHeight/2+pinch.anchor.y*zoom;render();return}
 if(drag&&tool==='pan'){offset.x=drag.offset.x+p.x-drag.point.x;offset.y=drag.offset.y+p.y-drag.point.y;render();return}
 if(gripDrag){
  if(e.pointerId!==gripDrag.pointerId)return;
  const s=objects[gripDrag.index];
  if(s){applyGrip(s,gripDrag.key,snapPoint(world(p),gripDrag.index));gripDrag.moved=true;render()}
  return
 }
 if(selectionClickAnchor){selectionBox={a:selectionClickAnchor,b:p};render();return}
 if(selectionStart){if(distance(selectionStart,p)>4)selectionBox={a:selectionStart,b:p};render();return}
 if(tool==='poly'&&poly.length){let q=constrain(snapPoint(world(p)));if(usesLineCoordinates())q=coordinateCorner(q);temp={type:'line',a:clone(poly[poly.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(tool==='arc'&&arcPoints.length){const q=snapPoint(world(p));temp={type:'line',a:clone(arcPoints[arcPoints.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(start){let q=constrain(snapPoint(world(p)));if(tool==='rect')q=rectangleCorner(q);if(usesLineCoordinates())q=coordinateCorner(q);temp={type:tool==='measure'?'line':tool,a:clone(start),b:q,...currentStyle($('#layer').value)};render()}
 else render();
});
function finishSelectionWindow(box){
 const a=box.a,b=box.b,wa=world(a),wb=world(b),rect={left:Math.min(wa.x,wb.x),right:Math.max(wa.x,wb.x),bottom:Math.min(wa.y,wb.y),top:Math.max(wa.y,wb.y)};
 const windowMode=b.x>=a.x,hits=selectByWindow(rect,windowMode);applySelection(hits,selectionAdditive);showProperties();status.textContent=hits.length+' objeto(s) seleccionados · '+(windowMode?'VENTANA':'CRUCE');
}
function pointerEnd(e){
 if(e.pointerType==='touch')e.preventDefault();
 if(middlePan&&middlePan.pointerId===e.pointerId){middlePan=null;canvas.style.cursor=crossOn?'none':'crosshair';status.textContent='PAN finalizado · herramienta anterior conservada';render();return}
 pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
 if(e.type==='pointercancel'){if(gripDrag&&e.pointerId===gripDrag.pointerId){cancelGripDrag();return}selectionStart=null;selectionBox=null;render();return}
 if(gripDrag){if(e.pointerId!==gripDrag.pointerId)return;if(gripDrag.moved){save();status.textContent='Grip actualizado · geometría modificada';showProperties()}else if(gripDrag.historyAdded&&undo.length)undo.pop();gripDrag=null;render();return}
 if(selectionStart){
  if(selectionBox){finishSelectionWindow(selectionBox);
  }else if(selectAt(world(selectionStart))<0){
   selectionClickAnchor=selectionStart;selectionBox={a:selectionClickAnchor,b:selectionClickAnchor};status.textContent='Primer punto · marca esquina opuesta o Enter/Espacio para salir';
  }else{
   const hit=selectAt(world(selectionStart));if(selectionAdditive){const ids=new Set(selectedItems());if(hit>=0){if(ids.has(hit))ids.delete(hit);else ids.add(hit)}applySelection([...ids])}else applySelection(hit>=0?[hit]:[]);
   status.textContent=hit>=0?'Objeto seleccionado · arrastra un grip cuadrado para editar':(selectionAdditive?'Selección conservada':'Selección vacía');
  }
  selectionStart=null;selectionBox=null;showProperties();
 }
 if(drag&&tool==='pan')drag=null;
 render();
}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('dblclick',e=>{if(activeLayout!=='Model')return;const p=pointer(e),hit=selectAt(world(p));if(hit>=0&&objects[hit]?.groupId&&objects[hit].groupId!==editingBlockId){e.preventDefault();editBlock(hit);return}if(hit>=0&&objects[hit]?.type==='text'){e.preventDefault();applySelection([hit]);showProperties();openTextEditor(hit)}});
canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
canvas.addEventListener('contextmenu',e=>{
 e.preventDefault();
 const hasActiveCommand=!!($('#cmd').value.trim()||poly.length||start||arcPoints.length||(tool!=='select'&&tool!=='pan'));
 if(e.ctrlKey){showDraftSettings();return}
 if(e.shiftKey){showCadContextMenu(e);return}
 if(hasActiveCommand&&rightClickDuringCommand==='enter'){hideCadContextMenu();performEnterAction();return}
 if(!hasActiveCommand&&rightClickDuringCommand==='enter'&&rightClickMode==='repeat'){hideCadContextMenu();repeatLastCommand();return}
 if(!hasActiveCommand&&rightClickMode==='repeat'){hideCadContextMenu();repeatLastCommand();return}
 showCadContextMenu(e);
});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(activeLayout!=='Model')return;const p=pointer(e),before=world(p);zoom=Math.max(.000001,Math.min(MAX_MODEL_ZOOM,zoom*(e.deltaY<0?1.12:.89)));const after=screen(before);offset.x+=p.x-after.x;offset.y+=p.y-after.y;render()},{passive:false});
function updateToggle(id,on){$(id).classList.toggle('active',on);if(id==='#crossToggle')canvas.style.cursor=on?'none':'crosshair'}
function toggle(id){const map={gridToggle:'gridOn',orthoToggle:'orthoOn',snapToggle:'snapOn',polarToggle:'polarOn',osnapToggle:'osnapOn',crossToggle:'crossOn'};const k=map[id];if(k==='gridOn')gridOn=!gridOn;if(k==='orthoOn')orthoOn=!orthoOn;if(k==='snapOn')snapOn=!snapOn;if(k==='polarOn')polarOn=!polarOn;if(k==='osnapOn')osnapOn=!osnapOn;if(k==='crossOn')crossOn=!crossOn;const values={gridOn,orthoOn,snapOn,polarOn,osnapOn,crossOn};updateToggle('#'+id,values[k]);saveDraftPreferences();render()}
[['gridToggle',gridOn],['orthoToggle',orthoOn],['snapToggle',snapOn],['polarToggle',polarOn],['osnapToggle',osnapOn],['crossToggle',crossOn]].forEach(([id,on])=>updateToggle('#'+id,on));
['gridToggle','orthoToggle','snapToggle','polarToggle','osnapToggle','crossToggle'].forEach(id=>$('#'+id).onclick=()=>toggle(id));
$('#multiSelectToggle').onclick=()=>{multiSelectOn=!multiSelectOn;$('#multiSelectToggle').querySelector('.multi-state').textContent=multiSelectOn?'ON':'OFF';$('#multiSelectToggle').setAttribute('aria-pressed',String(multiSelectOn));$('#multiSelectToggle').classList.toggle('active',multiSelectOn);status.textContent='Selección múltiple '+(multiSelectOn?'activada':'desactivada')};
document.addEventListener('keydown',e=>{
 if(!contextMenuEl.hidden&&e.key==='Escape'){e.preventDefault();hideCadContextMenu();return}
 const active=document.activeElement;
 if(document.querySelector('dialog[open]'))return;
 if((e.ctrlKey||e.metaKey)&&!e.altKey){
  const k=e.key.toLowerCase();
  const shortcut={s:e.shiftKey?'#saveAs':'#save',o:'#open',n:'#newDrawing',p:'#pdf'}[k];
  if(shortcut){e.preventDefault();$(shortcut).click();return}
  if(k==='1'){e.preventDefault();$('#propertiesBtn').click();return}
  if(k==='e'&&e.shiftKey){e.preventDefault();$('#saveAsDxf').click();return}
 }
 if(handleCursorDimensionKey(e,active))return;
 if(['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)){
  if(e.key==='Enter'&&active.id==='dynLen'){e.preventDefault();$('#dynAngle').focus()}
  else if(e.key==='Enter'&&active.id==='dynAngle'){e.preventDefault();const q=pointFromInputs();if(q){if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)}}
  return;
 }
 if(e.key==='Escape'){e.preventDefault();cancelCurrentAction();return}
 if(e.key==='Backspace'&&$('#cmd').value){e.preventDefault();$('#cmd').value=$('#cmd').value.slice(0,-1);updateCursorCommand();return}
 if(e.key==='Delete'||e.key==='Backspace'){if(selectedItems().length){e.preventDefault();deleteSelection();showProperties();return}}
 if(e.key==='F7'){e.preventDefault();toggle('gridToggle');return}
 if(e.key==='F8'){e.preventDefault();toggle('orthoToggle');return}
 if(e.key==='F9'){e.preventDefault();toggle('snapToggle');return}
 if(e.key==='F10'){e.preventDefault();toggle('polarToggle');return}
 if(e.key==='F3'){e.preventDefault();toggle('osnapToggle');return}
 if(e.key==='F2'){e.preventDefault();editSelectedText();return}
 if(e.key==='F12'){e.preventDefault();toggleDynamicInput();return}
 if(e.key==='F1'){e.preventDefault();showCadKeyboardHelp();return}
 if(e.key==='Enter'){e.preventDefault();performEnterAction();return}
 if(e.key===' '&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();performEnterAction();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('#redo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&(active===stage||active===canvas||active===document.body)){e.preventDefault();applySelection(objects.map((_,i)=>i));showProperties();render();return}
 if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
  e.preventDefault();$('#cmd').value += e.key;updateCursorCommand();return;
 }
},true);
const aliases={MA:'matchprop',MATCHPROP:'matchprop',IGUALAR:'matchprop',F:'fillet',FILLET:'fillet',DI:'measure',DIST:'measure',DISTANCE:'measure',L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',BH:'hatch',BHATCH:'hatch',D:'dim',DIM:'dim',DLI:'dim',DIMLINEAR:'dim',DAL:'dimaligned',DIMALIGNED:'dimaligned',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',O:'offset',OFFSET:'offset',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EX:'extend',EXT:'extend',EXTEND:'extend',EXP:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
function parseCoordinate(raw,base){
 const s=raw.trim().replace(/\s+/g,'');let m;
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?)$/))){const x=Number(m[1].replace(',','.')),y=Number(m[2].replace(',','.'));return s.startsWith('@')?{x:base.x+x,y:base.y+y}:{x,y}}
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?)<(-?\d+(?:[.,]\d+)?)$/))){const len=Number(m[1].replace(',','.')),ang=Number(m[2].replace(',','.'))*Math.PI/180;return {x:base.x+len*Math.cos(ang),y:base.y+len*Math.sin(ang)}}
 return null;
}
function showSmartPurge(){
 const scan=()=>{
  const seen=new Map(),duplicates=[],zero=[];
  objects.forEach((o,i)=>{
   if(!o||!isVisibleModelEntity(o)||lockedLayers.has(o.layer)||o.groupId)return;
   if(o.type==='line'&&o.a&&o.b&&[o.a.x,o.a.y,o.b.x,o.b.y].every(Number.isFinite)&&Math.hypot(o.a.x-o.b.x,o.a.y-o.b.y)<1e-9){zero.push(i);return}
   if(!['line','circle','rect','poly'].includes(o.type))return;
   const copy=clone(o);
   if(o.type==='line'&&copy.a&&copy.b&&JSON.stringify(copy.a)>JSON.stringify(copy.b)){const swap=copy.a;copy.a=copy.b;copy.b=swap}
   const sortValue=v=>Array.isArray(v)?v.map(sortValue):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortValue(v[k])])):v;
   const key=JSON.stringify(sortValue(copy));
   if(seen.has(key))duplicates.push(i);else seen.set(key,i);
  });return {duplicates,zero};
 };
 const report=scan(),dlg=document.createElement('dialog');dlg.className='cad-utility-dialog';
 dlg.innerHTML='<h3>✦ Limpieza inteligente</h3><p>Analiza objetos visibles y desbloqueados en Modelo. Solo elimina duplicados exactos con las mismas propiedades y líneas de longitud cero.</p><label style="display:block;margin:12px 0"><input id="purgeDup" type="checkbox"> Duplicados exactos: '+report.duplicates.length+'</label><label style="display:block;margin:12px 0"><input id="purgeZero" type="checkbox"> Líneas de longitud cero: '+report.zero.length+'</label><p>Los bloques agrupados, hachurados, capas ocultas o bloqueadas y líneas parcialmente superpuestas no se modifican. Guarda una copia antes de limpiar.</p><p id="purgeResult" role="status"></p><div class="cad-utility-actions"><button id="purgeClose" type="button">Cerrar</button><button id="purgeApply" type="button">Limpiar seleccionados</button></div>';
 document.body.append(dlg);dlg.querySelector('#purgeClose').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());
 dlg.querySelector('#purgeApply').onclick=()=>{
  const current=scan(),ids=new Set([...(dlg.querySelector('#purgeDup').checked?current.duplicates:[]),...(dlg.querySelector('#purgeZero').checked?current.zero:[])]);
  if(!ids.size){dlg.querySelector('#purgeResult').textContent='Selecciona una categoría que contenga elementos.';return}
  checkpoint();objects=objects.filter((_,i)=>!ids.has(i));clearSelection();save();render();showProperties();status.textContent='Limpieza: '+ids.size+' objeto(s) eliminados · Ctrl+Z para deshacer';dlg.close();
 };
 dlg.showModal();
}
function runCommand(raw){
 const textValue=raw.trim(),upper=textValue.toUpperCase(),parts=upper.split(/\s+/),c=parts[0];if(!c)return;
 if(!/^[+-]?(?:\d|[.,])/.test(textValue)&&!textValue.startsWith('@')&&!['DS','HP','DSETTINGS','DRAFTINGSETTINGS','SETTINGS','F3','F7','F8','F9','F10','GRID','ORTHO','SNAP','OSNAP','POLAR'].includes(c)){lastCommand=textValue;try{localStorage.setItem('otrocad-last-command',lastCommand)}catch(e){}}
 if(tool==='scale'&&moveBase&&/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(textValue)){
  const factor=Number(textValue.replace(',','.'));if(!(factor>0)||!Number.isFinite(factor)){status.textContent='ESCALAR: introduce un factor mayor que cero';return}
  const point={x:moveBase.x+factor*scaleReference,y:moveBase.y};handleTap(screen(point),point);return
 }
 if(tool==='rotate'&&moveBase&&(c==='R'||c==='REFERENCE'||c==='REFERENCIA')){rotateRef={phase:'first',first:null,angle:0};status.textContent='REFERENCIA · indica dos puntos de la dirección existente o escribe su ángulo';render();return}
 if(tool==='rotate'&&moveBase&&/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(textValue)){
  const degrees=Number(textValue.replace(',','.'));if(!Number.isFinite(degrees))return;
  if(rotateRef.phase==='first'){rotateRef.angle=degrees*Math.PI/180;rotateRef.phase='target';status.textContent='REFERENCIA · escribe el nuevo ángulo o indica un punto destino';return}
  if(rotateRef.phase==='second'){status.textContent='Indica el segundo punto de referencia o cancela con Esc';return}
  const a=degrees*Math.PI/180;handleTap(screen({x:moveBase.x+Math.cos(a),y:moveBase.y+Math.sin(a)}),{x:moveBase.x+Math.cos(a),y:moveBase.y+Math.sin(a)});return
 }
 if(c==='PURG'||c==='PURGE'||c==='PURGAR'||c==='LIMPIAR'){showSmartPurge();return}
 if(c==='RE'||c==='REGEN'||c==='REGENERATE'){resize();status.textContent='REGEN · vista regenerada sin modificar el dibujo';return}
 if(c==='F12'||c==='DYNMODE'||c==='DYN'){toggleDynamicInput();return}
 if(c==='F1'||c==='HELP'||c==='ATAJOS'){showCadKeyboardHelp();return}
 if(window.OtroCadCivilCommands&&typeof window.OtroCadCivilCommands[c]==='function'){
  try{window.OtroCadCivilCommands[c]()}catch(error){console.error(error);status.textContent=error.message||String(error);alert(status.textContent)}
  return;
 }
 if(tool==='offset'&&offsetAwaitingDistance&&/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(textValue)){acceptOffsetDistance(textValue);return}
 if(tool==='rect'&&start&&textValue.includes(';')){
  const pair=textValue.replace(/^@/,'').split(';').map(cursorNumber);
  if(pair.length!==2||pair.some(value=>!Number.isFinite(value)||Math.abs(value)<1e-9)){status.textContent='Rectángulo: usa ancho;alto, por ejemplo 5;3';return}
  $('#dynLen').value=String(pair[0]);$('#dynAngle').value=String(pair[1]);
  const point=pointFromInputs();if(point)commitEntity(point);return;
 }
 // In line/polyline mode a distance alone follows the current pointer angle.
 // This matches the common CAD sequence L ↵ first point ↵ 5 ↵.
 if(/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(textValue)&&temp&&activeAnchor()&&['line','poly','measure'].includes(tool)){
  const len=Number(textValue.replace(',','.'));
  if(!(len>0)){status.textContent='La distancia debe ser mayor que cero';return}
  const a=activeAnchor(),heading=angle(a,temp.b)*Math.PI/180;
  const point=round({x:a.x+len*Math.cos(heading),y:a.y+len*Math.sin(heading)});
  if(tool==='poly'){poly.push(point);temp=null;render();status.textContent='Vértice por distancia · Enter para terminar';return}
  if(tool==='measure'){handleTap(screen(point));return}
  commitEntity(point);status.textContent='Línea de '+len+' '+units+' creada con ángulo del cursor';return;
 }
 if(c==='O'||c==='OFFSET'){const d=cursorNumber(parts[1]||'');if(parts[1]&&(!Number.isFinite(d)||d<=0)){status.textContent='OFFSET: ingresa una distancia positiva';return}if(parts[1])offsetDistance=d;setTool('offset',{offsetDistanceProvided:!!parts[1]});return}
 const coordinateBase=tool==='arc'&&arcPoints.length?arcPoints[arcPoints.length-1]:((['move','copy'].includes(tool)&&moveBase)||activeAnchor()||{x:0,y:0});
 const coordinate=parseCoordinate(textValue,coordinateBase);
 if(coordinate&&(/^[+-]?(?:\d|\.)/.test(textValue)||textValue.startsWith('@'))){
  const point=round(coordinate);
  if(['move','copy','rotate'].includes(tool)){handleTap(screen(point),point);return}
  if(tool==='poly'){poly.push(point);resetLineCoordinates();temp=null;render();status.textContent='Polilínea: vértice añadido · Enter para terminar';return}
  if(tool==='measure'){handleTap(screen(point));return}
  if(tool==='arc'){arcPoints.push(point);if(arcPoints.length===3){checkpoint();objects.push({type:'arc',pts:clone(arcPoints),...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);arcPoints=[];status.textContent='Arco creado'}else status.textContent='Arco: introduce el siguiente punto';render();return}
  if(tool==='leader'){if(!start){start=point;temp={type:'line',a:clone(point),b:clone(point),...currentStyle($('#layer').value)};status.textContent='Introduce el extremo de la directriz';render()}else{const label=prompt('Texto de la directriz','');checkpoint();objects.push({type:'leader',a:clone(start),b:point,text:label||'',...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);start=null;temp=null;render();status.textContent='Directriz creada'}return}
  if(!start){if(tool==='rect')resetRectangleDimensions();resetLineCoordinates();start=point;temp={type:tool,a:clone(start),b:clone(start),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Punto inicial fijado · introduce el siguiente punto'}
  else commitEntity(point);
  return;
 }
 if(c==='F7'||c==='GRID'){toggle('gridToggle');return}if(c==='F8'||c==='ORTHO'){toggle('orthoToggle');return}if(c==='F9'||c==='SNAP'){toggle('snapToggle');return}if(c==='F10'||c==='POLAR'){toggle('polarToggle');return}if(c==='F3'||c==='OSNAP'){toggle('osnapToggle');return}
 if(c==='U'||c==='UNDO'){$('#undo').click();return}if(c==='REDO'){$('#redo').click();return}
 if(c==='DS'||c==='HP'||c==='DSETTINGS'||c==='DRAFTINGSETTINGS'||c==='SETTINGS'){showDraftSettings();return}
 if(c==='LA'||c==='LAYER'||c==='LAYERS'){document.querySelector('[data-tab="layers"]')?.click();status.textContent='CAPAS · administra color, grosor y visibilidad';return}
 if(c==='OS'||c==='OSNAPSETTINGS'){showDraftSettings();return}
 if(c==='C3D'){document.querySelector('[data-tab="civil"]')?.click();return}

 if(c==='BG'||c==='BACKGROUND'||c==='CANVASCOLOR'){const name=(parts[1]||'').toLowerCase();if(CAD_THEMES[name])applyCanvasTheme(name);else status.textContent='BACKGROUND WHITE | BLACK | DARK | GRAPHITE | SLATE | BLUEGRAY';return}
 if(c==='HATCHPATTERN'){const p=parts[1];if(['ANSI31','CROSS','GRID','SOLID'].includes(p)){$('#hatchPattern').value=p;status.textContent='HATCHPATTERN '+p}else status.textContent='HATCHPATTERN ANSI31 | CROSS | GRID | SOLID';return}
 if(c==='PR'||c==='PROPERTIES'||c==='CTRL+1'){$('#properties').classList.toggle('open');showProperties();return}
 if(c==='MODEL'||c==='MODELO'||c==='MSPACE'){switchCadLayout('Model');return}
 if(c==='LAYOUT'||c==='PAPERSPACE'||c==='PAPEL'||c==='PSPACE'){if(paperLayoutsSafe().length)switchCadLayout(paperLayoutsSafe()[0].name);else createCadLayout();return}
 if(c==='LAYOUTNEW'||c==='NEWLAYOUT'){createCadLayout();return}
 if(c==='PAGESETUP'||c==='PSETUP'||c==='CONFIGPAGINA'){if(activeLayout==='Model')createCadLayout();showCadPaperSettings();return}
 if(c==='MVIEW'||c==='VPORTS'||c==='VIEWPORT'){if(activeLayout==='Model')createCadLayout();showCadViewportManager();return}
 if(c==='PLOT'||c==='PRINT'){ $('#pdf').click();return }
 if(['ED','TEXTEDIT','DDEDIT','EDITTEXT','STYLE','TEXTSTYLE'].includes(c)){editSelectedText();return}
 if(c==='SELECTTEXT'||c==='QSELECTTEXT'){const ids=objects.map((o,i)=>o.type==='text'&&!hiddenLayers.has(o.layer)&&!lockedLayers.has(o.layer)?i:-1).filter(i=>i>=0);applySelection(ids);showProperties();status.textContent=ids.length+' textos seleccionados · ejecuta ED para cambiar formato en conjunto';return}
 if(c==='E'||c==='ERASE'||c==='DELETE'){deleteSelection();return}
 if(c==='Z'||c==='ZOOM'){if(['E','EXTENTS','ALL','A'].includes(parts[1])){$('#fit').click();return}zoom=Math.min(MAX_MODEL_ZOOM,zoom*1.25);render();return}
 if(c==='RE'||c==='REGEN'){render();return}
 if(c==='ARRAY'||c==='ARRAYRECT'){showArrayDialog();return}
 if(c==='AREA'){selectedArea();return}
 if(c==='CENTERMARK'){createCircleAnnotations('center');return}
 if(c==='CENTERLINE'){createCenterline();return}
 if(c==='DIMRADIUS'){createCircleAnnotations('radius');return}
 if(c==='DIMDIAMETER'){createCircleAnnotations('diameter');return}
 if(c==='CHA'||c==='CHAMFER'){setTool('chamfer');return}
 if(c==='F'||c==='FILLET'){setTool('fillet');return}
 if(c==='DLI'||c==='DIMLINEAR'){setTool('dim');return}
 if(c==='DAL'||c==='DIMALIGNED'){setTool('dimaligned');return}
 const aliases={MA:'matchprop',MATCHPROP:'matchprop',IGUALAR:'matchprop',DI:'measure',DIST:'measure',DISTANCE:'measure',CP:'copy',X:'explode',CH:'chamfer',BH:'hatch',BHATCH:'hatch',T:'text',TEXT:'text',MTEXT:'text',L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',D:'dim',DIM:'dim',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EX:'extend',EXT:'extend',EXTEND:'extend',EXP:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
 if(['X','EXP','EXPLODE'].includes(c)&&selectedItems().length){explodeSelection(selectedItems());setTool('select');status.textContent='EXPLODE aplicado · usa Deshacer para recuperar';return}
 if(['BEDIT','EDITBLOCK','EDITARBLOQUE'].includes(c)){const i=selectedItems().find(i=>objects[i]?.groupId);if(i===undefined)status.textContent='Selecciona un bloque y escribe BEDIT, o haz doble clic sobre él';else editBlock(i);return}
 if(c==='BCLOSE'||c==='CERRARBLOQUE'){closeBlockEditing();return}
 if(aliases[c]){setTool(aliases[c]);return}
 status.textContent='Comando no reconocido: '+c;
}

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active))});document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab)});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
const furnitureList=Array.isArray(window.otroCadFurnitureCatalog)?window.otroCadFurnitureCatalog:[];
for(const item of furnitureList){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('#blockChoice').append(option)}
$('#insertFurniture').onclick=()=>{activeFurniture=furnitureList.find(item=>item.id===$('#blockChoice').value)||null;if(!activeFurniture){status.textContent='No se encontró el símbolo';return}setTool('furniture');status.textContent='Toca el punto de inserción · '+activeFurniture.name};
$('#editTextBtn').onclick=editSelectedText;
$('#arrayRect').onclick=showArrayDialog;
$('#centerMark').onclick=()=>createCircleAnnotations('center');
$('#centerLine').onclick=createCenterline;
$('#dimRadius').onclick=()=>createCircleAnnotations('radius');
$('#dimDiameter').onclick=()=>createCircleAnnotations('diameter');
$('#measureArea').onclick=selectedArea;
$('#finish-poly').onclick=finishPoly;
$('#dynLen').addEventListener('input',()=>updateRectangleInput('width',$('#dynLen').value));
$('#dynAngle').addEventListener('input',()=>updateRectangleInput('height',$('#dynAngle').value));
$('#dynCoordMode').onchange=()=>{lineCoordinateMode=$('#dynCoordMode').value;resetLineCoordinates();stage.focus({preventScroll:true});render()};
$('#acceptPoint').onclick=()=>{const q=pointFromInputs();if(!q)return;if(usesLineCoordinates()){acceptDynamicPoint(q);stage.focus({preventScroll:true});return}if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)};
$('#undo').onclick=()=>{if(undo.length){backupPrevious();redo.push(clone(objects));objects=undo.pop();clearSelection();save();render()}};
$('#redo').onclick=()=>{if(redo.length){backupPrevious();undo.push(clone(objects));objects=redo.pop();clearSelection();save();render()}};
$('#newDrawing').onclick=async()=>{
 if((objects.length||layouts.length||layoutViewportRecords.length)&&!confirm('¿Crear un dibujo nuevo? Primero se conservará una copia recuperable del dibujo actual.'))return;
 if(!await protectDrawingBeforeReplacement()){status.textContent='Nuevo dibujo cancelado: el plano original no se modificó';return}
 pushReplacementUndo();objects=[];layouts=[defaultCadLayout()];layoutViewportRecords=[];activeLayout='Model';hideModelAnnotations=false;
 window.OtroCadGeolocation?.clear();
 clearSelection();start=null;temp=null;poly=[];arcPoints=[];modifyTarget=-1;modifyTargets=[];drag=null;selectionStart=null;selectionBox=null;
 offset={x:0,y:0};zoom=35;lastConvertedDxf=null;lastImportReport=[];
 saveLayoutState();refreshLayoutTabs();const stored=save();render();
 status.textContent=stored?'Dibujo nuevo creado · plano anterior respaldado':'Dibujo nuevo creado · comprueba el almacenamiento antes de salir';
};
$('#save').onclick=async()=>{
 const result=await window.OtroCadFileCore.saveCurrent().catch(error=>{alert('No se pudo guardar: '+error.message);return null});
 if(result?.requiresSaveAs)window.OtroCadSaveUI?.open('dwg');
};
$('#recover').onclick=async()=>{
 const previous=await cadReadLastBackup();
 if(!previous){alert('No hay una copia anterior disponible en el navegador.');return}
 if(!confirm('¿Recuperar la copia anterior? Se protegerá primero el dibujo que tienes abierto.'))return;
 if(!await protectDrawingBeforeReplacement())return;
 pushReplacementUndo();objects=clone(previous.shapes);
 if(['m','cm','mm'].includes(previous.units))units=previous.units;
 layouts=clone(Array.isArray(previous.layouts)?previous.layouts:[]);
 layoutViewportRecords=clone(Array.isArray(previous.viewports)?previous.viewports:[]);
 activeLayout=layouts.some(l=>l.name===previous.activeLayout)?previous.activeLayout:'Model';
 clearSelection();ensureCadLayout();saveLayoutState();refreshLayoutTabs();const stored=save();render();
 status.textContent=stored?'Copia anterior recuperada':'Copia recuperada · almacenamiento local pendiente';
};
$('#demoHouse').onclick=async()=>{if(objects.length&&!confirm('¿Abrir la vivienda de demostración? Primero se protegerá el dibujo actual.'))return;try{const demo=clone(window.otroCadDemo);if(!Array.isArray(demo.shapes)||!demo.shapes.length)throw Error('La demostración está vacía.');if(!await protectDrawingBeforeReplacement())return;pushReplacementUndo();objects=demo.shapes;units='m';layouts=[defaultCadLayout()];layoutViewportRecords=[];activeLayout='Model';hideModelAnnotations=false;saveLayoutState();refreshLayoutTabs();clearSelection();save();$('#fit').click();status.textContent='Vivienda de demostración · '+objects.length+' entidades editables'}catch(e){alert('No se pudo abrir la demostración: '+e.message)}};
$('#open').onclick=()=>$('#file').click();
let dwgRuntimePromise=null;
async function getDwgRuntime(){
 if(!dwgRuntimePromise){
  dwgRuntimePromise=(async()=>{
   const engine=await import('./vendor/dwg/otrocad_dwg.js');
   await engine.default();
   return engine;
  })().catch(error=>{dwgRuntimePromise=null;throw error});
 }
 return dwgRuntimePromise;
}
const importReportButton=$('#importReport'),copyImportReportButton=$('#copyImportReport'),convertedDxfButton=$('#convertedDxf');let lastImportReport=[],lastConvertedDxf=null,lastConvertedName='dibujo';
// Persist the last local DWG conversion and its diagnostic report across reloads.
// IndexedDB is used instead of localStorage because architectural DXF files can be large.
function openImportCache(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('IndexedDB no disponible'));return}
  const request=indexedDB.open('otrocad-import-cache',1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('imports'))db.createObjectStore('imports')};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('No se pudo abrir la caché local'));
 });
}
async function persistImportCache(){
 let db;
 try{
  db=await openImportCache();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('imports','readwrite');
   tx.objectStore('imports').put({report:lastImportReport,dxf:lastConvertedDxf,filename:lastConvertedName,savedAt:Date.now()},'latest');
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('No se pudo guardar el diagnóstico'));tx.onabort=()=>reject(tx.error||new Error('Guardado cancelado'));
  });
 }catch(error){console.warn('No se pudo conservar el informe/DXF local:',error)}
 finally{if(db)db.close()}
}
async function restoreImportCache(){
 let db;
 try{
  db=await openImportCache();
  const cached=await new Promise((resolve,reject)=>{
   const tx=db.transaction('imports','readonly'),request=tx.objectStore('imports').get('latest');
   request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('No se pudo leer el diagnóstico guardado'));
  });
  if(!cached)return;
  lastImportReport=Array.isArray(cached.report)?cached.report:[];
  lastConvertedDxf=typeof cached.dxf==='string'?cached.dxf:null;
  lastConvertedName=String(cached.filename||'dibujo');
  importReportButton.hidden=!lastImportReport.length;
  copyImportReportButton.hidden=!lastImportReport.length;
  convertedDxfButton.hidden=!lastConvertedDxf;
 }catch(error){console.warn('No se pudo restaurar el informe/DXF local:',error)}
 finally{if(db)db.close()}
}
void restoreImportCache();
if(convertedDxfButton)convertedDxfButton.onclick=()=>{if(lastConvertedDxf)download(lastConvertedName.replace(/\.[^.]+$/,'')+'-convertido.dxf',lastConvertedDxf,'application/dxf')};
importReportButton.onclick=()=>alert(lastImportReport.length?lastImportReport.join('\n'):'No hay advertencias en el último dibujo importado.');
copyImportReportButton.onclick=async()=>{
 const report=lastImportReport.join('\n');if(!report)return;
 try{await navigator.clipboard.writeText(report);status.textContent='Diagnóstico CAD copiado. Puedes pegarlo en el chat.'}
 catch(error){console.warn('No se pudo copiar el diagnóstico:',error);alert(report)}
};
function decodeDxfFileBytes(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(data[0]===0xff&&data[1]===0xfe)return new TextDecoder('utf-16le').decode(data);
 if(data[0]===0xfe&&data[1]===0xff)return new TextDecoder('utf-16be').decode(data);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(data)}catch(error){}
 const header=new TextDecoder('windows-1252').decode(data.subarray(0,Math.min(data.length,65536)));
 const match=header.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([A-Za-z0-9_]+)/i);
 const encodings={ANSI_1250:'windows-1250',ANSI_1251:'windows-1251',ANSI_1252:'windows-1252',ANSI_1253:'windows-1253',ANSI_1254:'windows-1254',ANSI_1255:'windows-1255',ANSI_1256:'windows-1256',ANSI_1257:'windows-1257',ANSI_1258:'windows-1258',ANSI_932:'shift_jis',ANSI_936:'gbk',ANSI_949:'euc-kr',ANSI_950:'big5'};
 const encoding=encodings[(match?.[1]||'').toUpperCase()]||'windows-1252';
 return new TextDecoder(encoding).decode(data);
}
$('#file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const ext=f.name.split('.').pop().toLowerCase();let arr,importedDxf=null;if(ext==='json'){const v=JSON.parse(await f.text());arr=Array.isArray(v)?v:v.shapes;if(!Array.isArray(arr))throw Error('El JSON no contiene entidades válidas');arr.layoutDefinitions=Array.isArray(v.layouts)?v.layouts:[];arr.layoutViewports=Array.isArray(v.viewports)?v.viewports:[];arr.geolocation=v.geolocation||null}else if(ext==='dxf'){arr=parseDxfEntities(decodeDxfFileBytes(new Uint8Array(await f.arrayBuffer())))}else if(ext==='dwg'){status.textContent='Convirtiendo DWG en el dispositivo…';const engine=await getDwgRuntime();const input=new Uint8Array(await f.arrayBuffer());if(input.length<6||new TextDecoder().decode(input.subarray(0,4))!=='AC10')throw Error('El archivo no tiene una cabecera DWG válida.');let dxfBytes,recovered=false,fallbackReason='';try{dxfBytes=engine.dwg_to_dxf(input)}catch(strictError){fallbackReason=String(strictError?.message||strictError).slice(0,500);console.warn('Lectura DWG estricta falló:',strictError);if(typeof engine.dwg_to_dxf_failsafe!=='function')throw Error('El lector DWG no pudo abrir este archivo. Actualiza OtroCAD e inténtalo nuevamente. Detalle: '+(strictError.message||strictError));if(!confirm('La lectura completa del DWG falló. ¿Intentar recuperar las entidades compatibles?\n\nPuede perder bloques, cotas u otros elementos. El archivo DWG original no se modificará.'))return;dxfBytes=engine.dwg_to_dxf_failsafe(input);recovered=true}const dxf=new TextDecoder('utf-8').decode(dxfBytes);importedDxf=dxf;arr=parseDxfEntities(dxf);if(recovered){arr.recoveredDwg=true;arr.dwgFallbackReason=fallbackReason;arr.importWarnings=arr.importWarnings||[];arr.importWarnings.unshift('DWG recuperado parcialmente tras un error de lectura. Comprueba el plano antes de guardar.')}}else throw Error('Formato no compatible. Usa JSON, DXF o DWG.');if(!arr.length)throw Error('No se encontraron entidades compatibles.');if(arr.importWarnings?.length&&!confirm('El archivo contiene elementos que pueden perderse o simplificarse:\n'+arr.importWarnings.join('\n')+'\n\n¿Abrir de todos modos? Conserva el archivo original.'))return;if(!await protectDrawingBeforeReplacement())throw Error('Importación cancelada: conserva o descarga una copia del dibujo anterior.');pushReplacementUndo();objects=arr;window.OtroCadGeolocation?.restore(arr.geolocation||null);layouts=clone(arr.layoutDefinitions||[]);layoutViewportRecords=clone(arr.layoutViewports||[]);activeLayout=layouts.some(l=>l.name===arr.activeCadLayout)?arr.activeCadLayout:'Model';hideModelAnnotations=false;ensureCadLayout();saveLayoutState();refreshLayoutTabs();lastConvertedDxf=importedDxf;lastConvertedName=f.name;if(convertedDxfButton)convertedDxfButton.hidden=!importedDxf;lastImportReport=[
 'OtroCAD · Informe de importación', 'Archivo: '+f.name, 'Entidades editables: '+arr.length,'Modelo: '+arr.filter(s=>(s.cadLayout||'Model')==='Model').length+' entidades', 'Etiquetas de texto en Modelo: '+arr.filter(s=>(s.cadLayout||'Model')==='Model'&&s.type==='text').length, 'Anotaciones MULTILEADER recuperadas: '+arr.filter(s=>s.cadSourceEntity==='MLEADER').length,'Presentaciones: '+(arr.layoutDefinitions||[]).map(l=>l.name+' ('+arr.filter(s=>s.cadLayout===l.name).length+' entidades)').join(', '),'Ventanas gráficas importadas: '+(arr.layoutViewports||[]).length,'Detalle de recuperación DWG: '+String(arr.dwgFallbackReason||'No se necesitó recuperación parcial'),'Parámetros VIEWPORT: '+(arr.layoutViewports||[]).map(v=>v.layout+' #'+v.id+' (ancho '+v.width+', alto '+v.height+', vista '+v.viewHeight+', activo '+v.status+')').join(' | '),'Contenido de bloques Papel recuperado: '+(arr.paperBlockRecovery?.recovered||0)+' entidades', 'Pestaña original DWG: '+String(arr.activeCadLayout||'Model'),
 'Pérdidas o incompatibilidades:',...(arr.importWarnings?.length?arr.importWarnings:['Ninguna detectada']),
 'Ajustes visuales:',...(arr.importNotes?.length?arr.importNotes:['Ninguno']),
 'Causas dentro de bloques, cotas y sombreados (sin coordenadas):',
 ...((Object.entries(arr.importDiagnostics||{}).sort((a,b)=>b[1]-a[1]).map(([name,count])=>count+' '+name))||[])
];importReportButton.hidden=false;copyImportReportButton.hidden=false;if(arr.drawingUnits)units=arr.drawingUnits;await persistImportCache();clearSelection();save();render();status.textContent=f.name+' · '+arr.length+' entidades cargadas'+(arr.recoveredDwg?' · RECUPERACIÓN PARCIAL':'')+(arr.importNotes?.length?' · '+arr.importNotes.length+' avisos de compatibilidad':'');status.title=[...(arr.importWarnings||[]),...(arr.importNotes||[])].join('\n')}catch(err){console.error(err);alert('No se pudo abrir el archivo: '+(err.message||err))}finally{e.target.value=''}};
function parseDxfEntities(source){
 source=source.replace(/\\U\+([0-9a-fA-F]{4})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
 const lines=source.replace(/\r/g,'').split('\n'),pairs=[];
 for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))pairs.push([code,lines[i+1].trim()])}
 const records=[];let current=null;
 for(const pair of pairs){if(pair[0]===0){if(current)records.push(current);current={type:pair[1].toUpperCase(),pairs:[]}}else if(current)current.pairs.push(pair)}
 if(current)records.push(current);
 const get=(r,c,d=0)=>{const p=r.pairs.find(x=>x[0]===c);if(!p)return d;const n=Number(p[1]);return Number.isFinite(n)?n:d};
 const all=(r,c)=>r.pairs.filter(x=>x[0]===c).map(x=>Number(x[1]));
 const str=(r,c,d='')=>r.pairs.find(x=>x[0]===c)?.[1]??d;
 const dxfOpacity=raw=>raw>=0&&(raw>>>24)===2?(raw&255)/255:1;
 // AutoCAD's ACI palette: 10–249 are 24 hues × 10 brightness/saturation steps;
 // 250–255 are true grayscale. 7 adapts to light/dark drawing backgrounds.
 const aciColor=index=>{
  if(index===7)return '#dce8f5';
  const basic={1:'#ff0000',2:'#ffff00',3:'#00ff00',4:'#00ffff',5:'#0000ff',6:'#ff00ff',8:'#808080',9:'#c0c0c0',250:'#000000',251:'#656565',252:'#666666',253:'#999999',254:'#cccccc',255:'#ffffff'};
  if(basic[index])return basic[index];
  if(index<10||index>249)return null;
  const group=Math.floor((index-10)/10),shade=(index-10)%10,v=[255,255,165,165,127,127,76,76,38,38][shade],sat=shade%2?.5:1;
  const h=group*15/60,c=v*sat,x=c*(1-Math.abs(h%2-1)),m=v-c;
  const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return '#'+rgb.map(v=>Math.floor(v+m+1e-8).toString(16).padStart(2,'0')).join('');
 };
 const layerStyles=new Map(),textStyles=new Map();let inTables=false,inLayerTable=false,inTextStyleTable=false;
  for(const record of records){
   if(record.type==='SECTION'){inTables=str(record,2).toUpperCase()==='TABLES';inLayerTable=false;inTextStyleTable=false;continue}
   if(record.type==='ENDSEC'){inTables=false;inLayerTable=false;inTextStyleTable=false;continue}
   if(!inTables)continue;
   if(record.type==='TABLE'){const tableName=str(record,2).toUpperCase();inLayerTable=tableName==='LAYER';inTextStyleTable=tableName==='STYLE';continue}
   if(record.type==='ENDTAB'){inLayerTable=false;inTextStyleTable=false;continue}
   if(inLayerTable&&record.type==='LAYER'){
    const aci=Math.abs(get(record,62,7)),rgb=get(record,420,-1),name=str(record,2,'0');
    layerStyles.set(name,{color:rgb>=0?'#'+(rgb&0xffffff).toString(16).padStart(6,'0'):aciColor(aci),linetype:str(record,6,'CONTINUOUS'),lineweight:get(record,370,25),opacity:dxfOpacity(get(record,440,-1))});
   }
   if(inTextStyleTable&&record.type==='STYLE'){
    const name=str(record,2,'STANDARD'),fontFile=str(record,3,'txt.shx');
    textStyles.set(name.toUpperCase(),{name,fontFile,bigFontFile:str(record,4,''),fixedHeight:get(record,40,0),widthFactor:get(record,41,1)||1,obliqueAngle:get(record,50,0),generationFlags:get(record,71,0),lastHeight:get(record,42,0)});
   }
  }
  const style=r=>{
  const layer=str(r,8,'0'),ly=layerStyles.get(layer)||{},aci=get(r,62,256),trueColor=get(r,420,-1),lineweight=get(r,370,-1),linetype=str(r,6,'BYLAYER');
  const byBlock=aci===0;
  const color=trueColor>=0?'#'+(trueColor&0xffffff).toString(16).padStart(6,'0'):(aci>=1&&aci<=255?aciColor(aci):ly.color)||colors[layer]||colors.General;
  return {layer,color,cadByBlock:byBlock,cadOpacity:r.pairs.some(p=>p[0]===440)?dxfOpacity(get(r,440,-1)):(ly.opacity??1),lineweight:(lineweight>=0?lineweight:(ly.lineweight>=0?ly.lineweight:25))/100,linetype:linetype==='BYLAYER'?(ly.linetype||'CONTINUOUS'):linetype};
 };
 const blockRecords=new Map(),blockBases=new Map();let inBlocks=false,activeBlock=null;
 for(const record of records){if(record.type==='SECTION'){inBlocks=str(record,2).toUpperCase()==='BLOCKS';continue}if(record.type==='ENDSEC'){inBlocks=false;activeBlock=null;continue}if(!inBlocks)continue;if(record.type==='BLOCK'){activeBlock=str(record,2).toUpperCase();blockRecords.set(activeBlock,[]);blockBases.set(activeBlock,{x:get(record,10),y:get(record,20)});continue}if(record.type==='ENDBLK'){activeBlock=null;continue}if(activeBlock)blockRecords.get(activeBlock).push(record)}
 const blockNameToHandle=new Map(),handleToLayout=new Map();let inBtrTable=false,inTablesSection=false;
 for(const record of records){
  if(record.type==='SECTION'){inTablesSection=str(record,2).toUpperCase()==='TABLES';continue}
  if(record.type==='ENDSEC'){inTablesSection=false;inBtrTable=false;continue}
  if(!inTablesSection)continue;
  if(record.type==='TABLE'){inBtrTable=str(record,2).toUpperCase()==='BLOCK_RECORD';continue}
  if(record.type==='ENDTAB'){inBtrTable=false;continue}
  if(inBtrTable&&record.type==='BLOCK_RECORD'){
   const h=str(record,5,'').trim().toUpperCase(),name=str(record,2,'').toUpperCase();
   if(h&&name)blockNameToHandle.set(name,h);
  }
 }
 const importedLayouts=[];
 for(const record of records){
  if(record.type!=='LAYOUT')continue;
  let part='',name='',width=0,height=0,margin=8,tabOrder=1,blockHandle='';
  for(const [code,value] of record.pairs){
   if(code===100){part=value;continue}
   if(part==='AcDbPlotSettings'){
    if(code===44)width=Number(value);
    if(code===45)height=Number(value);
    if(code===40&&Number(value)>=0)margin=Math.max(0,Number(value));
   }
   if(part==='AcDbLayout'){
    if(code===1)name=String(value).trim();
    if(code===71)tabOrder=Number(value);
    if(code===330)blockHandle=String(value).trim().toUpperCase();
   }
  }
  if(name&&name.toLowerCase()!=='model'){
   if(blockHandle)handleToLayout.set(blockHandle,name);
   importedLayouts.push({name,blockHandle,paperWidth:Number.isFinite(width)&&width>0?width:420,paperHeight:Number.isFinite(height)&&height>0?height:297,margin:Number.isFinite(margin)?margin:8,tabOrder:Number.isFinite(tabOrder)?tabOrder:1,source:'imported'});
  }
 }
 const paperBlockToLayout=new Map(),unknownPaperBlocks=[];
 for(const [blockName] of blockRecords){
  if(!/^\*PAPER_SPACE(?:\d+)?$/i.test(blockName))continue;
  const blockHandle=blockNameToHandle.get(blockName)||'',layoutName=handleToLayout.get(blockHandle);
  if(layoutName)paperBlockToLayout.set(blockName,layoutName);else unknownPaperBlocks.push(blockName);
 }
 const unmatchedLayouts=importedLayouts.filter(l=>![...paperBlockToLayout.values()].includes(l.name));
 for(const blockName of unknownPaperBlocks){
  const suffix=blockName.replace(/^\*PAPER_SPACE/i,'');
  const name=unknownPaperBlocks.length===1&&unmatchedLayouts.length===1?unmatchedLayouts[0].name:(suffix?'Papel recuperado '+suffix:'Papel recuperado');
  paperBlockToLayout.set(blockName,name);
 }
 const activePaperLayout=paperBlockToLayout.get('*PAPER_SPACE')||(importedLayouts.length===1?importedLayouts[0].name:(importedLayouts.length?'Papel sin asociación':'Layout1'));
 const entitySpace=r=>{
  const name=str(r,410,'').trim();
  if(name)return name.toLowerCase()==='model'?'Model':name;
  const owner=str(r,330,'').toUpperCase();
  if(handleToLayout.has(owner))return handleToLayout.get(owner);
  return get(r,67,0)===1?activePaperLayout:'Model';
 };
 const entitiesHandles=new Set();let originalEntities=false;
 for(const rec of records){
  if(rec.type==='SECTION'){originalEntities=str(rec,2).toUpperCase()==='ENTITIES';continue}
  if(rec.type==='ENDSEC'){originalEntities=false;continue}
  const h=str(rec,5,'').toUpperCase();if(originalEntities&&h)entitiesHandles.add(h);
 }
 const paperSpaceRecords=[],paperBlockBreakdown={},nestedBlockParse=Number(arguments[1]||0)>0;
 for(const [blockName,geometry] of blockRecords){
  if(nestedBlockParse)break;
  if(!/^\*PAPER_SPACE(?:\d+)?$/i.test(blockName))continue;
  const paperLayout=paperBlockToLayout.get(blockName)||'Papel sin asociación';let count=0;
  for(const rec of geometry){
   const handle=str(rec,5,'').toUpperCase();
   if(handle&&entitiesHandles.has(handle))continue;
   const pairs=rec.pairs.filter(([code])=>code!==67&&code!==410);
   pairs.push([67,'1'],[410,paperLayout]);
   paperSpaceRecords.push({type:rec.type,pairs,originalRecord:rec});count++;
  }
  paperBlockBreakdown[blockName+' → '+paperLayout]=count;
 }
 if(paperSpaceRecords.length>100000)throw Error('Presentaciones demasiado grandes (más de 100000 entidades en BLOCKS)');
 const paperRecordsForImport=[...records,{type:'SECTION',pairs:[[2,'ENTITIES']]},...paperSpaceRecords,{type:'ENDSEC',pairs:[]}];
 const insertAttributeTags=new Map();
 for(let i=0;i<paperRecordsForImport.length;i++){
  const rec=paperRecordsForImport[i];
  if((rec.type!=='INSERT'&&rec.type!=='MINSERT')||get(rec,66,0)!==1)continue;
  const tags=new Set();
  for(let j=i+1;j<paperRecordsForImport.length;j++){
   const next=paperRecordsForImport[j];
   if(next.type==='SEQEND')break;
   if(next.type!=='ATTRIB')break;
   tags.add(str(next,2,'').toUpperCase());
  }
  insertAttributeTags.set(rec,tags);
 }
 const out=[],warnings={},notes={},diagnostics={};let inEntities=false,activeAttributeGroup=null;
 const diagnose=(scope,counts)=>{for(const [name,count] of Object.entries(counts||{})){const key=scope+' → '+name;diagnostics[key]=(diagnostics[key]||0)+count}};
 const warn=type=>warnings[type]=(warnings[type]||0)+1;
 const note=type=>notes[type]=(notes[type]||0)+1;
 const buildPolylinePoints=(vertices,closed)=>{
  const points=[];if(!vertices.length)return points;
  points.push({x:vertices[0].x,y:vertices[0].y});
  const count=closed?vertices.length:vertices.length-1;
  for(let i=0;i<count;i++){
   const start=vertices[i],end=vertices[(i+1)%vertices.length],bulge=Number(start.bulge||0);
   if(Math.abs(bulge)<1e-9){points.push({x:end.x,y:end.y});continue}
   const dx=end.x-start.x,dy=end.y-start.y,chord=Math.hypot(dx,dy),sweep=4*Math.atan(bulge);
   if(chord<1e-9||!Number.isFinite(sweep)){points.push({x:end.x,y:end.y});continue}
   const offset=chord*(1-bulge*bulge)/(4*bulge),mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
   const cx=mx-dy/chord*offset,cy=my+dx/chord*offset,radius=Math.hypot(start.x-cx,start.y-cy);
   const startAngle=Math.atan2(start.y-cy,start.x-cx),steps=Math.max(4,Math.ceil(Math.abs(sweep)/(Math.PI/18)));
   for(let step=1;step<=steps;step++){const angle=startAngle+sweep*step/steps;points.push({x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)})}
  }
  if(closed&&points.length>1&&distance(points[0],points[points.length-1])<1e-8)points.pop();
  return points;
 };
 const lightPolylineVertices=r=>{
  const vertices=[];let current=null;
  for(const [code,value] of r.pairs){
   if(code===10){if(current)vertices.push(current);current={x:Number(value),y:0,bulge:0}}
   else if(code===20&&current)current.y=Number(value);
   else if(code===42&&current)current.bulge=Number(value);
  }
  if(current)vertices.push(current);
  return vertices.filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y));
 };
 const sampleArc=pts=>{
  if(!pts||pts.length!==3)return pts||[];
  const [a,b,c]=pts,d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
  if(Math.abs(d)<1e-9)return pts;
  const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
  const cx=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,cy=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;
  const angle=p=>Math.atan2(p.y-cy,p.x-cx),a1=angle(a),am=angle(b),a3=angle(c),span=v=>(v+Math.PI*2)%(Math.PI*2);
  const ccwEnd=span(a3-a1),ccwMid=span(am-a1),direction=ccwMid<=ccwEnd?1:-1,sweep=direction===1?ccwEnd:span(a1-a3);
  const steps=Math.max(4,Math.ceil(sweep/(Math.PI/24))),radius=Math.hypot(a.x-cx,a.y-cy);
  return Array.from({length:steps+1},(_,i)=>{const t=a1+direction*sweep*i/steps;return{x:cx+radius*Math.cos(t),y:cy+radius*Math.sin(t)}});
 };

 const hatchPatternDefinitions=r=>{
  const p=r.pairs,idx=p.findIndex(pair=>pair[0]===78);
  if(idx<0)return [];
  const count=Math.min(64,Math.max(0,Number(p[idx][1])||0)),defs=[];let i=idx+1;
  for(let k=0;k<count&&i<p.length;k++){
   while(i<p.length&&p[i][0]!==53&&p[i][0]!==98&&p[i][0]!==450)i++;
   if(p[i]?.[0]!==53)break;
   const part=[];part.push(p[i++]);
   while(i<p.length&&![53,98,450].includes(p[i][0]))part.push(p[i++]);
   const val=(code,def=0)=>{const pair=part.find(v=>v[0]===code);return pair&&Number.isFinite(Number(pair[1]))?Number(pair[1]):def};
   const dashes=part.filter(v=>v[0]===49).slice(0,32).map(v=>Number(v[1])).filter(Number.isFinite);
   defs.push({angle:val(53),base:{x:val(43),y:val(44)},offset:{x:val(45),y:val(46)},dashes});
  }
  return defs;
 };
 const hatchBoundaries=r=>{
  const pairs=r.pairs,loops=[];let i=pairs.findIndex(p=>p[0]===91);if(i<0)return loops;
  const total=Math.min(512,+pairs[i++][1]||0);
  const val=(data,c,d=0)=>{const p=data.find(x=>x[0]===c);return p&&Number.isFinite(+p[1])?+p[1]:d};
  const append=(list,part)=>{for(const p of part)if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!list.length||distance(list[list.length-1],p)>1e-8))list.push(p)};
  const sweep=(a,b,ccw)=>{const v=((ccw?b-a:a-b)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);return v<1e-8?Math.PI*2:v};
  for(let k=0;k<total&&i<pairs.length;k++){
   while(i<pairs.length&&pairs[i][0]!==92)i++;if(i>=pairs.length)break;
   const flags=+pairs[i++][1],pts=[];
   while(i<pairs.length&&pairs[i][0]!==93&&pairs[i][0]!==92)i++;
   if(pairs[i]?.[0]!==93)break;
   const count=Math.min(20000,+pairs[i++][1]||0);
   if(flags&2){
    const verts=[];
    for(let j=0;j<count&&i<pairs.length;j++){
     while(i<pairs.length&&![10,92,97].includes(pairs[i][0]))i++;
     if(pairs[i]?.[0]!==10)break;
     const v={x:+pairs[i++][1],y:0,bulge:0};
     while(i<pairs.length&&![10,92,97].includes(pairs[i][0])){
      if(pairs[i][0]===20)v.y=+pairs[i][1];
      if(pairs[i][0]===42)v.bulge=+pairs[i][1];i++;
     }
     if(Number.isFinite(v.x)&&Number.isFinite(v.y))verts.push(v);
    }
    append(pts,buildPolylinePoints(verts,true));
   }else for(let j=0;j<count&&i<pairs.length;j++){
    while(i<pairs.length&&![72,92,97].includes(pairs[i][0]))i++;
    if(pairs[i]?.[0]!==72)break;
    const type=+pairs[i++][1],edge=[];
    while(i<pairs.length&&![72,92,97].includes(pairs[i][0]))edge.push(pairs[i++]);
    let part=[];
    if(type===1)part=[{x:val(edge,10),y:val(edge,20)},{x:val(edge,11),y:val(edge,21)}];
    if(type===2||type===3){
     const cx=val(edge,10),cy=val(edge,20),rad=Math.PI/180,begin=val(edge,50)*rad,end=val(edge,51)*rad,ccw=val(edge,73,1)!==0,span=sweep(begin,end,ccw);
     const steps=Math.min(180,Math.max(8,Math.ceil(span/(Math.PI/36))));
     part=Array.from({length:steps+1},(_,q)=>{
      const a=begin+(ccw?1:-1)*span*q/steps;
      if(type===2)return{x:cx+val(edge,40)*Math.cos(a),y:cy+val(edge,40)*Math.sin(a)};
      const vx=val(edge,11),vy=val(edge,21),ratio=val(edge,40,1);
      return{x:cx+vx*Math.cos(a)-vy*ratio*Math.sin(a),y:cy+vy*Math.cos(a)+vx*ratio*Math.sin(a)};
     });
    }
    if(type===4){
     const vertices=(xc,yc)=>{const xs=edge.filter(p=>p[0]===xc).map(p=>+p[1]),ys=edge.filter(p=>p[0]===yc).map(p=>+p[1]);return xs.map((x,q)=>({x,y:ys[q]})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))};
     part=vertices(11,21);if(part.length<2)part=vertices(10,20);
     note('HATCH con borde SPLINE aproximado');
    }
    if(!part.length)warn('HATCH con borde no compatible');
    append(pts,part);
   }
   if(pairs[i]?.[0]===97){const handles=Math.min(20000,+pairs[i++][1]||0);for(let j=0;j<handles&&pairs[i]?.[0]===330;j++)i++}
   if(pts.length>2){if(distance(pts[0],pts[pts.length-1])<1e-8)pts.pop();loops.push(pts)}
  }
  return loops;
 };
 const cleanMText=raw=>String(raw||'')
  .replace(/\\U\+([0-9A-Fa-f]{4,6})/g,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
  .replace(/\\S([^;]*);/g,(_,v)=>v.replace(/[#^]/g,'/'))
  .replace(/\\p[^;]*;/g,'').replace(/\\[PX]/g,'\n').replace(/\\~/g,' ').replace(/\\([{}\\])/g,'$1')
  .replace(/\\[AaCcFfHhQqTtWw][^;]*;/g,'').replace(/\\[LlOoKk]/g,'')
  .replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±').replace(/%%[cC]/g,'Ø').replace(/[{}]/g,'');
 const polylineVertices=new Map();
 for(let i=0;i<records.length;i++)if(records[i].type==='POLYLINE'){
  const vertices=[];for(let j=i+1;j<records.length&&records[j].type!=='SEQEND';j++)if(records[j].type==='VERTEX')vertices.push({x:get(records[j],10),y:get(records[j],20),bulge:get(records[j],42)});
  polylineVertices.set(records[i],vertices);
 }
 // HATCH can reference source boundary entities by handles (DXF groups 97/330).
 // Recover their real closed geometry; never invent a hatch rectangle.
 const entitiesByHandle=new Map(records.filter(r=>str(r,5)).map(r=>[str(r,5).toUpperCase(),r]));
 const hatchSourceHandles=r=>{
  const refs=[],p=r.pairs,start=p.findIndex(x=>x[0]===91);
  if(start<0)return refs;
  for(let i=start+1;i<p.length;i++)if(p[i][0]===97){
   const count=Math.max(0,Math.min(1024,Number(p[i][1])||0));
   for(let j=0;j<count&&p[i+j+1]?.[0]===330;j++)refs.push(p[i+j+1][1].toUpperCase());
   i+=count;
  }
  return [...new Set(refs)];
 };
 const hatchAssociatedContours=r=>{
  const refs=hatchSourceHandles(r),closed=[],open=[],types={};
  const clean=pts=>pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).filter((p,i,all)=>i===0||distance(p,all[i-1])>1e-8);
  const closedLoop=pts=>{
   const ps=clean(pts);
   if(ps.length>3&&distance(ps[0],ps.at(-1))<1e-6)ps.pop();
   if(ps.length<3)return null;
   const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),extent=Math.max(...xs)-Math.min(...xs)+Math.max(...ys)-Math.min(...ys);
   const twiceArea=ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p.x*q.y-q.x*p.y},0);
   return Math.abs(twiceArea)>1e-12*Math.max(1,extent*extent)?ps:null;
  };
  for(const handle of refs){
   const src=entitiesByHandle.get(handle);
   if(!src)continue;
   types[src.type]=(types[src.type]||0)+1;
   let pts=[],isClosed=false;
   if(src.type==='LWPOLYLINE'||src.type==='POLYLINE'){
    const verts=src.type==='LWPOLYLINE'?lightPolylineVertices(src):(polylineVertices.get(src)||[]);
    isClosed=Boolean(get(src,70)&1);pts=buildPolylinePoints(verts,isClosed);
   }else if(src.type==='LINE'){
    pts=[{x:get(src,10),y:get(src,20)},{x:get(src,11),y:get(src,21)}];
   }else if(src.type==='CIRCLE'){
    const c={x:get(src,10),y:get(src,20)},rad=get(src,40);
    if(rad>0){isClosed=true;pts=Array.from({length:96},(_,i)=>{const t=i*Math.PI*2/96;return{x:c.x+rad*Math.cos(t),y:c.y+rad*Math.sin(t)}})}
   }else if(src.type==='ARC'){
    const c={x:get(src,10),y:get(src,20)},rad=get(src,40),begin=get(src,50)*Math.PI/180,end=get(src,51)*Math.PI/180;
    const sweep=(end-begin+Math.PI*2)%(Math.PI*2);
    if(rad>0&&sweep>1e-9){const n=Math.max(8,Math.ceil(sweep/(Math.PI/36)));pts=Array.from({length:n+1},(_,i)=>{const t=begin+sweep*i/n;return{x:c.x+rad*Math.cos(t),y:c.y+rad*Math.sin(t)}})}
   }else if(src.type==='ELLIPSE'){
    const c={x:get(src,10),y:get(src,20)},vx=get(src,11),vy=get(src,21),ratio=get(src,40),begin=get(src,41),end=get(src,42,Math.PI*2);
    if(Math.hypot(vx,vy)>0&&ratio>0&&end>begin){isClosed=Math.abs(end-begin-2*Math.PI)<1e-5;const n=Math.max(24,Math.ceil((end-begin)/(Math.PI/36))),steps=Math.min(n,360);pts=Array.from({length:steps+(isClosed?0:1)},(_,i)=>{const t=begin+(end-begin)*i/steps;return{x:c.x+vx*Math.cos(t)-vy*ratio*Math.sin(t),y:c.y+vy*Math.cos(t)+vx*ratio*Math.sin(t)}})}
   }
   pts=clean(pts);
   if(isClosed){const loop=closedLoop(pts);if(loop)closed.push(loop)}
   else if(pts.length>=2)open.push(pts);
  }
  // Join separate LINE/ARC edges only if endpoints match, preserving their contour.
  while(open.length){
   const chain=open.shift().slice();let extended=true;
   while(extended){extended=false;
    for(let i=0;i<open.length;i++){
     const next=open[i],first=chain[0],last=chain.at(-1),a=next[0],b=next.at(-1);
     if(distance(last,a)<1e-6)chain.push(...next.slice(1));
     else if(distance(last,b)<1e-6)chain.push(...next.slice(0,-1).reverse());
     else if(distance(first,b)<1e-6)chain.unshift(...next.slice(0,-1));
     else if(distance(first,a)<1e-6)chain.unshift(...next.slice(1).reverse());
     else continue;
     open.splice(i,1);extended=true;break;
    }
   }
   if(chain.length>=3&&distance(chain[0],chain.at(-1))<1e-6){
    const loop=closedLoop(chain);if(loop)closed.push(loop);
   }
  }
  return {loops:closed,refs,types};
 };
 const transformBlockItem=(sourceItem,transformPoint,scaleX,scaleY,rotation,groupId,insertStyle)=>{
  const item={...sourceItem,groupId,cadLayout:insertStyle?.cadLayout||sourceItem.cadLayout||'Model'},nonUniform=Math.abs(Math.abs(scaleX)-Math.abs(scaleY))>1e-9,rotated=Math.abs(rotation)>1e-9;
  if(insertStyle&&(sourceItem.layer==='0'||sourceItem.cadByBlock)){if(sourceItem.layer==='0')item.layer=insertStyle.layer;if(sourceItem.layer==='0'||sourceItem.cadByBlock)item.color=insertStyle.color;item.cadByBlock=false}
  let points=null;
  if(sourceItem.type==='circle'&&nonUniform&&sourceItem.a&&sourceItem.b){
   const center=sourceItem.a,r=distance(center,sourceItem.b);points=Array.from({length:49},(_,i)=>{const t=i/48*Math.PI*2;return transformPoint({x:center.x+r*Math.cos(t),y:center.y+r*Math.sin(t)})});
  }else if(sourceItem.type==='arc'&&nonUniform&&sourceItem.pts?.length===3){
   points=sampleArc(sourceItem.pts).map(transformPoint);
  }else if(sourceItem.type==='ellipse'&&rotated&&sourceItem.a&&sourceItem.b){
   const cx=sourceItem.a.x,cy=sourceItem.a.y,rx=Math.abs(sourceItem.b.x-cx),ry=Math.abs(sourceItem.b.y-cy);
   points=Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2;return transformPoint({x:cx+rx*Math.cos(t),y:cy+ry*Math.sin(t)})});
  }else if((sourceItem.type==='rect'||sourceItem.type==='hatch')&&rotated&&sourceItem.a&&sourceItem.b){
   const a=sourceItem.a,b=sourceItem.b;points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(transformPoint);
  }
  if(points){
   const solidHatch=sourceItem.type==='hatch'&&sourceItem.hatchPattern==='SOLID'&&Number(sourceItem.hatchOpacity??.18)===1;
   item.type=solidHatch?'polygon':'poly';item.pts=points;if(solidHatch)item.solidFill=true;delete item.a;delete item.b;
   if(sourceItem.type==='ellipse')note('elipses rotadas aproximadas');
   if(sourceItem.type==='hatch'&&!solidHatch)note('HATCH rotado convertido a contorno');
  }else{
   if(sourceItem.a)item.a=transformPoint(sourceItem.a);
   if(sourceItem.b)item.b=transformPoint(sourceItem.b);
   if(sourceItem.pts)item.pts=sourceItem.pts.map(transformPoint);
  }
  if(sourceItem.hatchLoops)item.hatchLoops=sourceItem.hatchLoops.map(loop=>loop.map(transformPoint));
  if(sourceItem.type==='text'){
   const angle=Number(sourceItem.textRotation||0)*Math.PI/180,baselineScale=Math.hypot(Math.cos(angle)*scaleX,Math.sin(angle)*scaleY),verticalScale=Math.hypot(Math.sin(angle)*scaleX,Math.cos(angle)*scaleY);
   item.textRotation=(Math.atan2(Math.sin(angle)*scaleY,Math.cos(angle)*scaleX)+rotation)*180/Math.PI;
   item.textHeightWorld=Number(sourceItem.textHeightWorld||.4)*verticalScale;
   item.textWidthFactor=Number(sourceItem.textWidthFactor||1)*baselineScale/Math.max(verticalScale,1e-9);
   if(Number(sourceItem.mtextWidthWorld)>0)item.mtextWidthWorld=Number(sourceItem.mtextWidthWorld)*baselineScale;
   if(Number(sourceItem.textFitWidthWorld)>0)item.textFitWidthWorld=Number(sourceItem.textFitWidthWorld)*baselineScale;
   if(sourceItem.textAlignmentPoint)item.textAlignmentPoint=transformPoint(sourceItem.textAlignmentPoint);
  }
  return item;
 };
 const blockLines=[];for(const [key,items] of blockRecords){const base=blockBases.get(key)||{x:0,y:0};blockLines.push('0','BLOCK','2',key,'10',String(base.x),'20',String(base.y));for(const item of items)blockLines.push('0',item.type,...item.pairs.flatMap(pair=>[String(pair[0]),pair[1]]));blockLines.push('0','ENDBLK')}
 const blockSection=['0','SECTION','2','BLOCKS',...blockLines,'0','ENDSEC'];
  const styleTableSection=['0','SECTION','2','TABLES','0','TABLE','2','STYLE'];
  for(const textStyle of textStyles.values())styleTableSection.push('0','STYLE','2',textStyle.name,'3',textStyle.fontFile,'4',textStyle.bigFontFile,'40',textStyle.fixedHeight,'41',textStyle.widthFactor,'50',textStyle.obliqueAngle,'71',textStyle.generationFlags,'42',textStyle.lastHeight);
  styleTableSection.push('0','ENDTAB','0','ENDSEC');
  const parseBlockItems=(items,depth=0)=>parseDxfEntities([...styleTableSection,...blockSection,'0','SECTION','2','ENTITIES',...items.flatMap(item=>['0',item.type,...item.pairs.flatMap(pair=>[String(pair[0]),pair[1]])]),'0','ENDSEC','0','EOF'].join('\n'),depth+1);
 const header=records.find(r=>r.type==='SECTION'&&str(r,2).toUpperCase()==='HEADER');const unitIndex=header?.pairs.findIndex(p=>p[0]===9&&p[1]==='$INSUNITS')??-1;const unitCode=unitIndex>=0?Number(header.pairs[unitIndex+1]?.[1]):0;const unitMap={4:'mm',5:'cm',6:'m'};if(unitCode&&!unitMap[unitCode])warn('unidades DXF no admitidas; valores sin convertir');out.drawingUnits=unitMap[unitCode]||null;
  const activeTabIndex=header?.pairs.findIndex(p=>p[0]===9&&p[1]==='$CTAB')??-1;
  out.activeCadLayout=activeTabIndex>=0?String(header.pairs[activeTabIndex+1]?.[1]||'Model'):'Model';
 for(const r of paperRecordsForImport){
  if(r.type==='SECTION'){inEntities=str(r,2).toUpperCase()==='ENTITIES';continue}
  if(r.type==='ENDSEC'){inEntities=false;continue}
  if(!inEntities)continue;
  const st={...style(r),cadLayout:entitySpace(r)},type=r.type;
  if(type==='SEQEND'&&activeAttributeGroup){activeAttributeGroup=null;continue}
  if(type==='POINT'){
   // DEFPOINTS is AutoCAD's non-printing dimension construction layer.
   if(str(r,8,'').toUpperCase()==='DEFPOINTS')continue;
   out.push({type:'point',a:{x:get(r,10),y:get(r,20)},z:get(r,30,0),...st});
  }
  else if(type==='LINE')out.push({type:'line',a:{x:get(r,10),y:get(r,20)},b:{x:get(r,11),y:get(r,21)},...st});
  else if(type==='CIRCLE'){const a={x:get(r,10),y:get(r,20)},rad=get(r,40);out.push({type:'circle',a,b:{x:a.x+rad,y:a.y},...st})}
  else if(type==='LWPOLYLINE'){const vertices=lightPolylineVertices(r),closed=Boolean(get(r,70,0)&1),pts=buildPolylinePoints(vertices,closed);if(vertices.some(v=>Math.abs(v.bulge)>1e-9))note('polilíneas curvas aproximadas');if(pts.length>1)out.push({type:closed?'polygon':'poly',pts,elevation:r.pairs.some(pair=>pair[0]===38)?get(r,38,0):undefined,...st})}
  else if(type==='POLYLINE'){
   const flags=get(r,70,0),vertices=polylineVertices.get(r.originalRecord||r)||[];
   if(flags&(8|16|64)){warn('polilíneas 3D o malla no compatibles omitidas');continue}
   if(vertices.length<2){warn('POLYLINE sin vértices omitida');continue}
   const closed=Boolean(flags&1),pts=buildPolylinePoints(vertices,closed);
   if(pts.length>1)out.push({type:closed?'polygon':'poly',pts,...st});
   if(vertices.some(v=>Math.abs(v.bulge)>1e-9))note('polilíneas curvas aproximadas');
  }
  else if(type==='ARC'){const a={x:get(r,10),y:get(r,20)},rad=get(r,40),a1=get(r,50)*Math.PI/180,a2=get(r,51)*Math.PI/180,span=(a2-a1+Math.PI*2)%(Math.PI*2);if(rad>0&&span>0){const pts=[a1,a1+span/2,a1+span].map(t=>({x:a.x+rad*Math.cos(t),y:a.y+rad*Math.sin(t)}));out.push({type:'arc',pts,...st})}else warn('arcos no válidos omitidos')}
  else if(type==='INSERT'||type==='MINSERT'){
   const name=str(r,2).toUpperCase(),geometry=blockRecords.get(name),depth=Number(arguments[1]||0);
   const scaleX=get(r,41,1),scaleY=get(r,42,1),rotation=get(r,50)*Math.PI/180;
   const columns=Math.max(1,Math.round(get(r,70,1))),rows=Math.max(1,Math.round(get(r,71,1)));
   if(!geometry?.length||depth>=5||!Number.isFinite(scaleX)||!Number.isFinite(scaleY)||Math.abs(scaleX)<1e-9||Math.abs(scaleY)<1e-9||columns*rows>256){warn('INSERT no compatible omitido');continue}
   const pieces=parseBlockItems(geometry,depth),base=blockBases.get(name)||{x:0,y:0},origin={x:get(r,10),y:get(r,20)},cos=Math.cos(rotation),sin=Math.sin(rotation);
   const linkedAttributes=get(r,66)===1,attributeTags=insertAttributeTags.get(r)||new Set();
   const displayPieces=pieces.filter(p=>!p.cadAttributeTemplate||p.cadAttributeConstant||!attributeTags.has(String(p.cadAttributeTag||'').toUpperCase()));
   for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const transformPoint=p=>{const x=(p.x-base.x+column*get(r,44))*scaleX,y=(p.y-base.y+row*get(r,45))*scaleY;return{x:origin.x+x*cos-y*sin,y:origin.y+x*sin+y*cos}};
    const groupId='dxf-insert-'+depth+'-'+out.length+'-'+row+'-'+column;
    for(const piece of displayPieces)out.push(transformBlockItem(piece,transformPoint,scaleX,scaleY,rotation,groupId,st));
   }
   if(columns*rows>1)note('MINSERT expandido a entidades editables');
   note('INSERT/MINSERT importado como grupo editable');
   if(linkedAttributes)activeAttributeGroup='dxf-insert-'+depth+'-'+(out.length-displayPieces.length)+'-0-0';
   const recoveredHatches=pieces.filter(item=>item.cadHatchRecovery==='degenerate-solid').length;if(recoveredHatches)note('INSERT '+name+': '+recoveredHatches+' HATCH sólido degenerado recuperado como línea');
   if(pieces.importWarnings?.length){warn('INSERT con entidades no compatibles');diagnose('INSERT '+name,pieces.importWarningCounts);diagnose('INSERT '+name,pieces.importDiagnostics)}
  }
  else if(type==='DIMENSION'){
   if(Number(arguments[1]||0)>=5){warn('DIMENSION con anidación excesiva omitida');continue}
   const geometry=blockRecords.get(str(r,2).toUpperCase());
   if(!geometry?.length){warn('DIMENSION sin geometría gráfica omitida');continue}
   const pieces=parseBlockItems(geometry,Number(arguments[1]||0));
   if(!pieces.length){warn('DIMENSION sin entidades compatibles omitida');continue}
   const groupId='dxf-dimension-'+out.length;
   for(const item of pieces)out.push({...item,groupId,cadLayout:st.cadLayout,layer:item.layer==='0'?st.layer:item.layer,color:item.layer==='0'?st.color:item.color});
   note('DIMENSION dibujada como geometría no asociativa');
   if(pieces.importWarnings?.length){warn('DIMENSION con elementos gráficos no compatibles');diagnose('DIMENSION',pieces.importWarningCounts);diagnose('DIMENSION',pieces.importDiagnostics)}
  }
  else if(type==='HATCH'){
   const loops=hatchBoundaries(r),solid=get(r,70)===1,pattern=solid?'SOLID':str(r,2,'ANSI31');let degenerateBoundary=[];
   if(!loops.length){
    // Some DWG->DXF writers retain vertex pairs but omit the HATCH path markers.
    // Recover only a real non-collinear contour; never fabricate one from a bounding box.
    const vertices=[],boundaryStart=r.pairs.findIndex(p=>p[0]===91);for(let i=boundaryStart<0?r.pairs.length:boundaryStart+1;i<r.pairs.length-1;i++){
     if(r.pairs[i][0]===10&&r.pairs[i+1][0]===20){
      const x=Number(r.pairs[i][1]),y=Number(r.pairs[i+1][1]);
      if(Number.isFinite(x)&&Number.isFinite(y)&&(!vertices.length||Math.hypot(x-vertices.at(-1).x,y-vertices.at(-1).y)>1e-9))vertices.push({x,y});
     }
    }
    if(vertices.length>3&&distance(vertices[0],vertices.at(-1))<1e-9)vertices.pop();
    const area=vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-q.x*p.y},0);
    if(vertices.length>=3&&Math.abs(area)>1e-8){loops.push(vertices);note('HATCH con borde reconstruido desde vértices DXF')}else if(solid&&vertices.length===2&&distance(vertices[0],vertices[1])>1e-9){degenerateBoundary=vertices}
   }
   let association={loops:[],refs:[],types:{}};
   if(!loops.length){
    association=hatchAssociatedContours(r);
    if(association.loops.length){loops.push(...association.loops);note('HATCH recuperado desde contornos asociativos del plano')}
   }
   const pts=loops[0];
   if(!pts?.length){
    if(solid&&degenerateBoundary.length===2){out.push({type:'line',a:degenerateBoundary[0],b:degenerateBoundary[1],...st,cadSourceEntity:'HATCH',cadHatchRecovery:'degenerate-solid'});note('HATCH sólido degenerado recuperado como segmento lineal');continue}
    warn('HATCH sin contorno compatible omitido');
    const paths=get(r,91,-1),vertices=r.pairs.filter(p=>p[0]===10).length;
    diagnose('HATCH capa='+st.layer+' handle='+str(r,5,'?')+' patrón='+pattern,{['rutas='+paths+', vértices='+vertices+', referencias='+association.refs.length+', entidades asociadas='+(Object.keys(association.types).join('/')||'ninguna')+', códigos='+[...new Set(r.pairs.map(p=>p[0]))].join('/')]:1});
    continue;
   }
   const minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x)),miny=Math.min(...pts.map(p=>p.y)),maxy=Math.max(...pts.map(p=>p.y));
   const corners=new Set(pts.map(p=>p.x+','+p.y));
   const rectangular=loops.length===1&&pts.length===4&&minx<maxx&&miny<maxy&&[[minx,miny],[maxx,miny],[maxx,maxy],[minx,maxy]].every(([x,y])=>corners.has(x+','+y));
   const hatchSpacingWorld=Math.hypot(get(r,45),get(r,46))||Math.max((maxx-minx+maxy-miny)/50,.01);
   const gradient=get(r,450)===1,rgbGradient=r.pairs.filter(p=>p[0]===421).slice(0,2).map(p=>'#'+(Number(p[1])&0xffffff).toString(16).padStart(6,'0'));
   const patternLines=solid?[]:hatchPatternDefinitions(r);
   const appearance={...st,hatchPattern:pattern,hatchOpacity:solid?1:(st.cadOpacity??1),hatchSpacingWorld,hatchAngle:get(r,52,45),hatchPatternLines:patternLines,
    hatchGradientColors:gradient&&rgbGradient.length?rgbGradient:null,hatchGradientAngle:get(r,460)*180/Math.PI,importedHatch:true};
   if(rectangular&&solid)out.push({type:'hatch',a:{x:minx,y:miny},b:{x:maxx,y:maxy},...appearance});
   else out.push({type:'polygon',pts,hatchLoops:loops,solidFill:solid,...appearance});
   if(!solid&&!patternLines.length)note('HATCH con trama visual aproximada');
  }
  else if(type==='ELLIPSE'){
   const a={x:get(r,10),y:get(r,20)},vx=get(r,11),vy=get(r,21),ratio=get(r,40),begin=get(r,41),end=get(r,42,Math.PI*2),length=Math.hypot(vx,vy);
   const full=Math.abs((end-begin)-2*Math.PI)<1e-6,aligned=Math.abs(vx)<1e-9||Math.abs(vy)<1e-9;
   if(length>0&&ratio>0&&ratio<=1&&full&&aligned){const rx=Math.abs(vx)+Math.abs(vy)*ratio,ry=Math.abs(vy)+Math.abs(vx)*ratio;out.push({type:'ellipse',a,b:{x:a.x+rx,y:a.y+ry},...st})}
   else if(length>0&&ratio>0&&end>begin){const pts=Array.from({length:65},(_,i)=>{const t=begin+(end-begin)*i/64;return{x:a.x+vx*Math.cos(t)-vy*ratio*Math.sin(t),y:a.y+vy*Math.cos(t)+vx*ratio*Math.sin(t)}});out.push({type:'poly',pts,...st});note('elipses rotadas o parciales simplificadas')}
   else warn('elipses no válidas omitidas');
  }
  else if(type==='TEXT'||type==='MTEXT'||type==='ATTRIB'||type==='ATTDEF'){
   if((type==='ATTDEF'||type==='ATTRIB')&&(get(r,70)&1))continue; // invisible CAD attributes stay hidden
   const raw=type==='MTEXT'?r.pairs.filter(p=>p[0]===3||p[0]===1).map(p=>p[1]).join(''):str(r,1,'');
   const value=type==='MTEXT'?cleanMText(raw):raw;
   if(type==='MTEXT'&&/\\(?:[AaCcFfHhQqTtWw]|p|S)/.test(raw))note('MTEXT con formato visual aproximado');
   const styleName=str(r,7,'STANDARD')||'STANDARD',textStyle=textStyles.get(styleName.toUpperCase())||{name:styleName,fontFile:'txt.shx',bigFontFile:'',fixedHeight:0,widthFactor:1,obliqueAngle:0,generationFlags:0,lastHeight:0};
   const entityHeight=get(r,40,0),height=entityHeight>1e-9?entityHeight:(textStyle.fixedHeight>1e-9?textStyle.fixedHeight:(textStyle.lastHeight>1e-9?textStyle.lastHeight:.4));
   const vx=get(r,11,1),vy=get(r,21,0),rotation=r.pairs.some(p=>p[0]===50)?get(r,50):(type==='MTEXT'?Math.atan2(vy,vx)*180/Math.PI:0);
   const item={type:'text',a:{x:get(r,10),y:get(r,20)},text:value,textRotation:rotation,textHeightWorld:height,textStyleName:styleName,textFontFile:textStyle.fontFile,textBigFontFile:textStyle.bigFontFile,textFontFamily:cadFontFamilyFromFile(textStyle.fontFile),textFontBold:/(?:bd|bold|bi)\.(?:ttf|otf)$/i.test(textStyle.fontFile),textFontItalic:/(?:italic|oblique|i|it|z|bi)\.(?:ttf|otf)$/i.test(textStyle.fontFile),textWidthFactor:type==='MTEXT'?textStyle.widthFactor:(get(r,41,textStyle.widthFactor)||textStyle.widthFactor),textObliqueAngle:type==='MTEXT'?textStyle.obliqueAngle:get(r,51,textStyle.obliqueAngle),textGenerationFlags:type==='MTEXT'?textStyle.generationFlags:get(r,71,textStyle.generationFlags),textStyleGenerationFlags:textStyle.generationFlags,textStyleFixedHeight:textStyle.fixedHeight,textStyleWidthFactor:textStyle.widthFactor,textStyleObliqueAngle:textStyle.obliqueAngle,...st};
   if(type!=='MTEXT'){
    item.textHorizontalAlignment=get(r,72,0);item.textVerticalAlignment=get(r,73,0);
    if(r.pairs.some(p=>p[0]===11)&&r.pairs.some(p=>p[0]===21)){item.textAlignmentPoint={x:get(r,11),y:get(r,21)};item.textFitWidthWorld=distance(item.a,item.textAlignmentPoint)}
   }else{
    item.isMText=true;item.mtextRaw=raw;item.mtextPlain=value;item.mtextWidthWorld=Math.max(0,get(r,41,0));item.mtextAttachment=Math.max(1,Math.min(9,Math.round(get(r,71,1))));item.mtextLineSpacingFactor=get(r,44,1);item.mtextLineSpacingStyle=get(r,73,1);
   }
   if(type==='ATTDEF'){item.cadAttributeTemplate=true;item.cadAttributeConstant=Boolean(get(r,70)&2);item.cadAttributeTag=str(r,2,'')}
   if(type==='ATTRIB'){item.cadAttributeTag=str(r,2,'');if(activeAttributeGroup)item.groupId=activeAttributeGroup;}
   out.push(item);
  }
  else if(type==='MULTILEADER'||type==='MLEADER'){
   const fragments=r.pairs.filter(([code])=>code===304).map(([,value])=>value);
   const raw=fragments.join('');
   const value=cleanMText(raw);
   const positionCode=r.pairs.some(p=>p[0]===12)&&r.pairs.some(p=>p[0]===22)?12:10;
   const loc={x:get(r,positionCode),y:get(r,positionCode+10)};
   const height=get(r,44,0)>1e-8?get(r,44):get(r,41,0);
   if(value.trim()&&Number.isFinite(loc.x)&&Number.isFinite(loc.y)){
    out.push({type:'text',a:loc,text:value,isMText:true,cadSourceEntity:'MLEADER',textHeightWorld:height>1e-8?height:.25,mtextWidthWorld:Math.max(0,get(r,43,0)),mtextAttachment:get(r,171,1),mtextRaw:raw,textWidthFactor:1,textRotation:0,...st});
    note('Texto de MULTILEADER recuperado; geometría de flecha no asociativa');
   }else{
    warn('MULTILEADER sin contenido MText utilizable');
   }
  }
  else if(type==='SOLID'||type==='TRACE'||type==='3DFACE'){
   // AutoCAD SOLID/TRACE vertex order is 1-2-4-3 (not 1-2-3-4).
   // The previous outline-only import lost the opaque gray areas of many floor plans.
   const order=type==='3DFACE'?[10,11,12,13]:[10,11,13,12];
   const pts=order.filter(code=>r.pairs.some(pair=>pair[0]===code)).map(code=>({x:get(r,code),y:get(r,code+10),z:get(r,code+20,0)}));
   while(pts.length>3&&distance(pts.at(-1),pts.at(-2))<1e-9)pts.pop();
   if(pts.length>=3)out.push({type:'polygon',pts,solidFill:true,importedHatch:true,civilTin:type==='3DFACE',hatchOpacity:1,cadSourceEntity:type,...st});
   else warn(type+' no compatible omitido');
   if(type==='3DFACE')note('3DFACE conservada como geometría triangular 3D');
  }
  else if(type==='SPLINE'){
   const fitX=all(r,11),fitY=all(r,21),controlX=all(r,10),controlY=all(r,20),xs=fitX.length>=2?fitX:controlX,ys=fitY.length>=2?fitY:controlY,pts=xs.map((x,i)=>({x,y:ys[i]??0}));
   if(pts.length>=2){out.push({type:'poly',pts,...st});note(fitX.length>=2?'SPLINE aproximada por puntos de ajuste':'SPLINE aproximada por puntos de control')}else warn('SPLINE sin puntos compatibles omitida');
  }
  else if(type==='LEADER'){
   const xs=all(r,10),ys=all(r,20),pts=xs.map((x,i)=>({x,y:ys[i]??0}));
   if(pts.length>=2)out.push({type:'poly',pts,...st});else warn('LEADER sin vértices omitida');
  }
  else if(type==='VIEWPORT'){
    const vp={layout:st.cadLayout,center:{x:get(r,10),y:get(r,20)},width:get(r,40),height:get(r,41),viewCenter:{x:get(r,12)+get(r,17),y:get(r,22)+get(r,27)},viewHeight:get(r,45),viewCenterKnown:r.pairs.some(p=>p[0]===12&&Number.isFinite(Number(p[1])))&&r.pairs.some(p=>p[0]===22&&Number.isFinite(Number(p[1]))),twist:get(r,51),status:get(r,68,1),id:get(r,69)};
    if(st.cadLayout!=='Model'&&(vp.id!==1||vp.viewHeight>0)){(out.layoutViewports??=[]).push(vp);note(vp.width>0&&vp.height>0?'VIEWPORT de presentación preservado para vista en papel':'VIEWPORT con tamaño faltante conservado para recuperación provisional')}
   }
  else if(type==='VERTEX'||type==='SEQEND'){}
  else warn(type+' omitido');
 }
 const layoutMap=new Map(importedLayouts.map(info=>[info.name.toLowerCase(),info]));
 for(const obj of out){
  if(!obj.cadLayout||obj.cadLayout==='Model')continue;
  if(!layoutMap.has(obj.cadLayout.toLowerCase()))layoutMap.set(obj.cadLayout.toLowerCase(),{name:obj.cadLayout,paperWidth:420,paperHeight:297,margin:8,tabOrder:layoutMap.size+1,source:'entity'});
 }
 for(const vp of out.layoutViewports||[]){
  if(vp.layout==='Model')continue;
  if(!layoutMap.has(vp.layout.toLowerCase()))layoutMap.set(vp.layout.toLowerCase(),{name:vp.layout,paperWidth:420,paperHeight:297,margin:8,tabOrder:layoutMap.size+1,source:'viewport'});
 }
 out.layoutDefinitions=[...layoutMap.values()].sort((a,b)=>a.tabOrder-b.tabOrder);
 if(out.layoutDefinitions.length)note('Modelo y '+out.layoutDefinitions.length+' presentaciones diferenciados');
 if(paperSpaceRecords.length)note(paperSpaceRecords.length+' entidades originales recuperadas desde BLOCKS de Layout');
 out.paperBlockRecovery={recovered:paperSpaceRecords.length,breakdown:paperBlockBreakdown,unmatched:unknownPaperBlocks};
 out.importWarnings=Object.entries(warnings).map(([name,count])=>count+' '+name);
 out.importNotes=Object.entries(notes).map(([name,count])=>count+' '+name);
 out.importWarningCounts={...warnings};out.importDiagnostics=diagnostics;
 return out;
}
async function download(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type:type||'application/octet-stream'});if(window.OtroCadAndroid&&typeof window.OtroCadAndroid.saveFile==='function'){try{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));window.OtroCadAndroid.saveFile(name,type||'application/octet-stream',btoa(binary));return}catch(err){console.error(err)}}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
$('#project').onclick=()=>download('otrocad.json',JSON.stringify({version:3,shapes:objects,layouts,viewports:layoutViewportRecords,geolocation:typeof window==='undefined'?null:window.OtroCadGeolocation?.getState()||null},null,2),'application/json');
$('#export').onclick=()=>{let s='<svg xmlns="http://www.w3.org/2000/svg"><g fill="none">';const attrs=o=>' stroke="'+(o.color||colors[o.layer]||colors.General)+'" stroke-width="'+(o.lineweight||.25)+'"'+(o.linetype==='DASHED'?' stroke-dasharray="6 4"':'');objects.forEach(o=>{const a=o.a,b=o.b,at=attrs(o);if(o.type==='dim'||o.type==='dimaligned'){const g=dimensionGeometry(o);if(g){for(const [u,v] of [[a,g.a],[b,g.b],[g.a,g.b]])s+='<line'+at+' x1="'+u.x+'" y1="'+(-u.y)+'" x2="'+v.x+'" y2="'+(-v.y)+'"/>';s+='<text'+at+' x="'+g.mid.x+'" y="'+(-g.mid.y)+'">'+g.length.toFixed(2)+' '+units+'</text>'}}else if(o.type==='line')s+='<line'+at+' x1="'+a.x+'" y1="'+(-a.y)+'" x2="'+b.x+'" y2="'+(-b.y)+'"/>';else if(o.type==='point')s+='<circle'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" r="0.05"/>';else if(o.type==='circle')s+='<circle'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" r="'+distance(a,b)+'"/>';else if(o.type==='rect'||o.type==='hatch')s+='<rect'+at+' x="'+Math.min(a.x,b.x)+'" y="'+(-Math.max(a.y,b.y))+'" width="'+Math.abs(b.x-a.x)+'" height="'+Math.abs(b.y-a.y)+'"/>';else if(o.type==='ellipse')s+='<ellipse'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" rx="'+Math.abs(b.x-a.x)+'" ry="'+Math.abs(b.y-a.y)+'"/>';else if(o.pts)s+='<polyline'+at+' points="'+o.pts.map(p=>p.x+','+(-p.y)).join(' ')+'"/>';else if(o.type==='text')s+='<text'+at+' x="'+a.x+'" y="'+(-a.y)+'">'+String(o.text||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</text>'});download('otrocad.svg',s+'</g></svg>','image/svg+xml')};
function buildDxf(){
 const arcGeometry=points=>{
  if(!points||points.length!==3)return null;
  const [a,b,c]=points,d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-9)return null;
  const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
  const x=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;
  const deg=p=>(Math.atan2(p.y-y,p.x-x)*180/Math.PI+360)%360,angleA=deg(a),angleB=deg(b),angleC=deg(c),span=(v=>(v+360)%360);
  return {x,y,r:Math.hypot(a.x-x,a.y-y),start:span(angleB-angleA)<=span(angleC-angleA)?angleA:angleC,end:span(angleB-angleA)<=span(angleC-angleA)?angleC:angleA};
 };
 const dxfLayer=o=>String(o.layer||'General').replace(/[\x00-\x1f<>/\\":;?*|=]/g,'_').slice(0,255)||'General';
 const renamedLayers=objects.filter(o=>dxfLayer(o)!==String(o.layer||'General')).length;
 const groups=new Set(objects.map(o=>o.groupId).filter(Boolean));
 const approximated=objects.filter(o=>['dim','dimaligned','leader'].includes(o.type)||(o.type==='hatch'&&(o.hatchPattern!=='SOLID'||Number(o.hatchOpacity??.18)!==1))||(o.type==='polygon'&&o.hatchPattern&&o.hatchPattern!=='SOLID')||(o.type==='arc'&&!arcGeometry(o.pts)));
 const unsupported=objects.filter(o=>!['line','dim','dimaligned','leader','circle','rect','hatch','poly','polygon','arc','ellipse','text','point'].includes(o.type)||(o.type==='ellipse'&&(!o.a||!o.b||o.a.x===o.b.x||o.a.y===o.b.y)));
 const paperLayoutsForExport=typeof layouts!=='undefined'&&Array.isArray(layouts)?layouts:[];const paperViewportsForExport=typeof layoutViewportRecords!=='undefined'&&Array.isArray(layoutViewportRecords)?layoutViewportRecords:[];
 if((approximated.length||unsupported.length||renamedLayers||groups.size||paperLayoutsForExport.length||paperViewportsForExport.length)&&!confirm('Este DXF aún no conserva todos los elementos con fidelidad: '+approximated.length+' simplificados, '+unsupported.length+' omitidos, '+renamedLayers+' capas renombradas, '+groups.size+' bloques desagrupados. '+(paperLayoutsForExport.length?'Hay '+paperLayoutsForExport.length+' hoja(s) cuya configuración de impresión o ventanas gráficas no se guardarán íntegramente en DXF; se conservarán las etiquetas de espacio de las entidades. ':'')+'Descarga también una copia de respaldo OtroCAD para conservar tus layouts. ¿Exportar?'))return null;
 const rows=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1021','9','$INSUNITS','70',String(({mm:4,cm:5,m:6})[units]||0),'0','ENDSEC'];
 const add=(...v)=>rows.push(...v.map(String));
 add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',5,'ABCD',100,'AcDbSymbolTable',70,2);
 add(0,'LTYPE',100,'AcDbSymbolTableRecord',100,'AcDbLinetypeTableRecord',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0);
 add(0,'LTYPE',100,'AcDbSymbolTableRecord',100,'AcDbLinetypeTableRecord',2,'DASHED',70,0,3,'Dashed',72,65,73,2,40,.75,49,.5,74,0,49,-.25,74,0);
 add(0,'ENDTAB');
 const layers=[...new Set(['0',...objects.map(dxfLayer)])];
  add(0,'TABLE',2,'LAYER',5,'ABCE',100,'AcDbSymbolTable',70,layers.length);
  layers.forEach(layer=>add(0,'LAYER',100,'AcDbSymbolTableRecord',100,'AcDbLayerTableRecord',2,layer,70,0,62,7,6,'CONTINUOUS'));
  add(0,'ENDTAB');
  const dxfTextStyleName=o=>String(o.textStyleName||'STANDARD').replace(/[\x00-\x1f<>/\\":;?*|=]/g,'_').slice(0,255)||'STANDARD';
  const textStyleMap=new Map();
  for(const o of objects.filter(item=>item.type==='text')){const name=dxfTextStyleName(o);if(!textStyleMap.has(name))textStyleMap.set(name,{fontFile:o.textFontFile||'txt.shx',bigFontFile:o.textBigFontFile||'',fixedHeight:Number(o.textStyleFixedHeight)||0,widthFactor:Number(o.textStyleWidthFactor)||1,obliqueAngle:Number(o.textStyleObliqueAngle)||0,generationFlags:Number(o.textStyleGenerationFlags??o.textGenerationFlags)||0,lastHeight:Number(o.textHeightWorld)||.2})}
  if(!textStyleMap.has('STANDARD'))textStyleMap.set('STANDARD',{fontFile:'txt.shx',bigFontFile:'',fixedHeight:0,widthFactor:1,obliqueAngle:0,generationFlags:0,lastHeight:.2});
  add(0,'TABLE',2,'STYLE',5,'ABCF',100,'AcDbSymbolTable',70,textStyleMap.size);
  for(const [name,style] of textStyleMap)add(0,'STYLE',100,'AcDbSymbolTableRecord',100,'AcDbTextStyleTableRecord',2,name,70,0,40,style.fixedHeight,41,style.widthFactor,50,style.obliqueAngle,71,style.generationFlags,42,style.lastHeight,3,style.fontFile,4,style.bigFontFile);
  add(0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
 objects.forEach(o=>{
  const a=o.a,b=o.b,layer=dxfLayer(o),color=String(o.color||colors[layer]||colors.General),rgb=/^#[0-9a-f]{6}$/i.test(color)?parseInt(color.slice(1),16):0xffffff;
  const space=String(o.cadLayout||'Model');const opacity=Math.max(0,Math.min(1,Number(o.cadOpacity??o.hatchOpacity??1)));const transparency=opacity<.999999?[440,0x02000000|Math.round(opacity*255)]:[];const common=[100,'AcDbEntity',8,layer,67,space==='Model'?0:1,410,space,370,Math.round(Number(o.lineweight||.25)*100),6,o.linetype==='DASHED'?'DASHED':'CONTINUOUS',420,rgb,...transparency];
  const line=(p,q)=>add(0,'LINE',...common,100,'AcDbLine',10,p.x,20,p.y,30,0,11,q.x,21,q.y,31,0);
  const textEntity=(p,value,height,rotation=0,source={})=>{
    const valueText=String(value||'').replace(/\r/g,''),styleName=dxfTextStyleName(source),widthFactor=Number(source.textWidthFactor||1),oblique=Number(source.textObliqueAngle||0);
    if(Boolean(source.isMText)||valueText.includes('\n')||Number(source.mtextWidthWorld)>0)add(0,'MTEXT',...common,100,'AcDbMText',10,p.x,20,p.y,30,0,40,height,41,Number(source.mtextWidthWorld||0),44,Number(source.mtextLineSpacingFactor||1),71,Number(source.mtextAttachment||1),50,rotation,7,styleName,1,valueText.replace(/\n/g,'\\P'));
    else{add(0,'TEXT',...common,100,'AcDbText',10,p.x,20,p.y,30,0,40,height,41,widthFactor,50,rotation,51,oblique,7,styleName,71,Number(source.textGenerationFlags||0),72,Number(source.textHorizontalAlignment||0),73,Number(source.textVerticalAlignment||0),1,valueText);if(source.textAlignmentPoint)add(11,source.textAlignmentPoint.x,21,source.textAlignmentPoint.y,31,0)}
   };
  if(['dim','dimaligned'].includes(o.type)&&a&&b){const g=dimensionGeometry(o);if(g){line(a,g.a);line(b,g.b);line(g.a,g.b);textEntity(g.mid,g.length.toFixed(2)+' '+units,12/zoom)}}
  else if(['line','leader'].includes(o.type)&&a&&b){line(a,b);if(o.type==='leader'&&o.text)textEntity(b,o.text,12/zoom)}
  else if(o.type==='point'&&a)add(0,'POINT',...common,100,'AcDbPoint',10,a.x,20,a.y,30,Number(o.z)||0);
  else if(o.type==='text'&&a){if(o.mtextRaw&&o.text===o.mtextPlain)add(0,'MTEXT',...common,100,'AcDbMText',10,a.x,20,a.y,30,0,40,o.textHeightWorld||.4,41,Number(o.mtextWidthWorld||0),44,Number(o.mtextLineSpacingFactor||1),71,Number(o.mtextAttachment||1),50,o.textRotation||0,7,dxfTextStyleName(o),1,o.mtextRaw);else textEntity(a,o.text,o.textHeightWorld||Number(o.textHeight||14)/zoom,o.textRotation||0,o)}
  else if(o.type==='circle'&&a&&b)add(0,'CIRCLE',...common,100,'AcDbCircle',10,a.x,20,a.y,30,0,40,distance(a,b));
  else if(o.type==='arc'&&arcGeometry(o.pts)){const g=arcGeometry(o.pts);add(0,'ARC',...common,100,'AcDbCircle',10,g.x,20,g.y,30,0,40,g.r,100,'AcDbArc',50,g.start,51,g.end)}
  else if(o.type==='ellipse'&&a&&b&&a.x!==b.x&&a.y!==b.y){const rx=Math.abs(b.x-a.x),ry=Math.abs(b.y-a.y),horizontal=rx>=ry;add(0,'ELLIPSE',...common,100,'AcDbEllipse',10,a.x,20,a.y,30,0,11,horizontal?rx:0,21,horizontal?0:ry,31,0,40,Math.min(rx,ry)/Math.max(rx,ry),41,0,42,Math.PI*2)}
  else if(o.civilTin&&o.pts?.length>=3){const face=o.pts.slice(0,4);while(face.length<4)face.push(face[face.length-1]);add(0,'3DFACE',...common,100,'AcDbFace',10,face[0].x,20,face[0].y,30,Number(face[0].z)||0,11,face[1].x,21,face[1].y,31,Number(face[1].z)||0,12,face[2].x,22,face[2].y,32,Number(face[2].z)||0,13,face[3].x,23,face[3].y,33,Number(face[3].z)||0,70,0)}
   else if(o.type==='polygon'&&(o.solidFill||o.hatchPattern)&&o.pts?.length>=3){
    const loops=o.hatchLoops?.length?o.hatchLoops:[o.pts],solid=Boolean(o.solidFill),pattern=solid?'SOLID':o.hatchPattern;
    add(0,'HATCH',...common,100,'AcDbHatch',10,0,20,0,30,0,210,0,220,0,230,1,2,pattern,70,solid?1:0,71,0,91,loops.length);
    for(const loop of loops){add(92,3,72,0,73,1,93,loop.length);for(const p of loop)add(10,p.x,20,p.y);add(97,0)}
    add(75,1,76,1);
    if(!solid){const angle=Number(o.hatchAngle||45),spacing=Math.max(.0001,Number(o.hatchSpacingWorld||.2));add(52,angle,41,1,77,0,78,1,53,angle,43,0,44,0,45,0,46,spacing,79,0)}
    add(98,0);
   }
   else if(o.type==='hatch'&&o.hatchPattern==='SOLID'&&Number(o.hatchOpacity??.18)===1&&a&&b){const ps=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];add(0,'HATCH',...common,100,'AcDbHatch',10,0,20,0,30,0,210,0,220,0,230,1,2,'SOLID',70,1,71,0,91,1,92,3,72,0,73,1,93,4);ps.forEach(p=>add(10,p.x,20,p.y));add(97,0,75,1,76,1,98,0)}
  else if((o.type==='rect'||o.type==='hatch')&&a&&b){const ps=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];add(0,'LWPOLYLINE',...common,100,'AcDbPolyline',90,4,70,1);ps.forEach(p=>add(10,p.x,20,p.y))}
  else if(o.pts){add(0,'LWPOLYLINE',...common,100,'AcDbPolyline',90,o.pts.length,70,o.type==='polygon'?1:0,...(Number.isFinite(Number(o.elevation))?[38,Number(o.elevation)]:[]));o.pts.forEach(p=>add(10,p.x,20,p.y))}
 });
 add(0,'ENDSEC',0,'EOF');return rows.join('\r\n')+'\r\n';
}
$('#dxf').onclick=()=>{const data=buildDxf();if(data!==null)download('otrocad.dxf',data,'application/dxf')};
$('#pdf').onclick=()=>{
 if(activeLayout==='Model'){
  ensureCadLayout();
  switchCadLayout(paperLayoutsSafe()[0].name);
 }
 const layout=paperLayoutsSafe().find(l=>l.name===activeLayout),styleId='cadDynamicPageSize';
 let css=document.getElementById(styleId);if(!css){css=document.createElement('style');css.id=styleId;document.head.append(css)}
 css.textContent='@page {size: '+(layout?.paperWidth||420)+'mm '+(layout?.paperHeight||297)+'mm; margin:0}';
 window.print();
};
$('#propertiesBtn').onclick=()=>{$('#properties').classList.toggle('open');showProperties()};
$('#zoomIn').onclick=()=>{zoom*=1.2;render()};$('#zoomOut').onclick=()=>{zoom/=1.2;render()};
function boundsPoints(o){
 const pts=[];if(o.type==='text')pts.push(...cadTextBoundsWorld(o));if(o.a)pts.push(o.a);if(o.b)pts.push(o.b);if(o.pts)pts.push(...o.pts);if(o.hatchLoops)for(const loop of o.hatchLoops)pts.push(...loop);
 if(o.type==='circle'&&o.a&&o.b){const r=distance(o.a,o.b);pts.push({x:o.a.x-r,y:o.a.y-r},{x:o.a.x+r,y:o.a.y+r})}
 if(o.type==='ellipse'&&o.a&&o.b){const rx=Math.abs(o.b.x-o.a.x),ry=Math.abs(o.b.y-o.a.y);pts.push({x:o.a.x-rx,y:o.a.y-ry},{x:o.a.x+rx,y:o.a.y+ry})}
 if(o.type==='arc'&&o.pts?.length>=3){const g=arcParams(o.pts);if(g){const span=v=>(v+2*Math.PI)%(2*Math.PI);for(const t of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const onArc=g.anticlockwise?span(g.a1-t)<=span(g.a1-g.a3):span(t-g.a1)<=span(g.a3-g.a1);if(onArc)pts.push(world({x:g.x+g.r*Math.cos(t),y:g.y+g.r*Math.sin(t)}))}}}
 return pts.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
}
$('#fit').onclick=()=>{const ps=objects.filter(isVisibleModelEntity).flatMap(boundsPoints);if(!ps.length){offset={x:0,y:0};zoom=35;render();return}const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);const availableWidth=Math.max(20,canvas.clientWidth-80),availableHeight=Math.max(20,canvas.clientHeight-80);zoom=Math.min(MAX_MODEL_ZOOM,Math.max(.001,Math.min(availableWidth/(maxx-minx||1),availableHeight/(maxy-miny||1))));offset.x=-(minx+maxx)/2*zoom;offset.y=(miny+maxy)/2*zoom;render()};
$('#settingsBtn').onclick=showDraftSettings;$('#draftQuick').onclick=showDraftSettings;$('#snapBtn').onclick=showDraftSettings;$('#unitsBtn').onclick=showDraftSettings;
$('#layer').onchange=()=>{$('#drawColor').value=colors[$('#layer').value]||colors.General};
$('#newLayer').onclick=()=>{const name=prompt('Nombre de la nueva capa');if(name){const op=document.createElement('option');op.textContent=name;$('#layer').append(op);$('#layer').value=name;colors[name]='#62b8e8'}};
$('#layerColor').onclick=()=>{const c=prompt('Color HEX (ej. #62b8e8)',colors[$('#layer').value]||'#62b8e8');if(c&&/^#[0-9a-f]{6}$/i.test(c)){colors[$('#layer').value]=c;$('#drawColor').value=c}};
$('#layerVisibility').onclick=()=>{const l=$('#layer').value;if(hiddenLayers.has(l)){hiddenLayers.delete(l);$('#layerVisibility').textContent='Ocultar capa';status.textContent='Capa '+l+' visible'}else{hiddenLayers.add(l);$('#layerVisibility').textContent='Mostrar capa';status.textContent='Capa '+l+' oculta';applySelection(selectedItems().filter(i=>objects[i]?.layer!==l))}render()};
$('#layerLock').onclick=()=>{const l=$('#layer').value;if(lockedLayers.has(l)){lockedLayers.delete(l);$('#layerLock').textContent='Bloquear capa';status.textContent='Capa '+l+' desbloqueada'}else{lockedLayers.add(l);$('#layerLock').textContent='Desbloquear capa';status.textContent='Capa '+l+' bloqueada';applySelection(selectedItems().filter(i=>objects[i]?.layer!==l))}render()};
$('#erase').onclick=async()=>{if(selectedItems().length){deleteSelection();return}if(!confirm('¿Borrar todo el dibujo? Primero se guardará una copia recuperable.'))return;if(!await protectDrawingBeforeReplacement())return;pushReplacementUndo();objects=[];clearSelection();save();render()};
try{const saved=JSON.parse(localStorage.getItem('otrocad-drawing')||'[]');if(Array.isArray(saved))objects=saved}catch(e){}
try{const sheet=JSON.parse(localStorage.getItem('otrocad-layout-state')||'{}');
 if(Array.isArray(sheet.layouts))layouts=sheet.layouts;if(Array.isArray(sheet.viewports))layoutViewportRecords=sheet.viewports;
 if(typeof sheet.activeLayout==='string'&&layouts.some(l=>l.name===sheet.activeLayout))activeLayout=sheet.activeLayout;
 hideModelAnnotations=Boolean(sheet.hideModelAnnotations);
}catch(e){console.warn('Configuración de papel omitida:',e)}
ensureCadLayout();refreshLayoutTabs();
$('#paperCreate').onclick=createCadLayout;
$('#paperSetup').onclick=showCadPaperSettings;
$('#paperViewports').onclick=showCadViewportManager;
$('#toggleAnnotations').onclick=()=>{hideModelAnnotations=!hideModelAnnotations;refreshLayoutTabs();saveLayoutState();render();status.textContent=hideModelAnnotations?'Textos de Modelo ocultos (no borrados)':'Textos de Modelo visibles'};
window.addEventListener('beforeprint',()=>{printing=true;render()});window.addEventListener('afterprint',()=>{printing=false;render()});

window.OtroCadCivilAPI={
 getObjects:()=>objects,
 getSelectedObjects:()=>selectedItems().map(i=>objects[i]).filter(Boolean),
 getUnits:()=>units,
 startDrawingTool:t=>{setTool(t);stage.focus({preventScroll:true});return tool===t},
 getActiveTool:()=>tool,
 getDraftPath:()=>clone(poly.concat(temp?.b?[temp.b]:[])),
 getDraftPoint:()=>snapPoint(world(cursor)),
 finishDrawing:()=>finishPoly(),
 setCurrentLayer:(name,color)=>{if(lockedLayers.has(name)){status.textContent='La capa '+name+' está bloqueada';return false}window.OtroCadCivilAPI.ensureLayer(name,color);$('#layer').value=name;$('#drawColor').value=color||colors[name];return true},
 getView:()=>({center:world({x:canvas.clientWidth/2,y:canvas.clientHeight/2}),pixelsPerUnit:zoom}),
 repaint:()=>render(),
 setView:(center,pixelsPerUnit=zoom)=>{
  if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y)||!Number.isFinite(pixelsPerUnit)||pixelsPerUnit<=0)return false;
  if(activeLayout!=='Model')switchCadLayout('Model');
  zoom=Math.max(.000001,Math.min(MAX_MODEL_ZOOM,pixelsPerUnit));offset.x=-center.x*zoom;offset.y=center.y*zoom;render();return true;
 },
 setStatus:value=>{status.textContent=String(value||'')},
 ensureLayer:(name,color)=>{
  if(color)colors[name]=color;
  const select=$('#layer');
  if(select&&![...select.options].some(option=>option.value===name||option.textContent===name)){
   const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);
  }
 },
 addObjects:(items,message)=>{
  const valid=(Array.isArray(items)?items:[]).filter(item=>item&&typeof item==='object');
  if(!valid.length)return false;
  checkpoint();objects.push(...valid);
  const saved=save();render();
  status.textContent=String(message||('Añadidas '+valid.length+' entidades Civil'))+(saved?'':' · respaldo local pendiente');
  return saved;
 },
 // One Undo checkpoint for a whole generated CAD design, despite progressive visual commits.
 addObjectsAnimated:async(items,{batchSize=12,delayMs=45,signal,onProgress,message}={})=>{
  const valid=(Array.isArray(items)?items:[]).filter(item=>item&&typeof item==='object');
  if(!valid.length)throw Error('No hay entidades para dibujar.');
  if(valid.length>4000)throw Error('El diseño IA supera el límite seguro de entidades.');
  if(window.OtroCadAIStreamBusy)throw Error('Ya hay un dibujo IA en ejecución.');
  window.OtroCadAIStreamBusy=true;
  const chunk=Math.max(1,Math.min(100,Math.round(Number(batchSize)||12)));
  const delay=Math.max(0,Math.min(500,Math.round(Number(delayMs)||45)));
  const inserted=new Set();
  checkpoint();
  try{
   for(let i=0;i<valid.length;i+=chunk){
    if(signal?.aborted)throw Error('Dibujo cancelado por el usuario.');
    const group=valid.slice(i,i+chunk);
    objects.push(...group);group.forEach(o=>inserted.add(o));
    render();onProgress?.(Math.min(valid.length,i+group.length),valid.length);
    if(i+chunk<valid.length&&delay)await new Promise(resolve=>setTimeout(resolve,delay));
   }
   const saved=save();render();
   status.textContent=String(message||('El Arqui IA · '+valid.length+' entidades CAD editables'))+(saved?'':' · respaldo local pendiente');
   return {count:valid.length,saved};
  }catch(error){
   // Cancel only this batch without affecting the user's existing drawing.
   objects=objects.filter(o=>!inserted.has(o));
   save();render();status.textContent=String(error.message||error);
   throw error;
  }finally{window.OtroCadAIStreamBusy=false}
 },

 replaceObjects:(predicate,items,message)=>{
  if(typeof predicate!=='function')return false;
  const valid=(Array.isArray(items)?items:[]).filter(item=>item&&typeof item==='object');
  checkpoint();objects=objects.filter(item=>!predicate(item));objects.push(...valid);
  const saved=save();render();
  status.textContent=String(message||('Actualizados elementos Civil · '+valid.length))+(saved?'':' · respaldo local pendiente');
  return saved;
 },
 removeObjects:(predicate,message)=>{
  if(typeof predicate!=='function')return false;
  if(!objects.some(predicate))return false;
  checkpoint();objects=objects.filter(item=>!predicate(item));
  const saved=save();render();
  status.textContent=String(message||'Elementos Civil eliminados')+(saved?'':' · respaldo local pendiente');
  return true;
 },
 updateSelected:patch=>{
  const ids=selectedItems();if(!ids.length)return 0;
  checkpoint();ids.forEach(i=>Object.assign(objects[i],patch||{}));save();render();return ids.length;
 },
 fit:()=>$('#fit').click()
};

// Consolidated DWG / DXF / native project saving. The existing DWG engine
// must round-trip its own output before a potentially invalid file is offered.
let cadLastFile=null;
function safeDrawingFilename(name,format){
 const root=String(name||'OtroCAD-Proyecto').trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')
  .replace(/\.(dwg|dxf|json)$/i,'').replace(/[. ]+$/,'');
 if(!root||root.length>150)throw Error('Escribe un nombre válido (máximo 150 caracteres).');
 return root+'.'+format;
}
async function drawingContent(format){
 if(format==='json')return new Blob([JSON.stringify({
   version:3,shapes:objects,units,layouts,viewports:layoutViewportRecords,
   geolocation:window.OtroCadGeolocation?.getState()||null},null,2)],{type:'application/json'});
 const dxf=buildDxf();if(dxf===null)throw Error('No fue posible crear un archivo DXF válido.');
 if(format==='dxf')return new Blob([dxf],{type:'application/dxf'});
 if(format!=='dwg')throw Error('Formato de archivo no compatible.');
 const engine=await getDwgRuntime(),bytes=engine.dxf_to_dwg(new TextEncoder().encode(dxf));
 if(!(bytes instanceof Uint8Array)||bytes.length<6||
  new TextDecoder().decode(bytes.subarray(0,6))!=='AC1032')
  throw Error('El motor no produjo un DWG AC1032 válido. Guardar como DXF es la alternativa.');
 const reconstructed=engine.dwg_to_dxf(bytes),check=parseDxfEntities(new TextDecoder('utf-8').decode(reconstructed));
 const expected=parseDxfEntities(dxf);
 if(!check.length||check.length!==expected.length)
  throw Error('El DWG no pasó la comprobación de entidades: '+check.length+' / '+expected.length+'. No se guardó un archivo potencialmente corrupto.');
 return new Blob([bytes],{type:'application/acad'});
}
async function saveDrawingAs(format='dwg',name='OtroCAD-Proyecto',reuse=false){
 if(!['dwg','dxf','json'].includes(format))throw Error('Formato desconocido: '+format);
 const filename=safeDrawingFilename(name,format),mime={dwg:'application/acad',dxf:'application/dxf',json:'application/json'}[format];
 let handle=reuse&&cadLastFile?.format===format?cadLastFile.handle:null;
 if(!handle&&typeof window.showSaveFilePicker==='function'&&!window.OtroCadAndroid){
  try{handle=await window.showSaveFilePicker({
   suggestedName:filename,types:[{description:'Archivo '+format.toUpperCase(),accept:{[mime]:['.'+format]}}],
   excludeAcceptAllOption:false
  })}catch(error){if(error.name==='AbortError')return{cancelled:true};throw error}
 }
 status.textContent='Guardando '+filename+'…';
 const blob=await drawingContent(format);
 if(handle){
  const writer=await handle.createWritable();
  try{await writer.write(blob);await writer.close()}catch(err){try{await writer.abort()}catch(_){}throw err}
 }else await download(filename,blob,mime);
 cadLastFile={handle:handle||null,format,name:filename};
 await persistCadProgress(true);
 status.textContent=handle?'Guardado: '+filename:'Archivo '+filename+' enviado a Descargas';
 window.OtroCadSaveUI?.updateCurrent?.(filename);
 return {filename,format,bytes:blob.size,mode:handle?'file':'download'};
}
window.OtroCadFileCore={
 saveAs:saveDrawingAs,
 async saveCurrent(){
  if(cadLastFile?.handle)return saveDrawingAs(cadLastFile.format,cadLastFile.name,true);
  return{requiresSaveAs:true};
 },
 filename:()=>cadLastFile?.name||null,
 persistProgress:()=>persistCadProgress(true),
 async restoreProgress(slot='autosave-latest'){
  if(!['autosave-latest','autosave-previous'].includes(slot))throw Error('Punto de recuperación inválido.');
  const data=cadRecoveryRestoreCandidate(await cadRecoveryRead(slot));
  if(!data?.shapes?.length)throw Error('No hay copias automáticas para recuperar.');
  if(!await protectDrawingBeforeReplacement())throw Error('No se pudo respaldar el plano actual.');
  pushReplacementUndo();objects=clone(data.shapes);
  if(['m','cm','mm'].includes(data.units))units=data.units;
  if(Array.isArray(data.layouts))layouts=clone(data.layouts);
  if(Array.isArray(data.viewports))layoutViewportRecords=clone(data.viewports);
  activeLayout=layouts.some(x=>x.name===data.activeLayout)?data.activeLayout:'Model';
  clearSelection();saveLayoutState();refreshLayoutTabs();save();render();
  return {count:objects.length,date:data.savedAt};
 },
 getProgressDates:async()=>{
  const data=await Promise.all(['autosave-latest','autosave-previous'].map(id=>cadRecoveryRead(id).catch(()=>null)));
  return data.map(x=>x?.savedAt||null);
 },
 saveLocal:()=>{const ok=save();void persistCadProgress(true);return ok}
};
$('#saveAsDwg').onclick=()=>{if(window.OtroCadSaveUI)window.OtroCadSaveUI.open('dwg');else void saveDrawingAs('dwg').catch(e=>alert(e.message))};
$('#saveAsDxf').onclick=()=>{if(window.OtroCadSaveUI)window.OtroCadSaveUI.open('dxf');else void saveDrawingAs('dxf').catch(e=>alert(e.message))};
window.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'&&cadAutosaveDirty)void persistCadProgress(true);
});
setInterval(()=>{if(cadAutosaveDirty)void persistCadProgress(true)},60000);
new ResizeObserver(resize).observe(stage);setTool('line');resize();
})();
