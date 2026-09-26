const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'brique.html');

function fail(message, detail) {
  console.error('BRIQUE_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBrique(win) {
  for (let i = 0; i < 100; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebBrique && window.sebParcours && document.getElementById('startBtn') && document.getElementById('autoEvalForm'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  let diagnostic = null;
  try {
    diagnostic = await win.webContents.executeJavaScript(`
      (function(){
        return {
          href:location.href,
          title:document.title,
          readyState:document.readyState,
          sebBrique:Boolean(window.sebBrique),
          sebParcours:Boolean(window.sebParcours),
          start:Boolean(document.getElementById('startBtn')),
          form:Boolean(document.getElementById('autoEvalForm')),
          scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
        };
      })()
    `, true);
  } catch (error) {
    diagnostic = { executeError:String(error && error.message ? error.message : error) };
  }
  throw new Error('Contrôleur Brique non initialisé. Diagnostic=' + JSON.stringify(diagnostic) + ' BrowserURL=' + win.webContents.getURL());
}

async function initialState(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      return {
        chronoButtons: document.querySelectorAll('.chrono-buttons button').length,
        resetExists: Boolean(document.getElementById('resetBtn')),
        secretType: document.getElementById('secretCode')?.type || '',
        errorMin: document.getElementById('nivDiff')?.min || '',
        route: window.sebParcours.nextFile('brique')
      };
    })()
  `, true);
}

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1600,
    height:900,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}
  });

  try {
    await win.loadFile(page);
    await waitForBrique(win);

    await win.webContents.executeJavaScript(`
      for (const key of ['eval_brique','eval_brique_auto','seb_evalpro_brique_checkpoint']) sessionStorage.removeItem(key);
      true;
    `, true);
    await win.reload();
    await waitForBrique(win);

    const initial = await initialState(win);
    if (initial.chronoButtons !== 2) throw new Error('Le chrono Brique doit avoir exactement 2 boutons.');
    if (initial.resetExists) throw new Error('Ancien bouton Remise à zéro encore présent.');
    if (initial.secretType !== 'password') throw new Error('Le code de validation Brique n’est pas masqué.');
    if (initial.errorMin !== '0') throw new Error('La valeur 0 erreur n’est pas autorisée.');
    if (initial.route !== 'stock.html') throw new Error('Route Brique -> stock incorrecte.');

    const started = await win.webContents.executeJavaScript('window.sebBrique.startChrono()', true);
    if (!started) throw new Error('Le chronomètre Brique ne démarre pas.');
    await sleep(1150);

    const stopped = await win.webContents.executeJavaScript('window.sebBrique.stopChrono()', true);
    if (!stopped) throw new Error('Le chronomètre Brique ne s’arrête pas.');

    const chrono = await win.webContents.executeJavaScript(`
      (function(){
        const cp=JSON.parse(sessionStorage.getItem('seb_evalpro_brique_checkpoint')||'null');
        return {
          time:document.getElementById('temps').value,
          seconds:window.sebBrique.getChronoSeconds(),
          checkpoint:cp && cp.chronoSeconds
        };
      })()
    `, true);
    if (!chrono.time || chrono.seconds < 1 || chrono.checkpoint < 1) {
      throw new Error('Chrono/checkpoint Brique non sauvegardé correctement.');
    }

    const codeOnly = await win.webContents.executeJavaScript(`
      (function(){
        const code=document.getElementById('secretCode');
        code.value='svg56';
        code.dispatchEvent(new Event('input',{bubbles:true}));
        return {
          disabled:document.getElementById('validBtn').disabled,
          message:document.getElementById('msg').textContent
        };
      })()
    `, true);
    if (codeOnly.disabled) throw new Error('Le code correct ne déverrouille pas Valider.');
    if (!codeOnly.message.includes('renseignez le nombre')) throw new Error('Message demandant le nombre d’erreurs absent.');

    const validated = await win.webContents.executeJavaScript(`
      (function(){
        const err=document.getElementById('nivDiff');
        err.value='0';
        err.dispatchEvent(new Event('input',{bubbles:true}));
        return window.sebBrique.validateMainEvaluation();
      })()
    `, true);
    if (!validated) throw new Error('Validation Brique avec 0 erreur refusée.');
    await sleep(1100);

    const mainSaved = await win.webContents.executeJavaScript(`
      (function(){
        const data=JSON.parse(sessionStorage.getItem('eval_brique')||'null');
        return {
          data,
          autoVisible:document.getElementById('autoEvalPart').classList.contains('visible')
        };
      })()
    `, true);
    if (!mainSaved.data || mainSaved.data.niveau !== '0') throw new Error('eval_brique ne conserve pas 0 erreur.');
    if (mainSaved.data.code !== 'svg56') throw new Error('Code Brique non conservé dans le contrat historique.');
    if (!mainSaved.autoVisible) throw new Error('Autoévaluation Brique non affichée après validation.');

    const autoSaved = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('ease_br').checked=true;
        document.getElementById('stress_br').checked=true;
        document.getElementById('autoComment').value='Commentaire Brique smoke';
        const data=window.sebBrique.saveAutoEvaluation();
        const stored=JSON.parse(sessionStorage.getItem('eval_brique_auto')||'null');
        return {data,stored};
      })()
    `, true);
    if (!autoSaved.stored || !autoSaved.stored.choix.includes('ease_br') || !autoSaved.stored.choix.includes('stress_br')) {
      throw new Error('Valeurs autoévaluation Brique incorrectes.');
    }
    if (autoSaved.stored.commentaire !== 'Commentaire Brique smoke') throw new Error('Commentaire Brique non sauvegardé.');

    await win.reload();
    await waitForBrique(win);

    const restored = await win.webContents.executeJavaScript(`
      (function(){
        const main=JSON.parse(sessionStorage.getItem('eval_brique')||'null');
        const auto=JSON.parse(sessionStorage.getItem('eval_brique_auto')||'null');
        const checkpoint=JSON.parse(sessionStorage.getItem('seb_evalpro_brique_checkpoint')||'null');
        return {
          main,
          auto,
          checkpoint,
          error:document.getElementById('nivDiff').value,
          ease:document.getElementById('ease_br').checked,
          stress:document.getElementById('stress_br').checked,
          comment:document.getElementById('autoComment').value,
          autoVisible:document.getElementById('autoEvalPart').classList.contains('visible'),
          route:window.sebParcours.nextFile('brique')
        };
      })()
    `, true);

    if (!restored.main || restored.error !== '0') throw new Error('eval_brique perdu après rechargement.');
    if (!restored.auto || !restored.ease || !restored.stress) throw new Error('Cases autoévaluation Brique non restaurées.');
    if (restored.comment !== 'Commentaire Brique smoke') throw new Error('Commentaire Brique non restauré.');
    if (!restored.checkpoint || restored.checkpoint.chronoSeconds < 1) throw new Error('Checkpoint Brique perdu après rechargement.');
    if (!restored.autoVisible) throw new Error('Étape autoévaluation Brique non restaurée.');
    if (restored.route !== 'stock.html') throw new Error('Route Brique -> stock perdue après rechargement.');

    console.log('BRIQUE_FUNCTIONAL_SMOKE: OK');
    console.log('BRIQUE_TIME=' + restored.main.temps);
    console.log('BRIQUE_ERRORS=' + restored.main.niveau);
    console.log('BRIQUE_AUTO=' + restored.auto.choix.join(','));
    console.log('BRIQUE_ROUTE=' + restored.route);
    win.destroy();
    app.exit(0);
  } catch(error) {
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test Brique.'),45000);
