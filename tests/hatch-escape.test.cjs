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
