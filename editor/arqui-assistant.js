/* El Arqui IA · assistant for architecture and CAD Dibujo only.
 * Phase 1: offline validated concept plans, preview/approval and real progressive CAD.
 * Optional secure AI endpoint may propose dimensions but cannot execute arbitrary code.
 */
(()=>{
'use strict';
if(window.OtroCadArqui)return;
const planner=window.OtroCadArquiPlanner,refs=window.OtroCadArquiReferences,
 api=window.OtroCadCivilAPI,tabs=document.getElementById('tabs');
if(!planner||!api||!tabs)return;
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
 '<textarea id="arquiPrompt" rows="3" maxlength="1200" placeholder="Diseña una vivienda de dos plantas en un terreno de 12x20 m, con tres dormitorios y garaje..."></textarea>',
 '<button id="arquiPropose" type="submit">Proponer distribución</button></form>',
 '<div class="arqui-grid">',
 '<label>Terreno ancho (m)<input id="arquiLotW" type="number" min="8" max="60" step=".1" value="12"></label>',
 '<label>Terreno fondo (m)<input id="arquiLotD" type="number" min="12" max="80" step=".1" value="20"></label>',
 '<label>Plantas<select id="arquiFloors"><option value="1">1 planta</option><option value="2">2 plantas</option></select></label>',
 '<label>Dormitorios<select id="arquiBeds"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>',
 '<label class="arqui-checkbox"><input id="arquiGarage" type="checkbox" checked> Garaje / parqueo</label>',
 '<label>Origen X (modelo)<input id="arquiOriginX" type="number" step="any" value="0"></label>',
 '<label>Origen Y (modelo)<input id="arquiOriginY" type="number" step="any" value="0"></label>',
 '</div>',
 '<div class="arqui-preview-title"><strong>Vista previa · planta arquitectónica</strong><small id="arquiSummary"></small></div>',
 '<svg id="arquiPreview" viewBox="0 0 360 225" role="img" aria-label="Plano conceptual con ambientes y pasillos"></svg>',
 '<div id="arquiWarnings" class="arqui-warnings" role="status"></div>',
 '<p id="arquiProgress" class="arqui-progress" role="status"></p>',
 '<div class="arqui-actions"><button id="arquiRecheck" type="button">Revisar medidas</button>',
 '<button id="arquiDraw" type="button">Dibujar en CAD</button>',
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
 if(!chat.childElementCount)message('bot','Soy El Arqui IA. Puedo proponer y dibujar una planta 2D con muros, accesos, ventanas, zonas, áreas y cotas. Reviso proporciones antes de dibujar. Mis criterios orientativos NO sustituyen Plazola, Neufert ni una norma vigente.');}
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
}
function fromInputs(){
 return planner.validateSpec({...spec,lotWidth:$('arquiLotW').value,lotDepth:$('arquiLotD').value,
  floors:$('arquiFloors').value,bedrooms:$('arquiBeds').value,garage:$('arquiGarage').checked});
}
function makeSVG(tag,attrs={},parent=$('arquiPreview')){
 const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
 parent.append(node);return node;
}
function renderPreview(){
 const svg=$('arquiPreview');svg.replaceChildren();
 makeSVG('rect',{x:0,y:0,width:360,height:225,fill:'#162638',rx:7});
 if(!plan)return;
 const floorW=plan.spec.lotWidth,floorD=plan.spec.lotDepth;
 const cols=plan.floors.length;
 const scale=Math.min((340-(cols-1)*14)/(cols*floorW),192/floorD);
 for(let i=0;i<cols;i++){
  const f=plan.floors[i],left=10+i*(floorW*scale+14),top=7;
  const rect=(x,y,w,h,fill,stroke='#7389a3')=>makeSVG('rect',{
    x:left+x*scale,y:top+y*scale,width:w*scale,height:h*scale,fill,stroke,'stroke-width':.8});
  rect(0,0,floorW,floorD,'#1f324b','#7f9abd');
  for(const room of f.rooms){
   const isHall=room.kind==='circulation';
   const fill=isHall?'#3c6485':room.kind==='bedroom'?'#285e58':room.kind==='stairs'?'#685446':
    room.kind==='bath'?'#314f76':'#4d5365';
   rect(f.x+room.x,f.y+room.y,room.width,room.depth,fill,'#aac3d1');
   if(room.width*scale>28&&room.depth*scale>11){
    const text=makeSVG('text',{x:left+(f.x+room.x+room.width/2)*scale,
     y:top+(f.y+room.y+room.depth/2)*scale,fill:'#f1f7fa','font-size':8,
     'font-family':'system-ui, sans-serif','text-anchor':'middle'});
    text.textContent=room.kind==='circulation'?'PASILLO':room.name.length>14?room.name.slice(0,12)+'…':room.name;
   }
  }
  if(i===0&&plan.garage)rect(plan.garage.x,plan.garage.y,plan.garage.width,plan.garage.depth,'#665e43','#ffcf52');
  const title=makeSVG('text',{x:left,y:top+floorD*scale+11,fill:'#cbdff2','font-size':9});
  title.textContent='PLANTA '+f.level;
 }
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
  const unit=api.getUnits();const shapes=planner.toEntities(proposed,{units:unit,origin,projectId:projectId||'arqui-preview'});
  if(shapes.length>1500)throw Error('El programa genera demasiados objetos para el editor.');
  plan=proposed;previewEntities=shapes;spec=proposed.spec;
  toInputs(spec);renderPreview();displayIssues();
  $('arquiDraw').disabled=false;
  const rooms=plan.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.kind!=='circulation').length,0);
  $('arquiSummary').textContent=plan.floors.length+' planta(s) · '+rooms+' espacios · '+shapes.length+' entidades';
  if(announce)message('bot','Propuesta lista: '+plan.floors.length+' planta(s), '+rooms+' espacios, '+shapes.length+' entidades CAD. Revisa la vista previa y las observaciones. Pulsa «Dibujar en CAD» para aprobarla.');
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
for(const id of ['arquiLotW','arquiLotD','arquiFloors','arquiBeds','arquiGarage','arquiOriginX','arquiOriginY'])
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
 const shapes=planner.toEntities(plan,{units:api.getUnits(),origin,projectId:id});
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
    batchSize:10,delayMs:55,signal:ctrl.signal,
    onProgress:(done,total)=>{$('arquiProgress').textContent='Dibujando en vivo: '+done+' / '+total+' entidades CAD…'},
    message:'El Arqui IA · anteproyecto dibujado con '+shapes.length+' entidades'
   });
   $('arquiProgress').textContent='Plano creado · '+shapes.length+' entidades editables. Ctrl+Z deshace el proyecto.';
  }
  projectId=id;api.fit();
  message('bot','He dibujado el anteproyecto en el Modelo. Puedes editar sus líneas, ventanas, puertas y textos. Verifica cotas, normativa y circulación antes de desarrollar el proyecto.');
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
