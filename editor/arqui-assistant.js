/* El Arqui · Motor Local · assistant for architecture and CAD Dibujo only.
 * Phase 1: offline validated concept plans, preview/approval and real progressive CAD.
 * No generative AI network dependency: language is interpreted with local rules.
 */
(()=>{
'use strict';
if(window.OtroCadArqui)return;
const planner=window.OtroCadArquiPlanner,professional=window.OtroCadArquiProfessional,refs=window.OtroCadArquiReferences,
 api=window.OtroCadCivilAPI,tabs=document.getElementById('tabs');
if(!planner||!professional||!api||!tabs)return;
const $=id=>document.getElementById(id);
const allowed=new Set(['draw','modify','annotate','blocks','layers','view']);
let plan=null,previewEntities=[],spec=planner.parsePrompt('Casa de 10 x 8 con 3 dormitorios en dos plantas');
let projectId=api.getObjects().filter(x=>x.aiArchitect&&x.aiProjectId).at(-1)?.aiProjectId||null;
let activeStream=null,busy=false,pending=false,lastModelKey=null,baseline=null;
const conversation=[];
let draftTimer=null,draftDirty=false;
const root=document.createElement('div');root.id='arquiAssistant';root.className='jaimito-root arqui-root';root.hidden=true;
root.innerHTML=[
 '<button id="arquiMascot" class="jaimito-mascot arqui-mascot" type="button" aria-label="Abrir El Arqui · Motor Local" aria-controls="arquiPanel" aria-expanded="false">',
 '<img id="arquiPortrait" class="arqui-portrait" src="assets/el-arqui.webp" draggable="false" alt="El Arqui · Motor Local, arquitecto con planos, camisa negra y bigote">',
 '<span class="jaimito-mascot-tag">El Arqui <b>LOCAL</b></span></button>',
 '<section id="arquiPanel" class="arqui-panel" aria-label="El Arqui · Motor Local · Diseño arquitectónico" hidden>',
 '<header class="arqui-head"><div><strong>📐 El Arqui · Motor Local</strong><small id="arquiMode">Biblioteca residencial local · sin créditos</small></div>',
 '<button type="button" id="arquiClose" title="Minimizar" aria-label="Minimizar">−</button></header>',
 '<div class="arqui-tabs" role="tablist"><button id="arquiTabDesign" class="active" type="button" aria-selected="true">Diseñar</button>',
 '<button id="arquiTabLibrary" type="button" aria-selected="false">Biblioteca técnica</button></div>',
 '<div class="arqui-pane" id="arquiDesignPane">',
 '<p id="arquiLocalStatus" class="arqui-context" role="status">Motor arquitectónico autónomo · biblioteca técnica incorporada · 0 créditos · sin consultas externas</p>',
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
 '<label id="arquiLabelSizeW"><span id="arquiLabelWText">Casa ancho (m)</span><input id="arquiLotW" type="number" min="8" max="60" step=".1" value="12"></label>',
 '<label id="arquiLabelSizeD"><span id="arquiLabelDText">Casa fondo (m)</span><input id="arquiLotD" type="number" min="5" max="80" step=".1" value="20"></label>',
 '<label>Plantas<select id="arquiFloors"><option value="1">1 planta</option><option value="2">2 plantas</option></select></label>',
 '<label>Dormitorios<select id="arquiBeds"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>',
 '<label>Baños<select id="arquiBaths"><option value="0">Propuesta del motor</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>',
 '<label class="arqui-checkbox"><input id="arquiAccessible" type="checkbox"> Criterio accesible</label>',
 '<label class="arqui-checkbox"><input id="arquiGarage" type="checkbox" checked> Garaje / parqueo</label>',
 '<label>Plazas de parqueo<select id="arquiGarageCount"><option value="1">1 auto</option><option value="2">2 autos (tándem si cabe)</option></select></label>',
 '<label id="arquiSetLabelFront">Retiro frontal (m)<input id="arquiSetFront" type="number" min="0" max="12" step=".1" value="3"></label>',
 '<label id="arquiSetLabelBack">Retiro posterior (m)<input id="arquiSetBack" type="number" min="0" max="12" step=".1" value="2"></label>',
 '<label id="arquiSetLabelSide">Retiro lateral (m)<input id="arquiSetSide" type="number" min="0" max="5" step=".1" value=".45"></label>',
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
 '<button id="arquiErase" type="button">Retirar anteproyecto local</button></div>',
 '<p class="arqui-disclaimer">Anteproyecto editable, no plano aprobado. Revisar normativa municipal, accesibilidad, estructura, ventilación y seguridad. Referencias y alcance de cada comprobación en Biblioteca técnica.</p>',
 '</div>',
 '<div class="arqui-pane" id="arquiLibraryPane" hidden>',
 '<h4>Referencias de diseño y normativa</h4>',
 '<p>Biblioteca estática: criterios de habitaciones, circulaciones, escaleras, puertas, ventanas, muebles y tipologías. Plazola y Neufert constan como bibliografía, sin reproducir sus libros.</p>',
 '<div id="arquiBuiltinSources" class="arqui-builtin-sources"></div>',
 '<label>Fuente<select id="arquiSource"><option value="Neufert">Neufert</option><option value="Plazola">Plazola</option><option value="Otra fuente">Otra fuente</option></select></label>',
 '<label>Extracto de texto<input type="file" id="arquiReferenceFile" accept=".txt,.md,text/plain,text/markdown"></label>',
 '<div id="arquiSourceList" class="arqui-source-list"></div>',
 '<p class="arqui-context">Los extractos que importes permanecen en el navegador. No se envían a ningún servicio de IA.</p>',
 '<p class="arqui-disclaimer">No se copian libros al repositorio. Las reglas locales deben contrastarse con la normativa vigente del predio.</p>',
 '</div></section>'
].join('');
document.body.append(root);
const avatar=$('arquiMascot'),panel=$('arquiPanel'),chat=$('arquiMessages');
const toolbar=document.createElement('button');toolbar.id='arquiRibbon';toolbar.type='button';
toolbar.textContent='📐 El Arqui · Motor Local';toolbar.title='Diseñar plantas arquitectónicas editables por instrucciones';
toolbar.hidden=true;toolbar.onclick=()=>open();tabs.append(toolbar);
function visible(){const tab=tabs.querySelector('[data-tab].active');return !!tab&&allowed.has(tab.dataset.tab)}
function sync(){const state=visible();root.hidden=!state;toolbar.hidden=!state;if(!state)close()}
function open(){if(!visible())return;root.hidden=false;panel.hidden=false;avatar.setAttribute('aria-expanded','true');
 restoreModel();
 if(!chat.childElementCount)message('bot','¡Cuéntame tu proyecto como lo hablarías con otro arquitecto! Dime las medidas de la CASA. Menciona TERRENO, retiros, jardines o parqueos solo si los necesitas. Propondré lo que falte como supuesto editable; luego puedes pedirme cambios sobre esta propuesta. Te prepararé un anteproyecto amueblado con muros de espesor real, puertas, ventanas, hatch y cotas, listo para editar en CAD. Si algo no cabe, te explicaré por qué en vez de inventarlo.');}
function close(){panel.hidden=true;avatar.setAttribute('aria-expanded','false')}
avatar.onclick=()=>panel.hidden?open():close();$('arquiClose').onclick=close;
tabs.addEventListener('click',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.addEventListener('pageshow',sync);
function message(role,text){
 conversation.push({role:role==='user'?'user':'assistant',content:String(text).slice(0,2200)});
 while(conversation.length>12)conversation.shift();
 const item=document.createElement('div');item.className='arqui-msg '+role;
 const head=document.createElement('strong');head.textContent=role==='user'?'Tú':'El Arqui · Motor Local';
 const body=document.createElement('p');body.textContent=String(text);item.append(head,body);
 chat.append(item);chat.scrollTop=chat.scrollHeight;while(chat.childElementCount>14)chat.firstChild.remove();
}
function toInputs(s){
 const houseOnly=s.dimensionMeaning==='house'&&!s.siteDeclared;
 $('arquiLotW').value=houseOnly?s.houseWidth:s.lotWidth;
 $('arquiLotD').value=houseOnly?s.houseDepth:s.lotDepth;
 $('arquiLabelWText').textContent=houseOnly?'CASA ancho (m)':'TERRENO ancho (m)';
 $('arquiLabelDText').textContent=houseOnly?'CASA fondo (m)':'TERRENO fondo (m)';
 for(const id of ['arquiSetLabelFront','arquiSetLabelBack','arquiSetLabelSide']){
  $(id).hidden=houseOnly;
 }
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
 const houseOnly=spec.dimensionMeaning==='house'&&!spec.siteDeclared;
 const width=$('arquiLotW').value,depth=$('arquiLotD').value;
 return planner.validateSpec({...spec,lotWidth:width,lotDepth:depth,
  ...(houseOnly?{houseWidth:width,houseDepth:depth}:{}),
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
 const spatial=plan&&window.OtroCadArchitecturalKnowledge?.spatialReview?.(plan);
 const warnings=plan?[...refs.review(plan).map(x=>x.message),...(spatial?.issues||[]).map(x=>x.message),...plan.audit.map(x=>x.message),...plan.warnings]:[];
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
  if(announce){$('arquiDetails').hidden=false;$('arquiContext').textContent=spec.siteDeclared?'Terreno reconocido de forma explícita; revisa retiros y programa.':'Propuesta de CASA, sin terreno inventado. Puedes añadir terreno, jardín o parqueo cuando lo necesites.';}
  $('arquiDraw').disabled=false;
  const rooms=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind!=='circulation').length,0);
  $('arquiSummary').textContent=plan.floors.length+' planta(s) · '+rooms+' espacios · '+shapes.length+' entidades';
  if(announce){
   const info=spec;
   const areas=plan.floors.map(f=>f.rooms.filter(r=>r.kind!=='circulation').reduce((n,r)=>n+(r.netArea??r.area),0).toFixed(1));
   const brief=(info.dimensionMeaning==='house'?'Interpreto '+info.houseWidth+' × '+info.houseDepth+' m como medidas de la CASA, no del terreno. ':'')+
    (info.siteDeclared?'El terreno de '+info.lotWidth+' × '+info.lotDepth+' m fue indicado en el encargo. Retiros registrados: frontal '+info.frontSetback+', posterior '+info.backSetback+', lateral '+info.sideSetback+' m. ':
    'NO se inventa ninguna parcela ni retiro. Solo dibujo exteriores que realmente hayas solicitado: '+(info.garage?'parqueo; ':'')+(info.patioDepth?'patio; ':'')+(info.garden?'jardín; ':'')+'los demás quedan sin definir. ');
   const baths=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind==='bath').length,0);
   const detail='Organicé '+rooms+' espacios, '+info.bedrooms+' dormitorios, '+baths+' baños y '+(plan.garage?plan.garage.spaces+' parqueo(s)':'sin plaza de estacionamiento dibujada')+
    '. Muros exteriores de '+Math.round(info.wallOuter*100)+' cm e interiores de '+Math.round(info.wallInner*100)+' cm; '+(info.furniture?'mobiliario, ':'')+(info.wallHatch?'hachurado, ':'')+(info.dimensions?'cotas, ':'')+
    'puertas y ventanas reales. Áreas por planta: '+areas.join(' / ')+' m² útiles aproximados. ';
   const notes=plan.warnings.slice(0,2).join(' ');
   message('bot',brief+detail+'He preparado '+shapes.length+' entidades CAD en modo '+info.style+'. '+(notes?'Observaciones: '+notes+' ':'')+
    (info.siteDeclared?'Los retiros y dimensiones deben verificarse según la norma municipal. ':'No asigné retiro municipal ni orientación geográfica no solicitados. ')+'Revisa la propuesta y pulsa «Dibujar plano completo en CAD». Después podrás modificarla aquí o con comandos de OtroCAD.');
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
 if(!prompt){message('bot','Describe la vivienda, sus dimensiones y los cambios que necesitas.');return}
 message('user',prompt);
 const answer=refs.consult(prompt,plan);
 if(answer){
  draftDirty=false;restoreAcceptedPreview();
  $('arquiDraw').disabled=!plan||!previewEntities.length;
  message('bot',answer);return;
 }
 draftDirty=true;pending=true;
 $('arquiPrompt').disabled=true;$('arquiPropose').disabled=true;
 $('arquiDraw').disabled=true;
 try{
  const current=fromInputs(),result=planner.interpret(prompt,current);
  if(result.unsupported.length){
   message('bot',result.unsupported.join(' ')+' El motor local no inventará geometría inexistente.');
   return;
  }
  if(!result.canGenerate){
   message('bot','No identifiqué un cambio geométrico preciso. Describe dimensiones de la casa, dormitorios, baños, parqueo, patios o ajustes dimensionales.');
   return;
  }
  if(makePreview(result.spec,true))draftDirty=false;
 }catch(error){message('bot','No se pudo generar el anteproyecto estático: '+String(error.message||error))}
 finally{
  pending=false;$('arquiPrompt').disabled=false;$('arquiPropose').disabled=false;
  $('arquiDraw').disabled=draftDirty||!plan||!previewEntities.length;
 }
}
$('arquiForm').addEventListener('submit',event=>{event.preventDefault();propose($('arquiPrompt').value)});
$('arquiExampleHome').onclick=()=>{$('arquiPrompt').value='Quiero una casa de 10 por 8 con tres dormitorios, un baño máster y otro compartido, sala comedor y cocina';propose($('arquiPrompt').value)};
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
 if(previous.length&&!confirm((manual?'Este diseño tiene cambios manuales o procede de una versión anterior. Al regenerar se sustituirán esas ediciones dentro del diseño de El Arqui. ':'')+'Se reemplazará únicamente el último diseño de El Arqui · Motor Local. Los demás objetos no se modificarán. ¿Continuar?'))return;
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
   api.replaceObjects(x=>x.aiArchitect&&x.aiProjectId===id,shapes,'El Arqui · Motor Local · diseño actualizado · '+shapes.length+' entidades');
   $('arquiProgress').textContent='Diseño actualizado. Usa Ctrl+Z para deshacer.';
  }else{
   const ctrl=new AbortController();activeStream=ctrl;
   await api.addObjectsAnimated(shapes,{
    batchSize:32,delayMs:24,signal:ctrl.signal,
    onProgress:(done,total)=>{$('arquiProgress').textContent='Dibujando en vivo: '+done+' / '+total+' entidades CAD…'},
    message:'El Arqui · Motor Local · anteproyecto dibujado con '+shapes.length+' entidades'
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
 if(!all.length){message('bot','No hay un diseño anterior de El Arqui · Motor Local en este dibujo.');return}
 if(!confirm('¿Eliminar solo las '+all.length+' entidades del último diseño de El Arqui · Motor Local?'))return;
 api.removeObjects(x=>x.aiArchitect&&x.aiProjectId===projectId,'El Arqui · Motor Local · diseño retirado');
 projectId=null;baseline=null;lastModelKey=null;message('bot','Retirado el diseño de El Arqui · Motor Local sin modificar otros elementos.');
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
  refs.add(entry);drawSources();message('bot','Incorporado localmente: '+entry.source+' · '+entry.title+'. Lo consultaré localmente en preguntas relevantes, sin transmitirlo por Internet.');
 }catch(err){$('arquiSourceList').textContent=String(err.message||err)}
 event.target.value='';
});

window.OtroCadArqui={open,close,propose,preview:()=>plan,draw:()=> $('arquiDraw').click(),sync};
sync();makePreview(spec,false);restoreModel();
})();
