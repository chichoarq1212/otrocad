'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const basePlanner=require('../editor/arqui-planner.js');
const knowledge=require('../editor/arqui-knowledge.js');
global.window={OtroCadArquiPlanner:basePlanner,OtroCadArchitecturalKnowledge:knowledge};
require('../editor/arqui-house-layout.js');
const planner=global.window.OtroCadArquiPlanner;
delete global.window;
const professional=require('../editor/arqui-professional.js');
const refs=require('../editor/arqui-references.js');
const script=fs.readFileSync('editor/arqui-assistant.js','utf8');
const nodes={};
function element(tag='DIV'){
 const node={tagName:tag.toUpperCase(),children:[],className:'',dataset:{},style:{},
  hidden:false,disabled:false,textContent:'',value:'',checked:false,attributes:{},listeners:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  setAttribute(n,v){node.attributes[n]=String(v)},
  addEventListener(n,cb){node.listeners[n]=cb},
  append(...ch){ch.forEach(c=>{c.parentNode=node});node.children.push(...ch)},
  appendChild(c){node.append(c)},
  remove(){node.removed=true;if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(c=>c!==node)},
  replaceChildren(...ch){node.children=[...ch]},
  get childElementCount(){return node.children.length},
  get firstChild(){return node.children[0]||null},
  get scrollHeight(){return 150},
  set scrollTop(v){node.scrollPosition=v},
  focus(){},click(){return node.onclick?.()},
  querySelector(){return null}
 };
 Object.defineProperty(node,'innerHTML',{set(html){
  node.markup=String(html);
  for(const m of node.markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
   const id=m[1],tagMatch=m[0].match(/^<([a-z]+)/i),e=element(tagMatch?.[1]||'DIV');
   e.id=id;
   e.hidden=/\bhidden(?:\s|>|=)/.test(m[0]);
   const value=m[0].match(/\bvalue="([^"]+)"/);if(value)e.value=value[1];
   if(/\bchecked(?:\s|>|=)/.test(m[0]))e.checked=true;
   nodes[id]=e;
  }
 },get(){return node.markup||''}});
 return node;
}
const body=element(),tabs=element('NAV');
nodes.tabs=tabs;
let tab='draw';
tabs.querySelector=selector=>{
 if(selector==='[data-tab].active')return{dataset:{tab}};
 return null;
};
const document={body,getElementById:id=>nodes[id]||null,
 createElement:tag=>element(tag),
 createElementNS:(ns,tag)=>element(tag),
 addEventListener(){}};
const data=[];
let undoCalled=false,fitCalled=false,replacements=0,removals=0,animated=0;
const api={
 getObjects:()=>data,
 getUnits:()=> 'm',
 addObjectsAnimated:async(list,{onProgress})=>{
  animated++;onProgress?.(list.length,list.length);data.push(...list);return{saved:true,count:list.length}
 },
 replaceObjects:(pred,list)=>{replacements++;for(let i=data.length-1;i>=0;i--)if(pred(data[i]))data.splice(i,1);data.push(...list);return true},
 removeObjects:(pred)=>{removals++;for(let i=data.length-1;i>=0;i--)if(pred(data[i]))data.splice(i,1);return true},
 fit:()=>{fitCalled=true},
};
const store={entries:new Map(),getItem(k){return this.entries.get(k)||null},setItem(k,v){this.entries.set(k,v)}};
const window={OtroCadArquiPlanner:planner,OtroCadArquiProfessional:professional,OtroCadArquiReferences:refs,OtroCadCivilAPI:api,addEventListener(){}};
const context={window,document,location:{href:'https://example.org/editor/'},localStorage:store,
 MutationObserver:class{observe(){}},queueMicrotask:cb=>cb(),URL,AbortController,
 confirm:text=>{confirmations.push(text);return true},console,setTimeout,clearTimeout,Date,Number,Math};
