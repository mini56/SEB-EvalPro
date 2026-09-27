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
