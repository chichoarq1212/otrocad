/* OtroCAD · HVAC and cold-room preliminary heat load dialogs.
 * All inputs are explicit; no automatic weather, climate or product assumptions.
 */
(()=>{
'use strict';
const calc=window.OtroCadThermal,api=window.OtroCadCivilAPI,mep=window.OtroCadMep;
const groups=document.getElementById('groups'),tabs=document.getElementById('tabs');
if(!calc||!api||!mep||!groups||!tabs)return;
const D={
 hvac:{
  title:'CARGAS TÉRMICAS · HVAC',
  sections:[
   ['Geometría del ambiente',[
    ['length','Largo (m)',6,.5,1000],['width','Ancho (m)',5,.5,1000],['height','Alto (m)',2.7,1.5,15]
   ]],
   ['Condiciones de diseño',[
    ['outdoor','Temperatura exterior (°C)',32,-30,65],
    ['inside','Temperatura interior (°C)',24,15,35],
    ['ach','Renovaciones aire (1/h)',.5,0,30],
    ['deltaW','Diferencia humedad (g/kg)',4,0,30]
   ]],
   ['Envolvente y radiación',[
    ['uWall','U muros (W/m²K)',1.4,.03,15],['uRoof','U cubierta (W/m²K)',1.2,.03,15],
    ['uGlass','U ventanas (W/m²K)',3,.03,15],['glazing','Área vidrio (m²)',5,0,100000],
    ['irradiance','Radiación ventana (W/m²)',350,0,1400],
    ['shgc','Factor solar SHGC',.5,0,1],['shading','Factor sombra',.6,0,1]
   ]],
   ['Cargas internas y reserva',[
    ['people','Ocupantes',2,0,5000],['peopleSensible','Sensible por persona (W)',75,0,500],
    ['peopleLatent','Latente por persona (W)',55,0,500],
    ['lighting','Iluminación (W/m²)',9,0,200],['equipment','Equipos (W)',500,0,1000000],
    ['marginPct','Reserva (%)',10,0,40]
   ]]
  ]
 },
 cold:{
  title:'DISEÑO PRELIMINAR · CUARTO FRÍO',
  sections:[
   ['Geometría y cerramientos',[
    ['length','Largo (m)',5,1,1000],['width','Ancho (m)',4,1,1000],
    ['height','Alto (m)',3,1.8,15],['door','Puerta (m)',1.1,.6,4],
    ['panelMm','Espesor panel del plano (mm)',100,40,250],
    ['uWall','U muros (W/m²K)',.25,.05,5],['uRoof','U techo (W/m²K)',.22,.05,5],
    ['uFloor','U piso (W/m²K)',.35,.05,5],
    ['lambda','Conductividad panel (W/mK)',.023,.015,.08]
   ]],
   ['Temperatura e infiltración',[
    ['outdoor','Ambiente exterior (°C)',32,-20,65],['inside','Consigna interior (°C)',2,-45,18],
    ['floorOutside','Temperatura bajo piso (°C)',20,-30,65],
    ['ach','Aire de infiltración equivalente (1/h)',1,0,50],
    ['deltaW','Diferencia humedad (g/kg)',7,0,40]
   ]],
   ['Producto que ingresa cada día',[
    ['productKgDay','Producto entrante (kg/día)',600,0,1e6],
    ['entryProductT','Temperatura ingreso producto (°C)',20,-50,80],
    ['cpAbove','Cp antes de congelar (kJ/kg·K)',3.5,.1,6],
    ['cpBelow','Cp congelado (kJ/kg·K)',1.7,.1,6],
    ['freezeT','Temperatura congelación (°C)',-1,-15,3],
    ['latentFreeze','Calor latente congelación (kJ/kg)',250,0,400],
    ['processHours','Horas para enfriar producto',18,1,24]
   ]],
   ['Operación y cargas internas',[
    ['operationHours','Horas refrigeración/día',18,1,24],
    ['lightingW','Iluminación instalada (W)',80,0,100000],
    ['lightingHours','Horas luz/día',8,0,24],
    ['fansW','Ventiladores (W)',300,0,100000],
    ['fanHours','Horas ventiladores/día',24,0,24],
    ['people','Personas dentro',1,0,1000],
    ['peopleW','Calor por persona (W)',280,0,1000],
    ['peopleHours','Horas personas/día',2,0,24],
    ['defrostKWh','Desescarche (kWh/día)',1,0,1e5],
    ['marginPct','Reserva (%)',15,0,50]
   ]]
  ]
 }
};
const nf=(x,n=2)=>Number(x).toLocaleString('es-EC',{maximumFractionDigits:n,minimumFractionDigits:n});
let dialog=null,last=null,mode='hvac';
const $=id=>dialog?.querySelector('#'+id);
const cache={};
function inputValue(key){
 const el=$('thermal-'+key);return el?Number(el.value):undefined;
}
function collect(){
 const obj={};
 for(const [,fields] of D[mode].sections)for(const [key] of fields)obj[key]=inputValue(key);
 return obj;
}
function section(title,fields){
 const fs=document.createElement('fieldset');fs.className='thermal-fieldset';
 const legend=document.createElement('legend');legend.textContent=title;fs.append(legend);
 const grid=document.createElement('div');grid.className='thermal-field-grid';
 for(const [key,label,defaultValue,min,max] of fields){
  const wrap=document.createElement('label');wrap.textContent=label;
  const input=document.createElement('input');input.type='number';input.inputMode='decimal';
  input.id='thermal-'+key;input.step='any';input.min=String(min);input.max=String(max);
  input.value=String(cache[mode]?.[key]??defaultValue);
  input.setAttribute('aria-label',label);
  input.addEventListener('input',refresh);wrap.append(input);grid.append(wrap);
 }
 fs.append(grid);return fs;
}
function addLine(table,name,value){
 const row=document.createElement('tr');
 const left=document.createElement('td'),right=document.createElement('td');
 left.textContent=name;right.textContent=value;row.append(left,right);table.append(row);
}
function summaryRows(output){
 if(mode==='hvac')return[
  ['Área · volumen',nf(output.geometry.area)+' m² · '+nf(output.geometry.volume)+' m³'],
  ['Muros / cubierta / ventanas',nf(output.envelope.walls/1000)+' / '+nf(output.envelope.roof/1000)+' / '+nf(output.envelope.glass/1000)+' kW'],
  ['Ganancia solar por vidrio',nf(output.envelope.solar/1000)+' kW'],
  ['Aire exterior sensible / latente',nf(output.air.sensibleW/1000)+' / '+nf(output.air.latentW/1000)+' kW'],
  ['Iluminación / equipos',nf(output.internal.lighting/1000)+' / '+nf(output.internal.equipment/1000)+' kW'],
  ['Personas sensible / latente',nf(output.internal.peopleSensible/1000)+' / '+nf(output.internal.peopleLatent/1000)+' kW'],
  ['Carga sensible / latente',nf(output.sensibleW/1000)+' / '+nf(output.latentW/1000)+' kW'],
  ['Base sin reserva',nf(output.baseW/1000)+' kW'],
  ['Total de diseño estimado',nf(output.designKW)+' kW'],
  ['Conversión',nf(output.designBTUh,0)+' BTU/h · '+nf(output.designTR)+' TR']
 ];
 return[
  ['Dimensiones / volumen',nf(output.inputs.length)+' × '+nf(output.inputs.width)+' × '+nf(output.inputs.height)+' m · '+nf(output.geometry.volume)+' m³'],
  ['Transmisión muros / techo / piso',nf(output.transmissionW.walls/1000)+' / '+nf(output.transmissionW.roof/1000)+' / '+nf(output.transmissionW.floor/1000)+' kW'],
  ['Transmisión (energía/día)',nf(output.breakdownKWh.transmission)+' kWh/d'],
  ['Infiltración / humedad',nf(output.breakdownKWh.infiltration)+' kWh/d'],
  ['Enfriamiento del producto',nf(output.breakdownKWh.product)+' kWh/d'],
  ['Iluminación / fans / personas / desescarche',nf(output.breakdownKWh.internal)+' kWh/d'],
  ['Carga base diaria',nf(output.baseKWhDay)+' kWh/d'],
  ['Carga diaria con reserva',nf(output.designKWhDay)+' kWh/d'],
  ['Capacidad frigorífica estimada',nf(output.capacityKW)+' kW · '+nf(output.capacityBTUh,0)+' BTU/h'],
  ['Espesor aislante de referencia por U muro',nf(output.panelThicknessMm,0)+' mm (simplificado)']
 ];
}
function refresh(){
 if(!dialog)return;
 const report=$('thermalReport'),error=$('thermalError'),warning=$('thermalWarning');
 const insert=$('thermalInsert'),exportBtn=$('thermalExport');
 let input=null,output=null;
 try{
  input=collect();output=mode==='hvac'?calc.hvac(input):calc.coldRoom(input);
  error.textContent='';
  report.replaceChildren();
  const table=document.createElement('table');table.className='thermal-table';
  for(const [name,value] of summaryRows(output))addLine(table,name,value);
  report.append(table);
  warning.textContent=output.warnings.join(' ');
  last={mode,input,output};
  insert.hidden=mode!=='cold';insert.disabled=false;exportBtn.disabled=false;
 }catch(e){
  error.textContent=e.message||String(e);
  report.textContent='Corrige los valores para obtener un cálculo.';
  warning.textContent='';last=null;
  insert.disabled=true;exportBtn.disabled=true;
 }
}
function switchMode(value){
 if(dialog&&$('thermalFields').children.length){
  cache[mode]=collect();
 }
 mode=value==='cold'?'cold':'hvac';
 $('thermalTitle').textContent=D[mode].title;
 const host=$('thermalFields');host.replaceChildren();
 for(const [name,fields] of D[mode].sections)host.append(section(name,fields));
 $('thermalModeHVAC').classList.toggle('active',mode==='hvac');
 $('thermalModeCold').classList.toggle('active',mode==='cold');
 $('thermalModeHVAC').setAttribute('aria-selected',String(mode==='hvac'));
 $('thermalModeCold').setAttribute('aria-selected',String(mode==='cold'));
 refresh();
}
function csv(){
 if(!last)return;
 const lines=[['OtroCAD','Estudio preliminar '+(mode==='hvac'?'HVAC':'cuarto frío')],
  ['Magnitud','Valor'],...summaryRows(last.output),['Advertencia',last.output.warnings.join(' | ')]];
 for(const [key,val] of Object.entries(last.input))lines.push([key,String(val)]);
 const quote=s=>'"'+String(s).replace(/"/g,'""')+'"';
 const blob=new Blob(['\uFEFF'+lines.map(row=>row.map(quote).join(';')).join('\r\n')],
  {type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='OtroCAD-'+(mode==='hvac'?'carga-HVAC':'cuarto-frio')+'.csv';
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function open(value='hvac'){
 if(!dialog){
  dialog=document.createElement('dialog');dialog.className='mep-thermal-dialog';
  dialog.innerHTML=[
   '<div class="thermal-head"><div><strong id="thermalTitle">CARGAS TÉRMICAS · HVAC</strong>',
   '<small>Estimación de ingeniería · unidades SI</small></div>',
   '<button id="thermalClose" type="button" aria-label="Cerrar">×</button></div>',
   '<div class="thermal-tabs" role="tablist" aria-label="Tipo de cálculo">',
   '<button id="thermalModeHVAC" type="button" role="tab">Climatización HVAC</button>',
   '<button id="thermalModeCold" type="button" role="tab">Cuarto frío / congelación</button></div>',
   '<div class="thermal-content"><div id="thermalFields" class="thermal-fields"></div>',
   '<div class="thermal-results"><h4>Balance térmico y dimensionamiento</h4>',
   '<p class="thermal-description">Valores preliminares calculados con los parámetros indicados; no son una selección definitiva de equipos.</p>',
   '<p id="thermalError" class="thermal-error" role="alert"></p>',
   '<div id="thermalReport" aria-live="polite"></div>',
   '<p id="thermalWarning" class="thermal-warning"></p>',
   '<p class="thermal-source">Métodos simplificados: U·A·ΔT, aire sensible/latente y balance energético del producto. Consultar ASHRAE y datos de fabricantes.</p>',
   '</div></div><footer class="thermal-footer">',
   '<button type="button" id="thermalCancel">Cerrar</button>',
   '<button type="button" id="thermalExport">Exportar reporte CSV</button>',
   '<button type="button" id="thermalInsert">Insertar planta 2D en CAD</button></footer>'
  ].join('');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog?.remove();dialog=null});
  $('thermalClose').onclick=() =>dialog.close();
  $('thermalCancel').onclick=() =>dialog.close();
  $('thermalModeHVAC').onclick=()=>switchMode('hvac');
  $('thermalModeCold').onclick=()=>switchMode('cold');
  $('thermalExport').onclick=csv;
  $('thermalInsert').onclick=()=>{
   if(!last||mode!=='cold')return;
   try{
    mep.startColdRoomLayout({...last.input});
    // Nonmodal CAD placement starts only after the dialog is closed.
    dialog.close();
   }catch(e){$('thermalError').textContent=e.message||String(e)}
  };
 }
 mode='hvac';switchMode(value);
 dialog.showModal();
}
function icon(){
 const holder=document.createElement('span');holder.className='ico';
 holder.innerHTML='<svg class="cad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 2v10m10-10v10M4 7h16M5 17h14m-12-3h10v8H7z"/><path d="M10 19h4" stroke="#ffcf23" stroke-width="2"/></svg>';
 return holder;
}
for(const panelName of ['mep','hvac']){
 const group=document.createElement('div');group.className='toolgroup';group.dataset.panel=panelName;
 group.hidden=true;group.classList.add('mep-thermal-group');
 const heading=document.createElement('span');heading.className='group-title';heading.textContent='CÁLCULO TÉRMICO';
 group.append(heading);
 for(const [name,label] of [['hvac','Cargas térmicas'],['cold','Cuartos fríos']]){
  const button=document.createElement('button');button.type='button';button.className='civil-tool mep-tool';
  button.title=name==='hvac'?'Calcular carga sensible y latente para climatización':'Dimensionamiento preliminar de cuarto frigorífico y planta 2D';
  button.setAttribute('aria-label',button.title);
  const caption=document.createElement('span');caption.className='civil-label';caption.textContent=label;
  button.append(icon(),caption);button.onclick=()=>open(name);group.append(button);
 }
 groups.append(group);
}
window.OtroCadThermalUI={open,compute:mode=>mode==='cold'?calc.coldRoom:calc.hvac};
Object.assign(window.OtroCadCivilCommands,{
 MEPLOAD:()=>open('hvac'),HVACLOAD:()=>open('hvac'),COLDROOM:()=>open('cold'),
 CUARTOFRIO:()=>open('cold'),CARGATERMICA:()=>open('hvac')
});
})();
