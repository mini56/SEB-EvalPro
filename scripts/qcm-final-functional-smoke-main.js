const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_FINAL_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFinal(win) {
  for (let i = 0; i < 120; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmFinal && document.getElementById('pageFinale') && document.getElementById('resultat'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    ({
      href:location.href,
      controller:Boolean(window.sebQcmFinal),
      final:Boolean(document.getElementById('pageFinale')),
      result:Boolean(document.getElementById('resultat')),
      scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
    })
  `, true).catch((error) => ({ error:String(error) }));
  throw new Error('Contrôleur pageFinale non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
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
    await waitForFinal(win);

    const candidate = await win.webContents.executeJavaScript(`
      (function(){
        document.querySelectorAll('.page').forEach(function(node){ node.classList.remove('visible'); });
        const finalPage=document.getElementById('pageFinale');
        const result=document.getElementById('resultat');
        finalPage.classList.add('visible');
        result.textContent='RESULTAT TEST';
        window.sebQcmFinal.refresh();
        const heading=finalPage.querySelector('h2');
        const message=document.getElementById('seb-candidate-end-message');
        return {
          heading:heading?.textContent||'',
          resultHidden:result.hidden || getComputedStyle(result).display==='none',
          messageVisible:!!message && !message.hidden && getComputedStyle(message).display!=='none',
          resultsScroll:document.documentElement.classList.contains('seb-results-page-scroll'),
          noPageScroll:document.documentElement.classList.contains('seb-candidate-no-page-scroll'),
          forbidden:Array.from(finalPage.querySelectorAll('button')).map(function(button){return button.textContent.trim();})
        };
      })()
    `, true);

    if (candidate.heading !== 'Fin de l’évaluation') throw new Error('Titre candidat final incorrect.');
    if (!candidate.resultHidden || !candidate.messageVisible) throw new Error('Résultats visibles au candidat sans droits Admin.');
    if (!candidate.resultsScroll || candidate.noPageScroll) throw new Error('Politique de scroll Résultats incorrecte.');
    if (candidate.forbidden.some(function(label){return /Imprimer|PDF|Bilan|Accueil/i.test(label);})) {
      throw new Error('Action interdite encore visible sur pageFinale.');
    }

    const admin = await win.webContents.executeJavaScript(`
      (function(){
        let button=document.getElementById('seb-evalpro-admin');
        if(!button){
          button=document.createElement('button');
          button.id='seb-evalpro-admin';
          document.body.appendChild(button);
        }
        button.textContent='Verrouiller';
        window.sebQcmFinal.refresh();
        const finalPage=document.getElementById('pageFinale');
        const result=document.getElementById('resultat');
        const message=document.getElementById('seb-candidate-end-message');
        return {
          heading:finalPage.querySelector('h2')?.textContent||'',
          resultVisible:!result.hidden && getComputedStyle(result).display!=='none',
          messageHidden:!!message && (message.hidden || getComputedStyle(message).display==='none')
        };
      })()
    `, true);

    if (admin.heading !== 'Résultats du test' || !admin.resultVisible || !admin.messageHidden) {
      throw new Error('Affichage Admin des résultats incorrect.');
    }

    const relocked = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('seb-evalpro-admin').textContent='Administrateur';
        window.sebQcmFinal.refresh();
        const finalPage=document.getElementById('pageFinale');
        const result=document.getElementById('resultat');
        return {
          heading:finalPage.querySelector('h2')?.textContent||'',
          resultHidden:result.hidden || getComputedStyle(result).display==='none'
        };
      })()
    `, true);

    if (relocked.heading !== 'Fin de l’évaluation' || !relocked.resultHidden) {
      throw new Error('Reverrouillage des résultats incorrect.');
    }

    const leaveFinal = await win.webContents.executeJavaScript(`
      (function(){
        document.getElementById('pageFinale').classList.remove('visible');
        const page11=document.getElementById('page11');
        if(page11) page11.classList.add('visible');
        window.sebQcmFinal.refresh();
        return {
          resultsScroll:document.documentElement.classList.contains('seb-results-page-scroll'),
          noPageScroll:document.documentElement.classList.contains('seb-candidate-no-page-scroll')
        };
      })()
    `, true);

    if (leaveFinal.resultsScroll || !leaveFinal.noPageScroll) {
      throw new Error('Scroll de page non reverrouillé hors Résultats.');
    }

    console.log('QCM_FINAL_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_FINAL_CANDIDATE_RESULTS_HIDDEN=OK');
    console.log('QCM_FINAL_ADMIN_RESULTS_VISIBLE=OK');
    console.log('QCM_FINAL_RELOCK=OK');
    console.log('QCM_FINAL_SCROLL_POLICY=OK');
    console.log('QCM_FINAL_FORBIDDEN_ACTIONS=NONE');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test pageFinale.'), 45000);
