const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function fail(message, details) {
  console.error('SEB EvalPro Admin smoke: ' + message);
  if (details) console.error(JSON.stringify(details, null, 2));
  app.exit(2);
}

function dumpPreloadObservers(preloadPath) {
  try {
    const lines = fs.readFileSync(preloadPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
    const hits = [];
    lines.forEach((line, index) => {
      if (/MutationObserver|\.observe\s*\(/.test(line)) hits.push(index);
    });
    console.log('SEB EvalPro Admin smoke: occurrences MutationObserver/.observe dans preload final = ' + hits.length);
    for (const index of hits) {
      const from = Math.max(0, index - 3);
      const to = Math.min(lines.length, index + 4);
      console.log('--- preload lignes ' + (from + 1) + '-' + to + ' ---');
      for (let i = from; i < to; i += 1) console.log(String(i + 1).padStart(4, ' ') + ': ' + lines[i]);
    }
  } catch (error) {
    console.error('SEB EvalPro Admin smoke: diagnostic preload impossible: ' + String(error && error.stack || error));
  }
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
ipcMain.on('candidate-catalog:workspace-load-sync', (event) => { event.returnValue = { ok:false }; });
ipcMain.handle('state:save', () => ({ ok: true }));
let smokeAdminUnlocked = true;
ipcMain.handle('admin:status', () => smokeAdminUnlocked);
ipcMain.handle('admin:verify', () => { smokeAdminUnlocked = true; return true; });
ipcMain.handle('admin:verify-password', () => false);
ipcMain.handle('admin:lock', () => { smokeAdminUnlocked = false; return true; });
ipcMain.handle('admin:open-bilan', () => false);
ipcMain.handle('admin:return-evaluation', () => false);
ipcMain.handle('admin:close-session', () => false);
ipcMain.handle('ai:status', () => ({ available: false, offline: true }));
ipcMain.handle('ai:rewrite-synthesis', () => ({ ok: false }));

app.whenReady().then(async () => {
  const preloadPath = path.join(__dirname, '..', 'src', 'preload.js');
  dumpPreloadObservers(preloadPath);

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on('preload-error', (_event, badPreloadPath, error) => {
    console.error('SEB EvalPro PRELOAD ERROR PATH: ' + String(badPreloadPath || ''));
    console.error('SEB EvalPro PRELOAD ERROR: ' + String(error && error.stack || error));
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
      const openCandidate=document.getElementById('seb-evalpro-open-candidate');
      const oldBilan=document.getElementById('seb-evalpro-old-bilan');
      const oldReplay=document.getElementById('seb-evalpro-replay');
      const oldResults=document.getElementById('seb-evalpro-results');
      document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:0,clientX:20}));
      await new Promise(r=>setTimeout(r,120));
      return {
        bar:!!bar,
        hotzone:!!hot,
        adminButton:!!admin,
        openCandidate:!!openCandidate,
        openCandidateVisible:!!openCandidate && !openCandidate.hidden && getComputedStyle(openCandidate).display!=='none',
        oldBilanVisible:!!oldBilan && !oldBilan.hidden && getComputedStyle(oldBilan).display!=='none',
        oldReplayVisible:!!oldReplay && !oldReplay.hidden && getComputedStyle(oldReplay).display!=='none',
        oldResultsVisible:!!oldResults && !oldResults.hidden && getComputedStyle(oldResults).display!=='none',
        visible:!!bar && bar.classList.contains('seb-evalpro-visible'),
        transform:bar ? getComputedStyle(bar).transform : '',
        adminText:admin ? String(admin.textContent||'').trim() : ''
      };
    })()`);

    if (!result.bar || !result.hotzone || !result.adminButton || !result.openCandidate || !result.openCandidateVisible || !result.oldBilanVisible || !result.oldReplayVisible || result.oldResultsVisible || !result.visible || result.adminText !== 'Verrouiller') {
      fail('barre Admin incorrecte ou accès historique Bilan/Replay indisponible', result);
      return;
    }

    console.log('SEB EvalPro Admin smoke: OK - Ouvrir un candidat visible; accès historiques Bilan/Replay conservés.');
    console.log(JSON.stringify(result));

    // Vérification réelle du correctif IA #25 : un seul bouton visible,
    // libellé exact, et indicateur explicite du sort de la reformulation.
    await win.loadFile(path.join(__dirname, '..', 'app', 'web', 'admin-bilan.html'));
    await new Promise((resolve) => setTimeout(resolve, 900));
    const synthesis = await win.webContents.executeJavaScript(`(()=>{
      const host=document.getElementById('seb-bilan-synthese');
      const buttons=host?[...host.querySelectorAll('button')]:[];
      const visible=buttons.filter(b=>{const s=getComputedStyle(b);return s.display!=='none'&&s.visibility!=='hidden'&&!b.hidden});
      const aiState=document.getElementById('seb-ai-result-status');
      const warning=document.getElementById('seb-ai-human-check');
      return {
        host:!!host,
        buttonCount:buttons.length,
        visibleButtonCount:visible.length,
        visibleButtonTexts:visible.map(b=>String(b.textContent||'').trim()),
        aiState:!!aiState,
        aiStateText:aiState?String(aiState.textContent||'').trim():'',
        warning:!!warning
      };
    })()`);

    if (!synthesis.host || synthesis.visibleButtonCount !== 1 || synthesis.visibleButtonTexts[0] !== 'Générer la synthèse') {
      fail('la synthèse doit afficher un seul bouton « Générer la synthèse »', synthesis);
      return;
    }
    if (!synthesis.aiState || !synthesis.warning || !/^SEB-IA\s*:/.test(synthesis.aiStateText)) {
      fail('indicateur explicite SEB-IA absent de la synthèse', synthesis);
      return;
    }
    console.log('SEB EvalPro Admin smoke: OK - bouton synthèse unique et indicateur SEB-IA présents.');
    console.log(JSON.stringify(synthesis));

    const adminUi = await win.webContents.executeJavaScript(`(()=>{
      const ids=['auto','save','word'];
      const buttons=Object.fromEntries(ids.map(id=>{
        const el=document.getElementById(id),css=el?getComputedStyle(el):null;
        return [id,{
          present:!!el,
          width:el?Math.round(el.getBoundingClientRect().width):0,
          background:css?css.backgroundColor:'',
          color:css?css.color:'',
          border:css?css.borderTopColor:''
        }];
      }));
      return {buttons,pdf:!!document.getElementById('pdf')};
    })()`);
    const blue='rgb(0, 112, 192)', white='rgb(255, 255, 255)';
    const badStyle=['auto','save','word'].some(id=>{
      const b=adminUi.buttons[id];
      return !b.present || b.background!==white || b.color!==blue || b.border!==blue;
    });
    if (badStyle || adminUi.pdf || adminUi.buttons.save.width < 270) {
      fail('présentation finale des 3 boutons du Bilan Admin incorrecte', adminUi);
      return;
    }
    console.log('SEB EvalPro Admin smoke: OK - Enregistrer agrandi, Word présent, PDF absent.');
    console.log(JSON.stringify(adminUi));

    win.destroy();
    app.exit(0);
  } catch (error) {
    fail('erreur pendant le test réel Electron: ' + String(error && error.stack || error));
  }
});

setTimeout(() => fail('délai global dépassé'), 30000).unref();
