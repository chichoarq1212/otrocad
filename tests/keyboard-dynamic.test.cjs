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
 if(!labels.has(selector))labels.set(selector,{style:{display:'none'},value:'',textContent:'',hidden:false,
  tagName:selector==='#dynLen'||selector==='#dynAngle'?'INPUT':'DIV',
  classList:{toggle(){}},setAttribute(){},select(){this.selected=true},
  focus(){context.document.activeElement=this}});
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

// Exercise the actual rectangle input, keyboard routing and entity commit functions.
Object.assign(context,{objects:[],lockedLayers:new Set(),clone:x=>JSON.parse(JSON.stringify(x)),
 round:p=>p,checkpoint(){},save(){},applySelection(){},updatePrompt(){},
 currentStyle:()=>({layer:'General'}),updateCursorCommand(){},
 render(){vm.runInContext('updateDynamic()',context)},cancelCurrentAction(){context.start=null}});
stage.focus=()=>{context.document.activeElement=stage};
vm.runInContext(cad.slice(cad.indexOf('function pointFromInputs(){'),cad.indexOf('function currentStyle(')),context);
vm.runInContext(cad.slice(cad.indexOf('function commitEntity(endPoint){'),cad.indexOf('function finishPoly()')),context);
function press(key){
 context.testKey={key,preventDefault(){this.prevented=true}};
 return vm.runInContext('handleCursorDimensionKey(testKey,document.activeElement)',context);
}
for(const sx of [-1,1])for(const sy of [-1,1]){
 context.tool='rect';context.start={x:10,y:20};context.temp={b:{x:10+2*sx,y:20+4*sy}};
 context.document.activeElement=null;
 vm.runInContext('resetRectangleDimensions();rectangleCorner(temp.b);updateDynamic()',context);
 assert.match(labels.get('#dynamic label').textContent,/ANCHO/);
 assert.match(labels.get('#dynAngleLabel').textContent,/ALTO/);
 assert.equal(stage.children[0].hidden,true,'rectangle uses editable dimensions, not a diagonal length');
 assert.equal(press('5'),true,'typing should enter the width at the cursor');
 assert.equal(press('Tab'),true,'Tab locks width and selects height');
 assert.equal(context.document.activeElement,labels.get('#dynAngle'));
 labels.get('#dynAngle').value='3';vm.runInContext("updateRectangleInput('height','3')",context);
 const before=context.objects.length;
 press('Enter');
 const shape=context.objects[before];
 assert.equal(shape.type,'rect');assert.equal(shape.b.x,10+5*sx);assert.equal(shape.b.y,20+3*sy);
 assert.equal(context.start,null);
}
context.start={x:0,y:0};context.temp={b:{x:2,y:2}};context.document.activeElement=null;
vm.runInContext('resetRectangleDimensions();updateDynamic()',context);
press('4');press(';');assert.equal(context.document.activeElement,labels.get('#dynAngle'),'semicolon also switches dimensions');
labels.get('#dynAngle').value='0';vm.runInContext("updateRectangleInput('height','0')",context);
const count=context.objects.length;press('Enter');assert.equal(context.objects.length,count,'zero-height rectangles must not be committed');
labels.get('#dynAngle').value='2.5';vm.runInContext("updateRectangleInput('height','2.5')",context);
labels.get('#dynLen').value='-4';vm.runInContext("updateRectangleInput('width','-4')",context);
press('Enter');assert.equal(context.objects.at(-1).b.x,-4,'negative width specifies the negative X direction');
context.start={x:0,y:0};context.temp={b:{x:2,y:2}};context.document.activeElement=null;
vm.runInContext('resetRectangleDimensions();updateDynamic()',context);
labels.get('#dynLen').value='1.123456';labels.get('#dynAngle').value='2.765432';
press('Enter');assert.equal(context.objects.at(-1).b.x,1.123456,'Typed dimensions must not be rounded to cursor display precision');

context.tool='offset';context.offsetDistance=1;context.offsetDistancePreset=false;
context.document.activeElement=null;labels.get('#dynLen').value='1';
vm.runInContext('offsetAwaitingDistance=true;updateDynamic()',context);
assert.equal(labels.get('#dynAngle').hidden,true,'OFFSET only asks for distance');
assert.equal(labels.get('#acceptPoint').hidden,true,'OFFSET does not open an accept/cancel window');
assert.equal(press('2'),true);press('Enter');
assert.equal(context.offsetDistance,2);assert.equal(context.offsetDistancePreset,true);
assert.equal(vm.runInContext('offsetAwaitingDistance',context),false);
vm.runInContext('offsetAwaitingDistance=true',context);labels.get('#dynLen').value='-1';
press('Enter');assert.equal(context.offsetDistance,2,'invalid distance must not replace the accepted OFFSET');
assert.equal(vm.runInContext('offsetAwaitingDistance',context),true);
assert.doesNotMatch(cad,/function showOffsetInput|offsetInline/,'OFFSET must never mount the old floating window');

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
