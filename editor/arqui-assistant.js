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
let activeStream=null,busy=false,remoteConsent=false;
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
 '<div class="arqui-chat" id="arquiMessages" role="log" aria-live="polite"></div>',
 '<form id="arquiForm" class="arqui-form"><label for="arquiPrompt">¿Qué deseas diseñar o modificar?</label>',
 '<textarea id="arquiPrompt" rows="4" maxlength="2200" placeholder="Quiero una casa en lote 12x20, 3 dormitorios, garaje, retiro frontal 3 m, posterior 2 m y laterales 1 m; muros exteriores 20 cm, interiores 15 cm, cocina con isla, amueblada, con hatch y cotas tipo concurso."></textarea>',
 '<button id="arquiPropose" type="submit">Generar anteproyecto amueblado</button></form>',
 '<div class="arqui-grid">',
 '<label>Terreno ancho (m)<input id="arquiLotW" type="number" min="8" max="60" step=".1" value="12"></label>',
 '<label>Terreno fondo (m)<input id="arquiLotD" type="number" min="12" max="80" step=".1" value="20"></label>',
 '<label>Plantas<select id="arquiFloors"><option value="1">1 planta</option><option value="2">2 plantas</option></select></label>',
 '<label>Dormitorios<select id="arquiBeds"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>',
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
 '</div>',
 '<div class="arqui-preview-title"><strong>Vista previa · anteproyecto tipo concurso</strong><small id="arquiSummary"></small></div>',
 '<svg id="arquiPreview" viewBox="0 0 360 225" role="img" aria-label="Plano conceptual con ambientes y pasillos"></svg>',
 '<div id="arquiWarnings" class="arqui-warnings" role="status"></div>',
 '<p id="arquiProgress" class="arqui-progress" role="status"></p>',
 '<div class="arqui-actions"><button id="arquiRecheck" type="button">Revisar diseño</button>',
 '<button id="arquiDraw" type="button">Dibujar plano completo en CAD</button>',
 '<button id="arquiStop" type="button" hidden>Cancelar dibujo</button>',
 '<button id="arquiErase" type="button">Retirar diseño IA</button></div>',
 '<p class="arqui-disclaimer">Anteproyecto editable, no plano aprobado. Revisar normativa municipal, accesibilidad, estructura, ventilación y seguridad. No se han consultado libros no incorporados.</p>',
 '</div>',
 '<div class="arqui-pane" id="arquiLibraryPane" hidden>',
 '<h4>Plazola y Neufert · biblioteca autorizada</h4>',
 '<p>Por ahora no están incorporados los libros completos. Puedes cargar extractos TXT/MD que tengas derecho a utilizar; se guardan solo en este dispositivo y se usan para localizar pasajes relevantes.</p>',
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
 if(!chat.childElementCount)message('bot','¡Cuéntame tu proyecto como lo hablarías con otro arquitecto! Dime terreno, retiros, habitaciones, baños, parqueaderos y estilo. Te prepararé un anteproyecto amueblado con muros de espesor real, puertas, ventanas, hatch y cotas, listo para editar en CAD. Si algo no cabe, te explicaré por qué en vez de inventarlo.');}
