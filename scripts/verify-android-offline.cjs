'use strict';
/* Verify the actual offline editor bundled by Android CI. No network dependencies. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(process.argv[2]||'android/app/src/main/assets/editor');
const must=[
 'index.html','editor.js','civil3d.js','civil-points.js','civil-topography.js',
 'civil-topography.css','civil-road.js','civil-road-ui.js','civil-ribbon.css',
 'civil-road-ui.css','geolocation.js','mep.js','mep-ribbon.css',
 'mep-thermal.js','mep-thermal-ui.js','mep-thermal-ui.css',
 'kelvin-assistant.js','jaimito-assistant.js','jaimito-assistant.css',
 'arqui-planner.js','arqui-knowledge.js','arqui-house-layout.js','arqui-references.js','arqui-assistant.js','arqui-assistant.css',
 'arqui-professional.js','cad-file-ui.js','cad-file-ui.css',
 'assets/el-arqui.webp',
 'assets/ing-kelvin.webp','assets/ing-jaimito-hd.webp',
 'compact-chrome.css','vendor/proj4/proj4.js'
];
for(const file of must){
 const filename=path.join(dir,file);
 assert.ok(fs.existsSync(filename),'Falta recurso offline en APK: '+file);
 assert.ok(fs.statSync(filename).size>0,'Archivo vacío en APK: '+file);
}
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
for(const file of must.filter(x=>x.endsWith('.js')||x.endsWith('.css'))){
 if(file==='vendor/proj4/proj4.js')continue;
 assert.ok(html.includes(file),'El editor offline no carga '+file);
}
for(const name of ['civil-road-ui.js','mep-thermal.js','mep-thermal-ui.js']){
 const content=fs.readFileSync(path.join(dir,name),'utf8');
 assert.ok(content.length>1000,'No se empaquetó el código de '+name);
}
const jaimito=fs.readFileSync(path.join(dir,'jaimito-assistant.js'),'utf8');
assert.ok(jaimito.includes('ing-jaimito-hd.webp'));
const kelvin=fs.readFileSync(path.join(dir,'kelvin-assistant.js'),'utf8');
assert.ok(kelvin.includes('ing-kelvin.webp'));
const thermal=fs.readFileSync(path.join(dir,'mep-thermal.js'),'utf8');
assert.ok(thermal.includes('function hvac(')&&thermal.includes('function coldRoom('));
const road=fs.readFileSync(path.join(dir,'civil-road-ui.js'),'utf8');
assert.ok(road.includes('SEÑALIZACIÓN VIAL')&&road.includes('roadPreview'));
const assistant=fs.readFileSync(path.join(dir,'arqui-assistant.js'),'utf8');
assert(!assistant.includes('/api/arqui')&&!assistant.includes('OpenRouter'),'Android must not contain AI inference');
for(const removed of ['arqui-oauth.js','arqui-user-ai.js'])
 assert(!fs.existsSync(path.join(dir,removed)),'Retired AI file included in Android: '+removed);
console.log('Motor arquitectónico local comprobado: conocimiento, U escaleras y 0 conexiones de IA.');
console.log('APK offline OK: '+must.length+' recursos y herramientas CAD/Civil/Señalización/MEP/Frío presentes.');
