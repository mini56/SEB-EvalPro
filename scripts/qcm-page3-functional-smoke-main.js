const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE3_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage3(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage3 && window.sebParcours && document.getElementById('page3') && document.querySelectorAll('#page3 input[id^=\"reponse3_\"]').length === 14)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur QCM Page 3 non initialisé.');
}

async function loadPage3(win) {
  await win.loadFile(page, { query:{ page:'3' }, hash:'page3' });
  await waitForPage3(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page3').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 3 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','page3_resultats','seb_evalpro_qcm_page3_state',
      'seb_evalpro_qcm_drafts','seb_exercise_activity:qcmv1.0.html:page3'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForPage3(win);
  await sleep(140);
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
    await loadPage3(win);
    await clearState(win);

    const parser = await win.webContents.executeJavaScript(`
      (function(){
        const p=window.sebQcmPage3.parseTimeToMinutes;
        return {
          h00:p('3h00'),
          upper:p('3H00'),
          hOnly:p('3h'),
          wordOnly:p('3 heures'),
          words:p('3 heures 0 min'),
          glued:p('3 heures 00minutes'),
          colon:p('3:00'),
          minutes:p('180 min'),
          oldSpace:p('3 00'),
          oneHThree:p('1h3'),
          longOneHThree:p('1 heure 03 minutes'),
          invalid75:p('3h75'),
          invalidColon75:p('3:75'),
          invalidWords75:p('3 heures 75 minutes'),
          ambiguousDecimal:p('1,5h'),
          bareNumber:p('180')
        };
      })()
    `, true);

    for (const key of ['h00','upper','hOnly','wordOnly','words','glued','colon','minutes','oldSpace']) {
      if (parser[key] !== 180) throw new Error('Format 3h00 non reconnu: ' + key + '=' + parser[key]);
    }
    if (parser.oneHThree !== 63 || parser.longOneHThree !== 63) {
      throw new Error('Format 1h03 non reconnu.');
    }
    if (parser.invalid75 !== null || parser.invalidColon75 !== null || parser.invalidWords75 !== null) {
      throw new Error('Minutes impossibles 75 acceptées.');
    }
    if (parser.ambiguousDecimal !== null || parser.bareNumber !== null) {
      throw new Error('Format horaire ambigu accepté.');
    }

    await win.webContents.executeJavaScript(`
      (function(){
        const values={1:'9 heures 15 minutes',6:'315 min',13:'31 min'};
        Object.entries(values).forEach(function(entry){
          const input=document.getElementById('reponse3_'+entry[0]);
          input.value=entry[1];
          input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page3_state')||'null');
        return {
          state,
          q1:document.getElementById('reponse3_1').value,
          q6:document.getElementById('reponse3_6').value,
          q13:document.getElementById('reponse3_13').value
        };
      })()
    `, true);
    if (!draft.state || draft.q1 !== '9 heures 15 minutes' || draft.q6 !== '315 min' || draft.q13 !== '31 min') {
      throw new Error('Brouillon Page 3 non sauvegardé.');
    }

    await win.reload();
    await waitForPage3(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      ({
        q1:document.getElementById('reponse3_1').value,
        q6:document.getElementById('reponse3_6').value,
        q13:document.getElementById('reponse3_13').value,
        responses:sessionStorage.getItem('reponses_data'),
        scores:sessionStorage.getItem('scores_data')
      })
    `, true);
    if (restored.q1 !== '9 heures 15 minutes' || restored.q6 !== '315 min' || restored.q13 !== '31 min') {
      throw new Error('Brouillon Page 3 perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Le brouillon Page 3 a été validé avant sauvegarde.');
    }

    await win.webContents.executeJavaScript(`
      document.getElementById('reponse3_3').value='3h75';
      document.getElementById('reponse3_3').dispatchEvent(new Event('input',{bubbles:true}));
      true;
    `, true);

    const partial = await win.webContents.executeJavaScript('window.sebQcmPage3.save()', true);
    if (!partial || partial.score !== 3 || partial.total !== 14) {
      throw new Error('Score partiel Page 3 incorrect: ' + JSON.stringify(partial));
    }
    if (partial.details[3].correct || partial.details[3].minutes !== null) {
      throw new Error('Réponse impossible 3h75 acceptée.');
    }

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        const d=JSON.parse(sessionStorage.getItem('page3_resultats')||'null');
        return {
          q1:r.page3_q1,q6:r.page3_q6,q13:r.page3_q13,
          q3:r.page3_q3,
          s1:s.page3_q1,s6:s.page3_q6,s13:s.page3_q13,s3:s.page3_q3,
          dedicatedCount:d&&d.reponses?Object.keys(d.reponses).length:0,
          dedicatedScore:d&&d.scores?Object.values(d.scores).reduce(function(a,b){return a+Number(b||0);},0):-1
        };
      })()
    `, true);
    if (partialStored.q1 !== '9 heures 15 minutes' || partialStored.q6 !== '315 min' ||
        partialStored.q13 !== '31 min' || partialStored.q3 !== '3h75') {
      throw new Error('Les réponses brutes Page 3 ne sont pas conservées.');
    }
    if (partialStored.s1 !== 1 || partialStored.s6 !== 1 || partialStored.s13 !== 1 || partialStored.s3 !== 0) {
      throw new Error('Scores Page 3 partiels incorrects.');
    }
    if (partialStored.dedicatedCount !== 14 || partialStored.dedicatedScore !== 3) {
      throw new Error('Sauvegarde dédiée Page 3 incorrecte.');
    }

    await clearState(win);

    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({
        page2_q1:'1020',
        page2_1_q6:'10'
      }));
      sessionStorage.setItem('scores_data', JSON.stringify({
        page2_q1:1,
        page2_1_q6:1
      }));
      true;
    `, true);
    await win.reload();
    await waitForPage3(win);
    await sleep(120);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const values={
          1:'9 heures 15 minutes',
          2:'8 H 50',
          3:'9:05',
          4:'9h20',
          5:'8 heures 45 min',
          6:'315 min',
          7:'9 h 45',
          8:'09h15',
          9:'9 heures et 30 minutes',
          10:'9h55',
          11:'9 25',
          12:'155 minutes',
          13:'31 min',
          14:'1 heure 3 minutes'
        };
        Object.entries(values).forEach(function(entry){
          const input=document.getElementById('reponse3_'+entry[0]);
          input.value=entry[1];
          input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmPage3.save('next');
      })()
    `, true);

    if (!perfect || perfect.score !== 14 || perfect.total !== 14) {
      throw new Error('Les formats alternatifs Page 3 n’obtiennent pas 14/14.');
    }

    const perfectStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        const d=JSON.parse(sessionStorage.getItem('page3_resultats')||'null');
        return {
          page2:r.page2_q1,
          page21:r.page2_1_q6,
          q12:r.page3_q12,
          q14:r.page3_q14,
          scoreCount:Array.from({length:14},function(_,i){return s['page3_q'+(i+1)]||0;}).reduce(function(a,b){return a+b;},0),
          legacyResponse:r['3'],
          legacyScore:s['3'],
          dedicatedScore:d&&d.scores?Object.values(d.scores).reduce(function(a,b){return a+Number(b||0);},0):-1,
          nextUrl:window.sebParcours.nextUrl('qcm-3')
        };
      })()
    `, true);

    if (perfectStored.page2 !== '1020' || perfectStored.page21 !== '10') {
      throw new Error('Page 3 écrase les données Pages 2/2_1.');
    }
    if (perfectStored.scoreCount !== 14 || perfectStored.dedicatedScore !== 14) {
      throw new Error('Score parfait Page 3 non persisté.');
    }
    if (perfectStored.legacyResponse !== 'Bonne réponse' || perfectStored.legacyScore !== 1) {
      throw new Error('Marqueur historique bouton Suivant Page 3 perdu.');
    }
    if (perfectStored.nextUrl !== 'qcmv1.0.html?page=pageTexteTrous#pageTexteTrous') {
      throw new Error('Route Page 3 -> Texte à trous incorrecte.');
    }

    await win.webContents.executeJavaScript("document.getElementById('page3Next').click(); true", true);

    let navigated = false;
    for (let i = 0; i < 140; i += 1) {
      try {
        const state = await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('pageTexteTrous')?.classList.contains('visible'))})
        `, true);
        if (state.search.includes('page=pageTexteTrous') && state.visible) {
          navigated = true;
          break;
        }
      } catch (_) {}
      await sleep(50);
    }
    if (!navigated) throw new Error('Navigation réelle Page 3 -> Texte à trous échouée.');

    console.log('QCM_PAGE3_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE3_DRAFT_RESUME=OK');
    console.log('QCM_PAGE3_TIME_FORMATS=H_HOURS_MINUTES_COLON_MINUTES_ONLY_OK');
    console.log('QCM_PAGE3_INVALID_3H75=REJECTED');
    console.log('QCM_PAGE3_PARTIAL=3/14');
    console.log('QCM_PAGE3_PERFECT_ALTERNATE_FORMATS=14/14');
    console.log('QCM_PAGE3_DEDICATED_RESULTS=OK');
    console.log('QCM_PAGE3_PRESERVES_PAGE2_AND_PAGE2_1=OK');
    console.log('QCM_PAGE3_ROUTE=qcmv1.0.html?page=pageTexteTrous#pageTexteTrous');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 3.'), 60000);
