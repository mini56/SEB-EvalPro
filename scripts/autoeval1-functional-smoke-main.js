const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'autoeval1.html');

function fail(message, detail) {
  console.error('AUTOEVAL1_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForPage(win) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebAutoEval1 && window.sebParcours && document.getElementById('autoEvalForm'))",
      true
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Contrôleur autoeval1 non initialisé.');
}

async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      sessionStorage.removeItem('autoEval1_resultats');

      const empty=window.sebAutoEval1.readForm();
      assert(window.sebAutoEval1.hasResponse(empty)===false,'Autoévaluation vide reconnue à tort comme complétée.');

      document.getElementById('ease').checked=true;
      document.getElementById('progress').checked=true;
      document.getElementById('autoComment').value='Commentaire de test';

      const data=window.sebAutoEval1.saveEvaluation();
      assert(data.selections.length===2,'Nombre de sélections incorrect.');
      assert(data.selections.includes('ease'),'Valeur ease perdue.');
      assert(data.selections.includes('progress'),'Valeur progress perdue.');
      assert(data.commentaire==='Commentaire de test','Commentaire perdu.');
      assert(window.sebAutoEval1.hasResponse(data)===true,'Autoévaluation complétée non reconnue.');

      const stored=JSON.parse(sessionStorage.getItem('autoEval1_resultats')||'null');
      assert(stored&&stored.commentaire==='Commentaire de test','autoEval1_resultats absent.');
      assert(window.sebParcours.nextFile('autoeval1')==='introbrique.html','Route autoeval1 -> introbrique incorrecte.');

      const next=document.getElementById('autoeval1-next');
      const nextHidden=Boolean(next && (next.hidden || getComputedStyle(next).display==='none'));
      assert(nextHidden===true,'Ancien bouton Étape suivante doit rester masqué par la règle autoévaluation obligatoire.');

      return {route:window.sebParcours.nextFile('autoeval1'), selections:stored.selections.slice()};
    })()
  `, true);
}

async function verifyReload(win) {
  await win.reload();
  await waitForPage(win);
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      const stored=JSON.parse(sessionStorage.getItem('autoEval1_resultats')||'null');
      assert(stored&&stored.selections.length===2,'Données perdues après rechargement.');
      assert(document.getElementById('ease').checked===true,'Case ease non restaurée.');
      assert(document.getElementById('progress').checked===true,'Case progress non restaurée.');
      assert(document.getElementById('autoComment').value==='Commentaire de test','Commentaire non restauré.');
      return {route:window.sebParcours.nextFile('autoeval1')};
    })()
  `, true);
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
    await waitForPage(win);
    const first=await runScenario(win);
    const reloaded=await verifyReload(win);
    console.log('AUTOEVAL1_FUNCTIONAL_SMOKE: OK');
    console.log('AUTOEVAL1_SELECTIONS='+first.selections.join(','));
    console.log('AUTOEVAL1_ROUTE='+reloaded.route);
    win.destroy();
    app.exit(0);
  } catch(error) {
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test autoeval1.'),45000);
