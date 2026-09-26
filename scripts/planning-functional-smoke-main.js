const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'planning.html');

function fail(message, detail) {
  console.error('PLANNING_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPlanning(win) {
  for (let i = 0; i < 120; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebPlanning && window.sebParcours && document.querySelectorAll('select[id^=\"q\"]').length === 15 && document.getElementById('btnValider'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    (function(){
      return {
        href:location.href,
        planning:Boolean(window.sebPlanning),
        parcours:Boolean(window.sebParcours),
        selects:document.querySelectorAll('select[id^="q"]').length,
        validate:Boolean(document.getElementById('btnValider')),
        scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
      };
    })()
  `, true).catch((error) => ({ error:String(error) }));
  throw new Error('Contrôleur Planning non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
}

async function clearPlanning(win) {
  await win.webContents.executeJavaScript(`
    [
      'planningScore','planningCorrection','seb_evalpro_planning_state',
      'seb_planning_validated','seb_evalpro_page_draft_planning.html',
      'seb_exercise_activity:planning.html'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForPlanning(win);
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
    await waitForPlanning(win);
    await clearPlanning(win);

    const initial = await win.webContents.executeJavaScript(`
      (function(){
        return {
          selects:document.querySelectorAll('select[id^="q"]').length,
          total:window.sebPlanning.total,
          route:window.sebParcours.nextFile('planning'),
          q7Options:Array.from(document.getElementById('q7').options).map(function(o){ return o.value; }),
          validateVisible:getComputedStyle(document.getElementById('btnValider')).display !== 'none',
          nextVisible:getComputedStyle(document.getElementById('btnSuivant')).display !== 'none'
        };
      })()
    `, true);

    if (initial.selects !== 15 || initial.total !== 15) throw new Error('Planning doit contenir exactement 15 réponses.');
    if (initial.route !== 'genrenombres.html') throw new Error('Route Planning -> genrenombres incorrecte.');
    if (!initial.q7Options.includes('Spaghettis') || initial.q7Options.includes('Spaghetti')) {
      throw new Error('Libellé Spaghettis incorrect dans q7.');
    }
    if (!initial.validateVisible || initial.nextVisible) throw new Error('État initial des boutons Planning incorrect.');

    const empty = await win.webContents.executeJavaScript('window.sebPlanning.validatePlanning()', true);
    if (empty !== null) throw new Error('Un planning totalement vierge a été validé.');
    const emptyState = await win.webContents.executeJavaScript(`
      ({
        score:sessionStorage.getItem('planningScore'),
        done:sessionStorage.getItem('seb_planning_validated'),
        disabled:Array.from(document.querySelectorAll('select[id^="q"]')).some(function(s){ return s.disabled; })
      })
    `, true);
    if (emptyState.score !== null || emptyState.done !== null || emptyState.disabled) {
      throw new Error('La validation vide a altéré le Planning.');
    }

    await win.webContents.executeJavaScript(`
      (function(){
        const values={q1:'Lizig👱🏼‍♀️',q7:'Spaghettis'};
        Object.entries(values).forEach(function(entry){
          const select=document.getElementById(entry[0]);
          select.value=entry[1];
          select.dispatchEvent(new Event('change',{bubbles:true}));
        });
        return true;
      })()
    `, true);
    await sleep(120);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_planning_state')||'null');
        return {state,q1:document.getElementById('q1').value,q7:document.getElementById('q7').value};
      })()
    `, true);
    if (!draft.state || draft.state.validated || draft.q1 !== 'Lizig👱🏼‍♀️' || draft.q7 !== 'Spaghettis') {
      throw new Error('Brouillon Planning non sauvegardé.');
    }

    await win.reload();
    await waitForPlanning(win);

    const draftRestored = await win.webContents.executeJavaScript(`
      ({
        q1:document.getElementById('q1').value,
        q7:document.getElementById('q7').value,
        score:sessionStorage.getItem('planningScore'),
        locked:Array.from(document.querySelectorAll('select[id^="q"]')).some(function(s){ return s.disabled; }),
        validateVisible:getComputedStyle(document.getElementById('btnValider')).display !== 'none'
      })
    `, true);
    if (draftRestored.q1 !== 'Lizig👱🏼‍♀️' || draftRestored.q7 !== 'Spaghettis') {
      throw new Error('Brouillon Planning perdu après rechargement.');
    }
    if (draftRestored.score !== null || draftRestored.locked || !draftRestored.validateVisible) {
      throw new Error('Le brouillon Planning a été verrouillé avant validation.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebPlanning.validatePlanning()', true);
    if (!partial || partial.score !== 2 || partial.total !== 15) {
      throw new Error('Score Planning partiel incorrect.');
    }

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const corr=JSON.parse(sessionStorage.getItem('planningCorrection')||'null');
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_planning_state')||'null');
        return {
          score:sessionStorage.getItem('planningScore'),
          done:sessionStorage.getItem('seb_planning_validated'),
          correctionCount:corr?Object.keys(corr).length:0,
          q1:corr?.q1,
          q7:corr?.q7,
          q2:corr?.q2,
          stateValidated:!!state?.validated,
          allDisabled:Array.from(document.querySelectorAll('select[id^="q"]')).every(function(s){ return s.disabled; }),
          validateVisible:getComputedStyle(document.getElementById('btnValider')).display !== 'none',
          nextVisible:getComputedStyle(document.getElementById('btnSuivant')).display !== 'none'
        };
      })()
    `, true);

    if (partialStored.score !== '2' || partialStored.done !== '1' || partialStored.correctionCount !== 15) {
      throw new Error('Contrat historique Planning incorrect après validation partielle.');
    }
    if (!partialStored.q1?.correct || !partialStored.q7?.correct || partialStored.q2?.correct) {
      throw new Error('Détail planningCorrection incorrect.');
    }
    if (!partialStored.stateValidated || !partialStored.allDisabled || partialStored.validateVisible || !partialStored.nextVisible) {
      throw new Error('Verrouillage Planning incorrect après validation.');
    }

    await win.reload();
    await waitForPlanning(win);

    const lockedReload = await win.webContents.executeJavaScript(`
      ({
        score:sessionStorage.getItem('planningScore'),
        q1:document.getElementById('q1').value,
        q7:document.getElementById('q7').value,
        allDisabled:Array.from(document.querySelectorAll('select[id^="q"]')).every(function(s){ return s.disabled; }),
        nextVisible:getComputedStyle(document.getElementById('btnSuivant')).display !== 'none',
        route:window.sebParcours.nextFile('planning')
      })
    `, true);
    if (lockedReload.score !== '2' || lockedReload.q1 !== 'Lizig👱🏼‍♀️' || lockedReload.q7 !== 'Spaghettis') {
      throw new Error('Planning validé non restauré après rechargement.');
    }
    if (!lockedReload.allDisabled || !lockedReload.nextVisible || lockedReload.route !== 'genrenombres.html') {
      throw new Error('Verrouillage/navigation Planning perdu après rechargement.');
    }

    await clearPlanning(win);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        Object.entries(window.sebPlanning.solutions).forEach(function(entry){
          const select=document.getElementById(entry[0]);
          select.value=entry[1];
          select.dispatchEvent(new Event('change',{bubbles:true}));
        });
        return window.sebPlanning.validatePlanning();
      })()
    `, true);

    if (!perfect || perfect.score !== 15 || perfect.total !== 15) {
      throw new Error('Le Planning parfait n’obtient pas 15/15.');
    }

    const perfectStored = await win.webContents.executeJavaScript(`
      (function(){
        const corr=JSON.parse(sessionStorage.getItem('planningCorrection')||'null');
        return {
          score:sessionStorage.getItem('planningScore'),
          totalCorrect:corr?Object.values(corr).filter(function(item){return item.correct;}).length:0,
          q7:corr?.q7?.attendu,
          nextVisible:getComputedStyle(document.getElementById('btnSuivant')).display !== 'none'
        };
      })()
    `, true);

    if (perfectStored.score !== '15' || perfectStored.totalCorrect !== 15 || perfectStored.q7 !== 'Spaghettis') {
      throw new Error('Résultat parfait Planning non persisté.');
    }
    if (!perfectStored.nextVisible) throw new Error('Bouton Suivant absent après Planning parfait.');

    console.log('PLANNING_FUNCTIONAL_SMOKE: OK');
    console.log('PLANNING_DRAFT_RESUME=OK');
    console.log('PLANNING_PARTIAL=2/15');
    console.log('PLANNING_PERFECT=15/15');
    console.log('PLANNING_ROUTE=genrenombres.html');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Planning.'), 45000);
