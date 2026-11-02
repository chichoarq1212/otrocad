const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'otrocad-build-'));
try {
 for(const file of ['index.html','manifest.webmanifest','sw.js','icon.svg','editor-preview.svg','editor-preview-real.jpg']) fs.copyFileSync(path.join(root,file),path.join(temp,file));
 for(const dir of ['editor','tutorial','descargas','herramientas','scripts']) fs.cpSync(path.join(root,dir),path.join(temp,dir),{recursive:true});
 const build=()=>{execFileSync(process.execPath,['scripts/build-pages.cjs'],{cwd:temp});return JSON.parse(fs.readFileSync(path.join(temp,'dist/build-info.json'),'utf8')).buildId};
 const first=build();assert.equal(build(),first,'La misma fuente debe generar la misma versión');
 fs.appendFileSync(path.join(temp,'editor/editor.js'),'\n/* version test */\n');
 const changed=build();assert.notEqual(first,changed,'Un cambio en el editor debe cambiar la caché');
 assert.ok(fs.readFileSync(path.join(temp,'dist/sw.js'),'utf8').includes('otrocad-pc-offline-'+changed));
 console.log('Build identity checks passed: deterministic and changes with editor content');
} finally {fs.rmSync(temp,{recursive:true,force:true})}
