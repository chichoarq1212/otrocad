'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const basePlanner=require('../editor/arqui-planner.js');
global.window={OtroCadArquiPlanner:basePlanner};
require('../editor/arqui-house-layout.js');
const planner=global.window.OtroCadArquiPlanner;
delete global.window;
const professional=require('../editor/arqui-professional.js');
const userBridge=require('../editor/arqui-user-ai.js');
const oauthBridge=require('../editor/arqui-oauth.js');
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
const window={OtroCadUserAI:userBridge,OtroCadArquiOAuth:oauthBridge,OtroCadArquiPlanner:planner,OtroCadArquiProfessional:professional,OtroCadArquiReferences:refs,OtroCadCivilAPI:api,addEventListener(){}};
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
assert.match(nodes.arquiMode.textContent,/local|no conectada/,'Never misrepresent missing generative endpoint');
window.OtroCadArqui.open();
assert.equal(nodes.arquiPanel.hidden,false,'Chat opens on request');
assert.ok(nodes.arquiPreview.children.length>4,'Plan visualization created');
assert.match(nodes.arquiSummary.textContent,/entidades/);
assert.ok(nodes.arquiWarnings.children.length>0,'Professional warnings displayed');
assert.ok(nodes.arquiDraw.disabled===false,'Valid preview enables draw');

