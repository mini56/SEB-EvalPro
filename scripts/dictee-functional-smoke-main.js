const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'dictee.html');

function fail(message, detail) {
  console.error('DICTEE_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDictee(win) {
  for (let i = 0; i < 120; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebDictee && window.sebParcours && document.getElementById('candidateText') && document.getElementById('seb-dictee-action'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    ({
      href:location.href,
      controller:Boolean(window.sebDictee),
      parcours:Boolean(window.sebParcours),
      text:Boolean(document.getElementById('candidateText')),
      action:Boolean(document.getElementById('seb-dictee-action')),
      scripts:Array.from(document.scripts).map(s=>s.src||s.id||'[inline]')
    })
  `, true).catch(error => ({error:String(error)}));
  throw new Error('Contrôleur Dictée non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    (function(){
      sessionStorage.removeItem('dictee_data');
      sessionStorage.removeItem('seb_exercise_activity:dictee.html');
      if (window.sebDictee) {
        window.sebDictee.loadState();
        const text=document.getElementById('candidateText');
        if (text) text.value='';
        window.sebDictee.saveState();
      }
      return true;
    })()
  `, true);
  await win.reload();
  await waitForDictee(win);
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
    await waitForDictee(win);
    await clearState(win);

    const initial = await win.webContents.executeJavaScript(`
      (function(){
        const audio=document.getElementById('dicteeAudio');
        const action=document.getElementById('seb-dictee-action');
        return {
          total:window.sebDictee.totalWords,
          referenceWords:window.sebDictee.tokens(window.sebDictee.reference).length,
          route:window.sebParcours.nextFile('dictee'),
          status:window.sebDictee.getState().status,
          action:action?.textContent || '',
          mode:action?.dataset.mode || '',
          audio:audio?.getAttribute('src') || '',
          rate:audio?.playbackRate,
          oldNotice:/Le débit est fixé à la vitesse normale/.test(document.body.innerText),
          inlineScripts:Array.from(document.scripts).filter(s=>!s.src).length,
          feedbackDisplay:getComputedStyle(document.getElementById('feedback')).display
        };
      })()
    `, true);

    if (initial.total !== 80 || initial.referenceWords !== 80) throw new Error('Référence Dictée différente de 80 mots.');
    if (initial.route !== 'tri_de_cheville.html') throw new Error('Route Dictée -> Tri incorrecte.');
    if (initial.status !== 'draft' || initial.action !== 'Dictée terminée' || initial.mode !== 'finish') {
      throw new Error('État initial Dictée incorrect.');
    }
    if (initial.audio !== 'dictee-reclamation-client.wav' || initial.rate !== 1) throw new Error('WAV Julie / vitesse 1,00 incorrect.');
    if (initial.oldNotice) throw new Error('Ancien encadré de vitesse encore visible.');
    if (initial.inlineScripts !== 0) throw new Error('Scripts inline encore présents dans la Dictée finale.');
    if (initial.feedbackDisplay !== 'none') throw new Error('Correction candidat non masquée.');

    const empty = await win.webContents.executeJavaScript('window.sebDictee.verify()', true);
    if (empty !== null) throw new Error('Une dictée vide a été validée.');
    const emptyStatus = await win.webContents.executeJavaScript('window.sebDictee.getState().status', true);
    if (emptyStatus !== 'draft') throw new Error('La vérification vide a modifié le statut.');

    await win.webContents.executeJavaScript(`
      (function(){
        const text=document.getElementById('candidateText');
        text.value='Brouillon de dictée conservé';
        text.dispatchEvent(new Event('input',{bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(80);

    const draftStored = await win.webContents.executeJavaScript(`
      JSON.parse(sessionStorage.getItem('dictee_data')||'null')
    `, true);
    if (!draftStored || draftStored.status !== 'draft' || draftStored.texte !== 'Brouillon de dictée conservé') {
      throw new Error('Brouillon Dictée non sauvegardé.');
    }

    await win.reload();
    await waitForDictee(win);

    const draftRestored = await win.webContents.executeJavaScript(`
      ({
        text:document.getElementById('candidateText').value,
        status:window.sebDictee.getState().status,
        action:document.getElementById('seb-dictee-action').textContent
      })
    `, true);
    if (draftRestored.text !== 'Brouillon de dictée conservé' || draftRestored.status !== 'draft' || draftRestored.action !== 'Dictée terminée') {
      throw new Error('Brouillon Dictée perdu après rechargement.');
    }

    const realCase = await win.webContents.executeJavaScript(`
      window.sebDictee.evaluateText("Ce matin un client à téléphoné au service clients de l'entreprise. Il n'était pas content de ça derniere livraison de fournitures. En effet plusieur carton on étés endommagés a l'arrivé. De plus certain articles manquaient dans le colis.Le client a demandé un nouvel envoie rapide ou un rembourcement complet.la secraitaire a noté sa réclamation avec précision. Elle lui a promis une réponce avant la fin de la semaine.Le responsable du magasin doit vérifier le stock disponible dès demain.")
    `, true);
    if (realCase.motsCorrects !== 65 || realCase.scoreSur20 !== 16.25) {
      throw new Error('Barème cas réel Dictée régressé: ' + JSON.stringify({motsCorrects:realCase.motsCorrects,score:realCase.scoreSur20}));
    }

    const complex = await win.webContents.executeJavaScript(`
      window.sebDictee.classifyAlignmentV3([
        {type:'substitute',expected:'demandé',actual:'demmandé'},
        {type:'match',expected:'un',actual:'un'},
        {type:'substitute',expected:'remboursement',actual:'nouvel'},
        {type:'insert',expected:'',actual:'envoi'},
        {type:'match',expected:'rapide',actual:'rapide'},
        {type:'match',expected:'ou',actual:'ou'},
        {type:'match',expected:'un',actual:'un'},
        {type:'delete',expected:'nouvel',actual:''},
        {type:'delete',expected:'envoi',actual:''},
        {type:'substitute',expected:'complet.',actual:'remboursement.'}
      ])
    `, true);
    if (complex.substitutions !== 1 || complex.omissions !== 1 || complex.additions !== 0 || complex.moved !== 3) {
      throw new Error('Classification v3 complexe incorrecte: ' + JSON.stringify(complex));
    }

    await clearState(win);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const text=document.getElementById('candidateText');
        text.value=window.sebDictee.reference;
        text.dispatchEvent(new Event('input',{bubbles:true}));
        return window.sebDictee.verify();
      })()
    `, true);

    if (!perfect || perfect.status !== 'verified' || perfect.scoreSur20 !== 20 || perfect.motsCorrects !== 80 ||
        perfect.substitutions !== 0 || perfect.omissions !== 0 || perfect.ajouts !== 0 || perfect.deplacements !== 0) {
      throw new Error('Dictée parfaite incorrecte: ' + JSON.stringify(perfect));
    }

    const verifiedUi = await win.webContents.executeJavaScript(`
      (function(){
        const d=JSON.parse(sessionStorage.getItem('dictee_data')||'null');
        return {
          stored:d,
          textDisabled:document.getElementById('candidateText').disabled,
          playDisabled:document.getElementById('playBtn').disabled,
          progressDisabled:document.getElementById('progress').disabled,
          action:document.getElementById('seb-dictee-action').textContent,
          mode:document.getElementById('seb-dictee-action').dataset.mode,
          feedbackDisplay:getComputedStyle(document.getElementById('feedback')).display
        };
      })()
    `, true);

    if (!verifiedUi.stored || verifiedUi.stored.status !== 'verified' || verifiedUi.stored.scoreSur20 !== 20 ||
        verifiedUi.stored.classificationVersion !== 3 || !verifiedUi.textDisabled || !verifiedUi.playDisabled ||
        !verifiedUi.progressDisabled || verifiedUi.action !== 'Suivant' || verifiedUi.mode !== 'next' ||
        verifiedUi.feedbackDisplay !== 'none') {
      throw new Error('Verrouillage/persistance Dictée vérifiée incorrect.');
    }

    await win.reload();
    await waitForDictee(win);

    const verifiedReload = await win.webContents.executeJavaScript(`
      ({
        status:window.sebDictee.getState().status,
        score:window.sebDictee.getState().scoreSur20,
        textDisabled:document.getElementById('candidateText').disabled,
        action:document.getElementById('seb-dictee-action').textContent,
        route:window.sebParcours.nextFile('dictee')
      })
    `, true);
    if (verifiedReload.status !== 'verified' || verifiedReload.score !== 20 || !verifiedReload.textDisabled ||
        verifiedReload.action !== 'Suivant' || verifiedReload.route !== 'tri_de_cheville.html') {
      throw new Error('État Dictée vérifiée perdu après rechargement.');
    }

    await clearState(win);
    await win.webContents.executeJavaScript(`
      (function(){
        const text=document.getElementById('candidateText');
        text.value='Texte avant abandon externe';
        text.dispatchEvent(new Event('input',{bubbles:true}));
        const current=JSON.parse(sessionStorage.getItem('dictee_data')||'{}');
        current.status='abandoned';
        current.scoreSur20=0;
        current.abandonne=true;
        sessionStorage.setItem('dictee_data',JSON.stringify(current));
        window.sebDictee.saveState();
        return true;
      })()
    `, true);

    const abandoned = await win.webContents.executeJavaScript(`
      JSON.parse(sessionStorage.getItem('dictee_data')||'null')
    `, true);
    if (!abandoned || abandoned.status !== 'abandoned' || abandoned.scoreSur20 !== 0 || abandoned.abandonne !== true) {
      throw new Error('État abandon unifié écrasé par la sauvegarde Dictée.');
    }

    console.log('DICTEE_FUNCTIONAL_SMOKE: OK');
    console.log('DICTEE_DRAFT_RESUME=OK');
    console.log('DICTEE_REAL_CASE=65/80_SCORE_16.25');
    console.log('DICTEE_COMPLEX_MOVE_V3=1_SUB_1_OMISSION_0_ADD_3_MOVED');
    console.log('DICTEE_PERFECT=80/80_SCORE_20');
    console.log('DICTEE_EXTERNAL_ABANDON_PRESERVED=OK');
    console.log('DICTEE_ROUTE=tri_de_cheville.html');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch(error => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Dictée.'), 45000);
