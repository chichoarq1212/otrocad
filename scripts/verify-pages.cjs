'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(process.cwd(),'dist');
const required=['index.html','editor/index.html','editor/editor.js','editor/civil3d.js','editor/jaimito-assistant.js','editor/jaimito-assistant.css','editor/compact-chrome.css','editor/geolocation.js','editor/mep.js','editor/mep-ribbon.css','editor/mep-thermal.js','editor/mep-thermal-ui.js','editor/mep-thermal-ui.css','editor/civil-road.js','editor/civil-road-ui.js','editor/civil-ribbon.css','editor/vendor/proj4/proj4.js','editor/vendor/proj4/LICENSE.md','editor/assets/ing-jaimito-hd.webp','descargas/index.html','tutorial/index.html','herramientas/index.html','ios/index.html','sw.js','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','editor-preview.svg'];
for(const file of required){if(!fs.existsSync(path.join(root,file)))throw Error('Missing '+file);}
const pages=['index.html','descargas/index.html','tutorial/index.html','herramientas/index.html','ios/index.html','editor/index.html'];
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 for(const match of html.matchAll(/(?:href|src)=["']([^"'#]+)["']/g)){
  const url=match[1];
  if(/^(https?:|data:|mailto:|tel:|javascript:)/.test(url))continue;
  const local=url.split(/[?#]/)[0];
  if(!local||local.startsWith('/'))continue;
  if(local==='./editor-preview.png')continue; // generated in the screenshot step
  const target=path.resolve(root,path.dirname(page),local);
  if(target!==root&&!target.startsWith(root+path.sep))throw Error('Link outside site: '+page+' '+url);
  if(!fs.existsSync(target))throw Error('Broken local link: '+page+' -> '+url);
 }
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
if(manifest.display!=='standalone')throw Error('PWA must be standalone');
console.log('Local links, pages, assets, and PWA manifest verified');

// Ensure the only advertised Android download is the current, direct .apk asset.
const apk='https://github.com/chichoarq1212/otrocad/releases/download/android-0.5.9-test/OtroCAD-Android-0.5.9-alpha.apk';
for(const page of ['index.html','descargas/index.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 if(!html.includes('href="'+apk+'"'))throw Error('Direct APK 0.5.9 link missing in '+page);
 if(/android-hybrid-test-|OtroCAD-Android-0\.(?:5\.4|5\.6|5\.7)-test\.apk/.test(html))throw Error('Outdated Android APK still advertised in '+page);
}
console.log('Direct current APK 0.5.9 links verified in home and downloads');

// Safari iOS needs real PNG Apple touch icon, standalone manifest and touch-friendly CAD editing.
const icon=fs.readFileSync(path.join(root,'apple-touch-icon.png'));
if(icon.length<1000||!icon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Apple touch icon is not a valid PNG file');
for(const page of ['index.html','editor/index.html','ios/index.html','descargas/index.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 if(!html.includes('rel="apple-touch-icon"')||!html.includes('apple-mobile-web-app'))throw Error('iOS PWA metadata missing in '+page);
}
const iOSManifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
if(!iOSManifest.icons.some(x=>x.src==='icon-192.png')||!iOSManifest.icons.some(x=>x.src==='icon-512.png'))throw Error('PNG icons not configured in PWA manifest');
const cadJS=fs.readFileSync(path.join(root,'editor/editor.js'),'utf8');
if(!cadJS.includes('findGripAt(p,e.pointerType')||!cadJS.includes('snapPoint(world(p),gripDrag.index)'))throw Error('iOS touch grip improvements missing');
console.log('iOS Apple touch icon, home screen install and CAD grip support verified');
const homeHTML=fs.readFileSync(path.join(root,'index.html'),'utf8');
const iOSPageHTML=fs.readFileSync(path.join(root,'ios/index.html'),'utf8');
const guideCTA=homeHTML.match(/<a[^>]*id="iosGuideButton"[^>]*href="\.\/ios\/#instalar"[^>]*>([\s\S]*?)<\/a>/);
if(!guideCTA||!guideCTA[1].includes('Da clic aquí')||!guideCTA[1].includes('Guía para iOS'))throw Error('Botón visible de guía iOS no disponible en el inicio');
if(!iOSPageHTML.includes('id="instalar"'))throw Error('El botón iOS apunta a una sección de instalación inexistente');
console.log('Visible iOS landing CTA opens the correct installation instructions');

