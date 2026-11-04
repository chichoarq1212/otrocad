/* OtroCAD Civil · Señalización vial. Native CAD/DXF geometry, nonmodal editor.
   Geometry is produced only after Apply: changing a preview never modifies the drawing. */
(()=>{
'use strict';
const math=window.OtroCadCivilRoadMath,api=window.OtroCadCivilAPI;
const groups=document.getElementById('groups'),tabs=document.getElementById('tabs');
if(!math||!api||!groups||!tabs)return;
const types=[
 {id:'solid',label:'Continua',category:'Marcas',help:'Marca longitudinal continua'},
 {id:'dashed',label:'Discontinua',category:'Marcas',help:'Trazo y separación configurables'},
 {id:'double',label:'Doble amarilla',category:'Marcas',help:'Dos líneas paralelas separadas'},
 {id:'edge',label:'Borde vial',category:'Marcas',help:'Marca de borde de calzada'},
 {id:'crosswalk',label:'Paso cebra',category:'Calzada',help:'Paso peatonal transversal al eje'},
 {id:'arrow',label:'Flecha',category:'Calzada',help:'Flecha orientada por el eje'},
 {id:'island',label:'Zona cebrada',category:'Calzada',help:'Líneas diagonales de isla pintada'},
 {id:'sign',label:'Señal vertical',category:'Señales',help:'Símbolo de señal vertical, referencial'},
 {id:'roadtext',label:'Texto vial',category:'Señales',help:'PARE, BUS, ESCUELA u otro rótulo'}
];
const iconPath={
 solid:'<path d="M3 18 21 6"/>',
 dashed:'<path d="M3 18 21 6" stroke-dasharray="4 3"/>',
 double:'<path d="M4 19 18 5M8 21 22 7"/>',
 edge:'<path d="M3 5v14M10 5v14" stroke-dasharray="3 2"/>',
 crosswalk:'<path d="M3 6h18M3 10h18M3 14h18M3 18h18"/>',
 arrow:'<path d="M12 21V4m-6 7 6-7 6 7"/>',
 island:'<path d="M3 17 8 7M8 19 13 9M13 21 18 11M18 21 21 16"/>',
 sign:'<path d="M12 20V10M12 3 4 9l8 8 8-8z"/>',
 roadtext:'<path d="M4 19h16M6 5h12M12 5v14"/>'
};
const shortLabel={solid:'Continua',dashed:'Discontinua',crosswalk:'Paso cebra',
 sign:'Señal vertical',roadtext:'Texto vial',arrow:'Flecha',double:'Doble',edge:'Borde',island:'Zona cebrada'};
const icon=(kind)=>{
 const holder=document.createElement('span');holder.className='ico';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('class','cad-icon');svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');
 svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 svg.innerHTML=iconPath[kind]||iconPath.solid;
 const node=document.createElementNS('http://www.w3.org/2000/svg','circle');
 node.setAttribute('cx','12');node.setAttribute('cy','12');node.setAttribute('r','1.4');
 node.setAttribute('fill','#ffcf23');node.setAttribute('stroke','#185be8');
 svg.append(node);holder.append(svg);return holder;
};
const group=document.createElement('div');
group.className='toolgroup civil-road-ribbon';group.dataset.panel='civil';group.hidden=true;
const title=document.createElement('span');title.className='group-title';title.textContent='SEÑALIZACIÓN';
group.append(title);
function addRibbon(label,kind,description){
 const b=document.createElement('button');b.type='button';b.className='civil-tool';
 b.setAttribute('aria-label',description);b.title=description;
 const caption=document.createElement('span');caption.className='civil-label';caption.textContent=label;
 b.append(icon(kind),caption);
 b.onclick=()=>open(kind);
 group.append(b);
}
addRibbon('Marcas viales','solid','Abrir panel de marcas longitudinales y borde de vía');
addRibbon('Paso / Flechas','crosswalk','Abrir paso peatonal, flechas e islas cebradas');
addRibbon('Señales','sign','Abrir símbolos y textos de señalización vial');
groups.append(group);

// Nonmodal inspector: the user can select an axis in Model and refresh the selection
// without closing this panel. Consistent with CAD Properties and Civil tool palettes.
const panel=document.createElement('aside');
panel.id='civilRoadPanel';panel.className='civil-road-panel';panel.hidden=true;
panel.setAttribute('role','region');panel.setAttribute('aria-label','Señalización vial Civil 3D');
panel.innerHTML=[
 '<header class="road-head"><div><strong>SEÑALIZACIÓN VIAL</strong>',
 '<small>Propiedades y vista previa · Civil 3D</small></div>',
 '<button type="button" id="roadClose" aria-label="Cerrar panel">×</button></header>',
 '<div class="road-scroll">',
 '<p class="road-step">1 · Selecciona en Modelo una línea o polilínea que represente el eje.</p>',
 '<div class="road-axis"><span id="roadAxisText">Sin eje seleccionado</span>',
 '<button type="button" id="roadUseSelection">↻ Usar selección</button></div>',
 '<p class="road-step">2 · Elige el elemento vial.</p>',
 '<div class="road-categories" id="roadCategories"></div>',
 '<div class="road-tool-grid" id="roadTools"></div>',
 '<p class="road-step">3 · Ajusta dimensiones y revisa la vista previa.</p>',
 '<div class="road-fields">',
 '<label>Ancho vial / paso (m)<input id="roadWidth" inputmode="decimal" type="number" min=".2" max="100" step=".1" value="3.5"></label>',
 '<label id="roadDashWrap">Trazo (m)<input id="roadDash" inputmode="decimal" type="number" min=".1" step=".1" value="3"></label>',
 '<label id="roadGapWrap">Separación (m)<input id="roadGap" inputmode="decimal" type="number" min="0" step=".1" value="4"></label>',
 '<label id="roadStripeWrap">Ancho de franja (m)<input id="roadStripe" inputmode="decimal" type="number" min=".2" max=".75" step=".05" value=".4"></label>',
 '<label id="roadSpaceWrap">Separación franjas (m)<input id="roadSpace" inputmode="decimal" type="number" min=".15" max="3" step=".05" value=".4"></label>',
 '<label id="roadLengthWrap">Longitud de zona (m)<input id="roadLength" inputmode="decimal" type="number" min="2" max="50" step=".5" value="4"></label>',
 '<label id="roadLabelWrap">Texto / señal<input id="roadLabel" type="text" maxlength="12" value="PARE"></label>',
 '<label>Color de marca<select id="roadColor"><option value="white">Blanco</option><option value="yellow">Amarillo</option></select></label>',
 '</div>',
 '<div class="road-preview-heading"><span>Vista previa de geometría</span>',
 '<small id="roadPreviewMode">Referencial</small></div>',
 '<svg id="roadPreview" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 152" role="img" aria-label="Vista previa de señalización vial"></svg>',
 '<p class="road-status" id="roadStatus" role="status" aria-live="polite"></p>',
 '<p class="road-warning">Símbolos y dimensiones referenciales: verificar especificaciones y normativa vial vigente antes de construir.</p>',
 '</div>',
 '<footer class="road-actions"><button type="button" id="roadCancel">Cerrar</button>',
 '<button type="button" id="roadApply">Aplicar al plano</button></footer>'
].join('');
document.body.append(panel);
const el=id=>document.getElementById(id);
let category='Marcas',current='solid',source=null,validGeometry=null;
function selectedAxis(){
 const selected=api.getSelectedObjects?.()||[];
 const chosen=selected.find(s=>(s?.type==='line'&&s.a&&s.b)||
  (['poly','pline','lwpolyline'].includes(s?.type)&&Array.isArray(s.pts)&&s.pts.length>=2));
 return chosen?(chosen.type==='line'?[chosen.a,chosen.b]:chosen.pts.map(p=>({x:p.x,y:p.y}))):null;
}
function axisLength(points){
 if(!points)return 0;let length=0;
 for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 return length/(api.getUnits()==='mm'?1000:api.getUnits()==='cm'?100:1);
}
function captureSelection(){
 source=selectedAxis();
 if(!source){
  el('roadAxisText').textContent='No hay eje seleccionado · selecciona LINE o PLINE';
  el('roadAxisText').classList.add('road-no-axis');
 }else{
  el('roadAxisText').textContent='Eje cargado · '+source.length+' vértices · '+axisLength(source).toFixed(2)+' m';
  el('roadAxisText').classList.remove('road-no-axis');
 }
 updatePreview();
 return !!source;
}
function options(){
 return {
  units:api.getUnits(),
  width:Number(el('roadWidth').value),dash:Number(el('roadDash').value),
  gap:Number(el('roadGap').value),stripe:Number(el('roadStripe').value),
  space:Number(el('roadSpace').value),length:Number(el('roadLength').value),
  label:el('roadLabel').value.trim()||'PARE'
 };
}
function previewSVG(entities){
 const svg=el('roadPreview');
 while(svg.firstChild)svg.removeChild(svg.firstChild);
 const ns='http://www.w3.org/2000/svg';
 const create=(name,attrs,parent=svg)=>{
  const node=document.createElementNS(ns,name);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
  parent.append(node);return node;
 };
 create('rect',{x:0,y:0,width:340,height:152,fill:'#19283a',rx:8});
 create('line',{x1:8,y1:15,x2:332,y2:15,stroke:'#42556a','stroke-width':1});
 create('line',{x1:8,y1:138,x2:332,y2:138,stroke:'#42556a','stroke-width':1});
 const all=[];
 for(const item of entities){
  if(item.a)all.push(item.a);if(item.b)all.push(item.b);
  if(item.pts)all.push(...item.pts);
 }
 const xx=all.map(p=>Number(p.x)).filter(Number.isFinite),yy=all.map(p=>Number(p.y)).filter(Number.isFinite);
 const minX=Math.min(...xx,0),maxX=Math.max(...xx,1),minY=Math.min(...yy,0),maxY=Math.max(...yy,1);
 const dx=Math.max(.05,maxX-minX),dy=Math.max(.05,maxY-minY);
 const scale=Math.min(316/dx,110/dy);
 const x=v=>170+(v-(minX+maxX)/2)*scale;
 const y=v=>76-(v-(minY+maxY)/2)*scale;
 const stroke=el('roadColor').value==='yellow'?'#ffd64f':'#f4f7fa';
 for(const obj of entities.slice(0,400)){
  if(obj.type==='line'&&obj.a&&obj.b){
   create('line',{x1:x(obj.a.x),y1:y(obj.a.y),x2:x(obj.b.x),y2:y(obj.b.y),
    stroke,'stroke-width':Math.max(1.6,Math.min(4,scale*.12)),'stroke-linecap':'round'});
  }else if(obj.pts?.length){
   create('polygon',{points:obj.pts.map(p=>x(p.x)+','+y(p.y)).join(' '),fill:stroke,stroke});
  }else if(obj.type==='circle'&&obj.a&&obj.b){
   const radius=Math.hypot(obj.a.x-obj.b.x,obj.a.y-obj.b.y);
   create('circle',{cx:x(obj.a.x),cy:y(obj.a.y),r:Math.max(3,radius*scale),fill:'none',stroke,'stroke-width':2});
  }else if(obj.type==='text'&&obj.a){
   const text=create('text',{x:x(obj.a.x),y:y(obj.a.y),fill:stroke,'font-size':Math.max(10,Math.min(22,scale*.28)),'font-family':'sans-serif','text-anchor':'middle'});
   text.textContent=String(obj.text||'').slice(0,12);
  }
 }
 if(entities.length>400){
  const tip=create('text',{x:11,y:145,fill:'#c5d6ea','font-size':10});tip.textContent='Vista abreviada: '+entities.length+' entidades';
 }
}
function renderCategories(){
 const host=el('roadCategories');host.replaceChildren();
 for(const name of ['Marcas','Calzada','Señales']){
  const b=document.createElement('button');b.type='button';b.textContent=name;
  b.className='road-category'+(name===category?' active':'');b.setAttribute('aria-pressed',String(name===category));
  b.onclick=()=>{category=name;renderCategories();renderTypes()};
  host.append(b);
 }
}
function renderTypes(){
 const host=el('roadTools');host.replaceChildren();
 for(const item of types.filter(t=>t.category===category)){
  const b=document.createElement('button');b.type='button';
  b.className='road-preset'+(item.id===current?' active':'');
  b.setAttribute('aria-pressed',String(item.id===current));
  b.title=item.help;b.append(icon(item.id));
  const text=document.createElement('span');text.textContent=item.label;b.append(text);
  b.onclick=()=>selectType(item.id);host.append(b);
 }
}
function selectType(id){
 const type=types.find(t=>t.id===id);if(!type)return;
 current=id;category=type.category;
 if(id==='double')el('roadColor').value='yellow';
 if(id==='solid'||id==='edge'||id==='crosswalk')el('roadColor').value='white';
 el('roadDashWrap').hidden=id!=='dashed';
 el('roadGapWrap').hidden=id!=='dashed';
 el('roadStripeWrap').hidden=id!=='crosswalk';
 el('roadSpaceWrap').hidden=!['crosswalk','island'].includes(id);
 el('roadLengthWrap').hidden=!['crosswalk','island'].includes(id);
 el('roadLabelWrap').hidden=!['sign','roadtext'].includes(id);
 renderCategories();renderTypes();updatePreview();
}
function updatePreview(){
 const sample=[{x:0,y:0},{x:20,y:0}];
 let all=null;
 const actual=source||sample;
 try{
  all=math.generate(actual,current,options());
  validGeometry=source?all:null;
  el('roadPreviewMode').textContent=source?'Vista del eje seleccionado':'Ejemplo · sin eje';
  previewSVG(all);
  el('roadStatus').textContent=source
   ?'Vista calculada: '+all.length+' entidades · '+axisLength(source).toFixed(2)+' m de eje. Pulsa Aplicar para dibujar.'
   :'Vista ilustrativa. Selecciona un eje en Modelo y pulsa «Usar selección».';
 }catch(error){
  validGeometry=null;
  el('roadStatus').textContent=error.message||String(error);
  previewSVG([]);
 }
 el('roadApply').disabled=!validGeometry||!validGeometry.length;
}
function open(kind='solid'){
 const tab=tabs.querySelector('[data-tab="civil"]');
 if(!tab?.classList.contains('active')){api.setStatus?.('Abre CIVIL 3D para usar señalización vial');return}
 panel.hidden=false;
 selectType(types.some(t=>t.id===kind)?kind:'solid');
 captureSelection();
}
function close(){panel.hidden=true}
el('roadClose').onclick=close;el('roadCancel').onclick=close;
el('roadUseSelection').onclick=captureSelection;
for(const id of ['roadWidth','roadDash','roadGap','roadStripe','roadSpace','roadLength','roadLabel','roadColor'])
 el(id).addEventListener('input',updatePreview);
el('roadApply').onclick=()=>{
 // Recheck the selection and parameters at the point of saving.
 const currentAxis=selectedAxis();
 if(!currentAxis){el('roadStatus').textContent='Selecciona una línea o polilínea antes de aplicar.';return}
 try{
  const generated=math.generate(currentAxis,current,options());
  const color=el('roadColor').value==='yellow'?'#f9ce38':'#f1f4f8';
  const layer=['sign','roadtext'].includes(current)?'CIVIL-SENALES':'CIVIL-MARCAS-VIALES';
  generated.forEach(obj=>{obj.color=color;obj.layer=layer});
  api.ensureLayer(layer,color);
  api.addObjects(generated,'Señalización vial · '+generated.length+' entidades · verificar normativa');
  source=currentAxis;validGeometry=generated;
  el('roadStatus').textContent='Aplicadas '+generated.length+' entidades al Modelo en capa '+layer+'.';
 }catch(error){
  el('roadStatus').textContent=error.message||String(error);
 }
};
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!panel.hidden){
  const focus=document.activeElement;
  if(panel.contains(focus)){close();event.stopPropagation()}
 }
});
const observer=new MutationObserver(()=>{
 const active=tabs.querySelector('[data-tab="civil"]')?.classList.contains('active');
 if(!active)close();
});
observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.OtroCadCivilRoadUI={open,close,captureSelection,updatePreview,types:types.map(t=>t.id)};
Object.assign(window.OtroCadCivilCommands,{
 C3DROAD:()=>open('solid'),C3DDASH:()=>open('dashed'),C3DZEBRA:()=>open('crosswalk'),
 C3DARROW:()=>open('arrow'),C3DSIGN:()=>open('sign'),C3DMARKS:()=>open('solid')
});
})();
