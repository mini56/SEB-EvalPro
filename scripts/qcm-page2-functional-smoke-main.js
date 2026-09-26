const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE2_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage2(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage2 && window.sebParcours && document.getElementById('page2') && document.querySelectorAll('#page2 input[id^=\"reponse2_\"]').length === 5)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    ({
      href:location.href,
      controller:Boolean(window.sebQcmPage2),
      parcours:Boolean(window.sebParcours),
      page2:Boolean(document.getElementById('page2')),
      answers:document.querySelectorAll('#page2 input[id^="reponse2_"]').length,
      scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
    })
  `, true).catch((error) => ({ error:String(error) }));
  throw new Error('Contrôleur QCM Page 2 non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
}

async function loadPage2(win) {
  await win.loadFile(page, { query:{ page:'2' }, hash:'page2' });
  await waitForPage2(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page2').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 2 non visible après chargement.');
}

async function clearPage2(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','seb_evalpro_qcm_page2_state',
      'seb_evalpro_page_draft_qcmv1.0.html','seb_exercise_activity:qcmv1.0.html:page2'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForPage2(win);
  await sleep(120);
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
    await loadPage2(win);
    await clearPage2(win);

    const initial = await win.webContents.executeJavaScript(`
      (function(){
        return {
          visible:document.getElementById('page2').classList.contains('visible'),
          answers:document.querySelectorAll('#page2 input[id^="reponse2_"]').length,
          units:document.querySelectorAll('#page2 input[id^="unite2_"]').length,
          total:window.sebQcmPage2.total,
          nextUrl:window.sebParcours.nextUrl('qcm-2'),
          spinnerStyle:Boolean(document.getElementById('seb-page2-no-spinner')),
          legacySafeScript:Boolean(document.getElementById('seb-page2-safe-number-inputs')),
          numeric010:window.sebQcmPage2.sameNumeric('010','10'),
          numericSpaces:window.sebQcmPage2.sameNumeric('1 250','1250'),
          invalidNumeric:window.sebQcmPage2.sameNumeric('52a','52')
        };
      })()
    `, true);

    if (!initial.visible || initial.answers !== 5 || initial.units !== 5 || initial.total !== 5) {
      throw new Error('Structure Page 2 incorrecte.');
    }
    if (initial.nextUrl !== 'qcmv1.0.html?page=2_1#page2_1') throw new Error('Route Page 2 -> Page 2_1 incorrecte.');
    if (!initial.spinnerStyle || initial.legacySafeScript) throw new Error('Protection saisie numérique Page 2 incorrecte.');
    if (!initial.numeric010 || !initial.numericSpaces || initial.invalidNumeric) {
      throw new Error('Normalisation numérique Page 2 incorrecte.');
    }

    await win.webContents.executeJavaScript(`
      (function(){
        const values={1:'1020',2:'1250'};
        Object.entries(values).forEach(function(entry){
          const input=document.getElementById('reponse2_'+entry[0]);
          input.value=entry[1];
          input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        const u1=document.getElementById('unite2_1');
        u1.value='vis';
        u1.dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page2_state')||'null');
        return {state,q1:document.getElementById('reponse2_1').value,q2:document.getElementById('reponse2_2').value,u1:document.getElementById('unite2_1').value};
      })()
    `, true);
    if (!draft.state || draft.q1 !== '1020' || draft.q2 !== '1250' || draft.u1 !== 'vis') {
      throw new Error('Brouillon Page 2 non sauvegardé.');
    }

    await win.reload();
    await waitForPage2(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      ({
        q1:document.getElementById('reponse2_1').value,
        q2:document.getElementById('reponse2_2').value,
        u1:document.getElementById('unite2_1').value,
        responses:sessionStorage.getItem('reponses_data'),
        scores:sessionStorage.getItem('scores_data')
      })
    `, true);
    if (restored.q1 !== '1020' || restored.q2 !== '1250' || restored.u1 !== 'vis') {
      throw new Error('Brouillon Page 2 perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Le brouillon Page 2 a été validé avant navigation.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebQcmPage2.save()', true);
    if (!partial || partial.score !== 2 || partial.total !== 5) throw new Error('Score partiel Page 2 incorrect.');

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          q1:r.page2_q1,q2:r.page2_q2,q3:r.page2_q3,
          u1:r.page2_unite1,
          scores:[s.page2_q1,s.page2_q2,s.page2_q3,s.page2_q4,s.page2_q5],
          unitScores:[s.page2_unite1,s.page2_unite2,s.page2_unite3,s.page2_unite4,s.page2_unite5]
        };
      })()
    `, true);
    if (partialStored.q1 !== '1020' || partialStored.q2 !== '1250' || partialStored.q3 !== '' || partialStored.u1 !== 'vis') {
      throw new Error('Contrat historique reponses_data Page 2 incorrect.');
    }
    if (JSON.stringify(partialStored.scores) !== JSON.stringify([1,1,0,0,0])) {
      throw new Error('Contrat historique scores_data Page 2 incorrect.');
    }
    if (partialStored.unitScores.some(function(value){return value !== 0;})) {
      throw new Error('Les unités Page 2 ne sont plus non notées.');
    }

    await clearPage2(win);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        Object.entries(window.sebQcmPage2.answers).forEach(function(entry){
          const input=document.getElementById('reponse2_'+entry[0]);
          input.value=entry[1];
          input.dispatchEvent(new Event('input',{bubbles:true}));
          const unit=document.getElementById('unite2_'+entry[0]);
          unit.value='u'+entry[0];
          unit.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmPage2.save();
      })()
    `, true);
    if (!perfect || perfect.score !== 5 || perfect.total !== 5) {
      throw new Error('La Page 2 parfaite n’obtient pas 5/5.');
    }

    await win.webContents.executeJavaScript("document.getElementById('page2Next').click(); true", true);

    let navigated = false;
    for (let i = 0; i < 140; i += 1) {
      try {
        const state = await win.webContents.executeJavaScript(`
          ({
            page:location.search,
            visible:Boolean(document.getElementById('page2_1')?.classList.contains('visible')),
            controller:Boolean(window.sebQcmPage2)
          })
        `, true);
        if (state.page.includes('page=2_1') && state.visible && state.controller) {
          navigated = true;
          break;
        }
      } catch (_) {}
      await sleep(50);
    }
    if (!navigated) throw new Error('Navigation réelle Page 2 -> Page 2_1 échouée.');

    const preserved = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse2_1_6').value='10';
        saveTableAnswers('2_1');
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p2:r.page2_q1,
          p2score:s.page2_q1,
          p21:r.page2_1_q6,
          p21score:s.page2_1_q6
        };
      })()
    `, true);

    if (preserved.p2 !== '1020' || preserved.p2score !== 1 || preserved.p21 !== '10' || preserved.p21score !== 1) {
      throw new Error('Page 2 perdue lors de la sauvegarde Page 2_1.');
    }

    console.log('QCM_PAGE2_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE2_DRAFT_RESUME=OK');
    console.log('QCM_PAGE2_NUMERIC_NORMALIZATION=OK');
    console.log('QCM_PAGE2_PARTIAL=2/5');
    console.log('QCM_PAGE2_PERFECT=5/5');
    console.log('QCM_PAGE2_UNITS_UNSCORED=OK');
    console.log('QCM_PAGE2_ROUTE=qcmv1.0.html?page=2_1#page2_1');
    console.log('QCM_PAGE2_NEXT_PAGE_PRESERVES_DATA=OK');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 2.'), 50000);
