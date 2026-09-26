const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE5_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage5 && window.sebParcours && document.querySelectorAll('#page5 input[id^=\"reponse5_\"]').length === 8)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur QCM Page 5 non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'5' }, hash:'page5' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page5').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 5 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','page5_organisation_data',
      'seb_evalpro_qcm_page5_state','seb_evalpro_qcm_drafts'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
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

    const initial = await win.webContents.executeJavaScript(`
      ({
        inputs:document.querySelectorAll('#page5 input[id^="reponse5_"]').length,
        total:window.sebQcmPage5.total,
        answers:window.sebQcmPage5.answers,
        route:window.sebParcours.nextUrl('qcm-5')
      })
    `, true);

    const expectedAnswers={"1":"2","2":"5","3":"3","4":"1","5":"4","6":"7","7":"8","8":"6"};
    if (initial.inputs !== 8 || initial.total !== 8) throw new Error('Structure Page 5 incorrecte.');
    if (JSON.stringify(initial.answers) !== JSON.stringify(expectedAnswers)) throw new Error('Barème Page 5 modifié.');
    if (initial.route !== 'qcmv1.0.html?page=5_1#page5_1') throw new Error('Route Page 5 -> Page 5_1 incorrecte.');

    await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse5_1').value='2';
        document.getElementById('reponse5_1').dispatchEvent(new Event('input',{bubbles:true}));
        document.getElementById('reponse5_4').value='1';
        document.getElementById('reponse5_4').dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page5_state')||'null');
        return {
          state,
          q1:document.getElementById('reponse5_1').value,
          q4:document.getElementById('reponse5_4').value
        };
      })()
    `, true);

    if (!draft.state || draft.q1 !== '2' || draft.q4 !== '1') {
      throw new Error('Brouillon Page 5 non sauvegardé.');
    }

    await win.reload();
    await waitForPage(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      ({
        q1:document.getElementById('reponse5_1').value,
        q4:document.getElementById('reponse5_4').value,
        responses:sessionStorage.getItem('reponses_data'),
        scores:sessionStorage.getItem('scores_data'),
        snapshot:sessionStorage.getItem('page5_organisation_data')
      })
    `, true);

    if (restored.q1 !== '2' || restored.q4 !== '1') throw new Error('Brouillon Page 5 perdu après rechargement.');
    if (restored.responses !== null || restored.scores !== null || restored.snapshot !== null) {
      throw new Error('Brouillon Page 5 validé avant sauvegarde.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebQcmPage5.save()', true);
    if (!partial || partial.score !== 2 || partial.total !== 8) {
      throw new Error('Score partiel Page 5 incorrect.');
    }

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        const snap=JSON.parse(sessionStorage.getItem('page5_organisation_data')||'{}');
        return {
          values:Array.from({length:8},function(_,i){return r['page5_q'+(i+1)]||'';}),
          scores:Array.from({length:8},function(_,i){return s['page5_q'+(i+1)]||0;}),
          snapshotCount:Object.keys(snap).length,
          snap1:snap['1'],
          snap4:snap['4']
        };
      })()
    `, true);

    if (JSON.stringify(partialStored.values) !== JSON.stringify(['2','','','1','','','',''])) {
      throw new Error('Contrat reponses_data Page 5 incorrect.');
    }
    if (JSON.stringify(partialStored.scores) !== JSON.stringify([1,0,0,1,0,0,0,0])) {
      throw new Error('Contrat scores_data Page 5 incorrect.');
    }
    if (partialStored.snapshotCount !== 8 ||
        partialStored.snap1?.reponse !== '2' || partialStored.snap1?.score !== 1 ||
        partialStored.snap4?.reponse !== '1' || partialStored.snap4?.score !== 1) {
      throw new Error('Snapshot page5_organisation_data incorrect.');
    }

    await clearState(win);

    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({
        page2_q1:'1020',page2_1_q6:'10',page3_q1:'9h15',page4:'3/3'
      }));
      sessionStorage.setItem('scores_data', JSON.stringify({
        page2_q1:1,page2_1_q6:1,page3_q1:1,page4:3
      }));
      true;
    `, true);
    await win.reload();
    await waitForPage(win);
    await sleep(120);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        Object.entries(window.sebQcmPage5.answers).forEach(function(entry){
          const field=document.getElementById('reponse5_'+entry[0]);
          field.value=entry[1];
          field.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmPage5.save();
      })()
    `, true);

    if (!perfect || perfect.score !== 8 || perfect.total !== 8) {
      throw new Error('Page 5 parfaite n’obtient pas 8/8.');
    }

    const preserved = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p2:r.page2_q1,p21:r.page2_1_q6,p3:r.page3_q1,p4:r.page4,
          p2s:s.page2_q1,p21s:s.page2_1_q6,p3s:s.page3_q1,p4s:s.page4,
          score:Array.from({length:8},function(_,i){return s['page5_q'+(i+1)]||0;}).reduce(function(a,b){return a+b;},0),
          route:window.sebParcours.nextUrl('qcm-5')
        };
      })()
    `, true);

    if (preserved.p2 !== '1020' || preserved.p21 !== '10' || preserved.p3 !== '9h15' || preserved.p4 !== '3/3' ||
        preserved.p2s !== 1 || preserved.p21s !== 1 || preserved.p3s !== 1 || preserved.p4s !== 3) {
      throw new Error('Page 5 écrase les données précédentes.');
    }
    if (preserved.score !== 8 || preserved.route !== 'qcmv1.0.html?page=5_1#page5_1') {
      throw new Error('Score/route Page 5 incorrect.');
    }

    await win.webContents.executeJavaScript("document.getElementById('page5Next').click(); true", true);

    let onPage51=false;
    for(let i=0;i<140;i+=1){
      try{
        const state=await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('page5_1')?.classList.contains('visible'))})
        `,true);
        if(state.search.includes('page=5_1')&&state.visible){onPage51=true;break;}
      }catch(_){}
      await sleep(50);
    }
    if(!onPage51) throw new Error('Navigation réelle Page 5 -> Page 5_1 échouée.');

    const page51Preserves = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse5_1_1').value='2';
        document.getElementById('reponse5_1_2').value='3';
        document.getElementById('reponse5_1_3').value='5';
        saveTableAnswers('5_1');
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          page5:Array.from({length:8},function(_,i){return r['page5_q'+(i+1)]||'';}),
          page5Score:Array.from({length:8},function(_,i){return s['page5_q'+(i+1)]||0;}).reduce(function(a,b){return a+b;},0),
          p51:[r.page5_1_q1,r.page5_1_q2,r.page5_1_q3],
          p51s:[s.page5_1_q1,s.page5_1_q2,s.page5_1_q3]
        };
      })()
    `, true);

    if (JSON.stringify(page51Preserves.page5) !== JSON.stringify(['2','5','3','1','4','7','8','6']) ||
        page51Preserves.page5Score !== 8) {
      throw new Error('Page 5 perdue pendant la sauvegarde Page 5_1.');
    }
    if (JSON.stringify(page51Preserves.p51) !== JSON.stringify(['2','3','5']) ||
        JSON.stringify(page51Preserves.p51s) !== JSON.stringify([1,1,1])) {
      throw new Error('Page 5_1 historique perturbée par la modularisation Page 5.');
    }

    console.log('QCM_PAGE5_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE5_ORDER=2_5_3_1_4_7_8_6');
    console.log('QCM_PAGE5_DRAFT_RESUME=OK');
    console.log('QCM_PAGE5_PARTIAL=2/8');
    console.log('QCM_PAGE5_PERFECT=8/8');
    console.log('QCM_PAGE5_SNAPSHOT=OK');
    console.log('QCM_PAGE5_PRESERVES_PREVIOUS_DATA=OK');
    console.log('QCM_PAGE5_1_SAVE_PRESERVES_PAGE5=OK');
    console.log('QCM_PAGE5_ROUTE=qcmv1.0.html?page=5_1#page5_1');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 5.'), 60000);
