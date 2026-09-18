const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const adminFile = path.join(root, 'app', 'web', 'admin-bilan.html');
const historyFile = path.join(root, 'src', 'bilan-history-preload.js');
const mainFile = path.join(root, 'src', 'main.js');
const preloadFile = path.join(root, 'src', 'preload.js');

function fail(message) {
  console.error('SEB EvalPro IA locale prototype: ' + message);
  process.exit(2);
}
function read(file) {
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + path.relative(root, file));
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function checkHtml(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1] || '')) continue;
    const code = String(m[2] || '').trim();
    if (!code) continue;
    try { new vm.Script(code); }
    catch (error) { fail('JavaScript inline invalide: ' + error.message); }
  }
}

const mainSource = read(mainFile);
const preloadSource = read(preloadFile);
if (!mainSource.includes("ipcMain.handle('ai:rewrite-synthesis'")) fail('IPC IA locale absent du main process');
if (!preloadSource.includes('rewriteSynthesisLocal')) fail('pont IA locale absent du preload');

// -----------------------------------------------------------------------------
// Bilan courant : une seule zone de texte et un seul bouton visible.
// Le moteur déterministe produit d'abord la référence factuelle, puis SEB-IA
// tente sa reformulation. La barre sous le texte indique sans ambiguïté quelle
// formulation est réellement affichée.
// -----------------------------------------------------------------------------
{
  let html = read(adminFile);
  if (!html.includes('seb-165plus-natural-synthesis-v9')) fail('moteur #28 / V9 absent');
  if (html.includes('seb-local-ai-unified-prototype')) fail('interface IA unifiée déjà injectée');
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) fail('fin admin-bilan introuvable');

  const block = String.raw`
<style id="seb-local-ai-unified-style">
#seb-ai-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:8px 0 0;padding:7px 9px;border-top:1px solid #c8c8c8;border-bottom:1px solid #e2e2e2;font:10pt Calibri,Arial,sans-serif}
#seb-ai-state-group{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.seb-ai-apply-state{font-weight:700;white-space:nowrap;color:#333}
#seb-ai-result-detail{font-weight:400;color:#666;white-space:nowrap}
#seb-ai-human-check{margin:0 0 0 auto;color:#666}
#seb-ai-human-check strong{color:#444}
#seb-generate-synthese:disabled{opacity:.6;cursor:wait}
@media print{#seb-ai-footer{display:none!important}}
</style>
<script id="seb-local-ai-unified-prototype">
(()=>{'use strict';
const FINAL_KEY='seb_evalpro_bilan_synthese',SOURCE_KEY='seb_evalpro_bilan_synthese_moteur';
function aiText(v){return String(v||'').replace(/\r\n/g,'\n').trim()}
function stripAiWrappers(v){
 let text=aiText(v);
 text=text.replace(/^\s*<\/?(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*/i,'').replace(/\s*<\/(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*$/i,'').trim();
 return text;
}
function synthesisButton(b){
 const id=String(b?.id||'');
 const text=String(b?.textContent||'').trim().toLocaleLowerCase('fr-FR');
 return id==='seb-generate-synthese'||id==='seb-generate-synthese-engine'||(text.includes('générer')&&text.includes('synthèse'))||(text.includes('regénérer')&&text.includes('synthèse'))||(text.includes('régénérer')&&text.includes('synthèse'));
}
function elapsedLabel(ms){const n=Math.max(0,Number(ms)||0);return n<1000?'< 1 s':Math.round(n/1000)+' s'}
function passesLabel(n){const v=Math.max(0,Number(n)||0);return v+' passe'+(v>1?'s':'')}
function installUnifiedSynthesis(){
 const area=document.getElementById('seb-bilan-synthese-text'),host=document.getElementById('seb-bilan-synthese');
 if(!area||!host||document.getElementById('seb-ai-footer'))return;
 const buttons=[...host.querySelectorAll('button')].filter(synthesisButton);
 let engine=document.getElementById('seb-generate-synthese');
 if(!engine||!host.contains(engine))engine=buttons[0]||null;
 if(!engine)return;
 for(const old of buttons){if(old!==engine)old.remove()}
 engine.id='seb-generate-synthese';engine.style.display='';engine.removeAttribute('aria-hidden');engine.textContent='Générer la synthèse';engine.dataset.sebAiUnified='1';

 const footer=document.createElement('div');footer.id='seb-ai-footer';footer.setAttribute('role','status');footer.setAttribute('aria-live','polite');
 const states=document.createElement('div');states.id='seb-ai-state-group';
 const motorState=document.createElement('span');motorState.id='seb-motor-result-status';motorState.className='seb-ai-apply-state';motorState.textContent='Formulation MOTEUR appliquée ❌';
 const aiState=document.createElement('span');aiState.id='seb-ai-result-status';aiState.className='seb-ai-apply-state';aiState.textContent='SEB-IA : Reformulation IA appliquée ❌';
 const detail=document.createElement('span');detail.id='seb-ai-result-detail';detail.textContent='En attente de génération.';
 states.append(motorState,aiState,detail);
 const warning=document.createElement('p');warning.id='seb-ai-human-check';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';
 footer.append(states,warning);area.insertAdjacentElement('afterend',footer);

 const status=document.getElementById('seb-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 const setApplied=(motor,ai,info)=>{
   motorState.textContent='Formulation MOTEUR appliquée '+(motor?'✅':'❌');
   aiState.textContent='SEB-IA : Reformulation IA appliquée '+(ai?'✅':'❌');
   detail.textContent=info||'';
 };
 engine.addEventListener('click',async()=>{
  engine.disabled=true;setStatus('Génération de la synthèse de référence…');setApplied(false,false,'Traitement en cours…');
  try{
   await Promise.resolve();
   const deterministic=aiText(area.value);
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');setApplied(false,false,'Aucun texte moteur disponible.');return}
   sessionStorage.setItem(SOURCE_KEY,deterministic);
   sessionStorage.setItem(FINAL_KEY,deterministic);
   setApplied(true,false,'SEB-IA reformule localement…');
   setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await window.sebEvalPro?.localAiStatus?.();
    if(!st?.available){setStatus('Synthèse moteur conservée.');setApplied(true,false,'IA indisponible.');return}
    const answer=await window.sebEvalPro.rewriteSynthesisLocal(deterministic);
    if(!answer?.ok){setStatus('Synthèse moteur conservée.');setApplied(true,false,answer?.error||'Reformulation indisponible.');return}
    const finalText=stripAiWrappers(answer.text);
    if(!finalText){setStatus('Synthèse moteur conservée.');setApplied(true,false,'Reformulation vide.');return}
    area.value=finalText;sessionStorage.setItem(FINAL_KEY,finalText);area.dispatchEvent(new Event('input',{bubbles:true}));window.sebEvalPro?.save?.();
    if(answer.fallback){
      setStatus('Synthèse moteur conservée après contrôle SEB-IA.');
      setApplied(true,false,'Contrôle local — '+passesLabel(answer.passes)+', '+elapsedLabel(answer.elapsedMs)+'.');
    }else{
      setStatus('Synthèse reformulée avec SEB-IA.');
      setApplied(false,true,passesLabel(answer.passes)+', '+elapsedLabel(answer.elapsedMs)+'.');
    }
   }catch(error){setStatus('Synthèse moteur conservée.');setApplied(true,false,String(error?.message||error))}
  }finally{engine.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installUnifiedSynthesis,320),{once:true});else setTimeout(installUnifiedSynthesis,320);
})();
</script>
`;
  html = html.slice(0, end) + block + html.slice(end);
  checkHtml(html);
  write(adminFile, html);
}

