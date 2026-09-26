const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function fail(message, details) {
  console.error('ADMIN_BILAN_WINDOWS_SMOKE: FAIL - ' + message);
  if (details) console.error(JSON.stringify(details, null, 2));
  app.exit(2);
}

let smokeState = {
  version: 1,
  sessionStorage: {},
  localStorage: {},
  lastPage: 'admin-bilan.html',
  lastEvaluationPage: 'qcmv1.0.html'
};

ipcMain.on('app:edition-sync', (event) => { event.returnValue = { edition:'admin', canBilan:true, canAi:true, canImport:true, canExport:true }; });
ipcMain.on('state:load-sync', (event) => { event.returnValue = smokeState; });
ipcMain.on('state:save-sync', (event, payload) => {
  smokeState = { ...smokeState, ...(payload || {}) };
  event.returnValue = { ok: true, state: smokeState };
});
ipcMain.on('candidate-catalog:workspace-load-sync', (event) => { event.returnValue = { ok:false }; });
ipcMain.on('candidate-catalog:results-workspace-load-sync', (event) => { event.returnValue = { ok:false }; });
ipcMain.on('candidate-catalog:workspace-save-sync', (event) => { event.returnValue = { ok:true }; });
ipcMain.handle('state:save', (_event, payload) => {
  smokeState = { ...smokeState, ...(payload || {}) };
  return { ok: true, state: smokeState };
});
ipcMain.handle('admin:status', () => true);
ipcMain.handle('admin:verify', () => true);
ipcMain.handle('admin:verify-password', () => false);
ipcMain.handle('admin:lock', () => true);
ipcMain.handle('admin:open-bilan', () => false);
ipcMain.handle('admin:open-candidate-results', () => false);
ipcMain.handle('admin:return-evaluation', () => false);
ipcMain.handle('admin:close-session', () => false);
ipcMain.handle('ai:status', () => ({ available: false, offline: true }));
ipcMain.handle('ai:rewrite-synthesis', () => ({ ok: false }));

app.commandLine.appendSwitch('disable-gpu');

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

  win.webContents.on('preload-error', (_event, p, error) => {
    console.error('PRELOAD_ERROR', String(p || ''), String(error && error.stack || error));
  });

  try {
    await win.loadFile(path.join(__dirname, '..', 'app', 'web', 'admin-bilan.html'));
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const code = "(function(){const host=document.getElementById('seb-bilan-synthese');const buttons=host?[...host.querySelectorAll('button')]:[];const visible=buttons.filter(b=>{const s=getComputedStyle(b);return s.display!=='none'&&s.visibility!=='hidden'&&!b.hidden});const aiState=document.getElementById('seb-ai-result-status');const warning=document.getElementById('seb-ai-human-check');const ids=['auto','save','word'];const finalButtons=Object.fromEntries(ids.map(id=>{const el=document.getElementById(id),css=el?getComputedStyle(el):null;return [id,{present:!!el,width:el?Math.round(el.getBoundingClientRect().width):0,background:css?css.backgroundColor:'',color:css?css.color:'',border:css?css.borderTopColor:''}]}));return {host:!!host,visibleButtonCount:visible.length,visibleButtonTexts:visible.map(b=>String(b.textContent||'').trim()),aiState:!!aiState,aiStateText:aiState?String(aiState.textContent||'').trim():'',warning:!!warning,buttons:finalButtons,pdf:!!document.getElementById('pdf')};})()";
    const result = await win.webContents.executeJavaScript(code, true);

    const blue = 'rgb(0, 112, 192)';
    const white = 'rgb(255, 255, 255)';
    const badStyle = ['auto','save','word'].some((id) => {
      const button = result.buttons[id];
      return !button.present || button.background !== white || button.color !== blue || button.border !== blue;
    });

    if (!result.host || result.visibleButtonCount !== 1 || result.visibleButtonTexts[0] !== 'Générer la synthèse') {
      fail('synthèse Admin incorrecte', result);
      return;
    }
    if (!result.aiState || !result.warning || !/^SEB-IA\s*:/.test(result.aiStateText)) {
      fail('indicateur SEB-IA absent', result);
      return;
    }
    if (badStyle || result.pdf || result.buttons.save.width < 270) {
      fail('boutons Bilan Admin incorrects', result);
      return;
    }

    console.log('ADMIN_BILAN_WINDOWS_SMOKE: OK');
    console.log(JSON.stringify(result));
    win.destroy();
    app.exit(0);
  } catch (error) {
    fail('erreur Electron: ' + String(error && error.stack || error));
  }
});

setTimeout(() => fail('timeout isolé admin-bilan'), 60000).unref();
