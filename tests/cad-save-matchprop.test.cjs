'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const editor=fs.readFileSync('editor/editor.js','utf8');
const html=fs.readFileSync('editor/index.html','utf8');
const saveUI=fs.readFileSync('editor/cad-file-ui.js','utf8');
const css=fs.readFileSync('editor/cad-file-ui.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const pack=fs.readFileSync('scripts/build-pages.cjs','utf8');
const android=fs.readFileSync('scripts/verify-android-offline.cjs','utf8');
const keys=['MA','MATCHPROP','IGUALAR'];
for(const alias of keys){
 assert.match(editor,new RegExp(alias+":'matchprop'"),'Missing keyboard alias '+alias);
}
assert.match(editor,/function matchPropertiesAt\(q\)/);
assert.match(editor,/matchState\.source=clone\(item\)/,'Source property snapshot required');
assert.match(editor,/matchStyleKeys=\[/);
assert.match(editor,/matchTypeKeys=/);
assert.match(editor,/if\(item\.type===source\.type\)/,'Type-specific property transfer must be guarded');
assert.match(editor,/if\(lockedLayers\.has\(item\.layer\)\)/);
assert.match(editor,/checkpoint\(\);[\s\S]*?item\[key\]=value/,'Properties must be undoable');
assert.match(editor,/if\(tool==='matchprop'\)\{matchPropertiesAt\(world\(p\)\);return\}/);
assert.ok(html.includes('data-tool="matchprop"'));
assert.match(editor,/function safeDrawingFilename\(name,format\)/);
assert.match(editor,/async function saveDrawingAs\(format=/);
assert.match(editor,/async function drawingContent\(format\)/);
assert.match(editor,/getDwgRuntime\(\)/);
assert.match(editor,/engine\.dxf_to_dwg/);
assert.match(editor,/engine\.dwg_to_dxf/);
assert.match(editor,/check\.length!==expected\.length/,'DWG round-trip validation required');
assert.match(editor,/showSaveFilePicker/);
assert.match(editor,/OtroCadAndroid/);
assert.match(editor,/window\.OtroCadFileCore=\{/);
assert.match(editor,/cadRecoveryWrite\('autosave-latest'/);
assert.match(editor,/cadRecoveryWrite\('autosave-previous'/);
assert.match(editor,/window\.addEventListener\('visibilitychange'/);
assert.match(editor,/setInterval\(\(\)=>\{if\(cadAutosaveDirty\)/);
assert.match(editor,/s:e\.shiftKey\?'#saveAs':'#save'/,'Ctrl+S and Ctrl+Shift+S should use unified saving');
assert.match(html,/id="saveAs"/);
assert.match(html,/id="saveLocal"/);
assert.match(html,/id="recoverProgress"/);
assert.match(saveUI,/core\.saveAs\(type\.value,name\.value\)/);
assert.match(saveUI,/core\.restoreProgress\(slot\)/);
assert.match(saveUI,/keydown/);
assert.match(saveUI,/Ctrl\+S|event\.shiftKey/);
assert.match(css,/orientation:landscape/);
for(const item of ['cad-file-ui.js','cad-file-ui.css']){
 assert.ok(html.includes(item));
 assert.ok(sw.includes('./editor/'+item));
 assert.ok(pack.includes("'editor/"+item+"'"));
 assert.ok(android.includes("'"+item+"'"));
}
const vm=require('node:vm');
const styleSource=editor.slice(editor.indexOf('const matchState='),editor.indexOf('function setTool(',editor.indexOf('const matchState=')));
assert.ok(styleSource.includes('function matchPropertiesAt('));
const original={
 type:'line',a:{x:1,y:2},b:{x:5,y:2},layer:'Capa origen',
 color:'#ffcc00',lineweight:.5,linetype:'DASHED'
};
const dest={type:'line',a:{x:10,y:10},b:{x:20,y:12},layer:'Capa destino',
 color:'#ffffff',lineweight:.13,linetype:'CONTINUOUS'};
const destText={type:'text',a:{x:40,y:25},text:'NO MOVER',textFontFamily:'Arial',layer:'Texto',color:'#ffffee'};
const objs=[original,dest,destText];
let checkpoints=0,saves=0,renders=0,layerApplied='';
const context={objects:objs,lockedLayers:new Set(['Bloqueada']),
 status:{textContent:''},clone:v=>JSON.parse(JSON.stringify(v)),
 checkpoint:()=>{checkpoints++},save:()=>{saves++},render:()=>{renders++},
 selectAt:q=>q.index,window:{OtroCadCivilAPI:{ensureLayer:k=>{layerApplied=k}}}};
vm.createContext(context);vm.runInContext(styleSource,context);
vm.runInContext('matchPropertiesAt({index:0})',context);
vm.runInContext('matchPropertiesAt({index:1})',context);
assert.deepEqual(dest.a,{x:10,y:10});assert.deepEqual(dest.b,{x:20,y:12},
 'MA must preserve target coordinates');
assert.equal(dest.layer,'Capa origen');
assert.equal(dest.color,'#ffcc00');
assert.equal(dest.lineweight,.5);
assert.equal(dest.linetype,'DASHED');
assert.equal(layerApplied,'Capa origen');
assert.equal(checkpoints,1);assert.equal(saves,1);assert.equal(renders,1);
vm.runInContext('matchPropertiesAt({index:2})',context);
assert.equal(destText.layer,'Capa origen');
assert.equal(destText.text,'NO MOVER');
assert.equal(destText.textFontFamily,'Arial','MA must not transfer geometry or incompatible text fields');
destText.layer='Bloqueada';vm.runInContext('matchPropertiesAt({index:2})',context);
assert.equal(destText.layer,'Bloqueada');
assert.equal(checkpoints,2,'Locked layer must not be changed or create undo checkpoint');
console.log('CAD saving and MA checks passed: alias, keyboard, visual button, DWG validation, Save As and incremental IndexedDB recovery.');
