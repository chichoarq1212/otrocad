/* El Arqui IA · assistant for architecture and CAD Dibujo only.
 * Phase 1: offline validated concept plans, preview/approval and real progressive CAD.
 * Optional secure AI endpoint may propose dimensions but cannot execute arbitrary code.
 */
(()=>{
'use strict';
if(window.OtroCadArqui)return;
const planner=window.OtroCadArquiPlanner,professional=window.OtroCadArquiProfessional,refs=window.OtroCadArquiReferences,
 api=window.OtroCadCivilAPI,tabs=document.getElementById('tabs');
if(!planner||!professional||!api||!tabs)return;
const $=id=>document.getElementById(id);
const allowed=new Set(['draw','modify','annotate','blocks','layers','view']);
let plan=null,previewEntities=[],spec=planner.parsePrompt('Vivienda de 1 planta en un terreno 12x20 con 3 dormitorios y garaje');
let projectId=api.getObjects().filter(x=>x.aiArchitect&&x.aiProjectId).at(-1)?.aiProjectId||null;
let activeStream=null,busy=false,pending=false,lastModelKey=null,baseline=null;
const conversation=[];
let draftTimer=null,draftDirty=false;
const root=document.createElement('div');root.id='arquiAssistant';root.className='jaimito-root arqui-root';root.hidden=true;
root.innerHTML=[
 '<button id="arquiMascot" class="jaimito-mascot arqui-mascot" type="button" aria-label="Abrir El Arqui IA" aria-controls="arquiPanel" aria-expanded="false">',
 '<img id="arquiPortrait" class="arqui-portrait" src="assets/el-arqui.webp" draggable="false" alt="El Arqui IA, arquitecto con planos, camisa negra y bigote">',
 '<span class="jaimito-mascot-tag">El Arqui <b>IA</b></span></button>',
 '<section id="arquiPanel" class="arqui-panel" aria-label="El Arqui IA · Diseño arquitectónico" hidden>',
 '<header class="arqui-head"><div><strong>📐 El Arqui IA</strong><small id="arquiMode">Motor arquitectónico local · diseño conceptual</small></div>',
 '<button type="button" id="arquiClose" title="Minimizar" aria-label="Minimizar">−</button></header>',
 '<div class="arqui-tabs" role="tablist"><button id="arquiTabDesign" class="active" type="button" aria-selected="true">Diseñar</button>',
 '<button id="arquiTabLibrary" type="button" aria-selected="false">Biblioteca técnica</button></div>',
 '<div class="arqui-pane" id="arquiDesignPane">',
 '<p id="arquiCloudStatus" class="arqui-context arqui-cloud-status" role="status">IA automática · comprobando cupo gratuito…</p>',
 '<details id="arquiAiSettings" class="arqui-details" hidden><summary>Conexión avanzada (opcional)</summary>',
 '<div class="arqui-grid"><label>Servicio de IA<select id="arquiAiProvider">',
 '<option value="none">Sin conexión · motor CAD local</option>',
 '<option value="openrouter">OpenRouter · modelos gratuitos</option>',
 '<option value="gemini">Gemini · nivel gratuito</option>',
 '<option value="groq">Groq · cuenta personal</option>',
 '<option value="openai">OpenAI API · puede generar cargos</option></select></label>',
 '<label>Clave personal (solo en esta página)<input id="arquiAiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Pega tu clave API personal"></label></div>',
 '<p class="arqui-disclaimer">Tu clave no se guarda ni se envía a OtroCAD o Cloudflare: el navegador contacta directamente al proveedor elegido. No equivale a iniciar sesión en ChatGPT o Gemini. Usa una clave gratuita y limitada.</p>',
 '<p class="arqui-context"><button type="button" id="arquiAiLogin" hidden>Iniciar sesión con OpenRouter</button> <a id="arquiAiHelp" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">Obtener clave personal</a> · <button type="button" id="arquiAiClear">Desconectar</button></p>',
 '<p id="arquiAiState" class="arqui-context" role="status">Sin IA en línea conectada.</p></details>',
 '<div class="arqui-chat" id="arquiMessages" role="log" aria-live="polite"></div>',
 '<form id="arquiForm" class="arqui-form"><label for="arquiPrompt">¿Qué deseas diseñar o modificar?</label>',
 '<textarea id="arquiPrompt" rows="4" maxlength="2200" placeholder="Quiero una casa de 12 por 20 con tres dormitorios y dos baños. Después: amplía la cocina 50 cm."></textarea>',
 '<div class="arqui-preview-title"><strong>Vista previa mientras escribes</strong><small id="arquiSummary" role="status"></small></div>',
 '<svg id="arquiPreview" viewBox="0 0 360 225" role="img" aria-label="Vista previa local provisional del anteproyecto"></svg>',
 '<button id="arquiPropose" type="submit">Proponer / actualizar diseño</button></form>',
 '<div class="arqui-examples" aria-label="Ejemplos de pedidos"><button id="arquiExampleHome" type="button">Casa de 12 × 20</button><button id="arquiExampleEdit" type="button">Ampliar cocina</button><button id="arquiExampleRules" type="button">Revisar criterios</button></div>',
 '<p id="arquiContext" class="arqui-context">Describe tu idea. Las medidas que falten se mostrarán como supuestos editables.</p>',
 '<details id="arquiDetails" class="arqui-details" hidden><summary>Ajustar medidas de esta propuesta</summary>',
 '<div class="arqui-grid">',
 '<label>Terreno ancho (m)<input id="arquiLotW" type="number" min="8" max="60" step=".1" value="12"></label>',
 '<label>Terreno fondo (m)<input id="arquiLotD" type="number" min="5" max="80" step=".1" value="20"></label>',
 '<label>Plantas<select id="arquiFloors"><option value="1">1 planta</option><option value="2">2 plantas</option></select></label>',
 '<label>Dormitorios<select id="arquiBeds"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>',
 '<label>Baños<select id="arquiBaths"><option value="0">Propuesta del motor</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>',
 '<label class="arqui-checkbox"><input id="arquiAccessible" type="checkbox"> Criterio accesible</label>',
 '<label class="arqui-checkbox"><input id="arquiGarage" type="checkbox" checked> Garaje / parqueo</label>',
 '<label>Plazas de parqueo<select id="arquiGarageCount"><option value="1">1 auto</option><option value="2">2 autos (tándem si cabe)</option></select></label>',
 '<label>Retiro frontal (m)<input id="arquiSetFront" type="number" min="0" max="12" step=".1" value="3"></label>',
 '<label>Retiro posterior (m)<input id="arquiSetBack" type="number" min="0" max="12" step=".1" value="2"></label>',
 '<label>Retiro lateral (m)<input id="arquiSetSide" type="number" min="0" max="5" step=".1" value=".45"></label>',
 '<label>Muro exterior (cm)<input id="arquiWallOuter" type="number" min="10" max="45" step="1" value="20"></label>',
 '<label>Muro interior (cm)<input id="arquiWallInner" type="number" min="7" max="35" step="1" value="15"></label>',
 '<label>Presentación<select id="arquiStyle"><option value="concurso">Concurso · amueblado</option><option value="profesional">Profesional · técnico</option><option value="esquematico">Esquemático</option></select></label>',
 '<label class="arqui-checkbox"><input id="arquiFurniture" type="checkbox" checked> Dibujar mobiliario</label>',
 '<label class="arqui-checkbox"><input id="arquiWallHatch" type="checkbox" checked> Hatch de muros</label>',
 '<label class="arqui-checkbox"><input id="arquiDimensions" type="checkbox" checked> Cotas interiores y exteriores</label>',
 '<label>Origen X (modelo)<input id="arquiOriginX" type="number" step="any" value="0"></label>',
 '<label>Origen Y (modelo)<input id="arquiOriginY" type="number" step="any" value="0"></label>',
 '</div></details>',
 '<div id="arquiWarnings" class="arqui-warnings" role="status"></div>',
 '<p id="arquiProgress" class="arqui-progress" role="status"></p>',
 '<div class="arqui-actions"><button id="arquiRecheck" type="button">Revisar diseño</button>',
 '<button id="arquiDraw" type="button">Dibujar plano completo en CAD</button>',
 '<button id="arquiStop" type="button" hidden>Cancelar dibujo</button>',
 '<button id="arquiErase" type="button">Retirar diseño IA</button></div>',
 '<p class="arqui-disclaimer">Anteproyecto editable, no plano aprobado. Revisar normativa municipal, accesibilidad, estructura, ventilación y seguridad. Referencias y alcance de cada comprobación en Biblioteca técnica.</p>',
 '</div>',
 '<div class="arqui-pane" id="arquiLibraryPane" hidden>',
 '<h4>Referencias de diseño y normativa</h4>',
 '<p>Ya hay fichas públicas de Plazola y Neufert y reglas seleccionadas de NEC-HS-AU 2019. Cada fuente indica qué se consultó. Puedes ampliar la consulta con extractos TXT/MD.</p>',
 '<div id="arquiBuiltinSources" class="arqui-builtin-sources"></div>',
 '<label>Fuente<select id="arquiSource"><option value="Neufert">Neufert</option><option value="Plazola">Plazola</option><option value="Otra fuente">Otra fuente</option></select></label>',
 '<label>Extracto de texto<input type="file" id="arquiReferenceFile" accept=".txt,.md,text/plain,text/markdown"></label>',
 '<div id="arquiSourceList" class="arqui-source-list"></div>',
 '<label class="arqui-checkbox"><input type="checkbox" id="arquiSendExcerpts"> Autorizar envío de pasajes seleccionados al servicio IA configurado (si existe)</label>',
 '<p class="arqui-disclaimer">Los PDF grandes requieren indexación por capítulos en un servicio autorizado. No se copian libros al repositorio ni se presupone conformidad con una edición o norma.</p>',
 '</div></section>'
].join('');
document.body.append(root);
const avatar=$('arquiMascot'),panel=$('arquiPanel'),chat=$('arquiMessages');
const toolbar=document.createElement('button');toolbar.id='arquiRibbon';toolbar.type='button';
toolbar.textContent='📐 El Arqui IA';toolbar.title='Diseñar plantas arquitectónicas editables por instrucciones';
toolbar.hidden=true;toolbar.onclick=()=>open();tabs.append(toolbar);
function visible(){const tab=tabs.querySelector('[data-tab].active');return !!tab&&allowed.has(tab.dataset.tab)}
function sync(){const state=visible();root.hidden=!state;toolbar.hidden=!state;if(!state)close()}
function open(){if(!visible())return;root.hidden=false;panel.hidden=false;avatar.setAttribute('aria-expanded','true');
 restoreModel();
 if(!chat.childElementCount)message('bot','¡Cuéntame tu proyecto como lo hablarías con otro arquitecto! Basta con contarme tu idea y el terreno. Propondré lo que falte y lo verás como supuesto; luego puedes pedirme cambios sobre esta propuesta. Te prepararé un anteproyecto amueblado con muros de espesor real, puertas, ventanas, hatch y cotas, listo para editar en CAD. Si algo no cabe, te explicaré por qué en vez de inventarlo.');}
function close(){panel.hidden=true;avatar.setAttribute('aria-expanded','false')}
avatar.onclick=()=>panel.hidden?open():close();$('arquiClose').onclick=close;
tabs.addEventListener('click',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.addEventListener('pageshow',sync);
const userBridge=window.OtroCadUserAI,oauthBridge=window.OtroCadArquiOAuth;
const aiSelect=$('arquiAiProvider'),aiKey=$('arquiAiKey');
const endpoint=(()=>{
 // Same-origin automatic service: no user registration and no API key.
 const raw=window.OTROCAD_ARQUI_AI_ENDPOINT||(location.hostname?.endsWith('.github.io')?'':new URL('/api/arqui',location.href).href);
 if(typeof raw!=='string'||!raw)return null;
 try{const url=new URL(raw,location.href);return url.protocol==='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1'?url:null}
 catch(_){return null}
})();
let autoEnabled=null;
async function refreshAutoStatus(known=null){
 const node=$('arquiCloudStatus');
 if(!endpoint||typeof fetch!=='function'){
  autoEnabled=false;
  node.textContent='IA gratuita no configurada · diseño CAD local disponible';
  $('arquiMode').textContent='IA gratuita no activada · CAD local';
  return;
 }
 try{
  const data=known||await fetch(new URL('/api/arqui/status',endpoint),{cache:'no-store'}).then(res=>{
   if(!res.ok)throw Error('status no disponible');return res.json()
  });
  autoEnabled=!!data.online;
  if(!autoEnabled){
   node.textContent='IA gratuita pendiente de activar · el CAD local funciona sin conexión';
   $('arquiMode').textContent='IA automática pendiente · CAD local';
   return;
  }
  const remaining=Math.max(0,Number(data.remaining||0));
  const total=Math.max(1,Number(data.limit||2));
  const globalLeft=Math.max(0,Number(data.globalRemaining||0));
  const usable=Math.min(remaining,globalLeft);
  node.textContent=usable>0?
   'IA automática gratuita · '+usable+' de '+total+' consultas disponibles hoy':
   'IA gratuita: cupo agotado por hoy · CAD local disponible';
  $('arquiMode').textContent=usable>0?'IA automática · sin registro':'Cupo IA agotado · CAD local';
 }catch(_){
  autoEnabled=false;
  node.textContent='IA gratuita temporalmente no disponible · CAD local disponible';
  $('arquiMode').textContent='IA automática no disponible · CAD local';
 }
}
if(typeof fetch==='function')refreshAutoStatus();
function updateAiConnection(){
 const provider=aiSelect.value,help=$('arquiAiHelp');
 $('arquiAiLogin').hidden=provider!=='openrouter'||!oauthBridge;
 const known=userBridge?.providers?.[provider];
 if(provider==='none'){
  help.href='https://openrouter.ai/settings/keys';help.textContent='¿Cómo obtener una clave gratuita?';
  $('arquiAiState').textContent='Sin conexión externa; el motor de dibujo sigue disponible.';
  $('arquiMode').textContent='IA generativa no conectada · CAD local';
  return;
 }
 if(!known){$('arquiAiState').textContent='Proveedor no disponible.';return}
 help.href=known.help;help.textContent='Crear mi clave en '+known.label;
 const active=!!aiKey.value.trim();
 $('arquiAiState').textContent=active?'Cuenta propia preparada · '+known.label+' (solo durante esta página)':
  'Falta pegar tu clave personal de '+known.label;
 $('arquiMode').textContent=active?'IA personal lista · '+known.label:'IA generativa no conectada · falta clave';
}
if(!aiSelect.value)aiSelect.value='none';
aiSelect.addEventListener('change',updateAiConnection);
aiKey.addEventListener('input',updateAiConnection);
$('arquiAiClear').onclick=()=>{aiKey.value='';aiSelect.value='none';updateAiConnection()};
// Dejar el panel avanzado oculto: una persona no necesita seleccionar proveedor.
updateAiConnection();
if(!aiSelect.value||aiSelect.value==='none')refreshAutoStatus();
$('arquiAiLogin').onclick=async()=>{
 if(!oauthBridge){message('bot','El inicio de sesión de OpenRouter no está disponible.');return}
 try{
  const cryptoApi=window.crypto||crypto;
  const target=await oauthBridge.begin(location.href,window.sessionStorage||sessionStorage,cryptoApi);
  window.location.assign(target);
 }catch(error){message('bot','No se pudo iniciar OpenRouter: '+String(error.message||error))}
};
if(oauthBridge&&oauthBridge.hasCallback(location.href)){
 (async()=>{
  try{
   const token=await oauthBridge.complete(location.href,window.sessionStorage||sessionStorage,fetch.bind(window));
   aiSelect.value='openrouter';aiKey.value=token;updateAiConnection();
   message('bot','Tu cuenta de OpenRouter está conectada. El Arqui utilizará solo modelos gratuitos mientras esta página permanezca abierta.');
  }catch(error){message('bot','No se completó la conexión OpenRouter: '+String(error.message||error))}
  finally{
   try{window.history.replaceState(null,'',oauthBridge.cleanedUrl(location.href))}catch(_){}
  }
 })();
}
function message(role,text){
 conversation.push({role:role==='user'?'user':'assistant',content:String(text).slice(0,2200)});
 while(conversation.length>12)conversation.shift();
 const item=document.createElement('div');item.className='arqui-msg '+role;
 const head=document.createElement('strong');head.textContent=role==='user'?'Tú':'El Arqui IA';
 const body=document.createElement('p');body.textContent=String(text);item.append(head,body);
 chat.append(item);chat.scrollTop=chat.scrollHeight;while(chat.childElementCount>14)chat.firstChild.remove();
}
function toInputs(s){
 $('arquiLotW').value=s.lotWidth;$('arquiLotD').value=s.lotDepth;
 $('arquiFloors').value=String(s.floors);$('arquiBeds').value=String(s.bedrooms);
 $('arquiGarage').checked=s.garage;$('arquiBaths').value=String(s.bathrooms);$('arquiAccessible').checked=s.accessible;
 $('arquiGarageCount').value=String(s.garageSpaces);
 $('arquiSetFront').value=String(s.frontSetback);
 $('arquiSetBack').value=String(s.backSetback);
 $('arquiSetSide').value=String(s.sideSetback);
 $('arquiWallOuter').value=String(Math.round(s.wallOuter*100));
 $('arquiWallInner').value=String(Math.round(s.wallInner*100));
 $('arquiStyle').value=s.style;
 $('arquiFurniture').checked=s.furniture;
 $('arquiWallHatch').checked=s.wallHatch;
 $('arquiDimensions').checked=s.dimensions;
}
function fromInputs(){
 return planner.validateSpec({...spec,lotWidth:$('arquiLotW').value,lotDepth:$('arquiLotD').value,
  bathrooms:$('arquiBaths').value,accessible:$('arquiAccessible').checked,
  floors:$('arquiFloors').value,bedrooms:$('arquiBeds').value,garage:$('arquiGarage').checked,
  garageSpaces:$('arquiGarageCount').value,
  frontSetback:$('arquiSetFront').value,backSetback:$('arquiSetBack').value,
  sideSetback:$('arquiSetSide').value,
  wallOuter:Number($('arquiWallOuter').value)/100,
  wallInner:Number($('arquiWallInner').value)/100,
  furniture:$('arquiFurniture').checked,
  wallHatch:$('arquiWallHatch').checked,dimensions:$('arquiDimensions').checked,
  style:$('arquiStyle').value});
}
function modelKey(marker){return marker.aiProjectId+JSON.stringify(marker.aiDesignSpec)+JSON.stringify(marker.aiDesignOrigin)}
function signature(items){
 let hash=2166136261;const text=JSON.stringify(items);
 for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
 return (hash>>>0).toString(16);
}
function restoreModel(){
 if(busy||pending)return;
 const objects=api.getObjects(),marker=objects.filter(x=>x.aiArchitect&&x.aiDesignSpec).at(-1);
 if(!marker){if(projectId&&!objects.some(x=>x.aiProjectId===projectId)){projectId=null;baseline=null;lastModelKey=null}return}
 const key=modelKey(marker);if(key===lastModelKey)return;
 try{
  const recovered=planner.validateSpec(marker.aiDesignSpec);
  const origin=marker.aiDesignOrigin||{x:0,y:0};
  $('arquiOriginX').value=origin.x;$('arquiOriginY').value=origin.y;
  projectId=marker.aiProjectId;lastModelKey=key;
  makePreview(recovered,false);$('arquiDetails').hidden=false;
  baseline=signature(professional.generate(planner.design(recovered),{origin,units:marker.aiDesignUnits||api.getUnits(),projectId}));
  $('arquiContext').textContent='Continuando el diseño guardado en este dibujo. Los pedidos modificarán esta propuesta.';
 }catch(_){message('bot','No pude recuperar el programa del diseño guardado. Revisa la propuesta antes de sustituirlo.')}
}
function renderPreview(){
 professional.preview(document,$('arquiPreview'),previewEntities);
}
function restoreAcceptedPreview(){
 if(previewEntities.length)renderPreview();
 if(plan){const rooms=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind!=='circulation').length,0);$('arquiSummary').textContent=plan.floors.length+' planta(s) · '+rooms+' espacios';}
 else $('arquiSummary').textContent='Sin propuesta activa';
}
function updateDraftPreview(){
 draftTimer=null;if(busy||pending)return;
 const text=$('arquiPrompt').value.trim();
 if(!text){draftDirty=false;restoreAcceptedPreview();$('arquiDraw').disabled=!plan||!previewEntities.length;$('arquiContext').textContent='Escribe tu idea para ver una vista previa local.';return}
 try{
  const interpreted=planner.interpret(text,fromInputs());
  if(interpreted.unsupported.length||!interpreted.canGenerate)throw Error('Aún no puedo representar esta indicación en la vista previa local.');
  const provisional=planner.design(interpreted.spec);
  const origin={x:Number($('arquiOriginX').value),y:Number($('arquiOriginY').value)};
  const shapes=professional.generate(provisional,{units:api.getUnits(),origin,projectId:'arqui-draft'});
  if(shapes.length>3300)throw Error('La propuesta supera el tamaño de vista previa.');
  professional.preview(document,$('arquiPreview'),shapes);
  $('arquiSummary').textContent='BORRADOR LOCAL · '+provisional.floors.length+' planta(s)';
  $('arquiContext').textContent='Vista provisional con lo reconocido localmente; puede omitir indicaciones. Pulsa Proponer para revisar antes de dibujar.';
 }catch(error){
  restoreAcceptedPreview();$('arquiSummary').textContent='Esperando una propuesta válida';
  $('arquiContext').textContent='Vista anterior conservada. '+String(error.message||error);
 }
}
$('arquiPrompt').addEventListener('input',()=>{
 if(draftTimer)clearTimeout(draftTimer);
 draftDirty=!!$('arquiPrompt').value.trim();
 $('arquiDraw').disabled=draftDirty||!plan||!previewEntities.length;
 if(!draftDirty){updateDraftPreview();return}
 $('arquiSummary').textContent='Preparando vista previa…';
 draftTimer=setTimeout(updateDraftPreview,350);
});
function displayIssues(){
 const output=$('arquiWarnings');output.replaceChildren();
 const warnings=plan?[...refs.review(plan).map(x=>x.message),...plan.audit.map(x=>x.message),...plan.warnings]:[];
 if(!warnings.length){output.textContent='Sin observaciones preliminares.';return}
 for(const warn of warnings){
  const item=document.createElement('p');item.textContent='• '+warn;output.append(item);
 }
}
function makePreview(next,announce=false){
 if(busy)return false;
 try{
  const proposed=planner.design(next);
  const origin={x:Number($('arquiOriginX').value),y:Number($('arquiOriginY').value)};
  if(!Number.isFinite(origin.x)||!Number.isFinite(origin.y))throw Error('El origen X/Y debe ser numérico.');
  const unit=api.getUnits();const shapes=professional.generate(proposed,{units:unit,origin,projectId:projectId||'arqui-preview'});
  if(shapes.length>3300)throw Error('El programa genera demasiados objetos para el editor.');
  plan=proposed;previewEntities=shapes;spec=proposed.spec;
  toInputs(spec);renderPreview();displayIssues();
  if(announce){$('arquiDetails').hidden=false;$('arquiContext').textContent='Propuesta activa · los próximos pedidos parten de estas medidas. Retiros y programa pendientes de validar para el predio.';}
  $('arquiDraw').disabled=false;
  const rooms=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind!=='circulation').length,0);
  $('arquiSummary').textContent=plan.floors.length+' planta(s) · '+rooms+' espacios · '+shapes.length+' entidades';
  if(announce){
   const info=spec;
   const areas=plan.floors.map(f=>f.rooms.filter(r=>r.kind!=='circulation').reduce((n,r)=>n+(r.netArea??r.area),0).toFixed(1));
   const brief=info.dimensionMeaning==='house'?'Interpreto '+info.houseWidth+' × '+info.houseDepth+' m como el tamaño de la CASA. Te propongo '+info.floors+' plantas; para mostrar los '+(plan.garage?.spaces||0)+' parqueos y el patio de '+info.patioDepth+' m he dibujado una PARCELA HIPOTÉTICA de '+info.lotWidth+' × '+info.lotDepth+' m, pendiente de confirmar. ':'Te propongo '+info.floors+' planta(s) en un terreno de '+info.lotWidth+' × '+info.lotDepth+' m, con retiros de '+info.frontSetback+' m al frente, '+info.backSetback+' m atrás y '+info.sideSetback+' m laterales. ';
   const baths=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind==='bath').length,0);
   const detail='Organicé '+rooms+' espacios, '+info.bedrooms+' dormitorios, '+baths+' baños y '+(plan.garage?plan.garage.spaces+' parqueo(s)':'sin plaza de estacionamiento dibujada')+
    '. Muros exteriores de '+Math.round(info.wallOuter*100)+' cm e interiores de '+Math.round(info.wallInner*100)+' cm; '+(info.furniture?'mobiliario, ':'')+(info.wallHatch?'hachurado, ':'')+(info.dimensions?'cotas, ':'')+
    'puertas y ventanas reales. Áreas por planta: '+areas.join(' / ')+' m² útiles aproximados. ';
   const notes=plan.warnings.slice(0,2).join(' ');
   message('bot',brief+detail+'He preparado '+shapes.length+' entidades CAD en modo '+info.style+'. '+(notes?'Observaciones: '+notes+' ':'')+
    (info.siteAssumed?'La franja frontal de parqueo no es un retiro municipal verificado; confirma el terreno real. ':'Si no indicaste retiros o espesores, usé supuestos visibles en «Ajustar medidas». ')+'Revisa la propuesta y pulsa «Dibujar plano completo en CAD». Después podrás modificarla aquí o con comandos de OtroCAD.');
  }
  return true;
 }catch(error){
  $('arquiDraw').disabled=true;
  if(announce)message('bot','No pude aplicar este cambio: '+String(error.message||error)+'. La propuesta anterior se conserva.');
  $('arquiWarnings').textContent='No puedo generar una distribución coherente: '+String(error.message||error);
  $('arquiSummary').textContent='Parámetros por corregir';return false;
 }
}
async function propose(text){
 if(busy||pending)return;
 restoreModel();
 const prompt=String(text||'').trim();
 if(draftTimer){clearTimeout(draftTimer);draftTimer=null}
 if(draftDirty)restoreAcceptedPreview();
 if(!prompt){message('bot','Cuéntame qué quieres diseñar o qué cambio deseas sobre la propuesta.');return}
 message('user',prompt);
 const answer=refs.consult(prompt,plan);
 if(answer){draftDirty=false;restoreAcceptedPreview();$('arquiDraw').disabled=!plan||!previewEntities.length;message('bot',answer);return}
 draftDirty=true;pending=true;$('arquiPrompt').disabled=true;$('arquiPropose').disabled=true;$('arquiDraw').disabled=true;
 try{
  // Give the configured language model the user's actual words and the prior
  // validated proposal. Local keyword parsing must not reject or pre-edit a
  // free-form request before the model gets a chance to interpret it.
  let next,remoteAnswered=false;
  const current=fromInputs();
  const personalProvider=typeof aiSelect==='undefined'||!aiSelect?'none':(aiSelect.value||'none');
  if(personalProvider!=='none'){
   if(!userBridge?.request){
    message('bot','El módulo de IA personal no está disponible. Tu plano anterior se conserva.');return;
   }
   if(!aiKey.value.trim()){
    message('bot','Selecciona tu proveedor y pega tu clave desde «Conectar mi IA»; las opciones gratuitas no requieren pagar a OtroCAD.');return;
   }
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
   try{
    const linked=$('arquiSendExcerpts').checked?refs.search(prompt,refs.get(),3):[];
    const reply=await userBridge.request({
     message:prompt,currentSpec:current,conversation:conversation.slice(0,-1).slice(-8),
     referenceExcerpts:linked.map(x=>({source:x.source,title:x.title,text:x.excerpt}))
    },{provider:personalProvider,key:aiKey.value},{fetch:fetch.bind(window),signal:controller.signal});
    const patch={...reply.spec};
    if(patch.dimensionMeaning==='house'){
     const w=Number(patch.houseWidth??current.houseWidth??current.lotWidth);
     const d=Number(patch.houseDepth??current.houseDepth??current.lotDepth);
     const patio=Number(patch.patioDepth??current.patioDepth??0);
     const hasGarage=patch.garage===undefined?current.garage:patch.garage;
     const front=Number(patch.frontSetback??(hasGarage?5.5:0));
     patch.houseWidth=w;patch.houseDepth=d;patch.siteAssumed=true;
     patch.lotWidth=w;patch.frontSetback=front;
     patch.backSetback=patio;patch.lotDepth=Math.round((d+front+patio)*1000)/1000;
     patch.sideSetback=0;
    }
    const candidate=planner.validateSpec({...current,...patch});
    remoteAnswered=true;
    $('arquiMode').textContent='IA en línea conectada · '+userBridge.providers[personalProvider].label;
    if(reply.requiresReview){
     message('bot',reply.reason||'Necesito aclarar un detalle antes de dibujar.');return;
    }
    next=candidate;
    if(reply.reason)message('bot',reply.reason);
   }catch(error){
    message('bot','No se pudo completar la consulta a tu IA: '+String(error.message||error)+'. Tu plano anterior se conserva.');
    return;
   }finally{clearTimeout(timeout)}
  }
  if(!remoteAnswered&&endpoint&&autoEnabled!==false){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
   try{
    const linked=$('arquiSendExcerpts').checked?refs.search(prompt,refs.get(),3):[];
    const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({message:prompt,mode:'architecture',currentSpec:current,
      conversation:conversation.slice(0,-1).slice(-8),
      referenceExcerpts:linked.map(x=>({source:x.source,title:x.title,text:x.excerpt}))}),signal:controller.signal});
    if(!response.ok){
      const err=await response.json().catch(()=>null);
      if(response.status===503)throw Error('LOCAL_FALLBACK');
      if(response.status===429)throw Error('QUOTA: '+(err?.error||'Cupo de IA agotado'));
      throw Error('REMOTE: '+(err?.error||'El servicio IA está temporalmente inaccesible.'));
     }
    const data=await response.json();
    if(!data||typeof data.reason!=='string'||typeof data.requiresReview!=='boolean'||!data.spec||typeof data.spec!=='object')throw Error('REMOTE: La respuesta IA no tiene un programa válido.');
    const candidate=planner.validateSpec({...current,...data.spec});
    refreshAutoStatus({online:true,remaining:data.remaining,globalRemaining:data.globalRemaining,limit:data.limit||2});
    $('arquiMode').textContent='IA automática · plano editable';
    remoteAnswered=true;
    if(data.requiresReview){message('bot',data.reason||'Necesito aclarar un detalle antes de dibujar.');return}
    next=candidate;
    if(data.reason)message('bot',data.reason);
   }catch(error){
    const msg=String(error.message||'');
    if(msg.startsWith('QUOTA:')){
     refreshAutoStatus();
     message('bot',msg.slice(7)+' Usaré la interpretación local para no generar gastos.');
    }else if(msg.startsWith('REMOTE:')){
     message('bot',msg.slice(7)+' No he modificado el plano.');
     return;
    }else{
     if(msg==='LOCAL_FALLBACK')autoEnabled=false;
     refreshAutoStatus();
     message('bot','IA automática no disponible; dibujaré localmente sin consumir consultas.');
    }
   }finally{clearTimeout(timeout)}
  }
  if(!remoteAnswered){
   const interpreted=planner.interpret(prompt,current);
   if(interpreted.unsupported.length){message('bot',interpreted.unsupported.join(' '));return}
   if(!interpreted.canGenerate){
    message('bot','No pude interpretar este pedido con el modo local. El Arqui necesita la conexión generativa para conversar con mayor libertad; no he modificado tu propuesta.');return;
   }
   next=interpreted.spec;
  }
  if(makePreview(next,true))draftDirty=false;
 }catch(error){message('bot','No se pudo interpretar el encargo: '+String(error.message||error))}
 finally{pending=false;$('arquiPrompt').disabled=false;$('arquiPropose').disabled=false;$('arquiDraw').disabled=draftDirty||!plan||!previewEntities.length}
}
$('arquiForm').addEventListener('submit',event=>{event.preventDefault();propose($('arquiPrompt').value)});
$('arquiExampleHome').onclick=()=>{$('arquiPrompt').value='Quiero una vivienda de 12 por 20 con tres dormitorios y garaje';propose($('arquiPrompt').value)};
$('arquiExampleEdit').onclick=()=>{$('arquiPrompt').value='Amplía la cocina 50 cm';propose($('arquiPrompt').value)};
$('arquiExampleRules').onclick=()=>propose('Revisa los criterios y las referencias de este plano');
$('arquiRecheck').onclick=()=>{if(busy||pending)return;try{makePreview(fromInputs(),true)}catch(error){message('bot',String(error.message||error))}};
function keepInputsFresh(){if(busy||pending)return;try{makePreview(fromInputs(),false)}catch(error){$('arquiWarnings').textContent=String(error.message||error);$('arquiDraw').disabled=true}}
for(const id of ['arquiBaths','arquiAccessible','arquiLotW','arquiLotD','arquiFloors','arquiBeds','arquiGarage','arquiGarageCount','arquiSetFront','arquiSetBack','arquiSetSide','arquiWallOuter','arquiWallInner','arquiStyle','arquiFurniture','arquiWallHatch','arquiDimensions','arquiOriginX','arquiOriginY'])
 $(id).addEventListener('change',keepInputsFresh);