// -----------------------------------------------------------------------------
// Anciens bilans : même fonctionnement unifié et même barre de contrôle visible.
// -----------------------------------------------------------------------------
{
  let js = read(historyFile);
  if (!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9')) fail('V9 historique absent');
  if (js.includes('SEB_HISTORY_LOCAL_AI_UNIFIED')) fail('interface IA historique unifiée déjà injectée');

  const addon = String.raw`

// SEB_HISTORY_LOCAL_AI_UNIFIED
function sebBhInstallUnifiedSynthesis(){
 const summary=document.querySelector('#seb-bh-history-summary');
 if(!summary||document.querySelector('#seb-bh-ai-footer'))return;
 const host=summary.closest('section')||summary.parentElement;
 if(!host)return;
 const isSynthButton=b=>{const id=String(b?.id||'');const text=String(b?.textContent||'').trim().toLocaleLowerCase('fr-FR');return id==='seb-bh-gen-summary'||id==='seb-bh-gen-summary-engine'||(text.includes('générer')&&text.includes('synthèse'))||(text.includes('regénérer')&&text.includes('synthèse'))||(text.includes('régénérer')&&text.includes('synthèse'))};
 const buttons=[...host.querySelectorAll('button')].filter(isSynthButton);
 let engine=document.querySelector('#seb-bh-gen-summary');if(!engine||!host.contains(engine))engine=buttons[0]||null;if(!engine)return;
 for(const old of buttons){if(old!==engine)old.remove()}
 engine.id='seb-bh-gen-summary';engine.style.display='';engine.removeAttribute('aria-hidden');engine.textContent='Générer la synthèse';engine.dataset.sebAiUnified='1';

 const footer=document.createElement('div');footer.id='seb-bh-ai-footer';footer.setAttribute('role','status');footer.setAttribute('aria-live','polite');footer.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:8px 0 0;padding:7px 9px;border-top:1px solid #c8c8c8;border-bottom:1px solid #e2e2e2;font:12px Calibri,Arial,sans-serif';
 const states=document.createElement('div');states.style.cssText='display:flex;align-items:center;gap:12px;flex-wrap:wrap';
 const motorState=document.createElement('span');motorState.id='seb-bh-motor-result-status';motorState.style.fontWeight='700';motorState.textContent='Formulation MOTEUR appliquée ❌';
 const aiState=document.createElement('span');aiState.id='seb-bh-ai-result-status';aiState.style.fontWeight='700';aiState.textContent='SEB-IA : Reformulation IA appliquée ❌';
 const detail=document.createElement('span');detail.id='seb-bh-ai-result-detail';detail.style.color='#666';detail.textContent='En attente de génération.';
 states.append(motorState,aiState,detail);
 const warning=document.createElement('p');warning.id='seb-bh-ai-human-check';warning.style.cssText='margin:0 0 0 auto;color:#666';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';
 footer.append(states,warning);summary.insertAdjacentElement('afterend',footer);

 let status=document.querySelector('#seb-bh-summary-status')||document.querySelector('#seb-bh-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 const elapsed=ms=>{const n=Math.max(0,Number(ms)||0);return n<1000?'< 1 s':Math.round(n/1000)+' s'};
 const passes=n=>{const v=Math.max(0,Number(n)||0);return v+' passe'+(v>1?'s':'')};
 const setApplied=(motor,ai,info)=>{motorState.textContent='Formulation MOTEUR appliquée '+(motor?'✅':'❌');aiState.textContent='SEB-IA : Reformulation IA appliquée '+(ai?'✅':'❌');detail.textContent=info||''};
 engine.addEventListener('click',async()=>{
  engine.disabled=true;setStatus('Génération de la synthèse de référence…');setApplied(false,false,'Traitement en cours…');
  try{
   await Promise.resolve();
   const deterministic=String(summary.value||'').replace(/\r\n/g,'\n').trim();
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');setApplied(false,false,'Aucun texte moteur disponible.');return}
   setApplied(true,false,'SEB-IA reformule localement…');setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await ipcRenderer.invoke('ai:status');
    if(!st?.available){setStatus('Synthèse moteur conservée.');setApplied(true,false,'IA indisponible.');return}
    const answer=await ipcRenderer.invoke('ai:rewrite-synthesis',deterministic);
    if(!answer?.ok){setStatus('Synthèse moteur conservée.');setApplied(true,false,answer?.error||'Reformulation indisponible.');return}
    let finalText=String(answer.text||'').replace(/\r\n/g,'\n').trim();
    finalText=finalText.replace(/^\s*<\/?(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*/i,'').replace(/\s*<\/(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*$/i,'').trim();
    if(!finalText){setStatus('Synthèse moteur conservée.');setApplied(true,false,'Reformulation vide.');return}
    summary.value=finalText;summary.dispatchEvent(new Event('input',{bubbles:true}));
    if(answer.fallback){setStatus('Synthèse moteur conservée après contrôle SEB-IA.');setApplied(true,false,'Contrôle local — '+passes(answer.passes)+', '+elapsed(answer.elapsedMs)+'.')}
    else{setStatus('Synthèse reformulée avec SEB-IA.');setApplied(false,true,passes(answer.passes)+', '+elapsed(answer.elapsedMs)+'.')}
   }catch(error){setStatus('Synthèse moteur conservée.');setApplied(true,false,String(error?.message||error))}
  }finally{engine.disabled=false}
 });
}
(function sebBhWatchUnifiedSynthesis(){
 const install=()=>setTimeout(sebBhInstallUnifiedSynthesis,120);
 const start=()=>{
  install();
  const root=document.documentElement||document.body;
  if(!root){setTimeout(start,50);return}
  const observer=new MutationObserver(()=>{if(document.querySelector('#seb-bh-history-summary')&&!document.querySelector('#seb-bh-ai-footer'))install()});
  observer.observe(root,{childList:true,subtree:true});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
`;

  js += addon;
  try { new vm.Script(js); }
  catch (error) { fail('historique IA invalide: ' + error.message); }
  if (js.includes('}).observe(document.documentElement')) fail('observer IA historique démarré avant DOM');
  write(historyFile, js);
}

console.log('SEB EvalPro IA locale prototype: barre visible MOTEUR/IA avec ✅/❌ et avertissement de relecture.');
