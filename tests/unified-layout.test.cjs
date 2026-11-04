'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('editor/editor.js','utf8');
const html=fs.readFileSync('editor/index.html','utf8');
const between=(a,b)=>{
 const i=src.indexOf(a),j=src.indexOf(b,i+1);
 assert.ok(i>=0&&j>i,'Missing function boundary '+a);
 return src.slice(i,j);
};
const functions=between('function defaultCadLayout(){','function saveLayoutState(){');
const defaultCtx={layouts:[]};
vm.createContext(defaultCtx);
vm.runInContext(functions,defaultCtx);
const sheet=vm.runInContext('ensureCadLayout()',defaultCtx);
assert.equal(defaultCtx.layouts.length,1,'create a single default layout');
assert.equal(sheet.name,'Presentación 1');
assert.equal(sheet.paperWidth,420);assert.equal(sheet.paperHeight,297);
assert.equal(sheet.sheetTemplate,true,'A3 sheet frame and titleblock enabled for new drawings');
assert.equal(sheet.viewportFit,'all');
vm.runInContext('ensureCadLayout();ensureCadLayout()',defaultCtx);
assert.equal(defaultCtx.layouts.length,1,'do not create duplicate layout tabs');
defaultCtx.layouts=[{name:'P1'},{name:'P2'},{name:'P3'}];
assert.equal(vm.runInContext('ensureCadLayout().name',defaultCtx),'P1');
assert.equal(defaultCtx.layouts.length,3,'never destroy imported drawing sheets P1/P2/P3');

const viewportSource=between('function cadStandardSheetArea(layout){','function describePaperLayoutState(');
const ctx={
 layouts:[],objects:[],layoutViewportRecords:[],units:'m',
 modelExtentsForPaper:()=>({center:{x:500000,y:9970000},width:100,height:50}),
 cadPaperMissingViewportArea:()=>({center:{x:180,y:150},width:320,height:260}),
 cadPaperViewportUsable:()=>true,
 modelPaperViewportEstimate:v=>v,
 manualCadPaperView:()=>null,
 Number,Math,Array,Object,Set
};
vm.createContext(ctx);
vm.runInContext(viewportSource,ctx);
const native=vm.runInContext('effectivePaperViewports(layout)',Object.assign(ctx,{layout:JSON.parse(JSON.stringify(sheet))}));
assert.equal(native.length,1);
assert.ok(native[0].height<sheet.paperHeight-20,'the view must reserve room for the titleblock');
assert.equal(native[0].viewCenter.x,500000,'topographic UTM center must not be rounded away');
assert.equal(native[0].viewCenter.y,9970000);
assert.ok(Math.abs(native[0].center.y-native[0].height/2-(10+Math.max(28,Math.min(38,297*.12))))<1e-8,'viewport must start above titleblock');
ctx.layout.plotScale=500;
const at500=vm.runInContext('effectivePaperViewports(layout)',ctx);
assert.ok(Math.abs(at500[0].viewHeight-at500[0].height*.5)<1e-9,'1:500 paper-to-meter conversion');
const custom={layout:'Presentación 1',id:2,center:{x:100,y:120},width:180,height:210,viewCenter:{x:500010,y:9970010},viewHeight:105};
ctx.layout.viewportFit='custom';ctx.layout.customViewports=[custom];
const customViews=vm.runInContext('effectivePaperViewports(layout)',ctx);
assert.equal(customViews.length,1);
assert.equal(customViews[0].viewCenter.y,9970010,'selected custom Civil viewport retained');
ctx.layout.viewportFit='all';
assert.ok(vm.runInContext('effectivePaperViewports(layout)',ctx)[0].generated,'default view can be restored');

assert.match(src,/function showCadViewportManager\(\)/,'a unified layout should allow viewport scale editing');
assert.match(src,/function drawUnifiedSheetTemplate\(/,'new sheet should have real titleblock preview');
assert.match(src,/layout\.plotStyle=byId\('paperPlotStyle'\)\.value/,'page setup should persist plot style');
assert.match(src,/if\(c==='PAGESETUP'/,'PAGESETUP keyboard compatibility missing');
assert.match(src,/if\(c==='MVIEW'/,'MVIEW keyboard compatibility missing');
assert.match(html,/id="paperViewports"/,'viewport control missing');
assert.match(html,/id="paperSetup"/,'page setup control missing');
console.log('Unified CAD/Civil Layout passed: one default A3 sheet, titleblock reservation, UTM coordinate precision, imported sheets and viewports.');