function close(){panel.hidden=true;avatar.setAttribute('aria-expanded','false')}
avatar.onclick=()=>panel.hidden?open():close();$('arquiClose').onclick=close;
tabs.addEventListener('click',()=>queueMicrotask(sync));
const observer=new MutationObserver(sync);observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
window.addEventListener('pageshow',sync);
const endpoint=(()=>{
 const raw=window.OTROCAD_ARQUI_AI_ENDPOINT;
 if(typeof raw!=='string'||!raw)return null;
 try{const url=new URL(raw,location.href);return url.protocol==='https:'?url:null}catch(_){return null}
})();
$('arquiMode').textContent=endpoint?'IA remota opcional · planos sujetos a validación':'Diseño CAD local · IA generativa no conectada';
function message(role,text){
 const item=document.createElement('div');item.className='arqui-msg '+role;
 const head=document.createElement('strong');head.textContent=role==='user'?'Tú':'El Arqui IA';
 const body=document.createElement('p');body.textContent=String(text);item.append(head,body);
 chat.append(item);chat.scrollTop=chat.scrollHeight;while(chat.childElementCount>14)chat.firstChild.remove();
}
function toInputs(s){
 $('arquiLotW').value=s.lotWidth;$('arquiLotD').value=s.lotDepth;
 $('arquiFloors').value=String(s.floors);$('arquiBeds').value=String(s.bedrooms);
 $('arquiGarage').checked=s.garage;
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
function makeSVG(tag,attrs={},parent=$('arquiPreview')){
 const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
 parent.append(node);return node;
}
function renderPreview(){
 professional.preview(document,$('arquiPreview'),previewEntities);
}
function displayIssues(){
 const output=$('arquiWarnings');output.replaceChildren();
 const warnings=plan?[...plan.audit.map(x=>x.message),...plan.warnings]:[];
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
  $('arquiDraw').disabled=false;
  const rooms=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind!=='circulation').length,0);
  $('arquiSummary').textContent=plan.floors.length+' planta(s) · '+rooms+' espacios · '+shapes.length+' entidades';
  if(announce){
   const info=spec;
   const areas=plan.floors.map(f=>f.rooms.filter(r=>r.kind!=='circulation').reduce((n,r)=>n+r.area,0).toFixed(1));
   const brief='Te propongo '+info.floors+' planta(s) en un terreno de '+info.lotWidth+' × '+info.lotDepth+' m, con retiros de '+info.frontSetback+' m al frente, '+info.backSetback+' m atrás y '+info.sideSetback+' m laterales. ';
   const detail='Organicé '+rooms+' espacios, '+info.bedrooms+' dormitorios y '+(plan.garage?plan.garage.spaces+' parqueo(s)':'sin plaza de estacionamiento dibujada')+
    '. Muros exteriores de '+Math.round(info.wallOuter*100)+' cm e interiores de '+Math.round(info.wallInner*100)+' cm; '+(info.furniture?'mobiliario, ':'')+(info.wallHatch?'hachurado, ':'')+(info.dimensions?'cotas, ':'')+
    'puertas y ventanas reales. Áreas por planta: '+areas.join(' / ')+' m². ';
   const notes=plan.warnings.slice(0,2).join(' ');
   message('bot',brief+detail+'He preparado '+shapes.length+' entidades CAD en modo '+info.style+'. '+(notes?'Observaciones: '+notes+' ':'')+
    'Revisa la propuesta y pulsa «Dibujar plano completo en CAD». Después podrás modificarla aquí o con comandos de OtroCAD.');
  }
  return true;
 }catch(error){
  plan=null;previewEntities=[];$('arquiDraw').disabled=true;
  $('arquiWarnings').textContent='No puedo generar una distribución coherente: '+String(error.message||error);
  $('arquiSummary').textContent='Parámetros por corregir';return false;
 }
}
async function propose(text){
 if(busy)return;
 const prompt=String(text||'').trim();
 if(!prompt){makePreview(fromInputs(),true);return}
 message('user',prompt);
 try{
  let next=planner.parsePrompt(prompt,fromInputs());
  // Remote AI is only allowed to propose numeric specs, never JS or raw CAD writes.
  if(endpoint){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   try{
    const linked=$('arquiSendExcerpts').checked?refs.search(prompt,refs.get(),3):[];
    const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({message:prompt,mode:'architecture',currentSpec:next,
      referenceExcerpts:linked.map(x=>({source:x.source,title:x.title,text:x.excerpt}))}),signal:controller.signal});
    if(response.ok){
     const data=await response.json();
     if(data?.spec&&typeof data.spec==='object')
      next=planner.validateSpec({...next,...data.spec});
    }
   }catch(_){message('bot','Servicio IA no disponible: continúo con el motor local y las medidas del proyecto.')}
   finally{clearTimeout(timeout)}
  }
  makePreview(next,true);
 }catch(error){message('bot','No se pudo interpretar el encargo: '+String(error.message||error))}
}
$('arquiForm').addEventListener('submit',event=>{event.preventDefault();propose($('arquiPrompt').value)});
$('arquiRecheck').onclick=()=>makePreview(fromInputs(),true);
function keepInputsFresh(){if(!busy)makePreview(fromInputs(),false)}
for(const id of ['arquiLotW','arquiLotD','arquiFloors','arquiBeds','arquiGarage','arquiGarageCount','arquiSetFront','arquiSetBack','arquiSetSide','arquiWallOuter','arquiWallInner','arquiStyle','arquiFurniture','arquiWallHatch','arquiDimensions','arquiOriginX','arquiOriginY'])
 $(id).addEventListener('change',keepInputsFresh);
$('arquiDraw').onclick=async()=>{
 if(busy||!plan||!previewEntities.length)return;
 if(!visible()){message('bot','Abre el módulo DIBUJO para crear entidades arquitectónicas.');return}
 const current=api.getObjects();
 const previous=projectId?current.filter(x=>x.aiArchitect&&x.aiProjectId===projectId):[];
 const unrelated=current.filter(x=>!x.aiArchitect);
 if(unrelated.length&&!previous.length&&!confirm('El dibujo ya contiene elementos. Se añadirá la planta arquitectónica sin borrar lo existente. ¿Continuar?'))return;
 if(previous.length&&!confirm('Se reemplazará únicamente el último diseño de El Arqui IA. Los demás objetos no se modificarán. ¿Continuar?'))return;
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
  projectId=id;api.fit();
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
 projectId=null;message('bot','Retirado el diseño de El Arqui IA sin modificar otros elementos.');
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
 const target=$('arquiSourceList');target.replaceChildren();
 const sources=refs.get();
 if(!sources.length){
  const p=document.createElement('p');p.textContent='Plazola: no incorporado · Neufert: no incorporado. Sin páginas ni ediciones cargadas.';target.append(p);return;
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
$('arquiSendExcerpts').onchange=e=>{remoteConsent=e.target.checked};
window.OtroCadArqui={open,close,propose,preview:()=>plan,draw:()=> $('arquiDraw').click(),sync};
sync();makePreview(spec,false);
})();
