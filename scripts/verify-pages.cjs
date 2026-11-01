'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(process.cwd(),'dist');
const required=['index.html','editor/index.html','editor/editor.js','descargas/index.html','tutorial/index.html','herramientas/index.html','sw.js','manifest.webmanifest','icon.svg'];
for(const file of required){if(!fs.existsSync(path.join(root,file)))throw Error('Missing '+file);}
const pages=['index.html','descargas/index.html','tutorial/index.html','herramientas/index.html','editor/index.html'];
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
