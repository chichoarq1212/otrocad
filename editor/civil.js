/* OtroCAD Civil 3D-inspired workspace: native editable CAD primitives, offline. */
(function(){
'use strict';
const host=window.OtroCadCivilHost,math=window.OtroCadCivilMath;
if(!host||!math)return;
const $=sel=>document.querySelector(sel);
const input=$('#civilFile');
const factor=()=>({m:1,cm:.01,mm:.001})[host.units()]||1;
const num=n=>Number(n).toLocaleString('es-EC',{maximumFractionDigits:3});
const csvSafe=v=>{let s=String(v??'');if(/^[=+@\t\r]/.test(s))s="'"+s;return /[";\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csv=(header,rows)=>'\uFEFF'+[header,...rows].map(row=>row.map(csvSafe).join(';')).join('\r\n')+'\r\n';
let labelsOn=true,tinCache=null,tinSignature='',lastReport=null;
function inform(message){host.report(message)}
function modelReady(){if(host.activeLayout()!=='Model'){inform('CIVIL: cambia a Modelo para editar');return false}return true}
function ensureLayer(name,color){
 host.ensureLayer(name,color);return {layer:name,color,lineweight:.18,linetype:'CONTINUOUS',cadLayout:'Model'};
}
function surveyPoints(){
 return host.getObjects().filter(o=>o.type==='point'&&o.a&&o.cadCivilKind==='survey-point')
 .map(o=>({x:Number(o.a.x),y:Number(o.a.y),z:Number(o.cadElevation),name:o.cadCivilName||''})).filter(p=>[p.x,p.y,p.z].every(Number.isFinite));
}
function surface(){
 const points=surveyPoints();if(points.length<3)throw Error('Se necesitan tres o más puntos XYZ (no alineados). Importa un CSV o agrega puntos.');
 const signature=points.map(p=>[p.x,p.y,p.z].join(',')).join(';');
 if(tinCache&&signature===tinSignature)return tinCache;
 const calculated=math.triangulate(points);
 if(!calculated.triangles.length)throw Error('No se pudo generar una superficie. Verifica que los puntos XYZ no sean colineales.');
 tinCache=calculated;tinSignature=signature;return tinCache;
}
function surveyEntity(p){
 return {type:'point',a:{x:p.x,y:p.y},cadElevation:p.z,cadCivilKind:'survey-point',
  cadCivilName:p.name||'',cadCivilDescription:p.description||'',...ensureLayer('Civil-Puntos','#3bd3a1')};
}
function pointFromRow(row){
 if(!row||![row.x,row.y,row.z].every(Number.isFinite))return null;
 return surveyEntity(row);
}
function addSurveyPoints(points){
 if(!modelReady())return;
 const entities=points.map(pointFromRow).filter(Boolean);
 if(!entities.length)throw Error('No se encontraron puntos XYZ válidos.');
 if(host.getObjects().length+entities.length>100000)throw Error('Límite de entidades del dibujo alcanzado.');
 host.addEntities(entities);tinCache=null;tinSignature='';
 inform('CIVIL · '+entities.length+' puntos topográficos añadidos. Puedes generar la superficie TIN.');
}
function selectedPath(){
 const selected=host.selectedItems().filter(o=>['line','poly','polygon'].includes(o.type));
 const s=selected[0];
 if(!s)throw Error('Selecciona una línea o polilínea en Modelo que defina el eje del perfil.');
 const path=s.pts?.length>=2?s.pts:s.a&&s.b?[s.a,s.b]:null;
 if(!path||path.length<2)throw Error('El eje seleccionado no contiene dos puntos.');
 return path;
}
function numericPrompt(label,suggested,minimum=0){
 const answer=window.prompt(label,String(suggested));
 if(answer===null)return null;
 const value=Number(answer.trim().replace(',','.'));
 if(!Number.isFinite(value)||value<=minimum)throw Error('Valor inválido: '+label);
 return value;
}
function replace(kind,shapes){
 if(!modelReady())return;
 host.replaceCivil(kind,shapes);
}
function drawTin(){
 const tin=surface(),edges=math.edges(tin),style=ensureLayer('Civil-TIN','#75a8cf');
 const shapes=edges.map(([a,b])=>({type:'line',a:{x:tin.points[a].x,y:tin.points[a].y},b:{x:tin.points[b].x,y:tin.points[b].y},
  cadCivilKind:'tin-edge',...style}));
 replace('tin-edge',shapes);
 inform('CIVIL · Superficie TIN: '+tin.triangles.length+' triángulos, '+edges.length+' aristas.');
}
function drawContours(){
 const tin=surface(),fac=factor(),intervalMeters=numericPrompt('Equidistancia de curvas de nivel (metros)',1,0);
 if(intervalMeters===null)return;
 const interval=intervalMeters/fac;
 const segments=math.contours(tin,interval);
 if(!segments.length)throw Error('No hay desnivel suficiente para crear curvas con esa equidistancia.');
 const style=ensureLayer('Civil-Curvas','#c79954');
 const shapes=segments.map(seg=>({type:'line',a:seg.a,b:seg.b,cadCivilKind:'contour',
   cadElevation:seg.level,cadCivilIndex:Math.abs((seg.level*fac)/(intervalMeters*5)-Math.round((seg.level*fac)/(intervalMeters*5)))<1e-7,
   ...style,lineweight:.25}));
 replace('contour',shapes);
 inform('CIVIL · '+segments.length+' segmentos de curvas de nivel cada '+num(intervalMeters)+' m. Editables en CAD.');
}
function chainage(v){
 const meters=v*factor(),whole=Math.floor(meters/1000),small=meters-whole*1000;
 return whole+'+'+small.toFixed(2).padStart(6,'0');
}
function stake(){
 const path=selectedPath(),stepMeters=numericPrompt('Intervalo de progresivas (metros)',10,0);
 if(stepMeters===null)return;
 const stations=math.stationPoints(path,stepMeters/factor()),style=ensureLayer('Civil-Ejes','#e6b95d');
 const size=Math.max(stepMeters/factor()*.035,.1/factor());
 const shapes=[];
 for(const point of stations){
  const sin=Math.sin(point.angle),cos=Math.cos(point.angle),half=size*.75;
  shapes.push({type:'line',a:{x:point.x-sin*half,y:point.y+cos*half},b:{x:point.x+sin*half,y:point.y-cos*half},cadCivilKind:'station',...style});
  shapes.push({type:'text',a:{x:point.x+sin*size,y:point.y-cos*size},text:chainage(point.station),
   textHeightWorld:size*.65,textRotation:0,cadCivilKind:'station',...style});
 }
 replace('station',shapes);
 inform('CIVIL · '+stations.length+' progresivas sobre el eje seleccionado.');
}
function openResult(title,description,rows,header,filename,plotRows){
 lastReport={rows,header,filename};
 let dialog=$('#civilResult');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='civilResult';dialog.setAttribute('aria-label','Resultados de ingeniería civil');
  const close=document.createElement('button');close.type='button';close.textContent='✕ Cerrar';close.className='civil-close';close.onclick=()=>dialog.close();
  const h=document.createElement('h2');h.id='civilResultTitle';
  const subtitle=document.createElement('p');subtitle.id='civilResultDescription';
  const canvas=document.createElement('canvas');canvas.id='civilPlot';canvas.width=850;canvas.height=350;
  const table=document.createElement('div');table.id='civilTable';
  const download=document.createElement('button');download.id='civilExportResult';download.textContent='Descargar CSV';download.onclick=()=>{
   if(lastReport)host.download(lastReport.filename,csv(lastReport.header,lastReport.rows),'text/csv;charset=utf-8');
  };
  const controls=document.createElement('div');controls.className='civil-result-controls';controls.append(download,close);
  dialog.append(h,subtitle,canvas,table,controls);document.body.append(dialog);
 }
 $('#civilResultTitle').textContent=title;$('#civilResultDescription').textContent=description;
 const table=$('#civilTable');table.textContent='';
 const headers=document.createElement('div');headers.className='civil-result-header';headers.textContent=header.join(' · ');table.append(headers);
 for(const values of rows.slice(0,12)){const row=document.createElement('div');row.textContent=values.join(' · ');table.append(row)}
 if(rows.length>12){const more=document.createElement('div');more.textContent='… '+(rows.length-12)+' filas adicionales disponibles en CSV';table.append(more)}
 $('#civilPlot').hidden=!plotRows;
 if(plotRows)drawPlot(plotRows,title);
 if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal()}else dialog.setAttribute('open','');
}
function drawPlot(samples,title){
 const canvas=$('#civilPlot'),ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,pad={l:62,r:30,t:30,b:48};
 const valid=samples.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#101d2e';ctx.fillRect(0,0,w,h);
 if(!valid.length){ctx.fillStyle='#ffd15c';ctx.font='17px sans-serif';ctx.fillText('El eje no cruza una superficie TIN válida.',30,60);return}
 const xs=valid.map(p=>p.x),zs=valid.map(p=>p.z),minx=Math.min(...xs),maxx=Math.max(...xs),minz=Math.min(...zs),maxz=Math.max(...zs),dx=Math.max(1e-9,maxx-minx),dz=Math.max(1e-9,maxz-minz);
 const sx=x=>pad.l+(x-minx)/dx*(w-pad.l-pad.r),sy=z=>h-pad.b-(z-minz)/dz*(h-pad.t-pad.b);
 ctx.strokeStyle='#314b67';ctx.lineWidth=1;ctx.font='12px sans-serif';ctx.fillStyle='#d9e7ff';
 for(let j=0;j<=5;j++){const z=minz+dz*j/5,y=sy(z);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(num(z*factor())+' m',5,y+4)}
 ctx.strokeStyle='#55dca8';ctx.lineWidth=2.5;ctx.beginPath();let drawing=false;
 for(const p of samples){if(!Number.isFinite(p.z)){drawing=false;continue}const x=sx(p.x),y=sy(p.z);drawing?ctx.lineTo(x,y):ctx.moveTo(x,y);drawing=true}
 ctx.stroke();ctx.fillStyle='#e5edff';ctx.fillText('Distancia (m): '+num((maxx-minx)*factor()),pad.l,h-12);ctx.fillText(title,pad.l,16);
}
function viewProfile(){
 const tin=surface(),path=selectedPath(),length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
 const stepMeters=numericPrompt('Muestreo longitudinal (metros)',Math.max(.5,Math.round(length*factor()/75*10)/10),0);
 if(stepMeters===null)return;
 const list=math.profile(tin,path,stepMeters/factor());
 const rows=list.map(p=>[chainage(p.station),num(p.x),num(p.y),p.z===null?'Fuera de superficie':num(p.z*factor())]);
 openResult('Perfil longitudinal','Cotas interpoladas en la superficie TIN (no se altera el eje).',rows,['Progresiva','X','Y','Cota (m)'],'otrocad-civil-perfil.csv',list.map(p=>({x:p.station,z:p.z})));
 inform('CIVIL · Perfil longitudinal con '+list.length+' estaciones.');
}
function viewCrossSections(){
 const tin=surface(),path=selectedPath(),station=numericPrompt('Separación de secciones (metros)',10,0);
 if(station===null)return;
 const half=numericPrompt('Semiancho desde el eje (metros)',10,0);if(half===null)return;
 const sample=numericPrompt('Paso transversal (metros)',2,0);if(sample===null)return;
 const sections=math.crossSections(tin,path,station/factor(),half/factor(),sample/factor());
 const list=sections.flat(),rows=list.map(p=>[chainage(p.station),num(p.offset*factor()),num(p.x),num(p.y),p.z===null?'Fuera de superficie':num(p.z*factor())]);
 const first=sections[0]||[];
 openResult('Secciones transversales',sections.length+' secciones perpendiculares al eje. El CSV incluye todas.',rows,
  ['Progresiva','Desfase (m)','X','Y','Cota (m)'],'otrocad-civil-secciones.csv',
  first.map(p=>({x:p.offset,z:p.z})));
 inform('CIVIL · '+sections.length+' secciones y '+list.length+' puntos de muestreo.');
}
function calculateGrade(){
 const path=selectedPath(),tin=surface(),a=path[0],b=path.at(-1),z1=math.interpolate(tin,a.x,a.y),z2=math.interpolate(tin,b.x,b.y);
 if(z1===null||z2===null)throw Error('Los extremos deben estar dentro de la superficie TIN.');
 const distance=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
 if(distance<=0)throw Error('El eje no tiene longitud.');
 const slope=(z2-z1)/distance*100,angle=Math.atan(slope/100)*180/Math.PI;
 window.alert('Pendiente longitudinal del eje\nDistancia: '+num(distance*factor())+' m\nCota inicial: '+num(z1*factor())+' m\nCota final: '+num(z2*factor())+' m\nPendiente: '+num(slope)+' %\nÁngulo: '+num(angle)+'°');
 inform('CIVIL · Pendiente '+num(slope)+' %');
}
function calculateVolumes(){
 const tin=surface(),z=tin.points.map(p=>p.z).reduce((a,b)=>a+b,0)/tin.points.length;
 const datum=window.prompt('Cota de referencia horizontal (metros)',String(+(z*factor()).toFixed(3)));
 if(datum===null)return;
 const zRef=Number(datum.trim().replace(',','.'))/factor();
 if(!Number.isFinite(zRef))throw Error('Cota de referencia inválida.');
 const r=math.volumes(tin,zRef),fac=factor();
 window.alert('CIVIL · Volumen respecto al plano horizontal Z='+num(zRef*fac)+' m\nÁrea triangulada: '+num(r.area*fac**2)+' m²\nCorte: '+num(r.cut*fac**3)+' m³\nRelleno: '+num(r.fill*fac**3)+' m³\nBalance (corte - relleno): '+num(r.net*fac**3)+' m³\n\nCálculo geométrico aproximado por triángulos, sin límites de obra, taludes ni factores de compactación.');
 inform('CIVIL · Cubicación referencial calculada con '+tin.triangles.length+' triángulos.');
}
function exportPoints(){
 const points=surveyPoints();if(!points.length)throw Error('Todavía no hay puntos de topografía para exportar.');
 host.download('otrocad-civil-puntos.csv',csv(['Punto','X','Y','Cota'],points.map(p=>[p.name,p.x,p.y,p.z])),'text/csv;charset=utf-8');
 inform('CIVIL · '+points.length+' puntos exportados.');
}
async function importPoints(){
 const file=input?.files?.[0];if(!file)return;
 try{
  const points=math.parseCsv(await file.text());if(!points.length)throw Error('El CSV no incluye columnas X,Y,Z válidas (también se admiten Este,Norte,Cota).');
  addSurveyPoints(points);
 }catch(error){window.alert('Importación topográfica: '+error.message)}
 finally{input.value=''}
}
function safeRun(action){
 try{if(!modelReady())return;action()}catch(error){console.error('OtroCAD Civil:',error);window.alert('OtroCAD Civil: '+(error?.message||error));inform('CIVIL · operación no realizada; dibujo conservado')}
}
function addPoint(){
 const line=window.prompt('Punto XYZ: X;Y;COTA;NOMBRE\nEjemplo: 20;30;1845.20;P1','0;0;0;P1');
 if(line===null)return;
 const pieces=line.split(';').map(s=>s.trim());
 if(pieces.length<3)throw Error('Usa X;Y;COTA;NOMBRE separados por punto y coma.');
 const [x,y,z]=pieces.slice(0,3).map(n=>Number(n.replace(',','.')));
 if(![x,y,z].every(Number.isFinite))throw Error('Coordenadas o cota no válidas.');
 addSurveyPoints([{x,y,z,name:pieces[3]||'P'+(surveyPoints().length+1)}]);
}
const actions={
 civilImport:()=>input.click(),
 civilPoint:addPoint,
 civilTin:drawTin,
 civilContours:drawContours,
 civilAlignment:stake,
 civilProfile:viewProfile,
 civilSections:viewCrossSections,
 civilSlope:calculateGrade,
 civilVolumes:calculateVolumes,
 civilExport:exportPoints,
 civilLabels:()=>{
  labelsOn=!labelsOn;
  $('#civilLabels').setAttribute('aria-pressed',String(labelsOn));
  $('#civilLabels').classList.toggle('active',labelsOn);
  inform('Etiquetas topográficas '+(labelsOn?'visibles':'ocultas'));
  host.redraw();
 }
};
for(const [id,handler] of Object.entries(actions)){
 const button=$('#'+id);
 if(button)button.addEventListener('click',()=>safeRun(handler));
}
if(input)input.addEventListener('change',importPoints);
window.OtroCadCivil={
 drawOverlay(){
  if(!labelsOn)return;
  const points=host.getObjects().filter(o=>o.cadCivilKind==='survey-point'&&o.type==='point'&&o.a).slice(0,350);
  if(!points.length)return;
  const ctx=host.context();ctx.save();ctx.font='11px system-ui';ctx.textBaseline='middle';ctx.lineWidth=2.3;
  for(const p of points){
   const q=host.screen(p.a);
   if(q.x<0||q.y<0||q.x>host.canvasWidth()||q.y>host.canvasHeight())continue;
   const label=String(p.cadCivilName||'')+'  Z '+num(Number(p.cadElevation)*factor());
   ctx.strokeStyle='#071723';ctx.fillStyle='#9bffe1';ctx.strokeText(label,q.x+7,q.y-9);ctx.fillText(label,q.x+7,q.y-9);
  }
  ctx.restore();
 },
 getTIN:surface
};
})();
