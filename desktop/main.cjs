'use strict';
const { app, BrowserWindow, session, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const smoke = process.argv.includes('--smoke-test');

protocol.registerSchemesAsPrivileged([{
  scheme: 'otrocad',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'otrocad-smoke-' + process.pid));

app.whenReady().then(async () => {
  const root = path.resolve(__dirname, 'dist');
  await protocol.handle('otrocad', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
    let relative;
    try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); }
    catch (_) { return new Response('Bad path', { status: 400 }); }
    const target = path.resolve(root, relative || 'index.html');
    if (target !== root && !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    try { return await net.fetch(pathToFileURL(target).toString()); }
    catch (_) { return new Response('Not found', { status: 404 }); }
  });

  // Only the bundled application origin is permitted; the packaged editor works without network access.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('otrocad:') && !details.url.startsWith('data:') && !details.url.startsWith('blob:') && !details.url.startsWith('devtools:') });
  });

  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 800, minHeight: 600,
    title: 'OtroCAD', show: !smoke,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('otrocad:')) event.preventDefault();
  });

  if (smoke) {
    const timer = setTimeout(() => app.exit(1), 45000);
    window.webContents.on('did-fail-load', () => { clearTimeout(timer); app.exit(1); });
    let phase = 0;
    window.webContents.on('did-finish-load', async () => {
      try {
        if (phase === 0) {
          phase = 1;
          const bounds = await window.webContents.executeJavaScript(`(() => {
            const c = document.querySelector('canvas');
            if (!c || !document.querySelector('[data-tool="line"]')) return null;
            document.querySelector('[data-tool="line"]').click();
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          })()`);
          if (!bounds) throw new Error('No se encontró el lienzo');
          for (const x of [bounds.x - 60, bounds.x + 60]) {
            window.webContents.sendInputEvent({type:'mouseDown', x, y:bounds.y, button:'left', clickCount:1});
            window.webContents.sendInputEvent({type:'mouseUp', x, y:bounds.y, button:'left', clickCount:1});
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          const saved = await window.webContents.executeJavaScript("JSON.parse(localStorage.getItem('otrocad-drawing') || '[]').some(x => x.type === 'line')");
          if (!saved) throw new Error('No se guardó la línea de prueba');
          const wasmPath = path.join(root, 'editor', 'vendor', 'dwg', 'otrocad_dwg_bg.wasm');
          if (require('node:fs').existsSync(wasmPath)) {
            const dwgCheck = await window.webContents.executeJavaScript(`(async()=>{
              const engine=await import('./vendor/dwg/otrocad_dwg.js');
              await engine.default();
              const dxf=new TextEncoder().encode('0\\nSECTION\\n2\\nHEADER\\n9\\n$ACADVER\\n1\\nAC1021\\n0\\nENDSEC\\n0\\nSECTION\\n2\\nENTITIES\\n0\\nLINE\\n10\\n0\\n20\\n0\\n11\\n10\\n21\\n0\\n0\\nENDSEC\\n0\\nEOF\\n');
              const dwg=engine.dxf_to_dwg(dxf);
              const header=new TextDecoder().decode(dwg.subarray(0,6));
              const back=engine.dwg_to_dxf(dwg);
              return {header, readable:new TextDecoder().decode(back).includes('LINE')};
            })()`);
            if (dwgCheck.header !== 'AC1032' || !dwgCheck.readable) throw new Error('Falló la prueba DWG local: ' + JSON.stringify(dwgCheck));
          }
          window.reload();
        } else {
          const restored = await window.webContents.executeJavaScript("JSON.parse(localStorage.getItem('otrocad-drawing') || '[]').some(x => x.type === 'line')");
          clearTimeout(timer);
          app.exit(restored ? 0 : 1);
        }
      } catch (_) { clearTimeout(timer); app.exit(1); }
    });
  }
  await window.loadURL('otrocad://app/editor/index.html');
}).catch(() => app.exit(1));

app.on('window-all-closed', () => app.quit());
