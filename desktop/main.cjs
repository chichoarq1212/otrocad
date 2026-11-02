'use strict';
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'otrocad-smoke-' + process.pid));
app.whenReady().then(async () => {
  // The desktop editor and all its assets are local. Refuse remote requests.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('data:') && !details.url.startsWith('blob:') && !details.url.startsWith('devtools:') });
  });
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 800, minHeight: 600,
    title: 'OtroCAD', show: !smoke,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  if (smoke) {
    const timer = setTimeout(() => app.exit(1), 30000);
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
          window.reload();
        } else {
          const restored = await window.webContents.executeJavaScript("JSON.parse(localStorage.getItem('otrocad-drawing') || '[]').some(x => x.type === 'line')");
          clearTimeout(timer);
          app.exit(restored ? 0 : 1);
        }
      } catch (_) { clearTimeout(timer); app.exit(1); }
    });
  }
  await window.loadFile(path.join(__dirname, 'dist', 'editor', 'index.html'));
}).catch(() => app.exit(1));
app.on('window-all-closed', () => app.quit());
