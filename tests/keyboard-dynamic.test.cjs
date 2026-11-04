'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const cad=fs.readFileSync('editor/editor.js','utf8');
const html=fs.readFileSync('editor/index.html','utf8');
const civil=fs.readFileSync('editor/civil3d.js','utf8');
const head=cad.indexOf('function activeAnchor(){'),tail=cad.indexOf('function showDraftSettings(){',head);
assert.ok(head>=0&&tail>head,'Cursor input functions must remain present');
const labels=new Map();
const $=selector=>{
 if(!labels.has(selector))labels.set(selector,{style:{display:'none'},value:'',textContent:''});
 return labels.get(selector);
};
const stage={clientWidth:420,clientHeight:260,children:[],append(el){this.children.push(el)}};
const context={
 stage,document:{activeElement:null,createElement:()=>({
  hidden:true,style:{},offsetWidth:150,offsetHeight:28,
  setAttribute(){},textContent:''
 })},
 localStorage:{getItem:()=>null,setItem(){}},$,
 tool:'line',units:'m',poly:[],start:{x:0,y:0},
 temp:{a:{x:0,y:0},b:{x:3,y:4}},
 cursor:{x:100,y:100},
 distance:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),
 angle:(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,
 normalize:a=>(a%360+360)%360,
 screen:p=>({x:p.x*20,y:p.y*20}),
 status:{textContent:''},window:{}
};
vm.createContext(context);
vm.runInContext(cad.slice(head,tail),context);
vm.runInContext('updateDynamic()',context);
assert.match(stage.children[0].textContent,/5\.000 m/,'distance must follow actual point');
assert.match(stage.children[0].textContent,/53\.1°/,'angle must follow cursor');
assert.equal(stage.children[0].hidden,false,'measurement must be visible during drawing');
assert.equal(labels.get('#dynamic').style.display,'flex','editable dimensions must remain available');
assert.ok(Number.parseFloat(stage.children[0].style.left)>0,'cursor measurement positioned on canvas');
vm.runInContext('toggleDynamicInput()',context);
assert.equal(stage.children[0].hidden,true,'F12 must hide dimensions');
assert.equal(labels.get('#dynamic').style.display,'none','F12 must hide editable dimensions');
vm.runInContext('toggleDynamicInput()',context);
assert.equal(stage.children[0].hidden,false,'F12 must restore dimensions');
context.start=null;
vm.runInContext('updateDynamic()',context);
assert.equal(stage.children[0].hidden,true,'no measurement when no drawing anchor');

assert.match(cad,/Space must remain a valid separator in commands/,'command input spaces must not trigger Enter');
assert.match(cad,/shortcut=\{s:'#saveAsDwg',o:'#open',n:'#newDrawing',p:'#pdf'\}/,'file keyboard shortcuts must be connected');
assert.match(cad,/k==='1'/,'Ctrl+1 properties shortcut missing');
assert.match(cad,/k==='e'&&e\.shiftKey/,'Ctrl+Shift+E DXF export missing');
assert.match(cad,/if\(e\.key==='F12'\)/,'F12 keyboard event handler missing');
assert.match(cad,/if\(c==='F12'\|\|c==='DYNMODE'/,'DYNMODE command missing');
assert.match(cad,/if\(window\.OtroCadCivilCommands/,'Civil command router missing');
assert.match(cad,/function showCadKeyboardHelp\(\)/,'shortcut help is missing');
assert.match(html,/id="keyboardHelpBtn"/,'help button should be present');
assert.match(html,/\.cad-cursor-measure\[hidden\]\{display:none!important\}/,'cursor bubble must honor hidden');
assert.match(html,/pointer-events:none;user-select:none/,'cursor bubble must not block grips or taps');
assert.match(civil,/window\.OtroCadCivilCommands=\{/,'Civil tool keyboard aliases are missing');
for(const cmd of ['C3DTIN','C3DCONTOURS','C3DPROFILE','C3DSECTION','C3DVOLUME','C3DEXPORTTIN']){
 assert.match(civil,new RegExp(cmd+':'),'missing Civil command '+cmd);
}
console.log('Keyboard and cursor dimension regression passed: F12, cursor position, file shortcuts, Civil aliases and command spacing.');