async function testOnlineToEditableCad(){
 const requestText='Quiero una casa de 10 x 8 metros, 3 habitaciones: una máster con baño y dos con baño compartido; sala comedor, cocina con isla, patio posterior de 3 metros con lavandería y puerta, y parqueadero para dos carros.';
 let answer={
  spec:{dimensionMeaning:'house',houseWidth:10,houseDepth:8,siteAssumed:true,
   lotWidth:10,lotDepth:16.5,frontSetback:5.5,backSetback:3,sideSetback:0,
   floors:2,bedrooms:3,bathrooms:2,mainSuite:true,socialBath:false,
   kitchenIsland:true,patioDepth:3,patioLaundry:true,rearDoor:true,
   garage:true,garageSpaces:2},
  reason:'Casa de 10×8 m en dos plantas; predio hipotético 10×16,5 m para patio y dos estacionamientos.',
  requiresReview:false
 };
 const captured=[];
 let httpStatus=200;
 context.fetch=async function(url,options){
  assert.strictEqual(this,window,'Browser fetch must retain Window receiver');
  captured.push({url,options});
  if(httpStatus===429)return {ok:false,status:429,json:async()=>({error:{message:'limit'}})};
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify(answer)}}]})};
 };
 nodes.arquiAiProvider.value='openrouter';
 nodes.arquiAiKey.value='sk-or-personal-testing-not-a-real-key';
 nodes.arquiAiProvider.listeners.change();
 nodes.arquiAiKey.listeners.input();
 assert.match(nodes.arquiMode.textContent,/IA personal lista/);
 assert.equal(nodes.arquiAiLogin.hidden,false,'OAuth option is available for OpenRouter');
 const before=data.length;
 await window.OtroCadArqui.propose(requestText);
 assert.equal(captured.length,1,'Exactly one request to the user provider');
 assert.equal(captured[0].url,'https://openrouter.ai/api/v1/chat/completions');
 const auth=captured[0].options.headers.Authorization;
 assert(auth.includes('sk-or-personal-testing-not-a-real-key'));
 const sent=JSON.parse(captured[0].options.body);
 assert.equal(sent.model,'openrouter/free','No billable model by default');
 assert(sent.messages[1].content.includes(requestText),'Full natural request reaches external model');
 assert(!JSON.stringify(sent).includes('sk-or-personal-testing-not-a-real-key'),'Key is not sent in prompt data');
 const proposal=window.OtroCadArqui.preview();
 assert.equal(proposal.spec.dimensionMeaning,'house');
 assert.equal(proposal.spec.houseWidth,10);
 assert.equal(proposal.spec.houseDepth,8);
 assert.equal(proposal.spec.lotDepth,16.5);
 assert.equal(proposal.spec.patioDepth,3);
 assert.equal(proposal.floors.length,2);
 assert.equal(proposal.garage.spaces,2);
 assert.equal(proposal.floors.flatMap(f=>f.rooms).filter(r=>r.kind==='bedroom').length,3);
 assert.equal(proposal.floors.flatMap(f=>f.rooms).filter(r=>r.kind==='bath').length,2);
 assert.equal(data.length,before,'Submitting to AI only creates preview, never writes CAD');
 assert(nodes.arquiPreview.children.length>100,'SVG preview contains real CAD drawing objects');
 assert.equal(nodes.arquiDraw.disabled,false,'Approval button becomes available');
 await nodes.arquiDraw.click();
 assert(data.length>300,'Approval creates hundreds of editable 2D CAD entities');
 assert(data.some(e=>e.layer==='AI-ARQ-PATIO'),'Backyard is a real CAD layer');
 assert(data.some(e=>e.layer==='AI-ARQ-GARAJE'),'Parking is a real CAD layer');
 assert(data.some(e=>e.layer==='AI-ARQ-MUROS'),'Walls are editable');
 assert(data.some(e=>e.layer==='AI-ARQ-COTAS'),'Dimensions are editable');
 assert(data.some(e=>e.layer==='AI-ARQ-HATCH-MUROS'),'Wall hatches are editable');
 const labels=data.filter(e=>e.type==='text').map(e=>e.text);
 assert(labels.includes('PARQUEO 1')&&labels.includes('PARQUEO 2'));
 assert(labels.some(t=>t.includes('LAVANDERÍA')));
 assert(labels.some(t=>t.includes('PATIO POSTERIOR')));
 assert(data.some(e=>e.aiDesignSpec?.houseWidth===10),'CAD objects persist the accepted program');
 const count=data.length;
 const kitchen=proposal.floors[0].rooms.find(r=>/COCINA/.test(r.name)).depth;
 answer={spec:{kitchenExtra:.5},reason:'Cocina ampliada 50 cm',requiresReview:false};
 await window.OtroCadArqui.propose('Ahora agranda la cocina 50 cm');
 const newPlan=window.OtroCadArqui.preview();
 const adjusted=newPlan.floors[0].rooms.find(r=>/COCINA/.test(r.name)).depth;
 assert(Math.abs(adjusted-kitchen-.5)<.005,'Natural language follow-up must adjust actual kitchen geometry');
 assert.equal(data.length,count,'Follow-up is still preview-only');
 await nodes.arquiDraw.click();
 assert.equal(replacements,1,'Follow-up replaces grouped CAD design');
 assert(data.some(e=>e.aiDesignSpec?.kitchenExtra===.5),'Edited CAD metadata persists new dimensions');
 const lastPlan=window.OtroCadArqui.preview();
 const lastData=data.length;
 httpStatus=429;
 await window.OtroCadArqui.propose('Agrega una piscina');
 assert.strictEqual(window.OtroCadArqui.preview(),lastPlan,'Quota errors preserve the previous plan');
 assert.equal(data.length,lastData,'Quota errors never change CAD entities');
 assert.match(nodes.arquiMessages.children.at(-1).children.at(-1).textContent,/cuota/);
 assert(!nodes.arquiAiKey.value.includes('sk-or-v1-'),'No OAuth token is created without user approval');
 nodes.arquiAiClear.click();
 assert.equal(nodes.arquiAiKey.value,'','Disconnect must clear browser key');
 assert.equal(nodes.arquiAiProvider.value,'none');
 console.log('Online El Arqui -> free OpenRouter mock -> preview -> 2D editable CAD -> kitchen change -> quota isolation: OK');
}
testOnlineToEditableCad().catch(e=>{console.error(e);process.exitCode=1});
