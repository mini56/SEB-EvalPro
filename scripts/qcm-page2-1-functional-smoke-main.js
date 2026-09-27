const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE2_1_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage2_1 && window.sebParcours && document.getElementById('page2_1') && document.querySelectorAll('#page2_1 input[id^=\"reponse2_1_\"]').length === 5)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur QCM Page 2_1 non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'2_1' }, hash:'page2_1' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page2_1').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 2_1 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','seb_evalpro_qcm_page2_1_state',
      'seb_evalpro_page_draft_qcmv1.0.html','seb_exercise_activity:qcmv1.0.html:page2_1'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForPage(win);
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
    await loadPage(win);
    await clearState(win);

    const initial = await win.webContents.executeJavaScript(`
      ({
        visible:document.getElementById('page2_1').classList.contains('visible'),
        answers:document.querySelectorAll('#page2_1 input[id^="reponse2_1_"]').length,
        units:document.querySelectorAll('#page2_1 input[id^="unite2_1_"]').length,
        total:window.sebQcmPage2_1.total,
        nextUrl:window.sebParcours.nextUrl('qcm-2_1'),
        numeric010:window.sebQcmPage2_1.sameNumeric('010','10'),
        numericSpaces:window.sebQcmPage2_1.sameNumeric(' 75 ','75'),
        invalidNumeric:window.sebQcmPage2_1.sameNumeric('7a5','75')
      })
    `, true);

    if (!initial.visible || initial.answers !== 5 || initial.units !== 5 || initial.total !== 5) {
      throw new Error('Structure Page 2_1 incorrecte.');
    }
    if (initial.nextUrl !== 'qcmv1.0.html?page=3#page3') throw new Error('Route Page 2_1 -> Page 3 incorrecte.');
    if (!initial.numeric010 || !initial.numericSpaces || initial.invalidNumeric) {
      throw new Error('Normalisation numérique Page 2_1 incorrecte.');
    }

    const filter = await win.webContents.executeJavaScript(`
      (function(){
        const input=document.getElementById('reponse2_1_6');
        input.value='10abc,';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        return input.value;
      })()
    `, true);
    if (filter !== '10,') throw new Error('Filtrage numérique Page 2_1 incorrect: ' + filter);

    await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse2_1_6').value='10';
        document.getElementById('reponse2_1_6').dispatchEvent(new Event('input',{bubbles:true}));
        document.getElementById('reponse2_1_7').value='75';
        document.getElementById('reponse2_1_7').dispatchEvent(new Event('input',{bubbles:true}));
        document.getElementById('unite2_1_6').value='kg';
        document.getElementById('unite2_1_6').dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page2_1_state')||'null');
        return {
          state,
          q6:document.getElementById('reponse2_1_6').value,
          q7:document.getElementById('reponse2_1_7').value,
          u6:document.getElementById('unite2_1_6').value
        };
      })()
    `, true);
    if (!draft.state || draft.q6 !== '10' || draft.q7 !== '75' || draft.u6 !== 'kg') {
      throw new Error('Brouillon Page 2_1 non sauvegardé.');
    }

    await win.reload();
    await waitForPage(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      ({
        q6:document.getElementById('reponse2_1_6').value,
        q7:document.getElementById('reponse2_1_7').value,
        u6:document.getElementById('unite2_1_6').value,
        responses:sessionStorage.getItem('reponses_data'),
        scores:sessionStorage.getItem('scores_data')
      })
    `, true);
    if (restored.q6 !== '10' || restored.q7 !== '75' || restored.u6 !== 'kg') {
      throw new Error('Brouillon Page 2_1 perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Le brouillon Page 2_1 a été validé avant navigation.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebQcmPage2_1.save()', true);
    if (!partial || partial.score !== 2 || partial.total !== 5) throw new Error('Score partiel Page 2_1 incorrect.');

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          q6:r.page2_1_q6,q7:r.page2_1_q7,q8:r.page2_1_q8,
          u6:r.page2_1_unite6,
          scores:[s.page2_1_q6,s.page2_1_q7,s.page2_1_q8,s.page2_1_q9,s.page2_1_q10],
          unitScores:[s.page2_1_unite6,s.page2_1_unite7,s.page2_1_unite8,s.page2_1_unite9,s.page2_1_unite10]
        };
      })()
    `, true);
    if (partialStored.q6 !== '10' || partialStored.q7 !== '75' || partialStored.q8 !== '' || partialStored.u6 !== 'kg') {
      throw new Error('Contrat historique reponses_data Page 2_1 incorrect.');
    }
    if (JSON.stringify(partialStored.scores) !== JSON.stringify([1,1,0,0,0])) {
      throw new Error('Contrat historique scores_data Page 2_1 incorrect.');
    }
    if (partialStored.unitScores.some(function(value){return value !== 0;})) {
      throw new Error('Les unités Page 2_1 ne sont plus non notées.');
    }

    await clearState(win);

    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({
        page2_q1:'1020',page2_q2:'1250',page2_q3:'60',page2_q4:'525',page2_q5:'8',
        page2_unite1:'vis'
      }));
      sessionStorage.setItem('scores_data', JSON.stringify({
        page2_q1:1,page2_q2:1,page2_q3:1,page2_q4:1,page2_q5:1,page2_unite1:0
      }));
      true;
    `, true);
    await win.reload();
    await waitForPage(win);
    await sleep(120);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        Object.entries(window.sebQcmPage2_1.answers).forEach(function(entry){
          const input=document.getElementById('reponse2_1_'+entry[0]);
          input.value=entry[1];
          input.dispatchEvent(new Event('input',{bubbles:true}));
          const unit=document.getElementById('unite2_1_'+entry[0]);
          unit.value='u'+entry[0];
          unit.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmPage2_1.save();
      })()
    `, true);

    if (!perfect || perfect.score !== 5 || perfect.total !== 5) {
      throw new Error('La Page 2_1 parfaite n’obtient pas 5/5.');
    }

    const preservedBeforeRoute = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {p2:r.page2_q1,p2s:s.page2_q1,p21:r.page2_1_q10,p21s:s.page2_1_q10};
      })()
    `, true);
    if (preservedBeforeRoute.p2 !== '1020' || preservedBeforeRoute.p2s !== 1 ||
        preservedBeforeRoute.p21 !== '165' || preservedBeforeRoute.p21s !== 1) {
      throw new Error('Page 2 non préservée pendant la sauvegarde Page 2_1.');
    }

    await win.webContents.executeJavaScript("document.getElementById('page2_1Next').click(); true", true);

    let onPage3 = false;
    for (let i = 0; i < 140; i += 1) {
      try {
        const state = await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('page3')?.classList.contains('visible'))})
        `, true);
        if (state.search.includes('page=3') && state.visible) { onPage3 = true; break; }
      } catch (_) {}
      await sleep(50);
    }
    if (!onPage3) throw new Error('Navigation réelle Page 2_1 -> Page 3 échouée.');

    const afterPage3Save = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse3_1').value='9h15';
        document.getElementById('reponse3_1').dispatchEvent(new Event('input',{bubbles:true}));
        if (!window.sebQcmPage3) throw new Error('Contrôleur Page 3 absent après navigation.');
        window.sebQcmPage3.save();
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p2:r.page2_q1,p2s:s.page2_q1,
          p21:r.page2_1_q10,p21s:s.page2_1_q10,
          p3:r.page3_q1
        };
      })()
    `, true);

    if (afterPage3Save.p2 !== '1020' || afterPage3Save.p2s !== 1 ||
        afterPage3Save.p21 !== '165' || afterPage3Save.p21s !== 1 ||
        afterPage3Save.p3 !== '9h15') {
      throw new Error('Une sauvegarde modulaire Page 3 écrase les données Pages 2/2_1.');
    }

    console.log('QCM_PAGE2_1_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE2_1_DRAFT_RESUME=OK');
    console.log('QCM_PAGE2_1_NUMERIC_FILTER=OK');
    console.log('QCM_PAGE2_1_NUMERIC_NORMALIZATION=OK');
    console.log('QCM_PAGE2_1_PARTIAL=2/5');
    console.log('QCM_PAGE2_1_PERFECT=5/5');
    console.log('QCM_PAGE2_1_UNITS_UNSCORED=OK');
    console.log('QCM_PAGE2_1_ROUTE=qcmv1.0.html?page=3#page3');
    console.log('QCM_PAGE2_1_PRESERVES_PAGE2=OK');
    console.log('QCM_PAGE3_SAVE_PRESERVES_PAGE2_AND_PAGE2_1=OK');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 2_1.'), 55000);
