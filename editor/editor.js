(()=>{
const $=s=>document.querySelector(s), canvas=$('#cad'),ctx=canvas.getContext('2d'),stage=$('#stage'),status=$('#status'),promptEl=$('#prompt');
let objects=[],undo=[],redo=[],tool='line',start=null,temp=null,selected=-1,selectedSet=new Set(),modifyTargets=[],poly=[],arcPoints=[],cursor={x:0,y:0},zoom=35,offset={x:0,y:0},drag=null;
let lastCommand='',cursorCommandEl=null,contextMenuEl=null,activeFurniture=null;
function newGroupId(){return 'bloque-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
let rightClickMode='context',rightClickDuringCommand='enter';
try{const prefs=JSON.parse(localStorage.getItem('otrocad-mouse-preferences')||'{}');if(['context','repeat'].includes(prefs.mode))rightClickMode=prefs.mode;if(['enter','context'].includes(prefs.active))rightClickDuringCommand=prefs.active}catch(e){}
let gridOn=true,orthoOn=false,snapOn=false,osnapOn=true,osEnd=true,osMid=true,osCenter=true,osQuadrant=false,osIntersection=false,osNearest=false,osParallel=false,osGeom=false,osInsertion=false,osTangent=false,osExtension=false,osApparent=false,osPerpendicular=false,parallelDirection=null,polarOn=false,crossOn=true,moveBase=null,modifyTarget=-1,polySides=6,offsetDistance=1,offsetDistancePreset=false,printing=false,units='m',gridStep=1,polarStep=15,snapRadius=12,hiddenLayers=new Set(),lockedLayers=new Set();
try{const savedUnits=localStorage.getItem('otrocad-units');if(['m','cm','mm'].includes(savedUnits))units=savedUnits}catch(e){}
try{const p=JSON.parse(localStorage.getItem('otrocad-drafting')||'{}');if(typeof p.gridOn==='boolean')gridOn=p.gridOn;if(typeof p.orthoOn==='boolean')orthoOn=p.orthoOn;if(typeof p.snapOn==='boolean')snapOn=p.snapOn;if(typeof p.osnapOn==='boolean')osnapOn=p.osnapOn;if(typeof p.osEnd==='boolean')osEnd=p.osEnd;if(typeof p.osMid==='boolean')osMid=p.osMid;if(typeof p.osCenter==='boolean')osCenter=p.osCenter;if(typeof p.osQuadrant==='boolean')osQuadrant=p.osQuadrant;if(typeof p.osIntersection==='boolean')osIntersection=p.osIntersection;if(typeof p.osNearest==='boolean')osNearest=p.osNearest;if(typeof p.osParallel==='boolean')osParallel=p.osParallel;if(typeof p.osGeom==='boolean')osGeom=p.osGeom;if(typeof p.osInsertion==='boolean')osInsertion=p.osInsertion;if(typeof p.osTangent==='boolean')osTangent=p.osTangent;if(typeof p.osExtension==='boolean')osExtension=p.osExtension;if(typeof p.osApparent==='boolean')osApparent=p.osApparent;if(typeof p.osPerpendicular==='boolean')osPerpendicular=p.osPerpendicular;if(typeof p.polarOn==='boolean')polarOn=p.polarOn;if(typeof p.crossOn==='boolean')crossOn=p.crossOn;if(Number.isFinite(p.gridStep)&&p.gridStep>0)gridStep=p.gridStep;if(Number.isFinite(p.polarStep)&&p.polarStep>=1&&p.polarStep<=90)polarStep=p.polarStep;if(Number.isFinite(p.snapRadius)&&p.snapRadius>=2&&p.snapRadius<=40)snapRadius=p.snapRadius}catch(e){}
function saveDraftPreferences(){try{localStorage.setItem('otrocad-drafting',JSON.stringify({gridOn,orthoOn,snapOn,osnapOn,osEnd,osMid,osCenter,osQuadrant,osIntersection,osNearest,osParallel,osGeom,osPerpendicular,polarOn,crossOn,gridStep,polarStep,snapRadius}))}catch(e){}}
const colors={General:'#dce8f5',Muros:'#56b7e8',Cotas:'#f3c83e',Detalles:'#c69cff',Topografía:'#70d6a3',Vialidad:'#ff9b6b'};
function resolveCadColor(s,lightBackground=false){
 const base=String((!lightBackground&&s.colorDark)||s.color||colors[s.layer]||colors.General).toLowerCase();
 if(base==='auto'||base==='#dce8f5')return lightBackground?'#111111':'#ffffff';
 return base;
}
function canvasIsLight(){
 if(printing)return true;
 const bg=getComputedStyle($('#stage')).backgroundColor;
 const values=bg.match(/[0-9.]+/g);
 if(!values||values.length<3)return false;
 const [r,g,b]=values.slice(0,3).map(Number);
 return (0.2126*r+0.7152*g+0.0722*b)>145;
}
const clone=x=>JSON.parse(JSON.stringify(x));
let storageWarningShown=false;
function storageWarning(){if(!storageWarningShown){storageWarningShown=true;alert('No se pudo guardar la copia local. Descarga una copia del proyecto y comprueba el espacio o los permisos del navegador.')}}
function backupPrevious(){try{localStorage.setItem('otrocad-drawing-previous',JSON.stringify({shapes:objects,units}));return true}catch(e){storageWarning();return false}}
function checkpoint(){const backedUp=backupPrevious();undo.push(clone(objects));if(undo.length>100)undo.shift();redo=[];return backedUp}
function selectedItems(){const out=new Set(selectedSet);if(selected>=0)out.add(selected);return [...out].filter(i=>i>=0&&i<objects.length).sort((a,b)=>a-b)}
function applySelection(indices,additive=false){const next=additive?new Set(selectedItems()):new Set(),groups=new Set();for(const i of indices)if(i>=0&&i<objects.length){next.add(i);if(objects[i]?.groupId)groups.add(objects[i].groupId)}if(groups.size)objects.forEach((o,j)=>{if(groups.has(o.groupId)&&!hiddenLayers.has(o.layer)&&!lockedLayers.has(o.layer))next.add(j)});selectedSet=next;selected=next.size?[...next].sort((a,b)=>a-b).at(-1):-1}
function clearSelection(){selected=-1;selectedSet.clear()}
function deleteSelection(){const ids=selectedItems();if(!ids.length)return;checkpoint();ids.sort((a,b)=>b-a).forEach(i=>objects.splice(i,1));clearSelection();save();render();status.textContent=ids.length===1?'Objeto eliminado':ids.length+' objetos eliminados'}
function save(){try{localStorage.setItem('otrocad-drawing',JSON.stringify(objects));localStorage.setItem('otrocad-units',units);return true}catch(e){storageWarning();return false}}
function world(p){return{x:(p.x-canvas.clientWidth/2-offset.x)/zoom,y:(canvas.clientHeight/2+offset.y-p.y)/zoom}}
function screen(p){return{x:canvas.clientWidth/2+offset.x+p.x*zoom,y:canvas.clientHeight/2+offset.y-p.y*zoom}}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function round(p){return{x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}
function normalize(a){return (a%360+360)%360}
let activeSnap=null;
function snapCandidate(p){
 if(!osnapOn)return null;
 let best=null,limit=snapRadius/zoom;
 for(const s of objects){
  if(hiddenLayers.has(s.layer))continue;
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
  for(const s of objects){if(hiddenLayers.has(s.layer)||!['line','poly','polygon','rect'].includes(s.type))continue;for(const [a,b] of entitySegments(s)){if(pointLineDistance(p,a,b)<=radius){near.push([a,b]);if(near.length>=256)break}}if(near.length>=256)break}
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const hit=lineIntersection(near[i][0],near[i][1],near[j][0],near[j][1],true);if(hit){const d=distance(p,hit);if(d<limit){limit=d;best={point:{x:hit.x,y:hit.y},type:'INTERSECCIÓN'}}}}
 }

 if(typeof osGeom!=='undefined'&&osGeom){for(const shape of objects){if(hiddenLayers.has(shape.layer))continue;let point=null;if(shape.type==='rect'&&shape.a&&shape.b)point={x:(shape.a.x+shape.b.x)/2,y:(shape.a.y+shape.b.y)/2};else if(shape.type==='polygon'&&shape.pts?.length>=3){let area=0,x=0,y=0;for(let i=0;i<shape.pts.length;i++){const a=shape.pts[i],b=shape.pts[(i+1)%shape.pts.length],v=a.x*b.y-b.x*a.y;area+=v;x+=(a.x+b.x)*v;y+=(a.y+b.y)*v}if(Math.abs(area)>1e-12)point={x:x/(3*area),y:y/(3*area)}}if(point){const d=distance(p,point);if(d<limit){limit=d;best={point,type:'CENTRO GEOMÉTRICO'}}}}}
 if(typeof osInsertion!=='undefined'&&osInsertion){for(const shape of objects){if(hiddenLayers.has(shape.layer)||shape.type!=='text'||!shape.a)continue;const d=distance(p,shape.a);if(d<limit){limit=d;best={point:shape.a,type:'INSERCIÓN'}}}}
 if(typeof osTangent!=='undefined'&&osTangent&&typeof start!=='undefined'&&start){for(const shape of objects){if(hiddenLayers.has(shape.layer)||shape.type!=='circle'||!shape.a||!shape.b)continue;const dx=start.x-shape.a.x,dy=start.y-shape.a.y,r=distance(shape.a,shape.b),d2=dx*dx+dy*dy;if(d2<r*r||d2<1e-18)continue;const k=r*r/d2,h=r*Math.sqrt(Math.max(0,d2-r*r))/d2;for(const sign of [-1,1]){const point={x:shape.a.x+k*dx-sign*h*dy,y:shape.a.y+k*dy+sign*h*dx},d=distance(p,point);if(d<limit){limit=d;best={point,type:'TANGENTE'}}}}}
 if(typeof osExtension!=='undefined'&&osExtension){for(const shape of objects){if(hiddenLayers.has(shape.layer)||shape.type!=='line'||!shape.a||!shape.b)continue;const a=shape.a,b=shape.b,dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/den;if(t>=0&&t<=1)continue;const point={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,point);if(d<limit){limit=d;best={point,type:'EXTENSIÓN'}}}}
 if(typeof osApparent!=='undefined'&&osApparent){const lines=objects.filter(s=>s.type==='line'&&s.a&&s.b&&!hiddenLayers.has(s.layer)).slice(0,128);for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const hit=lineIntersection(lines[i].a,lines[i].b,lines[j].a,lines[j].b,false);if(!hit)continue;const d=distance(p,hit);if(d<limit){limit=d;best={point:{x:hit.x,y:hit.y},type:'INTERSECCIÓN APARENTE'}}}}
 if(typeof osPerpendicular!=='undefined'&&osPerpendicular&&typeof start!=='undefined'&&start){
  for(const shape of objects){if(hiddenLayers.has(shape.layer)||!['line','poly','polygon','rect'].includes(shape.type))continue;for(const [a,b] of entitySegments(shape)){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=((start.x-a.x)*dx+(start.y-a.y)*dy)/den;if(t<0||t>1)continue;const point={x:a.x+t*dx,y:a.y+t*dy},d=distance(p,point);if(d<limit){limit=d;best={point,type:'PERPENDICULAR'}}}}
 }
 if(typeof osNearest!=='undefined'&&osNearest&&!best){
  for(const shape of objects){if(hiddenLayers.has(shape.layer))continue;
   if(shape.type==='circle'&&shape.a&&shape.b){const r=distance(shape.a,shape.b),d=distance(p,shape.a);if(d>1e-12){const point={x:shape.a.x+(p.x-shape.a.x)*r/d,y:shape.a.y+(p.y-shape.a.y)*r/d},delta=distance(p,point);if(delta<limit){limit=delta;best={point,type:'MÁS CERCANO'}}}continue}
   if(!['line','poly','polygon','rect','leader','dim','dimaligned'].includes(shape.type))continue;
   for(const [a,b] of entitySegments(shape)){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(den<1e-18)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)),point={x:a.x+t*dx,y:a.y+t*dy},delta=distance(p,point);if(delta<limit){limit=delta;best={point,type:'MÁS CERCANO'}}}
  }
 }
 return best;
}
function snapPoint(p){
 const candidate=snapCandidate(p);activeSnap=candidate;
 if(candidate)return {...candidate.point};
 const q={...p};
 if(snapOn){q.x=Math.round(q.x/gridStep)*gridStep;q.y=Math.round(q.y/gridStep)*gridStep}
 return q;
}

