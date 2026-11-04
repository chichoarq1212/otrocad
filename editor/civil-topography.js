/* OtroCAD Civil: input UTM + paste TXT; CAD general is unchanged. */
(()=>{
'use strict';
const api=window.OtroCadCivilAPI,parser=window.OtroCadCivilPoints,tabs=document.getElementById('tabs'),groups=document.getElementById('groups');
if(!api||!parser||!tabs||!groups)return;
const factor=()=>api.getUnits()==='mm'?.001:api.getUnits()==='cm'?.01:1;
const active=()=>!!document.querySelector('[data-tab="civil"].active');
const toModel=(east,north)=>{
 const geo=window.OtroCadGeolocation,config=geo?.getState?.();
 if(config?.configured&&geo.utmToModel)return geo.utmToModel([east,north],api.getUnits());
 return {x:east/factor(),y:north/factor()};
};
const fromModel=(point)=>{
 const geo=window.OtroCadGeolocation,config=geo?.getState?.();
 if(config?.configured&&geo.modelToUtm){
  const p=geo.modelToUtm(point,api.getUnits());return{east:p[0],north:p[1]};
 }
 return {east:point.x*factor(),north:point.y*factor()};
};
function makeDialog(title,help){
 const d=document.createElement('dialog');d.className='civil-topo-dialog';
 const h=document.createElement('h3');h.textContent=title;
 const p=document.createElement('p');p.textContent=help;
 d.append(h,p);document.body.append(d);d.addEventListener('close',()=>d.remove());return d;
}
function control(text,onClick,primary=false){
 const b=document.createElement('button');b.type='button';b.textContent=text;if(primary)b.className='primary';
 b.onclick=onClick;return b;
}
function field(d,text,value='',type='text'){
 const label=document.createElement('label');label.textContent=text;
 const input=document.createElement('input');input.type=type;input.value=value;
 if(type==='number')input.step='any';label.append(input);d.append(label);return input;
}
function savePoints(points,makeAxis=false){
 const entities=parser.entities(points,toModel);
 api.ensureLayer('Topografía','#70d6a3');
 if(makeAxis){api.ensureLayer('Ejes-Civil','#ffcf23');entities.push(parser.polyline(points,toModel))}
 return api.addObjects(entities,'Coordenadas UTM · '+points.length+' puntos'+(makeAxis?' + eje':''));
}
function showPolylineDialog(){
 if(!active()){api.setStatus('Abre CIVIL 3D para ingresar una polilínea UTM');return}
 const d=makeDialog('Polilínea por coordenadas UTM · Civil 3D',
  'Ingresa Norte, Este y Cota (metros). Tab recorre campos, ; cambia de campo y Enter añade el vértice. No afecta el módulo Dibujo.');
 const holder=document.createElement('div');holder.className='civil-topo-grid';
 const n=field(holder,'Norte (m)','','number'),e=field(holder,'Este (m)','','number');
 const z=field(holder,'Cota (m)','0','number'),desc=field(holder,'Descripción');
 d.append(holder);
 const report=document.createElement('p');report.className='civil-topo-report';report.setAttribute('role','status');report.textContent='0 vértices';
 const preview=document.createElement('pre');preview.className='civil-topo-preview';d.append(report,preview);
 const points=[];
 function add(){
  const north=parser.validNumber(n.value),east=parser.validNumber(e.value),height=parser.validNumber(z.value);
  if(![north,east,height].every(Number.isFinite)){report.textContent='Norte, Este y Cota deben ser números válidos.';return}
  if(north<0||north>10000000||east<100000||east>900000){report.textContent='Coordenada fuera del rango UTM habitual. Comprueba el valor.';return}
  points.push({id:String(points.length+1),north,east,z:height,description:desc.value.trim()});
  report.textContent='Vértices: '+points.length+' · N '+north.toFixed(3)+' / E '+east.toFixed(3);
  preview.textContent=points.slice(-8).map(x=>x.id+' | N '+x.north+' · E '+x.east+' · Cota '+x.z).join('\n');
  desc.value='';n.focus({preventScroll:true});n.select();
 }
 const fields=[n,e,z,desc];
 for(const f of fields)f.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();add()}
  else if(event.key===';'){event.preventDefault();fields[(fields.indexOf(f)+1)%fields.length].focus()}
 });
 const actions=document.createElement('div');actions.className='civil-topo-actions';
 actions.append(control('Añadir vértice',add),control('Crear polilínea',()=>{
  if(points.length<2){report.textContent='Necesitas al menos dos vértices.';return}
  try{savePoints(points,true);d.close()}catch(err){report.textContent=err.message}
 },true),control('Cancelar',()=>d.close()));d.append(actions);
 d.showModal();n.focus({preventScroll:true});
}
function showImportDialog(source=''){
 if(!active()){api.setStatus('Abre CIVIL 3D para importar puntos topográficos');return}
 const d=makeDialog('Puntos XYZ · Importar TXT / CSV / BLOCK',
  'Número, Norte, Este, Cota, Descripción. Admite texto pegado, tabulaciones y encabezados. Verifica la vista previa antes de importar.');
 const area=document.createElement('textarea');area.setAttribute('aria-label','Bloque de texto topográfico');
 area.placeholder='1 9976534.22 742345.81 2540.12 BM-1\n2 9976540.15 742350.33 2540.60 EJE-1';
 area.value=String(source||'');d.append(area);
 const wrapper=document.createElement('div');wrapper.className='civil-topo-grid';
 const order=document.createElement('label');order.textContent='Orden de columnas';
 const select=document.createElement('select');
 for(const [v,label] of [['auto','Auto (encabezados / P,N,E,Z,D)'],['PNEZD','P, N, E, Z, D'],['PNEZ','P, N, E, Z'],['NEZD','N, E, Z, D'],['NEZ','N, E, Z'],['ENZD','E, N, Z, D'],['ENZ','E, N, Z'],['PENZD','P, E, N, Z, D']]){
  const opt=document.createElement('option');opt.value=v;opt.textContent=label;select.append(opt)
 }
 order.append(select);wrapper.append(order);
 const sep=document.createElement('label');sep.textContent='Separador';
 const sepSelect=document.createElement('select');
 for(const [v,label] of [['auto','Auto'],['whitespace','Espacios'],['\t','Tab'],[',','Coma'],[';','Punto y coma']]){
  const opt=document.createElement('option');opt.value=v;opt.textContent=label;sepSelect.append(opt)
 }
 sep.append(sepSelect);wrapper.append(sep);d.append(wrapper);
 const preview=document.createElement('pre');preview.className='civil-topo-preview';d.append(preview);
 const report=document.createElement('p');report.className='civil-topo-report';report.setAttribute('role','status');d.append(report);
 const check=document.createElement('label');check.className='civil-topo-check';const isPoly=document.createElement('input');isPoly.type='checkbox';
 check.append(isPoly,document.createTextNode(' Unir los puntos mediante una polilínea'));d.append(check);
 const parse=()=>{
  try{
   const opts={order:select.value};
   if(sepSelect.value!=='auto')opts.separator=sepSelect.value;
   const result=parser.parse(area.value,opts);
   preview.textContent=result.points.slice(0,7).map(p=>p.id+' | N '+p.north+' | E '+p.east+' | Z '+p.z+' | '+p.description).join('\n');
   report.textContent=result.points.length+' puntos válidos; '+result.invalidRows.length+' filas descartadas.';
   return result.points;
  }catch(err){preview.textContent='';report.textContent=err.message;return null}
 };
 const actions=document.createElement('div');actions.className='civil-topo-actions';
 actions.append(control('Vista previa',parse),control('Importar al plano',()=>{
  const points=parse();if(!points)return;
  try{savePoints(points,isPoly.checked);d.close()}catch(err){report.textContent=err.message}
 },true),control('Cancelar',()=>d.close()));d.append(actions);
 for(const input of [area,select,sepSelect])input.addEventListener('change',parse);
 d.showModal();if(area.value)parse();
}
const group=document.createElement('div');group.className='toolgroup';group.dataset.panel='civil';group.hidden=true;
const head=document.createElement('span');head.className='group-title';head.textContent='COORDENADAS UTM';group.append(head);
function addTool(text,handler){
 const button=document.createElement('button');button.type='button';button.className='civil-tool';
 const mark=document.createElement('span');mark.className='ico';
 mark.innerHTML='<svg class="cad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16M5 4v17M6 16l6-6 5 3 3-6"/><circle cx="12" cy="10" r="2" fill="#ffcf23"/></svg>';
 const label=document.createElement('span');label.className='civil-label';label.textContent=text;
 button.append(mark,label);button.onclick=handler;group.append(button);
}
addTool('Polilínea UTM N/E/Z',showPolylineDialog);
addTool('Pegar TXT / BLOCK',()=>showImportDialog());
groups.append(group);
window.OtroCadCivilTopo={active,toModel,fromModel,showImportDialog,showPolylineDialog,importPoints:(text,opts)=>{
 const result=parser.parse(text,opts);savePoints(result.points,!!opts?.polyline);return result;
}};
Object.assign(window.OtroCadCivilCommands,{C3DUTM:showPolylineDialog,C3DPNEZD:()=>showImportDialog(),C3DTXT:()=>showImportDialog()});
})();
