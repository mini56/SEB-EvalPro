const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_TEXTE_TROUS_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmTexteTrous && window.sebParcours && document.querySelectorAll('#pageTexteTrous input[data-answer]').length === 15)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur Texte à trous non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'pageTexteTrous' }, hash:'pageTexteTrous' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('pageTexteTrous').classList.contains('visible')", true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Texte à trous non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','seb_evalpro_qcm_texte_trous_state',
      'seb_evalpro_qcm_drafts','seb_exercise_activity:qcmv1.0.html#pageTexteTrous'
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
        inputs:document.querySelectorAll('#pageTexteTrous input[data-answer]').length,
        total:window.sebQcmTexteTrous.total,
        route:window.sebParcours.nextUrl('qcm-texte-trous'),
        upper:window.sebQcmTexteTrous.normalizeAnswer('  PROFESSIONNELLE  '),
        spaces:window.sebQcmTexteTrous.normalizeAnswer('préparateur   de   commandes'),
        accentStrict:window.sebQcmTexteTrous.normalizeAnswer('taches') === window.sebQcmTexteTrous.normalizeAnswer('tâches')
      })
    `, true);

    if (initial.inputs !== 15 || initial.total !== 15) throw new Error('Structure Texte à trous incorrecte.');
    if (initial.route !== 'qcmv1.0.html?page=4#page4') throw new Error('Route Texte à trous -> Page 4 incorrecte.');
    if (initial.upper !== 'professionnelle' || initial.spaces !== 'préparateur de commandes') {
      throw new Error('Normalisation casse/espaces incorrecte.');
    }
    if (initial.accentStrict) throw new Error('Accent manquant accepté alors qu’il doit rester significatif.');

    await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('#pageTexteTrous input[data-answer]'));
        list[0].value='  PROFESSIONNELLE  ';
        list[0].dispatchEvent(new Event('input',{bubbles:true}));
        list[1].value='préparateur   de commandes';
        list[1].dispatchEvent(new Event('input',{bubbles:true}));
        list[5].value='taches';
        list[5].dispatchEvent(new Event('input',{bubbles:true}));
        list[7].value='PENSE';
        list[7].dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(140);

    const draft = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_texte_trous_state')||'null');
        return {
          state,
          v0:document.querySelectorAll('#pageTexteTrous input[data-answer]')[0].value,
          v1:document.querySelectorAll('#pageTexteTrous input[data-answer]')[1].value
        };
      })()
    `, true);
    if (!draft.state || draft.v0 !== '  PROFESSIONNELLE  ' || draft.v1 !== 'préparateur   de commandes') {
      throw new Error('Brouillon Texte à trous non sauvegardé.');
    }

    await win.reload();
    await waitForPage(win);
    await sleep(140);

    const restored = await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('#pageTexteTrous input[data-answer]'));
        return {
          v0:list[0].value,v1:list[1].value,v5:list[5].value,v7:list[7].value,
          responses:sessionStorage.getItem('reponses_data'),
          scores:sessionStorage.getItem('scores_data')
        };
      })()
    `, true);
    if (restored.v0 !== '  PROFESSIONNELLE  ' || restored.v1 !== 'préparateur   de commandes' ||
        restored.v5 !== 'taches' || restored.v7 !== 'PENSE') {
      throw new Error('Brouillon Texte à trous perdu après rechargement.');
    }
    if (restored.responses !== null || restored.scores !== null) {
      throw new Error('Brouillon Texte à trous validé avant sauvegarde.');
    }

    const partial = await win.webContents.executeJavaScript('window.sebQcmTexteTrous.save()', true);
    if (!partial || partial.score !== 3 || partial.total !== 15) {
      throw new Error('Score partiel Texte à trous incorrect: ' + JSON.stringify(partial));
    }

    const storedPartial = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          count:Array.isArray(r.pageTexteTrous)?r.pageTexteTrous.length:0,
          score:s.pageTexteTrous,
          u0:r.pageTexteTrous?.[0]?.user,
          u1:r.pageTexteTrous?.[1]?.user,
          u5:r.pageTexteTrous?.[5]?.user,
          c5:r.pageTexteTrous?.[5]?.correct
        };
      })()
    `, true);

    if (storedPartial.count !== 15 || storedPartial.score !== 3) throw new Error('Contrat historique Texte à trous incorrect.');
    if (storedPartial.u0 !== 'professionnelle' || storedPartial.u1 !== 'préparateur de commandes') {
      throw new Error('Réponses normalisées non stockées comme historiquement.');
    }
    if (storedPartial.u5 !== 'taches' || storedPartial.c5 !== 'tâches') {
      throw new Error('Accent strict Texte à trous non conservé dans les résultats.');
    }

    await clearState(win);

    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({page2_q1:'1020',page2_1_q6:'10',page3_q1:'9h15'}));
      sessionStorage.setItem('scores_data', JSON.stringify({page2_q1:1,page2_1_q6:1,page3_q1:1}));
      true;
    `, true);
    await win.reload();
    await waitForPage(win);
    await sleep(120);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const list=Array.from(document.querySelectorAll('#pageTexteTrous input[data-answer]'));
        list.forEach(function(input,index){
          let value=input.dataset.answer;
          if(index===0) value=' PROFESSIONNELLE ';
          if(index===1) value='préparateur   de commandes';
          if(index===2) value='AI   PU';
          input.value=value;
          input.dispatchEvent(new Event('input',{bubbles:true}));
        });
        return window.sebQcmTexteTrous.save();
      })()
    `, true);

    if (!perfect || perfect.score !== 15 || perfect.total !== 15) {
      throw new Error('Texte à trous parfait avec casse/espaces alternatifs n’obtient pas 15/15.');
    }

    const preserved = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p2:r.page2_q1,p21:r.page2_1_q6,p3:r.page3_q1,
          p2s:s.page2_q1,p21s:s.page2_1_q6,p3s:s.page3_q1,
          score:s.pageTexteTrous,
          route:window.sebParcours.nextUrl('qcm-texte-trous')
        };
      })()
    `, true);

    if (preserved.p2 !== '1020' || preserved.p21 !== '10' || preserved.p3 !== '9h15' ||
        preserved.p2s !== 1 || preserved.p21s !== 1 || preserved.p3s !== 1) {
      throw new Error('Texte à trous écrase les données Pages 2/2_1/3.');
    }
    if (preserved.score !== 15 || preserved.route !== 'qcmv1.0.html?page=4#page4') {
      throw new Error('Score/route Texte à trous incorrect.');
    }

    await win.webContents.executeJavaScript("document.getElementById('texteTrousNext').click(); true", true);
    let navigated=false;
    for(let i=0;i<140;i+=1){
      try{
        const state=await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('page4')?.classList.contains('visible'))})
        `,true);
        if(state.search.includes('page=4')&&state.visible){navigated=true;break;}
      }catch(_){}
      await sleep(50);
    }
    if(!navigated) throw new Error('Navigation réelle Texte à trous -> Page 4 échouée.');

    console.log('QCM_TEXTE_TROUS_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_TEXTE_TROUS_DRAFT_RESUME=OK');
    console.log('QCM_TEXTE_TROUS_CASE_AND_SPACES=ACCEPTED');
    console.log('QCM_TEXTE_TROUS_ACCENT_MISSING=REJECTED');
    console.log('QCM_TEXTE_TROUS_PARTIAL=3/15');
    console.log('QCM_TEXTE_TROUS_PERFECT=15/15');
    console.log('QCM_TEXTE_TROUS_PRESERVES_PAGES_2_2_1_3=OK');
    console.log('QCM_TEXTE_TROUS_ROUTE=qcmv1.0.html?page=4#page4');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Texte à trous.'), 60000);
