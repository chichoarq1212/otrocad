/* OtroCAD · Ing. Keeelvin · Asistente MEP / HVAC */
(()=>{
'use strict';
if(window.OtroCadKelvin||!window.OtroCadMep)return;
const tabs=document.getElementById('tabs'),mep=window.OtroCadMep,api=window.OtroCadCivilAPI;
if(!tabs||!api)return;
const $=id=>document.getElementById(id);
const choices=[
 ['supply','Ducto impulsión'],['return','Ducto retorno'],
 ['extract','Extracción de aire'],['refrigerant','Refrigerante'],
 ['condensate','Condensados'],['cold','Agua potable fría'],
 ['hot','Agua caliente'],['drain','Sanitaria'],
 ['vent','Ventilación sanitaria'],['rain','Aguas lluvias'],
 ['fire','Red contra incendios'],['electrical','Circuito eléctrico'],
 ['diffuser','Colocar difusor'],['grille','Colocar rejilla'],
 ['quantities','Cantidades de obra'],
 ['load','Cargas térmicas'],['coldroom','Cuartos fríos']
];
const help=[
 [/cuarto(s)? fr[ií]o(s)?|c[aá]mara(s)? frigor[ií]fica(s)?|refrigeraci[oó]n industrial|congelaci[oó]n/i,'coldroom','Abre Cuartos fríos para estimar transmisión, infiltración, producto, personal, desescarche y capacidad frigorífica. Podrás insertar una planta 2D editable. Los valores son orientativos.'],
 [/carga(s)? t[eé]rmica(s)?|ganancia(s)? de calor|btu\/h|tonelada(s)? de refrigeraci[oó]n/i,'load','Abre Cargas térmicas para calcular ganancias sensibles y latentes HVAC por envolvente, vidrio, ventilación y fuentes internas. Requiere datos de diseño y comprobación del proyectista.'],
 [/ducto|impulsi[oó]n|suministro|aire acondicionado/i,'supply','Para trazar impulsión, abre AIRE ACOND. y configura ancho, alto, caudal y etiqueta. El ducto conserva su geometría editable y sus cantidades.'],
 [/retorno|retornar/i,'return','Selecciona red de retorno de aire en el módulo HVAC, configura dimensiones y dibuja su polilínea eje.'],
 [/extracci[oó]n|extractor/i,'extract','Selecciona extracción y dibuja la ruta en planta. Los cálculos de pérdidas y selección del equipo aún requieren revisión profesional.'],
 [/refrigeran|cobre|split/i,'refrigerant','Traza línea de refrigerante, coloca accesorios y documenta el diámetro según diseño y fabricante.'],
 [/condensad/i,'condensate','Traza el drenaje de condensados, validando el recorrido y pendiente conforme al equipo.'],
 [/sanitari|desag[uü]e|alcantarill/i,'drain','Traza desagües sanitarios con DN y pendiente definidos por el proyectista. Verifica cotas y compatibilidad entre redes.'],
 [/pluvial|lluvia/i,'rain','Usa la capa Aguas lluvias. Los caudales y diámetros deben verificarse con cálculos hidrológicos.'],
 [/agua fr[ií]a|potable/i,'cold','Abre la red de agua fría; define diámetro, etiqueta y recorrido. Verifica presión y pérdidas de carga.'],
 [/agua caliente/i,'hot','Para agua caliente, usa su capa independiente y registra diámetro, aislamiento y accesorios.'],
 [/difusor/i,'diffuser','Coloca difusores desde el catálogo HVAC; comprueba caudal, tiro y ubicación arquitectónica.'],
 [/rejilla|ret[ií]cula/i,'grille','Coloca rejillas de retorno y verifica dimensiones, ruido y pérdida de presión.'],
 [/incendio|rociador/i,'fire','La red contra incendios permite dibujar recorridos y accesorios. El dimensionamiento y normativa requieren cálculo especializado.'],
 [/electric|circuito|bandeja/i,'electrical','En MEP puedes dibujar circuitos y bandejas, asignando capas y etiquetas. El sistema aún no comprueba protecciones eléctricas.'],
 [/cantidad|metrados|listado|reporte/i,'quantities','Obtén un resumen de longitudes y símbolos colocados; verifica que el plano esté completo antes de estimar cantidades.']
];
const root=document.createElement('div');root.id='kelvinAssistant';root.className='jaimito-root kelvin-root';
root.hidden=true;
root.innerHTML=[
 '<button id="kelvinMascot" class="jaimito-mascot kelvin-mascot" type="button" aria-label="Abrir asistente Ing. Keeelvin" aria-controls="kelvinPanel" aria-expanded="false">',
 '<img class="kelvin-portrait" src="assets/ing-kelvin.webp" alt="Ing. Keeelvin, casco blanco, chaleco amarillo y planos MEP" draggable="false">',
 '<span class="jaimito-mascot-tag">Ing. Keeelvin <b>IA</b></span></button>',
 '<section id="kelvinPanel" class="jaimito-chat" hidden aria-label="Asistente MEP HVAC">',
 '<div class="jaimito-head"><div><strong>🛠 Ing. Keeelvin IA</strong><small id="kelvinMode">Guía MEP local</small></div>',
 '<button id="kelvinMinimize" type="button" aria-label="Minimizar">−</button>',
 '<button id="kelvinClose" type="button" aria-label="Cerrar">×</button></div>',
 '<div id="kelvinMessages" class="jaimito-messages" role="log" aria-live="polite"></div>',
 '<div id="kelvinTools" class="jaimito-tools" aria-label="Herramientas MEP"></div>',
 '<form id="kelvinForm" class="jaimito-form"><input id="kelvinQuestion" maxlength="700" autocomplete="off" aria-label="Consulta MEP" placeholder="Consulta de ductos, aire o tuberías...">',
 '<button id="kelvinSend" type="submit">Enviar</button></form>',
 '<p class="jaimito-note">Las medidas, capacidades y normas deben ser verificadas por un ingeniero.</p>',
 '</section>'
].join('');
document.body.append(root);
const panel=$('kelvinPanel'),messages=$('kelvinMessages'),mascot=$('kelvinMascot');
let opened=false,busy=false;
const isActive=()=>!!document.querySelector('[data-tab="mep"].active,[data-tab="hvac"].active');
function close(){opened=false;panel.hidden=true;mascot.setAttribute('aria-expanded','false')}
function sync(){root.hidden=!isActive();trigger.hidden=!isActive();if(!isActive())close()}
function add(role,content){
 const box=document.createElement('div');box.className='jaimito-message '+role;
 const head=document.createElement('strong');head.textContent=role==='user'?'Tú':'Ing. Keeelvin';
 const body=document.createElement('p');body.textContent=String(content);
 box.append(head,body);messages.append(box);messages.scrollTop=messages.scrollHeight;
}
function open(){
 if(!isActive())return;
 opened=true;panel.hidden=false;mascot.setAttribute('aria-expanded','true');
 if(!messages.children.length)add('bot','¡Hola! Soy el Ing. Keeelvin. Te apoyo en MEP, HVAC, cargas térmicas, cuartos fríos, agua potable, sanitaria y desagües. ¿Qué trazamos?');
}
mascot.onclick=()=>opened?close():open();
$('kelvinMinimize').onclick=close;$('kelvinClose').onclick=close;
const trigger=document.createElement('button');trigger.type='button';trigger.id='kelvinRibbon';
trigger.textContent='🛠 Keeelvin IA';trigger.title='Asistente virtual MEP';trigger.hidden=true;
trigger.onclick=()=>{open();$('kelvinQuestion').focus({preventScroll:true})};tabs.append(trigger);
function run(kind){
 try{
  if(kind==='quantities')mep.showQuantities();
  else if(kind==='load'||kind==='coldroom'){
   const dialog=window.OtroCadThermalUI;
   if(!dialog)throw Error('Calculadora térmica no disponible.');
   dialog.open(kind==='coldroom'?'cold':'hvac');
  }
  else if(kind==='diffuser'||kind==='grille')mep.beginSymbol(kind,kind==='diffuser'?'supply':'return');
  else mep.chooseSystem(kind);
  add('bot',kind==='quantities'?'He abierto las cantidades del proyecto.':'Herramienta «'+(choices.find(x=>x[0]===kind)?.[1]||kind)+'» lista. Traza en el Modelo y configura propiedades en la barra MEP.');
  return true;
 }catch(error){add('bot','No se pudo iniciar: '+String(error.message||error));return false}
}
for(const [key,label] of choices){
 const btn=document.createElement('button');btn.type='button';btn.textContent=label;
 btn.dataset.system=key;btn.onclick=()=>run(key);$('kelvinTools').append(btn);
}
const local=question=>{
 const found=help.find(([regex])=>regex.test(question));
 if(found)return {text:found[2],command:found[1]};
 const data=mep.getQuantities?.()||[];
 return {text:'En OtroCAD puedes dibujar ductos, equipos de aire, tuberías sanitarias y redes MEP. El modelo contiene '+data.length+' grupos de cantidades. Consulta por una red para abrir su herramienta.',command:null};
};
const endpoint=()=>{
 const raw=window.OTROCAD_KELVIN_AI_ENDPOINT;
 if(typeof raw!=='string'||!raw)return null;
 try{const url=new URL(raw,location.href);return url.protocol==='https:'||url.origin===location.origin?url:null}
 catch(_){return null}
};
const url=endpoint(),browserAI=typeof window.LanguageModel?.create==='function';
$('kelvinMode').textContent=url?'IA remota configurable':browserAI?'IA local experimental':'Guía técnica local · sin IA generativa';
async function generate(question){
 const context={units:api.getUnits(),quantities:mep.getQuantities?.().slice(0,30)||[]};
 const instructions='Eres Ing. Keeelvin, asistente MEP/HVAC de OtroCAD. Responde en español conciso. No inventes cálculos de caudales, carga térmica, pérdidas, normativa ni instalaciones que no existen. El software es un editor CAD experimental con sistemas y símbolos MEP editables.';
 if(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:question,context,instructions}),signal:controller.signal});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();if(typeof data?.answer!=='string')throw Error('Respuesta inválida');
   return data.answer.slice(0,1600);
  }finally{clearTimeout(timer)}
 }
 if(browserAI){
  const session=await window.LanguageModel.create({initialPrompts:[{role:'system',content:instructions+' Contexto: '+JSON.stringify(context)}]});
  try{return String(await session.prompt(question)).slice(0,1600)}
  finally{session.destroy?.()}
 }
 return null;
}
async function ask(value){
 const question=String(value||'').trim();if(!question||busy)return;
 busy=true;$('kelvinSend').disabled=true;add('user',question);
 const answer=local(question);
 if(url||browserAI){
  try{add('bot',await generate(question)||answer.text)}
  catch(_){add('bot',answer.text+' La IA generativa no respondió; utilicé la guía local.')}
 }else add('bot',answer.text);
 if(answer.command){
  const btn=document.createElement('button');btn.type='button';btn.textContent='Abrir '+choices.find(x=>x[0]===answer.command)[1];btn.className='jaimito-open-command';
  btn.onclick=()=>{btn.disabled=true;run(answer.command)};messages.append(btn)
 }
 busy=false;$('kelvinSend').disabled=false;
}
$('kelvinForm').addEventListener('submit',event=>{event.preventDefault();
 const input=$('kelvinQuestion');const value=input.value.trim();input.value='';ask(value)
});
tabs.addEventListener('click',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.addEventListener('pageshow',sync);
window.OtroCadKelvin={open,close,run,ask,sync};sync();
})();
