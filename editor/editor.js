(()=>{
const $=s=>document.querySelector(s), canvas=$('#cad'),ctx=canvas.getContext('2d'),stage=$('#stage'),status=$('#status'),promptEl=$('#prompt');
let objects=[],undo=[],redo=[],tool='line',start=null,temp=null,selected=-1,selectedSet=new Set(),modifyTargets=[],poly=[],arcPoints=[],cursor={x:0,y:0},zoom=35,offset={x:0,y:0},drag=null;
let gridOn=true,orthoOn=false,snapOn=false,osnapOn=true,polarOn=false,crossOn=true,moveBase=null,modifyTarget=-1,polySides=6,offsetDistance=1,offsetDistancePreset=false,printing=false,units='m',gridStep=1,polarStep=15,snapRadius=12,hiddenLayers=new Set(),lockedLayers=new Set();
const colors={General:'#dce8f5',Muros:'#56b7e8',Cotas:'#f3c83e',Detalles:'#c69cff',Topografía:'#70d6a3',Vialidad:'#ff9b6b'};
const clone=x=>JSON.parse(JSON.stringify(x));
function checkpoint(){undo.push(clone(objects));if(undo.length>100)undo.shift();redo=[]}
function selectedItems(){const out=new Set(selectedSet);if(selected>=0)out.add(selected);return [...out].filter(i=>i>=0&&i<objects.length).sort((a,b)=>a-b)}
function applySelection(indices,additive=false){const next=additive?new Set(selectedItems()):new Set();for(const i of indices)if(i>=0&&i<objects.length)next.add(i);selectedSet=next;selected=next.size?[...next].sort((a,b)=>a-b).at(-1):-1}
function clearSelection(){selected=-1;selectedSet.clear()}
function deleteSelection(){const ids=selectedItems();if(!ids.length)return;checkpoint();ids.sort((a,b)=>b-a).forEach(i=>objects.splice(i,1));clearSelection();save();render();status.textContent=ids.length===1?'Objeto eliminado':ids.length+' objetos eliminados'}
function save(){localStorage.setItem('otrocad-drawing',JSON.stringify(objects))}
function world(p){return{x:(p.x-canvas.clientWidth/2-offset.x)/zoom,y:(canvas.clientHeight/2+offset.y-p.y)/zoom}}
function screen(p){return{x:canvas.clientWidth/2+offset.x+p.x*zoom,y:canvas.clientHeight/2+offset.y-p.y*zoom}}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function round(p){return{x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}
function normalize(a){return (a%360+360)%360}
function snapPoint(p){
 let q={...p},best=null,limit=snapRadius/zoom;
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
 if(snapOn){q.x=Math.round(q.x/gridStep)*gridStep;q.y=Math.round(q.y/gridStep)*gridStep}
 return q;
}
function constrain(p){
 const base=tool==='poly'&&poly.length?poly[poly.length-1]:start;
 if(!base)return p;
 let dx=p.x-base.x,dy=p.y-base.y;
 if(orthoOn){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0}
 else if(polarOn){const len=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(polarStep*Math.PI/180))*(polarStep*Math.PI/180);dx=len*Math.cos(a);dy=len*Math.sin(a)}
 return round({x:base.x+dx,y:base.y+dy});
}
function arcParams(points){if(!points||points.length<3)return null;const p=points.map(screen),[a,b,c]=p;const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-6)return null;const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;const x=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;const a1=Math.atan2(a.y-y,a.x-x),am=Math.atan2(b.y-y,b.x-x),a3=Math.atan2(c.y-y,c.x-x),span=v=>(v+Math.PI*2)%(Math.PI*2),ccw=span(a3-a1),mid=span(am-a1);return{x,y,r:Math.hypot(a.x-x,a.y-y),a1,a3,anticlockwise:mid>ccw}}
function drawEntity(s,sel=false,preview=false){
 ctx.save();const baseColor=s.color||colors[s.layer]||colors.General,color=preview?'#62b8e8':(sel&&!printing?'#f3c83e':(printing&&baseColor.toLowerCase()==='#dce8f5'?'#111111':baseColor));ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=preview?1.5:(sel?2.2:Math.max(.8,Math.min(8,Number(s.lineweight||.25)*2.4)));ctx.setLineDash(preview?[8,6]:(s.linetype==='DASHED'?[8,5]:[]));ctx.lineDashOffset=0;ctx.globalAlpha=preview?.95:1;
 const a=s.a&&screen(s.a),b=s.b&&screen(s.b);
 if(s.type==='line'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 else if(s.type==='poly'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.stroke()}
 else if(s.type==='arc'){const g=arcParams(s.pts);if(g){ctx.beginPath();ctx.arc(g.x,g.y,g.r,g.a1,g.a3,g.anticlockwise);ctx.stroke()}else{const ps=s.pts.map(screen);ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ctx.quadraticCurveTo(ps[1].x,ps[1].y,ps[2].x,ps[2].y);ctx.stroke()}}
 else if(s.type==='leader'){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.font='12px system-ui';ctx.fillText(s.text||'',b.x+4,b.y-4)}
 else if(s.type==='circle'){ctx.beginPath();ctx.arc(a.x,a.y,distance(a,b),0,Math.PI*2);ctx.stroke()}
 else if(s.type==='rect'||s.type==='hatch'){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);ctx.strokeRect(x,y,w,h);if(s.type==='hatch'){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.lineWidth=.7;for(let k=-h;k<w+h;k+=10){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k+h,y+h);ctx.stroke()}ctx.restore()}}
 else if(s.type==='ellipse'){ctx.beginPath();ctx.ellipse(a.x,a.y,Math.abs(b.x-a.x),Math.abs(b.y-a.y),0,0,Math.PI*2);ctx.stroke()}
 else if(s.type==='polygon'){ctx.beginPath();s.pts.forEach((p,i)=>{const v=screen(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.closePath();ctx.stroke()}
 else if(s.type==='dim'){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-4,a.y-4);ctx.lineTo(a.x+4,a.y+4);ctx.moveTo(b.x-4,b.y-4);ctx.lineTo(b.x+4,b.y+4);ctx.stroke();ctx.font='12px system-ui';ctx.fillStyle=printing?'#111111':'#f3c83e';ctx.fillText(distance(s.a,s.b).toFixed(2)+' '+units,(mid.x+7),(mid.y-8))}
 else if(s.type==='text'){ctx.font=(Number(s.textHeight||14))+'px system-ui';ctx.fillText(s.text||'Texto',a.x,a.y)}
 ctx.restore();
}
function drawGrid(w,h){
 if(!gridOn)return;let gap=zoom*gridStep;while(gap<18)gap*=2;while(gap>80)gap/=2;
 ctx.strokeStyle='#263747';ctx.lineWidth=1;ctx.beginPath();
 const ox=(w/2+offset.x)%gap,oy=(h/2+offset.y)%gap;
 for(let x=ox;x<w;x+=gap){ctx.moveTo(x,0);ctx.lineTo(x,h)}
 for(let y=oy;y<h;y+=gap){ctx.moveTo(0,y);ctx.lineTo(w,y)}
 ctx.stroke();
 const o=screen({x:0,y:0});ctx.strokeStyle='#46637b';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(o.x,0);ctx.lineTo(o.x,h);ctx.moveTo(0,o.y);ctx.lineTo(w,o.y);ctx.stroke();
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
 <h3 style="margin:0;color:#62b8e8">Configuración de dibujo · HP</h3>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
 <label><input id="setGrid" type="checkbox" ${gridOn?'checked':''}> Rejilla F7</label>
 <label><input id="setSnap" type="checkbox" ${snapOn?'checked':''}> Snap F9</label>
 <label><input id="setOrtho" type="checkbox" ${orthoOn?'checked':''}> ORTHO F8</label>
 <label><input id="setPolar" type="checkbox" ${polarOn?'checked':''}> POLAR F10</label>
 <label><input id="setOsnap" type="checkbox" ${osnapOn?'checked':''}> Referencias F3</label>
 <label><input id="setCross" type="checkbox" ${crossOn?'checked':''}> Cruceta</label>
 </div>
 <label>Unidades de dibujo <select id="setUnits" style="width:100%;padding:7px;background:#0e1722;color:white"><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option><option value="mm">Milímetros (mm)</option></select></label>
 <label>Espaciado de rejilla <input id="setGridStep" type="number" min="0.001" step="0.1" value="${gridStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Incremento polar (grados) <input id="setPolarStep" type="number" min="1" max="90" step="1" value="${polarStep}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <label>Radio de referencias (px) <input id="setSnapRadius" type="number" min="2" max="40" step="1" value="${snapRadius}" style="width:100%;padding:7px;background:#0e1722;color:white"></label>
 <div style="display:flex;justify-content:flex-end;gap:8px"><button id="cancelSettings" type="button">Cancelar</button><button id="applySettings" type="button" style="background:#f3c83e;color:#101b2e;font-weight:800">Aplicar</button></div>
 </form>`;
 document.body.append(dlg);dlg.querySelector('#setUnits').value=units;
 dlg.querySelector('#cancelSettings').onclick=()=>dlg.close();
 dlg.querySelector('#applySettings').onclick=()=>{
  gridOn=dlg.querySelector('#setGrid').checked;snapOn=dlg.querySelector('#setSnap').checked;orthoOn=dlg.querySelector('#setOrtho').checked;polarOn=dlg.querySelector('#setPolar').checked;osnapOn=dlg.querySelector('#setOsnap').checked;crossOn=dlg.querySelector('#setCross').checked;
  units=dlg.querySelector('#setUnits').value;gridStep=Math.max(.001,Number(dlg.querySelector('#setGridStep').value)||1);polarStep=Math.max(1,Math.min(90,Number(dlg.querySelector('#setPolarStep').value)||15));snapRadius=Math.max(2,Math.min(40,Number(dlg.querySelector('#setSnapRadius').value)||12));
  dlg.close();status.textContent='Configuración de dibujo aplicada';render();
 };
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
function updatePrompt(){promptEl.textContent=(start||poly.length)?'Siguiente punto · longitud y ángulo editables':('Comando: '+tool.toUpperCase())}
function render(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle=printing?'#ffffff':'#101820';ctx.fillRect(0,0,w,h);if(!printing)drawGrid(w,h);
 objects.forEach((s,i)=>{if(!hiddenLayers.has(s.layer))drawEntity(s,i===selected||selectedSet.has(i))});
 if(!printing&&selectionBox){const l=Math.min(selectionBox.a.x,selectionBox.b.x),r=Math.max(selectionBox.a.x,selectionBox.b.x),t=Math.min(selectionBox.a.y,selectionBox.b.y),b=Math.max(selectionBox.a.y,selectionBox.b.y),win=selectionBox.b.x>=selectionBox.a.x;ctx.save();ctx.fillStyle=win?'rgba(55,145,255,.14)':'rgba(48,210,125,.14)';ctx.strokeStyle=win?'#4a9bff':'#35d28a';ctx.lineWidth=1.4;ctx.setLineDash(win?[]:[7,4]);ctx.fillRect(l,t,r-l,b-t);ctx.strokeRect(l,t,r-l,b-t);ctx.setLineDash([]);ctx.font='11px system-ui';ctx.fillStyle=win?'#78b8ff':'#65e6a8';ctx.fillText(win?'VENTANA':'CRUCE',l+5,Math.max(13,t-5));ctx.restore()}
 if(temp)drawEntity(temp,false,true);
 if(tool==='poly'&&poly.length)drawEntity({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)},false);
 if(!printing&&start&&crossOn){const p=screen(start);ctx.strokeStyle='#f3c83e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.stroke()}
 if(!printing&&crossOn){const p=cursor;ctx.strokeStyle='#5cb7e8aa';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,h);ctx.moveTo(0,p.y);ctx.lineTo(w,p.y);ctx.stroke()}
 const anchor=activeAnchor();if(!printing&&temp&&anchor){const b=screen(temp.b);ctx.fillStyle='#62b8e8';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText(distance(anchor,temp.b).toFixed(2)+' '+units+' < '+normalize(angle(anchor,temp.b)).toFixed(1)+'°',b.x+12,b.y-12)}
 updateDynamic();
}
function resize(){const d=window.devicePixelRatio||1,r=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);render()}
function setTool(t){tool=t;start=null;temp=null;poly=[];arcPoints=[];moveBase=null;modifyTarget=-1;modifyTargets=[];document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));updatePrompt();render()}
function selectAt(q){
 let found=-1,best=14/zoom;
 for(let i=objects.length-1;i>=0;i--){const s=objects[i];if(hiddenLayers.has(s.layer)||lockedLayers.has(s.layer))continue;let d=1e9;
  if(s.type==='poly'||s.type==='polygon'){const count=s.pts.length-1+(s.type==='polygon'?1:0);for(let j=0;j<count;j++)d=Math.min(d,pointLineDistance(q,s.pts[j],s.pts[(j+1)%s.pts.length]))}
  else if(s.type==='rect'||s.type==='hatch'||s.type==='ellipse'){if(q.x>=Math.min(s.a.x,s.b.x)-best&&q.x<=Math.max(s.a.x,s.b.x)+best&&q.y>=Math.min(s.a.y,s.b.y)-best&&q.y<=Math.max(s.a.y,s.b.y)+best)d=0}
  else if(s.type==='circle')d=Math.abs(distance(q,s.a)-distance(s.a,s.b));
  else if(s.a&&s.b)d=pointLineDistance(q,s.a,s.b);
  if(d<best){best=d;found=i}
 }
 return found
}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function showProperties(){
 const box=$('#properties'),content=$('#propContent'),ids=selectedItems();
 if(ids.length>1){box.classList.add('open');content.textContent=ids.length+' objetos seleccionados. Puedes moverlos, copiarlos o eliminarlos como conjunto.';return}
 if(selected<0){content.textContent='Selecciona una entidad para editar sus propiedades.';return}
 const s=objects[selected];box.classList.add('open');content.innerHTML='';
 const addLabel=(txt,node)=>{const l=document.createElement('label');l.textContent=txt;content.append(l,node)};
 const color=document.createElement('input');color.type='color';color.value=/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:(colors[s.layer]||colors.General);addLabel('Color de línea',color);
 const weight=document.createElement('select');['0.13','0.18','0.25','0.35','0.50','0.70','1.00'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v+' mm';weight.append(o)});weight.value=String(s.lineweight||.25);addLabel('Grosor de línea',weight);
 const type=document.createElement('select');[['CONTINUOUS','Continua'],['DASHED','Discontinua']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;type.append(o)});type.value=s.linetype||'CONTINUOUS';addLabel('Tipo de línea',type);
 const coordInputs=[];
 if(s.a&&s.b){[['X inicial',s.a.x],['Y inicial',s.a.y],['X final',s.b.x],['Y final',s.b.y]].forEach(([k,v])=>{const inp=document.createElement('input');inp.type='number';inp.step='0.001';inp.value=Number(v).toFixed(3);addLabel(k,inp);coordInputs.push([k,inp])})}
 const apply=document.createElement('button');apply.textContent='Aplicar propiedades';apply.onclick=()=>{checkpoint();s.color=color.value;s.lineweight=Number(weight.value);s.linetype=type.value;coordInputs.forEach(([k,inp])=>{const v=Number(inp.value);if(!Number.isFinite(v))return;if(k==='X inicial')s.a.x=v;if(k==='Y inicial')s.a.y=v;if(k==='X final')s.b.x=v;if(k==='Y final')s.b.y=v});save();render();status.textContent='Propiedades actualizadas'};content.append(apply);
}
function pointFromInputs(){const anchor=activeAnchor();const ls=$('#dynLen').value.trim(),as=$('#dynAngle').value.trim();if(!anchor||!ls||!as)return null;const len=Number(ls),ang=Number(as);if(!Number.isFinite(len)||len<0||!Number.isFinite(ang))return null;const rad=ang*Math.PI/180;return round({x:anchor.x+len*Math.cos(rad),y:anchor.y+len*Math.sin(rad)})}
function currentStyle(layer){return {layer,color:$('#drawColor')?.value||colors[layer]||colors.General,lineweight:Number($('#lineweight')?.value||.25),linetype:$('#linetype')?.value||'CONTINUOUS'}}
function commitEntity(endPoint){
 if(!start)return;
 const layer=$('#layer').value;if(lockedLayers.has(layer)){status.textContent='La capa '+layer+' está bloqueada';return}
 const style=currentStyle(layer);
 checkpoint();
 if(tool==='line')objects.push({type:'line',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='dim')objects.push({type:'dim',a:clone(start),b:clone(endPoint),...style,layer:'Cotas'});
 else if(tool==='rect'||tool==='hatch'||tool==='ellipse')objects.push({type:tool,a:clone(start),b:clone(endPoint),...style});
 else if(tool==='circle')objects.push({type:'circle',a:clone(start),b:clone(endPoint),...style});
 else if(tool==='polygon'){const n=Math.max(3,Math.min(64,polySides));const r=distance(start,endPoint);const pts=[];for(let i=0;i<n;i++){const a=2*Math.PI*i/n;pts.push({x:start.x+r*Math.cos(a),y:start.y+r*Math.sin(a)})}objects.push({type:'polygon',pts,...style})}
 save();selected=objects.length-1;start=null;temp=null;render();updatePrompt();
}
function finishPoly(){if(poly.length>1&&!lockedLayers.has($('#layer').value)){checkpoint();objects.push({type:'poly',pts:clone(poly),...currentStyle($('#layer').value)});save()}else if(poly.length>1){status.textContent='La capa actual está bloqueada'}poly=[];start=null;temp=null;render();updatePrompt();status.textContent='Polilínea terminada'}
function doOffset(q){
 if(selected<0){
  selected=selectAt(q);
  if(selected<0){status.textContent='Selecciona una entidad para OFFSET';return}
  if(!offsetDistancePreset){const raw=prompt('Distancia de desfase','1');if(raw===null){selected=-1;return}const d=Number(raw);if(!Number.isFinite(d)||d<=0){selected=-1;status.textContent='Introduce una distancia positiva';return}offsetDistance=d}
  offsetDistancePreset=false;status.textContent='Indica el lado del desfase';return;
 }
 const s=objects[selected],d=offsetDistance,style={layer:s.layer,color:s.color,lineweight:s.lineweight,linetype:s.linetype},before=objects.length;
 checkpoint();
 if(s.type==='line'){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;
  const side=((q.x-s.a.x)*(-dy/L)+(q.y-s.a.y)*(dx/L))>=0?1:-1,ox=-dy/L*d*side,oy=dx/L*d*side;
  objects.push({type:'line',a:{x:s.a.x+ox,y:s.a.y+oy},b:{x:s.b.x+ox,y:s.b.y+oy},...style});
 }else if(s.type==='circle'){
  const r=distance(s.a,s.b),newR=r+(distance(q,s.a)>r?d:-d);
  if(newR<=0){status.textContent='El desfase dejaría un radio no válido';return}objects.push({type:'circle',a:clone(s.a),b:{x:s.a.x+newR,y:s.a.y},...style});
 }else if(s.type==='rect'){
  const minX=Math.min(s.a.x,s.b.x),maxX=Math.max(s.a.x,s.b.x),minY=Math.min(s.a.y,s.b.y),maxY=Math.max(s.a.y,s.b.y),cx=(minX+maxX)/2,cy=(minY+maxY)/2,expand=distance(q,{x:cx,y:cy})>Math.hypot(maxX-minX,maxY-minY)/2?d:-d;
  if(maxX-minX<=2*Math.abs(expand)||maxY-minY<=2*Math.abs(expand)){status.textContent='El desfase dejaría un rectángulo no válido';return}objects.push({type:'rect',a:{x:minX-expand,y:minY-expand},b:{x:maxX+expand,y:maxY+expand},...style});
 }else{status.textContent='OFFSET disponible para líneas, círculos y rectángulos';return}
 if(objects.length===before){status.textContent='No se pudo crear el OFFSET';return}save();selected=objects.length-1;render();status.textContent='OFFSET creado';
}
function handleTap(p){
 let q=snapPoint(world(p));q=constrain(q);
 if(!['select','pan','move','copy','offset','trim','extend','explode'].includes(tool)&&lockedLayers.has($('#layer').value)){status.textContent='La capa '+$('#layer').value+' está bloqueada';return}
 if(tool==='arc'){
  arcPoints.push(q);
  if(arcPoints.length===3){checkpoint();objects.push({type:'arc',pts:clone(arcPoints),...currentStyle($('#layer').value)});save();selected=objects.length-1;arcPoints=[];status.textContent='Arco creado';}
  else status.textContent='Arco: marca el '+(arcPoints.length===1?'segundo':'tercer')+' punto';
  render();return;
 }
 if(tool==='leader'){
  if(!start){start=q;temp={type:'line',a:clone(q),b:clone(q),...currentStyle($('#layer').value)};status.textContent='Marca el extremo de la directriz';render();return}
  const label=prompt('Texto de la directriz','');
  checkpoint();objects.push({type:'leader',a:clone(start),b:clone(q),text:label||'',...currentStyle($('#layer').value)});save();selected=objects.length-1;start=null;temp=null;render();status.textContent='Directriz creada';return;
 }
 if(tool==='select'){selected=selectAt(q);showProperties();render();return}
 if(tool==='pan'){return}
 if(tool==='offset'){doOffset(q);return}
 if(tool==='poly'){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Polilínea: marca otro vértice o pulsa Enter';return}
 if(tool==='explode'){explodeAt(q);return}
 if(tool==='trim'||tool==='extend'){
  if(modifyTarget<0){modifyTarget=selectAt(q);selected=modifyTarget;if(modifyTarget<0){status.textContent='Selecciona la línea que deseas modificar';return}status.textContent='Marca el extremo que deseas '+(tool==='trim'?'recortar':'alargar');return}
  const idx=modifyTarget;trimOrExtend(idx,q,tool);return;
 }
 if(['move','copy','rotate','mirror','scale'].includes(tool)){
  if(modifyTargets.length===0){
   modifyTargets=selectedItems();
   if(!modifyTargets.length){const hit=selectAt(q);if(hit>=0){applySelection([hit]);modifyTargets=[hit]}}
   if(!modifyTargets.length){status.textContent='Selecciona uno o varios objetos';return}
   moveBase=null;status.textContent=modifyTargets.length+' objeto(s) seleccionado(s). Indica punto base';return
  }
  if(!moveBase){moveBase=q;status.textContent=tool==='mirror'?'Indica el segundo punto del eje':tool==='rotate'?'Indica el ángulo de giro':tool==='scale'?'Indica el factor de escala con la distancia':'Indica punto destino';return}
  const dx=q.x-moveBase.x,dy=q.y-moveBase.y,targets=modifyTargets.filter(i=>i>=0&&i<objects.length);
  if(tool==='mirror'&&Math.hypot(dx,dy)<1e-9){status.textContent='Eje de simetría demasiado corto';return}
  if(tool==='scale'&&Math.hypot(dx,dy)<1e-6){status.textContent='Factor de escala no válido';return}
  checkpoint();const created=[];
  for(const idx of targets){const src=objects[idx];
   if(tool==='move'||tool==='copy'){
    if(tool==='copy'){const cp=clone(src);translate(cp,dx,dy);objects.push(cp);created.push(objects.length-1)}
    else translate(src,dx,dy);
   }else if(tool==='rotate'){
    const ang=Math.atan2(dy,dx),co=Math.cos(ang),si=Math.sin(ang),rotate=p=>{const x=p.x-moveBase.x,y=p.y-moveBase.y;return{x:moveBase.x+x*co-y*si,y:moveBase.y+x*si+y*co}};
    if(src.a)src.a=rotate(src.a);if(src.b)src.b=rotate(src.b);if(src.pts)src.pts=src.pts.map(rotate);
   }else if(tool==='mirror'){
    const len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,mirror=p=>{const x=p.x-moveBase.x,y=p.y-moveBase.y,t=x*ux+y*uy,px=moveBase.x+t*ux,py=moveBase.y+t*uy;return{x:2*px-p.x,y:2*py-p.y}};
    if(src.a)src.a=mirror(src.a);if(src.b)src.b=mirror(src.b);if(src.pts)src.pts=src.pts.map(mirror);
   }else if(tool==='scale'){
    const factor=Math.hypot(dx,dy),scale=p=>({x:moveBase.x+(p.x-moveBase.x)*factor,y:moveBase.y+(p.y-moveBase.y)*factor});
    if(src.a)src.a=scale(src.a);if(src.b)src.b=scale(src.b);if(src.pts)src.pts=src.pts.map(scale);
   }
  }
  if(tool==='copy')applySelection(created);else applySelection(targets);
  save();modifyTarget=-1;modifyTargets=[];moveBase=null;render();status.textContent=tool.toUpperCase()+' aplicado a '+targets.length+' objeto(s)';return;
 }
 if(!start){start=q;temp={type:tool,a:clone(q),b:clone(q),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';updatePrompt();render();return}
 let end=pointFromInputs();if(!end)end=q;else if(document.activeElement!==$('#dynLen')&&document.activeElement!==$('#dynAngle'))end=q;
 end=constrain(end);
 if(tool==='line'||tool==='dim'||tool==='rect'||tool==='hatch'||tool==='circle'||tool==='ellipse'||tool==='polygon'){commitEntity(end)}
}
function translate(s,dx,dy){if(s.a){s.a.x+=dx;s.a.y+=dy}if(s.b){s.b.x+=dx;s.b.y+=dy}if(s.pts)s.pts.forEach(p=>{p.x+=dx;p.y+=dy})}
function entitySegments(s){
 const pts=[];
 if(s.type==='line'||s.type==='dim'||s.type==='leader'){if(s.a&&s.b)pts.push([s.a,s.b]);return pts}
 if(s.type==='rect'||s.type==='hatch'){const a=s.a,b=s.b;return [[a,{x:b.x,y:a.y}],[{x:b.x,y:a.y},b],[b,{x:a.x,y:b.y}],[{x:a.x,y:b.y},a]]}
 if(s.type==='circle'){const r=distance(s.a,s.b);let prev=null;for(let i=0;i<=72;i++){const t=i*Math.PI*2/72,p={x:s.a.x+r*Math.cos(t),y:s.a.y+r*Math.sin(t)};if(prev)pts.push([prev,p]);prev=p}return pts}
 if(s.type==='ellipse'){let prev=null;for(let i=0;i<=64;i++){const t=i*Math.PI*2/64,p={x:s.a.x+(s.b.x-s.a.x)*Math.cos(t),y:s.a.y+(s.b.y-s.a.y)*Math.sin(t)};if(prev)pts.push([prev,p]);prev=p}return pts}
 if(s.type==='arc'&&s.pts?.length>=3){let prev=null;for(let i=0;i<=48;i++){const t=i/48,u=1-t,a=s.pts[0],b=s.pts[1],d=s.pts[2],p={x:u*u*a.x+2*u*t*b.x+t*t*d.x,y:u*u*a.y+2*u*t*b.y+t*t*d.y};if(prev)pts.push([prev,p]);prev=p}return pts}
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
 if(s.type==='circle')return distance(s.a,p)<=distance(s.a,s.b);
 if(s.type==='ellipse'){const rx=Math.abs(s.b.x-s.a.x)||1e-12,ry=Math.abs(s.b.y-s.a.y)||1e-12;return ((p.x-s.a.x)/rx)**2+((p.y-s.a.y)/ry)**2<=1}
 if(s.type==='rect'||s.type==='hatch')return p.x>=Math.min(s.a.x,s.b.x)&&p.x<=Math.max(s.a.x,s.b.x)&&p.y>=Math.min(s.a.y,s.b.y)&&p.y<=Math.max(s.a.y,s.b.y);
 if(s.type==='polygon'&&s.pts?.length>2)return pointInPolygon(p,s.pts);
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
 checkpoint();s[endpoint]={x:hits[0].x,y:hits[0].y};save();selected=index;modifyTarget=-1;render();status.textContent=mode.toUpperCase()+' aplicado';
}
function explodeAt(q){
 const i=selectAt(q);if(i<0){status.textContent='Selecciona una polilínea o rectángulo';return}
 const s=objects[i],segments=entitySegments(s);if(!segments.length||s.type==='line'){status.textContent='Esta entidad no requiere EXPLODE';return}
 checkpoint();const style={layer:s.layer,color:s.color,lineweight:s.lineweight,linetype:s.linetype};
 const parts=segments.map(([a,b])=>({type:'line',a:clone(a),b:clone(b),...style}));
 objects.splice(i,1,...parts);selected=parts.length?i+parts.length-1:-1;save();render();status.textContent='Entidad descompuesta en '+parts.length+' segmentos';
}
let pointers=new Map(),pinch=null,selectionStart=null,selectionBox=null,selectionAdditive=false;
canvas.addEventListener('pointerdown',e=>{
 if(e.button===2){e.preventDefault();return}
 canvas.setPointerCapture(e.pointerId);const p=pointer(e);pointers.set(e.pointerId,p);
 if(pointers.size===2){const v=[...pointers.values()];pinch={dist:distance(v[0],v[1]),zoom};start=null;temp=null;selectionStart=null;selectionBox=null;return}
 if(tool==='pan'){drag={point:p,offset:clone(offset)};return}
 if(tool==='select'){selectionStart=p;selectionBox=null;selectionAdditive=!!(e.shiftKey||e.ctrlKey||e.metaKey);return}
 handleTap(p);
});
canvas.addEventListener('pointermove',e=>{
 const p=pointer(e);cursor=p;$('#crossinfo').textContent='X '+world(p).x.toFixed(3)+' '+units+' · Y '+world(p).y.toFixed(3)+' '+units+' · Z 0.000';
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
 if(pointers.size===2&&pinch){const v=[...pointers.values()];zoom=Math.max(2,Math.min(500,pinch.zoom*distance(v[0],v[1])/(pinch.dist||1)));render();return}
 if(drag&&tool==='pan'){offset.x=drag.offset.x+p.x-drag.point.x;offset.y=drag.offset.y+p.y-drag.point.y;render();return}
 if(selectionStart){if(distance(selectionStart,p)>4)selectionBox={a:selectionStart,b:p};render();return}
 if(tool==='poly'&&poly.length){const q=constrain(snapPoint(world(p)));temp={type:'line',a:clone(poly[poly.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(tool==='arc'&&arcPoints.length){const q=snapPoint(world(p));temp={type:'line',a:clone(arcPoints[arcPoints.length-1]),b:q,...currentStyle($('#layer').value)};render()}
 else if(start){let q=constrain(snapPoint(world(p)));temp={type:tool,a:clone(start),b:q,...currentStyle($('#layer').value)};render()}
 else render();
});
function pointerEnd(e){
 pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
 if(e.type==='pointercancel'){selectionStart=null;selectionBox=null;render();return}
 if(selectionStart){
  if(selectionBox){
   const a=selectionBox.a,b=selectionBox.b,wa=world(a),wb=world(b),rect={left:Math.min(wa.x,wb.x),right:Math.max(wa.x,wb.x),bottom:Math.min(wa.y,wb.y),top:Math.max(wa.y,wb.y)};
   const windowMode=b.x>=a.x,hits=selectByWindow(rect,windowMode);applySelection(hits,selectionAdditive);status.textContent=hits.length+' objeto(s) '+(windowMode?'dentro de ventana':'cruzados por ventana');
  }else{
   const hit=selectAt(world(selectionStart));if(selectionAdditive){const ids=new Set(selectedItems());if(hit>=0){if(ids.has(hit))ids.delete(hit);else ids.add(hit)}applySelection([...ids])}else applySelection(hit>=0?[hit]:[]);
   status.textContent=hit>=0?'Objeto seleccionado':(selectionAdditive?'Selección conservada':'Selección vacía');
  }
  selectionStart=null;selectionBox=null;showProperties();
 }
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
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){if(e.key==='Enter'&&document.activeElement.id==='dynLen'){e.preventDefault();$('#dynAngle').focus()}else if(e.key==='Enter'&&document.activeElement.id==='dynAngle'){e.preventDefault();const q=pointFromInputs();if(q){if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)}}return}
 if(e.key==='Escape'){start=null;temp=null;poly=[];moveBase=null;modifyTarget=-1;modifyTargets=[];selectionStart=null;selectionBox=null;clearSelection();showProperties();render();return}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();showProperties();return}
 if(e.key==='F7'){e.preventDefault();toggle('gridToggle');return}if(e.key==='F8'){e.preventDefault();toggle('orthoToggle');return}if(e.key==='F9'){e.preventDefault();toggle('snapToggle');return}if(e.key==='F10'){e.preventDefault();toggle('polarToggle');return}if(e.key==='F3'){e.preventDefault();toggle('osnapToggle');return}
 if(e.key==='Enter'){if(poly.length){finishPoly();return}if(start){const q=pointFromInputs();if(q)commitEntity(q);return}}
 if(e.key===' '&&poly.length){finishPoly();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){$('#undo').click();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){$('#redo').click();return}
});
const aliases={L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',D:'dim',DIM:'dim',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',O:'offset',OFFSET:'offset',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EXT:'extend',EXTEND:'extend',EX:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
function parseCoordinate(raw,base){
 const s=raw.trim().replace(/\s+/g,'');let m;
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?)$/))){const x=Number(m[1].replace(',','.')),y=Number(m[2].replace(',','.'));return s.startsWith('@')?{x:base.x+x,y:base.y+y}:{x,y}}
 if((m=s.match(/^@?(-?\d+(?:[.,]\d+)?)<(-?\d+(?:[.,]\d+)?)$/))){const len=Number(m[1].replace(',','.')),ang=Number(m[2].replace(',','.'))*Math.PI/180;return {x:base.x+len*Math.cos(ang),y:base.y+len*Math.sin(ang)}}
 return null;
}
function runCommand(raw){
 const textValue=raw.trim(),upper=textValue.toUpperCase(),parts=upper.split(/\s+/),c=parts[0];if(!c)return;
 if(c==='O'||c==='OFFSET'){const d=Number(parts[1]);if(parts[1]&&Number.isFinite(d)&&d>0){offsetDistance=d;offsetDistancePreset=true}setTool('offset');return}
 const coordinateBase=tool==='arc'&&arcPoints.length?arcPoints[arcPoints.length-1]:(activeAnchor()||{x:0,y:0});
 const coordinate=parseCoordinate(textValue,coordinateBase);
 if(coordinate&&(/^[+-]?(?:\d|\.)/.test(textValue)||textValue.startsWith('@'))){
  const point=round(coordinate);
  if(tool==='poly'){poly.push(point);temp=null;render();status.textContent='Polilínea: vértice añadido · Enter para terminar';return}
  if(tool==='arc'){arcPoints.push(point);if(arcPoints.length===3){checkpoint();objects.push({type:'arc',pts:clone(arcPoints),...currentStyle($('#layer').value)});save();selected=objects.length-1;arcPoints=[];status.textContent='Arco creado'}else status.textContent='Arco: introduce el siguiente punto';render();return}
  if(tool==='leader'){if(!start){start=point;temp={type:'line',a:clone(point),b:clone(point),...currentStyle($('#layer').value)};status.textContent='Introduce el extremo de la directriz';render()}else{const label=prompt('Texto de la directriz','');checkpoint();objects.push({type:'leader',a:clone(start),b:point,text:label||'',...currentStyle($('#layer').value)});save();selected=objects.length-1;start=null;temp=null;render();status.textContent='Directriz creada'}return}
  if(!start){start=point;temp={type:tool,a:clone(start),b:clone(start),layer:$('#layer').value};$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Punto inicial fijado · introduce el siguiente punto'}
  else commitEntity(point);
  return;
 }
 if(c==='F7'||c==='GRID'){toggle('gridToggle');return}if(c==='F8'||c==='ORTHO'){toggle('orthoToggle');return}if(c==='F9'||c==='SNAP'){toggle('snapToggle');return}if(c==='F10'||c==='POLAR'){toggle('polarToggle');return}if(c==='F3'||c==='OSNAP'){toggle('osnapToggle');return}
 if(c==='U'||c==='UNDO'){$('#undo').click();return}if(c==='REDO'){$('#redo').click();return}
 if(c==='HP'||c==='DSETTINGS'||c==='SETTINGS'){alert('CONFIGURACIÓN DE DIBUJO\nF7 Rejilla: '+(gridOn?'ACTIVA':'INACTIVA')+'\nF8 Orto: '+(orthoOn?'ACTIVO':'INACTIVO')+'\nF9 Snap: '+(snapOn?'ACTIVO':'INACTIVO')+'\nF10 Polar: '+(polarOn?'ACTIVO':'INACTIVO')+'\nF3 Referencias: '+(osnapOn?'ACTIVAS':'INACTIVAS'));return}
 if(c==='PR'||c==='PROPERTIES'||c==='CTRL+1'){$('#properties').classList.toggle('open');showProperties();return}
 if(c==='E'||c==='ERASE'||c==='DELETE'){if(selected>=0&&!lockedLayers.has(objects[selected]?.layer)){checkpoint();objects.splice(selected,1);selected=-1;save();render()}return}
 if(c==='Z'||c==='ZOOM'){zoom=Math.min(500,zoom*1.25);render();return}
 if(c==='RE'||c==='REGEN'){render();return}
 if(c==='F'||c==='FILLET'||c==='CHA'||c==='CHAMFER'){status.textContent=c+' · empalme/chaflán aún no implementado';return}
 const aliases={L:'line',LINE:'line',PL:'poly',PLINE:'poly',POLYLINE:'poly',C:'circle',CIRCLE:'circle',A:'arc',ARC:'arc',REC:'rect',RECT:'rect',RECTANG:'rect',RECTANGLE:'rect',H:'hatch',HATCH:'hatch',D:'dim',DIM:'dim',EL:'ellipse',ELLIPSE:'ellipse',POL:'polygon',POLYGON:'polygon',M:'move',MOVE:'move',CO:'copy',COPY:'copy',P:'pan',PAN:'pan',V:'select',SELECT:'select',RO:'rotate',ROTATE:'rotate',MI:'mirror',MIRROR:'mirror',SC:'scale',SCALE:'scale',TR:'trim',TRIM:'trim',EXT:'extend',EXTEND:'extend',EX:'explode',EXPLODE:'explode',LEADER:'leader',QLEADER:'leader'};
 if(aliases[c]){setTool(aliases[c]);return}
 status.textContent='Comando no reconocido: '+c;
}
$('#cmd').addEventListener('keydown',e=>{if(e.key==='Enter'){runCommand($('#cmd').value);$('#cmd').value=''}});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab)});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('#finish-poly').onclick=finishPoly;
$('#acceptPoint').onclick=()=>{const q=pointFromInputs();if(!q)return;if(tool==='poly'&&poly.length){poly.push(q);temp=null;$('#dynLen').value='';$('#dynAngle').value='';render();status.textContent='Vértice añadido'}else commitEntity(q)};
$('#undo').onclick=()=>{if(undo.length){redo.push(clone(objects));objects=undo.pop();save();render()}};
$('#redo').onclick=()=>{if(redo.length){undo.push(clone(objects));objects=redo.pop();save();render()}};
$('#save').onclick=()=>{save();status.textContent='Dibujo guardado en este dispositivo'};
$('#open').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const ext=f.name.split('.').pop().toLowerCase();let arr;if(ext==='json'){const v=JSON.parse(await f.text());arr=Array.isArray(v)?v:v.shapes;if(!Array.isArray(arr))throw Error('El JSON no contiene entidades válidas')}else if(ext==='dxf'){arr=parseDxfEntities(await f.text())}else if(ext==='dwg'){status.textContent='Convirtiendo DWG en el dispositivo…';const lib=await import('https://cdn.jsdelivr.net/npm/@cadview/dwg@0.2.0/+esm');const dxf=await lib.convertDwgToDxf(await f.arrayBuffer());arr=parseDxfEntities(dxf)}else throw Error('Formato no compatible. Usa JSON, DXF o DWG.');if(!arr.length)throw Error('No se encontraron entidades compatibles.');checkpoint();objects=arr;selected=-1;save();render();status.textContent=f.name+' · '+arr.length+' entidades cargadas'}catch(err){console.error(err);alert('No se pudo abrir el archivo: '+(err.message||err))}finally{e.target.value=''}};
function parseDxfEntities(source){const lines=source.replace(/\r/g,'').split('\n'),pairs=[];for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))pairs.push([code,lines[i+1].trim()])}const records=[];let current=null;for(const pair of pairs){if(pair[0]===0){if(current)records.push(current);current={type:pair[1].toUpperCase(),pairs:[]}}else if(current)current.pairs.push(pair)}if(current)records.push(current);const get=(r,c,d=0)=>{const p=r.pairs.find(x=>x[0]===c);return p?Number(p[1]):d},all=(r,c)=>r.pairs.filter(x=>x[0]===c).map(x=>Number(x[1])),str=(r,c,d='')=>r.pairs.find(x=>x[0]===c)?.[1]??d,style=r=>{const layer=str(r,8,'General'),aci=get(r,62,7),aciColors={1:'#ff3333',2:'#ffff33',3:'#33cc33',4:'#33ffff',5:'#3366ff',6:'#ff33ff',7:'#dce8f5',8:'#808080',9:'#b0b0b0'};return {layer,color:aciColors[aci]||colors[layer]||colors.General,lineweight:get(r,370,25)/100,linetype:str(r,6,'CONTINUOUS')==='DASHED'?'DASHED':'CONTINUOUS'}};const out=[];for(const r of records){const st=style(r),type=r.type;if(type==='LINE'){out.push({type:'line',a:{x:get(r,10),y:get(r,20)},b:{x:get(r,11),y:get(r,21)},...st})}else if(type==='CIRCLE'){const a={x:get(r,10),y:get(r,20)},rad=get(r,40);out.push({type:'circle',a,b:{x:a.x+rad,y:a.y},...st})}else if(type==='LWPOLYLINE'){const xs=all(r,10),ys=all(r,20),pts=xs.map((x,i)=>({x,y:ys[i]??0}));if(pts.length>1)out.push({type:get(r,70,0)&1?'polygon':'poly',pts,...st})}else if(type==='ARC'){const a={x:get(r,10),y:get(r,20)},rad=get(r,40),a1=get(r,50)*Math.PI/180,a2=get(r,51)*Math.PI/180,span=(a2-a1+Math.PI*2)%(Math.PI*2),n=Math.max(12,Math.ceil(span/(Math.PI/24))),pts=Array.from({length:n+1},(_,i)=>{const t=a1+span*i/n;return{x:a.x+rad*Math.cos(t),y:a.y+rad*Math.sin(t)}});out.push({type:'poly',pts,...st})}else if(type==='TEXT'||type==='MTEXT'){out.push({type:'text',a:{x:get(r,10),y:get(r,20)},text:str(r,1,''),textHeight:get(r,40,14),...st})}}return out}
async function download(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type:type||'application/octet-stream'});if(window.OtroCadAndroid&&typeof window.OtroCadAndroid.saveFile==='function'){try{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));window.OtroCadAndroid.saveFile(name,type||'application/octet-stream',btoa(binary));return}catch(err){console.error(err)}}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
$('#project').onclick=()=>download('otrocad.json',JSON.stringify({version:2,shapes:objects},null,2),'application/json');
$('#export').onclick=()=>{let s='<svg xmlns="http://www.w3.org/2000/svg"><g fill="none">';const attrs=o=>' stroke="'+(o.color||colors[o.layer]||colors.General)+'" stroke-width="'+(o.lineweight||.25)+'"'+(o.linetype==='DASHED'?' stroke-dasharray="6 4"':'');objects.forEach(o=>{const a=o.a,b=o.b,at=attrs(o);if(o.type==='line'||o.type==='dim')s+='<line'+at+' x1="'+a.x+'" y1="'+(-a.y)+'" x2="'+b.x+'" y2="'+(-b.y)+'"/>';else if(o.type==='circle')s+='<circle'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" r="'+distance(a,b)+'"/>';else if(o.type==='rect'||o.type==='hatch')s+='<rect'+at+' x="'+Math.min(a.x,b.x)+'" y="'+(-Math.max(a.y,b.y))+'" width="'+Math.abs(b.x-a.x)+'" height="'+Math.abs(b.y-a.y)+'"/>';else if(o.type==='ellipse')s+='<ellipse'+at+' cx="'+a.x+'" cy="'+(-a.y)+'" rx="'+Math.abs(b.x-a.x)+'" ry="'+Math.abs(b.y-a.y)+'"/>';else if(o.pts)s+='<polyline'+at+' points="'+o.pts.map(p=>p.x+','+(-p.y)).join(' ')+'"/>';else if(o.type==='text')s+='<text'+at+' x="'+a.x+'" y="'+(-a.y)+'">'+String(o.text||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</text>'});download('otrocad.svg',s+'</g></svg>','image/svg+xml')};
$('#dxf').onclick=()=>{const rows=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','0','ENDSEC','0','SECTION','2','ENTITIES'];const add=(...v)=>rows.push(...v.map(String));objects.forEach(o=>{const a=o.a,b=o.b,layer=o.layer||'General',common=[8,layer,370,Math.round(Number(o.lineweight||.25)*100),6,o.linetype==='DASHED'?'DASHED':'CONTINUOUS',420,parseInt((o.color||colors[layer]||colors.General).slice(1),16)];if(o.type==='line'||o.type==='dim')add(0,'LINE',...common,10,a.x,20,a.y,30,0,11,b.x,21,b.y,31,0);else if(o.type==='circle')add(0,'CIRCLE',...common,10,a.x,20,a.y,30,0,40,distance(a,b));else if(o.type==='rect'||o.type==='hatch'){const ps=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];add(0,'LWPOLYLINE',...common,90,4,70,1);ps.forEach(p=>add(10,p.x,20,p.y))}else if(o.pts){add(0,'LWPOLYLINE',...common,90,o.pts.length,70,o.type==='polygon'?1:0);o.pts.forEach(p=>add(10,p.x,20,p.y))}});add(0,'ENDSEC',0,'EOF');download('otrocad.dxf',rows.join('\r\n')+'\r\n','application/dxf')};
$('#pdf').onclick=()=>window.print();
$('#propertiesBtn').onclick=()=>{$('#properties').classList.toggle('open');showProperties()};
$('#zoomIn').onclick=()=>{zoom*=1.2;render()};$('#zoomOut').onclick=()=>{zoom/=1.2;render()};
$('#fit').onclick=()=>{if(!objects.length){offset={x:0,y:0};zoom=35;render();return}const ps=[];objects.forEach(o=>{if(o.a)ps.push(o.a);if(o.b)ps.push(o.b);if(o.pts)ps.push(...o.pts)});const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);zoom=Math.min((canvas.clientWidth-80)/(maxx-minx||1),(canvas.clientHeight-80)/(maxy-miny||1));offset.x=-(minx+maxx)/2*zoom;offset.y=(miny+maxy)/2*zoom;render()};
$('#settingsBtn').onclick=showDraftSettings;$('#snapBtn').onclick=()=>toggle('osnapToggle');$('#unitsBtn').onclick=showDraftSettings;
$('#layer').onchange=()=>{$('#drawColor').value=colors[$('#layer').value]||colors.General};
$('#newLayer').onclick=()=>{const name=prompt('Nombre de la nueva capa');if(name){const op=document.createElement('option');op.textContent=name;$('#layer').append(op);$('#layer').value=name;colors[name]='#62b8e8'}};
$('#layerColor').onclick=()=>{const c=prompt('Color HEX (ej. #62b8e8)',colors[$('#layer').value]||'#62b8e8');if(c&&/^#[0-9a-f]{6}$/i.test(c)){colors[$('#layer').value]=c;$('#drawColor').value=c}};
$('#layerVisibility').onclick=()=>{const l=$('#layer').value;if(hiddenLayers.has(l)){hiddenLayers.delete(l);$('#layerVisibility').textContent='Ocultar capa';status.textContent='Capa '+l+' visible'}else{hiddenLayers.add(l);$('#layerVisibility').textContent='Mostrar capa';status.textContent='Capa '+l+' oculta';if(selected>=0&&objects[selected]?.layer===l)selected=-1}render()};
$('#layerLock').onclick=()=>{const l=$('#layer').value;if(lockedLayers.has(l)){lockedLayers.delete(l);$('#layerLock').textContent='Bloquear capa';status.textContent='Capa '+l+' desbloqueada'}else{lockedLayers.add(l);$('#layerLock').textContent='Desbloquear capa';status.textContent='Capa '+l+' bloqueada';if(selected>=0&&objects[selected]?.layer===l)selected=-1}render()};
$('#erase').onclick=()=>{if(selected>=0){checkpoint();objects.splice(selected,1);selected=-1;save();render()}else if(confirm('¿Borrar todo el dibujo?')){checkpoint();objects=[];save();render()}};
try{const saved=JSON.parse(localStorage.getItem('otrocad-drawing')||'[]');if(Array.isArray(saved))objects=saved}catch(e){}
window.addEventListener('beforeprint',()=>{printing=true;render()});window.addEventListener('afterprint',()=>{printing=false;render()});
new ResizeObserver(resize).observe(stage);setTool('line');resize();
})();