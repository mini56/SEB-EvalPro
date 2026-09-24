const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const adminFile=path.join(root,'app','web','admin-bilan.html');
const historyFile=path.join(root,'src','bilan-history-preload.js');
const engineFile=path.join(root,'src','seb-ia-engine.js');

function fail(message){console.error('SEB-IA V1 intégration: '+message);process.exit(2)}
function read(file){if(!fs.existsSync(file))fail('fichier introuvable: '+path.relative(root,file));return fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')}
function write(file,text){fs.writeFileSync(file,text,'utf8')}
function checkHtml(html){
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m;
  while((m=re.exec(html))){
    if(/\bsrc\s*=/.test(m[1]||''))continue;
    const code=String(m[2]||'').trim();if(!code)continue;
    try{new vm.Script(code)}catch(error){fail('JavaScript inline invalide: '+error.message)}
  }
}

const engineSource=read(engineFile);
{
  const box={module:{exports:{}},exports:{},globalThis:{}};
  box.global=box.globalThis;
  new vm.Script(engineSource,{filename:'seb-ia-engine.js'}).runInNewContext(box);
  const api=box.module.exports&&box.module.exports.generate?box.module.exports:box.globalThis.SEB_IA_ENGINE;
  if(!api||typeof api.generate!=='function')fail('moteur SEB-IA non chargeable');
}

// -----------------------------------------------------------------------------
// Bilan courant : SEB-IA remplace le listener V7/V8/V9 et génère directement
// depuis le tableau. Aucun modèle externe, aucun serveur local, aucun appel réseau.
// -----------------------------------------------------------------------------
{
  let html=read(adminFile);
  if(!html.includes('seb-165plus-natural-synthesis-v9'))fail('moteur V9 absent avant intégration SEB-IA');
  if(html.includes('seb-ia-v1-integration'))fail('SEB-IA V1 déjà injectée');

  const end=html.toLowerCase().lastIndexOf('</body>');
  if(end<0)fail('fin admin-bilan introuvable');

  const block='<script id="seb-ia-v1-engine">\n'+engineSource+'\n</script>\n'+String.raw`
<script id="seb-ia-v1-integration">
(()=>{'use strict';
function sebIaCandidate(){
  try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}
}
function sebIaAbandons(){
  try{const value=JSON.parse(sessionStorage.getItem('seb_evalpro_abandons')||'[]');return Array.isArray(value)?value:[]}catch(_){return[]}
}
function sebIaRow(key){
  const row=document.querySelector('tr[data-r="'+key+'"]');
  if(!row)return{key,level:'',comment:'',detail:'',moduleText:''};
  return{
    key,
    level:String(row.dataset.level||row.querySelector('.level.on')?.dataset.l||''),
    comment:String(row.querySelector('.ctxt')?.value||'').trim(),
    detail:String(row.querySelector('.detail')?.textContent||'').trim(),
    moduleText:String(row.querySelector('td')?.innerText||row.querySelector('td')?.textContent||'').trim()
  };
}
function sebIaSnapshot(){
  const api=window.SEB_IA_ENGINE;
  return{
    candidate:sebIaCandidate(),
    rows:Object.keys(api.META).map(sebIaRow),
    abandons:sebIaAbandons()
  };
}
function sebIaInstall(){
  const api=window.SEB_IA_ENGINE;
  const area=document.getElementById('seb-bilan-synthese-text');
  const old=document.getElementById('seb-generate-synthese');
  if(!api||!area||!old)return;
  if(old.dataset.sebIaV1==='1')return;

  const button=old.cloneNode(true);
  button.id='seb-generate-synthese';
  button.dataset.sebIaV1='1';
  button.textContent='Générer la synthèse';
  old.replaceWith(button);

  const legacyFooter=document.getElementById('seb-ai-footer');
  if(legacyFooter)legacyFooter.remove();

  button.addEventListener('click',()=>{
    button.disabled=true;
    const status=document.getElementById('seb-synthese-status');
    if(status)status.textContent='SEB-IA construit la synthèse à partir du tableau et des données du parcours…';
    try{
      const result=api.generate(sebIaSnapshot());
      if(!result||!result.ok){
        const reason=result&&result.validation&&result.validation.errors?result.validation.errors.join(' · '):'contrôle interne non validé';
        if(status)status.textContent='SEB-IA : synthèse non appliquée — '+reason+'.';
        return;
      }
      area.value=result.text;
      sessionStorage.setItem('seb_evalpro_bilan_synthese',result.text);
      sessionStorage.setItem('seb_evalpro_bilan_synthese_engine',result.version||'SEB-IA');
      sessionStorage.setItem('seb_evalpro_bilan_synthese_fingerprint',result.fingerprint||'');
      area.dispatchEvent(new Event('input',{bubbles:true}));
      if(window.sebEvalPro&&window.sebEvalPro.save)window.sebEvalPro.save();
      if(status)status.textContent=(result.version||'SEB-IA')+' — synthèse générée et contrôlée à partir du tableau et des données du parcours. Vous pouvez la modifier.';
    }catch(error){
      if(status)status.textContent='SEB-IA : '+String(error&&error.message?error.message:error);
    }finally{
      button.disabled=false;
    }
  });
}
const install=()=>setTimeout(sebIaInstall,360);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>
`;
  html=html.slice(0,end)+block+html.slice(end);
  checkHtml(html);
  write(adminFile,html);
}

// -----------------------------------------------------------------------------
// Historique : même moteur sur les révisions de bilan. Les synthèses déjà
// corrigées manuellement ne sont jamais modifiées automatiquement.
// -----------------------------------------------------------------------------
{
  let js=read(historyFile);
  if(!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9'))fail('V9 historique absent');
  if(js.includes('SEB_HISTORY_SEB_IA_V1'))fail('SEB-IA V1 historique déjà injectée');

  const addon=String.raw`

// SEB_HISTORY_SEB_IA_V1
const sebIaHistoryEngine=require('./seb-ia-engine');
function sebIaHistoryRows(card){
  return Object.keys(sebIaHistoryEngine.META).map((key)=>{
    const row=[...card.querySelectorAll('tbody tr')].find((x)=>x.dataset?.key===key&&!x.classList.contains('seb-bh-section'));
    if(!row)return{key,level:'',comment:'',detail:'',moduleText:''};
    return{
      key,
      level:String(row.querySelector('.seb-bh-level.on')?.dataset.level||''),
      comment:String(row.querySelector('.seb-bh-comment')?.value||'').trim(),
      detail:String(row.querySelector('.seb-bh-detail')?.textContent||'').trim(),
      moduleText:String(row.querySelector('td')?.innerText||row.querySelector('td')?.textContent||'').trim()
    };
  });
}
sebV4HistorySummary=function(card,candidate){
  const result=sebIaHistoryEngine.generate({candidate:candidate||{},rows:sebIaHistoryRows(card)});
  return result&&result.ok?result.text:'';
};
`;
  js+=addon;
  try{new vm.Script(js,{filename:'bilan-history-preload.js'})}catch(error){fail('historique SEB-IA invalide: '+error.message)}
  write(historyFile,js);
}

console.log('SEB-IA V1: moteur rédactionnel déterministe intégré au bilan courant et à l’historique, sans Mistral ni llama-server.');
