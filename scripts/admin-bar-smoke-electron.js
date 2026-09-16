const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function fail(message, details) {
  console.error('SEB EvalPro Admin smoke: ' + message);
  if (details) console.error(JSON.stringify(details, null, 2));
  app.exit(2);
}

ipcMain.on('state:load-sync', (event) => {
  event.returnValue = {
    version: 1,
    sessionStorage: {},
    localStorage: {},
    lastPage: 'qcmv1.0.html',
    lastEvaluationPage: 'qcmv1.0.html'
  };
});
ipcMain.on('state:save-sync', (event) => { event.returnValue = { ok: true }; });
ipcMain.handle('state:save', () => ({ ok: true }));
ipcMain.handle('admin:status', () => false);
ipcMain.handle('admin:verify', () => false);
ipcMain.handle('admin:verify-password', () => false);
ipcMain.handle('admin:lock', () => true);
ipcMain.handle('admin:open-bilan', () => false);
ipcMain.handle('admin:return-evaluation', () => false);
ipcMain.handle('admin:close-session', () => false);
ipcMain.handle('ai:status', () => ({ available: false, offline: true }));
ipcMain.handle('ai:rewrite-synthesis', () => ({ ok: false }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error('Renderer:', message);
  });

  try {
    await win.loadFile(path.join(__dirname, '..', 'app', 'web', 'qcmv1.0.html'));
    await new Promise((resolve) => setTimeout(resolve, 450));

    const result = await win.webContents.executeJavaScript(`(async()=>{
      const bar=document.getElementById('seb-evalpro-topbar');
      const hot=document.getElementById('seb-evalpro-top-hotzone');
      const admin=document.getElementById('seb-evalpro-admin');
      document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:0,clientX:20}));
      await new Promise(r=>setTimeout(r,80));
      return {
        bar:!!bar,
        hotzone:!!hot,
        adminButton:!!admin,
        visible:!!bar && bar.classList.contains('seb-evalpro-visible'),
        transform:bar ? getComputedStyle(bar).transform : '',
        adminText:admin ? String(admin.textContent||'').trim() : ''
      };
    })()`);

    if (!result.bar || !result.hotzone || !result.adminButton || !result.visible) {
      fail('barre Administrateur absente ou impossible à afficher au bord supérieur', result);
      return;
    }

    console.log('SEB EvalPro Admin smoke: OK - barre présente et affichable au bord supérieur.');
    console.log(JSON.stringify(result));
    win.destroy();
    app.exit(0);
  } catch (error) {
    fail('erreur pendant le test réel Electron: ' + String(error && error.stack || error));
  }
});

setTimeout(() => fail('délai global dépassé'), 30000).unref();
