'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const output = path.join(root, 'dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'editor/index.html',
  'editor/editor.js',
  'tutorial/index.html'
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error('Falta un archivo web requerido: ' + relativePath);
  }
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const relativePath of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg']) {
  fs.copyFileSync(path.join(root, relativePath), path.join(output, relativePath));
}

fs.cpSync(path.join(root, 'editor'), path.join(output, 'editor'), { recursive: true });
fs.cpSync(path.join(root, 'tutorial'), path.join(output, 'tutorial'), { recursive: true });

console.log('OtroCAD listo para Cloudflare Workers: solo se publican los archivos web en /dist.');
console.log('Se excluyen android/, .github/, tests/ y el resto del código de desarrollo.');
