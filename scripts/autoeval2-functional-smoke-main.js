const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'autoeval2.html');

function fail(message, detail) {
  console.error('AUTOEVAL2_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}
async function waitForPage(win) {
  for (let i=0;i<80;i+=1) {
    const ready=await win.webContents.executeJavaScript(
      "Boolean(window.sebAutoEval2 && window.sebParcours && document.getElementById('autoEvalForm'))", true
    );
    if (ready) return;
    await new Promise((resolve)=>setTimeout(resolve,50));
  }
  throw new Error('Contrôleur autoeval2 non initialisé.');
}
async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      sessionStorage.removeItem('autoEval2_resultats');
      const stress=document.getElementById('stresstexte');
      const easyMail=document.getElementById('difficultemessage');
      const comment=document.getElementById('autoCommentoutils');
      stress.checked=true;
      easyMail.checked=true;
      comment.value='Commentaire de test';
      const data=window.sebAutoEval2.saveEvaluation();
      assert(data.selections.length===2,'Nombre de sélections incorrect.');
      assert(data.selections.includes('stress'),'Valeur stress perdue.');
      assert(data.selections.includes('difficultemessage'),'Valeur difficultemessage perdue.');
      assert(data.commentaire==='Commentaire de test','Commentaire perdu.');
      const stored=JSON.parse(sessionStorage.getItem('autoEval2_resultats')||'null');
      assert(stored&&stored.commentaire==='Commentaire de test','autoEval2_resultats absent.');
      assert(document.getElementById('autoEvalResult').textContent.includes('Autoévaluation enregistrée'),'Feedback absent.');
      assert(window.sebParcours.nextFile('autoeval2')==='paronymes.html','Route autoeval2 -> paronymes incorrecte.');
      return {route:window.sebParcours.nextFile('autoeval2')};
    })()
  `, true);
}
async function verifyReload(win) {
  await win.reload();
  await waitForPage(win);
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      const stored=JSON.parse(sessionStorage.getItem('autoEval2_resultats')||'null');
      assert(stored&&stored.selections.length===2,'Données perdues après rechargement.');
      assert(document.getElementById('stresstexte').checked===true,'Case stress non restaurée.');
      assert(document.getElementById('difficultemessage').checked===true,'Case messagerie non restaurée.');
      assert(document.getElementById('autoCommentoutils').value==='Commentaire de test','Commentaire non restauré.');
      return {route:window.sebParcours.nextFile('autoeval2')};
    })()
  `, true);
}
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
  try{
    await win.loadFile(page);
    await waitForPage(win);
    await runScenario(win);
    const reloaded=await verifyReload(win);
    console.log('AUTOEVAL2_FUNCTIONAL_SMOKE: OK');
    console.log('AUTOEVAL2_ROUTE='+reloaded.route);
    win.destroy(); app.exit(0);
  }catch(error){
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));
setTimeout(()=>fail('Timeout global du smoke test autoeval2.'),45000);
