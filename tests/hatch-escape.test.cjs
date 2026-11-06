'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('editor/editor.js','utf8');
let deselected=false,gripCancelled=false,closed=0,properties=0;
const sandbox={
 $:()=>({value:'test'}), updateCursorCommand(){},hideCadContextMenu(){},
 gripDrag:{},cancelGripDrag(){gripCancelled=true;sandbox.gripDrag=null},setTool(t){sandbox.tool=t},clearSelection(){deselected=true},
 selectionStart:{},selectionBox:{},selectionClickAnchor:{},activeSnap:{},drag:{},middlePan:{},pinch:{},pointers:new Map([[1,{}]]),
 document:{querySelectorAll:()=>[{close(){closed++}}]},render(){},showProperties(){properties++},updatePrompt(){},status:{textContent:''}
};
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('function cancelCurrentAction(){'),source.indexOf('function performEnterAction(){')),sandbox);
vm.runInContext('cancelCurrentAction()',sandbox);
assert.ok(deselected);assert.ok(gripCancelled);assert.equal(closed,1);assert.equal(properties,1);assert.equal(sandbox.pointers.size,0);assert.equal(sandbox.selectionBox,null);assert.equal(sandbox.tool,'select');
assert.match(source,/if\(e\.key==='Escape'\)\{e\.preventDefault\(\);cancelCurrentAction\(\);if\(document\.activeElement\?\.blur\)/);
console.log('Esc cancels active grip, selection, dialogs and pointer state before input handling');
const select={objects:[{type:'rect',a:{x:0,y:0},b:{x:5,y:3},layer:'A'}],selectedItems:()=>[0],distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clone:x=>JSON.parse(JSON.stringify(x)),entitySegments:s=>s.type==='poly'?[[s.pts[0],s.pts[1]]]:[[s.a,{x:s.b.x,y:s.a.y}],[{x:s.b.x,y:s.a.y},s.b],[s.b,{x:s.a.x,y:s.b.y}],[{x:s.a.x,y:s.b.y},s.a]],$:s=>({value:s==='#hatchPattern'?'SOLID':s==='#hatchSpacing'?'10':'A'}),hatchSettings:{angle:45,opacity:1,color:'#888888',origin:{x:0,y:0}},currentStyle:()=>({layer:'A'}),checkpoint(){},save(){},setTool(){},applySelection(){},render(){},status:{textContent:''}};
vm.createContext(select);
vm.runInContext(source.slice(source.indexOf('function hatchSelectedBoundary(){'),source.indexOf('function recreateHatchBoundaries(){')),select);
vm.runInContext('hatchSelectedBoundary()',select);
assert.equal(select.objects.length,2);assert.equal(select.objects[1].hatchLoops[0].length,4);assert.equal(select.objects[1].hatchPattern,'SOLID');
select.objects=[{type:'poly',pts:[{x:0,y:0},{x:1,y:0}]}];vm.runInContext('hatchSelectedBoundary()',select);assert.equal(select.objects.length,1);
console.log('Closed rectangle hatch creates a bounded fill; an open polyline is refused');
