'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('editor/civil3d.js','utf8');
const window={};
const document={getElementById:()=>null};
vm.runInNewContext(source,{window,document,console});
const math=window.OtroCadCivilMath;
assert.ok(math,'Civil geometry functions must be exported for testing');
const points=[
 {x:0,y:0,z:0,id:'P1'},
 {x:1,y:0,z:1,id:'P2'},
 {x:1,y:1,z:2,id:'P3'},
 {x:0,y:1,z:1,id:'P4'}
];
const tin=math.triangulate(points);
assert.equal(tin.points.length,4);
assert.equal(tin.triangles.length,2,'a square survey should form two TIN triangles');
assert.ok(Math.abs(math.sampleSurface(tin.triangles,.25,.5)-.75)<1e-7,'barycentric elevation interpolation should match z=x+y');
assert.ok(Math.abs(math.slopePercent(tin.triangles[0])-Math.sqrt(2)*100)<1e-6,'slope should be computed from the surface gradient');
const contours=math.contourLines(tin.triangles,.5);
assert.ok(contours.length>=3,'contours should be generated at regular elevation intervals');
assert.ok(contours.every(c=>c.paths.length>0&&c.paths.every(p=>p.length>=2)));
const volume=math.volumes(tin.triangles,1);
assert.ok(Math.abs(volume.cut-1/6)<1e-6,'cut volume below the datum should be integrated');
assert.ok(Math.abs(volume.fill-1/6)<1e-6,'fill volume above the datum should be integrated');
assert.ok(Math.abs(volume.net)<1e-6,'balanced planar terrain should have zero net volume');
assert.ok(Math.abs(volume.area-1)<1e-8);
assert.throws(()=>math.triangulate([{x:0,y:0,z:1},{x:1,y:1,z:2}]),/al menos tres puntos/);
console.log('Civil 3D geometry checks passed: Delaunay TIN, contours, slope, interpolation and cut/fill');