$('arquiDraw').onclick=async()=>{
 if(busy||pending||draftDirty||!plan||!previewEntities.length)return;
 if(!visible()){message('bot','Abre el módulo DIBUJO para crear entidades arquitectónicas.');return}
 const current=api.getObjects();
 const previous=projectId?current.filter(x=>x.aiArchitect&&x.aiProjectId===projectId):[];
 const unrelated=current.filter(x=>!x.aiArchitect);
 if(unrelated.length&&!previous.length&&!confirm('El dibujo ya contiene elementos. Se añadirá la planta arquitectónica sin borrar lo existente. ¿Continuar?'))return;
 const manual=previous.length&&(!baseline||signature(previous)!==baseline);
 if(previous.length&&!confirm((manual?'Este diseño tiene cambios manuales o procede de una versión anterior. Al regenerar se sustituirán esas ediciones dentro del diseño de El Arqui. ':'')+'Se reemplazará únicamente el último diseño de El Arqui IA. Los demás objetos no se modificarán. ¿Continuar?'))return;
 busy=true;
 $('arquiDraw').disabled=true;$('arquiStop').hidden=false;
 const id=projectId||'arqui-'+Date.now().toString(36);
 const origin={x:Number($('arquiOriginX').value),y:Number($('arquiOriginY').value)};
 const shapes=professional.generate(plan,{units:api.getUnits(),origin,projectId:id});
 // Architectural CAD layers remain individually editable through CAPAS.
 for(const [layer,color] of new Map(shapes.filter(x=>x.layer).map(x=>[x.layer,x.color])))
  api.ensureLayer?.(layer,color);
 try{
  if(previous.length){
   api.replaceObjects(x=>x.aiArchitect&&x.aiProjectId===id,shapes,'El Arqui IA · diseño actualizado · '+shapes.length+' entidades');
   $('arquiProgress').textContent='Diseño actualizado. Usa Ctrl+Z para deshacer.';
  }else{
   const ctrl=new AbortController();activeStream=ctrl;
   await api.addObjectsAnimated(shapes,{
    batchSize:32,delayMs:24,signal:ctrl.signal,
    onProgress:(done,total)=>{$('arquiProgress').textContent='Dibujando en vivo: '+done+' / '+total+' entidades CAD…'},
    message:'El Arqui IA · anteproyecto dibujado con '+shapes.length+' entidades'
   });
   $('arquiProgress').textContent='Plano creado · '+shapes.length+' entidades editables. Ctrl+Z deshace el proyecto.';
  }
  projectId=id;baseline=signature(shapes);lastModelKey=modelKey(shapes[0]);api.fit();
  message('bot','¡Tu anteproyecto ya está dibujado en el Modelo! Los muros con espesor y hatch, puertas, ventanas, mobiliario, cotas y rotulación están en capas editables. Si quieres cambios, pídeme «amplía la cocina 50 cm» o ajusta la propuesta. Revisa la normativa y los aspectos técnicos antes de construir.');
 }catch(error){message('bot',String(error.message||error));$('arquiProgress').textContent='No se aplicaron cambios completos.'}
 finally{busy=false;activeStream=null;$('arquiStop').hidden=true;$('arquiDraw').disabled=false}
};
$('arquiStop').onclick=()=>activeStream?.abort();
$('arquiErase').onclick=()=>{
 if(busy||!projectId)return;
 const all=api.getObjects().filter(x=>x.aiArchitect&&x.aiProjectId===projectId);
 if(!all.length){message('bot','No hay un diseño anterior de El Arqui IA en este dibujo.');return}
 if(!confirm('¿Eliminar solo las '+all.length+' entidades del último diseño de El Arqui IA?'))return;
 api.removeObjects(x=>x.aiArchitect&&x.aiProjectId===projectId,'El Arqui IA · diseño retirado');
 projectId=null;baseline=null;lastModelKey=null;message('bot','Retirado el diseño de El Arqui IA sin modificar otros elementos.');
};
function tabPage(type){
 const design=type==='design';
 $('arquiDesignPane').hidden=!design;$('arquiLibraryPane').hidden=design;
 $('arquiTabDesign').classList.toggle('active',design);$('arquiTabLibrary').classList.toggle('active',!design);
 $('arquiTabDesign').setAttribute('aria-selected',String(design));
 $('arquiTabLibrary').setAttribute('aria-selected',String(!design));
 if(!design)drawSources();
}
$('arquiTabDesign').onclick=()=>tabPage('design');$('arquiTabLibrary').onclick=()=>tabPage('library');
function drawSources(){
 const builtin=$('arquiBuiltinSources');builtin.replaceChildren();
 for(const entry of refs.builtins()){
  const card=document.createElement('article'),title=document.createElement('strong'),description=document.createElement('p'),status=document.createElement('small');
  card.className='arqui-reference-card';title.textContent=entry.source+' · '+entry.kind;
  description.textContent=entry.summary;status.textContent=entry.status+' · '+entry.locator;
  card.append(title,description,status);
  if(entry.url){const a=document.createElement('a');a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Consultar fuente';card.append(a)}
  builtin.append(card);
 }
 const target=$('arquiSourceList');target.replaceChildren();
 const sources=refs.get();
 if(!sources.length){
  const p=document.createElement('p');p.textContent='Sin extractos personales. Las referencias públicas de arriba ya están disponibles sin cargar archivos.';target.append(p);return;
 }
 for(const entry of sources){
  const box=document.createElement('div'),name=document.createElement('span'),remove=document.createElement('button');
  box.className='arqui-source';name.textContent=entry.source+' · '+entry.title+' ('+entry.sections.length+' pasajes)';
  remove.type='button';remove.textContent='Quitar';remove.onclick=()=>{refs.remove(entry.source,entry.title);drawSources()};
  box.append(name,remove);target.append(box);
 }
}
$('arquiReferenceFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>200000)throw Error('Máximo 200 KB por extracto. Divide el libro en capítulos de texto; PDF grandes requieren indexación externa.');
  if(!/\.(txt|md)$/i.test(file.name))throw Error('Usa un archivo TXT o MD. El PDF completo todavía no está habilitado.');
  const entry=refs.makeEntry($('arquiSource').value,file.name,await file.text());
  refs.add(entry);drawSources();message('bot','Incorporado localmente: '+entry.source+' · '+entry.title+'. Lo consultaré solo en preguntas relevantes y con el consentimiento indicado.');
 }catch(err){$('arquiSourceList').textContent=String(err.message||err)}
 event.target.value='';
});

window.OtroCadArqui={open,close,propose,preview:()=>plan,draw:()=> $('arquiDraw').click(),sync};
sync();makePreview(spec,false);restoreModel();
})();
