const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE6_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage6 && window.sebParcours && document.querySelectorAll('#page6 input[id^=\"reponse6_\"]').length === 20 && document.querySelectorAll('#page6 input[id^=\"unite6_\"]').length === 10)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur QCM Page 6 non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'6' }, hash:'page6' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page6').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 6 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(
    "['reponses_data','scores_data','seb_evalpro_qcm_page6_state','seb_evalpro_qcm_drafts'].forEach(function(key){sessionStorage.removeItem(key);}); true;",
    true
  );
  await win.reload();
  await waitForPage(win);
  await sleep(140);
}

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,width:1600,height:900,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}
  });

  try {
    await loadPage(win);
    await clearState(win);

    const initial = await win.webContents.executeJavaScript(
      "({answers:document.querySelectorAll('#page6 input[id^=\"reponse6_\"]').length,units:document.querySelectorAll('#page6 input[id^=\"unite6_\"]').length,total:window.sebQcmPage6.total,route:window.sebParcours.nextUrl('qcm-6'),answer3:window.sebQcmPage6.answers[3],answer8:window.sebQcmPage6.answers[8],commaDot:window.sebQcmPage6.sameNumeric('5,6','5.6')})",
      true
    );

    if (initial.answers !== 20 || initial.units !== 10 || initial.total !== 10) {
      throw new Error('Structure Page 6 incorrecte.');
    }
    if (initial.route !== 'autoeval1.html') throw new Error('Route Page 6 -> autoeval1 incorrecte.');
    if (initial.answer3 !== '2.5' || initial.answer8 !== '5.6' || !initial.commaDot) {
      throw new Error('Normalisation décimale Page 6 incorrecte.');
    }

    await win.webContents.executeJavaScript(
      "(function(){var a=document.getElementById('reponse6_1');a.value='2300';a.dispatchEvent(new Event('input',{bubbles:true}));var u=document.getElementById('unite6_1');u.value='g';u.dispatchEvent(new Event('input',{bubbles:true}));var o=document.getElementById('reponse6_11');o.value='2,3 x 1000';o.dispatchEvent(new Event('input',{bubbles:true}));return true;})()",
      true
    );
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(
      "(function(){var s=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page6_state')||'null');return {state:s,a:document.getElementById('reponse6_1').value,u:document.getElementById('unite6_1').value,o:document.getElementById('reponse6_11').value};})()",
      true
    );
    if (!draft.state || draft.a !== '2300' || draft.u !== 'g' || draft.o !== '2,3 x 1000') {
      throw new Error('Brouillon Page 6 non sauvegardé.');
    }

    await win.reload();
    await waitForPage(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(
      "({a:document.getElementById('reponse6_1').value,u:document.getElementById('unite6_1').value,o:document.getElementById('reponse6_11').value,responses:sessionStorage.getItem('reponses_data'),scores:sessionStorage.getItem('scores_data')})",
      true
    );
    if (restored.a !== '2300' || restored.u !== 'g' || restored.o !== '2,3 x 1000') {
      throw new Error('Brouillon Page 6 perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Brouillon Page 6 validé avant sauvegarde.');
    }

    await win.webContents.executeJavaScript(
      "(function(){sessionStorage.setItem('reponses_data',JSON.stringify({page5_q1:'2',page5_1_q1:'5',page5_1_q2:'2',page5_1_q3:'3'}));sessionStorage.setItem('scores_data',JSON.stringify({page5_q1:1,page5_1_q1:1,page5_1_q2:1,page5_1_q3:1}));var answers=['2300','7500','2,5','8400','3200','450','750','5.6','1250','4'];for(var i=1;i<=10;i++){var a=document.getElementById('reponse6_'+i);a.value=answers[i-1];a.dispatchEvent(new Event('input',{bubbles:true}));var u=document.getElementById('unite6_'+i);u.value=['g','ml','m','g','l','cm','ml','kg','ml','morceaux'][i-1];u.dispatchEvent(new Event('input',{bubbles:true}));var o=document.getElementById('reponse6_'+(i+10));o.value='opération '+i;o.dispatchEvent(new Event('input',{bubbles:true}));}return true;})()",
      true
    );
    await sleep(160);

    const perfect = await win.webContents.executeJavaScript("window.sebQcmPage6.save()", true);
    if (!perfect || perfect.score !== 10 || perfect.total !== 10) {
      throw new Error('Les 10 réponses correctes ne donnent pas 10/10.');
    }

    const stored = await win.webContents.executeJavaScript(
      "(function(){var r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');var s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');return {p5:r.page5_q1,p5s:s.page5_q1,p51:[r.page5_1_q1,r.page5_1_q2,r.page5_1_q3],p51s:[s.page5_1_q1,s.page5_1_q2,s.page5_1_q3],q3:r.page6_q3,q8:r.page6_q8,u1:r.page6_unite1,uScores:Array.from({length:10},function(_,j){return s['page6_unite'+(j+1)];}),ops:Array.from({length:10},function(_,j){return r['page6_q'+(j+11)];}),opScores:Array.from({length:10},function(_,j){return s['page6_q'+(j+11)];}),noted:Array.from({length:10},function(_,j){return s['page6_q'+(j+1)];})};})()",
      true
    );

    if (stored.p5 !== '2' || stored.p5s !== 1 ||
        JSON.stringify(stored.p51) !== JSON.stringify(['5','2','3']) ||
        JSON.stringify(stored.p51s) !== JSON.stringify([1,1,1])) {
      throw new Error('Page 6 a détruit des données Page 5/Page 5_1.');
    }
    if (stored.q3 !== '2,5' || stored.q8 !== '5.6' || stored.u1 !== 'g') {
      throw new Error('Réponses/unités Page 6 mal enregistrées.');
    }
    if (stored.uScores.some(function(v){return v !== 0;}) ||
        stored.opScores.some(function(v){return v !== 0;}) ||
        stored.noted.some(function(v){return v !== 1;})) {
      throw new Error('Barème Page 6 incorrect: unités/opérations doivent rester non notées.');
    }
    if (stored.ops[0] !== 'opération 1' || stored.ops[9] !== 'opération 10') {
      throw new Error('Opérations Q11-Q20 non enregistrées.');
    }

    const sanitize = await win.webContents.executeJavaScript(
      "(function(){var f=document.getElementById('reponse6_1');f.value='23a00';f.dispatchEvent(new Event('input',{bubbles:true}));return f.value;})()",
      true
    );
    if (sanitize !== '2300') throw new Error('Filtrage numérique Page 6 incorrect.');

    const incorrect = await win.webContents.executeJavaScript(
      "(function(){document.getElementById('reponse6_10').value='5';return window.sebQcmPage6.evaluate();})()",
      true
    );
    if (!incorrect || incorrect.score !== 9 || incorrect.details[10].correct) {
      throw new Error('Réponse incorrecte Page 6 mal notée.');
    }

    const legacy = await win.webContents.executeJavaScript(
      "document.getElementById('reponse6_10').value='4'; saveTableAnswers(6)",
      true
    );
    if (!legacy || legacy.score !== 10) throw new Error('Pont historique saveTableAnswers(6) cassé.');

    await win.webContents.executeJavaScript("document.getElementById('page6Next').click(); true", true);

    let onAutoEval = false;
    for (let i = 0; i < 140; i += 1) {
      try {
        const state = await win.webContents.executeJavaScript(
          "({path:location.pathname,has:Boolean(document.querySelector('input[type=\"checkbox\"],textarea'))})",
          true
        );
        if (/autoeval1\.html$/i.test(state.path)) {
          onAutoEval = true;
          break;
        }
      } catch (_) {}
      await sleep(50);
    }
    if (!onAutoEval) throw new Error('Navigation réelle Page 6 -> autoeval1 échouée.');

    console.log('QCM_PAGE6_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE6_NOTED=10');
    console.log('QCM_PAGE6_DECIMAL_COMMA_DOT=OK');
    console.log('QCM_PAGE6_DRAFT_RESUME=OK');
    console.log('QCM_PAGE6_UNITS_NON_NOTED=OK');
    console.log('QCM_PAGE6_OPERATIONS_Q11_Q20_NON_NOTED=OK');
    console.log('QCM_PAGE6_PRESERVES_PAGE5_AND_PAGE5_1=OK');
    console.log('QCM_PAGE6_LEGACY_SAVE_BRIDGE=OK');
    console.log('QCM_PAGE6_ROUTE=autoeval1.html');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 6.'), 60000);
