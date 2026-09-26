const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'paronymes.html');

function fail(message, detail) {
  console.error('PARONYMES_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForPage(win) {
  for (let i=0;i<80;i+=1) {
    const ready=await win.webContents.executeJavaScript(
      "Boolean(window.sebParonymes && window.sebParcours && document.getElementById('btnCheck'))", true
    );
    if (ready) return;
    await new Promise((resolve)=>setTimeout(resolve,50));
  }
  throw new Error('Contrôleur Paronymes non initialisé.');
}

async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      for(const key of ['paronymes_score','paronymes_total','paronymes_reponses','paronymes_erreurs_detail','seb_paronymes_validated','seb_exercise_activity:paronymes.html']){
        sessionStorage.removeItem(key);
      }
      window.alert=function(){};

      const rows=Array.from(document.querySelectorAll('tr')).filter((row)=>row.querySelector('.paronyme'));
      assert(rows.length===20,'20 lignes attendues, obtenu '+rows.length);

      const first=rows.find((row)=>row.querySelector('.paronyme').textContent.trim()==='Apitoiement');
      const arbor=rows.find((row)=>row.querySelector('.paronyme').textContent.trim()==='Arboré');
      const pity=Array.from(first.querySelectorAll('td:not(.paronyme)')).find((cell)=>cell.textContent.trim()==='Pitié');
      const wooded=Array.from(arbor.querySelectorAll('td:not(.paronyme)')).find((cell)=>cell.textContent.trim()==='Boisé');
      assert(pity&&pity.dataset.correct==='true','Pitié non marquée correcte.');
      assert(wooded&&wooded.dataset.correct==='true','Boisé non marqué correct.');

      pity.click();
      wooded.click();
      document.getElementById('btnCheck').click();

      const score=sessionStorage.getItem('paronymes_score');
      const total=sessionStorage.getItem('paronymes_total');
      const responses=JSON.parse(sessionStorage.getItem('paronymes_reponses')||'[]');
      const errors=JSON.parse(sessionStorage.getItem('paronymes_erreurs_detail')||'[]');
      assert(score==='2','Score attendu 2/20, obtenu '+score);
      assert(total==='20','Total attendu 20, obtenu '+total);
      assert(responses.length===20,'20 réponses de diagnostic attendues.');
      assert(errors.length===18,'18 erreurs/non-réponses attendues, obtenu '+errors.length);
      assert(sessionStorage.getItem('seb_paronymes_validated')==='1','Validation finale absente.');
      assert(document.getElementById('btnCheck').style.display==='none','Bouton Vérifier encore visible.');
      const next=document.getElementById('btnNextParonymes');
      assert(next&&getComputedStyle(next).display!=='none','Bouton Suivant absent après validation.');
      assert(first.querySelector('td:not(.paronyme)').style.pointerEvents==='none','Réponses non verrouillées.');
      assert(window.sebParcours.nextFile('paronymes')==='carre.html','Route Paronymes -> Carré incorrecte.');

      return {score,total,route:window.sebParcours.nextFile('paronymes')};
    })()
  `, true);
}

async function verifyReload(win) {
  await win.reload();
  await waitForPage(win);
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      const rows=Array.from(document.querySelectorAll('tr')).filter((row)=>row.querySelector('.paronyme'));
      const first=rows.find((row)=>row.querySelector('.paronyme').textContent.trim()==='Apitoiement');
      const arbor=rows.find((row)=>row.querySelector('.paronyme').textContent.trim()==='Arboré');
      const pity=Array.from(first.querySelectorAll('td:not(.paronyme)')).find((cell)=>cell.textContent.trim()==='Pitié');
      const wooded=Array.from(arbor.querySelectorAll('td:not(.paronyme)')).find((cell)=>cell.textContent.trim()==='Boisé');
      assert(sessionStorage.getItem('paronymes_score')==='2','Score perdu après rechargement.');
      assert(pity.classList.contains('correct-answer'),'Pitié non restaurée comme correcte.');
      assert(wooded.classList.contains('correct-answer'),'Boisé non restauré comme correct.');
      assert(document.getElementById('btnCheck').style.display==='none','Vérifier réapparu après rechargement.');
      const next=document.getElementById('btnNextParonymes');
      assert(next&&getComputedStyle(next).display!=='none','Suivant absent après rechargement.');
      return {route:window.sebParcours.nextFile('paronymes')};
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
    const first=await runScenario(win);
    const reloaded=await verifyReload(win);
    console.log('PARONYMES_FUNCTIONAL_SMOKE: OK');
    console.log('PARONYMES_SCORE='+first.score+'/'+first.total);
    console.log('PARONYMES_ROUTE='+reloaded.route);
    win.destroy(); app.exit(0);
  }catch(error){
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test Paronymes.'),45000);
