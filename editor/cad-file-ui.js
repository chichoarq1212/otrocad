/* OtroCAD unified Save/Save As, progressive local checkpoints and recovery. */
(()=>{
'use strict';
const core=window.OtroCadFileCore;
if(!core)return;
const btnSave=document.getElementById('save'),btnAs=document.getElementById('saveAs'),btnLocal=document.getElementById('saveLocal'),
 btnRecovery=document.getElementById('recoverProgress');
let format='dwg',busy=false;
const dialog=document.createElement('dialog');dialog.id='cadSaveDialog';dialog.className='cad-save-dialog';
dialog.innerHTML=[
 '<div class="cs-head"><strong>GUARDAR COMO · OtroCAD</strong><button id="csClose" type="button" aria-label="Cerrar">×</button></div>',
 '<div class="cs-body"><label>Nombre del archivo<input type="text" id="csName" maxlength="150" value="OtroCAD-Proyecto" autocomplete="off"></label>',
 '<label>Tipo de archivo<select id="csFormat">',
 '<option value="dwg">AutoCAD DWG 2018 · archivo binario</option>',
 '<option value="dxf">DXF · intercambio CAD</option>',
 '<option value="json">Proyecto OtroCAD · respaldo editable</option>',
 '</select></label>',
 '<p class="cs-hint">El archivo DWG se comprueba reabriéndolo con el motor de OtroCAD antes de descargarlo. Si el convertidor no admite una entidad, utiliza DXF.</p>',
 '<p id="csResult" class="cs-result" role="status" aria-live="polite"></p></div>',
 '<div class="cs-actions"><button id="csCancel" type="button">Cancelar</button>',
 '<button id="csSave" type="button">Guardar archivo</button></div>'
].join('');
document.body.append(dialog);
const $=id=>dialog.querySelector('#'+id);
const result=$('csResult'),name=$('csName'),type=$('csFormat'),submit=$('csSave');
const show=()=>typeof dialog.showModal==='function'?dialog.showModal():dialog.setAttribute('open','');
const close=()=>typeof dialog.close==='function'?dialog.close():dialog.removeAttribute('open');
$('csClose').onclick=close;$('csCancel').onclick=close;
function open(f='dwg'){
 if(busy)return;
 format=['dwg','dxf','json'].includes(f)?f:'dwg';
 type.value=format;name.value=(core.filename()||'OtroCAD-Proyecto').replace(/\.(dwg|dxf|json)$/i,'');
 result.textContent='';
 if(!dialog.open)show();
 name.focus();name.select();
}
submit.onclick=async()=>{
 if(busy)return;
 busy=true;submit.disabled=true;submit.textContent='Validando y guardando…';result.textContent='';
 try{
  const outcome=await core.saveAs(type.value,name.value);
  if(outcome?.cancelled){result.textContent='Guardado cancelado; el plano no se modificó.';return}
  result.textContent='Guardado: '+outcome.filename+(outcome.mode==='download'?' · revisa Descargas':'');
  setTimeout(close,550);
 }catch(error){result.textContent='No se guardó el archivo: '+String(error.message||error)}
 finally{busy=false;submit.disabled=false;submit.textContent='Guardar archivo'}
};
name.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submit.click()}};
if(btnSave)btnSave.title='Guardar archivo DWG / DXF; Ctrl+S';
if(btnAs)btnAs.onclick=()=>open('dwg');
if(btnLocal)btnLocal.onclick=()=>{
 const ok=core.saveLocal();
 updateCurrent(ok?'Progreso guardado localmente':'No se pudo guardar el respaldo local');
};
const notice=document.createElement('span');notice.id='cadSaveProgress';
notice.className='cad-save-progress';notice.textContent='Autoguardado activo';
notice.title='Los cambios se guardan en el navegador; se conservan puntos recuperables de progreso.';
const footer=document.getElementById('statusbar');if(footer)footer.append(notice);
let currentName=core.filename()||null;
function updateCurrent(value){
 if(value?.includes('.dwg')||value?.includes('.dxf')||value?.includes('.json'))currentName=value;
 notice.textContent=currentName?'Archivo: '+currentName:'Progreso local protegido';
 notice.title='Guardado progresivo en navegador. Guarda DWG/DXF para tener una copia en archivos.';
}
function updateProgress(stamp){
 if(!currentName){
  const t=new Date(stamp);
  notice.textContent='Autoguardado '+t.toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'});
 }
}
const recovery=document.createElement('dialog');recovery.id='cadProgressRecovery';recovery.className='cad-save-dialog';
recovery.innerHTML=[
 '<div class="cs-head"><strong>HISTORIAL DE PROGRESO</strong><button id="csRecClose" type="button" aria-label="Cerrar">×</button></div>',
 '<div class="cs-body"><p>OtroCAD protege los cambios en el dispositivo. Los puntos automáticos no reemplazan las copias DWG, DXF o el respaldo editable.</p>',
 '<p id="csRecLatest">Buscando última copia…</p><p id="csRecPrevious">Buscando copia anterior…</p>',
 '<p id="csRecMessage" class="cs-result" role="status"></p></div>',
 '<div class="cs-actions"><button type="button" id="csRestorePrev">Recuperar anterior</button>',
 '<button type="button" id="csRestoreLast">Recuperar última</button></div>'
].join('');
document.body.append(recovery);
const $r=id=>recovery.querySelector('#'+id);
$r('csRecClose').onclick=()=>recovery.close();
async function openRecovery(){
 const dates=await core.getProgressDates();
 $r('csRecLatest').textContent=dates[0]?'Última: '+new Date(dates[0]).toLocaleString('es-EC'):'Última: no disponible';
 $r('csRecPrevious').textContent=dates[1]?'Anterior: '+new Date(dates[1]).toLocaleString('es-EC'):'Anterior: no disponible';
 $r('csRestoreLast').disabled=!dates[0];$r('csRestorePrev').disabled=!dates[1];
 $r('csRecMessage').textContent='';
 if(!recovery.open)recovery.showModal();
}
async function restore(slot){
 if(!confirm('Se protegerá primero el dibujo abierto y después se restaurará el progreso seleccionado. ¿Continuar?'))return;
 try{
  const data=await core.restoreProgress(slot);
  $r('csRecMessage').textContent='Recuperados '+data.count+' objetos CAD. El dibujo actual quedó respaldado.';
  updateCurrent('Progreso restaurado');recovery.close();
 }catch(error){$r('csRecMessage').textContent=String(error.message||error)}
}
$r('csRestoreLast').onclick=()=>restore('autosave-latest');
$r('csRestorePrev').onclick=()=>restore('autosave-previous');
if(btnRecovery)btnRecovery.onclick=openRecovery;
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='s'){
  event.preventDefault();event.stopImmediatePropagation();open('dwg');
 }
},true);
window.OtroCadSaveUI={open,openRecovery,updateProgress,updateCurrent};
})();
