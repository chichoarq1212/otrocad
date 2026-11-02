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
    window.webContents.on('did-finish-load', async () => {
      try {
        const result = await window.webContents.executeJavaScript("Boolean(document.querySelector('canvas') && document.querySelector('[data-tool]'))");
        clearTimeout(timer);
        app.exit(result ? 0 : 1);
      } catch (_) { clearTimeout(timer); app.exit(1); }
    });
  }
  await window.loadFile(path.join(__dirname, 'dist', 'editor', 'index.html'));
}).catch(() => app.exit(1));
app.on('window-all-closed', () => app.quit());
