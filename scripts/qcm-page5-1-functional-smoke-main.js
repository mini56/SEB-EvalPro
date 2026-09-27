const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE5_1_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage5_1 && window.sebParcours && document.querySelectorAll('#page5_1 input[id^=\"reponse5_1_\"]').length === 3)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur QCM Page 5_1 non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'5_1' }, hash:'page5_1' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page5_1').classList.contains('visible')",
      true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 5_1 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','seb_evalpro_qcm_page5_1_state',
      'seb_evalpro_qcm_drafts'
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
        inputs:document.querySelectorAll('#page5_1 input[id^="reponse5_1_"]').length,
        allowed:Array.from(window.sebQcmPage5_1.allowed),
        total:window.sebQcmPage5_1.total,
        route:window.sebParcours.nextUrl('qcm-5_1'),
        image:Array.from(document.querySelectorAll('#page5_1 img'))
          .map(function(img){return img.getAttribute('src') || '';})
          .find(function(src){return src.toLowerCase().includes('qcm_posture');}) || ''
      })
    `, true);

    if (initial.inputs !== 3 || initial.total !== 3) throw new Error('Structure Page 5_1 incorrecte.');
    if (JSON.stringify(initial.allowed) !== JSON.stringify(['2','3','5'])) throw new Error('Valeurs autorisées Page 5_1 modifiées.');
    if (initial.route !== 'qcmv1.0.html?page=6#page6') throw new Error('Route Page 5_1 -> Page 6 incorrecte.');
    if (!initial.image || !initial.image.toLowerCase().includes('qcm_posture')) throw new Error('Image des postures absente.');

    await win.webContents.executeJavaScript(`
      (function(){
        const values=['2','2','5'];
        values.forEach(function(value,index){
          const field=document.getElementById('reponse5_1_'+(index+1));
          field.value=value;
          field.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page5_1_state')||'null');
        return {
          state,
          values:[1,2,3].map(function(i){return document.getElementById('reponse5_1_'+i).value;})
        };
      })()
    `, true);

    if (!draft.state || JSON.stringify(draft.values) !== JSON.stringify(['2','2','5'])) {
      throw new Error('Brouillon Page 5_1 non sauvegardé.');
    }

    await win.reload();
    await waitForPage(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      ({
        values:[1,2,3].map(function(i){return document.getElementById('reponse5_1_'+i).value;}),
        responses:sessionStorage.getItem('reponses_data'),
        scores:sessionStorage.getItem('scores_data')
      })
    `, true);

    if (JSON.stringify(restored.values) !== JSON.stringify(['2','2','5'])) {
      throw new Error('Brouillon Page 5_1 perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Brouillon Page 5_1 validé avant sauvegarde.');
    }

    const duplicate = await win.webContents.executeJavaScript('window.sebQcmPage5_1.save()', true);
    if (!duplicate || duplicate.score !== 2 || duplicate.total !== 3) {
      throw new Error('Doublon 2,2,5 ne donne pas 2/3.');
    }
    if (!duplicate.details[1].correct || !duplicate.details[2].duplicate ||
        duplicate.details[2].correct || !duplicate.details[3].correct) {
      throw new Error('Règle d’unicité stricte Page 5_1 incorrecte.');
    }

    const duplicateStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          values:[r.page5_1_q1,r.page5_1_q2,r.page5_1_q3],
          scores:[s.page5_1_q1,s.page5_1_q2,s.page5_1_q3]
        };
      })()
    `, true);

    if (JSON.stringify(duplicateStored.values) !== JSON.stringify(['2','2','5']) ||
        JSON.stringify(duplicateStored.scores) !== JSON.stringify([1,0,1])) {
      throw new Error('Contrat historique Page 5_1 incorrect sur doublon.');
    }

    await clearState(win);

    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({
        page5_q1:'2',page5_q2:'5',page5_q3:'3',page5_q4:'1',
        page5_q5:'4',page5_q6:'7',page5_q7:'8',page5_q8:'6'
      }));
      sessionStorage.setItem('scores_data', JSON.stringify({
        page5_q1:1,page5_q2:1,page5_q3:1,page5_q4:1,
        page5_q5:1,page5_q6:1,page5_q7:1,page5_q8:1
      }));
      true;
    `, true);
    await win.reload();
    await waitForPage(win);
    await sleep(120);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const values=['5','2','3'];
        values.forEach(function(value,index){
          const field=document.getElementById('reponse5_1_'+(index+1));
          field.value=value;
          field.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmPage5_1.save();
      })()
    `, true);

    if (!perfect || perfect.score !== 3 || perfect.total !== 3) {
      throw new Error('Permutation 5,2,3 n’obtient pas 3/3.');
    }

    const invalid = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse5_1_2').value='4';
        return window.sebQcmPage5_1.evaluate();
      })()
    `, true);
    if (invalid.score !== 2 || invalid.details[2].allowed || invalid.details[2].correct) {
      throw new Error('Valeur interdite 4 acceptée.');
    }

    await win.webContents.executeJavaScript("document.getElementById('reponse5_1_2').value='2'; document.getElementById('page5_1Next').click(); true", true);

    let onPage6=false;
    for(let i=0;i<140;i+=1){
      try{
        const state=await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('page6')?.classList.contains('visible'))})
        `,true);
        if(state.search.includes('page=6')&&state.visible){onPage6=true;break;}
      }catch(_){}
      await sleep(50);
    }
    if(!onPage6) throw new Error('Navigation réelle Page 5_1 -> Page 6 échouée.');

    const page6Preserves = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('reponse6_1').value='2300';
        saveTableAnswers(6);
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p5:r.page5_q1,
          p5s:s.page5_q1,
          p51:[r.page5_1_q1,r.page5_1_q2,r.page5_1_q3],
          p51s:[s.page5_1_q1,s.page5_1_q2,s.page5_1_q3],
          p6:r.page6_q1,
          p6s:s.page6_q1
        };
      })()
    `, true);

    if (page6Preserves.p5 !== '2' || page6Preserves.p5s !== 1 ||
        JSON.stringify(page6Preserves.p51) !== JSON.stringify(['5','2','3']) ||
        JSON.stringify(page6Preserves.p51s) !== JSON.stringify([1,1,1]) ||
        page6Preserves.p6 !== '2300' || page6Preserves.p6s !== 1) {
      throw new Error('Page 6 n’a pas préservé Page 5/Page 5_1.');
    }

    console.log('QCM_PAGE5_1_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE5_1_ALLOWED=2_3_5');
    console.log('QCM_PAGE5_1_DRAFT_RESUME=OK');
    console.log('QCM_PAGE5_1_DUPLICATE_2_2_5=2/3');
    console.log('QCM_PAGE5_1_INVALID_4=REJECTED');
    console.log('QCM_PAGE5_1_PERMUTATION_5_2_3=3/3');
    console.log('QCM_PAGE6_SAVE_PRESERVES_PAGE5_AND_PAGE5_1=OK');
    console.log('QCM_PAGE5_1_ROUTE=qcmv1.0.html?page=6#page6');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 5_1.'), 60000);
