'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync('editor/index.html','utf8');
const css=fs.readFileSync('editor/jaimito-assistant.css','utf8');
const src=fs.readFileSync('editor/jaimito-assistant.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const asset='editor/assets/ing-jaimito-hd.webp';
const bytes=fs.readFileSync(asset);
assert.equal(bytes.toString('ascii',0,4),'RIFF','Mascot must have a valid RIFF header');
assert.equal(bytes.toString('ascii',8,12),'WEBP','Mascot must be a WEBP image');
assert.equal(bytes.toString('ascii',12,16),'VP8X','Mascot must support alpha');
assert.ok(bytes[20]&0x10,'Ing Jaimito mascot must keep background transparency');
assert.ok(1+bytes.readUIntLE(24,3)>=384,'Mascot must remain sharp on high-DPI displays');
assert.ok(1+bytes.readUIntLE(27,3)>=768,'Do not replace the HD mascot with a small thumbnail');
for(const filename of ['jaimito-assistant.js','jaimito-assistant.css'])assert.match(html,new RegExp(filename.replace('.','\\.')));
assert.match(html,/src="civil3d\.js"><\/script><script src="jaimito-assistant\.js"/,'Assistant must load after Civil 3D commands');
for(const part of ['jaimito-assistant.js','jaimito-assistant.css','assets/ing-jaimito-hd.webp']){
 assert.ok(sw.includes(part),'Offline worker must include '+part);
}
assert.match(css,/pointer-events:none/,'Assistant container must not interfere with CAD drawing');
assert.match(css,/safe-area-inset-bottom/,'Respect iPhone safe area');
assert.match(css,/orientation:landscape/,'Respect mobile landscape');
assert.match(src,/window\.OTROCAD_JAIMITO_AI_ENDPOINT/,'Configurable secure generative endpoint');
assert.doesNotMatch(src,/sk-[a-zA-Z0-9]{12,}/,'Never embed provider API tokens');
assert.match(src,/Guía técnica inteligente · sin IA generativa/,'Do not misrepresent a missing generative endpoint');

// Minimal browser mock exercises visibility, chat and Civil command invocation.
const nodes={};
function node(id,tag='DIV'){
 const classes=new Set();
 const o={
  id,tagName:tag,hidden:false,style:{},dataset:{},children:[],childElementCount:0,
  textContent:'',value:'',scrollTop:0,scrollHeight:0,attributes:{},listeners:{},
  classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),
   toggle(x,on){if(on===undefined?(!classes.has(x)):on)classes.add(x);else classes.delete(x)}},
  setAttribute(x,y){o.attributes[x]=String(y)},getAttribute:x=>o.attributes[x]??null,
  addEventListener(name,handler){(o.listeners[name] ||= []).push(handler)},
  append(...args){for(const arg of args){o.children.push(arg);o.childElementCount=o.children.length}},
  focus(){},
  querySelector(sel){if(sel==='[data-tab="civil"]')return nodes.civil;return null}
 };
 Object.defineProperty(o,'innerHTML',{get(){return o._html||''},set(value){
  o._html=String(value);
  for(const m of o._html.matchAll(/\bid="([^"]+)"/g)){
   if(!nodes[m[1]])nodes[m[1]]=node(m[1],m[1]==='jaimitoQuestion'?'INPUT':'DIV');
  }
  if(o.id==='jaimitoAssistant')nodes.jaimitoPanel.hidden=true;
 }});
 nodes[id]=o;return o;
}
const tab=node('civil','BUTTON');tab.dataset.tab='civil';tab.setAttribute('aria-selected','false');
const tabs=node('tabs');const stage=node('stage');const body=node('body');
const doc={body,getElementById:id=>nodes[id]||null,createElement:tag=>node(tag==='div'&&!nodes.jaimitoAssistant?'jaimitoAssistant':'anonymous-'+Object.keys(nodes).length,tag.toUpperCase()),
 addEventListener(){},activeElement:null};
let pointsOpened=0,tinStarted=0;
const window={
 OtroCadCivilCommands:{C3DPOINTS:()=>{pointsOpened++},C3DTIN:()=>{tinStarted++}},
 OtroCadCivilAPI:{getObjects:()=>[{type:'point',z:900},{civilTin:true}],getUnits:()=> 'm'},
 addEventListener(){},location:{href:'https://example.org/editor/'}
};
const context={document:doc,window,location:window.location,
 localStorage:{getItem:()=>null,setItem(){}},MutationObserver:class{observe(){}},
 queueMicrotask:f=>f(),URL,AbortController,setTimeout,clearTimeout,console};
vm.createContext(context);
vm.runInContext(src,context);
assert.ok(nodes.jaimitoAssistant,'Assistant must mount in editor');
assert.equal(nodes.jaimitoAssistant.hidden,true,'Mascot must be hidden outside Civil');
assert.equal(nodes.jaimitoAvatar.src,'assets/ing-jaimito-hd.webp','Use the high-resolution transparent avatar');
tab.classList.add('active');tab.setAttribute('aria-selected','true');
window.OtroCadJaimito.sync();
assert.equal(nodes.jaimitoAssistant.hidden,false,'Show mascot only on Civil tab');
assert.equal(tabs.children.find(x=>x.id==='jaimitoRibbon').hidden,false,'Allow reopening assistant from Civil ribbon');
window.OtroCadJaimito.open();
assert.equal(nodes.jaimitoPanel.hidden,false,'Chat must open from mascot/ribbon');
assert.match(nodes.jaimitoMessages.children[0].children[1].textContent,/Soy el Ing\. Jaimito/);
assert.equal(window.OtroCadJaimito.runTool('C3DTIN'),true);
assert.equal(tinStarted,1,'Civil TIN button must execute real command');
assert.equal(window.OtroCadJaimito.runTool('C3DPOINTS'),true);
assert.equal(pointsOpened,1,'Civil import tool must execute');
window.OtroCadJaimito.close();
assert.equal(nodes.jaimitoPanel.hidden,true,'Minimize hides chat');
assert.equal(nodes.jaimitoAssistant.hidden,false,'Minimize retains floating character');
tab.classList.remove('active');tab.setAttribute('aria-selected','false');
window.OtroCadJaimito.sync();
assert.equal(nodes.jaimitoAssistant.hidden,true,'Leaving Civil must hide mascot');
// Keep the sharper, larger mascot clear of both ordinary and expanded phone controls.
const root=nodes.jaimitoAssistant;
root.style.setProperty=(name,value)=>{root.style[name]=value};
window.innerHeight=900;
stage.getBoundingClientRect=()=>({top:150,bottom:842,height:692});
node('layoutBar').getBoundingClientRect=()=>({top:804,height:38});
node('commandbar').getBoundingClientRect=()=>({top:842,height:31});
window.OtroCadJaimito.sync();
assert.equal(root.style['--jaimito-bottom'],'104px','Mascot must sit above layout buttons');
nodes.commandbar.getBoundingClientRect=()=>({top:728,height:40});
window.OtroCadJaimito.sync();
assert.equal(root.style['--jaimito-bottom'],'180px','Expanded phone commands must remain unobstructed');
console.log('Ing. Jaimito checks passed: transparent avatar, only Civil, conversation, Civil commands, mobile CSS and offline assets.');
