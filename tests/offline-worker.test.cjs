const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},assets=[],deleted=[];
let failPut=false,offline=false;
const cache={addAll:async requests=>{assets.push(...requests.map(r=>r.url))},put:async()=>{if(failPut)throw Error('quota')},match:async()=>new Response('copia local')};
const scope={URL,Request,Response,self:{location:{origin:'https://otrocad.example'},registration:{scope:'https://otrocad.example/'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache,keys:async()=>['otrocad-old','otro-sitio'],delete:async key=>deleted.push(key)},fetch:async()=>{if(offline)throw Error('offline');return new Response('respuesta nueva',{status:200})}};
vm.createContext(scope);vm.runInContext(fs.readFileSync('sw.js','utf8'),scope);
(async()=>{
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 assert.ok(assets.includes('https://otrocad.example/editor/library/furnishings.js'));
 assert.ok(assets.includes('https://otrocad.example/editor/civil3d.js'),'Civil 3D tools must be cached for offline use');
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['otrocad-old']);
 failPut=true;handlers.fetch({request:new Request('https://otrocad.example/editor/editor.js'),respondWith:p=>pending=p});
 assert.equal(await (await pending).text(),'respuesta nueva','La red debe funcionar aunque falle la caché');
 offline=true;handlers.fetch({request:new Request('https://otrocad.example/editor/editor.js'),respondWith:p=>pending=p});
 assert.equal(await (await pending).text(),'copia local');
 console.log('Offline worker checks passed: assets, cache failure and offline fallback');
})().catch(error=>{console.error(error);process.exitCode=1});
