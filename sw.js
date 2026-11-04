const CACHE='otrocad-pc-offline-17fa773ab1c972a28e6d';
const ASSETS=['./','./index.html','./ios/','./ios/index.html','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./editor/','./editor/index.html','./editor/editor.js','./editor/civil3d.js','./editor/civil-points.js','./editor/civil-topography.js','./editor/civil-topography.css','./editor/civil-road.js','./editor/mep.js','./editor/kelvin-assistant.js','./editor/assets/ing-kelvin.webp','./editor/jaimito-assistant.js','./editor/jaimito-assistant.css','./editor/compact-chrome.css','./editor/geolocation.js','./editor/mep.js','./editor/vendor/proj4/proj4.js','./editor/vendor/proj4/LICENSE.md','./editor/assets/ing-jaimito-hd.webp','./editor/demo/vivienda.js','./editor/library/furnishings.js','./editor/vendor/dwg/otrocad_dwg.js','./editor/vendor/dwg/otrocad_dwg_bg.wasm','./tutorial/','./tutorial/index.html','./descargas/','./descargas/index.html','./herramientas/','./herramientas/index.html','./manifest.webmanifest','./icon.svg','./editor-preview.svg','./editor-preview-real.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('otrocad-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Network-first: installed PC/PWA receives new editor builds while remaining usable offline.
  // Do not ignore the query string for network requests; it can be used to force an update.
  try{const response=await fetch(req,{cache:'no-store'});if(response.ok){try{await cache.put(req,response.clone())}catch(error){}return response;}}
  catch(error){}
  const cached=await cache.match(req,{ignoreSearch:true});
  if(cached)return cached;
  if(req.mode==='navigate'){const editor=await cache.match('./editor/index.html');if(url.pathname.includes('/editor/')&&editor)return editor;const home=await cache.match('./index.html');if(home)return home;}
  return Response.error();
 })());
});

