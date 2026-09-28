const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function fail(message, details) {
  console.error('USB_PASSWORD_FOCUS_SMOKE: FAIL - ' + message);
  if (details) console.error(details);
  app.exit(2);
}

let state = { version:1, sessionStorage:{}, localStorage:{}, lastPage:'qcmv1.0.html', lastEvaluationPage:'qcmv1.0.html' };

ipcMain.on('app:edition-sync', (event) => {
  event.returnValue = { edition:'admin', canBilan:true, canAi:true, canImport:true, canExport:true };
});
ipcMain.on('state:load-sync', (event) => { event.returnValue = state; });
ipcMain.on('state:save-sync', (event, payload) => { state = { ...state, ...(payload || {}) }; event.returnValue = { ok:true, state }; });
ipcMain.on('candidate-catalog:workspace-load-sync', (event) => { event.returnValue = { ok:false }; });
ipcMain.on('candidate-catalog:results-workspace-load-sync', (event) => { event.returnValue = { ok:false }; });
ipcMain.on('candidate-catalog:workspace-save-sync', (event) => { event.returnValue = { ok:true }; });

ipcMain.handle('state:save', (_event, payload) => { state = { ...state, ...(payload || {}) }; return { ok:true, state }; });
ipcMain.handle('admin:status', () => true);
ipcMain.handle('admin:verify', () => true);
ipcMain.handle('admin:verify-password', () => true);
ipcMain.handle('admin:lock', () => true);
ipcMain.handle('candidate:active', () => null);
ipcMain.handle('ai:status', () => ({ available:false, offline:true }));

app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1280,
    height:720,
    webPreferences:{
      preload:path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:false
    }
  });

  try {
    await win.loadFile(path.join(__dirname, '..', 'app', 'web', 'qcmv1.0.html'));
    await new Promise((resolve) => setTimeout(resolve, 900));

    const opened = await win.webContents.executeJavaScript(`
      (() => {
        const button = document.getElementById('seb-evalpro-import-candidates');
        if (!button) return { ok:false, reason:'Bouton Import absent' };
        button.click();
        return { ok:true };
      })()
    `, true);
    if (!opened || !opened.ok) fail('Impossible d’ouvrir le dialogue Import.', JSON.stringify(opened));

    await new Promise((resolve) => setTimeout(resolve, 180));

    const focusState = await win.webContents.executeJavaScript(`
      (() => {
        const dialog = document.getElementById('seb-evalpro-transfer-password-dialog');
        const input = document.getElementById('seb-transfer-password');
        return {
          dialog:Boolean(dialog),
          input:Boolean(input),
          activeId:document.activeElement ? document.activeElement.id : '',
          disabled:input ? input.disabled : null,
          readOnly:input ? input.readOnly : null,
          type:input ? input.type : ''
        };
      })()
    `, true);

    if (!focusState.dialog || !focusState.input) fail('Dialogue ou champ mot de passe absent.', JSON.stringify(focusState));
    if (focusState.activeId !== 'seb-transfer-password') fail('Le curseur n’est pas dans le champ mot de passe.', JSON.stringify(focusState));
    if (focusState.disabled || focusState.readOnly) fail('Le champ mot de passe n’est pas saisissable.', JSON.stringify(focusState));

    win.show();
    win.focus();
    await new Promise((resolve) => setTimeout(resolve, 80));

    for (const ch of 'Test1234') {
      win.webContents.sendInputEvent({ type:'char', keyCode:ch });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));

    const typed = await win.webContents.executeJavaScript(`
      (() => {
        const input = document.getElementById('seb-transfer-password');
        return {
          value:input ? input.value : '',
          activeId:document.activeElement ? document.activeElement.id : ''
        };
      })()
    `, true);

    if (typed.value !== 'Test1234') fail('La saisie clavier n’arrive pas dans le champ mot de passe.', JSON.stringify(typed));
    if (typed.activeId !== 'seb-transfer-password') fail('Le champ perd le focus pendant la saisie.', JSON.stringify(typed));

    console.log('USB_PASSWORD_DIALOG_VISIBLE: OK');
    console.log('USB_PASSWORD_CURSOR_FOCUSED: OK');
    console.log('USB_PASSWORD_KEYBOARD_INPUT: OK');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(String(error && error.stack || error));
  }
});

setTimeout(() => fail('timeout'), 60000).unref();
