const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'nvmail.html');

function fail(message, detail) {
  console.error('NVMAIL_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForPage(win) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebNvmail && window.sebParcours && document.getElementById('formEmail') && document.getElementById('nvmail-file-picker'))",
      true
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Contrôleur nvmail non initialisé.');
}

async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (async function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      sessionStorage.clear();
      sessionStorage.setItem('candidat_data', JSON.stringify({
        nom:'DUPONT',
        prénom:'Élodie',
        lieu:'Lorient',
        groupe:'7',
        date:'2026-09-26'
      }));

      const to=document.getElementById('to');
      const cc=document.getElementById('cc');
      const subject=document.getElementById('subject');
      const message=document.getElementById('message');
      to.value='conseil.perso@sauvegarde56.org';
      cc.value='stage-pro@sauvegarde56.org';
      subject.value='Élodie Mail-SEB';
      message.value='Bonjour, voici mon rapport. Cordialement, ÉLODIE DUPONT 01.02.34.56.78';

      document.getElementById('nvmail-file-picker').click();
      assert(document.getElementById('modalFichier').style.display==='block','Fenêtre de pièce jointe non ouverte.');
      document.querySelector('[data-seb-file="Rapport_stage.docx"]').click();
      assert(document.getElementById('fichierSelectionne').textContent.trim()==='Rapport_stage.docx','Pièce jointe non sélectionnée.');

      document.getElementById('formEmail').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      const data=JSON.parse(sessionStorage.getItem('page8_data')||'null');
      assert(data,'page8_data absent.');
      assert(data.score_total===6,'Score mail attendu 6/6, obtenu '+data.score_total);
      for(const key of ['score_to','score_cc','score_subject','score_file','score_signature','score_telephone']){
        assert(data[key]===1,'Critère mail non validé: '+key);
      }
      assert(document.getElementById('resultatScore').textContent.includes('Message envoyé'),'Confirmation envoi absente.');

      const wrongCase=window.sebNvmail.saveEmailAnswers(
        'Conseil.perso@sauvegarde56.org',
        'stage-pro@sauvegarde56.org',
        'Élodie Mail-SEB',
        message.value,
        'Rapport_stage.docx'
      );
      assert(wrongCase.score_to===0,'Adresse À ne doit pas accepter une casse différente.');

      const wrongSubject=window.sebNvmail.saveEmailAnswers(
        'conseil.perso@sauvegarde56.org',
        'stage-pro@sauvegarde56.org',
        'Mail-SEB Élodie',
        message.value,
        'Rapport_stage.docx'
      );
      assert(wrongSubject.score_subject===0,'Objet inversé accepté à tort.');

      const finalData=window.sebNvmail.saveEmailAnswers(
        'conseil.perso@sauvegarde56.org',
        'stage-pro@sauvegarde56.org',
        'élodie mail-seb',
        message.value,
        'Rapport_stage.docx'
      );
      assert(finalData.score_total===6,'Objet normalisé valide non accepté.');
      assert(window.sebParcours.nextFile('nvmail')==='autoeval2.html','Route nvmail -> autoeval2 incorrecte.');

      return {score:finalData.score_total,route:window.sebParcours.nextFile('nvmail')};
    })()
  `, true);
}

async function verifyReload(win) {
  await win.reload();
  await waitForPage(win);
  return win.webContents.executeJavaScript(`
    (function(){
      const data=JSON.parse(sessionStorage.getItem('page8_data')||'null');
      const fields={
        to:document.getElementById('to').value,
        cc:document.getElementById('cc').value,
        subject:document.getElementById('subject').value,
        message:document.getElementById('message').value,
        file:document.getElementById('fichierSelectionne').textContent.trim()
      };
      if(!data||data.score_total!==6)throw new Error('page8_data perdu après rechargement.');
      if(fields.to!=='conseil.perso@sauvegarde56.org'||fields.cc!=='stage-pro@sauvegarde56.org')throw new Error('Adresses non restaurées.');
      if(fields.subject!=='élodie mail-seb')throw new Error('Objet non restauré.');
      if(fields.file!=='Rapport_stage.docx')throw new Error('Pièce jointe non restaurée.');
      if(!fields.message.includes('ÉLODIE DUPONT'))throw new Error('Message non restauré.');
      return {score:data.score_total,route:window.sebParcours.nextFile('nvmail')};
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
    console.log('NVMAIL_FUNCTIONAL_SMOKE: OK');
    console.log('NVMAIL_SCORE='+first.score+'/6');
    console.log('NVMAIL_RELOAD_SCORE='+reloaded.score+'/6');
    console.log('NVMAIL_ROUTE='+reloaded.route);
    win.destroy();
    app.exit(0);
  } catch(error) {
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test nvmail.'),45000);
