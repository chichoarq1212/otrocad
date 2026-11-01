(()=>{
const $=s=>document.querySelector(s), canvas=$('#cad'),ctx=canvas.getContext('2d'),stage=$('#stage'),status=$('#status'),promptEl=$('#prompt');
let objects=[],undo=[],redo=[],tool='line',start=null,temp=null,selected=-1,poly=[],cursor={x:0,y:0},zoom=35,offset={x:0,y:0},drag=null;
let gridOn=true,orthoOn=false,snapOn=false,osnapOn=true,polarOn=false,crossOn=true,moveBase=null,modifyTarget=-1,polySides=6;
const colors={General:'#dce8f5',Muros:'#56b7e8',Cotas:'#f3c83e',Detalles:'#c69cff',Topografía:'#70d6a3',Vialidad:'#ff9b6b'};
const clone=x=>JSON.parse(JSON.stringify(x));
function checkpoint(){undo.push(clone(objects));if(undo.length>100)undo.shift();redo=[]}
function save(){localStorage.setItem('otrocad-drawing',JSON.stringify(objects))}
function world(p){return{x:(p.x-canvas.clientWidth/2-offset.x)/zoom,y:(canvas.clientHeight/2+offset.y-p.y)/zoom}}
function screen(p){return{x:canvas.clientWidth/2+offset.x+p.x*zoom,y:canvas.clientHeight/2+offset.y-p.y*zoom}}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function round(p){return{x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}
function normalize(a){return (a%360+360)%360}
function snapPoint(p){
 let q={...p},best=null,limit=12/zoom;
 if(osnapOn){
  for(const s of objects){
   const pts=[];
   if(s.a)pts.push(s.a);if(s.b)pts.push(s.b);
   if(s.pts)pts.push(...s.pts);
   if(s.a&&s.b&&s.type==='line')pts.push({x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2});
   if(s.a&&s.type==='circle')pts.push(s.a);
   for(const v of pts){const d=distance(q,v);if(d<limit){limit=d;best=v}}
  }
 }
 if(best)return {...best};
 if(snapOn){q.x=Math.round(q.x);q.y=Math.round(q.y)}
 return q;
}
function constrain(p){
 if(!start)return p;
 let dx=p.x-start.x,dy=p.y-start.y;
 if(orthoOn){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
 else if(polarOn){const len=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*(Math.PI/12);dx=len*Math.cos(a);dy=len*Math.sin(a)}
 return round({x:start.x+dx,y:start.y+dy});
}
function drawEntity(s,sel=false){
 ctx.save();const color=sel?'#f3c83e':(s.color||colors[s.layer]||colors.General);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=sel?2.2:1.25;
 const a=s.a&&screen(s.a),b=s.b&&screen(s.b);
 if(s.type==='line'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 else if(s.type==='poly'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.stroke()}
 else if(s.type==='circle'){ctx.beginPath();ctx.arc(a.x,a.y,distance(a,b),0,Math.PI*2);ctx.stroke()}
 else if(s.type==='rect'||s.type==='hatch'){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);ctx.strokeRect(x,y,w,h);if(s.type==='hatch'){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.lineWidth=.7;for(let k=-h;k<w+h;k+=10){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k+h,y+h);ctx.stroke()}ctx.restore()}}
 else if(s.type==='ellipse'){ctx.beginPath();ctx.ellipse(a.x,a.y,Math.abs(b.x-a.x),Math.abs(b.y-a.y),0,0,Math.PI*2);ctx.stroke()}
 else if(s.type==='polygon'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.closePath();ctx.stroke()}
 else if(s.type==='dim'){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-4,a.y-4);ctx.lineTo(a.x+4,a.y+4);ctx.moveTo(b.x-4,b.y-4);ctx.lineTo(b.x+4,b.y+4);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle='#f3c83e';ctx.fillText(distance(s.a,s.b).toFixed(2),(mid.x+7),(mid.y-8))}
 else if(s.type==='text'){ctx.font='14px system-ui';ctx.fillText(s.text||'Texto',a.x,a.y)}
 ctx.restore();
}
function drawGrid(w,h){
 if(!gridOn)return;let gap=zoom;while(gap<18)gap*=2;while(gap>80)gap/=2;
 ctx.strokeStyle='#263747';ctx.lineWidth=1;ctx.beginPath();
 const ox=(w/2+offset.x)%gap,oy=(h/2+offset.y)%gap;
 for(let x=ox;x<w;x+=gap){ctx.moveTo(x,0);ctx.lineTo(x,h)}
 for(let y=oy;y<h;y+=gap){ctx.moveTo(0,y);ctx.lineTo(w,y)}
 ctx.stroke();
 const o=screen({x:0,y:0});ctx.strokeStyle='#46637b';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(o.x,0);ctx.lineTo(o.x,h);ctx.moveTo(0,o.y);ctx.lineTo(w,o.y);ctx.stroke();
}
function updateDynamic(){
 if(!start||!temp){$('#dynamic').style.display='none';return}
 $('#dynamic').style.display='flex';
 const len=distance(start,temp.b),ang=normalize(angle(start,temp.b));
 if(document.activeElement!==$('#dynLen'))$('#dynLen').value=len.toFixed(3);
 if(document.activeElement!==$('#dynAngle'))$('#dynAngle').value=ang.toFixed(1);
}
function updatePrompt(){promptEl.textContent=start?'Siguiente punto · longitud y ángulo editables':('Comando: '+tool.toUpperCase())}
function render(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#101820';ctx.fillRect(0,0,w,h);drawGrid(w,h);
 objects.forEach((s,i)=>drawEntity(s,i===selected));
 if(temp)drawEntity(temp,true);
 if(tool==='poly'&&poly.length){drawEntity({type:'poly',pts:poly.concat(temp?[temp.b]:[]),layer:$('#layer').value},true)}
 if(start&&crossOn){const p=screen(start);ctx.strokeStyle='#f3c83e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.stroke()}
 if(crossOn){const p=cursor;ctx.strokeStyle='#5cb7e8aa';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,h);ctx.moveTo(0,p.y);ctx.lineTo(w,p.y);ctx.stroke()}
 if(temp&&start){const a=screen(start),b=screen(temp.b);ctx.fillStyle='#f3c83e';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText(distance(start,temp.b).toFixed(2)+' < '+normalize(angle(start,temp.b)).toFixed(1)+'°',b.x+12,b.y-12)}
 updateDynamic();
}
function resize(){const d=window.devicePixelRatio||1,r=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);render()}
function setTool(t){tool=t;start=null;temp=null;poly=[];moveBase=null;modifyTarget=-1;selected=-1;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));updatePrompt();render()}
function selectAt(q){let found=-1,best=14/zoom;for(let i=objects.length-1;i>=0;i--){const s=objects[i];let d=1e9;if(s.type==='poly'||s.type==='polygon'){for(let j=0;j<s.pts.length;j++)d=Math.min(d,pointLineDistance(q,s.pts[j],s.pts[(j+1)%s.pts.length]))}else if(s.type==='rect'||s.type==='hatch'||s.type==='ellipse'){if(q.x>=Math.min(s.a.x,s.b.x)-best&&q.x<=Math.max(s.a.x,s.b.x)+best&&q.y>=Math.min(s.a.y,s.b.y)-best&&q.y<=Math.max(s.a.y,s.b.y)+best)d=0}else if(s.type==='circle')d=Math.abs(distance(q,s.a)-distance(s.a,s.b));else if(s.a&&s.b)d=pointLineDistance(q,s.a,s.b);if(d<best){best=d;found=i}}return found}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function showProperties(){const box=$('#properties'),content=$('#propContent');if(selected<0){content.textContent='Selecciona una entidad para editar sus propiedades.';return}const s=objects[selected];box.classList.add('open');content.innerHTML='';[['Tipo',s.type],['Capa',s.layer||'General'],['Color',s.color||'Por capa']].forEach(([k,v])=>{const l=document.createElement('label');l.textContent=k;const inp=document.createElement('input');inp.value=v;inp.readOnly=true;content.append(l,inp)});if(s.a&&s.b){[['X inicial',s.a.x],['Y inicial',s.a.y],['X final',s.b.x],['Y final',s.b.y]].forEach(([k,v])=>{const l=document.createElement('label');l.textContent=k;const inp=document.createElement('input');inp.value=Number(v).toFixed(3);inp.dataset.coord=k;content.append(l,inp)});const apply=document.createElement('button');apply.textContent='Aplicar coordenadas';apply.onclick=()=>{checkpoint();content.querySelectorAll('input[data-coord]').forEach(inp=>{const v=Number(inp.value),k=inp.dataset.coord;if(!Number.isFinite(v))return;if(k==='X inicial')s.a.x=v;if(k==='Y inicial')s.a.y=v;if(k==='X final')s.b.x=v;if(k==='Y final')s.b.y=v});save();render()};content.append(apply)}}
function pointFromInputs(){const ls=$('#dynLen').value.trim(),as=$('#dynAngle').value.trim();if(!ls||!as)return null;const len=Number(ls),ang=Number(as);if(!Number.isFinite(len)||len<0||!Number.isFinite(ang))return null;const rad=ang*Math.PI/180;return round({x:start.x+len*Math.cos(rad),y:start.y+len*Math.sin(rad)})}
function commitEntity(endPoint){
 if(!start)return;
 const layer=$('#layer').value;
 checkpoint();
 if(tool==='line')objects.push({type:'line',a:clone(start),b:clone(endPoint),layer});
 else if(tool==='dim')objects.push({type:'dim',a:clone(start),b:clone(endPoint),layer:'Cotas'});
 else if(tool==='rect'||tool==='hatch'||tool==='ellipse')objects.push({type:tool,a:clone(start),b:clone(endPoint),layer});
 else if(tool==='circle')objects.push({type:'circle',a:clone(start),b:clone(endPoint),layer});
 else if(tool==='polygon'){const n=Math.max(3,Math.min(64,polySides));const r=distance(start,endPoint);const pts=[];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;pts.push({x:start.x+r*Math.cos(a),y:start.y+r*Math.sin(a)})}objects.push({type:'polygon',pts,layer})}
 save();selected=objects.length-1;start=null;temp=null;render();updatePrompt();
}
function finishPoly(){if(poly.length>1){checkpoint();objects.push({type:'poly',pts:clone(poly),layer:$('#layer').value});save()}poly=[];start=null;temp=null;render();status.textContent='Polilínea terminada'}
function doOffset(q){if(selected<0){selected=selectAt(q);if(selected<0){status.textContent='Selecciona una entidad para OFFSET';return}status.textContent='Indica distancia de desfase';return}
 const s=objects[selected],d=Number($('#dynLen').value||1);if(!Number.isFinite(d)||d<=0){status.textContent='Introduce una distancia positiva';return}checkpoint();
 if(s.type==='line'){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;const side=((q.x-s.a.x)*(-dy/L)+(q.y-s.a.y)*(dx/L))>=0?1:-1;const ox=-dy/L*d*side,oy=dx/L*d*side;objects.push({type:'line',a:{x:s.a.x+ox,y:s.a.y+oy},b:{x:s.b.x+ox,y:s.b.y+oy},layer:s.layer})}
 else if(s.type==='circle'){const r=distance(s.a,s.b),newR=r+(distance(q,s.a)>r?d:-d);if(newR>0)objects.push({type:'circle',a:clone(s.a),b:{x:s.a.x+newR,y:s.a.y},layer:s.layer})}
 else if(s.type==='rect'){const cx=(s.a.x+s.b.x)/2,cy=(s.a.y+s.b.y)/2,expand=distance(q,{x:cx,y:cy})>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)/2?d:-d;objects.push({type:'rect',a:{x:s.a.x-expand,y:s.a.y-expand},b:{x:s.b.x+expand,y:s.b.y+expand},layer:s.layer})}
 else {status.textContent='OFFSET para este tipo de entidad aún no disponible';return}
 save();selected=objects.length-1;render();status.textContent='OFFSET creado';
}
function handleTap(p){
 let q=snapPoint(world(p));q=constrain(q);
 if(tool==='select'){selected=selectAt(q);showProperties();render();return}
 if(tool==='pan'){return}
 if(tool==='offset'){doOffset(q);return}
 if(tool==='poly'){poly.push(q);temp=null;render();status.textContent='Polilínea: marca otro vértice o pulsa Enter';return}
 if(tool==='move'||tool==='copy'){
  if(modifyTarget<0){modifyTarget=selectAt(q);selected=modifyTarget;if(modifyTarget<0){status.textContent='Selecciona el objeto';return}moveBase=null;status.textContent='Indica punto base';return}
  if(!moveBase){moveBase=q;status.textContent='Indica punto destino';return}
  const dx=q.x-moveBase.x,dy=q.y-moveBase.y;checkpoint();const src=objects[modifyTarget];if(tool==='copy'){const c=clone(src);translate(c,dx,dy);objects.push(c);selected=objects.length-1}else{translate(src,dx,dy);selected=modifyTarget}save();modifyTarget=-1;moveBase=null;render();return;
 }
 if(!start){start=q;temp={type:tool,a:clone(q),b:clone(q),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';updatePrompt();render();return}
 let end=pointFromInputs();if(!end)end=q;else if(document.activeElement!==$('#dynLen')&&document.activeElement!==$('#dynAngle'))end=q;
 end=constrain(end);
 if(tool==='line'||tool==='dim'||tool==='rect'||tool==='hatch'||tool==='circle'||tool==='ellipse'||tool==='polygon'){commitEntity(end)}
}
function translate(s,dx,dy){if(s.a){s.a.x+=dx;s.a.y+=dy}if(s.b){s.b.x+=dx;s.b.y+=dy}if(s.pts)s.pts.forEach(p=>{p.x+=dx;p.y+=dy})}
let pointers=new Map(),pinch=null,selectionStart=null,selectionBox=null;
canvas.addEventListener('pointerdown',e=>{
 if(e.button===2){e.preventDefault();return}
 canvas.setPointerCapture(e.pointerId);const p=pointer(e);pointers.set(e.pointerId,p);
 if(pointers.size===2){const v=[...pointers.values()];pinch={dist:distance(v[0],v[1]),zoom};start=null;temp=null;return}
 if(tool==='pan'){drag={point:p,offset:clone(offset)};return}
 if(tool==='select'){selectionStart=p;selectionBox=null;return}
 handleTap(p);
});
canvas.addEventListener('pointermove',e=>{
 const p=pointer(e);cursor=p;$('#crossinfo').textContent='X '+world(p).x.toFixed(3)+' · Y '+world(p).y.toFixed(3)+' · Z 0.000';
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
 if(pointers.size===2&&pinch){const v=[...pointers.values()];zoom=Math.max(2,Math.min(500,pinch.zoom*distance(v[0],v[1])/(pinch.dist||1)));render();return}
 if(drag&&tool==='pan'){offset.x=drag.offset.x+p.x-drag.point.x;offset.y=drag.offset.y+p.y-drag.point.y;render();return}
 if(selectionStart){selectionBox={a:selectionStart,b:p};render();return}
 if(start){let q=constrain(snapPoint(world(p)));temp={type:tool,a:clone(start),b:q,layer:$('#layer').value};render()}
 else render();
});
function pointerEnd(e){
 pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
 if(selectionStart&&selectionBox){const a=world(selectionBox.a),b=world(selectionBox.b),left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),bottom=Math.min(a.y,b.y),top=Math.max(a.y,b.y);selected=-1;for(let i=objects.length-1;i>=0;i--){const s=objects[i],pts=[];if(s.a)pts.push(s.a);if(s.b)pts.push(s.b);if(s.pts)pts.push(...s.pts);if(pts.some(p=>p.x>=left&&p.x<=right&&p.y>=bottom&&p.y<=top)){selected=i;break}}selectionStart=null;selectionBox=null;showProperties()}
 if(drag&&tool==='pan')drag=null;
 render();
}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(poly.length)finishPoly();else if(start){start=null;temp=null;render()}else {$('#cmd').value='';$('#cmd').focus()}});
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointer(e),before=world(p);zoom=Math.max(2,Math.min(500,zoom*(e.deltaY<0?1.12:.89)));const after=screen(before);offset.x+=p.x-after.x;offset.y+=p.y-after.y;render()},{passive:false});
function updateToggle(id,on){$(id).classList.toggle('active',on)}
function toggle(id){const map={gridToggle:'gridOn',orthoToggle:'orthoOn',snapToggle:'snapOn',polarToggle:'polarOn',osnapToggle:'osnapOn',crossToggle:'crossOn'};const k=map[id];if(k==='gridOn')gridOn=!gridOn;if(k==='orthoOn')orthoOn=!orthoOn;if(k==='snapOn')snapOn=!snapOn;if(k==='polarOn')polarOn=!polarOn;if(k==='osnapOn')osnapOn=!osnapOn;if(k==='crossOn')crossOn=!crossOn;const values={gridOn,orthoOn,snapOn,polarOn,osnapOn,crossOn};updateToggle('#'+id,values[k]);render()}
[['gridToggle',gridOn],['orthoToggle',orthoOn],['snapToggle',snapOn],['polarToggle',polarOn],['osnapToggle',osnapOn],['crossToggle',crossOn]].forEach(([id,on])=>updateToggle('#'+id,on));
['gridToggle','orthoToggle','snapToggle','polarToggle','osnapToggle','crossToggle'].forEach(id=>$('#'+id).onclick=()=>toggle(id));
document.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){if(e.key==='Enter'&&document.activeElement.id==='dynLen'){e.preventDefault();$('#dynAngle').focus()}else if(e.key==='Enter'&&document.activeElement.id==='dynAngle'){e.preventDefault();const q=pointFromInputs();if(q)commitEntity(q)}return}
 if(e.key==='Escape'){start=null;temp=null;poly=[];moveBase=null;modifyTarget=-1;render();return}
 if(e.key==='F7'){e.preventDefault();toggle('gridToggle');return}if(e.key==='F8'){e.preventDefault();toggle('orthoToggle');return}if(e.key==='F9'){e.preventDefault();toggle('snapToggle');return}if(e.key==='F10'){e.preventDefault();toggle('polarToggle');return}if(e.key==='F3'){e.preventDefault();toggle('osnapToggle');return}
 if(e.key==='Enter'){if(poly.length){finishPoly();return}if(start){const q=pointFromInputs();if(q)commitEntity(q);return}}
 if(e.key===' '&&poly.length){finishPoly();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){$('#undo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){$('#redo').click();return}
});
const aliases={L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',REC:'rect',RECT:'rect',RECTANG:'rect',H:'hatch',HATCH:'hatch',D:'dim',DIM:'dim',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',O:'offset',OFFSET:'offset',P:'pan',PAN:'pan',V:'select',SELECT:'select'};
function runCommand(raw){const c=raw.trim().toUpperCase().split(/\s+/)[0];if(!c)return;
 if(c==='F7'||c==='GRID'){toggle('gridToggle');return}if(c==='F8'||c==='ORTHO'){toggle('orthoToggle');return}if(c==='F9'||c==='SNAP'){toggle('snapToggle');return}if(c==='F10'||c==='POLAR'){toggle('polarToggle');return}if(c==='F3'||c==='OSNAP'){toggle('osnapToggle');return}
 if(c==='U'||c==='UNDO'){$('#undo').click();return}if(c==='REDO'){$('#redo').click();return}
 if(c==='HP'||c==='DSETTINGS'||c==='SETTINGS'){alert('CONFIGURACIÓN DE DIBUJO\nF7 Rejilla: '+(gridOn?'ACTIVA':'INACTIVA')+'\nF8 Orto: '+(orthoOn?'ACTIVO':'INACTIVO')+'\nF9 Snap: '+(snapOn?'ACTIVO':'INACTIVO')+'\nF10 Polar: '+(polarOn?'ACTIVO':'INACTIVO')+'\nF3 Referencias: '+(osnapOn?'ACTIVAS':'INACTIVAS'));return}
 if(c==='PR'||c==='PROPERTIES'||c==='CTRL+1'){$('#properties').classList.toggle('open');showProperties();return}
 if(c==='E'||c==='ERASE'||c==='DELETE'){if(selected>=0){checkpoint();objects.splice(selected,1);selected=-1;save();render()}return}
 if(c==='Z'||c==='ZOOM'){zoom=Math.min(500,zoom*1.25);render();return}
 if(c==='RE'||c==='REGEN'){render();return}
 if(c==='EX'||c==='EXPLODE'){status.textContent='EXPLODE: selección de bloques y polilíneas en desarrollo';return}
 if(c==='TR'||c==='TRIM'||c==='EX'||c==='EXTEND'||c==='RO'||c==='ROTATE'||c==='SC'||c==='SCALE'||c==='MI'||c==='MIRROR'||c==='F'||c==='FILLET'||c==='CHA'||c==='CHAMFER'){status.textContent=c+' reconocido · herramienta en desarrollo';return}
 if(aliases[c]){setTool(aliases[c]);return}
 status.textContent='Comando no reconocido: '+c;
}
$('#cmd').addEventListener('keydown',e=>{if(e.key==='Enter'){runCommand($('#cmd').value);$('#cmd').value=''}});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab)});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('#finish-poly').onclick=finishPoly;
$('#acceptPoint').onclick=()=>{const q=pointFromInputs();if(q)commitEntity(q)};
$('#undo').onclick=()=>{if(undo.length){redo.push(clone(objects));objects=undo.pop();save();render()}};
$('#redo').onclick=()=>{if(redo.length){undo.push(clone(objects));objects=redo.pop();save();render()}};
$('#save').onclick=()=>{save();status.textContent='Dibujo guardado en este dispositivo'};
$('#open').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{try{const v=JSON.parse(await e.target.files[0].text());const arr=Array.isArray(v)?v:v.shapes;if(!Array.isArray(arr))throw Error('Archivo no válido');checkpoint();objects=arr;save();render()}catch(err){alert(err.message)}};
function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
$('#project').onclick=()=>download('otrocad.json',JSON.stringify({version:2,shapes:objects},null,2),'application/json');
$('#export').onclick=()=>{let s='<svg xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#17243a">';objects.forEach(o=>{if(o.type==='line'||o.type==='dim')s+='<line x1="'+o.a.x+'" y1="'+(-o.a.y)+'" x2="'+o.b.x+'" y2="'+(-o.b.y)+'"/>';else if(o.type==='circle')s+='<circle cx="'+o.a.x+'" cy="'+(-o.a.y)+'" r="'+distance(o.a,o.b)+'"/>';else if(o.type==='rect'||o.type==='hatch')s+='<rect x="'+Math.min(o.a.x,o.b.x)+'" y="'+(-Math.max(o.a.y,o.b.y))+'" width="'+Math.abs(o.b.x-o.a.x)+'" height="'+Math.abs(o.b.y-o.a.y)+'"/>';else if(o.pts)s+='<polyline points="'+o.pts.map(p=>p.x+','+(-p.y)).join(' ')+'"/>'});download('otrocad.svg',s+'</g></svg>','image/svg+xml')};
$('#dxf').onclick=()=>{const rows=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','0','ENDSEC','0','SECTION','2','ENTITIES'];const add=(...v)=>rows.push(...v.map(String));objects.forEach(o=>{const a=o.a,b=o.b,layer=o.layer||'General';if(o.type==='line'||o.type==='dim')add(0,'LINE',8,layer,10,a.x,20,a.y,30,0,11,b.x,21,b.y,31,0);else if(o.type==='circle')add(0,'CIRCLE',8,layer,10,a.x,20,a.y,30,0,40,distance(a,b));else if(o.type==='rect'||o.type==='hatch'){const ps=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];add(0,'LWPOLYLINE',8,layer,90,4,70,1);ps.forEach(p=>add(10,p.x,20,p.y))}else if(o.pts){add(0,'LWPOLYLINE',8,layer,90,o.pts.length,70,o.type==='polygon'?1:0);o.pts.forEach(p=>add(10,p.x,20,p.y))}});add(0,'ENDSEC',0,'EOF');download('otrocad.dxf',rows.join('\r\n')+'\r\n','application/dxf')};
$('#propertiesBtn').onclick=()=>{$('#properties').classList.toggle('open');showProperties()};
$('#zoomIn').onclick=()=>{zoom*=1.2;render()};$('#zoomOut').onclick=()=>{zoom/=1.2;render()};
$('#fit').onclick=()=>{if(!objects.length){offset={x:0,y:0};zoom=35;render();return}const ps=[];objects.forEach(o=>{if(o.a)ps.push(o.a);if(o.b)ps.push(o.b);if(o.pts)ps.push(...o.pts)});const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);zoom=Math.min((canvas.clientWidth-80)/(maxx-minx||1),(canvas.clientHeight-80)/(maxy-miny||1));offset.x=-(minx+maxx)/2*zoom;offset.y=(miny+maxy)/2*zoom;render()};
$('#settingsBtn').onclick=()=>runCommand('HP');$('#snapBtn').onclick=()=>toggle('osnapToggle');$('#unitsBtn').onclick=()=>alert('Unidades de dibujo: unidades de proyecto; las medidas se muestran con 3 decimales.');
$('#newLayer').onclick=()=>{const name=prompt('Nombre de la nueva capa');if(name){const op=document.createElement('option');op.textContent=name;$('#layer').append(op);$('#layer').value=name;colors[name]='#62b8e8'}};
$('#layerColor').onclick=()=>{const c=prompt('Color HEX (ej. #62b8e8)',colors[$('#layer').value]||'#62b8e8');if(c&&/^#[0-9a-f]{6}$/i.test(c))colors[$('#layer').value]=c};
$('#erase').onclick=()=>{if(selected>=0){checkpoint();objects.splice(selected,1);selected=-1;save();render()}else if(confirm('¿Borrar todo el dibujo?')){checkpoint();objects=[];save();render()}};
try{const saved=JSON.parse(localStorage.getItem('otrocad-drawing')||'[]');if(Array.isArray(saved))objects=saved}catch(e){}
new ResizeObserver(resize).observe(stage);setTool('line');resize();
})();