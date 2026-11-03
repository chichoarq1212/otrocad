'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const editor=fs.readFileSync('editor/editor.js','utf8');
const start=editor.indexOf('function parseDxfEntities(source){');
const end=editor.indexOf('\nasync function download',start);
assert.ok(start>=0&&end>start,'parseDxfEntities must remain available for regression testing');
const context={
 colors:{General:'#dce8f5',Topografía:'#70d6a3'},
 distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
 cadFontFamilyFromFile:()=> 'Arial',
 console
};
vm.createContext(context);
vm.runInContext(editor.slice(start,end)+'\nthis.parseDxfEntities=parseDxfEntities;',context);
const fixture=[
'0','SECTION','2','BLOCKS',
'0','BLOCK','2','INTERV_PB','10','0','20','0',
'0','HATCH','5','H1','8','A-RELLENO-MURO','2','SOLID','70','1','71','0','91','1','92','3','72','0','73','1','93','2',
'10','0','20','0','10','0','20','0.1','97','0','75','1','76','1','98','0',
'0','ENDBLK','2','INTERV_PB',
'0','ENDSEC',
'0','SECTION','2','ENTITIES',
'0','INSERT','2','INTERV_PB','10','100','20','200','41','1','42','1','50','0',
'0','POINT','8','TOPO','10','1','20','2','30','125.75',
'0','3DFACE','8','TIN','10','0','20','0','30','10','11','10','21','0','31','11','12','0','22','10','32','12','13','0','23','10','33','12','70','0',
'0','ENDSEC','0','EOF'
].join('\n');
const result=context.parseDxfEntities(fixture);
assert.equal(result.importWarnings.length,0,'degenerate solid HATCH should no longer create HATCH/INSERT warnings');
const recovered=result.find(o=>o.cadHatchRecovery==='degenerate-solid');
assert.ok(recovered,'the degenerate HATCH must be preserved as a recoverable segment');
assert.equal(recovered.type,'line');
assert.ok(Math.abs(recovered.a.x-100)<1e-8&&Math.abs(recovered.a.y-200)<1e-8,'the recovered segment must respect the INSERT transform');
assert.ok(Math.abs(recovered.b.y-200.1)<1e-8);
assert.ok(result.importNotes.some(n=>n.includes('HATCH sólido degenerado')));
const point=result.find(o=>o.type==='point');
assert.equal(point.z,125.75,'POINT elevation must survive DXF import');
const face=result.find(o=>o.civilTin);
assert.ok(face&&face.pts.length===3,'3DFACE should import as a 3D surface triangle');
assert.deepEqual(Array.from(face.pts,p=>p.z),[10,11,12]);
console.log('DXF import regression checks passed: degenerate HATCH, nested INSERT, XYZ point and 3DFACE elevations');
