const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'stock.html');

function fail(message, detail) {
  console.error('STOCK_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStock(win) {
  for (let i = 0; i < 120; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebStock && window.sebParcours && document.querySelectorAll('.pot').length === 34 && document.getElementById('stockActionBtn'))",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  const diagnostic = await win.webContents.executeJavaScript(`
    (function(){
      return {
        href:location.href,
        stock:Boolean(window.sebStock),
        parcours:Boolean(window.sebParcours),
        pots:document.querySelectorAll('.pot').length,
        button:Boolean(document.getElementById('stockActionBtn')),
        scripts:Array.from(document.scripts).map(function(script){ return script.src || script.id || '[inline]'; })
      };
    })()
  `, true).catch((error) => ({ error:String(error) }));
  throw new Error('Contrôleur Stock non initialisé. Diagnostic=' + JSON.stringify(diagnostic));
}

async function clearStock(win) {
  await win.webContents.executeJavaScript(`
    [
      'stockCorrect','stockErrors','stockTotal',
      'seb_evalpro_stock_state','seb_evalpro_page_draft_stock.html',
      'seb_exercise_activity:stock.html'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForStock(win);
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
    await waitForStock(win);
    await clearStock(win);

    const initial = await win.webContents.executeJavaScript(`
      (function(){
        const example=document.querySelector('.pot[data-pot-id="8"]');
        const parent=example && example.parentElement;
        const level=parent && parent.closest('[data-etagere][data-niveau]');
        return {
          pots:document.querySelectorAll('.pot').length,
          evaluated:document.querySelectorAll('.pot:not([data-seb-example="true"])').length,
          exampleMarked:example?.dataset.sebExample === 'true',
          examplePosition:level ? [level.dataset.etagere,level.dataset.niveau,parent.dataset.case].join('/') : '',
          total:window.sebStock.totalEvaluated,
          route:window.sebParcours.nextFile('stock'),
          button:document.getElementById('stockActionBtn')?.textContent || ''
        };
      })()
    `, true);

    if (initial.pots !== 34) throw new Error('Le Stock doit contenir 34 flacons physiques.');
    if (initial.evaluated !== 33 || initial.total !== 33) throw new Error('Le Stock doit évaluer exactement 33 flacons.');
    if (!initial.exampleMarked || initial.examplePosition !== '1/1/1') throw new Error('Le flacon exemple Ab-62 n’est pas préplacé/exclu correctement.');
    if (initial.route !== 'planning.html') throw new Error('Route Stock -> planning incorrecte.');
    if (!/Vérifier/.test(initial.button)) throw new Error('Bouton Vérifier Stock absent au départ.');

    const emptyScore = await win.webContents.executeJavaScript('window.sebStock.verifyPlacements()', true);
    if (emptyScore.correct !== 0 || emptyScore.errors !== 33 || emptyScore.total !== 33) {
      throw new Error('Les flacons non rangés ne sont pas tous comptés en erreur.');
    }

    const storedEmpty = await win.webContents.executeJavaScript(`
      ({
        correct:sessionStorage.getItem('stockCorrect'),
        errors:sessionStorage.getItem('stockErrors'),
        total:sessionStorage.getItem('stockTotal')
      })
    `, true);
    if (storedEmpty.correct !== '0' || storedEmpty.errors !== '33' || storedEmpty.total !== '33') {
      throw new Error('Contrat historique Stock incorrect après vérification vide.');
    }

    await clearStock(win);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        const used=new Set(['1/1/1']);
        for(const definition of window.sebStock.pots){
          if(String(definition.id)==='8') continue;
          const choices=window.sebStock.positionsForPotId(definition.id);
          let chosen=null;
          for(const pos of choices){
            const key=[pos.etagere,pos.niveau,pos.case].join('/');
            if(!used.has(key)){ chosen=pos; used.add(key); break; }
          }
          if(!chosen) return {ok:false,id:definition.id,reason:'no-free-position'};
          if(!window.sebStock.placePot(definition.id,chosen,false)) {
            return {ok:false,id:definition.id,reason:'place-failed',chosen};
          }
        }
        window.sebStock.persistState(false);
        return {ok:true,score:window.sebStock.computeScore(false),positions:window.sebStock.capturePositions()};
      })()
    `, true);

    if (!perfect.ok) throw new Error('Impossible de construire le rangement parfait: ' + JSON.stringify(perfect));
    if (perfect.score.correct !== 33 || perfect.score.errors !== 0 || perfect.score.total !== 33) {
      throw new Error('Le rangement parfait n’obtient pas 33/33.');
    }

    const finalScore = await win.webContents.executeJavaScript('window.sebStock.verifyPlacements()', true);
    if (finalScore.correct !== 33 || finalScore.errors !== 0 || finalScore.total !== 33) {
      throw new Error('Validation finale Stock incorrecte.');
    }

    const afterValidation = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_stock_state')||'null');
        return {
          correct:sessionStorage.getItem('stockCorrect'),
          errors:sessionStorage.getItem('stockErrors'),
          total:sessionStorage.getItem('stockTotal'),
          validated:!!state?.validated,
          positions:Array.isArray(state?.positions)?state.positions.length:0,
          button:document.getElementById('stockActionBtn')?.textContent || ''
        };
      })()
    `, true);

    if (afterValidation.correct !== '33' || afterValidation.errors !== '0' || afterValidation.total !== '33') {
      throw new Error('Résultats Stock non persistés.');
    }
    if (!afterValidation.validated || afterValidation.positions !== 34) throw new Error('État de reprise Stock incomplet.');
    if (!/Suivant/.test(afterValidation.button)) throw new Error('Bouton Suivant absent après validation.');

    await win.reload();
    await waitForStock(win);

    const restored = await win.webContents.executeJavaScript(`
      (function(){
        const score=window.sebStock.computeScore(false);
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_stock_state')||'null');
        const example=document.querySelector('.pot[data-pot-id="8"]');
        return {
          score,
          pots:document.querySelectorAll('.pot').length,
          positions:Array.isArray(state?.positions)?state.positions.length:0,
          validated:!!state?.validated,
          exampleMarked:example?.dataset.sebExample === 'true',
          button:document.getElementById('stockActionBtn')?.textContent || '',
          route:window.sebParcours.nextFile('stock')
        };
      })()
    `, true);

    if (restored.pots !== 34 || restored.score.correct !== 33 || restored.score.errors !== 0) {
      throw new Error('Rangement Stock perdu après rechargement.');
    }
    if (!restored.validated || restored.positions !== 34) throw new Error('État validé Stock perdu après rechargement.');
    if (!restored.exampleMarked) throw new Error('Exclusion du flacon exemple perdue après rechargement.');
    if (!/Suivant/.test(restored.button)) throw new Error('État Suivant Stock perdu après rechargement.');
    if (restored.route !== 'planning.html') throw new Error('Route Stock -> planning perdue après rechargement.');

    console.log('STOCK_FUNCTIONAL_SMOKE: OK');
    console.log('STOCK_EMPTY=0/33_ERRORS_33');
    console.log('STOCK_PERFECT=33/33_ERRORS_0');
    console.log('STOCK_POTS=' + restored.pots);
    console.log('STOCK_ROUTE=' + restored.route);
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test Stock.'), 45000);
