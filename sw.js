const CACHE='otrocad-pc-offline-31';
const ASSETS=['./','./index.html','./editor/','./editor/index.html','./editor/editor.js','./tutorial/','./tutorial/index.html','./descargas/','./descargas/index.html','./herramientas/','./herramientas/index.html','./manifest.webmanifest','./icon.svg','./editor-preview.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('otrocad-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(req,{ignoreSearch:true});
  if(cached)return cached;
  try{const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;}
  catch(error){if(req.mode==='navigate'){const editor=await cache.match('./editor/index.html');if(url.pathname.includes('/editor/')&&editor)return editor;const home=await cache.match('./index.html');if(home)return home;}return Response.error();}
 })());
});