function constrain(p){
 const base=tool==='poly'&&poly.length?poly[poly.length-1]:start;
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
function drawEntity(s,sel=false,preview=false){
 ctx.save();const color=resolveCadColor(s,canvasIsLight());ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=preview?1.5:(sel?2.2:Math.max(.8,Math.min(8,Number(s.lineweight||.25)*2.4)));ctx.setLineDash(preview?[8,6]:(s.linetype==='DASHED'?[8,5]:[]));ctx.lineDashOffset=0;ctx.globalAlpha=preview?.95:1;
 const a=s.a&&screen(s.a),b=s.b&&screen(s.b);
 if(s.type==='point'){ctx.beginPath();ctx.moveTo(a.x-4,a.y);ctx.lineTo(a.x+4,a.y);ctx.moveTo(a.x,a.y-4);ctx.lineTo(a.x,a.y+4);ctx.stroke()}
 else if(s.type==='line'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 else if(s.type==='poly'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.stroke()}
 else if(s.type==='arc'){const g=arcParams(s.pts);if(g){ctx.beginPath();ctx.arc(g.x,g.y,g.r,g.a1,g.a3,g.anticlockwise);ctx.stroke()}else{const ps=s.pts.map(screen);ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ctx.quadraticCurveTo(ps[1].x,ps[1].y,ps[2].x,ps[2].y);ctx.stroke()}}
 else if(s.type==='leader'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.font='12px system-ui';ctx.fillText(s.text||'',b.x+4,b.y-4)}
 else if(s.type==='circle'){ctx.beginPath();ctx.arc(a.x,a.y,distance(a,b),0,Math.PI*2);ctx.stroke()}
 else if(s.type==='rect'||s.type==='hatch'){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);ctx.strokeRect(x,y,w,h);if(s.type==='hatch'){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.lineWidth=.8;const spacing=Math.max(5,Math.min(60,Number(s.hatchSpacing||10)));const pattern=s.hatchPattern||'ANSI31';if(pattern==='SOLID'){ctx.globalAlpha=Math.max(0,Math.min(1,Number(s.hatchOpacity??.18)));ctx.fillRect(x,y,w,h)}else{const lines=(reverse)=>{for(let k=-h-w;k<w+h*2;k+=spacing){ctx.beginPath();if(reverse){ctx.moveTo(x+k,y);ctx.lineTo(x+k-h,y+h)}else{ctx.moveTo(x+k,y);ctx.lineTo(x+k+h,y+h)}ctx.stroke()}};lines(false);if(pattern==='CROSS')lines(true);if(pattern==='GRID'){for(let k=0;k<w;k+=spacing){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k,y+h);ctx.stroke()}for(let k=0;k<h;k+=spacing){ctx.beginPath();ctx.moveTo(x,y+k);ctx.lineTo(x+w,y+k);ctx.stroke()}}}ctx.restore()}}
 else if(s.type==='ellipse'){ctx.beginPath();ctx.ellipse(a.x,a.y,Math.abs(b.x-a.x),Math.abs(b.y-a.y),0,0,Math.PI*2);ctx.stroke()}
 else if(s.type==='polygon'){
  const loops=s.hatchLoops?.length?s.hatchLoops:[s.pts],allPoints=[];
  ctx.beginPath();
  for(const loop of loops){loop.forEach((p,i)=>{const v=screen(p);allPoints.push(v);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.closePath()}
  if(s.solidFill&&!preview)ctx.fill('evenodd');
  else if(s.hatchPattern&&!preview&&allPoints.length){
   ctx.save();ctx.clip('evenodd');ctx.globalAlpha=Math.max(.1,Math.min(1,Number(s.hatchOpacity??.65)));
   const xs=allPoints.map(p=>p.x),ys=allPoints.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
   const radius=Math.min(30000,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))+20);
   const spacing=Math.max(5,Math.min(100,Math.abs(Number(s.hatchSpacingWorld)||.2)*zoom));
   ctx.translate(cx,cy);ctx.rotate(-Number(s.hatchAngle||45)*Math.PI/180);ctx.lineWidth=.8;
   let lines=0;for(let x=-radius;x<=radius&&lines<800;x+=spacing,lines++){ctx.beginPath();ctx.moveTo(x,-radius);ctx.lineTo(x,radius);ctx.stroke()}
   ctx.restore();
  }
  ctx.stroke();
 }
 else if(s.type==='dim'||s.type==='dimaligned'){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-4,a.y-4);ctx.lineTo(a.x+4,a.y+4);ctx.moveTo(b.x-4,b.y-4);ctx.lineTo(b.x+4,b.y+4);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle=resolveCadColor(s,canvasIsLight());ctx.fillText(distance(s.a,s.b).toFixed(2)+' '+units,(mid.x+7),(mid.y-8))}
 else if(s.type==='text'){const size=s.textHeightWorld?Math.max(1,Number(s.textHeightWorld)*zoom):Number(s.textHeight||14);ctx.font=size+'px system-ui';ctx.translate(a.x,a.y);ctx.rotate(-Number(s.textRotation||0)*Math.PI/180);String(s.text||'Texto').split('\n').forEach((line,i)=>ctx.fillText(line,0,i*size*1.2))}
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
function updateDynamic(){
 const anchor=activeAnchor();if(!anchor||!temp){$('#dynamic').style.display='none';return}
 $('#dynamic').style.display='flex';
 $('#dynamic label').textContent='LONGITUD ('+units+')';
 const len=distance(anchor,temp.b),ang=normalize(angle(anchor,temp.b));
 if(document.activeElement!==$('#dynLen'))$('#dynLen').value=len.toFixed(3);
 if(document.activeElement!==$('#dynAngle'))$('#dynAngle').value=ang.toFixed(1);
}
function showDraftSettings(){
 const dlg=document.createElement('dialog');
 dlg.style.cssText='border:1px solid #536a80;border-radius:10px;background:#172333;color:#e8eef6;max-width:92vw;width:430px;padding:18px;box-shadow:0 16px 50px #0009';
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
 <fieldset style="border:1px solid #536a80;border-radius:6px;display:grid;gap:7px"><legend>Referencias a objetos · OSNAP</legend><label><input id="setOsEnd" type="checkbox" ${osEnd?'checked':''}> Punto final (Endpoint)</label><label><input id="setOsMid" type="checkbox" ${osMid?'checked':''}> Punto medio (Midpoint)</label><label><input id="setOsCenter" type="checkbox" ${osCenter?'checked':''}> Centro (Center)</label><label><input id="setOsQuadrant" type="checkbox" ${osQuadrant?'checked':''}> Cuadrante (Quadrant)</label><label><input id="setOsIntersection" type="checkbox" ${osIntersection?'checked':''}> Intersección de segmentos</label><label><input id="setOsNearest" type="checkbox" ${osNearest?'checked':''}> Punto más cercano (Nearest)</label><label><input id="setOsParallel" type="checkbox" ${osParallel?'checked':''}> Paralelo (Parallel)</label><label><input id="setGeom" type="checkbox" ${osGeom?'checked':''}> Centro geométrico</label><label><input id="setInsertion" type="checkbox" ${osInsertion?'checked':''}> Inserción de texto</label><label><input id="setTangent" type="checkbox" ${osTangent?'checked':''}> Tangente (círculo)</label><label><input id="setExtension" type="checkbox" ${osExtension?'checked':''}> Extensión (líneas)</label><label><input id="setApparent" type="checkbox" ${osApparent?'checked':''}> Intersección aparente (2D)</label><label><input id="setOsPerpendicular" type="checkbox" ${osPerpendicular?'checked':''}> Perpendicular</label></fieldset>
 <fieldset style="border:1px solid #536a80;border-radius:6px;display:grid;gap:9px"><legend>Mouse · Botón derecho</legend><label>Cuando no hay un comando activo<select id="setRightClickMode" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="context">Mostrar menú contextual</option><option value="repeat">Repetir última acción</option></select></label><label>Durante un comando<select id="setRightClickActive" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="enter">Funcionar como Enter</option><option value="context">Mostrar menú contextual</option></select></label><small style="color:#aebed2">Si eliges repetir, Shift + clic derecho abre el menú contextual.</small></fieldset>
 <label>Unidades de dibujo <select id="setUnits" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option><option value="mm">Milímetros (mm)</option></select></label>
 <label>Espaciado de rejilla <input id="setGridStep" type="number" min="0.001" step="0.1" value="${gridStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Incremento polar (grados) <input id="setPolarStep" type="number" min="1" max="90" step="1" value="${polarStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Radio de referencias (px) <input id="setSnapRadius" type="number" min="2" max="40" step="1" value="${snapRadius}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <div style="display:flex;justify-content:flex-end;gap:8px"><button id="cancelSettings" type="button">Cancelar</button><button id="applySettings" type="button" style="background:#f3c83e;color:#101b2e;font-weight:800">Aplicar</button></div>
 </form>`;
 document.body.append(dlg);dlg.querySelector('#setUnits').value=units;dlg.querySelector('#setRightClickMode').value=rightClickMode;dlg.querySelector('#setRightClickActive').value=rightClickDuringCommand;
 dlg.querySelector('#cancelSettings').onclick=()=>dlg.close();
 dlg.querySelector('#applySettings').onclick=()=>{
  gridOn=dlg.querySelector('#setGrid').checked;snapOn=dlg.querySelector('#setSnap').checked;orthoOn=dlg.querySelector('#setOrtho').checked;polarOn=dlg.querySelector('#setPolar').checked;osnapOn=dlg.querySelector('#setOsnap').checked;osEnd=dlg.querySelector('#setOsEnd').checked;osMid=dlg.querySelector('#setOsMid').checked;osCenter=dlg.querySelector('#setOsCenter').checked;osQuadrant=dlg.querySelector('#setOsQuadrant').checked;osIntersection=dlg.querySelector('#setOsIntersection').checked;osNearest=dlg.querySelector('#setOsNearest').checked;osParallel=dlg.querySelector('#setOsParallel').checked;osGeom=dlg.querySelector('#setGeom').checked;osInsertion=dlg.querySelector('#setInsertion').checked;osTangent=dlg.querySelector('#setTangent').checked;osExtension=dlg.querySelector('#setExtension').checked;osApparent=dlg.querySelector('#setApparent').checked;osPerpendicular=dlg.querySelector('#setOsPerpendicular').checked;crossOn=dlg.querySelector('#setCross').checked;
  units=dlg.querySelector('#setUnits').value;gridStep=Math.max(.001,Number(dlg.querySelector('#setGridStep').value)||1);polarStep=Math.max(1,Math.min(90,Number(dlg.querySelector('#setPolarStep').value)||15));snapRadius=Math.max(2,Math.min(40,Number(dlg.querySelector('#setSnapRadius').value)||12));
  for(const [id,on] of [['gridToggle',gridOn],['snapToggle',snapOn],['orthoToggle',orthoOn],['polarToggle',polarOn],['osnapToggle',osnapOn],['crossToggle',crossOn]])updateToggle('#'+id,on);rightClickMode=dlg.querySelector('#setRightClickMode').value;rightClickDuringCommand=dlg.querySelector('#setRightClickActive').value;try{localStorage.setItem('otrocad-mouse-preferences',JSON.stringify({mode:rightClickMode,active:rightClickDuringCommand}))}catch(e){}saveDraftPreferences();save();dlg.close();status.textContent='Drafting Settings aplicado · botón derecho configurado';render();
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
function updatePrompt(){promptEl.textContent=tool==='select'?'SELECCIÓN · dos clics o arrastra · izquierda→derecha: VENTANA · derecha→izquierda: CRUCE':((start||poly.length)?'Siguiente punto · longitud y ángulo editables':('Comando: '+tool.toUpperCase()))}
function render(){
 const finish=$('#finish-poly');finish.hidden=tool!=='poly'||poly.length===0;finish.disabled=poly.length<2;
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle=printing?'#ffffff':(getComputedStyle($('#stage')).backgroundColor||'#101820');ctx.fillRect(0,0,w,h);if(!printing)drawGrid(w,h);
 objects.forEach((s,i)=>{if(!hiddenLayers.has(s.layer))drawEntity(s,i===selected||selectedSet.has(i))});
 drawSelectionGrips();if(!printing&&activeSnap&&osnapOn){const sp=screen(activeSnap.point);ctx.save();ctx.strokeStyle='#ffdc45';ctx.fillStyle='#ffdc45';ctx.lineWidth=2;ctx.beginPath();if(activeSnap.type==='CENTRO')ctx.arc(sp.x,sp.y,6,0,Math.PI*2);else if(activeSnap.type==='PUNTO MEDIO'){ctx.moveTo(sp.x,sp.y-7);ctx.lineTo(sp.x-7,sp.y+6);ctx.lineTo(sp.x+7,sp.y+6);ctx.closePath()}else ctx.rect(sp.x-6,sp.y-6,12,12);ctx.stroke();ctx.font='11px system-ui';ctx.fillText(activeSnap.type,sp.x+12,sp.y-10);ctx.restore()}
 if(!printing&&selectionBox){const l=Math.min(selectionBox.a.x,selectionBox.b.x),r=Math.max(selectionBox.a.x,selectionBox.b.x),t=Math.min(selectionBox.a.y,selectionBox.b.y),b=Math.max(selectionBox.a.y,selectionBox.b.y),win=selectionBox.b.x>=selectionBox.a.x;ctx.save();ctx.fillStyle=win?'rgba(55,145,255,.14)':'rgba(48,210,125,.14)';ctx.strokeStyle=win?'#4a9bff':'#35d28a';ctx.lineWidth=1.4;ctx.setLineDash(win?[]:[7,4]);ctx.fillRect(l,t,r-l,b-t);ctx.strokeRect(l,t,r-l,b-t);ctx.setLineDash([]);ctx.font='11px system-ui';ctx.fillStyle=win?'#78b8ff':'#65e6a8';ctx.fillText(win?'VENTANA':'CRUCE',l+5,Math.max(13,t-5));ctx.restore()}
 if(!printing&&temp)drawEntity(temp,false,true);
 if(!printing&&tool==='poly'&&poly.length)drawEntity({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)},false);
 if(!printing&&start&&crossOn){const p=screen(start);ctx.strokeStyle=resolveCadColor({layer:'General',color:'#dce8f5'},canvasIsLight());ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.stroke()}
 if(!printing&&crossOn){const p=cursor;ctx.strokeStyle='#5cb7e8aa';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,h);ctx.moveTo(0,p.y);ctx.lineTo(w,p.y);ctx.stroke()}
 const anchor=activeAnchor();if(!printing&&temp&&anchor){const b=screen(temp.b);ctx.fillStyle='#62b8e8';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText(distance(anchor,temp.b).toFixed(2)+' '+units+' < '+normalize(angle(anchor,temp.b)).toFixed(1)+'°',b.x+12,b.y-12)}
 if(printing)$('#dynamic').style.display='none';else updateDynamic();
}
function resize(){const d=window.devicePixelRatio||1,r=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);render()}
function setTool(t){parallelDirection=null;$('#offsetInline')?.remove();if(t==='offset')clearSelection();selectionClickAnchor=null;selectionBox=null;selectionStart=null;tool=t;start=null;temp=null;poly=[];arcPoints=[];moveBase=null;modifyTarget=-1;modifyTargets=[];document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#insertFurniture').classList.toggle('active',t==='furniture');updatePrompt();render()}
function selectAt(q){
 let found=-1,best=14/zoom;
 for(let i=objects.length-1;i>=0;i--){const s=objects[i];if(hiddenLayers.has(s.layer)||lockedLayers.has(s.layer))continue;let d=1e9;
  if(s.type==='poly'||s.type==='polygon'){const loops=s.hatchLoops?.length?s.hatchLoops:[s.pts];for(const loop of loops){const count=loop.length-1+(s.type==='polygon'?1:0);for(let j=0;j<count;j++)d=Math.min(d,pointLineDistance(q,loop[j],loop[(j+1)%loop.length]))}}
  else if(s.type==='rect'||s.type==='hatch'){if(q.x>=Math.min(s.a.x,s.b.x)-best&&q.x<=Math.max(s.a.x,s.b.x)+best&&q.y>=Math.min(s.a.y,s.b.y)-best&&q.y<=Math.max(s.a.y,s.b.y)+best)d=0}
  else if(s.type==='ellipse'){const rx=Math.abs(s.b.x-s.a.x),ry=Math.abs(s.b.y-s.a.y);if(rx&&ry){const normalized=Math.hypot((q.x-s.a.x)/rx,(q.y-s.a.y)/ry);d=Math.abs(normalized-1)*Math.min(rx,ry)}}
  else if(s.type==='arc'&&s.pts?.length>=3){const g=arcParams(s.pts);if(g){const p=screen(q),theta=Math.atan2(p.y-g.y,p.x-g.x),span=v=>(v+2*Math.PI)%(2*Math.PI),onArc=g.anticlockwise?span(g.a1-theta)<=span(g.a1-g.a3):span(theta-g.a1)<=span(g.a3-g.a1);d=onArc?Math.abs(Math.hypot(p.x-g.x,p.y-g.y)-g.r)/zoom:Math.min(distance(q,s.pts[0]),distance(q,s.pts[2]))}else for(let j=0;j<s.pts.length-1;j++)d=Math.min(d,pointLineDistance(q,s.pts[j],s.pts[j+1]))}
  else if(s.type==='circle')d=Math.abs(distance(q,s.a)-distance(s.a,s.b));
  else if(s.a&&s.b)d=pointLineDistance(q,s.a,s.b);else if(s.a)d=distance(q,s.a);
  if(d<best){best=d;found=i}
 }
 return found
}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function gripDescriptors(s){
 const out=[],add=(key,p)=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))out.push({key,p})};
 if(s.type==='line'||s.type==='dim'||s.type==='dimaligned'||s.type==='leader'){add('a',s.a);add('b',s.b)}
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
function drawSelectionGrips(){
 if(printing||tool!=='select')return;
 ctx.save();
 for(const idx of selectedItems()){
  const s=objects[idx];if(!s||hiddenLayers.has(s.layer))continue;
  for(const g of gripDescriptors(s)){
   const p=screen(g.p);ctx.fillStyle='#f7fbff';ctx.strokeStyle='#1675c9';ctx.lineWidth=1.4;ctx.fillRect(p.x-4,p.y-4,8,8);ctx.strokeRect(p.x-4,p.y-4,8,8);
  }
 }
 ctx.restore();
}
function findGripAt(p){
 let found=null,best=12;
 for(const idx of selectedItems()){
  const s=objects[idx];if(!s||hiddenLayers.has(s.layer)||lockedLayers.has(s.layer))continue;
  for(const g of gripDescriptors(s)){const q=screen(g.p),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<best){best=d;found={index:idx,key:g.key}}}
 }
 return found;
}
function applyGrip(s,key,q){
 const p={x:q.x,y:q.y};
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

function showProperties(){
 const box=$('#properties'),content=$('#propContent'),ids=selectedItems();
 if(ids.length>1){box.classList.add('open');content.textContent=ids.length+' objetos seleccionados. Puedes moverlos, copiarlos o eliminarlos como conjunto.';return}
 if(selected<0){content.textContent='Selecciona una entidad para editar sus propiedades.';return}
 const s=objects[selected];box.classList.add('open');content.innerHTML='';
 const addLabel=(txt,node)=>{const l=document.createElement('label');l.textContent=txt;content.append(l,node)};
 const color=document.createElement('input');color.type='color';color.value=/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:(colors[s.layer]||colors.General);addLabel('Color de línea',color);
 const weight=document.createElement('select');['0.13','0.18','0.25','0.35','0.50','0.70','1.00'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v+' mm';weight.append(o)});weight.value=String(s.lineweight||.25);addLabel('Grosor de línea',weight);
 const type=document.createElement('select');[['CONTINUOUS','Continua'],['DASHED','Discontinua']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;type.append(o)});type.value=s.linetype||'CONTINUOUS';addLabel('Tipo de línea',type);
 let textInput=null,heightInput=null;
 if(s.type==='text'){textInput=document.createElement('input');textInput.type='text';textInput.value=s.text||'';addLabel('Contenido',textInput);heightInput=document.createElement('input');heightInput.type='number';heightInput.min='0.001';heightInput.step='0.01';heightInput.value=Number(s.textHeightWorld||Number(s.textHeight||14)/zoom).toFixed(3);addLabel('Altura ('+units+')',heightInput)}
 const coordInputs=[];
 if(s.a&&s.b){[['X inicial',s.a.x],['Y inicial',s.a.y],['X final',s.b.x],['Y final',s.b.y]].forEach(([k,v])=>{const inp=document.createElement('input');inp.type='number';inp.step='0.001';inp.value=Number(v).toFixed(3);addLabel(k,inp);coordInputs.push([k,inp])})}
 const apply=document.createElement('button');apply.textContent='Aplicar propiedades';apply.onclick=()=>{checkpoint();s.color=color.value;s.lineweight=Number(weight.value);s.linetype=type.value;if(textInput){s.text=textInput.value;const height=Number(heightInput.value);if(Number.isFinite(height)&&height>0){s.textHeightWorld=height;delete s.textHeight}}coordInputs.forEach(([k,inp])=>{const v=Number(inp.value);if(!Number.isFinite(v))return;if(k==='X inicial')s.a.x=v;if(k==='Y inicial')s.a.y=v;if(k==='X final')s.b.x=v;if(k==='Y final')s.b.y=v});save();render();status.textContent='Propiedades actualizadas'};content.append(apply);
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

function pointFromInputs(){const anchor=activeAnchor();const ls=$('#dynLen').value.trim(),as=$('#dynAngle').value.trim();if(!anchor||!ls||!as)return null;const len=Number(ls),ang=Number(as);if(!Number.isFinite(len)||len<0||!Number.isFinite(ang))return null;const rad=ang*Math.PI/180;return round({x:anchor.x+len*Math.cos(rad),y:anchor.y+len*Math.sin(rad)})}
function currentStyle(layer){const picked=($('#drawColor')?.value||'#dce8f5').toLowerCase();const color=picked==='#dce8f5'&&layer!=='General'?(colors[layer]||picked):picked;return {layer,color,lineweight:Number($('#lineweight')?.value||.25),linetype:$('#linetype')?.value||'CONTINUOUS'}}
function commitEntity(endPoint){
 if(!start)return;
 if(distance(start,endPoint)<1e-9){status.textContent='El segundo punto debe ser distinto al primero';return}
 const layer=$('#layer').value;if(lockedLayers.has(layer)){status.textContent='La capa '+layer+' está bloqueada';return}
 const style=currentStyle(layer);
 checkpoint();
 if(tool==='line')objects.push({type:'line',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='dim'||tool==='dimaligned')objects.push({type:tool,a:clone(start),b:clone(endPoint),...style,layer:'Cotas'});
 else if(tool==='rect'||tool==='hatch'||tool==='ellipse')objects.push({type:tool,a:clone(start),b:clone(endPoint),...(tool==='hatch'?{hatchPattern:$('#hatchPattern')?.value||'ANSI31',hatchSpacing:Number($('#hatchSpacing')?.value||10)}:{}),...style});
 else if(tool==='circle')objects.push({type:'circle',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='polygon'){const n=Math.max(3,Math.min(64,polySides));const r=distance(start,endPoint);const pts=[];for(let i=0;i<n;i++){const a=Math.atan2(endPoint.y-start.y,endPoint.x-start.x)+2*Math.PI*i/n;pts.push({x:start.x+r*Math.cos(a),y:start.y+r*Math.sin(a)})}objects.push({type:'polygon',pts,...style})}
 save();applySelection([objects.length-1]);start=null;temp=null;render();updatePrompt();
}
function finishPoly(){if(poly.length<2){status.textContent='La polilínea necesita al menos dos puntos';return false}if(lockedLayers.has($('#layer').value)){status.textContent='La capa actual está bloqueada';return false}checkpoint();objects.push({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)});save();poly=[];start=null;temp=null;render();updatePrompt();status.textContent='Polilínea terminada';return true}
function showOffsetInput(anchor){
 const existing=$('#offsetInline');if(existing)existing.remove();
 const box=document.createElement('div');box.id='offsetInline';box.innerHTML='<label for="offsetInlineValue">Distancia OFFSET</label><input id="offsetInlineValue" type="number" min="0.001" step="any" inputmode="decimal"><button type="button">Aceptar</button><button type="button" aria-label="Cancelar desfase">×</button><span role="status"></span>';
 stage.append(box);const p=screen(anchor);box.style.left=Math.max(4,Math.min(stage.clientWidth-190,p.x+14))+'px';box.style.top=Math.max(4,Math.min(stage.clientHeight-50,p.y+14))+'px';const input=box.querySelector('input'),buttons=box.querySelectorAll('button'),error=box.querySelector('[role=status]');input.value=offsetDistance;
 const accept=()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<=0){error.textContent='Ingresa una distancia positiva';return}offsetDistance=value;offsetDistancePreset=false;box.remove();stage.focus({preventScroll:true});status.textContent='OFFSET: toca el lado del desfase'};
 buttons[0].onclick=accept;buttons[1].onclick=()=>{box.remove();clearSelection();render();status.textContent='OFFSET cancelado'};
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();accept()}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();buttons[1].click()}});input.focus();input.select();status.textContent='OFFSET: ingresa la distancia';
}
function doOffset(q){
 if(selected<0){
  const hit=selectAt(q);applySelection(hit>=0?[hit]:[]);
  if(selected<0){status.textContent='Selecciona una entidad para OFFSET';return}
  if(!offsetDistancePreset){showOffsetInput(q);return}
  offsetDistancePreset=false;status.textContent='Indica el lado del desfase';return;
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
 if(objects.length===before){status.textContent='No se pudo crear el OFFSET';return}save();applySelection([objects.length-1]);render();status.textContent='OFFSET creado';
}
function handleTap(p){
 let q=snapPoint(world(p));q=constrain(q);
 if(!['select','pan','move','copy','offset','trim','extend','explode','measure'].includes(tool)&&lockedLayers.has($('#layer').value)){status.textContent='La capa '+$('#layer').value+' está bloqueada';return}
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
  const unitFactor=units==='mm'?1000:units==='cm'?100:1;checkpoint();objects.push({type:'text',a:clone(q),text:value,textHeightWorld:.25*unitFactor,...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);render();status.textContent='Texto creado';return;
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
 if(tool==='offset'){if(!$('#offsetInline'))doOffset(q);return}
 if(tool==='poly'){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Polilínea: marca otro vértice o pulsa Enter';return}
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
  const pick=world(p),idx=selectAt(pick);if(idx<0){status.textContent='Toca el tramo que deseas modificar';return}
  const mode=tool==='trim'&&p.shiftForTrim?'extend':tool;
  if(mode==='trim')quickTrim(idx,pick);else trimOrExtend(idx,pick,'extend');return;
 }
 if(['move','copy','rotate','mirror','scale'].includes(tool)){
  if(modifyTargets.length===0){
   modifyTargets=selectedItems();
   if(!modifyTargets.length){const hit=selectAt(q);if(hit>=0){applySelection([hit]);modifyTargets=[hit];status.textContent='Objeto seleccionado. Indica punto base';return}}
   if(!modifyTargets.length){status.textContent='Selecciona uno o varios objetos';return}
  }
  if(!moveBase){moveBase=q;status.textContent=tool==='mirror'?'Indica el segundo punto del eje':tool==='rotate'?'Indica el ángulo de giro':tool==='scale'?'Indica el factor de escala con la distancia':'Indica punto destino';return}
  const dx=q.x-moveBase.x,dy=q.y-moveBase.y,targets=modifyTargets.filter(i=>i>=0&&i<objects.length);
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
    const factor=Math.hypot(dx,dy),scale=p=>({x:moveBase.x+(p.x-moveBase.x)*factor,y:moveBase.y+(p.y-moveBase.y)*factor});
    if(src.a)src.a=scale(src.a);if(src.b)src.b=scale(src.b);if(src.pts)src.pts=src.pts.map(scale);if(src.hatchLoops)src.hatchLoops=src.hatchLoops.map(loop=>loop.map(scale));
   }
  }
  if(tool==='copy')applySelection(created);else applySelection(targets);
  save();modifyTarget=-1;modifyTargets=[];moveBase=null;render();status.textContent=tool.toUpperCase()+' aplicado a '+targets.length+' objeto(s)';return;
 }
 if(!start){start=q;temp={type:tool,a:clone(q),b:clone(q),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';updatePrompt();render();return}
 let end=pointFromInputs();if(!end)end=q;else if(document.activeElement!==$('#dynLen')&&document.activeElement!==$('#dynAngle'))end=q;
 end=constrain(end);
 if(tool==='line'||tool==='dim'||tool==='dimaligned'||tool==='rect'||tool==='hatch'||tool==='circle'||tool==='ellipse'||tool==='polygon'){commitEntity(end)}
}
function transformEntityGeometry(s,transform,axisAligned){
 if(s.type==='rect'&&!axisAligned&&s.a&&s.b){const a=s.a,b=s.b;s.pts=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(transform);s.type='polygon';delete s.a;delete s.b;return}
 if(s.a)s.a=transform(s.a);if(s.b)s.b=transform(s.b);if(s.pts)s.pts=s.pts.map(transform);if(s.hatchLoops)s.hatchLoops=s.hatchLoops.map(loop=>loop.map(transform));
}
function translate(s,dx,dy){if(s.a){s.a.x+=dx;s.a.y+=dy}if(s.b){s.b.x+=dx;s.b.y+=dy}if(s.pts)s.pts.forEach(p=>{p.x+=dx;p.y+=dy});if(s.hatchLoops)s.hatchLoops.forEach(loop=>loop.forEach(p=>{p.x+=dx;p.y+=dy}))}
function entitySegments(s){
 const pts=[];
 if(s.type==='line'||s.type==='dim'||s.type==='dimaligned'||s.type==='leader'){if(s.a&&s.b)pts.push([s.a,s.b]);return pts}
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
  const s=objects[i];if(hiddenLayers.has(s.layer)||lockedLayers.has(s.layer))continue;
  const segs=entitySegments(s),pts=[];
  if(segs.length){for(const [a,b] of segs)pts.push(a,b)}
  else {if(s.a)pts.push(s.a);if(s.b)pts.push(s.b);if(s.pts)pts.push(...s.pts)}
  if(!pts.length)continue;
  const fully=pts.every(p=>inSelectionRect(p,rect));
  if(windowMode){if(fully)hits.push(i);continue}
  const vertexHit=pts.some(p=>inSelectionRect(p,rect));
  const edgeHit=segs.some(([a,b])=>segmentHitsRect(a,b,rect));
  const center={x:(rect.left+rect.right)/2,y:(rect.bottom+rect.top)/2};
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
 objects.forEach((other,i)=>{if(i===index||hiddenLayers.has(other.layer))return;for(const [c,d] of entitySegments(other)){const h=lineIntersection(a,b,c,d,true);if(h&&h.t>1e-8&&h.t<1-1e-8)cuts.push(h.t)}});
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
function explodeAt(q){
 const i=selectAt(q);if(i<0){status.textContent='Selecciona una polilínea o rectángulo';return}
 const s=objects[i];if(s.groupId){const id=s.groupId,ids=objects.map((o,j)=>o.groupId===id?j:-1).filter(j=>j>=0);checkpoint();ids.forEach(j=>delete objects[j].groupId);applySelection(ids);save();render();status.textContent='Bloque desagrupado · '+ids.length+' elementos editables';return}
 if(!['poly','polygon','rect'].includes(s.type)){status.textContent='EXPLODE disponible para bloques, polilíneas, polígonos y rectángulos';return}
 const segments=entitySegments(s);if(!segments.length){status.textContent='Esta entidad no requiere EXPLODE';return}
 checkpoint();const style={layer:s.layer,color:s.color,lineweight:s.lineweight,linetype:s.linetype};
 const parts=segments.map(([a,b])=>({type:'line',a:clone(a),b:clone(b),...style}));
 objects.splice(i,1,...parts);applySelection(parts.map((_,k)=>i+k));save();render();status.textContent='Entidad descompuesta en '+parts.length+' segmentos';
}
let pointers=new Map(),pinch=null,selectionStart=null,selectionBox=null,selectionAdditive=false,multiSelectOn=false,gripDrag=null,middlePan=null,selectionClickAnchor=null;

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
function updateCursorCommand(){
 const value=$('#cmd').value.trim();
 if(!value&&tool!=='trim'&&tool!=='extend'){cursorCommandEl.hidden=true;return}
 cursorCommandEl.hidden=false;
 const maxX=Math.max(8,stage.clientWidth-210),maxY=Math.max(8,stage.clientHeight-42);
 cursorCommandEl.style.left=Math.max(8,Math.min(cursor.x+12,maxX))+'px';
 cursorCommandEl.style.top=Math.max(8,Math.min(cursor.y+12,maxY))+'px';
 cursorCommandEl.querySelector('.cmd-value').textContent=value||(tool==='trim'?'Toca para recortar · Shift + clic: alargar':'Toca el extremo para alargar');
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
 if(e.key==='Enter'||e.key===' '&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();submitCommand();$('#cmd').blur()}
 else if(e.key==='Escape'){e.preventDefault();cancelCurrentAction();$('#cmd').blur();stage.focus({preventScroll:true})}
});
$('#cmdRun').addEventListener('click',()=>{submitCommand();$('#cmd').blur()});
document.addEventListener('pointerdown',e=>{if(contextMenuEl&&!contextMenuEl.contains(e.target))hideCadContextMenu()});
contextMenuEl.addEventListener('contextmenu',e=>e.preventDefault());

canvas.addEventListener('pointerdown',e=>{
 if(e.button===1){e.preventDefault();hideCadContextMenu();middlePan={pointerId:e.pointerId,point:pointer(e),offset:clone(offset)};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';status.textContent='PAN temporal · arrastra con la rueda presionada';return}
 if(e.button===2){e.preventDefault();return}
 stage.focus({preventScroll:true});hideCadContextMenu();
 canvas.setPointerCapture(e.pointerId);const p=pointer(e);pointers.set(e.pointerId,p);
 if(pointers.size===2){if(gripDrag)cancelGripDrag();const v=[...pointers.values()];pinch={dist:distance(v[0],v[1]),zoom};start=null;temp=null;selectionStart=null;selectionBox=null;return}
 if(tool==='pan'){drag={point:p,offset:clone(offset)};return}
 if(tool==='select'){
  if(selectionClickAnchor){selectionStart=null;selectionBox={a:selectionClickAnchor,b:p};selectionAdditive=multiSelectOn||!!(e.shiftKey||e.ctrlKey||e.metaKey);finishSelectionWindow(selectionBox);selectionClickAnchor=null;selectionBox=null;render();return}
  const grip=findGripAt(p);if(grip){checkpoint();gripDrag={...grip,before:clone(objects[grip.index]),moved:false,historyAdded:true};return}selectionStart=p;selectionBox=null;selectionAdditive=multiSelectOn||!!(e.shiftKey||e.ctrlKey||e.metaKey);return}
 p.shiftForTrim=e.shiftKey;handleTap(p);
});
canvas.addEventListener('pointermove',e=>{
 const p=pointer(e);
 if(middlePan&&middlePan.pointerId===e.pointerId){offset.x=middlePan.offset.x+p.x-middlePan.point.x;offset.y=middlePan.offset.y+p.y-middlePan.point.y;render();return}cursor=p;updateCursorCommand();$('#crossinfo').textContent='X '+world(p).x.toFixed(3)+' '+units+' · Y '+world(p).y.toFixed(3)+' '+units+' · Z 0.000';
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);activeSnap=snapCandidate(world(p));if(activeSnap)status.textContent='OSNAP · '+activeSnap.type+' · clic para conectar';
 if(pointers.size===2&&pinch){const v=[...pointers.values()];zoom=Math.max(2,Math.min(500,pinch.zoom*distance(v[0],v[1])/(pinch.dist||1)));render();return}
 if(drag&&tool==='pan'){offset.x=drag.offset.x+p.x-drag.point.x;offset.y=drag.offset.y+p.y-drag.point.y;render();return}
 if(gripDrag){const s=objects[gripDrag.index];if(s){applyGrip(s,gripDrag.key,snapPoint(world(p)));gripDrag.moved=true;render()}return}
 if(selectionClickAnchor){selectionBox={a:selectionClickAnchor,b:p};render();return}
 if(selectionStart){if(distance(selectionStart,p)>4)selectionBox={a:selectionStart,b:p};render();return}
 if(tool==='poly'&&poly.length){const q=constrain(snapPoint(world(p)));temp={type:'line',a:clone(poly[poly.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(tool==='arc'&&arcPoints.length){const q=snapPoint(world(p));temp={type:'line',a:clone(arcPoints[arcPoints.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(start){let q=constrain(snapPoint(world(p)));temp={type:tool==='measure'?'line':tool,a:clone(start),b:q,...currentStyle($('#layer').value)};render()}
 else render();
});
function finishSelectionWindow(box){
 const a=box.a,b=box.b,wa=world(a),wb=world(b),rect={left:Math.min(wa.x,wb.x),right:Math.max(wa.x,wb.x),bottom:Math.min(wa.y,wb.y),top:Math.max(wa.y,wb.y)};
 const windowMode=b.x>=a.x,hits=selectByWindow(rect,windowMode);applySelection(hits,selectionAdditive);showProperties();status.textContent=hits.length+' objeto(s) seleccionados · '+(windowMode?'VENTANA':'CRUCE');
}
function pointerEnd(e){
 if(middlePan&&middlePan.pointerId===e.pointerId){middlePan=null;canvas.style.cursor='';status.textContent='PAN finalizado · herramienta anterior conservada';render();return}
 pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
 if(e.type==='pointercancel'){if(gripDrag){cancelGripDrag();return}selectionStart=null;selectionBox=null;render();return}
 if(gripDrag){if(gripDrag.moved){save();status.textContent='Grip actualizado · geometría modificada';showProperties()}else if(gripDrag.historyAdded&&undo.length)undo.pop();gripDrag=null;render();return}
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
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointer(e),before=world(p);zoom=Math.max(2,Math.min(500,zoom*(e.deltaY<0?1.12:.89)));const after=screen(before);offset.x+=p.x-after.x;offset.y+=p.y-after.y;render()},{passive:false});
function updateToggle(id,on){$(id).classList.toggle('active',on)}
function toggle(id){const map={gridToggle:'gridOn',orthoToggle:'orthoOn',snapToggle:'snapOn',polarToggle:'polarOn',osnapToggle:'osnapOn',crossToggle:'crossOn'};const k=map[id];if(k==='gridOn')gridOn=!gridOn;if(k==='orthoOn')orthoOn=!orthoOn;if(k==='snapOn')snapOn=!snapOn;if(k==='polarOn')polarOn=!polarOn;if(k==='osnapOn')osnapOn=!osnapOn;if(k==='crossOn')crossOn=!crossOn;const values={gridOn,orthoOn,snapOn,polarOn,osnapOn,crossOn};updateToggle('#'+id,values[k]);saveDraftPreferences();render()}
[['gridToggle',gridOn],['orthoToggle',orthoOn],['snapToggle',snapOn],['polarToggle',polarOn],['osnapToggle',osnapOn],['crossToggle',crossOn]].forEach(([id,on])=>updateToggle('#'+id,on));
['gridToggle','orthoToggle','snapToggle','polarToggle','osnapToggle','crossToggle'].forEach(id=>$('#'+id).onclick=()=>toggle(id));
$('#multiSelectToggle').onclick=()=>{multiSelectOn=!multiSelectOn;$('#multiSelectToggle').querySelector('.multi-state').textContent=multiSelectOn?'ON':'OFF';$('#multiSelectToggle').setAttribute('aria-pressed',String(multiSelectOn));$('#multiSelectToggle').classList.toggle('active',multiSelectOn);status.textContent='Selección múltiple '+(multiSelectOn?'activada':'desactivada')};
document.addEventListener('keydown',e=>{
 if(!contextMenuEl.hidden&&e.key==='Escape'){e.preventDefault();hideCadContextMenu();return}
 const active=document.activeElement;
 if(['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)){
  if(e.key==='Enter'&&active.id==='dynLen'){e.preventDefault();$('#dynAngle').focus()}
  else if(e.key==='Enter'&&active.id==='dynAngle'){e.preventDefault();const q=pointFromInputs();if(q){if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)}}
  return;
 }
 if(document.querySelector('dialog[open]'))return;
 if(e.key==='Escape'){e.preventDefault();cancelCurrentAction();return}
 if(e.key==='Backspace'&&$('#cmd').value){e.preventDefault();$('#cmd').value=$('#cmd').value.slice(0,-1);updateCursorCommand();return}
 if(e.key==='Delete'||e.key==='Backspace'){if(selectedItems().length){e.preventDefault();deleteSelection();showProperties();return}}
 if(e.key==='F7'){e.preventDefault();toggle('gridToggle');return}
 if(e.key==='F8'){e.preventDefault();toggle('orthoToggle');return}
 if(e.key==='F9'){e.preventDefault();toggle('snapToggle');return}
 if(e.key==='F10'){e.preventDefault();toggle('polarToggle');return}
 if(e.key==='F3'){e.preventDefault();toggle('osnapToggle');return}
 if(e.key==='Enter'){e.preventDefault();performEnterAction();return}
 if(e.key===' '&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();performEnterAction();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('#redo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&(active===stage||active===canvas||active===document.body)){e.preventDefault();applySelection(objects.map((_,i)=>i));showProperties();render();return}
 if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
  e.preventDefault();$('#cmd').value += e.key;updateCursorCommand();return;
 }
},true);
const aliases={F:'fillet',FILLET:'fillet',DI:'measure',DIST:'measure',DISTANCE:'measure',L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',BH:'hatch',BHATCH:'hatch',D:'dim',DIM:'dim',DLI:'dim',DIMLINEAR:'dim',DAL:'dimaligned',DIMALIGNED:'dimaligned',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',O:'offset',OFFSET:'offset',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EXT:'extend',EXTEND:'extend',EX:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
function parseCoordinate(raw,base){
 const s=raw.trim().replace(/\s+/g,'');let m;
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?)$/))){const x=Number(m[1].replace(',','.')),y=Number(m[2].replace(',','.'));return s.startsWith('@')?{x:base.x+x,y:base.y+y}:{x,y}}
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?)<(-?\d+(?:[.,]\d+)?)$/))){const len=Number(m[1].replace(',','.')),ang=Number(m[2].replace(',','.'))*Math.PI/180;return {x:base.x+len*Math.cos(ang),y:base.y+len*Math.sin(ang)}}
 return null;
}
function runCommand(raw){
 const textValue=raw.trim(),upper=textValue.toUpperCase(),parts=upper.split(/\s+/),c=parts[0];if(!c)return;
 if(!/^[+-]?(?:\d|[.,])/.test(textValue)&&!textValue.startsWith('@')&&!['DS','HP','DSETTINGS','DRAFTINGSETTINGS','SETTINGS','F3','F7','F8','F9','F10','GRID','ORTHO','SNAP','OSNAP','POLAR'].includes(c)){lastCommand=textValue;try{localStorage.setItem('otrocad-last-command',lastCommand)}catch(e){}}
 if(c==='O'||c==='OFFSET'){const d=Number(parts[1]);if(parts[1]&&Number.isFinite(d)&&d>0){offsetDistance=d;offsetDistancePreset=true}setTool('offset');return}
 const coordinateBase=tool==='arc'&&arcPoints.length?arcPoints[arcPoints.length-1]:(activeAnchor()||{x:0,y:0});
 const coordinate=parseCoordinate(textValue,coordinateBase);
 if(coordinate&&(/^[+-]?(?:\d|\.)/.test(textValue)||textValue.startsWith('@'))){
  const point=round(coordinate);
  if(tool==='poly'){poly.push(point);temp=null;render();status.textContent='Polilínea: vértice añadido · Enter para terminar';return}
  if(tool==='measure'){handleTap(screen(point));return}
  if(tool==='arc'){arcPoints.push(point);if(arcPoints.length===3){checkpoint();objects.push({type:'arc',pts:clone(arcPoints),...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);arcPoints=[];status.textContent='Arco creado'}else status.textContent='Arco: introduce el siguiente punto';render();return}
  if(tool==='leader'){if(!start){start=point;temp={type:'line',a:clone(point),b:clone(point),...currentStyle($('#layer').value)};status.textContent='Introduce el extremo de la directriz';render()}else{const label=prompt('Texto de la directriz','');checkpoint();objects.push({type:'leader',a:clone(start),b:point,text:label||'',...currentStyle($('#layer').value)});save();applySelection([objects.length-1]);start=null;temp=null;render();status.textContent='Directriz creada'}return}
  if(!start){start=point;temp={type:tool,a:clone(start),b:clone(start),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Punto inicial fijado · introduce el siguiente punto'}
  else commitEntity(point);
  return;
 }
 if(c==='F7'||c==='GRID'){toggle('gridToggle');return}if(c==='F8'||c==='ORTHO'){toggle('orthoToggle');return}if(c==='F9'||c==='SNAP'){toggle('snapToggle');return}if(c==='F10'||c==='POLAR'){toggle('polarToggle');return}if(c==='F3'||c==='OSNAP'){toggle('osnapToggle');return}
 if(c==='U'||c==='UNDO'){$('#undo').click();return}if(c==='REDO'){$('#redo').click();return}
 if(c==='DS'||c==='HP'||c==='DSETTINGS'||c==='DRAFTINGSETTINGS'||c==='SETTINGS'){showDraftSettings();return}
 if(c==='BG'||c==='BACKGROUND'||c==='CANVASCOLOR'){const name=(parts[1]||'').toLowerCase();if(CAD_THEMES[name])applyCanvasTheme(name);else status.textContent='BACKGROUND WHITE | BLACK | DARK | GRAPHITE | SLATE | BLUEGRAY';return}
 if(c==='HATCHPATTERN'){const p=parts[1];if(['ANSI31','CROSS','GRID','SOLID'].includes(p)){$('#hatchPattern').value=p;status.textContent='HATCHPATTERN '+p}else status.textContent='HATCHPATTERN ANSI31 | CROSS | GRID | SOLID';return}
 if(c==='PR'||c==='PROPERTIES'||c==='CTRL+1'){$('#properties').classList.toggle('open');showProperties();return}
 if(c==='E'||c==='ERASE'||c==='DELETE'){deleteSelection();return}
 if(c==='Z'||c==='ZOOM'){zoom=Math.min(500,zoom*1.25);render();return}
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
 const aliases={DI:'measure',DIST:'measure',DISTANCE:'measure',L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',D:'dim',DIM:'dim',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EXT:'extend',EXTEND:'extend',EX:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
 if(aliases[c]){setTool(aliases[c]);return}
 status.textContent='Comando no reconocido: '+c;
}

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active))});document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab)});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
const furnitureList=Array.isArray(window.otroCadFurnitureCatalog)?window.otroCadFurnitureCatalog:[];
for(const item of furnitureList){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('#blockChoice').append(option)}
$('#insertFurniture').onclick=()=>{activeFurniture=furnitureList.find(item=>item.id===$('#blockChoice').value)||null;if(!activeFurniture){status.textContent='No se encontró el símbolo';return}setTool('furniture');status.textContent='Toca el punto de inserción · '+activeFurniture.name};
$('#arrayRect').onclick=showArrayDialog;
$('#centerMark').onclick=()=>createCircleAnnotations('center');
$('#centerLine').onclick=createCenterline;
$('#dimRadius').onclick=()=>createCircleAnnotations('radius');
$('#dimDiameter').onclick=()=>createCircleAnnotations('diameter');
$('#measureArea').onclick=selectedArea;
$('#finish-poly').onclick=finishPoly;
$('#acceptPoint').onclick=()=>{const q=pointFromInputs();if(!q)return;if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)};
$('#undo').onclick=()=>{if(undo.length){backupPrevious();redo.push(clone(objects));objects=undo.pop();clearSelection();save();render()}};
$('#redo').onclick=()=>{if(redo.length){backupPrevious();undo.push(clone(objects));objects=redo.pop();clearSelection();save();render()}};
$('#newDrawing').onclick=()=>{if(objects.length&&!confirm('¿Crear un dibujo nuevo? El dibujo actual será reemplazado. Descarga una copia antes si deseas conservarlo.'))return;if(!checkpoint()&&objects.length){alert('No se creó el dibujo nuevo porque no se pudo conservar la copia anterior.');return}objects=[];clearSelection();save();render();status.textContent='Nuevo dibujo creado'};
$('#save').onclick=()=>{if(save())status.textContent='Copia local guardada en este navegador'};
$('#recover').onclick=()=>{let previous;try{previous=JSON.parse(localStorage.getItem('otrocad-drawing-previous')||'null')}catch(e){alert('No se puede leer la copia anterior.');return}const shapes=Array.isArray(previous)?previous:previous?.shapes;if(!Array.isArray(shapes)){alert('No hay una copia anterior disponible en este navegador.');return}if(!confirm('¿Recuperar la copia anterior? El dibujo actual pasará a ser la copia anterior.'))return;if(!checkpoint()&&objects.length){alert('No se recuperó la copia porque no se pudo conservar el dibujo actual.');return}objects=shapes;if(['m','cm','mm'].includes(previous?.units))units=previous.units;clearSelection();if(save())status.textContent='Copia anterior recuperada';render()};
$('#demoHouse').onclick=async()=>{if(objects.length&&!confirm('¿Abrir la vivienda de demostración? Se conservará una copia anterior en este navegador.'))return;try{const demo=clone(window.otroCadDemo);if(!Array.isArray(demo.shapes)||!demo.shapes.length)throw Error('La demostración está vacía.');if(!checkpoint()&&objects.length)throw Error('No se abrió el ejemplo porque no se pudo conservar el dibujo anterior.');objects=demo.shapes;units='m';clearSelection();save();$('#fit').click();status.textContent='Vivienda de demostración · '+objects.length+' entidades editables'}catch(e){alert('No se pudo abrir la demostración: '+e.message)}};
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
const importReportButton=$('#importReport'),copyImportReportButton=$('#copyImportReport');let lastImportReport=[];
importReportButton.onclick=()=>alert(lastImportReport.length?lastImportReport.join('\n'):'No hay advertencias en el último dibujo importado.');
copyImportReportButton.onclick=async()=>{
 const report=lastImportReport.join('\n');if(!report)return;
 try{await navigator.clipboard.writeText(report);status.textContent='Diagnóstico CAD copiado. Puedes pegarlo en el chat.'}
 catch(error){console.warn('No se pudo copiar el diagnóstico:',error);alert(report)}
};
$('#file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const ext=f.name.split('.').pop().toLowerCase();let arr;if(ext==='json'){const v=JSON.parse(await f.text());arr=Array.isArray(v)?v:v.shapes;if(!Array.isArray(arr))throw Error('El JSON no contiene entidades válidas')}else if(ext==='dxf'){arr=parseDxfEntities(await f.text())}else if(ext==='dwg'){status.textContent='Convirtiendo DWG en el dispositivo…';const engine=await getDwgRuntime();const input=new Uint8Array(await f.arrayBuffer());if(input.length<6||new TextDecoder().decode(input.subarray(0,4))!=='AC10')throw Error('El archivo no tiene una cabecera DWG válida.');let dxfBytes,recovered=false;try{dxfBytes=engine.dwg_to_dxf(input)}catch(strictError){console.warn('Lectura DWG estricta falló:',strictError);if(typeof engine.dwg_to_dxf_failsafe!=='function')throw Error('El lector DWG no pudo abrir este archivo. Actualiza OtroCAD e inténtalo nuevamente. Detalle: '+(strictError.message||strictError));if(!confirm('La lectura completa del DWG falló. ¿Intentar recuperar las entidades compatibles?\n\nPuede perder bloques, cotas u otros elementos. El archivo DWG original no se modificará.'))return;dxfBytes=engine.dwg_to_dxf_failsafe(input);recovered=true}const dxf=new TextDecoder('utf-8').decode(dxfBytes);arr=parseDxfEntities(dxf);if(recovered){arr.recoveredDwg=true;arr.importWarnings=arr.importWarnings||[];arr.importWarnings.unshift('DWG recuperado parcialmente tras un error de lectura. Comprueba el plano antes de guardar.')}}else throw Error('Formato no compatible. Usa JSON, DXF o DWG.');if(!arr.length)throw Error('No se encontraron entidades compatibles.');if(arr.importWarnings?.length&&!confirm('El archivo contiene elementos que pueden perderse o simplificarse:\n'+arr.importWarnings.join('\n')+'\n\n¿Abrir de todos modos? Conserva el archivo original.'))return;if(!checkpoint()&&objects.length)throw Error('No se reemplazó el dibujo porque no se pudo conservar la copia anterior.');objects=arr;lastImportReport=[
 'OtroCAD · Informe de importación', 'Archivo: '+f.name, 'Entidades editables: '+arr.length,
 'Pérdidas o incompatibilidades:',...(arr.importWarnings?.length?arr.importWarnings:['Ninguna detectada']),
 'Ajustes visuales:',...(arr.importNotes?.length?arr.importNotes:['Ninguno']),
 'Causas dentro de bloques y cotas:',
 ...((Object.entries(arr.importDiagnostics||{}).sort((a,b)=>b[1]-a[1]).map(([name,count])=>count+' '+name))||[])
];importReportButton.hidden=false;copyImportReportButton.hidden=false;if(arr.drawingUnits)units=arr.drawingUnits;clearSelection();save();render();status.textContent=f.name+' · '+arr.length+' entidades cargadas'+(arr.recoveredDwg?' · RECUPERACIÓN PARCIAL':'')+(arr.importNotes?.length?' · '+arr.importNotes.length+' avisos de compatibilidad':'');status.title=[...(arr.importWarnings||[]),...(arr.importNotes||[])].join('\n')}catch(err){console.error(err);alert('No se pudo abrir el archivo: '+(err.message||err))}finally{e.target.value=''}};
function parseDxfEntities(source){
 const lines=source.replace(/\r/g,'').split('\n'),pairs=[];
 for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))pairs.push([code,lines[i+1].trim()])}
 const records=[];let current=null;
 for(const pair of pairs){if(pair[0]===0){if(current)records.push(current);current={type:pair[1].toUpperCase(),pairs:[]}}else if(current)current.pairs.push(pair)}
 if(current)records.push(current);
 const get=(r,c,d=0)=>{const p=r.pairs.find(x=>x[0]===c);if(!p)return d;const n=Number(p[1]);return Number.isFinite(n)?n:d};
 const all=(r,c)=>r.pairs.filter(x=>x[0]===c).map(x=>Number(x[1]));
 const str=(r,c,d='')=>r.pairs.find(x=>x[0]===c)?.[1]??d;
 const style=r=>{const layer=str(r,8,'General'),aci=get(r,62,7),trueColor=get(r,420,-1),aciColors={1:'#ff3333',2:'#ffff33',3:'#33cc33',4:'#33ffff',5:'#3366ff',6:'#ff33ff',7:'#dce8f5',8:'#808080',9:'#b0b0b0'};return {layer,color:trueColor>=0?'#'+trueColor.toString(16).padStart(6,'0'):aciColors[aci]||colors[layer]||colors.General,lineweight:get(r,370,25)/100,linetype:str(r,6,'CONTINUOUS')==='DASHED'?'DASHED':'CONTINUOUS'}};
 const blockRecords=new Map(),blockBases=new Map();let inBlocks=false,activeBlock=null;
 for(const record of records){if(record.type==='SECTION'){inBlocks=str(record,2).toUpperCase()==='BLOCKS';continue}if(record.type==='ENDSEC'){inBlocks=false;activeBlock=null;continue}if(!inBlocks)continue;if(record.type==='BLOCK'){activeBlock=str(record,2).toUpperCase();blockRecords.set(activeBlock,[]);blockBases.set(activeBlock,{x:get(record,10),y:get(record,20)});continue}if(record.type==='ENDBLK'){activeBlock=null;continue}if(activeBlock)blockRecords.get(activeBlock).push(record)}
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
 const transformBlockItem=(sourceItem,transformPoint,scaleX,scaleY,rotation,groupId,insertStyle)=>{
  const item={...sourceItem,groupId},nonUniform=Math.abs(Math.abs(scaleX)-Math.abs(scaleY))>1e-9,rotated=Math.abs(rotation)>1e-9;
  if(sourceItem.layer==='0'&&insertStyle){item.layer=insertStyle.layer;item.color=insertStyle.color}
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
   const angle=Number(sourceItem.textRotation||0)*Math.PI/180,dx=Math.cos(angle)*scaleX,dy=Math.sin(angle)*scaleY;
   item.textRotation=(Math.atan2(dy,dx)+rotation)*180/Math.PI;
   item.textHeightWorld=Number(sourceItem.textHeightWorld||.4)*Math.sqrt(Math.abs(scaleX*scaleY));
  }
  return item;
 };
 const blockLines=[];for(const [key,items] of blockRecords){const base=blockBases.get(key)||{x:0,y:0};blockLines.push('0','BLOCK','2',key,'10',String(base.x),'20',String(base.y));for(const item of items)blockLines.push('0',item.type,...item.pairs.flatMap(pair=>[String(pair[0]),pair[1]]));blockLines.push('0','ENDBLK')}
 const blockSection=['0','SECTION','2','BLOCKS',...blockLines,'0','ENDSEC'];
 const parseBlockItems=(items,depth=0)=>parseDxfEntities([...blockSection,'0','SECTION','2','ENTITIES',...items.flatMap(item=>['0',item.type,...item.pairs.flatMap(pair=>[String(pair[0]),pair[1]])]),'0','ENDSEC','0','EOF'].join('\n'),depth+1);
 const header=records.find(r=>r.type==='SECTION'&&str(r,2).toUpperCase()==='HEADER');const unitIndex=header?.pairs.findIndex(p=>p[0]===9&&p[1]==='$INSUNITS')??-1;const unitCode=unitIndex>=0?Number(header.pairs[unitIndex+1]?.[1]):0;const unitMap={4:'mm',5:'cm',6:'m'};if(unitCode&&!unitMap[unitCode])warn('unidades DXF no admitidas; valores sin convertir');out.drawingUnits=unitMap[unitCode]||null;
 for(const r of records){
  if(r.type==='SECTION'){inEntities=str(r,2).toUpperCase()==='ENTITIES';continue}
  if(r.type==='ENDSEC'){inEntities=false;continue}
  if(!inEntities)continue;
  const st=style(r),type=r.type;
  if(type==='SEQEND'&&activeAttributeGroup){activeAttributeGroup=null;continue}
  if(type==='POINT'){
   // DEFPOINTS is AutoCAD's non-printing dimension construction layer.
   if(str(r,8,'').toUpperCase()==='DEFPOINTS')continue;
   out.push({type:'point',a:{x:get(r,10),y:get(r,20)},...st});
  }
  else if(type==='LINE')out.push({type:'line',a:{x:get(r,10),y:get(r,20)},b:{x:get(r,11),y:get(r,21)},...st});
  else if(type==='CIRCLE'){const a={x:get(r,10),y:get(r,20)},rad=get(r,40);out.push({type:'circle',a,b:{x:a.x+rad,y:a.y},...st})}
  else if(type==='LWPOLYLINE'){const vertices=lightPolylineVertices(r),closed=Boolean(get(r,70,0)&1),pts=buildPolylinePoints(vertices,closed);if(vertices.some(v=>Math.abs(v.bulge)>1e-9))note('polilíneas curvas aproximadas');if(pts.length>1)out.push({type:closed?'polygon':'poly',pts,...st})}
  else if(type==='POLYLINE'){
   const flags=get(r,70,0),vertices=polylineVertices.get(r)||[];
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
   for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const transformPoint=p=>{const x=(p.x-base.x+column*get(r,44))*scaleX,y=(p.y-base.y+row*get(r,45))*scaleY;return{x:origin.x+x*cos-y*sin,y:origin.y+x*sin+y*cos}};
    const groupId='dxf-insert-'+depth+'-'+out.length+'-'+row+'-'+column;
    for(const piece of pieces)out.push(transformBlockItem(piece,transformPoint,scaleX,scaleY,rotation,groupId,st));
   }
   if(columns*rows>1)note('MINSERT expandido a entidades editables');
   note('INSERT/MINSERT importado como grupo editable');
   if(get(r,66)===1)activeAttributeGroup='dxf-insert-'+depth+'-'+(out.length-pieces.length)+'-0-0';
   if(pieces.importWarnings?.length){warn('INSERT con entidades no compatibles');diagnose('INSERT '+name,pieces.importWarningCounts);diagnose('INSERT '+name,pieces.importDiagnostics)}
  }
  else if(type==='DIMENSION'){
   if(Number(arguments[1]||0)>=5){warn('DIMENSION con anidación excesiva omitida');continue}
   const geometry=blockRecords.get(str(r,2).toUpperCase());
   if(!geometry?.length){warn('DIMENSION sin geometría gráfica omitida');continue}
   const pieces=parseBlockItems(geometry,Number(arguments[1]||0));
   if(!pieces.length){warn('DIMENSION sin entidades compatibles omitida');continue}
   const groupId='dxf-dimension-'+out.length;
   for(const item of pieces)out.push({...item,groupId,layer:item.layer==='0'?st.layer:item.layer,color:item.layer==='0'?st.color:item.color});
   note('DIMENSION dibujada como geometría no asociativa');
   if(pieces.importWarnings?.length){warn('DIMENSION con elementos gráficos no compatibles');diagnose('DIMENSION',pieces.importWarningCounts);diagnose('DIMENSION',pieces.importDiagnostics)}
  }
  else if(type==='HATCH'){
   const loops=hatchBoundaries(r),solid=get(r,70)===1,pattern=solid?'SOLID':str(r,2,'ANSI31');
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
    if(vertices.length>=3&&Math.abs(area)>1e-8){loops.push(vertices);note('HATCH con borde reconstruido desde vértices DXF')}
   }
   const pts=loops[0];
   if(!pts?.length){warn('HATCH sin contorno compatible omitido');const paths=get(r,91,-1),vertices=r.pairs.filter(p=>p[0]===10).length;diagnose('HATCH',{['rutas de borde='+paths+', pares X/Y='+vertices]:1});continue}
   const minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x)),miny=Math.min(...pts.map(p=>p.y)),maxy=Math.max(...pts.map(p=>p.y));
   const corners=new Set(pts.map(p=>p.x+','+p.y));
   const rectangular=loops.length===1&&pts.length===4&&minx<maxx&&miny<maxy&&[[minx,miny],[maxx,miny],[maxx,maxy],[minx,maxy]].every(([x,y])=>corners.has(x+','+y));
   const hatchSpacingWorld=Math.hypot(get(r,45),get(r,46))||Math.max((maxx-minx+maxy-miny)/50,.01);
   const appearance={hatchPattern:pattern,hatchOpacity:solid?1:.65,hatchSpacingWorld,hatchAngle:get(r,52,45),...st};
   if(rectangular&&solid)out.push({type:'hatch',a:{x:minx,y:miny},b:{x:maxx,y:maxy},...appearance});
   else out.push({type:'polygon',pts,hatchLoops:loops,solidFill:solid,...appearance});
   if(!solid)note('HATCH con trama visual aproximada');
  }
  else if(type==='ELLIPSE'){
   const a={x:get(r,10),y:get(r,20)},vx=get(r,11),vy=get(r,21),ratio=get(r,40),begin=get(r,41),end=get(r,42,Math.PI*2),length=Math.hypot(vx,vy);
   const full=Math.abs((end-begin)-2*Math.PI)<1e-6,aligned=Math.abs(vx)<1e-9||Math.abs(vy)<1e-9;
   if(length>0&&ratio>0&&ratio<=1&&full&&aligned){const rx=Math.abs(vx)+Math.abs(vy)*ratio,ry=Math.abs(vy)+Math.abs(vx)*ratio;out.push({type:'ellipse',a,b:{x:a.x+rx,y:a.y+ry},...st})}
   else if(length>0&&ratio>0&&end>begin){const pts=Array.from({length:65},(_,i)=>{const t=begin+(end-begin)*i/64;return{x:a.x+vx*Math.cos(t)-vy*ratio*Math.sin(t),y:a.y+vy*Math.cos(t)+vx*ratio*Math.sin(t)}});out.push({type:'poly',pts,...st});note('elipses rotadas o parciales simplificadas')}
   else warn('elipses no válidas omitidas');
  }
  else if(type==='TEXT'||type==='MTEXT'||type==='ATTRIB'||type==='ATTDEF'){
   if(type==='ATTDEF'&&!(get(r,70)&2))continue; // non-constant attributes are represented by their INSERT's ATTRIB entities
   const raw=type==='MTEXT'?r.pairs.filter(p=>p[0]===3||p[0]===1).map(p=>p[1]).join(''):str(r,1,'');
   const value=type==='MTEXT'?cleanMText(raw):raw;
   if(type==='MTEXT'&&/\\(?:[AaCcFfHhQqTtWw]|p|S)/.test(raw))note('MTEXT con formato visual aproximado');
   const vx=get(r,11,1),vy=get(r,21,0);
   const rotation=r.pairs.some(p=>p[0]===50)?get(r,50):(type==='MTEXT'?Math.atan2(vy,vx)*180/Math.PI:0);
   const item={type:'text',a:{x:get(r,10),y:get(r,20)},text:value,textRotation:rotation,textHeightWorld:get(r,40,0.4),...st};
   if(type==='MTEXT'){item.mtextRaw=raw;item.mtextPlain=value}
   if(type==='ATTRIB'&&activeAttributeGroup)item.groupId=activeAttributeGroup;
   out.push(item);
  }
  else if(type==='SOLID'||type==='TRACE'||type==='3DFACE'){
   const pts=[10,11,12,13].filter(code=>r.pairs.some(pair=>pair[0]===code)).map(code=>({x:get(r,code),y:get(r,code+10)}));
   while(pts.length>3&&distance(pts[pts.length-1],pts[pts.length-2])<1e-9)pts.pop();
   if(pts.length>=3)out.push({type:'polygon',pts,...st});else warn(type+' no compatible omitido');
  }
  else if(type==='SPLINE'){
   const fitX=all(r,11),fitY=all(r,21),controlX=all(r,10),controlY=all(r,20),xs=fitX.length>=2?fitX:controlX,ys=fitY.length>=2?fitY:controlY,pts=xs.map((x,i)=>({x,y:ys[i]??0}));
   if(pts.length>=2){out.push({type:'poly',pts,...st});note(fitX.length>=2?'SPLINE aproximada por puntos de ajuste':'SPLINE aproximada por puntos de control')}else warn('SPLINE sin puntos compatibles omitida');
  }
  else if(type==='LEADER'){
   const xs=all(r,10),ys=all(r,20),pts=xs.map((x,i)=>({x,y:ys[i]??0}));
   if(pts.length>=2)out.push({type:'poly',pts,...st});else warn('LEADER sin vértices omitida');
  }
  else if(type==='VIEWPORT'){(out.layoutViewports??=[]).push({x:get(r,10),y:get(r,20),width:get(r,40),height:get(r,41),id:get(r,69)});note('VIEWPORT de presentación no editable')}
  else if(type==='VERTEX'||type==='SEQEND'){}
  else warn(type+' omitido');
 }
 out.importWarnings=Object.entries(warnings).map(([name,count])=>count+' '+name);
 out.importNotes=Object.entries(notes).map(([name,count])=>count+' '+name);
 out.importWarningCounts={...warnings};out.importDiagnostics=diagnostics;
 return out;
}
async function download(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type:type||'application/octet-stream'});if(window.OtroCadAndroid&&typeof window.OtroCadAndroid.saveFile==='function'){try{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));window.OtroCadAndroid.saveFile(name,type||'application/octet-stream',btoa(binary));return}catch(err){console.error(err)}}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
$('#project').onclick=()=>download('otrocad.json',JSON.stringify({version:2,shapes:objects},null,2),'application/json');
$('#export').onclick=()=>{let s='<svg xmlns="http://www.w3.org/2000/svg"><g fill="none">';const attrs=o=>' stroke="'+(o.color||colors[o.layer]||colors.General)+'" stroke-width="'+(o.lineweight||.25)+'"'+(o.linetype==='DASHED'?' stroke-dasharray="6 4"':'');objects.forEach(o=>{const a=o.a,b=o.b,at=attrs(o);if(o.type==='line'||o.type==='dim')s+='<line'+at+' x1="'+a.x+'" y1="'+(-a.y)+'" x2="'+b.x+'" y2="'+(-b.y)+'"/>';else if(o.type==='circle')s+='<circle'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" r="'+distance(a,b)+'"/>';else if(o.type==='rect'||o.type==='hatch')s+='<rect'+at+' x="'+Math.min(a.x,b.x)+'" y="'+(-Math.max(a.y,b.y))+'" width="'+Math.abs(b.x-a.x)+'" height="'+Math.abs(b.y-a.y)+'"/>';else if(o.type==='ellipse')s+='<ellipse'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" rx="'+Math.abs(b.x-a.x)+'" ry="'+Math.abs(b.y-a.y)+'"/>';else if(o.pts)s+='<polyline'+at+' points="'+o.pts.map(p=>p.x+','+(-p.y)).join(' ')+'"/>';else if(o.type==='text')s+='<text'+at+' x="'+a.x+'" y="'+(-a.y)+'">'+String(o.text||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</text>'});download('otrocad.svg',s+'</g></svg>','image/svg+xml')};
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
 if((approximated.length||unsupported.length||renamedLayers||groups.size)&&!confirm('Este DXF aún no conserva todos los elementos con fidelidad: '+approximated.length+' se exportarán simplificados, '+unsupported.length+' se omitirán, '+renamedLayers+' tendrán nombres de capa ajustados y '+groups.size+' bloques se desagruparán. Conserva también una copia del proyecto. ¿Exportar de todos modos?'))return null;
 const rows=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1021','9','$INSUNITS','70',String(({mm:4,cm:5,m:6})[units]||0),'0','ENDSEC'];
 const add=(...v)=>rows.push(...v.map(String));
 add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',5,'ABCD',100,'AcDbSymbolTable',70,2);
 add(0,'LTYPE',100,'AcDbSymbolTableRecord',100,'AcDbLinetypeTableRecord',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0);
 add(0,'LTYPE',100,'AcDbSymbolTableRecord',100,'AcDbLinetypeTableRecord',2,'DASHED',70,0,3,'Dashed',72,65,73,2,40,.75,49,.5,74,0,49,-.25,74,0);
 add(0,'ENDTAB');
 const layers=[...new Set(['0',...objects.map(dxfLayer)])];
 add(0,'TABLE',2,'LAYER',5,'ABCE',100,'AcDbSymbolTable',70,layers.length);
 layers.forEach(layer=>add(0,'LAYER',100,'AcDbSymbolTableRecord',100,'AcDbLayerTableRecord',2,layer,70,0,62,7,6,'CONTINUOUS'));
 add(0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
 objects.forEach(o=>{
  const a=o.a,b=o.b,layer=dxfLayer(o),color=String(o.color||colors[layer]||colors.General),rgb=/^#[0-9a-f]{6}$/i.test(color)?parseInt(color.slice(1),16):0xffffff;
  const common=[100,'AcDbEntity',8,layer,370,Math.round(Number(o.lineweight||.25)*100),6,o.linetype==='DASHED'?'DASHED':'CONTINUOUS',420,rgb];
  const line=(p,q)=>add(0,'LINE',...common,100,'AcDbLine',10,p.x,20,p.y,30,0,11,q.x,21,q.y,31,0);
  const textEntity=(p,value,height,rotation=0)=>{const valueText=String(value||'').replace(/\r/g,'');if(valueText.includes('\n'))add(0,'MTEXT',...common,100,'AcDbMText',10,p.x,20,p.y,30,0,40,height,50,rotation,1,valueText.replace(/\n/g,'\\P'));else add(0,'TEXT',...common,100,'AcDbText',10,p.x,20,p.y,30,0,40,height,50,rotation,1,valueText)};
  if(['line','dim','dimaligned','leader'].includes(o.type)&&a&&b){line(a,b);if(o.type==='dim'||o.type==='dimaligned')textEntity({x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance(a,b).toFixed(2)+' '+units,12/zoom);if(o.type==='leader'&&o.text)textEntity(b,o.text,12/zoom)}
  else if(o.type==='point'&&a)add(0,'POINT',...common,100,'AcDbPoint',10,a.x,20,a.y,30,0);
  else if(o.type==='text'&&a){if(o.mtextRaw&&o.text===o.mtextPlain)add(0,'MTEXT',...common,100,'AcDbMText',10,a.x,20,a.y,30,0,40,o.textHeightWorld||.4,50,o.textRotation||0,1,o.mtextRaw);else textEntity(a,o.text,o.textHeightWorld||Number(o.textHeight||14)/zoom,o.textRotation||0)}
  else if(o.type==='circle'&&a&&b)add(0,'CIRCLE',...common,100,'AcDbCircle',10,a.x,20,a.y,30,0,40,distance(a,b));
  else if(o.type==='arc'&&arcGeometry(o.pts)){const g=arcGeometry(o.pts);add(0,'ARC',...common,100,'AcDbCircle',10,g.x,20,g.y,30,0,40,g.r,100,'AcDbArc',50,g.start,51,g.end)}
  else if(o.type==='ellipse'&&a&&b&&a.x!==b.x&&a.y!==b.y){const rx=Math.abs(b.x-a.x),ry=Math.abs(b.y-a.y),horizontal=rx>=ry;add(0,'ELLIPSE',...common,100,'AcDbEllipse',10,a.x,20,a.y,30,0,11,horizontal?rx:0,21,horizontal?0:ry,31,0,40,Math.min(rx,ry)/Math.max(rx,ry),41,0,42,Math.PI*2)}
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
  else if(o.pts){add(0,'LWPOLYLINE',...common,100,'AcDbPolyline',90,o.pts.length,70,o.type==='polygon'?1:0);o.pts.forEach(p=>add(10,p.x,20,p.y))}
 });
 add(0,'ENDSEC',0,'EOF');return rows.join('\r\n')+'\r\n';
}
$('#dxf').onclick=()=>{const data=buildDxf();if(data!==null)download('otrocad.dxf',data,'application/dxf')};
$('#saveAsDwg').onclick=async()=>{
 const data=buildDxf();if(data===null)return;
 const button=$('#saveAsDwg');button.disabled=true;const original=button.textContent;button.textContent='Preparando DWG…';
 try{
  const engine=await getDwgRuntime();
  const bytes=engine.dxf_to_dwg(new TextEncoder().encode(data));
  if(!(bytes instanceof Uint8Array)||bytes.length<6||new TextDecoder().decode(bytes.subarray(0,6))!=='AC1032')throw Error('El motor no produjo un DWG binario AC1032 válido.');
  const checkBytes=engine.dwg_to_dxf(bytes);
  const check=parseDxfEntities(new TextDecoder('utf-8').decode(checkBytes));
  const expected=parseDxfEntities(data);
  if(!check.length||check.length!==expected.length)throw Error('La validación DWG detectó diferencias de entidades ('+expected.length+' originales, '+check.length+' al reabrir). No se descargó el archivo.');
  const blob=new Blob([bytes],{type:'application/acad'});
  if(typeof window.showSaveFilePicker==='function'&&!window.OtroCadAndroid){
   try{const handle=await window.showSaveFilePicker({suggestedName:'otrocad.dwg',types:[{description:'Dibujo AutoCAD DWG',accept:{'application/acad':['.dwg']}}]});const stream=await handle.createWritable();await stream.write(blob);await stream.close();status.textContent='DWG AC1032 guardado y reabierto para validación';return}catch(error){if(error.name==='AbortError')return;throw error}
  }
  await download('otrocad.dwg',blob,'application/acad');
  status.textContent='DWG AC1032 generado y reabierto para validación';
 }catch(error){console.error(error);alert('No se pudo guardar el DWG: '+(error.message||error))}finally{button.disabled=false;button.textContent=original}
};
$('#saveAsDxf').onclick=async()=>{
 const data=buildDxf();if(data===null)return;
 if(typeof window.showSaveFilePicker==='function'&&!window.OtroCadAndroid){
  try{const handle=await window.showSaveFilePicker({suggestedName:'otrocad.dxf',types:[{description:'Dibujo DXF',accept:{'application/dxf':['.dxf']}}]});const stream=await handle.createWritable();await stream.write(data);await stream.close();status.textContent='Archivo DXF guardado';return}catch(error){if(error.name==='AbortError')return;alert('No se pudo guardar el DXF: '+error.message);return}
 }
 const name=prompt('Nombre del archivo DXF','otrocad.dxf');if(name===null)return;
 const safe=name.trim().replace(/[\\/:*?"<>|]/g,'_');if(!safe){alert('Escribe un nombre para el archivo.');return}
 const filename=/\.dxf$/i.test(safe)?safe:safe+'.dxf';await download(filename,data,'application/dxf');status.textContent='Descarga DXF iniciada';
};
$('#pdf').onclick=()=>window.print();
$('#propertiesBtn').onclick=()=>{$('#properties').classList.toggle('open');showProperties()};
$('#zoomIn').onclick=()=>{zoom*=1.2;render()};$('#zoomOut').onclick=()=>{zoom/=1.2;render()};
function boundsPoints(o){
 const pts=[];if(o.a)pts.push(o.a);if(o.b)pts.push(o.b);if(o.pts)pts.push(...o.pts);if(o.hatchLoops)for(const loop of o.hatchLoops)pts.push(...loop);
 if(o.type==='circle'&&o.a&&o.b){const r=distance(o.a,o.b);pts.push({x:o.a.x-r,y:o.a.y-r},{x:o.a.x+r,y:o.a.y+r})}
 if(o.type==='ellipse'&&o.a&&o.b){const rx=Math.abs(o.b.x-o.a.x),ry=Math.abs(o.b.y-o.a.y);pts.push({x:o.a.x-rx,y:o.a.y-ry},{x:o.a.x+rx,y:o.a.y+ry})}
 if(o.type==='arc'&&o.pts?.length>=3){const g=arcParams(o.pts);if(g){const span=v=>(v+2*Math.PI)%(2*Math.PI);for(const t of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const onArc=g.anticlockwise?span(g.a1-t)<=span(g.a1-g.a3):span(t-g.a1)<=span(g.a3-g.a1);if(onArc)pts.push(world({x:g.x+g.r*Math.cos(t),y:g.y+g.r*Math.sin(t)}))}}}
 return pts.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
}
$('#fit').onclick=()=>{const ps=objects.flatMap(boundsPoints);if(!ps.length){offset={x:0,y:0};zoom=35;render();return}const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);const availableWidth=Math.max(20,canvas.clientWidth-80),availableHeight=Math.max(20,canvas.clientHeight-80);zoom=Math.min(10000,Math.max(.001,Math.min(availableWidth/(maxx-minx||1),availableHeight/(maxy-miny||1))));offset.x=-(minx+maxx)/2*zoom;offset.y=(miny+maxy)/2*zoom;render()};
$('#settingsBtn').onclick=showDraftSettings;$('#draftQuick').onclick=showDraftSettings;$('#snapBtn').onclick=showDraftSettings;$('#unitsBtn').onclick=showDraftSettings;
$('#layer').onchange=()=>{$('#drawColor').value=colors[$('#layer').value]||colors.General};
$('#newLayer').onclick=()=>{const name=prompt('Nombre de la nueva capa');if(name){const op=document.createElement('option');op.textContent=name;$('#layer').append(op);$('#layer').value=name;colors[name]='#62b8e8'}};
$('#layerColor').onclick=()=>{const c=prompt('Color HEX (ej. #62b8e8)',colors[$('#layer').value]||'#62b8e8');if(c&&/^#[0-9a-f]{6}$/i.test(c)){colors[$('#layer').value]=c;$('#drawColor').value=c}};
$('#layerVisibility').onclick=()=>{const l=$('#layer').value;if(hiddenLayers.has(l)){hiddenLayers.delete(l);$('#layerVisibility').textContent='Ocultar capa';status.textContent='Capa '+l+' visible'}else{hiddenLayers.add(l);$('#layerVisibility').textContent='Mostrar capa';status.textContent='Capa '+l+' oculta';applySelection(selectedItems().filter(i=>objects[i]?.layer!==l))}render()};
$('#layerLock').onclick=()=>{const l=$('#layer').value;if(lockedLayers.has(l)){lockedLayers.delete(l);$('#layerLock').textContent='Bloquear capa';status.textContent='Capa '+l+' desbloqueada'}else{lockedLayers.add(l);$('#layerLock').textContent='Desbloquear capa';status.textContent='Capa '+l+' bloqueada';applySelection(selectedItems().filter(i=>objects[i]?.layer!==l))}render()};
$('#erase').onclick=()=>{if(selectedItems().length)deleteSelection();else if(confirm('¿Borrar todo el dibujo?')){checkpoint();objects=[];clearSelection();save();render()}};
try{const saved=JSON.parse(localStorage.getItem('otrocad-drawing')||'[]');if(Array.isArray(saved))objects=saved}catch(e){}
window.addEventListener('beforeprint',()=>{printing=true;render()});window.addEventListener('afterprint',()=>{printing=false;render()});
new ResizeObserver(resize).observe(stage);setTool('line');resize();
})();
