const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'carre.html');

function fail(message, detail) {
  console.error('CARRE_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForPage(win) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebCarre && window.sebParcours && document.getElementById('btnValidate'))",
      true
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Contrôleur Carré non initialisé.');
}

async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      sessionStorage.removeItem('puzzleErrors');
      sessionStorage.removeItem('carre_magique_score');
      sessionStorage.removeItem('carre_magique_erreurs');

      const solution=[
        [4,3,1,2],
        [2,4,3,1],
        [3,1,2,4],
        [1,2,4,3]
      ];
      for(let row=0;row<4;row+=1){
        for(let col=0;col<4;col+=1){
          const cell=document.querySelector('[data-row="'+row+'"][data-col="'+col+'"]');
          cell.value=String(solution[row][col]);
        }
      }

      // Une erreur volontaire pour vérifier score et comptage.
      document.querySelector('[data-row="3"][data-col="3"]').value='1';
      const result=window.sebCarre.validatePuzzle();
      assert(result.score===15,'Score attendu 15/16, obtenu '+result.score);
      assert(result.erreurs===1,'Erreur attendue 1, obtenue '+result.erreurs);
      assert(sessionStorage.getItem('puzzleErrors')==='1','puzzleErrors incorrect.');
      assert(sessionStorage.getItem('carre_magique_score')==='15','carre_magique_score incorrect.');
      assert(sessionStorage.getItem('carre_magique_erreurs')==='1','carre_magique_erreurs incorrect.');

      const reset=document.querySelector('.btn-reset');
      const validate=document.getElementById('btnValidate');
      const next=document.getElementById('btnNext');
      assert(reset.disabled===true,'Recommencer non verrouillé.');
      assert(reset.style.display==='none','Recommencer encore visible.');
      assert(validate.disabled===true,'Valider non verrouillé.');
      assert(validate.style.display==='none','Valider encore visible.');
      assert(next.classList.contains('show'),'Page suivante non affichée.');
      assert(Array.from(document.querySelectorAll('.cell')).every((cell)=>cell.disabled),'Cases non verrouillées.');

      window.sebCarre.resetPuzzle();
      assert(sessionStorage.getItem('carre_magique_score')==='15','Reset après validation a modifié le score.');

      assert(window.sebParcours.nextUrl('carre')==='qcmv1.0.html?page=11#page11','Route Carré -> QCM page 11 incorrecte.');
      return {score:result.score,errors:result.erreurs,route:window.sebParcours.nextUrl('carre')};
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
    const result=await runScenario(win);
    console.log('CARRE_FUNCTIONAL_SMOKE: OK');
    console.log('CARRE_SCORE='+result.score+'/16');
    console.log('CARRE_ERRORS='+result.errors);
    console.log('CARRE_ROUTE='+result.route);
    win.destroy();
    app.exit(0);
  } catch(error) {
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test Carré.'),45000);
