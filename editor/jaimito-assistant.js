/* OtroCAD Civil 3D · Ing. Jaimito. Works offline; optional generative backend. */
(()=>{
'use strict';
if(window.OtroCadJaimito)return;
const tabs=document.getElementById('tabs'),stage=document.getElementById('stage'),cmds=window.OtroCadCivilCommands;
if(!tabs||!stage||!cmds)return;
const $=id=>document.getElementById(id);
const key='otrocad-jaimito-v1';
const tools=[
 ['C3DPOINTS','Importar puntos'],['C3DTIN','Crear TIN'],
 ['C3DCONTOURS','Curvas de nivel'],['C3DSLOPE','Pendientes'],
 ['C3DPROFILE','Perfil longitudinal'],['C3DSECTION','Sección transversal'],
 ['C3DVOLUME','Corte / relleno'],['C3DEXPORTTIN','Exportar LandXML'],['C3DGEO','Geolocalización']
];
const rules=[
 [/geolocal|cartograf|utm|satelit|satélit|mapa vial|geomap|ecuador|gal[aá]pagos/i,'C3DGEO','Usa Ver Ecuador para la vista general del país; en Geolocalización también tienes Galápagos. Para ubicar un plano, selecciona la zona WGS84 / UTM y el hemisferio e ingresa sus coordenadas reales. Puedes vincular un origen local sin mover las entidades. El mapa necesita conexión.'],
 [/landxml|exportar|xml/i,'C3DEXPORTTIN','Exporta la superficie TIN a LandXML 1.2. Primero crea el terreno; el archivo contiene vértices y caras, no objetos de diseño dinámicos.'],
 [/csv|xyz|puntos|importar|levantamiento/i,'C3DPOINTS','Importa puntos X, Y, Z desde CSV, TXT, XYZ o LandXML. Necesitas al menos tres puntos no colineales. Comprueba cotas y unidades.'],
 [/triangul|superficie|tin|delaunay/i,'C3DTIN','Crea una TIN después de importar puntos XYZ. La triangulación disponible admite hasta 1.800 puntos; divide levantamientos mayores en sectores.'],
 [/curvas?|contorno|equidistancia/i,'C3DCONTOURS','Primero crea una TIN. Luego establece un intervalo de elevación apropiado en Curvas de nivel (por ejemplo 1 o 5 unidades).'],
 [/pendiente|talud|inclinaci[oó]n/i,'C3DSLOPE','El mapa clasifica las pendientes de la superficie TIN; no calcula rasantes de diseño ni verifica normas de carreteras.'],
 [/perfil|longitudinal|rasante/i,'C3DPROFILE','Genera una TIN y selecciona una línea o polilínea como alineamiento. El perfil es un gráfico de análisis, no una rasante paramétrica.'],
 [/secci[oó]n|transversal|abscisa|progresiva/i,'C3DSECTION','Necesitas TIN y alineamiento. Indica la progresiva y anchura del corte para obtener una sección de terreno.'],
 [/volumen|cubicaci[oó]n|corte|relleno/i,'C3DVOLUME','La herramienta estima corte/relleno respecto a una cota horizontal, no entre dos superficies de diseño. Comprueba cuidadosamente las unidades.'],
 [/layout|hoja|imprimir|plot|escala|presentaci[oó]n/i,null,'El Layout de CAD y Civil es compartido. Usa Página (PAGESETUP) para papel y ploteo, y Ventanas (MVIEW) para ubicación y escala 1:N.'],
 [/ayuda|herramienta|comando|puedes|asistente/i,null,'Te ayudo a importar puntos, crear TIN, curvas, pendientes, perfiles, secciones, calcular volúmenes y exportar LandXML. Pregunta por una herramienta.']
];
const root=document.createElement('div');
root.id='jaimitoAssistant';root.className='jaimito-root';root.hidden=true;
root.innerHTML=[
 '<button id="jaimitoAvatarButton" class="jaimito-mascot" type="button" aria-label="Abrir Ing. Jaimito" aria-expanded="false" aria-controls="jaimitoPanel">',
 '<img id="jaimitoAvatar" alt="Ing. Jaimito, ingeniero con casco y planos" draggable="false">',
 '<span class="jaimito-mascot-tag">Ing. Jaimito <b>IA</b></span></button>',
 '<section id="jaimitoPanel" class="jaimito-chat" aria-label="Ing. Jaimito, asistente Civil 3D" hidden>',
 '<div class="jaimito-head"><div><strong>👷 Ing. Jaimito IA</strong><small id="jaimitoMode">Guía técnica local</small></div>',
 '<button id="jaimitoMinimize" type="button" aria-label="Minimizar">−</button>',
 '<button id="jaimitoClose" type="button" aria-label="Cerrar">×</button></div>',
 '<div id="jaimitoMessages" class="jaimito-messages" role="log" aria-live="polite"></div>',
 '<div id="jaimitoTools" class="jaimito-tools" aria-label="Herramientas de Civil 3D"></div>',
 '<form id="jaimitoForm" class="jaimito-form"><input id="jaimitoQuestion" aria-label="Tu pregunta" autocomplete="off" maxlength="700" placeholder="Pregunta sobre Civil 3D…">',
 '<button id="jaimitoSend" type="submit">Enviar</button></form>',
 '<p class="jaimito-note">Verifica los cálculos y medidas antes de construir.</p></section>'
].join('');
document.body.append(root);
const avatar=$('jaimitoAvatar'),avatarButton=$('jaimitoAvatarButton'),panel=$('jaimitoPanel'),messages=$('jaimitoMessages');
avatar.src=window.OtroCadJaimitoAvatar||'assets/ing-jaimito-hd.webp';
avatar.addEventListener('error',()=>{if(!avatar.dataset.fallback){avatar.dataset.fallback='1';avatar.src='../icon-192.png'}});
let opened=false,hiddenByUser=false,busy=false;
try{hiddenByUser=!!JSON.parse(localStorage.getItem(key)||'{}').hidden}catch(_){}
function persist(){try{localStorage.setItem(key,JSON.stringify({hidden:hiddenByUser}))}catch(_){}}
const civilActive=()=>{
 const civil=tabs.querySelector('[data-tab="civil"]');
 return !!civil&&civil.classList.contains('active')&&civil.getAttribute('aria-selected')==='true';
};
function hidePanel(){opened=false;panel.hidden=true;avatarButton.setAttribute('aria-expanded','false')}
function positionAssistant(){
 // Anchor above the actual CAD controls, including the expanded phone command bar.
 const area=stage.getBoundingClientRect?.();
 if(!area||!window.innerHeight)return;
 let edge=area.bottom;
 for(const id of ['layoutBar','commandbar','statusbar']){
  const rect=$(id)?.getBoundingClientRect?.();
  if(rect?.height&&rect.top>=area.top)edge=Math.min(edge,rect.top);
 }
 root.style.setProperty('--jaimito-bottom',Math.max(8,window.innerHeight-edge+8)+'px');
 root.style.setProperty('--jaimito-room',Math.max(150,edge-area.top-16)+'px');
}
function sync(){
 const active=civilActive();root.hidden=!active||hiddenByUser;
 ribbon.hidden=!active;
 positionAssistant();
 if(!active)hidePanel();
}
function message(role,value){
 const el=document.createElement('div');el.className='jaimito-message '+role;
 const name=document.createElement('strong');name.textContent=role==='user'?'Tú':'Ing. Jaimito';
 const text=document.createElement('p');text.textContent=value;el.append(name,text);messages.append(el);
 messages.scrollTop=messages.scrollHeight;
}
function openPanel(){
 hiddenByUser=false;persist();sync();if(!civilActive())return;
 opened=true;panel.hidden=false;avatarButton.setAttribute('aria-expanded','true');
 if(!messages.children.length)message('bot','¡Hola! Soy el Ing. Jaimito. Te ayudo con puntos XYZ, superficies TIN, curvas de nivel, pendientes, perfiles, secciones y volúmenes. ¿Qué necesitas?');
}
avatarButton.addEventListener('click',()=>opened?hidePanel():openPanel());
$('jaimitoMinimize').addEventListener('click',hidePanel);
$('jaimitoClose').addEventListener('click',hidePanel);
const ribbon=document.createElement('button');
ribbon.id='jaimitoRibbon';ribbon.type='button';ribbon.textContent='👷 Jaimito IA';
ribbon.title='Abrir Ing. Jaimito, asistente de Civil 3D';ribbon.hidden=true;
ribbon.addEventListener('click',()=>{openPanel();$('jaimitoQuestion').focus({preventScroll:true})});
tabs.append(ribbon);
function summary(){
 const api=window.OtroCadCivilAPI;let objects=[];
 try{objects=api?.getObjects?.()||[]}catch(_){}
 return {unidades:api?.getUnits?.()||'m',entidades:objects.length,
  puntos:objects.filter(o=>o&&o.type==='point'&&Number.isFinite(Number(o.z))).length,
  carasTin:objects.filter(o=>o?.civilTin).length,
  curvas:objects.filter(o=>o?.civilContour).length,
  alineamiento:objects.some(o=>o?.civilAlignment)};
}
function execute(name){
 const fn=cmds?.[name];
 if(typeof fn!=='function'){message('bot','Herramienta no disponible en esta versión.');return false}
 try{
  const out=fn();
  if(out&&typeof out.then==='function')out.catch(error=>message('bot','Error: '+String(error?.message||error)));
  message('bot','Herramienta «'+(tools.find(t=>t[0]===name)?.[1]||name)+'» iniciada. Sigue las indicaciones del editor.');
  return true;
 }catch(error){message('bot','No se pudo iniciar: '+String(error?.message||error));return false}
}
for(const [command,title] of tools){
 const button=document.createElement('button');button.type='button';button.textContent=title;
 button.dataset.command=command;button.addEventListener('click',()=>execute(command));
 $('jaimitoTools').append(button);
}
function localReply(question){
 if(/estado|resumen|cu[aá]ntos|datos del plano/i.test(question)){
  const s=summary();
  return {answer:'El dibujo tiene '+s.entidades+' entidades, '+s.puntos+' puntos XYZ, '+s.carasTin+' caras TIN y '+s.curvas+' curvas. Alineamiento: '+(s.alineamiento?'sí':'no')+'. Unidades: '+s.unidades+'.',command:null};
 }
 const found=rules.find(entry=>entry[0].test(question));
 return found?{answer:found[2],command:found[1]}:{answer:'Puedes preguntarme cómo importar puntos, crear una TIN, generar curvas, perfiles y secciones, o calcular volúmenes. También puedo abrir esas herramientas.',command:null};
}
function endpoint(){
 const raw=window.OTROCAD_JAIMITO_AI_ENDPOINT;
 if(typeof raw!=='string'||!raw)return null;
 try{
  const u=new URL(raw,location.href);
  return u.protocol==='https:'||u.origin===location.origin?u:null;
 }catch(_){return null}
}
const url=endpoint();
const browserAI=typeof window.LanguageModel?.create==='function';
$('jaimitoMode').textContent=url?'IA conectada mediante servidor':browserAI?'IA del navegador · experimental':'Guía técnica inteligente · sin IA generativa';
async function generativeReply(question){
 const context=summary();
 const system='Eres Ing. Jaimito, asistente técnico del módulo Civil 3D de OtroCAD. Responde en español, de forma breve, y sé preciso. OtroCAD tiene TIN, curvas, pendiente, perfiles y secciones de análisis y corte/relleno contra cota; no es Autodesk Civil 3D completo. Nunca inventes cálculos.';
 if(url){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const res=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:question,context,instructions:system}),signal:controller.signal});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();if(typeof data?.answer!=='string')throw Error('Respuesta inválida');
   return data.answer.slice(0,1800);
  }finally{clearTimeout(timeout)}
 }
 if(browserAI){
  const availability=await window.LanguageModel.availability?.();
  if(availability&&availability!=='available')throw Error('IA local no disponible');
  const instance=await window.LanguageModel.create({initialPrompts:[{role:'system',content:system+' Contexto: '+JSON.stringify(context)}]});
  try{return String(await instance.prompt(question)).slice(0,1800)}
  finally{instance.destroy?.()}
 }
 return null;
}
async function ask(value){
 const question=String(value||'').trim();if(!question||busy)return;
 busy=true;$('jaimitoSend').disabled=true;message('user',question);
 const reply=localReply(question);
 if(url||browserAI){
  try{message('bot',await generativeReply(question)||reply.answer)}
  catch(_){message('bot',reply.answer+' La IA generativa no está disponible; utilicé la guía local.')}
 }else message('bot',reply.answer);
 if(reply.command){
  const action=document.createElement('button');action.type='button';action.className='jaimito-open-command';
  action.textContent='Abrir '+tools.find(t=>t[0]===reply.command)[1];
  action.addEventListener('click',()=>{action.disabled=true;execute(reply.command)});
  messages.append(action);messages.scrollTop=messages.scrollHeight;
 }
 busy=false;$('jaimitoSend').disabled=false;
}
$('jaimitoForm').addEventListener('submit',event=>{
 event.preventDefault();const input=$('jaimitoQuestion');const value=input.value.trim();if(!value)return;
 input.value='';ask(value);
});
tabs.addEventListener('click',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);
observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.addEventListener('pageshow',sync);
window.addEventListener('resize',positionAssistant);
if(typeof ResizeObserver==='function'){
 const sizeObserver=new ResizeObserver(positionAssistant);
 sizeObserver.observe(stage);
 if($('layoutBar'))sizeObserver.observe($('layoutBar'));
}
new MutationObserver(positionAssistant).observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&document.activeElement?.id!=='jaimitoQuestion')hidePanel()});
window.OtroCadJaimito={open:openPanel,close:hidePanel,ask,runTool:execute,sync,hide:()=>{hiddenByUser=true;persist();sync()}};
sync();
})();