const confirmations=[];
const vm=require('node:vm');vm.createContext(context);
vm.runInContext(script,context);
assert.ok(window.OtroCadArqui,'Assistant must register global API');
assert.ok(body.children.some(x=>x.id==='arquiAssistant'),'Avatar must mount into CAD DOM');
const root=body.children.find(x=>x.id==='arquiAssistant');
assert.equal(root.hidden,false,'Architecture assistant visible on Dibujo');
assert.match(root.markup,/assets\/el-arqui\.webp/,'Use official uploaded portrait');
assert.equal(nodes.arquiPanel.hidden,true,'Chat should start minimized');
assert.match(nodes.arquiMode.textContent,/local/i,'Show local architecture engine explicitly');
assert.equal(nodes.arquiAiSettings,undefined,'Remove dead provider setup entirely');
assert.match(nodes.arquiLocalStatus.textContent,/0 créditos|sin consultas externas/i,'Local offline status visible');
window.OtroCadArqui.open();
assert.equal(nodes.arquiPanel.hidden,false,'Chat opens on request');
assert.ok(nodes.arquiPreview.children.length>4,'Plan visualization created');
assert.match(nodes.arquiSummary.textContent,/entidades/);
assert.ok(nodes.arquiWarnings.children.length>0,'Professional warnings displayed');
assert.ok(nodes.arquiDraw.disabled===false,'Valid preview enables draw');
async function main(){
 const originalPlan=window.OtroCadArqui.preview();
 const beforePreview=nodes.arquiPreview.children[0];
 nodes.arquiPrompt.value='Quiero una casa de dos plantas en terreno 12x25 con 3 dormitorios';
 nodes.arquiPrompt.listeners.input();
 assert.equal(nodes.arquiDraw.disabled,true,'Cannot draw a draft that has not been proposed');
 await new Promise(resolve=>setTimeout(resolve,420));
 assert.match(nodes.arquiSummary.textContent,/BORRADOR LOCAL/);
 assert.notEqual(nodes.arquiPreview.children[0],beforePreview,'Typing updates the preview');
 assert.equal(window.OtroCadArqui.preview(),originalPlan,'Typing must not replace the accepted plan');
 assert.equal(data.length,0,'Typing never inserts entities into the CAD model');
 nodes.arquiPrompt.value='';nodes.arquiPrompt.listeners.input();
 assert.equal(window.OtroCadArqui.preview(),originalPlan,'Clearing restores the accepted preview');
 assert.equal(nodes.arquiDraw.disabled,false);
 nodes.arquiPrompt.value='Diseña una vivienda de dos plantas en terreno 12x20 con 3 dormitorios';
 await window.OtroCadArqui.propose(nodes.arquiPrompt.value);
 assert.equal(window.OtroCadArqui.preview().floors.length,2,'Prompt should generate two floors');
 await nodes.arquiDraw.click();
 assert.equal(animated,1,'Live drawing should be one animated transaction');
 assert.ok(data.length>100,'CAD should contain real entities');
 assert.ok(fitCalled,'Model camera should fit generated design');
 const prior=data.filter(x=>x.aiArchitect).length;
 nodes.arquiPrompt.value='agranda cocina 50 cm';
 await window.OtroCadArqui.propose(nodes.arquiPrompt.value);
 await nodes.arquiDraw.click();
 assert.equal(replacements,1,'Edits replace only previous AI design');
 assert.equal(animated,1,'Do not create duplicate designs');
 const priorSpec=window.OtroCadArqui.preview().spec;
 await window.OtroCadArqui.propose('Hola amigo');
 assert.equal(window.OtroCadArqui.preview().spec,priorSpec,'Unrecognized request must preserve active preview');
 assert.ok(nodes.arquiDetails.hidden===false,'Details become available after generation');
 nodes.arquiTabLibrary.click();
 assert.ok(nodes.arquiBuiltinSources.children.length>=4,'Sources must work without user uploads');
 const drawn=data.find(x=>x.aiArchitect&&x.type==='line');drawn.a.x+=.1;
 await window.OtroCadArqui.propose('amplía la cocina otros 25 cm');
 await nodes.arquiDraw.click();
 assert.ok(confirmations.some(x=>/cambios manuales/.test(x)),'Regeneration must disclose overwriting manual edits');
 assert.equal(data.filter(x=>x.aiArchitect).length>0,true);
 tab='civil';window.OtroCadArqui.sync();
 assert.equal(root.hidden,true,'El Arqui must not appear in Civil');
 tab='mep';window.OtroCadArqui.sync();
 assert.equal(root.hidden,true,'El Arqui must not appear in MEP');
 tab='draw';window.OtroCadArqui.sync();
 assert.equal(root.hidden,false);
 window.OtroCadArqui.open();
 await nodes.arquiErase.click();
 assert.equal(removals,1);
 assert.equal(data.length,0,'Only AI project entities should be removed');
 // Reinitialize the assistant against the saved CAD objects, as when reopening the editor.
 await window.OtroCadArqui.propose('Casa 12x20 de dos plantas');await nodes.arquiDraw.click();
 const savedSpec=data.find(x=>x.aiDesignSpec).aiDesignSpec;
 window.OtroCadArqui=null;vm.runInContext(script,context);
 assert.equal(window.OtroCadArqui.preview().spec.kitchenExtra,savedSpec.kitchenExtra,'Reopen recovers the program from CAD metadata');
 assert.equal(window.OtroCadArqui.preview().spec.floors,savedSpec.floors);
 data.push({type:'line',layer:'USER',a:{x:0,y:0},b:{x:1,y:1}});
 await window.OtroCadArqui.propose('sin hatch');await nodes.arquiDraw.click();
 assert.equal(data.filter(x=>x.layer==='USER').length,1,'Unrelated CAD content survives regeneration');
 console.log('Arqui UI checks passed: Dibujo-only, official portrait, live CAD, change-in-place and safe remove.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
