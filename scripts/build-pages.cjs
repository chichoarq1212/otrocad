'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const output = path.join(root, 'dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'ios/index.html',
  'editor-preview.svg',
  'editor-preview-real.jpg',
  'editor/index.html',
  'editor/editor.js',
  'editor/civil3d.js',
  'editor/civil-points.js',
  'editor/civil-topography.js',
  'editor/civil-topography.css',
  'editor/civil-road.js',
  'editor/civil-road-ui.js',
  'editor/civil-ribbon.css',
  'editor/civil-road-ui.css',
  'editor/mep.js',
  'editor/mep-ribbon.css',
  'editor/mep-thermal.js',
  'editor/mep-thermal-ui.js',
  'editor/mep-thermal-ui.css',
  'editor/kelvin-assistant.js',
  'editor/arqui-planner.js',
  'editor/arqui-house-layout.js',
  'editor/arqui-user-ai.js',
  'editor/arqui-references.js',
  'editor/arqui-assistant.js',
  'editor/arqui-professional.js',
  'editor/cad-file-ui.js',
  'editor/cad-file-ui.css',
  'editor/arqui-assistant.css',
  'editor/assets/el-arqui.webp',
  'editor/assets/ing-kelvin.webp',
  'editor/jaimito-assistant.js',
  'editor/jaimito-assistant.css',
  'editor/compact-chrome.css','editor/geolocation.js','editor/vendor/proj4/proj4.js','editor/vendor/proj4/LICENSE.md',
  'editor/assets/ing-jaimito-hd.webp',
  'editor/demo/vivienda.js',
  'editor/library/furnishings.js',
  'tutorial/index.html',
  'descargas/index.html',
  'herramientas/index.html'
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error('Falta un archivo web requerido: ' + relativePath);
  }
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const relativePath of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'editor-preview.svg', 'editor-preview-real.jpg']) {
  fs.copyFileSync(path.join(root, relativePath), path.join(output, relativePath));
}

fs.cpSync(path.join(root, 'editor'), path.join(output, 'editor'), { recursive: true });
fs.cpSync(path.join(root, 'tutorial'), path.join(output, 'tutorial'), { recursive: true });
fs.cpSync(path.join(root, 'ios'), path.join(output, 'ios'), { recursive: true });
fs.cpSync(path.join(root, 'descargas'), path.join(output, 'descargas'), { recursive: true });
fs.cpSync(path.join(root, 'herramientas'), path.join(output, 'herramientas'), { recursive: true });

// Any change to a deployed file changes the service-worker cache and build identity.
const hash = crypto.createHash('sha256');
function hashDirectory(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hashDirectory(full, relative);
    else { hash.update(relative + '\0'); hash.update(fs.readFileSync(full)); }
  }
}
hashDirectory(output);
const buildId = hash.digest('hex').slice(0, 20);
const workerPath = path.join(output, 'sw.js');
const worker = fs.readFileSync(workerPath, 'utf8');
if (!/^const CACHE='otrocad-pc-offline-[^']+';/m.test(worker)) throw new Error('No se encontró la versión de caché del service worker');
fs.writeFileSync(workerPath, worker.replace(/^const CACHE='otrocad-pc-offline-[^']+';/m, `const CACHE='otrocad-pc-offline-${buildId}';`));
fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify({buildId}) + '\n');

console.log('OtroCAD listo para Cloudflare Workers: solo se publican los archivos web en /dist.');
console.log('Se excluyen android/, .github/, tests/ y el resto del código de desarrollo.');

