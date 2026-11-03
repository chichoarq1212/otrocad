'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('editor/index.html','utf8');
const civil=fs.readFileSync('editor/civil3d.js','utf8');
const media='(orientation:landscape) and (max-height:500px) and (max-width:950px) and (pointer:coarse)';
assert.ok(html.includes('@media '+media+'{'),'Compact mode must target landscape phones with coarse pointer, not desktops/tablets');
assert.ok(html.includes("window.matchMedia('(orientation: landscape) and (max-height: 500px) and (max-width: 950px) and (pointer: coarse)')"),
 'Runtime landscape-phone detection must match the CSS breakpoint');
assert.match(html,/id="mobileBottomToggle"[^>]*aria-expanded="false"/,'Mobile panel toggle should start collapsed with accessibility metadata');
assert.match(html,/#commandbar,#statusbar\{display:none!important\}/,'Command and status lines should not consume drawing height in landscape phone mode');
assert.match(html,/body\.cad-mobile-bottom-open #statusbar,/,'Opening mobile options should restore the status controls');
assert.match(html,/body\.cad-mobile-bottom-open #commandbar/,'Opening mobile options should restore the command input');
assert.match(html,/body\.cad-ribbon-collapsed #workspace\{height:calc\(100dvh - 40px\)!important\}/,'Canvas should fill free vertical height without bottom bars');
assert.match(html,/#layoutBar\{min-height:30px!important;height:30px!important/,'Model/Layout tabs should use a compact bottom strip');
assert.match(html,/setBottomOpen\(false\)/,'Mobile options must close when leaving canvas or changing orientation');
assert.match(html,/id="paperCreate"/,'Layout creation must still be present');
assert.match(html,/id="importReport"/,'Import diagnostics must remain accessible');
assert.match(html,/id="osnapToggle"/,'OSNAP command must remain accessible');
assert.match(html,/id="cmd"/,'Command input must remain accessible');
const iconMatch=civil.match(/const civilIconPaths=(\{[\s\S]*?\});\s*function addButton/);
assert.ok(iconMatch,'Civil toolbar should define a reusable vector icon library');
const icons=vm.runInNewContext('('+iconMatch[1]+')');
const labels=[
 ['Importar CSV / XYZ','csv'],['Importar LandXML','landxml'],['Etiquetar cotas','label'],
 ['Exportar puntos','export'],['Crear superficie TIN','tin'],['Curvas de nivel','contours'],
 ['Mapa de pendientes','slope'],['Visor 3D','view3d'],['Definir alineamiento','alignment'],
 ['Progresivas','stations'],['Pendiente del eje','grade'],['Perfil longitudinal','profile'],
 ['Sección transversal','section'],['Volumen vs. cota','volume'],['Borrar análisis','clear']
];
assert.equal(Object.keys(icons).length,labels.length,'All Civil icons should be intentionally mapped');
for(const [label,key] of labels){
 assert.match(civil,new RegExp("addButton\\([^\\n]*?,'"+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"','"+key+"'"),'Missing SVG mapping for '+label);
 assert.match(icons[key],/<(?:path|circle|rect|line|polyline|polygon)\b/,'Civil icon must be drawable SVG geometry: '+key);
}
assert.match(civil,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/,'Icons must be SVG elements like the existing CAD toolbar');
assert.match(civil,/b\.className='civil-tool'/,'Civil buttons must share a styled class');
assert.doesNotMatch(civil,/mark\.textContent=icon/,'Legacy text glyph icons must not return');
console.log('Mobile landscape layout and 15 CAD-style Civil 3D vector icons verified');
