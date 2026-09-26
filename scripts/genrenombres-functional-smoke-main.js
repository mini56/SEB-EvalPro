const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'genrenombres.html');

function fail(message, detail) {
  console.error('GENRENOMBRES_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGenreNombre(win) {
  for (let i = 0; i < 120; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebGenreNombre && window.sebParcours && document.querySelectorAll('input[data-answer]').length === 20 && document.getElementById('btnCheck') && document.getElementById('btnNextGenreNombre'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    (function(){
      return {
        href:location.href,
        controller:Boolean(window.sebGenreNombre),
        parcours:Boolean(window.sebParcours),
        inputs:document.querySelectorAll('input[data-answer]').length,
        check:Boolean(document.getElementById('btnCheck')),
        next:Boolean(document.getElementById('btnNextGenreNombre')),
        scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
      };
    })()
  `, true).catch((error) => ({ error:String(error) }));
  throw new Error('Contrôleur Genre/Nombre non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'user_genrenombres','erreurs_exercice','seb_genrenombres_validated',
      'seb_evalpro_genrenombres_state','seb_evalpro_page_draft_genrenombres.html',
      'seb_exercise_activity:genrenombres.html'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForGenreNombre(win);
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
    await waitForGenreNombre(win);
    await clearState(win);

    const initial = await win.webContents.executeJavaScript(`
      ({
        inputs:document.querySelectorAll('input[data-answer]').length,
        total:window.sebGenreNombre.total,
        route:window.sebParcours.nextFile('genrenombres'),
        checkVisible:getComputedStyle(document.getElementById('btnCheck')).display !== 'none',
        nextVisible:getComputedStyle(document.getElementById('btnNextGenreNombre')).display !== 'none'
      })
    `, true);

    if (initial.inputs !== 20 || initial.total !== 20) throw new Error('Genre/Nombre doit contenir exactement 20 réponses.');
    if (initial.route !== 'dictee.html') throw new Error('Route Genre/Nombre -> Dictée incorrecte.');
    if (!initial.checkVisible || initial.nextVisible) throw new Error('État initial des boutons Genre/Nombre incorrect.');

    const empty = await win.webContents.executeJavaScript('window.sebGenreNombre.verify()', true);
    if (empty !== null) throw new Error('Un exercice Genre/Nombre totalement vide a été validé.');

    const emptyState = await win.webContents.executeJavaScript(`
      ({
        errors:sessionStorage.getItem('erreurs_exercice'),
        answers:sessionStorage.getItem('user_genrenombres'),
        done:sessionStorage.getItem('seb_genrenombres_validated'),
        disabled:Array.from(document.querySelectorAll('input[data-answer]')).some(function(input){ return input.disabled; })
      })
    `, true);
    if (emptyState.errors !== null || emptyState.answers !== null || emptyState.done !== null || emptyState.disabled) {
      throw new Error('La vérification vide a altéré Genre/Nombre.');
    }

    await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        list[1].value='  DES   MESSIEURS  ';
        list[1].dispatchEvent(new Event('input',{bubbles:true}));
        list[8].value='Des chefs-d’œuvre';
        list[8].dispatchEvent(new Event('input',{bubbles:true}));
        list[14].value='Comedienne';
        list[14].dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(120);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_genrenombres_state')||'null');
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        return {
          state,
          v1:list[1].value,
          v8:list[8].value,
          v14:list[14].value
        };
      })()
    `, true);
    if (!draft.state || draft.state.validated) throw new Error('Brouillon Genre/Nombre non sauvegardé.');

    await win.reload();
    await waitForGenreNombre(win);

    const restoredDraft = await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        return {
          v1:list[1].value,
          v8:list[8].value,
          v14:list[14].value,
          errors:sessionStorage.getItem('erreurs_exercice'),
          disabled:list.some(function(input){return input.disabled;}),
          checkVisible:getComputedStyle(document.getElementById('btnCheck')).display !== 'none'
        };
      })()
    `, true);

    if (restoredDraft.v1 !== 'DES   MESSIEURS' && restoredDraft.v1 !== '  DES   MESSIEURS  ') {
      throw new Error('Brouillon avec espaces multiples perdu après rechargement.');
    }
    if (restoredDraft.v8 !== 'Des chefs-d’œuvre' || restoredDraft.v14 !== 'Comedienne') {
      throw new Error('Brouillon Genre/Nombre incomplet après rechargement.');
    }
    if (restoredDraft.errors !== null || restoredDraft.disabled || !restoredDraft.checkVisible) {
      throw new Error('Brouillon Genre/Nombre verrouillé avant vérification.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebGenreNombre.verify()', true);
    if (!partial || partial.score !== 2 || partial.errors !== 18 || partial.total !== 20) {
      throw new Error('Barème partiel Genre/Nombre incorrect: ' + JSON.stringify(partial));
    }
    if (!partial.details[1]?.correct || !partial.details[8]?.correct || partial.details[14]?.correct) {
      throw new Error('Normalisation Genre/Nombre incorrecte: espaces/apostrophe/accent.');
    }

    const storedPartial = await win.webContents.executeJavaScript(`
      (function(){
        const answers=JSON.parse(sessionStorage.getItem('user_genrenombres')||'null');
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_genrenombres_state')||'null');
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        return {
          errors:sessionStorage.getItem('erreurs_exercice'),
          done:sessionStorage.getItem('seb_genrenombres_validated'),
          answerCount:Array.isArray(answers)?answers.length:0,
          validated:!!state?.validated,
          allDisabled:list.every(function(input){return input.disabled;}),
          checkVisible:getComputedStyle(document.getElementById('btnCheck')).display !== 'none',
          nextVisible:getComputedStyle(document.getElementById('btnNextGenreNombre')).display !== 'none',
          green:list.filter(function(input){return input.style.background==='rgb(212, 247, 212)' || input.style.background==='#d4f7d4';}).length,
          red:list.filter(function(input){return input.style.background==='rgb(247, 212, 212)' || input.style.background==='#f7d4d4';}).length
        };
      })()
    `, true);

    if (storedPartial.errors !== '18' || storedPartial.done !== '1' || storedPartial.answerCount !== 20) {
      throw new Error('Contrat historique Genre/Nombre incorrect après vérification.');
    }
    if (!storedPartial.validated || !storedPartial.allDisabled || storedPartial.checkVisible || !storedPartial.nextVisible) {
      throw new Error('Verrouillage Genre/Nombre incorrect après vérification.');
    }
    if (storedPartial.green !== 2 || storedPartial.red !== 18) {
      throw new Error('Correction visuelle Genre/Nombre incorrecte.');
    }

    await win.reload();
    await waitForGenreNombre(win);

    const lockedReload = await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        return {
          errors:sessionStorage.getItem('erreurs_exercice'),
          allDisabled:list.every(function(input){return input.disabled;}),
          nextVisible:getComputedStyle(document.getElementById('btnNextGenreNombre')).display !== 'none',
          green:list.filter(function(input){return input.style.background==='rgb(212, 247, 212)' || input.style.background==='#d4f7d4';}).length,
          red:list.filter(function(input){return input.style.background==='rgb(247, 212, 212)' || input.style.background==='#f7d4d4';}).length,
          route:window.sebParcours.nextFile('genrenombres')
        };
      })()
    `, true);

    if (lockedReload.errors !== '18' || !lockedReload.allDisabled || !lockedReload.nextVisible) {
      throw new Error('État validé Genre/Nombre perdu après rechargement.');
    }
    if (lockedReload.green !== 2 || lockedReload.red !== 18 || lockedReload.route !== 'dictee.html') {
      throw new Error('Correction/navigation Genre/Nombre perdue après rechargement.');
    }

    await clearState(win);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('input[data-answer]'));
        list.forEach(function(input){
          input.value=String(input.dataset.answer||'').split('|')[0];
          input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebGenreNombre.verify();
      })()
    `, true);

    if (!perfect || perfect.score !== 20 || perfect.errors !== 0 || perfect.total !== 20) {
      throw new Error('Le Genre/Nombre parfait n’obtient pas 20/20.');
    }

    const perfectStored = await win.webContents.executeJavaScript(`
      (function(){
        const answers=JSON.parse(sessionStorage.getItem('user_genrenombres')||'null');
        return {
          errors:sessionStorage.getItem('erreurs_exercice'),
          answers:Array.isArray(answers)?answers.length:0,
          done:sessionStorage.getItem('seb_genrenombres_validated'),
          nextVisible:getComputedStyle(document.getElementById('btnNextGenreNombre')).display !== 'none'
        };
      })()
    `, true);

    if (perfectStored.errors !== '0' || perfectStored.answers !== 20 || perfectStored.done !== '1' || !perfectStored.nextVisible) {
      throw new Error('Résultat parfait Genre/Nombre non persisté.');
    }

    console.log('GENRENOMBRES_FUNCTIONAL_SMOKE: OK');
    console.log('GENRENOMBRES_DRAFT_RESUME=OK');
    console.log('GENRENOMBRES_NORMALIZATION=SPACES_APOSTROPHE_OK_ACCENT_STRICT');
    console.log('GENRENOMBRES_PARTIAL=2/20_ERRORS_18');
    console.log('GENRENOMBRES_PERFECT=20/20_ERRORS_0');
    console.log('GENRENOMBRES_ROUTE=dictee.html');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Genre/Nombre.'), 45000);
