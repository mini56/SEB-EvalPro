const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bootstrapPage = path.join(root, 'app', 'web', 'qcmv1.0.html');
const triPage = path.join(root, 'app', 'web', 'tri_de_cheville.html');

function fail(message, detail) {
  console.error('TRI_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTri(win) {
  for (let i = 0; i < 100; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebTri && window.sebParcours && document.getElementById('startBtn') && document.getElementById('stopBtn'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur Tri non initialisé.');
}

async function prepareSession(win) {
  await win.loadFile(bootstrapPage);
  await win.webContents.executeJavaScript(`
    sessionStorage.setItem('dictee_data', JSON.stringify({status:'verified',scoreSur20:20}));
    for (const key of [
      'tri_cheville_data',
      'autoEvaltri_resultats',
      'seb_tri_navigation_ready',
      'seb_evalpro_tri_live_chrono'
    ]) sessionStorage.removeItem(key);
    true;
  `, true);
}

async function inspect(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      const chronoButtons=document.querySelectorAll('.chrono-buttons button');
      return {
        chronoButtons:chronoButtons.length,
        startText:document.getElementById('startBtn')?.textContent.trim(),
        stopText:document.getElementById('stopBtn')?.textContent.trim(),
        resetExists:Boolean(document.getElementById('resetBtn')),
        startDisabled:Boolean(document.getElementById('startBtn')?.disabled),
        stopDisabled:Boolean(document.getElementById('stopBtn')?.disabled),
        currentTri:window.sebTri.getCurrentTri(),
        awaitingError:window.sebTri.getAwaitingError(),
        chrono:document.getElementById('chrono-min').textContent+':'+document.getElementById('chrono-sec').textContent
      };
    })()
  `, true);
}

async function performTri(win, index, errors) {
  const started = await win.webContents.executeJavaScript('window.sebTri.startChrono()', true);
  if (!started) throw new Error('Tri '+index+': le chrono ne démarre pas.');

  await sleep(1150);

  const runningState = await win.webContents.executeJavaScript(`
    ({
      startDisabled:document.getElementById('startBtn').disabled,
      stopDisabled:document.getElementById('stopBtn').disabled
    })
  `, true);
  if (!runningState.startDisabled || runningState.stopDisabled) {
    throw new Error('Tri '+index+': état des boutons incorrect pendant le chrono.');
  }

  const stopped = await win.webContents.executeJavaScript('window.sebTri.stopChrono()', true);
  if (!stopped) throw new Error('Tri '+index+': arrêt du chrono impossible.');
  await sleep(80);

  const afterStop = await win.webContents.executeJavaScript(`
    (function(){
      const m=document.getElementById('m${index}');
      const s=document.getElementById('s${index}');
      return {
        minutes:m.value,
        secondes:s.value,
        readonlyMinutes:m.readOnly,
        readonlySeconds:s.readOnly,
        active:document.activeElement && document.activeElement.id,
        startDisabled:document.getElementById('startBtn').disabled,
        stopDisabled:document.getElementById('stopBtn').disabled,
        awaiting:window.sebTri.getAwaitingError()
      };
    })()
  `, true);

  if (afterStop.minutes === '' || afterStop.secondes === '') {
    throw new Error('Tri '+index+': Minutes/Secondes non remplis automatiquement.');
  }
  if (!afterStop.readonlyMinutes || !afterStop.readonlySeconds) {
    throw new Error('Tri '+index+': Minutes/Secondes doivent être en lecture seule.');
  }
  if (afterStop.active !== 'e'+index) {
    throw new Error('Tri '+index+': le curseur ne se place pas sur Erreurs ('+afterStop.active+').');
  }
  if (!afterStop.startDisabled || !afterStop.stopDisabled || afterStop.awaiting !== index) {
    throw new Error('Tri '+index+': état en attente du nombre d’erreurs incorrect.');
  }

  await win.webContents.executeJavaScript(`
    (function(){
      const e=document.getElementById('e${index}');
      e.value='${errors}';
      e.dispatchEvent(new Event('input',{bubbles:true}));
      e.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })()
  `, true);
  await sleep(80);

  const afterError = await inspect(win);
  if (afterError.currentTri !== index + 1) {
    throw new Error('Tri '+index+': passage au tri suivant incorrect, currentTri='+afterError.currentTri);
  }
  if (afterError.awaitingError !== null) {
    throw new Error('Tri '+index+': attente Erreurs non libérée.');
  }
  if (afterError.chrono !== '00:00') {
    throw new Error('Tri '+index+': chrono non remis à 00:00 après saisie des erreurs.');
  }
  if (index < 5 && afterError.startDisabled) {
    throw new Error('Tri '+index+': Démarrer non réactivé pour le tri suivant.');
  }

  return { minutes:afterStop.minutes, secondes:afterStop.secondes };
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
    await prepareSession(win);
    await win.loadFile(triPage);
    await waitForTri(win);

    const initial = await inspect(win);
    if (initial.chronoButtons !== 2) throw new Error('Nombre de boutons chrono attendu: 2, obtenu: '+initial.chronoButtons);
    if (initial.resetExists) throw new Error('Ancien troisième bouton chrono encore présent.');
    if (initial.startText !== 'Démarrer le chronomètre') throw new Error('Libellé Démarrer incorrect.');
    if (initial.stopText !== 'Arrêter le chronomètre') throw new Error('Libellé Arrêter incorrect.');
    if (initial.startDisabled || !initial.stopDisabled) throw new Error('État initial des boutons incorrect.');

    await performTri(win, 1, 0);
    await performTri(win, 2, 2);
    await performTri(win, 3, 1);

    const afterThree = await win.webContents.executeJavaScript(`
      (function(){
        const calc=document.getElementById('calc');
        const data=JSON.parse(sessionStorage.getItem('tri_cheville_data')||'null');
        return {
          calcDisabled:calc.disabled,
          completed:window.sebTri.completedTriIndexes().length,
          minimumDone:window.sebTri.minimumTrisDone(),
          total:data && data.totalErreurs,
          moyenne:data && data.moyenne,
          rows:data && data.tris
        };
      })()
    `, true);

    if (afterThree.calcDisabled) throw new Error('Voir les résultats doit être disponible après 3 tris complets.');
    if (afterThree.completed !== 3 || !afterThree.minimumDone) throw new Error('Les 3 tris complets ne sont pas reconnus.');
    if (afterThree.total !== '3') throw new Error('Total erreurs attendu 3, obtenu '+afterThree.total);
    if (!Array.isArray(afterThree.rows) || afterThree.rows.length !== 5) throw new Error('Structure tri_cheville_data.tris invalide.');
    if (afterThree.rows[0].erreurs !== '0') throw new Error('La valeur 0 des erreurs n’est pas conservée.');
    if (afterThree.rows[3].minutes !== '' || afterThree.rows[4].minutes !== '') throw new Error('Des tris non réalisés ont été inventés.');

    await win.webContents.executeJavaScript("document.getElementById('calc').click()", true);
    await sleep(450);

    const resultsState = await win.webContents.executeJavaScript(`
      ({
        resultsDisplay:getComputedStyle(document.querySelector('#right .results-container')).display,
        autoVisible:document.getElementById('autoEvalPart').classList.contains('visible')
      })
    `, true);
    if (resultsState.resultsDisplay === 'none') throw new Error('Résultats non affichés après 3 tris.');
    if (!resultsState.autoVisible) throw new Error('Autoévaluation non affichée après Voir les résultats.');

    await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('ease').checked=true;
        document.getElementById('ease').dispatchEvent(new Event('change',{bubbles:true}));
        document.getElementById('seb-tri-auto-validate').click();
        return true;
      })()
    `, true);
    await sleep(100);

    const ready = await win.webContents.executeJavaScript(`
      (function(){
        const auto=JSON.parse(sessionStorage.getItem('autoEvaltri_resultats')||'null');
        const next=document.getElementById('seb-tri-next');
        return {
          ready:window.sebEvalProTriNavigationReady(),
          readyKey:sessionStorage.getItem('seb_tri_navigation_ready'),
          auto:auto,
          nextLocked:next.classList.contains('seb-exercise-nav-locked'),
          route:window.sebParcours.nextFile('tri-de-cheville')
        };
      })()
    `, true);

    if (!ready.ready || ready.readyKey !== '1') throw new Error('Navigation Tri non déverrouillée après autoévaluation.');
    if (!ready.auto || !ready.auto.selections.includes('ease')) throw new Error('Autoévaluation Tri non sauvegardée.');
    if (ready.nextLocked) throw new Error('Bouton Étape suivante encore verrouillé.');
    if (ready.route !== 'nwtexte.html') throw new Error('Route Tri -> nwtexte incorrecte: '+ready.route);

    await win.reload();
    await waitForTri(win);
    await sleep(100);

    const restored = await win.webContents.executeJavaScript(`
      (function(){
        const data=JSON.parse(sessionStorage.getItem('tri_cheville_data')||'null');
        return {
          currentTri:window.sebTri.getCurrentTri(),
          completed:window.sebTri.completedTriIndexes().length,
          m1:document.getElementById('m1').value,
          e1:document.getElementById('e1').value,
          m3:document.getElementById('m3').value,
          e3:document.getElementById('e3').value,
          startDisabled:document.getElementById('startBtn').disabled,
          stopDisabled:document.getElementById('stopBtn').disabled,
          ready:window.sebEvalProTriNavigationReady(),
          total:data.totalErreurs
        };
      })()
    `, true);

    if (restored.currentTri !== 4 || restored.completed !== 3) throw new Error('Reprise attendue au tri n°4.');
    if (restored.e1 !== '0' || restored.e3 !== '1' || restored.total !== '3') throw new Error('Données Tri perdues après rechargement.');
    if (restored.startDisabled || !restored.stopDisabled) throw new Error('Boutons incorrects après reprise au tri n°4.');
    if (!restored.ready) throw new Error('Validation autoévaluation perdue après reprise.');

    console.log('TRI_FUNCTIONAL_SMOKE: OK');
    console.log('TRI_BUTTONS=2');
    console.log('TRI_COMPLETED=3');
    console.log('TRI_TOTAL_ERRORS=3');
    console.log('TRI_RESUME_CURRENT=4');
    console.log('TRI_ROUTE='+ready.route);

    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Tri.'), 60000);
